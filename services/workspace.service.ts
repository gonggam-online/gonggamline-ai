import { supabase } from "@/lib/supabase";

export async function getProductWorkspace() {
  const [workflows, orders, inbounds, drafts, mappings, quotes] = await Promise.all([
    supabase.from("commerce_workflows").select("*, commerce_timeline_events(*)").order("updated_at", { ascending: false }),
    supabase.from("procurement_orders").select("*, suppliers(name)").order("updated_at", { ascending: false }),
    supabase.from("three_pl_inbound_plans").select("*").order("updated_at", { ascending: false }),
    supabase.from("listing_drafts").select("*").order("updated_at", { ascending: false }),
    supabase.from("domestic_supplier_products").select("*, suppliers(name)").order("updated_at", { ascending: false }),
    supabase.from("supplier_quotes").select("*, suppliers(name), sourcing_decisions(*)").order("created_at", { ascending: false }),
  ]);
  for (const result of [workflows, orders, inbounds, drafts, mappings, quotes]) if (result.error) throw new Error(result.error.message);
  const rows = (workflows.data ?? []).map(workflow => {
    const order = (orders.data ?? []).find(x => x.id === workflow.procurement_order_id) ?? null;
    const inbound = order ? (inbounds.data ?? []).find(x => x.procurement_order_id === order.id) ?? null : null;
    const draft = (drafts.data ?? []).find(x => x.id === workflow.listing_draft_id || x.workflow_id === workflow.id) ?? null;
    const mapping = (mappings.data ?? []).find(x => x.discovery_recommendation_id === workflow.discovery_recommendation_id || x.bundle_recommendation_id === workflow.bundle_recommendation_id) ?? null;
    const quote = (quotes.data ?? []).find(x => x.discovery_recommendation_id === workflow.discovery_recommendation_id || x.bundle_recommendation_id === workflow.bundle_recommendation_id) ?? null;
    return { ...workflow, order, inbound, draft, mapping, quote };
  });
  return { workflows: rows };
}
