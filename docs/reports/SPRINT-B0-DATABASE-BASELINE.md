# Sprint B-0 Database Baseline delivery record

## Scope

This change promotes the three approved recovery sources into canonical
pre-003 migrations, pins their provenance, preserves migrations 003 through
020 by hash, and adds a disposable Supabase replay path.

The repository-owner instruction explicitly excludes Auth, RLS, and Story 3
implementation. Accordingly:

- the permissive `anon` policies from the recovered Products source are not
  promoted;
- no post-020 RLS or authorization migration is added;
- no application route, persistence DTO, service-role module, or Story 3 table
  is added.

Existing policies inside migrations 005 through 020 are preserved byte-for-byte
as historical migration content. Their replacement remains a separate
high-risk RLS implementation approval.

## Canonical migration order

1. `000_products_baseline.sql`
2. `001_product_workflow_extension.sql`
3. `002_commerce_os_core_schema.sql`
4. Existing migrations 003 through 020, unchanged

Source and preserved-migration SHA-256 values are computed from canonical LF
UTF-8 bytes so Windows and Linux checkouts agree. They are authoritative in
`supabase/baseline-manifest.json`.

## Replay boundary

- Supabase CLI is pinned to `2.110.0`.
- `supabase/config.toml` identifies a disposable local project.
- `scripts/verify-sprint-b0-baseline.ps1` refuses Production environment
  markers and requires Docker before running `supabase db reset --local`.
- GitHub CI starts a disposable Supabase stack, replays the complete chain, and
  discards the stack.
- No linked project, Production URL, credential, migration-history mutation, or
  remote database command is used.

## Local environment result

The current Windows host has no Docker/PostgreSQL runtime, so the local
disposable replay stops at the explicit Docker preflight. This is an external
tooling condition, not converted into application success. Exact-head GitHub
CI is the execution environment for the required disposable replay.

## Rollback

Revert this PR. Any local or CI disposable Supabase stack is stopped without a
backup. Production is neither contacted nor changed.
