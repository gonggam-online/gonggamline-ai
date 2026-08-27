import assert from "node:assert/strict";
import test from "node:test";
import { importTenbiRows, parseTenbiCsv } from "../lib/market/tenbi-import.ts";
import { importTikTokFixture, importTikTokRows, parseTikTokCsv } from "../lib/market/tiktok-import.ts";
import { EXTERNAL_MARKET_SIGNAL_PACKET_VERSION, scoreExternalMarketSignal } from "../shared/contracts/external-market-signal-packet.ts";

test("Tenbi import isolates malformed rows, normalizes fields, and is idempotent by source digest", () => {
  const input = [{ keyword: "정리함", title: "회전 트레이", price: "12,900", reviews: "1,200", rank: "3", product_id: "p1" }, { keyword: "", title: "" }];
  const a = importTenbiRows(input, new Date("2026-08-27T00:00:00Z")); const b = importTenbiRows(input, new Date("2026-08-27T00:00:00Z"));
  assert.equal(a.rows[0]?.snapshot.price, 12900); assert.equal(a.rows[0]?.snapshot.reviewCount, 1200); assert.equal(a.packets[0]?.source, "TENBI"); assert.equal(a.rejected.length, 1); assert.equal(a.sourceDigest, b.sourceDigest);
});
test("Tenbi CSV and TikTok fixture produce bounded, traceable signals", () => {
  const parsed = parseTenbiCsv("keyword,title,source_url\n정리함,\"회전, 트레이\",https://example.com/item");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.title, "회전, 트레이");
  const packet = importTikTokFixture({ id: "v1", keyword: "정리함", title: "트레이 추천", views: 1000, likes: 100, posts7d: 12 });
  assert.equal(packet.packetVersion, EXTERNAL_MARKET_SIGNAL_PACKET_VERSION); assert.equal(packet.observedVia, "official_import"); assert.ok(packet.outputDigest.length === 64); assert.ok(packet.missingEvidence.includes("ABSOLUTE_DEMAND"));
});
test("Korean Tenbi paste and TikTok official TSV aliases remain independently traceable", () => {
  const tenbi = importTenbiRows(parseTenbiCsv("키워드\t상품명\t플랫폼\t원문URL\t조회수\t좋아요\t급상승지수\n냉장고 매트\t냉장고 매트\t유튜브\thttps://youtube.com/shorts/a\t1000\t50\t12"), new Date("2026-08-27T00:00:00Z"));
  assert.equal(tenbi.rows.length, 1);
  assert.equal(tenbi.packets[0]?.upstreamSource, "유튜브");
  assert.equal(tenbi.packets[0]?.observedVia, "tenbi_user_assisted_import");

  const tiktok = importTikTokRows(parseTikTokCsv("키워드\t제목\t원문URL\t조회수\t좋아요\t댓글\t공유\n식탁 매트\t투명 매트\thttps://tiktok.com/v/1\t2000\t120\t10\t5"), new Date("2026-08-27T00:00:00Z"));
  assert.equal(tiktok.packets.length, 1);
  assert.equal(tiktok.packets[0]?.source, "TIKTOK");
  assert.equal(tiktok.packets[0]?.socialMomentum.views, 2000);
});
test("external scoring retains incomplete candidates with evidence-aware score", () => {
  const score = scoreExternalMarketSignal({ demand: { score: 80, profitability: 70 }, competition: { score: 30 }, socialMomentum: { score: 60 }, priceSnapshot: { volatility: 5 }, reviewSnapshot: {}, rankingSnapshot: { volatility: 10 }, rocketShare: null, evidenceConfidence: 40 });
  assert.ok(score > 0 && score < 100);
});
