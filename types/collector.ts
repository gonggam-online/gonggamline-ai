export type CollectorStatus = "ready" | "disabled" | "cooldown" | "blocked" | "error";

export type CollectorDefinition = {
  key: string;
  name: string;
  sourceType: "official_api" | "paid_api" | "public_observation" | "manual" | "internal" | "demo";
  supportsAutomatic: boolean;
  description: string;
};

export type CollectorRunResult = {
  collectorKey: string;
  requested: number;
  saved: number;
  analyzed: number;
  status: "success" | "partial" | "failed" | "skipped";
  message: string;
};
