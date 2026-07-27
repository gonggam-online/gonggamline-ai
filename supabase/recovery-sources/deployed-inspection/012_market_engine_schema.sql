-- Result set: objects introduced or altered by Git migrations 003 through 020
select
  n.nspname as schema_name,
  c.relname as object_name,
  c.relkind as object_kind,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'products','market_keywords','market_products','market_snapshots',
    'market_collection_runs','market_signals','market_estimates',
    'market_model_feedback','market_product_metrics','market_analysis_runs',
    'market_collectors','market_collection_jobs','market_ai_decisions',
    'market_product_links','market_feature_snapshots','market_feedback_events',
    'ai_product_recommendations','ai_bundle_recommendations','ai_bundle_items',
    'suppliers','supplier_quotes','sourcing_decisions',
    'domestic_supplier_products','procurement_orders','three_pl_inbound_plans',
    'commerce_workflows','commerce_timeline_events','listing_drafts',
    'listing_draft_revisions','workflow_transitions','workflow_tasks',
    'workflow_outbox_events','coupang_registration_jobs',
    'coupang_registration_attempts','coupang_seller_product_snapshots',
    'ai_decision_runs','ai_workers','system_releases','system_health_checks',
    'revenue_snapshots','os_command_runs','os_notifications','ai_ceo_briefs',
    'ai_memory_events','knowledge_assets','marketplace_connections',
    'profit_snapshots','revenue_opportunities','runtime_jobs',
    'revenue_decisions','worker_runtime_events'
  )
order by schema_name, object_name, object_kind;
