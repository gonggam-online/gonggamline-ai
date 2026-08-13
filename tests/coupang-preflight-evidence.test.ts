import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleMarketplacePreflightEvidence,
  createCoupangEvidenceReader,
  createOpaqueCoupangVendorRef,
  decodeOutboundEvidence,
  decodeReturnEvidence,
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
