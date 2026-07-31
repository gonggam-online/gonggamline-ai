# Admin Password Recovery Prefetch Mitigation v1

## 2026-07-31

- Added a manually entered six-digit recovery-code verification route using
  Supabase `verifyOtp` with recovery type.
- Preserved exact-origin JSON, rate limiting, Auth-server user verification,
  the server-only administrator UUID allowlist, the existing recovery grant,
  global sign-out, and fresh login plus TOTP requirements.
- Documented the required Production Reset Password email template: include
  `{{ .Token }}` and omit clickable confirmation URLs.
- Kept the change high-risk/manual with no automatic merge or Production
  configuration before exact Preview validation and repository-owner review.
