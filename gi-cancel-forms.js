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
  function personFromInsured(ins, fallbacks){
    const bag = pickPerson(ins, fallbacks) || {};
    bag._type = safeTrim(ins && ins.type);
    bag._id = ins && ins.id;
    return bag;
  }
  function personHasIdentity(person){
    const p = person || {};
    return !!(safeTrim(p.fullName) || safeTrim(p.idNumber) || safeTrim(p.firstName) || safeTrim(p.lastName));
  }
  function insuredRoleRank(ins){
    const t = safeTrim(ins && ins.type);
    if(t === "primary") return 0;
    if(t === "spouse" || t === "secondary") return 1;
    if(t === "adult") return 2;
    if(t === "child") return 3;
    return 4;
  }
  function compareInsuredRole(a, b){
    const ra = insuredRoleRank(a);
    const rb = insuredRoleRank(b);
    if(ra !== rb) return ra - rb;
    return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
  }

  const PAGE_H = 841.89;
  const PAD = 4;
  const WHO_FAMILY6 = ["self", "spouse", "child:0", "child:1", "child:2", "child:3"];
  const WHO_TWO = ["self", "second"];
  const WHO_KIDS4 = ["child:0", "child:1", "child:2", "child:3"];

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
        C("policyNumber", 384.9, 379.6, 558.1, 405, { when: "full", rows: 3, rowH: 25 }),
        C("today", 37.4, 379.6, 210.7, 405, { when: "full", rows: 3, rowH: 25 }),
        C("policyNumber", 384.9, 492.2, 558.1, 518, { when: "partial", rows: 3, rowH: 25 }),
        C("partialCovers", 211.1, 492.2, 384.4, 518, { when: "partial", size: 8, rows: 3, rowH: 25 }),
        C("today", 37.4, 492.2, 210.7, 518, { when: "partial", rows: 3, rowH: 25 }),
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
        C("policyNumber", 434.6, 283, 572.1, 305, { when: "full", rows: 3, rowH: 22 }),
        C("productLabel", 297.1, 283, 434.6, 305, { when: "full", rows: 3, rowH: 22 }),
        C("today", 22.2, 283, 159.7, 305, { when: "full", rows: 3, rowH: 22 }),
        C("policyNumber", 388.8, 394, 572.1, 416, { when: "partial", rows: 2, rowH: 22 }),
        C("partialCovers", 205.5, 394, 388.8, 416, { when: "partial", size: 8, rows: 2, rowH: 22 }),
        C("today", 22.2, 394, 205.5, 416, { when: "partial", rows: 2, rowH: 22 }),
        C("fullName", 416.19, 516.0, 572.1, 544.5),
        C("idNumber", 280.98, 516.0, 416.19, 544.5, { size: 8, boxes: 9, align: "ltr", boxXs: [280.98, 296.0, 311.03, 326.05, 341.07, 356.1, 371.12, 386.15, 401.17, 416.19] }),
        C("today", 160.79, 516.0, 280.98, 544.5, { size: 8, boxes: 8, align: "ltr", boxXs: [160.79, 175.81, 190.84, 205.86, 220.89, 235.91, 250.93, 265.96, 280.98] })
      ]
    },
    phoenix_health: {
      id: "phoenix_health",
      file: "phoenix-health-cancel.pdf",
      fields: [
        X("markPrimary", 556, 147, { whoSlots: WHO_FAMILY6, personRowH: 17 }),
        C("idNumber", 362.3, 142.3, 456.0, 159.3, { whoSlots: WHO_FAMILY6, personRowH: 17 }),
        C("fullName", 241.1, 142.3, 362.3, 159.3, { whoSlots: WHO_FAMILY6, personRowH: 17 }),
        C("today", 168.5, 142.3, 241.1, 159.3, { size: 8, whoSlots: WHO_FAMILY6, personRowH: 17 }),
        C("address", 362.3, 259.0, 572.1, 278),
        C("phone", 241.1, 259.0, 362.3, 278),
        C("email", 22.2, 259.0, 241.1, 278, { size: 8 }),
        C("policyNumber", 388.8, 343.9, 572.1, 360.9, { when: "full", rows: 3, rowH: 17 }),
        C("productLabel", 205.5, 343.9, 388.8, 360.9, { when: "full", rows: 3, rowH: 17 }),
        C("today", 22.2, 343.9, 205.5, 360.9, { when: "full", rows: 3, rowH: 17 }),
        C("policyNumber", 388.8, 434.2, 572.1, 451.2, { when: "partial", rows: 3, rowH: 17 }),
        C("partialCovers", 205.5, 434.2, 388.8, 451.2, { when: "partial", size: 8, rows: 3, rowH: 17 }),
        C("today", 22.2, 434.2, 205.5, 451.2, { when: "partial", rows: 3, rowH: 17 })
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
        C("policyNumber", 466.0, 337.4, 556.5, 358.1, { when: "full", rows: 3, rowH: 20.7 }),
        C("productLabel", 285.7, 337.4, 466.0, 358.1, { when: "full", rows: 3, rowH: 20.7 }),
        C("today", 33.5, 337.4, 162.7, 358.1, { when: "full", rows: 3, rowH: 20.7 }),
        C("policyNumber", 466.0, 532.7, 556.5, 553.4, { when: "partial", rows: 3, rowH: 20.7 }),
        C("productLabel", 285.7, 532.7, 466.0, 553.4, { when: "partial", rows: 3, rowH: 20.7 }),
        C("partialCovers", 162.7, 532.7, 285.7, 553.4, { when: "partial", size: 8, rows: 3, rowH: 20.7 }),
        C("today", 33.5, 532.7, 162.7, 553.4, { when: "partial", rows: 3, rowH: 20.7 }),
        C("fullName", 376.4, 657.3, 490.7, 685.7, { whoSlots: WHO_TWO, personRowH: 28.35 }),
        C("idNumber", 262.1, 657.3, 376.4, 685.7, { whoSlots: WHO_TWO, personRowH: 28.35 }),
        C("today", 147.8, 657.3, 262.1, 685.7, { whoSlots: WHO_TWO, personRowH: 28.35 })
      ]
    },
    ayalon_life: {
      id: "ayalon_life",
      file: "ayalon-life-cancel.pdf",
      fields: [
        C("fullName", 332, 338, 538, 352),
        C("idNumber", 42, 338, 215, 352, { align: "ltr" }),
        C("firstName", 372.12, 407.67, 540.05, 430.91, { whoSlots: WHO_KIDS4, personRowH: 23.24 }),
        C("lastName", 204.18, 407.67, 372.12, 430.91, { whoSlots: WHO_KIDS4, personRowH: 23.24 }),
        C("idNumber", 36.0, 407.67, 204.18, 430.91, { align: "ltr", whoSlots: WHO_KIDS4, personRowH: 23.24 }),
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
        C("policyNumber", 391.7, 361.1, 556.4, 380.3, { when: "full", rows: 4, rowH: 19.2 }),
        C("today", 44.2, 361.1, 228.2, 380.3, { when: "full", rows: 4, rowH: 19.2 }),
        C("policyNumber", 390.1, 487.0, 552.7, 506.3, { when: "partial", rows: 3, rowH: 19.3 }),
        C("partialCovers", 227.0, 487.0, 389.8, 506.3, { when: "partial", size: 8, rows: 3, rowH: 19.3 }),
        C("today", 42.7, 487.0, 226.7, 506.3, { when: "partial", rows: 3, rowH: 19.3 }),
        C("fullName", 396.8, 622.8, 547.0, 644),
        C("idNumber", 280.8, 622.8, 396.5, 644),
        C("today", 164.6, 622.8, 280.3, 644)
      ]
    },
    clal_couple: {
      id: "clal_couple",
      file: "clal-life-couple-cancel.pdf",
      fields: [
        C("idNumber", 404.4, 156.5, 491.7, 176.8, { whoSlots: WHO_TWO, personRowH: 20.76 }),
        C("fullName", 220.0, 156.5, 403.9, 176.8, { whoSlots: WHO_TWO, personRowH: 20.76 }),
        C("phoneHome", 142.0, 156.5, 219.5, 176.8, { whoSlots: WHO_TWO, personRowH: 20.76 }),
        C("phone", 44.3, 156.5, 141.5, 176.8, { whoSlots: WHO_TWO, personRowH: 20.76 }),
        C("city", 404.4, 223.0, 551.2, 243.3),
        C("street", 283.9, 223.0, 403.9, 243.3),
        C("houseNumber", 220.0, 223.0, 283.2, 243.3),
        C("zip", 142.0, 223.0, 219.5, 243.3),
        C("email", 44.3, 243.8, 404.4, 262.5),
        C("policyNumber", 391.8, 332.3, 556.4, 351.4, { when: "full", rows: 4, rowH: 19.1 }),
        C("today", 44.3, 332.3, 228.2, 351.4, { when: "full", rows: 4, rowH: 19.1 }),
        C("policyNumber", 390.2, 462.9, 552.7, 482.1, { when: "partial", rows: 3, rowH: 19.2 }),
        C("partialCovers", 227.1, 462.9, 389.7, 482.1, { when: "partial", size: 8, rows: 3, rowH: 19.2 }),
        C("today", 42.7, 462.9, 226.6, 482.1, { when: "partial", rows: 3, rowH: 19.2 }),
        C("fullName", 396.9, 618.3, 547.0, 640),
        C("idNumber", 280.9, 618.3, 396.4, 640),
        C("today", 164.7, 618.3, 280.2, 640)
      ]
    },
    harel_health: {
      id: "harel_health",
      file: "harel-health-cancel.pdf",
      fields: [
        C("idNumber", 342.19, 129.6, 485.29, 152.3, { size: 9, boxes: 9, align: "ltr", boxXs: [342.19, 358.09, 373.99, 389.89, 405.79, 421.69, 437.59, 453.49, 468.28, 485.29], whoSlots: WHO_FAMILY6, personRowH: 22.7 }),
        C("lastName", 255.9, 129.6, 342.2, 152.3, { whoSlots: WHO_FAMILY6, personRowH: 22.7 }),
        C("firstName", 169.7, 129.6, 255.9, 152.3, { whoSlots: WHO_FAMILY6, personRowH: 22.7 }),
        C("birthDate", 93.16, 129.6, 169.7, 152.3, { size: 8, boxes: 6, align: "ltr", boxXs: [93.16, 105.92, 118.67, 131.43, 144.19, 156.94, 169.7], whoSlots: WHO_FAMILY6, personRowH: 22.7 }),
        X("genderMale", 62, 136, { whoSlots: WHO_FAMILY6, personRowH: 22.7 }),
        X("genderFemale", 30, 136, { whoSlots: WHO_FAMILY6, personRowH: 22.7 }),
        C("street", 342.2, 272, 485.3, 290),
        C("houseNumber", 299.1, 272, 342.2, 290),
        C("city", 212.8, 272, 299.1, 290),
        C("zip", 93.2, 272, 169.7, 290),
        C("phoneHome", 342.2, 292, 485.3, 314),
        C("phone", 169.7, 292, 342.2, 314),
        C("email", 33, 318, 481, 340, { size: 8 }),
        C("policyNumber", 291.0, 383.3, 553.9, 406.0, { when: "full", rows: 3, rowH: 22.7 }),
        C("today", 28.2, 383.3, 291.0, 406.0, { when: "full", rows: 3, rowH: 22.7 }),
        C("policyNumber", 378.6, 484.4, 553.8, 507.1, { when: "partial", rows: 3, rowH: 22.7 }),
        C("partialCovers", 203.4, 484.4, 378.6, 507.1, { when: "partial", size: 8, rows: 3, rowH: 22.7 }),
        C("today", 28.2, 484.4, 203.4, 507.1, { when: "partial", rows: 3, rowH: 22.7 }),
        C("today", 418.72, 594.4, 495.26, 617.1, { align: "ltr", size: 8, boxes: 6, boxXs: [418.72, 431.48, 444.23, 456.99, 469.75, 482.5, 495.26], whoSlots: WHO_FAMILY6, personRowH: 22.7 }),
        C("fullName", 281.9, 594.4, 418.7, 617.1, { whoSlots: WHO_FAMILY6, personRowH: 22.7 }),
        C("idNumber", 128.86, 594.4, 281.93, 617.1, { boxes: 9, align: "ltr", boxXs: [128.86, 145.87, 162.87, 179.88, 196.89, 213.9, 230.91, 247.91, 264.92, 281.93], whoSlots: WHO_FAMILY6, personRowH: 22.7 })
      ]
    },
    harel_life: {
      id: "harel_life",
      file: "harel-life-cancel.pdf",
      fields: [
        C("idNumber", 415.75, 213.7, 554.05, 239.2, { size: 9, boxes: 9, align: "ltr", boxXs: [415.75, 430.95, 446.31, 461.68, 477.05, 492.41, 507.78, 523.15, 538.51, 554.05] }),
        C("lastName", 309.0, 213.7, 378.9, 239.2),
        C("firstName", 203.7, 213.7, 309.0, 239.2),
        C("phoneHome", 116.1, 213.7, 203.7, 239.2, { size: 8 }),
        C("phone", 28.2, 213.7, 116.1, 239.2, { size: 8 }),
        C("street", 415.7, 239.2, 554.0, 264.7),
        C("houseNumber", 309.0, 239.2, 378.9, 264.7),
        C("city", 203.7, 239.2, 309.0, 264.7),
        C("zip", 116.1, 239.2, 203.7, 264.7),
        C("email", 28.2, 266, 415.7, 286, { size: 8 }),
        C("policyNumber", 291.3, 352.8, 554.0, 378.3, { when: "full", rows: 2, rowH: 25.5 }),
        C("today", 28.5, 352.8, 291.3, 378.3, { when: "full", rows: 2, rowH: 25.5 }),
        C("policyNumber", 378.9, 447.6, 554.0, 467.4, { when: "partial", rows: 5, rowH: 19.8 }),
        C("partialCovers", 203.7, 447.6, 378.9, 467.4, { when: "partial", size: 8, rows: 5, rowH: 19.8 }),
        C("today", 28.5, 447.6, 203.7, 467.4, { when: "partial", rows: 5, rowH: 19.8 }),
        C("fullName", 379.1, 599.6, 501.7, 625.1, { whoSlots: WHO_TWO, personRowH: 25.51 }),
        C("idNumber", 238.11, 599.6, 379.13, 625.1, { boxes: 9, align: "ltr", boxXs: [238.11, 253.68, 269.34, 285.01, 300.67, 316.33, 331.99, 347.65, 363.31, 379.13], whoSlots: WHO_TWO, personRowH: 25.51 }),
        C("today", 138.9, 599.6, 238.1, 625.1, { align: "ltr", size: 8, whoSlots: WHO_TWO, personRowH: 25.51 })
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
        C("policyNumber", 310.2, 396.3, 567.1, 412.4, { when: "full", rows: 3, rowH: 16.2 }),
        C("today", 26.6, 396.3, 299.5, 412.4, { when: "full", rows: 3, rowH: 16.2 }),
        C("policyNumber", 466.2, 561.7, 567.1, 582, { when: "partial", rows: 3, rowH: 16.2 }),
        C("partialCovers", 345.7, 561.7, 455.4, 582, { when: "partial", size: 8, rows: 3, rowH: 16.2 }),
        C("idNumber", 225.2, 561.7, 334.9, 582, { when: "partial", rows: 3, rowH: 16.2 }),
        C("today", 28.3, 561.7, 214.4, 582, { when: "partial", rows: 3, rowH: 16.2 }),
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
        C("lastName", 428.0, 266, 518.4, 286, { whoSlots: WHO_TWO, personRowH: 38 }),
        C("firstName", 389.4, 266, 428.0, 286, { whoSlots: WHO_TWO, personRowH: 38 }),
        C("idNumber", 277.9, 266, 389.4, 286, { whoSlots: WHO_TWO, personRowH: 38 }),
        C("phone", 186.0, 266, 277.9, 286, { size: 8, whoSlots: WHO_TWO, personRowH: 38 }),
        C("email", 28.1, 266, 186.0, 286, { size: 8, whoSlots: WHO_TWO, personRowH: 38 }),
        X("markFullPolicy", 534.9, 481.3, { when: "full" }),
        X("markLifeOnly", 534.9, 368.4, { when: "partial" }),
        X("markPrimaryOnly", 518, 378, { when: "partial" }),
        C("today", 428.0, 538, 518.4, 564, { align: "ltr", size: 8, whoSlots: WHO_TWO, personRowH: 32.7 }),
        C("fullName", 297.6, 538, 428.0, 564, { whoSlots: WHO_TWO, personRowH: 32.7 }),
        C("idNumber", 186.0, 538, 297.6, 564, { whoSlots: WHO_TWO, personRowH: 32.7 })
      ]
    },
    migdal: {
      id: "migdal",
      file: "migdal-cancel.pdf",
      fields: [
        C("idNumber", 472.8, 168.7, 566.4, 182.9, { size: 8, boxes: 9, align: "ltr", boxXs: [472.8, 483.24, 493.68, 504.0, 514.44, 524.76, 535.2, 545.64, 555.96, 566.28] }),
        C("lastName", 387.8, 168.7, 472.8, 182.9),
        C("firstName", 302.8, 168.7, 387.8, 182.9),
        C("phoneHome", 129.2, 168.7, 221.0, 182.9, { size: 8 }),
        C("phone", 28.3, 168.7, 129.2, 182.9, { size: 8 }),
        C("city", 473.3, 194.2, 566.2, 208.3),
        C("street", 354.4, 194.2, 473.3, 208.3),
        C("houseNumber", 311.9, 194.2, 354.4, 208.3),
        C("zip", 255.1, 194.2, 311.9, 208.3),
        C("email", 28.3, 194.2, 198.5, 208.3, { size: 8 }),
        C("policyNumber", 354.4, 263.3, 567.0, 280.8, { when: "full", rows: 8, rowH: 17.5 }),
        C("today", 28.3, 263.3, 141.7, 280.8, { when: "full", rows: 8, rowH: 17.5 }),
        C("policyNumber", 453.6, 467.6, 567.0, 485.3, { when: "partial", rows: 3, rowH: 17.6 }),
        C("partialCovers", 141.7, 467.6, 453.6, 485.3, { when: "partial", size: 8, rows: 3, rowH: 17.6 }),
        C("today", 28.3, 467.6, 141.7, 485.3, { when: "partial", rows: 3, rowH: 17.6 }),
        C("today", 459.0, 565.3, 544.1, 593.6, { align: "ltr", size: 8 }),
        C("fullName", 333.0, 565.3, 422.8, 593.6),
        C("idNumber", 215.6, 565.3, 304.3, 593.6)
      ]
    }
  };

  const GiCancelForms = {
    TEMPLATE_BASE: "./forms/cancel/",
    FONT_URL: "./fonts/Heebo-Bold.ttf",
    VERSION: "20260906-haifa-modiin-v1",
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
    uniqueList(values){
      const out = [];
      (Array.isArray(values) ? values : [values]).forEach((v) => {
        const s = safeTrim(v);
        if(s && out.indexOf(s) < 0) out.push(s);
      });
      return out;
    },
    groupStatus(policies){
      const rows = Array.isArray(policies) ? policies : [];
      const anyPartial = rows.some((row) => this.isPartialStatus(row?.status || row?.cancel?.status));
      const anyFull = rows.some((row) => !this.isPartialStatus(row?.status || row?.cancel?.status));
      if(anyFull && anyPartial) return "mixed";
      if(anyPartial) return "partial";
      return "full";
    },
    groupStatusLabel(status){
      if(status === "mixed") return "ביטול מלא וחלקי";
      return this.cancelStatusLabel(status);
    },
    policyNumbersOf(policies){
      return this.uniqueList((Array.isArray(policies) ? policies : []).map((row) => row?.policyNumber || row?.policy?.policyNumber));
    },
    productLabelsOf(policies){
      return this.uniqueList((Array.isArray(policies) ? policies : []).map((row) => row?.productLabel || this.productLabel(row?.policy)));
    },
    asPolicyGroup(entry){
      if(entry && Array.isArray(entry.policies) && entry.policies.length) return entry;
      if(entry && (entry.policy || entry.policyId || entry.templateId)){
        const people = Array.isArray(entry.people) ? entry.people : (entry.insured ? [entry.insured] : []);
        return {
          insuredId: safeTrim(entry.insuredId),
          templateId: safeTrim(entry.templateId) || this.pickTemplateId(entry.policy),
          insured: people[0] || entry.insured,
          people,
          peopleIds: people.map((ins) => safeTrim(ins && ins.id)).filter(Boolean),
          company: entry.company || this.canonicalCompany(entry.policy?.company),
          policies: [entry]
        };
      }
      if(entry && typeof entry === "object" && (entry.company || entry.policyNumber || entry.type)){
        return {
          insuredId: "",
          templateId: this.pickTemplateId(entry),
          company: this.canonicalCompany(entry.company),
          people: [],
          peopleIds: [],
          policies: [{
            policy: entry,
            policyNumber: entry.policyNumber,
            status: "",
            productLabel: this.productLabel(entry)
          }]
        };
      }
      return { insuredId: "", templateId: "", people: [], peopleIds: [], policies: [] };
    },
    formatGroupDocName(group){
      const policies = Array.isArray(group?.policies) ? group.policies : [];
      const first = policies[0] || {};
      const company = this.canonicalCompany(first.policy?.company || group?.company) || "חברה";
      const products = this.productLabelsOf(policies);
      const kind = this.groupStatusLabel(this.groupStatus(policies));
      const nums = this.policyNumbersOf(policies);
      const numPart = nums.length > 3 ? (nums.length + " פוליסות") : nums.join(" · ");
      return "טופס ביטול מקורי — " + (products.join("/") || "פוליסה") + " · " + company + " · " + kind + (numPart ? (" · " + numPart) : "");
    },
    formatDocName(policyOrGroup, cancel){
      if(policyOrGroup && Array.isArray(policyOrGroup.policies)) return this.formatGroupDocName(policyOrGroup);
      if(policyOrGroup && policyOrGroup.policy) return this.formatGroupDocName(this.asPolicyGroup(policyOrGroup));
      return this.formatGroupDocName({
        company: this.canonicalCompany(policyOrGroup?.company),
        policies: [{
          policy: policyOrGroup,
          cancel: cancel || {},
          status: cancel?.status,
          policyNumber: policyOrGroup?.policyNumber,
          productLabel: this.productLabel(policyOrGroup)
        }]
      });
    },
    docIdFor(insuredId, templateId, peopleIds){
      const fromPeople = (Array.isArray(peopleIds) ? peopleIds : []).map(safeTrim).filter(Boolean);
      const ids = [];
      (fromPeople.length ? fromPeople : [safeTrim(insuredId || "ins")]).forEach((id) => {
        if(id && ids.indexOf(id) < 0) ids.push(id);
      });
      return "doc_cancel_" + (ids.join("_") || "ins") + "_" + safeTrim(templateId || "form");
    },
    policyMatchKey(policy){
      const num = safeTrim(policy?.policyNumber).replace(/\s+/g, "");
      if(!num) return "";
      const templateId = this.pickTemplateId(policy);
      if(!templateId) return "";
      return this.canonicalCompany(policy?.company) + "|" + num + "|" + templateId;
    },
    peopleForCancelledRow(row, insureds){
      const list = Array.isArray(insureds) ? insureds : [];
      const byId = {};
      list.forEach((ins) => {
        const id = safeTrim(ins && ins.id);
        if(id) byId[id] = ins;
      });
      const ids = [];
      const add = (id) => {
        const s = safeTrim(id);
        if(s && byId[s] && ids.indexOf(s) < 0) ids.push(s);
      };
      add(row && row.insuredId);
      const key = this.policyMatchKey(row && (row.policy || row));
      const sharedFrom = (ins, policyId) => {
        const rec = ins && ins.data && ins.data.cancellations && ins.data.cancellations[policyId];
        return (rec && Array.isArray(rec.sharedInsuredIds)) ? rec.sharedInsuredIds : [];
      };
      if(key){
        list.forEach((ins) => {
          const pols = (ins && ins.data && Array.isArray(ins.data.existingPolicies)) ? ins.data.existingPolicies : [];
          if(pols.some((ep) => this.policyMatchKey(ep) === key)) add(ins && ins.id);
        });
      }
      sharedFrom(row && row.insured, row && row.policyId).forEach(add);
      ids.slice().forEach((id) => {
        const ins = byId[id];
        const pols = (ins && ins.data && Array.isArray(ins.data.existingPolicies)) ? ins.data.existingPolicies : [];
        pols.forEach((ep) => {
          if(key && this.policyMatchKey(ep) === key) sharedFrom(ins, ep && ep.id).forEach(add);
        });
      });
      return ids.map((id) => byId[id]).filter(Boolean).sort(compareInsuredRole);
    },
    groupKeyForPeople(templateId, people){
      const ids = (Array.isArray(people) ? people : []).map((ins) => safeTrim(ins && ins.id)).filter(Boolean);
      return safeTrim(templateId) + "|" + ids.join(",");
    },
    policyDedupeKey(row){
      const num = safeTrim(row && row.policyNumber).replace(/\s+/g, "");
      if(num) return "n:" + num;
      return "id:" + safeTrim(row && (row.policyId || (row.policy && row.policy.id)));
    },
    groupCancelledPolicies(payloadOrList){
      const fromPayload = !Array.isArray(payloadOrList);
      const list = fromPayload ? this.listCancelledPolicies(payloadOrList) : payloadOrList;
      const insureds = fromPayload && Array.isArray(payloadOrList?.insureds)
        ? payloadOrList.insureds.slice()
        : [];
      if(!insureds.length){
        list.forEach((row) => {
          if(row && row.insured && insureds.indexOf(row.insured) < 0) insureds.push(row.insured);
        });
      }
      const map = new Map();
      const order = [];
      list.forEach((row) => {
        if(!row) return;
        const people = Array.isArray(row.people) && row.people.length
          ? row.people.slice()
          : this.peopleForCancelledRow(row, insureds);
        const key = this.groupKeyForPeople(row.templateId, people);
        if(!map.has(key)){
          map.set(key, {
            insuredId: safeTrim((people[0] && people[0].id) || row.insuredId),
            templateId: safeTrim(row.templateId),
            insured: people[0] || row.insured,
            people,
            peopleIds: people.map((ins) => safeTrim(ins && ins.id)).filter(Boolean),
            company: row.company,
            policies: []
          });
          order.push(key);
        }
        const group = map.get(key);
        const seen = group.policies.some((prev) => this.policyDedupeKey(prev) === this.policyDedupeKey(row));
        if(!seen) group.policies.push(row);
      });
      return order.map((key) => map.get(key));
    },
    legacyDocIdFor(insuredId, policyId){
      return "doc_cancel_" + safeTrim(insuredId || "ins") + "_" + safeTrim(policyId || "pol");
    },
    isCancelFormDoc(doc){
      return safeTrim(doc?.type) === this.DOC_TYPE;
    },
    stripCancelFormDocs(arr){
      if(!Array.isArray(arr)) return 0;
      let n = 0;
      for(let i = arr.length - 1; i >= 0; i--){
        if(this.isCancelFormDoc(arr[i])){
          arr.splice(i, 1);
          n += 1;
        }
      }
      return n;
    },
    isLiveGroupedDoc(doc, payload){
      if(!this.isCancelFormDoc(doc)) return false;
      const id = safeTrim(doc?.id);
      if(!id) return false;
      return this.groupCancelledPolicies(payload).some((group) => this.docIdFor(group.insuredId, group.templateId, group.peopleIds) === id);
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
      out.forEach((row) => {
        row.people = this.peopleForCancelledRow(row, insureds);
      });
      return out;
    },
    createDoc(entry, options){
      const group = this.asPolicyGroup(entry);
      const policies = Array.isArray(group.policies) ? group.policies : [];
      const first = policies[0] || {};
      const policy = first.policy || {};
      const uploadedAt = safeTrim(options?.uploadedAt) || nowISO();
      const numbers = this.policyNumbersOf(policies);
      const products = this.productLabelsOf(policies);
      const status = this.groupStatus(policies);
      return {
        id: this.docIdFor(
          group.insuredId || first.insuredId,
          group.templateId || first.templateId || this.pickTemplateId(policy),
          group.peopleIds
        ),
        type: this.DOC_TYPE,
        templateId: safeTrim(group.templateId || first.templateId) || this.pickTemplateId(policy),
        name: this.formatGroupDocName(group),
        company: this.canonicalCompany(policy.company || group.company),
        productFamily: first.productFamily || this.productFamily(policy),
        productLabel: products.join("/") || this.productLabel(policy),
        policyId: safeTrim(first.policyId || policy.id),
        policyIds: policies.map((row) => safeTrim(row.policyId || row.policy?.id)).filter(Boolean),
        insuredId: safeTrim(group.insuredId || first.insuredId),
        peopleIds: Array.isArray(group.peopleIds) ? group.peopleIds.slice() : [],
        policyNumber: numbers.join(" · "),
        policyNumbers: numbers,
        cancelStatus: status,
        isLegacy: true,
        source: "מערכת",
        uploadedAt,
        uploadedBy: safeTrim(options?.uploadedBy)
      };
    },
    injectDocs(list, payload, options){
      const target = Array.isArray(list) ? list : [];
      const groups = this.groupCancelledPolicies(payload);
      const payloadList = payload && Array.isArray(payload.customerDocuments) ? payload.customerDocuments : null;
      const reuseSource = payloadList || target;
      const reuse = {};
      reuseSource.forEach((doc) => {
        if(doc && doc.id) reuse[safeTrim(doc.id)] = doc;
      });
      const docs = groups.map((group) => {
        const fresh = this.createDoc(group, options);
        const prev = reuse[fresh.id];
        if(prev && this.isCancelFormDoc(prev) && safeTrim(prev.uploadedAt)){
          fresh.uploadedAt = prev.uploadedAt;
        }
        return fresh;
      });
      const wantedIds = docs.map((doc) => safeTrim(doc.id));
      const existing = reuseSource.filter((doc) => this.isCancelFormDoc(doc));
      const existingIds = existing.map((doc) => safeTrim(doc.id));
      const removedExtra = existingIds.some((id) => wantedIds.indexOf(id) < 0) || existingIds.length > wantedIds.length;

      this.stripCancelFormDocs(target);
      for(let i = docs.length - 1; i >= 0; i--) target.unshift(docs[i]);

      if(removedExtra && payloadList && target !== payloadList){
        this.stripCancelFormDocs(payloadList);
        for(let i = docs.length - 1; i >= 0; i--) payloadList.unshift(docs[i]);
      }
      return { list: target, removedExtra, docs };
    },

    findEntry(rec, doc){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : rec;
      const groups = this.groupCancelledPolicies(payload);
      const docId = safeTrim(doc?.id);
      const templateId = safeTrim(doc?.templateId);
      const policyId = safeTrim(doc?.policyId);
      const insuredId = safeTrim(doc?.insuredId);
      const byGroupId = groups.find((group) => docId && this.docIdFor(group.insuredId, group.templateId, group.peopleIds) === docId);
      if(byGroupId) return byGroupId;
      const byTemplate = groups.find((group) => templateId && group.templateId === templateId && (!insuredId || group.insuredId === insuredId));
      if(byTemplate) return byTemplate;
      const byLegacyId = groups.find((group) => docId && group.policies.some((row) => this.legacyDocIdFor(row.insuredId, row.policyId) === docId));
      if(byLegacyId) return byLegacyId;
      const byPolicy = groups.find((group) => policyId && group.policies.some((row) => row.policyId === policyId && (!insuredId || row.insuredId === insuredId)));
      if(byPolicy) return byPolicy;
      return groups[0] || null;
    },
    coversFromCancel(cancel){
      const c = cancel && typeof cancel === "object" ? cancel : {};
      const covers = Array.isArray(c.partialCovers) ? c.partialCovers.map(safeTrim).filter(Boolean) : [];
      const extra = safeTrim(c.reason) || safeTrim(c.partialDetails) || safeTrim(c.partialText) || safeTrim(c.annexText);
      if(extra && covers.indexOf(extra) < 0) covers.push(extra);
      return covers;
    },
    buildDraft(rec, doc){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : {};
      const group = this.asPolicyGroup(this.findEntry(rec, doc) || {});
      const policies = Array.isArray(group.policies) ? group.policies : [];
      const first = policies[0] || {};
      const policy = first.policy || {};
      const cancel = first.cancel || {};
      const insured = group.insured || first.insured || null;
      const peopleIns = Array.isArray(group.people) && group.people.length
        ? group.people
        : (insured ? [insured] : []);
      const templateId = safeTrim(doc?.templateId) || safeTrim(group.templateId) || safeTrim(first.templateId) || this.pickTemplateId(policy);
      const template = TEMPLATES[templateId] || null;
      const numbers = this.policyNumbersOf(policies);
      const policyNumber = numbers.join(" · ") || safeTrim(doc?.policyNumber);
      const people = peopleIns.map((ins, i) => personFromInsured(ins, i === 0 ? [payload.primary, payload, rec] : []));
      const person = people[0] || personFromInsured(insured, [payload.primary, payload, rec]);
      const email = safeTrim(person.email);
      const at = email.indexOf("@");
      const covers = [];
      policies.forEach((row) => {
        this.coversFromCancel(row.cancel).forEach((item) => {
          if(covers.indexOf(item) < 0) covers.push(item);
        });
      });
      const reason = covers.join(" · ");
      const addressParts = [person.street, person.houseNumber, person.city, person.zip].map(safeTrim).filter(Boolean);
      const status = this.groupStatus(policies);
      const products = this.productLabelsOf(policies);
      return {
        rec,
        doc,
        payload,
        entry: group,
        policies,
        policy,
        cancel,
        person,
        people,
        templateId,
        template,
        policyNumber,
        policyNumbers: numbers,
        company: this.canonicalCompany(policy.company || group.company) || safeTrim(doc?.company),
        productLabel: products.join(" / ") || this.productLabel(policy) || safeTrim(doc?.productLabel),
        status,
        statusLabel: this.groupStatusLabel(status),
        isPartial: status === "partial",
        isMixed: status === "mixed",
        today: todayIL(),
        birthDate: formatDateIL(person.birthDate),
        reason,
        partialCovers: covers.join(" · "),
        address: addressParts.join(" "),
        emailLocal: at > 0 ? email.slice(0, at) : "",
        emailDomain: at > 0 ? email.slice(at + 1) : ""
      };
    },
    personForWho(draft, who){
      const people = Array.isArray(draft?.people) && draft.people.length
        ? draft.people
        : (draft?.person ? [draft.person] : []);
      const lead = people[0] || draft?.person || null;
      const w = safeTrim(who) || "self";
      const sameAsLead = (p) => p && lead && p._id && lead._id && p._id === lead._id;
      if(w === "self" || w === "primary") return lead;
      if(w === "spouse"){
        const hit = people.find((p) => p && (p._type === "spouse" || p._type === "secondary"));
        return (hit && !sameAsLead(hit)) ? hit : null;
      }
      if(w === "second"){
        const hit = people.find((p) => p && (p._type === "spouse" || p._type === "secondary"))
          || people.find((p) => p && p._type === "adult")
          || people.find((p) => p && p._type !== "child" && !sameAsLead(p))
          || people.find((p) => p && !sameAsLead(p));
        return (hit && !sameAsLead(hit)) ? hit : null;
      }
      if(w.indexOf("child:") === 0){
        const i = parseInt(w.slice(6), 10);
        const kids = people.filter((p) => p && p._type === "child");
        return kids[i] || null;
      }
      return lead;
    },
    valueFor(draft, key, who){
      const extra = !!(who && who !== "self" && who !== "primary");
      const p = extra ? (this.personForWho(draft, who) || {}) : (this.personForWho(draft, who) || draft?.person || {});
      if(extra && !personHasIdentity(p)) return "";
      const gender = safeTrim(p.gender).toLowerCase();
      const hasPerson = personHasIdentity(p);
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
        birthDate: extra ? formatDateIL(p.birthDate) : (draft && draft.birthDate),
        today: draft && draft.today,
        policyNumber: draft && draft.policyNumber,
        productLabel: draft && draft.productLabel,
        partialCovers: draft && draft.partialCovers,
        reason: draft && draft.reason,
        address: extra ? "" : (draft && draft.address),
        emailLocal: extra ? "" : (draft && draft.emailLocal),
        emailDomain: extra ? "" : (draft && draft.emailDomain),
        markPrimary: hasPerson ? "X" : "",
        markFullPolicy: extra ? "" : "X",
        markLifeOnly: extra ? "" : "X",
        markPrimaryOnly: extra ? "" : "X",
        genderMale: male ? "X" : "",
        genderFemale: female ? "X" : ""
      };
      return safeTrim(map[key]);
    },
    valueForRow(draft, field, rows){
      const key = field?.key;
      const list = Array.isArray(rows) ? rows : [];
      if(key === "policyNumber" || key === "policy"){
        return this.policyNumbersOf(list).join(" · ");
      }
      if(key === "productLabel"){
        return this.productLabelsOf(list).join(" / ");
      }
      if(key === "partialCovers" || key === "reason"){
        const covers = [];
        list.forEach((row) => {
          this.coversFromCancel(row?.cancel).forEach((item) => {
            if(covers.indexOf(item) < 0) covers.push(item);
          });
        });
        return covers.join(" · ");
      }
      return this.valueFor(draft, key, field && field.who);
    },
    charsForBoxes(field, text, n){
      const key = safeTrim(field?.key);
      let digits = String(text == null ? "" : text).replace(/\D/g, "");
      if(!digits || n < 2) return null;
      if((key === "birthDate" || key === "today") && n === 6 && digits.length >= 8){
        digits = digits.slice(0, 4) + digits.slice(6, 8);
      } else if((key === "birthDate" || key === "today") && n === 8 && digits.length >= 8){
        digits = digits.slice(0, 8);
      }
      if(key === "idNumber"){
        if(digits.length > n) digits = digits.slice(-n);
        else while(digits.length < n) digits = "0" + digits;
      } else if(digits.length > n){
        digits = digits.slice(0, n);
      }
      const out = digits.split("");
      while(out.length < n) out.push("");
      return out;
    },
    overlayPlan(draft){
      const template = draft?.template;
      const fields = Array.isArray(template?.fields) ? template.fields : [];
      if(!template || !fields.length) return [];
      const policies = Array.isArray(draft?.policies) && draft.policies.length
        ? draft.policies
        : [draft];
      const out = [];
      const emit = (field, text, dy, index) => {
        if(!text) return;
        const boxes = Number(field.boxes) > 1 ? Number(field.boxes) : 0;
        const x0 = Number(field.x0);
        const y0 = Number(field.y0) + dy;
        const x1 = Number(field.x1);
        const y1 = Number(field.y1) + dy;
        const h = Math.max(8, y1 - y0);
        const baselineMupdf = y0 + Math.min(h * 0.72, h - 2.5);
        const y = PAGE_H - baselineMupdf - 2;
        if(boxes){
          const chars = this.charsForBoxes(field, text, boxes);
          if(!chars) return;
          const walls = Array.isArray(field.boxXs) && field.boxXs.length === boxes + 1
            ? field.boxXs.map(Number)
            : null;
          const spanEq = (x1 - x0) / boxes;
          const preferred = Number(field.size) > 0 ? Number(field.size) : 9;
          chars.forEach((ch, i) => {
            if(!ch) return;
            const bx0 = walls ? walls[i] : (x0 + i * spanEq);
            const bx1 = walls ? walls[i + 1] : (bx0 + spanEq);
            const span = bx1 - bx0;
            out.push({
              page: 0,
              key: field.key + "#b" + i,
              kind: "text",
              x: (bx0 + bx1) / 2,
              y,
              text: ch,
              size: Math.max(6, Math.min(preferred, span * 0.78, h * 0.72)),
              align: "center",
              maxW: Math.max(4, span - 1)
            });
          });
          return;
        }
        const size = Number(field.size) > 0 ? Number(field.size) : (field.kind === "mark" ? 11 : 9);
        const align = field.align === "ltr" ? "ltr" : "rtl";
        out.push({
          page: 0,
          key: field.key + (index ? ("#" + index) : ""),
          kind: field.kind || "text",
          x: align === "ltr" ? (x0 + PAD) : (x1 - PAD),
          y,
          text,
          size,
          align,
          maxW: Math.max(8, (x1 - x0) - PAD * 2)
        });
      };
      fields.forEach((field) => {
        const when = safeTrim(field.when);
        const matching = policies.filter((row) => {
          if(!when) return true;
          const partial = this.isPartialStatus(row?.status || row?.cancel?.status);
          if(when === "full") return !partial;
          if(when === "partial") return partial;
          return true;
        });
        if(when && !matching.length) return;
        const whoSlots = Array.isArray(field.whoSlots) ? field.whoSlots : [];
        const personRowH = Number(field.personRowH) || 0;
        if(whoSlots.length){
          whoSlots.forEach((slot, pi) => {
            const slotted = Object.assign({}, field, { who: slot });
            emit(slotted, this.valueFor(draft, field.key, slot), pi * personRowH, pi);
          });
          return;
        }
        const rows = Number(field.rows) > 1 ? Number(field.rows) : 0;
        const rowH = Number(field.rowH) || 0;
        if(rows && rowH){
          matching.forEach((row, i) => {
            if(i >= rows) return;
            const slice = (i === rows - 1 && matching.length > rows) ? matching.slice(i) : [row];
            emit(field, this.valueForRow(draft, field, slice), i * rowH, i);
          });
          return;
        }
        emit(field, this.valueForRow(draft, field, matching.length ? matching : policies), 0, 0);
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
      const painted = raw;
      let size = Number(op.size) > 0 ? Number(op.size) : 9;
      let width = 0;
      try { width = font ? font.widthOfTextAtSize(painted, size) : painted.length * size * 0.5; } catch(_e){ width = painted.length * size * 0.5; }
      const maxW = Number(op.maxW) > 0 ? Number(op.maxW) : 0;
      if(maxW && width > maxW && width > 0){
        size = Math.max(6, size * (maxW / width) * 0.98);
        try { width = font ? font.widthOfTextAtSize(painted, size) : width; } catch(_e2) {}
      }
      let x = Number(op.x) || 0;
      if(op.align === "center") x = x - (width / 2);
      else if(op.align !== "ltr") x = x - width;
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
