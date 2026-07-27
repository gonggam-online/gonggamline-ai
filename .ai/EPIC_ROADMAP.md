# Architecture roadmap: Epics 4-9

This roadmap documents sequence and architecture questions only. It authorizes
no feature, schema, Queue, marketplace write, or external integration.

| Epic | Outcome | Architecture work required before implementation |
|---|---|---|
| 4: Product Operations Platform | Govern Product operational state and operator workflows | Domain ownership, lifecycle, source of truth, approval boundaries, data/API contracts |
| 5: Workspace | Provide an operator workspace over approved Product operations | Consumer journeys, read/write boundaries, permissions, DTOs, failure and recovery states |
| 6: Content Generation | Produce traceable commerce content drafts | prompt/input provenance, model boundary, versioning, review/approval, safety, cost and observability |
| 7: Upload Queue | Schedule approved listing uploads reliably | Queue state machine, typed payload, idempotency, retry/lock rules, operator recovery, capacity |
| 8: Coupang Integration | Connect approved operations to Coupang | adapter contract, credentials/permissions, sandbox strategy, rate limits, reconciliation, rollback |
| 9: Sales Intelligence | Turn sales evidence into prioritized decisions | metric definitions, data provenance/freshness, financial ownership, explainability, feedback loops |

## Dependency sequence

Epic 4 establishes Product operational ownership. Epic 5 consumes that model.
Epic 6 produces reviewed content. Epic 7 moves approved payloads. Epic 8 owns
the marketplace adapter. Epic 9 measures outcomes and informs priorities
without silently changing them.

Each Epic begins with one or more Architecture Stories using
[`STORY_TEMPLATE.md`](STORY_TEMPLATE.md). Business priority, acceptance
criteria, and approval remain AI CTO/owner decisions.

## Pre-Epic first-sale dependency

The approved
[Domeggook Read-only Supplier Catalog Adapter v1](../docs/architecture/DOMEGGOOK-READONLY-SUPPLIER-CATALOG-ADAPTER-V1.md)
establishes the minimum read-only sourcing boundary before later Product
Operations work. It adds no Epic scope and authorizes no Product feature,
database, Queue, bulk collection, or supplier order.
