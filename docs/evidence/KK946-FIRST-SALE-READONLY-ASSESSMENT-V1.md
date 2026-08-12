# KK946 first-sale read-only assessment v1

## Current decision

- Disposition: `QUARANTINED`.
- Sample order: `COMPLETED` for six black units under order `OR75260192`.
- Warehouse receipt: `COMPLETED` with six received and six in stock.
- Paid warehouse inspection: `VERIFIED_EXECUTED_NO_EXCEPTION_OBSERVED`.
- Physical sale suitability:
  `CONDITIONAL_PASS_FULL_INSPECTION_COMPLETE_NO_EXCEPTION_OBSERVED`.
- Profitability: `REJECT_MARKET_PRICE_UNPROFITABLE` at the confirmed identical
  one-unit delivered market price of `4,290 KRW`.
- Listing eligibility: `HOLD_SINGLE_UNIT_MARKET_PRICE_UNPROFITABLE`.
- Coupang listing and Rocket Growth inbound: `NOT_AUTHORIZED`.
- Risk: high-risk/manual because pricing, listing, inventory and fulfillment are
  commerce decisions. This assessment performs no new external write.

The primary blocker is failed single-unit market economics; missing WING
outbound/return locations and seller-owned notice facts are secondary. The
fee-basis defect found during reconciliation was corrected in policy v2, and
the purchase-order defect is corrected by the fail-closed v3 gate. Raw provider evidence remains
in Domeggook, Gaemi, and Coupang; GitHub owns only sanitized status and review
history.

## Verified supplier, receipt and inspection checkpoint

- Domeggook item `56288849` is bound to model `KK946`, paid order
  `OR75260192`, black option, quantity six, `850 KRW` unit price and
  `3,000 KRW` supplier delivery.
- Supplier claims describe a polyester pouch manufactured by `KLAND` in China
  (OEM). These remain catalog/documentary claims where physical evidence is
  absent.
- Gaemi product `PJ1491663` and application `A1296915119go` show six received,
  zero dispatched and six in stock, with recorded dimensions
  `10.5 x 3.6 x 6.5 cm`.
- The completed receipt, `660 KRW` full-inspection debit, stage-image presence,
  and no visible exception verify service execution for all six units. They do
  not create six itemized condition reports or per-unit measurements.
- Detail-image use is allowed on the supplier page. Editing rights and the
  exact-byte grant scope remain unknown.

## Profitability checkpoint

The six-unit sample has verified cash outflow of `9,530 KRW`: `8,100 KRW`
supplier order, `770 KRW` inbound unloading and `660 KRW` full inspection. The
Gaemi VAT-exclusive rate card and actual debits bind deductible-VAT treatment
and a declared one-unit extreme-small package plan.

The deterministic net-of-deductible-VAT variable cost is `4,353.94 KRW` per
one-unit order under that plan. At the confirmed identical-product delivered
market price of `4,290 KRW`,
`gonggamline-profitability-2026-08-12-v3` reports:

| Scenario | Contribution | Margin |
|---|---:|---:|
| base | `-1,548 KRW` | `-39.69%` |
| stress | `-1,840 KRW` | `-47.19%` |

The engine uses the authenticated WING `10.5%` marketplace fee on the
customer's final price plus policy advertising and return-loss rates. The
result fails the recommendation and pre-purchase gates.
Mature advertising/return evidence, future storage/SKU charges and the actual
fulfillment invoice remain unresolved. The authoritative calculation and
listing-fact inventory is
`KK946-PROFITABILITY-AND-COUPANG-LISTING-FACTS-V1.md`.

## Listing and rights gate

Before listing eligibility can change from `HOLD`:

1. obtain the exact WING display-category code and validity via the official
   read API or category file; the manual form already confirms the path and fee;
2. capture remaining mandatory attributes and allowed values/units;
   certifications, documents and barcode rule from that category;
3. obtain seller-authored handling, warranty, A/S, importer/seller, shipping
   and return facts that the supplier's generic “see details” text cannot fill;
4. bind actual weight and every remaining required product fact without
   promoting catalog claims to physical measurements;
5. use only rights-cleared exact image bytes; do not infer editing rights,
   brand authorization or a certification exemption;
6. register outbound and return locations in WING through a separately approved
   external-write step, without copying sensitive values into Git.

Any `UNKNOWN`, `CONFLICT` or `PROHIBITED` required fact keeps the listing in
quarantine.

## Completed sample and inspection boundary

The separately owner-approved purchase and full-inspection work are complete.
This historical write does not authorize a reorder, return, refund, additional
paid inspection, Product Creation, price, stock, coupon, advertisement,
fulfillment or Rocket Growth action.

If Gaemi later exposes itemized evidence without a paid request, read-only
capture may add actual unit/package weight, markings, zipper/seam condition,
defect count and disposition. Absence of those rows does not negate verified
service execution, but it prevents inventing itemized outcomes.

## Non-publishable listing draft

- Evidence-bounded title: `미니 케이블 정리 파우치 충전기 소품 수납 블랙`.
- Candidate search terms: `케이블파우치`, `충전기파우치`, `미니파우치`,
  `케이블정리`, `전선보관`, `소품수납`.
- Excluded until proven: brand authorization, waterproof/water-resistant,
  shock protection, exact device compatibility, premium/best claims,
  certification exemption and image-edit rights.

This draft is review-only and cannot be sent to Coupang.

## Next gate

Do not reorder or list KK946 as a single unit at an invented premium. Perform
only read-only analysis of a genuinely differentiated bundle or negotiate a
materially lower verified cost, then rerun the fresh identical-market-price
gate. WING logistics registration and Product Creation are not the next step
for this SKU while the economics fail.

Rollback is a Git revert. There is no provider rollback for this read-only
assessment.
