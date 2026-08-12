import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runbook = readFileSync("docs/runbooks/KK946-EVIDENCE-ACQUISITION-V1.md", "utf8");
const authenticatedPrecheck = readFileSync(
  "docs/evidence/KK946-DOMEGGOOK-AUTHENTICATED-PRECHECK-V1.md",
  "utf8",
);
const inboundInspectionPacket = readFileSync(
  "docs/evidence/KK946-INBOUND-INSPECTION-EVIDENCE-PACKET-V1.md",
  "utf8",
);
const statusText = readFileSync("docs/evidence/kk946-evidence-status-v1.json", "utf8");
const status = JSON.parse(statusText) as {
  subjectId: string;
  disposition: string;
  rawEvidenceMoved: boolean;
  commerceWritePerformed: boolean;
  bindings: Record<string, string>;
  confidentialEvidenceStore: string;
  saleSuitability: string;
  listingEligibility: string;
  profitability: {
    policyVersion: string;
    status: string;
    targetSellingPriceKrw: number;
    minimumRecommendPriceKrw: number;
    operationalRecommendFloorKrw: number;
    baseContributionKrw: number;
    stressContributionKrw: number;
    missingFacts: string[];
    estimatedFacts: string[];
    externalPriceWritePerformed: boolean;
  };
  inspectionStageEvidence: {
    productImage: string;
    inboundStart: string;
    subdivisionWork: string;
    storageComplete: string;
    provesSixUnitInspectionOutcome: boolean;
    inspectionExecutionBasis: string;
  };
  costEvidence: {
    supplierOrderTotalKrw: number;
    warehouseInboundUnloadingKrw: number;
    warehouseFullInspectionKrw: number;
    verifiedSampleCashOutflowKrw: number;
    quantity: number;
    derivedPerUnitApproxKrw: number;
    warehouseChargeVatTreatment: string;
  };
  monitoring: {
    domeggookOrderStatus: string;
    carrier: string;
    trackingReference: string;
    gaemiInboundStatus: string;
    gaemiReceivedQuantity: number;
    gaemiDispatchedQuantity: number;
    gaemiStockQuantity: number;
    visibleExceptionStatus: string;
    externalWritePerformed: boolean;
  };
};

test("KK946 remains quarantined after catalog and warehouse setup are verified", () => {
  assert.equal(status.subjectId, "KK946");
  assert.equal(status.disposition, "QUARANTINED");
  assert.equal(status.bindings.supplierCatalogItem, "VERIFIED");
  assert.equal(status.bindings.imageUseRights, "VERIFIED");
  assert.equal(status.bindings.warehouseProductOption, "VERIFIED");
  assert.equal(status.bindings.warehouseInboundApplication, "VERIFIED");
  assert.equal(status.bindings.supplierOrderPaymentComplete, "VERIFIED");
  assert.ok(Object.entries(status.bindings)
    .filter(([key]) => ![
      "supplierCatalogItem",
      "imageUseRights",
      "warehouseProductOption",
      "warehouseInboundApplication",
      "supplierOrderPaymentComplete",
      "inspectionStageImages",
      "fullInspectionCharge",
      "fullInspectionExecution",
      "fullInspectionOutcome",
      "inspectedUnitCoverage",
    ].includes(key))
    .every(([, value]) => value === "UNKNOWN"));
});

test("read-only monitor records exact completed receipt and full-inspection execution", () => {
  assert.equal(status.monitoring.domeggookOrderStatus, "VERIFIED_DELIVERED");
  assert.equal(status.monitoring.carrier, "CJ_LOGISTICS");
  assert.equal(status.monitoring.trackingReference, "540939262870");
  assert.equal(status.monitoring.gaemiInboundStatus, "VERIFIED_COMPLETE");
  assert.equal(status.monitoring.gaemiReceivedQuantity, 6);
  assert.equal(status.monitoring.gaemiDispatchedQuantity, 0);
  assert.equal(status.monitoring.gaemiStockQuantity, 6);
  assert.equal(status.monitoring.visibleExceptionStatus, "NONE_OBSERVED");
  assert.equal(status.monitoring.externalWritePerformed, false);
  assert.match(inboundInspectionPacket, /public item-page promise[\s\S]+not order-level shipment evidence/i);
  assert.match(inboundInspectionPacket, /VERIFIED_CJ_LOGISTICS_540939262870/);
  assert.match(inboundInspectionPacket, /warehouse receipt[\s\S]+`VERIFIED_COMPLETE`/i);
  assert.match(inboundInspectionPacket, /full-inspection service covered the six received units/i);
  assert.equal(status.bindings.inboundLot, "UNKNOWN");
  assert.equal(status.bindings.inspectedUnitCoverage, "VERIFIED_ALL_6_RECEIVED_UNITS");
  assert.equal(status.bindings.inspectedUnitIdentity, "UNKNOWN");
});

test("inbound packet binds receipt and full inspection without moving raw evidence", () => {
  for (const identifier of ["56288849", "OR75260192", "PJ1491663", "A1296915119go"]) {
    assert.match(inboundInspectionPacket, new RegExp(identifier, "i"));
  }
  assert.match(inboundInspectionPacket, /provider full-inspection service covering all six received units/);
  assert.match(inboundInspectionPacket, /length, width, height, unit weight, and package weight/);
  assert.match(inboundInspectionPacket, /must not be\s+downloaded or committed/);
  assert.match(inboundInspectionPacket, /externalWritePerformedByThisMonitor: false/);
  assert.doesNotMatch(
    inboundInspectionPacket,
    /(?:\b01\d-\d{3,4}-\d{4}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/,
  );
});

test("provider stage images support process evidence without inventing itemized outcomes", () => {
  assert.equal(status.bindings.inspectionStageImages, "VERIFIED");
  assert.equal(status.inspectionStageEvidence.productImage, "VERIFIED_PROVIDER_REFERENCE");
  assert.equal(status.inspectionStageEvidence.inboundStart, "VERIFIED_PROVIDER_REFERENCE");
  assert.equal(status.inspectionStageEvidence.subdivisionWork, "VERIFIED_PROVIDER_REFERENCE");
  assert.equal(status.inspectionStageEvidence.storageComplete, "VERIFIED_PROVIDER_REFERENCE");
  assert.equal(status.inspectionStageEvidence.provesSixUnitInspectionOutcome, false);
  assert.equal(status.bindings.fullInspectionExecution, "VERIFIED");
  assert.equal(status.bindings.fullInspectionOutcome, "NO_EXCEPTION_OBSERVED");
  assert.equal(
    status.inspectionStageEvidence.inspectionExecutionBasis,
    "COMPLETED_RECEIPT_PLUS_FULL_INSPECTION_CHARGE_PLUS_NO_EXCEPTION_SIGNAL",
  );
  assert.match(inboundInspectionPacket, /do not show six separately identified units/i);
  assert.match(inboundInspectionPacket, /does not create an itemized quality report/i);
  assert.match(inboundInspectionPacket, /local screenshots[\s\S]+not copied into Git/i);
});

test("actual warehouse charges advance cash evidence without inventing profit", () => {
  assert.equal(status.costEvidence.supplierOrderTotalKrw, 8100);
  assert.equal(status.costEvidence.warehouseInboundUnloadingKrw, 770);
  assert.equal(status.costEvidence.warehouseFullInspectionKrw, 660);
  assert.equal(status.costEvidence.verifiedSampleCashOutflowKrw, 9530);
  assert.equal(status.costEvidence.quantity, 6);
  assert.equal(status.costEvidence.derivedPerUnitApproxKrw, 1588.33);
  assert.equal(
    status.costEvidence.warehouseChargeVatTreatment,
    "VERIFIED_VAT_INCLUSIVE_DEDUCTIBLE",
  );
  assert.equal(
    status.saleSuitability,
    "CONDITIONAL_PASS_PROVIDER_FULL_INSPECTION_COMPLETE_NO_EXCEPTION_OBSERVED",
  );
  assert.equal(
    status.listingEligibility,
    "HOLD_WING_LOGISTICS_AND_SELLER_FACTS_REQUIRED",
  );
  assert.equal(status.profitability.status, "RECOMMEND_ESTIMATED");
  assert.equal(
    status.profitability.policyVersion,
    "gonggamline-profitability-2026-08-12-v2",
  );
  assert.equal(status.profitability.targetSellingPriceKrw, 11800);
  assert.equal(status.profitability.minimumRecommendPriceKrw, 11243);
  assert.equal(status.profitability.operationalRecommendFloorKrw, 11300);
  assert.equal(status.profitability.baseContributionKrw, 3364);
  assert.equal(status.profitability.stressContributionKrw, 2560);
  assert.deepEqual(status.profitability.missingFacts, []);
  assert(!status.profitability.estimatedFacts.includes("wingCurrentCategoryFeeRate"));
  assert.equal(status.profitability.externalPriceWritePerformed, false);
});

test("status manifest proves no raw evidence movement and records the order write", () => {
  assert.equal(status.rawEvidenceMoved, false);
  assert.equal(status.commerceWritePerformed, true);
  assert.equal(status.confidentialEvidenceStore, "NOT_APPROVED");
});

test("runbook binds the complete identity chain and authoritative fact sources", () => {
  assert.match(runbook, /KK946 -> supplier item -> purchased option\/SKU -> inbound lot -> inspected unit/);
  for (const authority of [
    "supplier catalog",
    "purchase order, invoice, or supplier confirmation",
    "3PL inspection",
    "issuer\/manufacturer\/importer document",
    "rights grant",
    "official metadata",
  ]) assert.match(runbook, new RegExp(authority, "i"));
});

test("runbook prohibits sensitive durable state and all external writes", () => {
  assert.match(runbook, /must not receive\s+raw invoices/);
  assert.match(runbook, /do not download a unique local-only copy/);
  assert.match(runbook, /does not authorize purchasing/);
  assert.match(runbook, /performs no live call/);
  assert.match(runbook, /does not authorize a new warehouse instruction or paid inspection/);
});

test("operator return packet is sanitized and never claims verification by default", () => {
  assert.match(runbook, /rawEvidenceMoved: false/);
  assert.match(runbook, /commerceWritePerformed: false/);
  assert.match(runbook, /`VERIFIED` must not be recorded until/);
  assert.doesNotMatch(statusText, /https?:\/\//);
  assert.doesNotMatch(statusText, /(?:phone|address|email|access.?key|secret|authorization)/i);
});

test("authenticated precheck verifies only catalog identity and preserves approval boundaries", () => {
  assert.match(authenticatedPrecheck, /catalogBinding: VERIFIED/);
  assert.match(authenticatedPrecheck, /optionSkuCode: UNKNOWN/);
  assert.match(authenticatedPrecheck, /rawEvidenceMoved: false/);
  assert.match(authenticatedPrecheck, /commerceWritePerformed: true/);
  assert.match(authenticatedPrecheck, /Exact displayed payment total: `8,100 KRW`/);
  assert.match(authenticatedPrecheck, /Supplier inquiry\s+is\s+reserved for exceptions/);
  assert.match(authenticatedPrecheck, /PJ1491663/);
  assert.match(authenticatedPrecheck, /No inbound application, paid inspection/);
  assert.match(authenticatedPrecheck, /A1296915119go/);
  assert.match(authenticatedPrecheck, /pending inbound/);
  assert.match(authenticatedPrecheck, /OR75260192/);
  assert.match(authenticatedPrecheck, /payment complete/);
  assert.doesNotMatch(
    authenticatedPrecheck,
    /(?:\b\d{3}-\d{2}-\d{5}\b|\b01\d-\d{3,4}-\d{4}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/,
  );
});
