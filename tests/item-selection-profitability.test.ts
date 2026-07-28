import assert from "node:assert/strict";
import test from "node:test";

import {
  ITEM_SELECTION_PROFITABILITY_POLICY,
  ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
  calculateItemSelectionProfitability,
  mapSupplierProfitabilityFacts,
  toItemSelectionProfitabilityPolicyInput,
  type ItemSelectionProfitabilityInput,
  type MoneyFact,
  type RateFact,
  type VatTreatment,
} from "../lib/revenue/item-selection-profitability.ts";
import {
  ITEM_SELECTION_HARD_GATES,
  evaluateItemSelection,
  type HardGateCheck,
  type ItemSelectionHardGate,
  type ItemSelectionScoreInputs,
} from "../shared/domain/item-selection.ts";

function money(
  id: string,
  amountKrw: number | null,
  options: {
    status?: MoneyFact["confirmationStatus"];
    vat?: VatTreatment;
    includedIn?: readonly string[];
  } = {},
): MoneyFact {
  const status = options.status ?? "CONFIRMED";
  return {
    id,
    amountKrw,
    sourceType: status === "ESTIMATED" ? "APPROVED_POLICY" : "CONTRACT",
    sourceReference:
      status === "MISSING" || status === "NOT_APPLICABLE" ? null : `ref:${id}`,
    effectiveFrom:
      status === "MISSING" || status === "NOT_APPLICABLE"
        ? null
        : "2026-07-27",
    vatTreatment: options.vat ?? "VAT_EXCLUSIVE",
    includedIn: options.includedIn ?? [],
    confirmationStatus: status,
  };
}

function rate(
  value: number | null,
  status: RateFact["confirmationStatus"] = "CONFIRMED",
): RateFact {
  return {
    rate: value,
    sourceType: status === "ESTIMATED" ? "APPROVED_POLICY" : "WING",
    sourceReference: status === "MISSING" ? null : "rate:evidence",
    effectiveFrom: status === "MISSING" ? null : "2026-07-27",
    includedIn: [],
    confirmationStatus: status,
  };
}

function notApplicableVariableCosts(): MoneyFact[] {
  return [
    money("inboundInspectionStorage", null, { status: "NOT_APPLICABLE" }),
    money("pickPackPackagingLabelSet", null, { status: "NOT_APPLICABLE" }),
    money("supplierToFulfillmentInbound", null, { status: "NOT_APPLICABLE" }),
    money("otherOrderVariableCost", null, { status: "NOT_APPLICABLE" }),
  ];
}

function input(
  overrides: Partial<ItemSelectionProfitabilityInput> = {},
): ItemSelectionProfitabilityInput {
  return {
    finalSellingPrice: money("finalSellingPrice", 20_000),
    supplierUnitCost: money("supplierUnitCost", 8_000),
    minimumOrderQuantity: 1,
    marketplaceFeeRate: rate(0.1),
    fulfillment: {
      normalized: money("fulfillment.normalized", 1_000),
      currentEffective: money("fulfillment.current", 500),
    },
    variableCosts: notApplicableVariableCosts(),
    advertisingActual: {
      rate: rate(0.125),
      observedDays: 28,
      validOrders: 0,
    },
    returnLoss: {
      category: "SIMPLE_DURABLE",
      actualRate: rate(0.04),
      observedDays: 90,
      observedCases: 0,
    },
    ...overrides,
  };
}

function scores(value: number): ItemSelectionScoreInputs {
  return {
    competitiveness: { status: "AVAILABLE", normalizedScore: value, evidence: [] },
    profitability: { status: "AVAILABLE", normalizedScore: value, evidence: [] },
    demand: { status: "AVAILABLE", normalizedScore: value, evidence: [] },
    conversionPotential: { status: "AVAILABLE", normalizedScore: value, evidence: [] },
    logisticsFit: { status: "AVAILABLE", normalizedScore: value, evidence: [] },
    supplyStability: { status: "AVAILABLE", normalizedScore: value, evidence: [] },
  };
}

function gates(
  overrides: Partial<Record<ItemSelectionHardGate, HardGateCheck["status"]>> = {},
): HardGateCheck[] {
  return ITEM_SELECTION_HARD_GATES.map((gate) => ({
    gate,
    status: overrides[gate] ?? "PASS",
    reasonCode: "TEST",
    policyReasonCode: null,
    evidence: [],
    missingFacts: overrides[gate] === "UNKNOWN" ? [`${gate}.evidence`] : [],
  }));
}

test("exposes the immutable approved policy values", () => {
  assert.equal(
    ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
    "gonggamline-profitability-2026-07-27-v1",
  );
  assert.equal(ITEM_SELECTION_PROFITABILITY_POLICY.fallbackMarketplaceFeeRate, 0.109);
  assert.equal(ITEM_SELECTION_PROFITABILITY_POLICY.monthlyCoupangServiceFeeKrw, 55_000);
  assert.equal(ITEM_SELECTION_PROFITABILITY_POLICY.threePlBaseKrw, 3_000);
  assert.equal(ITEM_SELECTION_PROFITABILITY_POLICY.threePlStressKrw, 3_500);
  assert.equal(ITEM_SELECTION_PROFITABILITY_POLICY.advertisingBaseRate, 0.125);
  assert.equal(ITEM_SELECTION_PROFITABILITY_POLICY.advertisingStressRate, 0.18);
  assert.equal(ITEM_SELECTION_PROFITABILITY_POLICY.advertisingLaunchCapRate, 0.2);
});

test("uses a confirmed Wing fee without a manual-review cap", () => {
  const result = calculateItemSelectionProfitability(input());
  assert.equal(result.status, "CONFIRMED");
  assert.equal(
    result.scenarios.normalizedScenario?.costs.find(({ id }) => id === "marketplaceFee")
      ?.rawAmountKrw,
    2_000,
  );
});

test("uses the conservative 10.9% fallback and caps the result as estimated", () => {
  const result = calculateItemSelectionProfitability(
    input({ marketplaceFeeRate: null }),
  );
  assert.equal(result.status, "ESTIMATED");
  assert(result.estimatedFacts.includes("COUPANG_PUBLIC_RANGE_UPPER_BOUND"));
  assert.equal(
    result.scenarios.normalizedScenario?.costs.find(({ id }) => id === "marketplaceFee")
      ?.rawAmountKrw,
    2_180,
  );
});

test("keeps current-effective Rocket Growth separate from normalized economics", () => {
  const result = calculateItemSelectionProfitability(input());
  assert.equal(
    result.scenarios.currentEffectiveScenario?.contributionProfitRawKrw,
    (result.scenarios.normalizedScenario?.contributionProfitRawKrw ?? 0) + 500,
  );
});

test("a promotion cannot rescue a normalized scenario that misses profitability", () => {
  const result = calculateItemSelectionProfitability(
    input({
      supplierUnitCost: money("supplierUnitCost", 13_000),
      fulfillment: {
        normalized: money("fulfillment.normalized", 2_000),
        currentEffective: money("fulfillment.current", 0),
      },
    }),
  );
  assert(
    (result.scenarios.currentEffectiveScenario?.contributionProfitRawKrw ?? 0) >
      (result.scenarios.normalizedScenario?.contributionProfitRawKrw ?? 0),
  );
  assert.equal(result.meetsRecommendMinimums, false);
});

test("uses approved 3PL 3000/3500 estimates only when verified costs are absent", () => {
  const result = calculateItemSelectionProfitability(
    input({ fulfillment: { normalized: null, currentEffective: null } }),
  );
  assert.equal(result.status, "ESTIMATED");
  assert.equal(
    result.scenarios.baseScenario?.costs.find(({ id }) =>
      id.startsWith("fulfillment"),
    )?.rawAmountKrw,
    3_000,
  );
  assert.equal(
    result.scenarios.stressScenario?.costs.find(({ id }) =>
      id.startsWith("fulfillment"),
    )?.rawAmountKrw,
    3_500,
  );
});

test("uses 12.5% base, 18% stress and keeps 20% as a launch cap only", () => {
  const result = calculateItemSelectionProfitability(
    input({
      advertisingActual: { rate: null, observedDays: 0, validOrders: 0 },
    }),
  );
  assert.equal(
    result.scenarios.baseScenario?.costs.find(({ id }) => id === "advertising")
      ?.rawAmountKrw,
    2_500,
  );
  assert.equal(
    result.scenarios.stressScenario?.costs.find(({ id }) => id === "advertising")
      ?.rawAmountKrw,
    3_600,
  );
  assert.equal(
    result.scenarios.normalizedScenario?.costs.some(
      ({ rawAmountKrw }) => rawAmountKrw === 4_000,
    ),
    false,
  );
});

test("requires 28 days or 200 valid orders before using actual advertising", () => {
  const immature = calculateItemSelectionProfitability(
    input({
      advertisingActual: { rate: rate(0.05), observedDays: 27, validOrders: 199 },
    }),
  );
  const mature = calculateItemSelectionProfitability(
    input({
      advertisingActual: { rate: rate(0.05), observedDays: 28, validOrders: 0 },
    }),
  );
  assert.equal(immature.status, "ESTIMATED");
  assert.equal(
    immature.scenarios.baseScenario?.costs.find(({ id }) => id === "advertising")
      ?.rawAmountKrw,
    2_500,
  );
  assert.equal(
    mature.scenarios.baseScenario?.costs.find(({ id }) => id === "advertising")
      ?.rawAmountKrw,
    1_000,
  );
});

test("uses approved return-loss category base and stress rates", () => {
  for (const [category, expected] of [
    ["SIMPLE_DURABLE", [800, 1_200]],
    ["COMPATIBILITY_OR_ASSEMBLY", [1_200, 2_000]],
    ["FRAGILE_OR_ELECTRONICS", [1_200, 2_000]],
  ] as const) {
    const result = calculateItemSelectionProfitability(
      input({
        returnLoss: {
          category,
          actualRate: null,
          observedDays: 0,
          observedCases: 0,
        },
      }),
    );
    assert.equal(
      result.scenarios.baseScenario?.costs.find(({ id }) => id === "returnLoss")
        ?.rawAmountKrw,
      expected[0],
    );
    assert.equal(
      result.scenarios.stressScenario?.costs.find(({ id }) => id === "returnLoss")
        ?.rawAmountKrw,
      expected[1],
    );
  }
});

test("requires actual category evidence for apparel and footwear", () => {
  const result = calculateItemSelectionProfitability(
    input({
      returnLoss: {
        category: "APPAREL_OR_FOOTWEAR",
        actualRate: null,
        observedDays: 0,
        observedCases: 0,
      },
    }),
  );
  assert.equal(result.status, "INCOMPLETE");
  assert(result.missingFacts.includes("returnLoss.actualCategoryEvidence"));
});

test("handles deductible VAT, non-deductible VAT, exempt and exclusive amounts", () => {
  const deductible = calculateItemSelectionProfitability(
    input({
      finalSellingPrice: money("finalSellingPrice", 22_000, {
        vat: "VAT_INCLUSIVE_DEDUCTIBLE",
      }),
      supplierUnitCost: money("supplierUnitCost", 11_000, {
        vat: "VAT_INCLUSIVE_DEDUCTIBLE",
      }),
    }),
  );
  assert.equal(deductible.scenarios.baseScenario?.netRevenueRawKrw, 20_000);
  assert.equal(
    deductible.scenarios.baseScenario?.costs.find(({ id }) => id === "supplierUnitCost")
      ?.rawAmountKrw,
    10_000,
  );

  for (const vat of [
    "VAT_INCLUSIVE_NON_DEDUCTIBLE",
    "TAX_EXEMPT",
    "VAT_EXCLUSIVE",
  ] as const) {
    const result = calculateItemSelectionProfitability(
      input({ supplierUnitCost: money("supplierUnitCost", 11_000, { vat }) }),
    );
    assert.equal(
      result.scenarios.baseScenario?.costs.find(({ id }) => id === "supplierUnitCost")
        ?.rawAmountKrw,
      11_000,
    );
  }
});

test("does not round intermediate won values and rounds display only", () => {
  const result = calculateItemSelectionProfitability(
    input({
      finalSellingPrice: money("finalSellingPrice", 10_001, {
        vat: "VAT_INCLUSIVE_DEDUCTIBLE",
      }),
    }),
  );
  const scenario = result.scenarios.normalizedScenario;
  assert.notEqual(scenario?.netRevenueRawKrw, scenario?.netRevenueDisplayKrw);
  assert.equal(scenario?.netRevenueDisplayKrw, Math.round(10_001 / 1.1));
  assert.equal(
    scenario?.contributionProfitDisplayKrw,
    Math.round(scenario?.contributionProfitRawKrw ?? 0),
  );
});

test("prevents a cost from being counted separately when included elsewhere", () => {
  assert.throws(
    () =>
      calculateItemSelectionProfitability(
        input({
          fulfillment: {
            normalized: money("fulfillment.normalized", 3_000, {
              includedIn: ["packaging"],
            }),
            currentEffective: null,
          },
          variableCosts: [
            ...notApplicableVariableCosts(),
            money("packaging", 500),
          ],
        }),
      ),
    /already included/,
  );
});

test("maps only sanitized provider facts and exposes missing values", () => {
  const mapped = mapSupplierProfitabilityFacts(
    {
      provider: "domeggook",
      providerItemId: "123",
      supplierPriceKrw: 5_000,
      shippingFeeKrw: null,
      minimumOrderQuantity: null,
    },
    {
      observedAt: "2026-07-27",
      supplierVatTreatment: "VAT_INCLUSIVE_DEDUCTIBLE",
      shippingVatTreatment: "VAT_INCLUSIVE_DEDUCTIBLE",
    },
  );
  assert.equal(mapped.supplierUnitCost.confirmationStatus, "CONFIRMED");
  assert.equal(mapped.supplierUnitCost.sourceReference, "domeggook:item:123");
  assert.deepEqual(mapped.missingFacts, [
    "minimumOrderQuantity",
    "supplierShippingCost",
  ]);
  assert.equal(JSON.stringify(mapped).includes("raw"), false);
});

test("rejects a non-Domeggook provider before any fact can be CONFIRMED", () => {
  assert.throws(
    () =>
      mapSupplierProfitabilityFacts(
        {
          provider: "untrusted-provider",
          providerItemId: "123",
          supplierPriceKrw: 5_000,
          shippingFeeKrw: 500,
          minimumOrderQuantity: 1,
        },
        {
          observedAt: "2026-07-27",
          supplierVatTreatment: "VAT_INCLUSIVE_DEDUCTIBLE",
          shippingVatTreatment: "VAT_INCLUSIVE_DEDUCTIBLE",
        },
      ),
    /provider must be domeggook/,
  );
});

test("rejects invalid provider numeric facts instead of confirming them", () => {
  for (const item of [
    { supplierPriceKrw: -1, shippingFeeKrw: 0, minimumOrderQuantity: 1 },
    { supplierPriceKrw: Number.NaN, shippingFeeKrw: 0, minimumOrderQuantity: 1 },
    { supplierPriceKrw: 0, shippingFeeKrw: Number.POSITIVE_INFINITY, minimumOrderQuantity: 1 },
    { supplierPriceKrw: 0, shippingFeeKrw: 0, minimumOrderQuantity: 0 },
    { supplierPriceKrw: 0, shippingFeeKrw: 0, minimumOrderQuantity: 1.5 },
  ]) {
    assert.throws(() =>
      mapSupplierProfitabilityFacts(
        {
          provider: "domeggook",
          providerItemId: "123",
          ...item,
        },
        {
          observedAt: "2026-07-27",
          supplierVatTreatment: "VAT_INCLUSIVE_DEDUCTIBLE",
          shippingVatTreatment: "VAT_INCLUSIVE_DEDUCTIBLE",
        },
      ),
    );
  }
});

test("preserves effective dates and inclusion relationships on cost lines", () => {
  const result = calculateItemSelectionProfitability(
    input({
      fulfillment: {
        normalized: money("fulfillment.normalized", 3_000, {
          includedIn: ["pickPackPackagingLabelSet"],
        }),
        currentEffective: null,
      },
    }),
  );
  const fulfillment = result.scenarios.normalizedScenario?.costs.find(
    ({ id }) => id === "fulfillment.normalized",
  );
  const advertising = result.scenarios.normalizedScenario?.costs.find(
    ({ id }) => id === "advertising",
  );
  assert.equal(fulfillment?.effectiveFrom, "2026-07-27");
  assert.deepEqual(fulfillment?.includedIn, ["pickPackPackagingLabelSet"]);
  assert.equal(advertising?.effectiveFrom, "2026-07-27");
  assert.deepEqual(advertising?.includedIn, []);
});

test("confirmed threshold results integrate with Item Selection verdicts", () => {
  const recommendResult = calculateItemSelectionProfitability(input());
  const profitability = toItemSelectionProfitabilityPolicyInput(recommendResult);
  const recommend = evaluateItemSelection({
    providerItemNumber: "123",
    originalPosition: 0,
    hardGates: gates(),
    scores: scores(75),
    profitability,
  });
  assert.equal(recommend.verdict, "RECOMMEND");

  const conditional = evaluateItemSelection({
    providerItemNumber: "123",
    originalPosition: 0,
    hardGates: gates(),
    scores: scores(60),
    profitability: { ...profitability, meetsRecommendMinimums: false },
  });
  assert.equal(conditional.verdict, "CONDITIONAL");
});

test("uses unrounded values at the exact recommend profit and margin boundaries", () => {
  const exact = calculateItemSelectionProfitability(
    input({
      finalSellingPrice: money("finalSellingPrice", 15_000),
      supplierUnitCost: money("supplierUnitCost", 10_125),
      marketplaceFeeRate: rate(0),
      fulfillment: {
        normalized: money("fulfillment.normalized", 0),
        currentEffective: money("fulfillment.current", 0),
      },
      advertisingActual: { rate: rate(0.125), observedDays: 28, validOrders: 0 },
      returnLoss: {
        category: "SIMPLE_DURABLE",
        actualRate: rate(0),
        observedDays: 90,
        observedCases: 0,
      },
    }),
  );
  assert.equal(exact.scenarios.normalizedScenario?.contributionProfitRawKrw, 3_000);
  assert.equal(exact.scenarios.normalizedScenario?.contributionMarginRateRaw, 0.2);
  assert.equal(exact.meetsRecommendMinimums, true);

  const below = calculateItemSelectionProfitability(
    input({
      finalSellingPrice: money("finalSellingPrice", 15_000),
      supplierUnitCost: money("supplierUnitCost", 10_126),
      marketplaceFeeRate: rate(0),
      fulfillment: {
        normalized: money("fulfillment.normalized", 0),
        currentEffective: money("fulfillment.current", 0),
      },
      advertisingActual: { rate: rate(0.125), observedDays: 28, validOrders: 0 },
      returnLoss: {
        category: "SIMPLE_DURABLE",
        actualRate: rate(0),
        observedDays: 90,
        observedCases: 0,
      },
    }),
  );
  assert.equal(below.meetsRecommendMinimums, false);
});

test("accepts the exact conditional 2000 won and 15 percent boundaries", () => {
  const exactProfit = calculateItemSelectionProfitability(
    input({
      finalSellingPrice: money("finalSellingPrice", 10_000),
      supplierUnitCost: money("supplierUnitCost", 6_750),
      marketplaceFeeRate: rate(0),
      fulfillment: {
        normalized: money("fulfillment.normalized", 0),
        currentEffective: money("fulfillment.current", 0),
      },
      advertisingActual: { rate: rate(0.125), observedDays: 28, validOrders: 0 },
      returnLoss: {
        category: "SIMPLE_DURABLE",
        actualRate: rate(0),
        observedDays: 90,
        observedCases: 0,
      },
    }),
  );
  assert.equal(
    exactProfit.scenarios.normalizedScenario?.contributionProfitRawKrw,
    2_000,
  );
  assert.equal(exactProfit.meetsRecommendMinimums, false);
  assert.equal(exactProfit.meetsConditionalMinimums, true);

  const exactMargin = calculateItemSelectionProfitability(
    input({
      finalSellingPrice: money("finalSellingPrice", 20_000),
      supplierUnitCost: money("supplierUnitCost", 14_500),
      marketplaceFeeRate: rate(0),
      fulfillment: {
        normalized: money("fulfillment.normalized", 0),
        currentEffective: money("fulfillment.current", 0),
      },
      advertisingActual: { rate: rate(0.125), observedDays: 28, validOrders: 0 },
      returnLoss: {
        category: "SIMPLE_DURABLE",
        actualRate: rate(0),
        observedDays: 90,
        observedCases: 0,
      },
    }),
  );
  assert.equal(exactMargin.scenarios.normalizedScenario?.contributionMarginRateRaw, 0.15);
  assert.equal(exactMargin.meetsConditionalMinimums, true);
});

test("accepts stress margin exactly 10 percent and rejects stress profit zero", () => {
  const exact = calculateItemSelectionProfitability(
    input({
      finalSellingPrice: money("finalSellingPrice", 20_000),
      supplierUnitCost: money("supplierUnitCost", 14_400),
      marketplaceFeeRate: rate(0),
      fulfillment: {
        normalized: money("fulfillment.normalized", 0),
        currentEffective: money("fulfillment.current", 0),
      },
      advertisingActual: { rate: rate(0.08), observedDays: 28, validOrders: 0 },
      returnLoss: {
        category: "SIMPLE_DURABLE",
        actualRate: rate(0),
        observedDays: 90,
        observedCases: 0,
      },
    }),
  );
  assert.equal(exact.scenarios.normalizedScenario?.contributionMarginRateRaw, 0.2);
  assert.equal(exact.scenarios.stressScenario?.contributionMarginRateRaw, 0.1);
  assert.equal(exact.meetsRecommendMinimums, true);

  const zero = calculateItemSelectionProfitability(
    input({
      finalSellingPrice: money("finalSellingPrice", 20_000),
      supplierUnitCost: money("supplierUnitCost", 16_400),
      marketplaceFeeRate: rate(0),
      fulfillment: {
        normalized: money("fulfillment.normalized", 0),
        currentEffective: money("fulfillment.current", 0),
      },
      advertisingActual: { rate: rate(0.08), observedDays: 28, validOrders: 0 },
      returnLoss: {
        category: "SIMPLE_DURABLE",
        actualRate: rate(0),
        observedDays: 90,
        observedCases: 0,
      },
    }),
  );
  assert.equal(zero.scenarios.stressScenario?.contributionProfitRawKrw, 0);
  assert.equal(zero.meetsRecommendMinimums, false);
  assert.equal(zero.meetsConditionalMinimums, false);
});

test("estimated or missing profitability caps a numeric pass at MANUAL_REVIEW", () => {
  const estimated = toItemSelectionProfitabilityPolicyInput(
    calculateItemSelectionProfitability(
      input({ marketplaceFeeRate: null }),
    ),
  );
  const result = evaluateItemSelection({
    providerItemNumber: "123",
    originalPosition: 0,
    hardGates: gates(),
    scores: scores(100),
    profitability: estimated,
  });
  assert.equal(result.verdict, "MANUAL_REVIEW");
  assert(result.risks.some((risk) => risk.includes("추정값")));
});

test("hard-gate FAIL and UNKNOWN keep precedence over profitability", () => {
  const profitability = toItemSelectionProfitabilityPolicyInput(
    calculateItemSelectionProfitability(input()),
  );
  const fail = evaluateItemSelection({
    providerItemNumber: "123",
    originalPosition: 0,
    hardGates: gates({ imageUsePermission: "FAIL" }),
    scores: scores(100),
    profitability,
  });
  const unknown = evaluateItemSelection({
    providerItemNumber: "123",
    originalPosition: 0,
    hardGates: gates({ resalePermission: "UNKNOWN" }),
    scores: scores(100),
    profitability,
  });
  assert.equal(fail.verdict, "REJECT");
  assert.equal(unknown.verdict, "MANUAL_REVIEW");
});

test("requires positive stress profit for both recommendation levels", () => {
  const result = calculateItemSelectionProfitability(
    input({ supplierUnitCost: money("supplierUnitCost", 14_000) }),
  );
  assert((result.scenarios.stressScenario?.contributionProfitRawKrw ?? 1) <= 0);
  assert.equal(result.meetsRecommendMinimums, false);
  assert.equal(result.meetsConditionalMinimums, false);
});
