# Autonomous Delivery System

## Added

- Permanent business-first Codex task prefix and delivery suffix.
- `.ai` operating, risk, revenue, browser, and reporting guidance.
- Stable CI checks, automatic PR creation, risk labels, and guarded native auto-merge eligibility.
- Typed Playwright route/API tests with Preview and Production workflows and browser evidence.
- PR template and delivery, validation, release, rollback, and owner-setup documentation.

## Fixed

- Preview URL resolution now uses the exact-commit GitHub Deployment record created by Vercel, removing the unnecessary hard dependency on `VERCEL_TOKEN` and `VERCEL_PROJECT_ID`.
- Playwright now establishes the Vercel automation bypass cookie and read-only Preview APIs return empty data only for expected configuration, network, or missing-schema states.
- Preview read fallbacks now preserve endpoint availability metadata while unexpected application errors continue to return HTTP 500.
- Discovery reads now target `market_products.product_url` without changing the `url` response key, and Coupang seller reads explicitly select the `workflow_id` relationship.
