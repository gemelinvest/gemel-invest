/* GI-COLLECTION 2026-11-15
   קריאת מייל גבייה והתאמה לתיק. בלי רשת, בלי סיסמה, בלי שמירת קובץ דוח מרובה לקוחות על תיק אחד.
   תיבה: gviyaas@i-s-f.co.il — החיבור לקריאה יושב בפונקציה gi-collection-mail, לא כאן.
*/
(function(root, factory){
  const api = factory();
  if(typeof module !== "undefined" && module.exports) module.exports = api;
  if(root) root.GICollection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  const MAILBOX = "gviyaas@i-s-f.co.il";
  const COMPANIES = ["כלל", "הפניקס", "איילון", "מנורה", "מגדל"];
  const BOILER = new Set([
    "מכתב", "ללקוח", "הודעה", "בגין", "אי", "תשלום", "פרמיות", "אמצעי", "שלא", "כובד",
    "העתק", "לסוכן", "סוכן", "מסמכים", "משמעותיים", "הנוגעים", "ללקוחותיך", "לקוחותיך",
    "פוליסות", "לפני", "ביטול", "בריאות", "וריסק", "ריסק", "חדש", "ממתין", "עבורך",
    "באזור", "האישי", "מסמך", "סכם", "דואר", "אלקטרוני"
  ]);

  function text(value){
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function digits(value){
    return String(value == null ? "" : value).replace(/\D/g, "");
  }

  function padId(value){
    const d = digits(value);
    if(!d) return "";
    if(d.length > 9) return d.slice(-9);
    return d.padStart(9, "0");
  }

  function hebrewWords(value){
    const raw = text(value).replace(/[״"׳']/g, "");
    const parts = raw.split(/[^\u0590-\u05FF]+/).map((w) => w.trim()).filter((w) => w.length >= 2);
    return parts.filter((w) => !BOILER.has(w) && COMPANIES.indexOf(w) < 0 && w !== "כלל");
  }

  function nameTokens(value){
    return hebrewWords(value);
  }

  function nameMatches(customerName, wanted){
    const have = nameTokens(customerName);
    if(!have.length) return false;
    let need = nameTokens(wanted);
    if(!need.length) return false;
    const hit = (tokens) => tokens.every((token) => have.some((word) => word === token || word.endsWith(token) || token.endsWith(word)));
    if(hit(need)) return true;
    if(need[0] && need[0].charAt(0) === "ב" && need[0].length > 2){
      need = [need[0].slice(1)].concat(need.slice(1));
      return hit(need);
    }
    return false;
  }

  function companyFrom(input){
    const from = text(input && input.from).toLowerCase();
    const subject = text(input && input.subject);
    const body = text(input && (input.body || input.text));
    if(from.indexOf("clal-ins.co.il") >= 0 || from.indexOf("clalbit.co.il") >= 0) return "כלל";
    if(subject.indexOf("מגדל") >= 0) return "מגדל";
    if(subject.indexOf("מנורה") >= 0) return "מנורה";
    if(subject.indexOf("איילון") >= 0) return "איילון";
    if(subject.indexOf("הפניקס") >= 0 || body.indexOf("הפניקס") >= 0 || body.indexOf("באתר הפניקס") >= 0) return "הפניקס";
    if(subject.indexOf("אי תשלום פרמיות") >= 0 && subject.indexOf("אמצעי תשלום") >= 0) return "כלל";
    if(subject.indexOf("כלל") >= 0) return "כלל";
    return "";
  }

  function idInSubject(subject){
    const raw = text(subject);
    const labeled = raw.match(/ת\.?\s*ז\.?\s*\.?\s*(\d{7,9})/);
    if(labeled) return padId(labeled[1]);
    const bare = raw.match(/(^|[^\d])(\d{8,9})(?!\d)/);
    return bare ? padId(bare[2]) : "";
  }

  function nameBeforeId(subject){
    const raw = text(subject);
    const idMatch = raw.match(/(\d{8,9})/);
    if(!idMatch) return "";
    const before = raw.slice(0, idMatch.index);
    const words = hebrewWords(before).slice(-4);
    return words.join(" ");
  }

  function namedByLetter(subject){
    const raw = text(subject);
    const match = raw.match(/ע["״']ש\s+(.+?)\s+ת\.?\s*ז/);
    if(!match) return "";
    return hebrewWords(match[1]).join(" ");
  }

  function phoenixName(body){
    const raw = text(body);
    const match = raw.match(/([\u0590-\u05FF][\u0590-\u05FF\s]{1,40}?)\s+שלום/);
    if(!match) return "";
    return hebrewWords(match[1]).slice(-4).join(" ");
  }

  function noticeType(company, subject){
    const s = text(subject);
    if(company === "מגדל") return "פוליסות לפני ביטול";
    if(s.indexOf("אי תשלום") >= 0) return "הודעה על אי תשלום";
    if(s.indexOf("מסמכים") >= 0) return "מסמכים משמעותיים";
    return s.slice(0, 80);
  }

  function parseClalDetails(raw){
    const src = text(raw);
    if(!src) return {};
    const policy = (src.match(/פוליס(?:ה|ת)?[^0-9]{0,40}(\d{6,12})/) || src.match(/מס'\s*(\d{6,12})/) || [])[1] || "";
    const amount = (src.match(/(\d{1,6}(?:\.\d{1,2})?)\s*₪/) || [])[1] || "";
    let reason = "";
    const reasonMatch = src.match(/מהסיבה\s*:\s*(.+?)(?:\.|לנוחותך|אנו מבקשים)/);
    if(reasonMatch) reason = text(reasonMatch[1]);
    let bankNote = "";
    const bankMatch = src.match(/בנק[^.]{0,180}/);
    if(bankMatch) bankNote = text(bankMatch[0]).slice(0, 180);
    return {
      policyNumber: policy,
      amount: amount,
      reason: reason,
      bankNote: bankNote
    };
  }

  function last4FromText(value){
    const raw = text(value);
    const masked = raw.match(/\*+(\d{4})/);
    if(masked) return masked[1];
    const d = digits(raw);
    if(d.length === 4) return d;
    if(d.length > 4 && raw.indexOf("*") >= 0) return d.slice(-4);
    return "";
  }

  function rtlWords(items){
    return items.slice().sort((a, b) => b.x - a.x).map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
  }

  function band(items, min, max){
    return (items || []).filter((item) => item.x >= min && item.x < max);
  }

  function parseMigdalItems(items){
    const list = (Array.isArray(items) ? items : []).map((item) => ({
      x: Number(item && item.x) || 0,
      y: Number(item && item.y) || 0,
      text: text(item && item.text)
    })).filter((item) => item.text);
    const lines = [];
    list.forEach((item) => {
      let line = null;
      for(let i = 0; i < lines.length; i += 1){
        if(Math.abs(lines[i].y - item.y) <= 3){ line = lines[i]; break; }
      }
      if(!line){
        line = { y: item.y, items: [] };
        lines.push(line);
      }
      line.items.push(item);
    });
    lines.sort((a, b) => a.y - b.y);
    const policyOf = (line) => digits(rtlWords(band(line.items, 250, 330)));
    const cases = [];
    lines.forEach((line, idx) => {
      const policy = policyOf(line);
      if(policy.length < 7) return;
      const neighbors = [];
      [lines[idx - 1], lines[idx + 1]].forEach((near) => {
        if(!near || Math.abs(near.y - line.y) > 16) return;
        if(policyOf(near).length >= 7) return;
        neighbors.push(near);
      });
      const reasonItems = band(line.items, 90, 200);
      const firstItems = band(line.items, 390, 450);
      neighbors.forEach((near) => {
        reasonItems.push.apply(reasonItems, band(near.items, 90, 200));
        firstItems.push.apply(firstItems, band(near.items, 390, 450));
      });
      const insured = last4FromText(rtlWords(band(line.items, 445, 510)));
      const family = last4FromText(rtlWords(band(line.items, 505, 580)));
      const firstName = rtlWords(firstItems);
      const lastName = rtlWords(band(line.items, 330, 395));
      cases.push({
        company: "מגדל",
        kind: "report",
        name: text([firstName, lastName].filter(Boolean).join(" ")),
        idNumber: "",
        idLast4: insured || family,
        familyLast4: family,
        policyNumber: policy,
        product: rtlWords(band(line.items, 200, 250)),
        amount: rtlWords(band(line.items, 0, 90)).replace(/[^\d.]/g, ""),
        reason: rtlWords(reasonItems),
        noticeType: "תשלום שחזר",
        bankNote: ""
      });
    });
    return cases;
  }

  function blankCase(company, subject){
    return {
      company: company,
      kind: "individual",
      name: "",
      idNumber: "",
      idLast4: "",
      familyLast4: "",
      policyNumber: "",
      product: "",
      amount: "",
      reason: "",
      noticeType: noticeType(company, subject),
      bankNote: ""
    };
  }

  function parseIncoming(message){
    const input = message && typeof message === "object" ? message : {};
    const subject = text(input.subject);
    const body = text(input.body || input.text);
    const company = companyFrom(input);
    const base = {
      mailbox: MAILBOX,
      company: company,
      kind: company === "מגדל" ? "report" : (company ? "individual" : "unknown"),
      subject: subject.slice(0, 180),
      from: text(input.from).slice(0, 120),
      receivedAt: text(input.receivedAt),
      cases: [],
      reportFileOmitted: company === "מגדל" && !!(input.attachment || (Array.isArray(input.attachments) && input.attachments.length))
    };
    if(!company) return base;
    if(company === "מגדל"){
      base.cases = parseMigdalItems(input.items || input.rows);
      return base;
    }
    const row = blankCase(company, subject);
    row.idNumber = idInSubject(subject);
    row.name = namedByLetter(subject) || nameBeforeId(subject);
    if(company === "הפניקס" && !row.name) row.name = phoenixName(body);
    if(company === "כלל"){
      const details = parseClalDetails(input.text || input.body || "");
      row.policyNumber = details.policyNumber || "";
      row.amount = details.amount || "";
      row.reason = details.reason || "";
      row.bankNote = details.bankNote || "";
      row.product = "בריאות";
    }
    if(row.idNumber || row.name) base.cases = [row];
    return base;
  }

  function matchCustomers(item, customers){
    const list = Array.isArray(customers) ? customers : [];
    const full = padId(item && item.idNumber);
    if(full && digits(item.idNumber).length >= 7){
      const hits = list.filter((row) => padId(row && row.idNumber) === full);
      if(hits.length === 1) return { status: "unique", customer: hits[0] };
      if(hits.length > 1) return { status: "AMBIGUOUS" };
      return { status: "NO_CUSTOMER" };
    }
    const last4 = digits(item && item.idLast4);
    if(last4.length === 4 && text(item && item.name)){
      const hits = list.filter((row) => padId(row && row.idNumber).endsWith(last4) && nameMatches(row && (row.fullName || row.name), item.name));
      if(hits.length === 1) return { status: "unique", customer: hits[0] };
      if(hits.length > 1) return { status: "AMBIGUOUS" };
      return { status: "NO_CUSTOMER" };
    }
    if(text(item && item.name) && !full && last4.length !== 4){
      const hits = list.filter((row) => nameMatches(row && (row.fullName || row.name), item.name));
      if(hits.length === 1) return { status: "unique", customer: hits[0] };
      if(hits.length > 1) return { status: "AMBIGUOUS" };
      return { status: "NO_CUSTOMER" };
    }
    return { status: "NO_IDENTITY" };
  }

  function applyIncoming(message, customers){
    const parsed = parseIncoming(message);
    if(!parsed.company){
      return { company: "", kind: "unknown", assignments: [], holds: [hold(parsed, null, "NO_COMPANY")], reportFileOmitted: false };
    }
    if(parsed.kind === "report" && !parsed.cases.length){
      return { company: parsed.company, kind: parsed.kind, assignments: [], holds: [hold(parsed, null, "MIGDAL_NEEDS_ROWS")], reportFileOmitted: parsed.reportFileOmitted };
    }
    if(!parsed.cases.length){
      return { company: parsed.company, kind: parsed.kind, assignments: [], holds: [hold(parsed, null, "NO_IDENTITY")], reportFileOmitted: parsed.reportFileOmitted };
    }
    const assignments = [];
    const holds = [];
    parsed.cases.forEach((row) => {
      const found = matchCustomers(row, customers);
      if(found.status !== "unique"){
        holds.push(hold(parsed, row, found.status));
        return;
      }
      assignments.push({
        customerId: String(found.customer.id || ""),
        entry: entryFrom(parsed, row)
      });
    });
    return {
      company: parsed.company,
      kind: parsed.kind,
      assignments: assignments,
      holds: holds,
      reportFileOmitted: parsed.reportFileOmitted === true
    };
  }

  function entryFrom(parsed, row){
    return {
      source: "email",
      status: "open",
      company: row.company || parsed.company,
      kind: row.kind || parsed.kind,
      name: text(row.name),
      idNumber: row.idNumber && digits(row.idNumber).length >= 7 ? padId(row.idNumber) : "",
      idLast4: digits(row.idLast4).slice(-4),
      policyNumber: text(row.policyNumber),
      product: text(row.product),
      amount: text(row.amount),
      reason: text(row.reason),
      noticeType: text(row.noticeType),
      bankNote: text(row.bankNote).slice(0, 180),
      subject: parsed.subject,
      receivedAt: parsed.receivedAt,
      document: null
    };
  }

  function hold(parsed, row, reason){
    return {
      reason: reason || "NO_IDENTITY",
      company: text((row && row.company) || parsed.company),
      subject: text(parsed.subject).slice(0, 180),
      from: text(parsed.from).slice(0, 120),
      receivedAt: text(parsed.receivedAt),
      name: text(row && row.name),
      idNumber: row && digits(row.idNumber).length >= 7 ? padId(row.idNumber) : "",
      idLast4: digits(row && row.idLast4).slice(-4)
    };
  }

  const HEADER_MAP = {
    id: ["תז", "תעודתזהות", "מספרזהות", "זהות", "id", "idnumber", "tz"],
    name: ["שם", "שםמלא", "שםהלקוח", "מבוטח", "לקוח", "name", "fullname"],
    first: ["שםפרטי", "פרטי", "firstname"],
    last: ["שםמשפחה", "משפחה", "lastname"],
    policy: ["פוליסה", "מספרפוליסה", "policynumber", "policy"],
    amount: ["סכום", "פרמיה", "חוב", "amount", "sum"],
    reason: ["סיבה", "סיבתהחזרה", "החזרה", "reason"],
    product: ["מוצר", "ענף", "product"],
    last4: ["4ספרות", "ספרותאחרונות", "last4"]
  };
  const HEADER_WORDS = new Set(["שם", "מלא", "הלקוח", "תעודת", "זהות", "פוליסה", "מספר", "סכום", "פרמיה", "חוב", "סיבה", "סיבת", "החזרה", "מוצר", "ענף", "מבוטח", "לקוח", "פרטי", "משפחה"]);

  function headerKey(value){
    return text(value).toLowerCase().replace(/["'״׳.\s:_-]/g, "");
  }

  function knownHeader(value){
    const key = headerKey(value);
    if(!key) return "";
    const kinds = Object.keys(HEADER_MAP);
    for(let i = 0; i < kinds.length; i += 1){
      if(HEADER_MAP[kinds[i]].indexOf(key) >= 0) return kinds[i];
    }
    return "";
  }

  function headerOnlyName(value){
    const words = hebrewWords(value);
    return !words.length || words.every((word) => HEADER_WORDS.has(word));
  }

  function reportCase(company, fields){
    const src = fields && typeof fields === "object" ? fields : {};
    const idDigits = digits(src.id);
    const idNumber = idDigits.length >= 7 && idDigits.length <= 9 ? padId(idDigits) : "";
    const named = text([src.first, src.last].filter(Boolean).join(" ")) || text(src.name);
    const name = headerOnlyName(named) ? "" : (hebrewWords(named).slice(0, 4).join(" ") || "");
    const last4 = idNumber ? "" : (digits(src.last4).slice(-4) || last4FromText(src.id || src.name || ""));
    if(!idNumber && !name && last4.length !== 4) return null;
    const amountRaw = text(src.amount).replace(/,/g, "");
    const amountMatch = amountRaw.match(/\d{1,7}(?:\.\d{1,2})?/);
    return {
      company: company,
      kind: "report",
      name: name,
      idNumber: idNumber,
      idLast4: last4,
      familyLast4: "",
      policyNumber: digits(src.policy).slice(0, 12),
      product: text(src.product).slice(0, 40),
      amount: amountMatch ? amountMatch[0] : "",
      reason: text(src.reason).slice(0, 180),
      noticeType: "דוח גבייה",
      bankNote: ""
    };
  }

  function fieldsFromCells(cells){
    const values = (Array.isArray(cells) ? cells : []).map((cell) => text(cell)).filter(Boolean);
    const fields = { id: "", name: "", policy: "", amount: "", reason: "", product: "", last4: "" };
    const names = [];
    const longNums = [];
    values.forEach((value) => {
      const labeled = value.match(/ת\.?\s*ז\.?\s*\.?\s*(\d{7,9})/);
      if(labeled) fields.id = labeled[1];
      (value.match(/\d{7,9}/g) || []).forEach((num) => {
        if(longNums.indexOf(num) < 0) longNums.push(num);
      });
      if(value.indexOf("*") >= 0 && !fields.last4) fields.last4 = last4FromText(value);
      const money = value.match(/(?:^|\s)(\d{1,6}(?:\.\d{1,2})?)\s*₪/);
      if(money && !fields.amount) fields.amount = money[1];
      else if(/^\d{1,6}(?:\.\d{1,2})?$/.test(value.replace(/,/g, "")) && !fields.amount && !/\d{7,9}/.test(value)) fields.amount = value.replace(/,/g, "");
      const words = hebrewWords(value);
      if(words.length && !headerOnlyName(words.join(" "))) names.push(words.join(" "));
    });
    if(!fields.id && longNums.length) fields.id = longNums.find((num) => num.length === 9) || longNums[0];
    const policy = longNums.find((num) => num !== fields.id);
    if(policy && !fields.policy) fields.policy = policy;
    fields.name = names.slice(0, 2).join(" ");
    return fields;
  }

  function parseReportSheet(company, rows){
    const chosen = COMPANIES.indexOf(company) >= 0 ? company : "";
    const list = Array.isArray(rows) ? rows : [];
    if(!chosen || !list.length) return [];
    const objects = list.map((row) => {
      if(Array.isArray(row)) return null;
      return row && typeof row === "object" ? row : null;
    });
    if(objects.every((row) => row)){
      return objects.map((row) => {
        const fields = {};
        Object.keys(row).forEach((key) => {
          const kind = knownHeader(key);
          if(kind) fields[kind] = row[key];
        });
        if(!fields.id && !fields.name && !fields.first && !fields.last){
          return reportCase(chosen, fieldsFromCells(Object.keys(row).map((key) => row[key])));
        }
        return reportCase(chosen, fields);
      }).filter(Boolean);
    }
    const matrix = list.map((row) => Array.isArray(row) ? row : [row]);
    const header = matrix[0].map((cell) => knownHeader(cell));
    if(header.some(Boolean)){
      return matrix.slice(1).map((row) => {
        const fields = {};
        header.forEach((kind, index) => {
          if(kind) fields[kind] = row[index];
        });
        return reportCase(chosen, fields);
      }).filter(Boolean);
    }
    return matrix.map((row) => reportCase(chosen, fieldsFromCells(row))).filter(Boolean);
  }

  function linesFromItems(items){
    const list = (Array.isArray(items) ? items : []).map((item) => ({
      x: Number(item && item.x) || 0,
      y: Number(item && item.y) || 0,
      text: text(item && item.text)
    })).filter((item) => item.text);
    const lines = [];
    list.forEach((item) => {
      let line = null;
      for(let i = 0; i < lines.length; i += 1){
        if(Math.abs(lines[i].y - item.y) <= 3){ line = lines[i]; break; }
      }
      if(!line){
        line = { y: item.y, items: [] };
        lines.push(line);
      }
      line.items.push(item);
    });
    lines.sort((a, b) => a.y - b.y);
    return lines.map((line) => rtlWords(line.items)).filter(Boolean);
  }

  function parseReportItems(company, items){
    const chosen = COMPANIES.indexOf(company) >= 0 ? company : "";
    if(!chosen) return [];
    if(chosen === "מגדל"){
      const migdal = parseMigdalItems(items);
      if(migdal.length) return migdal;
    }
    return linesFromItems(items).map((line) => reportCase(chosen, fieldsFromCells([line]))).filter(Boolean);
  }

  function parseReportText(company, raw){
    const chosen = COMPANIES.indexOf(company) >= 0 ? company : "";
    if(!chosen) return [];
    const lines = String(raw == null ? "" : raw).split(/\n+/).map((line) => text(line)).filter(Boolean);
    const cases = lines.map((line) => reportCase(chosen, fieldsFromCells([line]))).filter(Boolean);
    if(cases.length) return cases;
    const one = reportCase(chosen, fieldsFromCells([text(raw)]));
    return one ? [one] : [];
  }

  function reportKey(company, row){
    const name = nameTokens(row && row.name).slice().sort().join(" ");
    const raw = [company, row && (row.idNumber || row.idLast4), row && row.policyNumber, row && row.amount, name].join("|");
    let hash = 5381;
    for(let i = 0; i < raw.length; i += 1) hash = ((hash << 5) + hash + raw.charCodeAt(i)) >>> 0;
    return "colrep_" + hash.toString(16);
  }

  function reportHold(company, row, reason){
    const kept = hold({ company: company, subject: "דוח " + company, from: "", receivedAt: "" }, row, reason);
    kept.source = "report";
    kept.noFile = reason === "NO_CUSTOMER" || reason === "AMBIGUOUS";
    kept.policyNumber = text(row && row.policyNumber);
    kept.amount = text(row && row.amount);
    return kept;
  }

  function applyReport(company, cases, customers){
    const chosen = COMPANIES.indexOf(company) >= 0 ? company : "";
    if(!chosen){
      return { company: "", assignments: [], holds: [reportHold("", null, "NO_COMPANY")], reportFileOmitted: true };
    }
    const list = Array.isArray(cases) ? cases.filter(Boolean) : [];
    if(!list.length){
      return { company: chosen, assignments: [], holds: [reportHold(chosen, null, "NO_ROWS")], reportFileOmitted: true };
    }
    const parsed = { company: chosen, kind: "report", subject: "דוח " + chosen, from: "", receivedAt: "" };
    const assignments = [];
    const holds = [];
    const seen = {};
    list.forEach((row) => {
      const found = matchCustomers(row, customers);
      if(found.status !== "unique"){
        holds.push(reportHold(chosen, row, found.status));
        return;
      }
      const entry = entryFrom(parsed, row);
      entry.source = "report";
      entry.id = reportKey(chosen, row);
      entry.document = null;
      if(seen[entry.id]) return;
      seen[entry.id] = true;
      assignments.push({ customerId: String(found.customer.id || ""), entry: entry });
    });
    return { company: chosen, assignments: assignments, holds: holds, reportFileOmitted: true };
  }

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  function weekStart(now){
    const at = now instanceof Date ? now.getTime() : (typeof now === "number" ? now : Date.parse(String(now || "")));
    const base = Number.isFinite(at) ? at : Date.now();
    return new Date(base - WEEK_MS).toISOString();
  }

  function withinWeek(received, now){
    const at = Date.parse(String(received || ""));
    if(!Number.isFinite(at)) return false;
    const start = Date.parse(weekStart(now));
    return Number.isFinite(start) && at >= start;
  }

  function openCount(cases){
    return (Array.isArray(cases) ? cases : []).filter((row) => text(row && row.status) !== "handled").length;
  }

  function mergeById(serverList, localList, stamp){
    const map = new Map();
    [serverList, localList].forEach((list) => {
      (Array.isArray(list) ? list : []).forEach((row) => {
        if(!row || typeof row !== "object") return;
        const key = text(row.id || row.customerId);
        if(!key) return;
        const prev = map.get(key);
        const at = text(row.updatedAt || row.at);
        if(!prev || String(at) >= String(text(prev.updatedAt || prev.at))) map.set(key, row);
      });
    });
    return Array.from(map.values());
  }

  return {
    MAILBOX: MAILBOX,
    COMPANIES: COMPANIES,
    parseIncoming: parseIncoming,
    parseReportSheet: parseReportSheet,
    parseReportItems: parseReportItems,
    parseReportText: parseReportText,
    applyReport: applyReport,
    parseMigdalItems: parseMigdalItems,
    matchCustomers: matchCustomers,
    applyIncoming: applyIncoming,
    nameMatches: nameMatches,
    weekStart: weekStart,
    withinWeek: withinWeek,
    openCount: openCount,
    mergeById: mergeById,
    padId: padId
  };
});
