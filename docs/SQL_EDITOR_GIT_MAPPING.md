# SQL Editor to Git migration mapping

## Mapping

| SQL Editor name | Git migration equivalent | Recovered | Missing | Proposed order | Purpose | Risk if missing |
|---|---|---:|---:|---:|---|---|
| `001_preflight` | None; diagnostics only | Yes | No | Check 1 | Environment, object, and extension inspection | Loss of preflight evidence; no schema replay impact |
| `001_preflight_check` | None; diagnostics only | Yes | No | Check 2 | Table-existence verification | Loss of verification evidence; no schema replay impact |
| `002_core_schema` | No current Git equivalent | Yes | No | DDL 2 | Six Commerce OS tables, seven indexes, one function, four triggers, one conditional FK | Commerce OS baseline cannot be reproduced |
| `002_core_schema_check` | None; diagnostics only | Yes | No | Check 3 | Verify `set_updated_at` and four triggers | Function/trigger drift may go undetected |
| `002_product_workflow` | Missing historical `002_product_workflow.sql`; referenced by `README-v2.0.md` | Yes | No | DDL 3 | Product workflow columns, constraints, and indexes | Product UI/API contracts and later Product analysis are incomplete |
| `003_dev_rls` | No current Git equivalent | Yes | No | DDL 4, historical only | Enable RLS and create six permissive development policies | Historical state is incomplete; replaying it in Production creates critical over-permission |
| `003_coupang_competition_analysis` | `003_coupang_competition_analysis.sql` | Yes in Git | No | DDL 5 | Product competition fields, checks, and indexes | Competition analysis schema is incomplete |
| `004_verify` | None; verification only | Yes | No | Check 4 | Verify Commerce OS tables, policies, and row counts | Post-DDL evidence is unavailable; no schema replay impact |
| `004_automatic_competition` | `004_automatic_competition_pipeline.sql` | Yes in Git | No | DDL 6 | Automatic Product competition pipeline fields/checks/index | Automated competition state is incomplete |
| `005_market_intelligence_engine` | `005_market_intelligence_engine.sql` | Yes in Git | No | DDL 7 | Market Intelligence baseline | Later market chain cannot replay |
| `006_market_analysis` | `006_market_intelligence_analytics.sql` | Yes in Git | No | DDL 8 | Market analytics and metrics | Later orchestration cannot replay |
| `007`–`020` | Current Git migrations `007`–`020` | Yes in Git | No | DDL 9–22 | Existing sequential domain/runtime chain | Later schema dependencies fail |

## Additional prerequisite without a confirmed SQL Editor name

The recovered `products-baseline.sql` creates `public.products`, enables its
RLS, and creates three Product policies. It is required before
`002_product_workflow` and Git migration `003`, but the supplied SQL Editor
entry list does not assign it an authoritative entry name or timestamp.

It must remain an explicit unresolved prerequisite rather than being silently
renamed or inserted into the numbered export.

## Exact determinations

1. `003_dev_rls` is the missing Commerce OS RLS source referenced by the
   `002_core_schema` comment: it targets exactly the six created tables.
2. `004_verify` contains only `SELECT` statements and is verification-only.
3. `001_preflight` contains only read-only catalog/environment queries.
4. `001_preflight_check` contains only a read-only table-existence query.
5. The preserved `002_core_schema` text matches the previously recovered
   Commerce OS core source after line-ending normalization.
6. `002_core_schema_check` contains only read-only function/trigger queries.
7. DDL candidates are `002_core_schema`, `002_product_workflow`, and
   historically `003_dev_rls`; the unnumbered Products baseline is also a
   required baseline candidate.
8. `001_preflight`, `001_preflight_check`, `002_core_schema_check`, and
   `004_verify` must never become official migrations because they only inspect
   state.

## Chronology confidence

The entry names establish an operator-confirmed label sequence, and dependency
analysis establishes prerequisites. Exact historical execution chronology is
not proven because SQL Editor timestamps/export metadata were not supplied.
