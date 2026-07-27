# Architecture Story: Domeggook Read-only Supplier Catalog Adapter v1

## 1. Identity and decision status

- Story type: Architecture Story
- Owner directive: AI CTO directive supplied by the repository owner
- Status: approved for the separately scoped implementation Story
- Approval date: 2026-07-27
- Risk: normal-risk, documentation-only
- Business objective: establish the smallest reliable, read-only Domeggook
  supplier-catalog boundary needed before first-product discovery.
- Revenue impact: P1 enabling work. It removes an unverified sourcing boundary
  without introducing ordering, marketplace writes, or financial decisions.

This Story approves architecture only. It does not implement an adapter, modify
a route, call Domeggook, persist a Product, change a database, or create a
Migration.

## 2. Compliance

### AI CTO Compliance Check

- CTO Master Directive: PASS. Architecture and domain boundaries precede code.
- Project Constitution: PASS. Provider data, domain results, and public DTOs
  receive separate sources of truth.
- Architecture Blueprint: PASS. The dependency direction remains route ->
  application service -> domain contract + infrastructure adapter.
- Risk Policy: PASS. This change is documentation-only and touches no secret,
  schema, financial calculation, or external write.

### Architecture Compliance Check

- Approved owning domain: Supplier Catalog within the existing
  Supplier/Procurement domain.
- New boundary: `Domeggook Supplier Catalog Adapter`, an External Integration.
- New Public API: the safe health contract defined in section 11.
- Database, Migration, Queue, and new lifecycle: none.
- Result: PASS. This document is the required Architecture Story and its
  approval is recorded in
  [Architecture Review](../../.ai/ARCHITECTURE_REVIEW.md) and
  [Decision Log](../../.ai/DECISION_LOG.md).

## 3. Current-state evidence

The current routes
[`app/api/domeggook-test/route.ts`](../../app/api/domeggook-test/route.ts) and
[`app/api/domeggook-search/route.ts`](../../app/api/domeggook-search/route.ts)
read `DOMEGGOOK_API_KEY` and call Domeggook directly.

The search route also parses provider data, calculates estimated commerce
economics, ranks candidates, and calls Product persistence. This prevents the
provider call from being reused as a safe read-only boundary. There is no
dedicated Domeggook client, provider DTO family, mapper, error taxonomy,
rate-limit policy, or focused adapter contract test.

The architecture audit confirmed that Production's existing read-only test
returned HTTP 500, but it could not safely distinguish configuration,
authentication, and provider failure. The implementation Story must correct
that observability gap without converting errors into success.

## 4. Boundary and responsibilities

### Owned boundary

`Domeggook Supplier Catalog Adapter`

The adapter owns:

- server-only credential loading and configuration classification;
- Domeggook read-only request construction;
- request timeout and bounded retry;
- provider response parsing and contract validation;
- provider DTO to Supplier Catalog domain-result mapping;
- sanitized error classification;
- latency, outcome, retry-count, and correlation observability.

The adapter does not own:

- margin, fee, advertising, logistics, return-reserve, or revenue calculation;
- Revenue Score, ranking, recommendation, or Product selection;
- Supabase writes, caching, or Product persistence;
- listing/content generation;
- Coupang registration;
- supplier ordering or other external writes.

## 5. Layer placement and dependency direction

```text
UI
  -> existing/new route (validation and public serialization only)
    -> Supplier Catalog application service
      -> Supplier Catalog domain port and result types
        <- Domeggook infrastructure adapter
          -> Domeggook HTTPS API
```

The implementation Story uses these intended locations:

| Layer | Intended location | Responsibility |
|---|---|---|
| Public HTTP | `app/api/**/route.ts` | validate, delegate once, map error/status |
| Application | `services/supplier-catalog.service.ts` | execute one catalog use case |
| Domain contract | `shared/domain/supplier-catalog.ts` | provider-neutral port/results |
| Infrastructure | `lib/domeggook/client.ts` | credential, transport, timeout/retry |
| Provider DTO | `lib/domeggook/dto.ts` | untrusted provider response shapes |
| Mapper | `lib/domeggook/mapper.ts` | provider DTO -> domain result |

Routes must not assemble credentials or provider URLs, parse provider DTOs,
calculate financial values, persist results, or expose provider raw errors.
The domain contract must not import Next.js, Supabase, Product, Revenue, or
Domeggook-specific DTOs.

## 6. Approved read-only operations

### `getItem(itemNo)`

- Input: `itemNo: string`.
- Validation: trim; required; ASCII digits only; 1-20 characters.
- Provider operation: `getItemViewES`.
- Output: `SupplierCatalogItem`.
- Missing item: a successful typed `not_found` result, not an empty fabricated
  item and not a transport failure.
- Default: none. Callers must provide an item number.
- Provider calls per application request: one, excluding an eligible retry.

### `searchItems(keyword, page, size)`

- Input:
  - `keyword: string`, trimmed, required, 2-100 Unicode characters;
  - `page: integer`, default `1`, range `1..1000`;
  - `size: integer`, default `20`, range `1..50`.
- Provider operation: `getItemList`, Dome market only.
- Output: `SupplierCatalogSearchResult`.
- Empty result: success with `items: []`; never treated as provider failure.
- Pagination: map the requested page/size and provider total when valid. Do not
  automatically fetch another page.
- Provider calls per application request: one, excluding an eligible retry.

Invalid inputs fail before credential access or network activity.

## 7. DTO and domain mapping

The provider DTO family is:

- `DomeggookItemListProviderDto`
- `DomeggookItemDetailProviderDto`
- `DomeggookProviderErrorDto`

Provider DTO fields are optional/unknown until runtime contract validation.
They must never extend, alias, or be returned as Product, a database entity, a
Revenue Calculation input, or a public response.

The provider-neutral domain results are:

```ts
type SupplierCatalogItem = {
  provider: "domeggook";
  providerItemId: string;
  name: string | null;
  supplierPriceKrw: number | null;
  shippingFeeKrw: number | null;
  minimumOrderQuantity: number | null;
  stockStatus: "in_stock" | "out_of_stock" | "unknown";
  thumbnailUrl: string | null;
  productUrl: string | null;
  supplierId: string | null;
  supplierName: string | null;
  availableOnDomeggook: boolean | null;
  supplyAvailable: boolean | null;
};

type SupplierCatalogSearchResult = {
  provider: "domeggook";
  items: SupplierCatalogItem[];
  pagination: {
    page: number;
    size: number;
    totalItems: number | null;
    hasNextPage: boolean | null;
  };
};
```

Null means the provider did not supply a usable value. Zero is preserved only
when the provider contract permits a measured zero. Parsing a negative,
non-finite, or structurally invalid numeric value produces
`RESPONSE_CONTRACT_ERROR`; it is not silently clamped or guessed.

The mapper performs representation conversion only. It does not calculate
sale price, margin, fees, profit, score, rank, or recommendation.

## 8. Configuration contract

The only v1 credential variable is:

- `DOMEGGOOK_API_KEY`

Allowed internal configuration states:

- `configured`
- `missing`
- `invalid`
- `upstream_authentication_failed`
- `cannot_verify`

`configured` means a nonblank server-only value is available. It does not claim
provider authentication. `upstream_authentication_failed` requires a provider
response classified as authentication failure. `cannot_verify` is used when no
safe provider verification was performed or the result is indeterminate.

The application must never log or return the secret value, length, prefix,
suffix, hash, query string containing it, or an authorization-equivalent field.
The variable must never use a `NEXT_PUBLIC_` prefix.

Environment responsibility:

- Local: developer-owned `.env.local`, ignored by Git.
- Preview/Production: owner-managed Vercel environment variable, scoped
  separately by environment.
- CI: real credentials are not required. Tests use a fake adapter or mocked
  transport. CI must fail if a test unexpectedly attempts an actual provider
  call.

## 9. Error taxonomy and public mapping

| Error code | Meaning | Retry | Public HTTP |
|---|---|---:|---:|
| `CONFIGURATION_MISSING` | server credential absent | no | 503 |
| `AUTHENTICATION_FAILED` | provider rejected authentication | no | 502 |
| `VALIDATION_FAILED` | caller input invalid | no | 400 |
| `RATE_LIMITED` | provider returned rate-limit response | conditional | 429 |
| `TIMEOUT` | request/overall budget expired | conditional | 504 |
| `NETWORK_ERROR` | transient transport/DNS/TLS failure | conditional | 503 |
| `PROVIDER_ERROR` | other provider HTTP/service failure | conditional | 502 |
| `RESPONSE_CONTRACT_ERROR` | successful response violates DTO contract | no | 502 |

Public errors have this stable sanitized shape:

```json
{
  "ok": false,
  "error": {
    "code": "CONFIGURATION_MISSING",
    "message": "Domeggook integration is unavailable.",
    "retryable": false,
    "correlationId": "opaque-id"
  }
}
```

Provider response bodies, raw URLs/query strings, credentials, stack traces,
and parser details are never public. Internal logs may retain only the
sanitized taxonomy and approved observability fields.

## 10. Timeout, retry, and rate-limit policy

### Time budget

- Per-attempt timeout: 4 seconds.
- Maximum retries: 2, for at most 3 total attempts.
- Overall operation budget: 10 seconds including backoff and parsing.
- A retry starts only when enough overall budget remains.

### Eligible retries

- transient `NETWORK_ERROR`;
- `TIMEOUT` while overall budget remains;
- provider HTTP 502, 503, or 504;
- `RATE_LIMITED` only when a valid `Retry-After` fits within the remaining
  overall budget.

Never retry:

- `CONFIGURATION_MISSING`;
- `AUTHENTICATION_FAILED`;
- `VALIDATION_FAILED`;
- `RESPONSE_CONTRACT_ERROR`;
- other provider 4xx responses.

Backoff is exponential at 200 ms then 400 ms with up to 25% jitter. A valid
`Retry-After` replaces that delay but is capped at 2 seconds. The adapter never
performs an unbounded retry or automatic pagination.

### Conservative v1 rate controls

Official quota is not established by repository evidence and must not be
invented. Until authoritative quota evidence is approved:

- search size is capped at 50;
- one operation is allowed per application request;
- automatic page traversal and bulk collection are forbidden;
- adapter concurrency is capped at 4 per runtime instance;
- the health route caches its sanitized result for 60 seconds per runtime
  instance and permits at most one provider probe in that window;
- a provider 429 is surfaced as `RATE_LIMITED` after at most one eligible retry.

These controls are safety ceilings, not claims about provider quota. A later
decision must record authoritative quota, response headers, and operational
limits before increasing them.

## 11. Safe health-check contract

Approved route:

`GET /api/integrations/domeggook/health`

The route performs no DB access, financial calculation, persistence, Product
selection, or external write.

Default behavior is a configuration-only check and makes no provider request:

```json
{
  "ok": true,
  "provider": "domeggook",
  "configuration": "configured",
  "authentication": "cannot_verify",
  "reachable": "cannot_verify",
  "checkedAt": "ISO-8601"
}
```

When `verify=provider` is explicitly supplied, the service may execute one
minimal `searchItems` probe with an implementation-owned benign keyword,
`page=1`, and `size=1`. A structurally valid empty result still proves that the
authenticated provider contract was reached. The response exposes only:

- `ok`;
- provider;
- configuration state;
- authentication state;
- reachability state;
- sanitized error code when applicable;
- checked timestamp.

It never returns the probe keyword, provider item, raw payload, URL, credential
detail, or latency trace. Provider verification uses the 60-second cache and
rate controls above.

Automated CI and generic route E2E use the default configuration-only mode.
Exact Preview may run `verify=provider` only when the credential is configured
and an explicitly enabled read-only smoke job is present. A missing optional
Preview credential skips the provider probe with an observable `cannot_verify`
result; authentication, contract, or code failures must fail that focused
smoke. Generic deployment health remains independent so an optional provider
cannot block the entire application deployment.

The existing `/api/domeggook-test` is not silently repurposed. Its compatibility
and deprecation treatment must be explicit in the implementation PR. Existing
public response contracts remain unchanged unless separately authorized.

## 12. Persistence and Queue decisions

### Persistence

The v1 adapter is database-independent. `getItem`, `searchItems`, and health
never write to Supabase and require no table or Migration.

Saving selected search results belongs to a separate application use case and
is not an adapter responsibility. Any new cache, catalog table, audit table, or
schema change requires a separate high-risk Architecture Story and manual
approval.

### Queue

Single-item lookup and bounded search are synchronous and require no Queue.
Bulk collection, scheduling, periodic synchronization, or reprocessing are
excluded. Adding any such lifecycle requires a separate Architecture Story
under [Queue Policy](../../.ai/QUEUE_POLICY.md).

## 13. Security and observability

Approved structured observation fields:

- `provider`;
- `operation`;
- `success`;
- `statusClass`;
- `latencyMs`;
- `retryCount`;
- `errorCode`;
- `correlationId`.

Forbidden log fields:

- API key or any derivative/partial representation;
- complete provider URL or query string;
- provider raw payload or raw error;
- authorization-equivalent data;
- complete product description;
- personal, order, or customer information.

Correlation IDs are opaque, generated per application operation, and safe to
return. Logs use existing centralized redaction and never downgrade an
unexpected failure to success.

## 14. Testing strategy for the implementation Story

All default tests run without a real credential through a fake adapter or
mocked transport. Required deterministic coverage:

- configuration missing;
- successful item detail;
- successful item search;
- empty search result;
- invalid item number, keyword, page, and size;
- invalid provider response;
- authentication failure;
- HTTP 429 with valid/invalid `Retry-After`;
- timeout and exhausted overall budget;
- network failure;
- bounded retry count and backoff decisions;
- pagination mapping;
- provider DTO to domain mapping and nullability;
- secret/query-string redaction;
- default and provider-verifying health contracts;
- proof that adapter and health perform no DB write;
- preservation of Revenue Calculation and Product public contracts.

Preview provider smoke is opt-in and read-only. It performs at most one
size-one probe and never runs when credentials are absent. Production
verification uses the same safe contract and never invokes Product
persistence.

## 15. Rollout and rollback

Rollout order for the later implementation:

1. land domain port, provider DTOs, mapper, fake transport, and tests;
2. land the infrastructure client and application service behind tests;
3. add the safe default health contract;
4. delegate existing Domeggook routes while preserving their contracts;
5. enable an explicitly configured provider-verification smoke;
6. validate exact Preview before Production.

Rollback reverts the implementation PR and removes the new health route.
Because v1 has no database state, migration, Queue, or write, there is no data
rollback.

## 16. Alternatives considered

- Keep provider access inside routes: rejected because it mixes transport,
  mapping, calculations, and persistence.
- Use the existing search route as health: rejected because it writes to
  Supabase and calculates financial outcomes.
- Add a catalog cache/table now: rejected because first-product discovery does
  not require persistence and a schema change would be high-risk.
- Add a Queue now: rejected because two bounded read operations are synchronous.
- Put Product fields directly in provider DTOs: rejected because it couples an
  external contract to Product, Revenue, and persistence.

## 17. Implementation Story definition

Story name:

**Implement Domeggook Read-only Supplier Catalog Adapter v1**

Definition of Done:

- strict typed external adapter and provider-neutral domain port implemented;
- provider DTOs, mapper, and domain results remain separate;
- `getItem` and `searchItems` satisfy the approved validation/pagination
  contracts;
- server-only configuration states are safe and observable;
- health default is network-free and provider verification is explicit,
  size-one, cached, and read-only;
- timeout, overall budget, bounded retry, jitter, and rate-limit behavior match
  this decision;
- public errors use the sanitized taxonomy;
- existing Revenue Calculation logic is untouched;
- existing Product API contract remains behavior-equivalent;
- existing Domeggook public contract compatibility is explicit and tested;
- unit/contract tests above pass without real credentials;
- lint, typecheck, full tests, and production build pass;
- exact Preview read-only smoke passes when enabled;
- no DB change, Migration, Queue, bulk collection, supplier order, Product
  modification, deletion, content generation, or Coupang registration occurs.

Implementation Story exclusions:

- Coupang registration;
- listing/detail-page generation;
- bulk Product collection or scheduler;
- Queue or new lifecycle;
- new database table or Migration;
- Revenue Engine work.

Architecture approval authorizes only this bounded implementation Story. It
does not authorize credentials to be changed, Production writes, or follow-on
features.
