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
  parseListingCreativeAdapterReprepareRequest,
  reprepareListingCreativeAdapterPacket,
} from "@/engines/listing/creative-adapter-reprepare";
import { LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION } from "@/shared/contracts/listing-creative-adapter-reprepare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512 * 1024;

async function boundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) throw new RangeError("BODY_TOO_LARGE");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new RangeError("BODY_TOO_LARGE");
  return JSON.parse(text) as unknown;
}

function failure(error: unknown): Response {
  if (error instanceof RangeError) return Response.json({ error: { code: "REQUEST_TOO_LARGE" } }, { status: 413 });
  if (error instanceof AdminRequestGuardError || error instanceof AdminUnsupportedMediaTypeError || error instanceof AdminCsrfError) {
    return Response.json({ error: { code: error.code } }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith("ADAPTER_REPREPARE_")) {
    return Response.json({ error: { code: error.message } }, { status: 422 });
  }
  return Response.json({ error: { code: "ADAPTER_REPREPARE_FAILED" } }, { status: 422 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "listing-creative-adapter-export", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    const global = adminRateLimiter.consume("listing-creative-adapter-reprepare-global", "mutation");
    if (!rate.allowed || !global.allowed) return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
    const parsed = parseListingCreativeAdapterReprepareRequest(await boundedJson(request));
    const result = reprepareListingCreativeAdapterPacket(parsed.packet, parsed.revision, new Date().toISOString());
    if (result.schemaVersion !== LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION) {
      return Response.json({ error: { code: "ADAPTER_REPREPARE_FAILED" } }, { status: 422 });
    }
    return Response.json({ data: result }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
