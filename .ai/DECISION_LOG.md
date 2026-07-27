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

## 2026-07-27 — Domeggook Read-only Supplier Catalog Adapter v1

- Category: architecture decision
- Story / PR: Domeggook Read-only Supplier Catalog Adapter v1 / pending
- Status: approved by task directive; delivery pending
- Owner / approver: AI CTO directive supplied by repository owner
- Context and evidence: Existing Domeggook routes load credentials and call the
  provider directly; the search route also performs financial calculations and
  Product persistence. Production readiness audit could not distinguish
  configuration, authentication, and provider failure.
- Decision or issue: Introduce a read-only Domeggook Supplier Catalog Adapter
  under Supplier/Procurement with provider DTO/domain separation, `getItem` and
  bounded `searchItems`, a sanitized error taxonomy, 10-second overall budget,
  bounded retry, conservative rate controls, and an explicit safe health
  contract. The adapter is DB-independent and Queue-free.
- Consequences and risks: A new External Integration boundary and health Public
  API are approved only for the bounded later implementation Story. Existing
  Product/Revenue contracts remain behavior-equivalent. Official provider quota
  is unknown and must not be invented.
- Follow-up / due condition: Execute only
  [Implement Domeggook Read-only Supplier Catalog Adapter v1](../docs/architecture/DOMEGGOOK-READONLY-SUPPLIER-CATALOG-ADAPTER-V1.md#17-implementation-story-definition)
  after this Architecture Story is merged. Any DB, Migration, Queue, bulk
  collection, scheduler, supplier order, or Product write requires separate
  authorization.
- Rollback or supersession: Revert the Architecture Story PR or supersede it
  with an explicitly approved decision before implementation diverges.


## 2026-07-27 — Domeggook Read-only Supplier Catalog Adapter v1 implementation

- Category: architecture decision
- Story / PR: Implement Domeggook Read-only Supplier Catalog Adapter v1 /
  pending
- Status: implemented; delivery pending
- Owner / approver: AI CTO directive supplied by repository owner
- Context and evidence: The approved Architecture Story authorizes one bounded,
  synchronous, read-only Supplier Catalog adapter and sanitized health API.
- Decision or issue: Implement the provider-neutral port, provider DTO/parser,
  mapper, application service, bounded Domeggook client, safe health service,
  and default network-free health route. Preserve the existing Domeggook
  search/test routes rather than silently changing their contracts.
- Consequences and risks: The new adapter can safely read one item or one
  bounded result page. Provider verification is explicit, size-one, coalesced,
  and cached for 60 seconds. Official provider quota remains unknown, so v1
  retains conservative ceilings.
- Follow-up / due condition: Use this adapter only through a separately scoped
  application Story. Any Product persistence, Revenue use, bulk collection,
  scheduler, Queue, database cache, Migration, or supplier write needs separate
  architecture approval.
- Rollback or supersession: Revert the implementation PR. No data, schema,
  Queue, credential, or provider rollback is required.

## 2026-07-27 — Domeggook Live Search v1

- Category: architecture decision
- Story / PR: Domeggook Live Search v1 / pending
- Status: approved by task directive; delivery pending
- Owner / approver: Supplier / Procurement; repository-owner directive
- Context and evidence: The new adapter is read-only, but the legacy search
  route bypasses it and combines provider access, financial decisions, and
  Supabase persistence.
- Decision or issue: Add a separate bounded GET endpoint and standalone UI that
  use `SupplierCatalogService`, return a dedicated public DTO, and contain no
  database or commerce write path.
- Consequences and risks: The legacy route remains unchanged. AI evaluation,
  margin, recommendation, persistence, bulk collection, and scheduling remain
  outside this authorization.
- Follow-up / due condition: Implement contract/no-write tests, the thin route,
  and the standalone UI on a separately delivered branch.
- Rollback or supersession: Revert the additive route/UI PR. No data rollback is
  needed.

## 2026-07-27 — Sprint B-0 Database Baseline Execution v1

- Category: architecture decision
- Story / PR: Sprint B-0 Database Baseline Execution v1 / pending
- Status: proposed; repository-owner manual approval required
- Owner / approver: Database / Security; repository owner
- Context and evidence: Sprint A proved the deployed schema, but the official
  chain begins at migration 003. Migrations 005–020 create permissive policies
  after a hypothetical pre-003 security baseline.
- Decision or issue: Promote recovered schema sources as dependency-ordered
  pre-003 migrations, keep 003–020 unchanged, and establish the final
  least-privilege state in a post-020 security migration. Rehearse only through
  an official Supabase workflow in a disposable environment.
- Consequences and risks: High-risk schema/security work. Concrete identity and
  ownership rules must be approved before the RLS migration is generated.
  Production replay and manual migration-metadata edits are forbidden.
- Follow-up / due condition: Manual Story approval, then a separately delivered
  implementation PR with replay and RLS evidence.
- Rollback or supersession: Revert the implementation PR and destroy the
  disposable database. Production is not changed.
