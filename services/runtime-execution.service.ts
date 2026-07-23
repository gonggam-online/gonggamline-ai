import { supabase } from "@/lib/supabase";
import {
  CANCELLABLE_JOB_STATUSES,
  CLAIMABLE_JOB_STATUSES,
  RETRYABLE_JOB_STATUSES,
  boundedMaxAttempts,
  canAttemptJob,
  serializeRuntimeError,
} from "@/lib/runtime/job-policy";
import { runtimeLog } from "@/lib/runtime-logging";
import { executeWorker } from "@/lib/runtime/worker-registry";
import type { RevenueOpportunity, RuntimeJob } from "@/types/revenue";

const workerId = () => `runtime-${process.pid}-${Date.now()}`;

async function event(
  job: Pick<RuntimeJob, "id" | "opportunity_id" | "worker_code">,
  eventType: string,
  message: string,
  payload: Record<string, unknown> = {},
) {
  const result = await supabase.from("worker_runtime_events").insert({
    runtime_job_id: job.id, opportunity_id: job.opportunity_id,
    worker_code: job.worker_code, event_type: eventType, message, payload,
  });
  if (result.error) {
    runtimeLog.warn("runtime.event_write_failed", { jobId: job.id, eventType, message: result.error.message });
  }
}

export async function executeNextRuntimeJob() {
  const now = new Date().toISOString();
  const queue = await supabase.from("runtime_jobs").select("*")
    .in("status", CLAIMABLE_JOB_STATUSES).lte("scheduled_at", now)
    .order("priority", { ascending: false }).order("scheduled_at", { ascending: true }).limit(10);
  if (queue.error) throw new Error(queue.error.message);
  const job = queue.data?.find((candidate) => canAttemptJob(candidate.attempts, candidate.max_attempts));
  if (!job) return { executed: false, message: "실행 가능한 작업이 없습니다." };

  const lock = workerId();
  const claimed = await supabase.from("runtime_jobs").update({
    status: "running", locked_by: lock, locked_at: now, started_at: now,
    completed_at: null, last_heartbeat_at: now, attempts: Number(job.attempts || 0) + 1,
    max_attempts: boundedMaxAttempts(job.max_attempts), error_message: null, updated_at: now,
  }).eq("id", job.id).in("status", CLAIMABLE_JOB_STATUSES).select("*").maybeSingle();
  if (claimed.error) throw new Error(claimed.error.message);
  if (!claimed.data) return { executed: false, message: "다른 Worker가 작업을 선점했습니다." };

  runtimeLog.info("runtime.job_claimed", {
    jobId: claimed.data.id, workerCode: claimed.data.worker_code, attempt: claimed.data.attempts,
  });
  await event(claimed.data, "claimed", "Worker가 작업을 선점했습니다.");
  await event(claimed.data, "started", `${claimed.data.job_type} 실행 시작`);
  const started = Date.now();

  try {
    let opportunity: RevenueOpportunity | null = null;
    if (claimed.data.opportunity_id) {
      const result = await supabase.from("revenue_opportunities").select("*")
        .eq("id", claimed.data.opportunity_id).single();
      if (result.error) throw new Error(result.error.message);
      opportunity = result.data;
    }
    const result = await executeWorker(claimed.data.job_type, {
      jobId: claimed.data.id,
      opportunityId: claimed.data.opportunity_id,
      input: { ...(claimed.data.input_payload || {}), ...(opportunity || {}) },
    });
    if (opportunity && result.opportunityPatch) {
      const updated = await supabase.from("revenue_opportunities")
        .update({ ...result.opportunityPatch, updated_at: new Date().toISOString() }).eq("id", opportunity.id);
      if (updated.error) throw new Error(updated.error.message);
    }
    if (opportunity && result.decision) {
      await supabase.from("revenue_decisions").insert({
        opportunity_id: opportunity.id, decision_type: result.decision.type,
        decision: result.decision.value, reason: result.decision.reason,
        evidence: [result.output], confidence: result.decision.confidence,
        expected_impact: result.decision.expectedImpact || 0, result: "completed",
      });
      await supabase.from("ai_memory_events").insert({
        memory_type: "execution", subject_type: "runtime_job", subject_id: String(claimed.data.id),
        title: result.summary, reason: result.decision.reason, evidence: [result.output],
        decision: result.decision.value, confidence: result.decision.confidence,
        impact_score: result.decision.expectedImpact || opportunity.revenue_score || 0,
        tags: ["sprint2", "runtime", claimed.data.worker_code],
      });
    }
    const duration = Date.now() - started;
    const completedAt = new Date().toISOString();
    const completed = await supabase.from("runtime_jobs").update({
      status: "completed", output_payload: result.output, result_summary: result.summary,
      completed_at: completedAt, duration_ms: duration, last_heartbeat_at: completedAt, updated_at: completedAt,
    }).eq("id", claimed.data.id).eq("status", "running").eq("locked_by", lock).select("*").maybeSingle();
    if (completed.error) throw new Error(completed.error.message);
    if (!completed.data) throw new Error("Runtime job ownership changed before completion");
    await event(completed.data, "completed", result.summary, { durationMs: duration });
    return { executed: true, job: completed.data, result };
  } catch (error) {
    const message = serializeRuntimeError(error);
    const retry = canAttemptJob(claimed.data.attempts, claimed.data.max_attempts);
    const failedAt = new Date().toISOString();
    const failed = await supabase.from("runtime_jobs").update({
      status: retry ? "retry" : "failed", error_message: message,
      scheduled_at: retry ? new Date(Date.now() + 60_000).toISOString() : claimed.data.scheduled_at,
      completed_at: retry ? null : failedAt, locked_by: null, locked_at: null,
      duration_ms: Date.now() - started, updated_at: failedAt,
    }).eq("id", claimed.data.id).eq("status", "running").eq("locked_by", lock).select("*").maybeSingle();
    if (!failed.error && failed.data) await event(failed.data, retry ? "retry" : "failed", message);
    runtimeLog.error("runtime.job_failed", error, { jobId: claimed.data.id, retry });
    throw new Error(message);
  }
}

export async function retryRuntimeJob(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("INVALID_JOB_ID");
  const current = await supabase.from("runtime_jobs").select("*").eq("id", id).maybeSingle();
  if (current.error) throw new Error(current.error.message);
  if (!current.data) throw new Error("JOB_NOT_FOUND");
  if (!RETRYABLE_JOB_STATUSES.includes(current.data.status)) throw new Error("INVALID_JOB_TRANSITION");
  if (!canAttemptJob(current.data.attempts, current.data.max_attempts)) throw new Error("MAX_ATTEMPTS_REACHED");
  const result = await supabase.from("runtime_jobs").update({
    status: "retry", scheduled_at: new Date().toISOString(), completed_at: null,
    error_message: null, locked_by: null, locked_at: null, updated_at: new Date().toISOString(),
  }).eq("id", id).in("status", RETRYABLE_JOB_STATUSES).select("*").single();
  if (result.error) throw new Error(result.error.message);
  await event(result.data, "retry", "수동 재시도를 요청했습니다.");
  return result.data;
}

export async function cancelRuntimeJob(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("INVALID_JOB_ID");
  const completedAt = new Date().toISOString();
  const result = await supabase.from("runtime_jobs").update({
    status: "archived", result_summary: "사용자 취소", completed_at: completedAt,
    locked_by: null, locked_at: null, updated_at: completedAt,
  }).eq("id", id).in("status", CANCELLABLE_JOB_STATUSES).select("*").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("INVALID_JOB_TRANSITION");
  await event(result.data, "cancelled", "사용자가 작업을 취소했습니다.");
  return result.data;
}
