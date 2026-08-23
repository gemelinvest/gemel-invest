/* GI-SIM-DISC-COVER 2026-08-23
   Runtime של gi-sim-discount-engine.ts — לא לערוך בנפרד מהמקור ה-Typed. */
(function (root) {
  "use strict";

  function year1Pct(opt) {
    if (!opt) return 0;
    if (Array.isArray(opt.schedule) && opt.schedule.length) {
      const n = Number(opt.schedule[0]);
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(opt.pct);
    return Number.isFinite(n) ? n : 0;
  }

  function moneyAfterPct(shekels, pct) {
    const ag = Math.round(Number(shekels) * 100);
    if (!Number.isFinite(ag)) return null;
    const p = Number(pct);
    if (!Number.isFinite(p) || p <= 0) return ag / 100;
    return Math.round((ag * (100 - p)) / 100) / 100;
  }

  function coverMonthlyAgorot(cover) {
    if (Number.isInteger(cover && cover.monthlyAgorot)) return cover.monthlyAgorot;
    const ag = Math.round(Number(cover && cover.monthlyPremium) * 100);
    return Number.isFinite(ag) ? ag : null;
  }

  function coverMap(opt) {
    return opt && opt.pctByCover && typeof opt.pctByCover === "object" ? opt.pctByCover : null;
  }

  function fullPriceIds(opt) {
    return Array.isArray(opt && opt.fullPriceIds) ? opt.fullPriceIds : [];
  }

  function coverDiscountPct(opt, coverId) {
    if (!opt) return 0;
    const id = String(coverId || "");
    const map = coverMap(opt);
    if (map && Object.prototype.hasOwnProperty.call(map, id)) {
      const n = Number(map[id]);
      return Number.isFinite(n) ? n : 0;
    }
    if (fullPriceIds(opt).indexOf(id) >= 0) return 0;
    if (map) return 0;
    return year1Pct(opt);
  }

  function coverMatch(opt, coverId) {
    const id = String(coverId || "");
    const map = coverMap(opt);
    if (map && Object.prototype.hasOwnProperty.call(map, id)) return "exact";
    if (fullPriceIds(opt).indexOf(id) >= 0) return "exempt";
    if (map) return "none";
    if (fullPriceIds(opt).length) return "exact";
    return "none";
  }

  function afterMonthly(result, opt) {
    if (!opt || !result || !result.ok) return null;
    const covers = Array.isArray(result.covers) ? result.covers : [];
    const map = coverMap(opt);
    const exempt = fullPriceIds(opt);
    if (covers.length && (map || exempt.length)) {
      let totalAg = 0;
      for (let i = 0; i < covers.length; i++) {
        const c = covers[i];
        const ag = coverMonthlyAgorot(c);
        if (!Number.isFinite(ag)) continue;
        const pct = coverDiscountPct(opt, (c && c.id) || "");
        totalAg += Math.round((ag * (100 - pct)) / 100);
      }
      return totalAg / 100;
    }
    if (covers.length) {
      let totalAg = 0;
      for (let i = 0; i < covers.length; i++) {
        const ag = coverMonthlyAgorot(covers[i]);
        if (Number.isFinite(ag)) totalAg += ag;
      }
      return totalAg / 100;
    }
    const monthly = Number(result.monthlyPremium);
    if (!Number.isFinite(monthly)) return null;
    return moneyAfterPct(monthly, year1Pct(opt));
  }

  function explain(result, opt, company, product) {
    const companyName = String(company || "").trim();
    const productName = String(product || "").trim();
    const optionId = opt && opt.id ? String(opt.id) : "";
    const optionLabel = opt && opt.label ? String(opt.label) : "";
    const empty = { after: null, rows: [], company: companyName, product: productName, optionId, optionLabel };
    if (!opt || !result || !result.ok) return empty;
    const sourceBase = [companyName, productName, optionId || optionLabel].filter(Boolean).join(" → ");
    const covers = Array.isArray(result.covers) ? result.covers : [];
    const map = coverMap(opt);
    const exempt = fullPriceIds(opt);
    const split = covers.length > 0 && (!!map || exempt.length > 0);

    if (split) {
      const rows = [];
      let totalAfterAg = 0;
      for (let i = 0; i < covers.length; i++) {
        const c = covers[i];
        const ag = coverMonthlyAgorot(c);
        if (!Number.isFinite(ag)) continue;
        const id = String((c && c.id) || "");
        const pct = coverDiscountPct(opt, id);
        const afterAg = Math.round((ag * (100 - pct)) / 100);
        const original = ag / 100;
        const after = afterAg / 100;
        const match = coverMatch(opt, id);
        const status = pct > 0 && match === "exact" ? "APPLIED" : (match === "none" && !map ? "UNKNOWN" : "NO_DISCOUNT");
        rows.push({
          coverId: id,
          label: String((c && c.label) || id),
          original,
          pct,
          amount: Math.round((original - after) * 100) / 100,
          after,
          source: sourceBase + (id ? " → " + id : ""),
          match,
          status,
          rule: "cover"
        });
        totalAfterAg += afterAg;
      }
      return { after: rows.length ? totalAfterAg / 100 : null, rows, company: companyName, product: productName, optionId, optionLabel };
    }

    if (covers.length) {
      const rows = [];
      let totalAfterAg = 0;
      for (let i = 0; i < covers.length; i++) {
        const c = covers[i];
        const ag = coverMonthlyAgorot(c);
        if (!Number.isFinite(ag)) continue;
        const id = String((c && c.id) || "");
        const original = ag / 100;
        rows.push({
          coverId: id,
          label: String((c && c.label) || id),
          original,
          pct: 0,
          amount: 0,
          after: original,
          source: sourceBase + (id ? " → " + id : ""),
          match: "none",
          status: "UNKNOWN",
          rule: "cover"
        });
        totalAfterAg += ag;
      }
      return { after: rows.length ? totalAfterAg / 100 : null, rows, company: companyName, product: productName, optionId, optionLabel };
    }

    const monthly = Number(result.monthlyPremium);
    if (!Number.isFinite(monthly)) return empty;
    const pct = year1Pct(opt);
    const after = moneyAfterPct(monthly, pct);
    const applied = pct > 0;
    return {
      after,
      rows: [{
        coverId: "",
        label: productName || "פרמיה",
        original: monthly,
        pct,
        amount: after == null ? 0 : Math.round((monthly - after) * 100) / 100,
        after: after == null ? monthly : after,
        source: sourceBase,
        match: applied ? "exact" : "none",
        status: applied ? "APPLIED" : "NO_DISCOUNT",
        rule: "product"
      }],
      company: companyName,
      product: productName,
      optionId,
      optionLabel
    };
  }

  const api = { year1Pct, moneyAfterPct, coverDiscountPct, afterMonthly, explain };
  if (root) root.GiSimDiscountEngine = api;
  if (typeof module !== "undefined" && module && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
