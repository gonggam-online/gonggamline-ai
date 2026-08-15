import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "@/lib/auth/csrf.server";
import {
  ListingCreativeOperatorServiceError,
  prepareListingCreativeOperatorDispatch,
} from "@/services/listing-creative-operator-dispatch.service";
import {
  LISTING_CREATIVE_OPERATOR_API_VERSION,
  type PrepareListingCreativeDispatchRequest,
} from "@/shared/contracts/listing-creative-operator-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512 * 1024;
const KEYS = new Set([
  "schemaVersion",
  "listingInput",
  "commerce",
  "reprepareExpiredPlanReference",
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parse(value: unknown): PrepareListingCreativeDispatchRequest | null {
  if (
    !record(value)
    || Object.keys(value).some((key) => !KEYS.has(key))
    || value.schemaVersion !== LISTING_CREATIVE_OPERATOR_API_VERSION
    || !record(value.listingInput)
    || !record(value.commerce)
    || (value.reprepareExpiredPlanReference !== undefined
      && (typeof value.reprepareExpiredPlanReference !== "string"
        || value.reprepareExpiredPlanReference.length > 256))
  ) return null;
  return value as PrepareListingCreativeDispatchRequest;
}

async function boundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) throw new RangeError("BODY_TOO_LARGE");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new RangeError("BODY_TOO_LARGE");
  return JSON.parse(text) as unknown;
}

function failure(error: unknown): Response {
  if (error instanceof RangeError) {
    return Response.json({ error: { code: "REQUEST_TOO_LARGE" } }, { status: 413 });
  }
  if (
    error instanceof AdminRequestGuardError
    || error instanceof AdminUnsupportedMediaTypeError
    || error instanceof AdminCsrfError
  ) return Response.json({ error: { code: error.code } }, { status: error.status });
  if (error instanceof ListingCreativeOperatorServiceError) {
    const conflict = error.code === "DISPATCH_ALREADY_RESERVED"
      || error.code === "DISPATCH_REPREPARE_NOT_EXPIRED";
    return Response.json(
      { error: { code: error.code, retryable: false } },
      { status: conflict ? 409 : 422 },
    );
  }
  return Response.json({ error: { code: "INVALID_REQUEST", retryable: false } }, { status: 422 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "listing-creative-dispatch-prepare", context);
    const perAdmin = adminRateLimiter.consume(context.administratorUserId, "mutation");
    const global = adminRateLimiter.consume("listing-creative-prepare-global", "mutation");
    if (!perAdmin.allowed || !global.allowed) {
      return Response.json({ error: { code: "RATE_LIMITED" } }, {
        status: 429,
        headers: { "Retry-After": String(Math.max(perAdmin.retryAfterSeconds, global.retryAfterSeconds)) },
      });
    }
    const body = parse(await boundedJson(request));
    if (!body) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 422 });
    const result = await prepareListingCreativeOperatorDispatch(context, body);
    return Response.json({ data: result }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
