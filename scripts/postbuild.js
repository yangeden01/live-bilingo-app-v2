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

  const versionInfo = {
    version: '2.2.3',
    commit: commitHash || 'dev',
    buildTime: Date.now(),
  };

  fs.writeFileSync(path.resolve('dist/build-version.json'), JSON.stringify(versionInfo, null, 2), 'utf-8');
  if (fs.existsSync(path.resolve('public'))) {
    fs.writeFileSync(path.resolve('public/build-version.json'), JSON.stringify(versionInfo, null, 2), 'utf-8');
  }
  console.log('[postbuild.js] Generated build-version.json:', versionInfo);
} catch (e) {
  console.warn('[postbuild.js] Failed to generate build-version.json:', e);
}


