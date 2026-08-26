import { supabase } from "../lib/supabase";
import type { ItemSelectionMarketMetric } from "../shared/domain/item-selection-market-enrichment";

export type MarketEnrichmentRecord = Readonly<{
  marketProductId: number;
  metric: ItemSelectionMarketMetric;
  observedAt: string | null;
}>;

export async function loadItemSelectionMarketEnrichment(
  providerItemNumbers: readonly string[],
  keyword?: string,
): Promise<ReadonlyMap<string, MarketEnrichmentRecord>> {
  if (providerItemNumbers.length === 0) return new Map();
  const { data: products, error: productError } = await supabase
    .from("market_products")
    .select("id,vendor_item_id,source")
    .in("vendor_item_id", [...new Set(providerItemNumbers)]);
  if (productError) throw productError;
  const eligible = (products ?? []).filter((product) =>
    typeof product.vendor_item_id === "string" &&
    (product.source === "coupang_public" || product.source === "naver_official" || product.source === "dataforseo_naver" || product.source === "manual"),
  );
  const result = new Map<string, MarketEnrichmentRecord>();
  if (eligible.length === 0) return enrichFromLatestKeywordTrend(result, providerItemNumbers, keyword);
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
        evidence: [],
      },
    });
  }
  return enrichFromLatestKeywordTrend(result, providerItemNumbers, keyword);
}

function normalized(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

async function enrichFromLatestKeywordTrend(
  existing: Map<string, MarketEnrichmentRecord>,
  providerItemNumbers: readonly string[],
  keyword?: string,
): Promise<ReadonlyMap<string, MarketEnrichmentRecord>> {
  if (!keyword?.trim() || existing.size >= providerItemNumbers.length) return existing;
  const latest = await supabase.from("market_recommendation_runs").select("digest,output,completed_at")
    .in("status", ["COMPLETE", "PARTIAL"]).order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (latest.error) return existing;
  const output = typeof latest.data?.output === "object" && latest.data.output !== null ? latest.data.output as Record<string, unknown> : {};
  const trends = Array.isArray(output.trends) ? output.trends : [];
  const target = normalized(keyword);
  const trend = trends.find((value) => {
    if (typeof value !== "object" || value === null) return false;
    const concept = String((value as Record<string, unknown>).concept ?? "");
    return normalized(concept) === target;
  });
  if (typeof trend !== "object" || trend === null || !latest.data) return existing;
  const record = trend as Record<string, unknown>;
  const observedAt = String(record.asOf ?? latest.data.completed_at ?? "");
  const digest = String(latest.data.digest ?? "");
  if (!digest || !Number.isFinite(Date.parse(observedAt))) return existing;
  const score = Number(record.score);
  const demand = Number(record.demand);
  const momentum = Number(record.momentum);
  const confidence = Number(record.confidence);
  const metric = {
    opportunityScore: Number.isFinite(score) ? score : null,
    demandScore: Number.isFinite(demand) ? demand : null,
    growthScore: Number.isFinite(momentum) ? Math.max(0, Math.min(100, momentum + 50)) : null,
    supplyScore: null,
    confidence: Number.isFinite(confidence) ? confidence : null,
    evidence: [{
      sourceType: "AUTONOMOUS_MARKET_TREND",
      sourceField: "market_recommendation_runs.output.trends",
      summary: `${keyword} 시장 수요·모멘텀·경쟁 신호`,
      observedAt,
      reference: `sha256:${digest}`,
    }],
  } as const;
  for (const providerItemNumber of providerItemNumbers) {
    if (!existing.has(providerItemNumber)) existing.set(providerItemNumber, { marketProductId: 0, metric, observedAt });
  }
  return existing;
}
