-- Result set: public functions
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  l.lanname as language_name,
  p.provolatile as volatility,
  p.prosecdef as security_definer,
  pg_get_function_result(p.oid) as result_type,
  pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
join pg_catalog.pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by schema_name, function_name, identity_arguments;

-- Result set: public triggers
select
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled as enabled_state,
  pg_get_triggerdef(t.oid, true) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
order by schema_name, table_name, trigger_name;
