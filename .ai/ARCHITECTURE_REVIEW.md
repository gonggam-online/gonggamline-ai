# Architecture review

## Evidence-bound Persuasive Story Architecture v1 — 2026-08-20

- Approved boundary reused: the merged Listing evidence kernel and
  owner-approved conversion amendment; no new Domain, Database, Queue,
  lifecycle, public API, or external integration is introduced.
- Dependency contract: consumes exact 15A keyword digest, 15B title packet
  digest, verified product/persona/use-context claims, and category/policy
  evidence digests; emits a deterministic Shadow-only packet for 16B.
- Truth boundary: only pre-approved phrasing of `VERIFIED` claims may enter a
  block. Unknown, conflicting, prohibited, unprovenanced, or policy-blocked
  claims are quarantined and receive no candidate score.
- Human/LLM boundary: human revision selects only an existing approved
  phrasing and is audit-bound. An LLM may propose upstream wording but cannot
  create facts, efficacy, numbers, reviews, scarcity, or comparative advantage.
- Risk: normal-risk additive pure domain logic and fixtures. No price,
  marketplace decision/write, DB/Auth/RLS, Secret, paid call, or Production
  behavior changes.
- Rollback: revert the additive module/export/tests/docs; existing Listing,
  Market, Competition, Item Selection, and Sales Learning remain unchanged.

## Competitive Keyword Intelligence v1 - 2026-08-20

- Owner/boundary: existing Market Intelligence domain and the approved Naver,
  YouTube, DataForSEO read-only source lanes. The change adds a pure Shadow
  projection, not a new Domain, public API, database, Queue, lifecycle, or
  external transport.
- Source of truth: sanitized provider records enter the existing approved
  adapter boundary. The versioned packet contains only bounded metrics, HTTPS
  source references, timestamps, freshness, and SHA-256 evidence digests.
- Determinism: NFC/text normalization, explicit alias maps, stable source and
  keyword ordering, canonical JSON, fixed weights, and deterministic tie
  breaking produce the same digest for the same semantic input.
- Safety: missing metrics remain unknown. Stale, conflicting, or unknown/
  prohibited-rights evidence is quarantined without a score. Provider 403,
  429, malformed/empty responses, and cost-ceiling breaches fail closed.
- Compatibility: no Item Selection DTO, score, verdict, API, or persistence
  contract changes. Downstream consumers must bind both `keywordSetVersion`
  and packet digest and treat the packet as Shadow research evidence only.
- Cloud/recovery: GitHub/CI owns code, fixture, and review evidence. Local test
  output is disposable. No provider raw response or Secret is retained;
  recovery is checkout plus deterministic fixture replay.
- Rollback: remove the additive module, fixture, tests, and documentation;
  existing market collection and Item Selection behavior remains unchanged.

## Listing creative operator runtime implementation - 2026-08-14

- Scope: implement the accepted S3-16 PREPARE, bounded Production dispatch,
  private archive/handoff, protected signed-URL recovery, and read-only operator
  review UI. The runtime is generic; product-specific values enter only through
  the typed external adapter.
- Security: fresh AAL2 admin authentication, exact origin, exact JSON, two
  purpose-bound CSRF tokens, bounded bodies, per-admin/global rate limits,
  immutable operator/plan digests, five-minute distributed global slot, and
  reservation before provider composition. Preview/CI cannot compose the real
  provider.
- State/recovery: Supabase private Storage is authoritative for plan,
  authorization, reservations, failure evidence, generated masters, and review
  handoff. The protected GET boundary reissues short-lived URLs after response
  or URL expiry. Vercel Blob remains outside this private phase.
- Stop state: actual bytes must pass computed QA and private archive verification
  before `REVIEW_REQUIRED`. Human checks have no default values. Publication,
  registration mapping, live-write approval, and WING remain unavailable.
- Billing evidence: a payment method is verified, while the authenticated UI
  still presents a Pro trial and final `Upgrade` action. Paid Pro activation is
  not claimed, and no sensitive billing detail is retained.
- Risk: high-risk/manual. Exact fake-only CI and Preview are required; the first
  paid Production dispatch remains separately approved after merge/deploy.

## Accepted authenticated Listing creative operator dispatch - 2026-08-14

- Status: accepted by repository-owner squash merge of PR #137 as
  `bf007382f9325d64aebd0ab9675fe4eae60216d5`. The S3-16 high-risk runtime
  implementation may proceed; its exact PR and first paid Production dispatch
  remain manual gates.
- Revenue gate: the accepted provider/archive service cannot be invoked in
  Production without either exporting Vercel Sensitive secrets (forbidden) or
  adding an authenticated deployed call site. This amendment chooses the
  smallest reusable call site rather than ad hoc local secret handling.
- Boundary: a non-billable PREPARE mutation persists a canonical plan; a second
  fresh-AAL2, exact-origin, purpose-CSRF mutation creates a digest-bound operator
  authorization and whole-plan reservation before one bounded provider call.
  The response stops at private `REVIEW_REQUIRED`.
- Durable state: Supabase private Storage owns create-only prepared,
  authorized, reserved, failure, and review-handoff manifests. GitHub owns the
  contract and CI evidence. Local/browser state is disposable and cannot confer
  approval.
- Security: Production only, server-held secrets, current admin allowlist,
  body/schema/rate limits, sanitized telemetry, no client-trusted digest, no
  automatic retry, no default human QA PASS, and no public/general-purpose
  generation endpoint.
- Non-goals: no content approval, Vercel Blob publication, registration mapping,
  live-write approval, Coupang/WING call, concurrent worker, schedule, or DB/RLS
  expansion.
- Risk/rollback: high-risk/manual. Revert the amendment to keep dispatch
  disabled. After implementation, disable composition and preserve private
  evidence; rotate the provider key only if compromise is suspected.
- Story: [Listing Creative Authenticated Operator Dispatch v1](../docs/architecture/LISTING-CREATIVE-AUTHENTICATED-OPERATOR-DISPATCH-V1.md).

## Vercel paid-billing observation - 2026-08-14

- Authenticated UI evidence supplied by the owner first showed `Hobby Plan` /
  `Active`; later evidence verifies a payment method and displays the final Pro
  checkout. Because the action still says `Upgrade`, paid Pro activation is not
  established.
- Official boundary: Vercel Blob is available within Hobby's included limits,
  but Hobby has no on-demand overage and Vercel describes it as personal,
  non-commercial use. A commercial product-asset delivery dependency therefore
  requires Pro activation or a separately accepted commercial CDN/store.
- Classification: external configuration, not code. Private Supabase archive
  and review do not depend on this gate; commercial Vercel Blob publication
  does.
- Data handling: no card suffix, expiry, invoice email, address, tax field, or
  account identifier is copied into Git, logs, or task evidence.
- Authority: read-only observation. No payment, plan, budget, add-on, invoice,
  or billing-profile mutation was performed.

## 2026-08-14 - Listing creative managed-store OIDC rollout correction

- Scope: reconcile the merged managed creative storage adapter with Vercel
  Blob's current OIDC-default project connection, document the authenticated
  Supabase/Vercel rollout, and preserve Production-only write execution.
- External configuration: `listing-creative-private-v1` is the Supabase private
  authoritative master with approved limits/default deny;
  `listing-creative-public-v1` is the replaceable public mirror in ICN1. No
  object, provider request, payment, or marketplace mutation is part of this
  correction.
- Code: the adapter selects OIDC whenever `BLOB_STORE_ID` is present and falls
  back to an injected legacy read-write token only for a controlled migration.
  It rejects Preview/development before constructing either store.
- Security: the store identifier and webhook public key are connection metadata,
  not write secrets. The SDK obtains the short-lived credential from the Vercel
  Production request context. No credential is exposed to `NEXT_PUBLIC_*` or
  accepted from a client.
- Cloud-first/recovery: Supabase remains the durable private source of truth;
  Blob remains reconstructable from a digest-verified master and canonical
  approval. GitHub owns code/policy/CI evidence. Local fixtures are disposable.
- Risk: high-risk credential/Production integration. Exact-head CI/Preview and
  post-merge Production smoke remain required. Paid OpenAI execution, durable
  DB/Auth/RLS jobs, public product publication, and WING write remain separate.
- Rollback: stop dispatch, remove public mirrors, disconnect the Blob project,
  revert the adapter, and preserve private master/approval evidence until all
  references are reconciled.

## Listing actual-byte QA and digest-bound approval implementation review - 2026-08-14

- Accepted Architecture: PR #131 / merge `4fd2271`; storage PR #132 / merge
  `5d2a6ad`; provider PR #133 / merge `d910f33`. This is the ordered managed-
  creative step 3 and introduces no new Domain, public API, database, migration,
  Queue or concurrent runtime lifecycle.
- Boundary: Listing domain computes binary and product-representation gates;
  injected application services orchestrate the accepted provider and managed
  storage ports. The selected-set mapper consumes only a canonical approval and
  digest-verified public references.
- Truth/security: full PNG structure and inflated payload are verified before
  archive; every selected artifact needs human factual/visual PASS; approval
  binds evidence/category/policy/content/provider/review/revision digests. A
  private, fixture, data, unselected or unapproved reference cannot enter the
  creative registration mapper. Live-write approval is still separate.
- Cloud-first: real masters/manifests belong in the accepted Supabase private
  bucket and approved public mirrors in Vercel Blob. Tests use disposable fakes;
  no local artifact is authoritative. Durable job/approval concurrency remains
  blocked on the separate Database/Auth/RLS Story.
- External stop: no Blob store/token or OpenAI key is configured, billing is
  expired, and Supabase/OpenAI sessions are signed out. This code PR performs no
  external configuration, paid call, public publication, Production mutation or
  marketplace write.
- Risk/rollback: high-risk/manual, no auto-merge. Revert code and invalidate any
  later dependent approval/public mirror; external rollout follows the accepted
  runbooks only after exact configuration gates pass.

## Listing Image API adapter implementation review - 2026-08-14

- Accepted Architecture: PR #131 / merge `4fd2271`; storage implementation PR
  #132 / merge `5d2a6ad`. No new domain, public API, database, queue, or runtime
  lifecycle is introduced by this provider slice.
- Implementation: injected OpenAI Image API transport, pinned snapshot, strict
  approval identity, operation-specific rights, exact input resolver, estimated/
  actual cost evidence, retry/output/revision limits, a required managed-storage
  immutable dispatch reservation, and sanitized execution metadata. CI/Preview
  use fake bytes and make no provider call.
- Cloud-first: code/evidence lives in GitHub; actual output must be archived in
  the approved Supabase private master before review or publication. No local
  generated file is authoritative.
- Current external stop: Supabase login is absent, Vercel Blob region and
  Production+Preview token behavior need an exact amendment, the Vercel trial is
  expired, and no OpenAI project key/budget is verified. The adapter cannot
  compose in Production without all required server secrets and storage.
- Risk: high-risk/manual. No auto-merge, paid call, secret/config write, public
  publication, Product Creation, or WING submission is authorized by the PR.

## Accepted Listing Managed Creative Asset and Image Provider v1 - 2026-08-14

- Status: accepted by repository-owner manual merge of PR #131 on 2026-08-14;
  merge commit `4fd227193314c14cd096d73e46f97a340f4bd9d0`.
- Implementation authorization: the ordered high-risk/manual PRs in the Story
  may proceed. Each exact external bucket/store, secret/config, paid provider,
  public publication, Production, DB/Auth/RLS, or commerce-write action retains
  its documented manual boundary.
- Revenue gate: replace fixture-only Listing creative output with real,
  recoverable, reviewable assets while keeping an eligible unchanged-source
  registration packet available when optimization is pending.
- Topology: Supabase Storage private bucket owns source/master bytes and immutable
  manifests; Vercel Blob is a replaceable public CDN mirror containing selected,
  content-approved channel assets only.
- Provider: OpenAI Image API pinned to `gpt-image-2-2026-04-21`; maximum USD 2 per
  product revision, six outputs, two attempts, and USD 50 monthly project budget.
  CI/Preview use deterministic fakes and receive no real provider key.
- Rights/truth: every pixel input needs verified provider-upload and requested
  operation rights. Competitor/web pixels remain observation-only. Independent
  fact-only output still needs computed and human product-representation QA.
- Security/recovery: server-only keys, private default-deny access, immutable
  digest keys, separate private master/public mirror, takedown, retention, and
  verified restore. `legacy listing_drafts` remains ineligible for durable jobs
  or approvals.
- Current external gates: no Storage bucket or Blob store/token exists, Vercel
  requires a billing action, and OpenAI Platform/key/budget are unverified.
- Risk/rollback: high-risk/manual. Stop dispatch, rotate keys, remove public
  mirrors, invalidate approvals, preserve governed private evidence, and revert.
- Story: [Listing Managed Creative Asset and Image Provider v1](../docs/architecture/LISTING-MANAGED-CREATIVE-ASSET-AND-IMAGE-PROVIDER-V1.md).

## Accepted Listing Creative Optimization Pipeline v1 - 2026-08-14

- Status: accepted by repository-owner manual merge of PR #127 on 2026-08-14;
  merge commit `b463028a9d79ca44a863475c2ad8df99bb37f53a`.
- Implementation authorization: ordered steps 1-4 only (pure v3 contracts,
  generic planner, deterministic fixture renderer/computed QA, selected-set
  mapper, and fixture-preview review UI). Real provider, paid/secret/config,
  managed object storage/CDN, Database/Auth/RLS, Production and commerce writes
  remain separate Architecture/manual gates.
- Revenue gate: make rights-cleared creative optimization the generic default
  after minimum registration fitness, with two reviewable candidates and
  profit/return-guarded learning rather than a KK946-only path.
- Root cause: the existing pure builder validates claimed asset metadata and
  shot briefs; it has no binary renderer/provider, computed visual QA, managed
  object store, immutable creative approval, or selected-set-only mapper.
- Rights decision: supplier unchanged-use remains frictionless when expressly
  granted. Public visibility or lack of a prohibition never grants editing,
  provider-upload, or generative-reference rights. Competitor/web pixels are
  observation-only; verified operation capabilities are used automatically.
- Cloud-first: GitHub owns this Story, contract tests, PR, and CI. Operational
  assets require a separately approved managed object store/CDN; revision,
  approval, rights dependency, and learning state require a separate
  Database/Auth/RLS Story. Local artifacts are disposable.
- Risk: this documentation PR is normal-risk but manual due to the Architecture
  gate. Provider/paid/secret, storage, DB/RLS/Auth, Production, and commerce-
  write steps remain separate high-risk/manual approvals.
- Story: [Listing Creative Optimization Pipeline v1](../docs/architecture/LISTING-CREATIVE-OPTIMIZATION-PIPELINE-V1.md).
- Rollback: Git revert; no runtime or external state is changed.

## Asset Error Isolation and Pipeline Continuity Policy v1 - 2026-08-14

- Status: owner-accepted delegated 12E policy; documentation/pseudocontract only.
- Revenue gate: keep valid assets and independent content research moving when one asset fails, reducing avoidable batch restarts without increasing rights or access risk.
- Existing boundary: refines Listing/12D failure semantics; creates no Domain, API, database, Queue, crawler, storage, retry service, external integration, or publication behavior.
- Fail-closed decision: item errors continue the batch, while rights/access/conflict outcomes are excluded from derivative, publication, and upload lanes. `bypass_rights_check` is a contract error.
- Cloud-first: GitHub owns policy/delivery evidence. Operational status/evidence/audit has no approved remote owner here, so runtime implementation remains stopped.
- Risk/rollback: normal-risk docs-only; Git revert. Every later runtime/provider/database/Queue/Production/write Story keeps its separate gate.

## External Commerce Asset Discovery and Rights Policy v1.1 - 2026-08-14

- Status: owner-accepted policy amendment through delegated task 12D; documentation implementation only.
- Revenue gate: accelerate lawful supplier/manufacturer/public-reference discovery without converting public visibility into publication permission.
- Existing boundary: amends Listing Content Fact/Policy and Conversion owner decisions; creates no Domain, API, database, queue, crawler, downloader, storage, external integration, or marketplace behavior.
- Decision: discovery, original-use authority, and operation-specific edit authority are independent. Rights `UNKNOWN` blocks the affected asset lane, not unrelated product/content research.
- Cloud-first: GitHub owns only policy and sanitized delivery evidence. Source metadata, licenses, manifests, approvals, sensitive documents, and binaries need a separately approved encrypted managed evidence boundary; no local-only archive and no sensitive GitHub upload.
- Risk: normal-risk docs-only. Every later collection/integration/paid/Production/publication implementation retains its separate risk and manual gates. Rollback is Git revert.

## KK946 six-unit E2E listing readiness - 2026-08-12

- Status: documentation/evidence implementation only; execution awaits an exact
  repository-owner external-write approval after delivery gates.
- Revenue gate: complete the first real search-to-settlement loop with already
  held stock while preserving the default rule that profitability must pass
  before procurement.
- Existing boundary: uses the accepted Listing Content Fact/Policy and Sales
  Learning concepts; introduces no new runtime, API, database, queue, secret,
  Production route, or authorization surface.
- Exact exception: catalog product `9681483612` black, stock/orders six,
  `4,290 KRW`, free shipping, no ads/coupons/auto-repricing/reorder, 14-day
  exposure, and `30,000 KRW` actual attributable loss cap.
- Fail closed: WING logistics records are absent and rights-cleared listing
  assets plus private seller/provider facts remain incomplete. A local
  readiness packet cannot authorize or substitute for those external facts.
- Cloud-first: GitHub owns sanitized packet/tests/PR/CI evidence. WING, Coupang,
  Domeggook, and Gaemi own account, address, contact, asset, order, return, and
  settlement data; browser state is disposable.
- Risk: high-risk/manual; `manual-merge-required`, no auto-merge. No external
  write is part of this PR. Git revert is the repository rollback.

## WING SQS Read-only Runner v1 - 2026-08-11

- Status: approved by explicit repository-owner delegated directive on
  2026-08-11.
- Revenue gate: let Picktil Discovery acquire bounded WING evidence without
  copying desktop credentials or granting commerce-write authority.
- Existing boundary: extend merged PR #118's desktop central runner, DPAPI
  credential store, SQS/IAM assets, and HMAC client; do not create a parallel
  runner.
- New contract/lifecycle: exact `1.0.0` FIFO request/response DTOs, the three
  fixed read operations, poison rejection, and response-before-delete ordering.
- Cloud-first: AWS FIFO is the remote duplicate-suppression boundary. The
  worker persists no local automation ledger or provider response. At-least-once
  delivery may repeat only a bounded read and cannot produce a commerce write.
- Security: desktop-only credentials/vendor ID, environment-only queue URLs,
  least privilege, sanitized logs/errors, no raw provider persistence, and no
  write-capable WING operation.
- Risk: high-risk/manual because Queue, external integration,
  secrets/environment, and authorization surfaces are involved.
  `manual-merge-required`; no auto-merge.
- External actions: no queue/IAM/secret/scheduled-task change and no live WING
  call are authorized by implementation alone. The single final
  `connection_test` waits for verified runtime inputs.
- Story: [WING SQS Read-only Runner v1](../docs/architecture/WING-SQS-READONLY-RUNNER-V1.md).
- Rollback: revert the PR and stop the worker after response reconciliation.

## KK946 evidence acquisition runbook - 2026-08-08

- Approved boundary: Listing Content Fact and Policy Contract v1, ordered
  implementation Story 1.
- Result: read-only operator sequence, exact identity crosswalk, authoritative
  evidence matrix, sanitized return packet, stop conditions, and an all-unknown
  quarantine manifest.
- External boundary: no external tool is invoked. Raw evidence remains in its
  authoritative source system and no new storage destination is invented.
- Cloud-first: GitHub owns only internal sanitized status, instructions, tests,
  and recovery history. Confidential evidence/asset storage remains
  `NOT_APPROVED` and is a future Architecture gate.
- Risk: normal-risk documentation and contract tests. No purchase, 3PL order,
  live API call, database, configuration, Production, asset movement, pricing,
  or marketplace write.
- Rollback: Git revert only.

## Coupang Read-only Preflight Evidence implementation - 2026-08-08

- Acceptance: repository owner approved the Architecture Story and PR #111
  merged before the implementation branch was created.
- Result: internal unused GET-only adapters, strict sanitized decoders,
  bounded return pagination, and a pure KK946 mapper.
- Cloud-first: GitHub owns durable source, tests, decision, and CI evidence;
  provider responses remain request-memory only and are discarded.
- Risk: normal-risk. No route, runtime invocation, configuration, persistence,
  Production, Product Creation, or write path changed.
- Rollback: Git revert only.

## Proposed Coupang Read-only Preflight Evidence v1 — 2026-08-08

- Document: `docs/architecture/COUPANG-READONLY-PREFLIGHT-EVIDENCE-V1.md`.
- Revenue gate: prove the exact Marketplace category, outbound location, and return center before KK946 can reach a meaningful local preflight.
- Boundary: existing server HMAC client plus three fixed official GET operations; strict sanitized normalization and a pure KK946 mapper.
- New boundary: vendor-scoped logistics evidence acquisition and a bounded request-memory evidence lifecycle. Owner approval is required before code.
- Cloud-first: GitHub owns architecture/tests/review evidence; provider raw responses are discarded and normalized evidence is request-memory only.
- Risk: normal-risk documentation/test. No credential/config change, live call, public API, persistence, Production, Product Creation, or commerce write is authorized.
- Rollback: Git revert only.

## AWS Backup Worker Automation v1 — 2026-08-08

- Boundary: deployable Lambda Node.js 22/PostgreSQL 17 backup worker using
  Secrets Manager, immutable checksum/KMS/Object Lock writes, and deterministic
  replay.
- Cloud-first state: source and delivery evidence remain in GitHub; encrypted
  backup objects, manifests, and secrets remain in the approved Singapore AWS
  services. No credential or Production dump belongs in Git or local durable
  storage.
- Risk: high-risk/manual. Merging code does not authorize secret creation,
  worker-resource deployment, schedule enablement, Production database access,
  or the first Production archive.
- Delivery rule: retain `manual-merge-required`; never auto-merge. Every AWS,
  secret, Production-read, and paid-resource action remains separately gated.
- Rollback: keep scheduling disabled and remove only worker resources through a
  separately reviewed CloudFormation change set while retaining the recovery
  boundary.

## Listing Category Evidence Bridge v1 — 2026-08-08

- Approved sources: owner-approved Architecture PR #107 and merged typed
  category snapshot implementation PR #108.
- Boundary: a pure, additive Listing-domain bridge from one validated category
  snapshot to one `coupangCategoryContract` evidence fact.
- Decision: admit no evidence unless the snapshot is validated, explicitly
  selects a notice category, has valid canonical digests and bounded identity,
  preserves observation/capture/evaluation ordering, and remains within the
  seven-day validity window.
- Non-escalation rule: metadata attributes, certifications, documents, and
  notice items remain category requirements; the bridge never promotes them
  into product facts.
- Cloud-first gate: GitHub source, tests, PR, and CI are the durable source of
  truth and recovery path. The bridge creates no durable runtime state; local
  checkout and test output are disposable.
- Risk: normal-risk pure implementation. No API, database, RLS/Auth, secret,
  Production, live Coupang request, paid service, or commerce write changes.
- Rollback: revert the bridge implementation commit; existing snapshot and
  Listing evidence contracts remain independently usable.

## Listing Category Snapshot implementation — 2026-08-08

- Approved source: owner-approved and merged Architecture PR #107.
- Scope: bounded DTO contracts, canonical SHA-256, pure fail-closed mapper,
  separate read-only validity adapter, and synthetic positive/negative tests.
- Compatibility: existing route and response body remain unchanged; no live
  call, configuration, database, persistence, pricing, or commerce write.
- Risk: normal-risk while the implementation remains additive and unused by
  Production orchestration.
- Cloud-first: GitHub owns source and synthetic evidence; no durable runtime or
  local-only state is introduced.

## Listing Category Snapshot v1 — 2026-08-08

- Business gate: validate one exact category before truthful listing content.
- Boundary: Listing owns admission/quarantine; the Coupang adapter owns only
  read-only provider translation.
- Architecture: typed metadata plus separate validity result, canonical
  digests, bounded fixtures, stable failures, and unchanged legacy API shape.
- Cloud-first: GitHub owns source/contracts/test evidence; no runtime durable
  state, secret, Production response, database, or local authority is added.
- Risk: normal-risk documentation. Implementation, configuration, provider
  smoke, persistence, and commerce writes require their applicable gates.
- Rollback: Git revert; no external state changes.

## Listing Category Snapshot v1 — 2026-08-08

- Business gate: validate one exact category before truthful listing content.
- Boundary: Listing owns admission/quarantine; the Coupang adapter owns only
  read-only provider translation.
- Architecture: typed metadata plus separate validity result, canonical
  digests, bounded fixtures, stable failures, and unchanged legacy API shape.
- Cloud-first: GitHub owns source/contracts/test evidence; no runtime durable
  state, secret, Production response, database, or local authority is added.
- Risk: normal-risk documentation. Implementation, configuration, provider
  smoke, persistence, and commerce writes require their applicable gates.
- Rollback: Git revert; no external state changes.

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
# 2026-08-08 — Coupang Marketplace Product Creation local preflight

- Status: implementation within the accepted Coupang Seller Product Contract Audit Story 1 boundary.
- Boundary: additive pure Listing-domain contract and deterministic preflight; the legacy registration route and DTO remain unchanged.
- Compliance: preserves separate Listing draft, category snapshot, evidence, and Seller write ownership. No new Domain, API, persistence, lifecycle, or external integration is introduced.
- Risk: normal-risk. `READY` is explicitly not provider acceptance and every real listing/approval operation remains high-risk/manual.
- Recovery: source, fixtures, decisions, CI and PR evidence are GitHub-owned; local build/test output is disposable.
# 2026-08-08 — Coupang Marketplace Product Creation local preflight

- Status: implementation within the accepted Coupang Seller Product Contract Audit Story 1 boundary.
- Boundary: additive pure Listing-domain contract and deterministic preflight; the legacy registration route and DTO remain unchanged.
- Compliance: preserves separate Listing draft, category snapshot, evidence, and Seller write ownership. No new Domain, API, persistence, lifecycle, or external integration is introduced.
- Risk: normal-risk. `READY` is explicitly not provider acceptance and every real listing/approval operation remains high-risk/manual.
- Recovery: source, fixtures, decisions, CI and PR evidence are GitHub-owned; local build/test output is disposable.
