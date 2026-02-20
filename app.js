
/* ===== Auto Compact UI for PWA / Standalone ===== */
(function(){
  try{
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if(isStandalone){
      document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('compact-ui');
      });
    }
  }catch(_){}
})();


/* GEMEL INVEST • Demo CRM (No backend) */
(() => {
  'use strict';

  // ---------- External Policy Spec (discounts reference) ----------
  // This is the external GitHub Pages site you provided. The CRM opens it in a modal iframe.
  // You can change it later if you move the site.
  const POLICY_SPEC_URL = 'https://leadupleadup.github.io/LeadUp/';

  // ---------- Policy helpers (shared across steps) ----------
  // "מחלות קשות" / "מחלות סרטן" require סכום פיצוי
  const isCompProduct = (prod) => (prod === 'מחלות קשות' || prod === 'מחלות סרטן');

  // "ריסק" requires סכום ביטוח (and we also treat "משכנתא" as sum-insured product in new policies)
  const isSumProduct = (prod) => (prod === 'ריסק');
  const isLienProduct = (prod) => (prod === 'ריסק' || prod === 'משכנתא');


  
  // ---------- Forgot Password modal (safe global handlers for inline onclick) ----------
  function closeForgotModal(){
    const m = document.getElementById('forgotModal');
    if(m) m.style.display = 'none';
  }
  function openForgotModal(){
    const m = document.getElementById('forgotModal');
    if(m) m.style.display = 'flex';
  }
  // Expose to inline HTML handlers (index.html contains onclick="closeForgotModal()")
  window.closeForgotModal = closeForgotModal;
  window.openForgotModal = openForgotModal;

// ---------- CONFIG (Google Sheets via Apps Script Web App) ----------
  // 1) Publish your Apps Script as Web App (Anyone with the link).
  // 2) Paste the /exec URL here. Example:
  // const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/XXXX/exec';
  const GOOGLE_SCRIPT_URL = ''; // <-- set me (leave empty to stay in demo mode)

  // If true, the app will try to auto-connect on load (ping).
  const AUTO_CONNECT = true;

  // ---------- Server helpers ----------
  async function apiCall(action, payload){
    if(!GOOGLE_SCRIPT_URL) return { ok:false, demo:true, error:'NO_URL' };
    const url = GOOGLE_SCRIPT_URL + '?action=' + encodeURIComponent(action);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ payload })
    });
    const data = await res.json().catch(() => null);
    if(!data) return { ok:false, error:'BAD_JSON' };
    return data;
  }

  async function apiPing(){
    if(!GOOGLE_SCRIPT_URL) return { ok:false, demo:true };
    try{
      const url = GOOGLE_SCRIPT_URL + '?action=ping';
      const res = await fetch(url, { method:'GET' });
      const data = await res.json().catch(() => null);
      return data || { ok:false };
    }catch(e){
      return { ok:false, error:String(e) };
    }
  }


  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- Demo data ----------
  const state = {
    currentUser: null,
    connected: false,
    server: { url: '' },
    agentName: 'אוריה (דמו)',
    teamAgents: ['אוריה (דמו)','סתיו','דוד'],
    customers: [
      { id:'c1', assignedAgent:'אוריה (דמו)', fullName:'דניאל כהן', tz:'123456789', phone:'050-1234567', email:'daniel@mail.com', status:'פעיל', segment:'פרימיום' },
      { id:'c2', assignedAgent:'סתיו', fullName:'נועה לוי', tz:'987654321', phone:'052-7654321', email:'noa@mail.com', status:'חדש', segment:'ליד' },
      { id:'c3', assignedAgent:'דוד', fullName:'יוסי מזרחי', tz:'314159265', phone:'054-5551234', email:'yossi@mail.com', status:'פעיל', segment:'סטנדרט' },
    ],
    proposals: [],
    processes: []
  };

  // ---------- Processes (Tasks) ----------
  const PROCESS_TYPES = ['הצעה חדשה','שיקוף','גביה'];
  const PROCESSES_LS_KEY = 'gemel_processes_v1';
  const PROPOSALS_LS_KEY = 'gemel_proposals_v1';
  const CUSTOMERS_LS_KEY = 'gemel_customers_v1';

  function loadProcesses_(){
    try{
      const raw = localStorage.getItem(PROCESSES_LS_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if(Array.isArray(arr)) state.processes = arr;
    }catch(_){}
  }
  function saveProcesses_(){
    try{
      localStorage.setItem(PROCESSES_LS_KEY, JSON.stringify(state.processes || []));
    }catch(_){}
  }

  function loadProposals_(){
    try{
      const raw = localStorage.getItem(PROPOSALS_LS_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if(Array.isArray(arr)) state.proposals = arr;
    }catch(_){}
  }
  function saveProposals_(){
    try{
      localStorage.setItem(PROPOSALS_LS_KEY, JSON.stringify(state.proposals || []));
    }catch(_){}
  }


  function loadCustomers_(){
    try{
      const raw = localStorage.getItem(CUSTOMERS_LS_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if(Array.isArray(arr) && arr.length){
        state.customers = arr;
      }
    }catch(_){}
  }
  function saveCustomers_(){
    try{
      localStorage.setItem(CUSTOMERS_LS_KEY, JSON.stringify(state.customers || []));
    }catch(_){}
  }

  function latestProposalForCustomer_(customerId){
    const list = (state.proposals||[]).filter(p => p && p.customerId === customerId);
    if(!list.length) return null;
    list.sort((a,b)=>{
      const ta = new Date(a.savedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.savedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
    return list[0] || null;
  }
  function uid_(){
    return 'pr_' + Math.random().toString(36).slice(2,10) + '_' + Date.now().toString(36);
  }
  function toLocalDateTimeValue_(iso){
    if(!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2,'0');
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fromLocalDateTimeValue_(val){
    // val like "2026-02-09T14:30"
    if(!val) return '';
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  function dueStatus_(iso){
    if(!iso) return { cls:'', text:'—' };
    const now = Date.now();
    const t = new Date(iso).getTime();
    if(isNaN(t)) return { cls:'', text:'—' };
    const diffMin = Math.floor((t - now) / 60000);
    if(diffMin < 0) return { cls:'bad', text:'חורג' };
    if(diffMin <= 60) return { cls:'warn', text:'מגיע בקרוב' };
    return { cls:'', text:'מתוזמן' };
  }
  function fmtDue_(iso){
    if(!iso) return '—';
    const d = new Date(iso);
    if(isNaN(d.getTime())) return '—';
    return d.toLocaleString('he-IL');
  }

  function openProcessModal_(customerId){
    const c = state.customers.find(x => x.id === customerId);
    if(!c) return;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,.35)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = `
      <div style="width:min(720px,92vw);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:18px 18px 14px;direction:rtl;font-family:inherit">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
          <div>
            <div style="font-weight:900;font-size:16px">צור תהליך</div>
            <div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(c.fullName||'')} • ${escapeHtml(c.phone||'')}</div>
          </div>
          <button class="btn btnSoft" data-x>סגור</button>
        </div>

        <div style="display:grid;grid-template-columns: 1fr 1fr;gap:10px">
          <div>
            <div style="font-size:12px;color:rgba(18,19,25,.65);margin-bottom:6px">בחירת תהליך</div>
            <select id="procType" class="input" style="width:100%">
              ${PROCESS_TYPES.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:12px;color:rgba(18,19,25,.65);margin-bottom:6px">תאריך ושעה</div>
            <input id="procDue" class="input" style="width:100%" type="datetime-local" value="${toLocalDateTimeValue_(new Date(Date.now()+30*60000).toISOString())}">
          </div>

          <div id="procAssignWrap" style="grid-column:1 / -1;display:none">
            <div style="font-size:12px;color:rgba(18,19,25,.65);margin-bottom:6px">הפניית שיקוף אל</div>
            <select id="procAssign" class="input" style="width:100%"></select>
            <div style="font-size:12px;color:rgba(18,19,25,.55);margin-top:6px">בחר/י נציג לביצוע השיקוף. התהליך יופיע אצלו ב״התהליכים שלי״.</div>
          </div>

          <div style="grid-column:1 / -1">
            <div style="font-size:12px;color:rgba(18,19,25,.65);margin-bottom:6px">הערה (אופציונלי)</div>
            <input id="procNote" class="input" style="width:100%" type="text" placeholder="לדוגמה: לשלוח הצעה מעודכנת / לבדוק מסמכים">
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
          <button class="btn btnSoft" data-cancel>ביטול</button>
          <button class="btn" data-save>שמור תהליך</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
    overlay.querySelector('[data-x]')?.addEventListener('click', close);
    overlay.querySelector('[data-cancel]')?.addEventListener('click', close);

    // If process type is "שיקוף" allow assigning to another user/agent
    const procTypeEl = overlay.querySelector('#procType');
    const assignWrap = overlay.querySelector('#procAssignWrap');
    const assignSel = overlay.querySelector('#procAssign');

    // Build list from users in system (active only)
    const usersList = (typeof loadUsers_ === 'function' ? loadUsers_() : (typeof getUsers_ === 'function' ? getUsers_() : []))
      .filter(u => u && u.active !== false)
      .map(u => ({ username: String(u.username||'').trim(), name: String(u.displayName||u.username||'').trim() }))
      .filter(u => u.name);

    if(assignSel){
      assignSel.innerHTML = [
        '<option value="">בחר נציג…</option>',
        ...usersList.map(u => `<option value="${escapeAttr(u.name)}">${escapeHtml(u.name)}${u.username?` (${escapeHtml(u.username)})`:''}</option>`)
      ].join('');
    }

    const syncAssignUI = () => {
      const t = String(procTypeEl?.value || '').trim();
      if(assignWrap){
        assignWrap.style.display = (t === 'שיקוף') ? 'block' : 'none';
      }
    };
    if(procTypeEl) procTypeEl.addEventListener('change', syncAssignUI);
    syncAssignUI();

    overlay.querySelector('[data-save]')?.addEventListener('click', () => {
      const type = String(overlay.querySelector('#procType')?.value || '').trim();
      const dueVal = String(overlay.querySelector('#procDue')?.value || '').trim();
      const note = String(overlay.querySelector('#procNote')?.value || '').trim();
      const dueAt = fromLocalDateTimeValue_(dueVal);

      if(!type){
        toast('חסר', 'בחר סוג תהליך');
        return;
      }
      if(!dueAt){
        toast('חסר', 'בחר תאריך ושעה');
        return;
      }

      const assignedTo = (type === 'שיקוף')
        ? String(overlay.querySelector('#procAssign')?.value || '').trim()
        : String(state.agentName || '').trim();

      if(type === 'שיקוף' && !assignedTo){
        toast('חסר', 'בחר נציג להפניית שיקוף');
        return;
      }

      const proc = {
        id: uid_(),
        customerId: c.id,
        customerName: c.fullName || '',
        type,
        note,
        dueAt,
        assignedTo: assignedTo || (state.agentName || ''),
        originAgent: String(state.agentName || '').trim(),   // מי יצר את התהליך (למי מחזירים תוצאה)
        createdBy: String(state.agentName || '').trim(),
        status: 'open',
        createdAt: new Date().toISOString()
      };

      state.processes.unshift(proc);
      saveProcesses_();
      close();
      toast('נשמר', type === 'שיקוף' ? ('תהליך שיקוף הופנה ל־' + (assignedTo||'')) : 'תהליך נוסף ל"התהליכים שלי"');
      render();
    });
  }

  function renderReturnedResultsForAgent_(agent){
    const list = (state.processes||[])
      .filter(p => p && !p.archived && (p.type||'') === 'שיקוף' && (p.status||'') === 'done' && (p.originAgent||'') === agent)
      .slice()
      .sort((a,b) => new Date(b.closedAt||0).getTime() - new Date(a.closedAt||0).getTime())
      .slice(0, 8);

    if(!list.length) return '';

    const outcomeLabel = (o) => {
      const v = String(o||'');
      if(v === 'done_wait_sign') return 'בוצע שיקוף • ממתין לחתימות';
      if(v === 'stopped') return 'נעצר תהליך שיקוף';
      if(v === 'no_answer') return 'ללא מענה';
      return v || '—';
    };

    return `
      <div class="panel" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
          <div style="font-weight:900">תוצאות שיקוף שחזרו אליך</div>
          <div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(agent||'')}</div>
        </div>
        <div class="tableWrap" style="box-shadow:none;padding:0;background:transparent;border:none">
          <table class="table">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>תוצאה</th>
                <th>נציג מטפל</th>
                <th>פירוט</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(p => `
                <tr>
                  <td><b>${escapeHtml(p.customerName||'')}</b></td>
                  <td>${chip(outcomeLabel(p.outcome), (p.outcome==='stopped')?'warn':(p.outcome==='no_answer')?'bad':'')}</td>
                  <td>${escapeHtml(p.handledBy || p.assignedTo || '')}</td>
                  <td style="max-width:380px">
                    ${p.outcomeNote ? `<div style="white-space:pre-wrap">${escapeHtml(p.outcomeNote)}</div>` : `<span style="color:rgba(18,19,25,.55);font-size:12px">—</span>`}
                  </td>
                  <td style="text-align:left;white-space:nowrap">
                    <button class="btn btnSoft" data-proc-open="${escapeAttr(p.customerId)}">פתח</button>
                  </td>
                  <td style="text-align:left;white-space:nowrap">
                    <button class="btn btnTiny btnSoft" data-proc-archive="${escapeAttr(p.id)}">סגור</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }


  function renderDueProcessesForAgent_(agent){
    const now = Date.now();
    const list = (state.processes||[])
      .filter(p => !p.archived && (p.status||'open') === 'open' && (p.assignedTo||'') === agent && p.dueAt)
      .slice()
      .sort((a,b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    const dueNow = list.filter(p => new Date(p.dueAt).getTime() <= now);
    const upcoming = list.filter(p => new Date(p.dueAt).getTime() > now).slice(0,6);
    const top = dueNow.length ? dueNow : upcoming;

    if(!top.length){
      return `<div class="sideHint">אין תהליכים מתוזמנים כרגע.</div>`;
    }

    return `
      <div class="panel" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
          <div style="font-weight:900">תהליכים שמגיעים עכשיו</div>
          <div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(agent||'')}</div>
        </div>
        <div class="tableWrap" style="box-shadow:none;padding:0;background:transparent;border:none">
          <table class="table">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>תהליך</th>
                <th>מועד</th>
                <th>סטטוס</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${top.map(p => {
                const st = dueStatus_(p.dueAt);
                return `
                  <tr>
                    <td><b>${escapeHtml(p.customerName||'')}</b><div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml((state.customers.find(c=>c.id===p.customerId)||{}).phone||'')}</div></td>
                    <td>${escapeHtml(p.type||'')}</td>
                    <td>${escapeHtml(fmtDue_(p.dueAt))}${p.note?`<div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(p.note)}</div>`:''}</td>
                    <td>${chip(st.text, st.cls||'')}</td>
                    <td style="text-align:left;white-space:nowrap">
                      <button class="btn btnSoft" data-proc-open="${escapeAttr(p.customerId)}">פתח</button>
                      <button class="btn btnTiny" data-proc-done="${escapeAttr(p.id)}">בוצע</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function openCloseShikufModal_(procId){
    const p = (state.processes||[]).find(x => x && x.id === procId);
    if(!p) return;

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,.35)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    overlay.innerHTML = `
      <div style="width:min(560px,92vw);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:16px 16px 12px;direction:rtl;font-family:inherit">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
          <div>
            <div style="font-weight:900;font-size:16px">סגירת תהליך שיקוף</div>
            <div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(p.customerName||'')}</div>
          </div>
          <button class="btn btnSoft" data-x>סגור</button>
        </div>

        <div style="display:grid;gap:10px">
          <label style="display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid rgba(18,19,25,.12);border-radius:12px;cursor:pointer">
            <input type="radio" name="shOutcome" value="done_wait_sign">
            <div>
              <div style="font-weight:800">בוצע שיקוף</div>
              <div style="font-size:12px;color:rgba(18,19,25,.55)">ממתין לחתימות לקוח + סוכן</div>
            </div>
          </label>

          <label style="display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid rgba(18,19,25,.12);border-radius:12px;cursor:pointer">
            <input type="radio" name="shOutcome" value="stopped">
            <div>
              <div style="font-weight:800">נעצר תהליך שיקוף</div>
              <div style="font-size:12px;color:rgba(18,19,25,.55)">חובה למלא איפה/למה נעצר</div>
            </div>
          </label>

          <label style="display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid rgba(18,19,25,.12);border-radius:12px;cursor:pointer">
            <input type="radio" name="shOutcome" value="no_answer">
            <div>
              <div style="font-weight:800">ללא מענה</div>
              <div style="font-size:12px;color:rgba(18,19,25,.55)">לא היה מענה לאחר ניסיונות</div>
            </div>
          </label>

          <div>
            <div style="font-size:12px;color:rgba(18,19,25,.65);margin-bottom:6px">פירוט / הערה</div>
            <textarea id="shNote" class="input" style="width:100%;min-height:92px;resize:vertical" placeholder="אם נעצר — כתוב/י איפה נעצר השיקוף. (בשאר האפשרויות זה אופציונלי)"></textarea>
            <div id="shErr" style="display:none;margin-top:6px;color:#b42318;font-size:12px;font-weight:700">חובה למלא איפה נעצר השיקוף</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
          <button class="btn btnSoft" data-cancel>ביטול</button>
          <button class="btn" data-closeproc>סגור תהליך</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
    overlay.querySelector('[data-x]')?.addEventListener('click', close);
    overlay.querySelector('[data-cancel]')?.addEventListener('click', close);

    overlay.querySelector('[data-closeproc]')?.addEventListener('click', () => {
      const picked = overlay.querySelector('input[name="shOutcome"]:checked');
      const outcome = picked ? String(picked.value||'') : '';
      const note = String(overlay.querySelector('#shNote')?.value || '').trim();
      const err = overlay.querySelector('#shErr');

      if(!outcome){
        toast('חסר', 'בחר תוצאה לסגירת התהליך');
        return;
      }
      if(outcome === 'stopped' && !note){
        if(err) err.style.display = 'block';
        toast('חסר', 'חובה למלא איפה נעצר השיקוף');
        return;
      }
      if(err) err.style.display = 'none';

      // סגירה אצל הנציג המטפל + החזרת תוצאה לנציג היוזם
      p.status = 'done';
      p.doneAt = new Date().toISOString();
      p.closedAt = p.doneAt; // backward compat
      p.outcome = outcome;
      p.outcomeNote = note;
      p.handledBy = String(state.agentName || '').trim();

      saveProcesses_();
      close();

      toast('נסגר', 'התהליך נסגר והתוצאה נשלחה לנציג היוזם');
      render();
    });
  }

  function wireProcessButtons_(){
    $$('[data-proc-open]').forEach(b => b.addEventListener('click', () => openWizard({ customerId: b.dataset.procOpen })));

    $$('[data-proc-done]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.procDone;
      const p = (state.processes||[]).find(x => x.id === id);
      if(!p) return;

      // תהליך שיקוף: נפתח חלון סגירה עם תוצאות + פירוט, ומחזירים לנציג היוזם דרך originAgent
      if(String(p.type||'').trim() === 'שיקוף'){
        // ensure originAgent exists even for old records
        if(!p.originAgent) p.originAgent = String(p.createdBy || p.assignedTo || '').trim();
        openCloseShikufModal_(id);
        return;
      }

      // תהליכים אחרים: סגירה רגילה
      p.status = 'done';
      p.doneAt = new Date().toISOString();
      saveProcesses_();
      toast('עודכן', 'סומן כבוצע');
      render();
    }));

    $$('[data-proc-archive]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.procArchive;
      const p = (state.processes||[]).find(x => x && x.id === id);
      if(!p) return;
      p.archived = true;
      p.archivedAt = new Date().toISOString();
      saveProcesses_();
      toast('נסגר', 'הוסר מרשימת התוצאות');
      render();
    }));

  }

  // ---------- AUTH (Local users management; ready to move to Google Sheets later) ----------
  const USERS_LS_KEY = 'gemel_users_v1';

  const SEED_USERS = [
    { username:'admin',  password:'1234', role:'admin', displayName:'מנהל מערכת', active:true, createdAt:new Date().toISOString() },
    { username:'agent1', password:'1234', role:'agent', displayName:'אוריה (דמו)', active:true, createdAt:new Date().toISOString() },
    { username:'agent2', password:'1234', role:'agent', displayName:'סתיו', active:true, createdAt:new Date().toISOString() },
    { username:'agent3', password:'1234', role:'agent', displayName:'דוד', active:true, createdAt:new Date().toISOString() },
  ];

  function loadUsers_(){
    try{
      const raw = localStorage.getItem(USERS_LS_KEY);
      const arr = raw ? JSON.parse(raw) : null;
      if(Array.isArray(arr) && arr.length){
        // normalize + enforce default passwords (per current build)
        const normalized = arr.map(u => ({
          username: String(u.username||'').trim(),
          password: String(u.password||''),
          role: String(u.role||'agent'),
          displayName: String(u.displayName||u.username||'').trim(),
          active: (u.active !== false),
          createdAt: u.createdAt || '',
          updatedAt: u.updatedAt || ''
        })).filter(u => u.username);

        // Ensure our default accounts stay accessible with password 1234
        const defaults = new Set(['admin','agent1','agent2','agent3']);
        let changed = false;
        normalized.forEach(u => {
          if(defaults.has(u.username) && u.password !== '1234'){
            u.password = '1234';
            changed = true;
          }
        });
        if(changed) saveUsers_(normalized);

        return normalized;
      }
    }catch(_){}
    // seed
    saveUsers_(SEED_USERS);
    return SEED_USERS.slice();
  }

  function saveUsers_(users){
    try{
      localStorage.setItem(USERS_LS_KEY, JSON.stringify(users || []));
    }catch(_){}
  }

  function getUsers_(){
    return loadUsers_();
  }

  function countAdmins_(users){
    return (users||[]).filter(u => u.role === 'admin' && u.active !== false).length;
  }

  function upsertUser_(payload){
    const users = loadUsers_();
    const nowIso = new Date().toISOString();
    const username = String(payload.username||'').trim();
    const displayName = String(payload.displayName||'').trim();
    const role = String(payload.role||'agent');
    const active = payload.active !== false;

    if(!username) return { ok:false, msg:'חסר שם משתמש' };
    if(!displayName) return { ok:false, msg:'חסר שם תצוגה' };
    if(!['admin','agent','rep'].includes(role)) return { ok:false, msg:'תפקיד לא תקין' };

    const isEdit = !!payload._isEdit;
    const prevUsername = String(payload._prevUsername||'').trim();

    // uniqueness
    const exists = users.find(u => u.username === username && (!isEdit || u.username !== prevUsername));
    if(exists) return { ok:false, msg:'שם משתמש כבר קיים' };

    // prevent demoting/disable last admin
    if(isEdit){
      const cur = users.find(u => u.username === prevUsername);
      if(cur && cur.role === 'admin'){
        const nextAdmins = countAdmins_(users.map(u => {
          if(u.username !== prevUsername) return u;
          return { ...u, role, active };
        }));
        if(nextAdmins < 1) return { ok:false, msg:'חייב להישאר לפחות מנהל אחד פעיל במערכת' };
      }
    }

    if(!isEdit){
      const password = String(payload.password||'').trim();
      if(!password) return { ok:false, msg:'חסר סיסמה' };
      users.unshift({ username, password, role, displayName, active, createdAt: nowIso, updatedAt: nowIso });
      saveUsers_(users);
      return { ok:true };
    }else{
      const idx = users.findIndex(u => u.username === prevUsername);
      if(idx < 0) return { ok:false, msg:'משתמש לא נמצא' };

      const cur = users[idx];
      const password = String(payload.password||'').trim();
      users[idx] = {
        ...cur,
        username,
        displayName,
        role,
        active,
        password: password ? password : cur.password,
        updatedAt: nowIso
      };
      saveUsers_(users);

      // if edited current user, refresh session identity
      if(state.currentUser && state.currentUser.username === prevUsername){
        const safe = { username, role, displayName };
        state.currentUser = safe;
        state.agentName = displayName;
      }

      return { ok:true };
    }
  }

  function setUserActive_(username, active){
    const users = loadUsers_();
    const idx = users.findIndex(u => u.username === username);
    if(idx < 0) return { ok:false, msg:'משתמש לא נמצא' };

    // prevent disabling last admin
    const cur = users[idx];
    if(cur.role === 'admin' && active === false){
      const admins = countAdmins_(users);
      if(admins < 2) return { ok:false, msg:'אי אפשר להשבית את המנהל האחרון' };
    }

    users[idx] = { ...cur, active: !!active, updatedAt: new Date().toISOString() };
    saveUsers_(users);
    return { ok:true };
  }

  function deleteUser_(username){
    const users = loadUsers_();
    const idx = users.findIndex(u => u.username === username);
    if(idx < 0) return { ok:false, msg:'משתמש לא נמצא' };

    if(state.currentUser && state.currentUser.username === username){
      return { ok:false, msg:'אי אפשר למחוק את המשתמש המחובר כרגע' };
    }

    const cur = users[idx];
    if(cur.role === 'admin' && cur.active !== false){
      const admins = countAdmins_(users);
      if(admins < 2) return { ok:false, msg:'אי אפשר למחוק את המנהל האחרון' };
    }

    users.splice(idx, 1);
    saveUsers_(users);
    return { ok:true };
  }


  function resetUserPassword_(username, newPassword){
    const users = loadUsers_();
    const idx = users.findIndex(u => u.username === username);
    if(idx < 0) return { ok:false, msg:'משתמש לא נמצא' };
    const pw = String(newPassword||'').trim();
    if(!pw) return { ok:false, msg:'חסרה סיסמה חדשה' };

    users[idx] = { ...users[idx], password: pw, updatedAt: new Date().toISOString() };
    saveUsers_(users);
    return { ok:true };
  }

  function isAdmin_(){ return !!(state.currentUser && state.currentUser.role === 'admin'); }


  function applyPermissions_(){
    // update badge name
    const badgeNameEl = document.getElementById('agentName');
    if(badgeNameEl){
      badgeNameEl.textContent = 'נציג: ' + (state.agentName || 'אורח');
    }

    // admin-only items
    const settingsBtn = document.querySelector('.navItem[data-route="settings"]');
    if(settingsBtn) settingsBtn.style.display = isAdmin_() ? '' : 'none';
  }
  function visibleCustomers_(){
    if(isAdmin_()) return state.customers;
    const me = state.agentName;
    return state.customers.filter(c => (c.assignedAgent || '') === me);
  }
  function visibleProposals_(){
    if(isAdmin_()) return state.proposals;
    const me = state.agentName;
    return state.proposals.filter(p => (p.assignedAgent || p.agentName || '') === me);
  }



  // Questionnaire mapping (DEFAULT: Medical form for each insured)
    const questionnaires = {
    'DEFAULT|MEDICAL': {
      title: 'שאלון רפואי מלא (לכל מבוטח)',
      steps: [
        { id:'full', title:'שאלון רפואי מלא', questions:[
          qYesNo('smoking', 'האם המבוטח מעשן?', {details:true, detailsLabel:'פירוט (כמה/כמה זמן)'}),

          qYesNo('sys_neuro', 'מערכת העצבים והמוח — טרשת נפוצה, תסמונת דאון, אוטיזם, גושה, ניווון שרירים, אפילפסיה, פרקינסון, שיתוק, קשב וריכוז, בעיות התפתחות (תינוק אם נולד פג)', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('sys_cardio', 'מערכת הלב וכלי דם — לב, כלי דם, אירוע מוחי, יתר לחץ דם, מחלות דם ובעיות קרישה', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('mental', 'בעיה / הפרעה ו/או מחלה נפשית מאובחנת וניסיונות התאבדות', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('metabolic', 'מערכת מטבולית — סוכרת כולל הריון, שומנים, כולסטרול, בלוטת מגן/מוח/יתר-תרת הכליה', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('cancer', 'מחלה ממאירה — גידולים לרבות גידול שפיר, סרטני וטרום סרטני', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('digestive', 'מערכת העיכול — קיבה, מעיים, קרוהן, קוליטיס, כיס המרה, טחול, לבלב, פי הטבעת, כבד, צהבת', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('resp', 'מערכת ריאות ודרכי נשימה — לרבות אסטמה, ברונכיטיס, COPD, זום נשימה, סיסטיק פיברוזיס, שחפת, אלרגיות', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('rheuma', 'מחלות ראומטולוגיות — רקומות חיבור ודלקות פרקים, גאוט, לופוס/זאבת, פיברומיאלגיה, קדחת ים תיכונית', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('ortho', 'אורטופדיה ומערכת השלד — עמוד שדרה, שרירים, מפרקים, מחלות פרקים, בעיות ברכיים, שבר, פריקה, פגיעה', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('bones', 'גידים / אוסטאופורוזיס — אוסטאופורוזיס/אוסטיאופניה, מחלת פרקים ניוונית', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('eyes', 'מערכת עיניים וראייה — ליקויי ראייה מעל מספר 8 בעדשות, הפרדת רשתית, גלאוקומה, קטרקט, אובאיטיס, קרטוקונוס', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('ent', 'מערכת אף אוזן גרון — פגיעה בשמיעה, דלקות אוזניים, מנייר, טיניטון, פוליפים, שקדים, פגיעה במיתרי הקול', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('skin_sex', 'עור ומין — מחלות עור ואלרגיה, פסוריאזיס, מפמפיגוס, צלקות, נגע ו/או גידול בעור, פפילומה, קונדילומה', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('std_hiv', 'מחלות מין ואיידס — נשא HIV ומחלות זיהומיות שאובחנו בשנה האחרונה ודורשות טיפול רציף של חודשים לפחות', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('women', 'לנשים — בעיות גינקולוגיות ושדיים, הגדלה/הקטנה, גוש בשד, דימומים, רחם שרירני, ציסטות שחלתיות, האם כעת בהריון', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('men', 'לגברים — בעיות ערמונית, פרוסטטה ואשכים', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('substances', 'אלכוהול / סמים / היסטוריה משפחתית — אלכוהול, סמים, היסטוריה משפחתית (ממא/אבא אחים אחיות - מחלות תורשתיות), אחוזי נכות, תהליך בירור רפואי או בדיקות אבחנתיות שטרם הסתיימו סופית', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),
          qYesNo('hosp_meds', 'אשפוזים / ניתוחים / טיפול תרופתי קבוע — אשפוזים או ניתוחים ב-5 שנים האחרונות, טיפול תרופתי באופן קבוע', {details:true, detailsLabel:'פירוט (אבחנה/מועד/טיפול)'}),

          qYesNo('truth', 'אני מאשר/ת שכל הפרטים שמולאו נכונים ומלאים.'),
          qText('notes', 'הערות כלליות')
        ]}
      ]
    }
  };


  function qYesNo(id, label, opt={}){
    return { type:'yesno', id, label, details: !!opt.details, detailsLabel: opt.detailsLabel || 'פירוט' };
  }
  function qText(id, label){
    return { type:'text', id, label };
  }

  // ---------- UI references ----------
  const agentNameEl = $('#agentName');
  const kpisEl = $('#kpis');
  const tabsEl = $('#tabs');
  const viewEl = $('#view');
  const pageTitleEl = $('#pageTitle');
  const crumbEl = $('#crumb');
  const globalSearch = $('#globalSearch');
  const searchBtn = $('#searchBtn');
  const newProposalBtn = $('#newProposalBtn');
  const gofiBtn = $('#gofiBtn');

  // GOFI (module)
  const gofiOverlay = $('#gofiOverlay');
  const gofiCloseBtn = $('#gofiCloseBtn');
  const gofiFrame = $('#gofiFrame');
  const gofiFallback = $('#gofiFallback');
  const discountSpecBtn = $('#discountSpecBtn');
  const discountSpecOverlay = $('#discountSpecOverlay');
  const discountSpecCloseBtn = $('#discountSpecCloseBtn');
  const discountSpecFrame = $('#discountSpecFrame');

  // Talk Mirror (embedded external module)
  const TALK_MIRROR_URL = 'https://oriasomech-jpg.github.io/TalkMe/';


  
  // ---------- TalkMe Bridge (postMessage) ----------
  // TalkMe runs in an embedded iframe (repo2). It can ask the CRM for the full customers list.
  // IMPORTANT: This is intentionally "all customers" even for reps (per current requirement).
  const TALKME_ALLOWED_ORIGINS = new Set([
    'https://oriasomech-jpg.github.io',
    'https://gemel.invest.github.io'
  ]);

  window.addEventListener('message', (event) => {
    try{
      const data = event && event.data;
      if(!data || typeof data !== 'object') return;

      // Security: allow only our TalkMe origins
      if(!TALKME_ALLOWED_ORIGINS.has(event.origin)) return;

      if(data.type === 'TALKME_REQUEST_CUSTOMERS'){
        const payload = {
          type: 'TALKME_CUSTOMERS',
          customers: Array.isArray(state.customers) ? state.customers.slice() : []
        };
        if(event.source && typeof event.source.postMessage === 'function'){
          event.source.postMessage(payload, event.origin);
        }
        return;
      }
    }catch(_){}
  });
// Set your GOFI module URL (GitHub Pages) here when ready
  // Example: const GOFI_URL = 'https://oriasomech-jpg.github.io/TalkMe/';

  const GOFI_URL = 'https://oriasomech-jpg.github.io/TalkMe/';



  // Wizard
  const wizardOverlay = $('#wizardOverlay');
  const wizardCloseBtn = $('#wizardCloseBtn');
  const statusSelect = $('#statusSelect');

  const wizardMain = $('#wizardMain');
  const stepperEl = $('#stepper');
  const insuredTabsEl = $('#insuredTabs');
  const insuredIndicatorEl = $('#insuredIndicator');
  const nextStepBtn = $('#nextStepBtn');
  const prevStepBtn = $('#prevStepBtn');
  const savePill = $('#savePill');
  const sumOld = $('#sumOld');
  const sumNew = $('#sumNew');
  const sumTotal = $('#sumTotal');
  const compHost = $('#compHost');
  // ---------- Company logos (small icons) ----------
  const COMPANY_LOGOS = {
    'הראל': 'assets/companies/harel.png',
    'כלל': 'assets/companies/clal.png',
    'מנורה': 'assets/companies/menora.png',
    'הפניקס': 'assets/companies/afenix.png',
    'מגדל': 'assets/companies/megdl.png',
    'הכשרה': 'assets/companies/achshara.png'
      , 'איילון': 'assets/companies/ayalon.png'
    , 'AIG': 'assets/companies/aig.png'
    , 'ביטוח ישיר': 'assets/companies/beytuyashir.png'
  };

  function companyLogoSrc(name){
    const n = String(name||'').trim();
    return COMPANY_LOGOS[n] || '';
  }
  function renderCompanyCell(name){
    const src = companyLogoSrc(name);
    const txt = escapeHtml(String(name||''));
    if(!src) return txt;
    return `<span class="coCell"><img class="coLogo" src="${escapeAttr(src)}" alt="${escapeAttr(String(name||''))}"/><span class="coName">${txt}</span></span>`;
  }
  function wireCompanySelectLogo(id){
    const sel = document.getElementById(id);
    const img = document.getElementById(id + '_logo');
    if(!sel || !img) return;
    const sync = () => {
      const src = companyLogoSrc(sel.value);
      if(src){
        img.src = src;
        img.style.display = 'block';
      }else{
        img.removeAttribute('src');
        img.style.display = 'none';
      }
    };
    sel.addEventListener('change', sync);
    sync();
  }


  const toastHost = $('#toastHost');

  // ---------- Routing ----------
  let route = 'customers';
  let tab = 'table';

  function setRoute(r){
    // Remove deprecated proposals page
    if(r === 'proposals') r = 'customers';
    // Permission guard
    if(r === 'settings' && !isAdmin_()) r = 'customers';
    route = r;
    $$('.navItem').forEach(b => b.classList.toggle('active', b.dataset.route === r));
    render();
  }

  // Robust nav routing (fix: Settings accidentally opens Talk Mirror)
// Use event delegation so click target (svg/path/span) won't break routing.
const navRoot = document.querySelector('.sidebar .nav');
if(navRoot){
  navRoot.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('.navItem') : null;
    if(!btn) return;

    // Prefer explicit dataset route
    let r = (btn.dataset && btn.dataset.route) ? String(btn.dataset.route) : '';

    // Safety override: if the button label is "הגדרות" force settings
    // (covers cases where HTML data-route was accidentally copied from talkMirror).
    try{
      const label = (btn.textContent || '').replace(/\s+/g,' ').trim();
      if(label.includes('הגדרות')) r = 'settings';
    }catch(_){}

    if(!r) return;
    setRoute(r);
  });
}

// Keep per-button listener for legacy markup, but make it safe.
$$('.navItem').forEach(b => b.addEventListener('click', (e) => {
  const r = (b.dataset && b.dataset.route) ? String(b.dataset.route) : '';
  if(!r) return;
  setRoute(r);
}));

  // ---------- Boot: Login gate (simple, stable) ----------
  const AUTH_SESSION_KEY = 'gemel_session_v1';

  function getSession_(){
    try{
      const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(_){
      return null;
    }
  }
  function setSession_(payload){
    try{ sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(payload || {})); }catch(_){}
  }
  function clearSession_(){
    try{ sessionStorage.removeItem(AUTH_SESSION_KEY); }catch(_){}
  }

  function showLogin_(){
    const appRoot = document.getElementById('appRoot');
    const login = document.getElementById('loginScreen');
    if(appRoot) appRoot.style.display = 'none';
    if(login) login.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function showApp_(){
    const appRoot = document.getElementById('appRoot');
    const login = document.getElementById('loginScreen');
    if(login) login.style.display = 'none';
    if(appRoot) appRoot.style.display = '';
    document.body.style.overflow = '';
  }

  function setIdentity_(u){
    const safe = { username:u.username, role:u.role, displayName:u.displayName };
    state.currentUser = safe;
    state.agentName = safe.displayName;
    applyPermissions_();
  }

  function findUserByUsername_(username){
    const u = String(username||'').trim();
    const users = getUsers_(); // seeds if missing
    return (users||[]).find(x => x.username === u) || null;
  }

  function loginAttempt_(username, password){
    const u = String(username||'').trim();
    const p = String(password||'').trim();

    const found = findUserByUsername_(u);
    if(!found) return { ok:false, msg:'שם משתמש לא קיים' };
    if(found.active === false) return { ok:false, msg:'המשתמש מושבת' };
    if(String(found.password||'') !== p) return { ok:false, msg:'סיסמה שגויה' };

    setSession_({ username: found.username, at: Date.now() });
    setIdentity_(found);
    showApp_();

    // Default route after login
    const r = location.hash ? location.hash.replace('#','').trim() : '';
    setRoute(r || 'customers');
    return { ok:true };
  }

  // Expose logout
  window.gemelLogout = function(){
    clearSession_();
    state.currentUser = null;
    state.agentName = 'אורח';
    showLogin_();
  };

  (function bootAuth_(){
    // Wire logout button if exists
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn){
      logoutBtn.addEventListener('click', () => window.gemelLogout && window.gemelLogout());
    }

    // Wire login form
    const form = document.getElementById('loginForm');
    const userEl = document.getElementById('loginUser');
    const passEl = document.getElementById('loginPass');
    const errEl  = document.getElementById('loginError');

    const showErr = (msg) => {
      if(!errEl) return;
      errEl.textContent = msg || 'שגיאה';
      errEl.style.display = msg ? 'block' : 'none';
    };

    if(form){
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        showErr('');
        const res = loginAttempt_(userEl?.value, passEl?.value);
        if(!res.ok){
          showErr(res.msg);
          if(passEl) passEl.value = '';
          passEl?.focus();
        }
      });
    }

    // Enter key on inputs
    [userEl, passEl].forEach(el => {
      if(!el) return;
      el.addEventListener('keydown', (e) => {
        if(e.key === 'Enter'){
          e.preventDefault();
          form?.requestSubmit?.();
        }
      });
    });

    // Restore session if exists
    const sess = getSession_();
    const found = sess && sess.username ? findUserByUsername_(sess.username) : null;
    if(found && found.active !== false){
      setIdentity_(found);
      showApp_();
      const r = location.hash ? location.hash.replace('#','').trim() : '';
      setRoute(r || 'customers');
    }else{
      showLogin_();
    }
  })();
  // ---------- Render ----------
  function render(){
    agentNameEl.textContent = 'נציג: ' + state.agentName;

    // Mail badge
    try{ if(typeof updateMailBadge_ === 'function') updateMailBadge_(); }catch(_){/* noop */}

    // Route-scoped layout helpers
    try{
      document.body.classList.toggle('routeTalkMirror', route === 'talkMirror');
    }catch(_){/* noop */}

    // Tabs bar: default visible, but hide on Customers (no need for רשימה/סגמנטים right now)
    if(tabsEl){
      tabsEl.style.display = '';
    }


    // Topbar controls visibility by route
    const searchWrapEl = globalSearch ? globalSearch.closest('.searchWrap') : null;
    const showSearch = (route === 'customers');
    if(searchWrapEl) searchWrapEl.style.display = showSearch ? '' : 'none';
    if(newProposalBtn) newProposalBtn.style.display = (route === 'customers') ? '' : 'none';
    if(route === 'customers'){
      pageTitleEl.textContent = 'לקוחות';
      crumbEl.textContent = 'Overview';
      renderKpisCustomers();
      tab = 'table';
      if(tabsEl){ tabsEl.innerHTML = ''; tabsEl.style.display = 'none'; }
      renderCustomersTable(visibleCustomers_());
    }
    if(route === 'my'){
      pageTitleEl.textContent = 'התהליכים שלי';
      crumbEl.textContent = 'Assigned';
      renderKpisMy();
      renderTabs(['table'], { table:'משויכים אליי' });
      renderMyProcesses();
    }

    if(route === 'talkMirror'){
      pageTitleEl.textContent = 'שיקוף שיחה';
      crumbEl.textContent = 'Mirror';

      // Full-bleed embedded page inside the system
      if(kpisEl) kpisEl.innerHTML = '';
      if(tabsEl){ tabsEl.innerHTML = ''; tabsEl.style.display = 'none'; }

      const url = String(TALK_MIRROR_URL||'').trim();
      viewEl.innerHTML = `
        <div class="talkMirrorWrap" role="region" aria-label="שיקוף שיחה">
          <iframe
            id="talkMirrorFrame"
            title="שיקוף שיחה"
            src="${escapeAttr(url)}"
            loading="lazy"
            referrerpolicy="no-referrer"
            allow="clipboard-read; clipboard-write; fullscreen"
            scrolling="no"
          ></iframe>
        </div>
      `;
      return;
    }
if(route === 'settings'){
      pageTitleEl.textContent = 'הגדרות';
      crumbEl.textContent = 'System';

      // Admin only
      if(!isAdmin_()){
        setRoute('customers');
        return;
      }

      // Settings tabs: General + Users
      if(tab !== 'general' && tab !== 'users') tab = 'users';
      renderTabs(['general','users'], { general:'כללי', users:'משתמשים' });

      if(tab === 'users'){
        renderKpisUsers();
        renderUsers();
      }else{
        renderKpisSettings();
        renderSettings();
      }
    }
  }

  function renderTabs(keys, labels){
    tabsEl.innerHTML = keys.map(k => (
      `<button class="tab ${k===tab?'active':''}" data-tab="${k}">${labels[k]||k}</button>`
    )).join('');
    $$('.tab', tabsEl).forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      render();
    }));
  }

  function kpiCard(label, value, hint){
    return `<div class="kpi"><div class="kpiLabel">${escapeHtml(label)}</div><div class="kpiValue">${escapeHtml(String(value))}</div><div class="kpiHint">${escapeHtml(hint||'')}</div></div>`;
  }

  function renderKpisCustomers(){
    const total = state.customers.length;
    const active = state.customers.filter(c => c.status === 'פעיל').length;
    const leads = state.customers.filter(c => c.segment === 'ליד').length;
    kpisEl.innerHTML = [
      kpiCard('סה״כ לקוחות', total, 'כל הרשומות במערכת'),
      kpiCard('פעילים', active, 'לקוחות בטיפול/פעילים'),
      kpiCard('לידים', leads, 'שייכים לסגמנט ליד'),
    ].join('');
  }

  function renderKpisProposals(){
    const total = state.proposals.length;
    const open = state.proposals.filter(p => p.status === 'טיוטה' || p.status === 'נפתח').length;
    const done = state.proposals.filter(p => p.status === 'נסגר').length;
    kpisEl.innerHTML = [
      kpiCard('סה״כ הצעות', total, 'כולל טיוטות'),
      kpiCard('פתוחות', open, 'בטיפול'),
      kpiCard('נסגרו', done, 'הסתיימו'),
    ].join('');
  }

  
  function renderKpisMy(){
    const agent = state.agentName;
    const assignedCustomers = state.customers.filter(c => (c.assignedAgent||'') === agent);
    const openProposals = state.proposals.filter(p => (p.assignedAgent||agent) === agent && !['נסגר','בוטל'].includes(p.status||''));
    kpisEl.innerHTML = [
      kpiCard('משויכים אליי', assignedCustomers.length, 'לקוחות'),
      kpiCard('תיקים פתוחים', openProposals.length, 'הצעות פעילות'),
      kpiCard('דורש טיפול', openProposals.filter(p => computeCompletion(p).level!=='ok').length, 'חסרים/לא הושלם'),
    ].join('');
  }

  function latestProposalForCustomer(customerId){
    const rel = state.proposals.filter(p => p.customerId === customerId);
    rel.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    return rel[0] || null;
  }

  function renderMyProcesses(){
    const agent = state.agentName;
    const rows = state.customers
      .filter(c => (c.assignedAgent||'') === agent)
      .map(c => {
        const lp = latestProposalForCustomer(c.id);
        const status = lp ? (lp.status||'') : '—';
        const comp = lp ? computeCompletion(lp) : null;
        const prog = lp ? proposalProgressCell(lp) : '<span style="color:rgba(18,19,25,.55);font-size:12px">אין תיק עדיין</span>';
        const openCls = (lp && !['נסגר','בוטל'].includes(status)) ? '' : 'style="opacity:.65"';
        return { c, lp, status, prog, openCls };
      });

    // Sort: open first, then by createdAt desc
    rows.sort((a,b) => {
      const ao = a.lp && !['נסגר','בוטל'].includes(a.status);
      const bo = b.lp && !['נסגר','בוטל'].includes(b.status);
      if(ao !== bo) return bo - ao;
      return ((b.lp&&b.lp.createdAt)||'').localeCompare((a.lp&&a.lp.createdAt)||'');
    });

    viewEl.innerHTML = `
      ${renderReturnedResultsForAgent_(agent)}
      ${renderDueProcessesForAgent_(agent)}
      <div class="tableWrap">
        <table class="table">
          <thead>
            <tr>
              <th>לקוח</th>
              <th>נציג מטפל</th>
              <th>סטטוס תיק</th>
              <th>התקדמות</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr ${r.openCls}>
                <td>
                  <div style="font-weight:900">${escapeHtml(r.c.fullName||'')}</div>
                  <div style="font-size:12px;color:rgba(18,19,25,.55)">${escapeHtml(r.c.phone||'')}</div>
                </td>
                <td>${escapeHtml(r.c.assignedAgent||'')}</td>
                <td>${escapeHtml(r.status)}</td>
                <td>${r.prog}</td>
                <td style="text-align:left">
                  ${r.lp ? `<button class="btn btnSoft" data-open-prop="${escapeAttr(r.lp.id)}">פתח תיק</button>` : `<button class="btn btnSoft" data-new-prop="${escapeAttr(r.c.id)}">צור תיק</button>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${rows.length ? '' : `<div class="sideHint">אין לקוחות משויכים אליך עדיין.</div>`}
    `;

    $$('[data-open-prop]').forEach(b => b.addEventListener('click', () => openWizard({ proposalId: b.dataset.openProp })));
    $$('[data-new-prop]').forEach(b => b.addEventListener('click', () => openWizard({ customerId: b.dataset.newProp })));
    wireProcessButtons_();
  }

function renderKpisSettings(){
    // Removed the 3 KPI cubes (דמו / Cream + Gold / CRM) per request.
    // Keep the KPI area empty on Settings > General.
    kpisEl.innerHTML = '';
  }

  // ---------- Users Management (Admin) ----------
  let usersQuery = '';
  let usersRoleFilter = 'all';
  let usersStatusFilter = 'all';

  function roleLabel_(r){
    if(r === 'admin') return 'מנהל';
    if(r === 'agent') return 'סוכן';
    if(r === 'rep') return 'נציג';
    return r || '—';
  }

  function renderKpisUsers(){
    const users = getUsers_();
    const total = users.length;
    const active = users.filter(u => u.active !== false).length;
    const admins = users.filter(u => u.role === 'admin' && u.active !== false).length;
    kpisEl.innerHTML = [
      kpiCard('סה״כ משתמשים', total, 'כל המשתמשים במערכת'),
      kpiCard('פעילים', active, 'יכולים להתחבר'),
      kpiCard('מנהלים', admins, 'Admin פעילים'),
    ].join('');
  }

  function renderUsers(){
    if(!isAdmin_()){
      viewEl.innerHTML = '<div class="sideHint">אין הרשאה. רק מנהל מערכת יכול לצפות במסך זה.</div>';
      return;
    }

    const users = getUsers_();

    const q = (usersQuery||'').trim().toLowerCase();
    const roleF = usersRoleFilter;
    const statusF = usersStatusFilter;

    const filtered = users.filter(u => {
      const hay = (u.displayName + ' ' + u.username + ' ' + roleLabel_(u.role)).toLowerCase();
      if(q && !hay.includes(q)) return false;
      if(roleF !== 'all' && u.role !== roleF) return false;
      if(statusF === 'active' && u.active === false) return false;
      if(statusF === 'disabled' && u.active !== false) return false;
      return true;
    });

    viewEl.innerHTML = `
      <div class="usersToolbar">
        <div class="usersFilters">
          <div class="usersSearchWrap">
            <span aria-hidden="true" class="usersSearchIco">⌕</span>
            <input class="usersSearchInput" id="usersSearch" placeholder="חיפוש לפי שם / יוזר / תפקיד" value="${escapeAttr(usersQuery||'')}">
          </div>

          <select class="usersSelect" id="usersRole">
            <option value="all" ${roleF==='all'?'selected':''}>כל התפקידים</option>
            <option value="admin" ${roleF==='admin'?'selected':''}>מנהל</option>
            <option value="agent" ${roleF==='agent'?'selected':''}>סוכן</option>
            <option value="rep" ${roleF==='rep'?'selected':''}>נציג</option>
          </select>

          <select class="usersSelect" id="usersStatus">
            <option value="all" ${statusF==='all'?'selected':''}>כל הסטטוסים</option>
            <option value="active" ${statusF==='active'?'selected':''}>פעיל</option>
            <option value="disabled" ${statusF==='disabled'?'selected':''}>מושבת</option>
          </select>
        </div>

        <button class="btn btnPrimary" id="usersAddBtn">+ משתמש חדש</button>
      </div>

      <div class="tableWrap">
        <table class="table">
          <thead>
            <tr>
              <th>שם תצוגה</th>
              <th>שם משתמש</th>
              <th>תפקיד</th>
              <th>סטטוס</th>
              <th style="text-align:left">פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(u => {
              const isMe = state.currentUser && state.currentUser.username === u.username;
              const canToggle = !isMe;
              const stChip = u.active===false ? chip('מושבת','bad') : chip('פעיל','ok');
              return `
                <tr>
                  <td><b>${escapeHtml(u.displayName||'')}</b></td>
                  <td>${escapeHtml(u.username||'')}</td>
                  <td>${escapeHtml(roleLabel_(u.role))}</td>
                  <td>${stChip}</td>
                  <td style="text-align:left; white-space:nowrap">
                    <button class="btn btnSoft" data-user-edit="${escapeAttr(u.username)}">עריכה</button>
                    <button class="btn btnTiny" ${canToggle?'':'disabled'} data-user-toggle="${escapeAttr(u.username)}">${u.active===false?'הפעל':'השבת'}</button>
                    <button class="btn btnTiny" data-user-reset="${escapeAttr(u.username)}">איפוס סיסמה</button>
                    <button class="btn btnTiny" ${canToggle?'':'disabled'} data-user-del="${escapeAttr(u.username)}">מחיקה</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${filtered.length ? '' : '<div class="sideHint">לא נמצאו משתמשים.</div>'}
    `;

    // Wire UI
    const s = document.getElementById('usersSearch');
    const r = document.getElementById('usersRole');
    const st = document.getElementById('usersStatus');
    const addBtn = document.getElementById('usersAddBtn');

    if(s){
      s.addEventListener('input', () => {
        usersQuery = s.value || '';
        renderUsers();
      });
    }
    if(r){
      r.addEventListener('change', () => {
        usersRoleFilter = r.value || 'all';
        renderUsers();
      });
    }
    if(st){
      st.addEventListener('change', () => {
        usersStatusFilter = st.value || 'all';
        renderUsers();
      });
    }
    if(addBtn){
      addBtn.addEventListener('click', () => openUserModal_({ mode:'create' }));
    }

    $$('[data-user-edit]').forEach(b => b.addEventListener('click', () => openUserModal_({ mode:'edit', username:b.dataset.userEdit })));
    $$('[data-user-toggle]').forEach(b => b.addEventListener('click', () => {
      const username = b.dataset.userToggle;
      const u = getUsers_().find(x => x.username === username);
      if(!u) return;
      const res = setUserActive_(username, u.active===false ? true : false);
      if(!res.ok){ toast('שגיאה', res.msg || 'לא ניתן לעדכן'); return; }
      toast('עודכן', 'סטטוס המשתמש עודכן');
      renderUsers();
    }));
    $$('[data-user-del]').forEach(b => b.addEventListener('click', () => {
      const username = b.dataset.userDel;
      if(!username) return;
      const u = getUsers_().find(x => x.username === username);
      if(!u) return;
      if(!confirm(`למחוק את המשתמש "${u.displayName}" (${u.username})? פעולה זו אינה הפיכה.`)) return;
      const res = deleteUser_(username);
      if(!res.ok){ toast('שגיאה', res.msg || 'לא ניתן למחוק'); return; }
      toast('נמחק', 'המשתמש נמחק מהמערכת');
      renderUsers();
    }));
    $$('[data-user-reset]').forEach(b => b.addEventListener('click', () => openResetPasswordModal_(b.dataset.userReset)));
  }

  
  function openUserModal_(opt){
    const mode = opt.mode || 'create';
    const users = getUsers_();
    const existing = mode==='edit' ? users.find(u => u.username === opt.username) : null;

    const overlay = document.createElement('div');
    overlay.className = 'modalOverlay';
    overlay.innerHTML = `
      <div class="usersDialog">
        <div class="usersDialogHead">
          <div>
            <div class="usersDialogTitle">${mode==='edit' ? 'עריכת משתמש' : 'יצירת משתמש חדש'}</div>
            <div class="usersDialogSub">ניהול משתמשים • GEMEL INVEST</div>
          </div>
          <button class="btn btnSoft" data-x>סגור</button>
        </div>

        <div class="usersDialogBody">
          <div class="usersGrid">
            <div>
              <div class="usersLabel">שם תצוגה</div>
              <input class="input" id="umDisplay" type="text" placeholder="לדוגמה: אוריה סומך" value="${escapeAttr(existing?.displayName||'')}">
            </div>

            <div>
              <div class="usersLabel">שם משתמש</div>
              <input class="input" id="umUser" type="text" placeholder="username" value="${escapeAttr(existing?.username||'')}">
            </div>

            <div>
              <div class="usersLabel">תפקיד</div>
              <select class="input" id="umRole">
                <option value="admin" ${(existing?.role||'')==='admin'?'selected':''}>מנהל</option>
                <option value="agent" ${(existing?.role||'')==='agent'?'selected':''}>סוכן</option>
                <option value="rep" ${(existing?.role||'')==='rep'?'selected':''}>נציג</option>
              </select>
            </div>

            <div>
              <div class="usersLabel">${mode==='edit' ? 'סיסמה חדשה (אופציונלי)' : 'סיסמה'}</div>
              <input class="input" id="umPass" type="text" placeholder="${mode==='edit' ? 'השאר ריק כדי לא לשנות' : 'בחר סיסמה'}" value="">
            </div>

            <div class="usersRow">
              <label class="remember" style="justify-content:flex-start;gap:10px">
                <input id="umActive" type="checkbox" ${existing?.active===false ? '' : 'checked'}>
                <span>משתמש פעיל</span>
              </label>
            </div>

            <div class="usersRow">
              <div class="usersError hidden" id="umErr" role="alert"></div>
            </div>
          </div>
        </div>

        <div class="usersDialogFoot">
          <button class="btn btnSoft" data-cancel>ביטול</button>
          <button class="btn btnPrimary" data-save>${mode==='edit'?'שמור שינויים':'צור משתמש'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
    overlay.querySelector('[data-x]')?.addEventListener('click', close);
    overlay.querySelector('[data-cancel]')?.addEventListener('click', close);

    overlay.querySelector('[data-save]')?.addEventListener('click', () => {
      const displayName = String(overlay.querySelector('#umDisplay')?.value||'').trim();
      const username = String(overlay.querySelector('#umUser')?.value||'').trim();
      const role = String(overlay.querySelector('#umRole')?.value||'agent');
      const password = String(overlay.querySelector('#umPass')?.value||'').trim();
      const active = !!overlay.querySelector('#umActive')?.checked;

      const err = overlay.querySelector('#umErr');
      const showErr = (msg) => {
        if(!err) return;
        err.textContent = msg || 'שגיאה';
        err.classList.remove('hidden');
      };
      if(err) err.classList.add('hidden');

      const res = upsertUser_({
        _isEdit: mode==='edit',
        _prevUsername: existing?.username || '',
        displayName,
        username,
        role,
        password,
        active
      });

      if(!res.ok){
        showErr(res.msg || 'לא ניתן לשמור');
        return;
      }

      toast('נשמר', mode==='edit' ? 'המשתמש עודכן' : 'נוצר משתמש חדש');
      close();
      renderUsers();
    });
  }

  function openResetPasswordModal_(username){
    const u = getUsers_().find(x => x.username === username);
    if(!u) return;

    const overlay = document.createElement('div');
    overlay.className = 'modalOverlay';
    overlay.innerHTML = `
      <div class="usersDialog">
        <div class="usersDialogHead">
          <div>
            <div class="usersDialogTitle">איפוס סיסמה</div>
            <div class="usersDialogSub">${escapeHtml(u.displayName||'')} • ${escapeHtml(u.username||'')}</div>
          </div>
          <button class="btn btnSoft" data-x>סגור</button>
        </div>

        <div class="usersDialogBody">
          <div class="usersGrid">
            <div>
              <div class="usersLabel">סיסמה חדשה</div>
              <input class="input" id="rp1" type="text" placeholder="הזן סיסמה חדשה">
            </div>
            <div>
              <div class="usersLabel">אישור סיסמה</div>
              <input class="input" id="rp2" type="text" placeholder="הזן שוב">
            </div>
            <div class="usersRow">
              <div class="usersError hidden" id="rpErr" role="alert"></div>
            </div>
          </div>
        </div>

        <div class="usersDialogFoot">
          <button class="btn btnSoft" data-cancel>ביטול</button>
          <button class="btn btnPrimary" data-save>אפס סיסמה</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
    overlay.querySelector('[data-x]')?.addEventListener('click', close);
    overlay.querySelector('[data-cancel]')?.addEventListener('click', close);

    overlay.querySelector('[data-save]')?.addEventListener('click', () => {
      const p1 = String(overlay.querySelector('#rp1')?.value||'').trim();
      const p2 = String(overlay.querySelector('#rp2')?.value||'').trim();
      const err = overlay.querySelector('#rpErr');
      const showErr = (msg) => {
        if(!err) return;
        err.textContent = msg || 'שגיאה';
        err.classList.remove('hidden');
      };
      if(err) err.classList.add('hidden');

      if(!p1) return showErr('חסרה סיסמה חדשה');
      if(p1 !== p2) return showErr('הסיסמאות לא תואמות');

      const res = resetUserPassword_(username, p1);
      if(!res.ok) return showErr(res.msg || 'לא ניתן לאפס');

      toast('עודכן', 'סיסמה אופסה בהצלחה');
      close();
    });
  }

  function renderCustomersTable(rows){
    viewEl.innerHTML = `
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>לקוח</th>
              <th>ת״ז</th>
              <th>טלפון</th>
              <th>סטטוס</th>
              <th>נציג מטפל</th>
              <th>סגמנט</th>
              <th>התקדמות</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(c => `
              <tr data-customer-row="${escapeAttr(c.id)}">
                <td><b>${escapeHtml(c.fullName)}</b><div style="color:rgba(18,19,25,.55);font-size:12px">${escapeHtml(c.email)}</div></td>
                <td>${escapeHtml(c.tz)}</td>
                <td>${escapeHtml(c.phone)}</td>
                <td>${chip(c.status)}</td>
                <td>
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <span style="font-weight:900">${escapeHtml(c.assignedAgent||'—')}</span>
                    <button class="btn btnTiny" data-assign="${escapeAttr(c.id)}">שייך</button>
                  </div>
                </td>
                <td>${escapeHtml(c.segment)}</td>
                <td>${customerProgressCell(c.id)}</td>
                <td style="text-align:left;white-space:nowrap">
                      <button class="btn btnSoft" data-open-proposal="${c.id}" data-proposal-id="${escapeAttr((latestProposalForCustomer_(c.id)||{}).id||'')}">${latestProposalForCustomer_(c.id)?'ערוך הצעה':'צור הצעה'}</button>
                      <button class="btn btnTiny" data-new-process="${c.id}">צור תהליך</button>
                    </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Focus/highlight a customer row after certain actions (e.g., save proposal)
    try{
      if(state && state._focusCustomerId){
        const tr = document.querySelector(`[data-customer-row="${state._focusCustomerId}"]`);
        if(tr){
          tr.classList.add('rowHighlight');
          tr.scrollIntoView({ block:'center', behavior:'smooth' });
          setTimeout(()=>tr.classList.remove('rowHighlight'), 2200);
        }
        state._focusCustomerId = null;
      }
    }catch(_){/*noop*/}

    $$('[data-open-proposal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-open-proposal');
        const pid = btn.getAttribute('data-proposal-id');
        if(pid){
          openWizard({ proposalId: pid });
        }else{
          openWizard({ customerId: cid });
        }
      });
    });

    $$('[data-new-process]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const cid = btn.getAttribute('data-new-process');
        openProcessModal_(cid);
      });
    });

    // Assign customer to agent (any user can do it)
    $$('[data-assign]').forEach(b => b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = b.dataset.assign;
      const c = state.customers.find(x => x.id === id);
      if(!c) return;
      const current = c.assignedAgent || '';
      const suggested = state.teamAgents && state.teamAgents.length ? state.teamAgents.join(', ') : '';
      const name = prompt('שם הנציג לשיוך (אפשר לבחור/להקליד).\nקיימים: ' + suggested, current || state.agentName);
      if(name === null) return;
      c.assignedAgent = String(name).trim();
      toast('עודכן', 'הלקוח שויך ל־' + c.assignedAgent);
      render();
    }));
  }

  function renderProposalsTable(rows){
    viewEl.innerHTML = `
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>כותרת</th>
              <th>לקוח</th>
              <th>סטטוס</th>
              <th>תאריך</th>
              <th>התקדמות</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(p => `
              <tr>
                <td><b>${escapeHtml(p.title)}</b></td>
                <td>${escapeHtml(p.customerName || '—')}</td>
                <td>${chip(p.status, p.status==='נסגר'?'ok':'warn')}</td>
                <td>${escapeHtml(new Date(p.createdAt).toLocaleString('he-IL'))}</td>
                <td>${proposalProgressCell(p)}</td>
                <td><button class="btn btnSoft" data-resume="${p.id}">המשך</button></td>
              </tr>
            `).join('') : `<tr><td colspan="6" style="color:rgba(18,19,25,.55)">אין הצעות עדיין.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    $$('[data-resume]').forEach(btn => btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-resume');
      const proposal = state.proposals.find(p => p.id === pid);
      if(proposal) openWizard({ proposalId: pid });
    }));
  }

  function renderSettings(){
    // Admin only settings (UI + planned server connection)
    viewEl.innerHTML = `
      <div class="grid2">
        <div class="sideCard">
          <div class="sideTitle">חיבור לשרת (Google Sheets)</div>
          <div class="field">
            <label>Web App URL</label>
            <input id="serverUrlInput" placeholder="https://script.google.com/macros/s/XXXX/exec" value="${escapeAttr(state.server.url || '')}"/>
          </div>
          <div style="height:10px"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btnPrimary" id="connectBtn">בדוק חיבור</button>
            <button class="btn btnSoft" id="pullBtn">משוך נתונים</button>
          </div>
          <div class="sideHint" id="connHint">${state.connected ? '✅ מחובר' : '⚠️ לא מחובר (דמו)'}</div>
          <div class="sideHint">הערה: כרגע URL דינאמי משמש לתצוגה בלבד. כדי לחבר באמת, נדביק את ה־URL גם במשתנה <b>GOOGLE_SCRIPT_URL</b> בקוד (שלב הבא).</div>
        </div>

        <div class="sideCard">
          <div class="sideTitle">פרטי משתמש מחובר</div>
          <div class="sideHint"><b>שם:</b> ${escapeHtml(state.currentUser?.displayName || '—')}</div>
          <div class="sideHint"><b>יוזר:</b> ${escapeHtml(state.currentUser?.username || '—')}</div>
          <div class="sideHint"><b>תפקיד:</b> ${escapeHtml(roleLabel_(state.currentUser?.role || ''))}</div>
          <div style="height:10px"></div>
          <button class="btn btnSoft" id="logoutBtn2">התנתק</button>
        </div>

        <div class="sideCard">
          <div class="sideTitle">מה השלב הבא?</div>
          <div class="sideHint">1) הרשאות לפי תפקיד ✅</div>
          <div class="sideHint">2) ניהול משתמשים בתוך המערכת ✅ (בטאב "משתמשים")</div>
          <div class="sideHint">3) חיבור מלא ל־Google Sheets/App Script — נעשה בשלב הבא</div>
        </div>
      </div>
    `;

    // Logout
    $('#logoutBtn2')?.addEventListener('click', () => window.gemelLogout && window.gemelLogout());

    // Server connect / pull (demo-safe)
    const serverUrlInput = $('#serverUrlInput');
    $('#connectBtn')?.addEventListener('click', async () => {
      const url = (serverUrlInput.value || '').trim();
      state.server.url = url;
      const ping = await apiPing();
      state.connected = !!ping.ok;
      $('#connHint').textContent = state.connected ? '✅ מחובר' : '⚠️ לא מחובר (דמו)';
      toast(state.connected ? 'מחובר' : 'לא מחובר', state.connected ? 'השרת ענה בהצלחה' : 'בדוק URL/הרשאות');
    });
    $('#pullBtn')?.addEventListener('click', async () => {
      if(!GOOGLE_SCRIPT_URL){ toast('דמו', 'בשלב הבא נחבר ל־Sheets (GOOGLE_SCRIPT_URL)'); return; }
      await syncDown();
      toast('עודכן', 'משכנו נתונים מהשרת');
      render();
    });
  }

  // ---------- Search ----------
  function performSearch(){
    const q = (globalSearch.value||'').trim().toLowerCase();
    if(!q){
      toast('חיפוש', 'הכנס שם / ת״ז / טלפון');
      return;
    }
    const found = visibleCustomers_().filter(c =>
      (c.fullName||'').toLowerCase().includes(q) ||
      (c.tz||'').toLowerCase().includes(q) ||
      (c.phone||'').toLowerCase().includes(q)
    );
    if(route !== 'customers') setRoute('customers');
    renderCustomersTable(found);
    toast('תוצאות חיפוש', `${found.length} תוצאה/ות`);
  }
  searchBtn.addEventListener('click', performSearch);
  globalSearch.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); performSearch(); }
  });

  // ---------- Wizard (proposal flow) ----------
  const INTERNAL_STATUS = ['פתוח','ממתין להצעה','נסגר'];
  const STATUS_OPTIONS = ['טיוטה','בתהליך','ממתין למסמכים','ממתין לחיתום','נסגר','בוטל'];

  const OLD_POLICY_SWITCH_REASONS = [
    { key:'order', label:'סדר בתיק הביטוחי' },
    { key:'reduce_costs', label:'הוזלת עלויות/מיקסום זכויות' },
    { key:'understand_rights', label:'להבין זכויות' },
    { key:'excess_gap', label:'להבין אם קיים עודף/חוסר' },
    { key:'risk_fit', label:'התאמת סיכונים' },
    { key:'consolidate', label:'ריכוז תיק' },
    { key:'har_habituh', label:'בדיקה מול אתר הר הביטח' },
  ];



  const WIZ_STEPS = [
    { key:'customer', label:'פרטי לקוח' },
    { key:'old', label:'פוליסות קיימות' },
    { key:'new', label:'פוליסות חדשות' },
    { key:'medical', label:'שאלון רפואי' },
    { key:'payer', label:'פרטי משלם' },
    { key:'summary', label:'סיכום' }
  ];

  let wiz = null;

  newProposalBtn.addEventListener('click', () => openWizard({}));

  if(gofiBtn){
    gofiBtn.addEventListener('click', openGofi_);
  }
  if(gofiCloseBtn){
    gofiCloseBtn.addEventListener('click', closeGofi_);
  }
  if(gofiOverlay){
    gofiOverlay.addEventListener('click', (e) => { if(e.target === gofiOverlay) closeGofi_(); });
  }

  if(discountSpecBtn){
    discountSpecBtn.addEventListener('click', openDiscountSpec_);
  }
  if(discountSpecCloseBtn){
    discountSpecCloseBtn.addEventListener('click', closeDiscountSpec_);
  }
  if(discountSpecOverlay){
    discountSpecOverlay.addEventListener('click', (e) => { if(e.target === discountSpecOverlay) closeDiscountSpec_(); });
  }


  wizardCloseBtn.addEventListener('click', closeWizard);
  wizardOverlay.addEventListener('click', (e) => {
    if(e.target === wizardOverlay) closeWizard();
  });

  nextStepBtn.addEventListener('click', () => gotoStep(wiz.stepIndex + 1));
  prevStepBtn.addEventListener('click', () => gotoStep(wiz.stepIndex - 1));

  function openWizard({ customerId=null, proposalId=null }){
    const now = new Date();
    let proposal = null;

    if(proposalId){
      proposal = state.proposals.find(p => p.id === proposalId) || null;
    }

    if(!proposal){
      const customer = customerId ? state.customers.find(c => c.id === customerId) : null;
      if(customer && !customer.assignedAgent){ customer.assignedAgent = state.agentName; }
      proposal = {
        id: 'p_' + Math.random().toString(16).slice(2),
        createdAt: new Date().toISOString(),
        status: 'טיוטה',
        internalStatus: 'פתוח',
        title: 'הצעה',
        pdfGenerated: false,
        assignedAgent: (customer && customer.assignedAgent) ? customer.assignedAgent : state.agentName,
        customerId: customer ? customer.id : null,
        customerName: customer ? customer.fullName : '',
        customer: customer ? { ...customer } : { fullName:'', tz:'', phone:'', email:'' },

        oldPolicies: [],
        newPolicies: [],

        insuredList: [
          { id:'main', label:'מבוטח ראשי', type:'main' }
        ],
        childCounter: 0,
        activeInsuredId: 'main',
        medical: {
          // medical[insuredId][company|product] = answers
        }
      };
      state.proposals.unshift(proposal);
      saveProposals_();
    }

    // Normalize insureds + policies (backward compatibility)
    proposal.insuredList = (Array.isArray(proposal.insuredList) && proposal.insuredList.length)
      ? proposal.insuredList
      : [{ id:'main', label:'מבוטח ראשי', type:'main' }];
    if(!proposal.insuredList.some(i => i.id === 'main')){
      proposal.insuredList.unshift({ id:'main', label:'מבוטח ראשי', type:'main' });
    }
    proposal.childCounter = Number(proposal.childCounter || proposal.insuredList.filter(i => i.type === 'child').length) || 0;
    proposal.activeInsuredId = proposal.activeInsuredId || 'main';
    proposal.oldPolicies = (Array.isArray(proposal.oldPolicies) ? proposal.oldPolicies : []).map(x => ({ ...x, insuredId: (x && x.insuredId) ? x.insuredId : 'main' }));
    proposal.newPolicies = (Array.isArray(proposal.newPolicies) ? proposal.newPolicies : []).map(x => ({ ...x, insuredId: (x && x.insuredId) ? x.insuredId : 'main' }));


    wiz = {
      proposal,
      stepIndex: 0,
      medicalStepIndex: 0
    };

    $('#wizardTitle').textContent = proposal.customerName ? `הצעה – ${proposal.customerName}` : 'הצעה חדשה';
    const _ws = $('#wizardSub'); if(_ws) _ws.textContent = '';
    // Status dropdown
    if(statusSelect){
      statusSelect.innerHTML = STATUS_OPTIONS.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
      statusSelect.value = proposal.status || 'טיוטה';
      statusSelect.onchange = () => {
        proposal.status = statusSelect.value;
        syncInternalStatus(proposal);
        if(savePill) savePill.textContent = proposal.status;
        toast('עודכן', 'סטטוס עודכן');
        render();
      };
    }

    wizardOverlay.classList.remove('hidden');
    wizardOverlay.setAttribute('aria-hidden', 'false');

    buildInsuredTabs();
    updateInsuredIndicator();
    renderStepper();
    renderWizard();
    updateSums();
}

  function closeWizard(){
    wizardOverlay.classList.add('hidden');
    wizardOverlay.setAttribute('aria-hidden', 'true');
    wiz = null;
  }

  
  // ---------- GOFI (KPI module in separate repo via iframe) ----------
  function getGofiOrigin_(){
    try{ return GOFI_URL ? new URL(GOFI_URL).origin : ''; }catch(_){ return ''; }
  }

  function getAgentId_(){
    // Prefer authenticated username; fallback to display name or guest
    return (state.currentUser && state.currentUser.username) ? state.currentUser.username : (state.agentName || 'guest');
  }

  
  // --- GOFI fullscreen overlay sizing (safe, scoped, no global CSS changes) ---
  let __gofiPrevBodyOverflow = null;
  function ensureGofiFullscreen_(){
    try{
      if(gofiOverlay){
        gofiOverlay.style.position = 'fixed';
        gofiOverlay.style.inset = '0';
        gofiOverlay.style.width = '100vw';
        gofiOverlay.style.height = '100vh';
        gofiOverlay.style.maxWidth = '100vw';
        gofiOverlay.style.maxHeight = '100vh';
        gofiOverlay.style.zIndex = '999999';
        gofiOverlay.style.display = 'flex';
        gofiOverlay.style.flexDirection = 'column';
        gofiOverlay.style.alignItems = 'stretch';
        gofiOverlay.style.justifyContent = 'stretch';
        gofiOverlay.style.padding = '0';
        // Keep existing background from CSS if any; otherwise provide a soft fallback
        if(!gofiOverlay.style.background || gofiOverlay.style.background === 'transparent'){
          gofiOverlay.style.background = 'rgba(0,0,0,0.25)';
        }

        // Many overlays wrap content in an inner container with its own max-height; force it full height.
        const inner = gofiOverlay.firstElementChild;
        if(inner){
          inner.style.width = '100%';
          inner.style.height = '100%';
          inner.style.maxHeight = '100vh';
          inner.style.margin = '0';
          inner.style.borderRadius = '0';
          inner.style.display = 'flex';
          inner.style.flexDirection = 'column';
          inner.style.flex = '1 1 auto';
          inner.style.minHeight = '0';
        }
      }

      if(gofiFrame){
        const p = gofiFrame.parentElement;
        if(p){
          p.style.display = 'flex';
          p.style.flexDirection = 'column';
          p.style.flex = '1 1 auto';
          p.style.height = '100%';
          p.style.minHeight = '0';
          p.style.maxHeight = '100vh';
        }

        gofiFrame.style.flex = '1 1 auto';
        gofiFrame.style.width = '100%';
        gofiFrame.style.height = '100%';
        gofiFrame.style.minHeight = '0';
        gofiFrame.style.maxHeight = '100vh';
        gofiFrame.style.border = '0';
        gofiFrame.style.borderRadius = '0';
        gofiFrame.style.display = 'block';
      }

      if(__gofiPrevBodyOverflow === null){
        __gofiPrevBodyOverflow = document.body.style.overflow || '';
      }
      document.body.style.overflow = 'hidden';
    }catch(_){}
  }
  function restoreGofiFullscreen_(){
    try{
      if(__gofiPrevBodyOverflow !== null){
        document.body.style.overflow = __gofiPrevBodyOverflow;
        __gofiPrevBodyOverflow = null;
      }else{
        document.body.style.overflow = '';
      }
    }catch(_){}
  }

function openGofi_(){
    if(!gofiOverlay) return;
    ensureGofiFullscreen_();

    gofiOverlay.classList.remove('hidden');
    gofiOverlay.setAttribute('aria-hidden', 'false');

    const hasUrl = !!String(GOFI_URL||'').trim();
    if(gofiFallback){
      gofiFallback.classList.toggle('hidden', hasUrl);
    }
    if(gofiFrame){
      gofiFrame.classList.toggle('hidden', !hasUrl);
      if(hasUrl){
        // Reload each time to ensure fresh context
        gofiFrame.src = GOFI_URL;

        gofiFrame.onload = () => {
          try{
            const origin = getGofiOrigin_();
            const payload = {
              type: 'GOFI_CONTEXT',
              agentId: getAgentId_(),
              parentOrigin: (location && location.origin) ? location.origin : '',
              parentHref: (location && location.href) ? location.href : '',
              displayName: (state.currentUser && state.currentUser.displayName) ? state.currentUser.displayName : (state.agentName||''),
              role: (state.currentUser && state.currentUser.role) ? state.currentUser.role : 'guest',
              ts: Date.now()
            };
            if(origin){
              gofiFrame.contentWindow && gofiFrame.contentWindow.postMessage(payload, origin);
            }
          }catch(_){}
        };
      }else{
        gofiFrame.removeAttribute('src');
      }
    }
  }

  function closeGofi_(){
    if(!gofiOverlay) return;
    gofiOverlay.classList.add('hidden');
    gofiOverlay.setAttribute('aria-hidden', 'true');
    restoreGofiFullscreen_();
    // Stop iframe execution (optional)
    if(gofiFrame){
      try{ gofiFrame.removeAttribute('src'); }catch(_){}
    }
  }



// --- Discounts Spec fullscreen overlay sizing (safe, scoped) ---
let __discPrevBodyOverflow = null;
function ensureDiscountSpecFullscreen_(){
  try{
    if(discountSpecOverlay){
      discountSpecOverlay.style.position = 'fixed';
      discountSpecOverlay.style.inset = '0';
      discountSpecOverlay.style.width = '100vw';
      discountSpecOverlay.style.height = '100vh';
      discountSpecOverlay.style.maxWidth = '100vw';
      discountSpecOverlay.style.maxHeight = '100vh';
      discountSpecOverlay.style.zIndex = '999999';
      discountSpecOverlay.style.display = 'flex';
      discountSpecOverlay.style.flexDirection = 'column';
      discountSpecOverlay.style.alignItems = 'stretch';
      discountSpecOverlay.style.justifyContent = 'stretch';
      discountSpecOverlay.style.padding = '0';
      if(!discountSpecOverlay.style.background || discountSpecOverlay.style.background === 'transparent'){
        discountSpecOverlay.style.background = 'rgba(0,0,0,0.25)';
      }

      // Force inner container full height (some layouts set max-height)
      const inner = discountSpecOverlay.firstElementChild;
      if(inner){
        inner.style.width = '100%';
        inner.style.height = '100%';
        inner.style.maxHeight = '100vh';
        inner.style.margin = '0';
        inner.style.borderRadius = '0';
        inner.style.display = 'flex';
        inner.style.flexDirection = 'column';
        inner.style.flex = '1 1 auto';
        inner.style.minHeight = '0';
      }
    }

    if(discountSpecFrame){
      const p = discountSpecFrame.parentElement;
      if(p){
        p.style.display = 'flex';
        p.style.flexDirection = 'column';
        p.style.flex = '1 1 auto';
        p.style.height = '100%';
        p.style.minHeight = '0';
        p.style.maxHeight = '100vh';
      }

      discountSpecFrame.style.flex = '1 1 auto';
      discountSpecFrame.style.width = '100%';
      discountSpecFrame.style.height = '100%';
      discountSpecFrame.style.minHeight = '0';
      discountSpecFrame.style.maxHeight = '100vh';
      discountSpecFrame.style.border = '0';
      discountSpecFrame.style.borderRadius = '0';
      discountSpecFrame.style.display = 'block';
    }

    if(__discPrevBodyOverflow === null){
      __discPrevBodyOverflow = document.body.style.overflow || '';
    }
    document.body.style.overflow = 'hidden';
  }catch(_){}
}
function restoreDiscountSpecFullscreen_(){
  try{
    if(__discPrevBodyOverflow !== null){
      document.body.style.overflow = __discPrevBodyOverflow;
      __discPrevBodyOverflow = null;
    }else{
      document.body.style.overflow = '';
    }
  }catch(_){}
}

function openDiscountSpec_(){
    if(!discountSpecOverlay) return;
    ensureDiscountSpecFullscreen_();
    discountSpecOverlay.classList.remove('hidden');
    discountSpecOverlay.setAttribute('aria-hidden', 'false');
    if(discountSpecFrame){
      // Reload each time to ensure freshest content
      discountSpecFrame.src = POLICY_SPEC_URL;
    }
  }

  function closeDiscountSpec_(){
    if(!discountSpecOverlay) return;
    discountSpecOverlay.classList.add('hidden');
    discountSpecOverlay.setAttribute('aria-hidden', 'true');
    restoreDiscountSpecFullscreen_();
    if(discountSpecFrame){
      try{ discountSpecFrame.removeAttribute('src'); }catch(_){}
    }
  }

// Listen to events from the GOFI iframe (optional)
  window.addEventListener('message', (event) => {
    const origin = getGofiOrigin_();
    if(!origin || event.origin !== origin) return;
    const data = event.data || {};
    if(data.type === 'GOFI_CLOSE'){ closeGofi_(); }
    // Future: handle KPI events here (SALE_CREATED, etc.)
  });


function isVisible(el){
    if(!el) return false;
    // offsetParent null for display:none; also handle hidden attribute
    if(el.hidden) return false;
    const style = window.getComputedStyle(el);
    if(style.display==='none' || style.visibility==='hidden' || style.opacity==='0') return false;
    return true;
  }

  function clearReqErrors(){
    wizardMain.querySelectorAll('.reqError').forEach(x => x.classList.remove('reqError'));
  }

  function validateCurrentStep(){
    clearReqErrors();

    // Validate all visible inputs/selects/textareas in the wizard (current step)
    const controls = Array.from(wizardMain.querySelectorAll('input, select, textarea'))
      .filter(el => {
        if(!isVisible(el)) return false;
        const type = (el.getAttribute('type')||'').toLowerCase();
        if(type==='button' || type==='submit' || type==='hidden') return false;
        if(el.disabled) return false;
        // Ignore non-form controls
        if(el.id==='searchInput') return false;
        return true;
      });

    // Radio groups: require one checked per group
    const radios = controls.filter(el => (el.type||'').toLowerCase()==='radio');
    const radioNames = Array.from(new Set(radios.map(r => r.name).filter(Boolean)));
    for(const name of radioNames){
      const group = radios.filter(r => r.name===name);
      if(group.length && !group.some(r => r.checked)){
        group.forEach(r => r.classList.add('reqError'));
        toast('חסר מידע', 'יש להשלים את כל השדות לפני מעבר לשלב הבא');
        group[0].scrollIntoView({behavior:'smooth', block:'center'});
        return false;
      }
    }

    // Other controls: require value
    for(const el of controls){
      const type = (el.getAttribute('type')||'').toLowerCase();
      if(type==='radio') continue;
      // For checkboxes: must be checked
      if(type==='checkbox'){
        if(!el.checked){
          el.classList.add('reqError');
          toast('חסר מידע', 'יש להשלים את כל השדות לפני מעבר לשלב הבא');
          el.scrollIntoView({behavior:'smooth', block:'center'});
          return false;
        }
        continue;
      }
      const v = (el.value ?? '').toString().trim();
      if(v === ''){
        el.classList.add('reqError');
        toast('חסר מידע', 'יש להשלים את כל השדות לפני מעבר לשלב הבא');
        el.scrollIntoView({behavior:'smooth', block:'center'});
        try{ el.focus(); }catch(e){}
        return false;
      }
    }

    // Extra rule: if payment method is card, require card number input filled (transient)
    if(wiz && WIZ_STEPS[wiz.stepIndex] && WIZ_STEPS[wiz.stepIndex].key==='payer'){
      const method = wiz.proposal?.payer?.method || 'card';
      if(method==='card'){
        const numEl = document.getElementById('payer_card_number');
        const expEl = document.getElementById('payer_card_exp');
        if(numEl && numEl.value.trim()===''){
          numEl.classList.add('reqError');
          toast('חסר מידע', 'יש למלא מספר כרטיס ותוקף');
          numEl.scrollIntoView({behavior:'smooth', block:'center'});
          numEl.focus();
          return false;
        }
        if(expEl && expEl.value.trim()===''){
          expEl.classList.add('reqError');
          toast('חסר מידע', 'יש למלא מספר כרטיס ותוקף');
          expEl.scrollIntoView({behavior:'smooth', block:'center'});
          expEl.focus();
          return false;
        }
      }
    }

    return true;
  }


  // ---------- Required fields gate (per step) ----------
  function addReq(el){
    try{ if(el) el.classList.add('reqError'); }catch(e){}
  }
  function gateFail(title, msg, el){
    toast(title, msg);
    if(el && el.scrollIntoView){
      try{ el.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){}
      try{ el.focus && el.focus(); }catch(e){}
    }
    return false;
  }

  function validateCustomerStep(){
    const p = wiz && wiz.proposal ? wiz.proposal : null;
    if(!p) return true;
    const insuredId = p.activeInsuredId || 'main';
    p.insuredDetails = p.insuredDetails || {};
    const d = (insuredId === 'main') ? (p.customer || (p.customer = {})) : (p.insuredDetails[insuredId] || (p.insuredDetails[insuredId] = {}));

    const needStr = (key, elId, label) => {
      const v = String(d[key] || '').trim();
      if(!v){
        addReq(document.getElementById(elId));
        return gateFail('חסר מידע', `חובה למלא: ${label}`, document.getElementById(elId));
      }
      return true;
    };

    if(!needStr('firstName','customer_firstName','שם פרטי')) return false;
    if(!needStr('lastName','customer_lastName','שם משפחה')) return false;

    // selects
    const gender = String(d.gender||'').trim();
    if(!gender){
      addReq(document.getElementById('customer_gender'));
      return gateFail('חסר מידע','חובה לבחור מין', document.getElementById('customer_gender'));
    }
    const ms = String(d.maritalStatus||'').trim();
    if(!ms){
      addReq(document.getElementById('customer_maritalStatus'));
      return gateFail('חסר מידע','חובה לבחור מצב משפחתי', document.getElementById('customer_maritalStatus'));
    }

    if(!needStr('birthDate','customer_birthDate','תאריך לידה')) return false;
    if(!needStr('mobile','customer_mobile','נייד')) return false;

    // email: allow "אין"
    const email = String(d.email||'').trim();
    if(!email){
      addReq(document.getElementById('customer_email'));
      return gateFail('חסר מידע','חובה למלא מייל (אם אין – לרשום "אין")', document.getElementById('customer_email'));
    }
    const emailOk = (email === 'אין') || email.includes('@');
    if(!emailOk){
      addReq(document.getElementById('customer_email'));
      return gateFail('מייל לא תקין','אם אין מייל – רשום "אין", אחרת הזן כתובת מייל תקינה', document.getElementById('customer_email'));
    }

    if(!needStr('addressFull','customer_addressFull','כתובת מלאה')) return false;
    if(!needStr('city','customer_city','עיר')) return false;

    if(!needStr('tz','customer_tz','תעודת זהות')) return false;

    const hmo = String(d.hmo||'').trim();
    if(!hmo){
      addReq(document.getElementById('customer_hmo'));
      return gateFail('חסר מידע','חובה לבחור קופת חולים', document.getElementById('customer_hmo'));
    }
    const shaban = String(d.shaban||'').trim();
    if(!shaban){
      addReq(document.getElementById('customer_shaban'));
      return gateFail('חסר מידע','חובה לבחור שב״ן', document.getElementById('customer_shaban'));
    }

    const h = parseFloat(String(d.heightCm||'').replace(',','.'));
    if(!(h>0)){
      addReq(document.getElementById('customer_heightCm'));
      return gateFail('חסר מידע','חובה למלא גובה', document.getElementById('customer_heightCm'));
    }
    const w = parseFloat(String(d.weightKg||'').replace(',','.'));
    if(!(w>0)){
      addReq(document.getElementById('customer_weightKg'));
      return gateFail('חסר מידע','חובה למלא משקל', document.getElementById('customer_weightKg'));
    }

    if(!needStr('occupation','customer_occupation','עיסוק')) return false;
    if(!needStr('tzIssueDate','customer_tzIssueDate','הנפקת ת.ז')) return false;

    // notes optional
    return true;
  }

  function validateOldPoliciesStep(){
    const p = wiz && wiz.proposal ? wiz.proposal : null;
    if(!p) return true;
    p.oldPolicies = Array.isArray(p.oldPolicies) ? p.oldPolicies : [];
    p.oldPolicySwitchReasons = Array.isArray(p.oldPolicySwitchReasons) ? p.oldPolicySwitchReasons : [];

    if(p.oldPolicies.length < 1){
      const btn = document.getElementById('addOldBtn');
      addReq(btn);
      return gateFail('חסר מידע','חובה להוסיף לפחות פוליסה קיימת אחת לפני מעבר לשלב הבא', btn);
    }
    if(p.oldPolicySwitchReasons.length < 1){
      const first = wizardMain.querySelector('[data-switch-reason]');
      if(first){
        wizardMain.querySelectorAll('[data-switch-reason]').forEach(x => addReq(x));
      }
      return gateFail('חסר מידע','חובה לבחור לפחות סיבה אחת ב"סיבת החלפה פוליסה בתיק הביטוחי"', first || wizardMain);
    }
    return true;
  }

  function validateNewPoliciesStep(){
    const p = wiz && wiz.proposal ? wiz.proposal : null;
    if(!p) return true;
    p.newPolicies = Array.isArray(p.newPolicies) ? p.newPolicies : [];

    if(p.newPolicies.length < 1){
      const btn = document.getElementById('addNewBtn');
      addReq(btn);
      return gateFail('חסר מידע','חובה להוסיף לפחות פוליסה חדשה אחת לפני מעבר לשלב הבא', btn);
    }

    // Health policy must have coverages selected
    const missingCov = p.newPolicies.find((x) => x && x.product==='בריאות' && !String(x.coveragesText||'').trim());
    if(missingCov){
      const idx = p.newPolicies.indexOf(missingCov);
      // switch to insured of the missing policy so the button exists in DOM
      if(missingCov.insuredId){
        p.activeInsuredId = missingCov.insuredId;
        buildInsuredTabs();
        updateInsuredIndicator();
        renderWizard();
      }
      const btn = wizardMain.querySelector(`[data-cov-new="${idx}"]`);
      addReq(btn);
      return gateFail('חסר מידע','בפוליסת בריאות חובה לבחור כיסויים לפני מעבר לשלב הבא', btn || wizardMain);
    }

    // Compensation for critical illness/cancer already enforced on add, keep defensive check
    const missingComp = p.newPolicies.find((x) => x && (x.product==='מחלות קשות' || x.product==='מחלות סרטן') && !(parseFloat(x.compensation||0) > 0));
    if(missingComp){
      const idx = p.newPolicies.indexOf(missingComp);
      if(missingComp.insuredId){
        p.activeInsuredId = missingComp.insuredId;
        buildInsuredTabs();
        updateInsuredIndicator();
        renderWizard();
      }
      const btn = document.getElementById('addNewBtn');
      addReq(btn);
      return gateFail('חסר מידע','במחלות קשות/סרטן חובה למלא סכום פיצוי', btn || wizardMain);
    }


    // Sum insured for ריסק/משכנתא enforced on add, keep defensive check
    const missingSum = p.newPolicies.find((x) => x && (x.product==='ריסק' || x.product==='משכנתא') && !(parseFloat(x.sumInsured||0) > 0));
    if(missingSum){
      if(missingSum.insuredId){
        p.activeInsuredId = missingSum.insuredId;
        buildInsuredTabs();
        updateInsuredIndicator();
        renderWizard();
      }
      const btn = document.getElementById('addNewBtn');
      addReq(btn);
      return gateFail('חסר מידע','בריסק/משכנתא חובה למלא סכום ביטוח', btn || wizardMain);
    }

    return true;
  }

  function validateMedicalStep(){
    const p = wiz && wiz.proposal ? wiz.proposal : null;
    if(!p) return true;
    p.newPolicies = Array.isArray(p.newPolicies) ? p.newPolicies : [];
    p.medical = p.medical || {};

    const chosenKey = 'DEFAULT|MEDICAL';
    const qn = questionnaires[chosenKey];
    if(!qn) return true;

    // Only insureds that have at least one new policy require medical answers
    const insuredIds = Array.from(new Set(p.newPolicies.map(x => x.insuredId).filter(Boolean)));
    const requiredYesNo = [];
    (qn.steps||[]).forEach(st => (st.questions||[]).forEach(q => {
      if(q && q.type==='yesno' && q.id) requiredYesNo.push(q.id);
    }));

    for(const insuredId of insuredIds){
      const answers = (p.medical[insuredId] && p.medical[insuredId][chosenKey]) ? p.medical[insuredId][chosenKey] : {};
      const missingId = requiredYesNo.find(qid => !(answers[qid]==='כן' || answers[qid]==='לא'));
      if(missingId){
        // switch to that insured and rerender medical
        p.activeInsuredId = insuredId;
        buildInsuredTabs();
        updateInsuredIndicator();
        renderWizard();
        // highlight the missing question buttons
        const btns = wizardMain.querySelectorAll(`[data-yn="${cssEscape(missingId)}"]`);
        btns.forEach(b => addReq(b));
        const first = btns && btns[0] ? btns[0] : wizardMain;
        return gateFail('חסר מידע', `בשאלון רפואי חובה לענות כן/לא לכל שאלה (${labelInsured(insuredId)})`, first);
      }
    }
    // notes optional
    return true;
  }

  function validatePayerStep(){
    const p = wiz && wiz.proposal ? wiz.proposal : null;
    if(!p) return true;
    if(!p.payer) p.payer = { method:'card', card:{tz:'',name:'',last4:'',exp:''}, hok:{bank:'',branch:'',account:'',exp:''} };
    const method = p.payer.method || '';

    if(method !== 'card' && method !== 'hok'){
      const first = wizardMain.querySelector('[data-pay-method]');
      return gateFail('חסר מידע','חובה לבחור אמצעי תשלום (כרטיס אשראי או הוראת קבע)', first || wizardMain);
    }

    if(method === 'card'){
      const tzEl = document.getElementById('payer_card_tz');
      const nameEl = document.getElementById('payer_card_name');
      const numEl = document.getElementById('payer_card_number');
      const expEl = document.getElementById('payer_card_exp');

      const tz = String(p.payer.card.tz||'').trim();
      const name = String(p.payer.card.name||'').trim();
      const exp = String(p.payer.card.exp||'').trim();
      const digits = numEl ? String(numEl.value||'').replace(/\D/g,'') : '';

      if(!tz){ addReq(tzEl); return gateFail('חסר מידע','חובה למלא ת״ז בעל הכרטיס', tzEl); }
      if(!name){ addReq(nameEl); return gateFail('חסר מידע','חובה למלא שם בעל הכרטיס', nameEl); }
      if(digits.length < 12){ addReq(numEl); return gateFail('חסר מידע','חובה למלא מספר כרטיס אשראי', numEl); }
      if(!exp){ addReq(expEl); return gateFail('חסר מידע','חובה למלא תוקף כרטיס (MM/YY)', expEl); }

      return true;
    }

    if(method === 'hok'){
      const bEl = document.getElementById('payer_hok_bank');
      const brEl = document.getElementById('payer_hok_branch');
      const aEl = document.getElementById('payer_hok_account');

      const bank = String(p.payer.hok.bank||'').trim();
      const branch = String(p.payer.hok.branch||'').trim();
      const account = String(p.payer.hok.account||'').trim();

      if(!bank){ addReq(bEl); return gateFail('חסר מידע','חובה למלא מספר בנק', bEl); }
      if(!branch){ addReq(brEl); return gateFail('חסר מידע','חובה למלא מספר סניף', brEl); }
      if(!account){ addReq(aEl); return gateFail('חסר מידע','חובה למלא מספר חשבון', aEl); }

      return true;
    }

    return true;
  }

  function validateGateForStep(stepKey){
    if(!wiz) return true;
    if(stepKey === 'customer') return validateCustomerStep();
    if(stepKey === 'old') return validateOldPoliciesStep();
    if(stepKey === 'new') return validateNewPoliciesStep();
    if(stepKey === 'medical') return validateMedicalStep();
    if(stepKey === 'payer') return validatePayerStep();
    return true;
  }


function gotoStep(i){
    if(!wiz) return;
    const goingForward = (i > wiz.stepIndex);

    if(goingForward){
      clearReqErrors();
      const stepKey = WIZ_STEPS[wiz.stepIndex] ? WIZ_STEPS[wiz.stepIndex].key : '';
      if(stepKey && !validateGateForStep(stepKey)) return;
    }

    if(i < 0) i = 0;
    if(i >= WIZ_STEPS.length) i = WIZ_STEPS.length - 1;
    wiz.stepIndex = i;

    // reset medical substep when leaving/entering
    renderStepper();
    renderWizard();
    updateSums();
    saveProposals_();
  }


  function renderStepper(){
    const insuredId = (wiz && wiz.proposal && wiz.proposal.activeInsuredId) ? wiz.proposal.activeInsuredId : 'main';
    const insuredLabel = labelInsured(insuredId);
    stepperEl.innerHTML = WIZ_STEPS.map((s, idx) => {
      // Show which insured is active across insured-specific steps to prevent agent mistakes
      const insuredSteps = ['customer','old','new','medical'];
      const showInsured = insuredSteps.includes(s.key);
      const lbl = showInsured ? `${s.label} – ${insuredLabel}` : s.label;
      return `<div class="step ${idx===wiz.stepIndex?'active':''}">${escapeHtml(lbl)}</div>`;
    }).join('');
  }

  function getActiveInsured(){
    return (wiz && wiz.proposal && wiz.proposal.insuredList)
      ? wiz.proposal.insuredList.find(x => x.id===wiz.proposal.activeInsuredId)
      : null;
  }

  function updateInsuredIndicator(){
    const a = getActiveInsured();
    if(!insuredIndicatorEl) return;
    if(!a){ insuredIndicatorEl.textContent = ''; return; }
    insuredIndicatorEl.innerHTML = `נמצא/ת על: <strong>${escapeHtml(a.label)}</strong>`;
  }

  function buildInsuredTabs(){
    const p = wiz.proposal;

    const hasSpouse = p.insuredList.some(i => i.type === 'spouse');
    const canRemoveSpouse = hasSpouse;

    insuredTabsEl.innerHTML =
      p.insuredList.map(x => {
        const isChild = x.type === 'child';
        const isSpouse = x.type === 'spouse';
        const active = x.id===p.activeInsuredId ? 'active' : '';
        const removeBtn = (isChild || isSpouse)
          ? `<span class="xBtn" data-del-insured="${escapeAttr(x.id)}" title="הסר">×</span>`
          : '';
        return `<button class="insuredTab ${active}" data-insured="${escapeAttr(x.id)}">${escapeHtml(x.label)}${removeBtn}</button>`;
      }).join('')
      + `
        ${hasSpouse ? '' : `<button class="insuredTab" id="addSpouseBtn" title="הוסף בן/בת זוג">＋ בן/בת זוג</button>`}
        <button class="insuredTab" id="addChildBtn" title="הוסף ילד">＋ ילד</button>
      `;

    // Switch insured
    $$('[data-insured]', insuredTabsEl).forEach(b => b.addEventListener('click', (e) => {
      // if clicked the remove x, ignore (handled below)
      if(e && e.target && e.target.closest && e.target.closest('[data-del-insured]')) return;
      const id = b.getAttribute('data-insured');
      p.activeInsuredId = id;

      // When changing insured, rerender the current step so policies stay separated
      buildInsuredTabs();
      updateSums();
      const stepKey = WIZ_STEPS[wiz.stepIndex].key;
      if(['customer','old','new','medical'].includes(stepKey)){
        if(stepKey === 'medical') wiz.medicalStepIndex = 0;
        renderWizard();
      }
    }));

    // Add spouse
    const addSpouseBtn = document.getElementById('addSpouseBtn');
    if(addSpouseBtn){
      addSpouseBtn.addEventListener('click', () => {
        if(p.insuredList.some(i => i.id === 'spouse')){
          toast('קיים', 'בן/בת זוג כבר קיימ/ת');
          return;
        }
        p.insuredList.push({ id:'spouse', label:'בן/בת זוג', type:'spouse' });
        p.activeInsuredId = 'spouse';
        toast('נוסף', 'נוסף/ה בן/בת זוג');
        buildInsuredTabs();
        updateSums();
        renderWizard();
      });
    }

    // Add child
    const addChildBtn = document.getElementById('addChildBtn');
    if(addChildBtn){
      addChildBtn.addEventListener('click', () => {
        p.childCounter = (Number(p.childCounter) || 0) + 1;
        const n = p.childCounter;
        const childId = `child_${n}`;
        p.insuredList.push({ id: childId, label: `ילד ${n}`, type:'child' });
        p.activeInsuredId = childId;
        toast('נוסף', `נוסף ילד ${n}`);
        buildInsuredTabs();
        updateSums();
        const stepKey = WIZ_STEPS[wiz.stepIndex].key;
        if(['customer','old','new','medical'].includes(stepKey)){
          if(stepKey === 'medical') wiz.medicalStepIndex = 0;
          renderWizard();
        }
      });
    }

    // Remove insured (child/spouse)
    $$('[data-del-insured]', insuredTabsEl).forEach(x => x.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = x.getAttribute('data-del-insured');
      const item = p.insuredList.find(i => i.id === id);
      if(!item || item.type === 'main') return;

      // Remove from list
      p.insuredList = p.insuredList.filter(i => i.id !== id);

      // Clean related data
      p.oldPolicies = (p.oldPolicies||[]).filter(pp => (pp.insuredId||'main') !== id);
      p.newPolicies = (p.newPolicies||[]).filter(pp => (pp.insuredId||'main') !== id);
      if(p.medical && p.medical[id]) delete p.medical[id];
      if(p.insuredDetails && p.insuredDetails[id]) delete p.insuredDetails[id];

      if(p.activeInsuredId === id){
        p.activeInsuredId = 'main';
      }

      toast('הוסר', item.type === 'spouse' ? 'בן/בת זוג הוסר/ה' : 'הילד הוסר');
      buildInsuredTabs();
      updateSums();
      renderWizard();
    }));

    updateInsuredIndicator();
  }

  function renderWizard(){
    clearReqErrors();
    if(!wiz) return;
    const stepKey = WIZ_STEPS[wiz.stepIndex].key;
    if(savePill) savePill.textContent = wiz.proposal.status;
    if(statusSelect) statusSelect.value = wiz.proposal.status || 'טיוטה';
    if(compHost){
      const comp = computeCompletion(wiz.proposal);
      compHost.innerHTML = renderCompletionBadges(comp);
    }

    try{
      if(stepKey === 'customer') return renderCustomerStep();
      if(stepKey === 'old') return renderOldPoliciesStep();
      if(stepKey === 'new') return renderNewPoliciesStep();
      if(stepKey === 'medical') return renderMedicalStep();
      if(stepKey === 'payer') return renderPayerStep();
      if(stepKey === 'summary') return renderSummaryStep();
    } catch(err){
      console.error('renderWizard step failed:', stepKey, err);
      toast('שגיאה', 'תקלה בטעינת המסך. בדוק בקונסול (F12) לפרטים.');
      if(wizardMain){
        wizardMain.innerHTML = `
          <div class="sectionTitle">שגיאה בטעינת המסך</div>
          <div class="sideHint">נפלה שגיאה בזמן טעינת שלב: <b>${escapeHtml(stepKey)}</b>.<br/>פתח קונסול (F12) כדי לראות את השגיאה המדויקת.</div>
          <div class="hr"></div>
          <button class="btn btnPrimary" id="retryStepBtn">נסה שוב</button>
        `;
        const r = document.getElementById('retryStepBtn');
        if(r) r.addEventListener('click', () => renderWizard());
      }
    }
  }

  function renderCustomerStep(){
    const p = wiz.proposal;
    const insuredId = p.activeInsuredId || 'main';
    p.insuredDetails = p.insuredDetails || {};
    const d = (insuredId === 'main') ? p.customer : (p.insuredDetails[insuredId] = (p.insuredDetails[insuredId] || {}));


    // Backward compatibility: if old fullName exists, try split once
    if(insuredId==='main' && !d.firstName && !d.lastName && p.customer.fullName){
      const parts = String(p.customer.fullName).trim().split(/\s+/);
      d.firstName = parts.shift() || '';
      d.lastName = parts.join(' ') || '';
    }

    wizardMain.innerHTML = `
      <div class="sectionTitle">פרטי מבוטח – ${escapeHtml(labelInsured(insuredId))}</div>

      <div class="grid4">
        ${field('שם פרטי', 'customer_firstName', d.firstName || '')}
        ${field('שם משפחה', 'customer_lastName', d.lastName || '')}
        ${selectField('מין', 'customer_gender', ['זכר','נקבה','אחר'])}
        ${selectField('מצב משפחתי', 'customer_maritalStatus', ['נשוי/אה','רווק/ה','גרוש/ה','אלמן/ה'])}
      </div>

      <div class="grid3" style="margin-top:10px">
        ${dateField('תאריך לידה', 'customer_birthDate', d.birthDate || '')}
        ${field('נייד', 'customer_mobile', d.mobile || d.phone || '')}
        ${field('מייל', 'customer_email', d.email || '')}
      </div>

      <div class="grid3" style="margin-top:10px">
        <div class="field" style="grid-column: span 2">
          <label>כתובת מלאה</label>
          <input id="customer_addressFull" type="text" placeholder="רחוב ומספר בית" value="${escapeAttr(d.addressFull || '')}"/>
        </div>
        ${field('עיר', 'customer_city', d.city || '')}
      </div>

      <div class="grid2" style="margin-top:10px">
        ${field('מיקוד', 'customer_zip', d.zip || '')}
        <div class="sideHint" style="align-self:end; margin-bottom:4px">מיקוד נשלף אוטומטית לפי כתובת+עיר (אם נמצא)</div>
      </div>

      <div class="grid3" style="margin-top:10px">
        ${field('ת.ז', 'customer_tz', d.tz || '')}
        ${selectField('קופת חולים', 'customer_hmo', ['כללית','מכבי','מאוחדת','לאומית','אחר'])}
        ${selectField('שב״ן', 'customer_shaban', ['כללית פלטינום','כללית זהב','כללית מושלם','מכבי שלי','מכבי זהב','מכבי כסף','מאוחדת שיא','מאוחדת עדיף','לאומית זהב','לאומית כסף'])}
      </div>

      <div class="hr"></div>
      <div class="sectionTitle">נתונים רפואיים בסיסיים</div>

      <div class="grid3">
        ${numField('גובה (ס״מ)', 'customer_heightCm', d.heightCm || '')}
        ${numField('משקל (ק״ג)', 'customer_weightKg', d.weightKg || '')}
        <div class="field">
          <label>BMI</label>
          <div class="bmiCard bmiInline">
            <span>BMI</span>
            <b id="bmiValue">—</b>
            <small id="bmiLabel">הזן גובה + משקל</small>
          </div>
        </div>
      </div>

      <div class="hr"></div>
      <div class="sectionTitle">נוסף</div>

      <div class="grid2">
        ${field('עיסוק', 'customer_occupation', d.occupation || '')}
        ${dateField('הנפקת ת.ז', 'customer_tzIssueDate', d.tzIssueDate || '')}
      </div>

      <div class="hr"></div>
      <div class="sectionTitle">הערות</div>
      <textarea id="customer_notes" placeholder="סיכום שיחה / הערות...">${escapeHtml(d.notes||'')}</textarea>
    `;

    // Set selected values for selects
        setSelectValue('customer_gender', d.gender || '');
    setSelectValue('customer_maritalStatus', d.maritalStatus || '');
    setSelectValue('customer_hmo', d.hmo || '');
    setSelectValue('customer_shaban', d.shaban || '');
// Bind
    bindInput('customer_firstName', v => { d.firstName = v; if(insuredId==='main'){ p.customer.firstName = v; syncDisplayName(p);} });
    bindInput('customer_lastName', v => { d.lastName = v; if(insuredId==='main'){ p.customer.lastName = v; syncDisplayName(p);} });

    bindSelect('customer_gender', v => d.gender = v);
    bindSelect('customer_maritalStatus', v => d.maritalStatus = v);
    bindDate('customer_birthDate', v => d.birthDate = v);

    bindInput('customer_mobile', v => { d.mobile = v; d.phone = v; });
    bindInput('customer_email', v => d.email = v);

    // Address + auto-zip lookup (best-effort)
    const scheduleZip = debounce(async () => {
      const addr = (d.addressFull || '').trim();
      const city = (d.city || '').trim();
      // Need both to improve accuracy
      if(!addr || !city) return;

      const q = encodeURIComponent(`${addr}, ${city}, ישראל`);
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=il&q=${q}`;
      try{
        const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if(!r.ok) return;
        const data = await r.json();
        const pc = data?.[0]?.address?.postcode ? String(data[0].address.postcode) : '';
        if(pc){
          d.zip = pc;
          const el = document.getElementById('customer_zip');
          if(el && el.value !== pc) el.value = pc;
        }
      }catch(err){
        // ignore (offline / blocked / rate-limit)
      }
    }, 800);

    bindInput('customer_addressFull', v => { d.addressFull = v; scheduleZip(); });
    bindInput('customer_city', v => { d.city = v; scheduleZip(); });
    bindInput('customer_zip', v => d.zip = v);

    bindInput('customer_tz', v => d.tz = v);

    bindSelect('customer_hmo', v => d.hmo = v);
    bindSelect('customer_shaban', v => d.shaban = v);

    const updateBMI = () => {
      const h = parseFloat(String(d.heightCm||'').replace(',', '.'));
      const w = parseFloat(String(d.weightKg||'').replace(',', '.'));
      const valEl = $('#bmiValue');
      const labEl = $('#bmiLabel');
      if(!valEl || !labEl) return;
      if(!(h>0) || !(w>0)){
        valEl.textContent = '—';
        labEl.textContent = 'הזן גובה + משקל';
        d.bmi = '';
        return;
      }
      const m = h/100;
      const bmi = w/(m*m);
      const rounded = Math.round(bmi*10)/10;
      d.bmi = String(rounded);
      valEl.textContent = d.bmi;
      let cat = 'תקין';
      if(rounded < 18.5) cat = 'תת־משקל';
      else if(rounded < 25) cat = 'תקין';
      else if(rounded < 30) cat = 'עודף משקל';
      else cat = 'השמנה';
      labEl.textContent = cat;
    };

    bindInput('customer_heightCm', v => { d.heightCm = v; updateBMI(); });
    bindInput('customer_weightKg', v => { d.weightKg = v; updateBMI(); });
bindInput('customer_occupation', v => d.occupation = v);
    bindDate('customer_tzIssueDate', v => d.tzIssueDate = v);
    bindTextarea('customer_notes', v => d.notes = v);

    // Initial BMI render
    updateBMI();
// Keep wizard title in sync
    syncDisplayName(p);
  }

  function renderOldPoliciesStep(){
    const p = wiz.proposal;
    const insuredId = p.activeInsuredId || 'main';
    const insuredLabel = labelInsured(insuredId);

    p.oldPolicies = Array.isArray(p.oldPolicies) ? p.oldPolicies : [];
    p.oldPolicySwitchReasons = Array.isArray(p.oldPolicySwitchReasons) ? p.oldPolicySwitchReasons : [];

    const rows = [];
    p.oldPolicies.forEach((x,idx) => {
      const id = (x && x.insuredId) ? x.insuredId : 'main';
      if(id === insuredId) rows.push({ x, idx });
    });

    wizardMain.innerHTML = `
      <div class="sectionTitle">פוליסות קיימות – ${escapeHtml(insuredLabel)}</div>
      <div class="grid2">
        ${companySelectField('חברה', 'old_company', ['הראל','כלל','מנורה','הפניקס','מגדל','הכשרה','איילון','AIG','ביטוח ישיר'])}
        ${field('מס׳ פוליסה', 'old_policyNo', '')}
      </div>
      <div class="grid3" style="margin-top:10px">
        ${selectField('סוג ביטוח', 'old_product', ['בריאות','ריסק','תאונות אישיות','מחלות קשות','מחלות סרטן','מדיקר','משכנתא'])}
        ${numField('פרמיה חודשית', 'old_premium', '')}
        ${selectField('סטטוס', 'old_decision', ['cancel_full|ביטול מלא','cancel_partial|ביטול חלקי','keep|להשאיר ללא שינוי','appoint|ביצוע מינוי סוכן'])}
      </div>
      <div id="oldCompWrap" style="display:none;margin-top:10px">
        <div class="grid3">
          ${numField('סכום פיצוי', 'old_compensation', '')}
        </div>
      </div>
      <div id="oldSumWrap" style="display:none;margin-top:10px">
        <div class="grid3">
          ${numField('סכום ביטוח', 'old_sumInsured', '')}
        </div>
      </div>

      <div id="oldPartialWrap" style="display:none;margin-top:10px">
        <div class="sideHint">ביטול חלקי: חובה למלא נספחים לביטול.</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn btnSoft" id="oldPartialEditBtn" type="button">מלא / ערוך נספחים לביטול</button>
          <div class="sideHint" id="oldPartialHint" style="display:none;margin:0">✓ נספחים נשמרו</div>
        </div>
      </div>

      <div style="height:10px"></div>
      <button class="btn btnPrimary" id="addOldBtn">+ הוסף פוליסה קיימת</button>

      <div class="hr"></div>
      <div class="tableWrap">
        <table>
          <thead><tr><th>חברה</th><th>מוצר</th><th>מס׳ פוליסה</th><th>פרמיה</th><th>סכום ביטוח</th><th>סכום פיצוי</th><th>סטטוס</th><th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(({x,idx}) => {
              let dec = (x.decision || x.action || 'cancel_full');
              if(dec==='cancel') dec='cancel_full';
              // keep cancel_partial as-is (ביטול חלקי)

              if(dec==='נשאר ללא שינוי') dec='keep';
              if(dec==='לביטול') dec='cancel_full';
                            return `
              <tr>
                <td>${renderCompanyCell(x.company||'')}</td>
                <td>${escapeHtml(x.product||'')}</td>
                <td>${escapeHtml(x.policyNo||'')}</td>
                <td>${money(x.premium||0)}</td>
                <td>${(x.product==='ריסק' || x.product==='משכנתא') ? money(x.sumInsured||0) : '—'}</td>
                <td>${(x.product==='מחלות קשות' || x.product==='מחלות סרטן') ? money(x.compensation||0) : '—'}</td>
                <td style="min-width:200px">
                  <select data-old-decision="${idx}">
                    <option value="cancel_full" ${dec==='cancel_full'?'selected':''}>ביטול מלא</option>
                    <option value="cancel_partial" ${dec==='cancel_partial'?'selected':''}>ביטול חלקי</option>
                    <option value="keep" ${dec==='keep'?'selected':''}>להשאיר ללא שינוי</option>
                    <option value="appoint" ${dec==='appoint'?'selected':''}>ביצוע מינוי סוכן</option>                  </select>
                </td>
                <td><button class="btn btnSoft" data-del-old="${idx}">מחיקה</button></td>
              </tr>`;
            }).join('') : `<tr><td colspan="7" style="color:rgba(18,19,25,.55)">אין פוליסות קיימות למבוטח זה עדיין.</td></tr>`}
          </tbody>
        </table>
      </div>


      <div class="hr"></div>
      <div class="sectionTitle">סיבת החלפה פוליסה בתיק הביטוחי</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">
        ${OLD_POLICY_SWITCH_REASONS.map(r => {
          const checked = (p.oldPolicySwitchReasons||[]).includes(r.key) ? 'checked' : '';
          return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(15,15,20,.12);border-radius:12px;background:#fff">
            <input type="checkbox" data-switch-reason="${r.key}" ${checked}/>
            <span>${escapeHtml(r.label)}</span>
          </label>`;
        }).join('')}
      </div>

      <div class="sideHint" style="margin-top:10px">ℹ️ כאן אתה מתעד את כל הפוליסות הקיימות. סמן לכל אחת: <b>לביטול</b> או <b>נשאר ללא שינוי</b>. עבור מבוטח נוסף – עבור ללשונית שלו למעלה.</div>
    `;

    // Default decision
    setSelectValue('old_decision', 'cancel_full');
    wireCompanySelectLogo('old_company');

    // Compensation (סכום פיצוי) – only for מחלות קשות / מחלות סרטן
    const oldProdSel = $('#old_product');
    const oldCompWrap = $('#oldCompWrap');
    const oldCompInput = $('#old_compensation');
    const oldSumWrap = $('#oldSumWrap');
    const oldSumInput = $('#old_sumInsured');
    const isCompProduct = (prod) => (prod === 'מחלות קשות' || prod === 'מחלות סרטן');
    const syncOldCompUI = () => {
      const prod = oldProdSel ? oldProdSel.value : '';
      const show = isCompProduct(prod);
      if(oldCompWrap) oldCompWrap.style.display = show ? 'block' : 'none';
      if(!show && oldCompInput) oldCompInput.value = '';
    };
    if(oldProdSel) oldProdSel.addEventListener('change', syncOldCompUI);
    syncOldCompUI();

    // Sum insured (סכום ביטוח) – required for ריסק / משכנתא
    const isSumProduct = (prod) => (prod === 'ריסק' || prod === 'משכנתא');
    const syncOldSumUI = () => {
      const prod = oldProdSel ? oldProdSel.value : '';
      const show = isSumProduct(prod);
      if(oldSumWrap) oldSumWrap.style.display = show ? 'block' : 'none';
      if(!show && oldSumInput) oldSumInput.value = '';
    };
    if(oldProdSel) oldProdSel.addEventListener('change', syncOldSumUI);
    syncOldSumUI();

    // Partial cancel (ביטול חלקי) annexes modal
    let partialDraft = '';
    const decisionSel = document.getElementById('old_decision');
    const partialWrap = document.getElementById('oldPartialWrap');
    const partialHint = document.getElementById('oldPartialHint');
    const partialEditBtn = document.getElementById('oldPartialEditBtn');

    const setPartialUI = (show) => {
      if(partialWrap) partialWrap.style.display = show ? 'block' : 'none';
      if(partialHint) partialHint.style.display = (show && String(partialDraft||'').trim()) ? 'block' : 'none';
    };

    const askPartialAnnexes = (onDone) => {
      openPartialCancelModal(partialDraft || '', (txt) => {
        if(txt === null){ onDone && onDone(null); return; }
        partialDraft = String(txt||'').trim();
        setPartialUI(true);
        onDone && onDone(partialDraft);
      });
    };

    if(decisionSel){
      decisionSel.addEventListener('change', () => {
        const v = decisionSel.value;
        if(v === 'cancel_partial'){
          setPartialUI(true);
          // if no draft yet – prompt immediately
          if(!String(partialDraft||'').trim()){
            askPartialAnnexes((res) => {
              if(res === null){
                // user cancelled: revert back to full cancel
                decisionSel.value = 'cancel_full';
                setPartialUI(false);
              }
            });
          }
        }else{
          setPartialUI(false);
          partialDraft = '';
        }
      });
    }
    if(partialEditBtn){
      partialEditBtn.addEventListener('click', () => {
        askPartialAnnexes();
      });
    }
    setPartialUI(false);

    $('#addOldBtn').addEventListener('click', () => {
      const company = $('#old_company').value;
      const product = $('#old_product').value;
      const premium = parseFloat($('#old_premium').value || '0') || 0;
      const compensation = parseFloat((oldCompInput && oldCompInput.value) || '0') || 0;
      const sumInsured = parseFloat((oldSumInput && oldSumInput.value) || '0') || 0;
      const decision = ($('#old_decision') ? $('#old_decision').value : 'cancel_full');
      const policyNo = ($('#old_policyNo') ? String($('#old_policyNo').value||'').trim() : '');
      if(!company || !product){ toast('שגיאה', 'בחר חברה וסוג ביטוח'); return; }
      if(isCompProduct(product) && compensation <= 0){ toast('שגיאה', 'חובה למלא סכום פיצוי למחלות קשות/סרטן'); return; }
      if(isSumProduct(product) && sumInsured <= 0){ toast('שגיאה', 'חובה למלא סכום ביטוח לריסק/משכנתא'); oldSumInput && oldSumInput.focus && oldSumInput.focus(); return; }
      // Partial cancel requires annexes text
      if(decision === 'cancel_partial' && !String(partialDraft||'').trim()){
        toast('חסר', 'בביטול חלקי חובה למלא נספחים לביטול');
        openPartialCancelModal(partialDraft || '', (txt) => {
          if(txt===null) return; // user cancelled
          partialDraft = String(txt||'').trim();
          const hint = document.getElementById('oldPartialHint');
          if(hint) hint.style.display = partialDraft ? 'block' : 'none';
        });
        return;
      }
      p.oldPolicies.push({ insuredId, company, product, policyNo, premium, sumInsured: (isSumProduct(product)? sumInsured : undefined), compensation: (isCompProduct(product)? compensation : undefined), decision, partialCancelAnnexes: (decision==='cancel_partial' ? String(partialDraft||'').trim() : undefined) });
      toast('נוסף', 'פוליסה קיימת נוספה');
      renderOldPoliciesStep();
      updateSums();
      markDraft();
    });

    $$('[data-del-old]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.getAttribute('data-del-old'),10);
      p.oldPolicies.splice(idx,1);
      renderOldPoliciesStep();
      updateSums();
      markDraft();
    }));

    $$('[data-old-decision]').forEach(sel => sel.addEventListener('change', () => {
      const idx = parseInt(sel.getAttribute('data-old-decision'),10);
      const v = sel.value;
      const item = p.oldPolicies[idx];
      if(!item) return;

      const applyLabelToast = () => {
        const label = (v==='keep') ? 'להשאיר ללא שינוי'
          : (v==='appoint') ? 'ביצוע מינוי סוכן'
          : (v==='cancel_partial') ? 'ביטול חלקי'
          : 'ביטול מלא';
        toast('עודכן', 'סטטוס: ' + label);
        markDraft();
      };

      if(v === 'cancel_partial'){
        openPartialCancelModal(String(item.partialCancelAnnexes||''), (txt) => {
          if(txt === null){
            // cancel => revert to full cancel
            sel.value = 'cancel_full';
            item.decision = 'cancel_full';
            applyLabelToast();
            return;
          }
          const cleaned = String(txt||'').trim();
          if(!cleaned){
            sel.value = 'cancel_full';
            item.decision = 'cancel_full';
            toast('חסר', 'בביטול חלקי חובה למלא נספחים לביטול');
            markDraft();
            return;
          }
          item.decision = 'cancel_partial';
          item.partialCancelAnnexes = cleaned;
          applyLabelToast();
        });
        return;
      }

      item.decision = v;
      // keep annexes stored but not used unless status is partial
      applyLabelToast();
    }));
;

    // Reasons for switching / reviewing the insurance portfolio
    $$('[data-switch-reason]').forEach(cb => cb.addEventListener('change', () => {
      const key = cb.getAttribute('data-switch-reason');
      p.oldPolicySwitchReasons = Array.isArray(p.oldPolicySwitchReasons) ? p.oldPolicySwitchReasons : [];
      const has = p.oldPolicySwitchReasons.includes(key);
      if(cb.checked && !has) p.oldPolicySwitchReasons.push(key);
      if(!cb.checked && has) p.oldPolicySwitchReasons = p.oldPolicySwitchReasons.filter(x => x !== key);
      markDraft();
    }));

  }
function renderNewPoliciesStep(){
    const p = wiz.proposal;
    const insuredId = p.activeInsuredId || 'main';
    const insuredLabel = labelInsured(insuredId);

    p.newPolicies = Array.isArray(p.newPolicies) ? p.newPolicies : [];

    const rows = [];
    p.newPolicies.forEach((x,idx) => {
      const id = (x && x.insuredId) ? x.insuredId : 'main';
      if(id === insuredId) rows.push({ x, idx });
    });

    wizardMain.innerHTML = `
      <div class="sectionTitle">פוליסות חדשות – ${escapeHtml(insuredLabel)}</div>
      <div class="grid3">
        ${companySelectField('חברה', 'new_company', ['הראל','כלל','מנורה','הפניקס','מגדל','הכשרה'])}
        ${selectField('מוצר', 'new_product', ['בריאות','ריסק','תאונות אישיות','מחלות קשות','מחלות סרטן','מדיקר','משכנתא'])}
        ${numField('פרמיה חודשית', 'new_premium', '')}
      </div>
      <div id="newSumWrap" style="display:none;margin-top:10px">
        <div class="grid3">
          ${numField('סכום ביטוח', 'new_sumInsured', '')}
        </div>
      </div>

      <div id="newCompWrap" style="display:none;margin-top:10px">
        <div class="grid3">
          ${numField('סכום פיצוי', 'new_compensation', '')}
        </div>
      </div>

      <div id="newLienWrap" style="display:none;margin-top:10px" class="grid2">
        <div class="field" style="grid-column:1/-1">
          <label>שיעבוד פוליסה</label>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="checkbox" id="new_lien" style="width:18px;height:18px" />
            <span style="font-weight:700">סמן וי כדי למלא פרטי שיעבוד</span>
          </div>
          <div class="sideHint" id="newLienHint" style="margin-top:6px;display:none">✓ פרטי שיעבוד נשמרו</div>
        </div>
      </div>
      <div style="height:10px"></div>
      <button class="btn btnPrimary" id="addNewBtn">+ הוסף פוליסה חדשה</button>

      <div class="hr"></div>
      <div class="tableWrap">
        <table>
          <thead><tr><th>חברה</th><th>מוצר</th><th>פרמיה</th><th>סכום ביטוח</th><th>הנחות</th><th>אחרי הנחה</th><th>כיסויים</th><th>שיעבוד</th><th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(({x,idx}) => `
              <tr>
                <td>${renderCompanyCell(x.company)}</td>
                <td>${escapeHtml(x.product)}</td>
                <td>${money(x.premium)}</td>
                <td>${(x.product==='ריסק' || x.product==='משכנתא') ? money(x.sumInsured||0) : ((x.product==='מחלות קשות' || x.product==='מחלות סרטן') ? money(x.compensation||0) : '—')}</td>
                <td>
                  <button class="btn btnSoft" type="button" data-disc-new="${idx}">
                    הנחות${x.discount && (x.discount.tier||'') ? ` (${escapeHtml(String(x.discount.tier||''))})` : (x.discount && (x.discount.types||[]).length ? ' (✓)' : '')}
                  </button>
                </td>
                <td>${money(premiumAfterDiscount(x))}</td>
                <td>${x.product==='בריאות' ? `<button class="btn btnSoft" type="button" data-cov-new="${idx}">בחירת כיסויים${x.coveragesText ? ' (✓)' : ''}</button>` : '—'}</td>
                <td>${(x.product==='ריסק' || x.product==='משכנתא') ? `<button class="btn btnSoft" type="button" data-lien-new="${idx}">שיעבוד${x.lien ? ' (✓)' : ''}</button>` : '—'}</td>
                <td><button class="btn btnSoft" data-del-new="${idx}">מחיקה</button></td>
              </tr>
            `).join('') : `<tr><td colspan="7" style="color:rgba(18,19,25,.55)">אין פוליסות חדשות למבוטח זה עדיין.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="sideHint" style="margin-top:10px">🧠 השאלון הרפואי נבנה לפי פוליסות חדשות של המבוטח הנוכחי בלבד.</div>
    `;


    // Lien (שיעבוד פוליסה) – only for ריסק / משכנתא
    let newLienDraft = null;
    const productSel = $('#new_product');
    const lienWrap = $('#newLienWrap');
    const lienChk = $('#new_lien');
    const sumWrap = $('#newSumWrap');
    const sumInput = $('#new_sumInsured');
    const compWrap = $('#newCompWrap');
    const compInput = $('#new_compensation');

    const isCompProduct = (prod) => (prod === 'מחלות קשות' || prod === 'מחלות סרטן');


    const isLienProduct = (prod) => (prod === 'ריסק' || prod === 'משכנתא');

    const syncSumUI = () => {
      const prod = productSel ? productSel.value : '';
      const show = isLienProduct(prod);
      if(sumWrap) sumWrap.style.display = show ? 'block' : 'none';
      if(!show && sumInput) sumInput.value = '';
    };

    const syncCompUI = () => {
      const prod = productSel ? productSel.value : '';
      const show = isCompProduct(prod);
      if(compWrap) compWrap.style.display = show ? 'block' : 'none';
      if(!show && compInput) compInput.value = '';
    };

    const syncLienUI = () => {
      const prod = productSel ? productSel.value : '';
      const show = isLienProduct(prod);
      if(lienWrap) lienWrap.style.display = show ? 'grid' : 'none';
      syncSumUI();
      syncCompUI();
      if(!show){
        if(lienChk) lienChk.checked = false;
        newLienDraft = null;
      }
    };

    if(productSel) productSel.addEventListener('change', syncLienUI);
    if(lienChk) lienChk.addEventListener('change', () => {
      if(!lienChk.checked){
        newLienDraft = null;
        return;
      }
      openPolicyLienModal(newLienDraft || {}, (payload) => {
        if(payload){
          newLienDraft = payload;
          lienChk.checked = true;
        }else{
          newLienDraft = null;
          lienChk.checked = false;
        }
      });
    });

    syncLienUI();
    wireCompanySelectLogo('new_company');

    $('#addNewBtn').addEventListener('click', () => {
      const company = $('#new_company').value;
      const product = $('#new_product').value;
      const premium = parseFloat($('#new_premium').value || '0') || 0;
      const compensation = parseFloat((compInput && compInput.value) || '0') || 0;
      const sumInsured = parseFloat((sumInput && sumInput.value) || '0') || 0;
      if(!company || !product){ toast('שגיאה', 'בחר חברה ומוצר'); return; }
      if(isLienProduct(product) && sumInsured <= 0){ toast('שגיאה', 'חובה למלא סכום ביטוח לריסק/משכנתא'); return; }
      if(isCompProduct(product) && compensation <= 0){ toast('שגיאה', 'חובה למלא סכום פיצוי למחלות קשות/סרטן'); return; }
      const rec = { insuredId, company, product, premium };
      if(isCompProduct(product)) rec.compensation = compensation;
      if(isLienProduct(product)) rec.sumInsured = sumInsured;
      if(isLienProduct(product) && (lienChk && lienChk.checked) && newLienDraft){ rec.lien = newLienDraft; }
      p.newPolicies.push(rec);
      if(lienChk) lienChk.checked = false;
      newLienDraft = null;
      toast('נוסף', 'רכישה חדשה נוספה');
      renderNewPoliciesStep();
      updateSums();
      markDraft();
    });

    $$('[data-disc-new]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.getAttribute('data-disc-new'),10);
      const pol = p.newPolicies[idx];
      if(!pol) return;
      openPolicyDiscountsModal(pol, (payload) => {
        if(payload){
          pol.discount = payload;
        }else{
          delete pol.discount;
        }
        renderNewPoliciesStep();
        markDraft();
      });
    }));

    
    $$('[data-cov-new]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.getAttribute('data-cov-new'),10);
      const pol = p.newPolicies[idx];
      if(!pol) return;
      openPolicyCoveragesModal(pol, (text) => {
        if(typeof text === 'string' && text.trim()){
          pol.coveragesText = text.trim();
        }else{
          delete pol.coveragesText;
        }
        renderNewPoliciesStep();
        markDraft();
      });
    }));


    $$('[data-lien-new]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.getAttribute('data-lien-new'),10);
      const pol = p.newPolicies[idx];
      if(!pol) return;
      openPolicyLienModal(pol.lien || {}, (payload) => {
        if(payload){
          pol.lien = payload;
        }else{
          delete pol.lien;
        }
        renderNewPoliciesStep();
        markDraft();
      });
    }));

$$('[data-del-new]').forEach(b => b.addEventListener('click', () => {
      const idx = parseInt(b.getAttribute('data-del-new'),10);
      p.newPolicies.splice(idx,1);
      renderNewPoliciesStep();
      updateSums();
      markDraft();
    }));
  }

  function renderMedicalStep(){
    const p = wiz.proposal;
    const insuredId = p.activeInsuredId;

    // Show questionnaire only if this insured has at least one new policy
    const hasAny = p.newPolicies.some(x => x.insuredId === insuredId);
    if(!hasAny){
      wizardMain.innerHTML = `
        <div class="sectionTitle">שאלון רפואי</div>
        <div class="sideHint">אין פוליסות חדשות למבוטח הזה, לכן אין שאלון.</div>
      `;
      return;
    }

    const chosenKey = 'DEFAULT|MEDICAL';
    const qn = questionnaires[chosenKey];
    if(!qn){
      wizardMain.innerHTML = `
        <div class="sectionTitle">שאלון רפואי</div>
        <div class="sideHint">לא נמצא שאלון ברירת מחדל. בדוק את app.js.</div>
      `;
      return;
    }

    // answers bucket: per insured
    p.medical[insuredId] = p.medical[insuredId] || {};
    p.medical[insuredId][chosenKey] = p.medical[insuredId][chosenKey] || {};
    const answers = p.medical[insuredId][chosenKey];

    // sub-stepper inside medical (optional)
    const mSteps = qn.steps;
    // force to 0 if only one screen
    const mIdx = (mSteps.length <= 1) ? 0 : clamp(wiz.medicalStepIndex, 0, mSteps.length-1);
    wiz.medicalStepIndex = mIdx;

    const subStepper = (mSteps.length <= 1) ? '' : `
      <div class="stepper" style="margin-bottom:12px">
        ${mSteps.map((s,idx) => `<div class="step ${idx===mIdx?'active':''}">${escapeHtml(s.title)}</div>`).join('')}
      </div>
    `;

    const step = mSteps[mIdx];

    // Display context (company/product list) for this insured
    const combos = Array.from(new Set(
      p.newPolicies.filter(x => x.insuredId === insuredId).map(x => `${x.company} • ${x.product}`)
    ));

    wizardMain.innerHTML = `
      <div class="sectionTitle">שאלון רפואי – ${escapeHtml(labelInsured(insuredId))}</div>
      <div class="sideHint" style="margin-top:-6px">לפי רכישות: <b>${escapeHtml(combos.join(' | '))}</b></div>
      ${subStepper}
      <div id="medicalForm"></div>
      ${mSteps.length <= 1 ? '' : `
      <div class="hr"></div>
      <div class="grid2">
        <button class="btn btnSoft" id="prevMedicalBtn">חזרה (במסך)</button>
        <button class="btn btnPrimary" id="nextMedicalBtn">המשך (במסך)</button>
      </div>
      `}
`;

    const form = $('#medicalForm');

    if(step.id === 'sum'){
      const summaryLines = Object.entries(answers).map(([k,v]) => `<li><b>${escapeHtml(k)}</b>: ${escapeHtml(String(v))}</li>`).join('');
      form.innerHTML = `
        <div class="sideHint">סיכום תשובות (דמו):</div>
        <ul style="margin:8px 18px">${summaryLines || '<li>אין תשובות עדיין.</li>'}</ul>
      `;
    } else {
      form.innerHTML = step.questions.map(q => renderQuestion(q, answers)).join('');
      step.questions.forEach(q => bindQuestion(q, answers));
    }

    const prevBtn = $('#prevMedicalBtn');
    const nextBtn = $('#nextMedicalBtn');
    if(prevBtn && nextBtn){
      prevBtn.addEventListener('click', () => {
        wiz.medicalStepIndex = clamp(wiz.medicalStepIndex - 1, 0, mSteps.length-1);
        renderMedicalStep();
      });
      nextBtn.addEventListener('click', () => {
        wiz.medicalStepIndex = clamp(wiz.medicalStepIndex + 1, 0, mSteps.length-1);
        renderMedicalStep();
      });
    }
  }

  function renderPayerStep(){
    const p = wiz.proposal;
    if(!p.payer) p.payer = { method:'card', card:{tz:'',name:'',last4:'',exp:'',}, hok:{bank:'',branch:'',account:'',exp:''} };
    if(!p.payer.override) p.payer.override = { enabled:false, firstName:'', lastName:'', tz:'', birthDate:'', relationship:'' };

    const method = p.payer.method || 'card';

    wizardMain.innerHTML = `
      <div class="sectionTitle">פרטי משלם</div>
      <div class="hint">פנימי לנציגה • בחרי שיטת תשלום ומלאי את פרטי המשלם.</div>

      <div class="payOverride" style="margin-top:12px;padding:12px;border:1px solid rgba(15,15,20,.08);border-radius:16px;background:rgba(255,255,255,.75)">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="font-weight:900">משלם חריג</div>
          <label style="display:flex;align-items:center;gap:0;cursor:pointer;user-select:none;margin:0">
            <input id="payer_override_toggle" type="checkbox" style="margin:0" ${p.payer.override && p.payer.override.enabled ? 'checked' : ''} />
          </label>
        </div>
        ${p.payer.override && p.payer.override.enabled ? `
          <div class="grid2" style="margin-top:10px">
            ${field('שם פרטי משלם', 'payer_ov_first', p.payer.override.firstName || '')}
            ${field('שם משפחה משלם', 'payer_ov_last', p.payer.override.lastName || '')}
          </div>
          <div class="grid3" style="margin-top:10px;align-items:end">
            ${field('ת״ז משלם', 'payer_ov_tz', p.payer.override.tz || '', 'numeric')}
            ${dateField('תאריך לידה', 'payer_ov_birthDate', p.payer.override.birthDate || '')}
            <div class="field">
              <div class="label">קרבה</div>
              <div class="value" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <button class="btn btnSoft" id="payerRelBtn" type="button">קרבה: ${escapeHtml(p.payer.override.relationship || 'בחר')}</button>
              </div>
            </div>
          </div>
        ` : `
          <div class="miniNote" style="margin-top:8px">אם המשלם הוא אבא/אמא/אחר — סמני “משלם חריג” ומלאי את פרטיו.</div>
        `}
      </div>

      <div class="payMethods" role="radiogroup" aria-label="שיטת תשלום">
        <button class="payMethod ${method==='card'?'active':''}" data-pay-method="card" type="button">
          <div class="pmTitle">כרטיס אשראי</div>
          <div class="pmSub">ת״ז + שם + מספר כרטיס + תוקף</div>
        </button>
        <button class="payMethod ${method==='hok'?'active':''}" data-pay-method="hok" type="button">
          <div class="pmTitle">הוראת קבע (הו״ק)</div>
          <div class="pmSub">בנק + סניף + מספר חשבון (+ תוקף אופציונלי)</div>
        </button>
      </div>

      <div class="payPanel">
        ${method==='card' ? `
          <div class="grid3">
            ${field('ת״ז בעל הכרטיס', 'payer_card_tz', p.payer.card.tz || '')}
            ${field('שם בעל הכרטיס', 'payer_card_name', p.payer.card.name || '')}
            <div class="field">
              <div class="label">מספר כרטיס (לשימוש פנימי בלבד)</div>
              <div class="value inlineInput">
                <input id="payer_card_number" inputmode="numeric" autocomplete="off" placeholder="מספר כרטיס" type="password"/>
                <button class="btn btnSoft btnTiny" id="toggleCard" type="button">הצג</button>
              </div>
            </div>
          </div>
          <div class="grid3" style="margin-top:10px">
            <div style="grid-column:1/-1">
              ${field('תוקף (MM/YY)', 'payer_card_exp', p.payer.card.exp || '', 'numeric')}
            </div>
          </div>
        ` : `
          <div class="grid3">
            ${field('מספר בנק', 'payer_hok_bank', p.payer.hok.bank || '', 'numeric')}
            ${field('מספר סניף', 'payer_hok_branch', p.payer.hok.branch || '', 'numeric')}
            ${field('מספר חשבון', 'payer_hok_account', p.payer.hok.account || '', 'numeric')}
            ${field('תוקף הרשאה (אופציונלי)', 'payer_hok_exp', p.payer.hok.exp || '')}
          </div>
          <div class="hint" style="margin-top:10px">ניתן להשלים מספרי בנק/סניף/חשבון מהלקוח בזמן השיחה.</div>
        `}
      </div>
    `;

    // Method buttons
    $$('.payMethod').forEach(btn => btn.addEventListener('click', () => {
      const m = btn.dataset.payMethod;
      p.payer.method = m;
      markDraft();
      renderWizard();
    }));

    // Override payer (different payer than insured/customer)
    bindCheck('payer_override_toggle', v => {
      if(!p.payer.override) p.payer.override = { enabled:false, firstName:'', lastName:'', tz:'', birthDate:'', relationship:'' };
      p.payer.override.enabled = v;
      renderWizard(); // re-render to show/hide fields
    });

    // Bind inputs
    bindInput('payer_card_tz', v => p.payer.card.tz = v);
    bindInput('payer_card_name', v => p.payer.card.name = v);
        // Card number is transient: store only last4
    bindInput('payer_card_number', v => {
      const digits = String(v||'').replace(/\D/g,'');
      p.payer.card.last4 = digits.slice(-4);
    });
    bindInput('payer_card_exp', v => p.payer.card.exp = v);
    
    bindInput('payer_hok_bank', v => p.payer.hok.bank = v);
    bindInput('payer_hok_branch', v => p.payer.hok.branch = v);
    bindInput('payer_hok_account', v => p.payer.hok.account = v);
    bindInput('payer_hok_exp', v => p.payer.hok.exp = v);

    // Override payer fields
    bindInput('payer_ov_first', v => { if(!p.payer.override) p.payer.override = { enabled:true, firstName:'', lastName:'', tz:'', birthDate:'', relationship:'' }; p.payer.override.firstName = v; });
    bindInput('payer_ov_last', v => { if(!p.payer.override) p.payer.override = { enabled:true, firstName:'', lastName:'', tz:'', birthDate:'', relationship:'' }; p.payer.override.lastName = v; });
    bindInput('payer_ov_tz', v => { if(!p.payer.override) p.payer.override = { enabled:true, firstName:'', lastName:'', tz:'', birthDate:'', relationship:'' }; p.payer.override.tz = String(v||'').replace(/\D/g,''); 
    bindInput('payer_ov_birthDate', v => { if(!p.payer.override) p.payer.override = { enabled:true, firstName:'', lastName:'', tz:'', birthDate:'', relationship:'' }; p.payer.override.birthDate = v; });});

    const relBtn = $('#payerRelBtn');
    if(relBtn){
      relBtn.addEventListener('click', () => {
        const opts = ['אב','אם','אח','אחות','אחר'];
        const current = (p.payer.override && p.payer.override.relationship) ? p.payer.override.relationship : '';
        // Simple chooser (prompt-like) via small overlay menu
        const overlay = document.createElement('div');
        overlay.style.position='fixed';
        overlay.style.inset='0';
        overlay.style.background='rgba(0,0,0,.18)';
        overlay.style.zIndex='9999';
        overlay.style.display='flex';
        overlay.style.alignItems='center';
        overlay.style.justifyContent='center';
        overlay.innerHTML = `
          <div style="width:min(420px,92vw);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:14px;direction:rtl;font-family:inherit">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
              <div style="font-weight:900">בחירת קרבה</div>
              <button class="btn btnSoft" data-x type="button">סגור</button>
            </div>
            <div class="giCheckPills">
              ${opts.map(o => `<button class="btn ${o===current?'btnPrimary':'btnSoft'}" data-rel="${escapeAttr(o)}" type="button">${escapeHtml(o)}</button>`).join('')}
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
        overlay.querySelector('[data-x]')?.addEventListener('click', close);
        overlay.querySelectorAll('[data-rel]').forEach(b => b.addEventListener('click', () => {
          if(!p.payer.override) p.payer.override = { enabled:true, firstName:'', lastName:'', tz:'', birthDate:'', relationship:'' };
          p.payer.override.relationship = b.dataset.rel || '';
          markDraft();
          close();
          renderWizard();
        }));
      });
    }


    const toggleBtn = $('#toggleCard');
    if(toggleBtn){
      toggleBtn.addEventListener('click', () => {
        const numEl = $('#payer_card_number');
        if(!numEl) return;
        const isHidden = (numEl.type === 'password');
        numEl.type = isHidden ? 'text' : 'password';
        toggleBtn.textContent = isHidden ? 'הסתר' : 'הצג';
        if(isHidden){
          // Auto-hide after 1.2s
          setTimeout(() => {
            const el = $('#payer_card_number');
            if(el && el.type === 'text'){
              el.type = 'password';
              toggleBtn.textContent = 'הצג';
            }
          }, 1200);
        }
      });
    }

    const copyBtn = $('#copyPayment');
    if(copyBtn){
      copyBtn.addEventListener('click', async () => {
        const numEl = $('#payer_card_number');
        const expEl = $('#payer_card_exp');
        const number = (numEl && numEl.value) ? String(numEl.value).trim() : '';
        const exp = (expEl && expEl.value) ? String(expEl.value).trim() : '';
        if(!number || !exp){ toast('חסר', 'מלאי מספר כרטיס ותוקף לפני העתקה'); return; }
        try{
          await navigator.clipboard.writeText(number + ' | ' + exp);
          toast('הועתק', 'מספר+תוקף הועתקו ללוח');
        }catch(e){
          toast('לא הצליח', 'לא הצלחנו להעתיק (אפשר להעתיק ידנית)');
        }
      });
    }

  }



  function renderSummaryStep(){
    const p = wiz.proposal || {};
    // Defensive defaults (so Summary never renders blank)
    p.customer = p.customer || {};
    p.oldPolicies = Array.isArray(p.oldPolicies) ? p.oldPolicies : [];
    p.newPolicies = Array.isArray(p.newPolicies) ? p.newPolicies : [];
    p.insuredList = Array.isArray(p.insuredList) ? p.insuredList : [];
    p.insuredDetails = p.insuredDetails || {};
    p.payer = p.payer || {};
    p.medical = p.medical || {};

    let insuredCards = '';
    let oldBlock = '';
    let newBlock = '';
    let payBlock = '';
    let medBlock = '';

    try{ insuredCards = renderInsuredCardsForSummary(p); } catch(e){ console.error('summary insuredCards', e); insuredCards = '<div class="sideHint">⚠️ שגיאה בטעינת מבוטחים.</div>'; }
    try{ oldBlock = renderPoliciesByInsured(p, 'old'); } catch(e){ console.error('summary oldBlock', e); oldBlock = '<div class="sideHint">⚠️ שגיאה בטעינת פוליסות קיימות.</div>'; }
    try{ newBlock = renderPoliciesByInsured(p, 'new'); } catch(e){ console.error('summary newBlock', e); newBlock = '<div class="sideHint">⚠️ שגיאה בטעינת פוליסות חדשות.</div>'; }
    try{ payBlock = renderPaymentSummary(p); } catch(e){ console.error('summary payBlock', e); payBlock = '<div class="sideHint">⚠️ שגיאה בטעינת אמצעי תשלום.</div>'; }
    try{ medBlock = renderMedicalFullSummary(p); } catch(e){ console.error('summary medBlock', e); medBlock = '<div class="sideHint">⚠️ שגיאה בטעינת שאלונים רפואיים.</div>'; }


    wizardMain.innerHTML = `
      <div class="sectionTitle">סיכום עסקה</div>

      <div class="sideHint">שיקוף מלא של כל הנתונים שהוזנו – לפי מבוטחים.</div>

      <div class="hr"></div>
      <div class="sectionTitle">מבוטחים</div>
      ${insuredCards}

      <div class="hr"></div>
      <div class="sectionTitle">פוליסות לביטול (בחברה נגדית)</div>
      ${oldBlock}

      <div style="margin-top:10px"></div>
      <div class="sectionTitle">סיבת החלפה פוליסה בתיק הביטוחי</div>
      <div class="card" style="margin-top:8px">
        ${
          (Array.isArray(p.oldPolicySwitchReasons) && p.oldPolicySwitchReasons.length)
            ? ('<div style="display:flex;flex-wrap:wrap;gap:8px">' + p.oldPolicySwitchReasons.map(k => {
                const r = OLD_POLICY_SWITCH_REASONS.find(x => x.key === k);
                return `<span class="pill">${escapeHtml(r ? r.label : k)}</span>`;
              }).join('') + '</div>')
            : '<div class="muted">לא נבחרו סיבות.</div>'
        }
      </div>

      <div class="hr"></div>
      <div class="sectionTitle">פוליסות חדשות שנרכשו</div>
      ${newBlock}

      <div class="hr"></div>
      <div class="sectionTitle">אמצעי תשלום</div>
      ${payBlock}

      <div class="hr"></div>
      <div class="sectionTitle">שאלונים (לפי מבוטח)</div>
      ${medBlock}

      <div class="hr"></div>
      <div class="grid2" style="margin-top:10px">
        <button class="btn btnSoft" id="pdfBtn">הדפס / הורד PDF</button>
        <button class="btn btnPrimary" id="markDoneBtn">שמירת הצעה</button>
      </div>
    `;

    const pdfBtnEl = $('#pdfBtn');
    if(pdfBtnEl) pdfBtnEl.addEventListener('click', () => {
      p.pdfGenerated = true;
      openPrintView(p);
      markDraft();
      renderWizard();
      render();
    });

    const markDoneBtnEl = $('#markDoneBtn');
    if(markDoneBtnEl) markDoneBtnEl.addEventListener('click', () => {
      p.status = 'שמורה';
      p.savedAt = new Date().toISOString();

      // Ensure customer exists (proposal is stored on the customer, no separate "Proposals" page)
      let customer = null;
      if(p.customerId){
        customer = state.customers.find(c => c.id === p.customerId) || null;
      }
      if(!customer){
        // Try match by tz if exists
        const tz = (p.customer && p.customer.tz) ? String(p.customer.tz).trim() : '';
        if(tz){
          customer = state.customers.find(c => String(c.tz||'').trim() === tz) || null;
        }
      }
      if(!customer){
        const nid = 'c' + Date.now().toString(36) + Math.random().toString(16).slice(2,6);
        customer = {
          id: nid,
          assignedAgent: state.agentName,
          fullName: (p.customer && p.customer.fullName) ? String(p.customer.fullName).trim() : (p.customerName||'לקוח חדש'),
          tz: (p.customer && p.customer.tz) ? String(p.customer.tz).trim() : '',
          phone: (p.customer && p.customer.phone) ? String(p.customer.phone).trim() : '',
          email: (p.customer && p.customer.email) ? String(p.customer.email).trim() : '',
          status: 'פעיל',
          segment: '',
          createdAt: new Date().toISOString()
        };
        state.customers.unshift(customer);
      }else{
        // Update base identity fields from the proposal
        try{
          if(p.customer && p.customer.fullName) customer.fullName = String(p.customer.fullName).trim();
          if(p.customer && p.customer.tz) customer.tz = String(p.customer.tz).trim();
          if(p.customer && p.customer.phone) customer.phone = String(p.customer.phone).trim();
          if(p.customer && p.customer.email) customer.email = String(p.customer.email).trim();
        }catch(_){}
      }

      // Bind proposal to the customer
      p.customerId = customer.id;
      p.customerName = customer.fullName;
      p.assignedAgent = customer.assignedAgent || state.agentName;
      customer.lastProposalId = p.id;
      customer.lastProposalAt = p.savedAt;
      customer.lastProposalStatus = p.status;

      saveCustomers_();
      saveProposals_();

      if(GOOGLE_SCRIPT_URL){
        syncUpProposal(p).then(()=>toast('סנכרון', 'ההצעה נשמרה לשיטס')).catch(()=>toast('סנכרון', 'שגיאה בסנכרון'));
      }

      toast('נשמר', 'ההצעה נשמרה בכרטיס הלקוח');
      if(savePill) savePill.textContent = p.status;

      // Close wizard and return to Customers
      try{ closeWizard(); }catch(_){}
      try{ state._focusCustomerId = customer.id; }catch(_){}
      setRoute('customers');
    });
  }

  function insuredHasAnyData(p, insuredId){
    if(insuredId === 'main') return true;
    const d = (p.insuredDetails && p.insuredDetails[insuredId]) ? p.insuredDetails[insuredId] : {};
    const hasText = Object.values(d||{}).some(v => String(v||'').trim() !== '');
    const hasPolicies = (p.oldPolicies||[]).some(x => (x.insuredId||'main') === insuredId) || (p.newPolicies||[]).some(x => (x.insuredId||'main') === insuredId);
    const hasMedical = !!(p.medical && p.medical[insuredId] && Object.keys(p.medical[insuredId]||{}).length);
    return hasText || hasPolicies || hasMedical;
  }

  function getInsuredDetailsForSummary(p, insuredId){
    if(insuredId === 'main'){
      // normalize display fields on main
      const c = p.customer || {};
      const fullName = c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      return {
        label: labelInsured(insuredId),
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        fullName: fullName || '—',
        tz: c.tz || '',
        mobile: c.mobile || c.phone || '',
        phone: c.phone || c.mobile || '',
        email: c.email || '',
        birthDate: c.birthDate || '',
        gender: c.gender || '',
        maritalStatus: c.maritalStatus || '',
        hmo: c.hmo || '',
        shaban: c.shaban || '',
        addressFull: c.addressFull || c.address || '',
        city: c.city || '',
        zip: c.zip || '',
        heightCm: c.heightCm || '',
        weightKg: c.weightKg || '',
        smoker: (c.smoker===true || c.smoker==='כן') ? 'כן' : (c.smoker==='לא' ? 'לא' : (c.smoker ? 'כן' : 'לא')),
        smokePerDay: c.smokePerDay || '',
        occupation: c.occupation || '',
        tzIssueDate: c.tzIssueDate || '',
        notes: c.notes || '',
        addressFull: c.addressFull || c.address || '',
        city: c.city || '',
        zip: c.zip || ''
      };
    }
    const d = (p.insuredDetails && p.insuredDetails[insuredId]) ? p.insuredDetails[insuredId] : {};
    const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
    return {
      label: labelInsured(insuredId),
      firstName: d.firstName || '',
      lastName: d.lastName || '',
      fullName: fullName || '—',
      tz: d.tz || '',
      mobile: d.mobile || d.phone || '',
      phone: d.phone || d.mobile || '',
      email: d.email || '',
      birthDate: d.birthDate || '',
      gender: d.gender || '',
      maritalStatus: d.maritalStatus || '',
      hmo: d.hmo || '',
      shaban: d.shaban || '',
      addressFull: d.addressFull || d.address || '',
      city: d.city || '',
      zip: d.zip || '',
      heightCm: d.heightCm || '',
      weightKg: d.weightKg || '',
      smoker: (d.smoker===true || d.smoker==='כן') ? 'כן' : (d.smoker==='לא' ? 'לא' : (d.smoker ? 'כן' : 'לא')),
      smokePerDay: d.smokePerDay || '',
      occupation: d.occupation || '',
      tzIssueDate: d.tzIssueDate || '',
      notes: d.notes || ''
    };
  }

  function renderKV(label, value){
    const v = (value===undefined || value===null || String(value).trim()==='') ? '—' : escapeHtml(String(value));
    return `<div class="miniStat"><span>${escapeHtml(label)}</span><b>${v}</b></div>`;
  }

  function renderInsuredCardsForSummary(p){
    const list = (p.insuredList||[]).filter(ins => insuredHasAnyData(p, ins.id));
    if(!list.length) return `<div class="sideHint">אין מבוטחים.</div>`;
    return `
      <div class="grid2">
        ${list.map(ins => {
          const d = getInsuredDetailsForSummary(p, ins.id);
          return `
            <div class="sideCard" style="box-shadow:none">
              <div class="sideTitle">${escapeHtml(d.label)}</div>
              ${renderKV('שם מלא', d.fullName)}
              ${renderKV('ת״ז', d.tz)}
              ${renderKV('נייד', d.mobile || d.phone)}
              ${renderKV('אימייל', d.email)}
              ${renderKV('תאריך לידה', d.birthDate)}
              ${renderKV('מין', d.gender)}
              ${renderKV('מצב משפחתי', d.maritalStatus)}
              ${renderKV('קופת חולים', d.hmo)}
              ${renderKV('שב״ן', d.shaban)}
              ${renderKV('כתובת מלאה', d.addressFull)}
              ${renderKV('עיר', d.city)}
              ${renderKV('מיקוד', d.zip)}
              ${renderKV('גובה', d.heightCm ? (d.heightCm + ' ס״מ') : '')}
              ${renderKV('משקל', d.weightKg ? (d.weightKg + ' ק״ג') : '')}
              ${renderKV('מעשן', d.smoker)}
              ${d.smoker === 'כן' ? renderKV('כמות ליום', d.smokePerDay) : ''}
              ${renderKV('עיסוק', d.occupation)}
              ${renderKV('הנפקת ת.ז', d.tzIssueDate)}
              ${d.notes ? `<div class="hr" style="margin:10px 0"></div><div class="sideHint"><b>הערות:</b> ${escapeHtml(d.notes)}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderPoliciesByInsured(p, kind){
    const srcRaw = (kind === 'old') ? (p.oldPolicies||[]) : (p.newPolicies||[]);
    // NOTE: In summary we show all existing policies + their status (including "להשאיר ללא שינוי")
    const src = srcRaw;
    const labelEmpty = (kind === 'old') ? 'אין פוליסות לביטול.' : 'אין פוליסות חדשות.';
    const list = (p.insuredList||[]).filter(ins => insuredHasAnyData(p, ins.id));
    const groups = {};
    src.forEach(x => {
      const id = (x.insuredId || 'main');
      (groups[id] = groups[id] || []).push(x);
    });

    const blocks = list.map(ins => {
      const rows = (groups[ins.id] || []);
      if(!rows.length) return '';
      const head = (kind === 'new')
        ? `<tr><th>חברה</th><th>מוצר</th><th>פרמיה</th><th>אחרי הנחה</th><th>כיסויים</th><th>שיעבוד</th></tr>`
        : `<tr><th>חברה</th><th>מוצר</th><th>מס׳ פוליסה</th><th>סטטוס</th><th>נספחים לביטול</th><th>פרמיה</th></tr>`;

      return `
        <div class="sideCard" style="box-shadow:none">
          <div class="sideTitle">${escapeHtml(labelInsured(ins.id))}</div>
          <div class="tableWrap" style="margin-top:6px">
            <table class="table">
              <thead>${head}</thead>
              <tbody>
                ${rows.map(x => {
                  if(kind === 'new'){
                    const after = money(premiumAfterDiscount(x));
                    const cov = x.coveragesText ? escapeHtml(x.coveragesText) : '—';
                    const lien = x.lien ? escapeHtml([x.lien.bankName, x.lien.branch, x.lien.years ? (x.lien.years + ' שנים') : ''].filter(Boolean).join(' • ')) : '—';
                    return `<tr>
                      <td>${renderCompanyCell(x.company||'')}</td>
                      <td>${escapeHtml(x.product||'')}</td>
                      <td>${money(x.premium||0)}</td>
                      <td>${after}</td>
                      <td>${cov}</td>
                      <td>${lien}</td>
                    </tr>`;
                  }
                  const dec = String(x.decision||x.action||'cancel_full');
                    const statusLabel = (dec==='keep') ? 'להשאיר ללא שינוי'
                      : (dec==='appoint') ? 'ביצוע מינוי סוכן'
                      : (dec==='cancel_partial') ? 'ביטול חלקי'
                      : 'ביטול מלא';
                    const pol = String(x.policyNo||'').trim() || '—';
                    const annex = (dec==='cancel_partial') ? String(x.partialCancelAnnexes||'').trim() : '';
                    const annexHtml = annex ? escapeHtml(annex).replace(/\n/g,'<br/>') : '—';
                    return `<tr>
                    <td>${renderCompanyCell(x.company||'')}</td>
                    <td>${escapeHtml(x.product||'')}</td>
                    <td>${escapeHtml(pol)}</td>
                    <td>${escapeHtml(statusLabel)}</td>
                    <td>${annexHtml}</td>
                    <td>${money(x.premium||0)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).filter(Boolean);

    return blocks.length ? blocks.join('') : `<div class="sideHint">${labelEmpty}</div>`;
  }

  function renderPaymentSummary(p){
    const pay = p.payer || null;
    if(!pay) return `<div class="sideHint">לא הוזן אמצעי תשלום.</div>`;
    const method = pay.method || 'card';
    if(method === 'card'){
      const c = pay.card || {};
      return `
        <div class="sideCard" style="box-shadow:none">
          <div class="sideTitle">כרטיס אשראי</div>
          ${renderKV('ת״ז בעל הכרטיס', c.tz)}
          ${renderKV('שם בעל הכרטיס', c.name)}
          ${renderKV('4 ספרות אחרונות', c.last4 ? ('**** ' + c.last4) : '')}
          ${renderKV('תוקף', c.exp)}
        </div>
      `;
    }
    if(method === 'hok'){
      const h = pay.hok || {};
      return `
        <div class="sideCard" style="box-shadow:none">
          <div class="sideTitle">הוראת קבע (הו״ק)</div>
          ${renderKV('בנק', h.bank)}
          ${renderKV('סניף', h.branch)}
          ${renderKV('מספר חשבון', h.account)}
          ${renderKV('תוקף', h.exp)}
        </div>
      `;
    }
    return `<div class="sideHint">אמצעי תשלום לא מזוהה.</div>`;
  }

  function getQuestionLabelMap(){
    // Map question id -> {label, type, details, detailsLabel}
    const map = {};
    const qn = questionnaires['DEFAULT|MEDICAL'];
    if(!qn || !qn.steps) return map;
    qn.steps.forEach(step => {
      (step.questions||[]).forEach(q => {
        map[q.id] = { label:q.label, type:q.type, details:!!q.details, detailsLabel:q.detailsLabel || 'פירוט' };
      });
    });
    return map;
  }

  function renderMedicalFullSummary(p){
    const qMap = getQuestionLabelMap();
    const list = (p.insuredList||[]).filter(ins => insuredHasAnyData(p, ins.id));
    const blocks = [];

    for(const ins of list){
      const bucketSet = p.medical && p.medical[ins.id];
      if(!bucketSet){ continue; }

      // prefer DEFAULT|MEDICAL
      const bucket = bucketSet['DEFAULT|MEDICAL'] || bucketSet[Object.keys(bucketSet)[0]];
      if(!bucket || !Object.keys(bucket).length) continue;

      const rows = [];
      for(const [k,v] of Object.entries(bucket)){
        if(String(k).endsWith('_details')) continue;
        const meta = qMap[k] || null;
        const label = meta ? meta.label : k;
        const val = (v===undefined || v===null || String(v).trim()==='') ? '—' : String(v);
        let extra = '';
        if(meta && meta.details && val === 'כן'){
          const det = bucket[k + '_details'];
          if(det && String(det).trim()!==''){
            extra = ` <span style="color:rgba(18,19,25,.55)">(${escapeHtml(meta.detailsLabel)}: ${escapeHtml(String(det))})</span>`;
          }
        }
        rows.push(`<tr><td style="width:65%">${escapeHtml(label)}</td><td>${escapeHtml(val)}${extra}</td></tr>`);
      }

      blocks.push(`
        <div class="sideCard" style="box-shadow:none">
          <div class="sideTitle">${escapeHtml(labelInsured(ins.id))}</div>
          <div class="tableWrap" style="margin-top:6px">
            <table class="table">
              <thead><tr><th>שאלה</th><th>תשובה</th></tr></thead>
              <tbody>${rows.length ? rows.join('') : `<tr><td colspan="2">אין תשובות</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      `);
    }

    return blocks.length ? blocks.join('') : `<div class="sideHint">אין שאלונים שמולאו עדיין.</div>`;
  }


  function renderMedicalSummary(p){
    const blocks = [];
    for(const insured of p.insuredList){
      const m = p.medical[insured.id];
      if(!m){ continue; }
      const keys = Object.keys(m);
      if(!keys.length) continue;
      blocks.push(`<div class="sideHint"><b>${escapeHtml(insured.label)}:</b> ${keys.map(k => escapeHtml(k==='DEFAULT|MEDICAL' ? 'שאלון רפואי (ברירת מחדל)' : k.replace('|',' • '))).join(', ')}</div>`);
    }
    return blocks.length ? blocks.join('') : `<div class="sideHint">אין תשובות עדיין.</div>`;
  }


  // ---------- PDF (Client-side print to PDF) ----------
  // NOTE: This function is intentionally isolated and MUST NOT mutate app state.
  // It takes a "snapshot" of the proposal and renders a premium, operational (internal) report.
  function openPrintView(proposal){
    const w = window.open('', '_blank');
    if(!w){ toast('חסום', 'הדפדפן חסם חלון קופץ'); return; }

    // Snapshot (deep clone) to avoid accidental mutations
    const p = (() => {
      try { return JSON.parse(JSON.stringify(proposal || {})); }
      catch(_){ return proposal || {}; }
    })();

    try {
      const GOLD = '#caa74a';
      const GOLD_SOFT = '#e6d4a6';

      function esc(v){ return escapeHtml(String(v ?? '').trim() || '—'); }
      function nnum(x){ const v = Number(x); return Number.isFinite(v) ? v : 0; }

      // Insureds
      const insuredList = (p.insuredList || []).filter(ins => insuredHasAnyData(p, ins.id));
      const insuredRows = insuredList.map(ins => {
        const d = getInsuredDetailsForSummary(p, ins.id);
        const h = nnum(d.heightCm);
        const wkg = nnum(d.weightKg);
        const bmi = (h > 0 && wkg > 0) ? (wkg / Math.pow(h/100, 2)) : 0;
        const bmiText = bmi ? (Math.round(bmi*10)/10).toFixed(1) : '—';
        return `
          <tr>
            <td>${esc(d.label)}</td>
            <td>${esc(d.fullName)}</td>
            <td>${esc(d.tz)}</td>
            <td>${esc(d.mobile || d.phone)}</td>
            <td>${esc(d.email)}</td>
            <td>${esc(d.birthDate)}</td>
            <td>${d.gender ? esc(d.gender) : '—'}</td>
            <td>${h ? esc(h + ' ס״מ') : '—'}</td>
            <td>${wkg ? esc(wkg + ' ק״ג') : '—'}</td>
            <td><b>${bmiText}</b></td>
          </tr>
        `;
      }).join('');

      // Policies
      const oldPolicies = Array.isArray(p.oldPolicies) ? p.oldPolicies : [];
      const newPolicies = Array.isArray(p.newPolicies) ? p.newPolicies : [];

      const sumOld = oldPolicies.reduce((a,x)=>a+nnum(x.premium),0);
      const sumNewBefore = newPolicies.reduce((a,x)=>a+nnum(x.premium),0);
      const sumNewAfter = newPolicies.reduce((a,x)=>a+nnum(premiumAfterDiscount(x)),0);
      const sumDiscount = Math.max(0, sumNewBefore - sumNewAfter);

      function discountTier(d){
        const tier = d && d.tier ? String(d.tier).trim() : '';
        return tier && tier !== '0%' ? tier : '—';
      }
      function discountTypes(d){
        const types = (d && Array.isArray(d.types)) ? d.types.filter(Boolean) : [];
        return types.length ? types.map(t => esc(t)).join(' / ') : '—';
      }
      function discountNote(d){
        const note = d && d.note ? String(d.note).trim() : '';
        return note ? esc(note) : '—';
      }

      function splitCoverages(text){
        const s = String(text || '').trim();
        if(!s) return [];
        // Split by newline or comma/bullet
        let parts = s.split(/\r?\n|•|\u2022/).map(x=>x.trim()).filter(Boolean);
        if(parts.length <= 1){
          parts = s.split(/,|;|\|/).map(x=>x.trim()).filter(Boolean);
        }
        return parts.slice(0, 20);
      }

      function coveragesCell(policy){
        const list = splitCoverages(policy && policy.coveragesText);
        if(!list.length) return '—';
        return `<ul class="cellList">${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
      }

      function lienCell(policy){
        const lien = policy && policy.lien ? policy.lien : null;
        if(!lien) return '—';
        const bits = [lien.bankName, lien.branch, lien.years ? (lien.years + ' שנים') : ''].filter(Boolean);
        return bits.length ? esc(bits.join(' • ')) : '—';
      }

      const oldRows = oldPolicies.map(x => {
        const prod = String(x.product||'');
        const sumCell = (prod==='ריסק' || prod==='משכנתא') ? money(nnum(x.sumInsured)) : '—';
        const compCell = (prod==='מחלות קשות' || prod==='מחלות סרטן') ? money(nnum(x.compensation)) : '—';
        const dec = String(x.decision||x.action||'cancel_full');
        const statusLabel = (dec==='keep') ? 'להשאיר ללא שינוי'
          : (dec==='appoint') ? 'ביצוע מינוי סוכן'
          : (dec==='cancel_partial') ? 'ביטול חלקי'
          : 'ביטול מלא';
        const annex = (dec==='cancel_partial') ? String(x.partialCancelAnnexes||'').trim() : '';
        return `
        <tr>
          <td>${esc(labelInsured(x.insuredId || 'main'))}</td>
          <td>${esc(x.company)}</td>
          <td>${esc(x.product)}</td>
          <td>${esc(x.policyNo || '') || '—'}</td>
          <td>${money(nnum(x.premium))}</td>
          <td>${sumCell}</td>
          <td>${compCell}</td>
          <td>${esc(statusLabel)}</td>
          <td>${annex ? esc(annex) : '—'}</td>
        </tr>
      `;
      }).join('') || `<tr><td colspan="9" class="mutedCell">אין פוליסות</td></tr>`;

      const newRows = newPolicies.map(x => {
        const before = nnum(x.premium);
        const after = nnum(premiumAfterDiscount(x));
        const disc = Math.max(0, before - after);
        return `
          <tr>
            <td>${esc(labelInsured(x.insuredId || 'main'))}</td>
            <td>${esc(x.company)}</td>
            <td>${esc(x.product)}</td>
            <td>${coveragesCell(x)}</td>
            <td>${money(before)}</td>
            <td>${esc(discountTier(x.discount))}</td>
            <td>${discountTypes(x.discount)}</td>
            <td>${discountNote(x.discount)}</td>
            <td>${disc ? money(disc) : '—'}</td>
            <td>${money(after)}</td>
            <td>${lienCell(x)}</td>
          </tr>
        `;
      }).join('') || `<tr><td colspan="11" class="mutedCell">אין פוליסות</td></tr>`;

      // Payment (kept compact)
      function paymentSummary(){
        const pay = p.payer || null;
        if(!pay) return '—';
        const method = pay.method || 'card';
        if(method==='card'){
          const c = pay.card || {};
          return `אשראי • ${esc(c.name)} • ${esc(c.tz)} • ${c.last4 ? esc('**** ' + c.last4) : '—'} • ${esc(c.exp)}`;
        }
        if(method==='hok'){
          const h = pay.hok || {};
          return `הו״ק • בנק ${esc(h.bank)} • סניף ${esc(h.branch)} • חשבון ${esc(h.account)}`;
        }
        return '—';
      }

      // Medical (table per insured, only answered)
      function medicalSection(){
        const qMap = getQuestionLabelMap();
        const out = [];

        for(const ins of insuredList){
          const bucketSet = p.medical && p.medical[ins.id];
          if(!bucketSet) continue;
          const bucket = bucketSet['DEFAULT|MEDICAL'] || bucketSet[Object.keys(bucketSet)[0]];
          if(!bucket || !Object.keys(bucket).length) continue;

          const rows = [];
          for(const [k,v] of Object.entries(bucket)){
            if(String(k).endsWith('_details')) continue;
            const meta = qMap[k] || null;
            const label = meta ? meta.label : k;
            const valRaw = (v===undefined || v===null || String(v).trim()==='') ? '—' : String(v);
            let details = '';
            if(meta && meta.details && valRaw === 'כן'){
              const det = bucket[k + '_details'];
              if(det && String(det).trim()!==''){
                details = String(det).trim();
              }
            }
            // Only show rows that have something meaningful
            if(valRaw === '—') continue;
            rows.push(`<tr><td>${esc(label)}</td><td>${esc(valRaw)}</td><td>${details ? esc(details) : '—'}</td></tr>`);
          }

          if(!rows.length) continue;

          out.push(`
            <div class="box">
              <div class="boxTitle">שאלון רפואי — ${esc(labelInsured(ins.id))}</div>
              <table class="t">
                <thead><tr><th>שאלה</th><th>תשובה</th><th>פירוט</th></tr></thead>
                <tbody>${rows.join('')}</tbody>
              </table>
            </div>
          `);
        }

        return out.length ? out.join('') : `<div class="muted">אין שאלונים שמולאו.</div>`;
      }

      // Logo (text-based, premium)
      const logoHtml = `
        <div class="logoWrap">
          <div class="logoWord">GEMEL <span>INVEST</span></div>
          <div class="logoSub">דו״ח תפעולי — פנימי</div>
        </div>
      `;

      const cust = p.customer || {};
      const custName = String(cust.fullName || '').trim();
      const custTz = String(cust.tz || '').trim();
      const custPhone = String(cust.mobile || cust.phone || '').trim();

      const nowText = new Date().toLocaleString('he-IL');

      const html = `
      <html lang="he" dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <title>דו״ח תפעולי - ${escapeHtml(custName)}</title>
        <style>
          :root{
            --gold:${GOLD};
            --goldSoft:${GOLD_SOFT};
            --ink:#15161c;
            --muted:rgba(21,22,28,.62);
            --line:rgba(21,22,28,.10);
            --zebra:#fbfbfc;
          }
          @page{ size: A4 landscape; margin: 12mm; }
          *{ box-sizing:border-box; }
          body{ font-family: Arial, sans-serif; color:var(--ink); margin:0; background:#fff; }
          .page{ padding: 14px 14px 10px; }
          .topbar{
            display:flex; align-items:flex-end; justify-content:space-between;
            border-bottom: 2px solid var(--goldSoft);
            padding-bottom: 10px; margin-bottom: 12px;
          }
          .logoWrap{ text-align:right; }
          .logoWord{ font-weight:900; letter-spacing:.6px; font-size:22px; color:var(--gold); }
          .logoWord span{ color:var(--ink); font-weight:900; }
          .logoSub{ margin-top:2px; font-size:11px; color:var(--muted); }
          .meta{ text-align:left; font-size:11px; color:var(--muted); line-height:1.35; }
          .meta b{ color:var(--ink); font-weight:700; }
          .kpis{ display:grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap:10px; margin: 10px 0 14px; }
          .kpi{
            border:1px solid var(--line); border-radius:12px; padding:10px 10px;
            background:linear-gradient(180deg, #fff, #fff);
          }
          .kpi .k{ font-size:11px; color:var(--muted); margin-bottom:4px; }
          .kpi .v{ font-size:16px; font-weight:900; color:var(--ink); }
          .kpi.gold{ border-color: var(--goldSoft); box-shadow: 0 0 0 2px rgba(202,167,74,.08) inset; }
          .kpi.gold .v{ color:var(--gold); }
          h2{
            margin: 14px 0 8px;
            font-size: 13px;
            letter-spacing:.2px;
            padding-bottom:6px;
            border-bottom:1px solid var(--line);
          }
          table.t{ width:100%; border-collapse:collapse; }
          table.t th, table.t td{
            border:1px solid var(--line);
            padding:7px 8px;
            font-size:11.5px;
            vertical-align:top;
            text-align:right;
          }
          table.t th{
            background: #fffaf0;
            color: var(--ink);
            font-weight:800;
          }
          table.t tbody tr:nth-child(even) td{ background: var(--zebra); }
          .muted{ color:var(--muted); font-size:11px; }
          .sumRow td{
            font-weight:900;
            background: #fffaf0 !important;
          }
          .sumRow td.sumGold{ color:var(--gold); }
          .box{ border:1px solid var(--line); border-radius:12px; padding:10px; margin: 10px 0; }
          .boxTitle{ font-weight:900; font-size:12px; margin-bottom:8px; color:var(--gold); }
          .cellList{ margin:0; padding:0 16px 0 0; }
          .cellList li{ margin:0; padding:0; line-height:1.25; }
          .mutedCell{ color:var(--muted); text-align:center; }
          .footer{
            margin-top: 12px;
            display:flex; justify-content:space-between; align-items:center;
            border-top:1px solid var(--line);
            padding-top:8px;
            font-size:10.5px;
            color:var(--muted);
          }
          .badge{
            display:inline-block;
            padding:2px 8px;
            border-radius:999px;
            border:1px solid var(--goldSoft);
            color:var(--gold);
            font-weight:800;
            font-size:10px;
          }
          @media print{
            .page{ padding:0; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="topbar">
            ${logoHtml}
            <div class="meta">
              <div><b>תאריך יצוא:</b> ${esc(nowText)}</div>
              <div><b>נציג:</b> ${esc(p.assignedAgent || p.agentName || '')}</div>
              <div><b>לקוח:</b> ${esc(custName)} ${custTz ? (' • ת״ז ' + esc(custTz)) : ''} ${custPhone ? (' • ' + esc(custPhone)) : ''}</div>
              <div><span class="badge">לשימוש פנימי</span></div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi"><div class="k">סה״כ פרמיה קיימת</div><div class="v">${money(sumOld)}</div></div>
            <div class="kpi"><div class="k">סה״כ פרמיה חדשה (לפני)</div><div class="v">${money(sumNewBefore)}</div></div>
            <div class="kpi gold"><div class="k">סה״כ הנחות</div><div class="v">${money(sumDiscount)}</div></div>
            <div class="kpi"><div class="k">סה״כ פרמיה חדשה (אחרי)</div><div class="v">${money(sumNewAfter)}</div></div>
            <div class="kpi"><div class="k">כמות פוליסות (קיימות / חדשות)</div><div class="v">${oldPolicies.length} / ${newPolicies.length}</div></div>
          </div>

          <h2>מבוטחים</h2>
          <table class="t">
            <thead>
              <tr>
                <th>סוג מבוטח</th><th>שם</th><th>ת״ז</th><th>נייד</th><th>אימייל</th>
                <th>תאריך לידה</th><th>מין</th><th>גובה</th><th>משקל</th><th>BMI</th>
              </tr>
            </thead>
            <tbody>
              ${insuredRows || `<tr><td colspan="10" class="mutedCell">אין מבוטחים</td></tr>`}
            </tbody>
          </table>

          <h2>פוליסות קיימות</h2>
          <table class="t">
            <thead><tr><th>מבוטח</th><th>חברה</th><th>מוצר</th><th>מס׳ פוליסה</th><th>פרמיה חודשית</th><th>סכום ביטוח</th><th>סכום פיצוי</th><th>סטטוס</th><th>נספחים לביטול</th></tr></thead>
            <tbody>
              ${oldRows}
              <tr class="sumRow">
                <td colspan="8">סה״כ</td><td class="sumGold">${money(sumOld)}</td>
              </tr>
            </tbody>
          </table>

          <h2>פוליסות חדשות (כולל הנחות)</h2>
          <table class="t">
            <thead>
              <tr>
                <th>מבוטח</th><th>חברה</th><th>מוצר</th><th>כיסויים</th>
                <th>פרמיה לפני</th><th>מדורג</th><th>סוג הנחה</th><th>פירוט הנחה</th>
                <th>סכום הנחה</th><th>פרמיה אחרי</th><th>שיעבוד</th>
              </tr>
            </thead>
            <tbody>
              ${newRows}
              <tr class="sumRow">
                <td colspan="4">סה״כ</td>
                <td>${money(sumNewBefore)}</td>
                <td colspan="2"></td>
                <td class="sumGold">סה״כ הנחות: ${money(sumDiscount)}</td>
                <td>${money(sumDiscount)}</td>
                <td class="sumGold">${money(sumNewAfter)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <h2>אמצעי תשלום</h2>
          <div class="muted">${esc(paymentSummary())}</div>

          <h2>שאלון רפואי</h2>
          ${medicalSection()}

          <div class="footer">
            <div>כדי לשמור כ־PDF: הדפס → Save as PDF</div>
            <div>${esc('GEMEL INVEST')}</div>
          </div>

          <script>window.print();</script>
        </div>
      </body></html>
      `;

      w.document.open();
      w.document.write(html);
      w.document.close();

    } catch(e){
      console.error(e);
      try{
        w.document.open();
        w.document.write(`<html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>שגיאה</title></head>
          <body style="font-family:Arial;padding:18px">
            <h2>שגיאה ביצירת קובץ הסיכום</h2>
            <div class="muted" style="margin-top:8px">פתח קונסול (F12) כדי לראות פרטים.</div>
          </body></html>`);
        w.document.close();
      }catch(_){}
      toast('שגיאה', 'לא הצלחתי ליצור PDF. נסה שוב');
    }
  }



  // ---------- Completion (What is missing) ----------
  function computeCompletion(p){
    const cust = p.customer || {};

    // Customer: rely on name + ID + phone.
    // (birthDate/gender are not always collected in the current flow)
    const fullName = String(cust.fullName || ((cust.firstName||'') + ' ' + (cust.lastName||'')).trim()).trim();
    const hasName = !!fullName;
    const hasTz = !!String(cust.tz || '').trim();
    const hasPhone = !!String(cust.mobile || cust.phone || '').trim();
    const okCustomer = hasName && hasTz && hasPhone;

    const okOld = Array.isArray(p.oldPolicies) && p.oldPolicies.length > 0;
    const okNew = Array.isArray(p.newPolicies) && p.newPolicies.length > 0;

    // Medical: require at least one answered field for each insured
    const insuredList = Array.isArray(p.insuredList) ? p.insuredList : [];
    let okMedical = true;
    if(insuredList.length){
      for(const ins of insuredList){
        const bucket = p.medical && p.medical[ins.id] && (p.medical[ins.id]['DEFAULT|MEDICAL'] || p.medical[ins.id][Object.keys(p.medical[ins.id])[0]]);
        const hasAny = bucket && Object.keys(bucket).length > 0;
        if(!hasAny){ okMedical = false; break; }
      }
    } else {
      okMedical = false;
    }

    const payer = p.payer || {};
    const method = payer.method || '';

    // Card number is intentionally NOT stored (only last4), so completion must check last4.
    const baseOkPayer = (method === 'card')
      ? !!(payer.card && payer.card.tz && payer.card.name && payer.card.exp && payer.card.last4)
      : (method === 'hok')
        ? !!(payer.hok && payer.hok.bank && payer.hok.branch && payer.hok.account)
        : false;

    const ov = payer.override || {};
    const okOverride = !ov.enabled ? true : !!(String(ov.firstName||'').trim() && String(ov.lastName||'').trim() && String(ov.tz||'').trim() && String(ov.relationship||'').trim());

    const okPayer = baseOkPayer && okOverride;

    const okPdf = !!p.pdfGenerated;

    const items = [
      { key:'customer', label:'פרטי לקוח', ok: okCustomer },
      { key:'old', label:'פוליסות', ok: okOld },
      { key:'new', label:'רכישות', ok: okNew },
      { key:'medical', label:'שאלון', ok: okMedical },
      { key:'payer', label:'משלם', ok: okPayer },
      { key:'pdf', label:'PDF', ok: okPdf },
    ];

    const done = items.filter(i => i.ok).length;
    const total = items.length;
    let level = 'bad';
    if(done === total) level = 'ok';
    else if(done >= Math.ceil(total/2)) level = 'mid';
    return { items, done, total, level };
  }

  function proposalProgressCell(p){
    const comp = computeCompletion(p);
    return `<div class="compRow"><span class="compBadge ${comp.level}"><span class="compDot"></span>${comp.done}/${comp.total}</span></div>`;
  }

  function customerProgressCell(customerId){
    const rel = state.proposals.filter(p => p.customerId === customerId || (p.customer && p.customer.id === customerId));
    if(!rel.length) return '<span style="color:rgba(18,19,25,.55);font-size:12px">—</span>';
    const p = rel[0];
    const comp = computeCompletion(p);
    // compact: show done/total + 3 key badges
    const keyMap = ['customer','medical','pdf'];
    const chips = comp.items.filter(i => keyMap.includes(i.key)).map(i => {
      const cls = i.ok ? 'ok' : 'bad';
      return `<span class="compBadge ${cls}" title="${escapeAttr(i.label + ': ' + (i.ok?'הושלם':'חסר'))}"><span class="compDot"></span>${escapeHtml(i.label)}</span>`;
    }).join('');
    return `<div class="compRow"><span class="compBadge ${comp.level}"><span class="compDot"></span>${comp.done}/${comp.total}</span>${chips}</div>`;
  }

  function renderCompletionBadges(comp){
    return `<div class="compRow">` + comp.items.map(i => {
      const cls = i.ok ? 'ok' : 'bad';
      return `<span class="compBadge ${cls}" title="${escapeAttr(i.label + ': ' + (i.ok?'הושלם':'חסר'))}"><span class="compDot"></span>${escapeHtml(i.label)}</span>`;
    }).join('') + `</div>`;
  }

  // ---------- Helpers ----------
  function renderSmallList(items){
    if(!items.length) return `<div class="sideHint">אין פריטים.</div>`;
    return `<ul style="margin:8px 18px">${items.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
  }

  function field(label, id, value){
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <input id="${id}" value="${escapeHtml(value||'')}" />
      </div>
    `;
  }

  function numField(label, id, value){
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <input id="${id}" type="number" inputmode="decimal" placeholder="0" value="${escapeHtml(value||'')}" />
      </div>
    `;
  }

  function selectField(label, id, options){
    const opts = options.map(o => {
      const [val, text] = String(o).includes('|') ? String(o).split('|') : [o,o];
      return `<option value="${escapeAttr(val)}">${escapeHtml(text)}</option>`;
    }).join('');
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <select id="${id}">${opts}</select>
      </div>
    `;
  }


  function companySelectField(label, id, options){
    const opts = options.map(o => {
      const [val, text] = String(o).includes('|') ? String(o).split('|') : [o,o];
      return `<option value="${escapeAttr(val)}">${escapeHtml(text)}</option>`;
    }).join('');
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <div class="coSelectRow">
          <select id="${id}">${opts}</select>
          <img class="coLogo coLogoSelect" id="${id}_logo" alt="" />
        </div>
      </div>
    `;
  }


  function dateField(label, id, value){
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <input id="${id}" type="date" value="${escapeAttr(value||'')}" />
      </div>
    `;
  }

  
  function setSelect(id, value){
    // Backward compatible alias (older code used setSelect)
    setSelectValue(id, value);
  }

function setSelectValue(id, value){
    const el = document.getElementById(id);
    if(!el) return;
    if(value && Array.from(el.options).some(o => o.value === value)){
      el.value = value;
    }
  }

  function bindSelect(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('change', () => {
      onChange(el.value);
      markDraft();
    });
  }


  function bindDate(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('change', () => {
      onChange(el.value);
      markDraft();
    });
  }


  function toggleSmokeRow(show){
    const row = document.getElementById('smokeRow');
    if(!row) return;
    row.style.display = show ? 'grid' : 'none';
  }

  function syncDisplayName(p){
    const fn = (p.customer.firstName || '').trim();
    const ln = (p.customer.lastName || '').trim();
    const full = (fn + ' ' + ln).trim();
    p.customer.fullName = full;
    p.customerName = full;
    const titleEl = document.getElementById('wizardTitle');
    if(titleEl) titleEl.textContent = full ? `הצעה – ${full}` : 'הצעה חדשה';
  }

  function bindInput(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('input', () => {
      onChange(el.value);
      markDraft();
    });
  }

  function bindCheck(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('change', () => {
      onChange(!!el.checked);
      markDraft();
    });
  }

  function bindTextarea(id, onChange){
    const el = $('#'+id);
    if(!el) return;
    el.addEventListener('input', () => {
      onChange(el.value);
      markDraft();
    });
  }


  function markDraft(){
    if(!wiz) return;
    wiz.proposal.status = 'טיוטה';
    if(savePill) savePill.textContent = 'טיוטה';
    updateSums();
    saveProposals_();
  }

  function updateSums(){
    if(!wiz) return;
    const p = wiz.proposal;
    const oldSum = p.oldPolicies.reduce((a,x)=>a+(+x.premium||0),0);
    const newSum = p.newPolicies.reduce((a,x)=>a+(+x.premium||0),0);
    sumOld.textContent = money(oldSum);
    sumNew.textContent = money(newSum);
    sumTotal.textContent = money(oldSum + newSum);
  }

  function labelInsured(id){
    const it = (wiz && wiz.proposal.insuredList.find(x => x.id === id)) || state.proposals[0]?.insuredList?.find(x=>x.id===id);
    if(it) return it.label;
    if(id==='main') return 'מבוטח ראשי';
    if(id==='spouse') return 'בן/בת זוג';
    if(id==='child') return 'ילד';
    return 'מבוטח';
  }

  function chip(text, kind){
    const cls = kind || (text === 'פעיל' ? 'ok' : 'warn');
    return `<span class="chip ${cls}">${escapeHtml(text)}</span>`;
  }

  function money(n){
    const v = (Math.round((Number(n)||0)*100)/100).toFixed(0);
    return v.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ₪';
  }

function premiumAfterDiscount(policy){
    const prem = Number(policy && policy.premium) || 0;
    const tier = policy && policy.discount && policy.discount.tier ? String(policy.discount.tier) : '';
    const m = tier.match(/(\d+(?:\.\d+)?)\s*%/);
    const rate = m ? Math.max(0, Math.min(0.9, parseFloat(m[1]) / 100)) : 0;
    return prem * (1 - rate);
  }

// ---------- Discounts (per policy) ----------
function summarizeDiscount(d){
  if(!d) return '';
  const parts = [];
  if(d.tier && String(d.tier).trim() && String(d.tier).trim() !== '0%') parts.push('מדורג: ' + String(d.tier).trim());
  if(Array.isArray(d.types) && d.types.length) parts.push(d.types.join(' / '));
  if(d.note && String(d.note).trim()) parts.push(String(d.note).trim());
  return parts.join(' | ');
}

function openPolicyDiscountsModal(policy, onSave){
  const current = policy && policy.discount ? policy.discount : { tier:'', types:[], note:'' };
  const TIERS = ['','5%','10%','15%','20%','25%','30%','45%','60%','70%'];
  const TYPES = [
    'הנחת סוכן',
    'אחר'
  ];

  const overlay = document.createElement('div');
  overlay.style.position='fixed';
  overlay.style.inset='0';
  overlay.style.background='rgba(0,0,0,0.18)';
  overlay.style.zIndex='10050';
  overlay.style.display='flex';
  overlay.style.alignItems='center';
  overlay.style.justifyContent='center';
  overlay.style.padding='18px';

  const esc = (s)=>escapeHtml(String(s||''));
  overlay.innerHTML = `
    <div class="giModal">
      <div class="giModalHead">
        <div class="giModalTitle">הנחות לפוליסה</div>
        <button class="btn btnSoft" type="button" data-x>סגור</button>
      </div>

      <div class="field">
        <label>הנחה מדורגת (אחוז)</label>
        <select id="discTier">
          ${TIERS.map(t => `<option value="${esc(t)}" ${String(current.tier||'')===String(t)?'selected':''}>${t?esc(t):'ללא'}</option>`).join('')}
        </select>
      </div>

      <div class="field" style="margin-top:10px">
        <label>סוגי הנחה</label>
        <div class="giCheckPills">
          ${TYPES.map(t => {
            const checked = (current.types||[]).includes(t);
            return `
              <label class="giCheckPill">
                <input type="checkbox" value="${esc(t)}" ${checked?'checked':''} style="width:16px;height:16px"/>
                <span>${esc(t)}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <div class="field" style="margin-top:10px">
        <label>פירוט (אופציונלי)</label>
        <textarea id="discNote" placeholder="כתוב במילים מה ההנחה שניתנה...">${esc(current.note||'')}</textarea>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-start;margin-top:12px;flex-wrap:wrap">
        <button class="btn btnPrimary" type="button" data-save>שמירה</button>
        <button class="btn btnSoft" type="button" data-spec>מפרט פוליסות עדכני של חברות הביטוח</button>
        <button class="btn btnSoft" type="button" data-clear>ניקוי הנחות</button>
      </div>
    </div>
  `;

  const close = () => { overlay.remove(); };
  overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
  overlay.querySelector('[data-x]').addEventListener('click', close);

  overlay.querySelector('[data-clear]').addEventListener('click', () => {
    onSave(null);
    close();
  });

  overlay.querySelector('[data-spec]').addEventListener('click', () => {
    // capture current selections (even if user didn't click save yet)
    const tier = overlay.querySelector('#discTier').value || '';
    const types = Array.from(overlay.querySelectorAll('input[type="checkbox"]'))
      .filter(x => x.checked).map(x => x.value);
    const note = overlay.querySelector('#discNote').value || '';
    const payload = (tier || types.length || note.trim()) ? { tier, types, note } : null;

    openPolicySpecOverlay({
      source: 'policy-discounts-modal',
      policy: policy || null,
      discount: payload
    });
  });

  overlay.querySelector('[data-save]').addEventListener('click', () => {
    const tier = overlay.querySelector('#discTier').value || '';
    const types = Array.from(overlay.querySelectorAll('input[type="checkbox"]'))
      .filter(x => x.checked).map(x => x.value);
    const note = overlay.querySelector('#discNote').value || '';
    const payload = (tier || types.length || note.trim()) ? { tier, types, note } : null;
    onSave(payload);
    close();
  });

  document.body.appendChild(overlay);
}

function openPolicySpecOverlay(context){
  const url = (typeof POLICY_SPEC_URL === 'string' && POLICY_SPEC_URL.trim()) ? POLICY_SPEC_URL.trim() : '';
  if(!url){
    alert('לא הוגדר קישור למפרט הפוליסות. אנא עדכן POLICY_SPEC_URL בקובץ app.js');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.position='fixed';
  overlay.style.inset='0';
  overlay.style.background='rgba(0,0,0,0.22)';
  overlay.style.zIndex='10080';
  overlay.style.display='flex';
  overlay.style.alignItems='center';
  overlay.style.justifyContent='center';
  overlay.style.padding='14px';

  const safeTitle = 'מפרט פוליסות עדכני של חברות הביטוח';
  overlay.innerHTML = `
    <div class="giModal" style="width:min(1200px, 96vw);height:min(92vh, 900px);display:flex;flex-direction:column">
      <div class="giModalHead" style="flex:0 0 auto">
        <div class="giModalTitle">${escapeHtml(safeTitle)}</div>
        <button class="btn btnSoft" type="button" data-x>סגור</button>
      </div>
      <div style="flex:1 1 auto;min-height:0;display:flex;border-radius:14px;overflow:hidden;border:1px solid rgba(0,0,0,0.08)">
        <iframe title="${escapeHtml(safeTitle)}" src="${escapeHtml(url)}" style="border:0;width:100%;height:100%;background:#fff"></iframe>
      </div>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
  overlay.querySelector('[data-x]').addEventListener('click', close);

  const iframe = overlay.querySelector('iframe');
  iframe.addEventListener('load', () => {
    try{
      iframe.contentWindow && iframe.contentWindow.postMessage({
        type: 'GEMEL_INVEST_POLICY_SPEC_CONTEXT',
        context: context || null
      }, '*');
    }catch(_){}
  });

  document.body.appendChild(overlay);
}

function openPolicyCoveragesModal(policy, onSave){
  const current = policy && policy.coveragesText ? String(policy.coveragesText) : '';
  const overlay = document.createElement('div');
  overlay.style.position='fixed';
  overlay.style.inset='0';
  overlay.style.background='rgba(0,0,0,0.18)';
  overlay.style.zIndex='10050';
  overlay.style.display='flex';
  overlay.style.alignItems='center';
  overlay.style.justifyContent='center';
  overlay.style.padding='18px';

  const esc = (s)=>escapeHtml(String(s||''));
  overlay.innerHTML = `
    <div style="width:min(620px,95vw);background:rgba(255,255,255,0.98);border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,0.28);padding:14px;direction:rtl;font-family:inherit">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div style="font-weight:900">בחירת כיסויים</div>
        <button class="btn btnSoft" type="button" data-x>סגור</button>
      </div>

      <div class="field">
        <label>רשום את הכיסויים שנבחרו (אפשר להפריד בפסיקים/שורות)</label>
        <textarea id="covText" rows="6" placeholder="לדוגמה: ניתוחים בישראל, תרופות, השתלות..." style="width:100%">${esc(current)}</textarea>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button class="btn btnSoft" type="button" data-cancel>ביטול</button>
        <button class="btn btnPrimary" type="button" data-save>שמור</button>
      </div>
    </div>
  `;

  const close = () => { overlay.remove(); };
  overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
  overlay.querySelector('[data-x]').addEventListener('click', close);
  overlay.querySelector('[data-cancel]').addEventListener('click', () => { close(); onSave && onSave(null); });
  overlay.querySelector('[data-save]').addEventListener('click', () => {
    const val = overlay.querySelector('#covText').value || '';
    close();
    onSave && onSave(val);
  });

  document.body.appendChild(overlay);
}


function openPartialCancelModal(currentText, onSave){
  const overlay = document.createElement('div');
  overlay.style.position='fixed';
  overlay.style.inset='0';
  overlay.style.background='rgba(0,0,0,0.18)';
  overlay.style.zIndex='10060';
  overlay.style.display='flex';
  overlay.style.alignItems='center';
  overlay.style.justifyContent='center';
  overlay.style.padding='18px';

  const esc = (s)=>escapeHtml(String(s||''));
  overlay.innerHTML = `
    <div style="width:min(680px,95vw);background:rgba(255,255,255,0.98);border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,0.28);padding:14px;direction:rtl;font-family:inherit">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div>
          <div style="font-weight:900">ביטול חלקי</div>
          <div style="font-size:12px;color:rgba(18,19,25,.55);margin-top:2px">רשום את הנספחים לביטול (אפשר שורות / פסיקים)</div>
        </div>
        <button class="btn btnSoft" type="button" data-x>סגור</button>
      </div>

      <div class="field">
        <label>נספחים לביטול</label>
        <textarea id="annexesText" rows="7" placeholder="לדוגמה: נספח אמבולטורי, כתב שירות, תרופות..." style="width:100%">${esc(currentText||'')}</textarea>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button class="btn btnSoft" type="button" data-cancel>ביטול</button>
        <button class="btn btnPrimary" type="button" data-save>שמור</button>
      </div>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
  overlay.querySelector('[data-x]').addEventListener('click', close);
  overlay.querySelector('[data-cancel]').addEventListener('click', () => { close(); onSave && onSave(null); });
  overlay.querySelector('[data-save]').addEventListener('click', () => {
    const val = String(overlay.querySelector('#annexesText').value || '').trim();
    close();
    onSave && onSave(val);
  });

  document.body.appendChild(overlay);
}

function openPolicyLienModal(current, onSave){
  const data = current || {};
  // Backwards compatibility: if no kind provided, infer
  const inferredKind = data.kind || (data.hp || data.businessName || data.businessAddress ? 'other' : 'bank');
  const overlay = document.createElement('div');
  overlay.style.position='fixed';
  overlay.style.inset='0';
  overlay.style.background='rgba(0,0,0,0.18)';
  overlay.style.zIndex='10050';
  overlay.style.display='flex';
  overlay.style.alignItems='center';
  overlay.style.justifyContent='center';
  overlay.style.padding='18px';

  const esc = (s)=>escapeHtml(String(s||''));
  overlay.innerHTML = `
    <div style="width:min(680px,95vw);background:rgba(255,255,255,0.98);border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,0.28);padding:14px;direction:rtl;font-family:inherit">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div style="font-weight:900">שיעבוד פוליסה</div>
        <button class="btn btnSoft" type="button" data-x>סגור</button>
      </div>

      <div class="sideHint" style="margin-top:-4px;margin-bottom:10px">בחר סוג משעבד:</div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btnSoft" type="button" data-kind="bank">בנק</button>
        <button class="btn btnSoft" type="button" data-kind="other">אחר</button>
      </div>

      <div id="lienBank" style="display:none">
        <div class="grid2">
          <div class="field">
            <label>שם הבנק המשעבד</label>
            <input id="l_bankName" value="${esc(data.bankName||'')}" placeholder="לדוגמה: לאומי" />
          </div>
          <div class="field">
            <label>מספר בנק</label>
            <input id="l_bankNumber" value="${esc(data.bankNumber||'')}" placeholder="לדוגמה: 10" />
          </div>
          <div class="field">
            <label>מספר סניף</label>
            <input id="l_branchNumber" value="${esc(data.branchNumber||data.branch||'')}" placeholder="לדוגמה: 123" />
          </div>
          <div class="field">
            <label>כתובת סניף</label>
            <input id="l_branchAddress" value="${esc(data.branchAddress||'')}" placeholder="כתובת מלאה" />
          </div>
          <div class="field" style="grid-column:1/-1">
            <label>בנק משעבד (אם שונה)</label>
            <input id="l_lienHolder" value="${esc(data.lienHolder||'')}" placeholder="אופציונלי" />
          </div>
          <div class="field">
            <label>לכמה שנים</label>
            <input id="l_years_bank" type="number" min="0" step="1" value="${esc(data.years||'')}" placeholder="למשל 20" />
          </div>
        </div>
      </div>

      <div id="lienOther" style="display:none">
        <div class="grid2">
          <div class="field">
            <label>ח.פ.</label>
            <input id="l_hp" value="${esc(data.hp||'')}" placeholder="לדוגמה: 512345678" />
          </div>
          <div class="field">
            <label>שם העסק המשעבד</label>
            <input id="l_businessName" value="${esc(data.businessName||'')}" placeholder="שם העסק" />
          </div>
          <div class="field" style="grid-column:1/-1">
            <label>כתובת</label>
            <input id="l_businessAddress" value="${esc(data.businessAddress||'')}" placeholder="כתובת מלאה" />
          </div>
          <div class="field">
            <label>לכמה שנים</label>
            <input id="l_years_other" type="number" min="0" step="1" value="${esc(data.years||'')}" placeholder="למשל 20" />
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button class="btn btnSoft" type="button" data-cancel>ביטול</button>
        <button class="btn btnPrimary" type="button" data-save>שמור</button>
      </div>
    </div>
  `;

  const close = () => { overlay.remove(); };
  overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
  overlay.querySelector('[data-x]').addEventListener('click', close);
  overlay.querySelector('[data-cancel]').addEventListener('click', () => { close(); onSave && onSave(null); });

  let kind = inferredKind;

  const bankBox = overlay.querySelector('#lienBank');
  const otherBox = overlay.querySelector('#lienOther');
  const kindBtns = overlay.querySelectorAll('[data-kind]');
  const syncKind = () => {
    kindBtns.forEach(b => {
      const k = b.getAttribute('data-kind');
      if(k === kind){ b.classList.add('active'); b.style.borderColor='rgba(210, 170, 80, 0.85)'; b.style.boxShadow='0 10px 24px rgba(210,170,80,0.14)'; } else { b.classList.remove('active'); b.style.borderColor=''; b.style.boxShadow=''; }
    });
    bankBox.style.display = (kind === 'bank') ? 'block' : 'none';
    otherBox.style.display = (kind === 'other') ? 'block' : 'none';
  };
  kindBtns.forEach(b => b.addEventListener('click', () => {
    kind = b.getAttribute('data-kind');
    syncKind();
  }));
  syncKind();

  overlay.querySelector('[data-save]').addEventListener('click', () => {
    let out = null;

    if(kind === 'bank'){
      out = {
        kind: 'bank',
        bankName: (overlay.querySelector('#l_bankName').value || '').trim(),
        bankNumber: (overlay.querySelector('#l_bankNumber').value || '').trim(),
        branchNumber: (overlay.querySelector('#l_branchNumber').value || '').trim(),
        branchAddress: (overlay.querySelector('#l_branchAddress').value || '').trim(),
        lienHolder: (overlay.querySelector('#l_lienHolder').value || '').trim(),
        years: (overlay.querySelector('#l_years_bank').value || '').trim(),
      };
    }else{
      out = {
        kind: 'other',
        hp: (overlay.querySelector('#l_hp').value || '').trim(),
        businessName: (overlay.querySelector('#l_businessName').value || '').trim(),
        businessAddress: (overlay.querySelector('#l_businessAddress').value || '').trim(),
        years: (overlay.querySelector('#l_years_other').value || '').trim(),
      };
    }

    const hasAny = out && Object.entries(out).some(([k,v]) => k !== 'kind' && String(v||'').trim());
    close();
    onSave && onSave(hasAny ? out : null);
  });

  document.body.appendChild(overlay);
}

function debounce(fn, wait){
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function toast(title, msg){
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(msg)}</span>`;
    toastHost.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

  // Medical questions
  function renderQuestion(q, answers){
    if(q.type === 'yesno'){
      const val = answers[q.id];
      const detKey = q.id + '_details';
      const detVal = answers[detKey] || '';
      const showDetails = q.details && val === 'כן';
      return `
        <div class="sideCard" style="box-shadow:none;border-radius:14px;margin-bottom:10px">
          <div class="field">
            <label>${escapeHtml(q.label)}</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btnSoft" type="button" data-yn="${q.id}" data-val="כן" style="padding:8px 12px;${val==='כן'?'border-color:rgba(214,178,94,.35);box-shadow:0 0 0 3px var(--goldSoft)':''}">כן</button>
              <button class="btn btnSoft" type="button" data-yn="${q.id}" data-val="לא" style="padding:8px 12px;${val==='לא'?'border-color:rgba(214,178,94,.35);box-shadow:0 0 0 3px var(--goldSoft)':''}">לא</button>
            </div>
          </div>
          ${q.details ? `
            <div class="field" style="margin-top:10px;${showDetails?'':'display:none'}" data-details-wrap="${q.id}">
              <label>${escapeHtml(q.detailsLabel || 'פירוט')}</label>
              <input id="det_${escapeAttr(q.id)}" value="${escapeHtml(detVal)}" placeholder="כתוב פירוט..."/>
            </div>
          `:''}
        </div>
      `;
    }
    if(q.type === 'text'){
      const val = answers[q.id] || '';
      return `
        <div class="field" style="margin-bottom:10px">
          <label>${escapeHtml(q.label)}</label>
          <textarea id="txt_${escapeAttr(q.id)}" placeholder="כתוב...">${escapeHtml(val)}</textarea>
        </div>
      `;
    }
    return '';
  }

  function bindQuestion(q, answers){
    if(q.type === 'yesno'){
      $$(`[data-yn="${cssEscape(q.id)}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
          const v = btn.getAttribute('data-val');
          answers[q.id] = v;
          if(q.details){
            const wrap = $(`[data-details-wrap="${cssEscape(q.id)}"]`);
            if(wrap) wrap.style.display = (v === 'כן') ? '' : 'none';
          }
          markDraft();
          renderMedicalStep(); // rerender to update button highlight
        });
      });
      if(q.details){
        const det = $(`#det_${cssEscape(q.id)}`);
        if(det){
          det.addEventListener('input', () => {
            answers[q.id + '_details'] = det.value;
            markDraft();
          });
        }
      }
    }
    if(q.type === 'text'){
      const el = $(`#txt_${cssEscape(q.id)}`);
      if(el){
        el.addEventListener('input', () => {
          answers[q.id] = el.value;
          markDraft();
        });
      }
    }
  }

  // minimal css escape for querySelector
  function cssEscape(s){
    return String(s).replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
  }


  // ---------- Sync (Sheets) ----------
  async function syncDown(){
    // Pull customers + proposals from server (if available)
    const c = await apiCall('listCustomers', {});
    if(c && c.ok && Array.isArray(c.customers)){
      state.customers = c.customers;
    }
    const p = await apiCall('listProposals', {});
    if(p && p.ok && Array.isArray(p.proposals)){
      state.proposals = p.proposals;
    }

    saveProposals_();
  }


  async function syncUpCustomer(customer){
    const r = await apiCall('upsertCustomer', { customer });
    if(r && r.ok && r.customer){
      // Update local
      const idx = state.customers.findIndex(x => x.id === r.customer.id);
      if(idx >= 0) state.customers[idx] = r.customer;
      else state.customers.unshift(r.customer);
    }
    return r;
  }

  async function syncUpProposal(proposal){
    const r = await apiCall('upsertProposal', { proposal });
    if(r && r.ok && r.proposal){
      const idx = state.proposals.findIndex(x => x.id === r.proposal.id);
      if(idx >= 0) state.proposals[idx] = r.proposal;
      else state.proposals.unshift(r.proposal);
    }
    return r;
  }

  // Init
  loadProcesses_();
  loadProposals_();
  loadCustomers_();
  render();

  // Auto-connect + initial sync
  (async () => {
    state.server.url = GOOGLE_SCRIPT_URL || '';
    if(AUTO_CONNECT && GOOGLE_SCRIPT_URL){
      const ping = await apiPing();
      state.connected = !!ping.ok;
      if(state.connected){
        toast('מחובר', 'מחובר לשרת Google Sheets');
        await syncDown();
      }else{
        toast('לא מחובר', 'לא הצלחנו להתחבר לשרת (עובד בדמו)');
      }
      render();
    }
  })();

})();




/* Login screen removed (no-login mode) */

;

/* PWA_INSTALL_HANDLER */

(function(){
  const installBtn = document.getElementById("installBtn");
  const installHint = document.getElementById("installHint");
  if (!installBtn) return;

  let deferredPrompt = null;

  function isStandalone(){
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
           (window.navigator && window.navigator.standalone === true);
  }

  function show(msg, type){
    if (!installHint) return;
    installHint.style.display = "block";
    installHint.textContent = msg || "";
  }

  function setVisible(v){
    installBtn.style.display = v ? "" : "none";
    if (!v && installHint) installHint.style.display = "none";
  }

  // If already installed (standalone), no need to install
  if (isStandalone()){
    installBtn.textContent = "המערכת מותקנת במחשב";
    installBtn.disabled = true;
    setVisible(true);
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.disabled = false;
    installBtn.textContent = "עדכן מערכת גמל אינבסט";
    setVisible(true);
    show("לחץ כדי להתקין את המערכת כאפליקציה על שולחן העבודה.", "info");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installBtn.textContent = "המערכת הותקנה בהצלחה";
    installBtn.disabled = true;
    show("האייקון נוסף לשולחן העבודה.", "ok");
  });

  installBtn.addEventListener("click", async () => {
    // Desktop Chrome/Edge: we can trigger the install prompt (requires user gesture)
    if (deferredPrompt){
      deferredPrompt.prompt();
      try{
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === "accepted"){
          show("מתקין… אם הכול תקין יופיע אייקון על שולחן העבודה.", "ok");
        }else{
          show("ההתקנה בוטלה. אפשר לנסות שוב בכל רגע.", "warn");
        }
      }catch(err){
        show("לא הצלחתי לפתוח חלון התקנה. נסה לרענן את הדף.", "warn");
      }
      deferredPrompt = null;
      return;
    }

    // Fallback (Safari / iOS or when browser doesn't fire beforeinstallprompt)
    show("אם לא מופיע חלון התקנה: בכרום/אדג' לחץ בתפריט ⋮ על 'Install app'. באייפון: Share → Add to Home Screen.", "info");
  });

  // If the browser supports install but hasn't fired the event yet, keep button hidden until ready.
  // However, we can optionally show a helper button after a short delay:
  setTimeout(() => {
    // Show a helper only if not standalone and not already visible
    if (!isStandalone() && installBtn.style.display === "none"){
      setVisible(true);
      installBtn.textContent = "עדכן מערכת גמל אינבסט";
      show("אם יש לך Chrome/Edge: בתפריט ⋮ יש 'Install app'.", "info");
    }
  }, 2500);
})();


/* PWA_SW_REGISTER */

(function(){
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    // BUILD is defined in index.html loader; fallback to Date.now if missing
    const b = (typeof BUILD !== "undefined") ? BUILD : Date.now();
    navigator.serviceWorker.register(`./service-worker.js?build=${b}`).catch(()=>{});
  });
})();

