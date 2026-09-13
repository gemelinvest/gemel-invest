# Walkthrough — CRM Architecture Audit

## What shipped

Documentation-only audit of the GEMEL INVEST CRM (no RLS / Auth / UI behavior changes):

| Artifact | Purpose |
|----------|---------|
| [`docs/CRM_ARCHITECTURE_AUDIT.md`](../docs/CRM_ARCHITECTURE_AUDIT.md) | Full architecture + security + performance report |
| [`docs/CRM_REMEDIATION_ROADMAP.md`](../docs/CRM_REMEDIATION_ROADMAP.md) | Prioritized fixes; stop-before-RLS guidance |
| [`scripts/r1-verify-anon-access.mjs`](../scripts/r1-verify-anon-access.mjs) | Re-runnable Production anon-access check |
| [`docs/sql-drafts/R9_hide_agent_pins.DRAFT.sql`](../docs/sql-drafts/R9_hide_agent_pins.DRAFT.sql) | DRAFT only — not applied |

## R1 Production result (critical)

With the publishable key from `app.js` only (no user session):

- `agents` readable (~58), including **`pin` in clear text**
- `customers` readable (~51.5k); **INSERT + UPDATE succeed**; DELETE blocked for anon
- `proposals`, `campaign_leads`, reports, activity log, simulator saves readable
- Storage object listing on `gi-customer-files` succeeds
- Edge `gi-daily-sales-mail` `status` responds without user JWT

Verification command:

```bash
node scripts/r1-verify-anon-access.mjs
# exits 1 while CRITICAL anon access remains
```

## Intentionally not changed

Per audit rules: no RLS policies applied, no Auth migration, no UI/CSS/API refactor.  
Next recommended approved step: plan **R9-pre** (RPC login before hiding `agents.pin`) or full **R2** Auth+RLS design.

## Manual cleanup

```sql
delete from public.customers where id = '__audit_probe_cust__';
```
