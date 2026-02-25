# Wayne TODO: Deploy AFL Model Site to Firebase Hosting (GCP)

## 1. Create and configure Firebase project
- [ ] Create a Firebase project in Google Cloud/Firebase console.
- [ ] Enable Firebase Hosting for the project.
- [ ] Decide whether to use default Firebase domain only, or connect a custom domain.

## 2. Prepare repository for Firebase deploy
- [x] `firebase.json` is configured with `public: out`.
- [x] GitHub Actions workflow deploys to Firebase Hosting.
- [ ] Confirm workflow file is present: `.github/workflows/deploy.yml`.

## 3. Create service account credentials for CI
- [ ] Run helper script (recommended):
  ```bash
  PROJECT_ID=<your-project-id> SA_NAME=github-actions-firebase-deploy CREATE_KEY=true ./infra/firebase-iam.sh
  ```
- [ ] In Google Cloud IAM, create a service account for GitHub Actions deploy.
- [ ] Grant least-privilege baseline roles on the project:
  - `roles/firebasehosting.admin`
  - `roles/serviceusage.apiKeysViewer`
- [ ] Create a JSON key for that service account.
- [ ] Keep the raw JSON contents for GitHub secret `FIREBASE_SERVICE_ACCOUNT`.

## 4. Set GitHub Actions secrets
Repository `Settings -> Secrets and variables -> Actions`:
- [ ] `FIREBASE_PROJECT_ID` = `<your-firebase-project-id>`
- [ ] `FIREBASE_SERVICE_ACCOUNT` = `<full JSON key contents>`
- [ ] `DATABRICKS_HOST`
- [ ] `DATABRICKS_TOKEN`
- [ ] `DATABRICKS_HTTP_PATH`

## 5. Local sanity check before first deploy
- [ ] Run:
  ```bash
  npm ci
  npm run typecheck
  npm run test
  npm run build
  ```
- [ ] Confirm `out/` exists after build.

## 6. Deploy
- [ ] Push to `main` (auto-triggers deploy workflow), or run manually from GitHub Actions.
- [ ] In workflow logs, confirm these steps pass:
  - `Fetch data from Databricks`
  - `Build static export`
  - `Deploy to Firebase Hosting`

## 7. Verify production
- [ ] Open Hosting URL (for example `https://<project-id>.web.app`).
- [ ] Verify key routes:
  - `/`
  - `/tips`
  - `/ladder`
  - `/accuracy`
  - `/about`
- [ ] If using a custom domain, connect domain in Firebase Hosting and verify SSL is active.

## 8. If deploy fails, debug quickly
- [ ] Check failing step in GitHub Actions logs.
- [ ] Re-check secrets formatting:
  - `FIREBASE_SERVICE_ACCOUNT` must be valid JSON.
  - `FIREBASE_PROJECT_ID` must exactly match Firebase project ID.
- [ ] Confirm service account has Hosting deploy permission.
- [ ] If data step fails, verify Databricks secrets and warehouse path.

## 9. Optional hardening
- [ ] Add GitHub branch protection for `main`.
- [ ] Add billing budget + alert in GCP (even for low traffic).
- [ ] Add uptime checks for `web.app` and custom domain.
