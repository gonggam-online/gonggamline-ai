# Orchestrator workflow and state model

This document operationalizes [architecture.md](architecture.md). State changes
are policy decisions recorded as events, not inferred from agent prose.

## 1. End-to-end loop

1. Reconcile GitHub, local Git, ledger leases, and prior incomplete tasks.
2. Planning/review agent reads only verified state and proposes a TaskContract.
3. Contract validator rejects unknown repository/schema/API/approval claims.
4. Router applies explicit repository, PC, branch, worktree, dependency,
   concurrency, and budget tables.
5. Controller reserves task and action idempotency keys.
6. Worktree guard verifies origin, exact base SHA, clean status, branch
   uniqueness, allowed paths, and no concurrent checkout.
7. Codex runs under the TaskContract and repository rules.
8. Controller checkpoints streamed events, commands, file changes, usage, and
   approval requests.
9. Verifier independently inspects Git, files, commands, commit, push, PR,
   checks, deployment, and browser evidence.
10. Review agent receives ResultContract plus verifier verdict and returns one
    allowed outcome.
11. Controller either creates the next task, retries, replans, waits, requests
    human action, blocks, or closes the project.

## 2. States

| State | Entry condition | Permitted exits |
|---|---|---|
| `PLANNED` | proposed TaskContract stored; value/dependencies known | `READY`, `REPLANNING`, `CANCELLED` |
| `READY` | schema/policy valid; dependencies satisfied; route and budget reserved | `RUNNING`, `WAITING_FOR_HUMAN`, `CANCELLED` |
| `RUNNING` | worktree lease and thread/attempt started | `VERIFYING`, `WAITING_FOR_HUMAN`, `RETRYABLE_FAILURE`, `BLOCKED`, `FAILED`, `CANCELLED` |
| `VERIFYING` | execution stopped at checkpoint with candidate result | `WAITING_FOR_CI`, `WAITING_FOR_HUMAN`, `RETRYABLE_FAILURE`, `REPLANNING`, `BLOCKED`, `COMPLETED`, `FAILED` |
| `WAITING_FOR_CI` | pushed exact head and expected checks/deployment registered | `VERIFYING`, `RETRYABLE_FAILURE`, `WAITING_FOR_HUMAN`, `BLOCKED`, `CANCELLED` |
| `WAITING_FOR_HUMAN` | exact approval/action request recorded | prior safe state, `REPLANNING`, `BLOCKED`, `CANCELLED` |
| `RETRYABLE_FAILURE` | classified transient or bounded corrective failure | `READY`, `RUNNING`, `REPLANNING`, `FAILED`, `CANCELLED` |
| `REPLANNING` | contract/scope/dependency invalidated without unsafe side effect | `PLANNED`, `WAITING_FOR_HUMAN`, `BLOCKED`, `FAILED`, `CANCELLED` |
| `BLOCKED` | no safe progress until external fact/authority/state changes | `REPLANNING`, `READY`, `CANCELLED`, `FAILED` |
| `FAILED` | permanent failure or retry/time/cost ceiling exhausted | terminal |
| `COMPLETED` | done criteria and verifier evidence pass; required delivery boundary reached | terminal |
| `CANCELLED` | authorized cancellation; active execution interrupted and reconciled | terminal |

`COMPLETED` means the individual TaskContract boundary is complete. A Draft PR
task may be completed while the project outcome is `WAITING_FOR_HUMAN`.

## 3. Transition guards

- No transition skips validation or writes directly to a terminal success.
- `RUNNING` requires a valid lease `{controllerId, pcId, worktree, branch,
  expiresAt}` and exact `baseSha`.
- `VERIFYING -> COMPLETED` requires every declared done criterion and required
  evidence item.
- `WAITING_FOR_CI` is valid only for an exact pushed commit and known PR.
- Approval is action-specific, expires, and binds task/attempt/target/hash.
- A base SHA, diff, cost, target, or permission change invalidates approval.
- Terminal states release branch/worktree leases only after reconciliation.

## 4. Review outcomes

The review agent returns exactly one:

- `NEXT_TASK`: current task is verified; create one bounded successor.
- `RETRY`: same contract remains valid and failure is retryable.
- `REPLAN`: objective remains but scope/route/contract must change.
- `WAIT_FOR_CI`: exact-head CI or Preview is pending.
- `WAITING_FOR_HUMAN`: a policy gate or external action is required.
- `BLOCKED`: no safe progress and no immediately actionable approval exists.
- `PROJECT_COMPLETED`: verified business/project completion criteria are met.

The verifier may downgrade any review outcome. It cannot upgrade a missing gate.

## 5. Routing and cross-PC rules

1. Fetch and identify canonical repository and `origin/HEAD`.
2. Prefer `origin/main` when it is unambiguously the integration branch.
3. Use an explicit dependency head only for a declared stacked task.
4. Refuse dirty unexplained changes or overlapping worktree/branch ownership.
5. Assign N to architecture/contracts/orchestrator; D to approved product work.
6. Prohibit one branch in multiple worktrees or simultaneous D/N ownership.
7. Persist PC-specific worktree path, environment capability fingerprint, and
   login reference; never sync local secret values through Git.
8. Serialize merge candidates. After any merge, mark remaining candidates
   `REPLANNING`, update to latest `main`, and reverify.
9. Treat `.ai/DECISION_LOG.md` and `.codex/WORK_STATUS.md` as shared-hot files:
   detect open-PR overlap before edit and prefer append-only/minimal updates.

## 6. Retry policy

| Class | Examples | Action |
|---|---|---|
| immediate | stale read, deterministic local race before side effect | same thread, once |
| backoff | provider 429/5xx, GitHub/Vercel transient failure | same task; exponential backoff with jitter and `Retry-After` |
| corrective | lint/test/build code failure | same thread when context is sound |
| context-corrupt | repeated irrelevant edits, broken thread state | checkpoint, new thread, same attempt lineage |
| contract-invalid | changed base, conflicting Architecture, scope drift | `REPLAN` |
| approval | secret, cost, permission, merge, Production, DB, commerce write | `WAITING_FOR_HUMAN` |
| permanent | invalid repository, forbidden action, unrecoverable contract | `FAILED` or `BLOCKED` |

Defaults until the owner approves numeric policy:

- maximum three attempts per task;
- maximum two identical normalized error signatures;
- maximum one corrective retry after a full green suite regresses;
- CI/Preview wait up to 30 minutes, then reconcile and classify rather than
  rerun execution;
- task wall time, token, API cost, daily task count, and daily cost are required
  TaskContract fields; absent approved values keep the task in
  `WAITING_FOR_HUMAN`.

Backoff is capped and respects provider instructions. A circuit breaker opens
when the same external dependency fails across three tasks or the daily error
budget is exceeded. Half-open performs one read-only probe.

## 7. Checkpoint and crash recovery

Checkpoint payload includes state version, base/head SHA, status, diff hash,
thread/turn, last completed command, pending effect, usage, evidence, and lease.

Recovery sequence:

1. acquire controller leadership lease;
2. mark expired `RUNNING` leases as recovery candidates, not failed;
3. inspect OS process, Git status, branch/worktree, remote branch, PR, checks,
   and pending action key;
4. if an external action may have succeeded, query by idempotency key/reference;
5. resume the same thread only when task/base/diff/context hashes agree;
6. otherwise checkpoint and start a new thread or replan;
7. never delete, reset, stash, or commit unexplained changes.

## 8. Verification matrix

| Claim | Required evidence |
|---|---|
| correct repo/base | canonical origin + full base SHA + commit title/time |
| safe changes | status + changed filenames + diff + allowed-path evaluation |
| local quality | command, exit code, time, log/artifact digest |
| delivered commit | commit SHA equals branch/remote/PR head |
| CI | required check names, conclusions, run IDs, exact SHA |
| Preview | GitHub Deployment ID, exact SHA, Ready status, URL reference |
| browser | Playwright result, routes/APIs, console/page/network failures, artifacts |
| Production | authorized merge SHA, deployment and read-only smoke evidence |
| Supabase | approved environment identity, migration/fingerprint result, no secret |
| external call | adapter, target, read/write class, idempotency key, cost, sanitized result |
| business impact | hypothesis plus later actual metric/evidence class |

## 9. Approval lifecycle

The controller pauses before the action, not after it. The request follows
[approval-policy.md](approval-policy.md), includes rollback and verification,
and emits no secret value. Approval may resume only the exact action. Rejection
cancels the action and normally triggers `REPLAN`.

## 10. Cancellation

Cancellation stops/interrupts the active turn, prevents new external effects,
records the last safe checkpoint, reconciles Git/GitHub, releases leases, and
preserves user files. It never deletes a branch/worktree or rolls back an
external action automatically.
