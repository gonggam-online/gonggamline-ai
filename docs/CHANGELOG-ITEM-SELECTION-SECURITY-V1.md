# Item Selection Security v1 changelog

## 2026-07-30

- Added immutable Item Selection run/evaluation persistence and audited RPCs
  in migration 021 without changing migrations 000-020.
- Added fail-closed Admin SSR Auth, UUID allowlist, fresh AAL2, purpose-bound
  CSRF, bounded rate limits, protected Route Handlers, and the sole
  service-role repository boundary.
- Added A01-A12 contract/import/database tests, an exact fingerprint,
  disposable 000-021 replay, CI integration, and Preview browser smoke.
- Delivery remains a high-risk Draft PR with manual merge required.
