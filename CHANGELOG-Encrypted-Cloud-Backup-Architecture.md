# Changelog — Encrypted Cloud Backup Architecture

## 2026-08-06

- Added the fail-closed complete backup-worker pipeline and an isolated Docker
  rehearsal using only disposable synthetic PostgreSQL data and a synthetic
  immutable object writer.
- Proved a 6,351,131-byte archive, above the accepted 2x Production boundary,
  through dump, offline list verification, SHA-256, archive/manifest upload
  contracts, SSE-KMS/version assertions, Object Lock retention read-back, and
  complete cleanup in 7.901 seconds with 6,351,837 peak ephemeral bytes.
- Marked Lambda eligible only for review of the exact disabled-worker change
  set. No AWS resource, Production connection/export, secret, paid use,
  restore, or schedule was created or authorized.
- Verified the exact PR #100 merge commit in Production and recorded the
  successful Product Ops live-data render plus exact-head Production browser
  smoke run and evidence digest.
- Completed separate public On-Demand Singapore AWS Calculator estimates:
  USD 2.22/month observed and USD 2.63/month for the accepted 2x stress
  boundary. Lambda free tier was excluded and low-volume Scheduler/SQS rows
  were deliberately rounded up to the Calculator's one-million minimum.
- Added a fixed USD 2.00 tax and uncertainty reserve. The binding USD 4.63/month
  assessment is within the approved USD 10 AWS-only ceiling with USD 5.37
  headroom.
- Published sanitized one-year Calculator links and retained CloudTrail,
  Lambda eligibility, provisioning, Production upload, restore, schedule, and
  local deletion as separate approval gates. No AWS resource or paid use was
  created.

## 2026-08-05

- Added a transport-independent, secret-safe Production capacity runner and
  recorded the owner-approved final measurement: 715,071 bytes, 34.125 seconds,
  1,251 archive-list entries, and zero warnings. Verified complete transient
  cleanup and healthy Production postflight without any database or AWS write.
- Moved the AWS cost gate from missing capacity evidence to ready for a manual
  observed/2x public On-Demand Pricing Calculator estimate. Lambda eligibility,
  provisioning, upload, restore, and schedule remain separately gated.
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
- Recorded the owner-approved single Production measurement attempt. It failed
  closed at database-password authentication before archive creation; no retry,
  database write, AWS use, upload, restore, or schedule occurred. Transient
  files, tmpfs credential material, and the container were removed, Production
  remained healthy, and a correct process-scoped credential plus a new explicit
  one-attempt approval are required.
- Recorded the separately owner-approved retry after process-scoped credential
  injection. The retry executed once, but its final sanitized result was not
  preserved by the execution transport; cleanup and Production health passed,
  while dump success and capacity metrics remain unknown. Both approvals are
  consumed and no further retry, AWS provisioning, upload, restore, or schedule
  is authorized.
