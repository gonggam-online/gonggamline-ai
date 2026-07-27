-- Result set: products columns
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  is_identity,
  identity_generation
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
order by ordinal_position;

-- Result set: products constraints
select con.conname as constraint_name, con.contype as constraint_type,
       pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'products'
order by constraint_name;

-- Result set: products indexes
select indexname as index_name, indexdef as definition
from pg_catalog.pg_indexes
where schemaname = 'public' and tablename = 'products'
order by index_name;

-- Result set: products policies
select policyname as policy_name, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'products'
order by policy_name;
