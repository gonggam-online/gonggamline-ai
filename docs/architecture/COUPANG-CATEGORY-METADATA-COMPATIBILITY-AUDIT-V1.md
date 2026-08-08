# Coupang Category Metadata Compatibility Audit v1

## Outcome

The existing boundary is a read-only exact-category `GET`, but its provider
result and public `result` field are both unvalidated `Record<string, unknown>`.
It is suitable for the legacy registration screen only; it is not admissible
as a versioned Listing evidence snapshot or as proof that a product is ready
to register.

## Current contract

- Route: `GET /api/coupang/categories/meta?displayCategoryCode=<positive integer>`.
- Provider path: `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/{displayCategoryCode}`.
- Success shape: `{ ok: true, result: unknown }`.
- Provider failures pass through `{ ok: false, status, detail }`; unexpected
  failures return a message-bearing 500 response.
- No fixture or test in this Story calls Coupang, changes configuration, or
  submits a product.

The official 2026 contract includes attributes, notice categories, required
documents, certifications, allowed offer conditions, and single-item
eligibility. The bounded synthetic fixture records those collection names for
offline compatibility tests without claiming that category `78877` is the
correct category for KK946.

## Stop conditions and next Story

Do not map this raw response directly into Listing evidence, persist it as an
approved snapshot, or infer `NOT_REQUIRED` certification. A separate approved
typed-snapshot Story must validate every used field, record category validity,
observed time and digest, preserve provider failures, and keep official
Marketplace policy separate from category metadata.

Durable evidence is GitHub source/tests/docs. The fixture is synthetic and
contains no credential, provider account, Product data, personal data, or raw
Production response. Rollback is a Git revert.
