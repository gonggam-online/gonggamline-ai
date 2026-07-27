alter table public.products
add column if not exists is_favorite boolean not null default false,
add column if not exists review_status text not null default 'unreviewed',
add column if not exists memo text,
add column if not exists manual_sale_price integer,
add column if not exists risk_level text not null default 'unknown',
add column if not exists ai_analysis_status text not null default 'pending',
add column if not exists ai_score integer,
add column if not exists ai_summary text,
add column if not exists excluded_reason text,
add column if not exists reviewed_at timestamptz;

alter table public.products
drop constraint if exists products_review_status_check;

alter table public.products
add constraint products_review_status_check
check (
  review_status in (
    'unreviewed',
    'reviewing',
    'sample_candidate',
    'approved',
    'excluded'
  )
);

alter table public.products
drop constraint if exists products_risk_level_check;

alter table public.products
add constraint products_risk_level_check
check (
  risk_level in (
    'unknown',
    'low',
    'medium',
    'high'
  )
);

alter table public.products
drop constraint if exists products_ai_analysis_status_check;

alter table public.products
add constraint products_ai_analysis_status_check
check (
  ai_analysis_status in (
    'pending',
    'analyzing',
    'completed',
    'failed'
  )
);

create index if not exists products_review_status_idx
on public.products(review_status);

create index if not exists products_is_favorite_idx
on public.products(is_favorite);

create index if not exists products_ai_score_idx
on public.products(ai_score desc);

create index if not exists products_updated_at_idx
on public.products(updated_at desc);
