# Admin Password Recovery v1

## Status

Proposed. Repository-owner architecture approval and manual merge are required
before implementation.

## Problem and objective

The Production administrator password must be rotated after credential
exposure. Supabase can send a recovery email, but the current application has
no password recovery lifecycle. A Dashboard-generated implicit-flow link
redirected to the site root with session material in the URL fragment, where no
password-update UI exists.

The objective is the smallest fail-closed recovery path that lets the
allowlisted administrator rotate a password without exposing provider tokens,
adding Auth Admin API access, or weakening AAL2 business-operation controls.

## Owner, boundary, and non-goals

- Owner: repository owner / Production Auth owner.
- Boundary: existing Admin Auth Route Handlers and Supabase SSR client.
- Non-goals: signup, invitations, general account management, administrator
  lifecycle automation, recovery codes, automatic MFA reset, service-role Auth
  Admin APIs, database/RLS changes, social login, phone MFA, or commerce writes.

## Current-state evidence

- `/api/admin/auth/callback` exchanges exactly one PKCE `code` and always
  redirects to `/admin/login`.
- No route calls `resetPasswordForEmail` or `updateUser({ password })`.
- The server-only administrator UUID allowlist remains authoritative.
- Supabase defines recovery as an email request followed by a password update
  for the authenticated recovery session.
- The incident proved that the default Site URL and an implicit URL fragment
  are insufficient for this SSR application.

## Decision proposal

Use a same-browser PKCE flow inside the existing Admin Auth boundary:

```text
Admin login page
  -> exact-origin JSON reset-request route
    -> Supabase resetPasswordForEmail()
      -> exact allowlisted recovery callback
        -> exchangeCodeForSession()
          -> allowlisted recovery page
            -> exact-origin JSON + recovery CSRF password update
              -> Supabase updateUser({ password })
                -> global sign-out + cookie clearing
                  -> ordinary login + TOTP verification
```

The reset-request endpoint returns the same accepted response for every
syntactically valid email, is IP-rate-limited, and never logs email or provider
errors.

The callback accepts a fixed `purpose=password-recovery` value. Purpose only
selects the post-exchange destination; it grants no authorization. The recovery
page and update route verify the user with the Auth server and require the
existing UUID allowlist.

The update route:

- accepts only exact-origin JSON and purpose-bound CSRF;
- requires a verified allowlisted AAL1 recovery session;
- accepts only `password` and `confirmation`;
- rejects empty, mismatched, or excessively long values;
- delegates strength policy to Supabase and sanitizes provider errors;
- on success signs out globally, clears Auth/CSRF cookies, and requires a fresh
  ordinary login and TOTP verification.

Recovery never grants AAL2. Protected business mutations remain blocked.

## External configuration dependency

Supabase Dashboard > Authentication > URL Configuration must contain only the
exact Preview/Production recovery callback URLs. Preserve the Site URL and
unrelated redirects. This is a separate high-risk Auth configuration approval;
code must not compensate for a missing allowlist.

## Public contracts

`POST /api/admin/auth/password/reset-request`

- request: `{ "email": string }`
- success: `202 { "accepted": true }`
- invalid/rate/unexpected failures: existing sanitized error envelopes

`POST /api/admin/auth/password/update`

- request: `{ "password": string, "confirmation": string }`
- success: `200 { "updated": true, "reauthenticationRequired": true }`
- unauthenticated/non-admin/CSRF/provider failures: fail closed with sanitized
  codes

No contract exposes session or identity material.

## Failure, security, and observability

- Missing, invalid, expired, reused, or wrong-browser PKCE code fails closed.
- Non-allowlisted recovered users are denied and signed out.
- Missing redirect configuration stops as an external configuration failure.
- Provider password-policy errors return safe guidance only.
- Record route, outcome class, timestamp, and deployment reference only.
- Never record email, password, request body, URL query/fragment, cookie,
  provider payload, token, factor ID, QR material, or administrator UUID.

## Tests and acceptance

1. Reset request is exact-origin, JSON-only, rate-limited, and enumeration-safe.
2. Redirect target and callback purpose are fixed.
3. Invalid, expired, reused, and wrong-browser codes fail closed.
4. Recovery identity uses Auth-server `getUser` and the UUID allowlist.
5. Unexpected fields and password mismatch are rejected.
6. Provider errors are sanitized and secret material is never logged.
7. Success updates once, signs out, clears cookies, and requires normal login.
8. Recovery AAL1 cannot execute an AAL2-protected mutation.
9. Local/Preview uses synthetic users only; no real password changes.
10. Lint, typecheck, tests, build, exact Preview, and browser gates pass.
11. Production completion is owner-performed and sanitized.

## Rollout and rollback

1. Manually approve and merge this Architecture Story.
2. Implement in a separate high-risk Draft PR with
   `manual-merge-required`.
3. Validate with synthetic Local/Preview identities.
4. Separately approve exact redirect configuration.
5. Manually merge, wait for exact Production, and run read-only smoke.
6. Owner requests a new recovery email, rotates the password, logs in normally,
   and verifies TOTP.

Rollback removes the recovery routes/page/callback purpose and their exact
redirect entries. Existing users, factors, database state, and audit history
remain unchanged.

