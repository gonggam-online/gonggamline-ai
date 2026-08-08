# AWS Backup Capacity Measurement Approval v1

## 1. Decision requested

This packet prepares one bounded, read-only Production logical-export capacity
measurement. It does not authorize the measurement, a Production connection,
credential creation, AWS provisioning, upload, restore, schedule, or paid AWS
use. Database / Security owner approval must name this exact packet before any
execution.

- Risk: `HIGH`; Production data is read into a transient logical archive.
- Exact source: Supabase project `sxvtznmoemrcwifungnb`, Production,
  `ap-southeast-1`.
- Purpose: measure current PostgreSQL custom-archive bytes and wall-clock dump
  duration for the Lambda capacity gate and AWS Pricing Calculator.
- Root-cause class: missing Production capacity evidence, not an application
  code defect.
- Revenue effect: closes a recovery-continuity gate without changing customer,
  Product, Revenue, listing, order, inventory, or settlement behavior.

The accepted approval text is:

```text
AWS 백업 Production 용량 측정 v1 승인
```

That approval covers only the read-only measurement and secure deletion of the
new transient measurement archive described here. It does not cover the older
restricted backups or any other local file.

## 2. Completed prerequisites

Sanitized owner confirmation dated 2026-08-05 records a paid AWS account,
registered payment method, one active Root MFA device, a recurring USD 10
Budget, Singapore availability, recovery contacts, and a recovery method
independent of this PC. A second Root MFA factor is not a v1 requirement and
its absence does not block this measurement.

Supabase Pro physical daily backups remain enabled. They are the provider-native
recovery layer while this independent path is incomplete.

## 3. Data and credential boundary

- Classification: `PRODUCTION_BUSINESS_DATA`; personal data may be present.
- The operator must use a newly authorized, short-lived database credential or
  the existing approved ephemeral Production access procedure. No value may be
  pasted into a command argument, Git, CI, Vercel, Codex, chat, screenshots, or
  logs.
- Use a process-scoped `PGPASSFILE` in a newly created restricted temporary
  directory outside the repository. Restrict access to the current operator
  and system administrators, then destroy that file on every terminal path.
- The archive is a temporary local measurement artifact only. It must never be
  copied to GitHub, OneDrive, CI artifacts, Vercel, email, chat, or AWS before
  the later upload architecture is approved.
- Never open or sample row contents. Only process exit state, warnings,
  duration, byte count, archive table-of-contents validation, and cleanup state
  may be recorded.

## 4. Exact execution semantics after approval

Execution uses PostgreSQL 17 `pg_dump` and `pg_restore`, matching the current
logical archive family. The operator must record the exact client version and
must stop on a server/client compatibility warning.

1. Confirm a low-traffic window, current Supabase provider backup visibility,
   exact project reference, region, TLS, and available restricted temporary
   storage. Do not run during a migration or incident.
2. Create a new restricted temporary directory outside the repository. Do not
   reuse, inspect, replace, or delete an older backup path.
3. Inject the database password only through the restricted process-scoped
   `PGPASSFILE`; keep the connection target out of logged command output.
4. Start a monotonic timer immediately before `pg_dump` and create one complete
   custom-format archive. Do not exclude tables, rows, or large objects merely
   to meet a limit, and do not report a partial archive as success.
5. Stop the timer only after a zero exit status. Treat every warning on standard
   error as a stop condition pending review.
6. Verify a finite non-zero byte count and a successful `pg_restore --list`.
   Do not restore, extract, or inspect data for this measurement.
7. Record only the sanitized fields defined in
   `aws-backup-capacity-input-v1.json`.
8. Securely delete the newly created archive and credential file, verify both
   paths are absent, and remove the empty temporary directory. Cleanup failure
   is an incident signal and blocks further work.

`pg_dump` is a read operation but can consume database CPU, I/O, connections,
and network bandwidth. Any elevated error rate, latency, provider alert,
connection instability, or unexpected lock/warning requires immediate abort.
No automatic retry is authorized.

## 5. Capacity decision

The repository records a historical 2026-08-04 archive of 696,310 bytes. It is
sanitized evidence only: it does not prove current size or duration and does
not satisfy this gate.

After a successful measurement:

- populate observed archive bytes and dump seconds;
- calculate expected and two-times-observed storage/request/compute inputs;
- keep Lambda eligibility `UNDECIDED` until a later synthetic worker rehearsal
  also measures archive verification, upload, manifest, and cleanup time;
- reject Lambda without truncation if the complete measured workflow cannot
  stay safely below 900 seconds and 10,240 MiB; and
- require a new Fargate Architecture decision if Lambda margin is inadequate.

The measurement cannot authorize worker implementation or provisioning by
itself.

## 6. AWS Pricing Calculator handoff

After current measurements are recorded, create one public On-Demand estimate
for Asia Pacific (Singapore) with two scenarios: observed and 2x observed. Add
Amazon S3, AWS KMS, Amazon ECR, AWS Lambda, AWS Secrets Manager, EventBridge
Scheduler, Amazon SQS, Amazon CloudWatch, transfer/retrieval for the restore
drill, and CloudTrail data events only if later enabled. Record tax separately
because the repository ceiling is a billed-cost control, not merely a
pre-tax calculator subtotal.

The estimate must preserve 35 daily and 12 monthly retained recovery points,
S3 versions/Object Lock, one customer-managed KMS key, 31 daily invocations,
one monthly retention-class write, and two annual restore cycles. Unknown
values remain `null`; they are never replaced with optimistic zeroes.

Provisioning remains blocked unless both scenario totals are recorded, the 2x
scenario is below the approved USD 10/month AWS-only ceiling with tax and
uncertainty margin, and the exact disabled-worker CloudFormation change set
receives separate approval.

## 7. Rollback and evidence

Before execution, rollback is simply reverting this documentation. During the
approved measurement, abort, destroy only the newly created transient files,
and preserve provider backups. No database rollback exists because no database
write is allowed.

Durable evidence is the sanitized JSON result and reviewed GitHub PR. Raw
archive bytes, database credentials, connection strings, local paths, command
transcripts containing secrets, and row values are prohibited.

## 8. Execution record: three approvals consumed, current measurement completed

### 8.1 Initial attempt

The owner supplied the exact approval text on 2026-08-05 after PR #96 was
merged. That approval authorized one attempt and is now consumed.

Preflight passed before the attempt: the target was the exact Production
project in `ap-southeast-1`; Supabase Pro showed a current physical backup and
`Healthy` status; CPU was 2%, disk usage was 14%, and the Singapore Session
pooler was reachable on TLS port 5432. The local client was PostgreSQL 17.6 and
restricted temporary storage had adequate free capacity.

The single `pg_dump` attempt failed closed at database-password
authentication, before an archive was created. This is classified as
`EXTERNAL_CONFIGURATION_DATABASE_CREDENTIAL_AUTHENTICATION`, not a code or
schema defect. No retry was attempted, no database write occurred, no AWS
resource or paid use was created, and no backup was uploaded, restored, or
scheduled.

Cleanup passed on the failure path. The newly created restricted temporary
directory and its files were removed, the process-scoped credential file was
destroyed with the removed container tmpfs, and no measurement container
remained. The credential value, row contents, existing local backup contents,
and existing provider backups were not read or changed. Production was
`Healthy` after the attempt and the provider backup remained visible.

The current archive size, successful dump duration, and archive-list entry
count remain unknown. The Calculator, Lambda-capacity, AWS provisioning,
Production upload, restore, and schedule gates therefore remain blocked. A new
attempt requires both a correct process-scoped database credential and a new
explicit one-attempt approval; this packet does not authorize credential reset
or rotation.

### 8.2 Owner-approved retry 1

After the owner confirmed process-scoped credential injection, the owner
explicitly approved exactly one retry on 2026-08-05. Preflight again confirmed
the exact Singapore Production target, PostgreSQL 17.6, TLS port reachability,
adequate restricted temporary storage, and a current provider backup. That
single retry authority was executed once and is now consumed.

The execution transport did not preserve the final sanitized result JSON, so
the dump exit result, archive size, successful duration, archive-list count,
warning count, and whether a transient archive was created cannot be verified.
No terminal transcript was attached, and no matching Docker exit event remained
after cleanup. Safety policy prohibits inferring success from cleanup or from
historical size evidence.

Postflight cleanup is verified: zero matching restricted temporary directories
and zero measurement containers remain. No AWS resource, paid use, upload,
restore, or schedule occurred; the dump command was read-only and could not
mutate the database. Supabase Production remained `Healthy` with CPU 2%, disk
14%, RAM 59%, 12/60 connections, and no Advisor issue after the retry.

The current measurement and Calculator/Lambda gates remain blocked. No further
retry is authorized. A new execution requires a new explicit one-attempt owner
approval and must persist the sanitized result independently before deleting
the transient archive.

### 8.3 Owner-approved final attempt

The owner explicitly requested a new, reliable AWS capacity measurement on
2026-08-05. Before consuming that one-attempt authority, the runner was changed
to persist a sanitized result independently of terminal-output transport and
was verified on a credential-absent failure path. Preflight confirmed the exact
Singapore Production target, PostgreSQL 17.6, TLS reachability, adequate
restricted temporary storage, a visible current physical provider backup, and
`Healthy` Production status.

The single complete custom-format `pg_dump` succeeded at
`2026-08-05T11:00:45.4286736Z`. The archive was 715,071 bytes and the dump took
34.125 seconds. Offline `pg_restore --list` validation found 1,251 entries and
zero warnings. The result contains no credential, connection string, archive
content, row content, or account identifier.

Cleanup passed: the transient archive, process-scoped credential file,
restricted temporary directory, dump container, and restore-list container
were all removed. Independent postflight inspection found zero matching
temporary artifacts and zero measurement containers. No database mutation,
AWS resource, paid use, upload, restore, or schedule occurred. Supabase
Production remained `Healthy` after the attempt with CPU 2%, disk 14%, RAM 58%,
14/60 connections, and no Advisor issue.

All three one-attempt approvals are consumed and no additional Production
measurement is authorized. The current capacity-measurement gate is closed;
The later 2026-08-06 synthetic complete-worker rehearsal processed a
6,351,131-byte archive through dump, offline inspection, SHA-256, immutable
upload contract, manifest, retention read-back, and cleanup in 7.901 seconds
with 6,351,837 peak ephemeral bytes. Lambda is now eligible only for review of
an exact disabled-worker change set. Public On-Demand estimates are also
complete. Provisioning, Production upload, restore, and schedule remain
separately blocked.

Official references:

- [Supabase logical backups with physical backups enabled](https://supabase.com/docs/guides/troubleshooting/download-logical-backups)
- [PostgreSQL 17 `pg_dump`](https://www.postgresql.org/docs/17/app-pgdump.html)
- [AWS Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)
- [AWS Lambda ephemeral storage](https://docs.aws.amazon.com/lambda/latest/dg/configuration-ephemeral-storage.html)
- [AWS Pricing Calculator getting started](https://docs.aws.amazon.com/pricing-calculator/latest/userguide/getting-started.html)
