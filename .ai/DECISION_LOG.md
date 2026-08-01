# Decision log

## 2026-08-01 — R3 rehearsal evidence validator and transport stop

- Category: implementation decision under merged R3 Architecture Story PR #65.
- Decision: implement the deterministic two-cycle evidence validator now, but
  do not implement or execute a repair adapter until an approved transport can
  connect the pinned official CLI to the quarantined restore without exposing
  a database URL or weakening network isolation.
- Evidence: the approved target has Docker network mode `none` and no published
  ports. An external Supabase CLI cannot reach it; direct migration-history SQL
  remains permanently prohibited.
- Impact: manifest, quarantine, exact history, catalog/Product invariance,
  dry-run, replay, sanitization, and negative gates become executable contracts.
- Rollback: revert the validator, tests, runbook, and changelog. No database or
  migration-history state is changed by this decision.


## 2026-08-01 — R3 rehearsal evidence validator and transport stop

- Category: implementation decision under merged R3 Architecture Story PR #65.
- Decision: implement the deterministic two-cycle evidence validator now, but
  do not implement or execute a repair adapter until an approved transport can
  connect the pinned official CLI to the quarantined restore without exposing
  a database URL or weakening network isolation.
- Evidence: the approved target has Docker network mode `none` and no published
  ports. An external Supabase CLI cannot reach it; direct migration-history SQL
  remains permanently prohibited.
- Impact: manifest, quarantine, exact history, catalog/Product invariance,
  dry-run, replay, sanitization, and negative gates become executable contracts.
- Rollback: revert the validator, tests, runbook, and changelog. No database or
  migration-history state is changed by this decision.


## 2026-08-01 — Revenue-speed, cloud-portable autonomous delivery

- Category: accepted governance amendment directed by the repository owner.
- Decision: make the shortest safe path to measurable revenue the first
  planning gate; prefer approved cloud sources of truth and minimum ephemeral
  local storage; continue authorized normal-risk delivery autonomously through
  feedback and the next safe action.
- Rationale: prevent prolonged system-building without sales, allow operations
  and Codex work to resume from any authorized PC, and reduce routine owner
  handoffs.
- Safety boundary: cloud-first does not permit uploading secrets or sensitive
  Production/business data to unapproved services. Autonomy does not weaken
  Production, database, RLS/Auth, secrets/configuration, commerce, paid,
  destructive, or high-risk manual-merge approvals.
- Impact: Story admission and WORK_STATUS records must identify the earliest
  blocked revenue step, measurable proof, remote source of truth, local-only
  artifacts and cleanup, and the next autonomous action.
- Rollback: revert this governance Story. Existing stricter safety and approval
  controls remain independently binding.


## 2026-08-01 — Revenue-speed, cloud-portable autonomous delivery

- Category: accepted governance amendment directed by the repository owner.
- Decision: make the shortest safe path to measurable revenue the first
  planning gate; prefer approved cloud sources of truth and minimum ephemeral
  local storage; continue authorized normal-risk delivery autonomously through
  feedback and the next safe action.
- Rationale: prevent prolonged system-building without sales, allow operations
  and Codex work to resume from any authorized PC, and reduce routine owner
  handoffs.
- Safety boundary: cloud-first does not permit uploading secrets or sensitive
  Production/business data to unapproved services. Autonomy does not weaken
  Production, database, RLS/Auth, secrets/configuration, commerce, paid,
  destructive, or high-risk manual-merge approvals.
- Impact: Story admission and WORK_STATUS records must identify the earliest
  blocked revenue step, measurable proof, remote source of truth, local-only
  artifacts and cleanup, and the next autonomous action.
- Rollback: revert this governance Story. Existing stricter safety and approval
  controls remain independently binding.


## 2026-08-01 — R3 Migration History Reconciliation v1

- Category: proposed architecture decision.
- Story / PR: R3 Migration History Reconciliation v1 / pending.
- Status: proposed; manual repository-owner acceptance required.
- Owner / approver: Database / Security; repository owner pending.
- Context and evidence: the current Production logical archive and isolated
  restore have no `supabase_migrations.schema_migrations`, while the 000-020
  schema groups and the named 021/022 relations/functions are present. The R2
  inventory requires exact 000-022 history, exposing a circular dependency in
  the earlier R2-before-R3 ordering.
- Decision or issue: separate history metadata from schema state. First
  rehearse official CLI repair for exactly 000-022 on a fresh isolated restore,
  prove catalog equality and a no-historical-DDL dry run, then allow R2 to
  derive and rehearse 023. Production later repairs 000-022 immediately before
  an exact dry run that must list only approved 023.
- Consequences and risks: object presence is not exact migration proof; 021/022
  remain execution-gated. The logical restore omits global role definitions and
  synthesized one local `NOLOGIN` owner. History repair, candidate 023, RLS,
  Production, and merge remain unauthorized.
- Rollback or supersession: revert this documentation PR. Later metadata-only
  rollback may use only official CLI `--status reverted` for the exact approved
  versions before any schema migration begins; never write history directly or
  restore anonymous writes.

## 2026-07-31 - R2 Product security target proposed

- Category: proposed high-risk Database / RLS Architecture Story.
- Dependency: accepted R1 Atomic Product Mutation DB v1 and merged R1 runtime.
- Decision proposal: retain intentional anonymous Product `SELECT`, remove all anonymous/authenticated Product writes, preserve only explicit guarded service-role reads and exact R1 RPC execution, and set owner-scoped default deny for future public-schema objects.
- Rehearsal: derive candidate forward migration SQL only from an isolated, quarantined, owner-approved restore inventory; prove negative roles, R1 atomicity/idempotency/audit, public read, and default ACLs before any later Production proposal.
- Risk and authority: documentation only in this Story. Manual merge is required. Migration SQL, restore, configuration, Auth, Production, and commerce writes remain unauthorized.
- Rollback: revert the documentation commit. No external or database state is changed.

## 2026-07-31 — Admin recovery OTP length reconciliation

- Production evidence: the newest code-only recovery email delivered an
  eight-digit numeric OTP, while the UI and verification route required
  exactly six digits and the browser rejected the request before submission.
- Root cause: Auth contract drift between the configured Production Supabase
  project and the hard-coded application recovery-token length.
- Decision: require exactly eight numeric digits at both the administrator UI
  and verification route. Keep authenticator TOTP at its independent
  six-digit contract.
- Risk and delivery: high-risk/manual Auth correction with focused contract and
  browser coverage, Draft PR, exact gates, manual merge, and one new
  Production recovery attempt after deployment.
- Rollback: revert this correction together with any provider-side OTP length
  change; UI and server validation must always remain identical.

## 2026-07-31 — Admin Password Recovery prefetch mitigation

- Production evidence: a newly issued recovery message reached Gmail, but its
  single-use confirmation URL reached the application only after Supabase had
  marked it `otp_expired`.
- Root cause: external email link prefetch consumed the default
  `ConfirmationURL`; repeated email requests cannot reliably repair this.
- Owner approval: the repository owner explicitly approved high-risk/manual
  implementation and the Production Supabase email-template change on
  2026-07-31.
- Decision: preserve the existing recovery lifecycle but replace the
  clickable email confirmation step with manual `{{ .Token }}` entry and
  server-side `verifyOtp({ type: "recovery" })`.
- Security: never put the OTP in a URL, cookie, response, or log; retain exact
  origin, rate limits, Auth-server verification, UUID allowlist, recovery
  grant, CSRF, global sign-out, fresh login, and TOTP/AAL2.
- Risk and delivery: high-risk/manual; Draft PR, exact gates, manual merge,
  separately executed Production template change, and owner-performed password
  update remain mandatory.

## 2026-07-31 — Admin Password Recovery v1 implementation

- Architecture approval: PR #59 was manually merged by the repository owner at
  merge commit `c22635befa44929d3b3ae0cf35ab68e14b8f5d9a`.
- Decision: implement only the approved same-browser PKCE recovery lifecycle
  inside the existing Admin Auth boundary.
- Security: keep UUID allowlisting, Auth-server user verification,
  exact-origin JSON, recovery-purpose CSRF, sanitized failures, global
  sign-out, and fresh login plus TOTP.
- Exclusions: no Auth Admin API, MFA reset, database/RLS, new secret, implicit
  fragment parsing, or commerce write.
- Risk: high-risk/manual. The implementation PR must retain
  `manual-merge-required`; Production redirect configuration and password
  rotation require separate owner actions.

## 2026-07-31 — Admin Password Recovery v1 proposal

- Status: proposed; not yet architecture-approved.
- Incident evidence: the Production recovery email completed provider
  verification but returned to a page with no password-update capability.
  Session-bearing URL material was exposed and must be revoked.
- Proposal: add a same-browser PKCE recovery lifecycle inside the existing
  Admin Auth boundary, preserving UUID allowlist, exact-origin JSON, CSRF,
  sanitized errors, global sign-out, and fresh TOTP requirements.
- Approval boundary: documentation only. No recovery route, password update,
  redirect configuration, Production action, or Auth Admin API is authorized
  until the architecture PR is manually approved and merged.
- Story:
  [`ADMIN-PASSWORD-RECOVERY-V1.md`](../docs/architecture/ADMIN-PASSWORD-RECOVERY-V1.md).
## 2026-07-31 — Admin TOTP SDK QR contract compatibility

- Context: the first owner-approved Production enrollment returned the
  sanitized `MFA enrollment failed.` result although Production TOTP was
  enabled. The subsequent status check showed no remaining factor.
- Evidence: pinned `@supabase/auth-js` 2.110.7 prepends
  `data:image/svg+xml;utf-8,` to the Auth server SVG. The merged boundary
  accepted only raw `<svg`.
- Decision: accept the pinned SDK's exact SVG data-URL prefix unchanged, retain
  raw-SVG compatibility for older direct contracts, and reject every other QR
  format. Preserve one-time/no-store handling and sanitized provider errors.
- Risk / approval: high-risk/manual because this restores real Production Auth
  enrollment. No auto-merge. Production enrollment remains paused until exact
  gates, owner merge, deployment, and password rotation.
- Rollback: revert the compatibility commit. Existing Auth factors and
  Production configuration are unchanged by the code delivery.
## 2026-07-31 — R1 Atomic Product Mutation implementation authorization

- Category: high-risk implementation authorization
- Story: R1 Atomic Product Mutation implementation
- Status: explicitly approved by repository owner on 2026-07-31
- Approved architecture: `docs/architecture/R1-ATOMIC-PRODUCT-MUTATION-DB-V1.md`
  at accepted head `cedf3025edbd65c05b36c673991ad4388dce0a8e`.
- Authorization: additive forward-only migration, protected Product mutation
  boundary, idempotency/audit, Auth/CSRF/service-role isolation, tests, push,
  and Draft PR.
- Exclusions: Production application and PR merge.
- Risk and merge: high-risk/manual; apply `manual-merge-required`, never
  auto-merge.
- Rollback: disable affected commands and forward-fix additively; preserve
  Product, request, and audit evidence. Never edit an applied migration or
  restore unconditional anonymous writes.

Append entries; do not rewrite history. Each Story records applicable
Architecture Decisions, Technical Debt, Known Issues, and Future Work.

## 2026-07-31 — R1 Atomic Product Mutation DB Architecture v1

- Category: accepted architecture decision
- Story / PR: R1 Atomic Product Mutation DB Architecture v1 / PR #54
- Status: accepted through repository-owner manual merge on 2026-07-31
- Approved head SHA:
  `cedf3025edbd65c05b36c673991ad4388dce0a8e`
- Owner / approver: Product and Database / Security; repository owner
- Context: five Product mutation surfaces use anonymous Supabase writes, while
  no Product RPC atomically combines mutation, idempotency, and audit.
- Decision: later add operation-specific Product mutation RPCs and a
  separate idempotency relation. Each transaction validates, claims/replays,
  mutates allowlisted fields, inserts one success audit, completes idempotency,
  and returns a versioned result.
- Consequences: later implementation is high-risk/manual and requires isolated
  service role, Admin AAL2/CSRF, concurrency/negative-role tests, disposable
  replay, and R1-before-R2 ordering. Batch persistence is item-atomic.
- Authorization: architecture only; no implementation, migration, runtime,
  Production, RLS, environment, real-data, or external-commerce write is
  authorized by this acceptance.
- Rollback: later implementation rollback preserves
  Product/key/audit evidence, uses forward fixes, and cannot restore anonymous
  writes.
- Follow-up: separately approve the exact implementation Story and migration.

## 2026-07-30 — Production Schema Security Reconciliation v1

- Category: architecture decision
- Story / PR: Production Schema Security Reconciliation v1 / pending
- Status: accepted for architecture and discovery; implementation phases
  remain high-risk/manual
- Owner / approver: Database / Security; repository owner
- Context and evidence: Production has all 57 tables expected from migrations
  000-020 but no Supabase migration history. Migration 021 is absent. A
  verified logical backup and an official schema diff show nine
  Production-only permissive policies, seven RLS-state differences, and broad
  grant/default-privilege drift. Migrations 005-020 also retain development
  `FOR ALL` policies.
- Decision or issue: Production drift must not be copied into intended schema,
  and permissive policies must not be removed until active anonymous-client
  dependencies are replaced or explicitly approved. Define a complete access
  matrix, migrate application access first, then deliver one forward-only
  reconciliation migration after 021. Keep migrations 000-021 immutable.
- Consequences and risks: History repair and migration 021 remain blocked.
  Product routes currently depend on anonymous Supabase access; premature
  restriction can interrupt revenue operations. Dormant Commerce OS tables
  remain exposed by legacy policies until the ordered high-risk remediation.
- Follow-up / due condition: complete R0 access inventory and obtain exact
  target-state approval; then deliver R1 application access, R2 database
  reconciliation, and R3 Production rollout as separate reviewable changes.
- Rollback or supersession: revert the documentation PR. Later rollback must
  disable the affected feature or restore from a verified backup and must not
  reintroduce unconditional anonymous writes.

## 2026-07-30 — Engineering Orchestrator Phase 4 delivery boundary

- Decision: extend the accepted lifecycle through verified commit, exact-head
  task-branch push, duplicate-free Draft PR, exact CI/Preview/browser evidence,
  and `WAITING_FOR_HUMAN`.
- Business reason: remove repeated delivery coordination before protected Item
  Selection work supporting reproducible profitable-product screening.
- Boundary: local supervised operator plus GitHub task-branch/Draft-PR writes;
  no Ready transition, merge, Production, Supabase, configuration, secret, or
  commerce write.
- Risk: high-risk automation bootstrap; `manual-merge-required`.
- Evidence: `docs/orchestrator/reports/phase-4-github-preview-delivery.md`.
- Rollback: revert the Phase 4 PR.

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
- Status: Accepted
- Owner / approver: Database / Security and Application Security; repository owner
- Approval date: 2026-07-28
- Approved head SHA: `0d68585400eb6ce279c40e93560fea1d69d94a92`
- Root cause: the prior documentation-first enterprise control plane could not be proven without implementation. Each attempt to make its ledgers complete added new roles, functions, states, locks, and provider assumptions, so independent review kept finding new platform or execution conflicts.
- Decision: supersede that design with the smallest v1 boundary: manual Supabase Dashboard provisioning/disablement; server-only `GONGGAMLINE_ADMIN_USER_IDS`; `getUser()` on every protected Route Handler request; AAL2 protected mutations; exact-origin JSON CSRF; default-deny protected Data API access; one operationally contained service-role module; and transactional application audit.
- Explicit removals: custom Auth Hook, invitation automation/reconciliation, database admin-lifecycle state machines, direct `auth.sessions` access, automatic MFA/break-glass/soft-delete, per-function owner-role proliferation, and telemetry lease/freeze/recovery.
- Evidence rule: exact SDK, SQL, grant, lock, and rollback behavior is accepted from disposable implementation tests, not from an expanding hypothetical contract ledger.
- Repository-owner session decision: v1 does not require immediate revocation of a logged-out access JWT. Sign-out must prevent refresh; an issued access JWT can remain valid until its configured 15-minute expiry, while protected mutations also require AAL2 freshness of no more than 60 seconds. `getUser()` validates the access JWT and user against the Auth server but does not prove refresh-session existence. V1 therefore accepts a maximum 15-minute protected-read boundary and a maximum 60-second AAL2 mutation-freshness boundary. Direct `auth.sessions` validation and a more complex immediate-revocation lifecycle remain excluded; a shorter token lifetime or separate revocation mechanism requires a follow-up Security Story.
- Consequences and risks: service-role retains full data access/BYPASSRLS and access JWTs are not instantly revoked. Server-only containment, bounded token and mutation freshness, Auth-server JWT/user validation, no direct protected Data API grants, environment isolation, and negative tests bound those risks.
- Approval boundary: this acceptance approves the Architecture contract only. PR #39 remains Draft and `manual-merge-required`; no runtime, migration, RLS, Auth configuration, secret, identity, Production, or commerce-write implementation is authorized by this decision alone.
- Follow-up / due condition: prepare the bounded Sprint B-0 implementation work instruction, obtain the separate Sprint B-0 Architecture/implementation approval, then use one high-risk manual implementation PR. Enterprise lifecycle automation and external telemetry are follow-up work only when an operating need exists.
- Rollback or supersession: revert or supersede this documentation PR. No runtime or data rollback is required.

## 2026-07-28 — Revenue-first automation orchestrator

- Category: architecture decision
- Story / PR: Revenue-first Automation Orchestrator Architecture / pending
- Status: proposed; repository-owner acceptance required before implementation
- Owner / approver: repository owner / AI CTO
- Context and evidence: GitHub/CI/Preview delivery controls, Runtime Queue
  reliability patterns, workflow idempotency, Revenue/Item Selection engines,
  and D/N operating rules exist, but no durable controller binds structured
  review, routing, Codex threads, evidence verification, retry, approval, and
  sales-learning outcomes.
- Decision or issue: propose one supervised N-PC controller with a local durable
  ledger, deterministic policy/router, Codex App Server execution interface
  with a `codex exec` first adapter/fallback, GitHub/Preview evidence adapters,
  strict Task/Result JSON Schemas, and human gates for merge, Production,
  database/security, secrets/cost/permissions, and real commerce writes.
- Consequences and risks: the smallest MVP avoids a cloud worker, Supabase
  orchestration schema, and distributed multi-agent platform. The automation
  bootstrap remains high-risk/manual even though this Story is documentation
  only. Autonomy begins in SHADOW and expands only from verified actual
  outcomes.
- Follow-up / due condition: repository-owner review/acceptance, then execute
  only the Phase 0 read-only protocol capability spike in
  `docs/orchestrator/implementation-roadmap.md`. Do not begin implementation
  from this proposed record.
- Rollback or supersession: revert this documentation PR or supersede the
  proposed contracts through a separately reviewed Architecture decision.

## 2026-07-28 — Revenue-first automation orchestrator accepted; Phase 0 authorized

- Category: architecture acceptance and bounded implementation authorization
- Story / PR: Revenue-first Automation Orchestrator Architecture / PR #41
- Status: accepted; Phase 0 read-only protocol capability spike authorized
- Owner / approver: repository owner
- Approved merge SHA: `a6894fce05480d9b599dcb9a03f9100c607b3fe6`
- Decision: accept the Engineering Orchestration boundary and authorize only
  Phase 0 from `docs/orchestrator/implementation-roadmap.md` on dedicated branch
  `codex/chore/orchestrator-protocol-spike` and a separate manual Draft PR.
- Scope: schema/example validation, installed Codex CLI/App Server schema
  capture, structured read-only repository assessment, thread/usage/
  cancellation/redaction evidence, and a measured adapter recommendation.
- Non-goals: product runtime, database/migration/RLS/Auth, CI changes,
  Production, commerce writes, durable ledger/router/controller implementation,
  OAuth, new secrets, paid API enablement, or authority expansion.
- Risk and approval: read-only discovery is normal-risk, but the bootstrap PR
  remains `manual-merge-required`; final merge requires repository-owner
  approval.
- Rollback: close the unmerged Phase 0 PR and remove its documentation/evidence
  commit. No runtime or data rollback is required.

## 2026-07-28 — Orchestrator Phase 1 separately authorized

- Category: bounded implementation authorization
- Dependency: PR #42 merged as
  `75d48dba3da9cb36bdecbd34de5604346379e601`
- Owner / approver: repository owner
- Decision: authorize only Phase 1 local ledger, policy, router, budget, and
  recovery primitives on `codex/feat/orchestrator-phase-1` and a separate
  Draft PR.
- Architecture compliance: Engineering Orchestration owns the lifecycle;
  accepted PR #41 defines the state, contract, identity, SQLite, routing,
  approval, audit, and recovery boundaries. No new Architecture boundary is
  introduced.
- Risk: `manual-merge-required` initial automation implementation; no
  auto-merge.
- Required Phase 0 findings: controller-enforced token budgets, canonical
  ResultContract post-validation, App Server interrupt first, and correlated
  fail-closed Windows process recovery.
- Non-goals: Codex execution, worktree mutation, commit/push/PR automation,
  CI/Preview polling, planner/reviewer, cloud worker, Supabase, Production,
  external commerce write, paid API, secret, or Phase 2+ implementation.
- Rollback: revert the Phase 1 implementation PR. Product runtime and external
  state are unchanged.

## 2026-07-29 — Orchestrator Phase 2 execution vertical slice authorized

- Category: bounded implementation authorization
- Story / PR: Orchestrator Phase 2 execution vertical slice / pending
- Status: approved by repository-owner task directive; delivery pending
- Owner / approver: repository owner
- Context and evidence: PR #43 merged Phase 1 at
  `59d866e0dc67cb1afa16323b3afe696a4e7825cb`; local Supabase/Playwright
  readiness then passed 39/39 with 282/282 repository tests.
- Decision or issue: authorize the shortest safe local execution slice:
  run creation, `READY` task selection, fake Worker dispatch, synchronized
  states, checkpoints, immutable success/failure evidence, idempotency,
  bounded retry with `retryOfRunId`, approval wait, resume, exact worktree
  guard, and local verification.
- Architecture compliance: accepted Engineering Orchestration owns this
  lifecycle. The slice reuses Phase 1 local SQLite and control primitives and
  adds no product Domain, public API, Supabase migration, Auth/RLS/CSRF,
  external integration, Production mutation, or commerce write.
- Consequences and risks: the automation bootstrap remains high-risk/manual and
  receives `manual-merge-required`. Actual Codex transport, authentication,
  cost-bearing execution, GitHub writes, CI/Preview polling, and planner logic
  remain unimplemented and separately gated.
- Follow-up / due condition: deliver one bounded Draft PR with full local and
  exact-head Preview evidence; begin no Phase 3 implementation from this
  authorization.
- Rollback or supersession: revert the Phase 2 PR. Product runtime and external
  systems remain unchanged.

## 2026-07-30 — Orchestrator Phase 3 Codex transport authorized

- Category: bounded implementation authorization
- Dependency: PR #44 merged as
  `52ffa71d4cefb51fe980c19b0b5dff7532d5f685`
- Owner / approver: repository owner
- Decision: connect the Phase 2 controller to the installed Codex App Server
  stdio protocol and add only the isolated local develop/verify/retry slice.
- Architecture compliance: preserve the Worker, verifier, ledger, state,
  budget, timeout, retry, interrupt, and approval contracts; add no product
  Domain or external write authority.
- Risk: high-risk automation bootstrap; `manual-merge-required`, Draft PR, and
  no auto-merge.
- Non-goals: GitHub write automation, CI/Preview reconciliation, Production,
  Supabase, Vercel Production, marketplace actions, browser automation,
  secrets, paid API setup, and Phase 4.
- Known boundary: App Server sandbox requests, minimum environment, and Git
  postconditions are enforced, but this local Windows process is not an
  independently proven firewall or restricted-token sandbox.
- Rollback: revert the Phase 3 PR. No external or database rollback is required.

## 2026-07-30 — Orchestrator Phase 4.1 integration authorized

- Category: bounded integration implementation
- Dependency: PR #47 merged as
  `f134c85b9f8f899065b4a7105b4c592ac7b2d10b`.
- Owner / approver: repository owner
- Decision: connect the supervised operator's verified `COMPLETED` result to
  the merged delivery pipeline, support approved Product implementation
  routing to D, and preserve restart-safe external-write idempotency.
- Risk: high-risk automation integration; Draft PR,
  `manual-merge-required`, and no auto-merge.
- Non-goals: planner/reviewer, Product implementation, Supabase, Production
  mutation, secrets, Ready/merge automation, and commerce writes.
- Rollback: revert the Phase 4.1 PR. Existing Phase 1–4 primitives and Product
  runtime remain unchanged.

## 2026-07-30 — Orchestrator Phase 4.2 Windows verifier fix authorized

- Category: necessary controller defect correction discovered by an approved
  Item Selection TaskContract execution.
- Dependency: PR #48 merged as
  `ab26c231cb069c60dd085bf5b1560f142db58d9a`.
- Decision: preserve the fixed verifier command allowlist while invoking
  approved npm scripts through the Windows command processor required by Node
  24.
- Risk: high-risk automation bootstrap; Draft PR,
  `manual-merge-required`, no auto-merge.
- Non-goals: arbitrary shell execution, Product implementation, database/Auth,
  Production, secrets, network expansion, or commerce writes.
- Rollback: revert the Phase 4.2 PR. The Item Selection D worktree remains
  preserved for retry after the controller fix is merged.

## 2026-07-30 — Item Selection Security Vertical Slice v1 implementation

- Category: approved high-risk Auth/RLS/database implementation.
- Dependency: PR #49 merged as
  `2737c698878106effdb678bf646460efb13a133a`.
- Decision: execute the accepted Item Selection persistence and Admin security
  design through the supervised orchestrator in bounded checkpoints.
- Security boundary: fail-closed SSR Auth, UUID allowlist, fresh AAL2,
  purpose-bound CSRF, rate limits, RLS/default deny, audited service-role RPCs,
  and immutable evidence.
- Delivery: Draft PR #50, `manual-merge-required`, no Ready/merge/Production
  operation without repository-owner approval.
- Rollback: revert the unmerged PR and discard disposable/Preview resources.

## 2026-07-30 - Production access matrix v1 target

- Category: R0 database/security inventory contract.
- Dependency: Production Schema Security Reconciliation v1, merged through PR
  #51 as `e48e4341d987a428a34702337fb81c2bf6584cf2`.
- Owner / approver: repository owner approved autonomous continuation within
  the accepted architecture and retained high-risk boundaries.
- Decision: assign all 60 migration 000-021 public tables exactly once under a
  default-deny target. Keep Product anonymous read as the proposed target,
  require protected administrator mutation, deny the six dormant Commerce OS
  tables, and require protected administrator or isolated worker access for
  every other active group.
- Evidence: `docs/security/production-access-matrix-v1.json` is the
  machine-verifiable source; its contract test expands groups against the
  migration inventory and keeps SQL generation disabled.
- Risk: normal-risk documentation/test Story. It changes no schema, RLS,
  grants, credentials, runtime behavior, migration history, or Production
  state.
- Consequence: R1 must replace shared-anon mutation paths and prove negative
  authorization, idempotency, audit, and failure contracts before R2 SQL.
- Rollback: revert this documentation/test commit. Database and runtime state
  are unchanged.

## 2026-07-31 — Admin TOTP MFA boundary implementation authorized

- Category: approved high-risk Auth implementation.
- Owner / approver: repository owner.
- Dependency: accepted Admin Identity, Authorization, RLS, and CSRF
  Architecture v1 and PR #56 Production rollout.
- Decision: complete the existing server-owned administrator flow with
  explicit TOTP enrollment, factor-aware challenge/verify, AAL2 self-unenroll,
  and sanitized recovery guidance.
- Recovery boundary: Supabase recovery codes are unsupported. Automatic MFA
  reset, Auth Admin API access, break-glass bypass, and application-managed
  administrator lifecycle remain excluded. Loss of every verified factor fails
  closed and requires the repository owner to remove factors manually in the
  Supabase Dashboard.
- Risk and delivery: high-risk/manual; Draft PR with
  `manual-merge-required`, no auto-merge, no Production deployment, and no
  merge in this Story.
- Rollback: revert the unmerged implementation PR. Existing Production Auth,
  administrator user, environment variables, and database remain unchanged.
