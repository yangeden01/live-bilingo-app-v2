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

  // Ensure script tags have relative src and defer (standard script for IIFE bundle)
  html = html.replace(/<script(\s+defer)?(\s+type="module")?\s+src="(\/|\.\/)?assets\/index-([^"]+)\.js"><\/script>/g, '<script defer src="./assets/index-$4.js"></script>');

  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('[postbuild.js] Successfully optimized dist/index.html script tags for WebView compatibility.');
}


