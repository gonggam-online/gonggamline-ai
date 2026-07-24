# Autonomous Delivery System

## Added

- Permanent business-first Codex task prefix and delivery suffix.
- `.ai` operating, risk, revenue, browser, and reporting guidance.
- Stable CI checks, automatic PR creation, risk labels, and guarded native auto-merge eligibility.
- Typed Playwright route/API tests with Preview and Production workflows and browser evidence.
- PR template and delivery, validation, release, rollback, and owner-setup documentation.

## Fixed

- Preview URL resolution now uses the exact-commit GitHub Deployment record created by Vercel, removing the unnecessary hard dependency on `VERCEL_TOKEN` and `VERCEL_PROJECT_ID`.
