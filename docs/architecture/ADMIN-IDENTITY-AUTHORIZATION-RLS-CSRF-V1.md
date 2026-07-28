# Admin Identity, Authorization, RLS, and CSRF Architecture v1

## Status and authority

- Status: Proposed.
- Story: Item Selection prerequisite Architecture / Admin Security Boundary.
- Owner: Database / Security with Application Security.
- Consumers: every operator page and Route Handler; Supplier / Procurement Item
  Selection; Revenue; Runtime; later commerce administration.
- Base: PR #38 squash commit
  `cd4bae71ac77d74751ae3575a8574d7c174a6748`.
- Risk: high-risk/manual because the decision governs authentication,
  authorization, RLS, secrets, and Production access.
- This document authorizes no package installation, auth configuration, user
  creation, migration, RLS change, route change, secret creation, Preview or
  Production mutation.
- Acceptance requires an explicit repository-owner decision recorded with the
  reviewed head SHA. Draft existence is not approval.

## 1. Business objective

Create the smallest reliable single-company administrator boundary that lets
the approved Item Selection engine persist auditable results without exposing
company data or write endpoints to anonymous callers.

The boundary must support the first-sale path without inventing a multi-tenant
identity system. It must also close the current gap where unauthenticated Route
Handlers use a public Supabase key against permissive development policies.

Revenue impact is indirect but P1: Story 3 persistence, the later admin API, and
the operator UI remain blocked until this security contract is accepted.

## 2. Scope and non-goals

In scope:

- one invitation-only administrator identity model;
- verified Supabase Auth sessions for Next.js App Router;
- a versioned administrator role claim and immediate-revocation check;
- route and operation authorization classes;
- default-deny RLS and least-privilege grants;
- CSRF, origin, cookie, CORS, and cache contracts;
- tightly bounded database functions and service-role policy;
- audit, throttling, failure, recovery, rollout, rollback, and tests;
- exact Story 3 names and claims.

Non-goals:

- customer, supplier, agency, employee, marketplace, or tenant accounts;
- social login, public signup, SCIM, organization hierarchy, delegated roles,
  fine-grained permissions, or mobile/native authentication;
- changing Item Selection rules, profitability rules, Product ownership, or
  commerce approval semantics;
- implementing auth, migrations, RLS, API, UI, secrets, Supabase Dashboard
  settings, or Production changes in this documentation PR;
- authorizing live marketplace, price, purchasing, order, inventory,
  fulfillment, return, settlement, or payment writes;
- retroactively treating broad development policies as Production-approved.

A future second role or tenant dimension requires a new Architecture version.

## 3. Current-state evidence

Repository evidence at the base commit:

- `lib/supabase.ts` creates one `@supabase/supabase-js` client from
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- That client disables session persistence and token refresh. There is no
  cookie-backed server auth client, browser auth client, auth Proxy, login
  route, central principal resolver, or middleware/proxy authorization gate.
- Search found no `cookies()`, `createServerClient`, `auth.uid()`,
  application role claim, CSRF verifier, or request-origin verifier.
- Server-side services still send the anonymous key. Server execution therefore
  does not create an authenticated or privileged database principal.
- `docs/SUPABASE_APPLICATION_ACCESS_MAP.md` records anonymous SELECT, INSERT,
  UPDATE, and UPSERT dependencies across active services.
- the recovered Product baseline allows anonymous SELECT, INSERT, and UPDATE;
  migrations 005–020 and the recovered Commerce OS development source contain
  broad `USING (true) WITH CHECK (true)` policies.
- state-changing routes such as discovery approval, procurement order creation,
  runtime execute/retry/cancel, OS commands, demo seeding, and Coupang live
  registration do not authenticate, authorize, or validate CSRF.
- `package.json` has `@supabase/supabase-js` but not `@supabase/ssr`.
- PR #38 explicitly blocks Story 3 until this Architecture and Sprint B-0 are
  accepted.

This is a security Architecture gap, not a reason to return false success or
retain anonymous Production writes.

## 4. Threat model and trust boundaries

Protected assets:

- Item Selection inputs, evidence, decisions, hashes, and history;
- supplier facts and commercial keywords;
- Product, sourcing, procurement, listing, workflow, Revenue, Queue, and
  marketplace state;
- Supabase session material, auth claims, service keys, and security logs.

Relevant threats:

- unauthenticated calls to public Route Handlers;
- a valid user without the administrator role;
- a revoked administrator using a not-yet-expired JWT;
- CSRF against cookie-authenticated mutations;
- CORS or wildcard-origin mistakes;
- direct Data API access with the public project URL/key;
- service-role leakage or accidental RLS bypass;
- manipulated `user_metadata`, spoofed cookies, stale claims, and confused
  deputy calls;
- stored XSS or malicious URLs causing client-side CSRF;
- replayed mutations, brute-force sign-in, enumeration, and audit-log leakage.

Trust boundaries:

```text
Browser
  -> exact same-origin Next.js Route Handler
    -> verified Supabase Auth claims
      -> active-admin authorization check
        -> user-JWT Supabase client
          -> default-deny RLS / reviewed RPC
            -> Postgres
```

The browser, request cookies, request body, `user_metadata`, forwarded host,
and public Supabase key are untrusted. Verified JWT claims plus the active
administrator registry form the administrator decision. PostgreSQL RLS remains
the final data boundary for user-JWT access.

## 5. Architecture decision summary

V1 adopts:

1. Supabase Auth as the identity provider already adjacent to Supabase
   Postgres.
2. Invitation-only email/password authentication; public signup is disabled.
3. TOTP MFA enrollment before any Production mutation.
4. The Supabase JWT `sub` UUID as the canonical principal subject.
5. One application role claim: `user_role = "admin"`.
6. One integer revocation/version claim: `authz_version`.
7. A non-Data-API `private.admin_principals` registry as the authorization
   source of truth.
8. A Custom Access Token Auth Hook that mints the two claims.
9. Per-request `getClaims()` verification and an active-registry cross-check.
10. User-JWT database calls and default-deny RLS; service-role bypass is not the
    normal application path.
11. A signed cookie-to-header CSRF token, exact-origin validation, no
    credentialed cross-origin access, and explicit cookie/cache controls.
12. Append-only security audit events and bounded per-principal mutation rates.

Rejected alternatives:

- email string allowlists: mutable, case-sensitive identifiers are not stable
  principals and leak identity into configuration;
- authorization from `user_metadata`: authenticated users can change it;
- `getSession()` as identity verification: cookie contents alone are not an
  authorization decision;
- route-only authorization without RLS: direct Data API access would bypass it;
- claim-only RLS: role removal can remain stale until JWT refresh;
- service-role for every server query: it bypasses RLS and turns every route bug
  into a database-wide authorization bypass;
- broad `authenticated` access: any invited or accidentally created user would
  become an administrator;
- process-memory rate limiting: Vercel instances do not share authoritative
  state;
- wildcard subdomain CORS or origin matching: subdomain takeover can bypass the
  browser boundary.

## 6. Administrator principal and bootstrap

The canonical subject is the verified Supabase Auth JWT `sub`, represented as
a UUID. Email is display/recovery metadata only and never an RLS key.

Logical v1 registry:

```text
private.admin_principals
  subject uuid primary key references auth.users(id) on delete restrict
  role text not null check (role = 'admin')
  status text not null check (status in ('active', 'revoked'))
  authz_version bigint not null check (authz_version > 0)
  created_at timestamptz not null default database time
  updated_at timestamptz not null default database time
  revoked_at timestamptz null
  created_by_subject uuid null
```

Rules:

- the schema/table is not exposed through the Supabase Data API;
- `anon` and `authenticated` receive no direct table privileges;
- no browser or normal application route may create, update, or enumerate admin
  rows;
- status or role change increments `authz_version`;
- revocation is retained; rows are not deleted to hide history;
- the exact initial Auth user UUID is enrolled by an owner-approved,
  environment-specific manual runbook after that user is created;
- no UUID, password, TOTP seed, recovery code, or personal email is committed;
- Preview/Staging and Production have separate users and registry rows;
- public signup, anonymous sign-in, and automatic domain-based promotion remain
  disabled.

Bootstrap is a high-risk Production data/configuration action. It requires the
owner to confirm the exact Supabase project, Auth user UUID, target environment,
backup/recovery posture, and post-enrollment sign-in test. Codex must not infer
or enroll a Production administrator.

## 7. Role claim and immediate revocation

The Custom Access Token Auth Hook:

- is executable only by `supabase_auth_admin`;
- reads the registry through a fixed, empty `search_path` and fully qualified
  names;
- writes only `user_role` and `authz_version` into JWT claims;
- emits no administrator claim for absent or revoked subjects;
- is revoked from `anon`, `authenticated`, and `public`;
- fails closed on malformed event, missing subject, or registry error.

Application authorization requires all of:

- a cryptographically verified access token;
- `sub` parseable as UUID;
- `user_role === "admin"`;
- positive integer `authz_version`;
- registry row with the same subject, active status, admin role, and identical
  version.

Database RLS calls `private.is_active_admin()`, which applies the same checks
using `auth.uid()`, `auth.jwt()`, and the registry. The helper is
`SECURITY DEFINER`, has a fixed empty `search_path`, contains no dynamic SQL,
and is executable only by `authenticated`.

A role/status/version change therefore denies the next database call even if
the old JWT has not refreshed. Logout-all/recovery also revokes Supabase Auth
sessions. Claim size remains small.

## 8. Session and Next.js server contract

Implementation uses the supported Supabase SSR pattern and pinned compatible
versions. The implementation Story must read the installed Next.js and
Supabase SSR guides before code changes.

Required modules:

- request-scoped server Supabase client for Server Components and Route
  Handlers;
- auth refresh Proxy using the repository's Next.js version convention;
- centralized `requireAdminPrincipal(request, requiredAssurance)`;
- separate user-JWT data client; no shared mutable global session client;
- auth entry, callback, logout, CSRF bootstrap, and access-denied contracts.

Identity verification:

- use `supabase.auth.getClaims()` for protected pages and Route Handlers;
- never authorize from `getSession()` or a decoded-but-unverified token;
- `getUser()` is reserved for an explicitly fresh Auth-server record, not the
  routine role decision;
- every application service receives an immutable `AdminPrincipal` from the
  route boundary and cannot synthesize one.

Logical contract:

```ts
type AdminPrincipalV1 = {
  subject: string;       // verified UUID string
  role: "admin";
  authzVersion: number;
  assurance: "aal1" | "aal2";
  sessionId: string | null;
};
```

Cookies:

- Production uses `Secure`, `Path=/`, no `Domain`, explicit
  `SameSite=Lax` for the Supabase session lifecycle, and the SDK-supported
  expiration contract;
- auth cookies are `HttpOnly` because v1 has no browser Supabase data client;
  implementation must prove refresh, chunking, callback, logout, and expiry
  behavior before accepting this choice;
- if the pinned SDK cannot safely support server-only HttpOnly auth cookies,
  implementation stops and returns to Architecture review; it must not silently
  weaken the contract;
- authentication and admin responses use `Cache-Control: private, no-store`;
  responses that vary by principal also set the framework-equivalent
  `Vary: Cookie`;
- CDN caching of any `Set-Cookie` auth response is forbidden.

Assurance:

- AAL1 permits protected reads and account/MFA setup.
- AAL2 is required for POST, PUT, PATCH, DELETE, Item Selection persistence,
  runtime control, data mutation, secret-sensitive views, and live commerce
  confirmation.
- Production mutation stays disabled until the administrator has verified TOTP
  and an AAL2 negative/positive test passes.
- Future machine/service principals are out of scope and default denied.

## 9. Route authorization matrix

| Class | Examples | Identity | CSRF | Database |
|---|---|---|---|---|
| public static | assets, public landing | none | none | none |
| public auth bootstrap | sign-in, callback, CSRF bootstrap | pre-auth/state validation | sign-in/logout mutation yes | Auth only |
| public health | allowlisted sanitized health endpoints | none | none | no row data; separately reviewed safe probe only |
| admin read | business GET pages/APIs | admin AAL1 | no mutation token | user JWT + admin SELECT RLS |
| admin mutation | Item Selection, Product/workflow/runtime writes | admin AAL2 | required | user JWT + admin INSERT/UPDATE/RPC |
| live commerce | Coupang/listing/purchasing external writes | admin AAL2 plus existing domain confirmation | required | separate high-risk contract |
| webhook/service | any non-browser caller | unsupported in v1 | n/a | denied |

Default behavior is protected, not public. Every current page/API is inventoried
during implementation. Anything not on the explicit public allowlist requires
admin authorization.

The auth callback validates provider state/PKCE and allows redirects only to a
fixed same-origin path allowlist. Arbitrary `next`, host, or absolute redirect
parameters are rejected.

Authorization occurs:

1. at the protected page boundary for user experience;
2. again inside every Route Handler before reading a body or performing work;
3. in the application service using the supplied principal where action-level
   policy matters;
4. finally in RLS or the reviewed database function.

A Proxy redirect is not the only security control.

## 10. RLS and grants

Production target state:

- RLS is enabled and forced where compatible on application-owned tables;
- `anon` has no table DML on company data;
- `authenticated` receives only the table/RPC privileges required by a
  reviewed route/service operation;
- every company-data policy uses `private.is_active_admin()`;
- separate SELECT, INSERT, and UPDATE policies are used when operations differ;
- DELETE remains ungranted unless a later Architecture explicitly approves it;
- dormant/historical tables remain default-deny;
- policy helper arguments and indexed columns follow reviewed query plans;
- database functions use fixed `search_path`, explicit types, no dynamic SQL,
  allowlisted error codes, and least-privilege EXECUTE grants.

V1 company data is single-tenant. The admin predicate authorizes access to
company rows; it does not pretend rows have an owner column. Multi-tenant
filtering requires a later Architecture and migration.

The Sprint B-0 final post-020 security boundary must:

1. inventory the exact replayed policies and grants;
2. drop or supersede every known broad Product and `dev_*_all` /
   `v4_dev_all_*` policy;
3. revoke anonymous company-data DML;
4. add only approved authenticated-admin policies;
5. preserve a minimal, separately documented public-health function if needed;
6. prove default-deny negative tests before any app switches to authenticated
   access.

Story 3 tables use these exact predicates and never create a parallel role name.

## 11. Database functions and service-role boundary

Normal browser-originated application requests use the verified user's access
token so RLS remains effective.

A `SECURITY DEFINER` function is allowed only when an approved use case needs
transactional multi-table work or private-registry access. Each function must:

- be named and reviewed individually;
- set an empty/fixed `search_path`;
- schema-qualify every object;
- validate `private.is_active_admin()` inside the function;
- enforce AAL2 for mutation through a trusted JWT claim check;
- accept typed bounded inputs;
- avoid dynamic SQL;
- return a narrow DTO, never raw security rows;
- write an audit event in the same transaction where applicable;
- revoke PUBLIC execution and grant only the intended role.

The service-role key:

- is never sent to the browser, committed, logged, snapshotted, or used by a
  session-aware SSR client;
- is not required for Story 3 create/finalize calls;
- is prohibited as a general repository/service client;
- may be introduced only by a later named server operation whose accepted
  Architecture proves why user-JWT RLS and a reviewed function cannot work;
- requires a separate stateless `supabase-js` client, explicit central
  authorization before invocation, secret scoping, audit, and negative tests;
- never converts a failed authorization or RLS result into success.

## 12. CSRF, origin, CORS, and content contract

All cookie-authenticated unsafe methods (`POST`, `PUT`, `PATCH`,
`DELETE`) require all of:

1. exact `Origin` match against a server-configured environment allowlist;
2. rejection of `Sec-Fetch-Site: cross-site`;
3. `Content-Type: application/json` for JSON mutations;
4. header `X-GonggamLine-CSRF`;
5. the identical valid signed token in cookie
   `__Host-gonggamline-csrf`;
6. authentication and required assurance after CSRF prechecks that do not leak
   principal existence.

Token contract:

- cryptographically random nonce, issued time, expiry, and HMAC-SHA-256;
- HMAC uses a dedicated server-only `GONGGAMLINE_CSRF_SECRET`, never a
  Supabase service key or JWT signing secret;
- cookie is `Secure` in HTTPS environments, `Path=/`, no `Domain`,
  `SameSite=Strict`, and intentionally not HttpOnly so same-origin JavaScript
  can copy it to the custom header;
- comparison is constant-time after strict format/length validation;
- maximum age is two hours; rotate after successful sign-in, privilege/session
  change, logout, and expiry;
- token grants no identity or authorization and is safe only as one layer.

The server sends no credentialed cross-origin CORS response. It never uses
`Access-Control-Allow-Origin: *`, wildcard subdomains, or reflective origins.
Preflight for credentialed mutation is denied unless a future Architecture
adds an exact trusted origin.

Client code may call only compile-time or allowlisted same-origin paths. It must
not construct mutation URLs from hash/query/external data.

Configured origins are exact scheme/host/port values. Production and each
Preview environment are separate. The request `Host` alone is not the
allowlist source.

## 13. Rate limits and abuse controls

Ownership:

- Supabase Auth owns its provider-level sign-in, OTP, recovery, and MFA limits.
- Application Security owns Route Handler limits.
- Database / Security owns atomic mutation-limit persistence where required.

Minimum v1 limits:

- sign-in/recovery responses remain generic and follow Supabase Auth provider
  limits; the app does not reveal whether an email is an administrator;
- authenticated ordinary mutations: 30 requests per principal per rolling
  minute;
- Item Selection run creation/finalization: 10 requests per principal per
  minute, with idempotency still required;
- runtime control: 10 requests per principal per minute;
- live commerce attempts: 3 requests per principal per ten minutes in addition
  to the existing explicit confirmation contract.

An approved private-schema atomic rate-limit function may enforce these limits
for authenticated principals. It stores action code, principal UUID, bounded
window data, and database timestamps; it stores no request body, token, email,
or raw IP. Process memory is not authoritative. A denied request returns 429
with bounded `Retry-After` and writes a sanitized audit event.

Any public-auth edge limit beyond Supabase Auth requires a separate verified
provider/configuration decision; implementation must not claim one exists.

## 14. Audit, privacy, and observability

Security audit events are append-only and include:

- database-generated event ID/time;
- correlation ID;
- verified subject when available;
- action code and protected resource type/opaque ID;
- outcome: allowed, denied, failed;
- allowlisted reason code;
- assurance, role, and authz version;
- environment and safe request metadata.

They exclude passwords, TOTP secrets, recovery codes, cookies, access/refresh
tokens, CSRF tokens, service keys, raw JWTs, raw request/response bodies,
provider payloads, evidence content, personal email, stacks, and secret-bearing
URLs.

Required metrics:

- sign-in success/failure category without identity enumeration;
- 401, authorization 403, CSRF 403, AAL2-required, and rate-limit counts;
- active-admin registry mismatch and stale authz-version counts;
- RLS denial, RPC rejection, and service-role usage count;
- auth refresh/callback/logout failure;
- protected-route latency and audit-write failure.

Audit failure on a security-sensitive mutation fails the transaction. Read-only
observability failure is reported and does not invent authorization success.

## 15. Error and recovery contract

HTTP behavior:

- 401: no valid authenticated principal;
- 403 `ADMIN_REQUIRED`: verified identity lacks active admin authorization;
- 403 `MFA_REQUIRED`: valid admin session lacks required AAL2;
- 403 `CSRF_REJECTED`: CSRF/origin/fetch-metadata failure;
- 409: idempotency or state conflict;
- 429: rate limit;
- 503: verified external auth/security dependency unavailable;
- 500: unexpected internal failure with sanitized public message.

Errors do not expose whether an email, UUID, role row, claim, policy, or secret
exists. Logs use correlation IDs and allowlisted codes.

Fail closed when claim verification, registry lookup, CSRF verification, RLS,
or required audit write is unavailable. Session refresh failure clears invalid
session cookies and requires reauthentication; it does not fall back to anon.

Revocation procedure:

1. set registry status to revoked and increment `authz_version`;
2. revoke Supabase Auth sessions through the approved owner runbook;
3. verify the old access token fails the active-registry/RLS check;
4. record the security event;
5. rotate credentials only if compromise evidence requires it.

Recovery never promotes a user automatically. Account recovery restores Auth
access, after which the registry and MFA requirements are checked again.

## 16. Environment and secret separation

Required configuration names:

- existing public Supabase URL and publishable/anon key;
- `GONGGAMLINE_ALLOWED_ORIGINS`: exact non-secret origin list;
- `GONGGAMLINE_CSRF_SECRET`: at least 32 random bytes, server-only;
- any future service-role key: server-only and absent unless a separately
  accepted operation requires it.

Local, CI, Preview/Staging, and Production use separate Supabase projects,
administrator users, role rows, CSRF secrets, origins, logs, and backups.
Production credentials never enter CI or Preview. Example files contain names
and placeholders only.

Vercel environment scope is explicit. A missing or placeholder security
configuration makes protected mutations unavailable; it never disables the
gate. Secret rotation requires dual-window or forced-session behavior documented
before execution.

## 17. Compatibility and deployment order

Architecture approval does not combine implementation Stories. Required order:

1. Accept this document and record the reviewed head SHA.
2. Accept Sprint B-0.
3. In an isolated disposable environment, replay pre-003 then 003–020.
4. Apply the final least-privilege security migration after 020.
5. Verify Auth Hook, registry, claims, RLS, grants, CSRF helpers, audit, and
   negative tests with synthetic users.
6. Deliver the request-scoped SSR auth client and central security gates behind
   a disabled-by-default Production mutation gate.
7. Migrate protected read routes to user-JWT access and verify parity.
8. Migrate state-changing routes; require AAL2 and CSRF.
9. Only then implement Story 3 persistence against the accepted names.
10. Verify dedicated Preview/Staging end to end.
11. Approve the exact Production migration/configuration/administrator
    bootstrap runbook manually.
12. Deploy database security before enabling authenticated application writes.
13. Run read-only Production smoke plus owner-controlled login/MFA checks.
14. Enable one bounded Item Selection mutation only after all gates pass.

There is no mixed state in which anonymous broad write policies remain enabled
while the app claims to be protected.

Compatibility:

- public sanitized health responses may remain stable through a reviewed safe
  probe;
- protected business APIs may change from anonymous 2xx to 401/403; this is an
  intentional security correction and must be documented;
- public DTOs remain explicit; auth/security rows never leak;
- existing live-commerce confirmation remains mandatory and is strengthened,
  not replaced, by admin AAL2 and CSRF.

## 18. Rollback

Before Production data use:

- disable the new protected route feature flag;
- restore the prior application version only if doing so does not re-enable
  anonymous Production writes;
- remove newly created non-Production projects/environments through the
  approved disposable-environment process;
- revert the documentation or implementation PR as appropriate.

After Production security activation:

- do not restore broad anonymous write policies as rollback;
- disable affected mutations, retain authentication and default-deny RLS, and
  forward-fix;
- preserve admin registry and audit history;
- revoke compromised sessions/subjects and rotate affected secrets;
- database restore or destructive policy rollback requires explicit owner
  approval, verified backup, and incident runbook.

## 19. Test and acceptance evidence

Architecture implementation Stories must prove:

Identity/session:

- invited active admin sign-in success;
- public signup disabled;
- unverified, expired, malformed, and spoofed cookie rejection;
- `getSession()` data cannot authorize;
- refresh, chunked cookie, expiry, callback state/PKCE, logout, and no-store
  behavior;
- open-redirect rejection;
- AAL1 read and AAL2 mutation behavior;
- revoked subject and authz-version mismatch denied before JWT expiry.

Authorization/RLS:

- no-session, anon, authenticated-non-admin, missing-role, wrong-role, revoked,
  stale-version, and malformed-claim denials;
- positive admin SELECT/INSERT/UPDATE/RPC cases only where mapped;
- DELETE denied;
- direct Data API attempts with the public key denied;
- every broad development policy removed/superseded in the final state;
- dormant tables default deny;
- policy/grant/function/schema fingerprints match the accepted inventory;
- service role absent from normal request paths;
- `SECURITY DEFINER` ownership, search path, grants, and dynamic-SQL checks.

CSRF/origin:

- missing/malformed/expired/wrong token rejected;
- cookie/header mismatch rejected;
- wrong Origin, wildcard-like subdomain, `Sec-Fetch-Site: cross-site`,
  simple-form content type, and credentialed CORS rejected;
- exact allowed origin and valid signed token accepted;
- rotation after login/logout/session change;
- client-side URL injection negative tests.

Operations:

- rate-limit boundary and reset behavior;
- idempotency remains independent of rate limiting;
- audit success/failure and redaction;
- no token, secret, email, provider payload, evidence text, or stack in rows,
  responses, logs, traces, or artifacts;
- clean full migration replay and schema comparison;
- lint, typecheck, all unit/integration/contract tests, Production build,
  exact-head CI, exact Preview, and read-only browser/API/console/network checks.

Production activation additionally requires actual token-shape negative tests
in a dedicated non-Production Supabase project and an owner-approved exact
runbook. Synthetic local success alone is insufficient.

## 20. Ordered implementation handoff

This Architecture, if accepted, authorizes planning but not automatic execution
of the following separate high-risk/manual Stories:

1. Sprint B-0 isolated database baseline and final security boundary.
2. Auth Foundation: invitation-only Supabase Auth, SSR session, Proxy, central
   principal resolver, login/logout/MFA surfaces.
3. Authorization Foundation: registry, Auth Hook, role/version claims, RLS
   helper, audit, and rate-limit functions.
4. Route Security Migration: explicit public allowlist, protected reads,
   AAL2/CSRF mutations, user-JWT clients, negative tests.
5. Item Selection Story 3 persistence using the exact accepted subject, claim,
   RLS, RPC, audit, and CSRF contracts.

Story 3 itself remains limited by PR #38. It does not gain API/UI, provider
orchestration, Product creation, listing, pricing, procurement, inventory,
order, fulfillment, or marketplace-write scope.

## 21. Owner review checklist

Before changing Proposed to Accepted, the repository owner must explicitly
approve:

1. invitation-only Supabase Auth and no public signup;
2. `sub` UUID, `user_role=admin`, and `authz_version`;
3. private active-admin registry and manual environment bootstrap;
4. AAL1 reads and mandatory TOTP/AAL2 mutations;
5. user-JWT RLS with no normal service-role path;
6. removal of broad anonymous/development policies before Production writes;
7. signed cookie-to-header CSRF, exact origins, and no credentialed CORS;
8. audit, rate limits, fail-closed behavior, and no secret/evidence leakage;
9. ordered high-risk/manual implementation Stories and Production runbook;
10. that no implementation begins merely because this Draft exists.

## 22. Authoritative references

- Supabase SSR client and verified claims:
  https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase Custom Claims and RBAC:
  https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac
- Supabase Row Level Security:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- Next.js authentication and Route Handler security:
  https://nextjs.org/docs/app/guides/authentication
- Next.js data security:
  https://nextjs.org/docs/app/guides/data-security
- OWASP CSRF Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
