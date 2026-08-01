# R3 history rehearsal implementation

## 2026-08-01

- Added a fail-closed validator for two-cycle migration-history rehearsal
  evidence.
- Pinned repair-plan identity to Supabase CLI 2.110.0 and migrations 000-022.
- Enforced quarantine, immutable migration hashes, exact history, catalog and
  Product-row invariance, empty dry-run, deterministic replay, sanitization,
  and negative gates.
- Kept the execution adapter blocked because the approved network-none target
  is unreachable by the official CLI without a separately approved transport.
