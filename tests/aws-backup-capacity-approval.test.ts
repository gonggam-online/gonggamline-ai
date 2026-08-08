import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type CapacityInput = Readonly<{
  schemaVersion: string;
  status: string;
  risk: string;
  source: Readonly<{ projectRef: string; region: string }>;
  measurement: Readonly<{
    approved: boolean;
    executed: boolean;
    succeeded: boolean;
    approvalConsumed: boolean;
    attemptCount: number;
    retryApprovalConsumed: boolean;
    retryAuthorized: boolean;
    finalApprovalConsumed: boolean;
    failureClass: string | null;
    resultEvidenceAvailable: boolean;
    attempts: readonly Readonly<{
      attempt: number;
      approvalConsumed: boolean;
      outcome: string;
      failureClass: string | null;
    }>[];
    archiveCreated: boolean;
    historicalReference: Readonly<{
      archiveBytes: number;
      satisfiesCurrentGate: boolean;
    }>;
    archiveBytes: number;
    dumpDurationSeconds: number;
    archiveListEntryCount: number;
    warningCount: number;
    transientArchiveDeleted: boolean;
    credentialFileDeleted: boolean;
    temporaryDirectoryDeleted: boolean;
    containerDeleted: boolean;
    databaseMutationPerformed: boolean;
    productionStatusAfterAttempt: string;
    rawArchiveStoredRemotely: boolean;
    rowContentInspected: boolean;
  }>;
  capacity: Readonly<{
    lambdaMaximumRuntimeSeconds: number;
    lambdaMaximumEphemeralStorageMiB: number;
    stressScenarioMultiplier: number;
    lambdaEligibility: string;
    workerRehearsal: Readonly<{
      evidence: string;
      status: string;
      requiredStressArchiveBytes: number;
      rehearsalArchiveBytes: number;
      peakEphemeralBytes: number;
      workerMeasuredTotalMs: number;
      runtimeMarginMs: number;
      ephemeralMarginBytes: number;
      productionConnected: boolean;
      awsConnected: boolean;
      temporaryStateDeleted: boolean;
    }>;
    fallback: string;
  }>;
  retentionAndFrequency: Readonly<{
    dailyRetentionDays: number;
    monthlyRetentionMonths: number;
    steadyStateDailyObjects: number;
    steadyStateMonthlyObjects: number;
    steadyStateTotalObjects: number;
    observedSteadyStateStoredBytes: number;
    stressSteadyStateStoredBytes: number;
    restoreCyclesPerYear: number;
  }>;
  calculator: Readonly<{
    status: string;
    pricingAsOf: string;
    monthlyCeilingUsdIncludingTaxAndMargin: number;
    services: readonly string[];
    observedScenarioMonthlyUsd: number;
    stressScenarioMonthlyUsd: number;
    taxIncludedByCalculator: boolean;
    taxAndUncertaintyMarginUsd: number;
    ceilingAssessmentMonthlyUsd: number;
    remainingHeadroomUsd: number;
    calculatorGranularity: Readonly<{
      eventBridgeSchedulerActualMonthlyInvocations: number;
      eventBridgeSchedulerModeledMonthlyInvocations: number;
      sqsObservedActualMonthlyRequests: number;
      sqsStressActualMonthlyRequests: number;
      sqsModeledMonthlyRequests: number;
    }>;
    conditionalExclusions: Readonly<Record<string, string>>;
    estimateUrl: string;
    stressEstimateUrl: string;
    withinCeiling: boolean;
  }>;
  authorization: Readonly<Record<string, boolean>>;
}>;

const root = path.resolve(import.meta.dirname, "..");
const inputPath = path.join(root, "docs", "cloud", "aws-backup-capacity-input-v1.json");
const runbookPath = path.join(
  root,
  "docs",
  "cloud",
  "AWS-BACKUP-CAPACITY-MEASUREMENT-APPROVAL-V1.md",
);
const inputSource = readFileSync(inputPath, "utf8");
const input = JSON.parse(inputSource) as CapacityInput;
const runbook = readFileSync(runbookPath, "utf8");

test("capacity packet records a successful current measurement and consumed authority", () => {
  assert.equal(input.schemaVersion, "gonggamline-aws-backup-capacity-input-v1");
  assert.equal(
    input.status,
    "CURRENT_MEASUREMENT_AND_CALCULATOR_COMPLETE_SYNTHETIC_WORKER_REHEARSAL_SUCCEEDED",
  );
  assert.equal(input.risk, "HIGH");
  assert.equal(input.source.projectRef, "sxvtznmoemrcwifungnb");
  assert.equal(input.source.region, "ap-southeast-1");
  assert.equal(input.measurement.approved, true);
  assert.equal(input.measurement.executed, true);
  assert.equal(input.measurement.succeeded, true);
  assert.equal(input.measurement.approvalConsumed, true);
  assert.equal(input.measurement.attemptCount, 3);
  assert.equal(input.measurement.retryApprovalConsumed, true);
  assert.equal(input.measurement.retryAuthorized, false);
  assert.equal(input.measurement.finalApprovalConsumed, true);
  assert.equal(input.measurement.failureClass, null);
  assert.equal(input.measurement.resultEvidenceAvailable, true);
  assert.deepEqual(
    input.measurement.attempts.map(({ attempt, outcome, failureClass }) => ({
      attempt,
      outcome,
      failureClass,
    })),
    [
      {
        attempt: 1,
        outcome: "FAILED_CLOSED_BEFORE_ARCHIVE",
        failureClass: "EXTERNAL_CONFIGURATION_DATABASE_CREDENTIAL_AUTHENTICATION",
      },
      {
        attempt: 2,
        outcome: "RESULT_EVIDENCE_UNAVAILABLE",
        failureClass: "EXECUTION_RESULT_EVIDENCE_UNAVAILABLE",
      },
      {
        attempt: 3,
        outcome: "SUCCEEDED",
        failureClass: null,
      },
    ],
  );
  assert.equal(input.measurement.archiveCreated, true);
  assert.equal(input.measurement.archiveBytes, 715071);
  assert.equal(input.measurement.dumpDurationSeconds, 34.125);
  assert.equal(input.measurement.archiveListEntryCount, 1251);
  assert.equal(input.measurement.warningCount, 0);
  assert.equal(input.measurement.transientArchiveDeleted, true);
  assert.equal(input.measurement.credentialFileDeleted, true);
  assert.equal(input.measurement.temporaryDirectoryDeleted, true);
  assert.equal(input.measurement.containerDeleted, true);
  assert.equal(input.measurement.databaseMutationPerformed, false);
  assert.equal(input.measurement.productionStatusAfterAttempt, "HEALTHY");
  assert.equal(input.measurement.rawArchiveStoredRemotely, false);
  assert.equal(input.measurement.rowContentInspected, false);
  assert.equal(input.authorization.productionConnectionAuthorized, false);
  assert.equal(input.authorization.transientProductionArchiveAuthorized, false);
  assert.equal(input.authorization.priorOneAttemptAuthorizationConsumed, true);
  assert.equal(input.authorization.oneRetryAuthorizationConsumed, true);
  assert.equal(input.authorization.finalOneAttemptAuthorizationConsumed, true);
  assert.equal(input.authorization.retryAuthorized, false);
  for (const gate of [
    "awsProvisioningAuthorized",
    "awsPaidUseAuthorized",
    "productionUploadAuthorized",
    "restoreAuthorized",
    "scheduleAuthorized",
  ]) {
    assert.equal(input.authorization[gate], false);
  }
});

test("historical archive is reference-only while synthetic rehearsal closes Lambda capacity", () => {
  assert.equal(input.measurement.historicalReference.archiveBytes, 696310);
  assert.equal(input.measurement.historicalReference.satisfiesCurrentGate, false);
  assert.equal(input.capacity.lambdaMaximumRuntimeSeconds, 900);
  assert.equal(input.capacity.lambdaMaximumEphemeralStorageMiB, 10240);
  assert.equal(input.capacity.stressScenarioMultiplier, 2);
  assert.equal(
    input.capacity.lambdaEligibility,
    "ELIGIBLE_FOR_DISABLED_WORKER_CHANGE_SET_REVIEW_ONLY",
  );
  assert.equal(input.capacity.workerRehearsal.status, "SUCCEEDED_SYNTHETIC_ONLY");
  assert.equal(input.capacity.workerRehearsal.requiredStressArchiveBytes, 1430142);
  assert.equal(input.capacity.workerRehearsal.rehearsalArchiveBytes, 6351131);
  assert.equal(input.capacity.workerRehearsal.peakEphemeralBytes, 6351837);
  assert.equal(input.capacity.workerRehearsal.workerMeasuredTotalMs, 7901);
  assert.equal(input.capacity.workerRehearsal.runtimeMarginMs, 892099);
  assert.equal(input.capacity.workerRehearsal.ephemeralMarginBytes, 10731066403);
  assert.equal(input.capacity.workerRehearsal.productionConnected, false);
  assert.equal(input.capacity.workerRehearsal.awsConnected, false);
  assert.equal(input.capacity.workerRehearsal.temporaryStateDeleted, true);
  assert.equal(
    input.capacity.workerRehearsal.rehearsalArchiveBytes >=
      input.capacity.workerRehearsal.requiredStressArchiveBytes,
    true,
  );
  assert.equal(input.capacity.fallback, "STOP_AND_PROPOSE_FARGATE_ARCHITECTURE");
});

test("calculator evidence is complete and remains below the accepted ceiling", () => {
  assert.equal(input.calculator.status, "COMPLETED_PUBLIC_ON_DEMAND_ESTIMATES");
  assert.equal(input.calculator.pricingAsOf, "2026-08-06");
  assert.equal(input.calculator.monthlyCeilingUsdIncludingTaxAndMargin, 10);
  assert.equal(input.calculator.observedScenarioMonthlyUsd, 2.22);
  assert.equal(input.calculator.stressScenarioMonthlyUsd, 2.63);
  assert.equal(input.calculator.taxIncludedByCalculator, false);
  assert.equal(input.calculator.taxAndUncertaintyMarginUsd, 2);
  assert.equal(input.calculator.ceilingAssessmentMonthlyUsd, 4.63);
  assert.equal(input.calculator.remainingHeadroomUsd, 5.37);
  assert.equal(
    input.calculator.stressScenarioMonthlyUsd + input.calculator.taxAndUncertaintyMarginUsd,
    input.calculator.ceilingAssessmentMonthlyUsd,
  );
  assert.equal(
    input.calculator.monthlyCeilingUsdIncludingTaxAndMargin -
      input.calculator.ceilingAssessmentMonthlyUsd,
    input.calculator.remainingHeadroomUsd,
  );
  assert.match(input.calculator.estimateUrl, /^https:\/\/calculator\.aws\/#\/estimate\?id=/);
  assert.match(
    input.calculator.stressEstimateUrl,
    /^https:\/\/calculator\.aws\/#\/estimate\?id=/,
  );
  assert.notEqual(input.calculator.estimateUrl, input.calculator.stressEstimateUrl);
  assert.equal(input.calculator.withinCeiling, true);
  assert.equal(input.calculator.calculatorGranularity.eventBridgeSchedulerActualMonthlyInvocations, 32);
  assert.equal(
    input.calculator.calculatorGranularity.eventBridgeSchedulerModeledMonthlyInvocations,
    1_000_000,
  );
  assert.equal(input.calculator.calculatorGranularity.sqsObservedActualMonthlyRequests, 100);
  assert.equal(input.calculator.calculatorGranularity.sqsStressActualMonthlyRequests, 200);
  assert.equal(input.calculator.calculatorGranularity.sqsModeledMonthlyRequests, 1_000_000);
  assert.equal(input.calculator.conditionalExclusions.cloudTrailDataEvents, "EXCLUDED_NOT_ENABLED");
  assert.equal(input.retentionAndFrequency.dailyRetentionDays, 35);
  assert.equal(input.retentionAndFrequency.monthlyRetentionMonths, 12);
  assert.equal(input.retentionAndFrequency.steadyStateDailyObjects, 35);
  assert.equal(input.retentionAndFrequency.steadyStateMonthlyObjects, 12);
  assert.equal(input.retentionAndFrequency.steadyStateTotalObjects, 47);
  assert.equal(input.retentionAndFrequency.observedSteadyStateStoredBytes, 33608337);
  assert.equal(input.retentionAndFrequency.stressSteadyStateStoredBytes, 67216674);
  assert.equal(input.retentionAndFrequency.restoreCyclesPerYear, 2);
  for (const service of [
    "Amazon S3",
    "AWS Key Management Service",
    "Amazon Elastic Container Registry",
    "AWS Lambda",
    "AWS Secrets Manager",
    "Amazon EventBridge Scheduler",
    "Amazon Simple Queue Service",
    "Amazon CloudWatch",
  ]) {
    assert.ok(input.calculator.services.includes(service));
  }
});

test("runbook preserves Production, credential, cleanup, and approval boundaries", () => {
  const normalized = runbook.replace(/\s+/g, " ");
  for (const phrase of [
    "AWS 백업 Production 용량 측정 v1 승인",
    "No automatic retry is authorized",
    "A second Root MFA factor is not a v1 requirement",
    "secure deletion of the new transient measurement archive",
    "cannot authorize worker implementation or provisioning",
    "2x observed",
    "one attempt and is now consumed",
    "failed closed at database-password authentication",
    "new explicit one-attempt approval",
    "three approvals consumed",
    "result JSON",
    "zero measurement containers remain",
    "No further retry is authorized",
    "715,071 bytes",
    "34.125 seconds",
    "1,251 entries",
  ]) {
    assert.match(normalized, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("capacity artifacts contain no credential, local backup path, or account email", () => {
  const pricingEvidence = readFileSync(
    path.join(root, "docs", "cloud", "AWS-BACKUP-PRICING-ESTIMATE-V1.md"),
    "utf8",
  );
  const combined = `${inputSource}\n${runbook}\n${pricingEvidence}`;
  assert.equal(/[A-Z]:\\Dev\\backups\\/i.test(combined), false);
  assert.equal(/gonggamline1@/i.test(combined), false);
  assert.equal(/(?:gh[opsu]_|sbp_|AKIA|ASIA)[A-Za-z0-9_.-]{12,}/.test(combined), false);
  assert.equal(
    /(?:password|secret|token|access[_-]?key)\s*[:=]\s*["'][^"']{8,}/i.test(combined),
    false,
  );
});
