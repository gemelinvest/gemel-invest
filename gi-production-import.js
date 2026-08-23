/* GEMEL INVEST — ייבוא דוח פרודוקציה (GI-PROD 2026-08-23)
   נטען לפי דרישה ממסך טעינת קבצי מערכת.
   הכשרה: קבצי רוחב-קבוע IBM862 (RB/RP/SB/SP).
   מגדל: קבצי MBT מופרדי-צינור UTF-8 (LIFEHLTH/LIFE/COVRLIFE/PERSON).
*/
(function installGiProduction(global){
  "use strict";

  const CP862_HE = "אבגדהוזחטיךכלםמןנסעףפץצקרשת";
  const COMPANY_HACHSHARA = "הכשרה";
  const COMPANY_MIGDAL = "מגדל";
  const ACTIVE_STATUS = "כ";
  const MIGDAL_KIND_SET = Object.freeze({
    LIFEHLTH: true,
    LIFE: true,
    COVRLIFE: true,
    PERSON: true,
    AGENTS: true,
    COMPANY: true
  });

  const COMPANIES = Object.freeze([
    { id: COMPANY_HACHSHARA, label: "הכשרה", ready: true, hint: "קבצי RB, RP, SB, SP (בלי סיומת)", dropHint: "הכשרה: RB (כיסויי בריאות), RP (מבוטחי בריאות), SB (כיסויי חיים), SP (מבוטחי חיים). אפשר כמה יחד." },
    { id: "הפניקס", label: "הפניקס", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" },
    { id: COMPANY_MIGDAL, label: "מגדל", ready: true, hint: "קבצי LIFEHLTH, LIFE, COVRLIFE, PERSON (.MBT)", dropHint: "מגדל: LIFEHLTH (בריאות), LIFE (חיים), COVRLIFE (כיסויים), PERSON (מבוטחים). אפשר גם AGENTS / COMPANY." },
    { id: "מנורה", label: "מנורה", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" },
    { id: "כלל", label: "כלל", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" },
    { id: "איילון", label: "איילון", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" }
  ]);

  const HEALTH_COVER_MAP = [
    { re: /מחלות\s*קשות/, key: "מחלות קשות" },
    { re: /מזור\s*לסרטן/, key: "מזור לסרטן" },
    { re: /מזור/, key: "מזור מורחב" },
    { re: /שקל\s*ראשון|מהשקל/, key: "ניתוחים בישראל מהשקל הראשון" },
    { re: /ניתוח.*ישראל|ניתוחים\s*בישראל/, key: "ניתוחים בישראל מורחב" },
    { re: /שב.?ן/, key: "משלים שב\"ן ללא השתתפות עצמית" },
    { re: /השתל/, key: "השתלות וטיפולים מיוחדים מחוץ לישראל" },
    { re: /ניתוח.*חו|תוחים.*חול|חול.*חותינ|בחול/, key: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל" },
    { re: /תרופות/, key: "תרופות מחוץ לסל שירותי הבריאות" },
    { re: /אמבולטור|ייעוץ.*בדיק|יעוץ.*בדיק|אבחון\s*מהיר/, key: "ייעוץ ובדיקות" },
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
    const hasCoreLife = /ריסק|מגדלור|קשת|חיים|חסכון|כושר|שלוה|מוטב/.test(names);
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
    return family === "life" ? mapLifeCover(cover?.coverName) : mapHealthCover(cover?.coverName);
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

  function parseFileBuffer(fileName, buffer){
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
      return { fileName, kind, records: recs.length, rows };
    }
    const text = decodeCp862(bytes);
    const recs = splitRecords(text);
    const kind = detectKind(fileName, recs[0] || "");
    const rows = [];
    recs.forEach((s) => {
      let row = null;
      if(kind === "RB") row = parseRbRecord(s);
      else if(kind === "RP" || kind === "SP") row = parsePersonRecord(s, kind);
      else if(kind === "SB") row = parseSbRecord(s);
      if(row) rows.push(row);
    });
    return { fileName, kind, records: recs.length, rows };
  }

  function uniqueIds(people){
    const set = new Set();
    (people || []).forEach((p) => {
      if(p.idNumber) set.add(p.idNumber);
      if(p.idNumber2) set.add(p.idNumber2);
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

  function buildPolicies(parsedFiles, company){
    const files = parsedFiles || [];
    const hasMigdal = files.some((f) => f && MIGDAL_KIND_SET[f.kind]);
    const hasHach = files.some((f) => f && (f.kind === "RB" || f.kind === "RP" || f.kind === "SB" || f.kind === "SP"));
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
      "מגדל חברה לביטוח": "מגדל"
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

  function relocateMisreadLifePremium(p){
    const t = safeTrim(p?.type);
    if(t !== "ריסק" && t !== "ריסק משכנתא") return p;
    const prem = Number(p?.premiumMonthly) || 0;
    if(prem >= 10000){
      if(!Number(p.sumInsured)) p.sumInsured = money2(prem);
      p.premiumMonthly = "";
    }
    if(p.premiumPerInsured && typeof p.premiumPerInsured === "object"){
      Object.keys(p.premiumPerInsured).forEach((k) => {
        if(Number(p.premiumPerInsured[k]) >= 10000) p.premiumPerInsured[k] = "";
      });
    }
    if(p.productionCoverPremiums && typeof p.productionCoverPremiums === "object"){
      Object.keys(p.productionCoverPremiums).forEach((k) => {
        if(Number(p.productionCoverPremiums[k]) >= 10000) p.productionCoverPremiums[k] = "";
      });
    }
    return p;
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
    if(item.family === "life" || item.type === "ריסק" || item.type === "ריסק משכנתא"){
      const set = [];
      (Array.isArray(p.lifeCovers) ? p.lifeCovers : []).concat(item.lifeCovers || Object.keys(coverPrem)).forEach((k) => {
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
      source: item.importSource || (item.company === COMPANY_MIGDAL ? "migdal-production" : "hachshara-production"),
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
        discountPct: "0",
        _addedAt: nowISO()
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
    version: "20260823-migdal-sumfix-v1",
    COMPANIES,
    COMPANY_HACHSHARA,
    COMPANY_MIGDAL,
    parseFileBuffer,
    detectKind,
    detectMigdalKindFromName,
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
