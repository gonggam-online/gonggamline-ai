# Admin Password Recovery v1 changelog

## 2026-07-31

- Proposed the minimum PKCE-based administrator password recovery lifecycle
  after the application proved unable to complete an owner-requested rotation.
- Kept implementation, redirect configuration, Production password changes,
  Auth Admin APIs, MFA reset, database/RLS, and commerce writes outside this
  architecture-only change.
