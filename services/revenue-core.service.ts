import { supabase } from "@/lib/supabase";
import type { OpportunityStatus, RevenueOpportunity } from "@/types/revenue";

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export function calculateRevenueScore(input: {
  demandScore?: number;
  marginScore?: number;
  competitionScore?: number;
  supplyScore?: number;
  riskScore?: number;
  listingScore?: number;
}) {
  const demand = clamp(input.demandScore ?? 0);
  const margin = clamp(input.marginScore ?? 0);
  const competition = clamp(input.competitionScore ?? 0);
  const supply = clamp(input.supplyScore ?? 0);
  const risk = clamp(input.riskScore ?? 0);
  const listing = clamp(input.listingScore ?? 0);

  return Math.round(
    demand * 0.25 +
      margin * 0.25 +
      competition * 0.15 +
      supply * 0.15 +
      listing * 0.1 +
      (100 - risk) * 0.1
  );
}

export async function getRevenueDashboard() {
  const [opportunities, jobs, decisions] = await Promise.all([
    supabase.from("revenue_opportunities").select("*").order("revenue_score", { ascending: false }).limit(50),
    supabase.from("runtime_jobs").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("revenue_decisions").select("*").order("created_at", { ascending: false }).limit(20),
  ]);

  if (opportunities.error) throw new Error(opportunities.error.message);
  if (jobs.error) throw new Error(jobs.error.message);
  if (decisions.error) throw new Error(decisions.error.message);

  const rows = (opportunities.data ?? []) as RevenueOpportunity[];
  const queue = jobs.data ?? [];
  const approved = rows.filter((row) => row.status === "approved").length;
  const active = rows.filter((row) => !["rejected", "archived"].includes(row.status)).length;
  const expectedProfit = rows.reduce((sum, row) => sum + Number(row.estimated_profit || 0) * Number(row.expected_monthly_sales || 0), 0);

  return {
    sprint: "Sprint 2 · Runtime Execution",
    generatedAt: new Date().toISOString(),
    metrics: {
      total: rows.length,
      active,
      approved,
      highScore: rows.filter((row) => Number(row.revenue_score) >= 80).length,
      queue: queue.filter((job: any) => ["queued", "running", "retry"].includes(job.status)).length,
      expectedMonthlyProfit: expectedProfit,
    },
    opportunities: rows,
    jobs: queue,
    decisions: decisions.data ?? [],
  };
}

export async function listOpportunities(filters: {
  status?: string;
  minimumScore?: number;
  keyword?: string;
}) {
  let query = supabase.from("revenue_opportunities").select("*").order("revenue_score", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.minimumScore) query = query.gte("revenue_score", filters.minimumScore);
  if (filters.keyword) query = query.or(`keyword.ilike.%${filters.keyword}%,title.ilike.%${filters.keyword}%`);
  const result = await query.limit(100);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createOpportunity(input: Record<string, unknown>) {
  const estimatedSalePrice = Number(input.estimatedSalePrice ?? 0);
  const estimatedCost = Number(input.estimatedCost ?? 0);
  const estimatedProfit = Math.max(0, estimatedSalePrice - estimatedCost);
  const revenueScore = calculateRevenueScore({
    demandScore: Number(input.demandScore ?? 0),
    marginScore: Number(input.marginScore ?? 0),
    competitionScore: Number(input.competitionScore ?? 0),
    supplyScore: Number(input.supplyScore ?? 0),
    riskScore: Number(input.riskScore ?? 0),
    listingScore: Number(input.listingScore ?? 0),
  });
  const code = `OPP-${Date.now()}`;

  const result = await supabase
    .from("revenue_opportunities")
    .insert({
      opportunity_code: code,
      keyword: String(input.keyword ?? "").trim(),
      title: String(input.title ?? input.keyword ?? "신규 기회").trim(),
      source: String(input.source ?? "manual"),
      status: "candidate",
      demand_score: Number(input.demandScore ?? 0),
      margin_score: Number(input.marginScore ?? 0),
      competition_score: Number(input.competitionScore ?? 0),
      supply_score: Number(input.supplyScore ?? 0),
      risk_score: Number(input.riskScore ?? 0),
      listing_score: Number(input.listingScore ?? 0),
      revenue_score: revenueScore,
      ai_confidence: Number(input.aiConfidence ?? 70),
      estimated_sale_price: estimatedSalePrice,
      estimated_cost: estimatedCost,
      estimated_profit: estimatedProfit,
      expected_monthly_sales: Number(input.expectedMonthlySales ?? 0),
      reasons: input.reasons ?? [],
      risks: input.risks ?? [],
      next_action: revenueScore >= 80 ? "CEO 승인 검토" : "추가 시장 검증",
    })
    .select("*")
    .single();
  if (result.error) throw new Error(result.error.message);

  await supabase.from("runtime_jobs").insert({
    job_code: `JOB-${Date.now()}`,
    opportunity_id: result.data.id,
    worker_code: "ai-profit",
    job_type: "evaluate_opportunity",
    status: "queued",
    priority: revenueScore,
    input_payload: { opportunityId: result.data.id },
  });

  return result.data;
}

export async function transitionOpportunity(id: number, status: OpportunityStatus, reason?: string) {
  const allowed: OpportunityStatus[] = ["idea", "candidate", "evaluating", "approved", "content", "ready", "published", "selling", "learning", "rejected", "archived"];
  if (!allowed.includes(status)) throw new Error("지원하지 않는 상태입니다.");

  const current = await supabase.from("revenue_opportunities").select("*").eq("id", id).single();
  if (current.error) throw new Error(current.error.message);

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "approved") patch.approved_at = new Date().toISOString();
  const updated = await supabase.from("revenue_opportunities").update(patch).eq("id", id).select("*").single();
  if (updated.error) throw new Error(updated.error.message);

  await supabase.from("revenue_decisions").insert({
    opportunity_id: id,
    decision_type: "status_transition",
    decision: status,
    reason: reason || `${current.data.status} → ${status}`,
    evidence: [{ previousStatus: current.data.status, revenueScore: current.data.revenue_score }],
    confidence: current.data.ai_confidence,
    expected_impact: current.data.estimated_profit,
  });

  await supabase.from("ai_memory_events").insert({
    memory_type: "decision",
    subject_type: "revenue_opportunity",
    subject_id: String(id),
    title: `${current.data.title} 상태 변경`,
    reason: reason || `${current.data.status}에서 ${status}로 전환`,
    evidence: [{ revenueScore: current.data.revenue_score }],
    decision: status,
    confidence: current.data.ai_confidence,
    impact_score: current.data.revenue_score,
    tags: ["sprint1", "revenue-core"],
  });

  return updated.data;
}
