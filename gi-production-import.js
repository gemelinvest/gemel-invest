/* GEMEL INVEST — ייבוא דוח פרודוקציה (GI-PROD 2026-08-27)
   נטען לפי דרישה ממסך טעינת קבצי מערכת.
   הכשרה: קבצי רוחב-קבוע IBM862 (RB/RP/SB/SP).
   מגדל: קבצי MBT מופרדי-צינור UTF-8 (LIFEHLTH/LIFE/COVRLIFE/PERSON).
   מנורה: חיים פרודוקציה ישן — M/N/G/P.TXT + TRFR.ALL (IBM862), ZIP פרט (MP) / מבוטלות (MM).
   כלל: תיבת EXE/ZIP של אפקס — POL/MEV/TAR/SGB (Windows-1255 או IBM862).
*/
(function installGiProduction(global){
  "use strict";

  const CP862_HE = "אבגדהוזחטיךכלםמןנסעףפץצקרשת";
  const CP1255_HE = "אבגדהוזחטיךכלםמןנסעףפץצקרשת";
  const COMPANY_HACHSHARA = "הכשרה";
  const COMPANY_MIGDAL = "מגדל";
  const COMPANY_MENORA = "מנורה";
  const COMPANY_CLAL = "כלל";
  const ACTIVE_STATUS = "כ";
  const MIGDAL_KIND_SET = Object.freeze({
    LIFEHLTH: true,
    LIFE: true,
    COVRLIFE: true,
    PERSON: true,
    AGENTS: true,
    COMPANY: true
  });
  const MENORA_KIND_SET = Object.freeze({
    MENORA_M: true,
    MENORA_N: true,
    MENORA_G: true,
    MENORA_P: true,
    MENORA_TRFR: true
  });
  const MENORA_LIFE_CLASS = Object.freeze({ "01": true, "04": true, "05": true, "06": true, "07": true, "08": true });
  const MENORA_HEALTH_CLASS = Object.freeze({ "10": true, "11": true, "20": true, "21": true, "30": true, "50": true });
  const CLAL_KIND_SET = Object.freeze({
    CLAL_POL: true,
    CLAL_MEV: true,
    CLAL_TAR: true,
    CLAL_SGB: true
  });
  const CLAL_HEALTH_PRODUCT = Object.freeze({ "211": true, "214": true, "111": true });

  const COMPANIES = Object.freeze([
    { id: COMPANY_HACHSHARA, label: "הכשרה", ready: true, hint: "קבצי RB, RP, SB, SP (בלי סיומת)", dropHint: "הכשרה: RB (כיסויי בריאות), RP (מבוטחי בריאות), SB (כיסויי חיים), SP (מבוטחי חיים). אפשר כמה יחד." },
    { id: "הפניקס", label: "הפניקס", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" },
    { id: COMPANY_MIGDAL, label: "מגדל", ready: true, hint: "קבצי LIFEHLTH, LIFE, COVRLIFE, PERSON (.MBT)", dropHint: "מגדל: LIFEHLTH (בריאות), LIFE (חיים), COVRLIFE (כיסויים), PERSON (מבוטחים). אפשר גם AGENTS / COMPANY." },
    { id: COMPANY_MENORA, label: "מנורה", ready: true, hint: "קבצי M, N, G, P + TRFR (ZIP פרט / מבוטלות)", dropHint: "מנורה: ZIP של פרט (MP) או מבוטלות (MM), או קבצי ‎*M.TXT / *N.TXT / *G.TXT / *P.TXT ו־TRFR.ALL." },
    { id: COMPANY_CLAL, label: "כלל", ready: true, hint: "תיבת EXE / ZIP של אפקס (POL, MEV, TAR, SGB)", dropHint: "כלל: תיבת EXE או ZIP של אפקס חיים / אפקס בריאות, או קבצי POL, MEV, TAR, SGB. ממשק אחזקות לא נטען כאן." },
    { id: "איילון", label: "איילון", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" }
  ]);

  const HEALTH_COVER_MAP = [
    { re: /מחלות\s*קשות/, key: "מחלות קשות" },
    { re: /פיצוי\s*לסרטן/, key: "מזור לסרטן" },
    { re: /מזור\s*לסרטן/, key: "מזור לסרטן" },
    { re: /מזור/, key: "מזור מורחב" },
    { re: /שקל\s*ראשון|מהשקל/, key: "ניתוחים בישראל מהשקל הראשון" },
    { re: /ניתוחים וטיפולים מח/, key: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל" },
    { re: /ניתוח.*ישראל|ניתוחים\s*בישראל/, key: "ניתוחים בישראל מורחב" },
    { re: /שב.?ן/, key: "משלים שב\"ן ללא השתתפות עצמית" },
    { re: /השתל/, key: "השתלות וטיפולים מיוחדים מחוץ לישראל" },
    { re: /ניתוח.*חו|תוחים.*חול|חול.*חותינ|בחול/, key: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל" },
    { re: /תרופות/, key: "תרופות מחוץ לסל שירותי הבריאות" },
    { re: /אמבולטור|ייעוץ.*בדיק|יעוץ.*בדיק|אבחון/, key: "ייעוץ ובדיקות" },
    { re: /ילד/, key: "שירות פרימיום לילד" }
  ];

  function safeTrim(v){
    return String(v == null ? "" : v).replace(/^\s+|\s+$/g, "");
  }
  function digits(v){
    return String(v == null ? "" : v).replace(/\D+/g, "");
  }
  function normId(v){
    const raw = digits(v);
    if(!raw) return "";
    if(raw.length > 9) return raw.slice(-9);
    return raw.padStart(9, "0");
  }
  function normPolicy(v){
    return digits(v).replace(/^0+/, "") || "";
  }
  function col(s, a, b){
    return String(s || "").slice(a - 1, b);
  }
  function nowISO(){
    try { return new Date().toISOString(); } catch(_e) { return ""; }
  }

  function decodeCp862(bytes){
    const out = [];
    const n = bytes.length;
    for(let i = 0; i < n; i++){
      const b = bytes[i] & 0xff;
      if(b >= 0x80 && b <= 0x9A) out.push(CP862_HE.charAt(b - 0x80));
      else if(b === 13) out.push("\r");
      else if(b === 10) out.push("\n");
      else if(b >= 32 && b < 127) out.push(String.fromCharCode(b));
      else out.push(" ");
    }
    return out.join("");
  }

  function decodeWin1255(bytes){
    const out = [];
    const n = bytes.length;
    for(let i = 0; i < n; i++){
      const b = bytes[i] & 0xff;
      if(b >= 0xE0 && b <= 0xFA) out.push(CP1255_HE.charAt(b - 0xE0));
      else if(b === 13) out.push("\r");
      else if(b === 10) out.push("\n");
      else if(b >= 32 && b < 127) out.push(String.fromCharCode(b));
      else out.push(" ");
    }
    return out.join("");
  }

  function decodeClalBytes(bytes){
    let he1255 = 0;
    let he862 = 0;
    const n = Math.min(bytes.length, 8000);
    for(let i = 0; i < n; i++){
      const b = bytes[i] & 0xff;
      if(b >= 0xE0 && b <= 0xFA) he1255++;
      else if(b >= 0x80 && b <= 0x9A) he862++;
    }
    return he1255 >= he862 && he1255 > 0 ? decodeWin1255(bytes) : decodeCp862(bytes);
  }

  function findEmbeddedZipOffset(buffer){
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const n = bytes.length - 3;
    for(let i = 0; i < n; i++){
      if(bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04){
        return i;
      }
    }
    return -1;
  }

  function fixVisualHebrew(s){
    const str = String(s || "");
    let out = "";
    let i = 0;
    while(i < str.length){
      const ch = str.charAt(i);
      if(ch >= "\u0590" && ch <= "\u05FF"){
        let j = i;
        while(j < str.length){
          const c = str.charAt(j);
          if((c >= "\u0590" && c <= "\u05FF") || c === " " || c === "\"" || c === "'" || c === "-" || c === "/" || c === ".") j++;
          else break;
        }
        let k = j;
        while(k > i){
          const c = str.charAt(k - 1);
          if(c >= "\u0590" && c <= "\u05FF") break;
          k--;
        }
        out += str.slice(i, k).split("").reverse().join("") + str.slice(k, j);
        i = j;
      } else {
        out += ch;
        i++;
      }
    }
    return out;
  }

  function splitRecords(text){
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((l) => l.replace(/\s+$/g, ""))
      .filter((l) => l.replace(/\s/g, "").length > 0);
  }

  function packedMoney(raw, lastDigits){
    const d = digits(raw);
    if(!d) return 0;
    const take = lastDigits ? d.slice(-lastDigits) : d;
    const n = Number(take.replace(/^0+/, "") || "0");
    if(!Number.isFinite(n)) return 0;
    return Math.round(n) / 100;
  }

  function dmy8(raw){
    const d = digits(raw);
    if(d.length !== 8) return "";
    const dd = d.slice(0, 2);
    const mm = d.slice(2, 4);
    const yy = d.slice(4, 8);
    const di = Number(dd);
    const mi = Number(mm);
    const yi = Number(yy);
    if(di < 1 || di > 31 || mi < 1 || mi > 12 || yi < 1900 || yi > 2100) return "";
    return dd + "/" + mm + "/" + yy;
  }

  function ymd8(raw){
    const d = digits(raw);
    if(d.length !== 8) return "";
    const yy = d.slice(0, 4);
    const mm = d.slice(4, 6);
    const dd = d.slice(6, 8);
    const di = Number(dd);
    const mi = Number(mm);
    const yi = Number(yy);
    if(di < 1 || di > 31 || mi < 1 || mi > 12 || yi < 1900 || yi > 2100) return "";
    return dd + "/" + mm + "/" + yy;
  }

  function ym6(raw){
    const d = digits(raw);
    if(d.length !== 6) return "";
    const yy = d.slice(0, 4);
    const mm = d.slice(4, 6);
    const mi = Number(mm);
    const yi = Number(yy);
    if(mi < 1 || mi > 12 || yi < 1900 || yi > 2100) return "";
    return "01/" + mm + "/" + yy;
  }

  function yyMMdd(raw){
    const d = digits(raw);
    if(d.length !== 6) return "";
    const yy = Number(d.slice(0, 2));
    const mm = Number(d.slice(2, 4));
    const dd = Number(d.slice(4, 6));
    if(dd < 1 || dd > 31 || mm < 1 || mm > 12) return "";
    const year = yy >= 30 ? 1900 + yy : 2000 + yy;
    const ds = dd < 10 ? "0" + dd : String(dd);
    const ms = mm < 10 ? "0" + mm : String(mm);
    return ds + "/" + ms + "/" + year;
  }

  function keepLogicalHebrew(raw){
    const t = safeTrim(String(raw || "")).replace(/\s+/g, " ");
    if(!t) return "";
    if(/^(תל |חיפה|ירושל|רחובות|נתניה|אשדוד|באר |פתח |רמת |קריית|הרצליה|חולון|ראשון|אשקלון|בת ים|רעננה|כפר |מודיעין|לוד|רמלה|עפולה|טבריה|אילת|נהריה|כרמיאל|גבעתיים|בני ברק|הוד |נס צ|יהוד|ראש העין|אור |יקנעם|מעלה |שדרות|דימונה|טירת |נצרת|עכו|צפת|בית ש|גבעת |קרית )/.test(t)){
      return t;
    }
    return cleanName(t);
  }

  function round2(n){
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function splitFullName(full){
    const parts = safeTrim(full).split(/\s+/).filter(Boolean);
    if(!parts.length) return { firstName: "", lastName: "", fullName: "" };
    if(parts.length === 1) return { firstName: parts[0], lastName: "", fullName: parts[0] };
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts[parts.length - 1],
      fullName: parts.join(" ")
    };
  }

  function cleanName(raw){
    return fixVisualHebrew(raw).replace(/\s+/g, " ").trim();
  }

  function hebrewLogicScore(s){
    const t = String(s || "");
    let n = 0;
    if(/^(תרופות|השתלות|ניתוח|אמבולטור|מחלות|משלים|ייעוץ|שירות|מגן|ריסק|משכנתא)/.test(t)) n += 6;
    if(/מחוץ|בישראל|שב.?ן|טיפול|בדיק/.test(t)) n += 2;
    return n;
  }

  function mapHealthCover(name){
    const raw = safeTrim(String(name || "")).replace(/\s+/g, " ");
    if(!raw) return "";
    const flipped = safeTrim(fixVisualHebrew(raw).replace(/\s+/g, " "));
    const cands = [raw];
    if(flipped && flipped !== raw) cands.push(flipped);
    for(let c = 0; c < cands.length; c++){
      for(let i = 0; i < HEALTH_COVER_MAP.length; i++){
        if(HEALTH_COVER_MAP[i].re.test(cands[c])) return HEALTH_COVER_MAP[i].key;
      }
    }
    if(flipped && flipped !== raw && hebrewLogicScore(flipped) > hebrewLogicScore(raw)) return flipped;
    return raw;
  }

  function mapLifeCover(name){
    const raw = safeTrim(String(name || "")).replace(/\s+/g, " ");
    if(!raw) return "";
    const flipped = safeTrim(fixVisualHebrew(raw).replace(/\s+/g, " "));
    const cands = [raw];
    if(flipped && flipped !== raw) cands.push(flipped);
    let picked = raw;
    for(let c = 0; c < cands.length; c++){
      if(hebrewLogicScore(cands[c]) > hebrewLogicScore(picked)) picked = cands[c];
    }
    return picked;
  }

  function isMortgageLife(covers){
    const blob = (covers || []).map((c) => {
      const a = String(c?.coverName || "");
      const b = fixVisualHebrew(a);
      return a + " " + b;
    }).join(" ");
    return /משכנתא|אתנכשמ/.test(blob);
  }

  function inferLifeProductType(covers){
    if(isMortgageLife(covers)) return "ריסק משכנתא";
    const names = (covers || []).map((c) => String(c?.coverName || c?.coverNameRaw || "")).join(" ");
    const hasCoreLife = /ריסק|מגדלור|קשת|חיים|חסכון|כושר|שלוה|מוטב|מעורב|משענת/.test(names);
    const hasDeathAcc = /מוות מתאונה/.test(names);
    const hasDisAcc = /נכות מתאונה/.test(names);
    if(hasCoreLife) return "ריסק";
    if(hasDeathAcc && !hasDisAcc) return "מוות מתאונה";
    if(hasDisAcc && !hasDeathAcc) return "נכות מתאונה";
    return "ריסק";
  }

  function money2(n){
    const x = Math.round((Number(n) || 0) * 100) / 100;
    if(!x) return "";
    return x.toFixed(2);
  }

  function isMonthlyLike(n){
    const x = Number(n) || 0;
    return x > 0 && x < 10000;
  }

  function isBenefitLike(n){
    return (Number(n) || 0) >= 10000;
  }

  function maxCoverBenefit(covers){
    let best = 0;
    (covers || []).forEach((c) => {
      const n = Number(c?.sumInsured) || 0;
      if(n > best) best = n;
    });
    return best;
  }

  function splitLifeMoney(headerPrem, coverMonthly, coverBenefit){
    const h = Number(headerPrem) || 0;
    const c = Number(coverMonthly) || 0;
    const b = Number(coverBenefit) || 0;
    if(isBenefitLike(h) && isMonthlyLike(c)){
      return { premiumMonthly: money2(c), sumInsured: money2(h) };
    }
    if(isBenefitLike(h) && (!c || Math.abs(h - c) < 0.05)){
      return { premiumMonthly: "", sumInsured: money2(h) };
    }
    if(isBenefitLike(c) && !isMonthlyLike(c) && !isMonthlyLike(h)){
      return { premiumMonthly: isMonthlyLike(h) ? money2(h) : "", sumInsured: money2(c) };
    }
    return {
      premiumMonthly: c ? money2(c) : (isMonthlyLike(h) ? money2(h) : ""),
      sumInsured: isBenefitLike(b) ? money2(b) : ""
    };
  }

  function pickCompensation(type, covers){
    const t = safeTrim(type);
    if(t !== "מחלות קשות" && t !== "סרטן") return "";
    const n = maxCoverBenefit(covers);
    return n >= 1000 ? money2(n) : "";
  }

  function formatPaymentPeriod(raw){
    const d = digits(raw);
    if(!d) return "";
    const n = Number(String(d).replace(/^0+/, "") || "0");
    if(n >= 1 && n <= 600) return String(n);
    return String(d).replace(/^0+/, "") || d;
  }

  function pickAgentNumber(people){
    const counts = new Map();
    (people || []).forEach((p) => {
      const a = safeTrim(p?.agent);
      if(!a) return;
      counts.set(a, (counts.get(a) || 0) + 1);
    });
    let best = "";
    let n = 0;
    counts.forEach((c, k) => {
      if(c > n){
        n = c;
        best = k;
      }
    });
    return best;
  }

  function pickPaymentPeriod(people){
    for(let i = 0; i < (people || []).length; i++){
      const p = formatPaymentPeriod(people[i]?.period);
      if(p) return p;
    }
    return "";
  }

  function coverNameForFamily(cover, family){
    const raw = safeTrim(cover?.coverName || cover?.coverNameRaw);
    if(family === "life") return mapLifeCover(raw);
    for(let i = 0; i < HEALTH_COVER_MAP.length; i++){
      if(HEALTH_COVER_MAP[i].key === raw) return raw;
    }
    return mapHealthCover(raw);
  }

  function sumCoverPremiums(covers, family){
    const out = {};
    (covers || []).forEach((c) => {
      const name = coverNameForFamily(c, family);
      if(!name) return;
      const prem = Number(c.premium) || 0;
      out[name] = Math.round(((Number(out[name]) || 0) + prem) * 100) / 100;
    });
    const str = {};
    Object.keys(out).forEach((k) => { str[k] = money2(out[k]); });
    return str;
  }

  function pipeFields(line){
    return String(line || "").split("|").map((s) => safeTrim(s));
  }

  function parseMoneyField(raw){
    const s = safeTrim(raw).replace(/,/g, "");
    if(!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function decodeUtf8Bytes(bytes){
    try {
      if(typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
    } catch(_e) {}
    try {
      if(typeof Buffer !== "undefined") return Buffer.from(bytes).toString("utf8");
    } catch(_e) {}
    let out = "";
    for(let i = 0; i < bytes.length; i++){
      const b = bytes[i] & 0xff;
      if(b < 0x80){
        out += String.fromCharCode(b);
      } else if(b >= 0xC0 && b < 0xE0 && i + 1 < bytes.length){
        out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[++i] & 0x3f));
      } else if(b >= 0xE0 && b < 0xF0 && i + 2 < bytes.length){
        const b2 = bytes[++i] & 0x3f;
        const b3 = bytes[++i] & 0x3f;
        out += String.fromCharCode(((b & 0x0f) << 12) | (b2 << 6) | b3);
      } else if(b >= 0xF0 && i + 3 < bytes.length){
        const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
        i += 3;
        const adj = cp - 0x10000;
        out += String.fromCharCode(0xD800 + (adj >> 10), 0xDC00 + (adj & 0x3ff));
      } else {
        out += "\uFFFD";
      }
    }
    return out;
  }

  function looksLikeMigdalPipe(bytes){
    const n = Math.min(bytes.length, 500);
    let pipes = 0;
    for(let i = 0; i < n; i++){
      if(bytes[i] === 124) pipes++;
    }
    return pipes >= 5;
  }

  function detectMigdalKindFromName(fileName){
    const n = String(fileName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if(!n) return "";
    if(n.indexOf("LIFEHLTH") >= 0) return "LIFEHLTH";
    if(n.indexOf("COVRLIFE") >= 0) return "COVRLIFE";
    if(n.indexOf("PERSON") >= 0) return "PERSON";
    if(n.indexOf("AGENTS") >= 0) return "AGENTS";
    if(n.indexOf("COMPANY") >= 0) return "COMPANY";
    if(n === "LIFE" || n === "LIFEMBT" || (n.indexOf("LIFE") === 0 && n.indexOf("HLTH") < 0 && n.indexOf("COVR") < 0)){
      return "LIFE";
    }
    return "";
  }

  function detectMigdalKindFromRecord(line){
    const n = String(line || "").split("|").length;
    if(n >= 120) return "LIFE";
    if(n >= 50 && n <= 80) return "LIFEHLTH";
    if(n >= 40 && n <= 48) return "PERSON";
    if(n >= 30 && n <= 38) return "COMPANY";
    if(n >= 20 && n <= 26) return "COVRLIFE";
    if(n === 1 && /^\d{6,10}$/.test(safeTrim(line))) return "AGENTS";
    return "";
  }

  function migdalPolicyNumber(raw){
    const d = digits(raw);
    if(!d) return "";
    if(d.length >= 11 && d.slice(0, 2) === "01") return normPolicy(d.slice(2));
    return normPolicy(d);
  }

  function detectKind(fileName, rec0){
    const clal = detectClalKindFromName(fileName);
    if(clal) return clal;
    const menora = detectMenoraKindFromName(fileName) || detectMenoraKindFromRecord(rec0);
    if(menora) return menora;
    const mig = detectMigdalKindFromName(fileName) || (String(rec0 || "").indexOf("|") >= 0 ? detectMigdalKindFromRecord(rec0) : "");
    if(mig) return mig;
    const n = String(fileName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if(n.indexOf("RB") === 0) return "RB";
    if(n.indexOf("RP") === 0) return "RP";
    if(n.indexOf("SB") === 0) return "SB";
    if(n.indexOf("SP") === 0) return "SP";
    if(n.indexOf("RM") === 0) return "RM";
    const s = rec0 || "";
    const idMaybe = col(s, 26, 34);
    const coverTail = cleanName(col(s, 128, 160));
    if(normId(idMaybe) && /[\u0590-\u05FF]/.test(cleanName(col(s, 44, 80)))) return (coverTail.indexOf("מגן") >= 0) ? "SP" : "RP";
    if(coverTail) return (coverTail.indexOf("מגן") >= 0) ? "SB" : "RB";
    return "";
  }

  function fileBaseName(fileName){
    return String(fileName || "").replace(/\\/g, "/").split("/").pop();
  }

  function detectMenoraKindFromName(fileName){
    const base = fileBaseName(fileName).toUpperCase();
    if(base === "TRFR.ALL") return "MENORA_TRFR";
    const m = base.match(/^(\d+)([MNGP])\.TXT$/);
    if(m) return "MENORA_" + m[2];
    return "";
  }

  function detectClalKindFromName(fileName){
    const base = fileBaseName(fileName).toUpperCase();
    if(/HOLDNGINP/.test(base) || /אחזקות/.test(String(fileName || ""))) return "";
    const m = base.match(/\.([A-Z0-9]+)$/);
    const ext = m ? m[1] : "";
    if(ext === "POL") return "CLAL_POL";
    if(ext === "MEV") return "CLAL_MEV";
    if(ext === "TAR") return "CLAL_TAR";
    if(ext === "SGB") return "CLAL_SGB";
    return "";
  }

  function looksLikeMenoraRecord(rec){
    const s = String(rec || "").replace(/\r$/, "");
    if(!/^06\d{9}/.test(s)) return false;
    const ch = s.charAt(9);
    if(ch === "X" || ch === "x") return false;
    const len = s.length;
    return len === 166 || len === 201 || len === 287 || len === 301;
  }

  function looksLikeMenoraTrfr(rec){
    const s = String(rec || "").replace(/\s+$/g, "");
    if(s.length !== 31) return false;
    if(!/[\u0590-\u05FF]/.test(s)) return false;
    return /^\d{2}$/.test(s.slice(-2));
  }

  function detectMenoraKindFromRecord(rec0){
    const s = String(rec0 || "").replace(/\r$/, "");
    if(looksLikeMenoraTrfr(s)) return "MENORA_TRFR";
    if(!looksLikeMenoraRecord(s)) return "";
    if(s.length === 166) return "MENORA_N";
    if(s.length === 201) return "MENORA_M";
    if(s.length === 287) return "MENORA_G";
    if(s.length === 301) return "MENORA_P";
    return "";
  }

  function parseMenoraMoney(raw){
    const s = safeTrim(raw).replace(/,/g, "");
    if(!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function parseMenoraM(s){
    const policyNumber = digits(s.slice(0, 11));
    if(!policyNumber) return null;
    return {
      kind: "MENORA_M",
      policyNumber,
      agent: safeTrim(s.slice(11, 17)),
      plan: safeTrim(s.slice(17, 28)),
      idNumber: normId(s.slice(40, 49))
    };
  }

  function parseMenoraN(s){
    const policyNumber = digits(s.slice(0, 11));
    if(!policyNumber) return null;
    const visCode = s.slice(43, 47);
    const productCode = fixVisualHebrew(visCode).replace(/\s+/g, "");
    const premAnnual = parseMenoraMoney(s.slice(97, 106));
    const tail = s.slice(131);
    const moneyHits = String(tail).match(/\d+\.\d+/g) || [];
    const sumInsured = moneyHits.length ? parseMenoraMoney(moneyHits[moneyHits.length - 1]) : 0;
    return {
      kind: "MENORA_N",
      policyNumber,
      agent: safeTrim(s.slice(11, 17)),
      plan: safeTrim(s.slice(17, 28)),
      seq: safeTrim(s.slice(39, 43)),
      productCode,
      coverNameRaw: productCode,
      premiumAnnual: premAnnual,
      premium: round2(premAnnual / 12),
      startYm: digits(s.slice(106, 112)),
      startDate: ym6(s.slice(106, 112)),
      idNumber: normId(s.slice(112, 121)),
      birthDate: ymd8(s.slice(123, 131)),
      sumInsured
    };
  }

  function parseMenoraG(s){
    const policyNumber = digits(s.slice(0, 11));
    if(!policyNumber) return null;
    return {
      kind: "MENORA_G",
      policyNumber,
      agent: safeTrim(s.slice(11, 17)),
      premiumAnnual: parseMenoraMoney(s.slice(148, 163)),
      premiumMonthly: parseMenoraMoney(s.slice(163, 174))
    };
  }

  function parseMenoraP(s){
    const policyNumber = digits(s.slice(0, 11));
    if(!policyNumber) return null;
    const names = splitFullName(cleanName(s.slice(56, 80)));
    return {
      kind: "MENORA_P",
      policyNumber,
      agent: safeTrim(s.slice(11, 17)),
      idNumber: normId(s.slice(39, 48)),
      birthDate: ymd8(s.slice(48, 56)),
      firstName: names.firstName,
      lastName: names.lastName,
      fullName: names.fullName,
      gender: mapGender(s.slice(80, 81)),
      city: cleanName(s.slice(128, 140)),
      street: cleanName(s.slice(145, 165)),
      house: safeTrim(s.slice(140, 145)),
      status: "",
      period: ""
    };
  }

  function parseMenoraTrfr(s){
    const code = fixVisualHebrew(s.slice(0, 4)).replace(/\s+/g, "");
    if(!code) return null;
    return {
      kind: "MENORA_TRFR",
      code,
      desc: cleanName(s.slice(4, 29)),
      class: digits(s.slice(29, 31)).padStart(2, "0").slice(-2)
    };
  }

  function clalDigitHints(s, from, to){
    const chunk = String(s || "").slice(from, to);
    const out = [];
    const re = /\d{8,11}/g;
    let m;
    while((m = re.exec(chunk))){
      const n = normPolicy(m[0]);
      if(n && out.indexOf(n) < 0) out.push(n);
    }
    return out;
  }

  function parseClalPol(s){
    const rec = String(s || "");
    if(rec.length < 40 || !/^\d{5}/.test(rec)) return null;
    const agent = rec.slice(0, 5);
    const policyHints = clalDigitHints(rec, 5, 90);
    let policyNumber = "";
    if(rec.length >= 380){
      policyNumber = normPolicy(rec.slice(23, 31));
    } else {
      policyNumber = normPolicy(rec.slice(31, 40)) || normPolicy(rec.slice(23, 31));
    }
    if(!policyNumber && policyHints.length) policyNumber = policyHints[0];
    if(!policyNumber) return null;
    const product = safeTrim(rec.slice(41, 44));
    let premium = 0;
    let sumInsured = 0;
    if(rec.length >= 380){
      premium = packedMoney(rec.slice(66, 74), 8);
    } else {
      const a = packedMoney(rec.slice(58, 66), 8);
      const b = packedMoney(rec.slice(66, 74), 8);
      if(isMonthlyLike(a)) premium = a;
      else if(isMonthlyLike(b)) premium = b;
      if(isBenefitLike(b)) sumInsured = b;
      else if(isBenefitLike(a)) sumInsured = a;
    }
    const idA = rec.length >= 41 ? normId(rec.slice(32, 41)) : "";
    const idTail = rec.length >= 377 ? normId(rec.slice(368, 377)) : "";
    const hintSet = {};
    policyHints.concat([policyNumber]).forEach((h) => { hintSet[h] = true; });
    function usableId(id){
      const n = normId(id);
      if(!n || /^0+$/.test(n)) return "";
      if(hintSet[normPolicy(n)] || hintSet[n]) return "";
      return n;
    }
    const idNumber = usableId(idA);
    const idNumber2 = usableId(idTail) && usableId(idTail) !== idNumber ? usableId(idTail) : (idNumber ? "" : usableId(idTail));
    return {
      kind: "CLAL_POL",
      policyNumber,
      policyHints,
      agent,
      product,
      familyHint: (CLAL_HEALTH_PRODUCT[product] || rec.length >= 380) ? "health" : "life",
      premium,
      sumInsured: sumInsured ? money2(sumInsured) : "",
      idNumber,
      idNumber2
    };
  }

  function parseClalMev(s){
    const rec = String(s || "");
    if(rec.length < 40 || !/^\d{5}/.test(rec)) return null;
    const agent = rec.slice(0, 5);
    const policyNumber = normPolicy(rec.slice(5, 14));
    if(!policyNumber) return null;
    const gender = mapGender(rec.charAt(117)) || mapGender((rec.slice(90, 160).match(/[זנ]/) || [])[0]);
    const birthDate = yyMMdd(rec.slice(111, 117));
    const phDigits = digits(rec.slice(90, 120));
    let phone = "";
    const ph0 = phDigits.match(/0\d{9}/);
    if(ph0) phone = ph0[0];
    else {
      const rest = phDigits.replace(/^0+/, "");
      if(rest.length >= 9) phone = "0" + rest.slice(0, 9);
    }
    let nameRaw = rec.slice(40, 70);
    const firstHe = rec.search(/[\u0590-\u05FF]/);
    if(firstHe >= 14 && firstHe < 70){
      let j = firstHe;
      while(j < 90){
        const c = rec.charAt(j);
        if((c >= "\u0590" && c <= "\u05FF") || c === " " || c === "\"" || c === "'" || c === "-" || c === "/" || c === ".") j++;
        else break;
      }
      nameRaw = rec.slice(firstHe, j);
    }
    let house = "";
    const houseInName = nameRaw.match(/(\d+)\s*$/);
    if(houseInName){
      house = houseInName[1];
      nameRaw = nameRaw.replace(/\d+\s*$/, "");
    }
    const afterName = rec.slice(64, 78);
    const houseAfter = afterName.match(/(\d{1,5})/);
    if(!house && houseAfter) house = houseAfter[1];
    const names = splitFullName(cleanName(nameRaw));
    const cityBand = safeTrim(rec.slice(70, 95).replace(/[0-9]+/g, " "));
    const cityKeep = keepLogicalHebrew(cityBand);
    const useHealthLayout = rec.length >= 345 || (!!cityBand && cityKeep === cityBand);
    let city = "";
    let street = "";
    if(useHealthLayout){
      city = cityKeep;
    } else {
      street = cleanName(rec.slice(67, 88).replace(/\d+/g, " "));
      city = keepLogicalHebrew(rec.slice(88, 110).replace(/[0-9]+/g, " "));
    }
    const idMaybe = normId(rec.slice(94, 103));
    const idNumber = idMaybe && !/^0+$/.test(idMaybe) && rec.charAt(94) !== "0" ? idMaybe : "";
    return {
      kind: "CLAL_MEV",
      policyNumber,
      agent,
      idNumber,
      idNumber2: "",
      firstName: names.firstName,
      lastName: names.lastName,
      fullName: names.fullName,
      house,
      city,
      street,
      gender,
      birthDate,
      phone,
      status: "",
      period: ""
    };
  }

  function parseClalTar(s){
    const rec = String(s || "");
    if(rec.length < 24 || !/^\d{5}/.test(rec)) return null;
    const agent = rec.slice(0, 5);
    const policyNumber = normPolicy(rec.slice(15, 24));
    if(!policyNumber) return null;
    const rawCode = digits(rec.slice(-8)).padStart(8, "0").slice(-8);
    if(!rawCode || /^0+$/.test(rawCode)) return null;
    const startDate = dmy8(rec.slice(28, 36)) || ymd8(rec.slice(28, 36)) || dmy8(rec.slice(24, 32)) || "";
    const tarId = rec.length >= 177 ? normId(rec.slice(168, 177)) : "";
    return {
      kind: "CLAL_TAR",
      policyNumber,
      agent,
      coverCodeRaw: rawCode,
      startDate,
      premium: 0,
      idNumber: tarId && !/^0+$/.test(tarId) ? tarId : ""
    };
  }

  function parseClalSgb(s){
    const rec = String(s || "");
    const code = digits(rec.slice(0, 6)).padStart(6, "0");
    if(!code || code === "000000") return null;
    return {
      kind: "CLAL_SGB",
      code,
      desc: mapLifeCover(rec.slice(6)) || cleanName(rec.slice(6))
    };
  }

  function resolveClalCoverCode(raw8, catalog){
    const d = digits(raw8).padStart(8, "0").slice(-8);
    const cands = [
      d.slice(0, 6),
      ("00" + d.slice(0, 4)).slice(-6),
      d.slice(2, 6).padStart(6, "0"),
      (d.replace(/00$/, "")).padStart(6, "0"),
      d.slice(0, 4).padStart(6, "0")
    ];
    for(let i = 0; i < cands.length; i++){
      const c = cands[i];
      if(catalog[c]) return catalog[c];
    }
    return null;
  }

  function clalCoverFamily(desc, product, recLen){
    const t = String(desc || "");
    if(/ניתוח|תרופות|השתל|ייעוץ|אבחון|בריאות|שב.?ן|אמבולטור|מחלות\s*קשות|סרטן|מדיכלל/.test(t)) return "health";
    if(/ריסק|משכנתא|מעורב|משענת|חיים/.test(t)) return "life";
    if(CLAL_HEALTH_PRODUCT[product] || recLen >= 380) return "health";
    return "life";
  }

  function menoraCoverFamily(cls, desc){
    const c = String(cls || "");
    if(MENORA_HEALTH_CLASS[c]) return "health";
    if(MENORA_LIFE_CLASS[c]) return "life";
    if(/בריאות|סיעוד|אבחון|שיניים|אמבולטור|ניתוח|השתל|תרופות/.test(String(desc || ""))) return "health";
    return "life";
  }

  function mapMenoraHealthCover(desc){
    const t = safeTrim(desc);
    if(!t) return "";
    if(/שקל\s*ר/.test(t)) return "ניתוחים בישראל מהשקל הראשון";
    if(/תרופה/.test(t) && !/תרופות/.test(t)) return mapHealthCover("תרופות");
    return mapHealthCover(t);
  }

  function parseRbRecord(s){
    const policyNumber = normPolicy(col(s, 9, 15));
    if(!policyNumber) return null;
    return {
      kind: "RB",
      policyNumber,
      coverCode: safeTrim(col(s, 16, 20)),
      startDate: dmy8(col(s, 23, 30)),
      premium: packedMoney(col(s, 44, 51), 8),
      idNumber: normId(col(s, 71, 79)),
      coverName: mapHealthCover(col(s, 128, 160)),
      coverNameRaw: cleanName(col(s, 128, 160))
    };
  }

  function parsePersonRecord(s, kind){
    const policyNumber = normPolicy(col(s, 9, 15));
    const idNumber = normId(col(s, 26, 34));
    if(!policyNumber && !idNumber) return null;
    const first = cleanName(col(s, 44, 70));
    const last = cleanName(kind === "SP" ? col(s, 71, 106) : col(s, 71, 106));
    const status = safeTrim(col(s, kind === "SP" ? 176 : 161, kind === "SP" ? 176 : 161));
    const phoneRaw = digits(col(s, 393, 403));
    let phone = phoneRaw;
    if(phone.length === 11 && phone.charAt(0) === "0") phone = phone.slice(0, 10);
    if(phone.length === 11 && phone.charAt(phone.length - 1) === "0") phone = phone.slice(0, 10);
    return {
      kind,
      policyNumber,
      agent: safeTrim(col(s, 19, 23)),
      idNumber,
      idNumber2: normId(col(s, 35, 43)),
      firstName: first,
      lastName: last,
      fullName: (first + " " + last).replace(/\s+/g, " ").trim(),
      house: safeTrim(col(s, 107, 108)),
      city: cleanName(col(s, 109, 123)),
      street: cleanName(col(s, 124, 128)),
      zip: safeTrim(col(s, 129, 133)),
      gender: safeTrim(col(s, 134, 134)),
      birthDate: dmy8(col(s, 137, 144)),
      startDate: dmy8(col(s, 153, 160)),
      occupation: kind === "SP" ? cleanName(col(s, 161, 175)) : "",
      status,
      productLabel: kind === "RP" ? cleanName(col(s, 404, 430)) : "",
      phone,
      period: digits(col(s, 345, 350)) || digits(col(s, 377, 382))
    };
  }

  function parseSbRecord(s){
    const policyNumber = normPolicy(col(s, 9, 15));
    if(!policyNumber) return null;
    const name = mapLifeCover(col(s, 128, 160));
    return {
      kind: "SB",
      policyNumber,
      coverCode: safeTrim(col(s, 16, 20)),
      startDate: dmy8(col(s, 23, 30)),
      premium: packedMoney(col(s, 37, 51), 7),
      idNumber: normId(col(s, 71, 79)),
      coverName: name,
      coverNameRaw: name
    };
  }

  function mapGender(raw){
    const t = safeTrim(raw).toLowerCase();
    if(t === "1" || t === "ז" || t === "m" || t === "male" || t === "זכר") return "זכר";
    if(t === "2" || t === "נ" || t === "f" || t === "female" || t === "נקבה") return "נקבה";
    return "";
  }

  function moneyOrEmpty(raw){
    const n = parseMoneyField(raw);
    return n > 0 ? money2(n) : "";
  }

  function parseMigdalPerson(parts){
    const idNumber = normId(parts[2] || parts[0]);
    if(!idNumber) return null;
    const last = cleanName(parts[24] || "");
    const first = cleanName(parts[25] || "");
    return {
      kind: "PERSON",
      idNumber,
      idNumber2: "",
      firstName: first,
      lastName: last,
      fullName: (first + " " + last).replace(/\s+/g, " ").trim(),
      city: cleanName(parts[16] || ""),
      street: cleanName(parts[15] || ""),
      email: safeTrim(parts[5] || ""),
      phone: safeTrim(parts[7] || ""),
      birthDate: dmy8(parts[26] || ""),
      occupation: cleanName(parts[4] || ""),
      gender: mapGender(parts[31] || ""),
      agent: safeTrim(parts[44] || ""),
      status: "",
      period: ""
    };
  }

  function parseMigdalCover(parts){
    const policyNumber = migdalPolicyNumber(parts[1]);
    if(!policyNumber) return null;
    const rawName = safeTrim(parts[19] || "");
    const familyGuess = /חיים|ריסק|משכנתא|מגדלור/.test(rawName) ? "life" : "health";
    return {
      kind: "COVRLIFE",
      policyNumber,
      coverCode: safeTrim(parts[0] || ""),
      startDate: dmy8(parts[4] || ""),
      endDate: dmy8(parts[5] || ""),
      premium: parseMoneyField(parts[9]),
      premiumListed: moneyOrEmpty(parts[8]),
      sumInsured: moneyOrEmpty(parts[7]),
      deductible: moneyOrEmpty(parts[10]),
      extraAmount: moneyOrEmpty(parts[11]),
      idNumber: normId(parts[18]),
      agent: safeTrim(parts[17] || ""),
      coverName: familyGuess === "life" ? mapLifeCover(rawName) : mapHealthCover(rawName),
      coverNameRaw: rawName,
      familyGuess
    };
  }

  function parseMigdalPolicyHeader(parts, kind){
    const policyNumber = migdalPolicyNumber(parts[8] || parts[10]);
    if(!policyNumber) return null;
    const headerPrem = kind === "LIFE" ? (parseMoneyField(parts[81]) || parseMoneyField(parts[52])) : parseMoneyField(parts[49]);
    const insuredCount = Number(digits(parts[2] || "")) || 0;
    return {
      kind,
      family: kind === "LIFE" ? "life" : "health",
      policyNumber,
      ownerId: normId(parts[9] || parts[11]),
      agent: safeTrim(parts[1] || parts[5] || ""),
      startDate: dmy8(parts[15] || ""),
      endDate: dmy8(parts[16] || ""),
      premiumMonthly: headerPrem,
      paymentPeriod: formatPaymentPeriod(parts[43] || ""),
      insuredCount: insuredCount >= 1 && insuredCount <= 20 ? insuredCount : 0,
      productLabelRaw: cleanName(parts[14] || "")
    };
  }

  function parseFileBuffer(fileName, buffer, opts){
    const cancelled = !!(opts && (opts.cancelled || opts.inactive));
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const namedMigdal = detectMigdalKindFromName(fileName);
    if(namedMigdal || looksLikeMigdalPipe(bytes)){
      const text = decodeUtf8Bytes(bytes);
      const recs = splitRecords(text);
      const kind = namedMigdal || detectMigdalKindFromRecord(recs[0] || "");
      const rows = [];
      recs.forEach((s) => {
        const parts = pipeFields(s);
        let row = null;
        if(kind === "PERSON") row = parseMigdalPerson(parts);
        else if(kind === "COVRLIFE") row = parseMigdalCover(parts);
        else if(kind === "LIFEHLTH" || kind === "LIFE") row = parseMigdalPolicyHeader(parts, kind);
        else if(kind === "AGENTS"){
          const agent = safeTrim(parts[0] || s);
          if(agent) row = { kind: "AGENTS", agent };
        } else if(kind === "COMPANY"){
          row = { kind: "COMPANY", companyId: safeTrim(parts[0] || ""), name: cleanName(parts[1] || "") };
        }
        if(row) rows.push(row);
      });
      return { fileName, kind, records: recs.length, rows, cancelled };
    }
    const text = decodeCp862(bytes);
    const recs = splitRecords(text);
    const rec0 = recs[0] || "";
    const namedMenora = detectMenoraKindFromName(fileName);
    const menoraKind = namedMenora || detectMenoraKindFromRecord(rec0);
    const menoraOk = menoraKind === "MENORA_TRFR"
      ? (namedMenora === "MENORA_TRFR" || looksLikeMenoraTrfr(rec0))
      : looksLikeMenoraRecord(rec0);
    if(menoraKind && (menoraOk || namedMenora === "MENORA_TRFR")){
      const rows = [];
      recs.forEach((s) => {
        let row = null;
        if(menoraKind === "MENORA_TRFR") row = parseMenoraTrfr(s);
        else if(menoraKind === "MENORA_M") row = parseMenoraM(s);
        else if(menoraKind === "MENORA_N") row = parseMenoraN(s);
        else if(menoraKind === "MENORA_G") row = parseMenoraG(s);
        else if(menoraKind === "MENORA_P") row = parseMenoraP(s);
        if(row){
          if(cancelled) row.cancelled = true;
          rows.push(row);
        }
      });
      return { fileName, kind: menoraKind, records: recs.length, rows, cancelled };
    }
    const namedClal = detectClalKindFromName(fileName);
    if(namedClal){
      const clalText = decodeClalBytes(bytes);
      const clalRecs = splitRecords(clalText);
      const rows = [];
      clalRecs.forEach((s) => {
        let row = null;
        if(namedClal === "CLAL_POL") row = parseClalPol(s);
        else if(namedClal === "CLAL_MEV") row = parseClalMev(s);
        else if(namedClal === "CLAL_TAR") row = parseClalTar(s);
        else if(namedClal === "CLAL_SGB") row = parseClalSgb(s);
        if(row){
          if(cancelled) row.cancelled = true;
          rows.push(row);
        }
      });
      return { fileName, kind: namedClal, records: clalRecs.length, rows, cancelled };
    }
    const kind = detectKind(fileName, rec0);
    const rows = [];
    recs.forEach((s) => {
      let row = null;
      if(kind === "RB") row = parseRbRecord(s);
      else if(kind === "RP" || kind === "SP") row = parsePersonRecord(s, kind);
      else if(kind === "SB") row = parseSbRecord(s);
      if(row) rows.push(row);
    });
    return { fileName, kind, records: recs.length, rows, cancelled };
  }

  function uniqueIds(people){
    const set = new Set();
    (people || []).forEach((p) => {
      if(p.idNumber && !/^0+$/.test(String(p.idNumber))) set.add(p.idNumber);
      if(p.idNumber2 && !/^0+$/.test(String(p.idNumber2))) set.add(p.idNumber2);
    });
    return Array.from(set);
  }

  function isActivePerson(p){
    const st = safeTrim(p.status);
    return !st || st === ACTIVE_STATUS;
  }

  function buildHachsharaPolicies(parsedFiles){
    const byKind = { RB: [], RP: [], SB: [], SP: [] };
    (parsedFiles || []).forEach((f) => {
      if(byKind[f.kind]) byKind[f.kind] = byKind[f.kind].concat(f.rows || []);
    });

    function group(people, covers, family){
      const map = new Map();
      function slot(num){
        const k = normPolicy(num);
        if(!k) return null;
        if(!map.has(k)) map.set(k, { policyNumber: k, family, people: [], covers: [] });
        return map.get(k);
      }
      people.forEach((p) => {
        const g = slot(p.policyNumber);
        if(g) g.people.push(p);
      });
      covers.forEach((c) => {
        const g = slot(c.policyNumber);
        if(g) g.covers.push(c);
      });
      return Array.from(map.values());
    }

    const health = group(byKind.RP, byKind.RB, "health");
    const life = group(byKind.SP, byKind.SB, "life");

    return health.concat(life).map((g) => {
      const people = g.people || [];
      const covers = g.covers || [];
      const activePeople = people.filter(isActivePerson);
      const primary = (activePeople[0] || people[0] || {});
      let type = "בריאות";
      if(g.family === "life"){
        type = isMortgageLife(covers) ? "ריסק משכנתא" : "ריסק";
      }
      const premium = covers.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);
      const startDate = primary.startDate || covers.find((c) => c.startDate)?.startDate || "";
      const coverPremiums = sumCoverPremiums(covers, g.family);
      const healthCovers = g.family === "health"
        ? Object.keys(coverPremiums)
        : [];
      const lifeCovers = g.family === "life"
        ? Object.keys(coverPremiums)
        : [];
      const inactive = people.length > 0 && activePeople.length === 0;
      return {
        company: COMPANY_HACHSHARA,
        type,
        family: g.family,
        policyNumber: g.policyNumber,
        premiumMonthly: premium ? premium.toFixed(2) : "",
        startDate,
        healthCovers,
        lifeCovers,
        coverPremiums,
        agentNumber: pickAgentNumber(activePeople.length ? activePeople : people),
        paymentPeriod: pickPaymentPeriod(activePeople.length ? activePeople : people),
        people,
        covers,
        ids: uniqueIds(people),
        primary,
        inactive,
        productLabel: primary.productLabel || (g.family === "life" ? type : "בריאות")
      };
    });
  }

  function buildMigdalPolicies(parsedFiles){
    const byKind = { LIFEHLTH: [], LIFE: [], COVRLIFE: [], PERSON: [] };
    (parsedFiles || []).forEach((f) => {
      if(byKind[f.kind]) byKind[f.kind] = byKind[f.kind].concat(f.rows || []);
    });

    const personsById = new Map();
    byKind.PERSON.forEach((p) => {
      if(p.idNumber && !personsById.has(p.idNumber)) personsById.set(p.idNumber, p);
    });

    const coversByPol = new Map();
    byKind.COVRLIFE.forEach((c) => {
      const k = c.policyNumber;
      if(!k) return;
      if(!coversByPol.has(k)) coversByPol.set(k, []);
      coversByPol.get(k).push(c);
    });

    function peopleFor(policyNumber, ownerId, covers){
      const people = [];
      const seen = new Set();
      function add(id, extra){
        const nid = normId(id);
        if(!nid || seen.has(nid)) return;
        seen.add(nid);
        const known = personsById.get(nid);
        if(known){
          people.push(Object.assign({}, known, { policyNumber }, extra || {}));
        } else {
          people.push(Object.assign({
            policyNumber,
            idNumber: nid,
            fullName: "",
            status: "",
            agent: "",
            period: ""
          }, extra || {}));
        }
      }
      add(ownerId);
      (covers || []).forEach((c) => add(c.idNumber, c.agent ? { agent: c.agent } : null));
      return people;
    }

    function finalize(header, family){
      const covers = (coversByPol.get(header.policyNumber) || []).map((c) => {
        const raw = c.coverNameRaw || c.coverName;
        const name = family === "life" ? mapLifeCover(raw) : mapHealthCover(raw);
        return Object.assign({}, c, { coverName: name });
      });
      coversByPol.delete(header.policyNumber);
      const people = peopleFor(header.policyNumber, header.ownerId, covers);
      people.forEach((p) => {
        if(!p.agent && header.agent) p.agent = header.agent;
        if(!p.period && header.paymentPeriod) p.period = header.paymentPeriod;
      });
      const activePeople = people.filter(isActivePerson);
      const primary = activePeople[0] || people[0] || {};
      let type = "בריאות";
      if(family === "life"){
        type = inferLifeProductType(covers);
      } else {
        type = inferHealthProductType(covers, Object.keys(sumCoverPremiums(covers, "health")));
      }
      const coverMonthly = covers.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);
      const coverBenefit = maxCoverBenefit(covers);
      let premiumMonthly = coverMonthly
        ? money2(coverMonthly)
        : (header.premiumMonthly ? money2(header.premiumMonthly) : "");
      let sumInsured = "";
      let compensation = "";
      if(family === "life"){
        const split = splitLifeMoney(header.premiumMonthly, coverMonthly, coverBenefit);
        premiumMonthly = split.premiumMonthly;
        sumInsured = split.sumInsured;
      } else {
        compensation = pickCompensation(type, covers);
      }
      const coverPremiums = sumCoverPremiums(covers, family);
      const peopleCount = (activePeople.length ? activePeople : people).length;
      return {
        company: COMPANY_MIGDAL,
        type,
        family,
        policyNumber: header.policyNumber,
        premiumMonthly,
        sumInsured,
        compensation,
        startDate: header.startDate || covers.find((c) => c.startDate)?.startDate || "",
        endDate: header.endDate || covers.find((c) => c.endDate)?.endDate || "",
        insuredCount: header.insuredCount || peopleCount || 0,
        coverDetails: covers.map(coverDetailFromRow),
        healthCovers: family === "health" ? Object.keys(coverPremiums) : [],
        lifeCovers: family === "life" ? Object.keys(coverPremiums) : [],
        coverPremiums,
        agentNumber: header.agent || pickAgentNumber(activePeople.length ? activePeople : people),
        paymentPeriod: header.paymentPeriod || pickPaymentPeriod(activePeople.length ? activePeople : people),
        people,
        covers,
        ids: uniqueIds(people),
        primary,
        inactive: false,
        productLabel: type,
        importSource: "migdal-production"
      };
    }

    const out = [];
    byKind.LIFEHLTH.forEach((h) => out.push(finalize(h, "health")));
    byKind.LIFE.forEach((h) => out.push(finalize(h, "life")));
    coversByPol.forEach((covers, policyNumber) => {
      const lifeish = covers.some((c) => c.familyGuess === "life" || /חיים|ריסק|משכנתא|מגדלור/.test(c.coverNameRaw || c.coverName || ""));
      out.push(finalize({
        policyNumber,
        ownerId: covers[0]?.idNumber || "",
        agent: covers[0]?.agent || "",
        startDate: covers[0]?.startDate || "",
        endDate: covers[0]?.endDate || "",
        insuredCount: 0,
        paymentPeriod: "",
        premiumMonthly: 0
      }, lifeish ? "life" : "health"));
    });
    return out;
  }

  function buildMenoraPolicies(parsedFiles){
    const byKind = { MENORA_M: [], MENORA_N: [], MENORA_G: [], MENORA_P: [], MENORA_TRFR: [] };
    const cancelledFiles = {};
    (parsedFiles || []).forEach((f) => {
      if(!byKind[f.kind]) return;
      byKind[f.kind] = byKind[f.kind].concat(f.rows || []);
      if(f.cancelled) cancelledFiles[f.kind] = true;
    });

    const catalog = {};
    byKind.MENORA_TRFR.forEach((t) => {
      if(t && t.code) catalog[t.code] = t;
    });

    const pByPol = new Map();
    byKind.MENORA_P.forEach((p) => {
      if(p.policyNumber && !pByPol.has(p.policyNumber)) pByPol.set(p.policyNumber, p);
    });
    const gByPol = new Map();
    byKind.MENORA_G.forEach((g) => {
      if(g.policyNumber) gByPol.set(g.policyNumber, g);
    });
    const mByPol = new Map();
    byKind.MENORA_M.forEach((m) => {
      if(m.policyNumber) mByPol.set(m.policyNumber, m);
    });
    const nByPol = new Map();
    byKind.MENORA_N.forEach((n) => {
      if(!n.policyNumber) return;
      if(!nByPol.has(n.policyNumber)) nByPol.set(n.policyNumber, []);
      nByPol.get(n.policyNumber).push(n);
    });

    const keys = new Set();
    nByPol.forEach((_v, k) => keys.add(k));
    mByPol.forEach((_v, k) => keys.add(k));

    const out = [];
    keys.forEach((pol) => {
      const header = mByPol.get(pol) || {};
      const g = gByPol.get(pol) || {};
      const person = pByPol.get(pol) || {};
      const ns = nByPol.get(pol) || [];
      const cancelled = !!(
        cancelledFiles.MENORA_M || cancelledFiles.MENORA_N || cancelledFiles.MENORA_G || cancelledFiles.MENORA_P
        || header.cancelled || g.cancelled || person.cancelled
        || ns.some((n) => n.cancelled)
      );

      const healthRows = [];
      const lifeRows = [];
      ns.forEach((n) => {
        const cat = catalog[n.productCode] || {};
        const desc = cat.desc || n.productCode || "";
        const cls = cat.class || "";
        const family = menoraCoverFamily(cls, desc);
        const mapped = family === "health" ? mapMenoraHealthCover(desc) : mapLifeCover(desc);
        const row = {
          kind: "MENORA_N",
          policyNumber: pol,
          coverCode: n.productCode,
          coverName: mapped || desc,
          coverNameRaw: desc,
          premium: n.premium,
          premiumAnnual: n.premiumAnnual,
          startDate: n.startDate,
          idNumber: n.idNumber || person.idNumber || header.idNumber,
          sumInsured: n.sumInsured ? money2(n.sumInsured) : "",
          familyGuess: family,
          class: cls
        };
        if(family === "health") healthRows.push(row);
        else lifeRows.push(row);
      });

      const covers = healthRows.concat(lifeRows);
      const hasHealth = healthRows.length > 0;
      const family = hasHealth ? "health" : "life";
      let type = "בריאות";
      if(family === "life") type = inferLifeProductType(lifeRows);
      else type = inferHealthProductType(healthRows, Object.keys(sumCoverPremiums(healthRows, "health")));

      const coverMonthly = covers.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);
      const premiumMonthly = (g.premiumMonthly != null && g.premiumMonthly > 0)
        ? money2(g.premiumMonthly)
        : (coverMonthly ? money2(coverMonthly) : "");

      const coverBenefit = maxCoverBenefit(covers.map((c) => ({ sumInsured: Number(c.sumInsured) || 0 })));
      let sumInsured = "";
      let compensation = "";
      if(family === "life"){
        const split = splitLifeMoney(g.premiumMonthly, coverMonthly, coverBenefit);
        sumInsured = split.sumInsured;
      } else {
        compensation = pickCompensation(type, covers);
      }

      const idNumber = person.idNumber || header.idNumber || (ns[0] && ns[0].idNumber) || "";
      const people = [];
      if(idNumber || person.fullName){
        people.push({
          kind: "MENORA_P",
          policyNumber: pol,
          idNumber: idNumber,
          idNumber2: "",
          firstName: person.firstName || "",
          lastName: person.lastName || "",
          fullName: person.fullName || "",
          birthDate: person.birthDate || (ns[0] && ns[0].birthDate) || "",
          gender: person.gender || "",
          city: person.city || "",
          street: person.street || "",
          house: person.house || "",
          agent: person.agent || header.agent || (ns[0] && ns[0].agent) || "",
          status: "",
          period: ""
        });
      }

      const dated = ns.filter((n) => n.startDate).sort((a, b) => String(a.startYm).localeCompare(String(b.startYm)));
      const startDate = (dated[0] && dated[0].startDate) || "";
      const healthPrem = sumCoverPremiums(healthRows, "health");
      const lifePrem = sumCoverPremiums(lifeRows, "life");
      const coverPremiums = Object.assign({}, healthPrem, lifePrem);
      const primary = people[0] || {};

      out.push({
        company: COMPANY_MENORA,
        type,
        family,
        policyNumber: normPolicy(pol),
        premiumMonthly,
        sumInsured,
        compensation,
        startDate,
        insuredCount: people.length,
        coverDetails: covers.map(coverDetailFromRow),
        healthCovers: Object.keys(healthPrem),
        lifeCovers: Object.keys(lifePrem),
        coverPremiums,
        agentNumber: header.agent || person.agent || (ns[0] && ns[0].agent) || pickAgentNumber(people),
        paymentPeriod: "",
        people,
        covers,
        ids: uniqueIds(people),
        primary,
        inactive: cancelled,
        productLabel: type,
        importSource: "menora-production"
      });
    });
    return out;
  }

  function buildClalPolicies(parsedFiles){
    const byKind = { CLAL_POL: [], CLAL_MEV: [], CLAL_TAR: [], CLAL_SGB: [] };
    const cancelledFiles = {};
    (parsedFiles || []).forEach((f) => {
      if(!byKind[f.kind]) return;
      byKind[f.kind] = byKind[f.kind].concat(f.rows || []);
      if(f.cancelled) cancelledFiles[f.kind] = true;
    });

    const catalog = {};
    byKind.CLAL_SGB.forEach((t) => {
      if(t && t.code) catalog[t.code] = t;
    });

    const mevKeys = new Set();
    byKind.CLAL_MEV.forEach((p) => {
      if(p.policyNumber) mevKeys.add(normPolicy(p.policyNumber));
    });

    function resolvePolKey(row){
      const primary = normPolicy(row.policyNumber);
      if(primary && mevKeys.has(primary)) return primary;
      const hints = row.policyHints || [];
      for(let i = 0; i < hints.length; i++){
        const h = normPolicy(hints[i]);
        if(h && mevKeys.has(h)) return h;
      }
      return primary;
    }

    const pByPol = new Map();
    byKind.CLAL_POL.forEach((p) => {
      const k = resolvePolKey(p);
      if(!k) return;
      p.policyNumber = k;
      if(!pByPol.has(k)) pByPol.set(k, p);
      else {
        const prev = pByPol.get(k);
        if(!prev.idNumber && p.idNumber) prev.idNumber = p.idNumber;
        if(!prev.idNumber2 && p.idNumber2) prev.idNumber2 = p.idNumber2;
        if(!(Number(prev.premium) > 0) && Number(p.premium) > 0) prev.premium = p.premium;
        if(!prev.sumInsured && p.sumInsured) prev.sumInsured = p.sumInsured;
      }
    });
    const peopleByPol = new Map();
    byKind.CLAL_MEV.forEach((p) => {
      const k = normPolicy(p.policyNumber);
      if(!k) return;
      if(!peopleByPol.has(k)) peopleByPol.set(k, []);
      peopleByPol.get(k).push(p);
    });
    const tarByPol = new Map();
    byKind.CLAL_TAR.forEach((c) => {
      const k = normPolicy(c.policyNumber);
      if(!k) return;
      if(!tarByPol.has(k)) tarByPol.set(k, []);
      tarByPol.get(k).push(c);
    });

    const keys = new Set();
    pByPol.forEach((_v, k) => keys.add(k));
    peopleByPol.forEach((_v, k) => keys.add(k));
    tarByPol.forEach((_v, k) => keys.add(k));

    const out = [];
    keys.forEach((pol) => {
      const header = pByPol.get(pol) || {};
      const people = (peopleByPol.get(pol) || []).slice();
      const tars = tarByPol.get(pol) || [];
      const cancelled = !!(cancelledFiles.CLAL_POL || cancelledFiles.CLAL_MEV || cancelledFiles.CLAL_TAR
        || header.cancelled || people.some((p) => p.cancelled) || tars.some((t) => t.cancelled));

      const ownerId = header.idNumber2 || header.idNumber || "";
      const extraId = header.idNumber && header.idNumber2 && header.idNumber !== header.idNumber2
        ? header.idNumber
        : "";
      if(people.length){
        if(!people[0].idNumber && ownerId) people[0].idNumber = ownerId;
          if(!people[0].idNumber2 && extraId && extraId !== people[0].idNumber) people[0].idNumber2 = extraId;
        if(people.length && !people[0].idNumber){
          const fromTar = (tars[0] && tars[0].idNumber) || "";
          if(fromTar) people[0].idNumber = fromTar;
        }
      } else if(ownerId || extraId){
        people.push({
          kind: "CLAL_MEV",
          policyNumber: pol,
          idNumber: ownerId || extraId,
          idNumber2: extraId && extraId !== ownerId ? extraId : "",
          firstName: "",
          lastName: "",
          fullName: "",
          agent: header.agent || "",
          status: "",
          period: ""
        });
      }

      const healthRows = [];
      const lifeRows = [];
      tars.forEach((t) => {
        const cat = resolveClalCoverCode(t.coverCodeRaw, catalog);
        const desc = (cat && cat.desc) || t.coverCodeRaw || "";
        const family = clalCoverFamily(desc, header.product, 0);
        const mapped = family === "health" ? mapHealthCover(desc) : mapLifeCover(desc);
        const row = {
          kind: "CLAL_TAR",
          policyNumber: pol,
          coverCode: (cat && cat.code) || t.coverCodeRaw,
          coverName: mapped || desc,
          coverNameRaw: desc,
          premium: t.premium,
          startDate: t.startDate,
          idNumber: t.idNumber || (people[0] && people[0].idNumber) || ownerId,
          familyGuess: family
        };
        if(family === "health") healthRows.push(row);
        else lifeRows.push(row);
      });

      const covers = healthRows.concat(lifeRows);
      const hasHealthCovers = healthRows.length > 0;
      const hasLifeCovers = lifeRows.length > 0;
      let family = header.familyHint || "health";
      if(hasHealthCovers) family = "health";
      else if(hasLifeCovers) family = "life";
      let type = "בריאות";
      if(family === "life") type = inferLifeProductType(lifeRows);
      else type = inferHealthProductType(healthRows, Object.keys(sumCoverPremiums(healthRows, "health")));

      const coverMonthly = covers.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);
      const headerPrem = Number(header.premium) || 0;
      const premiumMonthly = headerPrem > 0
        ? money2(headerPrem)
        : (coverMonthly ? money2(coverMonthly) : "");

      const coverBenefit = maxCoverBenefit(covers.map((c) => ({ sumInsured: Number(c.sumInsured) || 0 })));
      let sumInsured = "";
      let compensation = "";
      if(family === "life"){
        const split = splitLifeMoney(headerPrem, coverMonthly, coverBenefit || Number(header.sumInsured) || 0);
        sumInsured = split.sumInsured || header.sumInsured || "";
      } else {
        compensation = pickCompensation(type, covers);
      }

      const dated = tars.filter((t) => t.startDate);
      const startDate = (dated[0] && dated[0].startDate) || "";
      const healthPrem = sumCoverPremiums(healthRows, "health");
      const lifePrem = sumCoverPremiums(lifeRows, "life");
      const coverPremiums = Object.assign({}, healthPrem, lifePrem);
      const primary = people[0] || {};

      out.push({
        company: COMPANY_CLAL,
        type,
        family,
        policyNumber: normPolicy(pol),
        premiumMonthly,
        sumInsured,
        compensation,
        startDate,
        insuredCount: people.length,
        coverDetails: covers.map(coverDetailFromRow),
        healthCovers: Object.keys(healthPrem),
        lifeCovers: Object.keys(lifePrem),
        coverPremiums,
        agentNumber: header.agent || pickAgentNumber(people),
        paymentPeriod: "",
        people,
        covers,
        ids: uniqueIds(people),
        primary,
        inactive: cancelled,
        productLabel: type,
        importSource: "clal-production"
      });
    });
    return out;
  }

  function buildPolicies(parsedFiles, company){
    const files = parsedFiles || [];
    const hasClal = files.some((f) => f && CLAL_KIND_SET[f.kind]);
    const hasMenora = files.some((f) => f && MENORA_KIND_SET[f.kind]);
    const hasMigdal = files.some((f) => f && MIGDAL_KIND_SET[f.kind]);
    const hasHach = files.some((f) => f && (f.kind === "RB" || f.kind === "RP" || f.kind === "SB" || f.kind === "SP"));
    if(safeTrim(company) === COMPANY_CLAL || (hasClal && !hasMenora && !hasMigdal && !hasHach)){
      return buildClalPolicies(files);
    }
    if(safeTrim(company) === COMPANY_MENORA || (hasMenora && !hasMigdal && !hasHach)){
      return buildMenoraPolicies(files);
    }
    if(hasMigdal && !hasHach) return buildMigdalPolicies(files);
    if(safeTrim(company) === COMPANY_MIGDAL && hasMigdal) return buildMigdalPolicies(files);
    return buildHachsharaPolicies(files);
  }

  function sameCompany(a, b){
    const na = safeTrim(a);
    const nb = safeTrim(b);
    if(!na || !nb) return false;
    if(na === nb) return true;
    const aliases = {
      "הכשרה": "הכשרה",
      "ביטוח הכשרה": "הכשרה",
      "מגדל": "מגדל",
      "מגדל ביטוח": "מגדל",
      "מגדל חברה לביטוח": "מגדל",
      "מנורה": "מנורה",
      "מנורה מבטחים": "מנורה",
      "מנורה מבטחים ביטוח": "מנורה",
      "כלל": "כלל",
      "כלל ביטוח": "כלל",
      "ביטוח כלל": "כלל"
    };
    return !!(aliases[na] && aliases[nb] && aliases[na] === aliases[nb]);
  }

  function getNewPolicies(cust){
    const payload = cust?.payload && typeof cust.payload === "object" ? cust.payload : {};
    if(Array.isArray(payload.newPolicies) && payload.newPolicies.length) return payload.newPolicies;
    if(Array.isArray(payload?.operational?.newPolicies) && payload.operational.newPolicies.length){
      return payload.operational.newPolicies;
    }
    return [];
  }

  function seedNewPolicies(payload){
    const next = payload && typeof payload === "object" ? payload : {};
    if(Array.isArray(next.newPolicies) && next.newPolicies.length) return next;
    if(Array.isArray(next?.operational?.newPolicies) && next.operational.newPolicies.length){
      next.newPolicies = next.operational.newPolicies.slice();
      return next;
    }
    if(!Array.isArray(next.newPolicies)) next.newPolicies = [];
    return next;
  }

  function productFamily(type){
    const t = safeTrim(type);
    if(t === "ריסק" || t === "ריסק משכנתא") return "life";
    if(t === "בריאות" || t === "מחלות קשות" || t === "סרטן" || t === "מוות מתאונה" || t === "נכות מתאונה") return "health";
    return t || "";
  }

  function isProposalPolicy(p){
    return !normPolicy(p?.policyNumber);
  }

  function inferHealthProductType(covers, healthCovers){
    const names = [];
    (Array.isArray(healthCovers) ? healthCovers : []).forEach((k) => names.push(String(k || "")));
    (covers || []).forEach((c) => names.push(String(c?.coverName || c?.coverNameRaw || "")));
    const mapped = names.map(mapHealthCover).filter(Boolean);
    const blob = mapped.join(" ");
    const hasCancer = mapped.some((n) => n === "מזור לסרטן" || n === "סרטן") || /מזור\s*לסרטן/.test(blob);
    const hasCi = mapped.some((n) => n === "מחלות קשות" || n === "מזור מורחב")
      || /מחלות\s*קשות|מזור\s*מורחב/.test(blob);
    const hasCoreHealth = mapped.some((n) => (
      n === "השתלות וטיפולים מיוחדים מחוץ לישראל" ||
      n === "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל" ||
      n === "תרופות מחוץ לסל שירותי הבריאות" ||
      n === "ייעוץ ובדיקות" ||
      n === "משלים שב\"ן ללא השתתפות עצמית" ||
      n === "ניתוחים בישראל מהשקל הראשון" ||
      n === "ניתוחים בישראל מורחב" ||
      /השתל|ניתוח|תרופות|ייעוץ|שב.?ן|אמבולטור/.test(n)
    ));
    if(hasCoreHealth) return "בריאות";
    if(hasCi && !hasCancer) return "מחלות קשות";
    if(hasCancer && !hasCi) return "סרטן";
    if(hasCi) return "מחלות קשות";
    return "בריאות";
  }

  function typeSpecificity(type){
    const t = safeTrim(type);
    if(t === "מחלות קשות" || t === "סרטן" || t === "ריסק משכנתא" || t === "מוות מתאונה" || t === "נכות מתאונה") return 2;
    if(t === "בריאות" || t === "ריסק") return 1;
    return 0;
  }

  function preferredPolicyType(existing, incoming){
    const a = safeTrim(existing);
    const b = safeTrim(incoming);
    if(a && b && productFamily(a) === productFamily(b) && typeSpecificity(a) > typeSpecificity(b)) return a;
    return b || a;
  }

  function canReplaceProposal(existingType, incomingType){
    const a = safeTrim(existingType);
    const b = safeTrim(incomingType);
    if(!a || !b) return true;
    if(a === b) return true;
    if(productFamily(a) !== productFamily(b)) return false;
    if(typeSpecificity(a) >= 2 && typeSpecificity(b) >= 2) return false;
    return true;
  }

  function matchExistingPolicy(cust, company, type, policyNumber){
    const list = getNewPolicies(cust);
    const sameCo = list.filter((p) => sameCompany(p?.company, company));
    const num = normPolicy(policyNumber);
    if(num){
      const hit = sameCo.find((p) => normPolicy(p?.policyNumber) === num);
      if(hit) return { action: "update", policy: hit, reason: "מספר פוליסה זהה" };
    }
    const sameType = sameCo.filter((p) => safeTrim(p?.type) === safeTrim(type));
    const sameTypeOffers = sameType.filter(isProposalPolicy);
    if(sameTypeOffers.length === 1){
      return { action: "update", policy: sameTypeOffers[0], reason: "הצעה מאותו סוג הוחלפה בפוליסה שהופקה" };
    }
    const fam = productFamily(type);
    const familyOffers = sameCo.filter((p) => productFamily(p?.type) === fam && isProposalPolicy(p));
    if(familyOffers.length === 1 && canReplaceProposal(familyOffers[0]?.type, type)){
      return { action: "update", policy: familyOffers[0], reason: "הצעה בתיק הוחלפה בפוליסה שהופקה" };
    }
    if(sameType.length === 1) return { action: "update", policy: sameType[0], reason: "פוליסה יחידה מאותו סוג" };
    if(!sameType.length && (familyOffers.length === 0 || (familyOffers.length === 1 && !canReplaceProposal(familyOffers[0]?.type, type)))){
      return { action: "create", policy: null, reason: "אין פוליסה מהסוג הזה בתיק" };
    }
    if(familyOffers.length > 1){
      return { action: "review", policy: null, reason: "כמה הצעות מאותה משפחה בלי מספר ברור", candidates: familyOffers };
    }
    return { action: "review", policy: null, reason: "כמה פוליסות מאותו סוג בלי מספר ברור", candidates: sameType };
  }

  function classifyPolicies(policies, customersById){
    return (policies || []).map((pol) => {
      if(pol.inactive){
        return Object.assign({}, pol, {
          category: "inactive",
          action: "skip",
          reason: "סטטוס לא פעיל בדוח",
          customer: null
        });
      }
      const found = [];
      const seen = new Set();
      (pol.ids || []).forEach((id) => {
        const c = customersById.get(id);
        if(c && !seen.has(c.id)){
          seen.add(c.id);
          found.push(c);
        }
      });
      if(!found.length){
        return Object.assign({}, pol, {
          category: "unmatched",
          action: "skip",
          reason: "לא נמצא תיק לפי ת״ז — טענו קודם דוח לקוחות",
          customer: null
        });
      }

      let chosen = null;
      let match = null;
      for(let i = 0; i < found.length; i++){
        const m = matchExistingPolicy(found[i], pol.company, pol.type, pol.policyNumber);
        if(m.action === "update"){
          chosen = found[i];
          match = m;
          break;
        }
      }
      if(!chosen){
        if(found.length > 1){
          return Object.assign({}, pol, {
            category: "review",
            action: "skip",
            reason: "כמה תיקים לאותם מבוטחים — יש לבחור ידנית",
            customer: null,
            candidates: found
          });
        }
        chosen = found[0];
        match = matchExistingPolicy(chosen, pol.company, pol.type, pol.policyNumber);
      }
      if(match.action === "review"){
        return Object.assign({}, pol, {
          category: "review",
          action: "skip",
          reason: match.reason,
          customer: chosen,
          policyId: null
        });
      }
      return Object.assign({}, pol, {
        category: match.action === "update" ? "update" : "create",
        action: match.action === "update" ? "update" : "create",
        reason: match.reason,
        customer: chosen,
        policyId: match.policy ? match.policy.id : null
      });
    });
  }

  function insuredIdForTz(payload, tz){
    const idn = normId(tz);
    if(!idn) return "";
    const insureds = Array.isArray(payload?.insureds) ? payload.insureds : [];
    for(let i = 0; i < insureds.length; i++){
      const ins = insureds[i];
      if(normId(ins?.data?.idNumber || ins?.idNumber) === idn && ins?.id) return ins.id;
    }
    return "";
  }

  function insuredIdsForCustomer(cust, people){
    const payload = cust?.payload && typeof cust.payload === "object" ? cust.payload : {};
    const insureds = Array.isArray(payload.insureds) ? payload.insureds : [];
    const ids = [];
    const seen = new Set();
    const active = (people || []).filter(isActivePerson);
    const source = active.length ? active : (people || []);
    source.forEach((p) => {
      const hit = insuredIdForTz(payload, p?.idNumber) || insuredIdForTz(payload, p?.idNumber2);
      if(hit && !seen.has(hit)){
        seen.add(hit);
        ids.push(hit);
      }
    });
    if(!ids.length && insureds[0]?.id && source.length <= 1) ids.push(insureds[0].id);
    return ids;
  }

  function premiumPerInsuredFromItem(payload, item){
    const map = {};
    (item.covers || []).forEach((c) => {
      const iid = insuredIdForTz(payload, c?.idNumber);
      if(!iid) return;
      const prem = Number(c.premium) || 0;
      map[iid] = Math.round(((Number(map[iid]) || 0) + prem) * 100) / 100;
    });
    if(!Object.keys(map).length){
      const ids = Array.isArray(item.insuredIds) ? item.insuredIds.filter(Boolean) : [];
      const total = Number(item.premiumMonthly) || 0;
      if(ids.length === 1 && total){
        map[ids[0]] = total;
      } else if(ids.length > 1 && total){
        const each = Math.round((total / ids.length) * 100) / 100;
        ids.forEach((id, i) => {
          map[id] = i === ids.length - 1
            ? Math.round((total - each * (ids.length - 1)) * 100) / 100
            : each;
        });
      }
    }
    const str = {};
    Object.keys(map).forEach((k) => { str[k] = money2(map[k]) || String(map[k]); });
    return str;
  }

  function applyCompanyAgentNumber(payload, item){
    const num = safeTrim(item?.agentNumber);
    if(!num) return;
    const key = safeTrim(item?.company) || COMPANY_HACHSHARA;
    if(!payload.companyAgentNumbers || typeof payload.companyAgentNumbers !== "object") payload.companyAgentNumbers = {};
    if(!safeTrim(payload.companyAgentNumbers[key])) payload.companyAgentNumbers[key] = num;
    if(payload.operational && typeof payload.operational === "object"){
      if(!payload.operational.companyAgentNumbers || typeof payload.operational.companyAgentNumbers !== "object"){
        payload.operational.companyAgentNumbers = {};
      }
      if(!safeTrim(payload.operational.companyAgentNumbers[key])) payload.operational.companyAgentNumbers[key] = num;
    }
  }

  function findPolicyToUpdate(list, item){
    const rows = Array.isArray(list) ? list : [];
    const byId = safeTrim(item?.policyId)
      ? rows.find((x) => safeTrim(x?.id) === safeTrim(item.policyId))
      : null;
    if(byId) return byId;
    const num = normPolicy(item?.policyNumber);
    if(num){
      const byNum = rows.find((x) => sameCompany(x?.company, item.company) && normPolicy(x?.policyNumber) === num);
      if(byNum) return byNum;
    }
    const sameType = rows.filter((x) => sameCompany(x?.company, item.company) && safeTrim(x?.type) === safeTrim(item?.type));
    if(sameType.length === 1) return sameType[0];
    const fam = productFamily(item?.type);
    const familyOffers = rows.filter((x) => sameCompany(x?.company, item.company) && productFamily(x?.type) === fam && isProposalPolicy(x) && canReplaceProposal(x?.type, item?.type));
    return familyOffers.length === 1 ? familyOffers[0] : null;
  }

  function mergeCoverList(existing, incoming, mapper){
    const set = [];
    (Array.isArray(existing) ? existing : []).concat(Array.isArray(incoming) ? incoming : []).forEach((k) => {
      const t = mapper(k);
      if(t && set.indexOf(t) === -1) set.push(t);
    });
    return set;
  }

  function absorbRelatedProposals(list, target, item){
    const rows = Array.isArray(list) ? list : [];
    if(!target) return rows;
    const fam = productFamily(item?.type || target.type);
    const kept = [];
    rows.forEach((p) => {
      if(p === target){
        kept.push(p);
        return;
      }
      const relatedOffer = sameCompany(p?.company, target.company)
        && productFamily(p?.type) === fam
        && isProposalPolicy(p)
        && safeTrim(p?.id) !== safeTrim(target.id)
        && canReplaceProposal(p?.type, item?.type || target.type);
      if(!relatedOffer){
        kept.push(p);
        return;
      }
      target.type = preferredPolicyType(p.type, target.type);
      if(fam === "health"){
        target.healthCovers = mergeCoverList(target.healthCovers, p.healthCovers, mapHealthCover);
      }
      if(safeTrim(p?._addedAt) && !safeTrim(target._addedAt)) target._addedAt = p._addedAt;
    });
    return kept;
  }

  function coverDetailFromRow(c){
    const name = safeTrim(c?.coverName || c?.name);
    return {
      name,
      startDate: safeTrim(c?.startDate),
      endDate: safeTrim(c?.endDate),
      premiumMonthly: c?.premium ? money2(c.premium) : safeTrim(c?.premiumMonthly),
      premiumListed: safeTrim(c?.premiumListed),
      sumInsured: safeTrim(c?.sumInsured),
      deductible: safeTrim(c?.deductible),
      extraAmount: safeTrim(c?.extraAmount)
    };
  }

  function fillEmpty(target, key, value){
    const next = safeTrim(value);
    if(!next) return;
    if(!safeTrim(target[key])) target[key] = next;
  }

  function fillInsuredData(data, person){
    const d = data && typeof data === "object" ? data : {};
    fillEmpty(d, "firstName", person?.firstName);
    fillEmpty(d, "lastName", person?.lastName);
    fillEmpty(d, "idNumber", person?.idNumber);
    fillEmpty(d, "email", person?.email);
    fillEmpty(d, "phone", person?.phone);
    fillEmpty(d, "city", person?.city);
    fillEmpty(d, "street", person?.street);
    fillEmpty(d, "houseNumber", person?.house);
    fillEmpty(d, "zip", person?.zip);
    fillEmpty(d, "birthDate", person?.birthDate);
    fillEmpty(d, "occupation", person?.occupation);
    fillEmpty(d, "gender", person?.gender || mapGender(person?.gender));
    return d;
  }

  function ensureInsuredsFromPeople(payload, people){
    if(!Array.isArray(payload.insureds)) payload.insureds = [];
    const source = (people || []).filter((p) => normId(p?.idNumber));
    source.forEach((person) => {
      const existingId = insuredIdForTz(payload, person.idNumber);
      if(existingId){
        const row = payload.insureds.find((x) => safeTrim(x?.id) === existingId);
        if(row){
          row.data = fillInsuredData(row.data || {}, person);
        }
        return;
      }
      const hasPrimary = payload.insureds.some((x) => safeTrim(x?.type) === "primary");
      const created = {
        id: "ins_prod_" + normId(person.idNumber),
        type: hasPrimary ? (payload.insureds.some((x) => safeTrim(x?.type) === "spouse") ? "adult" : "spouse") : "primary",
        label: hasPrimary ? (payload.insureds.some((x) => safeTrim(x?.type) === "spouse") ? "מבוטח נוסף" : "בת/בן זוג") : "מבוטח ראשי",
        data: fillInsuredData({
          firstName: "", lastName: "", idNumber: "", birthDate: "", gender: "",
          phone: "", email: "", city: "", street: "", houseNumber: "", zip: "", occupation: ""
        }, person)
      };
      payload.insureds.push(created);
    });
    return payload;
  }

  function mergeCoverDetails(existing, incoming){
    const byName = new Map();
    (Array.isArray(existing) ? existing : []).concat(Array.isArray(incoming) ? incoming : []).forEach((row) => {
      const name = safeTrim(row?.name);
      if(!name) return;
      const prev = byName.get(name) || { name };
      byName.set(name, {
        name,
        startDate: safeTrim(row.startDate) || prev.startDate || "",
        endDate: safeTrim(row.endDate) || prev.endDate || "",
        premiumMonthly: safeTrim(row.premiumMonthly) || prev.premiumMonthly || "",
        premiumListed: safeTrim(row.premiumListed) || prev.premiumListed || "",
        sumInsured: safeTrim(row.sumInsured) || prev.sumInsured || "",
        deductible: safeTrim(row.deductible) || prev.deductible || "",
        extraAmount: safeTrim(row.extraAmount) || prev.extraAmount || ""
      });
    });
    return Array.from(byName.values());
  }

  function asMoneyNum(v){
    return Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, "")) || 0;
  }

  function relocateMisreadLifePremium(p){
    const t = safeTrim(p?.type);
    if(t !== "ריסק" && t !== "ריסק משכנתא") return p;
    const prem = asMoneyNum(p?.premiumMonthly || p?.monthlyPremium);
    if(prem >= 10000){
      if(!asMoneyNum(p.sumInsured)) p.sumInsured = money2(prem);
      p.premiumMonthly = "";
      if(asMoneyNum(p.monthlyPremium) >= 10000) p.monthlyPremium = "";
    }
    if(p.premiumPerInsured && typeof p.premiumPerInsured === "object"){
      Object.keys(p.premiumPerInsured).forEach((k) => {
        if(asMoneyNum(p.premiumPerInsured[k]) >= 10000) p.premiumPerInsured[k] = "";
      });
    }
    if(p.productionCoverPremiums && typeof p.productionCoverPremiums === "object"){
      Object.keys(p.productionCoverPremiums).forEach((k) => {
        if(asMoneyNum(p.productionCoverPremiums[k]) >= 10000) p.productionCoverPremiums[k] = "";
      });
    }
    if(!safeTrim(p.premiumMonthly) && p.premiumPerInsured && typeof p.premiumPerInsured === "object"){
      const small = [];
      Object.keys(p.premiumPerInsured).forEach((k) => {
        const n = asMoneyNum(p.premiumPerInsured[k]);
        if(n > 0 && n < 10000) small.push(n);
      });
      const uniq = Array.from(new Set(small));
      if(uniq.length === 1) p.premiumMonthly = money2(uniq[0]);
    }
    return p;
  }

  function sanitizeCustomerPolicies(payload){
    if(!payload || typeof payload !== "object") return false;
    let changed = false;
    function snap(p){
      return [
        safeTrim(p?.premiumMonthly),
        safeTrim(p?.monthlyPremium),
        safeTrim(p?.sumInsured),
        JSON.stringify(p?.premiumPerInsured || {}),
        JSON.stringify(p?.productionCoverPremiums || {})
      ].join("|");
    }
    function touch(list){
      (Array.isArray(list) ? list : []).forEach((p) => {
        if(!p || typeof p !== "object") return;
        const t = safeTrim(p.type);
        if(t !== "ריסק" && t !== "ריסק משכנתא") return;
        const before = snap(p);
        relocateMisreadLifePremium(p);
        if(snap(p) !== before) changed = true;
      });
    }
    touch(payload.newPolicies);
    if(payload.operational && typeof payload.operational === "object") touch(payload.operational.newPolicies);
    (Array.isArray(payload.insureds) ? payload.insureds : []).forEach((ins) => {
      touch(ins?.data?.existingPolicies);
    });
    (Array.isArray(payload.operational?.insureds) ? payload.operational.insureds : []).forEach((ins) => {
      touch(ins?.data?.existingPolicies);
    });
    return changed;
  }

  function applyPolicyFields(p, item, meta, payload){
    p.policyNumber = item.policyNumber || p.policyNumber;
    if(item.type) p.type = preferredPolicyType(p.type, item.type);
    const incomingPrem = safeTrim(item.premiumMonthly);
    if(incomingPrem) p.premiumMonthly = incomingPrem;
    else if(safeTrim(item.sumInsured) && (isBenefitLike(p.premiumMonthly) || Number(p.premiumMonthly) === Number(item.sumInsured))){
      p.premiumMonthly = "";
    }
    if(item.startDate) p.startDate = item.startDate;
    if(item.endDate) p.endDate = item.endDate;
    if(Number(item.insuredCount) > 0) p.insuredCount = Number(item.insuredCount);
    const insuredIds = Array.isArray(item.insuredIds) ? item.insuredIds.filter(Boolean) : [];
    if(insuredIds.length){
      p.insuredIds = insuredIds.slice();
      p.insuredId = insuredIds[0] || "";
      p.insuredMode = insuredIds.length > 1 ? "multi" : "single";
    }
    const coverPrem = (item.coverPremiums && typeof item.coverPremiums === "object")
      ? item.coverPremiums
      : sumCoverPremiums(item.covers || [], item.family || (item.type === "בריאות" ? "health" : "life"));
    if(Object.keys(coverPrem).length){
      p.productionCoverPremiums = coverPrem;
    }
    const incomingDetails = Array.isArray(item.coverDetails) && item.coverDetails.length
      ? item.coverDetails
      : (item.covers || []).map(coverDetailFromRow);
    if(incomingDetails.length){
      p.productionCoverDetails = mergeCoverDetails(p.productionCoverDetails, incomingDetails);
    }
    if(productFamily(item.type || p.type) === "health"){
      const incoming = item.healthCovers || Object.keys(coverPrem);
      const set = mergeCoverList(p.healthCovers, incoming, mapHealthCover);
      if(set.length) p.healthCovers = set;
    }
    if(item.family === "life" || item.type === "ריסק" || item.type === "ריסק משכנתא" || (item.lifeCovers && item.lifeCovers.length)){
      const set = [];
      (Array.isArray(p.lifeCovers) ? p.lifeCovers : []).concat(item.lifeCovers || []).forEach((k) => {
        const t = mapLifeCover(k);
        if(t && set.indexOf(t) === -1) set.push(t);
      });
      if(set.length) p.lifeCovers = set;
    }
    const perIns = premiumPerInsuredFromItem(payload, item);
    if(Object.keys(perIns).length) p.premiumPerInsured = perIns;
    if(safeTrim(item.agentNumber)) p.agentNumber = safeTrim(item.agentNumber);
    if(safeTrim(item.paymentPeriod)) p.paymentPeriod = safeTrim(item.paymentPeriod);
    const finalType = safeTrim(p.type || item.type);
    const coversForBenefit = incomingDetails.length ? incomingDetails : (item.covers || []);
    if(finalType === "מחלות קשות" || finalType === "סרטן"){
      const amt = safeTrim(item.compensation) || pickCompensation(finalType, coversForBenefit);
      if(amt){
        p.compensation = amt;
        const per = {};
        (item.covers || []).forEach((c) => {
          const iid = insuredIdForTz(payload, c?.idNumber);
          const n = Number(c?.sumInsured) || 0;
          if(iid && n >= 1000) per[iid] = money2(Math.max(Number(per[iid]) || 0, n));
        });
        if(!Object.keys(per).length && insuredIds.length === 1) per[insuredIds[0]] = amt;
        if(Object.keys(per).length) p.compensationPerInsured = Object.assign({}, p.compensationPerInsured || {}, per);
      }
    }
    if(finalType === "ריסק" || finalType === "ריסק משכנתא"){
      const amt = safeTrim(item.sumInsured) || (isBenefitLike(maxCoverBenefit(coversForBenefit)) ? money2(maxCoverBenefit(coversForBenefit)) : "");
      if(amt){
        p.sumInsured = amt;
        if(insuredIds.length === 1){
          if(!p.sumInsuredPerInsured || typeof p.sumInsuredPerInsured !== "object") p.sumInsuredPerInsured = {};
          if(!safeTrim(p.sumInsuredPerInsured[insuredIds[0]])) p.sumInsuredPerInsured[insuredIds[0]] = amt;
        }
      }
    }
    p.productionImport = meta;
    relocateMisreadLifePremium(p);
    return p;
  }

  function applyToPayload(payload, item){
    const next = seedNewPolicies(payload && typeof payload === "object" ? payload : {});
    ensureInsuredsFromPeople(next, item.people || []);
    const insuredIds = item.insuredIds || insuredIdsForCustomer({ payload: next }, item.people || []);
    item.insuredIds = insuredIds;
    const meta = {
      company: item.company,
      policyNumber: item.policyNumber,
      importedAt: nowISO(),
      source: item.importSource || (item.company === COMPANY_MIGDAL ? "migdal-production" : item.company === COMPANY_MENORA ? "menora-production" : item.company === COMPANY_CLAL ? "clal-production" : "hachshara-production"),
      coverCount: (item.covers || []).length,
      personCount: (item.people || []).length,
      agentNumber: safeTrim(item.agentNumber),
      paymentPeriod: safeTrim(item.paymentPeriod)
    };
    let target = item.action === "update" ? findPolicyToUpdate(next.newPolicies, item) : null;
    if(!target && productFamily(item.type) === "health"){
      const familyOffers = next.newPolicies.filter((x) => sameCompany(x?.company, item.company) && productFamily(x?.type) === "health" && isProposalPolicy(x) && canReplaceProposal(x?.type, item.type));
      if(familyOffers.length === 1) target = familyOffers[0];
    }
    if(target){
      applyPolicyFields(target, item, meta, next);
    } else {
      const created = {
        id: "npol_prod_" + item.policyNumber + "_" + Math.random().toString(16).slice(2, 8),
        company: item.company,
        type: item.type,
        policyNumber: item.policyNumber,
        premiumMonthly: item.premiumMonthly || "",
        startDate: item.startDate || "",
        endDate: item.endDate || "",
        insuredCount: Number(item.insuredCount) || insuredIds.length || 0,
        healthCovers: productFamily(item.type) === "health" ? (item.healthCovers || []).map(mapHealthCover).filter(Boolean) : [],
        insuredIds: insuredIds.slice(),
        insuredId: insuredIds[0] || "",
        insuredMode: insuredIds.length > 1 ? "multi" : "single",
        discountPct: "0"
      };
      applyPolicyFields(created, item, meta, next);
      next.newPolicies.push(created);
      target = created;
    }
    next.newPolicies = absorbRelatedProposals(next.newPolicies, target, item);
    if(target && insuredIds.length && Number(target.insuredCount || 0) < insuredIds.length){
      target.insuredCount = insuredIds.length;
    }
    applyCompanyAgentNumber(next, item);
    if(!next.operational || typeof next.operational !== "object") next.operational = {};
    next.operational.newPolicies = next.newPolicies;
    return next;
  }

  global.GI_PRODUCTION = {
    version: "20260827-clal-exe-zip-v1",
    relocateMisreadLifePremium,
    sanitizeCustomerPolicies,
    COMPANIES,
    COMPANY_HACHSHARA,
    COMPANY_MIGDAL,
    COMPANY_MENORA,
    COMPANY_CLAL,
    parseFileBuffer,
    detectKind,
    detectMigdalKindFromName,
    detectMenoraKindFromName,
    detectClalKindFromName,
    findEmbeddedZipOffset,
    migdalPolicyNumber,
    buildPolicies,
    classifyPolicies,
    matchExistingPolicy,
    productFamily,
    inferHealthProductType,
    inferLifeProductType,
    splitLifeMoney,
    pickCompensation,
    insuredIdsForCustomer,
    applyToPayload,
    sameCompany,
    mapHealthCover,
    mapLifeCover,
    formatPaymentPeriod,
    fixVisualHebrew,
    normId,
    normPolicy,
    uniqueIds
  };
})(typeof window !== "undefined" ? window : this);
