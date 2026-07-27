# Sprint B-0 — Database Baseline Execution v1

## Status

- Risk: high-risk / manual approval
- Status: proposed for repository-owner approval
- Owner: Database / Security
- Production execution: excluded

## Problem and objective

The deployed schema is known, but a fresh database cannot yet be reproduced
from `supabase/migrations`. The repository starts at migration 003 while the
authoritative Product, Product workflow, and Commerce OS sources remain under
`supabase/recovery-sources`.

Sprint B-0 must make fresh replay deterministic so later sales features do not
repeatedly stop on schema drift. It must not repair Production, adopt
Production migration history, or weaken security.

## Evidence

- Sprint A inspection found 57 expected public tables, 883 columns,
  268 constraints, and 148 indexes.
- Existing official chain: migrations 003–020, which must not be renamed.
- Recovered sources: `products-baseline.sql`,
  `product-workflow-extension.sql`, and `commerce-os-core-schema.sql`.
- Existing migrations 005–020 create permissive policies after any pre-003
  baseline. A security migration placed only before 003 therefore cannot
  establish the final least-privilege state.
- No Supabase CLI configuration, isolated replay runner, or DB test harness is
  currently checked in.

## Scope

1. Promote the three recovered schema sources into canonical pre-003
   migrations with provenance headers and preserved schema semantics.
2. Keep historical permissive policies out of promoted schema migrations.
3. Preserve migrations 003–020 byte-for-byte and in their current order.
4. Add a post-020 fresh-replay security boundary that removes unconditional
   policies and establishes the approved least-privilege end state.
5. Add a disposable Supabase-supported replay runner.
6. Verify schema fingerprints and RLS positive/negative behavior.
7. Validate application compatibility without contacting Production.

## Non-goals

- Running baseline DDL against Production.
- Editing Production data or policy state.
- Manually inserting or modifying migration metadata.
- Renaming migrations 003–020.
- Inventing historical timestamps or checksums.
- Real marketplace or commerce writes.

## Canonical order

Future filenames encode dependency order, not invented historical chronology:

1. Products schema baseline.
2. Product workflow extension.
3. Commerce OS core schema.
4. Existing migrations 003–020 unchanged.
5. Post-020 fresh-replay security migration.

The final security migration is intentionally last because migrations 005–020
create permissive policies. A pre-003-only security design is rejected.

## Identity and authorization boundary

The application currently relies broadly on an anonymous Supabase client.
Least-privilege policies cannot be finalized safely until the owner approves:

- which reads, if any, are public;
- which operations are server/service-role only;
- the owner or tenant key for user-scoped data;
- authenticated roles and claims;
- scheduled-worker access.

Before that decision, an implementation may prepare schema-only baseline
candidates and replay tooling, but must not generate the final RLS migration or
claim B-0 complete.

## Isolated execution

Use only a disposable local or Preview/Staging database through the official
Supabase workflow. The runner starts empty, fails on the first SQL error,
records tool/database versions, never loads Production credentials, and is
repeatable on another PC.

## Acceptance

- Full replay completes with zero SQL errors.
- All 57 expected public tables and approved fingerprints are present.
- Anonymous writes are denied; explicitly approved reads succeed.
- Required server/worker operations succeed through the approved role.
- No unconditional write policy remains.
- Project validation and browser checks pass.
- No Production or real commerce endpoint is contacted.

## Delivery and rollback

1. Manually approve and merge this Architecture Story.
2. Implement schema baseline candidates and isolated replay tooling.
3. Record the concrete identity/ownership decision.
4. Implement the post-020 RLS boundary and tests.
5. Run replay only in the disposable environment.
6. Deliver a high-risk `manual-merge-required` PR.

Rollback is a PR revert plus disposal of the isolated database. Production
requires no rollback because Production execution is excluded.
