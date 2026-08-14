# Listing Creative Authenticated Operator Dispatch v1

Status: accepted by repository-owner squash merge of PR #137 on 2026-08-14;
merge commit `bf007382f9325d64aebd0ab9675fe4eae60216d5`.

## Revenue decision

The managed Listing creative pipeline already has a pinned image provider,
bounded spend, byte validation, private archive, and review handoff service, but
it has no compliant Production execution transport. Vercel Sensitive variables
cannot be exported to a local operator process, and the accepted v1 contract
forbids a general-purpose generation endpoint. Leaving the provider callable
only from tests or ad hoc local code would make the revenue path non-operable.

This amendment authorizes the smallest reusable transport for every selected
and procurement-approved product: a Production-only, authenticated admin
mutation that prepares one immutable dispatch plan and a second mutation that
authorizes and executes that exact plan. It is not a public generation API,
bulk job, scheduled job, retry worker, or marketplace write.

## Root-cause order

1. External configuration: the required OpenAI and Supabase credentials exist
   only as Vercel Production Sensitive variables. The OpenAI project is funded;
   Vercel currently shows a payment method and a Pro Trial, while public Blob
   billing continuity remains a publication gate rather than a private-render
   gate.
2. Database: no Database/Auth/RLS Story for concurrent or unattended creative
   work is accepted. The initial lane therefore remains one operator and one
   immutable plan at a time, using the accepted private object store rather than
   `listing_drafts` or local state.
3. Code: the product-agnostic planner and archive service have no authenticated
   Production call site or durable operator-approval handoff.

## Cloud-first durable state

Supabase Storage private bucket `listing-creative-private-v1` remains the
authoritative, default-deny owner. The server writes create-only canonical JSON
manifests under the existing subject/revision namespace:

```text
v1/<subjectHash>/<revisionDigest>/operator/<dispatchPlanDigest>/prepared.json
v1/<subjectHash>/<revisionDigest>/operator/<dispatchPlanDigest>/authorized/<authorizationDigest>.json
v1/<subjectHash>/<revisionDigest>/operator/<dispatchPlanDigest>/reserved.json
v1/<subjectHash>/<revisionDigest>/operator/<dispatchPlanDigest>/review-handoff.json
v1/<subjectHash>/<revisionDigest>/operator/<dispatchPlanDigest>/failed/<failureDigest>.json
v1/operator-global/<fiveMinuteWindow>/reserved.json
```

Every manifest contains a schema version, canonical digest, product/evidence/
category/policy/revision/candidate/job digests, status, timestamps, and sanitized
failure codes. The authorization additionally binds the model snapshot, terms
and pricing snapshots, maximum USD 2.00 revision cost, maximum six outputs,
expiry, CSRF purpose, and a one-way administrator subject hash. It stores no raw
provider payload, prompt text, secret, cookie, token, PII, supplier contact,
return address, private WING field, base64 image, or local path.

Create-only conflict means `409 ALREADY_RESERVED`; it is never converted to
success and causes zero provider calls. A prepared plan expires after 15
minutes. An authorization expires after five minutes. A failed or partial
dispatch writes sanitized evidence and never retries automatically. Recovery is
the existing private-bucket S3-compatible export plus SHA-256 verification.
Local browser state, `.env.local`, downloads, and test output are disposable and
never approval evidence.

## Two-phase Production mutation

### 1. PREPARE (no paid call)

`POST /api/admin/listing/creative-dispatch/prepare` accepts the typed external
adapter packet, validates registration readiness, materializes only allowlisted
PROVEN product facts, plans at least two creative candidates at supported model
sizes, and estimates the exact capped spend. The server computes and persists
the dispatch plan; it does not trust a client-supplied digest or readiness
status. The response is a sanitized plan summary and `dispatchPlanDigest`.

### 2. AUTHORIZE_AND_DISPATCH (bounded paid call)

`POST /api/admin/listing/creative-dispatch` accepts only the prepared plan
reference and the operator's explicit confirmation. The server reloads and
recomputes the prepared manifest, records the immutable authorization, reserves
the whole plan before the first transport call, and then invokes the pinned
provider. It archives and re-inspects every output byte before creating a
`REVIEW_REQUIRED` handoff with short-lived signed private review URLs.

`GET /api/admin/listing/creative-dispatch?preparedPlanReference=...` is a
protected read-only recovery boundary. It reloads the immutable private handoff
and reissues short-lived review URLs after browser loss, response failure, or
URL expiry. It cannot generate, approve, publish, map, or write commerce data.

Both mutations require all of the following:

- `VERCEL_ENV=production`; Preview, CI and development use fakes and cannot
  compose the real provider;
- `POST`, exact JSON content type, exact configured Production origin, existing
  administrator allowlist, and an authenticated Supabase session;
- fresh `aal2` authentication no older than 60 seconds;
- purpose-bound CSRF (`listing-creative-dispatch-prepare` or
  `listing-creative-dispatch`);
- per-administrator and global rate limits, bounded body size, schema validation,
  sanitized logs, and no redirect acceptance;
- an unexpired exact plan whose policy/model/terms/pricing/configuration digests
  still match current server snapshots;
- immutable whole-plan reservation before any provider transport.

The browser initiates an authenticated admin mutation but never receives or
supplies provider/storage credentials. Browser input alone is not approval: the
server-created authorization manifest, recent AAL2 identity, exact plan digest,
and create-only reservation together are the approval evidence.

## Mandatory separation after generation

The dispatch response is only `REVIEW_REQUIRED` or a sanitized failure. It must
not default any human product-representation check to PASS, select a candidate,
create content approval, publish to Vercel Blob, map a registration payload,
create live-write approval, or call Coupang/WING. A later, separate request must
display the admitted facts beside each private output and collect explicit
human identity/color/quantity/dimensions/material/components/options/claim/crop/
encoding/load review. Publication and live commerce write remain separately
approved boundaries.

## Rights, truth, and product generality

Fact-only jobs send zero supplier, competitor, or web pixels and zero input
asset digests. Reference/edit jobs remain ineligible unless the precise upload
and requested transformation rights are VERIFIED. Provider success does not
prove product accuracy or deployability. KK946 may appear only in external
adapter fixtures and acceptance evidence; production route, planner, provider,
storage keys, and UI remain product-agnostic.

## Failure, monitoring, and rollback

- `401/403/409/413/415/422/429/5xx`, billing/auth/rate/provider errors, stale
  snapshots, partial output, or archive mismatch are never reported as success.
- Metrics contain counts, latency, bounded cost, status code, plan digest prefix,
  and sanitized provider request reference only. Prompts, facts, signed URLs,
  asset bytes, sessions, and secrets are excluded from telemetry.
- Stop by disabling the dispatch composition, then rotate/revoke the OpenAI key
  if needed. Preserve private manifests and masters for reconciliation.
- A partial dispatch is quarantined in private storage. Do not auto-retry; a new
  operator action requires a new revision or an explicit reconciled attempt.
- Concurrent, scheduled, unattended, bulk, or multi-operator execution remains
  blocked until S3-12 Database/Auth/RLS is accepted and implemented.

## Implementation sequence and acceptance

After manual merge of this amendment, one high-risk implementation PR may add
the two protected Route Handlers, server-only composition, private manifest
repository, whole-plan reservation, protected review UI, and deterministic
route/integration/browser tests. Its exact head must pass lint, typecheck, full
tests, build, security checks, and Preview fake-only browser validation. That PR
must also be manually merged.

Only after its Production deployment may an operator run one explicitly bounded
fact-only product revision. The first run stops at private `REVIEW_REQUIRED`.
Public publication, content approval, registration mapping, and WING submission
are not authorized by this amendment.
