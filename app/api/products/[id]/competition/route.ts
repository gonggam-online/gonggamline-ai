import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { analyzeCompetition } from "@/features/competition/competition-analysis";

type Body = {
  marketPrice?: number;
  top10AveragePrice?: number;
  resultCount?: number;
  rocketRatio?: number;
  averageReviewCount?: number;
  averageRating?: number;
  monthlySearchVolume?: number;
};

function number(value: unknown, name: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} 값이 올바르지 않습니다.`);
  }
  return parsed;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ success: false, message: "유효하지 않은 상품 ID입니다." }, { status: 400 });
    }

    const body = (await request.json()) as Body;
    const inputMetrics = {
      marketPrice: number(body.marketPrice, "쿠팡 대표 판매가"),
      top10AveragePrice: number(body.top10AveragePrice, "상위 10개 평균가"),
      resultCount: number(body.resultCount, "검색 결과 수", 0, 10000000),
      rocketRatio: number(body.rocketRatio, "로켓 비율", 0, 100),
      averageReviewCount: number(body.averageReviewCount, "평균 리뷰 수", 0, 10000000),
      averageRating: number(body.averageRating, "평균 평점", 0, 5),
      monthlySearchVolume: number(body.monthlySearchVolume, "월 검색량", 0, 100000000),
    };

    const { data: product, error: readError } = await supabase
      .from("products")
      .select("id, estimated_sale_price, estimated_profit, margin_rate")
      .eq("id", productId)
      .single();
    if (readError) throw new Error(readError.message);

    const analysis = analyzeCompetition({
      ...inputMetrics,
      salePrice: Number(product.estimated_sale_price ?? 0),
      estimatedProfit: Number(product.estimated_profit ?? 0),
      marginRate: Number(product.margin_rate ?? 0),
    });

    const { data, error } = await supabase
      .from("products")
      .update({
        coupang_market_price: inputMetrics.marketPrice,
        coupang_top10_avg_price: inputMetrics.top10AveragePrice,
        coupang_result_count: Math.round(inputMetrics.resultCount),
        coupang_rocket_ratio: inputMetrics.rocketRatio,
        coupang_avg_review_count: inputMetrics.averageReviewCount,
        coupang_avg_rating: inputMetrics.averageRating,
        coupang_keyword_search_volume: Math.round(inputMetrics.monthlySearchVolume),
        competition_score: analysis.competitionScore,
        marketability_score: analysis.marketabilityScore,
        price_competitiveness_score: analysis.priceCompetitivenessScore,
        review_entry_score: analysis.reviewEntryScore,
        rocket_competition_score: analysis.rocketCompetitionScore,
        keyword_demand_score: analysis.keywordDemandScore,
        competition_grade: analysis.grade,
        competition_analysis_status: "analyzed",
        competition_data_source: "manual",
        competition_confidence: 75,
        competition_data_note: "사용자가 직접 입력한 쿠팡 시장 데이터",
        competition_summary: analysis.summary,
        estimated_monthly_units_low: analysis.estimatedMonthlyUnitsLow,
        estimated_monthly_units_high: analysis.estimatedMonthlyUnitsHigh,
        estimated_monthly_sales_low: analysis.estimatedMonthlySalesLow,
        estimated_monthly_sales_high: analysis.estimatedMonthlySalesHigh,
        competition_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, product: data, analysis });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "경쟁력 분석 중 오류가 발생했습니다." },
      { status: 400 }
    );
  }
}
