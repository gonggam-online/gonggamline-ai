import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recordText = readFileSync(
  "docs/evidence/kk946-six-unit-e2e-experiment-v1.json",
  "utf8",
);
const packet = readFileSync(
  "docs/evidence/KK946-SIX-UNIT-E2E-LISTING-READINESS-V1.md",
  "utf8",
);
const record = JSON.parse(recordText) as {
  status: string;
  risk: string;
  ordinaryPrePurchaseGate: {
    status: string;
    samplePurchaseEligible: boolean;
    additionalPurchaseAllowed: boolean;
    exceptionChangesGateResult: boolean;
  };
  experiment: {
    catalogProductId: string;
    catalogOption: string;
    unitsPerOffer: number;
    maximumSellableStock: number;
    normalPriceKrw: number;
    salePriceKrw: number;
    customerDeliveryChargeKrw: number;
    advertisingEnabled: boolean;
    couponEnabled: boolean;
    automaticPriceAdjustmentEnabled: boolean;
    reorderEnabled: boolean;
    maximumOrders: number;
    maximumExposureDays: number;
    noSaleReviewAfterDays: number;
    actualAttributableLossCapKrw: number;
    rocketGrowthInboundAllowed: boolean;
  };
  economics: {
    perOrderBaseContributionKrw: number;
    perOrderStressContributionKrw: number;
    sixOrderBaseContributionKrw: number;
    sixOrderStressContributionKrw: number;
    stressHeadroomToLossCapKrw: number;
  };
  listingAssets: {
    supplierThumbnailObserved: boolean;
    supplierImagePermissionStatus: string;
    supplierImageRegistrationSuitabilityStatus: string;
    rightsClearedMainImage: string;
    rightsClearedDetailImage: string;
    competitorImageUseAllowed: boolean;
    syntheticProductImageAllowed: boolean;
  };
  logistics: {
    wingLogisticsRecordCount: number;
    outboundRecordStatus: string;
    returnRecordStatus: string;
    representativeAccountDefaultAllowed: boolean;
    gaemiInventoryUnits: number;
    gaemiFulfillmentBalanceStatus: string;
    gaemiCoupangApiConnectionStatus: string;
    gaemiAutomaticOrderCollectionEnabled: boolean;
    manualOrderFallbackAvailable: boolean;
    wingSellerPrivateInfoStatus: string;
  };
  externalWrites: Record<string, boolean | string>;
  stopConditions: string[];
};

test("six-unit exception preserves the failed ordinary profitability gate", () => {
  assert.equal(record.status, "READ_ONLY_PREFLIGHT_OWNER_ACTION_REQUIRED");
  assert.equal(record.risk, "HIGH_RISK_MANUAL");
  assert.equal(record.ordinaryPrePurchaseGate.status, "FAIL");
  assert.equal(record.ordinaryPrePurchaseGate.samplePurchaseEligible, false);
  assert.equal(record.ordinaryPrePurchaseGate.additionalPurchaseAllowed, false);
  assert.equal(record.ordinaryPrePurchaseGate.exceptionChangesGateResult, false);
});

test("offer is bound to the exact six-unit no-ad liquidation experiment", () => {
  assert.equal(record.experiment.catalogProductId, "9681483612");
  assert.equal(record.experiment.catalogOption, "BLACK");
  assert.equal(record.experiment.unitsPerOffer, 1);
  assert.equal(record.experiment.maximumSellableStock, 6);
  assert.equal(record.experiment.maximumOrders, 6);
  assert.equal(record.experiment.normalPriceKrw, 4290);
  assert.equal(record.experiment.salePriceKrw, 4290);
  assert.equal(record.experiment.customerDeliveryChargeKrw, 0);
  assert.equal(record.experiment.advertisingEnabled, false);
  assert.equal(record.experiment.couponEnabled, false);
  assert.equal(record.experiment.automaticPriceAdjustmentEnabled, false);
  assert.equal(record.experiment.reorderEnabled, false);
  assert.equal(record.experiment.rocketGrowthInboundAllowed, false);
  assert.equal(record.experiment.maximumExposureDays, 14);
  assert.equal(record.experiment.noSaleReviewAfterDays, 7);
});

test("six-order stress estimate stays below but never replaces the actual loss cap", () => {
  assert.equal(record.economics.sixOrderBaseContributionKrw, 6 * record.economics.perOrderBaseContributionKrw);
  assert.equal(record.economics.sixOrderStressContributionKrw, 6 * record.economics.perOrderStressContributionKrw);
  assert.equal(
    record.economics.stressHeadroomToLossCapKrw,
    record.experiment.actualAttributableLossCapKrw + record.economics.sixOrderStressContributionKrw,
  );
  assert.ok(
    Math.abs(record.economics.sixOrderStressContributionKrw) <
      record.experiment.actualAttributableLossCapKrw,
  );
});

test("missing logistics and rights-cleared assets fail closed", () => {
  assert.equal(record.logistics.wingLogisticsRecordCount, 0);
  assert.equal(record.logistics.outboundRecordStatus, "MISSING");
  assert.equal(record.logistics.returnRecordStatus, "MISSING");
  assert.equal(record.logistics.representativeAccountDefaultAllowed, false);
  assert.equal(record.listingAssets.rightsClearedMainImage, "MISSING");
  assert.equal(record.listingAssets.rightsClearedDetailImage, "MISSING");
  assert.equal(record.listingAssets.competitorImageUseAllowed, false);
  assert.equal(record.listingAssets.syntheticProductImageAllowed, false);
  assert.equal(record.listingAssets.supplierThumbnailObserved, true);
  assert.equal(record.listingAssets.supplierImagePermissionStatus, "VERIFIED_PROVIDER_PAGE_USE_ALLOWED");
  assert.equal(record.listingAssets.supplierImageRegistrationSuitabilityStatus, "UNVERIFIED_MAIN_AND_DETAIL_REQUIREMENTS");
  assert.ok(record.stopConditions.includes("RIGHTS_CLEARED_MAIN_AND_DETAIL_ASSETS_MISSING"));
  assert.ok(record.stopConditions.includes("PRIVATE_GAEMI_DISPATCH_OR_RETURN_DETAILS_UNCONFIRMED"));
});

test("post-merge logistics evidence exposes the manual fallback without inventing automation", () => {
  assert.equal(record.logistics.gaemiInventoryUnits, 6);
  assert.equal(record.logistics.gaemiFulfillmentBalanceStatus, "SUFFICIENT_FOR_SIX_BASE_OUTBOUNDS");
  assert.equal(record.logistics.gaemiCoupangApiConnectionStatus, "DISCONNECTED");
  assert.equal(record.logistics.gaemiAutomaticOrderCollectionEnabled, false);
  assert.equal(record.logistics.manualOrderFallbackAvailable, true);
  assert.equal(record.logistics.wingSellerPrivateInfoStatus, "PASSWORD_REAUTH_REQUIRED");
  assert.ok(record.stopConditions.includes("COUPANG_API_DISCONNECTED_IF_AUTOMATED_FULFILLMENT_IS_REQUIRED"));
  assert.match(packet, /manual first-order fallback/i);
  assert.match(packet, /Vendor code, Access Key, and Secret Key[\s\S]+never in Git/i);
});

test("packet proves no external write and contains the exact approval boundary", () => {
  assert.equal(record.externalWrites.performed, false);
  assert.equal(record.externalWrites.addressCreationPerformed, false);
  assert.equal(record.externalWrites.productSavePerformed, false);
  assert.equal(record.externalWrites.productRegistrationPerformed, false);
  assert.equal(record.externalWrites.priceOrStockWritePerformed, false);
  assert.equal(record.externalWrites.advertisingWritePerformed, false);
  assert.equal(record.externalWrites.providerInquiryPerformed, false);
  assert.equal(record.externalWrites.apiConfigurationWritePerformed, false);
  assert.match(packet, /This statement is not yet an approval/i);
  assert.match(packet, /9681483612[\s\S]+KK946-BLACK[\s\S]+재고 6/);
  assert.match(packet, /광고·쿠폰·자동가격조정·재주문 없음/);
  assert.match(packet, /손실상한[\s\S]+30,000원/);
  assert.match(packet, /representative-address default must not\s+be accepted silently/i);
  assert.doesNotMatch(
    `${recordText}\n${packet}`,
    /(?:\b01\d-\d{3,4}-\d{4}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/,
  );
});
