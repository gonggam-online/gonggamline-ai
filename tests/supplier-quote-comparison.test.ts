import assert from "node:assert/strict";
import test from "node:test";
import { compareSupplierQuotes, type CanonicalSupplierOffer } from "../shared/domain/supplier-quote-comparison";

const base = (overrides: Partial<CanonicalSupplierOffer> = {}): CanonicalSupplierOffer => ({
  provider: "domeggook", providerItemId: "100", canonicalIdentity: "identity-1", title: "정리함", variantKey: "white-1", unitsPerOffer: 1,
  unitCostKrw: 4_000, shippingKrw: 3_000, minimumOrderQuantity: 1, leadTimeDays: 2, stock: "IN_STOCK", rights: "VERIFIED", observedAt: "2026-08-20T00:00:00Z", sourceReference: "https://example.com/offer", evidenceDigest: "sha256:base", ...overrides,
});

const input = (overrides: Partial<Parameters<typeof compareSupplierQuotes>[0]> = {}) => ({
  candidateIdentity: "identity-1", variantKey: "white-1", unitsPerOffer: 1, domeggookBaseline: base(), alternatives: [],
  costs: { supplierToFulfillmentPerUnitKrw: 500, fulfillmentPerUnitKrw: 3_000, marketplaceAndAdvertisingPerUnitKrw: 2_000, returnAllowancePerUnitKrw: 500 }, evaluatedAt: "2026-08-20T12:00:00Z", ...overrides,
});

test("keeps Domeggook as the baseline when no alternative exists", () => assert.equal(compareSupplierQuotes(input()).status, "DOMEGGOOK_BASELINE"));
test("selects a materially cheaper verified alternative", () => {
  const result = compareSupplierQuotes(input({ alternatives: [base({ provider: "manual_verified", providerItemId: "alt-1", unitCostKrw: 3_000, shippingKrw: 1_000, evidenceDigest: "sha256:alt" })] }));
  assert.equal(result.status, "ALTERNATIVE_BETTER");
  assert.equal(result.preferred?.executionEligible, false);
});
test("does not compare a different pack as identical", () => {
  const result = compareSupplierQuotes(input({ alternatives: [base({ provider: "manual_verified", providerItemId: "alt-1", unitsPerOffer: 2, evidenceDigest: "sha256:alt" })] }));
  assert.equal(result.status, "ALTERNATIVE_INCOMPLETE");
  assert.match(result.alternatives[0].reasons.join(","), /VARIANT_OR_PACK_MISMATCH/);
});
test("keeps rights-unknown offers out of the preferred lane", () => {
  const result = compareSupplierQuotes(input({ alternatives: [base({ provider: "manual_verified", providerItemId: "alt-1", unitCostKrw: 1_000, rights: "UNKNOWN", evidenceDigest: "sha256:alt" })] }));
  assert.equal(result.status, "ALTERNATIVE_INCOMPLETE");
  assert.equal(result.preferred, null);
});
test("keeps stale quotes visible but ineligible", () => {
  const result = compareSupplierQuotes(input({ alternatives: [base({ provider: "manual_verified", providerItemId: "alt-1", observedAt: "2026-08-01T00:00:00Z", evidenceDigest: "sha256:alt" })] }));
  assert.equal(result.status, "ALTERNATIVE_INCOMPLETE");
  assert.match(result.alternatives[0].reasons.join(","), /QUOTE_STALE_OR_FUTURE/);
});
test("fails closed when baseline is unavailable", () => {
  const result = compareSupplierQuotes(input({ domeggookBaseline: null, alternatives: [base({ provider: "manual_verified", providerItemId: "alt-1", evidenceDigest: "sha256:alt" })] }));
  assert.equal(result.status, "NO_VERIFIED_MATCH");
});
test("requires both absolute and percentage savings", () => {
  const result = compareSupplierQuotes(input({ policy: { minimumAlternativeSavingsKrw: 4_000, minimumAlternativeSavingsRate: 0.2 }, alternatives: [base({ provider: "manual_verified", providerItemId: "alt-1", unitCostKrw: 3_000, shippingKrw: 1_000, evidenceDigest: "sha256:alt" })] }));
  assert.equal(result.status, "ALTERNATIVE_COMPARABLE");
});
