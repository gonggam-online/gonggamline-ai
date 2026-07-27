-- 공감라인 AI Commerce OS v4.0 - 사전 점검
-- 읽기 전용: 데이터나 스키마를 변경하지 않습니다.

select current_database() as database_name,
       current_user as database_user,
       now() as checked_at;

select to_regclass('public.products') as products_table,
       to_regclass('public.commerce_projects') as commerce_projects_table,
       to_regclass('public.fulfillment_providers') as fulfillment_providers_table;

select extname, extversion
from pg_extension
where extname in ('pgcrypto', 'uuid-ossp')
order by extname;
