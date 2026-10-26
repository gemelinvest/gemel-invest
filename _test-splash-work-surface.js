/* Splash stays up until the agent dashboard is actually paintable.
   node _test-splash-work-surface.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

console.log("1) syntax");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");

console.log("\n2) the logo still has its minimum, and the paint is inside the hold");
assert(app.includes("MIN_DISPLAY_MS: 6000"), "splash minimum stays 6 seconds");
assert(app.includes("const POST_LOGIN_SURFACE_WAIT_MS = 8000"), "a work-surface cap exists");
const loginFn = sliceBetween(app, "const completeAgentLogin = async", "const enterFromFaceSession");
assert(loginFn.includes("WelcomeLoader.waitMin()"), "minimum hold still runs");
assert(loginFn.indexOf("WelcomeLoader.waitMin()") < loginFn.indexOf("WelcomeLoader.close(true)"), "splash still closes after the hold");
assert(loginFn.indexOf("runPostLoginPipeline") < loginFn.indexOf("WelcomeLoader.close(true)"), "pipeline still finishes before the splash closes");
const pipeline = sliceBetween(app, "async runPostLoginPipeline(ctx = {}){", "_postLoginPipelineBusy = false");
assert(pipeline.includes("await this._paintWorkSurfaceBeforeReveal(targetView, ctx)"), "pipeline paints before it resolves");
assert(pipeline.indexOf("await this._paintWorkSurfaceBeforeReveal") < pipeline.indexOf("gi:app-login-ready"), "login-ready fires after the surface paint");
assert(html.includes("&giSplashReady=1"), "app.js cache token");
assert(sw.includes("splash-ready-v1"), "service worker cache generation");

console.log("\n3) a boot shell is not a ready dashboard");
const fnSrc = sliceBetween(app, "function giAgentDashboardReady(state){", "const WelcomeLoader");
assert(fnSrc.startsWith("function giAgentDashboardReady"), "predicate extracted");
const context = { result: null };
vm.createContext(context);
vm.runInContext(fnSrc + "\nresult = giAgentDashboardReady;", context);
const ready = context.result;
const boot = { performanceBoard: true, root: true, kpis: true, booting: true, renderInFlight: false, metricsBusy: false };
const building = { performanceBoard: true, root: true, kpis: true, booting: false, renderInFlight: false, metricsBusy: true };
const painting = { performanceBoard: true, root: true, kpis: true, booting: false, renderInFlight: true, metricsBusy: false };
const usable = { performanceBoard: true, root: true, kpis: true, booting: false, renderInFlight: false, metricsBusy: false };
const missing = { performanceBoard: true, root: false, kpis: false, booting: false, renderInFlight: false, metricsBusy: false };
const otherDesk = { performanceBoard: false, root: false, kpis: false, booting: true, renderInFlight: true, metricsBusy: true };
assert(ready(boot) === false, "boot shell keeps the logo up");
assert(ready(building) === false, "metrics build keeps the logo up");
assert(ready(painting) === false, "an in-flight render keeps the logo up");
assert(ready(usable) === true, "painted idle dashboard lets the logo close");
assert(ready(missing) === false, "a missing dashboard root keeps the logo up");
assert(ready(otherDesk) === true, "a non-performance desk is not trapped on KPI cards");

if(failed){
  console.error("\nFAILED " + failed + " / passed " + passed);
  process.exit(1);
}
console.log("\nOK " + passed + " assertions");
process.exit(0);
