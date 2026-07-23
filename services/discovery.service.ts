import { supabase } from "../lib/supabase";
import {
  scoreBundle,
  scoreSingle,
  type DiscoveryMetric,
  type DiscoveryProduct,
} from "../lib/discovery/engine";
import { syncCandidateWorkflow } from "@/services/workflow.service";

type DiscoveryProductRow = {
  id: number;
  title: string;
  category?: string | null;
  brand?: string | null;
  seller_name?: string | null;
  market_product_metrics?: DiscoveryMetric | DiscoveryMetric[] | null;
};

type ExistingRecommendationRow = {
  market_product_id: number | string;
  status: string;
};

type BundleIdRow = { id: number | string };

function metricOf(value: unknown): DiscoveryMetric {
  const metric = Array.isArray(value) ? value[0] : value;
  return metric && typeof metric === "object" ? metric as DiscoveryMetric : {};
}

export async function generateDiscovery(limit = 50) {
  const startedAt = new Date().toISOString();
  const run = await supabase.from("ai_decision_runs").insert({
    run_type: "discovery",
    status: "running",
    model_version: "decision-v2",
    input_limit: limit,
    started_at: startedAt,
  }).select("id").single();
  if (run.error) throw run.error;

  try {
    const { data, error } = await supabase.from("market_products")
      .select("id,title,category,brand,seller_name,market_product_metrics(*)")
      .order("last_seen_at", { ascending: false }).limit(limit);
    if (error) throw error;
    const products: DiscoveryProduct[] = ((data ?? []) as DiscoveryProductRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      brand: row.brand,
      seller_name: row.seller_name,
      metric: metricOf(row.market_product_metrics),
    }));
    const scored = products.map((product) => ({ product, score: scoreSingle(product) })).sort((a,b)=>b.score.decisionScore-a.score.decisionScore);
    const singles = scored.slice(0, Math.min(50, scored.length));
    const existingResult = await supabase.from("ai_product_recommendations").select("market_product_id,status").eq("recommendation_type","single");
    if (existingResult.error) throw existingResult.error;
    const existingStatus = new Map(
      ((existingResult.data ?? []) as ExistingRecommendationRow[]).map((row) => [
        Number(row.market_product_id),
        String(row.status),
      ])
    );
    const counts = { approve: 0, review: 0, hold: 0, reject: 0 };

    for (const item of singles) {
      const s=item.score;
      counts[s.decision] += 1;
      const { error: upsertError } = await supabase.from("ai_product_recommendations").upsert({
        market_product_id:item.product.id,
        recommendation_type:"single",
        status:["approved","rejected","sourcing"].includes(existingStatus.get(item.product.id) ?? "") ? existingStatus.get(item.product.id) : "candidate",
        ai_score:s.aiScore,
        decision_score:s.decisionScore,
        decision_action:s.decision,
        market_score:s.marketScore,
        growth_score:s.growthScore,
        competition_score:s.competitionScore,
        supply_score:s.supplyScore,
        season_score:s.seasonScore,
        risk_score:s.riskScore,
        profit_score:s.profitScore,
        confidence:s.confidence,
        estimated_units_low:s.estimatedUnitsLow,
        estimated_units_high:s.estimatedUnitsHigh,
        recommendation_reason:s.reason,
        risk_explanation:s.riskExplanation,
        evidence:s.evidence,
        generated_at:new Date().toISOString(),
        model_version:"decision-v2",
        decision_run_id:run.data.id,
      }, { onConflict:"market_product_id,recommendation_type" });
      if(upsertError) throw upsertError;
    }

    const candidateBundles = await supabase.from("ai_bundle_recommendations").select("id").eq("status","candidate");
    if (candidateBundles.error) throw candidateBundles.error;
    const candidateBundleIds = ((candidateBundles.data ?? []) as BundleIdRow[])
      .map((row) => Number(row.id));
    if(candidateBundleIds.length){
      const deletedItems=await supabase.from("ai_bundle_items").delete().in("bundle_id",candidateBundleIds);
      if(deletedItems.error) throw deletedItems.error;
    }
    const deletedBundles=await supabase.from("ai_bundle_recommendations").delete().eq("status","candidate");
    if(deletedBundles.error) throw deletedBundles.error;

    const top=singles.filter(x=>x.score.decision !== "reject").slice(0,12).map((x)=>x.product);
    let bundleCount=0;
    for(let i=0;i<top.length;i++) for(let j=i+1;j<top.length;j++) {
      if(bundleCount>=10) break;
      const a=top[i], b=top[j]; const s=scoreBundle(a,b);
      if(s.decision === "reject" || s.aiScore<55) continue;
      const { data: bundle, error: bundleError } = await supabase.from("ai_bundle_recommendations").insert({
        bundle_name:`${a.title} + ${b.title}`,bundle_type:"bundle",keyword:a.category||b.category||null,category:a.category||b.category||null,
        ai_score:s.aiScore,decision_score:s.decisionScore,decision_action:s.decision,synergy_score:s.synergyScore,convenience_score:s.convenienceScore,
        differentiation_score:s.differentiationScore,margin_score:s.marginScore,risk_score:s.riskScore,confidence:s.confidence,
        recommendation_reason:s.reason,evidence:{anchor:a.id,complement:b.id},generated_at:new Date().toISOString(),decision_run_id:run.data.id,
      }).select("id").single();
      if(bundleError) throw bundleError;
      const { error: itemsError } = await supabase.from("ai_bundle_items").insert([{bundle_id:bundle.id,market_product_id:a.id,role:"anchor",quantity:1,item_order:0},{bundle_id:bundle.id,market_product_id:b.id,role:"complement",quantity:1,item_order:1}]);
      if(itemsError) throw itemsError;
      bundleCount++;
    }

    await supabase.from("ai_decision_runs").update({
      status:"completed",processed_count:products.length,recommendation_count:singles.length,bundle_count:bundleCount,
      decision_summary:counts,completed_at:new Date().toISOString(),
    }).eq("id",run.data.id);
    return { runId: run.data.id, processedCount: products.length, singleCount: singles.length, bundleCount, decisions: counts };
  } catch (error) {
    await supabase.from("ai_decision_runs").update({ status:"failed", error_message:error instanceof Error?error.message:"추천 생성 오류", completed_at:new Date().toISOString() }).eq("id",run.data.id);
    throw error;
  }
}

export async function listRecommendations() {
  const { data, error } = await supabase.from("ai_product_recommendations").select("*,market_products(id,title,category,brand,seller_name,thumbnail_url,url)").order("decision_score",{ascending:false}).limit(100); if(error) throw error; return data??[];
}
export async function listBundles() {
  const { data, error } = await supabase.from("ai_bundle_recommendations").select("*,ai_bundle_items(*,market_products(id,title,category,brand,thumbnail_url,url))").order("decision_score",{ascending:false}).limit(50); if(error) throw error; return data??[];
}
export async function listDecisionRuns() {
  const { data,error }=await supabase.from("ai_decision_runs").select("*").order("started_at",{ascending:false}).limit(20); if(error) throw error; return data??[];
}
export async function updateDiscoveryStatus(kind:"single"|"bundle", id:number, status:string) {
  const table=kind==="single"?"ai_product_recommendations":"ai_bundle_recommendations";
  const { data,error }=await supabase.from(table).update({status,reviewed_at:new Date().toISOString()}).eq("id",id).select().single();
  if(error) throw error;
  await syncCandidateWorkflow(kind, id, status);
  return data;
}
