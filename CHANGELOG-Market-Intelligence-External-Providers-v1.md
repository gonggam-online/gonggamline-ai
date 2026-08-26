# Market Intelligence External Providers v1

## NAVER API HUB compatibility

- Replaced the retired Naver Developers Shopping Search URL/header contract
  with NAVER API HUB Search Trend and optional Shopping Insight calls.
- Added canonical `NAVER_API_HUB_CLIENT_ID` and
  `NAVER_API_HUB_CLIENT_SECRET` variables while retaining the previous names as
  a transition fallback.
- Kept the existing `naver-shopping-api` collector key so deployed jobs do not
  require a destructive data migration; it now routes to `naver_api_hub`.
- Persisted NAVER API HUB output as relative trend signals only. It does not
  invent product offers, prices, sellers, or ranks that the DataLab APIs do not
  return.
- Shopping Insight is called only when a validated numeric category ID is
  configured; Search Trend remains usable without it.

- The original version used Naver Shopping Search product/rank/price metadata;
  that retired contract is superseded by the API HUB compatibility section.
- Added YouTube Data API metadata adapter that returns reference-only discovery
  signals and never persists video bytes, views as reviews, or asset rights.
- Added DataForSEO Naver Organic SERP adapter with Basic auth injection,
  bounded depth, and required per-request USD cost ceiling.
- Connected Naver and DataForSEO native providers to the existing collection
  job contract behind `MARKET_EXTERNAL_PROVIDER_ENABLED=true`.
- Missing credentials, disabled runtime, 403/429, malformed payloads, and
  cost-ceiling violations fail closed.

No live provider call was made in this environment because the approved Vercel
Production Secret values are not present. No DB migration, marketplace write,
Production verdict change, asset download, or commerce action was added.
# Follow-up: sales-free presales ranking

- Added a bounded presales opportunity assessment that keeps strong market
  candidates in a validation queue when unit economics are incomplete.
- Added source diversity, freshness, evidence coverage, uncertainty bounds,
  contactability, rights status, and category-diverse portfolio selection.
- Known rights failure and known negative economics remain blockers; missing
  sales data is not treated as a reason to discard a promising candidate.
- The new packet is research-only and cannot alter operational verdicts or
  authorize commerce/Production actions.
