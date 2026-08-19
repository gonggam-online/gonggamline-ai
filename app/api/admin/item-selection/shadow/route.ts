import {
  AdminRequestGuardError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "../../../../../lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "../../../../../lib/auth/admin-rate-limit.server";
import { readItemSelectionShadowReview } from "../../../../../services/item-selection-shadow-review.service";
import type { ItemSelectionVerdict } from "../../../../../shared/domain/item-selection";

export const runtime = "nodejs";

const VERDICTS = new Set<ItemSelectionVerdict>(["RECOMMEND", "CONDITIONAL", "MANUAL_REVIEW", "REJECT"]);
const PROFITABILITY = new Set(["CONFIRMED", "ESTIMATED", "INCOMPLETE", "NOT_EVALUATED"]);
const RIGHTS = new Set(["PASS", "UNKNOWN", "FAIL"]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(): Response {
  return Response.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "read");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    const rate = adminRateLimiter.consume(context.administratorUserId, "read");
    if (!rate.allowed) return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
    const body: unknown = await request.json();
    if (!record(body) || Object.keys(body).some((key) => ![
      "marketProductId", "providerItemNumber", "currentVerdict", "currentScore",
      "profitabilityStatus", "contributionMarginRate", "rightsStatus",
    ].includes(key))) return invalid();
    const marketProductId = body.marketProductId;
    const providerItemNumber = body.providerItemNumber;
    const currentVerdict = body.currentVerdict;
    const currentScore = body.currentScore;
    const profitabilityStatus = body.profitabilityStatus;
    const contributionMarginRate = body.contributionMarginRate;
    const rightsStatus = body.rightsStatus;
    if (!Number.isSafeInteger(marketProductId) || (marketProductId as number) < 1 ||
        typeof providerItemNumber !== "string" || !/^\d{1,20}$/.test(providerItemNumber) ||
        typeof currentVerdict !== "string" || !VERDICTS.has(currentVerdict as ItemSelectionVerdict) ||
        (currentScore !== null && (typeof currentScore !== "number" || !Number.isFinite(currentScore))) ||
        typeof profitabilityStatus !== "string" || !PROFITABILITY.has(profitabilityStatus) ||
        (contributionMarginRate !== null && (typeof contributionMarginRate !== "number" || !Number.isFinite(contributionMarginRate))) ||
        typeof rightsStatus !== "string" || !RIGHTS.has(rightsStatus)) return invalid();
    const packet = await readItemSelectionShadowReview({
      marketProductId: marketProductId as number,
      providerItemNumber,
      currentVerdict: currentVerdict as ItemSelectionVerdict,
      currentScore: currentScore as number | null,
      profitabilityStatus: profitabilityStatus as "CONFIRMED" | "ESTIMATED" | "INCOMPLETE" | "NOT_EVALUATED",
      contributionMarginRate: contributionMarginRate as number | null,
      rightsStatus: rightsStatus as "PASS" | "UNKNOWN" | "FAIL",
    });
    return Response.json({ data: packet }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminRequestGuardError) return Response.json({ error: { code: error.code } }, { status: error.status });
    if (error instanceof Error && error.message === "MARKET_SHADOW_EVIDENCE_NOT_FOUND") return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
