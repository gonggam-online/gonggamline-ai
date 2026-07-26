# Engineering manual

## Project structure

Use the boundaries in [`ARCHITECTURE_BLUEPRINT.md`](ARCHITECTURE_BLUEPRINT.md).
See [`../PROJECT_MAP.md`](../PROJECT_MAP.md) for the current route and domain map.

## Branch and PR strategy

- Work only on a current non-`main` branch; default new names use `codex/`.
- Never clone into a temporary workspace, force-push, reset hard, or overwrite
  unrelated user work.
- One Story -> one small PR -> one merge decision.
- State objective, revenue impact, root-cause class, scope/non-goals, risk,
  tests, security, rollout, rollback, and remaining risks.

## Merge and release strategy

Follow [`MERGE_POLICY.md`](MERGE_POLICY.md). Normal-risk work may use native
auto-merge only after every gate passes. High-risk work is manual. Validate the
exact Preview commit, then perform non-destructive Production smoke after merge.

## Testing pyramid

1. Pure domain/unit tests for rules and edge cases.
2. Service/integration and contract tests for orchestration and boundaries.
3. Production build and route generation.
4. Focused browser flows plus route/API/console/network validation.
5. Exact-commit Preview and post-merge Production smoke.

Commands and browser acceptance criteria are in
[`../TESTING_GUIDE.md`](../TESTING_GUIDE.md) and
[`browser-validation.md`](browser-validation.md).

## Architecture review

Run the AI CTO Compliance Check and
[`ARCHITECTURE_REVIEW.md`](ARCHITECTURE_REVIEW.md) before implementation.
Unresolved compliance is a stop condition, not a coding problem.

## Definition of Done

A Story is done only when scope and acceptance criteria are satisfied; the full
diff is reviewed; changelog and
[`DECISION_LOG.md`](DECISION_LOG.md) are updated where applicable; lint,
typecheck, tests, build, browser, CI, and exact Preview gates pass; delivery
status and rollback are recorded; and post-merge Production checks pass when a
merge occurs. Incomplete or blocked work is reported as such.
