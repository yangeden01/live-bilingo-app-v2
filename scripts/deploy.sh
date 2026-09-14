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
  # Fallback to extracting from remote url if already configured
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
  if [[ "$REMOTE_URL" =~ https://([^@]+)@github.com ]]; then
    TOKEN="${BASH_REMATCH[1]}"
  fi
fi

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

if [ ! -f ".git/config" ] || [ ! -f ".git/HEAD" ]; then
  echo "Re-initializing fresh git workspace..."
  rm -rf .git
  git init -b main
  git remote add origin "$REPO_URL"
  git fetch origin main || true
elif ! git remote get-url origin > /dev/null 2>&1; then
  git remote add origin "$REPO_URL"
else
  git remote set-url origin "$REPO_URL"
fi

echo "=== 2. Building Production Assets ==="
npm run build

echo "=== 3. Running Live Subtitles Verification Simulator ==="
# Ensure backend server is accessible during verification
SERVER_PID=""
if ! curl -s http://localhost:3000/api/version > /dev/null 2>&1; then
  echo "Starting background server on port 3000 for verification gate..."
  NODE_ENV=production node dist/server.cjs &
  SERVER_PID=$!
  sleep 2
fi

node scripts/verify-subtitles-stream.js

if [ -n "$SERVER_PID" ]; then
  kill "$SERVER_PID" 2>/dev/null || true
fi

# Ensure all bundled stt-usage-cache.json files are clean with 0 test counts before packaging
node -e "
const fs = require('fs');
const clean = {
  groqRequestsHistory: [],
  groqRecentRequestLogs: [],
  groqCurrentUtcDay: new Date().toISOString().split('T')[0],
  groqTodayRequests: 0,
  groqTotalRequestsEver: 0,
  groqLastHeaders: { model: 'whisper-large-v3-turbo', limitRequests: '2000', remainingRequests: '2000', resetRequests: '24h0m0s', lastUpdated: 0 },
  groqModelsUsage: {
    'whisper-large-v3-turbo': { requestsToday: 0, remainingRequests: '2000', limitRequests: '2000', resetRequests: '24h0m0s', lastUpdated: 0, accountUsed: 0 },
    'whisper-large-v3': { requestsToday: 0, remainingRequests: '2000', limitRequests: '2000', resetRequests: '24h0m0s', lastUpdated: 0, accountUsed: 0 }
  },
  deepgramRequestsHistory: [],
  deepgramCurrentUtcDay: new Date().toISOString().split('T')[0],
  deepgramTodayRequests: 0,
  deepgramTotalRequestsEver: 0
};
['dist/stt-usage-cache.json', 'data/stt-usage-cache.json', 'public/stt-usage-cache.json', 'android/app/src/main/assets/stt-usage-cache.json', 'android/app/src/main/assets/www/stt-usage-cache.json'].forEach(p => {
  try { fs.writeFileSync(p, JSON.stringify(clean, null, 2), 'utf-8'); } catch (_) {}
});
"

echo "=== 4. Staging and Committing Changes ==="
git add -A
git commit -m "$COMMIT_MSG" || echo "No changes to commit"

echo "=== 5. Pushing to GitHub Main Branch to Trigger APK Release ==="
git push origin main || git push --force origin main

echo "=== Deployment & Verification Completed Successfully ==="
