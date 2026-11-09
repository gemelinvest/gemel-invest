/* GEMEL INVEST — ייבוא דוח פרודוקציה (GI-PROD 2026-08-27)
   נטען לפי דרישה ממסך טעינת קבצי מערכת.
   הכשרה: קבצי רוחב-קבוע IBM862 (RB/RP/SB/SP).
   מגדל: קבצי MBT מופרדי-צינור UTF-8 (LIFEHLTH/LIFE/COVRLIFE/PERSON).
   מנורה: חיים פרודוקציה ישן — M/N/G/P.TXT + TRFR.ALL (IBM862), ZIP פרט (MP) / מבוטלות (MM).
   כלל: תיבת EXE/ZIP של אפקס — POL/MEV/TAR/SGB (Windows-1255 או IBM862).
   איילון: קבצי רוחב-קבוע Windows-1255 — m41, m43, m45, m46, m47, m48, m50, m58, m70, m72.
*/
(function installGiProduction(global){
  "use strict";

  const CP862_HE = "אבגדהוזחטיךכלםמןנסעףפץצקרשת";
  const CP1255_HE = "אבגדהוזחטיךכלםמןנסעףפץצקרשת";
  const COMPANY_HACHSHARA = "הכשרה";
  const COMPANY_MIGDAL = "מגדל";
  const COMPANY_MENORA = "מנורה";
  const COMPANY_CLAL = "כלל";
  const COMPANY_PHOENIX = "הפניקס";
  const COMPANY_AYALON = "איילון";
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
  const AYALON_KIND_SET = Object.freeze({
    AYALON_M41: true,
    AYALON_M43: true,
    AYALON_M45: true,
    AYALON_M46: true,
    AYALON_M47: true,
    AYALON_M48: true,
    AYALON_M50: true,
    AYALON_M58: true,
    AYALON_M70: true,
    AYALON_M72: true
  });
  const AYALON_STATUS = Object.freeze({
    "21": { label: "פעילה", inactive: false },
    "31": { label: "פעילה", inactive: false },
    "41": { label: "מסולקת", inactive: false },
    "51": { label: "מסולקת", inactive: false },
    "59": { label: "מסולקת", inactive: false }
  });
  const AYALON_FREQ = Object.freeze({
    "01": { label: "שנתי", months: 12 },
    "02": { label: "חצי שנתי", months: 6 },
    "03": { label: "רבעוני", months: 3 },
    "04": { label: "חודשי", months: 1 },
    "08": { label: "מסולק", months: 0 },
    "09": { label: "חד-פעמי", months: 0 }
  });
  const AYALON_FRAME = Object.freeze({
    "01": "פרט",
    "02": "תגמולים לעצמאיים",
    "03": "מנהלים",
    "04": "בעלי שליטה",
    "05": "אנשי מפתח",
    "06": "פרט מנהלים לשעבר",
    "07": "תגמולים מנהלים לשעבר"
  });
  const AYALON_INS = Object.freeze({
    "01": "חיים",
    "02": "מעורב",
    "03": "ריסק",
    "04": "גמלה",
    "05": "חיסכון",
    "06": "שלב",
    "07": "נכות",
    "08": "תאונה",
    "09": "מחלה",
    "10": "בריאות",
    "11": "אשפוז",
    "12": "סיעוד"
  });

  const COMPANIES = Object.freeze([
    { id: COMPANY_HACHSHARA, label: "הכשרה", ready: true, hint: "קבצי RB, RP, SB, SP (בלי סיומת)", dropHint: "הכשרה: RB (כיסויי בריאות), RP (מבוטחי בריאות), SB (כיסויי חיים), SP (מבוטחי חיים). אפשר כמה יחד." },
    { id: "הפניקס", label: "הפניקס", ready: true, hint: "קובץ MU ללא סיומת (רשומות 01, 02, 04, 09, 19)", dropHint: "הפניקס: קובץ פרודוקציה בלי סיומת, למשל MU_SC_…. חודש חדש מחליף את שורות הפרודוקציה של אותה פוליסה." },
    { id: COMPANY_MIGDAL, label: "מגדל", ready: true, hint: "קבצי LIFEHLTH, LIFE, COVRLIFE, PERSON (.MBT)", dropHint: "מגדל: LIFEHLTH (בריאות), LIFE (חיים), COVRLIFE (כיסויים), PERSON (מבוטחים). אפשר גם AGENTS / COMPANY." },
    { id: COMPANY_MENORA, label: "מנורה", ready: true, hint: "קבצי M, N, G, P + TRFR (RAR / ARJ / ZIP פרט או מבוטלות)", dropHint: "מנורה: RAR, או ARJ שהוא בעצם ZIP, של פרט (MP) או מבוטלות (MM). אפשר גם ZIP, או קבצי ‎*M.TXT / *N.TXT / *G.TXT / *P.TXT ו־TRFR.ALL. פרט נשמר בלשונית פרודוקציה. מבוטלות לא נכנסות כפוליסות פעילות." },
    { id: COMPANY_CLAL, label: "כלל", ready: true, hint: "תיבת EXE / ZIP של אפקס (POL, MEV, TAR, SGB)", dropHint: "כלל: תיבת EXE או ZIP של אפקס חיים / אפקס בריאות, או קבצי POL, MEV, TAR, SGB. ממשק אחזקות לא נטען כאן." },
    { id: COMPANY_AYALON, label: "איילון", ready: true, hint: "קבצי m41, m43, m45, m46, m47, m48, m50, m58, m70, m72", dropHint: "איילון: m41 (תמצית), m48 (מבוטחים), m43 (כיסויים), m50 (תעריפים), m45 (ילדים), m70 (סכומים ממודדים), m46 (פדיון), m47 (גבייה), m58 (יתרה), m72 (מסלולים). אפשר לגרור את כולם יחד." }
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
  function splitPolicyNumber(raw){
    const policyNumberFull = digits(raw);
    return { policyNumber: normPolicy(policyNumberFull), policyNumberFull };
  }
  function shownPolicyNumber(item){
    const full = digits(item && item.policyNumberFull);
    if(full) return full;
    const raw = digits(item && item.policyNumber);
    return raw || safeTrim(item && item.policyNumber);
  }
  function productionMatchKey(item){
    const keyed = safeTrim(item && item.policyMatchKey);
    if(keyed) return keyed;
    return normPolicy(item && item.policyNumber);
  }
  /** ת״ז שנגזרה ממספר פוליסה (חפיפת שדות באפקס חיים) — לא לשיוך תיק. */
  function idOverlapsPolicy(id, policyNumber, hints){
    const nRaw = digits(id);
    const n = nRaw.replace(/^0+/, "") || nRaw;
    if(!n) return true;
    const list = [policyNumber].concat(Array.isArray(hints) ? hints : []);
    for(let i = 0; i < list.length; i++){
      const pRaw = digits(list[i]);
      const p = pRaw.replace(/^0+/, "") || pRaw;
      if(!p) continue;
      if(n === p) return true;
      if(n.length >= 7 && p.length >= 7 && Math.abs(n.length - p.length) <= 1){
        if(n.length === p.length + 1 && (n.slice(0, p.length) === p || n.slice(1) === p)) return true;
        if(p.length === n.length + 1 && (p.slice(0, n.length) === n || p.slice(1) === n)) return true;
      }
    }
    return false;
  }
  function isValidIsraeliId(v){
    const raw = digits(v);
    if(!raw) return false;
    const id = raw.length > 9 ? raw.slice(-9) : raw.padStart(9, "0");
    if(/^0+$/.test(id) || id.replace(/^0+/, "").length < 5) return false;
    let sum = 0;
    for(let i = 0; i < 9; i++){
      let num = Number(id.charAt(i)) * ((i % 2) + 1);
      if(num > 9) num -= 9;
      sum += num;
    }
    return sum % 10 === 0;
  }
  function hebrewDirectionVotes(s){
    const words = String(s || "").split(/\s+/).filter(Boolean);
    let visual = 0;
    let logical = 0;
    words.forEach((w) => {
      const he = w.replace(/[^\u0590-\u05FF]/g, "");
      if(!he) return;
      if(/^[םןץףך]/.test(he)) visual += 1;
      if(/[םןץףך]$/.test(he)) logical += 1;
    });
    return { visual, logical };
  }
  function looksVisualHebrew(s){
    const v = hebrewDirectionVotes(s);
    return v.visual > v.logical;
  }
  function looksLogicalHebrew(s){
    const v = hebrewDirectionVotes(s);
    return v.logical > v.visual;
  }
  function cleanPersonName(raw, visualHint){
    const a = safeTrim(String(raw || "")).replace(/\s+/g, " ");
    if(!a) return "";
    if(looksVisualHebrew(a)) return fixVisualHebrew(a).replace(/\s+/g, " ").trim();
    if(looksLogicalHebrew(a)) return a;
    if(visualHint) return fixVisualHebrew(a).replace(/\s+/g, " ").trim();
    return a;
  }
  function isPlausiblePhone(p){
    const s = String(p || "");
    if(!/^05\d{8}$/.test(s) && !/^0(?:2|3|4|7|8|9)\d{7}$/.test(s)) return false;
    const uniq = new Set(s.slice(1).split("")).size;
    if(uniq < 4) return false;
    const zeros = (s.match(/0/g) || []).length;
    return zeros < 6;
  }
  function extractIsraeliPhone(raw){
    const d = digits(raw);
    if(!d) return "";
    const mobiles = d.match(/05\d{8}/g) || [];
    for(let i = 0; i < mobiles.length; i++){
      if(isPlausiblePhone(mobiles[i])) return mobiles[i];
    }
    const all = d.match(/0\d{8,9}/g) || [];
    for(let j = 0; j < all.length; j++){
      if(isPlausiblePhone(all[j])) return all[j];
    }
    return "";
  }
  function normPhone(v){
    const d = digits(v);
    if(!d) return "";
    const s = d.charAt(0) === "0" ? d : ("0" + d);
    return isPlausiblePhone(s) ? s : "";
  }
  function phoneKey(v){
    const n = normPhone(v);
    return n ? ("tel:" + n) : "";
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

  function clalUseWin1255(bytes){
    let he1255 = 0;
    let he862 = 0;
    const n = Math.min(bytes.length, 8000);
    for(let i = 0; i < n; i++){
      const b = bytes[i] & 0xff;
      if(b >= 0xE0 && b <= 0xFA) he1255++;
      else if(b >= 0x80 && b <= 0x9A) he862++;
    }
    return he1255 >= he862 && he1255 > 0;
  }
  function decodeClalBytes(bytes){
    return clalUseWin1255(bytes) ? decodeWin1255(bytes) : decodeCp862(bytes);
  }
  function clalNamesAreVisual(bytes){
    return !clalUseWin1255(bytes);
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

  function personNameTokens(raw){
    const s = String(raw || "").replace(/[^\u0590-\u05FF\s]/g, " ").replace(/\s+/g, " ").trim();
    const out = [];
    const seen = new Set();
    s.split(" ").forEach((w) => {
      const he = w.replace(/[^\u0590-\u05FF]/g, "");
      if(he.length < 2) return;
      if(!seen.has(he)){
        seen.add(he);
        out.push(he);
      }
      if(he.length >= 8){
        for(let n = 3; n <= he.length - 3; n++){
          const pre = he.slice(0, n);
          if(pre.length >= 3 && !seen.has(pre)){
            seen.add(pre);
            out.push(pre);
          }
        }
      }
    });
    return out;
  }
  function personNameKeys(raw){
    const toks = personNameTokens(raw).filter((t) => t.length >= 3);
    const keys = [];
    const seen = new Set();
    for(let i = 0; i < toks.length; i++){
      for(let j = i + 1; j < toks.length; j++){
        const a = toks[i] + " " + toks[j];
        const b = toks[j] + " " + toks[i];
        if(!seen.has(a)){
          seen.add(a);
          keys.push(a);
        }
        if(!seen.has(b)){
          seen.add(b);
          keys.push(b);
        }
      }
    }
    return keys;
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
    let policyBits = splitPolicyNumber("");
    if(rec.length >= 380){
      policyBits = splitPolicyNumber(rec.slice(23, 31));
    } else {
      const wide = splitPolicyNumber(rec.slice(31, 40));
      policyBits = wide.policyNumber ? wide : splitPolicyNumber(rec.slice(23, 31));
    }
    let policyNumber = policyBits.policyNumber;
    const policyNumberFull = policyBits.policyNumberFull;
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
    const idA = rec.length >= 380 ? normId(rec.slice(32, 41)) : "";
    const idTail = rec.length >= 377 ? normId(rec.slice(368, 377)) : "";
    function usableId(id){
      const n = normId(id);
      if(!n || /^0+$/.test(n)) return "";
      if(n.replace(/^0+/, "").length < 5) return "";
      if(idOverlapsPolicy(n, policyNumber, policyHints)) return "";
      if(!isValidIsraeliId(n)) return "";
      return n;
    }
    const idNumber = usableId(idA);
    const idNumber2 = usableId(idTail) && usableId(idTail) !== idNumber ? usableId(idTail) : (idNumber ? "" : usableId(idTail));
    return {
      kind: "CLAL_POL",
      policyNumber,
      policyNumberFull,
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

  function parseClalMev(s, visualHint){
    const rec = String(s || "");
    if(rec.length < 40 || !/^\d{5}/.test(rec)) return null;
    const agent = rec.slice(0, 5);
    const mevBits = splitPolicyNumber(rec.slice(5, 14));
    const policyNumber = mevBits.policyNumber;
    if(!policyNumber) return null;
    const gender = mapGender(rec.charAt(117)) || mapGender((rec.slice(90, 160).match(/[זנ]/) || [])[0]);
    const birthDate = yyMMdd(rec.slice(111, 117));
    const phone = extractIsraeliPhone(rec.slice(80, 140)) || extractIsraeliPhone(rec);
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
    const names = splitFullName(cleanPersonName(nameRaw, visualHint));
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
    const idMaybe94 = normId(rec.slice(94, 103));
    const idMaybe104 = rec.length >= 300 && !visualHint ? normId(rec.slice(104, 113)) : "";
    const idNumber = [idMaybe94, idMaybe104].filter((id) => {
      return id && isValidIsraeliId(id) && !idOverlapsPolicy(id, policyNumber);
    })[0] || "";
    return {
      kind: "CLAL_MEV",
      policyNumber,
      policyNumberFull: mevBits.policyNumberFull,
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
    const tarBits = splitPolicyNumber(rec.slice(15, 24));
    const policyNumber = tarBits.policyNumber;
    if(!policyNumber) return null;
    const rawCode = digits(rec.slice(-8)).padStart(8, "0").slice(-8);
    if(!rawCode || /^0+$/.test(rawCode)) return null;
    const startDate = dmy8(rec.slice(28, 36)) || ymd8(rec.slice(28, 36)) || dmy8(rec.slice(24, 32)) || "";
    const tarId = rec.length >= 177 ? normId(rec.slice(168, 177)) : "";
    return {
      kind: "CLAL_TAR",
      policyNumber,
      policyNumberFull: tarBits.policyNumberFull,
      agent,
      coverCodeRaw: rawCode,
      startDate,
      premium: 0,
      idNumber: tarId && isValidIsraeliId(tarId) && !idOverlapsPolicy(tarId, policyNumber) ? tarId : ""
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
    const bits = splitPolicyNumber(col(s, 9, 15));
    const policyNumber = bits.policyNumber;
    if(!policyNumber) return null;
    return {
      kind: "RB",
      policyNumber,
      policyNumberFull: bits.policyNumberFull,
      coverCode: safeTrim(col(s, 16, 20)),
      startDate: dmy8(col(s, 23, 30)),
      premium: packedMoney(col(s, 44, 51), 8),
      idNumber: normId(col(s, 71, 79)),
      coverName: mapHealthCover(col(s, 128, 160)),
      coverNameRaw: cleanName(col(s, 128, 160))
    };
  }

  function parsePersonRecord(s, kind){
    const bits = splitPolicyNumber(col(s, 9, 15));
    const policyNumber = bits.policyNumber;
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
      policyNumberFull: bits.policyNumberFull,
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
    const bits = splitPolicyNumber(col(s, 9, 15));
    const policyNumber = bits.policyNumber;
    if(!policyNumber) return null;
    const name = mapLifeCover(col(s, 128, 160));
    return {
      kind: "SB",
      policyNumber,
      policyNumberFull: bits.policyNumberFull,
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
    const policyNumberFull = digits(parts[1]);
    const rawName = safeTrim(parts[19] || "");
    const familyGuess = /חיים|ריסק|משכנתא|מגדלור/.test(rawName) ? "life" : "health";
    return {
      kind: "COVRLIFE",
      policyNumber,
      policyNumberFull,
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
    const policyRaw = parts[8] || parts[10];
    const policyNumber = migdalPolicyNumber(policyRaw);
    if(!policyNumber) return null;
    const headerPrem = kind === "LIFE" ? (parseMoneyField(parts[81]) || parseMoneyField(parts[52])) : parseMoneyField(parts[49]);
    const insuredCount = Number(digits(parts[2] || "")) || 0;
    return {
      kind,
      family: kind === "LIFE" ? "life" : "health",
      policyNumber,
      policyNumberFull: digits(policyRaw),
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
    const ayalonNamed = detectAyalonKindFromName(fileName);
    if(ayalonNamed) return parseAyalonBuffer(fileName, bytes, ayalonNamed, cancelled);
    const text = decodeCp862(bytes);
    const recs = splitRecords(text);
    if(looksLikePhoenixFile(recs)){
      return {
        fileName,
        kind: "PHOENIX",
        records: recs.length,
        rows: recs.map((line) => ({ kind: "PHOENIX_LINE", line })),
        cancelled
      };
    }
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
      const visualNames = clalNamesAreVisual(bytes);
      const clalRecs = splitRecords(clalText);
      const rows = [];
      clalRecs.forEach((s) => {
        let row = null;
        if(namedClal === "CLAL_POL") row = parseClalPol(s);
        else if(namedClal === "CLAL_MEV") row = parseClalMev(s, visualNames);
        else if(namedClal === "CLAL_TAR") row = parseClalTar(s);
        else if(namedClal === "CLAL_SGB") row = parseClalSgb(s);
        if(row){
          if(cancelled) row.cancelled = true;
          rows.push(row);
        }
      });
      return { fileName, kind: namedClal, records: clalRecs.length, rows, cancelled };
    }
    const ayalonGuess = detectAyalonKindFromBuffer(bytes);
    if(ayalonGuess) return parseAyalonBuffer(fileName, bytes, ayalonGuess, cancelled);
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
      function add(id){
        const n = normId(id);
        if(!n || /^0+$/.test(n)) return;
        if(!isValidIsraeliId(n)) return;
        if(idOverlapsPolicy(n, p.policyNumber, p.policyHints)) return;
        set.add(n);
      }
      add(p.idNumber);
      add(p.idNumber2);
    });
    return Array.from(set);
  }
  function uniquePhones(people){
    const set = new Set();
    (people || []).forEach((p) => {
      const n = normPhone(p.phone);
      if(n) set.add(n);
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
      function slot(num, full){
        const k = normPolicy(num);
        if(!k) return null;
        if(!map.has(k)) map.set(k, { policyNumber: k, policyNumberFull: digits(full || num), family, people: [], covers: [] });
        else {
          const prev = map.get(k);
          const nextFull = digits(full || "");
          if(nextFull.length > String(prev.policyNumberFull || "").length) prev.policyNumberFull = nextFull;
        }
        return map.get(k);
      }
      people.forEach((p) => {
        const g = slot(p.policyNumber, p.policyNumberFull);
        if(g) g.people.push(p);
      });
      covers.forEach((c) => {
        const g = slot(c.policyNumber, c.policyNumberFull);
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
        policyNumberFull: g.policyNumberFull || g.policyNumber,
        policyMatchKey: g.policyNumber,
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
        policyNumberFull: header.policyNumberFull || (covers.find((c) => c.policyNumberFull) || {}).policyNumberFull || header.policyNumber,
        policyMatchKey: header.policyNumber,
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
        policyNumberFull: digits(pol),
        policyMatchKey: normPolicy(pol),
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
        if(digits(p.policyNumberFull).length > digits(prev.policyNumberFull).length) prev.policyNumberFull = p.policyNumberFull;
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
        policyNumberFull: digits(header.policyNumberFull) || digits(pol),
        policyMatchKey: normPolicy(pol),
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
        phones: uniquePhones(people),
        primary,
        inactive: cancelled,
        productLabel: type,
        importSource: "clal-production"
      });
    });
    return out;
  }

  function ayalonCode(raw){
    const d = digits(raw);
    if(!d) return "";
    return d.padStart(3, "0").slice(-3);
  }

  function ayalonPair(raw){
    const d = digits(raw);
    if(!d) return "";
    return d.padStart(2, "0").slice(-2);
  }

  function ayalonScaled(raw, places){
    const text = String(raw || "");
    const neg = text.indexOf("-") >= 0;
    const d = digits(text);
    if(!d) return 0;
    const n = Number(d) / Math.pow(10, places || 0);
    if(!Number.isFinite(n)) return 0;
    return (neg ? -1 : 1) * n;
  }

  function ayalonIndexText(n){
    const x = Math.round((Number(n) || 0) * 10000) / 10000;
    if(!(x > 0)) return "";
    if(Math.abs(x - Math.round(x)) < 0.00001) return String(Math.round(x));
    return String(x);
  }

  function ayalonMoneyText(n, keepNegative){
    const x = Math.round((Number(n) || 0) * 100) / 100;
    if(!x) return "";
    if(x < 0 && !keepNegative) return "";
    return x.toFixed(2);
  }

  function ayalonText(raw){
    const t = safeTrim(String(raw || "")).replace(/\s+/g, " ");
    if(!t) return "";
    if(looksVisualHebrew(t)) return fixVisualHebrew(t).replace(/\s+/g, " ").trim();
    return t;
  }

  function ayalonSplitName(raw){
    const parts = ayalonText(raw).split(" ").filter(Boolean);
    if(!parts.length) return { firstName: "", lastName: "", fullName: "" };
    if(parts.length === 1) return { firstName: "", lastName: parts[0], fullName: parts[0] };
    const lastName = parts[0];
    const firstName = parts.slice(1).join(" ");
    return { firstName: firstName, lastName: lastName, fullName: (firstName + " " + lastName).trim() };
  }

  function ayalonPhone(area, num){
    const n = digits(num);
    if(!n || /^0+$/.test(n)) return "";
    const a = digits(area);
    let raw = (/^0+$/.test(a) ? "" : a) + n;
    if(raw.charAt(0) !== "0") raw = "0" + raw;
    return normPhone(raw);
  }

  function ayalonPol(s, from){
    const full = digits(col(s, from, from + 8));
    return { policyNumber: normPolicy(full), policyNumberFull: full };
  }

  function detectAyalonKindFromName(fileName){
    const base = fileBaseName(fileName).toUpperCase();
    const m = base.match(/(?:^|[^A-Z0-9])M(41|43|45|46|47|48|50|58|70|72)(?:[^A-Z0-9]|$)/);
    return m ? ("AYALON_M" + m[1]) : "";
  }

  function detectAyalonKindFromRecord(line){
    const s = String(line || "").replace(/\s+$/g, "");
    const n = s.length;
    if(n === 193 && /^\d+$/.test(s)){
      if(ymd8(s.slice(50, 58)) && ymd8(s.slice(58, 66)) && ymd8(s.slice(185, 193))) return "AYALON_M41";
      if(ymd8(s.slice(24, 32))) return "AYALON_M70";
      return "";
    }
    if(n === 179 && /^\d+$/.test(s) && ymd8(s.slice(24, 32))) return "AYALON_M43";
    if(n === 142 && /^\d+$/.test(s)) return "AYALON_M46";
    if((n === 149 || n === 145) && /^\d+$/.test(s)) return "AYALON_M47";
    if(n === 58 && /^[\d\-]+$/.test(s)) return "AYALON_M58";
    if(n === 55 && /[\u0590-\u05FF]/.test(s.slice(30, 54))) return "AYALON_M45";
    if(n === 265 && /[\u0590-\u05FF]/.test(s.slice(19, 43))) return "AYALON_M48";
    if(n === 37 && /^\d{3}/.test(s) && /[\u0590-\u05FF]/.test(s)) return "AYALON_M50";
    if(n === 67 && /^\d{19}/.test(s)) return "AYALON_M72";
    return "";
  }

  function detectAyalonKindFromBuffer(bytes){
    const head = bytes.length > 400 ? bytes.subarray(0, 400) : bytes;
    const text = decodeWin1255(head);
    const line = String(text.split(/\r?\n/)[0] || "").replace(/\s+$/g, "");
    return detectAyalonKindFromRecord(line);
  }

  function parseAyalonM41(s){
    if(s.length < 193) return null;
    const pol = ayalonPol(s, 11);
    if(!pol.policyNumber) return null;
    const status = AYALON_STATUS[ayalonPair(col(s, 49, 50))] || { label: digits(col(s, 49, 50)) ? "לא פעילה" : "", inactive: !!digits(col(s, 49, 50)) };
    const freq = AYALON_FREQ[ayalonPair(col(s, 94, 95))] || { label: "", months: 0 };
    return {
      kind: "AYALON_M41",
      policyNumber: pol.policyNumber,
      policyNumberFull: pol.policyNumberFull,
      mainAgent: digits(col(s, 1, 5)),
      agent: digits(col(s, 6, 10)),
      id1: normId(col(s, 20, 28)),
      id2: normId(col(s, 29, 37)),
      payerId: normId(col(s, 75, 83)),
      ownerId: normId(col(s, 84, 92)),
      tariff: ayalonCode(col(s, 43, 45)),
      frame: AYALON_FRAME[ayalonPair(col(s, 46, 47))] || "",
      form: col(s, 48, 48) === "2" ? "עדיף" : (col(s, 48, 48) === "1" ? "קלסי" : ""),
      statusLabel: status.label,
      inactive: !!status.inactive,
      statusDate: ymd8(col(s, 51, 58)),
      startDate: ymd8(col(s, 59, 66)),
      endDate: ymd8(col(s, 67, 74)),
      freqLabel: freq.label,
      freqMonths: freq.months,
      collection: { "1": "ש\"ש", "2": "שובר תשלום", "3": "יה\"ב", "4": "כרטיס אשראי" }[digits(col(s, 109, 109))] || "",
      installment: ayalonScaled(col(s, 140, 148), 2),
      basisIndex: ayalonScaled(col(s, 98, 108), 4),
      proposalDate: ymd8(col(s, 178, 185)),
      productionDate: ymd8(col(s, 186, 193))
    };
  }

  function parseAyalonCover(s, kind){
    if(s.length < 179) return null;
    const pol = ayalonPol(s, 11);
    if(!pol.policyNumber) return null;
    const sum = ayalonScaled(col(s, 40, 50), 2);
    const death = ayalonScaled(col(s, 51, 61), 2);
    const cap = s.length >= 155 ? ayalonScaled(col(s, 145, 155), 2) : 0;
    const best = Math.max(sum, death, cap, 0);
    return {
      kind: kind,
      policyNumber: pol.policyNumber,
      policyNumberFull: pol.policyNumberFull,
      code: ayalonCode(col(s, 22, 24)),
      startRaw: digits(col(s, 25, 32)),
      startDate: ymd8(col(s, 25, 32)),
      version: col(s, 33, 34),
      insuredCode: col(s, 35, 36),
      sumInsured: best,
      premiumAnnual: ayalonScaled(col(s, 76, 84), 2),
      years: digits(col(s, 85, 86)).replace(/^0+/, ""),
      payYears: digits(col(s, 87, 88)).replace(/^0+/, ""),
      smoking: col(s, 144, 144) === "1" ? "מעשן" : (col(s, 144, 144) === "0" ? "לא מעשן" : ""),
      index: s.length >= 190 ? ayalonScaled(col(s, 180, 190), 4) : 0,
      indexed: kind === "AYALON_M70"
    };
  }

  function parseAyalonM45(s){
    if(s.length < 55) return null;
    const pol = ayalonPol(s, 11);
    const idNumber = normId(col(s, 22, 30));
    const names = ayalonSplitName(col(s, 31, 54));
    if(!pol.policyNumber || !idNumber || !names.fullName) return null;
    return {
      kind: "AYALON_M45",
      policyNumber: pol.policyNumber,
      policyNumberFull: pol.policyNumberFull,
      insuredNo: digits(col(s, 20, 21)),
      idNumber: idNumber,
      firstName: names.firstName,
      lastName: names.lastName,
      fullName: names.fullName,
      smoking: col(s, 55, 55) === "1" ? "מעשן" : (col(s, 55, 55) === "0" ? "לא מעשן" : ""),
      relation: "ילד",
      relationCode: "ב"
    };
  }

  function parseAyalonM46(s){
    if(s.length < 142) return null;
    const pol = ayalonPol(s, 11);
    if(!pol.policyNumber) return null;
    const labels = [
      [20, "סכום מסולק הוני פיצויים"],
      [31, "סכום מסולק הוני תגמולים"],
      [42, "סכום מסולק קצבה פיצויים"],
      [53, "סכום מסולק קצבה תגמולים"],
      [64, "ערך פדיון פיצויים"],
      [75, "ערך פדיון תגמולים"],
      [86, "חיסכון לתום תקופה הוני פיצויים"],
      [97, "חיסכון לתום תקופה הוני תגמולים"],
      [108, "חיסכון לתום תקופה קצבה פיצויים"],
      [119, "חיסכון לתום תקופה קצבה תגמולים"],
      [130, "גמלה לתום תקופה"]
    ];
    const notes = [];
    labels.forEach((pair) => {
      const text = ayalonMoneyText(ayalonScaled(col(s, pair[0], pair[0] + 10), 2));
      if(text) notes.push(pair[1] + ": " + text);
    });
    const age = digits(col(s, 141, 142)).replace(/^0+/, "");
    if(age) notes.push("גיל לתום תקופה: " + age);
    return { kind: "AYALON_M46", policyNumber: pol.policyNumber, notes: notes };
  }

  function parseAyalonM47(s){
    if(s.length < 145) return null;
    const shift = s.length >= 149 ? 4 : 0;
    function at(a, b){
      const d = a >= 49 ? shift : 0;
      return col(s, a + d, b + d);
    }
    const pol = ayalonPol(s, 25);
    if(!pol.policyNumber) return null;
    const amount = ayalonScaled(at(49, 57), 2);
    const paid = ymd8(at(138, 145));
    const valueDate = ymd8(at(130, 137));
    return {
      kind: "AYALON_M47",
      policyNumber: pol.policyNumber,
      amount: amount,
      paid: paid,
      valueDate: valueDate,
      sort: digits(at(138, 145)) || digits(at(130, 137))
    };
  }

  function parseAyalonM48(s){
    if(s.length < 107) return null;
    const idNumber = normId(col(s, 11, 19));
    const names = ayalonSplitName(col(s, 20, 43));
    if(!idNumber || !isValidIsraeliId(idNumber) || !names.fullName) return null;
    const job = ayalonText(col(s, 108, 131)) || ayalonText(col(s, 132, 155));
    const entrance = safeTrim(col(s, 64, 65));
    const house = safeTrim(col(s, 60, 63));
    return {
      kind: "AYALON_M48",
      idNumber: idNumber,
      firstName: names.firstName,
      lastName: names.lastName,
      fullName: names.fullName,
      street: ayalonText(col(s, 44, 59)),
      house: house && entrance && entrance !== "0" ? (house + " " + entrance) : house,
      city: ayalonText(col(s, 66, 81)),
      zip: digits(col(s, 82, 88)).replace(/^0+$/, ""),
      phone: ayalonPhone(col(s, 89, 91), col(s, 92, 98)),
      birthDate: ymd8(col(s, 99, 106)),
      gender: mapGender(col(s, 107, 107)),
      occupation: job,
      smoking: col(s, 156, 156) === "1" ? "מעשן" : (col(s, 156, 156) === "0" ? "לא מעשן" : "")
    };
  }

  function parseAyalonM50(s){
    if(s.length < 35) return null;
    const code = ayalonCode(col(s, 1, 3));
    const name = ayalonText(col(s, 4, 33));
    if(!code || !name) return null;
    const ins = ayalonPair(col(s, 34, 35));
    return { kind: "AYALON_M50", code: code, name: name, insType: ins, insLabel: AYALON_INS[ins] || "" };
  }

  function parseAyalonM58(s){
    if(s.length < 58) return null;
    const pol = ayalonPol(s, 11);
    if(!pol.policyNumber) return null;
    return {
      kind: "AYALON_M58",
      policyNumber: pol.policyNumber,
      fees: ayalonScaled(col(s, 20, 32), 2),
      balance: ayalonScaled(col(s, 33, 45), 2),
      profit: ayalonScaled(col(s, 46, 58), 2)
    };
  }

  function parseAyalonM72(s){
    if(s.length < 67) return null;
    const pol = ayalonPol(s, 11);
    const name = ayalonText(col(s, 23, 52));
    if(!pol.policyNumber || !name) return null;
    return {
      kind: "AYALON_M72",
      policyNumber: pol.policyNumber,
      code: ayalonCode(col(s, 20, 22)),
      name: name,
      amount: ayalonScaled(col(s, 53, 67), 5)
    };
  }

  function parseAyalonRecord(kind, s){
    if(kind === "AYALON_M41") return parseAyalonM41(s);
    if(kind === "AYALON_M43" || kind === "AYALON_M70") return parseAyalonCover(s, kind);
    if(kind === "AYALON_M45") return parseAyalonM45(s);
    if(kind === "AYALON_M46") return parseAyalonM46(s);
    if(kind === "AYALON_M47") return parseAyalonM47(s);
    if(kind === "AYALON_M48") return parseAyalonM48(s);
    if(kind === "AYALON_M50") return parseAyalonM50(s);
    if(kind === "AYALON_M58") return parseAyalonM58(s);
    if(kind === "AYALON_M72") return parseAyalonM72(s);
    return null;
  }

  function parseAyalonBuffer(fileName, bytes, kind, cancelled){
    const text = decodeWin1255(bytes);
    const recs = splitRecords(text);
    const rows = [];
    recs.forEach((s) => {
      const row = parseAyalonRecord(kind, s);
      if(!row) return;
      if(cancelled) row.cancelled = true;
      rows.push(row);
    });
    return { fileName: fileName, kind: kind, records: recs.length, rows: rows, cancelled: !!cancelled };
  }

  function ayalonBucket(parsedFiles){
    const out = {};
    (parsedFiles || []).forEach((f) => {
      if(!f || !AYALON_KIND_SET[f.kind]) return;
      if(!out[f.kind]) out[f.kind] = [];
      out[f.kind] = out[f.kind].concat(f.rows || []);
    });
    return out;
  }

  function ayalonPushMap(map, key, row){
    if(!key) return;
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  function ayalonPerson(src, extra){
    const row = src || {};
    const add = extra || {};
    return {
      idNumber: row.idNumber || add.idNumber || "",
      firstName: row.firstName || "",
      lastName: row.lastName || "",
      fullName: row.fullName || "",
      relation: add.relation || "",
      relationCode: add.relationCode || "",
      birthDate: row.birthDate || "",
      gender: row.gender || "",
      phone: row.phone || "",
      email: "",
      city: row.city || "",
      street: row.street || "",
      house: row.house || "",
      zip: row.zip || "",
      occupation: row.occupation || "",
      smoking: row.smoking || add.smoking || "",
      primary: !!add.primary
    };
  }

  function ayalonProduct(covers){
    const rows = covers || [];
    const names = rows.map((c) => String(c.name || "")).join(" ");
    if(/משכנתא/.test(names)) return { type: "ריסק משכנתא", family: "life" };
    const types = rows.map((c) => c.insType || "");
    const healthN = types.filter((t) => t === "09" || t === "10" || t === "11" || t === "12").length;
    const lifeN = types.filter((t) => t === "01" || t === "02" || t === "03" || t === "04" || t === "05" || t === "06").length;
    if(healthN && healthN >= lifeN){
      if(types.length && types.every((t) => t === "12")) return { type: "סיעוד", family: "health" };
      return { type: inferHealthProductType(rows, []) || "בריאות", family: "health" };
    }
    if(types.some((t) => t === "07")) return { type: "נכות", family: "health" };
    if(types.some((t) => t === "08")){
      if(/מוות/.test(names) && !/נכות/.test(names)) return { type: "מוות מתאונה", family: "health" };
      if(/נכות/.test(names)) return { type: "נכות מתאונה", family: "health" };
      return { type: "תאונה", family: "health" };
    }
    if(types.length && types.every((t) => t === "04")) return { type: "גמלה", family: "life" };
    if(types.length && types.every((t) => t === "05")) return { type: "חיסכון", family: "life" };
    if(types.length && types.every((t) => t === "06")) return { type: "שלב", family: "life" };
    if(lifeN) return { type: inferLifeProductType(rows) || "ריסק", family: "life" };
    return { type: "פוליסה", family: "" };
  }

  function buildAyalonPolicies(parsedFiles){
    const src = ayalonBucket(parsedFiles);
    const catalog = new Map();
    (src.AYALON_M50 || []).forEach((row) => { if(row && row.code) catalog.set(row.code, row); });
    const people = new Map();
    (src.AYALON_M48 || []).forEach((row) => { if(row && row.idNumber) people.set(row.idNumber, row); });
    const children = new Map();
    (src.AYALON_M45 || []).forEach((row) => ayalonPushMap(children, row && row.policyNumber, row));
    const covers = new Map();
    function putCover(row){
      if(!row || !row.policyNumber) return;
      if(!covers.has(row.policyNumber)) covers.set(row.policyNumber, new Map());
      const bag = covers.get(row.policyNumber);
      const key = [row.code, row.startRaw, row.insuredCode].join("|");
      const prev = bag.get(key);
      if(!prev){
        bag.set(key, row);
        return;
      }
      const prevIndex = Number(prev.index) || 0;
      const nextIndex = Number(row.index) || 0;
      if(nextIndex > prevIndex || (nextIndex === prevIndex && row.indexed && !prev.indexed)) bag.set(key, row);
    }
    (src.AYALON_M43 || []).forEach(putCover);
    (src.AYALON_M70 || []).forEach(putCover);
    const surrender = new Map();
    (src.AYALON_M46 || []).forEach((row) => { if(row && row.policyNumber) surrender.set(row.policyNumber, row.notes || []); });
    const money = new Map();
    (src.AYALON_M58 || []).forEach((row) => { if(row && row.policyNumber) money.set(row.policyNumber, row); });
    const tracks = new Map();
    (src.AYALON_M72 || []).forEach((row) => ayalonPushMap(tracks, row && row.policyNumber, row));
    const payments = new Map();
    (src.AYALON_M47 || []).forEach((row) => {
      if(!row || !row.policyNumber || !(row.amount > 0)) return;
      const prev = payments.get(row.policyNumber);
      if(!prev || String(row.sort || "") >= String(prev.sort || "")) payments.set(row.policyNumber, row);
    });
    const out = [];
    const seen = new Set();
    (src.AYALON_M41 || []).forEach((header) => {
      if(!header || !header.policyNumber || seen.has(header.policyNumber)) return;
      seen.add(header.policyNumber);
      const coverRows = Array.from((covers.get(header.policyNumber) || new Map()).values()).map((c) => {
        const info = catalog.get(c.code) || {};
        const annual = Number(c.premiumAnnual) || 0;
        return {
          code: c.code || "",
          name: info.name || (c.code ? ("תעריף " + c.code) : "כיסוי"),
          coverName: info.name || (c.code ? ("תעריף " + c.code) : "כיסוי"),
          cls: info.insLabel || "",
          insType: info.insType || "",
          start: c.startDate || "",
          premium: annual ? ayalonMoneyText(annual / 12) : "",
          premiumAnnual: ayalonMoneyText(annual),
          sumInsured: ayalonMoneyText(c.sumInsured),
          index: Number(c.index) || 0,
          years: c.years || "",
          payYears: c.payYears || "",
          smoking: c.smoking || ""
        };
      });
      const kind = ayalonProduct(coverRows);
      const primaryId = isValidIsraeliId(header.id1) ? header.id1 : (isValidIsraeliId(header.id2) ? header.id2 : "");
      const group = [];
      const used = new Set();
      function pushPerson(id, extra){
        const n = normId(id);
        if(!n || !isValidIsraeliId(n) || used.has(n)) return;
        const known = people.get(n) || null;
        if(!known && !(extra && extra.primary)) return;
        used.add(n);
        group.push(ayalonPerson(known || { idNumber: n }, extra));
      }
      pushPerson(primaryId, { primary: true, relation: "מבוטח ראשי", relationCode: "מ" });
      if(header.id2 && header.id2 !== primaryId) pushPerson(header.id2, { relation: "מבוטח נוסף" });
      (children.get(header.policyNumber) || []).forEach((kid) => {
        if(used.has(kid.idNumber)) return;
        used.add(kid.idNumber);
        group.push(ayalonPerson(kid, { relation: "ילד", relationCode: "ב", smoking: kid.smoking }));
      });
      if(header.payerId && header.payerId !== primaryId) pushPerson(header.payerId, { relation: "משלם" });
      if(header.ownerId && header.ownerId !== primaryId && header.ownerId !== header.payerId){
        pushPerson(header.ownerId, { relation: "בעלים" });
      }
      const smoke = coverRows.map((c) => c.smoking).find(Boolean) || "";
      if(smoke && group[0] && !group[0].smoking) group[0].smoking = smoke;
      let annual = 0;
      let bestSum = 0;
      let bestIndex = 0;
      coverRows.forEach((c) => {
        annual += Number(c.premiumAnnual) || 0;
        if((Number(c.sumInsured) || 0) > bestSum) bestSum = Number(c.sumInsured) || 0;
        if((Number(c.index) || 0) > bestIndex) bestIndex = Number(c.index) || 0;
      });
      let monthly = 0;
      if(header.freqMonths === 1) monthly = header.installment;
      else if(header.freqMonths > 1) monthly = header.installment / header.freqMonths;
      if(!(monthly > 0) && annual > 0) monthly = annual / 12;
      const notes = [];
      if(header.frame) notes.push("מסגרת: " + header.frame);
      if(header.form) notes.push("סוג: " + header.form);
      if(header.collection) notes.push("גבייה: " + header.collection);
      const basis = ayalonIndexText(header.basisIndex);
      if(basis) notes.push("מדד בסיס: " + basis);
      const currentIndex = ayalonIndexText(bestIndex);
      if(currentIndex) notes.push("מדד: " + currentIndex);
      const payYears = coverRows.map((c) => c.payYears).filter(Boolean);
      if(payYears.length && payYears.every((y) => y === payYears[0])) notes.push("משך תשלום הפרמיה: " + payYears[0] + " שנים");
      (surrender.get(header.policyNumber) || []).forEach((line) => notes.push(line));
      const fin = money.get(header.policyNumber);
      if(fin){
        const fees = ayalonMoneyText(fin.fees, true);
        const balance = ayalonMoneyText(fin.balance, true);
        const profit = ayalonMoneyText(fin.profit, true);
        if(fees) notes.push("דמי ניהול שנגבו: " + fees);
        if(balance) notes.push("יתרת כספים: " + balance);
        if(profit) notes.push("רווחים: " + profit);
      }
      (tracks.get(header.policyNumber) || []).forEach((track) => {
        const amount = ayalonMoneyText(track.amount);
        notes.push("מסלול " + track.name + (amount ? (": " + amount) : ""));
      });
      const pay = payments.get(header.policyNumber);
      if(pay){
        const amount = ayalonMoneyText(pay.amount);
        notes.push("גבייה אחרונה: " + [pay.paid || pay.valueDate || "", amount].filter(Boolean).join(" · "));
      }
      out.push({
        company: COMPANY_AYALON,
        type: kind.type,
        family: kind.family,
        policyNumber: header.policyNumberFull || header.policyNumber,
        policyNumberFull: header.policyNumberFull || header.policyNumber,
        policyMatchKey: header.policyNumber,
        premiumMonthly: ayalonMoneyText(monthly),
        premiumAnnual: ayalonMoneyText(annual),
        sumInsured: ayalonMoneyText(bestSum),
        startDate: header.startDate || "",
        endDate: header.endDate || "",
        statusMark: header.statusLabel || "",
        reportPeriod: header.productionDate || "",
        paymentPeriod: header.freqLabel || "",
        covers: coverRows.map((c) => ({
          code: c.code,
          name: c.name,
          cls: c.cls,
          start: c.start,
          premium: c.premium,
          premiumAnnual: c.premiumAnnual,
          sumInsured: c.sumInsured
        })),
        exclusions: [],
        notes: notes,
        people: group,
        ids: primaryId ? [primaryId] : [],
        phones: uniquePhones(group),
        primary: group[0] || {},
        agentName: "",
        agentNumber: header.agent || "",
        productionLayer: true,
        inactive: !!(header.inactive || header.cancelled),
        importSource: "ayalon-production"
      });
    });
    return out;
  }

  function looksLikePhoenixFile(recs){
    if(!recs || recs.length < 3) return false;
    let pol = 0;
    let person = 0;
    let catalog = 0;
    for(let i = 0; i < recs.length; i++){
      const s = String(recs[i] || "");
      const k = s.slice(0, 2);
      if(k === "01" && s.length >= 400 && /^01\d{10}/.test(s)) pol += 1;
      else if(k === "04" && /^04\d{10}/.test(s)) person += 1;
      else if(k === "09" && /^09\d{4}/.test(s)) catalog += 1;
      if(pol && person && catalog) return true;
    }
    return false;
  }

  function phoenixPeriod(lines){
    const head = (lines || []).find((l) => /^00\d{8}$/.test(l)) || "";
    if(!head) return { key: 0, label: "" };
    const mm = head.slice(4, 6);
    const yyyy = head.slice(6, 10);
    const key = Number(yyyy) * 100 + Number(mm);
    return { key: Number.isFinite(key) ? key : 0, label: (mm && yyyy) ? (mm + "/" + yyyy) : "" };
  }

  function phoenixEmail(line){
    const m = String(line || "").match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
    if(!m) return "";
    const full = m[0];
    const at = full.indexOf("@");
    const local = full.slice(0, at).replace(/^\d+(?=[A-Za-z])/, "");
    if(!local) return "";
    return local + full.slice(at);
  }

  function phoenixZip(line, phone, from){
    const hits = String(line || "").slice(from || 0).match(/\d{7}/g) || [];
    for(let i = 0; i < hits.length; i++){
      const z = hits[i];
      if(z === "0000000" || z.slice(0, 2) === "05" || z.slice(0, 2) === "00") continue;
      if(phone && String(phone).indexOf(z) !== -1) continue;
      return z;
    }
    return "";
  }

  function phoenixLetters(raw){
    return safeTrim(String(raw || "").replace(/[\u0590-\u05FF]+/g, (w) => w.split("").reverse().join("")).replace(/\s+/g, " "));
  }

  function phoenixPhraseScore(s){
    const hints = [
      "משקל עודף", "סוכרת נעורים", "יתר לחץ דם", "לחץ דם", "מניסקוס בצד", "מניסקוס",
      "עיניים", "גידולי שד", "תשישות נפש", "בקע מפשעתי", "קשב וריכוז", "הפרעות קשב", "יתר שומנים",
      "מגבלות כמפורט", "שק הדמעות", "חרשות", "פציאליס", "אדנואידים", "סינוסיטיס", "הריון"
    ];
    let score = 0;
    hints.forEach((hint) => {
      const at = String(s || "").indexOf(hint);
      if(at < 0) return;
      score += hint.length;
      if(at === 0) score += 8;
    });
    return score;
  }

  function phoenixExclusionText(raw){
    const logicalWords = phoenixLetters(raw);
    const visualWords = safeTrim(logicalWords.split(/\s+/).reverse().join(" "));
    const whole = safeTrim(fixVisualHebrew(raw).replace(/\s+/g, " "));
    let best = logicalWords;
    let bestScore = phoenixPhraseScore(logicalWords);
    [visualWords, whole].forEach((cand) => {
      const score = phoenixPhraseScore(cand);
      if(score > bestScore){
        best = cand;
        bestScore = score;
      }
    });
    return best;
  }

  function phoenixRelation(ch){
    if(ch === "מ") return "מבוטח עיקרי";
    if(ch === "ב") return "ילד";
    if(ch === "ז") return "בן/בת זוג";
    return (ch && ch !== "0" && ch !== " ") ? ch : "";
  }

  function phoenixCoverStart(raw){
    const d = digits(raw);
    if(d.length !== 6) return "";
    const yy = Number(d.slice(0, 4));
    const mm = Number(d.slice(4, 6));
    if(mm < 1 || mm > 12 || yy < 1900 || yy > 2100) return "";
    return d.slice(4, 6) + "/" + d.slice(0, 4);
  }

  function phoenixPremium(line){
    const s = String(line || "");
    for(let i = 10; i < s.length; i++){
      if(s.charAt(i) !== "+") continue;
      const raw = s.slice(i - 10, i);
      if(/^\d{10}$/.test(raw)) return money2(Number(raw) / 100);
    }
    return "";
  }

  function phoenixStartDate(line){
    const spots = [12, 20, 28, 36];
    for(let i = 0; i < spots.length; i++){
      const d = dmy8(line.slice(spots[i], spots[i] + 8));
      if(d) return d;
    }
    return "";
  }

  function phoenixCatalog(lines){
    const map = new Map();
    (lines || []).forEach((line) => {
      if(String(line).slice(0, 2) !== "09" || line.length < 8) return;
      const code = line.slice(2, 6);
      if(!/^\d{4}$/.test(code)) return;
      map.set(code, {
        cls: line.slice(-2),
        name: safeTrim(fixVisualHebrew(line.slice(6, line.length - 2)).replace(/\s+/g, " "))
      });
    });
    return map;
  }

  function phoenixPersonNames(line, birthAt){
    if(birthAt < 0) return { firstName: "", lastName: "", fullName: "" };
    const logical = fixVisualHebrew(line.slice(Math.max(0, birthAt - 48), birthAt));
    const parts = logical.match(/[\u0590-\u05FF]+/g) || [];
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");
    return { firstName, lastName, fullName: [firstName, lastName].filter(Boolean).join(" ") };
  }

  function phoenixCity(line, birthAt){
    if(birthAt < 0) return "";
    const zone = fixVisualHebrew(line.slice(birthAt + 9, birthAt + 80));
    const m = zone.match(/[\u0590-\u05FF]{2,}(?:\s+[\u0590-\u05FF]{2,})?/);
    return m ? safeTrim(m[0]) : "";
  }

  function parsePhoenixPerson(line){
    if(String(line).slice(0, 2) !== "04" || line.length < 80) return null;
    const idNumber = normId(line.slice(13, 22));
    if(!isValidIsraeliId(idNumber)) return null;
    let birthAt = -1;
    for(let i = 70; i + 8 <= line.length; i++){
      if(ymd8(line.slice(i, i + 8))){
        birthAt = i;
        break;
      }
    }
    const names = phoenixPersonNames(line, birthAt);
    const genderCh = birthAt >= 0 ? line.charAt(birthAt + 8) : "";
    const phone = extractIsraeliPhone(line);
    return {
      policyNumber: line.slice(2, 12),
      idNumber,
      relationCode: line.charAt(22),
      relation: phoenixRelation(line.charAt(22)),
      firstName: names.firstName,
      lastName: names.lastName,
      fullName: names.fullName,
      birthDate: birthAt >= 0 ? ymd8(line.slice(birthAt, birthAt + 8)) : "",
      gender: mapGender(genderCh),
      phone,
      email: phoenixEmail(line),
      city: phoenixCity(line, birthAt),
      zip: phoenixZip(line, phone, birthAt >= 0 ? birthAt + 8 : 80),
      primary: line.charAt(22) === "מ"
    };
  }

  function phoenixProductFamily(covers){
    const healthCls = { "22": true, "14": true, "24": true, "ככ": true, "2כ": true, "4כ": true };
    const lifeCls = { "01": true, "02": true, "03": true, "04": true };
    let health = 0;
    let life = 0;
    (covers || []).forEach((c) => {
      const cls = safeTrim(c && c.cls);
      if(healthCls[cls]) health += 1;
      else if(lifeCls[cls]) life += 1;
    });
    if(health > 0 && health >= life) return { type: "בריאות", family: "health" };
    if(life > 0) return { type: "ריסק", family: "life" };
    return { type: "פוליסה", family: "" };
  }

  function phoenixPoliciesFromLines(lines, period){
    const catalog = phoenixCatalog(lines);
    const policies = new Map();
    const people = new Map();
    const covers = new Map();
    const exclusions = new Map();
    const ensure = (num, bucket) => {
      if(!bucket.has(num)) bucket.set(num, []);
      return bucket.get(num);
    };
    (lines || []).forEach((line) => {
      const kind = String(line).slice(0, 2);
      const num = String(line).slice(2, 12);
      if(kind === "01" && line.length >= 120 && /^\d{10}$/.test(num)){
        policies.set(num, {
          policyNumber: num,
          startDate: phoenixStartDate(line),
          premiumMonthly: phoenixPremium(line),
          statusMark: line.charAt(91) || ""
        });
      } else if(kind === "02" && line.length >= 34 && /^\d{10}$/.test(num)){
        const code = line.slice(12, 16);
        const info = catalog.get(code) || { name: "", cls: "" };
        ensure(num, covers).push({
          code,
          name: info.name || "",
          cls: info.cls || "",
          start: phoenixCoverStart(line.slice(22, 28))
        });
      } else if(kind === "04"){
        const person = parsePhoenixPerson(line);
        if(person) ensure(person.policyNumber, people).push(person);
      } else if(kind === "19" && /^\d{10}$/.test(num)){
        const text = phoenixExclusionText(line.slice(14).replace(/0+$/g, ""));
        if(text) ensure(num, exclusions).push(text);
      }
    });
    const out = [];
    policies.forEach((header, num) => {
      const group = people.get(num) || [];
      const primary = group.find((p) => p.primary) || null;
      const ordered = primary ? [primary].concat(group.filter((p) => p !== primary)) : group.slice();
      const coverRows = covers.get(num) || [];
      const kind = phoenixProductFamily(coverRows);
      const seenEx = new Set();
      const excl = [];
      (exclusions.get(num) || []).forEach((text) => {
        if(seenEx.has(text)) return;
        seenEx.add(text);
        excl.push(text);
      });
      out.push({
        company: COMPANY_PHOENIX,
        type: kind.type,
        family: kind.family,
        policyNumber: num,
        policyNumberFull: num,
        policyMatchKey: normPolicy(num),
        premiumMonthly: header.premiumMonthly || "",
        startDate: header.startDate || "",
        statusMark: header.statusMark || "",
        reportPeriod: period && period.label ? period.label : "",
        covers: coverRows,
        exclusions: excl,
        people: ordered,
        ids: primary && primary.idNumber ? [primary.idNumber] : [],
        phones: uniquePhones(ordered),
        primary: primary || ordered[0] || {},
        agentName: "",
        agentNumber: "",
        productionLayer: true,
        inactive: false,
        importSource: "phoenix-production"
      });
    });
    return out;
  }

  function buildPhoenixPolicies(parsedFiles){
    const files = (parsedFiles || []).filter((f) => f && f.kind === "PHOENIX");
    let best = null;
    let bestKey = -1;
    let bestPeriod = { key: 0, label: "" };
    files.forEach((f) => {
      const lines = (f.rows || []).map((r) => (r && r.line) ? r.line : (typeof r === "string" ? r : ""));
      const period = phoenixPeriod(lines);
      if(!best || period.key >= bestKey){
        best = lines;
        bestKey = period.key;
        bestPeriod = period;
      }
    });
    return phoenixPoliciesFromLines(best || [], bestPeriod);
  }

  function phoenixPersonCopy(p){
    return {
      idNumber: p.idNumber || "",
      firstName: p.firstName || "",
      lastName: p.lastName || "",
      fullName: p.fullName || "",
      relation: p.relation || "",
      relationCode: p.relationCode || "",
      birthDate: p.birthDate || "",
      gender: p.gender || "",
      phone: p.phone || "",
      email: p.email || "",
      city: p.city || "",
      street: p.street || "",
      house: p.house || "",
      zip: p.zip || "",
      occupation: p.occupation || "",
      smoking: p.smoking || "",
      primary: !!p.primary
    };
  }

  function productionCoverCopy(c){
    const src = c && typeof c === "object" ? c : {};
    return {
      code: src.code || src.coverCode || "",
      name: src.name || src.coverName || src.coverNameRaw || "",
      cls: src.cls || src.class || "",
      start: src.start || src.startDate || "",
      premium: src.premium != null && src.premium !== "" ? src.premium : "",
      premiumAnnual: src.premiumAnnual != null && src.premiumAnnual !== "" ? src.premiumAnnual : "",
      sumInsured: src.sumInsured || "",
      deductible: src.deductible || "",
      extraAmount: src.extraAmount || ""
    };
  }

  function applyProductionLayer(payload, item){
    const next = payload && typeof payload === "object" ? payload : {};
    if(!Array.isArray(next.productionPolicies)) next.productionPolicies = [];
    const num = productionMatchKey(item);
    if(!num) return next;
    const shown = shownPolicyNumber(item);
    const row = {
      id: "prod_" + hashKey(safeTrim(item && item.company) + "|" + num),
      company: item.company,
      policyNumber: shown,
      policyNumberFull: shown,
      policyMatchKey: num,
      type: item.type || "",
      family: item.family || "",
      premiumMonthly: item.premiumMonthly || "",
      premiumAnnual: item.premiumAnnual || "",
      sumInsured: item.sumInsured || "",
      compensation: item.compensation || "",
      agentNumber: item.agentNumber || "",
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      statusMark: item.statusMark || "",
      reportPeriod: item.reportPeriod || "",
      paymentPeriod: item.paymentPeriod || "",
      covers: (item.covers || []).map(productionCoverCopy),
      coverDetails: Array.isArray(item.coverDetails) ? item.coverDetails.map(productionCoverCopy) : [],
      coverPremiums: item.coverPremiums && typeof item.coverPremiums === "object" ? Object.assign({}, item.coverPremiums) : {},
      healthCovers: Array.isArray(item.healthCovers) ? item.healthCovers.slice() : [],
      lifeCovers: Array.isArray(item.lifeCovers) ? item.lifeCovers.slice() : [],
      exclusions: (item.exclusions || []).slice(),
      notes: Array.isArray(item.notes) ? item.notes.filter(Boolean) : [],
      people: (item.people || []).map(phoenixPersonCopy),
      importedAt: nowISO(),
      source: item.importSource || "production"
    };
    let keptId = "";
    const rest = [];
    next.productionPolicies.forEach((p) => {
      const same = sameCompany(p && p.company, item.company) && productionMatchKey(p) === num;
      if(!same){
        rest.push(p);
        return;
      }
      if(!keptId && p && p.id) keptId = p.id;
    });
    if(keptId) row.id = keptId;
    rest.push(row);
    next.productionPolicies = rest;
    return next;
  }

  function applyProductionReport(payload, items){
    const list = Array.isArray(items) ? items : [];
    let next = payload && typeof payload === "object" ? payload : {};
    const company = safeTrim(list[0] && list[0].company);
    const keep = new Set();
    list.forEach((it) => {
      const num = productionMatchKey(it);
      if(!num) return;
      keep.add(num);
      next = applyProductionLayer(next, it);
    });
    if(company && keep.size && Array.isArray(next.productionPolicies)){
      const seen = new Set();
      next.productionPolicies = next.productionPolicies.filter((p) => {
        if(!sameCompany(p && p.company, company)) return true;
        const n = productionMatchKey(p);
        if(!keep.has(n) || seen.has(n)) return false;
        seen.add(n);
        return true;
      });
    }
    return next;
  }

  function markProductionLayer(policies){
    return (policies || []).map((pol) => {
      if(pol && pol.productionLayer) return pol;
      const full = digits(pol && (pol.policyNumberFull || pol.policyNumber));
      const key = normPolicy(pol && pol.policyMatchKey) || normPolicy(pol && pol.policyNumber) || normPolicy(full);
      return Object.assign({}, pol, {
        productionLayer: true,
        policyNumberFull: full,
        policyMatchKey: key
      });
    });
  }

  /* סימון אחרי buildMenoraPolicies. לא משנה את האובייקטים ש-buildPolicies מחזיר,
     כדי שייבוא ישן דרך applyToPayload יישאר כמו שהיה. */
  function markMenoraProductionLayer(policies){
    return (policies || []).map((pol) => {
      const person = (pol && pol.people && pol.people[0]) || (pol && pol.primary) || {};
      const idNumber = normId(person.idNumber || (pol && pol.ids && pol.ids[0]) || "");
      const people = (idNumber || safeTrim(person.fullName)) ? [{
        idNumber: idNumber || person.idNumber || "",
        firstName: person.firstName || "",
        lastName: person.lastName || "",
        fullName: person.fullName || "",
        birthDate: person.birthDate || "",
        gender: person.gender || "",
        city: person.city || "",
        street: person.street || "",
        house: person.house || "",
        phone: person.phone || "",
        email: person.email || "",
        zip: person.zip || "",
        primary: true
      }] : [];
      return Object.assign({}, pol, {
        productionLayer: true,
        agentName: "",
        ids: idNumber ? [idNumber] : [],
        phones: [],
        people,
        covers: (pol && pol.covers || []).map((c) => ({
          code: c.code || c.coverCode || "",
          name: c.name || c.coverName || c.coverNameRaw || "",
          cls: c.cls || c.class || "",
          start: c.start || c.startDate || "",
          premium: c.premium != null && c.premium !== "" ? c.premium : "",
          premiumAnnual: c.premiumAnnual != null && c.premiumAnnual !== "" ? c.premiumAnnual : "",
          sumInsured: c.sumInsured || ""
        })),
        primary: people[0] || {}
      });
    });
  }

  function productionPeople(items){
    const out = [];
    const seen = new Set();
    (items || []).forEach((it) => {
      (it.people || []).forEach((p) => {
        const id = normId(p && p.idNumber);
        if(!id || seen.has(id)) return;
        seen.add(id);
        out.push(p);
      });
    });
    out.sort((a, b) => (a.primary === b.primary) ? 0 : (a.primary ? -1 : 1));
    return out;
  }

  function seedProductionInsured(person){
    let type = "adult";
    let label = "מבוטח נוסף";
    if(person.primary || person.relationCode === "מ"){
      type = "primary";
      label = "מבוטח ראשי";
    } else if(person.relationCode === "ז"){
      type = "spouse";
      label = "בת/בן זוג";
    } else if(person.relationCode === "ב"){
      type = "child";
      label = "ילד";
    }
    const tz = normId(person.idNumber);
    return {
      id: tz ? ("ins_prod_" + tz) : ("ins_prod_nm_" + (personNameSlug(person) || "x")),
      type,
      label,
      data: fillInsuredData({
        firstName: "", lastName: "", idNumber: "", birthDate: "", gender: "",
        phone: "", email: "", city: "", street: "", houseNumber: "", zip: "", occupation: ""
      }, person)
    };
  }

  function fillProductionIdentity(payload, items, opts){
    const next = payload && typeof payload === "object" ? payload : {};
    const people = productionPeople(items);
    const createInsureds = !!(opts && opts.createInsureds);
    if(!Array.isArray(next.insureds)) next.insureds = [];
    people.forEach((person) => {
      const existingId = insuredIdForTz(next, person.idNumber);
      if(existingId){
        const row = next.insureds.find((x) => safeTrim(x && x.id) === existingId);
        if(row) row.data = fillInsuredData(row.data || {}, person);
        return;
      }
      if(createInsureds) next.insureds.push(seedProductionInsured(person));
    });
    return next;
  }

  function productionIdentityPatch(items){
    const people = productionPeople(items);
    const primary = people.find((p) => p.primary) || people[0] || {};
    return {
      fullName: safeTrim(primary.fullName),
      idNumber: normId(primary.idNumber),
      phone: normPhone(primary.phone),
      email: safeTrim(primary.email),
      city: safeTrim(primary.city)
    };
  }

  function buildPolicies(parsedFiles, company){
    const files = parsedFiles || [];
    if(safeTrim(company) === COMPANY_PHOENIX) return buildPhoenixPolicies(files);
    if(safeTrim(company) === COMPANY_AYALON) return buildAyalonPolicies(files);
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
      "ביטוח כלל": "כלל",
      "הפניקס": "הפניקס",
      "פניקס": "הפניקס",
      "ביטוח הפניקס": "הפניקס",
      "איילון": "איילון",
      "ביטוח איילון": "איילון",
      "איילון חברה לביטוח": "איילון"
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
    const items = (policies || []).map((pol) => {
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
        const padded = normId(id);
        const stripped = String(padded || id || "").replace(/^0+/, "");
        const c = customersById.get(id)
          || (padded ? customersById.get(padded) : null)
          || (stripped ? customersById.get(stripped) : null);
        if(c && !seen.has(c.id)){
          seen.add(c.id);
          found.push(c);
        }
      });
      if(pol.productionLayer){
        const collisions = customersById && customersById._idCollisions;
        const idHitsCollision = !!(collisions && (pol.ids || []).some((id) => {
          const padded = normId(id);
          const stripped = String(padded || id || "").replace(/^0+/, "");
          return collisions.has(id) || (padded && collisions.has(padded)) || (stripped && collisions.has(stripped));
        }));
        if(idHitsCollision || found.length > 1){
          return Object.assign({}, pol, {
            category: "review",
            action: "skip",
            reason: "כמה תיקים לאותה ת״ז — לא נוצר תיק כפול",
            customer: null
          });
        }
        if(found.length === 1){
          return Object.assign({}, pol, {
            category: "update",
            action: "update",
            reason: "עדכון פרודוקציה בתיק קיים",
            customer: found[0]
          });
        }
        const hasId = (pol.ids || []).some((id) => !!normId(id));
        if(hasId){
          return Object.assign({}, pol, {
            category: "create",
            action: "create",
            newFolder: true,
            reason: "יצירת תיק חדש מהפרודוקציה",
            customer: null
          });
        }
        return Object.assign({}, pol, {
          category: "unmatched",
          action: "skip",
          reason: "אין ת״ז תקינה בדוח הפרודוקציה",
          customer: null
        });
      }
      const phones = (pol.phones || []).concat((pol.people || []).map((p) => p.phone));
      phones.forEach((ph) => {
        const k = phoneKey(ph);
        if(!k) return;
        const c = customersById.get(k);
        if(c && !seen.has(c.id)){
          seen.add(c.id);
          found.push(c);
        }
      });
      if(!found.length){
        let nameAmbiguous = false;
        const nameSrc = (pol.people || []).map((p) => p.fullName).concat(pol.names || []);
        nameSrc.forEach((nm) => {
          personNameKeys(nm).forEach((k) => {
            const c = customersById.get("name:" + k);
            if(!c) return;
            if(c.ambiguous){
              nameAmbiguous = true;
              return;
            }
            if(!seen.has(c.id)){
              seen.add(c.id);
              found.push(c);
            }
          });
        });
        if(nameAmbiguous && found.length !== 1){
          return Object.assign({}, pol, {
            category: "review",
            action: "skip",
            reason: "כמה תיקים לפי שם — יש לבחור ידנית",
            customer: null
          });
        }
      }
      if(!found.length){
        const hasId = (pol.ids || []).some((id) => !!normId(id));
        const hasPhone = phones.some((ph) => !!normPhone(ph));
        const hasName = (pol.people || []).some((p) => personNameKeys(p.fullName).length > 0)
          || (pol.names || []).some((nm) => personNameKeys(nm).length > 0);
        if(hasId || hasPhone || hasName){
          return Object.assign({}, pol, {
            category: "create",
            action: "create",
            newFolder: true,
            reason: "יצירת תיק חדש מהפרודוקציה",
            customer: null
          });
        }
        return Object.assign({}, pol, {
          category: "unmatched",
          action: "skip",
          reason: "אין ת״ז או טלפון תקינים בדוח הפרודוקציה",
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
    return attachNewFolderStubs(items);
  }

  function hashKey(s){
    let h = 2166136261;
    const t = String(s || "");
    for(let i = 0; i < t.length; i++){
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function newFolderGroupKey(pol){
    if(pol && pol.productionLayer){
      const primaryId = normId((pol.ids || [])[0]);
      if(primaryId) return "id:" + primaryId;
      return "pol:" + (normPolicy(pol.policyNumber) || "x");
    }
    const ids = [];
    (pol.ids || []).forEach((id) => {
      const n = normId(id);
      if(n) ids.push(n);
    });
    (pol.people || []).forEach((p) => {
      const n = normId(p?.idNumber);
      if(n) ids.push(n);
    });
    ids.sort();
    if(ids[0]) return "id:" + ids[0];
    const phones = [];
    (pol.phones || []).concat((pol.people || []).map((p) => p.phone)).forEach((ph) => {
      const n = normPhone(ph);
      if(n) phones.push(n);
    });
    phones.sort();
    if(phones[0]) return "tel:" + phones[0];
    const person = (pol.people && pol.people[0]) || {};
    const nm = safeTrim(person.fullName);
    if(nm) return "name:" + nm + "|" + safeTrim(person.city);
    const fromList = (pol.names || []).map((n) => safeTrim(n)).filter(Boolean)[0];
    if(fromList) return "name:" + fromList + "|";
    return "pol:" + (normPolicy(pol.policyNumber) || "x");
  }

  function attachNewFolderStubs(items){
    const groups = new Map();
    (items || []).forEach((it, idx) => {
      if(!(it && it.newFolder && it.action === "create")) return;
      const key = newFolderGroupKey(it) || ("pol:" + idx);
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    });
    groups.forEach((list, key) => {
      const first = list[0] || {};
      const person = (first.people && first.people[0]) || {};
      let idNumber = "";
      (first.ids || []).concat([person.idNumber]).some((id) => {
        const n = normId(id);
        if(n){
          idNumber = n;
          return true;
        }
        return false;
      });
      let phone = "";
      (first.phones || []).concat((first.people || []).map((p) => p.phone)).some((ph) => {
        const n = normPhone(ph);
        if(n){
          phone = n;
          return true;
        }
        return false;
      });
      const split = splitFullName(person.fullName || "");
      const fullName = safeTrim(person.fullName)
        || [split.firstName, split.lastName].filter(Boolean).join(" ")
        || "לקוח ללא שם";
      const stub = {
        id: "cust_prod_" + hashKey(key),
        fullName,
        idNumber,
        phone,
        city: safeTrim(person.city),
        email: safeTrim(person.email),
        isNewFolder: true,
        payload: { insureds: [], newPolicies: [] }
      };
      list.forEach((it) => { it.customer = stub; });
    });
    return items;
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

  function personFullName(person){
    return safeTrim(person?.fullName)
      || [safeTrim(person?.firstName), safeTrim(person?.lastName)].filter(Boolean).join(" ");
  }

  function personNameSlug(person){
    const nm = personFullName(person);
    const keys = personNameKeys(nm);
    const base = keys[0] || nm;
    return String(base || "").replace(/\s+/g, "_").slice(0, 40);
  }

  function insuredIdForName(payload, person){
    const slug = personNameSlug(person);
    if(!slug) return "";
    const insureds = Array.isArray(payload?.insureds) ? payload.insureds : [];
    const want = "ins_prod_nm_" + slug;
    for(let i = 0; i < insureds.length; i++){
      const ins = insureds[i];
      if(safeTrim(ins?.id) === want) return ins.id;
      const d = ins?.data || {};
      const other = personNameSlug({
        fullName: d.fullName,
        firstName: d.firstName,
        lastName: d.lastName
      });
      if(other && other === slug && ins?.id) return ins.id;
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
      const hit = insuredIdForTz(payload, p?.idNumber)
        || insuredIdForTz(payload, p?.idNumber2)
        || insuredIdForName(payload, p);
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
    const split = splitFullName(person?.fullName || "");
    fillEmpty(d, "firstName", person?.firstName || split.firstName);
    fillEmpty(d, "lastName", person?.lastName || split.lastName);
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
    const source = (people || []).filter((p) => normId(p?.idNumber) || personFullName(p));
    source.forEach((person) => {
      const existingId = insuredIdForTz(payload, person.idNumber) || insuredIdForName(payload, person);
      if(existingId){
        const row = payload.insureds.find((x) => safeTrim(x?.id) === existingId);
        if(row){
          row.data = fillInsuredData(row.data || {}, person);
        }
        return;
      }
      const hasPrimary = payload.insureds.some((x) => safeTrim(x?.type) === "primary");
      const tz = normId(person.idNumber);
      const created = {
        id: tz ? ("ins_prod_" + tz) : ("ins_prod_nm_" + (personNameSlug(person) || "x")),
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
    const computedIds = insuredIdsForCustomer({ payload: next }, item.people || []);
    const insuredIds = computedIds.length
      ? computedIds
      : (Array.isArray(item.insuredIds) ? item.insuredIds.filter(Boolean) : []);
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
    if(!target){
      const num = normPolicy(item.policyNumber);
      if(num){
        target = next.newPolicies.find((x) => sameCompany(x?.company, item.company) && normPolicy(x?.policyNumber) === num) || null;
      }
    }
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
    version: "20260828-sales-mail-hide-v1",
    idOverlapsPolicy,
    relocateMisreadLifePremium,
    sanitizeCustomerPolicies,
    COMPANIES,
    COMPANY_HACHSHARA,
    COMPANY_MIGDAL,
    COMPANY_MENORA,
    COMPANY_CLAL,
    COMPANY_PHOENIX,
    COMPANY_AYALON,
    detectAyalonKindFromName,
    parseFileBuffer,
    detectKind,
    detectMigdalKindFromName,
    detectMenoraKindFromName,
    detectClalKindFromName,
    findEmbeddedZipOffset,
    migdalPolicyNumber,
    buildPolicies,
    classifyPolicies,
    newFolderGroupKey,
    attachNewFolderStubs,
    matchExistingPolicy,
    productFamily,
    inferHealthProductType,
    inferLifeProductType,
    splitLifeMoney,
    pickCompensation,
    insuredIdsForCustomer,
    applyToPayload,
    applyProductionLayer,
    applyProductionReport,
    markProductionLayer,
    markMenoraProductionLayer,
    fillProductionIdentity,
    productionIdentityPatch,
    sameCompany,
    mapHealthCover,
    mapLifeCover,
    formatPaymentPeriod,
    fixVisualHebrew,
    normId,
    normPolicy,
    uniqueIds,
    isValidIsraeliId,
    extractIsraeliPhone,
    cleanPersonName,
    normPhone,
    phoneKey,
    uniquePhones,
    looksVisualHebrew,
    looksLogicalHebrew,
    isPlausiblePhone,
    clalNamesAreVisual,
    personNameKeys
  };
})(typeof window !== "undefined" ? window : this);
