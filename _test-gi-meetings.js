const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;
const src = fs.readFileSync(path.join(root, "gi-meetings.js"), "utf8");
const sandbox = { console, TextDecoder, Uint8Array, DataView, Blob, Response, DecompressionStream };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "gi-meetings.js" });
const ui = sandbox.MeetingsUI;
assert.ok(ui, "MeetingsUI");

assert.strictEqual(ui.normalizeIsraeliId("0000000059835926"), "59835926");
assert.strictEqual(ui.normalizeIsraeliId("055863195"), "55863195");
assert.strictEqual(ui.normalizeIsraeliId("59835926"), "59835926");
assert.strictEqual(ui.displayId("25874196"), "025874196");

const grouped = ui.groupWorkbookRows([
  { "שם לקוח": "יאיר יוסף", "תז": "059835926", "מס פוליסה": "1", "חברה": "מגדל", "נציג": "עומר", "מס טלפון": "050" },
  { "שם לקוח": "יאיר יוסף", "תז": "59835926", "מס פוליסה": "2", "חברה": "הפניקס", "נציג": "עומר" }
]);
assert.strictEqual(grouped.length, 1);
assert.strictEqual(grouped[0].policies.length, 2);
assert.strictEqual(grouped[0].idNumber, "59835926");
const spaced = ui.groupWorkbookRows([
  { "שם לקוח": "מריה שארפמן", "תז": 537016569, "מס טלפון ": "053-7016569", "צוות ": "עצמאי", "נציג": "עומר" }
]);
assert.strictEqual(spaced.length, 1);
assert.strictEqual(spaced[0].phone, "053-7016569");
assert.strictEqual(spaced[0].team, "עצמאי");
assert.ok(fs.readFileSync(path.join(root, "gi-meetings.js"), "utf8").includes("const XLSX = global.XLSX;"));

const portfolio = ui.portfolioSummary({
  full_name: "יאיר יוסף",
  payload: {
    newPolicies: [{ id: "npol_1", company: "מגדל", monthlyPremium: "120", policyNumber: "9" }],
    operational: { newPolicies: [{ id: "npol_prod_2", company: "הפניקס", premium: "80", productionImport: { source: "file" } }] }
  }
});
assert.strictEqual(portfolio.total, 200);
assert.strictEqual(portfolio.policies[1].production, true);
assert.strictEqual(ui.customerAddress({
  city: "רמת גן",
  payload: { insureds: [{ data: { street: "הרצל", houseNumber: "18", city: "רמת גן" } }] }
}), "הרצל 18, רמת גן");
assert.strictEqual(ui.customerAddress({ city: "חיפה" }), "חיפה");
const file = ui.fileFacts({
  full_name: "מריה שארפמן",
  city: "חיפה",
  payload: JSON.stringify({
    primary: { street: "ויצמן", houseNumber: "4", city: "חיפה" },
    insureds: [{ data: { existingPolicies: [{ id: "e1", company: "מגדל", premiumMonthly: "80" }] } }]
  })
});
assert.strictEqual(file.address, "ויצמן 4, חיפה");
assert.strictEqual(file.premium, 80);
assert.strictEqual(file.name, "מריה שארפמן");
assert.strictEqual(ui.isAssignableAgent({ name: "עומר", role: "נציג", active: true }), true);
assert.strictEqual(ui.isAssignableAgent({ username: "דנה", role: "agent", active: true }), true);
assert.strictEqual(ui.isAssignableAgent({ name: "מנהל", role: "manager", active: true }), true);
assert.strictEqual(ui.isAssignableAgent({ name: "כבוי", role: "agent", active: false }), false);
assert.strictEqual(ui.matchUserName("עומר כהן", "עומ"), true);
assert.strictEqual(ui.matchUserName("עומר כהן", "דנה"), false);
assert.ok(src.includes("האם השכר שלך מעל 10 אלף"));
assert.ok(src.includes("האם את/ה מאשר/ת להוציא מסלקה עבורך"));
assert.deepStrictEqual(ui.keepLoadedRows([{ idNumber: "1" }], []), [{ idNumber: "1" }]);
assert.strictEqual(ui.keepLoadedRows([{ idNumber: "1" }], [{ idNumber: "2" }]).length, 1);
const agentLists = ui.screenLists(
  { id: "a1", role: "agent" },
  [{ idNumber: "1", name: "מהקובץ" }],
  [
    { id: "m1", assignee_id: "a1", customer_name: "שלי", id_number: "9", answers: { address: "הרצל 1", premium: 100 } },
    { id: "m2", assignee_id: "a2", customer_name: "לא שלי", id_number: "8" }
  ]
);
assert.strictEqual(agentLists.customers.length, 1);
assert.strictEqual(agentLists.customers[0].name, "שלי");
assert.strictEqual(agentLists.customers[0].address, "הרצל 1");
assert.strictEqual(agentLists.meetings.length, 0);
const managerLists = ui.screenLists(
  { id: "m", role: "manager" },
  [{ idNumber: "1", name: "מהקובץ" }],
  [{ id: "m1", assignee_id: "a1", customer_name: "שלי", id_number: "9" }]
);
assert.strictEqual(managerLists.customers[0].name, "מהקובץ");
assert.strictEqual(managerLists.meetings.length, 1);
assert.strictEqual(managerLists.assigned.length, 0);
const managerOwn = ui.screenLists(
  { id: "m", role: "manager" },
  [{ idNumber: "1", name: "מהקובץ" }],
  [{
    id: "m1",
    assignee_id: "m",
    customer_name: "שלי",
    id_number: "9",
    meeting_date: "2026-11-24",
    answers: { phone: "050", address: "הרצל 1", premium: 80 },
    masleka: { products: [{ company: "מנורה" }] }
  }]
);
assert.strictEqual(managerOwn.assigned[0].name, "שלי");
assert.strictEqual(managerOwn.assigned[0].phone, "050");
assert.strictEqual(managerOwn.assigned[0].masleka.products[0].company, "מנורה");
assert.strictEqual(managerOwn.customers[0].name, "מהקובץ");
const namedAssignee = ui.screenLists(
  { id: "local-itai", name: "איתי", role: "agent" },
  [{ idNumber: "1", name: "מהקובץ" }],
  [{
    id: "m-name",
    assignee_id: "a_real",
    assignee_name: "איתי",
    customer_name: "מריה",
    id_number: "9",
    meeting_date: "2026-11-24",
    answers: { phone: "052", address: "הרצל 2" },
    masleka_file: { name: "masleka.zip", storagePath: "files/masleka.zip" }
  }]
);
assert.strictEqual(namedAssignee.customers.length, 1);
assert.strictEqual(namedAssignee.customers[0].name, "מריה");
assert.strictEqual(namedAssignee.customers[0].maslekaFile.storagePath, "files/masleka.zip");
const opsLists = ui.screenLists(
  { id: "ops1", role: "opsAgent" },
  [],
  [{ id: "m-ops", assignee_id: "ops1", assignee_name: "דנה", customer_name: "לקוח", id_number: "9", answers: { phone: "050" } }]
);
assert.strictEqual(opsLists.customers.length, 1);
assert.strictEqual(opsLists.customers[0].name, "לקוח");
assert.strictEqual(opsLists.customers[0].assigneeName, "דנה");
assert.strictEqual(ui.treatmentStatus({ status: "open" }).label, "התיק עדיין עומד ללא נגיעה");
assert.strictEqual(ui.treatmentStatus({ status: "in_treatment" }).label, "נפתח התיק והתחיל טיפול");
assert.strictEqual(ui.treatmentStatus({ status: "closed" }).label, "העסקה נסגרה");
assert.strictEqual(ui.treatmentStatus({ status: "not_closed" }).label, "העסקה לא נסגרה");
assert.strictEqual(ui.withoutAssigned(
  [{ idNumber: "59835926", name: "נשאר" }, { idNumber: "055863195", name: "שויך" }],
  [{ id_number: "55863195" }]
).map((row) => row.name).join(","), "נשאר");
const held = ui.keepAssigned(
  [{ id: "old", customer_name: "ישן" }],
  { id: "pm_1", customer_name: "חדש", assignee_name: "איתי" }
);
assert.strictEqual(held[0].customer_name, "חדש");
assert.strictEqual(held.length, 2);
assert.strictEqual(ui.keepAssigned(held, { id: "pm_1", customer_name: "חדש" }).length, 2);
const keptRows = [{ name: "יאיר", idNumber: "59835926", phone: "050", address: "חיפה", premium: 120, policies: [{ id: "1" }] }];
const box = {
  data: {},
  setItem(key, value) { this.data[key] = value; },
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; }
};
assert.strictEqual(ui.rememberLoadedRows(box, { id: "surveyor-1", name: "סוקרת" }, keptRows), true);
assert.strictEqual(ui.recallLoadedRows(box, { id: "surveyor-1" })[0].name, "יאיר");
assert.strictEqual(ui.recallLoadedRows(box, { id: "surveyor-1" })[0].phone, "050");
assert.strictEqual(ui.recallLoadedRows(box, { id: "other" }).length, 0);
assert.strictEqual(ui.loadedRowsKey({ id: "surveyor-1" }), "giMeetings.loadedRows.v2.surveyor-1");
const legacy = {
  data: { "giMeetings.loadedRows": JSON.stringify([{ name: "מהביקור", idNumber: "59835926" }]) },
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; }
};
const named = {
  data: { "giMeetings.loadedRows.v2.אוריה סומך": JSON.stringify([{ name: "מהשם", idNumber: "314567821" }]) },
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; }
};
const collected = ui.collectLoadedRows(named, legacy, { id: "manager-1", name: "אוריה סומך" });
assert.strictEqual(collected.map((row) => row.name).join(","), "מהשם,מהביקור");
assert.strictEqual(ui.rememberLoadedRows(box, {}, keptRows), false);
let writes = 0;
const tight = {
  value: "",
  setItem(_key, value) {
    writes += 1;
    if (writes === 1) throw new Error("quota");
    this.value = value;
  },
  getItem() { return this.value; }
};
assert.strictEqual(ui.rememberLoadedRows(tight, { id: "surveyor-1" }, keptRows), true);
assert.strictEqual(ui.recallLoadedRows(tight, { id: "surveyor-1" })[0].name, "יאיר");
assert.ok(!ui.recallLoadedRows(tight, { id: "surveyor-1" })[0].policies);
assert.ok(src.includes("localStorage"));
assert.ok(src.includes('ui.board = "files"'));
assert.ok(src.includes("תיקים בטיפול"));
assert.ok(src.includes("העסקה לא נסגרה"));
assert.ok(src.includes("expandUploads"));
const rosterAgents = ui.rosterFirst(
  [{ id: "local-itai", name: "איתי", role: "agent", active: true }, { id: "local-only", name: "רק מקומי", role: "agent", active: true }],
  [{ id: "a_real", name: "איתי", role: "agent", active: true }]
);
assert.strictEqual(rosterAgents.find((agent) => agent.name === "איתי").id, "a_real");
assert.strictEqual(rosterAgents.filter((agent) => agent.name === "איתי").length, 1);
assert.ok(rosterAgents.some((agent) => agent.id === "local-only"));
assert.strictEqual(ui.missingTable({ code: "42501", message: "permission denied for table gi_pension_meetings" }), false);
assert.strictEqual(ui.missingTable({ code: "PGRST204", message: "Could not find the 'foo' column of 'gi_pension_meetings' in the schema cache" }), false);
assert.strictEqual(ui.missingTable({ code: "42P01", message: "relation \"gi_pension_meetings\" does not exist" }), true);
assert.strictEqual(ui.missingTable({ code: "PGRST205", message: "Could not find the table 'public.gi_pension_meetings' in the schema cache" }), true);
assert.strictEqual(ui.readAccessToken({ access_token: "live" }, "{\"access_token\":\"stored\"}"), "live");
assert.strictEqual(ui.readAccessToken(null, "{\"access_token\":\"stored\"}"), "stored");
assert.strictEqual(ui.readAccessToken(null, "{\"session\":{\"access_token\":\"nested\"}}"), "nested");
assert.strictEqual(ui.personMatchesAssignee({ id: "local", name: "איתי" }, "a_real", "איתי"), true);
const assigned = ui.screenLists(
  { id: "a1", role: "agent" },
  [],
  [{
    id: "m9",
    assignee_id: "a1",
    customer_name: "שלי",
    id_number: "9",
    meeting_date: "2026-11-24",
    notes: "להתקשר",
    answers: { phone: "050", address: "הרצל 1", premium: 100 },
    masleka: { products: [{ name: "פנסיה", company: "מנורה" }], savings: 140.5 }
  }]
);
assert.strictEqual(assigned.customers[0].meetingDate, "2026-11-24");
assert.strictEqual(assigned.customers[0].notes, "להתקשר");
assert.strictEqual(assigned.customers[0].masleka.products[0].company, "מנורה");
assert.ok(src.includes("gi-pension-assign"));
assert.ok(src.includes("giMeet__rowExtra"));
const detailSrc = src.slice(src.indexOf("function detailHtml"), src.indexOf("function personOwner"));
assert.ok(src.includes("giMeet__topicSum") && src.includes("data-topic") && !detailSrc.includes("פרמיה בתיק"));
assert.ok(src.includes("function topicIcon") && src.includes("M4 16l5-5") && src.includes("M12 3.5l7 2.5"));
assert.ok(src.includes('if ((changed || stampChanged) && ui.mode === "home") paint();'));

const branches = { surv: "מודיעין", agentA: "מודיעין", agentB: "חיפה" };
assert.strictEqual(ui.customerVisibleToSurveyor({ agent_id: "agentA" }, "surv", branches), true);
assert.strictEqual(ui.customerVisibleToSurveyor({ agent_id: "agentB" }, "surv", branches), false);
assert.strictEqual(ui.customerVisibleToSurveyor({ agent_id: "agentA" }, "missing", branches), false);

assert.strictEqual(ui.canOpen({ role: "referent" }), true);
assert.strictEqual(ui.canOpen({ role: "agent" }), true);
assert.strictEqual(ui.canOpen({ role: "owner" }), true);
assert.strictEqual(ui.canOpen({ role: "adminLite" }), true);
assert.strictEqual(ui.canOpen({ role: "מנהל" }), true);
assert.strictEqual(ui.canOpen({ role: "ops" }), true);
assert.strictEqual(ui.canCreate({ role: "referent" }), true);
assert.strictEqual(ui.canCreate({ role: "manager" }), true);
assert.strictEqual(ui.canCreate({ role: "owner" }), true);
assert.strictEqual(ui.canCreate({ role: "מנהל" }), true);
assert.strictEqual(ui.canCreate({ role: "מנהל מערכת" }), true);
assert.strictEqual(ui.canCreate({ role: "agent" }), false);
assert.ok(src.indexOf("הצג פירוט תיק") < 0);
assert.ok(src.indexOf('factHtml("טלפון"') >= 0);
assert.ok(src.indexOf("gi_login_roster") >= 0);
assert.ok(src.indexOf("https://vhvlkerectggovfihjgm.supabase.co") >= 0);
assert.ok(src.indexOf("אין משתמשים פעילים") < 0);
sandbox.GI_MEETINGS_HOST = {
  auth: function () {
    return {
      current: { id: "u1", name: "אוריה", role: "custom" },
      isAdmin: function () { return false; },
      isManager: function () { return true; },
      isTeamManager: function () { return false; },
      isReferent: function () { return false; }
    };
  }
};
assert.strictEqual(ui.canOpen(), true);
assert.strictEqual(ui.canCreate(), true);
assert.strictEqual(ui.canOpen({ role: "ops" }), true);

const referent = { id: "s1", role: "referent" };
const agent = { id: "a1", role: "agent" };
const meeting = { created_by_id: "s1", assignee_id: "a1" };
assert.strictEqual(ui.meetingVisible(meeting, referent), true);
assert.strictEqual(ui.meetingVisible(meeting, agent), true);
assert.strictEqual(ui.meetingVisible(meeting, { id: "x", role: "agent" }), false);
assert.strictEqual(ui.meetingVisible(meeting, { id: "m", role: "manager" }), true);

const xml = `<?xml version="1.0"?>
<Mimshak>
  <KoteretKovetz><TAARICH-BITZUA>20260727160803</TAARICH-BITZUA></KoteretKovetz>
  <YeshutYatzran>
    <SHEM-YATZRAN>מנורה</SHEM-YATZRAN>
    <Mutzarim>
      <Mutzar>
        <NetuneiMutzar>
          <SUG-MUTZAR>2</SUG-MUTZAR>
          <YeshutLakoach>
            <MISPAR-ZIHUY-LAKOACH>0000000059835926</MISPAR-ZIHUY-LAKOACH>
            <SHEM-PRATI>יאיר</SHEM-PRATI>
            <SHEM-MISHPACHA>יוסף</SHEM-MISHPACHA>
            <TAARICH-LEYDA>19670928</TAARICH-LEYDA>
          </YeshutLakoach>
          <YeshutMaasik><SHEM-MAASIK>משרד החוץ</SHEM-MAASIK></YeshutMaasik>
        </NetuneiMutzar>
        <HeshbonotOPolisot>
          <HeshbonOPolisa>
            <MISPAR-POLISA-O-HESHBON>59835926</MISPAR-POLISA-O-HESHBON>
            <SHEM-TOCHNIT>מנורה מבטחים פנסיה</SHEM-TOCHNIT>
            <STATUS-POLISA-O-CHESHBON>1</STATUS-POLISA-O-CHESHBON>
            <BlockItrot><Yitrot>
              <PerutYitrot><KOD-SUG-HAFRASHA>1</KOD-SUG-HAFRASHA><TOTAL-CHISACHON-MTZBR>100.50</TOTAL-CHISACHON-MTZBR></PerutYitrot>
              <PerutYitrot><KOD-SUG-HAFRASHA>2</KOD-SUG-HAFRASHA><TOTAL-CHISACHON-MTZBR>40</TOTAL-CHISACHON-MTZBR></PerutYitrot>
            </Yitrot></BlockItrot>
            <PirteiHafkadaAchrona><TAARICH-HAFKADA-ACHARON>202506</TAARICH-HAFKADA-ACHARON><TOTAL-HAFKADA>510.08</TOTAL-HAFKADA></PirteiHafkadaAchrona>
            <YitraLefiGilPrisha><GIL-PRISHA>67</GIL-PRISHA><TOTAL-CHISACHON-MITZTABER-TZAFUY>616651.10</TOTAL-CHISACHON-MITZTABER-TZAFUY></YitraLefiGilPrisha>
          </HeshbonOPolisa>
        </HeshbonotOPolisot>
      </Mutzar>
    </Mutzarim>
  </YeshutYatzran>
</Mimshak>`;
const parsed = ui.parseMaslekaPackage([{ name: "a.xml", text: xml }, { name: "a.xml", text: xml.replace("20260727160803", "20260701000000") }]);
assert.strictEqual(parsed.products.length, 1, "dedupe");
assert.strictEqual(parsed.products[0].total, 140.5);
assert.strictEqual(parsed.products[0].person.id, "59835926");
assert.strictEqual(parsed.products[0].employer, "משרד החוץ");
assert.strictEqual(parsed.savings, 140.5);
assert.strictEqual(parsed.products[0].when, "20260727160803");
const inner = xml.replace(/<\?xml[^>]*>/, "").replace("<Mimshak>", "").replace("</Mimshak>", "");
const wrapped = ui.parseMaslekaPackage([{ name: "pack.dat", text: "<wrap><ns:Mimshak>" + inner + "</ns:Mimshak></wrap>" }]);
assert.strictEqual(wrapped.products.length, 1);
assert.strictEqual(wrapped.products[0].company, parsed.products[0].company);

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert.ok(app.includes('v === "meetings"'), "referent nav");
assert.ok(app.includes('safe !== "meetings"'), "referent goView");
assert.ok(app.includes('safe === "meetings"'), "render meetings");
assert.ok(app.includes("window.GI_MEETINGS_HOST"), "host");
assert.strictEqual((app.match(/campaignLeadCreatedByName\(lead, safeTrim\(Auth\.current\?\.name\)\)/g) || []).length, 2);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(html.includes('id="navMeetings"'));
assert.ok(html.includes('id="view-meetings"'));
assert.ok(html.includes("gi-meetings.js"));

const phone = fs.readFileSync(path.join(root, "phone/phone.js"), "utf8");
assert.ok(phone.includes("is-pension"));
assert.ok(phone.includes("loadPensionMeetings"));
assert.ok(phone.includes("gi-pension-assign"));
assert.ok(phone.includes("data-pension-sheet"));
assert.ok(phone.includes("pensionCard"));
assert.ok(phone.includes("data-pension-topic"));
assert.ok(phone.includes("מוצר אחד"));
assert.ok(phone.includes("pensionTopic__body"));
assert.ok(phone.includes("גמל והשתלמות"));
assert.ok(phone.includes("https://wa.me/972"));
assert.ok(phone.includes("stampDateIL(item.meeting_date)"));
assert.ok(phone.includes("assignee_name"));
assert.ok(!phone.includes("פגישות ששויכו"));
assert.ok(phone.includes("האם השכר שלך מעל 10 אלף"));
assert.ok(phone.includes("pensionHero__save"));
assert.ok(phone.includes("pensionAnswers"));
assert.ok(!phone.includes("pensionHero__mini"));
assert.ok(phone.includes("סה״כ צבירה"));
assert.ok(!phone.includes("pensionKpis"));
assert.ok(phone.includes('systemNotify("פגישה חדשה"'));
assert.ok(phone.includes('title.textContent = "הלקוח"'));
assert.ok(phone.includes("העסקה לא נסגרה"));
assert.ok(phone.includes("answers.address"));
assert.ok(phone.includes('id.indexOf("meet_") === 0'));
const phoneCss = fs.readFileSync(path.join(root, "phone/phone.css"), "utf8");
assert.ok(phoneCss.includes("#screenMeetings .monthCal__day.is-pension"));
assert.ok(phoneCss.includes("#16A34A"));
assert.ok(phoneCss.includes(".pensionHero__save b"));
assert.ok(phoneCss.includes(".pensionTopic.is-open .pensionTopic__chev"));
assert.ok(/\.pensionTopic__sum\s*\{[^}]*width:\s*8\.2em[^}]*text-align:\s*left/.test(phoneCss));
assert.ok(/\.pensionTopic__name\s*\{[^}]*flex:\s*1/.test(phoneCss));
assert.ok(/\.pensionHero__band\s*\{[^}]*#071428[^}]*linear-gradient\(165deg/.test(phoneCss));
assert.ok(/\.pensionHero__ico,\s*\.pensionHero__act--dial,\s*\.pensionTopic__mark\s*\{[^}]*#071428/.test(phoneCss));
assert.ok(phone.includes("pensionTopic__mark") && phone.includes("M4 16l5-5") && phone.includes("M12 3.5l7 2.5"));
assert.ok(/\.pensionAnswer\s*\{[^}]*inset -3px 0 0 #0E2A52/.test(phoneCss));
assert.ok(/\.pensionHero__band\s*\{[^}]*position:\s*sticky[^}]*calc\(18px \+ var\(--safe-t\)\)/.test(phoneCss));
assert.ok(/\.pensionSheet__body\s*\{[^}]*overscroll-behavior:\s*none/.test(phoneCss));
assert.ok(/\.pensionSheet > \.bar\s*\{[^}]*display:\s*none/.test(phoneCss));
assert.ok(/\.pensionHero__save span\s*\{[^}]*font-size:\s*16px/.test(phoneCss));
const heroFn = phone.slice(phone.indexOf("function pensionHeroHtml"), phone.indexOf("function paintPensionSheet"));
assert.ok(heroFn.includes("<rect") && heroFn.includes("<circle") && !heroFn.includes(">#<"));
assert.ok(heroFn.includes("data-pension-back") && !heroFn.includes("pensionHero__mark"));
assert.ok(heroFn.includes("pensionHero__id") && !heroFn.includes("pensionHero__meta") && !heroFn.includes(">תעודת זהות<"));
assert.ok(heroFn.includes('aria-label="וואטסאפ"') && !heroFn.includes(">וואטסאפ<"));
assert.ok(/\.pensionSheet__body\s*\{[^}]*touch-action:\s*pan-y[^}]*calc\(96px \+ var\(--safe-b\)\)/.test(phoneCss));

const sampleDir = "/tmp/masleka/clients";
if (fs.existsSync(sampleDir)) {
  const files = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach((name) => {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".xml") && full.includes("יאיר")) files.push({ name, text: fs.readFileSync(full, "utf8") });
    });
  })(sampleDir);
  const live = ui.parseMaslekaPackage(files);
  assert.ok(live.products.length >= 4, "live products " + live.products.length);
  assert.ok(live.savings > 1000000, "live savings " + live.savings);
  const risk = live.products.find((item) => item.sug === "6");
  assert.ok(risk && risk.deathCover > 1000000, "death cover");
}

(async () => {
  const seen = [];
  sandbox.GI_MEETINGS_HOST = {
    auth: function () {
      return {
        current: { id: "m1", name: "אוריה", role: "owner" },
        isAdmin: function () { return true; },
        isManager: function () { return true; },
        isTeamManager: function () { return false; },
        isReferent: function () { return false; }
      };
    },
    state: function () {
      return {
        data: {
          customers: [{ id: "light", idNumber: "26533711", fullName: "קליל", agentId: "a9", city: "תל אביב" }],
          agents: [
            { id: "a1", name: "עומר כהן", role: "נציג", active: true },
            { id: "a2", username: "דנה לוי", role: "agent", active: true },
            { id: "a3", name: "מנהלת", role: "manager", active: true }
          ],
          meta: { agentsShadow: [{ id: "a4", name: "צל", role: "agent", active: true }] }
        }
      };
    },
    client: function () {
      return {
        from: function () {
          return {
            select: function () {
              return {
                in: function (_col, ids) {
                  seen.push(ids.slice());
                  return Promise.resolve({
                    data: [{
                      id: "full",
                      full_name: "מריה שארפמן",
                      id_number: "026533711",
                      phone: "053-7016569",
                      city: "רמת גן",
                      agent_id: "a1",
                      payload: {
                        primary: { street: "הרצל", houseNumber: "18", city: "רמת גן" },
                        insureds: [{ data: { existingPolicies: [{ id: "p1", company: "מגדל", premiumMonthly: "150" }] } }]
                      }
                    }],
                    error: null
                  });
                }
              };
            }
          };
        },
        rpc: function () {
          return Promise.resolve({ data: "[]", error: null });
        }
      };
    }
  };
  await ui.ensureAgents();
  const names = ui.agents().map((agent) => agent.name);
  assert.ok(names.indexOf("עומר כהן") >= 0);
  assert.ok(names.indexOf("דנה לוי") >= 0);
  assert.ok(names.indexOf("מנהלת") >= 0);
  assert.ok(names.indexOf("צל") >= 0);
  assert.strictEqual(names.length, 4);
  const found = await ui.lookupCustomers(["26533711"]);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(ui.fileFacts(found[0]).address, "הרצל 18, רמת גן");
  assert.strictEqual(ui.fileFacts(found[0]).premium, 150);
  assert.strictEqual(ui.fileFacts(found[0]).phone, "053-7016569");
  assert.strictEqual(ui.fileFacts(found[0]).name, "מריה שארפמן");
  assert.ok(seen.some((ids) => ids.indexOf("26533711") >= 0 && ids.indexOf("026533711") >= 0));
  sandbox.GI_MEETINGS_HOST.auth = function () {
    return {
      current: { id: "s1", name: "סוקרת", role: "referent" },
      isAdmin: function () { return false; },
      isManager: function () { return false; },
      isTeamManager: function () { return false; },
      isReferent: function () { return true; }
    };
  };
  const survey = await ui.lookupCustomers(["26533711"]);
  assert.strictEqual(survey.length, 1);
  assert.strictEqual(ui.fileFacts(survey[0]).address, "הרצל 18, רמת גן");
  sandbox.GI_MEETINGS_HOST.auth = function () {
    return {
      current: { id: "other", name: "עומר", role: "agent" },
      isAdmin: function () { return false; },
      isManager: function () { return false; },
      isTeamManager: function () { return false; },
      isReferent: function () { return false; }
    };
  };
  sandbox.GI_MEETINGS_HOST.state = function () {
    return { data: { agents: [], customers: [], meta: {} } };
  };
  sandbox.GI_MEETINGS_HOST.auth = function () {
    return {
      current: { id: "u-uriya", name: "אוריה סומך", role: "owner" },
      isAdmin: function () { return true; },
      isManager: function () { return true; },
      isTeamManager: function () { return false; },
      isReferent: function () { return false; }
    };
  };
  sandbox.GI_MEETINGS_HOST.client = function () {
    return {
      from: function () {
        return {
          select: function () {
            return {
              limit: function () { return Promise.resolve({ data: [], error: { message: "permission denied" } }); },
              in: function () { return Promise.resolve({ data: [], error: null }); }
            };
          }
        };
      },
      rpc: function (name) {
        if (name !== "gi_login_roster") return Promise.resolve({ data: [], error: null });
        return Promise.resolve({
          data: {
            ok: true,
            agents: [
              { id: "n1", name: "איתי כהן", role: "agent", active: true },
              { id: "n2", name: "דנה לוי", role: "נציג", active: true }
            ],
            agentsShadow: [{ id: "n3", name: "נועה מזרחי", role: "agent", active: true }]
          },
          error: null
        });
      }
    };
  };
  assert.strictEqual(ui.canCreate(), true);
  await ui.ensureAgents();
  const pulled = ui.agents().map((agent) => agent.name);
  assert.ok(pulled.indexOf("איתי כהן") >= 0);
  assert.ok(pulled.indexOf("דנה לוי") >= 0);
  assert.ok(pulled.indexOf("נועה מזרחי") >= 0);
  sandbox.GI_MEETINGS_HOST.supabaseUrl = "https://roster.test";
  sandbox.GI_MEETINGS_HOST.supabaseKey = "publishable";
  sandbox.GI_MEETINGS_HOST.client = function () {
    return {
      supabaseUrl: "https://roster.test",
      supabaseKey: "publishable",
      from: function () {
        return { select: function () { return { limit: function () { return Promise.resolve({ data: [], error: null }); } }; } };
      },
      rpc: function () { return Promise.resolve({ data: [], error: null }); }
    };
  };
  sandbox.fetch = function (url, options) {
    assert.ok(String(url).indexOf("/rest/v1/rpc/gi_login_roster") >= 0);
    assert.strictEqual(options.headers.apikey, "publishable");
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          ok: true,
          agents: [
            { id: "r1", name: "עומר חדד", role: "agent", active: true },
            { id: "r2", name: "מושבת", role: "agent", active: false }
          ]
        });
      }
    });
  };
  await ui.ensureAgents();
  const direct = ui.agents().map((agent) => agent.name);
  assert.ok(direct.indexOf("עומר חדד") >= 0);
  assert.ok(direct.indexOf("מושבת") < 0);
  const hidden = await ui.lookupCustomers(["26533711"]);
  assert.strictEqual(hidden.length, 0);
  const view = { innerHTML: "" };
  sandbox.document = {
    getElementById: function (id) { return id === "view-meetings" ? view : null; },
    addEventListener: function () {},
    readyState: "complete"
  };
  sandbox.GI_MEETINGS_HOST.auth = function () {
    return {
      current: { id: "a_real", name: "איתי", role: "agent" },
      isAdmin: function () { return false; },
      isManager: function () { return false; },
      isTeamManager: function () { return false; },
      isReferent: function () { return false; }
    };
  };
  sandbox.GI_MEETINGS_HOST.client = function () {
    return {
      from: function () {
        return {
          select: function () {
            return {
              order: function () {
                return {
                  limit: function () {
                    return Promise.resolve({
                      data: [{
                        id: "pm1",
                        assignee_id: "a_real",
                        assignee_name: "איתי",
                        customer_name: "מריה שארפמן",
                        id_number: "342390275",
                        meeting_date: "2026-11-24",
                        answers: { phone: "053-7016569", address: "הרצל 1", premium: 80, salaryOver10k: true },
                        notes: "להתקשר",
                        masleka: { products: [{ company: "מנורה", name: "פנסיה", sugLabel: "קרן פנסיה" }] },
                        masleka_file: { name: "masleka.zip", storagePath: "files/masleka.zip" },
                        status: "open"
                      }],
                      error: null
                    });
                  }
                };
              }
            };
          }
        };
      }
    };
  };
  await ui.render();
  assert.ok(view.innerHTML.includes("מריה שארפמן"), "assignee row name");
  assert.ok(view.innerHTML.includes("לקוחות ששויכו אליך"), "assignee section");
  assert.ok(view.innerHTML.includes("053-7016569"), "assignee phone");
  assert.ok(view.innerHTML.includes("הרצל 1"), "assignee address");
  assert.ok(view.innerHTML.includes("masleka.zip"), "masleka file");
  assert.ok(view.innerHTML.includes("מנורה"), "masleka product");
  assert.ok(!view.innerHTML.includes("טבלת הפגישות עדיין לא הותקנה"), "table is available");
  sandbox.localStorage = {
    getItem: function (key) { return key === "gemel_invest_sb_auth_v1" ? JSON.stringify({ access_token: "user-token" }) : null; }
  };
  sandbox.GI_MEETINGS_HOST.supabaseUrl = "https://db.test";
  sandbox.GI_MEETINGS_HOST.supabaseKey = "publishable";
  sandbox.GI_MEETINGS_HOST.client = function () { return null; };
  let posted = null;
  sandbox.fetch = function (url, options) {
    posted = { url: String(url), options: options };
    return Promise.resolve({
      ok: true,
      status: 201,
      json: function () { return Promise.resolve([{ id: "pm1", assignee_id: "a_real", customer_name: "מריה" }]); }
    });
  };
  const saved = await ui.saveMeeting({ id: "pm1", assignee_id: "a_real", customer_name: "מריה" });
  assert.strictEqual(saved.ok, true);
  assert.ok(!saved.memory);
  assert.strictEqual(posted.options.method, "POST");
  assert.strictEqual(posted.options.headers.Authorization, "Bearer user-token");
  assert.ok(posted.url.indexOf("https://db.test/rest/v1/gi_pension_meetings") === 0);
  sandbox.fetch = function () {
    return Promise.resolve({
      ok: false,
      status: 401,
      json: function () { return Promise.resolve({ code: "42501", message: "permission denied for table gi_pension_meetings" }); }
    });
  };
  const denied = await ui.saveMeeting({ id: "pm2", assignee_id: "a_real" });
  assert.strictEqual(denied.ok, false);
  assert.ok(!denied.memory);
  assert.ok(denied.error.indexOf("permission denied") >= 0);
  console.log("gi-meetings tests ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
