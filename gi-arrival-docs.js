/* GEMEL INVEST — מסמכי הגעה לתיק לקוח
   מסמך התאמה + דוח התפתחות פרמיה + נספח ה׳ הרשמי.
   משפטים, סדר חלקים וטבלאות כמו במסמכים שנשלחו ללקוח.
   עיצוב GEMEL INVEST. נספח ה׳ = PDF משרד האוצר כפי שהוא. */
(function installGiArrivalDocs(global){
  "use strict";

  const VERSION = "20260907-arrival-docs-v1";
  const NAVY = "#3870ED";
  const AGENCY = "GEMEL INVEST";
  const COVER_ART = "./assets/gi-doc-cover-3d.png";
  const TEMPLATE_BASE = "./forms/har-authorization/";
  const TEMPLATE_FILE = "nispah-he.pdf";
  const TYPES = {
    hatama: "suitability_document",
    premia: "premium_development_report",
    nispah: "nispah_he_har_auth"
  };

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
  function todayIL(){
    try {
      return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
    } catch(_e){
      const d = new Date();
      return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
    }
  }
  function formatDateIL(value){
    const s = safeTrim(value);
    if(!s) return "";
    if(/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(s)) return s.replace(/\./g, "/");
    if(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)){
      const p = s.split("/");
      const y = p[2].length === 2 ? ("20" + p[2]) : p[2];
      return String(p[0]).padStart(2, "0") + "/" + String(p[1]).padStart(2, "0") + "/" + y;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso) return iso[3] + "/" + iso[2] + "/" + iso[1];
    const d = new Date(s);
    if(!Number.isNaN(d.getTime()) && /\d{4}/.test(s)){
      try {
        return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
      } catch(_e){
        return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
      }
    }
    return s;
  }
  function parseDateParts(value){
    const s = formatDateIL(value);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(!m) return null;
    return { d: Number(m[1]), m: Number(m[2]), y: Number(m[3]) };
  }
  function ageOn(birthDate, asOf){
    const b = parseDateParts(birthDate);
    const a = parseDateParts(asOf) || parseDateParts(todayIL());
    if(!b || !a) return null;
    let age = a.y - b.y;
    if(a.m < b.m || (a.m === b.m && a.d < b.d)) age -= 1;
    return age >= 0 ? age : null;
  }
  function moneyNumber(v){
    const n = Number(String(v == null ? "" : v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  function formatIls(n, whole){
    const x = Number(n);
    if(!Number.isFinite(x)) return "";
    const v = whole ? Math.round(x) : Math.round(x * 100) / 100;
    const digits = whole ? 0 : ((Math.round(v * 100) % 100) ? 2 : 2);
    try {
      return "₪" + v.toLocaleString("he-IL", { minimumFractionDigits: whole ? 0 : digits, maximumFractionDigits: whole ? 0 : 2 });
    } catch(_e){
      return "₪" + (whole ? String(Math.round(v)) : v.toFixed(2));
    }
  }
  function yesNo(v){
    const s = safeTrim(v).toLowerCase();
    if(!s) return "";
    if(s === "true" || s === "1" || s === "כן" || s === "yes" || s === "מעשן" || s === "מעשנת") return "כן";
    if(s === "false" || s === "0" || s === "לא" || s === "no" || s === "לא מעשן" || s === "לא מעשנת") return "לא";
    return safeTrim(v);
  }
  function isSmoker(v){
    const s = yesNo(v);
    if(s === "כן") return true;
    if(s === "לא") return false;
    return null;
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
      return bagPerson(parts[0] || "", parts.slice(1).join(" "), fullName, layers);
    }
    fullName = String((firstName + " " + lastName).trim() || fullName || ins?.label || "").trim();
    return bagPerson(firstName, lastName, fullName, layers);
  }
  function bagPerson(firstName, lastName, fullName, layers){
    return {
      firstName, lastName, fullName,
      idNumber: pickFrom(layers, ["idNumber", "id_number"]),
      birthDate: formatDateIL(pickFrom(layers, ["birthDate"])),
      gender: pickFrom(layers, ["gender"]),
      maritalStatus: pickFrom(layers, ["maritalStatus", "familyStatus"]),
      phone: pickFrom(layers, ["phone", "cellPhone", "mobile"]),
      phoneHome: pickFrom(layers, ["phoneHome", "homePhone"]),
      email: pickFrom(layers, ["email"]),
      city: pickFrom(layers, ["city"]),
      street: pickFrom(layers, ["street"]),
      houseNumber: pickFrom(layers, ["houseNumber"]),
      zip: pickFrom(layers, ["zip", "zipCode"]),
      occupation: pickFrom(layers, ["occupation", "profession", "job"]),
      clinic: pickFrom(layers, ["clinic", "hmo", "kupatHolim"]),
      shaban: pickFrom(layers, ["shaban", "shabanLevel"]),
      heightCm: pickFrom(layers, ["heightCm", "height"]),
      weightKg: pickFrom(layers, ["weightKg", "weight"]),
      smokingStatus: pickFrom(layers, ["smokingStatus", "smoker"]),
      salary: pickFrom(layers, ["salary", "income", "wage"]),
      extraIncome: pickFrom(layers, ["extraIncome", "otherIncome"]),
      obligations: pickFrom(layers, ["obligations", "liabilities"]),
      dependents: pickFrom(layers, ["dependents", "childrenCount", "children"]),
      hobbies: pickFrom(layers, ["dangerousHobbies", "hobbies"])
    };
  }
  function blobOf(policy){
    return [policy?.type, policy?.productName, policy?.planName, policy?.label, policy?.coverage].map(safeTrim).join(" ");
  }
  function productFamily(policy){
    const t = safeTrim(policy?.type);
    const blob = blobOf(policy);
    if(t === "ריסק משכנתא" || /משכנתא/.test(blob)) return "mortgage";
    if(t === "סרטן" || (/סרטן/.test(blob) && !/מחלות\s*קשות/.test(blob))) return "cancer";
    if(t === "מחלות קשות" || /מחלות\s*קשות/.test(blob)) return "ci";
    if(t === "בריאות" || /בריאות/.test(blob)) return "health";
    if(t === "ריסק" || /ריסק/.test(blob) || /ביטוח\s*חיים/.test(blob)) return "life";
    return "other";
  }
  function quoteProduct(family){
    if(family === "mortgage") return "ריסק משכנתא";
    if(family === "cancer") return "סרטן";
    if(family === "ci") return "מחלות קשות";
    if(family === "health") return "בריאות";
    if(family === "life") return "ריסק";
    return "";
  }
  function productTitle(family){
    if(family === "mortgage") return "פרט ביטוח חיים למשכנתא";
    if(family === "cancer") return "פרט ביטוח בריאות";
    if(family === "ci") return "פרט ביטוח בריאות";
    if(family === "health") return "פרט ביטוח בריאות";
    if(family === "life") return "פרט ביטוח חיים";
    return "פרט ביטוח";
  }
  function coverTypeLabel(family, policy){
    if(family === "life" || family === "mortgage") return "ביטוח חיים";
    if(family === "cancer") return safeTrim(policy?.planName) || "סרטן";
    if(family === "ci") return safeTrim(policy?.planName) || safeTrim(policy?.productName) || "מחלות קשות";
    return safeTrim(policy?.planName) || safeTrim(policy?.productName) || "בריאות";
  }
  function canonicalCompany(raw){
    const s = safeTrim(raw);
    if(/מנורה/.test(s)) return "מנורה";
    if(/מגדל/.test(s)) return "מגדל";
    if(/הראל/.test(s)) return "הראל";
    if(/הפניקס|פניקס/.test(s)) return "הפניקס";
    if(/הכשרה/.test(s)) return "הכשרה";
    if(/איילון/.test(s)) return "איילון";
    if(/כלל/.test(s)) return "כלל";
    return s;
  }
  function isCancelStatus(status){
    const helper = global.CustomerDocuments;
    if(helper?.isCancelFormStatus) return helper.isCancelFormStatus(status);
    const v = safeTrim(status).toLowerCase().replace(/[\s-]+/g, "_");
    return v === "full" || v === "partial_health" || v === "partial" || v === "partialhealth";
  }
  function isKeepStatus(status){
    const v = safeTrim(status).toLowerCase();
    return /nochange|ללא\s*שינוי|collective|קולקטיב/.test(v);
  }
  function listNewPolicies(payload){
    const p = payload && typeof payload === "object" ? payload : {};
    if(Array.isArray(p.newPolicies) && p.newPolicies.length) return p.newPolicies;
    const op = Array.isArray(p?.operational?.newPolicies) ? p.operational.newPolicies : [];
    return op;
  }
  function listInsureds(payload){
    return Array.isArray(payload?.insureds) ? payload.insureds.filter((x) => x && typeof x === "object") : [];
  }
  function roleLabel(ins){
    const t = safeTrim(ins?.type);
    if(t === "primary") return "ראשי";
    if(t === "spouse" || t === "secondary") return "בן/בת זוג";
    if(t === "child") return "ילדים";
    if(t === "adult") return "מבוגר";
    return t || "ראשי";
  }
  function familyRowLabel(ins){
    const t = safeTrim(ins?.type);
    if(t === "child") return "ילד/ה";
    if(t === "spouse" || t === "secondary") return "בן/בת זוג";
    if(t === "adult") return "מבוגר/ת";
    return "מבוטח ראשי";
  }
  function healthCoverIds(policy){
    const labels = [];
    const push = (x) => {
      const s = safeTrim(x);
      if(s && labels.indexOf(s) < 0) labels.push(s);
    };
    (Array.isArray(policy?.healthCovers) ? policy.healthCovers : []).forEach(push);
    (Array.isArray(policy?.covers) ? policy.covers : []).forEach(push);
    (Array.isArray(policy?.selectedCovers) ? policy.selectedCovers : []).forEach(push);
    const amounts = policy?.healthCoversWithAmounts && typeof policy.healthCoversWithAmounts === "object" ? policy.healthCoversWithAmounts : {};
    Object.keys(amounts).forEach(push);
    return labels.map((label) => ({ label, id: matchCoverId(label) })).filter((row) => row.id);
  }
  function matchCoverId(label){
    const s = safeTrim(label);
    if(!s) return "";
    const known = {
      transplant: /השתל/,
      abroad_surgery: /ניתוח.*חו.?ל|מחליפי\s*ניתוח/,
      drugs: /תרופות/,
      surgery_first_shekel: /שקל\s*ראשון/,
      surgery_shaban_5000: /שב.?ן.*5.?000|השתתפות\s*עצמית/,
      surgery_shaban: /שב.?ן/,
      ambulatory_consults: /ייעוץ|אמבולטור/
    };
    if(known.transplant.test(s) && !/ילד/.test(s)) return "transplant";
    if(known.abroad_surgery.test(s)) return "abroad_surgery";
    if(known.drugs.test(s)) return "drugs";
    if(known.surgery_first_shekel.test(s)) return "surgery_first_shekel";
    if(known.surgery_shaban_5000.test(s)) return "surgery_shaban_5000";
    if(known.surgery_shaban.test(s)) return "surgery_shaban";
    if(known.ambulatory_consults.test(s)) return "ambulatory_consults";
    return "";
  }
  function ciPlanId(company, family, policy){
    const blob = blobOf(policy).toLowerCase();
    const stored = safeTrim(policy?.planId || policy?.ciPlan || policy?.simulatorPlanId);
    if(stored) return stored;
    if(company === "מנורה"){
      if(family === "cancer" || /קרן חיים|kerenchaim/.test(blob)) return "kerenChaim";
      return "orTop";
    }
    if(company === "הפניקס") return family === "cancer" ? "marpeCancer" : "marpe";
    if(company === "איילון") return family === "cancer" ? "hoshenCancer" : "hoshen";
    if(company === "מגדל") return family === "cancer" ? "mazor_cancer" : "mazor_merchav";
    if(company === "כלל") return family === "cancer" ? "mediclal_cancer" : "mediclal_critical";
    return "";
  }
  function ciPlanLabel(company, family, policy){
    const blob = blobOf(policy);
    if(/קרן\s*אור|or\s*top|ortop/i.test(blob)) return "TOP קרן אור";
    if(/קרן\s*חיים/i.test(blob)) return "קרן חיים";
    if(/מזור\s*מורחב/i.test(blob)) return "מזור מורחב";
    if(/מרפא/i.test(blob)) return "בטוח מרפא";
    const plan = ciPlanId(company, family, policy);
    if(plan === "orTop") return "TOP קרן אור";
    if(plan === "kerenChaim") return "קרן חיים";
    if(plan === "mazor_merchav") return "מזור מורחב";
    return coverTypeLabel(family, policy);
  }
  function discountSchedule(policy, insuredId){
    const map = policy?.simDiscountPerInsured && typeof policy.simDiscountPerInsured === "object" ? policy.simDiscountPerInsured : {};
    const entry = map[insuredId] || map[Object.keys(map)[0]] || null;
    if(!entry) return { pct: 0, years: 0, schedule: [], label: "", optionId: "" };
    let schedule = Array.isArray(entry.schedule) ? entry.schedule.map((n) => Number(n) || 0) : [];
    if(!schedule.length && global.GiSimulatorDiscounts?.byId && safeTrim(entry.optionId)){
      try {
        const opt = global.GiSimulatorDiscounts.byId(canonicalCompany(policy.company), quoteProduct(productFamily(policy)), entry.optionId);
        if(Array.isArray(opt?.schedule)) schedule = opt.schedule.map((n) => Number(n) || 0);
        else if(Number(opt?.pct) > 0){
          const years = Number(opt.years) || 10;
          schedule = Array(years).fill(Number(opt.pct) || 0);
        }
      } catch(_e) {}
    }
    if(!schedule.length && Number(entry.year1Pct) > 0){
      const years = Number(entry.years) || 10;
      schedule = Array(years).fill(Number(entry.year1Pct) || 0);
    }
    return {
      pct: Number(entry.year1Pct) || Number(schedule[0]) || 0,
      years: schedule.length || Number(entry.years) || 0,
      schedule,
      label: safeTrim(entry.label || entry.optionLabel),
      optionId: safeTrim(entry.optionId),
      kind: /מערכת/.test(safeTrim(entry.label)) ? "מערכתית" : "סוכן/אישית"
    };
  }
  function formatDiscountPeriods(schedule){
    const list = Array.isArray(schedule) ? schedule.map((n) => Number(n) || 0) : [];
    if(!list.length) return "";
    const parts = [];
    let i = 0;
    while(i < list.length){
      const pct = list[i];
      let j = i;
      while(j + 1 < list.length && list[j + 1] === pct) j += 1;
      const from = i + 1;
      const to = j + 1;
      if(pct > 0) parts.push("שנה " + from + " עד " + to + " כולל " + pct + "%");
      i = j + 1;
    }
    return parts.join(" - ");
  }
  function applyDiscount(gross, schedule, yearIndex){
    const g = Number(gross);
    if(!Number.isFinite(g)) return null;
    const pct = Array.isArray(schedule) && yearIndex >= 0 && yearIndex < schedule.length ? Number(schedule[yearIndex]) || 0 : 0;
    return Math.round(g * (100 - pct)) / 100;
  }
  function quoteApi(){
    return global.GiSimulatorQuotes;
  }
  function quoteOnce(input){
    const api = quoteApi();
    if(!api || typeof api.quote !== "function") return { ok: false, error: "NO_ENGINE" };
    try { return api.quote(input.company, input.product, input) || { ok: false, error: "QUOTE_FAILED" }; }
    catch(_e){ return { ok: false, error: "QUOTE_FAILED" }; }
  }
  function maxAgeFor(family){
    if(family === "health") return 95;
    if(family === "ci" || family === "cancer") return 74;
    if(family === "life" || family === "mortgage") return 79;
    return 70;
  }
  function considerText(family, company, kind){
    const idx = serviceIndex(company, family);
    if(kind === "cancel"){
      return "הוחלט לבטל את המוצר, אחריות הביטול ע\"י: הסוכן/המשווק. דע לך שאתה יכול לבטל בעצמך, ע\"י סוכן הביטוח או ע\"י חברת הביטוח. היתרון בביטול ע\"י חברת הביטוח הוא שאם יגבה ממך תשלום כפול החברה תחזיר לך את הפרמיה ששולמה כפול."
        + (idx ? (" מדד השירות לחברה בקטגוריה זו: " + idx + ".") : "");
    }
    if(kind === "keep"){
      return "שים ♡ הזכאות לכיסוי ביטוחי וגובהו עשוים להיות מותנים בתנאים שונים, כגון שמירה על רציפות בהפקדות, גובה ההפקדות וכו' והכול בהתאם לתנאי המוצר הפרטניים.";
    }
    if(family === "life" || family === "mortgage"){
      return "ביטוח חיים - תשלום במקרה של פטירה בתקופת הביטוח בכפוף לתנאי הפוליסה."
        + (idx ? (" מדד השירות לחברה בקטגוריה זו: " + idx + ".") : "");
    }
    if(family === "ci" || family === "cancer"){
      return "מחלות קשות - התכנית מעניקה תגמולי ביטוח למבוטח שלקה באחת מהמחלות הקשות או באחד מהאירועים הרפואיים הקשים הנכללים בכיסוי. מסייע למבוטח ולבני משפחתו להתמודדות עם האירוע."
        + (idx ? (" מדד השירות לחברה בקטגוריה זו: " + idx + ".") : "");
    }
    return "ביטוח בריאות פרטי מאפשר למבוטח להיעזר בשירותי רפואה נוספים בנוסף לביטוח הבריאות הממלכתי בהתאם לכיסויים שנרכשו ולתנאי הפוליסה."
      + (idx ? (" מדד השירות לחברה בקטגוריה זו: " + idx + ".") : "");
  }
  function serviceIndex(company, family){
    const map = {
      "מנורה": { life: 86, mortgage: 86, health: 73, ci: 73, cancer: 73 },
      "מגדל": { life: 79, health: 79, ci: 79, cancer: 79 },
      "הפניקס": { life: 85, health: 78, ci: 78 },
      "הכשרה": { life: 80, health: 74, ci: 74 },
      "איילון": { health: 72, ci: 72 },
      "כלל": { life: 82, health: 76, ci: 76 }
    };
    const row = map[canonicalCompany(company)];
    if(!row) return "";
    return row[family] || "";
  }

  const DECLARATIONS = [
    "אם בפוליסה המוצעת ייקבעו לך החרגות לכיסוי הביטוח, אעביר לך לידיעתך ואישורך את השוואת ההחרגות בין הפוליסה המוצעת לפוליסה הקיימת.",
    "אם הפוליסה המוצעת הינה מסוג פוליסת פיצוי בלבד (ריסק,מחלות קשות,תאונות אישיות,סיעוד) ואין בכוונתך לבטל או להקטין את הכיסוי הביטוחי הקיים - לא תבוצע השוואת החרגות.",
    "הוצגה למועמד לביטוח התפתחות פרמיה.",
    "אמצעי תשלום אפשרי תשלום בכרטיס אשראי או הוראת קבע בבנק. פרטים לגבי מספר תשלומים וריביות ימסרו במידע מהותי.",
    "דע כי עליך להשיב תשובה מלאה וכנה על שאלות בעניין מהותי, ככל שלא יעשה כך יכול ותהיה השפעה על תשלום גמולי הביטוח.",
    "ידוע כי תהליך הצירוף, לרבות תהליך ההתאמה, אינו מותנה בהשארות המבוטח למשך תקופת ביטוח קצובה או שאינה קצובה."
  ];
  const PREMIA_NOTES = [
    "המחיר המוצג הינו מחיר חודשי לכל אורך השנה",
    "פרמיה חודשית ראשונה לאחר חישוב תוספת רפואית/ מקצועית והנחות",
    "המחיר המוצג הינו בשקלים שלמים ללא אגורות",
    "פרמיות המוצגות בטבלה זו תיתכן תוספת וזאת בהתאם לתוצאות החיתום הרפואי ו/או העיסוקי שיבוצע עי' חב הביטוח במועד ההצטרפות, וההחלטה האם לקבל מבוטח לביטוח נתונה לשיקול דעתה של חברת הביטוח",
    "המוצג בטבלה/אות הינו להמחשה בלבד וחושב בהתאם לנתונים שנמסרו בטופס ההצעה לצורך הצטרפות לביטוח, לרבות שכר מבוטח, שיעורי ההפקדות השוטפות וכו. וזאת בהנחה שלא יחול במהלך תקופת הביטוח שינוי כלשהו בנתונים האמורים ו/או בהרכב הכיסויים הביטוחיים המבוקשים",
    "סכום הביטוח למקרה מוות ושיעור או סכום הפיצוי החודשי חושבו בהתאם לנתוני המבוטח ובכלל זה גיל המבוטח ועיסוקו, אך לפני ביצוע הליך חיתום רפואי, וייתכן ויהיה בהם שינוי ככל שנקבעה תוספת עלות כיסוי ביטוחי עקב מצבו הרפואי של המבוטח",
    "דע לך כי הסכומים הקובעים הינם אלה שיוצגו לך על ידי חברת הביטוח בטפסים והמסמכים שלה"
  ];
  const DISCLAIMER = "ט.ל.ח. מיצג זה הינו להמחשה בלבד. התעריפים הקובעים הנם בהתאם לתעריפים הרשומים במחשבי חברת הביטוח ובהתאם לתנאי הפוליסה בפועל וכפוף להחלטת חברת הביטוח. ככל שיש אי התאמה בין הנתונים המופיעים במיצג זה לבין הנתונים המופיעים בחברת הביטוח, האחרונים יהיו הקובעים.";
  const CLIENT_DECL = "אני, החתום מטה, מצהיר כי המסמך מסמך התאמה נמסר לי על ידי בעל הרישיון.";
  const APPROVAL = [
    "אני מאשר\\ת כי הטבלה לעיל הוצגה בפני וכי מצאתי את התוכניות שאני מבקש\\ת להצטרף אליהן מתאימות לצרכיי.",
    "לפרמיות המוצגות בטבלאות תיתכן תוספת וזאת בהתאם לתוצאות החיתום הרפואי ו/או העיסוקי שיבוצע עי' חב הביטוח במועד ההצטרפות, וההחלטה האם לקבל מבוטח לביטוח נתונה לשיקול דעתה של חברת הביטוח."
  ];

  function detectDeployBase(){
    try {
      const path = String(global.location?.pathname || "");
      if(path.indexOf("/gemel-invest/") === 0) return "/gemel-invest/";
    } catch(_e) {}
    return "./";
  }
  function candidateUrls(folder, file){
    const q = "?v=" + encodeURIComponent(VERSION);
    const base = detectDeployBase();
    const out = [];
    const push = (href) => {
      try {
        const url = new URL(href, global.location.href).href;
        if(out.indexOf(url) < 0) out.push(url);
      } catch(_e) {
        out.push(href);
      }
    };
    push(base + folder + file + q);
    push(TEMPLATE_BASE + file + q);
    push("/gemel-invest/" + folder + file + q);
    push("./" + folder + file + q);
    return out;
  }
  async function fetchFirstOk(urls, label){
    let last = "";
    for(let i = 0; i < urls.length; i++){
      try {
        const res = await fetch(urls[i], { cache: "reload" });
        if(res && res.ok) return await res.arrayBuffer();
        last = String(res?.status || "");
      } catch(err){ last = String(err?.message || err); }
    }
    throw new Error(label + (last ? " (" + last + ")" : ""));
  }

  function buildAgent(rec){
    let agentRec = null;
    try { agentRec = (typeof global.getCurrentAgentRecord === "function" ? global.getCurrentAgentRecord() : null); } catch(_e) {}
    const auth = global.Auth?.current || {};
    const name = safeTrim(agentRec?.name) || safeTrim(auth.name) || safeTrim(rec?.agentName) || AGENCY;
    const email = safeTrim(agentRec?.email) || "";
    let branch = "";
    try {
      if(typeof global.getAgentOfficeBranch === "function") branch = safeTrim(global.getAgentOfficeBranch(agentRec?.id || auth.id));
    } catch(_e) {}
    return {
      agency: AGENCY,
      name,
      idNumber: safeTrim(agentRec?.idNumber || auth.idNumber),
      license: safeTrim(agentRec?.license || agentRec?.licenseNumber || auth.license),
      phone: safeTrim(agentRec?.phone || auth.phone),
      email,
      address: branch,
      displayId: safeTrim(agentRec?.idNumber || agentRec?.license || agentRec?.licenseNumber || auth.idNumber || auth.license)
    };
  }

  function personFromInsured(ins, payload, rec){
    const helper = global.GI_OFFICIAL_FORM_FILL;
    const fallbacks = helper?.fileFallbacks ? helper.fileFallbacks(rec, payload) : [payload?.primary, rec];
    const bag = pickPerson(ins, fallbacks) || {};
    bag.id = safeTrim(ins?.id);
    bag.role = safeTrim(ins?.type) || "primary";
    bag.roleLabel = roleLabel(ins);
    bag.familyLabel = familyRowLabel(ins);
    bag.age = ageOn(bag.birthDate, todayIL());
    bag.smoker = isSmoker(bag.smokingStatus);
    return bag;
  }

  function peopleFromPayload(payload, rec){
    const insureds = listInsureds(payload);
    const fallbacks = [payload?.primary, rec];
    if(insureds.length) return insureds.map((ins) => personFromInsured(ins, payload, rec));
    const primary = personFromInsured({ type: "primary", data: payload?.primary || {} }, payload, rec);
    return primary.fullName || primary.idNumber ? [primary] : [];
  }

  function policyInsuredPeople(policy, people){
    const ids = Array.isArray(policy?.insuredIds) ? policy.insuredIds.map(safeTrim).filter(Boolean) : [];
    if(ids.length) return people.filter((p) => ids.indexOf(p.id) >= 0);
    const one = safeTrim(policy?.insuredId);
    if(one) return people.filter((p) => p.id === one);
    const family = productFamily(policy);
    if(family === "health") return people.slice();
    const primary = people.filter((p) => p.role === "primary");
    return primary.length ? primary : people.slice(0, 1);
  }

  function year1Premium(policy, person){
    const map = policy?.premiumPerInsured && typeof policy.premiumPerInsured === "object" ? policy.premiumPerInsured : {};
    const disc = policy?.simDiscountPerInsured && typeof policy.simDiscountPerInsured === "object" ? policy.simDiscountPerInsured : {};
    const id = person?.id;
    const after = moneyNumber(disc[id]?.monthlyAfterDiscount || disc[Object.keys(disc)[0]]?.monthlyAfterDiscount);
    const gross = moneyNumber(map[id] || map[Object.keys(map)[0]] || policy?.monthlyPremium || policy?.premium);
    return { gross, after: after || 0, used: after || gross };
  }

  function sumInsuredOf(policy, person){
    const map = policy?.sumInsuredPerInsured && typeof policy.sumInsuredPerInsured === "object" ? policy.sumInsuredPerInsured : {};
    return moneyNumber(map[person?.id] || map[Object.keys(map)[0]] || policy?.sumInsured || policy?.compensation);
  }

  function buildProjectionForCover(args){
    const { company, family, person, sum, covers, planId, schedule, year1 } = args;
    const product = quoteProduct(family);
    if(!product || person?.age == null) return { ok: false, rows: [], reason: "no_tariff" };
    const start = Number(person.age);
    const cap = maxAgeFor(family);
    const rows = [];
    let okCount = 0;
    for(let age = start; age <= cap; age++){
      const q = quoteOnce({
        company,
        product,
        age,
        gender: person.gender,
        smoker: person.smoker,
        sumInsured: sum,
        compensation: sum,
        covers: covers || [],
        planId: planId || "",
        programMode: "base"
      });
      if(!q || q.ok !== true || !Number.isFinite(Number(q.monthlyPremium))){
        if(age === start) return { ok: false, rows: [], reason: q?.error || "no_tariff" };
        break;
      }
      const yearIndex = age - start;
      let monthly = applyDiscount(Number(q.monthlyPremium), schedule, yearIndex);
      if(age === start && Number(year1) > 0) monthly = Number(year1);
      rows.push({ age, monthly: Math.round(monthly) });
      okCount += 1;
    }
    if(!okCount) return { ok: false, rows: [], reason: "no_tariff" };
    const total = rows.reduce((acc, row) => acc + (row.monthly * 12), 0);
    return { ok: true, rows, total };
  }

  function buildPeopleTables(draft){
    const out = [];
    (draft.newPolicies || []).forEach((policy) => {
      const family = productFamily(policy);
      const company = canonicalCompany(policy.company);
      const people = policyInsuredPeople(policy, draft.people);
      people.forEach((person) => {
        const y1 = year1Premium(policy, person);
        const sum = sumInsuredOf(policy, person);
        const disc = discountSchedule(policy, person.id);
        const covers = family === "health" ? healthCoverIds(policy) : [];
        const planId = (family === "ci" || family === "cancer") ? ciPlanId(company, family, policy) : "";
        const coverRows = [];
        if(family === "health" && covers.length){
          covers.forEach((cover) => {
            const addon = moneyNumber(policy?.healthAddonPremiums?.[cover.label]?.[person.id] || policy?.healthAddonPremiums?.[cover.id]?.[person.id]);
            const proj = buildProjectionForCover({
              company, family, person, sum: 0, covers: [cover.id], planId: "", schedule: disc.schedule, year1: addon || 0
            });
            coverRows.push({
              label: cover.label,
              id: cover.id,
              sum: 0,
              year1: addon || (proj.ok && proj.rows[0] ? proj.rows[0].monthly : 0),
              projection: proj
            });
          });
        } else {
          const label = (family === "ci" || family === "cancer")
            ? ("מחלות קשות - " + ciPlanLabel(company, family, policy))
            : coverTypeLabel(family, policy);
          const proj = buildProjectionForCover({
            company, family, person, sum, covers: covers.map((c) => c.id), planId, schedule: disc.schedule, year1: y1.used
          });
          coverRows.push({
            label,
            id: planId || family,
            sum,
            year1: y1.used,
            projection: proj
          });
        }
        out.push({ policy, family, company, person, disc, coverRows, year1: y1 });
      });
    });
    return out;
  }

  const GiArrivalDocs = {
    VERSION,
    TYPES,
    TEMPLATE_FILE,
    COVER_ART,
    AGENCY,
    DECLARATIONS,
    PREMIA_NOTES,
    DISCLAIMER,
    CLIENT_DECL,
    APPROVAL,

    qualifies(payload, rec){
      if(!payload || typeof payload !== "object") return false;
      const flow = safeTrim(payload.flowType).toLowerCase();
      if(flow === "elementary") return false;
      if(flow === "agent_appointment" && !listNewPolicies(payload).length) return false;
      const people = listInsureds(payload);
      if(payload.primary || people.length) return true;
      if(listNewPolicies(payload).length) return true;
      return people.some((ins) => (ins?.data?.existingPolicies || []).length);
    },

    buildDraft(rec){
      const payload = rec?.payload && typeof rec.payload === "object" ? rec.payload : (rec && rec.primary ? rec : {});
      const date = todayIL();
      const people = peopleFromPayload(payload, rec);
      const primary = people.find((p) => p.role === "primary") || people[0] || bagPerson("", "", "", []);
      const agent = buildAgent(rec);
      const newPolicies = listNewPolicies(payload).filter((p) => p && typeof p === "object");
      const existing = [];
      listInsureds(payload).forEach((ins) => {
        const d = layerOf(ins);
        const cancellations = (d.cancellations && typeof d.cancellations === "object") ? d.cancellations : {};
        (Array.isArray(d.existingPolicies) ? d.existingPolicies : []).forEach((policy) => {
          if(!policy || typeof policy !== "object") return;
          const cancel = cancellations[policy.id] || {};
          existing.push({
            policy,
            cancel,
            status: safeTrim(cancel.status),
            cancelled: isCancelStatus(cancel.status),
            keep: isKeepStatus(cancel.status) || !isCancelStatus(cancel.status),
            insured: personFromInsured(ins, payload, rec)
          });
        });
      });
      const draft = {
        date,
        startMonth: date.slice(3),
        recId: safeTrim(rec?.id),
        agent,
        primary,
        people,
        newPolicies,
        existing,
        payload
      };
      draft.tables = buildPeopleTables(draft);
      return draft;
    },

    docCss(){
      return `
        :root{--navy:${NAVY};--ink:#111827;--muted:#64748B;--line:#D7DEEA;--paper:#fff}
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:#EEF2F7;color:var(--ink);font-family:Arial,Helvetica,sans-serif}
        .giArrivalRoot{padding:12px 0 28px}
        .giArrivalPage{
          width:210mm;min-height:297mm;margin:0 auto 18px;background:var(--paper);
          position:relative;overflow:hidden;page-break-after:always;
          box-shadow:0 14px 40px rgba(15,23,42,.12);
        }
        .giArrivalInner{padding:14mm 14mm 18mm;min-height:297mm;display:flex;flex-direction:column}
        .giHead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px}
        .giHead__name{color:var(--navy);font-weight:800;font-size:18px;line-height:1.2}
        .giHead__sub{color:#94A3B8;font-weight:700;font-size:15px;margin-top:2px}
        .giHead__meta{color:#64748B;font-size:12px;line-height:1.55;font-weight:500}
        .giHead__date{font-size:13px;font-weight:700;color:#334155}
        .giCover{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8px 0 18px}
        .giCover h1{margin:0;font-size:36px;font-weight:800;letter-spacing:-.03em}
        .giCover h2{margin:8px 0 0;font-size:18px;font-weight:700;color:#334155}
        .giCoverArt{width:250px;height:250px;margin:26px 0 8px;object-fit:contain;filter:drop-shadow(0 18px 24px rgba(37,99,235,.28))}
        .giCoverBar{margin-top:auto;background:var(--navy);color:#fff;padding:12px 16px;display:flex;justify-content:space-between;font-weight:700;font-size:14px}
        .giTo{font-size:22px;font-weight:800;margin:2px 0 14px}
        .giPart{text-align:center;font-weight:800;font-size:17px;margin:4px 0 12px}
        .giBar{background:var(--navy);color:#fff;font-weight:800;font-size:13px;padding:7px 12px}
        .giGrid{width:100%;border-collapse:collapse;font-size:11.5px;margin:0 0 12px}
        .giGrid th{background:var(--navy);color:#fff;font-weight:800;padding:7px 6px;text-align:right;border:1px solid #2F68E4}
        .giGrid td{padding:7px 6px;border:1px solid var(--line);background:#fff;vertical-align:top}
        .giGrid--partB th,.giGrid--partB td{font-size:11px;padding:6px 5px}
        .giGrid--age td,.giGrid--age th{text-align:center;font-size:11px}
        .giNote{font-size:11px;color:#64748B;line-height:1.55;margin:6px 0 12px}
        .giBox{border:1px solid #D7DEEA;margin:0 0 12px}
        .giBox ul,.giBox p{margin:0;padding:10px 12px;font-size:13px;line-height:1.7;font-weight:500}
        .giBox li{margin:0 0 6px}
        .giSign{display:flex;justify-content:space-between;gap:28px;margin-top:22px}
        .giSign__col{flex:1;font-size:13px;font-weight:700}
        .giSign__line{border-bottom:1px solid #94A3B8;height:36px;margin:8px 0 6px}
        .giFoot{margin-top:auto;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;color:#7B8798;font-size:10.5px;line-height:1.45;border-top:1px solid #E5EAF3}
        .giPageNo{color:var(--navy);font-weight:800;font-size:14px}
        .giJoin{color:#047857;font-weight:800}
        .giCancel{color:#B91C1C;font-weight:800}
        .giKeep{color:#475569;font-weight:800}
        @media print{
          body{background:#fff}
          .giArrivalPage{box-shadow:none;margin:0;page-break-after:always}
        }
      `;
    },

    wrapHtml(title, pagesHtml){
      return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${this.docCss()}</style></head><body><div class="giArrivalRoot">${pagesHtml}</div></body></html>`;
    },

    agentHead(draft, withSub){
      const a = draft.agent || {};
      const idLine = a.displayId ? (a.displayId + " :ת.ז") : "";
      const meta = [idLine, a.address, a.phone ? ("טלפון: " + a.phone) : "", a.email].filter(Boolean).join("<br/>");
      return `<div class="giHead">
        <div>
          <div class="giHead__name">${escapeHtml(a.agency || AGENCY)}</div>
          ${withSub ? `<div class="giHead__sub">${escapeHtml(a.name || a.agency || AGENCY)}</div>` : ""}
          <div class="giHead__meta">${meta}</div>
        </div>
        <div class="giHead__date">${escapeHtml(draft.date || "")}</div>
      </div>`;
    },
    foot(draft, page, total){
      const who = (draft.primary?.fullName || "") + (draft.primary?.idNumber ? (" ת.ז " + draft.primary.idNumber) : "");
      const num = String(page).padStart(2, "0") + " מתוך " + String(total).padStart(2, "0");
      return `<div class="giFoot">
        <div class="giPageNo">${escapeHtml(num)}</div>
        <div>מסמך זה הופק על ידי ${escapeHtml(AGENCY)} - ${escapeHtml(draft.agent?.name || AGENCY)}<br/>עבור: ${escapeHtml(who)} סיווג: מידע רגיש</div>
      </div>`;
    },
    page(inner){
      return `<article class="giArrivalPage"><div class="giArrivalInner">${inner}</div></article>`;
    },

    coverPage(draft, page, total){
      const who = (draft.primary?.fullName || "") + (draft.primary?.idNumber ? (" ת.ז: " + draft.primary.idNumber) : "");
      return this.page(`
        ${this.agentHead(draft, true)}
        <div class="giCover">
          <h1>מסמך התאמה</h1>
          <h2>התאמת הביטוח לצורכי המועמד לביטוח</h2>
          <img class="giCoverArt" src="${COVER_ART}" alt="מסמך GEMEL INVEST"/>
        </div>
        <div class="giCoverBar"><span>${escapeHtml(draft.date || "")}</span><span>${escapeHtml(who)}</span></div>
      `);
    },

    aboutPage(draft, page, total){
      const p = draft.primary || {};
      const kids = (draft.people || []).filter((x) => x.role === "child" || x.role === "spouse" || x.role === "adult");
      const famRows = kids.map((k) => `<tr>
        <td>${escapeHtml(k.familyLabel)}</td><td>${escapeHtml(k.fullName)}</td><td>${escapeHtml(k.idNumber)}</td>
        <td>${escapeHtml(k.birthDate)}</td><td>${k.age != null ? escapeHtml(String(k.age)) : ""}</td>
        <td>${escapeHtml(k.maritalStatus)}</td><td>${escapeHtml(k.clinic)}</td><td>${escapeHtml(yesNo(k.shaban) || (k.shaban ? k.shaban : ""))}</td>
        <td>${escapeHtml(yesNo(k.smokingStatus))}</td><td>${escapeHtml(k.occupation)}</td>
      </tr>`).join("") || `<tr><td colspan="10"></td></tr>`;
      const who = "לכבוד: " + (p.fullName || "") + (p.idNumber ? (" ת.ז: " + p.idNumber) : "");
      return this.page(`
        ${this.agentHead(draft, false)}
        <div class="giTo">${escapeHtml(who)}</div>
        <div class="giBar">אודות</div>
        <div class="giBar">כתובת ופרטי התקשרות</div>
        <table class="giGrid"><thead><tr>
          <th>רחוב</th><th>מס' בית</th><th>ישוב</th><th>מיקוד</th><th>טלפון</th><th>טלפון נייד</th><th>דואר אלקטרוני</th>
        </tr></thead><tbody><tr>
          <td>${escapeHtml(p.street)}</td><td>${escapeHtml(p.houseNumber)}</td><td>${escapeHtml(p.city)}</td>
          <td>${escapeHtml(p.zip || "0")}</td><td>${escapeHtml(p.phoneHome)}</td><td>${escapeHtml(p.phone)}</td><td>${escapeHtml(p.email)}</td>
        </tr></tbody></table>
        <div class="giBar">נתונים כלכליים ומשפחתיים</div>
        <table class="giGrid"><thead><tr>
          <th>תאריך לידה</th><th>מצב משפחתי</th><th>מקצוע</th><th>שכר</th><th>מקורות הכנסה נוספים</th><th>התחייבויות</th><th>תלויים נוספים</th>
        </tr></thead><tbody><tr>
          <td>${escapeHtml(p.birthDate)}</td><td>${escapeHtml(p.maritalStatus)}</td><td>${escapeHtml(p.occupation)}</td>
          <td>${escapeHtml(p.salary)}</td><td>${escapeHtml(p.extraIncome)}</td><td>${escapeHtml(p.obligations)}</td><td>${escapeHtml(p.dependents)}</td>
        </tr></tbody></table>
        <div class="giBar">מצב בריאותי ותחילת ביטוח</div>
        <table class="giGrid"><thead><tr>
          <th>קופת חולים</th><th>שב"ן</th><th>גובה</th><th>משקל</th><th>מעשן</th><th>תחביבים מסוכנים</th>
        </tr></thead><tbody><tr>
          <td>${escapeHtml(p.clinic)}</td><td>${escapeHtml(p.shaban)}</td><td>${escapeHtml(p.heightCm)}</td>
          <td>${escapeHtml(p.weightKg)}</td><td>${escapeHtml(yesNo(p.smokingStatus))}</td><td>${escapeHtml(p.hobbies)}</td>
        </tr></tbody></table>
        <div class="giBar">נתונים כלליים בני משפחה</div>
        <table class="giGrid"><thead><tr>
          <th>פרטי משפחה</th><th>שם פרטי + משפחה</th><th>מספר ת.ז</th><th>תאריך לידה</th><th>גיל נוכחי</th>
          <th>מצב משפחתי</th><th>קופת חולים</th><th>קיים שב"ן בקופ"ח</th><th>עישון</th><th>מקצוע</th>
        </tr></thead><tbody>${famRows}</tbody></table>
        <div class="giBar">מטרות הלקוח</div>
        <table class="giGrid"><thead><tr><th>מטרות הלקוח</th><th>פירוט סכומי ביטוח מומלצים</th></tr></thead><tbody><tr><td></td><td></td></tr></tbody></table>
        <div class="giBar">מטרות הביטוח</div>
        <table class="giGrid"><thead><tr><th>מטרות הביטוח</th><th>מצב כספי בדרך כלל</th></tr></thead><tbody><tr><td></td><td></td></tr></tbody></table>
        ${this.foot(draft, page, total)}
      `);
    },

    partBRows(draft){
      const rows = [];
      let n = 1;
      (draft.newPolicies || []).forEach((policy) => {
        const family = productFamily(policy);
        const company = canonicalCompany(policy.company);
        const people = policyInsuredPeople(policy, draft.people);
        const cells = [];
        people.forEach((person) => {
          const y1 = year1Premium(policy, person);
          const sum = sumInsuredOf(policy, person);
          const disc = discountSchedule(policy, person.id);
          const discText = formatDiscountPeriods(disc.schedule);
          const role = person.role === "child" ? "ילדים" : "מבוטח ראשי";
          const covers = family === "health" ? healthCoverIds(policy) : [];
          if(family === "health" && covers.length){
            covers.forEach((cover) => {
              const addon = moneyNumber(policy?.healthAddonPremiums?.[cover.label]?.[person.id]);
              cells.push({
                role,
                cover: cover.label,
                sum: cover.id === "transplant" || cover.id === "abroad_surgery" || cover.id === "drugs" ? "" : formatIls(sum, true),
                premium: formatIls(addon || y1.used, false),
                discount: discText
              });
            });
          } else {
            const plan = (family === "ci" || family === "cancer") ? ciPlanLabel(company, family, policy) : coverTypeLabel(family, policy);
            cells.push({
              role,
              cover: plan + (person.occupation && person.role === "primary" ? (" · " + person.occupation) : ""),
              sum: sum ? ("חד פעמי " + formatIls(sum, true)) : "",
              premium: formatIls(y1.used, false),
              discount: discText
            });
          }
        });
        const coverHtml = cells.map((c) => "<strong>" + escapeHtml(c.role) + ":</strong> " + escapeHtml(c.cover)
          + (c.discount ? ("<br/>פירוט הנחה: " + escapeHtml(c.discount)) : "")).join("<br/>");
        const sumHtml = cells.map((c) => escapeHtml(c.sum || "")).join("<br/>");
        const premiumHtml = cells.map((c) => escapeHtml(c.premium || "")).join("<br/>");
        rows.push({
          kind: "join",
          n,
          product: productTitle(family),
          company,
          coverHtml,
          sumHtml,
          premiumHtml,
          consider: considerText(family, company, "join")
        });
        n += 1;
      });
      (draft.existing || []).forEach((row) => {
        const policy = row.policy || {};
        const family = productFamily(policy);
        const company = canonicalCompany(policy.company);
        const kind = row.cancelled ? "cancel" : "keep";
        const num = safeTrim(policy.policyNumber);
        const prem = formatIls(policy.monthlyPremium || policy.premium || policy.annualPremium && (moneyNumber(policy.annualPremium) / 12), false);
        const period = [safeTrim(policy.periodText || policy.period), safeTrim(policy.startDate), safeTrim(policy.endDate)].filter(Boolean).join(" · ");
        rows.push({
          kind,
          n,
          product: kind === "keep" && /קבוצ|קולקטיב/.test(blobOf(policy) + safeTrim(row.status)) ? "קבוצתי ביטוח בריאות" : productTitle(family),
          company,
          coverHtml: "<strong>מבוטח ראשי:</strong> " + escapeHtml(coverTypeLabel(family, policy))
            + (num ? ("<br/>מספר חשבון: " + escapeHtml(num)) : "")
            + (period ? ("<br/>" + escapeHtml(period)) : ""),
          sumHtml: "",
          premiumHtml: escapeHtml(prem || ""),
          consider: considerText(family, company, kind)
        });
        n += 1;
      });
      return rows;
    },

    partBPages(draft, startPage, total){
      const items = this.partBRows(draft);
      const chunks = [];
      for(let i = 0; i < items.length; i += 3) chunks.push(items.slice(i, i + 3));
      if(!chunks.length) chunks.push([]);
      return chunks.map((chunk, idx) => {
        const body = chunk.map((row) => {
          const cls = row.kind === "join" ? "giJoin" : (row.kind === "cancel" ? "giCancel" : "giKeep");
          const status = row.kind === "join" ? ("להצטרף " + row.n)
            : (row.kind === "cancel" ? ("ביטול מוצר קיים " + row.n) : ("ללא שינוי " + row.n));
          return `<tr>
            <td class="${cls}">${escapeHtml(status)}</td>
            <td>${escapeHtml(row.product)}</td>
            <td>${escapeHtml(row.company)}</td>
            <td>${row.coverHtml}</td>
            <td>${row.sumHtml || ""}</td>
            <td>${row.premiumHtml || ""}</td>
          </tr>
          <tr><td colspan="6"><strong>שיקולים ומידע:</strong> ${escapeHtml(row.consider)}</td></tr>`;
        }).join("");
        return this.page(`
          <div class="giPart">חלק ב' - הכיסויים הביטוחיים המומלצים</div>
          <table class="giGrid giGrid--partB"><thead><tr>
            <th>סטטוס</th><th>שם המוצר</th><th>שם הגוף המוסדי</th>
            <th>סוג הכיסוי הביטוחי / מסלול הביטוח</th>
            <th>סכום הכיסוי הביטוחי (חודשי או חד-פעמי)</th><th>עלות חודשית</th>
          </tr></thead><tbody>${body || `<tr><td colspan="6"></td></tr>`}</tbody></table>
          ${this.foot(draft, startPage + idx, total)}
        `);
      }).join("");
    },

    declarationsPage(draft, page, total){
      const doubles = [];
      (draft.existing || []).filter((row) => row.cancelled).forEach((row) => {
        const family = productFamily(row.policy);
        doubles.push("סוג הכיסוי: " + coverTypeLabel(family, row.policy) + ", יצרן: " + canonicalCompany(row.policy.company)
          + (safeTrim(row.policy.policyNumber) ? (", מספר פוליסה: " + row.policy.policyNumber) : ""));
      });
      (draft.newPolicies || []).forEach((policy) => {
        const family = productFamily(policy);
        if(family === "ci" || family === "cancer" || family === "life"){
          doubles.push("סוג הכיסוי: " + coverTypeLabel(family, policy) + ", יצרן: " + canonicalCompany(policy.company));
        }
      });
      const uniq = [];
      doubles.forEach((x) => { if(uniq.indexOf(x) < 0) uniq.push(x); });
      return this.page(`
        <div class="giPart">חלק ג'</div>
        <div class="giBox">
          <div class="giBar">הצהרות</div>
          <ul>${DECLARATIONS.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
        </div>
        <div class="giPart">חלק ה'</div>
        <div class="giBox">
          <div class="giBar">הערות</div>
          <p><strong>הצהרת המועמד לביטוח על כפל פיצוי בפוליסות מסוג פיצוי בלבד:</strong><br/>
          ידוע לי כי קיימת פוליסה פיצוי עם כיסוי ביטוחי דומה וכי ייגבו ממני דמי ביטוח עבור הפוליסה הקיימת ועבור הפוליסה החדשה</p>
          ${uniq.length ? `<p>${uniq.map((x) => escapeHtml("- " + x)).join("<br/>")}</p>` : ""}
        </div>
        <div class="giPart" style="text-align:right">הצהרת הלקוח</div>
        <p>${escapeHtml(CLIENT_DECL)}</p>
        <div class="giSign">
          <div class="giSign__col">חתימת הלקוח: ${escapeHtml(draft.primary?.fullName || "")}<div class="giSign__line"></div>תאריך: ${escapeHtml(draft.date)}</div>
          <div class="giSign__col">חתימת בעל הרישיון: ${escapeHtml(draft.agent?.name || AGENCY)}<div class="giSign__line"></div>תאריך: ${escapeHtml(draft.date)}</div>
        </div>
        ${this.foot(draft, page, total)}
      `);
    },

    renderHatamaPages(draft){
      const partBCount = Math.max(1, Math.ceil(this.partBRows(draft).length / 3));
      const total = 2 + partBCount + 1;
      return this.coverPage(draft, 1, total)
        + this.aboutPage(draft, 2, total)
        + this.partBPages(draft, 3, total)
        + this.declarationsPage(draft, 2 + partBCount + 1, total);
    },
    renderHatamaHtml(draft){
      const d = draft || this.buildDraft({});
      return this.wrapHtml("מסמך התאמה", this.renderHatamaPages(d));
    },

    candidatesTable(draft, people){
      const rows = (people || draft.people || []).map((p) => `<tr>
        <td>${escapeHtml(p.firstName)}</td><td>${escapeHtml(p.lastName)}</td><td>${escapeHtml(p.idNumber)}</td>
        <td>${escapeHtml(p.birthDate)}</td><td>${escapeHtml(yesNo(p.smokingStatus))}</td>
        <td>${escapeHtml(p.occupation)}</td><td>${escapeHtml(p.roleLabel)}</td>
      </tr>`).join("");
      return `<div class="giBar">פרטי המועמדים לביטוח</div>
        <table class="giGrid"><thead><tr>
          <th>שם פרטי</th><th>שם משפחה</th><th>מספר ת.ז</th><th>תאריך לידה</th><th>עישון</th><th>עיסוק</th><th>סוג מבוטח</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
    },

    year1Block(entry){
      const name = entry.person.fullName || "";
      const body = entry.coverRows.map((c) => `<tr>
        <td>${escapeHtml(c.label)}</td><td>${c.sum ? formatIls(c.sum, true) : ""}</td>
        <td>${c.year1 ? formatIls(c.year1, true) : ""}</td><td></td><td>0</td><td>משתנה</td>
      </tr>`).join("");
      const total = entry.coverRows.reduce((acc, c) => acc + moneyNumber(c.year1), 0);
      const discText = formatDiscountPeriods(entry.disc.schedule);
      return `
        <div class="giBar">${escapeHtml(name)} - כיסויים ועלויות חודשיות שנה א'</div>
        <table class="giGrid"><thead><tr>
          <th>הכיסוי הביטוחי</th><th>סכום הביטוח</th><th>פרמיה חודשית*</th><th>תוספת מקצועית</th><th>% תוספת רפואית</th><th>סוג פרמיה</th>
        </tr></thead><tbody>
          ${body}
          <tr><td>סה"כ</td><td></td><td>${formatIls(total, true)}</td><td></td><td></td><td></td></tr>
        </tbody></table>
        <div class="giNote">* פרמיה חודשית שנה א' לאחר חישוב תוספת רפואית/ מקצועית והנחות, במידה וניתנו.<br/>** הפרמיות בהצעה זו חושבו לפי תאריך תחילת ביטוח.</div>
        <div class="giBar">${escapeHtml(name)} - הנחות</div>
        <table class="giGrid"><thead><tr>
          <th>שם המוצר</th><th>קבוצת כיסויים</th><th>פירוט תקופות הנחה</th><th>קוד הטבה</th><th>סוג הנחה</th>
        </tr></thead><tbody>
          ${entry.coverRows.map((c) => `<tr>
            <td>${escapeHtml(productTitle(entry.family))}</td><td>${escapeHtml(c.label)}</td>
            <td>${escapeHtml(discText)}</td><td>${escapeHtml(entry.disc.optionId)}</td><td>${escapeHtml(entry.disc.kind)}</td>
          </tr>`).join("")}
        </tbody></table>
        <div class="giNote">${escapeHtml(DISCLAIMER)}</div>
      `;
    },

    ageTableChunks(entry, rowsPerPage){
      const withTariff = entry.coverRows.filter((c) => c.projection && c.projection.ok && c.projection.rows.length);
      if(!withTariff.length) return [];
      const ages = withTariff[0].projection.rows.map((r) => r.age);
      const size = Number(rowsPerPage) > 0 ? Number(rowsPerPage) : 40;
      const chunks = [];
      for(let i = 0; i < ages.length; i += size) chunks.push({ from: i, to: Math.min(i + size, ages.length) });
      return chunks.map((slice, sliceIdx) => {
        const last = sliceIdx === chunks.length - 1;
        const head = `<th>גיל בשנים</th>` + withTariff.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("") + `<th>סה"כ</th>`;
        const body = ages.slice(slice.from, slice.to).map((age, localIdx) => {
          const idx = slice.from + localIdx;
          let sum = 0;
          const cells = withTariff.map((c) => {
            const row = c.projection.rows[idx];
            const v = row ? row.monthly : 0;
            sum += v;
            return `<td>${formatIls(v, true)}</td>`;
          }).join("");
          return `<tr><td>${age}</td>${cells}<td>${formatIls(sum, true)}</td></tr>`;
        }).join("");
        const totals = last
          ? ("<tr><td>סה\"כ</td>" + withTariff.map((c) => `<td>${formatIls(c.projection.total, true)}</td>`).join("")
            + `<td>${formatIls(withTariff.reduce((acc, c) => acc + Number(c.projection.total || 0), 0), true)}</td></tr>`)
          : "";
        return `<div class="giPart">התפתחות פרמיה</div>
          <div style="font-weight:800;margin:0 0 8px">${escapeHtml(entry.person.fullName)} - ${escapeHtml(coverTypeLabel(entry.family, entry.policy))}</div>
          <table class="giGrid giGrid--age"><thead><tr>${head}</tr></thead><tbody>
            ${body}
            ${totals}
          </tbody></table>`;
      });
    },
    ageTableHtml(entry){
      return this.ageTableChunks(entry, 400).join("");
    },
    premiaGroups(draft){
      const tables = Array.isArray(draft?.tables) ? draft.tables : [];
      const defs = [
        { key: "health", label: "בריאות", reportTitle: "דוח התפתחות פרמיה", families: ["health", "ci", "cancer"] },
        { key: "life", label: "חיים", reportTitle: "הצעת מחיר והתפתחות פרמיה", families: ["life", "mortgage"] }
      ];
      const used = {};
      const groups = defs.map((def) => {
        const items = tables.filter((t) => def.families.indexOf(t.family) >= 0);
        items.forEach((t) => { used[t.family] = true; });
        const people = [];
        items.forEach((t) => {
          if(t.person && !people.some((p) => p.id === t.person.id)) people.push(t.person);
        });
        const companies = [];
        items.forEach((t) => {
          if(t.company && companies.indexOf(t.company) < 0) companies.push(t.company);
        });
        return Object.assign({}, def, { items, people, company: companies.join(" / ") });
      }).filter((g) => g.items.length);
      const leftover = tables.filter((t) => !used[t.family]);
      if(leftover.length){
        const people = [];
        leftover.forEach((t) => {
          if(t.person && !people.some((p) => p.id === t.person.id)) people.push(t.person);
        });
        groups.push({
          key: "other",
          label: "ביטוח",
          reportTitle: "דוח התפתחות פרמיה",
          items: leftover,
          people,
          company: leftover[0]?.company || ""
        });
      }
      return groups;
    },

    notesPage(draft, page, total){
      return this.page(`
        <div class="giPart">הבהרות</div>
        <div class="giBox"><ul>${PREMIA_NOTES.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>
        <div class="giPart">אישור המועמד לביטוח</div>
        <div class="giBox"><p>${escapeHtml(APPROVAL[0])}</p><p>${escapeHtml(APPROVAL[1])}</p></div>
        <p>שם הלקוח: ${escapeHtml(draft.primary?.fullName || "")} ת.ז: ${escapeHtml(draft.primary?.idNumber || "")} · תאריך: ${escapeHtml(draft.date)}</p>
        ${this.foot(draft, page, total)}
      `);
    },

    renderPremiaPages(draft){
      const groups = this.premiaGroups(draft);
      const sections = groups.length ? groups : [{
        key: "empty",
        label: "",
        reportTitle: "דוח התפתחות פרמיה",
        items: [],
        people: draft.people || [],
        company: ""
      }];
      const pageBits = [];
      sections.forEach((group) => {
        const peopleBlocks = [];
        const seen = {};
        group.items.forEach((entry) => {
          const id = entry.person?.id || entry.person?.idNumber || entry.person?.fullName || String(peopleBlocks.length);
          if(seen[id]){
            peopleBlocks[seen[id] - 1].entries.push(entry);
            return;
          }
          seen[id] = peopleBlocks.length + 1;
          peopleBlocks.push({ person: entry.person, entries: [entry] });
        });
        if(!peopleBlocks.length) peopleBlocks.push({ person: null, entries: [] });
        const ageHtmls = group.items.flatMap((t) => this.ageTableChunks(t, 40));
        const heading = [group.label, group.company, group.reportTitle].filter(Boolean).join(" - ");
        pageBits.push({
          html: this.agentHead(draft, false)
            + `<div class="giPart">${escapeHtml(heading || "דוח התפתחות פרמיה")}</div>`
            + this.candidatesTable(draft, group.people.length ? group.people : (draft.people || []))
            + (peopleBlocks[0].entries.map((t) => this.year1Block(t)).join("") || "")
        });
        peopleBlocks.slice(1).forEach((block) => {
          pageBits.push({ html: block.entries.map((t) => this.year1Block(t)).join("") });
        });
        ageHtmls.forEach((html) => pageBits.push({ html }));
        pageBits.push({ html: null, notes: true });
      });
      const total = pageBits.length;
      return pageBits.map((bit, i) => {
        if(bit.notes) return this.notesPage(draft, i + 1, total);
        return this.page(bit.html + this.foot(draft, i + 1, total));
      }).join("");
    },
    renderPremiaHtml(draft){
      const d = draft || this.buildDraft({});
      return this.wrapHtml("דוח התפתחות פרמיה", this.renderPremiaPages(d));
    },

    renderPreviewHtml(draft, kind){
      if(kind === "premia") return this.renderPremiaHtml(draft);
      if(kind === "nispah"){
        const p = draft?.primary || {};
        const a = draft?.agent || {};
        return `<div class="giArrivalPreviewNispah">נספח ה׳ הרשמי · ${escapeHtml(p.fullName || "")} ת.ז ${escapeHtml(p.idNumber || "")} · סוכן ${escapeHtml(a.name || AGENCY)}</div>`;
      }
      return this.renderHatamaHtml(draft);
    },

    async fillNispahPdf(draft){
      if(global.GI_LOAD_LIBS?.pdfLib) await global.GI_LOAD_LIBS.pdfLib();
      const PDFLib = global.PDFLib;
      if(!PDFLib?.PDFDocument) throw new Error("PDFLib missing");
      const bytes = await fetchFirstOk(candidateUrls("forms/har-authorization/", TEMPLATE_FILE), "nispah template");
      const pdfDoc = await PDFLib.PDFDocument.load(bytes);
      let font = null;
      try {
        const fontBytes = await fetchFirstOk(candidateUrls("fonts/", "Heebo-Bold.ttf"), "font");
        if(fontBytes){
          if(global.fontkit) pdfDoc.registerFontkit(global.fontkit);
          font = await pdfDoc.embedFont(fontBytes);
        }
      } catch(_e) {}
      const form = pdfDoc.getForm();
      const helper = global.GI_OFFICIAL_FORM_FILL;
      const setText = (name, value) => {
        if(helper?.setTextSafe) helper.setTextSafe(form, name, value, font, { visual: false });
        else {
          const text = safeTrim(value);
          if(!text) return;
          try { form.getTextField(name).setText(text); } catch(_e) {}
        }
      };
      const p = draft?.primary || {};
      const a = draft?.agent || {};
      setText("Text1", p.fullName);
      setText("FullName", p.fullName);
      setText("PID", p.idNumber);
      setText("AgentName", a.agency || a.name || AGENCY);
      setText("Date", draft?.date || todayIL());
      setText("SuchnutnTypeName", a.name || AGENCY);
      setText("SuchnutTypeID", a.displayId || a.license || a.idNumber);
      if(font && form.updateFieldAppearances) form.updateFieldAppearances(font);
      return pdfDoc.save({ updateFieldAppearances: !!font });
    },

    fileName(kind, draft){
      const name = safeTrim(draft?.primary?.fullName) || "לקוח";
      const clean = name.replace(/[\\/:*?"<>|]/g, "_");
      const day = (draft?.date || todayIL()).replace(/\//g, "-");
      if(kind === "premia") return "התפתחות_פרמיה_" + clean + "_" + day + ".pdf";
      if(kind === "nispah") return "נספח_ה_הר_הביטוח_" + clean + "_" + day + ".pdf";
      return "מסמך_התאמה_" + clean + "_" + day + ".pdf";
    },

    async exportHtmlToPdf(html, filename, sourceBtn){
      const triggerBtn = sourceBtn || null;
      const originalText = triggerBtn ? triggerBtn.textContent : "";
      if(triggerBtn){
        triggerBtn.disabled = true;
        triggerBtn.textContent = "מייצא PDF…";
      }
      try {
        if(global.GI_LOAD_LIBS?.pdfExport) await global.GI_LOAD_LIBS.pdfExport();
        const JsPdfCtor = global.jspdf?.jsPDF || global.jsPDF;
        const html2canvas = global.html2canvas;
        if(!JsPdfCtor || typeof html2canvas !== "function") throw new Error("pdf engine missing");
        const host = document.createElement("div");
        host.setAttribute("dir", "rtl");
        host.style.cssText = "position:fixed;left:-20000px;top:0;width:794px;background:#fff;z-index:-1;";
        host.innerHTML = html;
        document.body.appendChild(host);
        if(document.fonts?.ready){
          try { await document.fonts.ready; } catch(_e) {}
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
        const pages = Array.from(host.querySelectorAll(".giArrivalPage"));
        const pdf = new JsPdfCtor({ unit: "pt", format: "a4", orientation: "portrait", compress: true });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        for(let i = 0; i < pages.length; i++){
          const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
          const img = canvas.toDataURL("image/jpeg", 0.92);
          if(i) pdf.addPage();
          pdf.addImage(img, "JPEG", 0, 0, pw, ph);
        }
        host.remove();
        pdf.save(filename);
        return true;
      } catch(err){
        try { console.warn("GI_ARRIVAL_PDF_EXPORT_FAILED", err); } catch(_e) {}
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = String(filename || "document").replace(/\.pdf$/i, "") + ".html";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return false;
      } finally {
        if(triggerBtn){
          triggerBtn.disabled = false;
          triggerBtn.textContent = originalText || "הורדה";
        }
      }
    },

    async downloadHatama(rec, sourceBtn){
      const draft = this.buildDraft(rec);
      const html = this.renderHatamaHtml(draft);
      return this.exportHtmlToPdf(html, this.fileName("hatama", draft), sourceBtn);
    },
    async downloadPremia(rec, sourceBtn){
      const draft = this.buildDraft(rec);
      const html = this.renderPremiaHtml(draft);
      return this.exportHtmlToPdf(html, this.fileName("premia", draft), sourceBtn);
    },
    async downloadNispah(rec, sourceBtn){
      const triggerBtn = sourceBtn || null;
      const originalText = triggerBtn ? triggerBtn.textContent : "";
      if(triggerBtn){
        triggerBtn.disabled = true;
        triggerBtn.textContent = "מפיק PDF…";
      }
      try {
        const draft = this.buildDraft(rec);
        const bytes = await this.fillNispahPdf(draft);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = this.fileName("nispah", draft);
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return true;
      } finally {
        if(triggerBtn){
          triggerBtn.disabled = false;
          triggerBtn.textContent = originalText || "הורדה";
        }
      }
    },

    formatDocName(kind, payload, uploadedAt){
      const helper = global.CustomerDocuments;
      const insured = helper?.getPrimaryInsuredLabel?.(payload) || "מבוטח";
      if(kind === "premia") return "דוח התפתחות פרמיה · " + insured;
      if(kind === "nispah") return "נספח ה׳ · הרשאת הר הביטוח · " + insured;
      return "מסמך התאמה · " + insured;
    },
    createDoc(kind, payload, options = {}){
      const uploadedAt = safeTrim(options.uploadedAt) || nowISO();
      const idPrefix = kind === "premia" ? "doc_arrival_premia_" : (kind === "nispah" ? "doc_arrival_nispah_" : "doc_arrival_hatama_");
      const helper = global.CustomerDocuments;
      return {
        id: helper?.newDocId?.(idPrefix) || (idPrefix + Date.now().toString(16)),
        type: TYPES[kind] || TYPES.hatama,
        name: this.formatDocName(kind, payload, uploadedAt),
        source: "מערכת",
        uploadedAt,
        uploadedBy: safeTrim(options.uploadedBy)
      };
    },
    injectDocs(list, rec, payload, options = {}){
      if(!Array.isArray(list)) return list;
      if(!this.qualifies(payload, rec)) return list;
      const uploadedAt = safeTrim(options.uploadedAt) || safeTrim(rec?.updatedAt) || nowISO();
      const uploadedBy = safeTrim(options.uploadedBy) || safeTrim(rec?.agentName);
      const wanted = [
        this.createDoc("hatama", payload, { uploadedAt, uploadedBy }),
        this.createDoc("premia", payload, { uploadedAt, uploadedBy }),
        this.createDoc("nispah", payload, { uploadedAt, uploadedBy })
      ];
      wanted.slice().reverse().forEach((doc) => {
        const exists = list.some((row) => safeTrim(row?.type) === doc.type);
        if(!exists) list.unshift(doc);
      });
      return list;
    }
  };

  try { global.GiArrivalDocs = GiArrivalDocs; } catch(_e) {}
  try { if(typeof module !== "undefined" && module.exports) module.exports = GiArrivalDocs; } catch(_e2) {}
})(typeof globalThis !== "undefined" ? globalThis : window);
