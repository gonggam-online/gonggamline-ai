-- 공감라인 AI v2.0: 쿠팡 판매 경쟁력 분석 필드
alter table public.products
  add column if not exists competition_score numeric not null default 0,
  add column if not exists marketability_score numeric not null default 0,
  add column if not exists price_competitiveness_score numeric not null default 0,
  add column if not exists review_entry_score numeric not null default 0,
  add column if not exists rocket_competition_score numeric not null default 0,
  add column if not exists keyword_demand_score numeric not null default 0,
  add column if not exists competition_grade text not null default '미분석',
  add column if not exists competition_analysis_status text not null default 'pending',
  add column if not exists competition_summary text,
  add column if not exists coupang_market_price numeric,
  add column if not exists coupang_top10_avg_price numeric,
  add column if not exists coupang_result_count integer,
  add column if not exists coupang_rocket_ratio numeric,
  add column if not exists coupang_avg_review_count numeric,
  add column if not exists coupang_avg_rating numeric,
  add column if not exists coupang_keyword_search_volume integer,
  add column if not exists estimated_monthly_units_low integer,
  add column if not exists estimated_monthly_units_high integer,
  add column if not exists estimated_monthly_sales_low numeric,
  add column if not exists estimated_monthly_sales_high numeric,
  add column if not exists competition_analyzed_at timestamptz;

alter table public.products drop constraint if exists products_competition_analysis_status_check;
alter table public.products add constraint products_competition_analysis_status_check
  check (competition_analysis_status in ('pending', 'analyzed', 'estimated', 'needs_data', 'failed'));

alter table public.products drop constraint if exists products_competition_grade_check;
alter table public.products add constraint products_competition_grade_check
  check (competition_grade in ('미분석', 'S', 'A', 'B', 'C', 'D'));

create index if not exists products_competition_score_idx
  on public.products (competition_score desc);
create index if not exists products_competition_status_idx
  on public.products (competition_analysis_status, updated_at desc);
