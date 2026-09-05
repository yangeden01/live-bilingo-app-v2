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

## Mandatory Subtitle Synchronization & Learning Rules (每一次程式更新必檢查規範)
1. **廣播音訊流暢度第一（無需零延遲即時）**：
   - 最優先保證廣播播放流暢不卡頓、不破音、不頻繁重置緩衝區。
   - 廣播使用解耦時間對齊器（Decoupled Time Aligner）維持穩定緩衝（2.5s～3.5s），允許少量傳輸延遲以換取極致播放穩定性。
2. **雙語字幕與語音精準對齊（字幕可提前廣播 0.5 秒出現）**：
   - 字幕排程釋放時間精準比對音訊時間軸，字幕可比廣播聲音提早 0.5 秒呈現在畫面上，讓使用者的視覺先吸納字幕再聽見語音。
3. **保持段落雙語字幕斷句完整，方便學習（禁止破碎短句與重複語句）**：
   - 嚴格以完整語意句子邊界（`.` `?` `!` 或自然語調終止）進行斷句與中文翻譯，禁止在逗號 `,` 處粗暴切碎句子。
   - 嚴禁將 interim（臨時識別字串）混入已定稿緩衝區（避免字詞在畫面上重複兩次或原地循環）。
   - 內建防幻覺與多詞重複過濾器（Anti-Hallucination & Multi-Word Phrase Sanitizer），杜絕 `and set up and set up` 等底噪重複句。
4. **網路斷訊與恢復同步（斷線暫停，恢復即時續播與更新）**：
   - 當網路斷線或進入無訊號區時，字幕跟隨廣播停止更新，防止畫面殘留錯誤狀態。
   - 網路一旦恢復，Android 原生層、前端 SSE/短輪詢與後端 STT 必須立刻恢復連線，重置時間戳記並即時恢復雙語字幕顯示更新，杜絕畫面凍結。

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

