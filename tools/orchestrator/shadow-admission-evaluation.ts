import {
  evaluateLimitedCandidateScope,
  type AdmissionCandidate,
  type LimitedCandidatePolicy,
} from "./limited-autonomy.ts";
import {
  reviewInShadow,
  type ShadowOutcome,
  type ShadowReviewInput,
} from "./shadow-review.ts";

export interface ShadowAdmissionScenario {
  readonly review: ShadowReviewInput;
  readonly admission: AdmissionCandidate;
  readonly evaluatedAt: string;
}

export interface ShadowAdmissionResult {
  readonly outcome: ShadowOutcome;
  readonly reasons: readonly string[];
  readonly dispatchOrExternalWrites: 0;
}

export function evaluateShadowAdmissionScenario(
  policy: LimitedCandidatePolicy,
  scenario: ShadowAdmissionScenario,
): ShadowAdmissionResult {
  let reviewOutcome: ShadowOutcome;
  let reviewReasons: readonly string[];
  try {
    const proposal = reviewInShadow(scenario.review);
    reviewOutcome = proposal.outcome;
    reviewReasons = proposal.reasons;
  } catch (error) {
    return {
      outcome: "REPLAN",
      reasons: [error instanceof Error ? error.message : "SHADOW review input is invalid"],
      dispatchOrExternalWrites: 0,
    };
  }

  if (reviewOutcome !== "NEXT_TASK") {
    return { outcome: reviewOutcome, reasons: reviewReasons, dispatchOrExternalWrites: 0 };
  }

  const admission = evaluateLimitedCandidateScope(
    policy,
    scenario.admission,
    scenario.evaluatedAt,
  );
  return admission.authorized
    ? { outcome: "NEXT_TASK", reasons: reviewReasons, dispatchOrExternalWrites: 0 }
    : { outcome: "REPLAN", reasons: admission.reasons, dispatchOrExternalWrites: 0 };
}
