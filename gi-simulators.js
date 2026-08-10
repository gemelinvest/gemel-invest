/* GEMEL INVEST — lazy simulator chunk (GI-PERF 2026-08-09)
   Loaded on demand via ensureGiSimulatorJsLoaded(). Pricing logic unchanged.
*/
(function installGiSimulators(global){
  "use strict";
  const host = global.__GI_SIM_HOST;
  if(!host || !host.RiskSimulators){
    throw new Error("GI_SIM_HOST missing");
  }
  const safeTrim = host.safeTrim;
  const escapeHtml = host.escapeHtml;
  const on = typeof host.on === "function"
    ? host.on
    : ((el, evt, fn, opts) => el && el.addEventListener && el.addEventListener(evt, fn, opts));
  const $ = typeof host.$ === "function"
    ? host.$
    : ((sel, root) => (root || document).querySelector(sel));
  const $$ = typeof host.$$ === "function"
    ? host.$$
    : ((sel, root) => Array.from((root || document).querySelectorAll(sel)));
  const nowISO = typeof host.nowISO === "function"
    ? host.nowISO
    : (() => new Date().toISOString());
  const parseBirthDateValue = host.parseBirthDateValue;
  const formatDmyFromParts = host.formatDmyFromParts;
  const renderCompanyLogoHtmlForCompany = host.renderCompanyLogoHtmlForCompany;
  const ensureGiSimulatorStylesLoaded = host.ensureGiSimulatorStylesLoaded;
  const RiskSimulators = host.RiskSimulators;

  /**
   * מאזין לחיצה יחיד על המודאל לכפתורי מין/עישון (ו־programMode).
   * שורד החלפת innerHTML ב-_render — בניגוד ל-bind על כפתורים בודדים שנמחקים.
   */
  function ensureSegFieldDelegation(modal, sim, fieldPrefix){
    if(!modal || !sim || !fieldPrefix) return;
    const flag = "_giSegDel_" + fieldPrefix;
    if(modal[flag]) return;
    modal[flag] = true;
    const fieldAttr = "data-" + fieldPrefix + "-field";
    const valueAttr = "data-" + fieldPrefix + "-value";
    on(modal, "click", (ev) => {
      const target = ev.target;
      if(!target || typeof target.closest !== "function") return;
      const btn = target.closest(
        "[" + fieldAttr + "=\"gender\"], [" + fieldAttr + "=\"smoker\"], [" + fieldAttr + "=\"programMode\"]"
      );
      if(!btn || !modal.contains(btn)) return;
      const st = sim._state?.[sim._activeInsuredId];
      if(!st) return;
      const field = btn.getAttribute(fieldAttr);
      const raw = btn.getAttribute(valueAttr);
      if(field === "gender"){
        st.gender = raw || "";
        st.genderSource = "manual";
      } else if(field === "smoker"){
        st.smoker = raw === "1";
        st.smokerSource = "manual";
      } else if(field === "programMode"){
        st.programMode = raw || "base";
      } else {
        return;
      }
      st.result = null;
      st.error = null;
      st.dirtySinceSave = true;
      try { sim._render(); } catch(err){
        try { console.error("GI_SIM_SEG_RENDER_FAILED", fieldPrefix, err); } catch(_e){}
      }
    });
  }

// ===== GI-PHX-RISK-SIM 2026-08-08 · סימולטור ריסק הפניקס =====================
  // תוסף עצמאי ומבודד לשלב 5 (פוליסות חדשות) — לא נוגע בשום קוד קיים של Wizard.
  // מקור התעריפים: "תעריפי ריסק פניקס.pdf" (תעריף ריסק, גרסה 05.2026) — פרמיה
  // שנתית לכל 1,000 ₪ סכום ביטוח, לפי גיל כניסה בודד (18–79), מין ומעשן/לא מעשן.
  // זהו מקור האמת היחיד לתמחור ריסק הפניקס בסימולטור הזה — אין להמציא, לקרב
  // או להשלים ערך שאינו רשום כאן במפורש. כל עדכון תעריפים עתידי מהחברה חייב
  // לעדכן רק את הטבלה הזו, ולא שום היגיון אחר.
  //
  // [age, maleNonSmoker, maleSmoker, femaleNonSmoker, femaleSmoker] — פרמיה שנתית ל-1,000 ₪
  const PHOENIX_RISK_RATE_TABLE = [
    [18, 0.84, 1.21, 0.80, 1.15], [19, 0.84, 1.21, 0.80, 1.15], [20, 0.84, 1.21, 0.80, 1.15],
    [21, 0.84, 1.21, 0.80, 1.15], [22, 0.84, 1.21, 0.80, 1.15], [23, 0.84, 1.21, 0.80, 1.15],
    [24, 0.84, 1.21, 0.80, 1.15], [25, 0.84, 1.21, 0.80, 1.15], [26, 0.84, 1.21, 0.80, 1.15],
    [27, 0.84, 1.21, 0.80, 1.15], [28, 0.84, 1.21, 0.80, 1.15], [29, 0.84, 1.21, 0.80, 1.15],
    [30, 0.84, 1.21, 0.80, 1.15], [31, 0.84, 1.21, 0.80, 1.15], [32, 0.84, 1.25, 0.80, 1.15],
    [33, 0.84, 1.29, 0.80, 1.15], [34, 0.84, 1.33, 0.80, 1.15], [35, 0.84, 1.38, 0.80, 1.15],
    [36, 0.84, 1.43, 0.80, 1.15], [37, 0.87, 1.51, 0.80, 1.15], [38, 0.92, 1.60, 0.80, 1.15],
    [39, 0.97, 1.71, 0.80, 1.15], [40, 1.03, 1.83, 0.80, 1.21], [41, 1.10, 1.97, 0.84, 1.34],
    [42, 1.17, 2.12, 0.90, 1.48], [43, 1.25, 2.30, 0.96, 1.64], [44, 1.34, 2.50, 1.04, 1.82],
    [45, 1.46, 2.76, 1.13, 2.05], [46, 1.59, 3.05, 1.23, 2.30], [47, 1.73, 3.38, 1.34, 2.58],
    [48, 1.90, 3.77, 1.47, 2.91], [49, 2.09, 4.21, 1.61, 3.28], [50, 2.31, 4.71, 1.77, 3.70],
    [51, 2.55, 5.28, 1.95, 4.17], [52, 2.83, 5.93, 2.15, 4.71], [53, 3.14, 6.67, 2.38, 5.31],
    [54, 3.50, 7.51, 2.64, 5.99], [55, 3.90, 8.46, 2.92, 6.76], [56, 4.36, 9.54, 3.25, 7.62],
    [57, 4.87, 10.75, 3.61, 8.59], [58, 5.46, 12.12, 4.02, 9.67], [59, 6.13, 13.66, 4.48, 10.89],
    [60, 6.88, 15.38, 4.99, 12.24], [61, 7.74, 17.31, 5.57, 13.76], [62, 8.70, 19.46, 6.22, 15.45],
    [63, 9.80, 21.86, 6.95, 17.33], [64, 11.04, 24.54, 7.77, 19.42], [65, 12.45, 27.51, 8.70, 21.74],
    [66, 14.05, 30.80, 9.73, 24.31], [67, 15.85, 34.44, 10.90, 27.16], [68, 17.89, 38.46, 12.20, 30.31],
    [69, 20.21, 42.89, 13.67, 33.78], [70, 22.82, 47.76, 15.32, 37.61], [71, 25.78, 53.10, 17.17, 41.82],
    [72, 29.12, 58.94, 19.25, 46.45], [73, 32.90, 65.31, 21.58, 51.53], [74, 34.88, 67.80, 22.71, 53.56],
    [75, 37.11, 70.53, 23.99, 55.81], [76, 41.92, 77.76, 26.90, 61.67], [77, 47.35, 85.58, 30.16, 68.05],
    [78, 53.47, 94.02, 33.82, 74.98], [79, 60.36, 103.11, 37.92, 82.51]
  ];

  const PHOENIX_RISK_RATE_MAP = new Map(
    PHOENIX_RISK_RATE_TABLE.map((row) => [row[0], {
      maleNonSmoker: row[1], maleSmoker: row[2], femaleNonSmoker: row[3], femaleSmoker: row[4]
    }])
  );

  const PHOENIX_RISK_AGE_OPTIONS = PHOENIX_RISK_RATE_TABLE.map((row) => row[0]);
  const PHOENIX_RISK_MIN_AGE = PHOENIX_RISK_AGE_OPTIONS[0];
  const PHOENIX_RISK_MAX_AGE = PHOENIX_RISK_AGE_OPTIONS[PHOENIX_RISK_AGE_OPTIONS.length - 1];

  /** התאמה מדויקת בלבד — ללא קירוב/השלמה. מחזיר {ok:false, reason} אם אין התאמה. */
  function lookupPhoenixRiskRate({ age, gender, smoker }){
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    const row = PHOENIX_RISK_RATE_MAP.get(ageNum);
    if(!row) return { ok:false, reason:"age_out_of_range" };
    const genderKey = gender === "זכר" ? "male" : (gender === "נקבה" ? "female" : "");
    if(!genderKey) return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const rate = row[genderKey + (smoker ? "Smoker" : "NonSmoker")];
    if(typeof rate !== "number" || !Number.isFinite(rate)) return { ok:false, reason:"rate_missing" };
    return { ok:true, ratePerMille: rate };
  }

  /** פרמיה שנתית = (סכום ביטוח / 1000) × תעריף; חודשית = שנתית / 12. חישוב
      בעשרות-אגורות שלמות למניעת שגיאות float בינאריות — אין כאן שום עיגול עסקי. */
  function computePhoenixRiskPremium({ age, gender, smoker, sumInsured }){
    const lookup = lookupPhoenixRiskRate({ age, gender, smoker });
    if(!lookup.ok) return lookup;
    const sum = Number(sumInsured);
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const rateCenti = Math.round(lookup.ratePerMille * 100); // אגורות ל-1,000 ₪ (התעריף נתון ב-2 ספרות עשרוניות בדוח)
    const annualPremium = (rateCenti * sum) / 100000; // (rateCenti/100) * sum / 1000
    const monthlyPremium = annualPremium / 12;
    return { ok:true, ratePerMille: lookup.ratePerMille, annualPremium, monthlyPremium };
  }

  /** תצוגת סכום מדויקת — ללא כלל עיגול עסקי. מציגה עד 4 ספרות עשריות ומקצצת
      אפסים מובילים, אך לא פחות מ-2 ספרות (סטנדרט תצוגת מטבע). */
  function formatPhoenixExactAmount(n){
    if(!Number.isFinite(n)) return "";
    let s = n.toFixed(4);
    if(s.indexOf(".") !== -1){
      s = s.replace(/0+$/, "");
      if(s.endsWith(".")) s += "00";
      else if(s.split(".")[1].length === 1) s += "0";
    }
    return s;
  }

  const PHOENIX_RISK_SIM_MISSING_MESSAGES = {
    age_missing: "יש לבחור גיל לפני חישוב הפרמיה.",
    age_out_of_range: `לא נמצא תעריף מתאים לגיל שהוזן (התעריפון מכיל גילאים ${PHOENIX_RISK_MIN_AGE}–${PHOENIX_RISK_MAX_AGE} בלבד).`,
    gender_missing: "יש להזין מין לפני חישוב הפרמיה.",
    smoker_missing: "יש לציין האם המבוטח מעשן/ת לפני חישוב הפרמיה.",
    sum_missing: "יש להזין סכום ביטוח תקין (גדול מאפס) לפני חישוב הפרמיה.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו."
  };

  // RiskSimulators + ensureGiSimulatorStylesLoaded provided by host

;

  /** מפרמט קלט "סכום ביטוח" לתצוגה עם פסיקים בין שלשות ספרות בזמן ההקלדה
      (למשל "50000" -> "50,000"), כדי שיהיה ברור מיידית כמה אפסים הוזנו בפועל
      ותימנע טעות של אפס חסר/עודף. משמש בכל סימולטורי הריסק. לא משפיע על
      החישוב עצמו — _calc בכל סימולטור ממשיך לנקות תווים שאינם ספרות לפני
      ההמרה למספר. */
  function formatRiskSimSumInsuredDigits(raw){
    const digits = String(raw == null ? "" : raw).replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
    if(!digits) return "";
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /** מחשב גיל נוכחי (שנים שלמות) מתאריך לידה, כדי לשאוב אוטומטית את גיל המבוטח
      משלב 1 (פרטים אישיים) לתוך סימולטורי הריסק — בדיוק כמו ששואבים מין/עישון.
      משתמש ב-parseBirthDateValue הגלובלי הקיים (אותו parser המשמש גם את
      Wizard.calcAge בשאר האפליקציה, כדי לתמוך באותם פורמטי תאריך: dd/mm/yyyy
      וכו'). מחזיר null אם התאריך חסר/לא תקין — לעולם לא מנחש/מקרב גיל. */
  function riskSimAgeFromBirthDate(dateStr){
    const parsed = (typeof parseBirthDateValue === "function") ? parseBirthDateValue(dateStr) : null;
    if(!parsed || !parsed.date) return null;
    const birth = parsed.date;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const mm = now.getMonth() - birth.getMonth();
    if(mm < 0 || (mm === 0 && now.getDate() < birth.getDate())) age--;
    return Number.isFinite(age) ? age : null;
  }

  /** המרה לתצוגת <input type="date"> (yyyy-mm-dd) מתאריך האפליקציה (dd/mm/yyyy וכו'). */
  function riskSimBirthDateToIsoInput(dateStr){
    const parsed = (typeof parseBirthDateValue === "function") ? parseBirthDateValue(dateStr) : null;
    if(!parsed) return "";
    return `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
  }

  /** המרה מ-yyyy-mm-dd (לוח שנה) ל-dd/mm/yyyy לשימוש ב-parseBirthDateValue / שמירה מקומית. */
  function riskSimBirthDateFromIsoInput(iso){
    const s = safeTrim(iso);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if(!m) return "";
    return formatDmyFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  /** מספר ימים שלמים מאז תאריך הלידה עד היום (לחישוב מינ׳ כניסה של 15 ימים). */
  function riskSimDaysSinceBirth(dateStr){
    const parsed = (typeof parseBirthDateValue === "function") ? parseBirthDateValue(dateStr) : null;
    if(!parsed || !parsed.date) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const birth = new Date(parsed.date.getFullYear(), parsed.date.getMonth(), parsed.date.getDate());
    const days = Math.floor((today - birth) / 86400000);
    return Number.isFinite(days) ? days : null;
  }

  function riskSimIsoDateToday(){
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }

  function riskSimIsoDateDaysAgo(daysAgo){
    const n = new Date();
    n.setHours(0, 0, 0, 0);
    n.setDate(n.getDate() - Number(daysAgo || 0));
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }

  /**
   * מסנכרן st.birthDate → st.age (שנים שלמות היום) + בדיקת מינ׳ ימי כניסה.
   * לא מנחש גיל: בלי תאריך לידה תקין — age ריק.
   */
  function riskSimSyncAgeFromBirthDate(st, { minAge, maxAge, minEntryDays }){
    if(!st) return { ok:false, reason:"birth_missing" };
    const bd = safeTrim(st.birthDate || "");
    const days = bd ? riskSimDaysSinceBirth(bd) : null;
    const age = bd ? riskSimAgeFromBirthDate(bd) : null;
    st.ageRaw = age;
    st.entryDays = days;
    if(!bd || days == null || !Number.isInteger(age)){
      st.age = "";
      return { ok:false, reason:"birth_missing" };
    }
    if(Number.isInteger(minEntryDays) && days < minEntryDays){
      st.age = "";
      return { ok:false, reason:"entry_too_young", entryDays: days, minEntryDays };
    }
    if(age < minAge || age > maxAge){
      st.age = "";
      return { ok:false, reason:"age_out_of_range", age };
    }
    st.age = String(age);
    return { ok:true, age, days };
  }

  // ===== GI-RISK-SIM-OCCUPATION 2026-08-08 · "פרטי מקצוע וחיתום" ==================
  // תשתית לזיהוי סיכון מקצועי + כללי חיתום, לשימוש בכל סימולטורי הריסק.
  //
  // ריק בכוונה — נכון לעכשיו אין במערכת (ולא בקבצי המקור/PDF/Supabase) שום
  // טבלת חיתום/סיכון-מקצועי אמיתית. אסור להמציא נתונים, לכן שתי הטבלאות
  // הבאות מתחילות ריקות. כאשר יתקבלו כללי חיתום אמיתיים מהחברות, יש להוסיף
  // להן שורות בדיוק לפי המבנה המתועד — שום שינוי קוד נוסף לא יידרש.

  /** סיווג סיכון מקצועי כללי (לא תלוי חברה/מוצר) — לפי מחרוזת המקצוע המדויקת
      כפי שהיא מוזנת/נבחרת בשלב 1 (ins.data.occupation).
      מבנה כל רשומה: { hasRisk: "yes" | "no" | "unclear", level: "רגיל" | "בינוני" | "גבוה" }
      (level רלוונטי/נדרש רק כאשר hasRisk === "yes").
      דוגמה (להמחשת המבנה בלבד — לא נתון אמיתי, לא להזין כך בפועל):
      "טייס": { hasRisk: "yes", level: "גבוה" } */
  const OCCUPATION_RISK_LEVELS = {
    // ריק בכוונה — ממתין לנתוני חיתום אמיתיים.
  };

  /** כללי חיתום ספציפיים לפי (חברה + מוצר + מקצוע) — כי אותו מקצוע יכול לקבל
      תוצאה שונה בין חברות/מוצרים שונים. מפתח: `${company}|${product}|${occupation}`.
      מבנה כל רשומה: {
        status: "auto" | "needsUnderwriting",
        loadingText?: string,   // תוספת/השפעה על הפרמיה — רק אם קיים נתון מאומת
        exclusionText?: string  // החרגה — רק אם קיימת
      }
      status "needsUnderwriting" — כלל קיים ומפורש שאומר שנדרשת בדיקת חיתום ידנית
      (לא לבלבל עם "לא נמצא כלל" — זהו כלל שנמצא ומגדיר זאת באופן מפורש). */
  const OCCUPATION_UNDERWRITING_RULES = {
    // ריק בכוונה — ממתין לכללי חיתום אמיתיים מהחברות.
  };

  function occupationUnderwritingRuleKey(company, product, occupation){
    return safeTrim(company) + "|" + safeTrim(product) + "|" + safeTrim(occupation);
  }

  /** מעריך את מצב הסיכון המקצועי/החיתום עבור מבוטח נתון, לפי:
      מבוטח → מקצוע → חברה שנבחרה → מוצר שנבחר → כלל חיתום מתאים → תוצאה.
      לעולם לא ממציא/מקרב פרומיל, תוספת, החרגה או כלל חיתום — כל שדה מוצג
      רק אם יש לו נתון מאומת בטבלאות שלמעלה. מחזיר אובייקט תיאורי לרינדור:
      { occupation, state, level, loadingText, exclusionText, fallbackText }
      state ∈ "none" (אין סיכון) | "risk" (יש סיכון, יש כלל אוטומטי) |
             "unclear" (אין מספיק מידע) | "needsUnderwriting" (נדרש חיתום). */
  function assessOccupationRisk(occupation, company, product){
    const occ = safeTrim(occupation);
    if(!occ){
      return { occupation: "", state: "unclear", level: null, loadingText: "", exclusionText: "", fallbackText: "יש להזין עיסוק כדי לבדוק סיכון מקצועי / תוספת חיתום." };
    }
    const classification = Object.prototype.hasOwnProperty.call(OCCUPATION_RISK_LEVELS, occ) ? OCCUPATION_RISK_LEVELS[occ] : null;
    if(!classification || classification.hasRisk === "unclear"){
      return { occupation: occ, state: "unclear", level: null, loadingText: "", exclusionText: "", fallbackText: "לא נמצא סיווג סיכון מקצועי עבור מקצוע זה — נדרש בירור." };
    }
    if(classification.hasRisk === "no"){
      return { occupation: occ, state: "none", level: null, loadingText: "", exclusionText: "", fallbackText: "" };
    }
    // classification.hasRisk === "yes" מכאן ואילך
    const level = classification.level || null;
    const ruleKey = occupationUnderwritingRuleKey(company, product, occ);
    const rule = Object.prototype.hasOwnProperty.call(OCCUPATION_UNDERWRITING_RULES, ruleKey) ? OCCUPATION_UNDERWRITING_RULES[ruleKey] : null;
    if(!rule || rule.status === "needsUnderwriting"){
      return {
        occupation: occ, state: "needsUnderwriting", level,
        loadingText: "", exclusionText: "",
        fallbackText: "נדרש חיתום – לא נמצא כלל תמחור אוטומטי למקצוע זה."
      };
    }
    return {
      occupation: occ, state: "risk", level,
      loadingText: safeTrim(rule.loadingText || ""),
      exclusionText: safeTrim(rule.exclusionText || ""),
      fallbackText: ""
    };
  }

  /** מרנדר את בלוק "פרטי מקצוע וחיתום" בתוך סימולטור ריסק. prefix = קידומת ה-CSS
      המסוגננת של הסימולטור הקורא ("lcPhxSim" או "lcMnrSim"), כדי שהעיצוב יישאר
      מבודד לחלוטין לכל סימולטור ולא ישפיע על מסכים אחרים. */
  function renderOccupationRiskBlockHtml(assessment, prefix){
    const a = assessment || {};
    const badge = a.state === "none" ? { emoji: "🟢", cls: "none", title: "סיכון מקצועי: לא" }
      : a.state === "risk" ? { emoji: "🟠", cls: "risk", title: "סיכון מקצועי: כן" }
      : a.state === "needsUnderwriting" ? { emoji: "🔴", cls: "needsUnderwriting", title: "נדרש חיתום" }
      : { emoji: "🔵", cls: "unclear", title: "נדרש בירור" };

    const rows = [];
    if(a.occupation) rows.push(`<div class="${prefix}__occRow"><span>מקצוע המבוטח</span><strong>${escapeHtml(a.occupation)}</strong></div>`);
    if(a.state === "risk" || a.state === "needsUnderwriting"){
      if(a.level) rows.push(`<div class="${prefix}__occRow"><span>רמת סיכון</span><strong>${escapeHtml(a.level)}</strong></div>`);
    }
    if(a.state === "risk"){
      if(a.loadingText) rows.push(`<div class="${prefix}__occRow"><span>השפעה על הפרמיה / תוספת מקצועית</span><strong>${escapeHtml(a.loadingText)}</strong></div>`);
      if(a.exclusionText) rows.push(`<div class="${prefix}__occRow"><span>החרגה</span><strong>${escapeHtml(a.exclusionText)}</strong></div>`);
    }
    if(a.fallbackText) rows.push(`<div class="${prefix}__occNote">${escapeHtml(a.fallbackText)}</div>`);

    return `
      <div class="${prefix}__occBox">
        <div class="${prefix}__occHead">פרטי מקצוע וחיתום</div>
        <div class="${prefix}__occBadge ${prefix}__occBadge--${badge.cls}"><span>${badge.emoji}</span><span>${escapeHtml(badge.title)}</span></div>
        ${rows.join("")}
      </div>`;
  }

  /** קומפוננטת סימולטור ריסק הפניקס — מודאל עצמאי, לא תלוי במבנה הפנימי של
      Wizard.renderStep5 מעבר לממשק open(ctx)/onApply. */
  const PhoenixRiskSimulator = {
    _modal: null,
    _ctx: null,
    _state: {},
    _activeInsuredId: null,
    _escHandler: null,
    _confirmSwitch: null,
    _showFinalSummary: false,

    open(ctx){
      this.close();
      this._ctx = ctx || {};
      const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
      this._state = {};
      insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
      this._activeInsuredId = insureds[0]?.id || null;
      this._confirmSwitch = null;
      this._showFinalSummary = false;
      this._mount();
      this._render();
    },

    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : null);
      const computedAge = riskSimAgeFromBirthDate(d.birthDate);
      const ageInRange = Number.isInteger(computedAge) && computedAge >= PHOENIX_RISK_MIN_AGE && computedAge <= PHOENIX_RISK_MAX_AGE;
      const occupation = safeTrim(d.occupation || "");
      return {
        age: ageInRange ? String(computedAge) : "",
        ageSource: ageInRange ? "step1" : "",
        ageRaw: computedAge,
        gender, genderSource: gender ? "step1" : "",
        smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "",
        occupation,
        occupationSource: occupation ? "step1" : "",
        sumInsured: "",
        result: null,
        error: null,
        savedAt: null,
        dirtySinceSave: false
      };
    },

    /** נקודת הרחבה: קובע אם מבוטח נתון רלוונטי לסימולטור הזה. כברירת מחדל כולם
        רלוונטיים — הנציג כבר בחר אותם בשלב 3 עבור המוצר הנוכחי, ואין כיום כלל
        עסקי קיים במערכת שממעט מבוטחים מסוימים (למשל ילדים) מריסק, ולכן לא
        מומצא כזה. אם בעתיד יתברר שיש כלל כזה, יש לממש אותו כאן בלבד. */
    _isInsuredRelevant(_ins){
      return true;
    },

    close(){
      if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
      if(this._modal){
        const m = this._modal;
        m.classList.add("giValModal--leaving");
        window.setTimeout(() => m.remove(), 200);
        this._modal = null;
      }
      this._ctx = null;
    },

    _mount(){
      const modal = document.createElement("div");
      modal.id = "lcPhxSimModal";
      modal.className = "giValModal lcPhxSimModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור ריסק הפניקס");
      document.body.appendChild(modal);
      this._modal = modal;
      this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
      document.addEventListener("keydown", this._escHandler);
      requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
    },

    _getInsuredLabel(insId){
      const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
      return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
    },

    _getActiveInsured(){
      return (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === this._activeInsuredId) || null;
    },

    _render(){
      if(!this._modal) return;
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
      const isMulti = insureds.length > 1;

      if(this._showFinalSummary){
        this._renderFinalSummary(insureds);
        return;
      }

      const activeId = this._activeInsuredId;
      const st = this._state[activeId] || this._prefillFromInsured(null);
      const isStandalone = !!this._ctx?.standalone;

      const tabsHtml = isMulti ? `<div class="lcPhxSim__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? ' has-saved' : (s?.result ? ' has-result' : '');
        return `<button type="button" class="lcPhxSim__tab${ins.id === activeId ? ' is-active' : ''}${statusCls}" data-phx-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? ' 🟢' : ''}</button>`;
      }).join("")}</div>` : "";

      const statusListHtml = isMulti ? `
        <div class="lcPhxSim__statusList">
          <div class="lcPhxSim__statusListTitle">מבוטחים בהצעה</div>
          ${insureds.map((ins) => {
            const s = this._state[ins.id];
            const label = escapeHtml(safeTrim(ins.label) || "מבוטח");
            if(!this._isInsuredRelevant(ins)) return `<div class="lcPhxSim__statusRow"><span>⚪</span><span>${label} – לא נדרש סימולטור עבור מבוטח זה</span></div>`;
            if(s?.savedAt) return `<div class="lcPhxSim__statusRow"><span>🟢</span><span>${label} – נשמר</span></div>`;
            return `<div class="lcPhxSim__statusRow"><span>🟡</span><span>${label} – טרם חושב</span></div>`;
          }).join("")}
        </div>` : "";

      const ageOptionsHtml = `<option value="">בחר גיל…</option>` + PHOENIX_RISK_AGE_OPTIONS.map((a) =>
        `<option value="${a}"${String(st.age) === String(a) ? " selected" : ""}>${a}</option>`
      ).join("");

      /* במצב עצמאי אין פרטים אישיים — לא מציגים אזהרות "לא נמצא בפרטים". באשף נשאר כפי שהיה. */
      const ageHintHtml = (isStandalone || st.age)
        ? ""
        : (Number.isInteger(st.ageRaw)
            ? `<div class="lcPhxSim__hint lcPhxSim__hint--warn">הגיל המחושב מתאריך הלידה (${st.ageRaw}) חורג מטווח התעריפון (${PHOENIX_RISK_MIN_AGE}–${PHOENIX_RISK_MAX_AGE}) — יש לבחור גיל ידנית</div>`
            : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">לא נמצא תאריך לידה תקין בפרטים האישיים — יש לבחור גיל</div>`);

      const genderHintHtml = (isStandalone || st.gender)
        ? ""
        : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">לא נמצא מין בפרטים האישיים — יש לבחור</div>`;
      const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false)
        ? ""
        : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">לא נמצא סטטוס עישון בפרטים האישיים — יש לבחור</div>`;

      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "🛡️";
      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcPhxSim");

      const resultHtml = st.error
        ? `<div class="lcPhxSim__result lcPhxSim__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcPhxSim__result lcPhxSim__result--ok">
            <div class="lcPhxSim__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatPhoenixExactAmount(st.result.annualPremium))}</strong></div>
            <div class="lcPhxSim__resultRow lcPhxSim__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatPhoenixExactAmount(st.result.monthlyPremium))}</strong></div>
          </div>` : "");

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcPhxSim__foot">
            <button type="button" class="btn btn--primary" data-phx-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcPhxSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-phx-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-phx-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcPhxSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-phx-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-phx-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-phx-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcPhxSim__overlay">
          <div class="lcPhxSim__overlayCard">
            <div class="lcPhxSim__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcPhxSim__overlayBtns">
              <button type="button" class="btn btn--primary" data-phx-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-phx-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-phx-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-phx-close="1"></div>
        <div class="giValModal__card lcPhxSim__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור ריסק הפניקס</div>
            </div>
            <button type="button" class="lcPhxSim__closeX" data-phx-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcPhxSim__body">
            ${statusListHtml}
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcPhxSim__insuredLabel lcPhxSim__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcPhxSim__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcPhxSim__grid">
              <div class="lcPhxSim__field">
                <label class="lcPhxSim__label">גיל (${PHOENIX_RISK_MIN_AGE}–${PHOENIX_RISK_MAX_AGE})</label>
                <select class="lcPhxSim__input" data-phx-field="age">${ageOptionsHtml}</select>
                ${ageHintHtml}
              </div>
              <div class="lcPhxSim__field">
                <label class="lcPhxSim__label">מין</label>
                <div class="lcPhxSim__segmented">
                  <button type="button" class="lcPhxSim__segBtn${st.gender === 'זכר' ? ' is-active' : ''}" data-phx-field="gender" data-phx-value="זכר">זכר</button>
                  <button type="button" class="lcPhxSim__segBtn${st.gender === 'נקבה' ? ' is-active' : ''}" data-phx-field="gender" data-phx-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcPhxSim__field">
                <label class="lcPhxSim__label">עישון</label>
                <div class="lcPhxSim__segmented">
                  <button type="button" class="lcPhxSim__segBtn${st.smoker === false ? ' is-active' : ''}" data-phx-field="smoker" data-phx-value="0">לא מעשן/ת</button>
                  <button type="button" class="lcPhxSim__segBtn${st.smoker === true ? ' is-active' : ''}" data-phx-field="smoker" data-phx-value="1">מעשן/ת</button>
                </div>
                ${smokerHintHtml}
              </div>
              <div class="lcPhxSim__field lcPhxSim__field--wide">
                <label class="lcPhxSim__label">סכום ביטוח (₪)</label>
                <input class="lcPhxSim__input" type="text" inputmode="numeric" data-phx-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="לדוגמה: 1,000,000" />
              </div>
              <div class="lcPhxSim__field lcPhxSim__field--wide">
                <label class="lcPhxSim__label">עיסוק</label>
                <input class="lcPhxSim__input" type="text" data-phx-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            ${occBlockHtml}
            <button type="button" class="btn btn--secondary lcPhxSim__calcBtn" data-phx-calc="1">חשב פרמיה</button>
            ${resultHtml}
          </div>
          ${footHtml}
          ${confirmOverlayHtml}
        </div>`;

      this._bind();
    },

    _renderFinalSummary(insureds){
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const rows = relevant.map((ins) => {
        const ok = !!this._state[ins.id]?.savedAt;
        return `<div class="lcPhxSim__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-phx-close="1"></div>
        <div class="giValModal__card lcPhxSim__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">🛡️</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
              <div class="giValModal__sub">בדקו את הנתונים לפני האישור הסופי</div>
            </div>
            <button type="button" class="lcPhxSim__closeX" data-phx-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcPhxSim__body">
            <div class="lcPhxSim__statusListTitle">מבוטחים</div>
            ${rows}
          </div>
          <div class="giValModal__foot lcPhxSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-phx-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-phx-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "phx");
      $$("[data-phx-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-phx-tab]", modal).forEach((el) => on(el, "click", () => {
        this._switchInsured(el.getAttribute("data-phx-tab"));
      }));
      $$("[data-phx-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-phx-switch");
        const target = this._confirmSwitch?.targetId;
        this._confirmSwitch = null;
        if(action === "save"){
          this._saveActive();
          if(target) this._activeInsuredId = target;
          this._render();
        } else if(action === "discard"){
          if(target) this._activeInsuredId = target;
          this._render();
        } else {
          this._render();
        }
      }));
      const ageSel = modal.querySelector('[data-phx-field="age"]');
      if(ageSel) on(ageSel, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        st.age = ageSel.value;
        st.ageSource = "manual";
        st.result = null; st.error = null; st.dirtySinceSave = true;
        this._render();
      });
      const sumInput = modal.querySelector('[data-phx-field="sumInsured"]');
      if(sumInput) on(sumInput, "input", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        const formatted = formatRiskSimSumInsuredDigits(sumInput.value);
        sumInput.value = formatted;
        try { sumInput.setSelectionRange(formatted.length, formatted.length); } catch(_e){}
        st.sumInsured = formatted;
        st.result = null; st.error = null; st.dirtySinceSave = true;
      });
      const occInput = modal.querySelector('[data-phx-field="occupation"]');
      if(occInput){
        on(occInput, "input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.occupation = safeTrim(occInput.value);
          st.occupationSource = "manual";
          st.dirtySinceSave = true;
        });
        on(occInput, "change", () => this._render());
        on(occInput, "blur", () => this._render());
      }
      const calcBtn = modal.querySelector("[data-phx-calc]");
      if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
      const applyBtn = modal.querySelector("[data-phx-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-phx-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-phx-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => {
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
        if(!allSaved){
          window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור את הסימולטור עבור כל המבוטחים הרלוונטיים לפני האישור הסופי.", variant: "warn" });
          return;
        }
        this._showFinalSummary = true;
        this._render();
      });
      const summaryBackBtn = modal.querySelector("[data-phx-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-phx-summary-confirm]");
      if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => {
        try { this._ctx?.onFinalConfirm?.(); } catch(_e){}
        this.close();
      });
    },

    _switchInsured(targetId){
      if(!targetId || targetId === this._activeInsuredId) return;
      const st = this._state[this._activeInsuredId];
      if(st?.dirtySinceSave){
        this._confirmSwitch = { targetId };
        this._render();
        return;
      }
      this._activeInsuredId = targetId;
      this._render();
    },

    _calc(insuredId){
      const st = this._state[insuredId];
      if(!st) return;
      const sumNum = Number(String(st.sumInsured || "").replace(/[^\d.]/g, ""));
      const calc = computePhoenixRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: sumNum });
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        st.error = PHOENIX_RISK_SIM_MISSING_MESSAGES[calc.reason] || "לא נמצא תעריף מתאים לנתונים שהוזנו.";
      }
      st.dirtySinceSave = true;
      this._render();
    },

    _buildResultForInsured(insId){
      const st = this._state[insId];
      if(!st?.result?.ok) return null;
      return {
        sumInsured: st.sumInsured,
        monthlyPremium: st.result.monthlyPremium,
        annualPremium: st.result.annualPremium,
        ratePerMille: st.result.ratePerMille,
        age: st.age, ageSource: st.ageSource, gender: st.gender, smoker: st.smoker,
        genderSource: st.genderSource, smokerSource: st.smokerSource,
        occupation: st.occupation || "", occupationSource: st.occupationSource || ""
      };
    },

    _apply(){
      const results = {};
      Object.keys(this._state).forEach((insId) => {
        const r = this._buildResultForInsured(insId);
        if(r) results[insId] = r;
      });
      if(!Object.keys(results).length){
        window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה לפחות למבוטח אחד לפני ההחלה על הפוליסה.", variant: "warn" });
        return;
      }
      const onApply = this._ctx?.onApply;
      this.close();
      try { onApply?.(results); } catch(_e) {}
    },

    _saveActive(){
      const insId = this._activeInsuredId;
      const result = this._buildResultForInsured(insId);
      if(!result){
        window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה עבור מבוטח זה לפני השמירה.", variant: "warn" });
        return;
      }
      try { this._ctx?.onApply?.({ [insId]: result }); } catch(_e) {}
      const st = this._state[insId];
      if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
      window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
      this._render();
    }
  };

  RiskSimulators.register("הפניקס", "ריסק", PhoenixRiskSimulator);
  // ===== סוף GI-PHX-RISK-SIM =====================================================

  // ===== GI-MNR-RISK-SIM: סימולטור ריסק מנורה מבטחים =============================
  // מפת התעריפים הרשמית של מנורה מבטחים לביטוח ריסק. שתי מדרגות סכום ביטוח:
  // "עד חצי מיליון ₪" (כולל 500,000 בדיוק) ו"מעל חצי מיליון ₪". התעריף בכל טבלה
  // הוא פרמיה **חודשית** (לא שנתית — בשונה מהפניקס!) לכל 100,000 ₪ סכום ביטוח,
  // לפי גיל כניסה בודד (18–79), מין ומעשן/לא מעשן. זהו מקור האמת היחיד לתמחור
  // ריסק מנורה בסימולטור הזה — אין להמציא, לקרב או להשלים ערך שאינו רשום כאן
  // במפורש. כל עדכון תעריפים עתידי מהחברה חייב לעדכן רק את הטבלאות האלה.
  //
  // [age, maleNonSmoker, maleSmoker, femaleNonSmoker, femaleSmoker] — פרמיה חודשית ל-100,000 ₪
  const MENORA_RISK_RATE_TABLE_LE500K = [
    [18, 7.40, 11.34, 4.62, 6.03], [19, 7.08, 10.90, 4.62, 5.85], [20, 6.86, 8.85, 4.62, 5.85],
    [21, 6.58, 8.68, 4.62, 5.85], [22, 6.64, 8.69, 4.62, 5.85], [23, 6.47, 8.53, 4.62, 5.85],
    [24, 6.31, 8.46, 4.62, 5.85], [25, 6.20, 8.42, 4.62, 5.85], [26, 5.97, 8.35, 4.67, 5.85],
    [27, 5.92, 8.27, 4.67, 5.97], [28, 6.04, 8.24, 4.73, 5.97], [29, 6.17, 8.19, 4.83, 6.25],
    [30, 6.26, 8.10, 5.04, 6.47], [31, 6.41, 8.30, 5.28, 6.69], [32, 6.47, 8.46, 5.50, 7.03],
    [33, 6.71, 8.74, 5.76, 7.30], [34, 6.99, 9.18, 6.04, 7.69], [35, 7.23, 9.63, 6.27, 8.24],
    [36, 7.77, 10.29, 6.55, 8.75], [37, 8.14, 11.06, 6.83, 9.26], [38, 8.49, 11.88, 7.34, 9.88],
    [39, 8.74, 13.11, 7.62, 10.56], [40, 9.24, 14.38, 8.15, 11.29], [41, 9.89, 15.82, 8.80, 12.76],
    [42, 10.62, 17.25, 9.39, 14.14], [43, 11.27, 19.25, 10.19, 15.62], [44, 12.36, 21.41, 10.86, 17.51],
    [45, 13.44, 23.56, 11.63, 19.24], [46, 14.79, 26.14, 12.33, 21.58], [47, 16.20, 28.95, 13.20, 24.04],
    [48, 17.83, 33.02, 14.26, 27.03], [49, 19.87, 36.54, 15.31, 30.04], [50, 22.41, 42.20, 16.87, 33.80],
    [51, 24.73, 48.07, 18.18, 38.05], [52, 27.60, 53.52, 19.69, 42.32], [53, 30.57, 60.89, 21.34, 47.50],
    [54, 33.82, 69.13, 23.20, 53.38], [55, 36.66, 76.44, 24.98, 59.89], [56, 40.57, 87.26, 27.61, 65.79],
    [57, 44.93, 97.04, 30.20, 73.17], [58, 50.44, 109.21, 33.03, 80.55], [59, 55.82, 122.06, 36.55, 89.60],
    [60, 61.78, 136.25, 39.63, 99.76], [61, 69.27, 147.66, 43.94, 109.97], [62, 76.58, 159.87, 48.49, 121.17],
    [63, 84.70, 170.50, 53.30, 135.00], [64, 93.45, 205.21, 58.51, 148.97], [65, 106.28, 239.02, 64.42, 166.18],
    [66, 121.02, 280.78, 72.19, 184.04], [67, 137.66, 318.64, 82.09, 206.01], [68, 156.44, 356.81, 92.30, 230.47],
    [69, 168.41, 399.45, 104.08, 262.95], [70, 191.37, 445.22, 117.68, 290.06], [71, 217.38, 498.65, 133.02, 315.37],
    [72, 244.30, 544.29, 153.59, 341.55], [73, 274.85, 590.83, 181.09, 368.08], [74, 309.54, 631.09, 211.43, 394.43],
    [75, 349.19, 669.45, 247.13, 419.92], [76, 438.74, 704.53, 307.77, 443.85], [77, 534.39, 719.57, 338.70, 464.68],
    [78, 598.74, 741.16, 381.29, 481.09], [79, 672.07, 752.09, 430.15, 491.03]
  ];

  const MENORA_RISK_RATE_TABLE_GT500K = [
    [18, 7.03, 10.77, 4.39, 5.73], [19, 6.72, 10.35, 4.39, 5.56], [20, 6.52, 8.41, 4.39, 5.56],
    [21, 6.25, 8.25, 4.39, 5.56], [22, 6.31, 8.26, 4.39, 5.56], [23, 6.15, 8.11, 4.39, 5.56],
    [24, 5.99, 8.04, 4.39, 5.56], [25, 5.89, 8.00, 4.39, 5.56], [26, 5.68, 7.93, 4.44, 5.56],
    [27, 5.62, 7.85, 4.44, 5.67], [28, 5.74, 7.83, 4.49, 5.67], [29, 5.86, 7.78, 4.59, 5.94],
    [30, 5.94, 7.70, 4.79, 6.15], [31, 6.08, 7.88, 5.02, 6.36], [32, 6.14, 8.04, 5.23, 6.67],
    [33, 6.37, 8.30, 5.47, 6.94], [34, 6.64, 8.72, 5.73, 7.30], [35, 6.87, 9.14, 5.95, 7.83],
    [36, 7.38, 9.77, 6.22, 8.31], [37, 7.73, 10.51, 6.49, 8.79], [38, 8.07, 11.29, 6.97, 9.38],
    [39, 8.30, 12.45, 7.24, 10.03], [40, 8.78, 13.66, 7.74, 10.73], [41, 9.39, 15.03, 8.36, 12.12],
    [42, 10.09, 16.39, 8.92, 13.44], [43, 10.71, 18.29, 9.68, 14.84], [44, 11.75, 20.34, 10.31, 16.63],
    [45, 12.77, 22.38, 11.04, 18.28], [46, 14.05, 24.84, 11.71, 20.50], [47, 15.39, 27.50, 12.54, 22.84],
    [48, 16.94, 31.37, 13.54, 25.68], [49, 18.88, 34.71, 14.54, 28.54], [50, 21.29, 40.09, 16.03, 32.11],
    [51, 23.49, 45.67, 17.27, 36.15], [52, 26.22, 50.84, 18.71, 40.20], [53, 29.04, 57.84, 20.27, 45.13],
    [54, 32.13, 65.67, 22.04, 50.71], [55, 34.83, 72.62, 23.73, 56.90], [56, 38.54, 82.90, 26.23, 62.50],
    [57, 42.69, 92.19, 28.69, 69.51], [58, 47.91, 103.75, 31.38, 76.52], [59, 53.03, 115.96, 34.73, 85.12],
    [60, 58.69, 129.44, 37.65, 94.77], [61, 65.80, 140.27, 41.74, 104.47], [62, 72.75, 151.88, 46.06, 115.11],
    [63, 80.46, 161.98, 50.63, 128.25], [64, 88.78, 194.95, 55.59, 141.52], [65, 100.96, 227.07, 61.20, 157.87],
    [66, 114.97, 266.74, 68.58, 174.83], [67, 130.78, 302.71, 77.99, 195.71], [68, 148.62, 338.97, 87.69, 218.95],
    [69, 159.99, 379.47, 98.87, 249.80], [70, 181.81, 422.96, 111.79, 275.55], [71, 206.51, 473.72, 126.37, 299.60],
    [72, 232.09, 517.07, 145.91, 324.48], [73, 261.11, 561.29, 172.04, 349.68], [74, 294.07, 599.54, 200.85, 374.71],
    [75, 331.73, 635.98, 234.77, 398.93], [76, 416.80, 669.31, 292.38, 421.66], [77, 507.67, 683.59, 321.77, 441.44],
    [78, 568.80, 704.11, 362.23, 457.04], [79, 638.47, 714.48, 408.64, 466.48]
  ];

  function buildMenoraRiskRateMap(table){
    return new Map(table.map((row) => [row[0], {
      maleNonSmoker: row[1], maleSmoker: row[2], femaleNonSmoker: row[3], femaleSmoker: row[4]
    }]));
  }
  const MENORA_RISK_RATE_MAP_LE500K = buildMenoraRiskRateMap(MENORA_RISK_RATE_TABLE_LE500K);
  const MENORA_RISK_RATE_MAP_GT500K = buildMenoraRiskRateMap(MENORA_RISK_RATE_TABLE_GT500K);

  const MENORA_RISK_AGE_OPTIONS = MENORA_RISK_RATE_TABLE_LE500K.map((row) => row[0]);
  const MENORA_RISK_MIN_AGE = MENORA_RISK_AGE_OPTIONS[0];
  const MENORA_RISK_MAX_AGE = MENORA_RISK_AGE_OPTIONS[MENORA_RISK_AGE_OPTIONS.length - 1];
  const MENORA_RISK_BRACKET_THRESHOLD = 500000; // "עד חצי מיליון" — כולל 500,000 ₪ בדיוק במדרגה הראשונה

  /** התאמה מדויקת בלבד — ללא קירוב/השלמה. בוחר מדרגה לפי סכום הביטוח (עד/כולל
      500,000 ₪ → מדרגה 1; מעל 500,000 ₪ → מדרגה 2), ואז מחזיר את התעריף המדויק
      מהמדרגה הנכונה. מחזיר {ok:false, reason} אם אין התאמה. */
  function lookupMenoraRiskRate({ age, gender, smoker, sumInsured }){
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    const sum = Number(sumInsured);
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const bracket = sum <= MENORA_RISK_BRACKET_THRESHOLD ? "le500k" : "gt500k";
    const map = bracket === "le500k" ? MENORA_RISK_RATE_MAP_LE500K : MENORA_RISK_RATE_MAP_GT500K;
    const row = map.get(ageNum);
    if(!row) return { ok:false, reason:"age_out_of_range" };
    const genderKey = gender === "זכר" ? "male" : (gender === "נקבה" ? "female" : "");
    if(!genderKey) return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const rate = row[genderKey + (smoker ? "Smoker" : "NonSmoker")];
    if(typeof rate !== "number" || !Number.isFinite(rate)) return { ok:false, reason:"rate_missing" };
    return { ok:true, ratePerHundredThousand: rate, bracket };
  }

  /** פרמיה חודשית = (סכום ביטוח / 100,000) × תעריף — זהו מקור האמת מהטבלה.
      שנתית היא נגזרת תצוגה בלבד = חודשית × 12. חישוב באגורות שלמות של התעריף
      למניעת שגיאות float בינאריות — אין כאן שום עיגול עסקי. */
  function computeMenoraRiskPremium({ age, gender, smoker, sumInsured }){
    const lookup = lookupMenoraRiskRate({ age, gender, smoker, sumInsured });
    if(!lookup.ok) return lookup;
    const sum = Number(sumInsured);
    const rateCenti = Math.round(lookup.ratePerHundredThousand * 100); // אגורות ל-100,000 ₪ (תעריף ב-2 ספרות עשרוניות בדוח)
    const monthlyPremium = (rateCenti * sum) / 10000000; // (rateCenti/100) * (sum/100000)
    const annualPremium = monthlyPremium * 12;
    return {
      ok:true,
      ratePerHundredThousand: lookup.ratePerHundredThousand,
      bracket: lookup.bracket,
      monthlyPremium,
      annualPremium
    };
  }

  // תצוגת סכום מדויקת — ללא כלל עיגול עסקי. משתמשת בפורמט הגנרי הקיים (זהה לזה
  // שנבנה לסימולטור הפניקס, ואינו תלוי בנתוני הפניקס עצמם).
  const formatMenoraExactAmount = formatPhoenixExactAmount;

  const MENORA_RISK_BRACKET_LABELS = {
    le500k: "עד חצי מיליון ₪ (כולל)",
    gt500k: "מעל חצי מיליון ₪"
  };

  const MENORA_RISK_SIM_MISSING_MESSAGES = {
    age_missing: "יש לבחור גיל לפני חישוב הפרמיה.",
    age_out_of_range: `לא נמצא תעריף מתאים לגיל שהוזן (התעריפון מכיל גילאים ${MENORA_RISK_MIN_AGE}–${MENORA_RISK_MAX_AGE} בלבד).`,
    gender_missing: "יש להזין מין לפני חישוב הפרמיה.",
    smoker_missing: "יש לציין האם המבוטח מעשן/ת לפני חישוב הפרמיה.",
    sum_missing: "יש להזין סכום ביטוח תקין (גדול מאפס) לפני חישוב הפרמיה.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו."
  };

  /** קומפוננטת סימולטור ריסק מנורה — מודאל עצמאי, לא תלוי במבנה הפנימי של
      Wizard.renderStep5 מעבר לממשק open(ctx)/onApply. מבנה זהה לסימולטור
      הפניקס אך עם קידומת lcMnrSim ייחודית ותמיכה במדרגות סכום ביטוח. */
  const MenoraRiskSimulator = {
    _modal: null,
    _ctx: null,
    _state: {},
    _activeInsuredId: null,
    _escHandler: null,
    _confirmSwitch: null,
    _showFinalSummary: false,

    open(ctx){
      this.close();
      this._ctx = ctx || {};
      const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
      this._state = {};
      insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
      this._activeInsuredId = insureds[0]?.id || null;
      this._confirmSwitch = null;
      this._showFinalSummary = false;
      this._mount();
      this._render();
    },

    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : null);
      const computedAge = riskSimAgeFromBirthDate(d.birthDate);
      const ageInRange = Number.isInteger(computedAge) && computedAge >= MENORA_RISK_MIN_AGE && computedAge <= MENORA_RISK_MAX_AGE;
      const occupation = safeTrim(d.occupation || "");
      return {
        age: ageInRange ? String(computedAge) : "",
        ageSource: ageInRange ? "step1" : "",
        ageRaw: computedAge,
        gender, genderSource: gender ? "step1" : "",
        smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "",
        occupation,
        occupationSource: occupation ? "step1" : "",
        sumInsured: "",
        result: null,
        error: null,
        savedAt: null,
        dirtySinceSave: false
      };
    },

    /** נקודת הרחבה: קובע אם מבוטח נתון רלוונטי לסימולטור הזה. כברירת מחדל כולם
        רלוונטיים — הנציג כבר בחר אותם בשלב 3 עבור המוצר הנוכחי, ואין כיום כלל
        עסקי קיים במערכת שממעט מבוטחים מסוימים (למשל ילדים) מריסק, ולכן לא
        מומצא כזה. אם בעתיד יתברר שיש כלל כזה, יש לממש אותו כאן בלבד. */
    _isInsuredRelevant(_ins){
      return true;
    },

    close(){
      if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
      if(this._modal){
        const m = this._modal;
        m.classList.add("giValModal--leaving");
        window.setTimeout(() => m.remove(), 200);
        this._modal = null;
      }
      this._ctx = null;
    },

    _mount(){
      const modal = document.createElement("div");
      modal.id = "lcMnrSimModal";
      modal.className = "giValModal lcMnrSimModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור ריסק מנורה");
      document.body.appendChild(modal);
      this._modal = modal;
      this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
      document.addEventListener("keydown", this._escHandler);
      requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
    },

    _getInsuredLabel(insId){
      const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
      return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
    },

    _getActiveInsured(){
      return (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === this._activeInsuredId) || null;
    },

    _render(){
      if(!this._modal) return;
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
      const isMulti = insureds.length > 1;

      if(this._showFinalSummary){
        this._renderFinalSummary(insureds);
        return;
      }

      const activeId = this._activeInsuredId;
      const st = this._state[activeId] || this._prefillFromInsured(null);
      const isStandalone = !!this._ctx?.standalone;

      const tabsHtml = isMulti ? `<div class="lcMnrSim__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? ' has-saved' : (s?.result ? ' has-result' : '');
        return `<button type="button" class="lcMnrSim__tab${ins.id === activeId ? ' is-active' : ''}${statusCls}" data-mnr-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? ' 🟢' : ''}</button>`;
      }).join("")}</div>` : "";

      const statusListHtml = isMulti ? `
        <div class="lcMnrSim__statusList">
          <div class="lcMnrSim__statusListTitle">מבוטחים בהצעה</div>
          ${insureds.map((ins) => {
            const s = this._state[ins.id];
            const label = escapeHtml(safeTrim(ins.label) || "מבוטח");
            if(!this._isInsuredRelevant(ins)) return `<div class="lcMnrSim__statusRow"><span>⚪</span><span>${label} – לא נדרש סימולטור עבור מבוטח זה</span></div>`;
            if(s?.savedAt) return `<div class="lcMnrSim__statusRow"><span>🟢</span><span>${label} – נשמר</span></div>`;
            return `<div class="lcMnrSim__statusRow"><span>🟡</span><span>${label} – טרם חושב</span></div>`;
          }).join("")}
        </div>` : "";

      const ageOptionsHtml = `<option value="">בחר גיל…</option>` + MENORA_RISK_AGE_OPTIONS.map((a) =>
        `<option value="${a}"${String(st.age) === String(a) ? " selected" : ""}>${a}</option>`
      ).join("");

      const ageHintHtml = (isStandalone || st.age)
        ? ""
        : (Number.isInteger(st.ageRaw)
            ? `<div class="lcMnrSim__hint lcMnrSim__hint--warn">הגיל המחושב מתאריך הלידה (${st.ageRaw}) חורג מטווח התעריפון (${MENORA_RISK_MIN_AGE}–${MENORA_RISK_MAX_AGE}) — יש לבחור גיל ידנית</div>`
            : `<div class="lcMnrSim__hint lcMnrSim__hint--warn">לא נמצא תאריך לידה תקין בפרטים האישיים — יש לבחור גיל</div>`);

      const genderHintHtml = (isStandalone || st.gender)
        ? ""
        : `<div class="lcMnrSim__hint lcMnrSim__hint--warn">לא נמצא מין בפרטים האישיים — יש לבחור</div>`;
      const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false)
        ? ""
        : `<div class="lcMnrSim__hint lcMnrSim__hint--warn">לא נמצא סטטוס עישון בפרטים האישיים — יש לבחור</div>`;

      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "🛡️";
      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcMnrSim");

      const resultHtml = st.error
        ? `<div class="lcMnrSim__result lcMnrSim__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcMnrSim__result lcMnrSim__result--ok">
            <div class="lcMnrSim__resultRow"><span>מדרגת סכום ביטוח</span><strong>${escapeHtml(MENORA_RISK_BRACKET_LABELS[st.result.bracket] || "")}</strong></div>
            <div class="lcMnrSim__resultRow lcMnrSim__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatMenoraExactAmount(st.result.monthlyPremium))}</strong></div>
            <div class="lcMnrSim__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatMenoraExactAmount(st.result.annualPremium))}</strong></div>
          </div>` : "");

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcMnrSim__foot">
            <button type="button" class="btn btn--primary" data-mnr-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcMnrSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-mnr-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-mnr-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcMnrSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-mnr-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-mnr-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-mnr-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcMnrSim__overlay">
          <div class="lcMnrSim__overlayCard">
            <div class="lcMnrSim__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcMnrSim__overlayBtns">
              <button type="button" class="btn btn--primary" data-mnr-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-mnr-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-mnr-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-mnr-close="1"></div>
        <div class="giValModal__card lcMnrSim__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור ריסק מנורה</div>
            </div>
            <button type="button" class="lcMnrSim__closeX" data-mnr-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcMnrSim__body">
            ${statusListHtml}
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcMnrSim__insuredLabel lcMnrSim__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcMnrSim__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcMnrSim__grid">
              <div class="lcMnrSim__field">
                <label class="lcMnrSim__label">גיל (${MENORA_RISK_MIN_AGE}–${MENORA_RISK_MAX_AGE})</label>
                <select class="lcMnrSim__input" data-mnr-field="age">${ageOptionsHtml}</select>
                ${ageHintHtml}
              </div>
              <div class="lcMnrSim__field">
                <label class="lcMnrSim__label">מין</label>
                <div class="lcMnrSim__segmented">
                  <button type="button" class="lcMnrSim__segBtn${st.gender === 'זכר' ? ' is-active' : ''}" data-mnr-field="gender" data-mnr-value="זכר">זכר</button>
                  <button type="button" class="lcMnrSim__segBtn${st.gender === 'נקבה' ? ' is-active' : ''}" data-mnr-field="gender" data-mnr-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcMnrSim__field">
                <label class="lcMnrSim__label">עישון</label>
                <div class="lcMnrSim__segmented">
                  <button type="button" class="lcMnrSim__segBtn${st.smoker === false ? ' is-active' : ''}" data-mnr-field="smoker" data-mnr-value="0">לא מעשן/ת</button>
                  <button type="button" class="lcMnrSim__segBtn${st.smoker === true ? ' is-active' : ''}" data-mnr-field="smoker" data-mnr-value="1">מעשן/ת</button>
                </div>
                ${smokerHintHtml}
              </div>
              <div class="lcMnrSim__field lcMnrSim__field--wide">
                <label class="lcMnrSim__label">סכום ביטוח (₪)</label>
                <input class="lcMnrSim__input" type="text" inputmode="numeric" data-mnr-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="לדוגמה: 1,000,000" />
              </div>
              <div class="lcMnrSim__field lcMnrSim__field--wide">
                <label class="lcMnrSim__label">עיסוק</label>
                <input class="lcMnrSim__input" type="text" data-mnr-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            ${occBlockHtml}
            <button type="button" class="btn btn--secondary lcMnrSim__calcBtn" data-mnr-calc="1">חשב פרמיה</button>
            ${resultHtml}
          </div>
          ${footHtml}
          ${confirmOverlayHtml}
        </div>`;

      this._bind();
    },

    _renderFinalSummary(insureds){
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const rows = relevant.map((ins) => {
        const ok = !!this._state[ins.id]?.savedAt;
        return `<div class="lcMnrSim__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-mnr-close="1"></div>
        <div class="giValModal__card lcMnrSim__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">🛡️</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
              <div class="giValModal__sub">בדקו את הנתונים לפני האישור הסופי</div>
            </div>
            <button type="button" class="lcMnrSim__closeX" data-mnr-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcMnrSim__body">
            <div class="lcMnrSim__statusListTitle">מבוטחים</div>
            ${rows}
          </div>
          <div class="giValModal__foot lcMnrSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-mnr-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-mnr-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "mnr");
      $$("[data-mnr-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-mnr-tab]", modal).forEach((el) => on(el, "click", () => {
        this._switchInsured(el.getAttribute("data-mnr-tab"));
      }));
      $$("[data-mnr-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-mnr-switch");
        const target = this._confirmSwitch?.targetId;
        this._confirmSwitch = null;
        if(action === "save"){
          this._saveActive();
          if(target) this._activeInsuredId = target;
          this._render();
        } else if(action === "discard"){
          if(target) this._activeInsuredId = target;
          this._render();
        } else {
          this._render();
        }
      }));
      const ageSel = modal.querySelector('[data-mnr-field="age"]');
      if(ageSel) on(ageSel, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        st.age = ageSel.value;
        st.ageSource = "manual";
        st.result = null; st.error = null; st.dirtySinceSave = true;
        this._render();
      });
      const sumInput = modal.querySelector('[data-mnr-field="sumInsured"]');
      if(sumInput) on(sumInput, "input", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        const formatted = formatRiskSimSumInsuredDigits(sumInput.value);
        sumInput.value = formatted;
        try { sumInput.setSelectionRange(formatted.length, formatted.length); } catch(_e){}
        st.sumInsured = formatted;
        st.result = null; st.error = null; st.dirtySinceSave = true;
      });
      const occInput = modal.querySelector('[data-mnr-field="occupation"]');
      if(occInput){
        on(occInput, "input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.occupation = safeTrim(occInput.value);
          st.occupationSource = "manual";
          st.dirtySinceSave = true;
        });
        on(occInput, "change", () => this._render());
        on(occInput, "blur", () => this._render());
      }
      const calcBtn = modal.querySelector("[data-mnr-calc]");
      if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
      const applyBtn = modal.querySelector("[data-mnr-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-mnr-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-mnr-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => {
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
        if(!allSaved){
          window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור את הסימולטור עבור כל המבוטחים הרלוונטיים לפני האישור הסופי.", variant: "warn" });
          return;
        }
        this._showFinalSummary = true;
        this._render();
      });
      const summaryBackBtn = modal.querySelector("[data-mnr-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-mnr-summary-confirm]");
      if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => {
        try { this._ctx?.onFinalConfirm?.(); } catch(_e){}
        this.close();
      });
    },

    _switchInsured(targetId){
      if(!targetId || targetId === this._activeInsuredId) return;
      const st = this._state[this._activeInsuredId];
      if(st?.dirtySinceSave){
        this._confirmSwitch = { targetId };
        this._render();
        return;
      }
      this._activeInsuredId = targetId;
      this._render();
    },

    _calc(insuredId){
      const st = this._state[insuredId];
      if(!st) return;
      const sumNum = Number(String(st.sumInsured || "").replace(/[^\d.]/g, ""));
      const calc = computeMenoraRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: sumNum });
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        st.error = MENORA_RISK_SIM_MISSING_MESSAGES[calc.reason] || "לא נמצא תעריף מתאים לנתונים שהוזנו.";
      }
      st.dirtySinceSave = true;
      this._render();
    },

    _buildResultForInsured(insId){
      const st = this._state[insId];
      if(!st?.result?.ok) return null;
      return {
        sumInsured: st.sumInsured,
        monthlyPremium: st.result.monthlyPremium,
        annualPremium: st.result.annualPremium,
        ratePerHundredThousand: st.result.ratePerHundredThousand,
        bracket: st.result.bracket,
        age: st.age, ageSource: st.ageSource, gender: st.gender, smoker: st.smoker,
        genderSource: st.genderSource, smokerSource: st.smokerSource,
        occupation: st.occupation || "", occupationSource: st.occupationSource || ""
      };
    },

    _apply(){
      const results = {};
      Object.keys(this._state).forEach((insId) => {
        const r = this._buildResultForInsured(insId);
        if(r) results[insId] = r;
      });
      if(!Object.keys(results).length){
        window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה לפחות למבוטח אחד לפני ההחלה על הפוליסה.", variant: "warn" });
        return;
      }
      const onApply = this._ctx?.onApply;
      this.close();
      try { onApply?.(results); } catch(_e) {}
    },

    _saveActive(){
      const insId = this._activeInsuredId;
      const result = this._buildResultForInsured(insId);
      if(!result){
        window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה עבור מבוטח זה לפני השמירה.", variant: "warn" });
        return;
      }
      try { this._ctx?.onApply?.({ [insId]: result }); } catch(_e) {}
      const st = this._state[insId];
      if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
      window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
      this._render();
    }
  };

  RiskSimulators.register("מנורה", "ריסק", MenoraRiskSimulator);
  // ===== סוף GI-MNR-RISK-SIM =====================================================

  // ===== GI-PHX-MORT-RISK-SIM: סימולטור ריסק משכנתא הפניקס ========================
  // מפת התעריפים הרשמית של הפניקס לביטוח ריסק משכנתא (עדכון 05.2026). זהו מוצר
  // נפרד מ"ריסק" הרגיל של הפניקס — עם טבלת תעריפים ייחודית וטווח גילאים שונה
  // (18–80, לא 18–79). התעריף הוא פרמיה שנתית לכל 1,000 ₪ סכום ביטוח — זהה ביחידה
  // ל"ריסק" הרגיל (שנתית/1000, חודשית=שנתית/12). זהו מקור האמת היחיד לתמחור ריסק
  // משכנתא הפניקס בסימולטור הזה — אין להמציא, לקרב או להשלים ערך שאינו רשום כאן
  // במפורש, כולל אי-המונוטוניות בגילאים 70→71 (התעריף יורד בפועל בדוח המקורי —
  // מועתק כמו שהוא, ללא "תיקון"). כל עדכון תעריפים עתידי מהחברה חייב לעדכן רק
  // את הטבלה הזו.
  //
  // [age, maleNonSmoker, maleSmoker, femaleNonSmoker, femaleSmoker] — פרמיה שנתית ל-1,000 ₪
  const PHOENIX_MORTGAGE_RISK_RATE_TABLE = [
    [18, 0.73, 1.05, 0.70, 1.00], [19, 0.73, 1.05, 0.70, 1.00], [20, 0.73, 1.05, 0.70, 1.00],
    [21, 0.73, 1.05, 0.70, 1.00], [22, 0.73, 1.05, 0.70, 1.00], [23, 0.73, 1.05, 0.70, 1.00],
    [24, 0.73, 1.05, 0.70, 1.00], [25, 0.73, 1.05, 0.70, 1.00], [26, 0.73, 1.05, 0.70, 1.00],
    [27, 0.73, 1.05, 0.70, 1.00], [28, 0.73, 1.05, 0.70, 1.00], [29, 0.73, 1.05, 0.70, 1.00],
    [30, 0.73, 1.05, 0.70, 1.00], [31, 0.73, 1.05, 0.70, 1.00], [32, 0.73, 1.09, 0.70, 1.00],
    [33, 0.73, 1.12, 0.70, 1.00], [34, 0.73, 1.16, 0.70, 1.00], [35, 0.73, 1.20, 0.70, 1.00],
    [36, 0.84, 1.33, 0.80, 1.09], [37, 0.87, 1.43, 0.80, 1.15], [38, 0.92, 1.53, 0.80, 1.15],
    [39, 0.97, 1.65, 0.80, 1.15], [40, 1.03, 1.79, 0.80, 1.21], [41, 1.10, 1.97, 0.84, 1.34],
    [42, 1.17, 2.12, 0.90, 1.48], [43, 1.25, 2.30, 0.96, 1.64], [44, 1.34, 2.50, 1.04, 1.82],
    [45, 1.46, 2.76, 1.13, 2.05], [46, 1.59, 3.05, 1.23, 2.30], [47, 1.73, 3.38, 1.34, 2.58],
    [48, 1.90, 3.77, 1.47, 2.91], [49, 2.09, 4.21, 1.61, 3.28], [50, 2.31, 4.71, 1.77, 3.70],
    [51, 2.55, 5.28, 1.95, 4.17], [52, 2.83, 5.93, 2.15, 4.71], [53, 3.14, 6.67, 2.38, 5.31],
    [54, 3.50, 7.51, 2.64, 5.99], [55, 3.90, 8.46, 2.92, 6.76], [56, 4.36, 9.54, 3.25, 7.62],
    [57, 4.87, 10.75, 3.61, 8.59], [58, 5.46, 12.12, 4.02, 9.67], [59, 6.13, 13.66, 4.47, 10.23],
    [60, 6.88, 15.38, 4.90, 11.50], [61, 7.74, 17.31, 5.26, 12.93], [62, 8.70, 19.46, 5.77, 14.45],
    [63, 9.80, 21.32, 6.32, 15.96], [64, 11.04, 24.54, 6.94, 17.62], [65, 12.45, 27.51, 7.61, 19.47],
    [66, 14.05, 30.80, 8.60, 21.76], [67, 15.85, 34.44, 9.67, 24.31], [68, 17.89, 38.46, 10.91, 27.17],
    [69, 20.21, 42.89, 12.33, 30.48], [70, 22.82, 47.76, 14.26, 34.21], [71, 22.43, 46.20, 14.94, 36.38],
    [72, 25.33, 51.28, 16.75, 40.41], [73, 28.62, 56.82, 18.77, 44.83], [74, 30.35, 58.99, 19.76, 46.60],
    [75, 32.29, 61.36, 20.87, 48.55], [76, 36.47, 67.65, 23.40, 53.65], [77, 41.19, 74.45, 26.24, 59.20],
    [78, 46.52, 81.80, 29.42, 65.23], [79, 52.51, 89.71, 32.99, 71.78], [80, 59.26, 98.18, 36.99, 78.87]
  ];

  const PHOENIX_MORTGAGE_RISK_RATE_MAP = new Map(
    PHOENIX_MORTGAGE_RISK_RATE_TABLE.map((row) => [row[0], {
      maleNonSmoker: row[1], maleSmoker: row[2], femaleNonSmoker: row[3], femaleSmoker: row[4]
    }])
  );

  const PHOENIX_MORTGAGE_RISK_AGE_OPTIONS = PHOENIX_MORTGAGE_RISK_RATE_TABLE.map((row) => row[0]);
  const PHOENIX_MORTGAGE_RISK_MIN_AGE = PHOENIX_MORTGAGE_RISK_AGE_OPTIONS[0];
  const PHOENIX_MORTGAGE_RISK_MAX_AGE = PHOENIX_MORTGAGE_RISK_AGE_OPTIONS[PHOENIX_MORTGAGE_RISK_AGE_OPTIONS.length - 1];

  /** התאמה מדויקת בלבד — ללא קירוב/השלמה. מחזיר {ok:false, reason} אם אין התאמה. */
  function lookupPhoenixMortgageRiskRate({ age, gender, smoker }){
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    const row = PHOENIX_MORTGAGE_RISK_RATE_MAP.get(ageNum);
    if(!row) return { ok:false, reason:"age_out_of_range" };
    const genderKey = gender === "זכר" ? "male" : (gender === "נקבה" ? "female" : "");
    if(!genderKey) return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const rate = row[genderKey + (smoker ? "Smoker" : "NonSmoker")];
    if(typeof rate !== "number" || !Number.isFinite(rate)) return { ok:false, reason:"rate_missing" };
    return { ok:true, ratePerMille: rate };
  }

  /** פרמיה שנתית = (סכום ביטוח / 1000) × תעריף; חודשית = שנתית / 12. חישוב
      בעשרות-אגורות שלמות למניעת שגיאות float בינאריות — אין כאן שום עיגול עסקי. */
  function computePhoenixMortgageRiskPremium({ age, gender, smoker, sumInsured }){
    const lookup = lookupPhoenixMortgageRiskRate({ age, gender, smoker });
    if(!lookup.ok) return lookup;
    const sum = Number(sumInsured);
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const rateCenti = Math.round(lookup.ratePerMille * 100); // אגורות ל-1,000 ₪ (התעריף נתון ב-2 ספרות עשרוניות בדוח)
    const annualPremium = (rateCenti * sum) / 100000; // (rateCenti/100) * sum / 1000
    const monthlyPremium = annualPremium / 12;
    return { ok:true, ratePerMille: lookup.ratePerMille, annualPremium, monthlyPremium };
  }

  const PHOENIX_MORTGAGE_RISK_SIM_MISSING_MESSAGES = {
    age_missing: "יש לבחור גיל לפני חישוב הפרמיה.",
    age_out_of_range: `לא נמצא תעריף מתאים לגיל שהוזן (התעריפון מכיל גילאים ${PHOENIX_MORTGAGE_RISK_MIN_AGE}–${PHOENIX_MORTGAGE_RISK_MAX_AGE} בלבד).`,
    gender_missing: "יש להזין מין לפני חישוב הפרמיה.",
    smoker_missing: "יש לציין האם המבוטח מעשן/ת לפני חישוב הפרמיה.",
    sum_missing: "יש להזין סכום ביטוח תקין (גדול מאפס) לפני חישוב הפרמיה.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו."
  };

  /** קומפוננטת סימולטור ריסק משכנתא הפניקס — מודאל עצמאי, לא תלוי במבנה הפנימי
      של Wizard.renderStep5 מעבר לממשק open(ctx)/onApply. עושה שימוש חוזר במחלקות
      ה-CSS lcPhxSim__* הקיימות (אותה חברה, אותו מבנה מודאל בדיוק — אין צורך
      בקובץ CSS נפרד), עם מזהה DOM ו-data-attributes נפרדים (data-phxmort-*)
      כדי שלא יתערבבו עם הבינדינג של סימולטור "ריסק" הרגיל. */
  const PhoenixMortgageRiskSimulator = {
    _modal: null,
    _ctx: null,
    _state: {},
    _activeInsuredId: null,
    _escHandler: null,
    _confirmSwitch: null,
    _showFinalSummary: false,

    open(ctx){
      this.close();
      this._ctx = ctx || {};
      const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
      this._state = {};
      insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
      this._activeInsuredId = insureds[0]?.id || null;
      this._confirmSwitch = null;
      this._showFinalSummary = false;
      this._mount();
      this._render();
    },

    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : null);
      const computedAge = riskSimAgeFromBirthDate(d.birthDate);
      const ageInRange = Number.isInteger(computedAge) && computedAge >= PHOENIX_MORTGAGE_RISK_MIN_AGE && computedAge <= PHOENIX_MORTGAGE_RISK_MAX_AGE;
      const occupation = safeTrim(d.occupation || "");
      return {
        age: ageInRange ? String(computedAge) : "",
        ageSource: ageInRange ? "step1" : "",
        ageRaw: computedAge,
        gender, genderSource: gender ? "step1" : "",
        smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "",
        occupation,
        occupationSource: occupation ? "step1" : "",
        sumInsured: "",
        result: null,
        error: null,
        savedAt: null,
        dirtySinceSave: false
      };
    },

    /** נקודת הרחבה: קובע אם מבוטח נתון רלוונטי לסימולטור הזה. כברירת מחדל כולם
        רלוונטיים — הנציג כבר בחר אותם בשלב 3 עבור המוצר הנוכחי, ואין כיום כלל
        עסקי קיים במערכת שממעט מבוטחים מסוימים (למשל ילדים) מריסק משכנתא, ולכן
        לא מומצא כזה. אם בעתיד יתברר שיש כלל כזה, יש לממש אותו כאן בלבד. */
    _isInsuredRelevant(_ins){
      return true;
    },

    close(){
      if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
      if(this._modal){
        const m = this._modal;
        m.classList.add("giValModal--leaving");
        window.setTimeout(() => m.remove(), 200);
        this._modal = null;
      }
      this._ctx = null;
    },

    _mount(){
      const modal = document.createElement("div");
      modal.id = "lcPhxMortSimModal";
      modal.className = "giValModal lcPhxSimModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור ריסק משכנתא הפניקס");
      document.body.appendChild(modal);
      this._modal = modal;
      this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
      document.addEventListener("keydown", this._escHandler);
      requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
    },

    _getInsuredLabel(insId){
      const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
      return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
    },

    _getActiveInsured(){
      return (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === this._activeInsuredId) || null;
    },

    _render(){
      if(!this._modal) return;
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
      const isMulti = insureds.length > 1;

      if(this._showFinalSummary){
        this._renderFinalSummary(insureds);
        return;
      }

      const activeId = this._activeInsuredId;
      const st = this._state[activeId] || this._prefillFromInsured(null);
      const isStandalone = !!this._ctx?.standalone;

      const tabsHtml = isMulti ? `<div class="lcPhxSim__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? ' has-saved' : (s?.result ? ' has-result' : '');
        return `<button type="button" class="lcPhxSim__tab${ins.id === activeId ? ' is-active' : ''}${statusCls}" data-phxmort-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? ' 🟢' : ''}</button>`;
      }).join("")}</div>` : "";

      const statusListHtml = isMulti ? `
        <div class="lcPhxSim__statusList">
          <div class="lcPhxSim__statusListTitle">מבוטחים בהצעה</div>
          ${insureds.map((ins) => {
            const s = this._state[ins.id];
            const label = escapeHtml(safeTrim(ins.label) || "מבוטח");
            if(!this._isInsuredRelevant(ins)) return `<div class="lcPhxSim__statusRow"><span>⚪</span><span>${label} – לא נדרש סימולטור עבור מבוטח זה</span></div>`;
            if(s?.savedAt) return `<div class="lcPhxSim__statusRow"><span>🟢</span><span>${label} – נשמר</span></div>`;
            return `<div class="lcPhxSim__statusRow"><span>🟡</span><span>${label} – טרם חושב</span></div>`;
          }).join("")}
        </div>` : "";

      const ageOptionsHtml = `<option value="">בחר גיל…</option>` + PHOENIX_MORTGAGE_RISK_AGE_OPTIONS.map((a) =>
        `<option value="${a}"${String(st.age) === String(a) ? " selected" : ""}>${a}</option>`
      ).join("");

      const ageHintHtml = (isStandalone || st.age)
        ? ""
        : (Number.isInteger(st.ageRaw)
            ? `<div class="lcPhxSim__hint lcPhxSim__hint--warn">הגיל המחושב מתאריך הלידה (${st.ageRaw}) חורג מטווח התעריפון (${PHOENIX_MORTGAGE_RISK_MIN_AGE}–${PHOENIX_MORTGAGE_RISK_MAX_AGE}) — יש לבחור גיל ידנית</div>`
            : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">לא נמצא תאריך לידה תקין בפרטים האישיים — יש לבחור גיל</div>`);

      const genderHintHtml = (isStandalone || st.gender)
        ? ""
        : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">לא נמצא מין בפרטים האישיים — יש לבחור</div>`;
      const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false)
        ? ""
        : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">לא נמצא סטטוס עישון בפרטים האישיים — יש לבחור</div>`;

      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "🏠";
      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcPhxSim");

      const resultHtml = st.error
        ? `<div class="lcPhxSim__result lcPhxSim__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcPhxSim__result lcPhxSim__result--ok">
            <div class="lcPhxSim__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatPhoenixExactAmount(st.result.annualPremium))}</strong></div>
            <div class="lcPhxSim__resultRow lcPhxSim__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatPhoenixExactAmount(st.result.monthlyPremium))}</strong></div>
          </div>` : "");

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcPhxSim__foot">
            <button type="button" class="btn btn--primary" data-phxmort-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcPhxSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-phxmort-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-phxmort-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcPhxSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-phxmort-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-phxmort-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-phxmort-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcPhxSim__overlay">
          <div class="lcPhxSim__overlayCard">
            <div class="lcPhxSim__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcPhxSim__overlayBtns">
              <button type="button" class="btn btn--primary" data-phxmort-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-phxmort-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-phxmort-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-phxmort-close="1"></div>
        <div class="giValModal__card lcPhxSim__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור ריסק משכנתא הפניקס</div>
            </div>
            <button type="button" class="lcPhxSim__closeX" data-phxmort-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcPhxSim__body">
            ${statusListHtml}
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcPhxSim__insuredLabel lcPhxSim__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcPhxSim__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcPhxSim__grid">
              <div class="lcPhxSim__field">
                <label class="lcPhxSim__label">גיל (${PHOENIX_MORTGAGE_RISK_MIN_AGE}–${PHOENIX_MORTGAGE_RISK_MAX_AGE})</label>
                <select class="lcPhxSim__input" data-phxmort-field="age">${ageOptionsHtml}</select>
                ${ageHintHtml}
              </div>
              <div class="lcPhxSim__field">
                <label class="lcPhxSim__label">מין</label>
                <div class="lcPhxSim__segmented">
                  <button type="button" class="lcPhxSim__segBtn${st.gender === 'זכר' ? ' is-active' : ''}" data-phxmort-field="gender" data-phxmort-value="זכר">זכר</button>
                  <button type="button" class="lcPhxSim__segBtn${st.gender === 'נקבה' ? ' is-active' : ''}" data-phxmort-field="gender" data-phxmort-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcPhxSim__field">
                <label class="lcPhxSim__label">עישון</label>
                <div class="lcPhxSim__segmented">
                  <button type="button" class="lcPhxSim__segBtn${st.smoker === false ? ' is-active' : ''}" data-phxmort-field="smoker" data-phxmort-value="0">לא מעשן/ת</button>
                  <button type="button" class="lcPhxSim__segBtn${st.smoker === true ? ' is-active' : ''}" data-phxmort-field="smoker" data-phxmort-value="1">מעשן/ת</button>
                </div>
                ${smokerHintHtml}
              </div>
              <div class="lcPhxSim__field lcPhxSim__field--wide">
                <label class="lcPhxSim__label">סכום ביטוח (₪)</label>
                <input class="lcPhxSim__input" type="text" inputmode="numeric" data-phxmort-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="לדוגמה: 1,000,000" />
              </div>
              <div class="lcPhxSim__field lcPhxSim__field--wide">
                <label class="lcPhxSim__label">עיסוק</label>
                <input class="lcPhxSim__input" type="text" data-phxmort-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            ${occBlockHtml}
            <button type="button" class="btn btn--secondary lcPhxSim__calcBtn" data-phxmort-calc="1">חשב פרמיה</button>
            ${resultHtml}
          </div>
          ${footHtml}
          ${confirmOverlayHtml}
        </div>`;

      this._bind();
    },

    _renderFinalSummary(insureds){
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const rows = relevant.map((ins) => {
        const ok = !!this._state[ins.id]?.savedAt;
        return `<div class="lcPhxSim__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-phxmort-close="1"></div>
        <div class="giValModal__card lcPhxSim__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">🏠</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
              <div class="giValModal__sub">בדקו את הנתונים לפני האישור הסופי</div>
            </div>
            <button type="button" class="lcPhxSim__closeX" data-phxmort-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcPhxSim__body">
            <div class="lcPhxSim__statusListTitle">מבוטחים</div>
            ${rows}
          </div>
          <div class="giValModal__foot lcPhxSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-phxmort-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-phxmort-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "phxmort");
      $$("[data-phxmort-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-phxmort-tab]", modal).forEach((el) => on(el, "click", () => {
        this._switchInsured(el.getAttribute("data-phxmort-tab"));
      }));
      $$("[data-phxmort-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-phxmort-switch");
        const target = this._confirmSwitch?.targetId;
        this._confirmSwitch = null;
        if(action === "save"){
          this._saveActive();
          if(target) this._activeInsuredId = target;
          this._render();
        } else if(action === "discard"){
          if(target) this._activeInsuredId = target;
          this._render();
        } else {
          this._render();
        }
      }));
      const ageSel = modal.querySelector('[data-phxmort-field="age"]');
      if(ageSel) on(ageSel, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        st.age = ageSel.value;
        st.ageSource = "manual";
        st.result = null; st.error = null; st.dirtySinceSave = true;
        this._render();
      });
      const sumInput = modal.querySelector('[data-phxmort-field="sumInsured"]');
      if(sumInput) on(sumInput, "input", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        const formatted = formatRiskSimSumInsuredDigits(sumInput.value);
        sumInput.value = formatted;
        try { sumInput.setSelectionRange(formatted.length, formatted.length); } catch(_e){}
        st.sumInsured = formatted;
        st.result = null; st.error = null; st.dirtySinceSave = true;
      });
      const occInput = modal.querySelector('[data-phxmort-field="occupation"]');
      if(occInput){
        on(occInput, "input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.occupation = safeTrim(occInput.value);
          st.occupationSource = "manual";
          st.dirtySinceSave = true;
        });
        on(occInput, "change", () => this._render());
        on(occInput, "blur", () => this._render());
      }
      const calcBtn = modal.querySelector("[data-phxmort-calc]");
      if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
      const applyBtn = modal.querySelector("[data-phxmort-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-phxmort-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-phxmort-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => {
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
        if(!allSaved){
          window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור את הסימולטור עבור כל המבוטחים הרלוונטיים לפני האישור הסופי.", variant: "warn" });
          return;
        }
        this._showFinalSummary = true;
        this._render();
      });
      const summaryBackBtn = modal.querySelector("[data-phxmort-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-phxmort-summary-confirm]");
      if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => {
        try { this._ctx?.onFinalConfirm?.(); } catch(_e){}
        this.close();
      });
    },

    _switchInsured(targetId){
      if(!targetId || targetId === this._activeInsuredId) return;
      const st = this._state[this._activeInsuredId];
      if(st?.dirtySinceSave){
        this._confirmSwitch = { targetId };
        this._render();
        return;
      }
      this._activeInsuredId = targetId;
      this._render();
    },

    _calc(insuredId){
      const st = this._state[insuredId];
      if(!st) return;
      const sumNum = Number(String(st.sumInsured || "").replace(/[^\d.]/g, ""));
      const calc = computePhoenixMortgageRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: sumNum });
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        st.error = PHOENIX_MORTGAGE_RISK_SIM_MISSING_MESSAGES[calc.reason] || "לא נמצא תעריף מתאים לנתונים שהוזנו.";
      }
      st.dirtySinceSave = true;
      this._render();
    },

    _buildResultForInsured(insId){
      const st = this._state[insId];
      if(!st?.result?.ok) return null;
      return {
        sumInsured: st.sumInsured,
        monthlyPremium: st.result.monthlyPremium,
        annualPremium: st.result.annualPremium,
        ratePerMille: st.result.ratePerMille,
        age: st.age, ageSource: st.ageSource, gender: st.gender, smoker: st.smoker,
        genderSource: st.genderSource, smokerSource: st.smokerSource,
        occupation: st.occupation || "", occupationSource: st.occupationSource || ""
      };
    },

    _apply(){
      const results = {};
      Object.keys(this._state).forEach((insId) => {
        const r = this._buildResultForInsured(insId);
        if(r) results[insId] = r;
      });
      if(!Object.keys(results).length){
        window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה לפחות למבוטח אחד לפני ההחלה על הפוליסה.", variant: "warn" });
        return;
      }
      const onApply = this._ctx?.onApply;
      this.close();
      try { onApply?.(results); } catch(_e) {}
    },

    _saveActive(){
      const insId = this._activeInsuredId;
      const result = this._buildResultForInsured(insId);
      if(!result){
        window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה עבור מבוטח זה לפני השמירה.", variant: "warn" });
        return;
      }
      try { this._ctx?.onApply?.({ [insId]: result }); } catch(_e) {}
      const st = this._state[insId];
      if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
      window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
      this._render();
    }
  };

  RiskSimulators.register("הפניקס", "ריסק משכנתא", PhoenixMortgageRiskSimulator);
  // ===== סוף GI-PHX-MORT-RISK-SIM =================================================

  // ===== GI-HEALTH-CPI 2026-08-10 · הצמדת פרמיות בריאות למדד המחירים לצרכן =====
  // מקור מדד: API למ״ס (סדרה 120010 — מדד המחירים לצרכן כללי; 112160 ריק ב-API).
  //
  // נוסחה: פרמיה_צמודה = תעריף_סטטי × (מדד_ידוע_אחרון_בנקודות ÷ מדד_בסיס_PDF)
  // עוגן נקודות: מדד ידוע 136.84 ב־01.09.2023 (= CBS יולי 2023).
  // מדד_נוכחי_בנקודות = 136.84 × (CBS_תקופה_נבחרת ÷ CBS_יולי_2023)
  //
  // חוק 15 לחודש (שעון ישראל): לפני 15 → מדד לפני־חודשיים;
  // מ־15 לחודש בשעה 18:30 ואילך → מדד החודש שעבר.
  //
  // איילון: בסיס 142.34 לרוב הכיסויים; 145.56 לאמבולטורי מורחב / ייעוץ ובדיקות.
  // הכשרה: בסיס 133.17 (= 13,317 נק׳ בתעריפון) מ־15/12/2022.
  const HealthCpi = {
    CBS_SERIES_ID: 120010,
    CACHE_KEY: "gi_health_cpi_v3",
    LINK_BASE_DESC: "2022 ממוצע",
    SWITCH_DAY: 15,
    SWITCH_HOUR: 18,
    SWITCH_MINUTE: 30,
    // עוגן משותף להמרת CBS → נקודות תעריפון (מאומת מול מנורה)
    ANCHOR: {
      points: 136.84,
      knownDate: "2023-09-01",
      cbsBasePeriod: "07-2023"
    },
    TARIFFS: {
      menora_health: {
        company: "מנורה",
        product: "בריאות",
        // PDF מנורה: "הסכומים נכונים למדד הידוע ביום 01.09.2023 שערכו 136.84 נקודות"
        baseIndexPoints: 136.84,
        baseKnownDate: "2023-09-01"
      },
      ayalon_health: {
        company: "איילון",
        product: "בריאות",
        // PDF איילון מהדורת יוני 2026 — "הפרמיה צמודה למדד 142.34" (ברירת מחדל)
        // כיסויי אמבולטורי מסוימים: 145.56 — מוגדר על הכיסוי עצמו
        baseIndexPoints: 142.34,
        baseKnownDate: "מהדורת יוני 2026"
      },
      hachshara_health: {
        company: "הכשרה",
        product: "בריאות",
        // PDF הכשרה: מדד בסיס 13,317 נק׳ ב־15/12/2022 → 133.17 בסולם הנקודות המודרני
        baseIndexPoints: 133.17,
        baseKnownDate: "2022-12-15"
      }
    },
    _mem: null,
    _loading: null,
    _listeners: [],

    /** חלקי תאריך/שעה בשעון ישראל */
    _israelParts(date){
      const d = date instanceof Date ? date : new Date();
      const parts = {};
      try {
        const fmt = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Jerusalem",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        });
        fmt.formatToParts(d).forEach((p) => {
          if(p.type !== "literal") parts[p.type] = p.value;
        });
      } catch(_e){
        parts.year = String(d.getFullYear());
        parts.month = String(d.getMonth() + 1).padStart(2, "0");
        parts.day = String(d.getDate()).padStart(2, "0");
        parts.hour = String(d.getHours()).padStart(2, "0");
        parts.minute = String(d.getMinutes()).padStart(2, "0");
      }
      return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute)
      };
    },

    /**
     * האם כבר עבר מועד פרסום המדד לחודש הקודם (15 לחודש 18:30 שעון ישראל).
     * לפני המועד → משתמשים במדד של לפני חודשיים; אחריו → מדד החודש שעבר.
     */
    _usesPreviousMonthIndex(date){
      const p = this._israelParts(date);
      if(p.day > this.SWITCH_DAY) return true;
      if(p.day < this.SWITCH_DAY) return false;
      if(p.hour > this.SWITCH_HOUR) return true;
      if(p.hour < this.SWITCH_HOUR) return false;
      return p.minute >= this.SWITCH_MINUTE;
    },

    /** מחזיר מחרוזת תקופה ללמ״ס בפורמט MM-YYYY לפי חוק ה־15 */
    resolveTargetPeriod(date){
      const p = this._israelParts(date);
      const monthsBack = this._usesPreviousMonthIndex(date) ? 1 : 2;
      let y = p.year;
      let m = p.month - monthsBack;
      while(m <= 0){ m += 12; y -= 1; }
      return String(m).padStart(2, "0") + "-" + y;
    },

    _readLocal(){
      try {
        const raw = localStorage.getItem(this.CACHE_KEY);
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        if(!parsed || typeof parsed !== "object") return null;
        // דורש מבנה v2 (עם anchor)
        if(!parsed.anchor?.linked || !parsed.current?.linked) return null;
        return parsed;
      } catch(_e){ return null; }
    },
    _writeLocal(payload){
      try { localStorage.setItem(this.CACHE_KEY, JSON.stringify(payload)); } catch(_e){}
    },
    _linkedValue(entry){
      if(!entry || !entry.currBase) return null;
      if(entry.currBase.baseDesc === this.LINK_BASE_DESC){
        const v = Number(entry.currBase.value);
        return Number.isFinite(v) ? v : null;
      }
      const prev = Array.isArray(entry.prevBase) ? entry.prevBase : [];
      for(let i = 0; i < prev.length; i++){
        if(prev[i]?.baseDesc === this.LINK_BASE_DESC){
          const v = Number(prev[i].value);
          return Number.isFinite(v) ? v : null;
        }
      }
      const v = Number(entry.currBase.value);
      return Number.isFinite(v) ? v : null;
    },
    async _fetchCbs(params){
      const url = "https://api.cbs.gov.il/index/data/price?id=" + this.CBS_SERIES_ID +
        "&format=json&download=false&lang=he&coef=true&" + params;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if(!res.ok) throw new Error("cbs_http_" + res.status);
      const data = await res.json();
      const entry = data?.month?.[0]?.date?.[0];
      if(!entry) throw new Error("cbs_empty");
      const linked = this._linkedValue(entry);
      if(linked == null) throw new Error("cbs_link_missing");
      return {
        year: entry.year,
        month: entry.month,
        monthDesc: entry.monthDesc || "",
        linked,
        currBaseDesc: entry.currBase?.baseDesc || "",
        currBaseValue: Number(entry.currBase?.value) || null
      };
    },
    async refresh(){
      const targetPeriod = this.resolveTargetPeriod(new Date());
      let current;
      try {
        current = await this._fetchCbs("startPeriod=" + encodeURIComponent(targetPeriod) +
          "&endPeriod=" + encodeURIComponent(targetPeriod));
      } catch(_err){
        // אם התקופה לפי חוק־15 עדיין לא פורסמה — נסיגה ל־last=1
        current = await this._fetchCbs("last=1");
      }
      const anchorPeriod = this.ANCHOR.cbsBasePeriod;
      const anchor = await this._fetchCbs("startPeriod=" + encodeURIComponent(anchorPeriod) +
        "&endPeriod=" + encodeURIComponent(anchorPeriod));
      const payload = {
        fetchedAt: new Date().toISOString(),
        targetPeriod,
        current,
        anchor,
        source: "cbs"
      };
      this._mem = payload;
      this._writeLocal(payload);
      this._listeners.slice().forEach((fn) => { try { fn(payload); } catch(_e){} });
      return payload;
    },
    ensure(){
      if(this._mem?.anchor?.linked != null && this._mem?.current?.linked != null){
        return Promise.resolve(this._mem);
      }
      const local = this._readLocal();
      if(local?.current?.linked != null && local?.anchor?.linked != null){
        this._mem = local;
        const ageMs = Date.now() - Date.parse(local.fetchedAt || 0);
        if(!(Number.isFinite(ageMs) && ageMs < 12 * 3600 * 1000)){
          if(!this._loading){
            this._loading = this.refresh().catch(() => local).finally(() => { this._loading = null; });
          }
        }
        return Promise.resolve(this._mem);
      }
      if(this._loading) return this._loading;
      this._loading = this.refresh()
        .catch((err) => {
          const fallback = this._readLocal();
          if(fallback?.current?.linked != null && fallback?.anchor?.linked != null){
            this._mem = fallback;
            return fallback;
          }
          throw err;
        })
        .finally(() => { this._loading = null; });
      return this._loading;
    },
    onChange(fn){
      if(typeof fn === "function") this._listeners.push(fn);
      return () => { this._listeners = this._listeners.filter((x) => x !== fn); };
    },
    /** מדד נוכחי בנקודות תעריפון (סולם מנורה/איילון) — null אם אין מטמון */
    getCurrentIndexPoints(){
      const mem = this._mem || this._readLocal();
      const current = mem?.current;
      const anchor = mem?.anchor;
      if(!current?.linked || !anchor?.linked) return null;
      const ratio = current.linked / anchor.linked;
      if(!(Number.isFinite(ratio) && ratio > 0)) return null;
      return Math.round(this.ANCHOR.points * ratio * 100) / 100;
    },
    /**
     * מידע הצמדה. אפשר לעקוף baseIndexPoints לכיסוי ספציפי (איילון 145.56).
     * factor = מדד_נוכחי_בנקודות ÷ מדד_בסיס_PDF
     */
    getIndexInfo(tariffKey, opts){
      const options = opts && typeof opts === "object" ? opts : {};
      const tariff = this.TARIFFS[tariffKey];
      if(!tariff){
        return { ok:false, factor:1, reason:"tariff_missing", tariffKey };
      }
      const baseIndexPoints = Number.isFinite(Number(options.baseIndexPoints))
        ? Number(options.baseIndexPoints)
        : tariff.baseIndexPoints;
      const mem = this._mem || this._readLocal();
      const current = mem?.current;
      const currentIndexPoints = this.getCurrentIndexPoints();
      if(currentIndexPoints == null || !current?.linked){
        return {
          ok: false,
          factor: 1,
          reason: "cpi_pending",
          tariffKey,
          baseIndexPoints,
          baseKnownDate: tariff.baseKnownDate,
          company: tariff.company
        };
      }
      const factor = currentIndexPoints / baseIndexPoints;
      if(!(Number.isFinite(factor) && factor > 0)){
        return { ok:false, factor:1, reason:"cpi_bad_factor", tariffKey, baseIndexPoints };
      }
      return {
        ok: true,
        factor,
        tariffKey,
        company: tariff.company,
        baseIndexPoints,
        baseKnownDate: tariff.baseKnownDate,
        currentIndexPoints,
        currentMonthLabel: (current.monthDesc || "") + " " + (current.year || ""),
        anchorPoints: this.ANCHOR.points,
        anchorKnownDate: this.ANCHOR.knownDate,
        fetchedAt: mem.fetchedAt || "",
        source: mem.source || "cbs"
      };
    },
    /** עיגול לאגורה אחרי הצמדה; opts.baseIndexPoints לעקיפת בסיס הכיסוי */
    indexAgorot(baseAgorot, tariffKey, opts){
      const info = this.getIndexInfo(tariffKey, opts);
      const factor = info.factor || 1;
      const indexedAgorot = Math.round(Number(baseAgorot) * factor);
      return { baseAgorot: Number(baseAgorot) || 0, indexedAgorot, factor, indexInfo: info };
    }
  };
  try { window.HealthCpi = HealthCpi; } catch(_e){}

  // ===== GI-MNR-HEALTH-SIM 2026-08-09 · סימולטור בריאות מנורה ==================
  // מקור אמת: תעריפי בריאות מנורה (תכניות בסיס/ניתוחים + אמבולטורי/כתבי שירות).
  // מחלות קשות / סרטן — סימולטורים נפרדים (לא כאן).
  // כל התעריפים באגורות (שלמים) כדי למנוע סטיית floating-point.

  const MENORA_HEALTH_MIN_AGE = 0;
  const MENORA_HEALTH_MAX_AGE = 70;
  const MENORA_HEALTH_MIN_ENTRY_DAYS = 15; // לפי הערת גיל כניסה מינימלי ב-PDF

  /** המרת שקלים → אגורות בשלמים (קלט מהתעריפון בלבד, עד ספרה אחת אחרי הנקודה). */
  function menoraHealthShekelsToAgorot(shekels){
    return Math.round(Number(shekels) * 100);
  }
  function menoraHealthAgorotToShekels(agorot){
    return agorot / 100;
  }
  function formatMenoraHealthExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    const whole = Math.trunc(ag / 100);
    const frac = Math.abs(ag % 100);
    return whole + "." + String(frac).padStart(2, "0");
  }

  /** מחפש תעריף בקבוצת גיל. bands: [{min,max,agorot}] או [{min,max,male,female}] */
  function menoraHealthLookupBand(bands, age){
    const a = Number(age);
    if(!Number.isInteger(a)) return null;
    for(let i = 0; i < bands.length; i++){
      const b = bands[i];
      if(a >= b.min && a <= b.max) return b;
    }
    return null;
  }

  /**
   * קטלוג כיסויים — שמות label מדויקים מה-PDF (עמודים 1–2).
   * wizardKey = המפתח ב-Wizard.healthCoversByCompany["מנורה"] להחלה על הפוליסה.
   * מחלות קשות / סרטן — סימולטורים נפרדים (לא כאן). אין שדה עישון בבריאות.
   * תעריפים באגורות, מדויקים 1:1 מול ה-PDF.
   */
  const MENORA_HEALTH_COVERS = [
    {
      id: "transplant",
      label: "השתלות וטיפולים מיוחדים מחוץ לישראל",
      wizardKey: "השתלות וטיפולים מיוחדים מחוץ לישראל",
      group: "תכניות בסיס וניתוחים",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:1000 }, { min:21, max:30, agorot:1600 },
        { min:31, max:40, agorot:1760 }, { min:41, max:50, agorot:2080 },
        { min:51, max:55, agorot:2410 }, { min:56, max:60, agorot:2670 },
        { min:61, max:65, agorot:3040 }, { min:66, max:120, agorot:3150 }
      ]
    },
    {
      id: "abroad_surgery",
      label: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל",
      wizardKey: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל",
      group: "תכניות בסיס וניתוחים",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:650 }, { min:21, max:30, agorot:860 },
        { min:31, max:40, agorot:1020 }, { min:41, max:50, agorot:1270 },
        { min:51, max:55, agorot:2100 }, { min:56, max:60, agorot:2530 },
        { min:61, max:65, agorot:2960 }, { min:66, max:120, agorot:3090 }
      ]
    },
    {
      id: "drugs",
      label: "תרופות מחוץ לסל שירותי הבריאות",
      wizardKey: "תרופות מחוץ לסל הבריאות",
      group: "תכניות בסיס וניתוחים",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:1260 }, { min:21, max:30, agorot:1840 },
        { min:31, max:40, agorot:2540 }, { min:41, max:50, agorot:4090 },
        { min:51, max:55, agorot:5930 }, { min:56, max:60, agorot:7810 },
        { min:61, max:65, agorot:10650 }, { min:66, max:120, agorot:14210 }
      ]
    },
    {
      id: "surgery_first_shekel",
      label: "ניתוחים שקל ראשון",
      wizardKey: "ניתוחים בישראל מהשקל הראשון",
      group: "תכניות בסיס וניתוחים",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:3910 }, { min:21, max:30, agorot:7360 },
        { min:31, max:40, agorot:12890 }, { min:41, max:50, agorot:17860 },
        { min:51, max:55, agorot:28400 }, { min:56, max:60, agorot:33670 },
        { min:61, max:65, agorot:48710 }, { min:66, max:120, agorot:72810 }
      ]
    },
    {
      id: "surgery_shaban",
      label: "ניתוחים שב״ן משלים",
      wizardKey: "משלים שב\"ן ללא השתתפות עצמית",
      group: "תכניות בסיס וניתוחים",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:1830 }, { min:21, max:30, agorot:3450 },
        { min:31, max:40, agorot:6040 }, { min:41, max:50, agorot:8370 },
        { min:51, max:55, agorot:13370 }, { min:56, max:60, agorot:16280 },
        { min:61, max:65, agorot:23910 }, { min:66, max:120, agorot:37280 }
      ]
    },
    {
      id: "surgery_shaban_5000",
      label: "ניתוחים שב״ן משלים ₪5000 ה.ע",
      wizardKey: "משלים שב\"ן עם השתתפות עצמית",
      group: "תכניות בסיס וניתוחים",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:1420 }, { min:21, max:30, agorot:2670 },
        { min:31, max:40, agorot:4680 }, { min:41, max:50, agorot:6490 },
        { min:51, max:55, agorot:10360 }, { min:56, max:60, agorot:12620 },
        { min:61, max:65, agorot:18530 }, { min:66, max:120, agorot:28900 }
      ]
    },
    {
      id: "ambulatory_consults",
      label: "ייעוצים ובדיקות",
      wizardKey: "ייעוץ ובדיקות",
      group: "אמבולטורי וכתבי שירות",
      needsGender: true,
      bands: [
        { min:0, max:20, male:2530, female:2320 },
        { min:21, max:55, male:3230, female:7520 },
        { min:56, max:65, male:5120, female:6200 },
        { min:66, max:70, male:9500, female:11800 },
        { min:71, max:120, male:16130, female:16700 }
      ]
    },
    {
      id: "fast_diagnosis",
      label: "אבחון רפואי מהיר",
      wizardKey: "אבחון רפואי מהיר",
      group: "אמבולטורי וכתבי שירות",
      needsGender: false,
      bands: [
        { min:0, max:14, agorot:730 },
        { min:15, max:120, agorot:1930 }
      ]
    },
    {
      id: "tech_devices",
      label: "טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים",
      wizardKey: "טיפולים בטכנולוגיות מתקדמות",
      group: "אמבולטורי וכתבי שירות",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:700 }, { min:21, max:30, agorot:1270 },
        { min:31, max:35, agorot:1310 }, { min:36, max:40, agorot:1440 },
        { min:41, max:45, agorot:1620 }, { min:46, max:50, agorot:1890 },
        { min:51, max:55, agorot:2180 }, { min:56, max:60, agorot:2780 },
        { min:61, max:65, agorot:3410 }, { min:66, max:120, agorot:4530 }
      ]
    },
    {
      id: "smart_dr",
      label: "סמארט דוקטור — ייעוץ רפואי מקוון",
      wizardKey: "Smart DR — ייעוץ רפואי וניווק עד הבית",
      group: "אמבולטורי וכתבי שירות",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:840 },
        { min:21, max:120, agorot:1610 }
      ]
    },
    {
      id: "top_complementary",
      label: "טיפולים טופ — רפואה משלימה",
      wizardKey: "TOP רפואה משלימה",
      group: "אמבולטורי וכתבי שירות",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:1250 },
        { min:21, max:120, agorot:2720 }
      ]
    },
    {
      id: "child_dev",
      label: "טופ לילד — אבחונים וטיפולי התפתחות",
      wizardKey: "טיפול ואבחון לילד",
      group: "אמבולטורי וכתבי שירות",
      needsGender: false,
      maxAge: 21,
      bands: [
        { min:0, max:21, agorot:2880 }
      ]
    },
    {
      id: "top_preventive",
      label: "מניעתית טופ — רפואה מונעת",
      wizardKey: "TOP מניעתית — בריאות חיים ובדיקות מניעה",
      group: "אמבולטורי וכתבי שירות",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:870 },
        { min:21, max:120, agorot:2240 }
      ]
    }
  ];

  const MENORA_HEALTH_COVER_BY_ID = MENORA_HEALTH_COVERS.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

  const MENORA_HEALTH_CPI_KEY = "menora_health";

  /** מחשב פרמיה חודשית לכיסוי בודד. מחזיר {ok, monthlyPremium, monthlyAgorot, reason?}
      monthlyPremium/monthlyAgorot = אחרי הצמדה למדד; base* = תעריפון PDF לפני הצמדה. */
  function computeMenoraHealthCoverPremium(coverId, age, gender){
    const cover = MENORA_HEALTH_COVER_BY_ID[coverId];
    if(!cover) return { ok:false, reason:"cover_missing" };
    const a = Number(age);
    if(!Number.isInteger(a)) return { ok:false, reason:"age_missing" };
    if(a < MENORA_HEALTH_MIN_AGE || a > MENORA_HEALTH_MAX_AGE) return { ok:false, reason:"age_out_of_range" };
    if(cover.maxAge != null && a > cover.maxAge) return { ok:false, reason:"age_cover_limit", coverMaxAge: cover.maxAge };
    const band = menoraHealthLookupBand(cover.bands, a);
    if(!band) return { ok:false, reason:"rate_missing" };
    let agorot = null;
    if(cover.needsGender){
      if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
      agorot = gender === "זכר" ? band.male : band.female;
    } else {
      agorot = band.agorot;
    }
    if(!Number.isInteger(agorot)) return { ok:false, reason:"rate_missing" };
    const indexed = HealthCpi.indexAgorot(agorot, MENORA_HEALTH_CPI_KEY);
    return {
      ok: true,
      coverId: cover.id,
      label: cover.label,
      baseMonthlyAgorot: indexed.baseAgorot,
      baseMonthlyPremium: menoraHealthAgorotToShekels(indexed.baseAgorot),
      monthlyAgorot: indexed.indexedAgorot,
      monthlyPremium: menoraHealthAgorotToShekels(indexed.indexedAgorot),
      indexFactor: indexed.factor,
      indexInfo: indexed.indexInfo
    };
  }

  /** מחשב סל כיסויים נבחרים — סכום אגורות מדויק (אחרי הצמדה) */
  function computeMenoraHealthBundle(selectedIds, age, gender){
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if(!ids.length) return { ok:false, reason:"covers_missing", covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
    const covers = [];
    let totalAg = 0;
    let totalBaseAg = 0;
    let indexInfo = null;
    for(let i = 0; i < ids.length; i++){
      const one = computeMenoraHealthCoverPremium(ids[i], age, gender);
      if(!one.ok) return { ok:false, reason: one.reason, failCoverId: ids[i], coverMaxAge: one.coverMaxAge, covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
      const meta = MENORA_HEALTH_COVER_BY_ID[one.coverId];
      if(!indexInfo) indexInfo = one.indexInfo || null;
      covers.push({
        id: one.coverId,
        label: one.label,
        wizardKey: meta?.wizardKey || one.label,
        monthlyPremium: one.monthlyPremium,
        monthlyAgorot: one.monthlyAgorot,
        baseMonthlyPremium: one.baseMonthlyPremium,
        baseMonthlyAgorot: one.baseMonthlyAgorot
      });
      totalAg += one.monthlyAgorot;
      totalBaseAg += one.baseMonthlyAgorot;
    }
    return {
      ok: true,
      covers,
      monthlyAgorot: totalAg,
      monthlyPremium: menoraHealthAgorotToShekels(totalAg),
      annualPremium: menoraHealthAgorotToShekels(totalAg * 12),
      baseMonthlyAgorot: totalBaseAg,
      baseMonthlyPremium: menoraHealthAgorotToShekels(totalBaseAg),
      indexFactor: indexInfo?.factor || 1,
      indexInfo
    };
  }

  function formatMenoraHealthIndexMetaHtml(indexInfo){
    if(!indexInfo) return "";
    if(!indexInfo.ok){
      return `<div class="lcMnrHealth__indexMeta lcMnrHealth__indexMeta--pending">ממתין למדד למ״ס — מוצגת כרגע פרמיית בסיס מהתעריפון</div>`;
    }
    const factorTxt = (Math.round(indexInfo.factor * 10000) / 10000).toFixed(4);
    return `<div class="lcMnrHealth__indexMeta">
      הצמדה למדד: בסיס ${escapeHtml(String(indexInfo.baseIndexPoints))}
      (${escapeHtml(indexInfo.baseKnownDate || "")})
      → נוכחי ≈ ${escapeHtml(String(indexInfo.currentIndexPoints))}
      (${escapeHtml(safeTrim(indexInfo.currentMonthLabel))})
      · מקדם ×${escapeHtml(factorTxt)}
    </div>`;
  }

  const MENORA_HEALTH_SIM_MESSAGES = {
    birth_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young: `גיל הכניסה המינימלי הוא ${MENORA_HEALTH_MIN_ENTRY_DAYS} ימים.`,
    age_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range: `הגיל הביטוחי (שנים שלמות היום) חורג מטווח הכניסה ${MENORA_HEALTH_MIN_AGE}–${MENORA_HEALTH_MAX_AGE}.`,
    gender_missing: "יש לבחור מין — נדרש לכיסוי ייעוצים ובדיקות.",
    covers_missing: "יש לסמן לפחות כיסוי אחד.",
    age_cover_limit: "הגיל חורג מהמותר לכיסוי שנבחר.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו.",
    cover_missing: "כיסוי לא מזוהה בתעריפון."
  };

  const MenoraHealthSimulator = {
    _modal: null,
    _ctx: null,
    _state: {},
    _activeInsuredId: null,
    _escHandler: null,
    _confirmSwitch: null,
    _showFinalSummary: false,
    _cpiUnsub: null,

    open(ctx){
      this.close();
      this._ctx = ctx || {};
      const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
      this._state = {};
      insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
      this._activeInsuredId = insureds[0]?.id || null;
      this._confirmSwitch = null;
      this._showFinalSummary = false;
      this._mount();
      this._render();
      this._cpiUnsub = HealthCpi.onChange(() => { if(this._modal) this._render(); });
      HealthCpi.ensure().then(() => { if(this._modal) this._render(); }).catch(() => {});
    },

    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const birthDate = safeTrim(d.birthDate || "");
      const occupation = safeTrim(d.occupation || "");
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        age: "",
        ageSource: birthDate ? "step1" : "",
        ageRaw: null,
        entryDays: null,
        gender, genderSource: gender ? "step1" : "",
        occupation,
        occupationSource: occupation ? "step1" : "",
        selected: {},
        result: null,
        error: null,
        savedAt: null,
        dirtySinceSave: false
      };
      riskSimSyncAgeFromBirthDate(st, {
        minAge: MENORA_HEALTH_MIN_AGE,
        maxAge: MENORA_HEALTH_MAX_AGE,
        minEntryDays: MENORA_HEALTH_MIN_ENTRY_DAYS
      });
      return st;
    },

    _isInsuredRelevant(_ins){ return true; },

    close(){
      if(this._cpiUnsub){ try { this._cpiUnsub(); } catch(_e){} this._cpiUnsub = null; }
      if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
      if(this._modal){
        const m = this._modal;
        m.classList.add("giValModal--leaving");
        window.setTimeout(() => m.remove(), 200);
        this._modal = null;
      }
      this._ctx = null;
    },

    _mount(){
      const modal = document.createElement("div");
      modal.id = "lcMnrHealthModal";
      modal.className = "giValModal lcMnrHealthModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור בריאות מנורה");
      document.body.appendChild(modal);
      this._modal = modal;
      this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
      document.addEventListener("keydown", this._escHandler);
      requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
    },

    _getInsuredLabel(insId){
      const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
      return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
    },

    _getActiveInsured(){
      return (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === this._activeInsuredId) || null;
    },

    _selectedIds(st){
      return MENORA_HEALTH_COVERS.map((c) => c.id).filter((id) => !!st?.selected?.[id]);
    },

    _syncAge(st){
      return riskSimSyncAgeFromBirthDate(st, {
        minAge: MENORA_HEALTH_MIN_AGE,
        maxAge: MENORA_HEALTH_MAX_AGE,
        minEntryDays: MENORA_HEALTH_MIN_ENTRY_DAYS
      });
    },

    _recalcState(st){
      if(!st) return;
      if(!st.selected || typeof st.selected !== "object") st.selected = {};
      const ageSync = this._syncAge(st);
      const ids = this._selectedIds(st);
      if(!ids.length){
        st.result = null;
        st.error = null;
        return;
      }
      if(!ageSync.ok){
        st.result = null;
        st.error = MENORA_HEALTH_SIM_MESSAGES[ageSync.reason] || MENORA_HEALTH_SIM_MESSAGES.birth_missing;
        return;
      }
      const calc = computeMenoraHealthBundle(ids, st.age, st.gender);
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        let msg = MENORA_HEALTH_SIM_MESSAGES[calc.reason] || "לא ניתן לחשב את הפרמיה.";
        if(calc.reason === "age_cover_limit" && calc.failCoverId){
          const c = MENORA_HEALTH_COVER_BY_ID[calc.failCoverId];
          msg = `הכיסוי "${c?.label || ""}" זמין עד גיל ${calc.coverMaxAge} בלבד.`;
        } else if(calc.failCoverId){
          const c = MENORA_HEALTH_COVER_BY_ID[calc.failCoverId];
          if(c) msg = `${msg} (${c.label})`;
        }
        st.error = msg;
      }
    },

    _render(){
      if(!this._modal) return;
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
      const isMulti = insureds.length > 1;
      if(this._showFinalSummary){
        this._renderFinalSummary(insureds);
        return;
      }
      const activeId = this._activeInsuredId;
      const st = this._state[activeId] || this._prefillFromInsured(null);
      const isStandalone = !!this._ctx?.standalone;
      this._recalcState(st);

      const tabsHtml = isMulti ? `<div class="lcMnrHealth__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : "");
        return `<button type="button" class="lcMnrHealth__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-mnrh-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
      }).join("")}</div>` : "";

      const birthIso = riskSimBirthDateToIsoInput(st.birthDate || "");
      const birthMaxIso = riskSimIsoDateDaysAgo(MENORA_HEALTH_MIN_ENTRY_DAYS);
      const ageSync = this._syncAge(st);
      const ageDisplay = ageSync.ok ? String(ageSync.age) : "—";
      const ageHintHtml = !st.birthDate
        ? (isStandalone ? `<div class="lcMnrHealth__hint lcMnrHealth__hint--warn">יש לבחור תאריך לידה מלוח השנה</div>` : `<div class="lcMnrHealth__hint lcMnrHealth__hint--warn">לא נמצא תאריך לידה בפרטים האישיים — יש לבחור מלוח השנה</div>`)
        : (!ageSync.ok
          ? `<div class="lcMnrHealth__hint lcMnrHealth__hint--warn">${escapeHtml(MENORA_HEALTH_SIM_MESSAGES[ageSync.reason] || "תאריך לידה לא תקין לחישוב")}</div>`
          : `<div class="lcMnrHealth__hint">גיל ביטוחי (שנים שלמות היום): <strong>${escapeHtml(ageDisplay)}</strong></div>`);
      const needsGenderSelected = this._selectedIds(st).some((id) => !!MENORA_HEALTH_COVER_BY_ID[id]?.needsGender);
      const genderHintHtml = (!needsGenderSelected || isStandalone || st.gender) ? "" : `<div class="lcMnrHealth__hint lcMnrHealth__hint--warn">לא נמצא מין — נדרש לכיסוי ייעוצים ובדיקות</div>`;

      const groups = {};
      MENORA_HEALTH_COVERS.forEach((c) => {
        if(!groups[c.group]) groups[c.group] = [];
        groups[c.group].push(c);
      });
      const coversHtml = Object.keys(groups).map((g) => `
        <div class="lcMnrHealth__group">
          <div class="lcMnrHealth__groupTitle">${escapeHtml(g)}</div>
          <div class="lcMnrHealth__coverList">
            ${groups[g].map((c) => {
              const checked = !!(st.selected && st.selected[c.id]);
              const one = checked ? computeMenoraHealthCoverPremium(c.id, st.age, st.gender) : null;
              const premTxt = one?.ok ? `₪${formatMenoraHealthExactAmount(one.monthlyPremium)}` : (checked && one && !one.ok ? "—" : "");
              return `<label class="lcMnrHealth__cover${checked ? " is-checked" : ""}">
                <input type="checkbox" data-mnrh-cover="${escapeHtml(c.id)}"${checked ? " checked" : ""} />
                <span class="lcMnrHealth__coverLabel">${escapeHtml(c.label)}${c.needsGender ? ' <em>(לפי מין)</em>' : ""}${c.maxAge != null ? ` <em>(עד גיל ${c.maxAge})</em>` : ""}</span>
                <span class="lcMnrHealth__coverPrem">${premTxt}</span>
              </label>`;
            }).join("")}
          </div>
        </div>`).join("");

      const selectedRows = (st.result?.covers || []).map((c) =>
        `<div class="lcMnrHealth__selRow"><span>${escapeHtml(c.label)}</span><strong>₪${escapeHtml(formatMenoraHealthExactAmount(c.monthlyPremium))}</strong></div>`
      ).join("");

      const indexMetaHtml = formatMenoraHealthIndexMetaHtml(st.result?.indexInfo || HealthCpi.getIndexInfo(MENORA_HEALTH_CPI_KEY));
      const baseTotalHtml = (st.result?.ok && st.result.baseMonthlyPremium != null && Math.abs(st.result.baseMonthlyPremium - st.result.monthlyPremium) > 0.0001)
        ? `<div class="lcMnrHealth__resultRow"><span>פרמיית בסיס (לפני מדד)</span><strong>₪${escapeHtml(formatMenoraHealthExactAmount(st.result.baseMonthlyPremium))}</strong></div>`
        : "";
      const resultHtml = st.error
        ? `<div class="lcMnrHealth__result lcMnrHealth__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcMnrHealth__result lcMnrHealth__result--ok">
            <div class="lcMnrHealth__selTitle">כיסויים שנבחרו</div>
            ${selectedRows}
            ${baseTotalHtml}
            <div class="lcMnrHealth__resultRow lcMnrHealth__resultRow--main"><span>סה״כ פרמיה חודשית (צמודה למדד)</span><strong>₪${escapeHtml(formatMenoraHealthExactAmount(st.result.monthlyPremium))}</strong></div>
            <div class="lcMnrHealth__resultRow"><span>סה״כ פרמיה שנתית</span><strong>₪${escapeHtml(formatMenoraHealthExactAmount(st.result.annualPremium))}</strong></div>
            ${indexMetaHtml}
          </div>` : `<div class="lcMnrHealth__result lcMnrHealth__result--empty">סמנו כיסויים כדי לראות פרמיה</div>`);

      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcMnrHealth");
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "✚";

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcMnrHealth__foot">
            <button type="button" class="btn btn--primary" data-mnrh-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcMnrHealth__foot">
            <button type="button" class="btn giValModal__closeBtn" data-mnrh-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-mnrh-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcMnrHealth__foot">
            <button type="button" class="btn giValModal__closeBtn" data-mnrh-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-mnrh-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-mnrh-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcMnrHealth__overlay">
          <div class="lcMnrHealth__overlayCard">
            <div class="lcMnrHealth__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcMnrHealth__overlayBtns">
              <button type="button" class="btn btn--primary" data-mnrh-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-mnrh-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-mnrh-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-mnrh-close="1"></div>
        <div class="giValModal__card lcMnrHealth__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור בריאות מנורה</div>
            </div>
            <button type="button" class="lcMnrHealth__closeX" data-mnrh-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcMnrHealth__body">
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcMnrHealth__insuredLabel lcMnrHealth__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcMnrHealth__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcMnrHealth__grid">
              <div class="lcMnrHealth__field">
                <label class="lcMnrHealth__label">תאריך לידה</label>
                <input class="lcMnrHealth__input" type="date" data-mnrh-field="birthDate" value="${escapeHtml(birthIso)}" max="${escapeHtml(birthMaxIso)}" />
                ${ageHintHtml}
              </div>
              <div class="lcMnrHealth__field">
                <label class="lcMnrHealth__label">מין</label>
                <div class="lcMnrHealth__segmented">
                  <button type="button" class="lcMnrHealth__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-mnrh-field="gender" data-mnrh-value="זכר">זכר</button>
                  <button type="button" class="lcMnrHealth__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-mnrh-field="gender" data-mnrh-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcMnrHealth__field lcMnrHealth__field--wide">
                <label class="lcMnrHealth__label">עיסוק</label>
                <input class="lcMnrHealth__input" type="text" data-mnrh-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            <div class="lcMnrHealth__coversTitle">בחירת כיסויים <span class="lcMnrHealth__coversCount">(${MENORA_HEALTH_COVERS.length})</span></div>
            <div class="lcMnrHealth__coversWrap">${coversHtml}</div>
            ${occBlockHtml}
            ${resultHtml}
          </div>
          ${footHtml}
          ${confirmOverlayHtml}
        </div>`;
      this._bind();
    },

    _renderFinalSummary(insureds){
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const rows = relevant.map((ins) => {
        const ok = !!this._state[ins.id]?.savedAt;
        return `<div class="lcMnrHealth__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-mnrh-close="1"></div>
        <div class="giValModal__card lcMnrHealth__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
            </div>
            <button type="button" class="lcMnrHealth__closeX" data-mnrh-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcMnrHealth__body">${rows}</div>
          <div class="giValModal__foot lcMnrHealth__foot">
            <button type="button" class="btn giValModal__closeBtn" data-mnrh-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-mnrh-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "mnrh");
      $$("[data-mnrh-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-mnrh-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-mnrh-tab"))));
      $$("[data-mnrh-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-mnrh-switch");
        const target = this._confirmSwitch?.targetId;
        this._confirmSwitch = null;
        if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); }
        else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); }
        else this._render();
      }));
      const birthInput = modal.querySelector('[data-mnrh-field="birthDate"]');
      if(birthInput) on(birthInput, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        st.birthDate = riskSimBirthDateFromIsoInput(birthInput.value);
        st.birthDateSource = "manual";
        st.ageSource = "manual";
        st.dirtySinceSave = true;
        this._syncAge(st);
        this._render();
      });
      const occInput = modal.querySelector('[data-mnrh-field="occupation"]');
      if(occInput){
        on(occInput, "input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.occupation = safeTrim(occInput.value);
          st.occupationSource = "manual"; st.dirtySinceSave = true;
        });
        on(occInput, "change", () => this._render());
        on(occInput, "blur", () => this._render());
      }
      $$("[data-mnrh-cover]", modal).forEach((el) => on(el, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        if(!st.selected || typeof st.selected !== "object") st.selected = {};
        const id = el.getAttribute("data-mnrh-cover");
        st.selected[id] = !!el.checked;
        st.dirtySinceSave = true;
        this._render();
      }));
      const applyBtn = modal.querySelector("[data-mnrh-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-mnrh-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-mnrh-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => {
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
        if(!allSaved){
          window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור את הסימולטור עבור כל המבוטחים הרלוונטיים לפני האישור הסופי.", variant: "warn" });
          return;
        }
        this._showFinalSummary = true;
        this._render();
      });
      const summaryBackBtn = modal.querySelector("[data-mnrh-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-mnrh-summary-confirm]");
      if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => {
        try { this._ctx?.onFinalConfirm?.(); } catch(_e){}
        this.close();
      });
    },

    _switchInsured(targetId){
      if(!targetId || targetId === this._activeInsuredId) return;
      const st = this._state[this._activeInsuredId];
      if(st?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; }
      this._activeInsuredId = targetId;
      this._render();
    },

    _buildResultForInsured(insId){
      const st = this._state[insId];
      this._recalcState(st);
      if(!st?.result?.ok) return null;
      return {
        covers: st.result.covers.map((c) => ({
          id: c.id,
          label: c.label,
          wizardKey: c.wizardKey || c.label,
          monthlyPremium: c.monthlyPremium
        })),
        monthlyPremium: st.result.monthlyPremium,
        annualPremium: st.result.annualPremium,
        monthlyAgorot: st.result.monthlyAgorot,
        birthDate: st.birthDate || "",
        birthDateSource: st.birthDateSource || "",
        age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource,
        occupation: st.occupation || "", occupationSource: st.occupationSource || ""
      };
    },

    _apply(){
      const results = {};
      Object.keys(this._state).forEach((insId) => {
        const r = this._buildResultForInsured(insId);
        if(r) results[insId] = r;
      });
      if(!Object.keys(results).length){
        window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לבחור כיסויים ולחשב פרמיה לפני ההחלה על הפוליסה.", variant: "warn" });
        return;
      }
      const onApply = this._ctx?.onApply;
      this.close();
      try { onApply?.(results); } catch(_e) {}
    },

    _saveActive(){
      const insId = this._activeInsuredId;
      const result = this._buildResultForInsured(insId);
      if(!result){
        window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לבחור כיסויים תקינים לפני השמירה.", variant: "warn" });
        return;
      }
      try { this._ctx?.onApply?.({ [insId]: result }); } catch(_e) {}
      const st = this._state[insId];
      if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
      window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
      this._render();
    }
  };

  RiskSimulators.register("מנורה", "בריאות", MenoraHealthSimulator);
  // ===== סוף GI-MNR-HEALTH-SIM ====================================================

  // ===== GI-AYL-HEALTH-SIM 2026-08-09 · סימולטור בריאות איילון ==================
  // מקור אמת: תעריפי בריאות איילון.pdf (מהדורת יוני 2026) — תכניות בסיס/ניתוחים + אמבולטורי/כתבי שירות.
  // מחלות קשות / סרטן (בשביל החוסן) — סימולטורים נפרדים (לא כאן).
  // כל התעריפים באגורות (שלמים) כדי למנוע סטיית floating-point.
  // פרמיות מוצגות צמודות למדד (HealthCpi · ayalon_health).

  const AYALON_HEALTH_MIN_AGE = 0;
  const AYALON_HEALTH_MAX_AGE = 75;
  const AYALON_HEALTH_MIN_ENTRY_DAYS = 15;

  /** המרת שקלים → אגורות בשלמים (קלט מהתעריפון בלבד). */
  function ayalonHealthShekelsToAgorot(shekels){
    return Math.round(Number(shekels) * 100);
  }
  function ayalonHealthAgorotToShekels(agorot){
    return agorot / 100;
  }
  function formatAyalonHealthExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    const whole = Math.trunc(ag / 100);
    const frac = Math.abs(ag % 100);
    return whole + "." + String(frac).padStart(2, "0");
  }

  /** מחפש תעריף בקבוצת גיל. bands: [{min,max,agorot}] */
  function ayalonHealthLookupBand(bands, age){
    const a = Number(age);
    if(!Number.isInteger(a)) return null;
    for(let i = 0; i < bands.length; i++){
      const b = bands[i];
      if(a >= b.min && a <= b.max) return b;
    }
    return null;
  }

  /**
   * קטלוג כיסויים — שמות label מה-PDF; wizardKey = מפתח ב-Wizard.healthCoversByCompany["איילון"].
   * מחלות קשות / סרטן — לא כאן. אין שדה עישון בבריאות. אין תעריף לפי מין בכיסויי הבריאות.
   */
  const AYALON_HEALTH_COVERS = [
    {
      id: "transplant",
      label: "השתלות וטיפולים מיוחדים בחו״ל",
      wizardKey: "השתלות וטיפולים מיוחדים בחו\"ל",
      group: "דבר ראשון — בסיסי",
      needsGender: false,
      includes: "• שיפוי מלא להשתלה / טיפול מיוחד בחו״ל בעת פניה לספק בהסכם\n• שיפוי להשתלת איבר שנלקח מאדם אחר עד ₪5,000,000 (כבד, כליה, לב, ריאה, לבלב, מעי, שחלה וכל שילוב ביניהם)\n• שיפוי להשתלת איבר שנלקח מבעל חיים — עד ₪3,000,000\n• שיפוי בעת השתלת מח עצם / תאי גזע, שמקורם במבוטח עצמו — עד ₪150,000\n• שיפוי לטיפול מיוחד בחו״ל — עד ₪1,000,000\n• כיסוי להוצאות נלוות להשתלה ו/או טיפול מיוחד בחו״ל\n• גמלה חודשית לפני ואחרי השתלה בחו״ל\n• פיצוי במקרה של ביצוע השתלה בחו״ל ללא מעורבות המבטח",
      bands: [
        { min:0, max:20, agorot:1038 }, { min:21, max:30, agorot:1654 }, { min:31, max:40, agorot:1821 }, { min:41, max:50, agorot:2252 },
        { min:51, max:55, agorot:2459 }, { min:56, max:60, agorot:2732 }, { min:61, max:65, agorot:3098 }, { min:66, max:120, agorot:3162 }
      ]
    },
    {
      id: "drugs",
      label: "תרופות שלא בסל הבריאות",
      wizardKey: "תרופות מחוץ לסל הבריאות",
      group: "דבר ראשון — בסיסי",
      needsGender: false,
      includes: "• כיסוי לתרופות שאינן בסל הבריאות, לרבות:\n  ° תרופות המאושרות בסל אך להתוויה שונה (OFF LABEL)\n  ° תרופות יתום\n  ° תרופות מיוחדות (ג׳29)\n  ° כיסוי לבדיקה גנטית לצורך התאמת טיפול תרופתי למחלת הסרטן\n  ° בכפוף להשתתפות עצמית עד ₪40,000 במבוטח, 20%\n• סכום השיפוי המרבי: ₪3,000,000 מתמלא כל 24 חודשים\n• טיפול רפואי הכרוך במתן התרופה עד 60 ימים ועד ₪250 ליום\n• השתתפות עצמית של ₪300 למרשם\n• לתרופות מיוחדות ג׳29 — תקרה של ₪1,000,000, מתמלא כל 24 חודשים (תקרת שיפוי לחודש עד ₪200,000), בכפוף להשתתפות עצמית ₪500\n• פטור מהשתתפות עצמית לתרופה שעלותה החודשית גבוהה מ־₪5,000",
      bands: [
        { min:0, max:20, agorot:1323 }, { min:21, max:30, agorot:1833 }, { min:31, max:40, agorot:2580 }, { min:41, max:50, agorot:4194 },
        { min:51, max:55, agorot:6073 }, { min:56, max:60, agorot:8050 }, { min:61, max:65, agorot:10841 }, { min:66, max:120, agorot:14398 }
      ]
    },
    {
      id: "abroad_surgery",
      label: "ניתוחים ומחליפי ניתוח בחו״ל",
      wizardKey: "ניתוחים וטיפולים מחליפי ניתוח בחו\"ל",
      group: "דבר ראשון — בסיסי",
      needsGender: false,
      includes: "• שיפוי לביצוע ניתוח פרטי ו/או מחליף ניתוח בחו״ל, עפ״י בחירת המבוטח\n• לניתוח ומחליף ניתוח באמצעות איילון עם ספקי הסדר — שיפוי מלא\n• לניתוח או מחליף ניתוח שבוצע שלא באמצעות איילון — עד 250% מהעלויות הנקובות אצל ספק השירות לביצוע אותו ניתוח / מחליף ניתוח\n• התייעצויות עם רופא מומחה בישראל — 2\n• התייעצות אחת עם רופא מומחה מחוץ לישראל\n• הוצאות הטסה רפואית\n• הוצאות הבאת מומחה רפואי לישראל\n• הוצאות עלות שתל\n• הוצאות נוספות בגין ניתוח מורכב\n• עלות שכירות אחות פרטית\n• שהייה מחוץ לישראל לצורך ניתוח מורכב\n• טיפול פיזיותרפיה / ריפוי בעיסוק / התעמלות שיקומית\n• הוצאות למוסד החלמה מוכר\n• פיצוי בגין פטירת המבוטח",
      bands: [
        { min:0, max:20, agorot:666 }, { min:21, max:30, agorot:925 }, { min:31, max:40, agorot:1072 }, { min:41, max:50, agorot:1320 },
        { min:51, max:55, agorot:2183 }, { min:56, max:60, agorot:2676 }, { min:61, max:65, agorot:3050 }, { min:66, max:120, agorot:3135 }
      ]
    },
    {
      id: "surgery_first_shekel",
      label: "ניתוחים ומחליפי ניתוח פרטיים בארץ — מהשקל הראשון",
      wizardKey: "ניתוחים בישראל מהשקל הראשון",
      group: "דבר שני — ניתוחים בישראל",
      needsGender: false,
      includes: "• התייעצויות עם רופא מומחה, אגב ניתוח בארץ או מחליף ניתוח בארץ — 3\n• כיסוי להוצאות שכר מנתח\n• כיסוי להוצאות שכר מרדים\n• הוצאות אשפוז עד לתקרה של 30 ימי אשפוז, כולל אשפוז טרום ניתוח\n• הוצאת חדר ניתוח / מחליף ניתוח\n• הוצאות בגין בדיקות במהלך אשפוז\n• שתלים במהלך הניתוח — כיסוי מלא עד תקרת ספק שבהסכם\n• תרופות במהלך אשפוז",
      bands: [
        { min:0, max:20, agorot:4554 }, { min:21, max:30, agorot:9865 }, { min:31, max:40, agorot:12759 }, { min:41, max:50, agorot:19961 },
        { min:51, max:55, agorot:29929 }, { min:56, max:60, agorot:39114 }, { min:61, max:65, agorot:47187 }, { min:66, max:120, agorot:62491 }
      ]
    },
    {
      id: "surgery_shaban",
      label: "ניתוחים ומחליפי ניתוח פרטיים בארץ — משלים שב״ן",
      wizardKey: "משלים שב\"ן",
      group: "דבר שני — ניתוחים בישראל",
      needsGender: false,
      includes: "• התייעצויות עם רופא מומחה, אגב ניתוח בארץ או מחליף ניתוח בארץ — 3\n• בחירת הרופא המנתח, בית החולים, מועד הניתוח ושיפוי לשכר מנתח מעבר לזכאות בשב״ן\n• הוצאות חדר ניתוח\n• הוצאת אשפוז עד לתקרה של 30 ימי אשפוז, כולל אשפוז טרום ניתוח\n• שתלים במהלך הניתוח — כיסוי מלא\n• תרופות במהלך אשפוז\n• הכיסוי יינתן לאחר מיצוי הזכויות עם השב״ן",
      bands: [
        { min:0, max:20, agorot:1906 }, { min:21, max:30, agorot:3588 }, { min:31, max:40, agorot:6281 }, { min:41, max:50, agorot:8707 },
        { min:51, max:55, agorot:13904 }, { min:56, max:60, agorot:16935 }, { min:61, max:65, agorot:22411 }, { min:66, max:120, agorot:28999 }
      ]
    },
    {
      id: "surgery_shaban_5000",
      label: "משלים שב״ן עם השתתפות עצמית ₪5,000",
      wizardKey: "משלים שב\"ן עם השתתפות עצמית 5,000 ₪",
      group: "דבר שני — ניתוחים בישראל",
      needsGender: false,
      includes: "• התייעצויות עם רופא מומחה, אגב ניתוח בארץ או מחליף ניתוח בארץ — 3\n• בחירת הרופא המנתח, בית החולים, מועד הניתוח ושיפוי לשכר מנתח מעבר לזכאות בשב״ן ובכפוף להשתתפות עצמית\n• הוצאות חדר ניתוח\n• הוצאת אשפוז עד לתקרה של 30 ימי אשפוז, כולל אשפוז טרום ניתוח\n• שתלים במהלך הניתוח — כיסוי מלא\n• תרופות במהלך אשפוז\n• הכיסוי יינתן לאחר מיצוי הזכויות עם השב״ן ובכפוף להשתתפות עצמית",
      bands: [
        { min:0, max:20, agorot:1486 }, { min:21, max:30, agorot:2799 }, { min:31, max:40, agorot:4900 }, { min:41, max:50, agorot:6792 },
        { min:51, max:55, agorot:10845 }, { min:56, max:60, agorot:13209 }, { min:61, max:65, agorot:17481 }, { min:66, max:120, agorot:22620 }
      ]
    },
    {
      id: "ambulatory_extended",
      label: "שירותים אמבולטוריים לייעוץ ובדיקות — מורחב",
      wizardKey: "אמבולטורי מורחב",
      group: "דבר רביעי — שירותים אמבולטוריים",
      needsGender: false,
      // PDF עמ׳ 10: הפרמיה צמודה למדד 145.56 (בסיס שונה מרוב הכיסויים)
      baseIndexPoints: 145.56,
      includes: "• התייעצויות עם רופאים מומחים — תקרת החזר מוגדלת וקבועה לכל ייעוץ, ללא מכסה שנתית\n• התייעצות בנוגע לבעיות גיל המעבר ואנטי אייג׳ינג\n• בדיקות אבחנתיות ובדיקות הדמיה\n• אבחון וייעוץ גנטי למחלות תורשתיות\n• הראיית איברים פנימיים במערכת העיכול באמצעות קפסולה\n• כיסויים להריון ולידה — שיפוי, רשימה פתוחה של בדיקות הריון; עד 3 התייעצויות עם רופא מומחה בנושא הריון ולידה, איסוף ושימור דם טבורי\n• פריון ושירותי פונדקאות בישראל:\n  ° טיפולי פריון בישראל עקב ליקוי פריון של המבוטח/ת\n  ° שירותי פונדקאות בישראל – זכאות לשני בני זוג המבוטחים בפוליסה לרבות בני זוג מאותו המין\n  ° תקרת החזר עד לסכום של ₪32,974 לכל תקופת הביטוח\n• כיסויים למחלת הסרטן — רפואה מונעת:\n  ° בדיקת סקר לגילוי סרטן\n  ° בדיקת קולונוסקופיה מניעתית\n  ° חוות דעת שניה בחו״ל\n  ° בדיקת סקר תקופתית\n  ° בדיקת COLONFLAG — שירות מחקר אישי ממוקד",
      bands: [
        { min:0, max:17, agorot:2880 }, { min:18, max:30, agorot:7300 }, { min:31, max:55, agorot:8030 }, { min:56, max:64, agorot:8210 },
        { min:65, max:75, agorot:11800 }, { min:76, max:120, agorot:14410 }
      ]
    },
    {
      id: "ambulatory_consults",
      label: "שירותים אמבולטוריים לייעוץ ובדיקות",
      wizardKey: "ייעוץ ובדיקות",
      group: "דבר רביעי — שירותים אמבולטוריים",
      needsGender: false,
      // PDF עמ׳ 11: הפרמיה צמודה למדד 145.56
      baseIndexPoints: 145.56,
      includes: "• התייעצויות עם רופאים מומחים\n• התייעצות בנוגע לבעיות גיל המעבר ואנטי אייג׳ינג\n• בדיקות אבחנתיות ובדיקות הדמיה\n• אבחון וייעוץ גנטי למחלות תורשתיות\n• הראיית איברים פנימיים במערכת העיכול באמצעות קפסולה\n• כיסויים להריון ולידה — סקירה על־קולית לבדיקת מערכות עובר מוקדמת או מאוחרת, בדיקת שקיפות עורפית, בדיקת סקר ביוכימי משולש (חלבון עוברי), בדיקת מי שפיר, בדיקת NIPT, סיסי שילייה, ביצוע בדיקה לאבחון גנטי טרום הריון לתכנון המשפחה, בדיקת CMA (“צ׳יפ גנטי”), שיפוי ל־3 התייעצויות עם רופא מומחה בנושא הריון ולידה, איסוף ושימור דם טבורי\n• כיסויים למחלת הסרטן — רפואה מונעת:\n  ° בדיקת סקר לגילוי סרטן\n  ° בדיקת קולונוסקופיה מניעתית\n  ° חוות דעת שניה בחו״ל\n  ° בדיקת סקר תקופתית\n  ° בדיקת COLONFLAG — שירות מחקר אישי ממוקד",
      bands: [
        { min:0, max:17, agorot:1699 }, { min:18, max:30, agorot:4652 }, { min:31, max:55, agorot:5756 }, { min:56, max:64, agorot:6219 },
        { min:65, max:75, agorot:8359 }, { min:76, max:120, agorot:9723 }
      ]
    },
    {
      id: "ambulatory_treatments",
      label: "נספח לטיפולים",
      wizardKey: "טיפולים אמבולטוריים",
      group: "דבר רביעי — שירותים אמבולטוריים",
      needsGender: false,
      includes: "• טיפולים פרא רפואיים\n• מלונית לאחר לידה\n• הפריית מבחנה\n• טיפול מיוחד במחלת הסרטן\n• טיפולים פיזיותרפיים / הידרותרפיים\n• מרפאות כאב בבית חולים פרטי",
      bands: [
        { min:0, max:17, agorot:186 }, { min:18, max:30, agorot:508 }, { min:31, max:55, agorot:630 }, { min:56, max:64, agorot:680 },
        { min:65, max:75, agorot:914 }, { min:76, max:120, agorot:1063 }
      ]
    },
    {
      id: "fast_diagnosis",
      label: "נספח לשירותי אבחון מהיר",
      wizardKey: "אבחון רפואי מהיר",
      group: "דבר רביעי — שירותים אמבולטוריים",
      needsGender: false,
      maxEntryAge: 69,
      includes: "השירותים כוללים:\n• אבחון ראשוני ע״י רופא ממיון\n• בדיקה פיזיקאלית\n• בדיקות אבחנתיות ראשוניות\n• דוח אבחון ראשוני והמלצות להמשך טיפול\n• אבחון מורחב\n• פגישת סיכום\nבכפוף להשתתפויות עצמיות בהתאם למפורט בתנאי הנספח.\nלקבלת השירות, ניתן לפנות למוקד אבחון מהיר בבית חולים רפאל: טלפון 03-7752026.\nהשירותים יינתנו בבית החולים רפאל — פארק עתידים, תל אביב.",
      bands: [
        { min:0, max:20, agorot:406 }, { min:21, max:120, agorot:1876 }
      ]
    },
    {
      id: "tech_devices",
      label: "טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים",
      wizardKey: "טכנולוגיות מתקדמות ואביזרים רפואיים",
      group: "דבר רביעי — שירותים אמבולטוריים",
      needsGender: false,
      includes: "• טיפולים בתא לחץ\n• הזרקות לטיפולים רפואיים לרבות הזרקות של חומרי שגשוג למפרקים\n• טכנולוגיות לטיפול בכאב — החזר עד גובה של 80%\n• טכנולוגיות לטיפול עקב מחלה אונקולוגית — החזר עד גובה של 80%\n• החזר בגין אביזרים רפואיים שעלותם מעל ₪500\n• תקרת הכיסוי ₪80,000 לתקופת הביטוח אשר מתחדש כל שנתיים, בכפוף להשתתפות עצמית של 20%",
      bands: [
        { min:0, max:20, agorot:726 }, { min:21, max:30, agorot:1323 }, { min:31, max:35, agorot:1368 }, { min:36, max:40, agorot:1500 },
        { min:41, max:45, agorot:1687 }, { min:46, max:50, agorot:1971 }, { min:51, max:55, agorot:2271 }, { min:56, max:60, agorot:2897 },
        { min:61, max:65, agorot:3552 }, { min:66, max:120, agorot:4716 }
      ]
    },
    {
      id: "child_dev",
      label: "אבחונים וטיפולי התפתחות הילד",
      wizardKey: "טיפולים ואבחונים בהתפתחות הילד",
      group: "דבר שלישי — כתבי שירות",
      needsGender: false,
      maxAge: 21,
      includes: "• שירותי אבחון וייעוץ דידקטי ופסיכו־דידקטי\n• שירותי אבחון וייעוץ בהפרעות קשב וריכוז, בדיקה ממוחשבת מסוג TOVA, BRC, MOXO\n• טיפולים בהתפתחות הילד באמצעות מרפא בעיסוק או פיזיותרפיסט\n• טיפולים התפתחותיים — שחייה טיפולית, רכיבה טיפולית, טיפול באומנות, טיפול בתנועה, טיפול במוסיקה\n• טיפול באמצעות קלינאי תקשורת ו/או הוראה מתקנת\n• טיפול באמצעות פסיכולוג חינוכי / קליני / עובד סוציאלי / פסיכותרפיסט\n• ייעוץ דיאטטי – תזונאי / הפרעות אכילה\n• מאמן ספורט אישי\nהשירותים יינתנו באמצעות חברת פמי פרמיום בכפוף להשתתפות עצמית או בפנייה לספק, על פי בחירת המבוטח/ת, עד התקרות הנקובות בתנאי הנספח ובכפוף להשתתפות עצמית המפורטת.",
      bands: [
        { min:0, max:21, agorot:2640 }
      ]
    },
    {
      id: "complementary",
      label: "רפואה משלימה",
      wizardKey: "רפואה משלימה",
      group: "דבר שלישי — כתבי שירות",
      needsGender: false,
      includes: "• השירותים יסופקו על ידי ספק השירותים Targetcare\n• רשימת השירותים: אקופונקטורה, סוג׳וק, עיסוי רפואי עקב אשפוז כתוצאה מתאונה, רפלקסולוגיה, שיאצו, פלדנקרייז, אוסטיאופתיה, שיטת אלכסנדר, ביו פידבק, הומיאופתיה, כירופרקטיקה, נטורופתיה, פרחי באך, חדרי מלח\n• עד 20 טיפולים בשנת הביטוח ובכפוף להשתתפות עצמית\n• מוקד ״טרגט־קייר״, טל׳ 072-2756606, ימים א׳–ה׳, 08:00–16:00",
      bands: [
        { min:0, max:25, agorot:977 }, { min:26, max:70, agorot:1725 }, { min:71, max:75, agorot:1832 }
      ]
    },
    {
      id: "online",
      label: "רפואה אונליין — ייעוץ רופא מומחה בקליק",
      wizardKey: "ייעוץ אונליין — רופא מומחה בקליק",
      group: "דבר שלישי — כתבי שירות",
      needsGender: false,
      includes: "קבלת ייעוץ רפואי אונליין מקוונת, מבלי לצאת מהבית, באמצעות שיחת וידאו / שיחה טלפונית עם רופאים מומחים, לרבות רפואת משפחה וילדים.\n• עלות כתב השירות למנוי (בגילאי 0–75): ₪19.45 לחודש\n• השתתפות עצמית: התייעצות עם רופאים מומחים / משפחה / ילדים — ₪120; איסוף מידע / תיקים רפואיים לצורך הייעוץ — ₪90\n• דמי הביטוח נקובים ב־₪ וצמודים למדד\n• פרמיה קבועה\n• השירות ניתן על ידי ספק השירותים \"פמי פרימיום\", טל׳ 03-6388448",
      bands: [
        { min:0, max:75, agorot:1945 }
      ]
    },
    {
      id: "home",
      label: "איילון עד הבית",
      wizardKey: "איילון עד הבית",
      group: "דבר שלישי — כתבי שירות",
      needsGender: false,
      maxEntryAge: 69,
      includes: "השירותים כוללים:\n• ביקור רופא עד הבית\n  ° שירות רפואי בבית המבוטח או במקום הימצאו\n  ° קבלת שירות עד הבית תוך 3 שעות ממועד הפנייה\n  ° השירות כולל, בין היתר, בדיקה רפואית ומתן מרשם לתרופות על פי החלטת הרופא\n  ° השתתפות עצמית בסך ₪25\n• שירותי מעבדה עד הבית\n  ° קבלת שירות מעבדה בבית המבוטח, כגון: בדיקות דם ושתן\n  ° השירות יינתן כנגד הצגת טופס הפנייה לבדיקות מעבדה (ההפנייה תינתן גם על ידי רופא עד הבית או רופא אונליין)\n  ° השתתפות עצמית בסך ₪40\n• רופא ילדים / משפחה אונליין\n  ° רופא אונליין, בין השעות 7:00 עד 19:00\n  ° ללא השתתפות עצמית",
      bands: [
        { min:0, max:20, agorot:1739 }, { min:21, max:69, agorot:2826 }
      ]
    },
    {
      id: "sports",
      label: "איילון ספורטיבי",
      wizardKey: "איילון ספורטיבי",
      group: "דבר שלישי — כתבי שירות",
      needsGender: false,
      maxEntryAge: 69,
      includes: "• הוצאות בגין פינוי אמבולנס\n• ייעוץ עם רופא מומחה באורתופדיה / קרדיולוגיה\n• ייעוץ עם רופא מומחה בפיזיותרפיה / הידרותרפיה\n• מפגשי טיפול עם רופא מומחה ברפואת כאב\n• החזר בגין הקפאת מנוי בחדר כושר",
      bands: [
        { min:0, max:20, agorot:1152 }, { min:21, max:69, agorot:1806 }
      ]
    },
    {
      id: "crisis_bar_gefen",
      label: "ניהול משברים בר גפן",
      wizardKey: "ניהול משברים בר גפן",
      group: "דבר שלישי — כתבי שירות",
      needsGender: false,
      maxEntryAge: 65,
      includes: "• סיוע והכוונה מול הביטוח הלאומי ורשויות המס\n• עזרה וסיוע מול רשויות המס\n• איתור מומחים רפואיים ופרא רפואיים\n• עזרה וסיוע באיתור מטפל זר וסיוע בהוצאת היתר\n• סיוע בהוצאת תו נכה\n• סיוע והכוונה במיצוי זכויות מול משרדי ממשלה וגופים ציבוריים\n• הפניה ליועצים חיצוניים (עורכי דין, רואי חשבון, מטפלים)\n• תקופת אכשרה של 90 ימים\n• ללא השתתפות עצמית",
      bands: [
        { min:0, max:20, agorot:577 }, { min:21, max:55, agorot:1153 }, { min:56, max:65, agorot:2307 }, { min:66, max:120, agorot:2884 }
      ]
    }
  ];

  const AYALON_HEALTH_COVER_BY_ID = AYALON_HEALTH_COVERS.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

  const AYALON_HEALTH_CPI_KEY = "ayalon_health";
  const AYALON_HEALTH_DEFAULT_BASE_INDEX = HealthCpi.TARIFFS.ayalon_health.baseIndexPoints; // 142.34

  function ayalonHealthCoverBaseIndexPoints(cover){
    const v = Number(cover?.baseIndexPoints);
    if(Number.isFinite(v) && v > 0) return v;
    return AYALON_HEALTH_DEFAULT_BASE_INDEX;
  }

  /** מחשב פרמיה חודשית לכיסוי בודד — אחרי הצמדה למדד (base* = תעריפון PDF). */
  function computeAyalonHealthCoverPremium(coverId, age, gender){
    const cover = AYALON_HEALTH_COVER_BY_ID[coverId];
    if(!cover) return { ok:false, reason:"cover_missing" };
    const a = Number(age);
    if(!Number.isInteger(a)) return { ok:false, reason:"age_missing" };
    if(a < AYALON_HEALTH_MIN_AGE || a > AYALON_HEALTH_MAX_AGE) return { ok:false, reason:"age_out_of_range" };
    if(cover.maxAge != null && a > cover.maxAge) return { ok:false, reason:"age_cover_limit", coverMaxAge: cover.maxAge };
    if(cover.maxEntryAge != null && a > cover.maxEntryAge) return { ok:false, reason:"age_cover_limit", coverMaxAge: cover.maxEntryAge };
    const band = ayalonHealthLookupBand(cover.bands, a);
    if(!band) return { ok:false, reason:"rate_missing" };
    let agorot = null;
    if(cover.needsGender){
      if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
      agorot = gender === "זכר" ? band.male : band.female;
    } else {
      agorot = band.agorot;
    }
    if(!Number.isInteger(agorot)) return { ok:false, reason:"rate_missing" };
    const basePts = ayalonHealthCoverBaseIndexPoints(cover);
    const indexed = HealthCpi.indexAgorot(agorot, AYALON_HEALTH_CPI_KEY, { baseIndexPoints: basePts });
    return {
      ok: true,
      coverId: cover.id,
      label: cover.label,
      baseMonthlyAgorot: indexed.baseAgorot,
      baseMonthlyPremium: ayalonHealthAgorotToShekels(indexed.baseAgorot),
      monthlyAgorot: indexed.indexedAgorot,
      monthlyPremium: ayalonHealthAgorotToShekels(indexed.indexedAgorot),
      indexFactor: indexed.factor,
      baseIndexPoints: basePts,
      indexInfo: indexed.indexInfo
    };
  }

  /** מחשב סל כיסויים נבחרים — סכום אגורות מדויק (אחרי הצמדה) */
  function computeAyalonHealthBundle(selectedIds, age, gender){
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if(!ids.length) return { ok:false, reason:"covers_missing", covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
    const covers = [];
    let totalAg = 0;
    let totalBaseAg = 0;
    let indexInfo = null;
    const basesUsed = {};
    for(let i = 0; i < ids.length; i++){
      const one = computeAyalonHealthCoverPremium(ids[i], age, gender);
      if(!one.ok) return { ok:false, reason: one.reason, failCoverId: ids[i], coverMaxAge: one.coverMaxAge, covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
      const meta = AYALON_HEALTH_COVER_BY_ID[one.coverId];
      if(!indexInfo) indexInfo = one.indexInfo || null;
      basesUsed[String(one.baseIndexPoints)] = one.indexInfo || null;
      covers.push({
        id: one.coverId,
        label: one.label,
        wizardKey: meta?.wizardKey || one.label,
        monthlyPremium: one.monthlyPremium,
        monthlyAgorot: one.monthlyAgorot,
        baseMonthlyPremium: one.baseMonthlyPremium,
        baseMonthlyAgorot: one.baseMonthlyAgorot,
        baseIndexPoints: one.baseIndexPoints,
        indexFactor: one.indexFactor
      });
      totalAg += one.monthlyAgorot;
      totalBaseAg += one.baseMonthlyAgorot;
    }
    return {
      ok: true,
      covers,
      monthlyAgorot: totalAg,
      monthlyPremium: ayalonHealthAgorotToShekels(totalAg),
      annualPremium: ayalonHealthAgorotToShekels(totalAg * 12),
      baseMonthlyAgorot: totalBaseAg,
      baseMonthlyPremium: ayalonHealthAgorotToShekels(totalBaseAg),
      indexFactor: indexInfo?.factor || 1,
      indexInfo,
      indexBases: basesUsed
    };
  }

  function formatAyalonHealthIndexMetaHtml(indexInfo, indexBases){
    if(!indexInfo) return "";
    if(!indexInfo.ok){
      return `<div class="lcAylHealth__indexMeta lcAylHealth__indexMeta--pending">ממתין למדד למ״ס — מוצגת כרגע פרמיית בסיס מהתעריפון</div>`;
    }
    const baseKeys = indexBases && typeof indexBases === "object" ? Object.keys(indexBases) : [];
    const uniqueBases = baseKeys.length ? baseKeys : [String(indexInfo.baseIndexPoints)];
    const factorsTxt = uniqueBases.map((b) => {
      const info = (indexBases && indexBases[b]) || indexInfo;
      const f = (Math.round((info?.factor || indexInfo.factor) * 10000) / 10000).toFixed(4);
      return `בסיס ${b} ×${f}`;
    }).join(" · ");
    return `<div class="lcAylHealth__indexMeta">
      הצמדה למדד: נוכחי ≈ ${escapeHtml(String(indexInfo.currentIndexPoints))}
      (${escapeHtml(safeTrim(indexInfo.currentMonthLabel))})
      · ${escapeHtml(factorsTxt)}
    </div>`;
  }

  const AYALON_HEALTH_SIM_MESSAGES = {
    birth_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young: `גיל הכניסה המינימלי הוא ${AYALON_HEALTH_MIN_ENTRY_DAYS} ימים.`,
    age_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range: `הגיל הביטוחי (שנים שלמות היום) חורג מטווח הכניסה ${AYALON_HEALTH_MIN_AGE}–${AYALON_HEALTH_MAX_AGE}.`,
    gender_missing: "יש לבחור מין.",
    covers_missing: "יש לסמן לפחות כיסוי אחד.",
    age_cover_limit: "הגיל חורג מהמותר לכיסוי שנבחר.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו.",
    cover_missing: "כיסוי לא מזוהה בתעריפון."
  };

  const AyalonHealthSimulator = {
    _modal: null,
    _ctx: null,
    _state: {},
    _activeInsuredId: null,
    _escHandler: null,
    _confirmSwitch: null,
    _showFinalSummary: false,
    _cpiUnsub: null,

    open(ctx){
      this.close();
      this._ctx = ctx || {};
      const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
      this._state = {};
      insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
      this._activeInsuredId = insureds[0]?.id || null;
      this._confirmSwitch = null;
      this._showFinalSummary = false;
      this._infoCoverId = null;
      this._mount();
      this._render();
      this._cpiUnsub = HealthCpi.onChange(() => { if(this._modal) this._render(); });
      HealthCpi.ensure().then(() => { if(this._modal) this._render(); }).catch(() => {});
    },

    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const birthDate = safeTrim(d.birthDate || "");
      const occupation = safeTrim(d.occupation || "");
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        age: "",
        ageSource: birthDate ? "step1" : "",
        ageRaw: null,
        entryDays: null,
        gender, genderSource: gender ? "step1" : "",
        occupation,
        occupationSource: occupation ? "step1" : "",
        selected: {},
        result: null,
        error: null,
        savedAt: null,
        dirtySinceSave: false
      };
      riskSimSyncAgeFromBirthDate(st, {
        minAge: AYALON_HEALTH_MIN_AGE,
        maxAge: AYALON_HEALTH_MAX_AGE,
        minEntryDays: AYALON_HEALTH_MIN_ENTRY_DAYS
      });
      return st;
    },

    _isInsuredRelevant(_ins){ return true; },

    close(){
      if(this._cpiUnsub){ try { this._cpiUnsub(); } catch(_e){} this._cpiUnsub = null; }
      if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
      if(this._modal){
        const m = this._modal;
        m.classList.add("giValModal--leaving");
        window.setTimeout(() => m.remove(), 200);
        this._modal = null;
      }
      this._ctx = null;
    },

    _mount(){
      const modal = document.createElement("div");
      modal.id = "lcAylHealthModal";
      modal.className = "giValModal lcAylHealthModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור בריאות איילון");
      document.body.appendChild(modal);
      this._modal = modal;
      this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
      document.addEventListener("keydown", this._escHandler);
      requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
    },

    _getInsuredLabel(insId){
      const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
      return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
    },

    _getActiveInsured(){
      return (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === this._activeInsuredId) || null;
    },

    _selectedIds(st){
      return AYALON_HEALTH_COVERS.map((c) => c.id).filter((id) => !!st?.selected?.[id]);
    },

    _syncAge(st){
      return riskSimSyncAgeFromBirthDate(st, {
        minAge: AYALON_HEALTH_MIN_AGE,
        maxAge: AYALON_HEALTH_MAX_AGE,
        minEntryDays: AYALON_HEALTH_MIN_ENTRY_DAYS
      });
    },

    _recalcState(st){
      if(!st) return;
      if(!st.selected || typeof st.selected !== "object") st.selected = {};
      const ageSync = this._syncAge(st);
      const ids = this._selectedIds(st);
      if(!ids.length){
        st.result = null;
        st.error = null;
        return;
      }
      if(!ageSync.ok){
        st.result = null;
        st.error = AYALON_HEALTH_SIM_MESSAGES[ageSync.reason] || AYALON_HEALTH_SIM_MESSAGES.birth_missing;
        return;
      }
      const calc = computeAyalonHealthBundle(ids, st.age, st.gender);
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        let msg = AYALON_HEALTH_SIM_MESSAGES[calc.reason] || "לא ניתן לחשב את הפרמיה.";
        if(calc.reason === "age_cover_limit" && calc.failCoverId){
          const c = AYALON_HEALTH_COVER_BY_ID[calc.failCoverId];
          msg = `הכיסוי "${c?.label || ""}" זמין עד גיל ${calc.coverMaxAge} בלבד.`;
        } else if(calc.failCoverId){
          const c = AYALON_HEALTH_COVER_BY_ID[calc.failCoverId];
          if(c) msg = `${msg} (${c.label})`;
        }
        st.error = msg;
      }
    },

    _render(){
      if(!this._modal) return;
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
      const isMulti = insureds.length > 1;
      if(this._showFinalSummary){
        this._renderFinalSummary(insureds);
        return;
      }
      const activeId = this._activeInsuredId;
      const st = this._state[activeId] || this._prefillFromInsured(null);
      const isStandalone = !!this._ctx?.standalone;
      this._recalcState(st);

      const tabsHtml = isMulti ? `<div class="lcAylHealth__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : "");
        return `<button type="button" class="lcAylHealth__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-aylh-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
      }).join("")}</div>` : "";

      const birthIso = riskSimBirthDateToIsoInput(st.birthDate || "");
      const birthMaxIso = riskSimIsoDateDaysAgo(AYALON_HEALTH_MIN_ENTRY_DAYS);
      const ageSync = this._syncAge(st);
      const ageDisplay = ageSync.ok ? String(ageSync.age) : "—";
      const ageHintHtml = !st.birthDate
        ? (isStandalone ? `<div class="lcAylHealth__hint lcAylHealth__hint--warn">יש לבחור תאריך לידה מלוח השנה</div>` : `<div class="lcAylHealth__hint lcAylHealth__hint--warn">לא נמצא תאריך לידה בפרטים האישיים — יש לבחור מלוח השנה</div>`)
        : (!ageSync.ok
          ? `<div class="lcAylHealth__hint lcAylHealth__hint--warn">${escapeHtml(AYALON_HEALTH_SIM_MESSAGES[ageSync.reason] || "תאריך לידה לא תקין לחישוב")}</div>`
          : `<div class="lcAylHealth__hint">גיל ביטוחי (שנים שלמות היום): <strong>${escapeHtml(ageDisplay)}</strong></div>`);
      const needsGenderSelected = this._selectedIds(st).some((id) => !!AYALON_HEALTH_COVER_BY_ID[id]?.needsGender);
      const genderHintHtml = (!needsGenderSelected || isStandalone || st.gender) ? "" : `<div class="lcAylHealth__hint lcAylHealth__hint--warn">לא נמצא מין — נדרש לכיסוי לפי מין</div>`;

      const groups = {};
      AYALON_HEALTH_COVERS.forEach((c) => {
        if(!groups[c.group]) groups[c.group] = [];
        groups[c.group].push(c);
      });
      const coversHtml = Object.keys(groups).map((g) => `
        <div class="lcAylHealth__group">
          <div class="lcAylHealth__groupTitle">${escapeHtml(g)}</div>
          <div class="lcAylHealth__coverList">
            ${groups[g].map((c) => {
              const checked = !!(st.selected && st.selected[c.id]);
              const one = checked ? computeAyalonHealthCoverPremium(c.id, st.age, st.gender) : null;
              const premTxt = one?.ok ? `₪${formatAyalonHealthExactAmount(one.monthlyPremium)}` : (checked && one && !one.ok ? "—" : "");
              const hasInfo = !!(c.includes && String(c.includes).trim());
              return `<div class="lcAylHealth__cover${checked ? " is-checked" : ""}">
                <label class="lcAylHealth__coverMain">
                  <input type="checkbox" data-aylh-cover="${escapeHtml(c.id)}"${checked ? " checked" : ""} />
                  <span class="lcAylHealth__coverLabel">${escapeHtml(c.label)}${c.needsGender ? ' <em>(לפי מין)</em>' : ""}${c.maxAge != null ? ` <em>(עד גיל ${c.maxAge})</em>` : ""}</span>
                </label>
                ${hasInfo ? `<button type="button" class="lcAylHealth__infoBtn" data-aylh-info="${escapeHtml(c.id)}" aria-label="מה כולל הכיסוי" title="מה כולל הכיסוי">מה כולל?</button>` : ""}
                <span class="lcAylHealth__coverPrem">${premTxt}</span>
              </div>`;
            }).join("")}
          </div>
        </div>`).join("");

      const selectedRows = (st.result?.covers || []).map((c) =>
        `<div class="lcAylHealth__selRow"><span>${escapeHtml(c.label)}</span><strong>₪${escapeHtml(formatAyalonHealthExactAmount(c.monthlyPremium))}</strong></div>`
      ).join("");

      const indexMetaHtml = formatAyalonHealthIndexMetaHtml(
        st.result?.indexInfo || HealthCpi.getIndexInfo(AYALON_HEALTH_CPI_KEY),
        st.result?.indexBases || null
      );
      const baseTotalHtml = (st.result?.ok && st.result.baseMonthlyPremium != null && Math.abs(st.result.baseMonthlyPremium - st.result.monthlyPremium) > 0.0001)
        ? `<div class="lcAylHealth__resultRow"><span>פרמיית בסיס (לפני מדד)</span><strong>₪${escapeHtml(formatAyalonHealthExactAmount(st.result.baseMonthlyPremium))}</strong></div>`
        : "";
      const resultHtml = st.error
        ? `<div class="lcAylHealth__result lcAylHealth__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcAylHealth__result lcAylHealth__result--ok">
            <div class="lcAylHealth__selTitle">כיסויים שנבחרו</div>
            ${selectedRows}
            ${baseTotalHtml}
            <div class="lcAylHealth__resultRow lcAylHealth__resultRow--main"><span>סה״כ פרמיה חודשית (צמודה למדד)</span><strong>₪${escapeHtml(formatAyalonHealthExactAmount(st.result.monthlyPremium))}</strong></div>
            <div class="lcAylHealth__resultRow"><span>סה״כ פרמיה שנתית</span><strong>₪${escapeHtml(formatAyalonHealthExactAmount(st.result.annualPremium))}</strong></div>
            ${indexMetaHtml}
          </div>` : `<div class="lcAylHealth__result lcAylHealth__result--empty">סמנו כיסויים כדי לראות פרמיה</div>`);

      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcAylHealth");
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "✚";

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcAylHealth__foot">
            <button type="button" class="btn btn--primary" data-aylh-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcAylHealth__foot">
            <button type="button" class="btn giValModal__closeBtn" data-aylh-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-aylh-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcAylHealth__foot">
            <button type="button" class="btn giValModal__closeBtn" data-aylh-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-aylh-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-aylh-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const infoCover = this._infoCoverId ? AYALON_HEALTH_COVER_BY_ID[this._infoCoverId] : null;
      const infoBody = infoCover?.includes
        ? String(infoCover.includes).split("\n").map((ln) => {
            const t = safeTrim(ln);
            if(!t) return "";
            if(t.startsWith("•") || t.startsWith("°")) return `<div class="lcAylHealth__infoLine">${escapeHtml(t)}</div>`;
            return `<div class="lcAylHealth__infoLine lcAylHealth__infoLine--text">${escapeHtml(t)}</div>`;
          }).join("")
        : "";
      const infoOverlayHtml = infoCover ? `
        <div class="lcAylHealth__overlay lcAylHealth__overlay--info" data-aylh-info-close="1">
          <div class="lcAylHealth__overlayCard lcAylHealth__infoCard" role="dialog" aria-modal="true" aria-label="מה כולל הכיסוי">
            <div class="lcAylHealth__infoHead">
              <div class="lcAylHealth__infoTitle">מה כולל הכיסוי</div>
              <button type="button" class="lcAylHealth__infoClose" data-aylh-info-close="1" aria-label="סגור">✕</button>
            </div>
            <div class="lcAylHealth__infoCoverName">${escapeHtml(infoCover.label || "")}</div>
            <div class="lcAylHealth__infoBody">${infoBody || `<div class="lcAylHealth__infoLine lcAylHealth__infoLine--text">אין תיאור זמין לכיסוי זה.</div>`}</div>
            <div class="lcAylHealth__infoFoot">
              <button type="button" class="btn btn--primary" data-aylh-info-close="1">סגור</button>
            </div>
          </div>
        </div>` : "";
      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcAylHealth__overlay">
          <div class="lcAylHealth__overlayCard">
            <div class="lcAylHealth__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcAylHealth__overlayBtns">
              <button type="button" class="btn btn--primary" data-aylh-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-aylh-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-aylh-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-aylh-close="1"></div>
        <div class="giValModal__card lcAylHealth__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור בריאות איילון</div>
            </div>
            <button type="button" class="lcAylHealth__closeX" data-aylh-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcAylHealth__body">
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcAylHealth__insuredLabel lcAylHealth__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcAylHealth__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcAylHealth__grid">
              <div class="lcAylHealth__field">
                <label class="lcAylHealth__label">תאריך לידה</label>
                <input class="lcAylHealth__input" type="date" data-aylh-field="birthDate" value="${escapeHtml(birthIso)}" max="${escapeHtml(birthMaxIso)}" />
                ${ageHintHtml}
              </div>
              <div class="lcAylHealth__field">
                <label class="lcAylHealth__label">מין</label>
                <div class="lcAylHealth__segmented">
                  <button type="button" class="lcAylHealth__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-aylh-field="gender" data-aylh-value="זכר">זכר</button>
                  <button type="button" class="lcAylHealth__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-aylh-field="gender" data-aylh-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcAylHealth__field lcAylHealth__field--wide">
                <label class="lcAylHealth__label">עיסוק</label>
                <input class="lcAylHealth__input" type="text" data-aylh-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            <div class="lcAylHealth__coversTitle">בחירת כיסויים <span class="lcAylHealth__coversCount">(${AYALON_HEALTH_COVERS.length})</span></div>
            <div class="lcAylHealth__coversWrap">${coversHtml}</div>
            ${occBlockHtml}
            ${resultHtml}
          </div>
          ${footHtml}
          ${infoOverlayHtml}
          ${confirmOverlayHtml}
        </div>`;
      this._bind();
    },

    _renderFinalSummary(insureds){
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const rows = relevant.map((ins) => {
        const ok = !!this._state[ins.id]?.savedAt;
        return `<div class="lcAylHealth__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-aylh-close="1"></div>
        <div class="giValModal__card lcAylHealth__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
            </div>
            <button type="button" class="lcAylHealth__closeX" data-aylh-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcAylHealth__body">${rows}</div>
          <div class="giValModal__foot lcAylHealth__foot">
            <button type="button" class="btn giValModal__closeBtn" data-aylh-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-aylh-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "aylh");
      $$("[data-aylh-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-aylh-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-aylh-tab"))));
      $$("[data-aylh-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-aylh-switch");
        const target = this._confirmSwitch?.targetId;
        this._confirmSwitch = null;
        if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); }
        else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); }
        else this._render();
      }));
      const birthInput = modal.querySelector('[data-aylh-field="birthDate"]');
      if(birthInput) on(birthInput, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        st.birthDate = riskSimBirthDateFromIsoInput(birthInput.value);
        st.birthDateSource = "manual";
        st.ageSource = "manual";
        st.dirtySinceSave = true;
        this._syncAge(st);
        this._render();
      });
      const occInput = modal.querySelector('[data-aylh-field="occupation"]');
      if(occInput){
        on(occInput, "input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.occupation = safeTrim(occInput.value);
          st.occupationSource = "manual"; st.dirtySinceSave = true;
        });
        on(occInput, "change", () => this._render());
        on(occInput, "blur", () => this._render());
      }
      $$("[data-aylh-cover]", modal).forEach((el) => on(el, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        if(!st.selected || typeof st.selected !== "object") st.selected = {};
        const id = el.getAttribute("data-aylh-cover");
        st.selected[id] = !!el.checked;
        st.dirtySinceSave = true;
        this._render();
      }));
      $$("[data-aylh-info]", modal).forEach((el) => on(el, "click", (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); } catch(_e) {}
        this._infoCoverId = el.getAttribute("data-aylh-info") || null;
        this._render();
      }));
      $$("[data-aylh-info-close]", modal).forEach((el) => on(el, "click", (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); } catch(_e) {}
        // לחיצה על הרקע סוגרת; לחיצה בתוך הכרטיס לא (למעט כפתורי סגור)
        if(el.classList.contains("lcAylHealth__overlay--info") && ev.target !== el) return;
        this._infoCoverId = null;
        this._render();
      }));
      const infoCard = modal.querySelector(".lcAylHealth__infoCard");
      if(infoCard) on(infoCard, "click", (ev) => { try { ev.stopPropagation(); } catch(_e) {} });
      const applyBtn = modal.querySelector("[data-aylh-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-aylh-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-aylh-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => {
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
        if(!allSaved){
          window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור את הסימולטור עבור כל המבוטחים הרלוונטיים לפני האישור הסופי.", variant: "warn" });
          return;
        }
        this._showFinalSummary = true;
        this._render();
      });
      const summaryBackBtn = modal.querySelector("[data-aylh-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-aylh-summary-confirm]");
      if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => {
        try { this._ctx?.onFinalConfirm?.(); } catch(_e){}
        this.close();
      });
    },

    _switchInsured(targetId){
      if(!targetId || targetId === this._activeInsuredId) return;
      const st = this._state[this._activeInsuredId];
      if(st?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; }
      this._activeInsuredId = targetId;
      this._render();
    },

    _buildResultForInsured(insId){
      const st = this._state[insId];
      this._recalcState(st);
      if(!st?.result?.ok) return null;
      return {
        covers: st.result.covers.map((c) => ({
          id: c.id,
          label: c.label,
          wizardKey: c.wizardKey || c.label,
          monthlyPremium: c.monthlyPremium
        })),
        monthlyPremium: st.result.monthlyPremium,
        annualPremium: st.result.annualPremium,
        monthlyAgorot: st.result.monthlyAgorot,
        birthDate: st.birthDate || "",
        birthDateSource: st.birthDateSource || "",
        age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource,
        occupation: st.occupation || "", occupationSource: st.occupationSource || ""
      };
    },

    _apply(){
      const results = {};
      Object.keys(this._state).forEach((insId) => {
        const r = this._buildResultForInsured(insId);
        if(r) results[insId] = r;
      });
      if(!Object.keys(results).length){
        window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לבחור כיסויים ולחשב פרמיה לפני ההחלה על הפוליסה.", variant: "warn" });
        return;
      }
      const onApply = this._ctx?.onApply;
      this.close();
      try { onApply?.(results); } catch(_e) {}
    },

    _saveActive(){
      const insId = this._activeInsuredId;
      const result = this._buildResultForInsured(insId);
      if(!result){
        window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לבחור כיסויים תקינים לפני השמירה.", variant: "warn" });
        return;
      }
      try { this._ctx?.onApply?.({ [insId]: result }); } catch(_e) {}
      const st = this._state[insId];
      if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
      window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
      this._render();
    }
  };

  RiskSimulators.register("איילון", "בריאות", AyalonHealthSimulator);
  // ===== סוף GI-AYL-HEALTH-SIM ====================================================


  // ===== GI-MNR-CI-SIM 2026-08-09 · סימולטורי מחלות קשות מנורה ==================
  // מקור אמת: תעריפי בריאות מנורה.pdf עמוד 3 — "תעריפונים מחלות קשות".
  // שני מסלולים נפרדים (סימולטורים נפרדים):
  //   1) קרן אור TOP  → מוצר מערכת: מחלות קשות
  //   2) קרן לחיים    → מוצר מערכת: סרטן
  //      הערה: ב-PDF אין טבלת "סרטן" נפרדת — זה המסלול השני בעמוד 3.
  //      שם התצוגה במודאל: "קרן לחיים". תעריפים מדויקים 1:1 מהטבלה בלבד.
  // תעריף = פרמיה חודשית בש״ח לכל ₪100,000 פיצוי. חישוב באגורות שלמות.

  const MENORA_CI_RATE_UNIT = 100000;
  const MENORA_CI_RATE_MAPS = {"orTop":{"1":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"2":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"3":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"4":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"5":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"6":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"7":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"8":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"9":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"10":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"11":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"12":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"13":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"14":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"15":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"16":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"17":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"18":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"19":{"mNS":1050,"mS":null,"fNS":1050,"fS":null},"20":{"mNS":1230,"mS":1410,"fNS":1340,"fS":1530},"21":{"mNS":1270,"mS":1480,"fNS":1390,"fS":1620},"22":{"mNS":1300,"mS":1560,"fNS":1450,"fS":1730},"23":{"mNS":1340,"mS":1630,"fNS":1520,"fS":1850},"24":{"mNS":1370,"mS":1710,"fNS":1590,"fS":1980},"25":{"mNS":1400,"mS":1780,"fNS":1660,"fS":2110},"26":{"mNS":1440,"mS":1860,"fNS":1760,"fS":2270},"27":{"mNS":1500,"mS":1950,"fNS":1880,"fS":2450},"28":{"mNS":1560,"mS":2080,"fNS":2020,"fS":2690},"29":{"mNS":1650,"mS":2230,"fNS":2180,"fS":2950},"30":{"mNS":1750,"mS":2400,"fNS":2360,"fS":3240},"31":{"mNS":1830,"mS":2580,"fNS":2520,"fS":3540},"32":{"mNS":1970,"mS":2840,"fNS":2730,"fS":3930},"33":{"mNS":2150,"mS":3180,"fNS":2990,"fS":4420},"34":{"mNS":2380,"mS":3610,"fNS":3300,"fS":5000},"35":{"mNS":2660,"mS":4140,"fNS":3660,"fS":5680},"36":{"mNS":2960,"mS":4770,"fNS":3990,"fS":6390},"37":{"mNS":3250,"mS":5530,"fNS":4240,"fS":6980},"38":{"mNS":4020,"mS":7010,"fNS":4370,"fS":7300},"39":{"mNS":4800,"mS":8510,"fNS":4890,"fS":8370},"40":{"mNS":5600,"mS":10030,"fNS":5440,"fS":9470},"41":{"mNS":6420,"mS":11590,"fNS":6010,"fS":10590},"42":{"mNS":7280,"mS":13200,"fNS":6610,"fS":11750},"43":{"mNS":8170,"mS":14850,"fNS":7240,"fS":12940},"44":{"mNS":9100,"mS":16570,"fNS":7910,"fS":14170},"45":{"mNS":10120,"mS":18400,"fNS":8610,"fS":15430},"46":{"mNS":11200,"mS":20290,"fNS":9350,"fS":16730},"47":{"mNS":12360,"mS":22320,"fNS":10110,"fS":18060},"48":{"mNS":13650,"mS":24510,"fNS":10910,"fS":19430},"49":{"mNS":15080,"mS":26900,"fNS":11740,"fS":20830},"50":{"mNS":16690,"mS":29550,"fNS":12610,"fS":22300},"51":{"mNS":18520,"mS":32490,"fNS":13530,"fS":23790},"52":{"mNS":20570,"mS":35740,"fNS":14490,"fS":25340},"53":{"mNS":22860,"mS":39340,"fNS":15520,"fS":26940},"54":{"mNS":25400,"mS":43270,"fNS":16610,"fS":28610},"55":{"mNS":28280,"mS":47660,"fNS":17780,"fS":30340},"56":{"mNS":31310,"mS":52230,"fNS":19010,"fS":32150},"57":{"mNS":34540,"mS":57060,"fNS":20320,"fS":34030},"58":{"mNS":37940,"mS":62090,"fNS":21710,"fS":35990},"59":{"mNS":41480,"mS":67270,"fNS":23190,"fS":38040},"60":{"mNS":45120,"mS":72530,"fNS":24740,"fS":40160},"61":{"mNS":48780,"mS":77770,"fNS":26370,"fS":42350},"62":{"mNS":52460,"mS":82990,"fNS":28060,"fS":44610},"63":{"mNS":56130,"mS":88160,"fNS":29790,"fS":46930},"64":{"mNS":59760,"mS":93250,"fNS":31580,"fS":49300},"65":{"mNS":63480,"mS":98440,"fNS":33410,"fS":51710},"66":{"mNS":67100,"mS":103490,"fNS":35270,"fS":54170},"67":{"mNS":70720,"mS":108520,"fNS":37160,"fS":56660},"68":{"mNS":74330,"mS":113550,"fNS":39080,"fS":59170},"69":{"mNS":77950,"mS":118570,"fNS":41010,"fS":61700},"70":{"mNS":81530,"mS":123550,"fNS":42950,"fS":64240},"71":{"mNS":87780,"mS":131810,"fNS":49710,"fS":74580},"72":{"mNS":95410,"mS":142080,"fNS":55510,"fS":82610},"73":{"mNS":103670,"mS":153080,"fNS":61570,"fS":90850},"74":{"mNS":111690,"mS":163410,"fNS":68160,"fS":99660}},"kerenChaim":{"1":{"mNS":450,"mS":null,"fNS":450,"fS":null},"2":{"mNS":450,"mS":null,"fNS":450,"fS":null},"3":{"mNS":450,"mS":null,"fNS":450,"fS":null},"4":{"mNS":450,"mS":null,"fNS":450,"fS":null},"5":{"mNS":450,"mS":null,"fNS":450,"fS":null},"6":{"mNS":450,"mS":null,"fNS":450,"fS":null},"7":{"mNS":450,"mS":null,"fNS":450,"fS":null},"8":{"mNS":450,"mS":null,"fNS":450,"fS":null},"9":{"mNS":450,"mS":null,"fNS":450,"fS":null},"10":{"mNS":450,"mS":null,"fNS":450,"fS":null},"11":{"mNS":450,"mS":null,"fNS":450,"fS":null},"12":{"mNS":450,"mS":null,"fNS":450,"fS":null},"13":{"mNS":450,"mS":null,"fNS":450,"fS":null},"14":{"mNS":450,"mS":null,"fNS":450,"fS":null},"15":{"mNS":450,"mS":null,"fNS":450,"fS":null},"16":{"mNS":450,"mS":null,"fNS":450,"fS":null},"17":{"mNS":450,"mS":null,"fNS":450,"fS":null},"18":{"mNS":450,"mS":null,"fNS":450,"fS":null},"19":{"mNS":450,"mS":null,"fNS":450,"fS":null},"20":{"mNS":520,"mS":520,"fNS":460,"fS":460},"21":{"mNS":520,"mS":520,"fNS":470,"fS":470},"22":{"mNS":520,"mS":520,"fNS":460,"fS":460},"23":{"mNS":560,"mS":560,"fNS":550,"fS":550},"24":{"mNS":570,"mS":570,"fNS":610,"fS":610},"25":{"mNS":600,"mS":600,"fNS":680,"fS":680},"26":{"mNS":630,"mS":630,"fNS":770,"fS":770},"27":{"mNS":670,"mS":670,"fNS":920,"fS":920},"28":{"mNS":720,"mS":720,"fNS":1130,"fS":1130},"29":{"mNS":800,"mS":800,"fNS":1370,"fS":1370},"30":{"mNS":860,"mS":860,"fNS":1630,"fS":1630},"31":{"mNS":890,"mS":890,"fNS":1890,"fS":1890},"32":{"mNS":960,"mS":960,"fNS":2200,"fS":2200},"33":{"mNS":1040,"mS":1040,"fNS":2600,"fS":2600},"34":{"mNS":1130,"mS":1130,"fNS":3010,"fS":3010},"35":{"mNS":1250,"mS":1250,"fNS":3470,"fS":3470},"36":{"mNS":1380,"mS":1380,"fNS":3840,"fS":3840},"37":{"mNS":1550,"mS":1550,"fNS":4010,"fS":4010},"38":{"mNS":1750,"mS":1750,"fNS":4050,"fS":4050},"39":{"mNS":1910,"mS":1910,"fNS":4060,"fS":4060},"40":{"mNS":2060,"mS":2060,"fNS":4120,"fS":4120},"41":{"mNS":2480,"mS":2480,"fNS":4360,"fS":4360},"42":{"mNS":2900,"mS":2900,"fNS":4770,"fS":4770},"43":{"mNS":3420,"mS":3420,"fNS":5410,"fS":5410},"44":{"mNS":3980,"mS":3980,"fNS":6050,"fS":6050},"45":{"mNS":4490,"mS":4490,"fNS":6680,"fS":6680},"46":{"mNS":4820,"mS":4820,"fNS":7250,"fS":7250},"47":{"mNS":5000,"mS":5000,"fNS":7690,"fS":7690},"48":{"mNS":5230,"mS":5230,"fNS":7930,"fS":7930},"49":{"mNS":5450,"mS":5450,"fNS":8150,"fS":8150},"50":{"mNS":5150,"mS":7560,"fNS":7710,"fS":9770},"51":{"mNS":5590,"mS":8220,"fNS":8290,"fS":10510},"52":{"mNS":6300,"mS":9260,"fNS":8860,"fS":11240},"53":{"mNS":7430,"mS":10910,"fNS":9690,"fS":12290},"54":{"mNS":8950,"mS":13150,"fNS":10630,"fS":13480},"55":{"mNS":10840,"mS":15930,"fNS":11570,"fS":14670},"56":{"mNS":12860,"mS":18890,"fNS":12410,"fS":15740},"57":{"mNS":15340,"mS":22540,"fNS":13300,"fS":16870},"58":{"mNS":18450,"mS":27110,"fNS":14460,"fS":18340},"59":{"mNS":22010,"mS":32340,"fNS":15700,"fS":19910},"60":{"mNS":25920,"mS":38080,"fNS":17050,"fS":21630},"61":{"mNS":28320,"mS":41600,"fNS":17840,"fS":22630},"62":{"mNS":30570,"mS":44920,"fNS":18640,"fS":23650},"63":{"mNS":32680,"mS":48010,"fNS":18890,"fS":23950},"64":{"mNS":33560,"mS":49300,"fNS":19130,"fS":24260},"65":{"mNS":36200,"mS":53180,"fNS":19370,"fS":24560},"66":{"mNS":38070,"mS":55930,"fNS":19500,"fS":24730},"67":{"mNS":39790,"mS":58460,"fNS":19640,"fS":24910},"68":{"mNS":41390,"mS":60810,"fNS":19770,"fS":25080},"69":{"mNS":42750,"mS":62810,"fNS":20120,"fS":25510},"70":{"mNS":43850,"mS":64420,"fNS":20470,"fS":25960},"71":{"mNS":45410,"mS":66710,"fNS":21140,"fS":26810},"72":{"mNS":46900,"mS":68910,"fNS":21830,"fS":27690},"73":{"mNS":48390,"mS":71090,"fNS":22500,"fS":28530},"74":{"mNS":49970,"mS":73410,"fNS":23100,"fS":29300}}};

  const MENORA_CI_PLANS = {
    orTop: {
      id: "orTop",
      pdfName: "קרן אור TOP",
      wizardCoverKey: "TOP קרן מחלות קשות",
      productKey: "מחלות קשות",
      title: "סימולטור מחלות קשות מנורה",
      subtitle: "קרן אור TOP — פרמיה חודשית לכל ₪100,000 פיצוי",
      minAge: 1,           // טבלת התעריף מתחילה ב-1–19
      maxEntryAge: 66,     // גיל כניסה מקסימלי
      minEntryDays: 15,
      minSumAdult: 50000,  // מינימום למבוגר
      minSumChild: 100000, // מינימום לילד עד גיל 20
      childMaxAge: 20,
      maxSum: 600000,
      supportsProgramMode: false,
      cssPrefix: "lcMnrCi",
      modalClass: "lcMnrCiModal"
    },
    kerenChaim: {
      id: "kerenChaim",
      pdfName: "קרן לחיים",
      wizardCoverKey: "קרן פיצוי לגילוי מחלת הסרטן",
      productKey: "סרטן",
      title: "סימולטור סרטן מנורה",
      subtitle: "תעריפון קרן לחיים (עמוד מחלות קשות) — פרמיה חודשית לכל ₪100,000 פיצוי",
      minAge: 1,
      maxEntryAge: 69,
      minEntryDays: 15,
      minSumBase: 100000,   // מינימלי כבסיס
      minSumAddon: 50000,   // מינימלי כתכנית נוספת
      maxSum: 400000,
      supportsProgramMode: true,
      cssPrefix: "lcMnrCi",
      modalClass: "lcMnrCiModal"
    }
  };

  /** גבולות סכום פיצוי לפי הערות התעריפון (עמוד 3) — תלוי גיל / סוג תכנית. */
  function menoraCiResolveSumLimits(planId, age, programMode){
    const plan = MENORA_CI_PLANS[planId];
    if(!plan) return { minSum: null, maxSum: null };
    if(planId === "orTop"){
      const a = Number(age);
      const hasAge = safeTrim(age) !== "" && Number.isInteger(a);
      const isChild = hasAge && a <= plan.childMaxAge;
      return { minSum: isChild ? plan.minSumChild : plan.minSumAdult, maxSum: plan.maxSum };
    }
    if(planId === "kerenChaim"){
      const minSum = programMode === "addon" ? plan.minSumAddon : plan.minSumBase;
      return { minSum, maxSum: plan.maxSum };
    }
    return { minSum: null, maxSum: null };
  }

  function menoraCiAgorotToShekels(agorot){
    return agorot / 100;
  }
  function formatMenoraCiExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    const whole = Math.trunc(ag / 100);
    const frac = Math.abs(ag % 100);
    return whole + "." + String(frac).padStart(2, "0");
  }

  function lookupMenoraCiRate(planId, { age, gender, smoker }){
    const plan = MENORA_CI_PLANS[planId];
    if(!plan) return { ok:false, reason:"plan_missing" };
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    if(ageNum < plan.minAge || ageNum > plan.maxEntryAge) return { ok:false, reason:"age_out_of_range" };
    const map = MENORA_CI_RATE_MAPS[planId];
    const row = map ? map[String(ageNum)] : null;
    if(!row) return { ok:false, reason:"age_out_of_range" };
    if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const key = gender === "זכר"
      ? (smoker ? "mS" : "mNS")
      : (smoker ? "fS" : "fNS");
    const rateAgorot = row[key];
    if(rateAgorot == null || !Number.isInteger(rateAgorot)) return { ok:false, reason:"rate_missing" };
    return {
      ok: true,
      rateAgorot,
      ratePerHundredThousand: menoraCiAgorotToShekels(rateAgorot),
      planId,
      pdfName: plan.pdfName
    };
  }

  function computeMenoraCiPremium(planId, { age, gender, smoker, compensation, programMode }){
    const plan = MENORA_CI_PLANS[planId];
    if(!plan) return { ok:false, reason:"plan_missing" };
    const sum = Number(String(compensation == null ? "" : compensation).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const limits = menoraCiResolveSumLimits(planId, age, programMode || "base");
    if(limits.minSum == null || limits.maxSum == null) return { ok:false, reason:"plan_missing" };
    if(sum < limits.minSum || sum > limits.maxSum){
      return { ok:false, reason:"sum_out_of_range", minSum: limits.minSum, maxSum: limits.maxSum };
    }
    const looked = lookupMenoraCiRate(planId, { age, gender, smoker });
    if(!looked.ok) return looked;
    const monthlyAgorotExact = (looked.rateAgorot * sum) / MENORA_CI_RATE_UNIT;
    if(!Number.isFinite(monthlyAgorotExact)) return { ok:false, reason:"rate_missing" };
    const monthlyPremium = monthlyAgorotExact / 100;
    const annualPremium = monthlyPremium * 12;
    return {
      ok: true,
      monthlyPremium,
      annualPremium,
      ratePerHundredThousand: looked.ratePerHundredThousand,
      compensation: sum,
      planId,
      programMode: programMode || "base",
      pdfName: looked.pdfName,
      wizardCoverKey: plan.wizardCoverKey,
      minSum: limits.minSum,
      maxSum: limits.maxSum
    };
  }

  const MENORA_CI_MESSAGES = {
    birth_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young: "גיל הכניסה המינימלי הוא 15 ימים.",
    age_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range: "הגיל הביטוחי (שנים שלמות היום) חורג מטווח הכניסה המותר למסלול זה.",
    gender_missing: "יש לבחור מין לפני חישוב הפרמיה.",
    smoker_missing: "יש לציין האם המבוטח מעשן/ת לפני חישוב הפרמיה.",
    sum_missing: "יש להזין סכום פיצוי תקין (גדול מאפס) לפני חישוב הפרמיה.",
    sum_out_of_range: "סכום הפיצוי חורג מהמינימום/מקסימום המותר למסלול זה.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו (למשל מעשן בגיל 1–19).",
    plan_missing: "מסלול לא מזוהה בתעריפון."
  };

  function createMenoraCiSimulator(planId){
    const plan = MENORA_CI_PLANS[planId];
    const P = plan.cssPrefix;

    return {
      _planId: planId,
      _modal: null,
      _ctx: null,
      _state: {},
      _activeInsuredId: null,
      _escHandler: null,
      _confirmSwitch: null,
      _showFinalSummary: false,

      open(ctx){
        this.close();
        this._ctx = ctx || {};
        const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
        this._state = {};
        insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
        this._activeInsuredId = insureds[0]?.id || null;
        this._confirmSwitch = null;
        this._showFinalSummary = false;
        this._mount();
        this._render();
      },

      _prefillFromInsured(ins){
        const d = ins?.data || {};
        const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
        const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : null);
        const birthDate = safeTrim(d.birthDate || "");
        const occupation = safeTrim(d.occupation || "");
        const st = {
          birthDate,
          birthDateSource: birthDate ? "step1" : "",
          age: "",
          ageSource: birthDate ? "step1" : "",
          ageRaw: null,
          entryDays: null,
          gender, genderSource: gender ? "step1" : "",
          smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "",
          occupation,
          occupationSource: occupation ? "step1" : "",
          programMode: "base",
          compensation: "",
          result: null,
          error: null,
          savedAt: null,
          dirtySinceSave: false
        };
        riskSimSyncAgeFromBirthDate(st, {
          minAge: plan.minAge,
          maxAge: plan.maxEntryAge,
          minEntryDays: plan.minEntryDays
        });
        return st;
      },

      _syncAge(st){
        return riskSimSyncAgeFromBirthDate(st, {
          minAge: plan.minAge,
          maxAge: plan.maxEntryAge,
          minEntryDays: plan.minEntryDays
        });
      },

      _isInsuredRelevant(_ins){ return true; },

      close(){
        if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
        if(this._modal){
          const m = this._modal;
          m.classList.add("giValModal--leaving");
          window.setTimeout(() => m.remove(), 200);
          this._modal = null;
        }
        this._ctx = null;
      },

      _mount(){
        const modal = document.createElement("div");
        modal.id = "lcMnrCiModal_" + planId;
        modal.className = "giValModal " + plan.modalClass;
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", plan.title);
        document.body.appendChild(modal);
        this._modal = modal;
        this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
        document.addEventListener("keydown", this._escHandler);
        requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
      },

      _getInsuredLabel(insId){
        const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
        return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
      },

      _calc(insId){
        const st = this._state[insId];
        if(!st) return;
        const ageSync = this._syncAge(st);
        if(!ageSync.ok){
          st.result = null;
          st.error = MENORA_CI_MESSAGES[ageSync.reason] || MENORA_CI_MESSAGES.birth_missing;
          if(ageSync.reason === "age_out_of_range"){
            st.error = `הגיל הביטוחי חורג מטווח הכניסה ${plan.minAge}–${plan.maxEntryAge} (שנים שלמות היום).`;
          }
          this._render();
          return;
        }
        const calc = computeMenoraCiPremium(planId, {
          age: st.age, gender: st.gender, smoker: st.smoker,
          compensation: st.compensation, programMode: st.programMode || "base"
        });
        if(calc.ok){
          st.result = calc;
          st.error = null;
        } else {
          st.result = null;
          let msg = MENORA_CI_MESSAGES[calc.reason] || "לא ניתן לחשב את הפרמיה.";
          if(calc.reason === "age_out_of_range"){
            msg = `לא נמצא תעריף לכניסה בגיל זה (טווח כניסה ${plan.minAge}–${plan.maxEntryAge}).`;
          } else if(calc.reason === "sum_out_of_range"){
            msg = `סכום הפיצוי חייב להיות בין ₪${formatRiskSimSumInsuredDigits(calc.minSum)} ל-₪${formatRiskSimSumInsuredDigits(calc.maxSum)}.`;
          }
          st.error = msg;
        }
        this._render();
      },

      _render(){
        if(!this._modal) return;
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
        const isMulti = insureds.length > 1;
        if(this._showFinalSummary){
          this._renderFinalSummary(insureds);
          return;
        }
        const activeId = this._activeInsuredId;
        const st = this._state[activeId] || this._prefillFromInsured(null);
        const isStandalone = !!this._ctx?.standalone;

        const tabsHtml = isMulti ? `<div class="${P}__tabs">${insureds.map((ins) => {
          const s = this._state[ins.id];
          const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : "");
          return `<button type="button" class="${P}__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-mnrci-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
        }).join("")}</div>` : "";

        const birthIso = riskSimBirthDateToIsoInput(st.birthDate || "");
        const birthMaxIso = riskSimIsoDateDaysAgo(plan.minEntryDays);
        const ageSync = this._syncAge(st);
        const sumLimits = menoraCiResolveSumLimits(planId, st.age, st.programMode || "base");
        const ageHintHtml = !st.birthDate
          ? (isStandalone
            ? `<div class="${P}__hint ${P}__hint--warn">יש לבחור תאריך לידה מלוח השנה</div>`
            : `<div class="${P}__hint ${P}__hint--warn">לא נמצא תאריך לידה בפרטים האישיים — יש לבחור מלוח השנה</div>`)
          : (!ageSync.ok
            ? `<div class="${P}__hint ${P}__hint--warn">${escapeHtml(
                ageSync.reason === "age_out_of_range"
                  ? `הגיל הביטוחי חורג מטווח הכניסה ${plan.minAge}–${plan.maxEntryAge}`
                  : (MENORA_CI_MESSAGES[ageSync.reason] || "תאריך לידה לא תקין לחישוב")
              )}</div>`
            : `<div class="${P}__hint">גיל ביטוחי (שנים שלמות היום): <strong>${escapeHtml(String(ageSync.age))}</strong></div>`);
        const genderHintHtml = (isStandalone || st.gender) ? "" : `<div class="${P}__hint ${P}__hint--warn">לא נמצא מין בפרטים האישיים — יש לבחור</div>`;
        const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false) ? "" : `<div class="${P}__hint ${P}__hint--warn">לא נמצא סטטוס עישון בפרטים האישיים — יש לבחור</div>`;
        const programModeHtml = plan.supportsProgramMode ? `
                <div class="${P}__field ${P}__field--wide">
                  <label class="${P}__label">סוג תכנית (לפי התעריפון)</label>
                  <div class="${P}__segmented">
                    <button type="button" class="${P}__segBtn${(st.programMode || "base") === "base" ? " is-active" : ""}" data-mnrci-field="programMode" data-mnrci-value="base">כבסיס (מינ׳ ₪${formatRiskSimSumInsuredDigits(plan.minSumBase)})</button>
                    <button type="button" class="${P}__segBtn${st.programMode === "addon" ? " is-active" : ""}" data-mnrci-field="programMode" data-mnrci-value="addon">כתכנית נוספת (מינ׳ ₪${formatRiskSimSumInsuredDigits(plan.minSumAddon)})</button>
                  </div>
                </div>` : "";

        const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
          ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
          : "✚";
        const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
        const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, P);

        const resultHtml = st.error
          ? `<div class="${P}__result ${P}__result--error">${escapeHtml(st.error)}</div>`
          : (st.result ? `<div class="${P}__result ${P}__result--ok">
              <div class="${P}__resultRow"><span>מסלול</span><strong>${escapeHtml(st.result.pdfName)}</strong></div>
              <div class="${P}__resultRow"><span>תעריף ל-₪100,000</span><strong>₪${escapeHtml(formatMenoraCiExactAmount(st.result.ratePerHundredThousand))}</strong></div>
              <div class="${P}__resultRow"><span>סכום פיצוי</span><strong>₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.compensation))}</strong></div>
              <div class="${P}__resultRow ${P}__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatMenoraCiExactAmount(st.result.monthlyPremium))}</strong></div>
              <div class="${P}__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatMenoraCiExactAmount(st.result.annualPremium))}</strong></div>
            </div>` : `<div class="${P}__result ${P}__result--empty">מלאו את השדות ולחצו "חשב פרמיה"</div>`);

        const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
        const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

        const footHtml = isStandalone ? `
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn btn--primary" data-mnrci-close="1">סגור</button>
            </div>` : (!isMulti ? `
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn giValModal__closeBtn" data-mnrci-close="1">ביטול</button>
              <button type="button" class="btn btn--primary" data-mnrci-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
            </div>` : `
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn giValModal__closeBtn" data-mnrci-close="1">ביטול</button>
              <button type="button" class="btn btn--secondary" data-mnrci-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
              <button type="button" class="btn btn--primary" data-mnrci-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
            </div>`);

        const confirmOverlayHtml = this._confirmSwitch ? `
          <div class="${P}__overlay">
            <div class="${P}__overlayCard">
              <div class="${P}__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
              <div class="${P}__overlayBtns">
                <button type="button" class="btn btn--primary" data-mnrci-switch="save">שמור ועבור</button>
                <button type="button" class="btn btn--secondary" data-mnrci-switch="discard">עבור ללא שמירה</button>
                <button type="button" class="btn" data-mnrci-switch="cancel">ביטול</button>
              </div>
            </div>
          </div>` : "";

        this._modal.innerHTML = `
          <div class="giValModal__backdrop" data-mnrci-close="1"></div>
          <div class="giValModal__card ${P}__card">
            <div class="giValModal__head">
              <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
              <div class="giValModal__headText">
                <div class="giValModal__title">${escapeHtml(plan.title)}</div>
                <div class="giValModal__sub">${escapeHtml(plan.subtitle)}</div>
              </div>
              <button type="button" class="${P}__closeX" data-mnrci-close="1" aria-label="סגירה">✕</button>
            </div>
            <div class="giValModal__body ${P}__body">
              ${tabsHtml}
              ${isStandalone
                ? `<div class="${P}__insuredLabel ${P}__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
                : `<div class="${P}__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
              <div class="${P}__grid">
                <div class="${P}__field">
                  <label class="${P}__label">תאריך לידה</label>
                  <input class="${P}__input" type="date" data-mnrci-field="birthDate" value="${escapeHtml(birthIso)}" max="${escapeHtml(birthMaxIso)}" />
                  ${ageHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">מין</label>
                  <div class="${P}__segmented">
                    <button type="button" class="${P}__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-mnrci-field="gender" data-mnrci-value="זכר">זכר</button>
                    <button type="button" class="${P}__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-mnrci-field="gender" data-mnrci-value="נקבה">נקבה</button>
                  </div>
                  ${genderHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">עישון</label>
                  <div class="${P}__segmented">
                    <button type="button" class="${P}__segBtn${st.smoker === false ? " is-active" : ""}" data-mnrci-field="smoker" data-mnrci-value="0">לא מעשן/ת</button>
                    <button type="button" class="${P}__segBtn${st.smoker === true ? " is-active" : ""}" data-mnrci-field="smoker" data-mnrci-value="1">מעשן/ת</button>
                  </div>
                  ${smokerHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">סכום פיצוי (₪${formatRiskSimSumInsuredDigits(sumLimits.minSum)}–₪${formatRiskSimSumInsuredDigits(sumLimits.maxSum)})</label>
                  <input class="${P}__input" type="text" inputmode="numeric" data-mnrci-field="compensation" value="${escapeHtml(st.compensation || "")}" placeholder="לדוגמה: 100,000" />
                </div>
                ${programModeHtml}
                <div class="${P}__field ${P}__field--wide">
                  <label class="${P}__label">עיסוק</label>
                  <input class="${P}__input" type="text" data-mnrci-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
                </div>
              </div>
              <div class="${P}__actions">
                <button type="button" class="btn btn--primary" data-mnrci-calc="1">חשב פרמיה</button>
              </div>
              ${occBlockHtml}
              ${resultHtml}
            </div>
            ${footHtml}
            ${confirmOverlayHtml}
          </div>`;
        this._bind();
      },

      _renderFinalSummary(insureds){
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const rows = relevant.map((ins) => {
          const ok = !!this._state[ins.id]?.savedAt;
          return `<div class="${P}__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
        }).join("");
        this._modal.innerHTML = `
          <div class="giValModal__backdrop" data-mnrci-close="1"></div>
          <div class="giValModal__card ${P}__card">
            <div class="giValModal__head">
              <div class="giValModal__headText">
                <div class="giValModal__title">סיכום סימולטור להצעה</div>
              </div>
              <button type="button" class="${P}__closeX" data-mnrci-close="1" aria-label="סגירה">✕</button>
            </div>
            <div class="giValModal__body ${P}__body">${rows}</div>
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn giValModal__closeBtn" data-mnrci-summary-back="1">חזרה</button>
              <button type="button" class="btn btn--primary" data-mnrci-summary-confirm="1">אישור סופי</button>
            </div>
          </div>`;
        this._bind();
      },

      _bind(){
        const modal = this._modal;
        if(!modal) return;
        ensureSegFieldDelegation(modal, this, "mnrci");
        $$("[data-mnrci-close]", modal).forEach((el) => on(el, "click", () => this.close()));
        $$("[data-mnrci-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-mnrci-tab"))));
        $$("[data-mnrci-switch]", modal).forEach((el) => on(el, "click", () => {
          const action = el.getAttribute("data-mnrci-switch");
          const target = this._confirmSwitch?.targetId;
          this._confirmSwitch = null;
          if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); }
          else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); }
          else this._render();
        }));
        const birthInput = modal.querySelector('[data-mnrci-field="birthDate"]');
        if(birthInput) on(birthInput, "change", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = riskSimBirthDateFromIsoInput(birthInput.value);
          st.birthDateSource = "manual";
          st.ageSource = "manual";
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._syncAge(st);
          this._render();
        });
        const sumInput = modal.querySelector('[data-mnrci-field="compensation"]');
        if(sumInput) on(sumInput, "input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          const formatted = formatRiskSimSumInsuredDigits(sumInput.value);
          sumInput.value = formatted;
          try { sumInput.setSelectionRange(formatted.length, formatted.length); } catch(_e){}
          st.compensation = formatted;
          st.result = null; st.error = null; st.dirtySinceSave = true;
        });
        const occInput = modal.querySelector('[data-mnrci-field="occupation"]');
        if(occInput){
          on(occInput, "input", () => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.occupation = safeTrim(occInput.value);
            st.occupationSource = "manual"; st.dirtySinceSave = true;
          });
          on(occInput, "change", () => this._render());
          on(occInput, "blur", () => this._render());
        }
        const calcBtn = modal.querySelector("[data-mnrci-calc]");
        if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
        const applyBtn = modal.querySelector("[data-mnrci-apply]");
        if(applyBtn) on(applyBtn, "click", () => this._apply());
        const saveBtn = modal.querySelector("[data-mnrci-save]");
        if(saveBtn) on(saveBtn, "click", () => this._saveActive());
        const finalBtn = modal.querySelector("[data-mnrci-finalconfirm]");
        if(finalBtn) on(finalBtn, "click", () => {
          const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
          const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
          const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
          if(!allSaved){
            window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור את הסימולטור עבור כל המבוטחים הרלוונטיים לפני האישור הסופי.", variant: "warn" });
            return;
          }
          this._showFinalSummary = true;
          this._render();
        });
        const summaryBackBtn = modal.querySelector("[data-mnrci-summary-back]");
        if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
        const summaryConfirmBtn = modal.querySelector("[data-mnrci-summary-confirm]");
        if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => {
          try { this._ctx?.onFinalConfirm?.(); } catch(_e){}
          this.close();
        });
      },

      _switchInsured(targetId){
        if(!targetId || targetId === this._activeInsuredId) return;
        const st = this._state[this._activeInsuredId];
        if(st?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; }
        this._activeInsuredId = targetId;
        this._render();
      },

      _buildResultForInsured(insId){
        const st = this._state[insId];
        if(!st) return null;
        const ageSync = this._syncAge(st);
        if(!ageSync.ok) return null;
        if(!st.result?.ok){
          const calc = computeMenoraCiPremium(planId, {
            age: st.age, gender: st.gender, smoker: st.smoker,
            compensation: st.compensation, programMode: st.programMode || "base"
          });
          if(!calc.ok) return null;
          st.result = calc; st.error = null;
        }
        const r = st.result;
        return {
          compensation: formatRiskSimSumInsuredDigits(r.compensation),
          monthlyPremium: r.monthlyPremium,
          annualPremium: r.annualPremium,
          ratePerHundredThousand: r.ratePerHundredThousand,
          pdfName: r.pdfName,
          planId: r.planId,
          programMode: r.programMode || st.programMode || "base",
          wizardCoverKey: r.wizardCoverKey,
          birthDate: st.birthDate || "",
          birthDateSource: st.birthDateSource || "",
          age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource,
          smoker: st.smoker, smokerSource: st.smokerSource,
          occupation: st.occupation || "", occupationSource: st.occupationSource || ""
        };
      },

      _apply(){
        const results = {};
        Object.keys(this._state).forEach((insId) => {
          const r = this._buildResultForInsured(insId);
          if(r) results[insId] = r;
        });
        if(!Object.keys(results).length){
          window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה תקינה לפני ההחלה על הפוליסה.", variant: "warn" });
          return;
        }
        const onApply = this._ctx?.onApply;
        this.close();
        try { onApply?.(results); } catch(_e) {}
      },

      _saveActive(){
        const insId = this._activeInsuredId;
        const result = this._buildResultForInsured(insId);
        if(!result){
          window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה תקינה לפני השמירה.", variant: "warn" });
          return;
        }
        try { this._ctx?.onApply?.({ [insId]: result }); } catch(_e) {}
        const st = this._state[insId];
        if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
        window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
        this._render();
      }
    };
  }

  const MenoraCriticalIllnessSimulator = createMenoraCiSimulator("orTop");
  const MenoraCancerSimulator = createMenoraCiSimulator("kerenChaim");
  RiskSimulators.register("מנורה", "מחלות קשות", MenoraCriticalIllnessSimulator);
  RiskSimulators.register("מנורה", "סרטן", MenoraCancerSimulator);
  // ===== סוף GI-MNR-CI-SIM ========================================================



  // ===== GI-HACH-HEALTH-SIM 2026-08-10 · סימולטור בריאות הכשרה ==================
  // מקור אמת: תעריפי בריאות הכשרה.pdf — בסיס מדד 133.17 (13,317 נק׳) מ־15/12/2022.
  // מחלות קשות — סימולטור נפרד. אין שדה עישון בבריאות.

  const HACHSHARA_HEALTH_MIN_AGE = 0;
  const HACHSHARA_HEALTH_MAX_AGE = 75;
  const HACHSHARA_HEALTH_MIN_ENTRY_DAYS = 15; // לפי הערת גיל כניסה מינימלי ב-PDF

  /** המרת שקלים → אגורות בשלמים (קלט מהתעריפון בלבד, עד ספרה אחת אחרי הנקודה). */
  function hachsharaHealthShekelsToAgorot(shekels){
    return Math.round(Number(shekels) * 100);
  }
  function hachsharaHealthAgorotToShekels(agorot){
    return agorot / 100;
  }
  function formatHachsharaHealthExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    const whole = Math.trunc(ag / 100);
    const frac = Math.abs(ag % 100);
    return whole + "." + String(frac).padStart(2, "0");
  }

  /** מחפש תעריף בקבוצת גיל. bands: [{min,max,agorot}] או [{min,max,male,female}] */
  function hachsharaHealthLookupBand(bands, age){
    const a = Number(age);
    if(!Number.isInteger(a)) return null;
    for(let i = 0; i < bands.length; i++){
      const b = bands[i];
      if(a >= b.min && a <= b.max) return b;
    }
    return null;
  }

  /**
   * קטלוג כיסויים — שמות label מדויקים מה-PDF (עמודים 1–2).
   * wizardKey = המפתח ב-Wizard.healthCoversByCompany["הכשרה"] להחלה על הפוליסה.
   * מחלות קשות — סימולטור נפרד. אין שדה עישון בבריאות.
   * תעריפים באגורות, מדויקים 1:1 מול ה-PDF.
   */
  const HACHSHARA_HEALTH_COVERS = [
    { id: "drugs", label: "תרופות מחוץ לסל שירותי הבריאות", wizardKey: "תרופות מחוץ לסל שירותי הבריאות", group: "השתלות, תרופות וניתוחים בחו״ל", needsGender: false, bands: [{ min: 0, max: 20, agorot: 1150 }, { min: 21, max: 30, agorot: 1774 }, { min: 31, max: 40, agorot: 2382 }, { min: 41, max: 50, agorot: 3915 }, { min: 51, max: 55, agorot: 5500 }, { min: 56, max: 60, agorot: 7300 }, { min: 61, max: 65, agorot: 10000 }, { min: 66, max: 120, agorot: 13200 }] },
    { id: "transplant", label: "השתלות וטיפולים מיוחדים מחוץ לישראל", wizardKey: "השתלות וטיפולים מיוחדים מחוץ לישראל", group: "השתלות, תרופות וניתוחים בחו״ל", needsGender: false, bands: [{ min: 0, max: 20, agorot: 971 }, { min: 21, max: 30, agorot: 1568 }, { min: 31, max: 40, agorot: 1703 }, { min: 41, max: 50, agorot: 2107 }, { min: 51, max: 55, agorot: 2347 }, { min: 56, max: 60, agorot: 2659 }, { min: 61, max: 65, agorot: 3072 }, { min: 66, max: 120, agorot: 3254 }] },
    { id: "abroad_surgery", label: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", wizardKey: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", group: "השתלות, תרופות וניתוחים בחו״ל", needsGender: false, bands: [{ min: 0, max: 20, agorot: 623 }, { min: 21, max: 30, agorot: 866 }, { min: 31, max: 40, agorot: 991 }, { min: 41, max: 50, agorot: 1202 }, { min: 51, max: 55, agorot: 1900 }, { min: 56, max: 60, agorot: 2400 }, { min: 61, max: 65, agorot: 2800 }, { min: 66, max: 120, agorot: 2900 }] },
    { id: "surgery_shaban_5000", label: "ניתוחים בישראל — משלים שב״ן עם השתתפות עצמית 5,000 ₪", wizardKey: "משלים שב\"ן עם השתתפות עצמית 5,000 ₪", group: "ניתוחים וטיפולים מחליפי ניתוח בישראל", needsGender: false, bands: [{ min: 0, max: 20, agorot: 1409 }, { min: 21, max: 30, agorot: 2652 }, { min: 31, max: 40, agorot: 4643 }, { min: 41, max: 50, agorot: 6435 }, { min: 51, max: 55, agorot: 10277 }, { min: 56, max: 60, agorot: 12517 }, { min: 61, max: 65, agorot: 16877 }, { min: 66, max: 120, agorot: 21680 }] },
    { id: "surgery_shaban", label: "ניתוחים בישראל — משלים שב״ן ללא השתתפות עצמית", wizardKey: "משלים שב\"ן ללא השתתפות עצמית", group: "ניתוחים וטיפולים מחליפי ניתוח בישראל", needsGender: false, bands: [{ min: 0, max: 20, agorot: 1783 }, { min: 21, max: 30, agorot: 3357 }, { min: 31, max: 40, agorot: 5877 }, { min: 41, max: 50, agorot: 8146 }, { min: 51, max: 55, agorot: 13009 }, { min: 56, max: 60, agorot: 15844 }, { min: 61, max: 65, agorot: 21363 }, { min: 66, max: 120, agorot: 27443 }] },
    { id: "surgery_first_shekel", label: "ניתוחים בישראל מהשקל הראשון", wizardKey: "ניתוחים בישראל מהשקל הראשון", group: "ניתוחים וטיפולים מחליפי ניתוח בישראל", needsGender: false, bands: [{ min: 0, max: 20, agorot: 3104 }, { min: 21, max: 30, agorot: 8415 }, { min: 31, max: 40, agorot: 10670 }, { min: 41, max: 50, agorot: 16281 }, { min: 51, max: 55, agorot: 24777 }, { min: 56, max: 60, agorot: 32157 }, { min: 61, max: 65, agorot: 38643 }, { min: 66, max: 120, agorot: 50938 }] },
    { id: "ambulatory_consults", label: "אמבולטורי — ייעוץ ובדיקות", wizardKey: "ייעוץ ובדיקות", group: "שירותים אמבולטוריים", needsGender: false, bands: [{ min: 0, max: 20, agorot: 1044 }, { min: 21, max: 30, agorot: 4000 }, { min: 31, max: 40, agorot: 4000 }, { min: 41, max: 50, agorot: 4000 }, { min: 51, max: 55, agorot: 4000 }, { min: 56, max: 60, agorot: 4575 }, { min: 61, max: 65, agorot: 4575 }, { min: 66, max: 120, agorot: 5175 }] },
    { id: "child_premium", label: "שירות פרימיום לילד", wizardKey: "שירות פרימיום לילד", group: "כיסוי לילד", needsGender: false, maxAge: 25, bands: [{ min: 0, max: 25, agorot: 3050 }] }
  ];

  const HACHSHARA_HEALTH_COVER_BY_ID = HACHSHARA_HEALTH_COVERS.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

  const HACHSHARA_HEALTH_CPI_KEY = "hachshara_health";

  /** מחשב פרמיה חודשית לכיסוי בודד. מחזיר {ok, monthlyPremium, monthlyAgorot, reason?}
      monthlyPremium/monthlyAgorot = אחרי הצמדה למדד; base* = תעריפון PDF לפני הצמדה. */
  function computeHachsharaHealthCoverPremium(coverId, age, gender){
    const cover = HACHSHARA_HEALTH_COVER_BY_ID[coverId];
    if(!cover) return { ok:false, reason:"cover_missing" };
    const a = Number(age);
    if(!Number.isInteger(a)) return { ok:false, reason:"age_missing" };
    if(a < HACHSHARA_HEALTH_MIN_AGE || a > HACHSHARA_HEALTH_MAX_AGE) return { ok:false, reason:"age_out_of_range" };
    if(cover.maxAge != null && a > cover.maxAge) return { ok:false, reason:"age_cover_limit", coverMaxAge: cover.maxAge };
    const band = hachsharaHealthLookupBand(cover.bands, a);
    if(!band) return { ok:false, reason:"rate_missing" };
    let agorot = null;
    if(cover.needsGender){
      if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
      agorot = gender === "זכר" ? band.male : band.female;
    } else {
      agorot = band.agorot;
    }
    if(!Number.isInteger(agorot)) return { ok:false, reason:"rate_missing" };
    const indexed = HealthCpi.indexAgorot(agorot, HACHSHARA_HEALTH_CPI_KEY);
    return {
      ok: true,
      coverId: cover.id,
      label: cover.label,
      baseMonthlyAgorot: indexed.baseAgorot,
      baseMonthlyPremium: hachsharaHealthAgorotToShekels(indexed.baseAgorot),
      monthlyAgorot: indexed.indexedAgorot,
      monthlyPremium: hachsharaHealthAgorotToShekels(indexed.indexedAgorot),
      indexFactor: indexed.factor,
      indexInfo: indexed.indexInfo
    };
  }

  /** מחשב סל כיסויים נבחרים — סכום אגורות מדויק (אחרי הצמדה) */
  function computeHachsharaHealthBundle(selectedIds, age, gender){
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if(!ids.length) return { ok:false, reason:"covers_missing", covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
    const covers = [];
    let totalAg = 0;
    let totalBaseAg = 0;
    let indexInfo = null;
    for(let i = 0; i < ids.length; i++){
      const one = computeHachsharaHealthCoverPremium(ids[i], age, gender);
      if(!one.ok) return { ok:false, reason: one.reason, failCoverId: ids[i], coverMaxAge: one.coverMaxAge, covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
      const meta = HACHSHARA_HEALTH_COVER_BY_ID[one.coverId];
      if(!indexInfo) indexInfo = one.indexInfo || null;
      covers.push({
        id: one.coverId,
        label: one.label,
        wizardKey: meta?.wizardKey || one.label,
        monthlyPremium: one.monthlyPremium,
        monthlyAgorot: one.monthlyAgorot,
        baseMonthlyPremium: one.baseMonthlyPremium,
        baseMonthlyAgorot: one.baseMonthlyAgorot
      });
      totalAg += one.monthlyAgorot;
      totalBaseAg += one.baseMonthlyAgorot;
    }
    return {
      ok: true,
      covers,
      monthlyAgorot: totalAg,
      monthlyPremium: hachsharaHealthAgorotToShekels(totalAg),
      annualPremium: hachsharaHealthAgorotToShekels(totalAg * 12),
      baseMonthlyAgorot: totalBaseAg,
      baseMonthlyPremium: hachsharaHealthAgorotToShekels(totalBaseAg),
      indexFactor: indexInfo?.factor || 1,
      indexInfo
    };
  }

  function formatHachsharaHealthIndexMetaHtml(indexInfo){
    if(!indexInfo) return "";
    if(!indexInfo.ok){
      return `<div class="lcHachHealth__indexMeta lcHachHealth__indexMeta--pending">ממתין למדד למ״ס — מוצגת כרגע פרמיית בסיס מהתעריפון</div>`;
    }
    const factorTxt = (Math.round(indexInfo.factor * 10000) / 10000).toFixed(4);
    return `<div class="lcHachHealth__indexMeta">
      הצמדה למדד: בסיס ${escapeHtml(String(indexInfo.baseIndexPoints))}
      (${escapeHtml(indexInfo.baseKnownDate || "")})
      → נוכחי ≈ ${escapeHtml(String(indexInfo.currentIndexPoints))}
      (${escapeHtml(safeTrim(indexInfo.currentMonthLabel))})
      · מקדם ×${escapeHtml(factorTxt)}
    </div>`;
  }

  const HACHSHARA_HEALTH_SIM_MESSAGES = {
    birth_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young: `גיל הכניסה המינימלי הוא ${HACHSHARA_HEALTH_MIN_ENTRY_DAYS} ימים.`,
    age_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range: `הגיל הביטוחי (שנים שלמות היום) חורג מטווח הכניסה ${HACHSHARA_HEALTH_MIN_AGE}–${HACHSHARA_HEALTH_MAX_AGE}.`,
    gender_missing: "יש לבחור מין — נדרש לכיסוי ייעוצים ובדיקות.",
    covers_missing: "יש לסמן לפחות כיסוי אחד.",
    age_cover_limit: "הגיל חורג מהמותר לכיסוי שנבחר.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו.",
    cover_missing: "כיסוי לא מזוהה בתעריפון."
  };

  const HachsharaHealthSimulator = {
    _modal: null,
    _ctx: null,
    _state: {},
    _activeInsuredId: null,
    _escHandler: null,
    _confirmSwitch: null,
    _showFinalSummary: false,
    _cpiUnsub: null,

    open(ctx){
      this.close();
      this._ctx = ctx || {};
      const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
      this._state = {};
      insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
      this._activeInsuredId = insureds[0]?.id || null;
      this._confirmSwitch = null;
      this._showFinalSummary = false;
      this._mount();
      this._render();
      this._cpiUnsub = HealthCpi.onChange(() => { if(this._modal) this._render(); });
      HealthCpi.ensure().then(() => { if(this._modal) this._render(); }).catch(() => {});
    },

    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const birthDate = safeTrim(d.birthDate || "");
      const occupation = safeTrim(d.occupation || "");
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        age: "",
        ageSource: birthDate ? "step1" : "",
        ageRaw: null,
        entryDays: null,
        gender, genderSource: gender ? "step1" : "",
        occupation,
        occupationSource: occupation ? "step1" : "",
        selected: {},
        result: null,
        error: null,
        savedAt: null,
        dirtySinceSave: false
      };
      riskSimSyncAgeFromBirthDate(st, {
        minAge: HACHSHARA_HEALTH_MIN_AGE,
        maxAge: HACHSHARA_HEALTH_MAX_AGE,
        minEntryDays: HACHSHARA_HEALTH_MIN_ENTRY_DAYS
      });
      return st;
    },

    _isInsuredRelevant(_ins){ return true; },

    close(){
      if(this._cpiUnsub){ try { this._cpiUnsub(); } catch(_e){} this._cpiUnsub = null; }
      if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
      if(this._modal){
        const m = this._modal;
        m.classList.add("giValModal--leaving");
        window.setTimeout(() => m.remove(), 200);
        this._modal = null;
      }
      this._ctx = null;
    },

    _mount(){
      const modal = document.createElement("div");
      modal.id = "lcHachHealthModal";
      modal.className = "giValModal lcHachHealthModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור בריאות הכשרה");
      document.body.appendChild(modal);
      this._modal = modal;
      this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
      document.addEventListener("keydown", this._escHandler);
      requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
    },

    _getInsuredLabel(insId){
      const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
      return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
    },

    _getActiveInsured(){
      return (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === this._activeInsuredId) || null;
    },

    _selectedIds(st){
      return HACHSHARA_HEALTH_COVERS.map((c) => c.id).filter((id) => !!st?.selected?.[id]);
    },

    _syncAge(st){
      return riskSimSyncAgeFromBirthDate(st, {
        minAge: HACHSHARA_HEALTH_MIN_AGE,
        maxAge: HACHSHARA_HEALTH_MAX_AGE,
        minEntryDays: HACHSHARA_HEALTH_MIN_ENTRY_DAYS
      });
    },

    _recalcState(st){
      if(!st) return;
      if(!st.selected || typeof st.selected !== "object") st.selected = {};
      const ageSync = this._syncAge(st);
      const ids = this._selectedIds(st);
      if(!ids.length){
        st.result = null;
        st.error = null;
        return;
      }
      if(!ageSync.ok){
        st.result = null;
        st.error = HACHSHARA_HEALTH_SIM_MESSAGES[ageSync.reason] || HACHSHARA_HEALTH_SIM_MESSAGES.birth_missing;
        return;
      }
      const calc = computeHachsharaHealthBundle(ids, st.age, st.gender);
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        let msg = HACHSHARA_HEALTH_SIM_MESSAGES[calc.reason] || "לא ניתן לחשב את הפרמיה.";
        if(calc.reason === "age_cover_limit" && calc.failCoverId){
          const c = HACHSHARA_HEALTH_COVER_BY_ID[calc.failCoverId];
          msg = `הכיסוי "${c?.label || ""}" זמין עד גיל ${calc.coverMaxAge} בלבד.`;
        } else if(calc.failCoverId){
          const c = HACHSHARA_HEALTH_COVER_BY_ID[calc.failCoverId];
          if(c) msg = `${msg} (${c.label})`;
        }
        st.error = msg;
      }
    },

    _render(){
      if(!this._modal) return;
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
      const isMulti = insureds.length > 1;
      if(this._showFinalSummary){
        this._renderFinalSummary(insureds);
        return;
      }
      const activeId = this._activeInsuredId;
      const st = this._state[activeId] || this._prefillFromInsured(null);
      const isStandalone = !!this._ctx?.standalone;
      this._recalcState(st);

      const tabsHtml = isMulti ? `<div class="lcHachHealth__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : "");
        return `<button type="button" class="lcHachHealth__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-hachh-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
      }).join("")}</div>` : "";

      const birthIso = riskSimBirthDateToIsoInput(st.birthDate || "");
      const birthMaxIso = riskSimIsoDateDaysAgo(HACHSHARA_HEALTH_MIN_ENTRY_DAYS);
      const ageSync = this._syncAge(st);
      const ageDisplay = ageSync.ok ? String(ageSync.age) : "—";
      const ageHintHtml = !st.birthDate
        ? (isStandalone ? `<div class="lcHachHealth__hint lcHachHealth__hint--warn">יש לבחור תאריך לידה מלוח השנה</div>` : `<div class="lcHachHealth__hint lcHachHealth__hint--warn">לא נמצא תאריך לידה בפרטים האישיים — יש לבחור מלוח השנה</div>`)
        : (!ageSync.ok
          ? `<div class="lcHachHealth__hint lcHachHealth__hint--warn">${escapeHtml(HACHSHARA_HEALTH_SIM_MESSAGES[ageSync.reason] || "תאריך לידה לא תקין לחישוב")}</div>`
          : `<div class="lcHachHealth__hint">גיל ביטוחי (שנים שלמות היום): <strong>${escapeHtml(ageDisplay)}</strong></div>`);
      const needsGenderSelected = this._selectedIds(st).some((id) => !!HACHSHARA_HEALTH_COVER_BY_ID[id]?.needsGender);
      const genderHintHtml = (!needsGenderSelected || isStandalone || st.gender) ? "" : `<div class="lcHachHealth__hint lcHachHealth__hint--warn">לא נמצא מין — נדרש לכיסוי ייעוצים ובדיקות</div>`;

      const groups = {};
      HACHSHARA_HEALTH_COVERS.forEach((c) => {
        if(!groups[c.group]) groups[c.group] = [];
        groups[c.group].push(c);
      });
      const coversHtml = Object.keys(groups).map((g) => `
        <div class="lcHachHealth__group">
          <div class="lcHachHealth__groupTitle">${escapeHtml(g)}</div>
          <div class="lcHachHealth__coverList">
            ${groups[g].map((c) => {
              const checked = !!(st.selected && st.selected[c.id]);
              const one = checked ? computeHachsharaHealthCoverPremium(c.id, st.age, st.gender) : null;
              const premTxt = one?.ok ? `₪${formatHachsharaHealthExactAmount(one.monthlyPremium)}` : (checked && one && !one.ok ? "—" : "");
              return `<label class="lcHachHealth__cover${checked ? " is-checked" : ""}">
                <input type="checkbox" data-hachh-cover="${escapeHtml(c.id)}"${checked ? " checked" : ""} />
                <span class="lcHachHealth__coverLabel">${escapeHtml(c.label)}${c.needsGender ? ' <em>(לפי מין)</em>' : ""}${c.maxAge != null ? ` <em>(עד גיל ${c.maxAge})</em>` : ""}</span>
                <span class="lcHachHealth__coverPrem">${premTxt}</span>
              </label>`;
            }).join("")}
          </div>
        </div>`).join("");

      const selectedRows = (st.result?.covers || []).map((c) =>
        `<div class="lcHachHealth__selRow"><span>${escapeHtml(c.label)}</span><strong>₪${escapeHtml(formatHachsharaHealthExactAmount(c.monthlyPremium))}</strong></div>`
      ).join("");

      const indexMetaHtml = formatHachsharaHealthIndexMetaHtml(st.result?.indexInfo || HealthCpi.getIndexInfo(HACHSHARA_HEALTH_CPI_KEY));
      const baseTotalHtml = (st.result?.ok && st.result.baseMonthlyPremium != null && Math.abs(st.result.baseMonthlyPremium - st.result.monthlyPremium) > 0.0001)
        ? `<div class="lcHachHealth__resultRow"><span>פרמיית בסיס (לפני מדד)</span><strong>₪${escapeHtml(formatHachsharaHealthExactAmount(st.result.baseMonthlyPremium))}</strong></div>`
        : "";
      const resultHtml = st.error
        ? `<div class="lcHachHealth__result lcHachHealth__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcHachHealth__result lcHachHealth__result--ok">
            <div class="lcHachHealth__selTitle">כיסויים שנבחרו</div>
            ${selectedRows}
            ${baseTotalHtml}
            <div class="lcHachHealth__resultRow lcHachHealth__resultRow--main"><span>סה״כ פרמיה חודשית (צמודה למדד)</span><strong>₪${escapeHtml(formatHachsharaHealthExactAmount(st.result.monthlyPremium))}</strong></div>
            <div class="lcHachHealth__resultRow"><span>סה״כ פרמיה שנתית</span><strong>₪${escapeHtml(formatHachsharaHealthExactAmount(st.result.annualPremium))}</strong></div>
            ${indexMetaHtml}
          </div>` : `<div class="lcHachHealth__result lcHachHealth__result--empty">סמנו כיסויים כדי לראות פרמיה</div>`);

      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcHachHealth");
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "✚";

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcHachHealth__foot">
            <button type="button" class="btn btn--primary" data-hachh-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcHachHealth__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachh-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-hachh-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcHachHealth__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachh-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-hachh-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-hachh-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcHachHealth__overlay">
          <div class="lcHachHealth__overlayCard">
            <div class="lcHachHealth__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcHachHealth__overlayBtns">
              <button type="button" class="btn btn--primary" data-hachh-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-hachh-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-hachh-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-hachh-close="1"></div>
        <div class="giValModal__card lcHachHealth__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור בריאות הכשרה</div>
            </div>
            <button type="button" class="lcHachHealth__closeX" data-hachh-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcHachHealth__body">
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcHachHealth__insuredLabel lcHachHealth__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcHachHealth__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcHachHealth__grid">
              <div class="lcHachHealth__field">
                <label class="lcHachHealth__label">תאריך לידה</label>
                <input class="lcHachHealth__input" type="date" data-hachh-field="birthDate" value="${escapeHtml(birthIso)}" max="${escapeHtml(birthMaxIso)}" />
                ${ageHintHtml}
              </div>
              <div class="lcHachHealth__field">
                <label class="lcHachHealth__label">מין</label>
                <div class="lcHachHealth__segmented">
                  <button type="button" class="lcHachHealth__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-hachh-field="gender" data-hachh-value="זכר">זכר</button>
                  <button type="button" class="lcHachHealth__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-hachh-field="gender" data-hachh-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcHachHealth__field lcHachHealth__field--wide">
                <label class="lcHachHealth__label">עיסוק</label>
                <input class="lcHachHealth__input" type="text" data-hachh-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            <div class="lcHachHealth__coversTitle">בחירת כיסויים <span class="lcHachHealth__coversCount">(${HACHSHARA_HEALTH_COVERS.length})</span></div>
            <div class="lcHachHealth__coversWrap">${coversHtml}</div>
            ${occBlockHtml}
            ${resultHtml}
          </div>
          ${footHtml}
          ${confirmOverlayHtml}
        </div>`;
      this._bind();
    },

    _renderFinalSummary(insureds){
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const rows = relevant.map((ins) => {
        const ok = !!this._state[ins.id]?.savedAt;
        return `<div class="lcHachHealth__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-hachh-close="1"></div>
        <div class="giValModal__card lcHachHealth__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
            </div>
            <button type="button" class="lcHachHealth__closeX" data-hachh-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcHachHealth__body">${rows}</div>
          <div class="giValModal__foot lcHachHealth__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachh-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-hachh-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "hachh");
      $$("[data-hachh-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-hachh-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-hachh-tab"))));
      $$("[data-hachh-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-hachh-switch");
        const target = this._confirmSwitch?.targetId;
        this._confirmSwitch = null;
        if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); }
        else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); }
        else this._render();
      }));
      const birthInput = modal.querySelector('[data-hachh-field="birthDate"]');
      if(birthInput) on(birthInput, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        st.birthDate = riskSimBirthDateFromIsoInput(birthInput.value);
        st.birthDateSource = "manual";
        st.ageSource = "manual";
        st.dirtySinceSave = true;
        this._syncAge(st);
        this._render();
      });
      const occInput = modal.querySelector('[data-hachh-field="occupation"]');
      if(occInput){
        on(occInput, "input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.occupation = safeTrim(occInput.value);
          st.occupationSource = "manual"; st.dirtySinceSave = true;
        });
        on(occInput, "change", () => this._render());
        on(occInput, "blur", () => this._render());
      }
      $$("[data-hachh-cover]", modal).forEach((el) => on(el, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        if(!st.selected || typeof st.selected !== "object") st.selected = {};
        const id = el.getAttribute("data-hachh-cover");
        st.selected[id] = !!el.checked;
        st.dirtySinceSave = true;
        this._render();
      }));
      const applyBtn = modal.querySelector("[data-hachh-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-hachh-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-hachh-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => {
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
        if(!allSaved){
          window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור את הסימולטור עבור כל המבוטחים הרלוונטיים לפני האישור הסופי.", variant: "warn" });
          return;
        }
        this._showFinalSummary = true;
        this._render();
      });
      const summaryBackBtn = modal.querySelector("[data-hachh-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-hachh-summary-confirm]");
      if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => {
        try { this._ctx?.onFinalConfirm?.(); } catch(_e){}
        this.close();
      });
    },

    _switchInsured(targetId){
      if(!targetId || targetId === this._activeInsuredId) return;
      const st = this._state[this._activeInsuredId];
      if(st?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; }
      this._activeInsuredId = targetId;
      this._render();
    },

    _buildResultForInsured(insId){
      const st = this._state[insId];
      this._recalcState(st);
      if(!st?.result?.ok) return null;
      return {
        covers: st.result.covers.map((c) => ({
          id: c.id,
          label: c.label,
          wizardKey: c.wizardKey || c.label,
          monthlyPremium: c.monthlyPremium
        })),
        monthlyPremium: st.result.monthlyPremium,
        annualPremium: st.result.annualPremium,
        monthlyAgorot: st.result.monthlyAgorot,
        birthDate: st.birthDate || "",
        birthDateSource: st.birthDateSource || "",
        age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource,
        occupation: st.occupation || "", occupationSource: st.occupationSource || ""
      };
    },

    _apply(){
      const results = {};
      Object.keys(this._state).forEach((insId) => {
        const r = this._buildResultForInsured(insId);
        if(r) results[insId] = r;
      });
      if(!Object.keys(results).length){
        window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לבחור כיסויים ולחשב פרמיה לפני ההחלה על הפוליסה.", variant: "warn" });
        return;
      }
      const onApply = this._ctx?.onApply;
      this.close();
      try { onApply?.(results); } catch(_e) {}
    },

    _saveActive(){
      const insId = this._activeInsuredId;
      const result = this._buildResultForInsured(insId);
      if(!result){
        window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לבחור כיסויים תקינים לפני השמירה.", variant: "warn" });
        return;
      }
      try { this._ctx?.onApply?.({ [insId]: result }); } catch(_e) {}
      const st = this._state[insId];
      if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
      window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
      this._render();
    }
  };

  RiskSimulators.register("הכשרה", "בריאות", HachsharaHealthSimulator);


  // ===== GI-HACH-CI-SIM 2026-08-10 · מחלות קשות הכשרה ============================
  const HACHSHARA_CI_RATE_MAP = {"0":{"mNS":889,"fNS":889,"mS":889,"fS":889},"1":{"mNS":889,"fNS":889,"mS":889,"fS":889},"2":{"mNS":889,"fNS":889,"mS":889,"fS":889},"3":{"mNS":889,"fNS":889,"mS":889,"fS":889},"4":{"mNS":889,"fNS":889,"mS":889,"fS":889},"5":{"mNS":889,"fNS":889,"mS":889,"fS":889},"6":{"mNS":889,"fNS":889,"mS":889,"fS":889},"7":{"mNS":889,"fNS":889,"mS":889,"fS":889},"8":{"mNS":889,"fNS":889,"mS":889,"fS":889},"9":{"mNS":889,"fNS":889,"mS":889,"fS":889},"10":{"mNS":889,"fNS":889,"mS":889,"fS":889},"11":{"mNS":889,"fNS":889,"mS":889,"fS":889},"12":{"mNS":889,"fNS":889,"mS":889,"fS":889},"13":{"mNS":889,"fNS":889,"mS":889,"fS":889},"14":{"mNS":889,"fNS":889,"mS":889,"fS":889},"15":{"mNS":889,"fNS":889,"mS":889,"fS":889},"16":{"mNS":889,"fNS":889,"mS":889,"fS":889},"17":{"mNS":889,"fNS":889,"mS":889,"fS":889},"18":{"mNS":1211,"fNS":1407,"mS":1569,"fS":1688},"19":{"mNS":1333,"fNS":1607,"mS":1816,"fS":1983},"20":{"mNS":1457,"fNS":1826,"mS":2066,"fS":2301},"21":{"mNS":1482,"fNS":1894,"mS":2097,"fS":2375},"22":{"mNS":1512,"fNS":1986,"mS":2137,"fS":2476},"23":{"mNS":1558,"fNS":2122,"mS":2197,"fS":2625},"24":{"mNS":1598,"fNS":2288,"mS":2247,"fS":2804},"25":{"mNS":1655,"fNS":2497,"mS":2321,"fS":3028},"26":{"mNS":1727,"fNS":2758,"mS":2419,"fS":3310},"27":{"mNS":1805,"fNS":3061,"mS":2538,"fS":3635},"28":{"mNS":1897,"fNS":3408,"mS":2686,"fS":4015},"29":{"mNS":2013,"fNS":3803,"mS":2882,"fS":4447},"30":{"mNS":1910,"fNS":4246,"mS":2778,"fS":4936},"31":{"mNS":2056,"fNS":4740,"mS":3047,"fS":5482},"32":{"mNS":2237,"fNS":5270,"mS":3383,"fS":6077},"33":{"mNS":2471,"fNS":5767,"mS":3826,"fS":6641},"34":{"mNS":2760,"fNS":6181,"mS":4382,"fS":7134},"35":{"mNS":3108,"fNS":6503,"mS":5064,"fS":7542},"36":{"mNS":3510,"fNS":6733,"mS":5872,"fS":7867},"37":{"mNS":4023,"fNS":6942,"mS":6876,"fS":8182},"38":{"mNS":4628,"fNS":7226,"mS":8046,"fS":8593},"39":{"mNS":5336,"fNS":7668,"mS":9393,"fS":9171},"40":{"mNS":6464,"fNS":8462,"mS":11474,"fS":10152},"41":{"mNS":7443,"fNS":9243,"mS":13295,"fS":11100},"42":{"mNS":8426,"fNS":10120,"mS":15154,"fS":12156},"43":{"mNS":10208,"fNS":11009,"mS":16955,"fS":13225},"44":{"mNS":10208,"fNS":11807,"mS":18608,"fS":14216},"45":{"mNS":10954,"fNS":12511,"mS":20082,"fS":15122},"46":{"mNS":11510,"fNS":12950,"mS":21687,"fS":16286},"47":{"mNS":12069,"fNS":13396,"mS":23288,"fS":17504},"48":{"mNS":12758,"fNS":13888,"mS":25126,"fS":18821},"49":{"mNS":13745,"fNS":14546,"mS":27560,"fS":20376},"50":{"mNS":16222,"fNS":16064,"mS":32997,"fS":23163},"51":{"mNS":18315,"fNS":17334,"mS":37089,"fS":24997},"52":{"mNS":20933,"fNS":18697,"mS":42198,"fS":26966},"53":{"mNS":24116,"fNS":20160,"mS":48378,"fS":29076},"54":{"mNS":27838,"fNS":21722,"mS":55528,"fS":31323},"55":{"mNS":32089,"fNS":23397,"mS":63604,"fS":37738},"56":{"mNS":36849,"fNS":25209,"mS":72539,"fS":36449},"57":{"mNS":41749,"fNS":27054,"mS":81699,"fS":39029},"58":{"mNS":46599,"fNS":28937,"mS":90715,"fS":41795},"59":{"mNS":51006,"fNS":30663,"mS":98733,"fS":44495},"60":{"mNS":54618,"fNS":32178,"mS":105183,"fS":46822},"61":{"mNS":57729,"fNS":34456,"mS":110583,"fS":48937},"62":{"mNS":60496,"fNS":34608,"mS":115163,"fS":50918},"63":{"mNS":62970,"fNS":35642,"mS":119069,"fS":52789},"64":{"mNS":65430,"fNS":36711,"mS":122983,"fS":54789},"65":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"66":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"67":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"68":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"69":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"70":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"71":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"72":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"73":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"74":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633},"75":{"mNS":105162,"fNS":56909,"mS":194835,"fS":87633}};
  const HACHSHARA_CI_MIN_AGE = 0;
  const HACHSHARA_CI_MAX_ENTRY_AGE = 75;
  const HACHSHARA_CI_MIN_ENTRY_DAYS = 15;
  const HACHSHARA_CI_MIN_SUM = 100000;
  const HACHSHARA_CI_MAX_SUM = 1000000;
  const HACHSHARA_CI_WIZARD_KEY = "מחלות קשות";

  function hachsharaCiAgorotToShekels(agorot){ return agorot / 100; }
  function formatHachsharaCiExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    const whole = Math.trunc(ag / 100);
    const frac = Math.abs(ag % 100);
    return whole + "." + String(frac).padStart(2, "0");
  }
  function lookupHachsharaCiRate({ age, gender, smoker }){
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    if(ageNum < HACHSHARA_CI_MIN_AGE || ageNum > HACHSHARA_CI_MAX_ENTRY_AGE) return { ok:false, reason:"age_out_of_range" };
    const row = HACHSHARA_CI_RATE_MAP[String(ageNum)];
    if(!row) return { ok:false, reason:"age_out_of_range" };
    if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const key = gender === "זכר" ? (smoker ? "mS" : "mNS") : (smoker ? "fS" : "fNS");
    const rateAgorot = row[key];
    if(rateAgorot == null || !Number.isInteger(rateAgorot)) return { ok:false, reason:"rate_missing" };
    return { ok:true, rateAgorot, ratePerHundredThousand: hachsharaCiAgorotToShekels(rateAgorot) };
  }
  function computeHachsharaCiPremium({ age, gender, smoker, compensation }){
    const sum = Number(String(compensation == null ? "" : compensation).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    if(sum < HACHSHARA_CI_MIN_SUM) return { ok:false, reason:"sum_too_low", minSum: HACHSHARA_CI_MIN_SUM };
    if(sum > HACHSHARA_CI_MAX_SUM) return { ok:false, reason:"sum_too_high", maxSum: HACHSHARA_CI_MAX_SUM };
    const rate = lookupHachsharaCiRate({ age, gender, smoker });
    if(!rate.ok) return rate;
    const monthlyAgorot = Math.round(rate.rateAgorot * (sum / 100000));
    return {
      ok: true,
      monthlyAgorot,
      monthlyPremium: hachsharaCiAgorotToShekels(monthlyAgorot),
      annualPremium: hachsharaCiAgorotToShekels(monthlyAgorot * 12),
      ratePerHundredThousand: rate.ratePerHundredThousand,
      compensation: sum,
      wizardCoverKey: HACHSHARA_CI_WIZARD_KEY
    };
  }
  const HACHSHARA_CI_MESSAGES = {
    birth_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young: "גיל הכניסה המינימלי הוא 15 ימים.",
    age_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range: "הגיל הביטוחי חורג מטווח הכניסה 0–75.",
    gender_missing: "יש לבחור מין.",
    smoker_missing: "יש לבחור סטטוס עישון.",
    sum_missing: "יש להזין סכום פיצוי.",
    sum_too_low: "סכום הפיצוי המינימלי הוא ₪100,000.",
    sum_too_high: "סכום הפיצוי המקסימלי הוא ₪1,000,000.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו."
  };

  const HachsharaCriticalIllnessSimulator = {
    _modal: null, _ctx: null, _state: {}, _activeInsuredId: null, _escHandler: null,
    _confirmSwitch: null, _showFinalSummary: false,
    open(ctx){
      this.close();
      this._ctx = ctx || {};
      const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
      this._state = {};
      insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
      this._activeInsuredId = insureds[0]?.id || null;
      this._confirmSwitch = null;
      this._showFinalSummary = false;
      this._mount();
      this._render();
    },
    close(){
      if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
      if(this._modal){
        const m = this._modal;
        m.classList.add("giValModal--leaving");
        window.setTimeout(() => m.remove(), 200);
        this._modal = null;
      }
      this._ctx = null;
    },
    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const birthDate = safeTrim(d.birthDate || "");
      const smoker = (d.smoker === true || d.smoker === false) ? d.smoker : null;
      const compensation = safeTrim(d.hachsharaCriticalAmount || d.compensation || "") || "100000";
      const st = {
        birthDate, birthDateSource: birthDate ? "step1" : "",
        age: "", ageSource: birthDate ? "step1" : "", ageRaw: null, entryDays: null,
        gender, genderSource: gender ? "step1" : "",
        smoker, smokerSource: smoker != null ? "step1" : "",
        compensation, compensationSource: "default",
        result: null, error: null, savedAt: null, dirtySinceSave: false
      };
      riskSimSyncAgeFromBirthDate(st, {
        minAge: HACHSHARA_CI_MIN_AGE,
        maxAge: HACHSHARA_CI_MAX_ENTRY_AGE,
        minEntryDays: HACHSHARA_CI_MIN_ENTRY_DAYS
      });
      return st;
    },
    _isInsuredRelevant(_ins){ return true; },
    _mount(){
      const modal = document.createElement("div");
      modal.id = "lcHachCiModal";
      modal.className = "giValModal lcMnrCiModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור מחלות קשות הכשרה");
      document.body.appendChild(modal);
      this._modal = modal;
      this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
      document.addEventListener("keydown", this._escHandler);
      requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
    },
    _getInsuredLabel(insId){
      const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
      return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
    },
    _syncAge(st){
      return riskSimSyncAgeFromBirthDate(st, {
        minAge: HACHSHARA_CI_MIN_AGE,
        maxAge: HACHSHARA_CI_MAX_ENTRY_AGE,
        minEntryDays: HACHSHARA_CI_MIN_ENTRY_DAYS
      });
    },
    _recalcState(st){
      if(!st) return;
      const ageSync = this._syncAge(st);
      if(!ageSync.ok){
        st.result = null;
        st.error = HACHSHARA_CI_MESSAGES[ageSync.reason] || HACHSHARA_CI_MESSAGES.birth_missing;
        return;
      }
      const calc = computeHachsharaCiPremium({
        age: st.age, gender: st.gender, smoker: st.smoker, compensation: st.compensation
      });
      if(calc.ok){ st.result = calc; st.error = null; }
      else {
        st.result = null;
        st.error = HACHSHARA_CI_MESSAGES[calc.reason] || "לא ניתן לחשב את הפרמיה.";
      }
    },
    _buildResultForInsured(insId){
      const st = this._state[insId];
      if(!st?.result?.ok) return null;
      return {
        product: "מחלות קשות",
        company: "הכשרה",
        monthlyPremium: st.result.monthlyPremium,
        annualPremium: st.result.annualPremium,
        compensation: st.result.compensation,
        ratePerHundredThousand: st.result.ratePerHundredThousand,
        wizardCoverKey: HACHSHARA_CI_WIZARD_KEY,
        inputs: {
          birthDate: st.birthDate, age: st.age, gender: st.gender,
          smoker: st.smoker, compensation: st.compensation
        }
      };
    },
    _render(){
      if(!this._modal) return;
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
      const isMulti = insureds.length > 1;
      if(this._showFinalSummary){ this._renderFinalSummary(insureds); return; }
      const activeId = this._activeInsuredId;
      const st = this._state[activeId] || this._prefillFromInsured(null);
      const isStandalone = !!this._ctx?.standalone;
      this._recalcState(st);
      const birthIso = riskSimBirthDateToIsoInput(st.birthDate || "");
      const birthMaxIso = riskSimIsoDateDaysAgo(HACHSHARA_CI_MIN_ENTRY_DAYS);
      const ageSync = this._syncAge(st);
      const ageDisplay = ageSync.ok ? String(ageSync.age) : "—";
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini") : "✚";
      const resultHtml = st.error
        ? `<div class="lcMnrCi__result lcMnrCi__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcMnrCi__result lcMnrCi__result--ok">
            <div class="lcMnrCi__resultRow lcMnrCi__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatHachsharaCiExactAmount(st.result.monthlyPremium))}</strong></div>
            <div class="lcMnrCi__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatHachsharaCiExactAmount(st.result.annualPremium))}</strong></div>
            <div class="lcMnrCi__resultRow"><span>תעריף לכל ₪100,000</span><strong>₪${escapeHtml(formatHachsharaCiExactAmount(st.result.ratePerHundredThousand))}</strong></div>
          </div>` : `<div class="lcMnrCi__result lcMnrCi__result--empty">מלאו את השדות לחישוב</div>`);
      const tabsHtml = isMulti ? `<div class="lcMnrCi__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : "");
        return `<button type="button" class="lcMnrCi__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-hachci-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}</button>`;
      }).join("")}</div>` : "";
      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);
      const footHtml = isStandalone
        ? `<div class="giValModal__foot"><button type="button" class="btn btn--primary" data-hachci-close="1">סגור</button></div>`
        : (!isMulti
          ? `<div class="giValModal__foot"><button type="button" class="btn giValModal__closeBtn" data-hachci-close="1">ביטול</button><button type="button" class="btn btn--primary" data-hachci-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button></div>`
          : `<div class="giValModal__foot"><button type="button" class="btn giValModal__closeBtn" data-hachci-close="1">ביטול</button><button type="button" class="btn btn--secondary" data-hachci-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button><button type="button" class="btn btn--primary" data-hachci-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button></div>`);
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-hachci-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור מחלות קשות הכשרה</div>
              <div class="giValModal__sub">פרמיה חודשית לכל ₪100,000 פיצוי</div>
            </div>
            <button type="button" class="lcMnrCi__closeX" data-hachci-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body">
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcMnrCi__insuredLabel">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcMnrCi__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcMnrCi__grid">
              <div class="lcMnrCi__field">
                <label class="lcMnrCi__label">תאריך לידה</label>
                <input class="lcMnrCi__input" type="date" data-hachci-field="birthDate" value="${escapeHtml(birthIso)}" max="${escapeHtml(birthMaxIso)}" />
                <div class="lcMnrCi__hint">גיל ביטוחי: <strong>${escapeHtml(ageDisplay)}</strong></div>
              </div>
              <div class="lcMnrCi__field">
                <label class="lcMnrCi__label">מין</label>
                <div class="lcMnrCi__segmented">
                  <button type="button" class="lcMnrCi__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-hachci-field="gender" data-hachci-value="זכר">זכר</button>
                  <button type="button" class="lcMnrCi__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-hachci-field="gender" data-hachci-value="נקבה">נקבה</button>
                </div>
              </div>
              <div class="lcMnrCi__field">
                <label class="lcMnrCi__label">עישון</label>
                <div class="lcMnrCi__segmented">
                  <button type="button" class="lcMnrCi__segBtn${st.smoker === false ? " is-active" : ""}" data-hachci-field="smoker" data-hachci-value="0">לא מעשן</button>
                  <button type="button" class="lcMnrCi__segBtn${st.smoker === true ? " is-active" : ""}" data-hachci-field="smoker" data-hachci-value="1">מעשן</button>
                </div>
              </div>
              <div class="lcMnrCi__field">
                <label class="lcMnrCi__label">סכום פיצוי (₪)</label>
                <input class="lcMnrCi__input" type="number" min="100000" step="50000" data-hachci-field="compensation" value="${escapeHtml(String(st.compensation || ""))}" />
              </div>
            </div>
            ${resultHtml}
          </div>
          ${footHtml}
        </div>`;
      this._bind();
    },
    _renderFinalSummary(insureds){
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const rows = relevant.map((ins) => {
        const ok = !!this._state[ins.id]?.savedAt;
        return `<div class="lcMnrCi__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-hachci-close="1"></div>
        <div class="giValModal__card">
          <div class="giValModal__head"><div class="giValModal__headText"><div class="giValModal__title">סיכום סימולטור להצעה</div></div>
            <button type="button" class="lcMnrCi__closeX" data-hachci-close="1" aria-label="סגירה">✕</button></div>
          <div class="giValModal__body">${rows}</div>
          <div class="giValModal__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachci-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-hachci-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },
    _bind(){
      const modal = this._modal;
      if(!modal) return;
      modal.querySelectorAll("[data-hachci-close]").forEach((el) => el.addEventListener("click", () => this.close()));
      modal.querySelectorAll("[data-hachci-tab]").forEach((el) => el.addEventListener("click", () => {
        this._activeInsuredId = el.getAttribute("data-hachci-tab");
        this._render();
      }));
      ensureSegFieldDelegation(modal, this, "hachci");
      const birthInput = modal.querySelector('[data-hachci-field="birthDate"]');
      if(birthInput){
        birthInput.addEventListener("change", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = riskSimBirthDateFromIsoInput(birthInput.value) || "";
          st.birthDateSource = "manual";
          this._syncAge(st);
          st.dirtySinceSave = true;
          this._render();
        });
      }
      const compInput = modal.querySelector('[data-hachci-field="compensation"]');
      if(compInput){
        compInput.addEventListener("input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.compensation = safeTrim(compInput.value);
          st.compensationSource = "manual";
          st.dirtySinceSave = true;
          this._recalcState(st);
        });
        compInput.addEventListener("change", () => this._render());
      }
      modal.querySelector("[data-hachci-apply]")?.addEventListener("click", () => this._apply());
      modal.querySelector("[data-hachci-save]")?.addEventListener("click", () => this._saveActive());
      modal.querySelector("[data-hachci-finalconfirm]")?.addEventListener("click", () => {
        this._showFinalSummary = true; this._render();
      });
      modal.querySelector("[data-hachci-summary-back]")?.addEventListener("click", () => {
        this._showFinalSummary = false; this._render();
      });
      modal.querySelector("[data-hachci-summary-confirm]")?.addEventListener("click", () => this._apply());
    },
    _apply(){
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
      const results = {};
      insureds.forEach((ins) => {
        const r = this._buildResultForInsured(ins.id);
        if(r) results[ins.id] = r;
      });
      if(!Object.keys(results).length){
        window.showToast?.({ title: "אין תוצאה", text: "יש לחשב פרמיה תקינה לפני ההחלה.", variant: "warn" });
        return;
      }
      const onApply = this._ctx?.onApply;
      this.close();
      try { onApply?.(results); } catch(_e) {}
    },
    _saveActive(){
      const insId = this._activeInsuredId;
      const result = this._buildResultForInsured(insId);
      if(!result){
        window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה תקינה לפני השמירה.", variant: "warn" });
        return;
      }
      try { this._ctx?.onApply?.({ [insId]: result }); } catch(_e) {}
      const st = this._state[insId];
      if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
      window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
      this._render();
    }
  };
  RiskSimulators.register("הכשרה", "מחלות קשות", HachsharaCriticalIllnessSimulator);
  // ===== סוף GI-HACH-CI-SIM ========================================================


  // ===== GI-SIM-CENTER 2026-08-08 · "מרכז הסימולטורים" =============================
  // כפתור עצמאי בטופ-בר (ללא תלות באשף/לקוח/הצעה קיימת) שפותח בורר חברה+מוצר,
  // ולאחר בחירה פותח את אותו סימולטור בדיוק דרך RiskSimulators.getHandler(...)
  // הקיים, במצב standalone:true — עם מבוטח סינתטי יחיד וללא שמירה בשום מקום.
  // אינו נוגע ב-Wizard.openRiskSimulator ולא משנה שום התנהגות קיימת באשף.


  try { host.onSimulatorsInstalled?.(RiskSimulators); } catch(_e) {}
  try { global.__GI_SIMS_CHUNK_READY = true; } catch(_e) {}
})(typeof globalThis !== "undefined" ? globalThis : window);
