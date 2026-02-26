import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { mapTeamKey, normaliseHost, teamKeys, warehouseIdFromHttpPath } from "../src/lib/databricks-utils";

const teamKeySchema = z.enum(teamKeys);

const statementResponseSchema = z.object({
  statement_id: z.string(),
  status: z.object({
    state: z.string(),
  }),
  result: z
    .object({
      data_array: z.array(z.array(z.unknown())).optional(),
    })
    .optional(),
  manifest: z
    .object({
      schema: z
        .object({
          columns: z.array(
            z.object({
              name: z.string(),
            }),
          ),
        })
        .optional(),
    })
    .optional(),
});

const accuracyGameSchema = z.object({
  date: z.string().min(1),
  kickoff_time_utc: z.string().nullable().optional(),
  home_team: teamKeySchema,
  away_team: teamKeySchema,
  predicted_winner: teamKeySchema,
  actual_winner: teamKeySchema,
  correct: z.boolean(),
});

const accuracyRoundSchema = z.object({
  round: z.coerce.number().int().nonnegative(),
  round_label: z.string().min(1),
  tips: z.coerce.number().int().nonnegative(),
  correct: z.coerce.number().int().nonnegative(),
  accuracy_pct: z.coerce.number(),
  mae: z.coerce.number(),
  games: z.array(accuracyGameSchema),
});

const accuracySchema = z.object({
  season: z.coerce.number().int(),
  as_at_round: z.string().min(1),
  total_tips: z.coerce.number().int().nonnegative(),
  tips_correct: z.coerce.number().int().nonnegative(),
  accuracy_pct: z.coerce.number(),
  mae: z.coerce.number(),
  bits: z.coerce.number(),
  by_round: z.array(accuracyRoundSchema),
});

const upcomingPredictionSchema = z.object({
  round: z.string().min(1),
  date: z.string().min(1),
  kickoff_time_utc: z.string().nullable().optional(),
  kickoff_time_local: z.string().nullable().optional(),
  kickoff_tz_offset: z.string().nullable().optional(),
  kickoff_time_utc_iso: z.string().nullable().optional(),
  home_team: teamKeySchema,
  away_team: teamKeySchema,
  venue: z.string().min(1),
  predicted_winner: teamKeySchema,
  home_win_probability: z.coerce.number().min(0).max(1),
  away_win_probability: z.coerce.number().min(0).max(1),
  predicted_margin: z.coerce.number(),
  home_elo: z.coerce.number(),
  away_elo: z.coerce.number(),
  elo_diff: z.coerce.number(),
});

const ladderEntrySchema = z.object({
  team: teamKeySchema,
  position: z.coerce.number().int().positive(),
  wins: z.coerce.number(),
  losses: z.coerce.number(),
  draws: z.coerce.number(),
  percentage: z.coerce.number(),
  predicted_final_wins: z.coerce.number().optional(),
  predicted_final_position: z.coerce.number().int().positive().optional(),
});

const host = process.env.DATABRICKS_HOST;
const token = process.env.DATABRICKS_TOKEN;
const httpPath = process.env.DATABRICKS_HTTP_PATH;

if (!host || !token || !httpPath) {
  console.error("Missing required env vars: DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_HTTP_PATH");
  process.exit(1);
}

const resolvedWarehouseId = warehouseIdFromHttpPath(httpPath);
const resolvedHost = normaliseHost(host);

const baseHeaders = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

const queries = {
  currentSeason: `SELECT MAX(season) AS season FROM dev_afl.afl_tipping.gold_predictions LIMIT 1`,
  upcomingPredictions: (season: number) => `
    WITH unplayed AS (
      SELECT
        p.round,
        p.date,
        p.kickoff_time_utc,
        p.kickoff_time_local,
        p.kickoff_tz_offset,
        p.home_team,
        p.away_team,
        p.venue,
        p.predicted_winner,
        ROUND(p.home_win_probability, 3)              AS home_win_probability,
        ROUND(1.0 - p.home_win_probability, 3)        AS away_win_probability,
        ROUND(p.predicted_margin, 1)                  AS predicted_margin,
        p.home_elo,
        p.away_elo,
        p.elo_diff,
        CASE
          WHEN p.round = 'Opening Round' THEN 0
          WHEN p.round LIKE 'Round %'    THEN CAST(SUBSTR(p.round, 7) AS INT)
          ELSE 999
        END                                           AS round_order
      FROM dev_afl.afl_tipping.gold_predictions p
      WHERE p.season = ${season}
        AND NOT EXISTS (
          SELECT 1
          FROM   dev_afl.afl_tipping.silver_matches m
          WHERE  m.season    = p.season
            AND  m.date      = p.date
            AND  m.home_team = p.home_team
            AND  m.away_team = p.away_team
        )
    ),
    SELECT
      u.round,
      u.date,
      u.kickoff_time_utc,
      u.kickoff_time_local,
      u.kickoff_tz_offset,
      CONCAT(DATE_FORMAT(u.kickoff_time_utc, "yyyy-MM-dd'T'HH:mm:ss"), 'Z') AS kickoff_time_utc_iso,
      u.home_team,
      u.away_team,
      u.venue,
      u.predicted_winner,
      u.home_win_probability,
      u.away_win_probability,
      u.predicted_margin,
      u.home_elo,
      u.away_elo,
      u.elo_diff
    FROM unplayed u
    ORDER BY
      u.round_order,
      u.date,
      u.kickoff_time_utc NULLS LAST,
      u.home_team
  `,
  ladderPreseason: (season: number) => `
    WITH all_games AS (
      SELECT
        home_team AS team,
        CASE WHEN predicted_margin > 0 THEN 1 ELSE 0 END AS won,
        CASE WHEN predicted_margin < 0 THEN 1 ELSE 0 END AS lost,
        CASE WHEN predicted_margin = 0 THEN 1 ELSE 0 END AS drew,
        predicted_margin AS team_margin
      FROM dev_afl.afl_tipping.predictions_preseason_snapshot
      WHERE season = ${season}
      UNION ALL
      SELECT
        away_team AS team,
        CASE WHEN predicted_margin < 0 THEN 1 ELSE 0 END AS won,
        CASE WHEN predicted_margin > 0 THEN 1 ELSE 0 END AS lost,
        CASE WHEN predicted_margin = 0 THEN 1 ELSE 0 END AS drew,
        -predicted_margin AS team_margin
      FROM dev_afl.afl_tipping.predictions_preseason_snapshot
      WHERE season = ${season}
    ),
    team_stats AS (
      SELECT
        team,
        CAST(SUM(won) AS INT) AS wins,
        CAST(SUM(lost) AS INT) AS losses,
        CAST(SUM(drew) AS INT) AS draws,
        CAST(SUM(won) * 4 + SUM(drew) * 2 AS INT) AS points,
        ROUND(
          (85.0 * COUNT(*) + SUM(team_margin) / 2.0) * 100.0
            / NULLIF(85.0 * COUNT(*) - SUM(team_margin) / 2.0, 0),
          1
        ) AS percentage
      FROM all_games
      GROUP BY team
    )
    SELECT
      CAST(RANK() OVER (ORDER BY points DESC, percentage DESC) AS INT) AS position,
      team,
      points,
      wins,
      losses,
      draws,
      percentage
    FROM team_stats
    ORDER BY position
  `,
  ladderCurrent: (season: number) => `
    WITH actual_results AS (
      SELECT
        home_team AS team,
        CASE WHEN margin > 0 THEN 1 ELSE 0 END AS won,
        CASE WHEN margin < 0 THEN 1 ELSE 0 END AS lost,
        CASE WHEN margin = 0 THEN 1 ELSE 0 END AS drew,
        CAST(home_score AS DOUBLE) AS pts_for,
        CAST(away_score AS DOUBLE) AS pts_against
      FROM dev_afl.afl_tipping.silver_matches
      WHERE season = ${season}
      UNION ALL
      SELECT
        away_team AS team,
        CASE WHEN margin < 0 THEN 1 ELSE 0 END AS won,
        CASE WHEN margin > 0 THEN 1 ELSE 0 END AS lost,
        CASE WHEN margin = 0 THEN 1 ELSE 0 END AS drew,
        CAST(away_score AS DOUBLE) AS pts_for,
        CAST(home_score AS DOUBLE) AS pts_against
      FROM dev_afl.afl_tipping.silver_matches
      WHERE season = ${season}
    ),
    actual_totals AS (
      SELECT
        team,
        CAST(SUM(won) AS INT) AS wins,
        CAST(SUM(lost) AS INT) AS losses,
        CAST(SUM(drew) AS INT) AS draws,
        CAST(SUM(won) * 4 + SUM(drew) * 2 AS INT) AS points,
        ROUND(SUM(pts_for) * 100.0 / NULLIF(SUM(pts_against), 0), 1) AS percentage,
        SUM(pts_for) AS total_pts_for,
        SUM(pts_against) AS total_pts_against
      FROM actual_results
      GROUP BY team
    ),
    predicted_future AS (
      SELECT
        p.home_team AS team,
        CASE WHEN p.predicted_margin > 0 THEN 1 ELSE 0 END AS predicted_win,
        CASE WHEN p.predicted_margin = 0 THEN 1 ELSE 0 END AS predicted_draw,
        p.predicted_margin AS team_margin
      FROM dev_afl.afl_tipping.gold_predictions p
      WHERE p.season = ${season}
        AND NOT EXISTS (
          SELECT 1
          FROM dev_afl.afl_tipping.silver_matches m
          WHERE m.season = p.season
            AND m.date = p.date
            AND m.home_team = p.home_team
            AND m.away_team = p.away_team
        )
      UNION ALL
      SELECT
        p.away_team AS team,
        CASE WHEN p.predicted_margin < 0 THEN 1 ELSE 0 END AS predicted_win,
        CASE WHEN p.predicted_margin = 0 THEN 1 ELSE 0 END AS predicted_draw,
        -p.predicted_margin AS team_margin
      FROM dev_afl.afl_tipping.gold_predictions p
      WHERE p.season = ${season}
        AND NOT EXISTS (
          SELECT 1
          FROM dev_afl.afl_tipping.silver_matches m
          WHERE m.season = p.season
            AND m.date = p.date
            AND m.home_team = p.home_team
            AND m.away_team = p.away_team
        )
    ),
    predicted_future_totals AS (
      SELECT
        team,
        CAST(SUM(predicted_win) AS INT) AS predicted_future_wins,
        CAST(SUM(predicted_draw) AS INT) AS predicted_future_draws,
        CAST(SUM(predicted_win) * 4 + SUM(predicted_draw) * 2 AS INT) AS predicted_future_points,
        SUM(85.0 + team_margin / 2.0) AS projected_pts_for,
        SUM(85.0 - team_margin / 2.0) AS projected_pts_against
      FROM predicted_future
      GROUP BY team
    ),
    all_teams AS (
      SELECT DISTINCT home_team AS team
      FROM dev_afl.afl_tipping.gold_predictions
      WHERE season = ${season}
      UNION
      SELECT DISTINCT away_team
      FROM dev_afl.afl_tipping.gold_predictions
      WHERE season = ${season}
    ),
    combined AS (
      SELECT
        t.team,
        COALESCE(a.wins, 0) AS wins,
        COALESCE(a.losses, 0) AS losses,
        COALESCE(a.draws, 0) AS draws,
        COALESCE(a.points, 0) AS points,
        a.percentage,
        COALESCE(a.wins, 0) + COALESCE(pf.predicted_future_wins, 0) AS predicted_final_wins,
        COALESCE(a.points, 0) + COALESCE(pf.predicted_future_points, 0) AS predicted_final_points,
        ROUND(
          (COALESCE(a.total_pts_for, 0) + COALESCE(pf.projected_pts_for, 0)) * 100.0
            / NULLIF(COALESCE(a.total_pts_against, 0) + COALESCE(pf.projected_pts_against, 0), 0),
          1
        ) AS projected_pct
      FROM all_teams t
      LEFT JOIN actual_totals a ON a.team = t.team
      LEFT JOIN predicted_future_totals pf ON pf.team = t.team
    )
    SELECT
      CAST(RANK() OVER (ORDER BY points DESC, COALESCE(percentage, 0) DESC) AS INT) AS position,
      team,
      points,
      wins,
      losses,
      draws,
      percentage,
      predicted_final_wins,
      predicted_final_points,
      CAST(RANK() OVER (ORDER BY predicted_final_points DESC, projected_pct DESC) AS INT) AS predicted_final_position
    FROM combined
    ORDER BY position
  `,
  accuracy: (season: number) => `
    WITH completed AS (
      SELECT
        p.round                                                         AS round_label,
        CASE
          WHEN p.round = 'Opening Round'     THEN 0
          WHEN p.round LIKE 'Round %'        THEN CAST(SUBSTR(p.round, 7) AS INT)
          ELSE 99
        END                                                             AS round_order,
        CAST(p.predicted_winner = m.winner AS INT)                      AS correct,
        ABS(p.predicted_margin - m.margin)                             AS margin_error,
        CASE
          WHEN m.winner = m.home_team
            THEN LOG(2, GREATEST(p.home_win_probability,       1e-6))
          WHEN m.winner = m.away_team
            THEN LOG(2, GREATEST(1.0 - p.home_win_probability, 1e-6))
          ELSE 0.0
        END                                                             AS bits_contribution,
        CAST(p.date AS STRING)                                          AS game_date,
        p.kickoff_time_utc,
        p.home_team,
        p.away_team,
        p.predicted_winner,
        m.winner                                                        AS actual_winner
      FROM dev_afl.afl_tipping.gold_predictions   p
      JOIN dev_afl.afl_tipping.silver_matches m
        ON  p.season    = m.season
        AND p.date      = m.date
        AND p.home_team = m.home_team
        AND p.away_team = m.away_team
      WHERE p.season = ${season}
    ),
    by_round AS (
      SELECT
        round_order,
        round_label,
        COUNT(*)                                              AS tips,
        CAST(SUM(correct) AS INT)                            AS correct,
        ROUND(SUM(correct) * 100.0 / COUNT(*), 1)            AS accuracy_pct,
        ROUND(AVG(margin_error), 1)                          AS mae,
        COLLECT_LIST(
          STRUCT(
            game_date       AS date,
            kickoff_time_utc,
            home_team,
            away_team,
            predicted_winner,
            actual_winner,
            CAST(correct AS BOOLEAN) AS correct
          )
        )                                                     AS games
      FROM completed
      GROUP BY round_order, round_label
    ),
    overall AS (
      SELECT
        COUNT(*)                                              AS total_tips,
        CAST(SUM(correct) AS INT)                            AS tips_correct,
        ROUND(SUM(correct) * 100.0 / NULLIF(COUNT(*), 0), 1) AS accuracy_pct,
        ROUND(AVG(margin_error), 1)                          AS mae,
        ROUND(AVG(bits_contribution), 3)                     AS bits
      FROM completed
    )
    SELECT
      ${season}                                                           AS season,
      (SELECT round_label FROM by_round ORDER BY round_order DESC LIMIT 1)
                                                                          AS as_at_round,
      o.total_tips,
      o.tips_correct,
      o.accuracy_pct,
      o.mae,
      o.bits,
      TO_JSON(
        COLLECT_LIST(
          STRUCT(
            r.round_order  AS round,
            r.round_label,
            r.tips,
            r.correct,
            r.accuracy_pct,
            r.mae,
            r.games
          )
        )
      )                                                                   AS by_round_json
    FROM       overall o
    CROSS JOIN (SELECT * FROM by_round ORDER BY round_order) r
    GROUP BY   o.total_tips, o.tips_correct, o.accuracy_pct, o.mae, o.bits
    LIMIT 1
  `,
};

async function executeStatement(sql: string) {
  const submit = await fetch(`${resolvedHost}/api/2.0/sql/statements`, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ statement: sql, warehouse_id: resolvedWarehouseId, wait_timeout: "10s" }),
  });

  if (!submit.ok) {
    throw new Error(`Statement submission failed: ${submit.status} ${submit.statusText}`);
  }

  const submitted = statementResponseSchema.parse(await submit.json());
  let state = submitted.status.state;
  let latest = submitted;

  while (state === "PENDING" || state === "RUNNING") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const poll = await fetch(`${resolvedHost}/api/2.0/sql/statements/${submitted.statement_id}`, { headers: baseHeaders });
    if (!poll.ok) {
      throw new Error(`Statement polling failed: ${poll.status} ${poll.statusText}`);
    }
    latest = statementResponseSchema.parse(await poll.json());
    state = latest.status.state;
  }

  if (state !== "SUCCEEDED") {
    throw new Error(`Statement failed with state=${state}`);
  }

  const columns = latest.manifest?.schema?.columns?.map((column) => column.name) ?? [];
  const rows = latest.result?.data_array ?? [];

  return rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (let index = 0; index < columns.length; index += 1) {
      mapped[columns[index]] = row[index];
    }
    return mapped;
  });
}

function parseAccuracyRow(row: Record<string, unknown>) {
  let byRound: unknown = [];
  if (typeof row.by_round_json === "string") {
    byRound = JSON.parse(row.by_round_json);
  } else if (Array.isArray(row.by_round_json)) {
    byRound = row.by_round_json;
  }

  // Map team keys within each round's games array
  if (Array.isArray(byRound)) {
    byRound = byRound.map((roundObj: unknown) => {
      if (typeof roundObj !== "object" || roundObj === null) return roundObj;
      const r = roundObj as Record<string, unknown>;
      if (!Array.isArray(r.games)) return r;
      return {
        ...r,
        games: r.games.map((game: unknown) => {
          if (typeof game !== "object" || game === null) return game;
          const g = game as Record<string, unknown>;
          return {
            ...g,
            home_team: mapTeamKey(g.home_team, "home_team"),
            away_team: mapTeamKey(g.away_team, "away_team"),
            predicted_winner: mapTeamKey(g.predicted_winner, "predicted_winner"),
            actual_winner: mapTeamKey(g.actual_winner, "actual_winner"),
          };
        }),
      };
    });
  }

  return accuracySchema.parse({
    season: row.season,
    as_at_round: row.as_at_round,
    total_tips: row.total_tips,
    tips_correct: row.tips_correct,
    accuracy_pct: row.accuracy_pct,
    mae: row.mae,
    bits: row.bits,
    by_round: byRound,
  });
}

async function main() {
  const seasonRows = await executeStatement(queries.currentSeason);
  const targetSeason = Number(seasonRows[0]?.season);
  if (!Number.isFinite(targetSeason)) {
    throw new Error("Could not determine current season from gold_predictions");
  }

  const [rawUpcoming, rawLadderPreseason, rawLadderCurrent, accuracyRows] = await Promise.all([
    executeStatement(queries.upcomingPredictions(targetSeason)),
    executeStatement(queries.ladderPreseason(targetSeason)),
    executeStatement(queries.ladderCurrent(targetSeason)),
    executeStatement(queries.accuracy(targetSeason)),
  ]);

  const normalizedUpcoming = rawUpcoming.map((row) => ({
    ...row,
    home_team: mapTeamKey(row.home_team, "home_team"),
    away_team: mapTeamKey(row.away_team, "away_team"),
    predicted_winner: mapTeamKey(row.predicted_winner, "predicted_winner"),
  }));

  const upcomingPredictions = z.array(upcomingPredictionSchema).parse(normalizedUpcoming);

  const normalizedLadderPreseason = rawLadderPreseason.map((row) => ({
    ...row,
    team: mapTeamKey(row.team, "team"),
  }));

  const normalizedLadderCurrent = rawLadderCurrent.map((row) => ({
    ...row,
    team: mapTeamKey(row.team, "team"),
  }));

  const ladderPreseason = z
    .array(ladderEntrySchema)
    .parse(normalizedLadderPreseason)
    .map((row) => ({ ...row, predicted_final_wins: undefined, predicted_final_position: undefined }));
  const ladderCurrent = z.array(ladderEntrySchema).parse(normalizedLadderCurrent);

  const accuracy =
    accuracyRows.length > 0
      ? parseAccuracyRow(accuracyRows[0])
      : accuracySchema.parse({
          season: targetSeason,
          as_at_round: "Pre-season",
          total_tips: 0,
          tips_correct: 0,
          accuracy_pct: 0,
          mae: 0,
          bits: 0,
          by_round: [],
        });

  if (accuracyRows.length === 0) {
    console.warn("Accuracy query returned no rows. Writing pre-season default accuracy payload.");
  }

  const outputDir = path.join(process.cwd(), "src/data");
  await mkdir(outputDir, { recursive: true });

  await Promise.all([
    writeFile(path.join(outputDir, "upcoming-predictions.json"), JSON.stringify(upcomingPredictions, null, 2)),
    writeFile(path.join(outputDir, "ladder-preseason.json"), JSON.stringify(ladderPreseason, null, 2)),
    writeFile(path.join(outputDir, "ladder-current.json"), JSON.stringify(ladderCurrent, null, 2)),
    writeFile(path.join(outputDir, "accuracy.json"), JSON.stringify(accuracy, null, 2)),
  ]);

  console.log("Databricks data fetched and validated successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
