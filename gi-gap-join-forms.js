/* GEMEL INVEST — טפסי הצעה שחסרו: מגדל בריאות, מנורה בריאות, איילון חיים,
   איילון מחלות קשות עד 350,000, כלל מחלות קשות וסרטן, הפניקס משכנתא עד/מעל גיל 55.
   ממלא את ה-PDF המקורי מנתוני התיק. עברית לוגית. כן/לא לפי הצהרת הבריאות באשף. */
(function installGapJoinForms(global){
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
  function fmtDateHe(value){
    const s = safeTrim(value);
    if(!s) return "";
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso) return iso[3] + "/" + iso[2] + "/" + iso[1];
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(dmy) return String(dmy[1]).padStart(2, "0") + "/" + String(dmy[2]).padStart(2, "0") + "/" + dmy[3];
    return s;
  }
  function fmtTodayHe(){
    const d = new Date();
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  }
  function fmtMoneyPlain(value){
    const n = Number(String(value == null ? "" : value).replace(/[^\d.]/g, ""));
    if(!Number.isFinite(n) || n <= 0) return "";
    try { return Math.round(n).toLocaleString("he-IL"); } catch(_e){ return String(Math.round(n)); }
  }
  function policyBlob(policy){
    return [policy?.type, policy?.productName, policy?.planName, policy?.label].map(safeTrim).join(" ");
  }
  function mapGenderExport(genderRaw){
    const g = safeTrim(genderRaw).toLowerCase();
    if(g === "male" || g === "זכר" || g === "m") return "True";
    if(g === "female" || g === "נקבה" || g === "f") return "False";
    return "";
  }

  function makeForm(spec){
    const Form = {
      TEMPLATE_BASE: spec.templateBase,
      TEMPLATE_FILE: spec.templateFile,
      VERSION: "20260929-refer-click-v1",
      DOC_ID: spec.docId,
      DOC_TYPE: spec.docType,
      SPEC: spec,

      listPolicies(payload){
        const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
        return list.filter((p) => spec.matchPolicy(p));
      },
      qualifies(payload){
        return this.listPolicies(payload).length > 0;
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
          birthDate: fmtDateHe(d.birthDate),
          gender: safeTrim(d.gender),
          phone: safeTrim(d.phone),
          email: safeTrim(d.email),
          city: safeTrim(d.city),
          street: safeTrim(d.street),
          houseNumber: safeTrim(d.houseNumber),
          apt: safeTrim(d.apartment || d.aptNumber),
          zip: safeTrim(d.zip),
          occupation: safeTrim(d.occupation),
          clinic: safeTrim(d.clinic || d.hmo || d.kupatHolim),
          shaban: safeTrim(d.shaban || d.shabanLevel),
          heightCm: safeTrim(d.heightCm),
          weightKg: safeTrim(d.weightKg)
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
        const limit = Number(spec.childSlots) > 0 ? Number(spec.childSlots) : 0;
        const children = [];
        raw.forEach((person) => {
          if(!person || person === primary || person === spouse) return;
          if(safeTrim(person.type) !== "child") return;
          if(children.length >= limit) return;
          children.push(person);
        });
        raw.forEach((person) => {
          if(!person || person === primary || person === spouse || children.indexOf(person) >= 0) return;
          if(children.length >= limit) return;
          children.push(person);
        });
        return { primary, spouse, children };
      },
      paintFlatRows(pdfDoc, font, draft){
        const rows = spec.flatRows;
        if(!rows || !font || !pdfDoc) return;
        const page = pdfDoc.getPages()[0];
        if(!page) return;
        const helper = global.GI_OFFICIAL_FORM_FILL;
        const rgb = global.PDFLib && global.PDFLib.rgb ? global.PDFLib.rgb(0.05, 0.1, 0.22) : undefined;
        const draw = (x, y, text, visual) => {
          const raw = safeTrim(text);
          if(!raw || x == null || y == null) return;
          const painted = (visual && helper && helper.visualHebrew) ? helper.visualHebrew(raw) : raw;
          try {
            page.drawText(painted, { x: x, y: y, size: 7, font: font, color: rgb });
          } catch(_e) {}
        };
        const people = [draft && draft.primary, draft && draft.spouse].concat((draft && draft.children) || []);
        rows.forEach((row, idx) => {
          const person = people[idx];
          if(!person || !row) return;
          draw(row.lastX, row.y, person.lastName, true);
          draw(row.firstX, row.y, person.firstName, true);
          draw(row.idX, row.y, person.idNumber, false);
          draw(row.birthX, row.y, person.birthDate, false);
        });
      },
      sumOf(policy){
        const helper = global.CustomerDocuments;
        if(helper && typeof helper.phoenixRiskSumNumber === "function") return fmtMoneyPlain(helper.phoenixRiskSumNumber(policy));
        return fmtMoneyPlain(policy?.sumInsured || policy?.compensation || policy?.coverageAmount);
      },
      buildDraft(rec){
        const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
        const policies = this.listPolicies(payload);
        const policy = policies[0] || {};
        const { primary, spouse, children } = this.classifyInsureds(payload);
        const primaryPerson = this.personFromInsured(primary || payload.primary || {}, global.GI_OFFICIAL_FORM_FILL?.fileFallbacks?.(rec, payload));
        const spousePerson = spouse ? this.personFromInsured(spouse) : null;
        const childPeople = children.map((ins) => this.personFromInsured(ins));
        const agentNumbers = payload.companyAgentNumbers || payload.operational?.companyAgentNumbers
          || payload.primary?.operationalAgentNumbers || {};
        const payerSrc = payload.primary || primary?.data || {};
        const pay = global.GI_OFFICIAL_FORM_FILL?.pickPayment?.(payload, payerSrc) || { method: "", bank: {}, cc: {} };
        return {
          today: fmtTodayHe(),
          insuranceBegin: fmtDateHe(policy.startDate || payload.insuranceStartDate),
          payment: pay,
          bank: pay.bank || {},
          agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
          agentNumber: safeTrim(agentNumbers[spec.company]) || safeTrim(policy.agentNumber),
          sumInsured: this.sumOf(policy),
          primary: primaryPerson,
          spouse: spousePerson,
          children: childPeople,
          ...(global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse, children) || {})
        };
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
        push(this.TEMPLATE_BASE + file + q);
        push("./" + folder + file + q);
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
      setText(form, fieldName, value, font){
        const helper = global.GI_OFFICIAL_FORM_FILL;
        if(helper && helper.setTextSafe){
          helper.setTextSafe(form, fieldName, value, font, { visual: false });
        }
      },
      setExport(form, fieldName, value){
        if(!value) return;
        const helper = global.GI_OFFICIAL_FORM_FILL;
        if(helper && helper.setExport) helper.setExport(form, fieldName, value);
      },
      applyPerson(form, person, role, font){
        if(!person) return;
        const isSpouse = role === "spouse";
        const childIdx = String(role || "").indexOf("child") === 0 ? Number(role.slice(5)) : 0;
        const isChild = childIdx > 0;
        const sfx = isSpouse ? "Spouse" : (isChild ? ("Child" + childIdx) : "");
        this.setText(form, "FirstName" + sfx, person.firstName, font);
        this.setText(form, "LastName" + sfx, person.lastName, font);
        this.setText(form, "FullName" + sfx, person.fullName, font);
        this.setText(form, "PID" + sfx, person.idNumber, font);
        this.setText(form, "BirthDate" + sfx, person.birthDate, font);
        this.setText(form, "EmailAddress" + sfx, person.email, font);
        this.setText(form, "CellPhoneNumber" + sfx, person.phone, font);
        this.setText(form, "PhoneNumber" + sfx, person.phone, font);
        this.setText(form, isChild ? ("CityChild" + childIdx) : (isSpouse ? "CitySpouse" : "City"), person.city, font);
        this.setText(form, isChild ? ("CityChild" + childIdx) : (isSpouse ? "CitySpouseCode" : "CityCode"), person.city, font);
        this.setText(form, isSpouse ? "StreetNameSpouse" : (isChild ? ("StreetNameChild" + childIdx) : "StreetName"), person.street, font);
        this.setText(form, isSpouse ? "StreetCodeSpouse" : (isChild ? ("StreetNameChild" + childIdx) : "StreetCode"), person.street, font);
        this.setText(form, "HouseNumber" + sfx, person.houseNumber, font);
        this.setText(form, "AptNumber" + sfx, person.apt, font);
        this.setText(form, "ZipCode" + sfx, person.zip, font);
        this.setText(form, "HMO" + sfx, person.clinic, font);
        this.setText(form, "Shaban" + sfx, person.shaban, font);
        this.setText(form, isSpouse ? "HightSpouse" : (isChild ? ("HightChild" + childIdx) : "Hight"), person.heightCm, font);
        this.setText(form, isSpouse ? "WeightSpouse" : (isChild ? ("WeightChild" + childIdx) : "Weight"), person.weightKg, font);
        this.setText(form, "OccupationCode" + sfx, person.occupation, font);
        this.setText(form, "Profession" + sfx, person.occupation, font);
        this.setExport(form, "Gender" + sfx, mapGenderExport(person.gender));
      },

      async fillOriginalTemplate(draft){
        if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
        const PDFLib = global.PDFLib;
        if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
        const folder = spec.templateBase.replace(/^\.\//, "");
        const templateBytes = await this.fetchFirstOk(
          this.candidateUrls(folder, spec.templateFile),
          "לא נמצא " + spec.title
        );
        const pdfDoc = await PDFLib.PDFDocument.load(templateBytes, { ignoreEncryption: true });
        let font = null;
        try {
          const fontBytes = await this.fetchFirstOk(this.candidateUrls("fonts/", "Heebo-Bold.ttf"), "font");
          if(fontBytes && global.fontkit){
            pdfDoc.registerFontkit(global.fontkit);
            font = await pdfDoc.embedFont(fontBytes);
          }
        } catch(_e) {}
        const form = pdfDoc.getForm();
        this.setText(form, "Date", draft.today, font);
        this.setText(form, "InsuranceBegin", draft.insuranceBegin, font);
        this.setText(form, "AgentName", draft.agentName, font);
        this.setText(form, "AgentNumber", draft.agentNumber, font);
        this.setText(form, "GiluiTotalRisk", draft.sumInsured, font);
        this.setText(form, "AccDeathMainSum", draft.sumInsured, font);
        this.setText(form, "chkDiseaseMainA", draft.sumInsured, font);
        this.applyPerson(form, draft.primary, "primary", font);
        this.applyPerson(form, draft.spouse, "spouse", font);
        (draft.children || []).forEach((child, idx) => this.applyPerson(form, child, "child" + (idx + 1), font));
        const fill = global.GI_OFFICIAL_FORM_FILL;
        if(spec.healthMode){
          fill?.applyNamedHealthYesNo?.(form, {
            mode: spec.healthMode,
            responses: draft.healthResponses,
            primaryId: draft.primaryId || (draft.primary && draft.primary.id) || "",
            spouseId: draft.spouseId || (draft.spouse && draft.spouse.id) || ""
          });
        } else if(spec.healthMap){
          fill?.applyMappedHealthYesNo?.(form, {
            map: spec.healthMap,
            responses: draft.healthResponses,
            primaryId: draft.primaryId || (draft.primary && draft.primary.id) || "",
            spouseId: draft.spouseId || (draft.spouse && draft.spouse.id) || "",
            childIds: draft.childIds || (draft.children || []).map((c) => c && c.id).filter(Boolean),
            font
          });
        }
        fill?.applyStoredPayment?.(form, {
          method: draft.payment?.method || "",
          bank: draft.bank || {},
          cc: draft.payment?.cc || {}
        }, font, { textOpts: { visual: false } });
        if(font && form.updateFieldAppearances){
          try { form.updateFieldAppearances(font); } catch(_e2) {}
        }
        this.paintFlatRows(pdfDoc, font, draft);
        return pdfDoc.save({ updateFieldAppearances: false });
      },

      renderPreviewHtml(draft){
        const name = safeTrim(draft?.primary?.fullName) || "—";
        const idn = safeTrim(draft?.primary?.idNumber) || "—";
        const bd = safeTrim(draft?.primary?.birthDate) || "—";
        return `<div class="gapJoinPreview">
          <div class="gapJoinPreview__row"><span>טופס</span><strong>${escapeHtml(spec.title)}</strong></div>
          <div class="gapJoinPreview__row"><span>מבוטח</span><strong>${escapeHtml(name)}</strong></div>
          <div class="gapJoinPreview__row"><span>תעודת זהות</span><strong>${escapeHtml(idn)}</strong></div>
          <div class="gapJoinPreview__row"><span>תאריך לידה</span><strong>${escapeHtml(bd)}</strong></div>
        </div>`;
      },
      open(){}
    };
    return Form;
  }

  const SPECS = [
    {
      globalName: "MigdalHealthForm",
      docId: "doc_migdal_health_form",
      docType: "migdal_health_form",
      company: "מגדל",
      title: "טופס מקורי — בריאות · מגדל",
      templateBase: "./forms/migdal-health/",
      templateFile: "migdal-health-join.pdf",
      healthMap: "migdal_health",
      childSlots: 4,
      flatRows: [
        { y: 592, lastX: 325, firstX: 250, idX: 410, birthX: 195 },
        { y: 574.5, lastX: 325, firstX: 250, idX: 410, birthX: 195 },
        { y: 559, lastX: 325, firstX: 250, idX: 410, birthX: 195 },
        { y: 542, lastX: 325, firstX: 250, idX: 410, birthX: 195 },
        { y: 525, lastX: 325, firstX: 250, idX: 410, birthX: 195 },
        { y: 508, lastX: 325, firstX: 250, idX: 410, birthX: 195 }
      ],
      matchPolicy(p){
        if(safeTrim(p?.company) !== "מגדל") return false;
        const blob = policyBlob(p);
        if(/משכנתא|ריסק|סרטן|מחלות\s*קשות/.test(blob)) return false;
        return /בריאות/.test(blob);
      }
    },
    {
      globalName: "MenoraHealthForm",
      docId: "doc_menora_health_form",
      docType: "menora_health_form",
      company: "מנורה",
      title: "טופס מקורי — בריאות · מנורה",
      templateBase: "./forms/menora-health/",
      templateFile: "menora-health-join.pdf",
      healthMap: "menora_health",
      childSlots: 4,
      matchPolicy(p){
        if(safeTrim(p?.company) !== "מנורה") return false;
        const blob = policyBlob(p);
        if(/משכנתא|ריסק|סרטן|מחלות\s*קשות/.test(blob)) return false;
        return /בריאות/.test(blob);
      }
    },
    {
      globalName: "AyalonLifeForm",
      docId: "doc_ayalon_life_form",
      docType: "ayalon_life_form",
      company: "איילון",
      title: "טופס מקורי — ריסק חיים · איילון",
      templateBase: "./forms/ayalon-life/",
      templateFile: "ayalon-life-join.pdf",
      healthMap: "ayalon_life",
      matchPolicy(p){
        if(safeTrim(p?.company) !== "איילון") return false;
        const blob = policyBlob(p);
        if(/משכנתא|בריאות|מחלות\s*קשות|סרטן/.test(blob)) return false;
        return /ריסק|ביטוח\s*חיים/.test(blob);
      }
    },
    {
      globalName: "AyalonCiForm",
      docId: "doc_ayalon_ci_form",
      docType: "ayalon_ci_form",
      company: "איילון",
      title: "טופס מקורי — מחלות קשות עד 350,000 · איילון",
      templateBase: "./forms/ayalon-ci/",
      templateFile: "ayalon-ci-join.pdf",
      healthMap: "ayalon_ci",
      childSlots: 4,
      matchPolicy(p){
        if(safeTrim(p?.company) !== "איילון") return false;
        const blob = policyBlob(p);
        if(/משכנתא|ריסק/.test(blob)) return false;
        if(/בריאות/.test(blob) && !/מחלות\s*קשות/.test(blob)) return false;
        return /מחלות\s*קשות/.test(blob);
      }
    },
    {
      globalName: "ClalCiForm",
      docId: "doc_clal_ci_form",
      docType: "clal_ci_form",
      company: "כלל",
      title: "טופס מקורי — מחלות קשות וסרטן · כלל",
      templateBase: "./forms/clal-ci/",
      templateFile: "clal-ci-join.pdf",
      healthMap: "clal_ci",
      childSlots: 4,
      matchPolicy(p){
        if(safeTrim(p?.company) !== "כלל") return false;
        const blob = policyBlob(p);
        if(/משכנתא|ריסק/.test(blob)) return false;
        if(/בריאות/.test(blob) && !/מחלות\s*קשות/.test(blob) && !/סרטן/.test(blob)) return false;
        return /מחלות\s*קשות|סרטן/.test(blob);
      }
    },
    {
      globalName: "PhoenixMortgageU55Form",
      docId: "doc_phoenix_mortgage_u55_form",
      docType: "phoenix_mortgage_u55_form",
      company: "הפניקס",
      title: "טופס מקורי — משכנתא עד גיל 55 · הפניקס",
      templateBase: "./forms/phoenix-mortgage-u55/",
      templateFile: "phoenix-mortgage-u55-join.pdf",
      healthMode: "short",
      matchPolicy(p){
        if(safeTrim(p?.company) !== "הפניקס") return false;
        return /משכנתא/.test(policyBlob(p));
      }
    },
    {
      globalName: "PhoenixMortgageO55Form",
      docId: "doc_phoenix_mortgage_o55_form",
      docType: "phoenix_mortgage_o55_form",
      company: "הפניקס",
      title: "טופס מקורי — משכנתא מעל גיל 55 · הפניקס",
      templateBase: "./forms/phoenix-mortgage-o55/",
      templateFile: "phoenix-mortgage-o55-join.pdf",
      healthMode: "full",
      matchPolicy(p){
        if(safeTrim(p?.company) !== "הפניקס") return false;
        return /משכנתא/.test(policyBlob(p));
      }
    }
  ];

  SPECS.forEach((spec) => {
    global[spec.globalName] = makeForm(spec);
  });
  global.GI_GAP_JOIN_FORMS = SPECS.map((spec) => global[spec.globalName]);
})(typeof window !== "undefined" ? window : globalThis);
