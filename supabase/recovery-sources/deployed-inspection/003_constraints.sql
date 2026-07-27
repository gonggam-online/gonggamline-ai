-- Result set: public constraints
select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  con.condeferrable as is_deferrable,
  con.condeferred as initially_deferred,
  con.convalidated as is_validated,
  pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by schema_name, table_name, constraint_name;
