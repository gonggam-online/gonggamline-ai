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
  loadCoupangMarketPriceEstimates,
} from "./coupang-market-price.service";
import type { CoupangMarketPriceEstimate } from "../shared/domain/coupang-market-price";
import {
  ITEM_SELECTION_EVALUATOR_VERSION,
  ITEM_SELECTION_HARD_GATES,
  ITEM_SELECTION_RULESET_VERSION,
  evaluateItemSelection,
} from "../shared/domain/item-selection";
import type { SupplierCatalogItem } from "../shared/domain/supplier-catalog";
import { publicCatalogOpportunityScores } from "../shared/domain/item-selection-public-signals";
import {
  estimateItemSelectionDiscoveryProfitability,
  type ItemSelectionDiscoveryProfitabilityEstimate,
} from "../shared/domain/item-selection-discovery-profitability";
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
  constructor(
    readonly code: "PROVIDER_UNAVAILABLE" | "INTERNAL_ERROR",
    options?: ErrorOptions,
  ) {
    super("Item Selection workflow failed.", options);
    this.name = "ItemSelectionWorkflowError";
  }
}

const FINALIZATION_FAILURE_CODE = "FINALIZATION_FAILED";

type Dependencies = Readonly<{
  catalog?: SupplierCatalogService;
  clock?: () => number;
  createRun?: typeof import("./item-selection-run.repository")["createItemSelectionRun"];
  finalizeRun?: typeof import("./item-selection-run.repository")["finalizeItemSelectionRun"];
  loadMarketEnrichment?: typeof loadItemSelectionMarketEnrichment;
  loadCoupangMarketPrices?: typeof loadCoupangMarketPriceEstimates;
}>;

const MARKET_ENRICHMENT_TIMEOUT_MS = 5_000;
const SUPPLIER_DETAIL_TIMEOUT_MS = 3_000;
const SUPPLIER_DETAIL_CONCURRENCY = 5;
const SUPPLIER_DETAIL_MAX_ITEMS = 5;

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

function needsDetailEnrichment(item: SupplierCatalogItem): boolean {
  return item.shippingFeeKrw === null ||
    item.minimumOrderQuantity === null ||
    item.supplierPriceKrw === null;
}

function mergeCatalogDetail(
  listed: SupplierCatalogItem,
  detailed: SupplierCatalogItem,
): SupplierCatalogItem {
  return {
    ...listed,
    name: detailed.name ?? listed.name,
    supplierPriceKrw: detailed.supplierPriceKrw ?? listed.supplierPriceKrw,
    shippingFeeKrw: detailed.shippingFeeKrw ?? listed.shippingFeeKrw,
    minimumOrderQuantity: detailed.minimumOrderQuantity ?? listed.minimumOrderQuantity,
    stockStatus: detailed.stockStatus !== "unknown" ? detailed.stockStatus : listed.stockStatus,
    thumbnailUrl: detailed.thumbnailUrl ?? listed.thumbnailUrl,
    productUrl: detailed.productUrl ?? listed.productUrl,
    supplierId: detailed.supplierId ?? listed.supplierId,
    supplierName: detailed.supplierName ?? listed.supplierName,
    availableOnDomeggook: detailed.availableOnDomeggook ?? listed.availableOnDomeggook,
    supplyAvailable: detailed.supplyAvailable ?? listed.supplyAvailable,
  };
}

async function enrichCatalogDetails(
  catalog: SupplierCatalogService,
  items: readonly SupplierCatalogItem[],
): Promise<readonly SupplierCatalogItem[]> {
  const enriched = [...items];
  const detailItemIds = new Set(items
    .filter(needsDetailEnrichment)
    .slice(0, SUPPLIER_DETAIL_MAX_ITEMS)
    .map(({ providerItemId }) => providerItemId));
  for (let offset = 0; offset < items.length; offset += SUPPLIER_DETAIL_CONCURRENCY) {
    const batch = items.slice(offset, offset + SUPPLIER_DETAIL_CONCURRENCY);
    const results = await Promise.all(batch.map(async (item) => {
      if (!detailItemIds.has(item.providerItemId)) return item;
      try {
        const detail = await withTimeout(catalog.getItem(item.providerItemId), SUPPLIER_DETAIL_TIMEOUT_MS);
        return detail.status === "found" ? mergeCatalogDetail(item, detail.item) : item;
      } catch {
        return item;
      }
    }));
    results.forEach((item, index) => { enriched[offset + index] = item; });
  }
  return Object.freeze(enriched);
}

function estimatedMoney(id: string, amountKrw: number, observedAt: string): MoneyFact {
  return {
    id,
    amountKrw,
    sourceType: "APPROVED_POLICY",
    sourceReference: "gonggamline-discovery-profitability-2026-08-25-v1",
    effectiveFrom: observedAt,
    vatTreatment: "VAT_INCLUSIVE_NON_DEDUCTIBLE",
    includedIn: [],
    confirmationStatus: "ESTIMATED",
  };
}

function notApplicableMoney(id: string): MoneyFact {
  return {
    id,
    amountKrw: null,
    sourceType: "APPROVED_POLICY",
    sourceReference: "included-in-fulfillment-estimate",
    effectiveFrom: null,
    vatTreatment: "VAT_EXCLUSIVE",
    includedIn: [],
    confirmationStatus: "NOT_APPLICABLE",
  };
}

function profitabilityInput(
  item: SupplierCatalogItem,
  providerFacts: ReturnType<typeof mapSupplierProfitabilityFacts>,
  discoveryEstimate: ItemSelectionDiscoveryProfitabilityEstimate,
  request: RunItemSelectionRequestV1,
  observedAt: string,
): ItemSelectionProfitabilityInput {
  const operatorPrice = request.proposedSalePriceKrw;
  const marketPrice = discoveryEstimate.marketSellingPrice?.status === "AVAILABLE"
    ? discoveryEstimate.marketSellingPrice.predictedSellingPriceKrw
    : null;
  return {
    finalSellingPrice: operatorPrice === undefined && marketPrice === null
      ? missingMoney("finalSellingPrice")
      : {
          id: "finalSellingPrice",
          amountKrw: operatorPrice ?? marketPrice,
          sourceType: operatorPrice === undefined ? "MARKETPLACE_PUBLIC" : "OPERATOR_INPUT",
          sourceReference: operatorPrice === undefined
            ? discoveryEstimate.marketSellingPrice?.sourceReference ?? null
            : "item-selection-run-request",
          effectiveFrom: operatorPrice === undefined
            ? discoveryEstimate.marketSellingPrice?.observedAt ?? observedAt
            : observedAt,
          vatTreatment: "VAT_INCLUSIVE_NON_DEDUCTIBLE",
          includedIn: [],
          confirmationStatus: operatorPrice === undefined ? "ESTIMATED" : "CONFIRMED",
        },
    supplierUnitCost: providerFacts.supplierUnitCost,
    minimumOrderQuantity: item.minimumOrderQuantity,
    marketplaceFeeRate: null,
    fulfillment: { normalized: null, currentEffective: null },
    variableCosts: [
      discoveryEstimate.status === "ESTIMATED"
        ? estimatedMoney("inboundInspectionStorage", discoveryEstimate.costsPerUnitKrw.inboundInspectionBase, observedAt)
        : missingMoney("inboundInspectionStorage"),
      discoveryEstimate.status === "ESTIMATED"
        ? notApplicableMoney("pickPackPackagingLabelSet")
        : missingMoney("pickPackPackagingLabelSet"),
      discoveryEstimate.status === "ESTIMATED" && discoveryEstimate.costsPerUnitKrw.supplierInboundBase !== null
        ? estimatedMoney("supplierToFulfillmentInbound", discoveryEstimate.costsPerUnitKrw.supplierInboundBase, observedAt)
        : {
            ...providerFacts.supplierShippingCost,
            id: "supplierToFulfillmentInbound",
            includedIn: [],
          },
      discoveryEstimate.status === "ESTIMATED"
        ? estimatedMoney("otherOrderVariableCost", discoveryEstimate.costsPerUnitKrw.otherBase, observedAt)
        : missingMoney("otherOrderVariableCost"),
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
  cohort: readonly SupplierCatalogItem[],
  originalPosition: number,
  request: RunItemSelectionRequestV1,
  observedAt: string,
  marketEnrichment: MarketEnrichmentRecord | null,
  coupangMarketPrice: CoupangMarketPriceEstimate | null,
): Readonly<{
  write: ItemSelectionEvaluationWriteV1;
  evaluation: ReturnType<typeof evaluateItemSelection>;
}> {
  const providerFacts = mapSupplierProfitabilityFacts(item, {
    observedAt,
    supplierVatTreatment: "VAT_INCLUSIVE_NON_DEDUCTIBLE",
    shippingVatTreatment: "VAT_INCLUSIVE_NON_DEDUCTIBLE",
  });
  const discoveryProfitabilityEstimate = estimateItemSelectionDiscoveryProfitability(item, cohort, coupangMarketPrice);
  const profitInput = profitabilityInput(item, providerFacts, discoveryProfitabilityEstimate, request, observedAt);
  const profitResult = calculateItemSelectionProfitability(profitInput);
  const evaluatorInput = {
    providerItemNumber: item.providerItemId,
    originalPosition,
    decisionLane: "DISCOVERY" as const,
    hardGates: ITEM_SELECTION_HARD_GATES.map((gate) => ({
      gate,
      status: "UNKNOWN" as const,
      reasonCode: "PROVIDER_FACT_UNAVAILABLE",
      policyReasonCode: null,
      evidence: [],
      missingFacts: [`rights.${gate}`],
    })),
    scores: marketEnrichment
      ? enrichItemSelectionScores(
          publicCatalogOpportunityScores(item, cohort, originalPosition, observedAt, coupangMarketPrice),
          marketEnrichment.metric,
        )
      : publicCatalogOpportunityScores(item, cohort, originalPosition, observedAt, coupangMarketPrice),
    profitability: toItemSelectionProfitabilityPolicyInput(profitResult),
  };
  const evaluatorOutput = evaluateItemSelection(evaluatorInput);
  const stages = {
    providerFacts: stableJson(providerFacts),
    profitabilityInput: stableJson(profitInput),
    profitabilityResult: stableJson({ ...profitResult, discoveryProfitabilityEstimate }),
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
    profitabilityResult: { ...profitResult, discoveryProfitabilityEstimate },
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
      name: item.name,
      thumbnailUrl: item.thumbnailUrl,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
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
    const listedItems = result.items.filter((item) => {
      if (seen.has(item.providerItemId)) return false;
      seen.add(item.providerItemId);
      return true;
    }).slice(0, request.size);
    items = await enrichCatalogDetails(catalog, listedItems);
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
    if (failed.status !== "FAILED") {
      throw new ItemSelectionWorkflowError("INTERNAL_ERROR");
    }
    return Object.freeze({ run: failed, created: true });
  }

  const observedAt = new Date(clock()).toISOString();
  let marketByProviderItem = new Map<string, MarketEnrichmentRecord>();
  let coupangPriceByProviderItem = new Map<string, CoupangMarketPriceEstimate>();
  if (marketMode === "ENRICH") {
    const [marketResult, coupangPriceResult] = await Promise.allSettled([
      withTimeout(
        (dependencies.loadMarketEnrichment ?? loadItemSelectionMarketEnrichment)(items.map((item) => item.providerItemId), normalizedKeyword),
        MARKET_ENRICHMENT_TIMEOUT_MS,
      ),
      (dependencies.loadCoupangMarketPrices ?? loadCoupangMarketPriceEstimates)(items, normalizedKeyword),
    ]);
    if (marketResult.status === "fulfilled") marketByProviderItem = new Map(marketResult.value);
    if (coupangPriceResult.status === "fulfilled") coupangPriceByProviderItem = new Map(coupangPriceResult.value);
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
      evaluations.push(toWrite(
        item,
        items,
        index,
        request,
        observedAt,
        marketByProviderItem.get(item.providerItemId) ?? null,
        coupangPriceByProviderItem.get(item.providerItemId) ?? null,
      ));
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
  // The database finalizer owns an immutable source-identity contract: the
  // submitted array must be ordered by the provider's original positions.
  // Ranking is a read-model concern and must never reorder this write packet.
  const persistedEvaluations = evaluations
    .map(({ write }) => write)
    .sort((left, right) => left.originalPosition - right.originalPosition);
  const terminalStatus = evaluations.length === 0 && failures.length > 0
    ? "FAILED"
    : failures.length > 0
      ? "PARTIAL"
      : "COMPLETED";
  try {
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
  } catch (finalizationError) {
    // A rejected terminal payload must not leave a durable RUNNING aggregate
    // until the 30-minute stale reconciler runs. The first RPC is atomic, so a
    // second, minimal FAILED finalization is safe when it rejected the packet.
    const terminalFailures = items.map((candidate, originalPosition) => ({
      providerItemNumber: candidate.providerItemId,
      originalPosition,
      failureStage: "FINALIZATION",
      code: FINALIZATION_FAILURE_CODE,
      retryable: true,
      evidenceReference: null,
    }));
    try {
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
          failures: terminalFailures,
        }),
        observedCandidateCount: items.length,
        successfullyEvaluatedCount: 0,
        failedCandidateCount: items.length,
        skippedCandidateCount: 0,
        failureCode: FINALIZATION_FAILURE_CODE,
        requestedByPrincipalId: context.administratorUserId,
      });
      return Object.freeze({ run: failed, created: true });
    } catch {
      throw new ItemSelectionWorkflowError("INTERNAL_ERROR", {
        cause: finalizationError,
      });
    }
  }
}
