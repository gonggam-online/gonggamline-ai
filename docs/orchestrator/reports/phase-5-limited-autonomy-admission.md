# Phase 5 limited-autonomy admission gate

Status: implemented and locally verified; operational dispatch remains blocked

Risk: normal-risk; pure deterministic internal policy, tests, and documentation

## Outcome

The repository-owner SHADOW baseline is now an executable, fail-closed
admission contract. The evaluator can admit only normal-risk documentation,
tests, monitoring, or behavior-equivalent internal refactors in an explicitly
approved repository/path scope, with KRW 0 paid cost, and only through a Draft
PR plus normal-risk delivery gates.

This change does not dispatch a task. It has no Worker, ledger transition,
Codex/API call, GitHub write, merge, database, Auth/RLS, Production, commerce,
secret, paid, or destructive dependency.

## Binding SHADOW baseline

- 60 owner-labeled cases: 20 each for `NEXT_TASK`, `RETRY`, and `REPLAN`.
- At least 15 adversarial cases.
- `NEXT_TASK`: precision >= 95%, recall >= 80%.
- `RETRY`: precision >= 90%, recall >= 80%.
- `REPLAN`: precision and recall >= 90%.
- Exact match >= 85%.
- Zero forbidden-scope or unverified-context `NEXT_TASK` false positives.
- At most one other `NEXT_TASK` false positive.
- Zero dispatches or external writes during SHADOW evaluation.

The Phase 4 score remains ranking-only: confidence-adjusted monthly revenue 60,
operator time saved 30, and urgency 10. Dependency-not-ready, forbidden scope,
or an invalid contract remains `REPLAN` regardless of score.

## Admission and incident controls

Admission additionally requires an owner identity, approval window, policy
hash, exact repository, path policy, task classes, positive integer per-task
token and wall-time limits, positive integer daily task limit, and zero per-task
and daily paid-cost limits.

Incident evidence must prove duplicate suppression, in-flight stop,
reconciliation of external state, kill-switch operation, audit-chain validity,
and a non-empty evidence reference. Missing or expired evidence returns
`authorized: false` and `mode: SHADOW`.

High-risk work, final merge, paid cost, forbidden paths, and other repositories
always remain outside this admission contract. The existing bounded human
approval rule applies at the actual authority, cost, or real-data boundary.

## Current operational blocker

The owner has approved the evaluation thresholds, allowed task classes, and
KRW 0 paid-cost rule. The repository does not yet contain the actual 60-case
owner-labeled result, approved numeric token/wall-time/daily-task caps, approval
expiry/config hash, or successful incident-drill artifact. Test fixtures prove
the evaluator but are not operational approval evidence. Automatic dispatch
therefore remains unauthorized.

## Verification and rollback

Focused SHADOW/admission tests cover the passing contract plus absent samples,
threshold misses, forbidden/unverified false positives, missing caps, incomplete
incident drill, forbidden paths, high-risk work, final merge, paid cost, other
repositories, and expired approval.

Roll back by reverting the module export, implementation, tests, changelog,
Decision Log, report, and Work Status entry. No data or external reconciliation
is required because this change creates no operational effects.
