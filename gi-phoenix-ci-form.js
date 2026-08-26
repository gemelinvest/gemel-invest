/* GEMEL INVEST — טופס מקורי מחלות קשות / מרפא · הפניקס
   300101240 / קוד מסמך 3148 · הצהרת בריאות מקוצרת 303 (עד גיל 60 ועד 2 מיליון).
   ה-PDF הרשמי שטוח (בלי AcroForm) — ממלאים בשכבת טקסט רק ערכים שכבר שמורים בתיק.
   עברית ויזואלית על הציור. כן/לא לפי הצהרת האשף. */
(function installPhoenixCiForm(global){
  "use strict";

  function safeTrim(v){
    return String(v == null ? "" : v).trim();
  }
  function escapeHtml(v){
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function nowISO(){
    try { return new Date().toISOString(); } catch(_e){ return ""; }
  }

  const HEALTH_STEPS = [
    { key: "ci_smoking", y: 580.1 },
    { key: "ci_tests", y: 524.2 },
    { key: "ci_heart", y: 470.3 },
    { key: "ci_neuro", y: 448.4 },
    { key: "ci_cancer", y: 424.2 },
    { key: "ci_kidney", y: 402.2 },
    { key: "ci_digestive", y: 382.4 },
    { key: "ci_lungs", y: 362.5 },
    { key: "ci_diabetes", y: 342.7 },
    { key: "ci_ortho", y: 320.7 },
    { key: "ci_mental", y: 296.5 },
    { key: "ci_senses", y: 272.4 },
    { key: "ci_family", y: 230.2 }
  ];
  const PERSON_YES_X = [250.2, 210.6, 170.9, 131.2, 89.2, 50.7];
  const PERSON_NO_X = [223.8, 184.1, 144.4, 104.8, 65.1, 26.6];
  const PERSON_HW_X = [250, 210, 170, 131, 89, 50];
  const AMOUNT_X = [371.9, 303.8, 235.7, 167.7, 99.6, 31.5];
  const ROW_Y = [612, 575, 538, 501, 464, 427];

  const PhoenixCiForm = {
    TEMPLATE_BASE: "./forms/phoenix-ci/",
    TEMPLATE_FILE: "phoenix-ci-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260826-phoenix-ci-3148-v1",
    DOC_ID: "doc_phoenix_ci_form",
    DOC_TYPE: "phoenix_ci_form",
    HEALTH_STEPS,
    HEALTH_PREFIXES: ["phoenix_critical_illness", "phoenix_cancer_full"],

    fmtDateHe(value){
      const s = safeTrim(value);
      if(!s) return "";
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(iso) return iso[3] + "/" + iso[2] + "/" + iso[1];
      const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if(dmy) return String(dmy[1]).padStart(2, "0") + "/" + String(dmy[2]).padStart(2, "0") + "/" + dmy[3];
      return s;
    },
    fmtTodayHe(){
      const d = new Date();
      return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
    },
    fmtMoneyPlain(value){
      const n = Number(String(value == null ? "" : value).replace(/[^\d.]/g, ""));
      if(!Number.isFinite(n) || n <= 0) return "";
      try { return Math.round(n).toLocaleString("he-IL"); } catch(_e){ return String(Math.round(n)); }
    },
    policyBlob(policy){
      return [policy?.type, policy?.productName, policy?.planName, policy?.label, policy?.cover, policy?.product]
        .map(safeTrim).join(" ");
    },
    isPhoenixCiPolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "הפניקס") return false;
      const docs = global.CustomerDocuments;
      if(docs && docs.isPhoenixRiskMortgagePolicy && docs.isPhoenixRiskMortgagePolicy(policy)) return false;
      const t = safeTrim(policy.type);
      if(t === "מחלות קשות" || t === "סרטן") return true;
      const blob = this.policyBlob(policy);
      if(/משכנתא/.test(blob) || /ריסק/.test(blob)) return false;
      if(/בריאות/.test(blob) && !/מחלות\s*קשות/.test(blob) && !/מרפא/.test(blob) && !/סרטן/.test(blob)) return false;
      return /מחלות\s*קשות/.test(blob) || /מרפא/.test(blob) || /סרטן/.test(blob);
    },
    listPhoenixCiPolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isPhoenixCiPolicy(p));
    },
    qualifies(payload){
      return this.listPhoenixCiPolicies(payload).length > 0;
    },
    amountFromMap(policy, keys){
      const map = policy?.healthCoversWithAmounts && typeof policy.healthCoversWithAmounts === "object"
        ? policy.healthCoversWithAmounts : {};
      for(let i = 0; i < keys.length; i++){
        const v = this.fmtMoneyPlain(map[keys[i]]);
        if(v) return v;
      }
      return "";
    },
    amountForInsured(policy, insuredId, field, fallbackKeys){
      if(!policy) return "";
      const per = policy[field + "PerInsured"] && typeof policy[field + "PerInsured"] === "object"
        ? policy[field + "PerInsured"] : null;
      if(per && insuredId && this.fmtMoneyPlain(per[insuredId])) return this.fmtMoneyPlain(per[insuredId]);
      const sumMap = policy.sumInsuredPerInsured && typeof policy.sumInsuredPerInsured === "object"
        ? policy.sumInsuredPerInsured : null;
      if(sumMap && insuredId && this.fmtMoneyPlain(sumMap[insuredId])) return this.fmtMoneyPlain(sumMap[insuredId]);
      return this.fmtMoneyPlain(policy[field]) || this.amountFromMap(policy, fallbackKeys || []);
    },

    personFromInsured(ins, fallbacks){
      const picked = global.GI_OFFICIAL_FORM_FILL?.pickPerson?.(ins, fallbacks);
      const d = picked || ((ins && ins.data && typeof ins.data === "object") ? ins.data : (ins || {}));
      const firstName = safeTrim(d.firstName);
      const lastName = safeTrim(d.lastName);
      const fullName = safeTrim(d.fullName) || safeTrim((firstName + " " + lastName).trim()) || safeTrim(ins?.label);
      return {
        id: safeTrim(ins?.id),
        firstName, lastName, fullName,
        idNumber: safeTrim(d.idNumber),
        birthDate: this.fmtDateHe(d.birthDate),
        gender: safeTrim(d.gender),
        maritalStatus: safeTrim(d.maritalStatus || d.familyStatus),
        phone: safeTrim(d.phone),
        email: safeTrim(d.email),
        city: safeTrim(d.city),
        street: safeTrim(d.street),
        houseNumber: safeTrim(d.houseNumber),
        apt: safeTrim(d.apartment || d.aptNumber),
        zip: safeTrim(d.zip),
        occupation: safeTrim(d.occupation),
        clinic: safeTrim(d.clinic || d.hmo || d.kupatHolim),
        heightCm: safeTrim(d.heightCm),
        weightKg: safeTrim(d.weightKg),
        smokingStatus: safeTrim(d.smokingStatus),
        smokingAmount: safeTrim(d.smokingAmount),
        criticalAmount: "",
        cancerAmount: ""
      };
    },
    classifyInsureds(payload){
      const raw = Array.isArray(payload?.insureds) ? payload.insureds.slice() : [];
      if(!raw.length && payload?.primary && typeof payload.primary === "object"){
        raw.push({ type: "primary", label: "מבוטח ראשי", data: payload.primary });
      }
      const primary = raw.find((x) => safeTrim(x?.type) === "primary") || raw[0] || null;
      const spouse = raw.find((x) => {
        const t = safeTrim(x?.type);
        return t === "spouse" || t === "secondary";
      }) || raw.find((x, idx) => {
        if(!x || x === primary) return false;
        const t = safeTrim(x.type);
        return t !== "child" && idx > 0;
      }) || null;
      const children = raw.filter((x) => x && x !== primary && x !== spouse && safeTrim(x.type) === "child").slice(0, 4);
      return { primary, spouse, children };
    },
    policyCoversPerson(policy, insured){
      const ids = Array.isArray(policy?.insuredIds) ? policy.insuredIds.map(safeTrim).filter(Boolean) : [];
      if(!ids.length) return true;
      const id = safeTrim(insured?.id);
      return !id || ids.indexOf(id) >= 0;
    },
    applyPolicyToPerson(person, insured, policy){
      if(!person || !policy || !this.policyCoversPerson(policy, insured)) return;
      const blob = this.policyBlob(policy);
      const isCancer = safeTrim(policy.type) === "סרטן" || (/סרטן/.test(blob) && !/מחלות\s*קשות/.test(blob) && !/מרפא(?!\s*סרטן)/.test(blob));
      if(isCancer){
        if(!person.cancerAmount){
          person.cancerAmount = this.amountForInsured(policy, person.id, "phoenixCancerAmount", ["מדיכלל פיצוי לסרטן", "מרפא סרטן", "סרטן"]);
        }
        return;
      }
      if(!person.criticalAmount){
        person.criticalAmount = this.amountForInsured(policy, person.id, "phoenixCriticalAmount", ["מדיכלל מחלות קשות", "מרפא", "מחלות קשות"]);
      }
      if(!person.cancerAmount){
        person.cancerAmount = this.amountForInsured(policy, person.id, "phoenixCancerAmount", ["מדיכלל פיצוי לסרטן", "מרפא סרטן", "סרטן"]);
      }
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listPhoenixCiPolicies(payload);
      const policy = policies[0] || {};
      const { primary, spouse, children } = this.classifyInsureds(payload);
      const primaryPerson = this.personFromInsured(primary || payload.primary || {}, global.GI_OFFICIAL_FORM_FILL?.fileFallbacks?.(rec, payload));
      const spousePerson = spouse ? this.personFromInsured(spouse) : null;
      const childPeople = children.map((ins) => this.personFromInsured(ins));
      policies.forEach((p) => {
        this.applyPolicyToPerson(primaryPerson, primary, p);
        this.applyPolicyToPerson(spousePerson, spouse, p);
        childPeople.forEach((person, idx) => this.applyPolicyToPerson(person, children[idx], p));
      });
      const agentNumbers = payload.companyAgentNumbers || payload.operational?.companyAgentNumbers
        || payload.primary?.operationalAgentNumbers || {};
      const payerSrc = payload.primary || primary?.data || {};
      const external = payerSrc.externalPayer && typeof payerSrc.externalPayer === "object" ? payerSrc.externalPayer : {};
      const useExternal = safeTrim(payerSrc.payerChoice) === "external";
      const pay = global.GI_OFFICIAL_FORM_FILL?.pickPayment?.(payload, payerSrc) || { method: "", isHo: false, bank: { name: "", branch: "", account: "", bankNo: "" } };
      const payerPerson = useExternal ? {
        firstName: safeTrim(external.firstName),
        lastName: safeTrim(external.lastName),
        fullName: safeTrim((external.firstName + " " + external.lastName).trim()) || safeTrim(external.fullName),
        idNumber: safeTrim(external.idNumber),
        city: safeTrim(external.city),
        street: safeTrim(external.street),
        houseNumber: safeTrim(external.houseNumber),
        zip: safeTrim(external.zip)
      } : primaryPerson;
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["הפניקס"]) || safeTrim(policy.agentNumber),
        primary: primaryPerson,
        spouse: spousePerson,
        children: childPeople,
        payerPerson,
        ...(global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse, children) || {}),
        payer: {
          firstName: useExternal ? safeTrim(external.firstName) : safeTrim(primaryPerson.firstName),
          lastName: useExternal ? safeTrim(external.lastName) : safeTrim(primaryPerson.lastName),
          fullName: useExternal ? safeTrim((external.firstName + " " + external.lastName).trim()) : safeTrim(primaryPerson.fullName),
          idNumber: useExternal ? safeTrim(external.idNumber) : safeTrim(primaryPerson.idNumber),
          relation: useExternal ? safeTrim(external.relation) : ""
        },
        bank: pay.bank
      };
    },

    peopleOf(draft){
      return [draft?.primary, draft?.spouse].concat(Array.isArray(draft?.children) ? draft.children : []).filter(Boolean).slice(0, 6);
    },
    idsOf(draft){
      const ids = [safeTrim(draft?.primaryId || draft?.primary?.id)];
      ids.push(safeTrim(draft?.spouseId || draft?.spouse?.id));
      const childIds = Array.isArray(draft?.childIds) ? draft.childIds : (draft?.children || []).map((c) => c && c.id);
      for(let i = 0; i < 4; i++) ids.push(safeTrim(childIds[i]));
      return ids;
    },
    isMale(genderRaw){
      const g = safeTrim(genderRaw).toLowerCase();
      return g === "male" || g === "זכר" || g === "m";
    },
    isFemale(genderRaw){
      const g = safeTrim(genderRaw).toLowerCase();
      return g === "female" || g === "נקבה" || g === "f";
    },
    maritalMark(statusRaw){
      const s = safeTrim(statusRaw);
      if(/רווק|רווקה|single/i.test(s)) return "r";
      if(/נשוי|נשואה|married|ידוע/i.test(s)) return "n";
      if(/גרוש|גרושה|divorced/i.test(s)) return "g";
      if(/אלמן|אלמנה|widow/i.test(s)) return "a";
      return "";
    },
    healthAnswer(draft, stepKey, insId){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      const responses = draft?.healthResponses && typeof draft.healthResponses === "object" ? draft.healthResponses : {};
      if(!helper || !stepKey) return "";
      for(let i = 0; i < this.HEALTH_PREFIXES.length; i++){
        const qKey = this.HEALTH_PREFIXES[i] + "__" + stepKey;
        let a = helper.healthAnswer(responses, qKey, insId);
        if(!a) a = helper.healthAnswerOrSolo(responses, qKey, insId);
        if(a) return a;
      }
      return "";
    },
    healthField(draft, stepKey, insId, fieldKey){
      const responses = draft?.healthResponses && typeof draft.healthResponses === "object" ? draft.healthResponses : {};
      for(let i = 0; i < this.HEALTH_PREFIXES.length; i++){
        const qKey = this.HEALTH_PREFIXES[i] + "__" + stepKey;
        const row = responses?.[qKey]?.[insId];
        const fields = row && row.fields && typeof row.fields === "object" ? row.fields : {};
        const v = safeTrim(fields[fieldKey]);
        if(v) return v;
      }
      return "";
    },

    overlayPlan(draft){
      const ops = [];
      const add = (page, x, y, text, size) => {
        const t = safeTrim(text);
        if(!t) return;
        ops.push({ page, x, y, text: t, size: size || 8 });
      };
      const mark = (page, x, y) => add(page, x, y, "X", 7);
      const people = this.peopleOf(draft);
      const ids = this.idsOf(draft);

      add(0, 430, 718, draft?.agentName, 8);
      add(0, 330, 718, draft?.agentNumber, 8);
      add(0, 42, 742, draft?.insuranceBegin, 8);

      people.forEach((person, idx) => {
        const y = ROW_Y[idx];
        if(!person || y == null) return;
        add(0, 470, y, person.lastName, 7);
        add(0, 405, y, person.firstName, 7);
        add(0, 348, y, person.clinic, 7);
        add(0, 285, y, person.occupation, 7);
        add(0, 205, y, person.idNumber, 7);
        add(0, 42, y, person.birthDate, 7);
        if(this.isMale(person.gender)) mark(0, 184, y + 4);
        if(this.isFemale(person.gender)) mark(0, 184, y - 8);
        const mar = this.maritalMark(person.maritalStatus);
        if(mar === "r") mark(0, 143, y + 4);
        if(mar === "n") mark(0, 118, y + 4);
        if(mar === "g") mark(0, 143, y - 8);
        if(mar === "a") mark(0, 118, y - 8);
        if(mar === "l" || /ידוע/.test(safeTrim(person.maritalStatus))) mark(0, 93, y - 8);
      });

      const primary = draft?.primary || {};
      add(0, 250, 340, primary.email || primary.phone, 7);
      add(0, 210, 328, primary.street, 7);
      add(0, 155, 328, primary.houseNumber, 7);
      add(0, 90, 328, primary.city, 7);
      if(draft?.spouse){
        add(0, 250, 305, draft.spouse.email || draft.spouse.phone, 7);
      }

      people.forEach((person, idx) => {
        if(!person) return;
        add(2, AMOUNT_X[idx] + 12, 484, person.criticalAmount, 7);
        add(2, AMOUNT_X[idx] + 12, 467, person.cancerAmount, 7);
      });

      people.forEach((person, idx) => {
        if(!person) return;
        add(4, PERSON_HW_X[idx], 639, person.heightCm, 7);
        add(4, PERSON_HW_X[idx], 619, person.weightKg, 7);
      });

      HEALTH_STEPS.forEach((step) => {
        people.forEach((person, idx) => {
          const insId = ids[idx] || person.id;
          let ans = this.healthAnswer(draft, step.key, insId);
          if(step.key === "ci_smoking" && !ans){
            const smoke = safeTrim(person.smokingStatus).toLowerCase();
            if(/^(yes|1|true|מעשן|כן)/.test(smoke) || /past|עבר|עישנתי/.test(smoke)) ans = "yes";
            else if(/^(no|0|false|לא)/.test(smoke)) ans = "no";
          }
          if(ans === "yes") mark(4, PERSON_YES_X[idx], step.y);
          else if(ans === "no") mark(4, PERSON_NO_X[idx], step.y);
        });
      });

      const smokeAmt = this.healthField(draft, "ci_smoking", ids[0], "cigarettes")
        || this.healthField(draft, "ci_smoking", ids[0], "cigarettesPerDay")
        || primary.smokingAmount;
      const quitDate = this.healthField(draft, "ci_smoking", ids[0], "quitDate");
      add(4, 360, 569, smokeAmt, 7);
      add(4, 430, 557, quitDate, 7);

      if(draft?.payment?.method === "cc" && draft.payment.cc){
        const cc = draft.payment.cc;
        add(8, 300, 516, cc.cardNumber, 8);
        add(8, 430, 516, cc.expirationDate || cc.exp, 8);
        add(8, 400, 482, cc.holderName, 8);
        add(8, 250, 482, cc.holderId, 8);
      }
      if(draft?.payment?.method === "ho" && draft.bank){
        add(8, 430, 399, draft.bank.name, 8);
        add(8, 430, 375, draft.bank.branch, 8);
        add(8, 220, 390, draft.bank.account, 8);
        add(8, 150, 390, draft.bank.bankNo, 8);
        add(8, 380, 277, (draft.payerPerson && draft.payerPerson.fullName) || primary.fullName, 8);
        add(8, 220, 287, (draft.payerPerson && draft.payerPerson.idNumber) || primary.idNumber, 8);
      }
      return ops;
    },

    detectDeployBase(){
      try {
        const path = String(global.location?.pathname || "");
        if(path.indexOf("/gemel-invest/") === 0) return "/gemel-invest/";
      } catch(_e) {}
      return "./";
    },
    candidateUrls(folder, file){
      const q = "?v=" + encodeURIComponent(this.VERSION);
      const base = this.detectDeployBase();
      const out = [];
      const push = (href) => {
        try {
          const url = new URL(href, global.location.href).href;
          if(out.indexOf(url) < 0) out.push(url);
        } catch(_e) {}
      };
      push(base + folder + file + q);
      push("./" + folder + file + q);
      push("/gemel-invest/" + folder + file + q);
      return out;
    },
    async fetchFirstOk(urls, label){
      let last = "";
      for(let i = 0; i < urls.length; i++){
        try {
          const res = await fetch(urls[i], { cache: "reload" });
          if(res && res.ok) return await res.arrayBuffer();
          last = String(res?.status || "");
        } catch(err){ last = String(err?.message || err); }
      }
      throw new Error(label + (last ? " (" + last + ")" : ""));
    },

    paintOverlay(pdfDoc, font, draft){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      const rgb = global.PDFLib && global.PDFLib.rgb ? global.PDFLib.rgb(0.08, 0.12, 0.22) : undefined;
      const pages = pdfDoc.getPages();
      this.overlayPlan(draft).forEach((op) => {
        const page = pages[op.page];
        if(!page) return;
        const raw = safeTrim(op.text);
        if(!raw) return;
        const painted = helper && helper.visualHebrew ? helper.visualHebrew(raw) : raw;
        try {
          page.drawText(painted, {
            x: op.x,
            y: op.y,
            size: op.size || 8,
            font,
            color: rgb
          });
        } catch(_e) {}
      });
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/phoenix-ci/", this.TEMPLATE_FILE),
        "לא נמצא טופס מחלות קשות של הפניקס"
      );
      const pdfDoc = await PDFLib.PDFDocument.load(templateBytes, { ignoreEncryption: true });
      let font = null;
      try {
        const fontBytes = await this.fetchFirstOk(
          this.candidateUrls("fonts/", "Heebo-Bold.ttf"),
          "font"
        );
        if(fontBytes){
          if(global.fontkit) pdfDoc.registerFontkit(global.fontkit);
          font = await pdfDoc.embedFont(fontBytes);
        }
      } catch(_e) {}
      const storedPay = {
        method: (draft && draft.payment && draft.payment.method) || "",
        bank: (draft && draft.bank) || {},
        cc: draft.payment?.cc || {}
      };
      void storedPay;
      if(font) this.paintOverlay(pdfDoc, font, draft);
      return pdfDoc.save();
    },

    downloadBytes(bytes, filename){
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    fileName(draft){
      const name = safeTrim(draft?.primary?.fullName) || "לקוח";
      return "מחלות_קשות_הפניקס_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    fieldRow(label, name, value, extra){
      return `<label class="phxCiForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-phxci="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="phxCiForm__block">
        <div class="phxCiForm__blockTitle">${escapeHtml(title)}</div>
        <div class="phxCiForm__grid">
          ${this.fieldRow("שם פרטי", prefix + ".firstName", p.firstName)}
          ${this.fieldRow("שם משפחה", prefix + ".lastName", p.lastName)}
          ${this.fieldRow("תעודת זהות", prefix + ".idNumber", p.idNumber, 'dir="ltr"')}
          ${this.fieldRow("תאריך לידה", prefix + ".birthDate", p.birthDate, 'dir="ltr"')}
          ${this.fieldRow("מין", prefix + ".gender", p.gender)}
          ${this.fieldRow("מצב משפחתי", prefix + ".maritalStatus", p.maritalStatus)}
          ${this.fieldRow("טלפון", prefix + ".phone", p.phone, 'dir="ltr"')}
          ${this.fieldRow("דוא״ל", prefix + ".email", p.email, 'dir="ltr"')}
          ${this.fieldRow("עיר", prefix + ".city", p.city)}
          ${this.fieldRow("רחוב", prefix + ".street", p.street)}
          ${this.fieldRow("מספר בית", prefix + ".houseNumber", p.houseNumber, 'dir="ltr"')}
          ${this.fieldRow("עיסוק", prefix + ".occupation", p.occupation)}
          ${this.fieldRow("קופת חולים", prefix + ".clinic", p.clinic)}
          ${this.fieldRow("גובה", prefix + ".heightCm", p.heightCm, 'dir="ltr"')}
          ${this.fieldRow("משקל", prefix + ".weightKg", p.weightKg, 'dir="ltr"')}
          ${this.fieldRow("סכום מרפא", prefix + ".criticalAmount", p.criticalAmount, 'dir="ltr"')}
          ${this.fieldRow("סכום מרפא סרטן", prefix + ".cancerAmount", p.cancerAmount, 'dir="ltr"')}
        </div>
      </section>`;
    },
    collectDraftFromModal(root, draft){
      const next = JSON.parse(JSON.stringify(draft || {}));
      root.querySelectorAll("[data-phxci]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-phxci"));
        if(!path) return;
        const parts = path.split(".");
        let cur = next;
        for(let i = 0; i < parts.length - 1; i++){
          const key = parts[i];
          const idx = /^\d+$/.test(key) ? Number(key) : key;
          if(cur[idx] == null || typeof cur[idx] !== "object"){
            cur[idx] = /^\d+$/.test(parts[i + 1]) ? [] : {};
          }
          cur = cur[idx];
        }
        const last = parts[parts.length - 1];
        const lastKey = /^\d+$/.test(last) ? Number(last) : last;
        cur[lastKey] = safeTrim(el.value);
        if(last === "firstName" || last === "lastName"){
          cur.fullName = safeTrim(((cur.firstName || "") + " " + (cur.lastName || "")).trim());
        }
      });
      return next;
    },
    ensureStyles(){
      if(document.getElementById("phxCiFormStyle")) return;
      const style = document.createElement("style");
      style.id = "phxCiFormStyle";
      style.textContent = `
        .phxCiFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .phxCiForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .phxCiForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .phxCiForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .phxCiForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .phxCiForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .phxCiForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .phxCiFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .phxCiFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .phxCiFormPreview__row span{ color:#647287; }
        .phxCiFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .phxCiForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },
    renderPreviewHtml(draft){
      const people = this.peopleOf(draft);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : (idx === 1 && draft.spouse ? "מועמד שני" : "ילד");
        return `<div class="phxCiFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      return `<div class="phxCiFormPreview">
        <div class="phxCiFormPreview__row"><span>חברה / מוצר</span><strong>הפניקס · מחלות קשות / מרפא (טופס 300101240 / הצהרה 303)</strong></div>
        <div class="phxCiFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-phxci-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-phxci-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-phxci-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const draft = this.collectDraftFromModal(modal, this._draft);
            const bytes = await this.fillOriginalTemplate(draft);
            this.downloadBytes(bytes, this.fileName(draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "PDF מקורי של הפניקס — ממולא מהפרטים שבתיק.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("PHOENIX_CI_PDF_FAILED", err); } catch(_e) {}
            try { global.showToast?.({ title: "שגיאה בהפקת PDF", text: safeTrim(err?.message) || "לא ניתן למלא את הטופס המקורי", variant: "warn", durationMs: 6200 }); } catch(_e2) {}
          } finally {
            dl.disabled = false;
            dl.textContent = original;
          }
        });
      }
    },
    open(rec){
      if(global.CustomerFileUI?.denyOfficialJoinFormDownload?.()) return;
      this.ensureStyles();
      this.close();
      const draft = this.buildDraft(rec);
      this._draft = draft;
      const childBlocks = (draft.children || []).map((child, idx) => this.personBlock("ילד " + (idx + 1), "children." + idx, child)).join("");
      const modal = document.createElement("div");
      modal.className = "giValModal phxCiFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-phxci-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — מחלות קשות / מרפא · הפניקס</div>
              <div class="giValModal__sub">פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-phxci-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="phxCiForm__hint">ממולא אוטומטית רק מה ששמור בתיק, כולל סכומי מרפא / מרפא סרטן, כן/לא בהצהרת בריאות 303 ואמצעי תשלום. הטופס הרשמי שטוח — הערכים מצוירים עליו. פירוט רפואי נוסף וחתימות לא ממולאים.</div>
            <section class="phxCiForm__block">
              <div class="phxCiForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="phxCiForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("מועמד שני", "spouse", draft.spouse) : ""}
            ${childBlocks}
            <section class="phxCiForm__block">
              <div class="phxCiForm__blockTitle">משלם והוראת קבע — רק אם נרשם בתיק</div>
              <div class="phxCiForm__grid">
                ${this.fieldRow("שם משלם", "payer.fullName", draft.payer.fullName)}
                ${this.fieldRow("ת״ז משלם", "payer.idNumber", draft.payer.idNumber, 'dir="ltr"')}
                ${this.fieldRow("בנק", "bank.name", draft.bank && draft.bank.name)}
                ${this.fieldRow("סניף", "bank.branch", draft.bank && draft.bank.branch, 'dir="ltr"')}
                ${this.fieldRow("חשבון", "bank.account", draft.bank && draft.bank.account, 'dir="ltr"')}
              </div>
            </section>
          </div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-phxci-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-phxci-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.PhoenixCiForm = PhoenixCiForm;
})(typeof window !== "undefined" ? window : globalThis);
