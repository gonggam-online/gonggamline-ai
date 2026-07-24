# Browser validation

Use Playwright Chromium and `tests/e2e/routes.ts` as the typed route source. Require responses below 400, a nonblank stable page, meaningful heading/landmark, no uncaught page errors, unexpected `console.error`, failed requests, unexpected API 4xx/5xx, raw stack traces, or unsafe error text.

Documented user-friendly degraded states are allowed. Interactions must be read-only in Preview and Production: never submit marketplace listings, pricing, orders, inventory, fulfillment, supplier purchasing, returns, settlement, or other irreversible actions.

Capture stable full-page screenshots for major routes. Retain screenshots, traces, video, HTML reports, and useful logs on failure. Strict pixel comparison is deferred until the UI stabilizes; later enable it with reviewed baseline snapshots and an explicit tolerance.

This document is part of the permanent Mandatory Codex Task Protocol in `AGENTS.md`.
