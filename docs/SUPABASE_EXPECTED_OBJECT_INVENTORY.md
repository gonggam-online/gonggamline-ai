# Supabase expected object inventory

## Evidence status and field key

Every deployed classification is currently `UNKNOWN`. Required evidence is:
`C` columns, `K` constraints, `I` indexes, `P` RLS/policies, `F` functions,
and `T` triggers. All objects are in `public` unless noted. Risk is preliminary;
RLS and history decisions are high-risk.

Common fields for every row below: category and object name are explicit;
source identifies introduction; dependencies are stated; Production necessity
is `yes`, `app-dependent`, or `historical-only`; security-sensitive rows are
marked; evidence codes select the inspection result; application usage is
active, no direct reference found, or dependency; and risk is preliminary.

## Recovered Product baseline and workflow

| Category/object | Source | Dependencies | Production necessity | Historical only | Security | Evidence | Application usage | Risk |
|---|---|---|---|---:|---:|---|---|---|
| table `products` and its 25 baseline columns | Products baseline | none | yes | no | yes | C,K | active Product APIs | high |
| identity PK `products.id`; unique `product_no`; defaults/nullability | Products baseline | `products` | yes | no | no | C,K | active | high |
| RLS enabled on `products` | Products baseline | `products` | yes | no | yes | P | active anon client | high |
| policies `Allow public read products`, `Allow public insert products`, `Allow public update products` | Products baseline | Product RLS | app-dependent; not security-approved | no | yes | P | current anon client may depend on them | critical |
| workflow columns `is_favorite`, `review_status`, `memo`, `manual_sale_price`, `risk_level`, `ai_analysis_status`, `ai_score`, `ai_summary`, `excluded_reason`, `reviewed_at` | Product workflow | `products` | yes | no | no | C | active Product API/UI | high |
| checks `products_review_status_check`, `products_risk_level_check`, `products_ai_analysis_status_check` | Product workflow | workflow columns | yes | no | no | K | active validation contract | high |
| indexes `products_review_status_idx`, `products_is_favorite_idx`, `products_ai_score_idx`, `products_updated_at_idx` | Product workflow | workflow/baseline columns | yes | no | no | I | query support | normal |
| competition columns/checks/indexes added by Git 003–004 | migrations 003–004 | `products` | yes | no | no | C,K,I | active competition APIs | high |

## Recovered Commerce OS core

| Category/object | Source | Dependencies | Production necessity | Historical only | Security | Evidence | Application usage | Risk |
|---|---|---|---|---:|---:|---|---|---|
| tables `fulfillment_providers`, `commerce_projects`, `commerce_project_components`, `competition_analyses`, `inbound_orders`, `inventory_balances` | `002_core_schema` | internal FK order | app-dependent | no | yes | C,K | no direct code reference found | high |
| conditional FK `commerce_projects_provider_fk` | `002_core_schema` | providers, projects | app-dependent | no | no | K | dormant dependency | high |
| indexes `commerce_projects_status_idx`, `commerce_projects_provider_idx`, `commerce_project_components_project_idx`, `competition_analyses_project_idx`, `inbound_orders_project_idx`, `inbound_orders_provider_idx`, `inventory_balances_project_idx` | `002_core_schema` | six tables | app-dependent | no | no | I | dormant query support | normal |
| function `set_updated_at()` | `002_core_schema` | PL/pgSQL | app-dependent | no | yes | F | no direct code reference | high |
| triggers `trg_fulfillment_providers_updated_at`, `trg_commerce_projects_updated_at`, `trg_inbound_orders_updated_at`, `trg_inventory_balances_updated_at` | `002_core_schema` | function and tables | app-dependent | no | no | T | dormant behavior | high |
| RLS enabled on all six tables | `003_dev_rls` | six tables | historical evidence only | yes | yes | P | no direct code reference | critical |
| policies `v4_dev_all_commerce_projects`, `v4_dev_all_components`, `v4_dev_all_competition`, `v4_dev_all_providers`, `v4_dev_all_inbound`, `v4_dev_all_inventory` | `003_dev_rls` | RLS tables | never as Production policy | yes | yes | P | unrestricted anon/auth access | critical |

## Git migration table inventory

All 50 table rows require `C,K,I,P`; each is a Production replay dependency,
not historical-only, security-sensitive because migrations enable RLS, and
preliminary high-risk. “Direct” means current application code names the table.

| Source | Expected tables | Application usage |
|---|---|---|
| 005 | `market_keywords`, `market_products`, `market_snapshots`, `market_collection_runs`, `market_signals`, `market_estimates`, `market_model_feedback` | first, second, third, fifth direct |
| 006 | `market_product_metrics`, `market_analysis_runs` | metrics direct |
| 007 | `market_collectors`, `market_collection_jobs`, `market_ai_decisions`, `market_product_links` | no direct reference found |
| 008 | `market_feature_snapshots`, `market_feedback_events` | both direct |
| 009 | `ai_product_recommendations`, `ai_bundle_recommendations`, `ai_bundle_items` | accessed through repository APIs, not direct client call |
| 010 | `suppliers`, `supplier_quotes`, `sourcing_decisions` | accessed through repository APIs |
| 011 | `domestic_supplier_products`, `procurement_orders`, `three_pl_inbound_plans`, `commerce_workflows`, `commerce_timeline_events` | accessed through repository APIs |
| 012 | `listing_drafts`, `listing_draft_revisions` | accessed through repository APIs |
| 013 | `workflow_transitions`, `workflow_tasks`, `workflow_outbox_events` | accessed through repository APIs |
| 014 | `coupang_registration_jobs`, `coupang_registration_attempts`, `coupang_seller_product_snapshots` | accessed through repository APIs |
| 015 | `ai_decision_runs` | no direct client call found |
| 016 | `ai_workers`, `system_releases`, `system_health_checks`, `revenue_snapshots` | `ai_workers` direct |
| 017 | `os_command_runs`, `os_notifications` | both direct |
| 018 | `ai_ceo_briefs`, `ai_memory_events`, `knowledge_assets`, `marketplace_connections`, `profit_snapshots` | no direct client call found |
| 019 | `revenue_opportunities`, `runtime_jobs`, `revenue_decisions` | `runtime_jobs` direct |
| 020 | `worker_runtime_events` | no direct client call found |

## Git explicit index inventory

The required index evidence is `004_indexes.sql`. Expected names, grouped by
source:

- 003–004: `products_competition_score_idx`,
  `products_competition_status_idx`, `products_competition_grade_score_idx`.
- 005–008: `market_snapshots_product_time_idx`,
  `market_snapshots_keyword_time_idx`,
  `market_product_metrics_opportunity_idx`, `market_signals_unresolved_idx`,
  `market_estimates_product_created_idx`, `market_collection_jobs_due_idx`,
  `market_ai_decisions_product_created_idx`,
  `market_feature_snapshots_product_time_idx`,
  `market_feedback_events_product_time_idx`.
- 009–012: `ai_product_recommendations_score_idx`,
  `ai_bundle_recommendations_score_idx`, `ai_bundle_items_bundle_idx`,
  `idx_supplier_quotes_supplier`, `idx_supplier_quotes_single`,
  `idx_supplier_quotes_bundle`, `idx_sourcing_decisions_quote`,
  `idx_domestic_supplier_products_candidate`, `idx_procurement_orders_status`,
  `idx_inbound_plans_order`, `idx_workflows_stage`, `idx_timeline_workflow`,
  `idx_listing_drafts_workflow`, `idx_listing_drafts_status`,
  `idx_listing_revisions_draft`.
- 013–016: `idx_commerce_workflows_code`,
  `idx_workflow_transitions_idempotency`, `idx_workflow_transitions_workflow`,
  `idx_workflow_tasks_queue`, `idx_workflow_outbox_pending`,
  `idx_coupang_jobs_code`, `idx_coupang_jobs_queue`,
  `idx_coupang_jobs_workflow`, `idx_coupang_attempts_job`,
  `idx_coupang_product_snapshots_product`, `ai_decision_runs_started_idx`,
  `ai_product_recommendations_decision_idx`,
  `ai_bundle_recommendations_decision_idx`, `ai_workers_status_idx`,
  `system_releases_status_idx`, `system_health_checks_component_idx`,
  `revenue_snapshots_date_idx`.
- 017–020: `os_command_runs_queue_idx`, `os_command_runs_worker_idx`,
  `os_notifications_unread_idx`, `ai_memory_events_subject_idx`,
  `knowledge_assets_type_idx`, `ai_ceo_briefs_date_idx`,
  `marketplace_connections_status_idx`, `revenue_opportunities_score_idx`,
  `revenue_opportunities_status_idx`, `runtime_jobs_queue_idx`,
  `revenue_decisions_opportunity_idx`, `worker_runtime_events_job_idx`,
  `worker_runtime_events_worker_idx`.

## Git policy and extension inventory

Each of the 50 Git-created tables has one explicit permissive development
policy in its introducing migration and RLS enabled. Exact policy names:

- 005–008: `dev_market_keywords_all`, `dev_market_products_all`,
  `dev_market_snapshots_all`, `dev_market_collection_runs_all`,
  `dev_market_signals_all`, `dev_market_estimates_all`,
  `dev_market_model_feedback_all`, `dev_market_product_metrics_all`,
  `dev_market_analysis_runs_all`, `dev_market_collectors_all`,
  `dev_market_collection_jobs_all`, `dev_market_ai_decisions_all`,
  `dev_market_product_links_all`, `dev_market_feature_snapshots_all`,
  `dev_market_feedback_events_all`.
- 009–012: `dev_ai_product_recommendations_all`,
  `dev_ai_bundle_recommendations_all`, `dev_ai_bundle_items_all`,
  `dev suppliers all`, `dev supplier quotes all`,
  `dev sourcing decisions all`, `dev domestic supplier products all`,
  `dev procurement orders all`, `dev inbound plans all`,
  `dev commerce workflows all`, `dev commerce timeline all`,
  `dev listing drafts all`, `dev listing revisions all`.
- 013–016: `dev workflow transitions all`, `dev workflow tasks all`,
  `dev workflow outbox all`, `dev coupang jobs all`,
  `dev coupang attempts all`, `dev coupang snapshots all`,
  `dev_ai_decision_runs_all`, `dev_ai_workers_all`,
  `dev_system_releases_all`, `dev_system_health_checks_all`,
  `dev_revenue_snapshots_all`.
- 017–020: `dev_os_command_runs_all`, `dev_os_notifications_all`,
  `dev_ai_ceo_briefs_all`, `dev_ai_memory_events_all`,
  `dev_knowledge_assets_all`, `dev_marketplace_connections_all`,
  `dev_profit_snapshots_all`, `dev_revenue_opportunities_all`,
  `dev_runtime_jobs_all`, `dev_revenue_decisions_all`,
  `dev_worker_runtime_events_all`.

Exact semantics must be compared through `005_rls_policies.sql`. These policies
are security-sensitive and not automatically approved for Production merely
because they are checked into history.

Migration 005 requires extension `pgcrypto`, inspected by
`007_extensions.sql`. Migrations also contain seed statements and later column
alterations; `002_tables_columns.sql`, `003_constraints.sql`, and
`013_schema_fingerprint.sql` cover their resulting replay-relevant objects.
Seed row contents are deliberately excluded from deployed inspection because
the package must not expose commercial data.
