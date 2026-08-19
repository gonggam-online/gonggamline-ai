import assert from "node:assert/strict";
import test from "node:test";

import {
  compareItemSelectionBenchmarks,
  evaluateItemSelectionBenchmark,
} from "../shared/domain/item-selection-benchmark.ts";

const candidates = [
  { providerItemNumber: "100", relevance: 3, observedContributionMarginRate: 0.32 },
  { providerItemNumber: "101", relevance: 0, observedContributionMarginRate: 0.04 },
  { providerItemNumber: "102", relevance: 2, observedContributionMarginRate: 0.22 },
  { providerItemNumber: "103", relevance: 1, observedContributionMarginRate: null },
  { providerItemNumber: "104", relevance: 0, observedContributionMarginRate: null },
  { providerItemNumber: "105", relevance: 3, observedContributionMarginRate: 0.28 },
];

test("benchmark reports top-k ranking quality without changing predictions", () => {
  const result = evaluateItemSelectionBenchmark(candidates, [
    { providerItemNumber: "100", verdict: "RECOMMEND", score: 90 },
    { providerItemNumber: "105", verdict: "RECOMMEND", score: 88 },
    { providerItemNumber: "102", verdict: "CONDITIONAL", score: 72 },
    { providerItemNumber: "101", verdict: "MANUAL_REVIEW", score: null },
  ], 3);
  assert.equal(result.precisionAtK, 1);
  assert.equal(result.recallAtK, 1);
  assert.equal(result.coverage, 0.6667);
  assert.equal(result.meanAbsoluteMarginError, 0.56);
  assert.equal(result.eligibleForDecision, false);
});

test("benchmark rejects unknown identifiers and invalid labels", () => {
  assert.throws(() => evaluateItemSelectionBenchmark(candidates, [
    { providerItemNumber: "999", verdict: "RECOMMEND", score: 80 },
  ], 3), /benchmark candidates/);
  assert.throws(() => evaluateItemSelectionBenchmark([
    { providerItemNumber: "100", relevance: 4, observedContributionMarginRate: null },
  ], [], 3), /relevance/);
});

test("comparison reports engine lift against a fixed baseline", () => {
  const comparison = compareItemSelectionBenchmarks(
    candidates,
    [
      { providerItemNumber: "100", verdict: "RECOMMEND", score: 90 },
      { providerItemNumber: "105", verdict: "RECOMMEND", score: 88 },
      { providerItemNumber: "102", verdict: "CONDITIONAL", score: 72 },
    ],
    [
      { providerItemNumber: "101", verdict: "RECOMMEND", score: 91 },
      { providerItemNumber: "100", verdict: "CONDITIONAL", score: 70 },
      { providerItemNumber: "104", verdict: "CONDITIONAL", score: 69 },
    ],
    3,
  );
  assert.equal(comparison.precisionAtKLift, 0.6667);
  assert.ok(comparison.ndcgAtKLift !== null && comparison.ndcgAtKLift > 0);
});
