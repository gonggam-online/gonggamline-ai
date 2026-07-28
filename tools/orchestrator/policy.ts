import path from "node:path";

export interface PathPolicy {
  readonly allowed: readonly string[];
  readonly denied: readonly string[];
}

export interface PathDecision {
  readonly allowed: boolean;
  readonly normalizedPath: string;
  readonly reason: "ALLOWED" | "NOT_ALLOWLISTED" | "DENIED" | "INVALID_PATH";
}

function normalizeRepoPath(candidate: string): string | null {
  const normalized = candidate.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (
    normalized.length === 0 ||
    path.win32.isAbsolute(candidate) ||
    path.posix.isAbsolute(candidate) ||
    normalized.split("/").includes("..")
  ) {
    return null;
  }
  return normalized;
}

function matches(pattern: string, candidate: string): boolean {
  const normalizedPattern = pattern.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    return candidate === prefix || candidate.startsWith(`${prefix}/`);
  }
  return candidate === normalizedPattern;
}

export function evaluatePath(policy: PathPolicy, candidate: string): PathDecision {
  const normalizedPath = normalizeRepoPath(candidate);
  if (normalizedPath === null) {
    return { allowed: false, normalizedPath: candidate, reason: "INVALID_PATH" };
  }
  if (policy.denied.some((pattern) => matches(pattern, normalizedPath))) {
    return { allowed: false, normalizedPath, reason: "DENIED" };
  }
  if (!policy.allowed.some((pattern) => matches(pattern, normalizedPath))) {
    return { allowed: false, normalizedPath, reason: "NOT_ALLOWLISTED" };
  }
  return { allowed: true, normalizedPath, reason: "ALLOWED" };
}

export const manualApprovalActions = new Set([
  "FINAL_PR_MERGE",
  "PRODUCTION_DEPLOY",
  "PRODUCTION_ROLLBACK",
  "SUPABASE_SCHEMA",
  "SUPABASE_RLS_AUTH",
  "SUPABASE_DATA",
  "REAL_LISTING",
  "REAL_PRICE_INVENTORY_AD",
  "REAL_ORDER_PURCHASE_FULFILLMENT",
  "RETURN_SETTLEMENT_PAYMENT",
  "OAUTH_LOGIN",
  "SECRET_CHANGE",
  "PAID_API_OR_LIMIT",
  "PERMISSION_EXPANSION",
  "FORCE_PUSH_OR_PROTECTED_BRANCH",
  "LEGAL_FINANCIAL_CERTIFICATION",
  "AUTONOMY_EXPANSION",
  "RETRY_BUDGET_OVERRIDE",
]);

export function requiresManualApproval(action: string): boolean {
  return manualApprovalActions.has(action);
}
