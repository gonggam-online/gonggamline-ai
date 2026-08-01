\set ON_ERROR_STOP on

BEGIN READ ONLY;

SELECT 'migration' AS category,
       'supabase_migrations' AS schema_name,
       'schema_migrations' AS parent_name,
       version AS object_name,
       name AS definition
FROM supabase_migrations.schema_migrations
UNION ALL
SELECT 'relation', n.nspname, c.relname, c.relname,
       concat_ws('|', c.relkind::text, pg_get_userbyid(c.relowner),
                 c.relrowsecurity::text, c.relforcerowsecurity::text,
                 coalesce(array_to_string(c.relacl, ','), ''))
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN (
  'products', 'product_mutation_requests', 'security_audit_events'
)
UNION ALL
SELECT 'policy', schemaname, tablename, policyname,
       concat_ws('|', permissive, array_to_string(roles, ','), cmd,
                 coalesce(qual, ''), coalesce(with_check, ''))
FROM pg_catalog.pg_policies
WHERE schemaname = 'public' AND tablename = 'products'
UNION ALL
SELECT 'relation_acl', n.nspname, c.relname,
       coalesce(grantee.rolname, 'PUBLIC'), privilege_type
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(c.relacl, pg_catalog.acldefault(CASE c.relkind
    WHEN 'S' THEN 's'::"char" ELSE 'r'::"char" END, c.relowner))
) acl
LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid = acl.grantee
WHERE n.nspname = 'public' AND c.relname = 'products'
UNION ALL
SELECT 'relation_privilege_state', 'public', 'products', role_name,
       privilege_name || '|' ||
       CASE WHEN role_name = 'PUBLIC' THEN EXISTS (
         SELECT 1
         FROM pg_catalog.aclexplode(coalesce(c.relacl,
           pg_catalog.acldefault('r', c.relowner))) public_acl
         WHERE public_acl.grantee = 0
           AND public_acl.privilege_type = privilege_name
       ) ELSE has_table_privilege(role_name, c.oid, privilege_name) END::text
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN unnest(ARRAY['PUBLIC','anon','authenticated','service_role']) role_name
CROSS JOIN unnest(ARRAY[
  'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
]) privilege_name
WHERE n.nspname = 'public' AND c.relname = 'products'
UNION ALL
SELECT 'function', n.nspname, p.proname,
       pg_catalog.oidvectortypes(p.proargtypes),
       concat_ws('|', pg_catalog.pg_get_userbyid(p.proowner),
                 p.prosecdef::text,
                 coalesce(array_to_string(p.proconfig, ','), ''),
                 coalesce(array_to_string(p.proacl, ','), ''))
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'product_mutation_claim_v1',
  'product_mutation_complete_v1',
  'import_product_v1',
  'patch_product_operator_fields_v1',
  'record_product_competition_v1',
  'record_manual_competition_analysis_v1',
  'record_automatic_competition_analysis_v1'
)
UNION ALL
SELECT 'function_acl', n.nspname, p.proname,
       pg_catalog.oidvectortypes(p.proargtypes),
       concat_ws('|', coalesce(grantee.rolname, 'PUBLIC'), privilege_type)
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
) acl
LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid = acl.grantee
WHERE n.nspname = 'public' AND p.proname IN (
  'product_mutation_claim_v1',
  'product_mutation_complete_v1',
  'import_product_v1',
  'patch_product_operator_fields_v1',
  'record_product_competition_v1',
  'record_manual_competition_analysis_v1',
  'record_automatic_competition_analysis_v1'
)
UNION ALL
SELECT 'function_privilege_state', 'public', p.proname,
       pg_catalog.oidvectortypes(p.proargtypes),
       role_name || '|EXECUTE|' || CASE WHEN role_name = 'PUBLIC' THEN EXISTS (
         SELECT 1
         FROM pg_catalog.aclexplode(coalesce(p.proacl,
           pg_catalog.acldefault('f', p.proowner))) public_acl
         WHERE public_acl.grantee = 0
           AND public_acl.privilege_type = 'EXECUTE'
       ) ELSE has_function_privilege(role_name, p.oid, 'EXECUTE') END::text
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN unnest(ARRAY['PUBLIC','anon','authenticated','service_role']) role_name
WHERE n.nspname = 'public' AND p.proname IN (
  'product_mutation_claim_v1',
  'product_mutation_complete_v1',
  'import_product_v1',
  'patch_product_operator_fields_v1',
  'record_product_competition_v1',
  'record_manual_competition_analysis_v1',
  'record_automatic_competition_analysis_v1'
)
UNION ALL
SELECT 'default_acl', coalesce(n.nspname, '*'), owner.rolname,
       d.defaclobjtype::text,
       concat_ws('|', coalesce(grantee.rolname, 'PUBLIC'), privilege_type)
FROM pg_catalog.pg_default_acl d
JOIN pg_catalog.pg_roles owner ON owner.oid = d.defaclrole
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) acl
LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid = acl.grantee
WHERE n.nspname = 'public' OR d.defaclnamespace = 0
UNION ALL
SELECT 'default_acl_state', 'public', creators.rolname, object_type.code::text,
       coalesce(array_to_string(d.defaclacl, ','),
         array_to_string(pg_catalog.acldefault(object_type.code, creators.oid), ','))
FROM (
  SELECT DISTINCT owner.oid, owner.rolname
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_roles owner ON owner.oid = c.relowner
  WHERE n.nspname = 'public'
  UNION
  SELECT DISTINCT owner.oid, owner.rolname
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_roles owner ON owner.oid = p.proowner
  WHERE n.nspname = 'public'
) creators
CROSS JOIN (VALUES ('r'::"char"), ('S'::"char"), ('f'::"char")) object_type(code)
LEFT JOIN pg_catalog.pg_default_acl d
  ON d.defaclrole = creators.oid
 AND d.defaclnamespace = 'public'::regnamespace
 AND d.defaclobjtype = object_type.code
UNION ALL
SELECT 'public_owner', 'public', owner.rolname, c.relkind::text, count(*)::text
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_roles owner ON owner.oid = c.relowner
WHERE n.nspname = 'public'
GROUP BY owner.rolname, c.relkind
UNION ALL
SELECT 'public_function_owner', 'public', owner.rolname, 'f', count(*)::text
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_roles owner ON owner.oid = p.proowner
WHERE n.nspname = 'public'
GROUP BY owner.rolname
UNION ALL
SELECT 'extension', extnamespace::regnamespace::text, extname, extversion, ''
FROM pg_catalog.pg_extension
UNION ALL
SELECT 'product_rows', 'public', 'products', 'count_range',
       CASE
         WHEN count(*) = 0 THEN '0'
         WHEN count(*) < 100 THEN '1-99'
         WHEN count(*) < 1000 THEN '100-999'
         WHEN count(*) < 10000 THEN '1000-9999'
         ELSE '10000+'
       END
FROM public.products
ORDER BY category, schema_name, parent_name, object_name, definition;

ROLLBACK;
