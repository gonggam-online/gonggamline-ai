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
    pointInTimeRecovery: string;
    restoreToNewProject: string;
    earliestRecoveryPoint: null;
    latestRecoveryPoint: null;
    currentRestoreEntitlement: boolean;
    proUpgradeApproved: boolean;
    proPlanBaseMonthlyPriceUsdAtDecision: number;
    proPlanActualProvisioningStatus: string;
    proSpendCapRequired: boolean;
    pointInTimeRecoveryAddOnApproved: boolean;
  }>;
  independentTargetProposal: Readonly<{
    provider: string;
    region: string;
    regionApproved: boolean;
    bucketName: null;
    publicAccess: string;
    versioning: string;
    objectLock: Readonly<{ enabled: boolean; mode: string; automationCanBypass: boolean }>;
    encryption: Readonly<{ atRest: string; keyIdentifier: null }>;
    execution: Readonly<{ worker: string; ciBackupArtifact: string }>;
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
    fallback: string;
  }>;
  costProposal: Readonly<{
    initialMonthlyCeilingUsd: number;
    ceilingScope: string;
    supabasePlanCostExcluded: boolean;
    approved: boolean;
  }>;
  requiredOwnerDecisions: readonly string[];
  approvedOwnerDecisions: readonly string[];
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

test("backup architecture remains high-risk, manually merged, and non-executing", () => {
  assert.equal(contract.schemaVersion, "gonggamline-encrypted-backup-contract-v1");
  assert.equal(contract.status, "OWNER_POLICY_APPROVED_MANUAL_MERGE_REQUIRED");
  assert.equal(contract.risk, "HIGH");
  assert.equal(contract.providerBackup.verified, true);
  assert.equal(contract.retentionProposal.accepted, true);
  assert.equal(contract.recoveryProposal.accepted, true);
  assert.equal(contract.costProposal.approved, true);
  assert.ok(contract.requiredOwnerDecisions.length >= 10);
  assert.ok(contract.forbiddenActionsInThisStory.includes("AUTO_MERGE"));
  assert.ok(contract.forbiddenActionsInThisStory.includes("CONNECT_TO_OR_EXPORT_PRODUCTION"));
});

test("owner evidence records the current fail-closed Supabase recovery gap", () => {
  assert.equal(contract.providerBackup.plan, "FREE");
  assert.equal(contract.providerBackup.scheduledBackups, "NOT_INCLUDED");
  assert.equal(contract.providerBackup.scheduledRetentionDays, 0);
  assert.equal(contract.providerBackup.pointInTimeRecovery, "NOT_ENABLED_PRO_ADD_ON");
  assert.equal(
    contract.providerBackup.restoreToNewProject,
    "NOT_ENTITLED_REQUIRES_PRO_AND_PHYSICAL_BACKUPS",
  );
  assert.equal(contract.providerBackup.earliestRecoveryPoint, null);
  assert.equal(contract.providerBackup.latestRecoveryPoint, null);
  assert.equal(contract.providerBackup.currentRestoreEntitlement, false);
  assert.equal(contract.providerBackup.proUpgradeApproved, true);
  assert.equal(contract.providerBackup.proPlanBaseMonthlyPriceUsdAtDecision, 25);
  assert.equal(contract.providerBackup.proPlanActualProvisioningStatus, "NOT_EXECUTED");
  assert.equal(contract.providerBackup.proSpendCapRequired, true);
  assert.equal(contract.providerBackup.pointInTimeRecoveryAddOnApproved, false);
  assert.ok(
    contract.requiredOwnerDecisions.includes("SUPABASE_PRO_UPGRADE_FOR_DAILY_PROVIDER_BACKUPS"),
  );
});

test("independent target is private, immutable, encrypted, and separate from CI", () => {
  assert.equal(contract.independentTargetProposal.provider, "AWS");
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
  assert.equal(contract.capacityGate.fallback, "STOP_AND_PROPOSE_FARGATE_ARCHITECTURE");
  assert.equal(contract.costProposal.initialMonthlyCeilingUsd, 10);
  assert.equal(contract.costProposal.ceilingScope, "AWS_INDEPENDENT_BACKUP_ONLY");
  assert.equal(contract.costProposal.supabasePlanCostExcluded, true);
  for (const decision of [
    "SUPABASE_PRO_UPGRADE_FOR_DAILY_PROVIDER_BACKUPS",
    "SINGAPORE_DATA_RESIDENCY",
    "USD_10_MONTHLY_COST_CEILING",
    "RETENTION_RPO_AND_RTO",
  ]) {
    assert.ok(contract.approvedOwnerDecisions.includes(decision));
  }
  for (const decision of [
    "AWS_ACCOUNT_OWNERSHIP_BILLING_MFA_AND_RECOVERY",
    "INFRASTRUCTURE_PROVISIONING",
    "FIRST_PRODUCTION_EXPORT",
    "LOCAL_BACKUP_DELETION_AFTER_PARITY",
  ]) {
    assert.ok(contract.remainingOwnerDecisions.includes(decision));
  }
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
