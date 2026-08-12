# Item Selection Profitability Policy v3

## Contract

- Policy: `gonggamline-profitability-2026-08-12-v3`
- Effective date: `2026-08-12` (`Asia/Seoul`)
- Financial owner: Revenue
- Consumer: Supplier / Procurement Item Selection evaluator
- Risk: high-risk/manual because this policy changes purchase eligibility and
  contribution-profit recommendation semantics.

The versioned source of truth is
`lib/revenue/item-selection-profitability.ts`. V3 preserves all v2 fee, VAT,
cost, precision, and threshold rules and adds a fail-closed pre-purchase gate.

## Pre-purchase gate

The operating order is:

```text
fresh identical-product delivered market price
  -> conservative full variable-cost calculation
  -> recommend thresholds pass
  -> exact supplier MOQ as the sample quantity
  -> separately approved purchase action
```

The system must not purchase first and search for profitability afterward. A
sample is only **eligible for purchase review** when all of these are true:

1. A confirmed, identical product offer was observed no more than seven days
   before evaluation.
2. Candidate and observed offers contain the same number of sellable units.
3. The market fact is the customer's delivered price, including shipping.
4. Every mandatory deterministic cost is confirmed or explicitly not
   applicable, and approved conservative estimates cover the permitted
   advertising, return-loss, and fulfillment unknowns.
5. Profitability at that delivered market price passes the existing recommend
   thresholds: normalized contribution at least `3,000 KRW` and `20%`, plus
   positive stress contribution and stress margin at least `10%`.
6. Requested sample quantity equals the verified supplier MOQ. A larger
   quantity fails the gate; it is not silently treated as a sample.

Missing, stale, comparable-only, unit-count-mismatched, or unconfirmed market
evidence returns `INCOMPLETE` and blocks purchase eligibility. A complete
calculation below thresholds returns `FAIL`. A high hypothetical price cannot
override a lower identical-product market price.

`PASS` is necessary but never authorizes a provider write, payment, order,
warehouse instruction, or other commerce action. Those remain separately
approved, idempotent external actions with exact target, quantity, amount,
account, verification, and recovery.

## Approved values carried from v2

- Coupang category fee: confirmed WING rate; conservative fallback `10.9%`.
  The fee base is the VAT-inclusive final price paid by the customer.
- Coupang monthly service fee: `55,000 KRW` including VAT, excluded from
  per-order contribution profit.
- Missing verified small-parcel 3PL: base `3,000 KRW`, stress `3,500 KRW`.
- Advertising: base `12.5%`, stress `18%`, launch operating cap `20%`.
- Return/final-loss reserve: simple durable `4% / 6%`; compatibility,
  assembly, fragile, and electronics `6% / 10%`.
- Recommend: normalized contribution at least `3,000 KRW` and `20%`, stress
  contribution positive, and stress margin at least `10%`.
- Conditional remains useful for screening but is not sufficient for a sample
  purchase.

## KK946 correction

The previously modeled `11,800 KRW` price was an economic requirement, not a
market-viable selling price. The confirmed operator-provided identical-product
offer is `4,290 KRW` delivered for one unit. At that price, KK946 produces
approximately `-1,548 KRW` base and `-1,840 KRW` stress contribution per unit.
It therefore fails the v3 gate. No reorder or single-unit listing at an
invented premium price is eligible. A materially lower landed/fulfillment cost
or a genuinely differentiated bundle requires a new exact-market comparison
and a new gate result.

## Story boundary

This change adds a pure calculation contract, policy evidence, and tests. It
does not add or change database schema, API contracts, provider integrations,
Production state, secrets, or commerce writes. Binding the result to the
legacy procurement persistence path needs a separately reviewed high-risk
Story with a trusted persisted evidence reference; until then, this policy is
the mandatory operator gate and no purchase may be inferred from the legacy
`sourcing_decisions` status alone.
