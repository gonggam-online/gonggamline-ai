# Listing Content Fact and Policy Contract v1 changelog

## 2026-08-12 - KK946 warehouse receipt complete

- Verified Gaemi application `A1296915119go` as inbound complete for
  `PJ1491663`, black, with 6 received, 0 dispatched, and 6 in stock.
- Recorded the provider dimensions `10.5 x 3.6 x 6.5 cm` and last inbound time
  without promoting them to per-unit physical inspection evidence.
- Observed no visible shortage, overage, hold, rejection, or damage signal.
- Kept the distinct inbound-lot binding, six per-unit inspection outcomes,
  weights, material/markings, defects, and image references unknown, so KK946
  remains quarantined until full-inspection evidence is available.
- Performed no warehouse, inventory, fulfillment, listing, or other external
  write; raw provider evidence remains in its source system.

## 2026-08-10 - KK946 inbound and inspection packet

- Authenticated read-only monitoring advanced Domeggook order `OR75260192` to
  verified in transit with CJ Logistics tracking bound to the exact order.
- Kept Gaemi receipt, inbound lot, and inspection evidence unknown; the next
  observation gate is warehouse receipt, not another supplier action.
- Re-observed Gaemi application `A1296915119go` as inbound pending for
  `PJ1491663`, black, six units, without creating an external write.
- Preserved the rule that a public dispatch promise is not order-level evidence;
  only the later authenticated order observation advanced shipment state.
- Added the exact order-to-tracking-to-application-to-lot-to-six-units receipt
  and full-inspection checklist, with conflicts and missing scope failing closed.
- Kept raw labels, invoices, images, personal data, and provider payloads in
  their source systems; no confidential evidence store was invented.

## 2026-08-10 - KK946 authenticated Domeggook precheck

- Replaced per-item supplier inquiry with a default catalog-order path: clear
  catalog terms and explicit image-use permission proceed without inquiry;
  conflicts, regulated evidence gaps, and absent permissions fail closed.
- Verified the black-six checkout total at `8,100 KRW` and the built-in Gaemi
  Warehouse destination helper. Checkout created one cart/draft item; no order,
  payment, message, instruction, or download occurred.
- Verified owner-selected supplier item `56288849` and observed the black
  option, MOQ, price, stock, shipping, tax classification, dispatch, return,
  material, manufacturer, and origin claims in an authenticated read-only view.
- Kept option/SKU code, VAT treatment, tax-invoice path, dimensions, markings,
  physical observations, and complete image rights `UNKNOWN` or incomplete.
- Recorded only a sanitized packet. No raw evidence movement, download,
  supplier contact, cart, order, payment, inspection, warehouse instruction,
  listing, database, configuration, or Production write occurred.

## 2026-08-08 - KK946 evidence acquisition runbook

- Added the exact supplier-item to purchased-SKU to inbound-lot to inspected-
  unit identity chain and authoritative evidence checks.
- Added a machine-readable all-`UNKNOWN` quarantine status so synthetic data
  or guessed identifiers cannot be mistaken for real KK946 evidence.
- Added privacy, cloud-first, stop, sanitized return, recovery, and future
  asset-intake gates. No raw evidence, external action, or write was performed.

## 2026-08-08 - Coupang read-only preflight evidence implementation

- Implemented fixed GET-only category, outbound-location, and bounded
  return-center evidence readers using the existing Coupang transport.
- Added strict sanitized DTOs, canonical fingerprints, opaque vendor
  references, explicit failure taxonomy, and synthetic privacy/negative tests.
- Added a pure KK946 mapper that conservatively uses the oldest logistics
  observation for the existing Marketplace preflight.
- No route invokes these adapters. Live calls, configuration, persistence,
  Production, Product Creation, price, stock, and writes remain excluded.

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
# 2026-08-08 — Marketplace Product Creation preflight

- Added a strict, immutable Marketplace Product Creation intent distinct from the existing Listing marketing draft.
- Added a pure zero-network preflight with deterministic intent and evidence fingerprints.
- Added fail-closed gates for unsupported variants, approval requests, category/vendor evidence, required metadata decisions, real assets, placeholders, and SKU/option uniqueness.
- `READY` means local contract readiness only; Coupang acceptance, Production, pricing, database, and marketplace writes remain excluded.
# 2026-08-08 — Marketplace Product Creation preflight

- Added a strict, immutable Marketplace Product Creation intent distinct from the existing Listing marketing draft.
- Added a pure zero-network preflight with deterministic intent and evidence fingerprints.
- Added fail-closed gates for unsupported variants, approval requests, category/vendor evidence, required metadata decisions, real assets, placeholders, and SKU/option uniqueness.
- `READY` means local contract readiness only; Coupang acceptance, Production, pricing, database, and marketplace writes remain excluded.

# 2026-08-08 — Proposed Coupang read-only preflight evidence architecture

- Defined the bounded server-only category, outbound, and return evidence GET boundary needed by the merged Marketplace preflight.
- Defined minimal sanitized evidence, seven-day freshness, canonical fingerprints, bounded pagination, failure taxonomy, and a pure KK946 mapper.
- Excluded raw-response retention, public API, new configuration, persistence, live calls, Product Creation, approval, pricing, and all commerce writes.
- Implementation remains stopped pending repository-owner Architecture acceptance.
