import fs from 'fs';
import path from 'path';

const indexPath = path.resolve('dist/index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8');

  // Remove crossorigin attribute if present
  html = html.replace(/ crossorigin(=("[^"]*"|'[^']*'|[^>\s]+))?/g, '');

  // Normalize absolute asset paths to relative paths
  html = html.replace(/src="\/assets\//g, 'src="./assets/');
  html = html.replace(/href="\/assets\//g, 'href="./assets/');

  // Ensure script tags have relative src and remove type="module" (for IIFE bundle compatibility with Android WebView & file:///)
  html = html.replace(/<script(\s+defer)?(\s+type="module")?\s+src="(\/|\.\/)?assets\/index-([^"]+)\.js"><\/script>/g, '<script defer src="./assets/index-$4.js"></script>');
  html = html.replace(/<script\s+type="module"\s+src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>');

  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('[postbuild.js] Successfully optimized dist/index.html script tags for WebView compatibility.');
}

// Generate build-version.json with latest build timestamp
try {
  let commitHash = '';
  const headPath = path.resolve('.git/HEAD');
  if (fs.existsSync(headPath)) {
    const head = fs.readFileSync(headPath, 'utf-8').trim();
    if (head.startsWith('ref: ')) {
      const refPath = path.resolve('.git', head.substring(5).trim());
      if (fs.existsSync(refPath)) {
        commitHash = fs.readFileSync(refPath, 'utf-8').trim().substring(0, 7);
      }
    } else {
      commitHash = head.substring(0, 7);
    }
  }

  let appVersion = '2.4.8';
  try {
    const typesContent = fs.readFileSync(path.resolve('src/types.ts'), 'utf-8');
    const match = typesContent.match(/APP_VERSION\s*=\s*['"]v?([^'"]+)['"]/);
    if (match) appVersion = match[1];
  } catch (e) {}

  const versionInfo = {
    version: appVersion,
    commit: commitHash || 'dev',
    buildTime: Date.now(),
  };

  fs.writeFileSync(path.resolve('dist/build-version.json'), JSON.stringify(versionInfo, null, 2), 'utf-8');
  if (fs.existsSync(path.resolve('public'))) {
    fs.writeFileSync(path.resolve('public/build-version.json'), JSON.stringify(versionInfo, null, 2), 'utf-8');
  }
  console.log('[postbuild.js] Generated build-version.json:', versionInfo);

  // Write clean/sanitized stt-usage-cache.json to dist so APK starts with 0 local usage
  const cleanCache = {
    groqRequestsHistory: [],
    groqRecentRequestLogs: [],
    groqCurrentUtcDay: new Date().toISOString().split('T')[0],
    groqTodayRequests: 0,
    groqTotalRequestsEver: 0,
    groqLastHeaders: {
      model: "whisper-large-v3-turbo",
      limitRequests: "2000",
      remainingRequests: "2000",
      resetRequests: "24h0m0s",
      lastUpdated: 0
    },
    groqModelsUsage: {
      "whisper-large-v3-turbo": {
        requestsToday: 0,
        remainingRequests: "2000",
        limitRequests: "2000",
        resetRequests: "24h0m0s",
        lastUpdated: 0,
        accountUsed: 0
      },
      "whisper-large-v3": {
        requestsToday: 0,
        remainingRequests: "2000",
        limitRequests: "2000",
        resetRequests: "24h0m0s",
        lastUpdated: 0,
        accountUsed: 0
      }
    },
    deepgramRequestsHistory: [],
    deepgramCurrentUtcDay: new Date().toISOString().split('T')[0],
    deepgramTodayRequests: 0,
    deepgramTotalRequestsEver: 0
  };
  fs.writeFileSync(path.resolve('dist/stt-usage-cache.json'), JSON.stringify(cleanCache, null, 2), 'utf-8');
  fs.writeFileSync(path.resolve('data/stt-usage-cache.json'), JSON.stringify(cleanCache, null, 2), 'utf-8');
  if (fs.existsSync(path.resolve('public'))) {
    fs.writeFileSync(path.resolve('public/stt-usage-cache.json'), JSON.stringify(cleanCache, null, 2), 'utf-8');
  }
  console.log('[postbuild.js] Successfully ensured fresh 0-count stt-usage-cache.json in dist/, data/, and public/');
} catch (e) {
  console.warn('[postbuild.js] Failed to generate build-version.json:', e);
}


