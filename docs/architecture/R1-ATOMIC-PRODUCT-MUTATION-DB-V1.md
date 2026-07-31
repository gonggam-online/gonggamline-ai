# R1 Atomic Product Mutation DB Architecture v1

## Status and authority

- Status: proposed; repository-owner acceptance and a separate implementation
  Story are required.
- Owner: Product application with Database / Security persistence ownership.
- Risk: high-risk/manual. Apply `manual-merge-required`; never auto-merge.
- This PR authorizes documentation only. Migration SQL, runtime, Production,
  RLS/grants, environment variables, real data, and external commerce writes
  are excluded.

## Problem and objective

The [R1 mutation audit](../security/R1-PRODUCT-MUTATION-AUDIT.md) proves that
five Product mutation surfaces use the shared anonymous Supabase client:

| Consumer | Current effect | Target command |
|---|---|---|
| `GET /api/domeggook-search` | search also UPSERTs Products | read-only search + protected import |
| `PATCH /api/products/[id]` | operator/manual-price UPDATE | protected operator patch |
| `POST /api/products/[id]/competition` | manual competition UPDATE | protected manual command |
| `POST /api/products/[id]/competition/auto` | trigger + automatic UPDATE | protected trigger + isolated worker |
| `POST /api/competition/analyze-batch` | up to 20 UPDATEs | protected, item-atomic batch |

A Product write and separate audit insert cannot guarantee atomicity. No
Product RPC currently combines mutation, idempotency, and immutable audit.
The objective is a smallest reliable boundary that makes those three effects
commit or roll back together, supports deterministic retries and partial
failures, and can be proved in a disposable database before Production.

Migration 021 is the precedent for audited atomic RPCs. Production does not yet
contain 021 and still relies on anonymous Product policies. Migrations 000-021
remain byte-identical; implementation uses the next approved additive migration
identifier and must follow
[Production Schema Security Reconciliation v1](PRODUCTION-SCHEMA-SECURITY-RECONCILIATION-V1.md).

## Decision and ownership

Use operation-specific RPCs. Each RPC performs in one PostgreSQL transaction:

1. strict input/operation validation;
2. idempotency claim or replay decision;
3. only its allowlisted Product insert/update;
4. one immutable success-audit insert;
5. idempotency completion; and
6. a versioned result returned after commit.

Multiple Supabase calls are not an atomic substitute. Provider calls, LLM use,
domain calculations, and external writes never occur inside the transaction.

```text
Admin -> Auth/allowlist/AAL2/origin/CSRF guard
  -> application command -> isolated service-role repository
    -> one RPC -> idempotency + Products + security_audit_events

Admin automatic trigger -> provider work outside transaction
  -> competition worker -> one atomic RPC per Product
```

Product owns Product state/import identity. Competition owns competition facts.
Revenue alone owns financial formulas; an RPC may validate/persist approved
outputs but cannot calculate price, margin, fees, VAT, or profitability.
Database / Security owns constraints, function privileges, idempotency, audit,
and transactional behavior.

## Additive idempotency model

Later implementation may add `product_mutation_requests`, separate from Item
Selection lifecycle:

| Field | Contract |
|---|---|
| `id` | database UUID |
| `principal_scope` | trusted Admin UUID or fixed worker scope |
| `operation_code` | closed operation enum |
| `idempotency_key_hash` | lowercase SHA-256; never store raw key |
| `request_fingerprint` | SHA-256 of canonical semantic command |
| `status` | `IN_PROGRESS` or `SUCCEEDED`; failure commits no claim |
| `target_product_id` | nullable only while import resolves identity |
| `result_canonical_text` | sanitized versioned replay result |
| `correlation_id` | safe UUID |
| timestamps | database transaction time |

Unique `(principal_scope, operation_code, idempotency_key_hash)` serializes
concurrent callers. Same key/fingerprint returns the original result without a
new mutation/audit. Same key with another fingerprint conflicts. `SUCCEEDED`
requires target, result, and completion time. Committed rows are immutable and
application roles cannot delete them. Raw payloads, Product values, tokens,
cookies, secrets, email, and unbounded errors are prohibited.

Reuse `security_audit_events` unless a separately approved amendment proves it
insufficient. One successful command writes trusted Admin identity, closed
event code, canonical route, correlation ID, `SUCCEEDED`, and database time.
Failure telemetry is sanitized and separate: a rolled-back transaction cannot
commit an authoritative failure audit.

## RPC contracts

Logical names are normative; exact SQL signatures require the implementation
Story.

- `import_product_v1`: explicit protected import only; sanitized provider DTO;
  allowlisted identity/catalog upsert; cannot alter competition, operator,
  workflow, listing, or unapproved finance fields.
- `patch_product_operator_fields_v1`: existing Product plus optimistic
  precondition; rejects stale state, unknown/immutable/worker/cross-domain
  fields; persists only Revenue-approved values without owning formulas.
- `record_manual_competition_analysis_v1`: versioned manual DTO and manual
  field/source/status/timestamp allowlist; cannot claim automatic source.
- `record_automatic_competition_analysis_v1`: isolated worker only after
  collection/analysis; requires run, Product, safe evidence reference,
  analysis version, and item key; initiating Admin and worker are distinct
  trusted identities.

Every function has a fixed `search_path`, approved non-login owner, strict
identity/hash/version validation, deterministic row lock/precondition, and
versioned result rather than `products.*`. `PUBLIC`, `anon`, and
`authenticated` receive no execute privilege; only the isolated
`service_role` repository may execute. Audit is inserted before idempotency is
marked `SUCCEEDED`; audit failure raises and rolls back every effect.

## Request fingerprint and HTTP contract

Each mutation requires a bounded `Idempotency-Key`; only its hash persists.
The canonical fingerprint includes contract/operation, trusted principal,
target/provider identity, allowlisted payload, precondition, and applicable
run/analysis version. It excludes correlation/time/traces/retry count/secrets.
Canonicalization is versioned UTF-8, Unicode NFC, sorted keys, defined arrays,
approved exact numerics, no non-finite values, and no insignificant whitespace.
Plain object insertion order is not sufficient.

- first commit: compatible success status/body;
- identical replay: original status/body plus explicit replay marker;
- divergent key or stale precondition: `409`;
- invalid DTO/key: `400`;
- unauthenticated: `401`;
- unauthorized/AAL2/origin/CSRF failure: `403`;
- database/audit failure: sanitized non-success, never false success.

## Batch partial failure

The maximum-20 batch is orchestration, not one long transaction:

1. Admin guard assigns safe run/correlation identity.
2. Provider collection/analysis happens outside database transactions.
3. Each Product uses an item key derived from batch key, run, Product, and
   analysis version.
4. Each item atomically commits or rolls back its mutation/key/audit.
5. Input-ordered results are `SUCCEEDED`, `REPLAYED`, or `FAILED` with a stable
   safe code.

Retry replays committed successes and retries only uncommitted failures.
Successful siblings survive one item failure. A durable batch-run table is
rejected for v1; adding recovery/scheduling history is a new lifecycle and
requires another Architecture Story.

## Security and failure rules

Before body/provider/repository work, human commands require Auth-server JWT
validation, server UUID allowlist, fresh AAL2, exact-origin JSON CSRF, bounded
JSON, rate limit, and route DTO allowlist. Admin trigger authority is distinct
from worker persistence authority. The service-role client is never exported
through the shared anonymous client or browser.

| Failure | Required result |
|---|---|
| guard/DTO failure | no RPC or Product effect |
| fingerprint/precondition conflict | stable conflict; no effects |
| Product write failure | key and audit roll back |
| forced audit failure | Product and key roll back |
| key completion failure | Product and audit roll back |
| provider failure before RPC | no DB effect |
| one batch item fails | siblings remain; item retryable |
| response lost after commit | retry returns committed result |
| schema/policy/grant drift | deployment stops; no code fallback |

Logs use correlation, operation, opaque target/run, replay, stable outcome, and
duration only. Credentials, raw keys/payloads, and Product values are excluded.

Rejected alternatives: separate write/audit calls (not atomic), generic dynamic
patch RPC (weak allowlists), one 20-item transaction (long locks and destructive
partial failure), trigger-only audit (insufficient command identity), and Item
Selection idempotency reuse (wrong lifecycle).

## Deployment and rollback

1. Manually accept this architecture; merge alone is not acceptance.
2. Separately approve an implementation Story with exact additive migration,
   signatures, repositories, DTOs, and tests. Never edit 000-021.
3. Replay the complete chain in a fresh disposable database and pass atomicity,
   concurrency, idempotency, audit, and role tests.
4. Deliver R1 compatibility: read-only search, protected import/operator/manual
   commands, and isolated worker persistence.
5. Validate exact-head CI/Preview without Production, real provider writes, or
   commerce writes.
6. Rehearse intended schema and R2 against a restored non-Production backup.
7. Only after R1 compatibility may separately approved R2 remove anonymous
   Product writes and apply final RLS/grants.
8. R3 history repair/Production requires a new backup, exact diff, dry run,
   environment/Admin prerequisites, maintenance window, and explicit approval.

Application cannot require an absent RPC, and R2 cannot revoke writes before
all consumers are compatible. Later rollback disables affected paths, preserves
Product/key/audit evidence, and forward-fixes with an additive migration. It
cannot edit applied migrations, delete evidence, or restore unconditional
anonymous writes. Backup restore requires separate incident approval.

## Disposable replay and negative-test contract

A linked or Production project is forbidden as test fallback.

- Replay migrations 000 through the new head twice from fresh databases and
  compare classified fingerprints; prove 000-021 are byte-identical.
- Verify function owner/search path/signatures, constraints, indexes, and
  grants.
- For every RPC, prove exactly one Product effect, completed key, and audit.
- Force Product, audit, and key-completion failures independently; prove zero
  committed effects.
- Prove identical replay, divergent replay conflict, concurrent identical and
  divergent calls, and lost-response recovery.
- Prove `PUBLIC`, `anon`, and `authenticated` cannot access storage or execute
  RPCs; only the isolated service-role repository can execute.
- Prove unallowlisted user, AAL1/stale AAL2, invalid JWT, origin/CSRF failure,
  wrong content type, malformed/unknown body, and missing key yield zero
  effects.
- Prove search writes nothing and each RPC rejects fields owned by another
  operation/domain.
- Prove batch >20 rejects before work; mixed results preserve order; retries
  replay successes; forced item-audit failure affects only that item.
- Run contract/unit/integration tests, lint, typecheck, full tests, build, safe
  browser checks, exact-head CI, and exact-head Preview console/network checks
  with disposable or mocked writes.

## Production stop conditions and acceptance

Production stops without: accepted architecture and implementation Story;
merged access matrix/audit base; replay/negative/concurrency/audit/restore
evidence; current Production schema/policy/grant/history verification; verified
backup; Admin UUID allowlist, service-role secret, allowed origin, CSRF,
maximum 15-minute JWT, and MFA/AAL2 in approved stores; Preview compatibility;
and separate R2/R3 approvals. Secrets never enter Git, PR text, or logs.

Acceptance requires a repository-owner/AI CTO Decision Log entry with approver,
date, and approved commit SHA. This Draft PR does not authorize implementation.
