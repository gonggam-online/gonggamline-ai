import { coupangRequest, getCoupangConfig, type CoupangApiResult } from "@/lib/coupang/client";

const OUTBOUND_PATH = "/v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound";

export type CoupangLogisticsPreflightStatus =
  | "READY"
  | "CONFIGURATION_MISSING"
  | "AUTHENTICATION_OR_IP_ALLOWLIST"
  | "PROVIDER_UNAVAILABLE"
  | "RESPONSE_CONTRACT_ERROR";

export type CoupangLogisticsPreflightResult = Readonly<{
  status: CoupangLogisticsPreflightStatus;
  checkedAt: string;
  endpoint: "OUTBOUND_SHIPPING_PLACE_READ";
  readOnly: true;
  staticEgressRequired: true;
  detail: "CREDENTIALS_PRESENT_AND_READ_ONLY_PROBE_PASSED" | "CREDENTIALS_MISSING" | "AUTH_OR_IP_ALLOWLIST_REJECTED" | "UPSTREAM_UNAVAILABLE" | "UNEXPECTED_PROVIDER_RESPONSE";
}>;

type PreflightRequester = (options: Readonly<{ method: "GET"; path: string; searchParams: URLSearchParams }>) => Promise<CoupangApiResult<Readonly<{ content?: unknown }>>>;

function result(status: CoupangLogisticsPreflightStatus, detail: CoupangLogisticsPreflightResult["detail"], checkedAt: string): CoupangLogisticsPreflightResult {
  return Object.freeze({
    status,
    checkedAt,
    endpoint: "OUTBOUND_SHIPPING_PLACE_READ" as const,
    readOnly: true as const,
    staticEgressRequired: true as const,
    detail,
  });
}

export async function checkCoupangLogisticsPreflight(
  now = new Date(),
  requester: PreflightRequester = (options) => coupangRequest<Readonly<{ content?: unknown }>>(options),
): Promise<CoupangLogisticsPreflightResult> {
  const checkedAt = now.toISOString();
  try {
    getCoupangConfig();
  } catch {
    return result("CONFIGURATION_MISSING", "CREDENTIALS_MISSING", checkedAt);
  }

  try {
    const response = await requester({
      method: "GET",
      path: OUTBOUND_PATH,
      searchParams: new URLSearchParams({ pageNum: "1", pageSize: "1" }),
    });
    if (response.status === 401 || response.status === 403) {
      return result("AUTHENTICATION_OR_IP_ALLOWLIST", "AUTH_OR_IP_ALLOWLIST_REJECTED", checkedAt);
    }
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      return result("PROVIDER_UNAVAILABLE", "UPSTREAM_UNAVAILABLE", checkedAt);
    }
    if (!response.ok || !response.data || !Array.isArray(response.data.content)) {
      return result("RESPONSE_CONTRACT_ERROR", "UNEXPECTED_PROVIDER_RESPONSE", checkedAt);
    }
    return result("READY", "CREDENTIALS_PRESENT_AND_READ_ONLY_PROBE_PASSED", checkedAt);
  } catch {
    return result("PROVIDER_UNAVAILABLE", "UPSTREAM_UNAVAILABLE", checkedAt);
  }
}
