/* GEMEL INVEST — טופס מקורי ריסק / חיים מגדל (11.2025, 165/750)
   נטען לפי דרישה ממסמכי לקוח. ממלא רק ערכים שכבר שמורים בתיק. */
(function installMigdalLifeForm(global){
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

  const MigdalLifeForm = {
    TEMPLATE_BASE: "./forms/migdal-life/",
    TEMPLATE_FILE: "migdal-life-join.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260824-health-align-v1",
    DOC_ID: "doc_migdal_life_form",
    DOC_TYPE: "migdal_life_form",

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
    isMigdalLifePolicy(policy){
      if(!policy || typeof policy !== "object") return false;
      if(safeTrim(policy.company) !== "מגדל") return false;
      const blob = this.policyBlob(policy);
      if(/משכנתא/.test(blob)) return false;
      if(/מחלות\s*קשות/.test(blob) || /סרטן/.test(blob)) return false;
      if(/מוות\s*מתאונה/.test(blob) && !/ריסק|חיים|מגדלור|אור\s*1/.test(blob)) return false;
      if(/נכות\s*מתאונה/.test(blob) && !/ריסק|חיים|מגדלור|אור\s*1/.test(blob)) return false;
      return /ריסק/.test(blob) || /ביטוח\s*חיים/.test(blob) || /מגדלור/.test(blob) || /אור\s*1/.test(blob);
    },
    listMigdalLifePolicies(payload){
      const list = Array.isArray(payload?.newPolicies) ? payload.newPolicies : [];
      return list.filter((p) => this.isMigdalLifePolicy(p));
    },
    qualifies(payload){
      return this.listMigdalLifePolicies(payload).length > 0;
    },
    isRiskMax(policy){
      return /max|מקס/.test(this.policyBlob(policy).toLowerCase());
    },
    payWayFor(payload, primaryData){
      const method = safeTrim(primaryData?.paymentMethod || payload?.paymentMethod);
      if(method === "ho") return "3";
      if(method === "cc") return "1";
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
        heightCm: safeTrim(d.heightCm),
        weightKg: safeTrim(d.weightKg),
        smokingStatus: safeTrim(d.smokingStatus),
        smokingAmount: safeTrim(d.smokingAmount),
        clinic: safeTrim(d.clinic || d.hmo || d.kupatHolim),
        sumInsured: ""
      };
    },
    sumInsuredFor(policy, insuredId){
      if(!policy) return "";
      const map = policy.sumInsuredPerInsured && typeof policy.sumInsuredPerInsured === "object"
        ? policy.sumInsuredPerInsured : {};
      const fromMap = safeTrim(map[insuredId]);
      if(fromMap) return this.fmtMoneyPlain(fromMap);
      return this.fmtMoneyPlain(policy.sumInsured || policy.compensation || policy.coverageAmount);
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
      const children = raw.filter((x) => safeTrim(x?.type) === "child");
      return { primary, spouse, children };
    },
    mapHmoExport(clinicRaw){
      const s = safeTrim(clinicRaw).replace(/\s+/g, "");
      if(!s) return "";
      if(/כללית|clalit/i.test(s)) return "1";
      if(/מכבי|maccabi/i.test(s)) return "2";
      if(/מאוחדת|meuhedet/i.test(s)) return "3";
      if(/לאומית|leumit/i.test(s)) return "4";
      return "";
    },
    collectPledgeBanks(policy){
      if(!policy || typeof policy !== "object") return [];
      if(Array.isArray(policy.pledgeBanks) && policy.pledgeBanks.length){
        return policy.pledgeBanks.filter((b) => b && typeof b === "object" && safeTrim(b.bankName || b.name));
      }
      if(policy.pledgeBank && typeof policy.pledgeBank === "object" && safeTrim(policy.pledgeBank.bankName || policy.pledgeBank.name)){
        return [policy.pledgeBank];
      }
      if(safeTrim(policy.pledgeBankName)){
        return [{ bankName: safeTrim(policy.pledgeBankName) }];
      }
      return [];
    },
    policyHasPledge(policy){
      if(!policy) return false;
      if(policy.pledge === true || policy.hasPledge === true) return true;
      return this.collectPledgeBanks(policy).length > 0;
    },
    normalizeBeneficiaries(policy){
      const list = Array.isArray(policy?.beneficiaries) ? policy.beneficiaries : [];
      return list.map((b) => {
        if(!b || typeof b !== "object") return null;
        const firstName = safeTrim(b.firstName);
        const lastName = safeTrim(b.lastName);
        const fullName = safeTrim(b.fullName) || safeTrim((firstName + " " + lastName).trim());
        const idNumber = safeTrim(b.idNumber || b.pid);
        const relation = safeTrim(b.relationship || b.relation);
        const pct = safeTrim(b.sharePct != null ? b.sharePct : (b.percentage != null ? b.percentage : b.pct));
        const birthDate = this.fmtDateHe(b.birthDate);
        if(!fullName && !idNumber) return null;
        return { fullName, idNumber, relation, percentage: pct, birthDate };
      }).filter(Boolean);
    },
    buildBeneficiaryRows(policy){
      const rows = [];
      const pledgeBanks = this.policyHasPledge(policy) ? this.collectPledgeBanks(policy) : [];
      pledgeBanks.forEach((bank) => {
        const name = safeTrim(bank.bankName || bank.name);
        if(!name) return;
        rows.push({
          fullName: name,
          idNumber: "",
          relation: "מוטב בלתי חוזר",
          percentage: safeTrim(bank.amount) ? "" : (pledgeBanks.length === 1 ? "100" : ""),
          birthDate: "",
          irrevocableBank: true
        });
      });
      this.normalizeBeneficiaries(policy).forEach((ben) => {
        if(rows.length >= 4) return;
        rows.push(ben);
      });
      return rows.slice(0, 4);
    },
    collectCancellations(payload, primaryData){
      const src = (primaryData && primaryData.cancellations && typeof primaryData.cancellations === "object")
        ? primaryData.cancellations
        : ((payload?.primary?.cancellations && typeof payload.primary.cancellations === "object")
          ? payload.primary.cancellations : {});
      const existing = Array.isArray(primaryData?.existingPolicies) ? primaryData.existingPolicies
        : (Array.isArray(payload?.primary?.existingPolicies) ? payload.primary.existingPolicies : []);
      const byId = Object.create(null);
      existing.forEach((p) => {
        if(p && p.id) byId[p.id] = p;
      });
      const rows = [];
      Object.keys(src).forEach((polId) => {
        const c = src[polId];
        if(!c || typeof c !== "object") return;
        const status = safeTrim(c.status).toLowerCase();
        if(!status || status === "nochange" || status === "nochange_client" || status === "keep") return;
        const pol = byId[polId] || {};
        rows.push({
          policyId: polId,
          status,
          executionMethod: safeTrim(c.executionMethod).toLowerCase(),
          company: safeTrim(pol.company),
          policyNumber: safeTrim(pol.policyNumber),
          type: safeTrim(pol.type)
        });
      });
      return rows;
    },
    collectHealthDetailLines(responses, insuredIds){
      const lines = [];
      const ids = (insuredIds || []).filter(Boolean);
      const resp = responses && typeof responses === "object" ? responses : {};
      Object.keys(resp).forEach((qKey) => {
        const block = resp[qKey];
        if(!block || typeof block !== "object") return;
        ids.forEach((insId) => {
          const row = block[insId];
          if(!row || String(row.answer || "").toLowerCase() !== "yes") return;
          const fields = row.fields && typeof row.fields === "object" ? row.fields : {};
          const parts = Object.keys(fields).map((k) => safeTrim(fields[k])).filter(Boolean);
          if(!parts.length) return;
          const label = qKey.replace(/^magdal_(full|riskx|risk2m|mort)__/, "");
          lines.push(label + ": " + parts.join(" · "));
        });
      });
      return lines.slice(0, 3);
    },

    parseDmy(value){
      const s = safeTrim(value);
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(iso) return { d: +iso[3], m: +iso[2], y: +iso[1] };
      const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if(dmy) return { d: +dmy[1], m: +dmy[2], y: +dmy[3] };
      return null;
    },
    ageAtDate(birthRaw, endRaw){
      const b = this.parseDmy(birthRaw);
      const e = this.parseDmy(endRaw);
      if(!b || !e) return null;
      let age = e.y - b.y;
      if(e.m < b.m || (e.m === b.m && e.d < b.d)) age -= 1;
      return age;
    },
    endAgeFromPolicy(policy, person){
      if(!policy || typeof policy !== "object") return "";
      const allowed = ["65", "67", "70", "75", "80"];
      const direct = safeTrim(policy.coverEndAge || policy.policyEndAge || policy.endAge);
      if(allowed.indexOf(direct) >= 0) return direct;
      const label = safeTrim(policy.discountOption?.label || policy.discountLabel || policy.discountPackageLabel || "");
      const fromLabel = label.match(/עד\s*גיל\s*(65|67|70|75|80)/);
      if(fromLabel) return fromLabel[1];
      const endDate = safeTrim(policy.endDate);
      if(endDate && person){
        const age = this.ageAtDate(person.birthDate, endDate);
        if(age != null && allowed.indexOf(String(age)) >= 0) return String(age);
      }
      return "";
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const policies = this.listMigdalLifePolicies(payload);
      const policy = policies[0] || {};
      const { primary, spouse, children } = this.classifyInsureds(payload);
      const primaryPerson = this.personFromInsured(primary || payload.primary || {}, global.GI_OFFICIAL_FORM_FILL?.fileFallbacks?.(rec, payload));
      const spousePerson = spouse ? this.personFromInsured(spouse) : null;
      const childPeople = children.map((ch) => this.personFromInsured(ch));
      primaryPerson.sumInsured = this.sumInsuredFor(policy, primary?.id);
      if(spousePerson) spousePerson.sumInsured = this.sumInsuredFor(policy, spouse?.id);
      const agentNumbers = payload.companyAgentNumbers || payload.operational?.companyAgentNumbers
        || payload.primary?.operationalAgentNumbers || {};
      const payerSrc = payload.primary || primary?.data || {};
      const external = payerSrc.externalPayer && typeof payerSrc.externalPayer === "object" ? payerSrc.externalPayer : {};
      const useExternal = safeTrim(payerSrc.payerChoice) === "external";
      const payerIsInsured = safeTrim(payerSrc.payerChoice) === "insured" || !useExternal;
      const pay = global.GI_OFFICIAL_FORM_FILL?.pickPayment?.(payload, payerSrc) || { method: "", isHo: false, bank: { name: "", branch: "", account: "", bankNo: "" } };
      const healthAttached = global.GI_OFFICIAL_FORM_FILL?.attachDraftHealth?.(payload, primary, spouse, children) || {};
      const healthResponses = healthAttached.healthResponses || {};
      const detailIds = [primary?.id, spouse?.id].concat(children.map((c) => c?.id)).filter(Boolean);
      return {
        today: this.fmtTodayHe(),
        insuranceBegin: this.fmtDateHe(policy.startDate || payload.insuranceStartDate),
        riskMax: this.isRiskMax(policy),
        riskDiscountPack: safeTrim(policy.discountPackageNum || policy.discountOption?.packageNum),
        payWay: this.payWayFor(payload, payerSrc),
        payment: pay,
        agentName: safeTrim(global.Auth?.current?.name) || safeTrim(rec?.agentName),
        agentNumber: safeTrim(agentNumbers["מגדל"]) || safeTrim(policy.agentNumber),
        primary: primaryPerson,
        spouse: spousePerson,
        children: childPeople,
        ...healthAttached,
        healthDetailLines: this.collectHealthDetailLines(healthResponses, detailIds),
        policy,
        primaryEndAge: this.endAgeFromPolicy(policy, primaryPerson),
        spouseEndAge: spousePerson ? this.endAgeFromPolicy(policy, spousePerson) : "",
        beneficiaries: this.buildBeneficiaryRows(policy),
        cancellations: this.collectCancellations(payload, payerSrc),
        payer: {
          name: useExternal ? safeTrim((external.firstName + " " + external.lastName).trim()) : "",
          idNumber: useExternal ? safeTrim(external.idNumber) : "",
          isInsured: payerIsInsured && !useExternal,
          relation: useExternal ? safeTrim(external.relation) : ""
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
    mapMaritalExport(statusRaw){
      const s = safeTrim(statusRaw);
      if(!s) return "";
      if(/רווק|רווקה|single/i.test(s)) return "Single";
      if(/נשוי|נשואה|married|ידוע/i.test(s)) return "Married";
      if(/גרוש|גרושה|divorced/i.test(s)) return "Divorced";
      if(/אלמן|אלמנה|widow/i.test(s)) return "Widow";
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

    setTextSafe(form, fieldName, value, font, opts){
      const helper = global.GI_OFFICIAL_FORM_FILL;
      const textOpts = opts || { visual: false };
      if(helper && helper.setTextSafe){
        helper.setTextSafe(form, fieldName, value, font, textOpts);
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
      const helper = global.GI_OFFICIAL_FORM_FILL;
      if(helper && helper.setExport){
        helper.setExport(form, fieldName, exportValue);
        return;
      }
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

    applyPerson(form, person, isSpouse, font){
      if(!person) return;
      const s = isSpouse ? "Spouse" : "";
      this.setTextSafe(form, "FirstName" + s, person.firstName, font);
      this.setTextSafe(form, "LastName" + s, person.lastName, font);
      this.setTextSafe(form, isSpouse ? "FullNameSpouse" : "FullName", person.fullName, font);
      this.setTextSafe(form, "PID" + s, person.idNumber, font);
      this.setTextSafe(form, "BirthDate" + s, person.birthDate, font);
      this.setTextSafe(form, "EmailAddress" + s, person.email, font);
      this.setTextSafe(form, isSpouse ? "CitySpouseCode" : "CityCode", person.city, font);
      this.setTextSafe(form, isSpouse ? "StreetCodeSpouse" : "StreetCode", person.street, font);
      this.setTextSafe(form, "HouseNumber" + s, person.houseNumber, font);
      this.setTextSafe(form, "AptNumber" + s, person.apt, font);
      this.setTextSafe(form, "ZipCode" + s, person.zip, font);
      this.setTextSafe(form, isSpouse ? "OccupationCodeSpouse" : "OccupationCode", person.occupation, font);
      this.setTextSafe(form, isSpouse ? "ProfessionSpouseCode" : "ProfessionCode", person.occupation, font);
      this.setTextSafe(form, "Hight" + s, person.heightCm, font);
      this.setTextSafe(form, "Weight" + s, person.weightKg, font);
      const phone = person.phone;
      if(phone){
        if(this.isMobilePhone(phone)) this.setTextSafe(form, "CellPhoneNumber" + s, phone, font);
        else this.setTextSafe(form, "PhoneNumber" + s, phone, font);
        this.setTextSafe(form, "CellPhoneNumber" + s, phone, font);
      }
      this.setExport(form, "Gender" + s, this.mapGenderExport(person.gender));
      this.setExport(form, "FamilyStatus" + s, this.mapMaritalExport(person.maritalStatus));
      this.setExport(form, isSpouse ? "IsSmokingBzug" : "IsSmoking", this.mapSmokingExport(person.smokingStatus));
      if(person.smokingAmount){
        this.setTextSafe(form, isSpouse ? "ClientSmokeNumSpouse" : "ClientSmokeNum", person.smokingAmount, font);
      }
      this.setExport(form, isSpouse ? "HMORadioSpouse" : "HMORadio", this.mapHmoExport(person.clinic));
    },
    applyOwnerFromPrimary(form, person, font){
      if(!person) return;
      this.setTextSafe(form, "FullNameOwner", person.fullName, font);
      this.setTextSafe(form, "PIDOwner", person.idNumber, font);
      this.setTextSafe(form, "BirthDateOwner", person.birthDate, font);
      this.setTextSafe(form, "EmailAddressOwner", person.email, font);
      this.setTextSafe(form, "CityOwner", person.city, font);
      this.setTextSafe(form, "StreetNameOwner", person.street, font);
      this.setTextSafe(form, "HouseNumberOwner", person.houseNumber, font);
      this.setTextSafe(form, "AptNumberOwner", person.apt, font);
      this.setTextSafe(form, "ZipCodeOwner", person.zip, font);
      this.setExport(form, "GenderOwner", this.mapGenderExport(person.gender));
      const phone = person.phone;
      if(phone){
        this.setTextSafe(form, "CellPhoneNumberOwner", phone, font);
        if(!this.isMobilePhone(phone)) this.setTextSafe(form, "PhoneNumberOwner", phone, font);
      }
    },
    applyChildren(form, children, font){
      (children || []).slice(0, 4).forEach((child, idx) => {
        if(!child) return;
        const n = idx + 1;
        this.setTextSafe(form, "FullNameChild" + n, child.fullName, font);
        this.setExport(form, "IsSmokingChild" + n, this.mapSmokingExport(child.smokingStatus));
      });
    },
    applyBeneficiaries(form, rows, font){
      (rows || []).slice(0, 4).forEach((ben, idx) => {
        if(!ben) return;
        const n = idx + 1;
        this.setTextSafe(form, "BeneficiaryName" + n, ben.fullName, font);
        this.setTextSafe(form, "PIDBeneficiary" + n, ben.idNumber, font);
        this.setTextSafe(form, "BeneficiaryRelation" + n, ben.relation, font);
        this.setTextSafe(form, "Beneficiarypercentage" + n, ben.percentage, font);
        this.setTextSafe(form, "BirthDateBeneficiary" + n, ben.birthDate, font);
      });
    },
    applyCancellations(form, rows, font){
      const list = Array.isArray(rows) ? rows : [];
      if(!list.length) return;
      const hasFull = list.some((r) => r.status === "full" || r.status === "cancel" || r.status === "cancelled");
      const hasReduce = list.some((r) => r.status === "reduce" || r.status === "partial" || r.status === "reduce_only");
      if(hasFull) this.setExport(form, "ExistPCancel", "1");
      if(hasReduce) this.setExport(form, "ExistPReduce", "1");
      if(hasFull || hasReduce){
        this.setExport(form, "CancelCompare", "1");
        const methods = list.map((r) => r.executionMethod).filter(Boolean);
        let cancelBy = "";
        if(methods.some((m) => m === "agent")) cancelBy = "Agent";
        else if(methods.some((m) => m === "client" || m === "customer")) cancelBy = "Client";
        else if(methods.some((m) => m === "company")) cancelBy = "Company";
        if(cancelBy) this.setExport(form, "PolicyCancel", cancelBy);
      }
      list.slice(0, 5).forEach((row, idx) => {
        const field = idx === 0 ? "insCompera" : ("insCompera" + (idx + 1));
        const label = [row.company, row.type, row.policyNumber].filter(Boolean).join(" · ");
        if(label) this.setTextSafe(form, field, label, font);
      });
    },
    applyHealthDetails(form, lines, font){
      const textOpts = { visual: false, align: false };
      (lines || []).slice(0, 3).forEach((line, idx) => {
        this.setTextSafe(form, "DetailLine" + (idx + 1), line, font, textOpts);
      });
    },
    applyHealthSignatureNames(form, draft, font){
      const textOpts = { visual: false, align: false };
      if(draft?.primary?.fullName){
        this.setTextSafe(form, "FullName", draft.primary.fullName, font, textOpts);
      }
      if(draft?.spouse?.fullName){
        this.setTextSafe(form, "FullNameSpouse", draft.spouse.fullName, font, textOpts);
      }
    },
    applyBasicInsurance(form, draft){
      if(draft?.primaryEndAge) this.setExport(form, "MGRiskAge", draft.primaryEndAge);
      if(draft?.spouseEndAge) this.setExport(form, "MGSRiskAge", draft.spouseEndAge);
    },

    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const helper = global.GI_OFFICIAL_FORM_FILL;
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/migdal-life/", this.TEMPLATE_FILE),
        "לא נמצא טופס ריסק חיים של מגדל"
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
      this.setTextSafe(form, "RiskDiscountPack", draft.riskDiscountPack, font);
      this.applyPerson(form, draft.primary, false, font);
      this.applyPerson(form, draft.spouse, true, font);
      this.applyChildren(form, draft.children, font);
      this.applyOwnerFromPrimary(form, draft.primary, font);
      if(draft.primary){
        const sumField = draft.riskMax ? "GiluiTotalRiskMax" : "GiluiTotalRisk";
        this.setTextSafe(form, sumField, draft.primary.sumInsured, font);
      }
      if(draft.spouse){
        const sumField = draft.riskMax ? "RiskMaxBzugSum" : "OrRizikoBzugSum";
        this.setTextSafe(form, sumField, draft.spouse.sumInsured, font);
      }
      if(draft.payer && draft.payer.name){
        this.setTextSafe(form, "FullNamePayer", draft.payer.name, font);
      }
      this.applyBasicInsurance(form, draft);
      this.applyBeneficiaries(form, draft.beneficiaries, font);
      this.applyCancellations(form, draft.cancellations, font);
      this.applyHealthDetails(form, draft.healthDetailLines, font);
      helper?.applyOfficialHealthAndNames?.(form, draft, font, {
        skipHealth: true,
        visual: false
      });
      helper?.applyMappedHealthYesNo?.(form, {
        map: "migdal_life",
        responses: draft.healthResponses,
        primaryId: draft.primaryId,
        spouseId: draft.spouseId,
        childIds: draft.childIds
      });
      this.applyHealthSignatureNames(form, draft, font);
      if(draft.payer && draft.payer.isInsured && draft.primary){
        helper?.applyInsuredPayerOwner?.(form, draft.primary, font, { relation: "המבוטח" });
        this.setExport(form, "PayerRelationOwner", "1");
      }
      helper?.applyStoredPayment?.(form, {
        method: draft.payment?.method || "",
        bank: draft.bank || {},
        cc: draft.payment?.cc || {}
      }, font, {
        textOpts: { visual: false },
        bankBranchCode: "BankBranchCode",
        bankNameCode: "BankNameCode",
        bankStreetName: "BankStreetName",
        bankCity: "BankCity",
        hoMarks: [{ field: "PayWay", value: "3" }],
        ccMarks: [{ field: "PayWay", value: "1" }]
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
      return "ריסק_חיים_מגדל_" + name.replace(/[\\/:*?\"<>|]/g, "_") + "_" + nowISO().slice(0, 10) + ".pdf";
    },

    fieldRow(label, name, value, extra){
      return `<label class="migLifeForm__field">
        <span>${escapeHtml(label)}</span>
        <input class="input" type="text" data-miglife="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${extra || ""} />
      </label>`;
    },
    personBlock(title, prefix, person){
      const p = person || {};
      return `<section class="migLifeForm__block">
        <div class="migLifeForm__blockTitle">${escapeHtml(title)}</div>
        <div class="migLifeForm__grid">
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
          ${this.fieldRow("מיקוד", prefix + ".zip", p.zip, 'dir="ltr"')}
          ${this.fieldRow("עיסוק", prefix + ".occupation", p.occupation)}
          ${this.fieldRow("גובה", prefix + ".heightCm", p.heightCm, 'dir="ltr"')}
          ${this.fieldRow("משקל", prefix + ".weightKg", p.weightKg, 'dir="ltr"')}
          ${this.fieldRow("עישון", prefix + ".smokingStatus", p.smokingStatus)}
          ${this.fieldRow("סכום ביטוח", prefix + ".sumInsured", p.sumInsured, 'dir="ltr"')}
        </div>
      </section>`;
    },
    collectDraftFromModal(root, draft){
      const next = JSON.parse(JSON.stringify(draft || {}));
      root.querySelectorAll("[data-miglife]").forEach((el) => {
        const path = safeTrim(el.getAttribute("data-miglife"));
        if(!path) return;
        const parts = path.split(".");
        let cur = next;
        for(let i = 0; i < parts.length - 1; i++){
          const key = parts[i];
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
      if(document.getElementById("migLifeFormStyle")) return;
      const style = document.createElement("style");
      style.id = "migLifeFormStyle";
      style.textContent = `
        .migLifeFormModal .giValModal__card{ max-width:min(980px,96vw); width:100%; height:min(92vh,920px); max-height:min(92vh,920px); }
        .migLifeForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
        .migLifeForm__block{ border:1px solid #E5EAF3; border-radius:14px; padding:12px 14px 14px; background:#fff; }
        .migLifeForm__blockTitle{ font-size:14px; font-weight:800; color:#0B1F4B; margin-bottom:10px; }
        .migLifeForm__grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; }
        .migLifeForm__field{ display:flex; flex-direction:column; gap:4px; min-width:0; }
        .migLifeForm__field span{ font-size:12px; font-weight:700; color:#647287; }
        .migLifeFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .migLifeFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .migLifeFormPreview__row span{ color:#647287; }
        .migLifeFormPreview__row strong{ color:#0F172A; font-weight:750; }
        @media (max-width:720px){ .migLifeForm__grid{ grid-template-columns:1fr; } }
      `;
      document.head.appendChild(style);
    },
    renderPreviewHtml(draft){
      const people = [draft.primary, draft.spouse].filter(Boolean);
      const rows = people.map((p, idx) => {
        const role = idx === 0 ? "מבוטח ראשי" : "מועמד משני";
        return `<div class="migLifeFormPreview__row"><span>${escapeHtml(role)}</span><strong>${escapeHtml(p.fullName || "—")}</strong></div>`;
      }).join("");
      return `<div class="migLifeFormPreview">
        <div class="migLifeFormPreview__row"><span>חברה / מוצר</span><strong>מגדל · ריסק חיים</strong></div>
        <div class="migLifeFormPreview__row"><span>תחילת ביטוח</span><strong>${escapeHtml(draft.insuranceBegin || "—")}</strong></div>
        ${rows}
        ${global.CustomerDocuments?.canDownloadOfficialJoinForm?.() ? `<button class="btn btn--primary" type="button" data-miglife-open="1">פתח טופס דיגיטלי</button>` : ""}
      </div>`;
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-miglife-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-miglife-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const draft = this.collectDraftFromModal(modal, this._draft);
            const bytes = await this.fillOriginalTemplate(draft);
            this.downloadBytes(bytes, this.fileName(draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "PDF מקורי של מגדל — ממולא מהפרטים שבתיק.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("MIGDAL_LIFE_PDF_FAILED", err); } catch(_e) {}
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
      const modal = document.createElement("div");
      modal.className = "giValModal migLifeFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-miglife-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">טופס מקורי — ריסק חיים · מגדל</div>
              <div class="giValModal__sub">פרטים מהתיק כבר ממולאים. השלימו מה שחסר והורידו PDF רשמי.</div>
            </div>
            <button type="button" class="giValModal__closeX" data-miglife-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            <div class="migLifeForm__hint">ממולא אוטומטית רק מה ששמור בתיק: פרטים, תשלום, הצהרת בריאות (כן/לא), מוטבים/שיעבוד בנק, ביטולים וקופ״ח. חתימות נשארות להשלמה ידנית.</div>
            <section class="migLifeForm__block">
              <div class="migLifeForm__blockTitle">פרטי הצעה וסוכן</div>
              <div class="migLifeForm__grid">
                ${this.fieldRow("תחילת ביטוח", "insuranceBegin", draft.insuranceBegin, 'dir="ltr"')}
                ${this.fieldRow("תאריך היום", "today", draft.today, 'dir="ltr"')}
                ${this.fieldRow("שם סוכן", "agentName", draft.agentName)}
                ${this.fieldRow("מספר סוכן", "agentNumber", draft.agentNumber, 'dir="ltr"')}
              </div>
            </section>
            ${this.personBlock("מבוטח ראשי", "primary", draft.primary)}
            ${draft.spouse ? this.personBlock("מועמד משני", "spouse", draft.spouse) : ""}
            <section class="migLifeForm__block">
              <div class="migLifeForm__blockTitle">משלם והוראת קבע — רק אם נרשם בתיק</div>
              <div class="migLifeForm__grid">
                ${this.fieldRow("שם משלם", "payer.name", draft.payer.name)}
                ${this.fieldRow("בנק", "bank.name", draft.bank.name)}
                ${this.fieldRow("סניף", "bank.branch", draft.bank.branch, 'dir="ltr"')}
                ${this.fieldRow("חשבון", "bank.account", draft.bank.account, 'dir="ltr"')}
              </div>
            </section>
          </div>
          <div class="giValModal__foot">
            <button type="button" class="btn" data-miglife-close="1">סגור</button>
            <button type="button" class="btn btn--primary" data-miglife-download="1">הורד PDF רשמי</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  global.MigdalLifeForm = MigdalLifeForm;
})(typeof window !== "undefined" ? window : globalThis);
