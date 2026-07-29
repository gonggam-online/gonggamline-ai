# Work status

## 2026-07-29 — Orchestrator Phase 2 execution vertical slice

- Objective: complete the shortest safe run-to-worker-to-result Vertical Slice
  on top of merged Phase 1.
- Branch/base: `codex/feat/orchestrator-phase-2`, based on PR #43 merge
  `59d866e0dc67cb1afa16323b3afe696a4e7825cb`.
- Risk: high-risk/manual automation bootstrap; `manual-merge-required`, no
  auto-merge.
- Revenue impact: P2 operational enablement. Deterministic dispatch, retry,
  approval, and recovery are required before the orchestrator can safely reduce
  engineering cycle time.
- Architecture compliance: accepted Engineering Orchestration lifecycle owns
  the change. It reuses the approved local SQLite, state, lease, policy,
  budget, audit, and recovery boundaries and introduces no product Domain,
  public API, Supabase DB, migration, external integration, or commerce write.
- Scope: local run migration/status, `READY` task selection, Worker dispatch,
  task/run state synchronization, checkpoint/result evidence, duplicate
  suppression, retry lineage, approval wait/resume, budget fail-close, exact
  worktree guard, local verifier, fake safe adapter, tests, and documentation.
- Non-goals: actual Codex paid/network execution, worktree creation, commit
  automation, push/PR, CI/Preview polling, planner/reviewer, product API,
  Supabase/Vercel/Production, secret/config changes, and commerce writes.
- Root-cause class: code/capability gap inside the accepted Architecture.
- Completed: governance and Architecture gates, dedicated branch, ledger v2,
  execution engine, fake Worker, worktree guard, mandatory fixed-ID verifier,
  minimum child environment, independent wall-time timeout, interrupt-once,
  late-result suppression, controller-owned usage breach latch, non-blocking
  interrupt observation, and Phase 1+2 focused tests.
- Current work: re-run all local and exact-head remote gates, then hand Draft
  PR #44 back to the repository owner without merging.
- Blockers/owner actions: repository-owner review and manual merge are required
  after final exact-head verification. Phase 3 is not authorized by this PR.
- Changed files: `tools/orchestrator/**`,
  `tests/orchestrator-phase-2.test.ts`, Orchestrator report/changelog, Decision
  Log, and this status file.
- Validation: updated focused Phase 1+2 tests 35/35 pass; full tests 303/303
  pass; lint passes with zero errors and four pre-existing warnings; typecheck,
  production build with 69 routes, and local Playwright 39/39 pass. Diff,
  secret, and external execution boundary audits pass. Exact-head CI, security
  audit, DB replay, Preview, and Preview browser validation remain to be re-run
  after push.
- Delivery: implementation commit
  `5435b93f2b579b0d93899520c48da32e026f2299` is pushed. Draft PR #44 targets
  `main`, is `manual-merge-required`, and is not eligible for auto-merge. Its
  initial exact-head CI, DB replay, Vercel Preview, and Preview browser
  validation all passed.
- Exact next action: complete local gates, commit and push the narrow review
  fix, then verify the resulting exact head and request repository-owner review
  without merging.
- Remaining risks: the fixed verifier command surface is not operating-system
  network isolation; approved repository scripts remain trusted code. Actual
  Codex process termination depends on the later transport adapter. Codex
  authentication/cost/transport policy, ledger retention/backup, numeric daily
  caps, GitHub/CI/Preview integration, and planner quality remain later
  checkpoints.

## 2026-07-28 — Orchestrator Phase 1 local controller primitives

- Objective: implement only the approved Phase 1 deterministic ledger, policy,
  router, budget, and recovery foundation after PR #42.
- Branch/base: `codex/feat/orchestrator-phase-1`, based on PR #42 merge
  `75d48dba3da9cb36bdecbd34de5604346379e601`.
- Risk: high-risk/manual bootstrap; `manual-merge-required`, no auto-merge.
- Revenue impact: P2 enablement and risk reduction. Preventing duplicate tasks,
  branches, PRs, actions, and runaway usage is required before automation can
  safely reduce delivery time.
- Architecture compliance: accepted Engineering Orchestration lifecycle and
  contracts own the change; no new Domain, DB, Queue, public API, or external
  integration is introduced. The SQLite ledger is local tool state outside
  Git.
- Scope: canonical Task/Result validation, local SQLite migration/ledger,
  state/lease/idempotency/audit, explicit N/D routing, allow/deny and approval
  policy, token/time/cost guard, App Server interrupt-first cancellation, and
  correlated Windows recovery planning.
- Non-goals: Phase 2+ Codex execution, worktree mutation, GitHub writer,
  CI/Preview polling, planner, Product/API/migration/Supabase/Vercel/Production,
  commerce write, OAuth, secret, or paid API.
- Root-cause class: code/capability gap already covered by accepted
  Architecture and measured Phase 0 evidence.
- Completed: verified PR #42 merge and clean worktree; completed governance and
  compliance gates; created the dedicated branch; implemented Phase 1
  primitives and focused restart/D/N/duplicate/lease/audit/budget/contract/
  routing/recovery tests.
- Current work: exact-head CI/Preview verification, followed by
  repository-owner review of Draft PR #43.
- Blockers/owner actions: repository owner must manually review and merge PR
  #43 only if its evidence and remaining risks are acceptable.
- Changed files: `tools/orchestrator/**`, focused tests, package metadata,
  `docs/orchestrator/**`, Decision Log, and this status file.
- Validation: focused Phase 1 tests 14/14 pass; full lint passes with zero
  errors and four pre-existing warnings; typecheck passes after aligning
  development Node types with the active Node 24 runtime; full tests pass
  282/282; Production build passes with 69 routes. Local Playwright reached all
  39 tests: 32 passed and the same seven Supabase-dependent pages failed with
  external `missing_url` configuration before the outer timeout.
- Delivery: dedicated branch pushed; Draft PR #43 is open with
  `manual-merge-required` and auto-merge disabled. Exact-head CI, Preview
  browser, Vercel readiness, mergeability, review threads, and local/remote
  equality are verified at terminal handoff.
- Exact next action: repository-owner review after exact-head gates; do not
  merge or start Phase 2 without a separate decision.
- Remaining risks: `node:sqlite` requires supported Node 24 runtime; future
  streamed usage integration and actual process stop remain Phase 2; ledger
  backup/retention and numeric daily caps still require owner decisions.

## 2026-07-28 — Orchestrator Phase 0 protocol capability spike

- Objective: prove the accepted Task/Result contracts and installed Codex
  execution interfaces with read-only evidence before building a controller.
- Branch: `codex/chore/orchestrator-protocol-spike`, based on PR #41 merge
  `a6894fce05480d9b599dcb9a03f9100c607b3fe6`.
- Risk: `manual-merge-required`. The probes are read-only, but this is the
  initial automation bootstrap.
- Revenue impact: P2 enablement and risk reduction. Measured protocol
  compatibility prevents rework and unsafe automation before revenue-supporting
  tasks are dispatched.
- Scope: Phase 0 TaskContract/example, sanitized CLI/App Server evidence,
  capability report, Architecture acceptance/status records, and no product
  runtime change.
- Non-goals: product code, API, migration, CI, Supabase, Vercel/Production,
  commerce writes, durable ledger/router/worker implementation, secrets, OAuth,
  paid API, or permission expansion.
- Root-cause class: capability uncertainty. Codex Desktop bundles an executable
  that external PowerShell cannot launch; official `@openai/codex` CLI
  `0.145.0` was installed for the approved spike and uses the existing ChatGPT
  login.
- Completed: confirmed PR #41 merged; fast-forwarded clean `main`; completed
  governance boot; created the dedicated branch; recorded the approved
  TaskContract; generated the experimental App Server JSON Schema bundle in a
  temporary directory; completed sanitized structured-exec, App Server
  lifecycle/resume/interrupt, Windows cancellation, usage, and synthetic
  redaction probes; recorded only sanitized summaries and hashes.
- Current work: repository-owner review of Draft PR #42. No merge is authorized
  by this task.
- Blockers/owner actions: repository owner must review and manually merge PR
  #42 only if its evidence and remaining risks are acceptable.
- Changed files: `docs/orchestrator/**`, `.ai/DECISION_LOG.md`, and this file
  only.
- Validation: Task/Result JSON Schemas compile and examples validate; fixtures
  parse; lint passes with 0 errors and 4 pre-existing warnings; typecheck
  passes; 268/268 tests pass; Production build passes with 69 routes. Local
  Playwright reached all 39 tests: 32 passed and the same seven
  Supabase-dependent pages failed with external `missing_url` configuration
  before the outer command timeout. The probes made no product/runtime change.
- Delivery: dedicated branch pushed; Draft PR #42 is open with
  `manual-merge-required`. Exact-head CI, Preview browser validation, Vercel
  Preview readiness, mergeability, unresolved review threads, and local/remote
  head equality are verified at terminal handoff.
- Exact next action: repository-owner review; keep the PR unmerged until that
  manual decision.
- Remaining risks: CLI/Desktop version skew, experimental App Server protocol
  churn, usage/cost semantics under ChatGPT auth, and Windows process
  cancellation behavior.

## 2026-07-28 — Revenue-first automation orchestrator design

- Objective: design an implementable GPT review -> task routing -> Codex
  execution -> evidence verification -> next-task/approval loop that advances
  real sales, net profit, and operator-time reduction.
- Branch: `docs/automation-orchestrator-design`, based on `origin/main`
  `eea7adf927498bd200cfe51e67cb1e37373e58bf`.
- Risk: high-risk/manual bootstrap by `.ai/risk-classification.md`;
  documentation only; no implementation, external configuration, database,
  Production, or commerce write.
- Scope/non-goals: six files under `docs/orchestrator/**` plus the minimum
  Decision Log and Work Status records. Product code, API, migration, CI,
  Vercel/Supabase state, and Coupang remain unchanged.
- Root-cause class: capability/Architecture gap. Existing CI/Preview and Runtime
  Queue patterns are reusable, but there is no durable cross-PC task/thread/
  worktree ledger or evidence-normalizing verifier.
- Current evidence: clean independent worktree; expected GitHub origin; latest
  original base was PR #39 merge `eea7adf`. PR #40 later merged as
  `cca761a1a49a39265a75a3a03bb15e81c004def8`; that latest `origin/main` is
  being incorporated through a normal merge without force-push.
- Reclassification: Sprint A recovered pre-003 sources and inspected
  Production; Database and Admin Security Architectures are accepted. Sprint
  B-0 is merged on `main`, including disposable replay evidence. Deployed Admin
  Auth/RLS, Item Selection persistence, and Production adoption remain
  unconfirmed.
- Completed: repository/PR/worktree safety checks; mandatory governance boot;
  current system/workflow/runtime/external-boundary audit; official Codex
  interface review; architecture, workflow, approval, roadmap, and Task/Result
  schemas drafted.
- Validation: both Draft 2020-12 JSON Schemas compile with AJV; Markdown links,
  state/outcome coverage, secret/path scans, and `git diff --check` pass. Lint
  passes with 0 errors and 4 pre-existing test warnings; typecheck passes;
  261/261 unit/integration tests pass; Production build passes with 69 routes.
  Local Playwright reached all 39 tests but the command timed out after the
  known seven Supabase-dependent page failures (`missing_url`); the other 32
  tests, including read-only health, revenue-critical, and Dashboard flows,
  passed. This documentation diff changes no runtime path.
- Delivery: design commit
  `6fbbee22bb44e2f45f377b3ce71eefb986071d98` is pushed. Draft PR #41 is open
  with `manual-merge-required`; auto-merge and merge remain disabled. Exact-head
  CI run `30343769928` and Preview browser run `30343769935` passed. Vercel
  exact-commit status is success; Preview evidence artifact `8682105417`
  (`sha256:a8c454f9174f95c722b7812f9e6bc16152dfd40a9a4b8ac819d13f92fc6d2f8f`)
  is retained through 2026-08-11.
- Main reconciliation: merged `origin/main`
  `cca761a1a49a39265a75a3a03bb15e81c004def8` normally without force-push.
  Preserved both this record and the merged PR #40 Sprint B-0 record. Fixed the
  newly merged provenance test to normalize CRLF before finding its header/body
  separator; migration bytes and manifest contracts are unchanged.
- Reconciliation validation: lint passes with 0 errors and 4 pre-existing
  warnings; typecheck passes; focused Sprint B-0 tests pass 7/7; full tests pass
  268/268; Production build passes with 69 routes. Local Playwright again
  reaches all 39 tests, with the same 32 passes and seven `missing_url`
  external-configuration failures before the command timeout.
- Reconciliation delivery: merge commit
  `305b3c57ffb3a77717dcf79c66edbbc5d4caa088` is pushed without force. PR #41
  is mergeable, Draft, and labeled only `manual-merge-required`; its body now
  records high-risk/manual. Exact-head CI `30349872267` and Preview browser
  validation `30349871278` pass, Vercel Preview is Ready, and evidence artifact
  `8684461640` has digest
  `sha256:c57984165723c20e84e4be54f4067ce40a0cccbb7420bf0f5bf25fe065d10aa8`.
  Unresolved review threads: 0.
- Current work: record this final delivery checkpoint and verify the resulting
  status-only exact head.
- Blockers/owner actions: none for design/delivery. Implementation requires
  Architecture acceptance plus the explicit decisions in the roadmap.
- Changed files: `docs/orchestrator/**`, `.ai/DECISION_LOG.md`, this file, and
  the Windows line-ending normalization in
  `tests/sprint-b0-database-baseline.test.ts`.
- Exact next action: after final exact-head checks pass, stop for
  repository-owner Architecture re-review. Do not merge or start implementation.
- Remaining risks: unapproved automation auth/budgets, N availability and
  backup, polling/webhook choice, Codex protocol version, shared status-file
  conflict with PR #40, and absent actual sales-learning data.

## 2026-07-28 — Sprint B-0 Database Baseline implementation

- Objective: make the pre-003 schema baseline reproducible so later
  engine-selected Item Selection persistence can be implemented without
  Production schema guessing.
- Branch: `codex/feat/sprint-b0-database-baseline-v1`, based on PR #39 squash
  commit `eea7adf927498bd200cfe51e67cb1e37373e58bf`.
- Risk: high-risk/manual because the diff adds migration history and disposable
  database tooling.
- Revenue impact: prerequisite for auditable persistence of products selected
  by the merged Item Selection engine.
- Root-cause class: database baseline gap; the migration chain began at 003
  while authoritative pre-003 sources remained recovery evidence only.
- Scope: promote the three recovery sources into migrations 000 through 002,
  preserve 003 through 020 by hash, add a pinned disposable Supabase replay
  runner and CI job, and add structural/provenance tests.
- Explicit non-goals: Auth, new RLS or policy implementation, Story 3
  persistence, API, UI, Production access, and commerce writes. Recovered
  permissive Products policies are not promoted.
- Current work: implementation and delivery validation are complete. The
  current host lacks Docker/PostgreSQL, so local database replay fails closed
  at preflight; the complete chain replayed successfully in the disposable
  GitHub CI Supabase stack.
- Changed files: pre-003 migrations, Supabase config/manifest, replay script,
  database-baseline tests/report, CI workflow, and this status file.
- Validation: 268/268 unit/integration tests, lint with zero errors and four
  pre-existing warnings, typecheck, Production build, preserved migration
  hashes, disposable full-chain replay, exact-head CI, Vercel Preview, and
  Preview browser validation passed.
- Delivery: Draft PR #40 is open with `manual-merge-required`; Ready,
  auto-merge, merge, Production migration, and Production smoke were not
  performed.
- Exact next action: repository-owner review of Draft PR #40. Do not mark
  Ready or merge without the next explicit approval.
- Remaining risks: existing development policies in migrations 005 through 020
  remain unchanged because RLS is explicitly outside this approval. Production
  migration behavior remains untested and unauthorized.


## 2026-07-28 — Admin Security Architecture v1 Accepted

- Objective: remove the actual administrator-security prerequisite without delaying Item Selection persistence through an unimplemented enterprise control plane.
- Branch: `codex/docs/admin-auth-rls-csrf-architecture-v1`, based on PR #38 squash commit `cd4bae71ac77d74751ae3575a8574d7c174a6748`.
- Risk: high-risk/manual; documentation only.
- Root cause: repeated correction was caused by attempting to prove 31 principals, 25 functions, 17 states, custom Auth/provider behavior, Auth-schema locks, and telemetry recovery entirely in documentation. Each normalization enlarged the validation surface.
- Corrective decision: replace the canonical-ledger design with a minimal server boundary using manual Dashboard provisioning, a server-only UUID allowlist, per-request `getUser()` validation of the access JWT and user, AAL2 mutation assurance, exact-origin JSON CSRF, default-deny protected Data API access, one contained service-role module, and atomic database audit.
- Repository-owner session decision: sign-out prevents refresh but does not immediately invalidate an issued access JWT. V1 accepts the configured maximum 15-minute protected-read boundary and the separate maximum 60-second AAL2 mutation-freshness boundary; `auth.sessions` validation and a separate immediate-revocation system remain excluded.
- Removed from v1: Auth Hook, software invitation/retirement/soft-delete, `auth.sessions` access, automatic MFA/break-glass lifecycle, per-function owner roles, and telemetry lease/freeze/recovery.
- Validation model: official platform facts plus executable A01-A12 tests in a fresh disposable Supabase environment. Existing unit/lint/build success is not represented as proof of unimplemented security.
- Approval: repository owner accepted the Architecture on 2026-07-28
  against exact head `0d68585400eb6ce279c40e93560fea1d69d94a92`.
- Current work: record the Accepted Architecture status and prepare only the
  next Sprint B-0 implementation work instruction. PR #39 remains Draft and
  `manual-merge-required`; do not mark Ready, merge, or implement.
- Blockers/owner actions: Sprint B-0 Architecture and its high-risk execution
  still require separate repository-owner approval. Production remains a
  separate manual boundary.
- Changed files: `docs/architecture/ADMIN-IDENTITY-AUTHORIZATION-RLS-CSRF-V1.md`,
  `docs/tasks/SPRINT-B0-DATABASE-BASELINE-IMPLEMENTATION-INSTRUCTION.md`,
  `.ai/ARCHITECTURE_REVIEW.md`, `.ai/DECISION_LOG.md`, and this file.
- Exact next action: validate and push the approval/status documentation on
  Draft PR #39, then await review/merge direction. Do not start Sprint B-0
  until its separate approval is recorded.
- Remaining risks: service-role full access, the accepted maximum 15-minute logged-out access-JWT read boundary and maximum 60-second AAL2 mutation-freshness boundary, exact environment UUIDs/secrets, broad development policy removal, and disposable security-test implementation remain explicit.

## 2026-07-28 — Item Selection Database Baseline Architecture v1

- Objective: define the database contract required to persist and reproduce
  Item Selection engine decisions so only engine-selected products can advance
  toward a first sale.
- Branch: `codex/docs/item-selection-database-architecture-v1`, based on merged
  Story 2 squash `7491b239f5935643778330a08ed4b070511c4c7a`.
- Risk: normal-risk documentation PR; every later migration, RLS, or Production
  execution remains high-risk/manual.
- Revenue impact: P1. This is the shortest approved prerequisite to turn the
  merged evaluator into an auditable operator workflow.
- Scope: DB/runtime selection, migration baseline, immutable canonical text
  snapshots, provider evidence, authoritative round-trip decision values,
  derived money/rate projections, reproducibility, transaction/idempotency,
  environment separation, retention/recovery, migration verification, and
  Story 3 handoff.
- Non-goals: migration, schema execution, persistence code, API, UI, auth/RLS,
  CSRF, Production access, Product creation, listing, price, purchasing, order,
  inventory, fulfillment, or any marketplace write.
- Root-cause class: database/Architecture prerequisite. Direct operational
  integration is stopped by the approved Story 3–5 ordering.
- Completed: verified Story 2 merge and Production smoke; synchronized clean
  `main`; reread governance and approved Item Selection Architecture; confirmed
  the evaluator/profitability engine has no approved operating persistence/API
  path; inspected the baseline gap, recovery plan, migrations, Supabase access,
  and existing numeric conventions; drafted the Database Architecture.
- Current: repository owner accepted the PR #38 Database Baseline Architecture
  on 2026-07-28 for head
  `8b1e6ab589491e77dfa7ac5d71c99b40db03030a`. The acceptance record is being
  delivered on the same manual PR without changing application/runtime code.
- Blockers/owner actions: Database Baseline Architecture approval is complete.
  Accepted Admin Identity / Authorization / RLS / CSRF Architecture and
  accepted Sprint B-0 remain prerequisites for Story 3.
- Changed files: Database Architecture document, Architecture Review index,
  Decision Log acceptance record, and this status.
- Commands/results: initial branch was clean and exactly based on
  `7491b239f5935643778330a08ed4b070511c4c7a`; no runtime or migration file is
  changed. `git diff --check`, lint (0 errors, 4 pre-existing test warnings),
  typecheck, 261/261 unit/integration tests, and Production build passed. The
  recurring Windows `uv_os_get_passwd ENOMEM` affected the first test launch;
  ignored `tsx` dependency files were temporarily adjusted, tests passed, and
  those files were restored without staging. Review follow-up document
  consistency, `git diff --check`, 261/261 tests, lint (0 errors, the same 4
  warnings), typecheck, and Production build also passed. The follow-up
  calculation-version, retry-link, and DB-authored persistence-time contracts
  passed the same document checks, 261/261 tests, lint, typecheck, and build.
  Retry lineage separation from candidate decision identity passed document
  consistency, `git diff --check`, 261/261 tests, lint (0 errors, 4 existing
  warnings), typecheck, and Production build. The owner acceptance record passed
  the same document consistency, diff, test, lint, typecheck, and build gates.
- Last commit: approval-record commit on the current PR #38 branch `HEAD`;
  Git/GitHub remains the authoritative mutable SHA source.
- Exact next action: after PR #38 is manually squash-merged, draft the separate
  Admin Identity / Authorization / RLS / CSRF Architecture PR. Do not begin
  migration, persistence, API, UI, auth, RLS, CSRF runtime, or Story 3 work.
- Remaining risks: principal, authorization, RLS, CSRF, and Sprint B-0 execution
  contracts remain unaccepted; no Item Selection persistence can start before
  those required Architecture acceptances.

## 2026-07-28 — Item Selection profitability policy v1

- Objective: implement owner-approved profitability policy
  `gonggamline-profitability-2026-07-27-v1` and integrate its trusted result
  with the Item Selection evaluator.
- Branch: `codex/feat/item-selection-profitability-v1`, based on clean merged
  `main` `04508f033892d57cab29c3430231d29424c36fa2`.
- Risk: high-risk. The directive changes pricing/margin semantics and also
  requests migration, auth-bound persistence/API, and Production delivery.
- Revenue impact: P1/P0. The approved thresholds prevent estimated or missing
  costs from producing false recommendations and define normalized and stress
  contribution-profit gates.
- Scope: Revenue policy, provider-fact contract, base/stress/current/normalized
  scenarios, cost trust, VAT/precision, evaluator verdict integration, and
  unit/domain tests.
- Non-goals: migration, persistence, API, UI, admin auth/authorization, RLS,
  and CSRF.
- Root-cause class: code/capability gap after explicit owner financial and
  Architecture approval.
- Completed: read the owner directives and binding repository governance;
  fast-forward verified local/remote `main`; created the task branch; inspected
  the approved Item Selection Architecture Story, Decision Log, database
  baseline status, Revenue calculation, Item Selection evaluator, Supplier
  Catalog contracts, migrations, and tests; implemented the versioned Revenue
  policy, four scenarios, trust/provenance/VAT/inclusion validation, sanitized
  provider mapper, evaluator integration, and focused tests.
- Current: review follow-up implemented and all local gates passed; push the
  review-fix commit and confirm exact-head CI and Preview browser validation.
- Blockers/owner actions: no blocker for Story 2. Database Baseline and Admin
  Architecture approvals remain prerequisites for Stories 3–4.
- Changed files: Revenue profitability policy, Item Selection evaluator,
  focused tests, policy documentation, changelog, Decision Log, and this file.
- Commands/results: review follow-up preserves `effectiveFrom` and `includedIn`
  on cost lines and rejects non-Domeggook or invalid numeric provider facts.
  Focused policy/evaluator tests passed 40/40; full unit/integration passed
  261/261; typecheck and Production build passed. Repository lint excluding
  the pre-existing generated `playwright-report` passed with 0 errors and 4
  pre-existing test warnings. The unfiltered lint command fails only because
  generated Playwright trace assets are present locally. The Windows Node
  runtime returned `uv_os_get_passwd ENOMEM` while `tsx` selected its temp
  directory; ignored dependency files were temporarily adjusted only to run
  tests and then restored. No `node_modules` file is staged or committed.
- Delivery: implementation commit
  `58db717fa00f40522838de90c427acd921bc7a83` is pushed. Draft PR #37 has
  `manual-merge-required`; auto-merge is disabled. Exact-head CI run
  `30313836655` and Preview browser validation run `30313836624` passed.
- Last commit: `9b35ec2ef4836e054aa3c6747584b4d807c7d951`.
- Exact next action: commit/push the review fix, confirm the new
  exact-head CI/Preview gates, then stop for manual review without merging.
- Remaining risks: provider unit price freshness still depends on the bounded
  observation time; persisted replay, authenticated APIs, and UI evidence
  remain intentionally deferred.

## 2026-07-27 — Item Selection pure evaluator v1

- Objective: implement Story 1 from the approved Item Selection Evaluation v1
  Architecture Story: versioned typed policy, pure evaluator, deterministic
  explanations/sorting, and exhaustive unit tests.
- Branch: `codex/feat/item-selection-evaluator-v1`, based on merged `main`
  `79b5f344643839336c45455993464f9da8b74249`.
- Risk: normal-risk. The implementation consumes already-normalized score and
  profitability readiness inputs; it does not calculate price, margin, fees,
  money, or change Revenue semantics.
- Revenue impact: make supplier screening deterministic and prevent missing
  rights/economics or low coverage from becoming false recommendations.
- Scope: `shared/domain` pure contracts/policy, unit tests, decision/status and
  changelog documentation.
- Non-goals: provider network, Revenue integration, money calculation, DB,
  migration, API, auth, UI, LLM, Product/Coupang/supplier writes.
- Root-cause class: code/capability gap covered by the merged Architecture
  Story.
- Architecture compliance: Supplier/Procurement owns the Item Selection
  policy; dependency direction stays inward; no new boundary is introduced;
  approved ruleset `gonggamline-item-selection-v1` is the source of truth.
- Completed: verified PR #35 merge and Production Vercel success; verified
  `production-browser-smoke` run `30260877134` success; fast-forwarded clean
  local `main`; reread mandatory governance and approved architecture; created
  the task branch; implemented typed contracts, version constants, five-gate
  validation, weighted score/coverage, verdict precedence, deterministic Korean
  explanations and sorting; added 16 focused unit scenarios.
- Current: implementation and local/remote Release Gates passed; Draft PR #36
  is open with `normal-risk` and awaits review.
- Blockers/owner actions: none for Story 1.
- Changed files: `shared/domain/item-selection.ts`,
  `tests/item-selection-evaluator.test.ts`,
  `CHANGELOG-Item-Selection-Evaluator-v1.md`, `.ai/DECISION_LOG.md`, and this
  file.
- Commands/results: remote and baseline verification passed. Focused ESLint
  passed; repository lint excluding generated Playwright artifacts passed with
  0 errors and 4 pre-existing warnings. Focused test 16/16 and full
  unit/integration suite 237/237 passed. Typecheck and Production build passed
  with 69 routes. Local Playwright passed 32/39; the same seven
  Supabase-dependent routes recorded on the baseline fail because local
  Supabase is unconfigured, while API health, revenue-critical, and Revenue
  Dashboard flows pass. The first focused `tsx` attempt hit the intermittent
  Windows `uv_os_get_passwd ENOMEM`; the subsequent normal full `npm test`
  succeeded and includes all 16 new tests.
  Exact-head commit `36473ffe8d018734d9a047a7c0235fb516ef291a`
  passed CI run `30261740078`, Vercel Preview, and Preview browser validation
  run `30261740303`. The non-destructive browser job and all of its access,
  Playwright, and artifact steps passed. Evidence artifact:
  `preview-browser-evidence` id `8651198170`.
- Delivery: Draft PR #36,
  `https://github.com/gonggam-online/gonggamline-ai/pull/36`; normal-risk;
  mergeable; conflicts 0; unresolved review threads 0.
- Last commit: `36473ff feat: add item selection evaluator v1`.
- Exact next action: review Draft PR #36. Do not begin high-risk Story 2
  Revenue/provider integration without its required owner decisions.
- Remaining risks: later provider and Revenue adapters must supply verified
  facts without weakening `UNKNOWN`, coverage, or profitability readiness.

## 2026-07-27 — Item Selection Evaluation v1 architecture

- Objective: approve an implementable, versioned evaluation/recommendation
  vertical slice after read-only Domeggook Live Search without changing
  Production behavior.
- Branch: `codex/docs/item-selection-evaluation-v1`, based on `origin/main`
  `81a2a7ab55ec3d041de895ff337650328f717cd9`.
- Risk: normal-risk documentation-only. Later financial, auth/RLS, migration,
  database, and Production work remains high-risk/manual.
- Revenue impact: reduce repeated manual supplier screening while preventing
  unknown rights, incomplete economics, or low coverage from appearing as safe
  recommendations.
- Scope: architecture/ruleset/API/persistence/UI/failure/security/delivery
  contracts, decision log, status, and changelog.
- Non-goals: runtime routes, evaluator/UI code, migrations, database or
  environment changes, real commerce writes, bulk crawling, new SaaS.
- Root-cause class: capability/architecture gap. External provider
  configuration is not changed; database/auth prerequisites remain explicit.
- Completed: read the owner directive and mandatory repository policy; fetched
  latest main; verified merged PR #33/#34; audited Supplier Catalog, Revenue,
  API/UI/test and schema conventions; created the task branch; wrote the
  Architecture Story and official decision records.
- Current: committed/pushed as `78c09a7`; Draft PR #35 is open with
  `normal-risk`. Exact-head Vercel Preview is Ready, the branch is mergeable,
  and review threads are zero. Ready/merge is withheld because exact Preview
  browser automation cannot pass Deployment Protection.
- Blockers/owner actions: For this docs Story, configure the existing GitHub
  Actions secret at repository **Settings > Secrets and variables > Actions >
  New repository secret** with name `VERCEL_AUTOMATION_BYPASS_SECRET`. Its
  secret value must come from the matching Vercel project Deployment
  Protection automation-bypass setting and must not be pasted into source,
  PR comments, or chat. Then rerun the PR `Preview browser validation`
  workflow. Later implementation Stories also require approved cost/profit
  thresholds, admin identity/RLS, database baseline, and verified provider
  evidence fields.
- Changed files: `docs/architecture/ITEM-SELECTION-EVALUATION-V1.md`,
  `.ai/ARCHITECTURE_REVIEW.md`, `.ai/DECISION_LOG.md`,
  `CHANGELOG-Item-Selection-Evaluation-Architecture-v1.md`, and this file.
- Commands/results: `git fetch origin`, local Markdown link inspection,
  duplicate/secret/runtime-diff inspection, and `git diff --check` passed.
  Tracked-source ESLint passed with 0 errors and 4 pre-existing test warnings;
  the unfiltered lint command failed because existing generated
  `playwright-report/trace/assets` is in its scan scope. Typecheck and
  Production build passed (69 routes). Unit tests stopped before discovery
  because Node 24 returned the previously observed Windows
  `uv_os_get_passwd ENOMEM`. Local Playwright passed 32/39; the same seven
  Supabase-dependent routes documented in earlier snapshots failed with
  `Supabase unconfigured`, while API health, revenue-critical, and Dashboard
  flows passed. This docs-only diff changes no runtime route.
  Exact-head Vercel deployment is Ready, but direct Preview Playwright without
  the bypass secret reached Vercel login HTML: 6/39 passed and 33/39 were
  blocked by Deployment Protection. The in-app browser connector also failed
  to initialize because Windows denied AppData inspection (`EPERM`).
- Delivery: Draft PR #35,
  `https://github.com/gonggam-online/gonggamline-ai/pull/35`; exact-head Vercel
  status passed; merge conflict and unresolved review thread counts are zero.
- Last commit: `78c09a7 docs: approve item selection evaluation v1`.
- Exact next action: owner configures the protected automation secret and
  reruns `Preview browser validation`; after it passes, mark PR Ready and apply
  the normal-risk merge policy.
- Remaining risks: synchronous size-30 capacity is unmeasured; no repository
  admin auth exists; Product database baseline/RLS is unresolved; minimum
  profit/margin and cost profile have no owner-approved values; current
  provider-normalized facts cannot pass all five hard gates.

## 2026-07-27 — Domeggook Live Search API

- Objective: implement the approved bounded Live Search API without
  persistence.
- Branch: `codex/feat/domeggook-live-search-api`, stacked on the Live Search
  Architecture Story.
- Risk: normal-risk; read-only provider access and no database path.
- Completed: thin GET handler, public DTO mapper, sanitized error mapping,
  malformed-input guard, and focused no-write contract tests.
- Non-goals: UI, Product writes, financial calculations, recommendations,
  legacy route changes, Queue, or bulk collection.
- Current: focused and full validation, then stacked Draft PR delivery.

## 2026-07-27 — Domeggook Live Search architecture

- Objective: authorize a standalone live supplier search with no persistence.
- Branch: `codex/docs/domeggook-live-search-contract`.
- Risk: normal-risk documentation-only.
- Root cause: the legacy search route bypasses the approved adapter and mixes
  provider access, financial decisions, and Supabase upsert.
- Completed: adapter/UI audit; dedicated endpoint/DTO/error/no-write contract;
  compatibility, tests, rollout, and rollback definition.
- Non-goals: Product writes, financial scoring, recommendations, Queue,
  scheduler, bulk crawling, or legacy route changes.
- Next: deliver this Story, then implement its endpoint, UI, and tests on a
  separate branch.

## 2026-07-27 — Sprint B-0 architecture gate

- Objective: authorize deterministic isolated fresh replay without changing
  Production.
- Branch: `codex/docs/sprint-b0-database-baseline-architecture`.
- Risk: high-risk/manual because the Story governs migrations and RLS.
- Root cause: the chain starts at 003, no isolated replay harness exists, and
  migrations 005–020 recreate permissive policies after a pre-003 baseline.
- Completed: merged-state audit; B-0 and Live Search parallel audits; proposed
  B-0 Story, decision record, and review index.
- Current: validate and deliver the documentation-only approval PR.
- Blocker: implementation is prohibited until repository-owner approval and a
  concrete identity/ownership model are recorded.
- Non-goals: migration creation, SQL execution, Supabase/Production contact,
  RLS mutation, history edits, or real commerce writes.
- Next independent work: read-only Domeggook Live Search contract on a separate
  branch without persistence or financial decisions.

## Current task snapshot

- Objective: make notebook and desktop Codex sessions apply the same permanent
  repository operating rules for branch selection, safe delivery, Korean
  progress, approval boundaries, and Windows notifications.
- Branch: `codex/chore/codex-cross-pc-operating-standard`, stacked on Draft PR
  #30 because the current repository state includes the Sprint A close-out.
- Risk: high-risk/manual because this changes binding repository-wide Codex
  governance and is intentionally delivered with `manual-merge-required`.
- Revenue impact: reduces setup drift, repeated owner coordination, and
  cross-device delivery mistakes before Sprint B-0 and Sprint B.
- Scope: permanent cross-PC operating standard; binding `AGENTS.md` hooks;
  Windows approval/completion notification script; onboarding/operations
  guide; `.ai` and `.codex` indexes.
- Non-goals: grant OS/platform permissions, bypass GitHub protections, change
  application behavior, modify Production/database state, or guarantee sound
  on muted/unsupported devices.
- Completed: inspected repository governance and the local PR stack; created a
  dedicated stacked task branch; added automatic safe branch selection,
  normal/high-risk delivery boundaries, Korean evidence-based progress,
  cross-PC source-of-truth rules, and local Windows notifications.
- Current work: delivered as Draft PR #31; waiting for the dependent manual PR
  stack and owner review.
- Changed files: `AGENTS.md`, `.ai/CODEX_OPERATING_STANDARD.md`,
  `.ai/README.md`, `.codex/README.md`, `.codex/notify.ps1`,
  `docs/CODEX_CROSS_PC_OPERATIONS.md`, task changelog, and this status file.
- Validation: both notification events execute successfully on this desktop;
  `git diff --check` passes; scoped lint passes with four pre-existing test
  warnings and no errors; typecheck passes; tests pass 217/217; Production
  build passes with 68 generated routes. The first unscoped lint/build attempt
  encountered ignored Playwright artifacts and a locked `.next/trace`; no
  tracked file was changed, and separated validation passed after the stale
  ignored trace was safely rotated and removed.
- Delivery: commits `f402026` and the final status-only follow-up on this
  branch; pushed to origin; Draft PR #31 targets
  `codex/chore/sprint-a-closeout`, carries `manual-merge-required`, and has
  auto-merge disabled.
- Blockers: PR #31 is intentionally stacked on Draft PR #30. Merge/refresh the
  stack in order before manual review of this governance PR. GitHub CLI is not
  available on the active PATH, but authenticated Git push and the connected
  GitHub capability completed delivery.
- Exact next action: merge PR #29, then #30; refresh PR #31 against the updated
  base/main, rerun gates, and manually merge it before Sprint B-0/B.

## Previous task snapshot

- Objective: formally close Sprint A by resolving every remaining baseline
  reconciliation finding without executing SQL or changing migrations or
  application behavior.
- Branch: `codex/chore/sprint-a-closeout`, stacked on Draft PR #29.
- Risk: high-risk/manual because the documents design migration history and
  Production RLS recovery. Auto-merge is prohibited.
- Revenue impact: P0 database and authorization reliability required before
  safe continuation of revenue workflows.
- Root-cause class: database provenance and Production authorization drift.
- Source priority: Production CSV, verbatim SQL Editor sources, existing
  migrations, application code, then documentation.
- Scope: finalize former UNKNOWN findings as COMPATIBLE or DEFERRED; complete
  canonical replay, Production, migration-history, and RLS strategies; record
  final risks and Sprint B readiness.
- Non-goals: execute SQL, contact Supabase, modify migrations/application code
  or recovered SQL, create migrations, insert history rows, or implement RLS.
- Completed: recovered and hashed all evidence; reconciled 57 tables, 883
  columns, 268 constraints, 148 indexes, 59 policies, four triggers, and
  `pgcrypto`; finalized canonical replay, forward Production reconciliation,
  official migration adoption, and identity-first RLS strategy. No unresolved
  UNKNOWN finding remains.
- Current work: final diff review and Git delivery.
- Blockers: none for Sprint A closure or the independent read-only Sprint B
  vertical slice.
- Deferred items: deployed `set_updated_at()` body equivalence; historical
  Commerce OS RLS enabled/forced state; original SQL Editor timestamps;
  runner metadata/checksum inspection; Preview/Staging parity; and concrete
  Production identity/ownership implementation. Each has an owner, mitigation,
  and future execution boundary in the final risk register.
- Changed files: final risk register and completion report; reconciled
  classification/implementation/checklist/standards; task changelog; and this
  status file.
- Safety: no SQL executed and no Supabase contact. No migration, application,
  recovery SQL, SQL Editor export, or CSV content has been modified. CSV hashes
  remain 13/13 exact. Protected-path diff and `git diff --check` pass. Scoped
  lint passes with four pre-existing warnings; typecheck passes; tests pass
  217/217; build passes with 68 routes. Local browser remains 32/39 with the
  same seven Supabase-unconfigured failures. Dependency audit reports 12
  existing high-severity transitive advisories; no upgrade was made.
- Sprint status: **Sprint A Complete with Deferred Items**.
- Upcoming milestone: Sprint B — Domeggook Live Search Vertical Slice,
  constrained to its approved read-only architecture and independent from
  database/RLS execution.
- Readiness: 100% for Sprint A close-out; Production migration/RLS execution
  remains a separate high-risk approval boundary.
- Validation: protected paths and inspection CSVs unchanged; `git diff --check`
  passes. Scoped lint passes with four pre-existing warnings; typecheck passes;
  tests pass 217/217; build passes with 68 routes. Local browser remains 32/39
  with the same seven Supabase-unconfigured failures.
- Exact next action: stage the close-out documents/status only, review, commit,
  push, and open a Draft manual PR without auto-merge.

## Current task snapshot

- Objective: prepare a read-only deployed Supabase catalog inspection package
  and an implementation-ready restoration design without contacting Supabase,
  executing SQL, or changing migrations/application behavior.
- Branch: `codex/chore/supabase-deployed-schema-inspection`.
- Prerequisites: PR #26 and PR #27 are merged; local `main` was confirmed equal
  to `origin/main` before branch creation.
- Risk: high-risk/manual because the design covers schema, migration history,
  and RLS. The diff is evidence-only; `manual-merge-required` and no auto-merge
  are mandatory.
- Revenue impact: P0 database/security provenance. Verified deployed state is
  required before safely restoring the schema that supports sales workflows.
- Root-cause class: database evidence gap.
- Scope: thirteen SELECT-only inspections, operator runbook/intake template,
  classification/decision framework, expected-object inventory, restoration
  paths, and application access map.
- Non-goals: execute SQL, contact Supabase, read business rows, modify or create
  official migrations, change application behavior, insert migration history,
  or deploy historical development RLS.
- Completed: prerequisite/branch verification; governance, baseline, migration,
  and application inspection; draft package and design; initial static
  SELECT-only and protected-path checks.
- Current work: final diff review and Git delivery.
- Historical A-3 blockers: deployed classifications awaited operator output.
  Sprint A-4/A-5 later supplied Production evidence and formally deferred
  chronology and runner-format execution details.
- Changed files: requested docs and deployed-inspection sources, task changelog,
  and this status file only.
- Commands/results: no SQL executed and no Supabase contact. Thirteen SQL files
  contain 25 SELECT statements, no non-SELECT statement, and none of the
  forbidden mutating keywords after comments are removed. Protected migration
  and application diff is empty; `git diff --check` passes. Standard lint is
  polluted by ignored generated Playwright assets; scoped lint passes with four
  pre-existing warnings. Typecheck passes; tests pass 217/217; build passes
  with 68 routes. Local Playwright is unchanged at 32/39 with seven known
  Supabase-unconfigured route failures. Dependency audit reports 12 existing
  high-severity transitive advisories; suggested fixes are breaking and were
  not applied.
- Delivery: commit, push, draft PR, label, and Preview remain pending.
- Exact next action: review the complete diff, commit, push, and open the draft
  high-risk PR without auto-merge.
- Remaining risks: deployed state and chronology are unproven; all application
  database access uses the public anon client; historical and Git development
  policies are not accepted as Production least privilege.

## Current task snapshot

- Objective: export and reconcile the operator-provided SQL Editor baseline
  against the Git migration chain without executing SQL or changing migrations,
  application behavior, deployed databases, or Git history.
- Branch: `codex/chore/sql-editor-baseline-export`.
- Base dependency: PR #26 commit `2f557d5`; the branch is stacked because the
  recovery sources are not yet on `main`.
- Risk: high-risk/manual because the evidence contains schema and permissive
  RLS DDL, although this Story changes documentation and recovery-only files.
  Auto-merge is prohibited.
- Revenue impact: P0/P1 database provenance. A reproducible baseline prevents
  schema drift from blocking Product, Revenue, and Commerce OS operations.
- Root-cause class: database provenance gap. SQL Editor history predates the
  checked-in migration chain.
- Scope: preserve seven named SQL Editor entries verbatim; map them to Git;
  separate DDL candidates from checks; propose dependency replay order; record
  missing timestamps and Production RLS risk.
- Non-goals: execute SQL, contact Supabase, modify/rename migrations, create
  replacement migrations, infer missing statements, change application code,
  or rewrite Git history.
- Completed: verified clean branch state and PR #26 dependency; read governing
  documents and all migration/recovery evidence; confirmed complete operator
  sources; created seven SQL Editor exports and four reconciliation documents;
  added the task changelog.
- Current work: local implementation and validation are complete; review and
  deliver the exact change set.
- Blockers/owner actions: actual restoration remains blocked by missing SQL
  Editor timestamps, the Products baseline entry name/timestamp, deployed
  schema and migration-history output, environment execution provenance, and a
  Production-safe RLS design.
- Changed files: four requested documents,
  `supabase/recovery-sources/sql-editor-export/**`, task changelog, and this
  status file.
- Commands/results: no SQL executed and Supabase was not contacted. Verbatim
  comparison passed for the recovered Core Schema, Product workflow, attached
  development RLS, and attached verification sources; seven exports are
  present. Protected migration/application path checks and `git diff --check`
  passed. Standard lint was polluted by ignored generated Playwright report
  assets; scoped lint excluding `playwright-report/**` and `test-results/**`
  passed with four pre-existing Revenue-test warnings and no errors. Typecheck
  passed; unit/contract tests passed 217/217; production build passed with 68
  routes. Browser tests were not repeated because no runtime file changed; the
  exact parent commit recorded 32/39 locally, with seven known failures from
  unconfigured Supabase, and exact-head Preview remains required.
- Delivery: not committed, pushed, or opened as a PR yet.
- Last commit: `2f557d5 docs(db): add Supabase baseline recovery evidence
  package`.
- Exact next action: review the complete diff, then commit/push/open a draft PR
  to `main` without auto-merge.
- Remaining risks: exact chronology is unproven; Product baseline numbering is
  unresolved; historical `003_dev_rls` grants unrestricted CRUD to `anon` and
  `authenticated` and is unacceptable as a Production policy.

## Current task snapshot

- Objective: prepare a reviewable Supabase baseline recovery evidence package
  from complete operator-supplied SQL without executing SQL, changing deployed
  databases, or modifying the migration chain.
- Branch: `codex/chore/supabase-baseline-recovery-evidence`.
- Risk: high-risk because the evidence concerns missing database history, RLS,
  functions, triggers, and future deployed-schema reconciliation. This PR is
  evidence-only and must not auto-merge.
- Revenue impact: P0/P1 reliability prerequisite. Recovering reproducible
  schema provenance prevents database drift from blocking Product and Revenue
  operations.
- Root-cause class: database provenance gap. The repository starts at migration
  003 while recovered Product and Commerce OS SQL was previously executed
  outside the checked-in chain.
- Scope: preserve three operator SQL sources outside `supabase/migrations`;
  inventory statements and dependencies; document conflicts, encoding results,
  fresh replay, and deployed-history reconciliation; provide read-only catalog
  and migration-history inspection SQL.
- Non-goals: execute SQL, contact Supabase, modify migrations 003-020, assign
  restored migration numbers, change application behavior, reconstruct missing
  SQL, or reconcile a deployed database.
- Completed: verified the non-main branch and clean starting tree; read the
  complete attached Commerce OS source; confirmed all three operator sources
  are complete; preserved the recovered sources; added read-only inspection
  queries; documented statement inventory, dependencies, replay hazards,
  UTF-8 literal findings, separate recovery plans, and unresolved evidence.
- Current work: local validation and complete staged-diff review are complete;
  GitHub CLI 2.96.0 authentication is verified and delivery is in progress.
- Blockers/owner actions: publishing has no current blocker. Actual restoration
  remains blocked pending SQL Editor chronology, deployed schema/metadata output
  for every environment, migration history rows/version format, and the Commerce
  OS RLS SQL referenced by the recovered source or an explicit decision that it
  never existed.
- Changed files: `supabase/recovery-sources/**`,
  `docs/SUPABASE_BASELINE_RECOVERY_PLAN.md`,
  `CHANGELOG-Supabase-Baseline-Recovery-Evidence.md`, and this status file.
- Commands/results: no SQL or Supabase request executed. Commerce OS attachment
  matches the preserved file after newline normalization; no protected
  migration or application path changed. Static source/scope validation and
  `git diff --check` passed. Lint passed with four pre-existing Revenue-test
  warnings and no errors; typecheck passed; unit/contract tests passed 217/217
  when rerun outside the sandbox after two sandboxed Node `os.userInfo`
  failures; production build passed with 68 routes. Local Chromium completed
  39 checks: 32 passed and the same seven Supabase-dependent routes failed
  because local Supabase is unconfigured (`/listing`, `/market`,
  `/procurement`, `/revenue`, `/sourcing`, `/workflow`, `/workspace`). The
  first browser attempts were blocked by a missing browser and sandbox
  `spawn EPERM`; the unrestricted run produced the expected final result.
  `npm ci` reported 12 high-severity dependency advisories, increased from the
  older technical-debt record and requiring separate triage.
- Delivery: intended files are staged and the full staged diff was reviewed;
  commit, push, and manual non-auto-merge PR are pending.
- Last commit: `60d6573 Implement Domeggook Read-only Supplier Catalog Adapter
  v1 (#25)`.
- Exact next action: commit, push, and open a manual, non-auto-merge PR.
- Remaining risks: historical order is unproven; deployed definitions and
  migration history are unknown; recovered Commerce OS SQL references a
  separate RLS file that has not been supplied; permissive Product `anon`
  writes require security approval before restoration.

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
