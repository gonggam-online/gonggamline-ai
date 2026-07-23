import { NextResponse } from "next/server";
import { coupangRequest, getCoupangConfig } from "@/lib/coupang/client";

type InflowStatusResponse = {
  code?: string;
  message?: string;
  data?: {
    vendorId?: string;
    restricted?: boolean;
    registeredCount?: number;
    permittedCount?: number | null;
  };
};

export async function GET() {
  try {
    const config = getCoupangConfig();
    const result = await coupangRequest<InflowStatusResponse>({
      method: "GET",
      path: "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/inflow-status",
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          vendorIdMasked: `${config.vendorId.slice(0, 2)}***${config.vendorId.slice(-2)}`,
          message: explainCoupangError(result.status, result.raw),
          detail: result.raw,
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "쿠팡 Open API 연결에 성공했습니다.",
      vendorIdMasked: `${config.vendorId.slice(0, 2)}***${config.vendorId.slice(-2)}`,
      account: result.data?.data ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "연결 테스트 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}

function explainCoupangError(status: number, raw: unknown): string {
  const detail = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (status === 401) return "인증에 실패했습니다. Access Key, Secret Key, 서버 시간을 확인하세요.";
  if (status === 403 && detail.toLowerCase().includes("ip")) {
    return "등록되지 않은 공인 IP에서 호출되었습니다. WING의 Open API 연동 IP를 확인하고 변경 후 최대 30분 뒤 다시 시도하세요.";
  }
  if (status === 403) return "API 접근이 거부되었습니다. 키 활성화 상태와 계정 권한을 확인하세요.";
  if (status === 429) return "쿠팡 API 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.";
  return `쿠팡 API가 HTTP ${status} 오류를 반환했습니다.`;
}
