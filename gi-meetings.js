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
  const CLOSE = { pension_deposit: "פנסיה הפקדה חודשית", pension_transfer: "פנסיה ניוד צבירות" };
  const memory = { rows: [], missing: false, seen: null };
  let watchTimer = 0;
  let screenUser = null;
  const ui = {
    mode: "home",
    rows: [],
    meetings: [],
    detailId: "",
    form: null,
    note: "",
    busy: false,
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

  function meetingVisible(meeting, person) {
    const who = person || current() || {};
    const role = roleOf(who);
    if (!meeting) return false;
    const flags = sessionFlags();
    if (flags && (!person || person === flags.user) && (flags.admin || flags.manager)) return true;
    if (isManagerRole(role)) return true;
    const id = text(who.id);
    if (role.toLowerCase() === "referent" || role === "סוקרת") return text(meeting.created_by_id) === id;
    if (role.toLowerCase() === "agent" || role.toLowerCase() === "teammanager" || role === "נציג" || role === "מנהל צוות") return text(meeting.assignee_id) === id;
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

  function fileFacts(customer) {
    const portfolio = portfolioSummary(customer);
    return {
      name: portfolio.name,
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
      address: text(answers.address),
      premium: Number(answers.premium) || 0,
      meetingId: meeting && meeting.id,
      pension: !!(meeting && meeting.pension_file_opened)
    };
  }

  function screenLists(person, rows, meetings) {
    const visibleMeetings = (meetings || []).filter((meeting) => meetingVisible(meeting, person));
    if (canCreate(person)) return { customers: rows || [], meetings: visibleMeetings };
    return { customers: visibleMeetings.map(meetingCustomer), meetings: [] };
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
    const out = [];
    for (let i = 0; i < first.length; i += 1) {
      const entry = first[i];
      if (/\.zip$/i.test(entry.name)) {
        const nested = await unzip(entry.bytes);
        nested.forEach((item) => out.push(item));
      } else {
        out.push(entry);
      }
    }
    return out;
  }

  function client() {
    try { return host().client ? host().client() : null; } catch (_e) { return null; }
  }

  function missingTable(error) {
    const message = text(error && (error.message || error.code || error));
    return error && (error.code === "42P01" || /schema cache|does not exist|relation/i.test(message));
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

  async function loadMeetings() {
    const db = client();
    const who = current();
    if (!db || !who) {
      ui.meetings = memory.rows.filter((row) => meetingVisible(row, who));
      return ui.meetings;
    }
    const res = await db.from("gi_pension_meetings").select("*").order("created_at", { ascending: false }).limit(200);
    if (res.error) {
      if (missingTable(res.error)) memory.missing = true;
      ui.meetings = memory.rows.filter((row) => meetingVisible(row, who));
      return ui.meetings;
    }
    memory.missing = false;
    ui.meetings = (res.data || []).map(rowFromDb).filter((row) => meetingVisible(row, who));
    return ui.meetings;
  }

  async function saveMeeting(record) {
    const db = client();
    if (!db) {
      memory.missing = true;
      memory.rows.unshift(record);
      return { ok: true, memory: true };
    }
    const res = await db.from("gi_pension_meetings").insert(record);
    if (res.error) {
      if (missingTable(res.error)) {
        memory.missing = true;
        memory.rows.unshift(record);
        return { ok: true, memory: true };
      }
      return { ok: false, error: text(res.error.message || res.error) };
    }
    return { ok: true };
  }

  async function updateMeeting(id, patch) {
    const db = client();
    if (!db || memory.missing) {
      const row = memory.rows.find((item) => item.id === id);
      if (row) Object.assign(row, patch);
      return { ok: !!row, memory: true };
    }
    const res = await db.from("gi_pension_meetings").update(Object.assign({ updated_at: new Date().toISOString() }, patch)).eq("id", id);
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

  function agents() {
    const source = Array.isArray(ui.agentChoices) && ui.agentChoices.length ? ui.agentChoices : readLocalAgents();
    return source.filter(isAssignableAgent).map((agent) => ({
      id: text(agent.id) || userName(agent),
      name: userName(agent),
      role: text(agent.role),
      active: agent.active !== false
    })).sort((a, b) => a.name.localeCompare(b.name, "he"));
  }

  async function ensureAgents() {
    const byId = new Map();
    const add = (agent) => {
      if (!isAssignableAgent(agent)) return;
      const name = userName(agent);
      const id = text(agent.id) || name;
      if (!byId.has(id)) byId.set(id, agent);
    };
    readLocalAgents().forEach(add);
    const db = client();
    if (db && typeof db.from === "function") {
      try {
        const res = await db.from("agents").select("id,name,username,role,active").limit(1000);
        const rows = !res.error && Array.isArray(res.data) ? res.data : [];
        rows.forEach(add);
      } catch (_e) {}
    }
    ui.agentChoices = Array.from(byId.values());
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
    return !!(
      (Array.isArray(payload.insureds) && payload.insureds.length)
      || (Array.isArray(payload.newPolicies) && payload.newPolicies.length)
      || (payload.operational && typeof payload.operational === "object")
      || (payload.primary && (payload.primary.street || payload.primary.city || payload.primary.houseNumber))
      || text(customer && (customer.city || customer.address))
    );
  }

  function idLookupKeys(ids) {
    const keys = new Set();
    (ids || []).forEach((raw) => {
      const id = normalizeIsraeliId(raw);
      if (!id) return;
      keys.add(id);
      if (id.length < 9) keys.add(id.padStart(9, "0"));
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
      for (let i = 0; i < keys.length; i += 40) {
        const slice = keys.slice(i, i + 40);
        try {
          const res = await db.from("customers").select("id,full_name,id_number,phone,city,agent_id,agent_name,payload").in("id_number", slice);
          if (!res.error && Array.isArray(res.data)) res.data.forEach((row) => put(row, true));
        } catch (_e) {}
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
        if (!res || !res.error) (Array.isArray(rows) ? rows : []).forEach((row) => put(row, true));
      } catch (_e) {}
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
      + '</div><button class="giMeet__btn" type="button" data-open="' + esc(meeting.id) + '">פתח</button></div></article>';
  }

  function detailHtml(meeting) {
    const who = current();
    const assignee = text(meeting.assignee_id) === text(who && who.id);
    const closeBox = assignee && meeting.status !== "closed"
      ? '<div class="giMeet__card"><h3 class="giMeet__section">סגירת תהליך</h3><div class="giMeet__checks"><label><input type="radio" name="giMeetClose" value="pension_deposit"/> פנסיה הפקדה חודשית</label><label><input type="radio" name="giMeetClose" value="pension_transfer"/> פנסיה ניוד צבירות</label></div><button class="giMeet__btn giMeet__btn--primary" type="button" data-close="' + esc(meeting.id) + '" disabled>סגור תהליך</button></div>'
      : "";
    const file = meeting.masleka_file && meeting.masleka_file.storagePath
      ? '<button class="giMeet__btn" type="button" data-download="' + esc(meeting.id) + '">הורדת דוח מסלקה</button>'
      : "";
    const answers = meeting.answers && typeof meeting.answers === "object" ? meeting.answers : {};
    return '<button class="giMeet__btn giMeet__back" type="button" data-back="1">חזרה</button>'
      + '<div class="giMeet__head"><div><h1>' + esc(meeting.customer_name || "פגישה") + "</h1><p>" + esc(meeting.meeting_date || "") + " · " + esc(meeting.assignee_name || "") + "</p></div><div class=\"giMeet__actions\">" + file + "</div></div>"
      + '<div class="giMeet__facts">'
      + factHtml("תעודת זהות", displayId(meeting.id_number), true)
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
      : '<button class="giMeet__btn" type="button" data-portfolio="' + esc(row.idNumber) + '">הצג פירוט תיק</button>'
        + (create ? '<button class="giMeet__btn giMeet__btn--primary" type="button" data-new-id="' + esc(row.idNumber) + '">הקמת פגישה</button>' : "");
    const policies = portfolioPoliciesOf(row);
    const detail = row.openPortfolio
      ? '<div class="giMeet__policies">' + (policies.map((policy) => '<div class="giMeet__policy"><b>' + esc(policy.company || policy.plan || "פוליסה") + "</b> · " + esc(policy.policyNumber) + " · " + esc(money(policy.premium) || "") + (policy.production ? " · פרודוקציה" : "") + "</div>").join("") || '<div class="giMeet__policy">אין פוליסות בתיק</div>') + "</div>"
      : "";
    return '<article class="giMeet__row"><div class="giMeet__rowMain"><p class="giMeet__name">' + esc(row.name || "לקוח") + "</p>"
      + (closed ? '<span class="giMeet__pill">נוצר תיק פנסיוני בסוכנות</span>' : "")
      + '</div><div class="giMeet__facts">'
      + factHtml("תעודת זהות", displayId(row.idNumber), true)
      + factHtml("כתובת", row.address)
      + factHtml("פרמיה בתיק", money(row.premium))
      + '</div><div class="giMeet__actions">' + actions + "</div>" + detail + "</article>";
  }

  function homeHtml() {
    restoreRows();
    const who = current();
    const create = canCreate(who);
    const lists = screenLists(who, ui.rows, ui.meetings);
    const buttons = create
      ? '<div class="giMeet__actions"><button class="giMeet__btn" type="button" data-load="1">טעינת קובץ לקוחות</button><button class="giMeet__btn giMeet__btn--primary" type="button" data-new="1">הקמת פגישה חדשה</button><input class="giMeet__file" id="giMeetFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/></div>'
      : "";
    const note = ui.note ? '<div class="giMeet__note">' + esc(ui.note) + "</div>" : "";
    const tableNote = memory.missing ? '<div class="giMeet__note">טבלת הפגישות עדיין לא הותקנה במסד. הפגישות של הסשן הזה נשמרות רק עד הרענון.</div>' : "";
    const rows = lists.customers.map((row) => customerRowHtml(row, create)).join("");
    const mine = lists.meetings.map(meetingCard).join("");
    const customerBlock = rows
      ? '<h2 class="giMeet__section">' + (create ? "לקוחות מהדוח" : "לקוחות ששויכו אליך") + '</h2><div class="giMeet__rows">' + rows + "</div>"
      : (create ? "" : '<div class="giMeet__note">אין לקוחות ששויכו אליך</div>');
    const meetingBlock = create
      ? '<h2 class="giMeet__section">פגישות</h2><div class="giMeet__rows">' + (mine || '<div class="giMeet__note">אין פגישות להצגה</div>') + "</div>"
      : "";
    return '<div class="giMeet"><div class="giMeet__head"><div><h1>פגישות</h1><p>' + esc(who && who.name || "") + "</p></div>" + buttons + "</div>"
      + note + tableNote + customerBlock + meetingBlock + "</div>";
  }

  function shownAgents(form) {
    const query = text(form && form.agentQuery);
    return agents().filter((agent) => matchUserName(agent.name, query));
  }

  function agentButtonsHtml(form) {
    const all = agents();
    const list = shownAgents(form);
    if (!all.length) return '<p class="giMeet__pickEmpty">' + (form.agentsLoading ? "טוען משתמשים…" : "אין משתמשים פעילים") + "</p>";
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
        row.customer = customer || null;
        row.customerId = customer ? text(customer.id) : "";
        row.portfolio = customer ? portfolioSummary(customer) : null;
        row.portfolioPolicies = row.portfolio ? row.portfolio.policies : [];
        if (customer) {
          const full = text(customer.full_name || customer.fullName || customer.name);
          if (full) row.name = full;
          row.address = customerAddress(customer);
        }
        row.premium = row.portfolio ? row.portfolio.total : 0;
      });
      persistRows();
      ui.note = "נטענו " + ui.rows.length + " לקוחות.";
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
      ui.note = "הפגישה לא נשמרה.";
      paint();
      return;
    }
    await notifyAssignee(record);
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
    if (!CLOSE[choice]) return;
    const saved = await updateMeeting(id, { status: "closed", close_choice: choice, pension_file_opened: true });
    ui.note = saved.ok ? "התהליך נסגר. נוצר תיק פנסיוני בסוכנות." : "הסגירה לא נשמרה.";
    ui.mode = "home";
    await render();
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
    const el = event.target.closest("[data-load],[data-new],[data-new-id],[data-portfolio],[data-open],[data-back],[data-date],[data-close],[data-download],[data-masleka-pick],[data-agent-toggle],[data-agent-id]");
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
        meetingDate: ""
      };
      ui.mode = "form";
      ui.note = "";
      paint();
      void ensureAgents().then(() => {
        if (ui.mode === "form") paint();
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
    if (el.hasAttribute("data-open")) {
      ui.detailId = el.getAttribute("data-open");
      ui.mode = "detail";
      paint();
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
      void closeMeeting(el.getAttribute("data-close"), picked && picked.value);
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

  async function pollNew() {
    const who = current();
    if (!who || !canOpen(who)) return;
    const before = memory.seen;
    await loadMeetings();
    const ids = ui.meetings.map((meeting) => meeting.id);
    if (!before) {
      memory.seen = new Set(ids);
      return;
    }
    ids.forEach((id) => {
      if (before.has(id)) return;
      const meeting = ui.meetings.find((item) => item.id === id);
      if (meeting && text(meeting.assignee_id) === text(who.id)) {
        toast("פגישה חדשה", (meeting.customer_name || "לקוח") + " · " + (meeting.meeting_date || ""));
      }
    });
    memory.seen = new Set(ids.concat(Array.from(before)));
  }

  function watch() {
    if (typeof window === "undefined") return;
    bind();
    if (!watchTimer) watchTimer = window.setInterval(() => { void pollNew(); }, 20000);
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
    lookupCustomers,
    keepLoadedRows,
    screenLists,
    meetingVisible,
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
