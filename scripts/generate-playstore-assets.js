import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateAssets() {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Google Play App Icon (512 x 512 px)
  const iconSvg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="50%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>
      <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#2563eb"/>
      </linearGradient>
      <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#60a5fa"/>
        <stop offset="100%" stop-color="#93c5fd"/>
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="12" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Background (Full 512x512 square, Play Store applies rounding) -->
    <rect width="512" height="512" fill="url(#bgGrad)"/>

    <!-- Subtle Background concentric pulse rings -->
    <circle cx="256" cy="230" r="170" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.15"/>
    <circle cx="256" cy="230" r="130" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.25"/>

    <!-- Radio Waves Glowing -->
    <path d="M 120 230 A 136 136 0 0 1 392 230" fill="none" stroke="url(#waveGrad1)" stroke-width="26" stroke-linecap="round" filter="url(#glow)"/>
    <path d="M 164 230 A 92 92 0 0 1 348 230" fill="none" stroke="url(#waveGrad2)" stroke-width="22" stroke-linecap="round"/>
    <path d="M 206 230 A 50 50 0 0 1 306 230" fill="none" stroke="#e0f2fe" stroke-width="18" stroke-linecap="round"/>

    <!-- Central Signal Tower Light Core -->
    <circle cx="256" cy="230" r="26" fill="#ffffff" filter="url(#glow)"/>
    <circle cx="256" cy="230" r="16" fill="#0284c7"/>

    <!-- Typography -->
    <text x="256" y="375" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle" letter-spacing="1">Live Bilingo</text>
    <text x="256" y="425" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="28" fill="#38bdf8" text-anchor="middle" letter-spacing="3">雙語廣播電台</text>
  </svg>
  `;

  const iconBuffer = await sharp(Buffer.from(iconSvg))
    .resize(512, 512)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'google-play-icon-512x512.png'), iconBuffer);
  console.log('✓ Generated public/google-play-icon-512x512.png (512x512)');

  // 2. Google Play Feature Graphic (1024 x 500 px)
  const featureSvg = `
  <svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="featBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="40%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#0369a1"/>
      </linearGradient>
      <linearGradient id="accentCyan" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#60a5fa"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0.9"/>
      </linearGradient>
      <filter id="featGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="15" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="1024" height="500" fill="url(#featBg)"/>

    <!-- Decorative Audio Waveforms in Background -->
    <g opacity="0.15" stroke="#38bdf8" stroke-width="2" fill="none">
      <path d="M 0 420 Q 256 300 512 400 T 1024 350"/>
      <path d="M 0 450 Q 256 350 512 440 T 1024 400"/>
    </g>

    <!-- Left Content: App Title & Value Proposition -->
    <!-- Badge -->
    <rect x="70" y="70" width="170" height="34" rx="17" fill="#0284c7" opacity="0.3"/>
    <rect x="70" y="70" width="170" height="34" rx="17" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="155" y="93" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="14" fill="#38bdf8" text-anchor="middle">LIVE RADIO &amp; AI</text>

    <!-- Main Headings -->
    <text x="70" y="175" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="52" fill="#ffffff">Live Bilingo</text>
    <text x="70" y="240" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="url(#accentCyan)">雙語即時廣播電台</text>

    <text x="70" y="300" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="20" fill="#94a3b8">全球多國優質廣播串流 ✕ AI 雙語即時字幕對照</text>
    
    <!-- Feature Pill Tags -->
    <g transform="translate(70, 345)">
      <rect x="0" y="0" width="130" height="36" rx="18" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="65" y="23" font-family="sans-serif" font-size="14" font-weight="600" fill="#e2e8f0" text-anchor="middle">📻 全球電台</text>

      <rect x="145" y="0" width="130" height="36" rx="18" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="210" y="23" font-family="sans-serif" font-size="14" font-weight="600" fill="#e2e8f0" text-anchor="middle">⚡ 雙語字幕</text>

      <rect x="290" y="0" width="130" height="36" rx="18" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="355" y="23" font-family="sans-serif" font-size="14" font-weight="600" fill="#e2e8f0" text-anchor="middle">📖 護眼紙張</text>
    </g>

    <!-- Right Side Mockup Card -->
    <g transform="translate(620, 50)">
      <!-- Outer Card Shadow & Container -->
      <rect x="0" y="0" width="340" height="400" rx="28" fill="url(#cardGrad)" stroke="#38bdf8" stroke-width="1.5" filter="url(#featGlow)"/>

      <!-- App Header Mockup -->
      <circle cx="45" cy="45" r="16" fill="#0284c7"/>
      <path d="M 37 45 A 8 8 0 0 1 53 45" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="45" cy="45" r="3" fill="#ffffff"/>
      <text x="75" y="52" font-family="sans-serif" font-size="18" font-weight="700" fill="#ffffff">即時美西公共新聞</text>
      
      <!-- Subtitle Card 1 -->
      <rect x="25" y="85" width="290" height="110" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
      <text x="45" y="118" font-family="sans-serif" font-size="13" font-weight="700" fill="#38bdf8">17:30:12 • 即時語音辨識</text>
      <text x="45" y="146" font-family="sans-serif" font-size="15" font-weight="600" fill="#f8fafc">Welcome back to Live Radio News.</text>
      <text x="45" y="174" font-family="sans-serif" font-size="14" font-weight="500" fill="#93c5fd">• 歡迎回到即時廣播新聞專題。</text>

      <!-- Subtitle Card 2 (Active with blue accent) -->
      <rect x="25" y="210" width="290" height="115" rx="16" fill="#1e293b" stroke="#0284c7" stroke-width="1.5"/>
      <text x="45" y="243" font-family="sans-serif" font-size="13" font-weight="700" fill="#60a5fa">17:30:24 • 本機即時翻譯</text>
      <text x="45" y="271" font-family="sans-serif" font-size="15" font-weight="700" fill="#ffffff">Exploring the global culture today.</text>
      <text x="45" y="299" font-family="sans-serif" font-size="14" font-weight="600" fill="#38bdf8">• 探索今日全球多元文化新趨勢。</text>

      <!-- Bottom Audio Stream Indicator -->
      <rect x="25" y="340" width="290" height="42" rx="21" fill="#0284c7"/>
      <text x="170" y="366" font-family="sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">▶ 雙語即時串流播放中</text>
    </g>
  </svg>
  `;

  const featureBuffer = await sharp(Buffer.from(featureSvg))
    .resize(1024, 500)
    .png({ quality: 100 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'google-play-feature-graphic-1024x500.png'), featureBuffer);
  console.log('✓ Generated public/google-play-feature-graphic-1024x500.png (1024x500)');
}

generateAssets().catch(console.error);
