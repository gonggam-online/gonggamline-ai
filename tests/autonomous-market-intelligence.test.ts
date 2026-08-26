import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildMarketItemRecommendations, buildMarketTrendDigest, extractBoundedMarketPhrases } from "../lib/market/autonomous-intelligence";

const now = new Date("2026-08-26T00:00:00.000Z");

test("multi-source rising evidence produces a deterministic useful recommendation", () => {
  const evidence = [
    { concept: "틈새 수납", provider: "naver-search", observedAt: "2026-08-23T00:00:00.000Z", demandIndex: 42, evidenceId: "n1" },
    { concept: "틈새  수납", provider: "naver-search", observedAt: "2026-08-26T00:00:00.000Z", demandIndex: 78, shoppingIntent: 80, evidenceId: "n2" },
    { concept: "틈새 수납", provider: "youtube", observedAt: "2026-08-24T00:00:00.000Z", demandIndex: 38, contentVelocity: 72, evidenceId: "y1" },
    { concept: "틈새 수납", provider: "youtube", observedAt: "2026-08-26T00:00:00.000Z", demandIndex: 70, contentVelocity: 81, evidenceId: "y2" },
    { concept: "틈새 수납", provider: "dataforseo", observedAt: "2026-08-26T00:00:00.000Z", demandIndex: 68, competitionPressure: 34, priceRoom: 65, evidenceId: "d1" },
  ] as const;
  const first = buildMarketTrendDigest(evidence, { now });
  const second = buildMarketTrendDigest([...evidence].reverse(), { now });
  assert.equal(first.digest, second.digest);
  assert.equal(first.opportunities.length, 1);
  assert.match(first.opportunities[0].state, /BREAKOUT|RISING/);
  assert.notEqual(first.opportunities[0].lane, "QUARANTINED");
  assert.deepEqual(first.opportunities[0].providers, ["dataforseo", "naver-search", "youtube"]);
});

test("single-source evidence stays visible in the watch lane", () => {
  const digest = buildMarketTrendDigest([{ concept: "욕실 정리", provider: "youtube", observedAt: now.toISOString(), demandIndex: 90, evidenceId: "y1" }], { now });
  assert.equal(digest.status, "PARTIAL");
  assert.equal(digest.opportunities[0].state, "INSUFFICIENT_EVIDENCE");
  assert.equal(digest.opportunities[0].lane, "WATCH_TREND");
});

test("keyword discovery is bounded, evidence-counted, normalized and repeatable", () => {
  const titles = ["싱크대 틈새 수납 선반", "좁은집 틈새 수납 아이디어", "틈새 수납 정리", "욕실 흡착 선반", "흡착 선반 설치"];
  const phrases = extractBoundedMarketPhrases(titles, ["정리"], 10);
  assert.ok(phrases.includes("틈새"));
  assert.ok(phrases.includes("틈새 수납"));
  assert.ok(phrases.length <= 10);
  assert.deepEqual(phrases, extractBoundedMarketPhrases([...titles].reverse(), ["정리"], 10));
});

test("observed products become ranked single and bundle research candidates", () => {
  const digest = buildMarketTrendDigest([
    { concept: "틈새 수납", provider: "naver", observedAt: now.toISOString(), demandIndex: 75, evidenceId: "n1" },
    { concept: "틈새 수납", provider: "youtube", observedAt: now.toISOString(), demandIndex: 70, contentVelocity: 80, evidenceId: "y1" },
  ], { now, expectedProviders: 2 });
  const items = buildMarketItemRecommendations(digest.opportunities, [
    { id: 1, title: "폭조절 틈새 수납 선반", opportunityScore: 81, confidence: 72 },
    { id: 2, title: "이동식 틈새 수납 트롤리", opportunityScore: 76, confidence: 68 },
    { id: 3, title: "무관한 장난감", opportunityScore: 99, confidence: 99 },
  ]);
  assert.deepEqual(items.filter((item) => item.form === "single").map((item) => item.marketProductIds[0]), [1, 2]);
  assert.equal(items.some((item) => item.form === "bundle"), true);
  assert.ok(items.every((item) => item.unresolved.includes("UNIT_ECONOMICS")));
});

test("valid market demand remains actionable before an exact product match exists", () => {
  const digest = buildMarketTrendDigest([
    { concept: "틈새 수납", provider: "naver", observedAt: now.toISOString(), demandIndex: 75, evidenceId: "n1" },
    { concept: "틈새 수납", provider: "youtube", observedAt: now.toISOString(), demandIndex: 70, contentVelocity: 80, evidenceId: "y1" },
  ], { now, expectedProviders: 2 });
  const items = buildMarketItemRecommendations(digest.opportunities, []);
  assert.equal(items.length, 1);
  assert.equal(items[0].form, "set");
  assert.equal(items[0].marketProductIds.length, 0);
  assert.ok(items[0].unresolved.includes("SOURCE_PRODUCT_MATCH"));
  assert.match(items[0].title, /상품군 후보/);
});

test("demo products never become evidence-backed product recommendations", () => {
  const digest = buildMarketTrendDigest([
    { concept: "주방 정리", provider: "naver", observedAt: now.toISOString(), demandIndex: 75, evidenceId: "n1" },
    { concept: "주방 정리", provider: "youtube", observedAt: now.toISOString(), demandIndex: 70, contentVelocity: 80, evidenceId: "y1" },
  ], { now, expectedProviders: 2 });
  const items = buildMarketItemRecommendations(digest.opportunities, [
    { id: 1, title: "실리콘 주방 정리 트레이", source: "manual", brand: "공감데모", opportunityScore: 99, confidence: 99 },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].form, "set");
  assert.deepEqual(items[0].marketProductIds, []);
  assert.ok(items[0].unresolved.includes("SOURCE_PRODUCT_MATCH"));
});

test("declining and saturated trends remain visible but never become item recommendations", () => {
  const actionable = buildMarketTrendDigest([
    { concept: "틈새 수납", provider: "naver", observedAt: now.toISOString(), demandIndex: 75, evidenceId: "n1" },
    { concept: "틈새 수납", provider: "youtube", observedAt: now.toISOString(), demandIndex: 70, evidenceId: "y1" },
  ], { now, expectedProviders: 2 }).opportunities[0];
  const items = buildMarketItemRecommendations([
    { ...actionable, concept: "하락 상품", state: "DECLINING", lane: "SATURATED_OR_DECLINING" },
    { ...actionable, concept: "포화 상품", state: "SATURATED", lane: "SATURATED_OR_DECLINING" },
  ], []);
  assert.deepEqual(items, []);
});

test("runtime wiring continuously persists evidence, rebuilds intelligence and renders it in Engine 1", () => {
  const orchestration = readFileSync(new URL("../services/market-orchestration.service.ts", import.meta.url), "utf8");
  const persistence = readFileSync(new URL("../services/autonomous-market-discovery.service.ts", import.meta.url), "utf8");
  const runtimeClient = readFileSync(new URL("../lib/supabase/market-runtime.server.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/market/page.tsx", import.meta.url), "utf8");
  const cron = readFileSync(new URL("../app/api/market/cron/route.ts", import.meta.url), "utf8");
  const manualRun = readFileSync(new URL("../app/api/market/jobs/run/route.ts", import.meta.url), "utf8");
  const csrfRoute = readFileSync(new URL("../app/api/admin/auth/csrf/route.ts", import.meta.url), "utf8");
  assert.match(orchestration, /recordAutonomousCollectionEvidence/);
  assert.match(orchestration, /rebuildAutonomousMarketIntelligence/);
  assert.doesNotMatch(orchestration, /refreshIntelligence && results\.length/);
  assert.match(page, /\/api\/market\/intelligence/);
  assert.match(page, /오늘의 고객 수요·구매 트렌드/);
  assert.match(page, /시장 트렌드 기반 추천 아이템/);
  assert.match(page, /getAdminCsrfToken\(csrfPurpose\)/);
  assert.match(page, /"X-GonggamLine-CSRF": csrfToken/);
  assert.match(page, /"market-collection-run"/);
  assert.match(manualRun, /requireAdminRequest\(request, "read"\)/);
  assert.match(manualRun, /verifyAdminCsrfToken\(request, "market-collection-run", context\)/);
  assert.match(csrfRoute, /purpose === "market-collection-run"[\s\S]*\? "read"/);
  assert.match(cron, /runDueCollectionJobs\(6\)/);
  assert.match(orchestration, /Math\.min\(10, Math\.floor\(limit\)\)/);
  assert.match(orchestration, /\.eq\("status", "running"\)\.lt\("last_run_at", staleLease\)/);
  assert.match(orchestration, /\.eq\("id", job\.id\)[\s\S]*\.eq\("status", "active"\)[\s\S]*\.maybeSingle\(\)/);
  assert.match(persistence, /getMarketRuntimeClient/);
  assert.match(persistence, /status: "STORAGE_UNAVAILABLE"/);
  assert.match(runtimeClient, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(runtimeClient, /import "server-only"/);
  assert.doesNotMatch(runtimeClient, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("migration is additive and creates the complete autonomous evidence model", () => {
  const migration = readFileSync(new URL("../supabase/migrations/027_autonomous_market_discovery_engine.sql", import.meta.url), "utf8");
  for (const table of [
    "market_keyword_signal_snapshots",
    "market_concepts",
    "market_candidate_entities",
    "market_trend_digests",
    "market_recommendation_runs",
    "market_provider_usage",
  ]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.doesNotMatch(migration, /drop\s+table|truncate|delete\s+from/i);
  assert.match(migration, /enable row level security/);
});
