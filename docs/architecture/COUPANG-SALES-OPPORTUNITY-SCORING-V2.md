# Coupang Sales Opportunity Scoring v2

Status: Implemented  
Ranking contract: `gonggamline-sku-market-ranking-v4`  
Decision scope: product research and prioritization only

## Objective

Find products that show strong current Coupang demand and revenue potential while review saturation is still low enough for a new seller to enter. The engine must match that product-level signal with broader market trends, current availability, supplier economics, and repeatable evidence before calling an item high confidence.

No public source can guarantee that a product will sell. “High confidence” therefore means that all observable evidence gates passed; it is not a sales guarantee.

## What experienced sellers evaluate

The implementable common pattern is:

1. Verify real demand, not only search popularity: persistent rank, review growth, repeated availability pressure, and estimated units/revenue.
2. Measure entry headroom: strong demand with fewer accumulated reviews than comparable products is preferable to a mature review moat.
3. Compare like with like: brand, model, option, size, and pack count must identify the same SKU.
4. Verify current availability and price: a sold-out listing is evidence of past demand but not a sell-now candidate.
5. Check customer experience and delivery competition: price, delivery type, stock continuity, and seller execution affect representative exposure. Coupang officially describes Item Winner as a combined evaluation of price, delivery, and customer experience and explicitly prioritizes in-stock products.
6. Model full landed economics: supply, MOQ, domestic transport, inspection, packaging, labeling, 3PL, Coupang fee, and returns.
7. Validate with multiple items rather than one anecdotal listing: percentile scores require at least three comparable SKUs.
8. Accumulate time series: a one-time screenshot cannot establish sales velocity or trend persistence.

## Stable evidence authorities

| Signal                                                                   | Canonical source                                                                         | Use                                                          | Limitation                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| Coupang current product, price, rank, review count, availability snippet | DataForSEO bounded Google results containing a Coupang product URL                       | Daily product observation and identical-product verification | Public search observation, not internal Coupang GMV |
| Search and shopping demand trend                                         | Naver API Hub Search Trend and Shopping Insight                                          | Category-bound relative demand, momentum, seasonality        | Relative index, not absolute Coupang orders         |
| Content demand                                                           | YouTube Data API; approved TikTok/Tenbi immutable imports                                | Early product-relevant momentum                              | Never treated as purchase volume                    |
| Product time series                                                      | `market_snapshots`                                                                       | Price, rank, review, stock, delivery history                 | Requires repeated collection                        |
| Estimated units and revenue                                              | `market_product_metrics`, derived from review deltas, rank persistence, and stock events | Comparable demand proxy with confidence interval             | Estimate, never labelled actual sales               |
| Supplier and logistics                                                   | `supplier_quotes`, Gaemi/3PL evidence                                                    | Landed unit cost and margin                                  | Must be fresh and exact-SKU bound                   |
| Own realized outcome                                                     | orders, returns, settlement, `market_feedback_events`                                    | Calibration authority once available                         | Only for products actually operated                 |

The current official Coupang Open API documents seller product, inventory, order, and settlement operations but does not expose competitors’ actual item-level sales or GMV. The engine consequently must not label a competitor estimate as actual sales.

## v4 score

### Coupang sales-opportunity score

| Component            | Weight | Definition                                                                                     |
| -------------------- | -----: | ---------------------------------------------------------------------------------------------- |
| Sales strength       |    32% | 45% estimated units percentile + 35% estimated revenue percentile + 20% search-rank percentile |
| Review headroom      |    24% | 60% inverse cohort review percentile + 40% absolute log-scaled review headroom                 |
| Demand efficiency    |    24% | 50% units-per-review percentile + 50% revenue-per-review percentile                            |
| Trend proof          |    12% | observation days, snapshot count, and historical stock-pressure evidence                       |
| Evidence reliability |     8% | analytical confidence combined with time-series proof                                          |

Percentiles are neutral at 50 until at least three comparable products exist. This prevents a single listing from becoming “best in cohort” by definition.

### Low-review/high-sales archetype

`LOW_REVIEW_HIGH_SALES` requires all of the following:

- at least three comparable product identities;
- review count at or below the cohort median;
- estimated monthly units at or above the cohort median;
- estimated monthly revenue at or above the cohort median;
- review-headroom score at least 55;
- demand-efficiency score at least 60;
- sales-strength score at least 60.

### High-confidence admission

A product enters the high-confidence sell-review list only when all of these pass:

- market match at least 45 and two independent market-signal providers;
- identity score at least 60 and two product-level corroborating sources;
- observation no older than 14 days;
- explicit current in-stock state and current price;
- estimated monthly units and revenue;
- at least three comparable Coupang product identities;
- trend-proof score at least 35;
- Coupang sales-opportunity score at least 58;
- total confidence at least 65.

A fresh exact supplier quote and SKU-specific logistics cost promote `HIGH_CONFIDENCE` to `SELL_READY`. Missing evidence stays visible in the verification queue and never pads the top ten.

## Overall ranking

- Coupang sales opportunity: 38%
- cross-market opportunity: 20%
- exact profitability: 17%
- product evidence: 12%
- product identity: 10%
- product-relevant TikTok momentum: 3%

## Collection policy

- DataForSEO queries return up to 20 results and retain explicit price, review, rating, availability, delivery-type, and rank evidence when present.
- SKU verification queries run daily for the paid provider and twice daily for zero-cost official providers.
- Snapshots are append-only; history is not overwritten.
- Same-product rows observed through multiple providers are merged into one ranked identity while all provenance is retained.
- Upstream data relayed by Tenbi or another tool is counted once by `upstreamSource`.
- Provider failure reduces confidence and schedules verification; it does not invent a substitute value.

## Primary references

- [Coupang Item Winner guidance](https://marketplace.coupang.com/information-center/rocketgrowth-item-winner)
- [Coupang Open API product APIs](https://developers.coupangcorp.com/hc/ko/sections/360005046534-%EC%83%81%ED%92%88-APIs)
- [Coupang Ads product and ROAS guidance](https://ads.coupang.com/new/intro)
- [Coupang Rocket Growth product expansion guidance](https://marketplace.coupang.com/information-center/rocketgrowth-product-registration)
- [Naver Shopping Insight API](https://developers.naver.com/docs/serviceapi/datalab/shopping/shopping.md)
- [Naver Shopping Search fields](https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md)
- [DataForSEO Google Shopping product fields](https://docs.dataforseo.com/v3/merchant-google-products-task_get-advanced/)
