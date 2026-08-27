import { supabase } from "../lib/supabase";
import { analyzeMarketProduct } from "./market-analysis.service";
import { collectConfiguredMarketObservations } from "./market-observation-collector.service";
import type { MarketObservationCollectorResult } from "./market-observation-collector.service";
import { saveMarketObservation } from "./market-observation.service";
import type { CollectorRunResult } from "../types/collector";
import { collectDataForSeoCoupangPrices } from "../lib/market/external-provider-adapters";

function nextRun(intervalMinutes: number) {
  return new Date(Date.now() + intervalMinutes * 60_000).toISOString();
}

export async function listCollectorState() {
  const [{ data: collectors, error: collectorError }, { data: jobs, error: jobError }] = await Promise.all([
    supabase.from("market_collectors").select("*").order("collector_key"),
    supabase.from("market_collection_jobs").select("*, market_keywords(keyword)").order("priority", { ascending: false }),
  ]);
  if (collectorError) throw new Error(collectorError.message);
  if (jobError) throw new Error(jobError.message);
  return { collectors: collectors ?? [], jobs: jobs ?? [] };
}

export async function createCollectionJob(input: { collectorKey: string; keywordId: number; intervalMinutes?: number; priority?: number }) {
  const intervalMinutes = Math.max(60, input.intervalMinutes ?? 720);
  const { data, error } = await supabase.from("market_collection_jobs").upsert({
    collector_key: input.collectorKey,
    market_keyword_id: input.keywordId,
    interval_minutes: intervalMinutes,
    priority: input.priority ?? 50,
    status: "active",
    next_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "collector_key,market_keyword_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export const PROVIDER_VERIFICATION_COLLECTOR_KEYS = Object.freeze([
  "naver-shopping-api",
  "dataforseo-naver-serp",
  "youtube-public-signals",
] as const);

export async function runDueCollectionJobs(limit = 20, collectorKey?: string, refreshIntelligence = true): Promise<{ results: CollectorRunResult[]; intelligence?: Record<string, unknown> }> {
  const now = new Date().toISOString();
  const staleLease = new Date(Date.now() - 15 * 60_000).toISOString();
  const recovered = await supabase.from("market_collection_jobs").update({ status: "active", updated_at: now })
    .eq("status", "running").lt("last_run_at", staleLease);
  if (recovered.error) throw new Error(recovered.error.message);
  const boundedLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  let dueJobsQuery = supabase
    .from("market_collection_jobs")
    .select("id,collector_key,market_keyword_id,interval_minutes,market_keywords(keyword,category)")
    .eq("status", "active")
    .lte("next_run_at", now);
  if (collectorKey) dueJobsQuery = dueJobsQuery.eq("collector_key", collectorKey);
  const { data: jobs, error } = await dueJobsQuery
    .order("priority", { ascending: false })
    .limit(boundedLimit);
  if (error) throw new Error(error.message);

  const results: CollectorRunResult[] = [];
  for (const job of jobs ?? []) {
    const { data: claimedJob, error: claimError } = await supabase
      .from("market_collection_jobs")
      .update({ status: "running", last_run_at: now, updated_at: now })
      .eq("id", job.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimedJob) continue;
    const keywordRelation = Array.isArray(job.market_keywords) ? job.market_keywords[0] : job.market_keywords;
    const keyword = keywordRelation?.keyword ?? "미지정";
    const keywordCategory = keywordRelation?.category ?? null;

    let result: CollectorRunResult;
    if (job.collector_key === "demo-generator") {
      result = {
        collectorKey: job.collector_key,
        requested: 1,
        saved: 0,
        analyzed: 0,
        status: "skipped",
        message: `DEMO 생성은 화면의 DEMO 검증 버튼으로 실행합니다. (${keyword})`,
      };
    } else if (job.collector_key === "internal-sales") {
      result = {
        collectorKey: job.collector_key,
        requested: 1,
        saved: 0,
        analyzed: 0,
        status: "success",
        message: `내부 실매출 피드백 큐 점검 완료: ${keyword}`,
      };
    } else if (job.collector_key === "official-api-adapter" || job.collector_key === "public-observation-adapter" || job.collector_key === "naver-shopping-api" || job.collector_key === "dataforseo-naver-serp" || job.collector_key === "youtube-public-signals") {
      const startedAt = new Date().toISOString();
      const { data: run, error: runError } = await supabase.from("market_collection_runs").insert({
        collector: job.collector_key,
        keyword_id: job.market_keyword_id,
        status: "started",
        requested_count: 1,
        started_at: startedAt,
      }).select("id").single();
      if (runError) throw new Error(runError.message);
      try {
        const isNaver = job.collector_key === "naver-shopping-api";
        const isYoutube = job.collector_key === "youtube-public-signals";
        let collected: MarketObservationCollectorResult;
        if (job.collector_key === "dataforseo-naver-serp" && keywordCategory === "SKU 자동 교차검증") {
          const coupang = await collectDataForSeoCoupangPrices(keyword);
          collected = Object.freeze({
            observations: coupang.observations,
            discoverySignals: Object.freeze([]),
            endpoint: "native:dataforseo-coupang-price",
            source: "coupang_public",
            provider: "dataforseo_naver",
            requestCount: coupang.requestCount,
            quotaUnits: 0,
            estimatedCostUsd: coupang.estimatedCostUsd,
          });
        } else {
          collected = await collectConfiguredMarketObservations({
            collectorKey: isNaver ? "official-api-adapter" : "public-observation-adapter",
            provider: isNaver ? "naver_api_hub" : isYoutube ? "youtube_data" : "dataforseo_naver",
            keyword,
            allowSignalOnly: isYoutube,
          });
        }
        let saved = 0;
        let analyzed = 0;
        for (const observation of collected.observations) {
          const persisted = await saveMarketObservation(observation);
          saved += 1;
          if (await analyzeMarketProduct(persisted.productId)) analyzed += 1;
        }
        for (const signal of collected.discoverySignals) {
          const { error: signalError } = await supabase.from("market_signals").insert({
            market_keyword_id: job.market_keyword_id,
            signal_type: isYoutube ? "YOUTUBE_PUBLIC_TREND" : "NAVER_API_HUB_TREND",
            severity: "medium",
            title: signal.title,
            evidence: signal,
            detected_at: signal.observedAt,
          });
          if (!signalError) saved += 1;
        }
        const { recordAutonomousCollectionEvidence } = await import("./autonomous-market-discovery.service");
        await recordAutonomousCollectionEvidence({
          keywordId: Number(job.market_keyword_id),
          keyword,
          collected,
        });
        const requested = collected.observations.length + collected.discoverySignals.length;
        const completedAt = new Date().toISOString();
        await supabase.from("market_collection_runs").update({
          status: saved === requested ? "success" : "partial",
          requested_count: requested,
          saved_count: saved,
          finished_at: completedAt,
        }).eq("id", run.id);
        result = {
          collectorKey: job.collector_key,
          requested,
          saved,
          analyzed,
          status: saved === requested ? "success" : "partial",
          message: `${keyword} 관측 ${saved}건 저장 및 분석 완료`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "MARKET_COLLECTOR_FAILED";
        const blocked = /ENDPOINT_UNAVAILABLE|FORBIDDEN|RATE_LIMITED/.test(message);
        await supabase.from("market_collection_runs").update({
          status: blocked ? "blocked" : "failed",
          error_message: message,
          finished_at: new Date().toISOString(),
        }).eq("id", run.id);
        result = {
          collectorKey: job.collector_key,
          requested: 1,
          saved: 0,
          analyzed: 0,
          status: "skipped",
          message: blocked ? `실시간 관측 차단: ${message}` : `실시간 관측 실패: ${message}`,
        };
      }
    } else {
      result = {
        collectorKey: job.collector_key,
        requested: 1,
        saved: 0,
        analyzed: 0,
        status: "skipped",
        message: `${job.collector_key}는 설정 또는 외부 실행기가 필요합니다.`,
      };
    }

    await supabase.from("market_collection_jobs").update({
      status: "active",
      next_run_at: nextRun(job.interval_minutes),
      last_result: result,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    if (result.status === "success" || result.status === "partial") {
      await supabase.from("market_keywords").update({
        last_collected_at: new Date().toISOString(),
        result_count: result.saved,
        updated_at: new Date().toISOString(),
      }).eq("id", job.market_keyword_id);
    }
    await supabase.from("market_collectors").update({
      last_run_at: now,
      ...(result.status === "success" || result.status === "partial"
        ? { status: "ready", last_success_at: new Date().toISOString(), failure_count: 0, last_error: null }
        : { status: "error", last_error: result.message }),
      updated_at: new Date().toISOString(),
    }).eq("collector_key", job.collector_key);
    results.push(result);
  }
  const intelligence = refreshIntelligence
    ? await (await import("./autonomous-market-discovery.service")).rebuildAutonomousMarketIntelligence()
    : undefined;
  return intelligence ? { results, intelligence } : { results };
}

/** Runs exactly one due job for each configured external provider. */
export async function runProviderVerificationJobs(): Promise<{ results: CollectorRunResult[]; intelligence?: Record<string, unknown> }> {
  const results: CollectorRunResult[] = [];
  for (const collectorKey of PROVIDER_VERIFICATION_COLLECTOR_KEYS) {
    const verification = await runDueCollectionJobs(1, collectorKey, false);
    results.push(...verification.results);
  }
  const intelligence = results.length
    ? await (await import("./autonomous-market-discovery.service")).rebuildAutonomousMarketIntelligence()
    : undefined;
  return intelligence ? { results, intelligence } : { results };
}

export async function createDecision(productId: number) {
  const { data: metric, error } = await supabase.from("market_product_metrics").select("*").eq("market_product_id", productId).single();
  if (error) throw new Error(error.message);

  const score = Number(metric.opportunity_score ?? 0);
  const confidence = Number(metric.confidence ?? 0);
  const recommendation = confidence < 35
    ? "insufficient_data"
    : score >= 80
      ? "strong_buy"
      : score >= 65
        ? "buy"
        : score >= 45
          ? "watch"
          : "avoid";
  const rationale = metric.recommendation_reason || "시계열 지표를 기준으로 자동 생성된 진입 판단입니다.";

  const { data, error: insertError } = await supabase.from("market_ai_decisions").insert({
    market_product_id: productId,
    recommendation,
    score,
    confidence,
    rationale,
    evidence: metric,
  }).select("*").single();
  if (insertError) throw new Error(insertError.message);
  return data;
}

export async function analyzeAndDecide(productId: number) {
  const analysis = await analyzeMarketProduct(productId);
  if (!analysis) return null;
  const decision = await createDecision(productId);
  return { analysis, decision };
}
