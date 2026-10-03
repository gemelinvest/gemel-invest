/* GEMEL INVEST — מנוע החתמה.
   טופס ביטול, טפסי הצעה ושאלוני המשך: הרשאה, לינק, חותמים, ותאי חתימה. */
(function installGiSignEngine(global){
  "use strict";

  const PAGE_H = 841.89;
  const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  function trim(v){
    return String(v == null ? "" : v).trim();
  }

  function box(slot, x0, y0, x1, y1, extra){
    return Object.assign({ slot, page: 0, x0, y0, x1, y1 }, extra || {});
  }

  function rows(slotNames, x0, y0, x1, y1, rowH, extra){
    return slotNames.map((slot, i) => box(slot, x0, y0 + i * rowH, x1, y1 + i * rowH, extra));
  }

  const FAMILY = ["self", "spouse", "child:0", "child:1", "child:2", "child:3"];
  const ADULTS = { adultsOnly: true };

  const SIGNATURE_BOXES = {
    hachshara: [box("self", 71.2, 615.7, 185.9, 633.2)],
    phoenix: [box("self", 21.4, 515.5, 160.8, 544.5)],
    phoenix_health: rows(FAMILY, 22.7, 142.3, 168.5, 159.3, 17, ADULTS),
    ayalon: rows(["self", "second"], 33.2, 657.3, 147.8, 685.7, 28.35),
    ayalon_life: [box("self", 33.4, 634.1, 296.3, 669.8)],
    clal: [box("self", 48.5, 622.8, 164.3, 644)],
    clal_couple: rows(["self", "second"], 48.6, 618.3, 164.2, 639.06, 20.76),
    harel_health: rows(FAMILY, 27.9, 594.4, 128.9, 617.1, 22.7, ADULTS),
    harel_life: rows(["self", "second"], 28.5, 599.6, 138.9, 625.1, 25.51),
    menora: [box("self", 23.2, 717.6, 160.1, 740)],
    menora_mortgage: rows(["self", "second"], 24.5, 538, 186, 564, 32.7),
    migdal: [box("self", 28, 564.8, 129.6, 594.1)]
  };

  function canSendRole(role){
    const raw = trim(role);
    const r = raw.toLowerCase();
    return r === "admin" || r === "owner" || r === "manager" || r === "adminlite" || r === "admin_lite"
      || raw === "מנהל" || raw === "מנהל מערכת" || raw === "מפתח המערכת";
  }

  function canSendFormsRole(role){
    if(canSendRole(role)) return true;
    const raw = trim(role);
    const r = raw.toLowerCase();
    return r === "ops" || r === "opsagent" || r === "ops_agent" || r === "operations"
      || raw === "תפעול" || raw === "מנהל תפעול" || raw === "נציג תפעול";
  }

  function shortToken(randomByte){
    const next = typeof randomByte === "function" ? randomByte : null;
    let out = "";
    for(let i = 0; i < 8; i++){
      const n = next ? (next() & 255) : Math.floor(Math.random() * 256);
      out += TOKEN_ALPHABET[n % TOKEN_ALPHABET.length];
    }
    return out;
  }

  function signLink(pageHref, token){
    const url = new URL(pageHref || "/", "https://example.com");
    const dir = url.pathname.replace(/[^/]*$/, "");
    return url.origin + dir + "s/" + trim(token);
  }

  function tokenFromLocation(pathname, hash){
    const path = trim(pathname);
    const fromPath = path.match(/\/s\/([A-Za-z0-9]{6,16})\/?$/);
    if(fromPath) return fromPath[1];
    const raw = trim(hash).replace(/^#/, "");
    if(/^[A-Za-z0-9]{6,16}$/.test(raw)) return raw;
    return "";
  }

  function jerusalemHour(date){
    const d = date instanceof Date ? date : new Date(date || Date.now());
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jerusalem",
        hour: "2-digit",
        hourCycle: "h23"
      }).formatToParts(d);
      const hour = parts.find((p) => p.type === "hour");
      const n = Number(hour && hour.value);
      if(Number.isFinite(n)) return n;
    } catch(_e) {}
    return d.getHours();
  }

  function greeting(name, date){
    const hour = jerusalemHour(date);
    let hello = "לילה טוב";
    if(hour >= 5 && hour < 12) hello = "בוקר טוב";
    else if(hour >= 12 && hour < 17) hello = "צהריים טובים";
    else if(hour >= 17 && hour < 21) hello = "ערב טוב";
    const who = trim(name);
    return who ? (hello + ", " + who) : hello;
  }

  function toastText(customerName){
    const name = trim(customerName) || "הלקוח";
    return name + " חתם על המסמכים. הם זמינים לצפייה בתיק";
  }

  function personName(person){
    const p = person || {};
    const full = trim(p.fullName);
    if(full) return full;
    return trim((trim(p.firstName) + " " + trim(p.lastName)).trim());
  }

  function normalizeId(value){
    const digits = trim(value).replace(/\D/g, "");
    if(!digits) return "";
    if(digits.length >= 9) return digits;
    return digits.padStart(9, "0");
  }

  function idsMatch(a, b){
    const left = normalizeId(a);
    const right = normalizeId(b);
    return !!left && left === right;
  }

  function personType(person){
    return trim(person && person._type).toLowerCase();
  }

  function ageYears(birthDate, now){
    const s = trim(birthDate);
    if(!s) return null;
    let y = 0;
    let m = 0;
    let d = 0;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const il = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if(iso){
      y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]);
    }else if(il){
      d = Number(il[1]); m = Number(il[2]); y = Number(il[3]);
    }else {
      return null;
    }
    if(!y || !m || !d) return null;
    const today = now instanceof Date ? now : new Date(now || Date.now());
    let age = today.getFullYear() - y;
    const month = today.getMonth() + 1;
    if(month < m || (month === m && today.getDate() < d)) age -= 1;
    return age;
  }

  function isAdult(person, now){
    const type = personType(person);
    const age = ageYears(person && person.birthDate, now);
    if(age != null) return age >= 18;
    return type !== "child";
  }

  function matchPerson(slot, people){
    const list = Array.isArray(people) ? people : [];
    if(slot === "self"){
      return list.find((p) => personType(p) === "primary") || list[0] || null;
    }
    if(slot === "second" || slot === "spouse"){
      return list.find((p) => {
        const t = personType(p);
        return t === "spouse" || t === "secondary";
      }) || null;
    }
    const child = String(slot || "").match(/^child:(\d+)$/);
    if(child){
      const kids = list.filter((p) => personType(p) === "child");
      return kids[Number(child[1])] || null;
    }
    return null;
  }

  function boxesFor(templateId){
    const list = SIGNATURE_BOXES[trim(templateId)];
    return Array.isArray(list) ? list.map((row) => Object.assign({}, row)) : [];
  }

  function signersFor(templateId, people, now){
    return boxesFor(templateId).map((cell) => {
      const person = matchPerson(cell.slot, people);
      if(!person) return null;
      if(cell.adultsOnly && !isAdult(person, now)) return null;
      const name = personName(person);
      if(!name) return null;
      return {
        slot: cell.slot,
        name,
        insuredId: trim(person._id),
        idNumber: normalizeId(person.idNumber || person.id_number),
        box: {
          page: 0,
          x0: cell.x0,
          y0: cell.y0,
          x1: cell.x1,
          y1: cell.y1
        }
      };
    }).filter(Boolean);
  }

  function personForSlot(slot, people, now){
    const list = Array.isArray(people) ? people : [];
    if(slot === "adultChild"){
      return list.find((person) => {
        const type = personType(person);
        if(type === "adult") return true;
        return type === "child" && isAdult(person, now);
      }) || null;
    }
    return matchPerson(slot, people);
  }

  function signersFromBoxes(boxes, people, now){
    const groups = [];
    const index = Object.create(null);
    (Array.isArray(boxes) ? boxes : []).forEach((cell) => {
      if(!cell) return;
      const person = personForSlot(cell.slot, people, now);
      if(!person) return;
      if(cell.adultsOnly && !isAdult(person, now)) return;
      const name = personName(person);
      if(!name) return;
      const idNumber = normalizeId(person.idNumber || person.id_number);
      const key = idNumber || ("#" + trim(person._id)) || name;
      let group = index[key];
      if(!group){
        group = {
          slot: cell.slot,
          name: name,
          insuredId: trim(person._id),
          idNumber: idNumber,
          boxes: []
        };
        index[key] = group;
        groups.push(group);
      }
      group.boxes.push({
        page: Number(cell.page) || 0,
        x0: Number(cell.x0) || 0,
        y0: Number(cell.y0) || 0,
        x1: Number(cell.x1) || 0,
        y1: Number(cell.y1) || 0
      });
    });
    groups.forEach((group) => {
      const first = group.boxes[0];
      if(first) group.box = { page: first.page, x0: first.x0, y0: first.y0, x1: first.x1, y1: first.y1 };
    });
    return groups;
  }

  function pdfRect(cell){
    const x0 = Number(cell && cell.x0) || 0;
    const y0 = Number(cell && cell.y0) || 0;
    const x1 = Number(cell && cell.x1) || 0;
    const y1 = Number(cell && cell.y1) || 0;
    return {
      x: x0,
      y: PAGE_H - y1,
      width: Math.max(0, x1 - x0),
      height: Math.max(0, y1 - y0)
    };
  }

  function boxIsClear(cell){
    const rect = pdfRect(cell);
    return rect.width >= 80 && rect.height >= 16;
  }

  function emptyState(docId){
    return {
      docId: trim(docId),
      links: [],
      status: ""
    };
  }

  function holdIsFree(holderToken, holderUntil, token, now){
    const holder = trim(holderToken);
    const mine = trim(token);
    if(!holder || holder === mine) return true;
    const until = Date.parse(trim(holderUntil));
    if(!Number.isFinite(until)) return true;
    const at = now instanceof Date ? now.getTime() : Date.parse(now);
    if(!Number.isFinite(at)) return false;
    return until <= at;
  }

  function deriveStatus(links){
    const list = Array.isArray(links) ? links : [];
    if(!list.length) return "";
    if(list.every((row) => trim(row && row.status) === "signed")) return "signed";
    return "sent";
  }

  function statusLabel(status){
    if(status === "signed") return "חתום";
    if(status === "sent") return "נשלח לחתימה";
    return "";
  }

  function recordSignature(state, token, signedAt){
    const current = state && typeof state === "object" ? state : emptyState("");
    const links = (Array.isArray(current.links) ? current.links : []).map((row) => Object.assign({}, row));
    const key = trim(token);
    const hit = links.find((row) => trim(row.token) === key);
    if(hit){
      hit.status = "signed";
      hit.signedAt = trim(signedAt) || new Date().toISOString();
    }
    return {
      docId: trim(current.docId),
      packetId: trim(current.packetId),
      docName: trim(current.docName),
      customerName: trim(current.customerName),
      links,
      status: deriveStatus(links),
      file: current.file && typeof current.file === "object" ? Object.assign({}, current.file) : null
    };
  }

  function keepSingleCancelDoc(docs, docId, signState){
    const list = (Array.isArray(docs) ? docs : []).map((doc) => Object.assign({}, doc));
    const id = trim(docId);
    const idx = list.findIndex((doc) => trim(doc && doc.id) === id);
    if(idx >= 0 && signState && typeof signState === "object"){
      list[idx].giSignStatus = signState.status || deriveStatus(signState.links);
    }
    return list;
  }

  const GiSignEngine = {
    PAGE_H,
    SIGNATURE_BOXES,
    canSendRole,
    canSendFormsRole,
    shortToken,
    signLink,
    tokenFromLocation,
    greeting,
    toastText,
    boxesFor,
    signersFor,
    signersFromBoxes,
    pdfRect,
    boxIsClear,
    ageYears,
    isAdult,
    recordSignature,
    deriveStatus,
    holdIsFree,
    statusLabel,
    keepSingleCancelDoc,
    personName,
    normalizeId,
    idsMatch
  };

  try { global.GiSignEngine = GiSignEngine; } catch(_e) {}
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
