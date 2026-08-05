import assert from "node:assert/strict";
import test from "node:test";
import { evaluateListingEvidence, hasValidListingEncoding } from "../engines/listing/evidence-policy.ts";
import {
  quarantinedKk946Fixture,
  syntheticKk946Fact,
  syntheticKk946Packet,
} from "./fixtures/listing-evidence.ts";

test("KK946-shaped fixture is explicitly synthetic and deterministic", () => {
  assert.deepEqual(syntheticKk946Packet(), syntheticKk946Packet());
  assert.match(syntheticKk946Packet().facts[0].sourceReference, /^fixture:synthetic-/);
  assert.match(String(syntheticKk946Packet().facts[0].value), /^SYNTHETIC-/);
});

test("real KK946 remains quarantined when required evidence is unknown", () => {
  const decision = evaluateListingEvidence(quarantinedKk946Fixture);
  assert.equal(decision.disposition, "QUARANTINED");
  assert.equal(decision.admittedFacts.length, 0);
  assert.deepEqual(decision.issues.map(({ code }) => code), Array(8).fill("UNKNOWN_REQUIRED_FACT"));
});

test("matching fact-specific authority and scope admits synthetic evidence", () => {
  const decision = evaluateListingEvidence(syntheticKk946Packet());
  assert.equal(decision.disposition, "ADMITTED");
  assert.equal(decision.issues.length, 0);
  assert.equal(decision.admittedFacts.length, 1);
});

test("transaction authority cannot replace catalog identity globally", () => {
  const fact = syntheticKk946Fact({ sourceType: "TRANSACTION" });
  const decision = evaluateListingEvidence(syntheticKk946Packet({ facts: [fact] }));
  assert.equal(decision.disposition, "QUARANTINED");
  assert.ok(decision.issues.some(({ code }) => code === "WRONG_AUTHORITY"));
});

test("sample observation cannot prove a lot-wide fact", () => {
  const fact = syntheticKk946Fact({
    factClass: "PHYSICAL_OBSERVATION",
    sourceType: "THREE_PL_INSPECTION",
    scope: "CATALOG_ITEM",
  });
  const decision = evaluateListingEvidence(syntheticKk946Packet({ facts: [fact] }));
  assert.ok(decision.issues.some(({ code }) => code === "SCOPE_MISMATCH"));
});

test("conflicting proven values are retained but never admitted", () => {
  const facts = [
    syntheticKk946Fact({ factId: "synthetic-a", value: "SYNTHETIC-A" }),
    syntheticKk946Fact({ factId: "synthetic-b", value: "SYNTHETIC-B" }),
  ];
  const decision = evaluateListingEvidence(syntheticKk946Packet({ facts }));
  assert.equal(decision.disposition, "QUARANTINED");
  assert.equal(decision.admittedFacts.length, 0);
  assert.ok(decision.issues.some(({ code }) => code === "CONFLICTING_FACTS"));
});

test("use permission does not imply edit permission", () => {
  const useRight = syntheticKk946Fact({
    factId: "synthetic-use-right",
    field: "imageUseRights",
    factClass: "IMAGE_USE_RIGHT",
    sourceType: "RIGHTS_GRANT",
    scope: "ASSET",
    scopeReference: "synthetic:asset:sha256:aaaa",
  });
  const packet = syntheticKk946Packet({ facts: [useRight], requiredFields: ["imageUseRights", "imageEditRights"] });
  const decision = evaluateListingEvidence(packet);
  assert.equal(decision.disposition, "QUARANTINED");
  assert.ok(decision.issues.some(({ field, code }) => field === "imageEditRights" && code === "UNKNOWN_REQUIRED_FACT"));
});

test("stale evidence and malformed digest fail closed", () => {
  const fact = syntheticKk946Fact({ validUntil: "2026-08-04T00:00:00.000Z", evidenceDigest: "not-a-digest" });
  const decision = evaluateListingEvidence(syntheticKk946Packet({ facts: [fact] }));
  assert.deepEqual(new Set(decision.issues.map(({ code }) => code)), new Set(["INVALID_EVIDENCE", "STALE_EVIDENCE"]));
});

test("encoding gate accepts NFC Korean and rejects replacement or mixed normalization", () => {
  assert.equal(hasValidListingEncoding("합성 상품명"), true);
  assert.equal(hasValidListingEncoding("깨진\uFFFD문자"), false);
  assert.equal(hasValidListingEncoding("가".normalize("NFD")), false);
});
