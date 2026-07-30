import {
  AdminRequestGuardError,
  requireAdminRequest,
} from "../../../../../../lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "../../../../../../lib/auth/admin-rate-limit.server";
import {
  getItemSelectionRunById,
} from "../../../../../../services/item-selection-run.repository";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "read");
    if (request.body !== null) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const rate = adminRateLimiter.consume(context.administratorUserId, "read");
    if (!rate.allowed) {
      return Response.json(
        { code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const { id } = await params;
    if (!UUID.test(id)) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const run = await getItemSelectionRunById(context, id);
    return run
      ? Response.json(run)
      : Response.json({ code: "NOT_FOUND" }, { status: 404 });
  } catch (error) {
    if (error instanceof AdminRequestGuardError) {
      return Response.json({ code: error.code }, { status: error.status });
    }
    if (typeof error === "object" && error !== null &&
        "name" in error && error.name === "ItemSelectionRunRepositoryError" &&
        "kind" in error && error.kind === "INVALID") {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    return Response.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
