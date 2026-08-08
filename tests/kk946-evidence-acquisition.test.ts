import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runbook = readFileSync("docs/runbooks/KK946-EVIDENCE-ACQUISITION-V1.md", "utf8");
const statusText = readFileSync("docs/evidence/kk946-evidence-status-v1.json", "utf8");
const status = JSON.parse(statusText) as {
  subjectId: string;
  disposition: string;
  rawEvidenceMoved: boolean;
  commerceWritePerformed: boolean;
  bindings: Record<string, string>;
  confidentialEvidenceStore: string;
};

test("KK946 remains quarantined with every real identity and evidence binding unknown", () => {
  assert.equal(status.subjectId, "KK946");
  assert.equal(status.disposition, "QUARANTINED");
  assert.ok(Object.values(status.bindings).every((value) => value === "UNKNOWN"));
});

test("status manifest proves no raw evidence movement or commerce write", () => {
  assert.equal(status.rawEvidenceMoved, false);
  assert.equal(status.commerceWritePerformed, false);
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
