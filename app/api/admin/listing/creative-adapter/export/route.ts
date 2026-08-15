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
  evaluateListingCreativeAdapterPacket,
  parseListingCreativeAdapterPacket,
  sanitizeListingCreativeAdapterPacket,
} from "@/engines/listing/creative-adapter-export";
import {
  LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION,
  type ListingCreativeAdapterExportDto,
  type ListingCreativeAdapterExportRequest,
} from "@/shared/contracts/listing-creative-adapter-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function boundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) throw new RangeError("BODY_TOO_LARGE");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new RangeError("BODY_TOO_LARGE");
  return JSON.parse(text) as unknown;
}

function parseRequest(value: unknown): ListingCreativeAdapterExportRequest {
  if (!record(value) || Object.keys(value).some((key) => key !== "schemaVersion" && key !== "packet")) {
    throw new Error("ADAPTER_EXPORT_INVALID_REQUEST");
  }
  if (value.schemaVersion !== LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION) {
    throw new Error("ADAPTER_EXPORT_INVALID_REQUEST");
  }
  return {
    schemaVersion: LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION,
    packet: parseListingCreativeAdapterPacket(value.packet),
  };
}

function failure(error: unknown): Response {
  if (error instanceof RangeError) return Response.json({ error: { code: "REQUEST_TOO_LARGE" } }, { status: 413 });
  if (error instanceof AdminRequestGuardError || error instanceof AdminUnsupportedMediaTypeError || error instanceof AdminCsrfError) {
    return Response.json({ error: { code: error.code } }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith("ADAPTER_")) {
    return Response.json({ error: { code: error.message } }, { status: 422 });
  }
  return Response.json({ error: { code: "ADAPTER_EXPORT_FAILED" } }, { status: 422 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "listing-creative-adapter-export", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    const global = adminRateLimiter.consume("listing-creative-adapter-export-global", "mutation");
    if (!rate.allowed || !global.allowed) return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
    const input = parseRequest(await boundedJson(request));
    const readiness = evaluateListingCreativeAdapterPacket(input.packet);
    const response: ListingCreativeAdapterExportDto = Object.freeze({
      schemaVersion: LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION,
      exportKind: "FULL_PACKET",
      packet: input.packet,
      readiness,
      generatedAt: new Date().toISOString(),
    });
    return Response.json({ data: response, sanitizedReview: {
      schemaVersion: LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION,
      exportKind: "SANITIZED_REVIEW",
      packet: sanitizeListingCreativeAdapterPacket(input.packet),
      readiness,
      generatedAt: response.generatedAt,
    } satisfies ListingCreativeAdapterExportDto }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
