# R2 Product Security Reconciliation changelog

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
