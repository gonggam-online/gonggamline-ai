import { supabase } from "@/lib/supabase";
import { executeWorker } from "@/lib/runtime/worker-registry";
import type { RevenueOpportunity, RuntimeJob } from "@/types/revenue";

const workerId = () => `runtime-${process.pid}-${Date.now()}`;

async function event(
  job: Pick<RuntimeJob, "id" | "opportunity_id" | "worker_code">,
  eventType: string,
  message: string,
  payload: Record<string, unknown> = {}
) {
  await supabase.from("worker_runtime_events").insert({ runtime_job_id: job.id, opportunity_id: job.opportunity_id, worker_code: job.worker_code, event_type: eventType, message, payload });
}

export async function executeNextRuntimeJob() {
  const now = new Date().toISOString();
  const queue = await supabase.from("runtime_jobs").select("*").in("status", ["queued", "retry"]).lte("scheduled_at", now).order("priority", { ascending: false }).order("scheduled_at", { ascending: true }).limit(1);
  if (queue.error) throw new Error(queue.error.message);
  const job = queue.data?.[0];
  if (!job) return { executed: false, message: "실행 가능한 Job이 없습니다." };

  const lock = workerId();
  const claimed = await supabase.from("runtime_jobs").update({ status: "running", locked_by: lock, locked_at: now, started_at: now, last_heartbeat_at: now, attempts: Number(job.attempts || 0) + 1, error_message: null, updated_at: now }).eq("id", job.id).in("status", ["queued", "retry"]).select("*").maybeSingle();
  if (claimed.error) throw new Error(claimed.error.message);
  if (!claimed.data) return { executed: false, message: "다른 Worker가 Job을 선점했습니다." };

  await event(claimed.data, "claimed", `${claimed.data.worker_code}가 Job을 선점했습니다.`, { lockedBy: lock });
  await event(claimed.data, "started", `${claimed.data.job_type} 실행 시작`);
  const started = Date.now();

  try {
    let opportunity: RevenueOpportunity | null = null;
    if (claimed.data.opportunity_id) {
      const result = await supabase.from("revenue_opportunities").select("*").eq("id", claimed.data.opportunity_id).single();
      if (result.error) throw new Error(result.error.message);
      opportunity = result.data;
    }
    const result = await executeWorker(claimed.data.job_type, {
      jobId: claimed.data.id,
      opportunityId: claimed.data.opportunity_id,
      input: { ...(claimed.data.input_payload || {}), ...(opportunity || {}) },
    });
    if (opportunity && result.opportunityPatch) {
      const updated = await supabase.from("revenue_opportunities").update({ ...result.opportunityPatch, updated_at: new Date().toISOString() }).eq("id", opportunity.id);
      if (updated.error) throw new Error(updated.error.message);
    }
    if (opportunity && result.decision) {
      await supabase.from("revenue_decisions").insert({ opportunity_id: opportunity.id, decision_type: result.decision.type, decision: result.decision.value, reason: result.decision.reason, evidence: [result.output], confidence: result.decision.confidence, expected_impact: result.decision.expectedImpact || 0, result: "completed" });
      await supabase.from("ai_memory_events").insert({ memory_type: "execution", subject_type: "runtime_job", subject_id: String(claimed.data.id), title: result.summary, reason: result.decision.reason, evidence: [result.output], decision: result.decision.value, confidence: result.decision.confidence, impact_score: result.decision.expectedImpact || opportunity.revenue_score || 0, tags: ["sprint2", "runtime", claimed.data.worker_code] });
    }
    const duration = Date.now() - started;
    const completed = await supabase.from("runtime_jobs").update({ status: "completed", output_payload: result.output, result_summary: result.summary, completed_at: new Date().toISOString(), duration_ms: duration, last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", claimed.data.id).select("*").single();
    if (completed.error) throw new Error(completed.error.message);
    await event(completed.data, "completed", result.summary, { durationMs: duration, output: result.output });
    return { executed: true, job: completed.data, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker 실행 오류";
    const retry = Number(claimed.data.attempts || 0) + 1 < Number(claimed.data.max_attempts || 3);
    const failed = await supabase.from("runtime_jobs").update({ status: retry ? "retry" : "failed", error_message: message, scheduled_at: retry ? new Date(Date.now() + 60_000).toISOString() : claimed.data.scheduled_at, duration_ms: Date.now() - started, updated_at: new Date().toISOString() }).eq("id", claimed.data.id).select("*").single();
    if (!failed.error && failed.data) await event(failed.data, retry ? "retry" : "failed", message);
    throw new Error(message);
  }
}

export async function retryRuntimeJob(id: number) {
  const result = await supabase.from("runtime_jobs").update({ status: "retry", scheduled_at: new Date().toISOString(), error_message: null, locked_by: null, locked_at: null, updated_at: new Date().toISOString() }).eq("id", id).in("status", ["failed", "waiting"]).select("*").single();
  if (result.error) throw new Error(result.error.message);
  await event(result.data, "retry", "수동 재시도 요청");
  return result.data;
}

export async function cancelRuntimeJob(id: number) {
  const result = await supabase.from("runtime_jobs").update({ status: "archived", result_summary: "사용자 취소", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).in("status", ["queued", "retry", "waiting"]).select("*").single();
  if (result.error) throw new Error(result.error.message);
  await event(result.data, "cancelled", "사용자가 Job을 취소했습니다.");
  return result.data;
}
