# KK946 profitability and Coupang listing facts v1

## Decision

- Target customer price: `11,800 KRW`, free shipping.
- Exact policy recommend threshold: `11,243 KRW`; operational rounded floor:
  `11,300 KRW`.
- A `9,900 KRW` first-sale experiment is economically positive but remains a
  conditional-policy case, not the normal launch price.
- Profitability disposition: `RECOMMEND_ESTIMATED`. The deterministic physical
  costs and WING category fee are confirmed, and the `11,800 KRW` scenario
  passes the approved base and stress gates. Realized profit remains estimated
  until mature advertising/return evidence and the actual fulfillment invoice
  exist.
- This is a read-only decision packet. No price, stock, product, coupon,
  advertisement, fulfillment, address, or marketplace write was performed.

The target prioritizes positive contribution under stress. It is not proof of
demand. The first six units are a bounded demand test, not evidence for a larger
buy.

## Deterministic variable cost per one-unit order

All supplier and warehouse debits are allocated across the six-unit sample.
Gaemi's published rates are VAT-exclusive, while the actual `700 KRW`
unloading and `600 KRW` full-inspection charges were debited as `770 KRW` and
`660 KRW`. Deductible VAT is therefore removed for the profitability basis.

| Cost | Cash/gross basis | Profitability basis | Evidence state |
|---|---:|---:|---|
| supplier item | `850` | `772.73` | paid order, VAT-inclusive |
| supplier delivery allocation | `500` | `454.55` | `3,000 / 6`, VAT-inclusive |
| inbound unloading allocation | `128.33` | `116.67` | `770 / 6`, VAT-inclusive |
| full inspection allocation | `110` | `100` | `660 / 6`, VAT-inclusive |
| current observed storage debit | `0` | `0` | ledger checkpoint only |
| extreme-small outbound delivery | `2,200` | `2,000` | rate-card plan |
| extreme-small outbound work | `660` | `600` | rate-card plan |
| box No. 1 | `231` | `210` | rate-card plan |
| aircap/tape/other material | `110` | `100` | rate-card plan |
| **deterministic total** | **`4,789.33`** | **`4,353.94`** | before percentage costs |

The package plan uses the recorded `10.5 x 3.6 x 6.5 cm` dimensions, Gaemi's
extreme-small tier, box No. 1, and one material allowance. The actual invoice
can differ if Gaemi remeasures, repacks, applies an additional service, or the
shipment occurs after a free-storage period. Future storage and monthly SKU
management costs are not silently allocated into the first-order result.

## Approved-engine scenarios

These results use `gonggamline-profitability-2026-08-12-v2`. The authenticated
WING form showed `10.5% (VAT 별도, 정률)` for the selected category. Coupang
charges the rate on the customer's VAT-inclusive final price; deductible VAT
on the fee means the net fee expense is `final price * 10.5%`. Advertising uses
`12.5%` base and `18%` stress, while the simple-durable return reserve uses
`4%` base and `6%` stress.

| Customer price | Base contribution | Base margin | Stress contribution | Stress margin | Policy result |
|---:|---:|---:|---:|---:|---|
| `9,900` | `2,122` | `23.57%` | `1,447` | `16.07%` | conditional |
| `10,900` | `2,776` | `28.01%` | `2,032` | `20.51%` | conditional |
| `11,200` | `2,972` | `29.19%` | `2,208` | `21.69%` | conditional |
| `11,243` | `3,000` | `29.35%` | `2,233` | `21.85%` | exact recommend threshold |
| `11,300` | `3,037` | `29.57%` | `2,267` | `22.07%` | operational recommend floor |
| **`11,800`** | **`3,364`** | **`31.36%`** | **`2,560`** | **`23.86%`** | **recommend** |

At `11,800 KRW`, the fee's net expense is `1,239 KRW` and its VAT-inclusive
cash charge is `1,362.90 KRW`. Known net costs before advertising and return
reserves are `5,592.94 KRW`; known gross cash outflow is `6,152.23 KRW`.
Advertising and return amounts remain policy estimates. They must not be used to lower the price
or to claim realized profit.

## Listing facts already acquired

| Field | Sanitized value | State and authority |
|---|---|---|
| supplier item | `56288849` | verified Domeggook item |
| model | `KK946` | supplier catalog |
| proposed seller SKU | `KK946-BLACK` | internal proposal; not written |
| product type | pouch | supplier notice |
| material | polyester | supplier notice |
| color | black | ordered option, receipt images, stock record |
| dimensions | `10.5 x 3.6 x 6.5 cm` | Gaemi record, not per-unit measurement |
| manufacturer | `KLAND` | supplier catalog claim |
| country of manufacture | China (OEM) | supplier notice claim |
| quantity available | `6` | Gaemi stock checkpoint |
| tax treatment | taxable | supplier transaction/catalog |
| detail-image use | permitted | supplier item-page permission |
| image editing | unknown | permission not found |
| inspection | full-inspection service completed for six; no exception observed | receipt, charge, and stage evidence |

The warehouse dimension may support the size field, but it does not create
documentary proof for material, origin, trademark, or certification.

## Authenticated WING category read

The read-only Product Registration form was used without saving a product.

- Selected path: `패션의류잡화 > 유니섹스/남녀공용 패션 > 공용 잡화 > 가방 > 남녀공용파우치`.
- Current fee shown: `10.5% (VAT 별도, 정률)`.
- Notice category: `가방`.
- Manual form did not expose the exact `displayCategoryCode`; obtain it through
  the official Category Recommendation/category API or category Excel before
  constructing an API Product Creation payload.
- Image constraints: main/additional images recommended `1000 x 1000`, minimum
  `500 px`, at most `10 MB`, JPG/PNG; detail image recommended `780 x 5000`, at
  most `10 MB`, JPG/PNG.
- Required-document area showed `기타인증서류` as an optional upload control;
  this does not prove a legal certification exemption.

The mandatory notice rows shown for this category are:

1. 종류
2. 소재
3. 색상
4. 크기
5. 제조자(수입자)
6. 제조국
7. 취급시 주의사항
8. 품질보증기준
9. A/S 책임자와 전화번호

The form also requires option/price/stock identifiers, manufacturer and
same-product composition, certification selection, parallel-import state,
purchase-age rule, maximum purchase quantity, sale period, and tax state.
Suggested values and form defaults are UI choices, not documentary evidence.

## Remaining listing blockers

1. WING showed no registered outbound shipping place.
2. WING showed no registered return/exchange place.
3. Seller/importer identity and an A/S responsible party and phone number are
   still missing from the sanitized packet.
4. Handling precautions and quality-warranty language require seller approval.
5. Exact `displayCategoryCode`, current category validity, allowed mandatory
   purchase/search attribute values, and barcode behavior require the official
   read API or category file.
6. Actual unit/package weight and rights-cleared listing-ready main/detail
   images are still required; image editing rights remain unknown.
7. `KLAND` is only a manufacturer claim and must not be treated as verified
   brand/trademark authorization.

In contract terms, the unresolved fields are the mandatory purchase/search attribute
values, certification type, barcode requirement, brand/trademark state,
outbound location, and return center. None may be inferred from a form default
or a similar product.

Therefore listing eligibility remains `HOLD`. The next owner-side action is to
register the outbound and return locations in WING and approve the missing
seller-authored notice facts. Those actions are external writes and were not
performed here. The exact category API read can then close category-bound
metadata without creating a product.

## Source and recovery

- Domeggook item/order: `https://domeggook.com/56288849`.
- Gaemi public rate authority:
  `https://www.gemichango.com/Gemichango_Logistics_cost_chart.pdf`.
- Coupang fee-basis authority:
  `https://marketplace.coupang.com/information-center/almyeon-alsurog-deo-joheun-kupang-susuryo-2`.
- Coupang category/API authority:
  `https://developers.coupangcorp.com/hc/ko/articles/360023110213` and the
  category recommendation/metadata/Product Creation references linked there.
- Raw order, ledger, stock, and image evidence remains in Domeggook and Gaemi;
  no raw authenticated page, personal data, or secret was copied into Git.
- GitHub owns this sanitized packet, machine-readable decision, tests, and
  review history. Rollback is a Git revert; there is no provider rollback
  because no external write was performed.
