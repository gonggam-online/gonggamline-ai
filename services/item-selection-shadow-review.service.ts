import { supabase } from "../lib/supabase";
import {
  buildItemSelectionShadowReview,
  type ItemSelectionShadowReviewInput,
  type ItemSelectionShadowReviewPacket,
} from "../shared/domain/item-selection-shadow-review";

export async function readItemSelectionShadowReview(
  input: Omit<ItemSelectionShadowReviewInput, "market"> & { marketProductId: number },
): Promise<ItemSelectionShadowReviewPacket> {
  const [{ data: product, error: productError }, { data: metric, error: metricError }, { data: snapshots, error: snapshotError }] = await Promise.all([
    supabase.from("market_products").select("source").eq("id", input.marketProductId).maybeSingle(),
    supabase.from("market_product_metrics").select("*").eq("market_product_id", input.marketProductId).maybeSingle(),
    supabase.from("market_snapshots").select("observed_at").eq("market_product_id", input.marketProductId).order("observed_at", { ascending: false }).limit(1),
  ]);
  if (productError) throw new Error(productError.message);
  if (metricError) throw new Error(metricError.message);
  if (snapshotError) throw new Error(snapshotError.message);
  if (!product || !metric || !snapshots?.[0]?.observed_at) throw new Error("MARKET_SHADOW_EVIDENCE_NOT_FOUND");

  const source = product.source === "naver_official" || product.source === "coupang_public" || product.source === "manual" || product.source === "internal_sales"
    ? product.source
    : "manual";
  return buildItemSelectionShadowReview({
    providerItemNumber: input.providerItemNumber,
    currentVerdict: input.currentVerdict,
    currentScore: input.currentScore,
    profitabilityStatus: input.profitabilityStatus,
    contributionMarginRate: input.contributionMarginRate,
    rightsStatus: input.rightsStatus,
    market: {
      observedAt: snapshots[0].observed_at,
      source,
      opportunityScore: metric.opportunity_score,
      demandScore: metric.demand_score,
      growthScore: metric.growth_score,
      competitionScore: metric.competition_score,
      supplyScore: metric.supply_score,
      adBurdenScore: metric.ad_burden_score,
      entryDifficultyScore: metric.entry_difficulty_score,
      confidence: metric.confidence,
      dataCompletenessScore: metric.data_completeness_score,
      estimatedUnitsBase: metric.estimated_units_base,
    },
  });
}
