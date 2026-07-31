# Production Access Matrix v1

## Decision

This is the R0 source of truth required by
`PRODUCTION-SCHEMA-SECURITY-RECONCILIATION-V1`. The machine-verifiable matrix is
[`production-access-matrix-v1.json`](production-access-matrix-v1.json).

The target is default deny. The matrix does not authorize SQL, migration-history
repair, Production mutation, or deployment. Existing migrations 000 through 021
remain immutable.

## Result

- All 60 `public` tables declared by migrations 000 through 021 are assigned
  exactly once.
- The 57 tables observed in Production and the three migration-021 tables that
  are absent remain explicitly distinguished.
- `products` keeps intentional anonymous read as the proposed target, but its
  existing anonymous mutations are blocked on R1 protected-admin access.
- The six unused Commerce OS tables target `DORMANT_DENY`.
- Every other active data surface targets server-only reads and explicit
  administrator or isolated-worker mutations.
- Every active write group records consumer evidence, target principal,
  operation, column-boundary requirement, idempotency, audit, and failure
  behavior.

## Important interpretation

`SERVER_ONLY` is a target security boundary, not a statement that the current
code already satisfies it. Most current services use the shared anonymous
client in `lib/supabase.ts`. A table marked `BLOCKED_R1` cannot be made
restrictive in R2 until its consumers have moved to a protected administrator
or use-case-isolated worker client and negative authorization tests pass.

The matrix groups tables only where they share one application/security
boundary. Its contract test expands every group and compares the result with
the migration inventory, so an omitted or duplicate table fails CI.

## R1 priority derived from the matrix

1. Replace Product anonymous `INSERT` and `UPDATE` with a protected
   administrator server boundary while retaining the explicitly justified
   public read contract.
2. Define one isolated client per worker use case; do not add service-role
   credentials to `lib/supabase.ts`.
3. Add negative authorization, idempotency, audit, and failure-contract tests.
4. Re-audit remaining mixed administrator/worker groups before generating R2
   SQL.

## Rollback

This R0 change is documentation and a contract test only. Revert its commit if
the target matrix is rejected. No database or runtime behavior changes.
