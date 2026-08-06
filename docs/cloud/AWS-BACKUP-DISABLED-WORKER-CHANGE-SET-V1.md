# AWS Backup Disabled-Worker Change Set v1

## 1. Outcome and authority

This packet fixes the exact first CloudFormation review target after the
successful synthetic worker rehearsal. It authorizes repository review and a
later separately approved **change-set creation only**. It does not authorize
executing the change set or provisioning any AWS resource.

- Region: `ap-southeast-1` only.
- Stack: `gonggamline-independent-backup-v1`.
- Change set: `base-boundary-review-v1`, type `CREATE`.
- Template: `infra/aws-backup/cloudformation.json`, 24,141 bytes.
- Template SHA-256:
  `86cf98974aacee218b57ec4c66697393b4e9d932f589d95ef4f3a202bad9460b`.
- Parameter: `EnableWorkerResources=false`; worker image and Production secret
  ARN remain empty defaults.
- Capability acknowledgement: `CAPABILITY_NAMED_IAM` because the template
  contains conditionally omitted roles with explicit names.
- Risk: `HIGH`; manual merge and every AWS action remain separate.

AWS documents that creating a change set for a new stack creates stack metadata
but no template resources, and CloudFormation changes resources only after an
explicit `ExecuteChangeSet`. This Story prohibits that execution operation.

## 2. Exact expected review

The generated packet is
`docs/cloud/aws-backup-disabled-worker-change-set-v1.json`. Reproduce it without
contacting AWS:

```powershell
npm run cloud:aws-backup:change-set-plan
```

The exact first change set must propose six `Add` actions:

1. `BackupKey` and `BackupKeyAlias`;
2. `BackupBucket` and `BackupBucketPolicy`;
3. `BackupImageRepository`; and
4. `BackupDeadLetterQueue`.

It must omit all eight worker-conditioned resources: Lambda, both worker and
scheduler roles, Scheduler, log group, async failure destination, queue policy,
and alarm. It must contain no Product, Supabase, Production secret, export,
restore, or schedule action.

The KMS key, bucket, ECR repository, and queue use both
`DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain`. Executing this
change set would therefore create paid, retained resources whose cleanup is not
equivalent to deleting a normal stack.

## 3. Identity and tooling stop condition

Do not use the AWS root identity, a root access key, an IAM user access key, or
another long-lived developer key. AWS recommends temporary credentials for
human operators and IAM Identity Center for centralized access.

Before creating the no-execute change set, all of these must be true:

1. AWS CLI v2 is installed on the active authorized PC;
2. an IAM Identity Center or equivalent federated administrative identity is
   configured with MFA;
3. `aws sts get-caller-identity` succeeds and the sanitized identity is not
   `root`;
4. the active region is explicitly `ap-southeast-1`;
5. the generated packet exactly matches the committed JSON; and
6. the owner separately approves creating this exact no-execute change set.

The current 2026-08-06 workstation check found no AWS CLI and the available AWS
console session was signed out. No AWS action was attempted.

## 4. Creation and inspection procedure after approval

Use the exact `exactAwsCliArguments` array in the JSON packet. Do not add
`execute-change-set`, `create-stack`, `deploy`, or `update-stack`. After
creation, wait for `CREATE_COMPLETE` on the **change set**, not the stack, and
save only sanitized metadata: region, stack/change-set names, template digest,
parameter names/non-secret values, capability, logical resource IDs, actions,
replacement flags, and status.

Fail closed if the service-generated change set differs from the six-add/
eight-omitted boundary. Delete only the unexecuted change set and its
`REVIEW_IN_PROGRESS` stack metadata after an exact rollback review. Never treat
an unexecuted change set as a provisioned backup boundary.

## 5. Provisioning boundary and rollback

Execution requires a new owner approval naming the exact change-set identifier,
the six reviewed resource actions, estimated USD 4.63/month planning total,
retained resources, verification procedure, and rollback. Until then:

- `executeChangeSetAuthorized=false`;
- `infrastructureProvisioningAuthorized=false`;
- `paidResourceCreationAuthorized=false`;
- `productionExportAuthorized=false`; and
- existing Supabase Pro backups remain the recovery authority.

Before execution there are no AWS resources to decommission. After execution,
ordinary stack deletion does not delete retained KMS/S3/ECR/SQS resources; an
exact separately approved cleanup plan is mandatory.

## 6. Official references

- [AWS CloudFormation CreateChangeSet API](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_CreateChangeSet.html)
- [AWS IAM security best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS root user best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html)
- [Enable IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/enable-identity-center.html)
