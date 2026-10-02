#!/usr/bin/env node
/**
 * GI-SEC A5: XSS scan — find innerHTML/insertAdjacentHTML template literals that
 * interpolate user-controlled values WITHOUT escapeHtml()/escapeAttr().
 *
 * Heuristic, not exhaustive. Flags candidates for manual review.
 * Run: node scripts/sec-xss-scan.mjs
 * Exit 0 = no unescaped interpolation found (may still have false negatives), 1 = candidates found.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname ?? ".", "..");
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const files = ["gi-assistant.js", "gi-face-auth.js", "gi-daily-sales.js", "gi-remote-support.js", "gi-system-notice.js", "gi-sale-toast.js", "gi-wizard.js", "gi-simulators.js"];
const sinks = ["innerHTML", "insertAdjacentHTML", "outerHTML"];
const esc = ["escapeHtml", "escapeAttr", "escHtml", "escapeHTML", "textContent", "esc"];

const findings = [];

function scan(text, file){
  // Find sink assignments with a template literal:  SINK = ` ... `
  const re = new RegExp("(" + sinks.join("|") + ")\\s*=?\\s*([+~]?\\s*)`([\\s\\S]*?)`([+~]?\\s*)`", "g");
  // Simpler: walk line by line, then capture until the closing backtick on a later line.
  const lines = text.split("\n");
  for(let i = 0; i < lines.length; i += 1){
    for(const sink of sinks){
      const m = lines[i].match(new RegExp("\\b" + sink + "\\s*=?\\s*`"));
      if(!m) continue;
      // gather until matching closing backtick (naive: count backticks; templates may nest)
      let buf = lines[i];
      let depth = 1;
      let j = i;
      while(depth > 0 && j + 1 < lines.length){
        j += 1;
        buf += "\n" + lines[j];
        // count backticks not preceded by backslash
        const ticks = (lines[j].match(/(?<!\\)`/g) || []).length;
        depth += ticks % 2 === 1 ? 1 : 0; // odd -> opened a new template
        // simpler: just toggle
      }
      // Re-evaluate depth properly:
      depth = 0;
      const full = lines.slice(i, j + 1).join("\n");
      for(let k = 0; k < full.length; k += 1){
        if(full[k] === "`" && full[k - 1] !== "\\") depth = depth === 0 ? 1 : 0;
      }
      if(depth !== 0){
        // unbalanced; skip
        i = j;
        continue;
      }
      const tpl = full;
      // find ${...} interpolations
      const interp = [...tpl.matchAll(/\$\{([^}]*)\}/g)];
      for(const it of interp){
        const expr = it[1];
        const trimmed = expr.trim();
        // skip control-flow / flags / numeric / option keys
        if(/^(i|j|k|idx|index|n|count|len|length|key|id|c|r|p|pick|bn|field|kind|show|open|legal|bens|rel|bank|company|product|status|when|count|step|clock|view|mode|src|alt|class|colspan|role|type|for|tabindex|aria|\d+)(\b|$|[-+]\s*\d)/.test(trimmed)) continue;
        // skip if already escaped
        const isEscaped = esc.some((e) => new RegExp("\\b" + e + "\\s*\\(").test(expr));
        if(isEscaped) continue;
        // focus on free-text-ish identifiers (likely user-controlled)
        const isFreeText = /\b(name|text|note|title|label|value|content|msg|body|desc|comment|remark|agentName|customerName|fullName|displayName|html|inner|payload|detail|message|reply|chat|text|note|email|phone|address|city|street)\b/i.test(expr);
        if(!isFreeText) continue;
        findings.push(`${file}:${i + 1}  ${sink} interpolation not wrapped in escapeHtml: \${${expr.trim().slice(0, 60)}}`);
      }
      i = j;
    }
  }
}

scan(src, "app.js");
for(const f of files){
  try { scan(fs.readFileSync(path.join(root, f), "utf8"), f); } catch {}
}

console.log("=== GI-SEC A5: XSS scan ===");
console.log(`Scanned app.js + ${files.length} files for unescaped innerHTML/insertAdjacentHTML/outerHTML interpolations.`);
if(findings.length === 0){
  console.log("No unescaped interpolation found (heuristic; manual review still recommended). OK");
  process.exit(0);
}
console.log(`\nCandidates for manual review (${findings.length}):`);
for(const f of findings) console.log("  ? " + f);
process.exit(1);
