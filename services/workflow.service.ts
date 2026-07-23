import { supabase } from "@/lib/supabase";

export const WORKFLOW_STAGES = [
  "market_discovered",
  "ai_recommended",
  "human_approved",
  "supplier_mapped",
  "quote_selected",
  "purchase_approved",
  "purchase_ordered",
  "three_pl_inbound",
  "listing_ready",
  "coupang_registered",
  "selling",
  "learning",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

type CandidateRef = {
  discoveryRecommendationId?: number | null;
  bundleRecommendationId?: number | null;
  procurementOrderId?: number | null;
  workflowName?: string;
  lifecycleType?: "single" | "set" | "bundle" | "multipack";
};

type TransitionInput = {
  workflowId: number;
  toStage: WorkflowStage;
  triggerType?: "system" | "operator" | "reconcile" | "adapter";
  triggerSource?: string;
  idempotencyKey?: string;
  reason?: string;
  title?: string;
  payload?: Record<string, unknown>;
  actor?: string;
  allowBackward?: boolean;
};

const stageIndex = (stage: string) => WORKFLOW_STAGES.indexOf(stage as WorkflowStage);

function buildWorkflowCode() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WF-${day}-${random}`;
}

function nextTask(stage: WorkflowStage) {
  const map: Partial<Record<WorkflowStage, { taskType: string; title: string; priority: number }>> = {
    ai_recommended: { taskType: "review_recommendation", title: "AI 추천 검토", priority: 75 },
    human_approved: { taskType: "map_supplier", title: "국내 도매 공급상품 연결", priority: 80 },
    supplier_mapped: { taskType: "select_quote", title: "공급처 견적 및 수익성 판단", priority: 85 },
    quote_selected: { taskType: "approve_purchase", title: "발주 승인서 생성", priority: 85 },
    purchase_approved: { taskType: "place_order", title: "공급처 발주 처리", priority: 90 },
    purchase_ordered: { taskType: "book_inbound", title: "3PL 입고 예약", priority: 90 },
    three_pl_inbound: { taskType: "create_listing", title: "쿠팡 Listing 초안 생성", priority: 80 },
    listing_ready: { taskType: "register_coupang", title: "쿠팡 검증 및 상품 등록", priority: 90 },
    coupang_registered: { taskType: "start_sales_monitoring", title: "판매·재고 모니터링 시작", priority: 70 },
    selling: { taskType: "collect_learning_feedback", title: "실매출 학습 데이터 수집", priority: 60 },
  };
  return map[stage] ?? null;
}

export async function ensureCommerceWorkflow(ref: CandidateRef) {
  let query = supabase.from("commerce_workflows").select("*");
  if (ref.procurementOrderId) query = query.eq("procurement_order_id", ref.procurementOrderId);
  else if (ref.discoveryRecommendationId) query = query.eq("discovery_recommendation_id", ref.discoveryRecommendationId);
  else if (ref.bundleRecommendationId) query = query.eq("bundle_recommendation_id", ref.bundleRecommendationId);
  else throw new Error("Workflow 연결 기준이 없습니다.");

  const existing = await query.maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data;

  let name = ref.workflowName?.trim() || "Commerce Workflow";
  if (!ref.workflowName && ref.discoveryRecommendationId) {
    const recommendation = await supabase
      .from("ai_product_recommendations")
      .select("market_products(title)")
      .eq("id", ref.discoveryRecommendationId)
      .maybeSingle();
    const product = recommendation.data?.market_products as unknown as { title?: string } | null;
    name = product?.title || name;
  }
  if (!ref.workflowName && ref.bundleRecommendationId) {
    const bundle = await supabase
      .from("ai_bundle_recommendations")
      .select("bundle_name")
      .eq("id", ref.bundleRecommendationId)
      .maybeSingle();
    name = bundle.data?.bundle_name || name;
  }

  const inserted = await supabase.from("commerce_workflows").insert({
    workflow_code: buildWorkflowCode(),
    discovery_recommendation_id: ref.discoveryRecommendationId ?? null,
    bundle_recommendation_id: ref.bundleRecommendationId ?? null,
    procurement_order_id: ref.procurementOrderId ?? null,
    workflow_name: name,
    lifecycle_type: ref.lifecycleType ?? (ref.bundleRecommendationId ? "bundle" : "single"),
    current_stage: "ai_recommended",
    status: "active",
    last_transition_at: new Date().toISOString(),
  }).select("*").single();
  if (inserted.error) throw new Error(inserted.error.message);

  await transitionCommerceWorkflow({
    workflowId: inserted.data.id,
    toStage: "ai_recommended",
    triggerType: "system",
    triggerSource: "workflow.ensure",
    idempotencyKey: `workflow-created:${inserted.data.id}`,
    title: "Commerce Workflow 생성",
    reason: "추천상품을 통합 Workflow에 연결",
    payload: { workflowCode: inserted.data.workflow_code },
  });
  return inserted.data;
}

export async function transitionCommerceWorkflow(input: TransitionInput) {
  const currentResult = await supabase.from("commerce_workflows").select("*").eq("id", input.workflowId).single();
  if (currentResult.error) throw new Error(currentResult.error.message);
  const workflow = currentResult.data;

  if (input.idempotencyKey) {
    const duplicate = await supabase.from("workflow_transitions").select("id").eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (duplicate.error) throw new Error(duplicate.error.message);
    if (duplicate.data) return workflow;
  }

  const fromStage = workflow.current_stage as WorkflowStage;
  const fromIndex = stageIndex(fromStage);
  const toIndex = stageIndex(input.toStage);
  if (toIndex < 0) throw new Error("지원하지 않는 Workflow 단계입니다.");
  if (!input.allowBackward && fromIndex >= 0 && toIndex < fromIndex) {
    return workflow;
  }
  if (!input.allowBackward && fromIndex >= 0 && toIndex > fromIndex + 1 && input.triggerType !== "reconcile") {
    throw new Error(`Workflow 단계는 순서대로 전환해야 합니다. 현재 ${fromStage}, 요청 ${input.toStage}`);
  }

  const now = new Date().toISOString();
  const updated = await supabase.from("commerce_workflows").update({
    current_stage: input.toStage,
    stage_version: Number(workflow.stage_version || 1) + (fromStage === input.toStage ? 0 : 1),
    last_transition_at: now,
    updated_at: now,
    status: "active",
    blocked_reason: null,
  }).eq("id", input.workflowId).select("*").single();
  if (updated.error) throw new Error(updated.error.message);

  const transition = await supabase.from("workflow_transitions").insert({
    workflow_id: input.workflowId,
    from_stage: fromStage,
    to_stage: input.toStage,
    trigger_type: input.triggerType ?? "system",
    trigger_source: input.triggerSource ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    reason: input.reason ?? null,
    payload: input.payload ?? {},
    actor: input.actor ?? "system",
  });
  if (transition.error) throw new Error(transition.error.message);

  await supabase.from("commerce_timeline_events").insert({
    workflow_id: input.workflowId,
    stage: input.toStage,
    event_type: `workflow_${input.toStage}`,
    title: input.title ?? `Workflow 단계: ${input.toStage}`,
    detail: { fromStage, ...input.payload },
    actor: input.actor ?? "system",
  });

  if (fromStage !== input.toStage) {
    await supabase.from("workflow_tasks").update({ status: "done", completed_at: now, updated_at: now })
      .eq("workflow_id", input.workflowId).eq("stage", fromStage).in("status", ["open", "in_progress"]);
  }
  const task = nextTask(input.toStage);
  if (task) {
    await supabase.from("workflow_tasks").upsert({
      workflow_id: input.workflowId,
      stage: input.toStage,
      task_type: task.taskType,
      title: task.title,
      priority: task.priority,
      status: "open",
      payload: input.payload ?? {},
      updated_at: now,
    }, { onConflict: "workflow_id,stage,task_type", ignoreDuplicates: true });
  }

  await supabase.from("workflow_outbox_events").insert({
    workflow_id: input.workflowId,
    event_name: `workflow.${input.toStage}`,
    destination: "internal",
    payload: { workflowCode: updated.data.workflow_code, fromStage, toStage: input.toStage, ...input.payload },
  });
  return updated.data;
}

export async function syncCandidateWorkflow(kind: "single" | "bundle", id: number, status: string) {
  const workflow = await ensureCommerceWorkflow(kind === "single"
    ? { discoveryRecommendationId: id, lifecycleType: "single" }
    : { bundleRecommendationId: id, lifecycleType: "bundle" });
  const target: WorkflowStage = ["approved", "sourcing"].includes(status) ? "human_approved" : "ai_recommended";
  return transitionCommerceWorkflow({
    workflowId: workflow.id,
    toStage: target,
    triggerType: "system",
    triggerSource: "discovery.status",
    idempotencyKey: `discovery:${kind}:${id}:${status}`,
    title: status === "approved" ? "AI 추천 승인" : `추천 상태: ${status}`,
    payload: { kind, recommendationId: id, status },
    allowBackward: status === "rejected",
  });
}

async function deriveStage(workflow: Record<string, any>): Promise<WorkflowStage> {
  const workflowId = Number(workflow.id);
  const [draftResult, orderResult, inboundResult, mappingResult, quoteResult] = await Promise.all([
    supabase.from("listing_drafts").select("id,status").eq("workflow_id", workflowId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    workflow.procurement_order_id
      ? supabase.from("procurement_orders").select("id,status").eq("id", workflow.procurement_order_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    workflow.procurement_order_id
      ? supabase.from("three_pl_inbound_plans").select("id,status").eq("procurement_order_id", workflow.procurement_order_id).order("updated_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    workflow.discovery_recommendation_id
      ? supabase.from("domestic_supplier_products").select("id").eq("discovery_recommendation_id", workflow.discovery_recommendation_id).limit(1).maybeSingle()
      : supabase.from("domestic_supplier_products").select("id").eq("bundle_recommendation_id", workflow.bundle_recommendation_id).limit(1).maybeSingle(),
    workflow.discovery_recommendation_id
      ? supabase.from("supplier_quotes").select("id,status,sourcing_decisions(decision)").eq("discovery_recommendation_id", workflow.discovery_recommendation_id).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : supabase.from("supplier_quotes").select("id,status,sourcing_decisions(decision)").eq("bundle_recommendation_id", workflow.bundle_recommendation_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const draft = draftResult.data as { status?: string } | null;
  if (draft?.status === "registered") return "coupang_registered";
  if (draft) return "listing_ready";
  const inbound = inboundResult.data as { status?: string } | null;
  if (inbound) return "three_pl_inbound";
  const order = orderResult.data as { status?: string } | null;
  if (["ordered", "supplier_confirmed"].includes(order?.status || "")) return "purchase_ordered";
  if (order) return "purchase_approved";
  const quote = quoteResult.data as { status?: string; sourcing_decisions?: Array<{ decision?: string }> } | null;
  if (quote?.status === "selected" || quote?.sourcing_decisions?.some((x) => x.decision === "approve")) return "quote_selected";
  if (mappingResult.data) return "supplier_mapped";

  if (workflow.discovery_recommendation_id) {
    const result = await supabase.from("ai_product_recommendations").select("status").eq("id", workflow.discovery_recommendation_id).maybeSingle();
    if (["approved", "sourcing"].includes(result.data?.status || "")) return "human_approved";
  }
  if (workflow.bundle_recommendation_id) {
    const result = await supabase.from("ai_bundle_recommendations").select("status").eq("id", workflow.bundle_recommendation_id).maybeSingle();
    if (["approved", "sourcing"].includes(result.data?.status || "")) return "human_approved";
  }
  return "ai_recommended";
}

export async function reconcileCommerceWorkflows() {
  const result = await supabase.from("commerce_workflows").select("*").neq("status", "cancelled").order("updated_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  const changed: Array<{ id: number; from: string; to: string }> = [];
  for (const workflow of result.data ?? []) {
    const target = await deriveStage(workflow);
    if (target !== workflow.current_stage && stageIndex(target) > stageIndex(workflow.current_stage)) {
      await transitionCommerceWorkflow({
        workflowId: workflow.id,
        toStage: target,
        triggerType: "reconcile",
        triggerSource: "workflow.reconcile",
        idempotencyKey: `reconcile:${workflow.id}:${target}:${workflow.stage_version || 1}`,
        title: `Workflow 자동 동기화: ${target}`,
        reason: "연결된 엔진 데이터 기준으로 상태 동기화",
        payload: { previousStage: workflow.current_stage },
      });
      changed.push({ id: workflow.id, from: workflow.current_stage, to: target });
    }
  }
  return { total: result.data?.length ?? 0, changed };
}

export async function getWorkflowDashboard() {
  const [workflows, tasks, transitions] = await Promise.all([
    supabase.from("commerce_workflows").select("*, commerce_timeline_events(*)").order("updated_at", { ascending: false }),
    supabase.from("workflow_tasks").select("*").order("priority", { ascending: false }).order("created_at", { ascending: true }),
    supabase.from("workflow_transitions").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  for (const result of [workflows, tasks, transitions]) if (result.error) throw new Error(result.error.message);
  return { workflows: workflows.data ?? [], tasks: tasks.data ?? [], transitions: transitions.data ?? [] };
}

export async function getWorkflowDetail(id: number) {
  const [workflow, tasks, transitions] = await Promise.all([
    supabase.from("commerce_workflows").select("*, commerce_timeline_events(*)").eq("id", id).single(),
    supabase.from("workflow_tasks").select("*").eq("workflow_id", id).order("created_at", { ascending: false }),
    supabase.from("workflow_transitions").select("*").eq("workflow_id", id).order("created_at", { ascending: false }),
  ]);
  if (workflow.error) throw new Error(workflow.error.message);
  if (tasks.error) throw new Error(tasks.error.message);
  if (transitions.error) throw new Error(transitions.error.message);
  return { workflow: workflow.data, tasks: tasks.data ?? [], transitions: transitions.data ?? [] };
}
