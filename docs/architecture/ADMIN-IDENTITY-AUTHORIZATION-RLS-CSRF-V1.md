# Admin Identity, Authorization, RLS, and CSRF Architecture v1

## Status and authority

- Status: Proposed.
- PR: #39.
- Base: PR #38 squash commit `cd4bae71ac77d74751ae3575a8574d7c174a6748`.
- Risk: high-risk/manual.
- Owner: Database / Security with Application Security.
- Acceptance requires an explicit repository-owner decision against the reviewed exact head.
- This Draft authorizes no runtime, migration, RLS, Auth, secret, identity, Preview, Production, or commerce-write change.

## 1. Root cause and architecture decision

The previous draft attempted to specify an unimplemented enterprise identity control plane before proving the smallest administrator path. It expanded a single-company v1 into custom Auth hooks, invitation and retirement state machines, direct `auth.sessions` locking, per-function database owners, telemetry recovery states, and a large canonical ledger. Every normalization added new contracts that could only be validated by another document review.

That approach is superseded. V1 adopts the smallest supported Supabase boundary that can be proven in a disposable environment:

1. Supabase Auth provides user identity and session lifecycle.
2. The repository owner provisions or disables administrators manually in the Supabase Dashboard.
3. A server-only environment allowlist, `GONGGAMLINE_ADMIN_USER_IDS`, contains the authorized Supabase user UUIDs for that environment.
4. Every protected browser request terminates at a Next.js Route Handler. The browser never calls protected database objects or Auth Admin APIs directly.
5. Each protected request calls Supabase Auth `getUser()` against the Auth server, then checks the exact user UUID against the allowlist.
6. Protected mutations additionally require AAL2, exact-origin JSON CSRF validation, and the route rate limit.
7. `anon` and `authenticated` receive no direct privilege on protected tables or mutation functions. RLS remains enabled and default-deny.
8. Server-only data work may use the Supabase secret/service-role credential only through one isolated module after the request guard succeeds.
9. Security audit rows are committed with protected business mutations. External telemetry readiness is not a prerequisite for v1.

This is an implementation envelope, not a line-by-line migration design. Exact SQL names, SDK return types, lock modes, and helper signatures become binding only in the implementation PR that proves them with tests.

## 2. Scope

V1 includes:

- one-company administrator sign-in;
- manual administrator provisioning and disablement;
- Auth-server validation of the access JWT and user for protected server routes;
- server-only administrator allowlisting;
- AAL1 protected reads and AAL2 protected mutations/sensitive reads;
- default-deny protected data access;
- same-origin CSRF and bounded route rates;
- sanitized security audit events;
- a disposable Supabase proof and negative access tests.

V1 excludes:

- software-driven invitations or invitation reconciliation;
- custom Auth hooks or custom JWT role claims;
- database administrator lifecycle state machines;
- direct reads or locks on the Supabase `auth` schema;
- automatic MFA reset, break-glass, retirement, or soft-delete workflows;
- per-function owner-role proliferation;
- an external telemetry lease, freeze, or recovery state machine;
- multi-tenancy, customer accounts, delegated roles, social login, and live commerce writes.

Excluded capabilities require separate Stories only after a real operating need exists.

## 3. Trust boundary

| Boundary | Trusted evidence | Allowed work | Forbidden work |
|---|---|---|---|
| Browser | none by itself | send same-origin requests | authorization decisions, service credential access, protected database calls |
| Route Handler guard | successful `getUser()`, allowlisted UUID, route assurance | authorize one declared route | generic Auth Admin or database access |
| Server data module | successful guard context created in the same request | allowlisted protected query/mutation | browser import, unguarded use, arbitrary Auth Admin calls |
| Supabase Data API | public routes only | explicitly public read | protected table/function access by `anon` or `authenticated` |
| Repository owner | Supabase Dashboard and environment administration | provision/disable user, update environment allowlist | delegated browser lifecycle automation |

Email, cookies, request bodies, forwarded headers, public keys, and user metadata are never authorization evidence. The allowlist stores UUIDs only and is separate for Local, CI, Preview, and Production.

## 4. Request contract

### 4.1 Protected read

1. Accept only a declared protected read route.
2. Recover the pinned Supabase SSR session cookies.
3. Call `getUser()`; local JWT decoding alone is insufficient.
4. Require the returned UUID in `GONGGAMLINE_ADMIN_USER_IDS`.
5. Apply the route's read assurance and response-field allowlist.
6. Call the isolated server data module.

### 4.2 Protected mutation

Protected mutations perform every protected-read check and also require:

- POST, PUT, PATCH, or DELETE as declared; never GET side effects;
- `Content-Type: application/json`;
- an exact allowlisted `Origin` and same-site fetch metadata;
- `X-GonggamLine-CSRF` carrying a valid v1 token;
- AAL2 for a token issued no more than 60 seconds before the operation;
- 30 requests per administrator per rolling minute, or 10 per minute for Item Selection create/finalize;
- a sanitized audit record committed atomically with the business mutation.

The CSRF token format is `v1.<expiry>.<nonce>.<mac>`. The MAC binds purpose, administrator UUID, server session identity, expiry, and nonce to a server-only secret. Tokens live for at most 15 minutes and rotate on sign-in, session refresh, privilege change, logout, or expiry. The cookie is `__Host-gonggamline-csrf`; the header is `X-GonggamLine-CSRF`. Wrong purpose, subject, session, origin, format, expiry, or content type fails closed.

## 5. Session and logout semantics

Supabase access tokens remain valid until their encoded expiry even after sign-out. V1 does not claim instant JWT or session revocation.

- Server routes call `getUser()` on every protected request to validate the access JWT and user against the Auth server. This does not prove that the corresponding refresh session still exists or make a logged-out access JWT immediately invalid.
- Sign-out destroys the affected refresh session, so it cannot issue another access token, but an already issued access JWT can remain valid until its encoded expiry.
- The maximum residual exposure for a protected read is the configured 15-minute access-token lifetime. A protected mutation has the additional AAL2 freshness boundary of 60 seconds.
- Direct Data API access to protected objects is denied regardless of access-token freshness because `anon` and `authenticated` have no protected privileges.
- Access-token lifetime must be configured to 15 minutes before Production enablement.
- Cookie deletion is local cleanup and is not treated as proof of server revocation.

V1 does not read or lock `auth.sessions` and does not maintain a separate session-revocation ledger. Immediate logout revocation, a shorter access-token lifetime, or another immediate-revocation mechanism may be considered in a follow-up Security Story if the operating need justifies it.

## 6. Administrator lifecycle

Initial and additional administrators use the same manual runbook:

1. Repository owner creates or invites the user in the environment's Supabase Dashboard.
2. Owner verifies the exact Auth user UUID in that environment.
3. Owner adds that UUID to `GONGGAMLINE_ADMIN_USER_IDS` in the matching server environment and deploys through the normal manual approval path.
4. The user signs in and enrolls TOTP before protected mutations are enabled.
5. The disposable/Preview acceptance suite proves authorized and unauthorized behavior.

Disablement reverses the order: remove the UUID from the allowlist and deploy, then disable or delete the Auth user in the Dashboard. No application invitation, reconciliation, retirement, MFA-admin, or soft-delete function exists in v1.

## 7. Database and service-role boundary

Protected schemas and objects satisfy all of the following:

- RLS enabled and default-deny;
- no direct protected-table DML or protected-function EXECUTE for `anon` or `authenticated`;
- no protected schema exposed for browser use;
- application migrations explicitly revoke inherited/public access;
- positive and negative tests use actual Supabase token shapes.

The Supabase secret/service-role key has full project data access and `BYPASSRLS`; database grants cannot turn it into an Auth-only credential. V1 therefore controls use operationally:

- server-only environment variable, separated by environment;
- one `server-only` module owns client construction;
- an import allowlist permits only the guarded data repository and the manual Auth administration script, if one is later approved;
- client bundles and browser code must contain neither the key nor the module;
- static dependency checks and runtime negative tests reject any other import/use;
- raw keys, emails, provider payloads, and Auth responses never enter logs, audit rows, traces, or artifacts;
- rotation every 90 days and immediately after suspected exposure.

RLS protects browser/user-JWT paths; it is not claimed to constrain service-role calls.

## 8. Audit and availability

V1 writes allowlisted security events to the application database. At minimum: sign-in denial, authorization denial, CSRF denial, Item Selection create, Item Selection finalize, and administrator configuration deployment reference.

Audit rows contain UUID, event code, route, correlation ID, result, and server timestamp. They exclude email, secrets, cookies, tokens, raw request/provider payloads, and stack traces.

A protected business mutation and its required audit insert commit in one transaction. If the audit insert fails, the mutation fails and rolls back. Ordinary protected reads may remain available during audit sink failure and emit sanitized server telemetry. An external append-only sink, seven-year retention, leases, freeze/recovery states, and provider runbooks are future operations work, not v1 prerequisites.

## 9. Executable acceptance matrix

| ID | Proof | Required result |
|---|---|---|
| A01 | unauthenticated protected route | 401; no data-module call |
| A02 | valid Auth user not in allowlist | 403; no data-module call |
| A03 | allowlisted administrator with a valid AAL1 access JWT | ordinary protected read succeeds; mutation denied |
| A04 | allowlisted administrator with a valid, sufficiently fresh AAL2 access JWT | declared mutation succeeds within rate and CSRF rules |
| A05 | wrong/missing Origin, JSON type, CSRF purpose, subject, session, MAC, or expiry | 403 and no mutation |
| A06 | direct Data API request with `anon`, valid administrator JWT, logged-out unexpired JWT, and non-admin JWT | every protected table/function request denied |
| A07 | sign in and retain the access and refresh tokens; sign out; attempt refresh; present the retained access JWT before and after its configured lifetime; present it to a mutation after the 60-second AAL2 freshness boundary | refresh fails after sign-out; immediate rejection of the retained unexpired access JWT is not a v1 guarantee; the expired JWT is rejected by the protected Route Handler; the mutation is rejected after the AAL2 freshness boundary |
| A08 | service-role dependency scan and client bundle scan | only the server allowlist imports it; browser bundle contains none |
| A09 | forced audit insert failure | business mutation rolls back |
| A10 | manual provisioning/disablement in disposable environment | exact UUID gains/loses access only after allowlist deployment |
| A11 | migration/grant fingerprint | RLS enabled; public/anon/authenticated protected grants absent |
| A12 | official pinned SDK compile and disposable integration | only currently supported API paths and response shapes used |

CI must run A01-A12 against a fresh disposable Supabase project or local stack. Existing unit, lint, typecheck, build, and Preview checks do not count as proof of these contracts unless they exercise the new boundary.

## 10. Review closure rule

Architecture review is complete when the document:

1. conflicts with no official Supabase, PostgreSQL, Next.js, or OWASP contract;
2. gives every v1 risk an owner and an executable acceptance test;
3. leaves no unresolved choice that changes the first implementation Story;
4. keeps excluded enterprise lifecycle features explicitly out of scope.

After those conditions pass, a reviewer may block acceptance only with evidence of an official-platform conflict, a security invariant violation, or a non-executable acceptance test. Enhancements, additional roles, lifecycle automation, telemetry providers, retention targets, and hypothetical future states are follow-up issues and cannot reopen v1.

Disputed platform behavior must be settled by a minimal disposable implementation proof, not another normative ledger entry. Architecture Accepted authorizes the implementation Story; it does not assert that unimplemented code has already passed.

## 11. Implementation handoff

After repository-owner acceptance, implement one vertical slice in this order:

1. server-only configuration parser and administrator UUID allowlist;
2. Supabase SSR sign-in/callback/logout and per-request `getUser()` guard;
3. route assurance, AAL2, exact-origin JSON CSRF, and rate limiting;
4. isolated service-role data module and import/bundle enforcement;
5. default-deny grants/RLS for the Item Selection protected objects;
6. atomic audit plus one Item Selection read/create/finalize route;
7. A01-A12 in disposable CI and Preview browser smoke.

Production remains blocked until the separate high-risk implementation PR passes, the repository owner approves its exact migration/configuration, and broad development policies are removed. Rollback disables protected routes and removes the administrator allowlist deployment while preserving data and audit history.

## 12. Owner decisions before acceptance

The repository owner must approve:

- manual Dashboard provisioning and disablement for v1;
- the server-only UUID allowlist;
- the service-role operational-containment model and its residual full-access risk;
- refresh-session termination without immediate access-JWT revocation, including the accepted maximum 15-minute read exposure and maximum 60-second AAL2 mutation-freshness boundary;
- AAL2 for protected mutations;
- default-deny direct Data API access;
- implementation-first proof for exact SQL/SDK details;
- deferral of automated lifecycle and external telemetry systems.

## 13. References

- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase server-side Auth: https://supabase.com/docs/guides/auth/server-side/advanced-guide
- Supabase sessions and sign-out: https://supabase.com/docs/guides/auth/sessions and https://supabase.com/docs/guides/auth/signout
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Next.js authentication: https://nextjs.org/docs/app/guides/authentication
- OWASP CSRF: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
