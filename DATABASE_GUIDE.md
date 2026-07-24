# Database guide

## Source of truth and access

Ordered SQL under `supabase/migrations/` is the intended schema history. Application access is via Supabase/PostgREST from services and selected route handlers. Compare every `.from()`, selected column, embedded relation, alias, conflict key, and foreign key with migrations.

## Observed schema domains

- Market: keywords, products, snapshots, signals, estimates, collectors/jobs, metrics, feedback.
- Discovery/decision: product/bundle recommendations/items and AI decision runs.
- Sourcing/procurement: suppliers, quotes, decisions, supplier products, orders, 3PL plans.
- Workflow/listing/Coupang: workflows/events/tasks/transitions/outbox, drafts/revisions, registration jobs/attempts/snapshots.
- Company/revenue/runtime: workers, releases, health, memory/knowledge, connections, profit/revenue snapshots, opportunities/decisions/jobs/events.

## Known baseline gap

Migrations begin at `003`, while later migrations and code reference `public.products`; no `create table public.products` exists in this repository. Do not create a guessed migration. First compare the deployed schema and migration history, locate the authoritative pre-003 SQL, and add it through a separately approved high-risk change.

## Change rules

Schema, RLS, auth, migration execution, and production writes are high-risk. Require explicit scope, backup/rollback, compatibility analysis, generated type refresh where adopted, Preview/Production sequencing, and manual merge. Schema-cache failures are database/deployment problems, not permission to return false success from write APIs.
