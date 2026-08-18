import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "@/lib/auth/csrf.server";
import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  evaluateListingCreativeAdapterPacket,
  parseListingCreativeAdapterPacket,
} from "@/engines/listing/creative-adapter-export";
import { enrichListingCreativeAdapterLogistics } from "@/engines/listing/creative-adapter-logistics";
import {
  LISTING_CREATIVE_ADAPTER_ENRICH_API_VERSION,
  type ListingCreativeAdapterEnrichmentRequest,
  type ListingCreativeAdapterEnrichmentResult,
} from "@/shared/contracts/listing-creative-adapter-export";
import type { LogisticsAddressSelector } from "@/shared/contracts/coupang-preflight-evidence";
import { persistOwnerAdapterPacket } from "@/services/listing-creative-adapter-recovery.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 512 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function body(request: Request): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new RangeError("BODY_TOO_LARGE");
  return JSON.parse(text) as unknown;
}

function parseRequest(value: unknown): ListingCreativeAdapterEnrichmentRequest {
  if (!record(value) || Object.keys(value).some((key) => !["schemaVersion", "packet", "logistics"].includes(key))) throw new Error("ADAPTER_ENRICH_INVALID_REQUEST");
  if (value.schemaVersion !== LISTING_CREATIVE_ADAPTER_ENRICH_API_VERSION || !record(value.logistics) || !record(value.logistics.outbound) || !record(value.logistics.returnCenter)) throw new Error("ADAPTER_ENRICH_INVALID_REQUEST");
  return {
    schemaVersion: LISTING_CREATIVE_ADAPTER_ENRICH_API_VERSION,
    packet: value.packet,
    logistics: {
      outbound: value.logistics.outbound as LogisticsAddressSelector,
      returnCenter: value.logistics.returnCenter as LogisticsAddressSelector,
    },
  };
}

function failure(error: unknown): Response {
  if (error instanceof RangeError) return Response.json({ error: { code: "REQUEST_TOO_LARGE" } }, { status: 413 });
  if (error instanceof AdminRequestGuardError || error instanceof AdminUnsupportedMediaTypeError || error instanceof AdminCsrfError) return Response.json({ error: { code: error.code } }, { status: error.status });
  if (error instanceof Error && error.message.startsWith("ADAPTER_")) return Response.json({ error: { code: error.message } }, { status: 422 });
  return Response.json({ error: { code: "ADAPTER_ENRICH_FAILED" } }, { status: 422 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "listing-creative-adapter-enrich", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    const global = adminRateLimiter.consume("listing-creative-adapter-enrich-global", "mutation");
    if (!rate.allowed || !global.allowed) return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
    const parsed = parseRequest(await body(request));
    const draft = parseListingCreativeAdapterPacket(parsed.packet, { allowUnresolvedLogistics: true });
    const packet = await enrichListingCreativeAdapterLogistics(draft, parsed.logistics);
    const readiness = evaluateListingCreativeAdapterPacket(packet);
    await persistOwnerAdapterPacket(context, packet, readiness, new Date().toISOString());
    const result: ListingCreativeAdapterEnrichmentResult = Object.freeze({
      schemaVersion: LISTING_CREATIVE_ADAPTER_ENRICH_API_VERSION,
      packet,
      readiness,
      evidence: packet.commerce.logisticsEvidence!,
      generatedAt: new Date().toISOString(),
    });
    return Response.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
