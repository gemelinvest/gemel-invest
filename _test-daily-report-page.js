/* דוח המכירות מצייר חלון שורות. החישוב, הסינון והייצוא נשארים על כל השורות.
   הרצה: node _test-daily-report-page.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function sliceBetween(src, startMark, endMark){
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start < 0 ? 0 : start);
  if(start < 0 || end < 0 || end <= start) return "";
  return src.slice(start, end);
}

function fnSource(src, name){
  const mark = "function " + name + "(";
  const start = src.indexOf(mark);
  if(start < 0) return "";
  const brace = src.indexOf("{", start);
  let depth = 0;
  for(let i = brace; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

console.log("1) the table window keeps every row available");
const windowSrc = fnSource(app, "dailyReportBodyWindow");
assert(windowSrc.includes("list.slice(start, end)"), "the window is a slice of the full list");
const dailyReportBodyWindow = new Function(windowSrc + "\nreturn dailyReportBodyWindow;")();
const rows = Array.from({ length: 450 }, (_, i) => ({ id: i + 1 }));
const first = dailyReportBodyWindow(rows, 0, 200);
const second = dailyReportBodyWindow(rows, 1, 200);
const last = dailyReportBodyWindow(rows, 2, 200);
const clamped = dailyReportBodyWindow(rows, 9, 200);
assert(first.rows.length === 200 && first.rows[0].id === 1 && first.rows[199].id === 200, "the first page is the first 200 rows");
assert(second.rows.length === 200 && second.rows[0].id === 201, "the next page continues");
assert(last.rows.length === 50 && last.rows[49].id === 450, "the last page keeps the remaining rows");
assert(clamped.page === 2 && clamped.rows[0].id === 401, "a page past the end stays on the last page");
assert(dailyReportBodyWindow(rows, 0, 200).pages === 3, "the page count covers the whole list");

console.log("2) counts, filters, and export still see the whole report");
const paint = sliceBetween(app, "paint(options = {}){\n      const report = DailyReportStore.getViewReport();", "showManagerUploadControls(){");
assert(paint.includes("this.paintPremiumStats(report, rows)") && paint.includes("this.paintMeta(report, rows.length, totalVisible)") && paint.includes("this.paintBody(report, rows)"), "stats and the row count use the filtered rows, then the table is painted");
const body = sliceBetween(app, "paintBody(report, rows){", "paintBodyPager(windowed, total){");
assert(body.includes("dailyReportBodyWindow(rows, this._bodyPage, this.BODY_PAGE_SIZE)") && body.includes("windowed.rows.map"), "only the current page is written into the table");
assert(app.includes("BODY_PAGE_SIZE: 200"), "the page holds 200 rows");
const dailyUi = sliceBetween(app, "const DailyReportUI = {", "const CancellationsUI = {");
const exportFn = sliceBetween(dailyUi, "async exportToExcel(){", "onUploadClick(){");
assert(exportFn.includes("report.dataRows") && exportFn.includes("this.getFilteredRows()") && !exportFn.includes("dailyReportBodyWindow"), "export still takes every visible row");
const filtered = sliceBetween(app, "getFilteredRows(){", "paint(options = {}){");
assert(filtered.includes("DailyReportStore.getVisibleRowsFor(report)") && !filtered.includes("dailyReportBodyWindow"), "search and filters still run on every visible row");

console.log("3) opening the report again does not download the same file");
const fetchActive = sliceBetween(app, "async fetchActive(options = {}){", "async saveActive(report){");
const probeAt = fetchActive.indexOf("id,uploaded_at");
const fullAt = fetchActive.indexOf("loadDailyReportMapped(DAILY_REPORT_ACTIVE_ID");
assert(probeAt > 0 && fullAt > probeAt, "a small stamp is read before the full report");
assert(!fetchActive.includes("report_as_of_date"), "the stamp does not ask for the date column that is not on the live table");
assert(!fetchActive.includes('DAILY_REPORT_ACTIVE_ID, "*"'), "the full file is not read through the short request timeout");
assert(fetchActive.includes("unchanged: true") && fetchActive.includes("reuseIfUnchanged"), "an unchanged report stays in memory");
const refresh = sliceBetween(app, "async refresh(showToast, options = {}){\n      const reuse = showToast !== true;", "async render(){");
assert(refresh.includes("skipPaintIfUnchanged && r.unchanged && archiveUnchanged") && refresh.indexOf("this.paint({ finish: true })") > refresh.indexOf("skipPaintIfUnchanged"), "a second paint is skipped only when the file did not change");
assert(refresh.includes("reuseIfUnchanged: reuse") && refresh.includes("fetchMonthArchive(viewMonth, { reuseIfUnchanged: reuse, onProgress: options.onProgress })"), "a manual refresh still loads the file, and an open month uses the same stamp");

console.log("4) who sees a row is unchanged");
const visible = sliceBetween(app, "function dailyReportRowVisibleToSession(row){", "function dailyReportRowMatchesCurrentAgent");
assert(visible.indexOf("Auth.isAdmin() || Auth.isManager()") < visible.indexOf("dailyReportRowMatchesOwnershipProfile"), "a manager still sees every row before any name matching");
const tokens = sliceBetween(app, "function getDailyReportAgentLabelTokensSet(){", "function dailyReportHasMoreSpecificLabelForToken");
assert(tokens.includes("_dailyReportLabelTokenCache") && tokens.includes("getDailyReportCacheStamp(report)"), "agent name matching reuses one scan of the file");
assert(app.includes("_dailyReportLabelTokenCache = null"), "a new file clears that scan");

console.log("5) the other report screens were not switched to this window");
const cancelBody = sliceBetween(app, "paintBody(sheet, rows){", "paintMeta(sheet, filteredCount, totalVisible){");
const appt = sliceBetween(app, "const AgentAppointmentReportUI = {", "const CampaignLinesSettingsUI = {");
assert(cancelBody.includes("rows.map") && !cancelBody.includes("dailyReportBodyWindow"), "the cancellations table is unchanged");
assert(appt.includes("this.els.tbody.innerHTML = rows.map") && !appt.includes("dailyReportBodyWindow"), "the appointment table is unchanged");
assert(html.includes('id="dailyReportPager"') && html.includes("giReportPage=1"), "the sales report page control is in the screen that loads");

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
