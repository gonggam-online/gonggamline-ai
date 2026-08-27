import { createHash } from "node:crypto";

import { getMarketRuntimeClient } from "../lib/supabase/market-runtime.server";
import {
  MARKET_INTELLIGENCE_VERSION,
  buildMarketItemRecommendations,
  buildMarketTrendDigest,
  extractBoundedMarketPhrases,
  normalizeMarketConcept,
  type MarketProductCandidateInput,
  type MarketTrendEvidence,
} from "../lib/market/autonomous-intelligence";
import type { MarketObservationCollectorResult } from "./market-observation-collector.service";
import { buildSkuMarketRankings, type SkuMarketProduct, type SkuSupplierQuote } from "../lib/market/sku-market-ranking";
import type { ExternalMarketSignalPacket } from "../shared/contracts/external-market-signal-packet";

type SignalLike = Readonly<{
  sourceId: string;
  query: string;
  title: string;
  observedAt: string;
  rank: number | null;
  popularityScore: number | null;
  contentVelocity: number | null;
  channelId?: string | null;
  channelTitle?: string | null;
  channelCountry?: string | null;
  description?: string | null;
  tags?: readonly string[] | null;
  thumbnailUrl?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  subscriberCount?: number | null;
  durationSeconds?: number | null;
  isShort?: boolean | null;
}>;

type SignalSnapshotRow = {
  id: number | string;
  concept: string;
  provider: string;
  observed_at: string;
  demand_index: number | string | null;
  content_velocity: number | string | null;
  shopping_intent: number | string | null;
  competition_pressure: number | string | null;
  price_room: number | string | null;
  evidence_digest: string;
};

type ProductRow = {
  id: number | string;
  external_product_id?: string | null;
  vendor_item_id?: string | null;
  product_url?: string | null;
  title: string;
  category: string | null;
  source: string | null;
  brand: string | null;
  market_product_metrics?: Record<string, unknown> | Record<string, unknown>[] | null;
  market_snapshots?: Record<string, unknown> | Record<string, unknown>[] | null;
};

const numberOrNull = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

function evidenceDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function schemaUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message) : "";
  return /market_(keyword_signal_snapshots|trend_digests|recommendation_runs|provider_usage).*does not exist|schema cache/i.test(message);
}

export async function recordAutonomousCollectionEvidence(input: Readonly<{
  keywordId: number;
  keyword: string;
  collected: MarketObservationCollectorResult;
}>): Promise<void> {
  const supabase = getMarketRuntimeClient();
  const usageDay = new Date().toISOString().slice(0, 10);
  const existing = await supabase.from("market_provider_usage").select("request_count,quota_units,reported_cost_usd")
    .eq("provider", input.collected.provider).eq("usage_day", usageDay).maybeSingle();
  if (existing.error && !schemaUnavailable(existing.error)) throw new Error(existing.error.message);
  if (!existing.error) {
    const usage = existing.data as Record<string, unknown> | null;
    const usageError = await supabase.from("market_provider_usage").upsert({
      provider: input.collected.provider,
      usage_day: usageDay,
      request_count: (numberOrNull(usage?.request_count) ?? 0) + input.collected.requestCount,
      quota_units: (numberOrNull(usage?.quota_units) ?? 0) + input.collected.quotaUnits,
      reported_cost_usd: (numberOrNull(usage?.reported_cost_usd) ?? 0) + input.collected.estimatedCostUsd,
      request_ceiling_usd: process.env.DATAFORSEO_MAX_COST_USD_PER_REQUEST ? Number(process.env.DATAFORSEO_MAX_COST_USD_PER_REQUEST) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider,usage_day" });
    if (usageError.error) throw new Error(usageError.error.message);
  }

  for (const signal of input.collected.discoverySignals as readonly SignalLike[]) {
    const concept = normalizeMarketConcept(signal.query || input.keyword);
    const provider = signal.sourceId;
    const evidenceObservedAt = provider.includes("youtube") ? new Date().toISOString() : signal.observedAt;
    const payload = {
      keywordId: input.keywordId,
      concept,
      provider,
      observedAt: evidenceObservedAt,
      sourcePublishedAt: provider.includes("youtube") ? signal.observedAt : null,
      rank: signal.rank,
      popularityScore: signal.popularityScore,
      contentVelocity: signal.contentVelocity,
      title: signal.title,
      channelId: signal.channelId ?? null,
      channelTitle: signal.channelTitle ?? null,
      channelCountry: signal.channelCountry ?? null,
      description: signal.description ?? null,
      tags: signal.tags ?? [],
      thumbnailUrl: signal.thumbnailUrl ?? null,
      viewCount: signal.viewCount ?? null,
      likeCount: signal.likeCount ?? null,
      commentCount: signal.commentCount ?? null,
      subscriberCount: signal.subscriberCount ?? null,
      durationSeconds: signal.durationSeconds ?? null,
      isShort: signal.isShort ?? null,
    };
    const digest = evidenceDigest(payload);
    const isShopping = provider.includes("shopping");
    const snapshot = await supabase.from("market_keyword_signal_snapshots").upsert({
      market_keyword_id: input.keywordId,
      concept,
      provider,
      metric_type: isShopping ? "shopping_click" : provider.includes("youtube") ? "content_velocity" : "relative_demand",
      demand_index: signal.popularityScore,
      content_velocity: signal.contentVelocity,
      shopping_intent: isShopping ? signal.popularityScore : null,
      source_rank: signal.rank,
      request_count: input.collected.requestCount,
      quota_units: input.collected.quotaUnits,
      reported_cost_usd: input.collected.estimatedCostUsd,
      evidence_digest: digest,
      evidence: payload,
      observed_at: evidenceObservedAt,
    }, { onConflict: "evidence_digest" });
    if (snapshot.error && !schemaUnavailable(snapshot.error)) throw new Error(snapshot.error.message);
  }
}

async function expandKeywordWatchlist(): Promise<readonly string[]> {
  const supabase = getMarketRuntimeClient();
  const activeResult = await supabase.from("market_keywords").select("id,keyword,collection_status").eq("collection_status", "active").limit(110);
  if (activeResult.error) throw new Error(activeResult.error.message);
  const active = (activeResult.data ?? []) as Array<{ id: number; keyword: string; collection_status: string }>;
  if (active.length >= 100) return [];
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const signalsResult = await supabase.from("market_signals").select("title,evidence").gte("detected_at", since).order("detected_at", { ascending: false }).limit(500);
  if (signalsResult.error) throw new Error(signalsResult.error.message);
  const sourceRows = (signalsResult.data ?? []).map((row) => {
    const record = row as { title?: unknown; evidence?: unknown };
    const evidence = typeof record.evidence === "object" && record.evidence !== null ? record.evidence as Record<string, unknown> : {};
    return { title: String(record.title ?? ""), provider: String(evidence.sourceId ?? "unknown") };
  });
  const extracted = extractBoundedMarketPhrases(sourceRows.map((row) => row.title), active.map((item) => item.keyword), 10);
  const phrases = extracted.filter((phrase) => new Set(sourceRows.filter((row) => normalizeMarketConcept(row.title).includes(phrase)).map((row) => row.provider)).size >= 2)
    .slice(0, Math.min(10, 100 - active.length));
  const created: string[] = [];
  for (const phrase of phrases) {
    const keywordResult = await supabase.from("market_keywords").upsert({
      keyword: phrase,
      category: "자동 탐색",
      priority: 45,
      collection_status: "active",
      collection_interval_minutes: 1440,
      next_collection_at: new Date().toISOString(),
      discovery_lane: "WATCH",
      evidence_count: 2,
      updated_at: new Date().toISOString(),
    }, { onConflict: "keyword" }).select("id").single();
    if (keywordResult.error) {
      if (schemaUnavailable(keywordResult.error)) return [];
      throw new Error(keywordResult.error.message);
    }
    const keywordId = Number(keywordResult.data.id);
    for (const collectorKey of ["naver-shopping-api", "youtube-public-signals", "dataforseo-naver-serp"] as const) {
      const job = await supabase.from("market_collection_jobs").upsert({
        collector_key: collectorKey,
        market_keyword_id: keywordId,
        status: "active",
        priority: 45,
        interval_minutes: collectorKey === "dataforseo-naver-serp" ? 1440 : 720,
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "collector_key,market_keyword_id" });
      if (job.error) throw new Error(job.error.message);
    }
    created.push(phrase);
  }
  return Object.freeze(created);
}

function productMetric(row: ProductRow): Record<string, unknown> {
  const value = Array.isArray(row.market_product_metrics) ? row.market_product_metrics[0] : row.market_product_metrics;
  return value && typeof value === "object" ? value : {};
}

function productSearchKeywords(row: ProductRow): readonly string[] {
  const snapshots = Array.isArray(row.market_snapshots) ? row.market_snapshots : row.market_snapshots ? [row.market_snapshots] : [];
  return Object.freeze([...new Set(snapshots.flatMap((snapshot) => {
    const relation = snapshot.market_keywords;
    const values = Array.isArray(relation) ? relation : relation ? [relation] : [];
    return values.flatMap((value) => {
      const keyword = typeof value === "object" && value !== null ? String((value as Record<string, unknown>).keyword ?? "").trim() : "";
      return keyword.length >= 2 ? [keyword] : [];
    });
  }))].sort((left, right) => left.localeCompare(right, "ko")));
}

async function scheduleSkuDiscoveryQueries(queries: readonly string[], scheduledAt: string): Promise<Readonly<{ scheduled: readonly string[]; skippedFresh: readonly string[] }>> {
  const supabase = getMarketRuntimeClient();
  const scheduled: string[] = [];
  const skippedFresh: string[] = [];
  const freshnessCutoff = Date.parse(scheduledAt) - 18 * 3_600_000;
  for (const query of queries.slice(0, 12)) {
    const existing = await supabase.from("market_keywords").select("id,last_collected_at").eq("keyword", query).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    const existingCollectedAt = Date.parse(String((existing.data as { last_collected_at?: unknown } | null)?.last_collected_at ?? ""));
    if (Number.isFinite(existingCollectedAt) && existingCollectedAt >= freshnessCutoff) {
      skippedFresh.push(query);
      continue;
    }
    const keyword = await supabase.from("market_keywords").upsert({
      keyword: query,
      category: "SKU 자동 교차검증",
      priority: 85,
      collection_status: "active",
      collection_interval_minutes: 720,
      next_collection_at: scheduledAt,
      discovery_lane: "EXPLORE",
      updated_at: scheduledAt,
    }, { onConflict: "keyword" }).select("id").single();
    if (keyword.error) throw new Error(keyword.error.message);
    for (const collectorKey of ["naver-shopping-api", "dataforseo-naver-serp", "youtube-public-signals"] as const) {
      const job = await supabase.from("market_collection_jobs").upsert({
        collector_key: collectorKey,
        market_keyword_id: Number(keyword.data.id),
        status: "active",
        priority: 85,
        interval_minutes: collectorKey === "dataforseo-naver-serp" ? 1440 : 720,
        next_run_at: scheduledAt,
        updated_at: scheduledAt,
      }, { onConflict: "collector_key,market_keyword_id" });
      if (job.error) throw new Error(job.error.message);
    }
    scheduled.push(query);
  }
  return Object.freeze({ scheduled: Object.freeze(scheduled), skippedFresh: Object.freeze(skippedFresh) });
}

export async function rebuildAutonomousMarketIntelligence(): Promise<Record<string, unknown>> {
  const supabase = getMarketRuntimeClient();
  const startedAt = new Date().toISOString();
  try {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [snapshotResult, productResult, packetResult, quoteResult] = await Promise.all([
      supabase.from("market_keyword_signal_snapshots").select("id,concept,provider,observed_at,demand_index,content_velocity,shopping_intent,competition_pressure,price_room,evidence_digest")
        .gte("observed_at", since).order("observed_at", { ascending: true }).limit(5_000),
      supabase.from("market_products").select("id,external_product_id,vendor_item_id,product_url,title,category,source,brand,market_product_metrics(opportunity_score,confidence),market_snapshots(price,review_count,rank,rocket_type,observed_at,market_keywords(keyword))")
        .order("last_seen_at", { ascending: false }).limit(500),
      supabase.from("external_market_signal_packets").select("packet").order("collected_at", { ascending: false }).limit(2_000),
      supabase.from("supplier_quotes").select("id,product_name,supplier_sku,unit_cost,moq,domestic_shipping_total,inspection_total,packaging_total,labeling_total,three_pl_inbound_total,three_pl_storage_per_unit,three_pl_outbound_per_unit,coupang_fee_rate,expected_return_rate,valid_until,status,updated_at")
        .in("status", ["received", "selected"]).order("updated_at", { ascending: false }).limit(500),
    ]);
    if (snapshotResult.error) throw new Error(snapshotResult.error.message);
    if (productResult.error) throw new Error(productResult.error.message);
    if (packetResult.error) throw new Error(packetResult.error.message);
    if (quoteResult.error) throw new Error(quoteResult.error.message);
    const evidence: MarketTrendEvidence[] = ((snapshotResult.data ?? []) as SignalSnapshotRow[]).map((row) => ({
      concept: row.concept,
      provider: row.provider,
      observedAt: row.observed_at,
      demandIndex: numberOrNull(row.demand_index),
      contentVelocity: numberOrNull(row.content_velocity),
      shoppingIntent: numberOrNull(row.shopping_intent),
      competitionPressure: numberOrNull(row.competition_pressure),
      priceRoom: numberOrNull(row.price_room),
      evidenceId: row.evidence_digest || String(row.id),
    }));
    const trend = buildMarketTrendDigest(evidence, { expectedProviders: 3, limit: 20 });
    const products: MarketProductCandidateInput[] = ((productResult.data ?? []) as ProductRow[]).map((row) => {
      const metric = productMetric(row);
      return { id: Number(row.id), title: row.title, category: row.category, source: row.source, brand: row.brand, opportunityScore: numberOrNull(metric.opportunity_score), confidence: numberOrNull(metric.confidence) };
    });
    const items = buildMarketItemRecommendations(trend.opportunities, products, 20);
    const skuProducts: SkuMarketProduct[] = ((productResult.data ?? []) as ProductRow[]).map((row) => {
      const metric = productMetric(row);
      const snapshots = Array.isArray(row.market_snapshots) ? row.market_snapshots : row.market_snapshots ? [row.market_snapshots] : [];
      const latest = [...snapshots].sort((left, right) => Date.parse(String(right.observed_at ?? "")) - Date.parse(String(left.observed_at ?? "")))[0] ?? {};
      return {
        id: Number(row.id), externalProductId: String(row.external_product_id ?? ""), vendorItemId: row.vendor_item_id ?? null,
        title: row.title, source: row.source ?? "unknown", url: row.product_url ?? null, brand: row.brand ?? null, category: row.category ?? null,
        price: numberOrNull(latest.price), reviewCount: numberOrNull(latest.review_count), rank: numberOrNull(latest.rank),
        rocketType: typeof latest.rocket_type === "string" ? latest.rocket_type : null,
        observedAt: typeof latest.observed_at === "string" ? latest.observed_at : null,
        opportunityScore: numberOrNull(metric.opportunity_score), confidence: numberOrNull(metric.confidence),
        searchKeywords: productSearchKeywords(row),
      };
    });
    const packets = (packetResult.data ?? []).map((row) => (row as { packet: ExternalMarketSignalPacket }).packet).filter(Boolean);
    const quotes: SkuSupplierQuote[] = (quoteResult.data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: Number(item.id), productName: String(item.product_name ?? ""), supplierSku: typeof item.supplier_sku === "string" ? item.supplier_sku : null,
        unitCost: numberOrNull(item.unit_cost) ?? 0, moq: Math.max(1, numberOrNull(item.moq) ?? 1), domesticShippingTotal: numberOrNull(item.domestic_shipping_total) ?? 0,
        inspectionTotal: numberOrNull(item.inspection_total) ?? 0, packagingTotal: numberOrNull(item.packaging_total) ?? 0,
        labelingTotal: numberOrNull(item.labeling_total) ?? 0, threePlInboundTotal: numberOrNull(item.three_pl_inbound_total) ?? 0,
        threePlStoragePerUnit: numberOrNull(item.three_pl_storage_per_unit) ?? 0, threePlOutboundPerUnit: numberOrNull(item.three_pl_outbound_per_unit) ?? 0,
        coupangFeeRate: numberOrNull(item.coupang_fee_rate) ?? 10.8, expectedReturnRate: numberOrNull(item.expected_return_rate) ?? 3,
        validUntil: typeof item.valid_until === "string" ? item.valid_until : null, status: String(item.status ?? "draft"), updatedAt: String(item.updated_at ?? startedAt),
      };
    });
    const skuRanking = buildSkuMarketRankings({ opportunities: trend.opportunities, products: skuProducts, packets, quotes, now: new Date(startedAt), limit: 10 });
    const skuDiscoveryLoop = await scheduleSkuDiscoveryQueries(skuRanking.discoveryQueries, startedAt);
    const keywordRows = await supabase.from("market_keywords").select("id,keyword,discovery_lane").limit(500);
    if (keywordRows.error) throw new Error(keywordRows.error.message);
    const keywordsByConcept = new Map((keywordRows.data ?? []).map((row) => [normalizeMarketConcept(String((row as { keyword?: unknown }).keyword ?? "")), row as { id: number; keyword: string; discovery_lane: string }]));
    for (const opportunity of trend.opportunities) {
      const lifecycle = opportunity.state === "INSUFFICIENT_EVIDENCE" ? "WATCH" : opportunity.providers.length >= 2 ? "ACTIVE" : "EXPLORE";
      const conceptResult = await supabase.from("market_concepts").upsert({
        canonical_phrase: opportunity.concept,
        lifecycle,
        evidence_count: opportunity.evidenceIds.length,
        source_count: opportunity.providers.length,
        conflict_state: "CLEAR",
        last_evidence_at: opportunity.asOf,
        updated_at: new Date().toISOString(),
      }, { onConflict: "canonical_phrase" });
      if (conceptResult.error) throw new Error(conceptResult.error.message);
      const keywordRow = keywordsByConcept.get(normalizeMarketConcept(opportunity.concept));
      if (keywordRow) {
        const nextLane = keywordRow.discovery_lane === "CORE" ? "CORE" : lifecycle === "ACTIVE" ? "EXPLORE" : "WATCH";
        const keywordUpdate = await supabase.from("market_keywords").update({
          discovery_lane: nextLane,
          evidence_count: opportunity.evidenceIds.length,
          priority: Math.max(35, Math.min(95, Math.round(opportunity.score))),
          ...(nextLane === "EXPLORE" ? { promoted_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        }).eq("id", keywordRow.id);
        if (keywordUpdate.error) throw new Error(keywordUpdate.error.message);
      }
    }
    const staleExplorationCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const decayResult = await supabase.from("market_keywords").update({ collection_status: "paused", paused_reason: "NO_FRESH_EVIDENCE_30D", updated_at: new Date().toISOString() })
      .in("discovery_lane", ["WATCH", "EXPLORE"]).lt("last_collected_at", staleExplorationCutoff);
    if (decayResult.error) throw new Error(decayResult.error.message);
    for (const item of items) {
      const entity = await supabase.from("market_candidate_entities").upsert({
        entity_key: item.candidateId,
        canonical_title: item.title,
        candidate_form: item.form,
        market_product_ids: item.marketProductIds,
        concept_ids: [],
        identity_confidence: Math.round(item.confidence),
        evidence_digest: evidenceDigest({ candidateId: item.candidateId, concept: item.concept, marketProductIds: item.marketProductIds, score: item.score }),
        updated_at: new Date().toISOString(),
      }, { onConflict: "entity_key" });
      if (entity.error) throw new Error(entity.error.message);
    }
    const discoveredKeywords = await expandKeywordWatchlist();
    const providerHealth = trend.opportunities.reduce<Record<string, number>>((health, opportunity) => {
      for (const provider of opportunity.providers) health[provider] = (health[provider] ?? 0) + 1;
      return health;
    }, {});
    const output = {
      version: MARKET_INTELLIGENCE_VERSION,
      asOf: trend.asOf,
      status: trend.status,
      brief: {
        headline: trend.opportunities.length ? `${trend.opportunities[0].concept} 등 ${trend.opportunities.length}개 시장 수요를 추적 중입니다.` : "새로운 유효 시장 신호를 기다리고 있습니다.",
        sourceCount: Object.keys(providerHealth).length,
        trendCount: trend.opportunities.length,
        itemCount: items.length,
      },
      trends: trend.opportunities,
      items,
      skuRankings: skuRanking.rankings,
      skuVerificationQueue: skuRanking.verificationQueue,
      skuRankingAudit: skuRanking.audit,
      skuRankingDigest: skuRanking.digest,
      skuDiscoveryLoop,
      discoveredKeywords,
      providerHealth,
    };
    const insertedTrend = await supabase.from("market_trend_digests").upsert({
      version: trend.version,
      digest: trend.digest,
      status: trend.status,
      as_of: trend.asOf,
      provider_health: providerHealth,
      output,
    }, { onConflict: "digest" }).select("id").single();
    if (insertedTrend.error) throw new Error(insertedTrend.error.message);
    const runDigest = evidenceDigest({ trendDigest: trend.digest, itemIds: items.map((item) => item.candidateId), discoveredKeywords });
    const run = await supabase.from("market_recommendation_runs").upsert({
      trend_digest_id: insertedTrend.data.id,
      version: MARKET_INTELLIGENCE_VERSION,
      digest: runDigest,
      status: trend.status,
      recommendation_count: items.length,
      output,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    }, { onConflict: "digest" }).select("id").single();
    if (run.error) throw new Error(run.error.message);
    return { ...output, runId: run.data.id, digest: runDigest };
  } catch (error) {
    if (schemaUnavailable(error)) return { status: "SCHEMA_PENDING", message: "Migration 027 is required." };
    throw error;
  }
}

export async function getLatestAutonomousMarketIntelligence(): Promise<Record<string, unknown>> {
  try {
    const supabase = getMarketRuntimeClient();
    const result = await supabase.from("market_recommendation_runs").select("id,version,digest,status,recommendation_count,output,completed_at")
      .in("status", ["COMPLETE", "PARTIAL", "EMPTY"]).order("completed_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) {
      if (schemaUnavailable(result.error)) return { status: "SCHEMA_PENDING", trends: [], items: [] };
      throw new Error(result.error.message);
    }
    return result.data ? { ...(result.data.output as Record<string, unknown>), runId: result.data.id, digest: result.data.digest, completedAt: result.data.completed_at } : { status: "EMPTY", trends: [], items: [] };
  } catch (error) {
    if (error instanceof Error && error.message === "MARKET_RUNTIME_STORAGE_UNAVAILABLE") {
      return { status: "STORAGE_UNAVAILABLE", trends: [], items: [] };
    }
    throw error;
  }
}
