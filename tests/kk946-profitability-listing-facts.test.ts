import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateItemSelectionProfitability,
  type MoneyFact,
  type ItemSelectionProfitabilityInput,
  type RateFact,
} from "../lib/revenue/item-selection-profitability";

type ScenarioRecord = {
  sellingPriceKrw: number;
  baseContributionKrw: number;
  baseContributionMarginPercent: number;
  stressContributionKrw: number;
  stressContributionMarginPercent: number;
  recommendMinimums: boolean;
  conditionalMinimums: boolean;
};

type DecisionRecord = {
  subjectId: string;
  policyVersion: string;
  decision: {
    targetSellingPriceKrw: number;
    minimumRecommendPriceKrw: number;
    operationalRecommendFloorKrw: number;
    conditionalExperimentFloorKrw: number;
    status: string;
    externalPriceWritePerformed: boolean;
  };
  quantityBasis: number;
  deterministicPerOrderCosts: {
    supplierUnitCostGrossKrw: number;
    supplierShippingAllocationGrossKrw: number;
    warehouseInboundUnloadingAllocationGrossKrw: number;
    warehouseFullInspectionAllocationGrossKrw: number;
    landedCashCostGrossKrw: number;
    fulfillmentCostVatExclusiveKrw: number;
    deterministicVariableCostNetOfDeductibleVatKrw: number;
    deterministicVariableCashOutflowGrossKrw: number;
  };
  rateCosts: {
    marketplaceFeeRate: number;
    marketplaceFeeStatus: string;
    advertisingBaseRate: number;
    advertisingStressRate: number;
    returnLossBaseRate: number;
    returnLossStressRate: number;
  };
  scenarios: ScenarioRecord[];
  unresolvedActuals: string[];
  rawEvidenceMoved: boolean;
  commerceWritePerformed: boolean;
};

const decisionText = readFileSync(
  "docs/evidence/kk946-profitability-decision-v1.json",
  "utf8",
);
const decision = JSON.parse(decisionText) as DecisionRecord;
const packet = readFileSync(
  "docs/evidence/KK946-PROFITABILITY-AND-COUPANG-LISTING-FACTS-V1.md",
  "utf8",
);

function confirmedMoney(
  id: string,
  amountKrw: number,
  vatTreatment: MoneyFact["vatTreatment"] = "VAT_INCLUSIVE_DEDUCTIBLE",
  includedIn: readonly string[] = [],
): MoneyFact {
  return {
    id,
    amountKrw,
    sourceType: "OPERATOR_INPUT",
    sourceReference: "sanitized:kk946:2026-08-12",
    effectiveFrom: "2026-08-12",
    vatTreatment,
    includedIn,
    confirmationStatus: "CONFIRMED",
  };
}

function notApplicable(id: string): MoneyFact {
  return {
    id,
    amountKrw: null,
    sourceType: "OPERATOR_INPUT",
    sourceReference: null,
    effectiveFrom: null,
    vatTreatment: "VAT_EXCLUSIVE",
    includedIn: [],
    confirmationStatus: "NOT_APPLICABLE",
  };
}

function profitabilityInput(sellingPriceKrw: number): ItemSelectionProfitabilityInput {
  const costs = decision.deterministicPerOrderCosts;
  return {
    finalSellingPrice: confirmedMoney("finalSellingPrice", sellingPriceKrw),
    supplierUnitCost: confirmedMoney(
      "supplierUnitCost",
      costs.supplierUnitCostGrossKrw,
    ),
    minimumOrderQuantity: decision.quantityBasis,
    marketplaceFeeRate: {
      rate: decision.rateCosts.marketplaceFeeRate,
      sourceType: "WING",
      sourceReference: "wing:category-path:mens-womens-common-pouch",
      effectiveFrom: "2026-08-12",
      includedIn: [],
      confirmationStatus: "CONFIRMED",
    } satisfies RateFact,
    fulfillment: {
      normalized: confirmedMoney(
        "fulfillment.normalized",
        costs.fulfillmentCostVatExclusiveKrw,
        "VAT_EXCLUSIVE",
        ["pickPackPackagingLabelSet"],
      ),
      currentEffective: confirmedMoney(
        "fulfillment.currentEffective",
        costs.fulfillmentCostVatExclusiveKrw,
        "VAT_EXCLUSIVE",
        ["pickPackPackagingLabelSet"],
      ),
    },
    variableCosts: [
      confirmedMoney(
        "inboundInspectionStorage",
        costs.warehouseFullInspectionAllocationGrossKrw,
      ),
      notApplicable("pickPackPackagingLabelSet"),
      confirmedMoney(
        "supplierToFulfillmentInbound",
        costs.supplierShippingAllocationGrossKrw +
          costs.warehouseInboundUnloadingAllocationGrossKrw,
      ),
      notApplicable("otherOrderVariableCost"),
    ],
    advertisingActual: { rate: null, observedDays: 0, validOrders: 0 },
    returnLoss: {
      category: "SIMPLE_DURABLE",
      actualRate: null,
      observedDays: 0,
      observedCases: 0,
    },
  };
}

test("KK946 deterministic cost arithmetic reconciles cash and VAT bases", () => {
  const costs = decision.deterministicPerOrderCosts;
  assert.equal(decision.subjectId, "KK946");
  assert.equal(decision.policyVersion, "gonggamline-profitability-2026-08-12-v2");
  assert.ok(Math.abs(costs.landedCashCostGrossKrw - 9530 / 6) < 0.0001);
  assert.ok(
    Math.abs(
      costs.deterministicVariableCostNetOfDeductibleVatKrw -
        (9530 / 6 / 1.1 + costs.fulfillmentCostVatExclusiveKrw),
    ) < 0.0001,
  );
  assert.ok(
    Math.abs(
      costs.deterministicVariableCashOutflowGrossKrw -
        (9530 / 6 + costs.fulfillmentCostVatExclusiveKrw * 1.1),
    ) < 0.0001,
  );
});

test("approved engine reproduces every stored KK946 scenario", () => {
  for (const expected of decision.scenarios) {
    const result = calculateItemSelectionProfitability(
      profitabilityInput(expected.sellingPriceKrw),
    );
    const base = result.scenarios.baseScenario;
    const stress = result.scenarios.stressScenario;
    assert.ok(base);
    assert.ok(stress);
    assert.equal(result.status, "ESTIMATED");
    assert.equal(base.contributionProfitDisplayKrw, expected.baseContributionKrw);
    assert.equal(
      base.contributionMarginPercentDisplay,
      expected.baseContributionMarginPercent,
    );
    assert.equal(stress.contributionProfitDisplayKrw, expected.stressContributionKrw);
    assert.equal(
      stress.contributionMarginPercentDisplay,
      expected.stressContributionMarginPercent,
    );
    assert.equal(result.meetsRecommendMinimums, expected.recommendMinimums);
    assert.equal(result.meetsConditionalMinimums, expected.conditionalMinimums);
  }
});

test("target price passes recommend gates while exact actuals stay explicit", () => {
  const target = decision.scenarios.find(
    ({ sellingPriceKrw }) => sellingPriceKrw === decision.decision.targetSellingPriceKrw,
  );
  assert.ok(target);
  assert.equal(decision.decision.status, "RECOMMEND_ESTIMATED");
  assert.equal(decision.decision.minimumRecommendPriceKrw, 11243);
  assert.equal(decision.decision.operationalRecommendFloorKrw, 11300);
  assert.equal(decision.decision.conditionalExperimentFloorKrw, 9900);
  assert.equal(target.recommendMinimums, true);
  assert.equal(decision.rateCosts.marketplaceFeeRate, 0.105);
  assert.equal(
    decision.rateCosts.marketplaceFeeStatus,
    "CONFIRMED_WING_FINAL_PRICE_BASIS_VAT_EXCLUSIVE_FEE",
  );
  assert(!decision.unresolvedActuals.includes("wingCurrentCategoryFeeRate"));
  assert.equal(decision.decision.externalPriceWritePerformed, false);
  assert.equal(decision.commerceWritePerformed, false);
  assert.equal(decision.rawEvidenceMoved, false);
});

test("listing packet separates acquired facts from category-bound unknowns", () => {
  for (const fact of [
    "`KK946`",
    "polyester",
    "black",
    "`10.5 x 3.6 x 6.5 cm`",
    "`KLAND`",
    "China (OEM)",
  ]) {
    assert.match(packet, new RegExp(fact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  for (const required of [
    "displayCategoryCode",
    "mandatory purchase/search attribute",
    "mandatory notice rows",
    "certification type",
    "barcode requirement",
    "brand/trademark state",
    "outbound location",
    "return center",
  ]) {
    assert.match(packet, new RegExp(required, "i"));
  }
  assert.match(packet, /must not be used to lower the price/i);
  assert.match(packet, /No price, stock, product, coupon,[\s\S]+write was performed/i);
  assert.doesNotMatch(
    packet,
    /(?:\b01\d-\d{3,4}-\d{4}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/,
  );
  assert.doesNotMatch(decisionText, /https?:\/\//);
});
