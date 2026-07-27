-- Result set: Commerce OS columns
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default, is_identity, identity_generation
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'fulfillment_providers',
    'commerce_projects',
    'commerce_project_components',
    'competition_analyses',
    'inbound_orders',
    'inventory_balances'
  )
order by table_name, ordinal_position;

-- Result set: Commerce OS constraints
select c.relname as table_name, con.conname as constraint_name,
       con.contype as constraint_type,
       pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'fulfillment_providers',
    'commerce_projects',
    'commerce_project_components',
    'competition_analyses',
    'inbound_orders',
    'inventory_balances'
  )
order by table_name, constraint_name;

-- Result set: Commerce OS indexes
select tablename as table_name, indexname as index_name, indexdef as definition
from pg_catalog.pg_indexes
where schemaname = 'public'
  and tablename in (
    'fulfillment_providers',
    'commerce_projects',
    'commerce_project_components',
    'competition_analyses',
    'inbound_orders',
    'inventory_balances'
  )
order by table_name, index_name;

-- Result set: Commerce OS policies
select tablename as table_name, policyname as policy_name, permissive, roles,
       cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in (
    'fulfillment_providers',
    'commerce_projects',
    'commerce_project_components',
    'competition_analyses',
    'inbound_orders',
    'inventory_balances'
  )
order by table_name, policy_name;
