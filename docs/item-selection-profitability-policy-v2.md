# Item Selection Profitability Policy v2

## Contract

- Policy: `gonggamline-profitability-2026-08-12-v2`
- Effective date: `2026-08-12` (`Asia/Seoul`)
- Financial owner: Revenue
- Consumer: Supplier / Procurement Item Selection evaluator
- Risk: high-risk/manual because this policy changes contribution-profit and
  recommendation semantics.

The versioned source of truth is
`lib/revenue/item-selection-profitability.ts`. The policy returns base, stress,
current-effective, and normalized scenarios. Recommendation decisions use the
normalized base result plus the stress result; a current promotion is
reference-only.

## Approved values

- Coupang category fee: confirmed WING rate; conservative fallback `10.9%`.
  The fee base is the VAT-inclusive final price paid by the customer.
- Coupang monthly service fee: `55,000 KRW` including VAT, excluded from
  per-order contribution profit.
- Missing verified small-parcel 3PL: base `3,000 KRW`, stress `3,500 KRW`.
- Advertising: base `12.5%`, stress `18%`, launch operating cap `20%`.
- Actual advertising replaces base estimation after 28 days or 200 valid
  orders.
- Return/final-loss reserve: simple durable `4% / 6%`; compatibility,
  assembly, fragile, and electronics `6% / 10%`.
- Apparel/footwear requires actual category evidence.
- Actual return loss replaces category estimation after 100 cases or 90 days.
- Recommend: score at least 75, normalized contribution at least `3,000 KRW`
  and `20%`, stress contribution positive and at least `10%`.
- Conditional: score at least 60, normalized contribution at least `2,000 KRW`
  and `15%`, and stress contribution positive.

## Trust, VAT, and precision

Every money/rate fact declares source, safe reference, effective date, VAT
treatment, inclusion relationship, and one of `CONFIRMED`, `ESTIMATED`,
`MISSING`, or `NOT_APPLICABLE`. A required estimated/missing fact caps the
verdict at `MANUAL_REVIEW`, even if numerical thresholds pass.

Taxable final selling prices are converted to net revenue for contribution
profit. Marketplace fees are calculated from the customer's VAT-inclusive
final price because that is Coupang's fee base; deductible VAT on the fee means
the net fee expense is `gross final price * fee rate`. Advertising and return
loss reserves continue to use net revenue. Other deductible VAT-inclusive
costs are compared net of VAT. Non-deductible VAT, tax-exempt, and explicitly
VAT-exclusive values retain their supplied amount.

Calculations do not round intermediate won values. Raw values drive verdicts;
only display fields round to the nearest won or two percentage decimals.

The mapper accepts only the sanitized provider-neutral Supplier Catalog fields
needed for unit cost, shipping, MOQ, and a bounded evidence reference. Provider
raw payloads and secrets are not accepted or returned.

## Change from v1

Policy v1 incorrectly applied the marketplace fee rate to VAT-exclusive net
revenue for taxable consumer prices. V2 applies the fee to the customer's final
price and adds regression coverage for that basis. No other policy threshold
or fallback value changes.

## Story boundary

This Story contains no migration, persistence, API route, UI, authentication,
authorization, RLS, or CSRF implementation. Historical snapshot storage and
presentation remain separately approved Stories.
