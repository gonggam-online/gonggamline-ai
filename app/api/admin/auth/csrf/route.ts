import { cookies } from "next/headers";

import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  AdminRequestGuardError,
  requireAdminRequest,
} from "@/lib/auth/admin-request-guard.server";
import {
  ADMIN_CSRF_COOKIE_NAME,
  ADMIN_CSRF_COOKIE_OPTIONS,
  AdminCsrfError,
  type AdminCsrfPurpose,
  issueAdminCsrfToken,
} from "@/lib/auth/csrf.server";

const PURPOSES = new Set<AdminCsrfPurpose>([
  "admin-mfa",
  "admin-session",
  "item-selection-create",
  "item-selection-finalize",
  "product-import",
  "product-operator-patch",
  "product-manual-competition",
  "product-automatic-competition",
  "product-competition-batch",
]);

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const values = url.searchParams.getAll("purpose");
    if (
      values.length !== 1 ||
      !PURPOSES.has(values[0] as AdminCsrfPurpose) ||
      [...url.searchParams.keys()].some((key) => key !== "purpose")
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const purpose = values[0] as AdminCsrfPurpose;
    const context = await requireAdminRequest(
      request,
      purpose === "admin-session" || purpose === "admin-mfa"
        ? "read"
        : "mutation",
    );
    const rate = adminRateLimiter.consume(context.administratorUserId, "read");
    if (!rate.allowed) {
      return Response.json({ code: "RATE_LIMITED" }, { status: 429 });
    }
    const issued = issueAdminCsrfToken(purpose, context);
    (await cookies()).set(
      ADMIN_CSRF_COOKIE_NAME,
      issued.token,
      ADMIN_CSRF_COOKIE_OPTIONS,
    );
    return Response.json(issued);
  } catch (error) {
    if (error instanceof AdminRequestGuardError || error instanceof AdminCsrfError) {
      return Response.json({ code: error.code }, { status: error.status });
    }
    return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
  }
}
