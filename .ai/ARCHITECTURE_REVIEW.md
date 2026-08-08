# Architecture review

## AWS Backup Deployable Worker Automation v1 — 2026-08-08

- Approved source: the accepted encrypted backup architecture, merged base
  boundary PR #104, and the owner directive to finish minimum Cloud-first
  automation before returning to sales development.
- Boundary owner: Database / Security. This implements the already approved
  Lambda/S3/KMS/Secrets Manager adapter without a new Domain, Queue, Lifecycle,
  public API, or provider.
- Scope: Node.js 22 handler, PostgreSQL 17 dump/inspection, runtime-only secret
  retrieval, conditional immutable S3 writes, checksum/KMS/Object Lock
  verification, deterministic daily/monthly identity, digest-pinned ECR
  publishing, and scan fail-close.
- Cloud-first placement: source/evidence are in GitHub, image in immutable
  Singapore ECR, credential only in Secrets Manager, and future archives only
  in the encrypted Object Lock bucket. Local bundle/layers are disposable.
- Security/failure: no credential or backup body enters logs, arguments, Git,
  CI, or local files; the writer has no body-read/delete or KMS decrypt; it
  fails closed on warning, checksum, or retention drift. Scheduler stays
  disabled through worker deployment and synthetic verification.
- Risk: high-risk/manual because later stages create a secret, publish an
  image, enable Lambda/IAM, and perform a Production read-only export. Apply
  `manual-merge-required`; never auto-merge.
- Rollout/rollback: publish and scan an exact-commit image; create the exact
  secret; review a disabled-schedule UPDATE; run synthetic verification before
  one bounded Production export. After a Production archive exists, preserve
  the retained bucket, key, versions, and recovery evidence.

## AWS Backup Disabled-Worker Change Set Packet v1 — 2026-08-06

- Approved source: merged infrastructure/capacity/cost/complete-worker evidence
  through PR #102 and the owner directive to continue the next Cloud-first
  stage.
- Boundary owner: Database / Security. The accepted AWS Singapore backup
  architecture, CloudFormation template, retention lifecycle, and external
  integration are unchanged.
- Scope: deterministic no-AWS generation of the exact first change-set target,
  template digest, `EnableWorkerResources=false` inputs,
  `CAPABILITY_NAMED_IAM`, six expected base resources, eight omitted worker
  resources, retained-resource warning, and fail-closed negative tests.
- Cloud-first placement: source, exact packet, decision, and sanitized delivery
  evidence belong in GitHub. No AWS account identifier, credential, secret,
  backup body, or device-local durable state is created.
- External preflight: this workstation has no AWS CLI and the available AWS
  console is signed out. No AWS call was attempted. Root and long-lived access
  keys remain prohibited; a temporary/federated administrative session with
  MFA is required.
- Risk: high-risk/manual because the packet gates later paid retained AWS
  resources. Apply `manual-merge-required`; never auto-merge or execute the
  change set.
- Rollout/rollback: Draft PR and Preview validation only. Revert the packet
  before any AWS action. Creating the no-execute change set and executing it
  remain two separate explicit owner approvals.

## AWS Backup Complete Worker Rehearsal v1 — 2026-08-06

- Approved source: manually accepted Encrypted Cloud Backup and Restore
  Architecture plus merged infrastructure, capacity, and cost evidence through
  PR #101.
- Boundary owner: Database / Security. The existing source of truth is
  `docs/cloud/encrypted-backup-contract-v1.json`; no new Domain, Database,
  Migration, Queue, Lifecycle, Public API, or External Integration is added.
- Scope: a fail-closed worker pipeline and disposable synthetic PostgreSQL
  rehearsal for custom dump, offline inspection, SHA-256, immutable archive and
  manifest writes, SSE-KMS/version assertions, retention read-back, exact
  replay, deadline/space limits, sanitized events, and complete cleanup.
- Cloud-first placement: source, sanitized evidence, and decisions belong in
  GitHub. The synthetic database, archive, simulated object bodies, containers,
  network, and local result are temporary and deleted after evidence capture.
- Result: 6,351,131 bytes completed in 7.901 seconds with 6,351,837 peak
  ephemeral bytes, leaving 892.099 seconds and 10,731,066,403 bytes of margin.
  Production and AWS were not contacted.
- Risk: high-risk/manual because the pipeline is a gate for later Production
  export and AWS backup infrastructure. Apply `manual-merge-required`; never
  auto-merge. No provisioning, credentials, Production connection/export,
  paid usage, restore, or schedule is authorized.
- Rollout/rollback: repository and Preview validation plus Draft PR only.
  Revert before provisioning. The next action is a separately approved exact
  CloudFormation change set with `EnableWorkerResources=false`.

## AWS Independent Backup Infrastructure Plan v1 — 2026-08-05

- Approved source: manually merged Encrypted Cloud Backup and Restore
  Architecture PR #91, policy approval PR #92, and provider evidence PR #94.
- Boundary owner: Database / Security. Existing source of truth is
  `docs/cloud/encrypted-backup-contract-v1.json`; this Story implements only
  deployment-order stage 3.
- Architecture compliance: no new Domain, Database, Migration, Queue,
  Lifecycle, Public API, or unapproved External Integration is introduced.
  The accepted AWS S3/KMS/Object Lock + disabled Scheduler/Lambda boundary is
  represented as non-executing infrastructure-as-code and structural tests.
- Dependency/security: application, Revenue, Product, Listing, marketplace,
  and Supabase runtime code remain unchanged. Singapore-only placement,
  immutable retention, least privilege, no root/long-lived key, no secret
  value, disabled schedule, and fail-closed capacity/cost gates are mandatory.
- AWS permission correction: the writer excludes `GetObjectAttributes`
  because AWS couples it to `s3:GetObject` and, for SSE-KMS, `kms:Decrypt`.
  Writer verification uses the upload response plus retention read-back;
  independent body verification remains isolated in the later restore role.
- Retention/principal enforcement: bucket policy denies writes outside the
  daily/monthly prefixes, any writer except the exact named worker role, daily
  retention below 35 days, monthly retention without an explicit date, and
  monthly retention below 365 days. Governance bypass remains globally denied.
- Durable state: reviewed source and sanitized evidence belong in GitHub; later
  backup objects belong only in the approved owner-controlled AWS boundary.
  Local artifacts are replaceable build/test output and contain no backup data.
- Risk: high-risk/manual because the plan defines future IAM, secret, paid AWS,
  and Production-export boundaries. Apply `manual-merge-required`; never
  auto-merge or execute a CloudFormation change set in this Story.
- Rollout/rollback: repository validation and Draft PR only. Revert the plan
  before provisioning; after any future immutable object exists, use the
  separately approved decommission path rather than ordinary deletion.

## Proposed Encrypted Cloud Backup and Restore Architecture v1 — 2026-08-05

- Document:
  `docs/architecture/ENCRYPTED-CLOUD-BACKUP-AND-RESTORE-V1.md`.
- Status: proposed; repository-owner manual acceptance is required.
- Boundary: Database / Security disaster recovery, preserving Supabase
  provider backups and proposing an independent owner-controlled Singapore AWS
  S3/KMS/Object Lock copy created by a scheduled AWS Lambda worker.
- Architecture gate: this is the required Architecture Story for a new
  external integration and backup lifecycle. No implementation or external
  action is authorized before manual acceptance and a separate exact
  provisioning Story.
- Security/failure contract: Production data never enters CI/Git/Vercel/chat;
  immutable objects, least privilege, separate export/restore roles, bounded
  retries, fail-closed verification, two fresh restore cycles, and no automated
  Production restore.
- Risk/non-goals: high-risk/manual; account/billing, resources, credentials,
  Production access/export, restore, DB/RLS/Auth/environment change, local
  backup access/deletion, paid use, and auto-merge are excluded.
- Rollback: revert documentation before acceptance. Later immutable backup
  objects and KMS keys require a separate retention/decommission approval.
- Owner evidence amendment: sanitized Production Dashboard screenshots dated
  2026-08-05 verify Free Plan, no scheduled backup/recovery point, PITR not
  enabled, and no restore-to-new-project entitlement. A Pro daily-backup
  upgrade is now an explicit separate paid decision; PITR is excluded from the
  initial proposal.
- Owner policy approval: on 2026-08-05 the repository owner approved Supabase
  Pro daily backups with PITR excluded, AWS `ap-southeast-1`, a USD 10/month
  AWS-only ceiling, 35-day daily/12-month monthly retention, RPO <=24h, and RTO
  <=8h. No plan upgrade, account/billing change, resource, credential,
  Production export, restore, deletion, or PR merge was executed by this
  approval record.
- Provider execution evidence: later on 2026-08-05, sanitized Dashboard
  screenshots verified Supabase Pro active, seven physical daily recovery
  points with restore actions, Spend Cap enabled, PITR/Dedicated IPv4/Custom
  Domain disabled, and no configured Log Drain. Database backups exclude
  Storage API object bodies; AWS independent backup remains pending.

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

## Approved Listing Content Fact and Policy Contract v1 — 2026-08-05

- Status: accepted by repository owner on 2026-08-05.
- Approved content SHA:
  `5b77af8baf39a769e8541b14fe52196b27fcde4f`.
- Boundary: existing Listing domain consuming Supplier / Procurement, 3PL
  inspection, asset-rights, and exact Coupang category evidence.
- Decision: every title token, keyword, image/derivative, detail-page claim,
  notice, and payload field must be evidence-linked and fail closed on
  `UNKNOWN`, conflict, prohibited rights, stale category metadata, or encoding
  failure.
- KK946: repository evidence is absent, so it remains explicitly quarantined.
- Implementation authorization: only the ordered normal-risk documentation and
  pure policy/test Stories may start without a new Architecture decision. API,
  external-contract, persistence, asset lifecycle, DB/Auth/RLS, paid, price,
  Production, and marketplace actions remain separately gated.
- Story:
  [Listing Content Fact and Policy Contract v1](../docs/architecture/LISTING-CONTENT-FACT-AND-POLICY-CONTRACT-V1.md).

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

### 2026-08-04 — Sales Learning Closed Loop and First Experiment v1

- Status: proposed; repository-owner Architecture and experiment-cap approval
  required.
- Boundary: cross-domain sales evidence correlation from external candidate to
  listing, order, settlement, and experiment-attributable actual net profit.
- Decision: preserve immutable estimate snapshots; require accounting-final,
  append-only evidence before actual net profit or forecast error is known.
- Proposed experiment: one SKU/listing/account, 10 order lines, KRW 300,000
  cash cap, KRW 50,000 advertising cap, KRW 10,000 daily advertising cap, and
  KRW 100,000 loss cap. These are not execution authorization.
- Implementation authorization: none. DB/Auth/RLS/privacy/Production,
  marketplace, procurement, listing, price, advertising, order, return,
  settlement, payment, paid, and destructive actions remain separately
  approval-gated.
- Story:
  [Sales Learning Closed Loop and First Experiment v1](../docs/architecture/SALES-LEARNING-CLOSED-LOOP-V1.md).


### 2026-07-27 — Sprint B-0 Database Baseline Execution v1

- Status: proposed; repository-owner manual approval required.
- Boundary: Database / Security; isolated fresh replay only.
- Production: no access or mutation authorized.
- Critical ordering: preserve migrations 003–020 and place the final
  least-privilege security boundary after migration 020.
- Implementation authorization: none until this Story is manually approved.
- Story:
  [Sprint B-0 Database Baseline Execution v1](../docs/architecture/SPRINT-B0-DATABASE-BASELINE-EXECUTION-V1.md).
