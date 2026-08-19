/* GI-ISSUED-SCAN 2026-08-19
   מנוע כללי: סריקת טקסט פוליסה מול הצעה.
   לא תלוי בחברה. לא נוגע בחישוב פרמיה / PIN / MFA / כניסת פנים.
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GIPolicyScan = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function safeTrim(v) {
    return String(v == null ? "" : v).trim();
  }

  function fold(v) {
    return safeTrim(v)
      .replace(/[\u0591-\u05C7]/g, "")
      .replace(/[״"'`׳]/g, "")
      .replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  function digitsOnly(v) {
    return String(v == null ? "" : v).replace(/\D+/g, "");
  }

  function asMoneyNumber(v) {
    const n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function unique(list) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((item) => {
      const key = String(item == null ? "" : item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }

  function textHas(hay, needle) {
    const h = fold(hay);
    const n = fold(needle);
    return !!(h && n && n.length >= 2 && h.indexOf(n) >= 0);
  }

  function anyTextHas(hay, variants) {
    return (Array.isArray(variants) ? variants : []).some((v) => textHas(hay, v));
  }

  function moneyVariants(amount) {
    const n = Math.round(asMoneyNumber(amount) * 100) / 100;
    if (!(n > 0)) return [];
    const intPart = Math.floor(n);
    const hasDec = Math.abs(n - intPart) > 0.001;
    const intStr = String(intPart);
    const grouped = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const groupedDot = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const groupedSpace = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const out = [intStr, grouped, groupedDot, groupedSpace];
    if (hasDec) {
      const dec = n.toFixed(2);
      out.push(dec, dec.replace(".", ","), grouped + "." + dec.split(".")[1], grouped + "," + dec.split(".")[1]);
    } else {
      out.push(intStr + ".00", intStr + ",00", grouped + ".00", grouped + ",00");
    }
    return unique(out);
  }

  /* pdf.js על פוליסות עבריות מפרק לעיתים 344.00 ל־"3 4 4 . 0 0".
     בפוליסת הכשרה העמודה היא "פרמיה תקופתית בש״ח", לא "פרמיה חודשית". */
  function normalizePdfMoneyText(text) {
    return String(text || "")
      .replace(/(?<=\d)[\s\u00a0\u2007\u202f]+(?=\d)/g, "")
      .replace(/(\d)\s*[.,]\s*(\d{1,2})(?!\d)/g, "$1.$2");
  }

  function extractMoneyFigures(text) {
    const norm = normalizePdfMoneyText(text);
    const out = [];
    const rx = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}/g;
    let m;
    while ((m = rx.exec(norm)) !== null) {
      const n = asMoneyNumber(String(m[0]).replace(/,/g, ""));
      if (n > 0) out.push(Math.round(n * 100) / 100);
    }
    return out;
  }

  function moneyFoundInHay(hay, amount) {
    const n = Math.round(asMoneyNumber(amount) * 100) / 100;
    if (!(n > 0) || !hay) return false;
    const variants = moneyVariants(n);
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v) continue;
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp("(?<![0-9])" + escaped + "(?![0-9])");
      if (rx.test(hay)) return true;
    }
    const intPart = String(Math.floor(n));
    if (intPart.length >= 6 && digitsOnly(hay).indexOf(intPart) >= 0) return true;
    return false;
  }

  function moneyFound(text, amount) {
    const raw = String(text || "");
    if (moneyFoundInHay(raw, amount)) return true;
    const norm = normalizePdfMoneyText(raw);
    if (norm !== raw && moneyFoundInHay(norm, amount)) return true;
    const want = Math.round(asMoneyNumber(amount) * 100) / 100;
    if (!(want > 0)) return false;
    return extractMoneyFigures(raw).some((n) => Math.abs(n - want) < 0.05);
  }

  function premiumFound(text, amount) {
    if (moneyFound(text, amount)) return true;
    const raw = String(text || "");
    const want = Math.round(asMoneyNumber(amount) * 100) / 100;
    if (!(want > 0)) return false;
    const folded = fold(raw);
    const hasPremiumLabel = folded.indexOf("פרמיה") >= 0 || folded.indexOf("תקופתית") >= 0;
    if (!hasPremiumLabel) return false;
    return extractMoneyFigures(raw).some((n) => Math.abs(n - want) < 0.51 && Math.round(n) === Math.round(want));
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function parseDateParts(v) {
    const s = safeTrim(v);
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m) return { d: Number(m[1]), mo: Number(m[2]), y: Number(m[3]) };
    m = s.match(/^(\d{1,2})[./-](\d{4})$/);
    if (m) return { mo: Number(m[1]), y: Number(m[2]), d: 1 };
    m = s.match(/^(\d{1,2})\/(\d{2})$/);
    if (m) {
      const mo = Number(m[1]);
      const yy = Number(m[2]);
      if (mo >= 1 && mo <= 12) return { mo, y: yy >= 70 ? 1900 + yy : 2000 + yy, d: 1 };
    }
    return null;
  }

  function dateVariants(v) {
    const p = parseDateParts(v);
    if (!p || !p.y || !p.mo) return [safeTrim(v)].filter(Boolean);
    const y2 = String(p.y).slice(-2);
    const out = [
      pad2(p.d) + "/" + pad2(p.mo) + "/" + p.y,
      p.d + "/" + p.mo + "/" + p.y,
      pad2(p.d) + "." + pad2(p.mo) + "." + p.y,
      p.d + "." + p.mo + "." + p.y,
      pad2(p.d) + "/" + pad2(p.mo) + "/" + y2,
      p.d + "/" + p.mo + "/" + y2,
      pad2(p.mo) + "/" + p.y,
      p.mo + "/" + p.y,
      pad2(p.mo) + "/" + y2,
      p.mo + "/" + y2,
      p.y + "-" + pad2(p.mo) + "-" + pad2(p.d),
      "1/" + pad2(p.mo) + "/" + p.y,
      "01/" + pad2(p.mo) + "/" + p.y
    ];
    return unique(out.filter(Boolean));
  }

  function dateFound(text, v) {
    const raw = String(text || "");
    return dateVariants(v).some((item) => {
      const escaped = String(item).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(escaped).test(raw);
    });
  }

  function nameVariants(first, last, full) {
    const f = safeTrim(first);
    const l = safeTrim(last);
    const n = safeTrim(full) || ((f + " " + l).trim());
    const out = [];
    if (n) out.push(n);
    if (f && l) {
      out.push(f + " " + l, l + " " + f);
    }
    return unique(out);
  }

  function genderLabel(v) {
    const s = fold(v);
    if (s === "male" || s === "zkr" || s === "זכר" || s === "ז") return "זכר";
    if (s === "female" || s === "nqbh" || s === "נקבה" || s === "נ") return "נקבה";
    if (safeTrim(v) === "זכר" || safeTrim(v) === "נקבה") return safeTrim(v);
    return "";
  }

  function genderFound(text, expected) {
    const want = genderLabel(expected);
    if (!want) return false;
    const folded = fold(text);
    if (want === "זכר") return folded.indexOf("זכר") >= 0 || /מין[:\s]*ז/.test(String(text || ""));
    return folded.indexOf("נקבה") >= 0;
  }

  function paymentLabel(v) {
    const s = fold(v);
    if (s === "cc" || s.indexOf("אשראי") >= 0 || s.indexOf("credit") >= 0) return "כרטיס אשראי";
    if (s === "ho" || s.indexOf("הוראתקבע") >= 0 || s.indexOf("הוק") >= 0) return "הוראת קבע";
    return "";
  }

  function paymentSignal(text) {
    const f = fold(text);
    return f.indexOf("אשראי") >= 0 || f.indexOf("הוראתקבע") >= 0 || f.indexOf("הוק") >= 0 || f.indexOf("גביה") >= 0 || f.indexOf("תשלום") >= 0;
  }

  function paymentFound(text, expected) {
    const want = paymentLabel(expected);
    if (!want) return false;
    const f = fold(text);
    if (want === "כרטיס אשראי") return f.indexOf("אשראי") >= 0;
    return f.indexOf("הוראתקבע") >= 0 || f.indexOf("הוק") >= 0 || f.indexOf("בנק") >= 0;
  }

  function smokingSignal(text) {
    const f = fold(text);
    return f.indexOf("מעשן") >= 0 || f.indexOf("עישון") >= 0 || f.indexOf("סיגריות") >= 0 || f.indexOf("טבק") >= 0;
  }

  function smokingLabel(v) {
    const s = fold(v);
    if (s === "yes" || s === "כן" || s === "מעשן") return "מעשן";
    if (s === "no" || s === "לא" || s === "לאמעשן") return "לא מעשן";
    return "";
  }

  function smokingFound(text, expected) {
    const want = smokingLabel(expected);
    if (!want) return false;
    const f = fold(text);
    if (want === "מעשן") return f.indexOf("מעשן") >= 0 && f.indexOf("לאמעשן") < 0;
    return f.indexOf("לאמעשן") >= 0 || /לא\s*מעשן/.test(String(text || ""));
  }

  function phoneSignal(text) {
    const raw = String(text || "");
    return /(?:\+?972-?|0)5\d(?:-?\d){7}/.test(raw)
      || /(?:\+?972-?|0)[23489]\d(?:-?\d){7}/.test(raw)
      || /(?:\+?972-?|0)7[67](?:-?\d){7}/.test(raw);
  }

  function phoneFound(text, expected) {
    const d = digitsOnly(expected);
    if (d.length < 9) return false;
    const compact = digitsOnly(text);
    if (compact.indexOf(d) >= 0) return true;
    if (d.charAt(0) === "0" && compact.indexOf(d.slice(1)) >= 0) return true;
    return false;
  }

  function emailSignal(text) {
    return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(text || ""));
  }

  function zipSignal(text) {
    return /(?<![0-9])\d{5,7}(?![0-9])/.test(String(text || ""));
  }

  const COVER_GROUPS = [
    ["ניתוחיםבישראלמהשקלהראשון", "ניתוחיםמהשקלהראשון", "ניתוחיםבישראל", "שקלהראשון", "ניתוחיםשקלראשון"],
    ["ניתוחבחול", "ניתוחיםבחול", "מחליפניתוחבחול", "ניתוחיםוטיפוליםמחליפניתוחמחוץלישראל", "טיפוליםמחליפניתוחבחול", "ניתוחוטיפולמחליףניתוחבחול"],
    ["השתלות", "השתלותוטיפוליםמיוחדים", "השתלותבחול", "השתלותוטיפוליםמיוחדיםמחוץלישראל"],
    ["תרופות", "תרופותמחוץלסל", "תרופותמחוץלסלשירותיהבריאות"],
    ["אמבולטורי", "יעוץובדיקות", "ייעוץובדיקות", "נספחיעוץובדיקות"],
    ["מחלותקשות", "מגןלמחלותקשות"],
    ["סרטן", "מגןלסרטן"],
    ["משליםשבן", "ניתוחיםמשליםשבן"],
    ["מגן1", "ימגן1", "ביטוחחיים", "מקרהמות"]
  ];

  function coverAliases(label) {
    const folded = fold(label);
    const out = [label];
    COVER_GROUPS.forEach((group) => {
      if (group.some((alias) => folded.indexOf(alias) >= 0 || alias.indexOf(folded) >= 0)) {
        group.forEach((alias) => out.push(alias));
      }
    });
    return unique(out);
  }

  function coverFound(text, label) {
    const foldedDoc = fold(text);
    if (!foldedDoc) return false;
    const aliases = coverAliases(label);
    if (aliases.some((alias) => {
      const a = fold(alias);
      return a.length >= 4 && foldedDoc.indexOf(a) >= 0;
    })) return true;
    const tokens = safeTrim(label).split(/\s+/).map(fold).filter((t) => t.length >= 3 && t !== "בישראל" && t !== "כיסוי");
    if (tokens.length >= 2 && tokens.filter((t) => foldedDoc.indexOf(t) >= 0).length >= Math.min(2, tokens.length)) return true;
    return false;
  }

  function isLifeType(type) {
    const t = fold(type);
    return t === "ריסק" || t.indexOf("ריסקמשכנתא") >= 0 || t.indexOf("חיים") >= 0;
  }

  function buildExpectedFields(snapshot) {
    const src = snapshot && typeof snapshot === "object" ? snapshot : {};
    const policy = src.policy && typeof src.policy === "object" ? src.policy : {};
    const insureds = Array.isArray(src.insureds) ? src.insureds : [];
    const fields = [];
    const push = (row) => {
      if (!row || !safeTrim(row.expected)) return;
      fields.push(row);
    };

    insureds.forEach((ins, idx) => {
      const who = insureds.length > 1 ? ("מבוטח " + (idx + 1) + " · ") : "";
      const names = nameVariants(ins.firstName, ins.lastName, ins.fullName);
      if (names[0]) {
        push({
          key: "name_" + idx,
          label: who + "שם מבוטח",
          expected: names[0],
          kind: "name",
          variants: names
        });
      }
      if (digitsOnly(ins.idNumber).length >= 8) {
        push({
          key: "id_" + idx,
          label: who + "תעודת זהות",
          expected: digitsOnly(ins.idNumber),
          kind: "id"
        });
      }
      if (genderLabel(ins.gender)) {
        push({
          key: "gender_" + idx,
          label: who + "מין",
          expected: genderLabel(ins.gender),
          kind: "gender"
        });
      }
      if (parseDateParts(ins.birthDate)) {
        push({
          key: "birth_" + idx,
          label: who + "תאריך לידה",
          expected: safeTrim(ins.birthDate),
          kind: "date"
        });
      }
      const addressParts = [ins.street, ins.houseNumber, ins.city].map(safeTrim).filter(Boolean);
      if (addressParts.length) {
        push({
          key: "address_" + idx,
          label: who + "כתובת",
          expected: addressParts.join(" "),
          kind: "address",
          parts: addressParts
        });
      }
      if (digitsOnly(ins.phone).length >= 9) {
        push({
          key: "phone_" + idx,
          label: who + "טלפון",
          expected: safeTrim(ins.phone),
          kind: "phone",
          optional: true
        });
      }
      if (safeTrim(ins.email).indexOf("@") >= 0) {
        push({
          key: "email_" + idx,
          label: who + "דוא״ל",
          expected: safeTrim(ins.email),
          kind: "email",
          optional: true
        });
      }
    });

    const sums = unique([policy.sumInsured, policy.compensation]
      .concat(Array.isArray(policy.sumCandidates) ? policy.sumCandidates : [])
      .map(asMoneyNumber)
      .filter((n) => n > 0));
    if (sums.length) {
      push({
        key: "sum",
        label: isLifeType(policy.type) ? "סכום ביטוח" : "סכום / פיצוי",
        expected: String(sums[0]),
        kind: "money",
        candidates: sums
      });
    }

    const premiums = unique((Array.isArray(policy.premiumCandidates) ? policy.premiumCandidates : [policy.premiumMonthly])
      .map(asMoneyNumber)
      .filter((n) => n > 0));
    if (premiums.length) {
      push({
        key: "premium",
        label: "פרמיה תקופתית",
        expected: String(premiums[0]),
        kind: "premium",
        candidates: premiums
      });
    }

    if (parseDateParts(policy.startDate)) {
      push({
        key: "start",
        label: "תחילת ביטוח",
        expected: safeTrim(policy.startDate),
        kind: "date"
      });
    }

    if (paymentLabel(policy.paymentMethod)) {
      push({
        key: "pay",
        label: "אמצעי תשלום",
        expected: paymentLabel(policy.paymentMethod),
        kind: "payment",
        optional: true
      });
    }

    const covers = Array.isArray(policy.covers) ? policy.covers : [];
    covers.forEach((cover, idx) => {
      const label = safeTrim(cover && cover.label != null ? cover.label : cover);
      if (!label) return;
      if (isLifeType(policy.type) && fold(label) === fold(policy.type)) return;
      push({
        key: "cover_" + idx,
        label: "כיסוי · " + label,
        expected: label,
        kind: "cover"
      });
      const amt = asMoneyNumber(cover && cover.amount);
      if (amt > 0) {
        push({
          key: "coveramt_" + idx,
          label: "סכום כיסוי · " + label,
          expected: String(amt),
          kind: "money",
          candidates: [amt]
        });
      }
    });

    return fields;
  }

  function fieldMatched(text, field) {
    const kind = field.kind;
    if (kind === "name") return anyTextHas(text, field.variants || [field.expected]);
    if (kind === "id") return digitsOnly(text).indexOf(digitsOnly(field.expected)) >= 0;
    if (kind === "gender") return genderFound(text, field.expected);
    if (kind === "date") return dateFound(text, field.expected);
    if (kind === "address") {
      const parts = Array.isArray(field.parts) && field.parts.length ? field.parts : [field.expected];
      const hits = parts.filter((p) => textHas(text, p) || (digitsOnly(p).length && digitsOnly(text).indexOf(digitsOnly(p)) >= 0));
      return hits.length >= Math.min(parts.length, Math.max(1, parts.length - (parts.length >= 3 ? 1 : 0)));
    }
    if (kind === "phone") return phoneFound(text, field.expected);
    if (kind === "email") return fold(text).indexOf(fold(field.expected)) >= 0;
    if (kind === "payment") return paymentFound(text, field.expected);
    if (kind === "cover") return coverFound(text, field.expected);
    if (kind === "premium") {
      const cands = Array.isArray(field.candidates) && field.candidates.length ? field.candidates : [field.expected];
      return cands.some((c) => premiumFound(text, c));
    }
    if (kind === "money") {
      const cands = Array.isArray(field.candidates) && field.candidates.length ? field.candidates : [field.expected];
      return cands.some((c) => moneyFound(text, c));
    }
    return textHas(text, field.expected);
  }

  function shouldSkip(text, field) {
    if (!field.optional) return false;
    if (field.kind === "phone") return !phoneSignal(text);
    if (field.kind === "email") return !emailSignal(text);
    if (field.kind === "payment") return !paymentSignal(text);
    return false;
  }

  function formatExpected(field) {
    if (field.kind === "money" || field.kind === "premium") {
      const n = asMoneyNumber(field.expected);
      return n ? n.toLocaleString("he-IL") : field.expected;
    }
    return safeTrim(field.expected);
  }

  function compareProposalToIssuedText(snapshot, text) {
    const raw = String(text || "");
    const compact = raw.replace(/\s+/g, " ").trim();
    if (compact.length < 40) {
      return {
        status: "unreadable",
        ok: false,
        gaps: [],
        skipped: [],
        compared: 0,
        message: "לא ניתן לקרוא את הפוליסה. העלו PDF עם טקסט קריא."
      };
    }
    const fields = buildExpectedFields(snapshot);
    const gaps = [];
    const skipped = [];
    let compared = 0;
    fields.forEach((field) => {
      if (shouldSkip(raw, field)) {
        skipped.push({ key: field.key, label: field.label, reason: "לא מופיע בפוליסה" });
        return;
      }
      compared += 1;
      if (fieldMatched(raw, field)) return;
      gaps.push({
        key: field.key,
        label: field.label,
        expected: formatExpected(field),
        found: "לא נמצא בפוליסה"
      });
    });
    if (!compared) {
      return {
        status: "unreadable",
        ok: false,
        gaps: [],
        skipped,
        compared: 0,
        message: "אין מספיק נתונים בהצעה להשוואה."
      };
    }
    if (gaps.length) {
      return {
        status: "gaps",
        ok: false,
        gaps,
        skipped,
        compared,
        message: "יש פערים בין הפוליסה להצעה"
      };
    }
    return {
      status: "ok",
      ok: true,
      gaps: [],
      skipped,
      compared,
      message: "פוליסה פעילה תקינה"
    };
  }

  return {
    fold,
    digitsOnly,
    asMoneyNumber,
    moneyFound,
    premiumFound,
    normalizePdfMoneyText,
    dateFound,
    coverFound,
    buildExpectedFields,
    compareProposalToIssuedText
  };
});
