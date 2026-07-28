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
| absent -> `invited` | repository owner through the environment-specific bootstrap runbook, or an active AAL2 admin after bootstrap | owner out-of-band approval or AAL2 | invitation-only Auth user exists; exact environment and `sub` verified | `invited` | revoke any pre-existing sessions | initialize at 1 | `ADMIN_INVITED`; conflict is 409 |
| `invited` -> `pending_mfa` | invited subject | AAL1 | invitation accepted and verified `sub` matches | `pending_mfa` | retain only the enrollment session | increment | `ADMIN_INVITE_ACCEPTED`; invalid invitation is 401 |
| `pending_mfa` -> `active` | same subject | freshly verified AAL2 | TOTP factor enrolled and challenged successfully | `active` | rotate/refresh the session and CSRF token | increment | `ADMIN_ACTIVATED`; missing AAL2 is 403 `MFA_REQUIRED` |
| `active` -> `suspended` | another active AAL2 admin, or repository-owner break-glass runbook | AAL2 or owner out-of-band | target is not the last active admin | `suspended` | revoke all target sessions and CSRF tokens | increment | `ADMIN_SUSPENDED`; last-admin attempt is 409 |
| `suspended` -> `invited` | active AAL2 admin or repository owner | AAL2 or owner out-of-band | recovery/re-invitation approved | `invited` | revoke all target sessions and factors | increment | `ADMIN_REINVITED`; invalid state is 409 |
| non-tombstoned -> `tombstoned` | another active AAL2 admin or repository owner | AAL2 or owner out-of-band | target suspended; not last active admin; retention check passed | `tombstoned` | revoke all sessions/factors | increment | `ADMIN_TOMBSTONED`; invalid state is 409 |

An administrator cannot activate, suspend, tombstone, or reset the factor of
another administrator solely through UI state. Every transition is a reviewed
transaction/RPC that locks the target registry row and counts active
administrators before commit. Self-suspension is allowed only when another
active administrator remains. Self-tombstoning and self-factor-reset are
forbidden. Email changes do not change the principal because `sub` is the only
identity key.

The `pending_mfa` activation bootstrap is the single exception to the normal
active-administrator function precondition. The dedicated
`private.activate_pending_admin_v1()` `SECURITY DEFINER` RPC:

- accepts no target subject, role, status, or arbitrary payload; the target is
  always the verified `auth.uid()` of the caller;
- has EXECUTE granted to `authenticated` only, with EXECUTE revoked from
  `PUBLIC`, `anon`, `service_role`, and every other login role; its dedicated
  owner is `NOLOGIN`, is not a runtime principal, and retains no membership
  grant to an application role;
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

TOTP and recovery contract:

1. An invited subject signs in at AAL1, enters `pending_mfa`, enrolls one TOTP
   factor, verifies a challenge, refreshes the session, and proves the new JWT
   is AAL2 before activation.
2. A normal factor unenroll/re-enroll is allowed only for the same active
   administrator already at AAL2. It increments `authz_version`, revokes all
   existing access/refresh sessions and CSRF tokens, downgrades the registry to
   `pending_mfa`, and requires a fresh TOTP challenge before mutation resumes.
3. Resetting another administrator's factor is allowed only to another active
   AAL2 administrator, never to the target alone, and produces the same
   suspension, version increment, session/factor revocation, and re-invitation
   sequence.
4. V1 does not support application recovery codes. No recovery code is
   generated, stored, displayed, or accepted.
5. Single-administrator lockout uses no application endpoint. The repository
   owner executes an approved environment-specific break-glass runbook that
   records approver, command identifier, target project, and exact `sub`;
   revokes all factors and sessions; increments `authz_version`; places the
   subject in `pending_mfa`; and blocks mutation until a new TOTP factor and
   AAL2 JWT are verified. Preview and Production runbooks and subjects are
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
- non-null, valid Supabase `session_id` for every mutation;
- registry row with the same subject, active status, admin role, and identical
  version.

Database RLS calls `private.is_active_admin()`, which applies the same checks
using `auth.uid()`, `auth.jwt()`, and the registry. The helper is
`SECURITY DEFINER`, has a fixed empty `search_path`, contains no dynamic SQL,
and is executable only by `authenticated`.

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
3. Revoke the affected Supabase refresh sessions/factors as required. Failure
   to clean them up never restores authorization because the registry mismatch
   remains authoritative and fail-closed.
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
  sessionId: string | null;
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
  rotation and reuse detection are enabled. Auth cookies omit
  `Max-Age`/`Expires` and remain browser session cookies; cookie persistence is
  storage behavior, not an authorization or server-session lifetime. Supabase
  Auth's server-side session record,
  inactivity/absolute limits, verification, and revocation are authoritative.
  A server session orphaned after local-cookie loss cannot authenticate without
  its tokens and expires by those server limits; if its session/subject is
  known, logout/account recovery explicitly revokes it. It cannot be
  reconstructed from unverified client state.
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
- `authenticated` receives SELECT only where listed below and no direct
  INSERT, UPDATE, or DELETE on protected tables;
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
| authenticated non-admin | deny | deny | only `activate_pending_admin_v1` when the caller's own row is `pending_mfa`; otherwise deny | exact section 6 bootstrap predicate, never general mutation |
| revoked/stale admin | deny | deny | deny | status/version mismatch fails |
| active AAL1 admin | allow only for object rows listed as readable | deny | read-only RPC only | verified admin/version; AAL1 |
| active AAL2 admin | allow only for object rows listed as readable | deny | only named mutation RPCs | verified admin/version/session; AAL2 |
| `service_role` | no application data access | prohibited in normal/data paths | no database RPC; server-only Auth Admin API allowlist in section 11.1 only | secret absent from browser, Story 3, SSR, and general data runtime |
| background worker/service principal | deny | deny | deny | unsupported in v1 |

Protected-object matrix:

| Object | Direct SELECT | Direct DML | Allowed AAL2 RPC | `USING` / `WITH CHECK` and immutability |
|---|---|---|---|---|
| `private.admin_principals` | none through Data API | none | `activate_pending_admin_v1` bootstrap plus individually reviewed invite, suspend, factor-reset, tombstone functions | private schema; bootstrap is self-only; other RPCs require active AAL2; locks rows and protects last active admin |
| `item_selection_runs` | active admin AAL1/AAL2 | none | `create_item_selection_run_v1`, `finalize_item_selection_run_v1` | SELECT `USING private.is_active_admin()`; no INSERT/UPDATE/DELETE policy; terminal rows immutable; retry creates a new run |
| `item_selection_evaluations` | active admin AAL1/AAL2 | none | inserted only inside `finalize_item_selection_run_v1` | SELECT `USING private.is_active_admin()`; no INSERT/UPDATE/DELETE policy; finalized rows append-only |
| run retry/lineage fields | through authorized run SELECT | none | set only by run-create RPC | remains run-level metadata; cannot alter candidate hashes |
| canonical snapshot/evidence text and JSONB projections | through authorized evaluation SELECT with DTO redaction | none | inserted only by finalization RPC | columns of immutable evaluations, not separate mutable resources; PR #38 authority unchanged |
| decision result, stage/decision hashes, run/persistence envelope | through authorized run/evaluation SELECT | none | inserted/finalized only by finalization RPC | UPDATE/DELETE denied; PR #38 hash boundaries unchanged |
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

## 11. Database functions and service-role boundary

Normal browser-originated application requests use the verified user's access
token so RLS remains effective.

A `SECURITY DEFINER` function is the only v1 database mutation boundary and is
allowed only for named lifecycle and Item Selection transaction use cases.
Every general protected-data or administrator-management function requires an
active administrator. The sole lifecycle-bootstrap exception is
`private.activate_pending_admin_v1()`, whose narrower caller, state, subject,
fresh-AAL2, session, grant, output, and audit contract is fixed in section 6.
Each function must:

- be named and reviewed individually;
- be owned by a dedicated non-login, non-superuser role without `BYPASSRLS`;
  the owner receives only required schema/object privileges;
- set an empty/fixed `search_path`;
- schema-qualify every object;
- validate `private.is_active_admin()` inside the function, except that the
  activation bootstrap validates its complete section 6 predicate instead;
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
because Auth invitations, global session revocation, cross-user factor
administration, break-glass recovery, and Auth-user disable/delete cannot use
user-JWT database RLS. Its allowlist is exhaustive:

1. invite an additional administrator Auth user;
2. revoke every session/refresh token for an exact target subject;
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
call. It binds the idempotency record to the normalized, server-validated target
email and exact environment, then verifies the returned Auth user UUID and
stores that UUID as the registry `sub`; the email remains secret telemetry and
is never placed in the registry/audit event. Every later operation requires
that exact stored target `sub`.

Revocation order is registry-first: lock the target, move it to the approved
fail-closed state and increment `authz_version`, commit its audit intent, then
call the exact Auth Admin operation. Auth-side failure leaves the registry
revoked, records a retryable partial-failure event with the same
correlation/idempotency key, and queues bounded retry; it never restores active
state. Repeating the same key returns the stored operation/result; changing
operation, target, or environment conflicts. Invitation creates the registry
`invited` intent before sending Auth invitation; delivery failure leaves a
non-active retryable record. Disable/delete requires pre-existing
suspended/tombstoned state and never deletes registry or audit history.

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
- cookie expiry cannot authorize or extend a server session; lost/expired
  cookies with an orphaned server session trigger server-side revocation;
  logout removes every current and obsolete chunk suffix and repeated logout
  is safe;
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
- positive admin SELECT/INSERT/UPDATE/RPC cases only where mapped;
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
- lifecycle bootstrap cannot call or grant general protected-data mutations;
- each of the five Auth control-plane operations proves exact caller, target,
  environment, CSRF, rate, idempotency, registry-first revocation, audit, and
  partial-failure behavior; arbitrary Auth Admin API calls, browser imports,
  general-admin break-glass, and service-role use by Story 3/general data paths
  are denied;
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

## 22. Authoritative references

- Supabase SSR client and verified claims:
  https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase SSR cookie/HttpOnly limitation:
  https://supabase.com/docs/guides/troubleshooting/how-do-i-make-the-cookies-httponly-vwweFx
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
