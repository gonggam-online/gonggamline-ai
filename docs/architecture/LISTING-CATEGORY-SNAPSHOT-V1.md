# Architecture Story: Listing Category Snapshot v1

## Status and objective

- Status: proposed for repository-owner approval.
- Owner: Listing domain; Coupang adapter supplies provider data only.
- Risk: normal-risk documentation. Later configuration, Production calls, or
  public-contract changes retain separate approval.
- Revenue gate: turn one operator-selected category into a validated,
  reviewable input for a truthful listing packet without submitting a product.

This Story defines a typed, immutable-in-memory category snapshot. It does not
select the category for KK946, call Coupang, persist a snapshot, change an API,
set a price, generate content, or register a listing.

## Existing boundary and compatibility

The existing `GET /api/coupang/categories/meta` route and its `{ ok, result }`
response remain unchanged. The adapter continues to perform one read-only
exact-code request. A new provider mapper validates the response behind that
boundary; the legacy route may consume the mapper only when response
compatibility tests prove its public shape unchanged.

Category validity is a separate read-only provider operation. Metadata success
does not imply that a category is currently valid. The application service must
obtain both results and fail closed if either is absent, malformed, stale, or
inconsistent.

## Contracts

`CoupangCategorySnapshot` contains:

- schema/ruleset version, exact positive `displayCategoryCode`, channel, and
  `observedAt`;
- category-validity status and its independently calculated response digest;
- metadata response digest;
- bounded typed attributes, notice categories/details, required documents,
  certifications, allowed offer conditions, and single-item eligibility;
- operator-selected notice-category name, or `null` until selected;
- stable validation issues and `QUARANTINED | VALIDATED` disposition.

Every collection has explicit maximum counts and string lengths in the
implementation Story. Unknown provider fields are ignored by the mapper but
remain covered by the raw-response digest. Missing required known fields fail
closed. Digests use canonical JSON and SHA-256; they are evidence identifiers,
not authenticity claims.

The snapshot never contains credentials, vendor identity, raw error bodies,
personal data, price, inventory, image bytes, or marketplace-write authority.

## Validation and policy rules

- Accept only positive decimal category codes and an allowlisted channel.
- Validate provider enums explicitly; unknown enum values quarantine.
- Preserve all notice-category choices. Never select the first automatically.
- `NOT_REQUIRED` certification is an available provider option, not proof that
  it applies to the product.
- A required document/certification/attribute remains unresolved until Listing
  evidence satisfies it.
- Category metadata never supplies advertising, keyword, image-rights, or
  prohibited-product policy. Those belong to a separate
  `MarketplacePolicySnapshot`.
- Snapshot expiry is evaluated at review/payload time; stale input cannot be
  promoted to registration-ready.

## Failure, observability, and security

Provider authentication, network, rate-limit, invalid-category, malformed
response, size-limit, digest, and stale-data failures produce sanitized stable
issue codes. Logs contain code, channel, ruleset version, issue counts, and
duration only. Raw provider responses and credentials are never logged.

The pure mapper imports no Next.js, Supabase, filesystem, or HTTP module. The
adapter owns provider translation; Listing owns admission and quarantine.

## Cloud-first state and recovery

Source, fixtures, contracts, decisions, and test evidence belong in GitHub.
CI fixtures are synthetic and sanitized. This Story creates no durable runtime
state. If persistence later becomes necessary, stop for a separate Database /
RLS / retention Architecture Story. Local caches are disposable and must not
hold the only provider response.

## Implementation sequence and acceptance

1. Add bounded provider DTO schemas and negative fixtures.
2. Add a pure canonical mapper and digest function.
3. Add a category-validity adapter contract with mocked tests only.
4. Add the Listing snapshot evaluator and stable issue codes.
5. Prove legacy route response compatibility and sanitized failures.
6. Run lint, typecheck, full tests, build, CI, and exact Preview browser gates.

Acceptance requires malformed/oversized/unknown-enum/stale/conflicting fixtures
to quarantine, deterministic digests, zero external calls in tests, and no
change to listing submission behavior.

## Rollout and rollback

Roll out as unused pure contracts first, then opt the existing read-only service
into validated mapping behind compatibility tests. No live category call is a
release test. Rollback is a Git revert; it changes no database or external
state. Any later Production configuration or provider smoke requires separate
approval.
