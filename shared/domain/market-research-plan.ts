/**
 * Deterministic planning contract for lawful market research.
 *
 * This module never performs network calls, spends money, reads secrets, or
 * changes an operational verdict. It turns the evidence gaps for a candidate
 * into an ordered set of read-only research tasks so an approved executor can
 * use official, paid, public, and supplier lanes consistently.
 */

export const MARKET_RESEARCH_PLAN_VERSION =
  "gonggamline-market-research-plan-v1" as const;

export type MarketResearchLane =
  | "OFFICIAL_API"
  | "PAID_PROVIDER"
  | "PUBLIC_METADATA"
  | "PUBLIC_VIDEO_METADATA"
  | "SUPPLIER_CATALOG"
  | "MANUAL_IMPORT";

export type MarketResearchReadiness =
  | "READY_READ_ONLY"
  | "APPROVAL_REQUIRED"
  | "NOT_CONFIGURED"
  | "BLOCKED_POLICY"
  | "COOLDOWN";

export type MarketResearchSource = Readonly<{
  sourceKey: string;
  label: string;
  lane: MarketResearchLane;
  readiness: MarketResearchReadiness;
  approved: boolean;
  readOnly: boolean;
  estimatedCostKrw: number;
  quotaPerDay: number | null;
  minimumIntervalSeconds: number;
  policyVersion: string;
}>;

export type MarketResearchCandidate = Readonly<{
  providerItemNumber: string;
  keyword: string;
  category: string | null;
  missingSignals: readonly string[];
}>;

export type MarketResearchTask = Readonly<{
  sourceKey: string;
  lane: MarketResearchLane;
  query: string;
  purpose: "DEMAND" | "COMPETITION" | "GROWTH" | "SUPPLY" | "CONTENT" | "ECONOMICS";
  readiness: MarketResearchReadiness;
  canExecute: boolean;
  estimatedCostKrw: number;
  requiredSignals: readonly string[];
  blockers: readonly string[];
}>;

export type MarketResearchPlan = Readonly<{
  version: typeof MARKET_RESEARCH_PLAN_VERSION;
  candidate: MarketResearchCandidate;
  tasks: readonly MarketResearchTask[];
  executableTaskCount: number;
  approvalRequiredTaskCount: number;
  estimatedCostKrw: number;
  blockers: readonly string[];
}>;

const PURPOSE_BY_SIGNAL: Readonly<Record<string, MarketResearchTask["purpose"]>> = {
  demand: "DEMAND",
  competition: "COMPETITION",
  growth: "GROWTH",
  supply: "SUPPLY",
  content: "CONTENT",
  economics: "ECONOMICS",
};

function normalizedCost(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function sourcePriority(source: MarketResearchSource): number {
  const lanePriority: Readonly<Record<MarketResearchLane, number>> = {
    OFFICIAL_API: 100,
    PAID_PROVIDER: 90,
    SUPPLIER_CATALOG: 85,
    PUBLIC_METADATA: 70,
    PUBLIC_VIDEO_METADATA: 60,
    MANUAL_IMPORT: 40,
  };
  return lanePriority[source.lane] - normalizedCost(source.estimatedCostKrw) / 1_000;
}

function taskFor(
  candidate: MarketResearchCandidate,
  source: MarketResearchSource,
  signal: string,
): MarketResearchTask {
  const blockers: string[] = [];
  if (!source.approved) blockers.push("source.ownerApproval");
  if (!source.readOnly) blockers.push("source.readOnlyContract");
  if (source.readiness === "BLOCKED_POLICY") blockers.push("source.policy");
  if (source.readiness === "COOLDOWN") blockers.push("source.cooldown");
  if (source.readiness === "NOT_CONFIGURED") blockers.push("source.configuration");
  if (source.readiness === "APPROVAL_REQUIRED") blockers.push("source.ownerApproval");
  const canExecute = blockers.length === 0 && source.readiness === "READY_READ_ONLY";
  return Object.freeze({
    sourceKey: source.sourceKey,
    lane: source.lane,
    query: candidate.keyword,
    purpose: PURPOSE_BY_SIGNAL[signal] ?? "DEMAND",
    readiness: source.readiness,
    canExecute,
    estimatedCostKrw: normalizedCost(source.estimatedCostKrw),
    requiredSignals: Object.freeze([`market.${signal}`]),
    blockers: Object.freeze([...new Set(blockers)].sort()),
  });
}

/**
 * Builds the next lawful research steps for one candidate. Missing economic
 * evidence keeps a candidate in research rather than silently rejecting it;
 * the plan only marks the exact source task that can fill that gap.
 */
export function buildMarketResearchPlan(
  candidate: MarketResearchCandidate,
  sources: readonly MarketResearchSource[],
): MarketResearchPlan {
  if (!/^\d{1,20}$/.test(candidate.providerItemNumber)) {
    throw new RangeError("providerItemNumber must contain 1 to 20 digits.");
  }
  if (candidate.keyword.trim() !== candidate.keyword || candidate.keyword.length < 2 || candidate.keyword.length > 100) {
    throw new RangeError("keyword must be a trimmed string between 2 and 100 characters.");
  }
  const uniqueSignals = [...new Set(candidate.missingSignals.map((signal) => signal.trim().toLowerCase()).filter(Boolean))];
  const rankedSources = [...sources].sort((left, right) => sourcePriority(right) - sourcePriority(left) || left.sourceKey.localeCompare(right.sourceKey));
  const tasks = uniqueSignals.flatMap((signal) => {
    const source = rankedSources.find((entry) => entry.readiness === "READY_READ_ONLY" && entry.approved && entry.readOnly)
      ?? rankedSources[0];
    return source ? [taskFor(candidate, source, signal)] : [];
  });
  const blockers = [...new Set([
    ...tasks.flatMap((task) => task.blockers),
    ...(uniqueSignals.length > 0 && rankedSources.length === 0 ? ["source.noAvailableLane"] : []),
  ])].sort();
  return Object.freeze({
    version: MARKET_RESEARCH_PLAN_VERSION,
    candidate: Object.freeze({ ...candidate, missingSignals: Object.freeze(uniqueSignals) }),
    tasks: Object.freeze(tasks),
    executableTaskCount: tasks.filter((task) => task.canExecute).length,
    approvalRequiredTaskCount: tasks.filter((task) => !task.canExecute).length,
    estimatedCostKrw: tasks.reduce((total, task) => total + task.estimatedCostKrw, 0),
    blockers: Object.freeze(blockers),
  });
}
