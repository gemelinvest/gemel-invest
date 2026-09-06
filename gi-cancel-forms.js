/* GEMEL INVEST — טפסי ביטול מקוריים (בריאות / חיים)
   נטען לפי דרישה ממסמכי לקוח. ממלא רק שדות שכבר קיימים בתיק הלקוח. */
(function installGiCancelForms(global){
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
  function visualHebrew(value){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    if(helper && typeof helper.visualHebrew === "function") return helper.visualHebrew(value);
    const s = String(value == null ? "" : value);
    if(!/[\u0590-\u05FF]/.test(s)) return s;
    const parts = s.match(/[\u0590-\u05FF]+|[^\u0590-\u05FF]+/g) || [s];
    return parts.reverse().map((part) => {
      if(/[\u0590-\u05FF]/.test(part)) return part.split("").reverse().join("");
      return part;
    }).join("");
  }
  function formatDateIL(value){
    const s = safeTrim(value);
    if(!s) return "";
    if(/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(s)) return s.replace(/\./g, "/");
    if(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)){
      const p = s.split("/");
      return String(p[0]).padStart(2, "0") + "/" + String(p[1]).padStart(2, "0") + "/" + (p[2].length === 2 ? ("20" + p[2]) : p[2]);
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso) return iso[3] + "/" + iso[2] + "/" + iso[1];
    const d = new Date(s);
    if(!Number.isNaN(d.getTime()) && /\d{4}/.test(s)){
      try {
        return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
      } catch(_e){
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        return dd + "/" + mm + "/" + d.getFullYear();
      }
    }
    return s;
  }
  function todayIL(){
    try {
      return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
    } catch(_e){
      const d = new Date();
      return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
    }
  }
  function layerOf(obj){
    if(!obj || typeof obj !== "object") return {};
    if(obj.data && typeof obj.data === "object") return obj.data;
    return obj;
  }
  function pickFrom(layers, keys){
    const list = Array.isArray(layers) ? layers : [layers];
    const keyList = Array.isArray(keys) ? keys : [keys];
    for(let i = 0; i < list.length; i++){
      const layer = layerOf(list[i]);
      for(let k = 0; k < keyList.length; k++){
        const v = safeTrim(layer?.[keyList[k]]);
        if(v) return v;
      }
    }
    return "";
  }
  function pickPerson(ins, fallbacks){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    if(helper && typeof helper.pickPerson === "function") return helper.pickPerson(ins, fallbacks);
    const layers = [ins].concat(Array.isArray(fallbacks) ? fallbacks : (fallbacks ? [fallbacks] : []));
    const firstName = pickFrom(layers, ["firstName"]);
    const lastName = pickFrom(layers, ["lastName"]);
    let fullName = pickFrom(layers, ["fullName"]);
    if(!firstName && !lastName && fullName){
      const parts = fullName.split(/\s+/).filter(Boolean);
      return {
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" "),
        fullName,
        idNumber: pickFrom(layers, ["idNumber", "id_number"]),
        phone: pickFrom(layers, ["phone", "cellPhone", "mobile"]),
        phoneHome: pickFrom(layers, ["phoneHome", "homePhone"]),
        email: pickFrom(layers, ["email"]),
        city: pickFrom(layers, ["city"]),
        street: pickFrom(layers, ["street"]),
        houseNumber: pickFrom(layers, ["houseNumber"]),
        zip: pickFrom(layers, ["zip", "zipCode"]),
        birthDate: pickFrom(layers, ["birthDate"]),
        gender: pickFrom(layers, ["gender"])
      };
    }
    fullName = String((firstName + " " + lastName).trim() || fullName || ins?.label || "").trim();
    return {
      firstName, lastName, fullName,
      idNumber: pickFrom(layers, ["idNumber", "id_number"]),
      phone: pickFrom(layers, ["phone", "cellPhone", "mobile"]),
      phoneHome: pickFrom(layers, ["phoneHome", "homePhone"]),
      email: pickFrom(layers, ["email"]),
      city: pickFrom(layers, ["city"]),
      street: pickFrom(layers, ["street"]),
      houseNumber: pickFrom(layers, ["houseNumber"]),
      zip: pickFrom(layers, ["zip", "zipCode"]),
      birthDate: pickFrom(layers, ["birthDate"]),
      gender: pickFrom(layers, ["gender"])
    };
  }

  const PAGE_H = 841.89;
  const PAD = 4;

  function C(key, x0, y0, x1, y1, extra){
    return Object.assign({ key, x0, y0, x1, y1 }, extra || {});
  }
  function X(key, x, y, extra){
    return Object.assign({ key, kind: "mark", x0: x, y0: y, x1: x + 10, y1: y + 10, size: 9, align: "ltr" }, extra || {});
  }

  const TEMPLATES = {
    hachshara: {
      id: "hachshara",
      file: "hachshara-cancel.pdf",
      fields: [
        C("idNumber", 454.4, 225.1, 558.1, 243.1),
        C("fullName", 245.9, 225.1, 453.9, 243.1),
        C("phoneHome", 141.6, 225.1, 245.4, 243.1),
        C("phone", 37.4, 225.1, 141.1, 243.1),
        C("city", 454.4, 260.1, 558.1, 278.1),
        C("street", 350.2, 260.1, 453.9, 278.1),
        C("houseNumber", 245.9, 260.1, 349.6, 278.1),
        C("zip", 141.6, 260.1, 245.4, 278.1),
        C("email", 37.4, 278.1, 350.2, 295.1),
        C("policyNumber", 384.9, 379.6, 558.1, 405, { when: "full" }),
        C("today", 37.4, 379.6, 210.7, 405, { when: "full" }),
        C("policyNumber", 384.9, 492.2, 558.1, 518, { when: "partial" }),
        C("partialCovers", 211.1, 492.2, 384.4, 518, { when: "partial", size: 8 }),
        C("today", 37.4, 492.2, 210.7, 518, { when: "partial" }),
        C("fullName", 416.7, 615.7, 531.5, 638),
        C("idNumber", 301.6, 615.7, 416.2, 638),
        C("today", 186.4, 615.7, 301.0, 638)
      ]
    },
    phoenix: {
      id: "phoenix",
      file: "phoenix-cancel.pdf",
      fields: [
        C("idNumber", 467.3, 102, 572.1, 132),
        C("fullName", 241.8, 102, 467.3, 132),
        C("phoneHome", 127.2, 102, 241.8, 132),
        C("phone", 22.2, 102, 127.2, 132),
        C("city", 467.3, 148, 572.1, 168),
        C("street", 361.7, 148, 467.3, 168),
        C("houseNumber", 241.8, 148, 361.7, 168),
        C("zip", 127.2, 148, 241.8, 168),
        C("email", 22.2, 184, 572.1, 204),
        C("policyNumber", 434.6, 283, 572.1, 305, { when: "full" }),
        C("productLabel", 297.1, 283, 434.6, 305, { when: "full" }),
        C("today", 22.2, 283, 159.7, 305, { when: "full" }),
        C("policyNumber", 388.8, 394, 572.1, 416, { when: "partial" }),
        C("partialCovers", 205.5, 394, 388.8, 416, { when: "partial", size: 8 }),
        C("today", 22.2, 394, 205.5, 416, { when: "partial" }),
        C("fullName", 416.2, 557.6, 572.1, 575),
        C("idNumber", 281.0, 557.6, 416.2, 575),
        C("today", 160.8, 557.6, 281.0, 575)
      ]
    },
    phoenix_health: {
      id: "phoenix_health",
      file: "phoenix-health-cancel.pdf",
      fields: [
        X("markPrimary", 556, 147),
        C("idNumber", 362.3, 142.3, 456.0, 159.3),
        C("fullName", 241.1, 142.3, 362.3, 159.3),
        C("today", 168.5, 142.3, 241.1, 159.3, { size: 8 }),
        C("address", 362.3, 259.0, 572.1, 278),
        C("phone", 241.1, 259.0, 362.3, 278),
        C("email", 22.2, 259.0, 241.1, 278, { size: 8 }),
        C("policyNumber", 388.8, 343.9, 572.1, 360.9, { when: "full" }),
        C("productLabel", 205.5, 343.9, 388.8, 360.9, { when: "full" }),
        C("today", 22.2, 343.9, 205.5, 360.9, { when: "full" }),
        C("policyNumber", 388.8, 434.2, 572.1, 451.2, { when: "partial" }),
        C("partialCovers", 205.5, 434.2, 388.8, 451.2, { when: "partial", size: 8 }),
        C("today", 22.2, 434.2, 205.5, 451.2, { when: "partial" })
      ]
    },
    ayalon: {
      id: "ayalon",
      file: "ayalon-cancel.pdf",
      fields: [
        C("idNumber", 450.1, 133.5, 556.5, 161.8),
        C("fullName", 261.7, 133.5, 450.1, 161.8),
        C("phoneHome", 147.8, 133.5, 261.7, 161.8),
        C("phone", 33.2, 133.5, 147.8, 161.8),
        C("city", 450.1, 161.8, 556.5, 190.2),
        C("street", 359.9, 161.8, 450.1, 190.2),
        C("houseNumber", 261.7, 161.8, 359.9, 190.2),
        C("zip", 147.8, 161.8, 261.7, 190.2),
        C("email", 33.2, 190.2, 450.1, 218.5),
        C("policyNumber", 466.0, 337.4, 556.5, 358.1, { when: "full" }),
        C("productLabel", 285.7, 337.4, 466.0, 358.1, { when: "full" }),
        C("today", 33.5, 337.4, 162.7, 358.1, { when: "full" }),
        C("policyNumber", 466.0, 532.7, 556.5, 553.4, { when: "partial" }),
        C("productLabel", 285.7, 532.7, 466.0, 553.4, { when: "partial" }),
        C("partialCovers", 162.7, 532.7, 285.7, 553.4, { when: "partial", size: 8 }),
        C("today", 33.5, 532.7, 162.7, 553.4, { when: "partial" }),
        C("fullName", 376.4, 657.3, 490.7, 685.7),
        C("idNumber", 262.1, 657.3, 376.4, 685.7),
        C("today", 147.8, 657.3, 262.1, 685.7)
      ]
    },
    ayalon_life: {
      id: "ayalon_life",
      file: "ayalon-life-cancel.pdf",
      fields: [
        C("fullName", 332, 338, 538, 352),
        C("idNumber", 42, 338, 215, 352, { align: "ltr" }),
        C("policyNumber", 251, 518, 385, 534, { align: "ltr" }),
        C("productLabel", 117, 518, 225, 534),
        C("today", 426, 538, 515, 552, { align: "ltr" }),
        C("emailLocal", 250, 556, 400, 572, { align: "ltr", size: 8 }),
        C("emailDomain", 62, 556, 230, 572, { align: "ltr", size: 8 }),
        C("today", 430, 640, 538, 665, { align: "ltr" }),
        C("phone", 250, 640, 420, 665, { align: "ltr" })
      ]
    },
    clal: {
      id: "clal",
      file: "clal-cancel.pdf",
      fields: [
        C("idNumber", 428.5, 192.6, 555.7, 212.9),
        C("fullName", 208.8, 192.6, 428.2, 212.9),
        C("phoneHome", 130.9, 192.6, 208.4, 212.9),
        C("phone", 39.7, 192.6, 130.6, 212.9),
        C("city", 428.5, 232.6, 555.7, 253.0),
        C("street", 272.6, 232.6, 428.2, 253.0),
        C("houseNumber", 208.8, 232.6, 272.3, 253.0),
        C("zip", 130.9, 232.6, 208.4, 253.0),
        C("email", 39.7, 253.3, 428.5, 276.4),
        C("policyNumber", 391.7, 361.1, 556.4, 380.3, { when: "full" }),
        C("today", 44.2, 361.1, 228.2, 380.3, { when: "full" }),
        C("policyNumber", 390.1, 487.0, 552.7, 506.3, { when: "partial" }),
        C("partialCovers", 227.0, 487.0, 389.8, 506.3, { when: "partial", size: 8 }),
        C("today", 42.7, 487.0, 226.7, 506.3, { when: "partial" }),
        C("fullName", 396.8, 622.8, 547.0, 644),
        C("idNumber", 280.8, 622.8, 396.5, 644),
        C("today", 164.6, 622.8, 280.3, 644)
      ]
    },
    clal_couple: {
      id: "clal_couple",
      file: "clal-life-couple-cancel.pdf",
      fields: [
        C("idNumber", 404.4, 156.5, 491.7, 176.8),
        C("fullName", 220.0, 156.5, 403.9, 176.8),
        C("phoneHome", 142.0, 156.5, 219.5, 176.8),
        C("phone", 44.3, 156.5, 141.5, 176.8),
        C("city", 404.4, 223.0, 551.2, 243.3),
        C("street", 283.9, 223.0, 403.9, 243.3),
        C("houseNumber", 220.0, 223.0, 283.2, 243.3),
        C("zip", 142.0, 223.0, 219.5, 243.3),
        C("email", 44.3, 243.8, 404.4, 262.5),
        C("policyNumber", 391.8, 332.3, 556.4, 351.4, { when: "full" }),
        C("today", 44.3, 332.3, 228.2, 351.4, { when: "full" }),
        C("policyNumber", 390.2, 462.9, 552.7, 482.1, { when: "partial" }),
        C("partialCovers", 227.1, 462.9, 389.7, 482.1, { when: "partial", size: 8 }),
        C("today", 42.7, 462.9, 226.6, 482.1, { when: "partial" }),
        C("fullName", 396.9, 618.3, 547.0, 640),
        C("idNumber", 280.9, 618.3, 396.4, 640),
        C("today", 164.7, 618.3, 280.2, 640)
      ]
    },
    harel_health: {
      id: "harel_health",
      file: "harel-health-cancel.pdf",
      fields: [
        C("idNumber", 342.2, 129.6, 468.3, 152.3, { size: 8 }),
        C("lastName", 255.9, 129.6, 342.2, 152.3),
        C("firstName", 169.7, 129.6, 255.9, 152.3),
        C("birthDate", 93.2, 129.6, 169.7, 152.3, { size: 8, align: "ltr" }),
        X("genderMale", 62, 136),
        X("genderFemale", 30, 136),
        C("street", 342.2, 272, 485.3, 290),
        C("houseNumber", 299.1, 272, 342.2, 290),
        C("city", 212.8, 272, 299.1, 290),
        C("zip", 93.2, 272, 169.7, 290),
        C("phoneHome", 342.2, 292, 485.3, 314),
        C("phone", 169.7, 292, 342.2, 314),
        C("email", 33, 318, 481, 340, { size: 8 }),
        C("policyNumber", 291.0, 383.3, 553.9, 406.0, { when: "full" }),
        C("today", 28.2, 383.3, 291.0, 406.0, { when: "full" }),
        C("policyNumber", 378.6, 484.4, 553.8, 507.1, { when: "partial" }),
        C("partialCovers", 203.4, 484.4, 378.6, 507.1, { when: "partial", size: 8 }),
        C("today", 28.2, 484.4, 203.4, 507.1, { when: "partial" }),
        C("today", 418.7, 594.4, 495.3, 617.1, { align: "ltr", size: 8 }),
        C("fullName", 281.9, 594.4, 418.7, 617.1),
        C("idNumber", 128.9, 594.4, 281.9, 617.1)
      ]
    },
    harel_life: {
      id: "harel_life",
      file: "harel-life-cancel.pdf",
      fields: [
        C("idNumber", 415.7, 213.7, 554.0, 239.2, { size: 8 }),
        C("lastName", 309.0, 213.7, 378.9, 239.2),
        C("firstName", 203.7, 213.7, 309.0, 239.2),
        C("phoneHome", 116.1, 213.7, 203.7, 239.2, { size: 8 }),
        C("phone", 28.2, 213.7, 116.1, 239.2, { size: 8 }),
        C("street", 415.7, 239.2, 554.0, 264.7),
        C("houseNumber", 309.0, 239.2, 378.9, 264.7),
        C("city", 203.7, 239.2, 309.0, 264.7),
        C("zip", 116.1, 239.2, 203.7, 264.7),
        C("email", 28.2, 266, 415.7, 286, { size: 8 }),
        C("policyNumber", 291.3, 352.8, 554.0, 378.3, { when: "full" }),
        C("today", 28.5, 352.8, 291.3, 378.3, { when: "full" }),
        C("policyNumber", 378.9, 447.6, 554.0, 467.4, { when: "partial" }),
        C("partialCovers", 203.7, 447.6, 378.9, 467.4, { when: "partial", size: 8 }),
        C("today", 28.5, 447.6, 203.7, 467.4, { when: "partial" }),
        C("fullName", 379.1, 599.6, 501.7, 625.1),
        C("idNumber", 238.1, 599.6, 379.1, 625.1),
        C("today", 138.9, 599.6, 238.1, 625.1, { align: "ltr", size: 8 })
      ]
    },
    menora: {
      id: "menora",
      file: "menora-cancel.pdf",
      fields: [
        C("idNumber", 446.8, 211.5, 572.2, 238),
        C("fullName", 298.0, 211.5, 446.4, 238),
        C("phoneHome", 163.3, 211.5, 297.5, 238),
        C("phone", 23.2, 211.5, 162.9, 238),
        C("city", 461.0, 256.6, 572.2, 282),
        C("street", 262.6, 256.6, 460.5, 282),
        C("houseNumber", 184.6, 256.6, 262.0, 282),
        C("zip", 99.5, 256.6, 184.1, 282),
        C("email", 23.2, 285.8, 425.6, 313.8),
        C("policyNumber", 310.2, 396.3, 567.1, 412.4, { when: "full" }),
        C("today", 26.6, 396.3, 299.5, 412.4, { when: "full" }),
        C("policyNumber", 466.2, 561.7, 567.1, 582, { when: "partial" }),
        C("partialCovers", 345.7, 561.7, 455.4, 582, { when: "partial", size: 8 }),
        C("idNumber", 225.2, 561.7, 334.9, 582, { when: "partial" }),
        C("today", 28.3, 561.7, 214.4, 582, { when: "partial" }),
        C("fullName", 425.6, 717.6, 572.2, 740),
        C("idNumber", 276.8, 717.6, 425.1, 740),
        C("today", 160.6, 717.6, 276.3, 740)
      ]
    },
    menora_mortgage: {
      id: "menora_mortgage",
      file: "menora-mortgage-cancel.pdf",
      fields: [
        C("policyNumber", 245, 132, 338, 148, { align: "ltr" }),
        C("today", 48, 132, 160, 148, { align: "ltr" }),
        C("lastName", 428.0, 266, 518.4, 286),
        C("firstName", 389.4, 266, 428.0, 286),
        C("idNumber", 277.9, 266, 389.4, 286),
        C("phone", 186.0, 266, 277.9, 286, { size: 8 }),
        C("email", 28.1, 266, 186.0, 286, { size: 8 }),
        X("markFullPolicy", 534.9, 481.3, { when: "full" }),
        X("markLifeOnly", 534.9, 368.4, { when: "partial" }),
        X("markPrimaryOnly", 518, 378, { when: "partial" }),
        C("today", 428.0, 538, 518.4, 564, { align: "ltr", size: 8 }),
        C("fullName", 297.6, 538, 428.0, 564),
        C("idNumber", 186.0, 538, 297.6, 564)
      ]
    },
    migdal: {
      id: "migdal",
      file: "migdal-cancel.pdf",
      fields: [
        C("idNumber", 472.8, 168.7, 566.4, 182.9, { size: 8 }),
        C("lastName", 387.8, 168.7, 472.8, 182.9),
        C("firstName", 302.8, 168.7, 387.8, 182.9),
        C("phoneHome", 129.2, 168.7, 221.0, 182.9, { size: 8 }),
        C("phone", 28.3, 168.7, 129.2, 182.9, { size: 8 }),
        C("city", 473.3, 194.2, 566.2, 208.3),
        C("street", 354.4, 194.2, 473.3, 208.3),
        C("houseNumber", 311.9, 194.2, 354.4, 208.3),
        C("zip", 255.1, 194.2, 311.9, 208.3),
        C("email", 28.3, 194.2, 198.5, 208.3, { size: 8 }),
        C("policyNumber", 354.4, 263.3, 567.0, 280.8, { when: "full" }),
        C("today", 28.3, 263.3, 141.7, 280.8, { when: "full" }),
        C("policyNumber", 453.6, 467.6, 567.0, 485.3, { when: "partial" }),
        C("partialCovers", 141.7, 467.6, 453.6, 485.3, { when: "partial", size: 8 }),
        C("today", 28.3, 467.6, 141.7, 485.3, { when: "partial" }),
        C("today", 459.0, 565.3, 544.1, 593.6, { align: "ltr", size: 8 }),
        C("fullName", 333.0, 565.3, 422.8, 593.6),
        C("idNumber", 215.6, 565.3, 304.3, 593.6)
      ]
    }
  };

  const GiCancelForms = {
    TEMPLATE_BASE: "./forms/cancel/",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260906-cancel-forms-v2",
    DOC_TYPE: "company_cancel_form",
    TEMPLATES,

    isCancelStatus(status){
      const v = safeTrim(status).toLowerCase().replace(/[\s-]+/g, "_");
      return v === "full" || v === "partial_health" || v === "partial" || v === "partialhealth";
    },
    isPartialStatus(status){
      const v = safeTrim(status).toLowerCase().replace(/[\s-]+/g, "_");
      return v === "partial_health" || v === "partial" || v === "partialhealth";
    },
    cancelStatusLabel(status){
      return this.isPartialStatus(status) ? "ביטול חלקי" : "ביטול מלא";
    },
    canonicalCompany(raw){
      const s = safeTrim(raw);
      if(!s) return "";
      const compact = s.replace(/\s+/g, " ");
      const rules = [
        [/מנורה/, "מנורה"],
        [/מגדל/, "מגדל"],
        [/הראל/, "הראל"],
        [/הפניקס|פניקס/, "הפניקס"],
        [/הכשרה|ההכשרה/, "הכשרה"],
        [/איילון/, "איילון"],
        [/כלל/, "כלל"]
      ];
      for(let i = 0; i < rules.length; i++){
        if(rules[i][0].test(compact)) return rules[i][1];
      }
      return compact;
    },
    policyBlob(policy){
      const extras = [];
      (Array.isArray(policy?.sourceTypes) ? policy.sourceTypes : []).forEach((x) => extras.push(x));
      (Array.isArray(policy?.includedProducts) ? policy.includedProducts : []).forEach((x) => extras.push(x));
      return [policy?.type, policy?.productName, policy?.planName, policy?.label, policy?.cover, policy?.product]
        .concat(extras)
        .map(safeTrim)
        .filter(Boolean)
        .join(" ");
    },
    productFamily(policy){
      const t = safeTrim(policy?.type);
      const blob = this.policyBlob(policy);
      if(t === "ריסק משכנתא" || /משכנתא/.test(blob)) return "mortgage";
      if(t === "מחלות קשות" || t === "סרטן" || /מחלות\s*קשות/.test(blob) || /סרטן/.test(blob) || /מרפא/.test(blob)) return "ci";
      if(t === "בריאות" || (/בריאות/.test(blob) && !/ריסק/.test(blob))) return "health";
      if(t === "ריסק" || /ריסק/.test(blob) || /ביטוח\s*חיים/.test(blob) || /אובדן\s*כושר/.test(blob)) return "life";
      return "other";
    },
    productLabel(policy){
      const t = safeTrim(policy?.type);
      if(t) return t;
      const family = this.productFamily(policy);
      if(family === "mortgage") return "ריסק משכנתא";
      if(family === "ci") return "מחלות קשות";
      if(family === "health") return "בריאות";
      if(family === "life") return "ריסק";
      return "פוליסה";
    },
    isCoupleRiskPolicy(policy){
      if(this.canonicalCompany(policy?.company) !== "כלל") return false;
      if(this.productFamily(policy) !== "life") return false;
      const blob = this.policyBlob(policy);
      return safeTrim(policy?.insuredMode) === "couple" || /זוגי|כפול למשפחה|כלל כפול/.test(blob);
    },
    pickTemplateId(policy){
      const company = this.canonicalCompany(policy?.company);
      const family = this.productFamily(policy);
      if(company === "הראל") return (family === "life" || family === "mortgage") ? "harel_life" : "harel_health";
      if(company === "איילון") return (family === "life" || family === "mortgage") ? "ayalon_life" : "ayalon";
      if(company === "כלל") return this.isCoupleRiskPolicy(policy) ? "clal_couple" : "clal";
      if(company === "הפניקס") return family === "health" ? "phoenix_health" : "phoenix";
      if(company === "הכשרה") return "hachshara";
      if(company === "מגדל") return "migdal";
      if(company === "מנורה") return family === "mortgage" ? "menora_mortgage" : "menora";
      return "";
    },
    hasTemplateForPolicy(policy){
      return !!this.pickTemplateId(policy);
    },
    formatDocName(policy, cancel){
      const company = this.canonicalCompany(policy?.company) || "חברה";
      const product = this.productLabel(policy);
      const kind = this.cancelStatusLabel(cancel?.status);
      const num = safeTrim(policy?.policyNumber);
      return "טופס ביטול מקורי — " + product + " · " + company + " · " + kind + (num ? (" · " + num) : "");
    },
    docIdFor(insuredId, policyId){
      return "doc_cancel_" + safeTrim(insuredId || "ins") + "_" + safeTrim(policyId || "pol");
    },
    listCancelledPolicies(payload){
      const out = [];
      const insureds = Array.isArray(payload?.insureds) ? payload.insureds : [];
      insureds.forEach((ins) => {
        const d = (ins && ins.data && typeof ins.data === "object") ? ins.data : {};
        const policies = Array.isArray(d.existingPolicies) ? d.existingPolicies : [];
        const cancellations = (d.cancellations && typeof d.cancellations === "object") ? d.cancellations : {};
        policies.forEach((policy) => {
          if(!policy || typeof policy !== "object") return;
          const cancel = cancellations[policy.id] || {};
          if(!this.isCancelStatus(cancel.status)) return;
          if(!this.hasTemplateForPolicy(policy)) return;
          out.push({
            insured: ins,
            insuredId: safeTrim(ins?.id),
            policy,
            policyId: safeTrim(policy.id),
            policyNumber: safeTrim(policy.policyNumber),
            cancel,
            status: safeTrim(cancel.status),
            company: this.canonicalCompany(policy.company),
            productFamily: this.productFamily(policy),
            productLabel: this.productLabel(policy),
            templateId: this.pickTemplateId(policy)
          });
        });
      });
      return out;
    },
    createDoc(entry, options){
      const policy = entry?.policy || {};
      const cancel = entry?.cancel || {};
      const uploadedAt = safeTrim(options?.uploadedAt) || nowISO();
      return {
        id: this.docIdFor(entry?.insuredId, entry?.policyId),
        type: this.DOC_TYPE,
        templateId: safeTrim(entry?.templateId) || this.pickTemplateId(policy),
        name: this.formatDocName(policy, cancel),
        company: this.canonicalCompany(policy.company),
        productFamily: this.productFamily(policy),
        productLabel: this.productLabel(policy),
        policyId: safeTrim(entry?.policyId || policy.id),
        insuredId: safeTrim(entry?.insuredId),
        policyNumber: safeTrim(entry?.policyNumber || policy.policyNumber),
        cancelStatus: safeTrim(cancel.status),
        isLegacy: true,
        source: "מערכת",
        uploadedAt,
        uploadedBy: safeTrim(options?.uploadedBy)
      };
    },

    findEntry(rec, doc){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : rec;
      const list = this.listCancelledPolicies(payload);
      const docId = safeTrim(doc?.id);
      const policyId = safeTrim(doc?.policyId);
      const insuredId = safeTrim(doc?.insuredId);
      return list.find((row) => {
        if(docId && this.docIdFor(row.insuredId, row.policyId) === docId) return true;
        return row.policyId === policyId && (!insuredId || row.insuredId === insuredId);
      }) || list[0] || null;
    },
    buildDraft(rec, doc){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const entry = this.findEntry(rec, doc) || {};
      const policy = entry.policy || {};
      const cancel = entry.cancel || {};
      const insured = entry.insured || null;
      const templateId = safeTrim(doc?.templateId) || safeTrim(entry.templateId) || this.pickTemplateId(policy);
      const template = TEMPLATES[templateId] || null;
      const policyNumber = safeTrim(doc?.policyNumber) || safeTrim(entry.policyNumber) || safeTrim(policy.policyNumber);
      const person = pickPerson(insured, [payload.primary, payload, rec]);
      const email = safeTrim(person.email);
      const at = email.indexOf("@");
      const covers = Array.isArray(cancel.partialCovers) ? cancel.partialCovers.map(safeTrim).filter(Boolean) : [];
      const reason = safeTrim(cancel.reason) || safeTrim(cancel.partialDetails) || safeTrim(cancel.partialText) || safeTrim(cancel.annexText);
      const addressParts = [person.street, person.houseNumber, person.city, person.zip].map(safeTrim).filter(Boolean);
      return {
        rec,
        doc,
        payload,
        entry,
        policy,
        cancel,
        person,
        templateId,
        template,
        policyNumber,
        company: this.canonicalCompany(policy.company) || safeTrim(doc?.company),
        productLabel: this.productLabel(policy) || safeTrim(doc?.productLabel),
        status: safeTrim(cancel.status) || safeTrim(doc?.cancelStatus),
        statusLabel: this.cancelStatusLabel(cancel.status || doc?.cancelStatus),
        isPartial: this.isPartialStatus(cancel.status || doc?.cancelStatus),
        today: todayIL(),
        birthDate: formatDateIL(person.birthDate),
        reason,
        partialCovers: covers.join(" · "),
        address: addressParts.join(" "),
        emailLocal: at > 0 ? email.slice(0, at) : "",
        emailDomain: at > 0 ? email.slice(at + 1) : ""
      };
    },
    valueFor(draft, key){
      const p = draft?.person || {};
      const gender = safeTrim(p.gender).toLowerCase();
      const hasPerson = !!(safeTrim(p.fullName) || safeTrim(p.idNumber) || safeTrim(p.firstName));
      const male = gender === "male" || gender === "m" || gender === "זכר" || gender === "man";
      const female = gender === "female" || gender === "f" || gender === "נקבה" || gender === "woman";
      const map = {
        idNumber: p.idNumber,
        fullName: p.fullName,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        phoneHome: p.phoneHome,
        email: p.email,
        city: p.city,
        street: p.street,
        houseNumber: p.houseNumber,
        zip: p.zip,
        birthDate: draft.birthDate,
        today: draft.today,
        policyNumber: draft.policyNumber,
        productLabel: draft.productLabel,
        partialCovers: draft.partialCovers,
        reason: draft.reason,
        address: draft.address,
        emailLocal: draft.emailLocal,
        emailDomain: draft.emailDomain,
        markPrimary: hasPerson ? "X" : "",
        markFullPolicy: "X",
        markLifeOnly: "X",
        markPrimaryOnly: "X",
        genderMale: male ? "X" : "",
        genderFemale: female ? "X" : ""
      };
      return safeTrim(map[key]);
    },
    overlayPlan(draft){
      const template = draft?.template;
      const fields = Array.isArray(template?.fields) ? template.fields : [];
      if(!template || !fields.length) return [];
      const out = [];
      fields.forEach((field) => {
        const when = safeTrim(field.when);
        if(when === "full" && draft.isPartial) return;
        if(when === "partial" && !draft.isPartial) return;
        const text = this.valueFor(draft, field.key);
        if(!text) return;
        const x0 = Number(field.x0);
        const y0 = Number(field.y0);
        const x1 = Number(field.x1);
        const y1 = Number(field.y1);
        const size = Number(field.size) > 0 ? Number(field.size) : (field.kind === "mark" ? 11 : 9);
        const align = field.align === "ltr" ? "ltr" : "rtl";
        const h = Math.max(8, y1 - y0);
        const baselineMupdf = y0 + Math.min(h * 0.72, h - 2.5);
        out.push({
          page: 0,
          key: field.key,
          kind: field.kind || "text",
          x: align === "ltr" ? (x0 + PAD) : (x1 - PAD),
          y: PAGE_H - baselineMupdf - 2,
          text,
          size,
          align,
          maxW: Math.max(8, (x1 - x0) - PAD * 2)
        });
      });
      return out;
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
    drawOp(page, font, rgb, op){
      const raw = safeTrim(op.text);
      if(!raw) return;
      const painted = visualHebrew(raw);
      let size = Number(op.size) > 0 ? Number(op.size) : 9;
      let width = 0;
      try { width = font ? font.widthOfTextAtSize(painted, size) : painted.length * size * 0.5; } catch(_e){ width = painted.length * size * 0.5; }
      const maxW = Number(op.maxW) > 0 ? Number(op.maxW) : 0;
      if(maxW && width > maxW && width > 0){
        size = Math.max(6, size * (maxW / width) * 0.98);
        try { width = font ? font.widthOfTextAtSize(painted, size) : width; } catch(_e2) {}
      }
      let x = Number(op.x) || 0;
      if(op.align !== "ltr") x = x - width;
      try {
        page.drawText(painted, {
          x,
          y: op.y,
          size,
          font: font || undefined,
          color: rgb
        });
      } catch(_e) {}
    },
    async fillOriginalTemplate(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const template = draft?.template;
      if(!template?.file) throw new Error("לא נמצא טופס ביטול לחברה זו");
      const templateBytes = await this.fetchFirstOk(
        this.candidateUrls("forms/cancel/", template.file),
        "לא נמצא טופס הביטול המקורי"
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
      const rgb = PDFLib.rgb ? PDFLib.rgb(0.08, 0.12, 0.22) : undefined;
      const pages = pdfDoc.getPages();
      this.overlayPlan(draft).forEach((op) => {
        const page = pages[op.page];
        if(!page) return;
        this.drawOp(page, font, rgb, op);
      });
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
      const company = safeTrim(draft?.company) || "חברה";
      const product = safeTrim(draft?.productLabel) || "פוליסה";
      const num = safeTrim(draft?.policyNumber) || "ללא-מספר";
      return ("ביטול_" + company + "_" + product + "_" + num)
        .replace(/[\\/:*?"<>|]/g, "_")
        + ".pdf";
    },
    filledSummary(draft){
      const keys = ["fullName", "idNumber", "phone", "email", "address", "policyNumber", "today"];
      const labels = {
        fullName: "שם",
        idNumber: "ת.ז.",
        phone: "טלפון",
        email: "דוא״ל",
        address: "כתובת",
        policyNumber: "פוליסה",
        today: "תאריך"
      };
      return keys.map((key) => {
        const val = this.valueFor(draft, key);
        if(!val) return "";
        return `<div class="giCancelFormPreview__row"><span>${escapeHtml(labels[key])}</span><strong>${escapeHtml(val)}</strong></div>`;
      }).filter(Boolean).join("");
    },
    renderPreviewHtml(draft){
      return `<div class="giCancelFormPreview">
        <div class="giCancelFormPreview__row"><span>חברה / מוצר</span><strong>${escapeHtml((draft.company || "—") + " · " + (draft.productLabel || "—"))}</strong></div>
        <div class="giCancelFormPreview__row"><span>סוג ביטול</span><strong>${escapeHtml(draft.statusLabel || "—")}</strong></div>
        ${this.filledSummary(draft)}
        <button class="btn btn--primary" type="button" data-cancel-form-open="1">פתח טופס ביטול</button>
      </div>`;
    },
    ensureStyles(){
      if(document.getElementById("giCancelFormStyle")) return;
      const style = document.createElement("style");
      style.id = "giCancelFormStyle";
      style.textContent = `
        .giCancelFormModal .giValModal__card{ max-width:min(640px,96vw); width:100%; }
        .giCancelFormPreview{ padding:12px 4px; display:flex; flex-direction:column; gap:10px; }
        .giCancelFormPreview__row{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; }
        .giCancelFormPreview__row span{ color:#647287; }
        .giCancelFormPreview__row strong{ color:#0F172A; font-weight:750; }
        .giCancelForm__hint{ font-size:13px; line-height:1.45; color:#475569; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:10px 12px; }
      `;
      document.head.appendChild(style);
    },
    close(){
      const modal = this._modal;
      this._modal = null;
      this._draft = null;
      if(modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },
    bind(modal){
      modal.querySelectorAll("[data-cancel-form-close]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      const dl = modal.querySelector("[data-cancel-form-download]");
      if(dl){
        dl.addEventListener("click", async () => {
          const original = dl.textContent;
          dl.disabled = true;
          dl.textContent = "מפיק PDF…";
          try {
            const bytes = await this.fillOriginalTemplate(this._draft);
            this.downloadBytes(bytes, this.fileName(this._draft));
            try { global.showToast?.({ title: "הטופס הורד", text: "טופס הביטול המקורי הורד עם הפרטים שמולאו מתיק הלקוח.", variant: "success", durationMs: 5200 }); } catch(_e) {}
          } catch(err){
            try { console.error("CANCEL_FORM_PDF_FAILED", err); } catch(_e) {}
            try { global.showToast?.({ title: "שגיאה בהפקת PDF", text: safeTrim(err?.message) || "לא ניתן למלא את טופס הביטול", variant: "warn", durationMs: 6200 }); } catch(_e2) {}
          } finally {
            dl.disabled = false;
            dl.textContent = original;
          }
        });
      }
    },
    open(rec, doc){
      this.ensureStyles();
      this.close();
      const draft = this.buildDraft(rec, doc);
      this._draft = draft;
      const modal = document.createElement("div");
      modal.className = "giValModal giCancelFormModal is-open giValModal--visible";
      modal.innerHTML = `
        <div class="giValModal__backdrop" data-cancel-form-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">${escapeHtml(draft.doc?.name || "טופס ביטול מקורי")}</div>
              <div class="giValModal__sub">הטופס המקורי של החברה · ממולאים רק פרטים שכבר קיימים בתיק</div>
            </div>
            <button class="btn btn--ghost" type="button" data-cancel-form-close="1">סגור</button>
          </div>
          <div class="giValModal__body">
            <div class="giCancelForm__hint">ממלאים על הטופס המקורי של החברה את השדות שכבר הושלמו בתיק הלקוח. שדות ריקים נשארים ריקים.</div>
            ${this.renderPreviewHtml(draft)}
          </div>
          <div class="giValModal__foot">
            <button class="btn btn--ghost" type="button" data-cancel-form-close="1">סגור</button>
            <button class="btn btn--primary" type="button" data-cancel-form-download="1">הורד PDF</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      this._modal = modal;
      this.bind(modal);
    }
  };

  try { global.GiCancelForms = GiCancelForms; } catch(_e) {}
  try { global.window.GiCancelForms = GiCancelForms; } catch(_e) {}
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
