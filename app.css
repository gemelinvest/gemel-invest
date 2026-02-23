/* LEAD CORE • Premium CRM (RTL) */

:root{
  --bg: #fbf7ef;          /* קרם */
  --bg2:#fffaf2;
  --panel:#ffffff;
  --line: rgba(15, 25, 45, .10);
  --text:#0f172a;
  --muted: rgba(15, 23, 42, .65);

  --blue:#d9eaff;         /* כחול בהיר לדשבורד */
  --blue2:#bcd7ff;
  --blueDeep:#2b4b8a;

  

  /* Premium Blue (brand) */
  --brandA:#0b1f4a;
  --brandB:var(--blueDeep);
  --brandC:#3a6cff;
  --brandGlow: rgba(58,108,255,.22);

  /* Sidebar cooler palette */
  --sideA:#e7f0ff;
  --sideB:rgba(231,240,255,.55);
  --sideLine: rgba(11,31,74,.16);
--shadow: 0 10px 30px rgba(15,23,42,.08);
  --radius: 18px;
  --radius2: 14px;

  --focus: 0 0 0 4px rgba(60,130,255,.18);
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family: system-ui, -apple-system, "Segoe UI", Arial, "Noto Sans Hebrew", sans-serif;
  background:
    radial-gradient(1200px 700px at 80% 10%, rgba(188,215,255,.45), transparent 55%),
    radial-gradient(900px 600px at 10% 90%, rgba(255,224,170,.35), transparent 55%),
    linear-gradient(180deg, var(--bg), var(--bg2));
  color:var(--text);
}

.small{font-size:12px}
.muted{color:var(--muted)}
.divider{height:1px;background:var(--line);margin:18px 0}

.app{
  display:grid;
  grid-template-columns: 280px 1fr;
  min-height:100vh;
}

/* Sidebar */
.sidebar{
  position:sticky;
  top:0;
  height:100vh;
  padding:18px;
  position: relative; /* for navy spine */
  background: linear-gradient(180deg, var(--sideA), var(--sideB));
  border-inline-end: 1px solid var(--sideLine);
}


/* Navy spine לאורך הסיידבר */
.sidebar::after{
  content:"";
  position:absolute;
  top:12px;
  bottom:12px;
  inset-inline-end:10px;
  width:3px;
  border-radius:999px;
  background: linear-gradient(180deg, rgba(11,31,74,.85), rgba(43,75,138,.55));
  box-shadow: 0 10px 22px rgba(11,31,74,.18);
  opacity:.55;
  pointer-events:none;
}


.brand{
  display:flex;
  align-items:center;
  gap:12px;
  padding:14px;
  border-radius: var(--radius);

  /* Cold glass */
  background:
    linear-gradient(180deg,
      rgba(255,255,255,.78),
      rgba(235,242,255,.62)
    );
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  box-shadow:
    0 10px 26px rgba(11,31,74,.14),
    0 0 0 1px rgba(255,255,255,.55) inset;
  border: 1px solid rgba(11,31,74,.16);
}
.brand__logo{
  width:46px;height:46px;
  border-radius: 14px;
  display:grid;place-items:center;
  font-weight:900;
  letter-spacing:.6px;
  color:#fff;

  background:
    radial-gradient(14px 14px at 30% 30%, rgba(255,255,255,.35), transparent 60%),
    linear-gradient(135deg, var(--brandA), var(--brandB) 55%, var(--brandC));
  box-shadow:
    0 14px 28px rgba(11,31,74,.22),
    0 0 0 1px rgba(255,255,255,.28) inset;

  position:relative;
  overflow:hidden;

  animation: brandBreath 5.2s ease-in-out infinite;
}


@keyframes brandBreath{
  0% { transform: translateY(0); }
  50% { transform: translateY(-1px); box-shadow: 0 18px 34px rgba(11,31,74,.26), 0 0 0 1px rgba(255,255,255,.28) inset, 0 0 0 6px var(--brandGlow); }
  100% { transform: translateY(0); }
}

/* Shine עדין רק בהובר */
.brand__logo::after{
  content:"";
  position:absolute; inset:-40%;
  background: linear-gradient(110deg, transparent 40%, rgba(255,255,255,.22), transparent 60%);
  transform: translateX(-60%) rotate(12deg);
  opacity:0;
  transition: opacity .18s ease;
}
.brand:hover .brand__logo::after{
  opacity:1;
  animation: brandShine 1.05s ease forwards;
}
@keyframes brandShine{
  from { transform: translateX(-60%) rotate(12deg); }
  to   { transform: translateX(60%) rotate(12deg); }
}

.brand__name{font-weight:950; letter-spacing:.8px; color: var(--brandA)}
.brand__sub{font-size:12px; letter-spacing:1.4px; color:rgba(11,31,74,.65); margin-top:2px}

.nav{margin-top:16px; display:grid; gap:8px}
.nav__item{
  width:100%;
  border:1px solid transparent;
  background: rgba(255,255,255,.50);
  color: var(--text);
  padding:12px 12px;
  border-radius: 14px;
  display:flex; align-items:center; gap:10px;
  cursor:pointer;
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
}
.nav__item:hover{transform: translateY(-1px); background: rgba(255,255,255,.70)}
.nav__item.is-active{
  border-color: rgba(43,75,138,.25);
  background: rgba(255,255,255,.82);
  box-shadow: 0 10px 20px rgba(43,75,138,.10);
}
.nav__icon{width:22px; text-align:center}

.sidebar__foot{
  position:absolute;
  bottom:16px;
  inset-inline-start:18px;
  inset-inline-end:18px;
}
.pill{
  display:flex; align-items:center; gap:8px;
  padding:10px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,.65);
  border:1px solid rgba(43,75,138,.12);
}
.dot{
  width:10px;height:10px;border-radius:99px;
  background:#aab7cc;
  box-shadow: 0 0 0 3px rgba(255,255,255,.7);
}
.dot.ok{background:#22c55e}
.dot.warn{background:#f59e0b}
.dot.err{background:#ef4444}

/* Main */
.main{padding:18px 22px}
.topbar{
  display:grid;
  grid-template-columns: 1fr minmax(260px, 520px) auto;
  gap:14px;
  align-items:center;
  margin-bottom:14px;
}
.pageTitle__kicker{
  font-size:12px;
  color:rgba(43,75,138,.75);
  font-weight:700;
}
.pageTitle__title{
  margin:2px 0 0;
  font-size:26px;
  letter-spacing:.2px;
}

.search{
  position:relative;
  background: rgba(255,255,255,.75);
  border:1px solid var(--line);
  border-radius: 999px;
  box-shadow: var(--shadow);
  overflow:hidden;
}
.search__icon{
  position:absolute;
  top:50%;
  transform: translateY(-50%);
  inset-inline-start: 14px;
  opacity:.65;
}
.search__input{
  width:100%;
  padding:12px 14px 12px 44px;
  border:0;
  outline:0;
  background:transparent;
  font-size:14px;
}
.search__input:focus{box-shadow: var(--focus)}

.btn{
  border:1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.85);
  padding:10px 14px;
  border-radius: 14px;
  cursor:pointer;
  transition: transform .12s ease, background .12s ease, box-shadow .12s ease;
}
.btn:hover{transform: translateY(-1px); box-shadow: 0 10px 18px rgba(15,23,42,.08)}
.btn:active{transform: translateY(0)}
.btn--primary{
  border-color: rgba(43,75,138,.22);
  color:#fff;
  background: linear-gradient(135deg, var(--blueDeep), #3a6cff);
}
.btn--danger{
  border-color: rgba(239,68,68,.25);
  background: rgba(239,68,68,.08);
  color:#7f1d1d;
}

.iconBtn{
  width:40px;height:40px;
  border-radius: 14px;
  border:1px solid var(--line);
  background: rgba(255,255,255,.8);
  cursor:pointer;
}

.content{padding-top:10px}

.view{display:none}
.view.is-visible{display:block}

.grid{display:grid; gap:14px}
.grid--kpis{grid-template-columns: repeat(3, minmax(0,1fr))}
.grid--2{grid-template-columns: 1.1fr .9fr}

.card{
  background: rgba(255,255,255,.82);
  border:1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow:hidden;
}
.card__head{
  display:flex; align-items:baseline; justify-content:space-between;
  padding:14px 16px;
  border-bottom:1px solid var(--line);
}
.card__title{font-weight:900}
.card__hint{color:var(--muted); font-size:12px}

.kpi{padding:16px}
.kpi__label{color:rgba(43,75,138,.75); font-weight:800; font-size:12px}
.kpi__value{font-size:32px; font-weight:950; margin-top:6px}
.kpi__sub{color:var(--muted); font-size:12px; margin-top:2px}

.timeline{padding:14px 16px; display:grid; gap:10px}
.event{
  display:flex; gap:10px; align-items:flex-start;
  padding:10px 12px;
  border-radius: 14px;
  background: rgba(217,234,255,.35);
  border:1px solid rgba(43,75,138,.10);
}
.event__dot{
  width:10px;height:10px;border-radius:999px;
  background: linear-gradient(135deg, var(--blueDeep), #3a6cff);
  margin-top:6px;
}
.event__text{font-size:13px}
.event__time{font-size:12px;color:var(--muted); margin-top:2px}

.miniStats{padding:14px 16px; display:grid; gap:10px}
.miniStats__row{display:grid; grid-template-columns: 130px 1fr 70px; gap:10px; align-items:center}
.miniStats__label{font-size:13px}
.miniStats__bar{
  height:10px; border-radius:999px;
  background: rgba(15,23,42,.08);
  overflow:hidden;
}
.miniStats__bar span{
  display:block; height:100%;
  background: linear-gradient(90deg, var(--blue2), #6aa6ff);
  border-radius:999px;
}
.miniStats__value{font-size:12px;color:var(--muted); text-align:left}

/* Table */
.tableWrap{padding:10px 12px}
.table{width:100%; border-collapse: collapse}
.table th,.table td{
  padding:12px 10px;
  border-bottom:1px solid rgba(15,23,42,.08);
  font-size:14px;
}
.table th{color:rgba(43,75,138,.8); font-size:12px; text-transform:none; letter-spacing:.2px}
.table tr:hover td{background: rgba(217,234,255,.22)}
.badge{
  display:inline-flex;
  padding:6px 10px;
  border-radius:999px;
  font-size:12px;
  border:1px solid rgba(43,75,138,.14);
  background: rgba(217,234,255,.35);
}

/* Forms */
.formGrid{
  padding:16px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap:12px;
}
.field{display:grid; gap:6px}
.label{font-size:12px; font-weight:800; color:rgba(43,75,138,.8)}
.input{
  padding:11px 12px;
  border-radius: 14px;
  border:1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.9);
  outline:0;
}
.input:focus{box-shadow: var(--focus); border-color: rgba(60,130,255,.35)}
.help{font-size:12px; color:var(--muted)}

.row{display:flex; gap:10px; align-items:center}
.row--between{justify-content:space-between}

/* Segmented */
.segmented{
  display:flex;
  background: rgba(15,23,42,.06);
  border:1px solid rgba(15,23,42,.10);
  border-radius: 999px;
  padding:4px;
  width: fit-content;
}
.segmented__btn{
  border:0;
  background:transparent;
  padding:9px 14px;
  border-radius: 999px;
  cursor:pointer;
  font-weight:800;
  color: rgba(15,23,42,.7);
}
.segmented__btn.is-active{
  background: rgba(255,255,255,.85);
  box-shadow: 0 8px 16px rgba(15,23,42,.08);
  color: var(--text);
}

/* Empty state */
.emptyState{
  padding:28px 16px;
  display:grid;
  place-items:center;
  text-align:center;
}
.emptyState__icon{font-size:34px}
.emptyState__title{font-size:18px;font-weight:950;margin-top:10px}
.emptyState__text{max-width:520px;color:var(--muted); margin-top:6px}

/* Modal */
.modal, .drawer{display:none}

.modal{
  position:fixed;
  inset:0;
  z-index:90;
}

.modal.is-open, .drawer.is-open{display:block}

.modal__backdrop, .drawer__backdrop{
  position:fixed; inset:0;
  background: rgba(15,23,42,.35);
  backdrop-filter: blur(6px);
}
.modal__panel{
  position:fixed;
  top:50%; left:50%;
  transform: translate(-50%,-50%);
  width:min(820px, calc(100vw - 26px));
  border-radius: 22px;
  background: rgba(255,255,255,.92);
  border:1px solid rgba(15,23,42,.14);
  box-shadow: 0 30px 70px rgba(15,23,42,.25);
  overflow:hidden;
}
.modal__head{
  padding:14px 16px;
  display:flex; align-items:center; justify-content:space-between;
  border-bottom:1px solid var(--line);
  background: linear-gradient(180deg, rgba(217,234,255,.55), rgba(255,255,255,.6));
}
.modal__kicker{font-size:12px;color:rgba(43,75,138,.75);font-weight:900}
.modal__title{font-size:18px;font-weight:950;margin-top:2px}
.modal__body{padding:0}
.modal__foot{
  padding:14px 16px;
  display:flex; justify-content:flex-start; gap:10px;
  border-top:1px solid var(--line);
  background: rgba(255,255,255,.8);
}

/* Drawer */
.drawer__panel{
  position:fixed;
  top:0;
  inset-inline-end:0;
  height:100vh;
  width:min(520px, 92vw);
  background: rgba(255,255,255,.92);
  border-inline-start:1px solid rgba(15,23,42,.14);
  box-shadow: -30px 0 70px rgba(15,23,42,.20);
  overflow:hidden;
}
.drawer__head{
  padding:14px 16px;
  display:flex; align-items:center; justify-content:space-between;
  border-bottom:1px solid var(--line);
  background: linear-gradient(180deg, rgba(217,234,255,.55), rgba(255,255,255,.6));
}
.drawer__kicker{font-size:12px;color:rgba(43,75,138,.75);font-weight:900}
.drawer__title{font-size:18px;font-weight:950;margin-top:2px}
.drawer__body{padding:16px}

.profile{display:grid; gap:14px}
.profile__card{
  padding:16px;
  border-radius: 18px;
  border:1px solid rgba(43,75,138,.14);
  background: rgba(217,234,255,.35);
}
.profile__label{color:rgba(43,75,138,.75); font-weight:900; font-size:12px}
.profile__value{font-size:34px; font-weight:950; margin-top:6px}
.profile__sub{color:var(--muted); font-size:12px; margin-top:2px}

.profile__details{
  display:grid;
  grid-template-columns: 1fr;
  gap:10px;
}
.detail{
  padding:12px 12px;
  border-radius: 16px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.8);
}
.detail__k{font-size:12px; color:rgba(43,75,138,.75); font-weight:900}
.detail__v{margin-top:4px; font-size:14px}

/* Responsive */
@media (max-width: 980px){
  .app{grid-template-columns: 1fr}
  .sidebar{position:relative;height:auto}
  .main{padding:14px}
  .topbar{grid-template-columns: 1fr; gap:10px}
  .grid--kpis{grid-template-columns: 1fr}
  .grid--2{grid-template-columns: 1fr}
}


/* ===== Customers Search visibility ===== */
/* חיפוש לקוחות – מוצג רק בכרטיסיית לקוחות */
.only-customers{ display:none; }
.view-customers-active .only-customers{ display:block; }

/* אייקון חיפוש לקוחות */
.search__icon--customers{
  font-size:18px;
  opacity:.75;
  transition: transform .15s ease, opacity .15s ease;
}
.search:hover .search__icon--customers{
  transform: scale(1.08);
  opacity: 1;
}


/* ===== Search bar button (no icon) ===== */
.search{
  display:flex;
  align-items:center;
  gap:10px;
  padding:6px 8px;
}
.search__input{
  padding:10px 12px; /* remove icon offset */
}
.search__btn{
  border:1px solid rgba(43,75,138,.22);
  background: linear-gradient(135deg, var(--blueDeep), #3a6cff);
  color:#fff;
  padding:10px 14px;
  border-radius: 999px;
  cursor:pointer;
  font-weight:800;
  transition: transform .12s ease, box-shadow .12s ease;
  white-space:nowrap;
}
.search__btn:hover{transform: translateY(-1px); box-shadow: 0 10px 18px rgba(15,23,42,.10)}
.search__btn:active{transform: translateY(0)}



/* ===== Customer Fullscreen Panel (LeadCore) ===== */
.customerFull{
  position: fixed;
  inset: 0;
  z-index: 70;
  display: none;
}
.customerFull.is-open{ display:block; }

.customerFull__backdrop{
  position: absolute;
  inset: 0;
  background: transparent;
  backdrop-filter: none;
}

.customerFull__panel{
  position: absolute;
  inset: 0;
  border-radius: 0;
  background: rgba(255,255,255,.96);
  border: none;
  box-shadow: none;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto 1fr;
}

.customerFull__top{
  padding: 14px 16px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  border-bottom:1px solid rgba(15,23,42,.10);
  background: linear-gradient(180deg, rgba(217,234,255,.55), rgba(255,255,255,.65));
}

.customerFull__title{ display:grid; gap:4px; }
.customerFull__name{
  font-size: 20px;
  font-weight: 950;
  letter-spacing:.2px;
}

.customerFull__meta{
  font-size: 12px;
  color: rgba(15,23,42,.65);
  display:flex;
  flex-wrap: wrap;
  gap:10px;
}

.customerFull__dash{
  padding: 12px 16px 14px;
  border-bottom:1px solid rgba(15,23,42,.08);
  display:grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap:12px;
}

.dashCard{
  background: rgba(255,255,255,.86);
  border:1px solid rgba(15,23,42,.10);
  border-radius: 18px;
  box-shadow: 0 10px 22px rgba(15,23,42,.08);
  padding: 12px 14px;
}

.dashCard__k{
  font-size:12px;
  font-weight:900;
  color: rgba(43,75,138,.78);
}

.dashCard__v{
  margin-top:6px;
  font-size:26px;
  font-weight:950;
}

.dashCard__sub{
  margin-top:2px;
  font-size:12px;
  color: rgba(15,23,42,.60);
}

.customerFull__body{
  padding: 14px 16px 16px;
  overflow:auto;
}

.policyFilters{
  display:flex;
  gap:10px;
  align-items:center;
  flex-wrap:wrap;
  margin-bottom:10px;
}

.checkboxRow{
  display:flex;
  gap:8px;
  align-items:center;
  padding:10px 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.80);
  border:1px solid rgba(15,23,42,.10);
}

@media (max-width: 980px){
  .customerFull__panel{ inset: 10px; }
  .customerFull__dash{ grid-template-columns: 1fr; }
}


/* LeadCore • Policy Add Bar */
.policyAddBar{gap:12px}
.policyAddBar .input{height:42px}
.policyAddBar #btnAddPolicyInline{height:42px; padding-inline:16px}


/* ===== Customer File Layout (inspired by provided example) ===== */
.customerFull__top{
  justify-content: space-between;
  align-items: center;
}
.customerFull__name{
  font-size: 32px;
  letter-spacing: .2px;
}
.cfLayout{
  /* Layout: Customer details on the RIGHT, KPI/agent cards on the LEFT (RTL-friendly) */
  display:flex;
  gap:18px;
  align-items:flex-start;
}

.cfMain{
  flex:1 1 auto;
  min-width:0;
  order:0;          /* first -> right (RTL) */
  display:flex;
  flex-direction:column;
  gap:12px;
}

.cfSide{
  width:300px;
  flex:0 0 300px;
  order:1;          /* second -> left (RTL) */
  display:flex;
  flex-direction:column;
  gap:14px;
}

@media (max-width: 980px){
  .cfLayout{ flex-direction:column; }
  .cfSide{ width:auto; flex:0 0 auto; }
}

.dashCard--solid{
  background: linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 16px;
  padding: 14px 14px;
}
.cfInfo{
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 16px;
  padding: 12px 14px;
}
.cfInfo__row{
  display:flex;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px dashed rgba(255,255,255,.08);
}
.cfInfo__row:last-child{ border-bottom: 0; }
.cfInfo__k{ opacity: .75; font-size: 12px; }
.cfInfo__v{ font-size: 13px; direction:ltr; text-align:left; }
.policyFilters.policyAddBar{
  margin-top: 0;
}
.tableWrap.policyTable{
  margin-top: 6px;
}



/* ===== LeadCore: Glass card helper (Customer File) ===== */
.glassCard{
  background:
    linear-gradient(180deg,
      rgba(255,255,255,.72),
      rgba(235,242,255,.52)
    );
  border: 1px solid rgba(11,31,74,.14);
  border-radius: 18px;
  box-shadow: 0 12px 26px rgba(11,31,74,.10);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
}

/* Customer file: compact details */
.cfInfoCard{ padding: 12px 14px; margin-bottom: 12px; }
.cfInfo--grid{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 14px;
}
.cfInfo--grid .cfInfo__row{
  border-bottom: 0;
  padding: 0;
  display:grid;
  justify-content: unset;
  gap: 4px;
}
.cfInfo--grid .cfInfo__k{ font-size:12px; opacity:.70; font-weight:900; color: rgba(43,75,138,.80); }
.cfInfo--grid .cfInfo__v{ font-size:14px; font-weight:800; direction:ltr; text-align:left; }

@media (max-width: 980px){
  .cfInfo--grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 520px){
  .cfInfo--grid{ grid-template-columns: 1fr; }
}

/* Policy add bar at bottom */
.policyAddBar{
  margin-top: 14px;
}

/* Action modal placeholder */
.actionPlaceholder{ padding: 14px; }


/* ===== Policy Pick List (Cancel Flow) ===== */
.policyPickList{
  display:grid;
  gap:10px;
}
.policyPick{
  display:flex;
  gap:10px;
  align-items:flex-start;
  padding:10px 12px;
  border-radius: 14px;
  border:1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.82);
  cursor:pointer;
  transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
}
.policyPick:hover{ transform: translateY(-1px); box-shadow: 0 10px 18px rgba(15,23,42,.08); }
.policyPick input{ margin-top:4px; }
.policyPick__main{ display:grid; gap:4px; }
.policyPick__title{ font-weight:900; }
.policyPick__meta{ font-size:12px; color: var(--muted); display:flex; flex-wrap:wrap; gap:10px; }


/* ===== Customer Details (Top Card) - compact CRM rows ===== */
.cfDetailsGrid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 22px;
  margin-top: 10px;
}

.cfDetailsCol{
  min-width:0;
}

.cfLine{
  display:grid;
  grid-template-columns: 1fr 120px; /* value | label (label on the right) */
  gap: 10px;
  align-items:center;
  padding: 7px 0;
  border-bottom: 1px solid rgba(20,35,60,.06);
}

.cfLine:last-child{ border-bottom: 0; }

.cfLab{
  font-size: 12px;
  color: rgba(40,60,100,.62);
  text-align:right;
  white-space:nowrap;
}

.cfVal{
  font-size: 13px;
  font-weight: 800;
  color: rgba(10,18,30,.92);
  min-width:0;
  overflow-wrap:anywhere;
}

@media (max-width: 980px){
  .cfDetailsGrid{ grid-template-columns: 1fr; gap: 10px; }
  .cfLine{ grid-template-columns: 1fr 110px; }
}

/* Tighten spacing so labels are closer to values */
.cfLine{ gap: 8px; }


/* ===== Compact customer details card/table ===== */
/* target the top customer details card */
#customerTopCard,
.cfInfoCard--top{
  max-width: 980px !important;   /* was wider; make compact */
  margin-inline: auto !important;
  padding: 10px 12px !important;
}

/* tighten the inner details grid */
.cfDetailsGrid{
  max-width: 980px !important;
  margin-inline: auto !important;
  padding: 4px 6px 2px !important;
  column-gap: 28px !important;
}

/* tighter rows */
.cfLine{
  padding: 5px 0 !important;
  gap: 6px !important;
}

/* slightly smaller typography */
.cfVal{
  font-size: 13px !important;
  line-height: 1.1 !important;
}

.cfLab{
  font-size: 11px !important;
  line-height: 1.05 !important;
  margin-inline-start: 6px !important;
}

/* make center divider less tall in compact card */
.cfDetailsGrid::after{
  top: 8px !important;
  bottom: 8px !important;
}

@media (max-width: 1100px){
  #customerTopCard,
  .cfInfoCard--top,
  .cfDetailsGrid{
    max-width: 92vw !important;
  }
}


/* ===== Full-width rectangular customer header ===== */
.customerHeaderWide{
  width: 100%;
  margin: 0;
  padding: 0 16px;
}

.customerHeaderWide .cfInfoCard--top{
  max-width: none !important;
  width: 100%;
  border-radius: 14px;
  padding: 10px 18px !important;
}

/* keep details grid wide */
.customerHeaderWide .cfDetailsGrid{
  max-width: none !important;
}

/* reduce height for rectangular feel */
.customerHeaderWide .cfLine{
  padding: 4px 0 !important;
}

/* sticky still works */
.customerHeaderWide #customerTopCard{
  top: 10px;
}


/* ===== CRM section title: Purchased Insurances ===== */
.crmSection{
  width: 100%;
  margin: 14px 0 6px;
  padding: 0 16px;
}

.crmSectionTitle{
  font-size: 16px;
  font-weight: 800;
  color: #1f2937;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(15,23,42,.12);
}


/* ===== CRM Section: Purchased policies header ===== */
.crmSection{
  width: 100%;
  padding: 0 16px;
  margin: 12px 0 6px;
}

.crmSection__row{
  display:flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(15,23,42,.10);
}

.crmSectionTitle{
  margin: 0;
  font-size: 16px;
  font-weight: 950;
  letter-spacing: .2px;
  color: rgba(15,23,42,.92);
}

.crmSectionHint{
  font-size: 12px;
  color: rgba(15,23,42,.55);
  font-weight: 700;
  text-align:left;
}

.crmSection--policies{
  padding-top: 4px;
}

.tableWrap.policyTable{
  padding-top: 6px;
}


/* ===== Sync indicator (Option 2) ===== */
.dot.busy{animation: lcPulse 1s ease-in-out infinite}
@keyframes lcPulse{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}


/* ===== LeadCore • Premium New Customer UX ===== */
#modalCustomer .modal__panel{
  top:0 !important;
  left:0 !important;
  transform:none !important;
  width:100vw !important;
  height:100vh !important;
  max-width:none !important;
  border-radius:0 !important;
  display:flex;
  flex-direction:column;
}

#modalCustomer .modal__head{
  position: sticky;
  top: 0;
  z-index: 20;
}

#customerForm.modal__body{
  flex: 1;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  padding: 0;
}

.lcFormTop{
  padding: 14px 18px 10px;
  border-bottom: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.85);
  backdrop-filter: blur(10px);
}

.lcProgress{
  display:flex;
  align-items:center;
  gap: 12px;
  margin-bottom: 10px;
}
.lcProgress__track{
  flex:1;
  height: 10px;
  border-radius: 999px;
  background: rgba(15,23,42,.10);
  overflow:hidden;
}
.lcProgress__bar{
  height: 100%;
  border-radius: 999px;
  background: rgba(37,99,235,.85);
  width:0%;
  transition: width .2s ease;
}
.lcProgress__text{
  font-size: 12px;
  color: rgba(15,23,42,.70);
  white-space: nowrap;
}

.lcTabs{
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
}
.lcTab{
  border: 1px solid rgba(15,23,42,.12);
  background: rgba(255,255,255,.75);
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 650;
  font-size: 13px;
  color: rgba(15,23,42,.85);
}
.lcTab.is-active{
  background: rgba(37,99,235,.12);
  border-color: rgba(37,99,235,.30);
  color: rgba(37,99,235,.95);
}

.lcFormScroll{
  flex:1;
  overflow:auto;
  padding: 18px;
}

.lcStep{ display:none; }
.lcStep.is-active{ display:block; }

.lcStickyFooter{
  position: sticky;
  bottom: 0;
  z-index: 15;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(15,23,42,.10);
  padding: 12px 18px;
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 14px;
}
.lcHint{
  font-size: 12px;
  max-width: 55%;
}
.lcFooterBtns{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.lcFooterSep{
  width:1px;
  height: 28px;
  background: rgba(15,23,42,.12);
  margin: 0 4px;
}

@media (max-width: 720px){
  .lcHint{ display:none; }
  .lcFormScroll{ padding: 14px; }
}

/* ===============================
   FIX: Customers list table alignment (scoped)
   Only affects #view-customers
================================ */
#view-customers .tableWrap .table{
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  direction: rtl;
}

#view-customers .tableWrap .table th,
#view-customers .tableWrap .table td{
  text-align: right;
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Column sizing */
#view-customers .tableWrap .table th:nth-child(1),
#view-customers .tableWrap .table td:nth-child(1){ width: 32%; }

#view-customers .tableWrap .table th:nth-child(2),
#view-customers .tableWrap .table td:nth-child(2){ width: 22%; }

#view-customers .tableWrap .table th:nth-child(3),
#view-customers .tableWrap .table td:nth-child(3){ width: 18%; }

#view-customers .tableWrap .table th:nth-child(4),
#view-customers .tableWrap .table td:nth-child(4){ width: 18%; }

/* ===============================
   Customers: "פתח תיק" button icon (scoped)
   Adds folder SVG on the LEFT of the label
=============================== */
#view-customers .btn.lcBtnWithIcon{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-direction: row-reverse; /* label on right, icon on left (RTL-friendly) */
}
#view-customers .btn.lcBtnWithIcon .lcBtnIcon{
  display: inline-flex;
  width: 16px;
  height: 16px;
  opacity: .92;
}
#view-customers .btn.lcBtnWithIcon .lcIconSvg{
  width: 16px;
  height: 16px;
}



#view-customers .tableWrap .table th:nth-child(5),
#view-customers .tableWrap .table td:nth-child(5){
  width: 10%;
  text-align: left;
}

/* Keep numeric fields readable in RTL, but anchored correctly */
#view-customers .tableWrap .table td:nth-child(2),
#view-customers .tableWrap .table td:nth-child(3){
  direction: ltr;
  unicode-bidi: plaintext;
  text-align: right;
}

#view-customers .tableWrap .table td:nth-child(4){
  text-align: center;
}

/* ===============================
   My Flow (Cards) — scoped to #view-myflow
   (No global table/grid/rtl changes)
================================ */
#view-myflow .lcMyFlowHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  flex-wrap:wrap;
}

#view-myflow .lcMyFlowControls{
  display:flex;
  align-items:flex-end;
  gap:12px;
  flex-wrap:wrap;
}

#view-myflow .lcMyFlowAgent{ min-width: 180px; }

#view-myflow .lcMyFlowChips{ display:flex; gap:8px; flex-wrap:wrap; }

#view-myflow .lcChip{
  border:1px solid rgba(15,23,42,.18);
  background: rgba(255,255,255,.75);
  padding:7px 10px;
  border-radius:999px;
  font-size:12px;
  cursor:pointer;
}

#view-myflow .lcChip.is-active{
  background: rgba(255,255,255,.95);
  border-color: rgba(15,23,42,.28);
}

#view-myflow .lcMyFlowCards{
  padding: 14px;
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1100px){
  #view-myflow .lcMyFlowCards{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px){
  #view-myflow .lcMyFlowCards{ grid-template-columns: 1fr; }
}

#view-myflow .lcFlowCard{
  border:1px solid rgba(15,23,42,.10);
  border-radius: 18px;
  background: rgba(255,255,255,.92);
  overflow:hidden;
}

#view-myflow .lcFlowCard__bar{ height: 6px; background: rgba(15,23,42,.14); }

#view-myflow .lcFlowCard__body{ padding: 12px 12px 10px; }

#view-myflow .lcFlowCard__top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }

#view-myflow .lcFlowCard__name{ font-weight: 850; font-size: 14px; line-height: 1.25; }

#view-myflow .lcFlowCard__meta{ margin-top: 4px; font-size: 12px; opacity: .78; }

#view-myflow .lcFlowCard__tag{
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.14);
  white-space: nowrap;
}

#view-myflow .lcFlowCard__bottom{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top: 10px; }

#view-myflow .lcFlowCard__phone{ font-size: 12px; opacity: .78; direction:ltr; unicode-bidi: plaintext; }

#view-myflow .lcFlowBtn{
  border: 1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.96);
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
  font-size: 12px;
}

/* My Flow: "פתח תיק" icon (scoped) */
#view-myflow .lcFlowBtn.lcBtnWithIcon{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-direction: row-reverse; /* label on right, icon on left */
}
#view-myflow .lcFlowBtn.lcBtnWithIcon .lcBtnIcon{
  display: inline-flex;
  width: 16px;
  height: 16px;
  opacity: .92;
}
#view-myflow .lcFlowBtn.lcBtnWithIcon .lcIconSvg{
  width: 16px;
  height: 16px;
}



#view-myflow .lcFlowBtn:active{ transform: translateY(1px); }

/* SLA colors (only inside myflow) */
#view-myflow .sla-red{ background: #ff5a5f; }
#view-myflow .sla-amber{ background: #ffbf3f; }
#view-myflow .sla-green{ background: #28c76f; }
/* SLA visual alert (no popups) */
#view-myflow .lcFlowCard.is-sla-red{ box-shadow: 0 0 0 1px rgba(255,90,95,.25), 0 10px 26px rgba(255,90,95,.12); }
#view-myflow .lcFlowCard.is-sla-amber{ box-shadow: 0 0 0 1px rgba(255,191,63,.22), 0 10px 26px rgba(255,191,63,.10); }
#view-myflow .lcFlowCard.is-sla-green{ box-shadow: 0 0 0 1px rgba(40,199,111,.18), 0 10px 26px rgba(40,199,111,.08); }

/* SLA in Customer File (scoped) */
#customerFull .cfSlaCard .cfSlaMeta{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-top: 10px;
}

#customerFull .cfSlaCard .cfSlaRowSplit{
  display:flex;
  gap:8px;
}
#customerFull .cfSlaCard .cfSlaRowSplit #cfDueAt{ flex: 1 1 auto; min-width: 0; }
#customerFull .cfSlaCard .cfSlaRowSplit #cfDueTime{ width: 120px; flex: 0 0 auto; }
#customerFull .cfSlaBadge{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.14);
  font-weight: 900;
  font-size: 12px;
}
#customerFull .cfSlaBadge.is-red{ background: rgba(255,90,95,.12); border-color: rgba(255,90,95,.25); }
#customerFull .cfSlaBadge.is-amber{ background: rgba(255,191,63,.14); border-color: rgba(255,191,63,.26); }
#customerFull .cfSlaBadge.is-green{ background: rgba(40,199,111,.12); border-color: rgba(40,199,111,.22); }
#customerFull .cfSlaSave{
  padding: 8px 12px;
  border-radius: 14px;
}




/* ----------------------------------
   LeadCore Auth (Premium Login) — scoped
----------------------------------- */
body.lcAuthLock #app{ display:none !important; }
body.lcAuthLock #lcLogin{ display:flex !important; }
body:not(.lcAuthLock) #lcLogin{ display:none !important; }

.lcLogin{
  position:fixed;
  inset:0;
  z-index:9999;
  display:none;
  align-items:center;
  justify-content:center;
  padding:24px;
  background: radial-gradient(1200px 600px at 20% 20%, rgba(214,178,94,.20), transparent 60%),
              radial-gradient(900px 500px at 80% 30%, rgba(10,60,180,.12), transparent 55%),
              linear-gradient(180deg, #f6f9ff, #f2f6ff);
}

.lcLogin__card{
  width:min(520px, 96vw);
  border-radius:22px;
  background: rgba(255,255,255,.85);
  border:1px solid rgba(0,0,0,.08);
  box-shadow: 0 18px 60px rgba(0,0,0,.16);
  padding:18px 18px 16px;
}

.lcLogin__brand{ display:flex; align-items:center; gap:12px; }
.lcLogin__logo{
  width:54px; height:54px;
  border-radius:16px;
  display:flex; align-items:center; justify-content:center;
  font-weight:900;
  letter-spacing:.5px;
  color:#fff;
  background: linear-gradient(135deg, rgba(214,178,94,.95), rgba(120,150,255,.95));
  box-shadow: 0 10px 28px rgba(0,0,0,.14);
}
.lcLogin__brandName{ font-weight:900; letter-spacing:.6px; }
.lcLogin__brandSub{ opacity:.65; font-size:12px; margin-top:2px; }

.lcLogin__title{ font-size:18px; font-weight:900; margin-top:14px; }
.lcLogin__hint{ opacity:.65; font-size:12px; margin-top:4px; }

.lcLogin__form{ margin-top:14px; display:grid; gap:10px; }
.lcLogin__label{ font-size:12px; font-weight:800; opacity:.8; }
.lcLogin__input{
  width:100%;
  padding:12px 12px;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.12);
  background: rgba(255,255,255,.95);
  outline:none;
}
.lcLogin__input:focus{ border-color: rgba(214,178,94,.55); box-shadow: 0 0 0 4px rgba(214,178,94,.16); }

.lcLogin__remember{ display:flex; align-items:center; gap:10px; font-size:12px; opacity:.75; user-select:none; }
.lcLogin__remember input{ width:16px; height:16px; }

.lcLogin__btn{
  width:100%;
  margin-top:6px;
  padding:12px 14px;
  border-radius:16px;
  border:1px solid rgba(0,0,0,.10);
  cursor:pointer;
  font-weight:900;
  background: linear-gradient(135deg, rgba(214,178,94,.95), rgba(120,150,255,.95));
  color:#0b0b0f;
}
.lcLogin__btn:active{ transform: translateY(1px); }

.lcLogin__error{ color:#b00020; font-size:12px; min-height:16px; }
.lcLogin__foot{ margin-top:10px; font-size:12px; opacity:.55; }

/* Users management (scoped helpers) */
#view-users .lcUsers__actions{
  display:flex;
  gap:10px;
  align-items:center;
  justify-content:space-between;
  flex-wrap:wrap;
  margin: 8px 0 12px;
}
#view-users .lcUsers__search{ max-width: 280px; }
#view-users .lcUsers__filter{ max-width: 160px; }



/* ============================
   Users (admin) - scoped extras
   ============================ */
.lcUsers__rowActions{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
.lcUsers__rowActions .btn{ padding:8px 10px; font-size:12px; line-height:1; }
.lcUsers__name{ font-weight:700; }
.lcUserEdit__error{ margin-top:10px; color:#b00020; font-weight:700; font-size:13px; min-height:18px; }


/* LeadCore • Auth user pill (scoped) */
.lcUserPill{
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 10px 26px rgba(0,0,0,0.12);
}
.lcUserPill__dot{
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #22c55e; /* ירוק = מחובר */
  box-shadow: 0 0 0 3px rgba(34,197,94,.18), 0 0 10px rgba(34,197,94,.35);
  opacity: 1;
}
.lcUserPill__text{
  font-weight: 700;
  font-size: 12px;
  opacity: 0.92;
  white-space: nowrap;
}
.lcUserPill__btn{
  border: 0;
  background: rgba(255,255,255,0.14);
  color: inherit;
  border-radius: 999px;
  padding: 6px 10px;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
}
.lcUserPill__btn:hover{ background: rgba(255,255,255,0.20); }



/* =========================================================
   Premium Login Revamp (scoped • safe)
   - Only affects the login overlay classes (.lcLogin*)
   - Does NOT touch global tables/rtl/grid rules
   ========================================================= */
.lcLogin{
  background: transparent !important;
  padding: clamp(16px, 4vw, 28px) !important;
}

.lcLogin::before{
  content:"";
  position:fixed;
  inset:0;
  background:
    radial-gradient(1200px 720px at 70% 12%, rgba(60,130,255,.28), transparent 55%),
    radial-gradient(900px 560px at 18% 86%, rgba(214,178,94,.20), transparent 58%),
    linear-gradient(180deg, rgba(255,255,255,.55), rgba(245,248,255,.78));
  /* glass over the app background */
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
  z-index:-1;
}

.lcLogin__card{
  width: min(620px, 96vw) !important;
  border-radius: 26px !important;
  padding: clamp(18px, 3.6vw, 28px) !important;

  background:
    linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.82));
  border: 1px solid rgba(11,31,74,.14) !important;
  box-shadow:
    0 28px 80px rgba(11,31,74,.18),
    0 1px 0 rgba(255,255,255,.75) inset !important;
  position: relative;
  overflow: hidden;
}

/* top accent */
.lcLogin__card::before{
  content:"";
  position:absolute;
  top:0;
  inset-inline-start:0;
  inset-inline-end:0;
  height: 6px;
  background: linear-gradient(90deg, rgba(214,178,94,.85), rgba(58,108,255,.85));
  opacity:.70;
}

/* subtle inner glow */
.lcLogin__card::after{
  content:"";
  position:absolute;
  inset:-40%;
  background: radial-gradient(circle at 30% 30%, rgba(58,108,255,.12), transparent 55%);
  transform: translateZ(0);
  pointer-events:none;
}

.lcLogin__brand{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  margin-bottom: 10px;
}

.lcLogin__logo{
  width:58px !important;
  height:58px !important;
  border-radius: 18px !important;

  background:
    radial-gradient(16px 16px at 30% 30%, rgba(255,255,255,.35), transparent 60%),
    linear-gradient(135deg, #0b1f4a, #2b4b8a 55%, #3a6cff) !important;
  box-shadow:
    0 16px 34px rgba(11,31,74,.22),
    0 0 0 1px rgba(255,255,255,.30) inset !important;
  position: relative;
  overflow: hidden;
}

.lcLogin__logo::after{
  content:"";
  position:absolute;
  inset:-45%;
  background: linear-gradient(110deg, transparent 40%, rgba(255,255,255,.22), transparent 60%);
  transform: translateX(-60%) rotate(12deg);
  opacity:.0;
}

.lcLogin__card:hover .lcLogin__logo::after{
  opacity:1;
  animation: lcLoginShine 1.05s ease forwards;
}

@keyframes lcLoginShine{
  from { transform: translateX(-60%) rotate(12deg); }
  to   { transform: translateX(60%) rotate(12deg); }
}

.lcLogin__brandName{
  font-weight: 950 !important;
  letter-spacing: .8px !important;
  color: #0b1f4a !important;
}

.lcLogin__brandSub{
  letter-spacing: 1.6px !important;
  color: rgba(11,31,74,.65) !important;
}

.lcLogin__title{
  margin-top: 12px !important;
  font-size: 22px !important;
  font-weight: 950 !important;
  letter-spacing: .2px !important;
  color: #0f172a !important;
}

.lcLogin__hint{
  margin-top: 4px !important;
  color: rgba(15,23,42,.68) !important;
  font-size: 13px !important;
}

.lcLogin__form{
  margin-top: 18px !important;
  display:grid;
  gap: 10px;
}

.lcLogin__label{
  font-size: 12px !important;
  font-weight: 900 !important;
  color: rgba(43,75,138,.85) !important;
  margin-top: 6px !important;
}

.lcLogin__input{
  height: 48px !important;
  padding: 12px 14px !important;
  border-radius: 16px !important;
  border: 1px solid rgba(11,31,74,.16) !important;
  background: rgba(255,255,255,.90) !important;
  box-shadow: 0 10px 22px rgba(11,31,74,.06);
  outline: 0;
  transition: box-shadow .15s ease, border-color .15s ease, transform .12s ease;
}

.lcLogin__input::placeholder{ color: rgba(15,23,42,.45); }

.lcLogin__input:focus{
  border-color: rgba(58,108,255,.38) !important;
  box-shadow: 0 0 0 4px rgba(60,130,255,.16), 0 16px 34px rgba(11,31,74,.10) !important;
  transform: translateY(-1px);
}

.lcLogin__remember{
  margin-top: 6px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:flex-start !important;
  gap:10px !important;
  padding: 10px 12px !important;
  border-radius: 16px !important;
  border: 1px solid rgba(11,31,74,.10) !important;
  background: rgba(231,240,255,.55) !important;
}

.lcLogin__remember input[type="checkbox"]{
  width:18px; height:18px;
  accent-color: #3a6cff;
}

.lcLogin__btn{
  margin-top: 10px !important;
  height: 48px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(43,75,138,.22) !important;
  color:#fff !important;
  font-weight: 950 !important;
  letter-spacing: .2px !important;
  background: linear-gradient(135deg, #2b4b8a, #3a6cff) !important;
  box-shadow: 0 18px 34px rgba(58,108,255,.18);
  cursor:pointer;
  transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
}

.lcLogin__btn:hover{
  transform: translateY(-1px);
  box-shadow: 0 22px 40px rgba(58,108,255,.22);
  filter: saturate(1.05);
}

.lcLogin__btn:active{ transform: translateY(0); }

.lcLogin__error{
  margin-top: 8px !important;
  padding: 10px 12px !important;
  border-radius: 14px !important;
  background: rgba(239,68,68,.08) !important;
  border: 1px solid rgba(239,68,68,.22) !important;
  color: #7f1d1d !important;
  font-weight: 800 !important;
  min-height: 18px;
}

.lcLogin__foot{
  margin-top: 14px !important;
  padding-top: 12px !important;
  border-top: 1px solid rgba(11,31,74,.10) !important;
  color: rgba(15,23,42,.60) !important;
  font-size: 12px !important;
}

/* Reduce motion */
@media (prefers-reduced-motion: reduce){
  .lcLogin__card:hover .lcLogin__logo::after{ animation: none !important; }
  .lcLogin__input, .lcLogin__btn{ transition: none !important; }
}


/* ===== Auth Pill placement (top-right, across all views) ===== */
.topbar{ position: relative; }
.topbar__auth{
  position: absolute;
  inset-inline-end: 16px; /* right in RTL */
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  z-index: 5;
  pointer-events: auto;
}
/* ensure pill is always above center search when visible */
.topbar__auth .lcUserPill{ display: inline-flex; }

@media (max-width: 900px){
  .topbar__auth{
    inset-inline-end: 10px;
    top: auto;
    bottom: 10px;
    transform: none;
  }
}

/* ===== Sidebar auth pill placement (scoped) ===== */
.sidebar__auth{
  padding: 10px 0 0;
}
.sidebar__auth .lcUserPill{
  width: calc(100% - 24px);
  margin: 0 12px 8px;
  border-radius: 14px;
  justify-content: space-between;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: 0 10px 26px rgba(0,0,0,0.10);
}
.sidebar__auth .lcUserPill__text{
  flex: 1;
  text-align: start;
}
.sidebar__auth .lcUserPill__btn{
  border-radius: 12px;
}



/* Premium tweak for auth pill (scoped) */
.lcUserPill{
  background: linear-gradient(180deg, rgba(255,255,255,.65), rgba(235,242,255,.55));
  border: 1px solid rgba(43,75,138,.20);
  color: rgba(15,23,42,.92);
}
.lcUserPill__btn{
  background: rgba(43,75,138,.10);
}
.lcUserPill__btn:hover{ background: rgba(43,75,138,.14); }

/* ===== LeadCore • Customer File Premium Groups (scoped) ===== */
#customerFull .cfHeaderPremium{
  padding: 14px 16px;
  border-radius: 22px;
}
#customerFull .cfHeaderPremium__head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px 14px;
  flex-wrap: wrap;
}
#customerFull .cfHeaderPremium__title{
  font-size: 18px;
  font-weight: 950;
  color: rgba(10,18,30,.92);
}
#customerFull .cfHeaderPremium__sub{
  margin-top:2px;
  font-size: 12px;
  color: rgba(15,23,42,.60);
}
#customerFull .cfHeaderPremium__chips{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items:center;
}
#customerFull .cfChip{
  display:flex;
  align-items:center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.82);
  box-shadow: 0 8px 16px rgba(15,23,42,.06);
  min-width: 180px;
  justify-content: center;
}
#customerFull .cfChip__icon{ opacity:.85; }
#customerFull .cfChip__val{
  font-weight: 900;
  font-size: 14px;
  color: rgba(10,18,30,.92);
  direction:ltr;
  text-align:left;
  overflow-wrap:anywhere;
}

#customerFull .cfGroups{
  margin-top: 14px;
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
#customerFull .cfGroupCard{
  border-radius: 18px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.78);
  padding: 12px 12px;
  box-shadow: 0 10px 22px rgba(11,31,74,.06);
}
#customerFull .cfGroupCard__title{
  font-weight: 950;
  font-size: 13px;
  color: rgba(43,75,138,.92);
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(15,23,42,.08);
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
}
#customerFull .cfGroupRows{ display:block; }
#customerFull .cfRow{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid rgba(15,23,42,.06);
}
#customerFull .cfRow:last-child{ border-bottom: 0; }
#customerFull .cfRow__k{
  font-size: 12px;
  color: rgba(43,75,138,.72);
  font-weight: 900;
  white-space: nowrap;
}
#customerFull .cfRow__v{
  font-size: 13px;
  font-weight: 900;
  color: rgba(10,18,30,.92);
  min-width:0;
  overflow-wrap:anywhere;
}
#customerFull .cfRow--inline .cfRow__v{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap: 8px;
}
#customerFull .cfInlineVal{
  font-weight: 950;
  direction:ltr;
  text-align:left;
}
#customerFull .cfInlineSep{ opacity:.45; }

@media (max-width: 980px){
  #customerFull .cfHeaderPremium__chips{ width:100%; }
  #customerFull .cfChip{ min-width: 0; flex:1 1 180px; }
  #customerFull .cfGroups{ grid-template-columns: 1fr; }
}



/* ===== Fullscreen Modals (CRM-style) — scoped (no global overrides) ===== */
#modalPolicy .modal__panel,
#modalPolicyAction .modal__panel{
  top:0 !important;
  left:0 !important;
  transform:none !important;
  width:100vw !important;
  height:100vh !important;
  max-width:none !important;
  border-radius:0 !important;
  display:flex;
  flex-direction:column;
}

/* keep header visible */
#modalPolicy .modal__head,
#modalPolicyAction .modal__head{
  position: sticky;
  top: 0;
  z-index: 20;
}

/* Policy Add form body scroll */
#policyForm.modal__body{
  flex:1;
  overflow:auto;
  padding: 18px;
  display:flex;
  flex-direction:column;
  gap:14px;
}

/* make footer row stick to bottom (buttons always visible) */
#policyForm > .divider{
  margin-top:auto !important;
}
#policyForm > .row.row--between{
  position: sticky;
  bottom: 0;
  padding: 14px 0 10px;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(15,23,42,.10);
}

/* Policy Action modal body */
#modalPolicyAction .modal__body{
  flex:1;
  overflow:auto;
  padding: 18px !important;
}

/* Slightly wider grid in fullscreen */
#modalPolicy .formGrid{
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 720px){
  #modalPolicy .formGrid{ grid-template-columns: 1fr; }
}


/* === Customer File scoped actions (call/email/docs) === */
#customerFull .cfChip__action{
  border: 1px solid rgba(43,75,138,.22);
  background: rgba(255,255,255,.92);
  padding: 8px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 900;
  line-height: 1;
}
#customerFull .cfChip__action:hover{ transform: translateY(-1px); }
#customerFull .cfChip__action:active{ transform: translateY(0); }

#customerFull .cfChip--phone .cfChip__val,
#customerFull .cfChip--email .cfChip__val{
  direction:ltr;
  text-align:left;
}

#customerFull .dashCard--action{
  text-align: right;
  cursor: pointer;
  width: 100%;
}
#customerFull .dashCard--action:hover{ transform: translateY(-1px); }
#customerFull .dashCard--action:active{ transform: translateY(0); }



/* ===========================
   Customer Docs (Full Screen)
   Scoped: does not touch globals
   =========================== */
#customerDocs{
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: none;
}
#customerDocs.is-open{ display:block; }

#customerDocs .customerDocs__backdrop{
  position:absolute;
  inset:0;
  background: rgba(0,0,0,.28);
}

#customerDocs .customerDocs__panel{
  position:absolute;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(255,255,255,.85);
  backdrop-filter: blur(10px);
  display:flex;
  flex-direction:column;
  border-radius: 0;
  overflow:hidden;
}

#customerDocs .customerDocs__top{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 2;
}

#customerDocs .customerDocs__kicker{
  font-weight: 950;
  letter-spacing: .3px;
  color: rgba(43,75,138,.92);
  font-size: 12px;
}

#customerDocs .customerDocs__title{
  font-size: 18px;
  font-weight: 950;
  margin-top: 3px;
  color: rgba(10,18,30,.95);
}

#customerDocs .customerDocs__sub{
  margin-top: 6px;
  max-width: 900px;
}

#customerDocs .customerDocs__body{
  flex: 1;
  overflow:auto;
  padding: 16px;
}

#customerDocs .cdLayout{
  display:grid;
  grid-template-columns: 420px 1fr;
  gap: 14px;
  align-items:start;
}

#customerDocs .cdCard{
  border-radius: 18px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.82);
  box-shadow: 0 12px 28px rgba(15,23,42,.08);
  padding: 14px 14px;
}

#customerDocs .cdCard__head{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap: 12px;
  margin-bottom: 10px;
}

#customerDocs .cdCard__title{
  font-weight: 950;
  font-size: 13px;
  color: rgba(43,75,138,.92);
  margin-bottom: 10px;
}

#customerDocs .cdCard__head .cdCard__title{ margin-bottom: 0; }

#customerDocs .cdTwo{
  display:grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
#customerDocs .cdTwo__col{
  padding: 10px;
  border-radius: 14px;
  border: 1px dashed rgba(43,75,138,.22);
  background: rgba(255,255,255,.70);
}

#customerDocs .cdRowActions{
  display:flex;
  justify-content:flex-end;
  gap: 8px;
  flex-wrap:wrap;
}

#customerDocs .cdLinkBtn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(43,75,138,.18);
  background: rgba(255,255,255,.92);
  font-weight: 900;
  cursor:pointer;
  white-space: nowrap;
}
#customerDocs .cdLinkBtn:hover{ transform: translateY(-1px); }
#customerDocs .cdLinkBtn:active{ transform: translateY(0); }

#customerDocs .cdLinkBtn--danger{
  border-color: rgba(180,30,30,.22);
  color: rgba(140,18,18,.92);
}

@media (max-width: 980px){
  #customerDocs .cdLayout{ grid-template-columns: 1fr; }
}
