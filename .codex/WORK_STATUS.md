# Work status

## Objective

Audit Product Data Readiness for the Revenue Opportunity Engine and make only
the minimum evidence-backed changes without affecting Runtime behavior.

## Current branch

`codex/feat/revenue-data-readiness`

## Risk level

Normal-risk. This task changes documentation only. It does not change schema,
price/margin calculations, APIs, Competition, AI, Workflow, or Runtime.

## Scope and non-goals

- Audit Product, Competition, Market, Supplier, and Revenue schema evidence.
- Classify required Revenue inputs as present, missing, needed, or unnecessary.
- Audit `/api/products` and Competition API exposure.
- Do not add a migration without evidence from the actual database.
- Do not change recommendation algorithms, AI logic, workflow, or Runtime.

## Root-cause class

Database readiness/contract gap. The repository lacks the initial `products`
DDL, so core-column nullability cannot be verified locally. Existing fields
cover most numeric inputs, while provenance, authoritative relationships, and
ROI semantics are not yet defined.

## Completed work

- Confirmed a clean non-main branch and corrected its duplicated prefix.
- Read the mandatory repository, risk, delivery, browser, and Next.js route
  handler guidance.
- Audited Product storage/read/update paths and related TypeScript consumers.
- Audited Product, Competition, Market Intelligence, Supplier, and Revenue
  migrations.
- Confirmed `/api/products` already returns all stored Product and Competition
  fields.
- Determined that migration/API/type changes are not currently justified.
- Added the Revenue Data Readiness report and Sprint 2 changelog.

## Current work

Local verification is complete. Delivery and exact-commit Preview validation
are pending.

## Blockers and owner actions

Actual `products` schema/nullability and Production data completeness require a
read-only Supabase inspection. No Supabase connection is configured in the
workspace, and the repository contains only an environment example.

Owner inspection path if no automated read-only connection is available:
Supabase Dashboard > project > Table Editor > `products` (columns/defaults/
nullable), then SQL Editor for aggregate null/zero/freshness counts. Project
URL and anon/service keys must remain secret and must not be pasted into the
report or committed.

## Changed files

- `docs/reports/REVENUE-DATA-READINESS.md`
- `CHANGELOG-Sprint2-Product-Data-Readiness.md`
- `.codex/WORK_STATUS.md`

## Commands and test results

- Repository/schema/API/type audit: completed.
- `git diff --check`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: 15 passed, 0 failed.
- `npm.cmd run build`: passed; 65 route entries generated.
- Manual read-only browser checks: `/`, `/competition`, and `/revenue` rendered
  meaningful headings/content; no captured browser console errors.
- `GET /api/products`: HTTP 200 with the documented unconfigured response
  (`available: false`, empty products).
- `npm.cmd run test:e2e:local`: 17 passed, 7 failed. All 7 failures are the
  existing external-configuration condition caused by absent local Supabase
  configuration. Affected routes: `/listing`, `/market`, `/procurement`,
  `/revenue`, `/sourcing`, `/workflow`, and `/workspace`. Revenue-critical
  checks, Product API health, `/`, and `/competition` passed. Failure evidence
  is under `test-results/`.
- Preview and Production validation: pending.

## Last commit

Pending.

## Exact next action

Review the complete diff, commit and push the documentation-only scope, create
the PR, and validate its exact-commit Vercel Preview.

## Remaining risks

- Actual database nullability may differ from application assumptions.
- Existing zero/default values may mean unknown rather than measured zero.
- Product, market product, and supplier identities are not authoritatively
  linked for Revenue Opportunity calculation.
- ROI and cost provenance require business/data-contract approval before
  implementation.
