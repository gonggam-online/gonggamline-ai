-- READ ONLY. Sanitized catalog evidence for R3 architecture/discovery only.
-- Never use this query to repair migration history or mutate a database.

\set ON_ERROR_STOP on

BEGIN READ ONLY;

SELECT 'migration_history' AS category,
       'supabase_migrations' AS schema_name,
       'schema_migrations' AS parent_name,
       coalesce(to_regclass('supabase_migrations.schema_migrations')::text, 'ABSENT') AS object_name,
       CASE
         WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN 'ABSENT'
         ELSE 'PRESENT'
       END AS definition
UNION ALL
SELECT 'relation', n.nspname, c.relname, c.relkind::text,
       concat_ws('|', pg_get_userbyid(c.relowner), c.relrowsecurity::text,
                 c.relforcerowsecurity::text,
                 coalesce(array_to_string(c.relacl, ','), ''))
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'products',
    'item_selection_runs',
    'item_selection_evaluations',
    'security_audit_events',
    'product_mutation_requests'
  )
UNION ALL
SELECT 'function', n.nspname, p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid),
       concat_ws('|', pg_catalog.pg_get_userbyid(p.proowner),
                 p.prosecdef::text,
                 coalesce(array_to_string(p.proconfig, ','), ''),
                 md5(pg_catalog.pg_get_functiondef(p.oid)))
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_item_selection_run_v1',
    'finalize_item_selection_run_v1',
    'product_mutation_claim_v1',
    'product_mutation_complete_v1',
    'import_product_v1',
    'patch_product_operator_fields_v1',
    'record_product_competition_v1',
    'record_manual_competition_analysis_v1',
    'record_automatic_competition_analysis_v1'
  )
UNION ALL
SELECT 'policy', schemaname, tablename, policyname,
       concat_ws('|', permissive, array_to_string(roles, ','), cmd,
                 coalesce(qual, ''), coalesce(with_check, ''))
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'products',
    'item_selection_runs',
    'item_selection_evaluations',
    'security_audit_events',
    'product_mutation_requests'
  )
UNION ALL
SELECT 'extension', extnamespace::regnamespace::text, extname, extversion, ''
FROM pg_catalog.pg_extension
UNION ALL
SELECT 'public_table_count', 'public', 'tables', 'count', count(*)::text
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY category, schema_name, parent_name, object_name, definition;

ROLLBACK;
