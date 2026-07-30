import type {
  EvaluateItemSelectionInput,
  ItemSelectionEvaluation,
  ItemSelectionVerdict,
} from "../domain/item-selection";
import type {
  ItemSelectionProfitabilityInput,
  ItemSelectionProfitabilityResult,
  SanitizedProviderProfitabilityFacts,
} from "../../lib/revenue/item-selection-profitability";

export const ITEM_SELECTION_PERSISTENCE_SCHEMA_VERSION =
  "gonggamline-item-selection-snapshot-v1" as const;
export const ITEM_SELECTION_EVIDENCE_SCHEMA_VERSION =
  "gonggamline-item-selection-evidence-v1" as const;
export const ITEM_SELECTION_CANDIDATE_FAILURES_SCHEMA_VERSION =
  "gonggamline-item-selection-candidate-failures-v1" as const;
export const ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION =
  "gonggamline-profitability-calculation-v1" as const;

export type Sha256Hex = string;
export type ItemSelectionRunStatus =
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";

export interface ItemSelectionPersistenceHashesV1 {
  readonly providerFacts: Sha256Hex;
  readonly profitabilityInput: Sha256Hex;
  readonly profitabilityResult: Sha256Hex;
  readonly evaluatorInput: Sha256Hex;
  readonly evaluatorOutput: Sha256Hex;
  readonly aggregate: Sha256Hex;
}

export interface ItemSelectionPersistenceAggregateV1 {
  readonly schemaVersion: typeof ITEM_SELECTION_PERSISTENCE_SCHEMA_VERSION;
  readonly rulesetVersion: string;
  readonly evaluatorVersion: string;
  readonly profitabilityPolicyVersion: string;
  readonly profitabilityCalculationContractVersion:
    typeof ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION;
  readonly providerFacts: SanitizedProviderProfitabilityFacts;
  readonly profitabilityInput: ItemSelectionProfitabilityInput;
  readonly profitabilityResult: ItemSelectionProfitabilityResult;
  readonly evaluatorInput: EvaluateItemSelectionInput;
  readonly evaluatorOutput: ItemSelectionEvaluation;
  readonly hashes: ItemSelectionPersistenceHashesV1;
  readonly originalPosition: number;
}

export interface ItemSelectionRunWriteV1 {
  readonly provider: "domeggook";
  readonly keyword: string;
  readonly requestedSize: number;
  readonly rulesetVersion: string;
  readonly evaluatorVersion: string;
  readonly profitabilityPolicyVersion: string;
  readonly profitabilityCalculationContractVersion:
    typeof ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION;
  readonly requestFingerprint: Sha256Hex;
  readonly idempotencyKeyHash: Sha256Hex;
  readonly retryOfRunId: string | null;
  readonly requestedByPrincipalId: string;
}

export interface ItemSelectionEvaluationWriteV1 {
  readonly providerItemNumber: string;
  readonly originalPosition: number;
  readonly verdict: ItemSelectionVerdict;
  readonly totalScoreUnits: number | null;
  readonly coverageUnits: number;
  readonly normalizedMarginUnits: number | null;
  readonly normalizedProfitKrwMicros: bigint | null;
  readonly canonicalSnapshotText: string;
  readonly canonicalEvidenceText: string;
}

export interface ItemSelectionCandidateFailureV1 {
  readonly providerItemNumber: string;
  readonly originalPosition: number;
  readonly failureStage: string;
  readonly code: string;
  readonly retryable: boolean;
  readonly evidenceReference: string | null;
}

export interface ItemSelectionCandidateFailuresV1 {
  readonly schemaVersion:
    typeof ITEM_SELECTION_CANDIDATE_FAILURES_SCHEMA_VERSION;
  readonly failures: readonly ItemSelectionCandidateFailureV1[];
}

export interface FinalizeItemSelectionRunWriteV1 {
  readonly runId: string;
  readonly terminalStatus: Exclude<ItemSelectionRunStatus, "RUNNING">;
  readonly expectedRequestFingerprint: Sha256Hex;
  readonly expectedRulesetVersion: string;
  readonly expectedEvaluatorVersion: string;
  readonly expectedProfitabilityPolicyVersion: string;
  readonly expectedProfitabilityCalculationContractVersion:
    typeof ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION;
  readonly evaluations: readonly ItemSelectionEvaluationWriteV1[];
  readonly candidateFailuresCanonicalText: string;
  readonly observedCandidateCount: number;
  readonly successfullyEvaluatedCount: number;
  readonly failedCandidateCount: number;
  readonly skippedCandidateCount: number;
  readonly failureCode: string | null;
  readonly requestedByPrincipalId: string;
}

export interface ItemSelectionRunRecordV1 {
  readonly id: string;
  readonly provider: "domeggook";
  readonly keyword: string;
  readonly requestedSize: number;
  readonly status: ItemSelectionRunStatus;
  readonly rulesetVersion: string;
  readonly evaluatorVersion: string;
  readonly profitabilityPolicyVersion: string;
  readonly profitabilityCalculationContractVersion: string;
  readonly requestFingerprint: Sha256Hex;
  readonly idempotencyKeyHash: Sha256Hex;
  readonly retryOfRunId: string | null;
  readonly requestedByPrincipalId: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly failureCode: string | null;
  readonly observedCandidateCount: number;
  readonly successfullyEvaluatedCount: number;
  readonly persistedEvaluationCount: number;
  readonly failedCandidateCount: number;
  readonly skippedCandidateCount: number;
  readonly candidateFailuresCanonicalText: string;
  readonly candidateFailuresProjection: ItemSelectionCandidateFailuresV1;
  readonly candidateFailuresSha256: Sha256Hex;
  readonly createdAt: string;
}

export interface ItemSelectionPersistenceResultV1 {
  readonly runId: string;
  readonly evaluationId: string;
  readonly providerItemNumber: string;
  readonly snapshotSha256: Sha256Hex;
  readonly providerEvidenceSha256: Sha256Hex;
  readonly persistedAt: string;
}

export interface ItemSelectionRunAggregateV1 {
  readonly run: ItemSelectionRunRecordV1;
  readonly evaluations: readonly ItemSelectionPersistenceResultV1[];
}
