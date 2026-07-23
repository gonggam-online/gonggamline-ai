# Runtime reliability

## Failure classification

- Optional integration configuration that is absent is an expected degraded condition. List APIs return HTTP 200 with `success: true`, `available: false`, an empty collection, and `message: "No data available"`.
- Invalid request input returns HTTP 400. Invalid runtime state transitions return HTTP 409. Missing records return HTTP 404.
- Unexpected application defects remain HTTP 500 and are logged at error level.
- Network transport failures are unexpected defects. They are classified as DNS, connection, timeout, TLS, or generic fetch failures and are never downgraded to empty-data warnings.
- Only missing optional configuration produces the empty HTTP 200 fallback. Placeholder/invalid configuration and PostgREST table, schema, or authorization errors remain HTTP 500.
- Runtime logging redacts credential-like fields and truncates oversized values. Secrets, request authorization headers, and stack traces are not included in health responses.

## Root causes corrected

- Supabase previously created a client during module import and substituted a localhost URL when configuration was missing. Client construction is now lazy, configuration is typed and validated, and production rejects insecure or localhost URLs.
- The products route previously converted every exception into a successful empty response. Only known unavailable database conditions now degrade gracefully; unexpected route defects return HTTP 500.
- Runtime retries previously had an off-by-one attempt calculation. Attempts are now bounded, completion/failure updates verify lock ownership, and retry/cancel transitions are validated.

## Runtime health endpoint

`GET /api/health/runtime` always returns a safe application health document unless the handler itself cannot construct a response. Optional integrations produce `status: "degraded"` with HTTP 200.

Checks:

- `application`: `ok`
- `supabase`: `configured`, `unconfigured`, or `unreachable`
- `coupang`: `configured` or `unconfigured`
- `runtimeQueue`: `available` or `unavailable`

The Supabase probe has a three-second timeout and never returns URLs, keys, tokens, response bodies, or stack traces.

## Verification

Run:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Focused tests cover missing/malformed/valid Supabase configuration, product fallback, retry boundaries, duplicate-transition protection, and error redaction. Unreachable Supabase behavior is exercised by the bounded health probe in deployed environments.

Final local verification on 2026-07-23:

- ESLint: passed
- TypeScript (`tsc --noEmit`): passed
- Reliability tests: 6 passed
- Next.js production build: passed; `/api/health/runtime` emitted as a dynamic route

## Remaining work

- Apply the standardized availability envelope to older discovery, competition, decision, revenue, and Coupang list endpoints without breaking their frontend-specific fields.
- Add an atomic database claim function if concurrent worker volume grows beyond the current conditional-update guard.
- Add authenticated synthetic production checks for the runtime health endpoint and alert on sustained degradation.
