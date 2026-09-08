/* GI-WELCOME-SHANA-TOVA 20260908-daily-sales-v2
   אחרי סיסמה: ברכת השנה השקופה בתוך הטבעת שמתמלאת.
   לוגו הכניסה/תפריט לא משתנה. בלי באמפ מטמון.
   Run: node _test-welcome-shana-tova.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const TAG = "20260908-daily-sales-v2";
const ASSET = "assets/gi-welcome-shana-tova.png";
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

function sliceBetween(src, startToken, endToken){
  const start = src.indexOf(startToken);
  const end = src.indexOf(endToken, start + startToken.length);
  if(start < 0 || end < 0) return "";
  return src.slice(start, end);
}

const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const theme = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const welcomeSrc = sliceBetween(app, "const WelcomeLoader = {", "function getTimeGreeting")
  || sliceBetween(app, "const WelcomeLoader = {", "startStatusCycle()");

console.log("1) syntax + cache");
assert(spawnSync(process.execPath, ["--check", path.join(ROOT, "app.js")]).status === 0, "node --check app.js");
assert(html.includes("app.js?v=" + TAG), "index.html app.js cache");
assert(html.includes("app.css?v=" + TAG), "index.html app.css cache");
assert(html.includes("theme.css?v=" + TAG), "index.html theme.css cache");
assert(sw.includes("gi-v12-" + TAG), "service worker cache");
assert(app.includes('BUILD = "' + TAG + '"'), "app.js BUILD tag");

console.log("\n2) welcome loader uses Shana Tova art");
assert(fs.existsSync(path.join(ROOT, ASSET)), "transparent blessing asset exists");
assert(welcomeSrc.includes("gi-welcome-shana-tova.png") || app.includes('src="./assets/gi-welcome-shana-tova.png"'), "welcome img src is blessing");
assert(app.includes("lcWelcomeLoader--shanaTova"), "welcome root marks blessing layout");
assert(app.includes("startRingFill"), "filling ring still runs");
assert(app.includes("lcWelcomeLoader__ringFill"), "ring fill element kept");
assert(app.includes("lcWelcomeLoader__ringTrack"), "ring track kept");
assert(!/WelcomeLoader[\s\S]{0,1800}logo-login-clean\.png/.test(app), "welcome loader no longer uses company login logo");

console.log("\n3) login and chrome logos unchanged");
assert(html.includes('src="./logo-login-clean.png"'), "login screen still company logo");
assert((html.match(/logo-login-clean\.png/g) || []).length >= 2, "login + chrome still company logo");
assert(!html.includes("gi-welcome-shana-tova.png"), "blessing is not on the login HTML");

console.log("\n4) transparent plate, ring around the art");
assert(/width:\s*min\(640px/.test(theme), "ring mark is large enough for the landscape blessing");
assert(/height:\s*min\(640px/.test(theme), "ring mark stays circular");
assert(theme.includes(".lcWelcomeLoader__ringTrack"), "ring track CSS kept");
assert(theme.includes(".lcWelcomeLoader__ringFill"), "ring fill CSS kept");
assert(theme.includes("conic-gradient"), "ring still fills around the art");
assert(/\.lcWelcomeLoader__logoPlate[\s\S]{0,400}background:\s*transparent/.test(theme), "no white circular card behind the art");
assert(/\.lcWelcomeLoader__logoPlate[\s\S]{0,500}overflow:\s*visible/.test(theme), "art is not clipped into a stuck circle");
assert(/\.lcWelcomeLoader__logoPlate[\s\S]{0,500}box-shadow:\s*none/.test(theme), "no floating plate shadow");
assert(/\.lcWelcomeLoader__logo:not\(#\\9\):not\(#\\9\)[\s\S]{0,500}object-fit:\s*contain/.test(theme), "blessing keeps aspect inside the ring");
assert(/\.lcWelcomeLoader__logo:not\(#\\9\):not\(#\\9\)[\s\S]{0,500}background:\s*transparent/.test(theme), "logo itself has no opaque fill");

console.log("\n5) PNG has a transparent background");
const png = fs.readFileSync(path.join(ROOT, ASSET));
assert(png.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "asset is PNG");
assert(png.includes(Buffer.from("IHDR")), "PNG header");
assert(png.includes(Buffer.from("IDAT")), "PNG pixels");
const tRNS = png.includes(Buffer.from("tRNS"));
const ihdr = png.indexOf(Buffer.from("IHDR"));
const colorType = ihdr >= 0 ? png[ihdr + 13] : -1;
assert(colorType === 6 || tRNS, "PNG is RGBA / has transparency");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
