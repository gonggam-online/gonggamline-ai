# Item Selection Profitability Policy v4

## Change record

- Policy: `gonggamline-profitability-2026-08-19-v4`
- Effective date: `2026-08-19` (`Asia/Seoul`)
- Financial owner: Revenue
- Change: supplier-to-fulfillment shipping is now carried from the provider
  evidence into the Item Selection profitability input as
  `supplierToFulfillmentInbound`.
- Risk: high-risk/manual. This changes contribution-profit inputs and purchase
  eligibility semantics.

## Logistics evidence boundary

The generic Item Selection workflow now includes the observed supplier shipping
charge when the supplier response provides one. A missing supplier shipping
charge remains `MISSING` and cannot be treated as zero.

The KK946 evidence packet is the current evidence-bound reference for the
Gaemi Warehouse and Coupang logistics path:

- supplier delivery allocation: `3,000 / 6 = 500 KRW` gross per unit;
- Gaemi inbound unloading: `770 / 6 = 128.33 KRW` gross per unit;
- Gaemi full inspection: `660 / 6 = 110 KRW` gross per unit;
- Gaemi extreme-small fulfillment plan: `2,000 KRW` delivery,
  `600 KRW` outbound work, `210 KRW` box, and `100 KRW` materials on a VAT-
  exclusive profitability basis;
- WING category fee evidence: `10.5%` on the VAT-inclusive customer final
  price, with deductible VAT treatment.

See [KK946 profitability and Coupang listing facts](evidence/KK946-PROFITABILITY-AND-COUPANG-LISTING-FACTS-V1.md)
and [the sanitized decision JSON](evidence/kk946-profitability-decision-v1.json).

These KK946 values are **not** global defaults. They are bound to the verified
KK946 subject, quantity basis, package tier, observed warehouse charges, and
WING category evidence. They must not be copied to another candidate without a
fresh evidence reference and effective date.

## Remaining fail-closed behavior

The generic workflow does not invent Gaemi warehouse charges or a Coupang
category fee. When no confirmed evidence-bound profile is supplied, it retains
the approved conservative 3PL estimates (`3,000`/`3,500 KRW`) and the
conservative Coupang fee fallback (`10.9%`). Mandatory missing variable costs
still produce `INCOMPLETE`/`MANUAL_REVIEW` rather than a profitable verdict.

Actual purchase, inbound, fulfillment, listing, price, or other commerce writes
remain separately approved high-risk actions. This policy only changes the
read-only profitability calculation and its immutable evidence snapshot.
