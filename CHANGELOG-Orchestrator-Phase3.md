# Orchestrator Phase 3 changelog

## Added

- Codex App Server stdio Worker adapter with structured outcomes, event
  checkpoints, usage observation, and bounded interrupt.
- Canonical local repository/worktree execution boundary and owned retry diff
  checks.
- Bounded development loop that carries controller verifier failures into the
  next retry attempt.
- Hermetic transport, secret-environment, workspace, and retry-loop tests.
- Phase 3 decision, security limits, rollback, and opt-in live-smoke procedure.
- Bounded App Server shutdown with natural-exit grace, one direct termination
  request, observed-exit checkpoints, and controller quiescence barrier.
- Native Windows Codex child resolution to avoid terminating only an npm
  wrapper process.

## External impact

No product API, database, Supabase, Production, Vercel Production, GitHub write
automation, or marketplace behavior changes.
