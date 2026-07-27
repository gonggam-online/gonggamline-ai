# Domeggook Adapter Implementation v1 changelog

## 2026-07-27

- Implemented a provider-neutral Supplier Catalog port and Domeggook read-only
  infrastructure adapter.
- Added strict provider DTO parsing and dedicated provider-to-domain mapping.
- Added bounded `getItem` and `searchItems` operations with validation,
  four-second attempt timeout, two retries, exponential backoff, jitter, and
  sanitized error taxonomy.
- Added the network-free default Domeggook health endpoint and explicit,
  cached, size-one provider verification.
- Added sanitized structured observations and deterministic fake-transport,
  mapper, DTO, retry, error, health, and HTTP contract tests.
- Preserved existing Domeggook routes and Product/Revenue behavior.
- Added no database change, Migration, Queue, bulk collection, supplier write,
  Product write, Revenue calculation, or Coupang implementation.
