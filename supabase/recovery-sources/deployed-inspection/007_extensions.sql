-- Result set: installed extensions
select
  n.nspname as schema_name,
  e.extname as extension_name,
  e.extversion as extension_version
from pg_catalog.pg_extension e
join pg_catalog.pg_namespace n on n.oid = e.extnamespace
order by extension_name, schema_name;
