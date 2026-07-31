# R1 Product Mutation Audit

## 2026-07-30

- Inventoried five externally reachable Product mutation routes that currently
  write through the shared anonymous Supabase client.
- Identified a GET-side-effect on Domeggook search and defined the required
  persistence-free search/protected import split.
- Recorded Auth, CSRF, idempotency, audit, worker isolation, partial-failure,
  and financial-field stop conditions for later R1 implementation.
- Added a source-alignment test. No runtime, database, Auth, secret, API
  response, or Production behavior changed.
