(() => {
  "use strict";

  const APP = () => window.InvestoPwa;
  const $ = (sel, root = document) => root.querySelector(sel);

  const POLL_MS = 30000;
  const NEW_WINDOW_MS = 30 * 60 * 1000;
  const META_TOKEN = "---LEAD_META_JSON---";

  let pollTimer = null;
  let inbox = [];
  let seenIds = new Set();

  function loadSeen() {
    try {
      const raw = localStorage.getItem("investo_pwa_seen_v1");
      if (raw) JSON.parse(raw).forEach(id => seenIds.add(id));
    } catch (_e) {}
  }

  function persistSeen() {
    localStorage.setItem("investo_pwa_seen_v1", JSON.stringify([...seenIds].slice(-500)));
  }

  function canAccessLeads() {
    const role = APP().getSession()?.role || "";
    return role && !["ops", "referent"].includes(role);
  }

  function canViewAllLeads() {
    const role = APP().getSession()?.role || "";
    return ["admin", "owner", "manager"].includes(role);
  }

  function parseLeadMeta(description) {
    const desc = String(description || "").replace(/\r\n/g, "\n");
    const idx = desc.indexOf("\n" + META_TOKEN) >= 0
      ? desc.indexOf("\n" + META_TOKEN)
      : desc.indexOf(META_TOKEN);
    if (idx < 0) return { closedAt: "", closedNote: "" };
    const start = desc.indexOf(META_TOKEN) + META_TOKEN.length;
    try {
      const obj = JSON.parse(desc.slice(start).trim());
      return {
        closedAt: String(obj.closedAt || "").trim(),
        closedNote: String(obj.closedNote || "").trim()
      };
    } catch (_e) {
      return { closedAt: "", closedNote: "" };
    }
  }

  function mapClosedLead(row) {
    if (String(row.status || "").trim().toLowerCase() !== "closed") return null;
    const meta = parseLeadMeta(row.description);
    return {
      id: row.id,
      customerName: String(row.customer_name || "").trim() || "ליד",
      phone: String(row.phone || "").trim(),
      campaignLabel: String(row.campaign_label || "").trim() || "—",
      assignedAgentName: String(row.assigned_agent_name || "").trim() || "—",
      closedAt: meta.closedAt || row.updated_at || "",
      closedNote: meta.closedNote,
      updatedAt: row.updated_at || ""
    };
  }

  async function loadClosedLeads() {
    if (!canAccessLeads()) return [];
    const session = APP().getSession();
    const params = {
      status: "eq.closed",
      select: "id,phone,customer_name,description,campaign_label,assigned_agent_name,status,updated_at",
      order: "updated_at.desc",
      limit: "300"
    };

    if (canViewAllLeads()) {
      const rows = await APP().apiGet("campaign_leads", params);
      return rows.map(mapClosedLead).filter(Boolean);
    }

    const merged = new Map();
    const name = session.displayName || "";
    const code = session.userKey || "";
    const agentId = session.agentId || "";

    const fetches = [];
    if (agentId) {
      fetches.push(APP().apiGet("campaign_leads", {
        ...params,
        assigned_agent_id: `eq.${agentId}`
      }));
    }
    if (name) {
      fetches.push(APP().apiGet("campaign_leads", {
        ...params,
        assigned_agent_name: `eq.${name}`
      }));
    }
    if (code && code !== name) {
      fetches.push(APP().apiGet("campaign_leads", {
        ...params,
        assigned_agent_name: `eq.${code}`
      }));
    }

    const batches = await Promise.all(fetches.map(p => p.catch(() => [])));
    batches.flat().forEach(row => {
      const item = mapClosedLead(row);
      if (item) merged.set(item.id, item);
    });
    return [...merged.values()].sort((a, b) =>
      new Date(b.closedAt || b.updatedAt) - new Date(a.closedAt || a.updatedAt));
  }

  function parseTs(raw) {
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function buildInbox(customers, reminders, closedLeads) {
    const items = [];
    const now = Date.now();

    reminders.forEach(r => {
      items.push({
        id: "rem_" + r.id,
        type: "reminder",
        title: r.customer_name || "תזכורת",
        body: r.details || "",
        at: r.remind_at || r.created_at,
        sort: parseTs(r.remind_at || r.created_at)
      });
    });

    customers.forEach(c => {
      const ts = parseTs(c.updated_at || c.created_at);
      if (!ts || now - ts > NEW_WINDOW_MS) return;
      items.push({
        id: "sale_" + c.id,
        type: "sale",
        title: "מכירה חדשה: " + (c.full_name || "לקוח"),
        body: "נציג: " + (c.agent_name || "—"),
        at: c.updated_at || c.created_at,
        sort: ts
      });
    });

    closedLeads.forEach(l => {
      items.push({
        id: "lead_" + l.id,
        type: "lead",
        title: "ליד נסגר: " + l.customerName,
        body: l.closedNote || l.campaignLabel,
        at: l.closedAt || l.updatedAt,
        sort: parseTs(l.closedAt || l.updatedAt)
      });
    });

    return items.sort((a, b) => b.sort - a.sort);
  }

  async function refreshInbox() {
    const customers = APP().getCustomers();
    const reminders = APP().getReminders();
    let closedLeads = [];
    try {
      closedLeads = await loadClosedLeads();
      APP().setClosedLeads(closedLeads);
    } catch (_e) {}
    inbox = buildInbox(customers, reminders, closedLeads);
    APP().updateBadge(inbox.filter(i => !seenIds.has(i.id)).length);
    notifyNewItems(inbox.filter(i => !seenIds.has(i.id)));
    if (APP().getCurrentView() === "notifications") renderNotifications();
    if (APP().getCurrentView() === "leads") APP().renderClosedLeads();
  }

  async function requestPushPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const res = await Notification.requestPermission();
    return res === "granted";
  }

  function notifyNewItems(newItems) {
    if (!newItems.length) return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible" && APP().getCurrentView() === "notifications") return;

    newItems.slice(0, 3).forEach(item => {
      try {
        new Notification("INVESTO", {
          body: item.title + (item.body ? "\n" + item.body : ""),
          icon: "./icons/icon-192.png",
          tag: item.id
        });
      } catch (_e) {}
      seenIds.add(item.id);
    });
    persistSeen();
  }

  function renderNotifications() {
    const list = $("#ivNotifList");
    if (!inbox.length) {
      list.innerHTML = `<div class="ivEmpty">אין התראות כרגע</div>`;
      return;
    }
    list.innerHTML = inbox.map(item => {
      const icon = item.type === "reminder" ? "⏰" : item.type === "lead" ? "✅" : "💰";
      return `<article class="ivListItem ivListItem--notif" data-notif-id="${APP().escapeHtml(item.id)}">
        <div class="ivListItem__title">${icon} ${APP().escapeHtml(item.title)}</div>
        <div class="ivListItem__sub">${APP().escapeHtml(item.body || "")}</div>
        <div class="ivListItem__meta"><span>${APP().formatTime(item.at)}</span></div>
      </article>`;
    }).join("");

    list.querySelectorAll("[data-notif-id]").forEach(el => {
      el.addEventListener("click", () => {
        seenIds.add(el.dataset.notifId);
        persistSeen();
        APP().updateBadge(inbox.filter(i => !seenIds.has(i.id)).length);
        el.classList.add("ivListItem--read");
      });
    });

    inbox.forEach(i => seenIds.add(i.id));
    persistSeen();
    APP().updateBadge(0);
  }

  function startPolling() {
    stopPolling();
    refreshInbox();
    pollTimer = setInterval(refreshInbox, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function bindEvents() {
    $("#ivEnablePushBtn").addEventListener("click", async () => {
      const ok = await requestPushPermission();
      APP().toast(ok ? "התראות Push הופעלו" : "לא ניתן להפעיל התראות — בדוק הגדרות Safari");
      $("#ivPushHint").hidden = ok;
    });
  }

  window.InvestoNotify = {
    init() {
      loadSeen();
      bindEvents();
    },
    start: startPolling,
    stop: stopPolling,
    refresh: refreshInbox,
    renderNotifications,
    canAccessLeads
  };
})();
