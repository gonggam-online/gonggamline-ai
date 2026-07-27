export const ITEM_SELECTION_RULESET_VERSION =
  "gonggamline-item-selection-v1" as const;

export const ITEM_SELECTION_EVALUATOR_VERSION = "item-selection-evaluator-v1" as const;

export const ITEM_SELECTION_SCORE_WEIGHTS = {
  competitiveness: 45,
  profitability: 25,
  demand: 10,
  conversionPotential: 8,
  logisticsFit: 7,
  supplyStability: 5,
} as const;

export type ItemSelectionScoreArea = keyof typeof ITEM_SELECTION_SCORE_WEIGHTS;

export const ITEM_SELECTION_HARD_GATES = [
  "resalePermission",
  "intellectualPropertyRisk",
  "imageUsePermission",
  "imageEditingPermission",
  "taxInvoiceEvidence",
] as const;

export type ItemSelectionHardGate = (typeof ITEM_SELECTION_HARD_GATES)[number];

export type HardGateStatus =
  | "PASS"
  | "FAIL"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

export type ItemSelectionVerdict =
  | "RECOMMEND"
  | "CONDITIONAL"
  | "MANUAL_REVIEW"
  | "REJECT";

export type ItemSelectionEvidence = {
  sourceType: string;
  sourceField: string | null;
  summary: string;
  observedAt: string;
  reference: string | null;
};

export type HardGateCheck = {
  gate: ItemSelectionHardGate;
  status: HardGateStatus;
  reasonCode: string;
  policyReasonCode: string | null;
  evidence: readonly ItemSelectionEvidence[];
  missingFacts: readonly string[];
};

export type AvailableScoreInput = {
  status: "AVAILABLE";
  normalizedScore: number;
  evidence: readonly ItemSelectionEvidence[];
};

export type UnavailableScoreInput = {
  status: "UNAVAILABLE";
  missingFacts: readonly string[];
};

export type ScoreAreaInput = AvailableScoreInput | UnavailableScoreInput;

export type ItemSelectionScoreInputs = {
  [Area in ItemSelectionScoreArea]: ScoreAreaInput;
};

export type ScoreAreaResult = {
  area: ItemSelectionScoreArea;
  status: "AVAILABLE" | "UNAVAILABLE";
  weight: number;
  normalizedScore: number | null;
  weightedContribution: number | null;
};

export type ItemSelectionScoreResult = {
  areas: readonly ScoreAreaResult[];
  availableWeight: number;
  availableDataScore: number | null;
  scoreCoverage: number;
  totalScore: number | null;
};

export type ProfitabilityPolicyInput = {
  status: "CONFIRMED" | "ESTIMATED" | "INCOMPLETE" | "NOT_EVALUATED";
  policyVersion: string | null;
  meetsRecommendMinimums: boolean | null;
  meetsConditionalMinimums: boolean | null;
  contributionMarginRate: number | null;
  estimatedFacts: readonly string[];
  missingFacts: readonly string[];
  nextActions: readonly string[];
};

export type EvaluateItemSelectionInput = {
  providerItemNumber: string;
  originalPosition: number;
  hardGates: readonly HardGateCheck[];
  scores: ItemSelectionScoreInputs;
  profitability: ProfitabilityPolicyInput;
};

export type ItemSelectionEvaluation = {
  rulesetVersion: typeof ITEM_SELECTION_RULESET_VERSION;
  evaluatorVersion: typeof ITEM_SELECTION_EVALUATOR_VERSION;
  providerItemNumber: string;
  originalPosition: number;
  hardGates: readonly HardGateCheck[];
  score: ItemSelectionScoreResult;
  profitability: ProfitabilityPolicyInput;
  verdict: ItemSelectionVerdict;
  recommendationReasons: readonly string[];
  risks: readonly string[];
  missingFacts: readonly string[];
};

const VERDICT_ORDER: Record<ItemSelectionVerdict, number> = {
  RECOMMEND: 0,
  CONDITIONAL: 1,
  MANUAL_REVIEW: 2,
  REJECT: 3,
};

const SCORE_AREAS = Object.keys(
  ITEM_SELECTION_SCORE_WEIGHTS
) as ItemSelectionScoreArea[];

const NON_APPLICABLE_FORBIDDEN = new Set<ItemSelectionHardGate>([
  "intellectualPropertyRisk",
  "taxInvoiceEvidence",
]);

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function assertFiniteRange(
  value: number,
  minimum: number,
  maximum: number,
  field: string
): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${field} must be between ${minimum} and ${maximum}.`);
  }
}

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${field} must be finite.`);
  }
}

function validateHardGates(
  hardGates: readonly HardGateCheck[]
): readonly HardGateCheck[] {
  if (hardGates.length !== ITEM_SELECTION_HARD_GATES.length) {
    throw new RangeError("Every v1 hard gate must be evaluated exactly once.");
  }

  const byGate = new Map<ItemSelectionHardGate, HardGateCheck>();
  for (const check of hardGates) {
    if (byGate.has(check.gate)) {
      throw new RangeError(`Duplicate hard gate: ${check.gate}.`);
    }
    if (check.reasonCode.trim() === "") {
      throw new RangeError(`Hard gate ${check.gate} requires a reason code.`);
    }
    if (check.status === "NOT_APPLICABLE") {
      if (
        NON_APPLICABLE_FORBIDDEN.has(check.gate) ||
        !check.policyReasonCode?.trim()
      ) {
        throw new RangeError(
          `Hard gate ${check.gate} cannot be NOT_APPLICABLE without an approved policy reason.`
        );
      }
    } else if (check.policyReasonCode !== null) {
      throw new RangeError(
        `Hard gate ${check.gate} may use a policy reason only when NOT_APPLICABLE.`
      );
    }
    byGate.set(check.gate, check);
  }

  return ITEM_SELECTION_HARD_GATES.map((gate) => {
    const check = byGate.get(gate);
    if (!check) throw new RangeError(`Missing hard gate: ${gate}.`);
    return check;
  });
}

export function calculateItemSelectionScore(
  inputs: ItemSelectionScoreInputs
): ItemSelectionScoreResult {
  let availableWeight = 0;
  let weightedScoreSum = 0;

  const areas = SCORE_AREAS.map<ScoreAreaResult>((area) => {
    const input = inputs[area];
    const weight = ITEM_SELECTION_SCORE_WEIGHTS[area];
    if (input.status === "UNAVAILABLE") {
      return {
        area,
        status: input.status,
        weight,
        normalizedScore: null,
        weightedContribution: null,
      };
    }

    assertFiniteRange(input.normalizedScore, 0, 100, `${area}.normalizedScore`);
    const rawWeightedContribution = (input.normalizedScore * weight) / 100;
    const weightedContribution = round(rawWeightedContribution, 2);
    availableWeight += weight;
    weightedScoreSum += rawWeightedContribution;
    return {
      area,
      status: input.status,
      weight,
      normalizedScore: input.normalizedScore,
      weightedContribution,
    };
  });

  const scoreCoverage = round(availableWeight / 100, 2);
  const availableDataScore =
    availableWeight === 0
      ? null
      : round((weightedScoreSum / availableWeight) * 100, 1);

  return {
    areas,
    availableWeight,
    availableDataScore,
    scoreCoverage,
    totalScore: availableWeight === 100 ? availableDataScore : null,
  };
}

function determineVerdict(
  hardGates: readonly HardGateCheck[],
  score: ItemSelectionScoreResult,
  profitability: ProfitabilityPolicyInput
): ItemSelectionVerdict {
  if (hardGates.some(({ status }) => status === "FAIL")) return "REJECT";
  if (hardGates.some(({ status }) => status === "UNKNOWN")) {
    return "MANUAL_REVIEW";
  }
  if (
    profitability.status !== "CONFIRMED" ||
    profitability.policyVersion === null ||
    score.totalScore === null
  ) {
    return "MANUAL_REVIEW";
  }
  if (
    score.totalScore >= 75 &&
    profitability.meetsRecommendMinimums === true
  ) {
    return "RECOMMEND";
  }
  if (
    score.totalScore >= 60 &&
    profitability.meetsConditionalMinimums === true
  ) {
    return "CONDITIONAL";
  }
  return "REJECT";
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))].sort();
}

function explanations(
  verdict: ItemSelectionVerdict,
  hardGates: readonly HardGateCheck[],
  score: ItemSelectionScoreResult,
  profitability: ProfitabilityPolicyInput
): Pick<
  ItemSelectionEvaluation,
  "recommendationReasons" | "risks" | "missingFacts"
> {
  const failures = hardGates.filter(({ status }) => status === "FAIL");
  const unknowns = hardGates.filter(({ status }) => status === "UNKNOWN");
  const missingFacts = uniqueSorted([
    ...hardGates.flatMap((check) => check.missingFacts),
    ...SCORE_AREAS.flatMap((area) => {
      const result = score.areas.find((candidate) => candidate.area === area);
      return result?.status === "UNAVAILABLE" ? [`score.${area}`] : [];
    }),
    ...(profitability.status === "CONFIRMED"
      ? []
      : [
          "profitability.requiredInputs",
          ...profitability.estimatedFacts,
          ...profitability.missingFacts,
        ]),
    ...(profitability.policyVersion !== null
      ? []
      : ["profitability.approvedMinimums"]),
  ]);

  const recommendationReasons: string[] = [];
  const risks: string[] = [];

  if (verdict === "RECOMMEND") {
    recommendationReasons.push(
      `필수 하드게이트를 통과했고 총점 ${score.totalScore}점과 승인된 수익성 기준을 충족했습니다.`
    );
  } else if (verdict === "CONDITIONAL") {
    recommendationReasons.push(
      `필수 하드게이트를 통과했고 총점 ${score.totalScore}점으로 조건부 검토 대상입니다.`
    );
    if (profitability.meetsRecommendMinimums === false) {
      risks.push("승인된 최소 수익성 기준을 충족하지 못했습니다.");
    }
  } else if (verdict === "MANUAL_REVIEW") {
    recommendationReasons.push("확정되지 않은 필수 정보가 있어 수동 확인이 필요합니다.");
  } else {
    recommendationReasons.push("필수 정책 기준을 충족하지 못해 추천에서 제외합니다.");
  }

  risks.push(
    ...failures.map((check) => `하드게이트 실패: ${check.gate}`),
    ...unknowns.map((check) => `하드게이트 확인 필요: ${check.gate}`)
  );
  if (score.totalScore === null) {
    risks.push(`점수 데이터 coverage가 ${(score.scoreCoverage * 100).toFixed(0)}%입니다.`);
  }
  if (profitability.status !== "CONFIRMED") {
    risks.push(
      profitability.status === "ESTIMATED"
        ? "필수 비용에 추정값이 있어 추천 상한이 수동 검토입니다."
        : "수익성을 확정할 필수 입력이 부족합니다.",
      ...profitability.nextActions,
    );
  } else if (profitability.policyVersion === null) {
    risks.push("승인된 최소 수익성 기준이 없습니다.");
  }

  return {
    recommendationReasons,
    risks: uniqueSorted(risks),
    missingFacts,
  };
}

export function evaluateItemSelection(
  input: EvaluateItemSelectionInput
): ItemSelectionEvaluation {
  if (!/^\d{1,20}$/.test(input.providerItemNumber)) {
    throw new RangeError("providerItemNumber must contain 1 to 20 digits.");
  }
  if (!Number.isSafeInteger(input.originalPosition) || input.originalPosition < 0) {
    throw new RangeError("originalPosition must be a non-negative safe integer.");
  }
  if (input.profitability.contributionMarginRate !== null) {
    assertFinite(
      input.profitability.contributionMarginRate,
      "profitability.contributionMarginRate"
    );
  }

  const hardGates = validateHardGates(input.hardGates);
  const score = calculateItemSelectionScore(input.scores);
  const verdict = determineVerdict(hardGates, score, input.profitability);

  return {
    rulesetVersion: ITEM_SELECTION_RULESET_VERSION,
    evaluatorVersion: ITEM_SELECTION_EVALUATOR_VERSION,
    providerItemNumber: input.providerItemNumber,
    originalPosition: input.originalPosition,
    hardGates,
    score,
    profitability: input.profitability,
    verdict,
    ...explanations(verdict, hardGates, score, input.profitability),
  };
}

function compareNullableDescending(
  left: number | null,
  right: number | null
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

function compareProviderItemNumber(left: string, right: string): number {
  const leftNumber = BigInt(left);
  const rightNumber = BigInt(right);
  if (leftNumber < rightNumber) return -1;
  if (leftNumber > rightNumber) return 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareItemSelectionEvaluations(
  left: ItemSelectionEvaluation,
  right: ItemSelectionEvaluation
): number {
  return (
    VERDICT_ORDER[left.verdict] - VERDICT_ORDER[right.verdict] ||
    compareNullableDescending(left.score.totalScore, right.score.totalScore) ||
    compareNullableDescending(
      left.profitability.contributionMarginRate,
      right.profitability.contributionMarginRate
    ) ||
    compareProviderItemNumber(
      left.providerItemNumber,
      right.providerItemNumber
    ) ||
    left.originalPosition - right.originalPosition
  );
}

export function sortItemSelectionEvaluations(
  evaluations: readonly ItemSelectionEvaluation[]
): ItemSelectionEvaluation[] {
  return [...evaluations].sort(compareItemSelectionEvaluations);
}
