import { evaluatePath, type PathPolicy } from "./policy.ts";

export const SHADOW_REVIEW_VERSION = "gonggamline-shadow-review-v1";

export type ShadowOutcome = "NEXT_TASK" | "RETRY" | "REPLAN";

export type VerifiedSource =
  | "GIT"
  | "GITHUB"
  | "VERIFIER"
  | "ARCHITECTURE"
  | "OWNER_DECISION"
  | "BUSINESS_EVIDENCE";

export interface VerifiedContextClaim {
  readonly key: string;
  readonly value: string | number | boolean;
  readonly source: VerifiedSource;
  readonly evidenceReference: string;
  readonly verifiedAt: string;
}

export interface VerifiedContextPack {
  readonly projectId: string;
  readonly baseSha: string;
  readonly policyVersion: string;
  readonly architectureVersion: string;
  readonly claims: readonly VerifiedContextClaim[];
}

export interface ShadowCandidate {
  readonly candidateId: string;
  readonly objective: string;
  readonly paths: readonly string[];
  readonly revenueImpact: {
    readonly monthlyKrw: number;
    readonly confidence: number;
  };
  readonly operatorMinutesSaved: number;
  readonly urgency: number;
  readonly dependencyReady: boolean;
}

export interface ShadowReviewInput {
  readonly context: VerifiedContextPack;
  readonly candidate: ShadowCandidate;
  readonly pathPolicy: PathPolicy;
  readonly priorOutcome?: {
    readonly state: "SUCCEEDED" | "RETRYABLE_FAILURE" | "CONTRACT_INVALID";
    readonly retryBudgetRemaining: number;
  };
}

export interface ShadowReviewProposal {
  readonly mode: "SHADOW";
  readonly version: typeof SHADOW_REVIEW_VERSION;
  readonly outcome: ShadowOutcome;
  readonly candidateId: string;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly dispatchAuthorized: false;
}

export interface OwnerScoredSample {
  readonly sampleId: string;
  readonly proposed: ShadowOutcome;
  readonly approved: ShadowOutcome;
}

export interface ShadowEvaluation {
  readonly sampleSize: number;
  readonly exactMatch: number;
  readonly precision: Readonly<Record<ShadowOutcome, number | null>>;
  readonly recall: Readonly<Record<ShadowOutcome, number | null>>;
}

const outcomes: readonly ShadowOutcome[] = ["NEXT_TASK", "RETRY", "REPLAN"];

function finiteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number`);
  }
}

function validateContext(context: VerifiedContextPack): void {
  if (!/^[a-f0-9]{40}$/.test(context.baseSha)) {
    throw new Error("Verified context requires a full lowercase base SHA");
  }
  if (context.claims.length === 0) {
    throw new Error("Verified context requires at least one claim");
  }
  const keys = new Set<string>();
  for (const claim of context.claims) {
    if (!claim.key.trim() || keys.has(claim.key)) {
      throw new Error("Verified context claim keys must be unique and non-empty");
    }
    if (!claim.evidenceReference.trim() || !Number.isFinite(Date.parse(claim.verifiedAt))) {
      throw new Error(`Claim ${claim.key} lacks verifiable evidence metadata`);
    }
    keys.add(claim.key);
  }
}

export function scoreShadowCandidate(candidate: ShadowCandidate): number {
  finiteNonNegative("monthlyKrw", candidate.revenueImpact.monthlyKrw);
  finiteNonNegative("operatorMinutesSaved", candidate.operatorMinutesSaved);
  if (candidate.revenueImpact.confidence < 0 || candidate.revenueImpact.confidence > 1) {
    throw new Error("confidence must be between 0 and 1");
  }
  if (candidate.urgency < 0 || candidate.urgency > 1) {
    throw new Error("urgency must be between 0 and 1");
  }
  const revenuePoints = Math.min(60, candidate.revenueImpact.monthlyKrw / 1_000_000 * 6)
    * candidate.revenueImpact.confidence;
  const timePoints = Math.min(30, candidate.operatorMinutesSaved / 60 * 3);
  const urgencyPoints = candidate.urgency * 10;
  return Math.round((revenuePoints + timePoints + urgencyPoints) * 100) / 100;
}

export function reviewInShadow(input: ShadowReviewInput): ShadowReviewProposal {
  validateContext(input.context);
  const forbidden = input.candidate.paths.find(
    (candidatePath) => !evaluatePath(input.pathPolicy, candidatePath).allowed,
  );
  if (forbidden) {
    return proposal(input, "REPLAN", 0, [`Forbidden or unapproved path: ${forbidden}`]);
  }
  if (!input.candidate.dependencyReady) {
    return proposal(input, "REPLAN", 0, ["Declared dependency is not verified ready"]);
  }
  if (input.priorOutcome?.state === "CONTRACT_INVALID") {
    return proposal(input, "REPLAN", 0, ["Prior contract is invalid"]);
  }
  if (input.priorOutcome?.state === "RETRYABLE_FAILURE") {
    return input.priorOutcome.retryBudgetRemaining > 0
      ? proposal(input, "RETRY", scoreShadowCandidate(input.candidate), ["Verified retry budget remains"])
      : proposal(input, "REPLAN", 0, ["Retry budget is exhausted"]);
  }
  return proposal(input, "NEXT_TASK", scoreShadowCandidate(input.candidate), [
    "Context, dependency, and scope are verified",
  ]);
}

function proposal(
  input: ShadowReviewInput,
  outcome: ShadowOutcome,
  score: number,
  reasons: readonly string[],
): ShadowReviewProposal {
  return {
    mode: "SHADOW",
    version: SHADOW_REVIEW_VERSION,
    outcome,
    candidateId: input.candidate.candidateId,
    score,
    reasons,
    dispatchAuthorized: false,
  };
}

export function evaluateOwnerSample(samples: readonly OwnerScoredSample[]): ShadowEvaluation {
  if (samples.length === 0) {
    throw new Error("Owner-scored evaluation requires at least one sample");
  }
  const sampleIds = new Set<string>();
  for (const sample of samples) {
    if (!sample.sampleId.trim() || sampleIds.has(sample.sampleId)) {
      throw new Error("Owner-scored sample IDs must be unique and non-empty");
    }
    sampleIds.add(sample.sampleId);
  }
  const precision = {} as Record<ShadowOutcome, number | null>;
  const recall = {} as Record<ShadowOutcome, number | null>;
  for (const outcome of outcomes) {
    const predicted = samples.filter((sample) => sample.proposed === outcome).length;
    const approved = samples.filter((sample) => sample.approved === outcome).length;
    const truePositive = samples.filter(
      (sample) => sample.proposed === outcome && sample.approved === outcome,
    ).length;
    precision[outcome] = predicted === 0 ? null : truePositive / predicted;
    recall[outcome] = approved === 0 ? null : truePositive / approved;
  }
  return {
    sampleSize: samples.length,
    exactMatch: samples.filter((sample) => sample.proposed === sample.approved).length / samples.length,
    precision,
    recall,
  };
}
