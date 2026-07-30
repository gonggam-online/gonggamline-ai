import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { AdminGuardContext } from "../lib/auth/admin-request-guard.server";
import { createGuardedServiceRoleClient } from "../lib/supabase/service-role.server";
import type {
  FinalizeItemSelectionRunWriteV1,
  ItemSelectionEvaluationDtoV1,
  ItemSelectionRunDtoV1,
  ItemSelectionRunWriteV1,
} from "../shared/contracts/item-selection-persistence";

class ItemSelectionRunRepositoryError extends Error {
  constructor(
    readonly kind: "CONFLICT" | "INVALID" | "NOT_FOUND" | "UNAVAILABLE",
  ) {
    super("Item Selection persistence request failed.");
    this.name = "ItemSelectionRunRepositoryError";
  }
}

type DbRecord = Record<string, unknown>;

const RUN_COLUMNS = [
  "id", "provider", "keyword", "requested_size", "status", "ruleset_version",
  "evaluator_version", "profitability_policy_version",
  "profitability_calculation_contract_version", "request_fingerprint",
  "retry_of_run_id", "started_at", "completed_at", "failure_code",
  "observed_candidate_count", "successfully_evaluated_count",
  "persisted_evaluation_count", "failed_candidate_count",
  "skipped_candidate_count", "candidate_failures_sha256", "created_at",
].join(",");

const EVALUATION_COLUMNS = [
  "id", "provider_item_number", "original_position", "verdict",
  "total_score_units", "coverage_units", "normalized_margin_units",
  "normalized_profit_krw_micros", "snapshot_sha256",
  "provider_evidence_sha256", "created_at",
].join(",");

function repositoryError(error: PostgrestError): ItemSelectionRunRepositoryError {
  if (error.code === "P0002") return new ItemSelectionRunRepositoryError("NOT_FOUND");
  if (error.code === "22023" || error.code === "22P02")
    return new ItemSelectionRunRepositoryError("INVALID");
  if (error.code === "23503" || error.code === "23505")
    return new ItemSelectionRunRepositoryError("CONFLICT");
  return new ItemSelectionRunRepositoryError("UNAVAILABLE");
}

function text(row: DbRecord, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new ItemSelectionRunRepositoryError("UNAVAILABLE");
  return value;
}

function nullableText(row: DbRecord, key: string): string | null {
  const value = row[key];
  if (value !== null && typeof value !== "string")
    throw new ItemSelectionRunRepositoryError("UNAVAILABLE");
  return value;
}

function integer(row: DbRecord, key: string): number {
  const value = row[key];
  if (!Number.isInteger(value)) throw new ItemSelectionRunRepositoryError("UNAVAILABLE");
  return value as number;
}

function mapEvaluation(row: DbRecord): ItemSelectionEvaluationDtoV1 {
  return Object.freeze({
    evaluationId: text(row, "id"),
    providerItemNumber: text(row, "provider_item_number"),
    originalPosition: integer(row, "original_position"),
    verdict: text(row, "verdict") as ItemSelectionEvaluationDtoV1["verdict"],
    totalScoreUnits: row.total_score_units === null ? null : integer(row, "total_score_units"),
    coverageUnits: integer(row, "coverage_units"),
    normalizedMarginUnits:
      row.normalized_margin_units === null ? null : integer(row, "normalized_margin_units"),
    normalizedProfitKrwMicros: nullableText(row, "normalized_profit_krw_micros"),
    snapshotSha256: text(row, "snapshot_sha256"),
    providerEvidenceSha256: text(row, "provider_evidence_sha256"),
    createdAt: text(row, "created_at"),
  });
}

async function mapRun(
  client: SupabaseClient,
  row: DbRecord,
  includeEvaluations: boolean,
): Promise<ItemSelectionRunDtoV1> {
  let evaluations: readonly ItemSelectionEvaluationDtoV1[] = [];
  if (includeEvaluations) {
    const result = await client
      .from("item_selection_evaluations")
      .select(EVALUATION_COLUMNS)
      .eq("run_id", text(row, "id"))
      .order("original_position", { ascending: true })
      .order("provider_item_number", { ascending: true });
    if (result.error) throw repositoryError(result.error);
    evaluations = Object.freeze(
      (result.data as unknown as DbRecord[]).map(mapEvaluation),
    );
  }
  return Object.freeze({
    id: text(row, "id"),
    provider: text(row, "provider") as "domeggook",
    keyword: text(row, "keyword"),
    requestedSize: integer(row, "requested_size"),
    status: text(row, "status") as ItemSelectionRunDtoV1["status"],
    rulesetVersion: text(row, "ruleset_version"),
    evaluatorVersion: text(row, "evaluator_version"),
    profitabilityPolicyVersion: text(row, "profitability_policy_version"),
    profitabilityCalculationContractVersion: text(
      row,
      "profitability_calculation_contract_version",
    ),
    requestFingerprint: text(row, "request_fingerprint"),
    retryOfRunId: nullableText(row, "retry_of_run_id"),
    startedAt: text(row, "started_at"),
    completedAt: nullableText(row, "completed_at"),
    failureCode: nullableText(row, "failure_code"),
    observedCandidateCount: integer(row, "observed_candidate_count"),
    successfullyEvaluatedCount: integer(row, "successfully_evaluated_count"),
    persistedEvaluationCount: integer(row, "persisted_evaluation_count"),
    failedCandidateCount: integer(row, "failed_candidate_count"),
    skippedCandidateCount: integer(row, "skipped_candidate_count"),
    candidateFailuresSha256: text(row, "candidate_failures_sha256"),
    createdAt: text(row, "created_at"),
    evaluations,
  });
}

export async function getItemSelectionRunById(
  context: AdminGuardContext,
  runId: string,
): Promise<ItemSelectionRunDtoV1 | null> {
  const client = createGuardedServiceRoleClient(context);
  const result = await client
    .from("item_selection_runs")
    .select(RUN_COLUMNS)
    .eq("id", runId)
    .maybeSingle();
  if (result.error) throw repositoryError(result.error);
  return result.data
    ? mapRun(client, result.data as unknown as DbRecord, true)
    : null;
}

export async function createItemSelectionRun(
  context: AdminGuardContext,
  input: ItemSelectionRunWriteV1,
): Promise<Readonly<{ run: ItemSelectionRunDtoV1; created: boolean }>> {
  const client = createGuardedServiceRoleClient(context);
  const result = await client.rpc("create_item_selection_run_v1", {
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
    p_requested_by_principal_id: context.administratorUserId,
    p_route: "/api/admin/item-selection/runs",
    p_correlation_id: context.correlationId,
  });
  if (result.error) throw repositoryError(result.error);
  const audit = await client
    .from("security_audit_events")
    .select("id")
    .eq("correlation_id", context.correlationId)
    .eq("event_code", "ITEM_SELECTION_CREATE")
    .maybeSingle();
  if (audit.error) throw repositoryError(audit.error);
  return Object.freeze({
    run: await mapRun(client, result.data as DbRecord, false),
    created: audit.data !== null,
  });
}

export async function finalizeItemSelectionRun(
  context: AdminGuardContext,
  input: FinalizeItemSelectionRunWriteV1,
): Promise<ItemSelectionRunDtoV1> {
  const client = createGuardedServiceRoleClient(context);
  const result = await client.rpc("finalize_item_selection_run_v1", {
    p_run_id: input.runId,
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
    p_requested_by_principal_id: context.administratorUserId,
    p_route: "/api/admin/item-selection/runs/[id]/finalize",
    p_correlation_id: context.correlationId,
  });
  if (result.error) throw repositoryError(result.error);
  return mapRun(client, result.data as DbRecord, true);
}
