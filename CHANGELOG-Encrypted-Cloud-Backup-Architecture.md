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
- Added a Singapore-only, non-executing CloudFormation plan with retained
  KMS/S3/ECR/SQS resources, conditional worker resources, and an always-disabled
  schedule; no AWS stack operation or Production credential was performed.
- Recorded sanitized AWS preflight evidence (Paid account, payment method, one
  root MFA device, recurring USD 10 alert Budget, selectable Singapore region)
  while keeping recovery contacts, capacity, Calculator, provisioning, secret,
  export, and restore gates open.
- Removed `GetObjectAttributes` and Lambda environment-key decrypt authority
  from the writer after official AWS permission review showed they would
  authorize backup-body read/decrypt; restore verification remains a separate
  role and approval.
- Enforced explicit monthly Object Lock retention and rejected missing or
  shorter-than-365-day monthly retention while keeping Governance bypass
  prohibited.
- Routed both Scheduler delivery failure and exhausted Lambda asynchronous
  execution failure to the bounded encrypted DLQ and alarm.
- Recorded sanitized owner confirmation that AWS recovery contacts and a
  recovery method independent of this PC are verified. One Root MFA device is
  active; a second factor is optional and not a v1 gate.
- Added a high-risk, non-executing Production capacity-measurement approval
  packet and machine-readable Singapore Calculator input template. Current
  size/duration, costs, estimate URL, Production authority, and AWS provisioning
  remain unset and blocked.
