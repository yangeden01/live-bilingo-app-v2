var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
module.exports = __toCommonJS(server_exports);
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_http = __toESM(require("http"), 1);
var import_vite = require("vite");
var import_ws = __toESM(require("ws"), 1);
var import_https = __toESM(require("https"), 1);
var import_child_process = require("child_process");
var import_genai = require("@google/genai");

// src/utils/broadcastGlossary.ts
function detectBroadcastDomain(text) {
  const clean = text.toLowerCase();
  let trafficScore = 0;
  let financeScore = 0;
  let weatherScore = 0;
  let newsScore = 0;
  if (/\b(traffic|commute|freeway|highway|lane|lanes|eastbound|westbound|northbound|southbound|bridge|stall|stalled|semi|collision|crash|fender bender|backup|backed up|sigalert|chp|shoulder|interchange|exit|maze|toll|deck|detour|delay|rush hour|hov|carpool|gridlock|slow down|speed limit|roadwork|off-ramp|on-ramp)\b/i.test(clean)) {
    trafficScore += 3;
  }
  if (/\b(i-80|i-880|i-580|i-280|i-680|us-101|route\s+\d+|highway\s+\d+|bay bridge|golden gate|san mateo bridge|dumbarton|caldecott tunnel|treasure island)\b/i.test(clean)) {
    trafficScore += 4;
  }
  if (/\b(dow|nasdaq|s&p|wall street|stocks|shares|bond|bonds|yield|yields|inflation|treasury|fed|federal reserve|earnings|rally|bear market|bull market|quarterly|revenue|interest rate|cpi|gdp|deficit|debt|hedge fund|sec|dividend|bankruptcy)\b/i.test(clean)) {
    financeScore += 3;
  }
  if (/\b(degrees|fahrenheit|celsius|temperature|rainfall|shower|showers|storm|hurricane|gust|gusts|wind|winds|breeze|overcast|sunny|humidity|meteorologist|weather service|heat wave|frost|blizzard|front|atmospheric river)\b/i.test(clean)) {
    weatherScore += 3;
  }
  if (/\b(president|white house|congress|senate|house of representatives|capitol|hearing|bill|legislation|vote|ballot|election|supreme court|justice|lawsuit|judge|prosecutor|indictment|probe|gop|democrat|republican|foreign minister|summit|diplomat|briefing)\b/i.test(clean)) {
    newsScore += 3;
  }
  const maxScore = Math.max(trafficScore, financeScore, weatherScore, newsScore);
  if (maxScore < 2) return "GENERAL";
  if (trafficScore === maxScore) return "TRAFFIC";
  if (financeScore === maxScore) return "FINANCE";
  if (weatherScore === maxScore) return "WEATHER";
  if (newsScore === maxScore) return "NEWS_POLITICS";
  return "GENERAL";
}
var PHRASE_DICTIONARY = [
  // Traffic & Commute Idioms (路況與通勤專有名詞)
  { enPattern: /\btraffic\s+(?:is|was|are|were)\s+already\s+solid\b/gi, exactZh: "\u8ECA\u6D41\u65E9\u5DF2\u6574\u8DEF\u585E\u6EFF\uFF08\u56B4\u91CD\u58C5\u585E\uFF09" },
  { enPattern: /\btraffic\s+(?:is|was|are|were)\s+solid\b/gi, exactZh: "\u8ECA\u6D41\u5BC6\u5BE6\u58C5\u585E\u3001\u6574\u8DEF\u585E\u6EFF" },
  { enPattern: /\bsolid\s+traffic\b/gi, exactZh: "\u5BC6\u5BE6\u58C5\u585E\u7684\u8ECA\u6D41" },
  { enPattern: /\bthe\s+commute\s+was\s+already\s+stop\s+and\s+go\b/gi, exactZh: "\u901A\u52E4\u8ECA\u6D41\u65E9\u5DF2\u8D70\u8D70\u505C\u505C\uFF08\u8ECA\u591A\u58C5\u585E\uFF09" },
  { enPattern: /\b(is|was|are|were)\s+stop\s+and\s+go\b/gi, exactZh: "\u8D70\u8D70\u505C\u505C\u3001\u8ECA\u591A\u58C5\u585E" },
  { enPattern: /\bstop\s+and\s+go\s+traffic\b/gi, exactZh: "\u8D70\u8D70\u505C\u505C\u7684\u58C5\u585E\u8ECA\u6D41" },
  { enPattern: /\bstop\s+and\s+go\b/gi, exactZh: "\u8D70\u8D70\u505C\u505C\uFF08\u8ECA\u591A\u58C5\u585E\uFF09" },
  { enPattern: /\bbumper\s+to\s+bumper\b/gi, exactZh: "\u5927\u6392\u9577\u9F8D\uFF08\u8ECA\u8F1B\u7DCA\u8CBC\uFF09" },
  { enPattern: /\bhit\s+and\s+run\b/gi, exactZh: "\u8087\u4E8B\u9003\u9038" },
  { enPattern: /\bstalled\s+semi\b/gi, exactZh: "\u6545\u969C\u62CB\u9328\u7684\u806F\u7D50\u5927\u8CA8\u8ECA" },
  { enPattern: /\ba\s+stalled\s+semi\b/gi, exactZh: "\u4E00\u8F1B\u6545\u969C\u62CB\u9328\u7684\u806F\u7D50\u5927\u8CA8\u8ECA" },
  { enPattern: /\ba\s+stall\s+in\s+([A-Za-z\s]+)\b/gi, exactZh: "$1 \u767C\u751F\u8ECA\u8F1B\u62CB\u9328\u6545\u969C" },
  { enPattern: /\ba\s+stall\s+blocking\b/gi, exactZh: "\u6545\u969C\u62CB\u9328\u8ECA\u4F54\u64DA" },
  { enPattern: /\bblocking\s+the\s+number\s+(\w+)\s+lane\b/gi, exactZh: "\u4F54\u64DA\u7B2C $1 \u8ECA\u9053" },
  { enPattern: /\bnumber\s+two\s+lane\b/gi, exactZh: "\u7B2C\u4E8C\u8ECA\u9053\uFF08\u4E2D\u7DDA\u8ECA\u9053\uFF09" },
  { enPattern: /\btraffic\s+backed\s+up\s+to\b/gi, exactZh: "\u8ECA\u6D41\u56DE\u5835\u81F3" },
  { enPattern: /\bbacked\s+up\s+to\b/gi, exactZh: "\u56DE\u5835\u81F3" },
  { enPattern: /\bfor\s+the\s+lower\s+deck\b/gi, exactZh: "\u5728\u6D77\u7063\u5927\u6A4B\u4E0B\u5C64\u6A4B\u9762" },
  { enPattern: /\blower\s+deck\b/gi, exactZh: "\u6D77\u7063\u5927\u6A4B\u4E0B\u5C64\u6A4B\u9762" },
  { enPattern: /\beastbound\s+eighty\b/gi, exactZh: "80 \u865F\u5DDE\u969B\u516C\u8DEF\u6771\u5411\uFF08I-80 East\uFF09" },
  { enPattern: /\bwestbound\s+eighty\b/gi, exactZh: "80 \u865F\u5DDE\u969B\u516C\u8DEF\u897F\u5411\uFF08I-80 West\uFF09" },
  { enPattern: /\bTreasure\s+Island\b/gi, exactZh: "\u91D1\u9280\u5CF6\uFF08Treasure Island\uFF09" },
  { enPattern: /\bbridge\s+crews\s+are\s+underway\b/gi, exactZh: "\u5927\u6A4B\u5DE5\u7A0B\u5DE1\u908F\u8207\u6436\u4FEE\u968A\u5DF2\u5728\u9014\u4E2D\u8D95\u5F80\u8655\u7406" },
  { enPattern: /\bcrews\s+are\s+underway\b/gi, exactZh: "\u6436\u4FEE\u968A\u4F0D\u5DF2\u5728\u9014\u4E2D\u8D95\u5F80\u8655\u7406" },
  { enPattern: /\bNimitz\s+880\b/gi, exactZh: "\u5C3C\u7C73\u8332 880 \u865F\u9AD8\u901F\u516C\u8DEF\uFF08I-880\uFF09" },
  { enPattern: /\bthe\s+Nimitz\s+880\s+southbound\b/gi, exactZh: "\u5C3C\u7C73\u8332 880 \u865F\u516C\u8DEF\u5357\u5411" },
  { enPattern: /\bThornton\s+Avenue\b/gi, exactZh: "\u6851\u9813\u5927\u9053\uFF08Thornton Ave\uFF09" },
  { enPattern: /\bDakota\s+Road\b/gi, exactZh: "\u9054\u79D1\u4ED6\u8DEF\uFF08Dakota Rd\uFF09" },
  { enPattern: /\bmoved\s+over\s+to\s+the\s+shoulder\s+with\s+CHP\b/gi, exactZh: "\u5DF2\u79FB\u81F3\u8DEF\u80A9\uFF0C\u52A0\u5DDE\u516C\u8DEF\u5DE1\u8B66\uFF08CHP\uFF09\u5DF2\u5728\u5834\u8655\u7406" },
  { enPattern: /\bmoved\s+over\s+to\s+the\s+shoulder\b/gi, exactZh: "\u5DF2\u79FB\u81F3\u8DEF\u908A\u8DEF\u80A9" },
  { enPattern: /\bto\s+the\s+shoulder\b/gi, exactZh: "\u81F3\u8DEF\u80A9" },
  { enPattern: /\bon\s+the\s+shoulder\b/gi, exactZh: "\u5728\u8DEF\u80A9" },
  { enPattern: /\bthe\s+shoulder\b/gi, exactZh: "\u8DEF\u80A9" },
  { enPattern: /\bCHP\b/g, exactZh: "\u52A0\u5DDE\u516C\u8DEF\u5DE1\u8B66\uFF08CHP\uFF09" },
  { enPattern: /\bthe\s+maze\b/gi, exactZh: "\u9EA5\u514B\u963F\u745F\u7ACB\u4EA4\u6A1E\u7D10\uFF08The Maze \u4EA4\u6D41\u9053\u7CFB\u7D71\uFF09" },
  { enPattern: /\bMacArthur\s+Maze\b/gi, exactZh: "\u9EA5\u514B\u963F\u745F\u7ACB\u4EA4\u6A1E\u7D10\uFF08MacArthur Maze\uFF09" },
  { enPattern: /\beast\s+bound\b/gi, exactZh: "\u6771\u5411" },
  { enPattern: /\beastbound\b/gi, exactZh: "\u6771\u5411\uFF08\u5F80\u6771\u8ECA\u9053\uFF09" },
  { enPattern: /\bwestbound\b/gi, exactZh: "\u897F\u5411\uFF08\u5F80\u897F\u8ECA\u9053\uFF09" },
  { enPattern: /\bnorthbound\b/gi, exactZh: "\u5317\u5411\uFF08\u5F80\u5317\u8ECA\u9053\uFF09" },
  { enPattern: /\bsouthbound\b/gi, exactZh: "\u5357\u5411\uFF08\u5F80\u5357\u8ECA\u9053\uFF09" },
  { enPattern: /\bWarren\s+Freeway\b/gi, exactZh: "\u6C83\u502B\u9AD8\u901F\u516C\u8DEF\uFF08Warren Freeway\uFF09" },
  { enPattern: /\bHighway\s+13\b/gi, exactZh: "13 \u865F\u516C\u8DEF" },
  { enPattern: /\bOakland\s+580\s+East\b/gi, exactZh: "\u5967\u514B\u862D 580 \u865F\u516C\u8DEF\u6771\u5411" },
  { enPattern: /\b580\s+East\b/gi, exactZh: "580 \u865F\u5DDE\u969B\u516C\u8DEF\u6771\u5411" },
  { enPattern: /\bfive\s+eighty\b/gi, exactZh: "580 \u865F\u516C\u8DEF" },
  { enPattern: /\b1st\s+Street\b/gi, exactZh: "\u7B2C\u4E00\u8857\uFF081st St\uFF09" },
  { enPattern: /\bfirst\s+street\b/gi, exactZh: "\u7B2C\u4E00\u8857\uFF081st St\uFF09" },
  { enPattern: /\bfender\s+bender\b/gi, exactZh: "\u8F15\u5FAE\u8ECA\u8F1B\u64E6\u649E" },
  { enPattern: /\bgridlock\b/gi, exactZh: "\u4EA4\u901A\u5927\u6253\u7D50\uFF08\u56B4\u91CD\u56DE\u5835\uFF09" },
  { enPattern: /\brubbernecking\b/gi, exactZh: "\u99D5\u99DB\u6162\u901F\u5F35\u671B\u5C0E\u81F4\u8ECA\u6D41\u56DE\u5835" },
  { enPattern: /\bcarpool\s+lane\b/gi, exactZh: "\u9AD8\u4E58\u8F09\u8ECA\u9053\uFF08HOV\uFF09" },
  { enPattern: /\bHOV\s+lane\b/gi, exactZh: "\u9AD8\u4E58\u8F09\u8ECA\u9053\uFF08HOV\uFF09" },
  { enPattern: /\bstalled\s+vehicle\b/gi, exactZh: "\u6545\u969C\u62CB\u9328\u8ECA\u8F1B" },
  { enPattern: /\bdisabled\s+vehicle\b/gi, exactZh: "\u62CB\u9328\u8ECA\u8F1B" },
  { enPattern: /\bSigAlert\b/gi, exactZh: "\u52A0\u5DDE\u91CD\u5927\u4EA4\u901A\u8B66\u5831\uFF08SigAlert\uFF09" },
  // News & Broadcaster Terms (新聞與電台專有名詞)
  { enPattern: /\bfor\s+(?:Kid\s+QED|Kid\s+Q\s+ED|KQED)\b/gi, exactZh: "\u70BA KQED \u820A\u91D1\u5C71\u516C\u5171\u96FB\u53F0\u5831\u5C0E" },
  { enPattern: /\b(?:Kid\s+QED|Kid\s+Q\s+ED)\b/gi, exactZh: "KQED \u820A\u91D1\u5C71\u516C\u5171\u5EE3\u64AD\u96FB\u53F0" },
  { enPattern: /\bKQED\b/g, exactZh: "KQED \u820A\u91D1\u5C71\u516C\u5171\u5EE3\u64AD\u96FB\u53F0" },
  { enPattern: /\bNHPR\b/g, exactZh: "NHPR \u65B0\u7F55\u5E03\u590F\u516C\u5171\u5EE3\u64AD\u96FB\u53F0" },
  { enPattern: /\bWBEZ\b/g, exactZh: "WBEZ \u829D\u52A0\u54E5\u516C\u5171\u5EE3\u64AD\u96FB\u53F0" },
  { enPattern: /\bWNYC\b/g, exactZh: "WNYC \u7D10\u7D04\u516C\u5171\u5EE3\u64AD\u96FB\u53F0" },
  { enPattern: /\bWBUR\b/g, exactZh: "WBUR \u6CE2\u58EB\u9813\u516C\u5171\u5EE3\u64AD\u96FB\u53F0" },
  { enPattern: /\bNPR\s+Business\b/gi, exactZh: "NPR \u5168\u7F8E\u5546\u696D\u8CA1\u7D93\u65B0\u805E" },
  { enPattern: /\bNPR\s+News\b/gi, exactZh: "NPR \u5168\u7F8E\u65B0\u805E" },
  { enPattern: /\bBBC\s+World\s+Service\b/gi, exactZh: "BBC \u570B\u969B\u5EE3\u64AD\u96FB\u53F0" },
  { enPattern: /\bAll\s+Things\s+Considered\b/gi, exactZh: "\u300A\u842C\u4E8B\u7686\u8AD6\u300B\uFF08NPR \u65D7\u8266\u65B0\u805E\u7BC0\u76EE\uFF09" },
  { enPattern: /\bMorning\s+Edition\b/gi, exactZh: "\u300A\u6668\u9593\u7248\u300B\uFF08NPR \u6668\u9593\u65B0\u805E\u65D7\u8266\uFF09" },
  { enPattern: /\bMarketplace\b/gi, exactZh: "\u300A\u5E02\u5834\u6642\u4E8B\u300B\uFF08APM \u65D7\u8266\u5546\u696D\u7BC0\u76EE\uFF09" },
  { enPattern: /\bTupperware\b/gi, exactZh: "\u7279\u767E\u60E0\uFF08Tupperware \u4FDD\u9BAE\u5BB9\u5668\uFF09" },
  { enPattern: /\bscience\s+of\s+reading\b/gi, exactZh: "\u95B1\u8B80\u79D1\u5B78\u7814\u7A76\uFF08The Science of Reading\uFF09" },
  { enPattern: /\bscienceofreading\b/gi, exactZh: "\u95B1\u8B80\u79D1\u5B78\u7814\u7A76" },
  { enPattern: /\breshaping\s+how\s+kids\s+learn\b/gi, exactZh: "\u6B63\u5728\u91CD\u5851\u5B69\u7AE5\u7684\u5B78\u7FD2\u6A21\u5F0F" },
  { enPattern: /\bStanford\s+Graduate\s+School\s+of\s+Education\b/gi, exactZh: "\u53F2\u4E39\u4F5B\u5927\u5B78\u6559\u80B2\u7814\u7A76\u6240" },
  { enPattern: /\bStanford\s+University\b/gi, exactZh: "\u53F2\u4E39\u4F5B\u5927\u5B78\uFF08Stanford University\uFF09" },
  { enPattern: /\bstanford\.edu\b/gi, exactZh: "\u53F2\u4E39\u4F5B\u5927\u5B78\u5B98\u65B9\u7DB2\u7AD9\uFF08stanford.edu\uFF09" },
  { enPattern: /\bstay\s+tuned\b/gi, exactZh: "\u8ACB\u6301\u7E8C\u9396\u5B9A\u6536\u807D" },
  { enPattern: /\btop\s+of\s+the\s+hour\b/gi, exactZh: "\u6574\u9EDE\u65B0\u805E\u64AD\u5831" },
  { enPattern: /\bon\s+the\s+hour\b/gi, exactZh: "\u6574\u9EDE" },
  { enPattern: /\bbreaking\s+news\b/gi, exactZh: "\u5373\u6642\u7A81\u767C\u65B0\u805E" },
  { enPattern: /\bpress\s+briefing\b/gi, exactZh: "\u5A92\u9AD4\u7C21\u5831\u6703" },
  { enPattern: /\blivestream\b/gi, exactZh: "\u7DDA\u4E0A\u5373\u6642\u5EE3\u64AD\u4E32\u6D41" },
  { enPattern: /\blive\s+stream\b/gi, exactZh: "\u5373\u6642\u5EE3\u64AD\u4E32\u6D41" },
  // Finance & Economics (財經股市與聯準會專有名詞)
  { enPattern: /\bthe\s+Federal\s+Reserve\b/gi, exactZh: "\u7F8E\u570B\u806F\u6E96\u6703\uFF08Fed\uFF09" },
  { enPattern: /\bthe\s+Fed\b/g, exactZh: "\u7F8E\u570B\u806F\u6E96\u6703\uFF08Fed\uFF09" },
  { enPattern: /\brate\s+hike\b/gi, exactZh: "\u5347\u606F" },
  { enPattern: /\brate\s+cut\b/gi, exactZh: "\u964D\u606F" },
  { enPattern: /\binterest\s+rate\s+hikes?\b/gi, exactZh: "\u8ABF\u5347\u5229\u7387\uFF08\u5347\u606F\uFF09" },
  { enPattern: /\binterest\s+rate\s+cuts?\b/gi, exactZh: "\u8ABF\u964D\u5229\u7387\uFF08\u964D\u606F\uFF09" },
  { enPattern: /\bbond\s+yields?\b/gi, exactZh: "\u516C\u50B5\u6B96\u5229\u7387" },
  { enPattern: /\bTreasury\s+yields?\b/gi, exactZh: "\u7F8E\u570B\u570B\u50B5\u6B96\u5229\u7387" },
  { enPattern: /\bTreasury\s+bonds?\b/gi, exactZh: "\u7F8E\u570B\u8CA1\u653F\u90E8\u516C\u50B5" },
  { enPattern: /\bWall\s+Street\s+rally\b/gi, exactZh: "\u83EF\u723E\u8857\u80A1\u5E02\u5927\u6F32\u53CD\u5F48" },
  { enPattern: /\bbear\s+market\b/gi, exactZh: "\u7A7A\u982D\u718A\u5E02" },
  { enPattern: /\bbull\s+market\b/gi, exactZh: "\u591A\u982D\u725B\u5E02" },
  { enPattern: /\bhawkish\b/gi, exactZh: "\u9DF9\u6D3E\uFF08\u504F\u597D\u7DCA\u7E2E/\u5347\u606F\uFF09" },
  { enPattern: /\bdovish\b/gi, exactZh: "\u9D3F\u6D3E\uFF08\u504F\u597D\u5BEC\u9B06/\u964D\u606F\uFF09" },
  { enPattern: /\breading\s+back\b/gi, exactZh: "\u56DE\u9867\u4EE5\u5F80 / \u4ED4\u7D30\u56DE\u60F3\u904E\u5F80" },
  { enPattern: /\band\s+reading\s+back\b/gi, exactZh: "\u800C\u4E14\u56DE\u9867\u904E\u5F80\u7D00\u9304" },
  { enPattern: /\bkinda\s+known\s+as\b/gi, exactZh: "\u88AB\u666E\u904D\u8A8D\u70BA\u662F" },
  { enPattern: /\byou\s+were\s+kinda\s+known\s+as\b/gi, exactZh: "\u4F60\u5728\u5927\u5BB6\u773C\u4E2D\u4E00\u76F4\u88AB\u8996\u70BA" },
  { enPattern: /\byou\s+were\s+known\s+as\b/gi, exactZh: "\u4F60\u66FE\u88AB\u7A31\u70BA" },
  { enPattern: /\bkinda\s+like\b/gi, exactZh: "\u6709\u9EDE\u50CF\u662F" },
  { enPattern: /\bkind\s+of\s+like\b/gi, exactZh: "\u6709\u9EDE\u985E\u4F3C" },
  { enPattern: /\btalk\s+(?:them|someone|him|her|us)\s+off\s+the\s+(?:existential\s+)?cliff\s+edge\b/gi, exactZh: "\u52F8\u963B\u4E26\u5316\u89E3\u9762\u81E8\u7684\u91CD\u5927\u5371\u6A5F" },
  { enPattern: /\boff\s+the\s+cliff\s+edge\b/gi, exactZh: "\u812B\u96E2\u61F8\u5D16\u7D55\u5883" },
  { enPattern: /\bcliff\s+edge\b/gi, exactZh: "\u61F8\u5D16\u908A\u7DE3\uFF08\u96AA\u5883\uFF09" },
  { enPattern: /\bball\s+is\s+in\s+your\s+court\b/gi, exactZh: "\u6C7A\u5B9A\u6B0A\u73FE\u5728\u5728\u4F60\u624B\u4E0A" },
  { enPattern: /\bunder\s+the\s+weather\b/gi, exactZh: "\u8EAB\u9AD4\u5FAE\u6059\u4E0D\u8212\u670D" },
  { enPattern: /\bcost\s+an\s+arm\s+and\s+a\s+leg\b/gi, exactZh: "\u9020\u50F9\u6975\u5176\u6602\u8CB4" },
  { enPattern: /\bsee\s+eye\s+to\s+eye\b/gi, exactZh: "\u770B\u6CD5\u4E00\u81F4 / \u9054\u6210\u5171\u8B58" },
  { enPattern: /\bpiece\s+of\s+cake\b/gi, exactZh: "\u8F15\u800C\u6613\u8209\uFF08\u6613\u5982\u53CD\u638C\uFF09" },
  { enPattern: /\bspill\s+the\s+beans\b/gi, exactZh: "\u6D29\u6F0F\u6D88\u606F / \u5168\u76E4\u6258\u51FA" },
  { enPattern: /\bsilver\s+lining\b/gi, exactZh: "\u56F0\u5883\u4E2D\u7684\u4E00\u7DDA\u5E0C\u671B" },
  { enPattern: /\belephant\s+in\s+the\s+room\b/gi, exactZh: "\u986F\u800C\u6613\u898B\u537B\u88AB\u523B\u610F\u5FFD\u8996\u7684\u6839\u672C\u554F\u984C" },
  { enPattern: /\bbite\s+the\s+bullet\b/gi, exactZh: "\u54AC\u7DCA\u7259\u95DC\u52C7\u6562\u9762\u5C0D" },
  { enPattern: /\bcall\s+it\s+a\s+day\b/gi, exactZh: "\u4ECA\u5929\u7684\u5DE5\u4F5C\u5230\u6B64\u7D50\u675F" },
  { enPattern: /\bat\s+the\s+end\s+of\s+the\s+day\b/gi, exactZh: "\u6B78\u6839\u7D50\u5E95 / \u8AAA\u5230\u5E95" },
  { enPattern: /\bin\s+the\s+loop\b/gi, exactZh: "\u638C\u63E1\u6700\u65B0\u9032\u5EA6\u8207\u6D88\u606F" },
  { enPattern: /\btouch\s+base\b/gi, exactZh: "\u7C21\u77ED\u806F\u7E6B\u540C\u6B65\u60C5\u6CC1" },
  { enPattern: /\bgame\s+changer\b/gi, exactZh: "\u985B\u8986\u5168\u5C40\u7684\u91CD\u5927\u8B8A\u9769" },
  { enPattern: /\bacross\s+the\s+board\b/gi, exactZh: "\u5168\u9762\u6027 / \u666E\u904D" },
  { enPattern: /\bthink\s+outside\s+the\s+box\b/gi, exactZh: "\u8DF3\u812B\u6846\u67B6\u601D\u8003" },
  { enPattern: /\btake\s+with\s+a\s+grain\s+of\s+salt\b/gi, exactZh: "\u6301\u4FDD\u7559\u614B\u5EA6 / \u5BE9\u614E\u770B\u5F85" },
  { enPattern: /\bback\s+to\s+the\s+drawing\s+board\b/gi, exactZh: "\u91CD\u8D77\u7210\u7076\u91CD\u65B0\u898F\u5283" },
  { enPattern: /\bhit\s+the\s+ground\s+running\b/gi, exactZh: "\u8FC5\u901F\u5C55\u958B\u5168\u529B\u884C\u52D5" },
  { enPattern: /\bup\s+in\s+the\s+air\b/gi, exactZh: "\u61F8\u800C\u672A\u6C7A\u5C1A\u672A\u5B9A\u6848" },
  { enPattern: /\bbring\s+to\s+the\s+table\b/gi, exactZh: "\u63D0\u51FA\u5177\u9AD4\u8CA2\u737B\u8207\u65B9\u6848" }
];
function preprocessEnglishForTranslation(englishText) {
  let text = englishText;
  text = text.replace(/\bKid\s+QED\b/gi, "KQED");
  text = text.replace(/\bKid\s+Q\s+ED\b/gi, "KQED");
  text = text.replace(/\bN\s+P\s+R\b/gi, "NPR");
  text = text.replace(/\bB\s+B\s+C\b/gi, "BBC");
  text = text.replace(/,\s*(?:like|you\s+know|I\s+mean|kinda|sorta)\s*,/gi, ",").replace(/\b(?:you\s+know|I\s+mean)\b/gi, "").replace(/\s+,/g, ",").replace(/,\s*,+/g, ",").replace(/\s+/g, " ");
  text = text.replace(/\band\s+reading\s+back\b/gi, "and looking back on the record");
  text = text.replace(/\breading\s+back\b/gi, "looking back on the record");
  text = text.replace(/\byou\s+were\s+kinda\s+known\s+as\b/gi, "you were widely known as");
  text = text.replace(/\bkinda\s+known\s+as\b/gi, "widely regarded as");
  const domain = detectBroadcastDomain(text);
  if (domain === "TRAFFIC") {
    text = text.replace(/\bthe\s+lower\s+deck\b/gi, "the lower bridge deck");
    text = text.replace(/\bnumber\s+two\s+lane\b/gi, "second traffic lane");
    text = text.replace(/\ba\s+stalled\s+semi\b/gi, "a stalled semi truck");
    text = text.replace(/\beastbound\s+eighty\b/gi, "eastbound Interstate 80");
    text = text.replace(/\bwestbound\s+eighty\b/gi, "westbound Interstate 80");
    text = text.replace(/\bMacArthur\s+Maze\b/gi, "MacArthur Maze highway interchange");
  } else if (domain === "FINANCE") {
    text = text.replace(/\bthe\s+Fed\b/g, "the Federal Reserve");
    text = text.replace(/\bTreasury\s+yields?\b/gi, "US Treasury bond yields");
  }
  return text;
}
var POST_CORRECTIONS = [
  // 修正「通勤已經停止」等誤譯
  [/通勤已經停止/g, "\u901A\u52E4\u8ECA\u6D41\u5DF2\u7D93\u8D70\u8D70\u505C\u505C\uFF08\u8ECA\u591A\u58C5\u585E\uFF09"],
  [/通勤停止/g, "\u901A\u52E4\u8ECA\u591A\u58C5\u585E"],
  [/停止並前進/g, "\u8D70\u8D70\u505C\u505C\uFF08\u8ECA\u591A\u58C5\u585E\uFF09"],
  [/停止和前進/g, "\u8D70\u8D70\u505C\u505C\uFF08\u8ECA\u591A\u58C5\u585E\uFF09"],
  [/停停走走/g, "\u8D70\u8D70\u505C\u505C"],
  // 交通 solid 誤譯為暢通修正
  [/交通就已經暢通無阻/g, "\u8ECA\u6D41\u65E9\u5DF2\u6574\u8DEF\u585E\u6EFF\uFF08\u56B4\u91CD\u58C5\u585E\uFF09"],
  [/交通已經暢通無阻/g, "\u8ECA\u6D41\u5DF2\u7D93\u6574\u8DEF\u585E\u6EFF\uFF08\u56B4\u91CD\u58C5\u585E\uFF09"],
  [/已經暢通無阻/g, "\u65E9\u5DF2\u6574\u8DEF\u585E\u6EFF\uFF08\u56B4\u91CD\u58C5\u585E\uFF09"],
  [/交通暢通無阻/g, "\u8ECA\u6D41\u5BC6\u5BE6\u58C5\u585E"],
  [/暢通無阻/g, "\u6574\u8DEF\u585E\u6EFF\uFF08\u8ECA\u591A\u58C5\u585E\uFF09"],
  // 交通 stall 誤譯為停車位/攤位修正
  [/一個攤位/g, "\u4E00\u8F1B\u6545\u969C\u62CB\u9328\u8ECA"],
  [/設有停車位/g, "\u767C\u751F\u8ECA\u8F1B\u62CB\u9328\u6545\u969C"],
  [/設有停車/g, "\u767C\u751F\u6545\u969C\u62CB\u9328"],
  [/有停車位/g, "\u6709\u6545\u969C\u8ECA\u8F1B\u62CB\u9328"],
  [/停車位/g, "\u62CB\u9328\u6545\u969C\u8ECA"],
  [/一個車輛拋錨故障/g, "\u4E00\u8F1B\u6545\u969C\u62CB\u9328\u8ECA"],
  // 聯結車 semi 誤譯為半拖車修正
  [/一輛半拖車/g, "\u4E00\u8F1B\u6545\u969C\u7684\u534A\u806F\u7D50\u5927\u8CA8\u8ECA"],
  [/半拖車/g, "\u534A\u806F\u7D50\u5927\u8CA8\u8ECA"],
  // 電台名稱 KQED / Kid QED 修正
  [/為《Kid QED》拍攝/g, "\u70BA KQED \u820A\u91D1\u5C71\u516C\u5171\u96FB\u53F0\u5831\u5C0E"],
  [/為《Kid QED》/g, "\u70BA KQED \u820A\u91D1\u5C71\u516C\u5171\u96FB\u53F0"],
  [/為 Kid QED/g, "\u70BA KQED \u820A\u91D1\u5C71\u516C\u5171\u96FB\u53F0"],
  [/Kid QED/g, "KQED \u820A\u91D1\u5C71\u516C\u5171\u5EE3\u64AD\u96FB\u53F0"],
  // 橋面 deck 與公路 80 修正
  [/下層甲板/g, "\u6D77\u7063\u5927\u6A4B\u4E0B\u5C64\u6A4B\u9762"],
  [/下層面板/g, "\u6D77\u7063\u5927\u6A4B\u4E0B\u5C64\u6A4B\u9762"],
  [/向東行駛八十米/g, "80 \u865F\u5DDE\u969B\u516C\u8DEF\u6771\u5411\uFF08I-80 East\uFF09"],
  [/向東行駛\s*80/g, "80 \u865F\u516C\u8DEF\u6771\u5411"],
  [/向東行駛\s*八十/g, "80 \u865F\u516C\u8DEF\u6771\u5411"],
  [/東向\s*80/g, "80 \u865F\u5DDE\u969B\u516C\u8DEF\u6771\u5411"],
  [/金銀島/g, "\u91D1\u9280\u5CF6\uFF08Treasure Island\uFF09"],
  [/橋樑工作人員正在進行中/g, "\u5927\u6A4B\u6436\u4FEE\u968A\u4F0D\u5DF2\u5728\u8D95\u5F80\u9014\u4E2D\u8655\u7406"],
  [/橋樑人員正在進行中/g, "\u5927\u6A4B\u7DAD\u4FEE\u968A\u4F0D\u5DF2\u5728\u9014\u4E2D\u8655\u7406"],
  [/正在進行中/g, "\u6B63\u5728\u8D95\u5F80\u9014\u4E2D\u8655\u7F6E"],
  [/第二車道/g, "\u7B2C\u4E8C\u7DDA\u8ECA\u9053\uFF08\u4E2D\u7DDA\u8ECA\u9053\uFF09"],
  [/從迷宮前往/g, "\u5F9E\u9EA5\u514B\u963F\u745F\u7ACB\u4EA4\u6A1E\u7D10\uFF08The Maze\uFF09\u524D\u5F80"],
  [/從迷宮/g, "\u5F9E\u9EA5\u514B\u963F\u745F\u7ACB\u4EA4\u6A1E\u7D10\uFF08The Maze\uFF09"],
  [/在迷宮/g, "\u5728\u9EA5\u514B\u963F\u745F\u7ACB\u4EA4\u6A1E\u7D10"],
  [/進入迷宮/g, "\u9032\u5165\u9EA5\u514B\u963F\u745F\u7ACB\u4EA4\u6A1E\u7D10"],
  [/CHP\s*路邊/g, "\u52A0\u5DDE\u516C\u8DEF\u5DE1\u8B66\uFF08CHP\uFF09\u8DEF\u80A9"],
  [/與\s*CHP\s*路邊/g, "\u79FB\u81F3\u8DEF\u80A9\uFF08CHP \u8B66\u65B9\u5728\u5834\uFF09"],
  [/移至\s*CHP\s*路邊/g, "\u79FB\u81F3\u8DEF\u80A9\uFF08\u52A0\u5DDE\u516C\u8DEF\u5DE1\u8B66\u5DF2\u5728\u5834\uFF09"],
  [/移至路邊與\s*CHP/g, "\u79FB\u81F3\u8DEF\u80A9\uFF0C\u52A0\u5DDE\u516C\u8DEF\u5DE1\u8B66\uFF08CHP\uFF09\u5728\u5834\u8655\u7406"],
  [/特百惠作為狗餵食盤/g, "\u7279\u767E\u60E0\uFF08Tupperware \u4FDD\u9BAE\u76D2\uFF09\u4F5C\u70BA\u9935\u72D7\u7684\u9910\u76E4"],
  [/特百惠作爲狗餵食盤/g, "\u7279\u767E\u60E0\uFF08Tupperware \u4FDD\u9BAE\u76D2\uFF09\u4F5C\u70BA\u9935\u72D7\u7684\u9910\u76E4"],
  [/沃倫高速公路前沿奧克蘭\s*580\s*East\s*方向/g, "\u6C83\u502B\u9AD8\u901F\u516C\u8DEF\uFF08Warren Fwy\uFF09\u524D\uFF0C\u5967\u514B\u862D 580 \u865F\u516C\u8DEF\u6771\u5411"],
  [/580\s*East\s*方向/g, "580 \u865F\u5DDE\u969B\u516C\u8DEF\u6771\u5411"],
  [/從\s*1st\s*Street\s*出發/g, "\u5F9E\u7B2C\u4E00\u8857\uFF081st St\uFF09\u8DEF\u6BB5\u8D77"],
  [/從\s*1st\s*Street/g, "\u5F9E\u7B2C\u4E00\u8857\uFF081st St\uFF09"],
  [/在\s*1st\s*Street/g, "\u5728\u7B2C\u4E00\u8857\uFF081st St\uFF09"],
  [/存在主義的懸崖邊緣/g, "\u9762\u81E8\u7684\u91CD\u5927\u61F8\u5D16\u7D55\u5883"],
  [/存在主義懸崖邊緣/g, "\u91CD\u5927\u5371\u6A5F\u7D55\u5883"],
  [/在\s*05:29\s*再次更新/g, "\u5C07\u65BC 05:29 \u9032\u884C\u4E0B\u4E00\u6B21\u5373\u6642\u8DEF\u6CC1\u66F4\u65B0"],
  [/將於\s*(\d{1,2}:\d{2})\s*再次更新/g, "\u5C07\u65BC $1 \u70BA\u60A8\u64AD\u5831\u6700\u65B0\u8DEF\u6CC1\u66F4\u65B0"],
  [/將於\s*(\d{1,2}:\d{2})\s*再次播出/g, "\u5C07\u65BC $1 \u64AD\u51FA\u4E0B\u4E00\u7BC0\u65B0\u805E"],
  // 修正訪談與口語常見硬譯（如「讀回來，你有比稱為這個，就像」）
  [/讀回來[，,]?/g, "\u56DE\u9867\u4EE5\u5F80\uFF0C"],
  [/你有比稱為/g, "\u4F60\u88AB\u666E\u904D\u7A31\u70BA"],
  [/你有被稱為/g, "\u4F60\u88AB\u666E\u904D\u7A31\u70BA"],
  [/被比稱為/g, "\u88AB\u666E\u904D\u7A31\u70BA"],
  [/稱為這個[，,]?\s*就像[，,]?/g, "\u88AB\u7A31\u70BA\u6B64\u865F\u4EBA\u7269\uFF0C"],
  [/稱為這個/g, "\u88AB\u7A31\u70BA\u9019\u865F\u4EBA\u7269"],
  [/，就像[，,]?$/g, "\u3002"],
  [/，你知道[，,]?/g, "\uFF0C"],
  [/，好比說[，,]?$/g, "\u3002"]
];
function postprocessChineseTranslation(zhText, originalEn) {
  let refined = zhText;
  const lowerEn = originalEn.toLowerCase();
  const domain = detectBroadcastDomain(originalEn);
  if (domain === "TRAFFIC" || lowerEn.includes("traffic") || lowerEn.includes("freeway") || lowerEn.includes("commute")) {
    if (lowerEn.includes("solid")) {
      refined = refined.replace(/暢通無阻|順暢無阻|暢通|順暢|固體|堅固/g, "\u6574\u8DEF\u585E\u6EFF\uFF08\u8ECA\u591A\u58C5\u585E\uFF09");
    }
    if (lowerEn.includes("stall")) {
      refined = refined.replace(/設有停車位|停車位|一個攤位|攤位|失速|停頓/g, "\u8ECA\u8F1B\u62CB\u9328\u6545\u969C");
    }
    if (lowerEn.includes("semi")) {
      refined = refined.replace(/一輛半拖車|半拖車|半個|一半/g, "\u4E00\u8F1B\u806F\u7D50\u5927\u8CA8\u8ECA");
    }
    if (lowerEn.includes("deck")) {
      refined = refined.replace(/甲板|面板/g, "\u6A4B\u9762");
    }
    if (lowerEn.includes("shoulder")) {
      refined = refined.replace(/肩膀/g, "\u8DEF\u80A9");
    }
    if (lowerEn.includes("lane")) {
      refined = refined.replace(/小巷|小路/g, "\u8ECA\u9053");
    }
    if (lowerEn.includes("ramp")) {
      refined = refined.replace(/坡道/g, "\u531D\u9053");
    }
    if (lowerEn.includes("crawl")) {
      refined = refined.replace(/爬行/g, "\u9F9C\u901F\u884C\u99DB");
    }
    if (lowerEn.includes("backed up") || lowerEn.includes("back up")) {
      refined = refined.replace(/備份|後退/g, "\u8ECA\u6D41\u56DE\u5835");
    }
  }
  if (domain === "FINANCE" || lowerEn.includes("yield") || lowerEn.includes("fed") || lowerEn.includes("stocks")) {
    if (lowerEn.includes("yield")) {
      refined = refined.replace(/收益屈服率|屈服率|屈服|讓步/g, "\u6B96\u5229\u7387");
    }
    if (lowerEn.includes("fed")) {
      refined = refined.replace(/餵食|已餵/g, "\u806F\u6E96\u6703");
    }
    if (lowerEn.includes("bear market")) {
      refined = refined.replace(/熊市市場|熊市/g, "\u7A7A\u982D\u718A\u5E02");
    }
    if (lowerEn.includes("bull market")) {
      refined = refined.replace(/牛市市場|牛市/g, "\u591A\u982D\u725B\u5E02");
    }
    if (lowerEn.includes("rally")) {
      refined = refined.replace(/集會|拉力賽/g, "\u5927\u6F32\u53CD\u5F48");
    }
    if (lowerEn.includes("shares")) {
      refined = refined.replace(/分享/g, "\u80A1\u7968");
    }
  }
  if (domain === "WEATHER" || lowerEn.includes("forecast") || lowerEn.includes("shower") || lowerEn.includes("degrees")) {
    if (lowerEn.includes("shower")) {
      refined = refined.replace(/淋浴|洗澡/g, "\u77ED\u66AB\u9663\u96E8");
    }
    if (lowerEn.includes("front")) {
      refined = refined.replace(/前門|前面/g, "\u5929\u6C23\u92D2\u9762");
    }
  }
  if (lowerEn.includes("stop and go") && (refined.includes("\u505C\u6B62") && !refined.includes("\u8D70\u8D70\u505C\u505C"))) {
    refined = refined.replace(/停止/g, "\u8D70\u8D70\u505C\u505C\uFF08\u8ECA\u591A\u58C5\u585E\uFF09");
  }
  if (lowerEn.includes("maze") && refined.includes("\u8FF7\u5BAE")) {
    refined = refined.replace(/迷宮/g, "\u9EA5\u514B\u963F\u745F\u7ACB\u4EA4\u6A1E\u7D10\uFF08The Maze\uFF09");
  }
  if (lowerEn.includes("hit and run") && !refined.includes("\u8087\u4E8B\u9003\u9038")) {
    refined = refined.replace(/撞了就跑|撞車逃跑/g, "\u8087\u4E8B\u9003\u9038");
  }
  if (lowerEn.includes("chp") && !refined.includes("\u52A0\u5DDE\u516C\u8DEF\u5DE1\u8B66")) {
    refined = refined.replace(/\bCHP\b/g, "\u52A0\u5DDE\u516C\u8DEF\u5DE1\u8B66\uFF08CHP\uFF09");
  }
  for (const [regex, replacement] of POST_CORRECTIONS) {
    refined = refined.replace(regex, replacement);
  }
  return refined.trim();
}
function matchExactPhrase(englishText) {
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

// src/utils/quickDictionary.ts
var BUILTIN_DICT = {
  // Common verbs & past tenses / gerunds
  "look": { word: "look", phonetic: "/l\u028Ak/", pos: "v./n.", zh: "\u770B\u3001\u6CE8\u8996\uFF1B\u770B\u8D77\u4F86\u3001\u986F\u5F97\uFF1B\u5916\u89C0", def: "To direct one's gaze toward someone or something.", example: "Look at the traffic updates.", exampleZh: "\u770B\u770B\u6700\u65B0\u7684\u5373\u6642\u4EA4\u901A\u72C0\u6CC1\u3002" },
  "looked": { word: "looked", phonetic: "/l\u028Akt/", pos: "v. (\u904E\u53BB\u5F0F)", zh: "\u770B\u4E86\u3001\u986F\u5F97\u3001\u770B\u8D77\u4F86\uFF08look \u7684\u904E\u53BB\u5F0F/\u904E\u53BB\u5206\u8A5E\uFF09", def: "Past tense of look; directed gaze or appeared.", example: "The commute looked very crowded.", exampleZh: "\u901A\u52E4\u8DEF\u6BB5\u770B\u8D77\u4F86\u975E\u5E38\u58C5\u585E\u3002" },
  "looking": { word: "looking", phonetic: "/\u02C8l\u028Ak.\u026A\u014B/", pos: "v. (\u73FE\u5728\u5206\u8A5E)", zh: "\u6B63\u5728\u770B\u3001\u5C0B\u627E\u3001\u6307\u671B", def: "Present participle of look; searching or appearing." },
  "see": { word: "see", phonetic: "/si\u02D0/", pos: "v.", zh: "\u770B\u898B\u3001\u660E\u767D\u3001\u7406\u89E3\u3001\u6703\u9762", def: "To perceive with the eyes; understand." },
  "saw": { word: "saw", phonetic: "/s\u0254\u02D0/", pos: "v. (\u904E\u53BB\u5F0F)", zh: "\u770B\u898B\u4E86\uFF08see \u7684\u904E\u53BB\u5F0F\uFF09", def: "Past tense of see." },
  "seen": { word: "seen", phonetic: "/si\u02D0n/", pos: "v. (\u904E\u53BB\u5206\u8A5E)", zh: "\u770B\u904E\u3001\u88AB\u770B\u898B\uFF08see \u7684\u904E\u53BB\u5206\u8A5E\uFF09", def: "Past participle of see." },
  "go": { word: "go", phonetic: "/\u0261o\u028A/", pos: "v./n.", zh: "\u53BB\u3001\u524D\u9032\u3001\u904B\u8F49\u3001\u9032\u884C", def: "To move or travel from one place to another." },
  "went": { word: "went", phonetic: "/w\u025Bnt/", pos: "v. (\u904E\u53BB\u5F0F)", zh: "\u53BB\u4E86\u3001\u524D\u5F80\u4E86\uFF08go \u7684\u904E\u53BB\u5F0F\uFF09", def: "Past tense of go." },
  "gone": { word: "gone", phonetic: "/\u0261\u0254\u02D0n/", pos: "v./adj.", zh: "\u96E2\u53BB\u4E86\u3001\u6D88\u5931\u7684\uFF08go \u7684\u904E\u53BB\u5206\u8A5E\uFF09", def: "Past participle of go; departed." },
  "move": { word: "move", phonetic: "/mu\u02D0v/", pos: "v./n.", zh: "\u79FB\u52D5\u3001\u642C\u79FB\u3001\u63A1\u53D6\u884C\u52D5\uFF1B\u6B65\u9A5F", def: "To change position or cause to change position." },
  "moved": { word: "moved", phonetic: "/mu\u02D0vd/", pos: "v. (\u904E\u53BB\u5F0F)", zh: "\u79FB\u5230\u4E86\u3001\u611F\u52D5\u4E86\u3001\u642C\u9077\uFF08move \u7684\u904E\u53BB\u5F0F\uFF09", def: "Past tense of move; changed position.", example: "Two vehicles have been moved to the shoulder.", exampleZh: "\u5169\u8F1B\u8ECA\u8F1B\u5DF2\u79FB\u81F3\u8DEF\u80A9\u3002" },
  "moving": { word: "moving", phonetic: "/\u02C8mu\u02D0.v\u026A\u014B/", pos: "adj./v.", zh: "\u79FB\u52D5\u4E2D\u7684\u3001\u611F\u4EBA\u7684", def: "In motion; provoking strong emotion." },
  "stop": { word: "stop", phonetic: "/st\u0251\u02D0p/", pos: "v./n.", zh: "\u505C\u6B62\u3001\u4E2D\u65B7\u3001\u7AD9\u724C", def: "To cease moving or operating." },
  "stopped": { word: "stopped", phonetic: "/st\u0251\u02D0pt/", pos: "v. (\u904E\u53BB\u5F0F)", zh: "\u505C\u4E0B\u4E86\u3001\u88AB\u963B\u6B62", def: "Past tense of stop." },
  "happen": { word: "happen", phonetic: "/\u02C8h\xE6p.\u0259n/", pos: "v.", zh: "\u767C\u751F\u3001\u5DE7\u5408", def: "To take place or occur." },
  "happened": { word: "happened", phonetic: "/\u02C8h\xE6p.\u0259nd/", pos: "v. (\u904E\u53BB\u5F0F)", zh: "\u767C\u751F\u4E86\u3001\u7522\u751F\u4E86", def: "Past tense of happen." },
  "report": { word: "report", phonetic: "/r\u026A\u02C8p\u0254\u02D0rt/", pos: "v./n.", zh: "\u5831\u5C0E\u3001\u5831\u544A\u3001\u50B3\u9054\uFF1B\u65B0\u805E\u5831\u5C0E", def: "An account given of a particular matter; to convey news." },
  "reported": { word: "reported", phonetic: "/r\u026A\u02C8p\u0254\u02D0r.t\u026Ad/", pos: "v./adj.", zh: "\u64DA\u5831\u5C0E\u3001\u5DF2\u901A\u5831", def: "Past tense of report." },
  "reporting": { word: "reporting", phonetic: "/r\u026A\u02C8p\u0254\u02D0r.t\u026A\u014B/", pos: "n./v.", zh: "\u65B0\u805E\u63A1\u8A2A\u3001\u5373\u6642\u5831\u5C0E", def: "The activity of gathering and reporting news." },
  // Broadcast & Traffic vocabulary
  "solid": { word: "solid", phonetic: "/\u02C8s\u0251\u02D0.l\u026Ad/", pos: "adj. (\u4EA4\u901A/\u72C0\u614B)", zh: "\uFF08\u8ECA\u6D41\uFF09\u5BC6\u5BE6\u58C5\u585E\u3001\u6574\u8DEF\u585E\u6EFF\uFF1B\u5805\u56FA\u7684\u3001\u56FA\u9AD4\u7684", def: "In traffic context: completely congested, bumper-to-bumper, continuous line of vehicles without gaps; firm and stable.", example: "Traffic was already solid from 01:01.", exampleZh: "\u5F9E\u4E00\u9EDE\u96F6\u4E00\u5206\u958B\u59CB\uFF0C\u8ECA\u6D41\u5C31\u5DF2\u7D93\u5B8C\u5168\u585E\u6EFF\u52D5\u5F48\u4E0D\u5F97\u3002" },
  "stall": { word: "stall", phonetic: "/st\u0254\u02D0l/", pos: "n./v.", zh: "\uFF08\u8ECA\u8F1B\uFF09\u62CB\u9328\u6545\u969C\u3001\u7184\u706B\uFF1B\u6524\u4F4D", def: "A vehicle breakdown or stoppage on the road; to stop running.", example: "A stall blocking the middle lane.", exampleZh: "\u4E00\u8F1B\u62CB\u9328\u8ECA\u8F1B\u64CB\u4F4F\u4E86\u4E2D\u9593\u8ECA\u9053\u3002" },
  "stalled": { word: "stalled", phonetic: "/st\u0254\u02D0ld/", pos: "adj./v.", zh: "\u6545\u969C\u62CB\u9328\u7684\u3001\u7184\u706B\u505C\u6B62\u7684", def: "Stopped moving due to mechanical failure or obstruction.", example: "A stalled semi blocking the number two lane.", exampleZh: "\u4E00\u8F1B\u6545\u969C\u7684\u5927\u8CA8\u8ECA\u64CB\u4F4F\u4E86\u4E8C\u865F\u8ECA\u9053\u3002" },
  "semi": { word: "semi", phonetic: "/\u02C8sem.a\u026A/", pos: "n.", zh: "\u534A\u806F\u7D50\u5927\u8CA8\u8ECA\u3001\u5927\u578B\u8CA8\u6AC3\u62D6\u8ECA\uFF08semi-trailer truck\uFF09", def: "A large transport vehicle consisting of a tractor and a semi-trailer.", example: "A stalled semi blocking the freeway.", exampleZh: "\u4E00\u8F1B\u62CB\u9328\u7684\u5927\u578B\u62D6\u8ECA\u64CB\u4F4F\u4E86\u9AD8\u901F\u516C\u8DEF\u3002" },
  "deck": { word: "deck", phonetic: "/dek/", pos: "n.", zh: "\uFF08\u6A4B\u6A11\uFF09\u6A4B\u9762\u3001\u7532\u677F\u3001\u5C64\u9762", def: "A floor-like surface on a bridge or ship.", example: "For the lower deck of the Bay Bridge.", exampleZh: "\u524D\u5F80\u6D77\u7063\u5927\u6A4B\u4E0B\u5C64\u6A4B\u9762\u7684\u8DEF\u6BB5\u3002" },
  "underway": { word: "underway", phonetic: "/\u02CC\u028Cn.d\u025A\u02C8we\u026A/", pos: "adj.", zh: "\u9032\u884C\u4E2D\u3001\u5DF2\u51FA\u767C\u8655\u7F6E\u4E2D\u3001\u5728\u9014\u4E2D", def: "Having started and in progress; in motion.", example: "Bridge crews are underway.", exampleZh: "\u5927\u6A4B\u6436\u4FEE\u5DE5\u7A0B\u5718\u968A\u5DF2\u7D93\u5728\u9014\u4E2D\u8655\u7F6E\u3002" },
  "crew": { word: "crew", phonetic: "/kru\u02D0/", pos: "n.", zh: "\u5DE5\u4F5C\u968A\u3001\u6436\u4FEE\u7D44\u3001\u5168\u9AD4\u7D44\u54E1", def: "A group of people working closely together.", example: "Road and bridge maintenance crews.", exampleZh: "\u9053\u8DEF\u8207\u6A4B\u6A11\u990A\u8B77\u5DE5\u7A0B\u968A\u3002" },
  "crews": { word: "crews", phonetic: "/kru\u02D0z/", pos: "n. (\u8907\u6578)", zh: "\u5DE5\u7A0B\u6436\u4FEE\u968A\u4F0D\uFF08\u8907\u6578\uFF09", def: "Plural of crew; emergency response teams." },
  "backed": { word: "backed", phonetic: "/b\xE6kt/", pos: "v./adj.", zh: "\u56DE\u5835\u3001\u5012\u9000\u3001\u652F\u6301", def: "Traffic backed up: vehicles queued in a long line.", example: "Traffic backed up to Dakota Road.", exampleZh: "\u8ECA\u6D41\u5DF2\u7D93\u56DE\u5835\u81F3\u9054\u79D1\u4ED6\u8DEF\u3002" },
  "transit": { word: "transit", phonetic: "/\u02C8tr\xE6n.z\u026At/", pos: "n./v.", zh: "\u5927\u773E\u904B\u8F38\u3001\u904E\u5883\u3001\u904B\u8F38\u7CFB\u7D71", def: "The carrying of people or goods from one place to another.", example: "Public transit systems in the Bay Area.", exampleZh: "\u820A\u91D1\u5C71\u7063\u5340\u7684\u5927\u773E\u904B\u8F38\u7CFB\u7D71\u3002" },
  "commute": { word: "commute", phonetic: "/k\u0259\u02C8mju\u02D0t/", pos: "v./n.", zh: "\u901A\u52E4\u3001\u4E0A\u4E0B\u73ED\u5F80\u8FD4\uFF1B\u901A\u52E4\u8DEF\u7A0B", def: "To travel some distance between home and place of work regularly.", example: "The morning commute was very slow.", exampleZh: "\u4ECA\u5929\u65E9\u4E0A\u7684\u901A\u52E4\u8ECA\u6D41\u5341\u5206\u7DE9\u6162\u3002" },
  "traffic": { word: "traffic", phonetic: "/\u02C8tr\xE6f.\u026Ak/", pos: "n.", zh: "\u4EA4\u901A\u3001\u8ECA\u6D41\u3001\u5F80\u4F86\u6D41\u91CF", def: "Vehicles moving on a road or public highway.", example: "Heavy traffic on the freeway.", exampleZh: "\u9AD8\u901F\u516C\u8DEF\u4E0A\u8ECA\u6D41\u91CF\u6975\u70BA\u9F90\u5927\u3002" },
  "vehicle": { word: "vehicle", phonetic: "/\u02C8vi\u02D0.\u0259.k\u0259l/", pos: "n.", zh: "\u8ECA\u8F1B\u3001\u8F09\u5177\u3001\u50B3\u64AD\u5A92\u4ECB", def: "A thing used for transporting people or goods, especially on land." },
  "vehicles": { word: "vehicles", phonetic: "/\u02C8vi\u02D0.\u0259.k\u0259lz/", pos: "n. (\u8907\u6578)", zh: "\u8ECA\u8F1B\uFF08\u8907\u6578\uFF09", def: "Plural of vehicle; cars, trucks, or vans." },
  "freeway": { word: "freeway", phonetic: "/\u02C8fri\u02D0.we\u026A/", pos: "n.", zh: "\u9AD8\u901F\u516C\u8DEF\uFF08\u7121\u6536\u8CBB\u7AD9\uFF09", def: "An express highway with no tollgates." },
  "highway": { word: "highway", phonetic: "/\u02C8ha\u026A.we\u026A/", pos: "n.", zh: "\u516C\u8DEF\u3001\u5E79\u9053\u3001\u570B\u9053", def: "A main road, especially one connecting major towns or cities." },
  "shoulder": { word: "shoulder", phonetic: "/\u02C8\u0283o\u028Al.d\u0259r/", pos: "n.", zh: "\uFF08\u9053\u8DEF\uFF09\u8DEF\u80A9\uFF1B\u80A9\u8180", def: "The paved or unpaved strip along the side of a road or highway.", example: "Vehicles moved to the shoulder.", exampleZh: "\u8ECA\u8F1B\u5DF2\u7D93\u79FB\u81F3\u8DEF\u80A9\u3002" },
  "involve": { word: "involve", phonetic: "/\u026An\u02C8v\u0251\u02D0lv/", pos: "v.", zh: "\u6D89\u53CA\u3001\u5305\u542B\u3001\u6372\u5165", def: "To have or include as a necessary part or result." },
  "involved": { word: "involved", phonetic: "/\u026An\u02C8v\u0251\u02D0lvd/", pos: "adj./v.", zh: "\u6D89\u53CA\u5176\u4E2D\u7684\u3001\u727D\u6D89\u5230\u7684", def: "Participating or included in a situation or event.", example: "Two vehicles involved in an accident.", exampleZh: "\u5169\u8F1B\u8ECA\u727D\u6D89\u65BC\u4E00\u8D77\u8ECA\u798D\u4E8B\u6545\u4E2D\u3002" },
  "accident": { word: "accident", phonetic: "/\u02C8\xE6k.s\u0259.d\u0259nt/", pos: "n.", zh: "\u8ECA\u798D\u3001\u610F\u5916\u4E8B\u6545", def: "An unfortunate incident that happens unexpectedly." },
  "crash": { word: "crash", phonetic: "/kr\xE6\u0283/", pos: "n./v.", zh: "\u78B0\u649E\u4E8B\u6545\u3001\u589C\u6BC0\uFF1B\u649E\u6BC0", def: "A collision involving one or more vehicles." },
  "delay": { word: "delay", phonetic: "/d\u026A\u02C8le\u026A/", pos: "n./v.", zh: "\u5EF6\u8AA4\u3001\u803D\u64F1\u3001\u63A8\u9072", def: "A period of time by which something is late or postponed." },
  "delays": { word: "delays", phonetic: "/d\u026A\u02C8le\u026Az/", pos: "n. (\u8907\u6578)", zh: "\u5EF6\u8AA4\uFF08\u8907\u6578\uFF09", def: "Plural of delay; traffic holdups." },
  "lane": { word: "lane", phonetic: "/le\u026An/", pos: "n.", zh: "\u8ECA\u9053\u3001\u8DD1\u9053\u3001\u72F9\u7A84\u5C0F\u5F91", def: "A division of a road marked off for a single line of vehicles." },
  "lanes": { word: "lanes", phonetic: "/le\u026Anz/", pos: "n. (\u8907\u6578)", zh: "\u8ECA\u9053\uFF08\u8907\u6578\uFF09", def: "Plural of lane." },
  "blocked": { word: "blocked", phonetic: "/bl\u0251\u02D0kt/", pos: "adj./v.", zh: "\u88AB\u963B\u64CB\u7684\u3001\u5835\u585E\u7684", def: "Obstructed or prevented from passing.", example: "Two right lanes are blocked.", exampleZh: "\u53F3\u5074\u5169\u689D\u8ECA\u9053\u76EE\u524D\u53D7\u963B\u5C01\u9589\u3002" },
  "clear": { word: "clear", phonetic: "/kl\u026Ar/", pos: "adj./v.", zh: "\u901A\u66A2\u7684\u3001\u6E05\u6670\u7684\uFF1B\u6392\u9664\u3001\u6E05\u9664", def: "Free from obstruction; easy to perceive." },
  "cleared": { word: "cleared", phonetic: "/kl\u026Ard/", pos: "v./adj.", zh: "\u5DF2\u6392\u9664\u969C\u7919\u3001\u5DF2\u653E\u884C", def: "Obstruction removed.", example: "The accident has been cleared.", exampleZh: "\u4E8B\u6545\u73FE\u5834\u969C\u7919\u5DF2\u7D93\u5168\u6578\u6392\u9664\u3002" },
  // News, Weather & Society
  "infrastructure": { word: "infrastructure", phonetic: "/\u02C8\u026An.fr\u0259\u02CCstr\u028Ck.t\u0283\u025A/", pos: "n.", zh: "\u516C\u5171\u57FA\u790E\u8A2D\u65BD\u3001\u516C\u5171\u5EFA\u8A2D", def: "The basic physical systems of a region or country (transport, communication, water)." },
  "emissions": { word: "emissions", phonetic: "/i\u02C8m\u026A\u0283.\u0259nz/", pos: "n. (\u8907\u6578)", zh: "\u6C23\u9AD4\u6392\u653E\u7269\u3001\u78B3\u6392\u653E", def: "Gases or particles released into the air." },
  "emission": { word: "emission", phonetic: "/i\u02C8m\u026A\u0283.\u0259n/", pos: "n.", zh: "\u6392\u653E\u3001\u6563\u767C", def: "The production and discharge of something." },
  "climate": { word: "climate", phonetic: "/\u02C8kla\u026A.m\u0259t/", pos: "n.", zh: "\u6C23\u5019\u3001\u5F62\u52E2\u98A8\u6C23", def: "The weather conditions prevailing in an area over a long period." },
  "forecast": { word: "forecast", phonetic: "/\u02C8f\u0254\u02D0r.k\xE6st/", pos: "n./v.", zh: "\u5929\u6C23\u9810\u5831\u3001\u9810\u6E2C", def: "A prediction of weather or future events." },
  "community": { word: "community", phonetic: "/k\u0259\u02C8mju\u02D0.n\u0259.t\u032Ci/", pos: "n.", zh: "\u793E\u5340\u3001\u5171\u540C\u9AD4\u3001\u5927\u773E\u7FA4\u9AD4", def: "A group of people living in the same place or having particular characteristics in common." },
  "resilience": { word: "resilience", phonetic: "/r\u026A\u02C8z\u026Al.j\u0259ns/", pos: "n.", zh: "\u97CC\u6027\u3001\u5FA9\u539F\u529B\u3001\u5F48\u6027", def: "The capacity to recover quickly from difficulties; toughness." },
  "factor": { word: "factor", phonetic: "/\u02C8f\xE6k.t\u025A/", pos: "n./v.", zh: "\u56E0\u7D20\u3001\u8981\u7D20\uFF1B\u628A...\u8A08\u5165", def: "A circumstance or influence contributing to a result." },
  "breezes": { word: "breezes", phonetic: "/\u02C8bri\u02D0.z\u026Az/", pos: "n. (\u8907\u6578)", zh: "\u5FAE\u98A8\u3001\u548C\u98A8\uFF08\u8907\u6578\uFF09", def: "Gentle winds." },
  "breeze": { word: "breeze", phonetic: "/bri\u02D0z/", pos: "n.", zh: "\u5FAE\u98A8\u3001\u8F15\u800C\u6613\u8209\u7684\u4E8B", def: "A gentle wind." },
  "temperature": { word: "temperature", phonetic: "/\u02C8tem.pr\u0259.t\u0283\u025A/", pos: "n.", zh: "\u6EAB\u5EA6\u3001\u6C23\u6EAB", def: "The degree of hotness or coldness of a body or environment." },
  "economy": { word: "economy", phonetic: "/\u026A\u02C8k\u0251\u02D0.n\u0259.mi/", pos: "n.", zh: "\u7D93\u6FDF\u3001\u7D93\u6FDF\u9AD4\u7CFB", def: "The wealth and resources of a country or region." },
  "economic": { word: "economic", phonetic: "/\u02CCi\u02D0.k\u0259\u02C8n\u0251\u02D0.m\u026Ak/", pos: "adj.", zh: "\u7D93\u6FDF\u4E0A\u7684\u3001\u6709\u5229\u53EF\u5716\u7684", def: "Relating to economics or the economy." },
  "government": { word: "government", phonetic: "/\u02C8\u0261\u028Cv.\u025An.m\u0259nt/", pos: "n.", zh: "\u653F\u5E9C\u3001\u653F\u6B0A\u3001\u7BA1\u7406\u6A5F\u69CB", def: "The governing body of a nation, state, or community." },
  "official": { word: "official", phonetic: "/\u0259\u02C8f\u026A\u0283.\u0259l/", pos: "n./adj.", zh: "\u5B98\u54E1\u3001\u767C\u8A00\u4EBA\uFF1B\u5B98\u65B9\u7684\u3001\u6B63\u5F0F\u7684", def: "A person holding public office; relating to authority." },
  "officials": { word: "officials", phonetic: "/\u0259\u02C8f\u026A\u0283.\u0259lz/", pos: "n. (\u8907\u6578)", zh: "\u653F\u5E9C\u5B98\u54E1\u3001\u4E3B\u7BA1\u55AE\u4F4D\uFF08\u8907\u6578\uFF09", def: "Plural of official." },
  "president": { word: "president", phonetic: "/\u02C8prez.\u026A.d\u0259nt/", pos: "n.", zh: "\u7E3D\u7D71\u3001\u7E3D\u88C1\u3001\u4E3B\u5E2D", def: "The elected head of a republican state or organization." },
  "court": { word: "court", phonetic: "/k\u0254\u02D0rt/", pos: "n.", zh: "\u6CD5\u9662\u3001\u6CD5\u5EAD\u3001\u7403\u5834", def: "A tribunal presided over by a judge or judges." },
  "police": { word: "police", phonetic: "/p\u0259\u02C8li\u02D0s/", pos: "n.", zh: "\u8B66\u5BDF\u3001\u8B66\u65B9\u3001\u6CBB\u5B89\u4EBA\u54E1", def: "The civil force of a state responsible for law and order." },
  "officer": { word: "officer", phonetic: "/\u02C8\u0251\u02D0.f\u026A.s\u025A/", pos: "n.", zh: "\u8B66\u5B98\u3001\u5B98\u54E1\u3001\u8ECD\u5B98", def: "A person holding a position of authority." },
  "investigation": { word: "investigation", phonetic: "/\u026An\u02CCves.t\u0259\u02C8\u0261e\u026A.\u0283\u0259n/", pos: "n.", zh: "\u8ABF\u67E5\u3001\u5BE9\u67E5", def: "The action of investigating something or someone." },
  "market": { word: "market", phonetic: "/\u02C8m\u0251\u02D0r.k\u026At/", pos: "n./v.", zh: "\u5E02\u5834\u3001\u80A1\u5E02\u3001\u5E02\u96C6\uFF1B\u884C\u92B7", def: "A regular gathering for the purchase and sale of provisions or commodities." },
  "inflation": { word: "inflation", phonetic: "/\u026An\u02C8fle\u026A.\u0283\u0259n/", pos: "n.", zh: "\u901A\u8CA8\u81A8\u8139\u3001\u7269\u50F9\u4E0A\u6F32", def: "A general increase in prices and fall in the purchasing value of money." },
  "rate": { word: "rate", phonetic: "/re\u026At/", pos: "n./v.", zh: "\u6BD4\u7387\u3001\u5229\u7387\u3001\u901F\u5EA6\uFF1B\u8A55\u5B9A", def: "A measure, quantity, or frequency." },
  "rates": { word: "rates", phonetic: "/re\u026Ats/", pos: "n. (\u8907\u6578)", zh: "\u5229\u7387\u3001\u8CBB\u7387\uFF08\u8907\u6578\uFF09", def: "Plural of rate." },
  "release": { word: "release", phonetic: "/r\u026A\u02C8li\u02D0s/", pos: "v./n.", zh: "\u767C\u5E03\u3001\u767C\u884C\u3001\u91CB\u653E\u3001\u89E3\u9396", def: "To allow or enable to escape from confinement; to make a statement or document available to the public.", example: "The radio station released the latest public safety bulletin.", exampleZh: "\u5EE3\u64AD\u96FB\u53F0\u767C\u5E03\u4E86\u6700\u65B0\u516C\u5171\u5B89\u5168\u516C\u544A\u3002" },
  "released": { word: "released", phonetic: "/r\u026A\u02C8li\u02D0st/", pos: "v. (\u904E\u53BB\u5F0F/\u904E\u53BB\u5206\u8A5E) / adj.", zh: "\u5DF2\u767C\u5E03\u3001\u5DF2\u91CB\u653E\u3001\u516C\u5E03\u7684", def: "Made available to the public or set free from restraint or duty.", example: "The newly released official report confirmed the update.", exampleZh: "\u6700\u65B0\u767C\u5E03\u7684\u5B98\u65B9\u5831\u544A\u8B49\u5BE6\u4E86\u9019\u9805\u66F4\u65B0\u3002" },
  // Stanford & Academic Institutions
  "stanford": { word: "Stanford", phonetic: "/\u02C8st\xE6n.f\u025Ad/", pos: "n.", zh: "\u53F2\u4E39\u4F5B\u5927\u5B78\uFF08\u540D\u6821\uFF09\uFF1B\u53F2\u4E39\u4F5B\uFF08\u59D3\u6C0F/\u5730\u540D\uFF09", def: "A world-renowned private research university in California; also a prominent family and place name.", example: "Researchers at Stanford announced the scientific breakthrough today.", exampleZh: "\u53F2\u4E39\u4F5B\u5927\u5B78\u7684\u7814\u7A76\u4EBA\u54E1\u4ECA\u5929\u5BA3\u5E03\u4E86\u9019\u9805\u91CD\u5927\u79D1\u5B78\u7A81\u7834\u3002" },
  // General High-Frequency Vocabulary
  "catch": { word: "catch", phonetic: "/k\xE6t\u0283/", pos: "v./n.", zh: "\u6355\u6349\u3001\u6293\u4F4F\u3001\u63A5\u4F4F\u3001\u8D95\u4E0A\uFF1B\u6355\u7372\u7269", def: "To capture, intercept, or seize." },
  "caught": { word: "caught", phonetic: "/k\u0254\u02D0t/", pos: "v. (\u904E\u53BB\u5F0F)", zh: "\u6293\u4F4F\u4E86\u3001\u8D95\u4E0A\u4E86\u3001\u88AB\u902E\u5230\uFF08catch \u7684\u904E\u53BB\u5F0F\uFF09", def: "Past tense of catch." },
  "catching": { word: "catching", phonetic: "/\u02C8k\xE6t\u0283.\u026A\u014B/", pos: "v./adj.", zh: "\u6B63\u5728\u6293\u53D6\u3001\u63A5\u7403\uFF1B\u5177\u50B3\u67D3\u6027\u7684", def: "Present participle of catch." },
  "individual": { word: "individual", phonetic: "/\u02CC\u026An.d\u0259\u02C8v\u026Ad\u0292.u.\u0259l/", pos: "n./adj.", zh: "\u500B\u4EBA\u3001\u500B\u9AD4\uFF1B\u500B\u5225\u7684\u3001\u7368\u7279\u7684", def: "A single human being as distinct from a group." },
  "individuals": { word: "individuals", phonetic: "/\u02CC\u026An.d\u0259\u02C8v\u026Ad\u0292.u.\u0259lz/", pos: "n. (\u8907\u6578)", zh: "\u500B\u4EBA\u3001\u5927\u773E\u500B\u9AD4\uFF08\u8907\u6578\uFF09", def: "Plural of individual; distinct persons." },
  "people": { word: "people", phonetic: "/\u02C8pi\u02D0.p\u0259l/", pos: "n.", zh: "\u4EBA\u5011\u3001\u4EBA\u6C11\u3001\u5927\u773E", def: "Human beings in general or considered collectively." },
  "listen": { word: "listen", phonetic: "/\u02C8l\u026As.\u0259n/", pos: "v.", zh: "\u8046\u807D\u3001\u6536\u807D\u3001\u807D\u5F9E", def: "To give one's attention to a sound." },
  "listening": { word: "listening", phonetic: "/\u02C8l\u026As.\u0259n.\u026A\u014B/", pos: "v./n.", zh: "\u6B63\u5728\u8046\u807D\u3001\u6536\u807D\u4E2D", def: "Present participle of listen." },
  "broadcast": { word: "broadcast", phonetic: "/\u02C8br\u0254\u02D0d.k\xE6st/", pos: "n./v.", zh: "\u5EE3\u64AD\u3001\u64AD\u9001\u3001\u96FB\u53F0\u7BC0\u76EE", def: "To transmit by radio or television." },
  "broadcasting": { word: "broadcasting", phonetic: "/\u02C8br\u0254\u02D0d\u02CCk\xE6s.t\u026A\u014B/", pos: "n.", zh: "\u5EE3\u64AD\u4E8B\u696D\u3001\u64AD\u9001\u50B3\u64AD", def: "The business of making television and radio programs." },
  "radio": { word: "radio", phonetic: "/\u02C8re\u026A.di.o\u028A/", pos: "n.", zh: "\u6536\u97F3\u6A5F\u3001\u5EE3\u64AD\u96FB\u53F0\u3001\u7121\u7DDA\u96FB", def: "The transmission and reception of electromagnetic waves." },
  "voice": { word: "voice", phonetic: "/v\u0254\u026As/", pos: "n./v.", zh: "\u8072\u97F3\u3001\u55D3\u97F3\u3001\u767C\u8072", def: "The sound produced in a person's larynx and uttered through the mouth." },
  "voices": { word: "voices", phonetic: "/\u02C8v\u0254\u026A.s\u026Az/", pos: "n. (\u8907\u6578)", zh: "\u8072\u97F3\u3001\u5404\u65B9\u610F\u898B\uFF08\u8907\u6578\uFF09", def: "Plural of voice." },
  "station": { word: "station", phonetic: "/\u02C8ste\u026A.\u0283\u0259n/", pos: "n.", zh: "\u5EE3\u64AD\u96FB\u53F0\u3001\u8ECA\u7AD9\u3001\u57FA\u5730", def: "A broadcasting company or location." },
  "program": { word: "program", phonetic: "/\u02C8pro\u028A.\u0261r\xE6m/", pos: "n./v.", zh: "\u7BC0\u76EE\u3001\u8A08\u756B\u3001\u65B9\u6848\uFF1B\u7DE8\u5BEB\u7A0B\u5F0F", def: "A planned series of events or performances." },
  "programs": { word: "programs", phonetic: "/\u02C8pro\u028A.\u0261r\xE6mz/", pos: "n. (\u8907\u6578)", zh: "\u7BC0\u76EE\u3001\u5C08\u6848\uFF08\u8907\u6578\uFF09", def: "Plural of program." },
  "service": { word: "service", phonetic: "/\u02C8s\u025D\u02D0.v\u026As/", pos: "n./v.", zh: "\u670D\u52D9\u3001\u516C\u5171\u6A5F\u69CB\u3001\u6AA2\u4FEE", def: "An act of helpful activity; public utility." },
  "system": { word: "system", phonetic: "/\u02C8s\u026As.t\u0259m/", pos: "n.", zh: "\u7CFB\u7D71\u3001\u9AD4\u5236\u3001\u9AD4\u7CFB", def: "A set of things working together as parts of a mechanism." },
  "support": { word: "support", phonetic: "/s\u0259\u02C8p\u0254\u02D0rt/", pos: "v./n.", zh: "\u652F\u6301\u3001\u8D0A\u52A9\u3001\u63F4\u52A9\u3001\u7DAD\u6301", def: "To give assistance or encouragement to." },
  "health": { word: "health", phonetic: "/hel\u03B8/", pos: "n.", zh: "\u5065\u5EB7\u3001\u885B\u751F\u3001\u91AB\u7642\u5065\u4FDD", def: "The state of being free from illness or injury." },
  "education": { word: "education", phonetic: "/\u02CCed\u0292.\u0259\u02C8ke\u026A.\u0283\u0259n/", pos: "n.", zh: "\u6559\u80B2\u3001\u57F9\u990A\u3001\u6559\u5B78", def: "The process of receiving or giving systematic instruction." },
  "research": { word: "research", phonetic: "/\u02C8ri\u02D0.s\u025D\u02D0t\u0283/", pos: "n./v.", zh: "\u5B78\u8853\u7814\u7A76\u3001\u8ABF\u67E5\u3001\u7814\u767C", def: "The systematic investigation into and study of materials." },
  "security": { word: "security", phonetic: "/s\u0259\u02C8kj\u028Ar.\u0259.t\u032Ci/", pos: "n.", zh: "\u5B89\u5168\u3001\u4FDD\u5168\u3001\u4FDD\u969C\u3001\u9632\u885B", def: "The state of being free from danger or threat." },
  "experience": { word: "experience", phonetic: "/\u026Ak\u02C8sp\u026Ar.i.\u0259ns/", pos: "n./v.", zh: "\u7D93\u9A57\u3001\u9AD4\u9A57\u3001\u7D93\u6B77", def: "Practical contact with and observation of facts or events." },
  "decision": { word: "decision", phonetic: "/d\u026A\u02C8s\u026A\u0292.\u0259n/", pos: "n.", zh: "\u6C7A\u5B9A\u3001\u6C7A\u7B56\u3001\u5224\u6C7A", def: "A conclusion or resolution reached after consideration." },
  "decisions": { word: "decisions", phonetic: "/d\u026A\u02C8s\u026A\u0292.\u0259nz/", pos: "n. (\u8907\u6578)", zh: "\u6C7A\u5B9A\u3001\u653F\u7B56\u65B9\u91DD\uFF08\u8907\u6578\uFF09", def: "Plural of decision." }
};
function lookupQuickWord(rawWord) {
  const clean = rawWord.trim().toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!clean) return null;
  if (BUILTIN_DICT[clean]) {
    return BUILTIN_DICT[clean];
  }
  if (clean.endsWith("ed")) {
    const base1 = clean.slice(0, -2);
    const base2 = clean.slice(0, -1);
    if (BUILTIN_DICT[base1]) {
      const base = BUILTIN_DICT[base1];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: "v. (\u904E\u53BB\u5F0F)",
        zh: `${base.zh.split("\u3001")[0]}\u4E86\uFF08${base.word} \u7684\u904E\u53BB\u5F0F\uFF09`,
        def: `Past tense of ${base.word}: ${base.def || ""}`,
        example: base.example
      };
    }
    if (BUILTIN_DICT[base2]) {
      const base = BUILTIN_DICT[base2];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: "v. (\u904E\u53BB\u5F0F)",
        zh: `${base.zh.split("\u3001")[0]}\u4E86\uFF08${base.word} \u7684\u904E\u53BB\u5F0F\uFF09`,
        def: `Past tense of ${base.word}: ${base.def || ""}`,
        example: base.example
      };
    }
  }
  if (clean.endsWith("ing")) {
    const base1 = clean.slice(0, -3);
    const base2 = clean.slice(0, -3) + "e";
    if (BUILTIN_DICT[base1]) {
      const base = BUILTIN_DICT[base1];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: "v. (\u73FE\u5728\u5206\u8A5E/\u9032\u884C\u5F0F)",
        zh: `\u6B63\u5728${base.zh.split("\u3001")[0]}\uFF08${base.word} \u7684\u9032\u884C\u5F0F\uFF09`,
        def: `Present participle of ${base.word}`,
        example: base.example
      };
    }
    if (BUILTIN_DICT[base2]) {
      const base = BUILTIN_DICT[base2];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: "v. (\u73FE\u5728\u5206\u8A5E/\u9032\u884C\u5F0F)",
        zh: `\u6B63\u5728${base.zh.split("\u3001")[0]}\uFF08${base.word} \u7684\u9032\u884C\u5F0F\uFF09`,
        def: `Present participle of ${base.word}`,
        example: base.example
      };
    }
  }
  if (clean.endsWith("s")) {
    const base1 = clean.slice(0, -1);
    const base2 = clean.endsWith("es") ? clean.slice(0, -2) : "";
    if (BUILTIN_DICT[base1]) {
      const base = BUILTIN_DICT[base1];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: "n. (\u8907\u6578) / v. (\u55AE\u6578\u52D5\u8A5E)",
        zh: `${base.zh}\uFF08\u8907\u6578/\u7B2C\u4E09\u4EBA\u7A31\uFF09`,
        def: base.def,
        example: base.example
      };
    }
    if (base2 && BUILTIN_DICT[base2]) {
      const base = BUILTIN_DICT[base2];
      return {
        word: clean,
        phonetic: `/${clean}/`,
        pos: "n. (\u8907\u6578) / v. (\u55AE\u6578\u52D5\u8A5E)",
        zh: `${base.zh}\uFF08\u8907\u6578/\u7B2C\u4E09\u4EBA\u7A31\uFF09`,
        def: base.def,
        example: base.example
      };
    }
  }
  return null;
}
function generateContextualExample(word, pos = "", index = 0, definition = "", usedSentences) {
  const clean = (word || "").trim();
  if (!clean) {
    return { sentence: "", translation: "" };
  }
  const isOriginallyCapitalized = /^[A-Z]/.test(clean);
  const displayWord = isOriginallyCapitalized ? clean : clean.toLowerCase();
  const capitalizedWord = clean.charAt(0).toUpperCase() + clean.slice(1);
  if (index === 0) {
    const matched = lookupQuickWord(clean.toLowerCase());
    if (matched?.example) {
      const sentence = matched.example;
      if (!usedSentences || !usedSentences.has(sentence)) {
        if (usedSentences) usedSentences.add(sentence);
        return {
          sentence,
          translation: matched.exampleZh || ""
        };
      }
    }
  }
  const defLower = (definition || "").toLowerCase();
  const p = (pos || "").toLowerCase();
  const contextCandidates = [];
  if (defLower.includes("university") || defLower.includes("college") || defLower.includes("campus") || defLower.includes("academic") || defLower.includes("school") || defLower.includes("institute")) {
    contextCandidates.push(
      {
        sentence: `Researchers at ${capitalizedWord} announced a major scientific discovery today.`,
        translation: `${capitalizedWord}\u5927\u5B78\u7684\u7814\u7A76\u4EBA\u54E1\u4ECA\u5929\u5BA3\u5E03\u4E86\u4E00\u9805\u91CD\u5927\u79D1\u5B78\u767C\u73FE\u3002`
      },
      {
        sentence: `She completed her graduate studies at ${capitalizedWord} with top honors.`,
        translation: `\u5979\u5728${capitalizedWord}\u5927\u5B78\u4EE5\u512A\u7570\u6210\u7E3E\u5B8C\u6210\u4E86\u7814\u7A76\u6240\u5B78\u4F4D\u3002`
      },
      {
        sentence: `The professor from ${capitalizedWord} shared key insights during the radio interview.`,
        translation: `\u4F86\u81EA${capitalizedWord}\u5927\u5B78\u7684\u6559\u6388\u5728\u5EE3\u64AD\u5C08\u8A2A\u4E2D\u5206\u4EAB\u4E86\u95DC\u9375\u898B\u89E3\u3002`
      }
    );
  }
  if (defLower.includes("surname") || defLower.includes("habitational") || defLower.includes("family name") || defLower.includes("person") || defLower.includes("named after")) {
    contextCandidates.push(
      {
        sentence: `Professor ${capitalizedWord} delivered an insightful address during the symposium.`,
        translation: `${capitalizedWord}\u6559\u6388\u5728\u5EA7\u8AC7\u6703\u4E0A\u767C\u8868\u4E86\u4E00\u5834\u6DF1\u523B\u7684\u6F14\u8B1B\u3002`
      },
      {
        sentence: `The historic library was founded by the ${capitalizedWord} family in the nineteenth century.`,
        translation: `\u9019\u5EA7\u6B77\u53F2\u60A0\u4E45\u7684\u5716\u66F8\u9928\u662F\u7531${capitalizedWord}\u5BB6\u65CF\u65BC\u5341\u4E5D\u4E16\u7D00\u5275\u7ACB\u7684\u3002`
      },
      {
        sentence: `Dr. ${capitalizedWord} answered questions from listeners during the live broadcast.`,
        translation: `${capitalizedWord}\u535A\u58EB\u5728\u5373\u6642\u5EE3\u64AD\u4E2D\u89AA\u5207\u56DE\u7B54\u4E86\u807D\u773E\u7684\u63D0\u554F\u3002`
      }
    );
  }
  if (defLower.includes("city") || defLower.includes("town") || defLower.includes("county") || defLower.includes("village") || defLower.includes("settlement") || defLower.includes("capital of")) {
    contextCandidates.push(
      {
        sentence: `The news team traveled to ${capitalizedWord} to report on local community developments.`,
        translation: `\u65B0\u805E\u63A1\u8A2A\u5718\u968A\u524D\u5F80${capitalizedWord}\u5831\u5C0E\u7576\u5730\u793E\u5340\u7684\u6700\u65B0\u52D5\u614B\u3002`
      },
      {
        sentence: `Residents across ${capitalizedWord} participated in the annual civic forum.`,
        translation: `${capitalizedWord}\u5404\u5730\u7684\u5C45\u6C11\u7A4D\u6975\u53C3\u8207\u4E86\u9019\u5834\u5E74\u5EA6\u5E02\u6C11\u8AD6\u58C7\u3002`
      }
    );
  }
  if (defLower.includes("vehicle") || defLower.includes("car") || defLower.includes("truck") || defLower.includes("traffic") || defLower.includes("transit") || defLower.includes("road") || defLower.includes("highway")) {
    contextCandidates.push(
      {
        sentence: `Traffic reports advised drivers to exercise caution regarding the ${displayWord}.`,
        translation: `\u4EA4\u901A\u8DEF\u6CC1\u63D0\u9192\u99D5\u99DB\u4EBA\u884C\u7D93\u8A72\u8DEF\u6BB5\u6642\u6CE8\u610F${displayWord}\u72C0\u6CC1\u3002`
      },
      {
        sentence: `Emergency personnel were dispatched to manage the situation involving the ${displayWord}.`,
        translation: `\u7DCA\u6025\u61C9\u8B8A\u5C0F\u7D44\u5DF2\u51FA\u52D5\u4EE5\u8655\u7F6E\u6D89\u53CA\u8A72${displayWord}\u7684\u73FE\u5834\u72C0\u6CC1\u3002`
      },
      {
        sentence: `The local transit authority updated guidelines concerning ${displayWord} safety.`,
        translation: `\u7576\u5730\u5927\u773E\u904B\u8F38\u4E3B\u7BA1\u6A5F\u95DC\u767C\u5E03\u4E86\u95DC\u65BC${displayWord}\u5B89\u5168\u7684\u6700\u65B0\u6307\u5F15\u3002`
      }
    );
  }
  if (defLower.includes("law") || defLower.includes("court") || defLower.includes("police") || defLower.includes("judge") || defLower.includes("legal") || defLower.includes("crime")) {
    contextCandidates.push(
      {
        sentence: `Legal analysts examined how the court's ruling impacts ${displayWord} across the region.`,
        translation: `\u6CD5\u5F8B\u5206\u6790\u5E2B\u6DF1\u5165\u63A2\u8A0E\u4E86\u6CD5\u9662\u5224\u6C7A\u5C0D\u5168\u5340${displayWord}\u6240\u5E36\u4F86\u7684\u5F71\u97FF\u3002`
      },
      {
        sentence: `Authorities held a press conference to provide clear details on the ${displayWord}.`,
        translation: `\u7576\u5C40\u8209\u884C\u4E86\u65B0\u805E\u767C\u5E03\u6703\uFF0C\u5C31\u8A72${displayWord}\u63D0\u4F9B\u4E86\u8A73\u5BE6\u7684\u8AAA\u660E\u3002`
      }
    );
  }
  if (defLower.includes("money") || defLower.includes("market") || defLower.includes("economy") || defLower.includes("finance") || defLower.includes("bank") || defLower.includes("cost") || defLower.includes("price")) {
    contextCandidates.push(
      {
        sentence: `Economists discussed the broader market implications surrounding ${displayWord} today.`,
        translation: `\u7D93\u6FDF\u5B78\u5BB6\u4ECA\u5929\u8A0E\u8AD6\u4E86\u570D\u7E5E${displayWord}\u7684\u6574\u9AD4\u5E02\u5834\u5F71\u97FF\u3002`
      },
      {
        sentence: `Investors closely watched financial indicators related to ${displayWord} this morning.`,
        translation: `\u6295\u8CC7\u4EBA\u4ECA\u5929\u4E0A\u5348\u5BC6\u5207\u95DC\u6CE8\u8207${displayWord}\u76F8\u95DC\u7684\u5404\u9805\u91D1\u878D\u6307\u6A19\u3002`
      }
    );
  }
  if (defLower.includes("weather") || defLower.includes("climate") || defLower.includes("wind") || defLower.includes("rain") || defLower.includes("temperature") || defLower.includes("atmosphere")) {
    contextCandidates.push(
      {
        sentence: `Meteorologists noted that ${displayWord} will play a key role in regional weather patterns.`,
        translation: `\u6C23\u8C61\u5B78\u5BB6\u6307\u51FA\uFF0C${displayWord}\u5C07\u5728\u5340\u57DF\u6C23\u5019\u578B\u614B\u4E2D\u626E\u6F14\u95DC\u9375\u89D2\u8272\u3002`
      },
      {
        sentence: `The seasonal forecast highlights expected changes in ${displayWord} over coming weeks.`,
        translation: `\u5B63\u7BC0\u9810\u5831\u8457\u91CD\u5F37\u8ABF\u4E86\u672A\u4F86\u6578\u9031\u5167${displayWord}\u53EF\u80FD\u767C\u751F\u7684\u8F49\u8B8A\u3002`
      }
    );
  }
  for (const cand of contextCandidates) {
    if (!usedSentences || !usedSentences.has(cand.sentence)) {
      if (usedSentences) usedSentences.add(cand.sentence);
      return cand;
    }
  }
  let pool = [];
  if (p.includes("adj") || p.includes("\u5F62\u5BB9\u8A5E")) {
    pool = [
      {
        sentence: `The news anchor delivered a ${displayWord} summary of today's top headlines.`,
        translation: `\u65B0\u805E\u4E3B\u64AD\u5C0D\u4ECA\u65E5\u7684\u982D\u689D\u8981\u805E\u9032\u884C\u4E86${displayWord}\u7684\u6982\u8FF0\u3002`
      },
      {
        sentence: `Finding a ${displayWord} solution remains the primary focus for city planners.`,
        translation: `\u5C0B\u6C42\u4E00\u500B${displayWord}\u7684\u89E3\u6C7A\u65B9\u6848\u4F9D\u7136\u662F\u57CE\u5E02\u898F\u5283\u8005\u7684\u9996\u8981\u7126\u9EDE\u3002`
      },
      {
        sentence: `Community members shared ${displayWord} feedback during the public hearing.`,
        translation: `\u793E\u5340\u5C45\u6C11\u5728\u516C\u807D\u6703\u4E2D\u5206\u4EAB\u4E86${displayWord}\u7684\u53CD\u994B\u610F\u898B\u3002`
      },
      {
        sentence: `The morning broadcast provided several ${displayWord} perspectives on the topic.`,
        translation: `\u65E9\u9593\u5EE3\u64AD\u7BC0\u76EE\u91DD\u5C0D\u8A72\u4E3B\u984C\u63D0\u4F9B\u4E86\u6578\u500B${displayWord}\u7684\u89C0\u5BDF\u8996\u89D2\u3002`
      },
      {
        sentence: `Her ${displayWord} contributions to the project were recognized by the committee.`,
        translation: `\u5979\u5C0D\u8A72\u9805\u76EE\u7684${displayWord}\u8CA2\u737B\u7372\u5F97\u4E86\u59D4\u54E1\u6703\u7684\u9AD8\u5EA6\u8A8D\u53EF\u3002`
      }
    ];
  } else if (p.includes("adv") || p.includes("\u526F\u8A5E")) {
    pool = [
      {
        sentence: `The spokesperson ${displayWord} addressed each question raised by the press.`,
        translation: `\u767C\u8A00\u4EBA${displayWord}\u56DE\u61C9\u4E86\u5A92\u9AD4\u8A18\u8005\u63D0\u51FA\u7684\u6BCF\u500B\u554F\u984C\u3002`
      },
      {
        sentence: `The transit system operated ${displayWord} throughout the morning rush hour.`,
        translation: `\u5927\u773E\u904B\u8F38\u7CFB\u7D71\u5728\u65E9\u9593\u901A\u52E4\u9AD8\u5CF0\u671F\u4FDD\u6301${displayWord}\u904B\u8F49\u3002`
      },
      {
        sentence: `City officials responded ${displayWord} to ensure community safety.`,
        translation: `\u5E02\u5E9C\u5B98\u54E1${displayWord}\u63A1\u53D6\u884C\u52D5\uFF0C\u4EE5\u78BA\u4FDD\u793E\u5340\u5927\u773E\u5B89\u5168\u3002`
      },
      {
        sentence: `The host ${displayWord} summarized the main takeaways of the interview.`,
        translation: `\u4E3B\u6301\u4EBA${displayWord}\u7E3D\u7D50\u4E86\u672C\u6B21\u5C08\u8A2A\u7684\u6838\u5FC3\u7CBE\u9AD3\u3002`
      }
    ];
  } else if (p.includes("\u52D5\u8A5E") || p.startsWith("v")) {
    if (clean.toLowerCase().endsWith("ed")) {
      pool = [
        {
          sentence: `Authorities ${displayWord} the updated safety guidelines to the public today.`,
          translation: `\u7576\u5C40\u4ECA\u5929\u5411\u5927\u773E${displayWord}\u4E86\u6700\u65B0\u7684\u5B89\u5168\u6307\u5C0E\u65B9\u91DD\u3002`
        },
        {
          sentence: `The committee ${displayWord} key recommendations following extensive review.`,
          translation: `\u5728\u5EE3\u6CDB\u5BE9\u8996\u4E4B\u5F8C\uFF0C\u59D4\u54E1\u6703${displayWord}\u4E86\u91CD\u8981\u5EFA\u8B70\u3002`
        },
        {
          sentence: `Journalists ${displayWord} on the ongoing developments from the field.`,
          translation: `\u65B0\u805E\u8A18\u8005\u81EA\u7B2C\u4E00\u7DDA\u73FE\u5834\u5C0D\u6301\u7E8C\u767C\u5C55\u7684\u4E8B\u4EF6\u9032\u884C\u4E86${displayWord}\u3002`
        },
        {
          sentence: `The strategic plan was positively ${displayWord} by regional leaders.`,
          translation: `\u8A72\u7B56\u7565\u8A08\u756B\u7372\u5F97\u4E86\u5340\u57DF\u9818\u5C0E\u5718\u968A\u7684\u7A4D\u6975${displayWord}\u3002`
        }
      ];
    } else if (clean.toLowerCase().endsWith("ing")) {
      pool = [
        {
          sentence: `Reporters are actively ${displayWord} the developing community story.`,
          translation: `\u8A18\u8005\u6B63\u7A4D\u6975${displayWord}\u9019\u5247\u6301\u7E8C\u767C\u9175\u7684\u793E\u5340\u65B0\u805E\u3002`
        },
        {
          sentence: `The team has spent months ${displayWord} sustainable solutions for residents.`,
          translation: `\u5718\u968A\u82B1\u4E86\u6578\u6708\u6642\u9593\u70BA\u5C45\u6C11${displayWord}\u53EF\u6301\u7E8C\u7684\u89E3\u6C7A\u65B9\u6848\u3002`
        },
        {
          sentence: `Analysts are closely ${displayWord} changes across the local economy.`,
          translation: `\u5206\u6790\u5E2B\u6B63\u5BC6\u5207${displayWord}\u5728\u5730\u7D93\u6FDF\u7684\u5404\u9805\u8B8A\u5316\u3002`
        },
        {
          sentence: `Broadcasters were ${displayWord} live updates as the briefing concluded.`,
          translation: `\u96A8\u8457\u7C21\u5831\u6703\u7D50\u675F\uFF0C\u5EE3\u64AD\u54E1\u6B63\u5728${displayWord}\u5373\u6642\u5FEB\u8A0A\u3002`
        }
      ];
    } else {
      pool = [
        {
          sentence: `Radio hosts often ${displayWord} essential guidance for morning commuters.`,
          translation: `\u5EE3\u64AD\u4E3B\u6301\u4EBA\u7D93\u5E38\u70BA\u6668\u9593\u901A\u52E4\u65CF${displayWord}\u5FC5\u8981\u6307\u5F15\u3002`
        },
        {
          sentence: `Organizations are collaborating to ${displayWord} effective new programs.`,
          translation: `\u5404\u6A5F\u69CB\u6B63\u901A\u529B\u5408\u4F5C\u4EE5${displayWord}\u884C\u4E4B\u6709\u6548\u7684\u65B0\u65B9\u6848\u3002`
        },
        {
          sentence: `Officials plan to ${displayWord} key strategies in the upcoming quarter.`,
          translation: `\u5B98\u54E1\u8A08\u5283\u5728\u4E0B\u4E00\u5B63\u5EA6${displayWord}\u6838\u5FC3\u7B56\u7565\u3002`
        },
        {
          sentence: `Listeners are invited to ${displayWord} during the open discussion segment.`,
          translation: `\u5728\u958B\u653E\u8A0E\u8AD6\u74B0\u7BC0\u4E2D\uFF0C\u96FB\u53F0\u8AA0\u646F\u9080\u8ACB\u807D\u773E\u5171\u540C${displayWord}\u3002`
        }
      ];
    }
  } else {
    if (clean.toLowerCase().endsWith("s") && clean.length > 3 && !clean.toLowerCase().endsWith("ss")) {
      pool = [
        {
          sentence: `Recent ${displayWord} have attracted significant public interest across the region.`,
          translation: `\u8FD1\u671F\u7684\u9019\u4E9B${displayWord}\u5F15\u8D77\u4E86\u6574\u500B\u5730\u5340\u7684\u5927\u773E\u9AD8\u5EA6\u95DC\u6CE8\u3002`
        },
        {
          sentence: `Officials reviewed several critical ${displayWord} during the morning briefing.`,
          translation: `\u5B98\u54E1\u5728\u6668\u9593\u7C21\u5831\u4E2D\u5BE9\u8996\u4E86\u6578\u9805\u95DC\u9375\u7684${displayWord}\u3002`
        },
        {
          sentence: `Analysts are tracking how these ${displayWord} will influence community life.`,
          translation: `\u5206\u6790\u5E2B\u6B63\u5728\u8FFD\u8E64\u9019\u4E9B${displayWord}\u5C07\u5982\u4F55\u5F71\u97FF\u793E\u5340\u751F\u6D3B\u3002`
        },
        {
          sentence: `New policies regarding ${displayWord} will take effect starting next month.`,
          translation: `\u95DC\u65BC${displayWord}\u7684\u65B0\u653F\u7B56\u5C07\u65BC\u4E0B\u6708\u8D77\u6B63\u5F0F\u751F\u6548\u3002`
        },
        {
          sentence: `Community groups organized discussions around the challenges of ${displayWord}.`,
          translation: `\u793E\u5340\u5718\u9AD4\u570D\u7E5E\u8457\u9019\u4E9B${displayWord}\u6240\u5E36\u4F86\u7684\u6311\u6230\u7D44\u7E54\u4E86\u591A\u5834\u5C08\u984C\u7814\u8A0E\u3002`
        }
      ];
    } else {
      const nounWord = isOriginallyCapitalized ? capitalizedWord : displayWord;
      pool = [
        {
          sentence: `Recent coverage highlighted new developments regarding ${nounWord}.`,
          translation: `\u8FD1\u671F\u7684\u65B0\u805E\u5831\u5C0E\u8457\u91CD\u6307\u51FA\u4E86\u95DC\u65BC${nounWord}\u7684\u6700\u65B0\u9032\u5C55\u3002`
        },
        {
          sentence: `Experts shared valuable insights on ${nounWord} during the panel interview.`,
          translation: `\u5C08\u5BB6\u5728\u5EA7\u8AC7\u5C08\u8A2A\u4E2D\u5206\u4EAB\u4E86\u95DC\u65BC${nounWord}\u7684\u5BF6\u8CB4\u6D1E\u898B\u3002`
        },
        {
          sentence: `A comprehensive assessment of ${nounWord} was presented to local leaders.`,
          translation: `\u4E00\u4EFD\u95DC\u65BC${nounWord}\u7684\u5168\u9762\u8A55\u4F30\u5831\u544A\u5DF2\u5448\u905E\u7D66\u5728\u5730\u9818\u5C0E\u5718\u968A\u3002`
        },
        {
          sentence: `Community interest in ${nounWord} has grown considerably this year.`,
          translation: `\u4ECA\u5E74\u5927\u773E\u5C0D${nounWord}\u7684\u95DC\u6CE8\u5EA6\u6709\u4E86\u986F\u8457\u63D0\u5347\u3002`
        },
        {
          sentence: `Finding an innovative approach to ${nounWord} is vital for long-term progress.`,
          translation: `\u70BA${nounWord}\u958B\u5275\u5D84\u65B0\u8DEF\u5F91\u5C0D\u9577\u9060\u767C\u5C55\u81F3\u95DC\u91CD\u8981\u3002`
        },
        {
          sentence: `Our radio station frequently explores important topics related to ${nounWord}.`,
          translation: `\u672C\u5EE3\u64AD\u96FB\u53F0\u7D93\u5E38\u6DF1\u5165\u63A2\u8A0E\u8207${nounWord}\u76F8\u95DC\u7684\u7126\u9EDE\u8A71\u984C\u3002`
        }
      ];
    }
  }
  for (let offset = 0; offset < pool.length; offset++) {
    const candidate = pool[(index + offset) % pool.length];
    if (!usedSentences || !usedSentences.has(candidate.sentence)) {
      if (usedSentences) usedSentences.add(candidate.sentence);
      return candidate;
    }
  }
  const fallback = pool[index % pool.length] || {
    sentence: `Listeners sent in comments discussing the impact of ${displayWord}.`,
    translation: `\u807D\u773E\u7D1B\u7D1B\u4F86\u4FE1\u7559\u8A00\uFF0C\u63A2\u8A0E${displayWord}\u6240\u5E36\u4F86\u7684\u5EE3\u6CDB\u5F71\u97FF\u3002`
  };
  return fallback;
}

// server.ts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var geminiClient = null;
function getGeminiClient() {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn("Notice: Gemini API client initialization skipped:", e);
    }
  }
  return geminiClient;
}
var app = (0, import_express.default)();
var PORT = 3e3;
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});
app.use(import_express.default.json());
var translationCache = /* @__PURE__ */ new Map();
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), ms);
    promise.then((res) => {
      clearTimeout(timer);
      resolve(res);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
function translateWithGoogleGTX(englishText) {
  return new Promise((resolve) => {
    const clean = englishText.trim();
    if (!clean) {
      resolve("");
      return;
    }
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=" + encodeURIComponent(clean);
    const req = import_https.default.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (Array.isArray(json) && Array.isArray(json[0])) {
              const result = json[0].map((part) => Array.isArray(part) && typeof part[0] === "string" ? part[0] : "").join("");
              if (result && result.trim().length > 0) {
                resolve(result.trim());
                return;
              }
            }
          } catch (e) {
          }
          resolve("");
        });
      }
    );
    req.on("error", () => resolve(""));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve("");
    });
  });
}
function translateWithGoogleClients5(englishText) {
  return new Promise((resolve) => {
    const clean = englishText.trim();
    if (!clean) {
      resolve("");
      return;
    }
    const url = "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-TW&q=" + encodeURIComponent(clean);
    const req = import_https.default.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (Array.isArray(json)) {
              const result = json.flat(Infinity).filter((x) => typeof x === "string").join("");
              if (result && result.trim().length > 0) {
                resolve(result.trim());
                return;
              }
            } else if (typeof json === "string" && json.trim().length > 0) {
              resolve(json.trim());
              return;
            }
          } catch (e) {
          }
          resolve("");
        });
      }
    );
    req.on("error", () => resolve(""));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve("");
    });
  });
}
async function translateWithMyMemory(englishText) {
  return new Promise((resolve) => {
    const clean = englishText.trim();
    if (!clean) {
      resolve("");
      return;
    }
    const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(clean) + "&langpair=en|zh-TW";
    const req = import_https.default.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LiveBilingoRadio/1.0"
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const translated = parsed.responseData?.translatedText;
            if (translated && typeof translated === "string" && !translated.toLowerCase().includes("is invalid") && !translated.toLowerCase().includes("quota exceeded") && !translated.toUpperCase().includes("MYMEMORY WARNING") && !translated.toUpperCase().includes("YOU USED ALL AVAILABLE FREE TRANSLATIONS") && translated.length > 0) {
              resolve(translated);
              return;
            }
          } catch (e) {
          }
          resolve("");
        });
      }
    );
    req.on("error", () => resolve(""));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve("");
    });
  });
}
async function translateWithGeminiModel(englishText) {
  const ai = getGeminiClient();
  if (!ai) return "";
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are an expert English-to-Traditional Chinese radio broadcast interpreter. Translate the following live radio subtitle into natural, authentic, highly fluent Traditional Chinese (Taiwan/Hong Kong).
Rules:
1. Translate accurately in the context of live public radio news, traffic, talk shows, and idioms.
2. For traffic terms: "stop and go" -> "\u8D70\u8D70\u505C\u505C\uFF08\u8ECA\u591A\u58C5\u585E\uFF09", "the maze" -> "\u9EA5\u514B\u963F\u745F\u7ACB\u4EA4\u6A1E\u7D10\uFF08The Maze\uFF09", "shoulder" -> "\u8DEF\u80A9", "CHP" -> "\u52A0\u5DDE\u516C\u8DEF\u5DE1\u8B66\uFF08CHP\uFF09", "hit and run" -> "\u8087\u4E8B\u9003\u9038".
3. Return ONLY the Traditional Chinese translation, without explanation or commentary.

Text to translate:
"${englishText}"`
  });
  return response.text?.trim() || "";
}
async function translateWithGeminiOrFallback(text) {
  const cleanText = text.trim();
  if (!cleanText) return { text: "", source: "empty" };
  if (translationCache.has(cleanText)) {
    return { text: translationCache.get(cleanText), source: "cache" };
  }
  const exactMatch = matchExactPhrase(cleanText);
  if (exactMatch && exactMatch !== cleanText) {
    const postMatch = postprocessChineseTranslation(exactMatch, cleanText);
    translationCache.set(cleanText, postMatch);
    return { text: postMatch, source: "exact-broadcast-glossary" };
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiResult = await withTimeout(translateWithGeminiModel(cleanText), 1800);
      if (geminiResult && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(geminiResult)) {
        const refined = postprocessChineseTranslation(geminiResult, cleanText);
        translationCache.set(cleanText, refined);
        return { text: refined, source: "gemini-contextual" };
      }
    } catch (e) {
    }
  }
  const preprocessedEn = preprocessEnglishForTranslation(cleanText);
  try {
    const gtxTranslation = await withTimeout(translateWithGoogleGTX(preprocessedEn), 2500);
    if (gtxTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(gtxTranslation)) {
      const refined = postprocessChineseTranslation(gtxTranslation, cleanText);
      translationCache.set(cleanText, refined);
      return { text: refined, source: "google-gtx-live" };
    }
  } catch (e) {
  }
  try {
    const liveTranslation = await withTimeout(translateWithGoogleClients5(preprocessedEn), 2e3);
    if (liveTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(liveTranslation)) {
      const refined = postprocessChineseTranslation(liveTranslation, cleanText);
      translationCache.set(cleanText, refined);
      return { text: refined, source: "google-clients5-live" };
    }
  } catch (e) {
  }
  try {
    const myMemoryTranslation = await withTimeout(translateWithMyMemory(preprocessedEn), 2500);
    if (myMemoryTranslation && !/^[a-zA-Z0-9\s.,!?'"-]+$/.test(myMemoryTranslation)) {
      const refined = postprocessChineseTranslation(myMemoryTranslation, cleanText);
      translationCache.set(cleanText, refined);
      return { text: refined, source: "online-translation-fallback" };
    }
  } catch (e) {
  }
  const contextualFallback = mockTranslateToTraditionalChinese(cleanText);
  if (contextualFallback && contextualFallback !== cleanText) {
    const refined = postprocessChineseTranslation(contextualFallback, cleanText);
    translationCache.set(cleanText, refined);
    return { text: refined, source: "contextual-fallback" };
  }
  return { text: cleanText, source: "raw-english" };
}
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    translationEngine: "local-zero-quota",
    radioStreamUrl: "https://nhpr.streamguys1.com/nhpr",
    deepgramConfigured: true
  });
});
app.post("/api/translate", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Text is required for translation" });
      return;
    }
    const { text: translatedText, source } = await translateWithGeminiOrFallback(text);
    res.json({
      english: text,
      traditionalChinese: translatedText,
      source
    });
  } catch (error) {
    const fallbackTranslation = mockTranslateToTraditionalChinese(req.body.text || "");
    res.json({
      english: req.body.text || "",
      traditionalChinese: fallbackTranslation,
      source: "fallback-catch"
    });
  }
});
function mockTranslateToTraditionalChinese(englishText) {
  if (/transit|bart|muni|caltrain|fare/i.test(englishText)) {
    return "\u60A8\u6B63\u5728\u6536\u807D Live Bilingo \u96D9\u8A9E\u96FB\u53F0\u3002\u4ECA\u65E5\u7063\u5340\u982D\u689D\u65B0\u805E\uFF1A\u4EA4\u901A\u5C40\u5B98\u54E1\u6B63\u5F0F\u5BA3\u4F48\uFF0C\u5C07\u65BC\u4E0B\u500B\u6708\u8D77\u6574\u5408 BART\u3001Muni \u8207 Caltrain \u7684\u7968\u8B49\u7CFB\u7D71\uFF0C\u70BA\u8DE8\u5340\u901A\u52E4\u65CF\u63D0\u4F9B\u66F4\u52A0\u7121\u7E2B\u7684\u516C\u5171\u904B\u8F38\u9AD4\u9A57\u3002";
  }
  if (/weather|forecast|temperature|breezes/i.test(englishText)) {
    return "\u6C23\u8C61\u5C40\u9810\u5831\u6307\u51FA\uFF0C\u820A\u91D1\u5C71\u8207\u5967\u514B\u862D\u5730\u5340\u4ECA\u65E5\u6674\u6717\u7121\u96F2\uFF0C\u6CBF\u6D77\u4E00\u5E36\u5FAE\u98A8\u5F90\u5F90\u4E26\u5C07\u6301\u7E8C\u81F3\u508D\u665A\u3002\u5167\u9678\u5C71\u8C37\u6C23\u6EAB\u7D04\u7DAD\u6301\u5728\u83EF\u6C0F 68 \u5EA6\u5DE6\u53F3\uFF0C\u6CBF\u6D77\u5730\u5340\u65E9\u665A\u6709\u5C40\u90E8\u6668\u9727\u3002";
  }
  if (/climate|lawmakers|solar|fire/i.test(englishText)) {
    return "\u52A0\u5DDE\u5DDE\u8B70\u54E1\u5DF2\u6B63\u5F0F\u901A\u904E\u6578\u5341\u5104\u7F8E\u5143\u7684\u6C23\u5019\u97CC\u6027\u9810\u7B97\u6848\uFF0C\u65E8\u5728\u672A\u4F86\u4E94\u5E74\u5167\u64F4\u5EFA\u592A\u967D\u80FD\u96FB\u7DB2\u57FA\u790E\u8A2D\u65BD\uFF0C\u4E26\u5927\u5E45\u63D0\u5347\u5317\u52A0\u5DDE\u5404\u90E1\u7684\u5C71\u6797\u9632\u706B\u80FD\u529B\u3002";
  }
  if (/traffic|bridge|highway|caltrans/i.test(englishText)) {
    return "\u897F\u5411\u5F80\u820A\u91D1\u5C71\u65B9\u5411\u7684\u6D77\u7063\u5927\u6A4B\u5728\u4E0A\u5C64\u8ECA\u9053\u6668\u9593\u7DAD\u8B77\u7D50\u675F\u5F8C\uFF0C\u76EE\u524D\u8ECA\u6D41\u5341\u5206\u9806\u66A2\u3002\u52A0\u5DDE\u4EA4\u901A\u5C40\u63D0\u9192\u99D5\u99DB\u4EBA\u7279\u5225\u7559\u610F 101 \u865F\u516C\u8DEF\u591C\u9593\u65BD\u5DE5\u5C01\u9589\u8A0A\u606F\u3002";
  }
  if (/researchers|berkeley|marine|kelp/i.test(englishText)) {
    return "\u52A0\u5DDE\u5927\u5B78\u67CF\u514B\u840A\u5206\u6821\u7814\u7A76\u5718\u968A\u516C\u4F48\u4E86\u592A\u5E73\u6D0B\u6CBF\u5CB8\u6D77\u6D0B\u751F\u614B\u4FDD\u80B2\u7684\u7A81\u7834\u6027\u7814\u7A76\u3002\u7814\u7A76\u5F37\u8ABF\u793E\u5340\u9A45\u52D5\u7684\u68F2\u5730\u5FA9\u80B2\u6210\u529F\u5E36\u56DE\u4E86\u539F\u751F\u5DE8\u85FB\u68EE\u6797\u8207\u8C50\u5BCC\u7684\u6D77\u6D0B\u751F\u7269\u591A\u6A23\u6027\u3002";
  }
  if (/silicon valley|ai|summit|tech/i.test(englishText)) {
    return "\u77FD\u8C37\u79D1\u6280\u9818\u8896\u8207\u502B\u7406\u5C08\u5BB6\u4ECA\u65E5\u805A\u96C6\u65BC\u8056\u8377\u897F\u53C3\u8207\u5E74\u5EA6\u4EBA\u5DE5\u667A\u6167\u8CAC\u4EFB\u5CF0\u6703\u3002\u6838\u5FC3\u8A0E\u8AD6\u805A\u7126\u65BC\u70BA\u4E0B\u4E00\u4EE3\u751F\u6210\u5F0F AI \u7CFB\u7D71\u5EFA\u7ACB\u900F\u660E\u7684\u958B\u6E90\u67B6\u69CB\u8207\u5B89\u5168\u898F\u7BC4\u3002";
  }
  if (/bike|pedal|commute|gear|protective|support/i.test(englishText)) {
    return "\u95DC\u65BC\u63A8\u5EE3\u4E00\u7D1A\u96FB\u52A9\u81EA\u884C\u8ECA\u4EE5\u63D0\u4F9B\u5B89\u5168\u4F4E\u78B3\u901A\u52E4\u7684\u8B70\u984C\uFF0C\u5C08\u5BB6\u5F37\u8ABF\u901A\u52E4\u65CF\u61C9\u914D\u6234\u8DB3\u5920\u9632\u8B77\u88DD\u5099\u4EE5\u7DAD\u8B77\u884C\u8ECA\u5B89\u5168\u3002";
  }
  return "\u3010\u65B0\u805E\u5EE3\u64AD\u7CBE\u8B6F\u3011\u820A\u91D1\u5C71\u8207\u5168\u7F8E\u516C\u5171\u5EE3\u64AD\u96FB\u53F0\u65B0\u805E\u5373\u6642\u6458\u8981\u5831\u5C0E\u3002";
}
app.get("/api/deepgram-config", (req, res) => {
  res.json({
    wsUrl: "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&interim_results=true",
    authHeader: "Token 26c44e288a84756af4f80d41436af0bf7cc10715",
    defaultStreamUrl: "https://nhpr.streamguys1.com/nhpr",
    paragraphDurationSeconds: 10
  });
});
function resolveTargetStreamUrl(inputUrl) {
  if (!inputUrl) return "https://npr-ice.streamguys1.com/live.mp3";
  if (inputUrl.startsWith("http://") || inputUrl.startsWith("https://")) {
    return inputUrl;
  }
  if (inputUrl.includes("/api/radio-stream-proxy")) {
    try {
      const dummyUrl = new URL(inputUrl, "http://localhost:3000");
      const targetParam = dummyUrl.searchParams.get("url");
      if (targetParam && (targetParam.startsWith("http://") || targetParam.startsWith("https://"))) {
        return targetParam;
      }
    } catch (e) {
    }
  }
  return "https://npr-ice.streamguys1.com/live.mp3";
}
function proxyRadioAudio(targetUrl, res, redirectDepth = 0) {
  if (redirectDepth > 8) {
    console.error("Too many redirects for radio stream proxying");
    if (!res.headersSent) res.status(502).end();
    return;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    if (!res.headersSent) res.status(400).json({ error: "Invalid stream URL" });
    return;
  }
  const requester = parsedUrl.protocol === "http:" ? import_http.default : import_https.default;
  const requestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === "http:" ? 80 : 443),
    path: parsedUrl.pathname + parsedUrl.search,
    method: "GET",
    rejectUnauthorized: false,
    timeout: 1e4,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RadioStreamProxy/1.0",
      "Accept": "*/*",
      "Icy-MetaData": "0",
      "Connection": "keep-alive"
    }
  };
  const clientReq = requester.get(requestOptions, (remoteRes) => {
    if (clientReq.socket) {
      clientReq.socket.setKeepAlive(true, 5e3);
      clientReq.socket.setNoDelay(true);
    }
    remoteRes.on("error", (err) => {
      console.warn("[Radio Proxy] Upstream response error:", err?.message || err);
    });
    if ([301, 302, 303, 307, 308].includes(remoteRes.statusCode || 0) && remoteRes.headers.location) {
      const redirectUrl = new URL(remoteRes.headers.location, targetUrl).toString();
      return proxyRadioAudio(redirectUrl, res, redirectDepth + 1);
    }
    if ((remoteRes.statusCode || 0) >= 400) {
      console.warn(`[Radio Proxy] Stream ${targetUrl} returned status ${remoteRes.statusCode}.`);
      if (!res.headersSent) res.status(remoteRes.statusCode || 500).end();
      return;
    }
    if (!res.headersSent) {
      const contentType = remoteRes.headers["content-type"] || "audio/mpeg";
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Connection", "keep-alive");
    }
    remoteRes.pipe(res, { end: false });
    remoteRes.on("end", () => {
      console.warn("[Radio Proxy] Upstream radio stream ended. Reconnecting...");
      if (!res.writableEnded && !res.destroyed) {
        setTimeout(() => {
          if (!res.writableEnded && !res.destroyed) {
            proxyRadioAudio(targetUrl, res, redirectDepth + 1);
          }
        }, 800);
      }
    });
    remoteRes.on("close", () => {
      if (!res.writableEnded && !res.destroyed) {
        setTimeout(() => {
          if (!res.writableEnded && !res.destroyed) {
            proxyRadioAudio(targetUrl, res, redirectDepth + 1);
          }
        }, 800);
      }
    });
    res.on("close", () => {
      remoteRes.on("error", () => {
      });
      clientReq.on("error", () => {
      });
      try {
        remoteRes.destroy();
      } catch (e) {
      }
      try {
        clientReq.destroy();
      } catch (e) {
      }
    });
    res.on("error", (err) => {
      remoteRes.on("error", () => {
      });
      clientReq.on("error", () => {
      });
      try {
        remoteRes.destroy();
      } catch (e) {
      }
      try {
        clientReq.destroy();
      } catch (e) {
      }
    });
  });
  clientReq.setTimeout(12e3, () => {
    console.warn("[Radio Proxy] Upstream request timeout. Reconnecting...");
    try {
      clientReq.destroy();
    } catch (e) {
    }
    if (!res.writableEnded && !res.destroyed) {
      setTimeout(() => {
        if (!res.writableEnded && !res.destroyed) {
          proxyRadioAudio(targetUrl, res, redirectDepth + 1);
        }
      }, 500);
    }
  });
  clientReq.on("error", (err) => {
    console.warn("[Radio Proxy] Request error:", err?.message || err);
    if (!res.writableEnded && !res.destroyed) {
      if (!res.headersSent) {
        res.status(502).json({ error: "Radio stream unreachable" });
      }
    }
  });
}
app.get("/api/radio-stream-proxy", (req, res) => {
  const rawUrl = req.query.url || "";
  const targetUrl = resolveTargetStreamUrl(rawUrl);
  recordListenerActivity("Radio stream proxy audio requested", targetUrl);
  if (targetUrl !== currentRadioStreamUrl) {
    console.log(`[Radio Proxy Sync] User started playing station stream: ${targetUrl}. Synchronizing backend STT...`);
    startBackendDeepgramStreaming(targetUrl);
  }
  proxyRadioAudio(targetUrl, res);
});
app.get("/api/radio-stream-delayed", (req, res) => {
  const rawUrl = req.query.url || "";
  const targetUrl = resolveTargetStreamUrl(rawUrl);
  recordListenerActivity("Radio stream audio requested", targetUrl);
  if (!isStreamingActive || targetUrl !== currentRadioStreamUrl) {
    console.log(`[Radio Stream] Starting backend STT & audio pipeline for ${targetUrl}...`);
    startBackendStreaming(targetUrl);
  }
  proxyRadioAudio(targetUrl, res);
});
app.post("/api/notify-station-playing", (req, res) => {
  const { url, name, forceRestart } = req.body || {};
  if (url && typeof url === "string") {
    const targetUrl = resolveTargetStreamUrl(url);
    const stationDisplayName = name || "\u7F8E\u897F\u516C\u5171\u82F1\u8A9E\u65B0\u805E\u5EE3\u64AD";
    console.log(`[Station Notify] Client playing station stream: ${stationDisplayName} (${targetUrl}) [forceRestart=${!!forceRestart}]. Synchronizing backend STT...`);
    recordListenerActivity(`Station Notify: ${stationDisplayName}`, targetUrl);
    if (forceRestart || !isStreamingActive || currentRadioStreamUrl !== targetUrl || Date.now() - lastAudioDataTime > 15e3) {
      startBackendDeepgramStreaming(targetUrl);
    }
    pendingTranscriptBuffer = "";
    bufferStartTime = 0;
    lastTranscriptTime = Date.now();
  }
  res.json({ status: "ok", currentRadioStreamUrl, aligned: true });
});
app.post("/api/repair-stations", async (req, res) => {
  const { stations } = req.body || {};
  if (!Array.isArray(stations)) {
    return res.status(400).json({ error: "Stations array required" });
  }
  const KNOWN_BACKUPS = {
    "us-west-public-news": [
      "https://nhpr.streamguys1.com/nhpr",
      "https://npr-ice.streamguys1.com/live.mp3"
    ],
    "us-east-public-news": [
      "https://nhpr.streamguys1.com/nhpr",
      "https://npr-ice.streamguys1.com/live.mp3"
    ],
    "us-finance-news-talk": [
      "https://stream.revma.ihrhls.com/zc4732",
      "https://nhpr.streamguys1.com/nhpr"
    ],
    "us-national-public-talk": [
      "https://nhpr.streamguys1.com/nhpr",
      "https://npr-ice.streamguys1.com/live.mp3"
    ],
    "uk-global-english-news": [
      "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service",
      "https://media-ice.musicradio.com/LBCUK"
    ]
  };
  const testStreamUrl = (rawUrl) => {
    return new Promise((resolve) => {
      try {
        const target = resolveTargetStreamUrl(rawUrl);
        const parsedUrl = new URL(target);
        const requester = parsedUrl.protocol === "http:" ? import_http.default : import_https.default;
        const req2 = requester.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === "http:" ? 80 : 443),
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 RadioStreamProxy/1.0",
              "Range": "bytes=0-10"
            },
            rejectUnauthorized: false,
            timeout: 3e3
          },
          (res2) => {
            const statusCode = res2.statusCode || 500;
            const isOk = statusCode >= 200 && statusCode < 400;
            res2.destroy();
            resolve(isOk);
          }
        );
        req2.on("error", () => resolve(false));
        req2.on("timeout", () => {
          req2.destroy();
          resolve(false);
        });
        req2.end();
      } catch (e) {
        resolve(false);
      }
    });
  };
  let repairedCount = 0;
  const repairedStations = [];
  const logs = [];
  for (const s of stations) {
    const rawUrl = s.streamUrl || "";
    const isOk = await testStreamUrl(rawUrl);
    if (isOk) {
      repairedStations.push({ ...s, lastChecked: Date.now(), isHealthy: true });
      logs.push({ name: s.name, status: "\u9023\u7DDA\u6B63\u5E38", action: "none" });
    } else {
      console.log(`[Repair Service] Station "${s.name}" stream (${rawUrl}) failed. Searching for alternative stream mirror...`);
      let fixedUrl = null;
      const backups = KNOWN_BACKUPS[s.id] || [];
      for (const backup of backups) {
        const candidate = "/api/radio-stream-proxy?url=" + encodeURIComponent(backup);
        if (await testStreamUrl(candidate)) {
          fixedUrl = candidate;
          break;
        }
      }
      if (!fixedUrl) {
        fixedUrl = "/api/radio-stream-proxy";
      }
      repairedCount++;
      repairedStations.push({
        ...s,
        streamUrl: fixedUrl,
        lastChecked: Date.now(),
        isHealthy: true
      });
      logs.push({ name: s.name, status: "\u5DF2\u4FEE\u5FA9\u7DB2\u5740", action: "updated", newUrl: fixedUrl });
    }
  }
  return res.json({
    success: true,
    repairedCount,
    stations: repairedStations,
    logs,
    message: repairedCount > 0 ? `\u5DF2\u6210\u529F\u5B8C\u6210\u81EA\u52D5\u6AA2\u6E2C\uFF0C\u4E26\u81EA\u52D5\u4FEE\u5FA9 ${repairedCount} \u500B\u5EE3\u64AD\u7DB2\u5740\uFF01` : "\u6240\u6709\u5EE3\u64AD\u983B\u9053\u9023\u7DDA\u7686\u5B8C\u5168\u6B63\u5E38\uFF01"
  });
});
app.get("/api/dictionary", async (req, res) => {
  const word = String(req.query.word || "").trim().toLowerCase().replace(/[^a-z'-]/g, "");
  if (!word) {
    return res.status(400).json({ error: "Word query parameter is required" });
  }
  const quickEntry = lookupQuickWord(word);
  if (quickEntry) {
    return res.json({
      word: quickEntry.word,
      phonetic: quickEntry.phonetic,
      audioUrl: "",
      chineseTranslation: quickEntry.zh,
      meanings: [
        {
          partOfSpeech: quickEntry.pos || "\u8A5E\u5F59",
          definition: quickEntry.def || `English vocabulary '${word}' from live radio.`,
          example: quickEntry.example || "",
          exampleTranslation: quickEntry.exampleZh || "",
          chineseTranslation: quickEntry.zh
        }
      ]
    });
  }
  const candidates = [word];
  if (word.endsWith("s") && word.length > 3) candidates.push(word.slice(0, -1));
  if (word.endsWith("es") && word.length > 4) candidates.push(word.slice(0, -2));
  if (word.endsWith("ing") && word.length > 5) {
    candidates.push(word.slice(0, -3));
    candidates.push(word.slice(0, -3) + "e");
  }
  if (word.endsWith("ed") && word.length > 4) {
    candidates.push(word.slice(0, -2));
    candidates.push(word.slice(0, -1));
  }
  const meanings = [];
  let phonetic = `/${word}/`;
  let audioUrl = "";
  for (const cand of candidates.slice(0, 3)) {
    try {
      const dmUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(cand)}&md=dp&max=4`;
      const dmRes = await fetch(dmUrl, { signal: AbortSignal.timeout(1800) });
      if (dmRes.ok) {
        const dmList = await dmRes.json();
        if (Array.isArray(dmList)) {
          for (const item of dmList) {
            if (item.defs && item.defs.length > 0) {
              const posMap = {
                n: "\u540D\u8A5E (Noun)",
                v: "\u52D5\u8A5E (Verb)",
                adj: "\u5F62\u5BB9\u8A5E (Adj)",
                adv: "\u526F\u8A5E (Adv)",
                u: "\u8A5E\u5F59"
              };
              for (const dStr of item.defs.slice(0, 4)) {
                const parts = String(dStr).split("	");
                const posRaw = (parts[0] || "n").trim();
                const pos = posMap[posRaw] || `${posRaw}.`;
                let def = (parts[1] || dStr).replace(/^\([^)]+\)\s*/, "").trim();
                if (def) {
                  def = def.charAt(0).toUpperCase() + def.slice(1);
                  meanings.push({
                    partOfSpeech: pos,
                    definition: def
                  });
                }
              }
              if (meanings.length > 0) break;
            }
          }
        }
      }
    } catch (e) {
    }
    if (meanings.length > 0) break;
  }
  if (meanings.length === 0 || !audioUrl) {
    for (const cand of candidates.slice(0, 2)) {
      try {
        const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cand)}`;
        const dictRes = await fetch(dictUrl, { signal: AbortSignal.timeout(1500) });
        if (dictRes.ok) {
          const jsonArr = await dictRes.json();
          if (Array.isArray(jsonArr) && jsonArr.length > 0) {
            const resultData = jsonArr[0];
            if (resultData?.phonetic) phonetic = resultData.phonetic;
            const foundAudio = resultData?.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio;
            if (foundAudio) audioUrl = foundAudio;
            if (meanings.length === 0 && Array.isArray(resultData.meanings)) {
              resultData.meanings.slice(0, 3).forEach((m) => {
                const firstDef = m.definitions?.[0];
                if (firstDef?.definition) {
                  meanings.push({
                    partOfSpeech: m.partOfSpeech || "n.",
                    definition: firstDef.definition,
                    example: firstDef.example || ""
                  });
                }
              });
            }
          }
        }
      } catch (e) {
      }
      if (meanings.length > 0) break;
    }
  }
  const usedSentences = /* @__PURE__ */ new Set();
  meanings.forEach((m, idx) => {
    if (!m.example) {
      const generated = generateContextualExample(word, m.partOfSpeech, idx, m.definition, usedSentences);
      m.example = generated.sentence;
      m.exampleTranslation = generated.translation;
    }
  });
  let chineseTranslation = "";
  try {
    const transObj = await translateWithGeminiOrFallback(word);
    chineseTranslation = transObj.text || "";
  } catch (e) {
  }
  return res.json({
    word,
    phonetic,
    audioUrl,
    chineseTranslation,
    meanings
  });
});
app.get("/api/tts", async (req, res) => {
  const text = (req.query.text || "").trim();
  if (!text) {
    return res.status(400).send("Missing text parameter");
  }
  const chunkText = text.slice(0, 300);
  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunkText.slice(0, 200))}&tl=en&client=tw-ob`;
  const tryStreamAudio = (targetUrl) => {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(targetUrl);
        const reqClient = parsed.protocol === "http:" ? import_http.default : import_https.default;
        const gReq = reqClient.get(
          targetUrl,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept": "*/*",
              "Referer": "https://translate.google.com/"
            },
            timeout: 5e3
          },
          (upstreamRes) => {
            if ((upstreamRes.statusCode || 500) < 400) {
              res.setHeader("Content-Type", upstreamRes.headers["content-type"] || "audio/mpeg");
              res.setHeader("Cache-Control", "public, max-age=86400");
              res.setHeader("Access-Control-Allow-Origin", "*");
              upstreamRes.pipe(res);
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );
        gReq.on("error", () => resolve(false));
        gReq.on("timeout", () => {
          gReq.destroy();
          resolve(false);
        });
      } catch (e) {
        resolve(false);
      }
    });
  };
  const googleOk = await tryStreamAudio(googleTtsUrl);
  if (googleOk) return;
  const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(chunkText)}&type=2`;
  const youdaoOk = await tryStreamAudio(youdaoUrl);
  if (youdaoOk) return;
  if (!res.headersSent) {
    res.status(500).send("TTS unavailable");
  }
});
var APP_VERSION = "2.2.3";
var SERVER_BOOT_TIME = Date.now();
app.get("/api/version", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  let currentBuildTime = SERVER_BOOT_TIME;
  let commitHash = "main";
  let dynamicVersion = APP_VERSION;
  try {
    const versionFile = import_path.default.resolve("dist/build-version.json");
    if (import_fs.default.existsSync(versionFile)) {
      const parsed = JSON.parse(import_fs.default.readFileSync(versionFile, "utf-8"));
      if (parsed.version) dynamicVersion = parsed.version;
      if (parsed.buildTime) currentBuildTime = parsed.buildTime;
      if (parsed.commit) commitHash = parsed.commit;
    }
  } catch (e) {
  }
  res.json({
    version: dynamicVersion,
    commit: commitHash,
    buildTime: currentBuildTime,
    bootTime: SERVER_BOOT_TIME,
    timestamp: Date.now()
  });
});
var server = import_http.default.createServer(app);
app.get("/api/live-subtitles", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const since = Number(req.query.since || 0);
  recordListenerActivity("REST polling request");
  const newItems = since > 0 ? recentSubtitlesHistory.filter((item) => (item.createdAt || 0) > since) : recentSubtitlesHistory.slice(-20);
  res.json({
    subtitles: newItems,
    isStreamingActive,
    currentRadioStreamUrl,
    activeListeners: sseClients.size,
    serverTime: Date.now()
  });
});
var sseClients = /* @__PURE__ */ new Set();
var wsClients = /* @__PURE__ */ new Set();
var subtitleWss = new import_ws.WebSocketServer({ noServer: true });
var recentSubtitlesHistory = [];
subtitleWss.on("connection", (ws) => {
  wsClients.add(ws);
  console.log(`[WebSocket Listener Joined] Online WS listeners: ${wsClients.size}, SSE: ${sseClients.size}`);
  recordListenerActivity("WebSocket client connected");
  try {
    ws.send(
      JSON.stringify({
        type: "connected",
        channel: "centralized-subtitles",
        message: "Connected to Live Centralized Subtitle WebSocket Hub",
        activeListeners: wsClients.size + sseClients.size
      })
    );
    recentSubtitlesHistory.forEach((item) => {
      ws.send(JSON.stringify(item));
    });
  } catch (e) {
  }
  ws.on("close", () => {
    wsClients.delete(ws);
    console.log(`[WebSocket Listener Left] Remaining WS listeners: ${wsClients.size}`);
    if (wsClients.size === 0 && sseClients.size === 0) {
      lastActiveListenerTime = Date.now();
    }
  });
  ws.on("error", () => {
    wsClients.delete(ws);
  });
});
server.on("upgrade", (request, socket, head) => {
  try {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    if (pathname === "/api/subtitles-ws" || pathname === "/ws/subtitles" || pathname === "/api/live-subtitles-ws") {
      subtitleWss.handleUpgrade(request, socket, head, (ws) => {
        subtitleWss.emit("connection", ws, request);
      });
    }
  } catch (err) {
    socket.destroy();
  }
});
var GROQ_TOKEN = process.env.GROQ_API_KEY || process.env.GROQ_TOKEN || "";
var DEEPGRAM_TOKEN = process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_TOKEN || "";
var deepgramWs = null;
var radioReq = null;
var isStreamingActive = false;
var currentRadioStreamUrl = "https://nhpr.streamguys1.com/nhpr";
var currentStreamingSessionId = 0;
var watchdogInterval = null;
var deepgramKeepAliveTimer = null;
var lastAudioDataTime = Date.now();
var lastTranscriptTime = Date.now();
var groqAudioAccumulator = Buffer.alloc(0);
var isGroqTranscribing = false;
var groqLastContext = "";
var groqConsecutiveErrors = 0;
var lastGroqRequestTime = 0;
var groqRateLimitedUntil = 0;
var MIN_GROQ_INTERVAL_MS = 3800;
var GROQ_BUFFER_THRESHOLD = 64e3;
var sttUsageTracker = {
  groqRequestsHistory: [],
  groqCurrentUtcDay: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
  groqTodayRequests: 0,
  groqTotalRequestsEver: 0,
  groqLastHeaders: {},
  deepgramRequestsHistory: [],
  deepgramCurrentUtcDay: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
  deepgramTodayRequests: 0,
  deepgramTotalRequestsEver: 0
};
function getUtcDayResetInfo() {
  const now = /* @__PURE__ */ new Date();
  const utcDate = now.toISOString().slice(0, 10);
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  const msRemaining = Math.max(0, nextReset.getTime() - now.getTime());
  const hours = Math.floor(msRemaining / (1e3 * 60 * 60));
  const minutes = Math.floor(msRemaining % (1e3 * 60 * 60) / (1e3 * 60));
  const seconds = Math.floor(msRemaining % (1e3 * 60) / 1e3);
  return {
    utcDate,
    utcTime: now.toISOString().slice(11, 19) + " UTC",
    nextResetTimeUtc: nextReset.toISOString(),
    msRemaining,
    formattedRemaining: `${hours}h ${minutes}m ${seconds}s`,
    hoursRemaining: hours,
    minutesRemaining: minutes
  };
}
function recordGroqRequest(headers) {
  const now = Date.now();
  const currentUtcDay = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (sttUsageTracker.groqCurrentUtcDay !== currentUtcDay) {
    sttUsageTracker.groqCurrentUtcDay = currentUtcDay;
    sttUsageTracker.groqTodayRequests = 0;
  }
  sttUsageTracker.groqTodayRequests++;
  sttUsageTracker.groqTotalRequestsEver++;
  sttUsageTracker.groqRequestsHistory.push(now);
  const cutoff = now - 24 * 60 * 60 * 1e3;
  sttUsageTracker.groqRequestsHistory = sttUsageTracker.groqRequestsHistory.filter((t) => t >= cutoff);
  if (headers) {
    const limitReq = headers.get("x-ratelimit-limit-requests");
    const remReq = headers.get("x-ratelimit-remaining-requests");
    const resetReq = headers.get("x-ratelimit-reset-requests");
    const limitTok = headers.get("x-ratelimit-limit-tokens");
    const remTok = headers.get("x-ratelimit-remaining-tokens");
    const resetTok = headers.get("x-ratelimit-reset-tokens");
    sttUsageTracker.groqLastHeaders = {
      limitRequests: limitReq || sttUsageTracker.groqLastHeaders.limitRequests,
      remainingRequests: remReq || sttUsageTracker.groqLastHeaders.remainingRequests,
      resetRequests: resetReq || sttUsageTracker.groqLastHeaders.resetRequests,
      limitTokens: limitTok || sttUsageTracker.groqLastHeaders.limitTokens,
      remainingTokens: remTok || sttUsageTracker.groqLastHeaders.remainingTokens,
      resetTokens: resetTok || sttUsageTracker.groqLastHeaders.resetTokens,
      lastUpdated: now
    };
  }
}
function recordDeepgramRequest() {
  const now = Date.now();
  const currentUtcDay = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (sttUsageTracker.deepgramCurrentUtcDay !== currentUtcDay) {
    sttUsageTracker.deepgramCurrentUtcDay = currentUtcDay;
    sttUsageTracker.deepgramTodayRequests = 0;
  }
  sttUsageTracker.deepgramTodayRequests++;
  sttUsageTracker.deepgramTotalRequestsEver++;
  sttUsageTracker.deepgramRequestsHistory.push(now);
  const cutoff = now - 24 * 60 * 60 * 1e3;
  sttUsageTracker.deepgramRequestsHistory = sttUsageTracker.deepgramRequestsHistory.filter((t) => t >= cutoff);
}
function convertToWav(inputBuffer) {
  return new Promise((resolve, reject) => {
    const ff = (0, import_child_process.spawn)("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-f",
      "wav",
      "pipe:1"
    ]);
    const outChunks = [];
    ff.stdout.on("data", (c) => outChunks.push(c));
    ff.on("close", (code) => {
      if (code === 0 && outChunks.length > 0) resolve(Buffer.concat(outChunks));
      else reject(new Error("ffmpeg audio conversion failed with code " + code));
    });
    ff.on("error", reject);
    ff.stdin.on("error", () => {
    });
    ff.stdin.end(inputBuffer);
  });
}
async function transcribeWithGroq(wavBuffer, prompt = "", preferredModel = "whisper-large-v3-turbo") {
  if (!wavBuffer || wavBuffer.length < 2e3) {
    return { text: "", segments: [] };
  }
  const modelsToTry = [preferredModel, preferredModel === "whisper-large-v3-turbo" ? "whisper-large-v3" : "whisper-large-v3-turbo"];
  let lastError = null;
  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let timeoutId = null;
      try {
        const formData = new FormData();
        const blob = new Blob([wavBuffer], { type: "audio/wav" });
        formData.append("file", blob, "stream_chunk.wav");
        formData.append("model", model);
        formData.append("response_format", "verbose_json");
        formData.append("language", "en");
        formData.append("temperature", "0");
        if (prompt) {
          formData.append("prompt", prompt.slice(-100));
        }
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 28e3);
        const currentToken = process.env.GROQ_API_KEY || process.env.GROQ_TOKEN || GROQ_TOKEN;
        if (!currentToken) {
          throw new Error("Groq API Key is not configured");
        }
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`
          },
          body: formData,
          signal: controller.signal
        });
        recordGroqRequest(res.headers);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (res.status === 429) {
          const errText = await res.text();
          const retryHeader = res.headers.get("retry-after");
          let retrySec = retryHeader ? parseFloat(retryHeader) : 3.5;
          const match = errText.match(/try again in ([\d\.]+)s/i);
          if (match && match[1]) {
            retrySec = Math.max(retrySec, parseFloat(match[1]));
          }
          const backoffMs = Math.ceil(retrySec * 1e3) + 1e3;
          groqRateLimitedUntil = Date.now() + backoffMs;
          console.warn(`[Groq Rate Limit \u23F3] ${model} hit 429. Backing off for ${Math.ceil(backoffMs / 1e3)}s...`);
          lastError = new Error(`Rate limit reached for ${model}: ${errText}`);
          break;
        }
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Groq Whisper API error ${res.status}: ${errText}`);
        }
        const data = await res.json();
        const rawSegments = Array.isArray(data.segments) ? data.segments : [];
        const segments = rawSegments.map((s) => ({
          id: Number(s.id) || 0,
          start: typeof s.start === "number" ? s.start : 0,
          end: typeof s.end === "number" ? s.end : 0,
          text: (s.text || "").trim()
        })).filter((s) => s.text.length > 0);
        return {
          text: (data.text || "").trim(),
          segments,
          duration: typeof data.duration === "number" ? data.duration : void 0
        };
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = err;
        const errMsg = err?.message || String(err);
        const isNetworkErr = err?.name === "AbortError" || errMsg.includes("fetch failed") || err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT";
        if (isNetworkErr && attempt === 0) {
          console.warn(`[Groq STT] Network retry on ${model} (attempt 1): ${errMsg}`);
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        console.warn(`[Groq STT] Model ${model} encountered error: ${errMsg}${err?.cause ? ` (cause: ${err.cause.message || err.cause})` : ""}`);
        break;
      }
    }
  }
  throw lastError || new Error("All Groq transcription models failed");
}
var lastActiveListenerTime = 0;
var IDLE_TIMEOUT_MS = 25e3;
var backgroundSleepMode = false;
var backgroundEnteredAt = null;
var backgroundSleepTimer = null;
var BACKGROUND_AUTO_SLEEP_MS = 5 * 60 * 1e3;
function recordListenerActivity(reason, targetStreamUrl) {
  lastActiveListenerTime = Date.now();
  const streamUrl = targetStreamUrl ? resolveTargetStreamUrl(targetStreamUrl) : currentRadioStreamUrl;
  if (backgroundSleepMode && reason !== "Foreground Wakeup" && reason !== "Foreground Check") {
    return;
  }
  if (!isStreamingActive && (GROQ_TOKEN || DEEPGRAM_TOKEN)) {
    const engineName = GROQ_TOKEN ? "Groq Whisper Large V3 Turbo" : "Deepgram Nova-2";
    console.log(`[STT Wakeup \u26A1] Active listener detected (${reason}). Starting ${engineName} stream for ${streamUrl}...`);
    startBackendStreaming(streamUrl);
  }
}
function checkIdleSleepStatus() {
  if (backgroundEnteredAt && !backgroundSleepMode && Date.now() - backgroundEnteredAt >= BACKGROUND_AUTO_SLEEP_MS) {
    console.log(`[Background Saver \u{1F319}] Authoritative 5 minutes in background reached (${Math.round((Date.now() - backgroundEnteredAt) / 1e3)}s). Stopping Groq STT audio slicing ($0/hr, 0 RPM). Radio continues playing.`);
    backgroundSleepMode = true;
    stopBackendStreaming();
  }
  const totalListeners = sseClients.size + wsClients.size;
  const timeSinceLastActivity = Date.now() - lastActiveListenerTime;
  if (totalListeners === 0 && (lastActiveListenerTime === 0 || timeSinceLastActivity > IDLE_TIMEOUT_MS)) {
    if (isStreamingActive) {
      console.log(`[Centralized Idle Sleep \u{1F6D1}] 0 active listeners for ${Math.round(timeSinceLastActivity / 1e3)}s. Pausing centralized STT stream to keep rate at 0 RPM ($0/hr)...`);
      stopBackendStreaming();
    }
  }
}
app.get("/api/stt-status", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const inRateLimitCooldown = Date.now() < groqRateLimitedUntil;
  const activeEngine = GROQ_TOKEN && !inRateLimitCooldown ? "Groq Whisper Large V3 Turbo" : DEEPGRAM_TOKEN ? "Deepgram Nova-2" : "Groq Whisper Large V3 Turbo";
  const totalListeners = sseClients.size + wsClients.size;
  const resetInfo = getUtcDayResetInfo();
  const oneMinuteAgo = Date.now() - 60 * 1e3;
  const groqRpm = sttUsageTracker.groqRequestsHistory.filter((t) => t >= oneMinuteAgo).length;
  const deepgramRpm = sttUsageTracker.deepgramRequestsHistory.filter((t) => t >= oneMinuteAgo).length;
  const groqRpmLimit = sttUsageTracker.groqLastHeaders.limitRequests ? parseInt(sttUsageTracker.groqLastHeaders.limitRequests, 10) : 30;
  const groqRpdLimit = 14400;
  res.json({
    status: "ok",
    architecture: "Centralized Real-Time STT (Decoupled Time Aligner 2.5s~3.5s)",
    operatingMode: "Real-Time Speech-to-Text & Translation Stream",
    estimatedCostPerHour: "$0.04 (NT$1.2)",
    requestRateRPM: backgroundSleepMode ? "0 RPM ($0/hr background sleep)" : `${groqRpm} RPM`,
    isStreamingActive: backgroundSleepMode ? false : isStreamingActive,
    isBackgroundSleeping: backgroundSleepMode,
    activeEngine,
    groqConfigured: Boolean(GROQ_TOKEN),
    groqRateLimited: inRateLimitCooldown,
    groqCooldownSeconds: Math.max(0, Math.ceil((groqRateLimitedUntil - Date.now()) / 1e3)),
    deepgramConfigured: Boolean(DEEPGRAM_TOKEN),
    deepgramActive: Boolean(deepgramWs && deepgramWs.readyState === import_ws.default.OPEN),
    activeListeners: totalListeners,
    sseListeners: sseClients.size,
    wsListeners: wsClients.size,
    secondsSinceLastActivity: lastActiveListenerTime > 0 ? Math.round((Date.now() - lastActiveListenerTime) / 1e3) : null,
    currentRadioStreamUrl,
    onDemandEnabled: true,
    // STT API Usage & Quota Telemetry (Strictly aligned with Groq UTC Daily Reset)
    sttUsage: {
      groq: {
        configured: Boolean(GROQ_TOKEN),
        rpm: groqRpm,
        rpmLimit: groqRpmLimit,
        requestsTodayUtc: sttUsageTracker.groqTodayRequests,
        dailyLimit: groqRpdLimit,
        totalRequestsEver: sttUsageTracker.groqTotalRequestsEver,
        rateLimited: inRateLimitCooldown,
        cooldownSeconds: Math.max(0, Math.ceil((groqRateLimitedUntil - Date.now()) / 1e3)),
        lastHeaders: sttUsageTracker.groqLastHeaders
      },
      deepgram: {
        configured: Boolean(DEEPGRAM_TOKEN),
        active: Boolean(deepgramWs && deepgramWs.readyState === import_ws.default.OPEN),
        rpm: deepgramRpm,
        requestsTodayUtc: sttUsageTracker.deepgramTodayRequests,
        totalRequestsEver: sttUsageTracker.deepgramTotalRequestsEver
      },
      utcResetInfo: resetInfo
    }
  });
});
app.get("/api/live-subtitles-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  sseClients.add(res);
  console.log(`[SSE Listener Joined] Online SSE listeners: ${sseClients.size}, Total listeners: ${sseClients.size + wsClients.size}`);
  recordListenerActivity("SSE client connected");
  res.write(`data: ${JSON.stringify({ type: "connected", channel: "centralized-subtitles", message: "Connected to Centralized Subtitle Stream", activeListeners: sseClients.size + wsClients.size })}

`);
  recentSubtitlesHistory.forEach((item) => {
    res.write(`data: ${JSON.stringify(item)}

`);
  });
  const keepAliveInterval = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 12e3);
  req.on("close", () => {
    clearInterval(keepAliveInterval);
    sseClients.delete(res);
    console.log(`[SSE Listener Left] Remaining SSE listeners: ${sseClients.size}`);
    if (sseClients.size === 0 && wsClients.size === 0) {
      lastActiveListenerTime = Date.now();
    }
  });
});
function broadcastSubtitle(item) {
  recentSubtitlesHistory.push(item);
  const tenMinutesAgo = Date.now() - 10 * 60 * 1e3;
  while (recentSubtitlesHistory.length > 0 && (recentSubtitlesHistory[0].createdAt && recentSubtitlesHistory[0].createdAt < tenMinutesAgo || recentSubtitlesHistory.length > 100)) {
    recentSubtitlesHistory.shift();
  }
  const sseData = `data: ${JSON.stringify(item)}

`;
  sseClients.forEach((client) => {
    try {
      client.write(sseData);
      if (typeof client.flush === "function") {
        client.flush();
      }
    } catch (e) {
    }
  });
  const wsData = JSON.stringify(item);
  wsClients.forEach((ws) => {
    try {
      if (ws.readyState === import_ws.default.OPEN) {
        ws.send(wsData);
      }
    } catch (e) {
    }
  });
}
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1e3;
  while (recentSubtitlesHistory.length > 0 && recentSubtitlesHistory[0].createdAt && recentSubtitlesHistory[0].createdAt < tenMinutesAgo) {
    recentSubtitlesHistory.shift();
  }
  if (translationCache.size > 50) {
    translationCache.clear();
  }
  if (Date.now() - lastAudioDataTime > 6e4) {
    pendingTranscriptBuffer = "";
  }
  if (global.gc) {
    try {
      global.gc();
    } catch (e) {
    }
  }
  console.log("[System Memory GC] Cleaned expired subtitle buffers and translation cache");
}, 15 * 60 * 1e3);
app.post("/api/clear-subtitles-history", (req, res) => {
  recentSubtitlesHistory.length = 0;
  res.json({ status: "ok", message: "Subtitles history cleared" });
});
var pendingTranscriptBuffer = "";
var bufferStartTime = 0;
var paragraphFlushTimer = null;
var lastFlushedText = "";
var recentEmittedServerSentences = [];
function removeDuplicateWords(str) {
  if (!str) return "";
  let cleaned = str.trim();
  cleaned = cleaned.replace(/\bscienceofreading\b/gi, "science of reading").replace(/\barereshaping\b/gi, "are reshaping").replace(/\bhowkidslearn\b/gi, "how kids learn").replace(/\bkidslearn\b/gi, "kids learn").replace(/\blearnmore\b/gi, "learn more").replace(/\bstanford\.edu\b/gi, "stanford.edu").replace(/([a-z])([A-Z])/g, "$1 $2");
  cleaned = cleaned.replace(/\b(\w+)(?:[\s,]+\1\b)+/gi, "$1");
  for (let phraseLen = 6; phraseLen >= 2; phraseLen--) {
    const pattern = new RegExp(`(\\b(?:\\w+\\s+){${phraseLen - 1}}\\w+)(?:[\\s,]+\\1\\b)+`, "gi");
    cleaned = cleaned.replace(pattern, "$1");
  }
  cleaned = cleaned.replace(/,\s*(?:like|you\s+know|kinda|sorta)\s*,/gi, ", ").replace(/,\s*(?:like|you\s+know|kinda|sorta)\s*$/gi, ".").replace(/\b(?:like|you\s+know)\s*$/gi, "").replace(/,\s*$/g, ".");
  return cleaned.replace(/,\s*,+/g, ",").replace(/\s+/g, " ").trim();
}
function isHallucinationLoop(text) {
  if (!text || typeof text !== "string") return true;
  const raw = text.trim();
  if (raw.length < 4) return true;
  const words = raw.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length <= 3) return false;
  const uniqueWords = new Set(words);
  const ratio = uniqueWords.size / words.length;
  if (words.length >= 8 && ratio < 0.4) return true;
  if (words.length >= 15 && ratio < 0.5) return true;
  for (let len = 2; len <= 4; len++) {
    const counts = {};
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(" ");
      counts[phrase] = (counts[phrase] || 0) + 1;
      if (counts[phrase] >= 4) return true;
    }
  }
  return false;
}
function flushTranscriptParagraph(forceAll = false) {
  if (paragraphFlushTimer) {
    clearTimeout(paragraphFlushTimer);
    paragraphFlushTimer = null;
  }
  const fullText = pendingTranscriptBuffer.trim();
  if (fullText.length < 3) {
    pendingTranscriptBuffer = "";
    bufferStartTime = 0;
    return;
  }
  let cutIndex = -1;
  const sentenceEndMatches = [...fullText.matchAll(/[\.\?!;](\s+|$)/g)];
  if (sentenceEndMatches.length > 0) {
    const lastMatch = sentenceEndMatches[sentenceEndMatches.length - 1];
    cutIndex = (lastMatch.index || 0) + lastMatch[0].trimEnd().length;
  } else if (forceAll) {
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 15) {
      const clauseMatches = [...fullText.matchAll(/[,—:](\s+|$)/g)];
      if (clauseMatches.length > 0) {
        const lastMatch = clauseMatches[clauseMatches.length - 1];
        cutIndex = (lastMatch.index || 0) + lastMatch[0].trimEnd().length;
      } else {
        cutIndex = fullText.length;
      }
    } else {
      cutIndex = fullText.length;
    }
  } else {
    return;
  }
  let rawTextToFlush = fullText;
  let textToKeep = "";
  if (cutIndex > 0 && cutIndex < fullText.length) {
    rawTextToFlush = fullText.slice(0, cutIndex).trim();
    textToKeep = fullText.slice(cutIndex).trim();
  } else {
    rawTextToFlush = fullText;
    textToKeep = "";
  }
  pendingTranscriptBuffer = textToKeep;
  bufferStartTime = textToKeep ? Date.now() : 0;
  const textToFlush = removeDuplicateWords(rawTextToFlush);
  if (textToFlush.length < 4 || textToFlush === lastFlushedText) return;
  if (isHallucinationLoop(textToFlush)) {
    console.log(`[Subtitle] Dropped hallucination loop speech: "${textToFlush.substring(0, 40)}..."`);
    return;
  }
  const normFlush = textToFlush.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isDuplicate = recentEmittedServerSentences.slice(0, 4).some((prev) => {
    const normPrev = prev.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normPrev === normFlush;
  });
  if (isDuplicate) {
    console.log(`[Subtitle] Dropped duplicate sentence: "${textToFlush.substring(0, 30)}..."`);
    return;
  }
  recentEmittedServerSentences.unshift(textToFlush);
  if (recentEmittedServerSentences.length > 10) {
    recentEmittedServerSentences.pop();
  }
  lastFlushedText = textToFlush;
  (async () => {
    try {
      const { text: traditionalChinese } = await translateWithGeminiOrFallback(textToFlush);
      const item = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        createdAt: Date.now(),
        english: textToFlush,
        traditionalChinese: traditionalChinese || textToFlush,
        isFinal: true
      };
      console.log(`[Subtitle Broadcast] Broadcasting live subtitle: "${textToFlush.substring(0, 30)}..."`);
      broadcastSubtitle(item);
    } catch (err) {
      console.error("[Subtitle Broadcast Error]:", err);
    }
  })();
}
function stopBackendStreaming() {
  currentStreamingSessionId++;
  if (paragraphFlushTimer) {
    clearTimeout(paragraphFlushTimer);
    paragraphFlushTimer = null;
  }
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
  if (deepgramKeepAliveTimer) {
    clearInterval(deepgramKeepAliveTimer);
    deepgramKeepAliveTimer = null;
  }
  pendingTranscriptBuffer = "";
  bufferStartTime = 0;
  groqAudioAccumulator = Buffer.alloc(0);
  isGroqTranscribing = false;
  if (radioReq) {
    const req = radioReq;
    radioReq = null;
    req.removeAllListeners();
    req.on("error", () => {
    });
    try {
      req.destroy();
    } catch (e) {
    }
  }
  if (deepgramWs) {
    const ws = deepgramWs;
    deepgramWs = null;
    ws.removeAllListeners();
    ws.on("error", () => {
    });
    try {
      if (ws.readyState === import_ws.default.CONNECTING || ws.readyState === import_ws.default.OPEN) {
        ws.terminate();
      }
    } catch (e) {
    }
  }
  isStreamingActive = false;
}
var stopBackendDeepgramStreaming = stopBackendStreaming;
process.on("uncaughtException", (err) => {
  console.warn("Captured uncaughtException in backend:", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.warn("Captured unhandledRejection in backend:", reason?.message || reason);
});
function handleSpeechTranscriptChunk(transcript) {
  const cleanChunk = transcript.trim();
  if (!cleanChunk) return;
  lastAudioDataTime = Date.now();
  lastTranscriptTime = Date.now();
  const currentPending = pendingTranscriptBuffer.trim();
  const normPending = currentPending.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normChunk = cleanChunk.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normPending.length > 0 && (normPending.endsWith(normChunk) || normPending === normChunk)) {
  } else {
    if (!pendingTranscriptBuffer) {
      bufferStartTime = Date.now();
    }
    pendingTranscriptBuffer = pendingTranscriptBuffer ? `${pendingTranscriptBuffer} ${cleanChunk}` : cleanChunk;
  }
  const elapsedMs = Date.now() - bufferStartTime;
  const wordCount = pendingTranscriptBuffer.split(/\s+/).filter(Boolean).length;
  const hasSentenceEnd = /[\.\?!;]\s*$/.test(pendingTranscriptBuffer);
  if (hasSentenceEnd && wordCount >= 5) {
    flushTranscriptParagraph(false);
  } else if (elapsedMs >= 6500 || wordCount >= 22) {
    flushTranscriptParagraph(true);
  } else {
    if (paragraphFlushTimer) clearTimeout(paragraphFlushTimer);
    paragraphFlushTimer = setTimeout(() => {
      flushTranscriptParagraph(false);
    }, 3500);
  }
}
function startBackendStreaming(streamUrl = currentRadioStreamUrl) {
  const realStreamUrl = resolveTargetStreamUrl(streamUrl);
  stopBackendStreaming();
  const activeSessionId = ++currentStreamingSessionId;
  currentRadioStreamUrl = realStreamUrl;
  isStreamingActive = true;
  lastAudioDataTime = Date.now();
  lastTranscriptTime = Date.now();
  groqAudioAccumulator = Buffer.alloc(0);
  isGroqTranscribing = false;
  const engineName = GROQ_TOKEN ? "Groq Whisper Large V3 Turbo ($0.04/hr)" : "Deepgram Nova-2";
  console.log(`[STT Engine] Initializing session #${activeSessionId} via ${engineName} for stream: ${currentRadioStreamUrl}`);
  watchdogInterval = setInterval(() => {
    if (activeSessionId !== currentStreamingSessionId) {
      clearInterval(watchdogInterval);
      return;
    }
    const audioStalled = Date.now() - lastAudioDataTime > 15e3;
    const wsClosed = !GROQ_TOKEN && (!deepgramWs || deepgramWs.readyState !== import_ws.default.OPEN);
    if (wsClosed || audioStalled) {
      console.warn(`[Watchdog] Session #${activeSessionId} stalled (audioStalled: ${audioStalled}, wsClosed: ${wsClosed}). Force re-initializing STT stream...`);
      if (pendingTranscriptBuffer && pendingTranscriptBuffer.trim()) {
        flushTranscriptParagraph(true);
      }
      startBackendStreaming(currentRadioStreamUrl);
    }
  }, 4e3);
  function initDeepgramWs() {
    if (deepgramWs || !DEEPGRAM_TOKEN) return;
    try {
      recordDeepgramRequest();
      const wsUrl = "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true&interim_results=true&endpointing=600&utterance_end_ms=1000";
      deepgramWs = new import_ws.default(wsUrl, {
        headers: {
          Authorization: `Token ${DEEPGRAM_TOKEN}`
        }
      });
      deepgramWs.on("error", (err) => {
        if (activeSessionId !== currentStreamingSessionId) return;
        console.warn(`[Session #${activeSessionId}] Deepgram WebSocket error:`, err?.message || err);
      });
      deepgramWs.on("open", () => {
        if (activeSessionId !== currentStreamingSessionId) return;
        console.log(`[Session #${activeSessionId}] Deepgram WebSocket fallback connected successfully`);
        if (deepgramKeepAliveTimer) clearInterval(deepgramKeepAliveTimer);
        deepgramKeepAliveTimer = setInterval(() => {
          if (deepgramWs && deepgramWs.readyState === import_ws.default.OPEN) {
            try {
              deepgramWs.send(JSON.stringify({ type: "KeepAlive" }));
            } catch (e) {
            }
          }
        }, 5e3);
      });
      deepgramWs.on("message", async (data) => {
        if (activeSessionId !== currentStreamingSessionId) return;
        try {
          const json = JSON.parse(data.toString());
          const isFinal = json.is_final || json.speech_final;
          const transcript = json.channel?.alternatives?.[0]?.transcript?.trim() || "";
          if (transcript.length > 0 && isFinal) {
            handleSpeechTranscriptChunk(transcript);
          }
        } catch (err) {
          console.error("Error parsing Deepgram message:", err);
        }
      });
    } catch (err) {
      console.error("Failed to init Deepgram WebSocket fallback:", err);
    }
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(currentRadioStreamUrl);
  } catch (e) {
    parsedUrl = new URL("https://nhpr.streamguys1.com/nhpr");
  }
  const requester = parsedUrl.protocol === "http:" ? import_http.default : import_https.default;
  const requestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === "http:" ? 80 : 443),
    path: parsedUrl.pathname + parsedUrl.search,
    method: "GET",
    rejectUnauthorized: false,
    timeout: 15e3,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 RadioStream/2.1",
      "Accept": "*/*",
      "Icy-MetaData": "0",
      "Connection": "keep-alive"
    }
  };
  radioReq = requester.get(requestOptions, (radioRes) => {
    if (activeSessionId !== currentStreamingSessionId) {
      try {
        radioRes.destroy();
      } catch (e) {
      }
      return;
    }
    if (radioReq?.socket) {
      try {
        radioReq.socket.setKeepAlive(true, 5e3);
        radioReq.socket.setNoDelay(true);
      } catch (e) {
      }
    }
    if ([301, 302, 303, 307, 308].includes(radioRes.statusCode || 0) && radioRes.headers.location) {
      const redirectUrl = new URL(radioRes.headers.location, currentRadioStreamUrl).toString();
      console.log(`Redirecting radio audio source to ${redirectUrl}`);
      startBackendStreaming(redirectUrl);
      return;
    }
    if ((radioRes.statusCode || 0) >= 400) {
      console.warn(`Radio stream ${currentRadioStreamUrl} returned status ${radioRes.statusCode}. Falling back to default radio stream.`);
      if (currentRadioStreamUrl !== "https://nhpr.streamguys1.com/nhpr") {
        startBackendStreaming("https://nhpr.streamguys1.com/nhpr");
      }
      return;
    }
    radioRes.on("data", (chunk) => {
      if (activeSessionId !== currentStreamingSessionId) return;
      lastAudioDataTime = Date.now();
      if (GROQ_TOKEN) {
        groqAudioAccumulator = Buffer.concat([groqAudioAccumulator, chunk]);
        const now = Date.now();
        const isCooldownOver = now >= groqRateLimitedUntil;
        const isIntervalElapsed = now - lastGroqRequestTime >= MIN_GROQ_INTERVAL_MS;
        if (!isCooldownOver && DEEPGRAM_TOKEN && !deepgramWs) {
          console.log("[STT Failover] Groq in 429 cooldown, activating Deepgram Nova-2 fallback...");
          initDeepgramWs();
        }
        if (groqAudioAccumulator.length >= GROQ_BUFFER_THRESHOLD && !isGroqTranscribing) {
          if (isCooldownOver && isIntervalElapsed) {
            isGroqTranscribing = true;
            lastGroqRequestTime = now;
            const bufferToTranscribe = groqAudioAccumulator;
            groqAudioAccumulator = groqAudioAccumulator.slice(Math.max(0, groqAudioAccumulator.length - 24e3));
            (async () => {
              try {
                if (!bufferToTranscribe || bufferToTranscribe.length < 8e3) {
                  return;
                }
                const wav = await convertToWav(bufferToTranscribe);
                if (!wav || wav.length < 2e3) {
                  return;
                }
                const result = await transcribeWithGroq(wav, groqLastContext);
                if (result.text) {
                  const sanitized = removeDuplicateWords(result.text.trim());
                  groqLastContext = sanitized.slice(-80);
                  const wordCount = sanitized.split(/\s+/).filter(Boolean).length;
                  console.log(`[Groq Whisper STT Stream] Speech chunk processed: ${wordCount} words for session #${activeSessionId}`);
                  handleSpeechTranscriptChunk(sanitized);
                }
                groqConsecutiveErrors = 0;
              } catch (err) {
                const causeMsg = err?.cause?.message || (typeof err?.cause === "string" ? err.cause : "");
                console.warn("[Groq STT Notice]:", err?.message || err, causeMsg ? `(cause: ${causeMsg})` : "");
                groqConsecutiveErrors++;
                if (DEEPGRAM_TOKEN && !deepgramWs) {
                  console.warn("[STT Fallback] Activating Deepgram WebSocket fallback...");
                  initDeepgramWs();
                }
              } finally {
                isGroqTranscribing = false;
              }
            })();
          } else if (!isCooldownOver && groqAudioAccumulator.length > 2e5) {
            groqAudioAccumulator = groqAudioAccumulator.slice(groqAudioAccumulator.length - 1e5);
          }
        }
      }
      if (deepgramWs && deepgramWs.readyState === import_ws.default.OPEN) {
        try {
          deepgramWs.send(chunk);
        } catch (e) {
        }
      }
    });
    radioRes.on("end", () => {
      if (activeSessionId !== currentStreamingSessionId) return;
      console.warn(`[Session #${activeSessionId}] Radio stream HTTP response ended. Reconnecting seamlessly...`);
      setTimeout(() => {
        if (activeSessionId === currentStreamingSessionId) {
          startBackendStreaming(currentRadioStreamUrl);
        }
      }, 1e3);
    });
    radioRes.on("close", () => {
    });
    radioRes.on("error", (err) => {
      if (activeSessionId !== currentStreamingSessionId) return;
      const isReset = err?.code === "ECONNRESET" || err?.code === "EPIPE" || err?.code === "ETIMEDOUT";
      if (isReset) {
        console.log(`[Session #${activeSessionId}] Stream connection reset (${err?.code}). Auto-recovering stream in 1s...`);
      } else {
        console.warn(`[Session #${activeSessionId}] Radio stream response reset/error (${err?.code || err?.message || err}). Reconnecting in 2s...`);
      }
      setTimeout(() => {
        if (activeSessionId === currentStreamingSessionId) {
          startBackendStreaming(currentRadioStreamUrl);
        }
      }, isReset ? 1e3 : 2e3);
    });
  });
  radioReq.on("error", (err) => {
    if (activeSessionId !== currentStreamingSessionId) return;
    const isReset = err?.code === "ECONNRESET" || err?.code === "EPIPE" || err?.code === "ETIMEDOUT";
    if (isReset) {
      console.log(`[Session #${activeSessionId}] Upstream socket reset (${err?.code}). Auto-reconnecting...`);
    } else {
      console.warn(`[Session #${activeSessionId}] Radio HTTP request error (${err?.code || err?.message || err}). Auto-reconnecting...`);
    }
    setTimeout(() => {
      if (activeSessionId === currentStreamingSessionId) {
        startBackendStreaming(currentRadioStreamUrl);
      }
    }, 1500);
  });
  if (!GROQ_TOKEN && DEEPGRAM_TOKEN) {
    initDeepgramWs();
  }
}
var startBackendDeepgramStreaming = startBackendStreaming;
app.post("/api/transcribe-audio-chunk", import_express.default.raw({ type: "*/*", limit: "2mb" }), async (req, res) => {
  try {
    const audioBuffer = req.body;
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      res.status(400).json({ error: "No audio chunk received" });
      return;
    }
    let transcript = "";
    if (GROQ_TOKEN && Date.now() >= groqRateLimitedUntil) {
      try {
        const wavBuffer = await convertToWav(audioBuffer);
        const groqData = await transcribeWithGroq(wavBuffer);
        transcript = groqData.text;
      } catch (e) {
        console.warn("Groq transcribe warning in /api/transcribe-audio-chunk:", e?.message || e);
      }
    }
    if (!transcript && DEEPGRAM_TOKEN) {
      const contentType = req.headers["content-type"] || "audio/webm";
      const deepgramRes = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&language=en-US&smart_format=true&punctuate=true", {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_TOKEN}`,
          "Content-Type": contentType
        },
        body: audioBuffer
      });
      if (deepgramRes.ok) {
        const dgData = await deepgramRes.json();
        transcript = dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";
      }
    }
    if (!transcript) {
      res.json({ english: "", traditionalChinese: "" });
      return;
    }
    const { text: traditionalChinese } = await translateWithGeminiOrFallback(transcript);
    res.json({
      english: transcript,
      traditionalChinese: traditionalChinese || transcript
    });
  } catch (err) {
    console.warn("Notice in /api/transcribe-audio-chunk:", err?.message || err);
    res.json({ english: "", traditionalChinese: "" });
  }
});
app.post("/api/set-active-station", (req, res) => {
  const { streamUrl, name } = req.body;
  if (streamUrl && typeof streamUrl === "string") {
    const realStreamUrl = resolveTargetStreamUrl(streamUrl);
    currentRadioStreamUrl = realStreamUrl;
    console.log(`[Station Change] Active station set to ${name || realStreamUrl} (${realStreamUrl}). Restarting STT...`);
    startBackendDeepgramStreaming(realStreamUrl);
    res.json({ status: "ok", currentRadioStreamUrl: realStreamUrl });
  } else {
    res.status(400).json({ error: "Invalid streamUrl" });
  }
});
app.post("/api/radio-playback-state", (req, res) => {
  const { isPlaying, streamUrl } = req.body || {};
  if (isPlaying === false) {
    if (sseClients.size <= 1) {
      console.log("[Radio State] Client paused radio with no other listeners. Pausing backend Deepgram STT stream...");
      stopBackendDeepgramStreaming();
    } else {
      console.log(`[Radio State] Client paused radio, but ${sseClients.size - 1} other listener(s) remain active. Keeping STT stream alive.`);
    }
    res.json({ status: "ok", isStreamingActive: sseClients.size > 1 ? isStreamingActive : false });
  } else if (isPlaying === true) {
    const targetUrl = streamUrl ? resolveTargetStreamUrl(streamUrl) : currentRadioStreamUrl;
    console.log(`[Radio State] Client resumed radio. Synchronizing backend Deepgram STT stream for ${targetUrl}...`);
    recordListenerActivity("Client resumed radio playback", targetUrl);
    startBackendDeepgramStreaming(targetUrl);
    res.json({ status: "ok", isStreamingActive: true });
  } else {
    res.json({ status: "ok", isStreamingActive });
  }
});
app.post("/api/subtitle-stream-state", (req, res) => {
  const { state, streamUrl, reason } = req.body || {};
  if (state === "background") {
    if (!backgroundEnteredAt) {
      backgroundEnteredAt = Date.now();
    }
    console.log(`[Background Monitor \u{1F4F1}] Client entered background (${reason || "screen_off/app_hidden"}). Authoritative 5-minute backend countdown active...`);
    if (backgroundSleepTimer) clearTimeout(backgroundSleepTimer);
    backgroundSleepTimer = setTimeout(() => {
      if (backgroundEnteredAt && Date.now() - backgroundEnteredAt >= BACKGROUND_AUTO_SLEEP_MS - 3e3) {
        console.log(`[Background Saver \u{1F319}] 5 minutes in background reached. Authoritative backend stopping Groq audio slice streaming ($0/hr, 0 RPM). Radio continues playing.`);
        backgroundSleepMode = true;
        stopBackendStreaming();
      }
    }, BACKGROUND_AUTO_SLEEP_MS);
    res.json({
      status: "ok",
      state: "background",
      backgroundEnteredAt,
      isBackgroundSleeping: backgroundSleepMode,
      remainingSecondsUntilSleep: Math.max(0, Math.round((BACKGROUND_AUTO_SLEEP_MS - (Date.now() - backgroundEnteredAt)) / 1e3))
    });
  } else if (state === "foreground") {
    const wasSleeping = backgroundSleepMode;
    backgroundEnteredAt = null;
    if (backgroundSleepTimer) {
      clearTimeout(backgroundSleepTimer);
      backgroundSleepTimer = null;
    }
    backgroundSleepMode = false;
    const targetUrl = streamUrl ? resolveTargetStreamUrl(streamUrl) : currentRadioStreamUrl;
    if (wasSleeping) {
      console.log(`[Foreground Wakeup \u26A1] Client returned to foreground. Seamlessly waking up Groq Whisper STT & bilingual subtitles for ${targetUrl}...`);
      recordListenerActivity("Foreground Wakeup", targetUrl);
      startBackendStreaming(targetUrl);
    } else {
      console.log(`[Foreground Check \u26A1] Client in foreground. STT streaming active.`);
      recordListenerActivity("Foreground Check", targetUrl);
      if (!isStreamingActive) {
        startBackendStreaming(targetUrl);
      }
    }
    res.json({
      status: "ok",
      state: "foreground",
      isBackgroundSleeping: false,
      isStreamingActive: true,
      wokeUpFromSleep: wasSleeping
    });
  } else {
    res.json({ status: "ok", isBackgroundSleeping: backgroundSleepMode });
  }
});
app.post("/api/subtitle-stream-sleep", (req, res) => {
  const { reason } = req.body || {};
  console.log(`[Background Saver \u{1F319}] 5-minute background playback sleep triggered (${reason || "background_5min"}). Immediately stopping Groq audio slice streaming ($0/hr, 0 RPM). Radio audio playback remains active.`);
  backgroundSleepMode = true;
  backgroundEnteredAt = null;
  if (backgroundSleepTimer) {
    clearTimeout(backgroundSleepTimer);
    backgroundSleepTimer = null;
  }
  stopBackendStreaming();
  res.json({
    status: "ok",
    isSleeping: true,
    isStreamingActive: false,
    message: "Groq STT audio slicing stopped. Radio continues playing in background."
  });
});
app.post("/api/subtitle-stream-wakeup", (req, res) => {
  const { streamUrl } = req.body || {};
  const targetUrl = streamUrl ? resolveTargetStreamUrl(streamUrl) : currentRadioStreamUrl;
  console.log(`[Foreground Wakeup \u26A1] User returned to app. Seamlessly resuming Groq Whisper STT & bilingual subtitles for ${targetUrl}...`);
  backgroundSleepMode = false;
  backgroundEnteredAt = null;
  if (backgroundSleepTimer) {
    clearTimeout(backgroundSleepTimer);
    backgroundSleepTimer = null;
  }
  recordListenerActivity("Foreground Wakeup", targetUrl);
  startBackendStreaming(targetUrl);
  res.json({
    status: "ok",
    isSleeping: false,
    isStreamingActive: true,
    message: "Groq STT audio slicing resumed seamlessly."
  });
});
app.post("/api/clear-buffer", (req, res) => {
  pendingTranscriptBuffer = "";
  bufferStartTime = 0;
  console.log("[Cache Clear] Backend transcript buffer flushed on user request.");
  res.json({ status: "ok", cleared: true });
});
async function startServer() {
  app.use((req, res, next) => {
    if (req.url === "/sw.js" || req.url === "/" || req.url.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  });
  app.use(import_express.default.static(import_path.default.join(process.cwd(), "public")));
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      status: 404,
      error: "Not Found",
      message: `API endpoint ${req.originalUrl} not found on server`,
      timestamp: Date.now()
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log("[STT Engine] On-Demand Mode ACTIVE: Deepgram will start automatically when listeners connect ($0/hr when idle).");
    setInterval(checkIdleSleepStatus, 5e3);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
