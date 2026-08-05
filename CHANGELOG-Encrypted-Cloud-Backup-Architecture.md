# Changelog — Encrypted Cloud Backup Architecture

## 2026-08-05

- Added the proposed independent Production backup and restore architecture.
- Added a machine-readable, fail-closed owner-decision contract.
- Recommended Supabase provider backups plus an independent Singapore AWS S3,
  KMS, Object Lock, and scheduled Lambda boundary.
- Defined retention, capacity, two-cycle restore, cost, security, rollout,
  rollback, and exact owner gates.
- Performed no account creation, billing, provisioning, credential operation,
  Production access/export, restore, backup movement, or deletion.
- Recorded owner-supplied sanitized evidence that Production is on Supabase
  Free with no managed recovery point or restore entitlement.
- Split the optional paid Supabase Pro daily-backup decision from the proposed
  USD 10/month AWS-only ceiling and excluded PITR from the initial proposal.
- Recorded owner approval for Supabase Pro daily backups without PITR, AWS
  Singapore, the USD 10/month AWS-only ceiling, 35-day/12-month retention, and
  RPO <=24h/RTO <=8h while preserving all execution and merge gates.
- Recorded sanitized verification that Pro is active with seven physical daily
  recovery points and restore actions, Spend Cap enabled, PITR and other paid
  add-ons disabled, and no configured Log Drain.
- Preserved the explicit limitation that database backups exclude Storage API
  object bodies and do not satisfy the independent AWS retention target.
