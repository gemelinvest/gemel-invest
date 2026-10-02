#!/usr/bin/env node
/**
 * GI-SEC A5: Software Composition Analysis + secrets-leak check (read-only).
 * Scans index.html for CDN dependency versions, checks app.js + Edge functions
 * for accidental service_role / sb_secret key leakage, and reports findings.
 *
 * Run: node scripts/sec-audit-sca.mjs
 * Exit code: 0 = no critical leak found (warnings may still print), 1 = critical leak.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname ?? ".", "..");
const findings = [];
const warnings = [];
const critical = [];

function read(p){
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

// 1) Extract CDN dependency versions from index.html.
const indexHtml = read(path.join(root, "index.html"));
const cdnRefs = [];
for(const line of indexHtml.split("\n")){
  const m = line.match(/https:\/\/(cdn\.jsdelivr\.net\/npm\/|unpkg\.com\/)([^"']+)["']/);
  if(!m) continue;
  const path = m[2]; // e.g. @supabase/supabase-js@2  or  pdf-lib@1.17.1
  const at = path.lastIndexOf("@");
  if(at <= 0) continue;
  const pkg = path.slice(0, at);
  const ver = path.slice(at + 1).split("/")[0];
  cdnRefs.push({ url: m[0], pkg, ver });
}

if(cdnRefs.length === 0) warnings.push("No CDN dependency references found in index.html.");
findings.push(...cdnRefs.map((r) => ({ type: "dependency", ...r })));

// 2) Floating/major versions (no exact pin) -> warning. A version is "floating"
// only if it has no dots (e.g. "2") — exact semver like "1.17.1" is fine.
for(const r of cdnRefs){
  if(!/\./.test(r.ver)){
    warnings.push(`Floating/major version for ${r.pkg}: ${r.ver} (consider pinning to an exact patch).`);
  }
}

// 3) Secrets leak check: service_role / sb_secret / private key in client-reachable code.
const clientFiles = ["app.js", "gi-assistant.js", "gi-face-auth.js", "gi-daily-sales.js", "gi-remote-support.js", "gi-system-notice.js", "gi-sale-toast.js", "index.html"];
const secretPatterns = [
  /sb_secret_[A-Za-z0-9_-]{10,}/,
  /service_role/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, // JWT-shaped literal
];
for(const f of clientFiles){
  const txt = read(path.join(root, f));
  if(!txt) continue;
  for(const pat of secretPatterns){
    const m = txt.match(pat);
    if(m){
      // service_role as a word in a comment is fine; flag only if it looks like a key assignment or a secret literal.
      const hit = m[0];
      if(/service_role/i.test(hit) && !/key|secret|token|sb_secret|eyJ/.test(txt.slice(Math.max(0, txt.indexOf(hit) - 40), txt.indexOf(hit) + 40))){
        continue; // just the word "service role" in prose
      }
      critical.push(`Potential secret leak in ${f}: pattern "${hit.slice(0, 30)}..."`);
    }
  }
}
// Also scan Edge function source for hardcoded secrets (less strict — they legitimately use Deno.env).
const edgeDir = path.join(root, "supabase/functions");
for(const fn of fs.readdirSync(edgeDir).filter((n) => fs.statSync(path.join(edgeDir, n)).isDirectory())){
  const idx = read(path.join(edgeDir, fn, "index.ts"));
  for(const pat of [/sb_secret_[A-Za-z0-9_-]{20,}/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/]){
    const m = idx.match(pat);
    if(m) critical.push(`Hardcoded secret in supabase/functions/${fn}/index.ts: "${m[0].slice(0, 30)}..."`);
  }
}

// 4) Report.
console.log("=== GI-SEC A5: SCA + secrets-leak audit ===");
console.log(`Dependencies found: ${cdnRefs.length}`);
for(const r of cdnRefs) console.log(`  - ${r.pkg}@${r.ver}  (${r.url})`);
if(warnings.length){
  console.log("\nWarnings:");
  for(const w of warnings) console.log(`  ! ${w}`);
}
if(critical.length){
  console.log("\nCRITICAL — potential secret leak:");
  for(const c of critical) console.log(`  X ${c}`);
  process.exit(1);
}
console.log("\nNo critical secret leak found. OK");
process.exit(0);
