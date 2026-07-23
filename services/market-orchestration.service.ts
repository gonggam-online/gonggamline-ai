import { supabase } from "../lib/supabase";
import { analyzeMarketProduct } from "./market-analysis.service";
import type { CollectorRunResult } from "../types/collector";

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

export async function runDueCollectionJobs(limit = 20): Promise<{ results: CollectorRunResult[] }> {
  const now = new Date().toISOString();
  const { data: jobs, error } = await supabase
    .from("market_collection_jobs")
    .select("id,collector_key,market_keyword_id,interval_minutes,market_keywords(keyword)")
    .eq("status", "active")
    .lte("next_run_at", now)
    .order("priority", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: CollectorRunResult[] = [];
  for (const job of jobs ?? []) {
    await supabase.from("market_collection_jobs").update({ status: "running", last_run_at: now, updated_at: now }).eq("id", job.id);
    const keywordRelation = Array.isArray(job.market_keywords) ? job.market_keywords[0] : job.market_keywords;
    const keyword = keywordRelation?.keyword ?? "미지정";

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
    results.push(result);
  }
  return { results };
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
