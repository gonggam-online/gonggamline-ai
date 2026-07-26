# Risk policy

Classify the entire Story before implementation and again from the final diff.
If any high-risk condition applies, the whole PR is high-risk.

## Normal-risk

Documentation, tests, monitoring, CI, browser tests, UI presentation, read-only
pages/APIs, sanitized errors, non-destructive analytics, and
behavior-equivalent internal refactoring.

## High-risk

- `supabase/migrations/**`, schema, RLS, auth, or authorization;
- secrets or environment configuration;
- pricing, margin, fee, or financial calculations;
- marketplace/listing writes or product price changes;
- order, inventory, fulfillment, supplier purchase, return, or cancellation;
- settlement, payment, destructive operations, or Production data mutation.

High-risk PRs require `manual-merge-required`, explicit rollback, domain-owner
approval, and no auto-merge. The initial automation/project bootstrap is manual
under the existing delivery exception.

The concise compatibility source is
[`risk-classification.md`](risk-classification.md). If classification is
uncertain, stop and classify conservatively before implementation.
