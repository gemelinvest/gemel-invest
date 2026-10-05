/* שליחת מכתב ביטול חתום לחברת ביטוח.
   התיבה השולחת קבועה. כתובות החברות נשארות ריקות עד שהמשרד יעביר את הרשימה.
   אין הודעת הצלחה ואין תיעוד שליחה לפני שליחה אמיתית. */
(function installCancelMail(global){
  "use strict";

  const FROM = "bituliimp@gmail.com";
  const FN_PATH = "/functions/v1/gi-sign";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";
  const COMPANIES = [
    { id: "מנורה", name: "מנורה" },
    { id: "מגדל", name: "מגדל" },
    { id: "הראל", name: "הראל" },
    { id: "הפניקס", name: "הפניקס" },
    { id: "הכשרה", name: "הכשרה" },
    { id: "איילון", name: "איילון" },
    { id: "כלל", name: "כלל" }
  ];

  function trim(v){ return String(v == null ? "" : v).trim(); }
  function esc(v){
    return trim(v).replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[ch]));
  }
  function companyEmail(){ return ""; }

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
    const token = signToken(rec, doc);
    const sent = recordOf(doc);
    const button = sent ? "" : `<button class="btn btn--small" type="button" data-cancel-mail-send="1" data-cancel-mail-token="${esc(token)}" data-company="${esc(company)}" data-kind="company_cancel_form">שליחת ביטול לחברה</button>`;
    return `<div class="giCancelMail">
      ${button}
      <p class="giCancelMail__note">השליחה תצא מ-${esc(FROM)}. כתובות החברות עדיין לא הוזנו, ולכן לא נשלח מכתב.</p>
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
    if(code === "MAIL_NOT_CONNECTED") return "תיבת " + from + " עדיין לא מחוברת לשליחה. לא נשלח מכתב, ולא נרשם אישור שליחה.";
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
    const preset = trim(options.company);
    const modal = document.createElement("div");
    modal.className = "giCancelMail__modal";
    const optionsHtml = COMPANIES.map((row) => {
      const selected = row.name === preset || row.id === preset ? " selected" : "";
      return `<option value="${esc(row.name)}"${selected}>${esc(row.name)}</option>`;
    }).join("");
    modal.innerHTML = `<div class="giCancelMail__dialog" role="dialog" aria-modal="true" aria-label="שליחת ביטול לחברה">
      <h2>שליחת ביטול לחברה</h2>
      <p>השליחה תצא מהמייל ${esc(FROM)}. רשימת כתובות החברות עדיין לא הוזנה, ולכן המכתב לא יישלח עכשיו.</p>
      <label>חברת הביטוח
        <select id="giCancelCompany">${optionsHtml}</select>
      </label>
      <div class="giCancelMail__actions">
        <button class="btn btn--primary btn--small" type="button" id="giCancelGo">שליחת ביטול לחברה</button>
        <button class="btn btn--ghost btn--small" type="button" id="giCancelClose">סגירה</button>
      </div>
      <p class="giCancelMail__result" id="giCancelResult" hidden></p>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#giCancelClose")?.addEventListener("click", closeModal);
    modal.addEventListener("click", (ev) => { if(ev.target === modal) closeModal(); });
    modal.querySelector("#giCancelGo")?.addEventListener("click", () => submit(options, modal));
  }

  async function submit(options, modal){
    const company = trim(modal.querySelector("#giCancelCompany")?.value);
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
        company: company,
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
      + ".giCancelMail__dialog{width:min(440px,100%);background:#fff;border-radius:16px;padding:18px}"
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

  const GiCancelMail = { FROM: FROM, COMPANIES: COMPANIES, companyEmail: companyEmail, underDoc: underDoc, choose: choose };
  try { global.GiCancelMail = GiCancelMail; } catch(_e) {}
})(window);
