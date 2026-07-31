# R2 Product Security Reconciliation changelog

## 2026-07-31

- Added a read-only, fail-closed restored-environment inventory collector for
  migration history, Product RLS/policies/grants, R1 function ownership and
  ACLs, default privileges, public object creators, extensions, and sanitized
  Product row-count ranges.
- Added static security tests that reject mutation SQL, Production/target
  ambiguity, secret output, remote migration commands, or incomplete R1
  function inventory.
- Documented the quarantine, evidence, stop-condition, and separate-approval
  boundary. Candidate migration 023 remains intentionally absent until an
  owner-approved restored inventory passes.
