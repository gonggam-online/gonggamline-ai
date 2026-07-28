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


## 2026-07-27 — Item Selection Evaluation v1

- Category: architecture decision
- Story / PR: Item Selection Evaluation v1 / pending
- Status: approved by repository-owner task directive; delivery pending
- Owner / approver: Supplier / Procurement with Revenue financial ownership;
  repository-owner directive
- Context and evidence: PR #33 approved and PR #34 implemented bounded
  read-only Domeggook Live Search. The normalized Supplier Catalog has no
  evidence for resale, IP, image-use/editing, or tax-invoice gates. Existing
  Revenue calculation is reusable, while administrator auth/RLS and the
  authoritative fresh-replay database baseline remain unresolved.
- Decision or issue: Introduce a separate Item Selection application use case
  and immutable ruleset `gonggamline-item-selection-v1`. Missing evidence is
  `UNKNOWN`; any required unknown or incomplete profitability caps the verdict
  at `MANUAL_REVIEW`. Use explicit available-data score and coverage, preserve
  historical snapshots, and allow writes only through the new application
  repository after auth/database prerequisites.
- Consequences and risks: Live Search stays no-write. This documentation-only
  Story is normal-risk, but financial semantics, auth/RLS, migrations, and
  Production delivery remain separate high-risk/manual Stories. Real provider
  candidates will commonly require manual review until verified evidence and
  owner-approved cost/profit thresholds exist.
- Follow-up / due condition: Implement the six ordered Stories in
  [Item Selection Evaluation v1](../docs/architecture/ITEM-SELECTION-EVALUATION-V1.md#14-implementation-stories),
  beginning with the pure evaluator. Do not implement persistence/API before
  Database Baseline and Auth Architecture approval.
- Rollback or supersession: Revert this Architecture Story PR or supersede it
  with an explicitly approved versioned decision. Stored historical ruleset
  versions, once implemented, remain immutable.


## 2026-07-27 — Item Selection pure evaluator v1 implementation

- Category: architecture decision
- Story / PR: Item Selection Evaluation Story 1 / pending
- Status: implemented; delivery pending
- Owner / approver: Supplier / Procurement; implementation authorized by the
  merged Item Selection Evaluation v1 Architecture Story
- Context and evidence: The approved first Story requires typed snapshots,
  five hard gates, six score areas, explicit coverage, verdict precedence,
  deterministic explanations/sorting, and no provider/Revenue/DB/API/UI
  integration.
- Decision or issue: Implement `gonggamline-item-selection-v1` as a pure
  Supplier/Procurement domain policy. It consumes normalized score and
  profitability-readiness inputs but never calculates money. Missing score
  areas cannot create `totalScore`; `FAIL` precedes `UNKNOWN`; unapproved
  profitability minimums remain `MANUAL_REVIEW`; invalid or duplicate gate
  contracts fail explicitly.
- Consequences and risks: Later adapters have a strict target contract and
  cannot silently convert absent evidence to pass or neutral scores. This
  normal-risk Story changes no external, persistence, auth, financial, or
  commerce-write boundary.
- Follow-up / due condition: Deliver and merge this Story after all gates.
  Story 2 may then add verified provider facts and the separately approved
  high-risk Revenue adapter without changing v1 policy semantics.
- Rollback or supersession: Revert the Story 1 PR. Any semantic policy change
  requires a new ruleset version; do not mutate historical v1 semantics.


## 2026-07-28 — Item Selection profitability policy v1 implementation

- Category: architecture decision
- Story / PR: Item Selection Evaluation Story 2 / #37
- Status: implemented; Draft PR validation passed
- Owner / approver: Revenue with Supplier / Procurement consumption;
  repository-owner Architecture directive
- Context and evidence: Story 1 is merged. The owner approved versioned fee,
  fulfillment, advertising, return-loss, VAT, precision, and contribution
  thresholds while retaining the existing separate Stories 2–6 boundaries.
- Decision or issue: Revenue owns immutable policy
  `gonggamline-profitability-2026-07-27-v1`. It computes base, stress,
  current-effective, and normalized scenarios from explicit trusted facts.
  Item Selection consumes the normalized/stress threshold result. Any required
  estimated or missing cost caps the verdict at `MANUAL_REVIEW`; hard-gate
  `FAIL` and `UNKNOWN` retain precedence.
- Consequences and risks: Candidate screening can no longer use promotion
  economics or rounded display values to bypass normalized/stress thresholds.
  This is high-risk/manual financial code. The policy deliberately excludes
  monthly fixed overhead from per-unit contribution.
- Follow-up / due condition: approve Database Baseline and Admin
  identity/authorization/RLS/CSRF Architecture PRs before Stories 3–4.
  Persistence, API, and UI remain separate Stories.
- Rollback or supersession: revert the Story 2 commit. A future policy must use
  a new version; historical v1 inputs/results must remain reproducible once
  persistence is approved.


## 2026-07-28 — Item Selection Database Baseline Architecture v1

- Category: architecture decision
- Story / PR: Item Selection Database Baseline Architecture v1 / PR #38
- Status: Accepted
- Owner / approver: Database / Security; repository owner
- Approval date: 2026-07-28
- Approved head SHA: `8b1e6ab589491e77dfa7ac5d71c99b40db03030a`
- Context and evidence: Item Selection Stories 1–2 are merged, but durable
  evaluation history is blocked by the pre-003 database baseline gap and the
  absence of accepted admin identity/RLS contracts.
- Decision or issue: Accept Supabase Postgres as the existing Vercel-compatible
  database, with append-only canonical UTF-8 evaluation/evidence text,
  database-generated SHA-256 hashes, round-trip decimal decision values,
  non-authoritative micro-won/ppm and JSONB query projections, and
  transactional idempotent run finalization. Profitability calculation
  implementation is versioned independently from policy; retries create linked
  runs but retry lineage is excluded from candidate decision identity and
  hashes; database time is returned only as post-commit persistence metadata.
- Consequences and risks: This is documentation only and authorizes no schema
  or Production action. Later migration/RLS/Production work is high-risk,
  manual, and depends on accepted Sprint B-0 and Admin Architecture.
- Follow-up / due condition: Draft and accept the separate Admin Identity /
  Authorization / RLS / CSRF Architecture, then separately approve Sprint B-0.
  Do not begin Story 3 until both prerequisites are accepted.
- Rollback or supersession: Revert the documentation PR or replace it with an
  explicitly accepted version. No runtime or data rollback is required.

## 2026-07-28 — Admin Identity, Authorization, RLS, and CSRF Architecture v1

- Category: architecture decision
- Story / PR: Admin Identity, Authorization, RLS, and CSRF Architecture v1 / PR #39
- Status: proposed; repository-owner manual approval required
- Owner / approver: Database / Security and Application Security; repository owner
- Root cause: the prior documentation-first enterprise control plane could not be proven without implementation. Each attempt to make its ledgers complete added new roles, functions, states, locks, and provider assumptions, so independent review kept finding new platform or execution conflicts.
- Decision: supersede that design with the smallest v1 boundary: manual Supabase Dashboard provisioning/disablement; server-only `GONGGAMLINE_ADMIN_USER_IDS`; `getUser()` on every protected Route Handler request; AAL2 protected mutations; exact-origin JSON CSRF; default-deny protected Data API access; one operationally contained service-role module; and transactional application audit.
- Explicit removals: custom Auth Hook, invitation automation/reconciliation, database admin-lifecycle state machines, direct `auth.sessions` access, automatic MFA/break-glass/soft-delete, per-function owner-role proliferation, and telemetry lease/freeze/recovery.
- Evidence rule: exact SDK, SQL, grant, lock, and rollback behavior is accepted from disposable implementation tests, not from an expanding hypothetical contract ledger.
- Repository-owner session decision: v1 does not require immediate revocation of a logged-out access JWT. Sign-out must prevent refresh; an issued access JWT can remain valid until its configured 15-minute expiry, while protected mutations also require AAL2 freshness of no more than 60 seconds. `getUser()` validates the access JWT and user against the Auth server but does not prove refresh-session existence. V1 therefore accepts a maximum 15-minute protected-read boundary and a maximum 60-second AAL2 mutation-freshness boundary. Direct `auth.sessions` validation and a more complex immediate-revocation lifecycle remain excluded; a shorter token lifetime or separate revocation mechanism requires a follow-up Security Story.
- Consequences and risks: service-role retains full data access/BYPASSRLS and access JWTs are not instantly revoked. Server-only containment, bounded token and mutation freshness, Auth-server JWT/user validation, no direct protected Data API grants, environment isolation, and negative tests bound those risks.
- Follow-up / due condition: independent review of the reduced exact head, explicit repository-owner acceptance, then one separate high-risk vertical-slice implementation PR. Enterprise lifecycle automation and external telemetry are follow-up work only when an operating need exists.
- Rollback or supersession: revert or supersede this documentation PR. No runtime or data rollback is required.
