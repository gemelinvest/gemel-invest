/* GI-LEAD 2026-09-07 — פלטת צבעים במערכת לידים + שיוך נציג למחלקה אחרת.
   הרצה: node _test-campaign-lead-inbox-color.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const APP_TAG = "20260909-version-resume-v1";
let failed = 0;
let passed = 0;

function assert(cond, msg){
  if(cond){
    passed += 1;
    console.log("  PASS  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  const end = src.indexOf(endToken, start + startToken.length);
  if(end < 0) return src.slice(start);
  return src.slice(start, end);
}

const app = read("app.js");
const css = read("app.css");
const html = read("index.html");
const sw = read("service-worker.js");
const themeP2 = read("theme-p2.css");
const unify = read("theme-unify-flat.css");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + APP_TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + APP_TAG), "index.html app.css cache");
assert(html.includes("theme-p2.css?v=20260907-couple-shared-discount-v1"), "index.html theme-p2 cache");
assert(sw.includes("gi-v12-" + APP_TAG), "service-worker cache");
assert(app.includes('const BUILD = "' + APP_TAG + '"'), "app.js BUILD tag");
assert(app.includes("theme-unify-flat.css?v=20260907-couple-shared-discount-v1"), "unify-flat cache");

console.log("\n2) מערכת לידים — פלטת צבעים בקובייה ובשורה");
assert(app.includes("function campaignLeadColorBtnHtml(lead)"), "campaignLeadColorBtnHtml");
assert(app.includes("function campaignLeadRowColorClass(lead)"), "campaignLeadRowColorClass");
assert(app.includes("lcSplitCard__topTools"), "כלים בראש קוביית ליד");
const splitRender = sliceBetween(app, "renderSplitLeads(){", "renderList(){");
assert(splitRender.includes("campaignLeadColorBtnHtml(lead)"), "כפתור צבע בקוביית לידים פעילים");
assert(splitRender.includes("campaignLeadRowColorClass(lead)"), "מחלקת צבע מותאם בקובייה");
assert(app.includes('td class="lcCampaign__actions">${campaignLeadColorBtnHtml(lead)}${campaignLeadReassignBtnHtml(lead.id)}</td>'), "כפתור צבע בעמודת פעולות בטבלה");
assert(app.includes('handleCampaignLeadColorBtn(colorBtn)'), "handler לכפתור צבע");
assert(app.includes("CampaignLeadsUI.scheduleListRender(); } catch(_e) {}"), "שמירת צבע מרעננת את מערכת הלידים");
assert(css.includes(".lcSplitCard.lcLeadRow--custom-color"), "CSS צובע קובייה לפי --lead-custom-color");
assert(themeP2.includes(".lcSplitCard.lcLeadRow--custom-color"), "theme-p2 לא דורס את צבע הקובייה");
assert(unify.includes("#view-campaignLeads .lcSplitCard.lcLeadRow--custom-color"), "unify-flat שומר צבע מותאם");

console.log("\n3) נציג — לחצן שיוך בסטטוס ליד");
assert(app.includes("CAMPAIGN_LEAD_AGENT_PEER_REASSIGN_TARGETS"), "רשימת יוזרים לשיוך ממחלקה אחרת");
assert(app.includes('{ name: "קורן פרנקל", dept: "פנסיה" }'), "קורן פרנקל — פנסיה");
assert(app.includes('{ name: "שמחה אזרד", dept: "פנסיה" }'), "שמחה אזרד — פנסיה");
assert(app.includes('{ name: "עדן ביטון", dept: "אלמנטרי רכב ודירה" }'), "עדן ביטון — אלמנטרי רכב ודירה");
assert(app.includes('{ name: "אילן איילין" }'), "אילן איילין ברשימת שיוך ממחלקה אחרת");
assert(app.includes("קורן פרנקל, שמחה אזרד, עדן ביטון, אילן איילין"), "טקסט ריק כולל את אילן איילין");
assert(app.includes("function getCampaignLeadPeerReassignAgents()"), "getCampaignLeadPeerReassignAgents");
assert(!app.includes('agents = agents.filter((a) => safeTrim(a.role) === "opsAgent")'), "אין נפילה לכל נציגי התפעול");
assert(app.includes("function canCampaignLeadPeerReassign()"), "canCampaignLeadPeerReassign");
assert(!app.includes("canAccessCampaignMyLeads?.() && !Auth?.canAccessCampaignLeadsInbox"), "לחצן שיוך לא מוסתר למנהל ב«הלידים שלי»");
assert(app.includes("return !!Auth?.canAccessCampaignMyLeads?.();"), "שיוך peer פתוח לכל מי שנכנס ל«הלידים שלי»");
assert(app.includes('campaignLeadReassignBtnHtml(lead.id, "peer")'), "לחצן שיוך לנציג בכרטיס הלידים שלי");
assert(app.includes('data-cl-reassign-mode="peer"'), "מצב peer על לחצן הנציג");
assert(app.includes('btn--primary lcLeadReassignBtn'), "לחצן שיוך בולט בעמודת הסטטוס");
assert(app.includes('title="שיוך לנציג ממחלקה אחרת">שיוך לנציג</button>'), "תווית לחצן שיוך לנציג");
assert(app.includes("peerDisplayName"), "שם עם מחלקה בבחירת השיוך");
const reassignOpen = sliceBetween(app, "const CampaignLeadReassignAgent = {", "// ===== בוחר צבע לשורת ליד =====");
assert(reassignOpen.includes('const mode = safeTrim(options.mode) === "peer" ? "peer" : "inbox"'), "מודל שיוך מקבל mode peer");
assert(reassignOpen.includes("getCampaignLeadPeerReassignAgents()"), "מודל שיוך נציג משתמש ברשימת peer");
assert(reassignOpen.includes("שיוך למחלקה אחרת"), "כותרת עזר למחלקה אחרת");
assert(css.includes(".lcMyLeadCard__side .lcLeadReassignBtn"), "לחצן שיוך מיושר בעמודת הסטטוס");

console.log("\n4) סוקרת — מעבר ליד על השורה בלי שינוי לוגיקת שיוך");
assert(app.includes("function campaignLeadTransferTrailText(lead, agents)"), "campaignLeadTransferTrailText");
assert(app.includes("מעבר ליד: "), "טקסט מעבר ליד");
assert(app.includes('lcSplitCard__row--transfer'), "שורת מעבר בקוביית מערכת לידים");
assert(app.includes("lcLeadHandoff"), "מעבר ליד בתא הנציג בטבלה");
assert(app.includes("function campaignLeadAgentAccess(lead, agentRec)"), "campaignLeadAgentAccess לא הוסר");
assert(app.includes("function campaignLeadAllAgentNames(lead, agents)"), "campaignLeadAllAgentNames לא הוסר");
assert(css.includes(".lcSplitCard__transfer"), "CSS למעבר ליד בקובייה");
assert(css.includes(".lcLeadHandoff"), "CSS למעבר ליד בטבלה");

console.log("\n5) פלטת צבעים נשארת במלואה בתוך המסך");
assert(app.includes("function campaignLeadColorPickerPlacement("), "campaignLeadColorPickerPlacement");
assert(app.includes("_placePanel(){"), "CampaignLeadColorPicker._placePanel");
assert(!app.includes("let desiredLeft = rect.right - panelW;"), "הוסר יישור שגורם לבליעה שמאלה");
assert(css.includes("max-width:min(320px, calc(100vw - 24px))"), "רוחב פלטה לא חורג מהמסך");
assert(css.includes("max-height:calc(100vh - 24px)"), "גובה פלטה לא חורג מהמסך");
assert(css.includes(".lcColorPicker__overlay") && /lcColorPicker__overlay\{[^}]*overflow:visible/.test(css.replace(/\s+/g, "")), "overlay לא חותך את הפלטה");

const placeSrc = sliceBetween(app, "function campaignLeadColorPickerPlacement(", "\n  const CampaignLeadColorPicker = {");
assert(placeSrc.includes("spaceAbove"), "בדיקת מקום מעל הכפתור");
assert(placeSrc.includes("spaceBelow"), "בדיקת מקום מתחת לכפתור");
const placeFn = new Function(placeSrc.trim() + "\nreturn campaignLeadColorPickerPlacement;")();
function fits(p, panel, view, pad){
  const usedH = p.maxHeight || panel.height;
  return p.left >= pad - 0.001
    && p.top >= pad - 0.001
    && p.left + (p.width || panel.width) <= view.width - pad + 0.001
    && p.top + usedH <= view.height - pad + 0.001;
}
const view = { width: 1440, height: 900 };
const panel = { width: 300, height: 420 };
const pad = 12;
const bottomLeft = placeFn({ left: 18, right: 54, top: 820, bottom: 856 }, panel, view, pad);
assert(fits(bottomLeft, panel, view, pad), "שורה תחתונה משמאל — כל הפלטה במסך");
assert(bottomLeft.top + (bottomLeft.maxHeight || panel.height) < 856, "שורה תחתונה — נפתח למעלה ולא נחתך למטה");
assert(bottomLeft.left >= 18, "כפתור שמאלי — נפתח לתוך הטבלה ולא נבלע לשמאל");
const midRight = placeFn({ left: 1280, right: 1316, top: 240, bottom: 276 }, panel, view, pad);
assert(fits(midRight, panel, view, pad), "כפתור ימני — לא חורג לימין");
const plentyBelow = placeFn({ left: 40, right: 76, top: 120, bottom: 156 }, panel, view, pad);
assert(fits(plentyBelow, panel, view, pad), "יש מקום מתחת — הפלטה מתחת לכפתור");
assert(plentyBelow.top >= 156, "כשיש מקום, נפתח מתחת לכפתור");
const tinyView = { width: 360, height: 280 };
const squeezed = placeFn({ left: 8, right: 40, top: 200, bottom: 232 }, { width: 300, height: 420 }, tinyView, pad);
assert(fits(squeezed, { width: squeezed.width, height: squeezed.maxHeight || 120 }, tinyView, pad), "מסך נמוך — נשאר בתוך המסך עם גלילה");
assert(squeezed.maxHeight > 0, "מסך נמוך — maxHeight לגלילה פנימית");

if(failed){
  console.error("\nFAILED " + failed + " / " + (passed + failed));
  process.exit(1);
}
console.log("\nOK " + passed + " checks");
