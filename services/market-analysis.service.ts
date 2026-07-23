import { supabase } from "../lib/supabase";
import { analyzeSnapshots } from "../lib/market/analytics";

const MODEL_VERSION = "mie-heuristic-v3";
const FEATURE_VERSION = "mie-features-v1";

export async function analyzeMarketProduct(productId: number) {
  const { data: snapshots, error } = await supabase
    .from("market_snapshots")
    .select("observed_at,rank,price,review_count,is_sold_out,is_ad")
    .eq("market_product_id", productId)
    .order("observed_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  if (!snapshots?.length) return null;

  const metrics = analyzeSnapshots(snapshots);
  const analyzedAt = new Date().toISOString();
  const { error: metricError } = await supabase.from("market_product_metrics").upsert({
    market_product_id: productId,
    snapshot_count: metrics.snapshotCount,
    observation_days: metrics.observationDays,
    latest_price: metrics.latestPrice,
    price_change_7d_pct: metrics.priceChange7dPct,
    latest_review_count: metrics.latestReviewCount,
    review_delta_7d: metrics.reviewDelta7d,
    review_delta_30d: metrics.reviewDelta30d,
    average_rank_7d: metrics.averageRank7d,
    rank_change_7d: metrics.rankChange7d,
    stockout_count_30d: metrics.stockoutCount30d,
    demand_score: metrics.demandScore,
    growth_score: metrics.growthScore,
    stability_score: metrics.stabilityScore,
    competition_score: metrics.competitionScore,
    price_volatility_30d: metrics.priceVolatility30d,
    rank_volatility_30d: metrics.rankVolatility30d,
    review_velocity_7d: metrics.reviewVelocity7d,
    data_completeness_score: metrics.dataCompletenessScore,
    supply_score: metrics.supplyScore,
    ad_burden_score: metrics.adBurdenScore,
    entry_difficulty_score: metrics.entryDifficultyScore,
    opportunity_score: metrics.opportunityScore,
    confidence: metrics.confidence,
    estimated_units_low: metrics.estimate.low,
    estimated_units_base: metrics.estimate.base,
    estimated_units_high: metrics.estimate.high,
    recommendation_grade: metrics.recommendationGrade,
    recommendation_reason: metrics.recommendationReason,
    analyzed_at: analyzedAt,
    model_version: MODEL_VERSION,
    feature_version: FEATURE_VERSION,
    score_explanation: metrics.scoreExplanation,
  }, { onConflict: "market_product_id" });
  if (metricError) throw new Error(metricError.message);

  const { error: featureError } = await supabase.from("market_feature_snapshots").insert({
    market_product_id: productId, calculated_at: analyzedAt, feature_version: FEATURE_VERSION,
    observation_days: metrics.observationDays, snapshot_count: metrics.snapshotCount,
    review_velocity_7d: metrics.reviewVelocity7d, review_growth_30d: metrics.reviewDelta30d,
    price_change_7d_pct: metrics.priceChange7dPct, price_volatility_30d: metrics.priceVolatility30d,
    rank_change_7d: metrics.rankChange7d, rank_volatility_30d: metrics.rankVolatility30d,
    stockout_count_30d: metrics.stockoutCount30d, ad_ratio_30d: metrics.adRatio30d,
    data_completeness_score: metrics.dataCompletenessScore, demand_score: metrics.demandScore,
    growth_score: metrics.growthScore, stability_score: metrics.stabilityScore, competition_score: metrics.competitionScore,
    supply_score: metrics.supplyScore, ad_burden_score: metrics.adBurdenScore, entry_difficulty_score: metrics.entryDifficultyScore,
    opportunity_score: metrics.opportunityScore, confidence: metrics.confidence, evidence: metrics,
  });
  if (featureError) throw new Error(featureError.message);

  const periodEnd = new Date(analyzedAt);
  const periodStart = new Date(periodEnd.getTime() - 30 * 86_400_000);
  const averagePrice = metrics.latestPrice ?? 0;
  const { error: estimateError } = await supabase.from("market_estimates").insert({
    market_product_id: productId,
    period_start: periodStart.toISOString().slice(0, 10),
    period_end: periodEnd.toISOString().slice(0, 10),
    estimated_units_low: metrics.estimate.low,
    estimated_units_base: metrics.estimate.base,
    estimated_units_high: metrics.estimate.high,
    estimated_sales_low: metrics.estimate.low * averagePrice,
    estimated_sales_base: metrics.estimate.base * averagePrice,
    estimated_sales_high: metrics.estimate.high * averagePrice,
    confidence: metrics.confidence,
    model_version: MODEL_VERSION,
    evidence: metrics,
  });
  if (estimateError) throw new Error(estimateError.message);

  const signals: Array<{ signal_type: string; severity: "low" | "medium" | "high"; title: string; evidence: unknown }> = [];
  if (metrics.reviewDelta7d >= 5) signals.push({ signal_type: "review_growth", severity: metrics.reviewDelta7d >= 20 ? "high" : "medium", title: `리뷰 급증: 7일 +${metrics.reviewDelta7d}`, evidence: metrics });
  if ((metrics.rankChange7d ?? 0) >= 5) signals.push({ signal_type: "rank_rise", severity: (metrics.rankChange7d ?? 0) >= 20 ? "high" : "medium", title: `검색 순위 상승: ${(metrics.rankChange7d ?? 0)}단계`, evidence: metrics });
  if (metrics.priceChange7dPct != null && Math.abs(metrics.priceChange7dPct) >= 10) signals.push({ signal_type: "price_change", severity: Math.abs(metrics.priceChange7dPct) >= 25 ? "high" : "medium", title: `가격 급변: ${metrics.priceChange7dPct.toFixed(1)}%`, evidence: metrics });
  if (metrics.stockoutCount30d > 0) signals.push({ signal_type: "stockout", severity: metrics.stockoutCount30d >= 3 ? "high" : "medium", title: `품절 전환 ${metrics.stockoutCount30d}회`, evidence: metrics });

  if (signals.length) {
    const { error: signalError } = await supabase.from("market_signals").insert(signals.map((signal) => ({ ...signal, market_product_id: productId })));
    if (signalError) throw new Error(signalError.message);
  }

  return { productId, metrics, signalsCreated: signals.length, estimatesCreated: 1 };
}

export async function analyzeAllMarketProducts(limit = 300) {
  const startedAt = new Date().toISOString();
  const { data: products, error } = await supabase.from("market_products").select("id").order("last_seen_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);

  const { data: run, error: runError } = await supabase.from("market_analysis_runs").insert({ status: "started", requested_products: products?.length ?? 0, started_at: startedAt, model_version: MODEL_VERSION }).select("id").single();
  if (runError) throw new Error(runError.message);

  let analyzedProducts = 0;
  let signalsCreated = 0;
  let estimatesCreated = 0;
  const failures: string[] = [];
  for (const product of products ?? []) {
    try {
      const result = await analyzeMarketProduct(product.id);
      if (result) {
        analyzedProducts += 1;
        signalsCreated += result.signalsCreated;
        estimatesCreated += result.estimatesCreated;
      }
    } catch (error) {
      failures.push(`#${product.id}: ${error instanceof Error ? error.message : "분석 오류"}`);
    }
  }

  const status = failures.length === 0 ? "success" : analyzedProducts > 0 ? "partial" : "failed";
  await supabase.from("market_analysis_runs").update({ status, analyzed_products: analyzedProducts, signals_created: signalsCreated, estimates_created: estimatesCreated, error_message: failures.slice(0, 10).join(" | ") || null, finished_at: new Date().toISOString() }).eq("id", run.id);
  return { runId: run.id, status, requestedProducts: products?.length ?? 0, analyzedProducts, signalsCreated, estimatesCreated, failures };
}
