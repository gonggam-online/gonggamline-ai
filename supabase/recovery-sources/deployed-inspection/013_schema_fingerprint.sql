-- Result set: deterministic textual catalog fingerprint inputs
select
  'column' as object_category,
  c.table_schema as schema_name,
  c.table_name as parent_name,
  c.column_name as object_name,
  concat_ws('|', c.ordinal_position::text, c.data_type, c.udt_schema,
            c.udt_name, c.is_nullable, coalesce(c.column_default, ''),
            c.is_identity, coalesce(c.identity_generation, '')) as definition
from information_schema.columns c
where c.table_schema = 'public'
union all
select
  'constraint', n.nspname, cl.relname, con.conname,
  pg_get_constraintdef(con.oid, true)
from pg_catalog.pg_constraint con
join pg_catalog.pg_class cl on cl.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
union all
select
  'index', schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
union all
select
  'policy', schemaname, tablename, policyname,
  concat_ws('|', permissive, array_to_string(roles, ','),
            cmd, coalesce(qual, ''), coalesce(with_check, ''))
from pg_catalog.pg_policies
where schemaname = 'public'
order by object_category, schema_name, parent_name, object_name, definition;
