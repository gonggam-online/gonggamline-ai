# Supabase deployed inspection runbook

## Safety boundary

This runbook collects catalog evidence only. Every numbered source under
`supabase/recovery-sources/deployed-inspection/` contains `SELECT` statements
only. Do not run restoration SQL, reveal credentials, or paste raw commercial
records. Codex does not run these queries or contact Supabase.

## Operator execution order

Run each file separately in Supabase Dashboard → SQL Editor for one environment
at a time:

1. `001_environment.sql`
2. `002_tables_columns.sql`
3. `003_constraints.sql`
4. `004_indexes.sql`
5. `005_rls_policies.sql`
6. `006_functions_triggers.sql`
7. `007_extensions.sql`
8. `008_migration_metadata_discovery.sql`
9. `009_row_counts.sql`
10. `010_products_schema.sql`
11. `011_commerce_os_schema.sql`
12. `012_market_engine_schema.sql`
13. `013_schema_fingerprint.sql`

For each file, copy every result grid, including headers, into the corresponding
template section. If a file returns multiple grids, preserve the result-set
comment as the grid label.

## Evidence label

Prepend every supplied result with:

- environment: Production, Preview, Staging, or Local;
- file name and result-set label;
- SQL Editor execution date/time with time zone;
- Supabase project name;
- Supabase branch/environment name;
- part number, such as `part 1 of 3`, for split output.

Large results may be split only at row boundaries. Repeat the column header in
every part. Preserve row order. Do not replace or omit `NULL`; use the literal
marker shown by SQL Editor. Preserve default expressions, arrays (including
policy role arrays), JSON, quotes, braces, and whitespace inside returned
definitions. Export CSV where practical and do not use spreadsheet
auto-conversion.

## Data handling

The package returns catalog definitions and aggregate estimates, not business
rows. Before sharing, inspect the output for project URLs, API keys, tokens,
connection strings, credentials, or commercial values and remove the entire
affected result rather than editing a value silently. Report the omission.

`008_migration_metadata_discovery.sql` lists candidate metadata relations and
their columns. It intentionally does not read rows from an unknown candidate.
After review identifies the actual migration runner and safe columns, a
separate approved evidence request is required for metadata rows.

No baseline, policy, history-repair, or restoration statement may be run during
this phase.
