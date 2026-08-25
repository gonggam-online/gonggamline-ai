import { createHash } from "node:crypto";
import { after } from "next/server";

import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "../../../../../lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "../../../../../lib/auth/admin-rate-limit.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "../../../../../lib/auth/csrf.server";
import { ITEM_SELECTION_PROFITABILITY_POLICY_VERSION } from "../../../../../lib/revenue/item-selection-profitability";
import {
  listItemSelectionRuns,
  reconcileStaleItemSelectionRuns,
} from "../../../../../services/item-selection-run.repository";
import {
  createItemSelectionRunIntent,
  ItemSelectionWorkflowError,
  runItemSelection,
  type RunItemSelectionRequestV1,
} from "../../../../../services/item-selection-workflow.service";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURSOR = /^([A-Za-z0-9_-]+)$/;
const BODY_KEYS = new Set([
  "provider", "keyword", "size", "proposedSalePriceKrw", "costProfileVersion",
  "retryOfRunId", "marketIntelligenceMode",
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(value: unknown): RunItemSelectionRequestV1 | null {
  if (!record(value) || Object.keys(value).some((key) => !BODY_KEYS.has(key))) return null;
  const keyword = value.keyword;
  const price = value.proposedSalePriceKrw;
  const costProfile = value.costProfileVersion;
  const retry = value.retryOfRunId;
  const marketMode = value.marketIntelligenceMode;
  if (
    value.provider !== "domeggook" ||
    typeof keyword !== "string" || keyword.trim() !== keyword ||
    keyword.length < 2 || keyword.length > 100 ||
    ![10, 20, 30].includes(value.size as number) ||
    (price !== undefined && (!Number.isSafeInteger(price) || (price as number) < 1)) ||
    (costProfile !== undefined && costProfile !== ITEM_SELECTION_PROFITABILITY_POLICY_VERSION) ||
    (retry !== undefined && (typeof retry !== "string" || !UUID.test(retry))) ||
    (marketMode !== undefined && marketMode !== "OFF" && marketMode !== "ENRICH")
  ) return null;
  return value as RunItemSelectionRequestV1;
}

function errorResponse(error: unknown, correlationId?: string): Response {
  const details = correlationId ? { correlationId } : {};
  if (error instanceof AdminRequestGuardError ||
      error instanceof AdminUnsupportedMediaTypeError ||
      error instanceof AdminCsrfError) {
    return Response.json({ error: { code: error.code, ...details } }, { status: error.status });
  }
  if (error instanceof ItemSelectionWorkflowError) {
    return Response.json(
      { error: { code: error.code, retryable: error.code === "PROVIDER_UNAVAILABLE", ...details } },
      { status: error.code === "PROVIDER_UNAVAILABLE" ? 503 : 500 },
    );
  }
  if (record(error) && error.name === "ItemSelectionRunRepositoryError") {
    const status = error.kind === "CONFLICT" ? 409 : error.kind === "INVALID" ? 400 : 500;
    return Response.json(
      { error: { code: status === 409 ? "DUPLICATE_RUN_ACTIVE" : status === 400 ? "VALIDATION_FAILED" : "INTERNAL_ERROR", ...details } },
      { status },
    );
  }
  return Response.json({ error: { code: "INTERNAL_ERROR", ...details } }, { status: 500 });
}

function rateLimited(retryAfterSeconds: number): Response {
  return Response.json(
    { error: { code: "RATE_LIMITED" } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function POST(request: Request): Promise<Response> {
  let correlationId: string | undefined;
  try {
    const context = await requireAdminRequest(request, "mutation");
    correlationId = context.correlationId;
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "item-selection-create", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);
    const globalRate = adminRateLimiter.consume("item-selection-global", "mutation");
    if (!globalRate.allowed) return rateLimited(globalRate.retryAfterSeconds);

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || idempotencyKey.trim() !== idempotencyKey ||
        idempotencyKey.length > 200 || /[\u0000-\u001f\u007f]/.test(idempotencyKey)) {
      return Response.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
    }
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return Response.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
    }
    const body = parseBody(json);
    if (!body) return Response.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
    try {
      await reconcileStaleItemSelectionRuns(context);
    } catch {
      // Recovery is opportunistic; the requested evaluation must remain available.
    }
    const result = await createItemSelectionRunIntent(
      context,
      body,
      createHash("sha256").update(idempotencyKey, "utf8").digest("hex"),
    );
    if (result.created && result.run.status === "RUNNING") {
      after(async () => {
        try {
          await runItemSelection(
            context,
            body,
            createHash("sha256").update(idempotencyKey, "utf8").digest("hex"),
          );
        } catch (error) {
          // Never expose provider payloads or credentials. This marker keeps
          // unexpected worker failures observable while stale recovery remains
          // the last-resort process-termination boundary.
          console.error("item_selection_background_failed", {
            correlationId: context.correlationId,
            code: error instanceof ItemSelectionWorkflowError ? error.code : "INTERNAL_ERROR",
          });
        }
      });
    }
    return Response.json({ data: result.run }, {
      status: result.created ? 202 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

function decodeCursor(value: string): { startedAt: string; id: string } | null {
  if (!CURSOR.test(value) || value.length > 256) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!record(parsed) || Object.keys(parsed).length !== 2 ||
        typeof parsed.startedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed.startedAt) ||
        new Date(parsed.startedAt).toISOString() !== parsed.startedAt ||
        typeof parsed.id !== "string" || !UUID.test(parsed.id)) return null;
    return { startedAt: parsed.startedAt, id: parsed.id };
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "read");
    if (request.body !== null) return Response.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
    const rate = adminRateLimiter.consume(context.administratorUserId, "read");
    if (!rate.allowed) return rateLimited(rate.retryAfterSeconds);
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some((key) => key !== "limit" && key !== "cursor")) {
      return Response.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
    }
    const rawLimit = url.searchParams.get("limit") ?? "20";
    if (!/^[1-9][0-9]?$/.test(rawLimit)) {
      return Response.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
    }
    const limit = Number(rawLimit);
    if (limit > 50) return Response.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
    try {
      await reconcileStaleItemSelectionRuns(context);
    } catch {
      // Listing remains read-only from the operator's perspective even if
      // opportunistic recovery is temporarily unavailable.
    }
    const rawCursor = url.searchParams.get("cursor");
    const cursor = rawCursor === null ? null : decodeCursor(rawCursor);
    if (rawCursor !== null && cursor === null) {
      return Response.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
    }
    const runs = await listItemSelectionRuns(context, {
      limit,
      beforeStartedAt: cursor?.startedAt,
      beforeId: cursor?.id,
    });
    const last = runs.at(-1);
    const nextCursor = runs.length === limit && last
      ? Buffer.from(JSON.stringify({ startedAt: last.startedAt, id: last.id }), "utf8").toString("base64url")
      : null;
    return Response.json({ data: runs, page: { nextCursor } }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
