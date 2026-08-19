import { supabase } from "../lib/supabase";
import type { ItemSelectionMarketMetric } from "../shared/domain/item-selection-market-enrichment";

export type MarketEnrichmentRecord = Readonly<{
  marketProductId: number;
  metric: ItemSelectionMarketMetric;
  observedAt: string | null;
}>;

export async function loadItemSelectionMarketEnrichment(
  providerItemNumbers: readonly string[],
): Promise<ReadonlyMap<string, MarketEnrichmentRecord>> {
  if (providerItemNumbers.length === 0) return new Map();
  const { data: products, error: productError } = await supabase
    .from("market_products")
    .select("id,vendor_item_id,source")
    .in("vendor_item_id", [...new Set(providerItemNumbers)]);
  if (productError) throw productError;
  const eligible = (products ?? []).filter((product) =>
    typeof product.vendor_item_id === "string" &&
    (product.source === "coupang_public" || product.source === "naver_official" || product.source === "manual"),
  );
  if (eligible.length === 0) return new Map();
  const ids = eligible.map((product) => product.id as number);
  const [{ data: metrics, error: metricError }, { data: snapshots, error: snapshotError }] = await Promise.all([
    supabase.from("market_product_metrics").select("*").in("market_product_id", ids),
    supabase.from("market_snapshots").select("market_product_id,observed_at").in("market_product_id", ids).order("observed_at", { ascending: false }),
  ]);
  if (metricError) throw metricError;
  if (snapshotError) throw snapshotError;
  const metricByProduct = new Map((metrics ?? []).map((metric) => [metric.market_product_id as number, metric]));
  const observedByProduct = new Map<number, string>();
  for (const snapshot of snapshots ?? []) {
    if (!observedByProduct.has(snapshot.market_product_id as number) && typeof snapshot.observed_at === "string") {
      observedByProduct.set(snapshot.market_product_id as number, snapshot.observed_at);
    }
  }
  const result = new Map<string, MarketEnrichmentRecord>();
  for (const product of eligible) {
    const metric = metricByProduct.get(product.id as number);
    if (!metric) continue;
    result.set(product.vendor_item_id as string, {
      marketProductId: product.id as number,
      observedAt: observedByProduct.get(product.id as number) ?? null,
      metric: {
        opportunityScore: metric.opportunity_score ?? null,
        demandScore: metric.demand_score ?? null,
        growthScore: metric.growth_score ?? null,
        supplyScore: metric.supply_score ?? null,
        confidence: metric.confidence ?? null,
      },
    });
  }
  return result;
}
