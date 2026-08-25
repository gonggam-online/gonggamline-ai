import { createHash } from "node:crypto";

import { DomeggookSupplierCatalogAdapter } from "../lib/domeggook/client";
import { DomeggookError } from "../lib/domeggook/errors";
import {
  ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
  calculateItemSelectionProfitability,
  mapSupplierProfitabilityFacts,
  toItemSelectionProfitabilityPolicyInput,
  type ItemSelectionProfitabilityInput,
  type MoneyFact,
} from "../lib/revenue/item-selection-profitability";
import type { AdminGuardContext } from "../lib/auth/admin-request-guard.server";
import { SupplierCatalogService } from "./supplier-catalog.service";
import {
  loadItemSelectionMarketEnrichment,
  type MarketEnrichmentRecord,
} from "./item-selection-market-enrichment.service";
import {
  ITEM_SELECTION_EVALUATOR_VERSION,
  ITEM_SELECTION_HARD_GATES,
  ITEM_SELECTION_RULESET_VERSION,
  compareItemSelectionEvaluations,
  evaluateItemSelection,
  type ItemSelectionScoreInputs,
} from "../shared/domain/item-selection";
import type { SupplierCatalogItem } from "../shared/domain/supplier-catalog";
import { enrichItemSelectionScores } from "../shared/domain/item-selection-market-enrichment";
import {
  ITEM_SELECTION_CANDIDATE_FAILURES_SCHEMA_VERSION,
  ITEM_SELECTION_EVIDENCE_SCHEMA_VERSION,
  ITEM_SELECTION_PERSISTENCE_SCHEMA_VERSION,
  ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION,
  type ItemSelectionEvaluationWriteV1,
  type ItemSelectionRunDtoV1,
} from "../shared/contracts/item-selection-persistence";

export type RunItemSelectionRequestV1 = Readonly<{
  provider: "domeggook";
  keyword: string;
  size: 10 | 20 | 30;
  proposedSalePriceKrw?: number;
  costProfileVersion?: string;
  retryOfRunId?: string;
  marketIntelligenceMode?: "OFF" | "ENRICH";
}>;

export class ItemSelectionWorkflowError extends Error {
  constructor(readonly code: "PROVIDER_UNAVAILABLE" | "INTERNAL_ERROR") {
    super("Item Selection workflow failed.");
    this.name = "ItemSelectionWorkflowError";
  }
}

type Dependencies = Readonly<{
  catalog?: SupplierCatalogService;
  clock?: () => number;
  createRun?: typeof import("./item-selection-run.repository")["createItemSelectionRun"];
  finalizeRun?: typeof import("./item-selection-run.repository")["finalizeItemSelectionRun"];
  loadMarketEnrichment?: typeof loadItemSelectionMarketEnrichment;
}>;

const EMPTY_SCORES: ItemSelectionScoreInputs = Object.freeze({
  competitiveness: { status: "UNAVAILABLE", missingFacts: ["competitionAnalysis"] },
  profitability: { status: "UNAVAILABLE", missingFacts: ["completeProfitability"] },
  demand: { status: "UNAVAILABLE", missingFacts: ["measuredDemand"] },
  conversionPotential: { status: "UNAVAILABLE", missingFacts: ["conversionEvidence"] },
  logisticsFit: { status: "UNAVAILABLE", missingFacts: ["logisticsEvidence"] },
  supplyStability: { status: "UNAVAILABLE", missingFacts: ["longitudinalSupplyEvidence"] },
});

const MARKET_ENRICHMENT_TIMEOUT_MS = 5_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ITEM_SELECTION_STAGE_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requestFingerprint(
  context: AdminGuardContext,
  request: RunItemSelectionRequestV1,
): { normalizedKeyword: string; marketMode: "OFF" | "ENRICH"; fingerprint: string } {
  const normalizedKeyword = request.keyword.trim().replace(/\s+/g, " ");
  const marketMode = request.marketIntelligenceMode ?? "OFF";
  const fingerprint = sha256(stableJson({
    requester: context.administratorUserId,
    provider: request.provider,
    keyword: normalizedKeyword,
    size: request.size,
    proposedSalePriceKrw: request.proposedSalePriceKrw ?? null,
    costProfileVersion: request.costProfileVersion ?? null,
    marketIntelligenceMode: marketMode,
    rulesetVersion: ITEM_SELECTION_RULESET_VERSION,
  }));
  return { normalizedKeyword, marketMode, fingerprint };
}

/** Creates the durable RUNNING intent without doing provider work. */
export async function createItemSelectionRunIntent(
  context: AdminGuardContext,
  request: RunItemSelectionRequestV1,
  idempotencyKeyHash: string,
): Promise<Readonly<{ run: ItemSelectionRunDtoV1; created: boolean }>> {
  const { normalizedKeyword, fingerprint } = requestFingerprint(context, request);
  const repository = await import("./item-selection-run.repository");
  return repository.createItemSelectionRun(context, {
    provider: request.provider,
    keyword: normalizedKeyword,
    requestedSize: request.size,
    rulesetVersion: ITEM_SELECTION_RULESET_VERSION,
    evaluatorVersion: ITEM_SELECTION_EVALUATOR_VERSION,
    profitabilityPolicyVersion: ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
    profitabilityCalculationContractVersion:
      ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION,
    requestFingerprint: fingerprint,
    idempotencyKeyHash,
    retryOfRunId: request.retryOfRunId ?? null,
    requestedByPrincipalId: context.administratorUserId,
  });
}

function missingMoney(id: string): MoneyFact {
  return {
    id,
    amountKrw: null,
    sourceType: "OPERATOR_INPUT",
    sourceReference: null,
    effectiveFrom: null,
    vatTreatment: "VAT_EXCLUSIVE",
    includedIn: [],
    confirmationStatus: "MISSING",
  };
}

function profitabilityInput(
  item: SupplierCatalogItem,
  providerFacts: ReturnType<typeof mapSupplierProfitabilityFacts>,
  request: RunItemSelectionRequestV1,
  observedAt: string,
): ItemSelectionProfitabilityInput {
  const price = request.proposedSalePriceKrw;
  return {
    finalSellingPrice: price === undefined
      ? missingMoney("finalSellingPrice")
      : {
          id: "finalSellingPrice",
          amountKrw: price,
          sourceType: "OPERATOR_INPUT",
          sourceReference: "item-selection-run-request",
          effectiveFrom: observedAt,
          vatTreatment: "VAT_INCLUSIVE_NON_DEDUCTIBLE",
          includedIn: [],
          confirmationStatus: "CONFIRMED",
        },
    supplierUnitCost: providerFacts.supplierUnitCost,
    minimumOrderQuantity: item.minimumOrderQuantity,
    marketplaceFeeRate: null,
    fulfillment: { normalized: null, currentEffective: null },
    variableCosts: [
      missingMoney("inboundInspectionStorage"),
      missingMoney("pickPackPackagingLabelSet"),
      {
        ...providerFacts.supplierShippingCost,
        id: "supplierToFulfillmentInbound",
        includedIn: [],
      },
      missingMoney("otherOrderVariableCost"),
    ],
    advertisingActual: { rate: null, observedDays: 0, validOrders: 0 },
    returnLoss: {
      category: "SIMPLE_DURABLE",
      actualRate: null,
      observedDays: 0,
      observedCases: 0,
    },
  };
}

function toWrite(
  item: SupplierCatalogItem,
  originalPosition: number,
  request: RunItemSelectionRequestV1,
  observedAt: string,
  marketEnrichment: MarketEnrichmentRecord | null,
): Readonly<{
  write: ItemSelectionEvaluationWriteV1;
  evaluation: ReturnType<typeof evaluateItemSelection>;
}> {
  const providerFacts = mapSupplierProfitabilityFacts(item, {
    observedAt,
    supplierVatTreatment: "VAT_INCLUSIVE_NON_DEDUCTIBLE",
    shippingVatTreatment: "VAT_INCLUSIVE_NON_DEDUCTIBLE",
  });
  const profitInput = profitabilityInput(item, providerFacts, request, observedAt);
  const profitResult = calculateItemSelectionProfitability(profitInput);
  const evaluatorInput = {
    providerItemNumber: item.providerItemId,
    originalPosition,
    hardGates: ITEM_SELECTION_HARD_GATES.map((gate) => ({
      gate,
      status: "UNKNOWN" as const,
      reasonCode: "PROVIDER_FACT_UNAVAILABLE",
      policyReasonCode: null,
      evidence: [],
      missingFacts: [`rights.${gate}`],
    })),
    scores: marketEnrichment
      ? enrichItemSelectionScores(EMPTY_SCORES, marketEnrichment.metric)
      : EMPTY_SCORES,
    profitability: toItemSelectionProfitabilityPolicyInput(profitResult),
  };
  const evaluatorOutput = evaluateItemSelection(evaluatorInput);
  const stages = {
    providerFacts: stableJson(providerFacts),
    profitabilityInput: stableJson(profitInput),
    profitabilityResult: stableJson(profitResult),
    evaluatorInput: stableJson(evaluatorInput),
    evaluatorOutput: stableJson(evaluatorOutput),
  };
  const stageHashes = {
    providerFacts: sha256(stages.providerFacts),
    profitabilityInput: sha256(stages.profitabilityInput),
    profitabilityResult: sha256(stages.profitabilityResult),
    evaluatorInput: sha256(stages.evaluatorInput),
    evaluatorOutput: sha256(stages.evaluatorOutput),
  };
  const hashes = {
    ...stageHashes,
    aggregate: sha256(stableJson({
      schemaVersion: ITEM_SELECTION_PERSISTENCE_SCHEMA_VERSION,
      rulesetVersion: ITEM_SELECTION_RULESET_VERSION,
      evaluatorVersion: ITEM_SELECTION_EVALUATOR_VERSION,
      profitabilityPolicyVersion: ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
      profitabilityCalculationContractVersion:
        ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION,
      providerItemNumber: item.providerItemId,
      originalPosition,
      hashes: stageHashes,
    })),
  };
  const snapshot = {
    schemaVersion: ITEM_SELECTION_PERSISTENCE_SCHEMA_VERSION,
    rulesetVersion: ITEM_SELECTION_RULESET_VERSION,
    evaluatorVersion: ITEM_SELECTION_EVALUATOR_VERSION,
    profitabilityPolicyVersion: ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
    profitabilityCalculationContractVersion:
      ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION,
    providerFacts,
    profitabilityInput: profitInput,
    profitabilityResult: profitResult,
    evaluatorInput,
    evaluatorOutput,
    hashes,
    originalPosition,
  };
  const evidence = {
    schemaVersion: ITEM_SELECTION_EVIDENCE_SCHEMA_VERSION,
    provider: "domeggook",
    providerItemNumber: item.providerItemId,
    observedAt,
    facts: {
      supplierPriceKrw: item.supplierPriceKrw,
      shippingFeeKrw: item.shippingFeeKrw,
      minimumOrderQuantity: item.minimumOrderQuantity,
      stockStatus: item.stockStatus,
      productUrl: item.productUrl,
    },
    rightsEvidence: [],
  };
  const normalized = profitResult.scenarios.normalizedScenario;
  const write: ItemSelectionEvaluationWriteV1 = {
    providerItemNumber: item.providerItemId,
    originalPosition,
    verdict: evaluatorOutput.verdict,
    totalScoreUnits: evaluatorOutput.score.totalScore === null
      ? null
      : Math.round(evaluatorOutput.score.totalScore * 10_000),
    coverageUnits: Math.round(evaluatorOutput.score.scoreCoverage * 1_000_000),
    normalizedMarginUnits: normalized === null
      ? null
      : Math.round(normalized.contributionMarginRateRaw * 1_000_000),
    normalizedProfitKrwMicros: normalized === null
      ? null
      : BigInt(Math.round(normalized.contributionProfitRawKrw * 1_000_000)),
    canonicalSnapshotText: stableJson(snapshot),
    canonicalEvidenceText: stableJson(evidence),
  };
  return { write, evaluation: evaluatorOutput };
}

export async function runItemSelection(
  context: AdminGuardContext,
  request: RunItemSelectionRequestV1,
  idempotencyKeyHash: string,
  dependencies: Dependencies = {},
): Promise<Readonly<{ run: ItemSelectionRunDtoV1; created: boolean }>> {
  const clock = dependencies.clock ?? Date.now;
  const catalog = dependencies.catalog ?? new SupplierCatalogService(
    new DomeggookSupplierCatalogAdapter(),
  );
  const repository = dependencies.createRun && dependencies.finalizeRun
    ? null
    : await import("./item-selection-run.repository");
  const createRun = dependencies.createRun ?? repository!.createItemSelectionRun;
  const finalizeRun = dependencies.finalizeRun ?? repository!.finalizeItemSelectionRun;
  const { normalizedKeyword, marketMode, fingerprint } = requestFingerprint(context, request);
  const created = await createRun(context, {
    provider: request.provider,
    keyword: normalizedKeyword,
    requestedSize: request.size,
    rulesetVersion: ITEM_SELECTION_RULESET_VERSION,
    evaluatorVersion: ITEM_SELECTION_EVALUATOR_VERSION,
    profitabilityPolicyVersion: ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
    profitabilityCalculationContractVersion:
      ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION,
    requestFingerprint: fingerprint,
    idempotencyKeyHash,
    retryOfRunId: request.retryOfRunId ?? null,
    requestedByPrincipalId: context.administratorUserId,
  });
  if (!created.created || created.run.status !== "RUNNING") return created;

  let items: readonly SupplierCatalogItem[];
  try {
    const result = await catalog.searchItems(normalizedKeyword, 1, request.size);
    const seen = new Set<string>();
    items = result.items.filter((item) => {
      if (seen.has(item.providerItemId)) return false;
      seen.add(item.providerItemId);
      return true;
    }).slice(0, request.size);
  } catch (error) {
    const providerError = error instanceof DomeggookError
      ? error
      : new DomeggookError("PROVIDER_ERROR", { cause: error });
    const failed = await finalizeRun(context, {
      runId: created.run.id,
      terminalStatus: "FAILED",
      expectedRequestFingerprint: fingerprint,
      expectedRulesetVersion: ITEM_SELECTION_RULESET_VERSION,
      expectedEvaluatorVersion: ITEM_SELECTION_EVALUATOR_VERSION,
      expectedProfitabilityPolicyVersion: ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
      expectedProfitabilityCalculationContractVersion:
        ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION,
      evaluations: [],
      candidateFailuresCanonicalText: stableJson({
        schemaVersion: ITEM_SELECTION_CANDIDATE_FAILURES_SCHEMA_VERSION,
        failures: [],
      }),
      observedCandidateCount: 0,
      successfullyEvaluatedCount: 0,
      failedCandidateCount: 0,
      skippedCandidateCount: 0,
      failureCode: providerError.code,
      requestedByPrincipalId: context.administratorUserId,
    });
    throw new ItemSelectionWorkflowError(
      failed.status === "FAILED" ? "PROVIDER_UNAVAILABLE" : "INTERNAL_ERROR",
    );
  }

  const observedAt = new Date(clock()).toISOString();
  let marketByProviderItem = new Map<string, MarketEnrichmentRecord>();
  if (marketMode === "ENRICH") {
    try {
      marketByProviderItem = new Map(await withTimeout(
        (dependencies.loadMarketEnrichment ?? loadItemSelectionMarketEnrichment)(items.map((item) => item.providerItemId)),
        MARKET_ENRICHMENT_TIMEOUT_MS,
      ));
    } catch {
      marketByProviderItem = new Map();
    }
  }
  const evaluations: Array<Readonly<{
    write: ItemSelectionEvaluationWriteV1;
    evaluation: ReturnType<typeof evaluateItemSelection>;
  }>> = [];
  const failures: Array<{
    providerItemNumber: string;
    originalPosition: number;
    failureStage: string;
    code: string;
    retryable: boolean;
    evidenceReference: null;
  }> = [];
  items.forEach((item, index) => {
    try {
      evaluations.push(toWrite(item, index, request, observedAt, marketByProviderItem.get(item.providerItemId) ?? null));
    } catch {
      failures.push({
        providerItemNumber: item.providerItemId,
        originalPosition: index,
        failureStage: "EVALUATION",
        code: "EVALUATION_FAILED",
        retryable: false,
        evidenceReference: null,
      });
    }
  });
  evaluations.sort((left, right) => compareItemSelectionEvaluations(left.evaluation, right.evaluation));
  const persistedEvaluations = evaluations.map(({ write }) => write);
  const terminalStatus = evaluations.length === 0 && failures.length > 0
    ? "FAILED"
    : failures.length > 0
      ? "PARTIAL"
      : "COMPLETED";
  const run = await finalizeRun(context, {
    runId: created.run.id,
    terminalStatus,
    expectedRequestFingerprint: fingerprint,
    expectedRulesetVersion: ITEM_SELECTION_RULESET_VERSION,
    expectedEvaluatorVersion: ITEM_SELECTION_EVALUATOR_VERSION,
    expectedProfitabilityPolicyVersion: ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
    expectedProfitabilityCalculationContractVersion:
      ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION,
    evaluations: persistedEvaluations,
    candidateFailuresCanonicalText: stableJson({
      schemaVersion: ITEM_SELECTION_CANDIDATE_FAILURES_SCHEMA_VERSION,
      failures,
    }),
    observedCandidateCount: items.length,
    successfullyEvaluatedCount: evaluations.length,
    failedCandidateCount: failures.length,
    skippedCandidateCount: 0,
    failureCode: terminalStatus === "FAILED" ? "EVALUATION_FAILED" : null,
    requestedByPrincipalId: context.administratorUserId,
  });
  return Object.freeze({ run, created: true });
}
