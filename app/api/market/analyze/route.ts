import { NextRequest, NextResponse } from "next/server";
import { analyzeAllMarketProducts, analyzeMarketProduct } from "../../../../services/market-analysis.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const productId = Number(body.productId ?? 0);
    const result = productId > 0 ? await analyzeMarketProduct(productId) : await analyzeAllMarketProducts(Math.min(500, Math.max(1, Number(body.limit ?? 300))));
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "시장 분석 오류" }, { status: 500 });
  }
}
