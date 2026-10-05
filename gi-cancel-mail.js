/* שליחת מכתב ביטול חתום לחברת ביטוח.
   לכל חברה ומוצר יש יעד. השליחה יוצאת מ-bituliimp@gmail.com רק אחרי חיבור התיבה.
   אין הודעת הצלחה ואין תיעוד שליחה לפני שליחה אמיתית. */
(function installCancelMail(global){
  "use strict";

  const FROM = "bituliimp@gmail.com";
  const FN_PATH = "/functions/v1/gi-sign";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const DESTINATIONS = [
    { id: "harel-health", label: "הראל בריאות", company: "הראל", product: "בריאות", email: "polisotbs@harel-ins.co.il", fax: "03-7348178" },
    { id: "harel-life", label: "הראל חיים", company: "הראל", product: "חיים", email: "cancellb@harel-ins.co.il", fax: "03-7348169" },
    { id: "clal-health", label: "כלל בריאות", company: "כלל", product: "בריאות", email: "BitulPolicyBriut@clal-ins.co.il", fax: "077-6383321" },
    { id: "clal-life", label: "כלל חיים", company: "כלל", product: "חיים", email: "bitulp@clal-ins.co.il", fax: "077-6383040" },
    { id: "phoenix", label: "הפניקס", company: "הפניקס", product: "", email: "bitul@fnx.co.il", fax: "03-7337731" },
    { id: "ayalon-life", label: "איילון חיים", company: "איילון", product: "חיים", email: "mail-cancel@ayalon-ins.co.il", fax: "03-7569566" },
    { id: "ayalon-health", label: "איילון בריאות", company: "איילון", product: "בריאות", email: "mail-cancel@ayalon-ins.co.il", fax: "072-2469552" },
    { id: "menora", label: "מנורה", company: "מנורה", product: "", email: "bitul-life@menora.co.il", fax: "074-7037376" },
    { id: "migdal", label: "מגדל", company: "מגדל", product: "", email: "cancelpolisa@migdal.co.il", fax: "076-8869437" },
    { id: "hachshara-life", label: "הכשרה חיים", company: "הכשרה", product: "חיים", email: "bitul@hcsra-ins.co.il", fax: "03-7962868" },
    { id: "hachshara-health", label: "הכשרה בריאות", company: "הכשרה", product: "בריאות", email: "bitul-b@hcsra-ins.co.il", fax: "03-7962868" },
    { id: "aig", label: "AIG", company: "AIG", product: "", email: "cancellation@aig.co.il", fax: "03-9272424" },
    { id: "libra", label: "ליברה", company: "ליברה", product: "", email: "bitul@lbr.co.il", fax: "073-3949223" },
    { id: "yashir", label: "ביטוח ישיר", company: "ביטוח ישיר", product: "", email: "bitullife@5555555.co.il", fax: "03-6282496" },
    { id: "poalim", label: "סוכנות פועלים", company: "סוכנות פועלים", product: "", email: "service@poalimbit.co.il", fax: "03-7140693" },
    { id: "tefahot", label: "סוכנות טפחות (בנק מזרחי)", company: "סוכנות טפחות", product: "", email: "polisa@umtb.co.il", fax: "03-5639177" },
    { id: "maalot", label: "סוכנות מעלות (בנק לאומי)", company: "סוכנות מעלות", product: "", email: "SHERUT_MAALOT@MAALOT-INS.CO.IL", fax: "03-9209450" },
    { id: "discount", label: "סוכנות דיסקונט", company: "סוכנות דיסקונט", product: "", email: "mashkantadiscount@dbank.co.il", fax: "" },
    { id: "ir-shalem", label: "עיר שלם (בנק ירושלים)", company: "עיר שלם", product: "", email: "stdjbank@standard.co.il", fax: "03-7348120" }
  ];

  function trim(v){ return String(v == null ? "" : v).trim(); }
  function esc(v){
    return trim(v).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[ch]));
  }
  function matchDest(company, product, destId){
    const id = trim(destId);
    if(id){
      const byId = DESTINATIONS.find((row) => row.id === id);
      if(byId) return byId;
    }
    const name = trim(company);
    const prod = trim(product);
    if(prod){
      const exact = DESTINATIONS.find((row) => row.company === name && row.product === prod);
      if(exact) return exact;
    }
    const byLabel = DESTINATIONS.find((row) => row.label === name || row.id === name);
    if(byLabel) return byLabel;
    const same = DESTINATIONS.filter((row) => row.company === name);
    if(same.length === 1) return same[0];
    return null;
  }
  function productBucket(doc){
    const family = trim(doc && doc.productFamily);
    const label = trim(doc && (doc.productLabel || doc.product));
    if(family === "health" || /בריאות/.test(label)) return "בריאות";
    if(family === "life" || family === "mortgage" || family === "ci" || /חיים|ריסק|משכנתא|מחלות/.test(label)) return "חיים";
    return "";
  }
  function companyEmail(company, product, destId){
    const dest = matchDest(company, product, destId);
    return dest ? dest.email : "";
  }

  function agent(){
    const api = global.Auth;
    const current = api && api.current ? api.current : null;
    return {
      id: trim(current && current.id),
      name: trim(current && current.name),
      username: trim((current && current.username) || (current && current.name)),
      pin: trim(api && api._sessionPin)
    };
  }

  function signToken(rec, doc){
    const map = rec && rec.payload && rec.payload.giSignByDoc;
    const id = trim(doc && doc.id);
    const entry = map && (map[id] || map[String(id)]);
    const links = entry && Array.isArray(entry.links) ? entry.links : [];
    const signed = links.filter((row) => trim(row && row.status) === "signed" && trim(row && row.token));
    const row = signed[0] || links[0] || {};
    return trim(row.token);
  }

  function recordOf(doc){
    const rec = doc && doc.cancelMail;
    if(!rec || !trim(rec.sentAt)) return null;
    return rec;
  }

  function recordHtml(rec){
    if(!rec) return "";
    let when = trim(rec.sentAt);
    try {
      const parsed = new Date(when);
      if(!Number.isNaN(parsed.getTime())) when = parsed.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
    } catch(_e) {}
    return `<div class="giCancelMail__record">אישור ביטול נשלח בתאריך ${esc(when)} על ידי ${esc(rec.sentBy)}</div>`;
  }

  function underDoc(rec, doc){
    if(!doc || trim(doc.type) !== "company_cancel_form") return "";
    const sign = global.GiSign;
    if(!sign || typeof sign.isSignedReady !== "function" || !sign.isSignedReady(rec, doc.id)) return "";
    const company = trim(doc.company);
    const product = productBucket(doc);
    const dest = matchDest(company, product, "");
    const token = signToken(rec, doc);
    const sent = recordOf(doc);
    const button = sent ? "" : `<button class="btn btn--small" type="button" data-cancel-mail-send="1" data-cancel-mail-token="${esc(token)}" data-company="${esc(company)}" data-product="${esc(product)}" data-dest-id="${esc(dest && dest.id)}" data-kind="company_cancel_form">שליחת ביטול לחברה</button>`;
    const target = dest ? `היעד: ${esc(dest.label)} · ${esc(dest.email)}. ` : "";
    return `<div class="giCancelMail">
      ${button}
      <p class="giCancelMail__note">${target}השליחה תצא מ-${esc(FROM)} אחרי חיבור התיבה. המכתב לא יוצא עכשיו.</p>
      ${recordHtml(sent)}
    </div>`;
  }

  function closeModal(){
    const found = document.querySelector(".giCancelMail__modal");
    if(found) found.remove();
  }

  function resultText(data){
    const code = trim(data && data.error);
    const from = trim(data && data.from) || FROM;
    if(code === "COMPANY_EMAIL_MISSING") return "אין עדיין מייל לחברה שנבחרה. לא נשלח מכתב מ-" + from + ", ולא נרשם אישור שליחה.";
    if(code === "MAIL_NOT_CONNECTED"){
      const email = trim(data && data.email);
      const target = email ? "היעד הוא " + email + ". " : "";
      return target + "תיבת " + from + " עדיין לא מחוברת לשליחה. לא נשלח מכתב, ולא נרשם אישור שליחה.";
    }
    if(code === "NOT_SIGNED") return "אפשר לשלוח רק אחרי שהלקוח סיים לחתום.";
    if(code === "FORBIDDEN" || code === "AUTH_FAILED" || code === "AUTH_REQUIRED") return "אין הרשאה לשלוח את מכתב הביטול.";
    return "לא נשלח מכתב.";
  }

  async function callEdge(payload){
    const res = await fetch(FALLBACK_SUPABASE_URL + FN_PATH, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: FALLBACK_PUBLISHABLE_KEY,
        Authorization: "Bearer " + FALLBACK_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
    let data = {};
    try { data = await res.json(); } catch(_e) { data = {}; }
    if(!res.ok || data.ok === false){
      const err = new Error(trim(data.error) || ("HTTP_" + res.status));
      err.code = trim(data.error);
      err.data = data;
      throw err;
    }
    return data;
  }

  function choose(opts){
    const options = opts && typeof opts === "object" ? opts : {};
    closeModal();
    const preset = matchDest(options.company, options.product, options.destId);
    const modal = document.createElement("div");
    modal.className = "giCancelMail__modal";
    const optionsHtml = DESTINATIONS.map((row) => {
      const selected = preset && preset.id === row.id ? " selected" : "";
      return `<option value="${esc(row.id)}"${selected}>${esc(row.label)}</option>`;
    }).join("");
    modal.innerHTML = `<div class="giCancelMail__dialog" role="dialog" aria-modal="true" aria-label="שליחת ביטול לחברה">
      <h2>שליחת ביטול לחברה</h2>
      <p>השליחה תצא מ-${esc(FROM)} אחרי חיבור התיבה. בחרו חברה ומוצר. המכתב לא יוצא עכשיו.</p>
      <label>חברה ומוצר
        <select id="giCancelCompany">${optionsHtml}</select>
      </label>
      <p class="giCancelMail__dest" id="giCancelDest"></p>
      <div class="giCancelMail__actions">
        <button class="btn btn--primary btn--small" type="button" id="giCancelGo">שליחת ביטול לחברה</button>
        <button class="btn btn--ghost btn--small" type="button" id="giCancelClose">סגירה</button>
      </div>
      <p class="giCancelMail__result" id="giCancelResult" hidden></p>
    </div>`;
    document.body.appendChild(modal);
    const showDest = () => {
      const dest = matchDest("", "", modal.querySelector("#giCancelCompany")?.value);
      const line = modal.querySelector("#giCancelDest");
      if(line) line.textContent = dest ? ("היעד: " + dest.email) : "";
    };
    modal.querySelector("#giCancelCompany")?.addEventListener("change", showDest);
    showDest();
    modal.querySelector("#giCancelClose")?.addEventListener("click", closeModal);
    modal.addEventListener("click", (ev) => { if(ev.target === modal) closeModal(); });
    modal.querySelector("#giCancelGo")?.addEventListener("click", () => submit(options, modal));
  }

  async function submit(options, modal){
    const destId = trim(modal.querySelector("#giCancelCompany")?.value);
    const dest = matchDest("", "", destId);
    const company = dest ? dest.label : "";
    const result = modal.querySelector("#giCancelResult");
    const me = agent();
    const show = (text, ok) => {
      if(!result) return;
      result.hidden = !text;
      result.textContent = text || "";
      result.classList.toggle("is-ok", !!ok);
    };
    if(!company) return show("בחרו חברת ביטוח.", false);
    if(!trim(options.token) || !me.pin || !me.username) return show("לא נשלח מכתב.", false);
    try {
      const data = await callEdge({
        action: "send_cancel",
        token: options.token,
        company: dest ? dest.company : "",
        product: dest ? dest.product : "",
        destId: destId,
        kind: trim(options.kind) || "company_cancel_form",
        pin: me.pin,
        username: me.username,
        agentId: me.id,
        agentName: me.name
      });
      if(data && data.ok === true && data.sent === true && data.record){
        show("המכתב נשלח לחברת הביטוח בהצלחה", true);
        try { global.showToast?.({ title: "המכתב נשלח לחברת הביטוח בהצלחה", text: company, variant: "ok" }); } catch(_e) {}
        const anchor = options.anchor;
        if(anchor && !anchor.querySelector(".giCancelMail__record")){
          anchor.insertAdjacentHTML("beforeend", recordHtml(data.record));
        }
        return;
      }
      show(resultText(data), false);
    } catch(err) {
      show(resultText(err && err.data ? err.data : { error: err && err.code }), false);
    }
  }

  function onClick(ev){
    const btn = ev.target && ev.target.closest ? ev.target.closest("[data-cancel-mail-send]") : null;
    if(!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    choose({
      token: btn.getAttribute("data-cancel-mail-token"),
      company: btn.getAttribute("data-company") || "",
      product: btn.getAttribute("data-product") || "",
      destId: btn.getAttribute("data-dest-id") || "",
      kind: btn.getAttribute("data-kind") || "company_cancel_form",
      anchor: btn.closest(".giCancelMail")
    });
  }

  if(!document.getElementById("giCancelMailStyle")){
    const style = document.createElement("style");
    style.id = "giCancelMailStyle";
    style.textContent = ".giCancelMail{margin:0 0 10px;padding:8px 12px 10px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px}"
      + ".giCancelMail__note{margin:6px 0 0;color:#9a3412;font-size:13px}"
      + ".giCancelMail__record{margin-top:6px;color:#166534;font-weight:700}"
      + ".giCancelMail__modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:80;padding:18px}"
      + ".giCancelMail__dialog{width:min(520px,100%);background:#fff;border-radius:16px;padding:18px}"
      + ".giCancelMail__dialog h2{margin:0 0 8px}"
      + ".giCancelMail__dialog p{margin:0 0 12px;color:#475569}"
      + ".giCancelMail__dialog label{display:flex;flex-direction:column;gap:6px;font-weight:700}"
      + ".giCancelMail__dialog select{font:inherit;padding:10px;border:1px solid #cbd5e1;border-radius:10px}"
      + ".giCancelMail__actions{display:flex;gap:8px;margin-top:12px}"
      + ".giCancelMail__result{font-weight:700;color:#9a3412}"
      + ".giCancelMail__result.is-ok{color:#166534}";
    document.head.appendChild(style);
  }
  document.addEventListener("click", onClick);

  const GiCancelMail = { FROM: FROM, DESTINATIONS: DESTINATIONS, companyEmail: companyEmail, underDoc: underDoc, choose: choose };
  try { global.GiCancelMail = GiCancelMail; } catch(_e) {}
})(window);
