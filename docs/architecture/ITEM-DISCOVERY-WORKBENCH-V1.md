# Item Discovery Workbench v2

## Purpose

Engine 1 now provides one continuous discovery workspace for public market signals before supplier selection or profitability approval. The workbench preserves the existing evidence-bound recommendation engine while adding the useful discovery workflow commonly found in Korean commerce-research tools: keyword ranking, shopping-content review, channel monitoring, price observations, and handoff to Item Selection.

This is an original implementation. It does not copy another service's source code, visual identity, wording, or proprietary scoring. Public product behavior was used only as a benchmark for information architecture and workflow coverage.

## Runtime flow

1. The existing scheduled collectors gather approved Naver, YouTube, and DataForSEO evidence.
2. `market_keyword_signal_snapshots` retains source observations and public content metadata.
3. The autonomous discovery engine produces evidence-bound opportunity metrics and recommendations.
4. `/api/market/finder` assembles keyword, content, channel, and price views without changing operational rankings.
5. `/market/finder` lets an authenticated operator inspect the evidence and hand a selected keyword to Engine 2 or the supplier-sourcing engine.
6. New watchlist keywords immediately gain idempotent, bounded Naver (6h), YouTube (12h), and DataForSEO (24h) collection jobs.

## Workbench views

- **Keyword analysis**: demand, momentum, shopping intent, competition headroom, content velocity, confidence, observed seasonality, price samples, and YouTube landscape.
- **Shopping-content radar**: public source cards, detected product phrases, engagement evidence, and source links.
- **Channel monitor**: observed channels ranked by collected public content and engagement.
- **Overseas content**: separates non-KR channels only when the YouTube channel country is explicitly supplied; missing countries remain unknown.
- **Watchlists and alerts**: category folders, provider health, breakout/content-surge/evidence-gap alerts, and secured keyword registration.
- **Discovery candidates**: the existing evidence-bound recommendations and direct Item Selection handoff.
- **Repeated-product clusters**: deterministic grouping of extracted product phrases across content, with direct profitability and supplier-comparison handoff.
- **Research export**: current filtered public metadata can be exported as UTF-8 CSV for an operator-owned research packet.

## Evidence and rights boundaries

- Public content is reference-only. Its thumbnail, title, or media is not publication-rights evidence.
- Twelve-month seasonality is shown only when twelve distinct observed months exist. Partial history is labelled as building; it is never fabricated.
- Missing provider coverage remains visible and does not become synthetic evidence.
- Country, product phrase, and cluster labels are discovery aids, not verified catalog identity.
- The workbench does not change Item Selection scores, purchasing, listing, pricing, inventory, or commerce execution.
- Supplier, rights, profitability, and operational approval continue in their canonical downstream engines.

## Reusable learning

Discovery UIs should reduce research fragmentation without weakening evidence semantics. The reusable pattern is: preserve raw source observations, derive deterministic view models, label incomplete histories honestly, and hand off candidate intent without promoting it to an execution decision.

The v2 learning is that deeper discovery does not require multiplying paid or quota-heavy calls. The existing bounded YouTube request can request channel country and video description/tags in the same metadata calls, then build domestic/overseas lanes, clusters, filters, and alerts locally. New watchlist entries must create their provider schedules at registration time; a keyword without jobs is not an active watchlist.
