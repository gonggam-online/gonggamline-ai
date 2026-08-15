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
} from "@/engines/listing/creative-adapter-reprepare";
import { issueAndPersistListingLiveWriteApproval } from "@/services/listing-live-write-approval.service";
import {
  LISTING_LIVE_WRITE_APPROVAL_API_VERSION,
  type ListingLiveWriteApprovalResponse,
} from "@/shared/contracts/listing-live-write-approval";
import { LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION } from "@/shared/contracts/listing-creative-adapter-reprepare";
import { LISTING_LIVE_WRITE_APPROVAL_CONFIRMATION } from "@/shared/domain/listing-live-write-approval";
import type { ListingCreativeAdapterPacket } from "@/shared/contracts/listing-creative-adapter-export";
import type { ListingCreativeAdapterRevisionMetadata } from "@/shared/contracts/listing-creative-adapter-reprepare";

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

function parseRequest(value: unknown): Readonly<{
  packet: ListingCreativeAdapterPacket;
  revision: ListingCreativeAdapterRevisionMetadata;
}> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("LIVE_WRITE_APPROVAL_INVALID_REQUEST");
  }
  const root = value as Record<string, unknown>;
  if (Object.keys(root).some((key) => !["schemaVersion", "confirmation", "packet", "revision"].includes(key))) {
    throw new Error("LIVE_WRITE_APPROVAL_UNKNOWN_KEY");
  }
  if (root.schemaVersion !== LISTING_LIVE_WRITE_APPROVAL_API_VERSION
    || root.confirmation !== LISTING_LIVE_WRITE_APPROVAL_CONFIRMATION) {
    throw new Error("LIVE_WRITE_APPROVAL_CONFIRMATION_REQUIRED");
  }
  const revision = root.revision;
  if (typeof revision !== "object" || revision === null || Array.isArray(revision)) {
    throw new Error("LIVE_WRITE_APPROVAL_INVALID_REVISION");
  }
  const rawRevision = revision as Record<string, unknown>;
  if (rawRevision.liveWriteApprovalReference !== undefined
    && rawRevision.liveWriteApprovalReference !== null
    && rawRevision.liveWriteApprovalReference !== "") {
    throw new Error("LIVE_WRITE_APPROVAL_ALREADY_PRESENT");
  }
  const parsed = parseListingCreativeAdapterReprepareRequest({
    schemaVersion: LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION,
    revision: { ...rawRevision, liveWriteApprovalReference: null },
    packet: root.packet,
  });
  return Object.freeze({ packet: parsed.packet, revision: parsed.revision });
}

function failure(error: unknown): Response {
  if (error instanceof RangeError) return Response.json({ error: { code: "REQUEST_TOO_LARGE" } }, { status: 413 });
  if (error instanceof AdminRequestGuardError || error instanceof AdminUnsupportedMediaTypeError || error instanceof AdminCsrfError) {
    return Response.json({ error: { code: error.code } }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith("LIVE_WRITE_APPROVAL_")) {
    const storageFailure = error.message.includes("STORAGE") || error.message.includes("CONFIGURATION");
    return Response.json({ error: { code: error.message } }, { status: storageFailure ? 503 : 422 });
  }
  if (error instanceof Error && error.message.startsWith("ADAPTER_")) {
    return Response.json({ error: { code: error.message } }, { status: 422 });
  }
  return Response.json({ error: { code: "LIVE_WRITE_APPROVAL_FAILED" } }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "listing-live-write-approval", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    const global = adminRateLimiter.consume("listing-live-write-approval-global", "mutation");
    if (!rate.allowed || !global.allowed) return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
    const parsed = parseRequest(await boundedJson(request));
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
    const approval = await issueAndPersistListingLiveWriteApproval(context, {
      packet: parsed.packet,
      revision: {
        packetId: parsed.revision.packetId,
        evaluationId: parsed.revision.evaluationId,
        evaluatedAt: parsed.revision.evaluatedAt,
        sourceReference: parsed.revision.sourceReference,
        contentApprovalReference: parsed.revision.contentApprovalReference,
      },
      issuedAt,
      expiresAt,
    });
    const response: ListingLiveWriteApprovalResponse = {
      schemaVersion: LISTING_LIVE_WRITE_APPROVAL_API_VERSION,
      status: "ISSUED",
      approval,
    };
    return Response.json({ data: response }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
