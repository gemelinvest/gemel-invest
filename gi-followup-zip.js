/* GI-FOLLOWUP-ZIP 20260825-followup-zip-v1
   ZIP אחד של שאלוני המשך ממולאים — רק שאלונים שנפתחו בפועל. */
(function installGiFollowupZip(global){
  "use strict";

  const TAG = "20260825-followup-zip-v1";
  const DOC_TYPE = "followup_questionnaires_zip";

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
        if(!Object.keys(values).length) return;
        const cfg = cfgRoot.COMPANIES?.[companyKey];
        if(!cfg) return;
        const ids = qIds.length ? qIds : inferQuestionnaireIdsFromFields(values, cfg);
        ids.forEach((qId) => {
          const prefix = cfg.fieldPrefix(qId);
          if(!hasValuesForPrefix(values, prefix) && !hasGenericFollowup(values, qMeta)) return;
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
      const m = /^(\d+)__/.exec(k);
      if(m && out.indexOf(m[1]) < 0) out.push(m[1]);
    });
    return out;
  }

  function hasGenericFollowup(values, qMeta){
    const fields = Array.isArray(qMeta?.fields) ? qMeta.fields : [];
    return fields.some((f) => f && f.key && safeTrim(values[f.key]));
  }

  function orderedSchemaValues(entry, cfg){
    const qId = entry.questionnaireNum;
    const prefix = cfg.fieldPrefix(qId);
    const labels = entry.followupLabels || {};
    const rows = [];
    Object.keys(entry.followupData || {}).forEach((key) => {
      if(!key.startsWith(prefix) && cfg.fillMode !== "clal_cq") return;
      if(cfg.fillMode === "clal_cq" && !key.startsWith(prefix)) return;
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

  function applySequentialFill(form, entry, cfg, font){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const rows = orderedSchemaValues(entry, cfg);
    const textFields = sortFieldNames(form.getFields().filter((f) => {
      try { return f.constructor.name === "PDFTextField"; } catch(_e){ return /Text/i.test(String(f?.getName?.() || "")); }
    }).map((f) => f.getName()));
    rows.forEach((row, idx) => {
      const fieldName = textFields[idx];
      if(!fieldName) return;
      const text = row.label ? (row.label + ": " + row.value) : row.value;
      if(helper?.setTextSafe) helper.setTextSafe(form, fieldName, text, font, { visual: false });
    });
    rows.forEach((row) => {
      if(!/^לא|כן$/i.test(row.value) && row.value !== "לא" && row.value !== "כן") return;
      const yes = row.value === "כן";
      form.getFields().forEach((field) => {
        try {
          if(field.constructor.name !== "PDFCheckBox") return;
          const name = field.getName();
          if(!name || name.indexOf("Check") < 0) return;
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
    const prefix = cfg.fieldPrefix(letter);
    const rows = orderedSchemaValues(entry, cfg);
    rows.forEach((row, idx) => {
      const qIdx = idx + 1;
      const candidates = ["CQ" + cq + "Q" + qIdx, "CQ" + cq + "Q" + String(qIdx).padStart(2, "0")];
      const text = row.value;
      candidates.forEach((name) => {
        if(helper?.setTextSafe) helper.setTextSafe(form, name, text, font, { visual: false });
      });
      if(row.value === "כן" || row.value === "לא"){
        candidates.forEach((name) => {
          try {
            const field = form.getField(name);
            if(!field || field.constructor.name !== "PDFCheckBox") return;
            if(row.value === "כן") field.check(); else field.uncheck();
          } catch(_e) {}
        });
      }
    });
    try {
      if(helper?.setTextSafe) helper.setTextSafe(form, "CQ" + cq, entry.insured?.label || "", font, { visual: false });
    } catch(_e) {}
  }

  function applyPhoenixFill(form, entry, cfg, font){
    applySequentialFill(form, entry, cfg, font);
    if(String(entry.questionnaireNum) !== "2") return;
    const helper = global.GI_OFFICIAL_FORM_FILL;
    (cfg.phoenixHeartMap || []).forEach((row) => {
      const val = pickFirstValue(entry.followupData, row.keys.map((k) => "2__" + k).concat(row.keys));
      if(!val) return;
      if(helper?.setTextSafe) helper.setTextSafe(form, row.pdf, val, font, { visual: false });
    });
  }

  function applyInsuredHeader(form, entry, font){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const person = entry.insured?.data || entry.insured || {};
    const fullName = safeTrim(person.fullName) || safeTrim((person.firstName || "") + " " + (person.lastName || "")).trim() || safeTrim(entry.insured?.label);
    const headerFields = ["FullName", "FirstName", "LastName", "PID", "Text1", "Text2"];
    headerFields.forEach((name, idx) => {
      const val = idx === 0 ? fullName : (idx === 3 ? safeTrim(person.idNumber) : (idx <= 2 ? fullName : ""));
      if(val && helper?.setTextSafe) helper.setTextSafe(form, name, val, font, { visual: false });
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
    const srcDoc = await global.PDFLib.PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const pageNum = cfg.pageForQuestionnaire(entry.questionnaireNum);
    const pageIndex = Math.max(0, pageNum - 1);
    const outDoc = await global.PDFLib.PDFDocument.create();
    const [copied] = await outDoc.copyPages(srcDoc, [Math.min(pageIndex, srcDoc.getPageCount() - 1)]);
    outDoc.addPage(copied);
    const form = outDoc.getForm();
    const font = await loadFont(outDoc);
    applyInsuredHeader(form, entry, font);
    if(cfg.fillMode === "clal_cq") applyClalCqFill(form, entry, cfg, font);
    else if(cfg.fillMode === "phoenix") applyPhoenixFill(form, entry, cfg, font);
    else applySequentialFill(form, entry, cfg, font);
    try { form.updateFieldAppearances(font || undefined); } catch(_e) {}
    return outDoc.save();
  }

  function zipEntryPath(entry){
    const cfg = getConfig().COMPANIES?.[entry.companyKey];
    const base = cfg?.fileLabel ? cfg.fileLabel(entry.questionnaireNum) : ("q-" + entry.questionnaireNum);
    const role = roleSuffix(entry.insured);
    return entry.company + "/" + role + "/" + base + ".pdf";
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

  function buildZipFileName(rec, companies){
    const docs = global.CustomerDocuments;
    const insured = docs?.getPrimaryInsuredLabel?.(rec?.payload) || "מבוטח";
    const co = (Array.isArray(companies) && companies.length === 1)
      ? companies[0]
      : ((companies || []).slice(0, 2).join("-") || "שאלוני-המשך");
    const safe = String(insured).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    return "שאלוני-המשך-" + co + "-" + safe + ".zip";
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
    detectTriggeredFollowups,
    fillFollowupPdf,
    buildFollowupZip,
    buildZipFileName,
    blobToDataUrl,
    zipEntryPath,
    resolveForCustomer(rec, meta, insureds){
      const list = detectTriggeredFollowups(
        rec?.payload?.primary?.healthDeclaration
          || rec?.payload?.insureds?.[0]?.data?.healthDeclaration
          || rec?.payload?.operational?.primary?.healthDeclaration
          || { responses: {} },
        meta,
        insureds
      );
      return list;
    },
    hasTriggered(rec, meta, insureds){
      return this.resolveForCustomer(rec, meta, insureds).length > 0;
    }
  };

  global.GiFollowupZip = GiFollowupZip;
})(typeof window !== "undefined" ? window : globalThis);
