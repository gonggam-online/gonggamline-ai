import assert from "node:assert/strict";
import test from "node:test";
import { importTenbiRows, parseTenbiCsv } from "../lib/market/tenbi-import.ts";
import { importTikTokFixture } from "../lib/market/tiktok-import.ts";
import { EXTERNAL_MARKET_SIGNAL_PACKET_VERSION, scoreExternalMarketSignal } from "../shared/contracts/external-market-signal-packet.ts";

test("Tenbi import isolates malformed rows, normalizes fields, and is idempotent by source digest", () => {
  const input = [{ keyword: "정리함", title: "회전 트레이", price: "12,900", reviews: "1,200", rank: "3", product_id: "p1" }, { keyword: "", title: "bad" }];
  const a = importTenbiRows(input, new Date("2026-08-27T00:00:00Z")); const b = importTenbiRows(input, new Date("2026-08-27T00:00:00Z"));
  assert.equal(a.rows[0]?.snapshot.price, 12900); assert.equal(a.rows[0]?.snapshot.reviewCount, 1200); assert.equal(a.rejected.length, 1); assert.equal(a.sourceDigest, b.sourceDigest);
});
test("Tenbi CSV and TikTok fixture produce bounded, traceable signals", () => {
  assert.equal(parseTenbiCsv("keyword,title\n정리함,트레이").length, 1);
  const packet = importTikTokFixture({ id: "v1", keyword: "정리함", title: "트레이 추천", views: 1000, likes: 100, posts7d: 12 });
  assert.equal(packet.packetVersion, EXTERNAL_MARKET_SIGNAL_PACKET_VERSION); assert.equal(packet.observedVia, "official_import"); assert.ok(packet.outputDigest.length === 64); assert.ok(packet.missingEvidence.includes("ABSOLUTE_DEMAND"));
});
test("external scoring retains incomplete candidates with evidence-aware score", () => {
  const score = scoreExternalMarketSignal({ demand: { score: 80, profitability: 70 }, competition: { score: 30 }, socialMomentum: { score: 60 }, priceSnapshot: { volatility: 5 }, reviewSnapshot: {}, rankingSnapshot: { volatility: 10 }, rocketShare: null, evidenceConfidence: 40 });
  assert.ok(score > 0 && score < 100);
});
