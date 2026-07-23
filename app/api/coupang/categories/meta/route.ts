import { NextRequest, NextResponse } from "next/server";
import {
  getCoupangCategoryMeta,
  normalizeDisplayCategoryCode,
} from "@/lib/coupang/category";

export async function GET(request: NextRequest) {
  try {
    const code = normalizeDisplayCategoryCode(
      request.nextUrl.searchParams.get("displayCategoryCode"),
    );

    if (!code) {
      return NextResponse.json(
        { ok: false, message: "0보다 큰 숫자형 displayCategoryCode가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await getCoupangCategoryMeta(code);

    return NextResponse.json(
      result.ok
        ? { ok: true, result: result.data }
        : { ok: false, status: result.status, detail: result.raw },
      { status: result.ok ? 200 : result.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "카테고리 메타정보 조회 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
