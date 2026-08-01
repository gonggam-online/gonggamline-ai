BEGIN;

-- Inventory source: dbf1c4daedf92a85f86513885d8daf4fa2905ca9d1e5e16d123c5697e75a3d56
-- The deployment runner must independently prove a quarantined non-Production target.
DO $$
DECLARE
  v_policy_state text[];
  v_creator_roles text[];
  v_rls_enabled boolean;
  v_restored_grants_match boolean;
  v_canonical_grants_match boolean;
  v_pre_state text;
  v_function record;
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'R2 precondition failed: public.products is absent';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'products'
      AND c.relkind = 'r'
      AND pg_catalog.pg_get_userbyid(c.relowner) = 'postgres'
      AND NOT c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'R2 precondition failed: Product owner or FORCE RLS state drifted';
  END IF;

  SELECT c.relrowsecurity INTO v_rls_enabled
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'products';

  SELECT array_agg(
    concat_ws('|', p.policyname, p.cmd, array_to_string(p.roles, ','),
      coalesce(p.qual, ''), coalesce(p.with_check, ''))
    ORDER BY p.policyname
  ) INTO v_policy_state
  FROM pg_catalog.pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'products';

  SELECT NOT EXISTS (
    SELECT 1
    FROM (VALUES
      ('anon', 'SELECT', true), ('anon', 'INSERT', true),
      ('anon', 'UPDATE', true), ('anon', 'DELETE', false),
      ('anon', 'TRUNCATE', false), ('anon', 'REFERENCES', false),
      ('anon', 'TRIGGER', false),
      ('authenticated', 'SELECT', false), ('authenticated', 'INSERT', false),
      ('authenticated', 'UPDATE', false), ('authenticated', 'DELETE', false),
      ('authenticated', 'TRUNCATE', false), ('authenticated', 'REFERENCES', false),
      ('authenticated', 'TRIGGER', false),
      ('service_role', 'SELECT', false), ('service_role', 'INSERT', false),
      ('service_role', 'UPDATE', false), ('service_role', 'DELETE', false),
      ('service_role', 'TRUNCATE', false), ('service_role', 'REFERENCES', false),
      ('service_role', 'TRIGGER', false)
    ) expected(role_name, privilege_name, is_granted)
    WHERE has_table_privilege(expected.role_name, 'public.products',
      expected.privilege_name) IS DISTINCT FROM expected.is_granted
  ) INTO v_restored_grants_match;

  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) role_name
    CROSS JOIN (VALUES
      ('SELECT', false), ('INSERT', false), ('UPDATE', false), ('DELETE', false),
      ('TRUNCATE', true), ('REFERENCES', true), ('TRIGGER', true)
    ) expected(privilege_name, is_granted)
    WHERE has_table_privilege(role_name, 'public.products',
      expected.privilege_name) IS DISTINCT FROM expected.is_granted
  ) INTO v_canonical_grants_match;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
    WHERE n.nspname = 'public' AND c.relname = 'products'
      AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION 'R2 precondition failed: PUBLIC Product grants drifted';
  END IF;

  IF v_rls_enabled
     AND v_policy_state IS NOT DISTINCT FROM ARRAY[
       'Allow public insert products|INSERT|anon||true',
       'Allow public read products|SELECT|anon|true|',
       'Allow public update products|UPDATE|anon|true|true'
     ]::text[]
     AND v_restored_grants_match
  THEN
    v_pre_state := 'RESTORED_DRIFT';
  ELSIF NOT v_rls_enabled
        AND v_policy_state IS NULL
        AND v_canonical_grants_match
  THEN
    v_pre_state := 'CANONICAL_000_022';
  ELSE
    RAISE EXCEPTION
      'R2 precondition failed: Product state is mixed or unapproved (rls=%, policies=%, restored_grants=%, canonical_grants=%)',
      v_rls_enabled, coalesce(array_length(v_policy_state, 1), 0),
      v_restored_grants_match, v_canonical_grants_match;
  END IF;

  SELECT array_agg(role_name ORDER BY role_name) INTO v_creator_roles
  FROM (
    SELECT DISTINCT pg_catalog.pg_get_userbyid(c.relowner) AS role_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    UNION
    SELECT DISTINCT pg_catalog.pg_get_userbyid(p.proowner)
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ) creators;

  IF v_creator_roles IS DISTINCT FROM ARRAY['postgres']::text[] THEN
    RAISE EXCEPTION 'R2 precondition failed: public creator role inventory drifted';
  END IF;

  FOR v_function IN
    SELECT * FROM (VALUES
      ('product_mutation_claim_v1', to_regprocedure('public.product_mutation_claim_v1(text,text,text,text,uuid)'), false),
      ('product_mutation_complete_v1', to_regprocedure('public.product_mutation_complete_v1(uuid,bigint,jsonb,uuid,text,text,uuid)'), false),
      ('import_product_v1', to_regprocedure('public.import_product_v1(jsonb,text,text,uuid,uuid)'), true),
      ('patch_product_operator_fields_v1', to_regprocedure('public.patch_product_operator_fields_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid)'), true),
      ('record_product_competition_v1', to_regprocedure('public.record_product_competition_v1(bigint,timestamptz,jsonb,text,text,text,uuid,uuid,text)'), false),
      ('record_manual_competition_analysis_v1', to_regprocedure('public.record_manual_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid)'), true),
      ('record_automatic_competition_analysis_v1', to_regprocedure('public.record_automatic_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid,text)'), true)
    ) AS expected(function_name, function_oid, canonical_service_execute)
  LOOP
    IF v_function.function_oid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      WHERE p.oid = v_function.function_oid
        AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
        AND p.prosecdef
        AND p.proconfig @> ARRAY['search_path=pg_catalog, public']
    ) THEN
      RAISE EXCEPTION 'R2 precondition failed: function contract drifted for %',
        v_function.function_name;
    END IF;

    IF has_function_privilege('anon', v_function.function_oid::oid, 'EXECUTE')
          IS DISTINCT FROM (v_pre_state = 'RESTORED_DRIFT')
       OR has_function_privilege('authenticated', v_function.function_oid::oid, 'EXECUTE')
          IS DISTINCT FROM (v_pre_state = 'RESTORED_DRIFT')
       OR has_function_privilege('service_role', v_function.function_oid::oid, 'EXECUTE')
          IS DISTINCT FROM CASE WHEN v_pre_state = 'RESTORED_DRIFT'
            THEN true ELSE v_function.canonical_service_execute END
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         CROSS JOIN LATERAL pg_catalog.aclexplode(
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
         WHERE n.nspname = 'public'
           AND p.oid = v_function.function_oid::oid
           AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
       )
    THEN
      RAISE EXCEPTION 'R2 precondition failed: restored execute drift classification changed for %',
        v_function.function_name;
    END IF;
  END LOOP;
END $$;

REVOKE ALL PRIVILEGES ON TABLE public.products FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.products FROM service_role;

DROP POLICY IF EXISTS "Allow public insert products" ON public.products;
DROP POLICY IF EXISTS "Allow public update products" ON public.products;
DROP POLICY IF EXISTS "Allow public read products" ON public.products;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read products"
  ON public.products FOR SELECT TO anon USING (true);

GRANT SELECT ON TABLE public.products TO anon, service_role;

REVOKE ALL ON FUNCTION public.product_mutation_claim_v1(text,text,text,text,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.product_mutation_complete_v1(uuid,bigint,jsonb,uuid,text,text,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_product_competition_v1(bigint,timestamptz,jsonb,text,text,text,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.import_product_v1(jsonb,text,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.patch_product_operator_fields_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_manual_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_automatic_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.import_product_v1(jsonb,text,text,uuid,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.patch_product_operator_fields_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_manual_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_automatic_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid,text)
  TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_function record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'products'
      AND p.policyname = 'Allow public read products'
      AND p.cmd = 'SELECT' AND p.roles = ARRAY['anon']::name[]
      AND p.qual = 'true' AND p.with_check IS NULL
  ) OR (SELECT count(*) FROM pg_catalog.pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = 'products') <> 1 THEN
    RAISE EXCEPTION 'R2 postcondition failed: Product policy target mismatch';
  END IF;

  IF EXISTS (
       SELECT 1
       FROM (VALUES
         ('anon', 'SELECT', true), ('anon', 'INSERT', false),
         ('anon', 'UPDATE', false), ('anon', 'DELETE', false),
         ('anon', 'TRUNCATE', false), ('anon', 'REFERENCES', false),
         ('anon', 'TRIGGER', false),
         ('authenticated', 'SELECT', false), ('authenticated', 'INSERT', false),
         ('authenticated', 'UPDATE', false), ('authenticated', 'DELETE', false),
         ('authenticated', 'TRUNCATE', false), ('authenticated', 'REFERENCES', false),
         ('authenticated', 'TRIGGER', false),
         ('service_role', 'SELECT', true), ('service_role', 'INSERT', false),
         ('service_role', 'UPDATE', false), ('service_role', 'DELETE', false),
         ('service_role', 'TRUNCATE', false), ('service_role', 'REFERENCES', false),
         ('service_role', 'TRIGGER', false)
       ) expected(role_name, privilege_name, is_granted)
       WHERE has_table_privilege(expected.role_name, 'public.products',
         expected.privilege_name) IS DISTINCT FROM expected.is_granted
     ) OR EXISTS (
       SELECT 1
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
       WHERE n.nspname = 'public' AND c.relname = 'products'
         AND acl.grantee = 0
     )
  THEN
    RAISE EXCEPTION 'R2 postcondition failed: Product grant target mismatch';
  END IF;

  FOR v_function IN
    SELECT * FROM (VALUES
      ('product_mutation_claim_v1', 'text, text, text, text, uuid', false),
      ('product_mutation_complete_v1', 'uuid, bigint, jsonb, uuid, text, text, uuid', false),
      ('import_product_v1', 'jsonb, text, text, uuid, uuid', true),
      ('patch_product_operator_fields_v1', 'bigint, timestamp with time zone, jsonb, text, text, uuid, uuid', true),
      ('record_product_competition_v1', 'bigint, timestamp with time zone, jsonb, text, text, text, uuid, uuid, text', false),
      ('record_manual_competition_analysis_v1', 'bigint, timestamp with time zone, jsonb, text, text, uuid, uuid', true),
      ('record_automatic_competition_analysis_v1', 'bigint, timestamp with time zone, jsonb, text, text, uuid, uuid, text', true)
    ) AS expected(function_name, argument_types, service_role_execute)
  LOOP
    IF has_function_privilege('anon',
         format('public.%I(%s)', v_function.function_name, v_function.argument_types), 'EXECUTE')
       OR has_function_privilege('authenticated',
         format('public.%I(%s)', v_function.function_name, v_function.argument_types), 'EXECUTE')
       OR has_function_privilege('service_role',
         format('public.%I(%s)', v_function.function_name, v_function.argument_types), 'EXECUTE')
          IS DISTINCT FROM v_function.service_role_execute
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         CROSS JOIN LATERAL pg_catalog.aclexplode(
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
         WHERE n.nspname = 'public'
           AND p.proname = v_function.function_name
           AND pg_catalog.oidvectortypes(p.proargtypes) = v_function.argument_types
           AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
       )
    THEN
      RAISE EXCEPTION 'R2 postcondition failed: execute matrix mismatch for %',
        v_function.function_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM (VALUES ('r'::"char"), ('S'::"char"), ('f'::"char")) object_type(code)
    LEFT JOIN pg_catalog.pg_default_acl d
      ON d.defaclrole = 'postgres'::regrole
     AND d.defaclnamespace = 'public'::regnamespace
     AND d.defaclobjtype = object_type.code
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      coalesce(d.defaclacl,
        pg_catalog.acldefault(object_type.code, 'postgres'::regrole))) acl
    WHERE acl.grantee IN (
      0, 'anon'::regrole::oid, 'authenticated'::regrole::oid
    )
  ) THEN
    RAISE EXCEPTION 'R2 postcondition failed: browser-facing default privileges remain';
  END IF;
END $$;

COMMIT;
