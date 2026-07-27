import { NextRequest, NextResponse } from "next/server";
import { domeggookErrorHttpStatus } from "../../../../../lib/domeggook/errors";
import { DomeggookHealthService } from "../../../../../services/domeggook-health.service";

const healthService = new DomeggookHealthService();

export function createDomeggookHealthHandler(service: DomeggookHealthService) {
  return async function domeggookHealthHandler(request: NextRequest) {
    const verifyProvider =
      request.nextUrl.searchParams.get("verify") === "provider";
    const result = verifyProvider
      ? await service.verifyProvider()
      : service.checkConfiguration();
    const status =
      result.ok || !result.errorCode
        ? 200
        : domeggookErrorHttpStatus(result.errorCode);

    return NextResponse.json(result, {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  };
}

export const GET = createDomeggookHealthHandler(healthService);
