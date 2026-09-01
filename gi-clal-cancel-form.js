/* GEMEL INVEST — טופס ביטול פוליסה כלל (בקשה לביטול פוליסה)
   נטען לפי דרישה מתיק לקוח · ממלא overlay על PDF סרוק. */
(function installClalCancelForm(global){
  "use strict";

  function safeTrim(v){
    return String(v == null ? "" : v).trim();
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

  function normalizeCancelStatus(value){
    const raw = safeTrim(value).toLowerCase().replace(/[\s_\-]+/g, "");
    if(raw === "partialhealth") return "partial";
    return raw;
  }

  function isClalInsuranceCompany(company){
    return /כלל/.test(safeTrim(company));
  }

  function isPolicyCancelSendEligible(policy){
    const raw = normalizeCancelStatus(policy?.existingStatus || policy?.status || "");
    return raw === "full" || raw === "partial";
  }

  function canSendPolicyCancel(auth){
    try {
      const a = auth || global.Auth;
      return !!(a?.isManager?.() || a?.isOps?.());
    } catch(_e){
      return false;
    }
  }

  function findInsuredForPolicy(rec, policy){
    const insureds = Array.isArray(rec?.payload?.insureds) ? rec.payload.insureds : [];
    const label = safeTrim(policy?.insuredLabel);
    if(label){
      const exact = insureds.find((ins) => safeTrim(ins?.label) === label);
      if(exact) return exact;
      const byName = insureds.find((ins) => {
        const d = ins?.data && typeof ins.data === "object" ? ins.data : {};
        const name = safeTrim(((d.firstName || "") + " " + (d.lastName || "")).trim());
        return name && name === label;
      });
      if(byName) return byName;
    }
    return insureds[0] || null;
  }

  function personFromInsured(ins, fallbacks){
    const picked = global.GI_OFFICIAL_FORM_FILL?.pickPerson?.(ins, fallbacks);
    const d = picked || ((ins && ins.data && typeof ins.data === "object") ? ins.data : (ins || {}));
    const firstName = safeTrim(d.firstName);
    const lastName = safeTrim(d.lastName);
    const fullName = safeTrim(d.fullName) || safeTrim((firstName + " " + lastName).trim()) || safeTrim(ins?.label);
    return {
      firstName,
      lastName,
      fullName,
      idNumber: safeTrim(d.idNumber),
      phone: safeTrim(d.phone),
      phoneHome: safeTrim(d.phoneHome),
      email: safeTrim(d.email),
      city: safeTrim(d.city),
      street: safeTrim(d.street),
      houseNumber: safeTrim(d.houseNumber),
      zip: safeTrim(d.zip),
      poBox: safeTrim(d.poBox)
    };
  }

  function buildPolicyDetailsText(policy){
    const parts = [
      safeTrim(policy?.policyNumber) ? ("מס' " + safeTrim(policy.policyNumber)) : "",
      safeTrim(policy?.type),
      safeTrim(policy?.company)
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function buildAppendixDetailsText(policy){
    const cover = safeTrim(policy?.coverageValue);
    const covers = Array.isArray(policy?.coverItems) ? policy.coverItems.filter(Boolean).join(", ") : "";
    const reason = safeTrim(policy?.cancelReason);
    return [cover || covers, reason].filter(Boolean).join(" · ");
  }

  const ClalCancelForm = {
    TEMPLATE_BASE: "./forms/clal-cancel/",
    TEMPLATE_FILE: "clal-cancel.pdf",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260901-clal-cancel-v1",
    DOC_TYPE: "clal_cancel_form",

    OVERLAYS: [
      { key: "customer.idNumber", x: 455, yTop: 152, size: 10 },
      { key: "customer.fullName", x: 330, yTop: 152, size: 10 },
      { key: "customer.phoneHome", x: 215, yTop: 152, size: 10 },
      { key: "customer.phone", x: 95, yTop: 152, size: 10 },
      { key: "customer.city", x: 455, yTop: 172, size: 10 },
      { key: "customer.street", x: 330, yTop: 172, size: 10 },
      { key: "customer.houseNumber", x: 255, yTop: 172, size: 10 },
      { key: "customer.zip", x: 165, yTop: 172, size: 10 },
      { key: "customer.poBox", x: 75, yTop: 172, size: 10 },
      { key: "customer.email", x: 330, yTop: 192, size: 10 },
      { key: "fullCancel.policyDetails", x: 360, yTop: 288, size: 10, when: "full" },
      { key: "fullCancel.vehicleNumber", x: 215, yTop: 288, size: 10, when: "full" },
      { key: "fullCancel.effectiveDate", x: 95, yTop: 288, size: 10, when: "full" },
      { key: "partialCancel.policyDetails", x: 390, yTop: 398, size: 10, when: "partial" },
      { key: "partialCancel.appendixDetails", x: 235, yTop: 398, size: 10, when: "partial" },
      { key: "partialCancel.effectiveDate", x: 95, yTop: 398, size: 10, when: "partial" },
      { key: "signature.fullName", x: 430, yTop: 548, size: 10 },
      { key: "signature.idNumber", x: 295, yTop: 548, size: 10 },
      { key: "signature.date", x: 165, yTop: 548, size: 10 }
    ],

    fmtDateHe,
    fmtTodayHe,
    normalizeCancelStatus,
    isClalInsuranceCompany,
    isPolicyCancelSendEligible,
    canSendPolicyCancel,
    findInsuredForPolicy,
    personFromInsured,
    buildPolicyDetailsText,
    buildAppendixDetailsText,

    buildFillMeta(rec, policy){
      const insured = this.findInsuredForPolicy(rec, policy);
      const fallbacks = rec?.payload?.primary && typeof rec.payload.primary === "object" ? rec.payload.primary : {};
      const customer = this.personFromInsured(insured, fallbacks);
      const pid = safeTrim(policy?.id);
      const cancelRow = insured?.data?.cancellations?.[pid] && typeof insured.data.cancellations[pid] === "object"
        ? insured.data.cancellations[pid]
        : {};
      const cancelMode = this.normalizeCancelStatus(
        cancelRow.status || policy?.existingStatus || policy?.status || "full"
      );
      const effectiveDate = this.fmtDateHe(cancelRow.effectiveDate || cancelRow.cancelDate) || this.fmtTodayHe();
      const vehicleNumber = safeTrim(policy?.licensePlate || policy?.vehicleNumber || cancelRow.vehicleNumber);
      return {
        cancelMode: cancelMode === "partial" ? "partial" : "full",
        customer,
        fullCancel: {
          policyDetails: this.buildPolicyDetailsText(policy),
          vehicleNumber,
          effectiveDate
        },
        partialCancel: {
          policyDetails: this.buildPolicyDetailsText(policy),
          appendixDetails: this.buildAppendixDetailsText(policy),
          effectiveDate
        },
        signature: {
          fullName: customer.fullName,
          idNumber: customer.idNumber,
          date: this.fmtTodayHe()
        },
        policyId: pid,
        policyNumber: safeTrim(policy?.policyNumber),
        company: safeTrim(policy?.company)
      };
    },

    resolveField(meta, spec){
      const key = safeTrim(spec?.key);
      if(!key) return "";
      const parts = key.split(".");
      let cur = meta;
      for(let i = 0; i < parts.length; i += 1){
        if(!cur || typeof cur !== "object") return "";
        cur = cur[parts[i]];
      }
      return safeTrim(cur);
    },

    buildFileName(meta){
      const name = safeTrim(meta?.customer?.fullName) || "לקוח";
      const stamp = new Date().toISOString().slice(0, 10);
      const pol = safeTrim(meta?.policyNumber) || "פוליסה";
      return "ביטול_כלל_" + name.replace(/[\\/:*?"<>|]/g, "_") + "_" + pol.replace(/[\\/:*?"<>|]/g, "_") + "_" + stamp + ".pdf";
    },

    candidateUrls(folder, file){
      const q = "?v=" + encodeURIComponent(this.VERSION);
      const out = [];
      const push = (url) => { if(url && out.indexOf(url) < 0) out.push(url); };
      push(this.TEMPLATE_BASE + file + q);
      push(folder + file + q);
      push("./forms/forms/" + file + q);
      return out;
    },

    async fetchFirst(urls){
      const list = Array.isArray(urls) ? urls : [];
      let lastErr = null;
      for(let i = 0; i < list.length; i += 1){
        try {
          const res = await fetch(list[i]);
          if(res.ok) return { res, url: list[i] };
          lastErr = new Error("HTTP " + res.status + " " + list[i]);
        } catch(err){
          lastErr = err;
        }
      }
      throw lastErr || new Error("לא נמצא קובץ הטופס");
    },

    async fillPdf(rec, policy){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const meta = this.buildFillMeta(rec, policy);
      const templateUrls = this.candidateUrls("forms/clal-cancel/", this.TEMPLATE_FILE);
      const fontUrls = [this.FONT_URL + "?v=" + encodeURIComponent(this.VERSION)];
      const templateHit = await this.fetchFirst(templateUrls);
      let fontRes = null;
      for(let i = 0; i < fontUrls.length; i += 1){
        try {
          const res = await fetch(fontUrls[i]);
          if(res.ok){ fontRes = res; break; }
        } catch(_e){}
      }
      if(!fontRes || !fontRes.ok) throw new Error("לא נמצא גופן לעברית");
      const templateBytes = await templateHit.res.arrayBuffer();
      const fontBytes = await fontRes.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(templateBytes, { ignoreEncryption: true });
      if(global.fontkit) pdfDoc.registerFontkit(global.fontkit);
      const font = await pdfDoc.embedFont(fontBytes);
      const page = pdfDoc.getPage(0);
      const { height } = page.getSize();
      const mode = meta.cancelMode;
      this.OVERLAYS.forEach((spec) => {
        const when = safeTrim(spec.when);
        if(when && when !== mode) return;
        const text = this.resolveField(meta, spec);
        if(!text) return;
        page.drawText(String(text), {
          x: Number(spec.x) || 100,
          y: height - (Number(spec.yTop) || 200),
          size: Number(spec.size) || 10,
          font,
          color: PDFLib.rgb(0.04, 0.08, 0.28)
        });
      });
      const bytes = await pdfDoc.save();
      return { bytes, meta, fileName: this.buildFileName(meta) };
    }
  };

  global.ClalCancelForm = ClalCancelForm;
})(typeof window !== "undefined" ? window : globalThis);
