-- Bounded initial market watchlist. External calls remain gated by Production Secrets.
with seed(keyword, category, priority, interval_minutes) as (
  values
    ('틈새수납','수납·정리',85,360), ('주방정리','수납·정리',85,360), ('욕실정리','수납·정리',80,360), ('차량정리','수납·정리',80,360),
    ('케이블정리','생활 불편 해결',82,360), ('먼지제거','생활 불편 해결',80,360), ('미끄럼방지','생활 불편 해결',78,360), ('소형조명','생활 불편 해결',75,360),
    ('여름쿨링','계절·환경',72,360), ('겨울보온','계절·환경',72,360), ('장마용품','계절·환경',70,360), ('캠핑수납','계절·환경',70,360),
    ('주방청소','주방·청소',78,360), ('싱크대정리','주방·청소',80,360), ('냉장고정리','주방·청소',78,360), ('다용도걸이','주방·청소',75,360),
    ('차량용수납','차량·외출',76,360), ('차량청소','차량·외출',74,360), ('여행정리','차량·외출',70,360), ('휴대용보관','차량·외출',70,360),
    ('다용도수납','소형 생활용품',78,360), ('생활보호용품','소형 생활용품',72,360), ('정리용품','소형 생활용품',76,360), ('소형생활용품','소형 생활용품',70,360)
)
insert into public.market_keywords (keyword, category, priority, collection_status, collection_interval_minutes, next_collection_at)
select keyword, category, priority, 'active', interval_minutes, now() from seed
on conflict (keyword) do update set
  category = excluded.category,
  priority = greatest(public.market_keywords.priority, excluded.priority),
  collection_status = case when public.market_keywords.collection_status = 'blocked' then 'blocked' else 'active' end,
  collection_interval_minutes = excluded.collection_interval_minutes,
  next_collection_at = coalesce(public.market_keywords.next_collection_at, now()),
  updated_at = now();

insert into public.market_collectors (collector_key, name, source_type, supports_automatic, status)
values
  ('naver-shopping-api', '네이버 쇼핑 API', 'official_api', true, 'ready'),
  ('dataforseo-naver-serp', 'DataForSEO Naver SERP', 'official_api', true, 'ready'),
  ('youtube-public-signals', 'YouTube 공개 트렌드 신호', 'official_api', true, 'ready')
on conflict (collector_key) do update set status = 'ready', supports_automatic = true, updated_at = now();

insert into public.market_collection_jobs (collector_key, market_keyword_id, status, priority, interval_minutes, next_run_at)
select c.collector_key, k.id, 'active', k.priority,
  case when c.collector_key = 'naver-shopping-api' then 360 when c.collector_key = 'youtube-public-signals' then 720 else 1440 end,
  now()
from public.market_collectors c
cross join public.market_keywords k
where c.collector_key in ('naver-shopping-api', 'dataforseo-naver-serp', 'youtube-public-signals')
  and k.collection_status = 'active'
on conflict (collector_key, market_keyword_id) do update set
  status = 'active',
  priority = excluded.priority,
  interval_minutes = excluded.interval_minutes,
  next_run_at = least(public.market_collection_jobs.next_run_at, excluded.next_run_at),
  updated_at = now();
