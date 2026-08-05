import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type BackupContract = Readonly<{
  schemaVersion: string;
  status: string;
  risk: string;
  source: Readonly<{
    projectRef: string;
    region: string;
    currentBackupAuthority: string;
  }>;
  providerBackup: Readonly<{
    verified: boolean;
    plan: string;
    scheduledBackups: string;
    scheduledRetentionDays: number;
    backupType: string;
    storageObjectsIncluded: boolean;
    pointInTimeRecovery: string;
    restoreToNewProject: string;
    earliestRecoveryPoint: string;
    latestRecoveryPoint: string;
    currentRestoreEntitlement: boolean;
    proUpgradeApproved: boolean;
    proPlanBaseMonthlyPriceUsdAtDecision: number;
    proPlanActualProvisioningStatus: string;
    proSpendCapRequired: boolean;
    proSpendCapStatus: string;
    pointInTimeRecoveryAddOnApproved: boolean;
    additionalPaidFeatures: Readonly<{
      dedicatedIpv4: string;
      customDomain: string;
      logDrains: string;
    }>;
  }>;
  independentTargetProposal: Readonly<{
    provider: string;
    accountOwner: string;
    region: string;
    regionApproved: boolean;
    accountPreflight: Readonly<{
      accountIdentifierStored: boolean;
      accountPlan: string;
      paymentMethod: string;
      rootMfa: string;
      recoveryContacts: string;
      recurringBudget: string;
      singaporeRegion: string;
      rootAccessKeys: string;
    }>;
    bucketName: null;
    publicAccess: string;
    versioning: string;
    objectLock: Readonly<{ enabled: boolean; mode: string; automationCanBypass: boolean }>;
    encryption: Readonly<{ atRest: string; keyIdentifier: null }>;
    execution: Readonly<{ worker: string; ciBackupArtifact: string }>;
    infrastructurePlan: Readonly<{
      status: string;
      template: string;
      regionRule: string;
      workerResourcesDefault: string;
      scheduleStateWhenWorkerCreated: string;
      productionCredentials: string;
      stackOperationAuthorized: boolean;
      requiresSeparateChangeSetApproval: boolean;
      requiresCapacityEvidence: boolean;
      requiresAwsCalculatorEstimate: boolean;
    }>;
  }>;
  retentionProposal: Readonly<{
    dailyRecoveryPointDays: number;
    verifiedMonthlyArtifactMonths: number;
    accepted: boolean;
  }>;
  recoveryProposal: Readonly<{
    rpoHoursMaximum: number;
    rtoHoursMaximum: number;
    freshRestoreCycles: number;
    productionRestore: string;
    accepted: boolean;
  }>;
  capacityGate: Readonly<{
    lambdaMaximumRuntimeSeconds: number;
    lambdaMaximumEphemeralStorageMiB: number;
    measurement: Readonly<{
      status: string;
      runbook: string;
      inputTemplate: string;
      historicalReferenceBytes: number;
      historicalReferenceCreatedAt: string;
      historicalReferenceSatisfiesCurrentGate: boolean;
      currentArchiveBytes: null;
      currentDumpDurationSeconds: null;
      approvalConsumed: boolean;
      attemptCount: number;
      retryApprovalConsumed: boolean;
      succeeded: boolean;
      failureClass: string;
      resultEvidenceAvailable: boolean;
      archiveCreated: null;
      transientFilesDeleted: boolean;
      containerDeleted: boolean;
      databaseMutationPerformed: boolean;
      productionStatusAfterAttempt: string;
      retryAuthorized: boolean;
      productionConnectionAuthorized: boolean;
      transientProductionArchiveAuthorized: boolean;
    }>;
    fallback: string;
  }>;
  costProposal: Readonly<{
    initialMonthlyCeilingUsd: number;
    ceilingScope: string;
    supabasePlanCostExcluded: boolean;
    approved: boolean;
    calculatorStatus: string;
    calculatorEstimateUrl: null;
    expectedMonthlyUsd: null;
    twoTimesObservedMonthlyUsd: null;
  }>;
  requiredOwnerDecisions: readonly string[];
  approvedOwnerDecisions: readonly string[];
  consumedOneTimeApprovals: readonly string[];
  remainingOwnerDecisions: readonly string[];
  forbiddenActionsInThisStory: readonly string[];
}>;

const root = path.resolve(import.meta.dirname, "..");
const contractPath = path.join(root, "docs", "cloud", "encrypted-backup-contract-v1.json");
const architecturePath = path.join(
  root,
  "docs",
  "architecture",
  "ENCRYPTED-CLOUD-BACKUP-AND-RESTORE-V1.md",
);
const contractSource = readFileSync(contractPath, "utf8");
const contract = JSON.parse(contractSource) as BackupContract;
const architecture = readFileSync(architecturePath, "utf8");

test("backup architecture remains high-risk after unavailable retry evidence", () => {
  assert.equal(contract.schemaVersion, "gonggamline-encrypted-backup-contract-v1");
  assert.equal(
    contract.status,
    "PRO_PROVIDER_BACKUP_ACTIVE_AWS_ACCOUNT_PREFLIGHT_COMPLETE_CAPACITY_RETRY_RESULT_EVIDENCE_UNAVAILABLE_REAPPROVAL_REQUIRED_INFRASTRUCTURE_NOT_PROVISIONED_MANUAL_MERGE_REQUIRED",
  );
  assert.equal(contract.risk, "HIGH");
  assert.equal(contract.providerBackup.verified, true);
  assert.equal(contract.retentionProposal.accepted, true);
  assert.equal(contract.recoveryProposal.accepted, true);
  assert.equal(contract.costProposal.approved, true);
  assert.ok(contract.requiredOwnerDecisions.length >= 10);
  assert.ok(contract.forbiddenActionsInThisStory.includes("AUTO_MERGE"));
  assert.ok(
    contract.forbiddenActionsInThisStory.includes(
      "RETRY_PRODUCTION_CONNECTION_OR_EXPORT_WITHOUT_NEW_APPROVAL",
    ),
  );
});

test("owner evidence records the active bounded Supabase recovery layer", () => {
  assert.equal(contract.providerBackup.plan, "PRO");
  assert.equal(contract.providerBackup.scheduledBackups, "ENABLED_VERIFIED");
  assert.equal(contract.providerBackup.scheduledRetentionDays, 7);
  assert.equal(contract.providerBackup.backupType, "PHYSICAL");
  assert.equal(contract.providerBackup.storageObjectsIncluded, false);
  assert.equal(contract.providerBackup.pointInTimeRecovery, "DISABLED_VERIFIED");
  assert.equal(
    contract.providerBackup.restoreToNewProject,
    "NOT_REVERIFIED_AFTER_UPGRADE",
  );
  assert.equal(contract.providerBackup.earliestRecoveryPoint, "2026-07-29T18:24:15Z");
  assert.equal(contract.providerBackup.latestRecoveryPoint, "2026-08-04T18:24:40Z");
  assert.equal(contract.providerBackup.currentRestoreEntitlement, true);
  assert.equal(contract.providerBackup.proUpgradeApproved, true);
  assert.equal(contract.providerBackup.proPlanBaseMonthlyPriceUsdAtDecision, 25);
  assert.equal(contract.providerBackup.proPlanActualProvisioningStatus, "ACTIVE_VERIFIED");
  assert.equal(contract.providerBackup.proSpendCapRequired, true);
  assert.equal(contract.providerBackup.proSpendCapStatus, "ENABLED_VERIFIED");
  assert.equal(contract.providerBackup.pointInTimeRecoveryAddOnApproved, false);
  assert.equal(contract.providerBackup.additionalPaidFeatures.dedicatedIpv4, "DISABLED_VERIFIED");
  assert.equal(contract.providerBackup.additionalPaidFeatures.customDomain, "DISABLED_VERIFIED");
  assert.equal(contract.providerBackup.additionalPaidFeatures.logDrains, "NONE_CONFIGURED_VERIFIED");
  assert.ok(
    contract.requiredOwnerDecisions.includes("SUPABASE_PRO_UPGRADE_FOR_DAILY_PROVIDER_BACKUPS"),
  );
});

test("independent target is private, immutable, encrypted, and separate from CI", () => {
  assert.equal(contract.independentTargetProposal.provider, "AWS");
  assert.equal(
    contract.independentTargetProposal.accountOwner,
    "OWNER_CONTROLLED_ACCOUNT_RECOVERY_CONTACTS_VERIFIED",
  );
  assert.equal(contract.independentTargetProposal.region, contract.source.region);
  assert.equal(contract.independentTargetProposal.regionApproved, true);
  assert.equal(contract.independentTargetProposal.bucketName, null);
  assert.equal(contract.independentTargetProposal.publicAccess, "BLOCK_ALL");
  assert.equal(contract.independentTargetProposal.versioning, "ENABLED");
  assert.equal(contract.independentTargetProposal.objectLock.enabled, true);
  assert.equal(contract.independentTargetProposal.objectLock.mode, "GOVERNANCE");
  assert.equal(contract.independentTargetProposal.objectLock.automationCanBypass, false);
  assert.equal(contract.independentTargetProposal.encryption.atRest, "SSE-KMS_CUSTOMER_MANAGED_KEY");
  assert.equal(contract.independentTargetProposal.encryption.keyIdentifier, null);
  assert.equal(contract.independentTargetProposal.execution.worker, "AWS Lambda container image");
  assert.equal(contract.independentTargetProposal.execution.ciBackupArtifact, "PROHIBITED");
});

test("AWS account preflight is sanitized and complete without requiring a second root factor", () => {
  const preflight = contract.independentTargetProposal.accountPreflight;
  assert.equal(preflight.accountIdentifierStored, false);
  assert.equal(preflight.accountPlan, "PAID_VERIFIED");
  assert.equal(preflight.paymentMethod, "REGISTERED_VERIFIED");
  assert.equal(preflight.rootMfa, "ENABLED_ONE_DEVICE_VERIFIED_ADDITIONAL_FACTOR_NOT_REQUIRED_BY_V1");
  assert.equal(preflight.recoveryContacts, "VERIFIED_OWNER_CONFIRMATION");
  assert.equal(preflight.recurringBudget, "USD_10_VERIFIED_ALERT_ONLY_NOT_HARD_CAP");
  assert.equal(preflight.singaporeRegion, "AP_SOUTHEAST_1_SELECTABLE_VERIFIED");
  assert.equal(preflight.rootAccessKeys, "PROHIBITED_NOT_REQUESTED");
  assert.ok(contract.approvedOwnerDecisions.includes("AWS_ACCOUNT_OWNERSHIP_BILLING_MFA_AND_RECOVERY"));
  assert.equal(
    contract.remainingOwnerDecisions.includes("AWS_ACCOUNT_OWNERSHIP_BILLING_MFA_AND_RECOVERY"),
    false,
  );
});

test("infrastructure plan remains non-provisioning and fail-closed", () => {
  const plan = contract.independentTargetProposal.infrastructurePlan;
  assert.equal(plan.status, "IMPLEMENTED_NOT_PROVISIONED");
  assert.equal(plan.template, "infra/aws-backup/cloudformation.json");
  assert.equal(plan.regionRule, "AP_SOUTHEAST_1_ONLY");
  assert.equal(plan.workerResourcesDefault, "OMITTED");
  assert.equal(plan.scheduleStateWhenWorkerCreated, "DISABLED");
  assert.equal(plan.productionCredentials, "ABSENT");
  assert.equal(plan.stackOperationAuthorized, false);
  assert.equal(plan.requiresSeparateChangeSetApproval, true);
  assert.equal(plan.requiresCapacityEvidence, true);
  assert.equal(plan.requiresAwsCalculatorEstimate, true);
});

test("owner-approved retention, recovery, and cost policy remains execution-gated", () => {
  assert.equal(contract.retentionProposal.dailyRecoveryPointDays, 35);
  assert.equal(contract.retentionProposal.verifiedMonthlyArtifactMonths, 12);
  assert.equal(contract.recoveryProposal.rpoHoursMaximum, 24);
  assert.equal(contract.recoveryProposal.rtoHoursMaximum, 8);
  assert.equal(contract.recoveryProposal.freshRestoreCycles, 2);
  assert.equal(
    contract.recoveryProposal.productionRestore,
    "SEPARATE_INCIDENT_APPROVAL_REQUIRED",
  );
  assert.equal(contract.capacityGate.lambdaMaximumRuntimeSeconds, 900);
  assert.equal(contract.capacityGate.lambdaMaximumEphemeralStorageMiB, 10240);
  assert.equal(
    contract.capacityGate.measurement.status,
    "TWO_APPROVED_ATTEMPTS_CONSUMED_LATEST_RESULT_EVIDENCE_UNAVAILABLE_REAPPROVAL_REQUIRED",
  );
  assert.equal(contract.capacityGate.measurement.historicalReferenceBytes, 696310);
  assert.equal(contract.capacityGate.measurement.historicalReferenceSatisfiesCurrentGate, false);
  assert.equal(contract.capacityGate.measurement.currentArchiveBytes, null);
  assert.equal(contract.capacityGate.measurement.currentDumpDurationSeconds, null);
  assert.equal(contract.capacityGate.measurement.approvalConsumed, true);
  assert.equal(contract.capacityGate.measurement.attemptCount, 2);
  assert.equal(contract.capacityGate.measurement.retryApprovalConsumed, true);
  assert.equal(contract.capacityGate.measurement.succeeded, false);
  assert.equal(
    contract.capacityGate.measurement.failureClass,
    "EXECUTION_RESULT_EVIDENCE_UNAVAILABLE",
  );
  assert.equal(contract.capacityGate.measurement.resultEvidenceAvailable, false);
  assert.equal(contract.capacityGate.measurement.archiveCreated, null);
  assert.equal(contract.capacityGate.measurement.transientFilesDeleted, true);
  assert.equal(contract.capacityGate.measurement.containerDeleted, true);
  assert.equal(contract.capacityGate.measurement.databaseMutationPerformed, false);
  assert.equal(contract.capacityGate.measurement.productionStatusAfterAttempt, "HEALTHY");
  assert.equal(contract.capacityGate.measurement.retryAuthorized, false);
  assert.equal(contract.capacityGate.measurement.productionConnectionAuthorized, false);
  assert.equal(contract.capacityGate.measurement.transientProductionArchiveAuthorized, false);
  assert.equal(contract.capacityGate.fallback, "STOP_AND_PROPOSE_FARGATE_ARCHITECTURE");
  assert.equal(contract.costProposal.initialMonthlyCeilingUsd, 10);
  assert.equal(contract.costProposal.ceilingScope, "AWS_INDEPENDENT_BACKUP_ONLY");
  assert.equal(contract.costProposal.supabasePlanCostExcluded, true);
  assert.equal(
    contract.costProposal.calculatorStatus,
    "BLOCKED_PENDING_SUCCESSFUL_CURRENT_MEASUREMENT",
  );
  assert.equal(contract.costProposal.calculatorEstimateUrl, null);
  assert.equal(contract.costProposal.expectedMonthlyUsd, null);
  assert.equal(contract.costProposal.twoTimesObservedMonthlyUsd, null);
  for (const decision of [
    "SUPABASE_PRO_UPGRADE_FOR_DAILY_PROVIDER_BACKUPS",
    "SINGAPORE_DATA_RESIDENCY",
    "USD_10_MONTHLY_COST_CEILING",
    "RETENTION_RPO_AND_RTO",
  ]) {
    assert.ok(contract.approvedOwnerDecisions.includes(decision));
  }
  for (const decision of [
    "BOUNDED_PRODUCTION_CAPACITY_MEASUREMENT",
    "INFRASTRUCTURE_PROVISIONING",
    "FIRST_PRODUCTION_EXPORT",
    "LOCAL_BACKUP_DELETION_AFTER_PARITY",
  ]) {
    assert.ok(contract.remainingOwnerDecisions.includes(decision));
  }
  assert.deepEqual(contract.consumedOneTimeApprovals, [
    "BOUNDED_PRODUCTION_CAPACITY_MEASUREMENT_ATTEMPT_2026_08_05",
    "BOUNDED_PRODUCTION_CAPACITY_MEASUREMENT_RETRY_1_2026_08_05",
  ]);
});

test("architecture does not duplicate a local backup path or secret-like value", () => {
  const combined = `${contractSource}\n${architecture}`;
  assert.equal(/[A-Z]:\\Dev\\backups\\/i.test(combined), false);
  assert.equal(/(?:gh[opsu]_|sbp_|eyJ[A-Za-z0-9_-]{20,}\.)[A-Za-z0-9_.-]{16,}/.test(combined), false);
  assert.equal(/(?:password|secret|token|access[_-]?key)\s*[:=]\s*["'][^"']{8,}/i.test(combined), false);
});

test("architecture records the required security, restore, rollout, and owner gates", () => {
  const normalizedArchitecture = architecture.replace(/\s+/g, " ");
  for (const phrase of [
    "S3 Object Lock Governance mode",
    "customer-managed KMS key",
    "two fresh, isolated, quarantined non-Production restore cycles",
    "AWS Pricing Calculator",
    "Database > Backups",
    "separately approved retention/decommission procedure",
    "does not authorize account creation",
  ]) {
    assert.match(
      normalizedArchitecture,
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});

test("only official provider references are used for the provider decision", () => {
  const links = [...architecture.matchAll(/https:\/\/[^)\s]+/g)].map(([link]) => link);
  assert.ok(links.length >= 8);
  assert.equal(
    links.every((link) =>
      link.startsWith("https://supabase.com/") ||
      link.startsWith("https://aws.amazon.com/") ||
      link.startsWith("https://docs.aws.amazon.com/")),
    true,
  );
});
