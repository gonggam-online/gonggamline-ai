# Decision log

## 2026-08-15 - Make current-source packet re-prepare the primary recovery path

- Procedure decision: operators no longer need to recover an older external
  adapter JSON export. They may create a new packet revision from the current
  authenticated WING observation and owner-controlled commerce approvals, then
  pass that revision through the existing adapter Export validation boundary.
- Binding decision: the revision must bind a new `packetId`, evidence
  `evaluationId` and `evaluatedAt`, source reference, content approval, and a
  separate live-write approval reference. The server rejects stale packet IDs,
  evaluation drift, and approval drift rather than mutating old history.
- Privacy/durability decision: the re-prepare endpoint is authenticated,
  no-store, and non-persistent. Full packets remain disposable confidential
  transfer artifacts; the external adapter/WING source or an approved remote
  handoff remains authoritative. No private packet is written to Git, logs, or
  a local durable file.
- Scope decision: this is product-agnostic and does not reconstruct facts,
  private shipping codes, rights, assets, or approvals. Missing exact values
  still produce a validation failure; WING submission, paid generation, and
  publication remain separate gates.
- Risk/authority: high-risk/manual because the packet can contain private
  commerce fields and approval references. Code/fixture/Preview validation may
  proceed; Production packet generation still requires the authenticated owner
  boundary.

## 2026-08-14 - Implement private Listing creative operator runtime

- Runtime decision: implement the accepted S3-16 two-phase boundary as a
  product-agnostic PREPARE mutation, explicit bounded paid-dispatch mutation,
  and protected read/re-sign endpoint. Every successful dispatch stops at
  private `REVIEW_REQUIRED`; there is no human PASS, candidate selection,
  content approval, public publication, mapper call, live-write approval, or
  Coupang/WING call.
- Durable-state decision: Supabase private Storage owns immutable prepared,
  authorization, whole-plan, five-minute distributed global-slot, failure, and
  review-handoff manifests. Signed URLs are disposable projections and can be
  reissued from the private handoff. Vercel Blob is not composed for private
  rendering.
- Fact/privacy decision: only allowlisted `PROVEN` visible-product fact values
  enter fact-only prompts. Fact IDs remain evidence bindings but are excluded
  from prompt text. URL/path, contact, secret-like, private-marker, supplier
  account, raw provider, registration payload, base64, and private object
  references are excluded from API responses.
- Billing observation: newer owner-supplied authenticated evidence verifies a
  stored payment method and shows the final Pro upgrade checkout, but also
  shows `Pro Trial` and an unexecuted `Upgrade` action. Paid Pro activation is
  therefore not yet proven. No billing identifier or payment detail is stored.
- Risk/authority: high-risk/manual implementation. Code and fake CI may proceed;
  the first Production provider dispatch, Pro subscription charge, public
  publication, and commerce write each remain distinct manual gates.

## 2026-08-14 - Accept operator dispatch and correct Vercel billing state

- Architecture acceptance: repository owner squash-merged PR #137 as
  `bf007382f9325d64aebd0ab9675fe4eae60216d5`, authorizing the separately
  reviewable S3-16 implementation. This merge did not call a provider, publish
  an asset, or write Coupang/WING.
- Production evidence: `origin/main` matches the merge commit; Vercel Production
  deployment `5907391571` completed successfully and browser smoke run
  `31807000133` passed 44/44 checks. Evidence artifact `9221619734` has SHA-256
  `0e2d3c2100f9907889c3ee0a78113a841d196250e1423f6fb100979f0f56925d`.
- Billing correction: initial owner-supplied evidence showed `Hobby Plan` /
  `Active`. Later authenticated evidence verifies a payment method and displays
  a Pro-trial/final-upgrade checkout, but does not prove that the final paid
  upgrade action completed.
- Official applicability: Blob is available within Hobby's included limits, but
  Hobby has no paid overage and is described by Vercel as personal,
  non-commercial use. Commercial Vercel Blob publication therefore remains
  blocked pending Pro activation or a separately accepted commercial store;
  private Supabase archive/review remains allowed. Separate Vercel AI Gateway
  credit does not prove Blob or OpenAI Image API billing authority.
- Privacy/authority: only non-sensitive status was recorded. No card details,
  billing contact/address/tax data, payment, plan change, add-on, budget, public
  object, provider call, or marketplace write occurred.

## 2026-08-14 - Propose authenticated Listing creative operator dispatch

- Finding: the merged provider, actual-byte QA, private archive, and handoff
  services have no compliant Production call site. Vercel correctly prevents
  local export of Sensitive `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`,
  while the accepted v1 contract rejects a general-purpose generation route.
- Proposal: authorize a product-agnostic two-phase admin mutation. PREPARE makes
  no paid call and persists the server-computed plan; AUTHORIZE_AND_DISPATCH
  requires fresh AAL2, exact origin, purpose-bound CSRF, current snapshots, and
  a create-only Supabase-private authorization and whole-plan reservation before
  the first provider call.
- Safety: the single bounded call stops at private `REVIEW_REQUIRED`. It cannot
  auto-pass human review, select/publish/map content, create live-write approval,
  or call Coupang/WING. CI/Preview remain fake-only; concurrent, scheduled,
  unattended, bulk, or multi-operator dispatch remains blocked on S3-12.
- External observation: OpenAI funding and Production Sensitive variables are
  present. The active Vercel team shows Hobby rather than Pro; commercial public
  Blob delivery remains a later configuration gate and is not needed for
  private generation/archive.
- Authority/risk: proposed Architecture amendment, high-risk/manual. Manual
  merge accepts only the contract; the implementation and first paid Production
  run each retain their exact documented gate. No external write occurs here.
- Rollback: do not compose the route; revert the amendment. Any later failed or
  partial output remains quarantined in the private store for reconciliation.

## 2026-08-14 - Prefer Production-scoped Vercel Blob OIDC

- External result: authenticated rollout created private Supabase bucket
  `listing-creative-private-v1` with approved limits/default deny and public
  Vercel Blob mirror `listing-creative-public-v1` in Seoul (`ICN1`). No product
  asset, paid provider call, public listing asset, or WING write occurred.
- Authentication decision: use Vercel Blob's 2026-06-01 OIDC default and the
  pinned `@vercel/blob@2.8.0` support. Production Functions receive short-lived,
  automatically rotating credentials; the non-secret `BLOB_STORE_ID` selects
  the store. A legacy read-write token is fallback only when OIDC is unavailable.
- Environment decision: `BLOB_STORE_ID` and webhook public key may be visible in
  Preview as connection metadata, but storage composition rejects every
  non-Production `VERCEL_ENV`. No OIDC or legacy write credential is copied to a
  client, Preview configuration, log, screenshot, packet, or Git.
- Operations: Vercel billing continuity remains unverified because the trial is
  expired and no payment data was entered. OpenAI project/key/budget and the
  bounded paid smoke remain separate gates. Live commerce approval is unchanged.
- Evidence: official Vercel OIDC announcement observed 2026-08-14:
  https://vercel.com/changelog/vercel-blob-now-supports-oidc-authentication .
  Limitation: automatic request-context authentication applies to Vercel-hosted
  functions; external runtimes require a separately governed credential path.
- Risk/rollback: high-risk rollout and credential-boundary correction. Disable
  dispatch, disconnect the store, remove public mirrors, and revert the adapter;
  preserve private masters and approval evidence for reconciliation.

## 2026-08-14 - Bind actual Listing image bytes, human QA, approval, publication and mapper

- Decision: implement the accepted managed-creative step 3 as a product-agnostic
  bridge. A provider response now retains transient bytes long enough to validate
  full PNG chunk order/CRC/IDAT/IEND and bounded dimensions, archive the exact
  digest privately, and enter `REVIEW_READY`; provider success alone remains
  nondeployable.
- Product-truth decision: a digest-bound human review must pass identity, color,
  quantity, dimensions/scale, material, components, selected option, prohibited
  marks, unsupported claims, crop, encoding and load for every selected asset.
  One failed or unresolved check prevents content approval and publication.
- Approval decision: canonical content approval binds the selected candidate,
  artifact bytes, human reviews, provider executions and terms, evidence,
  category, policy, title, keywords, filters, detail package, recipes and
  revision. Storage recomputes that digest; the registration mapper accepts only
  the selected set's verified public HTTPS references and never a private,
  signed, data, fixture or unselected reference.
- Compatibility: this slice introduces no public route, database, migration,
  Queue or unattended lifecycle. `legacy listing_drafts` remains ineligible;
  durable concurrent job/approval state still requires the separate S3-12
  Database/Auth/RLS Story. Live-write approval remains independent.
- External state: Vercel has no Blob store/token and its trial is expired;
  Supabase and OpenAI Platform are signed out and no OpenAI Production key/budget
  is verified. No bucket, billing, secret, paid call, public object, Production
  mutation or WING write is performed by this implementation.
- Risk/rollback: high-risk/manual. Revert the QA/approval bridge; stop dispatch,
  remove any later public mirrors and invalidate dependent approvals before
  reverting a configured runtime.

## 2026-08-14 - Implement the pinned Listing Image API boundary

- Decision: implement the accepted S3-11 provider slice with the official OpenAI
  TypeScript SDK pinned to `7.4.0`, Image API model
  `gpt-image-2-2026-04-21`, an injected fake transport for tests, deterministic
  prompt/request digests, and no public route.
- Spend decision: use the 2026-08-14 official standard cost snapshot for the
  three initially priced sizes, conservatively estimate text bytes and explicit
  edit-image tokens, stop above USD 2/revision, six output jobs, or two attempts
  per immutable job, require a successful managed private-storage reservation
  keyed by the exact request hash before transport, and disable SDK retries.
- Rights/truth decision: fact-only jobs send no pixels. Edit/reference jobs still
  require exact private bytes, verified provider-upload plus requested operation
  rights, and a positive input-cost estimate. Provider output remains
  nondeployable until managed archive and later actual-byte/human QA complete.
- External result: PR #132 Production is healthy, but Supabase is not logged in;
  current Vercel Blob creation requires a permanent region and adds variables to
  Production and Preview, conflicting with the accepted Production-only write
  secret, while the trial is expired. No store, payment, secret, or paid API call
  is performed by this implementation PR.
- Risk/rollback: high-risk/manual. Remove the provider composition/revoke any
  later key to roll back. Provider spend and external configuration retain exact
  post-merge operator gates.

## 2026-08-14 - Accept managed creative storage and provider Architecture

- Owner decision: manually merge PR #131 as
  `4fd227193314c14cd096d73e46f97a340f4bd9d0`, accepting the generic managed
  private-master/public-mirror and bounded image-provider Architecture.
- Implementation sequence: first implement storage/CDN ports, immutable digest
  addressing, deterministic fakes, takedown, and restore; then separately add
  provider/spend/rights guards, QA/UI/approval, durable DB/Auth/RLS state, one
  product acceptance run, and an independently approved commerce write.
- Risk boundary: each implementation PR remains high-risk/manual. The merged
  Architecture does not itself create a bucket/store, write a secret, spend
  provider funds, publish an object, mutate Production, or submit to WING.
- Cloud-first decision: Supabase private Storage is the authoritative master and
  Vercel Blob is a reconstructable public mirror. Local assets and fixture bytes
  are disposable and never become registration evidence.

## 2026-08-14 - Propose managed creative storage and pinned image provider

- Owner decision: approve an Architecture boundary for a managed object store/
  CDN, image provider/model/terms, paid limit, server secret, and commercial-use
  review. Manual merge of the exact Story is still required before external or
  code implementation.
- Storage decision: use the existing managed Supabase project as the private,
  recoverable master/evidence store and Vercel Blob as a replaceable public CDN
  mirror for selected approved outputs only. Content-address every artifact,
  prohibit overwrite, and restore public assets from the private digest.
- Provider decision: use OpenAI Image API with
  `gpt-image-2-2026-04-21`; cap a product revision at USD 2, six outputs, and two
  attempts, with a USD 50 monthly project budget and stop-before-spend checks.
- Security decision: `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
  `BLOB_READ_WRITE_TOKEN` are server-only. Real paid calls are Production
  operator actions; CI and Preview use deterministic fakes.
- Rights/output decision: provider terms can establish the provider/customer
  allocation only. They never grant missing third-party input rights or prove
  product accuracy. Unknown provider-upload/reference rights reject that job;
  an eligible unchanged original may still support minimum registration.
- Current stop: no Supabase bucket, Vercel Blob store/token, or authenticated
  OpenAI project/key/budget is verified. Architecture documentation does not
  mutate those systems or claim a deployable KK946 artifact.
- Cloud-first/rollback: Supabase owns private masters, Vercel owns replaceable
  public mirrors, GitHub owns source/contracts. Stop dispatch, revoke keys,
  remove mirrors, invalidate approvals, preserve governed evidence, and revert.

## 2026-08-14 - Accept creative Architecture and implement actual-byte fixture boundary

- Owner approval: PR #127 was manually merged as commit
  `b463028a9d79ca44a863475c2ad8df99bb37f53a`; ordered Architecture steps 1-4
  are now implementation-authorized.
- Implementation decision: use product-agnostic v3 render jobs, two candidate
  sets, a deterministic raster PNG fixture provider, artifact-byte SHA-256 and
  decoded dimension/MIME QA, explicit `FIXTURE_ONLY` deployability, and a mapper
  that rejects fixture or digest-mismatched approval packets.
- KK946 decision: reintegrate PR #126's external adapter/unchanged supplier
  packet on current main, excluding its unrelated orchestrator shutdown change.
  The minimum packet can remain registration-ready while fixture creative output
  remains nondeployable and conversion optimization stays pending.
- External boundary: a real image provider still lacks an approved model/terms,
  paid cap, server-only secret and managed object store/CDN. No provider call,
  web-image download, asset upload, persistent approval, Production mutation or
  WING/Coupang submission is performed by this implementation.
- Cloud-first/rollback: GitHub owns code, synthetic fixtures, PR and CI evidence;
  in-memory/test raster output is disposable. Revert the implementation commits
  to roll back; no operational asset or external state exists to reconcile.


## 2026-08-14 - Propose generic rights-cleared creative optimization

- Decision proposal: after minimum registration fitness, run creative baseline
  evaluation for every selected/procurement-approved product and produce at
  least two digest-bound image/detail candidates; optional video remains out of
  the Coupang payload until exact channel support is proven.
- Rights decision: maximize each expressly verified supplier/licence/ownership
  capability. Preserve automatic unchanged supplier use, but do not treat public
  access, silence, same-product identity, or internal risk acceptance as a
  reproduction/edit/provider-upload/generative-reference grant. Competitor and
  arbitrary web pixels are observation-only.
- Truthfulness decision: prompt, outline, fixture, caller-provided QA, or simple
  upscale is not a rendered deployable asset. QA is computed from artifact bytes
  and the selected candidate alone enters the mapper after digest-bound content
  approval; live-write approval remains separate.
- Architecture boundary: this PR approves no implementation or external action.
  Pure contracts/planner/fake renderer/review UI may follow only after manual
  Architecture merge. Real provider/paid/secret, managed object storage/CDN,
  Database/Auth/RLS, and live registration each require separate high-risk
  Architecture and manual PRs.
- Cloud-first/rollback: GitHub owns this decision and CI evidence; local output
  is temporary. Operational assets and state have no approved durable owner yet.
  Roll back with Git revert.

## 2026-08-14 - Separate external asset discovery from publication rights

- Owner decision: accept External Commerce Asset Discovery and Rights Policy v1.1 through delegated task 12D.
- Canonical policy SHA-256: `cb06faeb826d3fc3e51c12b4faf5d3c9123d1258670f253b242671fcfd6921c0`.
- Revenue decision: allow bounded lawful discovery/indexing of supplier, manufacturer, wholesale, and public references so `UNKNOWN` rights do not stop product facts, titles, keywords, stories, or alternative-source work.
- Rights decision: public visibility, wholesale listing, purchase, URL, or file possession is not a reproduction/edit license. Exact use and each edit operation require scoped verifiable evidence.
- Fast path: exact platform reseller grant, supplier/manufacturer permission, contract/message, or file metadata can admit the bound original and only expressly allowed operations.
- Safety: no access-control bypass, watermark removal, source laundering, unauthorized people/personal data/third-party marks or characters, forged evidence, or ignored takedown/revocation.
- Cloud-first: GitHub stores policy only. Operational references, grants, digests, manifests, approvals, sensitive documents, and binaries wait for an approved encrypted remote evidence boundary; no local-only asset archive.
- Authority/risk: normal-risk docs-only. No crawling, download, upload, paid generation, external integration, database/queue, Production, or commerce write is authorized. Later implementation is separately reviewed.
- Rollback: Git revert; published-asset impact, if any later exists, requires digest-based takedown reconciliation rather than repository rollback alone.

## 2026-08-13 - Separate minimum Listing registration fitness from conversion optimization

- Owner amendment: an active versioned supplier trust profile automatically
  admits facts within its capability. Verified unchanged image reuse does not
  imply edit or generative-reference rights; unsupported derivatives are
  excluded without blocking a payload that uses the verified original.
- Registration decision: `REGISTRATION_BLOCKED` is limited to required-field
  absence, unresolved purchase-critical conflict, prohibited/unlicensed/false
  selected content, exact category/schema/payload failure, or missing live-write
  approval. Every blocker carries one stable owner-approved blocker class.
- Conversion decision: optimize qualified purchase conversion and actual
  attributable profit while constraining cancellations, returns/refunds,
  customer misunderstanding, and policy violations. CTR/CVR alone never
  declares a winner.
- Evidence order: current Coupang official policy, fresh pattern-only public
  category observations, commerce UX research, then seller/category/product
  actual metrics. Competitor text and images are never copied.
- Experiment boundary: one human-approved variant enters a payload. Parallel
  duplicate listings are prohibited; a sequential revision requires separate
  approval, sufficient traffic, profit/return/cancellation guardrails, and a
  rollback revision.
- Durable-state boundary: this PR provides pure contracts/evaluation only.
  Append-only runtime persistence remains a separate Database/Auth/RLS Story
  and `legacy listing_drafts` cannot be cast to registration-ready.
- Risk/rollback: high-risk/manual; no marketplace, provider, database,
  Production, configuration, secret, paid, price, stock, ad, or order write is
  authorized. Roll back through Git before any live adoption.

## 2026-08-13 - Close the KK946 Gaemi inquiry without inventing exact costs

- Final provider evidence: Gaemi cannot inspect the current WING account or
  guarantee that the supplied private logistics values will be accepted there.
  It cannot pre-confirm package class or final outbound/return debit; the exact
  values become available only in the point ledger after each operation.
- Return decision: check WING for Coupang pickup status first. If the item is
  returned to Gaemi, use the matching existing order's return/exchange
  application. Do not claim a universal automatic or manual pickup mode.
- Fee decision: Gaemi did not recommend WING initial-return/return values or an
  exact Jeju versus non-Jeju-island split. Preserve the confirmed regional
  `3,000-5,000 KRW` surcharge range only as planning evidence and require the
  owner to choose the exact WING fields under Coupang policy.
- Consequence: the provider follow-up is complete, but the WING logistics write
  and listing remain blocked by account acceptance, owner fee choices, product
  compliance facts, and rights-cleared assets. No further provider inquiry is
  authorized for this packet.
- Risk/rollback: high-risk/manual. No new external write occurred while reading
  the reply; repository changes can be reverted normally.

## 2026-08-12 - Use Gaemi account facts before WING logistics creation

- Provider reply: CJ Logistics is confirmed for B2C/WING; private WING
  logistics values were supplied at source; no extra return-recipient text is
  required; Jeju/island delivery has a `3,000-5,000 KRW` surcharge range; and
  marketplace returns/outbounds use the general order/outbound path.
- Incomplete reply decision: keep exact VAT-inclusive outbound/return debit,
  CJ collection responsibility, required return fields, WING-use authority,
  and recommended WING charge inputs fail-closed. Submit one bounded follow-up
  on the same thread and create no new inquiry.
- Evidence: the account identifies CJ Logistics as its normal return carrier
  and provides an order-bound return form, but not the final account-applied
  debit or exact WING recipient label.
- Decision: keep seller-fulfilled B2C distinct from Rocket Growth; wait for the
  same categorized provider thread to close the remaining fields before
  creating WING address records.
- External write: owner-authorized informational request and one follow-up on
  that same thread only. One duplicate was marked to ignore and closed. No
  order, shipment, return, listing, paid, API/configuration,
  database, or Production write was authorized or performed.
- Risk/rollback: high-risk/manual. Provider messages are durable at Gaemi and
  cannot be rolled back; Git evidence can be reverted normally.

## 2026-08-12 - Keep KK946 execution blocked on external facts after PR #123

- Read-only evidence: six Gaemi units and sufficient base-outbound balance are
  available, but the Gaemi Coupang API is disconnected and automatic order
  collection is disabled.
- Decision: allow a clearly labelled manual first-order fallback for the bounded
  six-unit experiment; do not describe it as automated fulfillment. API secret
  configuration requires separate exact approval and provider-UI entry.
- Compliance: keep the listing adult/general-use only. Supplier catalog claims
  do not close importer identity, physical textile marking, image suitability,
  or seller-private A/S evidence.
- Logistics: the verified inbound center is not automatically an authorized
  WING return identity. Provider return routing and fees require confirmation.
- Risk/rollback: high-risk/manual evidence update. No external write occurred;
  repository rollback is Git revert.

## 2026-08-12 - Prepare a six-unit KK946 E2E liquidation exception

- Decision: preserve KK946's failed ordinary v3 pre-purchase gate and prohibit
  reorder, while preparing a separately approved liquidation experiment using
  only the six units already held at Gaemi.
- Exact scope: Coupang catalog product `9681483612` black, one unit per offer,
  stock/orders capped at six, normal/sale price `4,290 KRW`, free shipping, no
  ads/coupons/automatic repricing/Rocket Growth, 14-day maximum exposure, and
  `30,000 KRW` actual attributable loss cap.
- Read-only result: WING exposes the catalog path and two required purchase
  options but its address book has zero records. Creating the outbound/return
  records and registering the offer are high-risk external writes that remain
  unauthorized.
- Fail-closed facts: do not use the account representative-address default,
  competitor images, synthetic look-alike images, guessed importer/certification
  data, a warehouse label as a barcode, or a public breadcrumb as an API
  category code.
- Cloud-first: GitHub owns only sanitized contract/test/PR/CI evidence; provider
  systems retain all private address, contact, asset, transaction, return, and
  settlement evidence. Local browser state is temporary and unsaved.
- Risk/rollback: high-risk/manual with `manual-merge-required`. Repository
  rollback is Git revert; any later live rollback must pause offer exposure
  without cancelling paid orders or deleting provider evidence.

## 2026-08-08 - Keep KK946 quarantined pending exact evidence binding

- Dependency: accepted Listing Content Fact and Policy Contract v1 and merged
  Coupang preflight/evidence PRs #110-#112.
- Decision: complete Story 1 as a read-only acquisition runbook and sanitized
  status contract. Every real KK946 identity, transaction, lot, inspection,
  documentary, rights, category, and logistics binding remains `UNKNOWN`.
- Data boundary: do not copy raw invoices, supplier messages, 3PL photos,
  personal data, or rights documents into Git, Codex chat, OneDrive, or a new
  local folder. Leave them in authoritative source systems until a confidential
  evidence/asset store is separately approved.
- Revenue consequence: the runbook makes the shortest owner actions explicit
  without manufacturing listing readiness. Quarantine cannot be released by
  the runbook or synthetic fixtures.
- Risk/rollback: normal-risk documentation/tests; Git revert only and no
  external rollback.

## 2026-08-08 - Implement accepted Coupang read-only preflight evidence

- Approval: repository owner explicitly authorized the Architecture Story;
  PR #111 was merged before implementation began.
- Decision: add exactly the fixed category, outbound, and return-center GET
  readers, strict minimal decoders, canonical fingerprints, and pure KK946
  evidence mapping described by the accepted Story.
- Privacy: return source provenance uses a `{vendorId}` template; normalized
  results exclude raw vendor identity, contacts, addresses, fees, courier
  data, provider messages, and raw response bodies.
- Failure boundary: missing configuration, transport/provider failure,
  malformed response, conflict, absence, and bounded exhaustion remain
  distinct; no failure triggers a retry, product assertion, or write.
- Cloud-first: GitHub owns source/tests/decision/CI evidence. Provider data is
  request-memory only and the implementation has no public or Production
  caller.
- Risk/rollback: normal-risk additive unused internal code; rollback is a Git
  revert with no external or database action.

## 2026-08-08 — Propose bounded Coupang read-only preflight evidence

- Dependency: accepted Coupang audit and merged PR #110 pure Marketplace preflight.
- Proposal: use the existing server HMAC boundary for exactly category metadata, outbound-code, and return-code GET reads; normalize only selected codes, usability/existence, source, observation time, and fingerprints.
- Privacy: never retain or expose raw responses, addresses, phone numbers, fees, credentials, vendor IDs, Wing identities, or provider messages.
- Failure: configuration/provider unavailability means evidence is `INCOMPLETE`, never that KK946 is invalid. Unknown shapes and contradictory identities fail closed.
- Cloud-first: GitHub owns source/approval/CI evidence; runtime evidence is request-memory only and reacquired. No local or database durable state.
- Status: proposed. Implementation and live evidence reads are not authorized until the repository owner accepts this Story.

## 2026-08-08 — Separate Coupang Product Creation intent from Listing drafts

- Dependency: owner-approved Coupang Seller Product Contract Audit v1 and Listing Content Fact and Policy Contract v1.
- Decision: a Listing marketing draft is never a Coupang Product Creation request. The first supported intent is an immutable Marketplace-only contract evaluated by a pure local preflight.
- Fail-closed boundary: Rocket Growth/Hybrid, `requested: true`, mismatched or stale evidence, placeholder assets, duplicate SKUs/options, and unmet category requirements cannot produce `READY`.
- `READY` means only that supplied local evidence satisfies the captured contract. It never proves Coupang acceptance and performs no call.
- Durable state: GitHub owns source, tests, decision and delivery evidence. No runtime state, credential, provider response, or local-only durable state is introduced.
- Risk/exclusions: normal-risk pure contract and tests; no API, database, Auth/RLS, environment, Production, pricing, or marketplace write.

## 2026-08-08 — Separate Coupang Product Creation intent from Listing drafts

- Dependency: owner-approved Coupang Seller Product Contract Audit v1 and Listing Content Fact and Policy Contract v1.
- Decision: a Listing marketing draft is never a Coupang Product Creation request. The first supported intent is an immutable Marketplace-only contract evaluated by a pure local preflight.
- Fail-closed boundary: Rocket Growth/Hybrid, `requested: true`, mismatched or stale evidence, placeholder assets, duplicate SKUs/options, and unmet category requirements cannot produce `READY`.
- `READY` means only that supplied local evidence satisfies the captured contract. It never proves Coupang acceptance and performs no call.
- Durable state: GitHub owns source, tests, decision and delivery evidence. No runtime state, credential, provider response, or local-only durable state is introduced.
- Risk/exclusions: normal-risk pure contract and tests; no API, database, Auth/RLS, environment, Production, pricing, or marketplace write.

## 2026-08-08 — Prepare but do not auto-merge the AWS backup worker

- Decision: the deployable worker may be kept merge-ready on PR #105 after
  latest-main reconciliation and complete CI/Preview verification.
- Safety: credentials are resolved only from Secrets Manager; the scheduler,
  Production export, resource deployment, and first archive remain disabled or
  separately approval-gated.
- Risk: high-risk/manual with `manual-merge-required`; repository automation
  must not merge it even when every technical check passes.

## 2026-08-08 — Bridge only the validated category contract into Listing evidence

- Dependency: owner-approved Architecture PR #107 and merged implementation
  PR #108.
- Decision: a validated category snapshot may create exactly one proven,
  catalog-item-scoped `coupangCategoryContract` fact. It may not create product
  attribute, certification, document, or notice facts.
- Fail-closed conditions: quarantined snapshot, absent notice selection,
  malformed digest or identity, invalid time ordering, and snapshot age beyond
  seven days all produce no evidence fact.
- Durable state: GitHub owns source, tests, review evidence, and recovery. No
  new local-only or runtime durable state is introduced.
- Risk and exclusions: normal-risk additive pure code; no API/database/Auth/RLS,
  environment, secret, Production, external call, paid action, or commerce
  mutation authority.

## 2026-08-08 — Listing category snapshots fail closed before integration

- The mapper accepts only bounded known collections and enums, digests the
  complete JSON response canonically, and quarantines malformed, stale,
  invalid-category, unknown-enum, or notice-selection mismatches.
- `NOT_REQUIRED` remains a provider option, never an admitted product fact.
- The validity endpoint is added as a read-only adapter only; no live smoke or
  runtime consumer is enabled in this implementation.

## 2026-08-08 — Category metadata and validity remain separate evidence

- Decision: a successful category-metadata response never proves current
  category validity. Listing admission requires a typed metadata snapshot and
  a separately digested validity result.
- Compatibility: preserve the current public route shape; validate behind the
  adapter boundary and fail closed on malformed or stale data.
- Safety: provider certification options and notice choices are not automatic
  product facts. Persistence and live provider verification remain separate.

## 2026-08-08 — Category metadata and validity remain separate evidence

- Decision: a successful category-metadata response never proves current
  category validity. Listing admission requires a typed metadata snapshot and
  a separately digested validity result.
- Compatibility: preserve the current public route shape; validate behind the
  adapter boundary and fail closed on malformed or stale data.
- Safety: provider certification options and notice choices are not automatic
  product facts. Persistence and live provider verification remain separate.

## 2026-08-06 — AWS disabled-worker change-set review target fixed

- Category: high-risk/manual CloudFormation review preparation; no external
  AWS action or resource provisioning.
- Dependency: PR #102 merged as
  `50cce601e2e1085a001ca3feaff6760d13c07ff0`; its Production browser smoke
  passed 42 tests with two intentional skips.
- Decision: fix the first target as stack
  `gonggamline-independent-backup-v1`, change set
  `base-boundary-review-v1`, type `CREATE`, region `ap-southeast-1`, template
  SHA-256 `86cf98974aacee218b57ec4c66697393b4e9d932f589d95ef4f3a202bad9460b`,
  `EnableWorkerResources=false`, empty worker image/Production secret defaults,
  and `CAPABILITY_NAMED_IAM`.
- Expected boundary: exactly six base resources may appear as `Add`; all eight
  worker-conditioned resources must be absent. The KMS key, S3 bucket, ECR
  repository, and SQS queue are retained resources if later executed.
- Identity gate: do not use root or long-lived access keys. AWS CLI v2 plus a
  temporary/federated administrative session with MFA is required. The current
  workstation has no AWS CLI and its available console session is signed out,
  so no AWS operation was attempted.
- Authorization: repository review only. Creating the no-execute change set,
  executing it, provisioning paid resources, Production export, restore,
  scheduling, and local-backup deletion remain separate approvals.
- Rollback: revert this repository packet before AWS action. An unexecuted
  change set, once separately approved and created, requires an exact metadata
  cleanup review; retained resources do not yet exist.

## 2026-08-06 — AWS synthetic complete-worker rehearsal succeeded

- Category: high-risk/manual backup-worker implementation and synthetic
  capacity evidence; no external or Production action.
- Dependency: PR #101 merged as
  `434eccdf92815d6546d8839662f60884c0a59728` after the Production and public
  Singapore pricing gates passed.
- Execution: an internal Docker network with no host port and a disposable
  PostgreSQL 17.6 data directory generated a 6,351,131-byte custom archive.
  The complete worker performed offline list inspection, SHA-256, immutable
  archive upload contract, manifest, SSE-KMS/version assertions, Object Lock
  retention read-back, and exact cleanup in 7.901 seconds.
- Capacity decision: the archive exceeded the required 1,430,142-byte 2x
  boundary. Peak ephemeral use was 6,351,837 bytes, leaving 10,731,066,403
  bytes below the 10-GiB ceiling and 892.099 seconds below the 900-second
  runtime ceiling including cleanup.
- Safety result: no Production or AWS connection, resource, credential, paid
  usage, restore, schedule, raw backup retention, host port, or durable local
  database was created. The container, network, archive, manifest, and
  simulated object bodies were removed.
- Decision: mark Lambda
  `ELIGIBLE_FOR_DISABLED_WORKER_CHANGE_SET_REVIEW_ONLY`. This authorizes only
  repository review of the next exact `EnableWorkerResources=false` change
  set. Provisioning, worker image/secret, Production export/upload, restore,
  schedule, and local-backup deletion retain separate approvals.
- Rollback: revert the pipeline and sanitized evidence before any AWS action;
  there is no external state to roll back.

## 2026-08-06 — AWS backup Production verification and cost gate complete

- Category: high-risk/manual Production verification and public pricing
  evidence; no provisioning.
- Dependency: PR #100 merged as
  `bb0e3715159cfe7f7d8c3bf049189f7e94c5918b`.
- Production evidence: the exact merged commit deployed successfully to
  `https://gonggamline-ai.vercel.app`; Product Ops rendered the Supabase
  live-data path with 151 products. Production browser smoke run
  `31055725712` passed pages, APIs, console, page-error, and failed-request
  assertions and retained artifact digest
  `sha256:dc187455eae7465f2c6d13f4c7c56876257e042ad929761cc60d1c764eb9de70`.
- Pricing decision: public On-Demand Singapore estimates are USD 2.22/month
  observed and USD 2.63/month at the accepted 2x stress boundary. Add a fixed
  USD 2.00 tax/rounding/log/transfer/retrieval uncertainty reserve; the binding
  assessment is USD 4.63/month with USD 5.37 remaining below the approved USD
  10 AWS-only ceiling.
- Conservative inputs: Lambda excludes free-tier discounts. EventBridge
  Scheduler and SQS use the Calculator's one-million minimum even though the
  planned volumes are 32 Scheduler calls and 100/200 SQS requests. CloudTrail
  data events remain excluded because they are not enabled.
- Decision: mark only the Calculator prerequisite complete. Lambda eligibility,
  disabled-worker change-set approval, provisioning, credentials, first
  Production export/upload, restore, schedule, and local deletion remain
  separately gated. No AWS resource or paid usage was created.
- Rollback: revert the evidence commit and refresh both public estimates if an
  input or price is found incorrect. Existing Production and AWS state are
  unchanged.

## 2026-08-05 — AWS current Production capacity measurement succeeded

- Category: high-risk/manual Production read; sanitized capacity evidence.
- Authority: the owner explicitly requested one new reliable AWS Production
  capacity measurement. The one-attempt authority was consumed exactly once.
- Execution: PostgreSQL 17.6 complete custom-format `pg_dump` over required TLS
  produced a 715,071-byte transient archive in 34.125 seconds. Offline
  `pg_restore --list` validation found 1,251 entries and zero warnings.
- Safety result: the archive, process-scoped credential, restricted temporary
  directory, and both containers were removed. Independent inspection found
  zero remaining artifacts/containers. No database mutation, row inspection,
  AWS resource, paid use, upload, restore, or schedule occurred.
- Postflight: Supabase Production remained `Healthy`; CPU 2%, disk 14%, RAM
  58%, 14/60 connections, and no Advisor issue.
- Decision: close the current dump-size/duration evidence gate and make the
  observed/2x public On-Demand AWS Pricing Calculator input ready. Keep Lambda
  eligibility undecided until a complete worker rehearsal. Provisioning,
  Production upload, restore, and schedule retain separate approval gates.
- Rollback: repository evidence can be reverted; there is no Production or AWS
  state to roll back because the measurement was read-only and transient.

## 2026-08-05 — AWS capacity retry result evidence unavailable

- Category: high-risk/manual Production read retry; execution-evidence failure.
- Authority: after confirming secure process-scoped credential injection, the
  owner approved exactly one retry of the AWS Production capacity measurement.
  That retry was executed once and the authority is consumed.
- Evidence: preflight passed for the exact Singapore Production target,
  PostgreSQL 17.6, TLS reachability, disk capacity, current provider backup, and
  healthy load. The execution transport did not preserve the final sanitized
  JSON, and no attached terminal or retained Docker exit event could recover
  it. Therefore success, archive size, duration, TOC count, warning count, and
  archive creation are unknown and must not be inferred.
- Safety result: zero matching temporary directories and zero measurement
  containers remain. No AWS provisioning, paid use, upload, restore, or
  schedule occurred; the measurement command was read-only. Supabase remained
  `Healthy` after the retry.
- Decision: keep capacity, Calculator, Lambda eligibility, provisioning, and
  upload blocked. No further retry is authorized. A new explicit one-attempt
  approval must require durable sanitized-result capture before cleanup.

## 2026-08-05 — AWS capacity measurement attempt failed closed

- Category: high-risk/manual Production read attempt; external configuration
  failure.
- Authority: the owner merged PR #96 and approved exactly `AWS 백업 Production
  용량 측정 v1 승인`. That single-attempt authority is consumed.
- Result: preflight passed, but PostgreSQL 17.6 stopped at database-password
  authentication before creating an archive. No automatic retry was made.
- Safety evidence: the restricted temporary directory, transient files,
  container tmpfs credential file, and container were removed. No database
  write, AWS operation, upload, restore, schedule, existing-backup access, or
  row inspection occurred. Supabase Production was healthy after the attempt.
- Decision: keep current capacity, Calculator, Lambda eligibility, provisioning,
  first export, and restore gates blocked. A correct process-scoped database
  credential and a new explicit one-attempt approval are both required.
- Rollback: no Production or AWS state was created to roll back; preserve the
  provider backups and this sanitized failure record.

## 2026-08-05 — AWS account recovery gate complete; capacity measurement proposed

- Category: high-risk/manual Production measurement approval preparation.
- Status: repository packet prepared only; Production access, transient dump,
  AWS Calculator estimate, provisioning, and paid use are not executed.
- Authority: owner-confirmed recovery contacts and a recovery method
  independent of this PC; one Root MFA device remains active. An additional
  Root MFA factor is optional and not a v1 gate.
- Decision: close only the AWS account recovery preflight. Use the exact
  `AWS-BACKUP-CAPACITY-MEASUREMENT-APPROVAL-V1.md` packet for a later bounded
  read-only current dump-size/duration measurement. The recorded 696,310-byte
  historical archive is reference-only and cannot satisfy the current gate.
- Cost gate: prepare observed and 2x-observed Singapore Calculator inputs, but
  leave every price and estimate URL null until measurement. Provisioning
  remains blocked by the USD 10/month ceiling and a separate exact change-set
  approval.
- Rollback: revert this repository packet. No Production or AWS state changed.

## 2026-08-05 — AWS independent backup infrastructure plan v1

- Category: high-risk/manual infrastructure implementation plan.
- Status: implemented in repository only; not provisioned; manual merge and
  all later AWS/Production gates remain required.
- Authority: accepted Architecture PR #91, policy PR #92, verified provider
  evidence PR #94, and the owner's sanitized AWS preflight confirmation.
- Decision: represent the Singapore KMS/S3 Object Lock/ECR/SQS boundary in
  CloudFormation, omit worker resources by default, and keep the conditional
  Scheduler disabled. No secret value, account identifier, backup content, or
  external operation is part of the Story.
- Permission correction: exclude `GetObjectAttributes` because AWS requires
  object-read permission (and KMS decrypt for SSE-KMS). The writer validates
  the upload response and Object Lock retention; a distinct restore role owns
  body verification in a later approved rehearsal.
- Open gates: sanitized archive size/duration, 900-second/10-GiB capacity
  margin, AWS Pricing Calculator
  estimate, exact disabled-worker change set, provisioning, worker image,
  secret/export identity, Production export, and two-cycle restore.
- Rollback: revert the repository plan before provisioning. Later retained or
  immutable AWS resources require an exact decommission plan, not ordinary
  deletion.

## 2026-08-05 — Proposed Encrypted Cloud Backup and Restore v1

- Category: proposed Architecture decision.
- Status: Draft only; repository-owner manual acceptance required.
- Owner: Database / Security.
- Proposal: retain verified Supabase provider backups and add an independent,
  owner-controlled AWS `ap-southeast-1` recovery boundary using private S3,
  versioning, Object Lock Governance, SSE-KMS, and a scheduled Lambda export
  worker. Raw Production backup bytes are prohibited from CI, Git, Vercel, and
  chat.
- Rationale: the recorded logical archive remains device-local, while
  Supabase's documented provider retention does not by itself prove the
  repository's 35-day daily plus 12-month monthly independent-retention target.
- Proposed gates: verify Supabase entitlement; approve AWS account/billing/MFA,
  Singapore residency, USD 10 monthly ceiling, retention, RPO <=24h/RTO <=8h,
  export identity, provisioning, first Production export, two-cycle restore,
  and later exact local deletion.
- Authority: this entry records a proposal, not approval. No external service,
  credential, Production operation, backup copy/restore/delete, paid use, or
  implementation is authorized.
- Rollback: revert the documentation PR. No external state is changed.
- Owner evidence: sanitized Production Dashboard screenshots supplied on
  2026-08-05 verify Free Plan, no scheduled backups or retained recovery point,
  PITR not enabled, and no restore-to-new-project entitlement. The unknown
  provider-backup gate is resolved as a confirmed gap. Supabase Pro daily
  backups are a separate paid decision; PITR is not part of the initial
  proposal. The USD 10 ceiling applies only to the independent AWS boundary.
- Owner policy decision: approved on 2026-08-05 — Supabase Pro daily backups
  with PITR excluded; AWS Singapore `ap-southeast-1`; USD 10/month AWS-only
  ceiling; daily 35-day and monthly 12-month retention; RPO <=24h; RTO <=8h.
  Current official Supabase pricing shows Pro from USD 25/month with seven-day
  daily backups and default Spend Cap availability. Actual checkout amount,
  payment method, plan transition, AWS account/billing/MFA, infrastructure,
  Production export, restore, deletion, and PR merge remain separate gates.
- Provider execution evidence: sanitized Dashboard screenshots supplied later
  on 2026-08-05 verify Pro active with seven physical daily backups spanning
  2026-07-29 through 2026-08-04 and visible restore actions. Spend Cap is
  enabled; PITR, Dedicated IPv4, and Custom Domain are disabled; no Log Drain
  is configured. This verifies the provider-native layer only. Storage object
  bodies and the independent 35-day/12-month AWS recovery boundary remain
  outside this evidence.

## 2026-08-05 — Cloud Portability Baseline

- Category: implementation decision
- Status: implemented for repository inventory and local readiness only
- Owner / approver: Engineering Operations / repository owner directive
- Decision: maintain `docs/cloud/cloud-state-manifest.json` as the
  machine-readable authority inventory and use `npm run cloud:readiness` to
  fail closed on missing new-PC prerequisites. Remote authorities and local
  migration blockers remain explicitly distinct.
- Safety boundary: the checker reads no secret values, database rows, cookies,
  Production data, or local backup contents. This decision provisions no
  service and moves/deletes no data.
- Consequences: source/task/deployment/data authorities are visible and three
  unresolved durable areas become ordered high-risk Stories: backups,
  Orchestrator ledger, and business assets.
- Rollback: revert the baseline commit. No external state is changed.

## 2026-08-05 — Cloud-first durable-state principle

- Category: operating and architecture principle
- Status: approved by repository owner on 2026-08-05
- Owner / approver: AI CTO / repository owner
- Context: GitHub, Vercel, Supabase, and CI provide partial cloud operation,
  while local backups, automation state, unpushed work, and device setup can
  remain unique dependencies.
- Decision: local PCs are replaceable execution clients. Apply
  `.ai/CLOUD_FIRST_POLICY.md` before every Story; each durable state requires an
  approved remote owner and recovery path. New local-only durable state stops
  implementation. Local checkout/cache/test/rehearsal state is temporary and
  requires cleanup.
- Safety boundary: cloud-first never authorizes uploading secrets, Production
  dumps, personal data, or sensitive business data to an unapproved service.
  Existing local-sensitive state remains until a separately approved encrypted
  migration and restore test succeeds.
- Consequences: Story/Task templates and Codex rules now require placement,
  classification, retention, recovery, and cross-PC evidence. Database, secret,
  backup, Production, object-storage, and automation-ledger moves remain
  separate high-risk/manual Stories.
- Rollback: revert this governance change. Reverting does not authorize local
  data loss or deletion of cloud/local evidence.

## 2026-08-05 — Listing content fact and policy Architecture acceptance

- Category: accepted normal-risk, documentation-only Listing Architecture
  decision.
- Proposal: preserve the existing Listing engine/service/schema boundaries but
  require evidence-linked title, keyword, image, detail-page, notice, and
  Coupang payload outputs with fail-closed quarantine.
- Evidence authority: there is no global supplier-first or 3PL-first rule.
  Catalog claims remain catalog claims, accepted transaction evidence owns the
  agreed transaction, scoped 3PL inspection owns physical observations, and
  documentary/regulated facts require the competent issuer or registry.
  Conflicts remain visible and block dependent claims. None grants image rights
  by implication.
- KK946 status: `UNKNOWN` and quarantined because the repository has no exact
  catalog, lot/inspection, rights, category, notice, or approved-asset packet.
- Owner decision: accepted on 2026-08-05 after correcting source authority,
  image-rights coverage, reuse of the existing category metadata boundary, and
  implementation order.
- Approved content SHA:
  `5b77af8baf39a769e8541b14fe52196b27fcde4f`.
- Authority boundary: ordered documentation and pure policy/test work may
  proceed within its own normal-risk Story. API/external-contract, schema,
  RLS/Auth, secret/configuration, paid image generation/editing/upload, price,
  Production, readiness approval, and marketplace writes remain separately
  exact-target gated.
- Story:
  [`LISTING-CONTENT-FACT-AND-POLICY-CONTRACT-V1.md`](../docs/architecture/LISTING-CONTENT-FACT-AND-POLICY-CONTRACT-V1.md).
- Rollback: revert the documentation PR; no external or persistent state was
  changed.

## 2026-08-04 — Sales learning closed-loop Architecture proposal

- Category: proposed high-risk/manual cross-domain Architecture Story.
- Proposal: correlate immutable external candidate and estimate snapshots with
  listing, order-line, settlement-line, cost, refund, and return evidence;
  calculate experiment-attributable actual net profit only from reconciled
  accounting-final facts.
- First experiment packet proposed for owner decision: one SKU/listing/account,
  10 paid order lines, 14 active days, KRW 300,000 total cash cap, KRW 50,000
  advertising cap, KRW 10,000 daily advertising cap, and KRW 100,000 realized
  plus committed attributable loss cap.
- Status: **not approved**. The repository owner must accept or amend the caps
  and later bind the exact SKU, account, price, stock/procurement, rights,
  privacy basis, operator, dates, and stop procedure.
- Authority boundary: no migration, DB/Auth/RLS, Production data, personal
  data, listing, price, ads, inventory, procurement, order, return, settlement,
  payment, paid call, or policy promotion is authorized.
- Story:
  [`SALES-LEARNING-CLOSED-LOOP-V1.md`](../docs/architecture/SALES-LEARNING-CLOSED-LOOP-V1.md).
- Rollback: revert the documentation PR; no external or persistent state was
  changed.


## 2026-08-04 — Phase 5 owner-sample review and structural correction

- Category: repository-owner SHADOW evidence decision; normal-risk test and
  policy-code correction.
- Decision: accept all 60 semantic `ownerDecision` labels after removing the
  fixture's prefilled `proposed` values.
- Evidence method: generate predictions with the real SHADOW reviewer and
  bounded admission-scope evaluator from explicit machine inputs, then compare
  those generated predictions with the independent owner labels.
- Result: 20/20/20 balanced labels, 15 adversarial cases, exact match and all
  outcome precision/recall 1.0, forbidden/unverified NEXT_TASK false positives
  0, dispatch/external writes 0.
- Boundary: this is not final-merge, Production, DB/Auth/RLS, commerce, secret,
  paid, destructive, or high-risk approval. Activation remains contingent on
  PR merge and exact delivery gates.
- Fixture SHA-256:
  `59DC29E92308DFE1F152862D640F9CA264F7DF015EB1EAB6F49EEBF2DE85FF42`.

## 2026-08-04 — Phase 5 caps approval and SHADOW evidence preparation

- Category: repository-owner bounded-autonomy policy input and normal-risk
  evidence implementation.
- Owner decision: repository `gonggam-online/gonggamline-ai`; per-task 100,000
  tokens and 120 minutes; daily task limit 1; paid cost KRW 0; expiry
  `2026-09-04T23:59:59+09:00`.
- Config binding: normalized expiry `2026-09-04T14:59:59.000Z`; SHA-256
  `cff71fde7dc8d096927fbd7445f97337cff292238446dd04b91e6cdf606cfebf`.
- Evidence decision: prepare 60 balanced cases and a hermetic no-external-write
  drill. Proposed case decisions are not owner labels until the owner reviews
  every case and approves the exact fixture hash.
- Incident result: duplicate task/action suppression, one-shot budget interrupt,
  synthetic owned-process recovery, and audit-chain verification pass locally;
  external writes and paid cost remain zero.
- Consequence: caps are approved, but automatic dispatch remains SHADOW pending
  owner label approval, evidence PR merge, and a later exact admission decision.
- Manual boundaries: DB/Auth/RLS/Production/commerce/secret/paid/destructive/
  high-risk/final merge remain unchanged.
- Rollback: revert the evidence/test/documentation PR; no external state exists.

## 2026-08-04 — Orchestrator limited-autonomy owner policy baseline

- Category: repository-owner autonomy policy decision.
- Status: accepted as the Phase 5 admission baseline; operational dispatch is
  not yet admitted because actual sample, numeric token/time/task caps, and
  successful incident-drill evidence remain absent.
- Owner / approver: repository owner via `OWNER_POLICY_UPDATE` on 2026-08-04.
- Decision: repeated normal-risk work may proceed automatically only inside a
  pre-approved policy. High-risk approval requests should bind the exact diff,
  target environment, applicable amount/quantity cap, rollback, and
  verification as one change set at the real authority/cost/data boundary.
- SHADOW baseline: 60 owner-labeled cases with 20 each for `NEXT_TASK`, `RETRY`,
  and `REPLAN`; at least 15 adversarial cases; `NEXT_TASK` precision >= 95% and
  recall >= 80%; `RETRY` precision >= 90% and recall >= 80%; `REPLAN`
  precision/recall >= 90%; exact match >= 85%; zero forbidden/unverified
  `NEXT_TASK` false positives, at most one general `NEXT_TASK` false positive,
  and zero dispatch/external writes.
- Allowed pre-Phase-5 candidate classes: documentation, tests, monitoring, and
  behavior-equivalent internal refactors. Ranking remains SHADOW-only at
  confidence-adjusted revenue 60, operator time 30, urgency 10; dependency-not-
  ready, forbidden scope, and invalid contract always produce `REPLAN`.
- Cost/delivery boundary: paid cost is KRW 0. Eligible automation stops at the
  policy-approved branch/commit/push/Draft PR and normal-risk delivery gates.
- Preserved manual boundaries: DB, Auth, RLS, Production, commerce, secrets,
  paid work, destructive actions, high-risk work, and final merge.
- Follow-up / admission blocker: approve actual owner-labeled sample results,
  numeric per-task token/wall-time and daily task caps, expiry/config hash, and
  evidence of a successful recovery/incident drill before dispatch activation.
- Rollback: revert the admission module and policy records; no runtime dispatch
  or external state exists from this decision.

## 2026-08-04 — Orchestrator Phase 4 SHADOW planner/reviewer implementation

- Category: approved Architecture implementation
- Story / PR: Orchestrator Phase 4 SHADOW planner/reviewer / PR #78
- Status: merged as `065959b42765d04f39c17815fb5a1f6f82dee53d`;
  exact CI/Preview/Production gates passed
- Owner / approver: Engineering Orchestration; repository-owner Architecture
  approval recorded by PR #41
- Context and evidence: Accepted Architecture authorizes verified context,
  value scoring, structured review outcomes, and owner-scored comparison in
  SHADOW. The existing Phase 1–4 code had no planner/reviewer implementation.
- Decision or issue: Add a pure deterministic boundary that emits only
  `NEXT_TASK`, `RETRY`, or `REPLAN`, always denies dispatch, rejects
  unverifiable context and forbidden scope, and measures precision/recall
  against owner labels.
- Consequences and risks: Recommendations have no task, GitHub, database,
  Production, or commerce effect. Test fixtures are not owner acceptance.
- Follow-up / due condition: owner defines and scores the offline sample and
  approves thresholds before any Phase 5 work.
- Rollback or supersession: revert the module, tests, export, report, changelog,
  and this entry. No persistent or external state is affected.

## 2026-08-01 — R3 network-namespace CLI sidecar transport

- Category: proposed high-risk Database/history transport amendment.
- Decision: preserve the database container's network `none` and zero published
  ports while attaching a one-shot pinned CLI sidecar with Docker network mode
  `container:<target>`. Use only loopback inside the shared namespace.
- Credential handling: host arguments contain no database URL or password. A
  current-user-only temporary pgpass file is copied into sidecar tmpfs and
  deleted in `finally`; CLI HOME is also tmpfs.
- Evidence: official CLI 2.110.0 artifact SHA-256
  `876f439e85d296bf095d906ca91cadeb5509d753b4d98ee823e5752d578ff92b`;
  Debian base digest `7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818`;
  verified local image ID
  `13d9fe6fb6790d29c4f816b6cc14ec9271dc91a35f395c4315ecd09df5002128`.
- Live validation: CLI reported `2.110.0` with network none/read-only/non-root
  controls. Two earlier images failed closed before DB connection due to musl
  incompatibility and missing OS user.
- Approval boundary: image build and offline version validation are complete;
  starting the DB and executing migration repair remain separately approved
  history mutations. Production is prohibited.
- Rollback: delete the local sidecar image. No database state was changed.


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
# 2026-08-11 - WING SQS Read-only Runner v1 approved

- Category: Architecture acceptance and bounded high-risk implementation
  authorization.
- Owner / approver: repository owner through explicit delegated directive
  dated 2026-08-11.
- Existing source: merged central Coupang runner PR #118, merge
  `95cc073e700e2ebe9e47c1545da14fc1e3e7899c`.
- Decision: extend the existing desktop runner with exact contract version
  `1.0.0`, message types `wing.read.request` / `wing.read.response`, source
  `picktil-discovery`, operations `connection_test`,
  `list_seller_products`, and `category_meta`, with explicit FIFO group and
  deduplication identifiers.
- Capability boundary: reject every create/update/delete/listing/price/order/
  inventory/return/settlement/payment or unknown operation before the WING
  adapter. Vendor ID and credentials never enter queue contracts.
- Cloud-first decision: persist no local automation ledger or provider
  response. AWS FIFO is the remote duplicate-suppression boundary. At-least-once
  delivery may repeat only a bounded read. A managed remote idempotency ledger
  requires a separate Architecture/cost decision.
- Runtime status at approval: AWS CLI/SSO configuration and WING credential
  availability were not present in the active desktop environment; no values
  were inspected or emitted. Queue URLs/ARNs and laptop role ARN remain pending
  from Picktil 09.
- Infrastructure ownership amendment: Picktil Discovery 09-cloud-platform
  Terraform is the sole SQS source of truth in `ap-northeast-2`. This repo
  consumes environment-provided URLs only; its legacy central-runner
  CloudFormation is not a deployment source for this Story.
- Risk/delivery: high-risk/manual; Draft PR, `manual-merge-required`, no
  auto-merge. No queue/IAM/secret/environment/scheduled-task/Production change
  or commerce write is authorized.
- Live-call gate: at most one final read-only `connection_test`, only after
  runtime identity, queue inputs, and desktop credentials are verified. All
  other tests use fakes.
- Rollback: Git revert and stop the worker after queued responses are
  reconciled.

## 2026-08-12 - Item Selection profitability fee basis v2

- Category: high-risk/manual financial-policy correction.
- Evidence: authenticated WING showed `10.5% (VAT 별도, 정률)` for the selected
  KK946 category; Coupang's published fee guidance states that the commission
  base is the customer's final purchase price.
- Decision: version the engine as
  `gonggamline-profitability-2026-08-12-v2` and calculate marketplace fees from
  the VAT-inclusive final selling price. Advertising and return-loss reserves
  continue to use VAT-exclusive net revenue.
- Consequence: the taxable-price fee understatement is removed. KK946 at
  `11,800 KRW` remains `RECOMMEND_ESTIMATED`, with `3,364 KRW` base and `2,560
  KRW` stress contribution; exact recommend threshold is `11,243 KRW`.
- Boundary: no Product Creation, price, stock, account logistics, Production,
  database, secret, paid action, or provider write is authorized.
- Delivery: `manual-merge-required`; no auto-merge or Production validation
  before explicit owner merge.
- Rollback: Git revert restores v1 calculation semantics.

## 2026-08-12 - Pre-purchase market-profitability gate v3

- Category: high-risk/manual financial and procurement-eligibility policy.
- Owner direction: validate profitability first and purchase only the minimum
  sample for products that pass; do not purchase first and justify afterward.
- Decision: version the engine as
  `gonggamline-profitability-2026-08-12-v3`. Purchase review requires a
  confirmed identical-product delivered price observed within seven days,
  equal unit counts, complete conservative economics at that market price,
  recommend-level base/stress thresholds, and requested quantity equal to the
  supplier MOQ.
- Fail-closed behavior: absent, stale, comparable-only, mismatched, or
  unconfirmed evidence is `INCOMPLETE`; below-threshold economics is `FAIL`.
  Neither state is purchase-eligible. A `PASS` is necessary evidence, not
  authority for an order, payment, provider, warehouse, or other commerce
  write.
- KK946 correction: the identical one-unit Coupang offer is `4,290 KRW`
  delivered. At that price the v3 engine reports approximately `-1,548 KRW`
  base and `-1,840 KRW` stress contribution, so KK946 is rejected for reorder
  and single-unit listing as-is. The prior `11,800 KRW` model remains only an
  infeasible economic requirement, not a target price.
- Boundary: pure engine, policy, tests, and sanitized Git evidence only. No
  database, Production, secret, provider, listing, price, stock, paid, or
  commerce write. Trusted persistence and enforcement in the legacy
  Procurement path require a separate high-risk Story; `sourcing_decisions`
  alone are not purchase authority.
- Delivery: `manual-merge-required`; no auto-merge.
- Rollback: Git revert restores v2 screening semantics, but does not authorize
  any purchase.
# 2026-08-13 — Listing minimum-fit and conversion owner amendment v1

- Owner decision: accept approved supplier trust profiles, allow verified
  unchanged source-image reuse without inferring edit rights, and limit
  registration blockers to actual required-field/conflict/rights-or-claim/
  payload-validation/live-approval failures.
- Conversion objective: qualified conversion plus attributable profit with
  cancellation/return/refund/policy guardrails; CTR/CVR alone cannot select a
  winner. Only separately approved sequential revisions are allowed absent an
  official Coupang parallel experiment capability.
- Architecture impact: amends the accepted Listing Content Fact and Policy
  Contract interpretation but preserves Listing ownership, exact category,
  evidence provenance, no-invention, legacy-draft quarantine, durable-state,
  and Seller live-write boundaries.
- Story: `docs/architecture/LISTING-CONTENT-CONVERSION-OWNER-AMENDMENT-V1.md`.
- Risk/rollback: high-risk/manual; no auto-merge, DB, provider, Production, or
  marketplace write. Git revert before live use.
# 2026-08-14 - Asset error isolation and pipeline continuity v1

- Category: Listing/asset policy amendment.
- Owner/approver: repository owner through delegated workroom 12E.
- Policy version/digest: `asset-error-isolation-v1` / `cb2c15f8973586df4dc7ae1d022568901beaf54822743e3c36b704fc7728ed1c` (SHA-256 of the canonical policy document).
- Dependency: External Commerce Asset Discovery and Rights Policy v1.1 digest `cb06faeb826d3fc3e51c12b4faf5d3c9123d1258670f253b242671fcfd6921c0`.
- Decision: default to item-scoped continuation, catch rights/permission failures at the item boundary, map 403/409 to explicit blocked/conflict states, return reconciled sanitized counts/outcomes, and continue valid assets plus independent content/alternative-source research.
- Non-bypass boundary: blocked assets never enter derivative/publication/upload lanes; `bypass_rights_check` is forbidden; 403/409 are not success; browser impersonation and header/cookie/session rotation are prohibited.
- Cloud-first: GitHub owns this policy and sanitized delivery evidence. Runtime status/evidence/audit has no approved remote owner, so no runtime code, database, Queue, crawler, storage, provider, Production, or marketplace write is authorized.
- Risk/rollback: normal-risk documentation only. Git revert; immutable operational audit would require reconciliation if a later implementation exists.
- Downstream: COORD and workrooms 15, 15C, 16B, 20, and 22 consume `asset-error-isolation-v1` and the 12D digest above.

# 2026-08-14 - Listing creative fact-materialized dispatch checkpoint

- Category: high-risk/manual Listing provider rollout under the accepted Managed
  Creative Asset and Image Provider v1 Story.
- Decision: provider prompts receive only an explicit allowlist of uniquely
  PROVEN fact values and fact IDs. Private/operational fields, supplier URLs,
  source digests, and supplier/competitor/web pixels are excluded from fact-only
  generation. Two candidates use exact provider-supported dimensions.
- Review boundary: external output is archived and actual-byte verified before a
  short-lived private review URL is issued. Generation never supplies human
  product-representation PASS, selected candidate, content approval, public
  publication, or live-write approval.
- External configuration evidence: OpenAI Pay-as-you-go USD 5 credit, auto-reload
  off, USD 50 enforced spend cap, and a restricted project key stored as the
  Sensitive Production-only Vercel variable `OPENAI_API_KEY`. No secret value is
  recorded in Git.
- Remaining gate: code PR manual merge and exact-head verification precede a
  bounded paid call; public Vercel Blob publication also requires billing
  continuity verification. WING remains a distinct commerce-write boundary.
- Rollback: stop dispatch, revoke the project key, remove the Vercel variable,
  revert the implementation PR, and preserve private manifest evidence according
  to the accepted retention boundary.

# 2026-08-15 - Owner-controlled Listing adapter export boundary

- Category: high-risk/manual Listing adapter and confidential commerce-data boundary.
- Decision: add an AAL2, exact-origin, CSRF-bound owner screen and server route that validates an external `{listingInput, commerce}` packet, evaluates registration readiness, and exposes a full Production export plus a separately redacted review export.
- The route does not persist packet values, create approvals, invoke a paid provider, publish assets, or submit WING. The external adapter/WING source remains authoritative and must create a new revision when the prior export is unavailable.
- Full export may contain private vendor, contact, address, and shipping-center fields and must remain inside the authenticated owner browser/approved remote handoff. Sanitized export is not valid Production input.
- Risk/rollback: high-risk/manual; remove the route/page and CSRF purpose or revert the PR. No database migration or new local durable state is introduced.

# 2026-08-15 - Owner live-write approval issuance v1

- Category: high-risk/manual commerce-write authorization and confidential
  packet boundary.
- Decision: add an authenticated owner-only issuance action to the re-prepare
  screen. It re-evaluates the current packet, requires the exact confirmation
  `APPROVE_WING_LIVE_WRITE`, computes a normalized packet target digest, and
  issues a server-created approval reference bound to that digest and revision.
- Durable state: sanitized approval manifests are create-only objects in the
  accepted Supabase private creative bucket. Raw packet commerce fields,
  supplier identifiers, addresses, phone numbers, secrets, and WING responses
  are not persisted. The object path and approval digest provide recovery and
  duplicate protection.
- Separation: issuance does not invoke OpenAI, publish assets, create content
  approval, map a registration payload, or submit WING. The returned reference
  is inserted into the packet only after owner confirmation and is consumed by
  the existing re-prepare gate.
- Risk/rollback: manual merge required; revert the route/page/service and
  revoke the CSRF purpose. No database migration or local durable state is
  introduced. A changed packet or revision requires a new approval.

# 2026-08-17 - Admin session continuity without MFA bypass

- Category: high-risk/manual authentication UX and paid-commerce boundary.
- Decision: add a server session-status endpoint that refreshes near-expiry
  Supabase sessions, exposes sanitized AAL/age/mutation-readiness state, and
  lets the operator UI poll before PREPARE or paid dispatch. The login screen
  also refreshes MFA status periodically and explains the re-authentication
  window.
- Trusted browser: an owner-controlled, HttpOnly preference cookie is allowed
  only as a notification preference. It never elevates AAL, bypasses MFA, or
  authorizes paid generation, WING writes, publication, or other mutations.
- Durable state: Supabase Auth remains the session source of truth; the
  preference cookie is non-authoritative and recoverable by re-login. No local
  durable state, auth metadata mutation, or MFA weakening is introduced.
- Risk/rollback: high-risk/manual; revert the session-status route, preference
  route, and UI changes. Production deployment and any auth configuration
  change require separate owner review.

# 2026-08-18 - Owner adapter packet recovery amendment

- Category: high-risk/manual confidential commerce-data persistence and
  recovery.
- Finding: the prior export boundary deliberately did not persist full
  packets, which made a stopped browser session require re-entry of the same
  WING/private values and prevented reliable automation recovery.
- Decision: after successful packet validation, persist the exact packet and
  readiness record as an immutable, digest-addressed JSON object in the
  approved Supabase private creative bucket. A protected recovery GET returns
  the packet only for an authenticated administrator and re-computes the
  packet digest before release. No list endpoint, local fallback, raw logging,
  Git export, provider call, WING write, or publication is introduced.
- Required configuration: Preview and Production each need the approved
  `SUPABASE_SERVICE_ROLE_KEY` in their Vercel environment. Missing storage
  configuration returns the stable
  `ADAPTER_PACKET_RECOVERY_STORAGE_UNAVAILABLE` error; it must not be hidden.
- Risk/rollback: manual merge required. Revert the persistence/recovery route
  and UI, then retain or remove the private objects according to the approved
  Supabase retention procedure. Secret values and packet contents remain out
  of chat, logs, and Git.

# 2026-08-18 - Address-based WING adapter logistics enrichment

- Category: high-risk/manual authenticated seller integration and confidential
  logistics-data boundary.
- Decision: add a protected owner adapter enrichment route that accepts the
  typed packet plus WING-observed outbound/return address selectors, resolves
  `outboundShippingPlaceCode` and `returnCenterCode` through the existing
  server-side Coupang GET-only evidence reader, and persists the resulting
  digest-bound packet in the approved Supabase private store.
- The browser session itself is never scraped or forwarded to the server.
  Raw Coupang responses, contact details, API credentials, and address
  selectors are transient; only the selected codes and sanitized evidence
  provenance are retained in the packet. Ambiguous, stale, unavailable, or
  unauthorized provider results fail closed and never guess a code.
- The route does not submit WING, issue live-write approval, call OpenAI, or
  publish assets. Existing owner authentication, exact-origin, CSRF, rate
  limit, and manual-merge boundaries remain mandatory.
- Risk/rollback: manual merge required. Revert the enrichment route, contract,
  UI, and tests; private packet objects remain governed by the existing
  Supabase retention/recovery procedure. Production requires the already
  approved Coupang credentials and no new secret or local durable state.
