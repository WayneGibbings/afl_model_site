import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { normaliseHost, warehouseIdFromHttpPath } from "../functions/src/databricks-utils";
import { buildSiteSnapshotPayload, createSiteSnapshot, siteSnapshotQueries } from "../functions/src/site-snapshot";

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

async function executeStatement(sql: string): Promise<Array<Record<string, unknown>>> {
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
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const poll = await fetch(`${resolvedHost}/api/2.0/sql/statements/${submitted.statement_id}`, {
      headers: baseHeaders,
    });
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

async function main() {
  const seasonRows = await executeStatement(siteSnapshotQueries.currentSeason);
  const targetSeason = Number(seasonRows[0]?.season);
  if (!Number.isFinite(targetSeason)) {
    throw new Error("Could not determine current season from gold_predictions");
  }

  const [rawUpcoming, rawLadderPreseason, rawLadderCurrent, accuracyRows] = await Promise.all([
    executeStatement(siteSnapshotQueries.upcomingPredictions(targetSeason)),
    executeStatement(siteSnapshotQueries.ladderPreseason(targetSeason)),
    executeStatement(siteSnapshotQueries.ladderCurrent(targetSeason)),
    executeStatement(siteSnapshotQueries.accuracy(targetSeason)),
  ]);

  const payload = buildSiteSnapshotPayload({
    season: targetSeason,
    rawUpcoming,
    rawLadderPreseason,
    rawLadderCurrent,
    accuracyRows,
  });

  if (accuracyRows.length === 0) {
    console.warn("Accuracy query returned no rows. Writing pre-season default accuracy payload.");
  }

  const snapshot = createSiteSnapshot(payload);
  const outputDir = path.join(process.cwd(), "src/data");
  await mkdir(outputDir, { recursive: true });

  await Promise.all([
    writeFile(path.join(outputDir, "upcoming-predictions.json"), JSON.stringify(snapshot.upcomingPredictions, null, 2)),
    writeFile(path.join(outputDir, "ladder-preseason.json"), JSON.stringify(snapshot.ladderPreseason, null, 2)),
    writeFile(path.join(outputDir, "ladder-current.json"), JSON.stringify(snapshot.ladderCurrent, null, 2)),
    writeFile(path.join(outputDir, "accuracy.json"), JSON.stringify(snapshot.accuracy, null, 2)),
    writeFile(path.join(outputDir, "site-snapshot.json"), JSON.stringify(snapshot, null, 2)),
  ]);

  console.log(`Databricks data fetched and validated successfully. Snapshot version=${snapshot.snapshotVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
