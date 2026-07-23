# Sprint 4 — Runtime Reliability

## Added

- Safe `GET /api/health/runtime` endpoint for application, Supabase, Coupang, and runtime queue status.
- Typed Supabase configuration validation with lazy client initialization.
- Structured runtime logger with recursive credential redaction.
- Runtime job transition, retry-boundary, and error-sanitization helpers.
- Focused executable reliability tests and `typecheck` / `test` npm scripts.

## Changed

- Product list fallback remains frontend-compatible for unavailable Supabase, while unexpected defects now return HTTP 500.
- Discovery list fallbacks now include the standard `data` envelope and preserve their frontend-specific collection fields.
- Runtime claims inspect attempt limits, use conditional status updates, and verify lock ownership at completion/failure.
- Retry and cancellation endpoints validate identifiers and return HTTP 400/404/409 where appropriate.
- Failed jobs now record terminal completion timestamps; retries clear stale locks and completion timestamps.

## Verification

Final command results are recorded in `docs/runtime-reliability.md` and the pull request.
