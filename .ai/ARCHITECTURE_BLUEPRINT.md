# Architecture blueprint

## Approved runtime shape

```text
App Router page
  -> route handler (HTTP validation and serialization)
    -> application service (use case and orchestration)
      -> domain engine / feature / typed helper
      -> Supabase client -> PostgREST -> migrated schema
      -> external adapter
```

| Boundary | Location | Responsibility |
|---|---|---|
| Presentation | `app/**/page.tsx`, `components/**` | UI state and accessible presentation |
| Public HTTP | `app/api/**/route.ts` | input validation, status, serialization |
| Application | `services/**` | use-case orchestration and persistence coordination |
| Domain | `engines/**`, `features/**`, `shared/domain/**` | business rules and deterministic decisions |
| Contracts | `shared/contracts/**`, explicit DTO modules | stable cross-boundary types |
| Infrastructure | `lib/**` | Supabase, Coupang, collectors, runtime adapters |
| Persistence | `supabase/migrations/**` | ordered intended schema history |

Detailed code-backed evidence is in [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
and [`../PROJECT_MAP.md`](../PROJECT_MAP.md).

## Preserved systems

- Revenue Engine: calculation -> score -> ranking; deterministic and
  consumer-independent.
- Revenue Dashboard: read service -> query service -> ranking -> DTO mapper.
- Runtime Queue and AI Workers: bounded attempts, explicit states, locks,
  sanitized errors, and auditable events.
- Marketplace Intelligence, Memory, and Decision Engine retain their existing
  domain boundaries.
- External commerce writes remain separate, explicit high-risk boundaries with
  human approval.

## Dependency rules

Dependencies point inward: UI and routes may call application services;
application services may orchestrate domain and infrastructure; domain logic
must not depend on UI, HTTP, or database row shapes. Public DTOs never expose
unreviewed persistence models.

## Architecture change gate

Any new Domain, Database, Migration, Queue, Lifecycle, Public API, or External
Integration stops implementation and triggers
[`ARCHITECTURE_REVIEW.md`](ARCHITECTURE_REVIEW.md). An Architecture Story must
define ownership, contracts, data flow, failure modes, security, observability,
testing, rollout, and rollback before approval.
