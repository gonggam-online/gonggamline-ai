# Release and rollback

Normal-risk PRs may enable GitHub native squash auto-merge only when required CI and exact-commit Preview checks pass, the branch is current/conflict-free, and no high-risk path is detected. High-risk PRs remain open with `manual-merge-required`. Marketplace, order, inventory, supplier, payment, or production mutation is never used as automated verification.

After merge, the Production workflow waits for health and runs the same non-destructive route/API suite. On failure, inspect the uploaded Playwright report, screenshots, traces, and failed network details.

Rollback by reverting the merge through a reviewed PR and promoting/redeploying the last known-good Vercel deployment. Database, RLS, auth, pricing, orders, inventory, fulfillment, payments, and destructive changes require a task-specific, manually approved rollback plan; never use `git reset --hard`, force-push, or unreviewed production writes.

## Revenue Dashboard known limitations

- Summary averages and Strong Recommend count describe the returned page; the
  UI labels them `Current results`. Total Products comes from API metadata.
- Product search uses existing Supabase case-insensitive title, keyword, and
  product-number matching. No fuzzy search or dedicated search index exists.
- At most 10,000 source Products are ranked per request by the existing Query
  Service boundary.
- Missing source analysis time is displayed as `Not analyzed`; generated and
  refreshed timestamps never fill it.
- Local full-route E2E requires configured external Supabase access. Exact
  Preview and Production workflows are the authoritative deployed checks.

## Revenue Dashboard rollback

Revert the relevant Dashboard squash commit through a reviewed PR, wait for
the resulting Vercel deployment, then rerun `/api/health/runtime`,
`/api/dashboard/revenue`, and `/dashboard/revenue` browser smoke checks.
Because the Dashboard is read-only and has no migration, rollback requires no
data repair, schema action, Queue intervention, or external-system reversal.
