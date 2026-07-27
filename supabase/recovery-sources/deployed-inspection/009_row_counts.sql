-- Result set: catalog estimates only; no business rows are returned
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.reltuples::bigint as estimated_row_count
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by schema_name, table_name;
