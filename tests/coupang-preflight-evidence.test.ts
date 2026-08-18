import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleMarketplacePreflightEvidence,
  createCoupangEvidenceReader,
  createOpaqueCoupangVendorRef,
  decodeOutboundEvidence,
  decodeOutboundEvidenceByAddress,
  decodeReturnEvidence,
  decodeReturnEvidenceByAddress,
} from "../lib/coupang/preflight-evidence.ts";
import { mapCoupangEvidenceToProductPreflight } from "../engines/listing/coupang-preflight-adapter.ts";
import type { CoupangCategorySnapshot } from "../shared/contracts/coupang-category-snapshot.ts";

const observedAt = "2026-08-08T00:00:00.000Z";
const vendorRef = "coupang-vendor:fixture";
const categorySnapshot = {
  schemaVersion: "gonggamline-coupang-category-snapshot-v1",
  rulesetVersion: "gonggamline-coupang-category-snapshot-rules-v1",
  displayCategoryCode: "78877",
  channel: "MARKETPLACE",
  observedAt,
  metadataDigest: "a".repeat(64),
  validityDigest: "b".repeat(64),
  categoryValid: true,
  isAllowSingleItem: true,
  attributes: [],
  noticeCategories: [],
  requiredDocuments: [],
  certifications: [],
  allowedOfferConditions: ["NEW"],
  selectedNoticeCategoryName: null,
  disposition: "VALIDATED",
  issues: [],
} satisfies CoupangCategorySnapshot;

test("outbound decoder retains only selected usable code and sanitized provenance", () => {
  const result = decodeOutboundEvidence({
    raw: { content: [{ outboundShippingPlaceCode: "OUT-1", usable: true, address: "discard", phone: "discard" }] },
    vendorRef,
    selectedCode: "OUT-1",
    observedAt,
    sourceUrl: "https://api-gateway.coupang.com/outbound?placeCodes=OUT-1",
  });
  assert.equal(result.ok, true);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /address|phone|discard/);
  assert.match(serialized, /sha256:[a-f0-9]{64}/);
});

test("duplicate or unusable outbound evidence fails closed", () => {
  for (const content of [
    [{ outboundShippingPlaceCode: "OUT-1", usable: false }],
    [{ outboundShippingPlaceCode: "OUT-1", usable: true }, { outboundShippingPlaceCode: "OUT-1", usable: true }],
  ]) {
    const result = decodeOutboundEvidence({ raw: { content }, vendorRef, selectedCode: "OUT-1", observedAt, sourceUrl: "fixture" });
    assert.deepEqual(result, { ok: false, code: "EVIDENCE_CONFLICT" });
  }
});

test("address lookup selects exactly one usable outbound location without retaining address data", () => {
  const result = decodeOutboundEvidenceByAddress({
    raw: { content: [
      { outboundShippingPlaceCode: "OUT-1", shippingPlaceName: "개미창고", usable: true, placeAddresses: [{ zipCode: "12345", address: "서울시 중구 세종대로", addressDetail: "101호", companyContactNumber: "discard" }] },
      { outboundShippingPlaceCode: "OUT-2", shippingPlaceName: "다른 출고지", usable: true, placeAddresses: [{ zipCode: "99999", address: "부산시 해운대구", addressDetail: "202호" }] },
    ] },
    vendorRef,
    selector: { placeName: "개미창고", zipCode: "12345", address: "서울시 중구 세종대로", addressDetail: "101호" },
    observedAt,
    sourceUrl: "https://api-gateway.coupang.com/outbound?placeNames=%EA%B0%9C%EB%AF%B8%EC%B0%BD%EA%B3%A0",
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.evidence.outboundShippingPlaceCode, "OUT-1");
  assert.doesNotMatch(JSON.stringify(result), /서울시|12345|101호|discard/);
});

test("ambiguous address lookup never guesses an outbound code", () => {
  const result = decodeOutboundEvidenceByAddress({
    raw: { content: [
      { outboundShippingPlaceCode: "OUT-1", shippingPlaceName: "개미창고", usable: true, placeAddresses: [{ zipCode: "12345", address: "서울시 중구 세종대로" }] },
      { outboundShippingPlaceCode: "OUT-2", shippingPlaceName: "개미창고", usable: true, placeAddresses: [{ zipCode: "12345", address: "서울시 중구 세종대로" }] },
    ] }, vendorRef, selector: { placeName: "개미창고", zipCode: "12345", address: "서울시 중구 세종대로" }, observedAt, sourceUrl: "fixture",
  });
  assert.deepEqual(result, { ok: false, code: "EVIDENCE_CONFLICT" });
});

test("return decoder discards contact, address, courier and fee fields", () => {
  const result = decodeReturnEvidence({
    pages: [{ code: 200, data: [{ returnCenterCode: "RET-1", address: "discard", phone: "discard", fee: 9, courier: "discard" }] }],
    vendorRef,
    selectedCode: "RET-1",
    observedAt,
    sourceUrl: "https://api-gateway.coupang.com/vendors/{vendorId}/returnShippingCenters",
  });
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /address|phone|courier|fee|discard/);
});

test("return decoder accepts the official v5 data.content envelope", () => {
  const result = decodeReturnEvidence({
    pages: [{ code: 200, data: { content: [{ returnCenterCode: "RET-V5", shippingPlaceName: "개미창고 반품", placeAddresses: [{ returnZipCode: "12345", returnAddress: "서울시 중구 세종대로", returnAddressDetail: "101호" }] }] } }],
    vendorRef,
    selectedCode: "RET-V5",
    observedAt,
    sourceUrl: "https://api-gateway.coupang.com/vendors/{vendorId}/returnShippingCenters",
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.evidence.returnCenterCode, "RET-V5");
});

test("address lookup selects a return center across bounded pages", () => {
  const result = decodeReturnEvidenceByAddress({
    pages: [
      { code: 200, data: [{ returnCenterCode: "RET-1", shippingPlaceName: "다른 반품지", placeAddresses: [{ zipCode: "99999", address: "부산시 해운대구" }] }] },
      { code: 200, data: [{ returnCenterCode: "RET-2", shippingPlaceName: "개미창고 반품", placeAddresses: [{ zipCode: "12345", address: "서울시 중구 세종대로", addressDetail: "101호" }], fee: 3000, courier: "discard" }] },
    ], vendorRef, selector: { placeName: "개미창고 반품", zipCode: "12345", address: "서울시 중구 세종대로", addressDetail: "101호" }, observedAt, sourceUrl: "fixture",
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.evidence.returnCenterCode, "RET-2");
  assert.doesNotMatch(JSON.stringify(result), /서울시|12345|101호|discard/);
});

test("address lookup matches the official v5 return address fields", () => {
  const result = decodeReturnEvidenceByAddress({
    pages: [{ code: 200, data: { content: [{ returnCenterCode: "RET-V5", shippingPlaceName: "개미창고 반품", placeAddresses: [{ returnZipCode: "12345", returnAddress: "서울시 중구 세종대로", returnAddressDetail: "101호" }] }] } }],
    vendorRef,
    selector: { placeName: "개미창고 반품", zipCode: "12345", address: "서울시 중구 세종대로", addressDetail: "101호" },
    observedAt,
    sourceUrl: "fixture",
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.evidence.returnCenterCode, "RET-V5");
});

test("return lookup reports bounded exhaustion rather than absence", async () => {
  let calls = 0;
  const reader = createCoupangEvidenceReader({
    now: () => new Date(observedAt),
    resolveVendorIdentity: () => ({ vendorId: "fixture-vendor-secret", vendorRef }),
    transport: async <T>(options: { method: "GET"; path: string; searchParams?: URLSearchParams }) => {
      calls += 1;
      assert.equal(options.method, "GET");
      assert.match(options.path, /fixture-vendor-secret\/returnShippingCenters$/);
      assert.equal(options.searchParams?.get("pageSize"), "50");
      const data = { code: 200, data: Array.from({ length: 50 }, (_, index) => ({ returnCenterCode: `OTHER-${calls}-${index}` })) };
      return { ok: true, status: 200, data: data as T, raw: data };
    },
  });
  const result = await reader.readReturnCenter("RET-1");
  assert.equal(calls, 10);
  assert.deepEqual(result, { ok: false, code: "EVIDENCE_LIMIT_EXCEEDED" });
});

test("outbound reader uses one exact GET and never emits configured vendor ID", async () => {
  const calls: string[] = [];
  const reader = createCoupangEvidenceReader({
    now: () => new Date(observedAt),
    resolveVendorIdentity: () => ({ vendorId: "fixture-vendor-secret", vendorRef }),
    transport: async <T>(options: { method: "GET"; path: string; searchParams?: URLSearchParams }) => {
      calls.push(`${options.method} ${options.path}?${options.searchParams?.toString()}`);
      const data = { content: [{ outboundShippingPlaceCode: "OUT-1", usable: true }] };
      return { ok: true, status: 200, data: data as T, raw: data };
    },
  });
  const result = await reader.readOutbound("OUT-1");
  assert.deepEqual(calls, ["GET /v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound?placeCodes=OUT-1"]);
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /fixture-vendor-secret/);
});

test("address readers use official lookup semantics and keep vendor identity opaque", async () => {
  const calls: string[] = [];
  const reader = createCoupangEvidenceReader({
    now: () => new Date(observedAt), resolveVendorIdentity: () => ({ vendorId: "fixture-vendor-secret", vendorRef }),
    transport: async <T>(options: { method: "GET"; path: string; searchParams?: URLSearchParams }) => {
      calls.push(`${options.method} ${options.path}?${options.searchParams?.toString()}`);
      const data = options.path.includes("returnShippingCenters")
        ? { code: 200, data: [{ returnCenterCode: "RET-1", shippingPlaceName: "개미창고 반품", placeAddresses: [{ zipCode: "12345", address: "서울시 중구 세종대로" }] }] }
        : { content: [{ outboundShippingPlaceCode: "OUT-1", shippingPlaceName: "개미창고", usable: true, placeAddresses: [{ zipCode: "12345", address: "서울시 중구 세종대로" }] }] };
      return { ok: true, status: 200, data: data as T, raw: data };
    },
  });
  const selector = { placeName: "개미창고", zipCode: "12345", address: "서울시 중구 세종대로" };
  const outbound = await reader.readOutboundByAddress(selector);
  const returns = await reader.readReturnCenterByAddress({ ...selector, placeName: "개미창고 반품" });
  assert.equal(outbound.ok, true); assert.equal(returns.ok, true);
  assert.match(calls[0], /placeNames=%EA%B0%9C%EB%AF%B8%EC%B0%BD%EA%B3%A0/);
  assert.match(calls[1], /returnShippingCenters\?pageNum=1&pageSize=50/);
  assert.doesNotMatch(JSON.stringify({ outbound, returns }), /fixture-vendor-secret|서울시|12345/);
});

test("configuration and provider failures have distinct taxonomy", async () => {
  const missingConfig = createCoupangEvidenceReader({ resolveVendorIdentity: () => { throw new Error("missing"); } });
  assert.deepEqual(await missingConfig.readOutbound("OUT-1"), { ok: false, code: "CONFIGURATION_UNAVAILABLE" });
  const denied = createCoupangEvidenceReader({
    resolveVendorIdentity: () => ({ vendorId: "fixture", vendorRef }),
    transport: async <T>() => ({ ok: false, status: 403, data: null as T | null, raw: null }),
  });
  assert.deepEqual(await denied.readOutbound("OUT-1"), { ok: false, code: "AUTHENTICATION_OR_SCOPE" });
});

test("assembled evidence is deterministic and mapper uses the older logistics observation", () => {
  const outbound = decodeOutboundEvidence({
    raw: { content: [{ outboundShippingPlaceCode: "OUT-1", usable: true }] }, vendorRef,
    selectedCode: "OUT-1", observedAt: "2026-08-08T00:10:00.000Z", sourceUrl: "outbound",
  });
  const returns = decodeReturnEvidence({
    pages: [{ code: 200, data: [{ returnCenterCode: "RET-1" }] }], vendorRef,
    selectedCode: "RET-1", observedAt, sourceUrl: "return",
  });
  assert.equal(outbound.ok, true);
  assert.equal(returns.ok, true);
  if (!outbound.ok || !returns.ok) return;
  const first = assembleMarketplacePreflightEvidence({ categorySnapshot, outbound: outbound.evidence, returnCenter: returns.evidence });
  const second = assembleMarketplacePreflightEvidence({ categorySnapshot, outbound: outbound.evidence, returnCenter: returns.evidence });
  assert.ok(first);
  assert.equal(first.evidenceFingerprint, second?.evidenceFingerprint);
  const mapped = mapCoupangEvidenceToProductPreflight(first);
  assert.equal(mapped.vendor.observedAt, observedAt);
  assert.deepEqual(mapped.vendor.outboundShippingPlaceCodes, ["OUT-1"]);
  assert.deepEqual(mapped.vendor.returnCenterCodes, ["RET-1"]);
});

test("opaque vendor references are stable hashes without raw identity", () => {
  const ref = createOpaqueCoupangVendorRef("fixture-vendor-secret");
  assert.match(ref, /^coupang-vendor:[a-f0-9]{64}$/);
  assert.doesNotMatch(ref, /fixture-vendor-secret/);
});
