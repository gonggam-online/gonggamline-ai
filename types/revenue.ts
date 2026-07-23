export type OpportunityStatus =
  | "idea"
  | "candidate"
  | "evaluating"
  | "approved"
  | "content"
  | "ready"
  | "published"
  | "selling"
  | "learning"
  | "rejected"
  | "archived";

export type RuntimeJobStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "retry"
  | "archived";

export type RevenueOpportunity = {
  id: number;
  opportunity_code: string;
  keyword: string;
  title: string;
  source: string;
  source_product_id: string | null;
  status: OpportunityStatus;
  demand_score: number;
  margin_score: number;
  competition_score: number;
  supply_score: number;
  risk_score: number;
  listing_score: number;
  revenue_score: number;
  ai_confidence: number;
  estimated_sale_price: number;
  estimated_cost: number;
  estimated_profit: number;
  expected_monthly_sales: number;
  evidence: unknown[];
  reasons: string[];
  risks: string[];
  next_action: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RuntimeJob = {
  id: number;
  job_code: string;
  opportunity_id: number | null;
  worker_code: string;
  job_type: string;
  status: RuntimeJobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  error_message: string | null;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  locked_by?: string | null;
  locked_at?: string | null;
  last_heartbeat_at?: string | null;
  duration_ms?: number | null;
  result_summary?: string | null;
};
