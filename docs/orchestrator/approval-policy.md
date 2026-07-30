# Human approval policy

The default is autonomous analysis and reversible engineering work within an
approved TaskContract. Approval grants one exact action, not broad authority.

## 1. Automatic actions

When policy, scope, budget, and repository gates pass:

- read repository/GitHub/CI/Preview metadata;
- analyze state and create the next structured task;
- create a task branch/worktree without conflicting checkout;
- edit allowed code/docs, run local checks, and perform bounded retries;
- commit, push the work branch, open/update a Draft PR;
- wait for and analyze CI and exact-commit Preview;
- inspect diffs, logs, artifacts, sanitized external read failures;
- stop/cancel an in-flight Codex turn before an unapproved effect.

Automatic does not mean unbounded. Every action is logged and budgeted.

## 2. Mandatory human approval

| Action class | Approval boundary |
|---|---|
| final PR merge | every PR; `main` serialized |
| Production | deploy, promote, rollback, config or traffic change |
| Supabase | schema, migration, RLS, Auth, data/backfill/repair, Production connection |
| commerce | first or subsequent real listing, price, inventory, ad spend, order, purchase, fulfillment, return, settlement |
| identity/security | OAuth/login provider, new account/principal, permission expansion |
| secrets | create/rotate/reveal/store/move a secret or environment value |
| cost | paid API enablement, plan change, quota/limit increase, spend outside approved envelope |
| Git safety | force push, protected-branch setting, branch deletion, destructive history operation |
| regulated/high consequence | legal, tax, finance, certification, privacy or contractual decision |
| autonomy | promotion to a higher autonomy stage or wider action class/cap |
| recovery | retry/time/cost limit exceeded or ambiguous prior side effect |

The orchestrator never approves its own request.

## 3. Approval request contract

Every request must state:

- task/attempt/action ID and exact target;
- proposed action and site/menu or API surface;
- why it is required now and the business impact;
- files, environment, data, users, money, or marketplace objects affected;
- expected one-time and recurring cost;
- risk, worst credible outcome, and blast radius;
- required secret kind and approved store; never the value;
- preconditions and evidence already verified;
- post-action verification;
- rollback/recovery and whether rollback is fully reversible;
- expiry, idempotency key, exact SHA/config hash, and approve/reject choices.

Example owner path:

```text
Site: GitHub
Path: Repository > Pull requests > PR #N > Files changed / Checks
Action: squash-merge exact head <SHA>
Impact: publishes documentation to main; triggers Production deployment
Cost: no new paid service
Secret handling: none
Verify: main SHA, Production deployment, read-only smoke
Rollback: revert merge commit and redeploy last healthy commit
```

## 4. Approval validity

Approval is valid only when actor, action class, target, environment, task,
attempt, exact SHA/config hash, cost cap, and expiry match. Any material change
invalidates it. Chat acknowledgement without those bindings is not reusable.

Standing approval may cover a narrow repeated action only after
`BOUNDED_AUTONOMY` is explicitly approved with:

- allowed object/action, per-action and daily caps;
- observation sample and acceptable loss/error thresholds;
- reconciliation deadline, alerting, kill switch, and audit retention;
- automatic downgrade triggers.

## 5. Autonomy promotion and downgrade

Promotion requires verified actual outcomes, not system readiness:

- minimum owner-approved sample size;
- no unresolved duplicate or unauthorized action;
- acceptable profit/loss, return, drift, and manual-intervention rates;
- successful recovery drill and audit review.

Immediately downgrade to `APPROVAL_GATED` or `SHADOW` on duplicate side effect,
unreconciled external state, secret incident, material financial drift,
policy/version ambiguity, or circuit-breaker opening.

## 6. Denial and expiry

Denied actions are not retried under a different wording or thread. Record the
decision and replan. Expired approvals return to `WAITING_FOR_HUMAN`; they do
not become implicit consent.
