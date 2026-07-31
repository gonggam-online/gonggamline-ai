import "server-only";

import {
  AdminRequestGuardError, AdminUnsupportedMediaTypeError,
  requireAdminRequest, requireExactAdminOrigin, requireJsonContentType,
  type AdminGuardContext,
} from "./admin-request-guard.server";
import { adminRateLimiter } from "./admin-rate-limit.server";
import {
  AdminCsrfError, verifyAdminCsrfToken, type AdminCsrfPurpose,
} from "./csrf.server";
import {
  ProductMutationRepositoryError, readIdempotencyKey,
} from "../../services/product-mutation.repository";

export async function requireProtectedProductMutation(
  request: Request, purpose: AdminCsrfPurpose,
): Promise<Readonly<{ context: AdminGuardContext; idempotencyKey: string }>> {
  const context = await requireAdminRequest(request, "mutation");
  requireExactAdminOrigin(request);
  requireJsonContentType(request);
  verifyAdminCsrfToken(request, purpose, context);
  const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
  if (!rate.allowed) throw Object.assign(new Error("Rate limited."), {
    name: "ProductMutationRateLimitError", retryAfterSeconds: rate.retryAfterSeconds,
  });
  const idempotencyKey = readIdempotencyKey(request);
  if (!idempotencyKey) throw new ProductMutationRepositoryError("INVALID");
  return Object.freeze({ context, idempotencyKey });
}

export function productMutationErrorResponse(error: unknown): Response {
  if (error instanceof AdminRequestGuardError ||
      error instanceof AdminUnsupportedMediaTypeError ||
      error instanceof AdminCsrfError) {
    return Response.json({ code: error.code }, { status: error.status });
  }
  if (error instanceof ProductMutationRepositoryError) {
    const status = error.kind === "CONFLICT" ? 409 : error.kind === "NOT_FOUND" ? 404 :
      error.kind === "INVALID" ? 400 : 500;
    return Response.json({ code: status === 409 ? "CONFLICT" :
      status === 404 ? "NOT_FOUND" : status === 400 ? "INVALID_REQUEST" :
        "INTERNAL_ERROR" }, { status });
  }
  if (error && typeof error === "object" &&
      (error as { name?: string }).name === "ProductMutationRateLimitError") {
    return Response.json({ code: "RATE_LIMITED" }, { status: 429, headers: {
      "Retry-After": String((error as { retryAfterSeconds: number }).retryAfterSeconds),
    } });
  }
  return Response.json({ code: "INTERNAL_ERROR" }, { status: 500 });
}
