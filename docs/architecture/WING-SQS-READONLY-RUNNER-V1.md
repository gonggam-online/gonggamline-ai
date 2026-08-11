# WING SQS Read-only Runner v1

Status: approved by repository-owner directive dated 2026-08-11.

## Problem and business objective

Picktil Discovery needs bounded Coupang WING evidence without copying the
desktop-owned WING credentials to a notebook or making marketplace writes. The
smallest revenue-path improvement is to extend the existing central runner from
PR #118 with a stable FIFO request/response contract, one additional seller
product read, and restart-safe duplicate suppression.

Owner: Supplier / Procurement integration, with the desktop central runner as
the credential-bearing execution boundary.

## Current state and decision

PR #118 already provides an AWS SQS desktop runner, DPAPI-protected WING
credentials, least-privilege IAM templates, bounded HTTP calls, scheduled-task
bootstrap, and connection/category reads. This Story reuses those assets and
does not create another runner.

The accepted contract is exactly version `1.0.0`:

- request message type: `wing.read.request`;
- response message type: `wing.read.response`;
- source: `picktil-discovery`;
- operations: `connection_test`, `list_seller_products`, `category_meta`.

Create, update, delete, listing, price, order, inventory, return, settlement,
payment, and every other write-capable operation are rejected before any WING
adapter invocation.

## Boundaries and dependency direction

```text
Picktil Discovery
  -> encrypted request FIFO (AWS SQS)
    -> desktop central runner contract parser
      -> processed-request ledger / response replay cache
      -> fixed read-only WING adapter
    -> encrypted response FIFO (AWS SQS)
      -> Picktil Discovery
```

- `tools/central-runner/contracts.ts` owns public queue DTO validation.
- `tools/central-runner/worker.ts` owns polling, poison handling, replay,
  response publication, acknowledgement, and graceful shutdown.
- `lib/coupang/client.ts` remains the HMAC transport owner.
- WING credentials and vendor ID remain desktop-only configuration and are
  absent from request/response contracts and logs.

No public HTTP API, database migration, Product runtime, Listing write path, or
Production application route is introduced.

## Contracts

Request required fields:

`contractVersion`, `messageType`, `requestId`, `idempotencyKey`, `requestedAt`,
`expiresAt`, `source`, `operation`, and `parameters`.

Response required fields:

`contractVersion`, `messageType`, `requestId`, `idempotencyKey`, `respondedAt`,
`operation`, `status`, and exactly one of `result` or sanitized
`error { code, retryable }`.

UUID request identity, bounded timestamps, exact source/type/version, bounded
parameter objects, and operation-specific parameter validation fail closed.
Unknown fields do not grant capability. Result payloads are normalized and
credential-free.

## Lifecycle, idempotency, and recovery

1. Long-poll one request with a bounded visibility timeout.
2. Reject malformed, expired, unsupported, and write-like messages without a
   WING call; publish a correlated `rejected` or `expired` response when safe
   correlation fields can be recovered.
3. Claim `(requestId, idempotencyKey)` in a transactional processed-request
   ledger before WING execution.
4. A completed duplicate republishes the byte-equivalent normalized response
   and does not call WING again.
5. An identity/key conflict fails closed as poison input.
6. Only after response publication succeeds is the request acknowledged.
7. Failed transient execution remains retryable until SQS redrive moves the
   message to the configured DLQ. The worker never manually bypasses redrive.

The ledger is a desktop-local durable replay cache because the WING credential
boundary itself is desktop-only. It contains internal request identity,
operation, normalized response JSON, and timestamps only; no credential,
vendor ID, raw provider body, product secret, or customer/order data. It is not
the business source of truth. The repository-owner directive accepts this
limited Cloud-first exception for read-only calls: ledger loss can cause a
repeated read but cannot cause a commerce write. AWS FIFO deduplication remains
the remote first line of duplicate suppression. A managed remote ledger would
require a separate paid/external Architecture Story.

## Security and privacy

- WING keys/vendor ID are loaded only through the existing desktop DPAPI store
  or injected desktop environment; values, lengths, hashes, and prefixes are
  never emitted.
- AWS queue URLs are environment-only. Documentation uses example names.
- Desktop IAM receives/deletes only the request FIFO and sends only the
  response FIFO. Picktil has the inverse least-privilege role.
- SQS encryption, FIFO content-based or explicit deduplication, DLQ redrive,
  bounded retention, and visibility timeout remain deployment requirements.
- Logs contain event name, request ID, operation, status, receive count, and
  sanitized error code only.
- No browser, Vercel, Supabase, Coupang write, or Production data mutation is
  authorized.

## Failure modes and observability

- Missing queue/config/AWS session: fail startup or polling closed.
- Invalid JSON/schema/write operation: poison-safe rejection; no WING call.
- Expired request: `expired`; no WING call.
- Duplicate: replay stored response; no WING call.
- WING timeout/provider failure: sanitized `failed` response with deterministic
  retryability; no raw body or credential material.
- Response-send failure: do not delete request; retry/replay safely.
- Shutdown: stop receiving, bound in-flight completion, release resources, and
  exit without acknowledging unfinished work.

Metrics/evidence are sanitized counters for received, succeeded, failed,
rejected, expired, replayed, redriven-by-SQS, and shutdown outcome.

## Capacity and cost

One-message bounded long polling in `ap-northeast-2` is sufficient for the
initial discovery workflow. Picktil Discovery 09-cloud-platform Terraform is
the sole SQS infrastructure source of truth; this repository consumes URLs and
must not deploy or extend its legacy CloudFormation reference. No queue
provisioning or paid-resource change is authorized here.
Actual URLs/ARNs and the laptop role ARN arrive from the separately deployed
Picktil 09 stack. Existing SQS cost and quota controls remain authoritative.

## Test strategy

- exact contract/version/type/source and operation parameter tests;
- explicit write-operation and malformed/expired poison rejection;
- FIFO group/dedup fields and normalized response replay;
- durable restart duplicate test proving one WING invocation;
- bounded polling, visibility timeout, DLQ receive-count behavior;
- log redaction and environment-secret absence;
- graceful shutdown and response-send-before-delete ordering;
- one separately authorized final live `connection_test` only after AWS queue
  identity and desktop WING credential availability are verified.

## Rollout and rollback

1. Merge only after repository-owner manual review.
2. Receive queue URLs/ARNs and laptop role ARN from Picktil 09; do not invent or
   provision them in this PR.
3. Configure the desktop environment without printing secrets.
4. Run one read-only `connection_test`; do not run seller product/category
   live reads as delivery smoke.
5. Install/restart the scheduled task only under a separate environment and
   authorization action.

Rollback is Git revert plus stopping the desktop worker. Preserve the replay
ledger until queued responses are reconciled; deletion requires a separate
operator decision. No marketplace or database rollback is needed.

## Approval and risk

Repository-owner approval source: explicit delegated directive on 2026-08-11
authorizing this Architecture Story and bounded implementation.

The whole implementation PR is **high-risk / manual-merge-required** because
it touches secrets/environment/authorization and an external Queue boundary.
Auto-merge is prohibited. Queue provisioning, IAM changes, secret changes,
scheduled-task installation, and the live connection test remain separate
runtime actions and are not implied by merging code.
