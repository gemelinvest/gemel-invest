/* GI-SEC — signed-in read of app_meta closes after settings and version
   stay on their functions. Run: node _test-app-meta-select-off.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
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

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const sql = fs.readFileSync(path.join(ROOT, "supabase-gi-app-meta-select-off.sql"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

const saveStart = app.indexOf("async upsertMeta(state){");
const saveEnd = app.indexOf("invalidateMetaRowCache(){", saveStart);
const saveFn = app.slice(saveStart, saveEnd);
const pubStart = app.indexOf("async publishVersion(){");
const pubEnd = app.indexOf("async saveUsersManagementPin(){", pubStart);
const pubFn = app.slice(pubStart, pubEnd);

console.log("2) the screen no longer writes the table");
assert(saveFn.includes('client.rpc("gi_app_settings_save"'), "settings save calls the function");
assert(!saveFn.includes("SUPABASE_TABLES.meta"), "settings save does not touch the table");
assert(!saveFn.includes("restRequest"), "settings save has no table request");
assert(pubFn.includes('client.rpc("gi_app_version_save"'), "version publish calls the function");
assert(!pubFn.includes("SUPABASE_TABLES.meta"), "version publish does not touch the table");
assert(!pubFn.includes(".upsert("), "version publish has no table upsert");
assert(html.includes("giMetaFn=1"), "the page loads the function-only writes");
assert(sw.includes("meta-fn-v1"), "the service worker cache changes with the writes");

console.log("3) the select close removes one policy");
assert(sql.includes('drop policy "app_meta_select_authenticated" on public.app_meta'), "it drops the signed-in select");
assert(sql.includes("gi_app_settings_save"), "it requires the settings save function");
assert(sql.includes("gi_app_version_save"), "it requires the version save function");
assert(sql.includes("settings functions are missing; nothing saved"), "missing functions stop the script");
assert(!sql.includes("drop policy \"app_meta_insert_authenticated\""), "insert stays");
assert(!sql.includes("drop policy \"app_meta_update_authenticated\""), "update stays");
assert(!sql.includes("drop policy \"app_meta_delete_authenticated\""), "delete stays");
assert(!/update\s+public\.app_meta|delete\s+from\s+public\./i.test(sql), "it does not change rows");
assert(sql.includes("create policy \"app_meta_select_authenticated\""), "the undo is written in the file");

console.log("\nFAILED " + failed + "  passed=" + passed + " failed=" + failed);
process.exit(failed ? 1 : 0);
