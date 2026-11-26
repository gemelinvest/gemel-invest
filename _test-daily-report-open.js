/* דוח המכירות נפתח בלי לפענח את כל הקובץ על החוט הראשי.
   החישוב נשאר זהה לקריאה הישנה.
   הרצה: node _test-daily-report-open.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
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

function sameJson(a, b){
  return JSON.stringify(a) === JSON.stringify(b);
}

console.log("1) the file read does not use the 12 second client parse");
const fetchActive = sliceBetween(app, "async fetchActive(options = {}){", "async saveActive(report){");
const loader = sliceBetween(app, "async function fetchDailyReportPayloadBuffer(id, onDownload, onPart){", "async function fetchAndParseDailyReport");
const openLoader = sliceBetween(app, "async function loadDailyReportMapped(id, onProgress){", "function mapDailyReportFromDb(row){");
const parseCall = sliceBetween(app, "async function fetchAndParseDailyReport(id, notify){", "async function loadDailyReportMapped(id, onProgress){");
assert(fetchActive.includes("reuseIfUnchanged") && fetchActive.indexOf("id,uploaded_at") < fetchActive.indexOf("loadDailyReportMapped(DAILY_REPORT_ACTIVE_ID"), "a small stamp is still checked before the full file");
assert(fetchActive.includes("hold: true") && fetchActive.includes("pageSize: 200") && fetchActive.includes("stopAfterPage: true"), "opening the report keeps the rows off the page, asks only for the first page, and stops reading the file");
assert(fetchActive.includes("loadSingleRow") && fetchActive.includes("id,uploaded_at") && !fetchActive.includes("report_as_of_date") && !fetchActive.includes('DAILY_REPORT_ACTIVE_ID, "*"'), "the short request reads only the upload time, not the missing date column or the whole file");
assert(loader.includes("new AbortController") && loader.includes("controller.abort()") && loader.includes("DAILY_REPORT_FULL_LOAD_TIMEOUT_MS"), "a slow download is cancelled instead of left running");
assert(loader.includes("res.body.getReader") && !loader.includes("res.json("), "the file body is not parsed on the page thread");
assert(loader.includes("DAILY_REPORT_COPY_SLICE") && loader.includes("setTimeout(resolve, 0)") && loader.includes("streamed: true") && loader.indexOf("streamed: true") < loader.indexOf("new Uint8Array(received)"), "each piece of the file is handed on before the page builds a private copy");
assert(app.includes("const DAILY_REPORT_FULL_LOAD_TIMEOUT_MS = 120000") && app.includes("const GI_NETWORK_TIMEOUT_MS = 12000"), "only this file gets the longer wait; other requests stay as they were");
assert(openLoader.includes("loadDailyReportMapped._loads") && openLoader.includes("loads.get(safeId)"), "a second open joins the read that is already running");
assert(parseCall.includes("fetched.status === 401") && parseCall.includes("dropLocalAuthSession"), "a rejected session still retries once, the same way other reads do");

console.log("2) opening the screen shows loading and keeps the buttons free");
const dailyUi = sliceBetween(app, "const DailyReportUI = {", "const CancellationsUI = {");
const openFromHub = sliceBetween(dailyUi, "openFromHub(rubric){", "syncPageTitle(){");
const nav = sliceBetween(dailyUi, "scheduleNavRender(){", "async refresh(showToast, options = {}){");
assert(openFromHub.includes("getViewReport()") && openFromHub.indexOf("getViewReport()") < openFromHub.indexOf("showLoadingShell()") && openFromHub.indexOf("showLoadingShell()") < openFromHub.indexOf('UI.goView("dailyReport")'), "a missing report shows the loading line before the screen, and a report already in memory does not");
assert(nav.includes("if(!hadCache)") && nav.indexOf("if(!hadCache)") < nav.indexOf("showLoadingShell()") && nav.indexOf("showLoadingShell()") < nav.indexOf("this.refresh(") && nav.includes("onProgress"), "the loading line is only for a report that is not already on screen");
assert(nav.includes('kind === "download"') && nav.includes('kind === "rows"') && nav.includes("showLoadingProgress"), "the loading line advances while the file arrives and while rows are read");
assert(nav.includes("if(hadCache) perfIdle(start, 120)") && nav.includes("else start()"), "a report already in memory is shown, and a missing one starts loading immediately");
assert(nav.includes("queueResponsivePaint()") && !nav.includes("this.paint()"), "the click does not draw the whole table before the browser can paint");
assert(nav.includes("paintOpenPage(") && nav.indexOf("paintOpenPage(") < nav.indexOf("this.refresh("), "the first page is written before the file is read again");
assert(nav.includes("requestAnimationFrame(() => requestAnimationFrame(run))"), "a missing report starts loading only after the loading line can paint");
const paintFn = sliceBetween(dailyUi, "paint(options = {}){", "showManagerUploadControls(){");
assert(paintFn.includes("DAILY_REPORT_PAINT_SYNC_MAX") && paintFn.includes("prepareAndPaint") && paintFn.includes("this.paintPremiumStats(report, rows)") && paintFn.includes("this.paintBody(report, rows)"), "a large report is drawn in turns, and a small one still paints the full totals");
assert(app.includes("const DAILY_REPORT_PAINT_SYNC_MAX = 1200") && app.includes("const DAILY_REPORT_PAINT_CHUNK = 2000") && app.includes("const DAILY_REPORT_PAINT_CHUNK_NARROW = 250"), "the row groups stay small enough for the buttons to run");
const refresh = sliceBetween(dailyUi, "async refresh(showToast, options = {}){", "async render(){");
assert(refresh.includes("onProgress: options.onProgress") && refresh.includes("skipPaintIfUnchanged"), "progress stays on this screen, and an unchanged file is not drawn again");
assert(!refresh.includes("if(DailyReportStore.tableReady && !DailyReportStore.getViewReport()) return;"), "a failed load does not leave the screen on the loading line");
assert(refresh.includes("this.paint({ finish: true })") && refresh.indexOf("this.paint({ finish: true })") < refresh.lastIndexOf("לא נטען דוח"), "a failed load still draws the screen and then keeps the error");
const failBranch = sliceBetween(fetchActive, "if(!loaded.ok){", "if(!loaded.report){");
assert(failBranch.includes("if(missing)") && failBranch.indexOf("this.report = null") < failBranch.indexOf("} else {"), "a failed refresh keeps the report already on screen unless the table is missing");
assert(refresh.indexOf("window.setTimeout(resolve, 0)") < refresh.indexOf("this.paint({ finish: true })"), "the browser can paint the loading line before the table is drawn");
assert(refresh.indexOf("paintOpenPage(") > 0 && refresh.indexOf("paintOpenPage(") < refresh.indexOf("listMonthArchives()"), "rows already read are shown before the month list is requested");
assert(dailyUi.includes('document.getElementById("view-dailyReport")') && dailyUi.includes("screenIsOpen()"), "the sales screen is recognized from its own view");
const ackFn = fnSource(app, "scheduleDailyReportParseAck");
assert(ackFn.includes("requestAnimationFrame"), "the next row group waits until the browser has painted a frame");

console.log("3) other reports and the row rules stay on their own path");
const cancellations = sliceBetween(app, "const CancellationsStore = {", "const AgentAppointmentReportStore = {");
assert(cancellations.includes("Storage.loadSingleRow") && !cancellations.includes("loadDailyReportMapped"), "the cancellations report is not loaded by this path");
const visible = sliceBetween(app, "function dailyReportRowVisibleToSession(row){", "function dailyReportRowMatchesCurrentAgent");
assert(visible.indexOf("Auth.isAdmin() || Auth.isManager()") < visible.indexOf("dailyReportRowMatchesOwnershipProfile"), "a manager still sees every row before any name matching");
const save = sliceBetween(app, "async saveActive(report){", "async saveMonthArchive(report){");
assert(save.includes("mapDailyReportFromDb(row)"), "saving a report still uses the same row mapping");
assert(html.includes("giReportOpen=9") && sw.includes("report-open-v9") && !html.includes("giReportOpen=8") && !html.includes("giReportOpen=7") && !sw.includes("report-open-v8") && !sw.includes("report-open-v7") && !sw.includes("report-open-v6"), "the open screen loads this version, not the copy the browser already saved");
const preload = sliceBetween(app, "async ensureDailyReportLoaded(options = {}){", "async ensureCancellationsReportLoaded(){");
assert(preload.includes("requestIdleCallback") && preload.includes('getElementById("view-dailyReport")') && preload.indexOf("options.now === true") < preload.indexOf("requestIdleCallback") && !preload.includes("fetchActive"), "the dashboard does not read the whole sales file while the first screen is painting");
const shell = sliceBetween(dailyUi, "showLoadingShell(){", "resetIncomingPreview(){");
assert(shell.includes("showManagerUploadControls()"), "the loading screen can show the upload control before the file arrives");
const uploadControls = sliceBetween(dailyUi, "showManagerUploadControls(){", "showLoadingShell(){");
assert(uploadControls.includes("Auth.canUploadDailyReport()") && uploadControls.includes("this.els.btnUpload.hidden = !canUpload") && uploadControls.includes("this.els.asOfPickWrap.hidden = !canUpload"), "only a manager or admin sees the upload control, and it is available while the file is still loading");
const monthList = sliceBetween(app, "async listMonthArchives(){", "async fetchMonthArchive(monthKey, options = {}){");
assert(monthList.includes('const lightSelect = "id,uploaded_at,uploaded_by_name"'), "the month list does not ask for the missing date column");

console.log("4) reading the file off the page thread produces the same rows");
const workerBlock = sliceBetween(app, "/* GI-REPORT-OPEN-WORKER-START */", "/* GI-REPORT-OPEN-WORKER-END */");
const workerSrc = new Function(workerBlock + "\nreturn DAILY_REPORT_PARSE_WORKER_SRC;")();
assert(workerSrc.includes("JSON.parse(piece)") && workerSrc.includes("skipDailyReportJsonValue") && workerSrc.includes("waitForDailyReportParseAck") && workerSrc.includes('type === "ack"'), "each row is parsed on its own, and the next group waits until the page has answered");
assert(workerSrc.includes("}, 12000);") && !workerSrc.includes("}, 2000);") && !workerSrc.includes("}, 250);"), "a slow frame does not pull the next row group after a quarter of a second");
assert(workerSrc.includes("text.length > 262144") && workerSrc.indexOf("text.length > 262144") < workerSrc.indexOf("JSON.parse(text)"), "a file without a row list is not parsed on the page when it is large");
assert(workerSrc.includes('type === "begin"') && workerSrc.includes('type === "part"') && workerSrc.includes('type === "end"'), "a download can be parsed from the pieces that arrived");
assert(workerSrc.includes('type === "page"') && workerSrc.includes("dailyReportHeld") && workerSrc.includes('type: "preview"') && workerSrc.includes('type: "summary"'), "the first page and the totals are posted, and the rows stay in the worker");
assert(workerSrc.includes("function feedDailyReportHold") && workerSrc.includes("session.hold === true") && workerSrc.indexOf("feedDailyReportHold(session, jobId, part, false)") < workerSrc.indexOf("session.parts.push(part)"), "a download is read piece by piece, and the whole file is not assembled first");
assert(app.includes("report.workerHeld = true") && app.includes("paintIncomingHeld(report)") && !sliceBetween(app, 'if(msg.type === "preview"){', 'if(msg.type === "meta"').includes("job.rows.push"), "the page paints the first rows without copying the whole file onto itself");
const parseChunk = Number((app.match(/const DAILY_REPORT_PARSE_CHUNK = (\d+);/) || [])[1]);
assert(app.includes("chunkSize: DAILY_REPORT_PARSE_CHUNK") && parseChunk === 40, "rows come back in groups of 40");
const parseBufferFn = fnSource(app, "parseDailyReportBuffer");
assert(parseBufferFn.includes("parseDailyReportBufferOnPage") && !parseBufferFn.includes("JSON.parse"), "a browser without a worker still does not parse the whole file in one turn");
const incoming = sliceBetween(dailyUi, "noteIncomingReportRows(job){", "showLoadingProgress(label){");
assert(incoming.includes("dailyReportRowVisibleToSession(row)") && incoming.includes("this.paintHeader(report)") && incoming.includes("this.paintBody(report, this._incomingPreviewRows || shown)") && !incoming.includes("paintPremiumStats"), "the first page is drawn from rows the signed-in user is allowed to see, without final totals");
assert(app.includes("scheduleDailyReportParseAck(job)"), "the page tells the reader when it is free for the next group");
const safeTrimLine = "const safeTrim = (v) => String(v ?? \"\").trim();";
const mapMain = new Function(
  safeTrimLine + "\n" +
  "const DAILY_REPORT_ACTIVE_ID = \"active\";\n" +
  fnSource(app, "normalizeDailyReportAgentKey") + "\n" +
  fnSource(app, "normalizeDailyReportAsOfInput") + "\n" +
  fnSource(app, "formatDailyReportCellValue") + "\n" +
  fnSource(app, "mapDailyReportFromDb") + "\n" +
  "return mapDailyReportFromDb;"
)();

function encodePayload(payload){
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
}

async function readOffThread(payload, chunkSize){
  const messages = [];
  let turns = 0;
  const timer = setInterval(() => { turns += 1; }, 0);
  const self = ackParseHost((msg) => messages.push(msg));
  globalThis.self = self;
  eval(workerSrc);
  await self.onmessage({
    data: { jobId: 4, buffer: encodePayload(payload), chunkSize: chunkSize || parseChunk, activeId: "active" }
  });
  clearInterval(timer);
  return { messages, turns };
}

function ackParseHost(push){
  const host = {
    postMessage(msg){
      push(msg);
      if(msg && msg.type === "chunk"){
        queueMicrotask(() => {
          if(typeof host.onmessage === "function"){
            host.onmessage({ data: { jobId: msg.jobId, type: "ack" } });
          }
        });
      }
    },
    onmessage: null
  };
  return host;
}

function assemble(messages){
  const err = messages.find((msg) => msg.type === "error");
  if(err) return { ok: false, error: err.error, messages };
  const done = messages.find((msg) => msg.type === "done");
  const metas = messages.filter((msg) => msg.type === "meta" && msg.report);
  const meta = metas.length ? metas[metas.length - 1] : null;
  if(!done || done.empty || !meta || !meta.report) return { ok: true, report: null, messages };
  const rows = [];
  messages.forEach((msg) => {
    if(msg.type === "chunk" && Array.isArray(msg.rows)){
      msg.rows.forEach((row) => rows.push(row));
    }
  });
  meta.report.dataRows = rows;
  return { ok: true, report: meta.report, messages };
}

function sampleRow(i){
  return {
    row_index: i === 0 ? 0 : (i + 2),
    agent: i % 17 === 0 ? "  יוסי   כהן  " : "נציג " + (i % 11),
    cells: [i % 5 === 0 ? null : ("תא " + i), 1500.5, true, "  סטטוס  ", i % 9 === 0 ? "" : "תוכנית"]
  };
}

(async () => {
  const snake = {
    uploaded_at: "2026-11-25T22:30:00.000Z",
    uploaded_by_name: " מנהל ",
    report_as_of_date: "2026-11-25",
    sheet_name: " גיליון ",
    header_row: [" סטטוס ", "פרמיה", "דגל", "הערה", "תוכנית"],
    data_rows: Array.from({ length: 1700 }, (_, i) => sampleRow(i))
  };
  const off = assemble((await readOffThread([snake])).messages);
  const direct = mapMain(JSON.parse(JSON.stringify(snake)));
  assert(off.ok && off.report && sameJson(off.report, direct), "a full file read off the page matches the existing row mapping");
  const chunks = off.messages.filter((msg) => msg.type === "chunk");
  const fullGroups = Math.floor(1700 / parseChunk);
  const remainder = 1700 % parseChunk;
  assert(chunks.length === fullGroups + (remainder ? 1 : 0) && chunks[0].rows.length === parseChunk && chunks[chunks.length - 1].rows.length === (remainder || parseChunk), "1700 rows arrive in groups of 40, with a shorter final group");
  assert(chunks[0].loaded === parseChunk && chunks[chunks.length - 1].loaded === 1700 && chunks[chunks.length - 1].total === 1700, "the loading count follows the rows already read");
  assert(off.report.dataRows[0].agent === "יוסי כהן" && off.report.dataRows[0].rowIndex === 2, "a blank row number and a spaced agent name are normalized the same way");
  assert(off.report.dataRows[1].cells[0] === "תא 1" && off.report.dataRows[0].cells[0] === "" && off.report.dataRows[0].cells[1] === "1500.5", "empty, text, and numeric cells stay the same");
  assert(off.report.headerRow[0] === "סטטוס" && off.report.sheetName === "גיליון" && off.report.uploadedByName === "מנהל" && off.report.id === "active", "the report header is trimmed and the active id is kept");
  assert(off.report.reportAsOfDate === direct.reportAsOfDate && off.report.uploadedAt === direct.uploadedAt, "the report date matches the existing date parsing");

  const camel = {
    id: "month_2026-11",
    uploadedAt: "2026-11-01T00:00:00.000Z",
    uploadedByName: "ארכיון",
    reportAsOfDate: "2026-11-01",
    sheetName: "חודש",
    headerRow: ["נציג"],
    dataRows: [{ rowIndex: 9, agent: "דנה לוי", cells: ["דנה לוי"] }]
  };
  const camelOff = assemble((await readOffThread(camel)).messages);
  assert(camelOff.ok && sameJson(camelOff.report, mapMain(JSON.parse(JSON.stringify(camel)))), "a monthly file in the other field names matches too");

  const empty = assemble((await readOffThread([])).messages);
  assert(empty.ok && empty.report === null && empty.messages.some((msg) => msg.type === "done" && msg.empty === true), "an empty answer stays an empty report");

  const badEncoded = new TextEncoder().encode("{");
  const badMessages = [];
  const self = ackParseHost((msg) => badMessages.push(msg));
  globalThis.self = self;
  eval(workerSrc);
  await self.onmessage({
    data: {
      jobId: 9,
      buffer: badEncoded.buffer.slice(badEncoded.byteOffset, badEncoded.byteOffset + badEncoded.byteLength),
      chunkSize: parseChunk,
      activeId: "active"
    }
  });
  assert(badMessages.some((msg) => msg.type === "error" && msg.error), "a broken file reports an error instead of hanging");

  const tricky = {
    id: "active",
    uploaded_at: "2026-11-25T22:30:00.000Z",
    sheet_name: "גיליון",
    header_row: ["הערה", "דגל"],
    data_rows: [
      null,
      { agent: "  רחל   לוי ", cells: ["שורה עם \"ציטוט\" ו-{סוגריים} ו-\\ ו-\nשורה", true] }
    ],
    uploaded_by_name: " אחרי "
  };
  const trickyOff = assemble((await readOffThread(tricky)).messages);
  const trickyDirect = mapMain(JSON.parse(JSON.stringify(tricky)));
  assert(trickyOff.ok && sameJson(trickyOff.report, trickyDirect), "quotes, braces, line breaks, and a field after the rows stay identical");
  assert(trickyOff.report.uploadedByName === "אחרי" && trickyOff.report.dataRows[1].cells[0].includes("ציטוט") && trickyOff.report.dataRows[1].cells[0].includes("\n"), "a field that follows the rows is kept, and the cell text is unchanged");

  const encodedFile = new TextEncoder().encode(JSON.stringify([snake]));
  const mid = Math.floor(encodedFile.byteLength / 2);
  const head = encodedFile.slice(0, mid);
  const tail = encodedFile.slice(mid);
  const streamedMessages = [];
  self.postMessage = (msg) => {
    streamedMessages.push(msg);
    if(msg && msg.type === "chunk"){
      queueMicrotask(() => {
        if(typeof self.onmessage === "function"){
          self.onmessage({ data: { jobId: msg.jobId, type: "ack" } });
        }
      });
    }
  };
  eval(workerSrc);
  await self.onmessage({ data: { jobId: 5, type: "begin", chunkSize: parseChunk, activeId: "active" } });
  await self.onmessage({ data: { jobId: 5, type: "part", buffer: head.buffer } });
  await self.onmessage({ data: { jobId: 5, type: "part", buffer: tail.buffer } });
  await self.onmessage({ data: { jobId: 5, type: "end" } });
  const streamed = assemble(streamedMessages);
  assert(streamed.ok && sameJson(streamed.report, direct), "a file that arrives in pieces matches the existing row mapping");

  const heldMessages = [];
  self.postMessage = (msg) => { heldMessages.push(msg); };
  eval(workerSrc);
  await self.onmessage({
    data: { jobId: 11, buffer: encodePayload([snake]), chunkSize: parseChunk, activeId: "active", hold: true, pageSize: 200 }
  });
  const preview = heldMessages.find((msg) => msg.type === "preview");
  const summary = heldMessages.find((msg) => msg.type === "summary");
  assert(!heldMessages.some((msg) => msg.type === "chunk"), "opening the file does not send every row back to the page");
  assert(preview && preview.rows.length === 200 && summary && summary.total === 1700 && !summary.rows, "the first page arrives, and the total counts the whole file");
  assert(sameJson(preview.rows, direct.dataRows.slice(0, 200)), "the first page matches the existing row mapping");
  await self.onmessage({
    data: { jobId: 11, type: "page", requestId: 3, offset: 200, limit: 200, agent: "", status: "", team: "", plan: "", query: "" }
  });
  const pageMsg = heldMessages.find((msg) => msg.type === "page" && msg.requestId === 3);
  assert(pageMsg && pageMsg.pending !== true && pageMsg.filteredCount === 1700 && pageMsg.rows.length === 200 && sameJson(pageMsg.rows[0], direct.dataRows[200]), "the next page is read from the worker and continues at the right row");

  const streamMessages = [];
  self.postMessage = (msg) => { streamMessages.push(msg); };
  eval(workerSrc);
  const streamFile = new TextEncoder().encode(JSON.stringify([snake]));
  await self.onmessage({ data: { jobId: 12, type: "begin", chunkSize: parseChunk, activeId: "active", hold: true, pageSize: 200 } });
  let previewBeforeEnd = false;
  for(let offset = 0; offset < streamFile.byteLength; offset += 8000){
    const slice = streamFile.slice(offset, Math.min(streamFile.byteLength, offset + 8000));
    await self.onmessage({ data: { jobId: 12, type: "part", buffer: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) } });
    if(streamMessages.some((msg) => msg.type === "preview")) previewBeforeEnd = true;
  }
  assert(previewBeforeEnd, "the first page is posted while the rest of the file is still arriving");
  await self.onmessage({ data: { jobId: 12, type: "end" } });
  const streamPreview = streamMessages.find((msg) => msg.type === "preview");
  const streamSummary = streamMessages.find((msg) => msg.type === "summary");
  assert(streamPreview && streamPreview.rows.length === 200 && sameJson(streamPreview.rows, direct.dataRows.slice(0, 200)), "a file that arrives in pieces still shows the same first page");
  assert(streamSummary && streamSummary.total === 1700 && !streamMessages.some((msg) => msg.type === "chunk"), "the rest of the file is counted without sending every row to the page");
  const lateMessages = [];
  self.postMessage = (msg) => { lateMessages.push(msg); };
  eval(workerSrc);
  const lateFile = new TextEncoder().encode(JSON.stringify([tricky]));
  await self.onmessage({ data: { jobId: 13, type: "begin", chunkSize: parseChunk, activeId: "active", hold: true, pageSize: 200 } });
  for(let offset = 0; offset < lateFile.byteLength; offset += 40){
    const slice = lateFile.slice(offset, Math.min(lateFile.byteLength, offset + 40));
    await self.onmessage({ data: { jobId: 13, type: "part", buffer: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) } });
  }
  await self.onmessage({ data: { jobId: 13, type: "end" } });
  const lateSummary = lateMessages.find((msg) => msg.type === "summary");
  const lateDirect = mapMain(JSON.parse(JSON.stringify(tricky)));
  assert(lateSummary && lateSummary.meta && lateSummary.meta.uploadedByName === "אחרי" && lateSummary.total === lateDirect.dataRows.length, "a field that follows the rows still arrives when the file is read in pieces");

  const stopMessages = [];
  self.postMessage = (msg) => { stopMessages.push(msg); };
  eval(workerSrc);
  const stopFile = new TextEncoder().encode(JSON.stringify([snake]));
  await self.onmessage({ data: { jobId: 14, type: "begin", chunkSize: parseChunk, activeId: "active", hold: true, pageSize: 200, stopAfterPage: true } });
  let stoppedAt = stopFile.byteLength;
  for(let offset = 0; offset < stopFile.byteLength; offset += 8000){
    const slice = stopFile.slice(offset, Math.min(stopFile.byteLength, offset + 8000));
    await self.onmessage({ data: { jobId: 14, type: "part", buffer: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) } });
    if(stopMessages.some((msg) => msg.type === "preview" && msg.stop === true)){
      stoppedAt = offset + slice.byteLength;
      break;
    }
  }
  assert(stoppedAt < stopFile.byteLength, "reading stops once the first page exists, before the rest of the file arrives");
  const extra = stopFile.slice(stoppedAt, Math.min(stopFile.byteLength, stoppedAt + 8000));
  if(extra.byteLength){
    await self.onmessage({ data: { jobId: 14, type: "part", buffer: extra.buffer.slice(extra.byteOffset, extra.byteOffset + extra.byteLength) } });
  }
  await self.onmessage({ data: { jobId: 14, type: "finish", partial: true } });
  const stopPreview = stopMessages.find((msg) => msg.type === "preview");
  const stopSummary = stopMessages.find((msg) => msg.type === "summary");
  assert(stopPreview && stopPreview.rows.length === 200 && stopPreview.stop === true && sameJson(stopPreview.rows, direct.dataRows.slice(0, 200)), "the stopped read still shows the same first page");
  assert(stopSummary && stopSummary.partial === true && stopSummary.total === 200, "rows after the first page are not kept");

  const skipMessages = [];
  self.postMessage = (msg) => { skipMessages.push(msg); };
  eval(workerSrc);
  await self.onmessage({ data: { jobId: 15, type: "begin", chunkSize: parseChunk, activeId: "active", hold: true, pageSize: 200, stopAfterPage: true, skipRows: 200 } });
  for(let offset = 0; offset < stopFile.byteLength; offset += 8000){
    const slice = stopFile.slice(offset, Math.min(stopFile.byteLength, offset + 8000));
    await self.onmessage({ data: { jobId: 15, type: "part", buffer: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) } });
    if(skipMessages.some((msg) => msg.type === "preview" && msg.stop === true)) break;
  }
  await self.onmessage({ data: { jobId: 15, type: "finish", partial: true } });
  const skipPreview = skipMessages.find((msg) => msg.type === "preview");
  assert(skipPreview && skipPreview.rows.length === 200 && sameJson(skipPreview.rows[0], direct.dataRows[200]), "the next page starts at the requested row and stops there");

  const gaps = [];
  const started = Date.now();
  const gapTimer = setInterval(() => gaps.push(Date.now() - started), 0);
  await readOffThread([snake]);
  clearInterval(gapTimer);
  assert(gaps.length > 0, "row groups leave time for the buttons to run");

  console.log("5) drawing the report in groups keeps the same rows and totals");
  const paintHelpers = new Function(
    safeTrimLine + "\n" +
    fnSource(app, "normalizeDailyReportAgentKey") + "\n" +
    fnSource(app, "normalizeDailyReportAgentToken") + "\n" +
    sliceBetween(app, "const DAILY_REPORT_PENDING_ISSUE_STATUSES", "function isDailyReportPendingIssueStatus") + "\n" +
    fnSource(app, "isDailyReportIssuedStatus") + "\n" +
    fnSource(app, "isDailyReportPendingIssueStatus") + "\n" +
    fnSource(app, "parseDailyReportMoney") + "\n" +
    fnSource(app, "getDailyReportCell") + "\n" +
    fnSource(app, "getDailyReportIssuedPremiumValue") + "\n" +
    fnSource(app, "getDailyReportPendingPremiumValue") + "\n" +
    fnSource(app, "dailyReportRowMatchesFilters") + "\n" +
    fnSource(app, "accumulateDailyReportPaintSlice") + "\n" +
    "return { dailyReportRowMatchesFilters, accumulateDailyReportPaintSlice, isDailyReportIssuedStatus, isDailyReportPendingIssueStatus, getDailyReportIssuedPremiumValue, getDailyReportPendingPremiumValue };"
  )();
  const cols = { status: 0, team: 1, plan: 2, premium: 3, issuedPremium: 4 };
  const filters = {
    agent: "יוסי כהן",
    status: "",
    team: "",
    plan: "",
    query: "תוכנית א",
    fKey: "יוסי כהן",
    selfAgent: false,
    selfProfile: null,
    active: true
  };
  const big = Array.from({ length: 4500 }, (_, i) => ({
    agent: i % 5 === 0 ? "  יוסי   כהן " : (i % 3 === 0 ? "דנה לוי" : "יוסי כהן"),
    cells: [
      ["הופק", "ממתין להפקה", "ממתין לחתימות", "הופקה"][i % 4],
      i % 2 === 0 ? "צוות א" : "צוות ב",
      i % 3 === 0 ? "תוכנית א" : "תוכנית ב",
      "1,250.50",
      "80"
    ]
  }));
  function blankState(){
    return {
      cols,
      filters,
      seesAll: true,
      teamManager: false,
      selfProfile: null,
      agentMap: new Map(),
      statusSet: new Set(),
      teamSet: new Set(),
      planSet: new Set(),
      filtered: [],
      stats: { issuedPremium: 0, issuedCount: 0, pendingPremium: 0, pendingCount: 0, hasStatusCol: true },
      selfSampleRows: [],
      selfNameSeen: new Set(),
      totalVisible: 0
    };
  }
  const whole = blankState();
  paintHelpers.accumulateDailyReportPaintSlice(big, whole);
  const parts = blankState();
  const paintGaps = [];
  const paintTimer = setInterval(() => paintGaps.push(1), 0);
  for(let i = 0; i < big.length; i += 2000){
    paintHelpers.accumulateDailyReportPaintSlice(big.slice(i, i + 2000), parts);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  clearInterval(paintTimer);
  parts.stats.issuedPremium = Math.round(parts.stats.issuedPremium * 100) / 100;
  parts.stats.pendingPremium = Math.round(parts.stats.pendingPremium * 100) / 100;
  whole.stats.issuedPremium = Math.round(whole.stats.issuedPremium * 100) / 100;
  whole.stats.pendingPremium = Math.round(whole.stats.pendingPremium * 100) / 100;
  const expected = [];
  let expectedIssued = 0;
  let expectedIssuedPremium = 0;
  let expectedPending = 0;
  let expectedPendingPremium = 0;
  big.forEach((row) => {
    const agent = String(row.agent).trim().replace(/\s+/g, " ");
    const blob = row.cells.join(" ").toLowerCase();
    if(agent !== "יוסי כהן") return;
    if(!blob.includes("תוכנית א")) return;
    expected.push(row);
    const status = row.cells[0];
    if(paintHelpers.isDailyReportIssuedStatus(status)){
      expectedIssued += 1;
      expectedIssuedPremium += paintHelpers.getDailyReportIssuedPremiumValue(row, cols);
    } else if(paintHelpers.isDailyReportPendingIssueStatus(status)){
      expectedPending += 1;
      expectedPendingPremium += paintHelpers.getDailyReportPendingPremiumValue(row, cols);
    }
  });
  expectedIssuedPremium = Math.round(expectedIssuedPremium * 100) / 100;
  expectedPendingPremium = Math.round(expectedPendingPremium * 100) / 100;
  assert(parts.filtered.length === whole.filtered.length && parts.filtered.every((row, i) => row === whole.filtered[i]), "groups together are the same rows as one pass");
  assert(parts.totalVisible === big.length && parts.filtered.length === expected.length && parts.filtered.every((row, i) => row === expected[i]), "search and the agent filter still keep every matching row, in the same order");
  assert(parts.stats.issuedCount === expectedIssued && parts.stats.issuedPremium === expectedIssuedPremium && parts.stats.pendingCount === expectedPending && parts.stats.pendingPremium === expectedPendingPremium, "issued and pending totals stay the same when the scan is split");
  assert(parts.statusSet.size === 4 && parts.teamSet.size === 2 && parts.planSet.size === 2, "filter lists still come from every visible row, including rows hidden by the search");
  assert(paintGaps.length > 0, "the button can run between those groups");

  if(failed){
    console.error("\nFAILED " + failed);
    process.exit(1);
  }
  console.log("\nOK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
