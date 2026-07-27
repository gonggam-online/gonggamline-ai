# Proposed baseline replay order

This is a dependency proposal for a brand-new isolated Supabase project. It is
not an executable runbook and does not authorize SQL execution or migration
creation.

## Official migration candidates

| Dependency order | Candidate source | Reason |
|---:|---|---|
| 1 | Recovered Products baseline, authoritative SQL Editor name unresolved | Creates `public.products`, required by Product workflow and current Git migration 003 |
| 2 | `002_core_schema` | Creates the six Commerce OS tables and their internal dependencies |
| 3 | `002_product_workflow` | Alters `public.products`; requires the Products baseline |
| 4 | `003_dev_rls` — historical fidelity only | Requires all six Commerce OS tables |
| 5 | Git `003_coupang_competition_analysis.sql` | Alters `public.products`; requires Products baseline |
| 6 | Git `004_automatic_competition_pipeline.sql` | Extends competition fields from Git 003 |
| 7–22 | Git migrations `005` through `020` | Existing dependency chain |

`002_core_schema` and the Product chain are independent because its
`product_id` fields intentionally have no Product foreign keys. Their relative
historical execution order is not proven without SQL Editor timestamps.

## Verification sequence

These scripts are evidence checks, never official migrations:

1. `001_preflight` before DDL.
2. `001_preflight_check` before DDL.
3. `002_core_schema_check` after the core schema candidate.
4. `004_verify` after the core schema and historical RLS candidate.

## Production-security gate

The verbatim `003_dev_rls` source grants unrestricted CRUD to `anon` and
`authenticated`. It may be retained and tested only as historical evidence in
an isolated recovery environment. It must not be deployed as the current
Production policy.

A Production replay needs a separately approved least-privilege RLS migration.
That future policy is not reconstructed or proposed here.

## Unresolved chronology

The proposed order is derived from SQL dependencies and operator-provided entry
names. SQL Editor timestamps are unavailable, so exact execution order,
reruns, edits, and cross-environment consistency remain unproven.

## Recommended restoration step

Collect timestamped SQL Editor export metadata and read-only deployed catalog
and migration-history output. Then compare every candidate object and classify
it as exact, compatible, incompatible, or absent before drafting any official
migration or migration-history repair.
