import { supabase } from "@/lib/supabase";
import { validateCoupangProductPayload } from "@/lib/coupang/validator";
import { transitionCommerceWorkflow } from "@/services/workflow.service";

export type CoupangJobStatus =
  | "queued" | "validating" | "validation_failed" | "ready"
  | "submitting" | "submitted" | "registered" | "failed" | "cancelled";

function buildJobCode() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CP-${day}-${token}`;
}

export async function getCoupangSellerDashboard() {
  const [jobs, drafts, attempts] = await Promise.all([
    supabase.from("coupang_registration_jobs").select("*, listing_drafts(coupang_title, product_name, status), commerce_workflows(workflow_code, workflow_name, current_stage)").order("updated_at", { ascending: false }),
    supabase.from("listing_drafts").select("id, workflow_id, product_name, coupang_title, status, coupang_payload, updated_at").in("status", ["approved", "registered"]).order("updated_at", { ascending: false }),
    supabase.from("coupang_registration_attempts").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  for (const result of [jobs, drafts, attempts]) if (result.error) throw new Error(result.error.message);
  return { jobs: jobs.data ?? [], drafts: drafts.data ?? [], attempts: attempts.data ?? [] };
}

export async function ensureCoupangRegistrationJob(listingDraftId: number) {
  if (!listingDraftId) throw new Error("승인된 Listing 초안을 선택하세요.");
  const draftResult = await supabase.from("listing_drafts").select("*").eq("id", listingDraftId).single();
  if (draftResult.error) throw new Error(draftResult.error.message);
  const draft = draftResult.data;
  if (!["approved", "registered"].includes(draft.status)) throw new Error("Listing 초안을 먼저 승인하세요.");

  const existing = await supabase.from("coupang_registration_jobs").select("*").eq("listing_draft_id", listingDraftId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data;

  const issues = validateCoupangProductPayload(draft.coupang_payload);
  const status: CoupangJobStatus = issues.length ? "validation_failed" : "ready";
  const inserted = await supabase.from("coupang_registration_jobs").insert({
    workflow_id: draft.workflow_id,
    listing_draft_id: draft.id,
    job_code: buildJobCode(),
    status,
    mode: "validate",
    payload_snapshot: draft.coupang_payload ?? {},
    validation_issues: issues,
  }).select("*").single();
  if (inserted.error) throw new Error(inserted.error.message);

  await supabase.from("commerce_workflows").update({ coupang_registration_job_id: inserted.data.id, updated_at: new Date().toISOString() }).eq("id", draft.workflow_id);
  await recordCoupangAttempt({ jobId: inserted.data.id, action: "validate", success: issues.length === 0, requestPayload: draft.coupang_payload ?? {}, responsePayload: { issues }, errorMessage: issues.length ? "기본 Validation 실패" : undefined });
  return inserted.data;
}

export async function validateCoupangJob(jobId: number) {
  const jobResult = await supabase.from("coupang_registration_jobs").select("*").eq("id", jobId).single();
  if (jobResult.error) throw new Error(jobResult.error.message);
  const issues = validateCoupangProductPayload(jobResult.data.payload_snapshot);
  const status: CoupangJobStatus = issues.length ? "validation_failed" : "ready";
  const updated = await supabase.from("coupang_registration_jobs").update({ status, validation_issues: issues, last_error: issues.length ? "기본 Validation 실패" : null, updated_at: new Date().toISOString() }).eq("id", jobId).select("*").single();
  if (updated.error) throw new Error(updated.error.message);
  await recordCoupangAttempt({ jobId, action: "validate", success: issues.length === 0, requestPayload: jobResult.data.payload_snapshot, responsePayload: { issues }, errorMessage: issues.length ? "기본 Validation 실패" : undefined });
  return updated.data;
}

export async function updateCoupangJob(input: { id: number; action: "retry" | "cancel" | "mark_registered"; sellerProductId?: string; coupangStatus?: string }) {
  const current = await supabase.from("coupang_registration_jobs").select("*").eq("id", input.id).single();
  if (current.error) throw new Error(current.error.message);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.action === "retry") {
    patch.status = "ready";
    patch.last_error = null;
    patch.next_retry_at = null;
  } else if (input.action === "cancel") {
    patch.status = "cancelled";
  } else {
    patch.status = "registered";
    patch.seller_product_id = input.sellerProductId || current.data.seller_product_id;
    patch.coupang_status = input.coupangStatus || "registered";
    patch.registered_at = now;
  }
  const updated = await supabase.from("coupang_registration_jobs").update(patch).eq("id", input.id).select("*").single();
  if (updated.error) throw new Error(updated.error.message);
  await recordCoupangAttempt({ jobId: input.id, action: input.action === "cancel" ? "cancel" : "retry", success: true, responsePayload: patch });
  if (input.action === "mark_registered") {
    await supabase.from("listing_drafts").update({ status: "registered", registered_at: now, updated_at: now }).eq("id", current.data.listing_draft_id);
    await transitionCommerceWorkflow({
      workflowId: current.data.workflow_id,
      toStage: "coupang_registered",
      triggerType: "operator",
      triggerSource: "coupang.seller.manual",
      idempotencyKey: `coupang-manual-registered:${input.id}:${input.sellerProductId || "unknown"}`,
      title: "쿠팡 상품 등록 확인",
      payload: { jobId: input.id, sellerProductId: input.sellerProductId ?? null },
      actor: "operator",
    });
  }
  return updated.data;
}

export async function recordCoupangSubmission(input: { jobId?: number; listingDraftId?: number; workflowId?: number; success: boolean; status: number; response: unknown; error?: string; durationMs?: number }) {
  let jobId = input.jobId;
  if (!jobId && input.listingDraftId) jobId = (await ensureCoupangRegistrationJob(input.listingDraftId)).id;
  if (!jobId) return null;
  const now = new Date().toISOString();
  const job = await supabase.from("coupang_registration_jobs").select("*").eq("id", jobId).single();
  if (job.error) throw new Error(job.error.message);
  const responseRecord = typeof input.response === "object" && input.response !== null ? input.response as Record<string, unknown> : {};
  const data = responseRecord.data && typeof responseRecord.data === "object" ? responseRecord.data as Record<string, unknown> : responseRecord;
  const sellerProductId = String(data.sellerProductId ?? data.code ?? "") || null;
  const patch = input.success ? {
    status: "submitted", submitted_at: now, registration_response: input.response, seller_product_id: sellerProductId,
    last_error: null, attempt_count: Number(job.data.attempt_count || 0) + 1, updated_at: now,
  } : {
    status: "failed", registration_response: input.response, last_error: input.error || `HTTP ${input.status}`,
    attempt_count: Number(job.data.attempt_count || 0) + 1, next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), updated_at: now,
  };
  const updated = await supabase.from("coupang_registration_jobs").update(patch).eq("id", jobId).select("*").single();
  if (updated.error) throw new Error(updated.error.message);
  await recordCoupangAttempt({ jobId, action: "submit", success: input.success, responseStatus: input.status, responsePayload: input.response, errorMessage: input.error, durationMs: input.durationMs });
  return updated.data;
}

async function recordCoupangAttempt(input: { jobId: number; action: "validate" | "submit" | "retry" | "cancel" | "sync"; success: boolean; requestPayload?: unknown; responseStatus?: number; responsePayload?: unknown; errorMessage?: string; durationMs?: number }) {
  const count = await supabase.from("coupang_registration_attempts").select("id", { count: "exact", head: true }).eq("job_id", input.jobId);
  if (count.error) throw new Error(count.error.message);
  const inserted = await supabase.from("coupang_registration_attempts").insert({
    job_id: input.jobId,
    attempt_no: Number(count.count || 0) + 1,
    action: input.action,
    request_payload: input.requestPayload ?? {},
    response_status: input.responseStatus ?? null,
    response_payload: input.responsePayload ?? null,
    success: input.success,
    error_message: input.errorMessage ?? null,
    duration_ms: input.durationMs ?? null,
  });
  if (inserted.error) throw new Error(inserted.error.message);
}

export async function storeCoupangProductSnapshots(products: Array<Record<string, unknown>>) {
  if (!products.length) return { stored: 0 };
  const rows = products.map(product => ({
    seller_product_id: String(product.sellerProductId ?? product.productId ?? "unknown"),
    seller_product_name: product.sellerProductName ? String(product.sellerProductName) : null,
    status_name: product.statusName ? String(product.statusName) : null,
    brand: product.brand ? String(product.brand) : null,
    registration_type: product.registrationType ? String(product.registrationType) : null,
    raw_payload: product,
  }));
  const result = await supabase.from("coupang_seller_product_snapshots").insert(rows);
  if (result.error) throw new Error(result.error.message);
  return { stored: rows.length };
}
