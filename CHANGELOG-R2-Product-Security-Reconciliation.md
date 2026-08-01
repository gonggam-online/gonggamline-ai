# R2 Product Security Reconciliation changelog

## Candidate 023 checkpoint - 2026-08-01

- Added the inventory-bound, forward-only `023_product_security_target.sql`
  candidate from sanitized restored inventory fingerprint
  `dbf1c4daedf92a85f86513885d8daf4fa2905ca9d1e5e16d123c5697e75a3d56`.
- The candidate fails closed on Product owner/RLS/policy/grant drift, the exact
  seven R1 function contracts and restored execute classification, or creator
  role drift before changing authority.
- It removes the two exact anonymous Product write policies, preserves only the
  anon Product read policy, denies direct Product writes, reasserts the four
  service-role mutation entry points, denies helper RPC execution, and applies
  browser-facing default-privilege deny for the inventoried `postgres` creator.
- This checkpoint generated and statically validates SQL only. It did not apply
  the migration to a database and did not change Production, history, Auth, or
  commerce state.

## 2026-07-31

- Added a read-only, fail-closed restored-environment inventory collector for
  migration history, Product RLS/policies/grants, R1 function ownership and
  ACLs, default privileges, public object creators, extensions, and sanitized
  Product row-count ranges.
- Added static security tests that reject mutation SQL, Production/target
  ambiguity, secret output, remote migration commands, or incomplete R1
  function inventory.
- Added a fail-closed inventory validator that rejects unknown migration
  history, Product policies, R1 overload/owner/security/search-path drift,
  incomplete relation/creator/default-ACL evidence, malformed CSV, and
  secret-like content. The inventory now exposes complete history and explicit
  default-ACL completeness sentinels instead of filtering away drift.
- Added exhaustive Product table privilege and R1 RPC execute-state matrices,
  external-work extension stop conditions, and a deterministic sanitized
  inventory report/fingerprint that excludes raw catalog rows.
- Documented the quarantine, evidence, stop-condition, and separate-approval
  boundary. Candidate migration 023 remains intentionally absent until an
  owner-approved restored inventory passes.
