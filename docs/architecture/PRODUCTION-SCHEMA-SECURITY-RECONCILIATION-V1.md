# Production Schema Security Reconciliation v1

## Status

- Status: accepted for architecture and discovery on 2026-07-30.
- Owner / approver: Database / Security; repository owner.
- Risk: high-risk for every later migration, RLS, grant, history-repair, or
  Production action.
- Implementation authorization: architecture evidence only. This acceptance
  does not authorize a reconciliation migration, migration-history repair, or
  Production execution.

## Problem and business objective

Production contains the 57 public tables expected from migrations 000 through
020, while `supabase_migrations.schema_migrations` is absent. Migration 021 is
not partially applied. A verified logical backup exists outside the repository.

An official `linked -> migrations` comparison proved that the deployed
security state is not identical to a fresh replay:

- nine legacy permissive policies exist only in Production;
- seven legacy tables would change RLS state;
- default privileges and explicit grants differ;
- migrations 005 through 020 also contain development `FOR ALL USING (true)
  WITH CHECK (true)` policies that are present in both environments.

Blindly marking 000 through 020 as applied would certify an unresolved security
state. Blindly removing the policies would break application paths that still
use the anonymous Supabase client.

The objective is to make intended schema history reproducible without
preserving development-wide writes or interrupting revenue operations.

## Current-state evidence

- Backup directory:
  `D:\Dev\backups\gonggamline-ai\2026-07-30-pre-migration-021`
- Backup artifacts: `schema.sql`, `data.sql`, and `roles.sql`; each has a
  recorded SHA-256 and a current-user/SYSTEM/Administrators-only ACL.
- Data restore warning: circular foreign keys exist between
  `commerce_workflows` and each of `coupang_registration_jobs` and
  `listing_drafts`; restore rehearsal must account for constraint ordering.
- Production-only policies:
  - Product anonymous `SELECT`, `INSERT`, and `UPDATE`;
  - six `v4_dev_all_*` Commerce OS policies for `anon` and `authenticated`.
- The six Commerce OS tables have no proven active application consumer.
- Product read and write paths are active and currently use the shared anonymous
  Supabase client through server route handlers and services.
- Migration 021 creates three new default-deny RLS tables and two service-role
  RPCs. Its objects are absent in Production; UTF-8 and `pgcrypto.digest` are
  available.

No credential, raw business row, or backup content belongs in Git evidence.

## Security decision

Development-wide policies are not an acceptable Production target. Production
drift is evidence to reconcile, not behavior to copy into a new migration.

The following target principles are binding:

1. Browser clients never receive direct write permission.
2. The six dormant Commerce OS tables become default-deny before they are used.
3. Product reads and mutations receive separate contracts; anonymous writes
   cannot remain as the long-term compatibility mechanism.
4. Server-only elevated access is isolated by use case and never added to the
   shared `lib/supabase.ts` client.
5. Migration history is repaired only after every version is classified
   against deployed schema and the security exceptions are represented by an
   approved forward migration.
6. Existing migrations 000 through 021 remain byte-for-byte immutable.

## Required access matrix

Before SQL generation, every public table must be assigned one of:

- `PUBLIC_READ`: anonymous `SELECT` only, explicitly justified;
- `AUTHENTICATED_READ`: authenticated `SELECT` only;
- `SERVER_ONLY`: no `anon` or `authenticated` Data API access;
- `ADMIN_MUTATION`: protected Admin service/RPC path only;
- `WORKER_MUTATION`: isolated server worker path only;
- `DORMANT_DENY`: RLS enabled with no client policy.

For each write path, record the route/service, principal, role, columns,
operation, idempotency boundary, audit evidence, and failure behavior.
Unclassified means deny and blocks reconciliation SQL.

## Ordered delivery

### R0 — architecture and inventory

1. Preserve the verified backup and diff hashes outside Git.
2. Record all deployed policies, RLS states, grants, and default privileges.
3. Map application consumers and assign the access matrix.
4. Approve the target state before SQL exists.

### R1 — application access migration

1. Replace anonymous Product mutations with a protected server boundary.
2. Isolate any required worker/service-role access by use case.
3. Add contract and negative authorization tests.
4. Deploy code compatibility before restrictive database changes.

### R2 — forward-only security reconciliation migration

1. Add a new migration after 021; do not edit 000 through 021.
2. Remove unconditional development policies.
3. Apply the approved table-specific policies and grants.
4. Fail closed if an expected legacy policy or object shape is unknown.
5. Verify through a disposable full replay and a restored-backup rehearsal.

### R3 — migration-history repair and Production rollout

1. Take a new verified backup.
2. Re-run catalog and schema comparisons.
3. Use the official Supabase CLI `migration repair --status applied`; never
   insert migration-history rows manually.
4. Require `db push --dry-run` to list only the explicitly approved pending
   migrations.
5. Apply in a maintenance window with read-only health/API/browser checks.

## Failure modes and stop conditions

- Any unclassified table or write path stops SQL generation.
- Any unexpected Production policy, grant, object, or checksum stops history
  repair.
- Backup restore failure stops Production rollout.
- Application compatibility failure stops restrictive policy deployment.
- Missing Production secrets or administrator identity stops Item Selection
  enablement; code must not compensate.
- No rollback may reintroduce unconditional anonymous writes. Rollback disables
  the affected application feature or restores the pre-change backup under a
  separately approved incident runbook.

## Verification

- Static inventory and policy-name tests.
- Disposable migrations 000 through the reconciliation head.
- Positive and negative role tests for every access-matrix class.
- Restored-backup rehearsal in a non-Production project.
- Schema fingerprint comparison with explicitly classified differences.
- Lint, typecheck, unit/integration tests, Production build, Preview browser
  validation, and exact-head CI.

## Non-goals

- Production execution in this Architecture Story.
- Preserving permissive development policies.
- Editing migrations 000 through 021.
- Direct migration-history inserts.
- Broad shared service-role access.
- Marketplace, order, inventory, settlement, or other commerce writes.
