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
- Profitability policy identity does not identify calculation implementation.
  Story 3 introduces the separate immutable calculation contract identifier
  `gonggamline-profitability-calculation-v1`.
- No approved admin principal, RLS contract, CSRF contract, Item Selection
  migration, repository, API, or UI exists.

## 3. Decision: database and execution environment

Use managed Supabase Postgres as the authoritative database for Item Selection.

Reasons:

1. It is the repository's existing database and PostgREST boundary.
2. The Vercel runtime can use the existing HTTP-based Supabase client without
   relying on long-lived database connections.
3. Postgres transactions, constraints, authoritative text bytes, generated
   hashes, non-authoritative JSONB projections, and immutable rows support
   atomic finalization and replay evidence.
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
| `profitability_calculation_contract_version` | `text not null` | immutable profitability calculation implementation contract |
| `request_fingerprint` | `text not null` | canonical request SHA-256 |
| `idempotency_key_hash` | `text not null` | SHA-256; raw key is never stored |
| `retry_of_run_id` | `uuid null` | optional FK to the terminal run being retried |
| `requested_by_principal_id` | `text not null` | trusted admin principal subject |
| `started_at` | `timestamptz not null` | database time |
| `completed_at` | `timestamptz null` | terminal transition time |
| `failure_code` | `text null` | sanitized allowlisted code only |
| `observed_candidate_count` | `integer not null` | distinct normalized candidates accepted from the bounded provider result |
| `successfully_evaluated_count` | `integer not null` | candidates with a complete evaluator output |
| `persisted_evaluation_count` | `integer not null` | evaluation rows committed by finalization |
| `failed_candidate_count` | `integer not null` | attempted candidates without evaluator output |
| `skipped_candidate_count` | `integer not null` | candidates intentionally not attempted under an allowlisted rule |
| `candidate_failures_canonical_text` | `text not null` | authoritative canonical UTF-8 JSON text with safe per-candidate failures |
| `candidate_failures_projection` | `jsonb not null` | query-only projection of the failure text |
| `candidate_failures_sha256` | `text generated always` | digest of the exact UTF-8 failure text bytes |
| `created_at` | `timestamptz not null` | database time |

Constraints:

- unique `(requested_by_principal_id, idempotency_key_hash)`;
- `retry_of_run_id` references `item_selection_runs(id)` with
  `ON DELETE RESTRICT`;
- `retry_of_run_id <> id`; an initial run stores `null`;
- a retry may reference only an existing terminal run and always inserts a new
  run row rather than changing the referenced run;
- terminal rows cannot return to `RUNNING`;
- `completed_at` is required exactly for terminal states;
- run version columns and request identity are immutable after insert.
- all counts are non-negative and
  `observed_candidate_count = successfully_evaluated_count
  + failed_candidate_count + skipped_candidate_count`;
- terminal success requires
  `persisted_evaluation_count = successfully_evaluated_count`.

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
| `canonical_snapshot_text` | `text not null` | authoritative canonical UTF-8 JSON text |
| `snapshot_projection` | `jsonb not null` | query-only JSONB projection |
| `snapshot_sha256` | `text generated always` | digest of exact snapshot text UTF-8 bytes |
| `canonical_evidence_text` | `text not null` | authoritative canonical UTF-8 evidence JSON text |
| `evidence_projection` | `jsonb not null` | query-only JSONB projection |
| `provider_evidence_sha256` | `text generated always` | digest of exact evidence text UTF-8 bytes |
| `created_at` | `timestamptz not null` | database time |

Constraints:

- unique `(run_id, provider_item_number)`;
- check constraints bound score/coverage/margin units;
- canonical texts must parse as JSON objects with approved `schemaVersion`
  fields, and each JSONB projection must equal its text parsed as JSONB;
- evaluation rows are append-only and immutable;
- `ON DELETE RESTRICT` preserves history.

No Product, listing, supplier, procurement, order, or marketplace table is
created or updated by Story 3.

## 6. Decision values, VAT, projections, and rounding

The current profitability engine uses JavaScript binary64 arithmetic. In
particular, deductible VAT computes `amountKrw / 1.1`; its mathematical result
can be a repeating decimal and therefore cannot always be represented exactly
as micro-won. Architecture must preserve what the approved engine actually
decided, not pretend that every intermediate value is a fixed-scale integer.

Authoritative decision representation:

- Every numeric input and output that can affect a verdict is stored in the
  canonical snapshot as the shortest canonical decimal string that round-trips
  to the identical IEEE-754 binary64 value used by the engine.
- Because Story 2 `MoneyFact.amountKrw` is a JavaScript `number`, the persisted
  money fact string is the canonical round-trip decimal string generated from
  the binary64 input value received by Story 2. It is not represented as an
  untouched supplier-origin numeric string.
- Preserving a future provider's original numeric token/string is a separate
  provider-ingestion contract and must not be inferred from `MoneyFact`.
- The Story 2 input canonical string, VAT treatment, policy version, and
  profitability calculation contract version are stored beside the resulting
  decision value.
- VAT semantics are additionally expressible as a rational operation:
  deductible VAT-inclusive amount uses numerator `10` and denominator `11`
  against the original amount. This rational provenance explains a repeating
  result but does not replace the captured binary64 value used by v1.
- Replay is successful only when the archived engine/version produces the same
  canonical decision strings and output hash from the same canonical inputs.
- PostgreSQL numeric casts, micro-won, ppm, display values, or JSONB numbers are
  never verdict-authoritative.

Query projections:

- Money and raw scenario projections use signed `bigint` micro-won:
  `krwMicros = round(canonicalKrw × 1,000,000)`.
- Rates, margins, weights, scores, and coverage projections use scaled signed
  integers such as parts-per-million:
  `rateUnits = round(canonicalRatio × 1,000,000)`.
- Projection rounding is decimal round-to-nearest with exact half ties away
  from zero. Overflow is rejected; a non-exact projection is allowed and
  remains explicitly marked as derived.
- Projections exist only for indexes, filtering, sorting, and display. They
  must never be used to recalculate profitability, thresholds, or verdicts.
- Historical reads that display a decision use the stored engine display value
  or derive a display from the authoritative canonical string under the stored
  display-rule version, never from the projection.
- Integral MOQ and observed counters use constrained integers.
- Display won and display percentages are derived values stored only inside the
  immutable result snapshot for historical UI reproduction; they are never
  used to recalculate a verdict.
- VAT is an explicit enum:
  `VAT_EXCLUSIVE`, `VAT_INCLUSIVE_DEDUCTIBLE`,
  `VAT_INCLUSIVE_NON_DEDUCTIBLE`, or `TAX_EXEMPT`.
- Every money/rate fact stores the canonical round-trip decimal string derived
  from the binary64 value received by Story 2,
  derived integer projections, source type, safe source reference,
  `effectiveFrom`, `includedIn`, VAT treatment, and confirmation status.
- Engine outputs persist canonical decision strings plus the engine-produced
  display value. Historical reads return those stored values and never run a
  newer decision or rounding rule.

The one-million projection scale exactly represents approved v1 constants such
as `10.9%`, `12.5%`, `18%`, and `20%`, but it is not assumed to exactly
represent every VAT-derived amount or future value. Story 3 must add repeating
decimal, half-tie, negative-profit, and overflow projection tests.

## 7. Immutable evaluation snapshot

`canonical_snapshot_text` is authoritative versioned canonical JSON text
containing:

- snapshot schema version;
- ruleset, evaluator, profitability policy, and profitability calculation
  contract versions;
- provider and item identity;
- original position and observation timestamps;
- all five hard-gate inputs with status and their existing evidence contract,
  including `observedAt` and reference where present;
- all six score-area inputs, normalized values, and the evidence/missing-fact
  fields currently defined by the evaluator contract;
- complete profitability input facts and all base, stress,
  current-effective, and normalized scenario outputs;
- missing, estimated, and not-applicable facts;
- score coverage, score, verdict, reasons, risks, and next actions;
- canonical decision-value strings and derived integer projections;
- engine input and output hashes.

Canonicalization rules:

- UTF-8, Unicode NFC strings;
- object keys sorted by Unicode code point;
- array order preserved where semantically ordered and sorted by explicit key
  where the contract declares a set;
- no `undefined`, `NaN`, infinity, executable content, raw secrets, or raw
  provider payloads;
- timestamps normalized to UTC RFC 3339 with explicit precision;
- verdict-relevant numbers encoded as canonical decimal strings, not JSON
  numeric literals;
- no insignificant whitespace and one terminal newline policy fixed by the
  snapshot schema version.

PostgreSQL `jsonb` is not a byte-preserving canonical store: it normalizes
numbers, discards whitespace, and does not preserve input key order. Therefore:

- exact canonical snapshot and evidence text is stored in `text`, whose UTF-8
  bytes are authoritative;
- JSONB columns are derived query projections only and may reorder keys;
- `snapshot_sha256`, `provider_evidence_sha256`, and candidate-failure hashes
  are generated in PostgreSQL as lowercase hex SHA-256 of
  `convert_to(authoritative_text, 'UTF8')`;
- the migration explicitly enables and verifies the supported `pgcrypto`
  `digest` function in disposable replay before creating generated hashes;
- the transaction function parses the text, verifies its schema/version,
  verifies the supplied JSONB projection equals `text::jsonb`, and never
  accepts a caller-supplied authoritative hash;
- the application computes the same digest before insert and verifies the
  database-generated digest returned after commit;
- byte-for-byte reproduction returns the stored text bytes. Re-serializing the
  JSONB projection is never considered reproduction.

If canonical binary attachments are approved later, they use a separate
`bytea` object with its own media type and digest. V1 snapshots and evidence
remain UTF-8 text.

## 8. Story 3 persistence aggregate DTO

The repository persists one explicit, versioned write aggregate per evaluated
candidate. Story 3 names the TypeScript write type
`ItemSelectionPersistenceAggregateV1`; its minimum contract is:

```text
schemaVersion
rulesetVersion
evaluatorVersion
profitabilityPolicyVersion
profitabilityCalculationContractVersion
providerFacts
profitabilityInput
profitabilityResult
evaluatorInput
evaluatorOutput
hashes:
  providerFacts
  profitabilityInput
  profitabilityResult
  evaluatorInput
  evaluatorOutput
  aggregate
retryOfRunId
originalPosition
```

- `providerFacts` is exactly the sanitized Domeggook fact contract; no raw
  provider payload is admitted.
- `profitabilityInput` and complete `profitabilityResult` use the merged Story
  2 contracts, including every scenario, cost line, missing/estimated facts,
  and decision booleans.
- `profitabilityCalculationContractVersion` identifies the calculation
  implementation contract independently of `profitabilityPolicyVersion`. For
  v1 it is `gonggamline-profitability-calculation-v1`.
- `evaluatorInput` and `evaluatorOutput` use the merged Story 1 contracts.
- Every stage is independently canonicalized and hashed. The decision aggregate
  hash covers, in fixed order, the schema, ruleset, evaluator, profitability
  policy, and profitability calculation contract versions; provider,
  profitability input/result, and evaluator input/output stage hashes;
  provider item identity; original position; and nullable `retryOfRunId`.
- The write DTO uses camelCase `retryOfRunId`; the repository maps it exactly to
  `item_selection_runs.retry_of_run_id`. Initial runs require `null`. A retry
  requires the referenced terminal run ID and creates a new run.
- Persistence metadata is storage provenance and is not injected into domain
  inputs or stage hashes, except the aggregate envelope declares its metadata
  schema separately.
- `observedAt` belongs only to a source fact/evidence contract that currently
  defines it. Story 3 must not invent `effectiveDate`, freshness, or observation
  fields on domain types that do not have them.
- The persistence write DTO does not accept `persistedAt`. PostgreSQL generates
  authoritative `created_at` using database time in the commit transaction.
- After commit, the repository reads `created_at` and returns it as
  `persistedAt` only in `ItemSelectionPersistenceResultV1`.
- `persistedAt` is excluded from verdict inputs, every stage hash, and the
  decision aggregate hash. If an API later needs a tamper-evident persistence
  envelope, it uses a separately named `persistenceEnvelopeHash` covering the
  decision aggregate hash, database IDs, and `persistedAt`; it never changes or
  replaces the decision aggregate hash.
- `persistedAt`, database `created_at`, run start/completion times, and
  reconciliation times are persistence metadata. They are never treated as
  provider observation time, policy effective time, or score freshness.
- Where current domain inputs lack freshness, the aggregate records absence
  exactly; it does not synthesize freshness from persistence time.

## 9. Provider fact and source evidence

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

## 10. Reproducibility and policy preservation

Historical reproduction has two levels:

1. Exact decision reproduction: return stored authoritative canonical texts,
   outputs, hashes, and versions byte-for-byte.
2. Engine replay verification: run the archived implementation for the stored
   `profitabilityCalculationContractVersion` and `evaluatorVersion` against the
   stored canonical input, then compare every canonical stage output hash and
   the decision aggregate hash.

Policy constants are not loaded from mutable database settings. Each released
policy version remains in code and tests. Removing a version requires a
separate retention/supersession decision and cannot invalidate stored history.
Profitability replay requires both the stored policy version and calculation
contract version; equal policy versions never imply equal implementations. If
an archived calculation/evaluator implementation is unavailable, the record
remains auditable but is explicitly reported as
`REPLAY_IMPLEMENTATION_UNAVAILABLE`; it is never recalculated using the latest
policy or implementation.

## 11. Transaction, finalization, and idempotency

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
4. Call one transaction function with the ordered evaluation hashes, safe
   failure envelope hash, and all five counts. It inserts all evaluation rows,
   verifies versions and count invariants, and atomically transitions the run
   to `COMPLETED`, `PARTIAL`, or `FAILED`.
5. On transaction failure, no evaluation is reported as persisted and the run
   remains recoverable.

Finalization state contract:

- `RUNNING` accepts exactly one first finalization. The function locks the run,
  validates its request/version identity, canonical failure bytes, aggregate
  hashes, row set, and counts, then commits rows and the terminal state in one
  transaction.
- A terminal run called again with the identical terminal status, ordered
  evaluation hashes, failure hash, and counts returns the existing persisted
  aggregate without inserting or updating anything.
- A terminal run called with any different status, hash, candidate identity,
  ordering, or count returns an idempotency conflict. It never overwrites the
  first terminal result.
- `COMPLETED` means every observed candidate was successfully evaluated and
  persisted:
  `observed = successfullyEvaluated = persisted`, with failed and skipped zero.
- `PARTIAL` means at least one evaluation was successfully persisted and at
  least one observed candidate failed or was skipped:
  `persisted = successfullyEvaluated > 0` and
  `failed + skipped > 0`.
- `FAILED` means no usable evaluation was persisted:
  `persisted = successfullyEvaluated = 0`. It covers run-level failure before
  candidates are observed or the case where every observed candidate failed or
  was skipped.
- `FAILED` and `PARTIAL` are terminal and immutable in v1. Reprocessing creates
  a new run with a new idempotency key and write-DTO `retryOfRunId`, mapped to
  database `retry_of_run_id`; it never appends to or upgrades the old run.
- A stale `RUNNING` run may be terminalized as `FAILED` only by the separately
  authorized reconciliation function after proving no finalization committed.
  It stores the allowlisted stale-run code and zero persisted evaluations.

Count definitions and safe failure preservation:

- `observedCandidateCount` counts distinct, provider-valid, normalized
  candidates accepted from the bounded search response after deduplication.
- `successfullyEvaluatedCount` counts candidates for which the complete
  profitability result and evaluator output were produced.
- `persistedEvaluationCount` is the number of immutable evaluation rows
  committed in the same finalization transaction.
- `failedCandidateCount` counts attempted candidates that produced no complete
  evaluator output.
- `skippedCandidateCount` counts observed candidates deliberately not attempted
  under an allowlisted rule such as a validated capacity or duplicate policy;
  v1 deduplication before observation is not counted as skipped.
- Safe failure entries contain only provider item number, original position,
  failure stage, allowlisted code, retryable flag, and sanitized evidence
  reference. They exclude exception text, raw payload, keyword, secret, stack,
  and personal data.
- The canonical failure text and digest are immutable even when the source
  later recovers.

Database functions use a fixed `search_path`, explicit input types,
least-privilege grants, and no dynamic SQL.

## 12. Environment separation and secrets

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

## 13. Authorization dependency

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

## 14. Migration and Production data protection

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

## 15. Retention, backup, and recovery

V1 retention principles:

- Runs, evaluation canonical texts, stage hashes, safe failure envelopes,
  evidence metadata, policy/version identifiers, and audit timestamps are
  retained indefinitely until a separately approved retention Architecture and
  legal/business policy supersedes v1.
- Evaluation and evidence rows are append-only. Retention is not implemented as
  cascade delete, mutable anonymization, or silent compaction.
- Provider evidence links may expire. Each evaluation therefore preserves the
  allowlisted observed facts, evidence type, observation time when the source
  contract provides it, safe reference, permitted descriptive excerpt or
  metadata, and content digest when collection rights allow it.
- If an original link disappears, the historical snapshot remains unchanged
  and is marked at read time as `SOURCE_LINK_UNAVAILABLE`. The system never
  rewrites the original confirmation state. A new sale or re-evaluation that
  requires current evidence must collect fresh evidence; a dead link is not
  silently treated as current proof.
- Copyrighted/raw provider pages are not copied merely to prevent link decay.
  Full content storage requires separate legal approval and an allowlisted
  evidence type.

Backup baseline:

- Production must have provider-supported automated backups enabled before the
  first evaluation write.
- The required logical retention target is daily recovery points for at least
  35 days and one verified monthly recovery artifact for at least 12 months.
  If the selected Supabase plan cannot meet it, Production enablement remains
  blocked until the owner accepts a different plan or backup design.
- Backup artifacts and encryption keys use a Production-only access boundary;
  they must not be copied into CI, Preview, source control, or application logs.
- A checksum, schema version, backup time, and restoration test result are
  recorded without exposing snapshot contents.

Recovery assurance:

- Restore into an isolated non-Production project at least quarterly and before
  any material migration baseline change.
- Verify schema fingerprints, row counts, foreign keys, canonical text hashes,
  generated digests, JSONB projection equivalence, and a sampled archived
  engine replay.
- Database / Security owns the recovery procedure. The repository owner and
  Database / Security jointly approve Production RPO and RTO before Story 3
  Production release.
- Proposed launch targets are RPO no greater than 24 hours and RTO no greater
  than 8 hours. They are not accepted commitments until owner approval is
  recorded.
- A failed restore drill, missing digest, or unmet retention/RPO/RTO target
  blocks Production migration or further evaluation writes until resolved.

## 16. Observability and failure handling

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

## 17. Story 3 implementation handoff

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
- binary64 round-trip decimal, repeating VAT, rational provenance,
  micro-won/ppm projection rounding, negative value, and overflow tests;
- snapshot canonicalization golden tests;
- authoritative text byte, database-generated digest, and JSONB projection
  equivalence tests;
- profitability policy/calculation-version independence, missing implementation
  version, and replay-version mismatch tests;
- transaction rollback and retry tests;
- first finalization, identical terminal replay, divergent terminal conflict,
  count invariant, and new-run retry tests;
- `retry_of_run_id` FK/restrict/self-reference/terminal-target tests and
  `retryOfRunId` repository mapping tests;
- database-generated `created_at` and post-commit `persistedAt` result tests
  proving write DTO and decision hashes exclude persistence time;
- immutable-row and delete-restriction tests;
- positive/negative RLS tests;
- no secrets/raw provider payload in rows or logs;
- lint, typecheck, full tests, Production build, and applicable read-only
  browser checks.

## 18. Owner review checklist

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
