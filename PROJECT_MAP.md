# Project map

## Runtime shape

Next.js 16 App Router application with 15 page routes and 65 route handlers. Pages live in `app/**/page.tsx`; HTTP boundaries live in `app/api/**/route.ts`. Route handlers delegate primarily to 15 files in `services/`, which use `lib/supabase.ts`, domain helpers, `features/`, and typed engines.

## User surfaces

| Area | Routes | Primary implementation |
|---|---|---|
| Revenue and company OS | `/`, `/revenue`, `/os`, `/system` | `services/revenue-core.service.ts`, `services/company-os.service.ts`, runtime APIs |
| Discovery and market | `/market`, `/competition`, `/discovery` | `services/market-*.service.ts`, `features/competition`, `services/discovery.service.ts` |
| Sourcing and procurement | `/sourcing`, `/procurement`, `/workflow` | `services/sourcing.service.ts`, `procurement.service.ts`, `workflow.service.ts` |
| Listing and marketplace | `/listing`, `/workspace`, `/coupang`, `/coupang/register`, `/seller` | `listing.service.ts`, `workspace.service.ts`, `coupang-seller.service.ts`, `lib/coupang/**` |

## Domain engines

- Discovery Engine: `lib/discovery/engine.ts`, `engines/discovery`, discovery services/routes.
- Competition Engine: `features/competition/**`, product competition APIs.
- Marketplace Intelligence: `lib/market/**`, market services, collectors, migrations 005–008.
- Supplier/Procurement: `engines/supplier`, `engines/procurement`, migrations 010–011.
- Listing Engine: `engines/listing`, listing service/routes, migration 012.
- Coupang Seller Engine: `engines/coupang`, `lib/coupang/**`, migration 014. Registration endpoints are write boundaries and high-risk.
- Decision/Memory/Company OS: migrations 015–018 and `services/company-os.service.ts`.
- Revenue/Runtime Queue/Workers: `services/revenue-core.service.ts`, `runtime-execution.service.ts`, `lib/runtime/**`, migrations 019–020.

## Supabase access and schema

`lib/supabase.ts` validates public Supabase configuration and creates the client. Services issue PostgREST queries directly. Migrations 003–020 define 50 observed tables across market, discovery, sourcing, procurement, listing, workflow, Coupang, company OS, revenue, and runtime. The repository does not contain the migration that creates the referenced base `products` table; deployed schema provenance must be verified before treating migrations as reproducible.

## Commerce workflow

Market observation → competition analysis → discovery recommendation → human approval → supplier quote/decision → procurement/3PL plan → commerce workflow → listing draft/revision → Coupang registration job/attempt → runtime/revenue measurement. External writes and financial decisions remain explicit high-risk boundaries.

## Tests and delivery

- Unit/integration: `tests/*.test.ts` via Node test runner.
- Browser: `tests/e2e/**`; route source is `tests/e2e/routes.ts`.
- CI: `.github/workflows/ci.yml`.
- Preview: exact-commit GitHub Deployment resolution, then Playwright in `preview-e2e.yml`.
- Production: post-merge read-only Playwright smoke in `production-browser-smoke.yml`.
- Native auto-merge workflow exists for eligible normal-risk PRs, but this operating-system session must remain manual per user request.
