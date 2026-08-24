/* GEMEL INVEST — טופס מקורי בריאות כלל (07.2025, 20-109-01)
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק. */
(function installClalHealthForm(global){
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
  function coverBlob(list){
    return (Array.isArray(list) ? list : []).map(safeTrim).filter(Boolean).join(" ");
  }

  const ClalHealthForm = {
    TEMPLATE_BASE: "./forms/clal-health/",
    TEMPLATE_FILE: "clal-health-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260824-official-pay-role-v1",
    DOC_ID: "doc_clal_health_form",
    DOC_TYPE: "clal_health_form",

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
    isClalHealthPolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "כלל") return false;
      const blob = this.policyBlob(policy);
      if(/משכנתא/.test(blob) || /ריסק/.test(blob)) return false;
      if(/מחלות\s*קשות/.test(blob) && !/בריאות/.test(blob)) return false;
      if(/סרטן/.test(blob) && !/בריאות/.test(blob) && !/מדיכלל/.test(blob)) return false;
      return /בריאות/.test(blob);
    },
    listClalHealthPolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isClalHealthPolicy(p));
    },
    qualifies(payload){
      return this.listClalHealthPolicies(payload).length > 0;
    },
    listPolicyCovers(policy){
      const out = [];
      (Array.isArray(policy?.healthCovers) ? policy.healthCovers : []).forEach((x) => {
        const s = safeTrim(x);
        if(s && out.indexOf(s) < 0) out.push(s);
      });
      const amounts = policy?.healthCoversWithAmounts && typeof policy.healthCoversWithAmounts === "object"
        ? policy.healthCoversWithAmounts : {};
      Object.keys(amounts).forEach((k) => {
        const s = safeTrim(k);
        if(s && out.indexOf(s) < 0) out.push(s);
      });
      return out;
    },
    coverLetters(covers){
      const list = (Array.isArray(covers) ? covers : []).map(safeTrim).filter(Boolean);
      const letters = [];
      const add = (letter, yes) => {
        if(yes && letters.indexOf(letter) < 0) letters.push(letter);
      };
      const has = (re) => list.some((c) => re.test(c));
      add("E", has(/ניתוח.*חו.?ל|מחליפי\s*ניתוח\s*בחו/));
      add("C", has(/השתל/));
      add("D", has(/תרופ/));
      add("A", has(/5000|5,000|5\.000/));
      add("R", has(/משלים\s*שב/) && !has(/5000|5,000|5\.000/));
      add("B", has(/מהשקל/) || list.some((c) => /ניתוחים/.test(c) && /בישראל/.test(c) && !/משלים/.test(c) && !/5000|5,000/.test(c)));
      add("P", has(/חמ.?ל|בר\s*גפן/));
      if(has(/ייעוץ.*אבחון|בדיקות\s*ואבחון/)) add("G", true);
      else {
        add("F", has(/ייעוצים\s*ובדיקות|ייעוץ\s*ובדיקות/));
        add("Q", has(/אבחון/));
      }
      add("L", has(/טכנולוגי/));
      add("I", has(/ליווי\s*אישי/));
      add("M", has(/שירותים\s*לילד/));
      add("J", has(/און[\s\-]*ליין|אונליין/));
      add("K", has(/רפואה\s*משלימה/));
      return letters;
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
        phoneHome: safeTrim(d.phoneHome),
        childrenCount: safeTrim(d.childrenCount),
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
        weightKg: safeTrim(d.weightKg),
        smokingStatus: safeTrim(d.smokingStatus),
        smokingAmount: safeTrim(d.smokingAmount),
        coverLetters: [],
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
    applyPolicyToPerson(person, insured, policy, letters){
      if(!person || !policy || !this.policyCoversPerson(policy, insured)) return;
      const next = Array.isArray(person.coverLetters) ? person.coverLetters.slice() : [];
      letters.forEach((letter) => {
        if(next.indexOf(letter) < 0) next.push(letter);
      });
      person.coverLetters = next;
      if(!person.criticalAmount){
        person.criticalAmount = this.fmtMoneyPlain(policy.mediclalCriticalAmount)
          || this.amountFromMap(policy, ["מדיכלל מחלות קשות 33", "מדיכלל מחלות קשות", "מחלות קשות"]);
      }
      if(!person.cancerAmount){
        person.cancerAmount = this.fmtMoneyPlain(policy.mediclalCancerAmount)
          || this.amountFromMap(policy, ["מדיכלל פיצוי לסרטן", "סרטן"]);
      }
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listClalHealthPolicies(payload);
      const policy = policies[0] || {};
      const { primary, spouse, children } = this.classifyInsureds(payload);
      const primaryPerson = this.personFromInsured(primary || payload.primary || {}, global.GI_OFFICIAL_FORM_FILL?.fileFallbacks?.(rec, payload));
      const spousePerson = spouse ? this.personFromInsured(spouse) : null;
      const childPeople = children.map((ins) => this.personFromInsured(ins));
      policies.forEach((p) => {
        const letters = this.coverLetters(this.listPolicyCovers(p));
        this.applyPolicyToPerson(primaryPerson, primary, p, letters);
        this.applyPolicyToPerson(spousePerson, spouse, p, letters);
        childPeople.forEach((person, idx) => this.applyPolicyToPerson(person, children[idx], p, letters));
      });
      const agentNumbers = payload.companyAgentNumbers || payload.operational?.companyAgentNumbers
        || payload.primary?.operationalAgentNumbers || {};
      const payerSrc = payload.primary || primary?.data || {};
      const external = payerSrc.externalPayer && typeof payerSrc.externalPayer === "object" ? payerSrc.externalPayer : {};
      const useExternal = safeTrim(payerSrc.payerChoice) === "external";
      const pay = global.GI_OFFICIAL_FORM_FILL?.pickPayment?.(payload, payerSrc) || { method: "", isHo: false, bank: { name: "", branch: "", account: "", bankNo: "" } };
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["כלל"]) || safeTrim(policy.agentNumber),
        discountPack: safeTrim(policy.discountPackageNum || policy.packageNum),
        primary: primaryPerson,
        spouse: spousePerson,
        children: childPeople,
        payer: {
          firstName: useExternal ? safeTrim(external.firstName) : "",
          lastName: useExternal ? safeTrim(external.lastName) : "",
          fullName: useExternal ? safeTrim((external.firstName + " " + external.lastName).trim()) : "",
          idNumber: useExternal ? safeTrim(external.idNumber) : "",
          phone: useExternal ? safeTrim(external.phone) : "",
          email: useExternal ? safeTrim(external.email) : "",
          gender: useExternal ? safeTrim(external.gender) : "",
          birthDate: useExternal ? this.fmtDateHe(external.birthDate) : "",
          city: useExternal ? safeTrim(external.city) : "",
          street: useExternal ? safeTrim(external.street) : "",
          houseNumber: useExternal ? safeTrim(external.houseNumber) : "",
          zip: useExternal ? safeTrim(external.zip) : ""
        },
        bank: pay.bank
      };
    },

    mapGenderExport(genderRaw){
      const g = safeTrim(genderRaw).toLowerCase();
      if(g === "male" || g === "זכר" || g === "m") return "True";
      if(g === "female" || g === "נקבה" || g === "f") return "False";
      return "";
    },
    mapSmokingExport(statusRaw){
      const s = safeTrim(statusRaw).toLowerCase();
      if(!s) return "";
      if(/^(yes|1|true|מעשן|כן)/.test(s)) return "True";
      if(/^(no|0|false|לא|לא מעשן)/.test(s)) return "False";
      return "";
    },
    isMobilePhone(phone){
      return /^05\d{8}$/.test(String(phone || "").replace(/\D+/g, ""));
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
      push("/gemel-invest/" + folder + file + q);
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

    setTextSafe(form, fieldName, value, font){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(helper && helper.setTextSafe){
        helper.setTextSafe(form, fieldName, value, font);
        return;
      }
      const text = safeTrim(value);
      if(!text) return;
      try {
        const field = form.getTextField(fieldName);
        field.setText(text);
        if(font && field.updateAppearances) field.updateAppearances(font);
      } catch(_e) {}
    },
    setExport(form, fieldName, exportValue){
      if(!exportValue) return;
      try {
        const field = form.getField(fieldName);
        const PDFLib = global.PDFLib;
        const name = PDFLib?.PDFName?.of ? PDFLib.PDFName.of(String(exportValue)) : null;
        if(!field || !name) return;
        field.acroField.dict.set(PDFLib.PDFName.of("V"), name);
        field.acroField.dict.set(PDFLib.PDFName.of("AS"), name);
      } catch(_e) {}
    },

    applyPerson(form, person, role, font){
      if(!person) return;
      const isSpouse = role === "spouse";
      const childIdx = String(role || "").indexOf("child") === 0 ? Number(role.slice(5)) : 0;
      const isChild = childIdx > 0;
      const nameS = isSpouse ? "Spouse" : (isChild ? ("Child" + childIdx) : "");
      this.setTextSafe(form, "FirstName" + nameS, person.firstName, font);
      this.setTextSafe(form, "LastName" + nameS, person.lastName, font);
      this.setTextSafe(form, isChild || isSpouse ? ("FullName" + nameS) : "FullName", person.fullName, font);
      this.setTextSafe(form, "PID" + nameS, person.idNumber, font);
      this.setTextSafe(form, "BirthDate" + nameS, person.birthDate, font);
      this.setTextSafe(form, "EmailAddress" + nameS, person.email, font);
      if(!nameS){
        this.setTextSafe(form, "City", person.city, font);
        this.setTextSafe(form, "StreetName", person.street, font);
        this.setTextSafe(form, "HouseNumber", person.houseNumber, font);
        this.setTextSafe(form, "ZipCode", person.zip, font);
      }
      this.setTextSafe(form, "OccupationCode" + nameS, person.occupation, font);
      this.setTextSafe(form, "HMO" + nameS, person.clinic, font);
      this.setTextSafe(form, "Shaban" + nameS, person.shaban, font);
      this.setTextSafe(form, "Hight" + nameS, person.heightCm, font);
      this.setTextSafe(form, "Weight" + nameS, person.weightKg, font);
      if(person.smokingAmount){
        this.setTextSafe(form, "ClientSmokeNum" + nameS, person.smokingAmount, font);
      }
      const phone = person.phone;
      if(phone){
        this.setTextSafe(form, "CellPhoneNumber" + nameS, phone, font);
      }
      this.setExport(form, "Gender" + nameS, this.mapGenderExport(person.gender));
      const smokeField = !nameS ? "IsSmoking" : (isSpouse ? "IsSmokingBzug" : "IsSmoking" + nameS);
      this.setExport(form, smokeField, this.mapSmokingExport(person.smokingStatus));
      const prefix = !nameS ? "chkMain" : (isSpouse ? "chkBzug" : ("chkChild" + childIdx));
      (person.coverLetters || []).forEach((letter) => {
        if(letter === "M" && !isChild) return;
        this.setExport(form, prefix + letter, "1");
      });
      const critField = !nameS ? "chkDiseaseMainA" : (isSpouse ? "chkDiseaseBzugA" : ("chkDiseaseChildA" + childIdx));
      const cancerField = !nameS ? "chkDiseaseMainB" : (isSpouse ? "chkDiseaseBzugB" : ("chkDiseaseChildB" + childIdx));
      this.setTextSafe(form, critField, person.criticalAmount, font);
      this.setTextSafe(form, cancerField, person.cancerAmount, font);
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/clal-health/", this.TEMPLATE_FILE),
        "לא נמצא טופס בריאות של כלל"
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
      const form = pdfDoc.getForm();
      this.setTextSafe(form, "Date", draft.today, font);
      this.setTextSafe(form, "InsuranceBegin", draft.insuranceBegin, font);
      this.setTextSafe(form, "AgentName", draft.agentName, font);
      this.setTextSafe(form, "AgentNumber", draft.agentNumber, font);
      this.setTextSafe(form, "BriutDiscountPack", draft.discountPack, font);
      this.applyPerson(form, draft.primary, "primary", font);
      this.applyPerson(form, draft.spouse, "spouse", font);
      (draft.children || []).forEach((child, idx) => {
        this.applyPerson(form, child, "child" + (idx + 1), font);
      });
      if(draft.payer){
        this.setTextSafe(form, "PayName", draft.payer.fullName, font);
        this.setTextSafe(form, "PIDPay", draft.payer.idNumber, font);
        this.setTextSafe(form, "BirthDatePay", draft.payer.birthDate, font);
        this.setExport(form, "PayGender", this.mapGenderExport(draft.payer.gender));
      }
      global.GI_OFFICIAL_FORM_FILL?.applyStoredPayment?.(form, {
        method: draft.payment?.method || "",
        bank: draft.bank || {}
      }, font, {
        hoMarks: [{ field: "BankUse", value: "1" }],
        ccMarks: [{ field: "CreditUse", value: "1" }]
      });
      if(font && form.updateFieldAppearances) form.updateFieldAppearances(font);
      return pdfDoc.save({ updateFieldAppearances: !!font });
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
      return "בריאות_כלל_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    fieldRow(label, name, value, extra){
      return `<label class="clalHealthForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-clalhealth="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="clalHealthForm__block">
        <div class="clalHealthForm__blockTitle">${escapeHtml(title)}</div>
        <div class="clalHealthForm__grid">
          ${this.fieldRow("שם פרטי", prefix + ".firstName", p.firstName)}
          ${this.fieldRow("שם משפחה", prefix + ".lastName", p.lastName)}
          ${this.fieldRow("תעודת זהות", prefix + ".idNumber", p.idNumber, 'dir="ltr"')}
          ${this.fieldRow("תאריך לידה", prefix + ".birthDate", p.birthDate, 'dir="ltr"')}
          ${this.fieldRow("מין", prefix + ".gender", p.gender)}
          ${this.fieldRow("טלפון", prefix + ".phone", p.phone, 'dir="ltr"')}
          ${this.fieldRow("דוא״ל", prefix + ".email", p.email, 'dir="ltr"')}
          ${this.fieldRow("עיר", prefix + ".city", p.city)}
          ${this.fieldRow("רחוב", prefix + ".street", p.street)}
          ${this.fieldRow("מספר בית", prefix + ".houseNumber", p.houseNumber, 'dir="ltr"')}
          ${this.fieldRow("קופת חולים", prefix + ".clinic", p.clinic)}
          ${this.fieldRow("שב״ן", prefix + ".shaban", p.shaban)}
          ${this.fieldRow("סכום מחלות קשות", prefix + ".criticalAmount", p.criticalAmount, 'dir="ltr"')}
          ${this.fieldRow("סכום סרטן", prefix + ".cancerAmount", p.cancerAmount, 'dir="ltr"')}
        </div>
      </section>`;
    },
    collectDraftFromModal(root, draft){
      const next = JSON.parse(JSON.stringify(draft || {}));
      root.querySelectorAll("[data-clalhealth]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-clalhealth"));
        if(!path) return;
        const parts = path.split(".");
        let cur = next;
        for(let i = 0; i < parts.length - 1; i++){
          const key = parts[i];
          if(/^\d+$/.test(key)){
            const idx = Number(key);
            if(!Array.isArray(cur)) return;
            if(!cur[idx] || typeof cur[idx] !== "object") cur[idx] = {};
            cur = cur[idx];
            continue;
          }
          if(!cur[key] || typeof cur[key] !== "object") cur[key] = {};
          cur = cur[key];
        }
        const last = parts[parts.length - 1];
        cur[last] = safeTrim(el.value);
        if(last === "firstName" || last === "lastName"){
          cur.fullName = safeTrim(((cur.firstName || "") + " " + (cur.lastName || "")).trim());
        }
      });
      return next;
    },
    ensureStyles(){
      if(document.getElementById("clalHealthFormStyle")) return;
      const style = document.createElement("style");
      style.id = "clalHealthFormStyle";
      style.textContent = `
        .clalHealthFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .clalHealthForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .clalHealthForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .clalHealthForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .clalHealthForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .clalHealthForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .clalHealthForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .clalHealthFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .clalHealthFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .clalHealthFormPreview__row span{ color:#647287; }
        .clalHealthFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .clalHealthForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },
    renderPreviewHtml(draft){
      const people = [draft.primary, draft.spouse].concat(draft.children || []).filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : (idx === 1 && draft.spouse ? "בן/בת זוג" : "ילד");
        return `<div class="clalHealthFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      return `<div class="clalHealthFormPreview">
        <div class="clalHealthFormPreview__row"><span>חברה / מוצר</span><strong>כלל · בריאות</strong></div>
        <div class="clalHealthFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-clalhealth-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-clalhealth-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-clalhealth-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const draft = this.collectDraftFromModal(modal, this._draft);
            const bytes = await this.fillOriginalTemplate(draft);
            this.downloadBytes(bytes, this.fileName(draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "PDF מקורי של כלל — ממולא מהפרטים שבתיק.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("CLAL_HEALTH_PDF_FAILED", err); } catch(_e) {}
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
      modal.className = "giValModal clalHealthFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-clalhealth-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — בריאות · כלל</div>
              <div class="giValModal__sub">פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-clalhealth-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="clalHealthForm__hint">ממולא אוטומטית רק מה ששמור בתיק, כולל כיסויי הבריאות שנבחרו. הצהרת בריאות, ביטול/החלפת ביטוח, חתימות ומספר כרטיס אשראי לא ממולאים — אותם משלימים בטופס או ב-PDF אחרי ההורדה.</div>
            <section class="clalHealthForm__block">
              <div class="clalHealthForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="clalHealthForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("בן/בת זוג", "spouse", draft.spouse) : ""}
            ${childBlocks}
            <section class="clalHealthForm__block">
              <div class="clalHealthForm__blockTitle">הוראת קבע — רק אם נרשמה בתיק</div>
              <div class="clalHealthForm__grid">
                ${this.fieldRow("בנק", "bank.name", draft.bank.name)}
                ${this.fieldRow("סניף", "bank.branch", draft.bank.branch, 'dir="ltr"')}
                ${this.fieldRow("חשבון", "bank.account", draft.bank.account, 'dir="ltr"')}
              </div>
            </section>
          </div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-clalhealth-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-clalhealth-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.ClalHealthForm = ClalHealthForm;
})(typeof window !== "undefined" ? window : globalThis);
