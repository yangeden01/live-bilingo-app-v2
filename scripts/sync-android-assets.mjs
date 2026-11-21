// 把 dist/ 複製到 android/app/src/main/assets/（APK 內的網頁），只複製一份。
// 由 `npm run build` 自動執行；CI 也只跑 npm run build，不要再另外 cp。
//
// 2026-11-21 起：
// - 不再複製第二份到 assets/www/（原生端只在根目錄找不到時才找 www/，根目錄一定有，www/ 只是多佔約 6 MB）。
// - 排除 App 用不到、也不該出現在 APK 裡的檔案（後端程式、sourcemap、商店宣傳圖、憑證等）。
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'dist';
const DEST = 'android/app/src/main/assets';

// 相對於 dist/ 的路徑；比對完整路徑或開頭
const EXCLUDE = [
  'server.cjs',            // Node 後端，App 內不會執行
  'server.cjs.map',        // 後端原始碼 sourcemap
  'upload_certificate.pem',
  'test-fixed.png',
  'app-ads.txt',           // 網站用，不需要放進 APK
  'store-assets',          // Play 商店宣傳圖
  'google-play-feature-graphic-1024x500.png',
  'google-play-icon-512x512.png',
  'assets/aistudio',       // AI Studio 對話截圖
];

const isExcluded = (rel) => EXCLUDE.some((e) => rel === e || rel.startsWith(e + '/'));

if (!existsSync(SRC)) {
  console.error(`[sync-android-assets] ${SRC}/ 不存在，請先執行 vite build`);
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

let copied = 0;
let skipped = 0;
for (const name of readdirSync(SRC)) {
  if (isExcluded(name)) {
    skipped++;
    continue;
  }
  cpSync(join(SRC, name), join(DEST, name), {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(SRC.length + 1).replace(/\\/g, '/');
      if (rel && isExcluded(rel)) {
        skipped++;
        return false;
      }
      return true;
    },
  });
  copied++;
}
console.log(`[sync-android-assets] copied ${copied} top-level entries to ${DEST} (skipped ${skipped})`);
