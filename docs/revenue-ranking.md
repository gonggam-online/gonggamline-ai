# Revenue Ranking Engine

## Purpose

The Revenue Ranking Engine is a reusable domain service for deciding which
Products have the highest current sales value. It is not coupled to a
Dashboard, Recommendation API, or upload queue. Those consumers can use the
same ranked DTO without changing the ranking rules.

```text
Products
  -> Revenue Calculation (once per Product)
  -> Revenue Score (once per Product)
  -> Revenue Ranking
       -> Recommendation API
       -> Dashboard
       -> Coupang Upload Queue
```

The engine is pure and request-time only. It performs no database writes, uses
no LLM or OpenAI call, generates no recommendation prose, and does not change
Runtime behavior.

## Algorithm

The engine evaluates each Product in `O(n)`, then uses a deterministic
`O(n log n)` sort.

| Ranking factor | Weight | Source |
|---|---:|---|
| Revenue Score | 60% | Existing Revenue Score result |
| Low competition | 10% | `100 - competition_score` |
| Confidence | 10% | Existing Revenue Score confidence |
| Analysis freshness | 7.5% | `competition_analyzed_at` |
| Data completeness | 7.5% | Available required Revenue Score factors |
| Data quality | 5% | Existing Revenue Score data-quality factor |

Missing values contribute zero for their own weight. Their weight is not
redistributed, and no neutral or synthetic value is generated. This prevents
an incomplete Product from receiving an inflated score.

Freshness uses explicit analysis evidence only:

- at most 7 days: `100`
- at most 30 days: `70`
- at most 90 days: `40`
- older than 90 days: `0`
- missing or invalid timestamp: `null`

Future timestamps clamp to age zero. `updated_at` is not treated as analysis
freshness because an unrelated Product update is not evidence of a new
analysis.

## Ordering and stability

Status is the first sort bucket:

1. `ready`
2. `estimated`
3. `incomplete`
4. `invalid`

Products are never excluded. Within a bucket, ordering uses `rankingScore`,
then `revenueScore`, confidence, Product ID, and finally original position.
Product ID makes ties deterministic across input permutations when identity is
available.

## Explainable DTO

Each ranked item includes:

- rank, Product ID, and Product name
- ranking score, Revenue Score, and confidence
- Revenue status and recommendation level
- machine-readable reason codes
- the normalized competition, confidence, freshness, completeness, and
  data-quality factors used by ranking

Reason codes are emitted only when supported by actual data:

- `HIGH_MARGIN`: normalized margin is at least 75
- `HIGH_DEMAND`: normalized search demand is at least 75
- `LOW_COMPETITION`: stored competition score is at most 30
- `LOW_CONFIDENCE`: calculated confidence is below 0.5
- `STALE_DATA`: a valid analysis timestamp is older than 90 days
- `MISSING_COST`: Revenue Calculation reports missing unit Product cost

Recommendation levels are deterministic:

- `STRONG_RECOMMEND`: score at least 80, confidence at least 0.75, and complete
- `RECOMMEND`: score at least 65, confidence at least 0.5, and complete
- `WATCH`: complete score at least 40
- `NOT_RECOMMENDED`: lower score or any `incomplete`/`invalid` result

## Product API

The existing response is unchanged unless explicitly requested:

```text
GET /api/products?includeRanking=true
```

The option adds a top-level `ranking` array. Ranking always consumes the
original Product rows, so combining it with `includeRevenueCalculation` or
`includeRevenueScore` does not repeat calculations or depend on presentation
DTO enrichment.

## Operational impact

- No migration or schema change
- No Production data read/write beyond the existing Product list query
- No Runtime Queue, Worker, marketplace, pricing, or upload behavior change
- No default Product API contract change
