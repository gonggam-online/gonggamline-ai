import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "@/lib/auth/csrf.server";
import { createProductionManagedListingCreativePrivateStorage } from "@/services/listing-creative-asset.repository";
import {
  authorizeAndDispatchListingCreativeOperatorPlan,
  ListingCreativeOperatorServiceError,
  loadListingCreativeOperatorReview,
} from "@/services/listing-creative-operator-dispatch.service";
import {
  LISTING_CREATIVE_OPERATOR_API_VERSION,
  type AuthorizeListingCreativeDispatchRequest,
} from "@/shared/contracts/listing-creative-operator-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BODY_BYTES = 8 * 1024;
const KEYS = new Set(["schemaVersion", "preparedPlanReference", "confirmation"]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parse(value: unknown): AuthorizeListingCreativeDispatchRequest | null {
  if (
    !record(value)
    || Object.keys(value).some((key) => !KEYS.has(key))
    || value.schemaVersion !== LISTING_CREATIVE_OPERATOR_API_VERSION
    || typeof value.preparedPlanReference !== "string"
    || value.preparedPlanReference.length > 256
    || value.confirmation !== "AUTHORIZE_PAID_IMAGE_GENERATION"
  ) return null;
  return value as AuthorizeListingCreativeDispatchRequest;
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
    const status = error.code === "DISPATCH_ALREADY_RESERVED" ? 409
      : error.code === "DISPATCH_NOT_FOUND" ? 404
        : error.code === "DISPATCH_ARCHIVE_FAILED" ? 500
          : error.code === "DISPATCH_PROVIDER_TIMEOUT" ? 504
            : error.code === "DISPATCH_PROVIDER_CONFIGURATION_UNAVAILABLE"
              ? 503
              : error.code === "DISPATCH_PROVIDER_UPSTREAM"
                || error.code === "DISPATCH_EXECUTION_FAILED" ? 502 : 422;
    return Response.json({ error: { code: error.code, retryable: false } }, { status });
  }
  return Response.json({ error: { code: "DISPATCH_UNAVAILABLE", retryable: false } }, { status: 503 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "listing-creative-dispatch", context);
    const perAdmin = adminRateLimiter.consume(context.administratorUserId, "mutation");
    const global = adminRateLimiter.consume("listing-creative-dispatch-global", "mutation");
    if (!perAdmin.allowed || !global.allowed) {
      return Response.json({ error: { code: "RATE_LIMITED" } }, {
        status: 429,
        headers: { "Retry-After": String(Math.max(perAdmin.retryAfterSeconds, global.retryAfterSeconds)) },
      });
    }
    const body = parse(await boundedJson(request));
    if (!body) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 422 });
    if (process.env.VERCEL_ENV !== "production") {
      return Response.json({ error: { code: "PRODUCTION_DISPATCH_REQUIRED" } }, { status: 403 });
    }
    const result = await authorizeAndDispatchListingCreativeOperatorPlan(context, body);
    return Response.json({ data: result }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "read");
    const rate = adminRateLimiter.consume(context.administratorUserId, "read");
    if (!rate.allowed) return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
    const url = new URL(request.url);
    const references = url.searchParams.getAll("preparedPlanReference");
    if (
      references.length !== 1
      || references[0].length > 256
      || [...url.searchParams.keys()].some((key) => key !== "preparedPlanReference")
    ) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 422 });
    const storage = createProductionManagedListingCreativePrivateStorage(context);
    const result = await loadListingCreativeOperatorReview(
      context,
      references[0],
      storage,
    );
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
