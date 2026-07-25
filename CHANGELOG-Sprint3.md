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

# Sprint 3 - Revenue Dashboard API

## Added

- Read-only `GET /api/dashboard/revenue`.
- Ranking-backed Product DTO with score, recommendation, confidence, reasons,
  status, and source analysis timestamp.
- Limit/offset pagination and recommendation/status/minimum-score filters.
- Strict HTTP 400 validation and a stable invalid-query error contract.
- Dedicated Query Service and DTO Mapper that hide Ranking internals.
- Response metadata, global rank preservation, and deterministic multi-key
  sorting.
- Deterministic Dashboard API unit and response-contract coverage.
- Preview API health coverage for the new endpoint.

## Unchanged

- Revenue Calculation, Revenue Score, and Revenue Ranking algorithms.
- Database schema, migrations, Runtime Queue, Workers, and Production data.
- Marketplace, pricing, order, inventory, fulfillment, and settlement writes.
- OpenAI and LLM behavior.
