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
  status text not null check
    (status in ('invited', 'pending_mfa', 'active', 'suspended', 'tombstoned'))
  authz_version bigint not null check (authz_version > 0)
  created_at timestamptz not null default database time
  updated_at timestamptz not null default database time
  suspended_at timestamptz null
  tombstoned_at timestamptz null
  created_by_subject uuid null
```

Rules:

- the schema/table is not exposed through the Supabase Data API;
- `anon` and `authenticated` receive no direct table privileges;
- no browser or normal application route may create, update, or enumerate admin
  rows;
- every status, role, factor-reset, or recovery change increments
  `authz_version`;
- suspension and deletion are retained as `suspended` and `tombstoned`; rows
  are not deleted to hide history;
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

Administrator lifecycle is fixed as follows:

| Transition | Actor | Required assurance | Preconditions | Result | Session action | Version | Audit / failure |
|---|---|---|---|---|---|---|---|
| absent -> `invited` | repository owner through the environment-specific bootstrap runbook, or an active AAL2 admin after bootstrap | owner out-of-band approval or AAL2 | exact environment/email approved; Admin invitation returns a new exact `sub`; an existing confirmed user conflicts | `invited` | registry starts non-active; no pre-existing-session claim | initialize at 1 | `ADMIN_INVITED`; conflict is 409 |
| `invited` -> `pending_mfa` | invited subject | AAL1 | invitation accepted and verified `sub` matches | `pending_mfa` | retain only the enrollment session | increment | `ADMIN_INVITE_ACCEPTED`; invalid invitation is 401 |
| `pending_mfa` -> `active` | same subject | freshly verified AAL2 | TOTP factor enrolled and challenged successfully | `active` | rotate/refresh the session and CSRF token | increment | `ADMIN_ACTIVATED`; missing AAL2 is 403 `MFA_REQUIRED` |
| `active` -> `suspended` | another active AAL2 admin, or repository-owner break-glass runbook | AAL2 or owner out-of-band | target is not the last active admin | `suspended` | immediately deny old JWT through registry/version, invalidate application CSRF, apply Auth ban; no unsupported sub-only session-delete claim | increment | `ADMIN_SUSPENDED`; last-admin attempt is 409 |
| `suspended` -> `invited` | active AAL2 admin or repository owner | AAL2 or owner out-of-band | recovery/re-invitation approved | `invited` | delete exact factors through supported Admin MFA API, verify session termination, then unban/re-invite by runbook | increment | `ADMIN_REINVITED`; invalid state is 409 |
| unconfirmed `invited` -> `tombstoned` | another active AAL2 admin or repository owner | AAL2 or owner out-of-band | exact invitation expired/bounced; invitation never accepted; target remains `invited`; no verified factor or live Auth session; replacement generation approved | `tombstoned` | registry denial commits first, then exact Auth user soft-delete; partial Auth failure stays tombstoned and retries | increment | `ADMIN_INVITATION_RETIRED`; concurrent acceptance/state change is 409 |
| non-tombstoned -> `tombstoned` | another active AAL2 admin or repository owner | AAL2 or owner out-of-band | target suspended; not last active admin; retention check passed | `tombstoned` | delete exact factors then soft-delete Auth user; old access JWT remains application-denied | increment | `ADMIN_TOMBSTONED`; invalid state is 409 |

An administrator cannot activate, suspend, tombstone, or reset the factor of
another administrator solely through UI state. Every transition is a reviewed
transaction/RPC that locks the target registry row and counts active
administrators before commit. Self-suspension is allowed only when another
active administrator remains. Self-tombstoning and self-factor-reset are
forbidden. Email changes do not change the principal because `sub` is the only
identity key.

The direct unconfirmed-invitation retirement row is the sole exception to the
general suspended-before-tombstoned precondition. Its dedicated transaction
locks the invitation intent and registry row in the same fixed order as
invitation acceptance, rechecks state/generation/version and absence of
acceptance/session/factor evidence, increments `authz_version`, tombstones the
registry subject, and writes audit before any Auth soft-delete. Therefore
acceptance and retirement cannot both commit. It grants no path for
`pending_mfa`, `active`, or `suspended` subjects and cannot be reused as a
general tombstone operation.

The `pending_mfa` activation bootstrap is one of exactly two self-only
lifecycle exceptions to the normal active-administrator function precondition;
the other is invitation acceptance below. The dedicated internal
`private.activate_pending_admin_v1()` `SECURITY DEFINER` function, reached
only through the exposed wrapper `api.activate_pending_admin_v1()`:

- accepts no target subject, role, status, or arbitrary payload; the target is
  always the verified `auth.uid()` of the caller;
- exposes EXECUTE only on the `api` wrapper to `authenticated`; the `private`
  function has EXECUTE revoked from `PUBLIC`, `anon`, `authenticated`,
  `service_role`, and every login role. Its dedicated owner is `NOLOGIN`, is
  not a runtime principal, and retains no application-role membership;
- requires the registry row for that same subject to be exactly
  `pending_mfa`, locks it, and rejects every other state;
- requires a freshly issued, cryptographically verified AAL2 JWT with the same
  non-null `session_id`, an `iat` no more than 60 seconds old, and a verified
  TOTP factor/session established by the pinned Supabase Auth client flow;
- changes only that row to `active`, increments `authz_version`, and atomically
  records `ADMIN_ACTIVATED`;
- returns only the new version and `SESSION_REFRESH_REQUIRED`. The caller must
  refresh claims, replace all auth-cookie chunks and the authenticated CSRF
  token, then prove the new active/version/AAL2 principal;
- cannot invoke, proxy, or share authority with general protected-data
  mutations and grants no protected table access.

A concurrent loser or replay after activation receives 409
`ADMIN_ALREADY_ACTIVATED`; a different subject cannot activate the target
because no target parameter exists. Activation remains disabled while the
required audit/telemetry gate is unhealthy.

Invitation acceptance is also a narrow self-only bootstrap, separate from
activation and every general mutation. The exposed
`api.accept_admin_invitation_v1()` wrapper has no arguments and calls only
`private.accept_admin_invitation_v1()`. EXECUTE is granted to
`authenticated`; it is revoked from `PUBLIC`, `anon`, `service_role`, and all
other login roles. The private function remains unexposed and executable only
by `api_accept_admin_invitation_owner`.

The private function is owned by a dedicated
`invitation_acceptance_owner NOLOGIN` role without superuser/BYPASSRLS. It has
only the registry/audit privileges required for this transition, EXECUTE on the
session-row helper, and column-level SELECT on
`auth.users(id, email_confirmed_at)`; it cannot read email, identities,
credentials, factors, refresh tokens, or unrelated sessions/tables.

Inside one transaction the private function:

1. verifies the signed JWT issuer/audience/project, exact `aal=aal1`, non-null
   `session_id`, and `auth.uid() = sub`;
2. proves the session is live in `auth.sessions` and belongs to the same
   `auth.uid()` under section 11.2;
3. proves the same `auth.users.id` has completed the invitation confirmation
   flow, without reading or returning its email;
4. locks the caller's registry row and requires exactly `status=invited`;
5. validates the database telemetry readiness lease before the first and final
   write;
6. changes only that row to `pending_mfa`, increments `authz_version`, and
   atomically records `ADMIN_INVITE_ACCEPTED`;
7. returns only the new version and `SESSION_REFRESH_REQUIRED`; refreshed
   claims and CSRF state must be verified before MFA enrollment continues.

There is no target parameter and no general-data authority. A concurrent loser
or replay receives 409 `ADMIN_INVITATION_ALREADY_ACCEPTED`; a caller whose
subject differs from the row, whose state is not invited, whose session is
logged out, or whose invitation is unconfirmed is denied without revealing
registry/email existence.

TOTP and recovery contract:

1. An invited subject signs in at AAL1, enters `pending_mfa`, enrolls one TOTP
   factor, verifies a challenge, refreshes the session, and proves the new JWT
   is AAL2 before activation.
2. A normal factor unenroll/re-enroll is allowed only for the same active
   administrator already at AAL2. It increments `authz_version`, revokes all
   application authority and CSRF tokens, downgrades the registry to
   `pending_mfa`, then uses that subject's own JWT with global sign-out to
   destroy refresh sessions. Issued access JWTs remain cryptographically valid
   until expiry but fail registry/version checks. A fresh TOTP challenge is
   required before mutation resumes.
3. Resetting another administrator's factor is allowed only to another active
   AAL2 administrator, never to the target alone, and produces the same
   suspension, version increment, session/factor revocation, and re-invitation
   sequence.
4. V1 does not support application recovery codes. No recovery code is
   generated, stored, displayed, or accepted.
5. Single-administrator lockout uses no application endpoint. The repository
   owner executes an approved environment-specific break-glass runbook that
   records approver, command identifier, target project, and exact `sub`;
   deletes all exact factors through the supported Admin MFA API and verifies
   its documented session-termination behavior; increments `authz_version`;
   places the subject in `pending_mfa`; and blocks mutation until a new TOTP
   factor and AAL2 JWT are verified. Preview and Production runbooks and subjects are
   separate. Personal email possession alone is insufficient.
6. Every invite, activation, suspension, tombstone, factor change, failed
   recovery, and break-glass operation emits a sanitized audit event and
   receives post-event review.

Direct Supabase MFA unenroll is an explicit threat. An authenticated
administrator can call the public Supabase Auth factor-unenroll API without
using GonggamLine UI; UI hiding or application-route sequencing is not a
security boundary. Supabase may leave an already issued AAL2 access JWT usable
until token expiry or refresh, and a database RPC cannot synchronously inspect
the live Auth factor inventory.

V1 therefore applies a bounded residual-risk control at every AAL2 mutation
RPC, including activation: verified JWT `iat` must be no more than 60 seconds
old at database time, in addition to current registry/session/version checks.
After direct unenroll, refresh produces a non-AAL2 token and is denied; an old
AAL2 JWT can have at most the remainder of this 60-second freshness window.
There is no claim of immediate revocation. Production mutation activation
requires the repository owner to explicitly accept this maximum exposure at
the accepted implementation head, or approve a superseding design with live
Auth-factor introspection. Changing the window is an Architecture change.

## 7. Role claim and immediate revocation

The Custom Access Token Auth Hook:

- is executable only by `supabase_auth_admin`;
- reads the registry through a fixed, empty `search_path` and fully qualified
  names;
- writes only `user_role` and `authz_version` into JWT claims;
- emits no administrator claim for absent or any non-`active` subject;
- is revoked from `anon`, `authenticated`, and `public`;
- fails closed on malformed event, missing subject, or registry error.

Application authorization requires all of:

- a cryptographically verified access token whose signature algorithm is
  allowlisted by the target Supabase project's published JWKS;
- exact issuer
  `https://<environment-project-ref>.supabase.co/auth/v1`;
- audience exactly `authenticated`;
- required, unexpired `exp`; valid `nbf` when present;
- project reference and environment equal to the server's configured target,
  so Preview and Production tokens are never interchangeable;
- `sub` parseable as UUID;
- verified JWT `sub` equal to `auth.uid()` at the database boundary;
- `user_role === "admin"`;
- positive integer `authz_version`;
- `aal` equal to the assurance required by the operation;
- non-null, valid Supabase `session_id` whose matching `auth.sessions` row
  exists for every protected read and mutation;
- registry row with the same subject, active status, admin role, and identical
  version.

Database RLS and internal functions call `private.is_active_admin()`, which
applies the same checks using `auth.uid()`, `auth.jwt()`, the registry, and the
section 11.2 session-row helper. The helper is
`SECURITY DEFINER`, has a fixed empty `search_path`, contains no dynamic SQL,
and is executable only by exact internal read/mutation function owners.

A role/status/version change therefore denies the next database call even if
the old JWT has not refreshed. Logout-all/recovery also revokes Supabase Auth
sessions. Claim size remains small.

The Custom Access Token Hook is the only issuer of `user_role` and
`authz_version`. Supabase Auth supplies `sub`, `session_id`, `aal`, `iss`,
`aud`, `exp`, and optional `nbf`; `user_metadata`, email, request headers, and
decoded-but-unverified JWT values are never authorization inputs.

Authorization change and refresh order is normative:

1. Lock and change the registry status/version first.
2. Central authorization and `private.is_active_admin()` immediately reject
   every old JWT as `AUTHZ_STALE` or `ADMIN_REVOKED`, even before JWT expiry.
3. Apply only the supported section 11.1 Auth operation: target-JWT global
   sign-out, verified-factor deletion, Auth ban, or soft-delete. Failure or the
   absence of a sub-only sign-out never restores application authorization
   because the registry mismatch remains authoritative and fail-closed.
4. A legitimate role/status change requiring a new claim performs one explicit
   refresh or reauthentication; background refresh loops are forbidden.
5. Verify the new JWT issuer, audience, signature, subject, session, assurance,
   role, and `authz_version` against the registry.
6. Delete the previous CSRF cookie and issue a token bound to the new session
   and version.

On stale claim detection the server attempts no more than one refresh, and only
for an active registry subject whose session remains valid. A repeated
mismatch, suspended/tombstoned subject, invalid refresh session, or cleanup
failure deletes local auth/CSRF cookies and requires reauthentication. Invalid
authentication returns 401 `AUTHENTICATION_REQUIRED`; a valid identity without
admin authority returns 403 `ADMIN_REQUIRED`; version mismatch returns 403
`AUTHZ_STALE`; revoked state returns 403 `ADMIN_REVOKED`. No error reveals
registry contents.

## 8. Session and Next.js server contract

Implementation pins `@supabase/ssr` exactly to `0.12.3` and
`@supabase/supabase-js` exactly to `2.110.7` as the reviewed compatible pair,
and uses their supported browser/server cookie pattern. The reviewed official package guidance states
that the browser side needs access to the refresh token to maintain the browser
session; therefore v1 does not claim a supported server-only HttpOnly Supabase
session flow. Any package-version change requires the Auth Foundation PR to
repeat the cookie/PKCE/MFA/refresh proof before merge.

Required modules:

- request-scoped server Supabase client for Server Components and Route
  Handlers;
- browser auth client only for password sign-in, TOTP enrollment/challenge, and
  supported refresh/logout coordination; it never queries company data;
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
  sessionId: string;    // verified UUID with a live auth.sessions row
};
```

Cookies:

- Supabase session cookies retain the pinned SDK names
  `sb-<project-ref>-auth-token` plus SDK-defined chunk suffixes. Production and
  Preview project refs therefore produce distinct names.
- Production/Preview use `Secure`, `Path=/`, no `Domain`, explicit
  `SameSite=Lax`, and `HttpOnly=false` because the supported browser client must
  read and rotate the tokens. Client code outside the isolated auth module may
  not read or log them.
- Supabase Auth is configured for a 30-minute inactivity timeout and a 12-hour
  absolute session time box. Access-token expiry is 15 minutes; refresh-token
  rotation and reuse detection are enabled. Following Supabase's SSR guidance,
  Auth cookies use a far-future `Max-Age=34560000` (400 days) and matching
  `Expires`; browser implementation caps are accepted. These attributes only
  preserve token storage and never extend authorization. Supabase Auth's
  server-side session record, 30-minute inactivity limit, 12-hour absolute
  limit, verification, and explicit revocation remain authoritative.
  Cookie deletion/loss is not logout and does not revoke a server session.
  Without the tokens that browser cannot authenticate, but another retained
  token copy can remain usable until explicit revocation or at most the
  configured 12-hour absolute time box plus enforcement at refresh/access-JWT
  expiry. The Auth Foundation must verify the exact configured timeout
  behavior; it must not claim that an unidentified lost cookie can trigger
  server-side revocation.
- Login, PKCE callback, TOTP enrollment/challenge, refresh, chunk replacement,
  and logout use the browser/server clients exactly as supported by
  `@supabase/ssr@0.12.3` with `@supabase/supabase-js@2.110.7`. Proxy performs refresh/cookie propagation only; it is
  never the authorization gate. Route Handlers and RPCs revalidate claims.
- Logout deletes every SDK chunk and the CSRF cookie. Partial chunk state,
  malformed storage, expired absolute/idle lifetime, refresh reuse, or
  cross-project cookies fail closed and clear the local cookie set.
- authentication and admin responses use `Cache-Control: private, no-store`;
  responses that vary by principal also set the framework-equivalent
  `Vary: Cookie`;
- CDN caching of any `Set-Cookie` auth response is forbidden.

Because Supabase session cookies are JavaScript-readable, XSS can steal or use
them. Before Production administrator login is enabled, the Auth Foundation
must ship a nonce-based Content Security Policy, no unsafe inline script,
context-appropriate output encoding, allowlisted HTML sanitization for any rich
content, dependency vulnerability review, and `server-only` separation for
secrets. Until those controls and their browser tests pass, Production admin
login and every protected mutation remain disabled.

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
| admin read | business GET pages/APIs | admin AAL1 | no mutation token | user JWT + bounded `api` read RPC; internal SELECT RLS |
| admin mutation | Item Selection, Product/workflow/runtime writes | admin AAL2 | required | user JWT + named `api` mutation RPC |
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
- `authenticated` receives no direct protected-table privilege; bounded read
  and mutation access is through individually granted `api` wrappers;
- every company-data policy uses `private.is_active_admin()`;
- active AAL1 administrators are read-only;
- every mutation is performed only through a named AAL2-verifying
  `SECURITY DEFINER` RPC; direct Data API mutation is denied even to an active
  AAL2 administrator;
- DELETE remains ungranted and has no v1 RPC;
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

Principal matrix for every protected object:

| Principal | SELECT | direct INSERT/UPDATE/DELETE | RPC EXECUTE | Required predicate |
|---|---|---|---|---|
| `anon` | deny | deny | deny | none |
| authenticated non-admin | deny | deny | only `accept_admin_invitation_v1` for own `invited` row or `activate_pending_admin_v1` for own `pending_mfa` row; otherwise deny | exact section 6 bootstrap predicates, never general mutation |
| revoked/stale admin | deny | deny | deny | status/version mismatch fails |
| active AAL1 admin | no direct table SELECT | deny | only named read wrappers | verified admin/version; AAL1 |
| active AAL2 admin | no direct table SELECT | deny | only named read/mutation wrappers | verified admin/version/session; AAL2 |
| `service_role` | no application data access | prohibited in normal/data paths | no database RPC; server-only Auth Admin API allowlist in section 11.1 only | secret absent from browser, Story 3, SSR, and general data runtime |
| background worker/service principal | deny | deny | deny | unsupported in v1 |

Protected-object matrix:

| Object | Direct SELECT | Direct DML | Allowed AAL2 RPC | `USING` / `WITH CHECK` and immutability |
|---|---|---|---|---|
| `private.admin_principals` | none through Data API | none | self-only `accept_admin_invitation_v1` and `activate_pending_admin_v1` bootstraps plus individually reviewed prepare/complete-invite, suspend, factor-reset, tombstone wrappers | private schema; bootstraps are self-only; management wrappers require active AAL2; locks rows and protects last active admin |
| `private.admin_auth_control_intents_v1` | none | none | prepare/complete/reconcile invitation wrappers only | pre-sub encrypted/HMAC email envelope; no registry row before verified Auth sub; closed PII crypto-shredded |
| `item_selection_runs` | none through Data API; bounded read wrapper only | none | `read/create/finalize_item_selection_run_v1` wrappers | internal SELECT enforces `private.is_active_admin()`; terminal rows immutable; retry creates a new run |
| `item_selection_evaluations` | none through Data API; bounded read wrapper only | none | read wrapper plus insert only inside finalization | internal SELECT enforces active admin; finalized rows append-only |
| run retry/lineage fields | through bounded run-read DTO | none | set only by run-create RPC | remains run-level metadata; cannot alter candidate hashes |
| canonical snapshot/evidence text and JSONB projections | through bounded evaluation-read DTO with redaction | none | inserted only by finalization RPC | columns of immutable evaluations, not separate mutable resources; PR #38 authority unchanged |
| decision result, stage/decision hashes, run/persistence envelope | through bounded read DTO | none | inserted/finalized only by finalization RPC | UPDATE/DELETE denied; PR #38 hash boundaries unchanged |
| `private.security_audit_events` | no direct table SELECT | none | narrow `read_security_audit_v1` for active AAL2 admin; internal append functions only | append-only; direct INSERT/UPDATE/DELETE denied |
| `private.security_rate_limits` | none | none | internal consume/check function only | no browser-visible rows; bounded atomic updates only inside function |

There are no separate candidate, snapshot, evidence, decision, or envelope
tables in v1 beyond the `item_selection_runs` and
`item_selection_evaluations` aggregate accepted by PR #38. This document
references those fields for authorization only and does not redefine their
canonicalization, JSONB projection, decision hash, run/persistence envelope,
`retryOfRunId`, finalization, idempotency, evidence, or replay contracts.

For SELECT policies, `USING (private.is_active_admin())` is explicit. Protected
tables have no INSERT/UPDATE/DELETE grants or policies, so no permissive-policy
combination can create a mutation path. If a later Architecture permits direct
UPDATE, it must add a restrictive AAL2 policy plus both `USING` and
`WITH CHECK`, and the required SELECT policy; v1 does not permit that path.

### 10.1 Exact PostgREST RPC exposure

The Data API exposes a dedicated `api` schema as the protected RPC surface.
`private` is absent from Dashboard **Integrations -> Data API -> Exposed
schemas**, `pgrst.db_schemas`, and PostgREST extra search path. It contains all
tables, authoritative mutation functions, authorization helpers, audit
objects, and the telemetry write gate. No `private` object is directly
addressable through `/rest/v1`, `supabase.schema(...)`, or GraphQL.

The `api` schema contains no table, view, sequence, helper, dynamic dispatcher,
or generic mutation function. It contains only individually named, thin
wrapper functions such as:

- `api.activate_pending_admin_v1()` ->
  `private.activate_pending_admin_v1()`;
- `api.accept_admin_invitation_v1()` ->
  `private.accept_admin_invitation_v1()`;
- invitation prepare/record/reissue/completion are server-only `private`
  control-plane functions and have no `api` wrapper;
- `api.create_item_selection_run_v1(...)` ->
  `private.create_item_selection_run_v1(...)`;
- `api.finalize_item_selection_run_v1(...)` ->
  `private.finalize_item_selection_run_v1(...)`;
- exact lifecycle and bounded audit-read wrappers accepted by their
  implementation Stories.

Each wrapper is `SECURITY DEFINER` and has its own dedicated wrapper-specific
`NOLOGIN` owner (for example
`api_activate_pending_admin_owner`,
`api_accept_admin_invitation_owner`, and
`api_create_item_selection_run_owner`) without `SUPERUSER`, `BYPASSRLS`, or
membership in another wrapper-owner role. Each uses
`SET search_path = ''`, schema-qualifies its single internal call, accepts and
returns only the exact typed DTO, and contains no authorization shortcut or
dynamic SQL. Each wrapper owner receives `USAGE` on `private` and EXECUTE only
on its one exact internal function; it receives no table privilege or EXECUTE
on a sibling internal function. There is no shared wrapper-owner role.

Grant contract:

```sql
revoke all on schema api from public, anon, authenticated, service_role;
grant usage on schema api to authenticated;
revoke execute on all functions in schema api
  from public, anon, authenticated, service_role;
grant execute on function api.activate_pending_admin_v1()
  to authenticated;
-- grant each other exact signature separately; never ALL ROUTINES.

revoke all on schema private
  from public, anon, authenticated, service_role;
revoke execute on all functions in schema private
  from public, anon, authenticated, service_role;
grant usage on schema private to api_activate_pending_admin_owner;
grant execute on function private.activate_pending_admin_v1()
  to api_activate_pending_admin_owner;
```

Default privileges revoke function EXECUTE from `PUBLIC`, `anon`,
`authenticated`, and `service_role` in both schemas; migrations re-grant only
reviewed wrapper signatures. User-JWT clients call
`supabase.schema("api").rpc("<exact wrapper>")`. Tests prove a permitted
user-JWT wrapper call reaches the internal predicate, while `anon`,
`service_role`, wrong-role, and missing/stale/AAL1 claims fail; direct
`private` schema/function/table calls return schema-not-exposed or permission
denied. Schema-cache inspection must show only approved `api` signatures.

## 11. Database functions and service-role boundary

Normal browser-originated application requests use the verified user's access
token so RLS remains effective.

A `SECURITY DEFINER` function is the only v1 database mutation boundary and is
allowed only for named lifecycle and Item Selection transaction use cases.
Every general protected-data or administrator-management function requires an
active administrator. The only lifecycle-bootstrap exceptions are
`private.accept_admin_invitation_v1()` and
`private.activate_pending_admin_v1()`, whose narrower self-only caller, state,
subject, assurance, session, grant, output, telemetry, and audit contracts are
fixed in section 6.
Each function must:

- be named and reviewed individually;
- be owned by a dedicated non-login, non-superuser role without `BYPASSRLS`;
  the owner receives only required schema/object privileges;
- set an empty/fixed `search_path`;
- schema-qualify every object;
- validate `private.is_active_admin()` inside the function, except that the two
  lifecycle bootstraps validate their complete section 6 predicates instead;
- revalidate verified `sub = auth.uid()`, active status, role,
  `authz_version`, non-null `session_id`, and `aal = aal2` inside every
  mutation function;
- accept typed bounded inputs;
- avoid dynamic SQL;
- return a narrow DTO, never raw security rows;
- write an audit event in the same transaction where applicable;
- revoke PUBLIC execution and grant only the intended role.

The migration verification must inspect function owner attributes and
`rolbypassrls`, prove PUBLIC EXECUTE is absent, call every function as anon,
non-admin, stale admin, AAL1 admin, AAL2 admin, owner, and service role, and
prove no owner/BYPASSRLS behavior grants an unreviewed result. Registry writes
are possible only through the named lifecycle functions or repository-owner
break-glass runbook; general administrators cannot issue arbitrary registry
updates.

The service-role key:

- is never sent to the browser, committed, logged, snapshotted, or used by a
  session-aware SSR client;
- is not required for Story 3 create/finalize calls;
- is prohibited as a general repository/service client;
- is permitted only inside the separately deployed server-only Auth control
  plane below and only for its five named Auth Admin operations;
- requires a separate stateless `supabase-js` client, explicit central
  authorization before invocation, secret scoping, audit, and negative tests;
- never converts a failed authorization or RLS result into success.

### 11.1 Privileged Supabase Auth control plane

V1 selects option B: a separate server-only Auth control plane is permitted
because Auth invitations, supported session invalidation, cross-user factor
administration, break-glass recovery, and Auth-user disable/delete cannot use
user-JWT database RLS. Its allowlist is exhaustive:

1. invite an additional administrator Auth user;
2. apply a supported session-invalidating lifecycle operation for an exact
   target subject;
3. remove/reset another administrator's MFA factors;
4. execute repository-owner break-glass recovery;
5. disable or delete an exact Auth user after registry tombstoning approval.

No generic Auth Admin API proxy exists. Story 3, Item Selection, ordinary data,
browser code, SSR session clients, and general services remain service-role
free. Each operation has its own server-only module and Route Handler, imports
a stateless Auth Admin client from a secret-only module, and cannot accept an
arbitrary Auth API method or URL. The service-role secret is a
Production/Preview-separated Vercel server secret; browser imports, client
bundles, logs, DTOs, errors, and artifacts must prove its absence.

Before an Auth Admin call, the route verifies exact Origin/CSRF, rate limit and
idempotency key; cryptographically verifies an active AAL2 administrator,
current registry `authz_version`, session, and JWT age no more than 60 seconds;
and confirms exact target UUID and configured Supabase project/environment.
Self-factor reset/delete is forbidden. Break-glass has no browser route and is
repository-owner out-of-band only.

Invitation is the only operation whose target has no Auth `sub` before the
call. It cannot create a registry row or pretend a subject exists before Auth
succeeds. The AAL2 control-plane Route Handler first creates an idempotent
pre-sub intent through the server-only prepare boundary below.
`private.admin_auth_control_intents_v1` stores:

- opaque intent UUID, exact environment, operation `ADMIN_INVITE`, creator
  subject/session/version, idempotency-key digest, state, attempt count, safe
  error code, timestamps, nullable returned Auth `sub`, and delivery state;
- AES-256-GCM ciphertext/IV/tag of the normalized email, encrypted by a
  server-only per-environment invitation key, plus an HMAC-SHA-256 lookup value
  made with a different per-environment key and both key versions;
- no plaintext email, password, token, invitation URL, or raw Auth response.

The keys exist only in the isolated Auth-control-plane secret module. Raw email
exists transiently in the validated HTTPS request and process memory, is never
passed to audit/telemetry/log/error/trace/artifact output, and is redacted
before any exception crosses the module. Only that module can decrypt the
exact intent. Closed intents crypto-shred ciphertext and email HMAC after 30
days while retaining non-identifying intent/sub/state/audit metadata for seven
years.

The unique idempotency contract is `(environment, operation,
idempotency_key_digest)`. Reuse with the same email HMAC returns the stored
intent/result; reuse with another email/environment conflicts. A second open
intent for the same environment/email HMAC conflicts.

Prepare is not exposed through PostgREST and accepts no user-JWT RPC. After
verifying exact Origin/CSRF, rate limit, idempotency key, active AAL2 principal,
current `authz_version`, live session, JWT age, and environment, the isolated
Auth module generates the ciphertext, HMAC, IV/tag, and key versions itself.
It then connects with the per-environment direct-Postgres
`auth_invitation_prepare LOGIN` identity. That role has no membership, Data API
key, table privilege, service-role capability, or browser import and receives
only `USAGE` on `private` plus EXECUTE on the exact
`private.prepare_admin_invitation_v1(uuid, uuid, bigint, text, text, bytea,
bytea, bytea, text, integer, integer)` and
`private.reissue_admin_invitation_auth_response_capability_v1(uuid, uuid,
bigint, text, text)` signatures. The prepare functions are SECURITY DEFINER
and owned by `auth_invitation_prepare_owner NOLOGIN`. Their arguments are,
respectively, actor subject/session/version, environment, idempotency digest,
ciphertext/IV/tag, email HMAC, encryption/HMAC key versions; and intent,
actor session, actor version, environment, idempotency digest.

The prepare function verifies `session_user`, immutable database environment,
actor subject/session/current registry version, a live locked session row,
telemetry lease, database rate bucket, idempotency digest, supported key
versions, and bounded cryptographic fields. It never accepts plaintext email.
CSRF remains a Route Handler property; direct-RPC bypass is prevented by the
absence of an exposed wrapper and exact server-identity grants, while the
database independently enforces actor/session/rate/idempotency state. It
atomically stores the intent and audits only its opaque ID. `PUBLIC`, `anon`,
`authenticated`, `service_role`, every wrapper owner, and the completion
identity have no EXECUTE grant, so a user JWT cannot supply forged ciphertext
or HMAC.

Invitation completion is not exposed through PostgREST and accepts no user JWT.
The server-only Auth module holds a separate per-environment direct-Postgres
credential for `auth_invitation_completion LOGIN`. That role has no role
membership, Data API key, table privilege, or service-role capability; it has
only `USAGE` on `private` and EXECUTE on the exact call-marker, record,
capability-reissue, and completion functions below. Each is SECURITY DEFINER, owned by
`auth_invitation_completion_owner NOLOGIN`; the owner has only the
control-intent/registry/audit/telemetry privileges needed for these
transitions.

The exact completion-role signatures are:

```text
private.mark_admin_invitation_auth_call_started_v1(
  uuid, text, bigint, bigint, text
)
private.record_admin_invitation_auth_created_v1(
  uuid, uuid, text, bigint, bigint, text
)
private.record_admin_invitation_auth_failure_v1(
  uuid, text, bigint, bigint, text, text
)
private.record_admin_invitation_auth_outcome_unknown_v1(
  uuid, text, bigint, bigint, text
)
private.retry_admin_invitation_auth_call_v1(
  uuid, text, bigint, bigint
)
private.reissue_admin_invitation_completion_capability_v1(
  uuid, uuid, text, bigint
)
private.complete_admin_invitation_v1(
  uuid, uuid, text, bigint, bigint, text
)
```

They bind, in order, the intent, returned/stored sub or allowlisted
failure/ambiguity code where applicable, environment, intent generation,
attempt/capability version where applicable, and capability plaintext. The
reissue function has no old-capability argument
because it requires the already stored `AUTH_CREATED` sub and rotates only
under the trusted completion identity.

Prepare generates a random 256-bit call-marker capability and a separate
random 256-bit Auth-result-record capability.
It stores only separately purpose-tagged SHA-256 digests, versions, consumption
timestamps, and database-issued five-minute expiries, and returns both
plaintext values once to the server-only Route Handler context. Neither reaches
the browser, logs, audit, or telemetry. A capability is valid only for its
exact purpose, intent, environment, intent generation, capability version, and
unexpired/unconsumed digest; marker and record digests can never be
interchanged.

After `inviteUserByEmail` returns an exact sub, the completion identity calls
`private.record_admin_invitation_auth_created_v1(...)` with the still-unconsumed
Auth-result-record capability. That transaction locks the intent, verifies and
consumes only the record capability, stores the exact sub, and transitions only
`AUTH_CALL_STARTED` or `AUTH_OUTCOME_UNKNOWN` to durable `AUTH_CREATED`. This
function, or the owner-approved reconciler invoking it after exact Auth-user
proof, is the sole writer of `AUTH_CREATED`.

Immediately before the external Auth call, the completion identity invokes
`private.mark_admin_invitation_auth_call_started_v1(...)`. It consumes the
current marker capability only, increments the attempt count, records
`auth_call_started_at`, and transitions to `AUTH_CALL_STARTED`. Only after that
commit may the module call Auth. An exact retry after marker commit/response
loss returns the stored `AUTH_CALL_STARTED` marker result without consuming or
revealing the record capability. Consequently `PREPARED` with no
`auth_call_started_at` proves that Auth was never called; every crash or timeout
after the marker is ambiguous and must reconcile rather than re-invite.

Recording `AUTH_CREATED` returns a new random 256-bit completion capability
once, stored only as a digest with its own version and five-minute database
expiry. `private.complete_admin_invitation_v1(...)` locks the intent and
atomically verifies:

- `session_user = auth_invitation_completion` (the caller identity remains
  observable even though SECURITY DEFINER changes `current_user` to the
  function owner);
- exact intent ID and state;
- exact returned Auth sub UUID;
- immutable database environment equals the request environment;
- exact current intent generation;
- exact current capability version;
- database time is before the completion expiry;
- constant-time nonce-digest equality; an exact terminal binding returns its
  stored result, while every nonterminal path requires the capability to be
  unconsumed;
- healthy telemetry lease and no existing conflicting registry subject.

It requires durable `AUTH_CREATED`, consumes the capability, creates the
registry row, advances to `REGISTRY_COMMITTED`, and audits in the same
transaction. No `authenticated`, `service_role`, wrapper owner, prepare
identity, or other control-plane role can execute these functions.

Invitation ordering is normative:

1. server-only prepare commits `PREPARED` with separate marker and
   Auth-result-record capabilities; no registry row exists;
2. atomically commit `AUTH_CALL_STARTED`, then decrypt only in the secret
   module and call
   `auth.admin.inviteUserByEmail(email, { redirectTo })`;
3. on success, validate returned `user.id` UUID/project and record exact
   intent/sub/environment/generation/capability version with the Auth-response
   record capability, durably transitioning to `AUTH_CREATED`;
4. use the returned completion capability to create exactly one registry
   `invited` row at version 1 and commit `REGISTRY_COMMITTED`;
5. every later operation uses only that registry `sub`.

Failure and retry rules:

- deterministic Auth rejection is recorded only by
  `private.record_admin_invitation_auth_failure_v1(...)`. The completion
  identity supplies an allowlisted failure class/code; the function locks the
  exact `AUTH_CALL_STARTED` intent, verifies environment/generation/attempt and
  telemetry, consumes no record capability, writes
  `AUTH_FAILED_RETRYABLE` or `AUTH_FAILED_TERMINAL`, and appends the audit event
  atomically. Terminal classification cannot be retried on the same intent;
- crash, timeout, or network ambiguity after the marker is recorded only by
  `private.record_admin_invitation_auth_outcome_unknown_v1(...)`. It locks
  `AUTH_CALL_STARTED`, verifies the same binding, writes
  `AUTH_OUTCOME_UNKNOWN`, and audits atomically; it never claims `PREPARED` and
  is never blindly re-invited;
- those two writer functions are executable only by
  `auth_invitation_completion LOGIN` through their exact signatures.
  `PUBLIC`, Data API roles, prepare/wrapper owners, and application roles have
  no EXECUTE grant. The owner-approved ambiguity reconciler uses a separate
  per-environment `auth_invitation_reconciler LOGIN` identity with only USAGE
  on `private` and EXECUTE only on
  `private.record_admin_invitation_reconciliation_zero_match_v1(uuid, text,
  bigint, bigint, text)`,
  `private.record_admin_invitation_reconciliation_auth_created_v1(uuid, uuid,
  text, bigint, bigint, text)`, and
  `private.record_admin_invitation_reconciliation_conflict_v1(uuid, text,
  bigint, bigint, text)`. These bind intent, optional proven sub, environment,
  generation, attempt, and allowlisted reconciliation code. No server identity
  owns tables or has service-role capability;
- the reconciler decrypts in memory and uses pinned
  `auth.admin.listUsers({ page, perPage })` with bounded complete pagination to
  find an exact normalized-email match. One matching unconfirmed user invokes
  the record function's reconciler-only proof path and commits `AUTH_CREATED`.
  Multiple, confirmed, older, or environment-mismatched users commit a
  fail-closed conflict requiring manual resolution;
- zero matches atomically transitions `AUTH_OUTCOME_UNKNOWN` to
  `AUTH_FAILED_RETRYABLE` with audited `AUTH_USER_NOT_FOUND`. After the Auth
  email cooldown, `private.retry_admin_invitation_auth_call_v1(...)` locks that
  state, revalidates actor approval, telemetry and database rate limits,
  increments intent generation and attempt epoch, invalidates all old
  capabilities, returns new marker and record capabilities once, and moves to
  `PREPARED`. Concurrent reconcilers/retries serialize on the intent; the first
  valid state/generation wins and every loser returns the stored state or 409;
- Auth success followed by failure before `AUTH_CREATED` commits leaves
  `AUTH_CALL_STARTED`, or `AUTH_OUTCOME_UNKNOWN` if the ambiguity writer
  commits. It can never return to `PREPARED` without the zero-match retry
  transition above. Reconciliation must prove the exact Auth user before the
  record function stores the sub and transitions to `AUTH_CREATED`. A
  different sub conflicts;
- if either five-minute pre-call capability expires while the intent is
  still `PREPARED` with no call marker and zero attempts, the prepare identity
  may call `private.reissue_admin_invitation_auth_response_capability_v1(...)`
  to atomically rotate both purpose-separated digests under the original
  actor/session/idempotency/rate checks and return both plaintext values once.
  Once `AUTH_CALL_STARTED` exists, no caller assertion can renew either;
  reconciliation must first prove the exact Auth outcome and commit
  `AUTH_CREATED`;
- `private.reissue_admin_invitation_completion_capability_v1(...)` may issue a
  replacement completion capability only for locked `AUTH_CREATED`, the exact
  stored sub/environment/generation, healthy telemetry, an unexpired intent,
  and a bounded database rate/attempt counter. It increments capability
  version and invalidates every older digest without changing intent
  generation;
- if `AUTH_CREATED` committed but its response was lost, retrying the consumed
  Auth-response capability returns only the stored `AUTH_CREATED` status and
  exact stored sub binding, never capability plaintext; the server then uses
  the reissue function. If `REGISTRY_COMMITTED` committed but its response was
  lost, retrying the exact consumed completion capability and exact
  intent/sub/environment/generation/version returns the stored terminal result.
  Thus consumed-capability replay is rejected in every nonterminal,
  cross-binding, or stale-version case, while exact terminal-result recovery is
  explicitly idempotent rather than contradictory;
- successful API delivery remains `DELIVERY_UNCONFIRMED` until invitation
  acceptance. Bounce/expiry never creates another registry row. Owner-approved
  retry first uses the dedicated unconfirmed `invited -> tombstoned`
  transaction above. It locks against concurrent acceptance, increments
  `authz_version`, commits registry denial/audit, then soft-deletes the exact
  unconfirmed Auth user. A soft-delete partial failure remains tombstoned and
  blocks replacement invitation while bounded retry runs. Only after Auth
  deletion is verified may a separately approved new intent/generation invite
  a new sub; the old subject is never reused;
- process crash at every boundary is recovered from committed intent state;
  attempts are bounded and rate-limited, and no failure promotes an identity.

Revocation order is registry-first: lock the target, move it to the approved
fail-closed state and increment `authz_version`, commit its audit intent, then
call the exact Auth Admin operation. Auth-side failure leaves the registry
revoked, records a retryable partial-failure event with the same
correlation/idempotency key, and queues bounded retry; it never restores active
state. Repeating the same key returns the stored operation/result; changing
operation, target, or environment conflicts. Invitation follows the separate
pre-sub intent contract above and never creates a registry row until Auth
returns a verified sub. Disable/delete requires pre-existing
suspended/tombstoned state and never deletes registry or audit history.

The pinned `@supabase/supabase-js@2.110.7` operation map is exact:

| Intent | Exact supported API | Required proof and result |
|---|---|---|
| invite | `auth.admin.inviteUserByEmail(email, { redirectTo })` | server secret only; returned `user.id` becomes exact `sub`; wrong redirect/environment fails |
| enumerate/remove another user's factors | `auth.admin.mfa.listFactors({ userId: sub })`, then `auth.admin.mfa.deleteFactor({ userId: sub, id: factorId })` for each exact factor | pinned API is experimental and must be contract-tested; deleting a verified factor is expected to terminate that user's active sessions |
| disable/suspend Auth login and refresh | `auth.admin.updateUserById(sub, { ban_duration: "876000h" })` | exact returned user ID must match; a dedicated integration test must prove new sign-in and refresh fail before Production use |
| soft-delete Auth user | `auth.admin.deleteUser(sub, true)` | only after registry tombstone; exact returned identity/status verified; registry/audit retained |
| global sign-out when a target JWT is available | `auth.admin.signOut(targetAccessJwt, "global")` | requires that target's valid logged-in JWT; destroys refresh sessions but does not cryptographically revoke issued access JWTs |

The pinned SDK has no supported `sub`-only global session-revoke method:
`auth.admin.signOut` requires the target access JWT. The application does not
collect, store, mint, or retrieve another administrator's JWT, so a generic
“revoke all sessions by target sub” operation is not claimed. A standalone
session-only revoke is repository-owner runbook-only and may run
`auth.admin.signOut(jwt, "global")` only when the target voluntarily supplies a
currently valid JWT through an approved non-logging channel. Without such a
JWT, the runbook selects a supported lifecycle alternative: registry
suspension plus Auth ban, verified-factor deletion, or soft-delete. It never
edits `auth.sessions`/`auth.refresh_tokens` directly or calls undocumented
endpoints.

Access-JWT denial and refresh-session destruction are separate:

- registry status/version changes immediately block every protected wrapper
  and internal function even though an issued access JWT remains
  cryptographically valid until `exp`;
- global `signOut` destroys refresh sessions but cannot invalidate an issued
  access JWT before `exp`;
- verified-factor deletion is the supported factor-reset path that also
  terminates sessions, subject to pinned integration proof;
- ban blocks subsequent sign-in/refresh only after its contract test proves
  that behavior; it is not described as deleting refresh-session rows;
- soft-delete prevents future Auth use but never substitutes for
  registry-first application denial.

If any pinned-SDK proof differs in the exact target Supabase project,
Production activation remains frozen and the operation falls back to the
repository-owner runbook or a superseding Architecture. No undocumented Auth
schema write is an allowed fallback.

### 11.2 Logged-out session-row enforcement

V1 adopts Supabase's documented strong sign-out check: the signed JWT
`session_id` must correspond to the primary key of an `auth.sessions` row.
Supabase documents that sign-out removes affected session rows while the
already issued JWT otherwise remains cryptographically valid until `exp`.
Therefore signature/expiry alone is insufficient for any protected read or
mutation.

`private.assert_auth_session_present_v1()` is a `SECURITY DEFINER` helper owned
by `auth_session_lock_owner NOLOGIN`, with empty search path and no dynamic
SQL. PostgreSQL locking clauses require `SELECT` on referenced columns and
`UPDATE` on at least one column. Its exact grants are therefore `USAGE` on
`auth`, `SELECT (id, user_id)` on `auth.sessions`, and the minimum
`UPDATE (id)` required for `FOR KEY SHARE`. `id` is the locked primary-key
column. The role receives no UPDATE on any other column and no
INSERT/DELETE/TRUNCATE/REFERENCES/TRIGGER, access to refresh tokens,
identities, email, factors, or application tables, membership,
`BYPASSRLS`, or superuser privilege. The helper contains no UPDATE statement.
The otherwise-sensitive `UPDATE (id)` privilege is reachable only inside this
fixed helper because the owner is NOLOGIN and is not granted to any migration,
application, control-plane, or wrapper role. EXECUTE is revoked from `PUBLIC`,
`anon`, `authenticated`, `service_role`, every wrapper owner, and all login
roles, and granted only to the exact internal read/mutation function owners.

The helper requires:

- verified non-null UUID `session_id` and UUID `sub`;
- `auth.uid() = sub`;
- exactly one `auth.sessions` row with `id = session_id` and
  `user_id = auth.uid()`;
- normal JWT issuer/audience/project/`exp`/`nbf` checks already completed.

Every internal bounded read and mutation function invokes the helper before
accessing company data. The helper executes the exact predicate above with
`FOR KEY SHARE` and retains the session-row lock until the wrapper transaction
ends. A read wrapper acquires the lock before its first protected query and
does not end its transaction until its bounded result has been materialized.
Activation, invitation acceptance, lifecycle, Auth-intent, Story 3, and future
mutations acquire the same lock before their first protected access and recheck
existence immediately before the final audit/write statement.

Supabase sign-out's row deletion must wait for an already-running protected
read or mutation. Consequently, after sign-out returns, no transaction using
that deleted session can newly return protected data or commit a mutation.
Bytes fully materialized before logout may still be in network transit and are
not described as a post-logout authorization. Read and mutation statement
timeouts remain five seconds.

A missing/mismatched row returns sanitized 401 `SESSION_REVOKED`, even if the
JWT signature, `exp`, role, version, AAL, and telemetry lease remain valid.
Neither `api` wrappers nor internal owners can bypass the helper. The check
specifically enforces explicit session-row removal such as sign-out; configured
inactivity/time-box limits are still enforced by Auth refresh plus JWT expiry
and are not inferred solely from row presence because Supabase may clean those
rows later.

The Auth Foundation migration must fingerprint the required `auth.sessions`
columns and primary key against the exact target Supabase version. Its
privilege proof queries `information_schema.column_privileges`,
`information_schema.table_privileges`, `pg_proc`, `pg_roles`, and role
membership to prove the exact column grants, NOLOGIN/non-superuser/non-BYPASSRLS
owner, fixed `search_path`, SECURITY DEFINER owner, and absence of broader
grants. Positive migration proof executes the helper through each authorized
internal owner. Negative proof verifies permission denied for application,
control-plane, and wrapper roles on direct session SELECT/locking/UPDATE and
helper EXECUTE, and verifies helper failure when a disposable migration fixture
individually omits `USAGE auth`, `SELECT (id)`, `SELECT (user_id)`, or
`UPDATE (id)`. The official sign-out/session-row integration proof runs in
disposable and dedicated Preview projects. If the schema, privilege, locking,
or deletion semantics differ, Production protected reads and writes remain
disabled until a superseding accepted contract exists.

## 12. CSRF, origin, CORS, and content contract

All cookie-authenticated unsafe methods (`POST`, `PUT`, `PATCH`,
`DELETE`) require all of:

1. exact `Origin` match against a server-configured environment allowlist;
   a missing `Origin` is rejected and there is no `Referer` fallback;
2. rejection of `Sec-Fetch-Site: cross-site`;
3. `Content-Type: application/json` for JSON mutations;
4. header `X-GonggamLine-CSRF`;
5. the identical valid signed token in cookie
   `__Host-gonggamline-csrf`;
6. authentication and required assurance after CSRF prechecks that do not leak
   principal existence.

Token contract:

- pre-auth login CSRF and authenticated-mutation CSRF use different token
  versions, purposes, cookie/header names, HMAC domain separators, and verifier
  functions; they are never interchangeable;
- authenticated token HMAC input is the unambiguous length-prefixed encoding of
  token version, purpose `admin-mutation`, cryptographically random nonce,
  issued time, expiry, environment/application identifier, verified
  `session_id`, and current `authz_version`;
- authenticated mutation requires non-null
  `AdminPrincipalV1.sessionId`. Missing/unverifiable session ID fails closed;
- the stored token may contain a fixed-format SHA-256 digest of `session_id`,
  not the raw session identifier, but the server recomputes it only from the
  verified JWT;
- HMAC uses a dedicated server-only `GONGGAMLINE_CSRF_SECRET`, never a
  Supabase service key or JWT signing secret;
- cookie is `Secure` in HTTPS environments, `Path=/`, no `Domain`,
  `SameSite=Strict`, and intentionally not HttpOnly so same-origin JavaScript
  can copy it to the custom header;
- comparison is constant-time after strict format/length validation;
- authenticated nonce is reusable only within the same verified session and
  `authz_version` for at most 15 minutes. Reuse is intentional for concurrent
  browser requests; it does not prevent a captured same-origin request replay
  and never supplies mutation idempotency. Every state-changing operation
  separately enforces its domain idempotency key/state precondition. A later
  one-time nonce design requires server-side consumption state and a new
  contract;
- pre-auth login token has a five-minute lifetime and one authentication
  purpose only;
- rotate and reject prior tokens after sign-in, session rotation or refresh
  replacement, privilege/status/`authz_version` change, MFA
  enrollment/unenrollment/reset, logout, and expiry;
- token grants no identity or authorization and is safe only as one layer.

The CSRF cookie name is `__Host-gonggamline-csrf` in Preview/Production and is
always `Secure`, `Path=/`, has no `Domain`, uses `SameSite=Strict`,
`HttpOnly=false`, and `Max-Age=900`. Local development must use HTTPS for that
name. An explicit dev-only HTTP fallback uses
`gonggamline-dev-csrf`, is accepted only when `NODE_ENV=development` and the
configured origin is loopback, and CI proves it cannot be enabled in Preview or
Production.

The server sends no credentialed cross-origin CORS response. It never uses
`Access-Control-Allow-Origin: *`, wildcard subdomains, or reflective origins.
Preflight for credentialed mutation is denied unless a future Architecture
adds an exact trusted origin.

Client code may call only compile-time or allowlisted same-origin paths. It must
not construct mutation URLs from hash/query/external data.

Configured origins are exact scheme/host/port values. Production and each
Preview environment are separate. The request `Host` alone is not the
allowlist source.

V1 unsafe application operations use Route Handlers only. Server Actions are
prohibited for sign-in, logout, MFA, administrator lifecycle, protected data
mutation, Story 3, runtime control, and commerce actions. This avoids a second
form/multipart security path. Mutation Route Handlers accept only
`application/json`; `multipart/form-data`,
`application/x-www-form-urlencoded`, and `text/plain` are rejected before body
processing or state change. GET, HEAD, and OPTIONS never mutate state. CORS
preflight success is transport permission only and never authentication or
authorization.

CSRF does not mitigate XSS. The CSP, encoding, sanitization, inline-script, and
dependency controls in the session section are separate mandatory Production
gates.

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

IP-based throttling is defense-in-depth only until a separate Vercel deployment
decision records which proxy headers Vercel overwrites, which are
client-spoofable, the trusted proxy-chain length, IPv4/IPv6 normalization, and
the distributed store. No implementation may trust the first arbitrary
`X-Forwarded-For` value. Authenticated limits key primarily by verified
subject/session/action; login, MFA, and recovery use provider controls plus a
separately approved normalized network key. The distributed limiter fails
closed for security/admin/factor/Story 3 mutations and may fail open only for
allowlisted read-only health traffic with an alert.

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

Audit access and retention contract:

- `private.security_audit_events` is outside the Data API; anon,
  authenticated non-admin, stale/revoked admin, and direct browser clients have
  no table privileges;
- active administrators have no direct INSERT/UPDATE/DELETE. An active AAL2
  administrator may query only a redacted bounded page through
  `read_security_audit_v1`; the repository owner uses a separate audited
  environment runbook for broader incident access;
- successful security-sensitive mutations insert their allowlisted audit event
  atomically in the same transaction and fail closed if that insert fails;
- denials, rollbacks, and pre-transaction failures are written to a separate
  append-only security telemetry sink so rolling back the business transaction
  cannot erase them. Sink events carry correlation ID and allowlisted metadata,
  not bodies or secrets;
- administrator, factor, policy/grant, Auth Hook, break-glass, and secret
  rotation events include allowlisted before/after state codes but never raw
  values;
- audit rows and security telemetry are retained for seven years. They follow
  the Production-only backup/restore boundary; quarterly restore verification
  checks counts, ordering, immutable digests, and redaction without exporting
  sensitive contents;
- audit UPDATE/DELETE is forbidden. Retention expiry, if later legally
  required, needs a superseding Architecture and separately approved archival
  operation.

Required audit sink failure behavior:

- ordinary protected reads may succeed after authorization if the telemetry
  sink alone is unavailable, but emit a health alert and never claim an audit
  event was stored;
- every mutation, administrator/factor/policy change, break-glass action, and
  Story 3 finalization fails closed when its required atomic audit cannot be
  recorded;
- denial-sink failure raises a critical alert and activates the Production
  protected-write freeze until the sink and evidence path recover;
- degraded audit state never relaxes authentication, authorization, RLS, AAL2,
  CSRF, or idempotency.

### 14.1 Denial telemetry sink prerequisite

The external durable sink/provider is intentionally not invented by this
Architecture. Before any Preview or Production protected mutation is enabled,
a separate high-risk **Security Telemetry Sink Operations** decision must be
accepted by the repository owner at an exact head. Until then the sink
readiness flag is false and protected writes, activation, Auth-control-plane
operations, and Story 3 finalization remain frozen.

That prerequisite must select the exact managed provider, region, account,
plan, retention capability, backup/export destination, and data-processing
terms. Its implementation contract is already fixed:

- append-only streams are separately named
  `gonggamline-security-denial-preview-v1` and
  `gonggamline-security-denial-production-v1`; no environment shares a writer,
  key, queue, index, or backup;
- the writer is a dedicated server-only `security-telemetry-writer` identity
  with append-only permission and a per-environment secret in Vercel; neither
  browser, general service-role client, administrator JWT, nor read identity
  can write;
- the only event fields are schema version, event ID, occurred-at,
  environment, correlation ID, idempotency key, verified subject when
  available, action/resource code, opaque resource ID, outcome, reason code,
  assurance, authz version, and allowlisted safe request metadata. Bodies,
  email, tokens, factors, provider evidence, stacks, and secrets are forbidden;
- idempotency is `(environment, event_id)`; correlation ID groups attempts but
  does not deduplicate them. Exact duplicates are retained once, payload
  mismatch on the same event ID is quarantined and alerts;
- the separately selected provider-managed durable encrypted queue retries transient failures with
  exponential backoff plus jitter at 1, 2, 4, 8, 16, and 30 seconds, then every
  5 minutes for 24 hours. The queue acknowledges only a provider durable-write
  receipt and preserves ordering per correlation ID;
- health is failed after the first required write cannot obtain a durable
  receipt within 5 seconds, writer authentication fails, backlog age exceeds
  60 seconds, or schema/retrieval canary fails. The central mutation gate then
  flips to write freeze before another protected write is admitted;
- recovery requires restored provider health, secret validation, canary
  append/read, ordered backlog drain with idempotency verification, zero
  quarantined mismatches, and repository-owner unfreeze approval. Backlog loss
  is an incident and cannot be waived by reenabling writes;
- Production events remain immutable and queryable for seven years. The
  selected provider and owner-approved operations runbook own retention lock,
  encrypted backup/export, quarterly restore tests, and evidence. Preview uses
  a separate non-Production retention chosen by the prerequisite and can never
  receive Production data;
- the dedicated security-reader identity is read-only and granted only to the
  repository-owner incident runbook. Administrators and application roles have
  no direct query, update, retention-change, or delete permission. Legal
  deletion requires a superseding Architecture and owner-approved operation.

The prerequisite acceptance test must prove provider receipt semantics,
append-only/deny-delete policy, writer and reader isolation, redaction/schema
rejection, duplicate/mismatch behavior, queue exhaustion, automatic write
freeze, recovery/backlog replay, seven-year Production retention, backup and
restore, and Preview/Production separation. A configured but unproven sink is
not Ready.

### 14.2 Database-enforced telemetry readiness lease

Application flags and Route Handler checks are defense in depth, not the
authoritative freeze. Each environment database has exactly one private row:

```text
private.security_write_gate_v1
  environment             text primary key
  state                   READY | FROZEN
  generation              bigint
  heartbeat_at            timestamptz
  lease_expires_at        timestamptz
  provider_receipt_digest text
  frozen_reason_code      text null
  recovered_by            uuid null
  recovered_at            timestamptz null
```

The row is not in an exposed schema and has no privileges for `PUBLIC`, `anon`,
`authenticated`, `service_role`, application owners, or any API wrapper owner.
Preview and Production have different rows, databases, provider receipts, and
writer credentials; `environment` must equal the immutable database setting
for the target deployment.

The accepted telemetry provider's monitor owns a dedicated per-environment
`telemetry_gate_writer LOGIN` database credential stored only in its secret
store. It has no role membership, Data API key, table privilege, or application
function access. It receives only `USAGE` on `private` plus EXECUTE on the two
exact signatures below. Through a direct TLS Postgres connection it may
execute only:

- `private.freeze_security_write_gate_v1(reason_code, generation)` to set
  `FROZEN` immediately and invalidate the lease;
- `private.heartbeat_security_write_gate_v1(environment, generation,
  provider_receipt_digest)` to extend a READY lease only after a durable sink
  canary receipt, healthy writer authentication, and backlog age <=60 seconds.

Both functions are owned by a separate `telemetry_gate_owner NOLOGIN`, use an
empty search path, accept bounded allowlisted inputs, and have EXECUTE revoked
from every other role. The monitor heartbeats every 10 seconds. A heartbeat can
set `lease_expires_at` to at most database `clock_timestamp() + 30 seconds`;
caller timestamps are forbidden. Wrong environment, non-monotonic generation,
missing/invalid provider receipt, or an already frozen generation fails closed.

Recovery never changes FROZEN directly to READY from a heartbeat. After the
section 14.1 recovery checks and backlog drain succeed, a repository-owner
runbook records a new monotonically increasing generation through the separate
`private.recover_security_write_gate_v1(...)` operation, scoped to the exact
environment and writer identity. Two consecutive healthy 10-second heartbeats
for that generation are required before the second heartbeat sets READY.
Recovery, freeze, and heartbeat changes are append-only audited.

`private.assert_security_write_ready_v1()` is called inside every authoritative
activation, administrator lifecycle, Auth-control-plane registry intent,
Item Selection create/finalize, and future protected mutation function. It
locks the exact environment gate row `FOR SHARE` and requires `state=READY`,
the current generation, non-null receipt digest, `heartbeat_at` within 20
seconds, and database time strictly before `lease_expires_at`. The assertion
runs before the first write and again immediately before the final audit/write
statement; mutation transactions have a five-second statement timeout. Any
failure raises the same sanitized `SECURITY_WRITE_FROZEN` error and rolls back.

The external monitor writes FROZEN immediately on sink failure. If monitor-to-
database connectivity also fails, the non-renewable database lease closes the
direct-RPC path within at most 30 seconds. No application caller, user JWT,
service role, wrapper owner, or internal mutation owner can renew or bypass the
lease. A direct PostgREST wrapper call therefore cannot evade telemetry freeze.

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

1. set registry status to `suspended` and increment `authz_version`;
2. apply Auth ban and, when available, the supported target-JWT global sign-out
   or verified-factor deletion; never claim a sub-only session API;
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

Architecture approval does not combine implementation Stories. Production uses
a repository-owner-approved maintenance-window atomic cutover because the
current anonymous application contract cannot coexist safely with the final
user-JWT/RPC boundary.

| Step | Action and success criterion | Failure / rollback state |
|---|---|---|
| 1 | Accept this Architecture, the Security Telemetry Sink Operations prerequisite, and Sprint B-0; prove the full sequence in disposable and dedicated Preview/Staging environments. | no Production action |
| 2 | Enter maintenance/write-freeze mode; all company-data mutations return 503 while read-only health remains available. | remain frozen |
| 3 | Verify exact Production project, origin, backup, secrets, session settings, telemetry provider/receipt/retention health, owner-approved administrator bootstrap identifiers, and recorded owner acceptance of the 60-second direct-unenroll residual exposure. | abort; no policy change |
| 4 | Create private registry/audit/rate-limit objects and dedicated non-login function owner; bootstrap the invited admin. | rollback new unused private objects or forward-fix while frozen |
| 5 | Install and verify the Custom Access Token Hook; prove issuer/audience/project, role/version, session, AAL1/AAL2, stale and revoked synthetic cases. | disable Hook and remain frozen; no anonymous write restoration needed |
| 6 | Prepare new RLS and RPC definitions without exposing protected writes; fingerprint grants, owners, policies, functions, and broad policies scheduled for removal. | drop only unused new definitions or forward-fix while frozen |
| 7 | Deploy the SSR auth application and central Route Handler security gate with every protected write feature disabled. | restore prior read application only if write freeze remains |
| 8 | Run Production-safe login/session/AAL read checks and non-Production mutation deny/allow tests against the exact artifacts. | remain frozen |
| 9 | In one reviewed database change window, remove broad anonymous/development policies, revoke direct protected-table DML, and activate final SELECT plus AAL2 RPC grants/policies. | forward-fix or keep all writes disabled; never restore broad anonymous writes |
| 10 | Re-run anon, pending-MFA bootstrap, non-admin, stale, AAL1, AAL2, direct Data API, direct-unenroll/old-JWT RPC, owner/BYPASSRLS, audit/telemetry-freeze, and service-role/control-plane tests. | write freeze remains |
| 11 | Enable one bounded protected write path, smoke it with owner-controlled AAL2/CSRF/idempotency, then enable only explicitly approved routes. | disable the affected application write flag |
| 12 | Repository owner approves Production write activation and records exact application/migration SHAs and evidence. | no approval means frozen/disabled |

Allowed temporary states are maintenance/read-only, disabled protected writes,
and final default-deny security with the application write flag off. Forbidden
states are broad anonymous writes beside claims of protection, protected writes
before AAL2/CSRF/audit verification, or application fallback to anon/service
role. Auth Hook failure, audit failure, registry mismatch, or administrator
lockout keeps mutations fail-closed; lockout recovery uses only the break-glass
runbook. Rollback prioritizes application write disable and maintenance mode,
never RLS/auth relaxation.

Only after this cutover may Story 3 be implemented against the accepted names
and separately delivered. Preview and Production retain separate projects,
subjects, cookies, origins, secrets, and evidence.

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
- cookie persistence cannot authorize or extend a server session. Cookie-loss
  tests prove only local unauthenticated behavior and explicitly prove no
  automatic server revocation claim; logout tests separately prove Auth
  session-row deletion; chunk-cleanup tests separately remove every current
  and obsolete suffix and make repeated cleanup safe; Auth-timeout tests
  separately prove the configured inactivity and absolute time-box behavior;
- open-redirect rejection;
- AAL1 read and AAL2 mutation behavior;
- revoked subject and authz-version mismatch denied before JWT expiry.
- wrong issuer, audience, project/environment, algorithm/signature, expired
  `exp`, and invalid `nbf` denied;
- stale-claim one-refresh maximum, cookie cleanup, machine-readable response,
  refresh-session revocation, and no refresh loop;
- email change preserves the same authoritative `sub`;
- pinned `@supabase/ssr@0.12.3` plus
  `@supabase/supabase-js@2.110.7` browser/server proof for PKCE callback, token
  refresh/rotation, chunk replacement, TOTP, logout, idle/absolute expiry,
  no-store, and Preview/Production separation;
- loopback HTTPS or dev-only CSRF cookie naming cannot be enabled in Preview or
  Production.

Authorization/RLS:

- no-session, anon, authenticated-non-admin, missing-role, wrong-role, revoked,
  stale-version, and malformed-claim denials;
- positive admin read/mutation wrapper RPC cases only where mapped; direct
  protected-table SELECT/INSERT/UPDATE/DELETE remains denied;
- DELETE denied;
- direct Data API attempts with the public key denied;
- every broad development policy removed/superseded in the final state;
- dormant tables default deny;
- policy/grant/function/schema fingerprints match the accepted inventory;
- service role absent from normal request paths;
- `SECURITY DEFINER` ownership, search path, grants, and dynamic-SQL checks.
- active AAL1 direct Data API INSERT/UPDATE/DELETE denied;
- active AAL2 direct protected-table mutation denied while the named AAL2 RPC
  succeeds;
- every protected-object/principal/operation matrix cell is tested, including
  UPDATE `USING`/`WITH CHECK` absence, no permissive-policy bypass, immutable
  snapshot/evidence/decision/audit rows, and v1 worker denial;
- dedicated non-login owner and owner/`BYPASSRLS` invocation cannot bypass the
  function's internal active-admin/version/session/AAL2 checks;
- service-role key/import/client is absent from normal Story 3 and
  browser-originated application paths.
- `pending_mfa` self-activation succeeds only through
  `activate_pending_admin_v1` with the caller's own subject, freshly verified
  AAL2 factor/session, exact EXECUTE grants, version increment, audit, and
  post-activation claim/CSRF refresh; failure, concurrent activation, replay,
  and attempted activation of another subject are denied;
- invitation acceptance succeeds only through the no-argument
  `accept_admin_invitation_v1` wrapper for the caller's own confirmed invited
  subject at AAL1 with a present session row and healthy telemetry lease;
  another subject, unconfirmed invite, missing/logged-out session, wrong state,
  replay, and concurrent acceptance are denied and cannot gain general-data
  authority;
- invitation completion has no exposed `api` wrapper and is callable only by
  the per-environment direct-Postgres `auth_invitation_completion` identity.
  Migration and integration tests deny direct completion by a user JWT,
  `authenticated`, `service_role`, every wrapper owner, and every other
  control-plane identity; they also reject a forged returned sub, consumed or
  replayed nonce, expired capability, wrong generation, another intent,
  another environment, and concurrent completion. The success case proves
  atomic nonce consumption, exact returned-sub binding, registry creation,
  intent transition, and audit;
- marker and Auth-result-record capabilities have different purpose-tagged
  digests and versions. Tests cover normal marker/Auth/record flow, marker
  commit-response loss and exact retry, record capability remaining usable
  after marker consumption, marker supplied to record, record supplied to
  marker, old/replayed/expired/wrong-stage/wrong-generation capabilities, and
  concurrent marker/record calls;
- invitation prepare has no exposed `api` wrapper. Tests prove that user JWT,
  `authenticated`, `service_role`, every wrapper owner, completion identity,
  and direct PostgREST calls cannot insert an intent or supply
  ciphertext/HMAC; only the environment-specific prepare identity succeeds
  after Route Origin/CSRF and database actor/session/rate/idempotency checks.
  Forged actor/session/version/environment/key-version fields, duplicate-key
  conflicts, rate bypass, and missing telemetry fail closed;
- failure-state tests prove the exact completion/reconciler grants and atomic
  `AUTH_CALL_STARTED -> AUTH_FAILED_RETRYABLE`, `AUTH_FAILED_TERMINAL`, and
  `AUTH_OUTCOME_UNKNOWN` writers; deterministic failure, crash/timeout,
  zero/one/multiple-match reconciliation, retry cooldown, generation/attempt
  increment, new dual-capability issuance, stale/concurrent reconciliation,
  and concurrent retry all preserve one committed state and audit event;
- bounce/expiry tests prove the dedicated unconfirmed
  `invited -> tombstoned` exception, actor/AAL2 or owner authority, no accepted
  session/factor, version increment, registry-first audit, Auth soft-delete
  partial failure, and lock serialization against concurrent invitation
  acceptance. Every non-invited use is denied;
- lifecycle bootstrap cannot call or grant general protected-data mutations;
- only the exposed `api` schema is selectable for protected user-JWT RPCs;
  `private` remains absent from exposed/extra-search schemas. Exact
  schema-USAGE, wrapper EXECUTE, private-function revoke, default privilege,
  wrapper-specific owner isolation, schema-cache, and user-JWT
  positive/negative calls match section 10.1;
- each of the five Auth control-plane operations proves exact caller, target,
  environment, CSRF, rate, idempotency, registry-first revocation, audit, and
  partial-failure behavior; arbitrary Auth Admin API calls, browser imports,
  general-admin break-glass, and service-role use by Story 3/general data paths
  are denied;
- pinned-project integration proves exact
  `inviteUserByEmail`, `mfa.listFactors/deleteFactor`,
  `updateUserById(...ban_duration)`, `deleteUser(..., true)`, and
  `admin.signOut(targetJwt, "global")` behavior. It proves no target-sub-only
  global sign-out exists, never stores another user's JWT, distinguishes
  registry access-JWT denial from refresh-session destruction, and rejects
  undocumented Auth-schema/API fallback;
- global/local logout removes the expected `auth.sessions` row and the old
  otherwise-valid JWT is denied by direct `api` read and mutation wrapper
  calls. Tests also cover mismatched session owner, missing/null session claim,
  helper/grant bypass attempts, and exact migration privilege proofs. A
  read-vs-logout concurrency test pauses a bounded read after its
  `FOR KEY SHARE` lock, proves logout waits for read transaction completion,
  then proves that after logout returns the old JWT cannot start a successful
  direct read or mutation. The equivalent mutation-vs-logout test proves no
  old-JWT commit after logout returns;
- direct public Auth API factor unenroll followed by an old AAL2 JWT direct RPC
  is denied after the normative 60-second JWT-age boundary; the test records
  maximum exposure and the owner acceptance decision.

CSRF/origin:

- missing/malformed/expired/wrong token rejected;
- cookie/header mismatch rejected;
- wrong Origin, wildcard-like subdomain, `Sec-Fetch-Site: cross-site`,
  simple-form content type, and credentialed CORS rejected;
- exact allowed origin and valid signed token accepted;
- rotation after login/logout/session change;
- client-side URL injection negative tests.
- authenticated token is bound to the verified non-null session and current
  `authz_version`; another/null session, pre-auth token, or old
  login/refresh/MFA/version/logout token is denied;
- the 15-minute reusable-nonce policy is verified independently from mutation
  idempotency, including replay/state-conflict cases;
- missing Origin is denied with no Referer fallback;
- form, multipart, and text content types are denied; GET/HEAD/OPTIONS cannot
  mutate; Server Actions cannot expose v1 unsafe operations.

Operations:

- rate-limit boundary and reset behavior;
- idempotency remains independent of rate limiting;
- audit success/failure and redaction;
- no token, secret, email, provider payload, evidence text, or stack in rows,
  responses, logs, traces, or artifacts;
- clean full migration replay and schema comparison;
- invitation intent tests cover same-key replay, different-email conflict,
  duplicate open intent, no registry row before Auth success, verified returned
  sub, Auth deterministic failure, transport ambiguity, zero/one/multiple-user
  reconciliation, API-success/DB-failure replay, different-sub conflict,
  delivery bounce/expiry generation retry, concurrent completion, and crash at
  every boundary. State-machine tests cover pre-call capability expiry and
  safe rotation, `AUTH_CALL_STARTED`, Auth-success/pre-record DB failure,
  `AUTH_CREATED` commit/response loss, completion expiry/reissue, completion
  commit/response loss, exact terminal-result recovery, consumed nonce replay,
  stale capability version, bounded attempts, and raw-email absence from
  registry, audit, telemetry, logs, traces, errors, and artifacts;
- invite -> `pending_mfa` -> verified AAL2 -> active lifecycle, pending-MFA
  mutation denial, additional-admin authority, last-active-admin protection,
  factor reset/unenroll downgrade, reauthentication, session/factor/CSRF
  invalidation, and break-glass audit;
- audit allow/deny/rollback events, direct mutation denial, seven-year
  retention, backup/restore, redaction, allowlisted before/after metadata, and
  read/mutation behavior during each sink failure;
- the exact accepted Security Telemetry Sink Operations prerequisite proves
  append-only provider receipt, writer/reader isolation, event allowlist,
  correlation/idempotency, retry/backoff, duplicate conflict, backlog recovery,
  automatic protected-write freeze, retention/backup/restore, and strict
  Preview/Production separation; missing or unhealthy sink blocks activation
  and all Production mutations;
- every activation/lifecycle/Auth-intent/Story 3 mutation succeeds only with a
  READY, environment-matched, current-generation database lease. Tests cover
  missing row, FROZEN state, wrong environment, stale heartbeat, expired lease,
  forged/old generation, direct user-JWT wrapper RPC, service role, wrapper/
  function owner, monitor disconnection, immediate freeze, two-heartbeat
  recovery, backlog-not-drained recovery denial, and the maximum 30-second
  lease-failure boundary;
- maintenance cutover failure at every step leaves writes frozen, never
  restores broad policies, handles Auth Hook failure, and proves emergency
  write freeze and break-glass;
- distributed rate-limit key/normalization decision is required before IP is
  treated as authoritative; limiter failure behavior is tested;
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
4. Security Telemetry Sink Operations: exact provider, isolated writer/reader,
   queue/freeze, retention, backup, and recovery proof.
5. Auth Control Plane: five named server-only Auth Admin operations and no
   generic service-role client.
6. Route Security Migration: explicit public allowlist, protected reads,
   AAL2/CSRF mutations, user-JWT clients, negative tests.
7. Item Selection Story 3 persistence using the exact accepted subject, claim,
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
5. user-JWT RLS with service role limited to the five named server-only Auth
   control-plane operations and absent from Story 3/general data paths;
6. removal of broad anonymous/development policies before Production writes;
7. signed cookie-to-header CSRF, exact origins, and no credentialed CORS;
8. audit, rate limits, fail-closed behavior, and no secret/evidence leakage;
9. ordered high-risk/manual implementation Stories and Production runbook;
10. that no implementation begins merely because this Draft exists.
11. the explicit maximum 60-second exposure after direct public MFA unenroll;
12. the separate exact-provider Security Telemetry Sink Operations
    prerequisite and Production-write freeze until it is accepted and healthy.
13. exposed `api` wrapper-only PostgREST RPCs with all `private` objects hidden;
14. supported Auth API limits, including no target-sub-only global sign-out;
15. database-enforced telemetry lease with at most 30 seconds to freeze when
    the monitor cannot reach the database.
16. self-only AAL1 invitation acceptance and pre-sub encrypted invitation
    intent ordering;
17. `auth.sessions` row enforcement for every protected read/mutation so
    explicit logout immediately denies old JWT wrapper calls.
18. the narrow direct-Postgres LOGIN identities for server-only invitation
    prepare, completion, and reconciliation, their exact grants, secret
    isolation, and absence from browser/Data API/general Story 3 paths;
19. the purpose-separated marker/record/completion capability state machine,
    consumption and reissue rules, failure/ambiguity writers, and exact
    terminal-result recovery;
20. JavaScript-readable long-lived Supabase Auth cookies, the fact that cookie
    loss does not revoke a server session, and the maximum configured
    server-session exposure until explicit revocation or Auth time-box
    enforcement.

## 22. Authoritative references

- Supabase SSR client and verified claims:
  https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase SSR cookie/HttpOnly limitation:
  https://supabase.com/docs/guides/troubleshooting/how-do-i-make-the-cookies-httponly-vwweFx
- Supabase SSR advanced cookie lifetime guidance:
  https://supabase.com/docs/guides/auth/server-side/advanced-guide
- Supabase dedicated API schemas and explicit grants:
  https://supabase.com/docs/guides/api/securing-your-api
- Supabase database function privileges:
  https://supabase.com/docs/guides/database/functions
- Supabase Auth Admin sign-out (requires target JWT):
  https://supabase.com/docs/reference/javascript/auth-admin-signout
- Supabase sign-out/session semantics:
  https://supabase.com/docs/guides/auth/signout
- Supabase Auth sessions and documented `auth.sessions` old-JWT check:
  https://supabase.com/docs/guides/auth/sessions
- PostgreSQL locking-clause privilege requirements:
  https://www.postgresql.org/docs/current/sql-select.html
- Supabase Auth Admin invitation, update/ban, and deletion:
  https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
  https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
  https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
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
