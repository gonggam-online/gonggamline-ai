-- 공감라인 AI v2.1: 자동 경쟁력 분석 파이프라인
alter table public.products
  add column if not exists coupang_analysis_keyword text,
  add column if not exists competition_data_source text not null default 'none',
  add column if not exists competition_confidence numeric not null default 0,
  add column if not exists competition_data_note text;

alter table public.products drop constraint if exists products_competition_analysis_status_check;
alter table public.products add constraint products_competition_analysis_status_check
  check (competition_analysis_status in ('pending', 'analyzed', 'estimated', 'needs_data', 'failed'));

alter table public.products drop constraint if exists products_competition_data_source_check;
alter table public.products add constraint products_competition_data_source_check
  check (competition_data_source in ('none', 'manual', 'external', 'estimated'));

create index if not exists products_competition_grade_score_idx
  on public.products (competition_grade, competition_score desc);
