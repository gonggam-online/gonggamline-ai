# Development protocol

Before implementation: work only here; read `AGENTS.md` and relevant `.ai` files; verify a safe non-main branch and working tree; inspect revenue impact, dependencies, and deterministic risk. Never clone, use a temporary workspace, expose secrets, overwrite user work, force-push, or reset hard.

Continue autonomously through routine choices using existing conventions and the smallest safe design. Preserve behavior. If blocked, record the blocker and continue independent tasks. Never mask failures, disable lint/type checks/tests, or convert unexpected errors to success responses.

Validate locally with complete diff review, lint, typecheck, existing unit/integration tests, production build, browser checks, workflow YAML validation, and inspections for secrets and generated output.

This document expands the permanent Mandatory Codex Task Protocol in `AGENTS.md`.
