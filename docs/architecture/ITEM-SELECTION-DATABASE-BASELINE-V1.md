# Item Selection Database Baseline Architecture v1

## Status and authority

- Status: Draft; repository-owner review and explicit acceptance required.
- Story: Item Selection prerequisite Architecture / Database Baseline.
- Owner: Database / Security.
- Consumers: Supplier / Procurement Item Selection, Revenue, and later Admin
  application services.
- Risk: high-risk/manual for every later schema, migration, RLS, or Production
  execution Story.
- This PR authorizes no migration, database connection, Production access,
  runtime code, API, UI, authentication, or RLS implementation.
- Codex must not approve, mark this document accepted, merge its PR, or enable
  auto-merge.

## 1. Business objective

Make Item Selection evaluations durable and exactly reproducible so an operator
can prove that a product offered for sale was selected by the approved engine.
The database is an audit and replay boundary; it must not recalculate or silently
upgrade historical decisions.

This baseline must leave Story 3 implementable without new database design
questions. It does not itself make a candidate sellable. Rights evidence,
complete score inputs, confirmed economics, and human approval still determine
whether a candidate may move beyond `MANUAL_REVIEW`.

## 2. Current-state evidence

- The deployed application is Next.js 16 on Vercel and already uses
  `@supabase/supabase-js`.
- Application access is currently through Supabase/PostgREST.
- The intended migration history is `supabase/migrations/**`, but it starts at
  migration 003. Authoritative pre-003 recovery sources exist separately.
- Existing migrations 005–20 contain permissive development policies, so a
  final least-privilege boundary must be applied after migration 020.
- Item Selection Story 1 and Story 2 are merged. Their immutable identifiers
  are `gonggamline-item-selection-v1`,
  `item-selection-evaluator-v1`, and
  `gonggamline-profitability-2026-07-27-v1`.
- No approved admin principal, RLS contract, CSRF contract, Item Selection
  migration, repository, API, or UI exists.

## 3. Decision: database and execution environment

Use managed Supabase Postgres as the authoritative database for Item Selection.

Reasons:

1. It is the repository's existing database and PostgREST boundary.
2. The Vercel runtime can use the existing HTTP-based Supabase client without
   relying on long-lived database connections.
3. Postgres transactions, constraints, JSONB, generated hashes, and immutable
   rows support atomic finalization and replay evidence.
4. Supabase provides isolated local/staging projects and an explicit migration
   workflow suitable for disposable replay.

Rejected alternatives:

- Vercel KV or another key-value store: insufficient relational constraints,
  transaction semantics, and migration continuity for audit records.
- SQLite or local files: incompatible with horizontally scaled Vercel
  instances and not a durable shared source of truth.
- A second managed Postgres provider: duplicates infrastructure and identity
  boundaries without improving the first-sale path.
- Browser storage: not trusted, durable, server-authoritative, or auditable.

Runtime rules:

- Browser code never receives a service-role credential.
- Serverless requests use bounded Supabase HTTP calls.
- Provider reads occur outside database transactions.
- Database transactions are short and contain only deterministic persistence
  work.
- Any operation requiring multi-table atomicity is exposed through one
  reviewed Postgres function called by the server application layer; a series
  of unrelated client calls is not treated as atomic.

## 4. Migration baseline and source of truth

The implementation order is:

1. Approve this Architecture.
2. Approve Admin Identity / Authorization / RLS / CSRF Architecture.
3. Execute the separately approved Sprint B-0 baseline in an isolated
   environment:
   - promote the three recovered pre-003 schema sources;
   - preserve migrations 003–20 byte-for-byte and in order;
   - add the approved post-020 least-privilege security boundary;
   - prove clean replay and schema fingerprints.
4. Only after B-0 acceptance, create the additive Item Selection migration.
5. Replay the complete chain on a fresh disposable database.
6. Run repository, RLS, transaction, compatibility, and rollback tests.
7. Submit a separate high-risk Story 3 PR. Production execution remains a
   distinct manually approved release action.

Filename timestamps encode dependency order, not invented historical execution.
Applied migration metadata is never edited manually. `IF NOT EXISTS` does not
substitute for a deterministic clean replay.

## 5. Logical schema

Story 3 creates only these Item Selection-owned objects:

### `item_selection_runs`

| Column | Storage | Contract |
|---|---|---|
| `id` | `uuid primary key` | server-generated run identity |
| `provider` | `text not null` | constrained to `domeggook` for v1 |
| `keyword` | `text not null` | trimmed, bounded operator input |
| `requested_size` | `integer not null` | bounded 1–30 |
| `status` | `text not null` | `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED` |
| `ruleset_version` | `text not null` | immutable selection ruleset |
| `evaluator_version` | `text not null` | immutable evaluator implementation |
| `profitability_policy_version` | `text not null` | immutable Revenue policy |
| `request_fingerprint` | `text not null` | canonical request SHA-256 |
| `idempotency_key_hash` | `text not null` | SHA-256; raw key is never stored |
| `requested_by_principal_id` | `text not null` | trusted admin principal subject |
| `started_at` | `timestamptz not null` | database time |
| `completed_at` | `timestamptz null` | terminal transition time |
| `failure_code` | `text null` | sanitized allowlisted code only |
| `created_at` | `timestamptz not null` | database time |

Constraints:

- unique `(requested_by_principal_id, idempotency_key_hash)`;
- terminal rows cannot return to `RUNNING`;
- `completed_at` is required exactly for terminal states;
- run version columns and request identity are immutable after insert.

### `item_selection_evaluations`

| Column | Storage | Contract |
|---|---|---|
| `id` | `uuid primary key` | evaluation identity |
| `run_id` | `uuid not null` | FK to run, delete restricted |
| `provider_item_number` | `text not null` | canonical provider identifier |
| `original_position` | `integer not null` | deduplicated input position |
| `verdict` | `text not null` | approved v1 verdict enum |
| `total_score_units` | `integer null` | score × 10,000 |
| `coverage_units` | `integer not null` | ratio × 1,000,000 |
| `normalized_margin_units` | `integer null` | ratio × 1,000,000 |
| `normalized_profit_krw_micros` | `bigint null` | KRW × 1,000,000 |
| `normalized_snapshot` | `jsonb not null` | complete canonical engine input/output |
| `snapshot_sha256` | `text not null` | canonical snapshot hash |
| `provider_evidence` | `jsonb not null` | allowlisted evidence envelope |
| `provider_evidence_sha256` | `text not null` | canonical evidence hash |
| `created_at` | `timestamptz not null` | database time |

Constraints:

- unique `(run_id, provider_item_number)`;
- check constraints bound score/coverage/margin units;
- JSON values must be objects with approved `schemaVersion` fields;
- evaluation rows are append-only and immutable;
- `ON DELETE RESTRICT` preserves history.

No Product, listing, supplier, procurement, order, or marketplace table is
created or updated by Story 3.

## 6. Exact money, VAT, rate, and rounding storage

JavaScript floating-point values are never authoritative persistence values.

- Money inputs and raw scenario amounts use signed `bigint` micro-won:
  `krwMicros = exact KRW × 1,000,000`.
- Rates, margins, weights, and coverage use signed `bigint` parts-per-million:
  `rateUnits = exact ratio × 1,000,000`.
- Integral MOQ and observed counters use constrained integers.
- Display won and display percentages are derived values stored only inside the
  immutable result snapshot for historical UI reproduction; they are never
  used to recalculate a verdict.
- VAT is an explicit enum:
  `VAT_EXCLUSIVE`, `VAT_INCLUSIVE_DEDUCTIBLE`,
  `VAT_INCLUSIVE_NON_DEDUCTIBLE`, or `TAX_EXEMPT`.
- Every money/rate fact stores its original canonical decimal string,
  normalized integer units, source type, safe source reference,
  `effectiveFrom`, `includedIn`, VAT treatment, and confirmation status.
- Canonical conversion rejects values that cannot be represented exactly at
  the selected scale. It never truncates or silently rounds.
- Engine outputs persist the exact normalized units used by the decision plus
  the engine-produced display value. Historical reads return those stored
  values and never run a newer rounding rule.

The one-million scale exactly represents all approved v1 constants, including
`10.9%`, `12.5%`, `18%`, `20%`, and current score precision, while leaving room
for intermediate micro-won results. Story 3 must add overflow boundary tests.

## 7. Immutable evaluation snapshot

`normalized_snapshot` is a versioned, canonical JSON object containing:

- snapshot schema version;
- ruleset, evaluator, and profitability policy versions;
- provider and item identity;
- original position and observation timestamps;
- all five hard-gate inputs with status, evidence reference, and effective
  date;
- all six score-area inputs, normalized values, provenance, and freshness;
- complete profitability input facts and all base, stress,
  current-effective, and normalized scenario outputs;
- missing, estimated, and not-applicable facts;
- score coverage, score, verdict, reasons, risks, and next actions;
- canonical numeric strings and integer storage units;
- engine input and output hashes.

Canonicalization rules:

- UTF-8, Unicode NFC strings;
- object keys sorted by Unicode code point;
- array order preserved where semantically ordered and sorted by explicit key
  where the contract declares a set;
- no `undefined`, `NaN`, infinity, executable content, raw secrets, or raw
  provider payloads;
- timestamps normalized to UTC RFC 3339 with explicit precision;
- numbers encoded as canonical decimal strings plus integer units, not JSON
  binary floating point.

`snapshot_sha256` is calculated from the canonical UTF-8 bytes before insert.
Story 3 verifies the database-returned value and rejects mismatch.

## 8. Provider fact and source evidence

Provider evidence is allowlist-only:

- provider `domeggook`;
- provider item number;
- observed-at time;
- normalized supplier price, shipping fee, MOQ, availability, and safe
  provider URL/reference;
- evidence type, source reference, effective date, and confirmation status;
- separately collected rights evidence for resale, IP/brand, image use, image
  editing, and tax invoice eligibility;
- evidence schema version and hash.

Never store API keys, cookies, authorization headers, full upstream
request/response bodies, supplier personal information, internal stack traces,
or secret-bearing URLs. A source reference proves provenance but is not treated
as proof of a hard gate unless its evidence type satisfies the approved
ruleset.

Evidence is copied into each immutable evaluation. Later provider changes do
not mutate historical rows.

## 9. Reproducibility and policy preservation

Historical reproduction has two levels:

1. Exact decision reproduction: return the stored canonical input, stored
   output, hashes, and versions byte-for-byte.
2. Engine replay verification: run the archived implementation for the stored
   version against the stored canonical input and compare canonical output
   hashes.

Policy constants are not loaded from mutable database settings. Each released
policy version remains in code and tests. Removing a version requires a
separate retention/supersession decision and cannot invalidate stored history.
If an archived implementation is unavailable, the record remains auditable but
is explicitly reported as `REPLAY_IMPLEMENTATION_UNAVAILABLE`; it is never
recalculated using the latest policy.

## 10. Transaction and idempotency

Run creation:

1. Validate auth, request, size, versions, and idempotency header before any
   provider or database write.
2. Canonicalize the request and compute its fingerprint.
3. Call one transaction function that inserts `RUNNING` or returns the
   existing row for the same principal and idempotency hash.
4. A reused idempotency key with a different fingerprint is a conflict.

Evaluation:

1. Read the provider outside the transaction with bounded concurrency.
2. Normalize and evaluate entirely in application/domain code.
3. Canonicalize and hash every completed evaluation.
4. Call one transaction function that inserts all evaluation rows, verifies
   expected counts and versions, and atomically transitions the run to
   `COMPLETED`, `PARTIAL`, or `FAILED`.
5. On transaction failure, no evaluation is reported as persisted and the run
   remains recoverable.

The finalization function locks the run row, accepts only `RUNNING`, is safe to
retry with identical hashes, and rejects divergent duplicates. Database
functions use a fixed `search_path`, explicit input types, least-privilege
grants, and no dynamic SQL.

## 11. Environment separation and secrets

- Local: disposable Supabase stack with synthetic fixtures only.
- CI: fresh disposable stack per run; no Production secrets.
- Preview/Staging: dedicated non-Production project and keys; sanitized
  provider fixtures or separately approved bounded read.
- Production: separate project, URL, anon key, service role, backups, and
  deployment approval.

No environment shares database URL, project reference, service-role key, JWT
secret, or backup target with Production. Vercel environment scoping must map
Development, Preview, and Production explicitly. Secret values remain in
approved secret stores and are never printed, snapshotted, committed, or sent
to the browser.

## 12. Authorization dependency

This Architecture deliberately does not invent the trusted admin principal or
RLS policy. Story 3 remains blocked until the separate Admin Identity /
Authorization / RLS / CSRF Architecture is accepted.

That Architecture must define:

- principal subject and role claim;
- server verification and session contract;
- operator read/create permissions;
- service-role use limited to reviewed server transaction functions;
- default-deny RLS and negative tests;
- CSRF and rate-limit ownership;
- audit events and secret/evidence access restrictions.

The Story 3 migration must consume those accepted names and claims exactly.

## 13. Migration and Production data protection

Before any Production execution:

- prove the complete chain on an empty disposable database;
- compare approved schema fingerprints, constraints, indexes, functions,
  grants, and RLS policies;
- run positive and negative RLS tests with actual token shapes;
- run application compatibility, transaction, idempotency, overflow, and
  immutable-row tests;
- inspect lock level and `EXPLAIN` plans for new indexes;
- prove additive deploy compatibility with the old application;
- take and verify a restorable Production backup according to the approved
  Supabase plan;
- record row counts and schema fingerprints immediately before migration;
- require a human maintenance-window approval and exact migration SHA;
- stop on the first SQL, fingerprint, permission, or health failure;
- refresh PostgREST schema cache through the supported mechanism and verify it;
- deploy application code only after schema verification.

Production verification is read-only: insert/update/delete tests run only in
the disposable or dedicated staging environment.

Rollback:

- Before application use, rollback is dropping the new isolated objects in a
  reviewed down script.
- After any Production evaluation exists, do not drop or rewrite audit rows.
  Disable the new application route, preserve tables, and forward-fix.
- A bad migration that could affect existing data invokes backup recovery and
  incident handling; Codex never initiates restore or destructive rollback
  without explicit owner approval.

## 14. Observability and failure handling

Record sanitized metrics and structured events for:

- run creation/finalization latency and status;
- evaluation count and verdict distribution;
- idempotent replay and conflict counts;
- transaction, constraint, RLS, and hash mismatch failures;
- stale `RUNNING` count and age;
- replay verification success/failure by version.

Logs may contain run/evaluation IDs, safe error codes, version identifiers,
counts, and correlation IDs. They may not contain snapshots, raw evidence,
keywords when classified sensitive, secrets, or provider payloads.

Stale recovery never invents completion. A separately reviewed reconciliation
operation may mark a stale run `FAILED` with a sanitized code only when no
finalization transaction committed.

## 15. Story 3 implementation handoff

Story 3 may begin only when this document, Sprint B-0, and Admin Architecture
are accepted. Its fixed scope is:

- one additive Item Selection migration;
- typed persistence DTOs and canonicalization/hash helpers;
- one repository boundary;
- transactional create/finalize functions;
- idempotency and immutable history;
- RLS/grant implementation exactly matching accepted Admin Architecture;
- disposable replay and database contract tests.

Story 3 does not include provider orchestration, public/admin API routes, UI,
Production migration execution, Product creation, listing, price, procurement,
inventory, order, or marketplace writes.

Required acceptance evidence:

- clean full migration replay;
- schema fingerprint and constraint/index evidence;
- exact money/rate conversion and overflow tests;
- snapshot canonicalization golden tests;
- transaction rollback and retry tests;
- same-key/same-request replay and same-key/different-request conflict tests;
- immutable-row and delete-restriction tests;
- positive/negative RLS tests;
- no secrets/raw provider payload in rows or logs;
- lint, typecheck, full tests, Production build, and applicable read-only
  browser checks.

## 16. Owner review checklist

The repository owner accepts or rejects this Draft after verifying:

1. Supabase Postgres is appropriate for the current Next.js/Vercel runtime.
2. Stored inputs, evidence, versions, integer units, and hashes can reproduce
   the evaluation exactly.
3. Money, VAT, rates, and rounding cannot silently lose precision or change a
   verdict.
4. Baseline replay, migration sequencing, backups, rollout, and Production
   protection are sufficient.
5. Story 3 can be implemented without unresolved database design questions.

Acceptance must be recorded in `.ai/DECISION_LOG.md` with approver and date.
Draft publication or PR merge alone is not Architecture acceptance.
