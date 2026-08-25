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

export interface ReconcileStaleItemSelectionRunWriteV1 {
  readonly runId: string;
  readonly expectedRequestFingerprint: Sha256Hex;
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

export interface ItemSelectionRunCreateRequestV1 {
  readonly provider: "domeggook";
  readonly keyword: string;
  readonly requestedSize: number;
  readonly rulesetVersion: string;
  readonly evaluatorVersion: string;
  readonly profitabilityPolicyVersion: string;
  readonly profitabilityCalculationContractVersion:
    typeof ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION;
  readonly requestFingerprint: Sha256Hex;
  readonly retryOfRunId: string | null;
}

export interface ItemSelectionRunFinalizeRequestV1 {
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
}

export interface ItemSelectionEvaluationDtoV1 {
  readonly evaluationId: string;
  readonly providerItemNumber: string;
  readonly originalPosition: number;
  readonly verdict: ItemSelectionVerdict;
  readonly totalScoreUnits: number | null;
  readonly coverageUnits: number;
  readonly normalizedMarginUnits: number | null;
  readonly normalizedProfitKrwMicros: string | null;
  readonly snapshotSha256: Sha256Hex;
  readonly providerEvidenceSha256: Sha256Hex;
  readonly createdAt: string;
  /** Sanitized, read-only explanation; canonical evidence text is never exposed. */
  readonly explainability: ItemSelectionEvaluationExplainabilityV1 | null;
}

export interface ItemSelectionEvaluationExplainabilityV1 {
  readonly score: {
    readonly totalScore: number | null;
    readonly availableDataScore: number | null;
    readonly scoreCoverage: number;
    readonly areas: readonly {
      readonly area: string;
      readonly status: "AVAILABLE" | "UNAVAILABLE";
      readonly normalizedScore: number | null;
      readonly weightedContribution: number | null;
    }[];
  };
  readonly profitability: {
    readonly status: "CONFIRMED" | "ESTIMATED" | "INCOMPLETE";
    readonly contributionProfitKrw: number | null;
    readonly contributionMarginRate: number | null;
    readonly estimatedFacts: readonly string[];
    readonly missingFacts: readonly string[];
    readonly nextActions: readonly string[];
    readonly discoveryEstimate: {
      readonly status: "ESTIMATED" | "UNAVAILABLE";
      readonly breakEvenSellingPriceKrw: number | null;
      readonly conditionalSellingPriceKrw: number | null;
      readonly recommendSellingPriceKrw: number | null;
      readonly supplierInboundPerUnitKrw: number | null;
      readonly inboundInspectionPerUnitKrw: number | null;
      readonly fulfillmentPerUnitKrw: number | null;
      readonly profitabilityPotentialScore: number | null;
      readonly missingActualFacts: readonly string[];
      readonly assumptions: readonly string[];
      readonly marketSellingPrice: {
        readonly status: "AVAILABLE" | "UNAVAILABLE";
        readonly matchType: "TITLE_MATCHED" | "KEYWORD_COMPARABLE" | "UNAVAILABLE";
        readonly predictedSellingPriceKrw: number | null;
        readonly lowSellingPriceKrw: number | null;
        readonly highSellingPriceKrw: number | null;
        readonly observationCount: number;
        readonly observedAt: string | null;
        readonly sourceReference: string | null;
        readonly sampleOffers: readonly {
          readonly title: string;
          readonly priceKrw: number;
          readonly url: string | null;
        }[];
      } | null;
    } | null;
  };
  readonly hardGates: readonly {
    readonly gate: string;
    readonly status: "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
    readonly reasonCode: string;
    readonly missingFacts: readonly string[];
  }[];
  readonly recommendationReasons: readonly string[];
  readonly risks: readonly string[];
  readonly missingFacts: readonly string[];
  readonly provider: {
    readonly itemNumber: string;
    readonly name: string | null;
    readonly thumbnailUrl: string | null;
    readonly supplierName: string | null;
    readonly supplierPriceKrw: number | null;
    readonly shippingFeeKrw: number | null;
    readonly minimumOrderQuantity: number | null;
    readonly stockStatus: string | null;
    readonly productUrl: string | null;
    readonly observedAt: string | null;
  };
}

export interface ItemSelectionRunDtoV1 {
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
  readonly retryOfRunId: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly failureCode: string | null;
  readonly observedCandidateCount: number;
  readonly successfullyEvaluatedCount: number;
  readonly persistedEvaluationCount: number;
  readonly failedCandidateCount: number;
  readonly skippedCandidateCount: number;
  readonly candidateFailuresSha256: Sha256Hex;
  readonly createdAt: string;
  readonly evaluations: readonly ItemSelectionEvaluationDtoV1[];
}
