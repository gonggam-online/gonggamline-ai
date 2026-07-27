-- READ ONLY. This evidence query does not change schema or data.

select current_database() as database_name,
       current_user as database_user,
       now() as checked_at;

select n.nspname as table_schema,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

select table_schema,
       table_name,
       ordinal_position,
       column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default,
       identity_generation,
       generation_expression
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select n.nspname as table_schema,
       c.relname as table_name,
       con.conname as constraint_name,
       con.contype as constraint_type,
       pg_get_constraintdef(con.oid, true) as definition,
       con.convalidated as is_validated
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, con.conname;

select schemaname,
       tablename,
       indexname,
       indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

select schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual,
       with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select n.nspname as function_schema,
       p.proname as function_name,
       p.oid::regprocedure as signature,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, p.oid::regprocedure::text;

select n.nspname as table_schema,
       c.relname as table_name,
       t.tgname as trigger_name,
       pg_get_triggerdef(t.oid, true) as definition,
       t.tgenabled as enabled_state
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
order by c.relname, t.tgname;
