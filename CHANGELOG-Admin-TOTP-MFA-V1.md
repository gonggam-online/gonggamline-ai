# Admin TOTP MFA v1 changelog

## 2026-07-31

- Started the owner-approved high-risk implementation Story for administrator
  TOTP enrollment, AAL2 verification, and fail-closed manual recovery.
- Kept Supabase Auth as the identity and factor source of truth.
- Explicitly excluded recovery codes, automatic MFA reset, Auth Admin APIs,
  database changes, Production deployment, and merge.
- Added strict factor/status/enrollment contracts, server-owned status,
  enrollment, challenge, verification, and self-unenrollment routes.
- Replaced manual factor-ID entry with a factor-aware administrator UI,
  one-time QR/manual secret presentation, and fail-closed owner recovery
  guidance.
- Corrected Production enrollment compatibility with the pinned Supabase Auth
  SDK, which prefixes returned SVG QR material with
  `data:image/svg+xml;utf-8,`; the boundary now accepts that exact trusted
  prefix while retaining raw-SVG compatibility and rejecting other formats.
