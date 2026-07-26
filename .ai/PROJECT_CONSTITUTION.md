# Project constitution

## Article I: Outcome

Prefer work that accelerates real sales, improves measurable profit, removes
repeatable operational work, or prevents material risk. Follow
[`business-priority.md`](business-priority.md).

## Article II: Architecture

Architecture precedes implementation. Domain behavior belongs in typed
services, features, engines, or domain helpers. Route handlers validate and
serialize; UI presents and invokes contracts. Approved boundaries are defined
in [`ARCHITECTURE_BLUEPRINT.md`](ARCHITECTURE_BLUEPRINT.md).

## Article III: Sources of truth

- SQL migrations are the intended schema history.
- Explicit typed contracts and DTO mappers define public API shapes.
- Domain services/engines own business calculations and lifecycle rules.
- `tests/e2e/routes.ts` owns the safe browser route manifest.
- This directory owns project governance; `AGENTS.md` is binding.

Conflicts must be resolved explicitly, never by duplicating rules.

## Article IV: Safety and truthfulness

Never invent configuration, schema, relationships, or API contracts. Never turn
unexpected write failures into success. Preserve sanitized observability. Never
expose secrets or perform irreversible verification writes.

## Article V: Delivery

Use strict TypeScript, preserve public contracts, keep PRs small, test in
proportion to risk, and complete the applicable release gates in
[`MERGE_POLICY.md`](MERGE_POLICY.md). One Story maps to one PR and one merge
decision.

## Article VI: Change control

New architectural boundaries require an approved Architecture Story. High-risk
work requires manual approval. Amendments to this constitution must be
documented in [`DECISION_LOG.md`](DECISION_LOG.md) with rationale, impact,
owner/approver, and rollback.
