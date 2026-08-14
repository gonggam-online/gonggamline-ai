# Listing Creative Optimization Pipeline v1

## Status and business outcome

- Status: accepted by repository-owner manual merge of PR #127 on 2026-08-14;
  merge commit `b463028a9d79ca44a863475c2ad8df99bb37f53a`.
- Authorization remains limited to ordered implementation steps 1-4. The merge
  does not authorize real provider calls, paid/secret/configuration, managed
  asset storage, Database/Auth/RLS, Production, or marketplace writes.
- Scope: a product-agnostic default pipeline for every selected and procurement-
  approved product. KK946 is an external adapter/acceptance case only and no
  product identifier, fact, price, category, keyword, URL, or asset belongs in
  the production path.
- Outcome: produce the smallest registration-fit content packet first, then
  create and compare conversion candidates that maximize qualified purchase
  conversion and actual attributable profit while constraining cancellation,
  return/refund, customer misunderstanding, and policy violations.
- This Story does not authorize a provider call, paid use, secret/configuration
  change, web-image download, database/RLS/Auth migration, Production write, or
  marketplace write.

## Root-cause order

1. External configuration: there is no approved image/video provider, model and
   terms snapshot, paid-usage cap, secret boundary, or managed binary-asset
   store/CDN.
2. Database: `legacy listing_drafts` cannot durably represent immutable asset
   rights, creative revisions, digest-bound approvals, or append-only learning.
3. Code: the current v2 path validates caller-supplied asset metadata and emits
   shot-name briefs. It does not acquire bytes, edit or generate images, render
   video, compute binary QA, bind a selected creative set, or persist assets.

Code must not compensate for the first two classes or report a prompt, outline,
fixture, or caller-supplied PASS flag as a rendered production asset.

## Owner request and enforceable rights boundary

The requested rule, “a publicly visible image is editable unless the owner
expressly prohibits it,” cannot be encoded as a permission. Public availability
does not establish a licence, and an internal owner decision cannot grant a
third party's reproduction or derivative-work rights. The maximum automated
admission policy is therefore evidence based:

- own photography and commissioned work with the necessary grant;
- an approved supplier capability that expressly covers the operation;
- public-domain material whose status is verified;
- a verified open or commercial licence covering channel, commercial use,
  redistribution, transformation, and provider upload as applicable; or
- an independently generated original that uses only admitted facts and no
  third-party image reference, after provider terms and product-accuracy QA.

An approved supplier's expressly permitted original image may be used unchanged
without repeat manual proof. `useRights=VERIFIED` with `editRights=UNKNOWN`
never blocks that unchanged minimum packet. It excludes only crop, resample,
background removal, overlay, composite, provider upload, generative reference,
or another derived file as `DERIVATIVE_UNAVAILABLE`.

Competitor and arbitrary web images are observation-only. The pipeline may
record a URL, observation date, shot taxonomy, layout pattern, and non-
expressive aggregate signal. It must not store their pixels, copy text or
creative expression, place them in a payload, edit them, or upload them to a
generation provider. “Same product” does not change this rule.

## Rights capability contract

Every source asset carries a source class, content digest, licensor and evidence
snapshot plus a decision for each operation:

```ts
type CreativeSourceClass =
  | "APPROVED_SUPPLIER"
  | "OWN_PHOTOGRAPHY"
  | "COMMISSIONED"
  | "OPEN_LICENSE"
  | "PUBLIC_DOMAIN"
  | "MARKET_OBSERVATION"
  | "GENERATED_ORIGINAL";

type RightsDecision = "VERIFIED" | "DENIED" | "UNKNOWN";

interface AssetRightsCapabilities {
  commercialUnchangedUse: RightsDecision;
  marketplaceRedistribution: RightsDecision;
  technicalReencode: RightsDecision;
  resizeResample: RightsDecision;
  crop: RightsDecision;
  backgroundRemoval: RightsDecision;
  textOverlay: RightsDecision;
  composite: RightsDecision;
  providerUpload: RightsDecision;
  generativeReference: RightsDecision;
  syntheticOutputCommercialUse: RightsDecision;
}
```

Each `VERIFIED` decision identifies the granting party, original URL/reference,
snapshot version and digest, account entitlement if relevant, channel,
commercial purpose, allowed operations, provider disclosure/training terms,
territory, expiry, revocation, attribution, and model/property releases.
Capability expiry, withdrawal, narrowing, supplier-profile changes, or an input
digest change invalidates every dependent asset, candidate, approval, and
registration packet for reevaluation.

`OWNER_RISK_ACCEPTED` may label a quarantined internal review only. It never
becomes a permission and cannot enter a live payload.

## Default optimization decision

The generic pipeline runs after evidence admission and exact category/policy
snapshot validation:

1. If the minimum payload passes and the admitted originals also meet the
   creative baseline, assign the best originals by `MAIN`, `ADDITIONAL`, and
   `DETAIL` role and generate candidate ordering variants.
2. If the minimum payload passes but the creative baseline is weak (for example,
   a main image below the 1000x1000 optimization target, missing scale/context,
   or an unscannable detail), set `CREATIVE_OPTIMIZATION_REQUIRED`.
3. Use a rights-cleared transform only when that exact operation is verified.
4. Otherwise prefer own/commissioned photography, then fact-only independent
   generation with no third-party reference and full commercial/provider terms.
5. If neither exists, keep an eligible unchanged minimum packet and emit
   `CREATIVE_SOURCE_PENDING` or `DERIVATIVE_UNAVAILABLE`; never fabricate
   successful output.

The current Coupang guidance conflict is modeled deliberately: below 500px is a
platform validation failure, while 500-999px is a conversion warning unless the
exact current WING/category response is stricter. A mechanical upscale is not
new detail and cannot be called a high-resolution optimization.

## Candidate, renderer, and channel contract

The planner produces at least two independently reviewable creative candidate
sets. Each set binds:

- one `MAIN` image, zero to nine `ADDITIONAL` images, and a rendered mobile
  `DETAIL` package;
- an optional 9:16 short-video storyboard, poster, captions, duration, codecs,
  audio/model/property rights, and target channel;
- title and keyword/filter candidate identifiers, evidence facts, rationale,
  cold-start confidence, policy/research snapshot versions, asset digests,
  render recipe, provider/model/terms version, and rollback revision.

The shot taxonomy includes product-only, alternate angle, scale, use context,
capacity/storage, included components, feature detail, and limitation/constraint.
Shots may be omitted when facts or rights are absent; the renderer must not
invent color, dimensions, material, quantity, components, compatibility, or
use outcomes. Video remains an optional channel asset and cannot enter Coupang
until the exact category/WING policy snapshot proves support.

The pure engine emits immutable render jobs. A real provider adapter may execute
them only after separate approval records model and terms, paid cap, server-only
secret, idempotency key, admitted input digests, output ownership, metadata, and
the managed object-store destination. CI uses deterministic synthetic fixtures
and a fake provider; fake output can never be marked deployable.

## Computed QA and mapping

QA is calculated from the actual artifact, not accepted from the caller:

- byte digest, decoded MIME, dimensions, file size, load/decode, aspect ratio,
  crop/clipping, blur/detail, duplicate/perceptual similarity, and encoding;
- main-image background, single sale unit, product occupancy, prohibited text,
  watermark/logo/border, variant color, quantity, and included components;
- mobile width, overflow, contrast/readability, asset load, alt text, content
  order, count/color/material/component/dimension consistency, and unsupported
  claim scanning;
- video duration, aspect, codec, poster, captions, audio/model/property rights,
  factual continuity, and channel support.

Rights/factual/platform failure blocks only when the selected payload uses the
failing content. Missing optional shots, video, samples, or edit rights remain
`WARNING`, `OPTIMIZATION_PENDING`, or `DERIVATIVE_UNAVAILABLE` when an unchanged
registration-fit packet exists.

Content approval binds the evidence, exact category/policy snapshots, selected
title/keyword and creative-set identifiers, every asset/detail/video digest,
render recipe, and revision. Live-write approval remains separate. The mapper
accepts exactly one approved candidate and cannot merge candidate assets or
cast `legacy listing_drafts` to registration-ready.

## Review, learning, and durable state

The review UI shows registration readiness separately from conversion
readiness, with blockers, warnings, optimization gaps, rights capability and
licence evidence, actual previews, candidate comparison, source/policy versions,
computed QA, approval-bound digests, and learning/rollback plan.

Learning is append-only by immutable content revision: impressions, clicks,
orders, cancellations, returns/refunds, settlement, and attributable profit.
No winner is declared from CTR/CVR alone. Traffic sufficiency plus profit,
return, cancellation, compliance, and customer-misunderstanding guardrails are
required. Without explicit platform support, parallel duplicate listings are
forbidden; a sequential/time-split revision needs separate approval and rollback.

Durable source code, contracts, synthetic fixtures, PR, and CI evidence belong
in GitHub. Operational asset bytes and manifests need an approved private managed
object store/CDN with encryption, least privilege, retention, revocation,
versioning, integrity checks, backup, and restore evidence. Revisions, approvals,
rights dependencies, and learning need a separately approved Database/Auth/RLS
Story. Local files, browser downloads, and build output are temporary only.

## Reviewed sources (observed 2026-08-14)

- [Coupang Seller Academy listing guide](https://marketplace.coupang.com/mba/listing):
  image roles, 500px minimum/1000x1000 recommendation, up to nine additional
  images, detail preview. Exact WING/category validation remains authoritative.
- [Coupang intellectual-property seller guideline](https://marketplace.coupang.com/information-center/blog-news9):
  another seller's photographed image copied without permission is an
  infringement example. It does not decide an individual licence.
- [Coupang intellectual-property policy](https://marketplace.coupang.com/information-center/coupang-intellectual-property-policy):
  seller responsibility and evidence boundary; it is not a licence registry.
- [Korean Copyright Act, Articles 16 and 22](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033063597)
  and [Article 46](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033063209):
  reproduction/derivative rights and use within granted method and conditions.
- [Domeggook/Domeme image-use guidance](https://help.domeggook.com/ko/articles/%EB%8F%84%EB%A7%A4%EB%A7%A4-%EC%83%81%ED%92%88-%EB%93%B1%EB%A1%9D%ED%95%98%EB%A0%A4%EA%B3%A0-%ED%95%98%EB%8A%94%EB%8D%B0-%EC%A1%B0%EC%8B%AC%ED%95%A0%EA%B2%8C-%EC%9E%88%EB%82%98%EC%9A%94-a3f041aa):
  supplier detail-image reuse is capability-controlled; it does not prove edits.
- [Google Merchant product-data tips](https://support.google.com/merchants/answer/7380908?hl=en)
  and [image specification](https://support.google.com/merchants/answer/6324350?hl=en):
  journey-based data, front-loaded facts, accurate high-resolution imagery,
  clean framing, no naive upscale/promotion overlay. These are conversion priors,
  not Coupang policy or a third-party licence.
- [Baymard product image/text research](https://baymard.com/blog/product-images-descriptive-text),
  [scale research](https://baymard.com/blog/in-scale-product-images), and
  [video placement research](https://baymard.com/blog/embedding-product-page-videos):
  image-first exploration, scale/context, scannable explanation, and video as a
  complement. These are UX priors, not product-specific causal performance.

## Ordered implementation and approval gates

1. Pure v3 rights, creative-set, provider-job, artifact, QA, and approval types.
2. Generic candidate planner and rights invalidation policy with non-KK fixtures.
3. Deterministic fixture renderer and computed QA; selected-set-only mapper.
4. Review UI with actual fixture previews and digest-bound content approval.
5. Managed object-storage/CDN Architecture Story and implementation PR
   (high-risk/manual).
6. Real provider/model/paid/secret Architecture Story and adapter PR
   (high-risk/manual).
7. Database/Auth/RLS immutable persistence and learning PR
   (high-risk/manual).
8. Product adapter packet and acceptance run; KK946 remains fixture-only.
9. Separately approved live marketplace registration (high-risk/manual).

Architecture acceptance permits only steps 1-4. Steps 5-9 retain their stated
approval boundaries. Each PR must run diff review, lint, typecheck, unit and
negative tests, build, browser/visual checks, exact-head CI/Preview, and applicable
post-merge Production smoke. Rollback is Git revert before runtime adoption;
asset/provider/storage rollback is defined in its later Architecture Story.

## Acceptance tests for this Story

- production source contains no KK946-specific value;
- `UNKNOWN` never becomes an operation permission and observation pixels never
  enter an artifact or provider input;
- verified unchanged supplier use survives unknown edit rights;
- operation-specific grants admit only the exact transformation;
- at least two creative sets are planned and only the approved set maps;
- fake/prompt/outline/caller PASS metadata is never deployable output;
- rights, fact, category, asset, or policy changes invalidate dependent approval;
- missing optional optimization remains distinct from selected-payload blockers;
- shorts remain optional until exact channel support is proven; and
- legacy drafts cannot bypass the typed approved packet.
