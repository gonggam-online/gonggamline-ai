import { NextRequest, NextResponse } from "next/server";
import { saveMarketObservation } from "../../../../services/market-observation.service";
import { analyzeMarketProduct } from "../../../../services/market-analysis.service";
import type { MarketObservationInput } from "../../../../types/market";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MarketObservationInput;
    if (!body.keyword?.trim() || !body.product?.externalProductId || !body.product?.title) {
      return NextResponse.json({ success: false, message: "keyword, externalProductId, title은 필수입니다." }, { status: 400 });
    }
    const saved = await saveMarketObservation(body);
    const analysis = body && (body as MarketObservationInput & { analyzeImmediately?: boolean }).analyzeImmediately ? await analyzeMarketProduct(saved.productId) : null;
    return NextResponse.json({ success: true, saved, analysis });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "관측 저장 오류" }, { status: 500 });
  }
}
