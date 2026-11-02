# CLAUDE.md — Live Bilingo

依 GitHub `yangeden01/live-bilingo-app-v2` 與 Play Console 驗證，日期 2026-11-02。`main` 為 `91456d4`，`radio-selfuse` 為 `e209ecc`。

未驗證：本機未實際建置；`radio-selfuse` 只比對差異，未逐檔閱讀；GitHub Secrets 內容無法查看。

## 工作規則

1. **不得影響已上架的 App 與已安裝的使用者。** 遷移一律新舊並行，舊路徑要等舊版不再依賴才移除。
2. **使用者要求修改時才改程式、CI 或 repo。** 檢查發現問題時只回報，不主動修改。
3. **YouTube 模式的優化要同時更新兩個版本**，`main` 保留廣告，`radio-selfuse` 維持無廣告。
4. 未經確認不得提交、推送、部署、刪除或覆蓋資料。
5. 不得顯示、提交或分享 API Key、密碼、Secret 與簽署金鑰。
6. 使用繁體中文。修改前先檢查現況，修改後執行必要測試。

**本檔優先於 `AGENTS.md`。** AGENTS.md 的自動 push、回覆附花費報告、「main 是唯一維護目標」都不適用；其中的版本、地區與套件名已過時。

## 兩個版本

| | 上架版 | 自用版 |
|---|---|---|
| 分支 | `main` | `radio-selfuse` |
| applicationId | `com.bilingo.radio` | `com.bilingo.radio.internal` |
| 版本 | 267 / 2.6.7 | 255 / 2.5.5 |
| YouTube 模式 | 有 | 有，應與上架版相同 |
| 廣播即時字幕與翻譯 | 無 | 有 |
| 廣告 | AdMob 插頁等 | 無 |
| 發布 | Google Play | 自行安裝 APK |

- `main` 不得加入廣播模式，`radio-selfuse` 不得加入廣告。
- 目前兩版的 YouTube 程式尚未一致（例如 `YouTubeNewsManager.kt`、`MainScreen.kt`），第一次同步時要先處理落差。
- `full-featured-radio` 是舊分支，不在維護範圍。

### 維護注意

- **兩分支沒有共同祖先，不能 merge。** 修改要分別移植並各自驗證，並排除廣告與廣播相關程式。
- **共用同一個後端**（`src/utils/apiUrl.ts` 相同）。後端變更會同時影響兩版，也要相容上架舊版。
- **CI 與簽署腳本兩邊都有**，但目前內容已不同：`main` 的 `ensure_keystore.py` 已移除 Base64 輸出，`radio-selfuse` 尚未移除。
- CI 在 `main` push 時自動觸發，`radio-selfuse` 要手動 dispatch。
- 兩邊 workflow 都發布到 `latest` 與 `bilingo-radio.apk`，自用版建置可能蓋掉上架版的 Release 檔（不影響 Play）。

## 架構

Android 原生外殼以 WebView 載入 React 前端，前端呼叫遠端 Node 後端。

- 前端 `src/`：React 19、Vite 6、Tailwind 4。
- 後端 `server.ts`、`server/`：Express + ws，整合 Gemini、Groq Whisper、Deepgram、YouTube 字幕與新聞探索。
- Android `android/`：Kotlin、Compose。`MainScreen.kt` 以 `WebViewAssetLoader` 載入前端，另有原生 `youtube/`、`stt/`、`translation/`、前景服務與桌面小工具；`main` 另有 `ads/`。
- `android/app/src/main/assets/` 與 `assets/www/` 是建置產物，不要手改。
- AGP 8.5.0、Kotlin 2.0.0、Gradle 8.7、JDK 17、compileSdk/targetSdk 36、minSdk 24。
- WebView 黑屏問題見 `docs/WEBVIEW_BLACKSCREEN_AND_API_ROOTCAUSE.md`。

## 建置

```bash
npm ci
```

```bash
npm run lint
```

```bash
npm run build
```

```bash
npm run test:subtitles
```

```bash
cd android && ./gradlew assembleDebug
```

- `npm run build` 含 `rm`、`cp`，Windows 要用 Git Bash。切換分支後要重跑。
- 本機需要 JDK 17 與 SDK 36；Windows clone 需要 `git config core.longpaths true`。
- repo 內的 keystore 已損毀，release 版只能由 CI 建置。
- **不要使用 `scripts/deploy.sh`**：它會 `git add -A`、`push --force`、改全域 git 設定，甚至 `rm -rf .git`。

CI：`.github/workflows/build-android.yml` 建置 AAB、APK，跑模擬器測試，再發布 APK 到 GitHub Releases。它**不會**上傳 Play。失敗時 `ai_self_heal.py` 會自動修改並推送。

## 現況

### 後端

- `BACKEND_URL` 指向 AI Studio 預覽服務（`ais-pre-*.run.app`），匿名請求會被導向 AI Studio 登入。
- 2026-11-02 重新安裝 Play 版後操作正常，但不確定哪些功能走備援。
- **最大遺留風險**：AI Studio 專案停用或網址變更時，已安裝的 App 會失去後端。遷移時保留舊後端，另外部署新後端。

### API 金鑰

- 後端以環境變數讀取 `GEMINI_API_KEY`，自行部署時要自己設定。不得把 Gemini Key 打包進 APK。
- Android 原生 Gemini 路徑沒有傳入 key，且仍指向 `gemini-1.5-flash`，不會成功。
- 公開 repo 中有寫死的 Deepgram token 與 YouTube Data API Key，`/api/deepgram-config` 也會回傳 token。
- **不得直接撤銷舊金鑰**，已發布的 App 可能仍在使用。先建新路徑、發新版，舊版用量降低後再撤銷；若確認遭盜用，由使用者決定。

### 簽署

- Play App Signing 已啟用。應用程式簽署金鑰 SHA-256：`A8:96:2A:09…1B:24:BD`。
- Play 上傳金鑰 SHA-256：`95:EB:CD:8A…83:F9:F1`。CI Secrets 應為這把，但未直接驗證。
- **repo 的 `upload_certificate.pem`（`6C:E1:8C:05…`）不是現行上傳憑證，不可用來比對。**
- repo 的 `release.keystore`、`temp.p12` 已損毀，無法使用。
- 不得升級或更換應用程式簽署金鑰。上傳金鑰遺失時，可在 Play Console 申請重設。

### 版本

- versionCode 寫死在 `android/app/build.gradle.kts`，CI 不會自動遞增。
- Play 已使用到 267，下一版至少 268。Play Console 正式版：267（2.6.7），178 個國家全面推出。

## 上架流程

1. 通過 `npm run lint`、`npm run test:subtitles`。
2. 遞增 `versionCode`、`versionName`。
3. 推送 `main`，等 CI 成功。
4. 確認 Keystore 步驟沒有產生新金鑰。
5. 從 Artifacts 下載 `app-release-aab`，上傳內部測試軌。
6. 實機驗證字幕、翻譯、廣告、後端連線與舊版升級。
7. 升級到正式版，分階段發布。
8. 使用者可見變更要同步更新隱私權政策與資料安全表單。

## 自用版流程

1. 遞增版本並通過檢查。
2. 手動 dispatch `build-android.yml`，分支選 `radio-selfuse`。
3. 從 Artifacts 下載 `app-release-apk`，實機驗證。
4. 檢查 `latest` Release 是否被覆蓋。
