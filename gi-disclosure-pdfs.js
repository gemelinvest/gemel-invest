/* בחירת קבצי גילוי נאות לפי חברה ומוצר מתוך הפוליסות המוצעות.
   הקבצים עצמם יושבים ב-disclosure-pdfs ומפורטים ב-gi-disclosure-pdf-data.js. */
(function(global){
  "use strict";

  var FILES = global.GI_DISCLOSURE_PDF_FILES || {};
  var GENERIC = { service: 1, ambulatory: 1, surgeries_israel: 1 };
  var COMPANY_ALIAS = [
    ["מנורה מבטחים", "מנורה"],
    ["מנורה", "מנורה"],
    ["menora", "מנורה"],
    ["ביטוח מגדל", "מגדל"],
    ["מגדל", "מגדל"],
    ["migdal", "מגדל"],
    ["ביטוח הפניקס", "הפניקס"],
    ["הפניקס", "הפניקס"],
    ["פניקס", "הפניקס"],
    ["phoenix", "הפניקס"],
    ["ביטוח הכשרה", "הכשרה"],
    ["הכשרה", "הכשרה"],
    ["hachshara", "הכשרה"],
    ["ביטוח איילון", "איילון"],
    ["איילון", "איילון"],
    ["ayalon", "איילון"],
    ["ביטוח כלל", "כלל"],
    ["כלל", "כלל"],
    ["clal", "כלל"]
  ];
  var KEY_LABELS = {
    meds: "תרופות",
    transplants: "השתלות",
    surgeries_abroad: "ניתוחים בחו\"ל",
    surgeries_israel_5000: "ניתוחים משלים שב\"ן עם השתתפות",
    surgeries_israel_none: "ניתוחים משלים שב\"ן ללא השתתפות",
    surgeries_israel_first: "ניתוחים מהשקל הראשון",
    amb_consult: "ייעוצים ובדיקות",
    amb_extended: "ייעוצים ובדיקות מורחב",
    amb_treatments: "טיפולים אמבולטוריים",
    amb_diagnosis: "ייעוצים ובדיקות משולב אבחון",
    alt_medicine: "רפואה משלימה",
    diagnosis_fast: "אבחון מהיר",
    online: "ייעוץ מקוון",
    home: "ביקור עד הבית",
    premium_child: "שירותים לילד",
    child_dev: "התפתחות הילד",
    child_top: "טופ לילד",
    tech: "טיפולים טכנולוגיים",
    critical_illness: "מחלות קשות",
    cancer: "סרטן",
    risk: "ריסק",
    risk15: "ריסק 5",
    risk_future: "דרור לעתיד",
    mortgage: "משכנתא",
    mortgage_disability: "משכנתא לאדם עם מוגבלות",
    family_income: "הכנסה למשפחה",
    umbrella: "מטריה ביטוחית",
    disability_income: "אובדן כושר עבודה",
    accident_death: "מוות מתאונה",
    accident_disability: "נכות מתאונה",
    bargafen: "בר גפן",
    sport: "ספורטיבי",
    preventive: "מניעתית",
    personal_escort: "ליווי אישי",
    medical_escort: "ליווי רפואי",
    treatments: "טיפולים רפואיים"
  };

  function norm(value){
    return String(value == null ? "" : value)
      .toLowerCase()
      .replace(/["״׳']/g, "")
      .replace(/[()]/g, " ")
      .replace(/[-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function resolveCompany(name){
    var raw = String(name == null ? "" : name).trim();
    if(!raw) return "";
    if(FILES[raw]) return raw;
    var n = norm(raw);
    var keys = Object.keys(FILES);
    for(var i = 0; i < keys.length; i++){
      if(norm(keys[i]) === n) return keys[i];
    }
    var hit = "";
    var score = 0;
    for(var j = 0; j < COMPANY_ALIAS.length; j++){
      var alias = norm(COMPANY_ALIAS[j][0]);
      if(alias && n.indexOf(alias) >= 0 && alias.length > score){
        score = alias.length;
        hit = COMPANY_ALIAS[j][1];
      }
    }
    return hit;
  }

  function wantsRisk15(blob){
    var s = norm(blob);
    if(!s) return false;
    if(s.indexOf("ריסק 15") >= 0 || s.indexOf("ריסק15") >= 0) return true;
    return /ריסק\s*5(?!\d)/.test(s);
  }

  function wantsFuture(blob){
    return norm(blob).indexOf("דרור לעתיד") >= 0;
  }

  function wantsDisabilityMortgage(blob){
    return norm(blob).indexOf("מוגבלות") >= 0;
  }

  function entryForKey(book, key, blob){
    if(!book || !key) return null;
    if(key === "risk"){
      if(wantsFuture(blob) && book.risk_future) return book.risk_future;
      if(wantsRisk15(blob) && book.risk15) return book.risk15;
      return book.risk || null;
    }
    if(key === "mortgage"){
      if(wantsDisabilityMortgage(blob) && book.mortgage_disability) return book.mortgage_disability;
      return book.mortgage || null;
    }
    return book[key] || null;
  }

  function entryForAlias(book, cover){
    var text = norm(cover);
    if(!text || !book) return null;
    var best = null;
    var bestScore = 0;
    var tie = false;
    Object.keys(book).forEach(function(key){
      var entry = book[key];
      var aliases = entry && entry.aliases ? entry.aliases : [];
      aliases.forEach(function(alias){
        var phrase = norm(alias);
        if(phrase.length < 4) return;
        if(text.indexOf(phrase) < 0) return;
        if(phrase.length > bestScore){
          bestScore = phrase.length;
          best = entry;
          tie = false;
        }else if(phrase.length === bestScore && best && best.file !== entry.file){
          tie = true;
        }
      });
    });
    if(tie) return null;
    return best;
  }

  function pushDoc(docs, seen, company, entry){
    if(!entry || !entry.file || seen[entry.file]) return;
    seen[entry.file] = 1;
    docs.push({
      id: entry.id || entry.file,
      company: company,
      key: entry.key || "",
      title: entry.title || entry.key || "גילוי נאות",
      file: entry.file
    });
  }

  function pick(input){
    input = input || {};
    var company = resolveCompany(input.company);
    var book = company ? FILES[company] : null;
    var docs = [];
    var seen = {};
    var missing = [];
    var covers = Array.isArray(input.covers) ? input.covers : [];
    var keys = Array.isArray(input.keys) ? input.keys : [];
    if(!book){
      if(covers.length) covers.forEach(function(cover){ if(cover) missing.push(String(cover)); });
      else keys.forEach(function(key){ if(key && !GENERIC[key]) missing.push(KEY_LABELS[key] || String(key)); });
      return { docs: docs, missing: missing };
    }
    var blob = input.blob || "";
    var keyed = [];
    keys.forEach(function(key){
      if(!key || GENERIC[key]) return;
      var entry = entryForKey(book, key, blob);
      if(entry) keyed.push(entry);
      else missing.push(KEY_LABELS[key] || String(key));
    });
    if(keyed.length){
      keyed.forEach(function(entry){ pushDoc(docs, seen, company, entry); });
      return { docs: docs, missing: missing };
    }
    var aliasSources = covers.slice();
    if(!aliasSources.length && blob) aliasSources = [blob];
    aliasSources.forEach(function(cover){
      var entry = entryForAlias(book, cover);
      if(entry) pushDoc(docs, seen, company, entry);
    });
    if(!docs.length && covers.length){
      covers.forEach(function(cover){
        if(cover) missing.push(String(cover));
      });
    }
    return { docs: docs, missing: missing };
  }

  function select(policies, api){
    var docs = [];
    var missing = [];
    var seen = {};
    var list = Array.isArray(policies) ? policies : [];
    list.forEach(function(policy){
      if(!policy || !api) return;
      var company = "";
      try{ company = api.company(policy) || ""; }catch(_e){ company = ""; }
      var health = false;
      try{ health = !!api.health(policy); }catch(_e2){ health = false; }
      if(health){
        var covers = [];
        try{ covers = api.covers(policy) || []; }catch(_e3){ covers = []; }
        if(!covers.length){
          missing.push((company || "חברה") + " · בריאות בלי כיסויים");
          return;
        }
        covers.forEach(function(cover){
          var coverKeys = [];
          try{ coverKeys = api.keysForCover(company, cover) || []; }catch(_e4){ coverKeys = []; }
          var picked = pick({ company: company, keys: coverKeys, covers: [cover], blob: cover });
          if(!picked.docs.length) missing.push((company || "חברה") + " · " + cover);
          picked.docs.forEach(function(doc){
            if(seen[doc.file]) return;
            seen[doc.file] = 1;
            docs.push(doc);
          });
        });
        return;
      }
      var lifeKeys = [];
      var blob = "";
      var label = "";
      try{ lifeKeys = api.keysForPolicy(policy) || []; }catch(_e5){ lifeKeys = []; }
      try{ blob = api.blob(policy) || ""; }catch(_e6){ blob = ""; }
      try{ label = api.label ? (api.label(policy) || "") : ""; }catch(_e7){ label = ""; }
      var pickedLife = pick({ company: company, keys: lifeKeys, covers: [], blob: blob });
      pickedLife.docs.forEach(function(doc){
        if(seen[doc.file]) return;
        seen[doc.file] = 1;
        docs.push(doc);
      });
      if(!pickedLife.docs.length && !pickedLife.missing.length){
        missing.push((company || "חברה") + " · " + (label || "מוצר"));
      }
      pickedLife.missing.forEach(function(name){
        missing.push((company || "חברה") + " · " + name);
      });
    });
    return { docs: docs, missing: missing };
  }

  global.GiDisclosurePdfs = {
    files: FILES,
    resolveCompany: resolveCompany,
    pick: pick,
    select: select,
    keyLabel: function(key){ return KEY_LABELS[key] || key; }
  };
})(typeof window !== "undefined" ? window : globalThis);
