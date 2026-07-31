# Admin Password Recovery v1 changelog

## 2026-07-31

- Aligned the administrator recovery UI and verification route with the
  eight-digit OTP issued by the Production Supabase project while leaving
  six-digit TOTP verification unchanged.
- Proposed the minimum PKCE-based administrator password recovery lifecycle
  after the application proved unable to complete an owner-requested rotation.
- Kept implementation, redirect configuration, Production password changes,
  Auth Admin APIs, MFA reset, database/RLS, and commerce writes outside this
  architecture-only change.
