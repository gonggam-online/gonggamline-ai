import { supabase } from "@/lib/supabase";
import { calculateDetailedSourcing } from "@/engines/supplier";
import type { SourcingCostInput } from "@/shared/domain/sourcing";
import { ensureCommerceWorkflow, transitionCommerceWorkflow } from "@/services/workflow.service";

export async function getSourcingDashboard() {
  const [suppliersResult, quotesResult, singlesResult, bundlesResult] = await Promise.all([
    supabase.from("suppliers").select("*").order("reliability_score", { ascending: false }),
    supabase.from("supplier_quotes").select("*, suppliers(name,channel,reliability_score), sourcing_decisions(*)").order("created_at", { ascending: false }),
    supabase.from("ai_product_recommendations").select("id,status,ai_score,market_products(title,category,brand)").in("status", ["approved", "sourcing"]).order("ai_score", { ascending: false }),
    supabase.from("ai_bundle_recommendations").select("id,status,ai_score,bundle_name").in("status", ["approved", "sourcing"]).order("ai_score", { ascending: false }),
  ]);
  for (const result of [suppliersResult, quotesResult, singlesResult, bundlesResult]) if (result.error) throw new Error(result.error.message);
  return { suppliers: suppliersResult.data ?? [], quotes: quotesResult.data ?? [], singles: singlesResult.data ?? [], bundles: bundlesResult.data ?? [] };
}

export async function createSupplier(input: Record<string, unknown>) {
  const { data, error } = await supabase.from("suppliers").insert({
    name: String(input.name ?? "").trim(), channel: input.channel ?? "manual",
    contact_name: input.contactName || null, contact_email: input.contactEmail || null,
    contact_phone: input.contactPhone || null, website_url: input.websiteUrl || null,
    country_code: input.countryCode || "KR", reliability_score: Number(input.reliabilityScore ?? 50), memo: input.memo || null,
  }).select("*").single();
  if (error) throw new Error(error.message); return data;
}

export async function createQuote(input: Record<string, unknown>) {
  const payload = {
    supplier_id: Number(input.supplierId), discovery_recommendation_id: input.discoveryRecommendationId ? Number(input.discoveryRecommendationId) : null,
    bundle_recommendation_id: input.bundleRecommendationId ? Number(input.bundleRecommendationId) : null,
    product_name: String(input.productName ?? "").trim(), supplier_sku: input.supplierSku || null,
    currency: input.currency || "KRW", exchange_rate: Number(input.exchangeRate ?? 1), unit_cost: Number(input.unitCost ?? 0), moq: Number(input.moq ?? 1), sample_cost: Number(input.sampleCost ?? 0),
    domestic_shipping_total: Number(input.domesticShippingTotal ?? 0), international_shipping_total: Number(input.internationalShippingTotal ?? 0), customs_total: Number(input.customsTotal ?? 0), vat_total: Number(input.vatTotal ?? 0), inspection_total: Number(input.inspectionTotal ?? 0), packaging_total: Number(input.packagingTotal ?? 0), labeling_total: Number(input.labelingTotal ?? 0), three_pl_inbound_total: Number(input.threePlInboundTotal ?? 0), three_pl_storage_per_unit: Number(input.threePlStoragePerUnit ?? 0), three_pl_outbound_per_unit: Number(input.threePlOutboundPerUnit ?? 0), coupang_fee_rate: Number(input.coupangFeeRate ?? 10.8), expected_return_rate: Number(input.expectedReturnRate ?? 3), lead_time_days: Number(input.leadTimeDays ?? 7), valid_until: input.validUntil || null, status: "received", notes: input.notes || null,
  };
  const { data, error } = await supabase.from("supplier_quotes").insert(payload).select("*").single();
  if (error) throw new Error(error.message); return data;
}

export async function calculateAndSaveDecision(quoteId: number, targetSellingPrice: number) {
  const { data: quote, error } = await supabase.from("supplier_quotes").select("*").eq("id", quoteId).single();
  if (error) throw new Error(error.message);
  const input: SourcingCostInput = { unitCost:Number(quote.unit_cost), moq:Number(quote.moq), exchangeRate:Number(quote.exchange_rate), domesticShippingTotal:Number(quote.domestic_shipping_total), internationalShippingTotal:Number(quote.international_shipping_total), customsTotal:Number(quote.customs_total), vatTotal:Number(quote.vat_total), inspectionTotal:Number(quote.inspection_total), packagingTotal:Number(quote.packaging_total), labelingTotal:Number(quote.labeling_total), threePlInboundTotal:Number(quote.three_pl_inbound_total), threePlStoragePerUnit:Number(quote.three_pl_storage_per_unit), threePlOutboundPerUnit:Number(quote.three_pl_outbound_per_unit), coupangFeeRate:Number(quote.coupang_fee_rate), expectedReturnRate:Number(quote.expected_return_rate), leadTimeDays:Number(quote.lead_time_days) };
  const result = calculateDetailedSourcing(input, targetSellingPrice);
  const { data, error: insertError } = await supabase.from("sourcing_decisions").insert({ supplier_quote_id: quoteId, target_selling_price: targetSellingPrice, landed_unit_cost: result.landedUnitCost, coupang_fee_per_unit: result.coupangFeePerUnit, expected_return_cost_per_unit: result.expectedReturnCostPerUnit, expected_profit_per_unit: result.expectedProfitPerUnit, expected_margin_rate: result.expectedMarginRate, initial_purchase_amount: result.initialPurchaseAmount, working_capital_days: result.workingCapitalDays, decision: result.decision, score: result.score, reasons: result.reasons }).select("*").single();
  if (insertError) throw new Error(insertError.message);
  if (result.decision === "approve") {
    await supabase.from("supplier_quotes").update({ status: "selected", updated_at: new Date().toISOString() }).eq("id", quoteId);
    const workflow = await ensureCommerceWorkflow({
      discoveryRecommendationId: quote.discovery_recommendation_id,
      bundleRecommendationId: quote.bundle_recommendation_id,
      workflowName: quote.product_name,
      lifecycleType: quote.bundle_recommendation_id ? "bundle" : "single",
    });
    await transitionCommerceWorkflow({
      workflowId: workflow.id,
      toStage: "quote_selected",
      triggerType: "reconcile",
      triggerSource: "sourcing.decision",
      idempotencyKey: `sourcing-decision:${data.id}:approve`,
      title: "공급처 견적·수익성 승인",
      payload: { quoteId, decisionId: data.id, marginRate: result.expectedMarginRate, score: result.score },
    });
  }
  return data;
}
