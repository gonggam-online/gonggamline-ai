# GonggamLine AI project operating system

Read this file before every Story and before implementation. `README.md` is the
repository bootloader; this directory is the permanent governance source.

## Required boot order

1. Read [`../README.md`](../README.md).
2. Read [`CTO_MASTER_DIRECTIVE.md`](CTO_MASTER_DIRECTIVE.md).
3. Read [`PROJECT_CONSTITUTION.md`](PROJECT_CONSTITUTION.md).
4. Read [`ARCHITECTURE_BLUEPRINT.md`](ARCHITECTURE_BLUEPRINT.md).
5. Read [`ENGINEERING_MANUAL.md`](ENGINEERING_MANUAL.md).
6. Perform the AI CTO Compliance Check defined below.
7. Perform [`ARCHITECTURE_REVIEW.md`](ARCHITECTURE_REVIEW.md).
8. Classify the whole change with [`RISK_POLICY.md`](RISK_POLICY.md).
9. Implement only if every gate passes.

## AI CTO Compliance Check

Before implementation, record evidence that the Story:

- follows [`CTO_MASTER_DIRECTIVE.md`](CTO_MASTER_DIRECTIVE.md);
- preserves the approved boundaries in
  [`ARCHITECTURE_BLUEPRINT.md`](ARCHITECTURE_BLUEPRINT.md);
- satisfies [`PROJECT_CONSTITUTION.md`](PROJECT_CONSTITUTION.md); and
- has a deterministic classification under [`RISK_POLICY.md`](RISK_POLICY.md).

Any failed or unknown item stops implementation. If the Story introduces a new
Domain, Database, Migration, Queue, Lifecycle, Public API, or External
Integration, it requires a completed and approved Architecture Story first.

## Permanent document index

| Document | Purpose |
|---|---|
| [`CTO_MASTER_DIRECTIVE.md`](CTO_MASTER_DIRECTIVE.md) | Binding AI CTO directives and authority boundaries |
| [`PROJECT_CONSTITUTION.md`](PROJECT_CONSTITUTION.md) | Non-negotiable engineering principles |
| [`ARCHITECTURE_BLUEPRINT.md`](ARCHITECTURE_BLUEPRINT.md) | Approved system boundaries and flows |
| [`ENGINEERING_MANUAL.md`](ENGINEERING_MANUAL.md) | Structure, branches, tests, releases, and Definition of Done |
| [`AUTONOMOUS_DEVELOPMENT.md`](AUTONOMOUS_DEVELOPMENT.md) | Codex Story execution loop |
| [`CODEX_OPERATING_STANDARD.md`](CODEX_OPERATING_STANDARD.md) | Cross-PC branch, delivery, Korean progress, approval, and notification standard |
| [`MERGE_POLICY.md`](MERGE_POLICY.md) | PR, gate, merge, and rollback controls |
| [`RISK_POLICY.md`](RISK_POLICY.md) | Normal/high-risk classification |
| [`DOMAIN_GUIDELINES.md`](DOMAIN_GUIDELINES.md) | Domain ownership and dependency rules |
| [`API_POLICY.md`](API_POLICY.md) | Public HTTP contract rules |
| [`DTO_POLICY.md`](DTO_POLICY.md) | DTO mapping and stability rules |
| [`QUEUE_POLICY.md`](QUEUE_POLICY.md) | Runtime Queue lifecycle and safety |
| [`DATABASE_POLICY.md`](DATABASE_POLICY.md) | Schema, migrations, RLS, and query evidence |
| [`EPIC_ROADMAP.md`](EPIC_ROADMAP.md) | Architecture-only Epic 4-9 sequence |
| [`SPRINT_POLICY.md`](SPRINT_POLICY.md) | Sprint admission and completion |
| [`STORY_TEMPLATE.md`](STORY_TEMPLATE.md) | Story definition and compliance record |
| [`TASK_TEMPLATE.md`](TASK_TEMPLATE.md) | Executable task checklist |
| [`ARCHITECTURE_REVIEW.md`](ARCHITECTURE_REVIEW.md) | Architecture gate and Architecture Story requirements |
| [`DECISION_LOG.md`](DECISION_LOG.md) | Architecture decisions, debt, issues, and future work |

## Existing supporting controls

The governing documents above retain and link these established controls:
[`business-priority.md`](business-priority.md),
[`current-sprint.md`](current-sprint.md),
[`architecture.md`](architecture.md),
[`risk-classification.md`](risk-classification.md),
[`development-protocol.md`](development-protocol.md),
[`delivery-protocol.md`](delivery-protocol.md),
[`browser-validation.md`](browser-validation.md),
[`revenue-roadmap.md`](revenue-roadmap.md), and
[`morning-report-template.md`](morning-report-template.md).

`AGENTS.md` remains binding. When policies conflict, apply the stricter safety
or approval requirement and record the conflict in
[`DECISION_LOG.md`](DECISION_LOG.md).
