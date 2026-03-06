# Databricks Site Refresh Webhook

## Goal

Replace the existing GitHub `repository_dispatch` refresh trigger with a direct call from Databricks to Firebase `siteDataRefresh`.

The Databricks side is only responsible for signaling "new site data is ready". It does not send the data payload itself. Firebase remains responsible for fetching and validating the latest snapshot from Databricks.

## Production Endpoint

- Site URL: `https://waynealytics-tips.gibbings.net/`
- Refresh webhook URL: `https://waynealytics-tips.gibbings.net/api/site-data/refresh`

## Databricks Secret Storage

Store the site refresh token in a Databricks secret scope.

- Scope: `afl-site`
- Key: `site-refresh-token`

The Databricks PAT used by Firebase remains separate. Do not reuse `DATABRICKS_TOKEN` for this webhook.

## Trigger Point

Invoke the refresh webhook only after the pipeline has successfully completed the steps that update the site-facing data source tables:

- predictions ready in `gold_predictions`
- latest results ingested into `silver_matches`
- ladder-related tables and snapshots consistent with those updates

The webhook call must happen after the final successful commit/write stage, not before.

## Authentication Contract

Databricks sends the secret in the request header:

```http
x-site-refresh-token: <value from dbutils.secrets.get("afl-site", "site-refresh-token")>
```

No browser client should ever know this token. It is only used in server-side Databricks code and server-side Firebase code.

## Request Contract

- Method: `POST`
- URL: `https://waynealytics-tips.gibbings.net/api/site-data/refresh`
- Headers:
  - `x-site-refresh-token`
  - `Content-Type: application/json`
- Body:
  - optional metadata only
  - recommended shape:

```json
{
  "trigger": "databricks-pipeline",
  "pipeline_name": "<pipeline-or-job-name>",
  "run_id": "<databricks-run-id>",
  "completed_at": "2026-03-06T12:00:00Z"
}
```

Firebase does not need this body to refresh data, but it is useful for logging and debugging.

## Databricks Implementation Pattern

Use a small helper at the end of the job or notebook:

```python
import requests


REFRESH_URL = "https://waynealytics-tips.gibbings.net/api/site-data/refresh"


def trigger_site_refresh() -> None:
    refresh_token = dbutils.secrets.get("afl-site", "site-refresh-token")

    response = requests.post(
        REFRESH_URL,
        headers={
            "x-site-refresh-token": refresh_token,
            "Content-Type": "application/json",
        },
        json={
            "trigger": "databricks-pipeline",
            "pipeline_name": spark.conf.get("spark.databricks.job.name", "unknown"),
            "run_id": spark.conf.get("spark.databricks.job.runId", "unknown"),
        },
        timeout=180,
    )
    response.raise_for_status()

    payload = response.json()
    print(
        f"Site refresh acknowledged. "
        f"snapshotVersion={payload.get('snapshotVersion')} "
        f"updated={payload.get('updated')}"
    )
```

## Success and Failure Semantics

- Treat HTTP `200` as success.
- Firebase may return:
  - `updated: true` when a new snapshot was written
  - `updated: false` when the normalized payload hash matches the latest Firestore snapshot
- Treat network failures, `401`, and `5xx` responses as failures that should fail the Databricks task or at least mark the run as needing attention.
- Do not suppress errors silently.

## Retry Policy

The Databricks caller should implement bounded retry on transient failure:

- Retry on:
  - connection errors
  - timeouts
  - HTTP `429`
  - HTTP `5xx`
- Do not retry on:
  - HTTP `401`
  - HTTP `403`
  - HTTP `404`

Recommended retry policy:

- max attempts: `3`
- backoff: `5s`, then `15s`, then `30s`

Firebase refresh is idempotent because it hashes the normalized payload and skips duplicate writes.

## Logging

Databricks should log:

- refresh URL hostname only, not the token
- Databricks run id / job name
- response status code
- returned `snapshotVersion`
- returned `updated` flag

Never log:

- `x-site-refresh-token`
- secret contents
- full request headers

## Rollout Sequence

1. Store `SITE_REFRESH_TOKEN` in GitHub Actions secrets.
2. Deploy Firebase so `siteDataRefresh` and `siteDataLatest` exist and the Functions secret is synced.
3. Store the same token in Databricks secret scope `afl-site/site-refresh-token`.
4. Add the webhook call to the end of the Databricks pipeline/job.
5. Remove the old GitHub `repository_dispatch` call from the Databricks pipeline after the new refresh path is verified.

## Scheduler Fallback

One Cloud Scheduler job remains as a repair path.

- Interval: every 15 minutes
- Action: call the same `POST /api/site-data/refresh` endpoint with the same shared secret
- Expected behavior: no-op when the snapshot hash is unchanged

The Databricks pipeline remains the primary refresh trigger. Scheduler is only a fallback for missed webhook executions.
