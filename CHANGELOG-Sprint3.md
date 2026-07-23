# Sprint 3 - Runtime Stabilization

## Fixed

- Kept API route modules loadable when Supabase environment variables are absent.
- Converted internal API transport failures and non-JSON error responses into a
  graceful `No data available` state.
- Sanitized low-level network, `TypeError`, and recommendation-generation errors
  before they can be shown to users.
- Added explicit optional provider variables to `.env.local.example`.
- Preserved successful API responses and the existing UI.
- Stabilized `GET /api/products` by calling the product query service directly
  and returning HTTP 200 with an empty list when Supabase is unconfigured or
  temporarily unavailable.
- Moved the products service and Supabase client behind handler-time dynamic
  imports so route module initialization cannot bypass the HTTP 200 fallback.
- Logged expected Supabase availability fallbacks as warnings so successful
  HTTP 200 fallback responses are not classified as runtime errors.
