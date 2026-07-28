# Item Selection Security Vertical Slice Implementation Instruction

## 1. Authority and execution gate

- Status: prepared for repository-owner review; implementation is not
  authorized.
- Required base: `main` exact head
  `cca761a1a49a39265a75a3a03bb15e81c004def8`.
- Risk: high-risk/manual because the later implementation changes migration,
  Auth, authorization, RLS, CSRF, and server-secret boundaries.
- Accepted authorities:
  - `docs/architecture/ADMIN-IDENTITY-AUTHORIZATION-RLS-CSRF-V1.md`;
  - `docs/architecture/ITEM-SELECTION-DATABASE-BASELINE-V1.md`;
  - merged Sprint B-0 migration baseline 000–020 and
    `supabase/baseline-manifest.json`.
- Delivery after separate approval: one implementation branch, one Draft PR,
  and `manual-merge-required`; no auto-merge.

This document fixes the exact scope and acceptance contract for the next
implementation Story. Its existence does not authorize a branch, migration,
code, configuration, Preview identity, Production access, or deployment.

## 2. Repository evidence and naming decisions

The base contains migrations 000–020 and no Item Selection persistence table,
security-audit table, Admin Auth route, Supabase SSR module, service-role
module, or Item Selection repository. The only existing Supabase application
module, `lib/supabase.ts`, is the public anon-key client and is not an approved
service-role boundary.

The accepted Database Architecture fixes the Item Selection tables and
columns, but deliberately leaves exact SQL function names to the implementation
Story. The accepted Admin Architecture fixes the Auth, AAL, CSRF, direct-access,
service-role, and audit invariants, but likewise leaves exact implementation
paths to this Story. Therefore this instruction selects the following new names
without changing either Architecture:

- protected resource: `ItemSelectionRun` aggregate;
- migration:
  `supabase/migrations/021_item_selection_security_vertical_slice.sql`;
- protected tables:
  - `public.item_selection_runs`;
  - `public.item_selection_evaluations`;
  - `public.security_audit_events`;
- transaction functions:
  - `public.create_item_selection_run_v1`;
  - `public.finalize_item_selection_run_v1`;
- typed finalization input:
  `public.item_selection_evaluation_write_v1`;
- service-role constructor:
  `lib/supabase/service-role.server.ts`;
- sole service-role importer:
  `services/item-selection-run.repository.ts`.

There is no other protected resource in this slice.

## 3. Fixed scope and exclusions

The only allowed business operations are:

1. read one `ItemSelectionRun` aggregate by run UUID;
2. create one `RUNNING` aggregate;
3. finalize that aggregate once, including zero or more immutable evaluation
   rows and the terminal run state.

The slice explicitly excludes:

- list, search, update, delete, and bulk operations;
- provider search or orchestration;
- the full Story 3 persistence/API surface beyond this aggregate;
- reconciliation of stale runs;
- retry workflow orchestration, although nullable `retry_of_run_id` is stored
  and validated by the create function;
- Product, listing, price, procurement, inventory, order, or marketplace
  writes;
- an Item Selection operating UI;
- an administrator organization-management UI;
- a smoke-only page;
- Production migration execution, Production deployment, Production Auth
  configuration, real administrator UUIDs, and real secret values;
- `auth.sessions`, a revocation ledger, custom Auth Hooks, automatic invitation
  or retirement, automatic MFA reset, break-glass automation, multi-admin
  organization management, and telemetry lease/freeze/recovery state machines.

Preview validation uses the Admin login surface and API-based browser smoke. It
does not add an Item Selection operating UI or a smoke-only page.

## 4. Migration 021 contract

Exactly one migration is allowed:
`supabase/migrations/021_item_selection_security_vertical_slice.sql`.

Migrations 000–020 and their manifest hashes must not be edited, deleted,
renamed, reordered, or regenerated. Migration 021 contains only:

- `public.item_selection_runs`;
- `public.item_selection_evaluations`;
- `public.security_audit_events`;
- `public.item_selection_evaluation_write_v1`;
- the two transaction functions fixed below;
- constraints, indexes, grants, revokes, and RLS for those objects.

The implementation must append migration 021 to
`supabase/baseline-manifest.json` using the existing canonical LF SHA-256
contract. A fresh disposable replay must apply migration 000–021 in exact
order.

### 4.1 `public.item_selection_runs`

The table uses the columns and constraints from Database Architecture section
5 without omission:

`id`, `provider`, `keyword`, `requested_size`, `status`,
`ruleset_version`, `evaluator_version`, `profitability_policy_version`,
`profitability_calculation_contract_version`, `request_fingerprint`,
`idempotency_key_hash`, `retry_of_run_id`, `requested_by_principal_id`,
`started_at`, `completed_at`, `failure_code`,
`observed_candidate_count`, `successfully_evaluated_count`,
`persisted_evaluation_count`, `failed_candidate_count`,
`skipped_candidate_count`, `candidate_failures_canonical_text`,
`candidate_failures_projection`, `candidate_failures_sha256`, and
`created_at`.

Database-generated UUIDs and timestamps use PostgreSQL defaults. Provider v1 is
constrained to `domeggook`. Counts, terminal states, retry lineage,
idempotency, immutability, and delete restriction follow the accepted Database
Architecture exactly.

### 4.2 `public.item_selection_evaluations`

The table uses the columns and constraints from Database Architecture section
5 without omission:

`id`, `run_id`, `provider_item_number`, `original_position`, `verdict`,
`total_score_units`, `coverage_units`, `normalized_margin_units`,
`normalized_profit_krw_micros`, `canonical_snapshot_text`,
`snapshot_projection`, `snapshot_sha256`, `canonical_evidence_text`,
`evidence_projection`, `provider_evidence_sha256`, and `created_at`.

Rows are immutable and delete-restricted. Canonical text is authoritative;
JSONB and scaled numeric values are projections only.

### 4.3 `public.security_audit_events`

This is the single audit table allowed in the slice:

| Column | SQL type | Contract |
|---|---|---|
| `id` | `uuid primary key` | database-generated |
| `administrator_user_id` | `uuid not null` | exact allowlisted Auth user UUID |
| `event_code` | `text not null` | `ITEM_SELECTION_CREATE` or `ITEM_SELECTION_FINALIZE` only |
| `route` | `text not null` | exact route template from section 7 |
| `correlation_id` | `uuid not null` | server-generated request correlation UUID |
| `result` | `text not null` | `SUCCEEDED` only for the transaction-committed event |
| `created_at` | `timestamptz not null` | database-generated transaction time |

The table has no email, cookie, token, keyword, snapshot, evidence, raw payload,
secret, or stack-trace column. Rows are append-only and delete-restricted.
Pre-RPC denial events remain sanitized server telemetry in this slice; no
out-of-transaction mandatory failure-audit contract is introduced.
The accepted Architecture's broader denial-event audit requirement remains
binding but incomplete after this slice and requires a separately approved
follow-up before Production enablement; this instruction does not weaken or
replace it.

### 4.4 Typed evaluation input

`public.item_selection_evaluation_write_v1` is a composite type, not a table or
callable function. Its ordered fields are:

1. `provider_item_number text`;
2. `original_position integer`;
3. `verdict text`;
4. `total_score_units integer`;
5. `coverage_units integer`;
6. `normalized_margin_units integer`;
7. `normalized_profit_krw_micros bigint`;
8. `canonical_snapshot_text text`;
9. `canonical_evidence_text text`.

The transaction function parses and validates the two canonical texts against
their approved schema versions, derives their JSONB projections and database
digests, and rejects unknown fields or invalid projections. No unbounded JSON
argument replaces this type.

## 5. Exact transaction functions

Both functions are `SECURITY DEFINER`, owned by `postgres`, contain no dynamic
SQL, and declare:

```sql
SET search_path = pg_catalog, public
```

For both signatures:

- `REVOKE ALL ... FROM PUBLIC`;
- `REVOKE ALL ... FROM anon`;
- `REVOKE ALL ... FROM authenticated`;
- `GRANT EXECUTE ... TO service_role`;
- no browser/user-JWT role receives `EXECUTE`.

### 5.1 Create

Exact signature and argument order:

```sql
public.create_item_selection_run_v1(
  p_provider text,
  p_keyword text,
  p_requested_size integer,
  p_ruleset_version text,
  p_evaluator_version text,
  p_profitability_policy_version text,
  p_profitability_calculation_contract_version text,
  p_request_fingerprint text,
  p_idempotency_key_hash text,
  p_retry_of_run_id uuid,
  p_requested_by_principal_id text,
  p_route text,
  p_correlation_id uuid
) RETURNS public.item_selection_runs
```

The function validates the canonical administrator UUID text, exact route
`/api/admin/item-selection/runs`, provider, bounded keyword/requested size,
version identifiers, SHA-256 fields, idempotency, and retry lineage. It inserts
or returns the idempotent existing `RUNNING` row, inserts one
`ITEM_SELECTION_CREATE`/`SUCCEEDED` audit row, and returns the committed run.
A reused idempotency hash with a different request fingerprint raises a
conflict. Any validation, run insert, or audit insert failure rolls back the
entire function.

### 5.2 Finalize

Exact signature and argument order:

```sql
public.finalize_item_selection_run_v1(
  p_run_id uuid,
  p_terminal_status text,
  p_expected_request_fingerprint text,
  p_expected_ruleset_version text,
  p_expected_evaluator_version text,
  p_expected_profitability_policy_version text,
  p_expected_profitability_calculation_contract_version text,
  p_evaluations public.item_selection_evaluation_write_v1[],
  p_candidate_failures_canonical_text text,
  p_observed_candidate_count integer,
  p_successfully_evaluated_count integer,
  p_failed_candidate_count integer,
  p_skipped_candidate_count integer,
  p_failure_code text,
  p_requested_by_principal_id text,
  p_route text,
  p_correlation_id uuid
) RETURNS public.item_selection_runs
```

The function locks the run row, validates the canonical administrator UUID,
exact route `/api/admin/item-selection/runs/[id]/finalize`, run identity,
versions, canonical failure text, ordered evaluation identity, terminal state,
counts, and every evaluation projection. It derives
`persisted_evaluation_count` from inserted rows. It implements the accepted
first-finalization, identical terminal replay, divergent replay conflict,
`COMPLETED`/`PARTIAL`/`FAILED`, and immutable-history contracts.

The first finalization inserts all evaluations, updates the run terminal state,
inserts one `ITEM_SELECTION_FINALIZE`/`SUCCEEDED` audit row, and returns the
committed run. Identical terminal replay returns the existing run without a new
business row or audit row. Any validation, evaluation insert, run update, or
audit insert failure rolls back the entire function.

The Route Handler must not split either business mutation and its audit insert
into separate service-role requests.

## 6. Grants, RLS, and direct-access boundary

Migration 021 must:

- enable and force RLS on all three protected tables;
- revoke all table privileges from `PUBLIC`, `anon`, and `authenticated`;
- revoke all sequence privileges from `PUBLIC`, `anon`, and `authenticated`;
- grant `service_role` only `SELECT` on the three tables;
- grant `service_role` only `EXECUTE` on the two transaction functions;
- create no permissive policy for `anon` or `authenticated`;
- expose no mutation function other than the two named functions;
- preserve service-role `BYPASSRLS` as an explicitly accepted residual risk.

The read repository may use its isolated service-role client for the
allowlisted single-run query. Create and finalize may call only their matching
RPC. Route Handlers may not query Supabase directly.

## 7. Exact HTTP and Auth surface

### 7.1 Business routes

| Path | Method | Repository/DB call | Request | Response | Auth/AAL | Origin/CSRF/type | Rate | Audit | Status |
|---|---|---|---|---|---|---|---|---|---|
| `/api/admin/item-selection/runs/[id]` | `GET` | `getItemSelectionRunById` selects the run and its evaluations | UUID path only | allowlisted run DTO with evaluations; no raw secret/evidence payload | `getUser()`, allowlisted UUID, AAL1 or AAL2 | no body; CSRF not required; reject a supplied body | 30 reads per administrator per rolling 60 seconds | no database audit | `200`, `400`, `401`, `403`, `404`, `429`, `500` |
| `/api/admin/item-selection/runs` | `POST` | `createItemSelectionRun` → `create_item_selection_run_v1` | `ItemSelectionRunCreateRequestV1`; required `Idempotency-Key` header | created/idempotent run DTO | `getUser()`, allowlisted UUID, fresh AAL2 and JWT `iat` age ≤60 seconds | exact Origin, same-site fetch metadata, JSON, valid create-purpose CSRF | create+finalize combined: 10 per administrator per rolling 60 seconds | atomic `ITEM_SELECTION_CREATE` | `201` new, `200` identical replay, `400`, `401`, `403`, `409`, `415`, `429`, `500` |
| `/api/admin/item-selection/runs/[id]/finalize` | `POST` | `finalizeItemSelectionRun` → `finalize_item_selection_run_v1` | UUID path plus `ItemSelectionRunFinalizeRequestV1` | terminal/idempotent run DTO | `getUser()`, allowlisted UUID, fresh AAL2 and JWT `iat` age ≤60 seconds | exact Origin, same-site fetch metadata, JSON, valid finalize-purpose CSRF | create+finalize combined: 10 per administrator per rolling 60 seconds | atomic `ITEM_SELECTION_FINALIZE` on first finalization only | `200`, `400`, `401`, `403`, `404`, `409`, `415`, `429`, `500` |

`ItemSelectionRunCreateRequestV1` contains only:

`provider`, `keyword`, `requestedSize`, `rulesetVersion`,
`evaluatorVersion`, `profitabilityPolicyVersion`,
`profitabilityCalculationContractVersion`, `requestFingerprint`, and nullable
`retryOfRunId`. The raw idempotency key is accepted only in the header, hashed
server-side, and never stored or logged. Principal, route, and correlation ID
are server-derived.

`ItemSelectionRunFinalizeRequestV1` contains only:

`terminalStatus`, `expectedRequestFingerprint`, `expectedRulesetVersion`,
`expectedEvaluatorVersion`, `expectedProfitabilityPolicyVersion`,
`expectedProfitabilityCalculationContractVersion`, ordered `evaluations`,
`candidateFailuresCanonicalText`, `observedCandidateCount`,
`successfullyEvaluatedCount`, `failedCandidateCount`,
`skippedCandidateCount`, and nullable `failureCode`. Each `evaluations` member
maps exactly to the composite fields in section 4.4. Principal, run ID, route,
and correlation ID are server/path-derived.

The response DTO contains only the run identifiers, status, versions, safe
counts, safe failure code, database timestamps, and for the GET/finalize
response the allowlisted evaluation identity/verdict/projection fields.
Canonical snapshots and evidence text are not returned by this slice.

### 7.2 Auth and CSRF routes

| Path / method | Module/API call | Request / response | Auth and AAL | Origin, CSRF, type | Rate | Audit | Status |
|---|---|---|---|---|---|---|---|
| `/admin/login` `GET` page | `app/admin/login/page.tsx`; no DB call | no request body; minimal sign-in/TOTP form HTML | public; existing session may be displayed only as signed-in/signed-out | no CSRF; no body | 30 per client IP per rolling 60 seconds | none | `200` |
| `/api/admin/auth/login` `POST` | `supabase-ssr.server.ts` password sign-in; no DB call | JSON `{ email, password }`; success `{ authenticated: true }`, failure `{ code: "AUTHENTICATION_FAILED" }`, without UUID/email echo | public entry; resulting session starts at provider-reported AAL | exact Origin and JSON; no pre-session CSRF | 10 per client IP per rolling 60 seconds | sanitized server telemetry only | `200`, `400`, `403`, `415`, `429`, `500` |
| `/api/admin/auth/callback` `GET` | pinned SSR `exchangeCodeForSession`; no DB call | one `code` query value; safe redirect to `/admin/login` | public PKCE callback; provider validates code | exact configured callback origin; no body/CSRF | 30 per client IP per rolling 60 seconds | sanitized server telemetry only | `303`, `400`, `403`, `429`, `500` |
| `/api/admin/auth/mfa/challenge` `POST` | pinned Supabase MFA challenge; no DB call | JSON `{ factorId: string }`; `{ challengeId: string }` | `getUser()`, allowlisted UUID, AAL1 or AAL2 | exact Origin, valid session-purpose CSRF, JSON | 10 per administrator per rolling 60 seconds | sanitized server telemetry only | `200`, `400`, `401`, `403`, `415`, `429`, `500` |
| `/api/admin/auth/mfa/verify` `POST` | pinned Supabase MFA verify; no DB call | JSON `{ factorId: string, challengeId: string, code: string }`; `{ assurance: "aal2" }` | `getUser()`, allowlisted UUID; successful response requires fresh provider-reported AAL2 | exact Origin, valid session-purpose CSRF, JSON | 10 per administrator per rolling 60 seconds | sanitized server telemetry only | `200`, `400`, `401`, `403`, `415`, `429`, `500` |
| `/api/admin/auth/csrf` `GET` | `csrf.server.ts`; no DB call | exact query `purpose=item-selection-create`, `item-selection-finalize`, or `admin-session`; `{ token, expiresAt }` plus cookie | `getUser()`, allowlisted UUID; AAL1 for session purpose, fresh AAL2 for mutation purposes | no request CSRF/body; response token is purpose-bound | 30 per administrator per rolling 60 seconds | none | `200`, `400`, `401`, `403`, `429`, `500` |
| `/api/admin/auth/logout` `POST` | pinned SSR sign-out; no DB call | empty JSON object; `{ signedOut: true }` and cookie deletion | `getUser()`, allowlisted UUID, AAL1 or AAL2 | exact Origin, valid session-purpose CSRF, JSON | 30 per administrator per rolling 60 seconds | sanitized server telemetry only | `200`, `400`, `401`, `403`, `415`, `429`, `500` |

No route calls an Auth Admin API. Repository-owner Dashboard provisioning
remains manual.

The implementation pins `@supabase/supabase-js` to `2.110.7` and
`@supabase/ssr` to `0.12.3`, the compatible pair already recorded in the
repository's reviewed Architecture history. A12 must prove the current official
API paths before delivery.

## 8. Request guard contracts

### 8.1 Administrator allowlist

`lib/auth/admin-allowlist.server.ts` exclusively parses
`GONGGAMLINE_ADMIN_USER_IDS`:

- input is a trimmed comma-separated UUID string;
- missing input or an input empty after trimming fails closed;
- an empty member such as `a,,b` is an error;
- malformed UUID fails fast at startup or the first server evaluation;
- UUIDs normalize to canonical lowercase text;
- duplicates are canonically deduplicated;
- the module is marked `server-only`;
- neither values nor configuration presence reach browser code, responses,
  logs, traces, or build artifacts.

### 8.2 Per-request identity and assurance

`lib/auth/admin-request-guard.server.ts` performs, in order:

1. recover cookies using `lib/auth/supabase-ssr.server.ts`;
2. call Supabase Auth `getUser()` for every protected request;
3. reject missing user with 401;
4. reject a UUID absent from the allowlist with 403;
5. require AAL1 for read;
6. require `aal = aal2` and JWT `iat` age no greater than 60 seconds for create
   and finalize;
7. return an immutable guard context containing only administrator UUID, AAL,
   JWT issued-at time, server session identity, route, and correlation ID.

Local JWT decoding never replaces `getUser()`. It may read already verified
claims only after `getUser()` succeeds.

Logout revokes refresh capability but does not promise immediate access-JWT
revocation. An issued JWT may authorize a protected read until its configured
15-minute expiry. Mutation still requires the separate 60-second fresh-AAL2
boundary. This slice adds no `auth.sessions` access or revocation ledger.

### 8.3 Origin, JSON, and CSRF

Mutation routes require exactly one `Origin` header whose scheme, host, and
port exactly equal the configured request origin. Missing, `null`, malformed,
comma/multi-valued, or scheme/host/port-mismatched Origin is 403. Same-site
fetch metadata is also required.

Mutation routes accept only `Content-Type: application/json`; missing or other
media types are 415 before body parsing or repository access.

`lib/auth/csrf.server.ts` implements the accepted
`v1.<expiry>.<nonce>.<mac>` format:

- cookie: `__Host-gonggamline-csrf`, `Secure`, `HttpOnly`, `SameSite=Strict`,
  `Path=/`, no `Domain`;
- request header: `X-GonggamLine-CSRF`;
- `/api/admin/auth/csrf?purpose=item-selection-create` and
  `?purpose=item-selection-finalize` return the same signed token in an
  allowlisted JSON response for in-memory client use and set the HttpOnly
  cookie;
- MAC input binds exact purpose, administrator UUID, verified JWT session
  identity, expiry, and nonce;
- expiry is at most 15 minutes;
- mutation requires exact cookie/header equality and constant-time MAC
  comparison;
- wrong purpose, subject, session identity, format, expiry, nonce, cookie,
  header, or MAC is 403 before repository access;
- tokens rotate on sign-in, refresh, AAL change, logout, or expiry.

### 8.4 Rate limit

`lib/auth/admin-rate-limit.server.ts` owns a server-only, process-local rolling
window used only for disposable and Preview proof:

- key: authenticated administrator UUID;
- read bucket: 30 requests per rolling 60 seconds;
- shared mutation bucket: create plus finalize, 10 requests per rolling 60
  seconds;
- request 31 for read or request 11 for combined mutation returns 429;
- rejection occurs before repository or transaction-function invocation;
- tests inject a monotonic clock and prove both exact boundaries.

This limiter does not claim distributed Production enforcement. Production is
blocked by this instruction; a separately approved Production enablement must
prove or replace the limiter for the deployed topology.

## 9. Service-role isolation

Only `lib/supabase/service-role.server.ts` constructs the secret/service-role
client. It:

- imports `server-only`;
- reads the environment-scoped server secret only at call time;
- never exports the secret or an unguarded singleton;
- accepts a valid same-request guard context before returning a scoped client;
- emits no secret-bearing error or log.

The complete import allowlist is exactly:

```text
services/item-selection-run.repository.ts
  -> lib/supabase/service-role.server.ts
```

No other file may import the constructor. Route Handlers import the repository,
never the constructor. Client Components and browser bundles may import
neither module. `services/item-selection-run.repository.ts` exposes only:

- `getItemSelectionRunById`;
- `createItemSelectionRun`;
- `finalizeItemSelectionRun`.

Static import-graph tests fail any additional importer. Production build
artifact and browser-chunk scans must prove that the service-role environment
identifier and supplied synthetic secret value are absent.

## 10. A01–A12 executable acceptance matrix

All disposable tests use synthetic users, tokens, UUIDs, canonical snapshots,
and secrets. “No audit change” means no `security_audit_events` row is added.

| ID | Protected invariant | Implementation location | Disposable test file | Preview smoke | Exact principal/token | AAL and authentication age | Origin | CSRF | Content type | Exact request or DB invocation | Expected HTTP/DB result | Expected business DB state | Expected audit state | Prohibited side effect | Rollback/repository evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A01 | unauthenticated protected routes fail before data access | `lib/auth/admin-request-guard.server.ts`; three business routes | `tests/item-selection-security-disposable.test.ts` | yes | no access token | none | exact Origin for POST; not applicable to GET | absent | JSON for POST; no body for GET | GET/read, POST/create, POST/finalize | 401 | unchanged | unchanged | repository/RPC call | repository call count 0 |
| A02 | authenticated non-admin is not authorized | allowlist parser, guard, three business routes | `tests/item-selection-security-disposable.test.ts` | yes | valid non-admin JWT | AAL1 read; fresh AAL2 mutation, age 0–60 | exact | valid purpose token for POST | JSON for POST | all three business routes | 403 | unchanged | unchanged | repository/RPC call | repository call count 0 |
| A03 | AAL1 permits ordinary read but not mutation | assurance guard and three routes | `tests/item-selection-security-disposable.test.ts` | yes | allowlisted admin JWT | AAL1, age 0–60 | exact | valid purpose token for POST | JSON for POST | GET followed by both POST routes | GET 200; POST 403 | read only; no mutation | unchanged | mutation repository/RPC call | mutation repository count 0 |
| A04 | fresh AAL2 permits declared mutations | assurance/CSRF/rate guards, repository, both RPCs | `tests/item-selection-security-disposable.test.ts` | yes | allowlisted admin JWT | AAL2, age 0–60 | exact | valid create then finalize token | JSON | create POST then finalize POST | 201 then 200 | run and evaluations committed | one create and one finalize event | direct table mutation | exactly one matching RPC call per POST |
| A05 | every Origin/type/CSRF mismatch fails closed | Origin/type guard and `lib/auth/csrf.server.ts` | `tests/item-selection-security-disposable.test.ts` | yes | allowlisted admin JWT | AAL2, age 0–60 | missing, null, wrong scheme/host/port, or multi-valued per case | missing, wrong purpose/subject/session/MAC/expiry per case | JSON except missing/wrong-type cases | both POST routes for every invalid case | Origin/CSRF 403; type 415 | unchanged | unchanged | body mutation, repository/RPC call | repository and RPC counts 0 |
| A06 | user JWTs have no direct protected DB access | migration 021 grants/RLS/functions | `tests/item-selection-security-database.test.ts` | no | `anon`; non-admin/admin/logged-out-unexpired `authenticated` JWTs | irrelevant to direct Data API | not applicable | not applicable | Data API JSON | SELECT/INSERT/UPDATE/DELETE on `public.item_selection_runs`, `public.item_selection_evaluations`, and `public.security_audit_events`; EXECUTE `public.create_item_selection_run_v1` and `public.finalize_item_selection_run_v1` | permission/RLS error for every call | unchanged | unchanged | any direct row/function access | before/after catalog and row snapshot equal |
| A07 | logout blocks refresh, not necessarily unexpired access JWT | SSR Auth routes and request guard | `tests/item-selection-security-disposable.test.ts` | yes | retained access and refresh tokens after logout | retained AAL1/AAL2; mutation age >60; read before/after 15-minute expiry | exact for mutation | valid token presented to stale mutation | JSON for mutation | refresh; GET before/after expiry; mutation after 60 seconds | refresh fails; immediate access rejection not required; expired GET 401; stale mutation 403 | unchanged | unchanged | stale mutation repository/RPC call | mutation repository count 0 |
| A08 | service-role is restricted to one server import edge and absent from browser | service-role constructor, repository, import/build checks | `tests/item-selection-security-imports.test.ts` | build artifact check | no runtime principal; synthetic secret marker | not applicable | not applicable | not applicable | not applicable | scan full import graph, Client Components, `.next` browser chunks | test/build failure on extra import or marker | unchanged | unchanged | browser import, identifier, or secret marker | sole edge equals documented allowlist |
| A09 | business mutation and required audit are one rollback unit | both `SECURITY DEFINER` RPCs and audit table | `tests/item-selection-security-database.test.ts` | no | service-role integration after synthetic valid guard | fresh AAL2 route fixture, age 0–60 | exact fixture | valid fixture | JSON fixture | install disposable `test_fail_security_audit_insert` trigger; invoke create and finalize separately; remove trigger | both RPCs raise DB error | create inserts no run; finalize leaves RUNNING and no evaluations | no event committed | partial business commit | before/after transaction snapshots equal |
| A10 | exact UUID allowlist deployment controls access without Auth Admin API | allowlist parser and guard | `tests/item-selection-security-disposable.test.ts` | yes, synthetic Preview user | same valid Auth UUID absent, added, then removed | AAL1, current | not applicable to GET | not applicable | no body | GET protected run after each synthetic configuration deployment | 403, allowed response, 403 | unchanged | unchanged | Auth Admin API call | configuration and route evidence show UUID-only change |
| A11 | migration fingerprint fixes grants/RLS/policies/functions | migration 021 and expected fixture | `tests/item-selection-security-database.test.ts`; `tests/fixtures/item-selection-security-fingerprint.json` | no | disposable introspection role | not applicable | not applicable | not applicable | SQL | query catalogs after applying 021 | exact fixture match | expected three tables/type/two functions only | expected audit table fingerprint | unexpected grant/policy/object/signature | fixture diff is empty |
| A12 | pinned SDK and full baseline are executable from empty DB | replay script, package pins, CI job | `scripts/verify-item-selection-security-slice.ps1` plus disposable integration tests | no | synthetic Local/CI users and secrets only | AAL1 and fresh AAL2 integration fixtures | exact synthetic origin | valid synthetic tokens | exact route types | start empty stack; replay 000–021; login/MFA/getUser/logout; read/create/finalize | all replay/integration checks PASS | expected synthetic aggregate only; stack discarded | expected two success events | remote/linked/Production access | runner rejects Production markers, linked ref, remote URL, real secrets |

The A01–A12 identifiers and meanings are unchanged from the accepted Admin
Architecture. The additional columns make their execution and evidence
traceable.

## 11. Preview browser smoke

`tests/e2e/admin-item-selection-security.spec.ts` uses the existing Playwright
structure and the `/admin/login` surface. Each case records route, input,
status, repository/RPC evidence, business-row count, and audit-row count:

1. synthetic allowlisted administrator login succeeds;
2. synthetic non-admin GET/create/finalize returns 403;
3. missing and mismatched CSRF create/finalize returns 403;
4. AAL1 create/finalize returns 403;
5. AAL2 older than 60 seconds create/finalize returns 403;
6. fresh AAL2 create returns 201 and one atomic create audit;
7. fresh AAL2 finalize returns 200 and one atomic finalize audit.

Denied cases require repository/RPC call count 0 and no business or audit row
change. Preview uses only a dedicated non-Production project, synthetic users,
and synthetic values. It never uses Production identity or secrets.

## 12. Allowed implementation files after separate approval

The later implementation PR may change only:

- `supabase/migrations/021_item_selection_security_vertical_slice.sql`;
- `supabase/baseline-manifest.json`;
- `package.json` and `package-lock.json` for the two exact Supabase packages;
- `app/admin/login/page.tsx`;
- `app/api/admin/auth/login/route.ts`;
- `app/api/admin/auth/callback/route.ts`;
- `app/api/admin/auth/mfa/challenge/route.ts`;
- `app/api/admin/auth/mfa/verify/route.ts`;
- `app/api/admin/auth/csrf/route.ts`;
- `app/api/admin/auth/logout/route.ts`;
- `app/api/admin/item-selection/runs/route.ts`;
- `app/api/admin/item-selection/runs/[id]/route.ts`;
- `app/api/admin/item-selection/runs/[id]/finalize/route.ts`;
- `lib/auth/admin-allowlist.server.ts`;
- `lib/auth/supabase-ssr.server.ts`;
- `lib/auth/admin-request-guard.server.ts`;
- `lib/auth/csrf.server.ts`;
- `lib/auth/admin-rate-limit.server.ts`;
- `lib/supabase/service-role.server.ts`;
- `services/item-selection-run.repository.ts`;
- `shared/contracts/item-selection-persistence.ts`;
- `tests/admin-auth-contract.test.ts`;
- `tests/item-selection-security-disposable.test.ts`;
- `tests/item-selection-security-database.test.ts`;
- `tests/item-selection-security-imports.test.ts`;
- `tests/e2e/admin-item-selection-security.spec.ts`;
- `tests/fixtures/item-selection-security-fingerprint.json`;
- `scripts/verify-item-selection-security-slice.ps1`;
- `.github/workflows/ci.yml` only to execute the disposable 000–021 replay and
  A01–A12;
- the task report, changelog, and `.codex/WORK_STATUS.md`.

Any additional path requires repository-owner scope approval before editing.

## 13. Implementation checkpoints after separate approval

1. Create one task-specific non-main implementation branch from the approved
   exact main.
2. Reconfirm all 000–020 names and canonical LF hashes.
3. Pin the two SDK packages and prove their compile-time API.
4. Implement migration 021 and refresh the ordered baseline manifest.
5. Implement server-only Auth, allowlist, CSRF, rate, and service-role modules.
6. Implement the three declared Route Handlers and required Auth routes.
7. Implement A01–A12 and the exact fingerprint fixture.
8. Run empty disposable 000–021 replay and all security tests.
9. Run unit/integration, tracked-source lint, typecheck, Production build, and
   `git diff --check`.
10. Create one Draft high-risk PR with `manual-merge-required`.
11. Verify exact-head CI, Vercel Preview, and Preview browser smoke.
12. Stop for repository-owner review. Do not mark Ready, merge, configure
    Production, or start another Story.

## 14. Completion report required from the implementation Story

- branch, exact commit, and PR;
- migration 021 filename and canonical LF SHA-256;
- proof that migrations 000–020 are unchanged;
- protected tables, composite type, and exact function signatures;
- Route Handler and Auth path/method list;
- service-role constructor and sole-importer proof;
- allowlist, AAL, logout, Origin, CSRF, and rate-boundary results;
- A01–A12 result and evidence location for every ID;
- empty disposable 000–021 replay result;
- unit/integration, lint, typecheck, build, CI, Preview, and browser results;
- confirmation that Production, real UUIDs, real secrets, `node_modules`, and
  generated artifacts were neither used nor committed;
- remaining risks and exact repository-owner action.

## 15. Rollback

Before Production use, rollback is to revert the implementation PR and discard
the disposable/Preview resources. Production migration and data rollback are
not authorized. After any separately approved future Production write, the
accepted Database Architecture preservation and forward-fix rules apply.
