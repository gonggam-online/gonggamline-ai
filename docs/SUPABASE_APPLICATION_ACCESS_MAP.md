# Supabase application access map

## Client and trust boundary

`lib/supabase.ts` creates one client from
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role
key or server-only privileged client is present. Components do not import the
Supabase client directly; browser code calls application API routes. API routes
and services execute server-side, but their database requests still carry the
anonymous role.

Therefore “server-side route” does not mean privileged database access in the
current implementation. Removing anonymous permissions can break these routes
immediately. No anonymous browser-to-Supabase dependency was found, but broad
anonymous policy access remains reachable by anyone holding the public URL/key.

## Active Product requirements

Product routes read `id`, `product_no`, `title`, `thumbnail`, `product_url`,
pricing/cost/profit fields, scoring and recommendation fields, workflow fields
including favorite/review/memo/manual price/risk/AI fields, and competition
fields from migrations 003–004. They perform:

- `SELECT`: list, detail, Supabase health/test, batch candidate selection, and
  competition calculation inputs;
- `UPDATE`: Product workflow edits and competition analysis results;
- no Product `INSERT` or `DELETE` was found in current application code.

The historical Product insert policy is therefore not proven necessary by the
current repository; the select and update paths are active.

## Direct route access

| Route family | Tables | Operations |
|---|---|---|
| `/api/products`, `/api/products/[id]`, `/api/competition/*` | `products` | SELECT, UPDATE |
| `/api/market/*` | `market_keywords`, `market_products`, `market_snapshots`, `market_signals`, `market_product_metrics`, `market_feature_snapshots`, `market_feedback_events` | SELECT, INSERT, UPSERT |
| `/api/revenue/jobs` | `runtime_jobs` | SELECT, INSERT |
| `/api/os/commands*` | `os_command_runs`, `ai_workers`, `os_notifications` | SELECT, INSERT, UPDATE |
| `/api/health/runtime` | `runtime_jobs` through REST | SELECT |
| `/api/supabase-test` | `products` | SELECT |

## Service-mediated access

All services use the same anon client.

| Service/domain | Principal tables | Operations observed |
|---|---|---|
| Company OS | `commerce_workflows`, `os_command_runs`, `ai_decision_runs`, `listing_drafts`, `ai_workers`, `system_releases`, `workflow_transitions`, `workflow_tasks`, `revenue_snapshots`, enterprise tables | SELECT/count |
| Discovery/Market | migrations 005–009 tables | SELECT, INSERT, UPDATE, UPSERT |
| Supplier/Sourcing | `suppliers`, `supplier_quotes`, `sourcing_decisions`, recommendation tables | SELECT, INSERT, UPDATE |
| Procurement | `domestic_supplier_products`, `procurement_orders`, `three_pl_inbound_plans`, workflow/timeline tables | SELECT, INSERT, UPDATE, UPSERT |
| Listing | `listing_drafts`, `listing_draft_revisions`, workflows | SELECT, INSERT, UPDATE |
| Workflow | `commerce_workflows`, `workflow_transitions`, `workflow_tasks`, `workflow_outbox_events`, `commerce_timeline_events` and linked domain tables | SELECT, INSERT, UPDATE, UPSERT |
| Coupang seller | registration jobs/attempts/snapshots, listing/workflow tables | SELECT, INSERT, UPDATE |
| Revenue/runtime | `revenue_opportunities`, `runtime_jobs`, `revenue_decisions`, `worker_runtime_events` and supporting market/Product tables | SELECT, INSERT, UPDATE |

No application reference was found to the recovered six Commerce OS v4 tables:
`fulfillment_providers`, `commerce_projects`, `commerce_project_components`,
`competition_analyses`, `inbound_orders`, or `inventory_balances`. They are
currently historical/dormant from the code perspective and must not be
confused with the later `commerce_workflows` chain.

No required application `DELETE` was found. This does not prove that external
clients or SQL Editor workflows never delete; deployed access logs and operator
evidence are outside this repository.

## RLS removal impact

Immediately removing anonymous full access without a replacement would break:

- all active database reads because even server routes use the anon key;
- Product and competition updates;
- Market feedback/keyword writes;
- runtime job creation;
- command, workflow, supplier, procurement, listing, discovery, Coupang, and
  Revenue writes performed by services.

The safe production design boundary is to enumerate route/service operations,
introduce an authenticated or server-only principal where appropriate, and
then grant table/operation-specific least privilege. This task does not
implement that change.
