# Autonomous Market Trend & Item Discovery Engine v1

## Status

Implemented Shadow runtime architecture. Runtime delivery is mapped to the
versioned modules and additive migration in the implementation section below;
the document itself remains a contract and never contains credentials or
authorizes commerce actions.

## Objective

Engine 1 must continuously answer four operator questions with current,
auditable evidence:

1. What are Korean online shoppers looking for now?
2. Which needs and product patterns are rising, stable, seasonal, or fading?
3. Which concrete single, set, bundle, or multipack items deserve investigation?
4. Why was each item recommended, how fresh is the evidence, and what must
   Engine 2 still validate?

The engine is not a fixed keyword dashboard and must not stop because no item
passes a strict final-purchase gate. It always produces a ranked research set
when valid market evidence exists, while keeping unsupported profitability,
rights, supplier, and commerce claims explicitly unresolved.

## Current implementation inventory

### Already usable

- `market_keywords`, `market_products`, `market_snapshots`,
  `market_product_metrics`, feature snapshots, collection runs, signals,
  estimates, decisions, and recommendation tables already provide durable
  market history.
- The Production Cron calls `/api/market/cron` hourly. Due jobs are selected by
  priority and processed through the existing orchestration service.
- Naver Shopping Search collects bounded product, displayed price, mall,
  category-adjacent and rank observations.
- YouTube Data API collects bounded public video search metadata as research
  signals without treating media as reusable assets.
- DataForSEO collects bounded Naver SERP observations with a per-request cost
  ceiling.
- Product analysis calculates demand, growth, stability, competition, supply,
  advertising burden, entry difficulty, opportunity, confidence, unit-range
  hints, and time-series signals.
- Discovery can create single-product and bundle recommendations, preserve
  human status, and hand approved candidates to downstream workflow.
- Engine 1 now owns the market-data-based recommended search terms and can
  pass a selected term into Engine 2.

### Implementation gaps addressed by v1

1. The keyword universe is mainly the fixed 24-keyword seed. No controlled
   discovery-expansion loop promotes newly observed needs or phrases.
2. Keyword-level demand, competition, opportunity, and trend series are not
   recalculated from collected evidence. The visible keyword recommendation
   can therefore fall back to static priority.
3. Naver Shopping Search is integrated, but Naver DataLab Search Trend and
   Shopping Insight time series are not part of the runtime collector.
4. YouTube search records titles and publish times but does not enrich the
   selected videos with `videos.list` statistics. Content velocity and
   engagement therefore remain unknown.
5. YouTube and general SERP discovery signals are stored separately, while the
   existing discovery generator primarily ranks `market_products`. The evidence
   lanes do not converge into one candidate.
6. The discovery run starts manually and selects recent products before
   ranking. Collection completion does not automatically produce a versioned
   trend digest and recommendation run.
7. Equivalent products and phrases across Naver, YouTube, SERP, and suppliers
   are not clustered into a stable market concept. Duplicate titles can occupy
   the candidate set.
8. There is no provider usage ledger, daily paid-cost budget, per-source
   freshness SLO, source-agreement measure, or end-to-end run health summary.
9. The UI exposes operational tables but not a customer-demand brief,
   rising/falling trends, evidence timelines, candidate explanation, or clear
   separation between market recommendation and Engine 2 economics.

## Source contract and current official constraints

The runtime uses official APIs only for v1.

| Source | Signal | Planned cadence | Hard boundary |
|---|---|---:|---|
| Naver Shopping Search | products, displayed price, mall, result order | active terms every 6h | official Search API; bounded result count |
| Naver DataLab Search Trend | general search-interest ratio and momentum | daily, batched keyword groups | relative ratio, not absolute searches; 1,000 calls/day |
| Naver Shopping Insight | shopping-click ratio by exact category/keyword | daily, max 5 terms per request | exact Naver category code required; relative ratio; 1,000 calls/day |
| YouTube Data API `search.list` | recent Korean video discovery | priority terms every 12h | default granular Search quota must be observed; metadata only |
| YouTube Data API `videos.list` | selected video views/likes/comments | one batched enrichment per search page | research signal; Shorts view definition changes are versioned |
| DataForSEO Naver SERP | result composition, ranks, related terms | top rising terms daily | paid; account budget plus request and daily ceilings |

Naver Shopping Search currently documents 25,000 calls/day. Naver DataLab
Search Trend and Shopping Insight each document 1,000 calls/day. Shopping
Insight returns relative click ratios and requires an exact shopping category
code. YouTube's current granular quota documentation gives `search.list` a
separate default allowance of 100 calls/day with one call charged per request;
the old hard-coded `quotaUnits: 100` assumption must be removed. DataForSEO
charges every Live request and reports the actual task cost in the response.

## Target architecture

```text
Seed terms + newly discovered phrases
  -> quota/cost-aware Research Planner
  -> Naver Shopping + DataLab + YouTube + DataForSEO collectors
  -> immutable normalized signal envelopes
  -> keyword/concept resolver + product entity resolver
  -> keyword trend snapshots + product feature snapshots
  -> market trend classifier
  -> single/set/bundle candidate generator
  -> evidence-weighted recommendation ranking
  -> Engine 1 customer-demand brief and item recommendations
  -> selected keyword/item handoff to Engine 2 economics validation
  -> operator decision and later sales/return/settlement feedback
```

Every output carries `asOf`, window, provider set, evidence digests,
freshness, completeness, conflict state, model/policy version, and confidence.

## 1. Controlled keyword discovery

Maintain three keyword lanes:

- `CORE`: owner-approved categories and stable problem/use-case seeds.
- `EXPLORE`: related searches, repeated title phrases, and content topics found
  by at least one approved source.
- `WATCH`: low-evidence phrases retained for bounded follow-up.

Candidate phrases are normalized for NFC, whitespace, punctuation, synonyms,
brand/trademark terms, and obvious non-product intent. Promotion rules:

- one source: `WATCH`, never an operating recommendation;
- two independent fresh sources, or one official trend source plus strong
  persistence: `EXPLORE`;
- repeated evidence across at least two windows and approved category mapping:
  eligible for `CORE` review;
- prohibited, conflicting, stale-only, or navigation/noise terms: quarantined.

Expansion is capped at 10 new phrases per daily run and 100 active phrases.
Low-value terms decay to `paused`; they are not deleted, preserving history.

## 2. Normalized evidence model

Add an additive migration with these logical records:

### `market_keyword_signal_snapshots`

- keyword/concept ID, provider, observed window, metric type;
- relative demand index, momentum 7d/30d, acceleration, seasonality;
- shopping-intent ratio, result count, content count/velocity;
- source rank, actual/requested cost, quota units;
- source policy version, payload digest, observed/received timestamps.

### `market_concepts`

- stable concept ID and canonical phrase;
- aliases, category code/version, problem/use-case tags;
- lifecycle: `WATCH`, `EXPLORE`, `ACTIVE`, `PAUSED`, `QUARANTINED`;
- evidence coverage and conflict state.

### `market_candidate_entities`

- stable candidate ID and normalized product family;
- single/set/bundle/multipack form;
- linked market products, concepts, and source observations;
- identity confidence and duplicate-cluster digest.

### `market_trend_digests` and `market_recommendation_runs`

- immutable run inputs and output digest;
- rising, breakout, persistent, seasonal, saturated, and declining lists;
- ranked candidate IDs with score breakdown and unresolved Engine 2 facts;
- provider health, freshness, quota, cost, and partial-run state.

### `market_provider_usage`

- provider, day, request count, quota count, reported cost;
- configured daily/monthly ceiling and trip state;
- no Secret or raw credential fields.

Existing market tables remain canonical for product observations. The new
tables join the evidence lanes rather than duplicating raw observations.

## 3. Trend classification

Use robust normalized features, not an LLM's unsupported market opinion:

- `demandLevel`: latest relative search/shopping interest;
- `momentum7d`, `momentum30d`: robust slopes;
- `acceleration`: recent slope minus preceding slope;
- `persistence`: share of positive windows;
- `shoppingIntent`: Shopping Insight vs general search strength;
- `contentVelocity`: new relevant videos and view acceleration;
- `competitionPressure`: result density, top-result concentration,
  accumulated reviews, ad/paid-result burden;
- `priceRoom`: observed price distribution and volatility;
- `sourceAgreement`: agreement among independent source directions;
- `freshness` and `coverage`: explicit penalties, never silent defaults.

Trend states:

- `BREAKOUT`: strong acceleration with at least two sources;
- `RISING`: positive momentum and persistence;
- `PERSISTENT`: strong level without short-lived acceleration;
- `SEASONAL_APPROACHING`: recurring lift before the expected peak;
- `SATURATED`: demand exists but entry pressure dominates;
- `DECLINING`: sustained negative momentum;
- `INSUFFICIENT_EVIDENCE`: still shown for research, not scored as zero.

## 4. Recommendation contract

Engine 1 produces a market opportunity score, not a final purchase verdict.

```text
MarketOpportunity =
  22% demand level
  18% momentum
  10% acceleration
  10% persistence/seasonality fit
  12% shopping intent
   8% content velocity
  10% competition headroom
   5% price room
   5% source agreement

Confidence multiplier = freshness × coverage × identity × source reliability
```

Weights are versioned configuration and tested to total 100%. Missing evidence
reduces confidence and exposes a research task; it is not replaced with a
favorable midpoint. Confirmed policy/rights failure quarantines only the
affected lane. Confirmed negative economics remains Engine 2's rejection.

Output lanes:

- `DISCOVER_NOW`: strongest fresh market opportunities;
- `VALIDATE_ECONOMICS`: market opportunity is strong; Engine 2 needs cost,
  logistics, and sale-price validation;
- `WATCH_TREND`: promising but early or source coverage is thin;
- `SATURATED_OR_DECLINING`: visible with reasons, not silently discarded;
- `QUARANTINED`: invalid/conflicting evidence.

At least the top 20 valid candidates are retained per run. This prevents the
engine from returning an empty result merely because final commercial facts
are incomplete, while never fabricating those facts.

## 5. Single, set, bundle, and multipack generation

- Single products come from resolved market product families.
- Sets require complementary use in one task or context.
- Bundles require co-intent evidence and distinct roles, not title similarity
  alone.
- Multipacks require repeat-use/consumable evidence and a price-band check.

Generation uses deterministic concept and product links first. An LLM may
summarize customer language or propose labels only after the candidate and
evidence set are fixed; it cannot create demand metrics or product facts.

## 6. Autonomous orchestration

Replace the current single pass with a resumable daily cycle:

1. hourly Cron claims due jobs with a lease and idempotency key;
2. fast lane collects Naver Shopping for due active terms;
3. daily planner batches Naver DataLab and Shopping Insight;
4. YouTube search and statistics run within the current quota ledger;
5. paid DataForSEO calls only the highest information-gain terms while both
   per-request and daily/monthly budgets remain open;
6. all successful observations update keyword and product features;
7. trend digest and recommendation run execute automatically after the daily
   evidence window closes, including partial provider results;
8. newly discovered phrases enter the bounded WATCH/EXPLORE workflow;
9. a completed run atomically publishes the newest Engine 1 read model.

Provider failure does not erase a valid run. The digest records `PARTIAL`,
penalizes confidence for the missing source, schedules bounded retry with
jitter, and continues with unaffected sources. Authentication failure, 403,
429, or budget trip opens a circuit breaker and never loops aggressively.

## 7. Engine 1 user experience

The Engine 1 main page becomes an operator brief in this order:

1. **시장 상황 요약**: as-of time, provider freshness, run health, cost/quota.
2. **오늘의 고객 수요**: breakout/rising/persistent/seasonal/falling concepts.
3. **추천 검색어**: reason, trend state, 7d/30d movement, source badges.
4. **추천 아이템**: single/set/bundle/multipack cards with market score,
   confidence, evidence, risk, and unresolved economics.
5. **왜 추천했나**: score breakdown and source timeline.
6. **다음 행동**: send keyword/item to Engine 2, watch, dismiss with reason, or
   request more evidence.
7. **운영 상세**: collectors, schedules, queues, raw run tables in a collapsed
   diagnostics section rather than the primary experience.

Engine 2 receives immutable `marketRecommendationRunId`, candidate ID,
keyword/concept ID, evidence digest, as-of time, market score, confidence, and
suggested sale-price range. Engine 2 remains authoritative for supplier match,
landed cost, logistics, fee, return, advertising, contribution margin, rights,
and final selection.

## 8. Observability and quality gates

Required metrics:

- freshness and success rate by provider;
- active/paused/quarantined keywords and concept expansion rate;
- duplicate-cluster rate and identity confidence;
- recommendation count by lane and category diversity;
- score movement explained by new evidence;
- paid cost per useful signal and per recommended candidate;
- operator accept/watch/dismiss agreement;
- later: precision@k, NDCG, realized margin error, returns and settlement.

Required guards:

- no Secret, raw authorization header, personal data, media bytes, or raw HTML
  in durable evidence;
- deterministic fixtures and clock-controlled trend calculations;
- exact source/category/policy/version bindings;
- no duplicate recommendations for the same candidate cluster;
- idempotent collection, analysis, and recommendation reruns;
- stale/conflicting/partial evidence tests;
- provider quota and paid budget tests;
- existing Engine 2 score, verdict, purchase, listing, and Production behavior
  unchanged until a separately reviewed integration rollout.

## Implementation stories

### Runtime implementation map

- `supabase/migrations/027_autonomous_market_discovery_engine.sql` owns the
  additive evidence ledger, concepts, candidates, trend digests,
  recommendation runs, and provider-usage state.
- `lib/market/autonomous-intelligence.ts` owns deterministic normalization,
  trend classification, bounded phrase extraction, scoring, stable tie-breaks,
  and single/bundle research candidate generation.
- `services/autonomous-market-discovery.service.ts` persists immutable provider
  evidence, expands the keyword universe within the daily/active caps, rebuilds
  versioned read models, and returns the latest safe fallback.
- `services/market-orchestration.service.ts` owns bounded due-job execution,
  stale-lease recovery, atomic job claims, provider failure isolation, and the
  post-collection intelligence rebuild.
- `/api/market/intelligence` and `/market` expose the Engine 1 demand brief,
  trends, recommendations, unresolved checks, and the audited Engine 2 handoff.
- `services/item-selection-market-enrichment.service.ts` consumes the latest
  digest-bound trend evidence only when a direct product metric is unavailable;
  it does not invent supply, margin, rights, or fulfillment facts.

### Story A — Trend evidence foundation

- additive schema and RLS for keyword signals, concepts, digests, usage ledger;
- Naver DataLab Search Trend and Shopping Insight adapters;
- YouTube `videos.list` statistics enrichment;
- current quota accounting correction and provider contract tests.

### Story B — Keyword/concept learning loop

- phrase extraction, normalization, source-independent promotion/decay;
- exact Naver category mapping and drift handling;
- controlled expansion with daily and total caps.

### Story C — Trend and recommendation engine

- versioned trend features/classifier;
- entity resolver and single/set/bundle/multipack generator;
- immutable recommendation run and Engine 2 handoff packet;
- offline benchmark against current priority-only baseline.

### Story D — Autonomous runtime and Engine 1 UI

- leased/idempotent planner, partial-source continuation, retry/circuit breaker;
- automatic daily digest publication;
- demand brief, trend views, recommendation cards, evidence timelines;
- provider health, quota and cost diagnostics.

### Story E — Shadow rollout and calibration

- run for at least 14 daily windows without changing Engine 2 verdicts;
- compare recommendation stability, evidence coverage, diversity, operator
  agreement, and cost against the current engine;
- enable Engine 2 consumption only after the packet and rollback are verified.

## Definition of done

- A fresh daily market brief is generated without a button click.
- At least three independent source lanes feed a common trend digest.
- New terms can be discovered, bounded, researched, promoted, decayed, and
  audited without manual database edits.
- Every recommended item explains demand, trend, competition, freshness,
  sources, confidence, and missing economics.
- The same evidence produces the same ranked result and digest.
- Provider failures yield honest partial results instead of empty output or
  invented values.
- The 24 current seed keywords remain a baseline, not the whole search space.
- Engine 1 always returns a useful ranked research portfolio when valid market
  evidence exists; it never forces a final commercial approval.
- Engine 2 receives a verified handoff and remains responsible for profitability
  and final selection.
- CI, migration replay, security, Preview browser, and Production smoke pass;
  rollback can disable the new planner/read model without deleting evidence.

## Rollout decision

Implement Stories A through D in Shadow mode first. No new scraping lane is
needed for v1. The already configured Naver, YouTube, and DataForSEO accounts
are sufficient to build a materially stronger pre-sales market discovery
engine when the missing trend APIs, evidence convergence, autonomous planner,
and recommendation read model are completed.

## Official references

Verified on 2026-08-26. Runtime adapters must re-check these contracts when a
provider version or quota policy changes.

- Naver Shopping Search API:
  <https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md>
- Naver DataLab Search Trend API:
  <https://developers.naver.com/docs/serviceapi/datalab/search/search.md>
- Naver DataLab Shopping Insight API:
  <https://developers.naver.com/docs/serviceapi/datalab/shopping/shopping.md>
- YouTube Data API `search.list`:
  <https://developers.google.com/youtube/v3/docs/search/list>
- YouTube Data API quota calculator:
  <https://developers.google.com/youtube/v3/determine_quota_cost>
- YouTube Data API revision history:
  <https://developers.google.com/youtube/v3/revision_history>
- DataForSEO Live Advanced SERP contract:
  <https://docs.dataforseo.com/v3/serp-se-type-live-advanced/>
- DataForSEO Naver SERP overview:
  <https://docs.dataforseo.com/v3/serp-naver-overview/>

## 2026-08-27 high-confidence SKU discovery amendment

Production observation showed that a strict title-to-concept filter reduced 39
real product rows to one result. Filling the remaining positions with weak
matches would make the ranking look complete without improving the selling
decision, so the runtime now separates two outputs:

- `rankings`: only fresh, priced actual SKUs with a strong market-concept match,
  at least two independent market-signal providers, and sufficient product
  identity corroboration;
- `verificationQueue`: real products that still need evidence, with bounded
  product-specific search queries and explicit missing-evidence codes.

Each rebuild schedules at most 12 verification queries across Naver API Hub,
DataForSEO, and YouTube. For keywords categorized as `SKU 자동 교차검증`, the
DataForSEO lane performs the existing bounded public Coupang-price observation
instead of storing an unpriced generic search result. The hourly collector
persists the resulting products and signals, rebuilds the immutable ranking,
and promotes a candidate only when the high-confidence contract converges.

`SELL_READY` additionally requires a fresh SKU-bound supplier quote and
SKU-specific logistics cost. Therefore high market confidence never implies
purchase, listing, inventory, or other commerce authority. Provider failure
leaves the product in the verification queue and does not create filler rows.

The SKU boundary also excludes demo/synthetic provenance, social-video rows,
and observations without a positive market price before either ranking or
verification scheduling. Social content remains demand evidence only; it is
never reclassified as a sellable SKU. This prevents test fixtures and shopping
short titles from consuming the bounded provider budget or appearing as real
products.
