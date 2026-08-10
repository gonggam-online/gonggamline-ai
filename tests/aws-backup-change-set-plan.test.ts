import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildDisabledWorkerChangeSetPlan } from "../tools/aws-backup-change-set/plan";

const root = path.resolve(import.meta.dirname, "..");
const templateSource = readFileSync(
  path.join(root, "infra", "aws-backup", "cloudformation.json"),
  "utf8",
);
const committedPlan = JSON.parse(
  readFileSync(
    path.join(root, "docs", "cloud", "aws-backup-disabled-worker-change-set-v1.json"),
    "utf8",
  ),
) as ReturnType<typeof buildDisabledWorkerChangeSetPlan>;

test("committed disabled-worker change-set packet is reproducible from the exact template", () => {
  assert.deepEqual(committedPlan, buildDisabledWorkerChangeSetPlan(templateSource));
  assert.equal(committedPlan.template.sha256, "86cf98974aacee218b57ec4c66697393b4e9d932f589d95ef4f3a202bad9460b");
  assert.equal(committedPlan.template.bytes, 24_141);
});

test("packet pins Singapore, CREATE, named IAM acknowledgement, and disabled worker inputs", () => {
  assert.equal(committedPlan.target.region, "ap-southeast-1");
  assert.equal(committedPlan.target.changeSetType, "CREATE");
  assert.deepEqual(committedPlan.capabilities, ["CAPABILITY_NAMED_IAM"]);
  assert.deepEqual(committedPlan.parameters, {
    EnableWorkerResources: "false",
    BackupWorkerImageUri: "",
    ProductionDatabaseSecretArn: "",
  });
});

test("packet creates only six base resources and omits every worker resource", () => {
  assert.deepEqual(committedPlan.expectedChanges.createdResourceLogicalIds, [
    "BackupBucket",
    "BackupBucketPolicy",
    "BackupDeadLetterQueue",
    "BackupImageRepository",
    "BackupKey",
    "BackupKeyAlias",
  ]);
  assert.deepEqual(committedPlan.expectedChanges.omittedResourceLogicalIds, [
    "BackupDeadLetterAlarm",
    "BackupDeadLetterQueuePolicy",
    "BackupLogGroup",
    "BackupSchedule",
    "BackupSchedulerRole",
    "BackupWorker",
    "BackupWorkerAsyncFailure",
    "BackupWorkerRole",
  ]);
  assert.equal(committedPlan.expectedChanges.workerResourcesCreated, false);
  assert.equal(committedPlan.expectedChanges.scheduleCreated, false);
});

test("packet cannot authorize execution, root use, long-lived keys, or paid resources", () => {
  assert.equal(committedPlan.safety.rootIdentityProhibited, true);
  assert.equal(committedPlan.safety.longLivedAccessKeyProhibited, true);
  assert.equal(committedPlan.safety.executeChangeSetAuthorized, false);
  assert.equal(committedPlan.safety.infrastructureProvisioningAuthorized, false);
  assert.equal(committedPlan.safety.paidResourceCreationAuthorized, false);
  assert.equal(
    committedPlan.forbiddenAwsCliOperations.includes("cloudformation execute-change-set"),
    true,
  );
});

test("builder fails closed when the worker default or resource boundary drifts", () => {
  const workerEnabledTemplate = JSON.parse(templateSource) as {
    Parameters: { EnableWorkerResources: { Default: string } };
  };
  workerEnabledTemplate.Parameters.EnableWorkerResources.Default = "true";
  assert.throws(
    () => buildDisabledWorkerChangeSetPlan(JSON.stringify(workerEnabledTemplate)),
    /WORKER_RESOURCES_MUST_DEFAULT_FALSE/,
  );

  const unconditionalWorkerTemplate = JSON.parse(templateSource) as {
    Resources: { BackupWorker: { Condition?: string } };
  };
  delete unconditionalWorkerTemplate.Resources.BackupWorker.Condition;
  assert.throws(
    () => buildDisabledWorkerChangeSetPlan(JSON.stringify(unconditionalWorkerTemplate)),
    /DISABLED_WORKER_RESOURCE_BOUNDARY_DRIFTED/,
  );
});
