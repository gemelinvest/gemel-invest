/**
 * Contract checks for PIN hashing (dual-run, zero login-risk).
 * Run: node _test-pin-hashing.js
 */
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "supabase-gi-pin-hashing.sql"), "utf8");

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

// Adds pin_hash column (nullable for dual-run).
assert(/alter table public\.agents\s+add column if not exists pin_hash text/i.test(sql), "must add pin_hash column");

// Hides pin_hash from REST (defense in depth, like pin).
assert(/revoke select \(pin_hash\) on public\.agents from anon, authenticated/i.test(sql), "must revoke pin_hash from anon/authenticated");

// pgcrypto enabled.
assert(/create extension if not exists pgcrypto/i.test(sql), "must enable pgcrypto");

// Dual-run compare: hash if present, else clear-text.
assert(/if ag\.pin_hash is not null then/i.test(sql), "must branch on pin_hash presence");
assert(/extensions\.crypt\(upin, ag\.pin_hash\) = ag\.pin_hash/i.test(sql), "must verify via crypt()");
assert(/trim\(both from coalesce\(ag\.pin, '0000'\)\) = upin/i.test(sql), "must keep clear-text fallback");

// Never returns pin or pin_hash.
assert(!/'pin'/.test(sql.match(/return jsonb_build_object\([\s\S]*?\)\s*;/)?.[0] || ""), "success must not return pin");
assert(!/'pin_hash'/.test(sql.match(/return jsonb_build_object\([\s\S]*?\)\s*;/)?.[0] || ""), "success must not return pin_hash");
assert(sql.includes("'agentId', ag.id"), "success return shape unchanged");

// Brute-force protection preserved (from #398).
assert(sql.includes("'LOCKED'"), "must keep LOCKED");
assert(sql.includes("'BAD_PIN'"), "must keep BAD_PIN");
assert(/gi_login_attempts/i.test(sql), "must keep attempts tracking");

// Kill switch / revert documented.
assert(/update public\.agents set pin_hash = null/i.test(sql), "must document emergency revert");

// Backfill documented (no agent reset).
assert(/extensions\.crypt\(coalesce\(pin, ''\), extensions\.gen_salt\('bf'/i.test(sql), "must document backfill from clear-text");

console.log("OK _test-pin-hashing.js");
