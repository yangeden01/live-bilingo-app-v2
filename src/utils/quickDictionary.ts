/**
 * Instant Offline-First Broadcast & English Vocabulary Engine
 * Provides <10ms instant word lookup, phonetic symbols, inflections, and Chinese definitions.
 */

export interface QuickWordEntry {
  word: string;
  phonetic: string;
  pos: string; // part of speech
  zh: string;
  def?: string;
  example?: string;
  exampleZh?: string;
}

export interface ContextualExample {
  sentence: string;
  translation: string;
}

// Built-in high-frequency English vocabulary index
const BUILTIN_DICT: Record<string, QuickWordEntry> = {
  // Common verbs & past tenses / gerunds
  'look': { word: 'look', phonetic: '/lʊk/', pos: 'v./n.', zh: '看、注視；看起來、顯得；外觀', def: 'To direct one\'s gaze toward someone or something.', example: 'Look at the traffic updates.', exampleZh: '看看最新的即時交通狀況。' },
  'looked': { word: 'looked', phonetic: '/lʊkt/', pos: 'v. (過去式)', zh: '看了、顯得、看起來（look 的過去式/過去分詞）', def: 'Past tense of look; directed gaze or appeared.', example: 'The commute looked very crowded.', exampleZh: '通勤路段看起來非常壅塞。' },
  'looking': { word: 'looking', phonetic: '/ˈlʊk.ɪŋ/', pos: 'v. (現在分詞)', zh: '正在看、尋找、指望', def: 'Present participle of look; searching or appearing.' },
  'see': { word: 'see', phonetic: '/siː/', pos: 'v.', zh: '看見、明白、理解、會面', def: 'To perceive with the eyes; understand.' },
  'saw': { word: 'saw', phonetic: '/sɔː/', pos: 'v. (過去式)', zh: '看見了（see 的過去式）', def: 'Past tense of see.' },
  'seen': { word: 'seen', phonetic: '/siːn/', pos: 'v. (過去分詞)', zh: '看過、被看見（see 的過去分詞）', def: 'Past participle of see.' },
  'go': { word: 'go', phonetic: '/ɡoʊ/', pos: 'v./n.', zh: '去、前進、運轉、進行', def: 'To move or travel from one place to another.' },
  'went': { word: 'went', phonetic: '/wɛnt/', pos: 'v. (過去式)', zh: '去了、前往了（go 的過去式）', def: 'Past tense of go.' },
  'gone': { word: 'gone', phonetic: '/ɡɔːn/', pos: 'v./adj.', zh: '離去了、消失的（go 的過去分詞）', def: 'Past participle of go; departed.' },
  'move': { word: 'move', phonetic: '/muːv/', pos: 'v./n.', zh: '移動、搬移、採取行動；步驟', def: 'To change position or cause to change position.' },
  'moved': { word: 'moved', phonetic: '/muːvd/', pos: 'v. (過去式)', zh: '移到了、感動了、搬遷（move 的過去式）', def: 'Past tense of move; changed position.', example: 'Two vehicles have been moved to the shoulder.', exampleZh: '兩輛車輛已移至路肩。' },
  'moving': { word: 'moving', phonetic: '/ˈmuː.vɪŋ/', pos: 'adj./v.', zh: '移動中的、感人的', def: 'In motion; provoking strong emotion.' },
  'stop': { word: 'stop', phonetic: '/stɑːp/', pos: 'v./n.', zh: '停止、中斷、站牌', def: 'To cease moving or operating.' },
  'stopped': { word: 'stopped', phonetic: '/stɑːpt/', pos: 'v. (過去式)', zh: '停下了、被阻止', def: 'Past tense of stop.' },
  'happen': { word: 'happen', phonetic: '/ˈhæp.ən/', pos: 'v.', zh: '發生、巧合', def: 'To take place or occur.' },
  'happened': { word: 'happened', phonetic: '/ˈhæp.ənd/', pos: 'v. (過去式)', zh: '發生了、產生了', def: 'Past tense of happen.' },
  'report': { word: 'report', phonetic: '/rɪˈpɔːrt/', pos: 'v./n.', zh: '報導、報告、傳達；新聞報導', def: 'An account given of a particular matter; to convey news.' },
  'reported': { word: 'reported', phonetic: '/rɪˈpɔːr.tɪd/', pos: 'v./adj.', zh: '據報導、已通報', def: 'Past tense of report.' },
  'reporting': { word: 'reporting', phonetic: '/rɪˈpɔːr.tɪŋ/', pos: 'n./v.', zh: '新聞採訪、即時報導', def: 'The activity of gathering and reporting news.' },

  // Broadcast & Traffic vocabulary
  'solid': { word: 'solid', phonetic: '/ˈsɑː.lɪd/', pos: 'adj. (交通/狀態)', zh: '（車流）密實壅塞、整路塞滿；堅固的、固體的', def: 'In traffic context: completely congested, bumper-to-bumper, continuous line of vehicles without gaps; firm and stable.', example: 'Traffic was already solid from 01:01.', exampleZh: '從一點零一分開始，車流就已經完全塞滿動彈不得。' },
  'stall': { word: 'stall', phonetic: '/stɔːl/', pos: 'n./v.', zh: '（車輛）拋錨故障、熄火；攤位', def: 'A vehicle breakdown or stoppage on the road; to stop running.', example: 'A stall blocking the middle lane.', exampleZh: '一輛拋錨車輛擋住了中間車道。' },
  'stalled': { word: 'stalled', phonetic: '/stɔːld/', pos: 'adj./v.', zh: '故障拋錨的、熄火停止的', def: 'Stopped moving due to mechanical failure or obstruction.', example: 'A stalled semi blocking the number two lane.', exampleZh: '一輛故障的大貨車擋住了二號車道。' },
  'semi': { word: 'semi', phonetic: '/ˈsem.aɪ/', pos: 'n.', zh: '半聯結大貨車、大型貨櫃拖車（semi-trailer truck）', def: 'A large transport vehicle consisting of a tractor and a semi-trailer.', example: 'A stalled semi blocking the freeway.', exampleZh: '一輛拋錨的大型拖車擋住了高速公路。' },
  'deck': { word: 'deck', phonetic: '/dek/', pos: 'n.', zh: '（橋樑）橋面、甲板、層面', def: 'A floor-like surface on a bridge or ship.', example: 'For the lower deck of the Bay Bridge.', exampleZh: '前往海灣大橋下層橋面的路段。' },
  'underway': { word: 'underway', phonetic: '/ˌʌn.dɚˈweɪ/', pos: 'adj.', zh: '進行中、已出發處置中、在途中', def: 'Having started and in progress; in motion.', example: 'Bridge crews are underway.', exampleZh: '大橋搶修工程團隊已經在途中處置。' },
  'crew': { word: 'crew', phonetic: '/kruː/', pos: 'n.', zh: '工作隊、搶修組、全體組員', def: 'A group of people working closely together.', example: 'Road and bridge maintenance crews.', exampleZh: '道路與橋樑養護工程隊。' },
  'crews': { word: 'crews', phonetic: '/kruːz/', pos: 'n. (複數)', zh: '工程搶修隊伍（複數）', def: 'Plural of crew; emergency response teams.' },
  'backed': { word: 'backed', phonetic: '/bækt/', pos: 'v./adj.', zh: '回堵、倒退、支持', def: 'Traffic backed up: vehicles queued in a long line.', example: 'Traffic backed up to Dakota Road.', exampleZh: '車流已經回堵至達科他路。' },
  'transit': { word: 'transit', phonetic: '/ˈtræn.zɪt/', pos: 'n./v.', zh: '大眾運輸、過境、運輸系統', def: 'The carrying of people or goods from one place to another.', example: 'Public transit systems in the Bay Area.', exampleZh: '舊金山灣區的大眾運輸系統。' },
  'commute': { word: 'commute', phonetic: '/kəˈmjuːt/', pos: 'v./n.', zh: '通勤、上下班往返；通勤路程', def: 'To travel some distance between home and place of work regularly.', example: 'The morning commute was very slow.', exampleZh: '今天早上的通勤車流十分緩慢。' },
  'traffic': { word: 'traffic', phonetic: '/ˈtræf.ɪk/', pos: 'n.', zh: '交通、車流、往來流量', def: 'Vehicles moving on a road or public highway.', example: 'Heavy traffic on the freeway.', exampleZh: '高速公路上車流量極為龐大。' },
  'vehicle': { word: 'vehicle', phonetic: '/ˈviː.ə.kəl/', pos: 'n.', zh: '車輛、載具、傳播媒介', def: 'A thing used for transporting people or goods, especially on land.' },
  'vehicles': { word: 'vehicles', phonetic: '/ˈviː.ə.kəlz/', pos: 'n. (複數)', zh: '車輛（複數）', def: 'Plural of vehicle; cars, trucks, or vans.' },
  'freeway': { word: 'freeway', phonetic: '/ˈfriː.weɪ/', pos: 'n.', zh: '高速公路（無收費站）', def: 'An express highway with no tollgates.' },
  'highway': { word: 'highway', phonetic: '/ˈhaɪ.weɪ/', pos: 'n.', zh: '公路、幹道、國道', def: 'A main road, especially one connecting major towns or cities.' },
  'shoulder': { word: 'shoulder', phonetic: '/ˈʃoʊl.dər/', pos: 'n.', zh: '（道路）路肩；肩膀', def: 'The paved or unpaved strip along the side of a road or highway.', example: 'Vehicles moved to the shoulder.', exampleZh: '車輛已經移至路肩。' },
  'involve': { word: 'involve', phonetic: '/ɪnˈvɑːlv/', pos: 'v.', zh: '涉及、包含、捲入', def: 'To have or include as a necessary part or result.' },
  'involved': { word: 'involved', phonetic: '/ɪnˈvɑːlvd/', pos: 'adj./v.', zh: '涉及其中的、牽涉到的', def: 'Participating or included in a situation or event.', example: 'Two vehicles involved in an accident.', exampleZh: '兩輛車牽涉於一起車禍事故中。' },
  'accident': { word: 'accident', phonetic: '/ˈæk.sə.dənt/', pos: 'n.', zh: '車禍、意外事故', def: 'An unfortunate incident that happens unexpectedly.' },
  'crash': { word: 'crash', phonetic: '/kræʃ/', pos: 'n./v.', zh: '碰撞事故、墜毀；撞毀', def: 'A collision involving one or more vehicles.' },
  'delay': { word: 'delay', phonetic: '/dɪˈleɪ/', pos: 'n./v.', zh: '延誤、耽擱、推遲', def: 'A period of time by which something is late or postponed.' },
  'delays': { word: 'delays', phonetic: '/dɪˈleɪz/', pos: 'n. (複數)', zh: '延誤（複數）', def: 'Plural of delay; traffic holdups.' },
  'lane': { word: 'lane', phonetic: '/leɪn/', pos: 'n.', zh: '車道、跑道、狹窄小徑', def: 'A division of a road marked off for a single line of vehicles.' },
  'lanes': { word: 'lanes', phonetic: '/leɪnz/', pos: 'n. (複數)', zh: '車道（複數）', def: 'Plural of lane.' },
  'blocked': { word: 'blocked', phonetic: '/blɑːkt/', pos: 'adj./v.', zh: '被阻擋的、堵塞的', def: 'Obstructed or prevented from passing.', example: 'Two right lanes are blocked.', exampleZh: '右側兩條車道目前受阻封閉。' },
  'clear': { word: 'clear', phonetic: '/klɪr/', pos: 'adj./v.', zh: '通暢的、清晰的；排除、清除', def: 'Free from obstruction; easy to perceive.' },
  'cleared': { word: 'cleared', phonetic: '/klɪrd/', pos: 'v./adj.', zh: '已排除障礙、已放行', def: 'Obstruction removed.', example: 'The accident has been cleared.', exampleZh: '事故現場障礙已經全數排除。' },

  // News, Weather & Society
  'infrastructure': { word: 'infrastructure', phonetic: '/ˈɪn.frəˌstrʌk.tʃɚ/', pos: 'n.', zh: '公共基礎設施、公共建設', def: 'The basic physical systems of a region or country (transport, communication, water).' },
  'emissions': { word: 'emissions', phonetic: '/iˈmɪʃ.ənz/', pos: 'n. (複數)', zh: '氣體排放物、碳排放', def: 'Gases or particles released into the air.' },
  'emission': { word: 'emission', phonetic: '/iˈmɪʃ.ən/', pos: 'n.', zh: '排放、散發', def: 'The production and discharge of something.' },
  'climate': { word: 'climate', phonetic: '/ˈklaɪ.mət/', pos: 'n.', zh: '氣候、形勢風氣', def: 'The weather conditions prevailing in an area over a long period.' },
  'forecast': { word: 'forecast', phonetic: '/ˈfɔːr.kæst/', pos: 'n./v.', zh: '天氣預報、預測', def: 'A prediction of weather or future events.' },
  'community': { word: 'community', phonetic: '/kəˈmjuː.nə.t̬i/', pos: 'n.', zh: '社區、共同體、大眾群體', def: 'A group of people living in the same place or having particular characteristics in common.' },
  'resilience': { word: 'resilience', phonetic: '/rɪˈzɪl.jəns/', pos: 'n.', zh: '韌性、復原力、彈性', def: 'The capacity to recover quickly from difficulties; toughness.' },
  'factor': { word: 'factor', phonetic: '/ˈfæk.tɚ/', pos: 'n./v.', zh: '因素、要素；把...計入', def: 'A circumstance or influence contributing to a result.' },
  'breezes': { word: 'breezes', phonetic: '/ˈbriː.zɪz/', pos: 'n. (複數)', zh: '微風、和風（複數）', def: 'Gentle winds.' },
  'breeze': { word: 'breeze', phonetic: '/briːz/', pos: 'n.', zh: '微風、輕而易舉的事', def: 'A gentle wind.' },
  'temperature': { word: 'temperature', phonetic: '/ˈtem.prə.tʃɚ/', pos: 'n.', zh: '溫度、氣溫', def: 'The degree of hotness or coldness of a body or environment.' },
  'economy': { word: 'economy', phonetic: '/ɪˈkɑː.nə.mi/', pos: 'n.', zh: '經濟、經濟體系', def: 'The wealth and resources of a country or region.' },
  'economic': { word: 'economic', phonetic: '/ˌiː.kəˈnɑː.mɪk/', pos: 'adj.', zh: '經濟上的、有利可圖的', def: 'Relating to economics or the economy.' },
  'government': { word: 'government', phonetic: '/ˈɡʌv.ɚn.mənt/', pos: 'n.', zh: '政府、政權、管理機構', def: 'The governing body of a nation, state, or community.' },
  'official': { word: 'official', phonetic: '/əˈfɪʃ.əl/', pos: 'n./adj.', zh: '官員、發言人；官方的、正式的', def: 'A person holding public office; relating to authority.' },
  'officials': { word: 'officials', phonetic: '/əˈfɪʃ.əlz/', pos: 'n. (複數)', zh: '政府官員、主管單位（複數）', def: 'Plural of official.' },
  'president': { word: 'president', phonetic: '/ˈprez.ɪ.dənt/', pos: 'n.', zh: '總統、總裁、主席', def: 'The elected head of a republican state or organization.' },
  'court': { word: 'court', phonetic: '/kɔːrt/', pos: 'n.', zh: '法院、法庭、球場', def: 'A tribunal presided over by a judge or judges.' },
  'police': { word: 'police', phonetic: '/pəˈliːs/', pos: 'n.', zh: '警察、警方、治安人員', def: 'The civil force of a state responsible for law and order.' },
  'officer': { word: 'officer', phonetic: '/ˈɑː.fɪ.sɚ/', pos: 'n.', zh: '警官、官員、軍官', def: 'A person holding a position of authority.' },
  'investigation': { word: 'investigation', phonetic: '/ɪnˌves.təˈɡeɪ.ʃən/', pos: 'n.', zh: '調查、審查', def: 'The action of investigating something or someone.' },
  'market': { word: 'market', phonetic: '/ˈmɑːr.kɪt/', pos: 'n./v.', zh: '市場、股市、市集；行銷', def: 'A regular gathering for the purchase and sale of provisions or commodities.' },
  'inflation': { word: 'inflation', phonetic: '/ɪnˈfleɪ.ʃən/', pos: 'n.', zh: '通貨膨脹、物價上漲', def: 'A general increase in prices and fall in the purchasing value of money.' },
  'rate': { word: 'rate', phonetic: '/reɪt/', pos: 'n./v.', zh: '比率、利率、速度；評定', def: 'A measure, quantity, or frequency.' },
  'rates': { word: 'rates', phonetic: '/reɪts/', pos: 'n. (複數)', zh: '利率、費率（複數）', def: 'Plural of rate.' },
  'release': { word: 'release', phonetic: '/rɪˈliːs/', pos: 'v./n.', zh: '發布、發行、釋放、解鎖', def: 'To allow or enable to escape from confinement; to make a statement or document available to the public.', example: 'The radio station released the latest public safety bulletin.', exampleZh: '廣播電台發布了最新公共安全公告。' },
  'released': { word: 'released', phonetic: '/rɪˈliːst/', pos: 'v. (過去式/過去分詞) / adj.', zh: '已發布、已釋放、公布的', def: 'Made available to the public or set free from restraint or duty.', example: 'The newly released official report confirmed the update.', exampleZh: '最新發布的官方報告證實了這項更新。' },

  // Stanford & Academic Institutions
  'stanford': { word: 'Stanford', phonetic: '/ˈstæn.fɚd/', pos: 'n.', zh: '史丹佛大學（名校）；史丹佛（姓氏/地名）', def: 'A world-renowned private research university in California; also a prominent family and place name.', example: 'Researchers at Stanford announced the scientific breakthrough today.', exampleZh: '史丹佛大學的研究人員今天宣布了這項重大科學突破。' },

  // General High-Frequency Vocabulary
  'catch': { word: 'catch', phonetic: '/kætʃ/', pos: 'v./n.', zh: '捕捉、抓住、接住、趕上；捕獲物', def: 'To capture, intercept, or seize.' },
  'caught': { word: 'caught', phonetic: '/kɔːt/', pos: 'v. (過去式)', zh: '抓住了、趕上了、被逮到（catch 的過去式）', def: 'Past tense of catch.' },
  'catching': { word: 'catching', phonetic: '/ˈkætʃ.ɪŋ/', pos: 'v./adj.', zh: '正在抓取、接球；具傳染性的', def: 'Present participle of catch.' },
  'individual': { word: 'individual', phonetic: '/ˌɪn.dəˈvɪdʒ.u.əl/', pos: 'n./adj.', zh: '個人、個體；個別的、獨特的', def: 'A single human being as distinct from a group.' },
  'individuals': { word: 'individuals', phonetic: '/ˌɪn.dəˈvɪdʒ.u.əlz/', pos: 'n. (複數)', zh: '個人、大眾個體（複數）', def: 'Plural of individual; distinct persons.' },
  'people': { word: 'people', phonetic: '/ˈpiː.pəl/', pos: 'n.', zh: '人們、人民、大眾', def: 'Human beings in general or considered collectively.' },
  'listen': { word: 'listen', phonetic: '/ˈlɪs.ən/', pos: 'v.', zh: '聆聽、收聽、聽從', def: 'To give one\'s attention to a sound.' },
  'listening': { word: 'listening', phonetic: '/ˈlɪs.ən.ɪŋ/', pos: 'v./n.', zh: '正在聆聽、收聽中', def: 'Present participle of listen.' },
  'broadcast': { word: 'broadcast', phonetic: '/ˈbrɔːd.kæst/', pos: 'n./v.', zh: '廣播、播送、電台節目', def: 'To transmit by radio or television.' },
  'broadcasting': { word: 'broadcasting', phonetic: '/ˈbrɔːdˌkæs.tɪŋ/', pos: 'n.', zh: '廣播事業、播送傳播', def: 'The business of making television and radio programs.' },
  'radio': { word: 'radio', phonetic: '/ˈreɪ.di.oʊ/', pos: 'n.', zh: '收音機、廣播電台、無線電', def: 'The transmission and reception of electromagnetic waves.' },
  'voice': { word: 'voice', phonetic: '/vɔɪs/', pos: 'n./v.', zh: '聲音、嗓音、發聲', def: 'The sound produced in a person\'s larynx and uttered through the mouth.' },
  'voices': { word: 'voices', phonetic: '/ˈvɔɪ.sɪz/', pos: 'n. (複數)', zh: '聲音、各方意見（複數）', def: 'Plural of voice.' },
  'station': { word: 'station', phonetic: '/ˈsteɪ.ʃən/', pos: 'n.', zh: '廣播電台、車站、基地', def: 'A broadcasting company or location.' },
  'program': { word: 'program', phonetic: '/ˈproʊ.ɡræm/', pos: 'n./v.', zh: '節目、計畫、方案；編寫程式', def: 'A planned series of events or performances.' },
  'programs': { word: 'programs', phonetic: '/ˈproʊ.ɡræmz/', pos: 'n. (複數)', zh: '節目、專案（複數）', def: 'Plural of program.' },
  'service': { word: 'service', phonetic: '/ˈsɝː.vɪs/', pos: 'n./v.', zh: '服務、公共機構、檢修', def: 'An act of helpful activity; public utility.' },
  'system': { word: 'system', phonetic: '/ˈsɪs.təm/', pos: 'n.', zh: '系統、體制、體系', def: 'A set of things working together as parts of a mechanism.' },
  'support': { word: 'support', phonetic: '/səˈpɔːrt/', pos: 'v./n.', zh: '支持、贊助、援助、維持', def: 'To give assistance or encouragement to.' },
  'health': { word: 'health', phonetic: '/helθ/', pos: 'n.', zh: '健康、衛生、醫療健保', def: 'The state of being free from illness or injury.' },
  'education': { word: 'education', phonetic: '/ˌedʒ.əˈkeɪ.ʃən/', pos: 'n.', zh: '教育、培養、教學', def: 'The process of receiving or giving systematic instruction.' },
  'research': { word: 'research', phonetic: '/ˈriː.sɝːtʃ/', pos: 'n./v.', zh: '學術研究、調查、研發', def: 'The systematic investigation into and study of materials.' },
  'security': { word: 'security', phonetic: '/səˈkjʊr.ə.t̬i/', pos: 'n.', zh: '安全、保全、保障、防衛', def: 'The state of being free from danger or threat.' },
  'experience': { word: 'experience', phonetic: '/ɪkˈspɪr.i.əns/', pos: 'n./v.', zh: '經驗、體驗、經歷', def: 'Practical contact with and observation of facts or events.' },
  'decision': { word: 'decision', phonetic: '/dɪˈsɪʒ.ən/', pos: 'n.', zh: '決定、決策、判決', def: 'A conclusion or resolution reached after consideration.' },
  'decisions': { word: 'decisions', phonetic: '/dɪˈsɪʒ.ənz/', pos: 'n. (複數)', zh: '決定、政策方針（複數）', def: 'Plural of decision.' },
};

/**
 * Check if word or stem exists in built-in dictionary
 */
export function lookupQuickWord(rawWord: string): QuickWordEntry | null {
  const clean = rawWord.trim().toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  if (!clean) return null;

  // Direct match
  if (BUILTIN_DICT[clean]) {
    return BUILTIN_DICT[clean];
  }

  // Tense / suffix derivation
  // Check -ed
  if (clean.endsWith('ed')) {
    const base1 = clean.slice(0, -2);
    const base2 = clean.slice(0, -1);
    if (BUILTIN_DICT[base1]) {
      const base = BUILTIN_DICT[base1];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: 'v. (過去式)',
        zh: `${base.zh.split('、')[0]}了（${base.word} 的過去式）`,
        def: `Past tense of ${base.word}: ${base.def || ''}`,
        example: base.example,
      };
    }
    if (BUILTIN_DICT[base2]) {
      const base = BUILTIN_DICT[base2];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: 'v. (過去式)',
        zh: `${base.zh.split('、')[0]}了（${base.word} 的過去式）`,
        def: `Past tense of ${base.word}: ${base.def || ''}`,
        example: base.example,
      };
    }
  }

  // Check -ing
  if (clean.endsWith('ing')) {
    const base1 = clean.slice(0, -3);
    const base2 = clean.slice(0, -3) + 'e';
    if (BUILTIN_DICT[base1]) {
      const base = BUILTIN_DICT[base1];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: 'v. (現在分詞/進行式)',
        zh: `正在${base.zh.split('、')[0]}（${base.word} 的進行式）`,
        def: `Present participle of ${base.word}`,
        example: base.example,
      };
    }
    if (BUILTIN_DICT[base2]) {
      const base = BUILTIN_DICT[base2];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: 'v. (現在分詞/進行式)',
        zh: `正在${base.zh.split('、')[0]}（${base.word} 的進行式）`,
        def: `Present participle of ${base.word}`,
        example: base.example,
      };
    }
  }

  // Check -s / -es
  if (clean.endsWith('s')) {
    const base1 = clean.slice(0, -1);
    const base2 = clean.endsWith('es') ? clean.slice(0, -2) : '';
    if (BUILTIN_DICT[base1]) {
      const base = BUILTIN_DICT[base1];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: 'n. (複數) / v. (單數動詞)',
        zh: `${base.zh}（複數/第三人稱）`,
        def: base.def,
        example: base.example,
      };
    }
    if (base2 && BUILTIN_DICT[base2]) {
      const base = BUILTIN_DICT[base2];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: 'n. (複數) / v. (單數動詞)',
        zh: `${base.zh}（複數/第三人稱）`,
        def: base.def,
        example: base.example,
      };
    }
  }

  return null;
}

/**
 * Generate a distinct, definition-aware contextual example sentence and translation for any vocabulary word.
 * Guarantees no duplicate sentences across multiple meanings.
 */
export function generateContextualExample(
  word: string,
  pos: string = '',
  index: number = 0,
  definition: string = '',
  usedSentences?: Set<string>
): ContextualExample {
  const clean = (word || '').trim();
  if (!clean) {
    return { sentence: '', translation: '' };
  }

  // Proper noun capitalization: if word starts with uppercase, preserve it; otherwise capitalize first letter if suitable
  const isOriginallyCapitalized = /^[A-Z]/.test(clean);
  const displayWord = isOriginallyCapitalized ? clean : clean.toLowerCase();
  const capitalizedWord = clean.charAt(0).toUpperCase() + clean.slice(1);

  // 1. If index is 0 and builtin dictionary has curated example & translation
  if (index === 0) {
    const matched = lookupQuickWord(clean.toLowerCase());
    if (matched?.example) {
      const sentence = matched.example;
      if (!usedSentences || !usedSentences.has(sentence)) {
        if (usedSentences) usedSentences.add(sentence);
        return {
          sentence,
          translation: matched.exampleZh || '',
        };
      }
    }
  }

  const defLower = (definition || '').toLowerCase();
  const p = (pos || '').toLowerCase();

  // 2. Definition-aware contextual smart generation (for words like "stanford", "transit", "court", etc.)
  const contextCandidates: ContextualExample[] = [];

  // University / College / Education / Academic
  if (
    defLower.includes('university') ||
    defLower.includes('college') ||
    defLower.includes('campus') ||
    defLower.includes('academic') ||
    defLower.includes('school') ||
    defLower.includes('institute')
  ) {
    contextCandidates.push(
      {
        sentence: `Researchers at ${capitalizedWord} announced a major scientific discovery today.`,
        translation: `${capitalizedWord}大學的研究人員今天宣布了一項重大科學發現。`,
      },
      {
        sentence: `She completed her graduate studies at ${capitalizedWord} with top honors.`,
        translation: `她在${capitalizedWord}大學以優異成績完成了研究所學位。`,
      },
      {
        sentence: `The professor from ${capitalizedWord} shared key insights during the radio interview.`,
        translation: `來自${capitalizedWord}大學的教授在廣播專訪中分享了關鍵見解。`,
      }
    );
  }

  // Surname / Name / Family / Person
  if (
    defLower.includes('surname') ||
    defLower.includes('habitational') ||
    defLower.includes('family name') ||
    defLower.includes('person') ||
    defLower.includes('named after')
  ) {
    contextCandidates.push(
      {
        sentence: `Professor ${capitalizedWord} delivered an insightful address during the symposium.`,
        translation: `${capitalizedWord}教授在座談會上發表了一場深刻的演講。`,
      },
      {
        sentence: `The historic library was founded by the ${capitalizedWord} family in the nineteenth century.`,
        translation: `這座歷史悠久的圖書館是由${capitalizedWord}家族於十九世紀創立的。`,
      },
      {
        sentence: `Dr. ${capitalizedWord} answered questions from listeners during the live broadcast.`,
        translation: `${capitalizedWord}博士在即時廣播中親切回答了聽眾的提問。`,
      }
    );
  }

  // City / Town / Place / County / Geographical
  if (
    defLower.includes('city') ||
    defLower.includes('town') ||
    defLower.includes('county') ||
    defLower.includes('village') ||
    defLower.includes('settlement') ||
    defLower.includes('capital of')
  ) {
    contextCandidates.push(
      {
        sentence: `The news team traveled to ${capitalizedWord} to report on local community developments.`,
        translation: `新聞採訪團隊前往${capitalizedWord}報導當地社區的最新動態。`,
      },
      {
        sentence: `Residents across ${capitalizedWord} participated in the annual civic forum.`,
        translation: `${capitalizedWord}各地的居民積極參與了這場年度市民論壇。`,
      }
    );
  }

  // Transport / Vehicle / Traffic
  if (
    defLower.includes('vehicle') ||
    defLower.includes('car') ||
    defLower.includes('truck') ||
    defLower.includes('traffic') ||
    defLower.includes('transit') ||
    defLower.includes('road') ||
    defLower.includes('highway')
  ) {
    contextCandidates.push(
      {
        sentence: `Traffic reports advised drivers to exercise caution regarding the ${displayWord}.`,
        translation: `交通路況提醒駕駛人行經該路段時注意${displayWord}狀況。`,
      },
      {
        sentence: `Emergency personnel were dispatched to manage the situation involving the ${displayWord}.`,
        translation: `緊急應變小組已出動以處置涉及該${displayWord}的現場狀況。`,
      },
      {
        sentence: `The local transit authority updated guidelines concerning ${displayWord} safety.`,
        translation: `當地大眾運輸主管機關發布了關於${displayWord}安全的最新指引。`,
      }
    );
  }

  // Law / Court / Legal / Police
  if (
    defLower.includes('law') ||
    defLower.includes('court') ||
    defLower.includes('police') ||
    defLower.includes('judge') ||
    defLower.includes('legal') ||
    defLower.includes('crime')
  ) {
    contextCandidates.push(
      {
        sentence: `Legal analysts examined how the court's ruling impacts ${displayWord} across the region.`,
        translation: `法律分析師深入探討了法院判決對全區${displayWord}所帶來的影響。`,
      },
      {
        sentence: `Authorities held a press conference to provide clear details on the ${displayWord}.`,
        translation: `當局舉行了新聞發布會，就該${displayWord}提供了詳實的說明。`,
      }
    );
  }

  // Economy / Finance / Market / Business / Money
  if (
    defLower.includes('money') ||
    defLower.includes('market') ||
    defLower.includes('economy') ||
    defLower.includes('finance') ||
    defLower.includes('bank') ||
    defLower.includes('cost') ||
    defLower.includes('price')
  ) {
    contextCandidates.push(
      {
        sentence: `Economists discussed the broader market implications surrounding ${displayWord} today.`,
        translation: `經濟學家今天討論了圍繞${displayWord}的整體市場影響。`,
      },
      {
        sentence: `Investors closely watched financial indicators related to ${displayWord} this morning.`,
        translation: `投資人今天上午密切關注與${displayWord}相關的各項金融指標。`,
      }
    );
  }

  // Weather / Climate / Atmosphere
  if (
    defLower.includes('weather') ||
    defLower.includes('climate') ||
    defLower.includes('wind') ||
    defLower.includes('rain') ||
    defLower.includes('temperature') ||
    defLower.includes('atmosphere')
  ) {
    contextCandidates.push(
      {
        sentence: `Meteorologists noted that ${displayWord} will play a key role in regional weather patterns.`,
        translation: `氣象學家指出，${displayWord}將在區域氣候型態中扮演關鍵角色。`,
      },
      {
        sentence: `The seasonal forecast highlights expected changes in ${displayWord} over coming weeks.`,
        translation: `季節預報著重強調了未來數週內${displayWord}可能發生的轉變。`,
      }
    );
  }

  // Pick definition-aware candidate if available and not used
  for (const cand of contextCandidates) {
    if (!usedSentences || !usedSentences.has(cand.sentence)) {
      if (usedSentences) usedSentences.add(cand.sentence);
      return cand;
    }
  }

  // 3. Fallback to Diversified POS Template Pools with pre-translated Chinese
  let pool: ContextualExample[] = [];

  if (p.includes('adj') || p.includes('形容詞')) {
    pool = [
      {
        sentence: `The news anchor delivered a ${displayWord} summary of today's top headlines.`,
        translation: `新聞主播對今日的頭條要聞進行了${displayWord}的概述。`,
      },
      {
        sentence: `Finding a ${displayWord} solution remains the primary focus for city planners.`,
        translation: `尋求一個${displayWord}的解決方案依然是城市規劃者的首要焦點。`,
      },
      {
        sentence: `Community members shared ${displayWord} feedback during the public hearing.`,
        translation: `社區居民在公聽會中分享了${displayWord}的反饋意見。`,
      },
      {
        sentence: `The morning broadcast provided several ${displayWord} perspectives on the topic.`,
        translation: `早間廣播節目針對該主題提供了數個${displayWord}的觀察視角。`,
      },
      {
        sentence: `Her ${displayWord} contributions to the project were recognized by the committee.`,
        translation: `她對該項目的${displayWord}貢獻獲得了委員會的高度認可。`,
      },
    ];
  } else if (p.includes('adv') || p.includes('副詞')) {
    pool = [
      {
        sentence: `The spokesperson ${displayWord} addressed each question raised by the press.`,
        translation: `發言人${displayWord}回應了媒體記者提出的每個問題。`,
      },
      {
        sentence: `The transit system operated ${displayWord} throughout the morning rush hour.`,
        translation: `大眾運輸系統在早間通勤高峰期保持${displayWord}運轉。`,
      },
      {
        sentence: `City officials responded ${displayWord} to ensure community safety.`,
        translation: `市府官員${displayWord}採取行動，以確保社區大眾安全。`,
      },
      {
        sentence: `The host ${displayWord} summarized the main takeaways of the interview.`,
        translation: `主持人${displayWord}總結了本次專訪的核心精髓。`,
      },
    ];
  } else if (p.includes('動詞') || p.startsWith('v')) {
    if (clean.toLowerCase().endsWith('ed')) {
      pool = [
        {
          sentence: `Authorities ${displayWord} the updated safety guidelines to the public today.`,
          translation: `當局今天向大眾${displayWord}了最新的安全指導方針。`,
        },
        {
          sentence: `The committee ${displayWord} key recommendations following extensive review.`,
          translation: `在廣泛審視之後，委員會${displayWord}了重要建議。`,
        },
        {
          sentence: `Journalists ${displayWord} on the ongoing developments from the field.`,
          translation: `新聞記者自第一線現場對持續發展的事件進行了${displayWord}。`,
        },
        {
          sentence: `The strategic plan was positively ${displayWord} by regional leaders.`,
          translation: `該策略計畫獲得了區域領導團隊的積極${displayWord}。`,
        },
      ];
    } else if (clean.toLowerCase().endsWith('ing')) {
      pool = [
        {
          sentence: `Reporters are actively ${displayWord} the developing community story.`,
          translation: `記者正積極${displayWord}這則持續發酵的社區新聞。`,
        },
        {
          sentence: `The team has spent months ${displayWord} sustainable solutions for residents.`,
          translation: `團隊花了數月時間為居民${displayWord}可持續的解決方案。`,
        },
        {
          sentence: `Analysts are closely ${displayWord} changes across the local economy.`,
          translation: `分析師正密切${displayWord}在地經濟的各項變化。`,
        },
        {
          sentence: `Broadcasters were ${displayWord} live updates as the briefing concluded.`,
          translation: `隨著簡報會結束，廣播員正在${displayWord}即時快訊。`,
        },
      ];
    } else {
      pool = [
        {
          sentence: `Radio hosts often ${displayWord} essential guidance for morning commuters.`,
          translation: `廣播主持人經常為晨間通勤族${displayWord}必要指引。`,
        },
        {
          sentence: `Organizations are collaborating to ${displayWord} effective new programs.`,
          translation: `各機構正通力合作以${displayWord}行之有效的新方案。`,
        },
        {
          sentence: `Officials plan to ${displayWord} key strategies in the upcoming quarter.`,
          translation: `官員計劃在下一季度${displayWord}核心策略。`,
        },
        {
          sentence: `Listeners are invited to ${displayWord} during the open discussion segment.`,
          translation: `在開放討論環節中，電台誠摯邀請聽眾共同${displayWord}。`,
        },
      ];
    }
  } else {
    // Nouns & general vocabulary
    if (clean.toLowerCase().endsWith('s') && clean.length > 3 && !clean.toLowerCase().endsWith('ss')) {
      pool = [
        {
          sentence: `Recent ${displayWord} have attracted significant public interest across the region.`,
          translation: `近期的這些${displayWord}引起了整個地區的大眾高度關注。`,
        },
        {
          sentence: `Officials reviewed several critical ${displayWord} during the morning briefing.`,
          translation: `官員在晨間簡報中審視了數項關鍵的${displayWord}。`,
        },
        {
          sentence: `Analysts are tracking how these ${displayWord} will influence community life.`,
          translation: `分析師正在追蹤這些${displayWord}將如何影響社區生活。`,
        },
        {
          sentence: `New policies regarding ${displayWord} will take effect starting next month.`,
          translation: `關於${displayWord}的新政策將於下月起正式生效。`,
        },
        {
          sentence: `Community groups organized discussions around the challenges of ${displayWord}.`,
          translation: `社區團體圍繞著這些${displayWord}所帶來的挑戰組織了多場專題研討。`,
        },
      ];
    } else {
      const nounWord = isOriginallyCapitalized ? capitalizedWord : displayWord;
      pool = [
        {
          sentence: `Recent coverage highlighted new developments regarding ${nounWord}.`,
          translation: `近期的新聞報導著重指出了關於${nounWord}的最新進展。`,
        },
        {
          sentence: `Experts shared valuable insights on ${nounWord} during the panel interview.`,
          translation: `專家在座談專訪中分享了關於${nounWord}的寶貴洞見。`,
        },
        {
          sentence: `A comprehensive assessment of ${nounWord} was presented to local leaders.`,
          translation: `一份關於${nounWord}的全面評估報告已呈遞給在地領導團隊。`,
        },
        {
          sentence: `Community interest in ${nounWord} has grown considerably this year.`,
          translation: `今年大眾對${nounWord}的關注度有了顯著提升。`,
        },
        {
          sentence: `Finding an innovative approach to ${nounWord} is vital for long-term progress.`,
          translation: `為${nounWord}開創嶄新路徑對長遠發展至關重要。`,
        },
        {
          sentence: `Our radio station frequently explores important topics related to ${nounWord}.`,
          translation: `本廣播電台經常深入探討與${nounWord}相關的焦點話題。`,
        },
      ];
    }
  }

  // Cycle through pool starting from index
  for (let offset = 0; offset < pool.length; offset++) {
    const candidate = pool[(index + offset) % pool.length];
    if (!usedSentences || !usedSentences.has(candidate.sentence)) {
      if (usedSentences) usedSentences.add(candidate.sentence);
      return candidate;
    }
  }

  // Fallback
  const fallback = pool[index % pool.length] || {
    sentence: `Listeners sent in comments discussing the impact of ${displayWord}.`,
    translation: `聽眾紛紛來信留言，探討${displayWord}所帶來的廣泛影響。`,
  };
  return fallback;
}

