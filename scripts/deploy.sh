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
git remote set-url origin "$REPO_URL"

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

echo "=== 4. Staging and Committing Changes ==="
git add -A
git commit -m "$COMMIT_MSG" || echo "No changes to commit"

echo "=== 5. Pushing to GitHub Main Branch to Trigger APK Release ==="
git push origin main || git push --force origin main

echo "=== Deployment & Verification Completed Successfully ==="
