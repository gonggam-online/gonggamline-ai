# Phase 3 Codex transport and local execution slice

Status: implemented and locally verified on
`codex/feat/orchestrator-phase-3`; delivery requires a separate
`manual-merge-required` Draft PR.

Base: PR #44 merge
`52ffa71d4cefb51fe980c19b0b5dff7532d5f685`.

## Decision

Use the installed Codex App Server over local stdio JSONL as the first real
Worker transport. The installed CLI exposes `initialize`, `thread/start`,
`turn/start`, streamed notifications, token-usage updates, and
`turn/interrupt`. This preserves the Phase 2 `WorkerAdapter` boundary while
providing lifecycle and interruption primitives.

The adapter launches `codex app-server --stdio` in the approved repository. It
sends a structured goal plus run, task, attempt, retry, and correlation
identity. Final output is constrained by a controller-owned schema. Raw model
output and raw transport lines are not persisted: results are reduced to
sanitized summaries and hashes. Worker evidence remains informational and
cannot satisfy the controller verifier.

This is process-level policy enforcement, not an operating-system sandbox.
App Server receives workspace-write with network disabled and approval policy
`never`, plus a minimum child environment. The controller additionally checks
the canonical repository, origin, branch, base SHA, single worktree checkout,
owned status hash, allowlisted changed paths, and symlink traversal before and
after execution. There is no firewall, container, Windows restricted token, or
network namespace.

## Implemented and verified

- Real App Server stdio transport with initialize/thread/turn lifecycle.
- Structured goal and correlation context, including prior verifier failure on
  retry.
- Hashed transport checkpoints and controller-observed token usage.
- Structured success, failure, and human-approval outcomes.
- Abnormal process/error/malformed protocol fail-close behavior.
- Duplicate terminal-event suppression and a maximum-one interrupt request.
- Minimum environment propagation without credential/token/secret variables.
- Canonical root/origin/branch/base checks, single checkout, clean first
  attempt, owned retry status, allowed changed paths, and symlink rejection.
- A bounded development loop that lets the durable Phase 2 controller create
  retry runs with `retryOfRunId`.
- Verifier failure context is fed into the next attempt; only controller-run
  fixed verification commands can produce `COMPLETED`.

## Partial implementation and known limits

- App Server requests network-disabled workspace-write, but the local Windows
  process has no independently proven firewall or restricted-token boundary.
- Command intent is constrained by prompt, sandbox policy, stripped
  credentials, clean-start policy, and post-execution Git inspection. The
  adapter does not intercept every Worker subprocess. A destructive command
  that returns the repository to the same observable HEAD/status could evade
  post-run detection. Isolated branches/worktrees and backups remain required.
- The SQLite ledger, leases, route uniqueness, retry lineage, checkpoints, and
  audit chain are durable. The App Server subprocess is not reattached after a
  controller restart; recovery uses the existing controller checkpoint
  contract.
- Interrupt delivery now has a bounded direct-child shutdown contract. The
  controller waits at most 100 ms for the adapter boundary before terminal
  persistence. The adapter sends `turn/interrupt`, closes stdin, waits a short
  grace period, requests direct child termination at most once, and requires an
  observed process exit before a normal result can return.
- Windows npm installations resolve the packaged native `codex.exe` directly,
  avoiding an intermediate Node wrapper that could orphan the App Server child.
  Non-Windows installations use the resolved `codex` executable. This controls
  the directly spawned App Server process, not an independently enumerated
  descendant process tree.
- If an injected termination callback throws, rejects, or never settles, the
  controller still persists the timeout/budget failure after its independent
  bound. `PROCESS_TERMINATION_FAILED` or `PROCESS_EXIT_TIMEOUT` records the
  incomplete shutdown. The production launcher uses the synchronous Node
  `ChildProcess.kill` request and fails closed unless exit is observed.
- The adapter does not commit. The slice ends at a verified local change and
  persisted completion result.

## Interface only

- An operator supplies the structured goal, approved workspace boundary,
  budgets, verification plan, and route allocation.
- There is no product UI or public API for submitting the goal.

## Phase 4 or later

- GitHub push/write and duplicate-free Draft PR creation.
- CI and exact Preview reconciliation.
- Planner/reviewer task decomposition and revenue-priority scoring.
- Production, Supabase, Vercel Production, marketplace, order, purchasing, or
  other external writes.

## Opt-in local live smoke

The hermetic suite never invokes authenticated Codex. A live smoke is
operator-controlled because it consumes the current Codex allowance and mutates
its approved worktree.

1. Prepare a clean, dedicated non-`main` branch checked out exactly once.
2. Record its exact HEAD and canonical origin. Do not use a worktree containing
   user changes.
3. Configure `AppServerWorkerAdapter` with that root, origin, branch, HEAD, and
   the smallest allowed path. Deny secrets and repository metadata.
4. Use fixed verifier command IDs and conservative token, cost, wall-time, and
   retry limits.
5. Run `runDevelopmentLoop` from a supervised local process. Never print the
   environment or raw transport payload.
6. Inspect `git status`, `git diff`, ledger result/checkpoints, and verifier
   hashes. Treat any policy, timeout, budget, adapter, or verification failure
   as fail-close.
7. Keep or revert only the Worker-created fixture through ordinary reviewed Git
   operations. Do not push, merge, deploy, or contact external services.

The delivery report records live smoke as `PASS`, `FAIL`, `BLOCKED`, or
`NOT RUN`; hermetic tests cannot substitute for it.

The repository provides the supervised entrypoint:

```powershell
npx.cmd tsx tools/orchestrator/live-smoke.ts <repository-root> <allowed-target>
```

On 2026-07-30 the live smoke first proved token-budget fail-close at the
original 20,000-token ceiling. Subsequent probes exposed two real Windows/App
Server integration defects: packaged executable launch returned `EPERM`, and
the final structured message arrived through `item/completed` while the final
turn item list was empty. The adapter was corrected to launch the installed npm
CLI through `node` without a shell and to consume the documented streamed item.
The final clean-worktree run completed in one attempt with:

- one allowlisted change:
  `docs/orchestrator/reports/phase-3-live-smoke.md`;
- controller `GIT_DIFF_CHECK` evidence;
- valid SQLite audit chain;
- no commit, push, deploy, database, marketplace, or other external write.

## Final local verification

- Phase 1+2+3 focused tests: 54/54 passed.
- Full unit/integration tests: 322/322 passed.
- Lint: zero errors and four pre-existing warnings.
- Typecheck: passed.
- Production build: passed with 69 routes.
- Playwright: 39/39 passed.
- `git diff --check`: passed.

The bounded-shutdown review smoke completed in one attempt on the native
Windows App Server child. The final persisted checkpoint was
`PROCESS_EXITED`; one termination request was made after stdin grace expired,
and controller verification ran only after the observed exit. The only changed
path was `docs/orchestrator/reports/phase-3-shutdown-live-smoke.md`.

## Rollback

Revert the Phase 3 PR. No migration, Production data, Supabase object, GitHub
write, Vercel deployment, or commerce action is created by this implementation.
