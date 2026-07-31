# Admin TOTP Production validation

## Purpose and baseline

Validate the merged Admin TOTP boundary against Production without weakening
the accepted single-company administrator security model.

- Production application: `https://gonggamline-ai.vercel.app`
- Approved implementation PR: #57
- Production merge SHA: `c84ee5b750d640d775f8e1b8868f05606980994d`
- Risk: high-risk/manual because enrollment changes a real Production Auth
  factor.
- Recovery source of truth: Supabase Dashboard. Recovery codes, automatic MFA
  reset, Auth Admin API automation, and break-glass bypass are unsupported.

## 2026-07-31 evidence

- PR #57 exact-head CI, Vercel Preview, `preview-browser-e2e`, merge, and
  merge-SHA Production browser smoke passed.
- `/admin/login` rendered without observed console errors.
- Unauthenticated `GET /api/admin/auth/mfa/status` returned `401 Unauthorized`
  with `Cache-Control: no-store`.
- The owner approved removal of one unverified factor and fresh enrollment.
- Removal succeeded. Fresh enrollment returned `MFA enrollment failed.` A
  read-only status check then showed no TOTP factor.
- Production Dashboard showed TOTP enabled with a per-user factor limit of 10,
  excluding disabled enrollment as the root cause.
- Pinned `@supabase/auth-js` 2.110.7 prefixes returned SVG QR material with
  `data:image/svg+xml;utf-8,`. The merged server boundary accepted only raw
  `<svg`, so it rejected the real SDK contract before returning the one-time
  enrollment material.
- Production enrollment must not be retried until the compatibility fix passes
  review, exact-head gates, manual merge, and Production smoke.

## Owner interaction

The owner must personally sign in, scan the QR code, retain the secret in an
authenticator, and enter the six-digit code. Passwords, sessions, QR images,
TOTP secrets, one-time codes, factor IDs, user UUIDs, and project credentials
must never be placed in Codex, GitHub, logs, screenshots, or this runbook.

If a factor already exists, verify it instead of enrolling or removing another
factor. Removing a verified factor requires a separate explicit approval.

## Completion evidence

Record only:

- UTC timestamp and deployed merge SHA;
- whether factor status is `verified`;
- whether current assurance is `aal2`;
- page, console, and failed-request results without secret material.

Do not execute Product, marketplace, order, inventory, supplier, settlement,
payment, migration, RLS, or other business writes as validation.

## Recovery

If every verified authenticator is lost, access remains fail-closed:

1. Repository owner opens Supabase Dashboard and selects Production.
2. Navigate to **Authentication > Users** and select the intended
   administrator by verified account identity.
3. Inspect MFA factors and obtain explicit Production/Auth approval immediately
   before removing only the lost factor.
4. Return to Production, enroll a replacement, and verify AAL2 before any
   protected mutation.
