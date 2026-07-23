import { supabase } from "@/lib/supabase";
import { generateListingDraft } from "@/engines/listing";
import type { ListingGenerationInput, ListingStatus } from "@/shared/domain/listing";
import { ensureCommerceWorkflow, transitionCommerceWorkflow } from "@/services/workflow.service";

export async function getListingDashboard() {
  const [orders, drafts] = await Promise.all([
    supabase.from("procurement_orders").select("*, suppliers(name)").neq("status", "cancelled").order("created_at", { ascending: false }),
    supabase.from("listing_drafts").select("*").order("updated_at", { ascending: false }),
  ]);
  if (orders.error) throw new Error(orders.error.message);
  if (drafts.error) throw new Error(drafts.error.message);
  return { orders: orders.data ?? [], drafts: drafts.data ?? [] };
}

export async function createListingDraft(input: Record<string, unknown>) {
  const orderId = Number(input.orderId);
  if (!orderId) throw new Error("발주 상품을 선택하세요.");
  const { data: order, error: orderError } = await supabase.from("procurement_orders").select("*").eq("id", orderId).single();
  if (orderError) throw new Error(orderError.message);
  const workflow = await ensureCommerceWorkflow({
    discoveryRecommendationId: order.discovery_recommendation_id,
    bundleRecommendationId: order.bundle_recommendation_id,
    procurementOrderId: order.id,
    workflowName: order.product_name,
    lifecycleType: order.bundle_recommendation_id ? "bundle" : "single",
  });
  const generationInput: ListingGenerationInput = {
    productName: String(input.productName || order.product_name),
    brandName: input.brandName ? String(input.brandName) : undefined,
    categoryName: input.categoryName ? String(input.categoryName) : undefined,
    targetCustomer: input.targetCustomer ? String(input.targetCustomer) : undefined,
    keyBenefits: Array.isArray(input.keyBenefits) ? input.keyBenefits.map(String) : String(input.keyBenefits || "").split(","),
    optionNames: Array.isArray(input.optionNames) ? input.optionNames.map(String) : String(input.optionNames || "").split(","),
    listingType: (input.listingType || (order.bundle_recommendation_id ? "bundle" : "single")) as ListingGenerationInput["listingType"],
    providerName: input.providerName ? String(input.providerName) : "도매꾹",
    targetSellingPrice: Number(input.targetSellingPrice || 0),
  };
  const content = generateListingDraft(generationInput);
  const { data: latest } = await supabase.from("listing_drafts").select("revision").eq("workflow_id", workflow.id).order("revision", { ascending: false }).limit(1).maybeSingle();
  const revision = Number(latest?.revision || 0) + 1;
  const payload = {
    workflow_id: workflow.id,
    procurement_order_id: order.id,
    discovery_recommendation_id: order.discovery_recommendation_id,
    bundle_recommendation_id: order.bundle_recommendation_id,
    listing_type: generationInput.listingType,
    status: "generated",
    product_name: generationInput.productName,
    brand_name: generationInput.brandName || null,
    category_name: generationInput.categoryName || null,
    coupang_title: content.coupangTitle,
    search_keywords: content.searchKeywords,
    option_structure: content.optionStructure,
    selling_points: content.sellingPoints,
    detail_sections: content.detailSections,
    faq: content.faq,
    thumbnail_brief: content.thumbnailBrief,
    shipping_notice: content.shippingNotice,
    return_notice: content.returnNotice,
    compliance_checklist: content.complianceChecklist,
    coupang_payload: content.coupangPayload,
    generation_input: generationInput,
    revision,
    model_version: "listing-rule-v1",
    updated_at: new Date().toISOString(),
  };
  const { data: draft, error } = await supabase.from("listing_drafts").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  await supabase.from("listing_draft_revisions").insert({ listing_draft_id: draft.id, revision, snapshot: draft, change_note: "Listing 초안 자동 생성", actor: "listing_engine" });
  await supabase.from("commerce_workflows").update({ listing_draft_id: draft.id, updated_at: new Date().toISOString() }).eq("id", workflow.id);
  await transitionCommerceWorkflow({
    workflowId: workflow.id, toStage: "listing_ready", triggerType: "reconcile", triggerSource: "listing.generate",
    idempotencyKey: `listing-generated:${draft.id}`, title: `Listing 초안 생성 v${revision}`,
    payload: { listingDraftId: draft.id, coupangTitle: content.coupangTitle }, actor: "listing_engine",
  });
  return draft;
}

export async function updateListingStatus(input: Record<string, unknown>) {
  const id = Number(input.id);
  const status = String(input.status || "") as ListingStatus;
  const allowed: ListingStatus[] = ["draft", "generated", "reviewing", "approved", "rejected", "registered"];
  if (!id || !allowed.includes(status)) throw new Error("Listing 초안과 상태를 확인하세요.");
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "approved") patch.approved_at = new Date().toISOString();
  if (status === "registered") patch.registered_at = new Date().toISOString();
  const { data: draft, error } = await supabase.from("listing_drafts").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  const stage = status === "registered" ? "coupang_registered" : "listing_ready";
  await transitionCommerceWorkflow({
    workflowId: draft.workflow_id, toStage: stage, triggerType: "operator", triggerSource: "listing.status",
    idempotencyKey: `listing-status:${id}:${status}`, title: `Listing 상태: ${status}`,
    payload: { listingDraftId: id, status }, actor: "operator", allowBackward: status === "rejected",
  });
  return draft;
}
