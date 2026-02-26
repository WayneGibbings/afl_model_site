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

const predictionSchema = z.object({
  season: z.coerce.number().int(),
  round: z.coerce.number().int(),
  round_label: z.string().min(1),
  date: z.string().datetime({ offset: true }),
  venue: z.string().min(1),
  home_team: teamKeySchema,
  away_team: teamKeySchema,
  predicted_winner: teamKeySchema,
  predicted_margin: z.coerce.number().nonnegative(),
  win_probability: z.coerce.number().min(0).max(1),
  actual_winner: teamKeySchema.nullable(),
  actual_margin: z.coerce.number().nullable(),
  tip_correct: z.boolean().nullable(),
  margin_error: z.coerce.number().nullable(),
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

const accuracyRoundSchema = z.object({
  round: z.coerce.number().int().nonnegative(),
  round_label: z.string().min(1),
  tips: z.coerce.number().int().nonnegative(),
  correct: z.coerce.number().int().nonnegative(),
  accuracy_pct: z.coerce.number(),
  mae: z.coerce.number(),
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

function normalisePredictionDate(value: unknown): string {
  if (typeof value !== "string") {
    return String(value ?? "");
  }

  const trimmed = value.trim();

  // Convert "YYYY-MM-DD HH:mm:ss(.sss)" to ISO form.
  const withT = trimmed.includes(" ") ? trimmed.replace(" ", "T") : trimmed;

  // Normalise compact offsets like +1000 -> +10:00.
  if (/[+-]\d{4}$/.test(withT)) {
    return withT.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  }

  // Normalise short offsets like +10 -> +10:00.
  if (/[+-]\d{2}$/.test(withT)) {
    return `${withT}:00`;
  }

  // If no timezone is present, treat Databricks timestamp as UTC.
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(withT);
  return hasTimezone ? withT : `${withT}Z`;
}

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
  predictions: `
    WITH gp_base AS (
      SELECT
        season,
        round AS round_label_raw,
        date,
        venue,
        home_team,
        away_team,
        predicted_winner,
        predicted_margin,
        home_win_probability
      FROM dev_afl.afl_tipping.gold_predictions
    ),
    round_order AS (
      SELECT
        season,
        round_label_raw,
        MIN(date) AS first_round_date
      FROM gp_base
      GROUP BY season, round_label_raw
    ),
    round_map AS (
      SELECT
        season,
        round_label_raw,
        DENSE_RANK() OVER (
          PARTITION BY season
          ORDER BY first_round_date ASC, round_label_raw ASC
        ) AS round
      FROM round_order
    ),
    gp AS (
      SELECT
        b.season,
        m.round,
        b.round_label_raw AS round_label,
        b.date,
        b.venue,
        b.home_team,
        b.away_team,
        b.predicted_winner,
        b.predicted_margin,
        b.home_win_probability
      FROM gp_base b
      JOIN round_map m
        ON b.season = m.season
       AND b.round_label_raw = m.round_label_raw
    ),
    sm AS (
      SELECT
        season,
        date,
        home_team,
        away_team,
        winner,
        abs_margin,
        ROW_NUMBER() OVER (
          PARTITION BY season, home_team, away_team, date
          ORDER BY date DESC
        ) AS rn
      FROM dev_afl.afl_tipping.silver_matches
    )
    SELECT
      gp.season,
      gp.round,
      gp.round_label,
      gp.date,
      gp.venue,
      gp.home_team,
      gp.away_team,
      gp.predicted_winner,
      CAST(gp.predicted_margin AS DOUBLE) AS predicted_margin,
      CASE
        WHEN gp.predicted_winner = gp.home_team THEN CAST(gp.home_win_probability AS DOUBLE)
        WHEN gp.predicted_winner = gp.away_team THEN 1.0 - CAST(gp.home_win_probability AS DOUBLE)
        ELSE NULL
      END AS win_probability,
      sm.winner AS actual_winner,
      CAST(sm.abs_margin AS DOUBLE) AS actual_margin,
      CASE
        WHEN sm.winner IS NULL THEN NULL
        ELSE gp.predicted_winner = sm.winner
      END AS tip_correct,
      CASE
        WHEN sm.winner IS NULL OR sm.abs_margin IS NULL THEN NULL
        ELSE ABS(CAST(gp.predicted_margin AS DOUBLE) - CAST(sm.abs_margin AS DOUBLE))
      END AS margin_error
    FROM gp
    LEFT JOIN sm
      ON gp.season = sm.season
     AND gp.home_team = sm.home_team
     AND gp.away_team = sm.away_team
     AND gp.date = sm.date
     AND sm.rn = 1
    ORDER BY gp.season, gp.round, gp.date ASC
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
        p.round AS round_label,
        p.date AS date,
        CAST(p.predicted_winner = m.winner AS INT) AS correct,
        ABS(p.predicted_margin - m.margin) AS margin_error,
        CASE
          WHEN m.winner = m.home_team THEN LOG(2, GREATEST(p.home_win_probability, 1e-6))
          WHEN m.winner = m.away_team THEN LOG(2, GREATEST(1.0 - p.home_win_probability, 1e-6))
          ELSE 0.0
        END AS bits_contribution
      FROM dev_afl.afl_tipping.gold_predictions p
      JOIN dev_afl.afl_tipping.silver_matches m
        ON p.season = m.season
       AND p.date = m.date
       AND p.home_team = m.home_team
       AND p.away_team = m.away_team
      WHERE p.season = ${season}
    ),
    by_round_base AS (
      SELECT
        round_label,
        MIN(date) AS first_round_date,
        COUNT(*) AS tips,
        CAST(SUM(correct) AS INT) AS correct,
        ROUND(SUM(correct) * 100.0 / COUNT(*), 1) AS accuracy_pct,
        ROUND(AVG(margin_error), 1) AS mae
      FROM completed
      GROUP BY round_label
    ),
    by_round AS (
      SELECT
        DENSE_RANK() OVER (ORDER BY first_round_date ASC, round_label ASC) AS round_order,
        round_label,
        tips,
        correct,
        accuracy_pct,
        mae
      FROM by_round_base
    ),
    overall AS (
      SELECT
        COUNT(*) AS total_tips,
        CAST(SUM(correct) AS INT) AS tips_correct,
        ROUND(SUM(correct) * 100.0 / NULLIF(COUNT(*), 0), 1) AS accuracy_pct,
        ROUND(AVG(margin_error), 1) AS mae,
        ROUND(AVG(bits_contribution), 3) AS bits
      FROM completed
    )
    SELECT
      ${season} AS season,
      (SELECT round_label FROM by_round ORDER BY round_order DESC LIMIT 1) AS as_at_round,
      o.total_tips,
      o.tips_correct,
      o.accuracy_pct,
      o.mae,
      o.bits,
      TO_JSON(
        COLLECT_LIST(
          STRUCT(
            r.round_order AS round,
            r.round_label,
            r.tips,
            r.correct,
            r.accuracy_pct,
            r.mae
          )
        )
      ) AS by_round_json
    FROM overall o
    CROSS JOIN (SELECT * FROM by_round ORDER BY round_order) r
    GROUP BY o.total_tips, o.tips_correct, o.accuracy_pct, o.mae, o.bits
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
  const rawPredictions = await executeStatement(queries.predictions);
  const seasons = rawPredictions
    .map((row) => Number(row.season))
    .filter((season) => Number.isFinite(season));

  if (seasons.length === 0) {
    throw new Error("Predictions query returned no valid season values");
  }

  const targetSeason = Math.max(...seasons);

  const rawLadderPreseason = await executeStatement(queries.ladderPreseason(targetSeason));
  const rawLadderCurrent = await executeStatement(queries.ladderCurrent(targetSeason));
  const accuracyRows = await executeStatement(queries.accuracy(targetSeason));

  const normalizedPredictions = rawPredictions.map((row) => ({
    ...row,
    date: normalisePredictionDate(row.date),
    home_team: mapTeamKey(row.home_team, "home_team"),
    away_team: mapTeamKey(row.away_team, "away_team"),
    predicted_winner: mapTeamKey(row.predicted_winner, "predicted_winner"),
    actual_winner: mapTeamKey(row.actual_winner, "actual_winner", true),
  }));

  const predictions = z.array(predictionSchema).parse(normalizedPredictions);

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
    writeFile(path.join(outputDir, "predictions.json"), JSON.stringify(predictions, null, 2)),
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
