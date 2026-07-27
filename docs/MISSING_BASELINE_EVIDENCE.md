# Missing baseline evidence

## Source recovery status

All seven requested SQL Editor entry bodies are now recovered verbatim:

- `001_preflight`
- `001_preflight_check`
- `002_core_schema`
- `002_core_schema_check`
- `002_product_workflow`
- `003_dev_rls`
- `004_verify`

No requested SQL body remains missing.

## Evidence still missing

1. SQL Editor creation/execution timestamps for all entries.
2. The authoritative SQL Editor entry name and timestamp for the recovered
   Products baseline.
3. Exact deployed `supabase_migrations.schema_migrations` rows and version
   format for each environment.
4. Read-only deployed schema output for tables, columns, constraints, indexes,
   RLS state, policies, functions, and triggers.
5. Evidence of whether SQL Editor entries were executed in Preview,
   Production, both, or another project.
6. Proof that the recovered sources exactly match every executed revision if
   an SQL Editor entry was edited and rerun.
7. A Production-safe ownership and authorization model replacing the
   development-wide Commerce OS policies.
8. Owner approval for the existing Product `anon` insert/update policies.

## Consequence

The package can propose dependency order and candidate classification, but
cannot claim 100% historical chronology, deployed equivalence, or a safe
Production restoration plan. No migration number should be finalized until
the missing evidence is supplied.
