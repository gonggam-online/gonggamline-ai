import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketResearchPlan,
  MARKET_RESEARCH_PLAN_VERSION,
  type MarketResearchSource,
} from "../shared/domain/market-research-plan.ts";
import { buildMarketResearchPacket } from "../shared/domain/market-research-packet.ts";

const sources: readonly MarketResearchSource[] = [
  {
    sourceKey: "official-trends",
    label: "공식 추세 API",
    lane: "OFFICIAL_API",
    readiness: "READY_READ_ONLY",
    approved: true,
    readOnly: true,
    estimatedCostKrw: 0,
    quotaPerDay: 100,
    minimumIntervalSeconds: 60,
    policyVersion: "trends-v1",
  },
  {
    sourceKey: "paid-demand-panel",
    label: "유료 수요 패널",
    lane: "PAID_PROVIDER",
    readiness: "APPROVAL_REQUIRED",
    approved: false,
    readOnly: true,
    estimatedCostKrw: 120,
    quotaPerDay: 20,
    minimumIntervalSeconds: 60,
    policyVersion: "paid-panel-v1",
  },
];

test("prefers an approved read-only source and keeps missing economics actionable", () => {
  const plan = buildMarketResearchPlan({
    providerItemNumber: "123",
    keyword: "수납 정리함",
    category: "생활용품",
    missingSignals: ["demand", "economics", "demand"],
  }, sources);
  assert.equal(plan.version, MARKET_RESEARCH_PLAN_VERSION);
  assert.equal(plan.tasks.length, 2);
  assert.equal(plan.executableTaskCount, 2);
  assert.equal(plan.approvalRequiredTaskCount, 0);
  assert.equal(plan.estimatedCostKrw, 0);
  assert.equal(plan.tasks[0]?.sourceKey, "official-trends");
});

test("does not execute a paid source until approval and configuration are present", () => {
  const plan = buildMarketResearchPlan({
    providerItemNumber: "124",
    keyword: "차량용 정리함",
    category: null,
    missingSignals: ["demand"],
  }, [sources[1]!]);
  assert.equal(plan.executableTaskCount, 0);
  assert.equal(plan.approvalRequiredTaskCount, 1);
  assert.deepEqual(plan.blockers, ["source.ownerApproval"]);
  assert.equal(plan.tasks[0]?.canExecute, false);
});

test("rejects malformed candidates instead of creating an untraceable task", () => {
  assert.throws(() => buildMarketResearchPlan({
    providerItemNumber: "sku-1",
    keyword: "수납",
    category: null,
    missingSignals: ["demand"],
  }, sources), /providerItemNumber/);
});

test("does not mark an unconfigured research lane as ready", () => {
  const plan = buildMarketResearchPlan({
    providerItemNumber: "126",
    keyword: "욕실 선반",
    category: null,
    missingSignals: ["demand"],
  }, []);
  assert.equal(plan.executableTaskCount, 0);
  assert.deepEqual(plan.blockers, ["source.noAvailableLane"]);
});

test("builds a research-next packet instead of discarding a promising candidate", () => {
  const packet = buildMarketResearchPacket({
    providerItemNumber: "125",
    keyword: "싱크대 수납",
    category: "주방용품",
    missingSignals: ["economics", "supply"],
  }, {
    providerItemNumber: "125",
    title: "싱크대 수납 선반",
    category: "주방용품",
    observations: [{
      sourceKind: "official_api",
      observedAt: "2026-08-19T00:00:00.000Z",
      demandScore: 78,
      growthScore: 72,
      competitionScore: 40,
      supplyScore: 70,
      contentVelocityScore: 65,
      reviewVelocityScore: 60,
      price: 19900,
      confidence: 85,
    }],
    economics: {
      salePrice: null,
      productCost: null,
      inboundCost: null,
      fulfillmentCost: null,
      marketplaceFee: null,
      returnAllowance: null,
    },
    complementTags: ["organization"],
  }, sources, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(packet.recommendation, "RESEARCH_NEXT");
  assert.equal(packet.opportunity.status, "COST_CONFIRMATION_REQUIRED");
  assert.equal(packet.plan.tasks.length, 2);
});
