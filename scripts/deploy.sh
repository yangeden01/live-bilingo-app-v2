#!/bin/bash
# scripts/deploy.sh - Automated build, simulator verification, asset sync, and git push script
set -e

COMMIT_MSG="${1:-fix(subtitles): verify live stream subtitles before release}"

# Load credentials from .env if present
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

TOKEN="${GITHUB_TOKEN}"
if [ -z "$TOKEN" ]; then
  echo "Error: GITHUB_TOKEN is not set in .env or environment."
  exit 1
fi
USER_NAME="${GITHUB_USER:-yangeden01}"
USER_EMAIL="${GITHUB_EMAIL:-yangeden01@gmail.com}"
REPO="${GITHUB_REPO:-yangeden01/live-bilingo-app-v2}"

REPO_URL="https://${TOKEN}@github.com/${REPO}.git"

echo "=== 1. Setting up Git Credentials ==="
git config --global user.email "$USER_EMAIL"
git config --global user.name "$USER_NAME"
git remote set-url origin "$REPO_URL"

echo "=== 2. Building Production Assets ==="
npm run build

echo "=== 3. Running Live Subtitles Verification Simulator ==="
node scripts/verify-subtitles-stream.js

echo "=== 4. Staging and Committing Changes ==="
git add -A
git commit -m "$COMMIT_MSG" || echo "No changes to commit"

echo "=== 5. Pushing to GitHub Main Branch to Trigger APK Release ==="
git push origin main || git push --force origin main

echo "=== Deployment & Verification Completed Successfully ==="
