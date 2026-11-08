/**
 * The public-key write check rejects a save, and a stored probe is removed
 * only by its own id.
 * Run: node _test-anon-write-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WRITE_PROBE_ID,
  WRITE_PROBE_NUM,
  WRITE_PROBE_UUID,
  checkTable,
  classifyWrite,
  probeBody,
  probeFilter,
  rowPresent,
  runWriteCheck,
  writeCheckFailed
} from "./scripts/gi-anon-write-check.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;

function assert(cond, msg){
  if(cond) console.log("  PASS  " + msg);
  else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

const source = fs.readFileSync(path.join(root, "scripts/gi-anon-write-check.mjs"), "utf8");

console.log("1) the check stays on the probe id");
assert(source.includes(WRITE_PROBE_ID), "the probe id is fixed");
assert(!source.includes("console.log(body)") && !source.includes("console.log(url)") && !source.includes("console.log(key)"), "it does not print a row or the key");
assert(!source.includes("select=*"), "it does not read a full row");
assert(probeFilter("id") === "id=eq." + WRITE_PROBE_ID, "the filter is the probe id");
assert(probeFilter("history_id", WRITE_PROBE_UUID) === "history_id=eq." + WRITE_PROBE_UUID, "a typed filter stays on the probe uuid");
assert(probeBody("id", "minimal").id === WRITE_PROBE_ID && Object.keys(probeBody("id", "minimal")).length === 1, "a minimal body is only the probe id");
assert(probeBody("key", "safe").created_at === "not-a-timestamp" && probeBody("key", "safe").key === WRITE_PROBE_ID, "the first body cannot be a real timestamp");
assert(classifyWrite(401, "") === "rejected" && classifyWrite(403, "row-level security") === "rejected", "permission errors are rejected");
assert(classifyWrite(400, "invalid input syntax") === "aborted" && classifyWrite(201, "[]") === "accepted", "a bad value aborts and a success is accepted");
assert(rowPresent(200, "[]") === false && rowPresent(200, "[{\"id\":\"" + WRITE_PROBE_ID + "\"}]") === true, "presence follows the probe response");
assert(rowPresent(401, "[{\"id\":\"live\"}]") === false, "a rejected read is not treated as a stored row");

function detail(rows, section){
  const found = rows.find((row) => row[0] === section);
  return found ? found[1] : "";
}

console.log("\n2) a rejected insert sends no saved row");
{
  const calls = [];
  const request = async (method, table, pk, body) => {
    calls.push([method, table, pk, body]);
    if(method === "GET") return { status: 200, body: "[]" };
    return { status: 401, body: "{\"code\":\"42501\"}" };
  };
  const rows = await checkTable(request, "customers", "id");
  assert(detail(rows, "insert") === "rejected" && detail(rows, "left") === "no", "a permission error is closed");
  assert(calls.filter((call) => call[0] === "POST").length === 1, "a rejected safe attempt is the only insert");
  assert(calls.every((call) => call[0] === "GET" || call[0] === "POST"), "no cleanup runs when nothing was stored");
  assert(!writeCheckFailed(rows), "a closed table passes");
}

console.log("\n3) a bad value is followed by a normal row, which is also rejected");
{
  const calls = [];
  const request = async (method, table, pk, body) => {
    calls.push([method, body]);
    if(method === "GET") return { status: 200, body: "[]" };
    if(body && body.created_at) return { status: 400, body: "invalid input syntax for type timestamp" };
    return { status: 401, body: "permission denied" };
  };
  const rows = await checkTable(request, "proposals", "id");
  assert(detail(rows, "insert") === "rejected" && detail(rows, "left") === "no", "the normal row is rejected");
  assert(calls.filter((call) => call[0] === "POST").length === 2, "the normal row is sent only after the bad value");
  assert(!writeCheckFailed(rows), "a rejected normal row passes");
}

console.log("\n4) a stored probe is removed by its own id");
{
  const stored = new Set();
  const deleted = [];
  const request = async (method, table, pk, body) => {
    if(method === "POST"){
      stored.add(table);
      return { status: 201, body: "" };
    }
    if(method === "DELETE"){
      deleted.push(pk + "=eq." + (body && body.id ? body.id : WRITE_PROBE_ID));
      stored.delete(table);
      return { status: 204, body: "" };
    }
    if(method === "PATCH"){
      return { status: 204, body: "" };
    }
    return { status: 200, body: stored.has(table) ? "[{\"id\":\"" + WRITE_PROBE_ID + "\"}]" : "[]" };
  };
  const rows = await runWriteCheck({
    request,
    tables: [["customers", "id"], ["gi_system_notices", "id"]]
  });
  const inserts = rows.filter((row) => row[0] === "insert").map((row) => row[1]);
  const left = rows.filter((row) => row[0] === "left").map((row) => row[1]);
  assert(inserts.join(",") === "accepted,accepted", "a saved probe is reported");
  assert(left.join(",") === "no,no", "cleanup removes both probes");
  assert(deleted.length === 2 && deleted.every((item) => item.includes(WRITE_PROBE_ID)), "cleanup names only the probe id");
  assert(writeCheckFailed(rows), "a saved probe fails the check");
}

console.log("\n5) a customer delete block still retires the probe");
{
  let present = false;
  const request = async (method, table, pk, body) => {
    if(method === "POST" && body && body.created_at) return { status: 400, body: "invalid input syntax" };
    if(method === "POST"){
      present = true;
      return { status: 201, body: "" };
    }
    if(method === "DELETE") return { status: 400, body: "DELETE is blocked on this table" };
    if(method === "PATCH"){
      present = false;
      return { status: 204, body: "" };
    }
    return { status: 200, body: present ? "[{\"id\":\"" + WRITE_PROBE_ID + "\"}]" : "[]" };
  };
  const rows = await checkTable(request, "customers", "id");
  assert(detail(rows, "left") === "no", "the purged probe is gone from the public read");
  assert(writeCheckFailed(rows), "the accepted insert still fails the check");
}

console.log("\n6) a text id the column cannot hold is retried as the probe uuid");
{
  const calls = [];
  const request = async (method, table, pk, body, id) => {
    calls.push([method, id, body]);
    if(method === "GET") return { status: 200, body: "[]" };
    if(id === WRITE_PROBE_ID) return { status: 400, body: "{\"code\":\"22P02\"}" };
    return { status: 401, body: "{\"code\":\"42501\"}" };
  };
  const rows = await checkTable(request, "agents_history", "history_id");
  assert(detail(rows, "insert") === "rejected" && detail(rows, "code") === "42501" && detail(rows, "left") === "no", "the typed row is rejected");
  assert(calls.some((call) => call[0] === "POST" && call[1] === WRITE_PROBE_UUID), "the retry uses the probe uuid");
  assert(!writeCheckFailed(rows), "a rejected typed row passes");
}

console.log("\n7) a generated id is not sent again without its id");
{
  const calls = [];
  const request = async (method, table, pk, body) => {
    calls.push([method, body]);
    if(method === "GET") return { status: 200, body: "[]" };
    return { status: 400, body: "{\"code\":\"428C9\"}" };
  };
  const rows = await checkTable(request, "owner_devices", "id");
  assert(detail(rows, "insert") === "blocked" && detail(rows, "left") === "no", "a generated id blocks the insert");
  assert(calls.filter((call) => call[0] === "POST").length === 1, "no second insert drops the id");
  assert(!writeCheckFailed(rows), "a blocked generated id passes");
}

console.log("\n8) a numeric id is used only after text and uuid are refused");
{
  const calls = [];
  const request = async (method, table, pk, body, id) => {
    calls.push([method, id]);
    if(method === "DELETE") return { status: 500, body: "" };
    if(method === "GET") return { status: 200, body: "[]" };
    if(id === WRITE_PROBE_NUM) return { status: 401, body: "{\"code\":\"42501\"}" };
    return { status: 400, body: "{\"code\":\"22P02\"}" };
  };
  const rows = await checkTable(request, "gi_chat_messages", "id");
  assert(detail(rows, "insert") === "rejected" && detail(rows, "left") === "no", "the numeric row is rejected");
  assert(calls.some((call) => call[0] === "POST" && call[1] === WRITE_PROBE_NUM), "the numeric probe is sent");
  assert(!calls.some((call) => call[0] === "DELETE"), "a rejected numeric row is not deleted");
  assert(probeBody("id", "minimal", WRITE_PROBE_NUM).id === Number(WRITE_PROBE_NUM), "the numeric body is a number");
  assert(!writeCheckFailed(rows), "a rejected numeric row passes");
}

console.log("\n9) an existing numeric id is not deleted");
{
  const calls = [];
  const request = async (method, table, pk, body, id) => {
    calls.push(method);
    if(method === "GET") return { status: 200, body: "[]" };
    if(id === WRITE_PROBE_NUM) return { status: 409, body: "{\"code\":\"23505\"}" };
    return { status: 400, body: "{\"code\":\"22P02\"}" };
  };
  const rows = await checkTable(request, "customers_history", "history_id");
  assert(detail(rows, "insert") === "blocked" && detail(rows, "left") === "no", "a conflict blocks the insert");
  assert(!calls.includes("DELETE") && !calls.includes("PATCH"), "a conflicting id is left untouched");
  assert(!writeCheckFailed(rows), "a conflict with no new row passes");
}

if(failed){
  console.error("\nFAILED " + failed);
  process.exit(1);
}
console.log("\nOK");
