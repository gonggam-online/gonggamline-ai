# Multi-Supplier Sourcing and Quote Comparison v1

## Status

Approved read-only candidate-discovery slice implemented on 2026-08-27. The
implementation uses one bounded, cost-capped DataForSEO Google result request
to find public product pages on the approved supplier-domain allowlist. It does
not scrape supplier sites, reuse a login session, persist a quote, or perform a
purchase write. Verified quote comparison and every procurement action retain
the separate gates defined below.

Implementation contract:

- version: `gonggamline-public-supplier-candidate-discovery-v1`;
- Engine 1 and Engine 2 pass the selected product name through
  `/sourcing?keyword=...`;
- Engine 3 auto-runs only for that explicit handoff and caches the result in
  the browser for 30 minutes to avoid repeated paid requests;
- approved public domains: Dometopia, Domeggook, Ownerclan, Onchannel, and
  EZmarket B2B;
- results retain the original supplier product URL, public price/stock hints,
  identity score, missing fields, and supplier priority;
- HTTP, credential, allowlist, cost-ceiling, malformed-response, and empty
  result states fail closed without inventing an offer;
- no migration, supplier-site credential, order, inventory, listing, or
  Production commerce write is part of this slice.

## Objective

Extend Item Selection from a Domeggook-centred sourcing path into a two-layer
engine:

1. discover and rank candidates from the whole market; and
2. discover, normalize, and compare legally permitted wholesale offers before
   selecting a preferred source.

Domeggook remains the default and the only automatically executable purchase
   provider in the first rollout. A cheaper or better alternative may be
   recommended only when it has equivalent identity, quantity, condition,
   delivery, rights, and freshness evidence.

## Boundary and preserved behavior

- Market discovery remains source-agnostic and may use approved read-only
  market evidence.
- Supplier discovery is read-only until an operator explicitly selects a
  quote.
- Quote comparison never creates an order, changes price, changes a live
  verdict, registers a listing, or calls Gaemi/Coupang.
- Existing Domeggook -> Gaemi -> Coupang automation remains unchanged.
- Non-Domeggook providers are advisory until a provider-specific contract,
  terms review, credentials, and manual merge are complete.
- Missing, stale, conflicting, or rights-uncleared evidence is visible and
  fail-closed; it is not silently treated as a cheaper offer.

## Source model

The engine should support injected adapters behind one typed port:

```text
SupplierDiscoveryPort
  search(query, boundedOptions) -> SupplierOfferEnvelope[]
  getOffer(identity, boundedOptions) -> SupplierOfferEnvelope
```

Initial source classes:

- `domeggook`: existing read path and the only executable purchase path;
- `manual_verified`: operator-entered supplier evidence with provenance;
- future approved adapters (for example another domestic wholesale provider),
  each with its own terms, quota, secret, retention, and rollback record.

Public marketplace trend APIs are market evidence, not supplier offers and must
never be converted into a supplier quote without a separate supplier source.

## Canonical offer contract

Every offer must carry:

- canonical product identity: normalized title, brand, model/SKU, variant,
  pack quantity, unit, condition, and image/fact digest;
- supplier identity and provider item ID;
- unit price, shipping, handling, tax/VAT treatment, MOQ, tier breaks,
  currency, quote timestamp, expiry, stock and lead time;
- fulfillment assumptions: supplier-to-Gaemi inbound, inspection/storage,
  pick/pack, Coupang fee, advertising, return-loss scenario;
- rights and publication status, source URL/reference, evidence digest,
  confidence, and conflict list.

No offer is comparable unless identity and pack/variant equivalence pass. A
comparable-but-not-identical offer is shown separately and cannot win the
identical-offer lane.

## Comparison algorithm

For each candidate:

1. Generate bounded search queries from title, attributes, model, variant, and
   pack quantity.
2. Collect at most the configured provider/result/cost limits.
3. Normalize all prices to KRW and one selling unit.
4. Calculate landed cost = supplier unit cost + supplier shipping/allocation +
   known inbound/fulfillment costs + marketplace/advertising/return scenarios.
5. Compare each offer with the Domeggook baseline using identical evidence age
   and unit assumptions.
6. Produce `DOMEGGOOK_BASELINE`, `ALTERNATIVE_BETTER`, `ALTERNATIVE_COMPARABLE`,
   `ALTERNATIVE_INCOMPLETE`, or `NO_VERIFIED_MATCH`.
7. A `ALTERNATIVE_BETTER` result requires a material landed-cost advantage or
   a documented service advantage (MOQ, lead time, stock, or reliability)
   without degrading any mandatory identity/rights/evidence gate.
8. Preserve all losing offers and reason codes for audit and re-evaluation.

The output is advisory (`RESEARCH`, `QUOTE_REVIEW`, or `DOMEGGOOK_EXECUTION
ELIGIBLE`). It does not replace the existing operational evaluator.

## Approval and failure handling

- Provider terms/robots, account permission, API quota, cost ceiling, secret
  location, data retention, and managed execution boundary require owner
  approval per provider.
- 403/429, malformed payloads, missing credentials, quote expiry, identity
  conflicts, rights uncertainty, and cost ceiling breaches fail closed.
- No scraping bypass, login automation, CAPTCHA circumvention, or public asset
  reuse is allowed.
- A provider outage leaves the Domeggook baseline and previously verified
  quotes intact; it never causes an automatic source switch.
- The only automatic procurement action remains the existing Domeggook flow.

## Durable state and recovery

Immutable search runs, normalized offers, evidence digests, comparison output,
and approvals belong in the existing approved managed operational boundary
(Supabase/GitHub evidence according to data class). No local file, browser
session, or chat transcript is authoritative. Retention, deletion, encryption,
RLS, and recovery must be specified in the implementation Story before any
migration or persistence change.

## Rollout slices

1. Pure contract and comparator using sanitized fixtures only.
2. Read-only Domeggook adapter conformance to the provider-neutral contract.
3. Manual verified-offer import and comparison UI (no supplier write).
4. One additional approved read-only supplier adapter at a time.
5. Shadow comparison against the existing Domeggook baseline.
6. Separate owner-approved decision integration, if calibration proves value.
7. Any non-Domeggook ordering remains a separate high-risk Story and is not
   included in this proposal.

## Acceptance criteria for implementation approval

- 30+ sanitized candidate/offer fixtures covering identical, comparable,
  conflict, stale, MOQ, shipping, and missing-rights cases;
- deterministic landed-cost and better-than-baseline tests;
- no operational verdict, order, listing, price, DB, or Production mutation in
  the first implementation PR;
- provider-specific terms, cost, Secret, and recovery checklist approved;
- exact manual-merge label and rollback documented for every external adapter;
- measured Shadow lift versus Domeggook-only baseline before any live decision
  change is considered.

## Owner decisions required

Approve this Architecture Story and separately provide, for each desired
provider: exact provider/account, permitted API or read method, terms/robots
review, monthly and per-request cost ceiling, Secret store/environment, data
retention, managed execution boundary, and whether only read-only discovery is
authorized. No credentials or secret values belong in Git or chat.
