import { NextRequest, NextResponse } from "next/server";
import { saveMarketObservation } from "../../../../services/market-observation.service";
import { analyzeAllMarketProducts } from "../../../../services/market-analysis.service";

const DEMO_PRODUCTS = [
  { id: "demo-cleaner-01", title: "프리미엄 무선청소기 250W", brand: "공감데모", price: 129000, reviews: 180, rank: 18 },
  { id: "demo-storage-01", title: "접이식 리빙 수납박스 3개 세트", brand: "공감데모", price: 29900, reviews: 420, rank: 9 },
  { id: "demo-kitchen-01", title: "실리콘 주방 정리 트레이", brand: "공감데모", price: 15900, reviews: 75, rank: 31 },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const keyword = String(body.keyword ?? "생활용품").trim() || "생활용품";
    const base = Date.now();
    let saved = 0;
    for (const [productIndex, product] of DEMO_PRODUCTS.entries()) {
      for (let day = 14; day >= 0; day -= 1) {
        const growth = 14 - day;
        await saveMarketObservation({
          source: "manual",
          keyword,
          observedAt: new Date(base - day * 86_400_000).toISOString(),
          product: { externalProductId: product.id, title: product.title, brand: product.brand, sellerName: "DEMO SELLER", category: "데모 데이터" },
          snapshot: {
            rank: Math.max(1, product.rank - Math.floor(growth * (productIndex === 0 ? 0.8 : 0.35))),
            price: product.price + (day % 5 === 0 ? 1000 : 0),
            listPrice: Math.round(product.price * 1.15),
            rating: 4.5 + productIndex * 0.1,
            reviewCount: product.reviews + growth * (productIndex === 0 ? 3 : productIndex === 1 ? 2 : 1),
            rocketType: "rocket",
            isSoldOut: productIndex === 0 && day === 5,
            deliveryDays: 1,
            optionCount: 3 + productIndex,
          },
        });
        saved += 1;
      }
    }
    const analysis = await analyzeAllMarketProducts(100);
    return NextResponse.json({ success: true, demoOnly: true, saved, analysis, message: "실시장 데이터가 아닌 파이프라인 검증용 DEMO 데이터입니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "데모 데이터 생성 오류" }, { status: 500 });
  }
}
