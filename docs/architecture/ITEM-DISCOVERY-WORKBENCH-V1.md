# Item Discovery Workbench v1

## Purpose

Engine 1 now provides one continuous discovery workspace for public market signals before supplier selection or profitability approval. The workbench preserves the existing evidence-bound recommendation engine while adding the useful discovery workflow commonly found in Korean commerce-research tools: keyword ranking, shopping-content review, channel monitoring, price observations, and handoff to Item Selection.

This is an original implementation. It does not copy another service's source code, visual identity, wording, or proprietary scoring. Public product behavior was used only as a benchmark for information architecture and workflow coverage.

## Runtime flow

1. The existing scheduled collectors gather approved Naver, YouTube, and DataForSEO evidence.
2. `market_keyword_signal_snapshots` retains source observations and public content metadata.
3. The autonomous discovery engine produces evidence-bound opportunity metrics and recommendations.
4. `/api/market/finder` assembles keyword, content, channel, and price views without changing operational rankings.
5. `/market/finder` lets an authenticated operator inspect the evidence and hand a selected keyword to Engine 2.

## Workbench views

- **Keyword analysis**: demand, momentum, shopping intent, competition headroom, content velocity, confidence, observed seasonality, price samples, and YouTube landscape.
- **Shopping-content radar**: public source cards, detected product phrases, engagement evidence, and source links.
- **Channel monitor**: observed channels ranked by collected public content and engagement.
- **Discovery candidates**: the existing evidence-bound recommendations and direct Item Selection handoff.

## Evidence and rights boundaries

- Public content is reference-only. Its thumbnail, title, or media is not publication-rights evidence.
- Twelve-month seasonality is shown only when twelve distinct observed months exist. Partial history is labelled as building; it is never fabricated.
- Missing provider coverage remains visible and does not become synthetic evidence.
- The workbench does not change Item Selection scores, purchasing, listing, pricing, inventory, or commerce execution.
- Supplier, rights, profitability, and operational approval continue in their canonical downstream engines.

## Reusable learning

Discovery UIs should reduce research fragmentation without weakening evidence semantics. The reusable pattern is: preserve raw source observations, derive deterministic view models, label incomplete histories honestly, and hand off candidate intent without promoting it to an execution decision.
