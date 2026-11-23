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
assert.strictEqual(ui.canCreate({ role: "מנהל מערכת" }), true);
assert.strictEqual(ui.canCreate({ role: "agent" }), false);
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
assert.ok(phone.includes("האם השכר שלך מעל 10 אלף"));
assert.ok(phone.includes("answers.address"));
assert.ok(phone.includes('id.indexOf("meet_") === 0'));

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
          customers: [{ id: "light", idNumber: "26533711", fullName: "קליל", agentId: "a9" }],
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
  const hidden = await ui.lookupCustomers(["26533711"]);
  assert.strictEqual(hidden.length, 0);
  console.log("gi-meetings tests ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
