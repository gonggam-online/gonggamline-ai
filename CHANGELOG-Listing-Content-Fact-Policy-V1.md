# Listing Content Fact and Policy Contract v1 changelog

## 2026-08-08 — Category snapshot evidence bridge

- Added a pure bridge that turns a validated, fresh Coupang category snapshot
  into exactly one catalog-item-scoped `coupangCategoryContract` evidence fact.
- Rechecks identity, digest, notice-selection, ordering, and seven-day freshness
  at the integration boundary and fails closed without partial evidence.
- Kept attributes, certifications, documents, and notice items as category
  requirements rather than unsupported product facts.
- Added deterministic and negative integration tests; no live request,
  persistence, configuration, Production, or commerce write was added.

## 2026-08-08 — Typed category snapshot implementation

- Added bounded Coupang category metadata contracts and canonical response
  digests.
- Added a fail-closed Listing mapper requiring separate category validity,
  freshness, known enums, and explicit notice-category selection.
- Added the read-only category-validity adapter and offline fixtures/tests.
- Preserved the legacy API response and excluded live calls, persistence,
  configuration, pricing, and marketplace writes.

## 2026-08-05 — Evidence fixture and policy kernel

- Added immutable evidence/status contracts and a pure, fact-specific
  authority/scope/freshness/conflict evaluator.
- Added fail-closed `UNKNOWN` quarantine and UTF-8/NFC/mojibake checks.
- Added deterministic, explicitly synthetic KK946-shaped fixtures and negative
  tests. No real KK946 fact, database/API, external integration, asset, price,
  Production, or marketplace behavior was added.

## 2026-08-05 — Architecture proposal

- Audited the existing Listing engine, service, domain types,
  `listing_drafts` schema, Supplier Catalog boundary, registration payload, and
  prioritized backlog without duplicating implementation.
- Recorded the broken Korean encoding, simple keyword/title joining, absent
  image generation, outline-only detail page, and generated/registration
  payload mismatch.
- Defined fact-specific supplier catalog and 3PL physical-evidence priority,
  `UNKNOWN`/conflict quarantine, image use/edit-rights gates, no-exaggeration
  policy, and an exact versioned Coupang category contract.
- Kept KK946 quarantined because no admissible product evidence exists in the
  repository.
- Added an ordered, separately risk-classified implementation and test plan.
  No runtime, database, API, external, paid, Production, or commerce action was
  performed.

## 2026-08-05 — Owner review corrections

- Replaced global source priority with fact-, scope-, and time-specific
  authority: actual transaction terms come from accepted transaction evidence,
  while 3PL inspection observations remain limited to the identified sample,
  unit, or lot.
- Expanded image clearance to grantor authority, exact asset digest,
  Coupang/CDN processing, territory/term/revocation, privacy, trademark/trade
  dress, and generative/editing provenance.
- Reused the existing Coupang category metadata integration and separated its
  supported metadata fields from independently versioned marketplace content
  policies.
- Reordered work around immediate KK946 identity/evidence acquisition, a pure
  fail-closed policy kernel, current-route compatibility audit, rights-cleared
  asset intake, and only then generation/persistence/payload work.
- Repository owner accepted the corrected Architecture content at
  `5b77af8baf39a769e8541b14fe52196b27fcde4f`; this acceptance does not authorize
  a KK946 readiness decision or live marketplace action.
