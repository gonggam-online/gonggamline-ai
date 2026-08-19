# Market Intelligence collection v1

## Scope

This Story adds a bounded, read-only observation executor for the already
approved official/public source lanes. It does not change Item Selection's
operational verdict, create a queue or schedule, publish data, call a
marketplace write API, or authorize a paid provider.

The executor accepts a configured HTTPS endpoint via
`COUPANG_MARKET_DATA_ENDPOINT`. The endpoint contract is deliberately narrow:
`{ observations: MarketObservationInput[] }`. The server binds the source to
the selected adapter (`naver_official` or `coupang_public`), strips unknown
fields, limits a run to 50 observations, and persists the existing immutable
observation/analysis evidence flow.

## Safety contract

- Missing endpoint, malformed payload, non-HTTPS endpoint, 403, and 429 fail
  closed. There is no synthetic or stale-data fallback.
- A 403/429 is recorded as blocked/cooldown evidence in
  `market_collection_runs`; the job remains safe to retry after operator review.
- The collection route is owner-authenticated, exact-origin, CSRF-protected,
  and rate-limited. No client-side Secret is introduced.
- CI/Preview tests use an injected fake transport only. No live provider call is
  made by tests or browser smoke.
- The endpoint owner remains responsible for lawful source terms, rights,
  retention, freshness, and any provider Secret/configuration. This Story does
  not provision those values.

## Rollout and remaining approval

The code is manual-merge/high-risk because it can perform an external read and
write sanitized evidence to Supabase. Before Production activation, the owner
must approve the exact provider endpoint, terms/robots policy, retention and
cost ceiling, Secret/configuration placement, and the adapter's Production
enablement. Operational verdict integration remains a separate Story.
