# Listing Managed Creative Asset and Image Provider v1

## Status, owner decision, and revenue outcome

- Status: accepted by repository-owner manual merge of PR #131 on 2026-08-14;
  merge commit `4fd227193314c14cd096d73e46f97a340f4bd9d0`. The managed object-store/CDN,
  image provider/model/terms, paid-use limit, server-secret, and output-commercial-
  use architecture boundary is now durable implementation authorization for the
  ordered high-risk/manual PRs below.
- Revenue outcome: let the generic Listing pipeline produce real, reviewable,
  conversion-oriented image artifacts instead of stopping at briefs or
  fixture-only rasters, while preserving a fast unchanged-image registration
  packet when new creative is unavailable.
- Scope: every selected and procurement-approved product. Product identifiers,
  facts, prices, categories, image references, titles, and keywords are supplied
  through typed evidence/adapters and never hard-coded in provider or storage
  production code.
- This Story approves the exact architecture and ordered implementation below.
  It performs no bucket/store creation, secret write, paid provider call,
  database migration, Production mutation, or marketplace write.
- Risk: high-risk/manual because the later implementation changes managed
  storage, CDN publication, billing, secrets, Production configuration, and an
  external generative provider. No auto-merge is permitted.

## Root-cause classification and present state

1. External configuration, amended 2026-08-14 after PR #137: the approved
   Supabase private bucket and Vercel public Blob mirror now exist. The mirror
   uses Vercel's current OIDC-default connection in ICN1 rather than a long-lived
   token. OpenAI provider billing/key/budget configuration is verified. Owner-
   supplied authenticated Billing evidence for the active team shows `Hobby
   Plan` / `Active` and `Upgrade to Pro`; it does not establish payment-method
   state. Vercel documents Blob availability within Hobby's included limits but
   describes Hobby as personal/non-commercial and supplies no on-demand overage.
   Commercial public delivery therefore retains an external configuration gate.
2. Database/state: `legacy listing_drafts` cannot own immutable provider jobs,
   rights dependencies, creative approvals, or learning. This Story does not
   cast it to registration-ready and does not invent a local ledger.
3. Code, amended after PRs #132-#134: Listing v3 now has managed storage, a pinned
   provider adapter, complete PNG-byte QA, human product-representation review,
   canonical approval, selected publication, and public-only mapper boundaries.
   Operational OIDC/restore/provider drills and durable concurrent DB/Auth/RLS
   state remain incomplete.

Production smoke on 2026-08-14 returned HTTP 200 for `/listing/review`, passed
the focused Chromium review flow, and reported runtime `degraded` solely because
Coupang is unconfigured. That smoke does not prove this unimplemented provider.

## Approved cloud-first topology

The minimum reliable topology separates confidential evidence from public
delivery and gives each durable state an explicit owner and recovery path.

| State | Authoritative owner | Access | Recovery / deletion |
| --- | --- | --- | --- |
| admitted source bytes, rights evidence references, generated masters, manifests | Supabase Storage private bucket `listing-creative-private-v1` in the existing managed project | server service role for writes; short-lived signed review URLs; no public bucket | export through the S3-compatible interface, verify SHA-256, and restore to another encrypted store; legal hold overrides normal purge |
| approved channel-ready images and rendered detail assets | Vercel Blob public store `listing-creative-public-v1` | Production OIDC identity for writes; public CDN read only after digest-bound content approval | regenerate the public mirror from the Supabase master and manifest; takedown deletes the public object first |
| provider/model/terms/pricing snapshot records and sanitized job manifests | Supabase private bucket beside the artifact revision | server-only; no raw prompt containing private evidence and no raw provider response retained | rebuild from immutable normalized manifests and Git-owned contract versions |
| source, schemas, deterministic fixtures, architecture and CI evidence | GitHub | repository policy | branch/PR history and Git revert |
| local files, browser downloads, test output | none; disposable cache only | current task process | remove after upload/verification; never the only copy |

Supabase and Vercel are not interchangeable sources of truth. Supabase owns the
private recoverable master. Vercel Blob is a replaceable public delivery mirror
containing only artifacts already approved for the channel. Raw supplier files,
licence documents, account data, PII, and rejected candidates never enter the
public store.

### Immutable addressing and lifecycle

Objects use content addressing and never overwrite an existing key:

```text
v1/<subjectHash>/<revisionDigest>/<role>/<sha256>.<ext>
```

- `subjectHash` is a non-reversible internal subject key, not a supplier account
  identifier or product title.
- SHA-256 is computed from stored bytes after decoding and MIME/dimension checks.
- A public object is accepted only when its bytes match the private master digest
  and the selected candidate/content-approval manifest.
- Manifests are append-only: `RESERVED`, `GENERATED`, `ARCHIVED`, `APPROVED`,
  `PUBLISHED`, `REVOKED`, `TAKEDOWN`, or `FAILED`. A new state is a new object,
  never a mutation that erases earlier evidence.
- Public mirrors remain only while an active listing or approved rollback needs
  them. A rights withdrawal, takedown, digest mismatch, or factual failure removes
  the public mirror first and invalidates every dependent packet.
- Private masters remain while any active listing/approval depends on them and
  for at least 90 days after final unpublish, unless a shorter legal deletion
  duty or a legal hold applies. Retention may be lengthened only by a later
  approved policy; the service does not silently retain provider payloads.
- CDN/object deletion is verified by origin and public fetch. Supabase Smart CDN
  invalidation can take up to its documented edge-invalidation window, so a
  takedown remains `TAKEDOWN_PENDING` until verification completes.

### Access and secret boundary

- `SUPABASE_SERVICE_ROLE_KEY` and any legacy `BLOB_READ_WRITE_TOKEN` are
  server-only. The preferred Vercel Blob credential is its short-lived,
  automatically rotated OIDC token with `BLOB_STORE_ID`. Credentials
  never appear in `NEXT_PUBLIC_*`, client bundles, logs, prompts, Git, screenshots,
  or review packets.
- Supabase private bucket upload/read policies default deny. Service-role writes
  are permitted only from the server adapter; review reads use short-lived signed
  URLs. Public retrieval is never enabled on the private bucket.
- Vercel Blob has no source/evidence upload path. Its Production OIDC identity
  publishes only the exact selected digest after content approval; live-write
  approval remains a separate marketplace boundary.
- Preview and CI use deterministic fakes and disposable fixture bytes. Real paid
  generation and Production secrets are not automatically exposed to Preview.
- Initial real execution is a single authenticated operator dispatch. No
  unauthenticated or general-purpose generation route and no concurrent
  automation are authorized until the later Database/Auth/RLS job Story
  provides durable idempotency and authorization. The accepted
  [authenticated operator dispatch amendment](LISTING-CREATIVE-AUTHENTICATED-OPERATOR-DISPATCH-V1.md)
  defines the only allowed Production call site: two purpose-bound AAL2 admin
  mutations with a private create-only plan, authorization, and reservation.

## Approved image provider contract

The initial provider is the OpenAI Image API with the pinned model snapshot
`gpt-image-2-2026-04-21`. The Image API, rather than a conversational image flow,
is used for one immutable job because it gives the smallest auditable request,
output, and cost envelope. The adapter records:

- provider, exact model snapshot, endpoint contract version, request timestamp,
  organization/project-independent request hash, and idempotency key;
- normalized prompt digest, admitted fact/evidence digests, input asset digests,
  exact rights capabilities, recipe, size, quality, format, and output count;
- observed Services Agreement, model, generation-guide, and pricing snapshot
  identifiers; output-commercial-use decision and human review identity;
- returned usage/cost, sanitized provider request identifier, output byte digest,
  decoded MIME/dimensions, computed visual QA, storage keys, and final status.

`OPENAI_API_KEY` is the only new OpenAI server secret. It is created as a
least-privilege project key, stored only in the Vercel Production environment,
rotated after suspected exposure, and never committed or returned to the client.
Organization verification, project billing, and a successful zero-payload
connection check are external configuration gates.

### Paid-use envelope

The owner-approved initial safety envelope is deliberately small:

- maximum USD 2.00 estimated and actual provider spend per product revision;
- maximum six output images and two provider attempts per revision;
- OpenAI project monthly budget USD 50, with alerts at 50%, 80%, and 100%;
- stop before a request when estimated cumulative cost would cross either cap;
- no automatic retry for content-policy, rights, fact, billing, authentication,
  or rate-limit failures; a retry needs a new bounded job attempt;
- no paid call from tests, pull requests, Preview, scheduled jobs, or a
  general-purpose browser endpoint. After manual acceptance of the operator
  dispatch amendment, a browser may initiate only its exact authenticated AAL2
  admin mutation; server-held credentials and a durable server-created
  authorization remain mandatory.

Pricing is checked against the current official snapshot before each Production
rollout. A changed model, terms, price, output ownership condition, training/data
use condition, or region requires a new versioned policy decision before calls
resume. Budget limits are safety ceilings, not spending targets.

### Provider terms and output use

The observed OpenAI Services Agreement says, as between the customer and OpenAI
and to the extent permitted by applicable law, the customer retains input rights
and owns output; it also makes the customer responsible for having input rights,
using outputs lawfully, and evaluating output accuracy, and notes that output may
not be unique. Business/API content is not used to improve models unless the
customer explicitly opts in. These terms do not clear third-party copyright,
trademark, trade dress, design, publicity, privacy, or product-representation
rights. The system therefore records `syntheticOutputCommercialUse=VERIFIED`
only when both the provider terms snapshot and the particular job's input-rights
and output-review gates pass.

## Rights and truthful-product gates

This Story preserves the accepted operation-specific rights contract:

- a supplier original with verified unchanged marketplace use may remain in the
  minimum listing even when edit or provider-upload rights are unknown;
- any source pixel uploaded to the provider requires `providerUpload=VERIFIED`;
  image editing/reference also requires the exact transform and
  `generativeReference=VERIFIED` capabilities;
- competitor and arbitrary web pixels remain observation-only and cannot be
  downloaded into this store, edited, composited, or sent to the provider;
- text-to-image independent generation may use admitted non-expressive product
  facts without a third-party pixel reference;
- generated output cannot be deployed merely because the provider returned it.
  Human and computed review must confirm product identity, color, quantity,
  dimensions/scale treatment, material, components, options, prohibited marks,
  unsupported claims, and exact selected-variant consistency;
- uncertainty about the visible construction or included components produces
  `PRODUCT_REPRESENTATION_REVIEW_REQUIRED`, not a successful artifact.

Rights withdrawal, trust-profile narrowing, model/terms change, fact conflict,
or input/output digest change invalidates the dependent artifact, content
approval, public mirror, and registration packet. It does not block an unrelated
eligible unchanged-source packet.

## Generic execution flow

1. Admit the typed evidence packet and exact category/policy snapshot.
2. Evaluate the minimum registration packet independently from conversion gaps.
3. Plan at least two product-agnostic creative candidate sets.
4. Evaluate operation-specific input rights and fact coverage for every render
   job; exclude only the ineligible job.
5. Reserve the immutable job key with `upsert=false`; a duplicate reservation
   stops before spending.
6. Run the deterministic fake in CI/Preview or the bounded OpenAI adapter only in
   an approved Production operator dispatch.
7. Decode bytes, compute digest/dimensions/MIME and semantic/visual QA, then write
   the private master and append-only manifest.
8. A human selects one candidate and content approval binds every title, keyword,
   filter, image, detail-package, policy, provider, recipe, and revision digest.
9. Publish only the selected channel-ready digests to Vercel Blob and verify CDN
   loads. Fixture, rejected, unselected, or unapproved output never publishes.
10. The mapper consumes that one approval packet. A separate live-write approval
    is still required for WING/Coupang submission.

Provider or storage outage produces `OPTIMIZATION_UNAVAILABLE` and visible retry
evidence. It never converts a missing artifact into success. When an eligible
unchanged packet exists, registration readiness may remain ready while conversion
readiness is pending.

## Product acceptance boundary

A real product adapter can request generation only with sufficient admitted facts
and rights. KK946 remains an external acceptance packet, not production logic.
Its verified unchanged supplier asset can support minimum registration, but the
currently recorded unknown edit/provider-upload/generative-reference rights mean
supplier pixels cannot be sent to this provider. Independent fact-only generation
may be reviewed, but the presently admitted text facts do not by themselves prove
the pouch's exact visible construction. A deployable optimized KK946 image needs
one of:

1. owned or commissioned exact-product photography;
2. a supplier grant covering provider upload and the requested reference/edit
   operation; or
3. sufficiently complete exact visible-product evidence plus independent
   generation and human product-representation approval without source pixels.

This is a conversion warning/pending state, not a registration blocker when the
eligible unchanged original is selected. No generated KK946 artifact may be
called deployable until rights, computed QA, and factual human review pass.

## Implementation and manual gates

After manual merge of this Story, implementation proceeds as separately
reviewable high-risk PRs:

1. private Supabase bucket, default-deny access policies, public Vercel Blob
   store, server adapters, digest verification, takedown, restore drill, and
   deterministic fakes;
2. OpenAI Image API adapter, pinned model/terms/pricing record, server-only key,
   spend guards, rights gate, sanitized manifest, and negative tests;
3. actual-byte computed QA, review UI, digest-bound approval, public mirror, and
   selected-set-only mapper integration;
4. separately approved Database/Auth/RLS immutable job/approval/learning state
   before concurrent or unattended generation;
5. product adapter acceptance and one explicit paid Production generation run;
6. separate live commerce-write approval and WING entry.

Bucket/store creation, billing/payment changes, API-key creation, secret writes,
real provider calls, Production configuration, and public asset publication are
external side effects. The owner has approved their Architecture category, but
each exact implementation PR remains manual-merge-required and must show the
target, cost envelope, rollback, and exact-head evidence before the action.

### 2026-08-14 rollout checkpoint

- OpenAI Pay-as-you-go is active with USD 5 credit. Auto-reload remains off and
  the organization spend limit is USD 50 with hard enforcement.
- A restricted Default-project key with Model capabilities Request permission is
  stored only as the Sensitive Production-scoped Vercel variable
  `OPENAI_API_KEY`. A key whose hidden form value entered diagnostic output was
  revoked before use or Vercel storage; the replacement value was never logged.
- The generic planner now materializes explicit PROVEN fact values, rejects
  operational/private fields, produces two fact-only candidates using
  1024x1024 MAIN and 1024x1536 DETAIL requests, and sends zero source pixels.
- The dispatch composition refuses non-ready registration packets before the
  provider call, archives and re-inspects every output byte, and returns only
  short-lived private review URLs. It never selects a candidate or creates
  content/live-write approval.
- No paid image request, public image publication, or WING write has occurred at
  this checkpoint. The active team is on `Hobby Plan` / `Active`, not Pro;
  commercial public Blob publication therefore retains the plan/terms gate.

## Verification and rollback

- Contract tests prove no product-specific values occur in provider/storage
  production paths, fixtures never deploy, unknown provider-upload rights reject
  reference jobs, duplicate reservations do not spend, budgets fail closed, and
  only the approved digest can reach the public mirror.
- Integration tests use an in-memory/fake object repository and fake provider;
  no CI or Preview test has a real key or billable call.
- Storage validation uploads a synthetic non-product fixture, verifies private
  access denial, signed review access, digest equality, public selected-object
  fetch, takedown, and recovery, then deletes the disposable fixture.
- Provider validation performs one separately approved bounded synthetic smoke,
  records usage/cost without prompt/provider payload leakage, and quarantines the
  output from marketplace use.
- Rollback order is: stop provider dispatch, revoke/rotate provider and Blob
  write keys, remove public mirrors, invalidate approvals, preserve private
  evidence subject to retention/legal hold, revert code, and verify no live
  payload references a removed digest.

## Official source snapshots observed 2026-08-14

Each digest below is SHA-256 of the normalized source record (canonical URL,
observation date, and the exact policy/pricing fields used), not a claim that the
external webpage bytes are immutable. Re-observation creates a new record.

| Source | Version/digest | Applied scope | Limitation |
| --- | --- | --- | --- |
| [GPT Image 2 model](https://developers.openai.com/api/docs/models/gpt-image-2) | model `gpt-image-2-2026-04-21`; `91066da0ecef43df3e1339d65e87bde8c2224a4dc655c169523be3f6c40385a7` | exact image model and supported generation/edit surface | model capability is not a product-accuracy or rights guarantee |
| [Image generation guide](https://developers.openai.com/api/docs/guides/image-generation) | rollout re-observation: 1024x1024 low/medium/high USD `0.006/0.053/0.211`; 1024x1536 and 1536x1024 USD `0.005/0.041/0.165`; PNG base64 response and divisible-by-16 size constraint; `f9b90401f1f8bc404f8cb978fb69bfa8ef868419e5ee20d44d61850f07b97636` | Image API choice, size/quality/format, organization-verification notice, and conservative stop-before-spend table | estimates exclude variable prompt and edit-image input tokens; operational limits may change and are rechecked at rollout |
| [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) | `gpt-image-2` Standard image input USD 8/M, cached input USD 2/M, output USD 30/M; text input USD 5/M, cached USD 1.25/M; `2bbd4eb905bc2a32ab7028f8eb024079650a93ce999b8f645ae8bbcc1db26938` | cost estimation and stop-before-spend guard | token pricing does not predict exact per-image cost without actual usage |
| [OpenAI Services Agreement](https://openai.com/policies/services-agreement/) | observed agreement; `7a9261d770293cfc11331ffc89f8c71543a48b22347113df2bf0efb28c08f2cd` | input responsibility, output allocation, opt-in training boundary | not legal advice; does not clear third-party rights or uniqueness |
| [Supabase bucket fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals) | `cc5b5d4d9a4ab1d2965346fe78b37647f507e0f49f4de969dc60134fcd0ffb2d` | private-by-default bucket and signed URLs | exact project policies must be reviewed after creation |
| [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control) | `2f17cdb2240bf933f8875ac1cdad6b1f555863b72e60e020668629a7f391b810` | default-deny RLS and server-only service key | service role bypasses RLS and therefore increases secret impact |
| [Supabase Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn) | `d6a068d38124c7a09e58db9ae5ff2002c49c85a9f7ad60d66fb67af55419f5e3` | CDN/cache and deletion-verification behavior | plan/edge invalidation behavior can change |
| [Supabase Storage pricing](https://supabase.com/docs/guides/storage/pricing) | Pro included storage/egress plus usage pricing observed; `8361ce176aea23472fcf709115f7826bca611f9f18f857222992392c191e3936` | budget review for private archive | account invoice and current dashboard remain authoritative |
| [Vercel Blob](https://vercel.com/docs/vercel-blob), [Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk), and [OIDC announcement](https://vercel.com/changelog/vercel-blob-now-supports-oidc-authentication) | `@vercel/blob@2.8.0`; OIDC re-observed 2026-08-14 | public delivery store, immutable put/get/delete, CDN/origin verification, short-lived Production authentication | ICN1 public mirror exists; public Blob is reconstructable and never the private master |
| [Vercel Blob usage and pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) and [Vercel pricing](https://vercel.com/pricing) | official pages re-observed 2026-08-14; owner-supplied authenticated active-team Billing evidence observed 2026-08-14 | delivery cost, included-limit, plan-applicability, and spend-management review | Blob is available within Hobby's included limits (1 GB storage, 10,000 simple operations, 2,000 advanced operations, 10 GB transfer); Hobby has no on-demand overage and is described as personal/non-commercial. Active team shows `Hobby Plan` / `Active`; commercial publication requires Pro or another accepted commercial store |
