-- 공감라인 AI Commerce OS v4.0 - 적용 결과 확인
-- 읽기 전용입니다.

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'commerce_projects',
    'commerce_project_components',
    'competition_analyses',
    'fulfillment_providers',
    'inbound_orders',
    'inventory_balances'
  )
order by table_name;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname='public'
  and tablename in (
    'commerce_projects',
    'commerce_project_components',
    'competition_analyses',
    'fulfillment_providers',
    'inbound_orders',
    'inventory_balances'
  )
order by tablename, policyname;

select
  (select count(*) from public.commerce_projects) as commerce_projects_count,
  (select count(*) from public.fulfillment_providers) as fulfillment_providers_count,
  (select count(*) from public.inbound_orders) as inbound_orders_count;
