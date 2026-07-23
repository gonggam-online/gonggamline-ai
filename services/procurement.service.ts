import { supabase } from "@/lib/supabase";
import { buildPurchaseOrderNumber, calculateProcurementScore } from "@/engines/procurement";
import { ensureCommerceWorkflow, transitionCommerceWorkflow } from "@/services/workflow.service";

export async function getProcurementDashboard() {
  const [quotes, mappings, orders, inbounds, workflows] = await Promise.all([
    supabase.from("supplier_quotes").select("*, suppliers(id,name,channel,reliability_score), sourcing_decisions(*)").eq("status", "selected").order("created_at", { ascending: false }),
    supabase.from("domestic_supplier_products").select("*, suppliers(name), ai_product_recommendations(id,market_products(title)), ai_bundle_recommendations(id,bundle_name)").order("created_at", { ascending: false }),
    supabase.from("procurement_orders").select("*, suppliers(name), supplier_quotes(product_name), three_pl_inbound_plans(*)").order("created_at", { ascending: false }),
    supabase.from("three_pl_inbound_plans").select("*, procurement_orders(order_number,product_name)").order("created_at", { ascending: false }),
    supabase.from("commerce_workflows").select("*, commerce_timeline_events(*)").order("updated_at", { ascending: false }),
  ]);
  for (const result of [quotes, mappings, orders, inbounds, workflows]) if (result.error) throw new Error(result.error.message);
  return { quotes: quotes.data ?? [], mappings: mappings.data ?? [], orders: orders.data ?? [], inbounds: inbounds.data ?? [], workflows: workflows.data ?? [] };
}

export async function createDomesticMapping(input: Record<string, unknown>) {
  const { data, error } = await supabase.from("domestic_supplier_products").insert({
    supplier_id: Number(input.supplierId),
    discovery_recommendation_id: input.discoveryRecommendationId ? Number(input.discoveryRecommendationId) : null,
    bundle_recommendation_id: input.bundleRecommendationId ? Number(input.bundleRecommendationId) : null,
    provider: input.provider || "domeggook",
    provider_product_id: String(input.providerProductId ?? "").trim(),
    provider_product_url: input.providerProductUrl || null,
    provider_product_name: String(input.providerProductName ?? "").trim(),
    provider_sku: input.providerSku || null,
    minimum_order_quantity: Number(input.minimumOrderQuantity ?? 1),
    current_unit_cost: Number(input.currentUnitCost ?? 0),
    stock_status: input.stockStatus || "unknown",
    last_checked_at: new Date().toISOString(),
  }).select("*").single();
  if (error) throw new Error(error.message);
  await ensureWorkflow({
    discoveryRecommendationId: input.discoveryRecommendationId,
    bundleRecommendationId: input.bundleRecommendationId,
    workflowName: String(input.providerProductName ?? "국내 도매 상품"),
    stage: "supplier_mapped",
    eventType: "supplier_mapping_created",
    title: "국내 도매 공급상품 연결",
    detail: { provider: input.provider || "domeggook", providerProductId: input.providerProductId },
  });
  return data;
}

export async function createProcurementOrder(input: Record<string, unknown>) {
  const quoteId = Number(input.quoteId);
  const { data: quote, error: quoteError } = await supabase.from("supplier_quotes").select("*, suppliers(id,name,reliability_score), sourcing_decisions(*)").eq("id", quoteId).single();
  if (quoteError) throw new Error(quoteError.message);
  const decisions = [...(quote.sourcing_decisions ?? [])].sort((a, b) => Number(b.id) - Number(a.id));
  const decision = decisions[0];
  if (!decision || decision.decision !== "approve") throw new Error("승인된 소싱 판단이 있는 견적만 발주할 수 있습니다.");
  const quantity = Math.max(Number(quote.moq), Number(input.quantity ?? quote.moq));
  const unitCost = Number(quote.unit_cost) * Number(quote.exchange_rate || 1);
  const goodsAmount = unitCost * quantity;
  const shippingAmount = Number(quote.domestic_shipping_total || 0);
  const packagingAmount = Number(quote.packaging_total || 0) + Number(quote.labeling_total || 0);
  const threePlInboundAmount = Number(quote.three_pl_inbound_total || 0);
  const totalAmount = goodsAmount + shippingAmount + packagingAmount + threePlInboundAmount;
  const quoteAgeDays = Math.max(0, Math.floor((Date.now() - new Date(quote.created_at).getTime()) / 86400000));
  const procurement = calculateProcurementScore({
    marginRate: Number(decision.expected_margin_rate),
    supplierReliability: Number(quote.suppliers?.reliability_score ?? 50),
    moq: quantity,
    leadTimeDays: Number(quote.lead_time_days),
    quoteAgeDays,
  });
  if (procurement.decision === "reject") throw new Error("조달 점수가 발주 기준에 미달합니다.");
  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + Number(quote.lead_time_days || 7));
  const payload = {
    order_number: buildPurchaseOrderNumber(), supplier_id: Number(quote.supplier_id), supplier_quote_id: quoteId,
    supplier_product_mapping_id: input.mappingId ? Number(input.mappingId) : null,
    discovery_recommendation_id: quote.discovery_recommendation_id, bundle_recommendation_id: quote.bundle_recommendation_id,
    product_name: quote.product_name, quantity, unit_cost: unitCost, goods_amount: goodsAmount,
    shipping_amount: shippingAmount, packaging_amount: packagingAmount, three_pl_inbound_amount: threePlInboundAmount,
    total_amount: totalAmount, expected_inbound_date: expectedDate.toISOString().slice(0, 10), status: "approved",
    procurement_score: procurement.score, approval_reasons: procurement.reasons, approved_at: new Date().toISOString(), notes: input.notes || null,
  };
  const { data: order, error } = await supabase.from("procurement_orders").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  const workflow = await ensureWorkflow({
    discoveryRecommendationId: quote.discovery_recommendation_id,
    bundleRecommendationId: quote.bundle_recommendation_id,
    procurementOrderId: order.id,
    workflowName: quote.product_name,
    stage: "purchase_approved",
    eventType: "purchase_order_approved",
    title: `발주 승인 ${order.order_number}`,
    detail: { quantity, totalAmount, procurementScore: procurement.score },
  });
  return { order, workflow, procurement };
}

export async function updateProcurementOrderStatus(input: Record<string, unknown>) {
  const orderId = Number(input.orderId);
  const status = String(input.status ?? "");
  const allowed = ["approved","ordered","supplier_confirmed","inbound_planned","in_transit","received","cancelled"];
  if (!allowed.includes(status)) throw new Error("지원하지 않는 발주 상태입니다.");
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "ordered") patch.ordered_at = new Date().toISOString();
  if (status === "received") patch.received_at = new Date().toISOString();
  if (input.supplierOrderReference) patch.supplier_order_reference = input.supplierOrderReference;
  const { data: order, error } = await supabase.from("procurement_orders").update(patch).eq("id", orderId).select("*").single();
  if (error) throw new Error(error.message);
  const stageMap: Record<string, string> = { approved: "purchase_approved", ordered: "purchase_ordered", supplier_confirmed: "purchase_ordered", inbound_planned: "three_pl_inbound", in_transit: "three_pl_inbound", received: "three_pl_inbound", cancelled: "purchase_approved" };
  const { data: workflow } = await supabase.from("commerce_workflows").select("id").eq("procurement_order_id", orderId).maybeSingle();
  if (workflow) {
    if (status === "cancelled") {
      await supabase.from("commerce_workflows").update({ status: "cancelled", blocked_reason: "발주 취소", updated_at: new Date().toISOString() }).eq("id", workflow.id);
      await supabase.from("commerce_timeline_events").insert({ workflow_id: workflow.id, stage: stageMap[status], event_type: "procurement_cancelled", title: "발주 취소", detail: { orderId }, actor: "operator" });
    } else {
      await transitionCommerceWorkflow({
        workflowId: workflow.id,
        toStage: stageMap[status] as import("@/services/workflow.service").WorkflowStage,
        triggerType: "operator",
        triggerSource: "procurement.status",
        idempotencyKey: `procurement-status:${orderId}:${status}`,
        title: `발주 상태: ${status}`,
        payload: { orderId, supplierOrderReference: input.supplierOrderReference || null },
        actor: "operator",
      });
    }
  }
  return order;
}

export async function createInboundPlan(input: Record<string, unknown>) {
  const orderId = Number(input.orderId);
  const { data: order, error: orderError } = await supabase.from("procurement_orders").select("*").eq("id", orderId).single();
  if (orderError) throw new Error(orderError.message);
  const { data, error } = await supabase.from("three_pl_inbound_plans").insert({
    procurement_order_id: orderId, warehouse_name: String(input.warehouseName ?? "").trim(), warehouse_code: input.warehouseCode || null,
    inbound_reference: input.inboundReference || null, expected_inbound_date: input.expectedInboundDate || order.expected_inbound_date,
    expected_quantity: Number(input.expectedQuantity ?? order.quantity), status: "booked", receiving_notes: input.receivingNotes || null,
  }).select("*").single();
  if (error) throw new Error(error.message);
  await updateProcurementOrderStatus({ orderId, status: "inbound_planned" });
  return data;
}

type WorkflowInput = { discoveryRecommendationId?: unknown; bundleRecommendationId?: unknown; procurementOrderId?: unknown; workflowName: string; stage: string; eventType: string; title: string; detail?: Record<string, unknown> };
async function ensureWorkflow(input: WorkflowInput) {
  const workflow = await ensureCommerceWorkflow({
    discoveryRecommendationId: input.discoveryRecommendationId ? Number(input.discoveryRecommendationId) : null,
    bundleRecommendationId: input.bundleRecommendationId ? Number(input.bundleRecommendationId) : null,
    procurementOrderId: input.procurementOrderId ? Number(input.procurementOrderId) : null,
    workflowName: input.workflowName,
    lifecycleType: input.bundleRecommendationId ? "bundle" : "single",
  });
  if (input.procurementOrderId && !workflow.procurement_order_id) {
    await supabase.from("commerce_workflows").update({ procurement_order_id: Number(input.procurementOrderId), updated_at: new Date().toISOString() }).eq("id", workflow.id);
  }
  return transitionCommerceWorkflow({
    workflowId: workflow.id,
    toStage: input.stage as import("@/services/workflow.service").WorkflowStage,
    triggerType: "reconcile",
    triggerSource: "procurement.service",
    idempotencyKey: `${input.eventType}:${workflow.id}:${JSON.stringify(input.detail ?? {})}`,
    title: input.title,
    payload: input.detail ?? {},
  });
}
