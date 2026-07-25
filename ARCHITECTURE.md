# Architecture

## Principles

The application is a typed commerce operating system. Keep route handlers as validation/serialization boundaries; keep domain behavior in services, features, and engines; keep Supabase failures sanitized but observable. Human approval separates analysis/draft generation from marketplace, purchasing, pricing, inventory, and fulfillment writes.

```text
App Router page
  -> route handler (HTTP validation/contract)
    -> service (use case/orchestration)
      -> engine/feature/domain helper
      -> Supabase client -> PostgREST -> migrated schema
      -> external adapter (Coupang/collector)
```

## Major boundaries

- Presentation: `app/**/page.tsx`, client interactions, shared CSS.
- API: `app/api/**/route.ts`; public response shape and status are contracts.
- Application services: `services/**`; orchestration and persistence.
- Domain/engines: `engines/**`, `features/**`, `shared/domain/**`, `shared/contracts/**`.
- Infrastructure: `lib/supabase.ts`, `lib/coupang/**`, market collectors, runtime logging/error policy.
- Persistence: ordered SQL in `supabase/migrations/**`.

## Revenue decision pipeline

```text
Product rows
  -> Revenue Calculation domain service
  -> Revenue Score domain service
  -> Revenue Ranking domain service
       -> Recommendation API (future consumer)
       -> Dashboard (future consumer)
       -> Coupang Upload Queue (future consumer)
```

The Ranking Engine remains consumer-independent and read-only. It reuses the
Calculation and Score contracts once per Product and exposes deterministic,
machine-explainable ordering without persistence or LLM calls.

## Revenue Dashboard API

```text
GET /api/dashboard/revenue
  -> Product read service
  -> Revenue Dashboard Query Service
  -> Revenue Ranking Engine
       -> Revenue Score Engine
       -> Revenue Calculation Engine
  -> Revenue Dashboard DTO Mapper
```

The route validates HTTP input and delegates without business logic. The Query
Service reads Products once, invokes Ranking once, filters, performs the stable
Dashboard sort, paginates, and maps the public DTO. The Dashboard API does not
persist rankings, create jobs, or duplicate financial calculations.
`lastAnalyzedAt` is copied from the existing Product competition analysis
timestamp and remains `null` when the source timestamp is unavailable.

## Reliability model

The runtime queue uses bounded attempts, explicit state transitions, locks, structured sanitized errors, and worker events. Read-only optional dashboards may expose `available: false` for known configuration/network/schema-cache unavailability. Unexpected errors remain HTTP 500. Writes must never degrade to false success.

## Architectural risks

Direct PostgREST queries are distributed across routes/services and many use `select("*")`, increasing schema-coupling. Generated Supabase types are absent. The migration chain lacks the base `products` definition. Several route files compress validation, orchestration, and response handling into one line, reducing reviewability. These are sequenced in `TECH_DEBT.md`; no broad refactor is included here.
