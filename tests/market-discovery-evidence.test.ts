import assert from "node:assert/strict";
import test from "node:test";

import { admitMarketDiscoverySignal } from "../shared/domain/market-discovery-evidence.ts";

const policy = {
  sourceId: "youtube-public-search",
  kind: "short_video_public" as const,
  accessMode: "PUBLIC" as const,
  robotsReviewed: true,
  termsReviewed: true,
  captchaOrAntiBotPresent: false,
  authenticatedAccess: false,
  minimumIntervalSeconds: 60,
  policyVersion: "source-policy-v1",
};

const signal = {
  sourceId: "youtube-public-search",
  sourceKind: "short_video_public" as const,
  query: "정리용품",
  externalProductId: "video-123",
  title: "정리용품 사용 장면",
  category: "생활용품",
  sourceUrl: "https://www.youtube.com/watch?v=video-123",
  observedAt: "2026-08-19T00:00:00.000Z",
  rank: 2,
  price: null,
  reviewCount: null,
  popularityScore: 82,
  engagementRate: 0.12,
  contentVelocity: 20,
  assetRights: "REFERENCE_ONLY" as const,
};

test("admits public metadata as research evidence without asset rights", () => {
  const result = admitMarketDiscoverySignal(policy, signal, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(result.status, "ADMITTED");
  assert.equal(result.signal?.title, signal.title);
  assert.deepEqual(result.missingFacts, ["asset.rightsGrant"]);
  assert.equal(result.identityKey, "youtube-public-search:video-123:2026-08-19T00:00:00.000Z");
});

test("quarantines anti-bot, authenticated, stale, or malformed collection attempts", () => {
  const result = admitMarketDiscoverySignal({ ...policy, captchaOrAntiBotPresent: true }, {
    ...signal,
    sourceUrl: "http://insecure.example",
    observedAt: "2026-08-20T00:00:00.000Z",
    popularityScore: 101,
  }, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(result.status, "QUARANTINED");
  assert.equal(result.signal, null);
  assert.ok(result.missingFacts.includes("source.antiBot"));
  assert.ok(result.missingFacts.includes("signal.sourceUrl"));
  assert.ok(result.missingFacts.includes("signal.observedAt"));
});

test("official API sources require an approved API access mode", () => {
  const result = admitMarketDiscoverySignal({ ...policy, sourceId: "official", kind: "official_api", accessMode: "PUBLIC" }, {
    ...signal,
    sourceId: "official",
    sourceKind: "official_api",
  }, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(result.status, "QUARANTINED");
  assert.ok(result.missingFacts.includes("source.apiAuthority"));
});
