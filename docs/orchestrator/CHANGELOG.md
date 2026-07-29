# Orchestrator changelog

## 2026-07-29 — Phase 2 execution vertical slice

- Added local run creation, deterministic `READY` task selection, Worker
  dispatch, synchronized task/run state transitions, checkpoints, immutable
  result evidence, retry lineage, approval wait, and resume.
- Added duplicate suppression and bounded budget interruption using the Phase 1
  ledger, lease, state, and budget primitives.
- Added exact worktree guards and a controller-owned verifier with fixed
  command IDs, mandatory success gating, hashed evidence, and a minimum
  credential-free child environment.
- Added an independent wall-clock timeout with interrupt-once and late-result
  suppression.
- Latched usage-budget breaches in the controller so caught hook errors,
  Worker success, and verifier success cannot reverse a failure.
- Decoupled timeout persistence from interrupt adapter completion; pending and
  rejected interrupt Promises are observed without blocking fail-close.
- Moved interrupt adapter invocation into the observed Promise chain so a
  synchronous throw also cannot block timeout persistence.
- Added a deterministic fake Worker adapter and focused success, failure,
  retry, approval, recovery, security, and guard tests.
- Documented that command-surface restriction is implemented but operating-
  system network isolation and actual process termination remain incomplete.
- Did not add Codex network execution, GitHub writes, CI/Preview polling,
  product APIs, Supabase changes, Production changes, or commerce writes.

## 2026-07-28 — Phase 1 local ledger, policy, and router

- Added a Node 24 `node:sqlite` ledger with embedded schema migration,
  idempotent task/action identities, exclusive route/lease records, and an
  audit hash chain.
- Added canonical Task/Result JSON Schema post-validation with AJV 2020.
- Added deterministic state, path, approval, N/D routing, and task budget
  policies.
- Added App Server interrupt-first cancellation and fail-closed Windows
  process-tree reconciliation rules.
- Added restart, D/N collision, duplicate PR/action, lease, audit-tamper,
  budget, contract, routing, and recovery tests.
- Did not add a Codex execution adapter, worktree mutator, GitHub writer,
  durable worker, or any Phase 2+ behavior.

## 2026-07-28 — Phase 0 protocol spike

- Accepted the merged architecture baseline from PR #41.
- Added executable fixtures for Codex App Server, structured `codex exec`, and
  synthetic log-redaction probes.
- Recorded schema compatibility, thread resume, interruption, usage, and
  process-tree cleanup evidence without committing raw transcripts.
- Confirmed that canonical task budget enforcement must remain deterministic in
  the controller: a technically successful CLI call exceeded its task token
  limit and is recorded as `FAILED` / `BLOCKED`.
- Kept Phase 1 implementation outside this change and subject to separate
  approval, branch, and pull request.
