# Release and rollback

Normal-risk PRs may enable GitHub native squash auto-merge only when required CI and exact-commit Preview checks pass, the branch is current/conflict-free, and no high-risk path is detected. High-risk PRs remain open with `manual-merge-required`. Marketplace, order, inventory, supplier, payment, or production mutation is never used as automated verification.

After merge, the Production workflow waits for health and runs the same non-destructive route/API suite. On failure, inspect the uploaded Playwright report, screenshots, traces, and failed network details.

Rollback by reverting the merge through a reviewed PR and promoting/redeploying the last known-good Vercel deployment. Database, RLS, auth, pricing, orders, inventory, fulfillment, payments, and destructive changes require a task-specific, manually approved rollback plan; never use `git reset --hard`, force-push, or unreviewed production writes.
