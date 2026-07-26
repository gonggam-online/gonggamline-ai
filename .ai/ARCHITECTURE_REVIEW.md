# Architecture review

## Story compliance gate

Answer before implementation:

1. Which approved domain and boundary own the change?
2. What existing source of truth, API, DTO, database, Queue, or lifecycle is used?
3. Does the Story introduce a new Domain, Database, Migration, Queue,
   Lifecycle, Public API, or External Integration?
4. Are dependency direction, security, failure handling, observability, tests,
   rollout, and rollback compliant with the blueprint?
5. Is the evidence recorded in the Story and Decision Log?

If questions 1, 2, 4, or 5 are unresolved, compliance fails. If question 3 is
yes, implementation must stop unless the required Architecture Story is already
completed and approved.

## Architecture Story minimum content

- problem, business objective, owner, and non-goals;
- current-state evidence and alternatives considered;
- domain ownership and dependency diagram;
- contracts, DTOs, data model, state/lifecycle, and external boundaries;
- security/privacy, failure modes, idempotency, recovery, and observability;
- compatibility, migration/deployment order, test strategy, and capacity;
- rollout, rollback, decision, approver, and approval date.

Approval means a recorded owner/AI CTO decision in
[`DECISION_LOG.md`](DECISION_LOG.md), not merely the existence of a draft.
Architecture approval does not waive [`RISK_POLICY.md`](RISK_POLICY.md).
