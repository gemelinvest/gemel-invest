/* GI-FOLLOWUP-ZIP 20260828-sales-mail-hide-v1
   שאלוני המשך ממולאים — מסמך נפרד לכל שאלון + ZIP זמני לנבחרים בלבד. */
(function installGiFollowupZip(global){
  "use strict";

  const TAG = "20260828-sales-mail-hide-v1";
  const templateBytesCache = new Map();
  const pageBytesCache = new Map();
  let fontBytesCache = null;
  const DOC_TYPE = "followup_questionnaire";
  const DOC_TYPE_ZIP_LEGACY = "followup_questionnaires_zip";
  const HEB_TEXT_OPTS = { visual: false, align: false };
  const HACH_CONTENT_FONT = 13;
  const HACH_HEADER_FONT = 12;
  const HACH_FOOTER_NAMES = /^(76456|er67777|Date|AgentName)$/i;
  const HACH_FOOTER_DATE = /^(Date|Text19)$/i;
  const HACH_FOOTER_TIME = /^(Text20|Text40)$/i;
  const HACH_FOOTER_SKIP = /^(Text20|Text40|Text41)$/i;
  const HACH_HEADER_ALIAS = /^(e56756|drt6yu56)$/i;
  const HACH_HEADER_EXCLUDE = /^(AgentName|Date)$/i;
  const HEADER_FIELD_RE = /^(AgentName|AgentNumber|Date|FullName|FirstName|LastName|PID|dsddfddf|ghjhjhgjhg)$/i;
  /* Wizard field order per questionnaire (matches getHachsharaFollowupSchemas). */
  const HACH_FIELD_ORDER = {
    "1": ["reason","date","duration","tests","treatment","ongoing","surgery","followup"],
    "2": ["defect","status","diagnosisAge","treatment","docs"],
    "3": ["eventDate","diagnosis","injury","hospitalized","hospitalDetails","hospitalTreatment","tests","surgery","surgeryDetails","current","disability","workCapacity"],
    "4": ["used","reason","start","type","frequency","stopped","rehab"],
    "5": ["drinkingSince","weeklyAmount","medicalIssues","notes"],
    "6": ["type","diagnosisDate","pills","pillsDetails","diet","insulin","glucose","hba1c","complications"],
    "7": ["hasIssue","diagnosisDate","medicated","cholesterol","triglycerides","notes"],
    "8": ["diagnosisDate","values","medicated","meds","balanced","complications"],
    "9": ["diagnosis","diagnosisDate","lastEvent","frequency","treatment","status"],
    "10": ["diagnosis","diagnosisDate","treatment","function","docs"],
    "11": ["diagnosis","eventDate","tests","treatment","status"],
    "12": ["type","diagnosisDate","treatment","secondary","hb","followup"],
    "13": ["diagnosis","diagnosisDate","treatment","hospitalized","status"],
    "14": ["diagnosis","date","pregnant","treatment","status"],
    "15": ["diagnosisDate","diagnosis","attacks","attacksDetails","treatment","followup","hospitalSurgery","tests"],
    "16": ["diagnosis","diagnosisDate","treatment","surgeryAdvised","surgery","surgeryDetails","kidneyTestsNormal","damage"],
    "17": ["diagnosis","diagnosisDate","treatment","tests","status"],
    "18": ["diagnosis","diagnosisDate","treatment","attacks","status"],
    "19": ["diagnosis","diagnosisDate","treatment","tests","status"],
    "20": ["diagnosis","diagnosisDate","psa","treatment","status"],
    "21": ["diagnosisDate","diagnosis","hospitalized","surgery","surgeryDetails","treatment","balanced"],
    "22": ["diagnosis","eye","number","treatment","status"],
    "23": ["diagnosis","date","treatment","tests","status"],
    "24": ["location","diagnosis","date","treatment","status"],
    "25": ["diagnosis","location","date","treatment","status"],
    "26": ["finding","location","date","tests","treatment","status"],
    "27": ["relative","disease","age","familyDetails"],
    "28": ["reason","date","duration","procedure","outcome"],
    "29": ["diagnosis","date","pregnant","treatment","status"]
  };
  /* 0-based content-slot index when PDF question order ≠ wizard order. */
  const HACH_KEY_SLOT = {
    "1": { date: 1, reason: 2, duration: 3, tests: 4, treatment: 5, ongoing: 6, surgery: 7, followup: 9 }
  };
  const HACH_MERGE_GROUPS = [
    ["pills", "pillsDetails"],
    ["surgery", "surgeryDetails"],
    ["hospitalized", "hospitalDetails", "hospitalTreatment"],
    ["attacks", "attacksDetails"],
    ["glucose", "hba1c"],
    ["medicated", "meds"]
  ];

  function safeTrim(v){
    return String(v == null ? "" : v).trim();
  }
  function isYes(v){
    return safeTrim(v).toLowerCase() === "yes";
  }
  function roleSuffix(insured){
    const t = safeTrim(insured?.type);
    if(t === "spouse" || t === "secondary") return "spouse";
    if(t === "child") return "child-" + safeTrim(insured?.id || "c");
    return "primary";
  }
  function roleLabel(insured){
    const t = safeTrim(insured?.type);
    if(t === "spouse" || t === "secondary") return "בן-בת-זוג";
    if(t === "child") return "ילד";
    return "ראשי";
  }

  function getConfig(){
    return global.GI_FOLLOWUP_ZIP_CONFIG || { COMPANIES: {} };
  }

  function parseQuestionnaireIds(meta){
    const out = [];
    const seen = new Set();
    const push = (v) => {
      const s = safeTrim(v);
      if(!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
    };
    (Array.isArray(meta?.questionnaireNos) ? meta.questionnaireNos : []).forEach(push);
    (Array.isArray(meta?.questionnaireNumbers) ? meta.questionnaireNumbers : []).forEach(push);
    const letter = safeTrim(meta?.questionnaireLetter);
    if(letter){
      letter.split(/[,،\s]+/).forEach(push);
    }
    return out;
  }

  function collectFieldValues(fields){
    const out = {};
    if(!fields || typeof fields !== "object") return out;
    Object.keys(fields).forEach((k) => {
      const v = safeTrim(fields[k]);
      if(v) out[k] = v;
    });
    return out;
  }

  function hasValuesForPrefix(values, prefix){
    return Object.keys(values || {}).some((k) => k.startsWith(prefix) && safeTrim(values[k]));
  }

  function hasValuesForQuestionnaire(values, qId, cfg){
    const id = safeTrim(qId);
    if(!id) return false;
    if(cfg.fillMode === "clal_cq"){
      return hasValuesForPrefix(values, cfg.fieldPrefix(id));
    }
    if(hasValuesForPrefix(values, cfg.fieldPrefix(id))) return true;
    const qPrefix = "q" + id + "_";
    if(Object.keys(values || {}).some((k) => k.toLowerCase().startsWith(qPrefix.toLowerCase()) && safeTrim(values[k]))) return true;
    return false;
  }

  function mergeValues(target, source){
    Object.keys(source || {}).forEach((k) => {
      const v = safeTrim(source[k]);
      if(v && !safeTrim(target[k])) target[k] = v;
    });
    return target;
  }

  function pickFirstValue(values, keys){
    for(let i = 0; i < keys.length; i++){
      const v = safeTrim(values?.[keys[i]]);
      if(v) return v;
    }
    return "";
  }

  function detectTriggeredFollowups(healthDeclaration, meta, insureds){
    const responses = healthDeclaration?.responses && typeof healthDeclaration.responses === "object"
      ? healthDeclaration.responses : {};
    const map = meta?.map && typeof meta.map === "object" ? meta.map : {};
    const cfgRoot = getConfig();
    const insuredById = {};
    (Array.isArray(insureds) ? insureds : []).forEach((ins, idx) => {
      insuredById[String(ins?.id)] = {
        ...ins,
        label: safeTrim(ins?.label) || ("מבוטח " + (idx + 1))
      };
    });

    const bucket = {};
    Object.keys(responses).forEach((qKey) => {
      const qMeta = map[qKey] || {};
      const companyKey = cfgRoot.companyKeyFromQKey?.(qKey) || "";
      if(!companyKey) return;
      const qIds = parseQuestionnaireIds(qMeta);
      const perIns = responses[qKey] || {};
      Object.keys(perIns).forEach((insId) => {
        const row = perIns[insId];
        if(!isYes(row?.answer)) return;
        const values = collectFieldValues(row?.fields);
        const cfg = cfgRoot.COMPANIES?.[companyKey];
        if(!cfg) return;
        const ids = qIds.length ? qIds : inferQuestionnaireIdsFromFields(values, cfg);
        if(!ids.length) return;
        const hasAnyValues = Object.keys(values).length > 0;
        ids.forEach((qId) => {
          // שאלון שאין לו עמוד בקובץ לא נכנס לרשימה — אחרת הפתיחה נכשלת.
          if(typeof cfg.pageForQuestionnaire === "function" && !Number(cfg.pageForQuestionnaire(qId))) return;
          // כן + מספר שאלון → הקובץ נכנס לתיק גם בלי שדות פירוט.
          // אם יש שדות, משאירים רק שאלונים שמתאימים לערכים / לשדות הגנריים.
          if(hasAnyValues && !hasValuesForQuestionnaire(values, qId, cfg) && !hasGenericFollowup(values, qMeta)) return;
          const dedupeKey = [companyKey, insId, qId].join("|");
          if(!bucket[dedupeKey]){
            bucket[dedupeKey] = {
              companyKey,
              company: cfg.label,
              insuredId: insId,
              insured: insuredById[insId] || { id: insId, label: "מבוטח" },
              questionnaireNum: qId,
              questionnaireLabel: safeTrim(qMeta.questionnaireLabel),
              qKeys: [],
              followupData: {},
              followupLabels: {}
            };
          }
          bucket[dedupeKey].qKeys.push(qKey);
          mergeValues(bucket[dedupeKey].followupData, values);
          (Array.isArray(qMeta.fields) ? qMeta.fields : []).forEach((field) => {
            if(field && field.key && field.label){
              bucket[dedupeKey].followupLabels[field.key] = field.label;
            }
          });
        });
      });
    });

    return Object.values(bucket).sort((a, b) => {
      const ca = safeTrim(a.company).localeCompare(safeTrim(b.company), "he");
      if(ca) return ca;
      const ia = safeTrim(a.insured?.label).localeCompare(safeTrim(b.insured?.label), "he");
      if(ia) return ia;
      return String(a.questionnaireNum).localeCompare(String(b.questionnaireNum), "he", { numeric: true });
    });
  }

  function inferQuestionnaireIdsFromFields(values, cfg){
    const out = [];
    if(cfg.fillMode === "clal_cq"){
      getConfig().CLAL_LETTERS.forEach((letter) => {
        if(hasValuesForPrefix(values, cfg.fieldPrefix(letter))) out.push(letter);
      });
      return out;
    }
    Object.keys(values || {}).forEach((k) => {
      let m = /^(\d+)__/.exec(k);
      if(m && out.indexOf(m[1]) < 0) out.push(m[1]);
      m = /^q(\d+)_/i.exec(k);
      if(m && out.indexOf(m[1]) < 0) out.push(m[1]);
    });
    return out;
  }

  function hasGenericFollowup(values, qMeta){
    const fields = Array.isArray(qMeta?.fields) ? qMeta.fields : [];
    return fields.some((f) => f && f.key && safeTrim(values[f.key]));
  }

  function keyMatchesQuestionnaire(key, qId, cfg){
    const id = safeTrim(qId);
    const k = safeTrim(key);
    if(!id || !k) return false;
    if(cfg.fillMode === "clal_cq") return k.startsWith(cfg.fieldPrefix(id));
    if(k.startsWith(cfg.fieldPrefix(id))) return true;
    if(k.toLowerCase().startsWith(("q" + id + "_").toLowerCase())) return true;
    return false;
  }

  function orderedSchemaValues(entry, cfg){
    const qId = entry.questionnaireNum;
    const labels = entry.followupLabels || {};
    const rows = [];
    Object.keys(entry.followupData || {}).forEach((key) => {
      if(!keyMatchesQuestionnaire(key, qId, cfg)) return;
      const val = safeTrim(entry.followupData[key]);
      if(!val) return;
      rows.push({ key, label: labels[key] || key, value: val });
    });
    if(!rows.length){
      Object.keys(entry.followupData || {}).forEach((key) => {
        const val = safeTrim(entry.followupData[key]);
        if(val) rows.push({ key, label: labels[key] || key, value: val });
      });
    }
    return rows;
  }

  function sortFieldNames(names){
    return names.slice().sort((a, b) => {
      const na = Number(String(a).replace(/\D+/g, ""));
      const nb = Number(String(b).replace(/\D+/g, ""));
      if(Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return String(a).localeCompare(String(b), "he");
    });
  }

  function isTextField(field){
    try { return field.constructor.name === "PDFTextField"; } catch(_e){
      return /Text/i.test(String(field?.getName?.() || ""));
    }
  }

  function isCheckBox(field){
    try { return field.constructor.name === "PDFCheckBox"; } catch(_e){
      return /Check/i.test(String(field?.getName?.() || ""));
    }
  }

  function setHebText(helper, form, fieldName, text, font, extraOpts){
    if(!safeTrim(text) || !fieldName) return;
    const opts = Object.assign({}, HEB_TEXT_OPTS, extraOpts || {});
    if(helper?.setTextSafe) helper.setTextSafe(form, fieldName, text, font, opts);
  }

  function listPageFieldMeta(pdfDoc, pageIndex){
    const PDFName = global.PDFLib?.PDFName;
    const out = [];
    const seen = new Set();
    function numOf(v){
      if(v == null) return 0;
      if(typeof v === "number") return v;
      if(typeof v.asNumber === "function") return v.asNumber();
      return Number(v) || 0;
    }
    try {
      const page = pdfDoc.getPages()[pageIndex];
      const annots = page?.node?.Annots?.();
      if(!annots || !PDFName) return out;
      const arr = typeof annots.asArray === "function" ? annots.asArray() : [];
      arr.forEach((ref) => {
        try {
          let node = pdfDoc.context.lookup(ref);
          const parts = [];
          let rect = null;
          let ft = "";
          try {
            const r = node.get(PDFName.of("Rect"));
            if(r && typeof r.asArray === "function") rect = r.asArray().map(numOf);
          } catch(_e) {}
          while(node){
            const t = node.get(PDFName.of("T"));
            if(t){
              const raw = typeof t.decodeText === "function" ? t.decodeText() : String(t);
              parts.unshift(raw);
            }
            const ftNode = node.get(PDFName.of("FT"));
            if(ftNode && !ft) ft = String(ftNode);
            const parent = node.get(PDFName.of("Parent"));
            node = parent ? pdfDoc.context.lookup(parent) : null;
          }
          const name = parts.filter(Boolean).join(".");
          if(!name || seen.has(name)) return;
          seen.add(name);
          const x1 = rect ? Math.min(rect[0], rect[2]) : 0;
          const y1 = rect ? Math.min(rect[1], rect[3]) : 0;
          const x2 = rect ? Math.max(rect[0], rect[2]) : 0;
          const y2 = rect ? Math.max(rect[1], rect[3]) : 0;
          const ftStr = String(ft || "");
          const kind = /Sig/i.test(ftStr) || /^Signature/i.test(name) || /Must/i.test(name)
            ? "sig"
            : (/Btn/i.test(ftStr) || /Check/i.test(name) ? "btn" : "tx");
          out.push({ name, x: x1, y: y2, w: x2 - x1, h: y2 - y1, kind });
        } catch(_e) {}
      });
    } catch(_e) {}
    return out;
  }

  function leafKey(key){
    return String(key || "").replace(/^.*__/, "");
  }
  function leafNorm(key){
    return leafKey(key).toLowerCase();
  }

  function isGenericNoteKey(key){
    const raw = String(key || "");
    if(/^base__/i.test(raw)) return true;
    if(!/__/.test(raw)){
      return /^(details|followup|notes|docs|status|result|infectiousdetails|liverdetails|herniadetails)$/.test(raw.toLowerCase());
    }
    return false;
  }

  function splitHachsharaRows(entry, cfg){
    const qId = safeTrim(entry.questionnaireNum);
    const labels = entry.followupLabels || {};
    const data = entry.followupData || {};
    const specific = [];
    const notes = [];
    Object.keys(data).forEach((key) => {
      const val = safeTrim(data[key]);
      if(!val) return;
      const row = { key, leaf: leafKey(key), label: labels[key] || "", value: val };
      if(keyMatchesQuestionnaire(key, qId, cfg)) specific.push(row);
      else if(isGenericNoteKey(key)) notes.push(row);
    });
    return { specific: orderHachsharaRows(specific, qId), notes };
  }

  function orderHachsharaRows(rows, qId){
    const order = HACH_FIELD_ORDER[String(qId)] || [];
    const rank = {};
    order.forEach((leaf, i) => { rank[leaf.toLowerCase()] = i; });
    return rows.slice().sort((a, b) => {
      const ra = Object.prototype.hasOwnProperty.call(rank, leafNorm(a.leaf)) ? rank[leafNorm(a.leaf)] : 1000;
      const rb = Object.prototype.hasOwnProperty.call(rank, leafNorm(b.leaf)) ? rank[leafNorm(b.leaf)] : 1000;
      if(ra !== rb) return ra - rb;
      return String(a.key).localeCompare(String(b.key));
    });
  }

  function coalesceHachsharaRows(rows){
    const byLeaf = {};
    rows.forEach((r) => { byLeaf[leafNorm(r.leaf)] = r; });
    const drop = new Set();
    HACH_MERGE_GROUPS.forEach((group) => {
      const parts = group.map((leaf) => byLeaf[leaf.toLowerCase()]).filter(Boolean);
      if(parts.length < 2) return;
      const head = parts[0];
      const extra = parts.slice(1).map((r) => r.value).filter(Boolean);
      if(leafNorm(head.leaf) === "glucose" && byLeaf.hba1c){
        head.value = "גלוקוז: " + head.value + " | HbA1C: " + byLeaf.hba1c.value;
      } else {
        head.value = [head.value].concat(extra).join(" · ");
      }
      parts.slice(1).forEach((r) => drop.add(r.key));
    });
    return rows.filter((r) => !drop.has(r.key));
  }

  function isHachsharaFooterField(m, headerNames){
    if(!m || headerNames.has(m.name)) return false;
    if(HACH_FOOTER_NAMES.test(m.name) || HACH_FOOTER_DATE.test(m.name) || HACH_FOOTER_TIME.test(m.name) || HACH_FOOTER_SKIP.test(m.name)) return true;
    const y = Number(m.y) || 0;
    const w = Number(m.w) || 0;
    const h = Number(m.h) || 0;
    if(w >= 180) return false;
    if(y < 280 && w < 180) return true;
    if(y < 360 && w < 130 && h <= 28) return true;
    return false;
  }

  function classifyHachsharaFields(fieldMeta){
    const text = (fieldMeta || []).filter((m) => m && m.kind === "tx");
    const maxY = text.reduce((acc, m) => Math.max(acc, Number(m.y) || 0), 0);
    const header = text.filter((m) => {
      if(HACH_HEADER_EXCLUDE.test(m.name)) return false;
      return (Number(m.y) || 0) >= maxY - 28 || HACH_HEADER_ALIAS.test(m.name);
    }).sort((a, b) => (Number(b.x) || 0) - (Number(a.x) || 0));
    const headerNames = new Set(header.map((m) => m.name));
    const footer = text.filter((m) => isHachsharaFooterField(m, headerNames));
    const footerNames = new Set(footer.map((m) => m.name));
    const content = text.filter((m) => !headerNames.has(m.name) && !footerNames.has(m.name))
      .sort((a, b) => {
        const dy = (Number(b.y) || 0) - (Number(a.y) || 0);
        if(Math.abs(dy) > 8) return dy;
        return (Number(b.x) || 0) - (Number(a.x) || 0);
      });
    return { header, footer, content };
  }

  function writableHachsharaContent(content){
    return (content || []).filter((m) => {
      const h = Number(m.h) || 0;
      const w = Number(m.w) || 0;
      return h >= 16 || w >= 180;
    });
  }

  function hachsharaFontOpts(slot){
    const h = Number(slot && slot.h) || 0;
    const w = Number(slot && slot.w) || 0;
    const size = h >= 22 || w >= 180 ? HACH_CONTENT_FONT : (h >= 16 ? 11 : 9);
    return { fontSize: size, multiline: h >= 20 || w >= 180 };
  }

  function readFieldText(form, name){
    try { return safeTrim(form.getTextField(name).getText()); } catch(_e){ return ""; }
  }

  function writeContentSlot(helper, form, slot, text, font, used){
    if(!slot || !safeTrim(text)) return;
    used.add(slot.name);
    setHebText(helper, form, slot.name, text, font, hachsharaFontOpts(slot));
  }

  function pickRemarksSlot(content, writable, used, followupSlot){
    const unused = writable.filter((m) => !used.has(m.name));
    const remarkish = unused.filter((m) => Number(m.w) >= 300 || Number(m.h) >= 36)
      .sort((a, b) => (Number(b.w) * Number(b.h)) - (Number(a.w) * Number(a.h)));
    if(remarkish[0]) return remarkish[0];
    if(followupSlot) return followupSlot;
    if(unused.length) return unused[unused.length - 1];
    if(writable.length) return writable[writable.length - 1];
    return content[content.length - 1] || null;
  }

  function applyHachsharaFill(form, entry, cfg, font, fieldMeta){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const head = { fontSize: HACH_HEADER_FONT };
    const { header, footer, content } = classifyHachsharaFields(fieldMeta);
    const writable = writableHachsharaContent(content);
    const person = entry.insured?.data || entry.insured || {};
    const fullName = safeTrim(person.fullName)
      || safeTrim((person.firstName || "") + " " + (person.lastName || "")).trim()
      || safeTrim(entry.insured?.label);
    const idNumber = safeTrim(person.idNumber);
    if(header[0] && fullName) setHebText(helper, form, header[0].name, fullName, font, head);
    if(header[1] && idNumber) setHebText(helper, form, header[1].name, idNumber, font, head);
    else if(header[1] && fullName) setHebText(helper, form, header[1].name, fullName, font, head);

    const qId = safeTrim(entry.questionnaireNum);
    const { specific, notes } = splitHachsharaRows(entry, cfg);
    const rows = coalesceHachsharaRows(specific);
    const slotMap = HACH_KEY_SLOT[qId] || {};
    const mergeTails = {};
    HACH_MERGE_GROUPS.forEach((g) => g.slice(1).forEach((leaf) => { mergeTails[leaf.toLowerCase()] = g[0]; }));
    const schemaLeaves = (HACH_FIELD_ORDER[qId] || []).filter((leaf) => !mergeTails[leaf.toLowerCase()]);
    const used = new Set();
    const slotByLeaf = {};
    const overflow = [];

    function slotIndexFor(leaf){
      const n = String(leaf || "").toLowerCase();
      if(Object.prototype.hasOwnProperty.call(slotMap, n)) return slotMap[n];
      if(Object.prototype.hasOwnProperty.call(slotMap, leaf)) return slotMap[leaf];
      const canon = mergeTails[n] || leaf;
      if(Object.prototype.hasOwnProperty.call(slotMap, String(canon).toLowerCase())) return slotMap[String(canon).toLowerCase()];
      if(Object.prototype.hasOwnProperty.call(slotMap, canon)) return slotMap[canon];
      const idx = schemaLeaves.findIndex((item) => String(item).toLowerCase() === String(canon).toLowerCase());
      return idx >= 0 ? idx : -1;
    }

    rows.forEach((row) => {
      const idx = slotIndexFor(row.leaf);
      let slot = idx >= 0 ? (writable[idx] || content[idx] || null) : null;
      if(slot && used.has(slot.name)) slot = null;
      if(!slot){
        slot = writable.find((m) => !used.has(m.name)) || content.find((m) => !used.has(m.name)) || null;
      }
      if(!slot){
        overflow.push(row);
        return;
      }
      writeContentSlot(helper, form, slot, row.value, font, used);
      slotByLeaf[row.leaf] = slot;
      slotByLeaf[leafNorm(row.leaf)] = slot;
      const canon = mergeTails[leafNorm(row.leaf)] || row.leaf;
      slotByLeaf[canon] = slot;
      slotByLeaf[String(canon).toLowerCase()] = slot;
    });

    const noteTexts = notes.map((n) => (n.label ? (n.label + ": " + n.value) : n.value)).filter(Boolean);
    overflow.forEach((row) => noteTexts.push(row.label ? (row.label + ": " + row.value) : row.value));
    if(noteTexts.length){
      const followupSlot = slotByLeaf.followup || slotByLeaf.notes || slotByLeaf.docs || slotByLeaf.status || slotByLeaf.complications || slotByLeaf.treatment || slotByLeaf.outcome || null;
      const slot = pickRemarksSlot(content, writable, used, followupSlot);
      if(slot){
        let text = noteTexts.join("\n");
        const prev = used.has(slot.name) ? readFieldText(form, slot.name) : "";
        if(prev) text = prev + "\n" + text;
        writeContentSlot(helper, form, slot, text, font, used);
      }
    }

    const agent = safeTrim(global.Auth?.current?.name);
    let dateStr = "";
    try { dateStr = new Date().toLocaleDateString("he-IL"); } catch(_e) { dateStr = ""; }
    const footName = footer.filter((m) => !HACH_FOOTER_SKIP.test(m.name) && !HACH_FOOTER_DATE.test(m.name) && !HACH_HEADER_EXCLUDE.test(m.name) && !/AgentName/i.test(m.name))
      .sort((a, b) => (Number(b.x) || 0) - (Number(a.x) || 0));
    footer.forEach((m) => {
      if(HACH_FOOTER_SKIP.test(m.name)) return;
      if(HACH_FOOTER_DATE.test(m.name) && dateStr) setHebText(helper, form, m.name, dateStr, font, head);
      else if(/AgentName/i.test(m.name) && agent) setHebText(helper, form, m.name, agent, font, head);
      else if(m.name === "er67777" && fullName) setHebText(helper, form, m.name, fullName, font, head);
      else if(m.name === "76456" && idNumber) setHebText(helper, form, m.name, idNumber, font, head);
    });
    if(footName[0] && fullName && footName[0].name !== "er67777") setHebText(helper, form, footName[0].name, fullName, font, head);
    if(footName[1] && idNumber && footName[1].name !== "76456") setHebText(helper, form, footName[1].name, idNumber, font, head);
  }

  function listPageFieldNames(pdfDoc, pageIndex){
    return listPageFieldMeta(pdfDoc, pageIndex).map((m) => m.name);
  }

  function pageAnnotDicts(pdfDoc, pageIndex){
    const onPage = new Set();
    try{
      const page = pdfDoc.getPages()[pageIndex];
      const annots = page?.node?.Annots?.();
      const arr = annots && typeof annots.asArray === "function" ? annots.asArray() : [];
      arr.forEach((ref) => {
        try{ onPage.add(pdfDoc.context.lookup(ref)); }catch(_e){}
      });
    }catch(_e){}
    return onPage;
  }

  /* Combined questionnaires repeat Text22/e56756/… on every page.
     pdf-lib getTextField writes the first name match. After the other
     pages are removed, that match is an orphan and the visible widget
     stays empty. Drop every field whose widget is not on the kept page
     before the pages themselves are removed. */
  function dropFieldsOutsidePage(pdfDoc, pageIndex){
    const onPage = pageAnnotDicts(pdfDoc, pageIndex);
    if(!onPage.size) return;
    let form = null;
    try{ form = pdfDoc.getForm(); }catch(_e){ return; }
    if(!form || !form.acroForm) return;
    const drop = [];
    form.getFields().forEach((field) => {
      let widgets = [];
      try{ widgets = field.acroField.getWidgets() || []; }catch(_e){ widgets = []; }
      if(widgets.some((w) => w && onPage.has(w.dict))) return;
      drop.push(field);
    });
    drop.forEach((field) => {
      try{ form.acroForm.removeField(field.acroField); }catch(_e){}
    });
  }

  function keepSinglePage(pdfDoc, pageIndex){
    const keep = Math.max(0, Math.min(pageIndex, pdfDoc.getPageCount() - 1));
    dropFieldsOutsidePage(pdfDoc, keep);
    /* removePage ממספר את העץ מחדש ומשאיר את העמוד הראשון במקום העמוד שביקשנו.
       משאירים את העמוד הנבחר כילד יחיד של עץ העמודים, בלי למחוק את המילון שלו. */
    const PDFName = global.PDFLib?.PDFName;
    const PDFNumber = global.PDFLib?.PDFNumber;
    const PDFArray = global.PDFLib?.PDFArray;
    const page = pdfDoc.getPages()[keep];
    if(PDFName && PDFNumber && PDFArray && page && page.ref && pdfDoc.catalog && pdfDoc.context){
      const pagesKey = pdfDoc.catalog.get(PDFName.of("Pages"));
      const pagesNode = pdfDoc.context.lookup(pagesKey);
      const kids = PDFArray.withContext(pdfDoc.context);
      kids.push(page.ref);
      pagesNode.set(PDFName.of("Kids"), kids);
      pagesNode.set(PDFName.of("Count"), PDFNumber.of(1));
      try { page.node.set(PDFName.of("Parent"), pagesKey); } catch(_e) {}
      try { pdfDoc.pageCache.invalidate(); } catch(_e2) {}
      pdfDoc.pageCount = undefined;
      return;
    }
    for(let i = pdfDoc.getPageCount() - 1; i > keep; i--) pdfDoc.removePage(i);
    for(let i = 0; i < keep; i++) pdfDoc.removePage(0);
  }

  function contentTextFieldNames(form, pageFieldNames, headerNames){
    const allow = Array.isArray(pageFieldNames) && pageFieldNames.length
      ? new Set(pageFieldNames)
      : null;
    const names = form.getFields()
      .filter(isTextField)
      .map((f) => f.getName())
      .filter((name) => {
        if(!name || HEADER_FIELD_RE.test(name)) return false;
        if(headerNames && headerNames.has(name)) return false;
        if(allow && !allow.has(name)) return false;
        return true;
      });
    return sortFieldNames(names);
  }

  function applySequentialFill(form, entry, cfg, font, pageFieldNames, headerNames){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const rows = orderedSchemaValues(entry, cfg);
    const textFields = contentTextFieldNames(form, pageFieldNames, headerNames);
    rows.forEach((row, idx) => {
      const fieldName = textFields[idx];
      if(!fieldName) return;
      const text = row.label ? (row.label + ": " + row.value) : row.value;
      setHebText(helper, form, fieldName, text, font);
    });
    if(rows.length && !textFields.length){
      const fallback = sortFieldNames(form.getFields().filter(isTextField).map((f) => f.getName())
        .filter((n) => n && !/^Agent/i.test(n) && n !== "Date" && !(headerNames && headerNames.has(n)) && (!pageFieldNames || !pageFieldNames.length || pageFieldNames.indexOf(n) >= 0)));
      if(fallback.length){
        const blob = rows.map((r) => (r.label ? (r.label + ": " + r.value) : r.value)).join(" | ");
        setHebText(helper, form, fallback[fallback.length - 1], blob, font);
      }
    }
    rows.forEach((row) => {
      if(row.value !== "לא" && row.value !== "כן") return;
      const yes = row.value === "כן";
      form.getFields().forEach((field) => {
        try {
          if(!isCheckBox(field)) return;
          const name = field.getName();
          if(!name || name.indexOf("Check") < 0) return;
          if(pageFieldNames && pageFieldNames.length && pageFieldNames.indexOf(name) < 0) return;
          if(yes) field.check(); else field.uncheck();
        } catch(_e) {}
      });
    });
  }

  function applyClalCqFill(form, entry, cfg, font){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const letter = entry.questionnaireNum;
    const cq = cfg.cqForLetter(letter);
    if(!cq) return;
    const rows = orderedSchemaValues(entry, cfg);
    rows.forEach((row, idx) => {
      const qIdx = idx + 1;
      const candidates = ["CQ" + cq + "Q" + qIdx, "CQ" + cq + "Q" + String(qIdx).padStart(2, "0")];
      const text = row.value;
      candidates.forEach((name) => setHebText(helper, form, name, text, font));
      if(row.value === "כן" || row.value === "לא"){
        candidates.forEach((name) => {
          try {
            const field = form.getField(name);
            if(!field || !isCheckBox(field)) return;
            if(row.value === "כן") field.check(); else field.uncheck();
          } catch(_e) {}
        });
      }
    });
    try {
      setHebText(helper, form, "CQ" + cq, entry.insured?.label || "", font);
    } catch(_e) {}
  }

  function phoenixKeyCandidates(qNo, keys){
    const out = [];
    (keys || []).forEach((k) => {
      out.push(String(qNo) + "__" + k);
      out.push("q" + qNo + "_" + k);
      out.push(k);
    });
    return out;
  }

  function applyPhoenixFill(form, entry, cfg, font, pageFieldNames, headerNames){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const qNo = String(entry.questionnaireNum || "");
    // Q2Q* קיימים בטופס הצטרפות בריאות בלבד; אם מופיעים בדף — ממלאים גם אותם.
    (cfg.phoenixHeartMap || []).forEach((row) => {
      if(!row.pdf) return;
      const val = pickFirstValue(entry.followupData, phoenixKeyCandidates(qNo, row.keys || []));
      if(val) setHebText(helper, form, row.pdf, val, font);
    });
    applySequentialFill(form, entry, cfg, font, pageFieldNames, headerNames);
  }

  function personIdentity(entry){
    const person = entry?.insured?.data || entry?.insured || {};
    const fullName = safeTrim(person.fullName) || safeTrim((person.firstName || "") + " " + (person.lastName || "")).trim() || safeTrim(entry?.insured?.label);
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = safeTrim(person.firstName) || nameParts[0] || "";
    const lastName = safeTrim(person.lastName) || nameParts.slice(1).join(" ");
    return {
      fullName,
      firstName,
      lastName,
      idNumber: safeTrim(person.idNumber),
      birth: safeTrim(person.birthDate) || safeTrim(person.dob) || safeTrim(person.birth_date),
      phone: safeTrim(person.phone) || safeTrim(person.mobile),
      email: safeTrim(person.email),
      city: safeTrim(person.city)
    };
  }

  function primaryIdentity(entry){
    const primary = entry?.primaryInsured;
    if(!primary) return null;
    return personIdentity({ insured: primary });
  }

  /* שדות כותרת לפי המיקום המודפס, כי בכל עמוד השמות משתנים (Text1 מול Text15). */
  function headerTextRow(pageFieldMeta, minY){
    const rows = (Array.isArray(pageFieldMeta) ? pageFieldMeta : []).filter((m) => {
      return m && m.kind === "tx" && Number(m.y) >= minY && Number(m.w) >= 70 && !/Agent|Date|Signature|Account/i.test(m.name);
    });
    if(!rows.length) return [];
    const top = Math.max.apply(null, rows.map((m) => Number(m.y) || 0));
    return rows.filter((m) => top - Number(m.y) < 28).sort((a, b) => Number(b.x) - Number(a.x));
  }

  function applyInsuredHeader(form, entry, font, pageFieldMeta){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const idn = personIdentity(entry);
    const primary = primaryIdentity(entry) || idn;
    const used = new Set();
    const put = (name, value) => {
      if(!name) return;
      used.add(name);
      if(safeTrim(value)) setHebText(helper, form, name, value, font);
    };
    [
      ["FullName", idn.fullName],
      ["FirstName", idn.firstName || idn.fullName],
      ["LastName", idn.lastName],
      ["PID", idn.idNumber],
      ["ID", idn.idNumber],
      ["IdNumber", idn.idNumber],
      ["BirthDate", idn.birth],
      ["DOB", idn.birth],
      ["Phone", idn.phone],
      ["Mobile", idn.phone],
      ["Email", idn.email],
      ["City", idn.city]
    ].forEach((pair) => put(pair[0], pair[1]));
    const companyKey = safeTrim(entry?.companyKey);
    if(companyKey === "phoenix"){
      put("Text32", idn.fullName);
      put("Text33", idn.idNumber);
      put("Text35", primary.idNumber);
      put("Text36", primary.firstName);
      put("Text37", primary.lastName);
    } else if(companyKey === "clal"){
      put("InsurancedFirstName", idn.firstName || idn.fullName);
      put("InsurancedLastName", idn.lastName || idn.fullName);
      put("InsurancedName", idn.fullName);
      put("PIDInsuranced", idn.idNumber);
      put("InsurancedBirthDate", idn.birth);
    } else if(companyKey === "menora"){
      const row = headerTextRow(pageFieldMeta, 640);
      [idn.lastName || idn.fullName, idn.firstName || idn.fullName, idn.idNumber].forEach((value, idx) => {
        if(row[idx]) put(row[idx].name, value);
      });
    } else if(companyKey === "ayalon"){
      const row = headerTextRow(pageFieldMeta, 660);
      if(row[1]) put(row[1].name, idn.idNumber);
      if(row[2]) put(row[2].name, idn.fullName);
      if(row[0]) used.add(row[0].name);
    } else if(companyKey === "migdal" || companyKey === "magdal"){
      (Array.isArray(pageFieldMeta) ? pageFieldMeta : []).forEach((m) => {
        if(m && m.kind === "tx" && Number(m.y) >= 710 && Number(m.w) >= 160 && !/Agent/i.test(m.name)) put(m.name, idn.fullName);
      });
      const tops = (Array.isArray(pageFieldMeta) ? pageFieldMeta : []).filter((m) => m && m.kind === "tx" && Number(m.y) >= 770 && Number(m.w) < 160 && !/Agent/i.test(m.name));
      tops.sort((a, b) => Number(b.x) - Number(a.x));
      if(tops[0]) put(tops[0].name, idn.idNumber);
      if(tops[1]) used.add(tops[1].name);
    }
    return used;
  }

  async function loadFont(pdfDoc){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    if(!helper?.FONT_FILE || !global.fontkit) return null;
    try {
      if(!fontBytesCache){
        const res = await fetch("./fonts/" + helper.FONT_FILE + "?v=" + encodeURIComponent(TAG));
        if(!res.ok) return null;
        fontBytesCache = await res.arrayBuffer();
      }
      pdfDoc.registerFontkit(global.fontkit);
      return pdfDoc.embedFont(fontBytesCache.slice(0), { subset: true });
    } catch(_e){
      return null;
    }
  }

  async function fetchTemplate(url){
    const cached = templateBytesCache.get(url);
    if(cached) return cached.slice();
    const urls = [
      url + "?v=" + encodeURIComponent(TAG),
      "./" + url.replace(/^\.\//, "") + "?v=" + encodeURIComponent(TAG)
    ];
    let last = "";
    for(let i = 0; i < urls.length; i++){
      try {
        const res = await fetch(urls[i]);
        if(res.ok){
          const bytes = new Uint8Array(await res.arrayBuffer());
          templateBytesCache.set(url, bytes.slice());
          return bytes;
        }
        last = String(res.status);
      } catch(err){ last = String(err?.message || err); }
    }
    throw new Error("template fetch failed: " + url + (last ? " (" + last + ")" : ""));
  }

  async function isolatedPageBytes(cfg, qNum){
    const pageNum = Number(cfg.pageForQuestionnaire(qNum));
    if(!pageNum) throw new Error("אין עמוד בקובץ לשאלון " + String(qNum || ""));
    const key = String(cfg.combinedPdf) + "#" + String(pageNum);
    const cached = pageBytesCache.get(key);
    if(cached) return cached.slice();
    const templateBytes = await fetchTemplate(cfg.combinedPdf);
    const pdfDoc = await global.PDFLib.PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const pageIndex = Math.max(0, Math.min((Number(pageNum) || 1) - 1, pdfDoc.getPageCount() - 1));
    keepSinglePage(pdfDoc, pageIndex);
    const saved = await pdfDoc.save({ updateFieldAppearances: false });
    pageBytesCache.set(key, saved.slice());
    return saved;
  }

  async function prefetchFollowupPage(entry){
    const cfg = getConfig().COMPANIES?.[entry?.companyKey];
    if(!cfg || !global.PDFLib?.PDFDocument) return;
    try { await isolatedPageBytes(cfg, entry.questionnaireNum); } catch(_e){}
  }

  async function paintAnswerText(pdfDoc, font){
    if(!font) return;
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const rgb = global.PDFLib?.rgb;
    if(!rgb) return;
    let form = null;
    try { form = pdfDoc.getForm(); } catch(_e){ form = null; }
    const page = pdfDoc.getPages()[0];
    if(!form || !page) return;
    form.getFields().filter(isTextField).forEach((field) => {
      let text = "";
      try { text = safeTrim(field.getText()); } catch(_e){ return; }
      if(!text) return;
      const name = safeTrim(field.getName());
      if(/Signature|Must|Sign/i.test(name)) return;
      let rect = null;
      try {
        const widgets = field.acroField?.getWidgets?.() || [];
        rect = widgets[0] && widgets[0].getRectangle ? widgets[0].getRectangle() : null;
      } catch(_e2){ rect = null; }
      if(!rect || !(rect.width > 8) || !(rect.height > 8)) return;
      const size = Math.max(8, Math.min(11, Math.floor(rect.height - 4)));
      const visual = helper?.visualHebrew ? helper.visualHebrew(text) : text;
      try {
        page.drawText(visual, {
          x: rect.x + 3,
          y: rect.y + Math.max(1, (rect.height - size) * 0.35),
          size,
          font,
          color: rgb(0.05, 0.08, 0.16),
          maxWidth: Math.max(10, rect.width - 6)
        });
      } catch(_e3){}
    });
  }

  async function fillFollowupPdf(entry){
    if(!global.PDFLib?.PDFDocument) throw new Error("PDFLib missing");
    const cfg = getConfig().COMPANIES?.[entry.companyKey];
    if(!cfg) throw new Error("unknown company " + entry.companyKey);
    const pageBytes = await isolatedPageBytes(cfg, entry.questionnaireNum);
    const pdfDoc = await global.PDFLib.PDFDocument.load(pageBytes, { ignoreEncryption: true });
    const pageFieldMeta = listPageFieldMeta(pdfDoc, 0);
    const pageFieldNames = pageFieldMeta.map((m) => m.name);
    const form = pdfDoc.getForm();
    const font = await loadFont(pdfDoc);
    if(cfg.fillMode === "hachshara"){
      applyHachsharaFill(form, entry, cfg, font, pageFieldMeta);
    } else {
      const headerNames = applyInsuredHeader(form, entry, font, pageFieldMeta);
      if(cfg.fillMode === "clal_cq") applyClalCqFill(form, entry, cfg, font);
      else if(cfg.fillMode === "phoenix") applyPhoenixFill(form, entry, cfg, font, pageFieldNames, headerNames);
      else applySequentialFill(form, entry, cfg, font, pageFieldNames, headerNames);
    }
    await paintAnswerText(pdfDoc, font);
    return pdfDoc.save({ updateFieldAppearances: false });
  }

  async function loadFollowupPageBytes(entry){
    if(!global.PDFLib?.PDFDocument) throw new Error("PDFLib missing");
    const cfg = getConfig().COMPANIES?.[entry.companyKey];
    if(!cfg) throw new Error("unknown company " + entry.companyKey);
    return isolatedPageBytes(cfg, entry.questionnaireNum);
  }

  function mergeHealthResponses(target, decl){
    const responses = decl && decl.responses && typeof decl.responses === "object" ? decl.responses : null;
    if(!responses) return target;
    Object.keys(responses).forEach((qKey) => {
      const row = responses[qKey];
      if(!row || typeof row !== "object") return;
      if(!target[qKey]) target[qKey] = {};
      Object.keys(row).forEach((insId) => {
        const incoming = row[insId];
        if(!incoming || typeof incoming !== "object") return;
        const prev = target[qKey][insId];
        if(!prev){
          target[qKey][insId] = incoming;
          return;
        }
        const prevYes = isYes(prev.answer);
        const nextYes = isYes(incoming.answer);
        const prevFields = collectFieldValues(prev.fields);
        const nextFields = collectFieldValues(incoming.fields);
        target[qKey][insId] = {
          ...prev,
          ...incoming,
          answer: (nextYes || prevYes) ? "yes" : (incoming.answer != null ? incoming.answer : prev.answer),
          fields: { ...prevFields, ...nextFields }
        };
      });
    });
    return target;
  }

  function collectHealthResponses(rec){
    const payload = rec && rec.payload && typeof rec.payload === "object" ? rec.payload : {};
    const merged = {};
    mergeHealthResponses(merged, payload.primary && payload.primary.healthDeclaration);
    mergeHealthResponses(merged, payload.healthDeclaration);
    mergeHealthResponses(merged, payload.operational && payload.operational.primary && payload.operational.primary.healthDeclaration);
    (Array.isArray(payload.insureds) ? payload.insureds : []).forEach((ins) => {
      mergeHealthResponses(merged, ins && ins.data && ins.data.healthDeclaration);
    });
    return { responses: merged };
  }

  function zipEntryPath(entry){
    const cfg = getConfig().COMPANIES?.[entry.companyKey];
    const base = cfg?.fileLabel ? cfg.fileLabel(entry.questionnaireNum) : ("q-" + entry.questionnaireNum);
    const role = roleSuffix(entry.insured);
    return entry.company + "/" + role + "/" + base + ".pdf";
  }

  function buildDocTitle(entry){
    const qNo = safeTrim(entry?.questionnaireNum) || "?";
    const label = safeTrim(entry?.questionnaireLabel);
    const topic = safeTrim(entry?.questionnaireTopic);
    const company = safeTrim(entry?.company) || "חברה";
    const role = roleLabel(entry?.insured);
    const head = topic
      ? (/^שאלון/.test(topic) ? topic : ("שאלון " + topic))
      : ("שאלון המשך " + qNo);
    const parts = [head];
    if(!topic && label) parts.push(label);
    parts.push(company);
    if(role && role !== "ראשי") parts.push(role);
    return parts.join(" · ");
  }

  function stableDocId(entry){
    const co = safeTrim(entry?.companyKey) || "co";
    const ins = safeTrim(entry?.insuredId) || "ins";
    const q = safeTrim(entry?.questionnaireNum) || "q";
    return "doc_followup_" + co + "__" + ins + "__" + encodeURIComponent(q);
  }

  function sanitizeZipName(name){
    return safeTrim(name).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "document";
  }

  async function buildFollowupZip(triggeredList){
    if(!global.JSZip) throw new Error("JSZip missing");
    const zip = new global.JSZip();
    for(let i = 0; i < triggeredList.length; i++){
      const entry = triggeredList[i];
      const bytes = await fillFollowupPdf(entry);
      zip.file(zipEntryPath(entry), bytes);
    }
    return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  async function packFilesIntoZip(files){
    if(!global.JSZip) throw new Error("JSZip missing");
    const zip = new global.JSZip();
    const used = Object.create(null);
    (Array.isArray(files) ? files : []).forEach((file, idx) => {
      if(!file || !file.bytes) return;
      let name = sanitizeZipName(file.fileName || ("document-" + (idx + 1)));
      if(used[name]){
        const extIdx = name.lastIndexOf(".");
        const base = extIdx > 0 ? name.slice(0, extIdx) : name;
        const ext = extIdx > 0 ? name.slice(extIdx) : "";
        let n = 2;
        while(used[base + "-" + n + ext]) n += 1;
        name = base + "-" + n + ext;
      }
      used[name] = true;
      zip.file(name, file.bytes);
    });
    return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  function buildZipFileName(rec, companies){
    const docs = global.CustomerDocuments;
    const insured = docs?.getPrimaryInsuredLabel?.(rec?.payload) || "מבוטח";
    const co = (Array.isArray(companies) && companies.length === 1)
      ? companies[0]
      : ((companies || []).slice(0, 2).join("-") || "מסמכים-נבחרים");
    const safe = String(insured).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    return "מסמכים-נבחרים-" + co + "-" + safe + ".zip";
  }

  async function blobToDataUrl(blob){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read blob failed"));
      reader.readAsDataURL(blob);
    });
  }

  const GiFollowupZip = {
    TAG,
    DOC_TYPE,
    DOC_TYPE_ZIP_LEGACY,
    detectTriggeredFollowups,
    fillFollowupPdf,
    loadFollowupPageBytes,
    prefetchFollowupPage,
    buildFollowupZip,
    packFilesIntoZip,
    buildZipFileName,
    buildDocTitle,
    stableDocId,
    roleLabel,
    roleSuffix,
    blobToDataUrl,
    zipEntryPath,
    // test helpers
    _test: {
      parseQuestionnaireIds,
      inferQuestionnaireIdsFromFields,
      hasValuesForQuestionnaire,
      orderedSchemaValues,
      keepSinglePage,
      listPageFieldNames,
      listPageFieldMeta,
      classifyHachsharaFields,
      splitHachsharaRows,
      isGenericNoteKey,
      applyHachsharaFill,
      applyInsuredHeader,
      applySequentialFill,
      dropFieldsOutsidePage,
      collectHealthResponses,
      HEB_TEXT_OPTS
    },
    resolveForCustomer(rec, meta, insureds){
      return detectTriggeredFollowups(collectHealthResponses(rec), meta, insureds);
    },
    hasTriggered(rec, meta, insureds){
      return this.resolveForCustomer(rec, meta, insureds).length > 0;
    }
  };

  global.GiFollowupZip = GiFollowupZip;
})(typeof window !== "undefined" ? window : globalThis);
