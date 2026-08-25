import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

import type { AdminGuardContext } from "../lib/auth/admin-request-guard.server";
import { SupplierCatalogService } from "../services/supplier-catalog.service";
import { runItemSelection } from "../services/item-selection-workflow.service";
import type { FinalizeItemSelectionRunWriteV1 } from "../shared/contracts/item-selection-persistence";
import type { SupplierCatalogPort } from "../shared/domain/supplier-catalog";

const url = process.env.REPRO_SUPABASE_URL;
const key = process.env.REPRO_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing local reproduction configuration.");
if (new URL(url).hostname !== "127.0.0.1") {
  throw new Error("Finalization RPC verification refuses non-local Supabase URLs.");
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const principal = "00000000-0000-4000-8000-000000000101";
const correlationId = crypto.randomUUID();
let createdRunId = "";
const idempotencyKeyHash = Array.from(
  crypto.getRandomValues(new Uint8Array(32)),
  (value) => value.toString(16).padStart(2, "0"),
).join("");
const context = {
  administratorUserId: principal,
  aal: "aal2",
  jwtIssuedAt: Math.floor(Date.now() / 1_000),
  sessionIdentity: "local-reproduction",
  route: "/api/admin/item-selection/runs",
  correlationId,
} as AdminGuardContext;

const catalogPort: SupplierCatalogPort = {
  async searchItems(_keyword, page = 1, size = 10) {
    return {
      provider: "domeggook",
      items: Array.from({ length: size }, (_, index) => ({
        provider: "domeggook" as const,
        // Deliberately reverse provider ids so any accidental score/id sort
        // violates the database's original-position ordering contract.
        providerItemId: String(900009 - index),
        name: `synthetic-${index}`,
        supplierPriceKrw: 5_000 + index,
        shippingFeeKrw: 3_000,
        minimumOrderQuantity: 1,
        stockStatus: "in_stock" as const,
        thumbnailUrl: null,
        productUrl: `https://domeggook.com/item/${900009 - index}`,
        supplierId: null,
        supplierName: null,
        availableOnDomeggook: true,
        supplyAvailable: true,
      })),
      pagination: { page, size, totalItems: size, hasNextPage: false },
    };
  },
  async getItem() {
    return { status: "not_found" as const, item: null };
  },
};

function runDto(status: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED", fingerprint: string) {
  return {
    id: "00000000-0000-4000-8000-000000000102",
    provider: "domeggook" as const,
    keyword: "synthetic tumbler",
    requestedSize: 10,
    status,
    rulesetVersion: "gonggamline-item-selection-v1",
    evaluatorVersion: "item-selection-evaluator-v1",
    profitabilityPolicyVersion: "gonggamline-profitability-2026-07-27-v1",
    profitabilityCalculationContractVersion: "gonggamline-profitability-calculation-v1",
    requestFingerprint: fingerprint,
    retryOfRunId: null,
    startedAt: new Date().toISOString(),
    completedAt: status === "RUNNING" ? null : new Date().toISOString(),
    failureCode: null,
    observedCandidateCount: status === "RUNNING" ? 0 : 10,
    successfullyEvaluatedCount: status === "RUNNING" ? 0 : 10,
    persistedEvaluationCount: status === "RUNNING" ? 0 : 10,
    failedCandidateCount: 0,
    skippedCandidateCount: 0,
    candidateFailuresSha256: "0".repeat(64),
    createdAt: new Date().toISOString(),
    evaluations: [],
  };
}

async function main(): Promise<void> {
const result = await runItemSelection(
  context,
  { provider: "domeggook", keyword: "synthetic tumbler", size: 10 },
  idempotencyKeyHash,
  {
    catalog: new SupplierCatalogService(catalogPort),
    async createRun(_context, input) {
      const rpc = await client.rpc("create_item_selection_run_v1", {
        p_provider: input.provider,
        p_keyword: input.keyword,
        p_requested_size: input.requestedSize,
        p_ruleset_version: input.rulesetVersion,
        p_evaluator_version: input.evaluatorVersion,
        p_profitability_policy_version: input.profitabilityPolicyVersion,
        p_profitability_calculation_contract_version:
          input.profitabilityCalculationContractVersion,
        p_request_fingerprint: input.requestFingerprint,
        p_idempotency_key_hash: input.idempotencyKeyHash,
        p_retry_of_run_id: input.retryOfRunId,
        p_requested_by_principal_id: principal,
        p_route: "/api/admin/item-selection/runs",
        p_correlation_id: correlationId,
      });
      if (rpc.error) throw rpc.error;
      createdRunId = (rpc.data as { id: string }).id;
      return { run: runDto("RUNNING", input.requestFingerprint), created: true };
    },
    async finalizeRun(_context, input: FinalizeItemSelectionRunWriteV1) {
      const rpc = await client.rpc("finalize_item_selection_run_v1", {
        p_run_id: createdRunId,
        p_terminal_status: input.terminalStatus,
        p_expected_request_fingerprint: input.expectedRequestFingerprint,
        p_expected_ruleset_version: input.expectedRulesetVersion,
        p_expected_evaluator_version: input.expectedEvaluatorVersion,
        p_expected_profitability_policy_version: input.expectedProfitabilityPolicyVersion,
        p_expected_profitability_calculation_contract_version:
          input.expectedProfitabilityCalculationContractVersion,
        p_evaluations: input.evaluations.map((evaluation) => ({
          provider_item_number: evaluation.providerItemNumber,
          original_position: evaluation.originalPosition,
          verdict: evaluation.verdict,
          total_score_units: evaluation.totalScoreUnits,
          coverage_units: evaluation.coverageUnits,
          normalized_margin_units: evaluation.normalizedMarginUnits,
          normalized_profit_krw_micros:
            evaluation.normalizedProfitKrwMicros?.toString() ?? null,
          canonical_snapshot_text: evaluation.canonicalSnapshotText,
          canonical_evidence_text: evaluation.canonicalEvidenceText,
        })),
        p_candidate_failures_canonical_text: input.candidateFailuresCanonicalText,
        p_observed_candidate_count: input.observedCandidateCount,
        p_successfully_evaluated_count: input.successfullyEvaluatedCount,
        p_failed_candidate_count: input.failedCandidateCount,
        p_skipped_candidate_count: input.skippedCandidateCount,
        p_failure_code: input.failureCode,
        p_requested_by_principal_id: principal,
        p_route: "/api/admin/item-selection/runs/[id]/finalize",
        p_correlation_id: correlationId,
      });
      if (rpc.error) {
        throw new Error(JSON.stringify({ code: rpc.error.code, message: rpc.error.message }));
      }
      return runDto(input.terminalStatus, input.expectedRequestFingerprint);
    },
  },
);

const runs = await client
  .from("item_selection_runs")
  .select("id,status,persisted_evaluation_count")
  .eq("id", createdRunId)
  .single();
if (runs.error) throw runs.error;
const evaluations = await client
  .from("item_selection_evaluations")
  .select("id", { count: "exact", head: true })
  .eq("run_id", createdRunId);
if (evaluations.error) throw evaluations.error;
const audits = await client
  .from("security_audit_events")
  .select("event_code")
  .eq("correlation_id", correlationId);
if (audits.error) throw audits.error;

assert.equal(result.run.status, "COMPLETED");
assert.equal(runs.data.status, "COMPLETED");
assert.equal(runs.data.persisted_evaluation_count, 10);
assert.equal(evaluations.count, 10);
assert.deepEqual(
  audits.data.map(({ event_code }) => event_code).sort(),
  ["ITEM_SELECTION_CREATE", "ITEM_SELECTION_FINALIZE"],
);
console.log("Item Selection finalization RPC: PASS (10 evaluations, 2 audits)");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown reproduction failure.");
  process.exitCode = 1;
});
