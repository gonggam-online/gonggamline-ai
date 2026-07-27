-- 공감라인 AI Commerce OS v4.0 - 개발용 RLS 정책
-- 주의: anon/authenticated 사용자의 전체 CRUD를 허용합니다.
-- 로컬/MVP 테스트에만 사용하고 운영 전에는 사업자/사용자별 정책으로 교체하세요.

begin;

alter table public.commerce_projects enable row level security;
alter table public.commerce_project_components enable row level security;
alter table public.competition_analyses enable row level security;
alter table public.fulfillment_providers enable row level security;
alter table public.inbound_orders enable row level security;
alter table public.inventory_balances enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='commerce_projects' AND policyname='v4_dev_all_commerce_projects') THEN
    CREATE POLICY v4_dev_all_commerce_projects ON public.commerce_projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='commerce_project_components' AND policyname='v4_dev_all_components') THEN
    CREATE POLICY v4_dev_all_components ON public.commerce_project_components FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='competition_analyses' AND policyname='v4_dev_all_competition') THEN
    CREATE POLICY v4_dev_all_competition ON public.competition_analyses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fulfillment_providers' AND policyname='v4_dev_all_providers') THEN
    CREATE POLICY v4_dev_all_providers ON public.fulfillment_providers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbound_orders' AND policyname='v4_dev_all_inbound') THEN
    CREATE POLICY v4_dev_all_inbound ON public.inbound_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inventory_balances' AND policyname='v4_dev_all_inventory') THEN
    CREATE POLICY v4_dev_all_inventory ON public.inventory_balances FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

commit;
