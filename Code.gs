/**
 * GEMEL INVEST CRM — Apps Script Web App (Sheets backend)
 * Tabs: Users, Customers, Proposals
 *
 * ✅ No localStorage on client (token kept in memory).
 * ✅ Works directly with Google Sheets.
 *
 * IMPORTANT:
 * - Deploy as Web App (Execute as: Me, Access: Anyone for testing)
 * - Use the /exec URL in app.js as API_URL.
 */

const SHEETS = {
  USERS: 'Users',
  CUSTOMERS: 'Customers',
  PROPOSALS: 'Proposals',
};

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : '';
  try {
    if (action === 'ping') return json_({ ok: true, msg: 'pong', ts: new Date().toISOString() });
    return json_({ ok: false, error: 'UNKNOWN_ACTION', action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : '';
  let body = {};
  try {
    body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  } catch (parseErr) {
    return json_({ ok: false, error: 'BAD_JSON' });
  }

  try {
    if (action === 'auth.login') return authLogin_(body);
    if (action === 'customers.list') return customersList_(body);
    if (action === 'customers.get') return customersGet_(body);
    if (action === 'customers.upsert') return customersUpsert_(body);
    if (action === 'proposals.create') return proposalsCreate_(body);

    return json_({ ok: false, error: 'UNKNOWN_ACTION', action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** -------------------- AUTH -------------------- **/

function authLogin_(body) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();

  if (!username || !password) return json_({ ok: false, error: 'MISSING_CREDENTIALS' });

  const users = readTable_(SHEETS.USERS);
  const u = users.rows.find(r =>
    String(r.username || '').trim().toLowerCase() === username.toLowerCase() &&
    String(r.password || '') === password &&
    String(r.active || '').toUpperCase() !== 'FALSE'
  );

  if (!u) return json_({ ok: false, error: 'INVALID_LOGIN' });

  // Server-side session token stored in CacheService for 6 hours
  const token = 'tok_' + Utilities.getUuid();
  const session = {
    userId: String(u.id || ''),
    username: String(u.username || ''),
    role: String(u.role || 'agent'),
    issuedAt: Date.now()
  };

  CacheService.getScriptCache().put('sess:' + token, JSON.stringify(session), 60 * 60 * 6); // 6h

  return json_({
    ok: true,
    token,
    user: { id: session.userId, username: session.username, role: session.role }
  });
}

function requireSession_(token) {
  const t = String(token || '').trim();
  if (!t) throw new Error('NO_TOKEN');

  const raw = CacheService.getScriptCache().get('sess:' + t);
  if (!raw) throw new Error('SESSION_EXPIRED');

  return JSON.parse(raw);
}

/** -------------------- CUSTOMERS -------------------- **/

function customersList_(body) {
  const session = requireSession_(body.token);

  const q = String(body.q || '').trim().toLowerCase();
  const customers = readTable_(SHEETS.CUSTOMERS);

  let rows = customers.rows;

  if (q) {
    rows = rows.filter(r =>
      String(r.fullName || '').toLowerCase().includes(q) ||
      String(r.phone || '').toLowerCase().includes(q) ||
      String(r.status || '').toLowerCase().includes(q) ||
      String(r.agent || '').toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  return json_({ ok: true, rows, viewer: session });
}

function customersGet_(body) {
  requireSession_(body.token);
  const id = String(body.id || '').trim();
  if (!id) return json_({ ok: false, error: 'MISSING_ID' });

  const t = readTable_(SHEETS.CUSTOMERS);
  const row = t.rows.find(r => String(r.id || '') === id);
  if (!row) return json_({ ok: false, error: 'NOT_FOUND' });

  return json_({ ok: true, row });
}

function customersUpsert_(body) {
  const session = requireSession_(body.token);
  const payload = body.customer || {};
  const id = String(payload.id || '').trim();

  const nowIso = new Date().toISOString();

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.CUSTOMERS);
  if (!sheet) return json_({ ok: false, error: 'MISSING_SHEET_CUSTOMERS' });

  const table = readTable_(SHEETS.CUSTOMERS);

  const customer = {
    id: id || String(Date.now()),
    fullName: String(payload.fullName || '').trim(),
    phone: String(payload.phone || '').trim(),
    status: String(payload.status || 'חדש').trim(),
    agent: String(payload.agent || session.username).trim(),
    updatedAt: nowIso,
    notes: String(payload.notes || '').trim()
  };

  if (!customer.fullName) return json_({ ok: false, error: 'MISSING_NAME' });

  const idx = table.rows.findIndex(r => String(r.id || '') === customer.id);

  if (idx >= 0) {
    const rowNumber = idx + 2; // + header row
    writeRowByHeaders_(sheet, table.headers, rowNumber, customer);
  } else {
    appendRowByHeaders_(sheet, table.headers, customer);
  }

  return json_({ ok: true, row: customer });
}

/** -------------------- PROPOSALS -------------------- **/

function proposalsCreate_(body) {
  const session = requireSession_(body.token);

  const customerId = String(body.customerId || '').trim();
  const customerName = String(body.customerName || '').trim();
  if (!customerId || !customerName) return json_({ ok: false, error: 'MISSING_CUSTOMER' });

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEETS.PROPOSALS);
  if (!sheet) return json_({ ok: false, error: 'MISSING_SHEET_PROPOSALS' });

  const table = readTable_(SHEETS.PROPOSALS);

  const proposal = {
    id: 'P' + Date.now(),
    customerId,
    customerName,
    createdAt: new Date().toISOString(),
    owner: session.username,
    status: 'טיוטה',
    payloadJson: JSON.stringify(body.payload || {})
  };

  appendRowByHeaders_(sheet, table.headers, proposal);
  return json_({ ok: true, row: proposal });
}

/** -------------------- HELPERS -------------------- **/

function readTable_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) throw new Error('MISSING_SHEET_' + sheetName);

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 1) return { headers: [], rows: [] };

  const headers = values[0].map(h => String(h || '').trim());
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[i][c];
    }
    const any = Object.values(obj).some(v => String(v || '').trim() !== '');
    if (any) rows.push(obj);
  }
  return { headers, rows };
}

function appendRowByHeaders_(sheet, headers, obj) {
  const row = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
  sheet.appendRow(row);
}

function writeRowByHeaders_(sheet, headers, rowNumber, obj) {
  const row = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
}

/**
 * IMPORTANT FIX:
 * Apps Script TextOutput does NOT support setHeader().
 * Returning JSON only (works reliably).
 */
function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
