export type ListingRevisionMetrics = Readonly<{
  eventId: string;
  packetId: string;
  revisionId: string;
  variantId: string;
  recordedAt: string;
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

export type ListingRevisionPerformance = Readonly<{
  revisionId: string;
  clickThroughRate: number | null;
  conversionRate: number | null;
  cancellationRate: number | null;
  returnRefundRate: number | null;
  attributableProfit: number;
}>;

export type AppendOnlyListingRevision = Readonly<{
  revisionId: string;
  packetId: string;
  previousRevisionId: string | null;
  selectedVariantId: string;
  contentDigest: string;
  policySnapshotIds: readonly string[];
  effectiveFrom: string;
  experiment: Readonly<{
    method: "SEQUENTIAL_REVISION";
    approvalReference: string;
    parallelDuplicateListings: false;
    rollbackRevisionId: string | null;
  }>;
}>;

export type ListingExperimentDecision = Readonly<{
  status: "INSUFFICIENT_TRAFFIC" | "GUARDRAIL_FAILED" | "ELIGIBLE_FOR_HUMAN_REVIEW";
  winnerDeclared: false;
  reasons: readonly string[];
  performance: readonly ListingRevisionPerformance[];
}>;
