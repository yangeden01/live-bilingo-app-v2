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

## Mandatory App Architecture & Version Distinction Rules (核心產品定位與版本架構必記規範)
【極重要核心記憶：本專案與 App 雙版本架構定義，每一次對話與開發嚴格遵守】：
1. **上架版 App（Google Play 商店公開發行版 / 本代碼庫唯一維護目標）**：
   - **發行狀態**：🎉 **已經正式公開上架 Google Play 商店（Production / Published Live）！**
   - **功能定位**：**100% 只有「YouTube 影音雙語字幕英語學習」**，絕無任何廣播功能！
   - **廣告配置**：**包含 AdMob 廣告（影音加廣告）**。靠實際用戶觀看影音學習時的自然曝光與點擊產生收入。
   - **回覆與開發守則**：嚴禁在上架版程式或任何對話回覆中提及聽廣播或加入廣播功能。
2. **自用版 App（個人私有自用版）**：
   - **功能定位**：**同時擁有「廣播」與「影音雙語」** 雙重強大功能。
   - **廣告配置**：**完全沒有廣告（無廣告干擾）**，純淨自用體驗。
3. **YouTube 影音流暢度第一（上架版嚴禁廣播干擾）**：
   - 最優先保證 YouTube 影音播放流暢不卡頓、不破音。
   - 專注於 YouTube 影片影音播放與時間軸控制。
4. **雙語字幕與影音語音精準對齊（字幕可提前 0.5 秒出現）**：
   - 字幕排程釋放時間精準比對 YouTube 影音時間軸，字幕可比影片發音提早 0.5 秒呈現在畫面上，讓使用者的視覺先吸納雙語字幕再聽見語音。
5. **保持段落雙語字幕斷句完整，方便學習（禁止破碎短句與重複語句）**：
   - 嚴格以完整語意句子邊界（`.` `?` `!` 或自然語調終止）進行斷句與中文翻譯，禁止在逗號 `,` 處粗暴切碎句子。
   - 嚴禁重複語句，提供高品質 YouTube 雙語字幕對照學習體驗。
6. **網路斷訊與恢復同步（斷線暫停，恢復即時續播與更新）**：
   - 當網路斷線時，字幕跟隨 YouTube 影片暫停。
   - 網路一旦恢復，即時恢復連線與同步雙語字幕顯示更新。

## Verified Google Play Console & Closed Testing Configuration (DO NOT ASK FOR CONFIRMATION AGAIN)
The following Google Play Console and closed testing settings have been 100% verified via screenshots and MUST NOT be asked to re-confirm:
1. **Target Package ID**: `com.livebilingo.radio`
2. **Current Release Status**: 🎉 **Live Bilingo 影音雙語已正式公開上架 (Production / Published Live)**，活躍版本 `223 (2.2.3)`。
3. **Countries / Regions**: Taiwan (台灣), United States (美國), and China (中國) are verified as assigned (`已指定 3 個國家/地區`).
4. **Tester Group Setting**:
   - Testing Type: Google Group (`Google 群組`).
   - Group Email: `live-bilingo-testers@googlegroups.com`.
   - Group URL: `https://groups.google.com/g/live-bilingo-testers`.
   - Group Permissions: Set to public join ("任何人皆可加入群組").
5. **Feedback Channel**: Verified set to `yangeden01@gmail.com`.
6. **Published Changes**: All 2 pending changes in Play Console were submitted and confirmed published/live.
7. **Known Propagation Behavior**: Newly configured Google Groups in Google Play Console require a 1–3 hour global CDN / auth propagation delay before `https://play.google.com/apps/testing/com.livebilingo.radio` switches from "App not available" to "Become a tester". NEVER ask the user for region/version/group screenshots for this known status.



## Mandatory Ending Format (每一次對話最後必回報規範 - 實際花費 Total 與拆分細項，幣別以美金 USD 標示)
每一次對話回覆的最末尾，不需要官方牌價標準，只要秀出本次請求的「實際花費 Total」與「拆分細項」，幣別使用美金（USD），其餘一律取消：
1. 本次請求實際花費（Total Cost）：$X.XXXX USD
2. 拆分細項：
   - 輸入消耗（Input / Prompt Tokens）：約 XX,XXX Tokens（$X.XXXX USD）
   - 輸出與思考消耗（Output / Thinking Tokens）：約 X,XXX Tokens（$X.XXXX USD）
3. 帳戶當前等級：Tier 2，付費層級（付費額度充足）



