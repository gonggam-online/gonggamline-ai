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

## Implemented boundary

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
- Streamed usage checkpoints feed the Phase 1 budget guard. A breach interrupts
  once and ends as `FAILED`.
- The worktree guard validates exact repository root, canonical origin, base
  SHA, branch, clean state, and single checkout.
- The verifier executes only local process commands, records exit status,
  duration, and output hash, and rejects known external-capable CLIs.
- `FakeWorkerAdapter` provides an actual deterministic dispatch boundary for
  tests without external side effects.

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
approval wait and resume, budget interruption, worktree guards, verifier
hashing, and external-command rejection.

Local release-gate evidence:

- focused Phase 1+2 tests: 26/26 passed, including a fixture documentation
  Worker that produces a policy-checked, verified local Git commit;
- full tests: 294/294 passed;
- lint: zero errors and four pre-existing warnings;
- typecheck: passed;
- production build: passed with 69 routes;
- Playwright: 39/39 passed.

Exact commit/PR identifiers and remote gates are recorded after terminal
delivery.

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
