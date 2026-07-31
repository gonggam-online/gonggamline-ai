# R1 Atomic Product Mutation

## 2026-07-31

- Added forward-only migration `022_atomic_product_mutation.sql`.
- Added four operation-specific Product mutation RPCs with hashed
  idempotency, optimistic preconditions, immutable successful audit, and
  atomic completion.
- Isolated Product writes behind the guarded service-role repository.
- Protected import, operator patch, manual competition, automatic competition,
  and bounded batch commands with Admin AAL2, exact origin, JSON CSRF,
  rate limiting, strict DTOs, and bounded idempotency keys.
- Removed Product persistence from `GET /api/domeggook-search`.
- Added migration inventory, access isolation, source alignment, batch, and
  atomic-boundary regression tests.
- Added a fail-closed disposable Postgres gate proving first commit, identical
  replay, divergent-key conflict, role denial, and audit-failure rollback.
- Added a fail-closed disposable Postgres gate proving first commit, identical
  replay, divergent-key conflict, role denial, and audit-failure rollback.

Production migration application and PR merge are intentionally excluded.
