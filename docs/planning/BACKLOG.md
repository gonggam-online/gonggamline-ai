# Prioritized backlog

| Order | Ticket | Size | Risk | Dependency / completion signal |
|---|---|---|---|---|
| 1 | Recover and verify pre-003 schema baseline | M | High | Owner supplies authoritative history; live schema diff is clean |
| 2 | Add read-only deployed-schema compatibility check | M | High | Approved CI credential and no secret output |
| 3 | S1-01 opportunity data readiness inventory | S | Normal | Tables/fields/freshness documented |
| 4 | S1-02 pure opportunity ranking policy | S | High if margin semantics change | Owner-approved assumptions, deterministic tests |
| 5 | Expand safe read API smoke manifest | S | Normal | All selected routes are mutation-free |
| 6 | Replace generic root README | XS | Low | Commands/domains/safety links accurate |
| 7 | Incrementally replace `select("*")` | M | Normal | One bounded context per PR, contract tests |
| 8 | Generate Supabase types | M | Normal after schema verification | Baseline authoritative |
| 9 | Supplier evidence/freshness audit | S | Normal | Sprint 01 decision contract stable |
| 10 | Versioned landed-cost scenario engine | M | High | Financial assumptions approved |
| 11 | Listing content fact and policy contract | S | Normal | Supplier/category evidence ready |
| 12 | Mutation endpoint idempotency inventory | M | High | No Production calls; domain keys proposed |
| 13 | Unified audit/correlation design | L | High | Auth/actor requirements approved |
| 14 | Collector/Coupang rate-limit contract tests | M | High | Fake adapters and documented limits |
| 15 | Inventory/order/settlement reconciliation design | XL | High | External API/data ownership confirmed |
