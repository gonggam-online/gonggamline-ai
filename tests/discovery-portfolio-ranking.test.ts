import assert from "node:assert/strict";
import test from "node:test";

import { rankDiscoveryPortfolio } from "../lib/market/discovery-portfolio-ranking.ts";

test("portfolio ranking favors scalable evidenced candidates and remains deterministic", () => {
  const trends = [{ candidateId: "a", title: "욕실 틈새 선반", form: "single", score: 82, confidence: 76, trendState: "RISING", concept: "욕실정리", reasons: ["수요 상승"], unresolved: [] }, { candidateId: "b", title: "저신뢰 후보", form: "single", score: 70, confidence: 25, trendState: "WATCH", concept: "기타", reasons: [], unresolved: ["UNIT_ECONOMICS"] }] as const;
  const first = rankDiscoveryPortfolio({ trends, evaluated: [] });
  const second = rankDiscoveryPortfolio({ trends: [...trends].reverse(), evaluated: [] });
  assert.equal(first[0]?.title, "욕실 틈새 선반");
  assert.deepEqual(first, second);
  assert.equal(first[0]?.lane, "SCALE_READY");
  assert.notEqual(first[1]?.lane, "SCALE_READY");
});

test("evaluated real products supersede the same trend while demo rows are excluded", () => {
  const evaluated = [{ id: 10, status: "candidate", decision_action: "approve", decision_score: 80, market_score: 85, growth_score: 80, supply_score: 70, profit_score: 72, risk_score: 30, confidence: 75, estimated_units_low: 300, estimated_units_high: 900, recommendation_reason: "근거 충분", risk_explanation: "제한적", market_products: { title: "욕실정리", category: "생활", brand: null, thumbnail_url: null } }, { id: 11, status: "candidate", decision_action: "review", decision_score: 60, market_score: 60, growth_score: 60, supply_score: 50, profit_score: 50, risk_score: 50, confidence: 50, estimated_units_low: 10, estimated_units_high: 20, recommendation_reason: "demo", risk_explanation: "demo", market_products: { title: "가짜", category: "데모 데이터", brand: null, thumbnail_url: null } }] as const;
  const result = rankDiscoveryPortfolio({ trends: [{ candidateId: "same", title: "욕실정리 상품군", form: "set", score: 75, confidence: 70, trendState: "RISING", concept: "욕실정리", reasons: [], unresolved: [] }], evaluated });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.source, "EVALUATED_PRODUCT");
  assert.equal(result[0]?.recommendationId, 10);
});
