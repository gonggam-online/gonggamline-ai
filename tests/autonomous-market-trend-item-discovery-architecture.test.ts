import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const architecture = readFileSync(
  path.join(
    process.cwd(),
    "docs/architecture/AUTONOMOUS-MARKET-TREND-ITEM-DISCOVERY-ENGINE-V1.md",
  ),
  "utf8",
);

test("architecture records the implemented Shadow upgrade from the audited baseline", () => {
  assert.match(architecture, /## Current implementation inventory/);
  assert.match(architecture, /### Already usable/);
  assert.match(architecture, /### Implementation gaps addressed by v1/);
  assert.match(architecture, /fixed 24-keyword seed/);
  assert.match(architecture, /Implemented Shadow runtime architecture/);
});

test("architecture defines evidence convergence and bounded keyword learning", () => {
  for (const contract of [
    "market_keyword_signal_snapshots",
    "market_concepts",
    "market_candidate_entities",
    "market_trend_digests",
    "market_recommendation_runs",
    "market_provider_usage",
  ]) {
    assert.match(architecture, new RegExp(contract));
  }

  assert.match(architecture, /`CORE`/);
  assert.match(architecture, /`EXPLORE`/);
  assert.match(architecture, /`WATCH`/);
  assert.match(architecture, /capped at 10 new phrases per daily run/);
  assert.match(architecture, /100 active phrases/);
});

test("recommendations remain useful without inventing commercial approval", () => {
  for (const lane of [
    "DISCOVER_NOW",
    "VALIDATE_ECONOMICS",
    "WATCH_TREND",
    "SATURATED_OR_DECLINING",
    "QUARANTINED",
  ]) {
    assert.match(architecture, new RegExp(lane));
  }

  assert.match(architecture, /top 20 valid candidates are retained per run/);
  assert.match(architecture, /invented values/);
  assert.match(architecture, /Engine 2 receives a verified handoff and remains responsible for profitability/);
});

test("architecture pins provider limits and a shadow-first delivery path", () => {
  assert.match(architecture, /25,000 calls\/day/);
  assert.match(architecture, /1,000 calls\/day/);
  assert.match(architecture, /100 calls\/day/);
  assert.match(architecture, /at least 14 daily windows/);
  assert.match(architecture, /Implement Stories A through D in Shadow mode first/);
  assert.match(architecture, /## Official references/);
});
