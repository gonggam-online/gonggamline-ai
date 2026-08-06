# AWS Independent Backup Infrastructure Plan v1

## 1. Authority and execution boundary

This document implements deployment-order stage 3 of the manually accepted
Encrypted Cloud Backup and Restore Architecture. It is a reviewable plan only.
It does not authorize a CloudFormation stack, change set, IAM role, KMS key,
bucket, image repository, queue, Lambda function, schedule, secret, Production
connection, export, restore, deletion, or charge.

- Risk: `HIGH`; manual merge and every later external action are required.
- Region: Asia Pacific (Singapore), `ap-southeast-1`, only.
- AWS operating ceiling: USD 10/month. AWS Budgets is an alert, not a hard
  technical cap; a reviewed AWS Pricing Calculator estimate is required before
  provisioning.
- Source template: `infra/aws-backup/cloudformation.json`.
- Default: `EnableWorkerResources=false`; no Lambda, worker role, log group,
  Scheduler, scheduler role, queue policy, or alarm is created.
- Even when worker resources are separately approved, the schedule is created
  as `DISABLED`.

## 2. Planned boundary

| Resource | Fail-closed control | Created by default if a later stack is approved |
| --- | --- | --- |
| KMS key and alias | Singapore-only, rotation, retained on stack deletion/replacement | yes |
| S3 backup bucket | private, versioned, SSE-KMS, Bucket Key, Object Lock Governance, retained | yes |
| S3 bucket policy | denies insecure transport, missing/wrong encryption, and retention bypass | yes |
| ECR repository | immutable tags, scan on push, KMS encryption, retained | yes |
| SQS dead-letter queue | encrypted, 14-day message retention, retained | yes |
| Lambda writer and IAM role | conditional, digest-pinned image, 15-minute ceiling, concurrency one | no |
| Secrets Manager reference | exact ARN parameter only; no secret value in source | no |
| EventBridge Scheduler | conditional, Singapore timezone, bounded delivery retries, always disabled | no |
| CloudWatch log/alarm | sanitized logs, 30-day retention, DLQ-visible failure | no |

The template uses `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain`
for the KMS key, bucket, ECR repository, queue, and log group. A later stack
deletion therefore is not a data-deletion procedure.

## 3. Writer least privilege and verification contract

The writer may write only `daily/*` and `monthly/*`, set and read Object Lock
retention, use the exact KMS key for encryption/data-key generation, read one
exact Secrets Manager resource, and write sanitized logs. Daily objects inherit
the 35-day bucket default. Every monthly write must supply an explicit
retain-until date, and the bucket policy rejects missing or shorter-than-365-day
monthly retention. It also rejects daily retention below 35 days, writes
outside the two approved prefixes, and writes from any principal other than the
exact named worker role. Because the writer has no Governance bypass
permission, it cannot shorten an active retention period. It also cannot delete
objects or versions, change a secret, or decrypt/read a backup body.

Scheduler delivery failure and exhausted Lambda asynchronous execution failure
both reach the exact encrypted SQS queue. Event age and retry counts are bounded
at both layers; the queue alarm makes terminal failure observable.

`GetObjectAttributes` is deliberately excluded. AWS requires `s3:GetObject`
for an unversioned request (or version-read permissions for a versioned
request), and SSE-KMS metadata inspection also requires `kms:Decrypt`. Those
permissions would defeat the writer/body-read separation. The writer instead
verifies the local archive, supplies and validates the upload checksum from the
S3 response, records the returned version/encryption values, and reads back
Object Lock retention. A later distinct restore role verifies the stored body
only during a separately approved synthetic or restore rehearsal.

The Lambda `KmsKeyArn` property is also omitted because the environment stores
only resource identifiers, not secret values, and customer-managed environment
encryption would require decrypt permission on the writer role.

## 4. Mandatory gates before any change set

All items must be satisfied and recorded without secret values:

1. **Complete 2026-08-05:** account recovery contacts and an independent
   recovery method are owner-verified; one root MFA device is active, and a
   second root factor is not required by v1;
2. measure a sanitized logical archive size and `pg_dump` duration without
   copying Production bytes into Git, CI, Vercel, chat, or an unapproved store;
3. **Complete 2026-08-06:** a synthetic complete-worker rehearsal processed
   6,351,131 bytes through dump, verification, upload contract, manifest,
   retention read-back, and cleanup in 7.901 seconds with 6,351,837 peak
   ephemeral bytes, proving margin against 900 seconds and 10 GiB without
   Production or AWS access;
4. produce a Singapore AWS Pricing Calculator estimate at expected and
   two-times observed size, including S3 versions/Object Lock, KMS, ECR,
   Lambda, Scheduler, SQS, CloudWatch, transfer, requests, and restore drill;
5. review the exact CloudFormation change set with
   `EnableWorkerResources=false`, including named-IAM capabilities and retained
   resources, and obtain explicit provisioning approval;
6. create no root access key and no long-lived developer access key; use a
   temporary/federated administrative session with MFA;
7. preserve the existing Supabase Pro provider backup throughout rollout.

The exact Production capacity-measurement boundary and sanitized Calculator
input are prepared in
[`AWS-BACKUP-CAPACITY-MEASUREMENT-APPROVAL-V1.md`](AWS-BACKUP-CAPACITY-MEASUREMENT-APPROVAL-V1.md)
and
[`aws-backup-capacity-input-v1.json`](aws-backup-capacity-input-v1.json).
Their existence does not authorize the measurement.

Template validation or tests do not satisfy these gates and do not authorize a
stack operation.

## 5. Ordered rollout after separate approval

1. Provision only the isolated base boundary with worker resources omitted.
2. Verify region, KMS rotation, bucket encryption/versioning/Object Lock,
   public-access blocks, retention and Budget notifications using synthetic
   content only.
3. Build and scan an immutable worker image; approve its exact digest.
4. Create an exact Secrets Manager resource and scoped Production export
   identity under a separate approval. Never place its value in source or a
   CloudFormation parameter.
5. Review a second change set that enables worker resources while leaving the
   schedule disabled.
6. Run synthetic upload and restore tests with separate writer/restore roles.
7. Approve one bounded Production export, then complete two fresh restore
   cycles within RPO/RTO targets.
8. Only after those gates, separately approve enabling the schedule.

## 6. Rollback and decommission

Before a Production object exists, rollback means keeping the schedule
disabled and removing only empty or synthetic resources through an exact,
approved change set. Retained resources may require a second explicit cleanup
plan. After a Production object exists, never delete the bucket, retained
versions, KMS key, manifest, or audit evidence as an ordinary rollback. Disable
new writes, preserve restore capability, wait for retention obligations, and
use a separately approved decommission plan.

## 7. Verification supplied by this Story

Repository tests parse the template and fail if the Singapore restriction,
disabled defaults, Object Lock, encryption, retention, public blocking,
bounded worker, DLQ, or prohibited writer permissions drift. They also scan the
plan for account email, access-key patterns, embedded secret values, backup
bytes, or claims that a stack operation completed.

Official contracts:

- [S3 `GetObjectAttributes` permissions](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObjectAttributes.html)
- [CloudFormation S3 Object Lock configuration](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-s3-bucket-objectlockconfiguration.html)
- [CloudFormation Lambda function](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-function.html)
- [CloudFormation EventBridge Scheduler schedule](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-scheduler-schedule.html)
