export const ITEM_SELECTION_PROFITABILITY_POLICY_VERSION =
  "gonggamline-profitability-2026-08-19-v4" as const;

export const ITEM_SELECTION_PROFITABILITY_POLICY_EFFECTIVE_DATE =
  "2026-08-19" as const;

export const ITEM_SELECTION_PROFITABILITY_POLICY = Object.freeze({
  fallbackMarketplaceFeeRate: 0.109,
  monthlyCoupangServiceFeeKrw: 55_000,
  threePlBaseKrw: 3_000,
  threePlStressKrw: 3_500,
  advertisingBaseRate: 0.125,
  advertisingStressRate: 0.18,
  advertisingLaunchCapRate: 0.2,
  advertisingActualMinimumDays: 28,
  advertisingActualMinimumOrders: 200,
  returnActualMinimumCases: 100,
  returnActualMinimumDays: 90,
  recommendMinimumContributionKrw: 3_000,
  recommendMinimumMarginRate: 0.2,
  recommendMinimumStressMarginRate: 0.1,
  conditionalMinimumContributionKrw: 2_000,
  conditionalMinimumMarginRate: 0.15,
  identicalMarketOfferMaximumAgeDays: 7,
} as const);

export const ITEM_SELECTION_REQUIRED_VARIABLE_COST_IDS = [
  "inboundInspectionStorage",
  "pickPackPackagingLabelSet",
  "supplierToFulfillmentInbound",
  "otherOrderVariableCost",
] as const;

export type CostConfirmationStatus =
  | "CONFIRMED"
  | "ESTIMATED"
  | "MISSING"
  | "NOT_APPLICABLE";

export type VatTreatment =
  | "VAT_EXCLUSIVE"
  | "VAT_INCLUSIVE_DEDUCTIBLE"
  | "VAT_INCLUSIVE_NON_DEDUCTIBLE"
  | "TAX_EXEMPT";

export type CostSourceType =
  | "WING"
  | "MARKETPLACE_PUBLIC"
  | "CONTRACT"
  | "QUOTE"
  | "SETTLEMENT"
  | "SUPPLIER_EVIDENCE"
  | "APPROVED_POLICY"
  | "OPERATOR_INPUT";

export type MoneyFact = {
  id: string;
  amountKrw: number | null;
  sourceType: CostSourceType;
  sourceReference: string | null;
  effectiveFrom: string | null;
  vatTreatment: VatTreatment;
  includedIn: readonly string[];
  confirmationStatus: CostConfirmationStatus;
};

export type RateFact = {
  rate: number | null;
  sourceType: CostSourceType;
  sourceReference: string | null;
  effectiveFrom: string | null;
  includedIn: readonly string[];
  confirmationStatus: CostConfirmationStatus;
};

export type ReturnLossCategory =
  | "SIMPLE_DURABLE"
  | "COMPATIBILITY_OR_ASSEMBLY"
  | "FRAGILE_OR_ELECTRONICS"
  | "APPAREL_OR_FOOTWEAR";

export type ItemSelectionProfitabilityInput = {
  finalSellingPrice: MoneyFact;
  supplierUnitCost: MoneyFact;
  minimumOrderQuantity: number | null;
  marketplaceFeeRate: RateFact | null;
  fulfillment: {
    normalized: MoneyFact | null;
    currentEffective: MoneyFact | null;
  };
  variableCosts: readonly MoneyFact[];
  advertisingActual: {
    rate: RateFact | null;
    observedDays: number;
    validOrders: number;
  };
  returnLoss: {
    category: ReturnLossCategory;
    actualRate: RateFact | null;
    observedDays: number;
    observedCases: number;
  };
};

export type SanitizedProviderProfitabilityFacts = {
  provider: "domeggook";
  providerItemNumber: string;
  supplierUnitCost: MoneyFact;
  supplierShippingCost: MoneyFact;
  minimumOrderQuantity: number | null;
  missingFacts: readonly string[];
};

export type SupplierProfitabilityFactSource = {
  provider: string;
  providerItemId: string;
  supplierPriceKrw: number | null;
  shippingFeeKrw: number | null;
  minimumOrderQuantity: number | null;
};

export type ProfitabilityScenarioName =
  | "baseScenario"
  | "stressScenario"
  | "currentEffectiveScenario"
  | "normalizedScenario";

export type ProfitabilityCostLine = {
  id: string;
  rawAmountKrw: number;
  displayAmountKrw: number;
  sourceType: CostSourceType;
  sourceReference: string | null;
  effectiveFrom: string | null;
  includedIn: readonly string[];
  confirmationStatus: CostConfirmationStatus;
  vatTreatment: VatTreatment | "RATE";
};

export type ProfitabilityScenario = {
  name: ProfitabilityScenarioName;
  netRevenueRawKrw: number;
  netRevenueDisplayKrw: number;
  costs: readonly ProfitabilityCostLine[];
  contributionProfitRawKrw: number;
  contributionProfitDisplayKrw: number;
  contributionMarginRateRaw: number;
  contributionMarginPercentDisplay: number;
};

export type ItemSelectionProfitabilityResult = {
  policyVersion: typeof ITEM_SELECTION_PROFITABILITY_POLICY_VERSION;
  policyEffectiveDate: typeof ITEM_SELECTION_PROFITABILITY_POLICY_EFFECTIVE_DATE;
  status: "CONFIRMED" | "ESTIMATED" | "INCOMPLETE";
  scenarios: {
    baseScenario: ProfitabilityScenario | null;
    stressScenario: ProfitabilityScenario | null;
    currentEffectiveScenario: ProfitabilityScenario | null;
    normalizedScenario: ProfitabilityScenario | null;
  };
  estimatedContribution: ProfitabilityScenario | null;
  estimatedFacts: readonly string[];
  missingFacts: readonly string[];
  nextActions: readonly string[];
  meetsRecommendMinimums: boolean | null;
  meetsConditionalMinimums: boolean | null;
};

export type PrePurchaseMarketOffer = {
  matchType: "IDENTICAL" | "COMPARABLE";
  candidateUnitsPerOffer: number;
  observedUnitsPerOffer: number;
  deliveredPrice: MoneyFact;
};

export type PrePurchaseProfitabilityGateResult = {
  status: "PASS" | "FAIL" | "INCOMPLETE";
  samplePurchaseEligible: boolean;
  commerceWriteAuthorized: false;
  reasonCodes: readonly string[];
  missingFacts: readonly string[];
  profitabilityAtMarketPrice: ItemSelectionProfitabilityResult | null;
};

const RETURN_LOSS_RATES: Record<
  Exclude<ReturnLossCategory, "APPAREL_OR_FOOTWEAR">,
  { base: number; stress: number }
> = {
  SIMPLE_DURABLE: { base: 0.04, stress: 0.06 },
  COMPATIBILITY_OR_ASSEMBLY: { base: 0.06, stress: 0.1 },
  FRAGILE_OR_ELECTRONICS: { base: 0.06, stress: 0.1 },
};

function assertNonNegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative finite number.`);
  }
}

function assertRate(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be between 0 and 1.`);
  }
}

function assertFact(fact: MoneyFact, field: string): void {
  if (fact.id.trim() === "") throw new RangeError(`${field}.id is required.`);
  if (
    fact.confirmationStatus === "MISSING" ||
    fact.confirmationStatus === "NOT_APPLICABLE"
  ) {
    if (fact.amountKrw !== null) {
      throw new RangeError(`${field}.amountKrw must be null for ${fact.confirmationStatus}.`);
    }
  } else {
    if (fact.amountKrw === null) {
      throw new RangeError(`${field}.amountKrw is required.`);
    }
    assertNonNegativeFinite(fact.amountKrw, `${field}.amountKrw`);
  }
  if (
    fact.confirmationStatus === "CONFIRMED" &&
    (!fact.sourceReference?.trim() || !fact.effectiveFrom?.trim())
  ) {
    throw new RangeError(
      `${field} requires sourceReference and effectiveFrom when CONFIRMED.`,
    );
  }
}

function assertRateFact(fact: RateFact, field: string): void {
  if (
    fact.confirmationStatus === "MISSING" ||
    fact.confirmationStatus === "NOT_APPLICABLE"
  ) {
    if (fact.rate !== null) {
      throw new RangeError(`${field}.rate must be null for ${fact.confirmationStatus}.`);
    }
  } else {
    if (fact.rate === null) throw new RangeError(`${field}.rate is required.`);
    assertRate(fact.rate, `${field}.rate`);
  }
  if (
    fact.confirmationStatus === "CONFIRMED" &&
    (!fact.sourceReference?.trim() || !fact.effectiveFrom?.trim())
  ) {
    throw new RangeError(
      `${field} requires sourceReference and effectiveFrom when CONFIRMED.`,
    );
  }
}

function netAmount(fact: MoneyFact): number {
  if (fact.amountKrw === null) return 0;
  return fact.vatTreatment === "VAT_INCLUSIVE_DEDUCTIBLE"
    ? fact.amountKrw / 1.1
    : fact.amountKrw;
}

function displayWon(value: number): number {
  return Math.round(value);
}

function displayPercent(rate: number): number {
  return Math.round(rate * 10_000) / 100;
}

function lineFromMoney(fact: MoneyFact): ProfitabilityCostLine {
  const rawAmountKrw = netAmount(fact);
  return {
    id: fact.id,
    rawAmountKrw,
    displayAmountKrw: displayWon(rawAmountKrw),
    sourceType: fact.sourceType,
    sourceReference: fact.sourceReference,
    effectiveFrom: fact.effectiveFrom,
    includedIn: fact.includedIn,
    confirmationStatus: fact.confirmationStatus,
    vatTreatment: fact.vatTreatment,
  };
}

function rateLine(
  id: string,
  netRevenue: number,
  rate: number,
  fact: RateFact,
): ProfitabilityCostLine {
  const rawAmountKrw = netRevenue * rate;
  return {
    id,
    rawAmountKrw,
    displayAmountKrw: displayWon(rawAmountKrw),
    sourceType: fact.sourceType,
    sourceReference: fact.sourceReference,
    effectiveFrom: fact.effectiveFrom,
    includedIn: fact.includedIn,
    confirmationStatus: fact.confirmationStatus,
    vatTreatment: "RATE",
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function assertNoDoubleCounting(facts: readonly MoneyFact[]): void {
  const ids = new Set<string>();
  for (const fact of facts) {
    if (ids.has(fact.id)) throw new RangeError(`Duplicate cost id: ${fact.id}.`);
    ids.add(fact.id);
  }
  for (const parent of facts) {
    for (const includedId of parent.includedIn) {
      if (includedId === parent.id) {
        throw new RangeError(`Cost ${parent.id} cannot include itself.`);
      }
      const included = facts.find((fact) => fact.id === includedId);
      if (
        included &&
        included.confirmationStatus !== "NOT_APPLICABLE" &&
        (included.amountKrw ?? 0) > 0
      ) {
        throw new RangeError(
          `Cost ${includedId} is already included in ${parent.id} and cannot be counted separately.`,
        );
      }
    }
  }
}

function scenario(
  name: ProfitabilityScenarioName,
  grossSellingPrice: number,
  netRevenue: number,
  fixedCosts: readonly MoneyFact[],
  marketplaceFee: { rate: number; fact: RateFact },
  advertising: { rate: number; fact: RateFact },
  returnLoss: { rate: number; fact: RateFact },
): ProfitabilityScenario {
  const costs = [
    ...fixedCosts
      .filter(({ confirmationStatus }) => confirmationStatus !== "NOT_APPLICABLE")
      .map(lineFromMoney),
    rateLine(
      "marketplaceFee",
      grossSellingPrice,
      marketplaceFee.rate,
      marketplaceFee.fact,
    ),
    rateLine("advertising", netRevenue, advertising.rate, advertising.fact),
    rateLine("returnLoss", netRevenue, returnLoss.rate, returnLoss.fact),
  ];
  const totalCost = costs.reduce((sum, cost) => sum + cost.rawAmountKrw, 0);
  const contributionProfitRawKrw = netRevenue - totalCost;
  const contributionMarginRateRaw = contributionProfitRawKrw / netRevenue;
  return {
    name,
    netRevenueRawKrw: netRevenue,
    netRevenueDisplayKrw: displayWon(netRevenue),
    costs,
    contributionProfitRawKrw,
    contributionProfitDisplayKrw: displayWon(contributionProfitRawKrw),
    contributionMarginRateRaw,
    contributionMarginPercentDisplay: displayPercent(contributionMarginRateRaw),
  };
}

function estimatedRateFact(rate: number, reference: string): RateFact {
  return {
    rate,
    sourceType: "APPROVED_POLICY",
    sourceReference: reference,
    effectiveFrom: ITEM_SELECTION_PROFITABILITY_POLICY_EFFECTIVE_DATE,
    includedIn: [],
    confirmationStatus: "ESTIMATED",
  };
}

function estimatedFulfillment(amountKrw: number, id: string): MoneyFact {
  return {
    id,
    amountKrw,
    sourceType: "APPROVED_POLICY",
    sourceReference: ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
    effectiveFrom: ITEM_SELECTION_PROFITABILITY_POLICY_EFFECTIVE_DATE,
    vatTreatment: "VAT_EXCLUSIVE",
    includedIn: [],
    confirmationStatus: "ESTIMATED",
  };
}

function returnLossRates(input: ItemSelectionProfitabilityInput["returnLoss"]): {
  base: { rate: number; fact: RateFact } | null;
  stress: { rate: number; fact: RateFact } | null;
} {
  const actualRate = input.actualRate;
  const actualIsMature =
    actualRate?.confirmationStatus === "CONFIRMED" &&
    (input.observedCases >= ITEM_SELECTION_PROFITABILITY_POLICY.returnActualMinimumCases ||
      input.observedDays >= ITEM_SELECTION_PROFITABILITY_POLICY.returnActualMinimumDays);
  if (actualIsMature && actualRate?.rate !== null && actualRate !== null) {
    return {
      base: { rate: actualRate.rate, fact: actualRate },
      stress: { rate: actualRate.rate, fact: actualRate },
    };
  }
  if (input.category === "APPAREL_OR_FOOTWEAR") {
    return { base: null, stress: null };
  }
  const policy = RETURN_LOSS_RATES[input.category];
  return {
    base: {
      rate: policy.base,
      fact: estimatedRateFact(policy.base, `${input.category}:base`),
    },
    stress: {
      rate: policy.stress,
      fact: estimatedRateFact(policy.stress, `${input.category}:stress`),
    },
  };
}

export function calculateItemSelectionProfitability(
  input: ItemSelectionProfitabilityInput,
): ItemSelectionProfitabilityResult {
  assertFact(input.finalSellingPrice, "finalSellingPrice");
  assertFact(input.supplierUnitCost, "supplierUnitCost");
  for (const [index, fact] of input.variableCosts.entries()) {
    assertFact(fact, `variableCosts[${index}]`);
  }
  if (input.fulfillment.normalized) {
    assertFact(input.fulfillment.normalized, "fulfillment.normalized");
  }
  if (input.fulfillment.currentEffective) {
    assertFact(input.fulfillment.currentEffective, "fulfillment.currentEffective");
  }
  if (input.marketplaceFeeRate) {
    assertRateFact(input.marketplaceFeeRate, "marketplaceFeeRate");
  }
  if (input.advertisingActual.rate) {
    assertRateFact(input.advertisingActual.rate, "advertisingActual.rate");
  }
  if (input.returnLoss.actualRate) {
    assertRateFact(input.returnLoss.actualRate, "returnLoss.actualRate");
  }
  if (
    input.minimumOrderQuantity === null ||
    !Number.isInteger(input.minimumOrderQuantity) ||
    input.minimumOrderQuantity < 1
  ) {
    return incomplete(["minimumOrderQuantity"]);
  }

  const variableCostIds = new Set(input.variableCosts.map(({ id }) => id));
  const absentVariableCosts = ITEM_SELECTION_REQUIRED_VARIABLE_COST_IDS.filter(
    (id) => !variableCostIds.has(id),
  );
  if (absentVariableCosts.length > 0) {
    return incomplete(absentVariableCosts);
  }

  const requiredFacts = [
    input.finalSellingPrice,
    input.supplierUnitCost,
    ...input.variableCosts,
  ];
  const missingFacts = requiredFacts
    .filter(({ confirmationStatus }) => confirmationStatus === "MISSING")
    .map(({ id }) => id);
  if (
    input.finalSellingPrice.confirmationStatus === "MISSING" ||
    input.supplierUnitCost.confirmationStatus === "MISSING" ||
    missingFacts.length > 0
  ) {
    return incomplete(missingFacts);
  }

  const grossSellingPrice = input.finalSellingPrice.amountKrw ?? 0;
  const netRevenue = netAmount(input.finalSellingPrice);
  if (grossSellingPrice <= 0) {
    throw new RangeError("finalSellingPrice must be positive.");
  }
  if (netRevenue <= 0) throw new RangeError("finalSellingPrice must be positive.");

  const providedFeeRate = input.marketplaceFeeRate;
  const feeFact: RateFact =
    providedFeeRate?.confirmationStatus === "CONFIRMED" &&
    providedFeeRate.rate !== null
      ? providedFeeRate
      : estimatedRateFact(
          ITEM_SELECTION_PROFITABILITY_POLICY.fallbackMarketplaceFeeRate,
          "COUPANG_PUBLIC_RANGE_UPPER_BOUND",
        );
  const feeRate = feeFact.rate ?? 0;

  const actualAdvertisingRate = input.advertisingActual.rate;
  const actualAdvertisingIsMature =
    actualAdvertisingRate?.confirmationStatus === "CONFIRMED" &&
    (input.advertisingActual.observedDays >=
      ITEM_SELECTION_PROFITABILITY_POLICY.advertisingActualMinimumDays ||
      input.advertisingActual.validOrders >=
        ITEM_SELECTION_PROFITABILITY_POLICY.advertisingActualMinimumOrders);
  const baseAdvertising: { rate: number; fact: RateFact } =
    actualAdvertisingIsMature &&
    actualAdvertisingRate?.rate !== null &&
    actualAdvertisingRate !== null
      ? {
          rate: actualAdvertisingRate.rate,
          fact: actualAdvertisingRate,
        }
      : {
          rate: ITEM_SELECTION_PROFITABILITY_POLICY.advertisingBaseRate,
          fact: estimatedRateFact(
            ITEM_SELECTION_PROFITABILITY_POLICY.advertisingBaseRate,
            "ADVERTISING_BASE",
          ),
        };
  const stressAdvertising = {
    rate: ITEM_SELECTION_PROFITABILITY_POLICY.advertisingStressRate,
    fact: estimatedRateFact(
      ITEM_SELECTION_PROFITABILITY_POLICY.advertisingStressRate,
      "ADVERTISING_STRESS",
    ),
  };
  const returnRates = returnLossRates(input.returnLoss);
  if (!returnRates.base || !returnRates.stress) {
    return incomplete(["returnLoss.actualCategoryEvidence"]);
  }

  const normalizedFulfillment =
    input.fulfillment.normalized?.confirmationStatus === "CONFIRMED"
      ? input.fulfillment.normalized
      : estimatedFulfillment(
          ITEM_SELECTION_PROFITABILITY_POLICY.threePlBaseKrw,
          "fulfillment.normalized.estimate",
        );
  const stressFulfillment =
    input.fulfillment.normalized?.confirmationStatus === "CONFIRMED"
      ? input.fulfillment.normalized
      : estimatedFulfillment(
          ITEM_SELECTION_PROFITABILITY_POLICY.threePlStressKrw,
          "fulfillment.stress.estimate",
        );
  const currentFulfillment =
    input.fulfillment.currentEffective?.confirmationStatus === "CONFIRMED"
      ? input.fulfillment.currentEffective
      : normalizedFulfillment;

  const commonCosts = [input.supplierUnitCost, ...input.variableCosts];
  assertNoDoubleCounting([...commonCosts, normalizedFulfillment]);
  assertNoDoubleCounting([...commonCosts, stressFulfillment]);
  assertNoDoubleCounting([...commonCosts, currentFulfillment]);

  const marketplaceFee = { rate: feeRate, fact: feeFact };
  const baseScenario = scenario(
    "baseScenario",
    grossSellingPrice,
    netRevenue,
    [...commonCosts, normalizedFulfillment],
    marketplaceFee,
    baseAdvertising,
    returnRates.base,
  );
  const normalizedScenario = {
    ...baseScenario,
    name: "normalizedScenario" as const,
  };
  const stressScenario = scenario(
    "stressScenario",
    grossSellingPrice,
    netRevenue,
    [...commonCosts, stressFulfillment],
    marketplaceFee,
    stressAdvertising,
    returnRates.stress,
  );
  const currentEffectiveScenario = scenario(
    "currentEffectiveScenario",
    grossSellingPrice,
    netRevenue,
    [...commonCosts, currentFulfillment],
    marketplaceFee,
    baseAdvertising,
    returnRates.base,
  );

  const requiredRateFacts = [
    feeFact,
    baseAdvertising.fact,
    returnRates.base.fact,
  ];
  const moneyFacts = [
    ...requiredFacts,
    normalizedFulfillment,
    stressFulfillment,
    currentFulfillment,
  ];
  const estimatedFacts = unique([
    ...moneyFacts
      .filter(({ confirmationStatus }) => confirmationStatus === "ESTIMATED")
      .map(({ id }) => id),
    ...requiredRateFacts
      .filter(({ confirmationStatus }) => confirmationStatus === "ESTIMATED")
      .map(({ sourceReference }) => sourceReference ?? "estimatedRate"),
  ]);
  const allConfirmed =
    estimatedFacts.length === 0 &&
    [...moneyFacts, input.finalSellingPrice].every(
      ({ confirmationStatus }) =>
        confirmationStatus === "CONFIRMED" ||
        confirmationStatus === "NOT_APPLICABLE",
    );

  const meetsRecommendMinimums =
    normalizedScenario.contributionProfitRawKrw >=
      ITEM_SELECTION_PROFITABILITY_POLICY.recommendMinimumContributionKrw &&
    normalizedScenario.contributionMarginRateRaw >=
      ITEM_SELECTION_PROFITABILITY_POLICY.recommendMinimumMarginRate &&
    stressScenario.contributionProfitRawKrw > 0 &&
    stressScenario.contributionMarginRateRaw >=
      ITEM_SELECTION_PROFITABILITY_POLICY.recommendMinimumStressMarginRate;
  const meetsConditionalMinimums =
    normalizedScenario.contributionProfitRawKrw >=
      ITEM_SELECTION_PROFITABILITY_POLICY.conditionalMinimumContributionKrw &&
    normalizedScenario.contributionMarginRateRaw >=
      ITEM_SELECTION_PROFITABILITY_POLICY.conditionalMinimumMarginRate &&
    stressScenario.contributionProfitRawKrw > 0;

  return {
    policyVersion: ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
    policyEffectiveDate: ITEM_SELECTION_PROFITABILITY_POLICY_EFFECTIVE_DATE,
    status: allConfirmed ? "CONFIRMED" : "ESTIMATED",
    scenarios: {
      baseScenario,
      stressScenario,
      currentEffectiveScenario,
      normalizedScenario,
    },
    estimatedContribution: allConfirmed ? null : normalizedScenario,
    estimatedFacts,
    missingFacts: [],
    nextActions: estimatedFacts.map((fact) => `${fact}의 실제 적용 근거를 확인하세요.`),
    meetsRecommendMinimums,
    meetsConditionalMinimums,
  };
}

function incomplete(missingFacts: readonly string[]): ItemSelectionProfitabilityResult {
  const facts = unique(missingFacts);
  return {
    policyVersion: ITEM_SELECTION_PROFITABILITY_POLICY_VERSION,
    policyEffectiveDate: ITEM_SELECTION_PROFITABILITY_POLICY_EFFECTIVE_DATE,
    status: "INCOMPLETE",
    scenarios: {
      baseScenario: null,
      stressScenario: null,
      currentEffectiveScenario: null,
      normalizedScenario: null,
    },
    estimatedContribution: null,
    estimatedFacts: [],
    missingFacts: facts,
    nextActions: facts.map((fact) => `${fact}을(를) 확인하세요.`),
    meetsRecommendMinimums: null,
    meetsConditionalMinimums: null,
  };
}

export function evaluatePrePurchaseProfitabilityGate(input: {
  profitabilityInput: ItemSelectionProfitabilityInput;
  marketOffer: PrePurchaseMarketOffer | null;
  requestedSampleQuantity: number | null;
  evaluatedAt: string;
}): PrePurchaseProfitabilityGateResult {
  const missingFacts: string[] = [];
  const minimumOrderQuantity = input.profitabilityInput.minimumOrderQuantity;

  if (minimumOrderQuantity === null) missingFacts.push("minimumOrderQuantity");
  if (input.requestedSampleQuantity === null) {
    missingFacts.push("requestedSampleQuantity");
  }
  if (input.marketOffer === null) {
    missingFacts.push("identicalMarketOffer");
  }
  if (missingFacts.length > 0) {
    return {
      status: "INCOMPLETE",
      samplePurchaseEligible: false,
      commerceWriteAuthorized: false,
      reasonCodes: ["PRE_PURCHASE_EVIDENCE_INCOMPLETE"],
      missingFacts: unique(missingFacts),
      profitabilityAtMarketPrice: null,
    };
  }

  const marketOffer = input.marketOffer;
  const requestedSampleQuantity = input.requestedSampleQuantity;
  if (!marketOffer || requestedSampleQuantity === null || minimumOrderQuantity === null) {
    throw new Error("Pre-purchase gate reached an unreachable incomplete state.");
  }

  assertFact(marketOffer.deliveredPrice, "marketOffer.deliveredPrice");
  const evaluatedAtMs = Date.parse(input.evaluatedAt);
  const marketObservedAtMs = Date.parse(
    marketOffer.deliveredPrice.effectiveFrom ?? "",
  );
  if (!Number.isFinite(evaluatedAtMs)) {
    throw new RangeError("evaluatedAt must be a valid ISO date or timestamp.");
  }
  for (const [value, field] of [
    [marketOffer.candidateUnitsPerOffer, "marketOffer.candidateUnitsPerOffer"],
    [marketOffer.observedUnitsPerOffer, "marketOffer.observedUnitsPerOffer"],
    [requestedSampleQuantity, "requestedSampleQuantity"],
  ] as const) {
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError(`${field} must be a positive integer.`);
    }
  }

  const evidenceMissing = [
    ...(marketOffer.matchType === "IDENTICAL" ? [] : ["identicalMarketOffer"]),
    ...(marketOffer.candidateUnitsPerOffer === marketOffer.observedUnitsPerOffer
      ? []
      : ["marketOffer.unitCountMatch"]),
    ...(marketOffer.deliveredPrice.confirmationStatus === "CONFIRMED"
      ? []
      : ["marketOffer.confirmedDeliveredPrice"]),
    ...(!Number.isFinite(marketObservedAtMs)
      ? ["marketOffer.observedAt"]
      : marketObservedAtMs > evaluatedAtMs ||
          evaluatedAtMs - marketObservedAtMs >
            ITEM_SELECTION_PROFITABILITY_POLICY.identicalMarketOfferMaximumAgeDays *
              24 *
              60 *
              60 *
              1_000
        ? ["marketOffer.freshness"]
        : []),
  ];
  if (evidenceMissing.length > 0) {
    return {
      status: "INCOMPLETE",
      samplePurchaseEligible: false,
      commerceWriteAuthorized: false,
      reasonCodes: ["IDENTICAL_MARKET_OFFER_NOT_CONFIRMED"],
      missingFacts: unique(evidenceMissing),
      profitabilityAtMarketPrice: null,
    };
  }

  const profitabilityAtMarketPrice = calculateItemSelectionProfitability({
    ...input.profitabilityInput,
    finalSellingPrice: marketOffer.deliveredPrice,
  });
  if (profitabilityAtMarketPrice.status === "INCOMPLETE") {
    return {
      status: "INCOMPLETE",
      samplePurchaseEligible: false,
      commerceWriteAuthorized: false,
      reasonCodes: ["PROFITABILITY_AT_MARKET_PRICE_INCOMPLETE"],
      missingFacts: profitabilityAtMarketPrice.missingFacts,
      profitabilityAtMarketPrice,
    };
  }

  if (requestedSampleQuantity !== minimumOrderQuantity) {
    return {
      status: "FAIL",
      samplePurchaseEligible: false,
      commerceWriteAuthorized: false,
      reasonCodes: ["SAMPLE_QUANTITY_MUST_EQUAL_MINIMUM_ORDER_QUANTITY"],
      missingFacts: [],
      profitabilityAtMarketPrice,
    };
  }

  if (profitabilityAtMarketPrice.meetsRecommendMinimums !== true) {
    return {
      status: "FAIL",
      samplePurchaseEligible: false,
      commerceWriteAuthorized: false,
      reasonCodes: ["MARKET_PRICE_FAILS_RECOMMEND_PROFITABILITY"],
      missingFacts: [],
      profitabilityAtMarketPrice,
    };
  }

  return {
    status: "PASS",
    samplePurchaseEligible: true,
    commerceWriteAuthorized: false,
    reasonCodes: ["MARKET_PRICE_PASSES_RECOMMEND_PROFITABILITY_AT_MINIMUM_SAMPLE"],
    missingFacts: [],
    profitabilityAtMarketPrice,
  };
}

export function mapSupplierProfitabilityFacts(
  item: SupplierProfitabilityFactSource,
  input: {
    observedAt: string;
    supplierVatTreatment: VatTreatment;
    shippingVatTreatment: VatTreatment;
  },
): SanitizedProviderProfitabilityFacts {
  if (item.provider !== "domeggook") {
    throw new RangeError("provider must be domeggook.");
  }
  if (!/^\d{1,20}$/.test(item.providerItemId)) {
    throw new RangeError("providerItemId must contain 1 to 20 digits.");
  }
  for (const [field, value] of [
    ["supplierPriceKrw", item.supplierPriceKrw],
    ["shippingFeeKrw", item.shippingFeeKrw],
  ] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new RangeError(`${field} must be null or a non-negative finite number.`);
    }
  }
  if (
    item.minimumOrderQuantity !== null &&
    (!Number.isInteger(item.minimumOrderQuantity) ||
      item.minimumOrderQuantity < 1)
  ) {
    throw new RangeError(
      "minimumOrderQuantity must be null or an integer greater than or equal to 1.",
    );
  }
  if (input.observedAt.trim() === "") {
    throw new RangeError("observedAt is required.");
  }
  const reference = `domeggook:item:${item.providerItemId}`;
  const supplierUnitCost: MoneyFact = {
    id: "supplierUnitCost",
    amountKrw: item.supplierPriceKrw,
    sourceType: "SUPPLIER_EVIDENCE",
    sourceReference: item.supplierPriceKrw === null ? null : reference,
    effectiveFrom: item.supplierPriceKrw === null ? null : input.observedAt,
    vatTreatment: input.supplierVatTreatment,
    includedIn: [],
    confirmationStatus:
      item.supplierPriceKrw === null ? "MISSING" : "CONFIRMED",
  };
  const supplierShippingCost: MoneyFact = {
    id: "supplierShippingCost",
    amountKrw: item.shippingFeeKrw,
    sourceType: "SUPPLIER_EVIDENCE",
    sourceReference: item.shippingFeeKrw === null ? null : reference,
    effectiveFrom: item.shippingFeeKrw === null ? null : input.observedAt,
    vatTreatment: input.shippingVatTreatment,
    includedIn: [],
    confirmationStatus:
      item.shippingFeeKrw === null ? "MISSING" : "CONFIRMED",
  };
  return {
    provider: "domeggook",
    providerItemNumber: item.providerItemId,
    supplierUnitCost,
    supplierShippingCost,
    minimumOrderQuantity: item.minimumOrderQuantity,
    missingFacts: unique([
      ...(item.supplierPriceKrw === null ? ["supplierUnitCost"] : []),
      ...(item.shippingFeeKrw === null ? ["supplierShippingCost"] : []),
      ...(item.minimumOrderQuantity === null ? ["minimumOrderQuantity"] : []),
    ]),
  };
}

export function toItemSelectionProfitabilityPolicyInput(
  result: ItemSelectionProfitabilityResult,
): {
  status: "CONFIRMED" | "ESTIMATED" | "INCOMPLETE";
  policyVersion: typeof ITEM_SELECTION_PROFITABILITY_POLICY_VERSION;
  meetsRecommendMinimums: boolean | null;
  meetsConditionalMinimums: boolean | null;
  contributionMarginRate: number | null;
  estimatedFacts: readonly string[];
  missingFacts: readonly string[];
  nextActions: readonly string[];
} {
  return {
    status: result.status,
    policyVersion: result.policyVersion,
    meetsRecommendMinimums: result.meetsRecommendMinimums,
    meetsConditionalMinimums: result.meetsConditionalMinimums,
    contributionMarginRate:
      result.scenarios.normalizedScenario?.contributionMarginRateRaw ?? null,
    estimatedFacts: result.estimatedFacts,
    missingFacts: result.missingFacts,
    nextActions: result.nextActions,
  };
}
