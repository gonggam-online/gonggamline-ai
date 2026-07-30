# Phase 4 GitHub and Preview delivery vertical slice

Status: implemented locally on
`codex/feat/orchestrator-phase-4-github-preview`; delivery requires a
`manual-merge-required` Draft PR.

Base: PR #46 merge
`bc8ec1c038bcc767c2646f06bdb0b43a52677900`.

## Objective and revenue impact

Extend the merged local controller through intentional commit, exact-head
push, duplicate-free Draft PR, exact GitHub CI, Vercel Preview, browser
artifact evidence, and `WAITING_FOR_HUMAN`. This removes repeated delivery
coordination before the protected Item Selection implementation that supports
reproducible supplier screening and future profitable product selection.

## Architecture and risk

The accepted Engineering Orchestration lifecycle owns this change. No Product
Domain, public API, database, migration, Supabase, Production, marketplace, or
commerce boundary changes.

The whole Story is high-risk/manual because it adds GitHub write automation.
It cannot mark a PR Ready, merge, auto-merge, deploy Production, change
configuration, or perform commerce writes.

## Implemented

- Supervised operator entrypoint with canonical TaskContract validation,
  deterministic N routing, exact repository/worktree/base checks, durable
  ledger registration, App Server dispatch, budget enforcement, fixed
  verification, retry, and sanitized output.
- Controller-owned verified commit with exact staged-path comparison.
- Non-force task-branch push followed by exact remote SHA verification.
- Duplicate-free Draft PR lookup/creation and required-label reconciliation.
- Exact-head GitHub workflow, Preview deployment, and browser artifact checks.
- Restart-safe reconciliation that cannot duplicate commit, push, or PR and
  stops at `WAITING_FOR_HUMAN`.

## Bootstrap execution evidence

Failed controller attempts remain in the external ledger and were never
rewritten as success. Initial token ceilings stopped before repository changes.
The investigation found that the adapter ignored protocol `totalTokens` and
could double-count reasoning output. The compatibility fix now uses
`totalTokens` when available. A wrong bootstrap base SHA was also rejected
before execution. Later allowlisted Worker changes were independently verified
before checkpoint commits. The audit chain remained valid.

The operator-local ledger is outside Git at
`D:\Dev\orchestrator-state\phase4.sqlite`.

## Local verification

- Phase 4 focused tests: 11/11 passed.
- Token-accounting focused tests: 3/3 passed.
- Typecheck, focused lint, and `git diff --check`: passed.
- Repository lint: zero errors and four pre-existing warnings.
- Full unit/integration tests: 335/335 passed.
- Production build: passed with 69 routes.
- Local Playwright: 32/39 passed. The same seven Supabase-backed routes failed
  with external `missing_url`; API health, revenue-critical, Dashboard, and
  all other routes passed.
- Exact-head CI, Preview, and browser validation remain required.

## Initial remote delivery evidence

Draft PR #47 is open with `manual-merge-required`. Its first exact head
`df59e3744e2528c335eb64403af5a9f105cf7e37` passed CI, disposable database
replay, Vercel Preview deployment `5668533232`, and Preview browser workflow
run `30510915660`. Evidence artifact `8747089141` is non-expired and retained
through 2026-08-13. A final status-only commit requires one last exact-head
revalidation before handoff.

## Security, rollback, and remaining risks

No force push, `main` push, Ready transition, merge, auto-merge, Production,
Supabase, secret, OAuth, paid API, or commerce write is implemented.

Rollback is a Git revert of the Phase 4 PR. The local command adapter relies on
the authenticated operator environment and process-level controls, not
independent OS network isolation. Planner/reviewer automation remains later
SHADOW work.

After manual merge, the first real Product task is the protected Item Selection
security Vertical Slice in
`docs/orchestrator/examples/item-selection-security.task.json`.
