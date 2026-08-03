# Architecture review

## Item Selection Story 3 residual persistence compliance — 2026-08-03

- Approved boundary: Supplier / Procurement Item Selection and the accepted
  Database / Security persistence design. Revenue, provider, HTTP, and UI are
  unchanged.
- Audit result: migration 021 already implements create/finalize transactions,
  immutable history, idempotent replay/conflict, and retry lineage; duplicate
  implementation is excluded.
- Residual scope: forward-only migration 024 adds only the approved stale
  reconciliation RPC, its internal repository DTO, and verification. Because
  Production contains 021–023, migration 021 remains immutable.
- Security/failure contract: service-role only; requester and fingerprint
  bound; row-locked against finalization; database-clock 30-minute threshold;
  zero-evaluation proof; idempotent terminal replay; same-transaction audit.
  Recovery never invents completion or evaluation rows.
- Architecture gate: no new Domain, Queue, public API, UI, external integration,
  or lifecycle. This completes the accepted `RUNNING -> FAILED` stale branch.
- Risk/rollout: high-risk/manual, Draft PR, `manual-merge-required`, disposable
  000–024 replay, exact-head gates, separate owner merge, no Production apply.
- Rollback: revert before application. After application, disable callers and
  retain additive history/data; never rewrite old migrations or delete runs.

## Item Selection Story 3 residual persistence compliance — 2026-08-03

- Approved boundary: Supplier / Procurement Item Selection and the accepted
  Database / Security persistence design. Revenue, provider, HTTP, and UI are
  unchanged.
- Audit result: migration 021 already implements create/finalize transactions,
  immutable history, idempotent replay/conflict, and retry lineage; duplicate
  implementation is excluded.
- Residual scope: forward-only migration 024 adds only the approved stale
  reconciliation RPC, its internal repository DTO, and verification. Because
  Production contains 021–023, migration 021 remains immutable.
- Security/failure contract: service-role only; requester and fingerprint
  bound; row-locked against finalization; database-clock 30-minute threshold;
  zero-evaluation proof; idempotent terminal replay; same-transaction audit.
  Recovery never invents completion or evaluation rows.
- Architecture gate: no new Domain, Queue, public API, UI, external integration,
  or lifecycle. This completes the accepted `RUNNING -> FAILED` stale branch.
- Risk/rollout: high-risk/manual, Draft PR, `manual-merge-required`, disposable
  000–024 replay, exact-head gates, separate owner merge, no Production apply.
- Rollback: revert before application. After application, disable callers and
  retain additive history/data; never rewrite old migrations or delete runs.

## Proposed R3 isolated CLI sidecar transport — 2026-08-01

- Source Story: merged R3 architecture PR #65 and rehearsal validator PR #67.
- Purpose: make the official CLI reachable without attaching the restored DB
  to a Docker network or publishing a port.
- Boundary: a one-shot sidecar shares only the target container network
  namespace; host arguments contain no credential-bearing DSN; credentials and
  CLI state use tmpfs and are destroyed at exit.
- Controls: pinned release SHA, pinned glibc base digest, offline build,
  read-only root/repository, fixed non-root UID, all capabilities dropped,
  no-new-privileges, exact plan fingerprint, Production-marker refusal, and
  target network/port/status preconditions.
- Validation: sidecar image builds and reports CLI 2.110.0 under the intended
  isolation. No database connection or history mutation was attempted.
- Risk: high-risk/manual Database/history transport; separate Draft PR and
  exact owner approval before any runner execution.


## R3 rehearsal implementation compliance — 2026-08-01

- Approved source: merged R3 Architecture Story PR #65, merge
  `14f215e156708844d82f43945f89a178c22741c4`.
- In-scope implementation: offline sanitized evidence validator, deterministic
  repair-plan fingerprint, negative tests, runbook, and delivery evidence.
- Boundary preserved: no database connection, migration repair, direct history
  SQL, schema/RLS/Auth change, Production action, candidate 023, or PR #64
  merge.
- Architecture stop: execution adapter remains blocked because network-none/no
  port quarantine is unreachable by the external official CLI. A separate
  Database/Security transport decision and exact-target approval are required.
- Classification: high-risk/manual because this validator gates a later
  migration-history mutation; `manual-merge-required`, no auto-merge.


## R3 rehearsal implementation compliance — 2026-08-01

- Approved source: merged R3 Architecture Story PR #65, merge
  `14f215e156708844d82f43945f89a178c22741c4`.
- In-scope implementation: offline sanitized evidence validator, deterministic
  repair-plan fingerprint, negative tests, runbook, and delivery evidence.
- Boundary preserved: no database connection, migration repair, direct history
  SQL, schema/RLS/Auth change, Production action, candidate 023, or PR #64
  merge.
- Architecture stop: execution adapter remains blocked because network-none/no
  port quarantine is unreachable by the external official CLI. A separate
  Database/Security transport decision and exact-target approval are required.
- Classification: high-risk/manual because this validator gates a later
  migration-history mutation; `manual-merge-required`, no auto-merge.


## Proposed Architecture Story: R3 Migration History Reconciliation v1

- Document: `docs/architecture/R3-MIGRATION-HISTORY-RECONCILIATION-V1.md`
- Status: proposed; manual repository-owner acceptance required.
- Scope: read-only restored-catalog classification, official Supabase CLI
  history-repair design, R2/R3 ordering correction, rehearsal/Production gates,
  and rollback.
- Risk: high-risk/manual for every later history or Production action.
- Non-goals: migration repair execution, direct history writes, candidate 023,
  schema/RLS changes, Production, Auth, configuration, and commerce writes.
- Gate: later implementation remains blocked until this Architecture Story is
  manually merged and a separate exact-target implementation action is
  explicitly approved.

## Proposed Architecture Story: R2 Product Security Target and Rehearsal v1

- Document: `docs/architecture/R2-PRODUCT-SECURITY-TARGET-AND-REHEARSAL-V1.md`
- Status: proposed; manual repository-owner acceptance required.
- Scope: R1 compatibility re-audit, Product RLS/grant/default-privilege target, forward-only migration design, and restore-based non-Production rehearsal.
- Risk: high-risk/manual for all future RLS/database/restore/Production work.
- Non-goals: migration SQL, restore execution, Supabase/Production changes, Auth changes, runtime implementation, and commerce writes.
- Gate: future implementation remains blocked until this Story is manually merged and an exact restored inventory satisfies every stop condition.

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

## Approved Architecture Stories

### 2026-07-30 — Production Schema Security Reconciliation v1

- Status: accepted for architecture and discovery by repository owner on
  2026-07-30.
- Boundary: Database / Security reconciliation for Production drift and
  missing Supabase migration history.
- Decision: do not preserve permissive development policies and do not remove
  them before application access is classified. Use a forward-only migration
  after 021, preceded by an approved access matrix and compatible server access
  changes.
- Implementation authorization: documentation and inventory only. SQL,
  history repair, and Production execution require the ordered R1-R3 approvals.
- Story:
  [Production Schema Security Reconciliation v1](../docs/architecture/PRODUCTION-SCHEMA-SECURITY-RECONCILIATION-V1.md).
- Decision record:
  [`DECISION_LOG.md`](DECISION_LOG.md#2026-07-30--production-schema-security-reconciliation-v1).

### 2026-07-27 — Domeggook Read-only Supplier Catalog Adapter v1

- Status: approved by repository-owner AI CTO directive.
- Boundary: new read-only External Integration owned by Supplier/Procurement.
- Public API: safe Domeggook health contract approved.
- Database / Migration / Queue: none.
- Risk: normal-risk for this documentation-only Architecture Story.
- Implementation authorization: limited to the Definition of Done and
  exclusions in
  [Domeggook Read-only Supplier Catalog Adapter v1](../docs/architecture/DOMEGGOOK-READONLY-SUPPLIER-CATALOG-ADAPTER-V1.md).
- Decision record: [`DECISION_LOG.md`](DECISION_LOG.md#2026-07-27--domeggook-read-only-supplier-catalog-adapter-v1).

### 2026-07-27 — Domeggook Live Search v1

- Status: approved by repository-owner task directive.
- Boundary: Supplier / Procurement read-only application and public API.
- Database / Migration / Queue: none.
- Risk: normal-risk.
- Implementation authorization: limited to the no-persistence endpoint, UI,
  and tests in
  [Domeggook Live Search v1](../docs/architecture/DOMEGGOOK-LIVE-SEARCH-V1.md).
- Decision record:
  [`DECISION_LOG.md`](DECISION_LOG.md#2026-07-27--domeggook-live-search-v1).

### 2026-07-27 — Item Selection Evaluation v1

- Status: approved by repository-owner task directive.
- Boundary: Supplier / Procurement Item Selection application use case, with
  Revenue remaining the financial-rule owner.
- Public API / Database / Lifecycle: contracts approved for later ordered
  implementation; no runtime route, migration, or Production change is
  authorized by this documentation PR.
- Existing Live Search: remains bounded, read-only, and persistence-free.
- Risk: normal-risk for this documentation-only Architecture Story. Later
  financial, auth/RLS, migration, and Production Stories are high-risk/manual.
- Implementation authorization: limited to the ordered Stories and
  prerequisites in
  [Item Selection Evaluation v1](../docs/architecture/ITEM-SELECTION-EVALUATION-V1.md#14-implementation-stories).
- Decision record:
  [`DECISION_LOG.md`](DECISION_LOG.md#2026-07-27--item-selection-evaluation-v1).

### 2026-07-28 — Item Selection Database Baseline Architecture v1

- Status: Accepted by repository owner on 2026-07-28.
- Approved head SHA:
  `8b1e6ab589491e77dfa7ac5d71c99b40db03030a`.
- Boundary: Database / Security contract for immutable Item Selection
  evaluation history.
- Decision: retain Supabase Postgres; preserve authoritative
  round-trip decimal values and canonical UTF-8 text bytes; use scaled integers
  and JSONB only as non-authoritative query projections; keep append-only
  evaluations and transactional idempotent finalization.
- Implementation authorization: none until the separately required Sprint B-0
  and Admin Identity / Authorization / RLS / CSRF Architecture are accepted.
  No migration, database connection, runtime code, API, UI, auth, RLS, or
  Production execution is authorized by this acceptance.
- Story:
  [Item Selection Database Baseline Architecture v1](../docs/architecture/ITEM-SELECTION-DATABASE-BASELINE-V1.md).
- Decision record:
  [`DECISION_LOG.md`](DECISION_LOG.md#2026-07-28--item-selection-database-baseline-architecture-v1).

### 2026-07-28 — Admin Identity, Authorization, RLS, and CSRF Architecture v1

- Status: Accepted by repository owner on 2026-07-28.
- Approved head SHA:
  `0d68585400eb6ce279c40e93560fea1d69d94a92`.
- Boundary: smallest single-company administrator server boundary.
- Decision: use manual Supabase Dashboard provisioning, a server-only UUID
  allowlist, per-request Auth-server access-JWT/user validation, AAL2
  mutations, exact-origin JSON CSRF, default-deny protected Data API access,
  and one isolated service-role module.
- Accepted residual session boundary: sign-out prevents refresh but does not
  immediately invalidate an issued access JWT; protected reads retain a
  maximum 15-minute token-lifetime boundary and mutations additionally require
  AAL2 freshness of no more than 60 seconds.
- Exclusions remain binding: custom Auth Hook, application administrator
  lifecycle automation, direct `auth.sessions` access, separate revocation
  ledger, per-function owner-role proliferation, and telemetry state machines.
- Implementation authorization: none from this documentation acceptance
  alone. PR #39 remains Draft and high-risk/manual. Sprint B-0 requires its
  separate repository-owner approval and implementation PR.
- Story:
  [Admin Identity, Authorization, RLS, and CSRF Architecture v1](../docs/architecture/ADMIN-IDENTITY-AUTHORIZATION-RLS-CSRF-V1.md).
- Decision record:
  [`DECISION_LOG.md`](DECISION_LOG.md#2026-07-28--admin-identity-authorization-rls-and-csrf-architecture-v1).

### 2026-07-31 — R1 Atomic Product Mutation DB Architecture v1

- Status: accepted by repository owner through manual merge of PR #54 on
  2026-07-31.
- Approved head SHA:
  `cedf3025edbd65c05b36c673991ad4388dce0a8e`.
- Boundary: Product application and Database / Security transaction contract.
- Decision: operation-specific RPCs make Product mutation,
  idempotency completion, and immutable success audit one transaction.
- Delivery: R1 compatible consumers precede R2 restriction; R3 history repair
  and Production remain separately approved.
- Implementation authorization: none from this acceptance alone. A separate
  high-risk implementation Story is required; migration SQL, runtime,
  Production, RLS, environment, real-data, and external-commerce work remain
  excluded.
- Story:
  [R1 Atomic Product Mutation DB Architecture v1](../docs/architecture/R1-ATOMIC-PRODUCT-MUTATION-DB-V1.md).
- Decision record:
  [`DECISION_LOG.md`](DECISION_LOG.md#2026-07-31--r1-atomic-product-mutation-db-architecture-v1).

## Approved Architecture Stories (continued)

### 2026-07-31 — Admin Password Recovery v1

- Status: accepted by repository owner through manual merge of PR #59 on
  2026-07-31. Approved head:
  `d0e1f6dcbf712329e8bfa835ab5cf59684b82b9d`.
- Boundary: existing Admin Auth SSR/Route Handler boundary plus a new
  password-recovery lifecycle.
- Decision proposal: same-browser PKCE recovery, exact redirect allowlist,
  Auth-server user verification, existing UUID allowlist, recovery-purpose
  CSRF, password update, and forced reauthentication.
- Implementation authorization: limited to the approved same-browser PKCE
  recovery lifecycle. Production recovery and redirect configuration remain
  separately approved high-risk actions.
- Story:
  [Admin Password Recovery v1](../docs/architecture/ADMIN-PASSWORD-RECOVERY-V1.md).
- Prefetch amendment: repository-owner approved on 2026-07-31 after
  Production `otp_expired` evidence. Recovery email uses manual `{{ .Token }}`
  entry and server-side `verifyOtp({ type: "recovery" })`; the remaining
  recovery grant, password update, global sign-out, and TOTP boundaries are
  unchanged. Implementation and Production template changes remain
  high-risk/manual.

## Proposed Architecture Stories

### 2026-07-27 — Sprint B-0 Database Baseline Execution v1

- Status: proposed; repository-owner manual approval required.
- Boundary: Database / Security; isolated fresh replay only.
- Production: no access or mutation authorized.
- Critical ordering: preserve migrations 003–020 and place the final
  least-privilege security boundary after migration 020.
- Implementation authorization: none until this Story is manually approved.
- Story:
  [Sprint B-0 Database Baseline Execution v1](../docs/architecture/SPRINT-B0-DATABASE-BASELINE-EXECUTION-V1.md).
