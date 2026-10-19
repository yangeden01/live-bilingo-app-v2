import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const outputDir = path.join(process.cwd(), 'public', 'store-assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Google Play App Icon (512 x 512 px)
// Complies with Google Play Store icon guidelines: NO text clutter, clean icon badge, 512x512 full bleed
async function generateAppIcon() {
  const svg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Background Gradient -->
      <linearGradient id="iconBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a0f1d"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>

      <!-- Video Play Shield Gradient -->
      <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>

      <!-- Vibrant Cyan-Blue Gradient for Accents -->
      <linearGradient id="cyanArc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>

      <!-- Indigo-Purple Gradient for Subtitle Waves -->
      <linearGradient id="indigoArc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#818cf8"/>
        <stop offset="100%" stop-color="#c084fc"/>
      </linearGradient>

      <!-- Play Button Red/Coral Gradient (YouTube Learning feel) -->
      <linearGradient id="playGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff3b30"/>
        <stop offset="100%" stop-color="#e11d48"/>
      </linearGradient>

      <filter id="iconGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="16" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Canvas Background -->
    <rect width="512" height="512" rx="115" fill="url(#iconBg)"/>

    <!-- Subtle Ambient Tech Circles -->
    <circle cx="256" cy="256" r="215" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.12"/>
    <circle cx="256" cy="256" r="165" fill="none" stroke="#818cf8" stroke-width="2" opacity="0.18"/>

    <!-- Dual Language Orbit Rings (Representing Bilingual Sync) -->
    <ellipse cx="256" cy="256" rx="195" ry="110" fill="none" stroke="url(#cyanArc)" stroke-width="16" opacity="0.75" transform="rotate(-28 256 256)"/>
    <ellipse cx="256" cy="256" rx="195" ry="110" fill="none" stroke="url(#indigoArc)" stroke-width="12" opacity="0.65" transform="rotate(32 256 256)"/>

    <!-- Center Premium Shield / Card -->
    <rect x="116" y="116" width="280" height="280" rx="64" fill="url(#shieldGrad)" stroke="#38bdf8" stroke-width="4" filter="url(#iconGlow)"/>

    <!-- Dual Bilingual Subtitle Bars (English & Chinese) -->
    <!-- Top Bar: Primary Language Subtitle Line -->
    <rect x="156" y="156" width="200" height="22" rx="11" fill="#38bdf8"/>
    <!-- Bottom Bar: Secondary Translation Subtitle Line -->
    <rect x="156" y="190" width="135" height="16" rx="8" fill="#818cf8" opacity="0.9"/>

    <!-- Center Play Triangle (Vibrant Learning Focus) -->
    <g transform="translate(256, 285)">
      <circle cx="0" cy="0" r="54" fill="url(#playGrad)" filter="url(#iconGlow)"/>
      <polygon points="-12,-22 20,0 -12,22" fill="#ffffff"/>
    </g>

    <!-- Bottom Sparkle Badge -->
    <circle cx="345" cy="345" r="14" fill="#38bdf8" filter="url(#iconGlow)"/>
    <circle cx="345" cy="345" r="7" fill="#ffffff"/>
  </svg>
  `;

  const buf = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(outputDir, 'app-icon-512x512.png'), buf);
  fs.writeFileSync(path.join(process.cwd(), 'public', 'google-play-icon-512x512.png'), buf);
  console.log('✓ Created pure video learning app-icon-512x512.png');
}

// 2. Google Play Feature Graphic (1024 x 500 px)
async function generateFeatureGraphic() {
  const svg = `
  <svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fbg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#060913"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#0369a1"/>
      </linearGradient>
      <linearGradient id="txtGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="50%" stop-color="#818cf8"/>
        <stop offset="100%" stop-color="#38bdf8"/>
      </linearGradient>
      <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95"/>
      </linearGradient>
      <filter id="fGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="12" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="1024" height="500" fill="url(#fbg)"/>

    <!-- Decorative Waves & Ambient Glow -->
    <g opacity="0.12" stroke="#38bdf8" stroke-width="2" fill="none">
      <path d="M 0 380 Q 256 260 512 360 T 1024 310"/>
      <path d="M 0 420 Q 256 320 512 410 T 1024 370"/>
      <circle cx="880" cy="110" r="190" stroke-width="1.5"/>
    </g>

    <!-- Left Brand & Features -->
    <g transform="translate(64, 55)">
      <!-- Top Badge -->
      <rect x="0" y="0" width="240" height="34" rx="17" fill="#0284c7" opacity="0.3"/>
      <rect x="0" y="0" width="240" height="34" rx="17" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="120" y="22" font-family="-apple-system, sans-serif" font-weight="700" font-size="12.5" fill="#38bdf8" text-anchor="middle" letter-spacing="2">YOUTUBE BILINGUAL ENGLISH</text>

      <!-- Main Title -->
      <text x="0" y="90" font-family="-apple-system, sans-serif" font-weight="900" font-size="52" fill="#ffffff" letter-spacing="1">Live Bilingo</text>
      <text x="0" y="148" font-family="-apple-system, sans-serif" font-weight="900" font-size="42" fill="url(#txtGrad)" letter-spacing="1">YouTube 雙語影音英語學習</text>

      <text x="0" y="198" font-family="-apple-system, sans-serif" font-weight="500" font-size="18" fill="#94a3b8">每日熱門國際影音 ✕ 中英逐句同步雙語字幕 ✕ 點詞即查 ✕ 隨身生字卡</text>

      <!-- 4 Core Feature Badges (100% Video Learning, NO Radio) -->
      <g transform="translate(0, 230)">
        <!-- Feature 1 -->
        <rect x="0" y="0" width="235" height="50" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1.2"/>
        <text x="18" y="31" font-family="sans-serif" font-size="14.5" font-weight="700" fill="#38bdf8">🎬 YouTube 雙語影音</text>

        <!-- Feature 2 -->
        <rect x="250" y="0" width="235" height="50" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1.2"/>
        <text x="268" y="31" font-family="sans-serif" font-size="14.5" font-weight="700" fill="#a78bfa">⚡ 逐句語意自然斷句</text>

        <!-- Feature 3 -->
        <rect x="0" y="62" width="235" height="50" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1.2"/>
        <text x="18" y="93" font-family="sans-serif" font-size="14.5" font-weight="700" fill="#34d399">📚 點詞即查 ✕ 生字本</text>

        <!-- Feature 4 -->
        <rect x="250" y="62" width="235" height="50" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1.2"/>
        <text x="268" y="93" font-family="sans-serif" font-size="14.5" font-weight="700" fill="#fbbf24">🧠 翻卡記憶 ✕ CEFR分級</text>
      </g>
    </g>

    <!-- Right Side: Phone Floating Mockup Preview -->
    <g transform="translate(630, 40)">
      <rect x="0" y="0" width="340" height="420" rx="32" fill="url(#cardBg)" stroke="#38bdf8" stroke-width="1.5" filter="url(#fGlow)"/>

      <!-- Video Player Thumbnail Mockup -->
      <rect x="20" y="20" width="300" height="150" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
      <circle cx="170" cy="95" r="26" fill="#dc2626"/>
      <polygon points="163,83 183,95 163,107" fill="#ffffff"/>
      <rect x="30" y="132" width="85" height="24" rx="6" fill="#000000" opacity="0.8"/>
      <text x="72" y="148" font-family="sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">YOUTUBE HD</text>

      <!-- Active Subtitle Bilingual Card -->
      <rect x="20" y="185" width="300" height="135" rx="16" fill="#0f172a" stroke="#0284c7" stroke-width="1.5"/>
      <text x="35" y="214" font-family="sans-serif" font-size="12" font-weight="700" fill="#38bdf8">▶ 00:01:24 • TSMC Global Technology</text>
      <text x="35" y="244" font-family="sans-serif" font-size="14" font-weight="600" fill="#f8fafc">Demand for advanced semiconductor nodes</text>
      <text x="35" y="268" font-family="sans-serif" font-size="14" font-weight="600" fill="#f8fafc">continues to surge across all global sectors.</text>
      <text x="35" y="298" font-family="sans-serif" font-size="13.5" font-weight="500" fill="#93c5fd">• 先進半導體製程需求在各領域持續激增。</text>

      <!-- Vocabulary Quick Action Badge -->
      <rect x="20" y="335" width="300" height="44" rx="12" fill="#0284c7"/>
      <text x="170" y="362" font-family="sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">★ 已將「semiconductor」加入生字本</text>
    </g>
  </svg>
  `;

  const buf = await sharp(Buffer.from(svg)).resize(1024, 500).png().toBuffer();
  fs.writeFileSync(path.join(outputDir, 'feature-graphic-1024x500.png'), buf);
  fs.writeFileSync(path.join(process.cwd(), 'public', 'google-play-feature-graphic-1024x500.png'), buf);
  console.log('✓ Created pure video learning feature-graphic-1024x500.png');
}

// 3. Four Modern Phone Screenshots (1080 x 2400 px, 9:16 aspect ratio) - 100% Video Learning
async function generatePhoneScreenshots() {
  const screens = [
    {
      filename: 'screenshot-1-youtube.png',
      tag: 'DAILY CURATED VIDEOS',
      title: 'YouTube 雙語影音精選',
      desc: '每日精選時事、科技、TED、商業與生活影片\n中英同步逐句對照，邊看精彩影音邊學道地英文',
      accent: '#38bdf8',
      heroType: 'youtube'
    },
    {
      filename: 'screenshot-2-subtitles.png',
      tag: 'SMART BILINGUAL SUBTITLES',
      title: '自然語意斷句 ✕ 繁簡自由切換',
      desc: '完整語意邊界對齊斷句，告別碎片化短句\n字級自訂放大、紙質閱讀模式，保護雙眼舒適學習',
      accent: '#818cf8',
      heroType: 'subtitles'
    },
    {
      filename: 'screenshot-3-vocab.png',
      tag: 'INSTANT DICTIONARY &amp; NOTES',
      title: '點詞即查 ✕ 個人隨身生字本',
      desc: '點擊字幕任一生字，立即彈出權威音標與雙語例句\n一鍵加入生字筆記本，隨時隨地累積高頻詞彙',
      accent: '#34d399',
      heroType: 'vocab'
    },
    {
      filename: 'screenshot-4-flashcard.png',
      tag: 'FLASHCARD QUIZ &amp; CEFR LEVELS',
      title: '單字翻卡測驗 ✕ CEFR 難度分級',
      desc: '依據 CEFR A1~C2 國際標準標示單字難易度\n內建單字卡翻轉測驗，利用碎片時間高效強化記憶',
      accent: '#f59e0b',
      heroType: 'flashcard'
    }
  ];

  for (const s of screens) {
    const svg = `
    <svg width="1080" height="2400" viewBox="0 0 1080 2400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="screenBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#070a14"/>
          <stop offset="40%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="phoneFrameBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#030712"/>
        </linearGradient>
        <filter id="phoneShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#000000" flood-opacity="0.8"/>
        </filter>
      </defs>

      <!-- Canvas Background -->
      <rect width="1080" height="2400" fill="url(#screenBg)"/>

      <!-- Ambient Glow Behind Device -->
      <circle cx="540" cy="1400" r="450" fill="${s.accent}" opacity="0.12"/>

      <!-- Top Text Header Section -->
      <g transform="translate(90, 160)">
        <!-- Tag -->
        <rect x="0" y="0" width="370" height="52" rx="26" fill="${s.accent}" opacity="0.15"/>
        <rect x="0" y="0" width="370" height="52" rx="26" fill="none" stroke="${s.accent}" stroke-width="2"/>
        <text x="185" y="34" font-family="-apple-system, sans-serif" font-weight="800" font-size="16" fill="${s.accent}" text-anchor="middle" letter-spacing="2.5">${s.tag}</text>

        <!-- Main Title -->
        <text x="0" y="145" font-family="-apple-system, sans-serif" font-weight="900" font-size="64" fill="#ffffff" letter-spacing="1">${s.title}</text>
        
        <!-- Description -->
        <text x="0" y="215" font-family="-apple-system, sans-serif" font-weight="500" font-size="28" fill="#94a3b8" line-height="42">
          <tspan x="0" dy="0">${s.desc.split('\n')[0]}</tspan>
          <tspan x="0" dy="46">${s.desc.split('\n')[1]}</tspan>
        </text>
      </g>

      <!-- Center-Bottom Mobile Frame (880 x 1750 px) -->
      <g transform="translate(100, 480)" filter="url(#phoneShadow)">
        <!-- Phone Outer Border -->
        <rect x="0" y="0" width="880" height="1840" rx="64" fill="#1f2937" stroke="#374151" stroke-width="6"/>
        
        <!-- Phone Screen Glass -->
        <rect x="16" y="16" width="848" height="1808" rx="52" fill="url(#phoneFrameBg)"/>

        <!-- Camera Pill Notch -->
        <rect x="360" y="32" width="160" height="34" rx="17" fill="#000000"/>
        <circle cx="495" cy="49" r="7" fill="#1e293b"/>

        <!-- App UI Inside Phone -->
        <g transform="translate(36, 90)">
          <!-- Top App Bar -->
          <circle cx="36" cy="36" r="24" fill="#0284c7"/>
          <text x="76" y="44" font-family="sans-serif" font-weight="800" font-size="28" fill="#ffffff">Live Bilingo 雙語影音</text>
          <rect x="630" y="16" width="140" height="42" rx="21" fill="#0284c7"/>
          <text x="700" y="43" font-family="sans-serif" font-weight="700" font-size="18" fill="#ffffff" text-anchor="middle">播放中</text>

          ${renderPhoneMockupContent(s.heroType)}
        </g>
      </g>
    </svg>
    `;

    const buf = await sharp(Buffer.from(svg)).resize(1080, 2400).png().toBuffer();
    fs.writeFileSync(path.join(outputDir, s.filename), buf);
    // Also save legacy compatibility name if needed
    if (s.filename === 'screenshot-4-flashcard.png') {
      fs.writeFileSync(path.join(outputDir, 'screenshot-4-radio.png'), buf);
    }
    console.log(`✓ Created ${s.filename}`);
  }
}

function renderPhoneMockupContent(type) {
  if (type === 'youtube') {
    return `
      <!-- Video Player Card -->
      <g transform="translate(0, 90)">
        <rect x="0" y="0" width="808" height="450" rx="24" fill="#0b0f19" stroke="#1e293b" stroke-width="2"/>
        <circle cx="404" cy="225" r="50" fill="#dc2626"/>
        <polygon points="392,200 428,225 392,250" fill="#ffffff"/>
        <rect x="30" y="380" width="150" height="40" rx="10" fill="#000000" opacity="0.85"/>
        <text x="105" y="406" font-family="sans-serif" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle">YOUTUBE HD</text>
      </g>

      <!-- Video Category Tabs -->
      <g transform="translate(0, 570)">
        <rect x="0" y="0" width="130" height="52" rx="26" fill="#0284c7"/>
        <text x="65" y="33" font-family="sans-serif" font-size="18" font-weight="700" fill="#ffffff" text-anchor="middle">時事新聞</text>

        <rect x="145" y="0" width="130" height="52" rx="26" fill="#1e293b"/>
        <text x="210" y="33" font-family="sans-serif" font-size="18" font-weight="700" fill="#94a3b8" text-anchor="middle">科技趨勢</text>

        <rect x="290" y="0" width="130" height="52" rx="26" fill="#1e293b"/>
        <text x="355" y="33" font-family="sans-serif" font-size="18" font-weight="700" fill="#94a3b8" text-anchor="middle">商業金融</text>

        <rect x="435" y="0" width="130" height="52" rx="26" fill="#1e293b"/>
        <text x="500" y="33" font-family="sans-serif" font-size="18" font-weight="700" fill="#94a3b8" text-anchor="middle">文化藝術</text>
      </g>

      <!-- Active Bilingual Subtitle Box -->
      <g transform="translate(0, 660)">
        <rect x="0" y="0" width="808" height="340" rx="24" fill="#0f172a" stroke="#0284c7" stroke-width="2.5"/>
        <text x="40" y="60" font-family="sans-serif" font-size="20" font-weight="800" fill="#38bdf8">▶ 00:02:18 • Bloomberg Global Technology</text>
        <text x="40" y="130" font-family="sans-serif" font-size="28" font-weight="700" fill="#ffffff">Artificial intelligence is reshaping the entire</text>
        <text x="40" y="180" font-family="sans-serif" font-size="28" font-weight="700" fill="#ffffff">landscape of modern semiconductor design.</text>
        <text x="40" y="260" font-family="sans-serif" font-size="26" font-weight="600" fill="#93c5fd">• 人工智慧正在重塑現代半導體晶片設計的整體格局。</text>
      </g>

      <!-- Secondary Subtitle Box -->
      <g transform="translate(0, 1030)">
        <rect x="0" y="0" width="808" height="260" rx="24" fill="#111827" stroke="#1f2937" stroke-width="2"/>
        <text x="40" y="55" font-family="sans-serif" font-size="18" font-weight="700" fill="#64748b">00:02:26</text>
        <text x="40" y="115" font-family="sans-serif" font-size="24" font-weight="600" fill="#e2e8f0">Demand for high-bandwidth memory continues to rise.</text>
        <text x="40" y="185" font-family="sans-serif" font-size="22" font-weight="500" fill="#94a3b8">• 高頻寬記憶體（HBM）的市場需求亦持續攀升。</text>
      </g>
    `;
  } else if (type === 'subtitles') {
    return `
      <!-- Subtitle Highlight Stream -->
      <g transform="translate(0, 100)">
        <!-- Card 1 -->
        <rect x="0" y="0" width="808" height="280" rx="24" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
        <text x="40" y="55" font-family="sans-serif" font-size="20" font-weight="800" fill="#60a5fa">00:01:12 • YouTube 英語學習精選</text>
        <text x="40" y="120" font-family="sans-serif" font-size="28" font-weight="700" fill="#ffffff">Welcome to today's in-depth world report.</text>
        <text x="40" y="195" font-family="sans-serif" font-size="26" font-weight="600" fill="#93c5fd">• 歡迎收看今日全球時事專題深入報導。</text>
      </g>

      <g transform="translate(0, 410)">
        <!-- Card 2 Active Glowing -->
        <rect x="0" y="0" width="808" height="320" rx="24" fill="#1e1b4b" stroke="#818cf8" stroke-width="3"/>
        <text x="40" y="60" font-family="sans-serif" font-size="20" font-weight="800" fill="#a78bfa">00:01:28 • 逐句精準語意對齊</text>
        <text x="40" y="130" font-family="sans-serif" font-size="28" font-weight="700" fill="#ffffff">The international summit focused on renewable energy.</text>
        <text x="40" y="215" font-family="sans-serif" font-size="26" font-weight="600" fill="#c4b5fd">• 本屆國際高峰會聚焦於全球再生能源的長遠發展。</text>
      </g>

      <g transform="translate(0, 760)">
        <!-- Card 3 -->
        <rect x="0" y="0" width="808" height="280" rx="24" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
        <text x="40" y="55" font-family="sans-serif" font-size="20" font-weight="800" fill="#60a5fa">00:01:45 • 雙語逐字學習</text>
        <text x="40" y="120" font-family="sans-serif" font-size="28" font-weight="700" fill="#ffffff">Leaders reached unprecedented agreements on climate.</text>
        <text x="40" y="195" font-family="sans-serif" font-size="26" font-weight="600" fill="#93c5fd">• 各國領袖在氣候永續議題上達成了前所未有的共識。</text>
      </g>
    `;
  } else if (type === 'vocab') {
    return `
      <!-- Vocabulary Notebook UI -->
      <g transform="translate(0, 90)">
        <!-- Top Search & Stats -->
        <rect x="0" y="0" width="808" height="80" rx="20" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
        <text x="40" y="50" font-family="sans-serif" font-size="22" font-weight="600" fill="#94a3b8">🔍 搜尋已收藏的生字... (共 128 字)</text>

        <!-- Vocab Card 1 -->
        <g transform="translate(0, 110)">
          <rect x="0" y="0" width="808" height="320" rx="24" fill="#064e3b" stroke="#10b981" stroke-width="2.5"/>
          <text x="40" y="65" font-family="sans-serif" font-size="34" font-weight="900" fill="#ffffff">semiconductor</text>
          <text x="320" y="65" font-family="sans-serif" font-size="20" font-weight="600" fill="#a7f3d0">/ˌsem.i.kənˈdʌk.tɚ/</text>
          <rect x="680" y="28" width="85" height="46" rx="23" fill="#10b981"/>
          <text x="722" y="58" font-family="sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle">🔊</text>

          <text x="40" y="130" font-family="sans-serif" font-size="24" font-weight="700" fill="#6ee7b7">n. 半導體 • CEFR B2</text>
          <text x="40" y="195" font-family="sans-serif" font-size="22" font-weight="600" fill="#ecfdf5">"The factory produces cutting-edge semiconductors."</text>
          <text x="40" y="245" font-family="sans-serif" font-size="21" font-weight="500" fill="#a7f3d0">• 這座晶圓廠專門生產頂尖的前瞻半導體晶片。</text>
        </g>

        <!-- Vocab Card 2 -->
        <g transform="translate(0, 460)">
          <rect x="0" y="0" width="808" height="300" rx="24" fill="#1e293b" stroke="#334155" stroke-width="2"/>
          <text x="40" y="65" font-family="sans-serif" font-size="34" font-weight="900" fill="#ffffff">unprecedented</text>
          <text x="330" y="65" font-family="sans-serif" font-size="20" font-weight="600" fill="#94a3b8">/ʌnˈpres.ə.den.t̬ɪd/</text>
          <text x="40" y="130" font-family="sans-serif" font-size="24" font-weight="700" fill="#38bdf8">adj. 史無前例的 • CEFR C1</text>
          <text x="40" y="195" font-family="sans-serif" font-size="22" font-weight="600" fill="#e2e8f0">"The policy achieved unprecedented economic growth."</text>
          <text x="40" y="240" font-family="sans-serif" font-size="21" font-weight="500" fill="#94a3b8">• 該項政策促成了前所未有的經濟繁榮增長。</text>
        </g>
      </g>
    `;
  } else {
    // type === 'flashcard' (Replacing obsolete Radio)
    return `
      <!-- Flashcard Quiz UI & CEFR Leveling -->
      <g transform="translate(0, 80)">
        <!-- Top Stats Banner -->
        <rect x="0" y="0" width="808" height="110" rx="24" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
        <text x="40" y="50" font-family="sans-serif" font-size="26" font-weight="900" fill="#ffffff">🧠 單字翻卡記憶測驗</text>
        <text x="40" y="85" font-family="sans-serif" font-size="18" font-weight="600" fill="#fbbf24">今日目標進度：18 / 20 詞 • 掌握率 90%</text>
        <rect x="620" y="30" width="150" height="50" rx="25" fill="#f59e0b"/>
        <text x="695" y="62" font-family="sans-serif" font-size="20" font-weight="800" fill="#000000" text-anchor="middle">隨機抽測</text>

        <!-- Main Flashcard -->
        <g transform="translate(0, 140)">
          <rect x="0" y="0" width="808" height="520" rx="32" fill="#0f172a" stroke="#0284c7" stroke-width="3"/>
          
          <!-- CEFR Level Badge -->
          <rect x="40" y="40" width="130" height="42" rx="21" fill="#0284c7"/>
          <text x="105" y="68" font-family="sans-serif" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle">CEFR B2</text>

          <text x="404" y="200" font-family="sans-serif" font-size="54" font-weight="900" fill="#ffffff" text-anchor="middle">semiconductor</text>
          <text x="404" y="260" font-family="sans-serif" font-size="26" font-weight="600" fill="#93c5fd" text-anchor="middle">/ˌsem.i.kənˈdʌk.tɚ/</text>

          <!-- Flip Card Hint -->
          <rect x="254" y="320" width="300" height="56" rx="28" fill="#1e293b" stroke="#334155" stroke-width="2"/>
          <text x="404" y="356" font-family="sans-serif" font-size="20" font-weight="700" fill="#38bdf8" text-anchor="middle">🔄 點擊卡片翻轉查看釋義</text>

          <!-- Action Buttons -->
          <g transform="translate(40, 420)">
            <rect x="0" y="0" width="340" height="66" rx="20" fill="#1e293b" stroke="#ef4444" stroke-width="2"/>
            <text x="170" y="42" font-family="sans-serif" font-size="22" font-weight="800" fill="#f87171" text-anchor="middle">✕ 還需複習</text>

            <rect x="388" y="0" width="340" height="66" rx="20" fill="#064e3b" stroke="#10b981" stroke-width="2"/>
            <text x="558" y="42" font-family="sans-serif" font-size="22" font-weight="800" fill="#34d399" text-anchor="middle">✓ 已經熟記</text>
          </g>
        </g>

        <!-- CEFR Difficulty Scale Palette -->
        <g transform="translate(0, 690)">
          <rect x="0" y="0" width="808" height="150" rx="24" fill="#111827" stroke="#1f2937" stroke-width="2"/>
          <text x="40" y="48" font-family="sans-serif" font-size="20" font-weight="800" fill="#94a3b8">CEFR 難度分級色彩標籤：</text>
          <g transform="translate(40, 75)">
            <rect x="0" y="0" width="105" height="42" rx="12" fill="#22c55e" opacity="0.2"/>
            <text x="52" y="27" font-family="sans-serif" font-size="16" font-weight="800" fill="#4ade80" text-anchor="middle">A1 初級</text>

            <rect x="125" y="0" width="105" height="42" rx="12" fill="#3b82f6" opacity="0.2"/>
            <text x="177" y="27" font-family="sans-serif" font-size="16" font-weight="800" fill="#60a5fa" text-anchor="middle">A2 基礎</text>

            <rect x="250" y="0" width="105" height="42" rx="12" fill="#06b6d4" opacity="0.2"/>
            <text x="302" y="27" font-family="sans-serif" font-size="16" font-weight="800" fill="#22d3ee" text-anchor="middle">B1 中級</text>

            <rect x="375" y="0" width="105" height="42" rx="12" fill="#eab308" opacity="0.2"/>
            <text x="427" y="27" font-family="sans-serif" font-size="16" font-weight="800" fill="#facc15" text-anchor="middle">B2 中高</text>

            <rect x="500" y="0" width="105" height="42" rx="12" fill="#f97316" opacity="0.2"/>
            <text x="552" y="27" font-family="sans-serif" font-size="16" font-weight="800" fill="#fb923c" text-anchor="middle">C1 高級</text>

            <rect x="625" y="0" width="105" height="42" rx="12" fill="#ec4899" opacity="0.2"/>
            <text x="677" y="27" font-family="sans-serif" font-size="16" font-weight="800" fill="#f472b6" text-anchor="middle">C2 精通</text>
          </g>
        </g>
      </g>
    `;
  }
}

async function run() {
  console.log('Generating Modern Google Play Store Assets (Pure Video & Vocab Learning)...');
  await generateAppIcon();
  await generateFeatureGraphic();
  await generatePhoneScreenshots();
  console.log('All Modern Store Assets Generated Successfully in public/store-assets/ !');
}

run().catch(console.error);
