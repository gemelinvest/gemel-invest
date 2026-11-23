/* GEMEL INVEST · פגישות.
   מסך נפרד. לא משנה מסכים אחרים.
   הנתונים נשמרים ב-gi_pension_meetings. בלי הטבלה אין שמירה לדיסק המקומי. */
(function (global) {
  "use strict";

  const QUESTIONS = [
    ["salaryOver10k", "האם השכר שלך מעל 10 אלף"],
    ["hasGemelOrStudy", "האם יש קרנות השתלמות או קופות גמל"],
    ["freeMoney", "האם יש כסף פנוי שאתה מעוניין להשקיע"],
    ["maslekaApproved", "האם את/ה מאשר/ת להוציא מסלקה עבורך"]
  ];
  const SUG = {
    "1": "ביטוח חיים משולב חיסכון",
    "2": "קרן פנסיה",
    "3": "קופת גמל",
    "4": "קרן השתלמות",
    "5": "חיסכון טהור",
    "6": "ריסק"
  };
  const HAFRASHA = {
    "1": "תגמולי עובד",
    "2": "תגמולי מעסיק",
    "3": "פיצויים",
    "8": "השתלמות עובד",
    "9": "השתלמות מעסיק"
  };
  const STATUS = { "1": "פעיל", "2": "לא פעיל", "7": "לא פעיל" };
  const CLOSE = { pension_deposit: "פנסיה הפקדה חודשית", pension_transfer: "פנסיה ניוד צבירות", not_closed: "העסקה לא נסגרה" };
  const memory = { rows: [], missing: false, seen: null };
  let watchTimer = 0;
  let screenUser = null;
  let lookupError = "";
  const ui = {
    mode: "home",
    rows: [],
    meetings: [],
    detailId: "",
    form: null,
    note: "",
    busy: false,
    board: "customers",
    agentChoices: []
  };

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function host() {
    return global.GI_MEETINGS_HOST || {};
  }

  function esc(value) {
    const fn = host().escapeHtml;
    if (typeof fn === "function") return fn(value);
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function auth() {
    try { return host().auth ? host().auth() : null; } catch (_e) { return null; }
  }

  function current() {
    const a = auth();
    return a && a.current ? a.current : null;
  }

  function roleOf(person) {
    return text(person && person.role);
  }

  function sessionFlags() {
    const a = auth();
    if (!a) return null;
    try {
      return {
        admin: typeof a.isAdmin === "function" && !!a.isAdmin(),
        manager: typeof a.isManager === "function" && !!a.isManager(),
        team: typeof a.isTeamManager === "function" && !!a.isTeamManager(),
        referent: typeof a.isReferent === "function" && !!a.isReferent(),
        user: a.current || null
      };
    } catch (_e) {
      return null;
    }
  }

  function roleAllowed(role, create) {
    const value = text(role).toLowerCase();
    if (create) {
      return value === "referent" || value === "רפרנטית" || value === "סוקרת"
        || value === "manager" || value === "admin" || value === "owner" || value === "adminlite"
        || value === "מנהל" || value === "מנהל מערכת" || value === "מפתח המערכת";
    }
    return value === "referent" || value === "רפרנטית" || value === "סוקרת"
      || value === "agent" || value === "נציג"
      || value === "teammanager" || value === "מנהל צוות"
      || value === "manager" || value === "admin" || value === "owner" || value === "adminlite"
      || value === "מנהל" || value === "מנהל מערכת" || value === "מפתח המערכת";
  }

  function canOpen(person) {
    const flags = sessionFlags();
    const who = person || screenUser || (flags && flags.user) || current();
    if (!who) return false;
    if (flags && !person && flags.user) return true;
    return !!(text(who.id) || text(who.name) || text(who.role));
  }

  function canCreate(person) {
    const flags = sessionFlags();
    const who = person || screenUser || (flags && flags.user) || null;
    if (flags && (!person || person === flags.user)) {
      if (flags.admin || flags.manager || flags.referent) return true;
    }
    return roleAllowed(roleOf(who), true);
  }

  function normalizeIsraeliId(value) {
    const digits = String(value == null ? "" : value).replace(/\D/g, "").replace(/^0+/, "");
    return digits;
  }

  function displayId(value) {
    const digits = normalizeIsraeliId(value);
    if (!digits) return "";
    return digits.length >= 9 ? digits : digits.padStart(9, "0");
  }

  function normalizeBranch(value) {
    const raw = text(value);
    const low = raw.toLowerCase();
    if (raw === "מודיעין" || low === "modiin" || low === "modi'in") return "מודיעין";
    if (raw === "חיפה" || low === "haifa") return "חיפה";
    return "";
  }

  function customerVisibleToSurveyor(customer, surveyorId, branches) {
    const map = branches && typeof branches === "object" ? branches : {};
    const mine = normalizeBranch(map[surveyorId]);
    if (!mine) return false;
    const agentId = text(customer && (customer.agent_id || customer.agentId));
    if (!agentId) return false;
    return normalizeBranch(map[agentId]) === mine;
  }

  function isManagerRole(role) {
    const value = text(role).toLowerCase();
    return value === "manager" || value === "admin" || value === "owner" || value === "adminlite"
      || value === "מנהל" || value === "מנהל מערכת" || value === "מפתח המערכת";
  }

  function personMatchesAssignee(person, assigneeId, assigneeName) {
    const id = text(person && person.id);
    const name = text(person && person.name);
    if (id && text(assigneeId) && id === text(assigneeId)) return true;
    if (name && text(assigneeName) && name === text(assigneeName)) return true;
    return false;
  }

  function meetingVisible(meeting, person) {
    const who = person || current() || {};
    const role = roleOf(who);
    if (!meeting) return false;
    const flags = sessionFlags();
    if (flags && (!person || person === flags.user) && (flags.admin || flags.manager)) return true;
    if (isManagerRole(role)) return true;
    const id = text(who.id);
    if (role.toLowerCase() === "referent" || role === "סוקרת" || role === "רפרנטית") return text(meeting.created_by_id) === id;
    if (role.toLowerCase() === "agent" || role.toLowerCase() === "teammanager" || role === "נציג" || role === "מנהל צוות") {
      return personMatchesAssignee(who, meeting.assignee_id, meeting.assignee_name);
    }
    return false;
  }

  function workbookCell(row, name) {
    if (!row || typeof row !== "object") return "";
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
    const key = Object.keys(row).find((item) => text(item) === name);
    return key ? row[key] : "";
  }

  function groupWorkbookRows(rows) {
    const groups = new Map();
    (rows || []).forEach((row) => {
      const name = text(workbookCell(row, "שם לקוח") || row.customerName || row.name);
      const idNumber = normalizeIsraeliId(workbookCell(row, "תז") || workbookCell(row, "ת.ז") || row.idNumber || row.id);
      if (!name && !idNumber) return;
      const key = idNumber + "|" + name;
      if (!groups.has(key)) {
        groups.set(key, {
          name,
          idNumber,
          phone: text(workbookCell(row, "מס טלפון") || row.phone),
          agent: text(workbookCell(row, "נציג") || row.agent),
          team: text(workbookCell(row, "צוות") || row.team),
          office: text(workbookCell(row, "משרד") || row.office),
          policies: []
        });
      }
      const group = groups.get(key);
      if (!group.phone) group.phone = text(workbookCell(row, "מס טלפון") || row.phone);
      group.policies.push({
        policyNumber: text(workbookCell(row, "מס פוליסה") || row.policyNumber),
        plan: text(workbookCell(row, "שם תוכנית") || row.plan),
        status: text(workbookCell(row, "סטטוס הצעה") || row.status),
        company: text(workbookCell(row, "חברה") || row.company),
        producedAt: text(workbookCell(row, "תאריך הפקה") || row.producedAt),
        month: text(workbookCell(row, "חודש הפקה") || row.month),
        pay: text(workbookCell(row, "אופן תשלום") || row.pay)
      });
    });
    return Array.from(groups.values());
  }

  function policyPremium(policy) {
    const raw = policy && (policy.premiumAfterDiscountValue ?? policy.premiumAfterDiscount ?? policy.premiumValue ?? policy.monthlyPremium ?? policy.premiumMonthly ?? policy.premium ?? policy.premiumText ?? "");
    const num = Number(String(raw).replace(/[^\d.\-]/g, ""));
    return Number.isFinite(num) ? num : 0;
  }

  function payloadOf(customer) {
    let payload = customer && customer.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (_e) { payload = {}; }
    }
    return payload && typeof payload === "object" ? payload : {};
  }

  function collectPolicies(customer) {
    const payload = payloadOf(customer);
    const lists = []
      .concat(Array.isArray(payload.newPolicies) ? payload.newPolicies : [])
      .concat(payload.operational && Array.isArray(payload.operational.newPolicies) ? payload.operational.newPolicies : []);
    const insureds = []
      .concat(Array.isArray(payload.insureds) ? payload.insureds : [])
      .concat(payload.operational && Array.isArray(payload.operational.insureds) ? payload.operational.insureds : []);
    insureds.forEach((ins) => {
      const data = ins && ins.data && typeof ins.data === "object" ? ins.data : {};
      if (Array.isArray(data.existingPolicies)) lists.push.apply(lists, data.existingPolicies);
    });
    const seen = new Set();
    const out = [];
    lists.forEach((policy) => {
      if (!policy || typeof policy !== "object") return;
      const key = text(policy.id) || text(policy.policyNumber) + "|" + text(policy.company) + "|" + policyPremium(policy);
      if (seen.has(key)) return;
      seen.add(key);
      const id = text(policy.id);
      const production = id.indexOf("npol_prod_") === 0 || (policy.productionImport && typeof policy.productionImport === "object");
      out.push({
        id,
        company: text(policy.company || policy.insurer || policy.provider),
        plan: text(policy.planName || policy.productName || policy.name),
        policyNumber: text(policy.policyNumber || policy.policyNo),
        premium: policyPremium(policy),
        production
      });
    });
    return out;
  }

  function portfolioSummary(customer) {
    const policies = collectPolicies(customer);
    const total = policies.reduce((sum, policy) => sum + (policy.premium || 0), 0);
    return {
      name: text(customer && (customer.full_name || customer.fullName || customer.name)),
      total,
      policies
    };
  }

  function customerAddress(customer) {
    if (!customer || typeof customer !== "object") return "";
    const payload = payloadOf(customer);
    const insureds = []
      .concat(Array.isArray(payload.insureds) ? payload.insureds : [])
      .concat(payload.operational && Array.isArray(payload.operational.insureds) ? payload.operational.insureds : []);
    const data = insureds[0] && insureds[0].data && typeof insureds[0].data === "object" ? insureds[0].data : {};
    const primary = payload.primary && typeof payload.primary === "object" ? payload.primary : {};
    const contact = payload.contact && typeof payload.contact === "object" ? payload.contact : {};
    const street = text(data.street || data.StreetName || primary.street || primary.StreetName || contact.street || payload.street);
    const house = text(data.houseNumber || data.HouseNumber || primary.houseNumber || primary.HouseNumber || contact.houseNumber || payload.houseNumber);
    const apartment = text(data.apartment || primary.apartment || contact.apartment || payload.apartment);
    const city = text(data.city || data.City || primary.city || primary.City || contact.city || customer.city || payload.city);
    const line = [street, house].filter(Boolean).join(" ");
    const built = [line, apartment ? "דירה " + apartment : "", city].filter(Boolean).join(", ");
    return built || text(customer.address || contact.address || payload.address);
  }

  function customerFullName(customer) {
    const payload = payloadOf(customer);
    const primary = payload.primary && typeof payload.primary === "object" ? payload.primary : {};
    const built = [primary.firstName, primary.lastName].filter(Boolean).join(" ");
    return text(customer && (customer.full_name || customer.fullName || customer.name) || built);
  }

  function customerPhone(customer) {
    const payload = payloadOf(customer);
    const primary = payload.primary && typeof payload.primary === "object" ? payload.primary : {};
    const insureds = []
      .concat(Array.isArray(payload.insureds) ? payload.insureds : [])
      .concat(payload.operational && Array.isArray(payload.operational.insureds) ? payload.operational.insureds : []);
    const data = insureds[0] && insureds[0].data && typeof insureds[0].data === "object" ? insureds[0].data : {};
    return text(customer && customer.phone || primary.phone || data.phone || data.mobile);
  }

  function fileFacts(customer) {
    const portfolio = portfolioSummary(customer);
    return {
      name: customerFullName(customer) || portfolio.name,
      phone: customerPhone(customer),
      address: customerAddress(customer),
      premium: portfolio.total
    };
  }

  function keepLoadedRows(currentRows, nextRows) {
    if (Array.isArray(nextRows) && nextRows.length) return nextRows;
    return Array.isArray(currentRows) ? currentRows : [];
  }

  function meetingCustomer(meeting) {
    const answers = meeting && meeting.answers && typeof meeting.answers === "object" ? meeting.answers : {};
    return {
      name: text(meeting && meeting.customer_name),
      idNumber: normalizeIsraeliId(meeting && meeting.id_number),
      phone: text(answers.phone),
      address: text(answers.address),
      premium: Number(answers.premium) || 0,
      meetingId: meeting && meeting.id,
      meetingDate: text(meeting && meeting.meeting_date),
      notes: text(meeting && meeting.notes),
      answers: answers,
      masleka: meeting && meeting.masleka && typeof meeting.masleka === "object" ? meeting.masleka : {},
      maslekaFile: meeting && meeting.masleka_file && typeof meeting.masleka_file === "object" ? meeting.masleka_file : {},
      pension: !!(meeting && meeting.pension_file_opened)
    };
  }

  function treatmentStatus(meeting) {
    const status = text(meeting && meeting.status);
    const choice = text(meeting && meeting.close_choice);
    if (status === "closed") return { key: "closed", label: "העסקה נסגרה" };
    if (status === "not_closed" || choice === "not_closed") return { key: "not_closed", label: "העסקה לא נסגרה" };
    if (status === "in_treatment" || (meeting && meeting.pension_file_opened)) return { key: "started", label: "נפתח התיק והתחיל טיפול" };
    return { key: "idle", label: "התיק עדיין עומד ללא נגיעה" };
  }

  function withoutAssigned(rows, meetings) {
    const taken = new Set();
    (meetings || []).forEach((meeting) => {
      const id = normalizeIsraeliId(meeting && meeting.id_number);
      if (id) taken.add(id);
    });
    return (rows || []).filter((row) => !taken.has(normalizeIsraeliId(row && row.idNumber)));
  }

  function screenLists(person, rows, meetings) {
    const visibleMeetings = (meetings || []).filter((meeting) => meetingVisible(meeting, person));
    if (!canCreate(person)) return { customers: visibleMeetings.map(meetingCustomer), meetings: [], assigned: [] };
    const assigned = visibleMeetings.filter((meeting) => personMatchesAssignee(person, meeting.assignee_id, meeting.assignee_name)).map(meetingCustomer);
    return { customers: rows || [], meetings: visibleMeetings, assigned: assigned };
  }

  function readNodes(src, index, stopTag) {
    const nodes = [];
    let textBuf = "";
    const length = src.length;
    let i = index;
    while (i < length) {
      if (src.charAt(i) !== "<") {
        const next = src.indexOf("<", i);
        const end = next < 0 ? length : next;
        textBuf += src.slice(i, end);
        i = end;
        continue;
      }
      if (src.startsWith("</", i)) {
        const close = src.indexOf(">", i);
        const tag = src.slice(i + 2, close < 0 ? length : close).trim().split(/\s/)[0];
        if (!stopTag || tag === stopTag) return { nodes, i: (close < 0 ? length : close) + 1, text: textBuf };
        i = (close < 0 ? length : close) + 1;
        continue;
      }
      if (src.startsWith("<?", i) || src.startsWith("<!", i)) {
        const close = src.indexOf(">", i);
        i = (close < 0 ? length : close) + 1;
        continue;
      }
      const close = src.indexOf(">", i);
      if (close < 0) break;
      let raw = src.slice(i + 1, close).trim();
      const self = raw.endsWith("/");
      if (self) raw = raw.slice(0, -1).trim();
      const name = raw.split(/\s/)[0];
      i = close + 1;
      const node = { tag: name, text: "", kids: [] };
      if (!self) {
        const inner = readNodes(src, i, name);
        node.kids = inner.nodes;
        node.text = inner.text || "";
        i = inner.i;
      }
      nodes.push(node);
    }
    return { nodes, i, text: textBuf };
  }

  function parseXml(xml) {
    const src = String(xml || "").replace(/^\uFEFF/, "");
    const parsed = readNodes(src, 0, "");
    return parsed.nodes[0] || null;
  }

  function kids(node, tag) {
    return (node && node.kids || []).filter((item) => item.tag === tag);
  }

  function one(node, tag) {
    return kids(node, tag)[0] || null;
  }

  function val(node, tag) {
    const child = one(node, tag);
    return text(child && child.text);
  }

  function num(value) {
    const n = Number(String(value == null ? "" : value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    const n = typeof value === "number" ? value : num(value);
    if (!n) return "";
    try {
      return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
    } catch (_e) {
      return String(Math.round(n));
    }
  }

  function prettyDate(value) {
    const raw = text(value);
    if (/^\d{8}$/.test(raw)) return raw.slice(6, 8) + "." + raw.slice(4, 6) + "." + raw.slice(0, 4);
    if (/^\d{6}$/.test(raw)) return raw.slice(4, 6) + "/" + raw.slice(0, 4);
    if (/^\d{14}$/.test(raw)) return raw.slice(6, 8) + "." + raw.slice(4, 6) + "." + raw.slice(0, 4);
    return raw;
  }

  function findAll(node, tag, out) {
    const list = out || [];
    (node && node.kids || []).forEach((kid) => {
      if (kid.tag === tag) list.push(kid);
      findAll(kid, tag, list);
    });
    return list;
  }

  function firstText(node, tag) {
    const found = findAll(node, tag)[0];
    return text(found && found.text);
  }

  function yitraRows(account) {
    const rows = [];
    findAll(account, "BlockItrot").forEach((block) => {
      kids(block, "Yitrot").forEach((yitra) => {
        kids(yitra, "PerutYitrot").forEach((row) => rows.push(row));
      });
    });
    return rows;
  }

  function productFromAccount(account, meta) {
    const partMap = new Map();
    let total = 0;
    yitraRows(account).forEach((row) => {
      const amount = num(val(row, "TOTAL-CHISACHON-MTZBR"));
      if (!amount) return;
      total += amount;
      const label = HAFRASHA[val(row, "KOD-SUG-HAFRASHA") || val(row, "SUG-HAFRASHA")] || "צבירה";
      partMap.set(label, (partMap.get(label) || 0) + amount);
    });
    const parts = Array.from(partMap.entries()).map((entry) => ({ label: entry[0], amount: entry[1] }));
    const last = findAll(account, "PirteiHafkadaAchrona")[0] || null;
    const fees = findAll(account, "HotzaotBafoalLehodeshDivoach")[0] || null;
    const future = one(account, "YitraLefiGilPrisha");
    const cover = findAll(account, "KisuiBKerenPensia")[0] || null;
    const tracks = findAll(account, "PerutMasluleiHashkaa");
    const seenTrack = new Set();
    const trackRows = [];
    tracks.forEach((track) => {
      const name = val(track, "SHEM-MASLUL-HASHKAA");
      const amount = num(val(track, "SCHUM-TZVIRA-BAMASLUL"));
      const key = name + "|" + amount;
      if (!name || seenTrack.has(key)) return;
      seenTrack.add(key);
      trackRows.push({ name, amount, fee: val(track, "SHEUR-DMEI-NIHUL-HAFKADA") });
    });
    const salary = firstText(account, "SACHAR-BERAMAT-HAFKADA");
    const employer = (meta.employers || []).map((item) => val(item, "SHEM-MAASIK")).filter(Boolean)[0] || "";
    return {
      company: meta.company,
      sug: meta.sug,
      sugLabel: SUG[meta.sug] || "מוצר",
      name: val(account, "SHEM-TOCHNIT"),
      account: val(account, "MISPAR-POLISA-O-HESHBON"),
      status: STATUS[val(account, "STATUS-POLISA-O-CHESHBON")] || "",
      total,
      parts,
      joined: prettyDate(val(account, "TAARICH-HITZTARFUT-RISHON") || val(account, "TAARICH-HITZTARFUT-MUTZAR")),
      valid: prettyDate(val(account, "TAARICH-NECHONUT")),
      lastDeposit: prettyDate(val(last, "TAARICH-HAFKADA-ACHARON")),
      lastDepositSum: num(val(last, "TOTAL-HAFKADA") || val(last, "TOTAL-HAFKADA-ACHRONA")),
      feeDeposit: val(fees, "SHEUR-DMEI-NIHUL-HAFKADA"),
      feeBalance: val(fees, "SHEUR-DMEI-NIHUL-TZVIRA"),
      projected: num(val(future, "TOTAL-CHISACHON-MITZTABER-TZAFUY")),
      projectedNoPrem: num(val(future, "TZVIRAT-CHISACHON-CHAZUYA-LELO-PREMIYOT")),
      retireAge: val(future, "GIL-PRISHA"),
      salary: num(salary),
      employer,
      disability: num(val(cover, "SACH-PENSIAT-NECHUT")),
      spouse: num(val(cover, "KITZBAT-SHEERIM-LEALMAN-O-ALMANA")),
      child: num(val(cover, "KITZBAT-SHEERIM-LEYATOM")),
      deathCover: num(firstText(account, "SCHUM-BITUAH-LEMAVET")),
      premium: num(val(last, "TOTAL-HAFKADA")),
      tracks: trackRows,
      when: meta.when,
      person: meta.person
    };
  }

  function parseMaslekaXml(xmlText, fileName) {
    const root = parseXml(xmlText);
    if (!root || root.tag !== "Mimshak") return [];
    const when = val(one(root, "KoteretKovetz"), "TAARICH-BITZUA");
    const products = [];
    kids(root, "YeshutYatzran").forEach((maker) => {
      const company = val(maker, "SHEM-YATZRAN");
      kids(one(maker, "Mutzarim"), "Mutzar").forEach((item) => {
        const net = one(item, "NetuneiMutzar");
        const personNode = one(net, "YeshutLakoach");
        const person = {
          first: val(personNode, "SHEM-PRATI"),
          last: val(personNode, "SHEM-MISHPACHA"),
          id: normalizeIsraeliId(val(personNode, "MISPAR-ZIHUY-LAKOACH")),
          birth: prettyDate(val(personNode, "TAARICH-LEYDA"))
        };
        const meta = {
          company,
          sug: val(net, "SUG-MUTZAR"),
          when,
          person,
          employers: kids(net, "YeshutMaasik")
        };
        kids(one(item, "HeshbonotOPolisot"), "HeshbonOPolisa").forEach((account) => {
          products.push(productFromAccount(account, meta));
        });
      });
    });
    products.fileName = fileName || "";
    return products;
  }

  function parseMaslekaPackage(files) {
    const all = [];
    (files || []).forEach((file) => {
      const name = text(file && file.name);
      if (!/\.xml$/i.test(name)) return;
      const body = typeof file.text === "string" ? file.text : "";
      if (!body) return;
      parseMaslekaXml(body, name).forEach((product) => all.push(product));
    });
    const best = new Map();
    all.forEach((product) => {
      const key = [product.company, product.account, product.sug].join("|");
      const prev = best.get(key);
      if (!prev || text(product.when) > text(prev.when)) best.set(key, product);
    });
    const products = Array.from(best.values()).filter((product) => product.total || product.deathCover || product.premium || product.name);
    const person = (products[0] && products[0].person) || {};
    const savings = products.reduce((sum, product) => sum + (product.sug === "6" ? 0 : product.total), 0);
    return {
      person,
      products,
      savings,
      active: products.filter((product) => product.status === "פעיל").length,
      companies: Array.from(new Set(products.map((product) => product.company).filter(Boolean))).length
    };
  }

  function decodeXml(bytes) {
    try { return new TextDecoder("utf-8").decode(bytes); } catch (_e) { return ""; }
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== "function") throw new Error("inflate");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function unzip(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    const min = Math.max(0, bytes.length - 22 - 65535);
    for (let i = bytes.length - 22; i >= min; i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("zip");
    const count = view.getUint16(eocd + 10, true);
    let central = view.getUint32(eocd + 16, true);
    const files = [];
    for (let n = 0; n < count; n += 1) {
      if (central + 46 > bytes.length || view.getUint32(central, true) !== 0x02014b50) break;
      const method = view.getUint16(central + 10, true);
      const compSize = view.getUint32(central + 20, true);
      const nameLen = view.getUint16(central + 28, true);
      const extraLen = view.getUint16(central + 30, true);
      const commentLen = view.getUint16(central + 32, true);
      const localOff = view.getUint32(central + 42, true);
      const name = decodeXml(bytes.subarray(central + 46, central + 46 + nameLen));
      central += 46 + nameLen + extraLen + commentLen;
      if (!name || name.endsWith("/")) continue;
      const localName = view.getUint16(localOff + 26, true);
      const localExtra = view.getUint16(localOff + 28, true);
      const start = localOff + 30 + localName + localExtra;
      const comp = bytes.subarray(start, start + compSize);
      let raw = null;
      if (method === 0) raw = comp;
      else if (method === 8) raw = await inflateRaw(comp);
      else continue;
      files.push({ name: name.split("/").pop(), bytes: raw, text: /\.xml$/i.test(name) ? decodeXml(raw) : "" });
    }
    return files;
  }

  async function filesFromUpload(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const name = text(file.name);
    if (/\.xml$/i.test(name)) return [{ name, text: decodeXml(buf), bytes: buf }];
    if (!/\.zip$/i.test(name)) return [];
    const first = await unzip(buf);
    return expandUploads(first, 0);
  }

  async function expandUploads(entries, depth) {
    const out = [];
    const list = entries || [];
    for (let i = 0; i < list.length; i += 1) {
      const entry = list[i];
      if (!entry) continue;
      if (/\.zip$/i.test(entry.name) && depth < 5 && entry.bytes) {
        try {
          const nested = await unzip(entry.bytes);
          const inner = await expandUploads(nested, depth + 1);
          inner.forEach((item) => out.push(item));
          continue;
        } catch (_e) {}
      }
      out.push(entry);
    }
    return out;
  }

  function client() {
    try { return host().client ? host().client() : null; } catch (_e) { return null; }
  }

  function missingTable(error) {
    if (!error) return false;
    const code = text(error.code);
    const message = text(error.message || "");
    if (code === "42P01") return true;
    if (code === "PGRST205" && /gi_pension_meetings/i.test(message)) return true;
    return /could not find the table ['"]public\.gi_pension_meetings['"]/i.test(message);
  }

  function readAccessToken(session, stored) {
    const direct = text(session && session.access_token);
    if (direct) return direct;
    let parsed = stored;
    if (typeof stored === "string") {
      try { parsed = JSON.parse(stored); } catch (_e) { parsed = null; }
    }
    if (!parsed || typeof parsed !== "object") return "";
    const nested = parsed.data && parsed.data.session;
    return text(
      parsed.access_token
      || (parsed.currentSession && parsed.currentSession.access_token)
      || (parsed.session && parsed.session.access_token)
      || (nested && nested.access_token)
    );
  }

  async function accessToken() {
    const db = client();
    try {
      if (db && db.auth && typeof db.auth.getSession === "function") {
        const sess = await db.auth.getSession();
        const token = readAccessToken(sess && sess.data && sess.data.session, null);
        if (token) return token;
      }
    } catch (_e) {}
    try {
      if (typeof localStorage === "undefined" || !localStorage || typeof localStorage.getItem !== "function") return "";
      return readAccessToken(null, localStorage.getItem("gemel_invest_sb_auth_v1"));
    } catch (_e) {
      return "";
    }
  }

  function restConfig() {
    const remote = host();
    const db = client();
    const url = text(remote.supabaseUrl || (db && db.supabaseUrl) || ROSTER_URL).replace(/\/$/, "");
    const key = text(remote.supabaseKey || (db && db.supabaseKey) || ROSTER_KEY);
    if (!url || !key) return null;
    return { url: url, key: key };
  }

  async function restMeetings(method, query, body) {
    const cfg = restConfig();
    const token = await accessToken();
    if (!cfg || !token || typeof fetch !== "function") return { ok: false, error: { code: "NO_SESSION", message: "אין כניסה מאומתת למסד" }, data: null };
    const headers = {
      apikey: cfg.key,
      Authorization: "Bearer " + token,
      Accept: "application/json"
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers.Prefer = "return=representation";
    }
    let response;
    try {
      response = await fetch(cfg.url + "/rest/v1/gi_pension_meetings" + (query || ""), {
        method: method,
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (err) {
      return { ok: false, error: { code: "FETCH", message: text(err && (err.message || err)) }, data: null };
    }
    let data = null;
    try { data = await response.json(); } catch (_e) { data = null; }
    if (!response.ok) {
      const error = data && typeof data === "object" ? data : { message: text(response.status) };
      return { ok: false, error: error, data: null };
    }
    return { ok: true, error: null, data: data };
  }

  function rowFromDb(row) {
    return {
      id: row.id,
      created_at: row.created_at,
      created_by_id: row.created_by_id,
      created_by_name: row.created_by_name,
      assignee_id: row.assignee_id,
      assignee_name: row.assignee_name,
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      id_number: row.id_number,
      meeting_date: row.meeting_date,
      answers: row.answers || {},
      notes: row.notes || "",
      masleka: row.masleka || {},
      masleka_file: row.masleka_file || {},
      status: row.status || "open",
      close_choice: row.close_choice || "",
      pension_file_opened: !!row.pension_file_opened
    };
  }

  function applyLoaded(rows, who) {
    memory.missing = false;
    ui.meetings = (rows || []).map(rowFromDb).filter((row) => meetingVisible(row, who));
    return ui.meetings;
  }

  async function loadMeetings() {
    const who = current();
    const remote = await restMeetings("GET", "?select=*&order=created_at.desc&limit=200");
    if (remote.ok) return applyLoaded(Array.isArray(remote.data) ? remote.data : [], who);
    const db = client();
    if (db && who && remote.error && remote.error.code === "NO_SESSION") {
      const res = await db.from("gi_pension_meetings").select("*").order("created_at", { ascending: false }).limit(200);
      if (!res.error) return applyLoaded(res.data || [], who);
      memory.missing = missingTable(res.error);
      ui.meetings = memory.rows.filter((row) => meetingVisible(row, who));
      return ui.meetings;
    }
    memory.missing = missingTable(remote.error);
    ui.meetings = memory.rows.filter((row) => meetingVisible(row, who));
    return ui.meetings;
  }

  async function saveMeeting(record) {
    const remote = await restMeetings("POST", "", record);
    if (remote.ok) {
      memory.missing = false;
      memory.rows = memory.rows.filter((row) => row.id !== record.id);
      return { ok: true };
    }
    if (remote.error && remote.error.code === "NO_SESSION") {
      const db = client();
      if (db) {
        const res = await db.from("gi_pension_meetings").insert(record);
        if (!res.error) {
          memory.missing = false;
          memory.rows = memory.rows.filter((row) => row.id !== record.id);
          return { ok: true };
        }
        memory.missing = missingTable(res.error);
        if (memory.missing) {
          memory.rows.unshift(record);
          return { ok: true, memory: true };
        }
        return { ok: false, error: text(res.error.message || res.error) || "הפגישה לא נשמרה." };
      }
    }
    memory.missing = missingTable(remote.error);
    if (memory.missing) {
      memory.rows.unshift(record);
      return { ok: true, memory: true };
    }
    return { ok: false, error: text(remote.error && (remote.error.message || remote.error.code)) || "הפגישה לא נשמרה." };
  }

  async function updateMeeting(id, patch) {
    const body = Object.assign({ updated_at: new Date().toISOString() }, patch);
    const remote = await restMeetings("PATCH", "?id=eq." + encodeURIComponent(id), body);
    if (remote.ok) return { ok: true };
    const db = client();
    if (!db || memory.missing) {
      const row = memory.rows.find((item) => item.id === id);
      if (row) Object.assign(row, patch);
      return { ok: !!row, memory: true };
    }
    const res = await db.from("gi_pension_meetings").update(body).eq("id", id);
    if (res.error) return { ok: false, error: text(res.error.message || res.error) };
    return { ok: true };
  }

  function branches() {
    try {
      const state = host().state ? host().state() : null;
      return (state && state.data && state.data.meta && state.data.meta.agentBranches) || {};
    } catch (_e) {
      return {};
    }
  }

  function userName(agent) {
    return text(agent && (agent.name || agent.full_name || agent.fullName || agent.username));
  }

  function isAssignableAgent(agent) {
    if (!agent || agent.active === false || agent.active === "false") return false;
    return !!userName(agent);
  }

  function matchUserName(name, query) {
    const wanted = text(query);
    if (!wanted) return true;
    return text(name).indexOf(wanted) >= 0;
  }

  function readLocalAgents() {
    try {
      const state = host().state ? host().state() : null;
      const data = state && state.data ? state.data : {};
      const primary = Array.isArray(data.agents) ? data.agents : [];
      const shadow = data.meta && Array.isArray(data.meta.agentsShadow) ? data.meta.agentsShadow : [];
      const byId = new Map();
      primary.concat(shadow).forEach((agent) => {
        if (!agent) return;
        const key = text(agent.id) || text(agent.name || agent.username);
        if (!key || byId.has(key)) return;
        byId.set(key, agent);
      });
      return Array.from(byId.values());
    } catch (_e) {
      return [];
    }
  }

  function rosterRows(data) {
    let payload = data;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (_e) { payload = null; }
    }
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    return []
      .concat(Array.isArray(payload.agents) ? payload.agents : [])
      .concat(Array.isArray(payload.agentsShadow) ? payload.agentsShadow : []);
  }

  const ROSTER_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const ROSTER_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";

  function rosterEndpoint(db) {
    const remote = host();
    const url = text(remote.supabaseUrl || (db && db.supabaseUrl) || ROSTER_URL).replace(/\/$/, "");
    const key = text(remote.supabaseKey || (db && db.supabaseKey) || ROSTER_KEY);
    if (!url || !key) return null;
    return { url: url, key: key };
  }

  async function fetchRoster(db) {
    const cfg = rosterEndpoint(db);
    if (!cfg || typeof fetch !== "function") return { rows: [], error: "" };
    try {
      const res = await fetch(cfg.url + "/rest/v1/rpc/gi_login_roster", {
        method: "POST",
        headers: {
          apikey: cfg.key,
          Authorization: "Bearer " + cfg.key,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: "{}"
      });
      let data = null;
      try { data = await res.json(); } catch (_e) { data = null; }
      if (!res.ok) {
        const msg = data && (data.message || data.error || data.hint);
        return { rows: [], error: text(msg || res.status) };
      }
      return { rows: rosterRows(data), error: "" };
    } catch (err) {
      return { rows: [], error: text(err && (err.message || err)) };
    }
  }

  async function readServerAgents(db) {
    const rows = [];
    let error = "";
    const roster = await fetchRoster(db);
    if (roster.error) error = roster.error;
    rows.push.apply(rows, roster.rows);
    if (db && typeof db.rpc === "function") {
      try {
        const res = await db.rpc("gi_login_roster");
        if (res && res.error) error = error || text(res.error.message || res.error);
        else rows.push.apply(rows, rosterRows(res && res.data));
      } catch (err) {
        error = error || text(err && (err.message || err));
      }
    }
    if (!rows.length && db && typeof db.from === "function") {
      try {
        const res = await db.from("agents").select("id,name,username,role,active").limit(1000);
        if (res && res.error) error = error || text(res.error.message || res.error);
        else if (res && Array.isArray(res.data)) rows.push.apply(rows, res.data);
      } catch (err) {
        error = error || text(err && (err.message || err));
      }
    }
    return { rows: rows, error: rows.length ? "" : error };
  }

  function agents() {
    const source = Array.isArray(ui.agentChoices) && ui.agentChoices.length ? ui.agentChoices : readLocalAgents();
    return source.filter(isAssignableAgent).map((agent) => ({
      id: text(agent.id) || userName(agent),
      name: userName(agent),
      role: text(agent.role),
      active: agent.active !== false
    })).sort((a, b) => a.name.localeCompare(b.name, "he"));
  }

  function rosterFirst(localRows, serverRows) {
    const byId = new Map();
    const names = new Set();
    const add = (agent, skipSameName) => {
      if (!isAssignableAgent(agent)) return;
      const name = userName(agent);
      const id = text(agent.id) || name;
      if (!id || byId.has(id)) return;
      if (skipSameName && name && names.has(name)) return;
      byId.set(id, agent);
      if (name) names.add(name);
    };
    (serverRows || []).forEach((agent) => add(agent, false));
    (localRows || []).forEach((agent) => add(agent, true));
    return Array.from(byId.values());
  }

  async function ensureAgents() {
    const db = client();
    const server = await readServerAgents(db);
    const byId = new Map();
    rosterFirst(readLocalAgents(), server.rows).forEach((agent) => {
      const id = text(agent.id) || userName(agent);
      if (id && !byId.has(id)) byId.set(id, agent);
    });
    const serverError = server.error;
    if (byId.size) {
      ui.agentChoices = Array.from(byId.values());
      ui.agentError = "";
    } else {
      ui.agentChoices = [];
      ui.agentError = serverError || "לא נטענה רשימת הנציגים";
    }
    return agents();
  }

  function customerIdOf(customer) {
    const direct = normalizeIsraeliId(customer && (customer.id_number || customer.idNumber));
    if (direct) return direct;
    const payload = payloadOf(customer);
    const primary = payload.primary && typeof payload.primary === "object" ? payload.primary : {};
    const insured = payload.insureds && payload.insureds[0] && payload.insureds[0].data;
    return normalizeIsraeliId(primary.idNumber || (insured && insured.idNumber));
  }

  function recordHasFile(customer) {
    const payload = payloadOf(customer);
    const primary = payload.primary && typeof payload.primary === "object" ? payload.primary : {};
    const operational = payload.operational && typeof payload.operational === "object" ? payload.operational : null;
    const insureds = []
      .concat(Array.isArray(payload.insureds) ? payload.insureds : [])
      .concat(operational && Array.isArray(operational.insureds) ? operational.insureds : []);
    if (insureds.length) return true;
    if (Array.isArray(payload.newPolicies) && payload.newPolicies.length) return true;
    if (operational && Array.isArray(operational.newPolicies) && operational.newPolicies.length) return true;
    return !!text(primary.street || primary.houseNumber || primary.phone || primary.firstName || primary.lastName);
  }

  function idLookupKeys(ids) {
    const keys = new Set();
    (ids || []).forEach((raw) => {
      const digits = String(raw == null ? "" : raw).replace(/\D/g, "").slice(0, 9);
      if (digits) keys.add(digits);
      const stripped = digits.replace(/^0+/, "");
      if (!stripped) return;
      keys.add(stripped);
      if (stripped.length < 9) keys.add(stripped.padStart(9, "0"));
    });
    return Array.from(keys);
  }

  function canSeeCustomerFile(customer, who) {
    if (canCreate(who)) return true;
    const role = roleOf(who);
    if (isManagerRole(role)) return true;
    const flags = sessionFlags();
    if (flags && (!who || who === flags.user) && (flags.admin || flags.manager)) return true;
    const agentId = text(customer && (customer.agent_id || customer.agentId));
    const low = role.toLowerCase();
    if (low === "referent" || role === "סוקרת" || role === "רפרנטית") {
      const map = branches();
      if (!normalizeBranch(map[who && who.id])) return true;
      return customerVisibleToSurveyor({ agent_id: agentId }, who && who.id, map);
    }
    if (low === "agent" || low === "teammanager" || role === "נציג" || role === "מנהל צוות") {
      return agentId && agentId === text(who && who.id);
    }
    return false;
  }

  async function lookupCustomers(ids) {
    const wanted = new Set((ids || []).map(normalizeIsraeliId).filter(Boolean));
    const who = current();
    const byId = new Map();
    lookupError = "";
    const put = (customer, prefer) => {
      if (!customer || typeof customer !== "object") return;
      const id = customerIdOf(customer);
      if (!id || !wanted.has(id)) return;
      if (!canSeeCustomerFile(customer, who)) return;
      const prev = byId.get(id);
      const rich = recordHasFile(customer);
      if (!prev || (rich && !recordHasFile(prev)) || (prefer && rich)) byId.set(id, customer);
    };
    try {
      const state = host().state ? host().state() : null;
      const data = state && state.data ? state.data : {};
      const lists = []
        .concat(Array.isArray(data.customers) ? data.customers : [])
        .concat(data.meta && Array.isArray(data.meta.customersShadow) ? data.meta.customersShadow : []);
      lists.forEach((row) => put(row, false));
    } catch (_e) {}
    const db = client();
    const needsFile = () => Array.from(wanted).filter((id) => {
      const row = byId.get(id);
      return !row || !recordHasFile(row);
    });
    if (db && typeof db.from === "function") {
      const keys = idLookupKeys(needsFile());
      for (let i = 0; i < keys.length; i += 20) {
        const slice = keys.slice(i, i + 20);
        try {
          const res = await db.from("customers").select("id,full_name,id_number,phone,city,agent_id,agent_name,payload").in("id_number", slice);
          if (res && res.error) lookupError = text(res.error.message || res.error);
          else if (res && Array.isArray(res.data)) res.data.forEach((row) => put(row, true));
        } catch (err) {
          lookupError = text(err && (err.message || err));
        }
      }
    }
    const still = needsFile();
    if (db && still.length && typeof db.rpc === "function") {
      try {
        const res = await db.rpc("gi_meeting_lookup_customers", { id_numbers: idLookupKeys(still) });
        let rows = res && res.data;
        if (typeof rows === "string") {
          try { rows = JSON.parse(rows); } catch (_parse) { rows = []; }
        }
        if (res && res.error) lookupError = text(res.error.message || res.error);
        else (Array.isArray(rows) ? rows : []).forEach((row) => put(row, true));
      } catch (err) {
        lookupError = text(err && (err.message || err));
      }
    }
    return Array.from(byId.values());
  }

  function root() {
    return typeof document !== "undefined" ? document.getElementById("view-meetings") : null;
  }

  function toast(title, textBody) {
    try {
      if (typeof host().toast === "function") host().toast({ title, text: textBody, variant: "info" });
      else if (global.showToast) global.showToast({ title, text: textBody, variant: "info" });
    } catch (_e) {}
  }

  function field(label, value) {
    const shown = text(value);
    if (!shown) return "";
    return '<div class="giMeet__field"><span>' + esc(label) + "</span><b>" + esc(shown) + "</b></div>";
  }

  function productCard(product) {
    const parts = (product.parts || []).map((part) => '<div class="giMeet__part"><span>' + esc(part.label) + "</span><b>" + esc(money(part.amount)) + "</b></div>").join("");
    const body = [
      field("חשבון / פוליסה", product.account),
      field("סטטוס", product.status),
      field("מעסיק", product.employer),
      field("הצטרפות", product.joined),
      field("נכונות", product.valid),
      field("הפקדה אחרונה", [product.lastDeposit, money(product.lastDepositSum)].filter(Boolean).join(" · ")),
      field("דמי ניהול מהפקדה", product.feeDeposit ? product.feeDeposit + "%" : ""),
      field("דמי ניהול מצבירה", product.feeBalance ? product.feeBalance + "%" : ""),
      field("שכר", money(product.salary)),
      field("חיסכון צפוי", money(product.projected)),
      field("צפוי בלי פרמיות", money(product.projectedNoPrem)),
      field("פנסיית נכות", money(product.disability)),
      field("שארים בן/בת זוג", money(product.spouse)),
      field("שארים ילדים", money(product.child)),
      field("ביטוח מוות", money(product.deathCover)),
      field("פרמיה", money(product.premium))
    ].join("");
    const tracks = (product.tracks || []).slice(0, 6).map((track) => '<div class="giMeet__policy"><b>' + esc(track.name) + "</b> · " + esc(money(track.amount) || "") + "</div>").join("");
    return '<article class="giMeet__card"><div class="giMeet__cardTop"><div><p class="giMeet__name">' + esc(product.name || product.sugLabel) + '</p><div class="giMeet__meta"><span>' + esc(product.company) + "</span><span>" + esc(product.sugLabel) + "</span></div></div><b>" + esc(money(product.total) || money(product.deathCover) || "") + '</b></div>'
      + (parts ? '<div class="giMeet__parts">' + parts + "</div>" : "")
      + '<div class="giMeet__grid">' + body + "</div>"
      + (tracks ? '<div class="giMeet__policies">' + tracks + "</div>" : "")
      + "</article>";
  }

  function maslekaHtml(report) {
    if (!report || !Array.isArray(report.products) || !report.products.length) return "";
    const person = report.person || {};
    const groups = {};
    report.products.forEach((product) => {
      const key = product.sugLabel || "מוצר";
      if (!groups[key]) groups[key] = [];
      groups[key].push(product);
    });
    const kpis = '<div class="giMeet__kpis">'
      + '<div class="giMeet__kpi"><span>סה״כ צבירה</span><b>' + esc(money(report.savings)) + "</b></div>"
      + '<div class="giMeet__kpi"><span>מוצרים</span><b>' + esc(report.products.length) + "</b></div>"
      + '<div class="giMeet__kpi"><span>פעילים</span><b>' + esc(report.active || 0) + "</b></div>"
      + '<div class="giMeet__kpi"><span>חברות</span><b>' + esc(report.companies || 0) + "</b></div>"
      + "</div>";
    const who = '<div class="giMeet__meta"><span>' + esc([person.first, person.last].filter(Boolean).join(" ")) + "</span>"
      + (person.id ? '<span class="giMeet__num">' + esc(person.id) + "</span>" : "")
      + (person.birth ? "<span>" + esc(person.birth) + "</span>" : "")
      + "</div>";
    const sections = Object.keys(groups).map((key) => '<h3 class="giMeet__section">' + esc(key) + "</h3>" + groups[key].map(productCard).join("")).join("");
    return who + kpis + sections;
  }

  function answersHtml(answers) {
    return '<div class="giMeet__pills">' + QUESTIONS.map((pair) => {
      const yes = !!(answers && answers[pair[0]]);
      return '<span class="giMeet__pill ' + (yes ? "giMeet__pill--yes" : "giMeet__pill--no") + '">' + esc(pair[1]) + " · " + (yes ? "כן" : "לא") + "</span>";
    }).join("") + "</div>";
  }

  function meetingCard(meeting) {
    const closed = meeting.status === "closed";
    const badge = closed
      ? '<span class="giMeet__pill">נוצר תיק פנסיוני בסוכנות · ' + esc(CLOSE[meeting.close_choice] || "") + "</span>"
      : '<span class="giMeet__pill giMeet__pill--open">פתוחה</span>';
    return '<article class="giMeet__card"><div class="giMeet__cardTop"><div><p class="giMeet__name">' + esc(meeting.customer_name || "לקוח") + '</p><div class="giMeet__meta"><span class="giMeet__num">' + esc(displayId(meeting.id_number)) + "</span><span>" + esc(meeting.meeting_date || "") + "</span><span>" + esc(meeting.assignee_name || "") + "</span></div>"
      + answersHtml(meeting.answers)
      + (meeting.notes ? '<p class="giMeet__meta">' + esc(meeting.notes) + "</p>" : "")
      + badge
      + '</div><button class="giMeet__btn" type="button" data-open="' + esc(meeting.id) + '">פתח</button></div>'
      + assignedSnapshot(meeting)
      + "</article>";
  }

  function assignedSnapshot(meeting) {
    const answers = meeting && meeting.answers && typeof meeting.answers === "object" ? meeting.answers : {};
    return '<div class="giMeet__facts">'
      + factHtml("טלפון", answers.phone, true)
      + factHtml("כתובת", answers.address)
      + factHtml("פרמיה בתיק", money(answers.premium))
      + "</div>"
      + maslekaHtml(meeting && meeting.masleka);
  }

  function detailHtml(meeting) {
    const who = current();
    const assignee = personMatchesAssignee(who, meeting.assignee_id, meeting.assignee_name);
    const done = meeting.status === "closed" || meeting.status === "not_closed";
    const closeBox = assignee && !done
      ? '<div class="giMeet__card"><h3 class="giMeet__section">סטטוס מהנציג</h3><div class="giMeet__checks"><label><input type="radio" name="giMeetClose" value="pension_deposit"/> פנסיה הפקדה חודשית</label><label><input type="radio" name="giMeetClose" value="pension_transfer"/> פנסיה ניוד צבירות</label></div><div class="giMeet__actions"><button class="giMeet__btn giMeet__btn--primary" type="button" data-close="' + esc(meeting.id) + '" disabled>העסקה נסגרה</button><button class="giMeet__btn" type="button" data-close="' + esc(meeting.id) + '" data-choice="not_closed">העסקה לא נסגרה</button></div></div>'
      : "";
    const file = meeting.masleka_file && meeting.masleka_file.storagePath
      ? '<button class="giMeet__btn" type="button" data-download="' + esc(meeting.id) + '">הורדת דוח מסלקה</button>'
      : "";
    const answers = meeting.answers && typeof meeting.answers === "object" ? meeting.answers : {};
    return '<button class="giMeet__btn giMeet__back" type="button" data-back="1">חזרה</button>'
      + '<div class="giMeet__head"><div><h1>' + esc(meeting.customer_name || "פגישה") + "</h1><p>" + esc(meeting.meeting_date || "") + " · " + esc(meeting.assignee_name || "") + "</p></div><div class=\"giMeet__actions\">" + file + "</div></div>"
      + '<div class="giMeet__facts">'
      + factHtml("תעודת זהות", displayId(meeting.id_number), true)
      + factHtml("טלפון", answers.phone, true)
      + factHtml("כתובת", answers.address)
      + factHtml("פרמיה בתיק", money(answers.premium))
      + "</div>"
      + answersHtml(meeting.answers)
      + (meeting.notes ? '<div class="giMeet__note"><b>הערות לנציג</b><p>' + esc(meeting.notes) + "</p></div>" : "")
      + maslekaHtml(meeting.masleka)
      + closeBox;
  }

  function restoreRows() {
    if (ui.rows && ui.rows.length) return;
    try {
      if (typeof sessionStorage === "undefined") return;
      const parsed = JSON.parse(sessionStorage.getItem("giMeetings.loadedRows") || "[]");
      if (Array.isArray(parsed)) ui.rows = parsed.filter((row) => row && (row.name || row.idNumber));
    } catch (_e) {}
  }

  function persistRows() {
    try {
      if (typeof sessionStorage === "undefined") return;
      const slim = (ui.rows || []).map((row) => ({
        name: row.name || "",
        idNumber: row.idNumber || "",
        phone: row.phone || "",
        agent: row.agent || "",
        team: row.team || "",
        office: row.office || "",
        phone: row.phone || "",
        address: row.address || "",
        premium: row.premium || 0,
        customerId: row.customerId || (row.customer && row.customer.id) || "",
        policies: Array.isArray(row.policies) ? row.policies : [],
        portfolioPolicies: portfolioPoliciesOf(row)
      }));
      sessionStorage.setItem("giMeetings.loadedRows", JSON.stringify(slim));
    } catch (_e) {}
  }

  function factHtml(label, value, numeric, wide) {
    return '<div class="giMeet__fact' + (wide ? " giMeet__fact--wide" : "") + '"><span>' + esc(label) + '</span><b' + (numeric ? ' class="giMeet__num"' : "") + ">" + esc(text(value)) + "</b></div>";
  }

  function portfolioPoliciesOf(row) {
    if (row && row.portfolio && Array.isArray(row.portfolio.policies)) return row.portfolio.policies;
    return row && Array.isArray(row.portfolioPolicies) ? row.portfolioPolicies : [];
  }

  function customerRowHtml(row, create) {
    const closed = row.pension || ui.meetings.some((meeting) => normalizeIsraeliId(meeting.id_number) === row.idNumber && meeting.pension_file_opened);
    const actions = row.meetingId
      ? '<button class="giMeet__btn" type="button" data-open="' + esc(row.meetingId) + '">פתח</button>'
      : (create ? '<button class="giMeet__btn giMeet__btn--primary" type="button" data-new-id="' + esc(row.idNumber) + '">הקמת פגישה</button>' : "");
    const extra = row.meetingId
      ? '<div class="giMeet__rowExtra"><div class="giMeet__facts">'
        + factHtml("תאריך הפגישה", row.meetingDate)
        + factHtml("פרמיה בתיק", money(row.premium))
        + "</div>"
        + answersHtml(row.answers)
        + (row.notes ? '<p class="giMeet__meta">' + esc(row.notes) + "</p>" : "")
        + maslekaHtml(row.masleka)
        + (row.maslekaFile && row.maslekaFile.storagePath
          ? '<button class="giMeet__btn" type="button" data-download="' + esc(row.meetingId) + '">' + esc(row.maslekaFile.name || "הורדת דוח מסלקה") + "</button>"
          : "")
        + "</div>"
      : "";
    return '<article class="giMeet__row"><div class="giMeet__rowMain"><p class="giMeet__name">' + esc(row.name || "לקוח") + "</p>"
      + (closed ? '<span class="giMeet__pill">נוצר תיק פנסיוני בסוכנות</span>' : "")
      + '</div><div class="giMeet__facts">'
      + factHtml("תעודת זהות", displayId(row.idNumber), true)
      + factHtml("טלפון", row.phone, true)
      + factHtml("כתובת", row.address)
      + '</div><div class="giMeet__actions">' + actions + "</div>" + extra + "</article>";
  }

  function statusPill(meeting) {
    const state = treatmentStatus(meeting);
    return '<span class="giMeet__pill giMeet__pill--' + esc(state.key) + '">' + esc(state.label) + "</span>";
  }

  function fileRowHtml(meeting) {
    const row = meetingCustomer(meeting);
    return '<article class="giMeet__row giMeet__row--file"><div class="giMeet__rowMain"><p class="giMeet__name">' + esc(row.name || "לקוח") + "</p>"
      + statusPill(meeting)
      + '</div><div class="giMeet__facts">'
      + factHtml("תעודת זהות", displayId(row.idNumber), true)
      + factHtml("טלפון", row.phone, true)
      + factHtml("כתובת", row.address)
      + factHtml("סוכן מטפל", meeting.assignee_name)
      + '</div><div class="giMeet__actions"><button class="giMeet__btn" type="button" data-open="' + esc(meeting.id) + '">פתח</button></div></article>';
  }

  function filesBoardHtml() {
    const list = (ui.meetings || []).filter((meeting) => text(meeting.assignee_id) || text(meeting.assignee_name));
    const rows = list.map(fileRowHtml).join("") || '<div class="giMeet__note">אין תיקים בטיפול</div>';
    return '<div class="giMeet"><button class="giMeet__btn giMeet__back" type="button" data-board="customers">חזרה</button><div class="giMeet__head"><div><h1>תיקים בטיפול</h1><p>הלקוחות שכבר שויכו לנציגים</p></div></div><div class="giMeet__rows">' + rows + "</div></div>";
  }

  function homeHtml() {
    restoreRows();
    const who = current();
    const create = canCreate(who);
    if (create && ui.board === "files") return filesBoardHtml();
    const lists = screenLists(who, ui.rows, ui.meetings);
    const buttons = create
      ? '<div class="giMeet__actions"><button class="giMeet__btn" type="button" data-files="1">תיקים בטיפול</button><button class="giMeet__btn" type="button" data-load="1">טעינת קובץ לקוחות</button><button class="giMeet__btn giMeet__btn--primary" type="button" data-new="1">הקמת פגישה חדשה</button><input class="giMeet__file" id="giMeetFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/></div>'
      : "";
    const note = ui.note ? '<div class="giMeet__note">' + esc(ui.note) + "</div>" : "";
    const tableNote = memory.missing ? '<div class="giMeet__note">טבלת הפגישות עדיין לא הותקנה במסד. הפגישות של הסשן הזה נשמרות רק עד הרענון.</div>' : "";
    const sourceRows = create ? withoutAssigned(lists.customers, ui.meetings) : lists.customers;
    const rows = sourceRows.map((row) => customerRowHtml(row, create)).join("");
    const assignedRows = (lists.assigned || []).map((row) => customerRowHtml(row, false)).join("");
    const mine = lists.meetings.map(meetingCard).join("");
    const assignedBlock = assignedRows
      ? '<h2 class="giMeet__section">לקוחות ששויכו אליך</h2><div class="giMeet__rows">' + assignedRows + "</div>"
      : "";
    const customerBlock = rows
      ? '<h2 class="giMeet__section">' + (create ? "לקוחות מהדוח" : "לקוחות ששויכו אליך") + '</h2><div class="giMeet__rows">' + rows + "</div>"
      : (create ? "" : '<div class="giMeet__note">אין לקוחות ששויכו אליך</div>');
    const meetingBlock = create
      ? '<h2 class="giMeet__section">פגישות</h2><div class="giMeet__rows">' + (mine || '<div class="giMeet__note">אין פגישות להצגה</div>') + "</div>"
      : "";
    return '<div class="giMeet"><div class="giMeet__head"><div><h1>פגישות</h1><p>' + esc(who && who.name || "") + "</p></div>" + buttons + "</div>"
      + note + tableNote + assignedBlock + customerBlock + meetingBlock + "</div>";
  }

  function shownAgents(form) {
    const query = text(form && form.agentQuery);
    return agents().filter((agent) => matchUserName(agent.name, query));
  }

  function agentButtonsHtml(form) {
    const all = agents();
    const list = shownAgents(form);
    if (!all.length) return '<p class="giMeet__pickEmpty">' + esc(form.agentsLoading ? "טוען משתמשים…" : (ui.agentError || "לא נטענה רשימת הנציגים")) + "</p>";
    if (!list.length) return '<p class="giMeet__pickEmpty">אין משתמש בשם הזה</p>';
    return list.map((agent) => '<button type="button" data-agent-id="' + esc(agent.id) + '"' + (String(form.assigneeId) === String(agent.id) ? ' class="is-on"' : "") + ">" + esc(agent.name) + "</button>").join("");
  }

  function agentPicker(form) {
    const selected = agents().find((agent) => String(agent.id) === String(form.assigneeId));
    const label = selected ? text(selected.name) : "בחירת נציג";
    const menu = form.agentOpen
      ? '<div class="giMeet__pickList"><input class="giMeet__pickSearch" type="text" data-agent-search="1" placeholder="חיפוש לפי שם" value="' + esc(form.agentQuery || "") + '"/><div data-agent-options>' + agentButtonsHtml(form) + "</div></div>"
      : "";
    return '<div class="giMeet__field"><span>שיוך לנציג</span><div class="giMeet__pick"><button class="giMeet__pickBtn" type="button" data-agent-toggle="1"><span>' + esc(label) + '</span><span aria-hidden="true">▾</span></button>'
      + menu + '<input type="hidden" name="assignee" value="' + esc(form.assigneeId || "") + '"/></div></div>';
  }

  function formHtml() {
    const form = ui.form || {};
    const questions = '<div class="giMeet__questions">' + QUESTIONS.map((pair) => '<div class="giMeet__q"><b>' + esc(pair[1]) + '</b><div class="giMeet__checks"><label><input type="radio" name="' + pair[0] + '" value="yes"' + (form[pair[0]] === true ? " checked" : "") + '/> כן</label><label><input type="radio" name="' + pair[0] + '" value="no"' + (form[pair[0]] === false ? " checked" : "") + '/> לא</label></div></div>').join("") + "</div>";
    return '<div class="giMeet"><button class="giMeet__btn giMeet__back" type="button" data-back="1">חזרה</button><div class="giMeet__head"><div><h1>הקמת פגישה</h1><p>' + esc(form.customerName || "") + " " + esc(displayId(form.idNumber)) + '</p></div></div><form class="giMeet__form" id="giMeetForm">'
      + questions
      + '<label class="giMeet__field"><span>הערות לנציג</span><textarea name="notes" rows="3">' + esc(form.notes || "") + "</textarea></label>"
      + '<label class="giMeet__field"><span>תאריך הפגישה</span><input class="giMeet__date" type="date" name="meetingDate" value="' + esc(form.meetingDate || "") + '"/></label>'
      + '<div class="giMeet__field"><span>קובץ מסלקה, אם יש</span><div class="giMeet__fileRow"><button class="giMeet__btn" type="button" data-masleka-pick="1">בחירת קובץ</button><span data-masleka-name></span></div><input class="giMeet__file" name="masleka" type="file" accept=".zip,.xml,application/zip,text/xml"/></div>'
      + agentPicker(form)
      + (ui.note ? '<div class="giMeet__note">' + esc(ui.note) + "</div>" : "")
      + '<button class="giMeet__btn giMeet__btn--primary" type="submit"' + (ui.busy ? " disabled" : "") + ">שיוך פגישה</button></form></div>";
  }

  function paint() {
    const el = root();
    if (!el) return;
    if (!canOpen(current())) {
      el.innerHTML = '<div class="giMeet__note">אין הרשאה למסך הפגישות</div>';
      return;
    }
    if (ui.mode === "form") el.innerHTML = formHtml();
    else if (ui.mode === "detail") {
      const meeting = ui.meetings.find((item) => item.id === ui.detailId);
      el.innerHTML = '<div class="giMeet">' + (meeting ? detailHtml(meeting) : '<div class="giMeet__note">הפגישה לא נמצאה</div>') + "</div>";
    } else el.innerHTML = homeHtml();
  }

  async function render(person) {
    if (person && typeof person === "object") screenUser = person;
    restoreRows();
    await loadMeetings();
    paint();
    void ensureAgents().then(() => {
      if (ui.mode === "form" && ui.form) {
        ui.form.agentsLoading = false;
        ui.form.agentOpen = true;
      }
      paint();
    }).catch((err) => {
      ui.agentError = text(err && (err.message || err)) || "לא נטענה רשימת הנציגים";
      paint();
    });
  }

  async function onWorkbook(file) {
    restoreRows();
    ui.note = "טוען את הדוח…";
    paint();
    try {
      if (!global.GI_LOAD_LIBS || typeof global.GI_LOAD_LIBS.xlsx !== "function") throw new Error("xlsx");
      await global.GI_LOAD_LIBS.xlsx();
      const XLSX = global.XLSX;
      if (!XLSX || typeof XLSX.read !== "function") throw new Error("xlsx");
      const buf = new Uint8Array(await file.arrayBuffer());
      const book = XLSX.read(buf, { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      if (!sheet) throw new Error("sheet");
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
      const grouped = groupWorkbookRows(rows);
      if (!grouped.length) {
        ui.note = ui.rows.length ? "לא נמצאו לקוחות בקובץ. הלקוחות שנטענו נשארו על המסך." : "לא נמצאו לקוחות בקובץ.";
        paint();
        return;
      }
      ui.rows = grouped;
      const ids = ui.rows.map((row) => row.idNumber).filter(Boolean);
      let found = [];
      try { found = await lookupCustomers(ids); } catch (_lookup) { found = []; }
      if (!Array.isArray(found)) found = [];
      const byId = new Map();
      found.forEach((customer) => {
        byId.set(customerIdOf(customer), customer);
      });
      ui.rows.forEach((row) => {
        const customer = byId.get(row.idNumber);
        const facts = customer ? fileFacts(customer) : null;
        row.customer = customer || null;
        row.customerId = customer ? text(customer.id) : "";
        row.matched = !!customer;
        row.portfolio = customer ? portfolioSummary(customer) : null;
        row.portfolioPolicies = row.portfolio ? row.portfolio.policies : [];
        if (facts) {
          if (facts.name) row.name = facts.name;
          if (facts.phone) row.phone = facts.phone;
          row.address = facts.address;
          row.premium = facts.premium;
        }
      });
      persistRows();
      const foundFiles = ui.rows.filter((row) => row.matched).length;
      ui.note = "נטענו " + ui.rows.length + " לקוחות. נמצאו " + foundFiles + " תיקים.";
      if (lookupError && foundFiles < ui.rows.length) ui.note += " " + lookupError;
    } catch (err) {
      ui.note = ui.rows.length ? "טעינת הקובץ נכשלה. הלקוחות שנטענו נשארו על המסך." : "טעינת הקובץ נכשלה.";
    }
    paint();
  }

  function readForm(form) {
    const data = ui.form || {};
    QUESTIONS.forEach((pair) => {
      const picked = form.querySelector('input[name="' + pair[0] + '"]:checked');
      data[pair[0]] = picked ? picked.value === "yes" : data[pair[0]];
    });
    data.notes = text(form.elements.notes && form.elements.notes.value);
    data.meetingDate = text(form.elements.meetingDate && form.elements.meetingDate.value);
    const selected = form.querySelector('input[name="assignee"]');
    data.assigneeId = selected ? selected.value : "";
    const agent = agents().find((item) => String(item.id) === String(data.assigneeId));
    data.assigneeName = agent ? text(agent.name) : "";
    ui.form = data;
    return data;
  }

  async function submitForm(form) {
    const data = readForm(form);
    if (QUESTIONS.some((pair) => data[pair[0]] !== true && data[pair[0]] !== false)) {
      ui.note = "יש לענות על ארבע השאלות.";
      paint();
      return;
    }
    if (!data.meetingDate) { ui.note = "יש לבחור תאריך."; paint(); return; }
    if (!data.assigneeId && !data.assigneeName) { ui.note = "יש לבחור נציג."; paint(); return; }
    const chosen = agents().find((agent) => agent.id === text(data.assigneeId))
      || agents().find((agent) => text(agent.name) === text(data.assigneeName));
    if (chosen) {
      data.assigneeId = chosen.id;
      data.assigneeName = chosen.name;
    }
    if (!data.assigneeId) { ui.note = "יש לבחור נציג."; paint(); return; }
    ui.busy = true;
    ui.note = "שומר את הפגישה…";
    paint();
    const who = current() || {};
    const id = "pm_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let report = data.report || { products: [] };
    let fileMeta = data.fileMeta || {};
    const input = form.elements.masleka && form.elements.masleka.files && form.elements.masleka.files[0];
    if (input) {
      try {
        const files = await filesFromUpload(input);
        report = parseMaslekaPackage(files);
        const bytes = new Uint8Array(await input.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        const dataUrl = "data:application/octet-stream;base64," + btoa(binary);
        const folder = data.customerId || ("id-" + normalizeIsraeliId(data.idNumber));
        const uploaded = typeof host().uploadBlob === "function"
          ? await host().uploadBlob(folder, "masleka", { dataUrl, name: input.name, mime: input.type || "application/zip", id: id })
          : { ok: false };
        fileMeta = { name: input.name, storagePath: uploaded && uploaded.storagePath || "", bucket: "gi-customer-files", mime: input.type || "application/zip", size: input.size || 0 };
        if (data.customerId && fileMeta.storagePath) {
          await appendCustomerDocument(data.customerId, {
            id: "doc_" + id,
            type: "masleka_report",
            name: input.name,
            mime: fileMeta.mime,
            size: fileMeta.size,
            storagePath: fileMeta.storagePath,
            storageBucket: "gi-customer-files",
            hasFile: true,
            addedAt: new Date().toISOString()
          });
        }
      } catch (_err) {
        ui.note = "קובץ המסלקה לא נקרא. אפשר לשמור בלי הקובץ.";
      }
    }
    const source = ui.rows.find((item) => item.idNumber === normalizeIsraeliId(data.idNumber));
    const record = {
      id,
      created_at: new Date().toISOString(),
      created_by_id: text(who.id),
      created_by_name: text(who.name),
      assignee_id: text(data.assigneeId),
      assignee_name: text(data.assigneeName),
      customer_id: text(data.customerId || (source && source.customerId)),
      customer_name: text(data.customerName || (source && source.name)),
      id_number: normalizeIsraeliId(data.idNumber),
      meeting_date: data.meetingDate,
      answers: {
        salaryOver10k: !!data.salaryOver10k,
        hasGemelOrStudy: !!data.hasGemelOrStudy,
        freeMoney: !!data.freeMoney,
        maslekaApproved: !!data.maslekaApproved,
        phone: source ? text(source.phone) : "",
        address: source ? text(source.address) : "",
        premium: source && source.premium ? source.premium : 0
      },
      notes: text(data.notes),
      masleka: report || {},
      masleka_file: fileMeta || {},
      status: "open",
      close_choice: "",
      pension_file_opened: false
    };
    const saved = await saveMeeting(record);
    ui.busy = false;
    if (!saved.ok) {
      ui.note = saved.error || "הפגישה לא נשמרה.";
      paint();
      return;
    }
    ui.rows = withoutAssigned(ui.rows, [record]);
    persistRows();
    await notifyAssignee(record);
    if (!saved.memory) publishAssign(record);
    ui.mode = "home";
    ui.form = null;
    ui.note = saved.memory ? "הפגישה נשמרה לסשן. הטבלה עדיין לא הותקנה." : "הפגישה שויכה ל" + record.assignee_name + ".";
    await render();
  }

  async function appendCustomerDocument(customerId, doc) {
    const db = client();
    if (!db || !customerId) return;
    const fresh = await db.from("customers").select("id,payload").eq("id", customerId).maybeSingle();
    if (!fresh || fresh.error || !fresh.data) return;
    const payload = fresh.data.payload && typeof fresh.data.payload === "object" ? fresh.data.payload : {};
    const docs = Array.isArray(payload.customerDocuments) ? payload.customerDocuments.slice() : [];
    docs.push(doc);
    await db.from("customers").update({ payload: Object.assign({}, payload, { customerDocuments: docs }) }).eq("id", customerId);
  }

  async function notifyAssignee(record) {
    toast("פגישה חדשה", record.customer_name + " · " + record.meeting_date);
    const db = client();
    if (!db) return;
    const reminder = {
      id: "meet_pension_" + record.id,
      agent_id: record.assignee_name,
      type: "callback",
      details: "פגישה פנסיונית",
      remind_at: record.meeting_date,
      customer_id: record.customer_id || null,
      customer_name: record.customer_name || null,
      is_done: false,
      created_at: new Date().toISOString()
    };
    const alertRow = {
      id: "alert_pension_" + record.id,
      agent_id: record.assignee_name,
      type: "callback",
      details: "נקבעה לך פגישה עם " + (record.customer_name || "לקוח"),
      remind_at: new Date().toISOString(),
      customer_id: record.customer_id || null,
      customer_name: record.customer_name || null,
      is_done: false,
      created_at: new Date().toISOString()
    };
    try { await db.from("reminders").insert(reminder); } catch (_e) {}
    try { await db.from("reminders").insert(alertRow); } catch (_e) {}
  }

  async function closeMeeting(id, choice) {
    if (choice !== "not_closed" && !CLOSE[choice]) return;
    const patch = choice === "not_closed"
      ? { status: "not_closed", close_choice: "not_closed", pension_file_opened: true }
      : { status: "closed", close_choice: choice, pension_file_opened: true };
    const saved = await updateMeeting(id, patch);
    ui.note = saved.ok
      ? (choice === "not_closed" ? "הסטטוס נשמר. העסקה לא נסגרה." : "התהליך נסגר. העסקה נסגרה.")
      : "הסגירה לא נשמרה.";
    ui.mode = "home";
    await render();
  }

  async function markTreatment(meeting) {
    if (!meeting || treatmentStatus(meeting).key !== "idle") return;
    if (!personMatchesAssignee(current(), meeting.assignee_id, meeting.assignee_name)) return;
    const saved = await updateMeeting(meeting.id, { status: "in_treatment", pension_file_opened: true });
    if (!saved.ok) return;
    meeting.status = "in_treatment";
    meeting.pension_file_opened = true;
  }

  async function download(meeting) {
    const file = meeting && meeting.masleka_file;
    const db = client();
    if (!file || !file.storagePath || !db || !db.storage) return;
    const res = await db.storage.from(file.bucket || "gi-customer-files").createSignedUrl(file.storagePath, 120);
    const url = res && res.data && res.data.signedUrl;
    if (url) global.open(url, "_blank", "noopener");
  }

  function onClick(event) {
    const el = event.target.closest("[data-load],[data-new],[data-new-id],[data-portfolio],[data-open],[data-back],[data-date],[data-close],[data-download],[data-masleka-pick],[data-agent-toggle],[data-agent-id],[data-files],[data-board]");
    if (!el || !root() || !root().contains(el)) return;
    if (el.hasAttribute("data-load")) {
      const input = document.getElementById("giMeetFile");
      if (input) input.click();
      return;
    }
    if (el.hasAttribute("data-masleka-pick")) {
      const input = root() && root().querySelector("input[name=masleka]");
      if (input) input.click();
      return;
    }
    if (el.hasAttribute("data-agent-toggle")) {
      const form = document.getElementById("giMeetForm");
      if (form) readForm(form);
      if (!ui.form) ui.form = {};
      const opening = !ui.form.agentOpen;
      ui.form.agentOpen = opening;
      if (opening) {
        ui.form.agentsLoading = !agents().length;
        paint();
        void ensureAgents().then(() => {
          if (!ui.form || ui.mode !== "form" || !ui.form.agentOpen) return;
          ui.form.agentsLoading = false;
          paint();
          const search = root() && root().querySelector("[data-agent-search]");
          if (search) search.focus();
        });
        return;
      }
      paint();
      return;
    }
    if (el.hasAttribute("data-agent-id")) {
      const form = document.getElementById("giMeetForm");
      if (form) readForm(form);
      if (!ui.form) ui.form = {};
      ui.form.assigneeId = el.getAttribute("data-agent-id") || "";
      ui.form.agentOpen = false;
      paint();
      return;
    }
    if (el.hasAttribute("data-back")) {
      ui.mode = "home";
      ui.note = "";
      paint();
      return;
    }
    if (el.hasAttribute("data-new") || el.hasAttribute("data-new-id")) {
      const idNumber = el.getAttribute("data-new-id") || "";
      const row = ui.rows.find((item) => item.idNumber === idNumber);
      ui.form = {
        idNumber: idNumber,
        customerName: row ? row.name : "",
        customerId: row ? (row.customerId || (row.customer && row.customer.id) || "") : "",
        notes: "",
        meetingDate: "",
        agentOpen: true,
        agentsLoading: !agents().length
      };
      ui.mode = "form";
      ui.note = "";
      paint();
      void ensureAgents().then(() => {
        if (ui.mode !== "form" || !ui.form) return;
        ui.form.agentsLoading = false;
        ui.form.agentOpen = true;
        paint();
      }).catch((err) => {
        ui.agentError = text(err && (err.message || err)) || "לא נטענה רשימת הנציגים";
        if (ui.form) ui.form.agentsLoading = false;
        paint();
      });
      return;
    }
    if (el.hasAttribute("data-portfolio")) {
      const idNumber = el.getAttribute("data-portfolio");
      const row = ui.rows.find((item) => item.idNumber === idNumber);
      if (row) row.openPortfolio = !row.openPortfolio;
      paint();
      return;
    }
    if (el.hasAttribute("data-files")) {
      ui.board = "files";
      ui.mode = "home";
      paint();
      return;
    }
    if (el.hasAttribute("data-board")) {
      ui.board = "customers";
      ui.mode = "home";
      paint();
      return;
    }
    if (el.hasAttribute("data-open")) {
      ui.detailId = el.getAttribute("data-open");
      ui.mode = "detail";
      const meeting = ui.meetings.find((item) => item.id === ui.detailId);
      paint();
      void markTreatment(meeting);
      return;
    }
    if (el.hasAttribute("data-date")) {
      if (!ui.form) ui.form = {};
      const form = document.getElementById("giMeetForm");
      if (form) readForm(form);
      ui.form.meetingDate = el.getAttribute("data-date");
      root().querySelectorAll("[data-date]").forEach((btn) => {
        btn.classList.toggle("is-on", btn.getAttribute("data-date") === ui.form.meetingDate);
      });
      return;
    }
    if (el.hasAttribute("data-download")) {
      const meeting = ui.meetings.find((item) => item.id === el.getAttribute("data-download"));
      void download(meeting);
      return;
    }
    if (el.hasAttribute("data-close")) {
      const picked = root().querySelector('input[name="giMeetClose"]:checked');
      void closeMeeting(el.getAttribute("data-close"), el.getAttribute("data-choice") || (picked && picked.value));
    }
  }

  function onChange(event) {
    if (event.target && event.target.id === "giMeetFile" && event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      event.target.value = "";
      void onWorkbook(file);
      return;
    }
    if (event.target && event.target.name === "masleka") {
      const name = root() && root().querySelector("[data-masleka-name]");
      if (name) name.textContent = event.target.files && event.target.files[0] ? event.target.files[0].name : "";
      return;
    }
    if (event.target && event.target.name === "giMeetClose") {
      const button = root() && root().querySelector("[data-close]");
      if (button) button.disabled = false;
    }
  }

  function onSubmit(event) {
    const form = event.target;
    if (!form || form.id !== "giMeetForm") return;
    event.preventDefault();
    void submitForm(form);
  }

  function onInput(event) {
    const input = event.target;
    if (!input || !input.hasAttribute || !input.hasAttribute("data-agent-search")) return;
    if (!ui.form) ui.form = {};
    ui.form.agentQuery = input.value;
    const box = root() && root().querySelector("[data-agent-options]");
    if (box) box.innerHTML = agentButtonsHtml(ui.form);
  }

  function onKeyDown(event) {
    if (event.target && event.target.hasAttribute && event.target.hasAttribute("data-agent-search") && event.key === "Enter") {
      event.preventDefault();
    }
  }

  function bind() {
    if (bind.done || typeof document === "undefined") return;
    bind.done = true;
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("submit", onSubmit);
  }

  function assignPacket(record) {
    return {
      type: "broadcast",
      event: "assigned",
      payload: {
        id: text(record && record.id),
        assignee_id: text(record && record.assignee_id),
        assignee_name: text(record && record.assignee_name)
      }
    };
  }

  function listenAssign() {
    const db = client();
    if (!db || typeof db.channel !== "function" || listenAssign.channel) return;
    const channel = db.channel("gi-pension-assign");
    listenAssign.channel = channel;
    channel.on("broadcast", { event: "assigned" }, (msg) => {
      const payload = msg && msg.payload;
      void receiveAssign(payload || {});
    });
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      listenAssign.ready = true;
      if (typeof listenAssign.queue === "function") {
        const send = listenAssign.queue;
        listenAssign.queue = null;
        send();
      }
    });
  }

  function publishAssign(record) {
    listenAssign();
    const channel = listenAssign.channel;
    if (!channel || typeof channel.send !== "function") return;
    const send = () => {
      try {
        const result = channel.send(assignPacket(record));
        if (result && typeof result.catch === "function") result.catch(() => {});
      } catch (_e) {}
    };
    if (listenAssign.ready) send();
    else listenAssign.queue = send;
  }

  async function receiveAssign(payload) {
    const who = current();
    if (!who) return;
    const mine = personMatchesAssignee(who, payload && payload.assignee_id, payload && payload.assignee_name);
    if (!mine && !canCreate(who) && !isManagerRole(roleOf(who))) return;
    await loadMeetings();
    if (ui.mode === "home") paint();
    if (mine) {
      const meeting = ui.meetings.find((item) => text(item.id) === text(payload && payload.id));
      if (meeting) toast("פגישה חדשה", (meeting.customer_name || "לקוח") + " · " + (meeting.meeting_date || ""));
    }
  }

  async function pollNew() {
    const who = current();
    if (!who || !canOpen(who)) return;
    const before = memory.seen;
    await loadMeetings();
    const ids = ui.meetings.map((meeting) => meeting.id);
    const stamp = ui.meetings.map((meeting) => [meeting.id, meeting.status, meeting.close_choice, meeting.pension_file_opened ? "1" : "0"].join(":")).sort().join("|");
    if (!before) {
      memory.seen = new Set(ids);
      memory.stamp = stamp;
      return;
    }
    let changed = false;
    ids.forEach((id) => {
      if (before.has(id)) return;
      changed = true;
      const meeting = ui.meetings.find((item) => item.id === id);
      if (meeting && personMatchesAssignee(who, meeting.assignee_id, meeting.assignee_name)) {
        toast("פגישה חדשה", (meeting.customer_name || "לקוח") + " · " + (meeting.meeting_date || ""));
      }
    });
    memory.seen = new Set(ids.concat(Array.from(before)));
    const stampChanged = memory.stamp !== stamp;
    memory.stamp = stamp;
    if ((changed || stampChanged) && ui.mode === "home") paint();
  }

  function watch() {
    if (typeof window === "undefined") return;
    bind();
    listenAssign();
    if (!watchTimer) watchTimer = window.setInterval(() => { void pollNew(); }, 5000);
    void pollNew();
  }

  const api = {
    canOpen,
    canCreate,
    normalizeIsraeliId,
    displayId,
    normalizeBranch,
    groupWorkbookRows,
    portfolioSummary,
    parseXml,
    parseMaslekaXml,
    parseMaslekaPackage,
    customerVisibleToSurveyor,
    customerAddress,
    fileFacts,
    isAssignableAgent,
    matchUserName,
    agents,
    ensureAgents,
    lookupCustomers,
    keepLoadedRows,
    screenLists,
    treatmentStatus,
    withoutAssigned,
    meetingVisible,
    personMatchesAssignee,
    rosterFirst,
    missingTable,
    readAccessToken,
    saveMeeting,
    unzip,
    render,
    watch,
    paint
  };
  global.MeetingsUI = api;
  if (typeof document !== "undefined") {
    bind();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
    else watch();
  }
})(typeof window !== "undefined" ? window : globalThis);
