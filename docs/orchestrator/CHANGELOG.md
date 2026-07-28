# Orchestrator changelog

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
