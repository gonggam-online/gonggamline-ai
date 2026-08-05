# Changelog — Cloud-first operating principle

## 2026-08-05

- Made approved remote durable-state placement a mandatory Story gate.
- Defined local PCs as replaceable execution clients and prohibited new
  local-only durable state.
- Added classification, recovery, retention, cleanup, cross-PC bootstrap, and
  service-selection requirements.
- Preserved high-risk approvals: this policy does not move Production data,
  backups, secrets, RLS, databases, or automation state.
