# Sprint policy

## Admission

A Sprint may admit a Story only when its business objective, revenue impact,
owner priority, dependencies, acceptance criteria, scope/non-goals,
architecture compliance, and risk are explicit. Architectural boundary changes
must already have an approved Architecture Story.

## Execution

- Use small ordered Stories; one Story -> one PR -> one merge decision.
- Maintain `.codex/WORK_STATUS.md` after major steps and before stopping.
- Preserve current functionality and public contracts.
- Continue independent safe work when one item is blocked.
- Do not add unapproved Product scope to satisfy a schedule.

## Completion

A Sprint is complete only when admitted Stories satisfy their Definition of
Done, delivery evidence is recorded, known debt/issues/future work are appended
to [`DECISION_LOG.md`](DECISION_LOG.md), and Production is verified for merged
work. Unmerged, blocked, or unverified work remains incomplete.
