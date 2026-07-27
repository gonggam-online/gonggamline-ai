# Supabase restoration design

## Close-out status

Production catalog outputs were supplied in Sprint A-4 and reconciled in
Sprint A-5. The final classifications are in
`docs/SUPABASE_DEPLOYED_OBJECT_CLASSIFICATION.md`. No unresolved `UNKNOWN`
finding remains; unverifiable historical properties are explicitly `DEFERRED`.
No official migration, policy, or history record is created by this design.

## A. Fresh database replay

Proposed logical dependency order, without assigning filenames:

1. Products baseline.
2. Product workflow extension.
3. Commerce OS core schema; it is independent of Product because its
   `product_id` fields intentionally lack Product foreign keys.
4. Production-safe Commerce OS RLS, designed separately; historical
   `003_dev_rls` is never the Production policy.
5. Existing migration 003, then 004 through 020 in their current order.

The relative historical order of Commerce OS core and Product workflow remains
unproven without SQL Editor timestamps. Fresh replay must use an isolated
project, exact approved sources, object-by-object verification, and application
tests in a later high-risk Story.

## B. Existing Production reconciliation

Never blindly rerun historical baseline DDL.

- `EXACT`: retain the deployed object; do not rerun its baseline statement.
- `COMPATIBLE`: document the proven low-risk difference and decide whether it
  should remain environment-specific.
- `INCOMPATIBLE`: design one purpose-built corrective migration with locking,
  data compatibility, rollback, and application deployment order.
- `ABSENT`: design an additive migration with dependency and backfill proof.
- `UNKNOWN`: stop restoration until it is resolved or formally deferred with
  a reason and a later verification boundary.

Schema changes and history reconciliation are separate controlled operations.
First identify the actual runner and metadata format. Do not directly insert
assumed migration-history rows. Use an official repair mechanism only after
version/name/checksum semantics and environment history are proven.

## C. Preview or Staging alignment

Collect the same thirteen outputs with explicit environment labels before any
future database execution. Preview/Staging comparison is optional for Sprint A
documentation close-out but required as the first execution target before
Production. It is never proof of Production state.

## D. Production RLS hardening

Historical `003_dev_rls` grants unconditional full access to `anon` and
`authenticated` and is rejected as a Production policy. The Git 005–020
development policies require the same scrutiny.

Current code has no service-role client. Browser components call server routes,
but those routes use the public anon client. Least-privilege options are:

1. Immediate MVP-safe: preserve only the minimal operations needed by verified
   server routes, deny unused delete and unused Product insert, and prevent
   direct cross-tenant/business access. This still requires an explicit
   ownership model and cannot be drafted from assumptions.
2. Long term: server-only privileged data access for internal automation,
   authenticated user/tenant identity, row ownership, operation-specific
   policies, audit events, and isolated marketplace-write approvals.

Before policy implementation, inventory every endpoint operation, choose the
principal for each, add negative authorization tests, define rollout order and
rollback, and verify Preview with the exact application commit.

## Required decision package after evidence intake

For each environment, populate the classification record with evidence
references, dependency impact, proposed treatment, and reviewer. Then produce
separate reviewed artifacts for canonical baseline migrations, corrective
Production migrations, migration-history repair, and RLS hardening. No single
compensating migration should combine those concerns.

## Rollback boundary

This task adds only evidence files and documentation; rollback is repository
revert. A future database rollback must be object-specific and account for
existing data, irreversible constraint validation, policy availability,
schema-cache behavior, and application deployment sequencing.
