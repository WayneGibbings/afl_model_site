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
  as_at_round: z.coerce.number().int().nonnegative(),
  total_tips: z.coerce.number().int().nonnegative(),
  tips_correct: z.coerce.number().int().nonnegative(),
  accuracy_pct: z.coerce.number(),
  mae: z.coerce.number(),
  bits: z.coerce.number(),
  by_round: z.array(accuracyRoundSchema),
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
  ladderPreseason: `SELECT team, position, wins, losses, draws, percentage FROM afl_site.ladder_preseason ORDER BY position ASC`,
  ladderCurrent: `SELECT team, position, wins, losses, draws, percentage, predicted_final_wins, predicted_final_position FROM afl_site.ladder_current ORDER BY position ASC`,
  accuracy: `SELECT season, as_at_round, total_tips, tips_correct, accuracy_pct, mae, bits, by_round_json FROM afl_site.accuracy LIMIT 1`,
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
  const rawLadderPreseason = await executeStatement(queries.ladderPreseason);
  const rawLadderCurrent = await executeStatement(queries.ladderCurrent);
  const accuracyRows = await executeStatement(queries.accuracy);

  if (accuracyRows.length === 0) {
    throw new Error("Accuracy query returned no rows");
  }

  const normalizedPredictions = rawPredictions.map((row) => ({
    ...row,
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
  const accuracy = parseAccuracyRow(accuracyRows[0]);

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
