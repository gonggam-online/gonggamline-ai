# Decision log

Append entries; do not rewrite history. Each Story records applicable
Architecture Decisions, Technical Debt, Known Issues, and Future Work.

## Entry template

### YYYY-MM-DD — Title

- Category: architecture decision / technical debt / known issue / future work
- Story / PR:
- Status: proposed / approved / rejected / superseded / open / resolved
- Owner / approver:
- Context and evidence:
- Decision or issue:
- Consequences and risks:
- Follow-up / due condition:
- Rollback or supersession:

## 2026-07-26 — Repository project operating system

- Category: architecture decision
- Story / PR: Project Bootstrap v1.0 / pending
- Status: approved by task directive; delivery pending
- Owner / approver: AI CTO directive supplied by repository owner
- Context and evidence: Future Stories from Epic 4 onward require a permanent,
  architecture-driven boot and compliance process.
- Decision or issue: `README.md` and `.ai/README.md` define the mandatory boot;
  no implementation proceeds without approved architecture. Codex executes as
  Autonomous Engineering Lead and does not assume CTO authority.
- Consequences and risks: Documentation-only, normal-risk. The stricter existing
  initial-bootstrap manual-merge exception remains binding.
- Follow-up / due condition: Every future Story uses the Story and Task
  templates and appends applicable decisions, debt, issues, and future work.
- Rollback or supersession: Revert the bootstrap PR or supersede through an
  explicitly approved constitution/architecture decision.

## Open baseline records

### Missing authoritative base Product migration

- Category: known issue
- Status: open
- Context and evidence: The repository migration chain begins after the base
  `products` definition while later code and migrations reference it.
- Follow-up / due condition: Locate authoritative pre-existing SQL and compare
  deployed migration history before any separately approved high-risk change.

### Distributed PostgREST schema coupling

- Category: technical debt
- Status: open
- Context and evidence: Direct queries and broad selections exist across
  routes/services; generated Supabase types are absent.
- Follow-up / due condition: Address through a scoped Architecture Story when
  prioritized; do not perform a broad opportunistic refactor.

### Epic 4-9 architecture sequence

- Category: future work
- Status: open
- Context and evidence: See [`EPIC_ROADMAP.md`](EPIC_ROADMAP.md).
- Follow-up / due condition: Begin each Epic with approved Architecture Stories;
  this bootstrap does not authorize feature implementation.
