# Phase 4 SHADOW planner/reviewer

Status: implemented and locally verified

Risk: normal-risk; local deterministic tooling, tests, and documentation only

## Outcome

Phase 4 now has a deterministic SHADOW-only planner/reviewer boundary. It
accepts an evidence-referenced context pack, scores one bounded candidate for
revenue and operator-time impact, and proposes `NEXT_TASK`, `RETRY`, or
`REPLAN`. Every proposal carries `mode: SHADOW` and
`dispatchAuthorized: false`; the module has no worker, ledger transition,
delivery, GitHub-write, database, Production, or commerce-write dependency.

## Verified context and decisions

- A context pack requires a full lowercase base SHA, policy and Architecture
  versions, and at least one unique claim with source, timestamp, and evidence
  reference.
- Missing dependency evidence, invalid prior contracts, exhausted retry budget,
  and paths outside the deterministic allowlist produce `REPLAN`.
- A verified retryable failure produces `RETRY` only while budget remains.
- A verified, dependency-ready, policy-allowed candidate produces `NEXT_TASK`.
- Revenue impact contributes at most 60 points, operator time at most 30, and
  urgency at most 10. Invalid inputs are rejected rather than silently fixed.

The score ranks recommendations; it never authorizes work or changes the
repository's risk and approval classifications.

## Offline owner evaluation

`evaluateOwnerSample` compares proposals with explicit owner decisions and
reports exact-match rate plus per-outcome precision and recall. Empty samples
and duplicate sample IDs fail closed. The test fixture verifies calculation,
but is not an owner-approved operational sample or acceptance evidence.

Promotion beyond SHADOW remains blocked until the owner defines and scores the
sample and approves sample size and thresholds. Phase 5 dispatch retains its
separate prerequisites and authorization.

## Adversarial coverage

Tests cover absent claims, invalid base identity, missing evidence references,
Supabase migration/Product API/environment/traversal-shaped forbidden paths,
missing dependencies, invalid contracts, retry exhaustion, and invalid score
inputs. Every returned proposal continues to deny dispatch authority.

## Rollout and rollback

Rollout is offline SHADOW evaluation only. Callers may persist or display the
proposal but must not translate it into execution. Roll back by reverting the
module export, implementation, tests, and this report. No data rollback,
configuration change, or external reconciliation is required.
