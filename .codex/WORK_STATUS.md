# Work status

## Objective

Build a restartable engineering operating system, audit the application and database contracts, and prepare the next three revenue-oriented sprints without production writes or schema changes.

## Current branch

`codex/chore/codex-engineering-system`

## Risk level

Normal-risk: documentation, templates, static audit, and validation only. This branch already contains commit `c75a7c1` (Supabase read relationship alignment) from before this session; it must be reviewed as part of the PR.

## Scope

- Repository operating rules and reusable task/session/review templates
- Project map, architecture, development, deployment, testing, database, and operations guides
- Static API/database consistency and technical-debt audit
- Revenue roadmap, three sprint plans, backlog, and exact next actions
- Full local verification, push, Draft PR, and Preview checks where available

## Non-goals

- Migrations, RLS, authentication/authorization, secrets, or environment configuration
- Production data mutation or real Coupang/order/inventory/supplier operations
- API contract changes, broad refactors, feature deletion, test skips, or auto-merge

## Progress checklist

- [x] Confirm safe non-main branch and clean starting tree
- [x] Read request, `AGENTS.md`, and all `.ai` documents
- [x] Inventory configuration, workflows, routes, services, migrations, tests, and existing docs
- [x] Build Codex operating documents
- [x] Build GitHub templates
- [x] Document repository structure and operations
- [x] Complete API/database static audit
- [x] Rank technical debt and roadmap
- [x] Plan three sprints and next actions
- [x] Review diff and run all local gates
- [x] Commit, push, open/update Draft PR, and validate Preview

## Root cause classification

Current task is capability/documentation work. Audit findings must be classified external configuration → database → code before remediation.

## Completed work

- Verified branch `codex/chore/codex-engineering-system` is not `main`; starting tree was clean.
- Read the UTF-8 request and all mandatory `.ai` documents.
- Identified existing delivery workflows and a missing `.codex` workspace/issue-template set.
- Enumerated App Router pages/APIs, services, migrations 003–020, and test commands.
- Built eight reusable `.codex` controls and five GitHub contribution templates.
- Added code-backed project/architecture/development/deployment/testing/database/operations guides.
- Recorded the missing pre-003 schema baseline, query coupling, coverage gaps, and delivery dependencies.
- Ranked the roadmap and prepared three revenue-oriented sprints with exact tickets and non-goals.

## Current work

Session deliverables are complete; final status checkpoint is being committed.

## Blockers

None for local documentation and static audit.

## User action required

None currently. Vercel/GitHub owner actions will be recorded only if delivery checks expose a configuration blocker.

## Files changed

`AGENTS.md`, `.ai/current-sprint.md`, `.codex/**`, `.github/**`, root guides/audit/roadmap/changelog, and `docs/planning/**`.

## Commands executed

- `git branch --show-current`
- `git status --short --branch`
- `git diff --stat origin/main...HEAD`
- Repository inventories with `rg`, `Get-ChildItem`, and `Get-Content`
- `git diff --check`
- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run test:e2e:local`
- GitHub CI run `30084543162`
- Preview browser run `30084543191`

## Test results

- Diff check: passed.
- Lint: passed.
- Typecheck: passed.
- Unit/integration: 13 passed, 0 failed, 0 skipped; Node reported a module-type performance warning.
- Production build: passed; Next.js generated 65 route entries.
- Local Playwright: 24 tests executed; 7 page-health failures and command timeout. `/listing`, `/market`, `/procurement`, `/revenue`, `/sourcing`, `/workflow`, and `/workspace` observed API 500 responses because local Supabase is explicitly unconfigured (`missing_url`). This is an external configuration condition, not a code workaround target. Failure artifacts are under `test-results/`.
- GitHub CI: passed.
- Exact Vercel Preview `https://gonggamline-qfctfznhb-gg-online.vercel.app`: Ready and accessible through the configured bypass secret.
- Preview Playwright: 24 passed in 52 seconds; no reported page/console/request failures. Evidence artifact: `preview-browser-evidence` (run `30084543191`, artifact `8593186249`).
- CI dependency install reported 3 high-severity vulnerabilities; triage is recorded in `TECH_DEBT.md` and no unsafe forced upgrade was attempted.

## Last commit

`5261ad2 docs: establish engineering operating system` (plus pre-existing `c75a7c1` in local history; current PR diff contains the documentation commit).

## Next exact action

Begin S1-01 from `docs/planning/NEXT_ACTIONS.md` on a new clean task branch after PR #11 is manually reviewed.

## Remaining risks

- Static analysis cannot prove the deployed Supabase schema matches migrations.
- Existing branch commit must pass full validation and Preview checks.
- Preview automation depends on GitHub/Vercel deployment and bypass-secret configuration.
- Static query inventory may miss dynamic SQL or external consumers; no column removal is authorized from this audit.
- Local full-page Playwright cannot pass until a safe test Supabase URL and anon key are supplied; never commit or print them.
- `npm ci` reports 3 high-severity dependency vulnerabilities requiring focused audit and upgrade review.
