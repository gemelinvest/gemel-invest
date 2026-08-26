/* GI-FOLLOWUP-ZIP 20260826-followup-docs-v1
   שאלוני המשך ממולאים — מסמך נפרד לכל שאלון + ZIP זמני לנבחרים בלבד. */
(function installGiFollowupZip(global){
  "use strict";

  const TAG = "20260826-followup-docs-v1";
  const DOC_TYPE = "followup_questionnaire";
  const DOC_TYPE_ZIP_LEGACY = "followup_questionnaires_zip";
  const HEB_TEXT_OPTS = { visual: false, align: false };
  const HEADER_FIELD_RE = /^(AgentName|AgentNumber|Date|FullName|FirstName|LastName|PID|Text1|Text2|dsddfddf|ghjhjhgjhg)$/i;

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

  function setHebText(helper, form, fieldName, text, font){
    if(!safeTrim(text) || !fieldName) return;
    if(helper?.setTextSafe) helper.setTextSafe(form, fieldName, text, font, HEB_TEXT_OPTS);
  }

  function listPageFieldNames(pdfDoc, pageIndex){
    const PDFName = global.PDFLib?.PDFName;
    const out = [];
    const seen = new Set();
    try {
      const page = pdfDoc.getPages()[pageIndex];
      const annots = page?.node?.Annots?.();
      if(!annots || !PDFName) return out;
      const arr = typeof annots.asArray === "function" ? annots.asArray() : [];
      arr.forEach((ref) => {
        try {
          let node = pdfDoc.context.lookup(ref);
          const parts = [];
          while(node){
            const t = node.get(PDFName.of("T"));
            if(t){
              const raw = typeof t.decodeText === "function" ? t.decodeText() : String(t);
              parts.unshift(raw);
            }
            const parent = node.get(PDFName.of("Parent"));
            node = parent ? pdfDoc.context.lookup(parent) : null;
          }
          const name = parts.filter(Boolean).join(".");
          if(name && !seen.has(name)){
            seen.add(name);
            out.push(name);
          }
        } catch(_e) {}
      });
    } catch(_e) {}
    return out;
  }

  function keepSinglePage(pdfDoc, pageIndex){
    const keep = Math.max(0, Math.min(pageIndex, pdfDoc.getPageCount() - 1));
    for(let i = pdfDoc.getPageCount() - 1; i > keep; i--) pdfDoc.removePage(i);
    for(let i = 0; i < keep; i++) pdfDoc.removePage(0);
  }

  function contentTextFieldNames(form, pageFieldNames){
    const allow = Array.isArray(pageFieldNames) && pageFieldNames.length
      ? new Set(pageFieldNames)
      : null;
    const names = form.getFields()
      .filter(isTextField)
      .map((f) => f.getName())
      .filter((name) => {
        if(!name || HEADER_FIELD_RE.test(name)) return false;
        if(allow && !allow.has(name)) return false;
        return true;
      });
    return sortFieldNames(names);
  }

  function applySequentialFill(form, entry, cfg, font, pageFieldNames){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const rows = orderedSchemaValues(entry, cfg);
    const textFields = contentTextFieldNames(form, pageFieldNames);
    rows.forEach((row, idx) => {
      const fieldName = textFields[idx];
      if(!fieldName) return;
      const text = row.label ? (row.label + ": " + row.value) : row.value;
      setHebText(helper, form, fieldName, text, font);
    });
    if(rows.length && !textFields.length){
      const fallback = sortFieldNames(form.getFields().filter(isTextField).map((f) => f.getName())
        .filter((n) => n && !/^Agent/i.test(n) && n !== "Date" && (!pageFieldNames || !pageFieldNames.length || pageFieldNames.indexOf(n) >= 0)));
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

  function applyPhoenixFill(form, entry, cfg, font, pageFieldNames){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const qNo = String(entry.questionnaireNum || "");
    // Q2Q* קיימים בטופס הצטרפות בריאות בלבד; אם מופיעים בדף — ממלאים גם אותם.
    (cfg.phoenixHeartMap || []).forEach((row) => {
      if(!row.pdf) return;
      const val = pickFirstValue(entry.followupData, phoenixKeyCandidates(qNo, row.keys || []));
      if(val) setHebText(helper, form, row.pdf, val, font);
    });
    applySequentialFill(form, entry, cfg, font, pageFieldNames);
  }

  function applyInsuredHeader(form, entry, font){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const person = entry.insured?.data || entry.insured || {};
    const fullName = safeTrim(person.fullName) || safeTrim((person.firstName || "") + " " + (person.lastName || "")).trim() || safeTrim(entry.insured?.label);
    const idNumber = safeTrim(person.idNumber);
    const headerFields = [
      ["FullName", fullName],
      ["FirstName", safeTrim(person.firstName) || fullName],
      ["LastName", safeTrim(person.lastName) || fullName],
      ["PID", idNumber],
      ["Text32", fullName],
      ["Text33", idNumber || fullName],
      ["Text35", fullName],
      ["Text36", idNumber],
      ["Text37", safeTrim(entry.insured?.label) || fullName],
      ["Text1", fullName],
      ["Text2", idNumber]
    ];
    headerFields.forEach((pair) => {
      if(pair[1]) setHebText(helper, form, pair[0], pair[1], font);
    });
  }

  async function loadFont(pdfDoc){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    if(!helper?.FONT_FILE || !global.fontkit) return null;
    try {
      const res = await fetch("./fonts/" + helper.FONT_FILE + "?v=" + encodeURIComponent(TAG));
      if(!res.ok) return null;
      const bytes = await res.arrayBuffer();
      pdfDoc.registerFontkit(global.fontkit);
      return pdfDoc.embedFont(bytes, { subset: true });
    } catch(_e){
      return null;
    }
  }

  async function fetchTemplate(url){
    const urls = [
      url + "?v=" + encodeURIComponent(TAG),
      "./" + url.replace(/^\.\//, "") + "?v=" + encodeURIComponent(TAG)
    ];
    let last = "";
    for(let i = 0; i < urls.length; i++){
      try {
        const res = await fetch(urls[i], { cache: "reload" });
        if(res.ok) return new Uint8Array(await res.arrayBuffer());
        last = String(res.status);
      } catch(err){ last = String(err?.message || err); }
    }
    throw new Error("template fetch failed: " + url + (last ? " (" + last + ")" : ""));
  }

  async function fillFollowupPdf(entry){
    if(!global.PDFLib?.PDFDocument) throw new Error("PDFLib missing");
    const cfg = getConfig().COMPANIES?.[entry.companyKey];
    if(!cfg) throw new Error("unknown company " + entry.companyKey);
    const templateBytes = await fetchTemplate(cfg.combinedPdf);
    // copyPages drops AcroForm fields — keep one page via removePage so widgets stay fillable.
    const pdfDoc = await global.PDFLib.PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const pageNum = cfg.pageForQuestionnaire(entry.questionnaireNum);
    const pageIndex = Math.max(0, Math.min((Number(pageNum) || 1) - 1, pdfDoc.getPageCount() - 1));
    const pageFieldNames = listPageFieldNames(pdfDoc, pageIndex);
    keepSinglePage(pdfDoc, pageIndex);
    const form = pdfDoc.getForm();
    const font = await loadFont(pdfDoc);
    applyInsuredHeader(form, entry, font);
    if(cfg.fillMode === "clal_cq") applyClalCqFill(form, entry, cfg, font);
    else if(cfg.fillMode === "phoenix") applyPhoenixFill(form, entry, cfg, font, pageFieldNames);
    else applySequentialFill(form, entry, cfg, font, pageFieldNames);
    try { form.updateFieldAppearances(font || undefined); } catch(_e) {}
    return pdfDoc.save();
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
    const company = safeTrim(entry?.company) || "חברה";
    const role = roleLabel(entry?.insured);
    const parts = ["שאלון המשך " + qNo];
    if(label) parts.push(label);
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
