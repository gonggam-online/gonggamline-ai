# GonggamLine AI Company

GonggamLine is a typed autonomous commerce operating system built to accelerate
real sales, measurable profit, repeatable operations, and the path to stable
monthly revenue of KRW 100,000,000.

## Mandatory Story boot sequence

This README is the project bootloader. Every Story, including documentation,
maintenance, and incident work, must execute this sequence before implementation:

```text
BOOT
  -> Read README.md
  -> Read .ai/README.md
  -> Read .ai/CTO_MASTER_DIRECTIVE.md
  -> Read .ai/PROJECT_CONSTITUTION.md
  -> Read .ai/ARCHITECTURE_BLUEPRINT.md
  -> Read .ai/ENGINEERING_MANUAL.md
  -> AI CTO Compliance Check
  -> Architecture Compliance Check
  -> Risk Classification
  -> Implementation (only when every preceding gate passes)
```

The permanent rule is:

> **NO IMPLEMENTATION WITHOUT APPROVED ARCHITECTURE**

If a Story introduces a new Domain, Database, Migration, Queue, Lifecycle,
Public API, or External Integration, implementation must stop until a separate
Architecture Story is completed and approved. See
[Architecture Review](.ai/ARCHITECTURE_REVIEW.md).

Codex is the Autonomous Engineering Lead executing AI CTO directives. Codex is
not an independent CTO: it never makes business decisions, changes product
priorities, or overrides architecture policy.

## Project operating system

Every required governing document is indexed below:

- [Operating-system bootloader](.ai/README.md)
- [CTO master directive](.ai/CTO_MASTER_DIRECTIVE.md)
- [Project constitution](.ai/PROJECT_CONSTITUTION.md)
- [Architecture blueprint](.ai/ARCHITECTURE_BLUEPRINT.md)
- [Engineering manual](.ai/ENGINEERING_MANUAL.md)
- [Autonomous development](.ai/AUTONOMOUS_DEVELOPMENT.md)
- [Merge policy](.ai/MERGE_POLICY.md)
- [Risk policy](.ai/RISK_POLICY.md)
- [Domain guidelines](.ai/DOMAIN_GUIDELINES.md)
- [API policy](.ai/API_POLICY.md)
- [DTO policy](.ai/DTO_POLICY.md)
- [Queue policy](.ai/QUEUE_POLICY.md)
- [Database policy](.ai/DATABASE_POLICY.md)
- [Epic roadmap](.ai/EPIC_ROADMAP.md)
- [Sprint policy](.ai/SPRINT_POLICY.md)
- [Story template](.ai/STORY_TEMPLATE.md)
- [Task template](.ai/TASK_TEMPLATE.md)
- [Architecture review](.ai/ARCHITECTURE_REVIEW.md)
- [Decision log](.ai/DECISION_LOG.md)

## Development commands

Requires Node.js 22 or newer; CI uses Node.js 24.

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e:local
```

Repository implementation and operational references remain available in
[Architecture](ARCHITECTURE.md), [Project Map](PROJECT_MAP.md),
[Development Guide](DEVELOPMENT_GUIDE.md), [Database Guide](DATABASE_GUIDE.md),
[Testing Guide](TESTING_GUIDE.md), and [Operations Guide](OPERATIONS_GUIDE.md).
