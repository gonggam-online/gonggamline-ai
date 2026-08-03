# Item Selection Security v1 changelog

## 2026-08-03

- Added Story 4's server-owned bounded Item Selection workflow and the three
  approved Admin operations: create/run, keyset-paginated history, and capped
  detail. The workflow reuses Story 1-3 evaluator, profitability, Auth/AAL2,
  CSRF, rate-limit, repository, transaction, and idempotency boundaries.
- Removed the client-authored finalization route. Fingerprints, versions,
  canonical hashes, provider reads, evaluation, and atomic finalization are
  now owned by the application service. Size 30 uses one bounded list read,
  response details stop at 30 evaluations, and missing provider evidence stays
  UNKNOWN/INCOMPLETE/MANUAL_REVIEW.
- Added contract and behavior tests for capacity, deduplication, partial and
  failed runs, provider failure sanitization, idempotent replay, route count,
  AAL2/CSRF/rate-limit ordering, and response caps. No migration, Production
  execution, UI, Product mutation, or commerce write is included.

- Added Story 4's server-owned bounded Item Selection workflow and the three
  approved Admin operations: create/run, keyset-paginated history, and capped
  detail. The workflow reuses Story 1-3 evaluator, profitability, Auth/AAL2,
  CSRF, rate-limit, repository, transaction, and idempotency boundaries.
- Removed the client-authored finalization route. Fingerprints, versions,
  canonical hashes, provider reads, evaluation, and atomic finalization are
  now owned by the application service. Size 30 uses one bounded list read,
  response details stop at 30 evaluations, and missing provider evidence stays
  UNKNOWN/INCOMPLETE/MANUAL_REVIEW.
- Added contract and behavior tests for capacity, deduplication, partial and
  failed runs, provider failure sanitization, idempotent replay, route count,
  AAL2/CSRF/rate-limit ordering, and response caps. No migration, Production
  execution, UI, Product mutation, or commerce write is included.

- Audited migration 021 and retained its existing create/finalize transaction,
  idempotency, immutable aggregate, and retry-lineage implementation unchanged.
- Added migration 024 with one service-role-only, audited stale-run recovery
  RPC. It uses a database-clock 30-minute threshold, locks the run against
  finalization, fails closed on identity/evaluation conflicts, and only turns
  an empty abandoned `RUNNING` aggregate into `FAILED`.
- Added the internal repository contract and Story 3 recovery tests. No public
  route, UI, provider orchestration, Product/commerce write, or Production
  execution is included.

## 2026-07-30

- Added immutable Item Selection run/evaluation persistence and audited RPCs
  in migration 021 without changing migrations 000-020.
- Added fail-closed Admin SSR Auth, UUID allowlist, fresh AAL2, purpose-bound
  CSRF, bounded rate limits, protected Route Handlers, and the sole
  service-role repository boundary.
- Added A01-A12 contract/import/database tests, an exact fingerprint,
  disposable 000-021 replay, CI integration, and Preview browser smoke.
- Delivery remains a high-risk Draft PR with manual merge required.
