import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
} from "@/lib/auth/admin-request-guard.server";
import { loadOwnerAdapterPacket } from "@/services/listing-creative-adapter-recovery.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown): Response {
  if (error instanceof AdminRequestGuardError || error instanceof AdminUnsupportedMediaTypeError) {
    return Response.json({ error: { code: error.code } }, { status: error.status });
  }
  if (error instanceof Error && error.message === "Protected data access is unavailable.") {
    return Response.json({ error: { code: "ADAPTER_PACKET_RECOVERY_STORAGE_UNAVAILABLE" } }, { status: 503 });
  }
  if (error instanceof Error && error.message.startsWith("ADAPTER_PACKET_")) {
    return Response.json({ error: { code: error.message } }, { status: 422 });
  }
  return Response.json({ error: { code: "ADAPTER_PACKET_RECOVERY_FAILED" } }, { status: 503 });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "read");
    requireExactAdminOrigin(request);
    const packetDigest = new URL(request.url).searchParams.get("packetDigest")?.trim() ?? "";
    if (!/^[a-f0-9]{64}$/.test(packetDigest)) {
      return Response.json({ error: { code: "ADAPTER_PACKET_RECOVERY_INVALID_DIGEST" } }, { status: 422 });
    }
    const record = await loadOwnerAdapterPacket(context, packetDigest);
    if (!record) return Response.json({ error: { code: "ADAPTER_PACKET_RECOVERY_NOT_FOUND" } }, { status: 404 });
    return Response.json({ data: record }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
