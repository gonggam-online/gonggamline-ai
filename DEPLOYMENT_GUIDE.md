# Deployment guide

## Flow

Feature branch → Draft PR to `main` → CI → exact-commit Vercel Preview → read-only Playwright validation → manual review/merge policy → Vercel Production → read-only Production smoke.

## Gates

CI requires lint, typecheck, Node tests, build, tracked-secret/generated-output checks, and newly introduced explicit-`any` checks. Preview validation resolves a successful GitHub Deployment for the exact PR SHA and uses `VERCEL_AUTOMATION_BYPASS_SECRET` only from GitHub Secrets.

High-risk changes receive `manual-merge-required` and are never auto-merged. This operating-system PR is manual even though its new changes are normal-risk. Never validate by submitting marketplace listings, pricing, orders, inventory, fulfillment, procurement, returns, or settlements.

## Rollback

For documentation/internal normal-risk work, revert the merge commit and redeploy the last known healthy commit. Schema or external-write rollback requires a task-specific high-risk plan and owner approval; never improvise a down migration or production data edit.

## Required evidence

Record commit SHA, Preview URL, deployment state, tested routes/APIs, console errors, page errors, failed requests, screenshots/traces on failure, Production deployment, and smoke result. Never claim an unrun gate passed.
