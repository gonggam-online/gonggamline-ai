import assert from "node:assert/strict";
import test from "node:test";

import { DomeggookError } from "../lib/domeggook/errors.ts";
import type { AdminGuardContext } from "../lib/auth/admin-request-guard.server.ts";
import { SupplierCatalogService } from "../services/supplier-catalog.service.ts";
import type { MarketEnrichmentRecord } from "../services/item-selection-market-enrichment.service.ts";
import { runItemSelection } from "../services/item-selection-workflow.service.ts";
import type {
  FinalizeItemSelectionRunWriteV1,
  ItemSelectionRunDtoV1,
  ItemSelectionRunWriteV1,
} from "../shared/contracts/item-selection-persistence.ts";
import type {
  SupplierCatalogItem,
  SupplierCatalogPort,
} from "../shared/domain/supplier-catalog.ts";

const context = {
  administratorUserId: "00000000-0000-4000-8000-000000000001",
  aal: "aal2",
  jwtIssuedAt: 1,
  sessionIdentity: "session",
  route: "/api/admin/item-selection/runs",
  correlationId: "00000000-0000-4000-8000-000000000002",
} as AdminGuardContext;

function item(index: number, providerItemId = String(1000 + index)): SupplierCatalogItem {
  return {
    provider: "domeggook",
    providerItemId,
    name: `item-${index}`,
    supplierPriceKrw: 5_000 + index,
    shippingFeeKrw: 3_000,
    minimumOrderQuantity: 1,
    stockStatus: "in_stock",
    thumbnailUrl: null,
    productUrl: `https://domeggook.com/item/${providerItemId}`,
    supplierId: null,
    supplierName: null,
    availableOnDomeggook: true,
    supplyAvailable: true,
  };
}

function run(overrides: Partial<ItemSelectionRunDtoV1> = {}): ItemSelectionRunDtoV1 {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    provider: "domeggook",
    keyword: "테스트 상품",
    requestedSize: 30,
    status: "RUNNING",
    rulesetVersion: "gonggamline-item-selection-v2",
    evaluatorVersion: "item-selection-evaluator-v2",
    profitabilityPolicyVersion: "gonggamline-profitability-2026-07-27-v1",
    profitabilityCalculationContractVersion: "gonggamline-profitability-calculation-v1",
    requestFingerprint: "a".repeat(64),
    retryOfRunId: null,
    startedAt: "2026-08-03T00:00:00.000Z",
    completedAt: null,
    failureCode: null,
    observedCandidateCount: 0,
    successfullyEvaluatedCount: 0,
    persistedEvaluationCount: 0,
    failedCandidateCount: 0,
    skippedCandidateCount: 0,
    candidateFailuresSha256: "b".repeat(64),
    createdAt: "2026-08-03T00:00:00.000Z",
    evaluations: [],
    ...overrides,
  };
}

function catalog(items: readonly SupplierCatalogItem[], calls: number[]): SupplierCatalogService {
  const port: SupplierCatalogPort = {
    async searchItems(_keyword, page, size) {
      calls.push(size ?? 0);
      return {
        provider: "domeggook",
        items: [...items],
        pagination: { page: page ?? 1, size: size ?? 20, totalItems: items.length, hasNextPage: false },
      };
    },
    async getItem() {
      throw new Error("detail enrichment is not needed by the approved v1 facts");
    },
  };
  return new SupplierCatalogService(port);
}

test("size 30 is one bounded provider list call and one atomic finalization", async () => {
  const calls: number[] = [];
  let createdInput: ItemSelectionRunWriteV1 | undefined;
  let finalizedInput: FinalizeItemSelectionRunWriteV1 | undefined;
  const result = await runItemSelection(context, {
    provider: "domeggook",
    keyword: "테스트 상품",
    size: 30,
    proposedSalePriceKrw: 20_000,
  }, "c".repeat(64), {
    catalog: catalog(Array.from({ length: 30 }, (_, index) => item(index)), calls),
    clock: () => Date.parse("2026-08-03T00:00:01.000Z"),
    async createRun(_context, input) {
      createdInput = input;
      return { run: run({ requestFingerprint: input.requestFingerprint }), created: true };
    },
    async finalizeRun(_context, input) {
      finalizedInput = input;
      return run({
        status: input.terminalStatus,
        observedCandidateCount: input.observedCandidateCount,
        successfullyEvaluatedCount: input.successfullyEvaluatedCount,
        persistedEvaluationCount: input.evaluations.length,
        failedCandidateCount: input.failedCandidateCount,
      });
    },
  });

  assert.deepEqual(calls, [30]);
  assert.equal(createdInput?.requestedSize, 30);
  assert.equal(finalizedInput?.terminalStatus, "COMPLETED");
  assert.equal(finalizedInput?.evaluations.length, 30);
  assert(finalizedInput?.evaluations.every(({ verdict }) => verdict === "CONDITIONAL"));
  assert(finalizedInput?.evaluations.every(({ coverageUnits }) => coverageUnits === 1_000_000));
  assert(finalizedInput?.evaluations.every(({ canonicalSnapshotText }) => canonicalSnapshotText.length < 100_000));
  const firstSnapshot = JSON.parse(finalizedInput?.evaluations[0]?.canonicalSnapshotText ?? "{}") as {
    profitabilityInput?: { variableCosts?: Array<{ id?: string; amountKrw?: number | null }> };
  };
  const supplierInbound = firstSnapshot.profitabilityInput?.variableCosts?.find(
    ({ id }) => id === "supplierToFulfillmentInbound",
  );
  assert.equal(supplierInbound?.amountKrw, 3_000);
  assert(finalizedInput?.evaluations.every(({ normalizedProfitKrwMicros }) => normalizedProfitKrwMicros !== null));
  assert.equal(result.run.persistedEvaluationCount, 30);
});

test("enriches missing public cost fields from a bounded detail read before scoring", async () => {
  let finalized: FinalizeItemSelectionRunWriteV1 | undefined;
  const listed = item(0);
  listed.shippingFeeKrw = null;
  listed.minimumOrderQuantity = null;
  const detailCalls: string[] = [];
  const port: SupplierCatalogPort = {
    async searchItems() {
      return {
        provider: "domeggook",
        items: [listed],
        pagination: { page: 1, size: 10, totalItems: 1, hasNextPage: false },
      };
    },
    async getItem(itemNo) {
      detailCalls.push(itemNo);
      return { status: "found", item: { ...listed, shippingFeeKrw: 3_000, minimumOrderQuantity: 6 } };
    },
  };
  await runItemSelection(context, {
    provider: "domeggook",
    keyword: "테스트 상품",
    size: 10,
  }, "e".repeat(64), {
    catalog: new SupplierCatalogService(port),
    async createRun(_context, input) {
      return { run: run({ requestFingerprint: input.requestFingerprint }), created: true };
    },
    async finalizeRun(_context, input) {
      finalized = input;
      return run({ status: input.terminalStatus, persistedEvaluationCount: input.evaluations.length });
    },
  });
  assert.deepEqual(detailCalls, [listed.providerItemId]);
  const snapshot = JSON.parse(finalized?.evaluations[0]?.canonicalSnapshotText ?? "{}") as {
    profitabilityResult?: { discoveryProfitabilityEstimate?: { costsPerUnitKrw?: { supplierInboundBase?: number } } };
  };
  assert.equal(snapshot.profitabilityResult?.discoveryProfitabilityEstimate?.costsPerUnitKrw?.supplierInboundBase, 500);
});

test("market-enriched evaluations preserve deterministic source identity order for atomic persistence", async () => {
  let finalized: FinalizeItemSelectionRunWriteV1 | undefined;
  const items = [item(0, "1000"), item(1, "1001"), item(2, "1002")];
  const market: ReadonlyMap<string, MarketEnrichmentRecord> = new Map([
    ["1000", { marketProductId: 10, observedAt: "2026-08-03T00:00:00.000Z", metric: { opportunityScore: 40, demandScore: 40, growthScore: 40, supplyScore: 40, confidence: 40 } }],
    ["1001", { marketProductId: 11, observedAt: "2026-08-03T00:00:00.000Z", metric: { opportunityScore: 90, demandScore: 90, growthScore: 90, supplyScore: 90, confidence: 90 } }],
    ["1002", { marketProductId: 12, observedAt: "2026-08-03T00:00:00.000Z", metric: { opportunityScore: 70, demandScore: 70, growthScore: 70, supplyScore: 70, confidence: 70 } }],
  ]);
  await runItemSelection(context, {
    provider: "domeggook",
    keyword: "테스트 상품",
    size: 10,
    marketIntelligenceMode: "ENRICH",
  }, "m".repeat(64), {
    catalog: catalog(items, []),
    async loadMarketEnrichment() { return market; },
    async createRun(_context, input) {
      return { run: run({ requestFingerprint: input.requestFingerprint }), created: true };
    },
    async finalizeRun(_context, input) {
      finalized = input;
      return run({ status: input.terminalStatus, persistedEvaluationCount: input.evaluations.length });
    },
  });
  const providerOrder = (finalized?.evaluations ?? []).map((evaluation) => evaluation.providerItemNumber);
  assert.deepEqual(providerOrder, ["1000", "1001", "1002"]);
  assert.deepEqual(
    (finalized?.evaluations ?? []).map((evaluation) => evaluation.originalPosition),
    [0, 1, 2],
  );
});

test("deduplicates before observation and persists a partial run for item-scoped failure", async () => {
  let finalized: FinalizeItemSelectionRunWriteV1 | undefined;
  await runItemSelection(context, {
    provider: "domeggook",
    keyword: "테스트 상품",
    size: 10,
  }, "d".repeat(64), {
    catalog: catalog([item(0), item(1, "1000"), item(2, "invalid")], []),
    async createRun(_context, input) {
      return { run: run({ requestFingerprint: input.requestFingerprint }), created: true };
    },
    async finalizeRun(_context, input) {
      finalized = input;
      return run({ status: input.terminalStatus });
    },
  });
  assert.equal(finalized?.observedCandidateCount, 2);
  assert.equal(finalized?.successfullyEvaluatedCount, 1);
  assert.equal(finalized?.failedCandidateCount, 1);
  assert.equal(finalized?.terminalStatus, "PARTIAL");
  assert.doesNotMatch(finalized?.candidateFailuresCanonicalText ?? "", /Error|stack|테스트 상품/);
});

test("provider failure is persisted and returned as a terminal FAILED run", async () => {
  let terminal: string | undefined;
  const failingCatalog = new SupplierCatalogService({
    async searchItems() { throw new DomeggookError("TIMEOUT"); },
    async getItem() { return { status: "not_found", item: null }; },
  });
  const result = await runItemSelection(
    context,
    { provider: "domeggook", keyword: "테스트 상품", size: 10 },
    "e".repeat(64),
    {
      catalog: failingCatalog,
      async createRun(_context, input) {
        return { run: run({ requestFingerprint: input.requestFingerprint }), created: true };
      },
      async finalizeRun(_context, input) {
        terminal = input.terminalStatus;
        return run({ status: input.terminalStatus });
      },
    },
  );
  assert.equal(terminal, "FAILED");
  assert.equal(result.run.status, "FAILED");
});

test("a rejected result packet is immediately finalized as FAILED instead of remaining RUNNING", async () => {
  const finalizations: FinalizeItemSelectionRunWriteV1[] = [];
  const result = await runItemSelection(context, {
    provider: "domeggook",
    keyword: "테스트 상품",
    size: 10,
  }, "9".repeat(64), {
    catalog: catalog([item(0), item(1)], []),
    async createRun(_context, input) {
      return { run: run({ requestFingerprint: input.requestFingerprint }), created: true };
    },
    async finalizeRun(_context, input) {
      finalizations.push(input);
      if (finalizations.length === 1) throw new Error("simulated atomic finalizer rejection");
      return run({
        status: input.terminalStatus,
        failureCode: input.failureCode,
        observedCandidateCount: input.observedCandidateCount,
        failedCandidateCount: input.failedCandidateCount,
      });
    },
  });

  assert.equal(finalizations.length, 2);
  assert.equal(finalizations[0]?.terminalStatus, "COMPLETED");
  assert.equal(finalizations[1]?.terminalStatus, "FAILED");
  assert.equal(finalizations[1]?.failureCode, "FINALIZATION_FAILED");
  assert.equal(finalizations[1]?.evaluations.length, 0);
  assert.equal(finalizations[1]?.failedCandidateCount, 2);
  assert.equal(result.run.status, "FAILED");
});

test("an identical idempotent replay does not call the provider or finalize again", async () => {
  let providerCalls = 0;
  let finalizeCalls = 0;
  const replay = await runItemSelection(context, {
    provider: "domeggook",
    keyword: "테스트 상품",
    size: 10,
  }, "f".repeat(64), {
    catalog: catalog([], { push() { providerCalls += 1; return 0; } } as number[]),
    async createRun() {
      return { run: run({ status: "COMPLETED" }), created: false };
    },
    async finalizeRun() {
      finalizeCalls += 1;
      return run();
    },
  });
  assert.equal(replay.created, false);
  assert.equal(providerCalls, 0);
  assert.equal(finalizeCalls, 0);
});
