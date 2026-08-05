# Coupang Seller Product Contract Audit v1

- Date: 2026-08-05
- Status: audit complete; implementation not authorized
- Scope: repository and official Coupang documentation, read-only
- Target rehearsal: KK946 preflight/dry-run only
- Risk: normal-risk documentation; every later marketplace write remains high-risk/manual

## Decision summary

KK946 is **not ready for a meaningful product-registration dry-run**. Current
`validate` mode performs only a small local shape check and never asks Coupang
to validate the request. It can return `ok: true` for a payload that violates
the selected category metadata and that Coupang will reject.

The shortest safe revenue path is one contract owner and a category-metadata-
bound preflight for Marketplace fulfillment before any real registration.
Rocket Growth must remain a separate contract variant. Reusing the current flat
Marketplace DTO for Rocket Growth or Hybrid registration is not contract-safe.

No Wing/API login, key issue, API call, product creation, external write,
secret/configuration change, or Production action was performed.

## Official sources and evidence boundary

Only official Coupang documentation was used:

1. [Product Creation](https://developers.coupang.com/en/api/products/product-creation)
2. [Category Metadata Query](https://developers.coupang.com/en/api/categories/category-metadata-query)
3. [Rocket Growth and Hybrid Product Creation](https://developers.coupang.com/en/api/rocket-growth/product-creation-rocket-growth-rocket-growthmarketplace-hybrid-products)
4. [Product Query](https://developers.coupang.com/en/api/products/querying-product)
5. [OpenAPI Key issuance](https://developers.coupangcorp.com/hc/ko/articles/20288952179993-OpenAPI-Key-%EB%B0%9C%EA%B8%89%EB%B0%9B%EA%B8%B0)
6. [Official Product Listing Guide v1.3](https://developers.coupangcorp.com/hc/ko/article_attachments/360054636091)

Official pages are mutable. Implementation must capture `observedAt`, source
URL, selected `displayCategoryCode`, and a digest of normalized metadata used
for each preflight.

## Audited repository flow

```text
procurement order
  -> engines/listing/index.ts (internal marketing draft)
  -> listing_drafts.coupang_payload (untyped JSON)
  -> services/coupang-seller.service.ts (same local validator)
  -> app/api/coupang/register/route.ts
       validate mode -> local validator only, returns payload
       live mode     -> POST seller-products, then records result
```

Audited: `app/api/coupang/register`, `lib/coupang/*`, `types/coupang.ts`,
category/product routes, seller jobs, Listing service/generator/domain, the
registration workbench, and migrations 012/014.

## Official contract baseline

### General Marketplace product

`POST /v2/providers/seller_api/apis/api/v1/marketplace/seller-products` combines
vendor and Wing-user identity; sale period and names; display category and its
metadata; delivery/outbound/return data; items with price/inventory, option
attributes, images, notices, content, certification and conditional barcode/
condition fields; and category-required documents.

`requested: false` saves without requesting sales approval. `requested: true`
saves and requests approval. Neither is a read-only validation call. The
official contract documents no product-creation validation-only endpoint.

### Category metadata is binding

Metadata owns allowed/required purchase and search attributes, data types,
units, values and exposure; notice category/detail rows; certifications and
code requirements; required documents; single-item allowance; and Rocket
Growth expiration requirements. Non-empty arrays do not prove compliance.

### Images, options, shipping and returns

Each item needs metadata-compliant attributes. Exposed option tuples cannot all
duplicate. Images need valid order/type and a usable `vendorPath` or `cdnPath`;
vendor URLs have documented port and length limits. Placeholder assets are
incomplete evidence.

Shipping/return codes come from Coupang logistics APIs or Wing. Free-text
placeholders do not prove vendor ownership or delivery compatibility. Preflight
must consume timestamped read-only lookup evidence and must not create or
modify a location.

### Rocket Growth and Hybrid

The same endpoint uses a different schema. Wing consent for the Rocket Growth
creation API is required. Items use `rocketGrowthItemData`; Marketplace data
uses `marketplaceItemData`. Rocket-only may omit Marketplace shipping/return,
while Hybrid requires `marketplaceShippingAndReturnInfo`.

If `skuInfo` is supplied, it must be complete and includes authoritative
physical/logistics data. It also requires an inbound name. Rocket creation
requires `rocketGrowthAdditionalInformation.legalAgreement = "AGREE"`.
Logistics fields can become immutable after inbound, so inferred values are
prohibited. Current `businessTypes=rocketGrowth` is only a list filter and does
not make the flat creation payload Rocket-compatible.

## Contract gap matrix

| Area | Repository state | Gap / consequence | KK946 gate |
|---|---|---|---|
| Contract owner | Partial type plus arbitrary keys | Generator/UI/route silently diverge | Strict Marketplace and Rocket/Hybrid discriminated DTOs; unknown-key rejection |
| Generator | Marketing draft with `categoryName`, `keywords`, `options`, top-level `salePrice` | Not a Product Creation request but stored as `coupang_payload` | Keep as internal draft; explicit evidence-bound mapper |
| Validator | Strings, dates, three numbers, non-empty arrays | Accepts enums/placeholders/metadata mismatches and omitted conditional fields | Structured `INCOMPLETE/INVALID/READY` preflight |
| Category metadata | Proxy exists; UI mainly maps attributes with empty defaults | Notices, certification, documents, values/units, single-item and freshness ignored | Evidence envelope; validate all category-bound fields |
| Notices | One generic sample; ignored by validator | Mandatory rows can be absent/mismatched | Exact selected group and mandatory details |
| Certifications | Defaults `NOT_REQUIRED`; ignored | Unsafe for certification-required categories | Allow only when metadata supports it; otherwise evidence/code |
| Required documents | Not modeled | Mandatory documents cannot be represented | Template plus one valid CDN/vendor path |
| Images/content | Array presence only | Placeholder, type/order/URL/length/content failures pass | Representation image, unique order, valid type/path, non-placeholder content |
| Options | Any non-empty attributes pass | Required/value/type/unit/exposure and duplicate tuples unchecked | Normalize metadata; unique exposed tuples and SKUs |
| Item rules | Only prices/count checked | Enums, barcode, stock bounds and conditional rules absent | Validate every selected-mode required/conditional field |
| Shipping/returns | Flat required strings | Codes not verified against vendor lookup evidence | Fresh vendor-scoped evidence for Marketplace; no create in preflight |
| Approval | UI sample uses `requested: true`; validator ignores it | Future call may immediately request approval | First rehearsal intent forces `requested: false`; create remains separately approved write |
| Rocket Growth | No creation DTO; list filter only | Cannot represent Rocket-only or Hybrid schema | Fail closed as `NOT_SUPPORTED` pending separate variant |
| Dry-run | Local checks and vendor ID injection | Misleading; no Coupang acceptance proven | Name `localPreflight`; `externalCallPerformed: false` |
| Identity | HMAC keys, vendor ID, Wing user ID coexist | API credentials and Wing session/user can be conflated | Distinct server credentials, vendor, payload Wing user, browser session; no client secrets |
| Idempotency | Unique draft job; response-derived workflow key | No request fingerprint/submit lease; duplicate POST and unsafe retry possible | Immutable intent/fingerprint, single flight, reconcile before retry |
| Error decoding | Raw response returned/stored; heuristic `data.code` | HTTP/business success conflated; unsafe detail exposure | Decode transport and `code/message/data`; sanitize and classify retryability |
| Lifecycle | Persistence follows external call | DB failure after success creates ambiguous outcome | Reserve before call, atomic finalize, explicit `outcome_unknown` |

## KK946 dry-run acceptance contract

`KK946 dry-run` is a **zero-external-write local preflight**. It must never call
Product Creation, create locations, upload assets, request approval, or claim
Coupang acceptance.

Required inputs:

1. exact variant (`MARKETPLACE` first; Rocket/Hybrid rejected);
2. sanitized immutable KK946 listing revision;
3. `displayCategoryCode` and read-only metadata evidence envelope;
4. read-only vendor-scoped outbound/return evidence;
5. approved real asset references or an explicit incomplete result;
6. notice, certification, document and option decisions with provenance;
7. server-owned vendor reference and distinct Wing user reference; no secrets.

Deterministic output:

```json
{
  "status": "INCOMPLETE | INVALID | READY",
  "externalCallPerformed": false,
  "coupangAcceptanceProven": false,
  "variant": "MARKETPLACE",
  "payloadFingerprint": "sha256:<canonical redacted payload>",
  "evidenceFingerprint": "sha256:<normalized evidence envelope>",
  "issues": [{ "code": "...", "path": "...", "source": "..." }]
}
```

`READY` means only local evidence satisfies the captured contract. The first
separately approved creation payload must use `requested: false`; even that is
a real marketplace write outside this audit.

## Ordered implementation Stories

### Story 1 - Typed contract and pure preflight

- Separate internal Listing draft from strict Product Creation intent.
- Add Marketplace DTO and normalized metadata contract; fail closed for Rocket.
- Validate conditional fields, notices, certifications, documents, assets,
  option/SKU uniqueness, placeholders, and `requested: false` policy.
- Use sanitized official-shape fixtures; no credentials/network/DB.

### Story 2 - Read-only evidence acquisition and KK946 adapter

- Obtain Architecture approval if a new external/read lifecycle or persistence
  contract is introduced.
- Read category metadata and vendor shipping/return lists through typed adapters;
  timestamp and fingerprint normalized evidence.
- Never issue/expose keys, create locations, upload assets, or retain sensitive
  raw responses. Separate external configuration failure from product invalidity.

### Story 3 - Registration idempotency/reconciliation architecture

- High-risk/manual Architecture Story before implementation.
- Define immutable intent, canonical fingerprint, single-flight lease, attempt
  reservation/finalization, ambiguous outcome, retry taxonomy and reconciliation
  by `sellerProductId`/unique `externalVendorSku`.
- Decode provider response and bound sanitized observability/retention.

### Story 4 - Rocket Growth/Hybrid contract

- Separate high-risk/manual track; confirm consent/eligibility without secrets.
- Model Rocket/Marketplace item variants, all-or-nothing `skuInfo`, additional
  information, shipping wrapper, expiration and immutable-after-inbound fields.
- Require authoritative dimensions, weight, barcode and legal agreement.

### Story 5 - First KK946 create/approval experiment

- Separate high-risk/manual owner packet after exact preflight is `READY`.
- Bind exact account, fingerprint, category, price, stock, asset rights,
  fulfillment, loss/stop conditions and observer.
- First create uses `requested: false`; query/reconcile it before a separately
  approved approval request. Do not bundle inventory/price/inbound/ad writes.

## Verification strategy

- Unit/golden: strict decoding and every metadata/conditional failure path.
- Contract: generator output cannot pass directly; unknown keys/variants fail.
- Property: unique tuples/SKUs, image order, bounds, dates and fingerprints.
- Integration: sanitized recorded shapes only; no Coupang call in CI/local.
- Adapter: HMAC fixture, nested response decoding, transport/business outcomes,
  retry classification and ambiguous-outcome transition.
- Security: prove reports/logs exclude keys, Authorization, cookies and sessions.

## Architecture and risk conclusion

This normal-risk audit changes no runtime, schema, RLS/Auth, public API, queue,
external behavior or commerce state. Current runtime must not be used for KK946
live registration. Stories 3-5 cross commerce-write/lifecycle and possibly
persistence/security boundaries and require separate Architecture approval and
high-risk/manual delivery. This audit is evidence, not execution authority.
