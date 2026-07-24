# Project audit

## Scope and method

Static trace of 65 route handlers, 15 services, Supabase query strings, migrations 003–020, UI route manifest, tests, and delivery workflows. No live schema query, migration, external write, or secret inspection was performed.

## Findings

| ID | Class | Evidence | Impact | Disposition |
|---|---|---|---|---|
| A1 | Database, high | Migrations start at `003`; `005` and later reference `public.products`, but no repository migration creates it | Fresh environments are not reproducible; Preview/Production drift can masquerade as code failure | Owner must locate/verify authoritative baseline; separate manual high-risk PR |
| A2 | Database/deploy, high | Existing read degradation explicitly handles missing relation/column/PostgREST relationship codes | Useful for optional reads, but can conceal a persistently incomplete deployed schema if availability is not monitored | Keep visible `available:false`; add deployment schema verification before broadening fallback |
| A3 | Code/schema coupling, normal | Many services/routes use `select("*")`, including workflow, sourcing, runtime, OS, and market paths | Schema changes can alter payloads and increase ambiguous embedded relations | Replace incrementally with contract constants and tests; no bulk rewrite |
| A4 | Code contract, addressed on branch | `lib/supabase-selects.ts` aliases `product_url` to `url` and disambiguates `commerce_workflows!workflow_id`; tests assert both | Prevents PostgREST schema-cache/relationship errors while preserving UI keys | Existing commit `c75a7c1`; validate fully in this PR |
| A5 | Test coverage, normal | E2E manifest covers 15 pages but only `/api/health/runtime` and `/api/products` APIs | Most read APIs and all guarded write contracts lack browser/API smoke coverage | Add a curated safe-read API manifest; write APIs need mocked integration tests |
| A6 | Maintainability, normal | Multiple route handlers are single-line implementations with validation, orchestration, and error response together | Harder security/contract review and targeted testing | Format/refactor per domain in small behavior-preserving PRs |
| A7 | Architecture, normal | Supabase access is distributed across services and route handlers without generated database types | Column/relationship drift is detected late | Adopt generated types after schema baseline is authoritative |
| A8 | Operations, high | Marketplace, procurement, approval, demo-seed, and runtime mutation routes coexist with read APIs | Accidental Production smoke can mutate data or incur cost | Maintain explicit safe route manifest and approval boundary |
| A9 | Delivery config, external | Preview workflow requires exact GitHub Deployment and `VERCEL_AUTOMATION_BYPASS_SECRET` | Missing integration/secret blocks Preview validation, not a code defect | Verify through PR checks; report exact owner action if blocked |
| A10 | Documentation, normal | Root README is the default create-next-app text | New engineers cannot discover domains, safety boundaries, or actual commands | Replace in a focused follow-up to avoid mixing product docs with audit baseline |

## Contract observations

- Migrations define foreign-key-backed embedded relations for market metrics, suppliers, workflow timelines, listing drafts, and Coupang jobs.
- The branch’s explicit query constants are preferable to ambiguous/unbounded selects and preserve response keys through aliases.
- Known unavailability is limited by `lib/api-responses.ts`; unexpected application errors return 500. This is acceptable only for optional reads and must remain observable.
- No evidence supports creating a new migration in this session.

## Root-cause conclusion

The largest reliability bottleneck is database provenance, not a missing catch or UI fallback. Reproducible schema history and deployed migration verification must precede typed-query expansion and wider automation. The fastest revenue-safe next step is improving evidence-driven opportunity ranking on the existing read/decision path while keeping external writes approval-gated.
