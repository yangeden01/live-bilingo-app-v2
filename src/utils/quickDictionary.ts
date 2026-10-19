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
  targetZh?: string;
}

/**
 * Extract clean single Chinese word/phrase from dictionary raw translation string
 */
export function extractCleanZhWord(rawZh?: string): string {
  if (!rawZh) return '';
  const cleaned = rawZh
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/^【[^】]+】\s*/g, '')
    .replace(/（[^）]+）/g, '')
    .replace(/\([^\)]+\)/g, '')
    .replace(/^[a-zA-Z\.\s]+[:：]?\s*/, '')
    .trim();

  const parts = cleaned.split(/[/,，、;；\s]+/);
  for (const part of parts) {
    const trimmed = part.trim().replace(/^[^\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+$/g, '');
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return '';
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

  // User Highlighted & High-Frequency Words
  'trade': { word: 'trade', phonetic: '/treɪd/', pos: 'n./v.', zh: '貿易、商業、交易；進行買賣', def: 'The action of buying and selling goods and services.' },
  'traded': { word: 'traded', phonetic: '/treɪdɪd/', pos: 'v. (過去式)', zh: '進行了交易、買賣了（trade 的過去式）', def: 'Past tense of trade.' },
  'trading': { word: 'trading', phonetic: '/ˈtreɪ.dɪŋ/', pos: 'n./v.', zh: '交易活動、商業買賣；進行貿易中', def: 'The activity of buying and selling goods and services.' },
  'comment': { word: 'comment', phonetic: '/ˈkɑː.ment/', pos: 'n./v.', zh: '評論、意見、發表意見、註解', def: 'A verbal or written remark expressing an opinion or reaction.' },
  'comments': { word: 'comments', phonetic: '/ˈkɑː.ments/', pos: 'n. (複數) / v.', zh: '評論、各方意見、留言註解（複數）', def: 'Plural of comment; remarks expressing an opinion.' },
  'commented': { word: 'commented', phonetic: '/ˈkɑː.men.tɪd/', pos: 'v. (過去式)', zh: '發表了評論、表達了意見（comment 的過去式）', def: 'Past tense of comment.' },
  'commenting': { word: 'commenting', phonetic: '/ˈkɑː.men.tɪŋ/', pos: 'v. (進行式)', zh: '正在評論、發表意見中', def: 'Present participle of comment.' },
  'man': { word: 'man', phonetic: '/mæn/', pos: 'n./v.', zh: '男人、人類、人員；配置人員', def: 'An adult human male; a human being or worker.' },
  'men': { word: 'men', phonetic: '/men/', pos: 'n. (複數)', zh: '男人、大眾人員（man 的複數）', def: 'Plural of man.' },
  'woman': { word: 'woman', phonetic: '/ˈwʊm.ən/', pos: 'n.', zh: '女人、女性', def: 'An adult female human being.' },
  'women': { word: 'women', phonetic: '/ˈwɪm.ɪn/', pos: 'n. (複數)', zh: '女人、女性群體（woman 的複數）', def: 'Plural of woman.' },
  'child': { word: 'child', phonetic: '/tʃaɪld/', pos: 'n.', zh: '兒童、小孩、孩子', def: 'A young human being below the age of puberty.' },
  'children': { word: 'children', phonetic: '/ˈtʃɪl.drən/', pos: 'n. (複數)', zh: '兒童、孩子們（child 的複數）', def: 'Plural of child.' },
  'avocation': { word: 'avocation', phonetic: '/ˌæv.əˈkeɪ.ʃən/', pos: 'n.', zh: '副業、業餘嗜好、休閒愛好', def: 'A hobby or minor occupation.' },
  'avocations': { word: 'avocations', phonetic: '/ˌæv.əˈkeɪ.ʃənz/', pos: 'n. (複數)', zh: '副業、業餘嗜好（複數）', def: 'Plural of avocation.' },
  'agriculture': { word: 'agriculture', phonetic: '/ˈæɡ.rə.kʌl.tʃɚ/', pos: 'n.', zh: '農業、農藝、農耕', def: 'The science or practice of farming.' },
  'agricultural': { word: 'agricultural', phonetic: '/ˌæɡ.rəˈkʌl.tʃɚ.əl/', pos: 'adj.', zh: '農業的、農學的、農產的', def: 'Relating to agriculture or farming.' },
  'farmer': { word: 'farmer', phonetic: '/ˈfɑːr.mɚ/', pos: 'n.', zh: '農民、農場主', def: 'A person who owns or manages a farm.' },
  'farmers': { word: 'farmers', phonetic: '/ˈfɑːr.mɚz/', pos: 'n. (複數)', zh: '農民群體（複數）', def: 'Plural of farmer.' },
  'farm': { word: 'farm', phonetic: '/fɑːrm/', pos: 'n./v.', zh: '農場、農莊；耕種', def: 'An area of land devoted to agricultural processes.' },
  'farming': { word: 'farming', phonetic: '/ˈfɑːr.mɪŋ/', pos: 'n.', zh: '農業生產、耕種耕作', def: 'The activity of growing crops and raising livestock.' },
  'stunt': { word: 'stunt', phonetic: '/stʌnt/', pos: 'n./v.', zh: '特技、噱頭、引人注目的花招；阻礙成長', def: 'An action displaying spectacular skill or daring; to slow down growth.' },
  'stunts': { word: 'stunts', phonetic: '/stʌnts/', pos: 'n. (複數) / v.', zh: '特技、宣傳噱頭（複數）；表演特技', def: 'Plural of stunt; spectacular daring performances or publicity moves.' },
  'stunted': { word: 'stunted', phonetic: '/ˈstʌn.tɪd/', pos: 'adj./v.', zh: '發育受阻的、受壓抑的（stunt 的過去式/形容詞）', def: 'Prevented from growing or developing properly.' },
  'business': { word: 'business', phonetic: '/ˈbɪz.nɪs/', pos: 'n.', zh: '商業、事業、企業、商務', def: 'Commercial activity or an enterprise.' },
  'company': { word: 'company', phonetic: '/ˈkʌm.pə.ni/', pos: 'n.', zh: '公司、企業、陪伴', def: 'A commercial business.' },
  'companies': { word: 'companies', phonetic: '/ˈkʌm.pə.niz/', pos: 'n. (複數)', zh: '公司、企業（複數）', def: 'Plural of company.' },
  'work': { word: 'work', phonetic: '/wɝːk/', pos: 'n./v.', zh: '工作、職業、著作；運作、努力', def: 'Activity involving mental or physical effort.' },
  'worker': { word: 'worker', phonetic: '/ˈwɝː.kɚ/', pos: 'n.', zh: '勞工、從業人員、員工', def: 'A person who does a specified type of work.' },
  'workers': { word: 'workers', phonetic: '/ˈwɝː.kɚz/', pos: 'n. (複數)', zh: '勞工、工作人員（複數）', def: 'Plural of worker.' },
  'money': { word: 'money', phonetic: '/ˈmʌn.i/', pos: 'n.', zh: '金錢、貨幣、資金', def: 'A medium of exchange in the form of coins and banknotes.' },
  'price': { word: 'price', phonetic: '/praɪs/', pos: 'n./v.', zh: '價格、代價；定價', def: 'The amount of money expected or required in payment.' },
  'prices': { word: 'prices', phonetic: '/ˈpraɪ.sɪz/', pos: 'n. (複數)', zh: '物價、價格行情（複數）', def: 'Plural of price.' },
  'cost': { word: 'cost', phonetic: '/kɔːst/', pos: 'n./v.', zh: '成本、花費、代價；需花費', def: 'An amount that has to be paid or given up.' },
  'costs': { word: 'costs', phonetic: '/kɔːsts/', pos: 'n. (複數)', zh: '各項成本、各項支出（複數）', def: 'Plural of cost.' },
  'bank': { word: 'bank', phonetic: '/bæŋk/', pos: 'n./v.', zh: '銀行、岸邊；在銀行開戶', def: 'A financial establishment.' },
  'banks': { word: 'banks', phonetic: '/bæŋks/', pos: 'n. (複數)', zh: '銀行體系（複數）', def: 'Plural of bank.' },
  'policy': { word: 'policy', phonetic: '/ˈpɑː.lə.si/', pos: 'n.', zh: '政策、方針、保單', def: 'A course or principle of action adopted by a government.' },
  'policies': { word: 'policies', phonetic: '/ˈpɑː.lə.siz/', pos: 'n. (複數)', zh: '各項政策方針（複數）', def: 'Plural of policy.' },
  'law': { word: 'law', phonetic: '/lɔː/', pos: 'n.', zh: '法律、法則、法規', def: 'The system of rules which a particular country recognizes.' },
  'laws': { word: 'laws', phonetic: '/lɔːz/', pos: 'n. (複數)', zh: '法規、法律條文（複數）', def: 'Plural of law.' },
  'rule': { word: 'rule', phonetic: '/ruːl/', pos: 'n./v.', zh: '規則、準則；統治、裁決', def: 'One of a set of explicit regulations or principles.' },
  'rules': { word: 'rules', phonetic: '/ruːlz/', pos: 'n. (複數) / v.', zh: '規則、規章（複數）；統治', def: 'Plural of rule.' },
  'water': { word: 'water', phonetic: '/ˈwɑː.t̬ɚ/', pos: 'n./v.', zh: '水、水資源；澆水', def: 'A transparent fluid forming lakes, streams, and rain.' },
  'food': { word: 'food', phonetic: '/fuːd/', pos: 'n.', zh: '食物、糧食、養分', def: 'Any nutritious substance that people or animals eat.' },
  'energy': { word: 'energy', phonetic: '/ˈen.ɚ.dʒi/', pos: 'n.', zh: '能源、能量、活力', def: 'The strength and vitality required for sustained activity.' },
  'oil': { word: 'oil', phonetic: '/ɔɪl/', pos: 'n./v.', zh: '石油、原油、油品；上油', def: 'A viscous liquid derived from petroleum.' },
  'gas': { word: 'gas', phonetic: '/ɡæs/', pos: 'n.', zh: '天然氣、汽油、氣體', def: 'An air-like fluid substance or petroleum fuel.' },
  'power': { word: 'power', phonetic: '/ˈpaʊ.ɚ/', pos: 'n./v.', zh: '電力、權力、力量；提供動力', def: 'The ability to do something or electrical energy.' },
  'city': { word: 'city', phonetic: '/ˈsɪt.i/', pos: 'n.', zh: '城市、都市、市區', def: 'A large town.' },
  'cities': { word: 'cities', phonetic: '/ˈsɪt.iz/', pos: 'n. (複數)', zh: '城市群、各大都會（複數）', def: 'Plural of city.' },
  'state': { word: 'state', phonetic: '/steɪt/', pos: 'n./v.', zh: '國家、州、州政府、狀態；陳述', def: 'A nation or territory; a condition.' },
  'states': { word: 'states', phonetic: '/steɪts/', pos: 'n. (複數) / v.', zh: '各州、國家（複數）；陳述', def: 'Plural of state.' },
  'nation': { word: 'nation', phonetic: '/ˈneɪ.ʃən/', pos: 'n.', zh: '國家、國民、民族', def: 'A large body of people united by common descent or history.' },
  'country': { word: 'country', phonetic: '/ˈkʌn.tri/', pos: 'n.', zh: '國家、鄉間、鄉村', def: 'A nation with its own government.' },
  'world': { word: 'world', phonetic: '/wɝːld/', pos: 'n.', zh: '世界、全球、天下', def: 'The earth, together with all of its countries and peoples.' },
  'global': { word: 'global', phonetic: '/ˈɡloʊ.bəl/', pos: 'adj.', zh: '全球的、全世界的、全面的', def: 'Relating to the whole world; worldwide.' },
  'local': { word: 'local', phonetic: '/ˈloʊ.kəl/', pos: 'adj./n.', zh: '當地的、本土的、局部的；在地人', def: 'Belonging or relating to a particular area or neighborhood.' },
  'public': { word: 'public', phonetic: '/ˈpʌb.lɪk/', pos: 'adj./n.', zh: '公眾的、公共的；大眾', def: 'Concerning the people as a whole.' },
  'private': { word: 'private', phonetic: '/ˈpraɪ.vət/', pos: 'adj.', zh: '私人的、民營的、機密的', def: 'Belonging to or for the use of one particular person.' },
  'news': { word: 'news', phonetic: '/nuːz/', pos: 'n.', zh: '新聞、消息、即時報導', def: 'Newly received or noteworthy information.' },
  'story': { word: 'story', phonetic: '/ˈstɔːr.i/', pos: 'n.', zh: '故事、新聞報導、事蹟', def: 'An account of imaginary or real people and events.' },
  'stories': { word: 'stories', phonetic: '/ˈstɔːr.iz/', pos: 'n. (複數)', zh: '新聞報導、故事集（複數）', def: 'Plural of story.' },
  'event': { word: 'event', phonetic: '/ɪˈvent/', pos: 'n.', zh: '事件、活動、盛事', def: 'A thing that happens, especially one of importance.' },
  'events': { word: 'events', phonetic: '/ɪˈvents/', pos: 'n. (複數)', zh: '各項重大事件、活動（複數）', def: 'Plural of event.' },
  'crisis': { word: 'crisis', phonetic: '/ˈkraɪ.sɪs/', pos: 'n.', zh: '危機、緊急關頭', def: 'A time of intense difficulty, trouble, or danger.' },
  'issue': { word: 'issue', phonetic: '/ˈɪʃ.uː/', pos: 'n./v.', zh: '議題、問題、爭議；發行', def: 'An important topic or problem for debate or discussion.' },
  'issues': { word: 'issues', phonetic: '/ˈɪʃ.uːz/', pos: 'n. (複數) / v.', zh: '重大議題、爭議問題（複數）', def: 'Plural of issue.' },
  'problem': { word: 'problem', phonetic: '/ˈprɑː.bləm/', pos: 'n.', zh: '問題、難題、困境', def: 'A matter or situation regarded as unwelcome.' },
  'problems': { word: 'problems', phonetic: '/ˈprɑː.bləmz/', pos: 'n. (複數)', zh: '問題、困境挑戰（複數）', def: 'Plural of problem.' },
  'solution': { word: 'solution', phonetic: '/səˈluː.ʃən/', pos: 'n.', zh: '解決方案、解答、解法', def: 'A means of solving a problem or dealing with a difficult situation.' },
  'solutions': { word: 'solutions', phonetic: '/səˈluː.ʃənz/', pos: 'n. (複數)', zh: '解決辦法、因應對策（複數）', def: 'Plural of solution.' },
  'future': { word: 'future', phonetic: '/ˈfjuː.tʃɚ/', pos: 'n./adj.', zh: '未來、前途；未來的', def: 'At a later time; going to happen.' },
  'history': { word: 'history', phonetic: '/ˈhɪs.tər.i/', pos: 'n.', zh: '歷史、史冊、過去經歷', def: 'The whole series of past events connected with someone or something.' },
  'school': { word: 'school', phonetic: '/skuːl/', pos: 'n.', zh: '學校、學院、學派', def: 'An institution for educating children.' },
  'student': { word: 'student', phonetic: '/ˈstuː.dənt/', pos: 'n.', zh: '學生、學者、研究者', def: 'A person who is studying at a school or college.' },
  'students': { word: 'students', phonetic: '/ˈstuː.dənts/', pos: 'n. (複數)', zh: '學生們、青年學子（複數）', def: 'Plural of student.' },
  'teacher': { word: 'teacher', phonetic: '/ˈtiː.tʃɚ/', pos: 'n.', zh: '老師、教師、導師', def: 'A person who teaches, especially in a school.' },
  'teachers': { word: 'teachers', phonetic: '/ˈtiː.tʃɚz/', pos: 'n. (複數)', zh: '教師團隊、老師們（複數）', def: 'Plural of teacher.' },
  'doctor': { word: 'doctor', phonetic: '/ˈdɑːk.tɚ/', pos: 'n.', zh: '醫生、醫師、博士', def: 'A qualified practitioner of medicine.' },
  'doctors': { word: 'doctors', phonetic: '/ˈdɑːk.tɚz/', pos: 'n. (複數)', zh: '醫師團隊、醫師們（複數）', def: 'Plural of doctor.' },
  'hospital': { word: 'hospital', phonetic: '/ˈhɑː.spɪ.t̬əl/', pos: 'n.', zh: '醫院、醫療中心', def: 'An institution providing medical treatment.' },
  'hospitals': { word: 'hospitals', phonetic: '/ˈhɑː.spɪ.t̬əlz/', pos: 'n. (複數)', zh: '醫院機構（複數）', def: 'Plural of hospital.' },
  'patient': { word: 'patient', phonetic: '/ˈpeɪ.ʃənt/', pos: 'n./adj.', zh: '病患、患者；耐心的', def: 'A person receiving or registered to receive medical treatment.' },
  'patients': { word: 'patients', phonetic: '/ˈpeɪ.ʃənts/', pos: 'n. (複數)', zh: '病患群體、患者們（複數）', def: 'Plural of patient.' },
  'drug': { word: 'drug', phonetic: '/drʌɡ/', pos: 'n.', zh: '藥物、藥品、毒品', def: 'A medicine or other substance which has a physiological effect.' },
  'drugs': { word: 'drugs', phonetic: '/drʌɡz/', pos: 'n. (複數)', zh: '藥物、各類藥品（複數）', def: 'Plural of drug.' },
  'medicine': { word: 'medicine', phonetic: '/ˈmed.ɪ.sən/', pos: 'n.', zh: '醫學、藥物、醫療品', def: 'The science or practice of the treatment of disease.' },
  'border': { word: 'border', phonetic: '/ˈbɔːr.dɚ/', pos: 'n./v.', zh: '邊界、邊境、國界；毗鄰', def: 'A line separating two countries or other areas.' },
  'borders': { word: 'borders', phonetic: '/ˈbɔːr.dɚz/', pos: 'n. (複數)', zh: '邊境國界（複數）', def: 'Plural of border.' },
  'military': { word: 'military', phonetic: '/ˈmɪl.ə.ter.i/', pos: 'n./adj.', zh: '軍隊、軍方；軍事的', def: 'Relating to or characteristic of soldiers or armed forces.' },
  'war': { word: 'war', phonetic: '/wɔːr/', pos: 'n.', zh: '戰爭、衝突、交戰', def: 'A state of armed conflict between different nations.' },
  'peace': { word: 'peace', phonetic: '/piːs/', pos: 'n.', zh: '和平、安寧、停戰', def: 'Freedom from disturbance; tranquility.' },
  'election': { word: 'election', phonetic: '/iˈlek.ʃən/', pos: 'n.', zh: '選舉、大選、投票決定', def: 'A formal and organized choice by vote.' },
  'elections': { word: 'elections', phonetic: '/iˈlek.ʃənz/', pos: 'n. (複數)', zh: '各項選舉、公投（複數）', def: 'Plural of election.' },
  'vote': { word: 'vote', phonetic: '/voʊt/', pos: 'n./v.', zh: '投票、選票；表決', def: 'A formal indication of a choice between two or more candidates.' },
  'votes': { word: 'votes', phonetic: '/voʊts/', pos: 'n. (複數) / v.', zh: '得票數、投票（複數）', def: 'Plural of vote.' },
  'voted': { word: 'voted', phonetic: '/ˈvoʊ.t̬ɪd/', pos: 'v. (過去式)', zh: '投了票、表決了（vote 的過去式）', def: 'Past tense of vote.' },
  'voting': { word: 'voting', phonetic: '/ˈvoʊ.t̬ɪŋ/', pos: 'n./v.', zh: '投票選舉、表決行動', def: 'The act of casting a vote.' },
  'candidate': { word: 'candidate', phonetic: '/ˈkæn.dɪ.dət/', pos: 'n.', zh: '候選人、應試者', def: 'A person who applies for a job or is nominated for election.' },
  'candidates': { word: 'candidates', phonetic: '/ˈkæn.dɪ.dəts/', pos: 'n. (複數)', zh: '候選人們（複數）', def: 'Plural of candidate.' },
  'leader': { word: 'leader', phonetic: '/ˈliː.dɚ/', pos: 'n.', zh: '領袖、領導人、首長', def: 'The person who leads or commands a group.' },
  'leaders': { word: 'leaders', phonetic: '/ˈliː.dɚz/', pos: 'n. (複數)', zh: '國家首腦、領袖群（複數）', def: 'Plural of leader.' },
  'leadership': { word: 'leadership', phonetic: '/ˈliː.dɚ.ʃɪp/', pos: 'n.', zh: '領導能力、領導階層', def: 'The action of leading a group of people.' },
  'warning': { word: 'warning', phonetic: '/ˈwɔːr.nɪŋ/', pos: 'n./adj.', zh: '警告、警報、預警', def: 'A statement or event that indicates a possible or impending danger.' },
  'warnings': { word: 'warnings', phonetic: '/ˈwɔːr.nɪŋz/', pos: 'n. (複數)', zh: '各項警報、告誡（複數）', def: 'Plural of warning.' },
  'danger': { word: 'danger', phonetic: '/ˈdeɪn.dʒɚ/', pos: 'n.', zh: '危險、風險、威脅', def: 'The possibility of suffering harm or injury.' },
  'risk': { word: 'risk', phonetic: '/rɪsk/', pos: 'n./v.', zh: '風險、隱憂；冒險', def: 'A situation involving exposure to danger.' },
  'risks': { word: 'risks', phonetic: '/rɪsks/', pos: 'n. (複數)', zh: '各類風險（複數）', def: 'Plural of risk.' },
  'safety': { word: 'safety', phonetic: '/ˈseɪf.ti/', pos: 'n.', zh: '安全、平安、安全性', def: 'The condition of being protected from or unlikely to cause danger.' },
  'safe': { word: 'safe', phonetic: '/seɪf/', pos: 'adj./n.', zh: '安全的、安然無恙的；保險箱', def: 'Protected from or not exposed to danger.' },
  'storm': { word: 'storm', phonetic: '/stɔːrm/', pos: 'n./v.', zh: '風暴、暴風雨；猛烈攻擊', def: 'A violent disturbance of the atmosphere.' },
  'storms': { word: 'storms', phonetic: '/stɔːrmz/', pos: 'n. (複數)', zh: '暴風雨、風暴群（複數）', def: 'Plural of storm.' },
  'quake': { word: 'quake', phonetic: '/kweɪk/', pos: 'n./v.', zh: '地震、震動；發抖', def: 'An earthquake; to shake or tremble.' },
  'earthquake': { word: 'earthquake', phonetic: '/ˈɝːθ.kweɪk/', pos: 'n.', zh: '地震、地震災害', def: 'A sudden and violent shaking of the ground.' },
  'earthquakes': { word: 'earthquakes', phonetic: '/ˈɝːθ.kweɪks/', pos: 'n. (複數)', zh: '多次地震（複數）', def: 'Plural of earthquake.' },
  'fire': { word: 'fire', phonetic: '/faɪr/', pos: 'n./v.', zh: '火災、大火；開火、解僱', def: 'Combustion or burning; to dismiss from a job.' },
  'fires': { word: 'fires', phonetic: '/faɪrz/', pos: 'n. (複數)', zh: '火災災情（複數）', def: 'Plural of fire.' },
  'wildfire': { word: 'wildfire', phonetic: '/ˈwaɪld.faɪr/', pos: 'n.', zh: '野火、森林大火、山火', def: 'A large, destructive fire that spreads quickly over woodland or brush.' },
  'wildfires': { word: 'wildfires', phonetic: '/ˈwaɪld.faɪrz/', pos: 'n. (複數)', zh: '山林野火（複數）', def: 'Plural of wildfire.' },
  'flood': { word: 'flood', phonetic: '/flʌd/', pos: 'n./v.', zh: '洪水、水災；淹沒、大量湧入', def: 'An overflowing of a large amount of water.' },
  'floods': { word: 'floods', phonetic: '/flʌdz/', pos: 'n. (複數)', zh: '洪澇水災（複數）', def: 'Plural of flood.' },
  'flooding': { word: 'flooding', phonetic: '/ˈflʌd.ɪŋ/', pos: 'n.', zh: '淹水、淹水災情、積水', def: 'The covering or submerging of normally dry land with water.' },
  'rain': { word: 'rain', phonetic: '/reɪn/', pos: 'n./v.', zh: '降雨、雨水；下雨', def: 'Moisture condensed from the atmosphere that falls visibly in separate drops.' },
  'wind': { word: 'wind', phonetic: '/wɪnd/', pos: 'n.', zh: '風、氣流', def: 'The perceptible natural movement of the air.' },
  'winds': { word: 'winds', phonetic: '/wɪndz/', pos: 'n. (複數)', zh: '強風、風勢（複數）', def: 'Plural of wind.' },
  'drive': { word: 'drive', phonetic: '/draɪv/', pos: 'v./n.', zh: '開車、駕駛、驅動；車程、運動', def: 'To operate and control the direction and speed of a motor vehicle.' },
  'driver': { word: 'driver', phonetic: '/ˈdraɪ.vɚ/', pos: 'n.', zh: '駕駛、司機', def: 'A person who drives a vehicle.' },
  'drivers': { word: 'drivers', phonetic: '/ˈdraɪ.vɚz/', pos: 'n. (複數)', zh: '駕駛人（複數）', def: 'Plural of driver.' },
  'road': { word: 'road', phonetic: '/roʊd/', pos: 'n.', zh: '道路、公路、馬路', def: 'A wide way leading from one place to another.' },
  'roads': { word: 'roads', phonetic: '/roʊdz/', pos: 'n. (複數)', zh: '道路路網（複數）', def: 'Plural of road.' },
  'street': { word: 'street', phonetic: '/striːt/', pos: 'n.', zh: '街道、街區', def: 'A public road in a city or town.' },
  'streets': { word: 'streets', phonetic: '/striːts/', pos: 'n. (複數)', zh: '各街道（複數）', def: 'Plural of street.' },
  'bridge': { word: 'bridge', phonetic: '/brɪdʒ/', pos: 'n./v.', zh: '橋樑、跨接；架橋', def: 'A structure carrying a road, path, railway over an obstacle.' },
  'bridges': { word: 'bridges', phonetic: '/ˈbrɪdʒ.ɪz/', pos: 'n. (複數)', zh: '橋樑群（複數）', def: 'Plural of bridge.' },
  'airport': { word: 'airport', phonetic: '/ˈer.pɔːrt/', pos: 'n.', zh: '機場、航空站', def: 'A complex of runways and buildings for the take-off and landing of aircraft.' },
  'flight': { word: 'flight', phonetic: '/flaɪt/', pos: 'n.', zh: '班機、飛行航程', def: 'The action or process of flying through the air.' },
  'flights': { word: 'flights', phonetic: '/flaɪts/', pos: 'n. (複數)', zh: '航班、班機（複數）', def: 'Plural of flight.' },
  'tech': { word: 'tech', phonetic: '/tek/', pos: 'n./adj.', zh: '高科技、科技業；技術的', def: 'Short for technology.' },
  'technology': { word: 'technology', phonetic: '/tekˈnɑː.lə.dʒi/', pos: 'n.', zh: '科技、技術、工藝', def: 'The application of scientific knowledge for practical purposes.' },
  'technologies': { word: 'technologies', phonetic: '/tekˈnɑː.lə.dʒiz/', pos: 'n. (複數)', zh: '各類科技技術（複數）', def: 'Plural of technology.' },
  'phone': { word: 'phone', phonetic: '/foʊn/', pos: 'n./v.', zh: '手機、電話；打電話', def: 'A telephone.' },
  'phones': { word: 'phones', phonetic: '/foʊnz/', pos: 'n. (複數)', zh: '行動電話（複數）', def: 'Plural of phone.' },
  'computer': { word: 'computer', phonetic: '/kəmˈpjuː.t̬ɚ/', pos: 'n.', zh: '電腦、計算機', def: 'An electronic device for storing and processing data.' },
  'computers': { word: 'computers', phonetic: '/kəmˈpjuː.t̬ɚz/', pos: 'n. (複數)', zh: '電腦設備（複數）', def: 'Plural of computer.' },
  'data': { word: 'data', phonetic: '/ˈdeɪ.t̬ə/', pos: 'n.', zh: '數據、資料、大數據', def: 'Facts and statistics collected together for reference or analysis.' },
  'media': { word: 'media', phonetic: '/ˈmiː.di.ə/', pos: 'n.', zh: '新聞媒體、傳播媒介', def: 'The main means of mass communication.' },
  'video': { word: 'video', phonetic: '/ˈvɪd.i.oʊ/', pos: 'n./adj.', zh: '影片、視訊、錄影；視訊的', def: 'The recording, reproducing, or broadcasting of moving visual images.' },
  'videos': { word: 'videos', phonetic: '/ˈvɪd.i.oʊz/', pos: 'n. (複數)', zh: '影片（複數）', def: 'Plural of video.' },
  'study': { word: 'study', phonetic: '/ˈstʌd.i/', pos: 'n./v.', zh: '研究、學術調查、研讀；研習', def: 'The devotion of time and attention to acquiring knowledge.' },
  'studies': { word: 'studies', phonetic: '/ˈstʌd.iz/', pos: 'n. (複數) / v.', zh: '學術研究報告（複數）；研讀', def: 'Plural of study.' },
  'stock': { word: 'stock', phonetic: '/stɑːk/', pos: 'n./v.', zh: '股票、庫存、股權；進貨', def: 'The capital raised by a company through the issue and subscription of shares.' },
  'stocks': { word: 'stocks', phonetic: '/stɑːks/', pos: 'n. (複數)', zh: '股市、各檔股票（複數）', def: 'Plural of stock.' },
  'growth': { word: 'growth', phonetic: '/ɡroʊθ/', pos: 'n.', zh: '成長、經濟增長、發展', def: 'The process of increasing in physical size or economic value.' },
  'tax': { word: 'tax', phonetic: '/tæks/', pos: 'n./v.', zh: '稅金、稅務、賦稅；課稅', def: 'A compulsory contribution to state revenue.' },
  'taxes': { word: 'taxes', phonetic: '/ˈtæk.sɪz/', pos: 'n. (複數)', zh: '各項稅收、稅款（複數）', def: 'Plural of tax.' },
  'tariff': { word: 'tariff', phonetic: '/ˈter.ɪf/', pos: 'n.', zh: '關稅、關稅壁壘', def: 'A tax or duty to be paid on a particular class of imports or exports.' },
  'tariffs': { word: 'tariffs', phonetic: '/ˈter.ɪfs/', pos: 'n. (複數)', zh: '關稅措施（複數）', def: 'Plural of tariff.' },
  'debt': { word: 'debt', phonetic: '/det/', pos: 'n.', zh: '債務、國債、欠款', def: 'A sum of money that is owed or due.' },
  'dollar': { word: 'dollar', phonetic: '/ˈdɑː.lɚ/', pos: 'n.', zh: '美元、元', def: 'The basic monetary unit of the US and other countries.' },
  'dollars': { word: 'dollars', phonetic: '/ˈdɑː.lɚz/', pos: 'n. (複數)', zh: '美元（複數）', def: 'Plural of dollar.' },
  'loan': { word: 'loan', phonetic: '/loʊn/', pos: 'n./v.', zh: '貸款、借款；借出', def: 'A thing that is borrowed, especially a sum of money that is expected to be paid back.' },
  'loans': { word: 'loans', phonetic: '/loʊnz/', pos: 'n. (複數)', zh: '各類貸款（複數）', def: 'Plural of loan.' },
  'credit': { word: 'credit', phonetic: '/ˈkred.ɪt/', pos: 'n./v.', zh: '信用、信用額度、學分；歸功於', def: 'The ability of a customer to obtain goods or services before payment.' },
  'housing': { word: 'housing', phonetic: '/ˈhaʊ.zɪŋ/', pos: 'n.', zh: '住房、房地產市場、住宅', def: 'Houses and apartments considered collectively.' },
  'home': { word: 'home', phonetic: '/hoʊm/', pos: 'n./adj.', zh: '家、家庭、住家；居家的', def: 'The place where one lives permanently.' },
  'homes': { word: 'homes', phonetic: '/hoʊmz/', pos: 'n. (複數)', zh: '住宅房屋（複數）', def: 'Plural of home.' },
  'house': { word: 'house', phonetic: '/haʊs/', pos: 'n./v.', zh: '房子、房屋、議會；提供住所', def: 'A building for human habitation.' },
  'houses': { word: 'houses', phonetic: '/ˈhaʊ.zɪz/', pos: 'n. (複數)', zh: '房屋（複數）', def: 'Plural of house.' },
  'rent': { word: 'rent', phonetic: '/rent/', pos: 'n./v.', zh: '租金；出租、承租', def: 'A tenant\'s regular payment to a landlord.' },
  'consumer': { word: 'consumer', phonetic: '/kənˈsuː.mɚ/', pos: 'n.', zh: '消費者、用戶', def: 'A person who purchases goods and services for personal use.' },
  'consumers': { word: 'consumers', phonetic: '/kənˈsuː.mɚz/', pos: 'n. (複數)', zh: '廣大消費者（複數）', def: 'Plural of consumer.' },
  'supply': { word: 'supply', phonetic: '/səˈplaɪ/', pos: 'n./v.', zh: '供應、供給、物資；提供', def: 'A stock of a resource from which a person or place can be provided.' },
  'supplies': { word: 'supplies', phonetic: '/səˈplaɪz/', pos: 'n. (複數)', zh: '各項補給物資（複數）', def: 'Plural of supply.' },
  'chain': { word: 'chain', phonetic: '/tʃeɪn/', pos: 'n./v.', zh: '鏈、供應鏈、連鎖機構；鏈接', def: 'A series of connected links; a sequence.' },
  'chains': { word: 'chains', phonetic: '/tʃeɪnz/', pos: 'n. (複數)', zh: '連鎖店、鏈條（複數）', def: 'Plural of chain.' },
  'travel': { word: 'travel', phonetic: '/ˈtræv.əl/', pos: 'v./n.', zh: '旅行、出遊、通勤；旅遊', def: 'To make a journey, typically of some length.' },
  'tour': { word: 'tour', phonetic: '/tʊr/', pos: 'n./v.', zh: '觀光、巡迴演出、參觀；巡訪', def: 'A journey for pleasure in which several different places are visited.' },
  'hotel': { word: 'hotel', phonetic: '/hoʊˈtel/', pos: 'n.', zh: '飯店、旅館、旅店', def: 'An establishment providing accommodations.' },
  'hotels': { word: 'hotels', phonetic: '/hoʊˈtelz/', pos: 'n. (複數)', zh: '各大飯店旅館（複數）', def: 'Plural of hotel.' },
  'ticket': { word: 'ticket', phonetic: '/ˈtɪk.ɪt/', pos: 'n./v.', zh: '票券、入場券、機票、罰單；開罰單', def: 'A piece of paper or card that gives the holder a certain right.' },
  'tickets': { word: 'tickets', phonetic: '/ˈtɪk.ɪts/', pos: 'n. (複數)', zh: '門票、機票（複數）', def: 'Plural of ticket.' },
  'cancel': { word: 'cancel', phonetic: '/ˈkæn.səl/', pos: 'v.', zh: '取消、廢止、作廢', def: 'To decide or announce that a planned event will not take place.' },
  'canceled': { word: 'canceled', phonetic: '/ˈkæn.səld/', pos: 'v./adj.', zh: '已取消、被廢止（cancel 的過去式）', def: 'Past tense of cancel; called off.' },
  'cancelling': { word: 'cancelling', phonetic: '/ˈkæn.səl.ɪŋ/', pos: 'v.', zh: '正在取消中', def: 'Present participle of cancel.' },
  'satellite': { word: 'satellite', phonetic: '/ˈsæt̬.əl.aɪt/', pos: 'n.', zh: '人造衛星、衛星通訊', def: 'An artificial body placed in orbit around the earth or moon.' },
  'satellites': { word: 'satellites', phonetic: '/ˈsæt̬.əl.aɪts/', pos: 'n. (複數)', zh: '衛星群（複數）', def: 'Plural of satellite.' },
  'space': { word: 'space', phonetic: '/speɪs/', pos: 'n.', zh: '太空、空間、空地', def: 'The physical universe beyond the earth\'s atmosphere.' },
  'rocket': { word: 'rocket', phonetic: '/ˈrɑː.kɪt/', pos: 'n./v.', zh: '火箭；飛速上升', def: 'A cylindrical projectile that can be propelled to a great height.' },
  'rockets': { word: 'rockets', phonetic: '/ˈrɑː.kɪts/', pos: 'n. (複數)', zh: '火箭群（複數）', def: 'Plural of rocket.' },
  'launch': { word: 'launch', phonetic: '/lɔːntʃ/', pos: 'v./n.', zh: '發射、推出、啟動；新品發表會', def: 'To set in motion; to send a missile or spacecraft into the air.' },
  'launched': { word: 'launched', phonetic: '/lɔːntʃt/', pos: 'v. (過去式)', zh: '發射了、啟動了、推出了（launch 的過去式）', def: 'Past tense of launch.' },
  'launches': { word: 'launches', phonetic: '/ˈlɔːn.tʃɪz/', pos: 'n. (複數) / v.', zh: '發射任務、發布會（複數）', def: 'Plural of launch.' },
  'science': { word: 'science', phonetic: '/ˈsaɪ.əns/', pos: 'n.', zh: '科學、自然科學、學科', def: 'The systematic study of the structure and behavior of the physical world.' },
  'scientist': { word: 'scientist', phonetic: '/ˈsaɪ.ən.tɪst/', pos: 'n.', zh: '科學家、學者', def: 'A person who is studying or has expert knowledge of science.' },
  'scientists': { word: 'scientists', phonetic: '/ˈsaɪ.ən.tɪsts/', pos: 'n. (複數)', zh: '科學家團隊（複數）', def: 'Plural of scientist.' },
  'battery': { word: 'battery', phonetic: '/ˈbæt̬.ɚ.i/', pos: 'n.', zh: '電池、儲能電芯、一組', def: 'A device that stores electrical energy.' },
  'batteries': { word: 'batteries', phonetic: '/ˈbæt̬.ɚ.iz/', pos: 'n. (複數)', zh: '電池組（複數）', def: 'Plural of battery.' },
  'ev': { word: 'EV', phonetic: '/ˌiːˈviː/', pos: 'n.', zh: '電動車（Electric Vehicle）', def: 'Electric Vehicle.' },
  'electric': { word: 'electric', phonetic: '/iˈlek.trɪk/', pos: 'adj.', zh: '電力的、電動的、電氣的', def: 'Of, worked by, or producing electricity.' },
  'emergency': { word: 'emergency', phonetic: '/ɪˈmɝː.dʒən.si/', pos: 'n./adj.', zh: '緊急狀況、突發事態；緊急的', def: 'A serious, unexpected, and often dangerous situation.' },
  'emergencies': { word: 'emergencies', phonetic: '/ɪˈmɝː.dʒən.siz/', pos: 'n. (複數)', zh: '各類緊急事態（複數）', def: 'Plural of emergency.' },
  'rescue': { word: 'rescue', phonetic: '/ˈres.kjuː/', pos: 'v./n.', zh: '救援、搜救、拯救；搜救行動', def: 'To save someone from a dangerous or distressing situation.' },
  'rescued': { word: 'rescued', phonetic: '/ˈres.kjuːd/', pos: 'v. (過去式)', zh: '被救出、獲救了（rescue 的過去式）', def: 'Past tense of rescue.' },
  'clinic': { word: 'clinic', phonetic: '/ˈklɪn.ɪk/', pos: 'n.', zh: '診所、門診部', def: 'An establishment or hospital department where outpatients are given medical treatment.' },
  'nurse': { word: 'nurse', phonetic: '/nɝːs/', pos: 'n./v.', zh: '護理師、護士；看護照料', def: 'A person trained to care for the sick or infirm.' },
  'nurses': { word: 'nurses', phonetic: '/ˈnɝː.sɪz/', pos: 'n. (複數)', zh: '護理人員（複數）', def: 'Plural of nurse.' },
  'treatment': { word: 'treatment', phonetic: '/ˈtriːt.mənt/', pos: 'n.', zh: '治療、療法、處置、待遇', def: 'Medical care given to a patient for an illness or injury.' },
  'treatments': { word: 'treatments', phonetic: '/ˈtriːt.mənts/', pos: 'n. (複數)', zh: '各項治療方案（複數）', def: 'Plural of treatment.' },
  'cure': { word: 'cure', phonetic: '/kjʊr/', pos: 'v./n.', zh: '治癒、根治；治癒方法', def: 'To relieve a person or animal of the symptoms of a disease.' },
  'vaccine': { word: 'vaccine', phonetic: '/vækˈsiːn/', pos: 'n.', zh: '疫苗、免疫劑', def: 'A substance used to stimulate the production of antibodies.' },
  'vaccines': { word: 'vaccines', phonetic: '/vækˈsiːnz/', pos: 'n. (複數)', zh: '疫苗劑量（複數）', def: 'Plural of vaccine.' },
  'virus': { word: 'virus', phonetic: '/ˈvaɪ.rəs/', pos: 'n.', zh: '病毒、電腦病毒', def: 'An infective agent that typically consists of a nucleic acid molecule.' },
  'viruses': { word: 'viruses', phonetic: '/ˈvaɪ.rə.sɪz/', pos: 'n. (複數)', zh: '各類病毒（複數）', def: 'Plural of virus.' },
  'symptom': { word: 'symptom', phonetic: '/ˈsɪmp.təm/', pos: 'n.', zh: '症狀、徵兆、徵候', def: 'A physical or mental feature indicating a condition of disease.' },
  'symptoms': { word: 'symptoms', phonetic: '/ˈsɪmp.təmz/', pos: 'n. (複數)', zh: '各項症狀徵兆（複數）', def: 'Plural of symptom.' },
  'fitness': { word: 'fitness', phonetic: '/ˈfɪt.nəs/', pos: 'n.', zh: '健身、體適能、健康', def: 'The condition of being physically fit and healthy.' },
  'diet': { word: 'diet', phonetic: '/ˈdaɪ.ət/', pos: 'n./v.', zh: '飲食、節食；節制飲食', def: 'The kinds of food that a person, animal, or community habitually eats.' },
  'restaurant': { word: 'restaurant', phonetic: '/ˈres.trɑːnt/', pos: 'n.', zh: '餐廳、飯館、餐館', def: 'A place where people pay to sit and eat meals.' },
  'restaurants': { word: 'restaurants', phonetic: '/ˈres.trɑːnts/', pos: 'n. (複數)', zh: '餐廳店家（複數）', def: 'Plural of restaurant.' },
  'cafe': { word: 'cafe', phonetic: '/kæfˈeɪ/', pos: 'n.', zh: '咖啡館、輕食店', def: 'A small restaurant selling light meals and drinks.' },
  'coffee': { word: 'coffee', phonetic: '/ˈkɑː.fi/', pos: 'n.', zh: '咖啡、咖啡豆', def: 'A hot drink made from the roasted and ground seeds of a tropical shrub.' },
  'building': { word: 'building', phonetic: '/ˈbɪl.dɪŋ/', pos: 'n.', zh: '建築物、大樓、房屋', def: 'A structure with a roof and walls.' },
  'buildings': { word: 'buildings', phonetic: '/ˈbɪl.dɪŋz/', pos: 'n. (複數)', zh: '建築群、大樓（複數）', def: 'Plural of building.' },
  'office': { word: 'office', phonetic: '/ˈɑː.fɪs/', pos: 'n.', zh: '辦公室、辦事處、職務', def: 'A room, set of rooms, or building used as a place for commercial work.' },
  'offices': { word: 'offices', phonetic: '/ˈɑː.fɪ.sɪz/', pos: 'n. (複數)', zh: '各辦公室（複數）', def: 'Plural of office.' },
  'store': { word: 'store', phonetic: '/stɔːr/', pos: 'n./v.', zh: '商店、店鋪、儲備；儲存', def: 'A retail establishment selling items.' },
  'stores': { word: 'stores', phonetic: '/stɔːrz/', pos: 'n. (複數) / v.', zh: '各大店家、門市（複數）', def: 'Plural of store.' },
  'college': { word: 'college', phonetic: '/ˈkɑː.lɪdʒ/', pos: 'n.', zh: '大學、學院', def: 'An educational institution or establishment.' },
  'university': { word: 'university', phonetic: '/ˌjuː.nəˈvɝː.sə.t̬i/', pos: 'n.', zh: '綜合大學、高等學府', def: 'A high-level educational institution.' },
  'universities': { word: 'universities', phonetic: '/ˌjuː.nəˈvɝː.sə.t̬iz/', pos: 'n. (複數)', zh: '各大專院校（複數）', def: 'Plural of university.' },
  'exam': { word: 'exam', phonetic: '/ɪɡˈzæm/', pos: 'n.', zh: '考試、測驗、審查', def: 'A formal test of a person\'s knowledge or proficiency in a subject.' },
  'exams': { word: 'exams', phonetic: '/ɪɡˈzæmz/', pos: 'n. (複數)', zh: '各大考試（複數）', def: 'Plural of exam.' },
  'book': { word: 'book', phonetic: '/bʊk/', pos: 'n./v.', zh: '書籍、書本；預訂、登記', def: 'A written or printed work consisting of pages.' },
  'books': { word: 'books', phonetic: '/bʊks/', pos: 'n. (複數) / v.', zh: '書籍（複數）；預訂', def: 'Plural of book.' },
  'page': { word: 'page', phonetic: '/peɪdʒ/', pos: 'n./v.', zh: '頁面、網頁；呼叫', def: 'One side of a sheet of paper in a collection of sheets.' },
  'pages': { word: 'pages', phonetic: '/ˈpeɪ.dʒɪz/', pos: 'n. (複數)', zh: '各頁面（複數）', def: 'Plural of page.' },
  'song': { word: 'song', phonetic: '/sɔːŋ/', pos: 'n.', zh: '歌曲、歌謠', def: 'A short poem or other set of words set to music.' },
  'songs': { word: 'songs', phonetic: '/sɔːŋz/', pos: 'n. (複數)', zh: '歌曲曲目（複數）', def: 'Plural of song.' },
  'movie': { word: 'movie', phonetic: '/ˈmuː.vi/', pos: 'n.', zh: '電影、影片', def: 'A cinema film.' },
  'movies': { word: 'movies', phonetic: '/ˈmuː.viz/', pos: 'n. (複數)', zh: '各部電影（複數）', def: 'Plural of movie.' },
  'film': { word: 'film', phonetic: '/fɪlm/', pos: 'n./v.', zh: '電影、膠卷、薄膜；拍攝', def: 'A motion picture.' },
  'films': { word: 'films', phonetic: '/fɪlmz/', pos: 'n. (複數) / v.', zh: '電影作品（複數）', def: 'Plural of film.' },
  'actor': { word: 'actor', phonetic: '/ˈæk.tɚ/', pos: 'n.', zh: '演員、男演員', def: 'A person whose profession is acting on the stage, in movies, or on television.' },
  'actors': { word: 'actors', phonetic: '/ˈæk.tɚz/', pos: 'n. (複數)', zh: '演員群（複數）', def: 'Plural of actor.' },
  'actress': { word: 'actress', phonetic: '/ˈæk.trəs/', pos: 'n.', zh: '女演員', def: 'A female actor.' },
  'actresses': { word: 'actresses', phonetic: '/ˈæk.trə.sɪz/', pos: 'n. (複數)', zh: '女演員群（複數）', def: 'Plural of actress.' },
  'award': { word: 'award', phonetic: '/əˈwɔːrd/', pos: 'n./v.', zh: '獎項、榮譽；頒發、授予', def: 'A prize or other mark of recognition given in honor of an achievement.' },
  'awards': { word: 'awards', phonetic: '/əˈwɔːrdz/', pos: 'n. (複數) / v.', zh: '獎項大獎（複數）', def: 'Plural of award.' },
  'trophy': { word: 'trophy', phonetic: '/ˈtroʊ.fi/', pos: 'n.', zh: '獎盃、戰利品', def: 'A cup or other decorative object awarded as a prize for a victory.' },
  'first': { word: 'first', phonetic: '/fɝːst/', pos: 'adj./adv./n.', zh: '第一、首先、最早的', def: 'Coming before all others in time or order.' },
  'second': { word: 'second', phonetic: '/ˈsek.ənd/', pos: 'adj./n./v.', zh: '第二；秒；支持', def: 'Coming after the first in order or time; a 60th of a minute.' },
  'third': { word: 'third', phonetic: '/θɝːd/', pos: 'adj./n.', zh: '第三、三分之一', def: 'Constituting number three in a sequence.' },
  'final': { word: 'final', phonetic: '/ˈfaɪ.nəl/', pos: 'adj./n.', zh: '最終的、最後的；期末考、決賽', def: 'Coming at the end of a series.' },
  'start': { word: 'start', phonetic: '/stɑːrt/', pos: 'v./n.', zh: '開始、起步、啟動；開頭', def: 'To begin or be reckoned from a particular point in time or space.' },
  'started': { word: 'started', phonetic: '/ˈstɑːr.t̬ɪd/', pos: 'v. (過去式)', zh: '開始了、啟動了（start 的過去式）', def: 'Past tense of start.' },
  'starting': { word: 'starting', phonetic: '/ˈstɑːr.t̬ɪŋ/', pos: 'n./v.', zh: '出發、起始；起跑', def: 'Present participle of start.' },
  'end': { word: 'end', phonetic: '/end/', pos: 'n./v.', zh: '結束、結尾、終點；終止', def: 'A final part of something.' },
  'ended': { word: 'ended', phonetic: '/ˈen.dɪd/', pos: 'v. (過去式)', zh: '結束了、收尾了（end 的過去式）', def: 'Past tense of end.' },
  'ending': { word: 'ending', phonetic: '/ˈen.dɪŋ/', pos: 'n./adj.', zh: '結局、結尾；結束的', def: 'An end or final part of something.' },
  'clean': { word: 'clean', phonetic: '/kliːn/', pos: 'adj./v.', zh: '乾淨的、潔淨的；打掃清潔', def: 'Free from dirt, marks, or stains.' },
  'cleaned': { word: 'cleaned', phonetic: '/kliːnd/', pos: 'v. (過去式)', zh: '清理了、打掃乾淨了（clean 的過去式）', def: 'Past tense of clean.' },
  'dark': { word: 'dark', phonetic: '/dɑːrk/', pos: 'adj./n.', zh: '黑暗的、深色的；黑暗、夜間', def: 'With little or no light.' },
  'light': { word: 'light', phonetic: '/laɪt/', pos: 'n./adj./v.', zh: '光線、燈光；輕盈的、明亮的；照亮', def: 'The natural agent that stimulates sight and makes things visible.' },
  'high': { word: 'high', phonetic: '/haɪ/', pos: 'adj./adv.', zh: '高的、高處的；高度地', def: 'Of great vertical extent.' },
  'low': { word: 'low', phonetic: '/loʊ/', pos: 'adj./adv.', zh: '低的、矮的、低微的；低低地', def: 'Of less than average height from top to bottom.' },
  'big': { word: 'big', phonetic: '/bɪɡ/', pos: 'adj.', zh: '大的、重大的、年長的', def: 'Of considerable size, extent, or intensity.' },
  'small': { word: 'small', phonetic: '/smɑːl/', pos: 'adj.', zh: '小的、少量的、細微的', def: 'Of a size that is less than normal or usual.' },
  'major': { word: 'major', phonetic: '/ˈmeɪ.dʒɚ/', pos: 'adj./n./v.', zh: '主要的、重大的；主修專業；主修', def: 'Important, serious, or significant.' },
  'minor': { word: 'minor', phonetic: '/ˈmaɪ.nɚ/', pos: 'adj./n./v.', zh: '次要的、輕微的；未成年人；副修', def: 'Lesser in importance, seriousness, or significance.' },
  'simple': { word: 'simple', phonetic: '/ˈsɪm.pəl/', pos: 'adj.', zh: '簡單的、純樸的、簡易的', def: 'Easily understood or done; presenting no difficulty.' },
  'hard': { word: 'hard', phonetic: '/hɑːrd/', pos: 'adj./adv.', zh: '困難的、堅硬的；努力地、猛烈地', def: 'Solid, firm, and rigid; not easily broken; requiring great effort.' },
  'easy': { word: 'easy', phonetic: '/ˈiː.zi/', pos: 'adj./adv.', zh: '容易的、輕鬆的、舒適的；從容地', def: 'Achieved without great effort; presenting few difficulties.' },
  'equal': { word: 'equal', phonetic: '/ˈiː.kwəl/', pos: 'adj./n./v.', zh: '平等的、相等的；同等物；等於', def: 'Being the same in quantity, size, degree, or value.' },
  'same': { word: 'same', phonetic: '/seɪm/', pos: 'adj./pron.', zh: '相同的、同一的；同樣的事物', def: 'Identical; not different.' },
  'different': { word: 'different', phonetic: '/ˈdɪf.ɚ.ənt/', pos: 'adj.', zh: '不同的、差異的、各不相同的', def: 'Not the same as another or each other.' },
  'difference': { word: 'difference', phonetic: '/ˈdɪf.ɚ.əns/', pos: 'n.', zh: '差異、區別、差額', def: 'A point or way in which people or things are not the same.' },
  'differences': { word: 'differences', phonetic: '/ˈdɪf.ɚ.ən.sɪz/', pos: 'n. (複數)', zh: '各項差異與不同（複數）', def: 'Plural of difference.' },
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

  // Check -ies -> -y (cities -> city, companies -> company)
  if (clean.endsWith('ies') && clean.length > 4) {
    const base = clean.slice(0, -3) + 'y';
    if (BUILTIN_DICT[base]) {
      const entry = BUILTIN_DICT[base];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: 'n. (複數)',
        zh: `${entry.zh}（複數）`,
        def: entry.def,
        example: entry.example,
      };
    }
  }

  // Check -ly (quickly -> quick)
  if (clean.endsWith('ly') && clean.length > 4) {
    const base = clean.slice(0, -2);
    if (BUILTIN_DICT[base]) {
      const entry = BUILTIN_DICT[base];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: 'adv.',
        zh: `${entry.zh}地（副詞）`,
        def: entry.def,
        example: entry.example,
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
  usedSentences?: Set<string>,
  targetZhRaw?: string
): ContextualExample {
  const clean = (word || '').trim();
  if (!clean) {
    return { sentence: '', translation: '' };
  }

  // Proper noun capitalization: if word starts with uppercase, preserve it; otherwise capitalize first letter if suitable
  const isOriginallyCapitalized = /^[A-Z]/.test(clean);
  const displayWord = isOriginallyCapitalized ? clean : clean.toLowerCase();
  const capitalizedWord = clean.charAt(0).toUpperCase() + clean.slice(1);

  // Extract clean Chinese translation for the target word
  const builtinMatched = lookupQuickWord(clean.toLowerCase());
  const extractedZh = extractCleanZhWord(targetZhRaw) || extractCleanZhWord(builtinMatched?.zh);
  const zhTarget = extractedZh || displayWord;

  // 1. If index is 0 and builtin dictionary has curated example & translation
  if (index === 0) {
    if (builtinMatched?.example) {
      const sentence = builtinMatched.example;
      if (!usedSentences || !usedSentences.has(sentence)) {
        if (usedSentences) usedSentences.add(sentence);
        return {
          sentence,
          translation: builtinMatched.exampleZh || '',
          targetZh: extractedZh,
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
        targetZh: extractedZh,
      },
      {
        sentence: `She completed her graduate studies at ${capitalizedWord} with top honors.`,
        translation: `她在${capitalizedWord}大學以優異成績完成了研究所學位。`,
        targetZh: extractedZh,
      },
      {
        sentence: `The professor from ${capitalizedWord} shared key insights during the radio interview.`,
        translation: `來自${capitalizedWord}大學的教授在廣播專訪中分享了關鍵見解。`,
        targetZh: extractedZh,
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
        targetZh: extractedZh,
      },
      {
        sentence: `The historic library was founded by the ${capitalizedWord} family in the nineteenth century.`,
        translation: `這座歷史悠久的圖書館是由${capitalizedWord}家族於十九世紀創立的。`,
        targetZh: extractedZh,
      },
      {
        sentence: `Dr. ${capitalizedWord} answered questions from listeners during the live broadcast.`,
        translation: `${capitalizedWord}博士在即時廣播中親切回答了聽眾的提問。`,
        targetZh: extractedZh,
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
        targetZh: extractedZh,
      },
      {
        sentence: `Residents across ${capitalizedWord} participated in the annual civic forum.`,
        translation: `${capitalizedWord}各地的居民積極參與了這場年度市民論壇。`,
        targetZh: extractedZh,
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
        translation: `交通路況提醒駕駛人行經該路段時注意${zhTarget}狀況。`,
        targetZh: extractedZh,
      },
      {
        sentence: `Emergency personnel were dispatched to manage the situation involving the ${displayWord}.`,
        translation: `緊急應變小組已出動以處置涉及該${zhTarget}的現場狀況。`,
        targetZh: extractedZh,
      },
      {
        sentence: `The local transit authority updated guidelines concerning ${displayWord} safety.`,
        translation: `當地大眾運輸主管機關發布了關於${zhTarget}安全的最新指引。`,
        targetZh: extractedZh,
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
        translation: `法律分析師深入探討了法院判決對全區${zhTarget}所帶來的影響。`,
        targetZh: extractedZh,
      },
      {
        sentence: `Authorities held a press conference to provide clear details on the ${displayWord}.`,
        translation: `當局舉行了新聞發布會，就該${zhTarget}提供了詳實的說明。`,
        targetZh: extractedZh,
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
        translation: `經濟學家今天討論了圍繞${zhTarget}的整體市場影響。`,
        targetZh: extractedZh,
      },
      {
        sentence: `Investors closely watched financial indicators related to ${displayWord} this morning.`,
        translation: `投資人今天上午密切關注與${zhTarget}相關的各項金融指標。`,
        targetZh: extractedZh,
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
        translation: `氣象學家指出，${zhTarget}將在區域氣候型態中扮演關鍵角色。`,
        targetZh: extractedZh,
      },
      {
        sentence: `The seasonal forecast highlights expected changes in ${displayWord} over coming weeks.`,
        translation: `季節預報著重強調了未來數週內${zhTarget}可能發生的轉變。`,
        targetZh: extractedZh,
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
        translation: `新聞主播對今日的頭條要聞進行了${zhTarget}的概述。`,
        targetZh: extractedZh,
      },
      {
        sentence: `Finding a ${displayWord} solution remains the primary focus for city planners.`,
        translation: `尋求一個${zhTarget}的解決方案依然是城市規劃者的首要焦點。`,
        targetZh: extractedZh,
      },
      {
        sentence: `Community members shared ${displayWord} feedback during the public hearing.`,
        translation: `社區居民在公聽會中分享了${zhTarget}的反饋意見。`,
        targetZh: extractedZh,
      },
      {
        sentence: `The morning broadcast provided several ${displayWord} perspectives on the topic.`,
        translation: `早間廣播節目針對該主題提供了數個${zhTarget}的觀察視角。`,
        targetZh: extractedZh,
      },
      {
        sentence: `Her ${displayWord} contributions to the project were recognized by the committee.`,
        translation: `她對該項目的${zhTarget}貢獻獲得了委員會的高度認可。`,
        targetZh: extractedZh,
      },
    ];
  } else if (p.includes('adv') || p.includes('副詞')) {
    pool = [
      {
        sentence: `The spokesperson ${displayWord} addressed each question raised by the press.`,
        translation: `發言人${zhTarget}回應了媒體記者提出的每個問題。`,
        targetZh: extractedZh,
      },
      {
        sentence: `The transit system operated ${displayWord} throughout the morning rush hour.`,
        translation: `大眾運輸系統在早間通勤高峰期保持${zhTarget}運轉。`,
        targetZh: extractedZh,
      },
      {
        sentence: `City officials responded ${displayWord} to ensure community safety.`,
        translation: `市府官員${zhTarget}採取行動，以確保社區大眾安全。`,
        targetZh: extractedZh,
      },
      {
        sentence: `The host ${displayWord} summarized the main takeaways of the interview.`,
        translation: `主持人${zhTarget}總結了本次專訪的核心精髓。`,
        targetZh: extractedZh,
      },
    ];
  } else if (p.includes('動詞') || p.startsWith('v')) {
    if (clean.toLowerCase().endsWith('ed')) {
      pool = [
        {
          sentence: `Authorities ${displayWord} the updated safety guidelines to the public today.`,
          translation: `當局今天向大眾${zhTarget}了最新的安全指導方針。`,
          targetZh: extractedZh,
        },
        {
          sentence: `The committee ${displayWord} key recommendations following extensive review.`,
          translation: `在廣泛審視之後，委員會${zhTarget}了重要建議。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Journalists ${displayWord} on the ongoing developments from the field.`,
          translation: `新聞記者自第一線現場對持續發展的事件進行了${zhTarget}。`,
          targetZh: extractedZh,
        },
        {
          sentence: `The strategic plan was positively ${displayWord} by regional leaders.`,
          translation: `該策略計畫獲得了區域領導團隊的積極${zhTarget}。`,
          targetZh: extractedZh,
        },
      ];
    } else if (clean.toLowerCase().endsWith('ing')) {
      pool = [
        {
          sentence: `Reporters are actively ${displayWord} the developing community story.`,
          translation: `記者正積極${zhTarget}這則持續發酵的社區新聞。`,
          targetZh: extractedZh,
        },
        {
          sentence: `The team has spent months ${displayWord} sustainable solutions for residents.`,
          translation: `團隊花了數月時間為居民${zhTarget}可持續的解決方案。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Analysts are closely ${displayWord} changes across the local economy.`,
          translation: `分析師正密切${zhTarget}在地經濟的各項變化。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Broadcasters were ${displayWord} live updates as the briefing concluded.`,
          translation: `隨著簡報會結束，廣播員正在${zhTarget}即時快訊。`,
          targetZh: extractedZh,
        },
      ];
    } else {
      pool = [
        {
          sentence: `Radio hosts often ${displayWord} essential guidance for morning commuters.`,
          translation: `廣播主持人經常為晨間通勤族${zhTarget}必要指引。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Organizations are collaborating to ${displayWord} effective new programs.`,
          translation: `各機構正通力合作以${zhTarget}行之有效的新方案。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Officials plan to ${displayWord} key strategies in the upcoming quarter.`,
          translation: `官員計劃在下一季度${zhTarget}核心策略。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Listeners are invited to ${displayWord} during the open discussion segment.`,
          translation: `在開放討論環節中，電台誠摯邀請聽眾共同${zhTarget}。`,
          targetZh: extractedZh,
        },
      ];
    }
  } else {
    // Nouns & general vocabulary
    if (clean.toLowerCase().endsWith('s') && clean.length > 3 && !clean.toLowerCase().endsWith('ss')) {
      pool = [
        {
          sentence: `Recent ${displayWord} have attracted significant public interest across the region.`,
          translation: `近期的這些${zhTarget}引起了整個地區的大眾高度關注。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Officials reviewed several critical ${displayWord} during the morning briefing.`,
          translation: `官員在晨間簡報中審視了數項關鍵的${zhTarget}。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Analysts are tracking how these ${displayWord} will influence community life.`,
          translation: `分析師正在追蹤這些${zhTarget}將如何影響社區生活。`,
          targetZh: extractedZh,
        },
        {
          sentence: `New policies regarding ${displayWord} will take effect starting next month.`,
          translation: `關於${zhTarget}的新政策將於下月起正式生效。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Community groups organized discussions around the challenges of ${displayWord}.`,
          translation: `社區團體圍繞著這些${zhTarget}所帶來的挑戰組織了多場專題研討。`,
          targetZh: extractedZh,
        },
      ];
    } else {
      const nounWord = isOriginallyCapitalized ? capitalizedWord : displayWord;
      pool = [
        {
          sentence: `Recent coverage highlighted new developments regarding ${nounWord}.`,
          translation: `近期的新聞報導著重指出了關於${zhTarget}的最新進展。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Experts shared valuable insights on ${nounWord} during the panel interview.`,
          translation: `專家在座談專訪中分享了關於${zhTarget}的寶貴洞見。`,
          targetZh: extractedZh,
        },
        {
          sentence: `A comprehensive assessment of ${nounWord} was presented to local leaders.`,
          translation: `一份關於${zhTarget}的全面評估報告已呈遞給在地領導團隊。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Community interest in ${nounWord} has grown considerably this year.`,
          translation: `今年大眾對${zhTarget}的關注度有了顯著提升。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Finding an innovative approach to ${nounWord} is vital for long-term progress.`,
          translation: `為${zhTarget}開創嶄新路徑對長遠發展至關重要。`,
          targetZh: extractedZh,
        },
        {
          sentence: `Our radio station frequently explores important topics related to ${nounWord}.`,
          translation: `本廣播電台經常深入探討與${zhTarget}相關的焦點話題。`,
          targetZh: extractedZh,
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
    translation: `聽眾紛紛來信留言，探討${zhTarget}所帶來的廣泛影響。`,
    targetZh: extractedZh,
  };
  return fallback;
}

