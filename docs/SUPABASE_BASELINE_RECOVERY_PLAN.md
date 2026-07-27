# Supabase baseline recovery evidence plan

## Status and safety

This is a read-only evidence package. No SQL was executed, no external system
was contacted, and no file under `supabase/migrations` or application runtime
code was changed.

The work is high-risk because it concerns missing migration history, RLS,
deployed-schema reconciliation, functions, triggers, and future database replay.
No migration restoration is authorized by this document.

## Sources and provenance

Three complete operator-supplied candidates are preserved under
`supabase/recovery-sources`:

1. `products-baseline.sql`: chat evidence.
2. `product-workflow-extension.sql`: the first complete chat evidence block.
3. `commerce-os-core-schema.sql`: attached evidence titled Commerce OS v4.0.

The operator supplied a second Product workflow block with the same columns,
constraints, allowed values, and indexes but different line wrapping. The
source file preserves the first complete block. This duplicate is evidence of
repeat execution or copy duplication; chronology is not proven.

The earlier Commerce OS summary named three tables, while the complete attached
source creates six tables plus a function and triggers. The complete source is
preserved without reducing its scope.

## Statement inventory

### Products baseline

Execution order:

1. `CREATE TABLE IF NOT EXISTS public.products`
2. `ALTER TABLE public.products ENABLE ROW LEVEL SECURITY`
3. `CREATE POLICY "Allow public read products"` for `anon` `SELECT`
4. `CREATE POLICY "Allow public insert products"` for `anon` `INSERT`
5. `CREATE POLICY "Allow public update products"` for `anon` `UPDATE`

The source contains five top-level statements. The table defines 25 columns,
an identity primary key on `id`, and a unique
constraint on `product_no`. It does not define an `updated_at` trigger.

### Product workflow extension

Execution order:

1. Add ten Product columns with `IF NOT EXISTS`.
2. Drop and recreate `products_review_status_check`.
3. Drop and recreate `products_risk_level_check`.
4. Drop and recreate `products_ai_analysis_status_check`.
5. Create `products_review_status_idx`.
6. Create `products_is_favorite_idx`.
7. Create `products_ai_score_idx`.
8. Create `products_updated_at_idx`.

The source contains eleven top-level statements: one column-extension
statement, three constraint drops, three constraint additions, and four index
creations.

### Commerce OS core

The source contains an explicit `BEGIN`/`COMMIT` transaction.
It contains eighteen top-level statements when each `DO` block is counted as
one: transaction start, six table creations, one conditional-FK block, seven
index creations, one function definition, one trigger-creation block, and
transaction commit. The two `DO` blocks contain one conditional foreign-key
addition and four conditional trigger creations.

Tables, in source order:

1. `fulfillment_providers`
2. `commerce_projects`
3. `commerce_project_components`
4. `competition_analyses`
5. `inbound_orders`
6. `inventory_balances`

Dependencies:

- `commerce_project_components.project_id` -> `commerce_projects.id`
- `competition_analyses.project_id` -> `commerce_projects.id`
- `inbound_orders.project_id` -> `commerce_projects.id`
- `inbound_orders.provider_id` -> `fulfillment_providers.id`
- `inventory_balances.project_id` -> `commerce_projects.id`
- `inventory_balances.provider_id` -> `fulfillment_providers.id`
- Conditional `commerce_projects.selected_provider_id` ->
  `fulfillment_providers.id`
- `product_id` fields intentionally have no Product foreign key.

Additional objects:

- Seven explicit indexes.
- `public.set_updated_at()` trigger function, created or replaced.
- Four conditionally created `BEFORE UPDATE` triggers.
- No RLS enablement or policies. The source comment says these belong in a
  separate `003` file, but the repository's current `003` is Product
  competition SQL and contains no Commerce OS RLS. The referenced historical
  RLS source is therefore missing or misnumbered.

## Existing migration inventory and dependency map

The repository begins at `003_coupang_competition_analysis.sql` and continues
sequentially through `020_sprint2_runtime_execution.sql`.

| Migration | Creates/alters | Direct recovered dependency |
|---|---|---|
| 003 | Alters `products`; adds two indexes and Product checks | Products baseline; requires `updated_at` |
| 004 | Alters `products`; adds one index and checks | 003 and Products baseline |
| 005 | Seven Market tables; `pgcrypto` | `products.id` for `market_model_feedback` |
| 006 | Two Market analytics tables | 005 |
| 007 | Four orchestration tables | `products.id`, 005, 006 |
| 008 | Two warehouse tables; alters metrics | `products.id`, 007 |
| 009 | Three discovery tables | 008 |
| 010 | Three supplier tables | 009 |
| 011 | Five procurement/workflow tables | 009 and 010 |
| 012 | Two listing tables; alters workflows | 011 |
| 013 | Three workflow tables; alters workflows | 012 |
| 014 | Three Coupang tables; alters workflows | 013 |
| 015 | AI decision table; alters recommendations | 014 |
| 016 | Four Company OS tables; alters decisions | 015 |
| 017 | Two command/notification tables | 016 |
| 018 | Five enterprise tables | 017 |
| 019 | Three Revenue/runtime tables | 018 |
| 020 | Runtime event table; alters jobs | 019 |

No migration from 003 through 020 references the six recovered Commerce OS
tables or `public.set_updated_at()`. Their placement relative to Products
cannot be proven from repository dependencies alone.

## Exact conflicts, duplicates, and unknowns

### Confirmed non-conflicts

- Product workflow column names do not overlap columns added by 003 or 004.
- Recovered Product workflow index names do not overlap indexes in 003-020.
- The six Commerce OS table names do not overlap tables created in 003-020.
- Migrations 003-020 create no functions or triggers.

### Confirmed duplicate/replay hazards

- Products policies use plain `CREATE POLICY`; replay fails if policies with
  the same names already exist.
- Product workflow drops and recreates three constraints, which changes
  deployed schema state on every execution.
- Commerce OS uses `CREATE OR REPLACE FUNCTION public.set_updated_at()`;
  replay can overwrite a deployed function with the same signature.
- Commerce OS trigger guards test trigger name globally, not table plus name.
  A same-named trigger on another table could suppress intended creation.
- `CREATE TABLE IF NOT EXISTS` does not prove an existing table's columns,
  types, defaults, constraints, or RLS match the recovered definition.
- The Product workflow SQL was supplied twice in semantically equivalent form.
  Whether it was executed once or more is unknown.

### Unknown until deployed evidence exists

- Actual table definitions, identity state, constraints, indexes, RLS, grants,
  policies, functions, and triggers.
- Whether `public.set_updated_at()` already exists with different behavior.
- Whether the Commerce OS tables ever received the separately referenced RLS.
- SQL Editor execution dates and order.
- Migration-history versions corresponding to the recovered SQL.
- Whether SQL Editor execution was recorded in
  `supabase_migrations.schema_migrations`.
- Whether Preview and Production schemas differ.
- Whether Product policy access for `anon` remains owner-approved.

## Encoding inspection

The current UTF-8 bytes of migration 003 contain the valid SQL literal
`'미분석'` as both the default and an allowed check value. The file does not
contain a replacement character or malformed quote in those statements.

All non-ASCII SQL literals in later migrations were decoded successfully as
valid UTF-8 during this analysis. They occur in seed/display data in migrations
007 and 016-020. No encoding-corrupted SQL literal was proven in migrations
003-020.

Mojibake observed in some terminal output is therefore a display/decoding-path
problem, not evidence that the checked-in UTF-8 SQL bytes are corrupt. This
finding must be rechecked from raw bytes if another checkout produces different
hashes.

## Plan A: fresh-database replay

No replay is authorized yet.

Provisional dependency order:

1. Products baseline.
2. Product workflow extension.
3. Commerce OS core may run before or after Products because its `product_id`
   fields intentionally lack Product foreign keys.
4. Existing migrations 003 through 020 in numeric order.
5. Any missing Commerce OS RLS source, only after it is recovered verbatim and
   approved.

Final filenames and migration numbers cannot be assigned until SQL Editor
chronology and deployed migration-history versions are supplied. The three
sources must not simply be renamed `000`, `001`, and `002` based on inference.

Before an isolated fresh replay:

1. Compare source statements with deployed catalog evidence.
2. Recover the missing Commerce OS RLS source or explicitly record its absence.
3. Confirm historical ordering and migration version format.
4. Review permissive Product `anon` write policies as a security boundary.
5. Execute only in an isolated disposable database under a separately approved
   high-risk Story.
6. Verify every object using the read-only inspection output.

## Plan B: existing deployed-database history reconciliation

Do not execute recovered DDL blindly against an existing deployment.

Required sequence:

1. Operator runs both read-only inspection scripts in each intended Supabase
   environment.
2. Capture SQL Editor chronology and exact historical source text.
3. Compare every recovered object with deployed definitions.
4. Classify each object as exact match, compatible difference, incompatible
   difference, or absent.
5. Decide separately whether schema repair, migration-history repair, or both
   are required.
6. Prepare an owner-approved, environment-specific runbook with backup,
   rollback, verification, and Preview/Production ordering.
7. Reconcile `supabase_migrations.schema_migrations` only through an approved
   Supabase migration-history repair mechanism; never by assumed inserts.
8. Re-run read-only catalog inspection and application/browser verification.

## Read-only evidence queries

- `supabase/recovery-sources/schema-inspection.sql` inventories public tables,
  columns, constraints, indexes, RLS state, policies, functions, and triggers.
- `supabase/recovery-sources/migration-history-inspection.sql` locates and reads
  the Supabase migration-history relation.

These queries were not executed during package preparation.

## Stop conditions

Restoration remains blocked until the operator provides:

- SQL Editor chronology for all recovered scripts;
- complete deployed inspection output for each environment;
- exact migration-history rows and version format;
- the Commerce OS RLS SQL referenced by the recovered source, or an explicit
  owner decision that it never existed;
- approval for any policy/security difference;
- resolution of every non-exact deployed-schema comparison.
