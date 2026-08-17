# Project Workflow Rules

## Mandatory Deployment & Git Push Rules
1. **Automated Git Push on Every Change**:
   - The project includes an automated deployment script: `scripts/deploy.sh` (or `npm run deploy`).
   - For every code modification, UI fix, bug fix, or feature update, the agent MUST run:
     `bash scripts/deploy.sh "<descriptive commit message>"`
   - This script automatically configures Git remote URL with token authentication from `.env`, compiles all web assets, runs the live subtitle simulator (`scripts/verify-subtitles-stream.js`) to guarantee STT & bilingual translation passes 100%, synchronizes assets into `android/app/src/main/assets/` and `android/app/src/main/assets/www/`, commits all changes, and pushes directly to `origin main` to trigger GitHub Actions APK build.
   - Quality Gate: If live subtitles verification fails, the deployment is aborted and NO APK is released.
   - Target Repository: `yangeden01/live-bilingo-app-v2`
   - Git User: `yangeden01` / `yangeden01@gmail.com`

2. **Automated GitHub Actions Monitoring & Zero-Screenshot Debugging**:
   - The project includes `npm run check-ci` (`node scripts/check-github-actions.js`).
   - Whenever the user mentions a GitHub build failure, asks about CI status, or after deployment, the agent can query the GitHub Actions API directly using the configured `GITHUB_TOKEN`.
   - The agent inspects failing jobs, steps, and logs directly via the GitHub API and automatically repairs the issue without requiring the user to take screenshots or paste logs.

## Verified Google Play Console & Closed Testing Configuration (DO NOT ASK FOR CONFIRMATION AGAIN)
The following Google Play Console and closed testing settings have been 100% verified via screenshots and MUST NOT be asked to re-confirm:
1. **Target Package ID**: `com.livebilingo.radio`
2. **Current Closed Testing Release**: Version `223 (2.2.3)` is active, rolled out, and published to testers on track `封閉測試 - 封閉測試`.
3. **Countries / Regions**: Taiwan (台灣), United States (美國), and China (中國) are verified as assigned (`已指定 3 個國家/地區`).
4. **Tester Group Setting**:
   - Testing Type: Google Group (`Google 群組`).
   - Group Email: `live-bilingo-testers@googlegroups.com`.
   - Group URL: `https://groups.google.com/g/live-bilingo-testers`.
   - Group Permissions: Set to public join ("任何人皆可加入群組").
5. **Feedback Channel**: Verified set to `yangeden01@gmail.com`.
6. **Published Changes**: All 2 pending changes in Play Console were submitted and confirmed published/live.
7. **Known Propagation Behavior**: Newly configured Google Groups in Google Play Console require a 1–3 hour global CDN / auth propagation delay before `https://play.google.com/apps/testing/com.livebilingo.radio` switches from "App not available" to "Become a tester". NEVER ask the user for region/version/group screenshots for this known status.
