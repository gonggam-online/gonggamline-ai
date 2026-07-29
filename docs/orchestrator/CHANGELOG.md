# Orchestrator changelog

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
