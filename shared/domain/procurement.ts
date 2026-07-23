export type ProcurementOrderStatus =
  | "draft"
  | "approved"
  | "ordered"
  | "supplier_confirmed"
  | "inbound_planned"
  | "in_transit"
  | "received"
  | "cancelled";

export type WorkflowStage =
  | "market_discovered"
  | "ai_recommended"
  | "human_approved"
  | "supplier_mapped"
  | "quote_selected"
  | "purchase_approved"
  | "purchase_ordered"
  | "three_pl_inbound"
  | "listing_ready"
  | "coupang_registered"
  | "selling"
  | "learning";

export type ProcurementScoreInput = {
  marginRate: number;
  supplierReliability: number;
  moq: number;
  leadTimeDays: number;
  quoteAgeDays: number;
};
