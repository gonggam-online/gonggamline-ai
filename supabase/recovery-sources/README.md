# Supabase baseline recovery sources

These files preserve operator-supplied SQL as evidence. They are **not**
approved migrations and must not be executed as a package.

## Safety boundary

- Nothing in this directory is part of `supabase/migrations`.
- The three recovered source files preserve supplied SQL without correcting
  behavior, names, constraints, policies, or statement order.
- Inspection files contain read-only catalog queries for an operator-approved
  Supabase SQL Editor session.
- No deployed schema or Supabase migration history was contacted while
  preparing this package.

## Sources

| File | Evidence origin | Status |
|---|---|---|
| `products-baseline.sql` | Verbatim operator chat evidence | Complete source candidate; unverified against deployed schema |
| `product-workflow-extension.sql` | First complete verbatim operator chat block | Complete source candidate; a semantically duplicate formatting variant was also supplied |
| `commerce-os-core-schema.sql` | Verbatim attached operator evidence | Complete source candidate; contains six tables, not only the three in the earlier summary |
| `schema-inspection.sql` | Repository-authored read-only evidence query | Not executed |
| `migration-history-inspection.sql` | Repository-authored read-only history query | Not executed |

The complete analysis, statement inventory, unresolved evidence, and separate
fresh/reconciliation plans are in
[`../../docs/SUPABASE_BASELINE_RECOVERY_PLAN.md`](../../docs/SUPABASE_BASELINE_RECOVERY_PLAN.md).

## Required operator evidence before restoration

1. SQL Editor execution chronology for all three recovered sources.
2. Complete output from both inspection scripts.
3. Confirmation of the deployed Supabase project/environment inspected.
4. Exact deployed migration-history rows and version format.
5. Owner-approved resolution for any schema, policy, function, trigger, or
   migration-history mismatch.

Secrets, project keys, access tokens, and database passwords must never be
placed in these files or review comments.
