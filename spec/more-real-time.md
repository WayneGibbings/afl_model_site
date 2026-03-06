# Live Snapshot Architecture for AFL Site

## Summary

Replace the current "rebuild on every data change" model with a static-shell plus live-snapshot model:

- Keep the site statically exported for page HTML, CSS, and JS.
- Move only volatile data (`upcoming-predictions`, `accuracy`, `ladder-current`, `ladder-preseason`) to a cached runtime snapshot.
- Refresh that snapshot in the background when the Databricks pipeline finishes.
- Let pages render immediately from embedded build data, then silently swap to the newer snapshot on the client if one exists.

This keeps Databricks off the user request path and makes data refreshes independent from GitHub deploys.

## Site-Side Overview

1. Databricks pipeline becomes the source of truth for "new site data is ready".
2. At pipeline completion, Databricks calls `POST /api/site-data/refresh`.
3. Firebase `siteDataRefresh` authenticates the caller using `x-site-refresh-token`.
4. Firebase fetches the four site datasets from Databricks, validates and normalizes them, computes `snapshotVersion`, and writes the latest snapshot to Firestore.
5. Static pages render from build-time `site-snapshot.json`.
6. On client mount, pages fetch `/api/site-data/latest`.
7. If `snapshotVersion` differs from the embedded bootstrap version, the page swaps to the fresher snapshot without a full reload.

## Runtime Storage and Serving

Use Firestore for the cached snapshot, not Databricks and not rebuild artifacts.

- Store one document at `site_cache/latest`.
- Shape:
  - `snapshotVersion: string`
  - `generatedAt: string`
  - `season: number`
  - `upcomingPredictions`
  - `accuracy`
  - `ladderCurrent`
  - `ladderPreseason`
- `snapshotVersion` is a content hash of the normalized payload, not a timestamp.
- `GET /api/site-data/latest` reads Firestore only.
- Response headers:
  - `Cache-Control: public, max-age=60, stale-while-revalidate=300`
  - `ETag: "<snapshotVersion>"`

## Databricks Pipeline Refresh

The Databricks-side implementation details now live in a dedicated spec:

- [databricks-site-refresh-webhook.md](/home/wayne/workspace/personal/afl_model_site/spec/databricks-site-refresh-webhook.md)

That document covers:

- Databricks secret scope/key usage
- The exact webhook URL and request contract
- Retry and failure semantics
- Logging rules
- Rollout sequence for replacing `repository_dispatch`

## Build and Deploy Changes

- Rebuild/deploy only on code changes and manual deploys.
- Stop using `repository_dispatch` for ordinary data refreshes.
- Keep `scripts/fetch-data.ts` for local dev, preview builds, and bootstrap data generation during code deploys.
- Keep static export in `next.config.ts`.

## Public Interfaces / Types

### HTTP Interfaces

- `POST /api/site-data/refresh`
  - auth required via `x-site-refresh-token`
  - response:

```json
{
  "ok": true,
  "snapshotVersion": "<hash>",
  "updated": true
}
```

- `GET /api/site-data/latest`
  - public
  - response: `SiteSnapshot`
  - supports `ETag` / `If-None-Match`

### Snapshot Type

- `snapshotVersion: string`
- `generatedAt: string`
- `season: number`
- `upcomingPredictions: UpcomingPrediction[]`
- `accuracy: AccuracyData`
- `ladderCurrent: LadderEntry[]`
- `ladderPreseason: LadderEntry[]`

## Test Plan

- Firebase function tests:
  - refresh rejects missing or invalid auth
  - refresh writes snapshot only when validation passes
  - refresh skips duplicate writes when `snapshotVersion` matches
  - latest returns cached snapshot without touching Databricks
  - latest sets `Cache-Control` and `ETag`
- Frontend tests:
  - page renders immediately from bootstrap data
  - page upgrades to fresher snapshot after mount
  - page keeps bootstrap data when live fetch fails
- Databricks integration tests:
  - successful pipeline run triggers refresh webhook
  - retry happens on transient failure
  - invalid token fails fast with `401`
  - duplicate refresh returns `updated: false`

## Assumptions and Defaults

- Predictions and results are public and may be exposed through a public cached JSON endpoint.
- Target freshness is 1 to 5 minutes, not sub-second realtime.
- Firebase, not Databricks, owns the public snapshot payload.
- Databricks sends only the refresh signal, not the full snapshot data.
- `SITE_REFRESH_TOKEN` is a dedicated random secret, not reused from `DATABRICKS_TOKEN`.
