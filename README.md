# AFL Predictions Site

Static AFL predictions website built with Next.js App Router and Tailwind.
The app loads live build data from `src/data/` when present, and falls back to committed development fixtures in `src/data-mock/`.

## Local development

```bash
npm install
npm run dev
```

### Genie chat local development

The `/chat` page calls a Firebase Function proxy at `/api/genie`.

Run both app and emulators:

```bash
# terminal 1
npm install
npm run dev

# terminal 2
npm install --prefix functions
firebase emulators:start
```

Set these env vars before running the emulator:

- `DATABRICKS_HOST`
- `DATABRICKS_TOKEN`
- `GENIE_SPACE_ID`
- `FIREBASE_PROJECT_ID` (used by `next.config.ts` dev rewrite, should match emulator project)

## Scripts

- `npm run dev` - run development server.
- `npm run build` - build static export to `out/`.
- `npm run typecheck` - run TypeScript checks.
- `npm run test` - run utility tests.
- `npm run fetch:data` - fetch Databricks data into `src/data/`.

## Required environment variables for data fetch

- `DATABRICKS_HOST`
- `DATABRICKS_TOKEN`
- `DATABRICKS_HTTP_PATH` (preferred, for example `/sql/1.0/warehouses/28dd09c7df5b6d65`)

Example host:

- `DATABRICKS_HOST=dbc-11025f47-daa6.cloud.databricks.com`

## Deployment

GitHub Actions workflow in `.github/workflows/deploy.yml` builds and deploys `out/` plus Firebase Functions.

### Firebase setup

1. Create a Firebase project and enable Hosting.
2. Add repository Actions secrets:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_SERVICE_ACCOUNT` (raw JSON service-account key with Hosting deploy permissions)
   - `DATABRICKS_HOST`
   - `DATABRICKS_TOKEN`
   - `DATABRICKS_HTTP_PATH`
   - `GENIE_SPACE_ID`
3. Push to `main` or run the workflow manually.

### Firebase IAM (least-privilege baseline)

For a manually created deploy service account, start with:
- `roles/firebasehosting.admin`
- `roles/serviceusage.apiKeysViewer`

`roles/serviceusage.apiKeysViewer` is required by Firebase CLI-based deploy flows.

Because this repo now deploys Functions and syncs function secrets, also grant:
- `roles/cloudfunctions.admin`
- `roles/run.admin`
- `roles/secretmanager.admin`
- `roles/iam.serviceAccountUser`

Depending on project/org policy, Artifact Registry permissions may also be required for function builds.

Example:

```bash
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:<SA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/firebasehosting.admin"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:<SA_NAME>@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/serviceusage.apiKeysViewer"
```

Or use the helper script in this repo:

```bash
PROJECT_ID=<PROJECT_ID> SA_NAME=github-actions-firebase-deploy ./infra/firebase-iam.sh
```

Generate a key file in the same step:

```bash
PROJECT_ID=<PROJECT_ID> SA_NAME=github-actions-firebase-deploy CREATE_KEY=true ./infra/firebase-iam.sh
```
