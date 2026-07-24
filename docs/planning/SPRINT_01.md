# Sprint 01 — Evidence-ranked revenue opportunities

## Goal and value

Turn existing market, competition, and revenue data into a review queue that makes the fastest defensible go/no-go decision. Success means the owner can identify why an opportunity ranks highly without marketplace writes.

## Scope

- Define freshness, demand, competition, margin-confidence, and evidence-completeness fields.
- Read-only ranked opportunity API and dashboard filters.
- Explicit unavailable/stale states and decision evidence.
- Safe API and browser contract tests.

Non-goals: new migration without baseline verification, automated approval, pricing change, collection purchase, or listing.

## Dependencies and surfaces

Data: `market_*`, `ai_*recommendations`, `revenue_opportunities`; first verify schema provenance. API: extend existing read contracts compatibly or add a read endpoint. UI: `/revenue` and `/discovery`. DB: no change in first PR; a separately approved schema PR only if essential.

## Tickets / recommended PR order

1. S1-01 (S): schema/query contract inventory and sample-data readiness report.
2. S1-02 (S): pure typed ranking policy with unit fixtures.
3. S1-03 (M): read service/API integration preserving current envelopes.
4. S1-04 (M): evidence UI, stale/unavailable states, accessibility.
5. S1-05 (S): safe API/E2E manifest and Preview validation.

## Risks and done

Ranking/margin behavior can affect financial decisions and becomes high-risk if calculation semantics change. Done when inputs and assumptions are visible, deterministic tests cover edge cases, no write is automatic, all gates pass, and owner validation uses representative data.
