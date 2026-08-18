import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "@/lib/auth/csrf.server";
import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import { parseListingCreativeAdapterPacket, evaluateListingCreativeAdapterPacket } from "@/engines/listing/creative-adapter-export";
import { importOwnerConfirmedListingCreativeAdapterLogistics } from "@/engines/listing/creative-adapter-manual-logistics";
import {
  LISTING_CREATIVE_ADAPTER_MANUAL_LOGISTICS_API_VERSION,
  type ListingCreativeAdapterManualLogisticsRequest,
} from "@/shared/contracts/listing-creative-adapter-export";
import { persistOwnerAdapterPacket } from "@/services/listing-creative-adapter-recovery.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 512 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new RangeError("REQUEST_TOO_LARGE");
  return JSON.parse(text) as unknown;
}

function parseRequest(value: unknown): ListingCreativeAdapterManualLogisticsRequest {
  if (!record(value) || Object.keys(value).some((key) => !["schemaVersion", "packet", "evidence"].includes(key))) throw new Error("ADAPTER_MANUAL_LOGISTICS_INVALID_REQUEST");
  if (value.schemaVersion !== LISTING_CREATIVE_ADAPTER_MANUAL_LOGISTICS_API_VERSION || !record(value.evidence)) throw new Error("ADAPTER_MANUAL_LOGISTICS_INVALID_REQUEST");
  return { schemaVersion: LISTING_CREATIVE_ADAPTER_MANUAL_LOGISTICS_API_VERSION, packet: value.packet, evidence: value.evidence as ListingCreativeAdapterManualLogisticsRequest["evidence"] };
}

function failure(error: unknown): Response {
  if (error instanceof RangeError) return Response.json({ error: { code: "REQUEST_TOO_LARGE" } }, { status: 413 });
  if (error instanceof AdminRequestGuardError || error instanceof AdminUnsupportedMediaTypeError || error instanceof AdminCsrfError) return Response.json({ error: { code: error.code } }, { status: error.status });
  if (error instanceof Error && error.message.startsWith("ADAPTER_")) return Response.json({ error: { code: error.message } }, { status: 422 });
  return Response.json({ error: { code: "ADAPTER_MANUAL_LOGISTICS_FAILED" } }, { status: 422 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "listing-creative-adapter-enrich", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    const global = adminRateLimiter.consume("listing-creative-adapter-manual-logistics-global", "mutation");
    if (!rate.allowed || !global.allowed) return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
    const parsed = parseRequest(await readBody(request));
    const draft = parseListingCreativeAdapterPacket(parsed.packet, { allowUnresolvedLogistics: true });
    const packet = importOwnerConfirmedListingCreativeAdapterLogistics(draft, parsed.evidence);
    const readiness = evaluateListingCreativeAdapterPacket(packet);
    await persistOwnerAdapterPacket(context, packet, readiness, new Date().toISOString());
    return Response.json({ data: { schemaVersion: LISTING_CREATIVE_ADAPTER_MANUAL_LOGISTICS_API_VERSION, packet, readiness, mode: "OWNER_CONFIRMED_WING" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
