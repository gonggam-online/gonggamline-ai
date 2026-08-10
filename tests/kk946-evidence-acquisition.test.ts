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
  monitoring: {
    domeggookOrderStatus: string;
    gaemiInboundStatus: string;
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
    ].includes(key))
    .every(([, value]) => value === "UNKNOWN"));
});

test("read-only monitor distinguishes authentication gaps from shipment evidence", () => {
  assert.equal(status.monitoring.domeggookOrderStatus, "NOT_CHECKED_AUTH_REQUIRED");
  assert.equal(status.monitoring.gaemiInboundStatus, "VERIFIED_PENDING");
  assert.equal(status.monitoring.externalWritePerformed, false);
  assert.match(inboundInspectionPacket, /public item-page promise[\s\S]+not order-level shipment evidence/i);
  assert.match(inboundInspectionPacket, /DOMEGGOOK_AUTH_REQUIRED_FOR_ORDER_STATUS/);
});

test("inbound packet binds receipt and full inspection without moving raw evidence", () => {
  for (const identifier of ["56288849", "OR75260192", "PJ1491663", "A1296915119go"]) {
    assert.match(inboundInspectionPacket, new RegExp(identifier, "i"));
  }
  assert.match(inboundInspectionPacket, /each inspected unit \(1\.\.6\)/);
  assert.match(inboundInspectionPacket, /length, width, height, unit weight, and package weight/);
  assert.match(inboundInspectionPacket, /must not be\s+downloaded or committed/);
  assert.match(inboundInspectionPacket, /externalWritePerformedByThisMonitor: false/);
  assert.doesNotMatch(
    inboundInspectionPacket,
    /(?:\b01\d-\d{3,4}-\d{4}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/,
  );
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
