# Android WebView 黑屏與 API 中斷問題根因分析與標準解決方案手冊 (Post-Mortem & Runbook)

## 📌 概述 (Executive Summary)
在混合架構（React SPA + Android Jetpack Compose WebView）開發與自動化 CI 雲端模擬器驗證中，我們遇到並徹底解決了兩大核心問題：
1. **Android WebView 渲染純黑畫面（Black Screen）**
2. **API 404 / 跨域中斷導致自動除錯與渲染機制卡死**

為防止未來遇到類似問題重複排查，本手冊詳細記錄技術根因（Root Causes）、重現特徵、驗證工具與標準解決方案（Standard Solutions）。

---

## 🛑 問題一：Android WebView 啟動後呈現純黑畫面 (Black Screen)

### 1. 根本原因 (Root Causes)
1. **Chromium GPU 光柵化（Rasterizer）字型緩衝區崩潰**：
   - **底層報錯**：`GL ERROR :GL_INVALID_VALUE : glRasterCHROMIUM: Invalid font buffer.` 及 `RasterCHROMIUM: serialization failure`。
   - **機制**：在無實體 GPU 的雲端模擬器（如 GitHub Actions Runner）或特定 Android 驅動中，Chromium 的硬體加速繪圖管線反序列化向量字型與漸層時發生崩潰。JavaScript 雖然執行了 React `mountApp`，但 Chromium Render Process 丟棄了繪圖影格（Drop Frame），導致螢幕只留下底層畫布純黑背景。
2. **Vite ES 模組標籤與 WebView 跨域安全性**：
   - Vite 產出的 `<script type="module" crossorigin>` 在部分 Android WebView 本地環境載入時會觸發跨域限制或模組延遲執行。
3. **Jetpack Compose 生命週期提早銷毀**：
   - `AndroidView(onRelease = { webView.destroy() })` 在 Composable 重組時過早銷毀實例。

### 2. 解決方案 (Solutions)

#### A. 智慧層級切換 (Software Layer Fallback)
在 `MainScreen.kt` 中動態偵測環境：在模擬器或無 GPU 環境強制使用 CPU 軟體渲染（`LAYER_TYPE_SOFTWARE`），實體手機則維持硬體加速（`LAYER_TYPE_HARDWARE`）。
```kotlin
// android/app/src/main/java/com/bilingo/radio/ui/screens/MainScreen.kt
val isEmulator = Build.FINGERPRINT.startsWith("generic") ||
        Build.FINGERPRINT.startsWith("unknown") ||
        Build.MODEL.contains("google_sdk") ||
        Build.MODEL.contains("Emulator") ||
        Build.MODEL.contains("Android SDK built for x86") ||
        Build.HARDWARE.contains("goldfish") ||
        Build.HARDWARE.contains("ranchu") ||
        Build.PRODUCT.contains("sdk") ||
        Build.PRODUCT.contains("emulator")

if (isEmulator) {
    Log.i("MainScreen", "Emulator detected: setting WebView LAYER_TYPE_SOFTWARE")
    setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null)
} else {
    setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
}
```

#### B. 後處理腳本移除 `type="module"` 與 `crossorigin`
在 `scripts/postbuild.js` 構建流程中，自動清理 HTML 標籤屬性：
```javascript
// scripts/postbuild.js
html = html.replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>');
html = html.replace(/<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g, '<link rel="stylesheet" href="$1">');
```

#### C. CI 雲端模擬器啟動參數優化
更新 `.github/workflows/build-android.yml`：
```yaml
emulator-options: -no-window -gpu guest -noaudio -no-boot-anim -camera-back none
```

---

## 🛑 問題二：API 404 / 網路異常造成非同步中斷 (API 404 Unhandled Rejection)

### 1. 根本原因 (Root Causes)
1. **`res.json()` 解析 HTML 404 頁面崩潰**：
   - 伺服器回傳 404 HTML 頁面時，`res.json()` 拋出 `SyntaxError: Unexpected token '<'`，造成 Promise 鏈斷裂。
2. **未捕獲的 Promise 拒絕（Unhandled Rejection）**：
   - 瀏覽器拋出全域紅色異常，中斷後續的診斷日誌收集與 UI 降級渲染。
3. **Android WebView CORS Preflight 阻斷**：
   - Origin 為 `https://appassets.android.com` 時，若端點 404 並重新導向，會被瀏覽器安全原則徹底攔截。

### 2. 解決方案 (Solutions)

#### A. 核心安全請求層 (`src/utils/safeFetch.ts`)
封裝 `safeApiFetch`，確保「零崩潰、主動診斷、無縫降級」：
```typescript
export async function safeApiFetch<T = any>(
  endpointOrUrl: string,
  options?: RequestInit,
  fallbackData?: T
): Promise<SafeApiResponse<T>> {
  try {
    const response = await fetch(finalUrl, { ...options });
    if (!response.ok) {
      triggerAutoDebug({
        type: response.status === 404 ? 'API_404_NOT_FOUND' : 'API_HTTP_ERROR',
        url: finalUrl,
        status: response.status,
        message: `HTTP ${response.status} from ${finalUrl}`,
        timestamp: Date.now()
      });
      return { ok: false, status: response.status, data: fallbackData ?? null, source: 'fallback' };
    }
    const text = await response.text();
    return { ok: true, status: response.status, data: JSON.parse(text) };
  } catch (err: any) {
    triggerAutoDebug({
      type: 'API_NETWORK_EXCEPTION',
      url: finalUrl,
      status: 0,
      message: err.message,
      timestamp: Date.now()
    });
    return { ok: false, status: 0, data: fallbackData ?? null, source: 'fallback' };
  }
}
```

#### B. 全域 Promise 異常保護 (`src/main.tsx`)
```typescript
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault(); // 阻止瀏覽器中斷
  triggerAutoDebug({
    type: 'API_NETWORK_EXCEPTION',
    message: event.reason?.message || String(event.reason),
    timestamp: Date.now()
  });
});
```

#### C. 後端 Express 404 JSON 萬用防呆 (`server.ts`)
```typescript
// 保證 API 回應永遠是合法 JSON 且帶有 CORS
app.all('/api/*', (req, res) => {
  res.status(404).json({
    status: 404,
    error: 'Not Found',
    message: `API endpoint ${req.originalUrl} not found`,
    timestamp: Date.now()
  });
});
```

---

## 🔍 自動化品質門禁檢測 (Quality Gate Check)
在 `scripts/quality_gate.py` 中建立不可忽視的雙重驗證：
1. **Logcat 握手標記**：驗證 `React App successfully mounted`、`onPageReady`、`BilingoJS` 等啟動標籤。
2. **螢幕色彩豐富度與純黑防禦**：
   - 抓取螢幕截圖進行色票統計。
   - 若純黑 `(0,0,0)` 佔比 > 80% 或色彩總數 < 50 種，自動判定為 FAIL，杜絕黑屏 APK 混入發布版本。
