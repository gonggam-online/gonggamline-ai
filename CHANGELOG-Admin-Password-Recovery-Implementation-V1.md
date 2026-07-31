# Admin Password Recovery implementation v1

## 2026-07-31

- Added an enumeration-safe administrator password-recovery request.
- Added the approved same-browser PKCE callback purpose and allowlist check.
- Added an authenticated recovery page and purpose-bound CSRF password update.
- Added global sign-out after password rotation so normal login and TOTP are
  required again.
- Kept Auth Admin API, MFA reset, database, RLS, and commerce writes out of
  scope.
