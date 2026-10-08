/* GI-READ 2026-10-08
   תצוגה בלבד: טקסט גדול יותר במכירות, בלקוחות אחרונים,
   בכותרות כרטיסי הדשבורד ובתפריט הצד.
   הרצה: node _test-dash-sales-text-size.js
*/
"use strict";

const fs = require("fs");
const path = require("path");

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

function read(name){
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function px(block, selector, prop){
  const start = block.indexOf(selector);
  if(start < 0) return "";
  const slice = block.slice(start, start + 500);
  const m = slice.match(new RegExp(prop + ":\\s*([\\d.]+)px"));
  return m ? m[1] : "";
}

const theme = read("theme.css");
const html = read("index.html");
const sw = read("service-worker.js");
const app = read("app.js");
const mark = theme.indexOf("GI-READ 2026-10-08");
const block = mark >= 0 ? theme.slice(mark) : "";

console.log("1) sales screen");
assert(!!block, "readable-text block is present");
assert(px(block, ".giDailySalesPage__table--print .sectors", "font-size") === "16", "branch names are 16px");
assert(px(block, ".giDailySalesPage__table--print .num", "font-size") === "16.5", "premium cells are 16.5px");
assert(px(block, ".giDailySalesPage__table th", "font-size") === "15", "sales column titles are 15px");
assert(px(block, ".giDailySalesPage__sectorTabLabel", "font-size") === "16", "sector tabs are 16px");

console.log("\n2) recent customers row");
assert(px(block, ".bankRecent__table td", "font-size") === "16", "recent row text is 16px");
assert(px(block, ".bankRecent__nameMeta strong", "font-size") === "16.5", "customer name is 16.5px");
assert(px(block, ".bankRecent__phone", "font-size") === "16", "phone is 16px");
assert(px(block, ".bankRecent__premLine strong", "font-size") === "17", "recent premium is 17px");
assert(px(block, ".lcCustomers__sectorTag", "font-size") === "15", "recent branch tag is 15px");

console.log("\n3) dashboard card titles and sidebar");
assert(px(block, ".bankKpi__he", "font-size") === "18", "dashboard card titles are 18px");
assert(!block.includes(".bankKpi__value"), "the big premium figure on the card is unchanged");
assert(px(block, "body:not(.sidebar-collapsed) .sidebar .nav__label", "font-size") === "16", "sidebar labels are 16px");
assert(px(block, "body:not(.sidebar-collapsed) .sidebar .nav__icon:", "width") === "24", "sidebar icons are 24px");
assert(px(block, "body:not(.sidebar-collapsed) .sidebar .nav__iconSvg", "width") === "22", "sidebar icon art is 22px");
assert(theme.includes("body.sidebar-collapsed .sidebar .nav__icon:not(#\\9):not(#\\9)") && /body\.sidebar-collapsed \.sidebar \.nav__icon:not\(#\\9\):not\(#\\9\)\{[\s\S]*?width: 36px/.test(theme), "collapsed sidebar icons stay 36px");

console.log("\n4) display only");
assert(app.includes("monthly: Math.round((row.health + row.prat) * 100) / 100"), "sales monthly total formula stays");
assert(app.includes("bankKpi__he"), "dashboard cards still render their titles");
assert(html.includes("giRead=1"), "theme cache token is bumped");
assert(sw.includes("read-v1"), "service worker cache includes the readable text");
assert(html.includes("giCfRow=1"), "previous customer-file cache token stays");

console.log("\n" + passed + " passed, " + failed + " failed");
if(failed) process.exit(1);
