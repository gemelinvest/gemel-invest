/* שליחת לינק חתימה ללקוח מהמספר 0556686960.
   בלי חיבור מטא ההודעה לא מסומנת כנשלחה. */
(function installWhatsappSign(global){
  "use strict";

  const FROM = "0556686960";
  const FN_PATH = "/functions/v1/gi-sign";
  const FALLBACK_SUPABASE_URL = "https://vhvlkerectggovfihjgm.supabase.co";
  const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_JixJJelGPWcP0BPKGq96Lw_nIiMyIBb";

  function trim(v){ return String(v == null ? "" : v).trim(); }

  async function callEdge(payload){
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 16000);
    try {
      const res = await fetch(FALLBACK_SUPABASE_URL + FN_PATH, {
        method: "POST",
        cache: "no-store",
        signal: ctrl.signal,
        headers: {
          apikey: FALLBACK_PUBLISHABLE_KEY,
          Authorization: "Bearer " + FALLBACK_PUBLISHABLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload || {})
      });
      let data = {};
      try { data = await res.json(); } catch(_e) { data = {}; }
      if(!res.ok || data.ok === false || data.sent !== true){
        return { sent: false, code: trim(data.error) || "WHATSAPP_FAILED", from: trim(data.from) || FROM };
      }
      return { sent: true, code: "", from: trim(data.from) || FROM };
    } catch(_e) {
      return { sent: false, code: "WHATSAPP_FAILED", from: FROM };
    } finally {
      clearTimeout(timer);
    }
  }

  async function sendLinks(opts){
    const options = opts && typeof opts === "object" ? opts : {};
    const links = (Array.isArray(options.links) ? options.links : []).filter((row) => trim(row && row.href) && trim(row.slot) !== "agent");
    if(!trim(options.phone) || !links.length) return { sent: false, code: "MISSING_PHONE", from: FROM };
    return callEdge({
      action: "send_whatsapp",
      pin: options.pin,
      username: options.username,
      agentId: options.agentId,
      agentName: options.agentName,
      phone: options.phone,
      customerName: options.customerName,
      links: links.map((row) => ({ href: trim(row.href), name: trim(row.name), slot: trim(row.slot) }))
    });
  }

  function note(result){
    if(result && result.sent) return "הלינק נשלח לוואטסאפ של הלקוח מהמספר " + FROM + ".";
    if(result && result.code === "MISSING_PHONE") return "הלינק מוכן. אין מספר טלפון ללקוח, ולכן לא נשלחה הודעת וואטסאפ.";
    if(result && result.code === "WHATSAPP_FAILED") return "הלינק מוכן. הודעת הוואטסאפ לא יצאה, ולכן לא נשלחה הודעת וואטסאפ.";
    return "הלינק מוכן. המספר " + FROM + " עדיין לא מחובר, ולכן לא נשלחה הודעת וואטסאפ.";
  }

  try { global.GiWhatsappSign = { FROM: FROM, sendLinks: sendLinks, note: note }; } catch(_e) {}
})(window);
