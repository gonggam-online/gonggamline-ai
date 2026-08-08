import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type JsonObject = Readonly<Record<string, unknown>>;

type CloudFormationResource = Readonly<{
  Type: string;
  Condition?: string;
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
  Properties: JsonObject;
}>;

type CloudFormationTemplate = Readonly<{
  Metadata: JsonObject;
  Parameters: Readonly<Record<string, JsonObject>>;
  Rules: Readonly<Record<string, JsonObject>>;
  Resources: Readonly<Record<string, CloudFormationResource>>;
}>;

const root = path.resolve(import.meta.dirname, "..");
const templatePath = path.join(root, "infra", "aws-backup", "cloudformation.json");
const templateSource = readFileSync(templatePath, "utf8");
const template = JSON.parse(templateSource) as CloudFormationTemplate;

function objectValue(value: unknown, label: string): JsonObject {
  assert.equal(typeof value, "object", `${label} must be an object`);
  assert.notEqual(value, null, `${label} must not be null`);
  assert.equal(Array.isArray(value), false, `${label} must not be an array`);
  return value as JsonObject;
}

function arrayValue(value: unknown, label: string): readonly unknown[] {
  assert.equal(Array.isArray(value), true, `${label} must be an array`);
  return value as readonly unknown[];
}

function resource(name: string): CloudFormationResource {
  const found = template.Resources[name];
  assert.ok(found, `${name} must exist`);
  return found;
}

function policyActions(roleName: string): readonly string[] {
  const policies = arrayValue(resource(roleName).Properties.Policies, `${roleName}.Policies`);
  return policies.flatMap((policy, policyIndex) => {
    const policyObject = objectValue(policy, `${roleName}.Policies[${policyIndex}]`);
    const document = objectValue(policyObject.PolicyDocument, `${roleName}.PolicyDocument`);
    const statements = arrayValue(document.Statement, `${roleName}.Statement`);
    return statements.flatMap((statement, statementIndex) => {
      const statementObject = objectValue(statement, `${roleName}.Statement[${statementIndex}]`);
      const action = statementObject.Action;
      return Array.isArray(action) ? action.map(String) : [String(action)];
    });
  });
}

test("backup plan is Singapore-only and worker resources fail closed", () => {
  const gonggamline = objectValue(template.Metadata.GonggamLine, "Metadata.GonggamLine");
  assert.equal(gonggamline.executionBoundary, "NO_STACK_OPERATION_FROM_THIS_STORY");
  assert.equal(gonggamline.approvedRegion, "ap-southeast-1");
  assert.equal(gonggamline.approvedMonthlyCeilingUsd, 10);
  assert.equal(template.Parameters.EnableWorkerResources.Default, "false");
  assert.equal(template.Parameters.BackupWorkerImageUri.Default, "");
  assert.equal(template.Parameters.ProductionDatabaseSecretArn.Default, "");
  assert.ok(template.Rules.SingaporeOnly);
  assert.ok(template.Rules.WorkerInputsRequiredWhenEnabled);
});

test("immutable bucket enforces retention, versioning, KMS, and public blocking", () => {
  const key = resource("BackupKey");
  assert.equal(key.DeletionPolicy, "Retain");
  assert.equal(key.UpdateReplacePolicy, "Retain");
  assert.equal(key.Properties.EnableKeyRotation, true);
  assert.equal(key.Properties.MultiRegion, false);
  assert.equal(key.Properties.PendingWindowInDays, 30);

  const bucket = resource("BackupBucket");
  assert.equal(bucket.DeletionPolicy, "Retain");
  assert.equal(bucket.UpdateReplacePolicy, "Retain");
  assert.equal(bucket.Properties.ObjectLockEnabled, true);
  const lock = objectValue(bucket.Properties.ObjectLockConfiguration, "ObjectLockConfiguration");
  const lockRule = objectValue(lock.Rule, "ObjectLockConfiguration.Rule");
  const defaultRetention = objectValue(lockRule.DefaultRetention, "DefaultRetention");
  assert.equal(defaultRetention.Mode, "GOVERNANCE");
  assert.equal(defaultRetention.Days, 35);
  assert.equal(objectValue(bucket.Properties.VersioningConfiguration, "Versioning").Status, "Enabled");

  const encryption = objectValue(bucket.Properties.BucketEncryption, "BucketEncryption");
  const rules = arrayValue(
    encryption.ServerSideEncryptionConfiguration,
    "ServerSideEncryptionConfiguration",
  );
  const encryptionRule = objectValue(rules[0], "ServerSideEncryptionRule");
  assert.equal(encryptionRule.BucketKeyEnabled, true);
  const encryptionDefault = objectValue(
    encryptionRule.ServerSideEncryptionByDefault,
    "ServerSideEncryptionByDefault",
  );
  assert.equal(encryptionDefault.SSEAlgorithm, "aws:kms");

  const publicBlock = objectValue(
    bucket.Properties.PublicAccessBlockConfiguration,
    "PublicAccessBlockConfiguration",
  );
  assert.deepEqual(publicBlock, {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  });

  const lifecycle = objectValue(bucket.Properties.LifecycleConfiguration, "LifecycleConfiguration");
  const lifecycleRules = arrayValue(lifecycle.Rules, "LifecycleConfiguration.Rules").map(
    (rule, index) => objectValue(rule, `LifecycleRule[${index}]`),
  );
  assert.equal(lifecycleRules.find((rule) => rule.Prefix === "daily/")?.ExpirationInDays, 36);
  assert.equal(lifecycleRules.find((rule) => rule.Prefix === "monthly/")?.ExpirationInDays, 366);
});

test("bucket policy rejects insecure, wrongly encrypted, and governance-bypass requests", () => {
  const policy = objectValue(resource("BackupBucketPolicy").Properties.PolicyDocument, "BucketPolicy");
  const statements = arrayValue(policy.Statement, "BucketPolicy.Statement").map((statement, index) =>
    objectValue(statement, `BucketPolicy.Statement[${index}]`),
  );
  const sids = statements.map((statement) => statement.Sid);
  assert.ok(sids.includes("DenyInsecureTransport"));
  assert.ok(sids.includes("DenyUnencryptedObjectWrites"));
  assert.ok(sids.includes("DenyMissingKmsKey"));
  assert.ok(sids.includes("DenyWrongKmsKey"));
  assert.ok(sids.includes("DenyWritesOutsideApprovedPrefixes"));
  assert.ok(sids.includes("DenyUnapprovedBackupWriter"));
  assert.ok(sids.includes("DenyDailyRetentionBelow35Days"));
  assert.ok(sids.includes("DenyMonthlyRetentionWithoutDate"));
  assert.ok(sids.includes("DenyMonthlyRetentionBelow365Days"));
  assert.ok(sids.includes("DenyGovernanceBypass"));
  assert.equal(statements.every((statement) => statement.Effect === "Deny"), true);

  const missingMonthlyRetention = statements.find(
    (statement) => statement.Sid === "DenyMonthlyRetentionWithoutDate",
  );
  assert.ok(missingMonthlyRetention);
  assert.equal(missingMonthlyRetention.Action, "s3:PutObjectRetention");
  assert.deepEqual(objectValue(missingMonthlyRetention.Condition, "missing retention condition"), {
    Null: { "s3:object-lock-retain-until-date": "true" },
  });

  const shortMonthlyRetention = statements.find(
    (statement) => statement.Sid === "DenyMonthlyRetentionBelow365Days",
  );
  assert.ok(shortMonthlyRetention);
  assert.equal(shortMonthlyRetention.Action, "s3:PutObjectRetention");
  assert.deepEqual(objectValue(shortMonthlyRetention.Condition, "short retention condition"), {
    NumericLessThan: { "s3:object-lock-remaining-retention-days": 365 },
  });

  const unapprovedWriter = statements.find(
    (statement) => statement.Sid === "DenyUnapprovedBackupWriter",
  );
  assert.ok(unapprovedWriter);
  assert.deepEqual(unapprovedWriter.Action, ["s3:PutObject", "s3:PutObjectRetention"]);
});

test("worker is conditional, bounded, container-based, and contains no secret value", () => {
  const worker = resource("BackupWorker");
  assert.equal(worker.Condition, "CreateWorkerResources");
  assert.equal(worker.Properties.PackageType, "Image");
  assert.equal(worker.Properties.Timeout, 900);
  assert.equal(worker.Properties.MemorySize, 2048);
  assert.equal(worker.Properties.ReservedConcurrentExecutions, 1);
  assert.equal(objectValue(worker.Properties.EphemeralStorage, "EphemeralStorage").Size, 10240);
  const environment = objectValue(worker.Properties.Environment, "Environment");
  const variables = objectValue(environment.Variables, "Environment.Variables");
  assert.equal(variables.DAILY_RETENTION_DAYS, "35");
  assert.equal(variables.MONTHLY_RETENTION_DAYS, "365");
  assert.deepEqual(variables.PRODUCTION_DATABASE_SECRET_ARN, {
    Ref: "ProductionDatabaseSecretArn",
  });
  assert.equal("DATABASE_URL" in variables, false);
  assert.equal("PASSWORD" in variables, false);
});

test("worker IAM can verify retention but cannot read, delete, decrypt, or bypass retention", () => {
  const role = resource("BackupWorkerRole");
  assert.equal(role.Condition, "CreateWorkerResources");
  assert.equal(role.Properties.RoleName, "gonggamline-backup-worker");
  assert.equal(role.Properties.ManagedPolicyArns, undefined);
  const actions = policyActions("BackupWorkerRole");
  for (const required of [
    "s3:PutObject",
    "s3:GetObjectRetention",
    "s3:PutObjectRetention",
    "kms:GenerateDataKey",
    "secretsmanager:GetSecretValue",
    "sqs:SendMessage",
  ]) {
    assert.ok(actions.includes(required), `${required} must be explicitly allowed`);
  }
  for (const prohibited of [
    "s3:GetObject",
    "s3:GetObjectAttributes",
    "s3:GetObjectVersion",
    "s3:GetObjectVersionAttributes",
    "s3:DeleteObject",
    "s3:DeleteObjectVersion",
    "s3:BypassGovernanceRetention",
    "kms:Decrypt",
    "secretsmanager:PutSecretValue",
  ]) {
    assert.equal(actions.includes(prohibited), false, `${prohibited} must not be allowed`);
  }

  const worker = resource("BackupWorker");
  assert.equal(worker.Properties.KmsKeyArn, undefined);
});

test("scheduler stays disabled and sends bounded failures to an encrypted DLQ", () => {
  const schedule = resource("BackupSchedule");
  assert.equal(schedule.Condition, "CreateWorkerResources");
  assert.equal(schedule.Properties.State, "DISABLED");
  assert.equal(schedule.Properties.ScheduleExpressionTimezone, "Asia/Singapore");
  assert.equal(schedule.Properties.ScheduleExpression, "cron(0 2 * * ? *)");
  const target = objectValue(schedule.Properties.Target, "BackupSchedule.Target");
  const retry = objectValue(target.RetryPolicy, "BackupSchedule.RetryPolicy");
  assert.equal(retry.MaximumEventAgeInSeconds, 3600);
  assert.equal(retry.MaximumRetryAttempts, 2);
  assert.ok(target.DeadLetterConfig);

  const asyncFailure = resource("BackupWorkerAsyncFailure");
  assert.equal(asyncFailure.Condition, "CreateWorkerResources");
  assert.equal(asyncFailure.Properties.MaximumEventAgeInSeconds, 3600);
  assert.equal(asyncFailure.Properties.MaximumRetryAttempts, 2);
  assert.equal(asyncFailure.Properties.Qualifier, "$LATEST");
  const destination = objectValue(asyncFailure.Properties.DestinationConfig, "DestinationConfig");
  assert.ok(destination.OnFailure);

  const queue = resource("BackupDeadLetterQueue");
  assert.equal(queue.DeletionPolicy, "Retain");
  assert.equal(queue.Properties.SqsManagedSseEnabled, true);
  assert.equal(queue.Properties.MessageRetentionPeriod, 1209600);
});

test("plan never embeds account identity, email, access keys, or backup bytes", () => {
  assert.equal(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(templateSource), false);
  assert.equal(/AKIA[0-9A-Z]{16}/.test(templateSource), false);
  assert.equal(/(?:password|secret(?:string|value)?|token|access[_-]?key)\s*[:=]\s*["'][^"']{8,}/i.test(templateSource), false);
  assert.equal(/CREATE_COMPLETE|UPDATE_COMPLETE/.test(templateSource), false);
  assert.match(templateSource, /NO_STACK_OPERATION_FROM_THIS_STORY/);
});
