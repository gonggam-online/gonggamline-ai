# R3 Migration History Reconciliation changelog

## 2026-08-01

- Recorded the current Production logical-dump and isolated-restore evidence.
- Added a sanitized read-only catalog classification query for migration
  history and the deployed 021/022 object surface.
- Defined the two-phase R3 rehearsal/Production ordering that removes the R2/R3
  circular gate without replaying historical DDL.
- Required official Supabase CLI migration repair, exact dry-run output,
  immutable 000-022 hashes, fresh restore replay, and separate Production
  approval.
- Added static tests that prohibit database writes and direct migration-history
  manipulation in the R3 discovery artifacts.
