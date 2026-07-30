# Phase 4.1 operator and delivery integration

## Outcome

The local supervised operator now hands a controller-verified completed run to
the Phase 4 delivery pipeline when the operator receives a separate,
validated delivery-submission manifest.

The connection is deliberately narrow:

1. validate the canonical TaskContract;
2. route `IMPLEMENTATION` to D and orchestration work to N;
3. run the bounded Worker and controller verifier;
4. only after `COMPLETED`, reconcile commit, exact-head push, Draft PR,
   exact-head CI, Preview, and Preview-browser evidence;
5. stop at the applicable wait state, ultimately `WAITING_FOR_HUMAN`.

On restart, a completed development run is reused. The delivery ledger
reconciles prior external actions, so the Worker, commit, push, and Draft PR
are not duplicated. The post-commit run does not incorrectly reapply the
pre-development clean-worktree and exact-base guard.

## Interface

```text
operator <task-contract.json> <absolute-ledger.sqlite> [delivery-submission.json]
```

The optional local manifest contains only approved commit paths, commit
message, Draft PR title, and Draft PR body-file path. It does not expand the
TaskContract path allowlist or approval policy.

## Risk boundary

This remains a high-risk local automation bootstrap. It does not add a public
API, planner/reviewer, automatic Ready/merge, Product implementation,
Supabase/Vercel Production mutation, secret handling, or commerce writes.
Repository-owner review and `manual-merge-required` remain mandatory.
