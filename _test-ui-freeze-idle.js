/* GI-PERF — שמירה לא סורקת את הספר שלוש פעמים ולא מעתיקה קבצים מוטמעים ל-IndexedDB.
   Run: node _test-ui-freeze-idle.js
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

function sliceFunction(src, startToken){
  const start = src.indexOf(startToken);
  if(start < 0) return "";
  let i = startToken.endsWith("{")
    ? start + startToken.length - 1
    : src.indexOf("{", start);
  if(i < 0) return "";
  let depth = 0;
  for(; i < src.length; i += 1){
    const ch = src[i];
    if(ch === "{") depth += 1;
    else if(ch === "}"){
      depth -= 1;
      if(depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const wiz = fs.readFileSync(path.join(ROOT, "gi-wizard.js"), "utf8");

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "gi-wizard.js")]).status === 0, "node --check gi-wizard.js");

console.log("\n2) IndexedDB keeps proposals out of the skeleton and skips an unchanged skeleton");
const save = sliceFunction(app, "async saveFullIdbCache(st){");
assert(!!save, "saveFullIdbCache exists");
assert(save.includes("_idbProposalShardKey"), "proposals are sharded");
assert(save.includes("_idbSlimRows"), "shard put uses a slim copy");
assert(save.includes("_idbSkeletonFingerprint"), "skeleton write is fingerprinted");
assert(save.includes("this._idbSkeletonFp !== skeletonFp"), "unchanged skeleton is skipped");
const skeleton = sliceFunction(app, "_buildIdbSkeleton(payload){");
assert(skeleton.includes("proposals: []"), "skeleton drops the proposals array");
assert(skeleton.includes("customers: []"), "skeleton drops the customers array");
assert(skeleton.includes("_giProposalShardCount"), "skeleton records the proposal shard count");
const load = sliceFunction(app, "async loadFullIdbCache(maxAgeMs = GI_FULL_IDB_TTL_MS){");
assert(load.includes('hasOwnProperty.call(payload, "_giProposalShardCount")'), "old caches without proposal shards still load");
assert(load.includes('this._readIdbShardRows(db, userKey, payload._giProposalShardCount, "p")'), "load reassembles proposal shards");
assert(load.includes("if(!proposals) return null"), "a missing proposal shard cancels the cache paint");

console.log("\n3) slim copy does not write back onto the live record");
const slim = sliceFunction(app, "_idbSlimRows(rows){");
assert(slim.includes("estimateRecordPayloadBytes"), "only a heavy row is copied");
assert(slim.includes("_idbSlimValue"), "heavy row goes through the copy");
assert(!slim.includes("row.payload ="), "slim does not assign the live payload");
assert(!slim.includes(".payload ="), "slim does not replace a payload in place");
const slimValue = sliceFunction(app, "_idbSlimValue(value, seen){");
assert(slimValue.includes('key === "dataUrl"'), "dataUrl is left out of the copy");
assert(slimValue.includes('key === "base64"'), "base64 is left out of the copy");
assert(slimValue.includes('key === "issuedPolicyFiles"'), "issued files are left out of the copy");

console.log("\n4) cache write waits out typing, then still runs");
assert(app.includes("GI_IDB_WRITE_CEILING_MS = 8000"), "deferral has a ceiling");
const schedule = sliceFunction(app, "scheduleFullIdbCacheSave(st){");
assert(schedule.includes("_idbWriteShouldWait"), "schedule checks interaction");
assert(schedule.includes("requestIdleCallback"), "idle write remains when the user is not typing");

console.log("\n5) persist normalizes once, shadows reuse the live rows");
const persist = sliceFunction(app, "async persist(label, options = {}){");
assert(!!persist, "persist exists");
assert(persist.includes("r.conflictDetected ? normalizeState(r.mergedState) : normalizeState(r.mergedState, true)"), "a normal save does not map the book again");
assert(!persist.includes("State.data = normalizeState(State.data)"), "persist does not normalize before the request");
assert(persist.includes("refreshStateShadows"), "persist still refreshes shadows");
const shadows = sliceFunction(app, "function _refreshStateShadowsImpl(options = {}){");
assert(shadows.includes("mergeLiveWithNormalizedOrphans"), "normalized book is not walked again for the shadow");
assert(shadows.includes("normalizeState(State.data)"), "a real save still normalizes once");
const reuse = sliceFunction(app, "function mergeLiveWithNormalizedOrphans(liveRows, shadowRows, normalizer){");
assert(reuse.includes("compareIsoStamps"), "a newer shadow row still wins");
assert(reuse.includes("liveById"), "an existing live row is not normalized again");

console.log("\n6) a full pull does not normalize an already-normalized payload");
const apply = sliceFunction(app, "applyRemoteState(remotePayload, options = {}){");
assert(apply.includes("options.normalized === true ? normalizeState(next, true) : normalizeState(next)"), "preMapped path when the load already normalized");
assert(apply.includes("alreadyNormalized: true"), "the idle shadow pass reuses live rows");
assert(app.includes("this.applyRemoteState(r.payload, { normalized: r.normalized === true })"), "live refresh passes the flag");

console.log("\n7) failed customer save does not scan the book again");
assert(wiz.includes("skipNormalize: true") && wiz.includes("const persistRescue = await App.persist('הלקוח נשמר'"), "rescue persist skips a second normalize");
const rescueAt = wiz.indexOf("const persistRescue = await App.persist('הלקוח נשמר'");
const rescue = wiz.slice(rescueAt, rescueAt + 220);
assert(rescue.includes("lightShadows: true") && rescue.includes("yieldUi: true"), "rescue persist stays light");

console.log("\n8) browsers fetch the new files, giSign stays");
assert(html.includes("app.js?v=20261007-lead-dup-v1&giSign=29"), "giSign=29 stays");
assert(html.includes("giLeadMeter=1&giFreeze=1"), "app.js cache bust");
assert(app.includes('"&giFreeze=1"'), "wizard href cache bust");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
