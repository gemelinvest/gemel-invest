/**
 * GEMEL INVEST CRM — Google Sheets Web App API
 * Tabs expected: Users, Customers, Proposals, Processes
 *
 * Works cross-origin by accepting POST bodies as text/plain JSON (to avoid CORS preflight).
 */

const TAB = {
  USERS: 'Users',
  CUSTOMERS: 'Customers',
  PROPOSALS: 'Proposals',
  PROCESSES: 'Processes'
};

function nowIso_(){ return new Date().toISOString(); }

function json_(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(name){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  if(!sh) throw new Error('MISSING_SHEET:' + name);
  return sh;
}

function getHeaders_(sh){
  const lastCol = Math.max(1, sh.getLastColumn());
  const hdr = sh.getRange(1,1,1,lastCol).getValues()[0].map(h=>String(h||'').trim());
  // trim empty tail
  let end = hdr.length;
  while(end>1 && !hdr[end-1]) end--;
  return hdr.slice(0,end);
}

function ensureHeaders_(sh, required){
  let hdr = getHeaders_(sh);
  const set = new Set(hdr.filter(Boolean));
  let changed = false;
  required.forEach(h => {
    if(!set.has(h)){
      hdr.push(h);
      set.add(h);
      changed = true;
    }
  });
  if(changed){
    sh.getRange(1,1,1,hdr.length).setValues([hdr]);
  }
  return hdr;
}

function rowsToObjects_(hdr, values){
  return values.map(r => {
    const o = {};
    hdr.forEach((h,i)=>{ if(h) o[h] = r[i]; });
    // If there is a "json" column, try parsing it
    if(o.json && typeof o.json === 'string'){
      try{
        const p = JSON.parse(o.json);
        if(p && typeof p === 'object') o._json = p;
      }catch(_){}
    }
    return o;
  });
}

function readAll_(tab){
  const sh = getSheet_(tab);
  const hdr = getHeaders_(sh);
  const lastRow = sh.getLastRow();
  const lastCol = Math.max(1, sh.getLastColumn());
  if(lastRow < 2) return { hdr, rows: [] };
  const values = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  return { hdr, rows: rowsToObjects_(hdr, values) };
}

function findRowIndexBy_(sh, hdr, key, value){
  const idx = hdr.indexOf(key);
  if(idx < 0) return -1;
  const lastRow = sh.getLastRow();
  if(lastRow < 2) return -1;
  const col = idx + 1;
  const vals = sh.getRange(2,col,lastRow-1,1).getValues().map(x=>String(x[0]||''));
  const find = vals.findIndex(v => v === String(value||''));
  return find >= 0 ? (find + 2) : -1;
}

function writeObjectRow_(sh, hdr, rowIndex, obj){
  const row = new Array(hdr.length).fill('');
  hdr.forEach((h,i)=>{
    if(!h) return;
    if(h === 'json'){
      row[i] = JSON.stringify(obj);
      return;
    }
    if(Object.prototype.hasOwnProperty.call(obj, h)){
      row[i] = obj[h];
    }
  });
  sh.getRange(rowIndex,1,1,row.length).setValues([row]);
}

function upsert_(tab, key, obj, requiredHeaders){
  const sh = getSheet_(tab);
  const hdr = ensureHeaders_(sh, requiredHeaders);
  const keyVal = String(obj[key] || '').trim();
  if(!keyVal) throw new Error('MISSING_KEY:' + key);

  const rowIndex = findRowIndexBy_(sh, hdr, key, keyVal);
  if(rowIndex < 0){
    // append
    const row = new Array(hdr.length).fill('');
    hdr.forEach((h,i)=>{
      if(!h) return;
      if(h === 'json'){ row[i] = JSON.stringify(obj); return; }
      if(Object.prototype.hasOwnProperty.call(obj, h)) row[i] = obj[h];
    });
    sh.appendRow(row);
    return { created:true, obj };
  }else{
    writeObjectRow_(sh, hdr, rowIndex, obj);
    return { created:false, obj };
  }
}

function seedUsersIfEmpty_(){
  const sh = getSheet_(TAB.USERS);
  ensureHeaders_(sh, ['username','password','role','displayName','active','createdAt','updatedAt','json']);
  if(sh.getLastRow() >= 2) return { seeded:false };

  const now = nowIso_();
  const seed = [
    { username:'admin',  password:'1234', role:'admin', displayName:'מנהל מערכת', active:true, createdAt:now, updatedAt:now },
    { username:'agent1', password:'1234', role:'agent', displayName:'אוריה', active:true, createdAt:now, updatedAt:now },
    { username:'agent2', password:'1234', role:'agent', displayName:'סתיו', active:true, createdAt:now, updatedAt:now },
    { username:'agent3', password:'1234', role:'agent', displayName:'דוד', active:true, createdAt:now, updatedAt:now },
  ];
  seed.forEach(u => upsert_(TAB.USERS, 'username', u, ['username','password','role','displayName','active','createdAt','updatedAt','json']));
  return { seeded:true, count: seed.length };
}

/**
 * Parse payload from:
 * - POST text/plain JSON
 * - POST application/json JSON
 * - POST {"payload": {...}} wrapper
 * - GET ?payload=... JSON
 */
function parsePayload_(e){
  if(e && e.parameter && e.parameter.payload){
    try{ return JSON.parse(String(e.parameter.payload)); }catch(_){ return {}; }
  }
  let raw = '';
  try{ raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : ''; }catch(_){ raw=''; }
  if(!raw) return {};
  try{
    const obj = JSON.parse(raw);
    if(obj && typeof obj === 'object'){
      if(obj.payload && typeof obj.payload === 'object') return obj.payload;
      return obj;
    }
  }catch(_){}
  return {};
}

function doGet(e){
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : '';
  try{
    if(action === 'ping') return json_({ ok:true, msg:'pong', ts: nowIso_() });
    if(action === 'seedUsers') return json_({ ok:true, ...seedUsersIfEmpty_() });

    if(action === 'listCustomers'){
      const r = readAll_(TAB.CUSTOMERS);
      return json_({ ok:true, customers: r.rows });
    }
    if(action === 'listProposals'){
      const r = readAll_(TAB.PROPOSALS);
      return json_({ ok:true, proposals: r.rows });
    }
    if(action === 'listProcesses'){
      const r = readAll_(TAB.PROCESSES);
      return json_({ ok:true, processes: r.rows });
    }
    if(action === 'listUsers'){
      seedUsersIfEmpty_();
      const r = readAll_(TAB.USERS);
      const users = (r.rows||[]).map(u => ({
        username: String(u.username||''),
        role: String(u.role||'agent'),
        displayName: String(u.displayName||u.username||''),
        active: !(String(u.active).toLowerCase()==='false' || u.active===false)
      }));
      return json_({ ok:true, users });
    }

    return json_({ ok:false, error:'UNKNOWN_ACTION', action });
  }catch(err){
    return json_({ ok:false, error:String(err && err.message ? err.message : err) });
  }
}

function doPost(e){
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : '';
  try{
    const payload = parsePayload_(e);

    if(action === 'login'){
      seedUsersIfEmpty_();
      const username = String(payload.username||'').trim();
      const password = String(payload.password||'').trim();
      if(!username || !password) return json_({ ok:false, error:'MISSING_CREDENTIALS' });

      const users = readAll_(TAB.USERS).rows || [];
      const u = users.find(x => String(x.username||'').trim() === username);
      if(!u) return json_({ ok:false, error:'INVALID_LOGIN' });

      const active = !(String(u.active).toLowerCase()==='false' || u.active===false);
      if(!active) return json_({ ok:false, error:'USER_INACTIVE' });

      if(String(u.password||'') !== password) return json_({ ok:false, error:'INVALID_LOGIN' });

      return json_({
        ok:true,
        user: {
          username,
          role: String(u.role||'agent'),
          displayName: String(u.displayName||username)
        }
      });
    }

    if(action === 'pullAll'){
      const customers = readAll_(TAB.CUSTOMERS).rows || [];
      const proposals = readAll_(TAB.PROPOSALS).rows || [];
      const processes = readAll_(TAB.PROCESSES).rows || [];
      return json_({ ok:true, customers, proposals, processes });
    }

    if(action === 'pushAll'){
      // Bulk upsert arrays
      const customers = Array.isArray(payload.customers) ? payload.customers : [];
      const proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
      const processes = Array.isArray(payload.processes) ? payload.processes : [];

      customers.forEach(c => {
        if(!c || !c.id) return;
        const now = nowIso_();
        const obj = Object.assign({}, c, { id: String(c.id), updatedAt: now, createdAt: c.createdAt || now });
        upsert_(TAB.CUSTOMERS, 'id', obj, ['id','createdAt','updatedAt','json']);
      });
      proposals.forEach(p => {
        if(!p || !p.id) return;
        const now = nowIso_();
        const obj = Object.assign({}, p, { id: String(p.id), updatedAt: now, createdAt: p.createdAt || now });
        upsert_(TAB.PROPOSALS, 'id', obj, ['id','createdAt','updatedAt','json']);
      });
      processes.forEach(pr => {
        if(!pr || !pr.id) return;
        const now = nowIso_();
        const obj = Object.assign({}, pr, { id: String(pr.id), updatedAt: now, createdAt: pr.createdAt || now });
        upsert_(TAB.PROCESSES, 'id', obj, ['id','createdAt','updatedAt','json']);
      });

      return json_({ ok:true, counts:{ customers: customers.length, proposals: proposals.length, processes: processes.length } });
    }

    // Single upserts (also accepted by frontend)
    if(action === 'upsertCustomer'){
      const c = payload.customer && typeof payload.customer === 'object' ? payload.customer : payload;
      const now = nowIso_();
      const obj = Object.assign({}, c, { id: String(c.id||''), updatedAt: now, createdAt: c.createdAt || now });
      if(!obj.id) return json_({ ok:false, error:'MISSING_ID' });
      upsert_(TAB.CUSTOMERS, 'id', obj, ['id','createdAt','updatedAt','json']);
      return json_({ ok:true, customer: obj });
    }

    if(action === 'upsertProposal'){
      const p = payload.proposal && typeof payload.proposal === 'object' ? payload.proposal : payload;
      const now = nowIso_();
      const obj = Object.assign({}, p, { id: String(p.id||''), updatedAt: now, createdAt: p.createdAt || now });
      if(!obj.id) return json_({ ok:false, error:'MISSING_ID' });
      upsert_(TAB.PROPOSALS, 'id', obj, ['id','createdAt','updatedAt','json']);
      return json_({ ok:true, proposal: obj });
    }

    if(action === 'upsertProcess'){
      const pr = payload.process && typeof payload.process === 'object' ? payload.process : payload;
      const now = nowIso_();
      const obj = Object.assign({}, pr, { id: String(pr.id||''), updatedAt: now, createdAt: pr.createdAt || now });
      if(!obj.id) return json_({ ok:false, error:'MISSING_ID' });
      upsert_(TAB.PROCESSES, 'id', obj, ['id','createdAt','updatedAt','json']);
      return json_({ ok:true, process: obj });
    }

    if(action === 'upsertUser'){
      seedUsersIfEmpty_();
      const u = payload.user && typeof payload.user === 'object' ? payload.user : payload;
      const username = String(u.username||'').trim();
      const password = String(u.password||'').trim();
      if(!username) return json_({ ok:false, error:'MISSING_USERNAME' });
      if(!password) return json_({ ok:false, error:'MISSING_PASSWORD' });

      const now = nowIso_();
      const obj = {
        username,
        password,
        role: String(u.role||'agent'),
        displayName: String(u.displayName||username),
        active: (u.active !== false),
        createdAt: u.createdAt || now,
        updatedAt: now
      };
      upsert_(TAB.USERS, 'username', obj, ['username','password','role','displayName','active','createdAt','updatedAt','json']);
      return json_({ ok:true });
    }

    return json_({ ok:false, error:'UNKNOWN_ACTION', action });
  }catch(err){
    return json_({ ok:false, error:String(err && err.message ? err.message : err) });
  }
}