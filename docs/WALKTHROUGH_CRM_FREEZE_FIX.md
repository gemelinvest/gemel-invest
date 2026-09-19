# Walkthrough — CRM freeze remediation (2026-09-19)

Production measurements showed freezes for managers from JSONB seq-scans every 2.5s, a ~2.5MB `app_meta.global` row, and dashboard KPI RPCs unpacking all customer payloads.

## What shipped

**Already live in the database (safe while agents work):**
- `idx_customers_updated_at_desc` — working-set / delta now Index Scan (was Parallel Seq Scan)
- `ANALYZE customers`
- Cleared 22 stuck `callSession.active=true` flags (all already had `finishedAt`; 0 remain)
- Slimmed `app_meta.global` elementary referrals: **2.54MB → 140KB** (backup: `gi_meta_backup_20260919_freeze`)
- KPI RPCs pre-filter by date before unpacking JSONB; smoke test returns month-to-date numbers

**In this PR (takes effect after agents refresh via non-forced update banner):**
- MirrorCall toast watcher: no JSONB `active=true` filter; managers skip org-wide remote poll; interval 2.5s → 8s
- `app_meta` writes keep slim elementary referrals; merge keeps richer local payload
- Heavy-roster managers skip `sales_by_product` / `sales_by_company` extras on each dashboard fill
- Opening a heavy customer file strips embedded blobs above 512KB

## Verify

```bash
node _test-crm-freeze-fix.js
node _test-customer-open-freeze.js
```
