import { getMarketRuntimeClient } from "../lib/supabase/market-runtime.server";
import { getLatestAutonomousMarketIntelligence } from "./autonomous-market-discovery.service";
import {
  ITEM_DISCOVERY_WORKBENCH_VERSION,
  buildKeywordFinderProfiles,
  buildShoppingContentFeed,
  buildContentClusters,
  buildFinderAlerts,
  type FinderPriceObservation,
  type FinderSignalRow,
} from "../lib/market/item-discovery-workbench";
import type { MarketOpportunity } from "../lib/market/autonomous-intelligence";

type SnapshotRecord = Readonly<{
  price?: unknown;
  rank?: unknown;
  review_count?: unknown;
  observed_at?: unknown;
}>;

type ProductRecord = Readonly<{
  id?: unknown;
  title?: unknown;
  source?: unknown;
  product_url?: unknown;
  market_snapshots?: SnapshotRecord[] | SnapshotRecord | null;
}>;

const numberOrNull = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const record = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function getItemDiscoveryFinder(): Promise<Record<string, unknown>> {
  const intelligence = await getLatestAutonomousMarketIntelligence();
  let supabase;
  try {
    supabase = getMarketRuntimeClient();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "MARKET_RUNTIME_STORAGE_UNAVAILABLE") throw error;
    const opportunities = Array.isArray(intelligence.trends) ? intelligence.trends as MarketOpportunity[] : [];
    return Object.freeze({
      version: ITEM_DISCOVERY_WORKBENCH_VERSION,
      generatedAt: new Date().toISOString(),
      status: "STORAGE_UNAVAILABLE",
      summary: { trackedKeywords: 0, trendCount: opportunities.length, actionableCount: 0, contentCount: 0, channelCount: 0, providerCount: 0 },
      keywords: [],
      keywordProfiles: buildKeywordFinderProfiles({ opportunities, signals: [], prices: [] }),
      contentFeed: [],
      contentClusters: [],
      alerts: [],
      channels: [],
      priceObservations: [],
      providerCoverage: [],
      recommendations: Array.isArray(intelligence.items) ? intelligence.items : [],
      skuRankings: Array.isArray(intelligence.skuRankings) ? intelligence.skuRankings : [],
      skuVerificationQueue: Array.isArray(intelligence.skuVerificationQueue) ? intelligence.skuVerificationQueue : [],
      skuRankingAudit: record(intelligence.skuRankingAudit),
      skuDiscoveryLoop: record(intelligence.skuDiscoveryLoop),
      collectorHealth: [],
      completedAt: intelligence.completedAt ?? null,
    });
  }
  const [signalResult, productResult, keywordResult, collectorResult] = await Promise.all([
    supabase.from("market_keyword_signal_snapshots")
      .select("concept,provider,observed_at,demand_index,content_velocity,shopping_intent,competition_pressure,price_room,evidence")
      .order("observed_at", { ascending: false }).limit(1_500),
    supabase.from("market_products")
      .select("id,title,source,product_url,market_snapshots(price,rank,review_count,observed_at)")
      .order("last_seen_at", { ascending: false }).limit(500),
    supabase.from("market_keywords")
      .select("id,keyword,category,priority,collection_status,collection_interval_minutes,last_collected_at,next_collection_at,discovery_lane,evidence_count")
      .order("priority", { ascending: false }).limit(200),
    supabase.from("market_collectors")
      .select("collector_key,name,status,last_success_at,last_error,failure_count")
      .order("collector_key", { ascending: true }).limit(100),
  ]);
  if (signalResult.error) throw new Error(signalResult.error.message);
  if (productResult.error) throw new Error(productResult.error.message);
  if (keywordResult.error) throw new Error(keywordResult.error.message);
  if (collectorResult.error) throw new Error(collectorResult.error.message);

  const signals: FinderSignalRow[] = (signalResult.data ?? []).map((row) => {
    const item = record(row);
    return {
      concept: String(item.concept ?? ""),
      provider: String(item.provider ?? "unknown"),
      observedAt: String(item.observed_at ?? ""),
      demandIndex: numberOrNull(item.demand_index),
      contentVelocity: numberOrNull(item.content_velocity),
      shoppingIntent: numberOrNull(item.shopping_intent),
      competitionPressure: numberOrNull(item.competition_pressure),
      priceRoom: numberOrNull(item.price_room),
      evidence: Object.freeze(record(item.evidence)),
    };
  }).filter((row) => row.concept.length >= 2 && Number.isFinite(Date.parse(row.observedAt)));

  const prices: FinderPriceObservation[] = (productResult.data ?? []).flatMap((value): FinderPriceObservation[] => {
    const product = value as ProductRecord;
    const snapshots = Array.isArray(product.market_snapshots) ? product.market_snapshots : product.market_snapshots ? [product.market_snapshots] : [];
    const latest = [...snapshots].sort((left, right) => Date.parse(String(right.observed_at ?? "")) - Date.parse(String(left.observed_at ?? "")))[0];
    const price = numberOrNull(latest?.price);
    if (price === null || price <= 0 || typeof product.title !== "string") return [];
    return [{
      productId: Number(product.id),
      title: product.title,
      source: String(product.source ?? "unknown"),
      url: typeof product.product_url === "string" ? product.product_url : null,
      price,
      rank: numberOrNull(latest?.rank),
      reviewCount: numberOrNull(latest?.review_count),
      observedAt: String(latest?.observed_at ?? ""),
    }];
  });

  const opportunities = Array.isArray(intelligence.trends) ? intelligence.trends as MarketOpportunity[] : [];
  const contentFeed = buildShoppingContentFeed(signals, 40);
  const keywordProfiles = buildKeywordFinderProfiles({ opportunities, signals, prices });
  const contentClusters = buildContentClusters(contentFeed);
  const alerts = buildFinderAlerts(keywordProfiles, contentFeed);
  const channelMap = new Map<string, { channelTitle: string; contentCount: number; totalViews: number; shorts: number; latestAt: string; keywords: Set<string> }>();
  for (const content of contentFeed.filter((item) => item.platform === "YOUTUBE" && item.channelTitle)) {
    const key = content.channelTitle ?? "";
    const current = channelMap.get(key) ?? { channelTitle: key, contentCount: 0, totalViews: 0, shorts: 0, latestAt: content.observedAt, keywords: new Set<string>() };
    current.contentCount += 1;
    current.totalViews += content.viewCount ?? 0;
    current.shorts += content.isShort ? 1 : 0;
    if (Date.parse(content.observedAt) > Date.parse(current.latestAt)) current.latestAt = content.observedAt;
    current.keywords.add(content.keyword);
    channelMap.set(key, current);
  }
  const channels = [...channelMap.values()].map((item) => ({
    channelTitle: item.channelTitle,
    contentCount: item.contentCount,
    totalViews: item.totalViews,
    shortsRatio: Math.round(item.shorts / Math.max(1, item.contentCount) * 100),
    latestAt: item.latestAt,
    keywords: [...item.keywords].sort((left, right) => left.localeCompare(right, "ko")),
  })).sort((left, right) => right.totalViews - left.totalViews || right.contentCount - left.contentCount || left.channelTitle.localeCompare(right.channelTitle, "ko"));

  const providerCoverage = [...new Set(signals.map((item) => item.provider))].sort();
  return Object.freeze({
    version: ITEM_DISCOVERY_WORKBENCH_VERSION,
    generatedAt: new Date().toISOString(),
    status: intelligence.status ?? "EMPTY",
    summary: {
      trackedKeywords: (keywordResult.data ?? []).length,
      trendCount: opportunities.length,
      actionableCount: opportunities.filter((item) => item.state !== "DECLINING" && item.state !== "SATURATED").length,
      contentCount: contentFeed.length,
      channelCount: channels.length,
      providerCount: providerCoverage.length,
    },
    keywords: keywordResult.data ?? [],
    keywordProfiles,
    contentFeed,
    contentClusters,
    alerts,
    channels,
    priceObservations: prices.slice(0, 100),
    providerCoverage,
    recommendations: Array.isArray(intelligence.items) ? intelligence.items : [],
    skuRankings: Array.isArray(intelligence.skuRankings) ? intelligence.skuRankings : [],
    skuVerificationQueue: Array.isArray(intelligence.skuVerificationQueue) ? intelligence.skuVerificationQueue : [],
    skuRankingAudit: record(intelligence.skuRankingAudit),
    skuDiscoveryLoop: record(intelligence.skuDiscoveryLoop),
    collectorHealth: collectorResult.data ?? [],
    completedAt: intelligence.completedAt ?? null,
  });
}
