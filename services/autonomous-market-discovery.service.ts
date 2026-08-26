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

type SignalLike = Readonly<{
  sourceId: string;
  query: string;
  title: string;
  observedAt: string;
  rank: number | null;
  popularityScore: number | null;
  contentVelocity: number | null;
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
  title: string;
  category: string | null;
  source: string | null;
  market_product_metrics?: Record<string, unknown> | Record<string, unknown>[] | null;
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

export async function rebuildAutonomousMarketIntelligence(): Promise<Record<string, unknown>> {
  const supabase = getMarketRuntimeClient();
  const startedAt = new Date().toISOString();
  try {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [snapshotResult, productResult] = await Promise.all([
      supabase.from("market_keyword_signal_snapshots").select("id,concept,provider,observed_at,demand_index,content_velocity,shopping_intent,competition_pressure,price_room,evidence_digest")
        .gte("observed_at", since).order("observed_at", { ascending: true }).limit(5_000),
      supabase.from("market_products").select("id,title,category,source,market_product_metrics(opportunity_score,confidence)")
        .order("last_seen_at", { ascending: false }).limit(500),
    ]);
    if (snapshotResult.error) throw new Error(snapshotResult.error.message);
    if (productResult.error) throw new Error(productResult.error.message);
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
      return { id: Number(row.id), title: row.title, category: row.category, source: row.source, opportunityScore: numberOrNull(metric.opportunity_score), confidence: numberOrNull(metric.confidence) };
    });
    const items = buildMarketItemRecommendations(trend.opportunities, products, 20);
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
