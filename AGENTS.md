# AGENTS.md

本專案的所有規則、建置與上架流程都寫在 [CLAUDE.md](CLAUDE.md)，任何 AI 助理（Claude、Codex、Gemini、Copilot 等）都請以 CLAUDE.md 為準。

重點：
- 不得自動 push 到 `main` 或 `radio-selfuse`；修改先推到工作分支，由使用者決定是否合併。
- 不得執行 `scripts/deploy.sh`（會強制推送、改全域 git 設定、刪除 `.git`）。
- 不得顯示、提交或分享任何 API Key、密碼、Secret 或簽署金鑰。
- 上傳金鑰只放在 GitHub Secrets，repo 內不放任何金鑰檔。
