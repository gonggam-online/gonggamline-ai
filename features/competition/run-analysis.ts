import { supabase } from "@/lib/supabase";
import { analyzeCompetition } from "./competition-analysis";
import { collectMarketData } from "./providers/market-data-provider";

export async function runAutomaticCompetitionAnalysis(productId: number) {
  const { data: product, error: readError } = await supabase
    .from("products")
    .select("id,title,keyword,supply_price,estimated_sale_price,estimated_profit,margin_rate,basic_score")
    .eq("id", productId)
    .single();
  if (readError) throw new Error(readError.message);

  const market = await collectMarketData(product);
  const analysis = analyzeCompetition({
    ...market,
    salePrice: Number(product.estimated_sale_price ?? 0),
    estimatedProfit: Number(product.estimated_profit ?? 0),
    marginRate: Number(product.margin_rate ?? 0),
  });

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("products")
    .update({
      coupang_analysis_keyword: market.keyword,
      coupang_market_price: market.marketPrice,
      coupang_top10_avg_price: market.top10AveragePrice,
      coupang_result_count: market.resultCount,
      coupang_rocket_ratio: market.rocketRatio,
      coupang_avg_review_count: market.averageReviewCount,
      coupang_avg_rating: market.averageRating,
      coupang_keyword_search_volume: market.monthlySearchVolume,
      competition_score: analysis.competitionScore,
      marketability_score: analysis.marketabilityScore,
      price_competitiveness_score: analysis.priceCompetitivenessScore,
      review_entry_score: analysis.reviewEntryScore,
      rocket_competition_score: analysis.rocketCompetitionScore,
      keyword_demand_score: analysis.keywordDemandScore,
      competition_grade: analysis.grade,
      competition_analysis_status: market.source === "external" ? "analyzed" : "estimated",
      competition_data_source: market.source,
      competition_confidence: market.confidence,
      competition_data_note: market.note,
      competition_summary: analysis.summary,
      estimated_monthly_units_low: analysis.estimatedMonthlyUnitsLow,
      estimated_monthly_units_high: analysis.estimatedMonthlyUnitsHigh,
      estimated_monthly_sales_low: analysis.estimatedMonthlySalesLow,
      estimated_monthly_sales_high: analysis.estimatedMonthlySalesHigh,
      competition_analyzed_at: now,
      updated_at: now,
    })
    .eq("id", productId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { product: data, analysis, market };
}
