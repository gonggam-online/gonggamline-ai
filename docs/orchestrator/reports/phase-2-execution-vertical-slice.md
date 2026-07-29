# Phase 2 execution vertical slice

Status: implementation in progress on
`codex/feat/orchestrator-phase-2`; separate
`manual-merge-required` Draft PR required.

Base: PR #43 merge
`59d866e0dc67cb1afa16323b3afe696a4e7825cb`.

## Objective

Turn the Phase 1 deterministic controller primitives into a locally executable
run lifecycle without adding a product API, Supabase migration, external
commerce write, or cloud worker.

The slice creates and selects a run, dispatches a bounded worker, persists
checkpoints and sanitized evidence, applies retry and approval rules, and
exposes typed ledger status queries. The implementation remains local to the
Engineering Orchestration tool boundary.

## Implementation maturity

### Implemented and verified

- SQLite ledger migration v2 adds runs, retry lineage, checkpoints, and
  immutable results.
- `OrchestratorExecutionEngine` selects the next `READY` task or executes an
  explicit task, obtains the Phase 1 lease, and synchronizes task/run states.
- Duplicate run IDs and idempotency keys return the existing run without
  dispatching a worker again.
- Retry creates a new run with `retryOfRunId`, incremented attempt, and the
  existing maximum-three-attempt policy.
- Approval is persisted as a checkpoint and distinct
  `WAITING_FOR_HUMAN` state; no success result is invented while approval is
  pending.
- Resume uses the last persisted checkpoint and the same run identity.
- Streamed usage checkpoints feed the Phase 1 budget guard. An independent
  wall-clock timer also operates when a Worker reports no usage. Either breach
  interrupts at most once and fails closed; late Worker results and hooks are
  ignored after timeout.
- The controller latches the first usage-based budget breach before notifying
  the Worker. A Worker cannot catch the hook error and restore success, and a
  passing verifier cannot override the stored failure dimension and evidence.
- Interrupt is requested once without making terminal persistence wait for the
  adapter Promise. A pending or rejected interrupt cannot prevent timeout
  fail-close. The adapter invocation runs inside a Promise chain, so both a
  synchronous throw and asynchronous rejection are observed without an
  unhandled rejection.
- The worktree guard validates exact repository root, canonical origin, base
  SHA, branch, clean state, and single checkout.
- Worker `SUCCEEDED` is only provisional. The controller transitions to
  `VERIFYING`, runs every required verifier command, and permits `COMPLETED`
  only when all required checks pass. Worker-provided evidence cannot satisfy
  this gate.
- The verifier accepts only the fixed command IDs `GIT_DIFF_CHECK`, `LINT`,
  `TYPECHECK`, `TEST`, and `BUILD`. Executables, arguments, and timeouts are
  controller-owned. Child processes receive a minimum explicit environment
  that excludes credentials, tokens, secrets, and `NODE_OPTIONS`.
- `FakeWorkerAdapter` provides an actual deterministic dispatch boundary for
  tests without external side effects.

### Partially implemented

- Verification command-surface isolation is implemented, but operating-system
  network isolation is not. The controller prevents arbitrary `node`,
  `npm install`, `npx`, `git push`, PowerShell, Python, and executable requests.
  It also runs approved npm commands with offline and ignore-scripts settings.
  Nevertheless, approved repository scripts execute trusted repository code;
  this local process model has no firewall, container, or restricted network
  namespace. It must not be described as external-call blocking.
- Interruption is invoked and bounded to one call, but whether an underlying
  process actually exits depends on the injected adapter's interrupt
  implementation.

### Interface only

- `WorkerAdapter` and the interrupt callback define the transport boundary.
  No actual Codex App Server or `codex exec` transport is connected.

### Phase 3 or later

- Worktree creation, commit/push/Draft PR automation, GitHub write operations,
  CI and Vercel Preview reconciliation, planner/reviewer integration, durable
  cloud workers, and operating-system sandboxing remain outside Phase 2.

## Security and external effects

- No secret value, environment value, command output, or raw worker payload is
  stored as result evidence.
- No Supabase, Vercel, GitHub, Codex, Coupang, Domeggook, Production, or paid
  API call occurs in the Phase 2 verification path.
- No product route, Auth, RLS, CSRF, migration, database data, or commerce
  behavior changes.
- Fixture Git repositories exist only under the operating-system test
  directory and are removed after each test.

## Acceptance evidence

Focused tests cover successful dispatch, deterministic task selection,
checkpoint/result audit, duplicate suppression, bounded retry and lineage,
approval wait and resume, usage and wall-time interruption, late-result
suppression, worktree guards, mandatory verification, fixed command IDs,
minimum child environment, and secret exclusion.

Local release-gate evidence:

- focused Phase 1+2 tests: 35/35 passed, including a fixture documentation
  Worker that produces a policy-checked, verified local Git commit;
- full tests: 303/303 passed;
- lint: zero errors and four pre-existing warnings;
- typecheck: passed;
- production build: passed with 69 routes;
- Playwright: 39/39 passed.

Delivery evidence:

- implementation commit:
  `5435b93f2b579b0d93899520c48da32e026f2299`;
- Draft PR: #44, `manual-merge-required`;
- initial exact-head CI, disposable DB baseline replay, Vercel Preview, and
  Preview browser validation: passed.

The final status-only checkpoint is revalidated before repository-owner
handoff.

## Rollback and remaining work

Rollback is a Git revert of the Phase 2 PR. Existing local ledgers can retain
the additive v2 tables for audit; no code automatically deletes operator data.
Product runtime and all external systems remain unchanged.

Phase 3 remains out of scope: no branch push, Draft PR creation by the
orchestrator, CI/Preview polling, deployment reconciliation, or merge action is
implemented here. Actual Codex App Server/`codex exec` transport remains a
later adapter checkpoint behind explicit authentication, cost, and execution
policy decisions; this slice proves the controller lifecycle with the safe
fake adapter.
