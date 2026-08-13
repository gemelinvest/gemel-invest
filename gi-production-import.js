/* GEMEL INVEST — ייבוא דוח פרודוקציה (GI-PROD 2026-08-13)
   נטען לפי דרישה ממסך טעינת קבצי מערכת.
   חברה ראשונה: הכשרה (קבצי רוחב-קבוע IBM862: RB/RP/SB/SP).
*/
(function installGiProduction(global){
  "use strict";

  const CP862_HE = "אבגדהוזחטיךכלםמןנסעףפץצקרשת";
  const COMPANY_HACHSHARA = "הכשרה";
  const ACTIVE_STATUS = "כ";

  const COMPANIES = Object.freeze([
    { id: COMPANY_HACHSHARA, label: "הכשרה", ready: true, hint: "קבצי RB, RP, SB, SP (בלי סיומת)" },
    { id: "הפניקס", label: "הפניקס", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" },
    { id: "מגדל", label: "מגדל", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" },
    { id: "מנורה", label: "מנורה", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" },
    { id: "כלל", label: "כלל", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" },
    { id: "איילון", label: "איילון", ready: false, hint: "יחובר כשיהיו קבצי פרודוקציה" }
  ]);

  const HEALTH_COVER_MAP = [
    { re: /מחלות\s*קשות/, key: "מחלות קשות" },
    { re: /השתלות/, key: "השתלות וטיפולים מיוחדים מחוץ לישראל" },
    { re: /ניתוח.*חו|תוחים.*חול/, key: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל" },
    { re: /תרופות/, key: "תרופות מחוץ לסל שירותי הבריאות" },
    { re: /אמבולטור/, key: "ייעוץ ובדיקות" },
    { re: /שב.?ן/, key: "משלים שב\"ן ללא השתתפות עצמית" },
    { re: /שקל\s*ראשון/, key: "ניתוחים בישראל מהשקל הראשון" },
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

  function mapHealthCover(name){
    const n = cleanName(name);
    if(!n) return "";
    for(let i = 0; i < HEALTH_COVER_MAP.length; i++){
      if(HEALTH_COVER_MAP[i].re.test(n)) return HEALTH_COVER_MAP[i].key;
    }
    return n;
  }

  function detectKind(fileName, rec0){
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
    const name = cleanName(col(s, 128, 160));
    return {
      kind: "SB",
      policyNumber,
      coverCode: safeTrim(col(s, 16, 20)),
      startDate: dmy8(col(s, 23, 30)),
      premium: packedMoney(col(s, 37, 51), 7),
      coverName: name,
      coverNameRaw: name
    };
  }

  function parseFileBuffer(fileName, buffer){
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const text = decodeCp862(bytes);
    const recs = splitRecords(text).map(fixVisualHebrew);
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

  function buildPolicies(parsedFiles){
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
        const lifeNames = covers.map((c) => c.coverName || "").join(" ");
        type = /משכנתא/.test(lifeNames) ? "ריסק משכנתא" : "ריסק";
      }
      const premium = covers.reduce((sum, c) => sum + (Number(c.premium) || 0), 0);
      const startDate = primary.startDate || covers.find((c) => c.startDate)?.startDate || "";
      const healthCovers = g.family === "health"
        ? Array.from(new Set(covers.map((c) => c.coverName).filter(Boolean)))
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
        people,
        covers,
        ids: uniqueIds(people),
        primary,
        inactive,
        productLabel: primary.productLabel || (g.family === "life" ? type : "בריאות")
      };
    });
  }

  function getNewPolicies(cust){
    const payload = cust?.payload && typeof cust.payload === "object" ? cust.payload : {};
    if(Array.isArray(payload.newPolicies) && payload.newPolicies.length) return payload.newPolicies;
    if(Array.isArray(payload?.operational?.newPolicies) && payload.operational.newPolicies.length){
      return payload.operational.newPolicies;
    }
    return [];
  }

  function matchExistingPolicy(cust, company, type, policyNumber){
    const list = getNewPolicies(cust);
    const sameCo = list.filter((p) => safeTrim(p?.company) === company);
    const num = normPolicy(policyNumber);
    if(num){
      const hit = sameCo.find((p) => normPolicy(p?.policyNumber) === num);
      if(hit) return { action: "update", policy: hit, reason: "מספר פוליסה זהה" };
    }
    const sameType = sameCo.filter((p) => safeTrim(p?.type) === type);
    if(sameType.length === 1) return { action: "update", policy: sameType[0], reason: "פוליסה יחידה מאותו סוג" };
    if(sameType.length === 0) return { action: "create", policy: null, reason: "אין פוליסה מהסוג הזה בתיק" };
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

  function insuredIdsForCustomer(cust, people){
    const payload = cust?.payload && typeof cust.payload === "object" ? cust.payload : {};
    const insureds = Array.isArray(payload.insureds) ? payload.insureds : [];
    const ids = [];
    const wanted = new Set(uniqueIds(people));
    insureds.forEach((ins) => {
      const idn = normId(ins?.data?.idNumber || ins?.idNumber);
      if(idn && wanted.has(idn) && ins.id) ids.push(ins.id);
    });
    if(!ids.length && insureds[0]?.id) ids.push(insureds[0].id);
    return ids;
  }

  function applyToPayload(payload, item){
    const next = payload && typeof payload === "object" ? payload : {};
    if(!Array.isArray(next.newPolicies)) next.newPolicies = [];
    const insuredIds = item.insuredIds || [];
    const meta = {
      company: item.company,
      policyNumber: item.policyNumber,
      importedAt: nowISO(),
      source: "hachshara-production",
      coverCount: (item.covers || []).length,
      personCount: (item.people || []).length
    };
    if(item.action === "update"){
      const p = next.newPolicies.find((x) => safeTrim(x?.id) === safeTrim(item.policyId))
        || next.newPolicies.find((x) => normPolicy(x?.policyNumber) === normPolicy(item.policyNumber) && safeTrim(x?.company) === item.company);
      if(p){
        p.policyNumber = item.policyNumber || p.policyNumber;
        p.premiumMonthly = item.premiumMonthly || p.premiumMonthly;
        if(item.startDate && !safeTrim(p.startDate)) p.startDate = item.startDate;
        if(item.type === "בריאות" && item.healthCovers && item.healthCovers.length){
          const set = [];
          (Array.isArray(p.healthCovers) ? p.healthCovers : []).concat(item.healthCovers).forEach((k) => {
            const t = safeTrim(k);
            if(t && set.indexOf(t) === -1) set.push(t);
          });
          p.healthCovers = set;
        }
        p.productionImport = meta;
      }
    } else {
      next.newPolicies.push({
        id: "npol_prod_" + item.policyNumber + "_" + Math.random().toString(16).slice(2, 8),
        company: item.company,
        type: item.type,
        policyNumber: item.policyNumber,
        premiumMonthly: item.premiumMonthly || "",
        startDate: item.startDate || "",
        healthCovers: item.type === "בריאות" ? (item.healthCovers || []).slice() : [],
        insuredIds: insuredIds.slice(),
        insuredId: insuredIds[0] || "",
        insuredMode: insuredIds.length > 1 ? "multi" : "single",
        discountPct: "0",
        _addedAt: nowISO(),
        productionImport: meta
      });
    }
    if(next.operational && typeof next.operational === "object"){
      next.operational.newPolicies = next.newPolicies;
    }
    return next;
  }

  global.GI_PRODUCTION = {
    version: "20260813-prod-v1",
    COMPANIES,
    COMPANY_HACHSHARA,
    parseFileBuffer,
    detectKind,
    buildPolicies,
    classifyPolicies,
    matchExistingPolicy,
    insuredIdsForCustomer,
    applyToPayload,
    normId,
    normPolicy,
    uniqueIds
  };
})(typeof window !== "undefined" ? window : this);
