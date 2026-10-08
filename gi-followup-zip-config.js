/* GI-FOLLOWUP-ZIP-CONFIG 20260930-followup-page-map-v1
   ספריית PDF משולבת לכל חברה (מ-fw.zip, ללא הראל).
   pageMap: מספר השאלון באשף → עמוד בקובץ (1-based) לפי הכותרת המודפסת. */
(function installFollowupZipConfig(global){
  "use strict";

  const CLAL_LETTERS = ["א","ב","ג","ד","ה","ו","ז","ח","ט","י","יא","יב","יג","יד","טו","טז","יז","יח","יט","כ","כא","כב","כג"];

  function clalLetterToCq(letter){
    const key = String(letter || "").trim();
    const idx = CLAL_LETTERS.indexOf(key);
    return idx >= 0 ? String(idx + 1) : "";
  }

  function pageOneBased(num, maxPages){
    const n = Number(num);
    if(!Number.isFinite(n) || n <= 0) return 1;
    return Math.min(Math.max(1, Math.floor(n)), maxPages || n);
  }

  function mappedPage(map, id, maxPages){
    const page = map && map[String(id == null ? "" : id).trim()];
    const n = Number(page);
    if(!Number.isFinite(n) || n <= 0) return 0;
    return pageOneBased(n, maxPages);
  }

  const COMPANIES = {
    menora: {
      label: "מנורה",
      aliases: ["menora", "menora_crit", "menora_cancer", "menora_mort", "menora_risk"],
      qKeyPrefixes: ["menora_", "menora_crit__", "menora_cancer__", "menora_mort__", "menora_risk__"],
      combinedPdf: "./forms/followup-questionnaires/menora-followup-all.pdf",
      pageCount: 27,
      fillMode: "sequential",
      fieldPrefix: (qNo) => String(qNo) + "__",
      /* 23 הוא המשך של שאלון 22. 23–26 מתחילים עמוד אחד אחרי המספר. */
      stackIds: ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26"],
      pageForQuestionnaire(qNo){
        const n = Number(qNo);
        if(n >= 1 && n <= 22) return pageOneBased(n, this.pageCount);
        if(n >= 23 && n <= 26) return pageOneBased(n + 1, this.pageCount);
        return 0;
      },
      fileLabel(qNo){
        return "שאלון-" + String(qNo).padStart(2, "0") + "-מנורה";
      }
    },
    phoenix: {
      label: "הפניקס",
      aliases: ["phoenix"],
      qKeyPrefixes: ["phoenix_", "phoenix_full__", "phoenix_risk_", "phoenix_mort_", "phoenix_ci_", "phoenix_ci__", "cancer_short_"],
      combinedPdf: "./forms/followup-questionnaires/phoenix-followup-all.pdf",
      pageCount: 13,
      fillMode: "phoenix",
      fieldPrefix: (qNo) => String(qNo) + "__",
      /* כמה שאלונים מודפסים על אותו עמוד. 3 ו־4 עם מום לב, 6 ו־7 עם שומנים, 10 עם עיכול, 13 ו־14 עם עמוד שדרה, 21 עם אשפוז. */
      stackIds: ["2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22"],
      pageMap: {
        "2": 11, "3": 11, "4": 11,
        "5": 10, "6": 10, "7": 10,
        "8": 5, "9": 4, "10": 4,
        "11": 7, "12": 2, "13": 2, "14": 2,
        "15": 3, "16": 1, "17": 9, "18": 6,
        "19": 12, "20": 8, "21": 8, "22": 13
      },
      pageForQuestionnaire(qNo){
        return mappedPage(this.pageMap, qNo, this.pageCount);
      },
      /* מיפוי סמנטי לפי מפתחות אשף (qN_* / N__*) → שדות טקסט בדף השאלון.
         Q2Q* שייכים לטופס הצטרפות בריאות, לא ל־phoenix-followup-all.pdf. */
      phoenixFieldMap: [
        { qNo: "2", keys: ["defect", "diagnosis", "q2_diagnosis", "q2_defect"] },
        { qNo: "2", keys: ["status", "q2_status", "currentStatus"] },
        { qNo: "2", keys: ["docs", "q2_docs", "requiredDocs"] },
        { qNo: "2", keys: ["date", "q2_date", "dates", "diagnosisDate"] },
        { qNo: "2", keys: ["tests", "q2_tests", "complications"] },
        { qNo: "2", keys: ["treatment", "q2_treatment"] },
        { qNo: "3", keys: ["diagnosis", "q3_diagnosis", "q3_reason"] },
        { qNo: "3", keys: ["medication", "q3_medication", "treatment"] },
        { qNo: "3", keys: ["ablation", "q3_ablation"] },
        { qNo: "3", keys: ["pacemaker", "q3_pacemaker"] },
        { qNo: "3", keys: ["date", "q3_date", "duration", "q3_duration", "outcome", "q3_outcome", "docs", "q3_docs"] },
        { qNo: "4", keys: ["bpValue", "q4_bp_value", "q4_value", "value"] }
      ],
      phoenixHeartMap: [
        { pdf: "Q2Q1", keys: ["defect", "diagnosis", "q2_defect", "q2_diagnosis"] },
        { pdf: "Q2Q2", keys: ["status", "q2_status", "currentStatus"] },
        { pdf: "Q2Q3", keys: ["docs", "q2_docs", "requiredDocs"] },
        { pdf: "Q2Q4", keys: ["diagnosis", "q3_diagnosis"] },
        { pdf: "Q2Q5", keys: ["medication", "q3_medication", "treatment"] },
        { pdf: "Q2Q6", keys: ["ablation", "q3_ablation"] },
        { pdf: "Q2Q7", keys: ["pacemaker", "q3_pacemaker"] },
        { pdf: "Q2Q8", keys: ["bpValue", "q4_bp_value"] },
        { pdf: "Q2Q9", keys: ["bpValue", "q4_bp_value"] },
        { pdf: "Q2Q10", keys: ["treatment", "q2_treatment"] },
        { pdf: "Q2Q11", keys: ["date", "q2_date", "dates", "diagnosisDate"] },
        { pdf: "Q2Q12", keys: ["tests", "q2_tests", "complications"] }
      ],
      fileLabel(qNo){
        return "שאלון-" + String(qNo).padStart(2, "0") + "-פניקס";
      }
    },
    clal: {
      label: "כלל",
      aliases: ["clal", "critical", "cancer"],
      qKeyPrefixes: ["clal_", "critical__", "cancer__", "clal_couple_", "clal_risk_", "clal_mortgage_"],
      combinedPdf: "./forms/followup-questionnaires/clal-followup-all.pdf",
      pageCount: 36,
      fillMode: "clal_cq",
      fieldPrefix: (letter) => "clal_" + String(letter) + "_",
      /* אות שתופסת יותר מעמוד אחד: העמוד כאן הוא העמוד הראשון של האות. */
      pageMap: {
        "א": 1, "ב": 2, "ג": 3, "ד": 5, "ה": 6, "ו": 7, "ז": 8, "ח": 10,
        "ט": 12, "י": 13, "יא": 14, "יב": 16, "יג": 18, "יד": 19, "טו": 20,
        "טז": 21, "יז": 25, "יח": 26, "יט": 28, "כ": 30, "כא": 31, "כב": 34, "כג": 33
      },
      pageForQuestionnaire(letter){
        return mappedPage(this.pageMap, letter, this.pageCount);
      },
      cqForLetter: clalLetterToCq,
      fileLabel(letter){
        return "שאלון-" + String(letter) + "-כלל";
      }
    },
    hachshara: {
      label: "הכשרה",
      aliases: ["hachshara"],
      qKeyPrefixes: ["hachshara_", "hachshara_mort_", "hachshara_crit_", "hachshara_risk_"],
      combinedPdf: "./forms/followup-questionnaires/hachshara-followup-all.pdf",
      pageCount: 29,
      fillMode: "hachshara",
      fieldPrefix: (qNo) => String(qNo) + "__",
      /* 19 אנדוקרינולוגיה אינו בקובץ. 11 לב נפתח על עמוד הלב (2). 17 ריאות על עמוד 11. */
      stackIds: ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","20","21","22","23","24","25","26","27","28","29"],
      pageMap: {
        "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
        "11": 2, "12": 12, "13": 13, "14": 28, "15": 14, "16": 16, "17": 11, "18": 18,
        "20": 19, "21": 20, "22": 21, "23": 22, "24": 23, "25": 24, "26": 25, "27": 26,
        "28": 27, "29": 28
      },
      pageForQuestionnaire(qNo){
        return mappedPage(this.pageMap, qNo, this.pageCount);
      },
      fileLabel(qNo){
        return "שאלון-" + String(qNo).padStart(2, "0") + "-הכשרה";
      }
    },
    ayalon: {
      label: "איילון",
      aliases: ["ayalon"],
      qKeyPrefixes: ["ayalon_", "ayalon_crit_", "ayalon_crit_full__", "ayalon_cancer__"],
      combinedPdf: "./forms/followup-questionnaires/ayalon-followup-all.pdf",
      pageCount: 52,
      fillMode: "sequential",
      fieldPrefix: (qNo) => String(qNo) + "__",
      /* עותק ראשון בלבד. 1 ו־10 בקובץ אינם הנוירולוגיה והמחלה המטבולית שבאשף. 32 הוא עמוד 28. */
      stackIds: ["2","3","4","5","6","7","8","9","11","12","13","14","15","16","17","18","19","20","21","22","23","32"],
      pageMap: {
        "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6, "8": 7, "9": 8,
        "11": 11, "12": 12, "13": 13, "14": 14, "15": 15, "16": 16, "17": 17,
        "18": 18, "19": 19, "20": 20, "21": 21, "22": 22, "23": 23, "32": 28
      },
      pageForQuestionnaire(qNo){
        return mappedPage(this.pageMap, qNo, this.pageCount);
      },
      fileLabel(qNo){
        return "שאלון-" + String(qNo).padStart(2, "0") + "-איילון";
      }
    },
    migdal: {
      label: "מגדל",
      aliases: ["magdal", "migdal"],
      qKeyPrefixes: ["magdal_", "magdal_life__", "magdal_mort_", "magdal_cancer__"],
      combinedPdf: "./forms/followup-questionnaires/migdal-followup-all.pdf",
      pageCount: 30,
      fillMode: "sequential",
      fieldPrefix: (qNo) => String(qNo) + "__",
      pageForQuestionnaire(qNo){
        return pageOneBased(Number(qNo), this.pageCount);
      },
      fileLabel(qNo){
        return "שאלון-" + String(qNo).padStart(2, "0") + "-מגדל";
      }
    }
  };

  global.GI_FOLLOWUP_ZIP_CONFIG = {
    VERSION: "20260930-followup-page-map-v1",
    CLAL_LETTERS,
    COMPANIES,
    companyKeyFromQKey(qKey){
      const k = String(qKey || "");
      for(const [key, cfg] of Object.entries(COMPANIES)){
        if((cfg.qKeyPrefixes || []).some((p) => k.startsWith(p))) return key;
      }
      return "";
    },
    companyKeyFromLabel(label){
      const s = String(label || "").trim();
      for(const [key, cfg] of Object.entries(COMPANIES)){
        if(cfg.label === s) return key;
      }
      return "";
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
