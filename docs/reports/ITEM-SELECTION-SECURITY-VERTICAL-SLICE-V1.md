# Item Selection Security Vertical Slice v1

## Delivery

- Branch: `codex/feat/item-selection-security-vertical-slice-v1-impl`
- PR: Draft #50, `manual-merge-required`
- Risk: high; repository-owner review and merge are mandatory
- Production, real identities, secrets, commerce writes, and migration
  application are outside this Story.

## Implemented boundary

- Migration: `021_item_selection_security_vertical_slice.sql`
- Protected tables: `item_selection_runs`, `item_selection_evaluations`,
  `security_audit_events`
- Composite type: `item_selection_evaluation_write_v1`
- Security-definer RPCs: `create_item_selection_run_v1`,
  `finalize_item_selection_run_v1`
- Admin Auth routes: login, callback, MFA challenge/verify, CSRF, and logout
- Business routes: create/list runs, read run, and finalize run
- The service-role constructor remains server-only and has one importer:
  `services/item-selection-run.repository.ts`.

## Security evidence

| IDs | Evidence |
| --- | --- |
| A01-A05 | `tests/item-selection-security-disposable.test.ts` |
| A06, A09, A11, A12 | `tests/item-selection-security-database.test.ts` and the fingerprint fixture |
| A07, A10 | `tests/item-selection-security-disposable.test.ts` |
| A08 | `tests/item-selection-security-imports.test.ts` |
| A12 SDK/Auth boundary | `tests/admin-auth-contract.test.ts` |
| Preview fail-closed smoke | `tests/e2e/admin-item-selection-security.spec.ts` |

The local controller gates pass: `git diff --check`, lint with zero errors,
typecheck, 352/352 tests, and the Production build. The disposable replay
script refuses Production/remote database markers and pins Supabase CLI
2.110.0. Local replay could not start because Docker is not installed on D;
the exact same replay is a required CI job and must pass on the exact PR head.

## Rollback and remaining risk

Before Production use, rollback is to revert PR #50 and discard disposable or
Preview resources. Migration 021, Auth/RLS, and service-role behavior remain
high risk. Do not mark Ready, merge, apply the migration, or configure
Production until exact-head CI, Preview, browser evidence, and owner review
all pass.
