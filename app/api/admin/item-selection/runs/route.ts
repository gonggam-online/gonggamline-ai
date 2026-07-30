import { createHash } from "node:crypto";

import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "../../../../../lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "../../../../../lib/auth/admin-rate-limit.server";
import {
  AdminCsrfError,
  verifyAdminCsrfToken,
} from "../../../../../lib/auth/csrf.server";
import {
  createItemSelectionRun,
} from "../../../../../services/item-selection-run.repository";
import {
  ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION,
  type ItemSelectionRunCreateRequestV1,
} from "../../../../../shared/contracts/item-selection-persistence";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const KEYS = [
  "provider", "keyword", "requestedSize", "rulesetVersion", "evaluatorVersion",
  "profitabilityPolicyVersion", "profitabilityCalculationContractVersion",
  "requestFingerprint", "retryOfRunId",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length >= 1 &&
    value.length <= maximum && value.trim() === value;
}

function parseBody(value: unknown): ItemSelectionRunCreateRequestV1 | null {
  if (!isRecord(value) || Object.keys(value).length !== KEYS.length ||
      KEYS.some((key) => !(key in value))) return null;
  const retry = value.retryOfRunId;
  if (
    value.provider !== "domeggook" ||
    !boundedText(value.keyword, 200) ||
    !Number.isInteger(value.requestedSize) ||
    (value.requestedSize as number) < 1 ||
    (value.requestedSize as number) > 50 ||
    !boundedText(value.rulesetVersion, 128) ||
    !boundedText(value.evaluatorVersion, 128) ||
    !boundedText(value.profitabilityPolicyVersion, 128) ||
    value.profitabilityCalculationContractVersion !==
      ITEM_SELECTION_PROFITABILITY_CALCULATION_CONTRACT_VERSION ||
    typeof value.requestFingerprint !== "string" ||
    !SHA256.test(value.requestFingerprint) ||
    (retry !== null && (typeof retry !== "string" || !UUID.test(retry)))
  ) return null;
  return value as unknown as ItemSelectionRunCreateRequestV1;
}

function errorResponse(error: unknown): Response {
  if (error instanceof AdminRequestGuardError ||
      error instanceof AdminUnsupportedMediaTypeError ||
      error instanceof AdminCsrfError) {
    return Response.json({ code: error.code }, { status: error.status });
  }
  if (isRecord(error) && error.name === "ItemSelectionRunRepositoryError") {
    const status = error.kind === "CONFLICT" ? 409 :
      error.kind === "INVALID" ? 400 : 500;
    return Response.json(
      { code: status === 409 ? "CONFLICT" : status === 400 ? "INVALID_REQUEST" : "INTERNAL_ERROR" },
      { status },
    );
  }
  return Response.json({ code: "INTERNAL_ERROR" }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "item-selection-create", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) {
      return Response.json(
        { code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || idempotencyKey.trim() !== idempotencyKey ||
        idempotencyKey.length > 200 || /[\u0000-\u001f\u007f]/.test(idempotencyKey)) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const body = parseBody(json);
    if (!body) return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });

    const result = await createItemSelectionRun(context, {
      ...body,
      idempotencyKeyHash: createHash("sha256").update(idempotencyKey, "utf8").digest("hex"),
      requestedByPrincipalId: context.administratorUserId,
    });
    return Response.json(result.run, { status: result.created ? 201 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
