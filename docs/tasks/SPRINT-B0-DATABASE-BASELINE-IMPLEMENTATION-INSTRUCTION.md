# Sprint B-0 Database Baseline Implementation Instruction

## Authority and execution gate

- Status: prepared; not authorized to execute.
- Risk: high-risk/manual.
- Architecture dependencies:
  - Item Selection Database Baseline Architecture v1: Accepted.
  - Admin Identity, Authorization, RLS, and CSRF Architecture v1: Accepted.
  - Sprint B-0 Database Baseline Execution v1: still Proposed and requires a
    separate repository-owner approval before implementation.
- Delivery boundary: one non-`main` branch and one
  `manual-merge-required` implementation PR.
- Production execution, Production credentials, Production migration-history
  mutation, and real commerce writes are prohibited.

This instruction is a handoff document only. Its presence does not authorize
Sprint B-0 implementation.

## Business outcome

Create a reproducible disposable database baseline so the engine-selected Item
Selection flow can proceed toward auditable persistence without risking
Production data or repeatedly stopping on schema drift.

## Required scope after separate approval

1. Create a task-specific `codex/` branch from the approved base.
2. Promote the three existing recovery sources into canonical pre-003 baseline
   migrations with provenance headers:
   - `products-baseline.sql`
   - `product-workflow-extension.sql`
   - `commerce-os-core-schema.sql`
3. Preserve existing migrations 003 through 020 byte-for-byte and in order.
4. Keep historical permissive policies out of the promoted baseline files.
5. Add the post-020 least-privilege security boundary required by the accepted
   Admin Architecture:
   - protected objects default-deny;
   - no direct protected DML or function execution for `anon` or
     `authenticated`;
   - service-role use remains server-only and is not represented as constrained
     by RLS.
6. Add a disposable Supabase-supported replay runner that refuses Production
   configuration and starts from an empty environment.
7. Add schema fingerprint, grant/RLS, replay, and negative-access tests.
8. Prove the exact SQL, SDK, grant, rollback, and supported Supabase behavior
   in that disposable environment.

## Non-goals

- No Production migration or data operation.
- No migration-history adoption or metadata editing in Production.
- No renaming or rewriting migrations 003 through 020.
- No application API, UI, Item Selection persistence, or Story 3 feature.
- No administrator invitation, lifecycle automation, custom Auth Hook,
  `auth.sessions` access, session-revocation ledger, MFA reset, break-glass,
  canonical security ledger, or telemetry state machine.
- No real marketplace, supplier, order, inventory, settlement, or payment
  write.

## Implementation checkpoints

1. Verify the repository, clean worktree, approved base, and exact dependency
   heads.
2. Record AI CTO and Architecture compliance plus high-risk classification.
3. Inventory recovery sources and migrations 003 through 020 by path and hash.
4. Define disposable Local/CI/Preview configuration without secret values in
   the repository.
5. Add the three provenance-preserving baseline migrations.
6. Add the post-020 least-privilege migration.
7. Implement replay and deterministic fingerprint checks.
8. Implement positive/negative RLS and grant tests using actual Supabase token
   shapes.
9. Run complete local validation and review the full migration/security diff.
10. Push one Draft high-risk PR with `manual-merge-required`.
11. Verify exact-head CI, exact-commit Vercel Preview, and non-destructive
    browser checks.
12. Stop for repository-owner migration/security review; do not merge or run
    against Production.

## Acceptance criteria

- Fresh disposable replay completes with zero SQL errors.
- All expected baseline tables and approved fingerprints are reproducible.
- Migrations 003 through 020 match their pre-task hashes.
- No unconditional protected write policy remains after the final migration.
- Direct protected access by `anon` and `authenticated` is denied.
- Explicitly approved server operations succeed only through the accepted
  server boundary.
- A forced migration or security-test failure fails closed and leaves no
  Production impact.
- Unit/integration tests, lint, typecheck, Production build, exact-head CI,
  Preview browser validation, and exact-commit Vercel Preview pass.
- The PR contains no secret, local environment file, `node_modules`, database
  dump, Playwright report, or generated artifact.

## Required delivery report

- Branch and exact commit SHA.
- Complete migration and tooling file list.
- Recovery-source provenance and preserved migration hashes.
- Disposable environment and replay result.
- Schema fingerprint and RLS/grant test results.
- Unit/integration, lint, typecheck, build, CI, Preview, and browser results.
- Confirmation that Production was not contacted or mutated.
- Remaining blockers and exact repository-owner action required.

## Rollback

Revert the implementation PR and dispose of the isolated database. Because
Production execution is prohibited, no Production data or migration rollback
is part of Sprint B-0 verification.
