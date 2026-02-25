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
  predictions: `SELECT season, round, round_label, date, venue, home_team, away_team, predicted_winner, predicted_margin, win_probability, actual_winner, actual_margin, tip_correct, margin_error FROM afl_site.predictions ORDER BY date ASC`,
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
