# SQL Editor baseline export plan

## Objective

Preserve the operator-provided SQL Editor baseline as evidence and map it to
the Git migration chain without executing SQL, modifying
`supabase/migrations`, contacting Supabase, or changing application behavior.

This is a high-risk database-provenance evidence task. The exported files are
not executable migrations and do not authorize restoration.

## Evidence boundary

The seven verbatim sources are stored in
`supabase/recovery-sources/sql-editor-export/`. SQL text is separated from
analysis so historical statements, formatting, comments, and unsafe policies
remain unchanged.

| SQL Editor entry | Source classification | Migration eligibility |
|---|---|---|
| `001_preflight` | Read-only environment/object diagnostics | Never an official migration |
| `001_preflight_check` | Read-only table-existence check | Never an official migration |
| `002_core_schema` | Commerce OS DDL baseline | Historical migration candidate |
| `002_core_schema_check` | Read-only function/trigger check | Never an official migration |
| `002_product_workflow` | Product workflow DDL | Historical migration candidate |
| `003_dev_rls` | Development RLS DDL | Historical migration candidate only |
| `004_verify` | Read-only table/policy/row-count verification | Never an official migration |

## Preservation process

1. Preserve each operator block under its confirmed SQL Editor entry name.
2. Compare duplicated recovered sources byte-for-byte after accounting only for
   repository line-ending representation.
3. Record source hashes for review; do not edit source text to resolve
   differences.
4. Keep all exports outside `supabase/migrations`.
5. Use dependency analysis to propose replay order; do not treat names as proof
   of execution timestamps.
6. Require deployed-schema and migration-history inspection before any
   restoration Story.

## Historical fidelity versus current security

`003_dev_rls.sql` must remain verbatim for historical fidelity. Its six
policies grant `FOR ALL` to both `anon` and `authenticated` with unconditional
`USING (true)` and `WITH CHECK (true)`.

That policy is explicitly unacceptable for Production. Historical recovery
does not authorize deploying it. A current Production RLS design requires a
separate approved high-risk Architecture Story, ownership model, least-
privilege policies, tests, rollout, and rollback.

## Completion criteria

- Seven source files exist and match operator evidence.
- SQL Editor-to-Git mapping is explicit.
- Diagnostic/check scripts are separated from DDL candidates.
- Dependency-based replay order and uncertainty are documented.
- Missing chronology and deployed evidence are recorded.
- Protected migration/application paths remain unchanged.
- No SQL or Supabase operation occurs.
