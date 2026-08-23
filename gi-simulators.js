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
  const parseAnyDmyDate = typeof host.parseAnyDmyDate === "function" ? host.parseAnyDmyDate : parseBirthDateValue;
  const formatDmyFromParts = host.formatDmyFromParts;
  const applyDmyAutoFormat = typeof host.applyDmyAutoFormat === "function"
    ? host.applyDmyAutoFormat
    : ((el) => { if(!el) return ""; return String(el.value || ""); });
  const renderCompanyLogoHtmlForCompany = host.renderCompanyLogoHtmlForCompany;
  const ensureGiSimulatorStylesLoaded = host.ensureGiSimulatorStylesLoaded;
  const RiskSimulators = host.RiskSimulators;
  function getElementaryDatePicker(){
    try { return host.ElementaryDatePicker; } catch(_e){ return null; }
  }

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
    age_missing: "יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
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

  /**
   * מוסיף מספר חודשים לתאריך (שומר על יום בחודש; אם אין יום כזה — היום האחרון בחודש היעד).
   * לשימוש בחישוב גיל ביטוחי (עיגול מחצי שנה).
   */
  function riskSimAddMonths(date, months){
    const src = date instanceof Date ? date : null;
    if(!src || Number.isNaN(src.getTime())) return null;
    const y = src.getFullYear();
    const m = src.getMonth();
    const d = src.getDate();
    const base = new Date(y, m + Number(months || 0), 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(d, lastDay));
    return base;
  }

  /**
   * גיל ביטוחי לתמחור סימולטורים: שנים שלמות + עיגול כלפי מעלה מחצי שנה ומעלה.
   * דוגמה: בן 40 ו־6 חודשים → גיל ביטוחי 41; בן 40 ו־5 חודשים → 40.
   * asOfDate: תאריך ייחוס (תחילת ביטוח), ברירת מחדל היום.
   */
  function riskSimAgeAtDate(birthDateStr, asOfDateStr){
    const birthParsed = (typeof parseBirthDateValue === "function") ? parseBirthDateValue(birthDateStr) : null;
    if(!birthParsed || !birthParsed.date) return null;
    let asOf = new Date();
    if(asOfDateStr){
      const asParsed = (typeof parseAnyDmyDate === "function")
        ? parseAnyDmyDate(asOfDateStr)
        : ((typeof parseBirthDateValue === "function") ? parseBirthDateValue(asOfDateStr) : null);
      if(!asParsed) return null;
      asOf = asParsed.date
        ? asParsed.date
        : new Date(asParsed.year, (asParsed.month || 1) - 1, asParsed.day || 1);
    }
    const birth = new Date(birthParsed.date.getFullYear(), birthParsed.date.getMonth(), birthParsed.date.getDate());
    const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    if(Number.isNaN(birth.getTime()) || Number.isNaN(end.getTime()) || end < birth) return null;

    const bMonth = birth.getMonth();
    const bDay = birth.getDate();
    const birthdayInYear = (year) => {
      const dim = new Date(year, bMonth + 1, 0).getDate();
      return new Date(year, bMonth, Math.min(bDay, dim));
    };

    let completed = end.getFullYear() - birth.getFullYear();
    if(end < birthdayInYear(end.getFullYear())) completed--;
    if(!Number.isFinite(completed) || completed < 0) return null;

    let lastBdayYear = end.getFullYear();
    if(end < birthdayInYear(end.getFullYear())) lastBdayYear -= 1;
    const lastBirthday = birthdayInYear(lastBdayYear);
    const halfYearMark = riskSimAddMonths(lastBirthday, 6);
    if(halfYearMark && end >= halfYearMark) return completed + 1;
    return completed;
  }

  /** גיל ביטוחי להיום (עם עיגול חצי־שנה) — תאימות לאחור. */
  function riskSimAgeFromBirthDate(dateStr){
    return riskSimAgeAtDate(dateStr, null);
  }

  /** ימים שלמים מלידה עד asOf (ברירת מחדל: היום). */
  function riskSimDaysBetweenBirthAndDate(birthDateStr, asOfDateStr){
    const birthParsed = (typeof parseBirthDateValue === "function") ? parseBirthDateValue(birthDateStr) : null;
    if(!birthParsed || !birthParsed.date) return null;
    let asOf = new Date();
    if(asOfDateStr){
      const asParsed = (typeof parseAnyDmyDate === "function")
        ? parseAnyDmyDate(asOfDateStr)
        : ((typeof parseBirthDateValue === "function") ? parseBirthDateValue(asOfDateStr) : null);
      if(!asParsed) return null;
      asOf = asParsed.date
        ? asParsed.date
        : new Date(asParsed.year, (asParsed.month || 1) - 1, asParsed.day || 1);
    }
    const birth = new Date(birthParsed.date.getFullYear(), birthParsed.date.getMonth(), birthParsed.date.getDate());
    const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    const days = Math.floor((end - birth) / 86400000);
    return Number.isFinite(days) ? days : null;
  }

  /** HTML לשדה תאריך dd/mm/yyyy (הקלדה + לוח ElementaryDatePicker). */
  function renderRiskSimDmyFieldHtml({ classPrefix, fieldAttr, fieldName, label, value, hintHtml }){
    const P = classPrefix || "lcPhxSim";
    const attr = fieldAttr || ("data-" + P.replace(/^lc/, "").toLowerCase() + "-field");
    return `<div class="${P}__field">
      <label class="${P}__label">${escapeHtml(label || "תאריך")}</label>
      <input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
        placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy"
        ${attr}="${escapeHtml(fieldName || "birthDate")}"
        value="${escapeHtml(value || "")}" />
      ${hintHtml || ""}
    </div>`;
  }

  /**
   * קישור שדה dmy: מסכה בהקלדה, commit ב-blur/change, לוח שנה.
   * onCommit(normalizedDdMmYyyyOrEmpty) — רק כשמשחררים פוקוס / בוחרים מלוח.
   */
  function bindRiskSimDmyField(modal, selector, { onInput, onCommit } = {}){
    if(!modal) return;
    const el = modal.querySelector(selector);
    if(!el || el._giDmyBound) return;
    el._giDmyBound = true;
    on(el, "input", () => {
      applyDmyAutoFormat(el);
      if(typeof onInput === "function") onInput(el.value);
    });
    const commit = () => {
      applyDmyAutoFormat(el);
      let norm = safeTrim(el.value);
      const p = (typeof parseAnyDmyDate === "function") ? parseAnyDmyDate(norm) : null;
      if(p && (p.year || p.date)){
        const y = p.year || p.date.getFullYear();
        const m = p.month || (p.date.getMonth() + 1);
        const d = p.day || p.date.getDate();
        norm = formatDmyFromParts(y, m, d);
        el.value = norm;
      } else if(norm && norm.replace(/\D/g, "").length < 8){
        /* חלקי — משאירים כפי שהוקלד, בלי לנרמל */
      } else if(norm){
        const bp = (typeof parseBirthDateValue === "function") ? parseBirthDateValue(norm) : null;
        if(bp){
          norm = formatDmyFromParts(bp.year, bp.month, bp.day);
          el.value = norm;
        }
      }
      if(typeof onCommit === "function") onCommit(el.value);
    };
    on(el, "change", commit);
    on(el, "blur", commit);
    try {
      const picker = getElementaryDatePicker();
      if(picker && typeof picker.attachToContainer === "function") picker.attachToContainer(modal);
    } catch(_e){}
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
    return riskSimDaysBetweenBirthAndDate(dateStr, null);
  }

  function riskSimIsoDateToday(){
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }

  function riskSimTodayDmy(){
    const n = new Date();
    return formatDmyFromParts(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }


  /** תאריך תחילת ביטוח מהקשר/מבוטח, אחרת היום (dd/mm/yyyy). */
  function resolveInsuranceStartDate(ctx, ins){
    const fromCtx = safeTrim(ctx?.insuranceStartDate || ctx?.startDate || ctx?.policyStartDate || "");
    if(fromCtx) return fromCtx;
    const d = ins?.data || {};
    const fromIns = safeTrim(d.insuranceStartDate || d.startDate || d.policyStartDate || "");
    if(fromIns) return fromIns;
    const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
    for(let i = 0; i < insureds.length; i++){
      const meta = insureds[i]?.data || {};
      const v = safeTrim(meta.insuranceStartDate || meta.startDate || meta.policyStartDate || "");
      if(v) return v;
    }
    return riskSimTodayDmy();
  }

  function riskSimIsoDateDaysAgo(daysAgo){
    const n = new Date();
    n.setHours(0, 0, 0, 0);
    n.setDate(n.getDate() - Number(daysAgo || 0));
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }

  /**
   * מסנכרן st.birthDate → st.age (גיל ביטוחי עם עיגול חצי־שנה) + בדיקת מינ׳ ימי כניסה.
   * asOfDate: תאריך תחילת ביטוח (dd/mm/yyyy) — אם חסר, מול היום.
   * לא מנחש גיל: בלי תאריך לידה תקין — age ריק.
   */
  function riskSimSyncAgeFromBirthDate(st, { minAge, maxAge, minEntryDays, asOfDate } = {}){
    if(!st) return { ok:false, reason:"birth_missing" };
    const bd = safeTrim(st.birthDate || "");
    const asOf = safeTrim(asOfDate || st.insuranceStartDate || "") || null;
    const days = bd ? riskSimDaysBetweenBirthAndDate(bd, asOf) : null;
    const age = bd ? riskSimAgeAtDate(bd, asOf) : null;
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
    if(Number.isInteger(minAge) && Number.isInteger(maxAge) && (age < minAge || age > maxAge)){
      st.age = "";
      return { ok:false, reason:"age_out_of_range", age };
    }
    st.age = String(age);
    return { ok:true, age, days };
  }

  /* ===== GI-SIM-SHELL 2026-08-10 — מעטפת standalone + הוספת מבוטחים ========= */
  function riskSimEnsureStandaloneInsureds(ctx){
    const next = ctx && typeof ctx === "object" ? ctx : {};
    if(!next.standalone) return next;
    if(!Array.isArray(next.insureds) || !next.insureds.length){
      next.insureds = [{ id: "standalone-1", label: "מבוטח 1 — ראשי", data: {} }];
    } else {
      next.insureds = next.insureds.map((ins, idx) => {
        if(!ins || typeof ins !== "object") return { id: "standalone-" + (idx + 1), label: idx === 0 ? "מבוטח 1 — ראשי" : ("מבוטח " + (idx + 1)), data: {} };
        const label = safeTrim(ins.label);
        if(!label || label === "חישוב עצמאי"){
          return Object.assign({}, ins, { label: idx === 0 ? "מבוטח 1 — ראשי" : ("מבוטח " + (idx + 1)) });
        }
        return ins;
      });
    }
    next.allowAddInsured = true;
    return next;
  }

  function riskSimDetectClosePrefix(modal){
    if(!modal) return null;
    const hit = modal.querySelector(
      "[data-phx-close],[data-phxh-close],[data-mnr-close],[data-phxmort-close],[data-mnrmort-close],[data-mnrh-close],[data-aylh-close],[data-mnrci-close],[data-hach-close],[data-hachr-close],[data-hachm-close],[data-hachci-close],[data-mgdh-close],[data-mgdci-close],[data-mgdca-close],[data-mgdr-close],[data-mgdad-close],[data-mgdacd-close],[data-clalh-close],[data-clalci-close],[data-clalca-close],[data-clalmort-close],[data-clalrisk-close]"
    );
    if(!hit || !hit.attributes) return null;
    for(let i = 0; i < hit.attributes.length; i++){
      const name = hit.attributes[i].name || "";
      if(name.indexOf("data-") === 0 && name.slice(-6) === "-close"){
        return name.slice(5, -6);
      }
    }
    return null;
  }

  function riskSimFormatMoneyShekels(n){
    const num = Number(n);
    if(!Number.isFinite(num)) return "0.00";
    try {
      return num.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch(_e) {
      return (Math.round(num * 100) / 100).toFixed(2);
    }
  }

  function riskSimTotalMonthlyPremiums(stateMap){
    let sum = 0;
    const map = stateMap && typeof stateMap === "object" ? stateMap : {};
    Object.keys(map).forEach((k) => {
      const m = Number(map[k]?.result?.monthlyPremium);
      if(Number.isFinite(m)) sum += m;
    });
    return Math.round(sum * 100) / 100;
  }

  function riskSimAddStandaloneInsured(sim){
    if(!sim || !sim._ctx) return;
    if(!Array.isArray(sim._ctx.insureds)) sim._ctx.insureds = [];
    if(!sim._state || typeof sim._state !== "object") sim._state = {};
    const n = sim._ctx.insureds.length + 1;
    const id = "standalone-" + Date.now() + "-" + n;
    const label = n === 1 ? "מבוטח 1 — ראשי" : ("מבוטח " + n);
    const ins = { id, label, data: {} };
    sim._ctx.insureds.push(ins);
    try {
      sim._state[id] = typeof sim._prefillFromInsured === "function" ? sim._prefillFromInsured(ins) : {};
    } catch(_e) {
      sim._state[id] = {};
    }
    sim._activeInsuredId = id;
    try { sim._render(); } catch(_e2) {}
  }

  function riskSimExtractAgeFromHint(body){
    if(!body) return "";
    const hints = body.querySelectorAll("[class*='__hint']");
    for(let i = 0; i < hints.length; i++){
      const hint = hints[i];
      if(hint.className && String(hint.className).indexOf("warn") >= 0) continue;
      const strong = hint.querySelector("strong");
      if(!strong) continue;
      const age = safeTrim(strong.textContent);
      if(/^\d{1,3}$/.test(age)) return age;
    }
    return "";
  }

  function riskSimBuildShellPanel(title, className){
    const panel = document.createElement("section");
    panel.className = "giSimShell__panel " + (className || "");
    const h = document.createElement("div");
    h.className = "giSimShell__panelTitle";
    h.textContent = title;
    panel.appendChild(h);
    return panel;
  }

  function riskSimLayoutStandaloneBody(body, sim){
    if(!body || body.querySelector(".giSimShell__layout")) return;
    const bar = body.querySelector(".giSimShell__insuredBar");
    const grid = body.querySelector("[class*='__grid']");
    if(!grid) return;

    const coversTitle = body.querySelector("[class*='__coversTitle']");
    const coversWrap = body.querySelector("[class*='__coversWrap']");
    const result = body.querySelector("[class*='__result']");
    const occBox = body.querySelector("[class*='__occBox']");
    const statusList = body.querySelector("[class*='__statusList']");

    const age = riskSimExtractAgeFromHint(body);
    const layout = document.createElement("div");
    layout.className = "giSimShell__layout";

    const details = riskSimBuildShellPanel("פרטי מבוטח", "giSimShell__panel--details");
    details.appendChild(grid);

    if(age){
      const ageBox = document.createElement("div");
      ageBox.className = "giSimShell__ageBadge";
      ageBox.innerHTML = `<span class="giSimShell__ageBadgeLabel">גיל ביטוחי</span><strong class="giSimShell__ageBadgeValue">${escapeHtml(age)}</strong>`;
      details.appendChild(ageBox);
      body.querySelectorAll("[class*='__hint']").forEach((hint) => {
        if(hint.className && String(hint.className).indexOf("warn") >= 0) return;
        const strong = hint.querySelector("strong");
        if(strong && safeTrim(strong.textContent) === age){
          hint.classList.add("giSimShell__hintHidden");
        }
      });
    }

    const covers = riskSimBuildShellPanel(
      coversWrap ? "כיסויים" : "פרמטרים לחישוב",
      coversWrap ? "giSimShell__panel--covers" : "giSimShell__panel--params"
    );

    // Move wide calculation fields (sum insured etc.) into the second panel for risk sims
    if(!coversWrap){
      const wideFields = Array.from(grid.querySelectorAll("[class*='__field--wide']"));
      wideFields.forEach((f) => covers.appendChild(f));
      if(occBox) covers.appendChild(occBox);
      if(result) covers.appendChild(result);
      if(!wideFields.length && !occBox && !result){
        // keep second panel useful: clone note
        const note = document.createElement("div");
        note.className = "giSimShell__emptyNote";
        note.textContent = "מלאו את פרטי המבוטח ולחצו «חשב פרמיה»";
        covers.appendChild(note);
      }
    } else {
      if(coversTitle) covers.appendChild(coversTitle);
      covers.appendChild(coversWrap);
      if(occBox) covers.appendChild(occBox);
      if(result) covers.appendChild(result);
    }

    layout.appendChild(details);
    layout.appendChild(covers);

    const insertAfter = bar || null;
    if(insertAfter && insertAfter.nextSibling){
      body.insertBefore(layout, insertAfter.nextSibling);
    } else if(insertAfter){
      body.appendChild(layout);
    } else {
      body.insertBefore(layout, body.firstChild);
    }

    // Move leftover nodes (except bar/layout/overlays) under a extras strip if any meaningful leftovers remain
    Array.from(body.children).forEach((child) => {
      if(child === bar || child === layout) return;
      if(child.classList && (child.classList.contains("giSimShell__insuredBar") || child.classList.contains("giSimShell__layout"))) return;
      if(statusList && child === statusList) return;
      if(child.className && String(child.className).indexOf("overlay") >= 0) return;
      if(child.className && String(child.className).indexOf("insuredLabel") >= 0){
        child.classList.add("giSimShell__hintHidden");
        return;
      }
      // already moved nodes won't be in body
    });

    // הסתרת כפתורי "חשב פרמיה" מקוריים בגוף — נשאר רק הכפתור ב-footer של ה-shell
    try { riskSimHideNativeBodyCalc(body); } catch(_e) {}
  }

  function riskSimHideNativeBodyCalc(root){
    if(!root) return;
    const hide = (el) => {
      if(!el || el.closest?.(".giSimShell__foot") || el.closest?.(".giValModal__foot")) return;
      if(el.hasAttribute?.("data-gishell-calc")) return;
      el.classList.add("giSimShell__nativeCalcHidden");
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
      try { el.style.display = "none"; } catch(_e) {}
    };
    root.querySelectorAll(
      "[class*='__calcBtn'], [class*='__actions'], " +
      "[data-phx-calc], [data-mnr-calc], [data-phxmort-calc], [data-mnrci-calc], " +
      "[data-mgdci-calc], [data-mgdca-calc], [data-mgdr-calc], [data-mgdad-calc], [data-mgdacd-calc], [data-hachci-calc]"
    ).forEach(hide);
    // כפתורי btn עם הטקסט בגוף (גיבוי)
    root.querySelectorAll("button.btn").forEach((btn) => {
      if(btn.closest?.(".giSimShell__foot") || btn.closest?.(".giValModal__foot")) return;
      if(btn.hasAttribute("data-gishell-calc")) return;
      const t = safeTrim(btn.textContent);
      if(t === "חשב פרמיה") hide(btn);
    });
  }

  function riskSimAugmentStandaloneChrome(sim){
    const modal = sim && sim._modal;
    if(!modal || !sim._ctx?.standalone) return;
    if(sim._showFinalSummary) return;
    modal.classList.add("giSimShellModal");
    const card = modal.querySelector(".giValModal__card");
    if(!card) return;
    card.classList.add("giSimShell__card");

    const company = safeTrim(sim._ctx.company);
    const product = safeTrim(sim._ctx.product);
    const prefix = riskSimDetectClosePrefix(modal) || "sim";
    const insureds = Array.isArray(sim._ctx.insureds) ? sim._ctx.insureds : [];
    const activeId = sim._activeInsuredId;

    const head = card.querySelector(".giValModal__head");
    if(head){
      head.classList.add("giSimShell__head");
      const title = head.querySelector(".giValModal__title");
      if(title && company && product){
        title.textContent = company + " · " + product;
      }
      let crumb = head.querySelector(".giSimShell__crumb");
      if(!crumb){
        crumb = document.createElement("div");
        crumb.className = "giSimShell__crumb";
        if(title && title.parentNode) title.parentNode.insertBefore(crumb, title.nextSibling);
        else head.appendChild(crumb);
      }
      crumb.textContent = "מרכז הסימולטורים › " + company + " › " + product;

      // לוגו גמל — מוחלט למעלה מימין + מעל לוגו החברה
      let brandLogo = head.querySelector(".giSimShell__brandLogo");
      if(!brandLogo){
        brandLogo = document.createElement("img");
        brandLogo.className = "giSimShell__brandLogo";
        brandLogo.src = "./logo-login-clean.png?v=20260810-sim-fix-v2";
        brandLogo.alt = "GEMEL INVEST";
        brandLogo.width = 1808;
        brandLogo.height = 373;
        brandLogo.decoding = "async";
        brandLogo.setAttribute("aria-hidden", "true");
        brandLogo.style.cssText = "position:absolute;top:10px;right:16px;left:auto;height:24px;width:auto;max-width:110px;object-fit:contain;z-index:3;pointer-events:none;display:block;";
        head.appendChild(brandLogo);
      } else {
        brandLogo.style.cssText = "position:absolute;top:10px;right:16px;left:auto;height:24px;width:auto;max-width:110px;object-fit:contain;z-index:3;pointer-events:none;display:block;";
        if(brandLogo.getAttribute("src") !== "./logo-login-clean.png?v=20260810-sim-fix-v2"){
          brandLogo.src = "./logo-login-clean.png?v=20260810-sim-fix-v2";
        }
      }

      let brandStack = head.querySelector(".giSimShell__brandStack");
      const headIcon = head.querySelector(".giValModal__headIcon");
      if(!brandStack){
        brandStack = document.createElement("div");
        brandStack.className = "giSimShell__brandStack";
        brandStack.setAttribute("aria-hidden", "true");
        brandStack.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;flex:0 0 auto;margin-top:18px;";
        if(headIcon){
          headIcon.parentNode.insertBefore(brandStack, headIcon);
          brandStack.appendChild(headIcon);
        } else {
          head.insertBefore(brandStack, head.firstChild);
        }
      } else if(headIcon && headIcon.parentNode !== brandStack){
        brandStack.appendChild(headIcon);
      }
      // מרווח לכותרת כדי שלא תתנגש בלוגו
      head.style.paddingTop = head.style.paddingTop || "28px";
      const headText = head.querySelector(".giValModal__headText");
      if(headText) headText.style.paddingInlineEnd = "120px";
    }

    const body = card.querySelector(".giValModal__body");
    if(body){
      let bar = body.querySelector(".giSimShell__insuredBar");
      if(bar) bar.remove();
      bar = document.createElement("div");
      bar.className = "giSimShell__insuredBar";
      const tabs = insureds.map((ins) => {
        const s = sim._state?.[ins.id];
        const cls = [
          "giSimShell__tab",
          ins.id === activeId ? "is-active" : "",
          s?.result?.ok ? "has-result" : ""
        ].filter(Boolean).join(" ");
        return `<button type="button" class="${cls}" data-gishell-tab="${escapeHtml(String(ins.id || ""))}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}</button>`;
      }).join("");
      bar.innerHTML = tabs + `<button type="button" class="giSimShell__addIns" data-gishell-add-ins="1">+ הוסף מבוטח</button>`;
      body.insertBefore(bar, body.firstChild);
      try { riskSimLayoutStandaloneBody(body, sim); } catch(_e) {}
      try { riskSimHideNativeBodyCalc(card); } catch(_e2) {}
    }

    const foot = card.querySelector(".giValModal__foot");
    if(foot){
      foot.classList.add("giSimShell__foot");
      const active = sim._state?.[activeId];
      const monthly = Number(active?.result?.monthlyPremium) || 0;
      const total = riskSimTotalMonthlyPremiums(sim._state);
      foot.innerHTML = `
        <div class="giSimShell__premBlock">
          <span class="giSimShell__premLabel">פרמיה חודשית</span>
          <strong class="giSimShell__premValue">₪${escapeHtml(riskSimFormatMoneyShekels(monthly))}</strong>
        </div>
        <div class="giSimShell__premBlock">
          <span class="giSimShell__premLabel">סה״כ לכל המבוטחים</span>
          <strong class="giSimShell__premValue giSimShell__premValue--total">₪${escapeHtml(riskSimFormatMoneyShekels(total))}</strong>
        </div>
        <div class="giSimShell__footActions">
          ${typeof window !== "undefined" && typeof window.GI_SIM_BACK_TO_PICKER === "function"
            ? `<button type="button" class="btn giSimShell__backBtn" data-gishell-back-picker="1">חזרה לבחירה</button>`
            : ""}
          <button type="button" class="btn giSimShell__closeBtn" data-${escapeHtml(prefix)}-close="1">סגור</button>
          <button type="button" class="btn btn--primary giSimShell__calcBtn" data-gishell-calc="1">חשב פרמיה</button>
        </div>`;
    }
  }

  function riskSimBindStandaloneChrome(sim){
    const modal = sim && sim._modal;
    if(!modal || !sim._ctx?.standalone) return;
    if(sim._showFinalSummary) return;
    const prefix = riskSimDetectClosePrefix(modal) || "sim";

    $$("[data-gishell-tab]", modal).forEach((btn) => {
      if(btn._giShellBound) return;
      btn._giShellBound = true;
      on(btn, "click", (ev) => {
        ev.preventDefault();
        const id = btn.getAttribute("data-gishell-tab");
        if(!id) return;
        if(typeof sim._switchInsured === "function") sim._switchInsured(id);
        else { sim._activeInsuredId = id; try { sim._render(); } catch(_e) {} }
      });
    });

    const addBtn = modal.querySelector("[data-gishell-add-ins]");
    if(addBtn && !addBtn._giShellBound){
      addBtn._giShellBound = true;
      on(addBtn, "click", (ev) => {
        ev.preventDefault();
        riskSimAddStandaloneInsured(sim);
      });
    }

    const calcBtn = modal.querySelector("[data-gishell-calc]");
    if(calcBtn && !calcBtn._giShellBound){
      calcBtn._giShellBound = true;
      on(calcBtn, "click", (ev) => {
        ev.preventDefault();
        const id = sim._activeInsuredId;
        try {
          if(typeof sim._calc === "function"){
            sim._calc(id);
          } else if(typeof sim._recalcState === "function"){
            sim._recalcState(sim._state?.[id]);
            if(typeof sim._render === "function") sim._render();
          } else {
            const native = modal.querySelector(`[data-${prefix}-calc]`);
            if(native) native.click();
            else if(typeof sim._render === "function") sim._render();
          }
        } catch(_e) {
          try { if(typeof sim._render === "function") sim._render(); } catch(_e2) {}
        }
      });
    }

    $$(`[data-${prefix}-close]`, modal).forEach((el) => {
      if(el._giShellCloseBound) return;
      el._giShellCloseBound = true;
      on(el, "click", (ev) => {
        ev.preventDefault();
        try { sim.close(); } catch(_e) {}
      });
    });

    const backBtn = modal.querySelector("[data-gishell-back-picker]");
    if(backBtn && !backBtn._giShellBound){
      backBtn._giShellBound = true;
      on(backBtn, "click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        riskSimReturnToPicker(sim);
      });
    }
  }

  function riskSimCollectCenterDetails(sim){
    const base = riskSimJsonClone(sim?._ctx?.simCenterDetails) || {};
    const st = (sim && sim._state && (sim._state[sim._activeInsuredId] || sim._state["standalone-1"])) || {};
    const smoker = st.smoker === true ? "yes" : (st.smoker === false ? "no" : safeTrim(base.smoker || ""));
    const gender = (st.gender === "זכר" || st.gender === "נקבה") ? st.gender : safeTrim(base.gender || "");
    return {
      birthDate: safeTrim(st.birthDate || base.birthDate || ""),
      gender,
      smoker,
      insuranceStartDate: safeTrim(st.insuranceStartDate || base.insuranceStartDate || ""),
      occupation: safeTrim(st.occupation || base.occupation || "")
    };
  }

  function riskSimReturnToPicker(sim){
    if(!sim) return;
    const payload = {
      details: riskSimCollectCenterDetails(sim),
      company: safeTrim(sim._ctx?.company),
      product: safeTrim(sim._ctx?.product)
    };
    sim._giSkipSavePrompt = true;
    try { sim.close(); } catch(_e) {}
    try {
      if(typeof window === "undefined" || typeof window.GI_SIM_BACK_TO_PICKER !== "function") return;
      window.setTimeout(() => {
        try { window.GI_SIM_BACK_TO_PICKER(payload); } catch(err) {
          try { console.error("SIM_BACK_TO_PICKER_FAILED", err); } catch(_e2) {}
        }
      }, 220);
    } catch(_e) {}
  }

  /* ===== GI-SIM-SAVE 2026-08-12 — שמירת חישוב פרמיה ושחזורו =================
     כל דרכי היציאה מסימולטור (X, "סגור", לחיצה על הרקע ו-Escape) מגיעות בסופו
     של דבר ל-close() של אותו סימולטור. לכן די בעטיפה אחת כאן כדי לתפוס את
     כולן בכל הסימולטורים, בלי לגעת באף אחד מהם בנפרד.
     המודאל ששואל "לשמור?" ושכבת Supabase יושבים ב-app.js ומתחברים דרך
     window.GI_SIM_SAVE_PROMPT — כך שקובץ הסימולטורים נשאר בלי תלות באפליקציה,
     וכשההוק לא מותקן הסגירה מתנהגת בדיוק כפי שהתנהגה עד היום. */
  function riskSimJsonClone(value){
    try { return JSON.parse(JSON.stringify(value == null ? null : value)); }
    catch(_e) { return null; }
  }

  function riskSimHasSavableResult(sim){
    const map = sim && sim._state && typeof sim._state === "object" ? sim._state : null;
    if(!map) return false;
    return Object.keys(map).some((k) => !!map[k]?.result?.ok);
  }

  function riskSimBuildSaveSnapshot(sim){
    const ctx = (sim && sim._ctx) || {};
    const map = (sim && sim._state && typeof sim._state === "object") ? sim._state : {};
    const insureds = (Array.isArray(ctx.insureds) ? ctx.insureds : []).map((ins, idx) => ({
      id: safeTrim(ins?.id) || ("standalone-" + (idx + 1)),
      label: safeTrim(ins?.label) || ("מבוטח " + (idx + 1)),
      data: riskSimJsonClone(ins?.data) || {}
    }));
    const state = {};
    Object.keys(map).forEach((k) => {
      const clone = riskSimJsonClone(map[k]);
      if(clone) state[k] = clone;
    });
    return {
      company: safeTrim(ctx.company),
      product: safeTrim(ctx.product),
      details: riskSimJsonClone(ctx.simCenterDetails) || null,
      insuranceStartDate: safeTrim(ctx.insuranceStartDate || ctx.startDate || ""),
      insureds,
      activeInsuredId: safeTrim(sim?._activeInsuredId),
      state,
      totalMonthly: riskSimTotalMonthlyPremiums(map),
      savedRecordId: safeTrim(ctx.savedRecordId),
      savedClientName: safeTrim(ctx.savedClientName)
    };
  }

  function riskSimApplyRestoredState(sim, restore, activeId){
    if(!sim || !restore || typeof restore !== "object") return;
    if(!sim._state || typeof sim._state !== "object") sim._state = {};
    Object.keys(restore).forEach((id) => {
      const saved = riskSimJsonClone(restore[id]);
      if(!saved) return;
      /* מיזוג ולא החלפה: ברירות המחדל שהסימולטור בנה זה עתה נשארות עבור שדות
         שנוספו אחרי השמירה, והערכים השמורים נכתבים מעליהן. */
      sim._state[id] = Object.assign({}, sim._state[id] || {}, saved);
    });
    const wanted = safeTrim(activeId);
    if(wanted && sim._state[wanted]) sim._activeInsuredId = wanted;
    try { if(typeof sim._render === "function") sim._render(); } catch(_e) {}
  }

  function riskSimShouldPromptSave(sim){
    if(!sim || !sim._modal) return false;
    if(!sim._ctx || !sim._ctx.standalone) return false;
    /* open() קורא ל-close() בתחילתו — אין לשאול על שמירה בזמן פתיחה. */
    if(sim._giOpening) return false;
    if(typeof window === "undefined" || typeof window.GI_SIM_SAVE_PROMPT !== "function") return false;
    return riskSimHasSavableResult(sim);
  }

  /* ===== GI-SIM-DISC 2026-08-17 — הנחות בתוך הסימולטור בלבד ================
     סל נפרד לגמרי ממנוע «עדכון הנחה» של האשף. לא משנה תעריף, לא משנה onApply, לא כותב
     הנחה לפוליסה. רק בחירה במסך הסימולטור + תצוגת פרמיה לאחר הנחה.
     מופיע גם במרכז הסימולטורים וגם בפתיחה מהאשף, כי ההזרקה רצה אחרי כל _bind.
     בריאות: אפשר אחוז אחיד, כיסויים פטורים במחיר מלא (fullPriceIds), או פיצול לפי
     תעריפון (pctByCover). בפיצול — כיסוי שלא במפה נשאר במחיר מלא. חבילת בריאות
     בלי מפה/פטורים לא מקבלת אחוז מוצר כ-fallback. מרפא/סרטן לא נכנסים לסימולטור
     בריאות. */
  function giSimDiscOpt(id, label, scheduleOrPct, extra){
    const opt = { id: String(id || ""), label: String(label || "") };
    if(Array.isArray(scheduleOrPct)){
      opt.schedule = scheduleOrPct.slice();
      opt.pct = Number(scheduleOrPct[0]) || 0;
      opt.years = scheduleOrPct.length;
    } else {
      opt.pct = Number(scheduleOrPct) || 0;
      opt.years = extra && extra.years != null ? extra.years : 10;
    }
    if(extra && typeof extra === "object"){
      Object.keys(extra).forEach((k) => {
        if(k === "years" && Array.isArray(scheduleOrPct)) return;
        opt[k] = extra[k];
      });
    }
    return opt;
  }

  const GI_SIMULATOR_DISCOUNT_CATALOG = {
    "הפניקס": {
      "בריאות": [
        giSimDiscOpt("phx-h-10-base-shaban", "10% ל-10 שנים — רובד בסיס + משלים שב״ן", 10, { years: 10, pctByCover: { transplant:10, abroad_surgery:10, drugs:10, surgery_shaban:10, surgery_shaban_5000:10 } }),
        giSimDiscOpt("phx-h-15-first-amb", "15% ל-10 שנים — שקל ראשון + אמבולטורי + כתבי שירות", 15, { years: 10, pctByCover: { surgery_first_shekel:15, ambulatory_consults:15, fast_diagnosis:15, ambulatory_package:15, ambulatory_accompany:15, complementary:15, child_dev:15, expert_click:15 } }),
        giSimDiscOpt("phx-h-20-gemel", "20% ל-10 שנים — משלים שב״ן + שקל ראשון כולל כתבי שירות (גמל INVEST)", 20, { years: 10, pctByCover: { surgery_shaban:20, surgery_shaban_5000:20, surgery_first_shekel:20, complementary:20, child_dev:20, expert_click:20 } }),
        giSimDiscOpt("phx-h-10-base-only", "10% ל-10 שנים — בסיס בלבד (גמל INVEST)", 10, { years: 10, pctByCover: { transplant:10, abroad_surgery:10, drugs:10 } })
      ],
      "מחלות קשות": [
        giSimDiscOpt("phx-ci-20-age20", "20% ל-10 שנים — בטוח מרפא (עד גיל 20 כולל)", 20, { years: 10 }),
        giSimDiscOpt("phx-ci-25-age21", "25% ל-10 שנים — בטוח מרפא (גיל 21+)", 25, { years: 10 })
      ],
      "סרטן": [
        giSimDiscOpt("phx-ca-20-age20", "20% ל-10 שנים — מרפא סרטן (עד גיל 20 כולל)", 20, { years: 10 }),
        giSimDiscOpt("phx-ca-25-age21", "25% ל-10 שנים — מרפא סרטן (גיל 21+)", 25, { years: 10 })
      ],
      "ריסק": [
        giSimDiscOpt("phx-r-35-15x6", "15/15/15/15/15/15 — 35₪+ לאחר הנחה · ללא הגבלת גיל", [15,15,15,15,15,15]),
        giSimDiscOpt("phx-r-35-30", "30/30/30/25/25/15 — 35₪+ לאחר הנחה · ללא הגבלת גיל", [30,30,30,25,25,15]),
        giSimDiscOpt("phx-r-35-35", "35/35/30/20/15/15 — 35₪+ לאחר הנחה · ללא הגבלת גיל", [35,35,30,20,15,15]),
        giSimDiscOpt("phx-r-35-45", "45/35/25/15/15/15 — 35₪+ לאחר הנחה · ללא הגבלת גיל", [45,35,25,15,15,15]),
        giSimDiscOpt("phx-r-100-40", "40/40/40/40/30/15 — מעל 100₪ לפני הנחה · ללא הגבלת גיל", [40,40,40,40,30,15]),
        giSimDiscOpt("phx-r-100-50", "50/50/40/30/20/15 — מעל 100₪ לפני הנחה · ללא הגבלת גיל", [50,50,40,30,20,15]),
        giSimDiscOpt("phx-r-100-60", "60/50/35/25/15/15 — מעל 100₪ לפני הנחה · ללא הגבלת גיל", [60,50,35,25,15,15]),
        giSimDiscOpt("phx-r-100-65", "65/50/35/20/15/15 — מעל 100₪ לפני הנחה · ללא הגבלת גיל", [65,50,35,20,15,15]),
        giSimDiscOpt("phx-r-100-65a-50", "50/50/50/50/30/30 — מעל 100₪ לפני הנחה · עד גיל 65", [50,50,50,50,30,30]),
        giSimDiscOpt("phx-r-100-65a-55", "55/55/55/40/30/25 — מעל 100₪ לפני הנחה · עד גיל 65", [55,55,55,40,30,25]),
        giSimDiscOpt("phx-r-100-65a-60", "60/60/50/40/30/20 — מעל 100₪ לפני הנחה · עד גיל 65", [60,60,50,40,30,20]),
        giSimDiscOpt("phx-r-100-65a-65", "65/55/50/40/30/20 — מעל 100₪ לפני הנחה · עד גיל 65", [65,55,50,40,30,20]),
        giSimDiscOpt("phx-r-150-55", "55/55/55/55/35/25 — מעל 150₪ לפני הנחה · עד גיל 65", [55,55,55,55,35,25]),
        giSimDiscOpt("phx-r-150-60", "60/60/50/50/40/20 — מעל 150₪ לפני הנחה · עד גיל 65", [60,60,50,50,40,20]),
        giSimDiscOpt("phx-r-150-65", "65/65/55/45/30/20 — מעל 150₪ לפני הנחה · עד גיל 65", [65,65,55,45,30,20]),
        giSimDiscOpt("phx-r-200-60", "60/60/60/50/40/20 — מעל 200₪ לפני הנחה · עד גיל 65", [60,60,60,50,40,20]),
        giSimDiscOpt("phx-r-200-65a", "65/65/60/50/35/20 — מעל 200₪ לפני הנחה · עד גיל 65", [65,65,60,50,35,20]),
        giSimDiscOpt("phx-r-200-65b", "65/65/65/50/30/20 — מעל 200₪ לפני הנחה · עד גיל 65", [65,65,65,50,30,20]),
        giSimDiscOpt("phx-r-gemel-60", "60/60/60/60/60/60 — גמל INVEST · גיל 30–55 · עד 3M · 200₪+ לפני הנחה · חיים+מחלות קשות", [60,60,60,60,60,60]),
        giSimDiscOpt("phx-r-gemel-70", "70/60/60/60/60/60 — גמל INVEST · גיל 30–55 · עד 3M · 200₪+ לפני הנחה · חיים+מחלות קשות", [70,60,60,60,60,60])
      ],
      "ריסק משכנתא": [
        giSimDiscOpt("phx-m-100dn-40", "40/40/30/30/20/20 — 100₪ ומטה לפני הנחה", [40,40,30,30,20,20]),
        giSimDiscOpt("phx-m-100up-50a", "50/45/35/25/15/15 — 100₪ ומעלה לפני הנחה", [50,45,35,25,15,15]),
        giSimDiscOpt("phx-m-100up-50b", "50/45/35/25/20/20 — 100₪ ומעלה לפני הנחה", [50,45,35,25,20,20]),
        giSimDiscOpt("phx-m-150dn-40", "40/40/30/30/20/20 — עד 150₪ לפני הנחה", [40,40,30,30,20,20]),
        giSimDiscOpt("phx-m-150dn-50a", "50/45/35/25/20/20 — עד 150₪ לפני הנחה", [50,45,35,25,20,20]),
        giSimDiscOpt("phx-m-150dn-50b", "50/50/40/30/20/15 — עד 150₪ לפני הנחה", [50,50,40,30,20,15]),
        giSimDiscOpt("phx-m-150dn-55a", "55/45/35/25/15/15 — עד 150₪ לפני הנחה", [55,45,35,25,15,15]),
        giSimDiscOpt("phx-m-150dn-55b", "55/50/40/30/25/15 — עד 150₪ לפני הנחה", [55,50,40,30,25,15]),
        giSimDiscOpt("phx-m-150dn-60", "60/50/35/25/15/15 — עד 150₪ לפני הנחה", [60,50,35,25,15,15]),
        giSimDiscOpt("phx-m-150dn-65", "65/50/35/25/15/15 — עד 150₪ לפני הנחה", [65,50,35,25,15,15]),
        giSimDiscOpt("phx-m-150up-55", "55/50/45/40/30/20 — 150₪ ומעלה לפני הנחה", [55,50,45,40,30,20]),
        giSimDiscOpt("phx-m-150up-60", "60/50/45/35/25/15 — 150₪ ומעלה לפני הנחה", [60,50,45,35,25,15]),
        giSimDiscOpt("phx-m-150up-65a", "65/50/40/30/20/15 — 150₪ ומעלה לפני הנחה", [65,50,40,30,20,15]),
        giSimDiscOpt("phx-m-150up-65b", "65/55/45/35/25/15 — 150₪ ומעלה לפני הנחה", [65,55,45,35,25,15])
      ]
    },
    "כלל": {
      "בריאות": [
        giSimDiscOpt("cll-h-10-3494", "10% ל-10 שנים — קוד 3494 (ללא רפואה משלימה וללא שירותים לילד)", 10, { years: 10, fullPriceIds: ["complementary", "child_services"] }),
        giSimDiscOpt("cll-h-15-all", "15% על הכול — קוד 3494 (ללא רפואה משלימה וללא שירותים לילד)", 15, { years: 10, fullPriceIds: ["complementary", "child_services"] }),
        giSimDiscOpt("cll-h-20-exca", "20% על הכול מלבד סרטן — קוד 3494 (ללא רפואה משלימה וללא שירותים לילד)", 20, { years: 10, fullPriceIds: ["complementary", "child_services"] })
      ],
      "מחלות קשות": [
        giSimDiscOpt("cll-ci-10-250", "10% ל-10 שנים — עד 250,000 ₪", 10, { years: 10 }),
        giSimDiscOpt("cll-ci-15-250-400", "15% ל-10 שנים — 250,000–400,000 ₪", 15, { years: 10 }),
        giSimDiscOpt("cll-ci-20-400", "20% ל-10 שנים — מ-400,000 ₪", 20, { years: 10 })
      ],
      "סרטן": [
        giSimDiscOpt("cll-ca-10-3494", "10% ל-10 שנים — פיצוי לסרטן · קוד 3494", 10, { years: 10 })
      ],
      "ריסק": [
        giSimDiscOpt("cll-r-5001", "65/65/60/60/50/40 — קוד 5001 · מינ׳ 1M · גיל 35–60", [65,65,60,60,50,40]),
        giSimDiscOpt("cll-r-5002", "70/65/60/60/50/40 — קוד 5002 · מינ׳ 1.3M · גיל 30–60", [70,65,60,60,50,40]),
        giSimDiscOpt("cll-r-3584", "72/62/62/52/52/42 — קוד 3584 · מינ׳ 2M · גיל 30–60", [72,62,62,52,52,42]),
        giSimDiscOpt("cll-r-3585", "60/60/60/50/50/50 — קוד 3585 · מינ׳ 2M · גיל 30–60", [60,60,60,50,50,50]),
        giSimDiscOpt("cll-r-3586", "58/58/58/58/58/58 — קוד 3586 · מינ׳ 2M · גיל 30–60", [58,58,58,58,58,58]),
        giSimDiscOpt("cll-r-3587", "70/58/58/48/48/38 — קוד 3587 · מינ׳ 1.5M · גיל 30–60", [70,58,58,48,48,38]),
        giSimDiscOpt("cll-r-3588", "70/60/60/45/45/40 — קוד 3588 · מינ׳ 1.5M · גיל 30–60", [70,60,60,45,45,40]),
        giSimDiscOpt("cll-r-3589", "53/53/53/53/53/53 — קוד 3589 · מינ׳ 1.5M · גיל 30–60", [53,53,53,53,53,53]),
        giSimDiscOpt("cll-r-3590", "65/55/55/45/45/35 — קוד 3590 · מינ׳ 1M · גיל 30–60", [65,55,55,45,45,35]),
        giSimDiscOpt("cll-r-3592", "50/50/50/50/50/50 — קוד 3592 · מינ׳ 1M · גיל 30–60", [50,50,50,50,50,50]),
        giSimDiscOpt("cll-r-sup-1m", "55/50/50/50/50/50 — דרך המפקח · מינ׳ 1M · גיל 35–65", [55,50,50,50,50,50]),
        giSimDiscOpt("cll-r-3593", "38/38/38/38/38/38 — קוד 3593 · מינ׳ 750K · גיל 30–60", [38,38,38,38,38,38]),
        giSimDiscOpt("cll-r-3594", "55/45/45/35/35/20 — קוד 3594 · מינ׳ 750K · גיל 30–60", [55,45,45,35,35,20]),
        giSimDiscOpt("cll-r-3595", "55/45/45/45/45/45 — קוד 3595 · מינ׳ 500K · גיל 30–60", [55,45,45,45,45,45]),
        giSimDiscOpt("cll-r-sup-500k", "55/45/45/45/45/45 — דרך המפקח · מינ׳ 500K · גיל 35–65", [55,45,45,45,45,45]),
        giSimDiscOpt("cll-r-3674", "65/60/60/50/45/40 — קוד 3674 · קיץ 2026 · מינ׳ 1M · גיל 50–65 · עד 4M", [65,60,60,50,45,40]),
        giSimDiscOpt("cll-r-3675", "65/55/55/45/45/35 — קוד 3675 · קיץ 2026 · מינ׳ 750K · גיל 50–65 · עד 4M", [65,55,55,45,45,35]),
        giSimDiscOpt("cll-r-3676", "60/55/50/40/40/30 — קוד 3676 · קיץ 2026 · מינ׳ 500K · גיל 50–65 · עד 4M", [60,55,50,40,40,30]),
        giSimDiscOpt("cll-r-3703", "72/65/65/55/45/45 — קוד 3703 · מכוננות מעודכן · מינ׳ 2M · גיל 30–67", [72,65,65,55,45,45]),
        giSimDiscOpt("cll-r-3704", "70/65/60/55/50/40 — קוד 3704 · מכוננות מעודכן · מינ׳ 1.5M · גיל 30–67", [70,65,60,55,50,40]),
        giSimDiscOpt("cll-r-3705", "70/65/60/50/40/40 — קוד 3705 · מכוננות מעודכן · מינ׳ 1M · גיל 30–67", [70,65,60,50,40,40]),
        giSimDiscOpt("cll-r-3706", "65/60/55/50/45/40 — קוד 3706 · מכוננות מעודכן · מינ׳ 750K · גיל 30–67", [65,60,55,50,45,40]),
        giSimDiscOpt("cll-r-3707", "65/55/55/50/40/30 — קוד 3707 · מכוננות מעודכן · מינ׳ 500K · גיל 30–67", [65,55,55,50,40,30]),
        giSimDiscOpt("cll-r-3603", "50/50/50/45/45/45 — קוד 3603/3604 · סייל דיגיטל · מינ׳ 2M · גיל 30–60 · עד 4M", [50,50,50,45,45,45]),
        giSimDiscOpt("cll-r-3561", "30/30/30/30/30/30/30/30 — קוד 3561/3562 · סייל דיגיטל · מינ׳ 1.8M · גיל 30–65 · עד 4M", [30,30,30,30,30,30,30,30]),
        giSimDiscOpt("cll-r-3605", "47/47/47/43/43/43 — קוד 3605/3606 · סייל דיגיטל · מינ׳ 1.5M · גיל 30–60 · עד 4M", [47,47,47,43,43,43]),
        giSimDiscOpt("cll-r-3563", "60/50/50/40/40/30 — קוד 3563/3564 · סייל דיגיטל · מינ׳ 1M · גיל 30–65 · עד 4M", [60,50,50,40,40,30]),
        giSimDiscOpt("cll-r-3567", "52/42/42/32/32/17 — קוד 3567/3568 · סייל דיגיטל · מינ׳ 750K · גיל 30–65 · עד 4M", [52,42,42,32,32,17]),
        giSimDiscOpt("cll-r-3569", "40/30/20/15/15/15 — קוד 3569/3570 · סייל דיגיטל · מינ׳ 350K · גיל 30–65 · עד 4M", [40,30,20,15,15,15]),
        giSimDiscOpt("cll-r-3571", "30/15/15/15/15/15 — קוד 3571/3572 · סייל דיגיטל · כל גיל · עד 4M", [30,15,15,15,15,15]),
        giSimDiscOpt("cll-r-3573", "60/52/52/42/42/32 — קוד 3573/3574 · כפול למשפחה פלוס · מינ׳ 1M · גיל 30–65 · עד 4M", [60,52,52,42,42,32]),
        giSimDiscOpt("cll-r-3575", "55/47/47/32/32/17 — קוד 3575/3576 · כפול למשפחה פרימיום · מינ׳ 750K · גיל 30–65 · עד 4M", [55,47,47,32,32,17]),
        giSimDiscOpt("cll-r-3577", "55/42/32/32/22/22 — קוד 3577/3578 · כפול למשפחה · מינ׳ 500K · גיל 30–65 · עד 4M", [55,42,32,32,22,22])
      ],
      "ריסק משכנתא": [
        giSimDiscOpt("cll-m-3621", "30/15/15/15/15/15 — כלל סייל 3621 · כל גיל", [30,15,15,15,15,15]),
        giSimDiscOpt("cll-m-3619", "40/30/20/20/20/20 — כלל סייל 3619 · מעל 500K · כל גיל", [40,30,20,20,20,20]),
        giSimDiscOpt("cll-m-3618", "30/20/20/20/20/20 — כלל סייל 3618 · מעל 500K · גיל 30–56 · משנה 15: 45%", [30,20,20,20,20,20]),
        giSimDiscOpt("cll-m-3620", "50/40/30/20/15/15 — כלל סייל 3620 · מעל 750K · גיל 30–56", [50,40,30,20,15,15]),
        giSimDiscOpt("cll-m-3614", "60/50/40/40/30/30 — כלל סייל 3614 · מעל 1M · גיל 30–56", [60,50,40,40,30,30]),
        giSimDiscOpt("cll-m-3636", "50/40/30/20/20/15 — כלל סייל 3636 · מעל 1M · גיל 30–65", [50,40,30,20,20,15]),
        giSimDiscOpt("cll-m-3615", "60/55/45/45/35/30 — כלל סייל 3615 · מעל 1.3M · גיל 30–56", [60,55,45,45,35,30]),
        giSimDiscOpt("cll-m-3622", "43/43/43/43/43/43 — כלל סייל 3622 · מעל 1.3M · גיל 30–56", [43,43,43,43,43,43]),
        giSimDiscOpt("cll-m-3616", "65/55/55/45/45/35 — כלל סייל 3616 · מעל 1.5M · גיל 30–56", [65,55,55,45,45,35]),
        giSimDiscOpt("cll-m-3623", "48/48/48/48/48/48 — כלל סייל 3623 · מעל 1.5M · גיל 30–56", [48,48,48,48,48,48]),
        giSimDiscOpt("cll-m-3617", "53/53/53/53/53/53 — כלל סייל 3617 · מעל 1.8M · גיל 30–56", [53,53,53,53,53,53]),
        giSimDiscOpt("cll-m-3624", "65/55/50/45/40/35 — זהב 3624 · מעל 1M · גיל 30–56", [65,55,50,45,40,35]),
        giSimDiscOpt("cll-m-3637", "55/45/35/35/25/10 — זהב 3637 · מעל 1M · גיל 30–65", [55,45,35,35,25,10]),
        giSimDiscOpt("cll-m-3638", "50/45/45/35/25/25 — זהב 3638 · מעל 1M · גיל 35–60 · משנה 15: 99%", [50,45,45,35,25,25]),
        giSimDiscOpt("cll-m-3639", "55/50/50/40/30/30 — זהב 3639 · מעל 1.3M · גיל 35–60 · משנה 15: 99%", [55,50,50,40,30,30]),
        giSimDiscOpt("cll-m-3625", "65/60/55/50/45/35 — זהב 3625 · מעל 1.3M · גיל 30–56", [65,60,55,50,45,35]),
        giSimDiscOpt("cll-m-3626", "50/50/50/50/50/50 — זהב 3626 · מעל 1.3M · גיל 30–56", [50,50,50,50,50,50]),
        giSimDiscOpt("cll-m-3627", "70/65/60/55/50/40 — זהב 3627 · מעל 1.5M · גיל 30–56", [70,65,60,55,50,40]),
        giSimDiscOpt("cll-m-3628", "55/55/55/55/55/55 — זהב 3628 · מעל 1.5M · גיל 30–56", [55,55,55,55,55,55]),
        giSimDiscOpt("cll-m-3629", "60/60/60/60/60/60 — זהב 3629 · מעל 1.8M · גיל 30–56", [60,60,60,60,60,60]),
        giSimDiscOpt("cll-m-3635", "70/60/55/50/45/35 — פלטינה 3635 · מעל 1M · גיל 30–56", [70,60,55,50,45,35]),
        giSimDiscOpt("cll-m-3640", "60/55/55/45/40/35 — פלטינה 3640 · מעל 1M · גיל 30–65", [60,55,55,45,40,35]),
        giSimDiscOpt("cll-m-3641", "55/50/45/40/35/30 — פלטינה 3641 · מעל 1M · גיל 35–60 · משנה 15: 99%", [55,50,45,40,35,30]),
        giSimDiscOpt("cll-m-3642", "60/55/55/45/40/35 — פלטינה 3642 · מעל 1.3M · גיל 35–60 · משנה 15: 99%", [60,55,55,45,40,35]),
        giSimDiscOpt("cll-m-3630", "70/65/60/55/50/40 — פלטינה 3630 · מעל 1.3M · גיל 30–56", [70,65,60,55,50,40]),
        giSimDiscOpt("cll-m-3631", "55/55/55/55/55/55 — פלטינה 3631 · מעל 1.3M · גיל 30–56", [55,55,55,55,55,55]),
        giSimDiscOpt("cll-m-3632", "70/70/65/60/55/45 — פלטינה 3632 · מעל 1.5M · גיל 30–56", [70,70,65,60,55,45]),
        giSimDiscOpt("cll-m-3633", "60/60/60/60/60/60 — פלטינה 3633 · מעל 1.5M · גיל 30–56", [60,60,60,60,60,60]),
        giSimDiscOpt("cll-m-3634", "65/65/65/65/65/65 — פלטינה 3634 · מעל 1.8M · גיל 30–56", [65,65,65,65,65,65])
      ]
    },
    "הכשרה": {
      "בריאות": [
        giSimDiscOpt("hach-h-20-core", "20% ל-10 שנים — תרופות + השתלות + ניתוחים בחו״ל + משלים שב״ן + שקל ראשון (ללא אמבולטורי וללא פרימיום לילד)", 20, { years: 10, fullPriceIds: ["ambulatory_consults", "child_premium"] })
      ],
      "מחלות קשות": [
        giSimDiscOpt("hach-ci-40", "40% ל-10 שנים — מחלות קשות", 40, { years: 10 })
      ],
      "ריסק": [
        giSimDiscOpt("hach-r-100", "55/50/30/15/15/15 — מגן 1 מסלול 100 · 125₪+ ברוטו · חודש ראשון חינם לפי בקשת סוכן", [55,50,30,15,15,15]),
        giSimDiscOpt("hach-r-200", "60/50/40/30/25/15 — מגן 1 מסלול 200 · 150₪+ ברוטו", [60,50,40,30,25,15]),
        giSimDiscOpt("hach-r-300", "40/30/15/15/15/15 — מגן 1 מסלול 300 · 100₪+ ברוטו", [40,30,15,15,15,15]),
        giSimDiscOpt("hach-r-400", "15/15/15/15/15/15 — מגן 1 מסלול 400 · 60₪+ ברוטו", [15,15,15,15,15,15]),
        giSimDiscOpt("hach-r-silver", "65/60/50/50/50/50 — מגן 1 סילבר · מינ׳ 1M · גיל 35–60 · 200₪+ ברוטו", [65,60,50,50,50,50]),
        giSimDiscOpt("hach-r-gold", "65/60/50/50/50/50 — מגן 1 גולד · מינ׳ 1.5M · גיל 35–55 · 300₪+ ברוטו · שנים 7–10: 30%", [65,60,50,50,50,50,30,30,30,30])
      ],
      "ריסק משכנתא": [
        giSimDiscOpt("hach-m-100", "55/50/30/15/15/15 — מגן למשכנתא 100–101 · 125₪+ ברוטו · מינ׳ 10 שנים", [55,50,30,15,15,15]),
        giSimDiscOpt("hach-m-200", "60/50/40/30/25/15 — מגן למשכנתא 200 · 150₪+ ברוטו · מינ׳ 10 שנים", [60,50,40,30,25,15]),
        giSimDiscOpt("hach-m-500", "40/30/15/15/15/15 — מגן למשכנתא 500 · 100₪+ ברוטו · מינ׳ 10 שנים", [40,30,15,15,15,15]),
        giSimDiscOpt("hach-m-600", "50/40/30/25/15/15 — מגן למשכנתא 600–601 · 100₪+ ברוטו · מינ׳ 10 שנים", [50,40,30,25,15,15]),
        giSimDiscOpt("hach-m-700", "50/40/30/25/15/15 — מגן למשכנתא 700/701–702 · 100₪+ ברוטו · מינ׳ 15 שנים · משנה 13: 100%", [50,40,30,25,15,15]),
        giSimDiscOpt("hach-m-800", "40% לשנים 1–10 — מגן למשכנתא 800 · מינ׳ 1M · 150₪+ ברוטו", [40,40,40,40,40,40,40,40,40,40]),
        giSimDiscOpt("hach-m-850", "60/50/50/50/50/50 — מגן למשכנתא 850 · מינ׳ 1M · 150₪+ ברוטו · מינ׳ 10 שנים", [60,50,50,50,50,50]),
        giSimDiscOpt("hach-m-860", "30/30/30/30/30/30 — מגן למשכנתא 860 · 100₪+ ברוטו · שנים 1–15: 30% · 16–20: 20%", [30,30,30,30,30,30])
      ]
    },
    "מגדל": {
      "בריאות": [
        giSimDiscOpt("mgd-h-start-21355", "15% ל-10 שנים — START 21355 · רובד א׳ / ניתוחים בישראל / אמבולטורי", 15, { years: 10, pctByCover: { drugs:15, transplant:15, abroad_surgery:15, surgery_first_shekel:15, surgery_shaban:15, surgery_shaban_5000:15, ambulatory_base:15, ambulatory_extended:15, ambulatory_accompany:15, ambulatory_tech:15, fast_diagnosis:15, treatments_general:15, treatments_child_dev:15 } }),
        giSimDiscOpt("mgd-h-plus-21585", "PLUS 21585 — 15% רובד א׳ + 20% ניתוחים בישראל + כתבי שירות (דורש ניתוחים בישראל)", 15, { years: 10, pctByCover: { drugs:15, transplant:15, abroad_surgery:15, surgery_first_shekel:20, surgery_shaban:20, surgery_shaban_5000:20, complementary:20, online_consult:20, doctor_home:20 } }),
        giSimDiscOpt("mgd-h-top-21594", "TOP 21594 — 15% רובד א׳ + 25% שקל ראשון + כתבי שירות (דורש שקל ראשון)", 15, { years: 10, pctByCover: { drugs:15, transplant:15, abroad_surgery:15, surgery_first_shekel:25, complementary:25, online_consult:25, doctor_home:25 } })
      ],
      "מחלות קשות": [
        giSimDiscOpt("mgd-ci-20452", "10% ל-20 שנים — 20452 מזור מורחב · גיל 0–65", 10, { years: 20 }),
        giSimDiscOpt("mgd-ci-20890", "20% ל-10 שנים — 20890 מזור מורחב · גיל 0–65", 20, { years: 10 }),
        giSimDiscOpt("mgd-ci-start-plus", "20% ל-10 שנים — במסגרת START/PLUS", 20, { years: 10 }),
        giSimDiscOpt("mgd-ci-top", "25% ל-10 שנים — במסגרת TOP", 25, { years: 10 })
      ],
      "סרטן": [
        giSimDiscOpt("mgd-ca-20452", "10% ל-20 שנים — 20452 מזור לסרטן · גיל 0–65", 10, { years: 20 }),
        giSimDiscOpt("mgd-ca-20890", "20% ל-10 שנים — 20890 מזור לסרטן · גיל 0–65", 20, { years: 10 }),
        giSimDiscOpt("mgd-ca-start-plus", "20% ל-10 שנים — במסגרת START/PLUS", 20, { years: 10 }),
        giSimDiscOpt("mgd-ca-top", "25% ל-10 שנים — במסגרת TOP", 25, { years: 10 })
      ],
      "ריסק": [
        giSimDiscOpt("mgd-r-21527", "45/35/30/15/15/15 — 21527 מדורג עד 1M · עד גיל 39", [45,35,30,15,15,15]),
        giSimDiscOpt("mgd-r-21533", "45/35/30/15/15/15 — 21533 מדורג עד 1M · עד גיל 39 · חודש חינם", [45,35,30,15,15,15]),
        giSimDiscOpt("mgd-r-21528", "50/40/35/25/25/25 — 21528 מדורג עד 1M · גיל 40–49", [50,40,35,25,25,25]),
        giSimDiscOpt("mgd-r-21534", "50/40/35/25/25/25 — 21534 מדורג עד 1M · גיל 40–49 · חודש חינם", [50,40,35,25,25,25]),
        giSimDiscOpt("mgd-r-21529", "55/55/45/45/35/35 — 21529 מדורג עד 1M · גיל 50–67", [55,55,45,45,35,35]),
        giSimDiscOpt("mgd-r-21535", "55/55/45/45/35/35 — 21535 מדורג עד 1M · גיל 50–67 · חודש חינם", [55,55,45,45,35,35]),
        giSimDiscOpt("mgd-r-21530", "55/45/35/25/25/25 — 21530 מדורג 1–3M · עד גיל 39", [55,45,35,25,25,25]),
        giSimDiscOpt("mgd-r-21536", "55/45/35/25/25/25 — 21536 מדורג 1–3M · עד גיל 39 · חודש חינם", [55,45,35,25,25,25]),
        giSimDiscOpt("mgd-r-21531", "55/50/45/35/35/35 — 21531 מדורג 1–3M · גיל 40–49", [55,50,45,35,35,35]),
        giSimDiscOpt("mgd-r-21537", "55/50/45/35/35/35 — 21537 מדורג 1–3M · גיל 40–49 · חודש חינם", [55,50,45,35,35,35]),
        giSimDiscOpt("mgd-r-21532", "60/60/50/50/40/40 — 21532 מדורג 1–3M · גיל 50–67", [60,60,50,50,40,40]),
        giSimDiscOpt("mgd-r-21538", "60/60/50/50/40/40 — 21538 מדורג 1–3M · גיל 50–67 · חודש חינם", [60,60,50,50,40,40]),
        giSimDiscOpt("mgd-r-21721", "70/65/65/55/45/45 — 21721 זהב · 1–3M · 180₪+ לפני הנחה", [70,65,65,55,45,45]),
        giSimDiscOpt("mgd-r-21722", "70/65/65/55/45/45 — 21722 זהב · 1–3M · 180₪+ לפני הנחה · חודש חינם", [70,65,65,55,45,45]),
        giSimDiscOpt("mgd-r-21723", "65/65/65/55/50/40 — 21723 זהב · 1–3M · 180₪+ לפני הנחה", [65,65,65,55,50,40]),
        giSimDiscOpt("mgd-r-21724", "65/65/65/55/50/40 — 21724 זהב · 1–3M · 180₪+ לפני הנחה · חודש חינם", [65,65,65,55,50,40]),
        giSimDiscOpt("mgd-r-21539", "30/30/30/30/30/30 — 21539 קבוע עד 3M · עד גיל 39", [30,30,30,30,30,30]),
        giSimDiscOpt("mgd-r-21542", "30/30/30/30/30/30 — 21542 קבוע עד 3M · עד גיל 39 · חודש חינם", [30,30,30,30,30,30]),
        giSimDiscOpt("mgd-r-21540", "35/35/35/35/35/35 — 21540 קבוע עד 3M · גיל 40–49", [35,35,35,35,35,35]),
        giSimDiscOpt("mgd-r-21543", "35/35/35/35/35/35 — 21543 קבוע עד 3M · גיל 40–49 · חודש חינם", [35,35,35,35,35,35]),
        giSimDiscOpt("mgd-r-21541", "45/45/45/45/45/45 — 21541 קבוע עד 3M · גיל 50–67", [45,45,45,45,45,45]),
        giSimDiscOpt("mgd-r-21544", "45/45/45/45/45/45 — 21544 קבוע עד 3M · גיל 50–67 · חודש חינם", [45,45,45,45,45,45]),
        giSimDiscOpt("mgd-r-or-point", "40/20/20/20/20/20 — נקודת אור · עד גיל 55 · עד 1M", [40,20,20,20,20,20]),
        giSimDiscOpt("mgd-r-am", "40/20/20/20/20/20 — ריסק am · עד גיל 46 · מינ׳ 750K", [40,20,20,20,20,20]),
        giSimDiscOpt("mgd-r-20344", "40/20/20/20/20/20 — 20344 ריסק am · עד גיל 46 · מינ׳ 750K · חודש חינם", [40,20,20,20,20,20]),
        giSimDiscOpt("mgd-r-21190", "60/60/60/60/60/60 — 21190 חריג · עד 5M · גיל 0–65 · קיזוז 5% נפרע", [60,60,60,60,60,60]),
        giSimDiscOpt("mgd-r-21191", "60/60/60/60/60/60 — 21191 חריג · עד 5M · גיל 0–65 · קיזוז 5% נפרע · חודש חינם", [60,60,60,60,60,60]),
        giSimDiscOpt("mgd-r-21192", "50/50/50/50/50/50 — 21192 חריג · עד 5M · גיל 0–65 · תוקן מהדפסה 60/60/60/50", [50,50,50,50,50,50]),
        giSimDiscOpt("mgd-r-21193", "50/50/50/50/50/50 — 21193 חריג · עד 5M · גיל 0–65 · תוקן מהדפסה 60/60/60/50 · חודש חינם", [50,50,50,50,50,50]),
        giSimDiscOpt("mgd-r-21194", "70/54/54/54/54/54 — 21194 חריג · עד 5M · גיל 0–65", [70,54,54,54,54,54]),
        giSimDiscOpt("mgd-r-21195", "70/54/54/54/54/54 — 21195 חריג · עד 5M · גיל 0–65 · חודש חינם", [70,54,54,54,54,54]),
        giSimDiscOpt("mgd-r-21196", "65/60/55/50/50/50 — 21196 חריג · עד 5M · גיל 0–65", [65,60,55,50,50,50]),
        giSimDiscOpt("mgd-r-21197", "65/60/55/50/50/50 — 21197 חריג · עד 5M · גיל 0–65 · חודש חינם", [65,60,55,50,50,50])
      ],
      "ריסק משכנתא": [
        giSimDiscOpt("mgd-m-co", "20/20/20/20/20/20 — הסכם חברה · 25% משנה 20", [20,20,20,20,20,20]),
        giSimDiscOpt("mgd-m-18536", "30/30/30/30/30/30/30/30 — 18536 · עד גיל 69", [30,30,30,30,30,30,30,30]),
        giSimDiscOpt("mgd-m-18538", "30/30/30/30/30/30 — 18538 · חודשיים חינם", [30,30,30,30,30,30]),
        giSimDiscOpt("mgd-m-18537", "30/30/30/30/30/30 — 18537 · 3 חודשי חינם", [30,30,30,30,30,30]),
        giSimDiscOpt("mgd-m-19154", "50/35/20/20/20/20 — 19154 · 55% משנה 15", [50,35,20,20,20,20]),
        giSimDiscOpt("mgd-m-19155", "50/35/20/20/20/20 — 19155 · 55% משנה 15 · 3 חודשי חינם", [50,35,20,20,20,20]),
        giSimDiscOpt("mgd-m-21174", "60/45/35/25/25/25 — 21174 · מינ׳ 15 שנים · 60% אחרי 20 שנה", [60,45,35,25,25,25]),
        giSimDiscOpt("mgd-m-21175", "60/45/35/25/25/25 — 21175 · מינ׳ 15 שנים · 60% אחרי 20 שנה · חודש חינם", [60,45,35,25,25,25]),
        giSimDiscOpt("mgd-m-21176", "60/45/35/25/25/25 — 21176 · מינ׳ 15 שנים · 60% אחרי 20 שנה · חודשיים חינם", [60,45,35,25,25,25]),
        giSimDiscOpt("mgd-m-21177", "65/50/40/30/30/30 — 21177 · מינ׳ 25 שנים · 65% אחרי 20 שנה", [65,50,40,30,30,30]),
        giSimDiscOpt("mgd-m-21178", "65/50/40/30/30/30 — 21178 · מינ׳ 25 שנים · 65% אחרי 20 שנה · חודש חינם", [65,50,40,30,30,30]),
        giSimDiscOpt("mgd-m-21179", "65/50/40/30/30/30 — 21179 · מינ׳ 25 שנים · 65% אחרי 20 שנה · חודשיים חינם", [65,50,40,30,30,30]),
        giSimDiscOpt("mgd-m-21550", "45/35/30/15/15/15 — 21550 · מינ׳ 50K · גיל 18–67", [45,35,30,15,15,15]),
        giSimDiscOpt("mgd-m-21551", "45/35/30/15/15/15 — 21551 · מינ׳ 50K · גיל 18–67 · חודש חינם", [45,35,30,15,15,15])
      ],
      "מוות מתאונה": [
        giSimDiscOpt("mgd-ad-25", "25% קבוע לכל השנים — הסכם חברה · עד 2M", 25, { years: 99 })
      ]
    },
    "מנורה": {
      "בריאות": [
        giSimDiscOpt("mnr-h-101527", "101527 — 20% שקל ראשון+ייעוץ · 15% השתלות/תרופות/חו״ל · 10% שב״ן+טכנולוגיות TOP", 20, { years: 10, pctByCover: { surgery_first_shekel:20, ambulatory_consults:20, transplant:15, drugs:15, abroad_surgery:15, surgery_shaban:10, surgery_shaban_5000:10, tech_devices:10 } }),
        giSimDiscOpt("mnr-h-101598", "101598 — 22% שקל ראשון+ייעוץ+השתלות+תרופות+חו״ל+טכנולוגיות TOP · 10% שב״ן", 22, { years: 10, pctByCover: { surgery_first_shekel:22, ambulatory_consults:22, transplant:22, drugs:22, abroad_surgery:22, tech_devices:22, surgery_shaban:10, surgery_shaban_5000:10 } }),
        giSimDiscOpt("mnr-h-child-100", "100% ל-10 שנים — ניתוחים שקל ראשון לילד אחד · 101598 · כניסה עד גיל 10 · רובד בסיס+שקל ראשון לכל המשפחה · מינ׳ הורה + 2 ילדים · לציין מי הילד", 100, { years: 10, pctByCover: { surgery_first_shekel:100 } })
      ],
      "מחלות קשות": [
        giSimDiscOpt("mnr-ci-25-top", "25% ל-10 שנים — קרן אור TOP · 101527 · מינ׳ 100K עד גיל 39 / 50K מגיל 40", 25, { years: 10 }),
        giSimDiscOpt("mnr-ci-25-101598", "25% ל-10 שנים — קרן אור TOP · 101598 · מינ׳ 100K עד גיל 39 / 50K מגיל 40", 25, { years: 10 }),
        giSimDiscOpt("mnr-ci-100-101599", "100% ל-10 שנים — קרן אור TOP לילד אחד · 101599 · 100K · שני הורים 200K כל אחד · כניסה עד גיל 10", 100, { years: 10 }),
        giSimDiscOpt("mnr-ci-50-101600", "50% ל-10 שנים — קרן אור TOP לילד אחד · 101600 · 100K · הורה אחד 200K · כניסה עד גיל 10", 50, { years: 10 })
      ],
      "סרטן": [
        giSimDiscOpt("mnr-ca-15-101527", "15% ל-10 שנים — קרן לחיים · 101527 · מינ׳ 100K", 15, { years: 10 }),
        giSimDiscOpt("mnr-ca-10-101527", "10% ל-10 שנים — קרן לחיים · 101527 · מינ׳ 100K עד גיל 50 / 50K מגיל 51", 10, { years: 10 }),
        giSimDiscOpt("mnr-ca-22-101598", "22% ל-10 שנים — קרן לחיים · 101598 · מינ׳ 100K", 22, { years: 10 }),
        giSimDiscOpt("mnr-ca-10-101598", "10% ל-10 שנים — קרן לחיים · 101598 · מינ׳ 100K עד גיל 50 / 50K מגיל 51", 10, { years: 10 })
      ],
      "ריסק": [
        giSimDiscOpt("mnr-r-101316", "60/55/50/40/30/25/20/20/20/20 — 101316 · 60₪+ לאחר הנחה", [60,55,50,40,30,25,20,20,20,20]),
        giSimDiscOpt("mnr-r-101334", "60/55/55/50/40/35/30/30/30/30 — 101334 · 100₪+ לאחר הנחה · תוקן משנה ב׳ 60→55", [60,55,55,50,40,35,30,30,30,30]),
        giSimDiscOpt("mnr-r-101317", "60/60/55/55/45/40/30/30/30/30 — 101317 · 140₪+ לאחר הנחה", [60,60,55,55,45,40,30,30,30,30]),
        giSimDiscOpt("mnr-r-101318", "65/60/55/55/50/40/30/30/30/30 — 101318 · 280₪+ לאחר הנחה", [65,60,55,55,50,40,30,30,30,30]),
        giSimDiscOpt("mnr-r-101340", "20% לכל חיי הפוליסה — 101340", 20, { years: 99 }),
        giSimDiscOpt("mnr-r-100878", "15/15/15/15/15/15 — 100878", [15,15,15,15,15,15]),
        giSimDiscOpt("mnr-r-101136", "30/30/20/20/15/15 — 101136 · מינ׳ 500K", [30,30,20,20,15,15]),
        giSimDiscOpt("mnr-r-100973", "50/45/30/25/20/15 — 100973 זוגי · מינ׳ 500K", [50,45,30,25,20,15]),
        giSimDiscOpt("mnr-r-101212", "45/40/35/30/25/20/15/15 — 101212 · גיל 25+ · מינ׳ 500K", [45,40,35,30,25,20,15,15]),
        giSimDiscOpt("mnr-r-100977", "50/40/30/30/20/15 — 100977 · גיל 25+ · מינ׳ 750K", [50,40,30,30,20,15]),
        giSimDiscOpt("mnr-r-101211", "60/50/40/30/25/15/15/15 — 101211 · גיל 25+ · מינ׳ 1M", [60,50,40,30,25,15,15,15]),
        giSimDiscOpt("mnr-r-101137", "30/30/30/20/20/20/15/15 — 101137 · גיל 25+ · מינ׳ 1M", [30,30,30,20,20,20,15,15]),
        giSimDiscOpt("mnr-r-101139", "60/55/45/35/25/25/25/25 — 101139 מעשנים · גיל 30+ · מינ׳ 1M", [60,55,45,35,25,25,25,25]),
        giSimDiscOpt("mnr-r-101338", "65/65/60/60/50/40/30/30/30/30 — 101338 מעשנים · גיל 25+ · מינ׳ 1M", [65,65,60,60,50,40,30,30,30,30]),
        giSimDiscOpt("mnr-r-101558", "65/65/60/60/60/50/40/30/20/10 — 101558 חריג · נטו 125₪ לאחר הנחה · עד 31.03.2026", [65,65,60,60,60,50,40,30,20,10]),
        giSimDiscOpt("mnr-r-101569", "15/10/5 — 101569 שנה של הנחות · מינ׳ 500K · מקס׳ 2M · כניסה 25–60 · תום 80 · 30% משנה 16", [15,10,5]),
        giSimDiscOpt("mnr-r-101276", "15/10/5 — 101276 שנה של הנחות · מינ׳ 500K · מקס׳ 2M · כניסה 25–60 · תום 80", [15,10,5])
      ],
      "ריסק משכנתא": [
        giSimDiscOpt("mnr-m-101341", "20% לכל חיי הפוליסה — 101341", 20, { years: 99 }),
        giSimDiscOpt("mnr-m-101431", "30/25/20/15/15/15 — 101431", [30,25,20,15,15,15]),
        giSimDiscOpt("mnr-m-101141", "30/30/20/20/15/15 — 101141 · מינ׳ 500K", [30,30,20,20,15,15]),
        giSimDiscOpt("mnr-m-101144", "45/40/30/20/15/15 — 101144 · גיל 25+ · מינ׳ 750K", [45,40,30,20,15,15]),
        giSimDiscOpt("mnr-m-101146", "40/30/25/15/15/15 — 101146 שלמות 462 · גיל 25+ · מינ׳ 500K · 100% משנה 13", [40,30,25,15,15,15]),
        giSimDiscOpt("mnr-m-101149", "50/40/30/25/15/15 — 101149 · גיל 25+ · מינ׳ 500K", [50,40,30,25,15,15]),
        giSimDiscOpt("mnr-m-101145", "55/45/40/30/20/20/20/20 — 101145 · גיל 30+ · מינ׳ 1M", [55,45,40,30,20,20,20,20]),
        giSimDiscOpt("mnr-m-101151", "60/50/40/30/20/20/20/20 — 101151 · גיל 40+ · מינ׳ 1M", [60,50,40,30,20,20,20,20])
      ]
    },
    "איילון": {
      "בריאות": [
        giSimDiscOpt("ayl-h-20-shaban", "20% ל-10 שנים — שב״ן (על הכל)", 20, { years: 10, pctByCover: {
          transplant:20, drugs:20, abroad_surgery:20, surgery_first_shekel:20, surgery_shaban:20, surgery_shaban_5000:20,
          ambulatory_extended:20, ambulatory_consults:20, ambulatory_treatments:20, fast_diagnosis:20, tech_devices:20,
          child_dev:20, complementary:20, online:20, home:20, sports:20, crisis_bar_gefen:20
        } }),
        giSimDiscOpt("ayl-h-33-first", "33% שקל ראשון + 20% על היתר (ללא שב״ן)", 33, { years: 10, pctByCover: {
          surgery_first_shekel:33,
          transplant:20, drugs:20, abroad_surgery:20,
          ambulatory_extended:20, ambulatory_consults:20, ambulatory_treatments:20, fast_diagnosis:20, tech_devices:20,
          child_dev:20, complementary:20, online:20, home:20, sports:20, crisis_bar_gefen:20
        } })
      ],
      "מחלות קשות": [
        giSimDiscOpt("ayl-ci-25", "25% ל-10 שנים — בשביל החוסן · גיל 21+ · מינ׳ 100K", 25, { years: 10 })
      ],
      "סרטן": [
        giSimDiscOpt("ayl-ca-25", "25% ל-10 שנים — בשביל החוסן סרטן · גיל 21+ · מינ׳ 100K", 25, { years: 10 })
      ],
      "ריסק משכנתא": [
        giSimDiscOpt("ayl-m-60095", "55/30/20/15/15/15 — דרור למשכנתא 60095 · כל גיל · מינ׳ 500K", [55,30,20,15,15,15]),
        giSimDiscOpt("ayl-m-13626", "50/35/25/15/15/15 — דרור למשכנתא 13626 · גיל 35+ · מינ׳ 1M", [50,35,25,15,15,15]),
        giSimDiscOpt("ayl-m-60096", "50/50/45/40/30/15 — דרור למשכנתא 60096 · גיל 40+/1.5M או גיל 45+/1M", [50,50,45,40,30,15]),
        giSimDiscOpt("ayl-m-62439", "55/50/45/35/25/20 — דרור למשכנתא 62439 · גיל 45 · 2M יחיד / 1M זוג", [55,50,45,35,25,20]),
        giSimDiscOpt("ayl-m-17211", "40/20/15/15/15/15 — דרור למשכנתא 17211 · הלוואה עד 20 שנה · משנה 13: 100%", [40,20,15,15,15,15]),
        giSimDiscOpt("ayl-m-60098", "40/20/15/15/15/15 — דרור למשכנתא 60098 · הלוואה 21–30 שנה · משנה 18: 100%", [40,20,15,15,15,15])
      ]
    }
  };

  function giSimDiscountList(company, product){
    const c = safeTrim(company);
    const t = safeTrim(product);
    const rows = GI_SIMULATOR_DISCOUNT_CATALOG[c] && GI_SIMULATOR_DISCOUNT_CATALOG[c][t];
    return Array.isArray(rows) ? rows : [];
  }
  function giSimDiscountById(company, product, id){
    const key = safeTrim(id);
    if(!key) return null;
    return giSimDiscountList(company, product).find((o) => o && o.id === key) || null;
  }
  function giSimDiscountYear1Pct(opt){
    if(!opt) return 0;
    if(Array.isArray(opt.schedule) && opt.schedule.length){
      const n = Number(opt.schedule[0]);
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(opt.pct);
    return Number.isFinite(n) ? n : 0;
  }
  function giSimMoneyAfterPct(shekels, pct){
    const ag = Math.round(Number(shekels) * 100);
    if(!Number.isFinite(ag)) return null;
    const p = Number(pct);
    if(!Number.isFinite(p) || p <= 0) return ag / 100;
    return Math.round(ag * (100 - p) / 100) / 100;
  }
  function giSimCoverDiscountPct(opt, coverId){
    const eng = (typeof globalThis !== "undefined" && globalThis.GiSimDiscountEngine) || null;
    if(eng && typeof eng.coverDiscountPct === "function") return eng.coverDiscountPct(opt, coverId);
    if(!opt) return 0;
    const id = String(coverId || "");
    const map = opt.pctByCover && typeof opt.pctByCover === "object" ? opt.pctByCover : null;
    if(map && Object.prototype.hasOwnProperty.call(map, id)){
      const n = Number(map[id]);
      return Number.isFinite(n) ? n : 0;
    }
    const fullPriceIds = Array.isArray(opt.fullPriceIds) ? opt.fullPriceIds : [];
    if(fullPriceIds.indexOf(id) >= 0) return 0;
    if(map) return 0;
    return giSimDiscountYear1Pct(opt);
  }
  function giSimCoverMonthlyAgorot(cover){
    if(Number.isInteger(cover && cover.monthlyAgorot)) return cover.monthlyAgorot;
    const ag = Math.round(Number(cover && cover.monthlyPremium) * 100);
    return Number.isFinite(ag) ? ag : null;
  }
  function giSimDiscountAfterMonthly(result, opt){
    const eng = (typeof globalThis !== "undefined" && globalThis.GiSimDiscountEngine) || null;
    if(eng && typeof eng.afterMonthly === "function") return eng.afterMonthly(result, opt);
    if(!opt || !result || !result.ok) return null;
    const covers = Array.isArray(result.covers) ? result.covers : [];
    const map = opt.pctByCover && typeof opt.pctByCover === "object" ? opt.pctByCover : null;
    const fullPriceIds = Array.isArray(opt.fullPriceIds) ? opt.fullPriceIds : [];
    if(covers.length && (map || fullPriceIds.length)){
      let totalAg = 0;
      for(let i = 0; i < covers.length; i++){
        const c = covers[i];
        const ag = giSimCoverMonthlyAgorot(c);
        if(!Number.isFinite(ag)) continue;
        const pct = giSimCoverDiscountPct(opt, (c && c.id) || "");
        totalAg += Math.round(ag * (100 - pct) / 100);
      }
      return totalAg / 100;
    }
    if(covers.length){
      let totalAg = 0;
      for(let i = 0; i < covers.length; i++){
        const ag = giSimCoverMonthlyAgorot(covers[i]);
        if(Number.isFinite(ag)) totalAg += ag;
      }
      return totalAg / 100;
    }
    const monthly = Number(result.monthlyPremium);
    if(!Number.isFinite(monthly)) return null;
    return giSimMoneyAfterPct(monthly, giSimDiscountYear1Pct(opt));
  }
  function giSimDiscountExplain(result, opt, company, product){
    const eng = (typeof globalThis !== "undefined" && globalThis.GiSimDiscountEngine) || null;
    if(eng && typeof eng.explain === "function") return eng.explain(result, opt, company, product);
    return { after: giSimDiscountAfterMonthly(result, opt), rows: [], company: safeTrim(company), product: safeTrim(product), optionId: safeTrim(opt && opt.id), optionLabel: safeTrim(opt && opt.label) };
  }
  function giSimDiscountSelectedId(sim){
    const map = sim && sim._giSimDiscountSel && typeof sim._giSimDiscountSel === "object" ? sim._giSimDiscountSel : null;
    if(!map) return "";
    return safeTrim(map[sim._activeInsuredId || "_"]);
  }
  function giSimDiscountSetSelected(sim, optionId){
    if(!sim._giSimDiscountSel || typeof sim._giSimDiscountSel !== "object") sim._giSimDiscountSel = {};
    sim._giSimDiscountSel[sim._activeInsuredId || "_"] = safeTrim(optionId);
  }
  function giSimDiscountCloseMenu(modal){
    const menu = modal && modal.querySelector("[data-gisim-disc-menu]");
    const btn = modal && modal.querySelector("[data-gisim-disc-toggle]");
    if(menu) menu.setAttribute("hidden", "");
    if(btn) btn.setAttribute("aria-expanded", "false");
  }
  function giSimDiscountInjectDom(sim){
    const modal = sim && sim._modal;
    if(!modal || sim._showFinalSummary) return;
    const company = safeTrim(sim._ctx?.company);
    const product = safeTrim(sim._ctx?.product);
    const opts = giSimDiscountList(company, product);
    if(!opts.length) return;
    const result = sim._state?.[sim._activeInsuredId]?.result || null;
    const selectedId = giSimDiscountSelectedId(sim);
    const selected = giSimDiscountById(company, product, selectedId);
    const explained = selected ? giSimDiscountExplain(result, selected, company, product) : null;
    const after = explained && explained.after != null ? explained.after : (selected ? giSimDiscountAfterMonthly(result, selected) : null);

    let wrap = modal.querySelector(".giSimDisc");
    if(!wrap){
      wrap = document.createElement("div");
      wrap.className = "giSimDisc";
      const resultEl = modal.querySelector("[class*='__result']");
      if(resultEl && resultEl.parentNode) resultEl.parentNode.insertBefore(wrap, resultEl);
      else {
        const body = modal.querySelector(".giValModal__body");
        if(body) body.appendChild(wrap);
        else return;
      }
    }
    const menuHtml = [`<button type="button" class="giSimDisc__opt${selectedId ? "" : " is-selected"}" data-gisim-disc-pick="">ללא הנחה</button>`]
      .concat(opts.map((o) =>
        `<button type="button" class="giSimDisc__opt${o.id === selectedId ? " is-selected" : ""}" data-gisim-disc-pick="${escapeHtml(o.id)}">${escapeHtml(o.label)}</button>`
      ))
      .join("");
    wrap.innerHTML = `
      <div class="giSimDisc__row">
        <button type="button" class="btn giSimDisc__btn" data-gisim-disc-toggle="1" aria-expanded="false" aria-haspopup="listbox">הנחה</button>
        <span class="giSimDisc__picked">${selected ? escapeHtml(selected.label) : "לא נבחרה הנחה"}</span>
      </div>
      <div class="giSimDisc__menu" hidden data-gisim-disc-menu="1" role="listbox">${menuHtml}</div>`;

    modal.querySelectorAll(".giSimDisc__afterRow").forEach((el) => el.remove());
    modal.querySelectorAll(".giSimDisc__footPrem").forEach((el) => el.remove());
    modal.querySelectorAll(".giSimDisc__split").forEach((el) => el.remove());
    if(after != null && Number.isFinite(after)){
      const ok = modal.querySelector("[class*='__result--ok']");
      if(ok){
        const row = document.createElement("div");
        row.className = "giSimDisc__afterRow";
        row.innerHTML = `<span>פרמיה לאחר הנחה</span><strong>₪${escapeHtml(riskSimFormatMoneyShekels(after))}</strong>`;
        ok.appendChild(row);
        const splitRows = explained && Array.isArray(explained.rows) ? explained.rows.filter((r) => r && r.rule === "cover") : [];
        if(splitRows.length){
          const split = document.createElement("div");
          split.className = "giSimDisc__split";
          split.setAttribute("data-gisim-disc-split", "1");
          split.innerHTML = splitRows.map((r) => {
            const pctTxt = r.status === "APPLIED" && r.pct > 0 ? (String(r.pct) + "%") : "ללא";
            return `<div class="giSimDisc__splitRow"><span>${escapeHtml(r.label)}</span><span>₪${escapeHtml(riskSimFormatMoneyShekels(r.original))} → ${escapeHtml(pctTxt)} → ₪${escapeHtml(riskSimFormatMoneyShekels(r.after))}</span></div>`;
          }).join("");
          ok.appendChild(split);
        }
      }
      const foot = modal.querySelector(".giSimShell__foot");
      if(foot){
        const block = document.createElement("div");
        block.className = "giSimShell__premBlock giSimDisc__footPrem";
        block.innerHTML = `<span class="giSimShell__premLabel">פרמיה לאחר הנחה</span><strong class="giSimShell__premValue">₪${escapeHtml(riskSimFormatMoneyShekels(after))}</strong>`;
        const actions = foot.querySelector(".giSimShell__footActions");
        if(actions) foot.insertBefore(block, actions);
        else foot.appendChild(block);
      }
    }
  }
  function giSimDiscountEnsureDelegation(sim){
    const modal = sim && sim._modal;
    if(!modal || modal._giSimDiscDel) return;
    modal._giSimDiscDel = true;
    on(modal, "click", (ev) => {
      const t = ev.target;
      if(!t || typeof t.closest !== "function") return;
      const toggle = t.closest("[data-gisim-disc-toggle]");
      if(toggle && modal.contains(toggle)){
        ev.preventDefault();
        ev.stopPropagation();
        const menu = modal.querySelector("[data-gisim-disc-menu]");
        if(!menu) return;
        const willOpen = menu.hasAttribute("hidden");
        if(willOpen) menu.removeAttribute("hidden");
        else menu.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
        return;
      }
      const pick = t.closest("[data-gisim-disc-pick]");
      if(pick && modal.contains(pick)){
        ev.preventDefault();
        ev.stopPropagation();
        giSimDiscountSetSelected(sim, pick.getAttribute("data-gisim-disc-pick") || "");
        try { if(typeof sim._render === "function") sim._render(); } catch(_e) {}
        return;
      }
      if(!t.closest(".giSimDisc")) giSimDiscountCloseMenu(modal);
    });
  }
  function giSimDiscountInstallChrome(sim){
    try { giSimDiscountEnsureDelegation(sim); } catch(_e) {}
    try { giSimDiscountInjectDom(sim); } catch(_e2) {}
  }

  function riskSimInstallShellEnhancer(handler){
    if(!handler || handler._giShellEnhanced) return handler;
    if(typeof handler.open === "function"){
      const origOpen = handler.open.bind(handler);
      handler.open = function(ctx){
        const next = riskSimEnsureStandaloneInsureds(Object.assign({}, ctx || {}));
        const restore = next.restoreState;
        const restoreActive = safeTrim(next.restoreActiveId);
        delete next.restoreState;
        delete next.restoreActiveId;
        handler._giOpening = true;
        handler._giSimDiscountSel = {};
        let out;
        try { out = origOpen(next); }
        finally { handler._giOpening = false; }
        if(restore){
          try { riskSimApplyRestoredState(handler, restore, restoreActive); } catch(_e) {}
        }
        return out;
      };
    }
    if(typeof handler.close === "function"){
      const origClose = handler.close.bind(handler);
      handler.close = function(){
        /* כל עוד שאלת השמירה על המסך — מקש Escape ולחיצות רקע של הסימולטור
           שמתחתיה לא רשאים לסגור אותו מאחורי גבה. */
        if(handler._giSavePromptOpen) return undefined;
        /* חזרה לבחירת חברה/מוצר — ניווט בתוך המרכז, לא יציאה. בלי שאלת שמירה. */
        if(handler._giSkipSavePrompt){
          handler._giSkipSavePrompt = false;
          return origClose();
        }
        if(!riskSimShouldPromptSave(handler)) return origClose();
        /* close() מאפס את _ctx ואת _state, ולכן הצילום נלקח לפניו. */
        const snapshot = riskSimBuildSaveSnapshot(handler);
        handler._giSavePromptOpen = true;
        let settled = false;
        const done = (shouldClose) => {
          if(settled) return;
          settled = true;
          handler._giSavePromptOpen = false;
          if(shouldClose) origClose();
        };
        try {
          window.GI_SIM_SAVE_PROMPT(snapshot, done);
        } catch(err) {
          try { console.error("SIM_SAVE_PROMPT_FAILED", err); } catch(_e) {}
          handler._giSavePromptOpen = false;
          return origClose();
        }
        return undefined;
      };
    }
    if(typeof handler._bind === "function"){
      const origBind = handler._bind.bind(handler);
      handler._bind = function(){
        try { riskSimAugmentStandaloneChrome(handler); } catch(_e) {}
        origBind();
        try { riskSimBindStandaloneChrome(handler); } catch(_e2) {}
        try { giSimDiscountInstallChrome(handler); } catch(_e3) {}
        try {
          if(handler._modal) handler._modal.classList.add("giSimQuiet");
        } catch(_e4) {}
      };
    }
    handler._giShellEnhanced = true;
    return handler;
  }

  if(RiskSimulators && typeof RiskSimulators.register === "function" && !RiskSimulators._giShellRegisterWrapped){
    const origRegister = RiskSimulators.register.bind(RiskSimulators);
    RiskSimulators.register = function(company, product, handler){
      return origRegister(company, product, riskSimInstallShellEnhancer(handler));
    };
    RiskSimulators._giShellRegisterWrapped = true;
    try {
      Object.keys(RiskSimulators.registry || {}).forEach((k) => {
        riskSimInstallShellEnhancer(RiskSimulators.registry[k]);
      });
    } catch(_e) {}
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
      const birthDate = safeTrim(d.birthDate || "");
      const occupation = safeTrim(d.occupation || "");
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
        age: "",
        ageSource: birthDate ? "step1" : "",
        ageRaw: null,
        entryDays: null,
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
      riskSimSyncAgeFromBirthDate(st, { minAge: PHOENIX_RISK_MIN_AGE, maxAge: PHOENIX_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
      return st;
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

      const ageOptionsHtml = ""; // legacy removed — birth date field
      void ageOptionsHtml;

      /* במצב עצמאי אין פרטים אישיים — לא מציגים אזהרות "לא נמצא בפרטים". באשף נשאר כפי שהיה. */
      const ageHintHtml = st.birthDate && Number.isInteger(st.ageRaw)
        ? (st.age
            ? `<div class="lcPhxSim__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(st.ageRaw))}</strong> (טווח תעריפון ${PHOENIX_RISK_MIN_AGE}–${PHOENIX_RISK_MAX_AGE})</div>`
            : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">הגיל המחושב מתאריך הלידה (${st.ageRaw}) חורג מטווח התעריפון (${PHOENIX_RISK_MIN_AGE}–${PHOENIX_RISK_MAX_AGE})</div>`)
        : ((isStandalone || st.birthDate)
            ? (st.birthDate ? `<div class="lcPhxSim__hint lcPhxSim__hint--warn">תאריך לידה לא תקין — יש להזין DD/MM/YYYY</div>` : "")
            : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">לא נמצא תאריך לידה תקין בפרטים האישיים — יש להזין</div>`);

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
                <label class="lcPhxSim__label">תאריך לידה</label>
                <input class="lcPhxSim__input lcPhxSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-phx-field="birthDate"
                  value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcPhxSim__field">
                <label class="lcPhxSim__label">תחילת ביטוח</label>
                <input class="lcPhxSim__input lcPhxSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-phx-field="insuranceStartDate"
                  value="${escapeHtml(st.insuranceStartDate || "")}" />
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
      const ageSel = null; void ageSel;
      bindRiskSimDmyField(modal, '[data-phx-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: PHOENIX_RISK_MIN_AGE, maxAge: PHOENIX_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          st.ageSource = "manual";
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-phx-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: PHOENIX_RISK_MIN_AGE, maxAge: PHOENIX_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
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
        birthDate: st.birthDate || "",
        insuranceStartDate: st.insuranceStartDate || "",
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
    age_missing: "יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
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
      const birthDate = safeTrim(d.birthDate || "");
      const occupation = safeTrim(d.occupation || "");
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
        age: "",
        ageSource: birthDate ? "step1" : "",
        ageRaw: null,
        entryDays: null,
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
      riskSimSyncAgeFromBirthDate(st, { minAge: MENORA_RISK_MIN_AGE, maxAge: MENORA_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
      return st;
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

      const ageOptionsHtml = ""; void ageOptionsHtml;

      const ageHintHtml = st.birthDate && Number.isInteger(st.ageRaw)
        ? (st.age
            ? `<div class="lcMnrSim__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(st.ageRaw))}</strong> (טווח תעריפון ${MENORA_RISK_MIN_AGE}–${MENORA_RISK_MAX_AGE})</div>`
            : `<div class="lcMnrSim__hint lcMnrSim__hint--warn">הגיל המחושב מתאריך הלידה (${st.ageRaw}) חורג מטווח התעריפון (${MENORA_RISK_MIN_AGE}–${MENORA_RISK_MAX_AGE})</div>`)
        : ((isStandalone || st.birthDate)
            ? (st.birthDate ? `<div class="lcMnrSim__hint lcMnrSim__hint--warn">תאריך לידה לא תקין — יש להזין DD/MM/YYYY</div>` : "")
            : `<div class="lcMnrSim__hint lcMnrSim__hint--warn">לא נמצא תאריך לידה תקין בפרטים האישיים — יש להזין</div>`);

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
                <label class="lcMnrSim__label">תאריך לידה</label>
                <input class="lcMnrSim__input lcMnrSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mnr-field="birthDate"
                  value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcMnrSim__field">
                <label class="lcMnrSim__label">תחילת ביטוח</label>
                <input class="lcMnrSim__input lcMnrSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mnr-field="insuranceStartDate"
                  value="${escapeHtml(st.insuranceStartDate || "")}" />
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
      bindRiskSimDmyField(modal, '[data-mnr-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: MENORA_RISK_MIN_AGE, maxAge: MENORA_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          st.ageSource = "manual";
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-mnr-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: MENORA_RISK_MIN_AGE, maxAge: MENORA_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
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
        birthDate: st.birthDate || "",
        insuranceStartDate: st.insuranceStartDate || "",
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


  // ===== GI-MNR-MORT-RISK-SIM 2026-08-13 · ריסק משכנתא מנורה =====================
  // מקור אמת: תעריפי משכנתא מנורה.pdf — «תעריפי ביטוחי חיים 2024» / כותרת תחתונה
  // ינואר 2023. מוצר: ריסק משכנתא · תעריף ריסק יורד. זהו מקור האמת היחיד לתמחור
  // ריסק משכנתא מנורה בסימולטור הזה — אין להמציא, לקרב או להשלים ערך שאינו רשום
  // כאן במפורש, כולל אי-המונוטוניות בגילאים הצעירים (למשל גבר לא מעשן 21→22
  // עולה, גבר מעשן 18→20 יורד בחדות). כל עדכון תעריפים עתידי מהחברה חייב לעדכן
  // רק את הטבלה הזו.
  //
  // יחידה: פרמיה **חודשית** לכל 100,000 ₪ סכום ביטוח — אותה יחידה כמו ריסק מנורה
  // הרגיל, לא כמו הפניקס/כלל (שנתית/1,000). אין מדרגות סכום ביטוח. גילאי כניסה
  // 18–84. התעריף בסיסי וללא תוספות מקצועיות, רפואיות, פרומיל והנחות.
  //
  // [age, maleNonSmoker, maleSmoker, femaleNonSmoker, femaleSmoker] — חודשית ל-100,000 ₪
  const MENORA_MORT_RISK_RATE_TABLE = [
    [18, 7.25, 11.11, 4.53, 5.91], [19, 6.94, 10.68, 4.53, 5.73], [20, 6.73, 8.68, 4.53, 5.73],
    [21, 6.45, 8.51, 4.53, 5.73], [22, 6.51, 8.52, 4.53, 5.73], [23, 6.34, 8.36, 4.53, 5.73],
    [24, 6.18, 8.30, 4.53, 5.73], [25, 6.07, 8.25, 4.53, 5.73], [26, 5.85, 8.18, 4.58, 5.73],
    [27, 5.80, 8.10, 4.58, 5.85], [28, 5.92, 8.08, 4.63, 5.85], [29, 6.04, 8.02, 4.73, 6.13],
    [30, 6.13, 7.94, 4.94, 6.34], [31, 6.28, 8.13, 5.18, 6.56], [32, 6.34, 8.29, 5.39, 6.88],
    [33, 6.57, 8.57, 5.64, 7.16], [34, 6.85, 9.00, 5.91, 7.54], [35, 7.09, 9.43, 6.14, 8.08],
    [36, 7.61, 10.08, 6.42, 8.57], [37, 7.98, 10.84, 6.69, 9.07], [38, 8.32, 11.64, 7.19, 9.68],
    [39, 8.56, 12.85, 7.47, 10.34], [40, 9.05, 14.10, 7.98, 11.06], [41, 9.69, 15.50, 8.62, 12.50],
    [42, 10.41, 16.90, 9.20, 13.86], [43, 11.05, 18.87, 9.98, 15.31], [44, 12.12, 20.98, 10.64, 17.16],
    [45, 13.04, 22.85, 11.28, 18.66], [46, 14.35, 25.36, 11.96, 20.93], [47, 15.72, 28.08, 12.81, 23.32],
    [48, 17.29, 32.03, 13.83, 26.22], [49, 19.27, 35.44, 14.85, 29.14], [50, 21.74, 40.94, 16.37, 32.79],
    [51, 23.99, 46.63, 17.63, 36.91], [52, 26.77, 51.91, 19.10, 41.05], [53, 29.65, 59.06, 20.70, 46.08],
    [54, 32.80, 67.06, 22.50, 51.78], [55, 35.56, 74.15, 24.23, 58.10], [56, 39.36, 84.65, 26.78, 63.81],
    [57, 43.58, 94.13, 29.30, 70.98], [58, 48.92, 105.93, 32.04, 78.13], [59, 54.15, 118.40, 35.46, 86.92],
    [60, 59.93, 132.17, 38.44, 96.76], [61, 67.19, 143.23, 42.62, 106.67], [62, 74.28, 155.07, 47.03, 117.54],
    [63, 82.16, 165.39, 51.70, 130.95], [64, 90.65, 199.05, 56.76, 144.50], [65, 103.09, 231.85, 62.49, 161.19],
    [66, 117.39, 272.36, 70.02, 178.52], [67, 133.53, 309.08, 79.63, 199.83], [68, 151.75, 346.11, 89.53, 223.56],
    [69, 163.36, 387.46, 100.96, 255.06], [70, 185.63, 431.86, 114.15, 281.35], [71, 210.85, 483.69, 129.03, 305.91],
    [72, 236.97, 527.96, 148.98, 331.31], [73, 266.61, 573.10, 175.66, 357.04], [74, 300.26, 612.16, 205.08, 382.60],
    [75, 338.71, 649.37, 239.72, 407.32], [76, 425.58, 683.40, 298.54, 430.54], [77, 518.36, 697.98, 328.54, 450.74],
    [78, 580.78, 718.93, 369.85, 466.66], [79, 651.91, 729.52, 417.25, 476.30], [80, 710.08, 821.33, 469.67, 560.58],
    [81, 771.00, 893.67, 528.17, 631.75], [82, 847.17, 984.17, 596.33, 715.00], [83, 953.58, 1110.25, 672.92, 808.50],
    [84, 1080.67, 1261.17, 755.25, 909.67]
  ];
  const MENORA_MORT_RISK_RATE_MAP = new Map(
    MENORA_MORT_RISK_RATE_TABLE.map((row) => [row[0], {
      maleNonSmoker: row[1], maleSmoker: row[2], femaleNonSmoker: row[3], femaleSmoker: row[4]
    }])
  );
  const MENORA_MORT_RISK_MIN_AGE = MENORA_MORT_RISK_RATE_TABLE[0][0];
  const MENORA_MORT_RISK_MAX_AGE = MENORA_MORT_RISK_RATE_TABLE[MENORA_MORT_RISK_RATE_TABLE.length - 1][0];
  const formatMenoraMortExactAmount = formatMenoraExactAmount;

  /** התאמה מדויקת בלבד — ללא קירוב/השלמה בין גילים. */
  function lookupMenoraMortgageRiskRate({ age, gender, smoker }){
    if(age === "" || age == null) return { ok:false, reason:"age_missing" };
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    const row = MENORA_MORT_RISK_RATE_MAP.get(ageNum);
    if(!row) return { ok:false, reason:"age_out_of_range" };
    const genderKey = gender === "זכר" ? "male" : (gender === "נקבה" ? "female" : "");
    if(!genderKey) return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const rate = row[genderKey + (smoker ? "Smoker" : "NonSmoker")];
    if(typeof rate !== "number" || !Number.isFinite(rate)) return { ok:false, reason:"rate_missing" };
    return { ok:true, ratePerHundredThousand: rate };
  }

  /** פרמיה חודשית = (סכום ביטוח / 100,000) × תעריף. שנתית = חודשית × 12.
      חישוב באגורות שלמות של התעריף — אין עיגול עסקי. */
  function computeMenoraMortgageRiskPremium({ age, gender, smoker, sumInsured }){
    const sum = Number(String(sumInsured == null ? "" : sumInsured).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const lookup = lookupMenoraMortgageRiskRate({ age, gender, smoker });
    if(!lookup.ok) return lookup;
    const rateCenti = Math.round(lookup.ratePerHundredThousand * 100);
    const monthlyPremium = (rateCenti * sum) / 10000000;
    const annualPremium = monthlyPremium * 12;
    return {
      ok:true,
      ratePerHundredThousand: lookup.ratePerHundredThousand,
      monthlyPremium,
      annualPremium,
      sumInsured: sum,
      pdfName: "ריסק יורד"
    };
  }

  const MENORA_MORT_RISK_SIM_MISSING_MESSAGES = {
    birth_missing: "יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
    age_missing: "יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
    age_out_of_range: `לא נמצא תעריף מתאים לגיל שהוזן (התעריפון מכיל גילאים ${MENORA_MORT_RISK_MIN_AGE}–${MENORA_MORT_RISK_MAX_AGE} בלבד).`,
    gender_missing: "יש להזין מין לפני חישוב הפרמיה.",
    smoker_missing: "יש לציין האם המבוטח מעשן/ת לפני חישוב הפרמיה.",
    sum_missing: "יש להזין סכום ביטוח תקין (גדול מאפס) לפני חישוב הפרמיה.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו."
  };

  /** קומפוננטת סימולטור ריסק משכנתא מנורה — מודאל עצמאי. עושה שימוש חוזר במחלקות
      ה-CSS lcMnrSim__* הקיימות (אותה חברה, אותו מבנה מודאל), עם מזהה DOM ו-
      data-attributes נפרדים (data-mnrmort-*) כדי שלא יתערבבו עם ריסק הרגיל. */
  const MenoraMortgageRiskSimulator = {
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
      const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : ((d.smoker === true || d.smoker === false) ? d.smoker : null));
      const birthDate = safeTrim(d.birthDate || "");
      const occupation = safeTrim(d.occupation || "");
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const sumInsured = formatRiskSimSumInsuredDigits(safeTrim(d.sumInsured || ""));
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
        age: "",
        ageSource: birthDate ? "step1" : "",
        ageRaw: null,
        entryDays: null,
        gender, genderSource: gender ? "step1" : "",
        smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "",
        occupation,
        occupationSource: occupation ? "step1" : "",
        sumInsured,
        result: null,
        error: null,
        savedAt: null,
        dirtySinceSave: false
      };
      this._syncAge(st);
      return st;
    },

    _syncAge(st){
      return riskSimSyncAgeFromBirthDate(st, { minAge: MENORA_MORT_RISK_MIN_AGE, maxAge: MENORA_MORT_RISK_MAX_AGE, asOfDate: st?.insuranceStartDate || "" });
    },

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
      modal.id = "lcMnrMortSimModal";
      modal.className = "giValModal lcMnrSimModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור ריסק משכנתא מנורה");
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
        const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : "");
        return `<button type="button" class="lcMnrSim__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-mnrmort-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
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

      const ageSync = this._syncAge(st);
      const ageHintHtml = st.birthDate && Number.isInteger(st.ageRaw)
        ? (st.age
            ? `<div class="lcMnrSim__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(st.ageRaw))}</strong> (טווח תעריפון ${MENORA_MORT_RISK_MIN_AGE}–${MENORA_MORT_RISK_MAX_AGE})</div>`
            : `<div class="lcMnrSim__hint lcMnrSim__hint--warn">הגיל המחושב מתאריך הלידה (${st.ageRaw}) חורג מטווח התעריפון (${MENORA_MORT_RISK_MIN_AGE}–${MENORA_MORT_RISK_MAX_AGE})</div>`)
        : ((isStandalone || st.birthDate)
            ? (st.birthDate ? `<div class="lcMnrSim__hint lcMnrSim__hint--warn">${escapeHtml(MENORA_MORT_RISK_SIM_MISSING_MESSAGES[ageSync.reason] || "תאריך לידה לא תקין — יש להזין DD/MM/YYYY")}</div>` : "")
            : `<div class="lcMnrSim__hint lcMnrSim__hint--warn">לא נמצא תאריך לידה תקין בפרטים האישיים — יש להזין</div>`);

      const genderHintHtml = (isStandalone || st.gender)
        ? ""
        : `<div class="lcMnrSim__hint lcMnrSim__hint--warn">לא נמצא מין בפרטים האישיים — יש לבחור</div>`;
      const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false)
        ? ""
        : `<div class="lcMnrSim__hint lcMnrSim__hint--warn">לא נמצא סטטוס עישון בפרטים האישיים — יש לבחור</div>`;

      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "🏠";
      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcMnrSim");

      const resultHtml = st.error
        ? `<div class="lcMnrSim__result lcMnrSim__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcMnrSim__result lcMnrSim__result--ok">
            <div class="lcMnrSim__resultRow"><span>מסלול</span><strong>${escapeHtml(st.result.pdfName)}</strong></div>
            <div class="lcMnrSim__resultRow"><span>תעריף חודשי ל-₪100,000</span><strong>${escapeHtml(formatMenoraMortExactAmount(st.result.ratePerHundredThousand))}</strong></div>
            <div class="lcMnrSim__resultRow"><span>סכום ביטוח</span><strong>₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.sumInsured))}</strong></div>
            <div class="lcMnrSim__resultRow lcMnrSim__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatMenoraMortExactAmount(st.result.monthlyPremium))}</strong></div>
            <div class="lcMnrSim__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatMenoraMortExactAmount(st.result.annualPremium))}</strong></div>
            <div class="lcMnrSim__hint">תעריף בסיסי · משתנה לפי הגיל · לפני תוספות מקצוע / רפואי / פרומיל והנחות</div>
          </div>` : "");

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcMnrSim__foot">
            <button type="button" class="btn btn--primary" data-mnrmort-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcMnrSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-mnrmort-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-mnrmort-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcMnrSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-mnrmort-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-mnrmort-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-mnrmort-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcMnrSim__overlay">
          <div class="lcMnrSim__overlayCard">
            <div class="lcMnrSim__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcMnrSim__overlayBtns">
              <button type="button" class="btn btn--primary" data-mnrmort-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-mnrmort-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-mnrmort-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-mnrmort-close="1"></div>
        <div class="giValModal__card lcMnrSim__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור ריסק משכנתא מנורה</div>
              <div class="giValModal__sub">תעריף ריסק יורד · פרמיה חודשית לכל ₪100,000</div>
            </div>
            <button type="button" class="lcMnrSim__closeX" data-mnrmort-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcMnrSim__body">
            ${statusListHtml}
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcMnrSim__insuredLabel lcMnrSim__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcMnrSim__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcMnrSim__grid">
              <div class="lcMnrSim__field">
                <label class="lcMnrSim__label">תאריך לידה</label>
                <input class="lcMnrSim__input lcMnrSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mnrmort-field="birthDate"
                  value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcMnrSim__field">
                <label class="lcMnrSim__label">תחילת ביטוח</label>
                <input class="lcMnrSim__input lcMnrSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mnrmort-field="insuranceStartDate"
                  value="${escapeHtml(st.insuranceStartDate || "")}" />
              </div>
              <div class="lcMnrSim__field">
                <label class="lcMnrSim__label">מין</label>
                <div class="lcMnrSim__segmented">
                  <button type="button" class="lcMnrSim__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-mnrmort-field="gender" data-mnrmort-value="זכר">זכר</button>
                  <button type="button" class="lcMnrSim__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-mnrmort-field="gender" data-mnrmort-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcMnrSim__field">
                <label class="lcMnrSim__label">עישון</label>
                <div class="lcMnrSim__segmented">
                  <button type="button" class="lcMnrSim__segBtn${st.smoker === false ? " is-active" : ""}" data-mnrmort-field="smoker" data-mnrmort-value="0">לא מעשן/ת</button>
                  <button type="button" class="lcMnrSim__segBtn${st.smoker === true ? " is-active" : ""}" data-mnrmort-field="smoker" data-mnrmort-value="1">מעשן/ת</button>
                </div>
                ${smokerHintHtml}
              </div>
              <div class="lcMnrSim__field lcMnrSim__field--wide">
                <label class="lcMnrSim__label">סכום ביטוח (₪)</label>
                <input class="lcMnrSim__input" type="text" inputmode="numeric" data-mnrmort-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="לדוגמה: 1,000,000" />
              </div>
              <div class="lcMnrSim__field lcMnrSim__field--wide">
                <label class="lcMnrSim__label">עיסוק</label>
                <input class="lcMnrSim__input" type="text" data-mnrmort-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            ${occBlockHtml}
            <button type="button" class="btn btn--secondary lcMnrSim__calcBtn" data-mnrmort-calc="1">חשב פרמיה</button>
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
        <div class="giValModal__backdrop" data-mnrmort-close="1"></div>
        <div class="giValModal__card lcMnrSim__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">🏠</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
              <div class="giValModal__sub">בדקו את הנתונים לפני האישור הסופי</div>
            </div>
            <button type="button" class="lcMnrSim__closeX" data-mnrmort-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcMnrSim__body">
            <div class="lcMnrSim__statusListTitle">מבוטחים</div>
            ${rows}
          </div>
          <div class="giValModal__foot lcMnrSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-mnrmort-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-mnrmort-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "mnrmort");
      $$("[data-mnrmort-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-mnrmort-tab]", modal).forEach((el) => on(el, "click", () => {
        this._switchInsured(el.getAttribute("data-mnrmort-tab"));
      }));
      $$("[data-mnrmort-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-mnrmort-switch");
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
      bindRiskSimDmyField(modal, '[data-mnrmort-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          const sync = this._syncAge(st);
          st.ageSource = "manual";
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-mnrmort-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          const sync = this._syncAge(st);
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
      });
      const sumInput = modal.querySelector('[data-mnrmort-field="sumInsured"]');
      if(sumInput) on(sumInput, "input", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        const formatted = formatRiskSimSumInsuredDigits(sumInput.value);
        sumInput.value = formatted;
        try { sumInput.setSelectionRange(formatted.length, formatted.length); } catch(_e){}
        st.sumInsured = formatted;
        st.result = null; st.error = null; st.dirtySinceSave = true;
      });
      const occInput = modal.querySelector('[data-mnrmort-field="occupation"]');
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
      const calcBtn = modal.querySelector("[data-mnrmort-calc]");
      if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
      const applyBtn = modal.querySelector("[data-mnrmort-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-mnrmort-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-mnrmort-finalconfirm]");
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
      const summaryBackBtn = modal.querySelector("[data-mnrmort-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-mnrmort-summary-confirm]");
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
      const ageSync = this._syncAge(st);
      if(!ageSync.ok){
        st.result = null;
        st.error = MENORA_MORT_RISK_SIM_MISSING_MESSAGES[ageSync.reason] || MENORA_MORT_RISK_SIM_MISSING_MESSAGES.age_missing;
        st.dirtySinceSave = true;
        this._render();
        return;
      }
      const calc = computeMenoraMortgageRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: st.sumInsured });
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        st.error = MENORA_MORT_RISK_SIM_MISSING_MESSAGES[calc.reason] || "לא נמצא תעריף מתאים לנתונים שהוזנו.";
      }
      st.dirtySinceSave = true;
      this._render();
    },

    _buildResultForInsured(insId){
      const st = this._state[insId];
      if(!st) return null;
      if(!this._syncAge(st).ok) return null;
      if(!st.result?.ok){
        const calc = computeMenoraMortgageRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: st.sumInsured });
        if(!calc.ok) return null;
        st.result = calc;
        st.error = null;
      }
      const r = st.result;
      return {
        sumInsured: formatRiskSimSumInsuredDigits(r.sumInsured),
        monthlyPremium: r.monthlyPremium,
        annualPremium: r.annualPremium,
        ratePerHundredThousand: r.ratePerHundredThousand,
        pdfName: r.pdfName,
        birthDate: st.birthDate || "",
        birthDateSource: st.birthDateSource || "",
        insuranceStartDate: st.insuranceStartDate || "",
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

  RiskSimulators.register("מנורה", "ריסק משכנתא", MenoraMortgageRiskSimulator);
  // ===== סוף GI-MNR-MORT-RISK-SIM =================================================


  // ===== GI-HACH-RISK-SIM: סימולטור ריסק הכשרה =============================
  // מקור: תעריפים סיכונים.xlsx · גיליון «ריסק».
  // שתי מדרגות סכום: עד/כולל 500,000 ₪ ומעל 500,000 ₪.
  // התעריף בכל טבלה הוא פרמיה **שנתית** לכל 1,000 ₪ סכום ביטוח (כמו פניקס),
  // לפי גיל כניסה (18–85), מין ומעשן/לא מעשן. חודשית = שנתית / 12.
  // גיל 34 במדרגה הגבוהה תוקן מאינטרפולציה (תא משובש במקור).
  //
  // [age, maleNonSmoker, maleSmoker, femaleNonSmoker, femaleSmoker] — פרמיה שנתית ל-1,000 ₪
  const HACHSHARA_RISK_RATE_TABLE_LE500K = [
    [18, 0.99, 1.41, 0.72, 0.93], [19, 0.99, 1.41, 0.72, 0.93], [20, 0.99, 1.41, 0.72, 0.93],
    [21, 1.06, 1.53, 0.71, 0.91], [22, 1.11, 1.62, 0.7, 0.89], [23, 1.14, 1.67, 0.7, 0.89],
    [24, 1.15, 1.68, 0.71, 0.89], [25, 1.14, 1.65, 0.7, 0.89], [26, 1.11, 1.59, 0.7, 0.88],
    [27, 1.06, 1.49, 0.7, 0.87], [28, 1.01, 1.4, 0.69, 0.85], [29, 0.96, 1.3, 0.69, 0.85],
    [30, 0.92, 1.25, 0.7, 0.88], [31, 0.9, 1.24, 0.72, 0.92], [32, 0.9, 1.26, 0.74, 0.97],
    [33, 0.93, 1.32, 0.76, 1.03], [34, 0.97, 1.41, 0.79, 1.09], [35, 1.01, 1.51, 0.82, 1.16],
    [36, 1.05, 1.6, 0.85, 1.23], [37, 1.09, 1.7, 0.87, 1.27], [38, 1.14, 1.81, 0.89, 1.34],
    [39, 1.21, 1.95, 0.92, 1.41], [40, 1.23, 2.02, 0.94, 1.45], [41, 1.3, 2.17, 0.99, 1.56],
    [42, 1.37, 2.33, 1.06, 1.73], [43, 1.46, 2.53, 1.14, 1.91], [44, 1.54, 2.71, 1.23, 2.11],
    [45, 1.64, 2.93, 1.35, 2.37], [46, 1.75, 3.19, 1.47, 2.65], [47, 1.87, 3.47, 1.6, 2.96],
    [48, 2.01, 3.79, 1.74, 3.28], [49, 2.2, 4.21, 1.88, 3.61], [50, 2.4, 4.63, 1.95, 3.73],
    [51, 2.62, 5.09, 2.02, 3.85], [52, 2.83, 5.54, 2.11, 4.01], [53, 3.07, 6.03, 2.26, 4.28],
    [54, 3.32, 6.55, 2.46, 4.65], [55, 3.75, 7.27, 2.83, 5.22], [56, 4.13, 7.94, 3.15, 5.74],
    [57, 4.57, 8.73, 3.43, 6.18], [58, 5.08, 9.66, 3.71, 6.59], [59, 5.77, 10.92, 4.1, 7.18],
    [60, 6.52, 12.26, 4.6, 7.96], [61, 7.42, 13.86, 5.27, 9.01], [62, 8.44, 15.64, 6.07, 10.25],
    [63, 9.49, 17.44, 6.97, 11.61], [64, 10.56, 19.25, 7.87, 12.91], [65, 11.79, 21.3, 8.77, 14.15],
    [66, 13.26, 23.74, 9.66, 15.33], [67, 14.98, 26.58, 10.64, 16.6], [68, 16.7, 29.35, 11.88, 18.23],
    [69, 18.33, 31.9, 13.28, 20.03], [70, 19.95, 34.1, 15.08, 22.38], [71, 22.16, 37.93, 17, 25.26],
    [72, 25.17, 43.16, 19.25, 28.65], [73, 28.5, 48.94, 21.49, 32.01], [74, 31.69, 54.47, 23.69, 35.3],
    [75, 34.54, 59.4, 25.65, 38.23], [76, 37.14, 63.87, 27.84, 41.5], [77, 39.91, 68.61, 30.17, 44.97],
    [78, 43.03, 73.99, 33.01, 49.2], [79, 46.34, 79.67, 36.93, 55.08], [80, 49.86, 85.72, 41.4, 61.78],
    [81, 53.61, 92.21, 46.6, 69.58], [82, 58.35, 100.39, 52.68, 78.7], [83, 65.03, 111.95, 59.53, 88.97],
    [84, 72.99, 125.7, 66.93, 100.08], [85, 81.24, 139.98, 74.78, 111.85]
  ];

  const HACHSHARA_RISK_RATE_TABLE_GT500K = [
    [18, 0.8, 1.22, 0.53, 0.74], [19, 0.8, 1.22, 0.53, 0.74], [20, 0.8, 1.22, 0.53, 0.74],
    [21, 0.87, 1.34, 0.52, 0.72], [22, 0.92, 1.43, 0.52, 0.71], [23, 0.96, 1.48, 0.52, 0.7],
    [24, 0.96, 1.49, 0.52, 0.7], [25, 0.96, 1.47, 0.52, 0.7], [26, 0.92, 1.4, 0.51, 0.69],
    [27, 0.87, 1.31, 0.51, 0.68], [28, 0.82, 1.21, 0.5, 0.66], [29, 0.77, 1.11, 0.51, 0.66],
    [30, 0.73, 1.06, 0.51, 0.69], [31, 0.71, 1.05, 0.53, 0.73], [32, 0.72, 1.07, 0.55, 0.79],
    [33, 0.74, 1.13, 0.58, 0.84], [34, 0.78, 1.22, 0.61, 0.91], [35, 0.82, 1.32, 0.63, 0.97],
    [36, 0.86, 1.41, 0.66, 1.04], [37, 0.9, 1.51, 0.68, 1.09], [38, 0.95, 1.62, 0.7, 1.15],
    [39, 1.02, 1.76, 0.74, 1.22], [40, 1.04, 1.83, 0.75, 1.26], [41, 1.11, 1.98, 0.8, 1.38],
    [42, 1.18, 2.15, 0.87, 1.54], [43, 1.27, 2.34, 0.95, 1.72], [44, 1.35, 2.52, 1.04, 1.92],
    [45, 1.45, 2.74, 1.16, 2.19], [46, 1.56, 3, 1.28, 2.46], [47, 1.69, 3.28, 1.41, 2.77],
    [48, 1.82, 3.6, 1.55, 3.09], [49, 2.01, 4.03, 1.69, 3.42], [50, 2.21, 4.45, 1.76, 3.54],
    [51, 2.43, 4.9, 1.83, 3.66], [52, 2.65, 5.35, 1.93, 3.82], [53, 2.88, 5.85, 2.07, 4.09],
    [54, 3.13, 6.36, 2.27, 4.47], [55, 3.57, 7.08, 2.64, 5.03], [56, 3.94, 7.76, 2.96, 5.56],
    [57, 4.38, 8.54, 3.24, 5.99], [58, 4.89, 9.47, 3.52, 6.4], [59, 5.59, 10.73, 3.91, 6.99],
    [60, 6.34, 12.07, 4.41, 7.77], [61, 7.24, 13.67, 5.08, 8.82], [62, 8.25, 15.46, 5.88, 10.07],
    [63, 9.3, 17.25, 6.78, 11.42], [64, 10.38, 19.07, 7.68, 12.72], [65, 11.61, 21.11, 8.58, 13.97],
    [66, 13.07, 23.55, 9.47, 15.14], [67, 14.79, 26.4, 10.45, 16.41], [68, 16.51, 29.16, 11.69, 18.04],
    [69, 18.15, 31.71, 13.09, 19.84], [70, 19.76, 33.91, 14.89, 22.19], [71, 21.97, 37.74, 16.81, 25.07],
    [72, 24.98, 42.97, 19.07, 28.46], [73, 28.31, 48.75, 21.31, 31.82], [74, 31.5, 54.28, 23.5, 35.11],
    [75, 34.35, 59.21, 25.47, 38.04], [76, 36.96, 63.68, 27.65, 41.31], [77, 39.72, 68.42, 29.99, 44.78],
    [78, 42.84, 73.8, 32.82, 49.01], [79, 46.15, 79.49, 36.74, 54.89], [80, 49.67, 85.53, 41.22, 61.59],
    [81, 53.43, 92.02, 46.41, 69.39], [82, 58.16, 100.2, 52.5, 78.51], [83, 64.84, 111.76, 59.34, 88.78],
    [84, 72.8, 125.52, 66.74, 99.89], [85, 81.06, 139.8, 74.59, 111.67]
  ];

  function buildHachsharaRiskRateMap(table){
    return new Map(table.map((row) => [row[0], {
      maleNonSmoker: row[1], maleSmoker: row[2], femaleNonSmoker: row[3], femaleSmoker: row[4]
    }]));
  }

  const HACHSHARA_RISK_RATE_MAP_LE500K = buildHachsharaRiskRateMap(HACHSHARA_RISK_RATE_TABLE_LE500K);
  const HACHSHARA_RISK_RATE_MAP_GT500K = buildHachsharaRiskRateMap(HACHSHARA_RISK_RATE_TABLE_GT500K);
  const HACHSHARA_RISK_AGE_OPTIONS = HACHSHARA_RISK_RATE_TABLE_LE500K.map((row) => row[0]);
  const HACHSHARA_RISK_MIN_AGE = HACHSHARA_RISK_AGE_OPTIONS[0];
  const HACHSHARA_RISK_MAX_AGE = HACHSHARA_RISK_AGE_OPTIONS[HACHSHARA_RISK_AGE_OPTIONS.length - 1];
  const HACHSHARA_RISK_BRACKET_THRESHOLD = 500000;

  function lookupHachsharaRiskRate({ age, gender, smoker, sumInsured }){
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    const sum = Number(sumInsured);
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const bracket = sum <= HACHSHARA_RISK_BRACKET_THRESHOLD ? "le500k" : "gt500k";
    const map = bracket === "le500k" ? HACHSHARA_RISK_RATE_MAP_LE500K : HACHSHARA_RISK_RATE_MAP_GT500K;
    const row = map.get(ageNum);
    if(!row) return { ok:false, reason:"age_out_of_range" };
    const genderKey = gender === "זכר" ? "male" : (gender === "נקבה" ? "female" : "");
    if(!genderKey) return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const rate = row[genderKey + (smoker ? "Smoker" : "NonSmoker")];
    if(typeof rate !== "number" || !Number.isFinite(rate)) return { ok:false, reason:"rate_missing" };
    return { ok:true, ratePerMille: rate, bracket };
  }

  function computeHachsharaRiskPremium({ age, gender, smoker, sumInsured }){
    const lookup = lookupHachsharaRiskRate({ age, gender, smoker, sumInsured });
    if(!lookup.ok) return lookup;
    const sum = Number(sumInsured);
    const rateCenti = Math.round(lookup.ratePerMille * 100);
    const annualPremium = (rateCenti * sum) / 100000;
    const monthlyPremium = annualPremium / 12;
    return {
      ok:true,
      ratePerMille: lookup.ratePerMille,
      bracket: lookup.bracket,
      monthlyPremium,
      annualPremium
    };
  }

  const formatHachsharaRiskExactAmount = formatPhoenixExactAmount;

  const HACHSHARA_RISK_BRACKET_LABELS = {
    le500k: "עד חצי מיליון ₪ (כולל)",
    gt500k: "מעל חצי מיליון ₪"
  };

  const HACHSHARA_RISK_SIM_MISSING_MESSAGES = {
    age_missing: "יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
    age_out_of_range: `לא נמצא תעריף מתאים לגיל שהוזן (התעריפון מכיל גילאים ${HACHSHARA_RISK_MIN_AGE}–${HACHSHARA_RISK_MAX_AGE} בלבד).`,
    gender_missing: "יש להזין מין לפני חישוב הפרמיה.",
    smoker_missing: "יש לציין האם המבוטח מעשן/ת לפני חישוב הפרמיה.",
    sum_missing: "יש להזין סכום ביטוח תקין (גדול מאפס) לפני חישוב הפרמיה.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו."
  };

  const HachsharaRiskSimulator = {
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
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
        age: "",
        ageSource: birthDate ? "step1" : "",
        ageRaw: null,
        entryDays: null,
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
      riskSimSyncAgeFromBirthDate(st, { minAge: HACHSHARA_RISK_MIN_AGE, maxAge: HACHSHARA_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
      return st;
    },

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
      modal.id = "lcHachRiskModal";
      modal.className = "giValModal lcHachRiskModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור ריסק הכשרה");
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

      const tabsHtml = isMulti ? `<div class="lcHachRisk__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? ' has-saved' : (s?.result ? ' has-result' : '');
        return `<button type="button" class="lcHachRisk__tab${ins.id === activeId ? ' is-active' : ''}${statusCls}" data-hachr-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? ' 🟢' : ''}</button>`;
      }).join("")}</div>` : "";

      const statusListHtml = isMulti ? `
        <div class="lcHachRisk__statusList">
          <div class="lcHachRisk__statusListTitle">מבוטחים בהצעה</div>
          ${insureds.map((ins) => {
            const s = this._state[ins.id];
            const label = escapeHtml(safeTrim(ins.label) || "מבוטח");
            if(!this._isInsuredRelevant(ins)) return `<div class="lcHachRisk__statusRow"><span>⚪</span><span>${label} – לא נדרש סימולטור עבור מבוטח זה</span></div>`;
            if(s?.savedAt) return `<div class="lcHachRisk__statusRow"><span>🟢</span><span>${label} – נשמר</span></div>`;
            return `<div class="lcHachRisk__statusRow"><span>🟡</span><span>${label} – טרם חושב</span></div>`;
          }).join("")}
        </div>` : "";

      const ageHintHtml = st.birthDate && Number.isInteger(st.ageRaw)
        ? (st.age
            ? `<div class="lcHachRisk__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(st.ageRaw))}</strong> (טווח תעריפון ${HACHSHARA_RISK_MIN_AGE}–${HACHSHARA_RISK_MAX_AGE})</div>`
            : `<div class="lcHachRisk__hint lcHachRisk__hint--warn">הגיל המחושב מתאריך הלידה (${st.ageRaw}) חורג מטווח התעריפון (${HACHSHARA_RISK_MIN_AGE}–${HACHSHARA_RISK_MAX_AGE})</div>`)
        : ((isStandalone || st.birthDate)
            ? (st.birthDate ? `<div class="lcHachRisk__hint lcHachRisk__hint--warn">תאריך לידה לא תקין — יש להזין DD/MM/YYYY</div>` : "")
            : `<div class="lcHachRisk__hint lcHachRisk__hint--warn">לא נמצא תאריך לידה תקין בפרטים האישיים — יש להזין</div>`);

      const genderHintHtml = (isStandalone || st.gender)
        ? ""
        : `<div class="lcHachRisk__hint lcHachRisk__hint--warn">לא נמצא מין בפרטים האישיים — יש לבחור</div>`;
      const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false)
        ? ""
        : `<div class="lcHachRisk__hint lcHachRisk__hint--warn">לא נמצא סטטוס עישון בפרטים האישיים — יש לבחור</div>`;

      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "🛡️";
      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcHachRisk");

      const resultHtml = st.error
        ? `<div class="lcHachRisk__result lcHachRisk__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcHachRisk__result lcHachRisk__result--ok">
            <div class="lcHachRisk__resultRow"><span>מדרגת סכום ביטוח</span><strong>${escapeHtml(HACHSHARA_RISK_BRACKET_LABELS[st.result.bracket] || "")}</strong></div>
            <div class="lcHachRisk__resultRow lcHachRisk__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatHachsharaRiskExactAmount(st.result.monthlyPremium))}</strong></div>
            <div class="lcHachRisk__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatHachsharaRiskExactAmount(st.result.annualPremium))}</strong></div>
          </div>` : "");

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcHachRisk__foot">
            <button type="button" class="btn btn--primary" data-hachr-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcHachRisk__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachr-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-hachr-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcHachRisk__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachr-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-hachr-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-hachr-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcHachRisk__overlay">
          <div class="lcHachRisk__overlayCard">
            <div class="lcHachRisk__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcHachRisk__overlayBtns">
              <button type="button" class="btn btn--primary" data-hachr-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-hachr-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-hachr-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-hachr-close="1"></div>
        <div class="giValModal__card lcHachRisk__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור ריסק הכשרה</div>
            </div>
            <button type="button" class="lcHachRisk__closeX" data-hachr-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcHachRisk__body">
            ${statusListHtml}
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcHachRisk__insuredLabel lcHachRisk__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcHachRisk__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcHachRisk__grid">
              <div class="lcHachRisk__field">
                <label class="lcHachRisk__label">תאריך לידה</label>
                <input class="lcHachRisk__input lcHachRisk__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-hachr-field="birthDate"
                  value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcHachRisk__field">
                <label class="lcHachRisk__label">תחילת ביטוח</label>
                <input class="lcHachRisk__input lcHachRisk__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-hachr-field="insuranceStartDate"
                  value="${escapeHtml(st.insuranceStartDate || "")}" />
              </div>
              <div class="lcHachRisk__field">
                <label class="lcHachRisk__label">מין</label>
                <div class="lcHachRisk__segmented">
                  <button type="button" class="lcHachRisk__segBtn${st.gender === 'זכר' ? ' is-active' : ''}" data-hachr-field="gender" data-hachr-value="זכר">זכר</button>
                  <button type="button" class="lcHachRisk__segBtn${st.gender === 'נקבה' ? ' is-active' : ''}" data-hachr-field="gender" data-hachr-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcHachRisk__field">
                <label class="lcHachRisk__label">עישון</label>
                <div class="lcHachRisk__segmented">
                  <button type="button" class="lcHachRisk__segBtn${st.smoker === false ? ' is-active' : ''}" data-hachr-field="smoker" data-hachr-value="0">לא מעשן/ת</button>
                  <button type="button" class="lcHachRisk__segBtn${st.smoker === true ? ' is-active' : ''}" data-hachr-field="smoker" data-hachr-value="1">מעשן/ת</button>
                </div>
                ${smokerHintHtml}
              </div>
              <div class="lcHachRisk__field lcHachRisk__field--wide">
                <label class="lcHachRisk__label">סכום ביטוח (₪)</label>
                <input class="lcHachRisk__input" type="text" inputmode="numeric" data-hachr-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="לדוגמה: 1,000,000" />
              </div>
              <div class="lcHachRisk__field lcHachRisk__field--wide">
                <label class="lcHachRisk__label">עיסוק</label>
                <input class="lcHachRisk__input" type="text" data-hachr-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            ${occBlockHtml}
            <button type="button" class="btn btn--secondary lcHachRisk__calcBtn" data-hachr-calc="1">חשב פרמיה</button>
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
        return `<div class="lcHachRisk__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-hachr-close="1"></div>
        <div class="giValModal__card lcHachRisk__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">🛡️</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
              <div class="giValModal__sub">בדקו את הנתונים לפני האישור הסופי</div>
            </div>
            <button type="button" class="lcHachRisk__closeX" data-hachr-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcHachRisk__body">
            <div class="lcHachRisk__statusListTitle">מבוטחים</div>
            ${rows}
          </div>
          <div class="giValModal__foot lcHachRisk__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachr-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-hachr-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "hachr");
      $$("[data-hachr-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-hachr-tab]", modal).forEach((el) => on(el, "click", () => {
        this._switchInsured(el.getAttribute("data-hachr-tab"));
      }));
      $$("[data-hachr-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-hachr-switch");
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
      bindRiskSimDmyField(modal, '[data-hachr-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: HACHSHARA_RISK_MIN_AGE, maxAge: HACHSHARA_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          st.ageSource = "manual";
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-hachr-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: HACHSHARA_RISK_MIN_AGE, maxAge: HACHSHARA_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
      });
      const sumInput = modal.querySelector('[data-hachr-field="sumInsured"]');
      if(sumInput) on(sumInput, "input", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        const formatted = formatRiskSimSumInsuredDigits(sumInput.value);
        sumInput.value = formatted;
        try { sumInput.setSelectionRange(formatted.length, formatted.length); } catch(_e){}
        st.sumInsured = formatted;
        st.result = null; st.error = null; st.dirtySinceSave = true;
      });
      const occInput = modal.querySelector('[data-hachr-field="occupation"]');
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
      const calcBtn = modal.querySelector("[data-hachr-calc]");
      if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
      const applyBtn = modal.querySelector("[data-hachr-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-hachr-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-hachr-finalconfirm]");
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
      const summaryBackBtn = modal.querySelector("[data-hachr-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-hachr-summary-confirm]");
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
      const calc = computeHachsharaRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: sumNum });
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        st.error = HACHSHARA_RISK_SIM_MISSING_MESSAGES[calc.reason] || "לא נמצא תעריף מתאים לנתונים שהוזנו.";
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
        bracket: st.result.bracket,
        birthDate: st.birthDate || "",
        insuranceStartDate: st.insuranceStartDate || "",
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

  RiskSimulators.register("הכשרה", "ריסק", HachsharaRiskSimulator);
  // ===== סוף GI-HACH-RISK-SIM =====================================================

  // ===== GI-HACH-MORT-RISK-SIM 2026-08-16 · ריסק משכנתא הכשרה =================
  // מקור: תעריפים סיכונים.xlsx · גיליון «משכנתא».
  // פרמיה **שנתית** לכל 1,000 ₪ סכום ביטוח (העמודה השמאלית בגליון).
  // העמודה הימנית (חודשית לכל 100,000 ₪) היא המרה: שנתי/1,000 × 100 / 12.
  // אין מדרגות סכום. גיל כניסה 18–85, מין ומעשן/לא מעשן. חודשית = שנתית / 12.
  // אין להמציא, לקרב או להשלים ערך שאינו רשום כאן במפורש.
  //
  // [age, maleNonSmoker, maleSmoker, femaleNonSmoker, femaleSmoker] — פרמיה שנתית ל-1,000 ₪
  const HACHSHARA_MORT_RISK_RATE_TABLE = [
    [18, 0.75, 1.11, 0.51, 0.7], [19, 0.75, 1.11, 0.51, 0.7], [20, 0.75, 1.11, 0.51, 0.7],
    [21, 0.81, 1.22, 0.5, 0.68], [22, 0.85, 1.29, 0.5, 0.67], [23, 0.88, 1.34, 0.5, 0.66],
    [24, 0.89, 1.34, 0.5, 0.66], [25, 0.88, 1.32, 0.5, 0.66], [26, 0.85, 1.27, 0.5, 0.65],
    [27, 0.81, 1.19, 0.5, 0.64], [28, 0.77, 1.1, 0.49, 0.63], [29, 0.72, 1.02, 0.49, 0.63],
    [30, 0.69, 0.97, 0.5, 0.65], [31, 0.67, 0.96, 0.51, 0.69], [32, 0.67, 0.98, 0.53, 0.74],
    [33, 0.69, 1.03, 0.55, 0.78], [34, 0.73, 1.11, 0.58, 0.84], [35, 0.77, 1.2, 0.6, 0.9],
    [36, 0.8, 1.28, 0.63, 0.96], [37, 0.84, 1.36, 0.64, 0.99], [38, 0.88, 1.46, 0.66, 1.05],
    [39, 0.94, 1.58, 0.69, 1.11], [40, 0.96, 1.64, 0.7, 1.15], [41, 1.02, 1.77, 0.75, 1.25],
    [42, 1.08, 1.91, 0.81, 1.39], [43, 1.16, 2.08, 0.88, 1.54], [44, 1.22, 2.24, 0.96, 1.72],
    [45, 1.31, 2.43, 1.06, 1.95], [46, 1.41, 2.65, 1.16, 2.19], [47, 1.51, 2.9, 1.28, 2.45],
    [48, 1.63, 3.17, 1.4, 2.73], [49, 1.8, 3.54, 1.52, 3.01], [50, 2.11, 4.05, 1.72, 3.26],
    [51, 2.3, 4.44, 1.78, 3.36], [52, 2.49, 4.83, 1.86, 3.5], [53, 2.69, 5.26, 1.99, 3.74],
    [54, 2.91, 5.7, 2.16, 4.06], [55, 3.2, 6.24, 2.4, 4.47], [56, 3.53, 6.83, 2.68, 4.92],
    [57, 3.91, 7.51, 2.92, 5.3], [58, 4.35, 8.31, 3.16, 5.66], [59, 4.95, 9.4, 3.5, 6.17],
    [60, 5.6, 10.57, 3.93, 6.85], [61, 6.38, 11.95, 4.51, 7.75], [62, 7.26, 13.5, 5.21, 8.83],
    [63, 8.17, 15.05, 5.99, 10], [64, 9.1, 16.62, 6.77, 11.13], [65, 10.16, 18.4, 7.54, 12.21],
    [66, 11.43, 20.5, 8.31, 13.22], [67, 12.92, 22.97, 9.16, 14.32], [68, 14.41, 25.37, 10.24, 15.73],
    [69, 15.83, 27.57, 11.45, 17.3], [70, 17.22, 29.47, 13.01, 19.33], [71, 19.14, 32.79, 14.67, 21.82],
    [72, 21.74, 37.32, 16.62, 24.76], [73, 24.63, 42.32, 18.56, 27.67], [74, 27.39, 47.11, 20.46, 30.51],
    [75, 29.86, 51.38, 22.16, 33.05], [76, 32.11, 55.25, 24.06, 35.88], [77, 34.5, 59.36, 26.08, 38.89],
    [78, 37.21, 64.01, 28.53, 42.55], [79, 40.07, 68.93, 31.93, 47.64], [80, 43.12, 74.17, 35.8, 53.44],
    [81, 46.37, 79.79, 40.3, 60.19], [82, 50.47, 86.87, 45.57, 68.09], [83, 56.26, 96.88, 51.49, 76.98],
    [84, 63.14, 108.79, 57.9, 86.6], [85, 70.29, 121.15, 64.7, 96.8]
  ];

  const HACHSHARA_MORT_RISK_RATE_MAP = new Map(
    HACHSHARA_MORT_RISK_RATE_TABLE.map((row) => [row[0], {
      maleNonSmoker: row[1], maleSmoker: row[2], femaleNonSmoker: row[3], femaleSmoker: row[4]
    }])
  );
  const HACHSHARA_MORT_RISK_MIN_AGE = HACHSHARA_MORT_RISK_RATE_TABLE[0][0];
  const HACHSHARA_MORT_RISK_MAX_AGE = HACHSHARA_MORT_RISK_RATE_TABLE[HACHSHARA_MORT_RISK_RATE_TABLE.length - 1][0];

  function lookupHachsharaMortRiskRate({ age, gender, smoker }){
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    const row = HACHSHARA_MORT_RISK_RATE_MAP.get(ageNum);
    if(!row) return { ok:false, reason:"age_out_of_range" };
    const genderKey = gender === "זכר" ? "male" : (gender === "נקבה" ? "female" : "");
    if(!genderKey) return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const rate = row[genderKey + (smoker ? "Smoker" : "NonSmoker")];
    if(typeof rate !== "number" || !Number.isFinite(rate)) return { ok:false, reason:"rate_missing" };
    return { ok:true, ratePerMille: rate };
  }

  function computeHachsharaMortRiskPremium({ age, gender, smoker, sumInsured }){
    const lookup = lookupHachsharaMortRiskRate({ age, gender, smoker });
    if(!lookup.ok) return lookup;
    const sum = Number(sumInsured);
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const rateCenti = Math.round(lookup.ratePerMille * 100);
    const annualPremium = (rateCenti * sum) / 100000;
    const monthlyPremium = annualPremium / 12;
    return {
      ok:true,
      ratePerMille: lookup.ratePerMille,
      monthlyPremium,
      annualPremium,
      sumInsured: sum
    };
  }

  const formatHachsharaMortRiskExactAmount = formatPhoenixExactAmount;

  const HACHSHARA_MORT_RISK_SIM_MISSING_MESSAGES = {
    age_missing: "יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
    age_out_of_range: `לא נמצא תעריף מתאים לגיל שהוזן (התעריפון מכיל גילאים ${HACHSHARA_MORT_RISK_MIN_AGE}–${HACHSHARA_MORT_RISK_MAX_AGE} בלבד).`,
    gender_missing: "יש להזין מין לפני חישוב הפרמיה.",
    smoker_missing: "יש לציין האם המבוטח מעשן/ת לפני חישוב הפרמיה.",
    sum_missing: "יש להזין סכום ביטוח תקין (גדול מאפס) לפני חישוב הפרמיה.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו."
  };

  const HachsharaMortRiskSimulator = {
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
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
        age: "",
        ageSource: birthDate ? "step1" : "",
        ageRaw: null,
        entryDays: null,
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
      riskSimSyncAgeFromBirthDate(st, { minAge: HACHSHARA_MORT_RISK_MIN_AGE, maxAge: HACHSHARA_MORT_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
      return st;
    },

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
      modal.id = "lcHachMortModal";
      modal.className = "giValModal lcHachMortModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור ריסק משכנתא הכשרה");
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

      const tabsHtml = isMulti ? `<div class="lcHachMort__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? ' has-saved' : (s?.result ? ' has-result' : '');
        return `<button type="button" class="lcHachMort__tab${ins.id === activeId ? ' is-active' : ''}${statusCls}" data-hachm-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? ' 🟢' : ''}</button>`;
      }).join("")}</div>` : "";

      const statusListHtml = isMulti ? `
        <div class="lcHachMort__statusList">
          <div class="lcHachMort__statusListTitle">מבוטחים בהצעה</div>
          ${insureds.map((ins) => {
            const s = this._state[ins.id];
            const label = escapeHtml(safeTrim(ins.label) || "מבוטח");
            if(!this._isInsuredRelevant(ins)) return `<div class="lcHachMort__statusRow"><span>⚪</span><span>${label} – לא נדרש סימולטור עבור מבוטח זה</span></div>`;
            if(s?.savedAt) return `<div class="lcHachMort__statusRow"><span>🟢</span><span>${label} – נשמר</span></div>`;
            return `<div class="lcHachMort__statusRow"><span>🟡</span><span>${label} – טרם חושב</span></div>`;
          }).join("")}
        </div>` : "";

      const ageHintHtml = st.birthDate && Number.isInteger(st.ageRaw)
        ? (st.age
            ? `<div class="lcHachMort__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(st.ageRaw))}</strong> (טווח תעריפון ${HACHSHARA_MORT_RISK_MIN_AGE}–${HACHSHARA_MORT_RISK_MAX_AGE})</div>`
            : `<div class="lcHachMort__hint lcHachMort__hint--warn">הגיל המחושב מתאריך הלידה (${st.ageRaw}) חורג מטווח התעריפון (${HACHSHARA_MORT_RISK_MIN_AGE}–${HACHSHARA_MORT_RISK_MAX_AGE})</div>`)
        : ((isStandalone || st.birthDate)
            ? (st.birthDate ? `<div class="lcHachMort__hint lcHachMort__hint--warn">תאריך לידה לא תקין — יש להזין DD/MM/YYYY</div>` : "")
            : `<div class="lcHachMort__hint lcHachMort__hint--warn">לא נמצא תאריך לידה תקין בפרטים האישיים — יש להזין</div>`);

      const genderHintHtml = (isStandalone || st.gender)
        ? ""
        : `<div class="lcHachMort__hint lcHachMort__hint--warn">לא נמצא מין בפרטים האישיים — יש לבחור</div>`;
      const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false)
        ? ""
        : `<div class="lcHachMort__hint lcHachMort__hint--warn">לא נמצא סטטוס עישון בפרטים האישיים — יש לבחור</div>`;

      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "🛡️";
      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcHachMort");

      const resultHtml = st.error
        ? `<div class="lcHachMort__result lcHachMort__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcHachMort__result lcHachMort__result--ok">
            <div class="lcHachMort__resultRow lcHachMort__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatHachsharaMortRiskExactAmount(st.result.monthlyPremium))}</strong></div>
            <div class="lcHachMort__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatHachsharaMortRiskExactAmount(st.result.annualPremium))}</strong></div>
          </div>` : "");

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcHachMort__foot">
            <button type="button" class="btn btn--primary" data-hachm-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcHachMort__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachm-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-hachm-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcHachMort__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachm-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-hachm-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-hachm-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcHachMort__overlay">
          <div class="lcHachMort__overlayCard">
            <div class="lcHachMort__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcHachMort__overlayBtns">
              <button type="button" class="btn btn--primary" data-hachm-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-hachm-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-hachm-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-hachm-close="1"></div>
        <div class="giValModal__card lcHachMort__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור ריסק משכנתא הכשרה</div>
              <div class="giValModal__sub">תעריף שנתי לכל ₪1,000 סכום ביטוח · גיליון משכנתא</div>
            </div>
            <button type="button" class="lcHachMort__closeX" data-hachm-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcHachMort__body">
            ${statusListHtml}
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcHachMort__insuredLabel lcHachMort__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcHachMort__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcHachMort__grid">
              <div class="lcHachMort__field">
                <label class="lcHachMort__label">תאריך לידה</label>
                <input class="lcHachMort__input lcHachMort__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-hachm-field="birthDate"
                  value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcHachMort__field">
                <label class="lcHachMort__label">תחילת ביטוח</label>
                <input class="lcHachMort__input lcHachMort__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-hachm-field="insuranceStartDate"
                  value="${escapeHtml(st.insuranceStartDate || "")}" />
              </div>
              <div class="lcHachMort__field">
                <label class="lcHachMort__label">מין</label>
                <div class="lcHachMort__segmented">
                  <button type="button" class="lcHachMort__segBtn${st.gender === 'זכר' ? ' is-active' : ''}" data-hachm-field="gender" data-hachm-value="זכר">זכר</button>
                  <button type="button" class="lcHachMort__segBtn${st.gender === 'נקבה' ? ' is-active' : ''}" data-hachm-field="gender" data-hachm-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcHachMort__field">
                <label class="lcHachMort__label">עישון</label>
                <div class="lcHachMort__segmented">
                  <button type="button" class="lcHachMort__segBtn${st.smoker === false ? ' is-active' : ''}" data-hachm-field="smoker" data-hachm-value="0">לא מעשן/ת</button>
                  <button type="button" class="lcHachMort__segBtn${st.smoker === true ? ' is-active' : ''}" data-hachm-field="smoker" data-hachm-value="1">מעשן/ת</button>
                </div>
                ${smokerHintHtml}
              </div>
              <div class="lcHachMort__field lcHachMort__field--wide">
                <label class="lcHachMort__label">סכום ביטוח (₪)</label>
                <input class="lcHachMort__input" type="text" inputmode="numeric" data-hachm-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="לדוגמה: 1,000,000" />
              </div>
              <div class="lcHachMort__field lcHachMort__field--wide">
                <label class="lcHachMort__label">עיסוק</label>
                <input class="lcHachMort__input" type="text" data-hachm-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            ${occBlockHtml}
            <button type="button" class="btn btn--secondary lcHachMort__calcBtn" data-hachm-calc="1">חשב פרמיה</button>
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
        return `<div class="lcHachMort__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-hachm-close="1"></div>
        <div class="giValModal__card lcHachMort__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">🛡️</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
              <div class="giValModal__sub">בדקו את הנתונים לפני האישור הסופי</div>
            </div>
            <button type="button" class="lcHachMort__closeX" data-hachm-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcHachMort__body">
            <div class="lcHachMort__statusListTitle">מבוטחים</div>
            ${rows}
          </div>
          <div class="giValModal__foot lcHachMort__foot">
            <button type="button" class="btn giValModal__closeBtn" data-hachm-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-hachm-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "hachm");
      $$("[data-hachm-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-hachm-tab]", modal).forEach((el) => on(el, "click", () => {
        this._switchInsured(el.getAttribute("data-hachm-tab"));
      }));
      $$("[data-hachm-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-hachm-switch");
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
      bindRiskSimDmyField(modal, '[data-hachm-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: HACHSHARA_MORT_RISK_MIN_AGE, maxAge: HACHSHARA_MORT_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          st.ageSource = "manual";
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-hachm-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: HACHSHARA_MORT_RISK_MIN_AGE, maxAge: HACHSHARA_MORT_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
      });
      const sumInput = modal.querySelector('[data-hachm-field="sumInsured"]');
      if(sumInput) on(sumInput, "input", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        const formatted = formatRiskSimSumInsuredDigits(sumInput.value);
        sumInput.value = formatted;
        try { sumInput.setSelectionRange(formatted.length, formatted.length); } catch(_e){}
        st.sumInsured = formatted;
        st.result = null; st.error = null; st.dirtySinceSave = true;
      });
      const occInput = modal.querySelector('[data-hachm-field="occupation"]');
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
      const calcBtn = modal.querySelector("[data-hachm-calc]");
      if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
      const applyBtn = modal.querySelector("[data-hachm-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-hachm-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-hachm-finalconfirm]");
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
      const summaryBackBtn = modal.querySelector("[data-hachm-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-hachm-summary-confirm]");
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
      const calc = computeHachsharaMortRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: sumNum });
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        st.error = HACHSHARA_MORT_RISK_SIM_MISSING_MESSAGES[calc.reason] || "לא נמצא תעריף מתאים לנתונים שהוזנו.";
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
        birthDate: st.birthDate || "",
        insuranceStartDate: st.insuranceStartDate || "",
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

  RiskSimulators.register("הכשרה", "ריסק משכנתא", HachsharaMortRiskSimulator);
  // ===== סוף GI-HACH-MORT-RISK-SIM ===============================================




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
    age_missing: "יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
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
      const birthDate = safeTrim(d.birthDate || "");
      const occupation = safeTrim(d.occupation || "");
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
        age: "",
        ageSource: birthDate ? "step1" : "",
        ageRaw: null,
        entryDays: null,
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
      riskSimSyncAgeFromBirthDate(st, { minAge: PHOENIX_MORTGAGE_RISK_MIN_AGE, maxAge: PHOENIX_MORTGAGE_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
      return st;
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

      const ageOptionsHtml = ""; void ageOptionsHtml;

      const ageHintHtml = st.birthDate && Number.isInteger(st.ageRaw)
        ? (st.age
            ? `<div class="lcPhxSim__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(st.ageRaw))}</strong> (טווח תעריפון ${PHOENIX_MORTGAGE_RISK_MIN_AGE}–${PHOENIX_MORTGAGE_RISK_MAX_AGE})</div>`
            : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">הגיל המחושב מתאריך הלידה (${st.ageRaw}) חורג מטווח התעריפון (${PHOENIX_MORTGAGE_RISK_MIN_AGE}–${PHOENIX_MORTGAGE_RISK_MAX_AGE})</div>`)
        : ((isStandalone || st.birthDate)
            ? (st.birthDate ? `<div class="lcPhxSim__hint lcPhxSim__hint--warn">תאריך לידה לא תקין — יש להזין DD/MM/YYYY</div>` : "")
            : `<div class="lcPhxSim__hint lcPhxSim__hint--warn">לא נמצא תאריך לידה תקין בפרטים האישיים — יש להזין</div>`);

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
                <label class="lcPhxSim__label">תאריך לידה</label>
                <input class="lcPhxSim__input lcPhxSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-phxmort-field="birthDate"
                  value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcPhxSim__field">
                <label class="lcPhxSim__label">תחילת ביטוח</label>
                <input class="lcPhxSim__input lcPhxSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off"
                  placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-phxmort-field="insuranceStartDate"
                  value="${escapeHtml(st.insuranceStartDate || "")}" />
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
      bindRiskSimDmyField(modal, '[data-phxmort-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: PHOENIX_MORTGAGE_RISK_MIN_AGE, maxAge: PHOENIX_MORTGAGE_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          st.ageSource = "manual";
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-phxmort-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          const sync = riskSimSyncAgeFromBirthDate(st, { minAge: PHOENIX_MORTGAGE_RISK_MIN_AGE, maxAge: PHOENIX_MORTGAGE_RISK_MAX_AGE, asOfDate: st.insuranceStartDate || "" });
          if(!sync.ok){ st.age = ""; }
          st.result = null; st.error = null; st.dirtySinceSave = true;
          this._render();
        }
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
        birthDate: st.birthDate || "",
        insuranceStartDate: st.insuranceStartDate || "",
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
      },
      migdal_health: {
        company: "מגדל",
        product: "בריאות",
        baseIndexPoints: 145.28,
        baseKnownDate: "2026-02-15"
      },
      phoenix_health: {
        company: "הפניקס",
        product: "בריאות",
        // PDF 01/2024 — OCR רמז למדד 133.96; הפרמיה צמודה למדד המחירים לצרכן
        baseIndexPoints: 133.96,
        baseKnownDate: "2024-01-01"
      },
      clal_health: {
        company: "כלל",
        product: "בריאות",
        // תעריפון כלל: מדד בסיס 13,684 נק׳ (08/2023) → 136.84 — זהה לעוגן המשותף
        // חריגים ברמת הכיסוי: אביזרים רפואיים 126.49, חמ״ל בר גפן 123.40
        baseIndexPoints: 136.84,
        baseKnownDate: "2023-09-01"
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
    age_out_of_range: `הגיל הביטוחי (חצי שנה ומעלה מעוגל למעלה) חורג מטווח הכניסה ${MENORA_HEALTH_MIN_AGE}–${MENORA_HEALTH_MAX_AGE}.`,
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
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
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
        minEntryDays: MENORA_HEALTH_MIN_ENTRY_DAYS,
        asOfDate: st.insuranceStartDate || ""
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
        minEntryDays: MENORA_HEALTH_MIN_ENTRY_DAYS,
        asOfDate: st?.insuranceStartDate || ""
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
          : `<div class="lcMnrHealth__hint">גיל ביטוחי (חצי שנה ומעלה מעוגל למעלה): <strong>${escapeHtml(ageDisplay)}</strong></div>`);
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
                <input class="lcMnrHealth__input lcMnrHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mnrh-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcMnrHealth__field">
                <label class="lcMnrHealth__label">תחילת ביטוח</label>
                <input class="lcMnrHealth__input lcMnrHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mnrh-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" />
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
      bindRiskSimDmyField(modal, '[data-mnrh-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.ageSource = "manual";
          st.dirtySinceSave = true;
          this._syncAge(st);
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-mnrh-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
          this._syncAge(st);
          this._render();
        }
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
        insuranceStartDate: st.insuranceStartDate || "",
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

  // ===== GI-PHX-HEALTH-SIM 2026-08-11 · סימולטור בריאות הפניקס ==================
  // מקור אמת: תעריפי בריאות פניקס.pdf · עמוד 1 (תכניות בריאות 01/2024).
  // מחלות קשות (מרפא) / סרטן (מרפא סרטן) — סימולטורים נפרדים (לא כאן).
  // תעריפים באגורות (שלמים) 1:1 מה-PDF בשקלים×100. הפרמיה צמודה למדד.

  const PHOENIX_HEALTH_MIN_AGE = 0;
  const PHOENIX_HEALTH_MAX_AGE = 70;
  const PHOENIX_HEALTH_MIN_ENTRY_DAYS = 0;

  function phoenixHealthShekelsToAgorot(shekels){
    return Math.round(Number(shekels) * 100);
  }
  function phoenixHealthAgorotToShekels(agorot){
    return agorot / 100;
  }
  function formatPhoenixHealthExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    const whole = Math.trunc(ag / 100);
    const frac = Math.abs(ag % 100);
    return whole + "." + String(frac).padStart(2, "0");
  }

  function phoenixHealthLookupBand(bands, age){
    const a = Number(age);
    if(!Number.isInteger(a)) return null;
    for(let i = 0; i < bands.length; i++){
      const b = bands[i];
      if(a >= b.min && a <= b.max) return b;
    }
    return null;
  }

  /**
   * קטלוג כיסויים — wizardKey תואם Wizard.healthCoversByCompany["הפניקס"].
   * ניתוחים בישראל: needsGender (גבר/אישה מה-PDF).
   * רפואה משלימה: ילד 0–20 לפי תעריף ילד; בוגר לפי תעריף מבוטח ראשי
   *   (תעריף מבוטח משני 8.45 ₪ לא ממודל בלי שדה תפקיד — לא מומצא).
   */
  const PHOENIX_HEALTH_COVERS = [
    {
      id: "transplant",
      label: "השתלות וטיפולים מיוחדים מחוץ לישראל",
      wizardKey: "השתלות וטיפולים מיוחדים מחוץ לישראל",
      group: "פוליסת בריאות בסיסית",
      needsGender: false,
      bands: [{ min:0, max:20, agorot:1067 }, { min:21, max:30, agorot:1752 }, { min:31, max:40, agorot:1752 }, { min:41, max:50, agorot:2013 }, { min:51, max:55, agorot:2492 }, { min:56, max:60, agorot:2596 }, { min:61, max:65, agorot:3008 }, { min:66, max:120, agorot:3084 }]
    },
    {
      id: "abroad_surgery",
      label: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל",
      wizardKey: "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל",
      group: "פוליסת בריאות בסיסית",
      needsGender: false,
      bands: [{ min:0, max:20, agorot:518 }, { min:21, max:30, agorot:708 }, { min:31, max:40, agorot:999 }, { min:41, max:50, agorot:1459 }, { min:51, max:55, agorot:2183 }, { min:56, max:60, agorot:3015 }, { min:61, max:65, agorot:3710 }, { min:66, max:120, agorot:3818 }]
    },
    {
      id: "drugs",
      label: "תרופות מחוץ לסל שירותי הבריאות",
      wizardKey: "תרופות מחוץ לסל שירותי הבריאות",
      group: "פוליסת בריאות בסיסית",
      needsGender: false,
      bands: [{ min:0, max:20, agorot:1290 }, { min:21, max:30, agorot:1980 }, { min:31, max:40, agorot:2780 }, { min:41, max:50, agorot:4300 }, { min:51, max:55, agorot:6025 }, { min:56, max:60, agorot:7722 }, { min:61, max:65, agorot:10401 }, { min:66, max:120, agorot:13915 }]
    },
    {
      id: "surgery_first_shekel",
      label: "ניתוחים בישראל מהשקל הראשון",
      wizardKey: "ניתוחים בישראל מהשקל הראשון",
      group: "ניתוחים בישראל",
      needsGender: true,
      bands: [{ min:0, max:20, male:3994, female:3837 }, { min:21, max:30, male:6983, female:8680 }, { min:31, max:40, male:11068, female:14385 }, { min:41, max:50, male:16024, female:19218 }, { min:51, max:55, male:28836, female:26163 }, { min:56, max:60, male:36226, female:31194 }, { min:61, max:65, male:52263, female:43144 }, { min:66, max:120, male:76472, female:62858 }]
    },
    {
      id: "surgery_shaban",
      label: "משלים שב\"ן ללא השתתפות עצמית",
      wizardKey: "משלים שב\"ן ללא השתתפות עצמית",
      group: "ניתוחים בישראל",
      needsGender: true,
      bands: [{ min:0, max:20, male:1928, female:1852 }, { min:21, max:30, male:3749, female:4660 }, { min:31, max:40, male:5571, female:7241 }, { min:41, max:50, male:8759, female:10505 }, { min:51, max:55, male:13921, female:12630 }, { min:56, max:60, male:17489, female:15060 }, { min:61, max:65, male:25230, female:20828 }, { min:66, max:120, male:39652, female:32593 }]
    },
    {
      id: "surgery_shaban_5000",
      label: "משלים שב\"ן עם השתתפות עצמית 5,000 ₪",
      wizardKey: "משלים שב\"ן עם השתתפות עצמית 5,000 ₪",
      group: "ניתוחים בישראל",
      needsGender: true,
      bands: [{ min:0, max:20, male:1504, female:1445 }, { min:21, max:30, male:2924, female:3635 }, { min:31, max:40, male:4346, female:5648 }, { min:41, max:50, male:6832, female:8194 }, { min:51, max:55, male:10858, female:9852 }, { min:56, max:60, male:13641, female:11747 }, { min:61, max:65, male:19679, female:16246 }, { min:66, max:120, male:30928, female:25422 }]
    },
    {
      id: "ambulatory_consults",
      label: "ייעוץ ובדיקות",
      wizardKey: "ייעוץ ובדיקות",
      group: "שירותים אמבולטוריים",
      needsGender: false,
      bands: [{ min:0, max:20, agorot:2114 }, { min:21, max:30, agorot:4915 }, { min:31, max:40, agorot:7247 }, { min:41, max:50, agorot:5853 }, { min:51, max:55, agorot:7142 }, { min:56, max:60, agorot:7885 }, { min:61, max:65, agorot:7885 }, { min:66, max:120, agorot:12284 }]
    },
    {
      id: "fast_diagnosis",
      label: "אבחון רפואי מהיר",
      wizardKey: "אבחון רפואי מהיר",
      group: "שירותים אמבולטוריים",
      needsGender: false,
      bands: [{ min:0, max:20, agorot:350 }, { min:21, max:30, agorot:1655 }, { min:31, max:40, agorot:1655 }, { min:41, max:50, agorot:1655 }, { min:51, max:55, agorot:1655 }, { min:56, max:60, agorot:1655 }, { min:61, max:65, agorot:1655 }, { min:66, max:120, agorot:2054 }]
    },
    {
      id: "ambulatory_package",
      label: "ייעוץ ובדיקות ואבחון רפואי מהיר",
      wizardKey: "ייעוץ ובדיקות ואבחון רפואי מהיר",
      group: "שירותים אמבולטוריים",
      needsGender: false,
      bands: [{ min:0, max:20, agorot:2295 }, { min:21, max:30, agorot:6157 }, { min:31, max:40, agorot:8293 }, { min:41, max:50, agorot:7016 }, { min:51, max:55, agorot:8196 }, { min:56, max:60, agorot:8877 }, { min:61, max:65, agorot:8877 }, { min:66, max:120, agorot:13306 }]
    },
    {
      id: "ambulatory_accompany",
      label: "ליווי רפואי וטיפולים אגב אירוע רפואי",
      wizardKey: "ליווי רפואי וטיפולים אגב אירוע רפואי",
      group: "שירותים אמבולטוריים",
      needsGender: false,
      bands: [{ min:0, max:20, agorot:711 }, { min:21, max:30, agorot:1515 }, { min:31, max:40, agorot:1731 }, { min:41, max:50, agorot:1911 }, { min:51, max:55, agorot:1942 }, { min:56, max:60, agorot:2870 }, { min:61, max:65, agorot:2870 }, { min:66, max:120, agorot:3850 }]
    },
    {
      id: "complementary",
      label: "רפואה משלימה",
      wizardKey: "רפואה משלימה",
      group: "כתבי שירות ותכניות נוספות",
      needsGender: false,
      bands: [
        { min:0, max:20, agorot:704 },
        { min:21, max:120, agorot:1126 }
      ]
    },
    {
      id: "child_dev",
      label: "כתב שירות התפתחות הילד",
      wizardKey: "כתב שירות התפתחות הילד",
      group: "כתבי שירות ותכניות נוספות",
      needsGender: false,
      maxAge: 21,
      bands: [
        { min:0, max:21, agorot:2970 }
      ]
    },
    {
      id: "expert_click",
      label: "רופא מומחה בקליק",
      wizardKey: "רופא מומחה בקליק",
      group: "כתבי שירות ותכניות נוספות",
      needsGender: false,
      bands: [
        { min:0, max:21, agorot:867 },
        { min:22, max:120, agorot:1794 }
      ]
    }
  ];

  const PHOENIX_HEALTH_COVER_BY_ID = PHOENIX_HEALTH_COVERS.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
  const PHOENIX_HEALTH_CPI_KEY = "phoenix_health";

  function computePhoenixHealthCoverPremium(coverId, age, gender){
    const cover = PHOENIX_HEALTH_COVER_BY_ID[coverId];
    if(!cover) return { ok:false, reason:"cover_missing" };
    const a = Number(age);
    if(!Number.isInteger(a)) return { ok:false, reason:"age_missing" };
    if(a < PHOENIX_HEALTH_MIN_AGE || a > PHOENIX_HEALTH_MAX_AGE) return { ok:false, reason:"age_out_of_range" };
    if(cover.maxAge != null && a > cover.maxAge) return { ok:false, reason:"age_cover_limit", coverMaxAge: cover.maxAge };
    const band = phoenixHealthLookupBand(cover.bands, a);
    if(!band) return { ok:false, reason:"rate_missing" };
    let agorot = null;
    if(cover.needsGender){
      if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
      agorot = gender === "זכר" ? band.male : band.female;
    } else {
      agorot = band.agorot;
    }
    if(!Number.isInteger(agorot)) return { ok:false, reason:"rate_missing" };
    const indexed = HealthCpi.indexAgorot(agorot, PHOENIX_HEALTH_CPI_KEY);
    return {
      ok: true,
      coverId: cover.id,
      label: cover.label,
      baseMonthlyAgorot: indexed.baseAgorot,
      baseMonthlyPremium: phoenixHealthAgorotToShekels(indexed.baseAgorot),
      monthlyAgorot: indexed.indexedAgorot,
      monthlyPremium: phoenixHealthAgorotToShekels(indexed.indexedAgorot),
      indexFactor: indexed.factor,
      indexInfo: indexed.indexInfo
    };
  }

  function computePhoenixHealthBundle(selectedIds, age, gender){
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if(!ids.length) return { ok:false, reason:"covers_missing", covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
    const covers = [];
    let totalAg = 0;
    let totalBaseAg = 0;
    let indexInfo = null;
    for(let i = 0; i < ids.length; i++){
      const one = computePhoenixHealthCoverPremium(ids[i], age, gender);
      if(!one.ok) return { ok:false, reason: one.reason, failCoverId: ids[i], coverMaxAge: one.coverMaxAge, covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
      const meta = PHOENIX_HEALTH_COVER_BY_ID[one.coverId];
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
      monthlyPremium: phoenixHealthAgorotToShekels(totalAg),
      annualPremium: phoenixHealthAgorotToShekels(totalAg * 12),
      baseMonthlyAgorot: totalBaseAg,
      baseMonthlyPremium: phoenixHealthAgorotToShekels(totalBaseAg),
      indexFactor: indexInfo?.factor || 1,
      indexInfo
    };
  }

  function formatPhoenixHealthIndexMetaHtml(indexInfo){
    if(!indexInfo) return "";
    if(!indexInfo.ok){
      return `<div class="lcPhxHSim__indexMeta lcPhxHSim__indexMeta--pending">ממתין למדד למ״ס — מוצגת כרגע פרמיית בסיס מהתעריפון</div>`;
    }
    const factorTxt = (Math.round(indexInfo.factor * 10000) / 10000).toFixed(4);
    return `<div class="lcPhxHSim__indexMeta">
      הצמדה למדד: בסיס ${escapeHtml(String(indexInfo.baseIndexPoints))}
      (${escapeHtml(indexInfo.baseKnownDate || "")})
      → נוכחי ≈ ${escapeHtml(String(indexInfo.currentIndexPoints))}
      (${escapeHtml(safeTrim(indexInfo.currentMonthLabel))})
      · מקדם ×${escapeHtml(factorTxt)}
    </div>`;
  }

  const PHOENIX_HEALTH_SIM_MESSAGES = {
    birth_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young: `גיל הכניסה המינימלי הוא ${PHOENIX_HEALTH_MIN_ENTRY_DAYS} ימים.`,
    age_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range: `הגיל הביטוחי (חצי שנה ומעלה מעוגל למעלה) חורג מטווח הכניסה ${PHOENIX_HEALTH_MIN_AGE}–${PHOENIX_HEALTH_MAX_AGE}.`,
    gender_missing: "יש לבחור מין — נדרש לכיסויי ניתוחים בישראל.",
    covers_missing: "יש לסמן לפחות כיסוי אחד.",
    age_cover_limit: "הגיל חורג מהמותר לכיסוי שנבחר.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו.",
    cover_missing: "כיסוי לא מוכר."
  };

  const PhoenixHealthSimulator = {
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
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
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
        minAge: PHOENIX_HEALTH_MIN_AGE,
        maxAge: PHOENIX_HEALTH_MAX_AGE,
        minEntryDays: PHOENIX_HEALTH_MIN_ENTRY_DAYS,
        asOfDate: st.insuranceStartDate || ""
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
      modal.id = "lcPhxHSimModal";
      modal.className = "giValModal lcPhxHSimModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "סימולטור בריאות הפניקס");
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
      return PHOENIX_HEALTH_COVERS.map((c) => c.id).filter((id) => !!st?.selected?.[id]);
    },

    _syncAge(st){
      return riskSimSyncAgeFromBirthDate(st, {
        minAge: PHOENIX_HEALTH_MIN_AGE,
        maxAge: PHOENIX_HEALTH_MAX_AGE,
        minEntryDays: PHOENIX_HEALTH_MIN_ENTRY_DAYS,
        asOfDate: st?.insuranceStartDate || ""
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
        st.error = PHOENIX_HEALTH_SIM_MESSAGES[ageSync.reason] || PHOENIX_HEALTH_SIM_MESSAGES.birth_missing;
        return;
      }
      const calc = computePhoenixHealthBundle(ids, st.age, st.gender);
      if(calc.ok){
        st.result = calc;
        st.error = null;
      } else {
        st.result = null;
        let msg = PHOENIX_HEALTH_SIM_MESSAGES[calc.reason] || "לא ניתן לחשב את הפרמיה.";
        if(calc.reason === "age_cover_limit" && calc.failCoverId){
          const c = PHOENIX_HEALTH_COVER_BY_ID[calc.failCoverId];
          msg = `הכיסוי "${c?.label || ""}" זמין עד גיל ${calc.coverMaxAge} בלבד.`;
        } else if(calc.failCoverId){
          const c = PHOENIX_HEALTH_COVER_BY_ID[calc.failCoverId];
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

      const tabsHtml = isMulti ? `<div class="lcPhxHSim__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : "");
        return `<button type="button" class="lcPhxHSim__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-phxh-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
      }).join("")}</div>` : "";

      const birthIso = riskSimBirthDateToIsoInput(st.birthDate || "");
      const birthMaxIso = riskSimIsoDateDaysAgo(PHOENIX_HEALTH_MIN_ENTRY_DAYS);
      const ageSync = this._syncAge(st);
      const ageDisplay = ageSync.ok ? String(ageSync.age) : "—";
      const ageHintHtml = !st.birthDate
        ? (isStandalone ? `<div class="lcPhxHSim__hint lcPhxHSim__hint--warn">יש לבחור תאריך לידה מלוח השנה</div>` : `<div class="lcPhxHSim__hint lcPhxHSim__hint--warn">לא נמצא תאריך לידה בפרטים האישיים — יש לבחור מלוח השנה</div>`)
        : (!ageSync.ok
          ? `<div class="lcPhxHSim__hint lcPhxHSim__hint--warn">${escapeHtml(PHOENIX_HEALTH_SIM_MESSAGES[ageSync.reason] || "תאריך לידה לא תקין לחישוב")}</div>`
          : `<div class="lcPhxHSim__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(ageDisplay)}</strong></div>`);
      const needsGenderSelected = this._selectedIds(st).some((id) => !!PHOENIX_HEALTH_COVER_BY_ID[id]?.needsGender);
      const genderHintHtml = (!needsGenderSelected || isStandalone || st.gender) ? "" : `<div class="lcPhxHSim__hint lcPhxHSim__hint--warn">לא נמצא מין — נדרש לכיסויי ניתוחים בישראל</div>`;

      const groups = {};
      PHOENIX_HEALTH_COVERS.forEach((c) => {
        if(!groups[c.group]) groups[c.group] = [];
        groups[c.group].push(c);
      });
      const coversHtml = Object.keys(groups).map((g) => `
        <div class="lcPhxHSim__group">
          <div class="lcPhxHSim__groupTitle">${escapeHtml(g)}</div>
          <div class="lcPhxHSim__coverList">
            ${groups[g].map((c) => {
              const checked = !!(st.selected && st.selected[c.id]);
              const one = checked ? computePhoenixHealthCoverPremium(c.id, st.age, st.gender) : null;
              const premTxt = one?.ok ? `₪${formatPhoenixHealthExactAmount(one.monthlyPremium)}` : (checked && one && !one.ok ? "—" : "");
              return `<label class="lcPhxHSim__cover${checked ? " is-checked" : ""}">
                <input type="checkbox" data-phxh-cover="${escapeHtml(c.id)}"${checked ? " checked" : ""} />
                <span class="lcPhxHSim__coverLabel">${escapeHtml(c.label)}${c.needsGender ? ' <em>(לפי מין)</em>' : ""}${c.maxAge != null ? ` <em>(עד גיל ${c.maxAge})</em>` : ""}</span>
                <span class="lcPhxHSim__coverPrem">${premTxt}</span>
              </label>`;
            }).join("")}
          </div>
        </div>`).join("");

      const selectedRows = (st.result?.covers || []).map((c) =>
        `<div class="lcPhxHSim__selRow"><span>${escapeHtml(c.label)}</span><strong>₪${escapeHtml(formatPhoenixHealthExactAmount(c.monthlyPremium))}</strong></div>`
      ).join("");

      const indexMetaHtml = formatPhoenixHealthIndexMetaHtml(st.result?.indexInfo || HealthCpi.getIndexInfo(PHOENIX_HEALTH_CPI_KEY));
      const baseTotalHtml = (st.result?.ok && st.result.baseMonthlyPremium != null && Math.abs(st.result.baseMonthlyPremium - st.result.monthlyPremium) > 0.0001)
        ? `<div class="lcPhxHSim__resultRow"><span>פרמיית בסיס (לפני מדד)</span><strong>₪${escapeHtml(formatPhoenixHealthExactAmount(st.result.baseMonthlyPremium))}</strong></div>`
        : "";
      const resultHtml = st.error
        ? `<div class="lcPhxHSim__result lcPhxHSim__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcPhxHSim__result lcPhxHSim__result--ok">
            <div class="lcPhxHSim__selTitle">כיסויים שנבחרו</div>
            ${selectedRows}
            ${baseTotalHtml}
            <div class="lcPhxHSim__resultRow lcPhxHSim__resultRow--main"><span>סה״כ פרמיה חודשית (צמודה למדד)</span><strong>₪${escapeHtml(formatPhoenixHealthExactAmount(st.result.monthlyPremium))}</strong></div>
            <div class="lcPhxHSim__resultRow"><span>סה״כ פרמיה שנתית</span><strong>₪${escapeHtml(formatPhoenixHealthExactAmount(st.result.annualPremium))}</strong></div>
            ${indexMetaHtml}
          </div>` : `<div class="lcPhxHSim__result lcPhxHSim__result--empty">סמנו כיסויים כדי לראות פרמיה</div>`);

      const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
      const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, "lcPhxHSim");
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
        ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
        : "✚";

      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

      const footHtml = isStandalone ? `
          <div class="giValModal__foot lcPhxHSim__foot">
            <button type="button" class="btn btn--primary" data-phxh-close="1">סגור</button>
          </div>` : (!isMulti ? `
          <div class="giValModal__foot lcPhxHSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-phxh-close="1">ביטול</button>
            <button type="button" class="btn btn--primary" data-phxh-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
          </div>` : `
          <div class="giValModal__foot lcPhxHSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-phxh-close="1">ביטול</button>
            <button type="button" class="btn btn--secondary" data-phxh-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
            <button type="button" class="btn btn--primary" data-phxh-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
          </div>`);

      const confirmOverlayHtml = this._confirmSwitch ? `
        <div class="lcPhxHSim__overlay">
          <div class="lcPhxHSim__overlayCard">
            <div class="lcPhxHSim__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
            <div class="lcPhxHSim__overlayBtns">
              <button type="button" class="btn btn--primary" data-phxh-switch="save">שמור ועבור</button>
              <button type="button" class="btn btn--secondary" data-phxh-switch="discard">עבור ללא שמירה</button>
              <button type="button" class="btn" data-phxh-switch="cancel">ביטול</button>
            </div>
          </div>
        </div>` : "";

      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-phxh-close="1"></div>
        <div class="giValModal__card lcPhxHSim__card">
          <div class="giValModal__head">
            <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
            <div class="giValModal__headText">
              <div class="giValModal__title">סימולטור בריאות הפניקס</div>
            </div>
            <button type="button" class="lcPhxHSim__closeX" data-phxh-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcPhxHSim__body">
            ${tabsHtml}
            ${isStandalone
              ? `<div class="lcPhxHSim__insuredLabel lcPhxHSim__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
              : `<div class="lcPhxHSim__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
            <div class="lcPhxHSim__grid">
              <div class="lcPhxHSim__field">
                <label class="lcPhxHSim__label">תאריך לידה</label>
                <input class="lcPhxHSim__input lcPhxHSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-phxh-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcPhxHSim__field">
                <label class="lcPhxHSim__label">תחילת ביטוח</label>
                <input class="lcPhxHSim__input lcPhxHSim__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-phxh-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" />
              </div>
              <div class="lcPhxHSim__field">
                <label class="lcPhxHSim__label">מין</label>
                <div class="lcPhxHSim__segmented">
                  <button type="button" class="lcPhxHSim__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-phxh-field="gender" data-phxh-value="זכר">זכר</button>
                  <button type="button" class="lcPhxHSim__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-phxh-field="gender" data-phxh-value="נקבה">נקבה</button>
                </div>
                ${genderHintHtml}
              </div>
              <div class="lcPhxHSim__field lcPhxHSim__field--wide">
                <label class="lcPhxHSim__label">עיסוק</label>
                <input class="lcPhxHSim__input" type="text" data-phxh-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
              </div>
            </div>
            <div class="lcPhxHSim__coversTitle">בחירת כיסויים <span class="lcPhxHSim__coversCount">(${PHOENIX_HEALTH_COVERS.length})</span></div>
            <div class="lcPhxHSim__coversWrap">${coversHtml}</div>
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
        return `<div class="lcPhxHSim__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `
        <div class="giValModal__backdrop" data-phxh-close="1"></div>
        <div class="giValModal__card lcPhxHSim__card">
          <div class="giValModal__head">
            <div class="giValModal__headText">
              <div class="giValModal__title">סיכום סימולטור להצעה</div>
            </div>
            <button type="button" class="lcPhxHSim__closeX" data-phxh-close="1" aria-label="סגירה">✕</button>
          </div>
          <div class="giValModal__body lcPhxHSim__body">${rows}</div>
          <div class="giValModal__foot lcPhxHSim__foot">
            <button type="button" class="btn giValModal__closeBtn" data-phxh-summary-back="1">חזרה</button>
            <button type="button" class="btn btn--primary" data-phxh-summary-confirm="1">אישור סופי</button>
          </div>
        </div>`;
      this._bind();
    },

    _bind(){
      const modal = this._modal;
      if(!modal) return;
      ensureSegFieldDelegation(modal, this, "phxh");
      $$("[data-phxh-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-phxh-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-phxh-tab"))));
      $$("[data-phxh-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-phxh-switch");
        const target = this._confirmSwitch?.targetId;
        this._confirmSwitch = null;
        if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); }
        else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); }
        else this._render();
      }));
      bindRiskSimDmyField(modal, '[data-phxh-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.ageSource = "manual";
          st.dirtySinceSave = true;
          this._syncAge(st);
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-phxh-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
          this._syncAge(st);
          this._render();
        }
      });
      const occInput = modal.querySelector('[data-phxh-field="occupation"]');
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
      $$("[data-phxh-cover]", modal).forEach((el) => on(el, "change", () => {
        const st = this._state[this._activeInsuredId];
        if(!st) return;
        if(!st.selected || typeof st.selected !== "object") st.selected = {};
        const id = el.getAttribute("data-phxh-cover");
        st.selected[id] = !!el.checked;
        st.dirtySinceSave = true;
        this._render();
      }));
      const applyBtn = modal.querySelector("[data-phxh-apply]");
      if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-phxh-save]");
      if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-phxh-finalconfirm]");
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
      const summaryBackBtn = modal.querySelector("[data-phxh-summary-back]");
      if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-phxh-summary-confirm]");
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
        insuranceStartDate: st.insuranceStartDate || "",
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

  RiskSimulators.register("הפניקס", "בריאות", PhoenixHealthSimulator);
  // ===== סוף GI-PHX-HEALTH-SIM ====================================================

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
    age_out_of_range: `הגיל הביטוחי (חצי שנה ומעלה מעוגל למעלה) חורג מטווח הכניסה ${AYALON_HEALTH_MIN_AGE}–${AYALON_HEALTH_MAX_AGE}.`,
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
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
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
        minEntryDays: AYALON_HEALTH_MIN_ENTRY_DAYS,
        asOfDate: st.insuranceStartDate || ""
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
        minEntryDays: AYALON_HEALTH_MIN_ENTRY_DAYS,
        asOfDate: st?.insuranceStartDate || ""
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
          : `<div class="lcAylHealth__hint">גיל ביטוחי (חצי שנה ומעלה מעוגל למעלה): <strong>${escapeHtml(ageDisplay)}</strong></div>`);
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
                <input class="lcAylHealth__input lcAylHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-aylh-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcAylHealth__field">
                <label class="lcAylHealth__label">תחילת ביטוח</label>
                <input class="lcAylHealth__input lcAylHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-aylh-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" />
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
      bindRiskSimDmyField(modal, '[data-aylh-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.ageSource = "manual";
          st.dirtySinceSave = true;
          this._syncAge(st);
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-aylh-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
          this._syncAge(st);
          this._render();
        }
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
        insuranceStartDate: st.insuranceStartDate || "",
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
    age_out_of_range: "הגיל הביטוחי (חצי שנה ומעלה מעוגל למעלה) חורג מטווח הכניסה המותר למסלול זה.",
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
        const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
        const st = {
          birthDate,
          birthDateSource: birthDate ? "step1" : "",
          insuranceStartDate,
          insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
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
          minEntryDays: plan.minEntryDays,
          asOfDate: st.insuranceStartDate || ""
        });
        return st;
      },

      _syncAge(st){
        return riskSimSyncAgeFromBirthDate(st, {
          minAge: plan.minAge,
          maxAge: plan.maxEntryAge,
          minEntryDays: plan.minEntryDays,
          asOfDate: st?.insuranceStartDate || ""
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
            st.error = `הגיל הביטוחי חורג מטווח הכניסה ${plan.minAge}–${plan.maxEntryAge} (חצי שנה ומעלה מעוגל למעלה).`;
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
            : `<div class="${P}__hint">גיל ביטוחי (חצי שנה ומעלה מעוגל למעלה): <strong>${escapeHtml(String(ageSync.age))}</strong></div>`);
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
                  <input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mnrci-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />
                  ${ageHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">תחילת ביטוח</label>
                  <input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mnrci-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" />
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
        bindRiskSimDmyField(modal, '[data-mnrci-field="birthDate"]', {
          onInput: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.birthDate = val;
            st.birthDateSource = "manual";
            st.dirtySinceSave = true;
          },
          onCommit: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.birthDate = val;
            st.birthDateSource = "manual";
            st.ageSource = "manual";
            st.result = null; st.error = null; st.dirtySinceSave = true;
            this._syncAge(st);
            this._render();
          }
        });
        bindRiskSimDmyField(modal, '[data-mnrci-field="insuranceStartDate"]', {
          onInput: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.insuranceStartDate = val;
            st.insuranceStartDateSource = "manual";
            st.dirtySinceSave = true;
          },
          onCommit: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.insuranceStartDate = val || riskSimTodayDmy();
            st.insuranceStartDateSource = "manual";
            st.result = null; st.error = null; st.dirtySinceSave = true;
            this._syncAge(st);
            this._render();
          }
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
          insuranceStartDate: st.insuranceStartDate || "",
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


  // ===== GI-PHX-CI-SIM 2026-08-11 · מחלות קשות / סרטן הפניקס ==================
  // מקור: תעריפי בריאות פניקס.pdf · מרפא (01.01.2024) + מרפא סרטן.
  // פרמיה חודשית לכל ₪100,000 פיצוי. תעריפים באגורות 1:1 מה-PDF.
  // גיל כניסה מקסימלי 64; טבלת תעריף ממשיכה מעבר לכך (חישוב כניסה נחסם ב-64).

  const PHOENIX_CI_RATE_UNIT = 100000;
  const PHOENIX_CI_RATE_MAPS = {"marpe":{"0":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"1":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"2":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"3":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"4":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"5":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"6":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"7":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"8":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"9":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"10":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"11":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"12":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"13":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"14":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"15":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"16":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"17":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"18":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"19":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"20":{"mNS":1076,"mS":1076,"fNS":1076,"fS":1076},"21":{"mNS":1129,"mS":1297,"fNS":1113,"fS":1220},"22":{"mNS":1182,"mS":1413,"fNS":1158,"fS":1304},"23":{"mNS":1254,"mS":1533,"fNS":1226,"fS":1401},"24":{"mNS":1344,"mS":1662,"fNS":1325,"fS":1520},"25":{"mNS":1439,"mS":1802,"fNS":1449,"fS":1668},"26":{"mNS":1541,"mS":1959,"fNS":1605,"fS":1854},"27":{"mNS":1654,"mS":2139,"fNS":1795,"fS":2080},"28":{"mNS":1780,"mS":2349,"fNS":2017,"fS":2346},"29":{"mNS":1924,"mS":2603,"fNS":2272,"fS":2653},"30":{"mNS":2095,"mS":2913,"fNS":2557,"fS":2999},"31":{"mNS":2296,"mS":3294,"fNS":2700,"fS":3382},"32":{"mNS":2529,"mS":3743,"fNS":2856,"fS":3700},"33":{"mNS":2808,"mS":4200,"fNS":3100,"fS":4200},"34":{"mNS":3141,"mS":4600,"fNS":3700,"fS":4500},"35":{"mNS":3538,"mS":5200,"fNS":3900,"fS":4800},"36":{"mNS":3833,"mS":5700,"fNS":4100,"fS":5500},"37":{"mNS":4219,"mS":6500,"fNS":4319,"fS":6200},"38":{"mNS":4669,"mS":7400,"fNS":4769,"fS":6900},"39":{"mNS":5300,"mS":8427,"fNS":5150,"fS":7500},"40":{"mNS":5900,"mS":9713,"fNS":5567,"fS":8600},"41":{"mNS":6600,"mS":11400,"fNS":6456,"fS":9300},"42":{"mNS":7400,"mS":12900,"fNS":7124,"fS":10400},"43":{"mNS":8100,"mS":14700,"fNS":7763,"fS":11400},"44":{"mNS":9400,"mS":16200,"fNS":8771,"fS":12400},"45":{"mNS":10500,"mS":17800,"fNS":9562,"fS":12700},"46":{"mNS":11600,"mS":19800,"fNS":10304,"fS":14100},"47":{"mNS":13400,"mS":22200,"fNS":10978,"fS":15200},"48":{"mNS":15000,"mS":24100,"fNS":11550,"fS":17000},"49":{"mNS":16700,"mS":27134,"fNS":12633,"fS":19000},"50":{"mNS":18700,"mS":30300,"fNS":13700,"fS":21000},"51":{"mNS":20500,"mS":33787,"fNS":14700,"fS":23500},"52":{"mNS":22374,"mS":37144,"fNS":14900,"fS":25250},"53":{"mNS":24315,"mS":40963,"fNS":16000,"fS":28056},"54":{"mNS":26535,"mS":43593,"fNS":17651,"fS":30561},"55":{"mNS":28745,"mS":47909,"fNS":19567,"fS":32063},"56":{"mNS":32465,"mS":51340,"fNS":22896,"fS":34067},"57":{"mNS":35428,"mS":56362,"fNS":24913,"fS":37069},"58":{"mNS":38457,"mS":62929,"fNS":26819,"fS":39904},"59":{"mNS":42682,"mS":70809,"fNS":29417,"fS":44035},"60":{"mNS":46481,"mS":79279,"fNS":31159,"fS":47655},"61":{"mNS":49720,"mS":88787,"fNS":32966,"fS":50183},"62":{"mNS":52812,"mS":97896,"fNS":34840,"fS":54386},"63":{"mNS":56761,"mS":105731,"fNS":36782,"fS":57323},"64":{"mNS":60013,"mS":115525,"fNS":38795,"fS":61091},"65":{"mNS":65486,"mS":126515,"fNS":40881,"fS":67864},"66":{"mNS":69108,"mS":137492,"fNS":43044,"fS":71289},"67":{"mNS":73380,"mS":145992,"fNS":45676,"fS":75994},"68":{"mNS":78163,"mS":155507,"fNS":48880,"fS":80946},"69":{"mNS":83695,"mS":165646,"fNS":52777,"fS":86675},"70":{"mNS":90100,"mS":176484,"fNS":57508,"fS":92416},"71":{"mNS":96264,"mS":191039,"fNS":63238,"fS":99482},"72":{"mNS":104763,"mS":206840,"fNS":66556,"fS":108266},"73":{"mNS":109164,"mS":221200,"fNS":69999,"fS":117277},"74":{"mNS":121874,"mS":246183,"fNS":73567,"fS":128218}},"marpeCancer":{"0":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"1":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"2":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"3":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"4":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"5":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"6":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"7":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"8":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"9":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"10":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"11":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"12":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"13":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"14":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"15":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"16":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"17":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"18":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"19":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"20":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"21":{"mNS":683,"mS":683,"fNS":1358,"fS":1358},"22":{"mNS":683,"mS":767,"fNS":1358,"fS":1442},"23":{"mNS":692,"mS":825,"fNS":1358,"fS":1533},"24":{"mNS":742,"mS":900,"fNS":1433,"fS":1633},"25":{"mNS":800,"mS":975,"fNS":1525,"fS":1742},"26":{"mNS":858,"mS":1058,"fNS":1642,"fS":1883},"27":{"mNS":917,"mS":1150,"fNS":1792,"fS":2058},"28":{"mNS":983,"mS":1242,"fNS":1983,"fS":2292},"29":{"mNS":1050,"mS":1350,"fNS":2217,"fS":2575},"30":{"mNS":1133,"mS":1483,"fNS":2517,"fS":2925},"31":{"mNS":1225,"mS":1633,"fNS":2850,"fS":3317},"32":{"mNS":1325,"mS":1825,"fNS":3200,"fS":3750},"33":{"mNS":1442,"mS":2058,"fNS":3592,"fS":4225},"34":{"mNS":1592,"mS":2342,"fNS":4025,"fS":4758},"35":{"mNS":1775,"mS":2700,"fNS":4492,"fS":5350},"36":{"mNS":2000,"mS":3133,"fNS":5008,"fS":5983},"37":{"mNS":2267,"mS":3658,"fNS":5583,"fS":6700},"38":{"mNS":2583,"mS":4275,"fNS":6200,"fS":7467},"39":{"mNS":2933,"mS":4975,"fNS":6833,"fS":8267},"40":{"mNS":3333,"mS":5783,"fNS":7517,"fS":9125},"41":{"mNS":3783,"mS":6683,"fNS":8242,"fS":10050},"42":{"mNS":4283,"mS":7700,"fNS":9008,"fS":11042},"43":{"mNS":4842,"mS":8825,"fNS":9833,"fS":12117},"44":{"mNS":5467,"mS":10083,"fNS":10725,"fS":13292},"45":{"mNS":6150,"mS":11475,"fNS":11683,"fS":14583},"46":{"mNS":6908,"mS":13017,"fNS":12708,"fS":16000},"47":{"mNS":7733,"mS":14708,"fNS":13800,"fS":17550},"48":{"mNS":8633,"mS":16567,"fNS":14958,"fS":19242},"49":{"mNS":9617,"mS":18600,"fNS":16200,"fS":21100},"50":{"mNS":10675,"mS":20817,"fNS":17517,"fS":23133},"51":{"mNS":11825,"mS":23208,"fNS":18917,"fS":25350},"52":{"mNS":13050,"mS":25792,"fNS":20400,"fS":27758},"53":{"mNS":14367,"mS":28567,"fNS":21975,"fS":30383},"54":{"mNS":15783,"mS":31550,"fNS":23667,"fS":33250},"55":{"mNS":17308,"mS":34733,"fNS":25475,"fS":36358},"56":{"mNS":18908,"mS":38117,"fNS":27358,"fS":39658},"57":{"mNS":20592,"mS":41683,"fNS":29283,"fS":43142},"58":{"mNS":22333,"mS":45417,"fNS":31242,"fS":46775},"59":{"mNS":24150,"mS":49342,"fNS":33225,"fS":50567},"60":{"mNS":26058,"mS":53467,"fNS":35275,"fS":54558},"61":{"mNS":28067,"mS":57792,"fNS":37408,"fS":58767},"62":{"mNS":30167,"mS":62325,"fNS":39617,"fS":63175},"63":{"mNS":32367,"mS":67067,"fNS":41908,"fS":67800},"64":{"mNS":34675,"mS":72017,"fNS":44283,"fS":72625},"65":{"mNS":37083,"mS":77175,"fNS":46750,"fS":77658},"66":{"mNS":39600,"mS":82533,"fNS":49308,"fS":82875},"67":{"mNS":42233,"mS":88092,"fNS":51950,"fS":88267},"68":{"mNS":44975,"mS":93842,"fNS":54692,"fS":93825},"69":{"mNS":47825,"mS":99775,"fNS":57542,"fS":99558},"70":{"mNS":50792,"mS":105883,"fNS":60500,"fS":105483},"71":{"mNS":55867,"mS":116467,"fNS":66550,"fS":116025},"72":{"mNS":61450,"mS":128117,"fNS":73200,"fS":127633},"73":{"mNS":67600,"mS":140925,"fNS":80517,"fS":140392},"74":{"mNS":74358,"mS":155017,"fNS":88575,"fS":154433},"75":{"mNS":81792,"mS":170517,"fNS":97433,"fS":169875}}};

  const PHOENIX_CI_PLANS = {
    marpe: {
      id: "marpe",
      pdfName: "מרפא",
      wizardCoverKey: "מרפא",
      productKey: "מחלות קשות",
      title: "סימולטור מחלות קשות הפניקס",
      subtitle: "מרפא — פרמיה חודשית לכל ₪100,000 פיצוי",
      minAge: 0,
      maxEntryAge: 64,
      minEntryDays: 0,
      minSum: 50000,
      maxSum: 600000,
      supportsProgramMode: false,
      cssPrefix: "lcPhxCi",
      modalClass: "lcPhxCiModal"
    },
    marpeCancer: {
      id: "marpeCancer",
      pdfName: "מרפא סרטן",
      wizardCoverKey: "מרפא סרטן",
      productKey: "סרטן",
      title: "סימולטור סרטן הפניקס",
      subtitle: "מרפא סרטן — פרמיה חודשית לכל ₪100,000 פיצוי",
      minAge: 0,
      maxEntryAge: 64,
      minEntryDays: 0,
      minSum: 50000,
      maxSum: 600000,
      supportsProgramMode: false,
      cssPrefix: "lcPhxCi",
      modalClass: "lcPhxCiModal"
    }
  };

  function phoenixCiResolveSumLimits(planId, _age, _programMode){
    const plan = PHOENIX_CI_PLANS[planId];
    if(!plan) return { minSum: null, maxSum: null };
    return { minSum: plan.minSum, maxSum: plan.maxSum };
  }

  function phoenixCiAgorotToShekels(agorot){
    return agorot / 100;
  }
  function formatPhoenixCiExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    const whole = Math.trunc(ag / 100);
    const frac = Math.abs(ag % 100);
    return whole + "." + String(frac).padStart(2, "0");
  }

  function lookupPhoenixCiRate(planId, { age, gender, smoker }){
    const plan = PHOENIX_CI_PLANS[planId];
    if(!plan) return { ok:false, reason:"plan_missing" };
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    if(ageNum < plan.minAge || ageNum > plan.maxEntryAge) return { ok:false, reason:"age_out_of_range" };
    const map = PHOENIX_CI_RATE_MAPS[planId];
    const row = map ? map[String(ageNum)] : null;
    if(!row) return { ok:false, reason:"age_out_of_range" };
    if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const key = gender === "זכר" ? (smoker ? "mS" : "mNS") : (smoker ? "fS" : "fNS");
    const rateAgorot = row[key];
    if(rateAgorot == null || !Number.isInteger(rateAgorot)) return { ok:false, reason:"rate_missing" };
    return {
      ok: true,
      rateAgorot,
      ratePerHundredThousand: phoenixCiAgorotToShekels(rateAgorot),
      planId,
      pdfName: plan.pdfName
    };
  }

  function computePhoenixCiPremium(planId, { age, gender, smoker, compensation, programMode }){
    const plan = PHOENIX_CI_PLANS[planId];
    if(!plan) return { ok:false, reason:"plan_missing" };
    const sum = Number(String(compensation == null ? "" : compensation).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const limits = phoenixCiResolveSumLimits(planId, age, programMode || "base");
    if(limits.minSum == null || limits.maxSum == null) return { ok:false, reason:"plan_missing" };
    if(sum < limits.minSum || sum > limits.maxSum){
      return { ok:false, reason:"sum_out_of_range", minSum: limits.minSum, maxSum: limits.maxSum };
    }
    const looked = lookupPhoenixCiRate(planId, { age, gender, smoker });
    if(!looked.ok) return looked;
    const monthlyAgorotExact = (looked.rateAgorot * sum) / PHOENIX_CI_RATE_UNIT;
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

  const PHOENIX_CI_MESSAGES = {
    birth_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young: "גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range: "הגיל הביטוחי (חצי שנה ומעלה מעוגל למעלה) חורג מטווח הכניסה המותר למסלול זה.",
    gender_missing: "יש לבחור מין לפני חישוב הפרמיה.",
    smoker_missing: "יש לציין האם המבוטח מעשן/ת לפני חישוב הפרמיה.",
    sum_missing: "יש להזין סכום פיצוי תקין (גדול מאפס) לפני חישוב הפרמיה.",
    sum_out_of_range: "סכום הפיצוי חורג מהמינימום/מקסימום המותר למסלול זה.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו.",
    plan_missing: "מסלול לא מזוהה בתעריפון."
  };

  function createPhoenixCiSimulator(planId){
    const plan = PHOENIX_CI_PLANS[planId];
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
        const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
        const st = {
          birthDate,
          birthDateSource: birthDate ? "step1" : "",
          insuranceStartDate,
          insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
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
          minEntryDays: plan.minEntryDays,
          asOfDate: st.insuranceStartDate || ""
        });
        return st;
      },

      _syncAge(st){
        return riskSimSyncAgeFromBirthDate(st, {
          minAge: plan.minAge,
          maxAge: plan.maxEntryAge,
          minEntryDays: plan.minEntryDays,
          asOfDate: st?.insuranceStartDate || ""
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
          st.error = PHOENIX_CI_MESSAGES[ageSync.reason] || PHOENIX_CI_MESSAGES.birth_missing;
          if(ageSync.reason === "age_out_of_range"){
            st.error = `הגיל הביטוחי חורג מטווח הכניסה ${plan.minAge}–${plan.maxEntryAge} (חצי שנה ומעלה מעוגל למעלה).`;
          }
          this._render();
          return;
        }
        const calc = computePhoenixCiPremium(planId, {
          age: st.age, gender: st.gender, smoker: st.smoker,
          compensation: st.compensation, programMode: st.programMode || "base"
        });
        if(calc.ok){
          st.result = calc;
          st.error = null;
        } else {
          st.result = null;
          let msg = PHOENIX_CI_MESSAGES[calc.reason] || "לא ניתן לחשב את הפרמיה.";
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
          return `<button type="button" class="${P}__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-phxci-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
        }).join("")}</div>` : "";

        const birthIso = riskSimBirthDateToIsoInput(st.birthDate || "");
        const birthMaxIso = riskSimIsoDateDaysAgo(plan.minEntryDays);
        const ageSync = this._syncAge(st);
        const sumLimits = phoenixCiResolveSumLimits(planId, st.age, st.programMode || "base");
        const ageHintHtml = !st.birthDate
          ? (isStandalone
            ? `<div class="${P}__hint ${P}__hint--warn">יש לבחור תאריך לידה מלוח השנה</div>`
            : `<div class="${P}__hint ${P}__hint--warn">לא נמצא תאריך לידה בפרטים האישיים — יש לבחור מלוח השנה</div>`)
          : (!ageSync.ok
            ? `<div class="${P}__hint ${P}__hint--warn">${escapeHtml(
                ageSync.reason === "age_out_of_range"
                  ? `הגיל הביטוחי חורג מטווח הכניסה ${plan.minAge}–${plan.maxEntryAge}`
                  : (PHOENIX_CI_MESSAGES[ageSync.reason] || "תאריך לידה לא תקין לחישוב")
              )}</div>`
            : `<div class="${P}__hint">גיל ביטוחי (חצי שנה ומעלה מעוגל למעלה): <strong>${escapeHtml(String(ageSync.age))}</strong></div>`);
        const genderHintHtml = (isStandalone || st.gender) ? "" : `<div class="${P}__hint ${P}__hint--warn">לא נמצא מין בפרטים האישיים — יש לבחור</div>`;
        const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false) ? "" : `<div class="${P}__hint ${P}__hint--warn">לא נמצא סטטוס עישון בפרטים האישיים — יש לבחור</div>`;
        const programModeHtml = plan.supportsProgramMode ? `
                <div class="${P}__field ${P}__field--wide">
                  <label class="${P}__label">סוג תכנית (לפי התעריפון)</label>
                  <div class="${P}__segmented">
                    <button type="button" class="${P}__segBtn${(st.programMode || "base") === "base" ? " is-active" : ""}" data-phxci-field="programMode" data-phxci-value="base">כבסיס (מינ׳ ₪${formatRiskSimSumInsuredDigits(plan.minSumBase)})</button>
                    <button type="button" class="${P}__segBtn${st.programMode === "addon" ? " is-active" : ""}" data-phxci-field="programMode" data-phxci-value="addon">כתכנית נוספת (מינ׳ ₪${formatRiskSimSumInsuredDigits(plan.minSumAddon)})</button>
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
              <div class="${P}__resultRow"><span>תעריף ל-₪100,000</span><strong>₪${escapeHtml(formatPhoenixCiExactAmount(st.result.ratePerHundredThousand))}</strong></div>
              <div class="${P}__resultRow"><span>סכום פיצוי</span><strong>₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.compensation))}</strong></div>
              <div class="${P}__resultRow ${P}__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatPhoenixCiExactAmount(st.result.monthlyPremium))}</strong></div>
              <div class="${P}__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatPhoenixCiExactAmount(st.result.annualPremium))}</strong></div>
            </div>` : `<div class="${P}__result ${P}__result--empty">מלאו את השדות ולחצו "חשב פרמיה"</div>`);

        const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
        const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

        const footHtml = isStandalone ? `
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn btn--primary" data-phxci-close="1">סגור</button>
            </div>` : (!isMulti ? `
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn giValModal__closeBtn" data-phxci-close="1">ביטול</button>
              <button type="button" class="btn btn--primary" data-phxci-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
            </div>` : `
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn giValModal__closeBtn" data-phxci-close="1">ביטול</button>
              <button type="button" class="btn btn--secondary" data-phxci-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
              <button type="button" class="btn btn--primary" data-phxci-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
            </div>`);

        const confirmOverlayHtml = this._confirmSwitch ? `
          <div class="${P}__overlay">
            <div class="${P}__overlayCard">
              <div class="${P}__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
              <div class="${P}__overlayBtns">
                <button type="button" class="btn btn--primary" data-phxci-switch="save">שמור ועבור</button>
                <button type="button" class="btn btn--secondary" data-phxci-switch="discard">עבור ללא שמירה</button>
                <button type="button" class="btn" data-phxci-switch="cancel">ביטול</button>
              </div>
            </div>
          </div>` : "";

        this._modal.innerHTML = `
          <div class="giValModal__backdrop" data-phxci-close="1"></div>
          <div class="giValModal__card ${P}__card">
            <div class="giValModal__head">
              <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
              <div class="giValModal__headText">
                <div class="giValModal__title">${escapeHtml(plan.title)}</div>
                <div class="giValModal__sub">${escapeHtml(plan.subtitle)}</div>
              </div>
              <button type="button" class="${P}__closeX" data-phxci-close="1" aria-label="סגירה">✕</button>
            </div>
            <div class="giValModal__body ${P}__body">
              ${tabsHtml}
              ${isStandalone
                ? `<div class="${P}__insuredLabel ${P}__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
                : `<div class="${P}__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
              <div class="${P}__grid">
                <div class="${P}__field">
                  <label class="${P}__label">תאריך לידה</label>
                  <input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-phxci-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />
                  ${ageHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">תחילת ביטוח</label>
                  <input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-phxci-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" />
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">מין</label>
                  <div class="${P}__segmented">
                    <button type="button" class="${P}__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-phxci-field="gender" data-phxci-value="זכר">זכר</button>
                    <button type="button" class="${P}__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-phxci-field="gender" data-phxci-value="נקבה">נקבה</button>
                  </div>
                  ${genderHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">עישון</label>
                  <div class="${P}__segmented">
                    <button type="button" class="${P}__segBtn${st.smoker === false ? " is-active" : ""}" data-phxci-field="smoker" data-phxci-value="0">לא מעשן/ת</button>
                    <button type="button" class="${P}__segBtn${st.smoker === true ? " is-active" : ""}" data-phxci-field="smoker" data-phxci-value="1">מעשן/ת</button>
                  </div>
                  ${smokerHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">סכום פיצוי (₪${formatRiskSimSumInsuredDigits(sumLimits.minSum)}–₪${formatRiskSimSumInsuredDigits(sumLimits.maxSum)})</label>
                  <input class="${P}__input" type="text" inputmode="numeric" data-phxci-field="compensation" value="${escapeHtml(st.compensation || "")}" placeholder="לדוגמה: 100,000" />
                </div>
                ${programModeHtml}
                <div class="${P}__field ${P}__field--wide">
                  <label class="${P}__label">עיסוק</label>
                  <input class="${P}__input" type="text" data-phxci-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
                </div>
              </div>
              <div class="${P}__actions">
                <button type="button" class="btn btn--primary" data-phxci-calc="1">חשב פרמיה</button>
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
          <div class="giValModal__backdrop" data-phxci-close="1"></div>
          <div class="giValModal__card ${P}__card">
            <div class="giValModal__head">
              <div class="giValModal__headText">
                <div class="giValModal__title">סיכום סימולטור להצעה</div>
              </div>
              <button type="button" class="${P}__closeX" data-phxci-close="1" aria-label="סגירה">✕</button>
            </div>
            <div class="giValModal__body ${P}__body">${rows}</div>
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn giValModal__closeBtn" data-phxci-summary-back="1">חזרה</button>
              <button type="button" class="btn btn--primary" data-phxci-summary-confirm="1">אישור סופי</button>
            </div>
          </div>`;
        this._bind();
      },

      _bind(){
        const modal = this._modal;
        if(!modal) return;
        ensureSegFieldDelegation(modal, this, "phxci");
        $$("[data-phxci-close]", modal).forEach((el) => on(el, "click", () => this.close()));
        $$("[data-phxci-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-phxci-tab"))));
        $$("[data-phxci-switch]", modal).forEach((el) => on(el, "click", () => {
          const action = el.getAttribute("data-phxci-switch");
          const target = this._confirmSwitch?.targetId;
          this._confirmSwitch = null;
          if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); }
          else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); }
          else this._render();
        }));
        bindRiskSimDmyField(modal, '[data-phxci-field="birthDate"]', {
          onInput: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.birthDate = val;
            st.birthDateSource = "manual";
            st.dirtySinceSave = true;
          },
          onCommit: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.birthDate = val;
            st.birthDateSource = "manual";
            st.ageSource = "manual";
            st.result = null; st.error = null; st.dirtySinceSave = true;
            this._syncAge(st);
            this._render();
          }
        });
        bindRiskSimDmyField(modal, '[data-phxci-field="insuranceStartDate"]', {
          onInput: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.insuranceStartDate = val;
            st.insuranceStartDateSource = "manual";
            st.dirtySinceSave = true;
          },
          onCommit: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.insuranceStartDate = val || riskSimTodayDmy();
            st.insuranceStartDateSource = "manual";
            st.result = null; st.error = null; st.dirtySinceSave = true;
            this._syncAge(st);
            this._render();
          }
        });
        const sumInput = modal.querySelector('[data-phxci-field="compensation"]');
        if(sumInput) on(sumInput, "input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          const formatted = formatRiskSimSumInsuredDigits(sumInput.value);
          sumInput.value = formatted;
          try { sumInput.setSelectionRange(formatted.length, formatted.length); } catch(_e){}
          st.compensation = formatted;
          st.result = null; st.error = null; st.dirtySinceSave = true;
        });
        const occInput = modal.querySelector('[data-phxci-field="occupation"]');
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
        const calcBtn = modal.querySelector("[data-phxci-calc]");
        if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
        const applyBtn = modal.querySelector("[data-phxci-apply]");
        if(applyBtn) on(applyBtn, "click", () => this._apply());
        const saveBtn = modal.querySelector("[data-phxci-save]");
        if(saveBtn) on(saveBtn, "click", () => this._saveActive());
        const finalBtn = modal.querySelector("[data-phxci-finalconfirm]");
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
        const summaryBackBtn = modal.querySelector("[data-phxci-summary-back]");
        if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
        const summaryConfirmBtn = modal.querySelector("[data-phxci-summary-confirm]");
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
          const calc = computePhoenixCiPremium(planId, {
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
          insuranceStartDate: st.insuranceStartDate || "",
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

  const PhoenixCriticalIllnessSimulator = createPhoenixCiSimulator("marpe");
  const PhoenixCancerSimulator = createPhoenixCiSimulator("marpeCancer");
  RiskSimulators.register("הפניקס", "מחלות קשות", PhoenixCriticalIllnessSimulator);
  RiskSimulators.register("הפניקס", "סרטן", PhoenixCancerSimulator);
  // ===== סוף GI-PHX-CI-SIM ========================================================


  // ===== GI-AYL-CI-SIM 2026-08-11 · מחלות קשות / סרטן איילון ==================
  // מקור: תעריפי בריאות איילון.pdf (יוני 2026) · בשביל החוסן + בשביל החוסן סרטן.
  // מחלות קשות: פרמיה חודשית לכל ₪1,000. סרטן: לכל ₪10,000. תעריפים באגורות 1:1.
  // גיל כניסה מקסימלי 65; טבלת תעריף ממשיכה עד 75 (חישוב כניסה נחסם ב-65).
  // סכום פיצוי: מינימום ₪50,000, ללא תקרה קשיחה (סף הצהרה מקוצרת 350K/300K — באשף).

  const AYALON_CI_RATE_MAPS = {"hoshen":{"0":{"mNS":10,"mS":10,"fNS":10,"fS":10},"1":{"mNS":10,"mS":10,"fNS":10,"fS":10},"2":{"mNS":10,"mS":10,"fNS":10,"fS":10},"3":{"mNS":10,"mS":10,"fNS":10,"fS":10},"4":{"mNS":10,"mS":10,"fNS":10,"fS":10},"5":{"mNS":10,"mS":10,"fNS":10,"fS":10},"6":{"mNS":10,"mS":10,"fNS":10,"fS":10},"7":{"mNS":10,"mS":10,"fNS":10,"fS":10},"8":{"mNS":10,"mS":10,"fNS":10,"fS":10},"9":{"mNS":10,"mS":10,"fNS":10,"fS":10},"10":{"mNS":10,"mS":10,"fNS":10,"fS":10},"11":{"mNS":10,"mS":10,"fNS":10,"fS":10},"12":{"mNS":10,"mS":10,"fNS":10,"fS":10},"13":{"mNS":10,"mS":10,"fNS":10,"fS":10},"14":{"mNS":10,"mS":10,"fNS":10,"fS":10},"15":{"mNS":10,"mS":10,"fNS":10,"fS":10},"16":{"mNS":10,"mS":10,"fNS":10,"fS":10},"17":{"mNS":10,"mS":10,"fNS":10,"fS":10},"18":{"mNS":10,"mS":10,"fNS":10,"fS":10},"19":{"mNS":10,"mS":10,"fNS":10,"fS":10},"20":{"mNS":13,"mS":20,"fNS":14,"fS":19},"21":{"mNS":13,"mS":20,"fNS":14,"fS":19},"22":{"mNS":13,"mS":20,"fNS":14,"fS":19},"23":{"mNS":14,"mS":21,"fNS":15,"fS":20},"24":{"mNS":14,"mS":21,"fNS":16,"fS":22},"25":{"mNS":15,"mS":22,"fNS":18,"fS":23},"26":{"mNS":15,"mS":23,"fNS":19,"fS":25},"27":{"mNS":16,"mS":23,"fNS":22,"fS":27},"28":{"mNS":17,"mS":24,"fNS":25,"fS":31},"29":{"mNS":18,"mS":26,"fNS":29,"fS":35},"30":{"mNS":19,"mS":28,"fNS":33,"fS":39},"31":{"mNS":20,"mS":30,"fNS":37,"fS":44},"32":{"mNS":21,"mS":32,"fNS":42,"fS":49},"33":{"mNS":23,"mS":36,"fNS":48,"fS":56},"34":{"mNS":26,"mS":40,"fNS":55,"fS":63},"35":{"mNS":29,"mS":46,"fNS":62,"fS":71},"36":{"mNS":32,"mS":52,"fNS":68,"fS":78},"37":{"mNS":37,"mS":62,"fNS":71,"fS":82},"38":{"mNS":43,"mS":73,"fNS":72,"fS":84},"39":{"mNS":49,"mS":86,"fNS":73,"fS":86},"40":{"mNS":55,"mS":100,"fNS":75,"fS":89},"41":{"mNS":66,"mS":119,"fNS":79,"fS":96},"42":{"mNS":77,"mS":140,"fNS":87,"fS":105},"43":{"mNS":89,"mS":163,"fNS":97,"fS":117},"44":{"mNS":103,"mS":189,"fNS":108,"fS":130},"45":{"mNS":117,"mS":216,"fNS":119,"fS":143},"46":{"mNS":128,"mS":238,"fNS":129,"fS":155},"47":{"mNS":136,"mS":255,"fNS":137,"fS":165},"48":{"mNS":268,"mS":143,"fNS":172,"fS":143},"49":{"mNS":150,"mS":281,"fNS":148,"fS":180},"50":{"mNS":151,"mS":317,"fNS":143,"fS":207},"51":{"mNS":162,"mS":338,"fNS":153,"fS":222},"52":{"mNS":178,"mS":370,"fNS":164,"fS":238},"53":{"mNS":204,"mS":422,"fNS":179,"fS":259},"54":{"mNS":237,"mS":487,"fNS":195,"fS":281},"55":{"mNS":274,"mS":559,"fNS":212,"fS":305},"56":{"mNS":316,"mS":642,"fNS":227,"fS":327},"57":{"mNS":366,"mS":738,"fNS":243,"fS":350},"58":{"mNS":424,"mS":848,"fNS":263,"fS":379},"59":{"mNS":489,"mS":969,"fNS":286,"fS":410},"60":{"mNS":557,"mS":1093,"fNS":310,"fS":444},"61":{"mNS":607,"mS":1188,"fNS":327,"fS":469},"62":{"mNS":653,"mS":1275,"fNS":344,"fS":496},"63":{"mNS":683,"mS":1321,"fNS":355,"fS":515},"64":{"mNS":699,"mS":1346,"fNS":365,"fS":532},"65":{"mNS":734,"mS":1401,"fNS":375,"fS":549},"66":{"mNS":760,"mS":1442,"fNS":384,"fS":564},"67":{"mNS":786,"mS":1482,"fNS":394,"fS":582},"68":{"mNS":812,"mS":1524,"fNS":405,"fS":602},"69":{"mNS":838,"mS":1566,"fNS":420,"fS":628},"70":{"mNS":866,"mS":1616,"fNS":437,"fS":656},"71":{"mNS":903,"mS":1675,"fNS":465,"fS":699},"72":{"mNS":951,"mS":1762,"fNS":497,"fS":748},"73":{"mNS":1002,"mS":1852,"fNS":529,"fS":796},"74":{"mNS":1045,"mS":1919,"fNS":562,"fS":845},"75":{"mNS":1045,"mS":1919,"fNS":562,"fS":845}},"hoshenCancer":{"0":{"mNS":50,"mS":50,"fNS":50,"fS":50},"1":{"mNS":50,"mS":50,"fNS":50,"fS":50},"2":{"mNS":50,"mS":50,"fNS":50,"fS":50},"3":{"mNS":50,"mS":50,"fNS":50,"fS":50},"4":{"mNS":50,"mS":50,"fNS":50,"fS":50},"5":{"mNS":50,"mS":50,"fNS":50,"fS":50},"6":{"mNS":50,"mS":50,"fNS":50,"fS":50},"7":{"mNS":50,"mS":50,"fNS":50,"fS":50},"8":{"mNS":50,"mS":50,"fNS":50,"fS":50},"9":{"mNS":50,"mS":50,"fNS":50,"fS":50},"10":{"mNS":50,"mS":50,"fNS":50,"fS":50},"11":{"mNS":50,"mS":50,"fNS":50,"fS":50},"12":{"mNS":50,"mS":50,"fNS":50,"fS":50},"13":{"mNS":50,"mS":50,"fNS":50,"fS":50},"14":{"mNS":50,"mS":50,"fNS":50,"fS":50},"15":{"mNS":50,"mS":50,"fNS":50,"fS":50},"16":{"mNS":50,"mS":50,"fNS":50,"fS":50},"17":{"mNS":50,"mS":50,"fNS":50,"fS":50},"18":{"mNS":50,"mS":50,"fNS":50,"fS":50},"19":{"mNS":50,"mS":50,"fNS":50,"fS":50},"20":{"mNS":67,"mS":99,"fNS":83,"fS":100},"21":{"mNS":70,"mS":103,"fNS":91,"fS":111},"22":{"mNS":72,"mS":105,"fNS":100,"fS":122},"23":{"mNS":73,"mS":107,"fNS":110,"fS":135},"24":{"mNS":75,"mS":110,"fNS":122,"fS":150},"25":{"mNS":77,"mS":114,"fNS":136,"fS":167},"26":{"mNS":81,"mS":119,"fNS":152,"fS":189},"27":{"mNS":87,"mS":127,"fNS":173,"fS":214},"28":{"mNS":94,"mS":138,"fNS":196,"fS":244},"29":{"mNS":103,"mS":151,"fNS":223,"fS":278},"30":{"mNS":112,"mS":165,"fNS":253,"fS":316},"31":{"mNS":124,"mS":182,"fNS":286,"fS":358},"32":{"mNS":136,"mS":200,"fNS":322,"fS":404},"33":{"mNS":150,"mS":220,"fNS":360,"fS":452},"34":{"mNS":164,"mS":241,"fNS":399,"fS":501},"35":{"mNS":178,"mS":262,"fNS":436,"fS":548},"36":{"mNS":191,"mS":281,"fNS":468,"fS":589},"37":{"mNS":204,"mS":300,"fNS":494,"fS":621},"38":{"mNS":218,"mS":320,"fNS":515,"fS":647},"39":{"mNS":233,"mS":342,"fNS":537,"fS":675},"40":{"mNS":251,"mS":369,"fNS":569,"fS":715},"41":{"mNS":274,"mS":402,"fNS":616,"fS":776},"42":{"mNS":300,"mS":441,"fNS":684,"fS":861},"43":{"mNS":329,"mS":483,"fNS":767,"fS":967},"44":{"mNS":357,"mS":525,"fNS":857,"fS":1081},"45":{"mNS":389,"mS":570,"fNS":944,"fS":1191},"46":{"mNS":416,"mS":609,"fNS":1018,"fS":1284},"47":{"mNS":443,"mS":649,"fNS":1075,"fS":1356},"48":{"mNS":472,"mS":692,"fNS":1117,"fS":1409},"49":{"mNS":510,"mS":747,"fNS":1154,"fS":1456},"50":{"mNS":562,"mS":826,"fNS":1196,"fS":1512},"51":{"mNS":640,"mS":940,"fNS":1253,"fS":1586},"52":{"mNS":750,"mS":1102,"fNS":1331,"fS":1685},"53":{"mNS":898,"mS":1320,"fNS":1429,"fS":1810},"54":{"mNS":1085,"mS":1595,"fNS":1542,"fS":1953},"55":{"mNS":1320,"mS":1940,"fNS":1664,"fS":2108},"56":{"mNS":1573,"mS":2313,"fNS":1789,"fS":2267},"57":{"mNS":1847,"mS":2715,"fNS":1915,"fS":2427},"58":{"mNS":2128,"mS":3129,"fNS":2037,"fS":2582},"59":{"mNS":2401,"mS":3530,"fNS":2150,"fS":2725},"60":{"mNS":2651,"mS":3897,"fNS":2248,"fS":2850},"61":{"mNS":2861,"mS":4206,"fNS":2327,"fS":2950},"62":{"mNS":3032,"mS":4457,"fNS":2387,"fS":3026},"63":{"mNS":3166,"mS":4655,"fNS":2433,"fS":3085},"64":{"mNS":3270,"mS":4806,"fNS":2475,"fS":3138},"65":{"mNS":3368,"mS":4951,"fNS":2521,"fS":3197},"66":{"mNS":3442,"mS":5060,"fNS":2579,"fS":3271},"67":{"mNS":3509,"mS":5159,"fNS":2655,"fS":3368},"68":{"mNS":3574,"mS":5253,"fNS":2753,"fS":3491},"69":{"mNS":3637,"mS":5347,"fNS":2874,"fS":3645},"70":{"mNS":3698,"mS":5436,"fNS":3018,"fS":3828},"71":{"mNS":3761,"mS":5529,"fNS":3186,"fS":4042},"72":{"mNS":3826,"mS":5624,"fNS":3378,"fS":4286},"73":{"mNS":3894,"mS":5724,"fNS":3593,"fS":4559},"74":{"mNS":3964,"mS":5827,"fNS":3831,"fS":4860}}};

  const AYALON_CI_PLANS = {
    hoshen: {
      id: "hoshen",
      pdfName: "בשביל החוסן",
      wizardCoverKey: "בשביל החוסן — מחלות קשות",
      productKey: "מחלות קשות",
      title: "סימולטור מחלות קשות איילון",
      subtitle: "בשביל החוסן — פרמיה חודשית לכל ₪1,000 פיצוי",
      rateUnit: 1000,
      rateUnitLabel: "₪1,000",
      minAge: 0,
      maxEntryAge: 65,
      minEntryDays: 0,
      minSum: 50000,
      maxSum: null,
      declareHintSum: 350000,
      supportsProgramMode: false,
      cssPrefix: "lcAylCi",
      modalClass: "lcAylCiModal"
    },
    hoshenCancer: {
      id: "hoshenCancer",
      pdfName: "בשביל החוסן סרטן",
      wizardCoverKey: "בשביל החוסן — סרטן",
      productKey: "סרטן",
      title: "סימולטור סרטן איילון",
      subtitle: "בשביל החוסן סרטן — פרמיה חודשית לכל ₪10,000 פיצוי",
      rateUnit: 10000,
      rateUnitLabel: "₪10,000",
      minAge: 0,
      maxEntryAge: 65,
      minEntryDays: 0,
      minSum: 50000,
      maxSum: null,
      declareHintSum: 300000,
      supportsProgramMode: false,
      cssPrefix: "lcAylCi",
      modalClass: "lcAylCiModal"
    }
  };

  function ayalonCiResolveSumLimits(planId){
    const plan = AYALON_CI_PLANS[planId];
    if(!plan) return { minSum: null, maxSum: null };
    return { minSum: plan.minSum, maxSum: plan.maxSum };
  }

  function ayalonCiAgorotToShekels(agorot){
    return agorot / 100;
  }
  function formatAyalonCiExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    const whole = Math.trunc(ag / 100);
    const frac = Math.abs(ag % 100);
    return whole + "." + String(frac).padStart(2, "0");
  }

  function lookupAyalonCiRate(planId, { age, gender, smoker }){
    const plan = AYALON_CI_PLANS[planId];
    if(!plan) return { ok:false, reason:"plan_missing" };
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    if(ageNum < plan.minAge || ageNum > plan.maxEntryAge) return { ok:false, reason:"age_out_of_range" };
    const map = AYALON_CI_RATE_MAPS[planId];
    const row = map ? map[String(ageNum)] : null;
    if(!row) return { ok:false, reason:"age_out_of_range" };
    if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const key = gender === "זכר" ? (smoker ? "mS" : "mNS") : (smoker ? "fS" : "fNS");
    const rateAgorot = row[key];
    if(rateAgorot == null || !Number.isInteger(rateAgorot)) return { ok:false, reason:"rate_missing" };
    return {
      ok: true,
      rateAgorot,
      ratePerUnit: ayalonCiAgorotToShekels(rateAgorot),
      rateUnit: plan.rateUnit,
      rateUnitLabel: plan.rateUnitLabel,
      planId,
      pdfName: plan.pdfName
    };
  }

  function computeAyalonCiPremium(planId, { age, gender, smoker, compensation }){
    const plan = AYALON_CI_PLANS[planId];
    if(!plan) return { ok:false, reason:"plan_missing" };
    const sum = Number(String(compensation == null ? "" : compensation).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const limits = ayalonCiResolveSumLimits(planId);
    if(limits.minSum == null) return { ok:false, reason:"plan_missing" };
    if(sum < limits.minSum){
      return { ok:false, reason:"sum_out_of_range", minSum: limits.minSum, maxSum: limits.maxSum };
    }
    const looked = lookupAyalonCiRate(planId, { age, gender, smoker });
    if(!looked.ok) return looked;
    const monthlyAgorotExact = (looked.rateAgorot * sum) / plan.rateUnit;
    if(!Number.isFinite(monthlyAgorotExact)) return { ok:false, reason:"rate_missing" };
    const monthlyPremium = monthlyAgorotExact / 100;
    const annualPremium = monthlyPremium * 12;
    return {
      ok: true,
      monthlyPremium,
      annualPremium,
      ratePerUnit: looked.ratePerUnit,
      rateUnit: plan.rateUnit,
      rateUnitLabel: plan.rateUnitLabel,
      compensation: sum,
      planId,
      programMode: "base",
      pdfName: looked.pdfName,
      wizardCoverKey: plan.wizardCoverKey,
      minSum: limits.minSum,
      maxSum: limits.maxSum,
      declareHintSum: plan.declareHintSum
    };
  }

  const AYALON_CI_MESSAGES = {
    birth_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young: "גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing: "יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range: "הגיל הביטוחי (חצי שנה ומעלה מעוגל למעלה) חורג מטווח הכניסה המותר למסלול זה.",
    gender_missing: "יש לבחור מין לפני חישוב הפרמיה.",
    smoker_missing: "יש לציין האם המבוטח מעשן/ת לפני חישוב הפרמיה.",
    sum_missing: "יש להזין סכום פיצוי תקין (גדול מאפס) לפני חישוב הפרמיה.",
    sum_out_of_range: "סכום הפיצוי נמוך מהמינימום המותר למסלול זה.",
    rate_missing: "לא נמצא תעריף מתאים לנתונים שהוזנו.",
    plan_missing: "מסלול לא מזוהה בתעריפון."
  };

  function createAyalonCiSimulator(planId){
    const plan = AYALON_CI_PLANS[planId];
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
        const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
        const st = {
          birthDate,
          birthDateSource: birthDate ? "step1" : "",
          insuranceStartDate,
          insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
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
          minEntryDays: plan.minEntryDays,
          asOfDate: st.insuranceStartDate || ""
        });
        return st;
      },

      _syncAge(st){
        return riskSimSyncAgeFromBirthDate(st, {
          minAge: plan.minAge,
          maxAge: plan.maxEntryAge,
          minEntryDays: plan.minEntryDays,
          asOfDate: st?.insuranceStartDate || ""
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
        modal.id = "lcAylCiModal_" + planId;
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
          st.error = AYALON_CI_MESSAGES[ageSync.reason] || AYALON_CI_MESSAGES.birth_missing;
          if(ageSync.reason === "age_out_of_range"){
            st.error = `הגיל הביטוחי חורג מטווח הכניסה ${plan.minAge}–${plan.maxEntryAge} (חצי שנה ומעלה מעוגל למעלה).`;
          }
          this._render();
          return;
        }
        const calc = computeAyalonCiPremium(planId, {
          age: st.age, gender: st.gender, smoker: st.smoker,
          compensation: st.compensation
        });
        if(calc.ok){
          st.result = calc;
          st.error = null;
        } else {
          st.result = null;
          let msg = AYALON_CI_MESSAGES[calc.reason] || "לא ניתן לחשב את הפרמיה.";
          if(calc.reason === "age_out_of_range"){
            msg = `לא נמצא תעריף לכניסה בגיל זה (טווח כניסה ${plan.minAge}–${plan.maxEntryAge}).`;
          } else if(calc.reason === "sum_out_of_range"){
            msg = `סכום הפיצוי חייב להיות לפחות ₪${formatRiskSimSumInsuredDigits(calc.minSum)}.`;
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
          return `<button type="button" class="${P}__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-aylci-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
        }).join("")}</div>` : "";

        const ageSync = this._syncAge(st);
        const sumLimits = ayalonCiResolveSumLimits(planId);
        const sumNum = Number(String(st.compensation || "").replace(/[^\d.-]/g, ""));
        const ageHintHtml = !st.birthDate
          ? (isStandalone
            ? `<div class="${P}__hint ${P}__hint--warn">יש לבחור תאריך לידה מלוח השנה</div>`
            : `<div class="${P}__hint ${P}__hint--warn">לא נמצא תאריך לידה בפרטים האישיים — יש לבחור מלוח השנה</div>`)
          : (!ageSync.ok
            ? `<div class="${P}__hint ${P}__hint--warn">${escapeHtml(
                ageSync.reason === "age_out_of_range"
                  ? `הגיל הביטוחי חורג מטווח הכניסה ${plan.minAge}–${plan.maxEntryAge}`
                  : (AYALON_CI_MESSAGES[ageSync.reason] || "תאריך לידה לא תקין לחישוב")
              )}</div>`
            : `<div class="${P}__hint">גיל ביטוחי (חצי שנה ומעלה מעוגל למעלה): <strong>${escapeHtml(String(ageSync.age))}</strong></div>`);
        const genderHintHtml = (isStandalone || st.gender) ? "" : `<div class="${P}__hint ${P}__hint--warn">לא נמצא מין בפרטים האישיים — יש לבחור</div>`;
        const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false) ? "" : `<div class="${P}__hint ${P}__hint--warn">לא נמצא סטטוס עישון בפרטים האישיים — יש לבחור</div>`;
        const declareHintHtml = (Number.isFinite(sumNum) && plan.declareHintSum && sumNum > plan.declareHintSum)
          ? `<div class="${P}__hint ${P}__hint--warn">מעל ₪${formatRiskSimSumInsuredDigits(plan.declareHintSum)} תיפתח באשף הצהרת בריאות מלאה (לא חוסם חישוב).</div>`
          : "";

        const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company)
          ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini")
          : "✚";
        const occAssessment = assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product);
        const occBlockHtml = renderOccupationRiskBlockHtml(occAssessment, P);

        const resultHtml = st.error
          ? `<div class="${P}__result ${P}__result--error">${escapeHtml(st.error)}</div>`
          : (st.result ? `<div class="${P}__result ${P}__result--ok">
              <div class="${P}__resultRow"><span>מסלול</span><strong>${escapeHtml(st.result.pdfName)}</strong></div>
              <div class="${P}__resultRow"><span>תעריף ל-${escapeHtml(st.result.rateUnitLabel)}</span><strong>₪${escapeHtml(formatAyalonCiExactAmount(st.result.ratePerUnit))}</strong></div>
              <div class="${P}__resultRow"><span>סכום פיצוי</span><strong>₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.compensation))}</strong></div>
              <div class="${P}__resultRow ${P}__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatAyalonCiExactAmount(st.result.monthlyPremium))}</strong></div>
              <div class="${P}__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatAyalonCiExactAmount(st.result.annualPremium))}</strong></div>
            </div>` : `<div class="${P}__result ${P}__result--empty">מלאו את השדות ולחצו "חשב פרמיה"</div>`);

        const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
        const relevantInsureds = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allRelevantSaved = relevantInsureds.length > 0 && relevantInsureds.every((ins) => !!this._state[ins.id]?.savedAt);

        const footHtml = isStandalone ? `
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn btn--primary" data-aylci-close="1">סגור</button>
            </div>` : (!isMulti ? `
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn giValModal__closeBtn" data-aylci-close="1">ביטול</button>
              <button type="button" class="btn btn--primary" data-aylci-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button>
            </div>` : `
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn giValModal__closeBtn" data-aylci-close="1">ביטול</button>
              <button type="button" class="btn btn--secondary" data-aylci-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button>
              <button type="button" class="btn btn--primary" data-aylci-finalconfirm="1"${allRelevantSaved ? "" : " disabled"}>אישור סופי</button>
            </div>`);

        const confirmOverlayHtml = this._confirmSwitch ? `
          <div class="${P}__overlay">
            <div class="${P}__overlayCard">
              <div class="${P}__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div>
              <div class="${P}__overlayBtns">
                <button type="button" class="btn btn--primary" data-aylci-switch="save">שמור ועבור</button>
                <button type="button" class="btn btn--secondary" data-aylci-switch="discard">עבור ללא שמירה</button>
                <button type="button" class="btn" data-aylci-switch="cancel">ביטול</button>
              </div>
            </div>
          </div>` : "";

        this._modal.innerHTML = `
          <div class="giValModal__backdrop" data-aylci-close="1"></div>
          <div class="giValModal__card ${P}__card">
            <div class="giValModal__head">
              <span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span>
              <div class="giValModal__headText">
                <div class="giValModal__title">${escapeHtml(plan.title)}</div>
                <div class="giValModal__sub">${escapeHtml(plan.subtitle)}</div>
              </div>
              <button type="button" class="${P}__closeX" data-aylci-close="1" aria-label="סגירה">✕</button>
            </div>
            <div class="giValModal__body ${P}__body">
              ${tabsHtml}
              ${isStandalone
                ? `<div class="${P}__insuredLabel ${P}__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>`
                : `<div class="${P}__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}
              <div class="${P}__grid">
                <div class="${P}__field">
                  <label class="${P}__label">תאריך לידה</label>
                  <input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-aylci-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />
                  ${ageHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">תחילת ביטוח</label>
                  <input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-aylci-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" />
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">מין</label>
                  <div class="${P}__segmented">
                    <button type="button" class="${P}__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-aylci-field="gender" data-aylci-value="זכר">זכר</button>
                    <button type="button" class="${P}__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-aylci-field="gender" data-aylci-value="נקבה">נקבה</button>
                  </div>
                  ${genderHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">עישון</label>
                  <div class="${P}__segmented">
                    <button type="button" class="${P}__segBtn${st.smoker === false ? " is-active" : ""}" data-aylci-field="smoker" data-aylci-value="0">לא מעשן/ת</button>
                    <button type="button" class="${P}__segBtn${st.smoker === true ? " is-active" : ""}" data-aylci-field="smoker" data-aylci-value="1">מעשן/ת</button>
                  </div>
                  ${smokerHintHtml}
                </div>
                <div class="${P}__field">
                  <label class="${P}__label">סכום פיצוי (מ-₪${formatRiskSimSumInsuredDigits(sumLimits.minSum)}, ללא תקרה)</label>
                  <input class="${P}__input" type="text" inputmode="numeric" data-aylci-field="compensation" value="${escapeHtml(st.compensation || "")}" placeholder="לדוגמה: 100,000" />
                  ${declareHintHtml}
                </div>
                <div class="${P}__field ${P}__field--wide">
                  <label class="${P}__label">עיסוק</label>
                  <input class="${P}__input" type="text" data-aylci-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס, נהג משאית" autocomplete="off" />
                </div>
              </div>
              <div class="${P}__actions">
                <button type="button" class="btn btn--primary" data-aylci-calc="1">חשב פרמיה</button>
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
          <div class="giValModal__backdrop" data-aylci-close="1"></div>
          <div class="giValModal__card ${P}__card">
            <div class="giValModal__head">
              <div class="giValModal__headText">
                <div class="giValModal__title">סיכום סימולטור להצעה</div>
              </div>
              <button type="button" class="${P}__closeX" data-aylci-close="1" aria-label="סגירה">✕</button>
            </div>
            <div class="giValModal__body ${P}__body">${rows}</div>
            <div class="giValModal__foot ${P}__foot">
              <button type="button" class="btn giValModal__closeBtn" data-aylci-summary-back="1">חזרה</button>
              <button type="button" class="btn btn--primary" data-aylci-summary-confirm="1">אישור סופי</button>
            </div>
          </div>`;
        this._bind();
      },

      _bind(){
        const modal = this._modal;
        if(!modal) return;
        ensureSegFieldDelegation(modal, this, "aylci");
        $$("[data-aylci-close]", modal).forEach((el) => on(el, "click", () => this.close()));
        $$("[data-aylci-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-aylci-tab"))));
        $$("[data-aylci-switch]", modal).forEach((el) => on(el, "click", () => {
          const action = el.getAttribute("data-aylci-switch");
          const target = this._confirmSwitch?.targetId;
          this._confirmSwitch = null;
          if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); }
          else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); }
          else this._render();
        }));
        bindRiskSimDmyField(modal, '[data-aylci-field="birthDate"]', {
          onInput: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.birthDate = val;
            st.birthDateSource = "manual";
            st.dirtySinceSave = true;
          },
          onCommit: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.birthDate = val;
            st.birthDateSource = "manual";
            st.ageSource = "manual";
            st.result = null; st.error = null; st.dirtySinceSave = true;
            this._syncAge(st);
            this._render();
          }
        });
        bindRiskSimDmyField(modal, '[data-aylci-field="insuranceStartDate"]', {
          onInput: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.insuranceStartDate = val;
            st.insuranceStartDateSource = "manual";
            st.dirtySinceSave = true;
          },
          onCommit: (val) => {
            const st = this._state[this._activeInsuredId];
            if(!st) return;
            st.insuranceStartDate = val || riskSimTodayDmy();
            st.insuranceStartDateSource = "manual";
            st.result = null; st.error = null; st.dirtySinceSave = true;
            this._syncAge(st);
            this._render();
          }
        });
        const sumInput = modal.querySelector('[data-aylci-field="compensation"]');
        if(sumInput) on(sumInput, "input", () => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          const formatted = formatRiskSimSumInsuredDigits(sumInput.value);
          sumInput.value = formatted;
          try { sumInput.setSelectionRange(formatted.length, formatted.length); } catch(_e){}
          st.compensation = formatted;
          st.result = null; st.error = null; st.dirtySinceSave = true;
        });
        const occInput = modal.querySelector('[data-aylci-field="occupation"]');
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
        const calcBtn = modal.querySelector("[data-aylci-calc]");
        if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
        const applyBtn = modal.querySelector("[data-aylci-apply]");
        if(applyBtn) on(applyBtn, "click", () => this._apply());
        const saveBtn = modal.querySelector("[data-aylci-save]");
        if(saveBtn) on(saveBtn, "click", () => this._saveActive());
        const finalBtn = modal.querySelector("[data-aylci-finalconfirm]");
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
        const summaryBackBtn = modal.querySelector("[data-aylci-summary-back]");
        if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
        const summaryConfirmBtn = modal.querySelector("[data-aylci-summary-confirm]");
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
          const calc = computeAyalonCiPremium(planId, {
            age: st.age, gender: st.gender, smoker: st.smoker,
            compensation: st.compensation
          });
          if(!calc.ok) return null;
          st.result = calc; st.error = null;
        }
        const r = st.result;
        return {
          compensation: formatRiskSimSumInsuredDigits(r.compensation),
          monthlyPremium: r.monthlyPremium,
          annualPremium: r.annualPremium,
          ratePerUnit: r.ratePerUnit,
          rateUnit: r.rateUnit,
          rateUnitLabel: r.rateUnitLabel,
          pdfName: r.pdfName,
          planId: r.planId,
          programMode: r.programMode || st.programMode || "base",
          wizardCoverKey: r.wizardCoverKey,
          birthDate: st.birthDate || "",
          insuranceStartDate: st.insuranceStartDate || "",
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

  const AyalonCriticalIllnessSimulator = createAyalonCiSimulator("hoshen");
  const AyalonCancerSimulator = createAyalonCiSimulator("hoshenCancer");
  RiskSimulators.register("איילון", "מחלות קשות", AyalonCriticalIllnessSimulator);
  RiskSimulators.register("איילון", "סרטן", AyalonCancerSimulator);
  // ===== סוף GI-AYL-CI-SIM ========================================================






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
    age_out_of_range: `הגיל הביטוחי (חצי שנה ומעלה מעוגל למעלה) חורג מטווח הכניסה ${HACHSHARA_HEALTH_MIN_AGE}–${HACHSHARA_HEALTH_MAX_AGE}.`,
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
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate,
        birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate,
        insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
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
        minEntryDays: HACHSHARA_HEALTH_MIN_ENTRY_DAYS,
        asOfDate: st.insuranceStartDate || ""
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
        minEntryDays: HACHSHARA_HEALTH_MIN_ENTRY_DAYS,
        asOfDate: st?.insuranceStartDate || ""
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
          : `<div class="lcHachHealth__hint">גיל ביטוחי (חצי שנה ומעלה מעוגל למעלה): <strong>${escapeHtml(ageDisplay)}</strong></div>`);
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
                <input class="lcHachHealth__input lcHachHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-hachh-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />
                ${ageHintHtml}
              </div>
              <div class="lcHachHealth__field">
                <label class="lcHachHealth__label">תחילת ביטוח</label>
                <input class="lcHachHealth__input lcHachHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-hachh-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" />
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
      bindRiskSimDmyField(modal, '[data-hachh-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.ageSource = "manual";
          st.dirtySinceSave = true;
          this._syncAge(st);
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-hachh-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
          this._syncAge(st);
          this._render();
        }
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
        insuranceStartDate: st.insuranceStartDate || "",
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
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = {
        birthDate, birthDateSource: birthDate ? "step1" : "",
        insuranceStartDate, insuranceStartDateSource: insuranceStartDate ? "ctx" : "",
        age: "", ageSource: birthDate ? "step1" : "", ageRaw: null, entryDays: null,
        gender, genderSource: gender ? "step1" : "",
        smoker, smokerSource: smoker != null ? "step1" : "",
        compensation, compensationSource: "default",
        result: null, error: null, savedAt: null, dirtySinceSave: false
      };
      riskSimSyncAgeFromBirthDate(st, {
        minAge: HACHSHARA_CI_MIN_AGE,
        maxAge: HACHSHARA_CI_MAX_ENTRY_AGE,
        minEntryDays: HACHSHARA_CI_MIN_ENTRY_DAYS,
        asOfDate: st.insuranceStartDate || ""
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
        minEntryDays: HACHSHARA_CI_MIN_ENTRY_DAYS,
        asOfDate: st?.insuranceStartDate || ""
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
          birthDate: st.birthDate, insuranceStartDate: st.insuranceStartDate || "",
          age: st.age, gender: st.gender,
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
                <input class="lcMnrCi__input lcMnrCi__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-hachci-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />
                <div class="lcMnrCi__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(ageDisplay)}</strong></div>
              </div>
              <div class="lcMnrCi__field">
                <label class="lcMnrCi__label">תחילת ביטוח</label>
                <input class="lcMnrCi__input lcMnrCi__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-hachci-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" />
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
      bindRiskSimDmyField(modal, '[data-hachci-field="birthDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val;
          st.birthDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.birthDate = val || "";
          st.birthDateSource = "manual";
          this._syncAge(st);
          st.dirtySinceSave = true;
          this._render();
        }
      });
      bindRiskSimDmyField(modal, '[data-hachci-field="insuranceStartDate"]', {
        onInput: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val;
          st.insuranceStartDateSource = "manual";
          st.dirtySinceSave = true;
        },
        onCommit: (val) => {
          const st = this._state[this._activeInsuredId];
          if(!st) return;
          st.insuranceStartDate = val || riskSimTodayDmy();
          st.insuranceStartDateSource = "manual";
          this._syncAge(st);
          st.dirtySinceSave = true;
          this._render();
        }
      });
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



  // ===== GI-MGD-SIM 2026-08-10 · סימולטורי מגדל ==================================
  function resolveMigdalInsuranceStartDate(ctx, ins){
    return resolveInsuranceStartDate(ctx, ins);
  }
  function migdalAgorotToShekels(agorot){ return agorot / 100; }
  function formatMigdalExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    return Math.trunc(ag / 100) + "." + String(Math.abs(ag % 100)).padStart(2, "0");
  }
  function migdalLookupBand(bands, age){
    const a = Number(age);
    if(!Number.isInteger(a)) return null;
    for(let i = 0; i < bands.length; i++){
      if(a >= bands[i].min && a <= bands[i].max) return bands[i];
    }
    return null;
  }

  const MIGDAL_HEALTH_MIN_AGE = 0, MIGDAL_HEALTH_MAX_AGE = 75, MIGDAL_HEALTH_MIN_ENTRY_DAYS = 0;
  const MIGDAL_HEALTH_CPI_KEY = "migdal_health";
  const MIGDAL_HEALTH_COVERS = [{"id": "drugs", "label": "תרופות מחוץ לסל", "wizardKey": "תרופות מחוץ לסל", "group": "פוליסת בריאות בסיסית", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1340}, {"min": 21, "max": 30, "agorot": 1950}, {"min": 31, "max": 40, "agorot": 2700}, {"min": 41, "max": 50, "agorot": 4340}, {"min": 51, "max": 55, "agorot": 6300}, {"min": 56, "max": 60, "agorot": 8290}, {"min": 61, "max": 65, "agorot": 11310}, {"min": 66, "max": 120, "agorot": 15090}]}, {"id": "transplant", "label": "השתלות וטיפולים מיוחדים מחוץ לישראל", "wizardKey": "השתלות וטיפולים מיוחדים מחוץ לישראל", "group": "פוליסת בריאות בסיסית", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1060}, {"min": 21, "max": 30, "agorot": 1710}, {"min": 31, "max": 40, "agorot": 1870}, {"min": 41, "max": 50, "agorot": 2210}, {"min": 51, "max": 55, "agorot": 2560}, {"min": 56, "max": 60, "agorot": 2850}, {"min": 61, "max": 65, "agorot": 3230}, {"min": 66, "max": 120, "agorot": 3340}]}, {"id": "abroad_surgery", "label": "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", "wizardKey": "ניתוחים וטיפולים מחליפי ניתוח מחוץ לישראל", "group": "פוליסת בריאות בסיסית", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 690}, {"min": 21, "max": 30, "agorot": 910}, {"min": 31, "max": 40, "agorot": 1080}, {"min": 41, "max": 50, "agorot": 1350}, {"min": 51, "max": 55, "agorot": 2230}, {"min": 56, "max": 60, "agorot": 2690}, {"min": 61, "max": 65, "agorot": 3140}, {"min": 66, "max": 120, "agorot": 3280}]}, {"id": "surgery_shaban_5000", "label": "משלים שב\"ן עם השתתפות עצמית 5,000 ₪", "wizardKey": "משלים שב\"ן עם השתתפות עצמית 5,000 ₪", "group": "ניתוחים בישראל", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1550}, {"min": 21, "max": 30, "agorot": 2930}, {"min": 31, "max": 40, "agorot": 5130}, {"min": 41, "max": 50, "agorot": 7110}, {"min": 51, "max": 55, "agorot": 11360}, {"min": 56, "max": 60, "agorot": 13820}, {"min": 61, "max": 65, "agorot": 20310}, {"min": 66, "max": 120, "agorot": 31660}]}, {"id": "surgery_shaban", "label": "משלים שב\"ן", "wizardKey": "משלים שב\"ן", "group": "ניתוחים בישראל", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1940}, {"min": 21, "max": 30, "agorot": 3660}, {"min": 31, "max": 40, "agorot": 6410}, {"min": 41, "max": 50, "agorot": 8890}, {"min": 51, "max": 55, "agorot": 14190}, {"min": 56, "max": 60, "agorot": 17280}, {"min": 61, "max": 65, "agorot": 25380}, {"min": 66, "max": 120, "agorot": 39580}]}, {"id": "surgery_first_shekel", "label": "ניתוחים בישראל מהשקל הראשון", "wizardKey": "ניתוחים בישראל מהשקל הראשון", "group": "ניתוחים בישראל", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 4330}, {"min": 21, "max": 30, "agorot": 8220}, {"min": 31, "max": 40, "agorot": 14390}, {"min": 41, "max": 50, "agorot": 19940}, {"min": 51, "max": 55, "agorot": 31050}, {"min": 56, "max": 60, "agorot": 36820}, {"min": 61, "max": 65, "agorot": 52810}, {"min": 66, "max": 120, "agorot": 78940}]}, {"id": "ambulatory_base", "label": "ייעוץ ובדיקות", "wizardKey": "ייעוץ ובדיקות", "group": "שירותים אמבולטוריים", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1820}, {"min": 21, "max": 30, "agorot": 4000}, {"min": 31, "max": 40, "agorot": 5290}, {"min": 41, "max": 50, "agorot": 5290}, {"min": 51, "max": 55, "agorot": 5290}, {"min": 56, "max": 60, "agorot": 6340}, {"min": 61, "max": 65, "agorot": 7300}, {"min": 66, "max": 70, "agorot": 9980}, {"min": 71, "max": 120, "agorot": 11510}]}, {"id": "ambulatory_extended", "label": "ייעוץ ובדיקות אבחנתיות — מורחב", "wizardKey": "ייעוץ ובדיקות אבחנתיות — מורחב", "group": "שירותים אמבולטוריים", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 2100}, {"min": 21, "max": 30, "agorot": 5810}, {"min": 31, "max": 40, "agorot": 7800}, {"min": 41, "max": 50, "agorot": 7800}, {"min": 51, "max": 55, "agorot": 7800}, {"min": 56, "max": 60, "agorot": 8020}, {"min": 61, "max": 65, "agorot": 9460}, {"min": 66, "max": 70, "agorot": 13780}, {"min": 71, "max": 120, "agorot": 16870}]}, {"id": "ambulatory_accompany", "label": "ליווי רפואי וטיפולים אגב אירוע", "wizardKey": "ליווי רפואי וטיפולים אגב אירוע", "group": "שירותים אמבולטוריים", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 940}, {"min": 21, "max": 30, "agorot": 2110}, {"min": 31, "max": 40, "agorot": 2220}, {"min": 41, "max": 50, "agorot": 2510}, {"min": 51, "max": 55, "agorot": 2590}, {"min": 56, "max": 60, "agorot": 2660}, {"min": 61, "max": 65, "agorot": 2830}, {"min": 66, "max": 70, "agorot": 3210}, {"min": 71, "max": 120, "agorot": 3210}]}, {"id": "ambulatory_tech", "label": "טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים", "wizardKey": "טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים", "group": "שירותים אמבולטוריים", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 730}, {"min": 21, "max": 30, "agorot": 1440}, {"min": 31, "max": 40, "agorot": 1750}, {"min": 41, "max": 50, "agorot": 2050}, {"min": 51, "max": 55, "agorot": 2390}, {"min": 56, "max": 60, "agorot": 2760}, {"min": 61, "max": 65, "agorot": 3660}, {"min": 66, "max": 70, "agorot": 4920}, {"min": 71, "max": 120, "agorot": 4920}]}, {"id": "fast_diagnosis", "label": "אבחון מהיר", "wizardKey": "אבחון מהיר", "group": "שירותים אמבולטוריים", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1070}, {"min": 21, "max": 30, "agorot": 2030}, {"min": 31, "max": 40, "agorot": 2030}, {"min": 41, "max": 50, "agorot": 2030}, {"min": 51, "max": 55, "agorot": 2030}, {"min": 56, "max": 60, "agorot": 2030}, {"min": 61, "max": 65, "agorot": 2030}, {"min": 66, "max": 70, "agorot": 2030}, {"min": 71, "max": 120, "agorot": 2030}]}, {"id": "treatments_general", "label": "טיפולים רפואיים — פרק א׳", "wizardKey": "טיפולים רפואיים — פרק א׳", "group": "שירותים אמבולטוריים", "needsGender": false, "bands": [{"min": 0, "max": 24, "agorot": 1410}, {"min": 25, "max": 120, "agorot": 2560}]}, {"id": "treatments_child_dev", "label": "טיפולים להתפתחות הילד", "wizardKey": "טיפולים להתפתחות הילד", "group": "שירותים אמבולטוריים", "needsGender": false, "bands": [{"min": 0, "max": 24, "agorot": 3930}, {"min": 25, "max": 120, "agorot": 1510}], "maxAge": 25}, {"id": "complementary", "label": "רפואה משלימה", "wizardKey": "רפואה משלימה", "group": "כתבי שירות", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 680}, {"min": 21, "max": 120, "agorot": 2120}]}, {"id": "online_consult", "label": "ייעוץ אונליין", "wizardKey": "ייעוץ אונליין", "group": "כתבי שירות", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1230}, {"min": 21, "max": 120, "agorot": 2330}]}, {"id": "doctor_home", "label": "רופא עד הבית", "wizardKey": "רופא עד הבית", "group": "כתבי שירות", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 970}, {"min": 21, "max": 120, "agorot": 1510}]}];
  const MIGDAL_HEALTH_COVER_BY_ID = MIGDAL_HEALTH_COVERS.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

  function computeMigdalHealthCoverPremium(coverId, age, gender){
    const cover = MIGDAL_HEALTH_COVER_BY_ID[coverId];
    if(!cover) return { ok:false, reason:"cover_missing" };
    const a = Number(age);
    if(!Number.isInteger(a)) return { ok:false, reason:"age_missing" };
    if(a < MIGDAL_HEALTH_MIN_AGE || a > MIGDAL_HEALTH_MAX_AGE) return { ok:false, reason:"age_out_of_range" };
    if(cover.maxAge != null && a > cover.maxAge) return { ok:false, reason:"age_cover_limit", coverMaxAge: cover.maxAge };
    const band = migdalLookupBand(cover.bands, a);
    if(!band || !Number.isInteger(band.agorot)) return { ok:false, reason:"rate_missing" };
    const indexed = HealthCpi.indexAgorot(band.agorot, MIGDAL_HEALTH_CPI_KEY);
    return {
      ok:true, coverId: cover.id, label: cover.label,
      baseMonthlyAgorot: indexed.baseAgorot, baseMonthlyPremium: migdalAgorotToShekels(indexed.baseAgorot),
      monthlyAgorot: indexed.indexedAgorot, monthlyPremium: migdalAgorotToShekels(indexed.indexedAgorot),
      indexFactor: indexed.factor, indexInfo: indexed.indexInfo
    };
  }
  function computeMigdalHealthBundle(selectedIds, age, gender){
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if(!ids.length) return { ok:false, reason:"covers_missing", covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
    const covers = []; let totalAg = 0, totalBaseAg = 0, indexInfo = null;
    for(let i = 0; i < ids.length; i++){
      const one = computeMigdalHealthCoverPremium(ids[i], age, gender);
      if(!one.ok) return { ok:false, reason: one.reason, failCoverId: ids[i], coverMaxAge: one.coverMaxAge, covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
      const meta = MIGDAL_HEALTH_COVER_BY_ID[one.coverId];
      if(!indexInfo) indexInfo = one.indexInfo || null;
      covers.push({ id: one.coverId, label: one.label, wizardKey: meta?.wizardKey || one.label, monthlyPremium: one.monthlyPremium, monthlyAgorot: one.monthlyAgorot, baseMonthlyPremium: one.baseMonthlyPremium, baseMonthlyAgorot: one.baseMonthlyAgorot });
      totalAg += one.monthlyAgorot; totalBaseAg += one.baseMonthlyAgorot;
    }
    return { ok:true, covers, monthlyAgorot: totalAg, monthlyPremium: migdalAgorotToShekels(totalAg), annualPremium: migdalAgorotToShekels(totalAg * 12), baseMonthlyAgorot: totalBaseAg, baseMonthlyPremium: migdalAgorotToShekels(totalBaseAg), indexFactor: indexInfo?.factor || 1, indexInfo };
  }
  function formatMigdalHealthIndexMetaHtml(indexInfo){
    if(!indexInfo) return "";
    if(!indexInfo.ok) return `<div class="lcMgdHealth__indexMeta lcMgdHealth__indexMeta--pending">ממתין למדד למ״ס — מוצגת כרגע פרמיית בסיס מהתעריפון</div>`;
    const factorTxt = (Math.round(indexInfo.factor * 10000) / 10000).toFixed(4);
    return `<div class="lcMgdHealth__indexMeta">הצמדה למדד: בסיס ${escapeHtml(String(indexInfo.baseIndexPoints))} (${escapeHtml(indexInfo.baseKnownDate || "")}) → נוכחי ≈ ${escapeHtml(String(indexInfo.currentIndexPoints))} (${escapeHtml(safeTrim(indexInfo.currentMonthLabel))}) · מקדם ×${escapeHtml(factorTxt)}</div>`;
  }
  const MIGDAL_HEALTH_MSG = {
    birth_missing:"יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young:"גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing:"יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range:`הגיל הביטוחי חורג מטווח הכניסה ${MIGDAL_HEALTH_MIN_AGE}–${MIGDAL_HEALTH_MAX_AGE}.`,
    covers_missing:"יש לסמן לפחות כיסוי אחד.",
    age_cover_limit:"הגיל חורג מהמותר לכיסוי שנבחר.",
    rate_missing:"לא נמצא תעריף מתאים לנתונים שהוזנו.",
    cover_missing:"כיסוי לא מזוהה בתעריפון."
  };

  const MigdalHealthSimulator = {
    _modal:null,_ctx:null,_state:{},_activeInsuredId:null,_escHandler:null,_confirmSwitch:null,_showFinalSummary:false,_cpiUnsub:null,
    open(ctx){
      this.close(); this._ctx = ctx || {};
      const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
      this._state = {}; insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
      this._activeInsuredId = insureds[0]?.id || null; this._confirmSwitch = null; this._showFinalSummary = false;
      this._mount(); this._render();
      this._cpiUnsub = HealthCpi.onChange(() => { if(this._modal) this._render(); });
      HealthCpi.ensure().then(() => { if(this._modal) this._render(); }).catch(() => {});
    },
    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const birthDate = safeTrim(d.birthDate || "");
      const occupation = safeTrim(d.occupation || "");
      const insuranceStartDate = resolveMigdalInsuranceStartDate(this._ctx, ins);
      const st = { birthDate, birthDateSource: birthDate ? "step1" : "", insuranceStartDate, insuranceStartDateSource: insuranceStartDate ? "ctx" : "", age:"", ageSource: birthDate ? "step1" : "", ageRaw:null, entryDays:null, gender, genderSource: gender ? "step1" : "", occupation, occupationSource: occupation ? "step1" : "", selected:{}, result:null, error:null, savedAt:null, dirtySinceSave:false };
      this._syncAge(st); return st;
    },
    _isInsuredRelevant(_ins){ return true; },
    close(){
      if(this._cpiUnsub){ try{ this._cpiUnsub(); }catch(_e){} this._cpiUnsub = null; }
      if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
      if(this._modal){ const m = this._modal; m.classList.add("giValModal--leaving"); window.setTimeout(() => m.remove(), 200); this._modal = null; }
      this._ctx = null;
    },
    _mount(){
      const modal = document.createElement("div");
      modal.id = "lcMgdHealthModal"; modal.className = "giValModal lcMgdHealthModal";
      modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-label","סימולטור בריאות מגדל");
      document.body.appendChild(modal); this._modal = modal;
      this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
      document.addEventListener("keydown", this._escHandler);
      requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
    },
    _getInsuredLabel(insId){
      const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
      return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
    },
    _selectedIds(st){ return MIGDAL_HEALTH_COVERS.map((c) => c.id).filter((id) => !!st?.selected?.[id]); },
    _syncAge(st){
      return riskSimSyncAgeFromBirthDate(st, { minAge: MIGDAL_HEALTH_MIN_AGE, maxAge: MIGDAL_HEALTH_MAX_AGE, minEntryDays: MIGDAL_HEALTH_MIN_ENTRY_DAYS, asOfDate: st?.insuranceStartDate || "" });
    },
    _recalcState(st){
      if(!st) return;
      if(!st.selected || typeof st.selected !== "object") st.selected = {};
      const ageSync = this._syncAge(st);
      const ids = this._selectedIds(st);
      if(!ids.length){ st.result = null; st.error = null; return; }
      if(!ageSync.ok){ st.result = null; st.error = MIGDAL_HEALTH_MSG[ageSync.reason] || MIGDAL_HEALTH_MSG.birth_missing; return; }
      const calc = computeMigdalHealthBundle(ids, st.age, st.gender);
      if(calc.ok){ st.result = calc; st.error = null; }
      else {
        st.result = null;
        let msg = MIGDAL_HEALTH_MSG[calc.reason] || "לא ניתן לחשב את הפרמיה.";
        if(calc.reason === "age_cover_limit" && calc.failCoverId){
          const c = MIGDAL_HEALTH_COVER_BY_ID[calc.failCoverId];
          msg = `הכיסוי "${c?.label || ""}" זמין עד גיל ${calc.coverMaxAge} בלבד.`;
        }
        st.error = msg;
      }
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
      const tabsHtml = isMulti ? `<div class="lcMgdHealth__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : "");
        return `<button type="button" class="lcMgdHealth__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-mgdh-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
      }).join("")}</div>` : "";
      const ageSync = this._syncAge(st);
      const ageHintHtml = !st.birthDate
        ? `<div class="lcMgdHealth__hint lcMgdHealth__hint--warn">${isStandalone ? "יש להזין תאריך לידה" : "לא נמצא תאריך לידה — יש להזין"}</div>`
        : (!ageSync.ok ? `<div class="lcMgdHealth__hint lcMgdHealth__hint--warn">${escapeHtml(MIGDAL_HEALTH_MSG[ageSync.reason] || "תאריך לא תקין")}</div>`
          : `<div class="lcMgdHealth__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(ageSync.age))}</strong></div>`);
      const groups = {};
      MIGDAL_HEALTH_COVERS.forEach((c) => { (groups[c.group] ||= []).push(c); });
      const coversHtml = Object.keys(groups).map((g) => `<div class="lcMgdHealth__group"><div class="lcMgdHealth__groupTitle">${escapeHtml(g)}</div><div class="lcMgdHealth__coverList">${groups[g].map((c) => {
        const checked = !!(st.selected && st.selected[c.id]);
        const one = checked ? computeMigdalHealthCoverPremium(c.id, st.age, st.gender) : null;
        const premTxt = one?.ok ? `₪${formatMigdalExactAmount(one.monthlyPremium)}` : (checked && one && !one.ok ? "—" : "");
        return `<label class="lcMgdHealth__cover${checked ? " is-checked" : ""}"><input type="checkbox" data-mgdh-cover="${escapeHtml(c.id)}"${checked ? " checked" : ""} /><span class="lcMgdHealth__coverLabel">${escapeHtml(c.label)}${c.maxAge != null ? ` <em>(עד גיל ${c.maxAge})</em>` : ""}</span><span class="lcMgdHealth__coverPrem">${premTxt}</span></label>`;
      }).join("")}</div></div>`).join("");
      const selectedRows = (st.result?.covers || []).map((c) => `<div class="lcMgdHealth__selRow"><span>${escapeHtml(c.label)}</span><strong>₪${escapeHtml(formatMigdalExactAmount(c.monthlyPremium))}</strong></div>`).join("");
      const indexMetaHtml = formatMigdalHealthIndexMetaHtml(st.result?.indexInfo || HealthCpi.getIndexInfo(MIGDAL_HEALTH_CPI_KEY));
      const baseTotalHtml = (st.result?.ok && st.result.baseMonthlyPremium != null && Math.abs(st.result.baseMonthlyPremium - st.result.monthlyPremium) > 0.0001)
        ? `<div class="lcMgdHealth__resultRow"><span>פרמיית בסיס (לפני מדד)</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.baseMonthlyPremium))}</strong></div>` : "";
      const resultHtml = st.error
        ? `<div class="lcMgdHealth__result lcMgdHealth__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcMgdHealth__result lcMgdHealth__result--ok"><div class="lcMgdHealth__selTitle">כיסויים שנבחרו</div>${selectedRows}${baseTotalHtml}<div class="lcMgdHealth__resultRow lcMgdHealth__resultRow--main"><span>סה״כ פרמיה חודשית (צמודה למדד)</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.monthlyPremium))}</strong></div><div class="lcMgdHealth__resultRow"><span>סה״כ פרמיה שנתית</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.annualPremium))}</strong></div>${indexMetaHtml}</div>`
          : `<div class="lcMgdHealth__result lcMgdHealth__result--empty">סמנו כיסויים כדי לראות פרמיה</div>`);
      const occBlockHtml = renderOccupationRiskBlockHtml(assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product), "lcMgdHealth");
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company) ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini") : "✚";
      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
      const footHtml = isStandalone
        ? `<div class="giValModal__foot lcMgdHealth__foot"><button type="button" class="btn btn--primary" data-mgdh-close="1">סגור</button></div>`
        : (!isMulti
          ? `<div class="giValModal__foot lcMgdHealth__foot"><button type="button" class="btn giValModal__closeBtn" data-mgdh-close="1">ביטול</button><button type="button" class="btn btn--primary" data-mgdh-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button></div>`
          : `<div class="giValModal__foot lcMgdHealth__foot"><button type="button" class="btn giValModal__closeBtn" data-mgdh-close="1">ביטול</button><button type="button" class="btn btn--secondary" data-mgdh-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button><button type="button" class="btn btn--primary" data-mgdh-finalconfirm="1"${allSaved ? "" : " disabled"}>אישור סופי</button></div>`);
      const confirmOverlayHtml = this._confirmSwitch ? `<div class="lcMgdHealth__overlay"><div class="lcMgdHealth__overlayCard"><div class="lcMgdHealth__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div><div class="lcMgdHealth__overlayBtns"><button type="button" class="btn btn--primary" data-mgdh-switch="save">שמור ועבור</button><button type="button" class="btn btn--secondary" data-mgdh-switch="discard">עבור ללא שמירה</button><button type="button" class="btn" data-mgdh-switch="cancel">ביטול</button></div></div></div>` : "";
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-mgdh-close="1"></div><div class="giValModal__card lcMgdHealth__card"><div class="giValModal__head"><span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span><div class="giValModal__headText"><div class="giValModal__title">סימולטור בריאות מגדל</div></div><button type="button" class="lcMgdHealth__closeX" data-mgdh-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body lcMgdHealth__body">${tabsHtml}${isStandalone ? `<div class="lcMgdHealth__insuredLabel lcMgdHealth__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>` : `<div class="lcMgdHealth__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}<div class="lcMgdHealth__grid"><div class="lcMgdHealth__field"><label class="lcMgdHealth__label">תאריך לידה</label><input class="lcMgdHealth__input lcMgdHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mgdh-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />${ageHintHtml}</div><div class="lcMgdHealth__field"><label class="lcMgdHealth__label">תחילת ביטוח</label><input class="lcMgdHealth__input lcMgdHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-mgdh-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" /></div><div class="lcMgdHealth__field"><label class="lcMgdHealth__label">מין</label><div class="lcMgdHealth__segmented"><button type="button" class="lcMgdHealth__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-mgdh-field="gender" data-mgdh-value="זכר">זכר</button><button type="button" class="lcMgdHealth__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-mgdh-field="gender" data-mgdh-value="נקבה">נקבה</button></div></div><div class="lcMgdHealth__field lcMgdHealth__field--wide"><label class="lcMgdHealth__label">עיסוק</label><input class="lcMgdHealth__input" type="text" data-mgdh-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס" autocomplete="off" /></div></div><div class="lcMgdHealth__coversTitle">בחירת כיסויים <span class="lcMgdHealth__coversCount">(${MIGDAL_HEALTH_COVERS.length})</span></div><div class="lcMgdHealth__coversWrap">${coversHtml}</div>${occBlockHtml}${resultHtml}</div>${footHtml}${confirmOverlayHtml}</div>`;
      this._bind();
    },
    _renderFinalSummary(insureds){
      const rows = insureds.filter((ins) => this._isInsuredRelevant(ins)).map((ins) => {
        const ok = !!this._state[ins.id]?.savedAt;
        return `<div class="lcMgdHealth__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-mgdh-close="1"></div><div class="giValModal__card lcMgdHealth__card"><div class="giValModal__head"><div class="giValModal__headText"><div class="giValModal__title">סיכום סימולטור להצעה</div></div><button type="button" class="lcMgdHealth__closeX" data-mgdh-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body lcMgdHealth__body">${rows}</div><div class="giValModal__foot lcMgdHealth__foot"><button type="button" class="btn giValModal__closeBtn" data-mgdh-summary-back="1">חזרה</button><button type="button" class="btn btn--primary" data-mgdh-summary-confirm="1">אישור סופי</button></div></div>`;
      this._bind();
    },
    _bind(){
      const modal = this._modal; if(!modal) return;
      ensureSegFieldDelegation(modal, this, "mgdh");
      $$("[data-mgdh-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-mgdh-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-mgdh-tab"))));
      $$("[data-mgdh-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-mgdh-switch"); const target = this._confirmSwitch?.targetId; this._confirmSwitch = null;
        if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); }
        else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); }
        else this._render();
      }));
      bindRiskSimDmyField(modal, '[data-mgdh-field="birthDate"]', {
        onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.dirtySinceSave = true; },
        onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.ageSource = "manual"; st.dirtySinceSave = true; this._syncAge(st); this._render(); }
      });
      bindRiskSimDmyField(modal, '[data-mgdh-field="insuranceStartDate"]', {
        onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val; st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; },
        onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val || riskSimTodayDmy(); st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; this._syncAge(st); this._render(); }
      });
      const occInput = modal.querySelector('[data-mgdh-field="occupation"]');
      if(occInput){
        on(occInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; st.occupation = safeTrim(occInput.value); st.occupationSource = "manual"; st.dirtySinceSave = true; });
        on(occInput, "change", () => this._render()); on(occInput, "blur", () => this._render());
      }
      $$("[data-mgdh-cover]", modal).forEach((el) => on(el, "change", () => {
        const st = this._state[this._activeInsuredId]; if(!st) return;
        if(!st.selected || typeof st.selected !== "object") st.selected = {};
        st.selected[el.getAttribute("data-mgdh-cover")] = !!el.checked; st.dirtySinceSave = true; this._render();
      }));
      const applyBtn = modal.querySelector("[data-mgdh-apply]"); if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-mgdh-save]"); if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-mgdh-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => {
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        if(!(relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt))){
          window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור את הסימולטור עבור כל המבוטחים הרלוונטיים לפני האישור הסופי.", variant: "warn" }); return;
        }
        this._showFinalSummary = true; this._render();
      });
      const summaryBackBtn = modal.querySelector("[data-mgdh-summary-back]"); if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-mgdh-summary-confirm]"); if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => { try{ this._ctx?.onFinalConfirm?.(); }catch(_e){} this.close(); });
    },
    _switchInsured(targetId){
      if(!targetId || targetId === this._activeInsuredId) return;
      if(this._state[this._activeInsuredId]?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; }
      this._activeInsuredId = targetId; this._render();
    },
    _buildResultForInsured(insId){
      const st = this._state[insId]; this._recalcState(st); if(!st?.result?.ok) return null;
      return { covers: st.result.covers.map((c) => ({ id:c.id, label:c.label, wizardKey:c.wizardKey || c.label, monthlyPremium:c.monthlyPremium })), monthlyPremium: st.result.monthlyPremium, annualPremium: st.result.annualPremium, monthlyAgorot: st.result.monthlyAgorot, birthDate: st.birthDate || "", birthDateSource: st.birthDateSource || "", insuranceStartDate: st.insuranceStartDate || "", age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource, occupation: st.occupation || "", occupationSource: st.occupationSource || "" };
    },
    _apply(){
      const results = {}; Object.keys(this._state).forEach((insId) => { const r = this._buildResultForInsured(insId); if(r) results[insId] = r; });
      if(!Object.keys(results).length){ window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לבחור כיסויים ולחשב פרמיה לפני ההחלה על הפוליסה.", variant: "warn" }); return; }
      const onApply = this._ctx?.onApply; this.close(); try{ onApply?.(results); }catch(_e){}
    },
    _saveActive(){
      const insId = this._activeInsuredId; const result = this._buildResultForInsured(insId);
      if(!result){ window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לבחור כיסויים תקינים לפני השמירה.", variant: "warn" }); return; }
      try{ this._ctx?.onApply?.({ [insId]: result }); }catch(_e){}
      const st = this._state[insId]; if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
      window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
      this._render();
    }
  };
  RiskSimulators.register("מגדל", "בריאות", MigdalHealthSimulator);

  const MIGDAL_CI_MIN_AGE = 0, MIGDAL_CI_MAX_ENTRY_AGE = 65, MIGDAL_CI_MIN_ENTRY_DAYS = 0;
  const MIGDAL_CI_MIN_SUM = 50000, MIGDAL_CI_MAX_SUM = 700000;
  const MIGDAL_CI_RATE_MAPS = { mazor_merchav: {"0": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "1": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "2": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "3": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "4": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "5": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "6": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "7": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "8": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "9": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "10": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "11": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "12": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "13": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "14": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "15": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "16": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "17": {"mNS": 587, "fNS": 587, "mS": 587, "fS": 587}, "18": {"mNS": 1451, "fNS": 1406, "mS": 1749, "fS": 1430}, "19": {"mNS": 1497, "fNS": 1456, "mS": 1802, "fS": 1484}, "20": {"mNS": 1563, "fNS": 1538, "mS": 1882, "fS": 1569}, "21": {"mNS": 1638, "fNS": 1643, "mS": 1977, "fS": 1679}, "22": {"mNS": 1724, "fNS": 1777, "mS": 2078, "fS": 1812}, "23": {"mNS": 1795, "fNS": 1891, "mS": 2160, "fS": 1931}, "24": {"mNS": 1885, "fNS": 2056, "mS": 2294, "fS": 2099}, "25": {"mNS": 1974, "fNS": 2228, "mS": 2424, "fS": 2272}, "26": {"mNS": 2086, "fNS": 2373, "mS": 2583, "fS": 2464}, "27": {"mNS": 2191, "fNS": 2591, "mS": 2737, "fS": 2777}, "28": {"mNS": 2278, "fNS": 2875, "mS": 2910, "fS": 3173}, "29": {"mNS": 2332, "fNS": 3145, "mS": 3083, "fS": 3561}, "30": {"mNS": 2411, "fNS": 3442, "mS": 3312, "fS": 4003}, "31": {"mNS": 2511, "fNS": 3811, "mS": 3582, "fS": 4484}, "32": {"mNS": 2673, "fNS": 4123, "mS": 3944, "fS": 4885}, "33": {"mNS": 2910, "fNS": 4431, "mS": 4377, "fS": 5298}, "34": {"mNS": 3254, "fNS": 4754, "mS": 4904, "fS": 5754}, "35": {"mNS": 3650, "fNS": 5083, "mS": 5355, "fS": 6215}, "36": {"mNS": 4101, "fNS": 5455, "mS": 5793, "fS": 6601}, "37": {"mNS": 4517, "fNS": 5787, "mS": 6639, "fS": 7063}, "38": {"mNS": 5002, "fNS": 6128, "mS": 7625, "fS": 7543}, "39": {"mNS": 5459, "fNS": 6512, "mS": 8592, "fS": 8040}, "40": {"mNS": 5920, "fNS": 6927, "mS": 9750, "fS": 8588}, "41": {"mNS": 6580, "fNS": 7344, "mS": 11134, "fS": 9321}, "42": {"mNS": 7374, "fNS": 7868, "mS": 12224, "fS": 10071}, "43": {"mNS": 8166, "fNS": 8427, "mS": 13284, "fS": 10895}, "44": {"mNS": 9175, "fNS": 9023, "mS": 14669, "fS": 11789}, "45": {"mNS": 10353, "fNS": 9663, "mS": 16299, "fS": 12753}, "46": {"mNS": 11469, "fNS": 10316, "mS": 18054, "fS": 13745}, "47": {"mNS": 13013, "fNS": 10983, "mS": 20765, "fS": 14788}, "48": {"mNS": 14721, "fNS": 11688, "mS": 23767, "fS": 15906}, "49": {"mNS": 16563, "fNS": 12395, "mS": 27018, "fS": 17113}, "50": {"mNS": 18503, "fNS": 13115, "mS": 30457, "fS": 18415}, "51": {"mNS": 20550, "fNS": 13886, "mS": 34109, "fS": 19840}, "52": {"mNS": 22441, "fNS": 14708, "mS": 37244, "fS": 21377}, "53": {"mNS": 24459, "fNS": 15563, "mS": 40591, "fS": 23034}, "54": {"mNS": 26569, "fNS": 16455, "mS": 44092, "fS": 24815}, "55": {"mNS": 28820, "fNS": 17432, "mS": 47831, "fS": 26729}, "56": {"mNS": 31208, "fNS": 18449, "mS": 51794, "fS": 28732}, "57": {"mNS": 33781, "fNS": 19562, "mS": 56064, "fS": 30893}, "58": {"mNS": 36625, "fNS": 20781, "mS": 60782, "fS": 33233}, "59": {"mNS": 39685, "fNS": 22116, "mS": 65857, "fS": 35774}, "60": {"mNS": 43057, "fNS": 23526, "mS": 71455, "fS": 38503}, "61": {"mNS": 45986, "fNS": 25073, "mS": 76492, "fS": 41438}, "62": {"mNS": 48570, "fNS": 26672, "mS": 81926, "fS": 44513}, "63": {"mNS": 51337, "fNS": 28337, "mS": 87790, "fS": 47716}, "64": {"mNS": 57777, "fNS": 30068, "mS": 94117, "fS": 51013}, "65": {"mNS": 64561, "fNS": 30086, "mS": 100185, "fS": 51330}}, mazor_cancer: {"0": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "1": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "2": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "3": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "4": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "5": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "6": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "7": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "8": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "9": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "10": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "11": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "12": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "13": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "14": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "15": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "16": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "17": {"mNS": 430, "fNS": 430, "mS": 430, "fS": 430}, "18": {"mNS": 650, "fNS": 550, "mS": 880, "fS": 710}, "19": {"mNS": 670, "fNS": 580, "mS": 890, "fS": 750}, "20": {"mNS": 690, "fNS": 610, "mS": 920, "fS": 780}, "21": {"mNS": 730, "fNS": 680, "mS": 960, "fS": 880}, "22": {"mNS": 760, "fNS": 740, "mS": 990, "fS": 950}, "23": {"mNS": 790, "fNS": 820, "mS": 1030, "fS": 1040}, "24": {"mNS": 830, "fNS": 910, "mS": 1050, "fS": 1150}, "25": {"mNS": 860, "fNS": 1010, "mS": 1080, "fS": 1280}, "26": {"mNS": 900, "fNS": 1130, "mS": 1130, "fS": 1420}, "27": {"mNS": 950, "fNS": 1260, "mS": 1180, "fS": 1580}, "28": {"mNS": 1010, "fNS": 1410, "mS": 1250, "fS": 1750}, "29": {"mNS": 1070, "fNS": 1580, "mS": 1330, "fS": 1940}, "30": {"mNS": 1130, "fNS": 1760, "mS": 1400, "fS": 2160}, "31": {"mNS": 1190, "fNS": 1960, "mS": 1520, "fS": 2390}, "32": {"mNS": 1260, "fNS": 2180, "mS": 1640, "fS": 2640}, "33": {"mNS": 1330, "fNS": 2410, "mS": 1780, "fS": 2920}, "34": {"mNS": 1390, "fNS": 2650, "mS": 1930, "fS": 3200}, "35": {"mNS": 1470, "fNS": 2880, "mS": 2070, "fS": 3490}, "36": {"mNS": 1540, "fNS": 3110, "mS": 2210, "fS": 3770}, "37": {"mNS": 1630, "fNS": 3300, "mS": 2360, "fS": 4030}, "38": {"mNS": 1720, "fNS": 3480, "mS": 2520, "fS": 4280}, "39": {"mNS": 1810, "fNS": 3670, "mS": 2700, "fS": 4540}, "40": {"mNS": 2060, "fNS": 4100, "mS": 3100, "fS": 5120}, "41": {"mNS": 2220, "fNS": 4420, "mS": 3380, "fS": 5590}, "42": {"mNS": 2410, "fNS": 4830, "mS": 3700, "fS": 6200}, "43": {"mNS": 2620, "fNS": 5330, "mS": 4070, "fS": 6930}, "44": {"mNS": 2840, "fNS": 5880, "mS": 4460, "fS": 7730}, "45": {"mNS": 3100, "fNS": 6430, "mS": 4900, "fS": 8570}, "46": {"mNS": 3350, "fNS": 6950, "mS": 5400, "fS": 9380}, "47": {"mNS": 3620, "fNS": 7430, "mS": 5950, "fS": 10170}, "48": {"mNS": 3920, "fNS": 7860, "mS": 6580, "fS": 10910}, "49": {"mNS": 4280, "fNS": 8280, "mS": 7340, "fS": 11640}, "50": {"mNS": 4810, "fNS": 8850, "mS": 8470, "fS": 12630}, "51": {"mNS": 5480, "fNS": 9350, "mS": 9510, "fS": 13490}, "52": {"mNS": 6320, "fNS": 9930, "mS": 10810, "fS": 14430}, "53": {"mNS": 7380, "fNS": 10730, "mS": 12430, "fS": 15450}, "54": {"mNS": 8660, "fNS": 11580, "mS": 14360, "fS": 16530}, "55": {"mNS": 10210, "fNS": 12490, "mS": 16680, "fS": 17620}, "56": {"mNS": 11900, "fNS": 13440, "mS": 19190, "fS": 18690}, "57": {"mNS": 13730, "fNS": 14400, "mS": 21900, "fS": 19740}, "58": {"mNS": 15680, "fNS": 15380, "mS": 24740, "fS": 20740}, "59": {"mNS": 17670, "fNS": 16360, "mS": 27610, "fS": 21680}, "60": {"mNS": 21220, "fNS": 18710, "mS": 32890, "fS": 24350}, "61": {"mNS": 23050, "fNS": 19510, "mS": 35750, "fS": 25400}, "62": {"mNS": 24730, "fNS": 20240, "mS": 38410, "fS": 26360}, "63": {"mNS": 26290, "fNS": 20900, "mS": 40880, "fS": 27230}, "64": {"mNS": 27730, "fNS": 21510, "mS": 43170, "fS": 28030}, "65": {"mNS": 29870, "fNS": 21720, "mS": 46880, "fS": 28290}} };
  const MIGDAL_CI_PLANS = {
    mazor_merchav: { planId:"mazor_merchav", title:"סימולטור מחלות קשות מגדל · מזור מורחב", subtitle:"פרמיה חודשית ל־₪100,000", pdfName:"מזור מורחב", wizardCoverKey:"מחלות קשות", cssPrefix:"lcMgdCi", modalClass:"lcMgdCiModal", fieldPrefix:"mgdci", rateMapKey:"mazor_merchav", amountField:"migdalCriticalAmount" },
    mazor_cancer: { planId:"mazor_cancer", title:"סימולטור סרטן מגדל · מזור לסרטן", subtitle:"פרמיה חודשית ל־₪100,000", pdfName:"מזור לסרטן", wizardCoverKey:"סרטן", cssPrefix:"lcMgdCi", modalClass:"lcMgdCiModal", fieldPrefix:"mgdca", rateMapKey:"mazor_cancer", amountField:"migdalCancerAmount" }
  };
  function lookupMigdalCiRate(planId, { age, gender, smoker }){
    const plan = MIGDAL_CI_PLANS[planId]; if(!plan) return { ok:false, reason:"rate_missing" };
    const ageNum = Number(age); if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    if(ageNum < MIGDAL_CI_MIN_AGE || ageNum > MIGDAL_CI_MAX_ENTRY_AGE) return { ok:false, reason:"age_out_of_range" };
    const row = MIGDAL_CI_RATE_MAPS[plan.rateMapKey]?.[String(ageNum)]; if(!row) return { ok:false, reason:"age_out_of_range" };
    if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const key = gender === "זכר" ? (smoker ? "mS" : "mNS") : (smoker ? "fS" : "fNS");
    const rateAgorot = row[key]; if(rateAgorot == null || !Number.isInteger(rateAgorot)) return { ok:false, reason:"rate_missing" };
    return { ok:true, rateAgorot, ratePerHundredThousand: migdalAgorotToShekels(rateAgorot) };
  }
  function computeMigdalCiPremium(planId, { age, gender, smoker, compensation }){
    const plan = MIGDAL_CI_PLANS[planId]; if(!plan) return { ok:false, reason:"rate_missing" };
    const sum = Number(String(compensation == null ? "" : compensation).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    if(sum < MIGDAL_CI_MIN_SUM) return { ok:false, reason:"sum_too_low", minSum: MIGDAL_CI_MIN_SUM };
    if(sum > MIGDAL_CI_MAX_SUM) return { ok:false, reason:"sum_too_high", maxSum: MIGDAL_CI_MAX_SUM };
    const rate = lookupMigdalCiRate(planId, { age, gender, smoker }); if(!rate.ok) return rate;
    const monthlyAgorot = Math.round(rate.rateAgorot * (sum / 100000));
    return { ok:true, monthlyAgorot, monthlyPremium: migdalAgorotToShekels(monthlyAgorot), annualPremium: migdalAgorotToShekels(monthlyAgorot * 12), ratePerHundredThousand: rate.ratePerHundredThousand, compensation: sum, pdfName: plan.pdfName, planId: plan.planId, wizardCoverKey: plan.wizardCoverKey };
  }
  const MIGDAL_CI_MSG = {
    birth_missing:"יש לבחור תאריך לידה לפני חישוב הפרמיה.", entry_too_young:"גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing:"יש לבחור תאריך לידה לפני חישוב הפרמיה.", age_out_of_range:`הגיל הביטוחי חורג מטווח הכניסה ${MIGDAL_CI_MIN_AGE}–${MIGDAL_CI_MAX_ENTRY_AGE}.`,
    gender_missing:"יש לבחור מין.", smoker_missing:"יש לבחור סטטוס עישון.", sum_missing:"יש להזין סכום פיצוי.",
    sum_too_low:"סכום הפיצוי המינימלי הוא ₪50,000.", sum_too_high:"סכום הפיצוי המקסימלי הוא ₪700,000.", rate_missing:"לא נמצא תעריף מתאים."
  };
  function createMigdalCiSimulator(planId){
    const plan = MIGDAL_CI_PLANS[planId]; const P = plan.cssPrefix; const FP = plan.fieldPrefix;
    return {
      _planId:planId,_modal:null,_ctx:null,_state:{},_activeInsuredId:null,_escHandler:null,_confirmSwitch:null,_showFinalSummary:false,
      open(ctx){ this.close(); this._ctx = ctx || {}; const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : []; this._state = {}; insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); }); this._activeInsuredId = insureds[0]?.id || null; this._confirmSwitch = null; this._showFinalSummary = false; this._mount(); this._render(); },
      _prefillFromInsured(ins){
        const d = ins?.data || {};
        const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
        const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : ((d.smoker === true || d.smoker === false) ? d.smoker : null));
        const birthDate = safeTrim(d.birthDate || ""); const occupation = safeTrim(d.occupation || "");
        const insuranceStartDate = resolveMigdalInsuranceStartDate(this._ctx, ins);
        const compensation = safeTrim(d[plan.amountField] || d.compensation || "") || "100000";
        const st = { birthDate, birthDateSource: birthDate ? "step1" : "", insuranceStartDate, insuranceStartDateSource: insuranceStartDate ? "ctx" : "", age:"", ageSource: birthDate ? "step1" : "", ageRaw:null, entryDays:null, gender, genderSource: gender ? "step1" : "", smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "", occupation, occupationSource: occupation ? "step1" : "", compensation, result:null, error:null, savedAt:null, dirtySinceSave:false };
        this._syncAge(st); return st;
      },
      _syncAge(st){ return riskSimSyncAgeFromBirthDate(st, { minAge: MIGDAL_CI_MIN_AGE, maxAge: MIGDAL_CI_MAX_ENTRY_AGE, minEntryDays: MIGDAL_CI_MIN_ENTRY_DAYS, asOfDate: st?.insuranceStartDate || "" }); },
      _isInsuredRelevant(_ins){ return true; },
      close(){ if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; } if(this._modal){ const m = this._modal; m.classList.add("giValModal--leaving"); window.setTimeout(() => m.remove(), 200); this._modal = null; } this._ctx = null; },
      _mount(){ const modal = document.createElement("div"); modal.id = "lcMgdCiModal_" + planId; modal.className = "giValModal " + plan.modalClass; modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-label", plan.title); document.body.appendChild(modal); this._modal = modal; this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); }; document.addEventListener("keydown", this._escHandler); requestAnimationFrame(() => modal.classList.add("giValModal--visible")); },
      _getInsuredLabel(insId){ const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId); return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח"; },
      _calc(insId){
        const st = this._state[insId]; if(!st) return;
        const ageSync = this._syncAge(st);
        if(!ageSync.ok){ st.result = null; st.error = MIGDAL_CI_MSG[ageSync.reason] || MIGDAL_CI_MSG.birth_missing; this._render(); return; }
        const calc = computeMigdalCiPremium(planId, { age: st.age, gender: st.gender, smoker: st.smoker, compensation: st.compensation });
        if(calc.ok){ st.result = calc; st.error = null; }
        else { st.result = null; let msg = MIGDAL_CI_MSG[calc.reason] || "לא ניתן לחשב את הפרמיה."; if(calc.reason === "sum_too_low") msg = `סכום הפיצוי המינימלי הוא ₪${formatRiskSimSumInsuredDigits(calc.minSum)}.`; if(calc.reason === "sum_too_high") msg = `סכום הפיצוי המקסימלי הוא ₪${formatRiskSimSumInsuredDigits(calc.maxSum)}.`; st.error = msg; }
        this._render();
      },
      _render(){
        if(!this._modal) return;
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const isMulti = insureds.length > 1;
        if(this._showFinalSummary){ this._renderFinalSummary(insureds); return; }
        const activeId = this._activeInsuredId; const st = this._state[activeId] || this._prefillFromInsured(null); const isStandalone = !!this._ctx?.standalone;
        const tabsHtml = isMulti ? `<div class="${P}__tabs">${insureds.map((ins) => { const s = this._state[ins.id]; const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : ""); return `<button type="button" class="${P}__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-${FP}-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`; }).join("")}</div>` : "";
        const ageSync = this._syncAge(st);
        const ageHintHtml = !st.birthDate ? `<div class="${P}__hint ${P}__hint--warn">${isStandalone ? "יש להזין תאריך לידה" : "לא נמצא תאריך לידה — יש להזין"}</div>` : (!ageSync.ok ? `<div class="${P}__hint ${P}__hint--warn">${escapeHtml(MIGDAL_CI_MSG[ageSync.reason] || "תאריך לא תקין")}</div>` : `<div class="${P}__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(ageSync.age))}</strong></div>`);
        const genderHintHtml = (isStandalone || st.gender) ? "" : `<div class="${P}__hint ${P}__hint--warn">יש לבחור מין</div>`;
        const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false) ? "" : `<div class="${P}__hint ${P}__hint--warn">יש לבחור סטטוס עישון</div>`;
        const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company) ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini") : "✚";
        const occBlockHtml = renderOccupationRiskBlockHtml(assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product), P);
        const resultHtml = st.error ? `<div class="${P}__result ${P}__result--error">${escapeHtml(st.error)}</div>` : (st.result ? `<div class="${P}__result ${P}__result--ok"><div class="${P}__resultRow"><span>מסלול</span><strong>${escapeHtml(st.result.pdfName)}</strong></div><div class="${P}__resultRow"><span>תעריף ל-₪100,000</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.ratePerHundredThousand))}</strong></div><div class="${P}__resultRow"><span>סכום פיצוי</span><strong>₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.compensation))}</strong></div><div class="${P}__resultRow ${P}__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.monthlyPremium))}</strong></div><div class="${P}__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.annualPremium))}</strong></div></div>` : `<div class="${P}__result ${P}__result--empty">מלאו את השדות ולחצו "חשב פרמיה"</div>`);
        const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
        const footHtml = isStandalone ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn btn--primary" data-${FP}-close="1">סגור</button></div>` : (!isMulti ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-close="1">ביטול</button><button type="button" class="btn btn--primary" data-${FP}-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button></div>` : `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-close="1">ביטול</button><button type="button" class="btn btn--secondary" data-${FP}-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button><button type="button" class="btn btn--primary" data-${FP}-finalconfirm="1"${allSaved ? "" : " disabled"}>אישור סופי</button></div>`);
        const confirmOverlayHtml = this._confirmSwitch ? `<div class="${P}__overlay"><div class="${P}__overlayCard"><div class="${P}__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}.</div><div class="${P}__overlayBtns"><button type="button" class="btn btn--primary" data-${FP}-switch="save">שמור ועבור</button><button type="button" class="btn btn--secondary" data-${FP}-switch="discard">עבור ללא שמירה</button><button type="button" class="btn" data-${FP}-switch="cancel">ביטול</button></div></div></div>` : "";
        this._modal.innerHTML = `<div class="giValModal__backdrop" data-${FP}-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span><div class="giValModal__headText"><div class="giValModal__title">${escapeHtml(plan.title)}</div><div class="giValModal__sub">${escapeHtml(plan.subtitle)}</div></div><button type="button" class="${P}__closeX" data-${FP}-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${tabsHtml}${isStandalone ? `<div class="${P}__insuredLabel ${P}__insuredLabel--standalone">מצב חישוב עצמאי</div>` : `<div class="${P}__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}<div class="${P}__grid"><div class="${P}__field"><label class="${P}__label">תאריך לידה</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-${FP}-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />${ageHintHtml}</div><div class="${P}__field"><label class="${P}__label">תחילת ביטוח</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-${FP}-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" /></div><div class="${P}__field"><label class="${P}__label">מין</label><div class="${P}__segmented"><button type="button" class="${P}__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-${FP}-field="gender" data-${FP}-value="זכר">זכר</button><button type="button" class="${P}__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-${FP}-field="gender" data-${FP}-value="נקבה">נקבה</button></div>${genderHintHtml}</div><div class="${P}__field"><label class="${P}__label">עישון</label><div class="${P}__segmented"><button type="button" class="${P}__segBtn${st.smoker === false ? " is-active" : ""}" data-${FP}-field="smoker" data-${FP}-value="0">לא מעשן/ת</button><button type="button" class="${P}__segBtn${st.smoker === true ? " is-active" : ""}" data-${FP}-field="smoker" data-${FP}-value="1">מעשן/ת</button></div>${smokerHintHtml}</div><div class="${P}__field"><label class="${P}__label">סכום פיצוי (₪${formatRiskSimSumInsuredDigits(MIGDAL_CI_MIN_SUM)}–₪${formatRiskSimSumInsuredDigits(MIGDAL_CI_MAX_SUM)})</label><input class="${P}__input" type="text" inputmode="numeric" data-${FP}-field="compensation" value="${escapeHtml(st.compensation || "")}" placeholder="100,000" /></div><div class="${P}__field ${P}__field--wide"><label class="${P}__label">עיסוק</label><input class="${P}__input" type="text" data-${FP}-field="occupation" value="${escapeHtml(st.occupation || "")}" autocomplete="off" /></div></div><div class="${P}__actions"><button type="button" class="btn btn--primary" data-${FP}-calc="1">חשב פרמיה</button></div>${occBlockHtml}${resultHtml}</div>${footHtml}${confirmOverlayHtml}</div>`;
        this._bind();
      },
      _renderFinalSummary(insureds){
        const rows = insureds.filter((ins) => this._isInsuredRelevant(ins)).map((ins) => { const ok = !!this._state[ins.id]?.savedAt; return `<div class="${P}__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`; }).join("");
        this._modal.innerHTML = `<div class="giValModal__backdrop" data-${FP}-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><div class="giValModal__headText"><div class="giValModal__title">סיכום סימולטור להצעה</div></div><button type="button" class="${P}__closeX" data-${FP}-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${rows}</div><div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-summary-back="1">חזרה</button><button type="button" class="btn btn--primary" data-${FP}-summary-confirm="1">אישור סופי</button></div></div>`;
        this._bind();
      },
      _bind(){
        const modal = this._modal; if(!modal) return;
        ensureSegFieldDelegation(modal, this, FP);
        $$(`[data-${FP}-close]`, modal).forEach((el) => on(el, "click", () => this.close()));
        $$(`[data-${FP}-tab]`, modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute(`data-${FP}-tab`))));
        $$(`[data-${FP}-switch]`, modal).forEach((el) => on(el, "click", () => { const action = el.getAttribute(`data-${FP}-switch`); const target = this._confirmSwitch?.targetId; this._confirmSwitch = null; if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); } else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); } else this._render(); }));
        bindRiskSimDmyField(modal, `[data-${FP}-field="birthDate"]`, { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.ageSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
        bindRiskSimDmyField(modal, `[data-${FP}-field="insuranceStartDate"]`, { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val; st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val || riskSimTodayDmy(); st.insuranceStartDateSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
        const sumInput = modal.querySelector(`[data-${FP}-field="compensation"]`);
        if(sumInput) on(sumInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; const formatted = formatRiskSimSumInsuredDigits(sumInput.value); sumInput.value = formatted; try{ sumInput.setSelectionRange(formatted.length, formatted.length); }catch(_e){} st.compensation = formatted; st.result = null; st.error = null; st.dirtySinceSave = true; });
        const occInput = modal.querySelector(`[data-${FP}-field="occupation"]`);
        if(occInput){ on(occInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; st.occupation = safeTrim(occInput.value); st.occupationSource = "manual"; st.dirtySinceSave = true; }); on(occInput, "change", () => this._render()); on(occInput, "blur", () => this._render()); }
        const calcBtn = modal.querySelector(`[data-${FP}-calc]`); if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
        const applyBtn = modal.querySelector(`[data-${FP}-apply]`); if(applyBtn) on(applyBtn, "click", () => this._apply());
        const saveBtn = modal.querySelector(`[data-${FP}-save]`); if(saveBtn) on(saveBtn, "click", () => this._saveActive());
        const finalBtn = modal.querySelector(`[data-${FP}-finalconfirm]`);
        if(finalBtn) on(finalBtn, "click", () => { const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins)); if(!(relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt))){ window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור לפני אישור סופי.", variant: "warn" }); return; } this._showFinalSummary = true; this._render(); });
        const summaryBackBtn = modal.querySelector(`[data-${FP}-summary-back]`); if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
        const summaryConfirmBtn = modal.querySelector(`[data-${FP}-summary-confirm]`); if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => { try{ this._ctx?.onFinalConfirm?.(); }catch(_e){} this.close(); });
      },
      _switchInsured(targetId){ if(!targetId || targetId === this._activeInsuredId) return; if(this._state[this._activeInsuredId]?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; } this._activeInsuredId = targetId; this._render(); },
      _buildResultForInsured(insId){
        const st = this._state[insId]; if(!st) return null; if(!this._syncAge(st).ok) return null;
        if(!st.result?.ok){ const calc = computeMigdalCiPremium(planId, { age: st.age, gender: st.gender, smoker: st.smoker, compensation: st.compensation }); if(!calc.ok) return null; st.result = calc; st.error = null; }
        const r = st.result;
        return { compensation: formatRiskSimSumInsuredDigits(r.compensation), monthlyPremium: r.monthlyPremium, annualPremium: r.annualPremium, ratePerHundredThousand: r.ratePerHundredThousand, pdfName: r.pdfName, planId: r.planId, wizardCoverKey: r.wizardCoverKey, birthDate: st.birthDate || "", birthDateSource: st.birthDateSource || "", insuranceStartDate: st.insuranceStartDate || "", age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource, smoker: st.smoker, smokerSource: st.smokerSource, occupation: st.occupation || "", occupationSource: st.occupationSource || "" };
      },
      _apply(){ const results = {}; Object.keys(this._state).forEach((insId) => { const r = this._buildResultForInsured(insId); if(r) results[insId] = r; }); if(!Object.keys(results).length){ window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה תקינה לפני ההחלה.", variant: "warn" }); return; } const onApply = this._ctx?.onApply; this.close(); try{ onApply?.(results); }catch(_e){} },
      _saveActive(){ const insId = this._activeInsuredId; const result = this._buildResultForInsured(insId); if(!result){ window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה תקינה לפני השמירה.", variant: "warn" }); return; } try{ this._ctx?.onApply?.({ [insId]: result }); }catch(_e){} const st = this._state[insId]; if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; } window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר.`, variant: "success" }); this._render(); }
    };
  }
  const MigdalCriticalIllnessSimulator = createMigdalCiSimulator("mazor_merchav");
  const MigdalCancerSimulator = createMigdalCiSimulator("mazor_cancer");
  RiskSimulators.register("מגדל", "מחלות קשות", MigdalCriticalIllnessSimulator);
  RiskSimulators.register("מגדל", "סרטן", MigdalCancerSimulator);

  const MIGDAL_RISK_MIN_AGE = 18, MIGDAL_RISK_MAX_ENTRY_AGE = 67, MIGDAL_RISK_MAX_TABLE_AGE = 79, MIGDAL_RISK_MIN_ENTRY_DAYS = 0;
  const MIGDAL_MORT_RISK_MAX_ENTRY_AGE = 69, MIGDAL_MORT_RISK_END_AGE = 85;
  const MIGDAL_RISK_RATE_MAP = {"18": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "19": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "20": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "21": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "22": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "23": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "24": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "25": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "26": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "27": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "28": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "29": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "30": {"mNS": 600, "fNS": 310, "mS": 883, "fS": 615}, "31": {"mNS": 600, "fNS": 310, "mS": 912, "fS": 615}, "32": {"mNS": 600, "fNS": 310, "mS": 940, "fS": 615}, "33": {"mNS": 600, "fNS": 342, "mS": 969, "fS": 615}, "34": {"mNS": 600, "fNS": 383, "mS": 998, "fS": 676}, "35": {"mNS": 600, "fNS": 423, "mS": 1026, "fS": 737}, "36": {"mNS": 600, "fNS": 458, "mS": 1105, "fS": 787}, "37": {"mNS": 600, "fNS": 478, "mS": 1183, "fS": 814}, "38": {"mNS": 600, "fNS": 508, "mS": 1261, "fS": 855}, "39": {"mNS": 664, "fNS": 549, "mS": 1340, "fS": 914}, "40": {"mNS": 691, "fNS": 557, "mS": 1418, "fS": 921}, "41": {"mNS": 758, "fNS": 622, "mS": 1546, "fS": 1015}, "42": {"mNS": 834, "fNS": 721, "mS": 1689, "fS": 1162}, "43": {"mNS": 924, "fNS": 830, "mS": 1861, "fS": 1321}, "44": {"mNS": 1008, "fNS": 953, "mS": 2019, "fS": 1500}, "45": {"mNS": 1112, "fNS": 1108, "mS": 2213, "fS": 1725}, "46": {"mNS": 1232, "fNS": 1277, "mS": 2438, "fS": 1968}, "47": {"mNS": 1366, "fNS": 1455, "mS": 2688, "fS": 2224}, "48": {"mNS": 1518, "fNS": 1641, "mS": 2968, "fS": 2485}, "49": {"mNS": 1728, "fNS": 1817, "mS": 3359, "fS": 2732}, "50": {"mNS": 1951, "fNS": 1901, "mS": 3771, "fS": 2838}, "51": {"mNS": 2192, "fNS": 1975, "mS": 4212, "fS": 2927}, "52": {"mNS": 2433, "fNS": 2078, "mS": 4646, "fS": 3059}, "53": {"mNS": 2692, "fNS": 2260, "mS": 5111, "fS": 3303}, "54": {"mNS": 2963, "fNS": 2518, "mS": 5591, "fS": 3653}, "55": {"mNS": 3294, "fNS": 2836, "mS": 6179, "fS": 4083}, "56": {"mNS": 3646, "fNS": 3187, "mS": 6800, "fS": 4556}, "57": {"mNS": 4058, "fNS": 3481, "mS": 7524, "fS": 4943}, "58": {"mNS": 4544, "fNS": 3761, "mS": 8375, "fS": 5305}, "59": {"mNS": 5220, "fNS": 4164, "mS": 9563, "fS": 5833}, "60": {"mNS": 5943, "fNS": 4705, "mS": 10824, "fS": 6546}, "61": {"mNS": 6811, "fNS": 5431, "mS": 12330, "fS": 7505}, "62": {"mNS": 7787, "fNS": 6309, "mS": 14015, "fS": 8659}, "63": {"mNS": 8767, "fNS": 7263, "mS": 15684, "fS": 9903}, "64": {"mNS": 9768, "fNS": 8179, "mS": 17370, "fS": 11081}, "65": {"mNS": 10911, "fNS": 9059, "mS": 19287, "fS": 12195}, "66": {"mNS": 12298, "fNS": 9881, "mS": 21608, "fS": 13218}, "67": {"mNS": 13950, "fNS": 10778, "mS": 24364, "fS": 14328}, "68": {"mNS": 15586, "fNS": 11932, "mS": 27058, "fS": 15762}, "69": {"mNS": 17123, "fNS": 13214, "mS": 29548, "fS": 17347}, "70": {"mNS": 18630, "fNS": 14907, "mS": 31956, "fS": 19447}, "71": {"mNS": 21076, "fNS": 16842, "mS": 36235, "fS": 22019}, "72": {"mNS": 23995, "fNS": 19128, "mS": 41351, "fS": 25060}, "73": {"mNS": 27590, "fNS": 21361, "mS": 47655, "fS": 28047}, "74": {"mNS": 31056, "fNS": 23514, "mS": 53767, "fS": 30942}, "75": {"mNS": 34183, "fNS": 25383, "mS": 59317, "fS": 33475}, "76": {"mNS": 37058, "fNS": 27492, "mS": 64450, "fS": 36333}, "77": {"mNS": 40175, "fNS": 29725, "mS": 70025, "fS": 39383}, "78": {"mNS": 43783, "fNS": 32525, "mS": 76500, "fS": 43183}, "79": {"mNS": 47700, "fNS": 36525, "mS": 83533, "fS": 48592}};
  function lookupMigdalRiskRate({ age, gender, smoker, maxEntryAge }){
    const ageNum = Number(age); if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    const cap = Number.isInteger(maxEntryAge) ? maxEntryAge : MIGDAL_RISK_MAX_ENTRY_AGE;
    if(ageNum < MIGDAL_RISK_MIN_AGE || ageNum > cap) return { ok:false, reason:"age_out_of_range" };
    const row = MIGDAL_RISK_RATE_MAP[String(ageNum)]; if(!row) return { ok:false, reason:"age_out_of_range" };
    if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const key = gender === "זכר" ? (smoker ? "mS" : "mNS") : (smoker ? "fS" : "fNS");
    const rateAgorot = row[key]; if(rateAgorot == null || !Number.isInteger(rateAgorot)) return { ok:false, reason:"rate_missing" };
    return { ok:true, rateAgorot, ratePerHundredThousand: migdalAgorotToShekels(rateAgorot) };
  }
  function computeMigdalRiskPremium({ age, gender, smoker, sumInsured, maxEntryAge }){
    const sum = Number(String(sumInsured == null ? "" : sumInsured).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const rate = lookupMigdalRiskRate({ age, gender, smoker, maxEntryAge }); if(!rate.ok) return rate;
    const monthlyAgorot = Math.round(rate.rateAgorot * (sum / 100000));
    return { ok:true, monthlyAgorot, monthlyPremium: migdalAgorotToShekels(monthlyAgorot), annualPremium: migdalAgorotToShekels(monthlyAgorot * 12), ratePerHundredThousand: rate.ratePerHundredThousand, sumInsured: sum };
  }
  const MIGDAL_RISK_MSG = {
    birth_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.", entry_too_young:"גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
    age_out_of_range:`לא נמצא תעריף לכניסה בגיל זה (טווח כניסה ${MIGDAL_RISK_MIN_AGE}–${MIGDAL_RISK_MAX_ENTRY_AGE}; טבלה עד ${MIGDAL_RISK_MAX_TABLE_AGE}).`,
    gender_missing:"יש לבחור מין.", smoker_missing:"יש לבחור סטטוס עישון.", sum_missing:"יש להזין סכום ביטוח.", rate_missing:"לא נמצא תעריף מתאים."
  };
  function createMigdalOr1RiskSimulator(cfg){
    const FP = cfg.fieldPrefix;
    const modalId = cfg.modalId;
    const title = cfg.title;
    const ariaLabel = cfg.ariaLabel || title;
    const subtitle = cfg.subtitle || "";
    const maxEntry = Number.isInteger(cfg.maxEntryAge) ? cfg.maxEntryAge : MIGDAL_RISK_MAX_ENTRY_AGE;
    const MSG = {
      birth_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
      entry_too_young:"גיל הכניסה המינימלי הוא 0 ימים.",
      age_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
      age_out_of_range:`לא נמצא תעריף לכניסה בגיל זה (טווח כניסה ${MIGDAL_RISK_MIN_AGE}–${maxEntry}; טבלה עד ${MIGDAL_RISK_MAX_TABLE_AGE}).`,
      gender_missing:"יש לבחור מין.", smoker_missing:"יש לבחור סטטוס עישון.", sum_missing:"יש להזין סכום ביטוח.", rate_missing:"לא נמצא תעריף מתאים."
    };
    return {
    _modal:null,_ctx:null,_state:{},_activeInsuredId:null,_escHandler:null,_confirmSwitch:null,_showFinalSummary:false,
    open(ctx){ this.close(); this._ctx = ctx || {}; const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : []; this._state = {}; insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); }); this._activeInsuredId = insureds[0]?.id || null; this._confirmSwitch = null; this._showFinalSummary = false; this._mount(); this._render(); },
    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : null);
      const birthDate = safeTrim(d.birthDate || ""); const occupation = safeTrim(d.occupation || "");
      const insuranceStartDate = resolveMigdalInsuranceStartDate(this._ctx, ins);
      const st = { birthDate, birthDateSource: birthDate ? "step1" : "", insuranceStartDate, insuranceStartDateSource: insuranceStartDate ? "ctx" : "", age:"", ageSource: birthDate ? "step1" : "", ageRaw:null, entryDays:null, gender, genderSource: gender ? "step1" : "", smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "", occupation, occupationSource: occupation ? "step1" : "", sumInsured:"", result:null, error:null, savedAt:null, dirtySinceSave:false };
      this._syncAge(st); return st;
    },
    _syncAge(st){ return riskSimSyncAgeFromBirthDate(st, { minAge: MIGDAL_RISK_MIN_AGE, maxAge: maxEntry, minEntryDays: MIGDAL_RISK_MIN_ENTRY_DAYS, asOfDate: st?.insuranceStartDate || "" }); },
    _isInsuredRelevant(_ins){ return true; },
    close(){ if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; } if(this._modal){ const m = this._modal; m.classList.add("giValModal--leaving"); window.setTimeout(() => m.remove(), 200); this._modal = null; } this._ctx = null; },
    _mount(){ const modal = document.createElement("div"); modal.id = modalId; modal.className = "giValModal lcMgdRiskModal"; modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-label", ariaLabel); document.body.appendChild(modal); this._modal = modal; this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); }; document.addEventListener("keydown", this._escHandler); requestAnimationFrame(() => modal.classList.add("giValModal--visible")); },
    _getInsuredLabel(insId){ const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId); return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח"; },
    _calc(insuredId){
      const st = this._state[insuredId]; if(!st) return;
      const ageSync = this._syncAge(st);
      if(!ageSync.ok){ st.result = null; st.error = MSG[ageSync.reason] || MSG.birth_missing; st.dirtySinceSave = true; this._render(); return; }
      const calc = computeMigdalRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: st.sumInsured, maxEntryAge: maxEntry });
      if(calc.ok){ st.result = calc; st.error = null; } else { st.result = null; st.error = MSG[calc.reason] || "לא נמצא תעריף מתאים."; }
      st.dirtySinceSave = true; this._render();
    },
    _render(){
      if(!this._modal) return;
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const isMulti = insureds.length > 1;
      if(this._showFinalSummary){ this._renderFinalSummary(insureds); return; }
      const activeId = this._activeInsuredId; const st = this._state[activeId] || this._prefillFromInsured(null); const isStandalone = !!this._ctx?.standalone;
      const tabsHtml = isMulti ? `<div class="lcMgdRisk__tabs">${insureds.map((ins) => { const s = this._state[ins.id]; const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : ""); return `<button type="button" class="lcMgdRisk__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-${FP}-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`; }).join("")}</div>` : "";
      const ageSync = this._syncAge(st);
      const ageHintHtml = !st.birthDate ? `<div class="lcMgdRisk__hint lcMgdRisk__hint--warn">${isStandalone ? "יש להזין תאריך לידה" : "לא נמצא תאריך לידה — יש להזין"}</div>` : (!ageSync.ok ? `<div class="lcMgdRisk__hint lcMgdRisk__hint--warn">${escapeHtml(MSG[ageSync.reason] || "תאריך לא תקין")}</div>` : `<div class="lcMgdRisk__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(ageSync.age))}</strong> (כניסה ${MIGDAL_RISK_MIN_AGE}–${maxEntry})</div>`);
      const genderHintHtml = (isStandalone || st.gender) ? "" : `<div class="lcMgdRisk__hint lcMgdRisk__hint--warn">יש לבחור מין</div>`;
      const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false) ? "" : `<div class="lcMgdRisk__hint lcMgdRisk__hint--warn">יש לבחור סטטוס עישון</div>`;
      const subHtml = subtitle ? `<div class="giValModal__sub">${escapeHtml(subtitle)}</div>` : "";
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company) ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini") : "🛡️";
      const occBlockHtml = renderOccupationRiskBlockHtml(assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product), "lcMgdRisk");
      const resultHtml = st.error ? `<div class="lcMgdRisk__result lcMgdRisk__result--error">${escapeHtml(st.error)}</div>` : (st.result ? `<div class="lcMgdRisk__result lcMgdRisk__result--ok"><div class="lcMgdRisk__resultRow"><span>תעריף ל-₪100,000</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.ratePerHundredThousand))}</strong></div><div class="lcMgdRisk__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.annualPremium))}</strong></div><div class="lcMgdRisk__resultRow lcMgdRisk__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.monthlyPremium))}</strong></div></div>` : "");
      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
      const footHtml = isStandalone ? `<div class="giValModal__foot lcMgdRisk__foot"><button type="button" class="btn btn--primary" data-${FP}-close="1">סגור</button></div>` : (!isMulti ? `<div class="giValModal__foot lcMgdRisk__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-close="1">ביטול</button><button type="button" class="btn btn--primary" data-${FP}-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button></div>` : `<div class="giValModal__foot lcMgdRisk__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-close="1">ביטול</button><button type="button" class="btn btn--secondary" data-${FP}-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button><button type="button" class="btn btn--primary" data-${FP}-finalconfirm="1"${allSaved ? "" : " disabled"}>אישור סופי</button></div>`);
      const confirmOverlayHtml = this._confirmSwitch ? `<div class="lcMgdRisk__overlay"><div class="lcMgdRisk__overlayCard"><div class="lcMgdRisk__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}.</div><div class="lcMgdRisk__overlayBtns"><button type="button" class="btn btn--primary" data-${FP}-switch="save">שמור ועבור</button><button type="button" class="btn btn--secondary" data-${FP}-switch="discard">עבור ללא שמירה</button><button type="button" class="btn" data-${FP}-switch="cancel">ביטול</button></div></div></div>` : "";
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-${FP}-close="1"></div><div class="giValModal__card lcMgdRisk__card"><div class="giValModal__head"><span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span><div class="giValModal__headText"><div class="giValModal__title">${escapeHtml(title)}</div>${subHtml}</div><button type="button" class="lcMgdRisk__closeX" data-${FP}-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body lcMgdRisk__body">${tabsHtml}${isStandalone ? `<div class="lcMgdRisk__insuredLabel lcMgdRisk__insuredLabel--standalone">מצב חישוב עצמאי</div>` : `<div class="lcMgdRisk__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}<div class="lcMgdRisk__grid"><div class="lcMgdRisk__field"><label class="lcMgdRisk__label">תאריך לידה</label><input class="lcMgdRisk__input lcMgdRisk__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-${FP}-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />${ageHintHtml}</div><div class="lcMgdRisk__field"><label class="lcMgdRisk__label">תחילת ביטוח</label><input class="lcMgdRisk__input lcMgdRisk__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-${FP}-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" /></div><div class="lcMgdRisk__field"><label class="lcMgdRisk__label">מין</label><div class="lcMgdRisk__segmented"><button type="button" class="lcMgdRisk__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-${FP}-field="gender" data-${FP}-value="זכר">זכר</button><button type="button" class="lcMgdRisk__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-${FP}-field="gender" data-${FP}-value="נקבה">נקבה</button></div>${genderHintHtml}</div><div class="lcMgdRisk__field"><label class="lcMgdRisk__label">עישון</label><div class="lcMgdRisk__segmented"><button type="button" class="lcMgdRisk__segBtn${st.smoker === false ? " is-active" : ""}" data-${FP}-field="smoker" data-${FP}-value="0">לא מעשן/ת</button><button type="button" class="lcMgdRisk__segBtn${st.smoker === true ? " is-active" : ""}" data-${FP}-field="smoker" data-${FP}-value="1">מעשן/ת</button></div>${smokerHintHtml}</div><div class="lcMgdRisk__field lcMgdRisk__field--wide"><label class="lcMgdRisk__label">סכום ביטוח (₪)</label><input class="lcMgdRisk__input" type="text" inputmode="numeric" data-${FP}-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="1,000,000" /></div><div class="lcMgdRisk__field lcMgdRisk__field--wide"><label class="lcMgdRisk__label">עיסוק</label><input class="lcMgdRisk__input" type="text" data-${FP}-field="occupation" value="${escapeHtml(st.occupation || "")}" autocomplete="off" /></div></div>${occBlockHtml}<button type="button" class="btn btn--secondary lcMgdRisk__calcBtn" data-${FP}-calc="1">חשב פרמיה</button>${resultHtml}</div>${footHtml}${confirmOverlayHtml}</div>`;
      this._bind();
    },
    _renderFinalSummary(insureds){
      const rows = insureds.filter((ins) => this._isInsuredRelevant(ins)).map((ins) => { const ok = !!this._state[ins.id]?.savedAt; return `<div class="lcMgdRisk__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`; }).join("");
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-${FP}-close="1"></div><div class="giValModal__card lcMgdRisk__card"><div class="giValModal__head"><div class="giValModal__headText"><div class="giValModal__title">סיכום סימולטור להצעה</div></div><button type="button" class="lcMgdRisk__closeX" data-${FP}-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body lcMgdRisk__body">${rows}</div><div class="giValModal__foot lcMgdRisk__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-summary-back="1">חזרה</button><button type="button" class="btn btn--primary" data-${FP}-summary-confirm="1">אישור סופי</button></div></div>`;
      this._bind();
    },
    _bind(){
      const modal = this._modal; if(!modal) return;
      ensureSegFieldDelegation(modal, this, FP);
      $$(`[data-${FP}-close]`, modal).forEach((el) => on(el, "click", () => this.close()));
      $$(`[data-${FP}-tab]`, modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute(`data-${FP}-tab`))));
      $$(`[data-${FP}-switch]`, modal).forEach((el) => on(el, "click", () => { const action = el.getAttribute(`data-${FP}-switch`); const target = this._confirmSwitch?.targetId; this._confirmSwitch = null; if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); } else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); } else this._render(); }));
      bindRiskSimDmyField(modal, `[data-${FP}-field="birthDate"]`, { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.ageSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
      bindRiskSimDmyField(modal, `[data-${FP}-field="insuranceStartDate"]`, { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val; st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val || riskSimTodayDmy(); st.insuranceStartDateSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
      const sumInput = modal.querySelector(`[data-${FP}-field="sumInsured"]`);
      if(sumInput) on(sumInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; const formatted = formatRiskSimSumInsuredDigits(sumInput.value); sumInput.value = formatted; try{ sumInput.setSelectionRange(formatted.length, formatted.length); }catch(_e){} st.sumInsured = formatted; st.result = null; st.error = null; st.dirtySinceSave = true; });
      const occInput = modal.querySelector(`[data-${FP}-field="occupation"]`);
      if(occInput){ on(occInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; st.occupation = safeTrim(occInput.value); st.occupationSource = "manual"; st.dirtySinceSave = true; }); on(occInput, "change", () => this._render()); on(occInput, "blur", () => this._render()); }
      const calcBtn = modal.querySelector(`[data-${FP}-calc]`); if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
      const applyBtn = modal.querySelector(`[data-${FP}-apply]`); if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector(`[data-${FP}-save]`); if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector(`[data-${FP}-finalconfirm]`);
      if(finalBtn) on(finalBtn, "click", () => { const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins)); if(!(relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt))){ window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור לפני אישור סופי.", variant: "warn" }); return; } this._showFinalSummary = true; this._render(); });
      const summaryBackBtn = modal.querySelector(`[data-${FP}-summary-back]`); if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector(`[data-${FP}-summary-confirm]`); if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => { try{ this._ctx?.onFinalConfirm?.(); }catch(_e){} this.close(); });
    },
    _switchInsured(targetId){ if(!targetId || targetId === this._activeInsuredId) return; if(this._state[this._activeInsuredId]?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; } this._activeInsuredId = targetId; this._render(); },
    _buildResultForInsured(insId){
      const st = this._state[insId]; if(!st?.result?.ok) return null;
      return { sumInsured: st.sumInsured, monthlyPremium: st.result.monthlyPremium, annualPremium: st.result.annualPremium, ratePerHundredThousand: st.result.ratePerHundredThousand, birthDate: st.birthDate || "", insuranceStartDate: st.insuranceStartDate || "", age: st.age, ageSource: st.ageSource, gender: st.gender, smoker: st.smoker, genderSource: st.genderSource, smokerSource: st.smokerSource, occupation: st.occupation || "", occupationSource: st.occupationSource || "" };
    },
    _apply(){ const results = {}; Object.keys(this._state).forEach((insId) => { const r = this._buildResultForInsured(insId); if(r) results[insId] = r; }); if(!Object.keys(results).length){ window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה לפחות למבוטח אחד.", variant: "warn" }); return; } const onApply = this._ctx?.onApply; this.close(); try{ onApply?.(results); }catch(_e){} },
    _saveActive(){ const insId = this._activeInsuredId; const result = this._buildResultForInsured(insId); if(!result){ window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה לפני השמירה.", variant: "warn" }); return; } try{ this._ctx?.onApply?.({ [insId]: result }); }catch(_e){} const st = this._state[insId]; if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; } window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר.`, variant: "success" }); this._render(); }
    };
  }

  const MigdalRiskSimulator = createMigdalOr1RiskSimulator({
    fieldPrefix: "mgdr",
    modalId: "lcMgdRiskModal",
    title: "סימולטור ריסק מגדל · אור 1",
    ariaLabel: "סימולטור ריסק מגדל אור 1",
    maxEntryAge: MIGDAL_RISK_MAX_ENTRY_AGE
  });
  const MigdalMortgageRiskSimulator = createMigdalOr1RiskSimulator({
    fieldPrefix: "mgdm",
    modalId: "lcMgdMortRiskModal",
    title: "סימולטור ריסק משכנתא מגדל",
    ariaLabel: "סימולטור ריסק משכנתא מגדל",
    subtitle: "תעריף אור 1 · כניסה עד גיל 69 · תום תקופה עד גיל " + MIGDAL_MORT_RISK_END_AGE,
    maxEntryAge: MIGDAL_MORT_RISK_MAX_ENTRY_AGE
  });
  RiskSimulators.register("מגדל", "ריסק", MigdalRiskSimulator);
  RiskSimulators.register("מגדל", "ריסק משכנתא", MigdalMortgageRiskSimulator);
  // ===== סוף GI-MGD-SIM ============================================================

  // ===== GI-MGD-ACC-SIM 2026-08-13 · מוות מתאונה / נכות מתאונה מגדל ============
  // מקור אמת: תעריפי בריאות + ריסק + משכנתא - מגדל.pdf עמוד 14 (מרץ 2026).
  // תכניות מגדל חיים. פרמיה חודשית לכל ₪100,000. מין בלבד — לא מושפע מעישון.
  // כניסה חדשה 30–60, תום ביטוח 65. טבלת המוות מכילה גם 18–29 ו-61–64 כנתוני
  // מקור בלבד — הסימולטור חוסם כניסה מחוץ ל-30–60. אי-המונוטוניות (למשל גבר
  // יורד מ-5.17 בגיל 29 ל-4.08 בגיל 30, ושוב יורד בגיל 50) מועתקת כמו שהיא.
  const MIGDAL_ACC_MIN_ENTRY_AGE = 30, MIGDAL_ACC_MAX_ENTRY_AGE = 60, MIGDAL_ACC_END_AGE = 65, MIGDAL_ACC_MIN_ENTRY_DAYS = 0;
  const MIGDAL_ACC_DEATH_RATE_AGOROT = {"18":{"m":408,"f":192},"19":{"m":408,"f":192},"20":{"m":525,"f":167},"21":{"m":525,"f":167},"22":{"m":525,"f":167},"23":{"m":525,"f":167},"24":{"m":525,"f":167},"25":{"m":517,"f":142},"26":{"m":517,"f":142},"27":{"m":517,"f":142},"28":{"m":517,"f":142},"29":{"m":517,"f":142},"30":{"m":408,"f":175},"31":{"m":408,"f":175},"32":{"m":408,"f":175},"33":{"m":408,"f":175},"34":{"m":408,"f":175},"35":{"m":542,"f":175},"36":{"m":542,"f":175},"37":{"m":542,"f":175},"38":{"m":542,"f":175},"39":{"m":575,"f":175},"40":{"m":625,"f":200},"41":{"m":683,"f":200},"42":{"m":750,"f":200},"43":{"m":775,"f":200},"44":{"m":775,"f":200},"45":{"m":892,"f":242},"46":{"m":892,"f":242},"47":{"m":892,"f":242},"48":{"m":892,"f":242},"49":{"m":892,"f":242},"50":{"m":842,"f":225},"51":{"m":842,"f":225},"52":{"m":842,"f":225},"53":{"m":842,"f":225},"54":{"m":842,"f":225},"55":{"m":950,"f":333},"56":{"m":950,"f":333},"57":{"m":950,"f":333},"58":{"m":950,"f":333},"59":{"m":950,"f":333},"60":{"m":1075,"f":358},"61":{"m":1075,"f":358},"62":{"m":1075,"f":358},"63":{"m":1075,"f":358},"64":{"m":1075,"f":358}};
  const MIGDAL_ACC_DISABILITY_BANDS = [
    { min: 30, max: 39, m: 4758, f: 2267 },
    { min: 40, max: 64, m: 5317, f: 2267 }
  ];
  const MIGDAL_ACC_PLANS = {
    death: { planId:"death", product:"מוות מתאונה", title:"סימולטור מוות מתאונה מגדל", subtitle:"פרמיה חודשית לכל ₪100,000 · לא מושפע מעישון · תום ביטוח גיל 65", pdfName:"מוות מתאונה", fieldPrefix:"mgdad", modalId:"lcMgdAccDeathModal", amountField:"umbrellaDeathAmount" },
    disability: { planId:"disability", product:"נכות מתאונה", title:"סימולטור נכות מתאונה מגדל", subtitle:"פרמיה חודשית לכל ₪100,000 · לא מושפע מעישון · תום ביטוח גיל 65", pdfName:"נכות מתאונה", fieldPrefix:"mgdacd", modalId:"lcMgdAccDisModal", amountField:"umbrellaDisabilityAmount" }
  };
  function lookupMigdalAccRate(planId, { age, gender }){
    const ageNum = Number(age); if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    if(ageNum < MIGDAL_ACC_MIN_ENTRY_AGE || ageNum > MIGDAL_ACC_MAX_ENTRY_AGE) return { ok:false, reason:"age_out_of_range" };
    if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
    let rateAgorot = null;
    if(planId === "death"){
      const row = MIGDAL_ACC_DEATH_RATE_AGOROT[String(ageNum)];
      if(row) rateAgorot = gender === "זכר" ? row.m : row.f;
    } else if(planId === "disability"){
      const band = MIGDAL_ACC_DISABILITY_BANDS.find((b) => ageNum >= b.min && ageNum <= b.max);
      if(band) rateAgorot = gender === "זכר" ? band.m : band.f;
    }
    if(rateAgorot == null || !Number.isInteger(rateAgorot)) return { ok:false, reason:"rate_missing" };
    return { ok:true, rateAgorot, ratePerHundredThousand: migdalAgorotToShekels(rateAgorot) };
  }
  function computeMigdalAccPremium(planId, { age, gender, sumInsured }){
    const plan = MIGDAL_ACC_PLANS[planId]; if(!plan) return { ok:false, reason:"rate_missing" };
    const sum = Number(String(sumInsured == null ? "" : sumInsured).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const rate = lookupMigdalAccRate(planId, { age, gender }); if(!rate.ok) return rate;
    const monthlyAgorot = Math.round(rate.rateAgorot * (sum / 100000));
    return { ok:true, monthlyAgorot, monthlyPremium: migdalAgorotToShekels(monthlyAgorot), annualPremium: migdalAgorotToShekels(monthlyAgorot * 12), ratePerHundredThousand: rate.ratePerHundredThousand, sumInsured: sum, pdfName: plan.pdfName, planId: plan.planId };
  }
  const MIGDAL_ACC_MSG = {
    birth_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
    entry_too_young:"גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
    age_out_of_range:`לא נמצא תעריף לכניסה בגיל זה (טווח כניסה ${MIGDAL_ACC_MIN_ENTRY_AGE}–${MIGDAL_ACC_MAX_ENTRY_AGE}; תום ביטוח גיל ${MIGDAL_ACC_END_AGE}).`,
    gender_missing:"יש לבחור מין.",
    sum_missing:"יש להזין סכום ביטוח.",
    rate_missing:"לא נמצא תעריף מתאים."
  };
  function createMigdalAccidentSimulator(planId){
    const plan = MIGDAL_ACC_PLANS[planId]; const P = "lcMgdRisk"; const FP = plan.fieldPrefix;
    return {
      _planId:planId,_modal:null,_ctx:null,_state:{},_activeInsuredId:null,_escHandler:null,_confirmSwitch:null,_showFinalSummary:false,
      open(ctx){ this.close(); this._ctx = ctx || {}; const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : []; this._state = {}; insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); }); this._activeInsuredId = insureds[0]?.id || null; this._confirmSwitch = null; this._showFinalSummary = false; this._mount(); this._render(); },
      _prefillFromInsured(ins){
        const d = ins?.data || {};
        const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
        const birthDate = safeTrim(d.birthDate || ""); const occupation = safeTrim(d.occupation || "");
        const insuranceStartDate = resolveMigdalInsuranceStartDate(this._ctx, ins);
        const sumInsured = formatRiskSimSumInsuredDigits(safeTrim(d[plan.amountField] || d.sumInsured || ""));
        const st = { birthDate, birthDateSource: birthDate ? "step1" : "", insuranceStartDate, insuranceStartDateSource: insuranceStartDate ? "ctx" : "", age:"", ageSource: birthDate ? "step1" : "", ageRaw:null, entryDays:null, gender, genderSource: gender ? "step1" : "", occupation, occupationSource: occupation ? "step1" : "", sumInsured, result:null, error:null, savedAt:null, dirtySinceSave:false };
        this._syncAge(st); return st;
      },
      _syncAge(st){ return riskSimSyncAgeFromBirthDate(st, { minAge: MIGDAL_ACC_MIN_ENTRY_AGE, maxAge: MIGDAL_ACC_MAX_ENTRY_AGE, minEntryDays: MIGDAL_ACC_MIN_ENTRY_DAYS, asOfDate: st?.insuranceStartDate || "" }); },
      _isInsuredRelevant(_ins){ return true; },
      close(){ if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; } if(this._modal){ const m = this._modal; m.classList.add("giValModal--leaving"); window.setTimeout(() => m.remove(), 200); this._modal = null; } this._ctx = null; },
      _mount(){ const modal = document.createElement("div"); modal.id = plan.modalId; modal.className = "giValModal lcMgdRiskModal"; modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-label", plan.title); document.body.appendChild(modal); this._modal = modal; this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); }; document.addEventListener("keydown", this._escHandler); requestAnimationFrame(() => modal.classList.add("giValModal--visible")); },
      _getInsuredLabel(insId){ const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId); return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח"; },
      _calc(insuredId){
        const st = this._state[insuredId]; if(!st) return;
        const ageSync = this._syncAge(st);
        if(!ageSync.ok){ st.result = null; st.error = MIGDAL_ACC_MSG[ageSync.reason] || MIGDAL_ACC_MSG.birth_missing; st.dirtySinceSave = true; this._render(); return; }
        const calc = computeMigdalAccPremium(planId, { age: st.age, gender: st.gender, sumInsured: st.sumInsured });
        if(calc.ok){ st.result = calc; st.error = null; } else { st.result = null; st.error = MIGDAL_ACC_MSG[calc.reason] || "לא נמצא תעריף מתאים."; }
        st.dirtySinceSave = true; this._render();
      },
      _render(){
        if(!this._modal) return;
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const isMulti = insureds.length > 1;
        if(this._showFinalSummary){ this._renderFinalSummary(insureds); return; }
        const activeId = this._activeInsuredId; const st = this._state[activeId] || this._prefillFromInsured(null); const isStandalone = !!this._ctx?.standalone;
        const tabsHtml = isMulti ? `<div class="${P}__tabs">${insureds.map((ins) => { const s = this._state[ins.id]; const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : ""); return `<button type="button" class="${P}__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-${FP}-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`; }).join("")}</div>` : "";
        const ageSync = this._syncAge(st);
        const ageHintHtml = !st.birthDate ? `<div class="${P}__hint ${P}__hint--warn">${isStandalone ? "יש להזין תאריך לידה" : "לא נמצא תאריך לידה — יש להזין"}</div>` : (!ageSync.ok ? `<div class="${P}__hint ${P}__hint--warn">${escapeHtml(MIGDAL_ACC_MSG[ageSync.reason] || "תאריך לא תקין")}</div>` : `<div class="${P}__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(ageSync.age))}</strong> (כניסה ${MIGDAL_ACC_MIN_ENTRY_AGE}–${MIGDAL_ACC_MAX_ENTRY_AGE} · תום ${MIGDAL_ACC_END_AGE})</div>`);
        const genderHintHtml = (isStandalone || st.gender) ? "" : `<div class="${P}__hint ${P}__hint--warn">יש לבחור מין</div>`;
        const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company) ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini") : "🛡️";
        const occBlockHtml = renderOccupationRiskBlockHtml(assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product), P);
        const resultHtml = st.error ? `<div class="${P}__result ${P}__result--error">${escapeHtml(st.error)}</div>` : (st.result ? `<div class="${P}__result ${P}__result--ok"><div class="${P}__resultRow"><span>מסלול</span><strong>${escapeHtml(st.result.pdfName)}</strong></div><div class="${P}__resultRow"><span>תעריף חודשי ל-₪100,000</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.ratePerHundredThousand))}</strong></div><div class="${P}__resultRow"><span>סכום ביטוח</span><strong>₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.sumInsured))}</strong></div><div class="${P}__resultRow ${P}__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.monthlyPremium))}</strong></div><div class="${P}__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatMigdalExactAmount(st.result.annualPremium))}</strong></div><div class="${P}__hint">תעריף בסיסי · לא מושפע מעישון · לפני תוספות מקצוע / רפואי והנחות</div></div>` : "");
        const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
        const footHtml = isStandalone ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn btn--primary" data-${FP}-close="1">סגור</button></div>` : (!isMulti ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-close="1">ביטול</button><button type="button" class="btn btn--primary" data-${FP}-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button></div>` : `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-close="1">ביטול</button><button type="button" class="btn btn--secondary" data-${FP}-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button><button type="button" class="btn btn--primary" data-${FP}-finalconfirm="1"${allSaved ? "" : " disabled"}>אישור סופי</button></div>`);
        const confirmOverlayHtml = this._confirmSwitch ? `<div class="${P}__overlay"><div class="${P}__overlayCard"><div class="${P}__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}.</div><div class="${P}__overlayBtns"><button type="button" class="btn btn--primary" data-${FP}-switch="save">שמור ועבור</button><button type="button" class="btn btn--secondary" data-${FP}-switch="discard">עבור ללא שמירה</button><button type="button" class="btn" data-${FP}-switch="cancel">ביטול</button></div></div></div>` : "";
        this._modal.innerHTML = `<div class="giValModal__backdrop" data-${FP}-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span><div class="giValModal__headText"><div class="giValModal__title">${escapeHtml(plan.title)}</div><div class="giValModal__sub">${escapeHtml(plan.subtitle)}</div></div><button type="button" class="${P}__closeX" data-${FP}-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${tabsHtml}${isStandalone ? `<div class="${P}__insuredLabel ${P}__insuredLabel--standalone">מצב חישוב עצמאי</div>` : `<div class="${P}__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}<div class="${P}__grid"><div class="${P}__field"><label class="${P}__label">תאריך לידה</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-${FP}-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />${ageHintHtml}</div><div class="${P}__field"><label class="${P}__label">תחילת ביטוח</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-${FP}-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" /></div><div class="${P}__field"><label class="${P}__label">מין</label><div class="${P}__segmented"><button type="button" class="${P}__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-${FP}-field="gender" data-${FP}-value="זכר">זכר</button><button type="button" class="${P}__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-${FP}-field="gender" data-${FP}-value="נקבה">נקבה</button></div>${genderHintHtml}</div><div class="${P}__field ${P}__field--wide"><label class="${P}__label">סכום ביטוח (₪)</label><input class="${P}__input" type="text" inputmode="numeric" data-${FP}-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="1,000,000" /></div><div class="${P}__field ${P}__field--wide"><label class="${P}__label">עיסוק</label><input class="${P}__input" type="text" data-${FP}-field="occupation" value="${escapeHtml(st.occupation || "")}" autocomplete="off" /></div></div>${occBlockHtml}<button type="button" class="btn btn--secondary ${P}__calcBtn" data-${FP}-calc="1">חשב פרמיה</button>${resultHtml}</div>${footHtml}${confirmOverlayHtml}</div>`;
        this._bind();
      },
      _renderFinalSummary(insureds){
        const rows = insureds.filter((ins) => this._isInsuredRelevant(ins)).map((ins) => { const ok = !!this._state[ins.id]?.savedAt; return `<div class="${P}__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`; }).join("");
        this._modal.innerHTML = `<div class="giValModal__backdrop" data-${FP}-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><div class="giValModal__headText"><div class="giValModal__title">סיכום סימולטור להצעה</div></div><button type="button" class="${P}__closeX" data-${FP}-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${rows}</div><div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-summary-back="1">חזרה</button><button type="button" class="btn btn--primary" data-${FP}-summary-confirm="1">אישור סופי</button></div></div>`;
        this._bind();
      },
      _bind(){
        const modal = this._modal; if(!modal) return;
        ensureSegFieldDelegation(modal, this, FP);
        $$(`[data-${FP}-close]`, modal).forEach((el) => on(el, "click", () => this.close()));
        $$(`[data-${FP}-tab]`, modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute(`data-${FP}-tab`))));
        $$(`[data-${FP}-switch]`, modal).forEach((el) => on(el, "click", () => { const action = el.getAttribute(`data-${FP}-switch`); const target = this._confirmSwitch?.targetId; this._confirmSwitch = null; if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); } else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); } else this._render(); }));
        bindRiskSimDmyField(modal, `[data-${FP}-field="birthDate"]`, { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.ageSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
        bindRiskSimDmyField(modal, `[data-${FP}-field="insuranceStartDate"]`, { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val; st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val || riskSimTodayDmy(); st.insuranceStartDateSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
        const sumInput = modal.querySelector(`[data-${FP}-field="sumInsured"]`);
        if(sumInput) on(sumInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; const formatted = formatRiskSimSumInsuredDigits(sumInput.value); sumInput.value = formatted; try{ sumInput.setSelectionRange(formatted.length, formatted.length); }catch(_e){} st.sumInsured = formatted; st.result = null; st.error = null; st.dirtySinceSave = true; });
        const occInput = modal.querySelector(`[data-${FP}-field="occupation"]`);
        if(occInput){ on(occInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; st.occupation = safeTrim(occInput.value); st.occupationSource = "manual"; st.dirtySinceSave = true; }); on(occInput, "change", () => this._render()); on(occInput, "blur", () => this._render()); }
        const calcBtn = modal.querySelector(`[data-${FP}-calc]`); if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
        const applyBtn = modal.querySelector(`[data-${FP}-apply]`); if(applyBtn) on(applyBtn, "click", () => this._apply());
        const saveBtn = modal.querySelector(`[data-${FP}-save]`); if(saveBtn) on(saveBtn, "click", () => this._saveActive());
        const finalBtn = modal.querySelector(`[data-${FP}-finalconfirm]`);
        if(finalBtn) on(finalBtn, "click", () => { const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins)); if(!(relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt))){ window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור לפני אישור סופי.", variant: "warn" }); return; } this._showFinalSummary = true; this._render(); });
        const summaryBackBtn = modal.querySelector(`[data-${FP}-summary-back]`); if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
        const summaryConfirmBtn = modal.querySelector(`[data-${FP}-summary-confirm]`); if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => { try{ this._ctx?.onFinalConfirm?.(); }catch(_e){} this.close(); });
      },
      _switchInsured(targetId){ if(!targetId || targetId === this._activeInsuredId) return; if(this._state[this._activeInsuredId]?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; } this._activeInsuredId = targetId; this._render(); },
      _buildResultForInsured(insId){
        const st = this._state[insId]; if(!st?.result?.ok) return null;
        return { sumInsured: st.sumInsured, monthlyPremium: st.result.monthlyPremium, annualPremium: st.result.annualPremium, ratePerHundredThousand: st.result.ratePerHundredThousand, pdfName: st.result.pdfName, planId: st.result.planId, birthDate: st.birthDate || "", insuranceStartDate: st.insuranceStartDate || "", age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource, occupation: st.occupation || "", occupationSource: st.occupationSource || "" };
      },
      _apply(){ const results = {}; Object.keys(this._state).forEach((insId) => { const r = this._buildResultForInsured(insId); if(r) results[insId] = r; }); if(!Object.keys(results).length){ window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה לפחות למבוטח אחד.", variant: "warn" }); return; } const onApply = this._ctx?.onApply; this.close(); try{ onApply?.(results); }catch(_e){} },
      _saveActive(){ const insId = this._activeInsuredId; const result = this._buildResultForInsured(insId); if(!result){ window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה לפני השמירה.", variant: "warn" }); return; } try{ this._ctx?.onApply?.({ [insId]: result }); }catch(_e){} const st = this._state[insId]; if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; } window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר.`, variant: "success" }); this._render(); }
    };
  }
  const MigdalAccidentDeathSimulator = createMigdalAccidentSimulator("death");
  const MigdalAccidentDisabilitySimulator = createMigdalAccidentSimulator("disability");
  RiskSimulators.register("מגדל", "מוות מתאונה", MigdalAccidentDeathSimulator);
  RiskSimulators.register("מגדל", "נכות מתאונה", MigdalAccidentDisabilitySimulator);
  // ===== סוף GI-MGD-ACC-SIM ========================================================


  // ===== GI-CLL-HEALTH-SIM 2026-08-12 · סימולטור בריאות כלל ======================
  // מקור אמת: תעריפי בריאות כלל (גיליון "מרוכז" + גיליון פר־כיסוי).
  // בכל כיסויי הבריאות של כלל התעריף זהה לגברים ולנשים — אין פילוח מגדרי.
  // מדיכלל (מחלות קשות / סרטן) — פרומיל על סכום פיצוי, ראו GI-CLL-CI-SIM להלן.
  // כל התעריפים באגורות שלמות כדי למנוע סטיית floating-point.
  function clalHealthAgorotToShekels(agorot){ return agorot / 100; }
  function formatClalHealthExactAmount(n){
    if(!Number.isFinite(n)) return "";
    const ag = Math.round(n * 100);
    return Math.trunc(ag / 100) + "." + String(Math.abs(ag % 100)).padStart(2, "0");
  }
  function clalHealthLookupBand(bands, age){
    const a = Number(age);
    if(!Number.isInteger(a)) return null;
    for(let i = 0; i < bands.length; i++){
      if(a >= bands[i].min && a <= bands[i].max) return bands[i];
    }
    return null;
  }

  const CLAL_HEALTH_MIN_AGE = 0, CLAL_HEALTH_MAX_AGE = 65, CLAL_HEALTH_MIN_ENTRY_DAYS = 0;
  const CLAL_HEALTH_CPI_KEY = "clal_health";
  const CLAL_HEALTH_DEFAULT_BASE_INDEX = HealthCpi.TARIFFS.clal_health.baseIndexPoints; // 136.84
  const CLAL_HEALTH_COVERS = [
    {"id": "surgeries_abroad", "label": "ניתוחים ומחליפי ניתוח בחו\"ל", "wizardKey": "ניתוחים ומחליפי ניתוח בחו\"ל", "group": "פוליסת בריאות בסיסית", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 640}, {"min": 21, "max": 30, "agorot": 890}, {"min": 31, "max": 40, "agorot": 1000}, {"min": 41, "max": 50, "agorot": 1190}, {"min": 51, "max": 55, "agorot": 2017}, {"min": 56, "max": 60, "agorot": 2470}, {"min": 61, "max": 65, "agorot": 2820}, {"min": 66, "max": 120, "agorot": 2900}]},
    {"id": "transplants_abroad", "label": "השתלות וטיפולים מיוחדים בחו\"ל", "wizardKey": "השתלות וטיפולים מיוחדים בחו\"ל", "group": "פוליסת בריאות בסיסית", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 960}, {"min": 21, "max": 30, "agorot": 1520}, {"min": 31, "max": 40, "agorot": 1660}, {"min": 41, "max": 50, "agorot": 2100}, {"min": 51, "max": 55, "agorot": 2260}, {"min": 56, "max": 60, "agorot": 2520}, {"min": 61, "max": 65, "agorot": 2850}, {"min": 66, "max": 120, "agorot": 3000}]},
    {"id": "drugs", "label": "תרופות", "wizardKey": "תרופות", "group": "פוליסת בריאות בסיסית", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1140}, {"min": 21, "max": 30, "agorot": 1780}, {"min": 31, "max": 40, "agorot": 2380}, {"min": 41, "max": 50, "agorot": 3900}, {"min": 51, "max": 55, "agorot": 5600}, {"min": 56, "max": 60, "agorot": 7400}, {"min": 61, "max": 65, "agorot": 10080}, {"min": 66, "max": 120, "agorot": 13470}]},
    {"id": "shaban_deduct", "label": "משלים שב\"ן עם השתתפות עצמית 5,000 ₪", "wizardKey": "משלים שב\"ן עם השתתפות עצמית 5,000 ₪", "group": "פוליסת בריאות בסיסית", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1360}, {"min": 21, "max": 30, "agorot": 2750}, {"min": 31, "max": 40, "agorot": 4495}, {"min": 41, "max": 50, "agorot": 6650}, {"min": 51, "max": 55, "agorot": 9450}, {"min": 56, "max": 60, "agorot": 11850}, {"min": 61, "max": 65, "agorot": 16950}, {"min": 66, "max": 120, "agorot": 25850}]},
    {"id": "shaban", "label": "משלים שב\"ן לניתוחים ומחליפי ניתוח בישראל", "wizardKey": "משלים שב\"ן לניתוחים ומחליפי ניתוח בישראל", "group": "פוליסת בריאות בסיסית", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1918}, {"min": 21, "max": 30, "agorot": 3450}, {"min": 31, "max": 40, "agorot": 6000}, {"min": 41, "max": 50, "agorot": 8350}, {"min": 51, "max": 55, "agorot": 13350}, {"min": 56, "max": 60, "agorot": 16250}, {"min": 61, "max": 65, "agorot": 23910}, {"min": 66, "max": 120, "agorot": 37280}]},
    {"id": "surgeries_israel", "label": "ניתוחים ומחליפי ניתוח בישראל", "wizardKey": "ניתוחים ומחליפי ניתוח בישראל", "group": "פוליסת בריאות בסיסית", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 3625}, {"min": 21, "max": 30, "agorot": 7600}, {"min": 31, "max": 40, "agorot": 13200}, {"min": 41, "max": 50, "agorot": 18302}, {"min": 51, "max": 55, "agorot": 27850}, {"min": 56, "max": 60, "agorot": 31400}, {"min": 61, "max": 65, "agorot": 39869}, {"min": 66, "max": 120, "agorot": 56798}]},
    {"id": "bar_gefen", "label": "חמ\"ל בר גפן", "wizardKey": "חמ\"ל בר גפן", "group": "פוליסת הרחבה", "needsGender": false, "baseIndexPoints": 123.4, "bands": [{"min": 0, "max": 20, "agorot": 500}, {"min": 21, "max": 55, "agorot": 1000}, {"min": 56, "max": 65, "agorot": 2000}, {"min": 66, "max": 120, "agorot": 2500}]},
    {"id": "consult_tests", "label": "ייעוצים ובדיקות", "wizardKey": "ייעוצים ובדיקות", "group": "ייעוץ ובדיקות", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1745}, {"min": 21, "max": 30, "agorot": 4160}, {"min": 31, "max": 60, "agorot": 5675}, {"min": 61, "max": 65, "agorot": 6240}, {"min": 66, "max": 66, "agorot": 7370}, {"min": 67, "max": 120, "agorot": 7750}]},
    {"id": "fast_diag", "label": "אבחון רפואי מהיר", "wizardKey": "אבחון רפואי מהיר", "group": "ייעוץ ובדיקות", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 792}, {"min": 21, "max": 120, "agorot": 1882}]},
    {"id": "consult_diag", "label": "ייעוץ, בדיקות ואבחון רפואי מהיר", "wizardKey": "ייעוץ, בדיקות ואבחון רפואי מהיר", "group": "ייעוץ ובדיקות", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 2537}, {"min": 21, "max": 30, "agorot": 6042}, {"min": 31, "max": 60, "agorot": 7557}, {"min": 61, "max": 65, "agorot": 8122}, {"min": 66, "max": 66, "agorot": 9252}, {"min": 67, "max": 120, "agorot": 9632}]},
    {"id": "advanced_tech", "label": "טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים", "wizardKey": "טיפולים בטכנולוגיות מתקדמות ואביזרים רפואיים", "group": "פוליסת בריאות נוספת", "needsGender": false, "baseIndexPoints": 126.49, "bands": [{"min": 0, "max": 20, "agorot": 642}, {"min": 21, "max": 30, "agorot": 1173}, {"min": 31, "max": 35, "agorot": 1207}, {"min": 36, "max": 40, "agorot": 1326}, {"min": 41, "max": 45, "agorot": 1489}, {"min": 46, "max": 50, "agorot": 1743}, {"min": 51, "max": 55, "agorot": 2008}, {"min": 56, "max": 60, "agorot": 2561}, {"min": 61, "max": 65, "agorot": 3143}, {"min": 66, "max": 120, "agorot": 4171}]},
    {"id": "personal_plus", "label": "ליווי אישי פלוס", "wizardKey": "ליווי אישי פלוס", "group": "פוליסת בריאות נוספת", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 1096}, {"min": 21, "max": 120, "agorot": 1344}]},
    {"id": "child_services", "label": "שירותים לילד", "wizardKey": "שירותים לילד", "group": "פוליסת בריאות נוספת", "needsGender": false, "maxAge": 20, "bands": [{"min": 0, "max": 20, "agorot": 1993}]},
    {"id": "online_doctor", "label": "ביקור רופא און-ליין", "wizardKey": "ביקור רופא און-ליין", "group": "פוליסת בריאות נוספת", "needsGender": false, "bands": [{"min": 0, "max": 120, "agorot": 1987}]},
    {"id": "online_doctor_extra", "label": "ביקור רופא און-ליין אקסטרה", "wizardKey": "ביקור רופא און-ליין אקסטרה", "group": "פוליסת בריאות נוספת", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 2000}, {"min": 21, "max": 120, "agorot": 2480}]},
    {"id": "complementary", "label": "רפואה משלימה", "wizardKey": "רפואה משלימה", "group": "פוליסת בריאות נוספת", "needsGender": false, "bands": [{"min": 0, "max": 20, "agorot": 822}, {"min": 21, "max": 120, "agorot": 2186}]}
  ];
  const CLAL_HEALTH_COVER_BY_ID = CLAL_HEALTH_COVERS.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

  function clalHealthCoverBaseIndexPoints(cover){
    const v = Number(cover?.baseIndexPoints);
    if(Number.isFinite(v) && v > 0) return v;
    return CLAL_HEALTH_DEFAULT_BASE_INDEX;
  }

  function computeClalHealthCoverPremium(coverId, age, _gender){
    const cover = CLAL_HEALTH_COVER_BY_ID[coverId];
    if(!cover) return { ok:false, reason:"cover_missing" };
    const a = Number(age);
    if(!Number.isInteger(a)) return { ok:false, reason:"age_missing" };
    if(a < CLAL_HEALTH_MIN_AGE || a > CLAL_HEALTH_MAX_AGE) return { ok:false, reason:"age_out_of_range" };
    if(cover.maxAge != null && a > cover.maxAge) return { ok:false, reason:"age_cover_limit", coverMaxAge: cover.maxAge };
    const band = clalHealthLookupBand(cover.bands, a);
    if(!band || !Number.isInteger(band.agorot)) return { ok:false, reason:"rate_missing" };
    const basePts = clalHealthCoverBaseIndexPoints(cover);
    const indexed = HealthCpi.indexAgorot(band.agorot, CLAL_HEALTH_CPI_KEY, { baseIndexPoints: basePts });
    return {
      ok:true, coverId: cover.id, label: cover.label,
      baseMonthlyAgorot: indexed.baseAgorot, baseMonthlyPremium: clalHealthAgorotToShekels(indexed.baseAgorot),
      monthlyAgorot: indexed.indexedAgorot, monthlyPremium: clalHealthAgorotToShekels(indexed.indexedAgorot),
      indexFactor: indexed.factor, baseIndexPoints: basePts, indexInfo: indexed.indexInfo
    };
  }
  function computeClalHealthBundle(selectedIds, age, gender){
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if(!ids.length) return { ok:false, reason:"covers_missing", covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
    const covers = []; let totalAg = 0, totalBaseAg = 0, indexInfo = null;
    const basesUsed = {};
    for(let i = 0; i < ids.length; i++){
      const one = computeClalHealthCoverPremium(ids[i], age, gender);
      if(!one.ok) return { ok:false, reason: one.reason, failCoverId: ids[i], coverMaxAge: one.coverMaxAge, covers:[], monthlyAgorot:0, monthlyPremium:0, annualPremium:0 };
      const meta = CLAL_HEALTH_COVER_BY_ID[one.coverId];
      if(!indexInfo) indexInfo = one.indexInfo || null;
      basesUsed[String(one.baseIndexPoints)] = one.indexInfo || null;
      covers.push({ id: one.coverId, label: one.label, wizardKey: meta?.wizardKey || one.label, monthlyPremium: one.monthlyPremium, monthlyAgorot: one.monthlyAgorot, baseMonthlyPremium: one.baseMonthlyPremium, baseMonthlyAgorot: one.baseMonthlyAgorot, baseIndexPoints: one.baseIndexPoints, indexFactor: one.indexFactor });
      totalAg += one.monthlyAgorot; totalBaseAg += one.baseMonthlyAgorot;
    }
    return { ok:true, covers, monthlyAgorot: totalAg, monthlyPremium: clalHealthAgorotToShekels(totalAg), annualPremium: clalHealthAgorotToShekels(totalAg * 12), baseMonthlyAgorot: totalBaseAg, baseMonthlyPremium: clalHealthAgorotToShekels(totalBaseAg), indexFactor: indexInfo?.factor || 1, indexInfo, indexBases: basesUsed };
  }
  function formatClalHealthIndexMetaHtml(indexInfo, indexBases){
    if(!indexInfo) return "";
    if(!indexInfo.ok) return `<div class="lcClalHealth__indexMeta lcClalHealth__indexMeta--pending">ממתין למדד למ״ס — מוצגת כרגע פרמיית בסיס מהתעריפון</div>`;
    const baseKeys = indexBases && typeof indexBases === "object" ? Object.keys(indexBases) : [];
    const uniqueBases = baseKeys.length ? baseKeys : [String(indexInfo.baseIndexPoints)];
    const factorsTxt = uniqueBases.map((b) => {
      const info = (indexBases && indexBases[b]) || indexInfo;
      const f = (Math.round((info?.factor || indexInfo.factor) * 10000) / 10000).toFixed(4);
      return `בסיס ${b} ×${f}`;
    }).join(" · ");
    return `<div class="lcClalHealth__indexMeta">הצמדה למדד: נוכחי ≈ ${escapeHtml(String(indexInfo.currentIndexPoints))} (${escapeHtml(safeTrim(indexInfo.currentMonthLabel))}) · ${escapeHtml(factorsTxt)}</div>`;
  }
  const CLAL_HEALTH_MSG = {
    birth_missing:"יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    entry_too_young:"גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing:"יש לבחור תאריך לידה לפני חישוב הפרמיה.",
    age_out_of_range:`הגיל הביטוחי חורג מטווח הכניסה ${CLAL_HEALTH_MIN_AGE}–${CLAL_HEALTH_MAX_AGE}.`,
    covers_missing:"יש לסמן לפחות כיסוי אחד.",
    age_cover_limit:"הגיל חורג מהמותר לכיסוי שנבחר.",
    rate_missing:"לא נמצא תעריף מתאים לנתונים שהוזנו.",
    cover_missing:"כיסוי לא מזוהה בתעריפון."
  };

  const ClalHealthSimulator = {
    _modal:null,_ctx:null,_state:{},_activeInsuredId:null,_escHandler:null,_confirmSwitch:null,_showFinalSummary:false,_cpiUnsub:null,
    open(ctx){
      this.close(); this._ctx = ctx || {};
      const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : [];
      this._state = {}; insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); });
      this._activeInsuredId = insureds[0]?.id || null; this._confirmSwitch = null; this._showFinalSummary = false;
      this._mount(); this._render();
      this._cpiUnsub = HealthCpi.onChange(() => { if(this._modal) this._render(); });
      HealthCpi.ensure().then(() => { if(this._modal) this._render(); }).catch(() => {});
    },
    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const birthDate = safeTrim(d.birthDate || "");
      const occupation = safeTrim(d.occupation || "");
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const st = { birthDate, birthDateSource: birthDate ? "step1" : "", insuranceStartDate, insuranceStartDateSource: insuranceStartDate ? "ctx" : "", age:"", ageSource: birthDate ? "step1" : "", ageRaw:null, entryDays:null, gender, genderSource: gender ? "step1" : "", occupation, occupationSource: occupation ? "step1" : "", selected:{}, result:null, error:null, savedAt:null, dirtySinceSave:false };
      this._syncAge(st); return st;
    },
    _isInsuredRelevant(_ins){ return true; },
    close(){
      if(this._cpiUnsub){ try{ this._cpiUnsub(); }catch(_e){} this._cpiUnsub = null; }
      if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; }
      if(this._modal){ const m = this._modal; m.classList.add("giValModal--leaving"); window.setTimeout(() => m.remove(), 200); this._modal = null; }
      this._ctx = null;
    },
    _mount(){
      const modal = document.createElement("div");
      modal.id = "lcClalHealthModal"; modal.className = "giValModal lcClalHealthModal";
      modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-label","סימולטור בריאות כלל");
      document.body.appendChild(modal); this._modal = modal;
      this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); };
      document.addEventListener("keydown", this._escHandler);
      requestAnimationFrame(() => modal.classList.add("giValModal--visible"));
    },
    _getInsuredLabel(insId){
      const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId);
      return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח";
    },
    _selectedIds(st){ return CLAL_HEALTH_COVERS.map((c) => c.id).filter((id) => !!st?.selected?.[id]); },
    _syncAge(st){
      return riskSimSyncAgeFromBirthDate(st, { minAge: CLAL_HEALTH_MIN_AGE, maxAge: CLAL_HEALTH_MAX_AGE, minEntryDays: CLAL_HEALTH_MIN_ENTRY_DAYS, asOfDate: st?.insuranceStartDate || "" });
    },
    _recalcState(st){
      if(!st) return;
      if(!st.selected || typeof st.selected !== "object") st.selected = {};
      const ageSync = this._syncAge(st);
      const ids = this._selectedIds(st);
      if(!ids.length){ st.result = null; st.error = null; return; }
      if(!ageSync.ok){ st.result = null; st.error = CLAL_HEALTH_MSG[ageSync.reason] || CLAL_HEALTH_MSG.birth_missing; return; }
      const calc = computeClalHealthBundle(ids, st.age, st.gender);
      if(calc.ok){ st.result = calc; st.error = null; }
      else {
        st.result = null;
        let msg = CLAL_HEALTH_MSG[calc.reason] || "לא ניתן לחשב את הפרמיה.";
        if(calc.reason === "age_cover_limit" && calc.failCoverId){
          const c = CLAL_HEALTH_COVER_BY_ID[calc.failCoverId];
          msg = `הכיסוי "${c?.label || ""}" זמין עד גיל ${calc.coverMaxAge} בלבד.`;
        }
        st.error = msg;
      }
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
      const tabsHtml = isMulti ? `<div class="lcClalHealth__tabs">${insureds.map((ins) => {
        const s = this._state[ins.id];
        const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : "");
        return `<button type="button" class="lcClalHealth__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-clalh-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`;
      }).join("")}</div>` : "";
      const ageSync = this._syncAge(st);
      const ageHintHtml = !st.birthDate
        ? `<div class="lcClalHealth__hint lcClalHealth__hint--warn">${isStandalone ? "יש להזין תאריך לידה" : "לא נמצא תאריך לידה — יש להזין"}</div>`
        : (!ageSync.ok ? `<div class="lcClalHealth__hint lcClalHealth__hint--warn">${escapeHtml(CLAL_HEALTH_MSG[ageSync.reason] || "תאריך לא תקין")}</div>`
          : `<div class="lcClalHealth__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(ageSync.age))}</strong></div>`);
      const groups = {};
      CLAL_HEALTH_COVERS.forEach((c) => { (groups[c.group] ||= []).push(c); });
      const coversHtml = Object.keys(groups).map((g) => `<div class="lcClalHealth__group"><div class="lcClalHealth__groupTitle">${escapeHtml(g)}</div><div class="lcClalHealth__coverList">${groups[g].map((c) => {
        const checked = !!(st.selected && st.selected[c.id]);
        const one = checked ? computeClalHealthCoverPremium(c.id, st.age, st.gender) : null;
        const premTxt = one?.ok ? `₪${formatClalHealthExactAmount(one.monthlyPremium)}` : (checked && one && !one.ok ? "—" : "");
        return `<label class="lcClalHealth__cover${checked ? " is-checked" : ""}"><input type="checkbox" data-clalh-cover="${escapeHtml(c.id)}"${checked ? " checked" : ""} /><span class="lcClalHealth__coverLabel">${escapeHtml(c.label)}${c.maxAge != null ? ` <em>(עד גיל ${c.maxAge})</em>` : ""}</span><span class="lcClalHealth__coverPrem">${premTxt}</span></label>`;
      }).join("")}</div></div>`).join("");
      const selectedRows = (st.result?.covers || []).map((c) => `<div class="lcClalHealth__selRow"><span>${escapeHtml(c.label)}</span><strong>₪${escapeHtml(formatClalHealthExactAmount(c.monthlyPremium))}</strong></div>`).join("");
      const indexMetaHtml = formatClalHealthIndexMetaHtml(st.result?.indexInfo || HealthCpi.getIndexInfo(CLAL_HEALTH_CPI_KEY), st.result?.indexBases);
      const baseTotalHtml = (st.result?.ok && st.result.baseMonthlyPremium != null && Math.abs(st.result.baseMonthlyPremium - st.result.monthlyPremium) > 0.0001)
        ? `<div class="lcClalHealth__resultRow"><span>פרמיית בסיס (לפני מדד)</span><strong>₪${escapeHtml(formatClalHealthExactAmount(st.result.baseMonthlyPremium))}</strong></div>` : "";
      const resultHtml = st.error
        ? `<div class="lcClalHealth__result lcClalHealth__result--error">${escapeHtml(st.error)}</div>`
        : (st.result ? `<div class="lcClalHealth__result lcClalHealth__result--ok"><div class="lcClalHealth__selTitle">כיסויים שנבחרו</div>${selectedRows}${baseTotalHtml}<div class="lcClalHealth__resultRow lcClalHealth__resultRow--main"><span>סה״כ פרמיה חודשית (צמודה למדד)</span><strong>₪${escapeHtml(formatClalHealthExactAmount(st.result.monthlyPremium))}</strong></div><div class="lcClalHealth__resultRow"><span>סה״כ פרמיה שנתית</span><strong>₪${escapeHtml(formatClalHealthExactAmount(st.result.annualPremium))}</strong></div>${indexMetaHtml}</div>`
          : `<div class="lcClalHealth__result lcClalHealth__result--empty">סמנו כיסויים כדי לראות פרמיה</div>`);
      const occBlockHtml = renderOccupationRiskBlockHtml(assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product), "lcClalHealth");
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company) ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini") : "✚";
      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
      const footHtml = isStandalone
        ? `<div class="giValModal__foot lcClalHealth__foot"><button type="button" class="btn btn--primary" data-clalh-close="1">סגור</button></div>`
        : (!isMulti
          ? `<div class="giValModal__foot lcClalHealth__foot"><button type="button" class="btn giValModal__closeBtn" data-clalh-close="1">ביטול</button><button type="button" class="btn btn--primary" data-clalh-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button></div>`
          : `<div class="giValModal__foot lcClalHealth__foot"><button type="button" class="btn giValModal__closeBtn" data-clalh-close="1">ביטול</button><button type="button" class="btn btn--secondary" data-clalh-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button><button type="button" class="btn btn--primary" data-clalh-finalconfirm="1"${allSaved ? "" : " disabled"}>אישור סופי</button></div>`);
      const confirmOverlayHtml = this._confirmSwitch ? `<div class="lcClalHealth__overlay"><div class="lcClalHealth__overlayCard"><div class="lcClalHealth__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}. האם לשמור לפני המעבר?</div><div class="lcClalHealth__overlayBtns"><button type="button" class="btn btn--primary" data-clalh-switch="save">שמור ועבור</button><button type="button" class="btn btn--secondary" data-clalh-switch="discard">עבור ללא שמירה</button><button type="button" class="btn" data-clalh-switch="cancel">ביטול</button></div></div></div>` : "";
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-clalh-close="1"></div><div class="giValModal__card lcClalHealth__card"><div class="giValModal__head"><span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span><div class="giValModal__headText"><div class="giValModal__title">סימולטור בריאות כלל</div></div><button type="button" class="lcClalHealth__closeX" data-clalh-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body lcClalHealth__body">${tabsHtml}${isStandalone ? `<div class="lcClalHealth__insuredLabel lcClalHealth__insuredLabel--standalone">מצב חישוב עצמאי — התוצאה לא נשמרת על אף פוליסה</div>` : `<div class="lcClalHealth__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}<div class="lcClalHealth__grid"><div class="lcClalHealth__field"><label class="lcClalHealth__label">תאריך לידה</label><input class="lcClalHealth__input lcClalHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-clalh-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />${ageHintHtml}</div><div class="lcClalHealth__field"><label class="lcClalHealth__label">תחילת ביטוח</label><input class="lcClalHealth__input lcClalHealth__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-clalh-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" /></div><div class="lcClalHealth__field"><label class="lcClalHealth__label">מין</label><div class="lcClalHealth__segmented"><button type="button" class="lcClalHealth__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-clalh-field="gender" data-clalh-value="זכר">זכר</button><button type="button" class="lcClalHealth__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-clalh-field="gender" data-clalh-value="נקבה">נקבה</button></div><div class="lcClalHealth__hint">בתעריפון כלל הפרמיה זהה לגברים ולנשים</div></div><div class="lcClalHealth__field lcClalHealth__field--wide"><label class="lcClalHealth__label">עיסוק</label><input class="lcClalHealth__input" type="text" data-clalh-field="occupation" value="${escapeHtml(st.occupation || "")}" placeholder="לדוגמה: מהנדס" autocomplete="off" /></div></div><div class="lcClalHealth__coversTitle">בחירת כיסויים <span class="lcClalHealth__coversCount">(${CLAL_HEALTH_COVERS.length})</span></div><div class="lcClalHealth__coversWrap">${coversHtml}</div>${occBlockHtml}${resultHtml}</div>${footHtml}${confirmOverlayHtml}</div>`;
      this._bind();
    },
    _renderFinalSummary(insureds){
      const rows = insureds.filter((ins) => this._isInsuredRelevant(ins)).map((ins) => {
        const ok = !!this._state[ins.id]?.savedAt;
        return `<div class="lcClalHealth__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`;
      }).join("");
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-clalh-close="1"></div><div class="giValModal__card lcClalHealth__card"><div class="giValModal__head"><div class="giValModal__headText"><div class="giValModal__title">סיכום סימולטור להצעה</div></div><button type="button" class="lcClalHealth__closeX" data-clalh-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body lcClalHealth__body">${rows}</div><div class="giValModal__foot lcClalHealth__foot"><button type="button" class="btn giValModal__closeBtn" data-clalh-summary-back="1">חזרה</button><button type="button" class="btn btn--primary" data-clalh-summary-confirm="1">אישור סופי</button></div></div>`;
      this._bind();
    },
    _bind(){
      const modal = this._modal; if(!modal) return;
      ensureSegFieldDelegation(modal, this, "clalh");
      $$("[data-clalh-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-clalh-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-clalh-tab"))));
      $$("[data-clalh-switch]", modal).forEach((el) => on(el, "click", () => {
        const action = el.getAttribute("data-clalh-switch"); const target = this._confirmSwitch?.targetId; this._confirmSwitch = null;
        if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); }
        else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); }
        else this._render();
      }));
      bindRiskSimDmyField(modal, '[data-clalh-field="birthDate"]', {
        onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.dirtySinceSave = true; },
        onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.ageSource = "manual"; st.dirtySinceSave = true; this._syncAge(st); this._render(); }
      });
      bindRiskSimDmyField(modal, '[data-clalh-field="insuranceStartDate"]', {
        onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val; st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; },
        onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val || riskSimTodayDmy(); st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; this._syncAge(st); this._render(); }
      });
      const occInput = modal.querySelector('[data-clalh-field="occupation"]');
      if(occInput){
        on(occInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; st.occupation = safeTrim(occInput.value); st.occupationSource = "manual"; st.dirtySinceSave = true; });
        on(occInput, "change", () => this._render()); on(occInput, "blur", () => this._render());
      }
      $$("[data-clalh-cover]", modal).forEach((el) => on(el, "change", () => {
        const st = this._state[this._activeInsuredId]; if(!st) return;
        if(!st.selected || typeof st.selected !== "object") st.selected = {};
        st.selected[el.getAttribute("data-clalh-cover")] = !!el.checked; st.dirtySinceSave = true; this._render();
      }));
      const applyBtn = modal.querySelector("[data-clalh-apply]"); if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-clalh-save]"); if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-clalh-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => {
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : [];
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        if(!(relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt))){
          window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור את הסימולטור עבור כל המבוטחים הרלוונטיים לפני האישור הסופי.", variant: "warn" }); return;
        }
        this._showFinalSummary = true; this._render();
      });
      const summaryBackBtn = modal.querySelector("[data-clalh-summary-back]"); if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-clalh-summary-confirm]"); if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => { try{ this._ctx?.onFinalConfirm?.(); }catch(_e){} this.close(); });
    },
    _switchInsured(targetId){
      if(!targetId || targetId === this._activeInsuredId) return;
      if(this._state[this._activeInsuredId]?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; }
      this._activeInsuredId = targetId; this._render();
    },
    _buildResultForInsured(insId){
      const st = this._state[insId]; this._recalcState(st); if(!st?.result?.ok) return null;
      return { covers: st.result.covers.map((c) => ({ id:c.id, label:c.label, wizardKey:c.wizardKey || c.label, monthlyPremium:c.monthlyPremium })), monthlyPremium: st.result.monthlyPremium, annualPremium: st.result.annualPremium, monthlyAgorot: st.result.monthlyAgorot, birthDate: st.birthDate || "", birthDateSource: st.birthDateSource || "", insuranceStartDate: st.insuranceStartDate || "", age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource, occupation: st.occupation || "", occupationSource: st.occupationSource || "" };
    },
    _apply(){
      const results = {}; Object.keys(this._state).forEach((insId) => { const r = this._buildResultForInsured(insId); if(r) results[insId] = r; });
      if(!Object.keys(results).length){ window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לבחור כיסויים ולחשב פרמיה לפני ההחלה על הפוליסה.", variant: "warn" }); return; }
      const onApply = this._ctx?.onApply; this.close(); try{ onApply?.(results); }catch(_e){}
    },
    _saveActive(){
      const insId = this._activeInsuredId; const result = this._buildResultForInsured(insId);
      if(!result){ window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לבחור כיסויים תקינים לפני השמירה.", variant: "warn" }); return; }
      try{ this._ctx?.onApply?.({ [insId]: result }); }catch(_e){}
      const st = this._state[insId]; if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; }
      window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר על ההצעה.`, variant: "success" });
      this._render();
    }
  };
  RiskSimulators.register("כלל", "בריאות", ClalHealthSimulator);
  // ===== סוף GI-CLL-HEALTH-SIM =====================================================

  // ===== GI-CLL-CI-SIM 2026-08-12 · סימולטורי מדיכלל כלל (מחלות קשות / סרטן) =====
  // מקור אמת: גיליונות "מ.קשות" ו-"סרטן" בתעריפון בריאות כלל.
  // בשונה מכיסויי הבריאות — התעריף הוא פרומיל לשנה על סכום הפיצוי, מפולח
  // לפי מין × עישון, ואינו צמוד למדד (אין שורת "מדד בסיס" בגיליונות האלה).
  // אחסון: מאיות פרומיל כמספר שלם (6.55‰ → 655) כדי למנוע סטיית floating-point.
  //   פרמיה שנתית = (מאיות × סכום) ÷ 100,000 ; חודשית = שנתית ÷ 12
  // בהתאם לשאר סימולטורי הפרומיל במערכת — אין כאן עיגול עסקי.
  const CLAL_CI_MIN_AGE = 0, CLAL_CI_MIN_ENTRY_DAYS = 0, CLAL_CI_MAX_TABLE_AGE = 74;
  const CLAL_CI_MIN_SUM = 50000, CLAL_CI_MAX_SUM = 700000;
  const CLAL_CI_RATE_BANDS = {
    mediclal_critical: [
      {"min": 0, "max": 20, "mS": 85, "mNS": 85, "fS": 85, "fNS": 85},
      {"min": 21, "max": 25, "mS": 170, "mNS": 156, "fS": 156, "fNS": 151},
      {"min": 26, "max": 30, "mS": 205, "mNS": 175, "fS": 220, "fNS": 200},
      {"min": 31, "max": 35, "mS": 305, "mNS": 245, "fS": 330, "fNS": 310},
      {"min": 36, "max": 40, "mS": 550, "mNS": 370, "fS": 515, "fNS": 465},
      {"min": 41, "max": 45, "mS": 1030, "mNS": 655, "fS": 810, "fNS": 680},
      {"min": 46, "max": 50, "mS": 1880, "mNS": 1310, "fS": 1530, "fNS": 1155},
      {"min": 51, "max": 55, "mS": 3075, "mNS": 2095, "fS": 2360, "fNS": 1665},
      {"min": 56, "max": 60, "mS": 5785, "mNS": 3355, "fS": 3455, "fNS": 2525},
      {"min": 61, "max": 65, "mS": 9640, "mNS": 6115, "fS": 5900, "fNS": 4120},
      {"min": 66, "max": 66, "mS": 13070, "mNS": 8365, "fS": 7865, "fNS": 5300},
      {"min": 67, "max": 67, "mS": 14830, "mNS": 9310, "fS": 8585, "fNS": 5905},
      {"min": 68, "max": 68, "mS": 17165, "mNS": 10620, "fS": 9770, "fNS": 6610},
      {"min": 69, "max": 69, "mS": 18500, "mNS": 11630, "fS": 10705, "fNS": 7735},
      {"min": 70, "max": 70, "mS": 21515, "mNS": 13705, "fS": 12645, "fNS": 9220},
      {"min": 71, "max": 71, "mS": 25645, "mNS": 16510, "fS": 15295, "fNS": 11225},
      {"min": 72, "max": 74, "mS": 34220, "mNS": 22085, "fS": 20540, "fNS": 15060}
    ],
    mediclal_cancer: [
      {"min": 0, "max": 20, "mS": 62, "mNS": 62, "fS": 62, "fNS": 62},
      {"min": 21, "max": 25, "mS": 113, "mNS": 113, "fS": 114, "fNS": 104},
      {"min": 26, "max": 30, "mS": 133, "mNS": 133, "fS": 190, "fNS": 171},
      {"min": 31, "max": 35, "mS": 160, "mNS": 160, "fS": 300, "fNS": 265},
      {"min": 36, "max": 40, "mS": 190, "mNS": 190, "fS": 510, "fNS": 435},
      {"min": 41, "max": 45, "mS": 220, "mNS": 220, "fS": 720, "fNS": 660},
      {"min": 46, "max": 50, "mS": 440, "mNS": 400, "fS": 1185, "fNS": 990},
      {"min": 51, "max": 55, "mS": 845, "mNS": 690, "fS": 1470, "fNS": 1180},
      {"min": 56, "max": 60, "mS": 1875, "mNS": 1305, "fS": 2090, "fNS": 1605},
      {"min": 61, "max": 65, "mS": 3960, "mNS": 2645, "fS": 3525, "fNS": 2600},
      {"min": 66, "max": 66, "mS": 5210, "mNS": 3425, "fS": 4460, "fNS": 3225},
      {"min": 67, "max": 67, "mS": 5795, "mNS": 3805, "fS": 4835, "fNS": 3460},
      {"min": 68, "max": 68, "mS": 6455, "mNS": 4235, "fS": 5260, "fNS": 3715},
      {"min": 69, "max": 69, "mS": 7230, "mNS": 4740, "fS": 5770, "fNS": 4020},
      {"min": 70, "max": 70, "mS": 7725, "mNS": 5060, "fS": 6070, "fNS": 4155},
      {"min": 71, "max": 71, "mS": 8960, "mNS": 5865, "fS": 6945, "fNS": 4665},
      {"min": 72, "max": 72, "mS": 10960, "mNS": 7155, "fS": 8385, "fNS": 5525},
      {"min": 73, "max": 74, "mS": 16060, "mNS": 10450, "fS": 12005, "fNS": 7665}
    ]
  };
  const CLAL_CI_PLANS = {
    mediclal_critical: { planId:"mediclal_critical", title:"סימולטור מחלות קשות כלל · מדיכלל 33", subtitle:"תעריף פרומיל לשנה על סכום הפיצוי", pdfName:"מדיכלל מחלות קשות 33", wizardCoverKey:"מדיכלל מחלות קשות 33", cssPrefix:"lcClalCi", modalClass:"lcClalCiModal", fieldPrefix:"clalci", rateMapKey:"mediclal_critical", amountField:"mediclalCriticalAmount", maxEntryAge:65 },
    mediclal_cancer: { planId:"mediclal_cancer", title:"סימולטור סרטן כלל · מדיכלל פיצוי לסרטן", subtitle:"תעריף פרומיל לשנה על סכום הפיצוי", pdfName:"מדיכלל פיצוי לסרטן", wizardCoverKey:"מדיכלל פיצוי לסרטן", cssPrefix:"lcClalCi", modalClass:"lcClalCiModal", fieldPrefix:"clalca", rateMapKey:"mediclal_cancer", amountField:"mediclalCancerAmount", maxEntryAge:69 }
  };
  /** תצוגת סכום מדויקת — ללא עיגול עסקי, עד 4 ספרות עשרוניות ולא פחות מ-2. */
  function formatClalCiExactAmount(n){
    if(!Number.isFinite(n)) return "";
    let s = n.toFixed(4);
    if(s.indexOf(".") !== -1){
      s = s.replace(/0+$/, "");
      if(s.endsWith(".")) s += "00";
      else if(s.split(".")[1].length === 1) s += "0";
    }
    return s;
  }
  /** פרומיל לתצוגה: 655 → "6.55" */
  function formatClalCiPermille(hundredths){
    if(!Number.isInteger(hundredths)) return "";
    return Math.trunc(hundredths / 100) + "." + String(Math.abs(hundredths % 100)).padStart(2, "0");
  }
  function lookupClalCiRate(planId, { age, gender, smoker }){
    const plan = CLAL_CI_PLANS[planId]; if(!plan) return { ok:false, reason:"rate_missing" };
    // Number("") הוא 0 — בלי הבדיקה הזו גיל ריק היה מקבל את תעריף גיל 0
    if(age === "" || age == null) return { ok:false, reason:"age_missing" };
    const ageNum = Number(age); if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    if(ageNum < CLAL_CI_MIN_AGE || ageNum > plan.maxEntryAge) return { ok:false, reason:"age_out_of_range" };
    if(gender !== "זכר" && gender !== "נקבה") return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const bands = CLAL_CI_RATE_BANDS[plan.rateMapKey] || [];
    let band = null;
    for(let i = 0; i < bands.length; i++){
      if(ageNum >= bands[i].min && ageNum <= bands[i].max){ band = bands[i]; break; }
    }
    if(!band) return { ok:false, reason:"age_out_of_range" };
    const key = gender === "זכר" ? (smoker ? "mS" : "mNS") : (smoker ? "fS" : "fNS");
    const permilleHundredths = band[key];
    if(permilleHundredths == null || !Number.isInteger(permilleHundredths)) return { ok:false, reason:"rate_missing" };
    return { ok:true, permilleHundredths, ratePerMille: permilleHundredths / 100 };
  }
  function computeClalCiPremium(planId, { age, gender, smoker, compensation }){
    const plan = CLAL_CI_PLANS[planId]; if(!plan) return { ok:false, reason:"rate_missing" };
    const sum = Number(String(compensation == null ? "" : compensation).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    if(sum < CLAL_CI_MIN_SUM) return { ok:false, reason:"sum_too_low", minSum: CLAL_CI_MIN_SUM };
    if(sum > CLAL_CI_MAX_SUM) return { ok:false, reason:"sum_too_high", maxSum: CLAL_CI_MAX_SUM };
    const rate = lookupClalCiRate(planId, { age, gender, smoker }); if(!rate.ok) return rate;
    const annualPremium = (rate.permilleHundredths * sum) / 100000;
    const monthlyPremium = annualPremium / 12;
    return {
      ok:true, monthlyPremium, annualPremium,
      permilleHundredths: rate.permilleHundredths, ratePerMille: rate.ratePerMille,
      compensation: sum, pdfName: plan.pdfName, planId: plan.planId, wizardCoverKey: plan.wizardCoverKey
    };
  }
  const CLAL_CI_MSG = {
    birth_missing:"יש לבחור תאריך לידה לפני חישוב הפרמיה.", entry_too_young:"גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing:"יש לבחור תאריך לידה לפני חישוב הפרמיה.", age_out_of_range:"הגיל הביטוחי חורג מטווח הכניסה של המסלול.",
    gender_missing:"יש לבחור מין.", smoker_missing:"יש לבחור סטטוס עישון.", sum_missing:"יש להזין סכום פיצוי.",
    sum_too_low:"סכום הפיצוי המינימלי הוא ₪50,000.", sum_too_high:"סכום הפיצוי המקסימלי הוא ₪700,000.", rate_missing:"לא נמצא תעריף מתאים."
  };
  function createClalCiSimulator(planId){
    const plan = CLAL_CI_PLANS[planId]; const P = plan.cssPrefix; const FP = plan.fieldPrefix;
    const ageRangeMsg = `הגיל הביטוחי חורג מטווח הכניסה ${CLAL_CI_MIN_AGE}–${plan.maxEntryAge}.`;
    const msgFor = (reason) => (reason === "age_out_of_range" ? ageRangeMsg : (CLAL_CI_MSG[reason] || ""));
    return {
      _planId:planId,_modal:null,_ctx:null,_state:{},_activeInsuredId:null,_escHandler:null,_confirmSwitch:null,_showFinalSummary:false,
      open(ctx){ this.close(); this._ctx = ctx || {}; const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : []; this._state = {}; insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); }); this._activeInsuredId = insureds[0]?.id || null; this._confirmSwitch = null; this._showFinalSummary = false; this._mount(); this._render(); },
      _prefillFromInsured(ins){
        const d = ins?.data || {};
        const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
        const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : ((d.smoker === true || d.smoker === false) ? d.smoker : null));
        const birthDate = safeTrim(d.birthDate || ""); const occupation = safeTrim(d.occupation || "");
        const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
        const compensation = safeTrim(d[plan.amountField] || d.compensation || "") || "100000";
        const st = { birthDate, birthDateSource: birthDate ? "step1" : "", insuranceStartDate, insuranceStartDateSource: insuranceStartDate ? "ctx" : "", age:"", ageSource: birthDate ? "step1" : "", ageRaw:null, entryDays:null, gender, genderSource: gender ? "step1" : "", smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "", occupation, occupationSource: occupation ? "step1" : "", compensation, result:null, error:null, savedAt:null, dirtySinceSave:false };
        this._syncAge(st); return st;
      },
      _syncAge(st){ return riskSimSyncAgeFromBirthDate(st, { minAge: CLAL_CI_MIN_AGE, maxAge: plan.maxEntryAge, minEntryDays: CLAL_CI_MIN_ENTRY_DAYS, asOfDate: st?.insuranceStartDate || "" }); },
      _isInsuredRelevant(_ins){ return true; },
      close(){ if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; } if(this._modal){ const m = this._modal; m.classList.add("giValModal--leaving"); window.setTimeout(() => m.remove(), 200); this._modal = null; } this._ctx = null; },
      _mount(){ const modal = document.createElement("div"); modal.id = "lcClalCiModal_" + planId; modal.className = "giValModal " + plan.modalClass; modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-label", plan.title); document.body.appendChild(modal); this._modal = modal; this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); }; document.addEventListener("keydown", this._escHandler); requestAnimationFrame(() => modal.classList.add("giValModal--visible")); },
      _getInsuredLabel(insId){ const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId); return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח"; },
      _calc(insId){
        const st = this._state[insId]; if(!st) return;
        const ageSync = this._syncAge(st);
        if(!ageSync.ok){ st.result = null; st.error = msgFor(ageSync.reason) || CLAL_CI_MSG.birth_missing; this._render(); return; }
        const calc = computeClalCiPremium(planId, { age: st.age, gender: st.gender, smoker: st.smoker, compensation: st.compensation });
        if(calc.ok){ st.result = calc; st.error = null; }
        else { st.result = null; let msg = msgFor(calc.reason) || "לא ניתן לחשב את הפרמיה."; if(calc.reason === "sum_too_low") msg = `סכום הפיצוי המינימלי הוא ₪${formatRiskSimSumInsuredDigits(calc.minSum)}.`; if(calc.reason === "sum_too_high") msg = `סכום הפיצוי המקסימלי הוא ₪${formatRiskSimSumInsuredDigits(calc.maxSum)}.`; st.error = msg; }
        this._render();
      },
      _render(){
        if(!this._modal) return;
        const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const isMulti = insureds.length > 1;
        if(this._showFinalSummary){ this._renderFinalSummary(insureds); return; }
        const activeId = this._activeInsuredId; const st = this._state[activeId] || this._prefillFromInsured(null); const isStandalone = !!this._ctx?.standalone;
        const tabsHtml = isMulti ? `<div class="${P}__tabs">${insureds.map((ins) => { const s = this._state[ins.id]; const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : ""); return `<button type="button" class="${P}__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-${FP}-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`; }).join("")}</div>` : "";
        const ageSync = this._syncAge(st);
        const ageHintHtml = !st.birthDate ? `<div class="${P}__hint ${P}__hint--warn">${isStandalone ? "יש להזין תאריך לידה" : "לא נמצא תאריך לידה — יש להזין"}</div>` : (!ageSync.ok ? `<div class="${P}__hint ${P}__hint--warn">${escapeHtml(msgFor(ageSync.reason) || "תאריך לא תקין")}</div>` : `<div class="${P}__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(ageSync.age))}</strong></div>`);
        const genderHintHtml = (isStandalone || st.gender) ? "" : `<div class="${P}__hint ${P}__hint--warn">יש לבחור מין</div>`;
        const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false) ? "" : `<div class="${P}__hint ${P}__hint--warn">יש לבחור סטטוס עישון</div>`;
        const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company) ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini") : "✚";
        const occBlockHtml = renderOccupationRiskBlockHtml(assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product), P);
        const resultHtml = st.error ? `<div class="${P}__result ${P}__result--error">${escapeHtml(st.error)}</div>` : (st.result ? `<div class="${P}__result ${P}__result--ok"><div class="${P}__resultRow"><span>מסלול</span><strong>${escapeHtml(st.result.pdfName)}</strong></div><div class="${P}__resultRow"><span>תעריף (פרומיל לשנה)</span><strong>${escapeHtml(formatClalCiPermille(st.result.permilleHundredths))}‰</strong></div><div class="${P}__resultRow"><span>סכום פיצוי</span><strong>₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.compensation))}</strong></div><div class="${P}__resultRow ${P}__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatClalCiExactAmount(st.result.monthlyPremium))}</strong></div><div class="${P}__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatClalCiExactAmount(st.result.annualPremium))}</strong></div><div class="${P}__rateNote">התעריף משתנה כל שנה לפי גיל המבוטח · הפרמיה אינה צמודה למדד</div></div>` : `<div class="${P}__result ${P}__result--empty">מלאו את השדות ולחצו "חשב פרמיה"</div>`);
        const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
        const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
        const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
        const footHtml = isStandalone ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn btn--primary" data-${FP}-close="1">סגור</button></div>` : (!isMulti ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-close="1">ביטול</button><button type="button" class="btn btn--primary" data-${FP}-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button></div>` : `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-close="1">ביטול</button><button type="button" class="btn btn--secondary" data-${FP}-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button><button type="button" class="btn btn--primary" data-${FP}-finalconfirm="1"${allSaved ? "" : " disabled"}>אישור סופי</button></div>`);
        const confirmOverlayHtml = this._confirmSwitch ? `<div class="${P}__overlay"><div class="${P}__overlayCard"><div class="${P}__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}.</div><div class="${P}__overlayBtns"><button type="button" class="btn btn--primary" data-${FP}-switch="save">שמור ועבור</button><button type="button" class="btn btn--secondary" data-${FP}-switch="discard">עבור ללא שמירה</button><button type="button" class="btn" data-${FP}-switch="cancel">ביטול</button></div></div></div>` : "";
        this._modal.innerHTML = `<div class="giValModal__backdrop" data-${FP}-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span><div class="giValModal__headText"><div class="giValModal__title">${escapeHtml(plan.title)}</div><div class="giValModal__sub">${escapeHtml(plan.subtitle)}</div></div><button type="button" class="${P}__closeX" data-${FP}-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${tabsHtml}${isStandalone ? `<div class="${P}__insuredLabel ${P}__insuredLabel--standalone">מצב חישוב עצמאי</div>` : `<div class="${P}__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}<div class="${P}__grid"><div class="${P}__field"><label class="${P}__label">תאריך לידה</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-${FP}-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />${ageHintHtml}</div><div class="${P}__field"><label class="${P}__label">תחילת ביטוח</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-${FP}-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" /></div><div class="${P}__field"><label class="${P}__label">מין</label><div class="${P}__segmented"><button type="button" class="${P}__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-${FP}-field="gender" data-${FP}-value="זכר">זכר</button><button type="button" class="${P}__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-${FP}-field="gender" data-${FP}-value="נקבה">נקבה</button></div>${genderHintHtml}</div><div class="${P}__field"><label class="${P}__label">עישון</label><div class="${P}__segmented"><button type="button" class="${P}__segBtn${st.smoker === false ? " is-active" : ""}" data-${FP}-field="smoker" data-${FP}-value="0">לא מעשן/ת</button><button type="button" class="${P}__segBtn${st.smoker === true ? " is-active" : ""}" data-${FP}-field="smoker" data-${FP}-value="1">מעשן/ת</button></div>${smokerHintHtml}</div><div class="${P}__field"><label class="${P}__label">סכום פיצוי (₪${formatRiskSimSumInsuredDigits(CLAL_CI_MIN_SUM)}–₪${formatRiskSimSumInsuredDigits(CLAL_CI_MAX_SUM)})</label><input class="${P}__input" type="text" inputmode="numeric" data-${FP}-field="compensation" value="${escapeHtml(st.compensation || "")}" placeholder="100,000" /></div><div class="${P}__field ${P}__field--wide"><label class="${P}__label">עיסוק</label><input class="${P}__input" type="text" data-${FP}-field="occupation" value="${escapeHtml(st.occupation || "")}" autocomplete="off" /></div></div><div class="${P}__actions"><button type="button" class="btn btn--primary" data-${FP}-calc="1">חשב פרמיה</button></div>${occBlockHtml}${resultHtml}</div>${footHtml}${confirmOverlayHtml}</div>`;
        this._bind();
      },
      _renderFinalSummary(insureds){
        const rows = insureds.filter((ins) => this._isInsuredRelevant(ins)).map((ins) => { const ok = !!this._state[ins.id]?.savedAt; return `<div class="${P}__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`; }).join("");
        this._modal.innerHTML = `<div class="giValModal__backdrop" data-${FP}-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><div class="giValModal__headText"><div class="giValModal__title">סיכום סימולטור להצעה</div></div><button type="button" class="${P}__closeX" data-${FP}-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${rows}</div><div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-${FP}-summary-back="1">חזרה</button><button type="button" class="btn btn--primary" data-${FP}-summary-confirm="1">אישור סופי</button></div></div>`;
        this._bind();
      },
      _bind(){
        const modal = this._modal; if(!modal) return;
        ensureSegFieldDelegation(modal, this, FP);
        $$(`[data-${FP}-close]`, modal).forEach((el) => on(el, "click", () => this.close()));
        $$(`[data-${FP}-tab]`, modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute(`data-${FP}-tab`))));
        $$(`[data-${FP}-switch]`, modal).forEach((el) => on(el, "click", () => { const action = el.getAttribute(`data-${FP}-switch`); const target = this._confirmSwitch?.targetId; this._confirmSwitch = null; if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); } else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); } else this._render(); }));
        bindRiskSimDmyField(modal, `[data-${FP}-field="birthDate"]`, { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.ageSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
        bindRiskSimDmyField(modal, `[data-${FP}-field="insuranceStartDate"]`, { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val; st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val || riskSimTodayDmy(); st.insuranceStartDateSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
        const sumInput = modal.querySelector(`[data-${FP}-field="compensation"]`);
        if(sumInput) on(sumInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; const formatted = formatRiskSimSumInsuredDigits(sumInput.value); sumInput.value = formatted; try{ sumInput.setSelectionRange(formatted.length, formatted.length); }catch(_e){} st.compensation = formatted; st.result = null; st.error = null; st.dirtySinceSave = true; });
        const occInput = modal.querySelector(`[data-${FP}-field="occupation"]`);
        if(occInput){ on(occInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; st.occupation = safeTrim(occInput.value); st.occupationSource = "manual"; st.dirtySinceSave = true; }); on(occInput, "change", () => this._render()); on(occInput, "blur", () => this._render()); }
        const calcBtn = modal.querySelector(`[data-${FP}-calc]`); if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
        const applyBtn = modal.querySelector(`[data-${FP}-apply]`); if(applyBtn) on(applyBtn, "click", () => this._apply());
        const saveBtn = modal.querySelector(`[data-${FP}-save]`); if(saveBtn) on(saveBtn, "click", () => this._saveActive());
        const finalBtn = modal.querySelector(`[data-${FP}-finalconfirm]`);
        if(finalBtn) on(finalBtn, "click", () => { const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins)); if(!(relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt))){ window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור לפני אישור סופי.", variant: "warn" }); return; } this._showFinalSummary = true; this._render(); });
        const summaryBackBtn = modal.querySelector(`[data-${FP}-summary-back]`); if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
        const summaryConfirmBtn = modal.querySelector(`[data-${FP}-summary-confirm]`); if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => { try{ this._ctx?.onFinalConfirm?.(); }catch(_e){} this.close(); });
      },
      _switchInsured(targetId){ if(!targetId || targetId === this._activeInsuredId) return; if(this._state[this._activeInsuredId]?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; } this._activeInsuredId = targetId; this._render(); },
      _buildResultForInsured(insId){
        const st = this._state[insId]; if(!st) return null; if(!this._syncAge(st).ok) return null;
        if(!st.result?.ok){ const calc = computeClalCiPremium(planId, { age: st.age, gender: st.gender, smoker: st.smoker, compensation: st.compensation }); if(!calc.ok) return null; st.result = calc; st.error = null; }
        const r = st.result;
        return { compensation: formatRiskSimSumInsuredDigits(r.compensation), monthlyPremium: r.monthlyPremium, annualPremium: r.annualPremium, ratePerMille: r.ratePerMille, pdfName: r.pdfName, planId: r.planId, wizardCoverKey: r.wizardCoverKey, birthDate: st.birthDate || "", birthDateSource: st.birthDateSource || "", insuranceStartDate: st.insuranceStartDate || "", age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource, smoker: st.smoker, smokerSource: st.smokerSource, occupation: st.occupation || "", occupationSource: st.occupationSource || "" };
      },
      _apply(){ const results = {}; Object.keys(this._state).forEach((insId) => { const r = this._buildResultForInsured(insId); if(r) results[insId] = r; }); if(!Object.keys(results).length){ window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה תקינה לפני ההחלה.", variant: "warn" }); return; } const onApply = this._ctx?.onApply; this.close(); try{ onApply?.(results); }catch(_e){} },
      _saveActive(){ const insId = this._activeInsuredId; const result = this._buildResultForInsured(insId); if(!result){ window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה תקינה לפני השמירה.", variant: "warn" }); return; } try{ this._ctx?.onApply?.({ [insId]: result }); }catch(_e){} const st = this._state[insId]; if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; } window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר.`, variant: "success" }); this._render(); }
    };
  }
  const ClalCriticalIllnessSimulator = createClalCiSimulator("mediclal_critical");
  const ClalCancerSimulator = createClalCiSimulator("mediclal_cancer");
  RiskSimulators.register("כלל", "מחלות קשות", ClalCriticalIllnessSimulator);
  RiskSimulators.register("כלל", "סרטן", ClalCancerSimulator);
  // ===== סוף GI-CLL-CI-SIM =========================================================

  // ===== GI-CLL-MORT-RISK-SIM 2026-08-12 · ריסק משכנתא כלל (שוהם) ================
  // מקור אמת: גיליון "תעריף למבוטח שוהם" (עדכון גיל תום 85). התעריף הוא פרמיה
  // שנתית לכל 1,000 ₪ סכום ביטוח — אותה יחידה כמו ריסק משכנתא הפניקס. גילי כניסה
  // 18–84 והפוליסה בתוקף עד גיל 85. התעריף הוא "למבוטח" — בזוג מחשבים כל מבוטח
  // בנפרד. אין להמציא, לקרב או להשלים ערך שאינו רשום כאן במפורש, כולל שני
  // המקומות שבהם התעריף זהה בין גילים עוקבים (27→28, 52→53) — מועתקים כמו שהם.
  //
  // דיוק: התעריפון מגיע עד 9 ספרות עשרוניות (למשל 50.201145792). אין לעגל את
  // התעריף לפני ההכפלה — עיגול לאגורות כמו בהפניקס היה מאבד מידע אמיתי כאן.
  //
  // [age, maleNonSmoker, maleSmoker, femaleNonSmoker, femaleSmoker] — שנתית ל-1,000 ₪
  const CLAL_MORT_RISK_MIN_AGE = 18, CLAL_MORT_RISK_MAX_ENTRY_AGE = 84;
  const CLAL_MORT_RISK_POLICY_END_AGE = 85, CLAL_MORT_RISK_MIN_ENTRY_DAYS = 0;
  const CLAL_MORT_RISK_RATE_TABLE = [
    [18, 0.7296, 1.0412, 0.6308, 0.8284], [19, 0.7296, 1.0412, 0.6308, 0.8284], [20, 0.7296, 1.0412, 0.6308, 0.8284],
    [21, 0.7296, 1.0412, 0.6308, 0.8284], [22, 0.7296, 1.0412, 0.6308, 0.8284], [23, 0.7296, 1.0412, 0.6308, 0.8284],
    [24, 0.7296, 1.0412, 0.6308, 0.836], [25, 0.7372, 1.0488, 0.6384, 0.836], [26, 0.7372, 1.0564, 0.6384, 0.836],
    [27, 0.7372, 1.0564, 0.646, 0.8436], [28, 0.7372, 1.0564, 0.646, 0.8436], [29, 0.7372, 1.0564, 0.646, 0.8512],
    [30, 0.7372, 1.0575, 0.646, 0.855], [31, 0.7372, 1.0575, 0.646, 0.87], [32, 0.75, 1.0875, 0.66, 0.8925],
    [33, 0.7725, 1.125, 0.6675, 0.9225], [34, 0.795, 1.17, 0.6975, 0.96], [35, 0.825, 1.23, 0.72, 0.9975],
    [36, 0.8658, 1.295, 0.7474, 1.0434], [37, 0.9102, 1.3986, 0.7844, 1.1322], [38, 0.9694, 1.5022, 0.8214, 1.2062],
    [39, 1.0508, 1.6428, 0.8732, 1.3024], [40, 1.1248, 1.7982, 0.925, 1.4208], [41, 1.2284, 1.9684, 0.9916, 1.554],
    [42, 1.3468, 2.1904, 1.0656, 1.7094], [43, 1.4652, 2.4198, 1.1618, 1.8648], [44, 1.6132, 2.701, 1.258, 2.0572],
    [45, 1.7834, 3.0192, 1.3246, 2.2718], [46, 1.9224, 3.2688, 1.404, 2.412], [47, 2.1384, 3.6432, 1.5336, 2.664],
    [48, 2.376, 4.0968, 1.6632, 2.952], [49, 2.6568, 4.572, 1.836, 3.312], [50, 2.9376, 5.1192, 2.0088, 3.6864],
    [51, 3.2616, 5.7096, 2.2032, 4.0752], [52, 3.47813676, 6.15218814, 2.32499106, 4.38818688], [53, 3.47813676, 6.15218814, 2.32499106, 4.38818688],
    [54, 3.84943104, 6.79202496, 2.54161152, 4.87964736], [55, 4.212243, 7.4843622, 2.7959526, 5.3599266], [56, 4.6700955, 8.3573343, 3.0950829, 5.921559],
    [57, 5.1828903, 9.3585051, 3.4247367, 6.5686572], [58, 5.7567321, 10.4207229, 3.7788093, 7.3195353], [59, 6.4038303, 11.5561971, 4.1389866, 8.1070416],
    [60, 7.0997661, 12.8076606, 4.578525, 9.0166419], [61, 7.50145536, 13.65499296, 4.881806496, 9.622960704], [62, 8.362950624, 15.155284032, 5.379950016, 10.625108256],
    [63, 9.253748448, 16.796227392, 5.936698656, 11.77962912], [64, 10.232453952, 18.595404576, 6.516889344, 13.057220736], [65, 11.22288048, 20.634862752, 7.220150784, 14.452022592],
    [66, 12.477030048, 22.785670656, 7.97029632, 15.9698952], [67, 13.842529344, 25.25880672, 8.837652096, 17.739769824], [68, 15.243191712, 28.01324736, 9.75775248, 19.54480752],
    [69, 16.872414048, 30.902479776, 10.72473696, 21.660452352], [70, 18.759498912, 34.037853696, 11.844094752, 23.799539232], [71, 20.529373536, 37.841325984, 13.074802272, 26.307838368],
    [72, 22.697762976, 41.69754288, 14.287928256, 29.21465232], [73, 25.08299136, 45.700272576, 15.770637792, 32.40863136], [74, 27.538545888, 50.558637024, 17.306091936, 35.901496512],
    [75, 30.216799872, 55.217744064, 19.093548096, 39.722550336], [76, 33.322871232, 60.878998656, 20.945469888, 43.889374368], [77, 36.95052816, 66.75123168, 22.439900448, 48.431271168],
    [78, 40.947397344, 73.057142592, 24.866152416, 53.365822272], [79, 45.354502368, 79.814312928, 27.386172576, 58.72233024], [80, 50.201145792, 86.700414528, 30.70908288, 64.52423712],
    [81, 55.891702944, 92.906696736, 33.797572704, 70.800845472], [82, 63.023946048, 99.3356784, 37.41936912, 77.569736832], [83, 71.035265952, 108.108864864, 41.410377792, 84.866074272],
    [84, 79.984267776, 115.094595168, 45.512736192, 92.701578816]
  ];
  const CLAL_MORT_RISK_RATE_MAP = new Map(
    CLAL_MORT_RISK_RATE_TABLE.map((row) => [row[0], {
      maleNonSmoker: row[1], maleSmoker: row[2], femaleNonSmoker: row[3], femaleSmoker: row[4]
    }])
  );
  /** תצוגת סכום מדויקת — ללא עיגול עסקי, עד 4 ספרות עשרוניות ולא פחות מ-2. */
  function formatClalMortExactAmount(n){
    if(!Number.isFinite(n)) return "";
    let s = n.toFixed(4);
    if(s.indexOf(".") !== -1){
      s = s.replace(/0+$/, "");
      if(s.endsWith(".")) s += "00";
      else if(s.split(".")[1].length === 1) s += "0";
    }
    return s;
  }
  /** התעריף מוצג בדיוק כפי שהוא בתעריפון, כדי שיהיה בר-השוואה מול הדוח של כלל. */
  function formatClalMortRate(n){
    return Number.isFinite(n) ? String(n) : "";
  }
  /** התאמה מדויקת בלבד — ללא קירוב/השלמה בין גילים. */
  function lookupClalMortRiskRate({ age, gender, smoker }){
    // Number("") הוא 0 — בלי הבדיקה הזו גיל ריק היה נחשב גיל תקין
    if(age === "" || age == null) return { ok:false, reason:"age_missing" };
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    const row = CLAL_MORT_RISK_RATE_MAP.get(ageNum);
    if(!row) return { ok:false, reason:"age_out_of_range" };
    const genderKey = gender === "זכר" ? "male" : (gender === "נקבה" ? "female" : "");
    if(!genderKey) return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const rate = row[genderKey + (smoker ? "Smoker" : "NonSmoker")];
    if(typeof rate !== "number" || !Number.isFinite(rate)) return { ok:false, reason:"rate_missing" };
    return { ok:true, ratePerMille: rate };
  }
  /** פרמיה שנתית = (סכום ביטוח / 1000) × תעריף; חודשית = שנתית / 12. */
  function computeClalMortRiskPremium({ age, gender, smoker, sumInsured }){
    const sum = Number(String(sumInsured == null ? "" : sumInsured).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const lookup = lookupClalMortRiskRate({ age, gender, smoker });
    if(!lookup.ok) return lookup;
    const annualPremium = (sum / 1000) * lookup.ratePerMille;
    const monthlyPremium = annualPremium / 12;
    return {
      ok:true, ratePerMille: lookup.ratePerMille, annualPremium, monthlyPremium,
      sumInsured: sum, pdfName: "שוהם משכנתא", policyEndAge: CLAL_MORT_RISK_POLICY_END_AGE
    };
  }
  const CLAL_MORT_RISK_MSG = {
    birth_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.", entry_too_young:"גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
    age_out_of_range:`לא נמצא תעריף לכניסה בגיל זה (טווח כניסה ${CLAL_MORT_RISK_MIN_AGE}–${CLAL_MORT_RISK_MAX_ENTRY_AGE}).`,
    gender_missing:"יש לבחור מין.", smoker_missing:"יש לבחור סטטוס עישון.",
    sum_missing:"יש להזין סכום ביטוח.", rate_missing:"לא נמצא תעריף מתאים."
  };
  const ClalMortgageRiskSimulator = {
    _modal:null,_ctx:null,_state:{},_activeInsuredId:null,_escHandler:null,_confirmSwitch:null,_showFinalSummary:false,
    open(ctx){ this.close(); this._ctx = ctx || {}; const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : []; this._state = {}; insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); }); this._activeInsuredId = insureds[0]?.id || null; this._confirmSwitch = null; this._showFinalSummary = false; this._mount(); this._render(); },
    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : ((d.smoker === true || d.smoker === false) ? d.smoker : null));
      const birthDate = safeTrim(d.birthDate || ""); const occupation = safeTrim(d.occupation || "");
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const sumInsured = formatRiskSimSumInsuredDigits(safeTrim(d.sumInsured || ""));
      const st = { birthDate, birthDateSource: birthDate ? "step1" : "", insuranceStartDate, insuranceStartDateSource: insuranceStartDate ? "ctx" : "", age:"", ageSource: birthDate ? "step1" : "", ageRaw:null, entryDays:null, gender, genderSource: gender ? "step1" : "", smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "", occupation, occupationSource: occupation ? "step1" : "", sumInsured, result:null, error:null, savedAt:null, dirtySinceSave:false };
      this._syncAge(st); return st;
    },
    _syncAge(st){ return riskSimSyncAgeFromBirthDate(st, { minAge: CLAL_MORT_RISK_MIN_AGE, maxAge: CLAL_MORT_RISK_MAX_ENTRY_AGE, minEntryDays: CLAL_MORT_RISK_MIN_ENTRY_DAYS, asOfDate: st?.insuranceStartDate || "" }); },
    _isInsuredRelevant(_ins){ return true; },
    close(){ if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; } if(this._modal){ const m = this._modal; m.classList.add("giValModal--leaving"); window.setTimeout(() => m.remove(), 200); this._modal = null; } this._ctx = null; },
    _mount(){ const modal = document.createElement("div"); modal.id = "lcClalMortModal"; modal.className = "giValModal lcClalMortModal"; modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-label","סימולטור ריסק משכנתא כלל · שוהם"); document.body.appendChild(modal); this._modal = modal; this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); }; document.addEventListener("keydown", this._escHandler); requestAnimationFrame(() => modal.classList.add("giValModal--visible")); },
    _getInsuredLabel(insId){ const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId); return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח"; },
    _calc(insId){
      const st = this._state[insId]; if(!st) return;
      const ageSync = this._syncAge(st);
      if(!ageSync.ok){ st.result = null; st.error = CLAL_MORT_RISK_MSG[ageSync.reason] || CLAL_MORT_RISK_MSG.birth_missing; this._render(); return; }
      const calc = computeClalMortRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: st.sumInsured });
      if(calc.ok){ st.result = calc; st.error = null; }
      else { st.result = null; st.error = CLAL_MORT_RISK_MSG[calc.reason] || "לא ניתן לחשב את הפרמיה."; }
      this._render();
    },
    _render(){
      if(!this._modal) return;
      const P = "lcClalMort";
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const isMulti = insureds.length > 1;
      if(this._showFinalSummary){ this._renderFinalSummary(insureds); return; }
      const activeId = this._activeInsuredId; const st = this._state[activeId] || this._prefillFromInsured(null); const isStandalone = !!this._ctx?.standalone;
      const tabsHtml = isMulti ? `<div class="${P}__tabs">${insureds.map((ins) => { const s = this._state[ins.id]; const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : ""); return `<button type="button" class="${P}__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-clalmort-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`; }).join("")}</div>` : "";
      const ageSync = this._syncAge(st);
      const ageHintHtml = !st.birthDate ? `<div class="${P}__hint ${P}__hint--warn">${isStandalone ? "יש להזין תאריך לידה" : "לא נמצא תאריך לידה — יש להזין"}</div>` : (!ageSync.ok ? `<div class="${P}__hint ${P}__hint--warn">${escapeHtml(CLAL_MORT_RISK_MSG[ageSync.reason] || "תאריך לא תקין")}</div>` : `<div class="${P}__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(ageSync.age))}</strong> (כניסה ${CLAL_MORT_RISK_MIN_AGE}–${CLAL_MORT_RISK_MAX_ENTRY_AGE})</div>`);
      const genderHintHtml = (isStandalone || st.gender) ? "" : `<div class="${P}__hint ${P}__hint--warn">יש לבחור מין</div>`;
      const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false) ? "" : `<div class="${P}__hint ${P}__hint--warn">יש לבחור סטטוס עישון</div>`;
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company) ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini") : "🏠";
      const occBlockHtml = renderOccupationRiskBlockHtml(assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product), P);
      const resultHtml = st.error ? `<div class="${P}__result ${P}__result--error">${escapeHtml(st.error)}</div>` : (st.result ? `<div class="${P}__result ${P}__result--ok"><div class="${P}__resultRow"><span>מסלול</span><strong>${escapeHtml(st.result.pdfName)}</strong></div><div class="${P}__resultRow"><span>תעריף שנתי ל-₪1,000</span><strong>${escapeHtml(formatClalMortRate(st.result.ratePerMille))}</strong></div><div class="${P}__resultRow"><span>סכום ביטוח</span><strong>₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.sumInsured))}</strong></div><div class="${P}__resultRow ${P}__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatClalMortExactAmount(st.result.monthlyPremium))}</strong></div><div class="${P}__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatClalMortExactAmount(st.result.annualPremium))}</strong></div><div class="${P}__rateNote">תעריף למבוטח · משתנה כל שנה לפי הגיל · הפוליסה בתוקף עד גיל ${CLAL_MORT_RISK_POLICY_END_AGE} · הפרמיה לפני חבילות הנחה</div></div>` : `<div class="${P}__result ${P}__result--empty">מלאו את השדות ולחצו "חשב פרמיה"</div>`);
      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
      const footHtml = isStandalone ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn btn--primary" data-clalmort-close="1">סגור</button></div>` : (!isMulti ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-clalmort-close="1">ביטול</button><button type="button" class="btn btn--primary" data-clalmort-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button></div>` : `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-clalmort-close="1">ביטול</button><button type="button" class="btn btn--secondary" data-clalmort-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button><button type="button" class="btn btn--primary" data-clalmort-finalconfirm="1"${allSaved ? "" : " disabled"}>אישור סופי</button></div>`);
      const confirmOverlayHtml = this._confirmSwitch ? `<div class="${P}__overlay"><div class="${P}__overlayCard"><div class="${P}__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}.</div><div class="${P}__overlayBtns"><button type="button" class="btn btn--primary" data-clalmort-switch="save">שמור ועבור</button><button type="button" class="btn btn--secondary" data-clalmort-switch="discard">עבור ללא שמירה</button><button type="button" class="btn" data-clalmort-switch="cancel">ביטול</button></div></div></div>` : "";
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-clalmort-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span><div class="giValModal__headText"><div class="giValModal__title">סימולטור ריסק משכנתא כלל · שוהם</div><div class="giValModal__sub">תעריף שנתי לכל ₪1,000 סכום ביטוח</div></div><button type="button" class="${P}__closeX" data-clalmort-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${tabsHtml}${isStandalone ? `<div class="${P}__insuredLabel ${P}__insuredLabel--standalone">מצב חישוב עצמאי</div>` : `<div class="${P}__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}<div class="${P}__grid"><div class="${P}__field"><label class="${P}__label">תאריך לידה</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-clalmort-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />${ageHintHtml}</div><div class="${P}__field"><label class="${P}__label">תחילת ביטוח</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-clalmort-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" /></div><div class="${P}__field"><label class="${P}__label">מין</label><div class="${P}__segmented"><button type="button" class="${P}__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-clalmort-field="gender" data-clalmort-value="זכר">זכר</button><button type="button" class="${P}__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-clalmort-field="gender" data-clalmort-value="נקבה">נקבה</button></div>${genderHintHtml}</div><div class="${P}__field"><label class="${P}__label">עישון</label><div class="${P}__segmented"><button type="button" class="${P}__segBtn${st.smoker === false ? " is-active" : ""}" data-clalmort-field="smoker" data-clalmort-value="0">לא מעשן/ת</button><button type="button" class="${P}__segBtn${st.smoker === true ? " is-active" : ""}" data-clalmort-field="smoker" data-clalmort-value="1">מעשן/ת</button></div>${smokerHintHtml}</div><div class="${P}__field"><label class="${P}__label">סכום ביטוח</label><input class="${P}__input" type="text" inputmode="numeric" data-clalmort-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="1,000,000" /></div><div class="${P}__field ${P}__field--wide"><label class="${P}__label">עיסוק</label><input class="${P}__input" type="text" data-clalmort-field="occupation" value="${escapeHtml(st.occupation || "")}" autocomplete="off" /></div></div><div class="${P}__actions"><button type="button" class="btn btn--primary" data-clalmort-calc="1">חשב פרמיה</button></div>${occBlockHtml}${resultHtml}</div>${footHtml}${confirmOverlayHtml}</div>`;
      this._bind();
    },
    _renderFinalSummary(insureds){
      const P = "lcClalMort";
      const rows = insureds.filter((ins) => this._isInsuredRelevant(ins)).map((ins) => { const ok = !!this._state[ins.id]?.savedAt; return `<div class="${P}__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`; }).join("");
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-clalmort-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><div class="giValModal__headText"><div class="giValModal__title">סיכום סימולטור להצעה</div></div><button type="button" class="${P}__closeX" data-clalmort-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${rows}</div><div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-clalmort-summary-back="1">חזרה</button><button type="button" class="btn btn--primary" data-clalmort-summary-confirm="1">אישור סופי</button></div></div>`;
      this._bind();
    },
    _bind(){
      const modal = this._modal; if(!modal) return;
      ensureSegFieldDelegation(modal, this, "clalmort");
      $$("[data-clalmort-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-clalmort-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-clalmort-tab"))));
      $$("[data-clalmort-switch]", modal).forEach((el) => on(el, "click", () => { const action = el.getAttribute("data-clalmort-switch"); const target = this._confirmSwitch?.targetId; this._confirmSwitch = null; if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); } else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); } else this._render(); }));
      bindRiskSimDmyField(modal, '[data-clalmort-field="birthDate"]', { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.ageSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
      bindRiskSimDmyField(modal, '[data-clalmort-field="insuranceStartDate"]', { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val; st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val || riskSimTodayDmy(); st.insuranceStartDateSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
      const sumInput = modal.querySelector('[data-clalmort-field="sumInsured"]');
      if(sumInput) on(sumInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; const formatted = formatRiskSimSumInsuredDigits(sumInput.value); sumInput.value = formatted; try{ sumInput.setSelectionRange(formatted.length, formatted.length); }catch(_e){} st.sumInsured = formatted; st.result = null; st.error = null; st.dirtySinceSave = true; });
      const occInput = modal.querySelector('[data-clalmort-field="occupation"]');
      if(occInput){ on(occInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; st.occupation = safeTrim(occInput.value); st.occupationSource = "manual"; st.dirtySinceSave = true; }); on(occInput, "change", () => this._render()); on(occInput, "blur", () => this._render()); }
      const calcBtn = modal.querySelector("[data-clalmort-calc]"); if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
      const applyBtn = modal.querySelector("[data-clalmort-apply]"); if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-clalmort-save]"); if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-clalmort-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => { const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins)); if(!(relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt))){ window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור לפני אישור סופי.", variant: "warn" }); return; } this._showFinalSummary = true; this._render(); });
      const summaryBackBtn = modal.querySelector("[data-clalmort-summary-back]"); if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-clalmort-summary-confirm]"); if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => { try{ this._ctx?.onFinalConfirm?.(); }catch(_e){} this.close(); });
    },
    _switchInsured(targetId){ if(!targetId || targetId === this._activeInsuredId) return; if(this._state[this._activeInsuredId]?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; } this._activeInsuredId = targetId; this._render(); },
    _buildResultForInsured(insId){
      const st = this._state[insId]; if(!st) return null; if(!this._syncAge(st).ok) return null;
      if(!st.result?.ok){ const calc = computeClalMortRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: st.sumInsured }); if(!calc.ok) return null; st.result = calc; st.error = null; }
      const r = st.result;
      return { sumInsured: formatRiskSimSumInsuredDigits(r.sumInsured), monthlyPremium: r.monthlyPremium, annualPremium: r.annualPremium, ratePerMille: r.ratePerMille, pdfName: r.pdfName, policyEndAge: r.policyEndAge, birthDate: st.birthDate || "", birthDateSource: st.birthDateSource || "", insuranceStartDate: st.insuranceStartDate || "", age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource, smoker: st.smoker, smokerSource: st.smokerSource, occupation: st.occupation || "", occupationSource: st.occupationSource || "" };
    },
    _apply(){ const results = {}; Object.keys(this._state).forEach((insId) => { const r = this._buildResultForInsured(insId); if(r) results[insId] = r; }); if(!Object.keys(results).length){ window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה תקינה לפני ההחלה.", variant: "warn" }); return; } const onApply = this._ctx?.onApply; this.close(); try{ onApply?.(results); }catch(_e){} },
    _saveActive(){ const insId = this._activeInsuredId; const result = this._buildResultForInsured(insId); if(!result){ window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה תקינה לפני השמירה.", variant: "warn" }); return; } try{ this._ctx?.onApply?.({ [insId]: result }); }catch(_e){} const st = this._state[insId]; if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; } window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר.`, variant: "success" }); this._render(); }
  };
  RiskSimulators.register("כלל", "ריסק משכנתא", ClalMortgageRiskSimulator);
  // ===== סוף GI-CLL-MORT-RISK-SIM ==================================================


  // ===== GI-CLL-RISK-SIM 2026-08-12 · ריסק כלל (ספיר) ===========================
  // מקור אמת: גיליון "05-2025" בקובץ תעריפי ספיר ("החל מ- 1.7.2025"). הגיליון
  // "2021" שבאותו קובץ הוא היסטוריה ואינו בשימוש. התעריף הוא פרמיה שנתית לכל
  // 1,000 ₪ סכום ביטוח — אותה יחידה כמו שוהם וריסק משכנתא הפניקס.
  //
  // חדש במערכת: לתעריפון יש מימד של להקת סכום ביטוח. בכל גיל יש שמונה תעריפים —
  // שתי להקות ("עד 500 אש״ח" ו-"מ-500 אש״ח") × מין × עישון. אין אינטרפולציה בין
  // הלהקות: 500,000 ₪ בדיוק שייך ללהקה הנמוכה, ומעליו הגבוהה.
  //
  // הפוליסה בתוקף עד גיל 80 (מאושר גם בתסריט המכירה של ספיר ב-app.js), הכניסה
  // עד גיל 67, והטבלה נחתכת בגיל 80. בגיליון קיימים תעריפים עד גיל 99 אך הם
  // מחוץ לתקופת הביטוח ולכן לא הועברו לכאן.
  //
  // דיוק: התעריפון מגיע עד 12 ספרות עשרוניות. אין לעגל את התעריף לפני ההכפלה.
  // הערכים כאן עוגלו ל-9 ספרות כדי להסיר רעש בינארי של Excel בלבד — הסטייה
  // המקסימלית היא 5·10⁻¹⁰, כלומר 2.5·10⁻⁶ ₪ בפרמיה שנתית על סכום ביטוח של 5M.
  //
  // חריגויות שקיימות בתעריפון עצמו ולא "תוקנו" כאן:
  //   · בגילים 18–19 התעריף בלהקה הגבוהה יקר מהנמוכה אצל גברים לא-מעשנים.
  //   · מגיל 70 התעריף בלהקה הגבוהה יקר מהנמוכה אצל מעשנים ומעשנות.
  //   · עדכון 2025 נגע רק בעמודות הלא-מעשנים; עמודות המעשנים זהות ל-2021.
  //
  // [age, mNS_low, mS_low, fNS_low, fS_low, mNS_high, mS_high, fNS_high, fS_high]
  const CLAL_RISK_MIN_AGE = 18, CLAL_RISK_MAX_ENTRY_AGE = 67;
  const CLAL_RISK_MAX_TABLE_AGE = 80, CLAL_RISK_POLICY_END_AGE = 80;
  const CLAL_RISK_MIN_ENTRY_DAYS = 0;
  // גבול הלהקות: "עד 500 אש״ח" כולל את 500,000 עצמו.
  const CLAL_RISK_BAND_THRESHOLD = 500000;
  // מתחת לגבול ובטווח הזה מוצגת השוואה ללהקה הגבוהה — מפל התעריף אמיתי ומשמעותי.
  const CLAL_RISK_BAND_HINT_FROM = 450000;
  const CLAL_RISK_BAND_HINT_SUM = 501000;
  const CLAL_RISK_RATE_TABLE = [
    [18, 0.657, 1.2802, 0.60225, 1.2876, 0.6643, 0.9344, 0.5475, 0.7446],
    [19, 0.6624, 1.2802, 0.60225, 1.2876, 0.6643, 0.9344, 0.5475, 0.7446],
    [20, 0.6696, 1.2802, 0.60225, 1.2876, 0.6643, 0.9344, 0.5475, 0.7446],
    [21, 0.675, 1.2802, 0.60225, 1.2876, 0.6643, 0.9344, 0.5475, 0.7446],
    [22, 0.684, 1.2802, 0.60225, 1.2876, 0.6643, 0.9417, 0.5475, 0.7446],
    [23, 0.6912, 1.2802, 0.60225, 1.2876, 0.6643, 0.9417, 0.5475, 0.7446],
    [24, 0.702, 1.2802, 0.60225, 1.2876, 0.6643, 0.9417, 0.5475, 0.7446],
    [25, 0.7128, 1.2876, 0.61028, 1.295, 0.6716, 0.949, 0.5548, 0.7519],
    [26, 0.7254, 1.2876, 0.61028, 1.295, 0.6716, 0.9563, 0.5548, 0.7592],
    [27, 0.7398, 1.2876, 0.61831, 1.295, 0.6716, 0.9636, 0.5621, 0.7592],
    [28, 0.7578, 1.295, 0.61831, 1.3024, 0.6716, 0.9636, 0.5621, 0.7592],
    [29, 0.7758, 1.295, 0.62634, 1.3024, 0.6789, 0.9709, 0.5694, 0.7665],
    [30, 0.7974, 1.3024, 0.63437, 1.3098, 0.6789, 0.9709, 0.5767, 0.7738],
    [31, 0.8208, 1.3024, 0.6424, 1.3172, 0.6862, 0.9782, 0.584, 0.7811],
    [32, 0.8478, 1.3098, 0.65043, 1.3246, 0.7008, 1.0074, 0.5913, 0.803],
    [33, 0.8802, 1.3468, 0.66, 1.3394, 0.72, 1.0439, 0.6, 0.8322],
    [34, 0.9144, 1.3912, 0.682, 1.3542, 0.74, 1.0877, 0.62, 0.8687],
    [35, 0.9558, 1.4578, 0.704, 1.369, 0.77, 1.1461, 0.64, 0.9052],
    [36, 1.0008, 1.554, 0.748, 1.3912, 0.82, 1.2264, 0.68, 0.9563],
    [37, 1.053, 1.6724, 0.792, 1.4948, 0.86, 1.3286, 0.72, 1.0439],
    [38, 1.1106, 1.7834, 0.825, 1.5836, 0.92, 1.4235, 0.75, 1.1169],
    [39, 1.1772, 1.9462, 0.88, 1.6872, 1, 1.5622, 0.8, 1.2045],
    [40, 1.2528, 2.109, 0.935, 1.813, 1.06, 1.7082, 0.85, 1.3213],
    [41, 1.3392, 2.3014, 1.001, 1.9684, 1.1718, 1.8761, 0.91, 1.4454],
    [42, 1.4364, 2.553, 1.078, 2.146, 1.2569, 2.0878, 0.98, 1.5987],
    [43, 1.548, 2.8046, 1.166, 2.3532, 1.3545, 2.3068, 1.06, 1.7739],
    [44, 1.6722, 3.108, 1.265, 2.5604, 1.4632, 2.5769, 1.15, 1.9564],
    [45, 1.8144, 3.4558, 1.364, 2.7898, 1.5876, 2.8835, 1.24, 2.1608],
    [46, 1.9764, 3.8184, 1.518, 3.0858, 1.7294, 3.212, 1.38, 2.4163],
    [47, 2.16, 4.2328, 1.65, 3.3818, 1.89, 3.5916, 1.5, 2.6791],
    [48, 2.367, 4.7212, 1.815, 3.7074, 2.0711, 4.0369, 1.65, 2.9784],
    [49, 2.6046, 5.2318, 2.013, 4.1218, 2.279, 4.5187, 1.83, 3.3434],
    [50, 2.871, 5.8164, 2.2, 4.5214, 2.5121, 5.0662, 2, 3.723],
    [51, 3.1752, 6.4306, 2.42, 4.9432, 2.7783, 5.6502, 2.2, 4.1172],
    [52, 3.519, 7.1114, 2.673, 5.4908, 3.0791, 5.657367273, 2.43, 4.6282],
    [53, 3.9096, 7.8884, 2.736081633, 5.994, 3.4209, 5.719416788, 2.48, 4.6282],
    [54, 4.0786875, 8.732, 3.030073469, 6.6674, 3.598361111, 5.719416788, 2.7, 4.839443194],
    [55, 4.247775, 9.6422, 3.358995918, 7.3186, 3.775822222, 6.036845825, 2.96, 5.2898832],
    [56, 4.745475, 9.748743075, 3.731110204, 7.3186, 4.218222222, 6.620071336, 3.26, 5.846076634],
    [57, 5.309325, 9.870006944, 4.06516, 7.595400595, 4.719377778, 7.368365422, 3.59, 6.318038954],
    [58, 5.95035, 10.1726976, 4.435545098, 8.268747746, 5.289244444, 8.106210212, 3.97, 6.871928139],
    [59, 6.67485, 11.19456, 4.941458824, 9.135287965, 5.933244444, 9.149715973, 4.38, 7.576181723],
    [60, 7.497, 12.3082752, 5.511301961, 10.270320861, 6.664, 10.296415848, 4.86, 8.492754817],
    [61, 8.427825, 13.786795791, 6.149733333, 11.749239142, 7.491377778, 11.782127695, 5.38, 9.711305576],
    [62, 9.483075, 15.424403304, 6.867968627, 13.415673802, 8.429422222, 13.249356843, 5.96, 11.187807476],
    [63, 10.680075, 17.29275981, 7.7846125, 15.258617039, 9.493422222, 14.860659097, 6.62, 12.83688819],
    [64, 12.033, 19.214693743, 8.69325, 17.199709789, 10.696, 16.490681888, 7.7, 14.590605495],
    [65, 13.56705, 21.577124464, 9.940834667, 18.892419152, 12.059644444, 18.51970937, 8.65, 16.189428226],
    [66, 15.304275, 24.002258747, 11.125752, 20.617802999, 13.603822222, 20.588901883, 9.7, 17.725365667],
    [67, 17.269875, 26.969147392, 12.457801333, 22.671577547, 15.351022222, 23.18208237, 10.3, 19.485434547],
    [68, 19.49535, 30.163532404, 13.951812, 25.114947434, 17.329244444, 25.903671287, 11.71, 21.605402593],
    [69, 22.013775, 32.818851327, 15.630921333, 28.147385394, 19.567822222, 28.194093549, 13.2, 24.209085104],
    [70, 24.86295, 35.157101177, 17.516658667, 31.903943835, 22.100444444, 35.62378704, 16.1, 32.409345808],
    [71, 28.0854, 40.121075928, 19.63368, 36.485538771, 24.9648, 40.661314675, 18.4, 37.035290833],
    [72, 31.728375, 46.010383345, 22.010214667, 42.590299783, 28.203022222, 46.636706072, 21.12, 43.221860931],
    [73, 35.845425, 52.440676953, 24.676010667, 48.2549225, 31.862577778, 53.128279667, 23.82, 48.992406497],
    [74, 40.4964, 59.427884551, 27.668945333, 54.170296625, 35.9968, 60.182793183, 26.49, 54.984349834],
    [75, 45.7506, 65.571943285, 31.027164, 60.351841666, 40.6672, 66.499371148, 29.41, 61.205965072],
    [76, 51.680475, 68.613428234, 34.793636, 63.502198289, 45.938222222, 69.461424104, 34.06, 64.430640596],
    [77, 58.3695, 75.278953138, 39.017852, 72.580752309, 51.884, 76.254290392, 37.2, 73.670987787],
    [78, 65.912175, 82.541079725, 43.751089333, 80.104052712, 58.588622222, 83.595741175, 41.3, 81.335429319],
    [79, 74.410875, 90.332455476, 49.057757333, 88.818088367, 66.143022222, 91.526676802, 46.7, 90.213818621],
    [80, 83.977425, 98.447448824, 55.000746667, 96.629408565, 74.646577778, 99.705680322, 49.56, 98.132384288]
  ];
  const CLAL_RISK_RATE_MAP = new Map(
    CLAL_RISK_RATE_TABLE.map((row) => [row[0], {
      low:  { maleNonSmoker: row[1], maleSmoker: row[2], femaleNonSmoker: row[3], femaleSmoker: row[4] },
      high: { maleNonSmoker: row[5], maleSmoker: row[6], femaleNonSmoker: row[7], femaleSmoker: row[8] }
    }])
  );
  /** להקת התעריף נקבעת מסכום הביטוח; 500,000 בדיוק שייך ל"עד 500 אש״ח". */
  function resolveClalRiskBand(sum){
    return sum <= CLAL_RISK_BAND_THRESHOLD ? "low" : "high";
  }
  const CLAL_RISK_BAND_LABEL = { low: 'עד 500 אש״ח', high: 'מ-500 אש״ח' };
  /** תצוגת סכום מדויקת — ללא עיגול עסקי, עד 4 ספרות עשרוניות ולא פחות מ-2. */
  function formatClalRiskExactAmount(n){
    if(!Number.isFinite(n)) return "";
    let s = n.toFixed(4);
    if(s.indexOf(".") !== -1){
      s = s.replace(/0+$/, "");
      if(s.endsWith(".")) s += "00";
      else if(s.split(".")[1].length === 1) s += "0";
    }
    return s;
  }
  /** התעריף מוצג בדיוק כפי שהוא בתעריפון, כדי שיהיה בר-השוואה מול הדוח של כלל. */
  function formatClalRiskRate(n){
    return Number.isFinite(n) ? String(n) : "";
  }
  /** התאמה מדויקת בלבד — ללא קירוב/השלמה בין גילים או בין להקות. */
  function lookupClalRiskRate({ age, gender, smoker, band }){
    // Number("") הוא 0 — בלי הבדיקה הזו גיל ריק היה נחשב גיל תקין
    if(age === "" || age == null) return { ok:false, reason:"age_missing" };
    const ageNum = Number(age);
    if(!Number.isInteger(ageNum)) return { ok:false, reason:"age_missing" };
    const row = CLAL_RISK_RATE_MAP.get(ageNum);
    if(!row) return { ok:false, reason:"age_out_of_range" };
    const bandRow = row[band === "high" ? "high" : "low"];
    if(!bandRow) return { ok:false, reason:"rate_missing" };
    const genderKey = gender === "זכר" ? "male" : (gender === "נקבה" ? "female" : "");
    if(!genderKey) return { ok:false, reason:"gender_missing" };
    if(smoker !== true && smoker !== false) return { ok:false, reason:"smoker_missing" };
    const rate = bandRow[genderKey + (smoker ? "Smoker" : "NonSmoker")];
    if(typeof rate !== "number" || !Number.isFinite(rate)) return { ok:false, reason:"rate_missing" };
    return { ok:true, ratePerMille: rate };
  }
  /** פרמיה שנתית = (סכום ביטוח / 1000) × תעריף; חודשית = שנתית / 12.
      הטבלה מגיעה עד גיל 80 כי הפרמיה מחושבת מחדש כל שנה לפי הגיל, אבל *כניסה*
      חדשה מותרת רק עד 67 — ולכן החסימה כאן ולא ב-lookup, שהוא תעריפון טהור. */
  function computeClalRiskPremium({ age, gender, smoker, sumInsured }){
    const sum = Number(String(sumInsured == null ? "" : sumInsured).replace(/[^\d.-]/g, ""));
    if(!Number.isFinite(sum) || sum <= 0) return { ok:false, reason:"sum_missing" };
    const entryAge = Number(age);
    if(Number.isInteger(entryAge) && entryAge > CLAL_RISK_MAX_ENTRY_AGE) return { ok:false, reason:"age_out_of_range" };
    const band = resolveClalRiskBand(sum);
    const lookup = lookupClalRiskRate({ age, gender, smoker, band });
    if(!lookup.ok) return lookup;
    const annualPremium = (sum / 1000) * lookup.ratePerMille;
    // מפל הלהקות: מתחת לגבול ובטווח הרמז, מחשבים גם את החלופה בלהקה הגבוהה.
    let bandHint = null;
    if(band === "low" && sum >= CLAL_RISK_BAND_HINT_FROM){
      const alt = lookupClalRiskRate({ age, gender, smoker, band:"high" });
      if(alt.ok){
        const altAnnual = (CLAL_RISK_BAND_HINT_SUM / 1000) * alt.ratePerMille;
        if(altAnnual < annualPremium){
          bandHint = {
            sumInsured: CLAL_RISK_BAND_HINT_SUM, ratePerMille: alt.ratePerMille,
            annualPremium: altAnnual, monthlyPremium: altAnnual / 12,
            savingPct: (1 - altAnnual / annualPremium) * 100
          };
        }
      }
    }
    return {
      ok:true, ratePerMille: lookup.ratePerMille, annualPremium, monthlyPremium: annualPremium / 12,
      sumInsured: sum, band, bandLabel: CLAL_RISK_BAND_LABEL[band], bandHint,
      pdfName: "ספיר", policyEndAge: CLAL_RISK_POLICY_END_AGE
    };
  }
  /** התפתחות פרמיה — טבלת הגילוי המלאה מגיל הכניסה ועד תום הביטוח בגיל 80.
      ספיר היא פוליסת פרמיה משתנה: הפרמיה מחושבת מחדש בכל שנת ביטוח לפי הגיל
      שהמבוטח הגיע אליו, ולכן הפרמיה של השנה הראשונה אינה הפרמיה שתשולם בהמשך
      (גבר לא-מעשן שנכנס בגיל 40 עם מיליון ₪ משלם 88 ₪ בשנה הראשונה ו-6,220 ₪
      בגיל 80). כאן משתלמת ההפרדה בין lookupClalRiskRate, שהוא תעריפון טהור
      לגילים 18–80, לבין computeClalRiskPremium שחוסם כניסה מעל 67.

      הלהקה נקבעת פעם אחת מסכום הביטוח ואינה משתנה לאורך התחזית.

      הסכומים במונחי המדד הידוע היום. סכום הביטוח בספיר צמוד למדד, אך הצמדה
      עתידית אינה נתון אלא הנחה: 2% לשנה מול 3% לשנה משנים את סך הפרמיות
      בתרחיש שלמעלה מ-1.26M ל-1.74M ₪, כלומר המספרים היו משקפים את ההנחה
      שלנו ולא את התעריפון של כלל. בנוסף, בסכומים מתחת ל-500,000 ₪ הצמדה
      הייתה חוצה את גבול הלהקות באמצע התחזית ומציגה *ירידת* פרמיה בגיל מתקדם
      יותר — ארטיפקט של מפל הלהקות, לא של התעריף. */
  function buildClalRiskProjection({ age, gender, smoker, sumInsured }){
    const base = computeClalRiskPremium({ age, gender, smoker, sumInsured });
    if(!base.ok) return base;
    const entryAge = Number(age);
    if(!Number.isInteger(entryAge)) return { ok:false, reason:"age_missing" };
    const rows = [];
    let cumulative = 0;
    for(let a = entryAge; a <= CLAL_RISK_POLICY_END_AGE; a++){
      const lookup = lookupClalRiskRate({ age:a, gender, smoker, band: base.band });
      if(!lookup.ok) return { ok:false, reason: lookup.reason };
      const annualPremium = (base.sumInsured / 1000) * lookup.ratePerMille;
      cumulative += annualPremium;
      rows.push({
        policyYear: a - entryAge + 1, age:a, ratePerMille: lookup.ratePerMille,
        annualPremium, monthlyPremium: annualPremium / 12, cumulative
      });
    }
    const first = rows[0], last = rows[rows.length - 1];
    return {
      ok:true, rows, entryAge, endAge: CLAL_RISK_POLICY_END_AGE,
      band: base.band, bandLabel: base.bandLabel, sumInsured: base.sumInsured,
      totalPremiums: cumulative, lastMonthlyPremium: last.monthlyPremium,
      growthFactor: first.monthlyPremium > 0 ? last.monthlyPremium / first.monthlyPremium : null,
      exceedsSumInsured: cumulative > base.sumInsured
    };
  }
  const CLAL_RISK_MSG = {
    birth_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.", entry_too_young:"גיל הכניסה המינימלי הוא 0 ימים.",
    age_missing:"יש להזין תאריך לידה תקין לפני חישוב הפרמיה.",
    age_out_of_range:`לא נמצא תעריף לכניסה בגיל זה (טווח כניסה ${CLAL_RISK_MIN_AGE}–${CLAL_RISK_MAX_ENTRY_AGE}; טבלה עד ${CLAL_RISK_MAX_TABLE_AGE}).`,
    gender_missing:"יש לבחור מין.", smoker_missing:"יש לבחור סטטוס עישון.",
    sum_missing:"יש להזין סכום ביטוח.", rate_missing:"לא נמצא תעריף מתאים."
  };
  const ClalRiskSimulator = {
    _modal:null,_ctx:null,_state:{},_activeInsuredId:null,_escHandler:null,_confirmSwitch:null,_showFinalSummary:false,
    open(ctx){ this.close(); this._ctx = ctx || {}; const insureds = Array.isArray(ctx?.insureds) ? ctx.insureds : []; this._state = {}; insureds.forEach((ins) => { this._state[ins.id] = this._prefillFromInsured(ins); }); this._activeInsuredId = insureds[0]?.id || null; this._confirmSwitch = null; this._showFinalSummary = false; this._mount(); this._render(); },
    _prefillFromInsured(ins){
      const d = ins?.data || {};
      const gender = (d.gender === "זכר" || d.gender === "נקבה") ? d.gender : "";
      const smoker = d.smokingStatus === "yes" ? true : (d.smokingStatus === "no" ? false : ((d.smoker === true || d.smoker === false) ? d.smoker : null));
      const birthDate = safeTrim(d.birthDate || ""); const occupation = safeTrim(d.occupation || "");
      const insuranceStartDate = resolveInsuranceStartDate(this._ctx, ins);
      const sumInsured = formatRiskSimSumInsuredDigits(safeTrim(d.sumInsured || ""));
      const st = { birthDate, birthDateSource: birthDate ? "step1" : "", insuranceStartDate, insuranceStartDateSource: insuranceStartDate ? "ctx" : "", age:"", ageSource: birthDate ? "step1" : "", ageRaw:null, entryDays:null, gender, genderSource: gender ? "step1" : "", smoker, smokerSource: (smoker === true || smoker === false) ? "step1" : "", occupation, occupationSource: occupation ? "step1" : "", sumInsured, result:null, error:null, savedAt:null, dirtySinceSave:false, showProjection:false };
      this._syncAge(st); return st;
    },
    _syncAge(st){ return riskSimSyncAgeFromBirthDate(st, { minAge: CLAL_RISK_MIN_AGE, maxAge: CLAL_RISK_MAX_ENTRY_AGE, minEntryDays: CLAL_RISK_MIN_ENTRY_DAYS, asOfDate: st?.insuranceStartDate || "" }); },
    _isInsuredRelevant(_ins){ return true; },
    close(){ if(this._escHandler){ document.removeEventListener("keydown", this._escHandler); this._escHandler = null; } if(this._modal){ const m = this._modal; m.classList.add("giValModal--leaving"); window.setTimeout(() => m.remove(), 200); this._modal = null; } this._ctx = null; },
    _mount(){ const modal = document.createElement("div"); modal.id = "lcClalRiskModal"; modal.className = "giValModal lcClalRiskModal"; modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-label","סימולטור ריסק כלל · ספיר"); document.body.appendChild(modal); this._modal = modal; this._escHandler = (ev) => { if(ev.key === "Escape") this.close(); }; document.addEventListener("keydown", this._escHandler); requestAnimationFrame(() => modal.classList.add("giValModal--visible")); },
    _getInsuredLabel(insId){ const ins = (Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []).find((x) => x.id === insId); return ins ? safeTrim(ins.label) || "מבוטח" : "מבוטח"; },
    _calc(insId){
      const st = this._state[insId]; if(!st) return;
      const ageSync = this._syncAge(st);
      if(!ageSync.ok){ st.result = null; st.error = CLAL_RISK_MSG[ageSync.reason] || CLAL_RISK_MSG.birth_missing; this._render(); return; }
      const calc = computeClalRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: st.sumInsured });
      if(calc.ok){ st.result = calc; st.error = null; }
      else { st.result = null; st.error = CLAL_RISK_MSG[calc.reason] || "לא ניתן לחשב את הפרמיה."; }
      this._render();
    },
    _render(){
      if(!this._modal) return;
      const P = "lcClalRisk";
      const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const isMulti = insureds.length > 1;
      if(this._showFinalSummary){ this._renderFinalSummary(insureds); return; }
      const activeId = this._activeInsuredId; const st = this._state[activeId] || this._prefillFromInsured(null); const isStandalone = !!this._ctx?.standalone;
      const tabsHtml = isMulti ? `<div class="${P}__tabs">${insureds.map((ins) => { const s = this._state[ins.id]; const statusCls = s?.savedAt ? " has-saved" : (s?.result ? " has-result" : ""); return `<button type="button" class="${P}__tab${ins.id === activeId ? " is-active" : ""}${statusCls}" data-clalrisk-tab="${escapeHtml(ins.id)}">${escapeHtml(safeTrim(ins.label) || "מבוטח")}${s?.savedAt ? " 🟢" : ""}</button>`; }).join("")}</div>` : "";
      const ageSync = this._syncAge(st);
      const ageHintHtml = !st.birthDate ? `<div class="${P}__hint ${P}__hint--warn">${isStandalone ? "יש להזין תאריך לידה" : "לא נמצא תאריך לידה — יש להזין"}</div>` : (!ageSync.ok ? `<div class="${P}__hint ${P}__hint--warn">${escapeHtml(CLAL_RISK_MSG[ageSync.reason] || "תאריך לא תקין")}</div>` : `<div class="${P}__hint">גיל ביטוחי בתחילת הביטוח: <strong>${escapeHtml(String(ageSync.age))}</strong> (כניסה ${CLAL_RISK_MIN_AGE}–${CLAL_RISK_MAX_ENTRY_AGE})</div>`);
      const genderHintHtml = (isStandalone || st.gender) ? "" : `<div class="${P}__hint ${P}__hint--warn">יש לבחור מין</div>`;
      const smokerHintHtml = (isStandalone || st.smoker === true || st.smoker === false) ? "" : `<div class="${P}__hint ${P}__hint--warn">יש לבחור סטטוס עישון</div>`;
      const sumDigits = Number(String(st.sumInsured || "").replace(/[^\d]/g, ""));
      const sumBandHintHtml = sumDigits > 0 ? `<div class="${P}__hint">להקת תעריף: <strong>${escapeHtml(CLAL_RISK_BAND_LABEL[resolveClalRiskBand(sumDigits)])}</strong></div>` : "";
      const headLogoHtml = (typeof renderCompanyLogoHtmlForCompany === "function" && this._ctx?.company) ? renderCompanyLogoHtmlForCompany(this._ctx.company, "mini") : "🛡️";
      const occBlockHtml = renderOccupationRiskBlockHtml(assessOccupationRisk(st.occupation, this._ctx?.company, this._ctx?.product), P);
      const projection = (st.result?.ok && st.showProjection) ? buildClalRiskProjection({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: st.sumInsured }) : null;
      const projToggleHtml = st.result?.ok ? `<button type="button" class="${P}__projToggle${st.showProjection ? " is-open" : ""}" data-clalrisk-proj="1" aria-expanded="${st.showProjection ? "true" : "false"}"><span class="${P}__projToggleIcon" aria-hidden="true">${st.showProjection ? "▲" : "▼"}</span><span>התפתחות פרמיה · גיל ${escapeHtml(String(st.age))}–${CLAL_RISK_POLICY_END_AGE}</span></button>` : "";
      const projectionHtml = projection?.ok ? `<div class="${P}__proj"><div class="${P}__projHead">בספיר הפרמיה מחושבת מחדש בכל שנת ביטוח לפי הגיל שהמבוטח הגיע אליו. להלן כל שנות הביטוח מגיל ${projection.entryAge} עד תום הביטוח בגיל ${projection.endAge}, בלהקת "${escapeHtml(projection.bandLabel)}".</div><div class="${P}__projScroll"><table class="${P}__projTable"><thead><tr><th>שנה</th><th>גיל</th><th>תעריף ל-₪1,000</th><th>חודשי</th><th>שנתי</th><th>מצטבר</th></tr></thead><tbody>${projection.rows.map((r) => `<tr${r.policyYear === 1 ? ` class="${P}__projRow--first"` : ""}><td>${r.policyYear}</td><td>${r.age}</td><td class="${P}__projRate">${escapeHtml(formatClalRiskRate(r.ratePerMille))}</td><td class="${P}__projMonthly"><strong>₪${escapeHtml(riskSimFormatMoneyShekels(r.monthlyPremium))}</strong></td><td>₪${escapeHtml(riskSimFormatMoneyShekels(r.annualPremium))}</td><td>₪${escapeHtml(riskSimFormatMoneyShekels(r.cumulative))}</td></tr>`).join("")}</tbody></table></div><div class="${P}__projTotals"><div class="${P}__projTotalsRow"><span>סה״כ פרמיות עד גיל ${projection.endAge}</span><strong>₪${escapeHtml(riskSimFormatMoneyShekels(projection.totalPremiums))}</strong></div><div class="${P}__projTotalsRow"><span>פרמיה חודשית בגיל ${projection.endAge}</span><strong>₪${escapeHtml(riskSimFormatMoneyShekels(projection.lastMonthlyPremium))}${projection.growthFactor ? ` (פי ${escapeHtml(projection.growthFactor.toFixed(1))} מהשנה הראשונה)` : ""}</strong></div></div>${projection.exceedsSumInsured ? `<div class="${P}__projWarn">סך הפרמיות עד תום הביטוח גבוה מסכום הביטוח (₪${escapeHtml(formatRiskSimSumInsuredDigits(projection.sumInsured))}).</div>` : ""}<div class="${P}__projNote">הסכומים במונחי המדד הידוע היום ולפני חבילות הנחה. סכום הביטוח צמוד למדד, ולכן הסכומים שישולמו בפועל יעלו בהתאם למדד.</div></div>` : "";
      const bandHintRowHtml = st.result?.bandHint ? `<div class="${P}__bandHint"><span class="${P}__bandHintIcon" aria-hidden="true">↑</span><div class="${P}__bandHintText">בהעלאת סכום הביטוח ל-₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.bandHint.sumInsured))} התעריף עובר ללהקת "${escapeHtml(CLAL_RISK_BAND_LABEL.high)}" והפרמיה החודשית תהיה <strong>₪${escapeHtml(formatClalRiskExactAmount(st.result.bandHint.monthlyPremium))}</strong> — זול ב-${escapeHtml(st.result.bandHint.savingPct.toFixed(1))}% עבור סכום ביטוח גבוה יותר.</div></div>` : "";
      const resultHtml = st.error ? `<div class="${P}__result ${P}__result--error">${escapeHtml(st.error)}</div>` : (st.result ? `<div class="${P}__result ${P}__result--ok"><div class="${P}__resultRow"><span>מסלול</span><strong>${escapeHtml(st.result.pdfName)}</strong></div><div class="${P}__resultRow"><span>להקת תעריף</span><strong>${escapeHtml(st.result.bandLabel)}</strong></div><div class="${P}__resultRow"><span>תעריף שנתי ל-₪1,000</span><strong>${escapeHtml(formatClalRiskRate(st.result.ratePerMille))}</strong></div><div class="${P}__resultRow"><span>סכום ביטוח</span><strong>₪${escapeHtml(formatRiskSimSumInsuredDigits(st.result.sumInsured))}</strong></div><div class="${P}__resultRow ${P}__resultRow--main"><span>פרמיה חודשית</span><strong>₪${escapeHtml(formatClalRiskExactAmount(st.result.monthlyPremium))}</strong></div><div class="${P}__resultRow"><span>פרמיה שנתית</span><strong>₪${escapeHtml(formatClalRiskExactAmount(st.result.annualPremium))}</strong></div>${bandHintRowHtml}<div class="${P}__rateNote">התעריף לפי גיל, מין, עישון ולהקת סכום הביטוח · משתנה כל שנה לפי הגיל · הפוליסה בתוקף עד גיל ${CLAL_RISK_POLICY_END_AGE} · הפרמיה לפני חבילות הנחה</div>${projToggleHtml}${projectionHtml}</div>` : `<div class="${P}__result ${P}__result--empty">מלאו את השדות ולחצו "חשב פרמיה"</div>`);
      const anyApplyable = Object.values(this._state).some((s) => s?.result?.ok);
      const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins));
      const allSaved = relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt);
      const footHtml = isStandalone ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn btn--primary" data-clalrisk-close="1">סגור</button></div>` : (!isMulti ? `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-clalrisk-close="1">ביטול</button><button type="button" class="btn btn--primary" data-clalrisk-apply="1"${anyApplyable ? "" : " disabled"}>החל על הפוליסה</button></div>` : `<div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-clalrisk-close="1">ביטול</button><button type="button" class="btn btn--secondary" data-clalrisk-save="1"${st.result?.ok ? "" : " disabled"}>שמור מבוטח זה</button><button type="button" class="btn btn--primary" data-clalrisk-finalconfirm="1"${allSaved ? "" : " disabled"}>אישור סופי</button></div>`);
      const confirmOverlayHtml = this._confirmSwitch ? `<div class="${P}__overlay"><div class="${P}__overlayCard"><div class="${P}__overlayText">קיימים שינויים שלא נשמרו עבור ${escapeHtml(this._getInsuredLabel(activeId))}.</div><div class="${P}__overlayBtns"><button type="button" class="btn btn--primary" data-clalrisk-switch="save">שמור ועבור</button><button type="button" class="btn btn--secondary" data-clalrisk-switch="discard">עבור ללא שמירה</button><button type="button" class="btn" data-clalrisk-switch="cancel">ביטול</button></div></div></div>` : "";
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-clalrisk-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><span class="giValModal__headIcon" aria-hidden="true">${headLogoHtml}</span><div class="giValModal__headText"><div class="giValModal__title">סימולטור ריסק כלל · ספיר</div><div class="giValModal__sub">תעריף שנתי לכל ₪1,000 סכום ביטוח · שתי להקות סכום</div></div><button type="button" class="${P}__closeX" data-clalrisk-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${tabsHtml}${isStandalone ? `<div class="${P}__insuredLabel ${P}__insuredLabel--standalone">מצב חישוב עצמאי</div>` : `<div class="${P}__insuredLabel">מחשב עבור: <strong>${escapeHtml(this._getInsuredLabel(activeId))}</strong></div>`}<div class="${P}__grid"><div class="${P}__field"><label class="${P}__label">תאריך לידה</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-clalrisk-field="birthDate" value="${escapeHtml(st.birthDate || "")}" />${ageHintHtml}</div><div class="${P}__field"><label class="${P}__label">תחילת ביטוח</label><input class="${P}__input ${P}__input--date" type="text" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="DD/MM/YYYY" maxlength="10" data-datefmt="dmy" data-clalrisk-field="insuranceStartDate" value="${escapeHtml(st.insuranceStartDate || "")}" /></div><div class="${P}__field"><label class="${P}__label">מין</label><div class="${P}__segmented"><button type="button" class="${P}__segBtn${st.gender === "זכר" ? " is-active" : ""}" data-clalrisk-field="gender" data-clalrisk-value="זכר">זכר</button><button type="button" class="${P}__segBtn${st.gender === "נקבה" ? " is-active" : ""}" data-clalrisk-field="gender" data-clalrisk-value="נקבה">נקבה</button></div>${genderHintHtml}</div><div class="${P}__field"><label class="${P}__label">עישון</label><div class="${P}__segmented"><button type="button" class="${P}__segBtn${st.smoker === false ? " is-active" : ""}" data-clalrisk-field="smoker" data-clalrisk-value="0">לא מעשן/ת</button><button type="button" class="${P}__segBtn${st.smoker === true ? " is-active" : ""}" data-clalrisk-field="smoker" data-clalrisk-value="1">מעשן/ת</button></div>${smokerHintHtml}</div><div class="${P}__field"><label class="${P}__label">סכום ביטוח</label><input class="${P}__input" type="text" inputmode="numeric" data-clalrisk-field="sumInsured" value="${escapeHtml(st.sumInsured || "")}" placeholder="1,000,000" />${sumBandHintHtml}</div><div class="${P}__field"><label class="${P}__label">עיסוק</label><input class="${P}__input" type="text" data-clalrisk-field="occupation" value="${escapeHtml(st.occupation || "")}" autocomplete="off" /></div></div><div class="${P}__actions"><button type="button" class="btn btn--primary" data-clalrisk-calc="1">חשב פרמיה</button></div>${occBlockHtml}${resultHtml}</div>${footHtml}${confirmOverlayHtml}</div>`;
      this._bind();
    },
    _renderFinalSummary(insureds){
      const P = "lcClalRisk";
      const rows = insureds.filter((ins) => this._isInsuredRelevant(ins)).map((ins) => { const ok = !!this._state[ins.id]?.savedAt; return `<div class="${P}__summaryRow"><span>${ok ? "✓" : "•"}</span><span>${escapeHtml(safeTrim(ins.label) || "מבוטח")}</span><span>${ok ? "הושלם" : "לא נשמר"}</span></div>`; }).join("");
      this._modal.innerHTML = `<div class="giValModal__backdrop" data-clalrisk-close="1"></div><div class="giValModal__card ${P}__card"><div class="giValModal__head"><div class="giValModal__headText"><div class="giValModal__title">סיכום סימולטור להצעה</div></div><button type="button" class="${P}__closeX" data-clalrisk-close="1" aria-label="סגירה">✕</button></div><div class="giValModal__body ${P}__body">${rows}</div><div class="giValModal__foot ${P}__foot"><button type="button" class="btn giValModal__closeBtn" data-clalrisk-summary-back="1">חזרה</button><button type="button" class="btn btn--primary" data-clalrisk-summary-confirm="1">אישור סופי</button></div></div>`;
      this._bind();
    },
    _bind(){
      const modal = this._modal; if(!modal) return;
      ensureSegFieldDelegation(modal, this, "clalrisk");
      $$("[data-clalrisk-close]", modal).forEach((el) => on(el, "click", () => this.close()));
      $$("[data-clalrisk-tab]", modal).forEach((el) => on(el, "click", () => this._switchInsured(el.getAttribute("data-clalrisk-tab"))));
      $$("[data-clalrisk-switch]", modal).forEach((el) => on(el, "click", () => { const action = el.getAttribute("data-clalrisk-switch"); const target = this._confirmSwitch?.targetId; this._confirmSwitch = null; if(action === "save"){ this._saveActive(); if(target) this._activeInsuredId = target; this._render(); } else if(action === "discard"){ if(target) this._activeInsuredId = target; this._render(); } else this._render(); }));
      bindRiskSimDmyField(modal, '[data-clalrisk-field="birthDate"]', { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.birthDate = val; st.birthDateSource = "manual"; st.ageSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
      bindRiskSimDmyField(modal, '[data-clalrisk-field="insuranceStartDate"]', { onInput: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val; st.insuranceStartDateSource = "manual"; st.dirtySinceSave = true; }, onCommit: (val) => { const st = this._state[this._activeInsuredId]; if(!st) return; st.insuranceStartDate = val || riskSimTodayDmy(); st.insuranceStartDateSource = "manual"; st.result = null; st.error = null; st.dirtySinceSave = true; this._syncAge(st); this._render(); } });
      const sumInput = modal.querySelector('[data-clalrisk-field="sumInsured"]');
      if(sumInput) on(sumInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; const formatted = formatRiskSimSumInsuredDigits(sumInput.value); sumInput.value = formatted; try{ sumInput.setSelectionRange(formatted.length, formatted.length); }catch(_e){} st.sumInsured = formatted; st.result = null; st.error = null; st.dirtySinceSave = true; });
      // הלהקה נגזרת מהסכום, ולכן הרמז מתחת לשדה מתרענן רק כשעוזבים אותו.
      if(sumInput) on(sumInput, "change", () => this._render());
      if(sumInput) on(sumInput, "blur", () => this._render());
      const occInput = modal.querySelector('[data-clalrisk-field="occupation"]');
      if(occInput){ on(occInput, "input", () => { const st = this._state[this._activeInsuredId]; if(!st) return; st.occupation = safeTrim(occInput.value); st.occupationSource = "manual"; st.dirtySinceSave = true; }); on(occInput, "change", () => this._render()); on(occInput, "blur", () => this._render()); }
      const calcBtn = modal.querySelector("[data-clalrisk-calc]"); if(calcBtn) on(calcBtn, "click", () => this._calc(this._activeInsuredId));
      // הטבלה נשארת פתוחה בין חישובים כדי לאפשר השוואת תרחישים בלי לפתוח שוב.
      const projBtn = modal.querySelector("[data-clalrisk-proj]");
      if(projBtn) on(projBtn, "click", () => { const st = this._state[this._activeInsuredId]; if(!st) return; st.showProjection = !st.showProjection; this._render(); });
      const applyBtn = modal.querySelector("[data-clalrisk-apply]"); if(applyBtn) on(applyBtn, "click", () => this._apply());
      const saveBtn = modal.querySelector("[data-clalrisk-save]"); if(saveBtn) on(saveBtn, "click", () => this._saveActive());
      const finalBtn = modal.querySelector("[data-clalrisk-finalconfirm]");
      if(finalBtn) on(finalBtn, "click", () => { const insureds = Array.isArray(this._ctx?.insureds) ? this._ctx.insureds : []; const relevant = insureds.filter((ins) => this._isInsuredRelevant(ins)); if(!(relevant.length > 0 && relevant.every((ins) => !!this._state[ins.id]?.savedAt))){ window.showToast?.({ title: "לא כל המבוטחים נשמרו", text: "יש לשמור לפני אישור סופי.", variant: "warn" }); return; } this._showFinalSummary = true; this._render(); });
      const summaryBackBtn = modal.querySelector("[data-clalrisk-summary-back]"); if(summaryBackBtn) on(summaryBackBtn, "click", () => { this._showFinalSummary = false; this._render(); });
      const summaryConfirmBtn = modal.querySelector("[data-clalrisk-summary-confirm]"); if(summaryConfirmBtn) on(summaryConfirmBtn, "click", () => { try{ this._ctx?.onFinalConfirm?.(); }catch(_e){} this.close(); });
    },
    _switchInsured(targetId){ if(!targetId || targetId === this._activeInsuredId) return; if(this._state[this._activeInsuredId]?.dirtySinceSave){ this._confirmSwitch = { targetId }; this._render(); return; } this._activeInsuredId = targetId; this._render(); },
    _buildResultForInsured(insId){
      const st = this._state[insId]; if(!st) return null; if(!this._syncAge(st).ok) return null;
      if(!st.result?.ok){ const calc = computeClalRiskPremium({ age: st.age, gender: st.gender, smoker: st.smoker, sumInsured: st.sumInsured }); if(!calc.ok) return null; st.result = calc; st.error = null; }
      const r = st.result;
      return { sumInsured: formatRiskSimSumInsuredDigits(r.sumInsured), monthlyPremium: r.monthlyPremium, annualPremium: r.annualPremium, ratePerMille: r.ratePerMille, band: r.band, bandLabel: r.bandLabel, pdfName: r.pdfName, policyEndAge: r.policyEndAge, birthDate: st.birthDate || "", birthDateSource: st.birthDateSource || "", insuranceStartDate: st.insuranceStartDate || "", age: st.age, ageSource: st.ageSource, gender: st.gender, genderSource: st.genderSource, smoker: st.smoker, smokerSource: st.smokerSource, occupation: st.occupation || "", occupationSource: st.occupationSource || "" };
    },
    _apply(){ const results = {}; Object.keys(this._state).forEach((insId) => { const r = this._buildResultForInsured(insId); if(r) results[insId] = r; }); if(!Object.keys(results).length){ window.showToast?.({ title: "אין תוצאה להחלה", text: "יש לחשב פרמיה תקינה לפני ההחלה.", variant: "warn" }); return; } const onApply = this._ctx?.onApply; this.close(); try{ onApply?.(results); }catch(_e){} },
    _saveActive(){ const insId = this._activeInsuredId; const result = this._buildResultForInsured(insId); if(!result){ window.showToast?.({ title: "אין תוצאה לשמירה", text: "יש לחשב פרמיה תקינה לפני השמירה.", variant: "warn" }); return; } try{ this._ctx?.onApply?.({ [insId]: result }); }catch(_e){} const st = this._state[insId]; if(st){ st.savedAt = nowISO(); st.dirtySinceSave = false; } window.showToast?.({ title: "נשמר", text: `הסימולטור עבור ${this._getInsuredLabel(insId)} נשמר.`, variant: "success" }); this._render(); }
  };
  RiskSimulators.register("כלל", "ריסק", ClalRiskSimulator);
  // ===== סוף GI-CLL-RISK-SIM =======================================================


  try { host.onSimulatorsInstalled?.(RiskSimulators); } catch(_e) {}
  try { global.__GI_SIMS_CHUNK_READY = true; } catch(_e) {}
})(typeof globalThis !== "undefined" ? globalThis : window);
