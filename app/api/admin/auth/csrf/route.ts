import { cookies } from "next/headers";

import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  AdminRecoveryGrantError,
  verifyAdminRecoveryGrant,
} from "@/lib/auth/admin-password-recovery.server";
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
  "admin-password-recovery",
  "item-selection-create",
  "product-import",
  "product-operator-patch",
  "product-manual-competition",
  "product-automatic-competition",
  "product-competition-batch",
  "listing-creative-dispatch-prepare",
  "listing-creative-dispatch",
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
      purpose === "admin-session" ||
      purpose === "admin-mfa" ||
      purpose === "admin-password-recovery"
        ? "read"
        : "mutation",
    );
    if (purpose === "admin-password-recovery") {
      verifyAdminRecoveryGrant(request, context);
    }
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
    if (
      error instanceof AdminRequestGuardError ||
      error instanceof AdminCsrfError ||
      error instanceof AdminRecoveryGrantError
    ) {
      return Response.json({ code: error.code }, { status: error.status });
    }
    return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
  }
}
