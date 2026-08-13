export type ListingRevisionMetrics = Readonly<{
  revisionId: string;
  variantId: string;
  observedFrom: string;
  observedTo: string;
  impressions: number;
  clicks: number;
  orders: number;
  cancellations: number;
  returns: number;
  refunds: number;
  settlementAmount: number;
  attributableProfit: number;
}>;

export type ListingExperimentDecision = Readonly<{
  status: "INSUFFICIENT_TRAFFIC" | "GUARDRAIL_FAILED" | "ELIGIBLE_FOR_HUMAN_REVIEW";
  winnerDeclared: false;
  reasons: readonly string[];
}>;
