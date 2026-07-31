# R2 Product security rehearsal

This runbook prepares the accepted R2 Product security reconciliation without
connecting the repository to Production or generating candidate migration 023
before the restored inventory gate passes.

## Approved boundary

- Use only a current, owner-approved restore in a new isolated non-Production
  Supabase project.
- Quarantine the target before repository code is attached. Disable external
  hooks and integrations, including `pg_net`, `pg_cron`, wrappers, webhooks,
  queues, email, marketplace credentials, and paid providers.
- Keep `R2_REHEARSAL_DATABASE_URL` in the approved secret store. Never paste it
  into chat, command history, artifacts, PR text, or tracked files.
- Do not run this collector against Production. It emits catalog metadata and
  coarse Product row-count ranges only; it never emits Product values.

## Read-only pre-inventory

After the repository owner confirms the exact target and quarantine controls:

```powershell
./scripts/collect-r2-product-security-inventory.ps1 `
  -TargetProjectRef '<isolated-project-ref>' `
  -ConfirmedNonProduction `
  -ConfirmedQuarantined `
  > '<approved-restricted-location>/r2-pre-inventory.csv'

npx tsx scripts/validate-r2-product-security-inventory.ts `
  '<approved-restricted-location>/r2-pre-inventory.csv'
```

The collector opens a read-only transaction and records the complete migration
history; the validator requires exactly 000-022 with no gaps or additions. It
also records Product/R1 relation ownership and RLS, exact policies, relation and
function ACLs, R1 function signatures/owners/search paths, public-schema object
creators, explicit default ACLs plus owner/type completeness states, extensions,
the complete Product privilege matrix for `PUBLIC`, `anon`, `authenticated`, and
`service_role`, the complete R1 execute matrix, and a Product row-count range.
The validator blocks malformed CSV, secret-like content, unknown categories,
migration/policy/function drift, missing relations, missing grant/default-ACL
evidence, unsafe external-work extensions, and unsafe row counts. A successful
result is a small canonical JSON report with the classified SHA-256 fingerprint,
creator roles, Product policy identifiers, and row-count range; it does not
include raw catalog rows.

Store raw output only in the approved restricted evidence location. Review it
for secrets before producing a sanitized artifact. Record only the backup
timestamp or opaque restore job ID, target project ref, region, classified
fingerprint, and row-count range.

## Mandatory stop conditions

Do not create migration 023 if any of these is unknown or divergent:

- backup provenance, isolation, quarantine, or migration history;
- migration 022 and every exact R1 RPC signature;
- Product policies, effective grants, owners, or RLS state;
- function owner, `SECURITY DEFINER`, fixed search path, or execute matrix;
- public-schema creator roles or their default ACLs;
- extensions/hooks capable of external work;
- the intentional anonymous Product read or zero-anonymous-write source audit.

Candidate 023 must be derived from the accepted inventory, name only exact
inventory-confirmed policies and creator roles, remain one forward-only
transaction, and receive separate review before it is applied to the restored
target. Production application, migration-history repair, and rollback that
restores anonymous writes are prohibited.
