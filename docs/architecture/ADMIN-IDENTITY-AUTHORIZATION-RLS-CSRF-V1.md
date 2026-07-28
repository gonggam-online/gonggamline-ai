# Admin Identity, Authorization, RLS, and CSRF Architecture v1

## Status and authority

- Status: Proposed.
- PR: #39.
- Base: PR #38 squash commit
  `cd4bae71ac77d74751ae3575a8574d7c174a6748`.
- Risk: high-risk/manual.
- Owner: Database / Security with Application Security.
- Acceptance requires an explicit repository-owner decision recorded against
  the reviewed exact head.
- This Draft authorizes no package, runtime, migration, RLS, Auth, secret,
  identity, Preview, Production, or commerce-write change.

## 1. Objective and boundary

Define the smallest single-company administrator boundary that can safely
support later Item Selection persistence. V1 uses invitation-only Supabase
Auth, verified JWT subjects, a versioned administrator registry, user-JWT
default-deny RLS, TOTP assurance, exact-origin CSRF, append-only audit, and a
database-visible telemetry write gate.

This Architecture does not implement authentication, persistence, API, UI,
database objects, environment configuration, or user provisioning. Public
signup, multi-tenancy, customer accounts, delegated roles, social login,
recovery codes, and live commerce writes are out of scope.

## 2. Current-state finding

At the base commit, application server paths use the public Supabase key and
the repository contains broad development policies. There is no accepted
administrator session, authorization, RLS, or CSRF boundary. Those are security
Architecture blockers; code must not compensate for them.

## 3. Trust and actor model

The browser, cookies, request bodies, forwarded headers, public project key,
email, and `user_metadata` are untrusted. Authorization requires a verified
Supabase JWT subject, current registry role/status/version, a live server
session, route assurance, and final database enforcement.

Every function in Ledger F belongs to exactly one mutation actor class:

| Actor class | Boundary |
|---|---|
| `USER_JWT` | Browser-originated protected reads/mutations through exposed wrappers; current active administrator and route assurance are required. |
| `SELF_BOOTSTRAP` | The invited subject accepts its own invitation or activates its own pending-MFA identity; no active-administrator prerequisite exists. |
| `OWNER_RUNBOOK` | Repository-owner manual provisioning, unconfirmed-invitation retirement, and soft-delete result recording; no browser, active-administrator, or AAL2 prerequisite exists. |
| `INFRASTRUCTURE` | Session assertion, telemetry gate maintenance/assertion, RLS predicate, and Auth Hook; no browser authority exists. |

Browser Auth-control-plane operations and owner-only runbooks are distinct:

| Boundary | Caller | Allowed work | Forbidden work |
|---|---|---|---|
| browser Auth control plane | verified active administrator at required assurance through a server-only route | P03-P05 only | generic Auth Admin client, arbitrary target, owner bootstrap, Story 3 service-role access |
| owner-only runbook | repository owner using an environment-specific credential in Ledger R | Ledger F owner-runbook functions and the manual provider steps in Ledger P | browser/Data API use, application session impersonation, general protected data |

Initial and additional administrator provisioning use the same owner-runbook
contract. Neither depends on an existing active administrator.

## 4. Canonical-ledger rule

Ledgers R–T below are the sole normative source. Explanatory sections may cite
row IDs but do not redefine names, privileges, signatures, state transitions,
locks, durations, rates, retention, or expected test results.

An implementation PR must generate a migration fingerprint from Ledgers R and
F and fail when a catalog role, membership, schema/table privilege, function,
owner, caller, EXECUTE grant, or security mode differs. Unlisted LOGIN roles,
functions, states, grants, and transitions are denied.

## 5. Ledger R — principals and roles

`Credential` identifies the only secret/session form. `Rotation` uses Ledger D
row IDs. “None” means no direct privilege.

| ID | Exact role | Login | Credential | Membership | Environment | Schema/table privilege | Exact explicit EXECUTE grants | Forbidden privilege | Rotation |
|---|---|---:|---|---|---|---|---|---|---|
| R01 | `anon` | platform | public project key | none | isolated per project | public allowlist only | none | protected schemas/tables/functions | D18 |
| R02 | `authenticated` | platform | verified user JWT | none | isolated per project | USAGE on `api`; no direct protected-table DML or private-schema USAGE | F01, F03, F05, F07, F09, F14, F20, F22 | owner-runbook, telemetry, and unlisted function EXECUTE | D01/D03 |
| R03 | `api_accept_admin_invitation_owner` | no | none | none | same DB | USAGE on `private`; no table privilege | F02 | LOGIN, BYPASSRLS, sibling EXECUTE | not applicable |
| R04 | `invitation_acceptance_owner` | no | none | none | same DB | exact registry/auth-user/audit columns; telemetry/session helper use | F15, F19 | email, factors, refresh tokens, unrelated rows | not applicable |
| R05 | `api_activate_pending_admin_owner` | no | none | none | same DB | USAGE on `private`; no table privilege | F04 | LOGIN, BYPASSRLS, sibling EXECUTE | not applicable |
| R06 | `pending_admin_activation_owner` | no | none | none | same DB | exact registry/audit columns; telemetry/session helper use | F15, F19 | unrelated rows/functions | not applicable |
| R07 | `api_create_item_selection_run_owner` | no | none | none | same DB | USAGE on `private`; no table privilege | F06 | LOGIN, BYPASSRLS, sibling EXECUTE | not applicable |
| R08 | `item_selection_run_create_owner` | no | none | none | same DB | exact create/rate/audit columns; telemetry/session helper use | F15, F19 | finalize and unrelated data | not applicable |
| R09 | `api_finalize_item_selection_run_owner` | no | none | none | same DB | USAGE on `private`; no table privilege | F08 | LOGIN, BYPASSRLS, sibling EXECUTE | not applicable |
| R10 | `item_selection_run_finalize_owner` | no | none | none | same DB | exact finalize/aggregate/rate/audit columns; telemetry/session helper use | F15, F19 | create and unrelated data | not applicable |
| R11 | `api_read_security_audit_owner` | no | none | none | same DB | USAGE on `private`; no table privilege | F10 | LOGIN, BYPASSRLS, sibling EXECUTE | not applicable |
| R12 | `security_audit_reader_owner` | no | none | none | same DB | SELECT allowlisted audit columns; session helper use | F15 | secrets, mutation, raw payload | not applicable |
| R13 | `admin_provisioning_runbook` | yes | dedicated DB credential | none | separate Preview/Production credential | USAGE on `private`; no table privilege | F11 | Data API/browser, sibling EXECUTE, membership | D15 |
| R14 | `admin_provisioning_owner` | no | none | none | same DB | exact registry INSERT and audit INSERT | F19 | provider calls, unrelated read/write | not applicable |
| R15 | `admin_retirement_runbook` | yes | dedicated DB credential | none | separate Preview/Production credential | USAGE on `private`; no table privilege | F12, F13, F24, F25 | Data API/browser, sibling EXECUTE, membership | D15 |
| R16 | `admin_retirement_owner` | no | none | none | same DB | exact registry SELECT/UPDATE and audit INSERT | F19 | unrelated read/write | not applicable |
| R17 | `admin_soft_delete_audit_owner` | no | none | none | same DB | audit INSERT only | none | registry mutation | not applicable |
| R18 | `auth_session_lock_owner` | no | none | none | same DB | `auth.sessions` SELECT plus column-minimal UPDATE required for locking SELECT | none | session mutation, other Auth objects | not applicable |
| R19 | `telemetry_gate_writer` | yes | monitor DB credential | none | separate Preview/Production credential | USAGE on `private`; no direct table privilege | F16, F17 | recover, assert, protected data | D14 |
| R20 | `telemetry_recovery_runbook` | yes | recovery DB credential | none | separate Preview/Production credential | USAGE on `private`; no direct table privilege | F18 | freeze, heartbeat, assert, protected data | D15 |
| R21 | `telemetry_gate_owner` | no | none | none | same DB | exact gate SELECT/UPDATE and audit INSERT | none | protected business data | not applicable |
| R22 | `telemetry_gate_assert_owner` | no | none | none | same DB | exact gate SELECT only | none | gate mutation and business data | not applicable |
| R23 | `service_role` | platform | server-only project secret | none | isolated per project | Auth Admin API only; no application DB path | none | Story 3, browser import, generic client, protected DB | D14 |
| R24 | `supabase_auth_admin` | platform | platform identity | none | isolated per project | Auth Hook boundary only | Auth Hook only | application tables/functions | platform-managed |
| R25 | `api_begin_own_mfa_reset_owner` | no | none | none | same DB | USAGE on `private`; no table privilege | F21 | LOGIN, BYPASSRLS, sibling EXECUTE | not applicable |
| R26 | `own_mfa_reset_owner` | no | none | none | same DB | exact own registry/audit columns; telemetry/session helper use | F15, F19 | other subjects and unrelated data | not applicable |
| R27 | `api_suspend_admin_owner` | no | none | none | same DB | USAGE on `private`; no table privilege | F23 | LOGIN, BYPASSRLS, sibling EXECUTE | not applicable |
| R28 | `admin_suspension_owner` | no | none | none | same DB | exact target/active-count/audit columns; telemetry/session helper use | F15, F19 | last-active suspension and unrelated data | not applicable |
| R29 | `admin_break_glass_owner` | no | none | none | same DB | exact target registry UPDATE and audit INSERT; telemetry assertion | F19 | browser use and unrelated data | not applicable |
| R30 | `admin_tombstone_owner` | no | none | none | same DB | exact suspended registry UPDATE and audit INSERT; telemetry assertion | F19 | browser use and unrelated data | not applicable |
| R31 | `active_admin_predicate_owner` | no | none | none | same DB | exact registry predicate columns only | none | mutation, LOGIN, BYPASSRLS | not applicable |

No role inherits another role. Every application-owned DEFINER owner is
NOLOGIN, non-superuser, non-BYPASSRLS, and owns only functions listed in
Ledger F. Function ownership carries PostgreSQL's implicit owner authority;
this column lists only explicit EXECUTE grants to non-owner callers.

## 6. Ledger F — functions

All DEFINER functions use an empty fixed search path, schema-qualified objects,
no dynamic SQL, and default EXECUTE revoked from PUBLIC and every role except
the listed caller. Outputs never contain secrets, email, raw provider payload,
or stack traces.

| ID | Exact signature | Mode / owner / caller | Class | Input → output | Objects | Assurance and pre-state → post-state | Lock order | Idempotency / audit / errors |
|---|---|---|---|---|---|---|---|---|
| F01 | `api.accept_admin_invitation_v1()` | DEFINER / R03 / R02 | SELF_BOOTSTRAP | verified request → new version, refresh-required | paired F02 only | AAL1, own confirmed invited subject, live session → pending MFA | delegated F02 | repeat conflicts; audit by F02; 401/403/409/503 |
| F02 | `private.accept_admin_invitation_v1()` | DEFINER / R04 / R03 | SELF_BOOTSTRAP | JWT claims → version/result | registry, Auth user confirmation, audit; F15/F19 | S01 + own subject + live session + T03 → S02 | L01 | version-guarded; E01; 401/403/409/503 |
| F03 | `api.activate_pending_admin_v1()` | DEFINER / R05 / R02 | SELF_BOOTSTRAP | verified request → new version, refresh-required | paired F04 only | fresh AAL2, own pending-MFA subject, live session → active | delegated F04 | repeat conflicts; audit by F04; 403/409/503 |
| F04 | `private.activate_pending_admin_v1()` | DEFINER / R06 / R05 | SELF_BOOTSTRAP | JWT claims → version/result | registry, audit; F15/F19 | S02 + own subject + D04 + live session + T03 → S03 | L02 | version-guarded; E02; 403/409/503 |
| F05 | `api.create_item_selection_run_v1(jsonb,text)` | DEFINER / R07 / R02 | USER_JWT | validated aggregate/idempotency key → run envelope | paired F06 only | active AAL2 + CSRF/rate route checks → unchanged admin state | delegated F06 | key required; audit by F06; 400/403/409/429/503 |
| F06 | `private.create_item_selection_run_v1(jsonb,text)` | DEFINER / R08 / R07 | USER_JWT | canonical write DTO/key → run result | gate, registry, session, rate, audit, Story 3 run | S03 + D04 + live session + T03 → S11 | L03 | same hash/key returns existing; E08; 400/403/409/429/503 |
| F07 | `api.finalize_item_selection_run_v1(uuid,jsonb,text)` | DEFINER / R09 / R02 | USER_JWT | run/final DTO/key → terminal envelope | paired F08 only | active AAL2 + CSRF/rate route checks → unchanged admin state | delegated F08 | key required; audit by F08; 400/403/404/409/429/503 |
| F08 | `private.finalize_item_selection_run_v1(uuid,jsonb,text)` | DEFINER / R10 / R09 | USER_JWT | run/final DTO/key → terminal result | gate, registry, session, rate, audit, Story 3 aggregate | S11 + S03 + D04 + live session + T03 → S12/S13/S14 | L04 | same terminal hash/count returns existing; E09; 400/403/404/409/429/503 |
| F09 | `api.read_security_audit_v1(timestamptz,timestamptz,integer,text)` | DEFINER / R11 / R02 | USER_JWT | bounded range/limit/cursor → redacted page | paired F10 only | active AAL2 secret-sensitive read → no state change | delegated F10 | read-only; access audit by F10; 400/403/429 |
| F10 | `private.read_security_audit_v1(timestamptz,timestamptz,integer,text)` | DEFINER / R12 / R11 | USER_JWT | validated range/limit/cursor → allowlisted rows | registry, session, audit | S03 + D04 + live session → no state change | L05 | stable cursor; E10; 400/403/429 |
| F11 | `private.owner_provision_admin_invitation_v1(uuid,text,text,text)` | DEFINER / R14 / R13 | OWNER_RUNBOOK | exact sub/environment/approval/correlation → invited result | gate, registry, audit | owner manual P01/P02 proof + T03 → S01 | L06 | exact sub/env/correlation repeat returns stored result; E03; 400/409/503 |
| F12 | `private.owner_retire_unconfirmed_admin_v1(uuid,bigint,text,text)` | DEFINER / R16 / R15 | OWNER_RUNBOOK | sub/version/environment/correlation → tombstone result | gate, registry, audit | owner manual inspection + S01 + T03 → S05 | L07 | version/correlation guarded; E04; 400/409/503 |
| F13 | `private.owner_record_admin_soft_delete_v1(uuid,text,text,text)` | DEFINER / R17 / R15 | OWNER_RUNBOOK | sub/environment/correlation/outcome → audit receipt | audit only | S05 + manual P06 attempt → S05 | L08 | same tuple/outcome returns receipt; conflicting outcome 409; E05; 400/409 |
| F14 | `private.is_active_admin()` | DEFINER / R31 / R02 through stored RLS policies | INFRASTRUCTURE | JWT context → boolean | registry | verified subject/role/version + S03 → no state change | L09 | stable in statement; no audit; false on mismatch |
| F15 | `private.assert_auth_session_present_v1()` | DEFINER / R18 / R04,R06,R08,R10,R12,R26,R28 | INFRASTRUCTURE | JWT session context → void | Auth session | matching live session → no state change | L10 | repeat-safe; no audit; 401/403 |
| F16 | `private.freeze_security_write_gate_v1(text,bigint)` | DEFINER / R21 / R19 | INFRASTRUCTURE | environment/generation → frozen receipt | gate, audit | T02 or T03 → T01 | L11 | same generation repeat-safe; E06; 400/409 |
| F17 | `private.heartbeat_security_write_gate_v1(text,bigint,text)` | DEFINER / R21 / R19 | INFRASTRUCTURE | environment/generation/receipt → gate receipt | gate, audit | T02 qualifying heartbeat advances per Ledger S; T03 extends lease; failure → T01 | L11 | receipt/correlation dedupe; E06; 400/409/503 |
| F18 | `private.recover_security_write_gate_v1(text,bigint,text)` | DEFINER / R21 / R20 | INFRASTRUCTURE | environment/new generation/evidence → recovery receipt | gate, audit | T01 + approved healthy prerequisite → T02 | L11 | monotonic generation; E07; 400/409/503 |
| F19 | `private.assert_security_write_ready_v1()` | DEFINER / R22 / R04,R06,R08,R10,R14,R16,R26,R28,R29,R30 | INFRASTRUCTURE | environment context → void | gate | T03 + current generation/fresh lease/backlog → no state change | L12 | repeat-safe; no audit; 503 |
| F20 | `api.begin_own_mfa_reset_v1()` | DEFINER / R25 / R02 | USER_JWT | verified request → pending-MFA/version/refresh-required | paired F21 only | active fresh AAL2 own subject → pending MFA | delegated F21 | repeat conflicts; audit by F21; 403/409/503 |
| F21 | `private.begin_own_mfa_reset_v1()` | DEFINER / R26 / R25 | USER_JWT | JWT claims → version/result | gate, registry, session, audit | S03 + own subject + D04 + live session + T03 → S02 | L13 | version-guarded; E11; 403/409/503 |
| F22 | `api.suspend_admin_v1(uuid,bigint)` | DEFINER / R27 / R02 | USER_JWT | target/version → suspended result | paired F23 only | active fresh AAL2 actor; target nonterminal; another active remains → suspended | delegated F23 | target/version guarded; audit by F23; 403/404/409/503 |
| F23 | `private.suspend_admin_v1(uuid,bigint)` | DEFINER / R28 / R27 | USER_JWT | actor/target/version → suspended result | gate, actor/target registry, session, audit | S03 actor + D04 + live session + S02/S03 target + last-admin guard + T03 → S04 | L14 | version-guarded; E12; 403/404/409/503 |
| F24 | `private.owner_break_glass_admin_v1(uuid,bigint,text,text)` | DEFINER / R29 / R15 | OWNER_RUNBOOK | target/version/environment/correlation → pending-MFA result | gate, registry, audit | S02/S03/S04 + owner approval + T03 → S02 | L15 | version/correlation guarded; E13; 400/409/503 |
| F25 | `private.owner_tombstone_admin_v1(uuid,bigint,text,text)` | DEFINER / R30 / R15 | OWNER_RUNBOOK | target/version/environment/correlation → tombstone result | gate, registry, audit | S04 + owner approval + retention proof + T03 → S05 | L16 | version/correlation guarded; E14; 400/409/503 |

Ledger F contains twenty-five exact functions. No example function name is
normative or permitted outside this ledger.

## 7. Ledger S — state machines

| ID | Machine / state | Incoming transition and exact writer | Outgoing transition and exact writer | Terminal / retry |
|---|---|---|---|---|
| S01 | admin `invited` | absent via F11 | S02 via F02; S05 via F12 | nonterminal; transition conflict requires a new owner decision |
| S02 | admin `pending_mfa` | S01 via F02; S03 via F21; S02/S03/S04 via F24 | S03 via F04; S04 via F23 | nonterminal; user must complete fresh MFA |
| S03 | admin `active` | S02 via F04 | S02 via F21; S04 via F23 or F24 | nonterminal |
| S04 | admin `suspended` | S02/S03 via F23 | S02 via F24; S05 via F25 | nonterminal; no automatic promotion |
| S05 | admin `tombstoned` | S01 via F12; S04 via F25 | none | terminal; Auth soft-delete may be manually retried without changing state |
| S06 | manual invitation `SYNCHRONOUS_SUCCESS` | P01 returns exact sub | F11 may create S01 | terminal provider-call outcome |
| S07 | manual invitation `DETERMINISTIC_FAILURE` | P01 deterministic rejection | none | terminal; a new owner-approved attempt is a new operation |
| S08 | manual invitation `MANUAL_RECONCILIATION_REQUIRED` | P01 timeout/response loss/ambiguity | P02 yields exact-one adoption or fail closed | terminal for the original call; it is never reissued by software |
| S09 | soft-delete `SUCCEEDED` | P06 succeeds, then F13 records | none | terminal audit outcome |
| S10 | soft-delete `FAILED_TOMBSTONE_RETAINED` | P06 fails, then F13 records | same exact P06 operation may be retried manually | retriable manually; distinct from every other Auth lifecycle operation |
| S11 | Item Selection run `RUNNING` | absent via F06 | S12/S13/S14 via F08 | nonterminal; retry creates a separately linked run under PR #38 |
| S12 | Item Selection run `COMPLETED` | S11 via F08 when PR #38 completed-count contract holds | none | terminal; identical finalization returns stored result |
| S13 | Item Selection run `PARTIAL` | S11 via F08 when PR #38 partial-count contract holds | none | terminal; reprocessing creates a new linked run |
| S14 | Item Selection run `FAILED` | S11 via F08 when PR #38 failed-count contract holds | none | terminal; reprocessing creates a new linked run |
| T01 | telemetry `FROZEN` | F16; F17 failure/expiry semantics | T02 via F18 | writes denied; recovery requires runbook |
| T02 | telemetry `RECOVERING` | T01 via F18 | remains T02 after first qualifying F17; T03 after second qualifying F17; T01 on failure | bounded retry by infrastructure |
| T03 | telemetry `READY` | T02 via qualifying F17 | remains T03 via healthy F17; T01 through F16 or failure/expiry semantics | lease-renewable |

Protected mutations, including both self-bootstrap transitions and owner-runbook
registry mutations, require T03 through F19. Protected reads do not require
telemetry readiness; they require only current identity, assurance, and live
session. Audit access is therefore available while writes are frozen.

## 8. Ledger L — lock order and wait-for graph

All modes are transaction-duration locks. Audit INSERT means the database's
normal row/index locks; it is listed so the graph is complete.

| ID | Function | Exact acquisition order |
|---|---|---|
| L01 | F02 | gate row `FOR SHARE` → registry subject `FOR UPDATE` → Auth session `FOR KEY SHARE` → audit INSERT |
| L02 | F04 | gate row `FOR SHARE` → registry subject `FOR UPDATE` → Auth session `FOR KEY SHARE` → audit INSERT |
| L03 | F06 | gate row `FOR SHARE` → actor registry `FOR KEY SHARE` → Auth session `FOR KEY SHARE` → rate row `FOR UPDATE` → audit INSERT → run/idempotency row `FOR UPDATE` |
| L04 | F08 | gate row `FOR SHARE` → actor registry `FOR KEY SHARE` → Auth session `FOR KEY SHARE` → rate row `FOR UPDATE` → audit INSERT → run row `FOR UPDATE` → aggregate parents before children |
| L05 | F10 | actor registry `FOR KEY SHARE` → Auth session `FOR KEY SHARE` → audit-access rate row `FOR UPDATE` → audit INSERT |
| L06 | F11 | gate row `FOR SHARE` → environment/subject `pg_advisory_xact_lock` → registry unique-key INSERT → audit INSERT |
| L07 | F12 | gate row `FOR SHARE` → registry subject `FOR UPDATE` → audit INSERT |
| L08 | F13 | soft-delete correlation row `FOR UPDATE` → audit INSERT |
| L09 | F14 | registry subject `FOR KEY SHARE` |
| L10 | F15 | Auth session `FOR KEY SHARE` |
| L11 | F16/F17/F18 | gate row `FOR UPDATE` → audit INSERT |
| L12 | F19 | gate row `FOR SHARE` |
| L13 | F21 | gate row `FOR SHARE` → own registry row `FOR UPDATE` → Auth session `FOR KEY SHARE` → audit INSERT |
| L14 | F23 | gate row `FOR SHARE` → actor, target, and active-admin registry rows together in UUID order `FOR UPDATE` → Auth session `FOR KEY SHARE` → audit INSERT |
| L15 | F24 | gate row `FOR SHARE` → target registry row `FOR UPDATE` → audit INSERT |
| L16 | F25 | gate row `FOR SHARE` → target registry row `FOR UPDATE` → audit INSERT |

The directed resource graph is:

`gate → advisory-key → registry → session → rate → audit → run → aggregate-child`

and separately:

`soft-delete-correlation → audit`.

No ledger row contains a reverse edge. Provider calls occur outside database
transactions. Logout/session deletion waits for an existing session lock and
does not acquire registry or gate locks. Therefore the complete ledger graph,
including every telemetry lock mode, is acyclic.

## 9. Ledger D — durations, rates, retention, and rotation

Every numeric security/operations contract appears normatively only here.

| ID | Contract | Exact value |
|---|---|---|
| D01 | access-token lifetime | 15 minutes |
| D02 | Auth-cookie storage Max-Age | 34,560,000 seconds; never extends server session |
| D03 | inactivity / absolute session timeout | 30 minutes / 12 hours |
| D04 | AAL2 JWT maximum age for mutation and sensitive read | 60 seconds |
| D05 | CSRF token lifetime | 15 minutes |
| D06 | protected statement timeout | 5 seconds |
| D07 | ordinary authenticated mutation rate | 30 requests per principal per rolling minute |
| D08 | Item Selection create/finalize rate | 10 requests per principal per minute |
| D09 | runtime-control rate | 10 requests per principal per minute |
| D10 | live-commerce rate | 3 requests per principal per 10 minutes |
| D11 | telemetry heartbeat / lease / freshness | every 10 seconds / at most 30 seconds / heartbeat at most 20 seconds old |
| D12 | telemetry healthy backlog maximum age | 60 seconds |
| D13 | telemetry retry/backoff and backlog window | 1, 2, 4, 8, 16, 30 seconds, then every 5 minutes for 24 hours |
| D14 | server/monitor secret rotation | every 90 days and immediately on suspected exposure |
| D15 | owner-runbook DB credential rotation | every 30 days, on operator change, and immediately on suspected exposure |
| D16 | Production audit/telemetry retention | 7 years; deletion prohibited |
| D17 | encrypted backup / restore verification | daily backup; quarterly restore test |
| D18 | public project key review | quarterly and on project/environment change |
| D19 | login / callback rate | 5 attempts per normalized account and 20 per authoritative network key per 15 minutes |
| D20 | audit-read rate and page bound | 30 requests per principal per minute; at most 200 rows per request |

Preview and Production use separate credentials, users, registry rows, sinks,
backups, and rate-limit namespaces.

## 10. Ledger B — browser, CSRF, and route assurance

| ID | Route class | Cookie/header and content | Assurance |
|---|---|---|---|
| B01 | pre-auth sign-in | `__Host-gonggamline-login-csrf` + `X-GonggamLine-Login-CSRF`; purpose `login`; exact Origin; JSON POST | unauthenticated state/PKCE validation; D05/D19 |
| B02 | ordinary protected read | pinned SSR Auth cookie chunks; no unsafe side effect | active AAL1, current registry/version, live session |
| B03 | secret-sensitive read | pinned SSR Auth cookie chunks; no unsafe side effect | active AAL2, current registry/version, live session, D04 |
| B04 | authenticated mutation | `__Host-gonggamline-csrf` + `X-GonggamLine-CSRF`; purpose `authenticated-mutation`; exact Origin; same-site fetch metadata; JSON | active AAL2, current registry/version, live session, D04/D05 and route rate |
| B05 | public read | no credential | explicit route allowlist only |

Auth cookies are Secure, SameSite=Lax, Path=/, managed by pinned
`@supabase/ssr@0.12.3` with `@supabase/supabase-js@2.110.7`, and use D02.
Cookie presence never proves or extends a server session. Cookie loss causes
local unauthenticated state, not server revocation. Logout removes all current
and obsolete cookie chunks and the CSRF cookies. Unsafe routes never mutate
through GET, HEAD, OPTIONS, form, multipart, or text content.

## 11. Ledger P — external Supabase Auth boundary

All P operations are server-only, exact-target, exact-environment, CSRF/rate
protected when browser-triggered, audited, idempotency-bound, and isolated from
Story 3. Raw email/provider payload is transient and excluded from database,
audit, logs, traces, errors, and artifacts.

| ID | Operation | Supported API / actor | Failure and retry |
|---|---|---|---|
| P01 | invite administrator once | Supabase JS auth.admin.inviteUserByEmail operation; OWNER_RUNBOOK | synchronous exact sub may proceed to F11; deterministic failure stops; ambiguity becomes S08 and software never reissues the call |
| P02 | inspect ambiguous invite | supported Supabase Dashboard/Admin API; OWNER_RUNBOOK | adopt only one exact unconfirmed environment-matched user; zero/multiple/confirmed/uncertain fails closed |
| P03 | revoke target refresh sessions | Supabase JS auth.admin.signOut global-scope operation; browser control plane or owner runbook | requires legitimately held target JWT; no fictional sub-only global revoke; registry/version blocks access JWT separately |
| P04 | list/delete MFA factor | pinned Supabase JS auth.mfa.listFactors and auth.mfa.deleteFactor operations; browser control plane or owner runbook | registry-first downgrade/suspend; partial failure remains denied; retry requires same operation binding |
| P05 | disable user | Supabase JS auth.admin.updateUserById operation with supported ban duration; browser control plane or owner runbook | registry-first denial; exact returned sub required |
| P06 | soft-delete user | Supabase JS auth.admin.deleteUser soft-delete operation; OWNER_RUNBOOK only | S05 first; same exact sub/environment/correlation may be retried manually only under S10 |

The database never calls or queries the Auth provider. Provider uncertainty
fails closed. General administrators cannot access a generic Auth Admin API.

## 12. Ledger E — audit events and errors

| ID | Event |
|---|---|
| E01 | `ADMIN_INVITE_ACCEPTED` |
| E02 | `ADMIN_ACTIVATED` |
| E03 | `ADMIN_INVITED` |
| E04 | `ADMIN_INVITATION_RETIRED` |
| E05 | `ADMIN_AUTH_SOFT_DELETE_RESULT` |
| E06 | `SECURITY_WRITE_GATE_CHANGED` |
| E07 | `SECURITY_WRITE_GATE_RECOVERY_STARTED` |
| E08 | `ITEM_SELECTION_RUN_CREATED` |
| E09 | `ITEM_SELECTION_RUN_FINALIZED` |
| E10 | `SECURITY_AUDIT_READ` |
| E11 | `ADMIN_OWN_MFA_RESET_STARTED` |
| E12 | `ADMIN_SUSPENDED` |
| E13 | `ADMIN_BREAK_GLASS_RECOVERY_STARTED` |
| E14 | `ADMIN_TOMBSTONED` |

Allowed error families are 400 invalid input, 401 invalid/missing session, 403
insufficient role/assurance/CSRF, 404 absent protected resource, 409
state/idempotency conflict, 429 rate limit, and 503 security dependency
unavailable. Errors are machine-readable and sanitized.

Audit and denial telemetry use an owner-approved append-only sink. Production
protected mutations remain frozen until its provider, writer identity, schema,
queue, duplicate policy, readiness lease, retention, backup, restore, reader
allowlist, and Preview separation are accepted and proven. D11–D17 are binding.

## 13. Ledger A — acceptance tests

Every test binds one or more canonical rows and specifies input and result.

| Test ID | Ledger rows | Input | Expected result |
|---|---|---|---|
| A01 | R01–R31, F01–F25 | migration catalog and grants | exact owner/caller/EXECUTE/object fingerprint; every unlisted privilege denied |
| A02 | F01/F02, S01/S02, L01 | own confirmed invited AAL1 session; replay; other subject; concurrent F12 | success then refresh-required; replay/other denied; concurrency gives one commit and one 409 |
| A03 | F03/F04, S02/S03, L02, D04 | own fresh AAL2 pending-MFA session; stale/other/replay/concurrent | one activation; all invalid cases denied |
| A04 | F11, R13/R14, P01/P02, S06–S08, L06 | synchronous success, deterministic failure, timeout, exact-one/zero/multiple/confirmed match | only exact synchronous/adopted sub reaches S01; software never reissues an ambiguous call |
| A05 | F12/F13, R15–R17, P06, S05/S09/S10, L07/L08 | retirement vs acceptance; delete success/failure/retry | one lifecycle winner; tombstone retained; only same bound delete retry accepted |
| A05B | F20–F25, R25–R30, S02–S05, L13–L16 | own reset, suspension/last-admin, break-glass, terminal tombstone | exact writer/actor transition only; last-admin and wrong actor denied |
| A06 | F05–F08, R07–R10, S11–S14, L03/L04, D08 | valid/invalid aggregate, repeated keys/hashes/counts | create/finalize semantics preserved; conflict, terminal state, and rate results exact |
| A07 | F09/F10, R11/R12, B03, L05, D20 | bounded AAL2 audit read; AAL1, secret-field, oversized page | redacted page and access audit; invalid cases denied |
| A08 | F15, R18, L10 | live, missing, mismatched, logged-out session; read-vs-logout race | live succeeds; invalid denied; logout waits, then old JWT cannot start protected work |
| A09 | F16–F19, R19–R22, T01–T03, L11/L12, D11–D13 | freeze, recovery, two heartbeats, stale lease/backlog, direct RPC | exact transitions; writer can freeze/heartbeat only; recovery role can recover only; stale/direct bypass denied |
| A10 | L01–L16 | forced concurrent transactions for every edge | observed locks match modes/order and wait-for graph has no cycle |
| A11 | B01–B05, D01–D05/D19 | wrong Origin/content/token/purpose/session/version/AAL/rotation | only exact route contract succeeds; cookie loss never claims server revocation |
| A12 | P03–P06, R23 | exact/wrong target/environment, browser import, arbitrary API, partial failure | exact allowlist only; Story 3/service-role and generic Auth Admin access denied |
| A13 | S01–S14/T01–T03, F01–F25 | every incoming/outgoing writer and unlisted transition | listed writer succeeds; every unlisted writer/transition fails |
| A14 | D01–D20 | configuration, rate, retention, backup/restore evidence | every numeric value equals Ledger D and appears nowhere else normatively |
| A15 | E01–E14, D16/D17 | success/denial/rollback, redaction, retention, backup restore | append-only allowlisted event; no secret/raw payload; restore evidence succeeds |
| A16 | F01–F25, R01–R31, S01–S14/T01–T03 | documentation identifier scan | each exact function and role has exactly one ledger row; no stale contract term |

## 14. Deployment, rollback, and implementation handoff

Acceptance of this document authorizes planning only. Separate high-risk/manual
Stories must implement and verify, in order:

1. Sprint B-0 isolated database baseline and final default-deny boundary.
2. Security telemetry sink prerequisite.
3. Auth foundation and owner provisioning runbooks.
4. Authorization/RLS/functions and migration fingerprint.
5. Route security and browser/session/CSRF behavior.
6. Item Selection Story 3 persistence.

Production cutover must begin frozen, remove broad development policies before
enabling a protected mutation, verify backup/restore and exact environment,
and forward-fix without restoring anonymous writes. Rollback disables affected
mutations while preserving Auth, default-deny RLS, registry, audit, and
tombstones. Destructive rollback requires repository-owner approval.

## 15. Owner review checklist

Before Proposed can become Accepted, the repository owner must approve:

1. the four actor classes and owner-only initial/additional provisioning;
2. manual ambiguity handling where software never reissues an uncertain call;
3. the complete role/function/state/lock/duration/browser/provider ledgers;
4. the direct-MFA-unenroll residual exposure in D04;
5. the telemetry failure boundary and separate sink prerequisite;
6. default-deny RLS and removal of broad Production policies;
7. the manual tombstone-first soft-delete distinction;
8. the ordered high-risk implementation and rollback plan.

## 16. References

- Supabase SSR:
  https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase SSR advanced guidance:
  https://supabase.com/docs/guides/auth/server-side/advanced-guide
- Supabase API security:
  https://supabase.com/docs/guides/api/securing-your-api
- Supabase database functions:
  https://supabase.com/docs/guides/database/functions
- Supabase sessions and sign-out:
  https://supabase.com/docs/guides/auth/sessions
  https://supabase.com/docs/guides/auth/signout
- Supabase Auth Admin:
  https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
  https://supabase.com/docs/reference/javascript/auth-admin-signout
  https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
  https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
- Supabase RBAC and RLS:
  https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac
  https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL locking:
  https://www.postgresql.org/docs/current/explicit-locking.html
- Next.js authentication and data security:
  https://nextjs.org/docs/app/guides/authentication
  https://nextjs.org/docs/app/guides/data-security
- OWASP CSRF and session management:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
  https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
