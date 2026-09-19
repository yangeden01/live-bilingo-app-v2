/**
 * Semantic Broadcast Graph & Context Disambiguation Engine
 * 廣播語意圖譜與上下文特徵消歧引擎（零 Token、零模型負擔、高精度在地化翻譯）
 * 
 * 核心原理：
 * 1. 自動領域分類器 (Domain Classifier)：毫秒級判別交通路況 (TRAFFIC)、財經股市 (FINANCE)、天氣氣象 (WEATHER)、政治時事 (NEWS_POLITICS) 或通用廣播。
 * 2. 跨語境歧義消解 (Polysemy Disambiguation)：自動根據領域將容易誤翻的一詞多義（如 solid, stall, semi, deck, yield, bear 等）預先消歧。
 * 3. 龐大美語廣播與都會專有詞庫 (Semantic Knowledge Graph)：全美各大都會公路、橋樑、交會點、交通術語與口語成語在地化轉換。
 */

export type BroadcastDomain = 'TRAFFIC' | 'FINANCE' | 'WEATHER' | 'NEWS_POLITICS' | 'GENERAL';

/**
 * 1. 領域分類器：極速統計關鍵詞特徵，判別當前語境領域
 */
export function detectBroadcastDomain(text: string): BroadcastDomain {
  const clean = text.toLowerCase();

  let trafficScore = 0;
  let financeScore = 0;
  let weatherScore = 0;
  let newsScore = 0;

  // Traffic cues
  if (/\b(traffic|commute|freeway|highway|lane|lanes|eastbound|westbound|northbound|southbound|bridge|stall|stalled|semi|collision|crash|fender bender|backup|backed up|sigalert|chp|shoulder|interchange|exit|maze|toll|deck|detour|delay|rush hour|hov|carpool|gridlock|slow down|speed limit|roadwork|off-ramp|on-ramp)\b/i.test(clean)) {
    trafficScore += 3;
  }
  if (/\b(i-80|i-880|i-580|i-280|i-680|us-101|route\s+\d+|highway\s+\d+|bay bridge|golden gate|san mateo bridge|dumbarton|caldecott tunnel|treasure island)\b/i.test(clean)) {
    trafficScore += 4;
  }

  // Finance cues
  if (/\b(dow|nasdaq|s&p|wall street|stocks|shares|bond|bonds|yield|yields|inflation|treasury|fed|federal reserve|earnings|rally|bear market|bull market|quarterly|revenue|interest rate|cpi|gdp|deficit|debt|hedge fund|sec|dividend|bankruptcy)\b/i.test(clean)) {
    financeScore += 3;
  }

  // Weather cues
  if (/\b(degrees|fahrenheit|celsius|temperature|rainfall|shower|showers|storm|hurricane|gust|gusts|wind|winds|breeze|overcast|sunny|humidity|meteorologist|weather service|heat wave|frost|blizzard|front|atmospheric river)\b/i.test(clean)) {
    weatherScore += 3;
  }

  // News / Politics cues
  if (/\b(president|white house|congress|senate|house of representatives|capitol|hearing|bill|legislation|vote|ballot|election|supreme court|justice|lawsuit|judge|prosecutor|indictment|probe|gop|democrat|republican|foreign minister|summit|diplomat|briefing)\b/i.test(clean)) {
    newsScore += 3;
  }

  const maxScore = Math.max(trafficScore, financeScore, weatherScore, newsScore);
  if (maxScore < 2) return 'GENERAL';
  if (trafficScore === maxScore) return 'TRAFFIC';
  if (financeScore === maxScore) return 'FINANCE';
  if (weatherScore === maxScore) return 'WEATHER';
  if (newsScore === maxScore) return 'NEWS_POLITICS';
  return 'GENERAL';
}

/**
 * 2. 廣播即時成語與常用句型字典（0ms 秒查）
 */
const PHRASE_DICTIONARY: { enPattern: RegExp; exactZh: string }[] = [
  // Traffic & Commute Idioms (路況與通勤專有名詞)
  { enPattern: /\btraffic\s+(?:is|was|are|were)\s+already\s+solid\b/gi, exactZh: '車流早已整路塞滿（嚴重壅塞）' },
  { enPattern: /\btraffic\s+(?:is|was|are|were)\s+solid\b/gi, exactZh: '車流密實壅塞、整路塞滿' },
  { enPattern: /\bsolid\s+traffic\b/gi, exactZh: '密實壅塞的車流' },
  { enPattern: /\bthe\s+commute\s+was\s+already\s+stop\s+and\s+go\b/gi, exactZh: '通勤車流早已走走停停（車多壅塞）' },
  { enPattern: /\b(is|was|are|were)\s+stop\s+and\s+go\b/gi, exactZh: '走走停停、車多壅塞' },
  { enPattern: /\bstop\s+and\s+go\s+traffic\b/gi, exactZh: '走走停停的壅塞車流' },
  { enPattern: /\bstop\s+and\s+go\b/gi, exactZh: '走走停停（車多壅塞）' },
  { enPattern: /\bbumper\s+to\s+bumper\b/gi, exactZh: '大排長龍（車輛緊貼）' },
  { enPattern: /\bhit\s+and\s+run\b/gi, exactZh: '肇事逃逸' },
  { enPattern: /\bstalled\s+semi\b/gi, exactZh: '故障拋錨的聯結大貨車' },
  { enPattern: /\ba\s+stalled\s+semi\b/gi, exactZh: '一輛故障拋錨的聯結大貨車' },
  { enPattern: /\ba\s+stall\s+in\s+([A-Za-z\s]+)\b/gi, exactZh: '$1 發生車輛拋錨故障' },
  { enPattern: /\ba\s+stall\s+blocking\b/gi, exactZh: '故障拋錨車佔據' },
  { enPattern: /\bblocking\s+the\s+number\s+(\w+)\s+lane\b/gi, exactZh: '佔據第 $1 車道' },
  { enPattern: /\bnumber\s+two\s+lane\b/gi, exactZh: '第二車道（中線車道）' },
  { enPattern: /\btraffic\s+backed\s+up\s+to\b/gi, exactZh: '車流回堵至' },
  { enPattern: /\bbacked\s+up\s+to\b/gi, exactZh: '回堵至' },
  { enPattern: /\bfor\s+the\s+lower\s+deck\b/gi, exactZh: '在海灣大橋下層橋面' },
  { enPattern: /\blower\s+deck\b/gi, exactZh: '海灣大橋下層橋面' },
  { enPattern: /\beastbound\s+eighty\b/gi, exactZh: '80 號州際公路東向（I-80 East）' },
  { enPattern: /\bwestbound\s+eighty\b/gi, exactZh: '80 號州際公路西向（I-80 West）' },
  { enPattern: /\bTreasure\s+Island\b/gi, exactZh: '金銀島（Treasure Island）' },
  { enPattern: /\bbridge\s+crews\s+are\s+underway\b/gi, exactZh: '大橋工程巡邏與搶修隊已在途中趕往處理' },
  { enPattern: /\bcrews\s+are\s+underway\b/gi, exactZh: '搶修隊伍已在途中趕往處理' },
  { enPattern: /\bNimitz\s+880\b/gi, exactZh: '尼米茲 880 號高速公路（I-880）' },
  { enPattern: /\bthe\s+Nimitz\s+880\s+southbound\b/gi, exactZh: '尼米茲 880 號公路南向' },
  { enPattern: /\bThornton\s+Avenue\b/gi, exactZh: '桑頓大道（Thornton Ave）' },
  { enPattern: /\bDakota\s+Road\b/gi, exactZh: '達科他路（Dakota Rd）' },
  { enPattern: /\bmoved\s+over\s+to\s+the\s+shoulder\s+with\s+CHP\b/gi, exactZh: '已移至路肩，加州公路巡警（CHP）已在場處理' },
  { enPattern: /\bmoved\s+over\s+to\s+the\s+shoulder\b/gi, exactZh: '已移至路邊路肩' },
  { enPattern: /\bto\s+the\s+shoulder\b/gi, exactZh: '至路肩' },
  { enPattern: /\bon\s+the\s+shoulder\b/gi, exactZh: '在路肩' },
  { enPattern: /\bthe\s+shoulder\b/gi, exactZh: '路肩' },
  { enPattern: /\bCHP\b/g, exactZh: '加州公路巡警（CHP）' },
  { enPattern: /\bthe\s+maze\b/gi, exactZh: '麥克阿瑟立交樞紐（The Maze 交流道系統）' },
  { enPattern: /\bMacArthur\s+Maze\b/gi, exactZh: '麥克阿瑟立交樞紐（MacArthur Maze）' },
  { enPattern: /\beast\s+bound\b/gi, exactZh: '東向' },
  { enPattern: /\beastbound\b/gi, exactZh: '東向（往東車道）' },
  { enPattern: /\bwestbound\b/gi, exactZh: '西向（往西車道）' },
  { enPattern: /\bnorthbound\b/gi, exactZh: '北向（往北車道）' },
  { enPattern: /\bsouthbound\b/gi, exactZh: '南向（往南車道）' },
  { enPattern: /\bWarren\s+Freeway\b/gi, exactZh: '沃倫高速公路（Warren Freeway）' },
  { enPattern: /\bHighway\s+13\b/gi, exactZh: '13 號公路' },
  { enPattern: /\bOakland\s+580\s+East\b/gi, exactZh: '奧克蘭 580 號公路東向' },
  { enPattern: /\b580\s+East\b/gi, exactZh: '580 號州際公路東向' },
  { enPattern: /\bfive\s+eighty\b/gi, exactZh: '580 號公路' },
  { enPattern: /\b1st\s+Street\b/gi, exactZh: '第一街（1st St）' },
  { enPattern: /\bfirst\s+street\b/gi, exactZh: '第一街（1st St）' },
  { enPattern: /\bfender\s+bender\b/gi, exactZh: '輕微車輛擦撞' },
  { enPattern: /\bgridlock\b/gi, exactZh: '交通大打結（嚴重回堵）' },
  { enPattern: /\brubbernecking\b/gi, exactZh: '駕駛慢速張望導致車流回堵' },
  { enPattern: /\bcarpool\s+lane\b/gi, exactZh: '高乘載車道（HOV）' },
  { enPattern: /\bHOV\s+lane\b/gi, exactZh: '高乘載車道（HOV）' },
  { enPattern: /\bstalled\s+vehicle\b/gi, exactZh: '故障拋錨車輛' },
  { enPattern: /\bdisabled\s+vehicle\b/gi, exactZh: '拋錨車輛' },
  { enPattern: /\bSigAlert\b/gi, exactZh: '加州重大交通警報（SigAlert）' },

  // News & Broadcaster Terms (新聞與電台專有名詞)
  { enPattern: /\bfor\s+(?:Kid\s+QED|Kid\s+Q\s+ED|KQED)\b/gi, exactZh: '為 KQED 舊金山公共電台報導' },
  { enPattern: /\b(?:Kid\s+QED|Kid\s+Q\s+ED)\b/gi, exactZh: 'KQED 舊金山公共廣播電台' },
  { enPattern: /\bKQED\b/g, exactZh: 'KQED 舊金山公共廣播電台' },
  { enPattern: /\bNHPR\b/g, exactZh: 'NHPR 新罕布夏公共廣播電台' },
  { enPattern: /\bWBEZ\b/g, exactZh: 'WBEZ 芝加哥公共廣播電台' },
  { enPattern: /\bWNYC\b/g, exactZh: 'WNYC 紐約公共廣播電台' },
  { enPattern: /\bWBUR\b/g, exactZh: 'WBUR 波士頓公共廣播電台' },
  { enPattern: /\bNPR\s+Business\b/gi, exactZh: 'NPR 全美商業財經新聞' },
  { enPattern: /\bNPR\s+News\b/gi, exactZh: 'NPR 全美新聞' },
  { enPattern: /\bBBC\s+World\s+Service\b/gi, exactZh: 'BBC 國際廣播電台' },
  { enPattern: /\bAll\s+Things\s+Considered\b/gi, exactZh: '《萬事皆論》（NPR 旗艦新聞節目）' },
  { enPattern: /\bMorning\s+Edition\b/gi, exactZh: '《晨間版》（NPR 晨間新聞旗艦）' },
  { enPattern: /\bMarketplace\b/gi, exactZh: '《市場時事》（APM 旗艦商業節目）' },
  { enPattern: /\bTupperware\b/gi, exactZh: '特百惠（Tupperware 保鮮容器）' },
  { enPattern: /\bscience\s+of\s+reading\b/gi, exactZh: '閱讀科學研究（The Science of Reading）' },
  { enPattern: /\bscienceofreading\b/gi, exactZh: '閱讀科學研究' },
  { enPattern: /\breshaping\s+how\s+kids\s+learn\b/gi, exactZh: '正在重塑孩童的學習模式' },
  { enPattern: /\bStanford\s+Graduate\s+School\s+of\s+Education\b/gi, exactZh: '史丹佛大學教育研究所' },
  { enPattern: /\bStanford\s+University\b/gi, exactZh: '史丹佛大學（Stanford University）' },
  { enPattern: /\bstanford\.edu\b/gi, exactZh: '史丹佛大學官方網站（stanford.edu）' },
  { enPattern: /\bstay\s+tuned\b/gi, exactZh: '請持續鎖定收聽' },
  { enPattern: /\btop\s+of\s+the\s+hour\b/gi, exactZh: '整點新聞播報' },
  { enPattern: /\bon\s+the\s+hour\b/gi, exactZh: '整點' },
  { enPattern: /\bbreaking\s+news\b/gi, exactZh: '即時突發新聞' },
  { enPattern: /\bpress\s+briefing\b/gi, exactZh: '媒體簡報會' },
  { enPattern: /\blivestream\b/gi, exactZh: '線上即時廣播串流' },
  { enPattern: /\blive\s+stream\b/gi, exactZh: '即時廣播串流' },

  // Finance & Economics (財經股市與聯準會專有名詞)
  { enPattern: /\bthe\s+Federal\s+Reserve\b/gi, exactZh: '美國聯準會（Fed）' },
  { enPattern: /\bthe\s+Fed\b/g, exactZh: '美國聯準會（Fed）' },
  { enPattern: /\brate\s+hike\b/gi, exactZh: '升息' },
  { enPattern: /\brate\s+cut\b/gi, exactZh: '降息' },
  { enPattern: /\binterest\s+rate\s+hikes?\b/gi, exactZh: '調升利率（升息）' },
  { enPattern: /\binterest\s+rate\s+cuts?\b/gi, exactZh: '調降利率（降息）' },
  { enPattern: /\bbond\s+yields?\b/gi, exactZh: '公債殖利率' },
  { enPattern: /\bTreasury\s+yields?\b/gi, exactZh: '美國國債殖利率' },
  { enPattern: /\bTreasury\s+bonds?\b/gi, exactZh: '美國財政部公債' },
  { enPattern: /\bWall\s+Street\s+rally\b/gi, exactZh: '華爾街股市大漲反彈' },
  { enPattern: /\bbear\s+market\b/gi, exactZh: '空頭熊市' },
  { enPattern: /\bbull\s+market\b/gi, exactZh: '多頭牛市' },
  { enPattern: /\bhawkish\b/gi, exactZh: '鷹派（偏好緊縮/升息）' },
  { enPattern: /\bdovish\b/gi, exactZh: '鴿派（偏好寬鬆/降息）' },

  { enPattern: /\breading\s+back\b/gi, exactZh: '回顧以往 / 仔細回想過往' },
  { enPattern: /\band\s+reading\s+back\b/gi, exactZh: '而且回顧過往紀錄' },
  { enPattern: /\bkinda\s+known\s+as\b/gi, exactZh: '被普遍認為是' },
  { enPattern: /\byou\s+were\s+kinda\s+known\s+as\b/gi, exactZh: '你在大家眼中一直被視為' },
  { enPattern: /\byou\s+were\s+known\s+as\b/gi, exactZh: '你曾被稱為' },
  { enPattern: /\bkinda\s+like\b/gi, exactZh: '有點像是' },
  { enPattern: /\bkind\s+of\s+like\b/gi, exactZh: '有點類似' },
  { enPattern: /\btalk\s+(?:them|someone|him|her|us)\s+off\s+the\s+(?:existential\s+)?cliff\s+edge\b/gi, exactZh: '勸阻並化解面臨的重大危機' },
  { enPattern: /\boff\s+the\s+cliff\s+edge\b/gi, exactZh: '脫離懸崖絕境' },
  { enPattern: /\bcliff\s+edge\b/gi, exactZh: '懸崖邊緣（險境）' },
  { enPattern: /\bball\s+is\s+in\s+your\s+court\b/gi, exactZh: '決定權現在在你手上' },
  { enPattern: /\bunder\s+the\s+weather\b/gi, exactZh: '身體微恙不舒服' },
  { enPattern: /\bcost\s+an\s+arm\s+and\s+a\s+leg\b/gi, exactZh: '造價極其昂貴' },
  { enPattern: /\bsee\s+eye\s+to\s+eye\b/gi, exactZh: '看法一致 / 達成共識' },
  { enPattern: /\bpiece\s+of\s+cake\b/gi, exactZh: '輕而易舉（易如反掌）' },
  { enPattern: /\bspill\s+the\s+beans\b/gi, exactZh: '洩漏消息 / 全盤托出' },
  { enPattern: /\bsilver\s+lining\b/gi, exactZh: '困境中的一線希望' },
  { enPattern: /\belephant\s+in\s+the\s+room\b/gi, exactZh: '顯而易見卻被刻意忽視的根本問題' },
  { enPattern: /\bbite\s+the\s+bullet\b/gi, exactZh: '咬緊牙關勇敢面對' },
  { enPattern: /\bcall\s+it\s+a\s+day\b/gi, exactZh: '今天的工作到此結束' },
  { enPattern: /\bat\s+the\s+end\s+of\s+the\s+day\b/gi, exactZh: '歸根結底 / 說到底' },
  { enPattern: /\bin\s+the\s+loop\b/gi, exactZh: '掌握最新進度與消息' },
  { enPattern: /\btouch\s+base\b/gi, exactZh: '簡短聯繫同步情況' },
  { enPattern: /\bgame\s+changer\b/gi, exactZh: '顛覆全局的重大變革' },
  { enPattern: /\bacross\s+the\s+board\b/gi, exactZh: '全面性 / 普遍' },
  { enPattern: /\bthink\s+outside\s+the\s+box\b/gi, exactZh: '跳脫框架思考' },
  { enPattern: /\btake\s+with\s+a\s+grain\s+of\s+salt\b/gi, exactZh: '持保留態度 / 審慎看待' },
  { enPattern: /\bback\s+to\s+the\s+drawing\s+board\b/gi, exactZh: '重起爐灶重新規劃' },
  { enPattern: /\bhit\s+the\s+ground\s+running\b/gi, exactZh: '迅速展開全力行動' },
  { enPattern: /\bup\s+in\s+the\s+air\b/gi, exactZh: '懸而未決尚未定案' },
  { enPattern: /\bbring\s+to\s+the\s+table\b/gi, exactZh: '提出具體貢獻與方案' },
];

/**
 * 3. 英文翻譯前特徵預消歧（Pre-processing Heuristics）
 * 消除同音詞與歧義詞，引導翻譯引擎直出正確意思
 */
export function preprocessEnglishForTranslation(englishText: string): string {
  let text = englishText;

  // 1. 語音辨識常見同音錯誤修復
  text = text.replace(/\bKid\s+QED\b/gi, 'KQED');
  text = text.replace(/\bKid\s+Q\s+ED\b/gi, 'KQED');
  text = text.replace(/\bN\s+P\s+R\b/gi, 'NPR');
  text = text.replace(/\bB\s+B\s+C\b/gi, 'BBC');

  // 2. 口語填充詞與語氣停頓清理（避免直譯成「就像、你知道、有點」等生硬碎詞）
  text = text
    .replace(/,\s*(?:like|you\s+know|I\s+mean|kinda|sorta)\s*,/gi, ',')
    .replace(/\b(?:you\s+know|I\s+mean)\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+/g, ' ');

  // 3. 特殊美語口語成語消歧引導
  text = text.replace(/\band\s+reading\s+back\b/gi, 'and looking back on the record');
  text = text.replace(/\breading\s+back\b/gi, 'looking back on the record');
  text = text.replace(/\byou\s+were\s+kinda\s+known\s+as\b/gi, 'you were widely known as');
  text = text.replace(/\bkinda\s+known\s+as\b/gi, 'widely regarded as');

  const domain = detectBroadcastDomain(text);

  // 2. 依領域進行預消歧
  if (domain === 'TRAFFIC') {
    // 預先強化路況語意提示，避免 NMT 直譯成非交通意思
    text = text.replace(/\bthe\s+lower\s+deck\b/gi, 'the lower bridge deck');
    text = text.replace(/\bnumber\s+two\s+lane\b/gi, 'second traffic lane');
    text = text.replace(/\ba\s+stalled\s+semi\b/gi, 'a stalled semi truck');
    text = text.replace(/\beastbound\s+eighty\b/gi, 'eastbound Interstate 80');
    text = text.replace(/\bwestbound\s+eighty\b/gi, 'westbound Interstate 80');
    text = text.replace(/\bMacArthur\s+Maze\b/gi, 'MacArthur Maze highway interchange');
  } else if (domain === 'FINANCE') {
    text = text.replace(/\bthe\s+Fed\b/g, 'the Federal Reserve');
    text = text.replace(/\bTreasury\s+yields?\b/gi, 'US Treasury bond yields');
  }

  return text;
}

/**
 * 4. 中文後處理修正表（Post-processing Regex Rules）
 */
const POST_CORRECTIONS: [RegExp, string][] = [
  // 修正「通勤已經停止」等誤譯
  [/通勤已經停止/g, '通勤車流已經走走停停（車多壅塞）'],
  [/通勤停止/g, '通勤車多壅塞'],
  [/停止並前進/g, '走走停停（車多壅塞）'],
  [/停止和前進/g, '走走停停（車多壅塞）'],
  [/停停走走/g, '走走停停'],
  // 交通 solid 誤譯為暢通修正
  [/交通就已經暢通無阻/g, '車流早已整路塞滿（嚴重壅塞）'],
  [/交通已經暢通無阻/g, '車流已經整路塞滿（嚴重壅塞）'],
  [/已經暢通無阻/g, '早已整路塞滿（嚴重壅塞）'],
  [/交通暢通無阻/g, '車流密實壅塞'],
  [/暢通無阻/g, '整路塞滿（車多壅塞）'],
  // 交通 stall 誤譯為停車位/攤位修正
  [/一個攤位/g, '一輛故障拋錨車'],
  [/設有停車位/g, '發生車輛拋錨故障'],
  [/設有停車/g, '發生故障拋錨'],
  [/有停車位/g, '有故障車輛拋錨'],
  [/停車位/g, '拋錨故障車'],
  [/一個車輛拋錨故障/g, '一輛故障拋錨車'],
  // 聯結車 semi 誤譯為半拖車修正
  [/一輛半拖車/g, '一輛故障的半聯結大貨車'],
  [/半拖車/g, '半聯結大貨車'],
  // 電台名稱 KQED / Kid QED 修正
  [/為《Kid QED》拍攝/g, '為 KQED 舊金山公共電台報導'],
  [/為《Kid QED》/g, '為 KQED 舊金山公共電台'],
  [/為 Kid QED/g, '為 KQED 舊金山公共電台'],
  [/Kid QED/g, 'KQED 舊金山公共廣播電台'],
  // 橋面 deck 與公路 80 修正
  [/下層甲板/g, '海灣大橋下層橋面'],
  [/下層面板/g, '海灣大橋下層橋面'],
  [/向東行駛八十米/g, '80 號州際公路東向（I-80 East）'],
  [/向東行駛\s*80/g, '80 號公路東向'],
  [/向東行駛\s*八十/g, '80 號公路東向'],
  [/東向\s*80/g, '80 號州際公路東向'],
  [/金銀島/g, '金銀島（Treasure Island）'],
  [/橋樑工作人員正在進行中/g, '大橋搶修隊伍已在趕往途中處理'],
  [/橋樑人員正在進行中/g, '大橋維修隊伍已在途中處理'],
  [/正在進行中/g, '正在趕往途中處置'],
  [/第二車道/g, '第二線車道（中線車道）'],
  [/從迷宮前往/g, '從麥克阿瑟立交樞紐（The Maze）前往'],
  [/從迷宮/g, '從麥克阿瑟立交樞紐（The Maze）'],
  [/在迷宮/g, '在麥克阿瑟立交樞紐'],
  [/進入迷宮/g, '進入麥克阿瑟立交樞紐'],
  [/CHP\s*路邊/g, '加州公路巡警（CHP）路肩'],
  [/與\s*CHP\s*路邊/g, '移至路肩（CHP 警方在場）'],
  [/移至\s*CHP\s*路邊/g, '移至路肩（加州公路巡警已在場）'],
  [/移至路邊與\s*CHP/g, '移至路肩，加州公路巡警（CHP）在場處理'],
  [/特百惠作為狗餵食盤/g, '特百惠（Tupperware 保鮮盒）作為餵狗的餐盤'],
  [/特百惠作爲狗餵食盤/g, '特百惠（Tupperware 保鮮盒）作為餵狗的餐盤'],
  [/沃倫高速公路前沿奧克蘭\s*580\s*East\s*方向/g, '沃倫高速公路（Warren Fwy）前，奧克蘭 580 號公路東向'],
  [/580\s*East\s*方向/g, '580 號州際公路東向'],
  [/從\s*1st\s*Street\s*出發/g, '從第一街（1st St）路段起'],
  [/從\s*1st\s*Street/g, '從第一街（1st St）'],
  [/在\s*1st\s*Street/g, '在第一街（1st St）'],
  [/存在主義的懸崖邊緣/g, '面臨的重大懸崖絕境'],
  [/存在主義懸崖邊緣/g, '重大危機絕境'],
  [/在\s*05:29\s*再次更新/g, '將於 05:29 進行下一次即時路況更新'],
  [/將於\s*(\d{1,2}:\d{2})\s*再次更新/g, '將於 $1 為您播報最新路況更新'],
  [/將於\s*(\d{1,2}:\d{2})\s*再次播出/g, '將於 $1 播出下一節新聞'],
  // 修正訪談與口語常見硬譯（如「讀回來，你有比稱為這個，就像」）
  [/讀回來[，,]?/g, '回顧以往，'],
  [/你有比稱為/g, '你被普遍稱為'],
  [/你有被稱為/g, '你被普遍稱為'],
  [/被比稱為/g, '被普遍稱為'],
  [/稱為這個[，,]?\s*就像[，,]?/g, '被稱為此號人物，'],
  [/稱為這個/g, '被稱為這號人物'],
  [/，就像[，,]?$/g, '。'],
  [/，你知道[，,]?/g, '，'],
  [/，好比說[，,]?$/g, '。'],
];

/**
 * 5. 領域感知智慧中文潤飾核心（Domain-Aware Post-processor）
 */
export function postprocessChineseTranslation(zhText: string, originalEn: string): string {
  let refined = zhText;
  const lowerEn = originalEn.toLowerCase();
  const domain = detectBroadcastDomain(originalEn);

  // === 交通路況領域專屬消歧 ===
  if (domain === 'TRAFFIC' || lowerEn.includes('traffic') || lowerEn.includes('freeway') || lowerEn.includes('commute')) {
    // 1. solid -> 車流塞滿（非暢通、非固體）
    if (lowerEn.includes('solid')) {
      refined = refined.replace(/暢通無阻|順暢無阻|暢通|順暢|固體|堅固/g, '整路塞滿（車多壅塞）');
    }
    // 2. stall -> 車輛故障拋錨（非停車位、非攤位）
    if (lowerEn.includes('stall')) {
      refined = refined.replace(/設有停車位|停車位|一個攤位|攤位|失速|停頓/g, '車輛拋錨故障');
    }
    // 3. semi -> 半聯結大貨車
    if (lowerEn.includes('semi')) {
      refined = refined.replace(/一輛半拖車|半拖車|半個|一半/g, '一輛聯結大貨車');
    }
    // 4. deck -> 橋面
    if (lowerEn.includes('deck')) {
      refined = refined.replace(/甲板|面板/g, '橋面');
    }
    // 5. shoulder -> 路肩（非肩膀）
    if (lowerEn.includes('shoulder')) {
      refined = refined.replace(/肩膀/g, '路肩');
    }
    // 6. lane -> 車道（非小巷）
    if (lowerEn.includes('lane')) {
      refined = refined.replace(/小巷|小路/g, '車道');
    }
    // 7. ramp -> 匝道（非坡道）
    if (lowerEn.includes('ramp')) {
      refined = refined.replace(/坡道/g, '匝道');
    }
    // 8. crawl -> 龜速行駛（非爬行）
    if (lowerEn.includes('crawl')) {
      refined = refined.replace(/爬行/g, '龜速行駛');
    }
    // 9. backed up -> 回堵
    if (lowerEn.includes('backed up') || lowerEn.includes('back up')) {
      refined = refined.replace(/備份|後退/g, '車流回堵');
    }
  }

  // === 財經股市領域專屬消歧 ===
  if (domain === 'FINANCE' || lowerEn.includes('yield') || lowerEn.includes('fed') || lowerEn.includes('stocks')) {
    // 1. yield -> 殖利率 / 收益率（非屈服、非讓路）
    if (lowerEn.includes('yield')) {
      refined = refined.replace(/收益屈服率|屈服率|屈服|讓步/g, '殖利率');
    }
    // 2. Fed -> 聯準會（非餵食）
    if (lowerEn.includes('fed')) {
      refined = refined.replace(/餵食|已餵/g, '聯準會');
    }
    // 3. bear / bull -> 空頭熊市 / 多頭牛市（非動物）
    if (lowerEn.includes('bear market')) {
      refined = refined.replace(/熊市市場|熊市/g, '空頭熊市');
    }
    if (lowerEn.includes('bull market')) {
      refined = refined.replace(/牛市市場|牛市/g, '多頭牛市');
    }
    // 4. rally -> 股市反彈大漲（非拉力賽）
    if (lowerEn.includes('rally')) {
      refined = refined.replace(/集會|拉力賽/g, '大漲反彈');
    }
    // 5. shares -> 股票/股份（非分享）
    if (lowerEn.includes('shares')) {
      refined = refined.replace(/分享/g, '股票');
    }
  }

  // === 天氣氣象領域專屬消歧 ===
  if (domain === 'WEATHER' || lowerEn.includes('forecast') || lowerEn.includes('shower') || lowerEn.includes('degrees')) {
    // 1. shower -> 陣雨（非淋浴）
    if (lowerEn.includes('shower')) {
      refined = refined.replace(/淋浴|洗澡/g, '短暫陣雨');
    }
    // 2. front -> 鋒面（非前面）
    if (lowerEn.includes('front')) {
      refined = refined.replace(/前門|前面/g, '天氣鋒面');
    }
  }

  // === 常用廣播慣用語通用修正 ===
  if (lowerEn.includes('stop and go') && (refined.includes('停止') && !refined.includes('走走停停'))) {
    refined = refined.replace(/停止/g, '走走停停（車多壅塞）');
  }

  if (lowerEn.includes('maze') && refined.includes('迷宮')) {
    refined = refined.replace(/迷宮/g, '麥克阿瑟立交樞紐（The Maze）');
  }

  if (lowerEn.includes('hit and run') && !refined.includes('肇事逃逸')) {
    refined = refined.replace(/撞了就跑|撞車逃跑/g, '肇事逃逸');
  }

  if (lowerEn.includes('chp') && !refined.includes('加州公路巡警')) {
    refined = refined.replace(/\bCHP\b/g, '加州公路巡警（CHP）');
  }

  // 套用全域正則修正常數
  for (const [regex, replacement] of POST_CORRECTIONS) {
    refined = refined.replace(regex, replacement);
  }

  return refined.trim();
}

/**
 * 6. 秒級精準片語比對
 */
export function matchExactPhrase(englishText: string): string | null {
  const clean = englishText.trim();
  for (const entry of PHRASE_DICTIONARY) {
    if (entry.enPattern.test(clean)) {
      const matched = clean.replace(entry.enPattern, entry.exactZh);
      if (matched !== clean && matched.length > 0) {
        return matched;
      }
    }
  }
  return null;
}
