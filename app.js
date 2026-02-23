// ======== CONFIG ========
// Paste your Web App /exec URL here (from Deploy -> Web app)
const API_URL = 'PASTE_YOUR_WEB_APP_URL_HERE';

// ======== STATE (NO localStorage) ========
const state = {
  token: null,
  user: null,
  customers: [],
  currentCustomer: null
};

// ======== DOM ========
const $ = (id) => document.getElementById(id);

const authWrap = $('authWrap');
const app = $('app');
const authErr = $('authErr');

const loginUser = $('loginUser');
const loginPass = $('loginPass');
const btnLogin = $('btnLogin');
const btnLogout = $('btnLogout');

const brandUser = $('brandUser');
const pageTitle = $('pageTitle');

const searchInput = $('searchInput');
const btnNewCustomer = $('btnNewCustomer');
const btnNewProposal = $('btnNewProposal');

const customersList = $('customersList');
const emptyState = $('emptyState');

const drawer = $('drawer');
const drawerOverlay = $('drawerOverlay');
const drawerClose = $('drawerClose');

const cFullName = $('cFullName');
const cPhone = $('cPhone');
const cStatus = $('cStatus');
const cAgent = $('cAgent');
const cNotes = $('cNotes');
const btnSaveCustomer = $('btnSaveCustomer');
const btnCancelEdit = $('btnCancelEdit');

const proposalOverlay = $('proposalOverlay');
const proposalClose = $('proposalClose');
const proposalCancel = $('proposalCancel');
const proposalCreate = $('proposalCreate');
const proposalCustomer = $('proposalCustomer');
const proposalDesc = $('proposalDesc');

// ======== API ========
async function api(action, payload = {}) {
  const res = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ======== AUTH ========
btnLogin.addEventListener('click', async () => {
  authErr.textContent = '';
  const username = loginUser.value.trim();
  const password = loginPass.value.trim();

  if (!API_URL || API_URL.includes('PASTE_YOUR_WEB_APP_URL_HERE')) {
    authErr.textContent = 'חסר URL של השרת (Web App). אחרי פריסה נדביק אותו ב-app.js';
    return;
  }

  const r = await api('auth.login', { username, password });
  if (!r.ok) {
    authErr.textContent = 'שם משתמש או סיסמה לא נכונים';
    return;
  }

  state.token = r.token;
  state.user = r.user;

  authWrap.classList.add('hidden');
  app.classList.remove('hidden');
  brandUser.textContent = `${state.user.username} • ${state.user.role}`;

  await loadCustomers();
});

btnLogout.addEventListener('click', () => {
  state.token = null;
  state.user = null;
  state.customers = [];
  closeDrawer();
  closeProposal();

  app.classList.add('hidden');
  authWrap.classList.remove('hidden');
  loginPass.value = '';
});

// ======== CUSTOMERS ========
async function loadCustomers() {
  const q = searchInput.value.trim();
  const r = await api('customers.list', { token: state.token, q });
  if (!r.ok) {
    alert('שגיאת שרת: ' + (r.error || 'UNKNOWN'));
    return;
  }
  state.customers = r.rows || [];
  renderCustomers();
  fillProposalCustomers();
}

function renderCustomers() {
  customersList.innerHTML = '';
  if (!state.customers.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  state.customers.forEach(c => {
    const status = String(c.status || 'חדש');
    const badgeClass =
      status.includes('פעיל') ? 'green' :
      status.includes('בטיפול') ? 'orange' :
      status.includes('לא') ? 'gray' : '';

    const el = document.createElement('div');
    el.className = 'rowCard';
    el.innerHTML = `
      <div class="rowMain">
        <div class="rowName">${escapeHtml(c.fullName || '—')}</div>
        <div class="rowSub">${escapeHtml(c.phone || '')}</div>
      </div>

      <div>
        <div class="badge ${badgeClass}">${escapeHtml(status)}</div>
      </div>

      <div class="rowSub">${escapeHtml(c.agent || '')}</div>

      <div class="rowSub">עודכן: ${escapeHtml(c.updatedAt || '')}</div>
    `;

    el.addEventListener('click', () => openCustomer(c));
    customersList.appendChild(el);
  });
}

searchInput.addEventListener('input', debounce(() => loadCustomers(), 250));

btnNewCustomer.addEventListener('click', () => {
  openCustomer({ id: '', fullName: '', phone: '', status: 'חדש', agent: state.user?.username || '', notes: '' }, true);
});

async function openCustomer(customer, isNew = false) {
  state.currentCustomer = { ...customer };
  $('drawerTitle').textContent = isNew ? 'לקוח חדש' : 'תיק לקוח';

  cFullName.value = state.currentCustomer.fullName || '';
  cPhone.value = state.currentCustomer.phone || '';
  cStatus.value = state.currentCustomer.status || 'חדש';
  cAgent.value = state.currentCustomer.agent || (state.user?.username || '');
  cNotes.value = state.currentCustomer.notes || '';

  drawerOverlay.classList.remove('hidden');
  drawer.classList.remove('hidden');
}

function closeDrawer() {
  drawerOverlay.classList.add('hidden');
  drawer.classList.add('hidden');
  state.currentCustomer = null;
}

drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);
btnCancelEdit.addEventListener('click', closeDrawer);

btnSaveCustomer.addEventListener('click', async () => {
  if (!state.currentCustomer) return;

  const customer = {
    id: state.currentCustomer.id || '',
    fullName: cFullName.value.trim(),
    phone: cPhone.value.trim(),
    status: cStatus.value,
    agent: cAgent.value.trim(),
    notes: cNotes.value.trim()
  };

  const r = await api('customers.upsert', { token: state.token, customer });
  if (!r.ok) {
    alert('שמירה נכשלה: ' + (r.error || 'UNKNOWN'));
    return;
  }

  closeDrawer();
  await loadCustomers();
});

// ======== PROPOSALS ========
btnNewProposal.addEventListener('click', () => {
  openProposal();
});

function fillProposalCustomers() {
  proposalCustomer.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'בחר לקוח...';
  proposalCustomer.appendChild(opt0);

  state.customers.forEach(c => {
    const o = document.createElement('option');
    o.value = String(c.id || '');
    o.textContent = String(c.fullName || '');
    proposalCustomer.appendChild(o);
  });
}

function openProposal() {
  proposalDesc.value = '';
  proposalCustomer.value = '';
  proposalOverlay.classList.remove('hidden');
}

function closeProposal() {
  proposalOverlay.classList.add('hidden');
}

proposalClose.addEventListener('click', closeProposal);
proposalCancel.addEventListener('click', closeProposal);

proposalCreate.addEventListener('click', async () => {
  const customerId = proposalCustomer.value;
  const customerName = proposalCustomer.options[proposalCustomer.selectedIndex]?.textContent || '';
  if (!customerId) { alert('בחר לקוח'); return; }

  const payload = { desc: proposalDesc.value.trim() };

  const r = await api('proposals.create', {
    token: state.token,
    customerId,
    customerName,
    payload
  });

  if (!r.ok) {
    alert('יצירת הצעה נכשלה: ' + (r.error || 'UNKNOWN'));
    return;
  }

  closeProposal();
  alert('נוצרה הצעה (טיוטה): ' + r.row.id);
});

// ======== UTIL ========
function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
