select
  p.oid::regprocedure as existing_function
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'set_updated_at';

select
  t.tgname as trigger_name,
  t.tgrelid::regclass as table_name
from pg_trigger t
where not t.tgisinternal
  and t.tgname in (
    'trg_fulfillment_providers_updated_at',
    'trg_commerce_projects_updated_at',
    'trg_inbound_orders_updated_at',
    'trg_inventory_balances_updated_at'
  );
