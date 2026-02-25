#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_ID=my-project SA_NAME=github-actions-firebase-deploy ./infra/firebase-iam.sh
#
# Optional:
#   SA_DISPLAY_NAME="GitHub Actions Firebase Deploy"
#   CREATE_KEY=true
#   KEY_OUT=./firebase-deploy-sa-key.json
#
# Requirements:
#   - gcloud CLI installed and authenticated
#   - Access to modify IAM policy on the target project

PROJECT_ID="${PROJECT_ID:-}"
SA_NAME="${SA_NAME:-}"
SA_DISPLAY_NAME="${SA_DISPLAY_NAME:-GitHub Actions Firebase Deploy}"
CREATE_KEY="${CREATE_KEY:-false}"
KEY_OUT="${KEY_OUT:-./firebase-deploy-sa-key.json}"

if [[ -z "${PROJECT_ID}" || -z "${SA_NAME}" ]]; then
  echo "Error: PROJECT_ID and SA_NAME are required."
  echo "Example:"
  echo "  PROJECT_ID=my-project SA_NAME=github-actions-firebase-deploy ./infra/firebase-iam.sh"
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: gcloud CLI is not installed or not in PATH."
  exit 1
fi

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Setting gcloud project to ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "Ensuring required APIs are enabled..."
gcloud services enable \
  iam.googleapis.com \
  serviceusage.googleapis.com \
  firebasehosting.googleapis.com \
  firebase.googleapis.com

echo "Checking if service account exists: ${SA_EMAIL}"
if gcloud iam service-accounts describe "${SA_EMAIL}" >/dev/null 2>&1; then
  echo "Service account already exists."
else
  echo "Creating service account..."
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="${SA_DISPLAY_NAME}"
fi

echo "Binding IAM roles..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/firebasehosting.admin" >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/serviceusage.apiKeysViewer" >/dev/null

echo "IAM roles applied to ${SA_EMAIL}:"
echo "  - roles/firebasehosting.admin"
echo "  - roles/serviceusage.apiKeysViewer"

if [[ "${CREATE_KEY}" == "true" ]]; then
  echo "Creating service account key at ${KEY_OUT}..."
  gcloud iam service-accounts keys create "${KEY_OUT}" \
    --iam-account="${SA_EMAIL}"
  echo "Key file created."
  echo "Use the full JSON content as GitHub secret: FIREBASE_SERVICE_ACCOUNT"
else
  echo "Skipping key creation (CREATE_KEY=${CREATE_KEY})."
  echo "If needed, run again with CREATE_KEY=true."
fi
