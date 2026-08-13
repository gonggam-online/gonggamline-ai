# Sprint 3 - Runtime Stabilization

# Item Selection finalization RPC correction

## Fixed

- Added forward-only migration 025 to correct PostgreSQL composite-array field
  access in the atomic Item Selection finalizer without changing its signature,
  validation, locking, audit, owner, or grants.
- Added a local-only Supabase RPC regression requiring one bounded synthetic run
  to persist 10 evaluations and matching CREATE/FINALIZE audits.
- Extended the baseline manifest and disposable 000-025 replay gate.

## Preserved

- Migration 021 and existing Production history remain immutable.
- No Product, provider, marketplace, supplier, order, inventory, fulfillment,
  settlement, payment, Auth/RLS, secret, or external configuration change.
- Production application of migration 025 remains manual/high-risk.

# Item Selection Story 6 - Production CSRF contract correction

## Fixed

- Aligned the Admin Item Selection execution request with the server's canonical
  `X-GonggamLine-CSRF` header contract.
- Mapped `CSRF_DENIED` separately from the recent-MFA authorization failure so
  operators receive the correct recovery action.
- Added focused and desktop/narrow browser regression coverage for the canonical
  header and rejection of the obsolete header.

## Unchanged

- Item Selection API response contracts, workflow, evaluator, profitability
  policy, persistence schema, migration 024, Auth/RLS, and Production secrets.
- Product creation and marketplace, supplier, order, inventory, fulfillment,
  settlement, and payment writes.

# Sprint 3 - Revenue Dashboard Release Hardening

## Added

- Cross-layer release-boundary regression tests for the single read-only API,
  GET-only route, engine/DTO separation, local state, timestamp semantics,
  documentation, generated evidence, and no migration/environment scope.
- Stable mobile screenshot evidence in Revenue Dashboard browser validation.
- Final architecture, known-limitations, and rollback documentation.
- Playwright reports and test results are explicitly ignored.

## Confirmed

- No database or migration change.
- No Ranking, Revenue Score, Revenue Calculation, Queue, Worker, OpenAI/LLM,
  authentication, environment, marketplace, order, inventory, or payment write.

# Sprint 3 - Revenue Dashboard Operational UX

## Added

- Distinct API data-generation and successful client-refresh timestamps.
- Live active-filter summary and one-action filter reset.
- Duplicate refresh suppression, tested retry recovery, long Product name
  containment, bounded reason badges, and mobile overflow verification.

## Clarified

- A missing Product analysis time remains `Not analyzed`; generated and
  refreshed times never substitute for `lastAnalyzedAt`.

# Sprint 3 - Revenue Dashboard Search and URL State

## Added

- Product keyword search through the existing read-only Dashboard API and
  Product query before Ranking pagination.
- Shareable URL state for search, recommendation, status, minimum score, and
  offset, including refresh and browser-history restoration.
- Search submit/clear controls and combined search/filter/pagination E2E.

## Preserved

- Existing Dashboard API requests and response DTO remain compatible.
- No client-current-page search, new calculation, DB/migration, global store,
  engine change, or external write.

# Item Selection Story 5 - Admin UI and history

## Added

- Accessible `/admin/item-selection` execution, current-page summary, status filter, keyset history, bounded detail, and verdict filter UI.
- Exact approved CSRF and idempotency flow for size 10/20/30 evaluations, plus explicit retry linkage for partial and failed runs.
- Desktop and narrow mocked operator E2E coverage without provider, database, Product, or marketplace writes.

## Unchanged

- Item Selection evaluator, profitability policy, persistence, workflow, and Admin API contracts.
- Database, migrations, Auth/RLS, Product creation, listings, orders, inventory, supplier writes, and Production configuration.

# Sprint 3 - Revenue Dashboard UI v1

## Added

- Read-only `/dashboard/revenue` operating page backed exclusively by
  `GET /api/dashboard/revenue`.
- Summary cards, recommendation/status/minimum-score filters, refresh,
  ranking table, reason/status/recommendation badges, and pagination.
- Loading, empty, retryable error, responsive, keyboard, and semantic table
  states.
- 31 focused UI tests and an operator-flow Playwright scenario.
- Revenue Dashboard component and data-flow documentation.

## Unchanged

- Dashboard API and its response contract.
- Revenue Calculation, Revenue Score, Revenue Ranking, Runtime Queue, Workers,
  database, migrations, OpenAI/LLM, and all commerce write operations.

# Sprint 3 - Dashboard Foundation

## Added

- Shared presentation-only Dashboard layout, header, content, toolbar, section,
  card, empty, error, loading, and pagination components.
- Semantic landmarks, accessible live regions, native link pagination, reduced
  motion support, and responsive desktop/tablet/mobile-safe styling.
- Dashboard UI architecture and component rules documentation.
- SSR rendering, props, accessibility, state, and presentation-boundary tests.

## Unchanged

- Revenue Dashboard pages and domain-specific Revenue table/card UI.
- Dashboard APIs and all API response contracts.
- Database, migrations, Queue, Workers, OpenAI, and commerce write operations.

## Fixed

- Kept API route modules loadable when Supabase environment variables are absent.
- Converted internal API transport failures and non-JSON error responses into a
  graceful `No data available` state.
- Sanitized low-level network, `TypeError`, and recommendation-generation errors
  before they can be shown to users.
- Added explicit optional provider variables to `.env.local.example`.
- Preserved successful API responses and the existing UI.
- Stabilized `GET /api/products` by calling the product query service directly
  and returning HTTP 200 with an empty list when Supabase is unconfigured or
  temporarily unavailable.
- Moved the products service and Supabase client behind handler-time dynamic
  imports so route module initialization cannot bypass the HTTP 200 fallback.
- Logged expected Supabase availability fallbacks as warnings so successful
  HTTP 200 fallback responses are not classified as runtime errors.

# Sprint 3 - Revenue Dashboard API

## Added

- Read-only `GET /api/dashboard/revenue`.
- Ranking-backed Product DTO with score, recommendation, confidence, reasons,
  status, and source analysis timestamp.
- Limit/offset pagination and recommendation/status/minimum-score filters.
- Strict HTTP 400 validation and a stable invalid-query error contract.
- Dedicated Query Service and DTO Mapper that hide Ranking internals.
- Response metadata, global rank preservation, and deterministic multi-key
  sorting.
- Deterministic Dashboard API unit and response-contract coverage.
- Preview API health coverage for the new endpoint.

## Unchanged

- Revenue Calculation, Revenue Score, and Revenue Ranking algorithms.
- Database schema, migrations, Runtime Queue, Workers, and Production data.
- Marketplace, pricing, order, inventory, fulfillment, and settlement writes.
- OpenAI and LLM behavior.
# 2026-08-13 — Generic evidence-based Listing Content/Conversion pipeline

- Added generic typed evidence, supplier-trust, title/keyword candidates,
  rights-aware asset manifests, rendered 780px detail packages, registration
  mapping, visual QA, and sequential learning contracts.
- Separated minimum registration blockers from conversion warnings and kept
  content approval distinct from exact live-write approval.
- Added non-product-specific review UI, synthetic non-KK coverage, and KK946
  acceptance fixtures. KK946 remains outside production source constants.
- No schema, persistence, external provider, asset upload, Production, or
  marketplace write was added.
