import assert from "node:assert/strict";
import test from "node:test";

import {
  ITEM_SELECTION_EVALUATOR_VERSION,
  ITEM_SELECTION_HARD_GATES,
  ITEM_SELECTION_RULESET_VERSION,
  calculateItemSelectionScore,
  evaluateItemSelection,
  sortItemSelectionEvaluations,
  type HardGateCheck,
  type HardGateStatus,
  type ItemSelectionHardGate,
  type ItemSelectionScoreInputs,
  type ProfitabilityPolicyInput,
} from "../shared/domain/item-selection.ts";

function gates(
  overrides: Partial<Record<ItemSelectionHardGate, HardGateStatus>> = {}
): HardGateCheck[] {
  return ITEM_SELECTION_HARD_GATES.map((gate) => {
    const status = overrides[gate] ?? "PASS";
    return {
      gate,
      status,
      reasonCode: `TEST_${status}`,
      policyReasonCode:
        status === "NOT_APPLICABLE" ? "TEST_APPROVED_NA" : null,
      evidence: [],
      missingFacts: status === "UNKNOWN" ? [`${gate}.evidence`] : [],
    };
  });
}

function scores(
  normalizedScore = 80,
  unavailable: (keyof ItemSelectionScoreInputs)[] = []
): ItemSelectionScoreInputs {
  return {
    competitiveness: unavailable.includes("competitiveness")
      ? { status: "UNAVAILABLE", missingFacts: ["competition"] }
      : { status: "AVAILABLE", normalizedScore, evidence: [] },
    profitability: unavailable.includes("profitability")
      ? { status: "UNAVAILABLE", missingFacts: ["profitability"] }
      : { status: "AVAILABLE", normalizedScore, evidence: [] },
    demand: unavailable.includes("demand")
      ? { status: "UNAVAILABLE", missingFacts: ["demand"] }
      : { status: "AVAILABLE", normalizedScore, evidence: [] },
    conversionPotential: unavailable.includes("conversionPotential")
      ? { status: "UNAVAILABLE", missingFacts: ["conversion"] }
      : { status: "AVAILABLE", normalizedScore, evidence: [] },
    logisticsFit: unavailable.includes("logisticsFit")
      ? { status: "UNAVAILABLE", missingFacts: ["logistics"] }
      : { status: "AVAILABLE", normalizedScore, evidence: [] },
    supplyStability: unavailable.includes("supplyStability")
      ? { status: "UNAVAILABLE", missingFacts: ["supply"] }
      : { status: "AVAILABLE", normalizedScore, evidence: [] },
  };
}

const confirmedProfitability: ProfitabilityPolicyInput = {
  status: "CONFIRMED",
  approvedMinimumsStatus: "APPROVED",
  meetsApprovedMinimums: true,
  contributionMarginRate: 20,
};

function evaluate(
  options: {
    providerItemNumber?: string;
    originalPosition?: number;
    hardGates?: HardGateCheck[];
    scoreInputs?: ItemSelectionScoreInputs;
    profitability?: ProfitabilityPolicyInput;
  } = {}
) {
  return evaluateItemSelection({
    providerItemNumber: options.providerItemNumber ?? "100",
    originalPosition: options.originalPosition ?? 0,
    hardGates: options.hardGates ?? gates(),
    scores: options.scoreInputs ?? scores(),
    profitability: options.profitability ?? confirmedProfitability,
  });
}

test("exports immutable v1 ruleset and evaluator versions", () => {
  const result = evaluate();
  assert.equal(result.rulesetVersion, ITEM_SELECTION_RULESET_VERSION);
  assert.equal(result.rulesetVersion, "gonggamline-item-selection-v1");
  assert.equal(result.evaluatorVersion, ITEM_SELECTION_EVALUATOR_VERSION);
});

test("calculates all six weighted score areas and full coverage", () => {
  const result = calculateItemSelectionScore({
    ...scores(0),
    competitiveness: {
      status: "AVAILABLE",
      normalizedScore: 100,
      evidence: [],
    },
    profitability: {
      status: "AVAILABLE",
      normalizedScore: 80,
      evidence: [],
    },
    demand: { status: "AVAILABLE", normalizedScore: 50, evidence: [] },
    conversionPotential: {
      status: "AVAILABLE",
      normalizedScore: 50,
      evidence: [],
    },
    logisticsFit: {
      status: "AVAILABLE",
      normalizedScore: 50,
      evidence: [],
    },
    supplyStability: {
      status: "AVAILABLE",
      normalizedScore: 50,
      evidence: [],
    },
  });

  assert.equal(result.availableWeight, 100);
  assert.equal(result.scoreCoverage, 1);
  assert.equal(result.availableDataScore, 80);
  assert.equal(result.totalScore, 80);
});

test("keeps partial available-data score visible but total score null", () => {
  const result = calculateItemSelectionScore(
    scores(90, ["profitability", "demand"])
  );

  assert.equal(result.availableWeight, 65);
  assert.equal(result.scoreCoverage, 0.65);
  assert.equal(result.availableDataScore, 90);
  assert.equal(result.totalScore, null);
});

test("does not create a score when every area is unavailable", () => {
  const result = calculateItemSelectionScore(
    scores(90, [
      "competitiveness",
      "profitability",
      "demand",
      "conversionPotential",
      "logisticsFit",
      "supplyStability",
    ])
  );

  assert.equal(result.availableWeight, 0);
  assert.equal(result.scoreCoverage, 0);
  assert.equal(result.availableDataScore, null);
  assert.equal(result.totalScore, null);
});

test("rejects normalized scores outside 0 through 100", () => {
  assert.throws(
    () =>
      calculateItemSelectionScore({
        ...scores(),
        demand: { status: "AVAILABLE", normalizedScore: 100.1, evidence: [] },
      }),
    /demand\.normalizedScore/
  );
});

test("a hard-gate FAIL always produces REJECT", () => {
  const result = evaluate({
    hardGates: gates({
      resalePermission: "UNKNOWN",
      imageUsePermission: "FAIL",
    }),
  });

  assert.equal(result.verdict, "REJECT");
  assert(result.risks.includes("하드게이트 실패: imageUsePermission"));
});

test("a required hard-gate UNKNOWN caps a high score at MANUAL_REVIEW", () => {
  const result = evaluate({
    hardGates: gates({ resalePermission: "UNKNOWN" }),
    scoreInputs: scores(100),
  });

  assert.equal(result.verdict, "MANUAL_REVIEW");
  assert(result.missingFacts.includes("resalePermission.evidence"));
});

test("incomplete coverage caps otherwise valid inputs at MANUAL_REVIEW", () => {
  const result = evaluate({
    scoreInputs: scores(100, ["supplyStability"]),
  });

  assert.equal(result.verdict, "MANUAL_REVIEW");
  assert.equal(result.score.totalScore, null);
  assert(result.missingFacts.includes("score.supplyStability"));
});

test("incomplete profitability caps a full score at MANUAL_REVIEW", () => {
  const result = evaluate({
    profitability: {
      status: "INCOMPLETE",
      approvedMinimumsStatus: "APPROVED",
      meetsApprovedMinimums: null,
      contributionMarginRate: null,
    },
  });

  assert.equal(result.verdict, "MANUAL_REVIEW");
  assert(result.missingFacts.includes("profitability.requiredInputs"));
});

test("unapproved profit minimums cap a full score at MANUAL_REVIEW", () => {
  const result = evaluate({
    profitability: {
      status: "CONFIRMED",
      approvedMinimumsStatus: "UNAPPROVED",
      meetsApprovedMinimums: null,
      contributionMarginRate: 25,
    },
  });

  assert.equal(result.verdict, "MANUAL_REVIEW");
  assert(result.missingFacts.includes("profitability.approvedMinimums"));
});

test("applies the approved 75 and 60 score boundaries", () => {
  assert.equal(evaluate({ scoreInputs: scores(75) }).verdict, "RECOMMEND");
  assert.equal(evaluate({ scoreInputs: scores(74.9) }).verdict, "CONDITIONAL");
  assert.equal(evaluate({ scoreInputs: scores(60) }).verdict, "CONDITIONAL");
  assert.equal(evaluate({ scoreInputs: scores(59.9) }).verdict, "REJECT");
});

test("uses CONDITIONAL when approved profitability minimums are missed", () => {
  const result = evaluate({
    profitability: {
      ...confirmedProfitability,
      meetsApprovedMinimums: false,
    },
  });

  assert.equal(result.verdict, "CONDITIONAL");
  assert(result.risks.includes("승인된 최소 수익성 기준을 충족하지 못했습니다."));
});

test("requires every hard gate exactly once", () => {
  assert.throws(
    () => evaluate({ hardGates: gates().slice(1) }),
    /Every v1 hard gate/
  );
  assert.throws(
    () => evaluate({ hardGates: [...gates().slice(0, 4), gates()[0]] }),
    /Duplicate hard gate/
  );
});

test("enforces v1 NOT_APPLICABLE policy restrictions", () => {
  assert.throws(
    () =>
      evaluate({
        hardGates: gates({ intellectualPropertyRisk: "NOT_APPLICABLE" }),
      }),
    /cannot be NOT_APPLICABLE/
  );

  const allowed = evaluate({
    hardGates: gates({ imageUsePermission: "NOT_APPLICABLE" }),
  });
  assert.equal(allowed.verdict, "RECOMMEND");
});

test("sorts by verdict, total score, margin, numeric item id, then position", () => {
  const recommendLowerMargin = evaluate({
    providerItemNumber: "10",
    originalPosition: 2,
    profitability: {
      ...confirmedProfitability,
      contributionMarginRate: 10,
    },
  });
  const recommendHigherMargin = evaluate({
    providerItemNumber: "20",
    originalPosition: 1,
    profitability: {
      ...confirmedProfitability,
      contributionMarginRate: 30,
    },
  });
  const conditional = evaluate({
    providerItemNumber: "2",
    scoreInputs: scores(70),
  });
  const manual = evaluate({
    providerItemNumber: "1",
    hardGates: gates({ taxInvoiceEvidence: "UNKNOWN" }),
  });

  const sorted = sortItemSelectionEvaluations([
    manual,
    recommendLowerMargin,
    conditional,
    recommendHigherMargin,
  ]);

  assert.deepEqual(
    sorted.map(({ providerItemNumber }) => providerItemNumber),
    ["20", "10", "2", "1"]
  );
});

test("places null score and margin last inside MANUAL_REVIEW deterministically", () => {
  const fullScore = evaluate({
    providerItemNumber: "10",
    hardGates: gates({ resalePermission: "UNKNOWN" }),
  });
  const nullScore = evaluate({
    providerItemNumber: "2",
    hardGates: gates({ resalePermission: "UNKNOWN" }),
    scoreInputs: scores(100, ["supplyStability"]),
    profitability: {
      status: "NOT_EVALUATED",
      approvedMinimumsStatus: "UNAPPROVED",
      meetsApprovedMinimums: null,
      contributionMarginRate: null,
    },
  });

  assert.deepEqual(
    sortItemSelectionEvaluations([nullScore, fullScore]).map(
      ({ providerItemNumber }) => providerItemNumber
    ),
    ["10", "2"]
  );
});
