# Work status

## Current task snapshot

- Objective: implement the approved Domeggook Read-only Supplier Catalog
  Adapter v1 without Product, Revenue, DB, Migration, Queue, bulk, Coupang, or
  external-write changes.
- Branch: `codex/feat/domeggook-readonly-adapter-v1`.
- Risk: normal-risk. This is a read-only external adapter and sanitized health
  API within an approved Architecture Story.
- Revenue impact: P1 enabling work. It creates the safe supplier-catalog read
  boundary required before first-product discovery.
- Root-cause class: code/capability gap. Existing routes call Domeggook
  directly and mix provider access with Product/Revenue behavior.
- Completed: mandatory boot/compliance/risk checks; existing-contract audit;
  provider-neutral domain port; provider DTO/parser; dedicated mapper; typed
  error taxonomy; bounded client with timeout/retry/backoff/jitter and
  concurrency ceiling; application service; network-free default health;
  explicit cached size-one provider verification; unit/contract/HTTP/E2E
  coverage.
- Current work: local implementation and Release Gate validation are complete;
  prepare the implementation commit and exact-head delivery.
- Blockers/owner actions: none. No credential value was read or changed.
- Changed files: Supplier Catalog domain contract, `lib/domeggook/**`,
  Supplier Catalog and Domeggook health services, the new health route,
  Domeggook unit/contract tests, safe API E2E coverage, Decision Log,
  changelog, and this status file.
- Commands/results: focused adapter/health suite 26/26 passed; full unit and
  contract suite 217/217 passed; typecheck passed; lint passed with zero errors
  and four pre-existing Revenue-test warnings; production build passed with 68
  routes; `git diff --check` passed. Local Chromium executed all 39 tests:
  32 passed, including the new Domeggook health contract; the same seven
  existing Supabase-dependent routes failed because local Supabase is
  unconfigured (`/listing`, `/market`, `/procurement`, `/revenue`, `/sourcing`,
  `/workflow`, `/workspace`). The outer command timed out after all cases ran
  while Playwright was finalizing.
- Delivery: not committed, pushed, or opened as a PR yet.
- Last commit: `3fbe117 Architecture: Domeggook Read-only Supplier Catalog
  Adapter v1 (#24)`.
- Exact next action: commit the reviewed change, push, open the Story PR, and
  validate exact-head CI and configured Preview before merge.
- Remaining risks: official Domeggook quota remains unverified. Real provider
  authentication is optional and must be checked only through the explicit
  read-only provider health mode when the deployment credential is configured.

## Current task snapshot

- Objective: approve and deliver the Architecture Story for Domeggook Read-only
  Supplier Catalog Adapter v1; do not implement it.
- Branch: `codex/docs/domeggook-readonly-adapter-architecture-v1`.
- Risk: normal-risk, documentation-only architecture change.
- Revenue impact: P1 first-product discovery enablement. It isolates the
  sourcing provider boundary without starting Product, ordering, or marketplace
  writes.
- Root-cause class: architecture/capability gap. Existing Domeggook routes mix
  provider transport, parsing, financial calculation, and persistence and
  cannot provide a safe classified health signal.
- Scope: one Architecture Story, Architecture Review approval, Decision Log,
  minimal Epic Roadmap link, changelog, status, validation, and delivery.
- Non-goals: adapter or route implementation, credential changes, external API
  calls, Product collection, Revenue changes, DB/Migration, Queue, supplier
  order, content generation, or Coupang work.
- Completed: required boot and compliance review; clean synchronized `main`;
  non-main branch creation; current-state evidence review; architecture
  decisions for boundary, DTOs, operations, configuration, errors,
  timeout/retry, rate controls, health, persistence, Queue, observability,
  testing, rollout, rollback, and later implementation Definition of Done;
  document/link/scope checks; duplicate-section diff correction; lint,
  typecheck, 191 tests, build, and all 31 locally configurable browser checks.
- Current work: prepare the architecture documentation commit and delivery.
- Blockers/owner actions: seven existing browser routes require unavailable
  local Supabase configuration. This external configuration condition is
  unchanged; exact Preview remains the deployed gate.
- Changed files: Architecture Story, `.ai/ARCHITECTURE_REVIEW.md`,
  `.ai/DECISION_LOG.md`, `.ai/EPIC_ROADMAP.md`, changelog, and this status.
- Commands/results: required decisions, all relative Markdown file links,
  documentation-only scope, unique approval sections, and `git diff --check`
  passed. Lint passed with four pre-existing warnings and no errors; typecheck
  passed; unit/integration passed 191/191; production build passed with 67
  generated pages. Local Chromium ran all 38 checks: 31 passed and the same
  seven Supabase-dependent routes failed with HTTP 500 because local Supabase
  is unconfigured (`/listing`, `/market`, `/procurement`, `/revenue`,
  `/sourcing`, `/workflow`, `/workspace`). Ignored evidence is under
  `test-results/`.
- Delivery: not committed, pushed, or opened as a PR yet.
- Last commit: `368ed196 Project Bootstrap v1.0 (#23)`.
- Exact next action: stage only the six documentation/status files, commit,
  push, open the PR, and require exact-head CI/Preview before squash merge.
- Remaining risks: provider quota remains unknown and must not be guessed; the
  later implementation must preserve existing Domeggook/Product/Revenue public
  behavior and remain DB/Queue-free.

## Previous task snapshot

- Objective: deliver Project Bootstrap v1.0, a permanent architecture-driven
  repository operating system for all future Stories.
- Branch: `codex/chore/project-bootstrap-v1`.
- Risk: normal-risk documentation only. Existing policy makes the initial
  automation/project bootstrap manual even though normal-risk.
- Revenue impact: P2/P3 enabling control. Repeatable architecture and delivery
  gates reduce rework and operational risk on the shortest revenue path.
- Root-cause class: capability/governance gap. Existing controls were useful but
  did not provide the requested permanent CTO/constitution/architecture boot,
  templates, architecture stop gate, or Epic 4-9 architecture roadmap.
- Scope: root README bootloader, 19 required `.ai` documents, integration with
  existing controls, Decision Log, changelog, link/reference validation, and
  full applicable delivery.
- Non-goals: Workspace, Queue, Upload, Product feature, Revenue Engine,
  Dashboard, API/business logic, database/schema/migration, or external writes.
- Completed: read task and binding repository controls; confirmed the exact
  clean non-main branch; classified risk; audited architecture, project,
  database, testing, operations, PR, and workflow sources; designed and wrote
  the permanent operating-system documents; passed document/link/scope checks,
  lint, typecheck, 191 unit/integration tests, production build, and all 31
  locally configurable browser checks.
- Current work: local implementation and validation complete; remote delivery
  is paused before staging because the required GitHub CLI is unavailable.
- Blockers/owner actions: seven local browser routes depend on unavailable local
  Supabase configuration. This is an existing external-configuration condition,
  not a code defect; exact-commit Preview remains the deployed gate. Merge also
  remains subject to the stricter manual-bootstrap policy. GitHub CLI `gh` is
  not installed or available on the host PATH, so the authenticated publish
  workflow cannot verify auth, commit/push, or create the PR.
- Changed files: `README.md`, 19 required `.ai` documents, this status file,
  and `CHANGELOG-Project-Bootstrap-v1.md`.
- Commands/results: all 19 required files exist; both README indexes reference
  every required document; all relative Markdown links resolve; documentation-
  only scope and `git diff --check` passed. Lint passed with four pre-existing
  warnings and no errors; typecheck passed; unit/integration tests passed
  191/191; production build passed with 67 generated pages. Local Chromium ran
  38 checks: 31 passed and seven existing Supabase-dependent routes failed with
  HTTP 500 because local Supabase is unconfigured (`/listing`, `/market`,
  `/procurement`, `/revenue`, `/sourcing`, `/workflow`, `/workspace`). Evidence
  is retained under ignored `test-results/`.
- Delivery: not staged, committed, pushed, or opened as a PR. Publishing stopped
  at the GitHub workflow prerequisite check.
- Last commit: `f391a79 test: harden Revenue Dashboard release (#22)`.
- Exact next action: owner installs GitHub CLI and authenticates it, then rerun
  `gh --version` and `gh auth status`; resume with explicit staging, commit,
  push, PR creation, and exact-head CI/Preview verification.
- Remaining risks: remote CI/Preview configuration may block delivery and must
  not be compensated for in code; the bootstrap requires manual merge under the
  stricter pre-existing delivery policy.

## Previous task snapshot

- Objective: complete Story 3-5 Revenue Dashboard Release Hardening after
  Story 3-4 Production verification.
- Branch: `codex/chore/revenue-dashboard-release-hardening`.
- Risk: normal-risk. Tests, browser evidence, documentation, and generated-file
  hygiene only.
- Revenue impact: P0/P2 release safety. Regression and rollback evidence reduce
  deployment risk and shorten recovery while preserving operator availability.
- Root-cause class: release assurance gap. Functionality is complete, but final
  cross-layer invariants, limitations, rollback, architecture, and evidence
  hygiene need explicit verification.
- Scope: regression/contract tests, browser/network/accessibility/performance
  review, screenshot evidence, architecture/changelog/status, limitations,
  rollback, and generated output ignores.
- Non-goals: new feature, API redesign, DB/migration, Revenue engine change,
  Runtime, environment, or external write.
- Completed: squash-merged Story 3-4 PR #21 at `54ded32`, passed Production
  Revenue smoke 10/10 after propagation attempt 2, created the hardening branch,
  added cross-layer release tests, screenshot evidence, architecture,
  limitations/rollback docs, changelog, and generated-output ignores.
- Current work: local release gates complete; prepare the release-hardening
  commit and exact deployed validation.
- Blockers/owner actions: none.
- Changed files: release regression test, Revenue E2E, `.gitignore`,
  `ARCHITECTURE.md`, release/rollback docs, Sprint 3 changelog, and status.
- Commands/results: release-boundary tests 8/8 and full unit 191/191 passed;
  typecheck passed; lint passed with four pre-existing warnings and no errors;
  production build passed with 67 routes; `git diff --check` passed. Full local
  Chromium ran 38 checks: 31 passed, including all Revenue Dashboard API/UI,
  search, filter, pagination, refresh, retry, duplicate-network, accessibility,
  mobile, and screenshot scenarios. Seven known external-configuration checks
  failed because local Supabase is unconfigured: `/listing`, `/market`,
  `/procurement`, legacy `/revenue`, `/sourcing`, `/workflow`, `/workspace`.
  Their APIs returned HTTP 500 as designed; evidence is retained under ignored
  `test-results/`. No code compensation is appropriate.
- Delivery: not committed, pushed, or opened as a PR yet.
- Last commit: `54ded32 feat: harden Revenue Dashboard operational UX (#21)`.
- Exact next action: commit, push, open the hardening PR, and require configured
  exact-head Preview to pass the complete browser suite before squash merge.
- Remaining risks: full local all-route E2E may retain known external Supabase
  configuration failures; exact Preview remains the deployed release gate.

## Previous task snapshot

- Objective: implement Story 3-4 Revenue Dashboard Operational UX after
  Story 3-3 Production verification.
- Branch: `codex/feat/revenue-dashboard-operational-ux`.
- Risk: normal-risk. Presentation, accessibility, responsive behavior, tests,
  and documentation only.
- Revenue impact: P2 operational efficiency. Clear data freshness, filter
  context, reset, retry, and readable dense rows reduce operator mistakes and
  repeated work during long-running Dashboard use.
- Root-cause class: code/usability gap. Search is operational, but generated
  versus refreshed time, active filters, long content, and duplicate/retry
  behavior need explicit presentation and coverage.
- Scope: distinct timestamps, active-filter summary, clear-all, long Product
  and reason containment, request-state controls, retry, mobile, live-region,
  keyboard, E2E, and docs.
- Non-goals: API/DTO changes, current time as analysis time, new calculation,
  design-system expansion, DB/migration, Runtime, or external write.
- Completed: squash-merged Story 3-3 PR #20 at `76daa84`, passed Production
  Revenue smoke 10/10, created the required branch, and implemented the
  operational presentation and focused coverage.
- Current work: all local gates passed; prepare implementation commit and
  remote delivery.
- Blockers/owner actions: none. Generated Playwright artifacts remain untracked.
- Changed files: Revenue Dashboard component/styles/UI tests/E2E, UI docs,
  Sprint 3 changelog, and this status file.
- Commands/results: focused UI tests 37/37 and full unit 183/183 passed;
  typecheck passed; lint passed with four pre-existing warnings and no errors;
  production build passed with 67 routes; operational Chromium E2E passed 4/4;
  `git diff --check` passed. The first E2E run found Next's route announcer also
  uses `role=alert`; the retry assertion was narrowed to the Dashboard error
  state without changing production code or weakening expected error text.
- Delivery: not committed, pushed, or opened as a PR yet.
- Last commit: `76daa84 feat: add Revenue Dashboard search and URL state (#20)`.
- Exact next action: commit, push, open the independent Story PR, and validate
  exact-head CI/Preview before squash merge.
- Remaining risks: browser timing must confirm double-click suppression and
  retry transition; mobile containment must be visually and mechanically clean.

## Previous task snapshot

- Objective: implement Story 3-3 Revenue Dashboard Search and URL State after
  verifying PR #19 merge and Production.
- Branch: `codex/feat/revenue-dashboard-search`.
- Risk: normal-risk. Read-only query extension, URL state, UI, tests, and docs.
- Revenue impact: P1 operator decision speed. Searchable, shareable filtered
  views reduce time to find and hand off a ranked Product.
- Root-cause class: code/capability gap. The Dashboard has server pagination
  but no Product search or restorable/shareable state.
- Architecture decision: add an optional bounded `keyword` to the existing
  Dashboard GET query and delegate it to the existing Product query before
  Ranking pagination. Never filter only the current client page. Keep state in
  local React state and the URL, using submitted search to avoid request fan-out.
- Scope: Product search, clear action, URL synchronization/restoration,
  combined filters and pagination, API contract tests, E2E, and docs.
- Non-goals: DB/migration, Revenue algorithms, global store, external writes,
  debounce, or new business calculation.
- Completed: confirmed PR #19 merged at `1f81514`, fast-forwarded main, and
  passed Production Revenue page/API smoke 9/9. Created the required branch,
  implemented bounded server Product search, URL parsing/serialization,
  refresh/history restoration, search/clear UX, and focused unit/E2E coverage.
- Current work: local validation and browser verification passed; prepare
  implementation commit and remote delivery.
- Blockers/owner actions: none. The first Production readiness loop failed
  because sandbox network access returned no response; one unrestricted request
  returned HTTP 200 and unrestricted Production E2E passed, proving no
  deployment defect. Existing generated Playwright artifacts remain untracked.
- Changed files: `lib/revenue/dashboard.ts`,
  `services/revenue-dashboard.service.ts`,
  `app/dashboard/revenue/page.tsx`,
  `components/revenue-dashboard/revenue-dashboard.tsx`, `app/globals.css`,
  Revenue Dashboard unit/contract/E2E tests, Dashboard API/UI docs, changelog,
  and this status file.
- Commands/results: focused Dashboard/API/UI tests 72/72 passed; full unit
  181/181 passed; typecheck passed; lint passed with four pre-existing Revenue
  test warnings and no errors; production build passed with 67 routes; Story
  production-mode API/UI E2E passed 11/11; `git diff --check` passed.
  The first browser runs exposed two separate issues without weakening tests:
  a stale local Next server served old HTML against rebuilt assets, then the
  dynamic page returned digest `1212929221` because a Server Component called
  a function exported from a `"use client"` module. The pure URL-state helpers
  were moved to `lib/revenue/dashboard-ui-state.ts`; a clean server rerun passed.
- Delivery: not committed, pushed, or opened as a PR yet.
- Last commit: `1f81514 Merge pull request #19 from
  gonggam-online/codex/feat/revenue-dashboard-ui`.
- Exact next action: commit, push, open the Story PR, and validate exact-head
  CI and Preview before squash merge.
- Remaining risks: Product search relies on existing Supabase `ilike` behavior;
  Preview must confirm combined search totals and pagination.

## Previous task snapshot

- Objective: implement Sprint 3 Revenue Dashboard UI v1 as an operator-ready
  presentation over the existing Dashboard API.
- Branch: `codex/feat/revenue-dashboard-ui`.
- Risk: normal-risk. Read-only UI, documentation, and tests only.
- Revenue impact: P1 decision support. Operators can compare Product priority,
  Revenue Score, confidence, and recommendation evidence from one view.
- Root-cause class: code/capability gap. The API and shared presentation
  foundation exist, but there is no operator-facing Revenue Dashboard.
- Scope: `/dashboard/revenue`, local filters/pagination/refresh, summary cards,
  ranked table, loading/empty/error states, responsive/accessibility behavior,
  at least 25 UI tests, E2E, and documentation.
- Non-goals: API/DTO changes, Revenue Calculation/Score/Ranking changes,
  DB/migrations, global state, Queue, Workers, OpenAI/LLM, or commerce writes.
- Completed: read binding repository and Next.js 16 guidance; verified the
  non-main branch, safe worktree, merged PR #17, merged Dashboard Foundation,
  and existing Dashboard API contract; classified the story normal-risk;
  implemented the page, local state, API-only data flow, responsive table,
  required UI states, badges, summary, filters, refresh, pagination,
  accessibility, 31 focused tests, E2E coverage, and architecture docs.
- Current work: implementation and delivery gates passed; record exact delivery
  evidence and the native auto-merge blocker.
- Blockers/owner actions: GitHub rejected native auto-merge with `Pull request
  is in clean status`, which means the PR is immediately mergeable rather than
  waiting behind a required gate. PR #19 remains Ready and unmerged because the
  task authorizes native auto-merge, not an immediate manual merge. An owner can
  merge PR #19 from GitHub > Pull requests > #19 > Merge pull request. No secret
  value is required. Untracked Playwright reports are preserved and excluded.
- Changed files: `app/dashboard/revenue/page.tsx`,
  `components/revenue-dashboard/revenue-dashboard.tsx`, `app/globals.css`,
  `tests/revenue-dashboard-ui.test.tsx`,
  `tests/e2e/revenue-dashboard-ui.spec.ts`, `tests/e2e/routes.ts`,
  `docs/revenue-dashboard-ui.md`, `CHANGELOG-Sprint3.md`, and this file.
- Commands/results: focused UI tests 31/31 passed; full unit suite 174/174
  passed; typecheck passed; production build passed with 67 routes; lint passed
  with four pre-existing Revenue test warnings and no errors; `git diff
  --check` passed. Mocked operator-flow Chromium E2E passed 1/1. Production-mode
  read-only page and Dashboard API browser checks passed 9/9 with no page,
  console, API, or failed-request errors. The first Playwright invocation
  exceeded its outer command timeout during automatic server cleanup; the same
  test passed with the production server lifecycle controlled explicitly.
- Delivery: implementation commit `bc49032` is pushed. PR #19 is Ready for
  Review, conflict-free, and targets `main`. Exact-commit CI run `30157490435`
  passed. Exact Vercel Preview
  `https://gonggamline-ai-git-codex-featrevenue-dashboard-ui-gg-online.vercel.app`
  is Ready and Preview browser run `30157490442` passed; evidence artifact
  `8619411309`. Native auto-merge was attempted only after every gate passed
  and GitHub rejected it because the PR is already in clean/mergeable status.
  The PR remains open and Production is unchanged.
- Last commit: `bc49032 feat: add revenue dashboard UI`.
- Exact next action: owner review and merge PR #19, followed by non-destructive
  Production health/API/browser smoke validation.
- Remaining risks: summary averages describe only the returned result page and
  are labeled accordingly. Local Supabase configuration may still block
  unrelated existing routes; code must not compensate for that external state.

## Previous task snapshot

- Objective: build the Sprint 3 shared Dashboard Foundation for Revenue,
  Upload Queue, Product, and AI Recommendation dashboards.
- Branch: `codex/feat/dashboard-foundation`.
- Risk: normal-risk. This is presentation UI, documentation, and tests only.
- Revenue impact: P3 enabling work. It shortens later Revenue Dashboard delivery
  and prevents duplicate UI/state patterns across operational dashboards.
- Root-cause class: code/capability gap. Domain engines and the read-only
  Dashboard API exist, but reusable Dashboard presentation primitives do not.
- Scope: layout, header, content, toolbar, section, card, empty/error/loading
  states, pagination, shared styling, architecture docs, and at least 20 tests.
- Non-goals: Revenue table/card/page, API calls or changes, global state,
  Context, DB/migrations, Queue, Workers, OpenAI, and commerce writes.
- Completed: read repository, `.ai`, Next.js 16, GitHub delivery, and browser
  rules; confirmed the requested non-main branch; classified risk; audited the
  current UI/style/test structure; designed and implemented presentation-only
  Dashboard primitives, responsive styling, architecture documentation, and
  25 SSR rendering/accessibility/props/state/boundary tests. Reviewed the
  complete change surface and confirmed no API, service, engine, migration, DB,
  Queue, Worker, OpenAI, or commerce-write files changed.
- Current work: delivery gates are complete; record the final Ready PR and
  native auto-merge blocker.
- Blockers/owner actions: GitHub native auto-merge is disabled for the
  repository, so the validated normal-risk PR cannot enable auto-merge. An
  owner may enable it at GitHub repository > Settings > General > Pull Requests
  > Allow auto-merge, then enable auto-merge on PR #18. No secret value is
  required.
- Changed files: `components/dashboard/dashboard.tsx`,
  `components/dashboard/index.ts`, `app/globals.css`,
  `tests/dashboard-foundation.test.tsx`, `docs/dashboard-ui-architecture.md`,
  `package.json`, `package-lock.json`, `CHANGELOG-Sprint3.md`, and this file.
- Commands/results: focused Foundation tests 25/25 passed; full unit suite
  143/143 passed; typecheck passed; production build passed; lint passed with
  four pre-existing Revenue-test warnings and no errors; `git diff --check`
  passed. Local Playwright completed 32 cases: 25 passed and 7 existing
  Supabase-dependent routes failed because local Supabase is unconfigured
  (`/listing`, `/market`, `/procurement`, `/revenue`, `/sourcing`, `/workflow`,
  `/workspace`). Failure traces, screenshots, and video are in `test-results/`.
- Delivery: implementation commit `41fcd54` is pushed. PR #18 is Ready for
  Review, conflict-free, and targets `main`. Exact-commit CI run `30154829822`
  passed. Exact Preview
  `https://gonggamline-kn5ds4qi3-gg-online.vercel.app` passed all 32 browser/API
  checks in run `30154829823`; evidence artifact `8618698857`. Native auto-merge
  was attempted after every gate passed but GitHub rejected it because the
  repository setting is disabled. The PR remains open and unmerged.
- Last commit: `41fcd54 feat: add dashboard foundation`.
- Exact next action: enable repository native auto-merge and enable it for PR
  #18, or manually review and merge the Ready normal-risk PR.
- Remaining risks: Production is unchanged while PR #18 remains open.
  Foundation composition on a real page is intentionally deferred to the next
  Revenue Dashboard Story. Local full-route E2E cannot pass until Supabase
  configuration is available; code must not compensate for that external
  condition.

## Previous task snapshot

- Objective: implement the Sprint 3 read-only Revenue Dashboard API.
- Branch: `codex/feat/revenue-dashboard-api`.
- Risk: normal-risk. The endpoint is read-only analytics and does not change
  financial formulas, schema, authorization, or external writes.
- Revenue impact: P1 decision support. The API exposes the highest-priority
  Products to Dashboard consumers without duplicating Revenue logic.
- Root-cause class: code/capability gap. Ranking exists, but there is no
  Dashboard-specific filtering, pagination, and response contract.
- Scope: `GET /api/dashboard/revenue`, Query Service, Ranking-backed public
  DTO, strict query validation, AND filters, deterministic multi-key sorting,
  global-rank pagination, contract, docs, and Preview.
- Non-goals: Ranking/Score/Calculation changes, DB/migrations, Queue, Workers,
  OpenAI/LLM, write APIs, Dashboard UI, Production mutation.
- Completed: read binding repository/Next.js/GitHub/browser instructions;
  verified PR #16 and its Release Gate are merged into `origin/main`; created
  the requested branch; implemented the thin GET route, Query Service, public
  DTO mapper, strict error contract, global-rank pagination, deterministic
  sorting, focused tests, response contract, Preview API health checks, and
  docs. Reviewed the diff and confirmed no engine, DB, migration, Queue,
  Worker, LLM, or write-API changes.
- Current work: commit and deliver the strict API-contract completion.
- Blockers/owner actions: none.
- Changed files: `lib/revenue/dashboard.ts`,
  `services/revenue-dashboard.service.ts`,
  `app/api/dashboard/revenue/route.ts`, `tests/revenue-dashboard.test.ts`,
  `tests/revenue-dashboard-contract.test.ts`, `tests/e2e/api-health.spec.ts`,
  `ARCHITECTURE.md`, `docs/revenue-dashboard-api.md`,
  `CHANGELOG-Sprint3.md`, and this file.
- Results: focused Dashboard suite 35/35 passed; full unit suite 118/118
  passed, including the existing Product API contract; typecheck and production
  build passed; lint passed with four pre-existing warnings; production-mode
  local Playwright Dashboard API E2E passed 8/8. The first direct Playwright
  attempt failed only because no server was listening (`ECONNREFUSED`); after
  explicitly starting the built app and confirming health, all scenarios
  passed.
- Delivery: PR #17 exists as Draft. The first implementation commit
  `c6fb782b482540a95d227e2427e6fcbc371f8e5e` is pushed and its CI/Preview
  passed; strict contract completion is pending commit, push, exact-commit CI,
  Ready for Review, and exact Preview validation.
- Last commit: `c6fb782 feat: add revenue dashboard API`.
- Exact next action: commit and push strict contract completion, then validate
  exact-commit CI and Preview before completing the PR Release Gate.
- Remaining risks: the read service caps one Dashboard request at 10,000 source
  Products; missing Product identity or analysis timestamps remain `null`.

## Previous task snapshot

- Objective: implement the Sprint 2 Revenue Calculation Engine from existing
  Product data, with deterministic states, an opt-in Product API DTO, tests,
  and documentation.
- Branch: `codex/feat/revenue-calculation-engine`
- Risk: high-risk because repository policy classifies pricing and margin
  calculation changes as high-risk; `manual-merge-required`, no auto-merge.
- Root-cause class: code/capability gap. Product inputs exist, but no shared
  strict calculation/readiness contract existed.
- Scope: pure calculations, Product mapper, opt-in read DTO, tests, docs.
- Non-goals: migrations, DB writes, ROI invention, Revenue Score,
  Competition/Discovery/Workflow/Runtime changes.
- Completed: fast-forwarded to merged PR #13; audited readiness/schema/code and
  Next.js 16 guidance; implemented calculation, state/evidence model, mapper,
  opt-in API response, tests, contract docs, and Sprint 2 changelog.
- Current work: record delivery evidence and validate the resulting exact
  status-only commit.
- Blockers/owner actions: none. Unknown Production nullability is represented
  as `incomplete` or `invalid` rather than assumed.
- Changed files: `lib/revenue/calculation.ts`,
  `app/api/products/route.ts`, `tests/revenue-calculation.test.ts`,
  `docs/revenue-calculation.md`, `CHANGELOG-Sprint2.md`, and this file.
- Results: targeted Revenue tests 12 passed; typecheck passed; lint passed with
  warnings only from pre-existing untracked Playwright output; full unit suite
  passed; production build passed. Local `/` and `/revenue` rendered meaningful
  headings with no browser console errors. Default and opt-in Product API calls
  returned HTTP 200 with the preserved unconfigured-Supabase response.
- Delivery: implementation commit `89bf6fa` pushed. Draft PR #14 created with
  `manual-merge-required`; auto-merge is disabled. CI run `30142813367`
  succeeded. Exact-commit Preview
  `https://gonggamline-gvectt84u-gg-online.vercel.app` passed all 24 browser
  checks in run `30142813354`; evidence artifact `8615036120`.
- Last commit: `89bf6fa feat: add revenue calculation engine`.
- Exact next action: commit and push this delivery evidence, then validate the
  resulting exact status-only commit.
- Remaining risks: stored cost provenance/freshness is absent; fee amount/rate
  precedence remains intentionally unresolved on conflict; ROI is undefined.

## Earlier task snapshot

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

Implementation, local verification, delivery, and exact-commit Preview
validation are complete. Draft PR #13 is awaiting review.

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
- GitHub CI run `30140610196`: passed for exact commit `feb70ba`.
- Exact-commit Vercel Preview:
  `https://gonggamline-aupgdmwcl-gg-online.vercel.app`.
- Preview browser run `30140610218`: 24 passed; no reported page, console, API,
  or failed-request errors.
- Preview evidence: `preview-browser-evidence`, artifact `8614330437`.
- Production: unchanged because PR #13 is open and unmerged.

## Last commit

`4add6a7 docs: audit revenue product data readiness`, followed by merge commit
`feb70ba` to incorporate the latest `origin/main` without force-pushing.

## Exact next action

Review Draft PR #13. Before a later Revenue calculation implementation,
perform the documented read-only Supabase schema and completeness inspection.

## Remaining risks

- Actual database nullability may differ from application assumptions.
- Existing zero/default values may mean unknown rather than measured zero.
- Product, market product, and supplier identities are not authoritatively
  linked for Revenue Opportunity calculation.
- ROI and cost provenance require business/data-contract approval before
  implementation.
