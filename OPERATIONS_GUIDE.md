# Operations guide

## Daily operating loop

1. Check Production health and failed workflows/jobs.
2. Review revenue opportunities by margin/evidence/confidence.
3. Approve only traceable discovery and sourcing decisions.
4. Review supplier/MOQ/lead-time/regulatory evidence.
5. Generate listing drafts; keep publishing behind explicit approval.
6. Reconcile runtime failures with bounded retry and audit events.
7. Measure sales, profit, return cost, working capital, and manual interventions.

## Incident triage

External configuration → database/schema → code. Preserve the original error in sanitized logs. Never replace a failed write with success. Use runtime job state, worker events, workflow timelines, registration attempts, and health endpoints as the audit trail.

## Safe checks

`/api/health/runtime`, dashboard reads, page navigation, and documented read-only Playwright routes. Do not trigger demo seeding, commands, collection jobs, analysis writes, approvals, supplier/order/inbound creation, listing generation/status changes, Coupang sync/register, or runtime execute/retry/cancel during Production smoke.

## Owner-only systems

Vercel deployment protection/secrets, GitHub repository settings/secrets/labels, Supabase project schema/RLS, Coupang credentials/permissions, OAuth, DNS, and billing. Report actions without exposing values.
