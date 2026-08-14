# Listing Content/Conversion owner amendment v1

> Rights interpretation is further amended by
> [External Commerce Asset Discovery and Rights Policy v1.1](EXTERNAL-COMMERCE-ASSET-DISCOVERY-AND-RIGHTS-POLICY-V1.1.md): broad lawful discovery is allowed, while public availability alone never grants publication or derivative rights.
> Batch continuity follows [Asset Error Isolation and Pipeline Continuity Policy v1](ASSET-ERROR-ISOLATION-AND-PIPELINE-CONTINUITY-POLICY-V1.md); `RIGHTS_BLOCKED`, conflicts, and access denial remain excluded even when other assets continue.

## Decision

- Status: owner-approved scope amendment on 2026-08-13.
- Owner: Listing domain; Seller remains the only live-write owner.
- Revenue gate: produce the smallest lawful, rights-cleared registration packet
  now, while treating conversion quality and post-sale learning as a separate
  optimization axis.
- Risk: high-risk/manual because the resulting offline mapper guards content,
  price, inventory, delivery, and marketplace readiness. This decision does not
  authorize a live listing, database/configuration/secret change, paid provider,
  or Production write.

This amendment supersedes the earlier interpretation that every incomplete
provenance detail or missing image edit right quarantines the entire listing.
The original evidence-first, exact-category, no-invention, and live-write
approval boundaries remain binding.

## Minimum registration gate

`REGISTRATION_BLOCKED` is limited to:

1. a genuinely required current law/exact-Coupang-category field is absent;
2. unresolved SKU/option/quantity/color/components conflict affects purchase;
3. the selected payload uses a prohibited/unlicensed asset or trademark, or an
   unsupported/false/exaggerated claim;
4. category/schema/payload validation fails; or
5. the separately required live commerce-write approval is absent.

Freshness, provenance granularity, optional imagery, missing edit rights when
unchanged use is allowed, limited samples, and cold-start optimization coverage
are `WARNING` or `OPTIMIZATION_PENDING`. No warning may be converted into an
invented legal/category fact.

The typed implementation emits exactly one of these five `blockerClass`
values: `REQUIRED_FIELD_MISSING`, `CORE_FACT_CONFLICT`,
`PROHIBITED_PAYLOAD_CONTENT`, `PAYLOAD_VALIDATION_FAILED`, or
`LIVE_WRITE_APPROVAL_MISSING`. A packet with no blocker is
`REGISTRATION_READY` even when conversion warnings remain. Its conversion axis
stays `COLD_START` until seller actual metrics justify a stronger state.

## Supplier trust and image-rights amendment

An `ApprovedSupplierTrustProfile` is a versioned allowlist/capability decision.
Allowed public/account facts receive deterministic provenance and are admitted
without repeated human proof. Profile revocation or capability reduction
forces reevaluation. A verified right to reuse an original image permits
`transformation=NONE`; it never implies crop, background removal, overlay,
composite, or generative-reference rights. Unsupported derivatives are omitted
as `DERIVATIVE_UNAVAILABLE`, while the unchanged source remains eligible.
Rights-unknown public material remains `PUBLIC_REFERENCE_ONLY`; its discovery
does not block unrelated conversion research or an otherwise valid listing
that excludes it.

## Conversion objective and evidence hierarchy

The objective is qualified purchase conversion plus actual attributable profit,
while minimizing cancellation, return/refund, customer misunderstanding, and
policy violations. CTR/CVR alone never declares a winner. Evidence priority is:

1. current official Coupang registration/search/option/image/detail/category;
2. fresh aggregate observations of public same-category listings, without
   copying text or images;
3. trustworthy commerce UX research;
4. GonggamLine actual impressions, clicks, orders, cancellations, returns,
   refunds, settlement, and attributable profit for the exact content revision.

Parallel duplicate listings are prohibited unless Coupang explicitly supports
and approves the experiment. The current contract permits only separately
approved sequential/time-split revisions with rollback.

## Reviewed policy sources

Observed on 2026-08-13. These are cold-start priors and policy inputs, not proof
that any tactic improves GonggamLine profit.

| Source | Applied facts | Limitation |
|---|---|---|
| [Coupang Marketplace Seller Academy listing guide](https://marketplace.coupang.com/mba/listing) | correct category/options; main image; up to 9 additional images; min 500px and recommended 1000x1000; JPG/PNG <=10MB; detail preview; brand/filter search contribution | Marketplace guidance can change; exact WING/category metadata wins |
| [Coupang Marketplace registration guide](https://marketplace.coupang.com/register?rf=MARKETPLACE) | end-to-end WING field order, legal notices, preview, search filters | descriptive public guide, not an API acceptance response |
| [Coupang Developer search-keyword FAQ](https://developers.coupang.com/ko/faq/what-are-the-rules-for-search-keywords-for-product-listing) | max 20 keywords, max 20 characters each, stated allowed punctuation | FAQ observed 2026-08-13; exact current provider validation still wins |
| [Coupang Marketplace search guide](https://marketplace.coupang.com/information-center/blog-news6?rf=MARKETPLACE) | relevant terms, deduplication, no redundant combinations | optimization guidance, not measured GonggamLine conversion evidence |
| [Coupang Marketplace growth material](https://marketplace.coupang.com/mba-onepage) | well-organized detail content can reduce abandonment and support conversion | promotional guidance; no guaranteed effect size |
| [Google Merchant product-data tips](https://support.google.com/merchants/answer/7380908?hl=en) | customer journey, important title details first, accurate matching data, high-quality professional images without promotional text | Google ecosystem research/guidance, not Coupang policy |
| [Baymard PDP image/text research](https://baymard.com/blog/product-images-descriptive-text) | images drive initial exploration; scale/context/features plus skimmable explanatory text support evaluation | cross-site UX research; no product-specific profit guarantee |

## Durable state and recovery

Source, contract, synthetic fixtures, owner decision, PR, and CI evidence belong
in GitHub. Operational evidence/assets/approvals require an approved managed
boundary; legacy `listing_drafts` is not that boundary. The append-only learning
contract is type-only in this Story. Persistence requires a separate
Database/Auth/RLS Architecture and manual PR. Local build/browser outputs are
disposable.

## Rollback

Revert this implementation before any live use. A later approved packet must be
re-evaluated whenever its supplier trust profile, rights, category, policy,
asset digest, selected variant, or commerce fields change.

## Typed implementation map

- Policy sources and official limits:
  `engines/listing/marketplace-policy.ts` and
  `MarketplacePolicySnapshot` in `shared/domain/listing-content.ts`.
- Trust admission and capability-change reevaluation:
  `engines/listing/supplier-trust.ts` and
  `engines/listing/approved-supplier-profiles.ts`.
- Generic candidate rankers, rights-aware render, visual QA, selected-variant
  mapper and five-class gate: `engines/listing/content-pipeline.ts`.
- Append-only metrics and guardrails: `shared/domain/listing-learning.ts` and
  `engines/listing/learning.ts`.
- Operator presentation: `components/listing/listing-content-review.tsx` and
  `/listing/review`. The route intentionally does not persist or load business
  packets until the separate Database/Auth/RLS Story is approved.
- Acceptance evidence: `tests/listing-content-pipeline.test.ts`,
  `tests/listing-supplier-trust-and-learning.test.ts`, and
  `tests/kk946-listing-content-acceptance.test.ts`.
