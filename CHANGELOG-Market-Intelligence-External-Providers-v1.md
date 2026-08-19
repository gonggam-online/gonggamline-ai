# Market Intelligence External Providers v1

- Added server-only Naver Shopping Search adapter for official product/rank/
  price metadata.
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
