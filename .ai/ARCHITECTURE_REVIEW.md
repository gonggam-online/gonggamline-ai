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

## Approved Architecture Stories

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

### 2026-07-28 — Admin Identity, Authorization, RLS, and CSRF Architecture v1

- Status: proposed; repository-owner manual approval required.
- Boundary: smallest single-company administrator server boundary.
- Root-cause finding: the prior Draft specified an unimplemented enterprise identity control plane with 31 principals, 25 functions, 17 states, Auth Hook, direct Auth-schema locking, invitation lifecycle, and telemetry recovery. Repeated ledger normalization created new unverifiable contracts and caused the correction/re-review loop.
- Superseding proposal: manual Supabase Dashboard provisioning, server-only UUID allowlist, per-request Auth-server `getUser()` verification, AAL2 mutations, exact-origin JSON CSRF, default-deny protected Data API access, and one isolated service-role module.
- Removed from v1: custom Auth Hook, software invitation/retirement/soft-delete, `auth.sessions` access, per-function owner roles, break-glass/MFA administration, and telemetry lease/freeze/recovery state machines.
- Platform reality: service-role has full data access and bypasses RLS; revoked access JWTs remain valid until expiry. The design acknowledges both and uses operational containment plus direct protected Data API denial.
- Validation authority: exact SQL/SDK/lock behavior must be proven in a disposable implementation. Existing application tests do not prove unimplemented security contracts.
- Review closure: only an official-platform conflict, security-invariant violation, or non-executable acceptance test may block v1; enhancements become follow-up work.
- Current-state finding: application routes still have no accepted administrator/session/CSRF boundary and broad development policies remain.
- Risk: high-risk/manual. This Draft authorizes no implementation, configuration, user, secret, Preview/Production, or commerce write.
- Implementation authorization: none until exact-head repository-owner acceptance.
- PR: #39.
