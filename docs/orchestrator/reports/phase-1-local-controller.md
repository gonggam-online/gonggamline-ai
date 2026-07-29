# Phase 1 local ledger, policy, and router report

Status: implemented locally; separate manual-bootstrap Draft PR required

Base: PR #42 merge
`75d48dba3da9cb36bdecbd34de5604346379e601`

Branch: `codex/feat/orchestrator-phase-1`

## Boundary

Phase 1 implements deterministic local control primitives only. It does not
launch Codex, create or mutate worktrees, run repository commands, push a
branch, create a pull request, call Vercel/Supabase/Coupang, or perform any
external side effect. Those actions remain Phase 2 or later.

The SQLite database path is caller-supplied, must be absolute, and must be
outside the Git repository. Tests use disposable operating-system temporary
directories; no ledger file is committed.

## Implemented components

### Canonical contract validator

`tools/orchestrator/contracts.ts` compiles the accepted TaskContract and
ResultContract using strict Draft 2020-12 AJV validation and format checks.
Codex-compatible generation schemas remain weaker adapters: every generated
result must pass this canonical validator before any success transition.

### SQLite ledger

`tools/orchestrator/ledger.ts` embeds migration v1 for:

- projects, repositories, and PC capability fingerprints;
- task identity, parentage, attempt, state, and idempotency key;
- exclusive active repository/branch and worktree routing;
- controller leases with expiry and takeover guards;
- external action idempotency keys and immutable payload hashes;
- chained audit events with deterministic SHA-256 verification.

Expired `RUNNING` leases are returned as recovery candidates and are never
silently converted to `FAILED` or `COMPLETED`.

### Policy and routing

- state transitions match `workflow.md` and prohibit skipped terminal success;
- deny paths take precedence over allow paths and repository escapes fail
  closed;
- mandatory approval action classes are explicit;
- the default routing table assigns architecture/contracts/orchestrator/docs to
  N and only approved product implementation to D;
- an unknown task class or missing capability has no AI fallback and fails.

### Budget enforcement

The budget guard evaluates total input/output/reasoning tokens, wall time, and
estimated cost at every observed usage checkpoint. The first breach requests
an interrupt exactly once and every breach throws `BudgetExceededError`.

This closes the Phase 0 finding where `codex exec` exceeded a TaskContract
token limit without enforcing it. The later execution adapter must feed every
streamed usage update into this guard; Phase 1 does not launch Codex.

### Interrupt and Windows recovery

Cancellation first calls the App Server `turn/interrupt` boundary. An
acknowledged interrupt produces no process-kill plan.

Fallback Windows process recovery is allowed only for a process tree whose
root and descendants:

- are explicitly correlated to the same task ID;
- descend from the recorded root PID; and
- are limited to `codex.cmd`, `node.exe`, and `codex.exe`.

Any unrelated or ambiguous descendant produces
`MANUAL_RECONCILIATION`. The library returns a plan; it does not kill
processes in Phase 1.

## Verification

Focused tests prove:

- canonical fixtures pass and malformed result-like model output fails;
- invalid state skips fail;
- repository-contained or relative ledger paths fail;
- a restart plus simulated N/D controller cannot duplicate a task, active
  branch/worktree route, Draft PR reservation, or changed-payload action;
- active leases exclude another controller and expired `RUNNING` tasks remain
  recovery candidates;
- audit-chain tampering is detected;
- token breach interrupts once and fails closed;
- App Server acknowledgement suppresses fallback process handling;
- ambiguous Windows descendants cannot be stopped automatically;
- path/approval policy and explicit N/D routing fail closed.

Local delivery validation:

- focused Phase 1 tests: 14/14 passed;
- full repository lint: zero errors, four pre-existing warnings;
- typecheck: passed;
- unit/integration: 282/282 passed;
- Production build: passed with 69 routes;
- local Playwright: all 39 cases reached, 32 passed, and the same seven
  Supabase-dependent routes failed with external `missing_url` configuration
  before the outer timeout.

Exact-head CI and Preview results are recorded in the PR.

## Rollback and remaining work

Rollback is a Git revert of this implementation. Existing application runtime,
database schema, Supabase, Vercel, Production, and commerce state are
unchanged. A caller may delete its own external local ledger only under a
separate explicit data-retention decision; this implementation performs no
ledger deletion.

Phase 2 remains unauthorized by this PR. It must separately implement the
worktree guard and Codex execution vertical slice, using these primitives and
the Phase 0 protocol evidence.
