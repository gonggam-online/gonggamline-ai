-- Result set: public tables
select
  t.table_schema,
  t.table_name,
  t.table_type,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from information_schema.tables t
join pg_catalog.pg_namespace n on n.nspname = t.table_schema
join pg_catalog.pg_class c on c.relnamespace = n.oid and c.relname = t.table_name
where t.table_schema = 'public'
order by t.table_schema, t.table_name;

-- Result set: public columns
select
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable,
  c.column_default,
  c.is_identity,
  c.identity_generation
from information_schema.columns c
where c.table_schema = 'public'
order by c.table_schema, c.table_name, c.ordinal_position;
