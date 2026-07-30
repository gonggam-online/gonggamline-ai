import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "../../../../../../../lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "../../../../../../../lib/auth/admin-rate-limit.server";
import {
  AdminCsrfError,
  verifyAdminCsrfToken,
} from "../../../../../../../lib/auth/csrf.server";
import {
  finalizeItemSelectionRun,
} from "../../../../../../../services/item-selection-run.repository";
import {
  ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION,
  type ItemSelectionEvaluationWriteV1,
  type ItemSelectionRunFinalizeRequestV1,
} from "../../../../../../../shared/contracts/item-selection-persistence";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const FAILURE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const VERDICTS = new Set(["RECOMMEND", "CONDITIONAL", "MANUAL_REVIEW", "REJECT"]);
const BODY_KEYS = [
  "terminalStatus", "expectedRequestFingerprint", "expectedRulesetVersion",
  "expectedEvaluatorVersion", "expectedProfitabilityPolicyVersion",
  "expectedProfitabilityCalculationContractVersion", "evaluations",
  "candidateFailuresCanonicalText", "observedCandidateCount",
  "successfullyEvaluatedCount", "failedCandidateCount", "skippedCandidateCount",
  "failureCode",
] as const;
const EVALUATION_KEYS = [
  "providerItemNumber", "originalPosition", "verdict", "totalScoreUnits",
  "coverageUnits", "normalizedMarginUnits", "normalizedProfitKrwMicros",
  "canonicalSnapshotText", "canonicalEvidenceText",
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}
function text(value: unknown, max = 128): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= max && value.trim() === value;
}
function nullableInteger(value: unknown, min: number, max: number): boolean {
  return value === null || (Number.isSafeInteger(value) &&
    (value as number) >= min && (value as number) <= max);
}
function evaluation(value: unknown): value is ItemSelectionEvaluationWriteV1 {
  if (!record(value) || !exact(value, EVALUATION_KEYS)) return false;
  return typeof value.providerItemNumber === "string" &&
    /^[0-9]{1,20}$/.test(value.providerItemNumber) &&
    Number.isSafeInteger(value.originalPosition) && (value.originalPosition as number) >= 0 &&
    typeof value.verdict === "string" && VERDICTS.has(value.verdict) &&
    nullableInteger(value.totalScoreUnits, 0, 1_000_000) &&
    Number.isSafeInteger(value.coverageUnits) && (value.coverageUnits as number) >= 0 &&
    (value.coverageUnits as number) <= 1_000_000 &&
    nullableInteger(value.normalizedMarginUnits, -1_000_000_000, 1_000_000_000) &&
    (value.normalizedProfitKrwMicros === null ||
      (typeof value.normalizedProfitKrwMicros === "string" &&
       /^-?(0|[1-9][0-9]*)$/.test(value.normalizedProfitKrwMicros))) &&
    text(value.canonicalSnapshotText, 1_000_000) &&
    text(value.canonicalEvidenceText, 1_000_000);
}
function parse(value: unknown): ItemSelectionRunFinalizeRequestV1 | null {
  if (!record(value) || !exact(value, BODY_KEYS) || !Array.isArray(value.evaluations) ||
      !value.evaluations.every(evaluation)) return null;
  if (!["COMPLETED", "PARTIAL", "FAILED"].includes(String(value.terminalStatus)) ||
      typeof value.expectedRequestFingerprint !== "string" ||
      !SHA256.test(value.expectedRequestFingerprint) ||
      !text(value.expectedRulesetVersion) || !text(value.expectedEvaluatorVersion) ||
      !text(value.expectedProfitabilityPolicyVersion) ||
      value.expectedProfitabilityCalculationContractVersion !==
        ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION ||
      !text(value.candidateFailuresCanonicalText, 1_000_000) ||
      !Number.isSafeInteger(value.observedCandidateCount) ||
      !Number.isSafeInteger(value.successfullyEvaluatedCount) ||
      !Number.isSafeInteger(value.failedCandidateCount) ||
      !Number.isSafeInteger(value.skippedCandidateCount) ||
      (value.observedCandidateCount as number) < 0 ||
      (value.successfullyEvaluatedCount as number) < 0 ||
      (value.failedCandidateCount as number) < 0 ||
      (value.skippedCandidateCount as number) < 0 ||
      (value.failureCode !== null &&
        (typeof value.failureCode !== "string" || !FAILURE_CODE.test(value.failureCode)))) return null;
  return {
    ...(value as unknown as Omit<ItemSelectionRunFinalizeRequestV1, "evaluations">),
    evaluations: value.evaluations.map((item) => ({
      ...item,
      normalizedProfitKrwMicros:
        item.normalizedProfitKrwMicros === null ? null : BigInt(item.normalizedProfitKrwMicros),
    } as ItemSelectionEvaluationWriteV1)),
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "item-selection-finalize", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) return Response.json(
      { code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
    const { id } = await params;
    if (!UUID.test(id)) return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const body = parse(json);
    if (!body) return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    const run = await finalizeItemSelectionRun(context, {
      ...body,
      runId: id,
      requestedByPrincipalId: context.administratorUserId,
    });
    return Response.json(run);
  } catch (error) {
    if (error instanceof AdminRequestGuardError ||
        error instanceof AdminUnsupportedMediaTypeError ||
        error instanceof AdminCsrfError) {
      return Response.json({ code: error.code }, { status: error.status });
    }
    if (record(error) && error.name === "ItemSelectionRunRepositoryError") {
      const status = error.kind === "NOT_FOUND" ? 404 :
        error.kind === "CONFLICT" ? 409 : error.kind === "INVALID" ? 400 : 500;
      const code = status === 404 ? "NOT_FOUND" : status === 409 ? "CONFLICT" :
        status === 400 ? "INVALID_REQUEST" : "INTERNAL_ERROR";
      return Response.json({ code }, { status });
    }
    return Response.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
