# Revenue Score Contract

## Purpose and boundaries

The Revenue Score Engine ranks Product sales priority from `0` to `100`. It is
a pure, request-time calculation that reuses the existing Revenue Calculation
result. It does not recalculate profit or margin, call an LLM, generate
recommendation prose, persist results, or change Runtime behavior.

## Factors and weights

| Factor | Weight | Normalization |
|---|---:|---|
| Profit | 30% | Base monthly contribution profit; `0` at KRW 0 and `100` at KRW 1,000,000 |
| Margin | 20% | Contribution margin; `0` at 0% and `100` at 40% |
| Search demand | 20% | Logarithmic monthly search volume; `0` at 0 and `100` at 100,000 |
| Competition | 15% | `100 - competition_score`, so lower competition is better |
| Supply stability | 10% | Existing normalized `0..100` score when supplied; otherwise excluded |
| Data quality | 5% | Completeness of Profit, Margin, Search demand, and Competition, with estimate penalties |

Constants are exported as `REVENUE_SCORE_WEIGHTS` and
`REVENUE_SCORE_NORMALIZATION`. Scores clamp to `0..100` and round to one
decimal place.

An unavailable factor is never silently replaced with a neutral value. Its
applied weight becomes zero and the remaining available weights are normalized
to total 1. Supply stability is optional. The current Product schema has no
validated supply-stability score, so the Product mapper excludes it and reports
it in `missingFactors`; `supply_available` is not treated as stability.

## Explainable result

Every result contains:

- `revenueScore`: weighted `0..100` score, or `null` when no required factor is
  calculable.
- `scoreBreakdown`: each normalized score, configured weight, and applied
  weight.
- `confidence`: `0..1`.
- `missingFactors`: unavailable factors.
- `assumptions`: normalization, exclusion, and estimate rules used.
- `status`: `ready`, `estimated`, `incomplete`, or `invalid`.

## Confidence and data quality

Data quality begins with the share of four required factors that are available:
Profit, Margin, Search demand, and Competition. It loses 15 points when Revenue
Calculation uses midpoint-estimated base sales and 10 points when Competition
data is estimated.

Confidence starts as `dataQuality / 100`, loses an additional `0.10` for an
estimated Revenue base and `0.10` for estimated Competition, then is multiplied
by the stored `competition_confidence` percentage when that value is valid.
The final value clamps to `0..1` and rounds to two decimals.

## Status

- `ready`: all required factors are present and neither Revenue nor Competition
  is estimated.
- `estimated`: all required factors are present, but Revenue or Competition
  uses estimated data.
- `incomplete`: Revenue Calculation is incomplete or a required score factor
  is unavailable.
- `invalid`: Revenue Calculation is invalid.

## Product mapping and API

Profit and margin come only from `calculateProductRevenue`. Search demand maps
from `coupang_keyword_search_volume`; Competition maps from
`competition_score`, `competition_analysis_status`,
`competition_data_source`, and `competition_confidence`.

The default `GET /api/products` response remains unchanged. Opt in with:

```text
GET /api/products?includeRevenueScore=true
```

Each Product then includes a `revenueScore` object. The existing
`includeRevenueCalculation=true` option remains independent and unchanged.
