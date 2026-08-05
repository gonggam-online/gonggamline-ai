# Listing Content Fact and Policy Contract v1 changelog

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
