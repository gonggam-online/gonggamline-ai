# Domeggook Live Search v1

## Status

- Status: approved by the repository-owner task directive
- Risk: normal-risk
- Owner: Supplier / Procurement
- Persistence: forbidden

## Objective

Expose one bounded, read-only Domeggook search vertical slice that uses the
existing Supplier Catalog port and adapter. A user can enter a keyword and see
live supplier results without creating or updating Products, financial data,
recommendations, orders, or inventory.

## Current-state evidence

- The provider-neutral `SupplierCatalog` port and Domeggook adapter already
  implement bounded `searchItems`.
- The existing `/api/domeggook-search` route bypasses the adapter and combines
  provider parsing, financial calculation, scoring, recommendations, and a
  Supabase upsert. It is not the v1 read-only boundary.
- The existing home screen consumes that legacy persistence flow.

## Scope

1. Add a dedicated thin Live Search GET endpoint.
2. Validate keyword, page, and page size before provider access.
3. Delegate only through `SupplierCatalogService`.
4. Map the provider-neutral result into a dedicated public response DTO.
5. Preserve sanitized typed errors and explicit HTTP status mapping.
6. Add a standalone search UI with loading, empty, unavailable, retry, and
   result states.
7. Add contract, no-write, and browser tests.

## Contract

Suggested endpoint:

`GET /api/integrations/domeggook/search?q=<keyword>&page=<n>&size=<n>`

Success:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 0,
    "hasNext": false
  },
  "meta": {
    "provider": "domeggook",
    "live": true
  }
}
```

The public item DTO may expose only supplier-catalog identity, title, image,
supplier price, minimum order quantity, availability, and source URL fields
that already exist in the provider-neutral contract. It must not expose the API
key, provider payloads, internal observations, stack traces, or invented data.

## Error and abuse controls

- Reject invalid input before configuration/network access.
- Preserve adapter bounds: keyword 1–100, page 1–10000, size 1–50.
- Keep the adapter timeout, retry, backoff, concurrency, and request controls.
- Map known errors into stable sanitized status/code responses.
- Never retry validation or authentication failures.
- Do not cache user-visible search results in a database.

## Explicit exclusions

- Supabase imports, queries, or writes.
- Product creation, review-state changes, or persistence.
- Margin, fee, logistics, return, Revenue Score, Ranking, or recommendation.
- Queue, scheduler, bulk crawling, or automatic pagination.
- Supplier order, Coupang listing, or any commerce write.
- Changing or deleting the legacy route in this Story.

## Compatibility

The legacy `/api/domeggook-search` contract remains unchanged. The new endpoint
and UI are additive. Legacy quarantine or migration requires a separate
compatibility Story.

## Tests

- Query validation and stable HTTP contract.
- Single, multiple, empty, and paginated results.
- Authentication, rate-limit, timeout, provider, and response-contract errors.
- Static and runtime proof that the route has no Supabase/database write path.
- UI keyboard submission, loading, empty, retry, and result rendering.
- Browser request inspection proves only the new read-only endpoint is used.

## Rollout and rollback

Roll out additively behind its own route and page. Rollback removes the new
route/page/tests; the existing adapter, health endpoint, and legacy flow remain
untouched. No data or provider rollback is required.

