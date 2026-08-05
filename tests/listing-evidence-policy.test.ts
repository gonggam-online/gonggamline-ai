import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeValidUtf8,
  evaluateListingEvidence,
  hasValidListingEncoding,
} from "../engines/listing/evidence-policy.ts";
import {
  syntheticKk946Fact,
  syntheticKk946Packet,
  unknownKk946ShapedFixture,
} from "./fixtures/listing-evidence.ts";

test("KK946-shaped fixture is explicitly synthetic and deterministic", () => {
  assert.deepEqual(syntheticKk946Packet(), syntheticKk946Packet());
  assert.match(syntheticKk946Packet().subjectId, /^SYNTHETIC-/);
  assert.match(syntheticKk946Packet().facts[0].sourceReference, /synthetic/);
  assert.match(String(syntheticKk946Packet().facts[0].value), /^SYNTHETIC-/);
});

test("unknown KK946-shaped evidence remains quarantined", () => {
  const decision = evaluateListingEvidence(unknownKk946ShapedFixture);
  assert.equal(decision.disposition, "QUARANTINED");
  assert.deepEqual(decision.admittedFacts, []);
  assert.equal(
    decision.issues.filter(({ code }) => code === "UNKNOWN_REQUIRED_FACT").length,
    8,
  );
});

test("matching fact-specific authority and scope admits synthetic evidence", () => {
  const decision = evaluateListingEvidence(syntheticKk946Packet());
  assert.equal(decision.disposition, "ADMITTED");
  assert.equal(decision.issues.length, 0);
  assert.equal(decision.admittedFacts.length, 1);
});

test("transaction evidence cannot globally replace catalog authority", () => {
  const fact = syntheticKk946Fact({ sourceType: "TRANSACTION" });
  const decision = evaluateListingEvidence(
    syntheticKk946Packet({ facts: [fact] }),
  );
  assert.ok(decision.issues.some(({ code }) => code === "WRONG_AUTHORITY"));
  assert.equal(decision.disposition, "QUARANTINED");
});

test("an inspected sample cannot prove a catalog- or lot-wide fact", () => {
  const fact = syntheticKk946Fact({
    factClass: "PHYSICAL_OBSERVATION",
    sourceType: "THREE_PL_INSPECTION",
    scope: "CATALOG_ITEM",
  });
  const decision = evaluateListingEvidence(
    syntheticKk946Packet({ facts: [fact] }),
  );
  assert.ok(decision.issues.some(({ code }) => code === "SCOPE_MISMATCH"));
});

test("conflicting proven values are retained as issues but never admitted", () => {
  const facts = [
    syntheticKk946Fact({ factId: "synthetic-a", value: "SYNTHETIC-A" }),
    syntheticKk946Fact({ factId: "synthetic-b", value: "SYNTHETIC-B" }),
  ];
  const decision = evaluateListingEvidence(
    syntheticKk946Packet({ facts }),
  );
  assert.equal(decision.disposition, "QUARANTINED");
  assert.deepEqual(decision.admittedFacts, []);
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
  const decision = evaluateListingEvidence(syntheticKk946Packet({
    facts: [useRight],
    requiredFields: ["imageUseRights", "imageEditRights"],
  }));
  assert.ok(decision.issues.some(
    ({ field, code }) =>
      field === "imageEditRights" && code === "UNKNOWN_REQUIRED_FACT",
  ));
});

test("prohibited, stale, and malformed evidence fail closed", () => {
  const prohibited = syntheticKk946Fact({ status: "PROHIBITED" });
  const stale = syntheticKk946Fact({
    factId: "synthetic-stale",
    validUntil: "2026-08-04T00:00:00.000Z",
    evidenceDigest: "not-a-digest",
  });
  const decision = evaluateListingEvidence(
    syntheticKk946Packet({ facts: [prohibited, stale] }),
  );
  assert.deepEqual(
    new Set(decision.issues.map(({ code }) => code)),
    new Set([
      "INVALID_EVIDENCE",
      "PROHIBITED_FACT",
      "STALE_EVIDENCE",
    ]),
  );
});

test("encoding checks accept NFC Korean and reject invalid bytes and mojibake", () => {
  assert.equal(hasValidListingEncoding("합성 상품명"), true);
  assert.equal(hasValidListingEncoding("가".normalize("NFD")), false);
  assert.equal(hasValidListingEncoding("깨진\uFFFD문자"), false);
  assert.equal(hasValidListingEncoding("Ã©"), false);
  assert.equal(decodeValidUtf8(Uint8Array.from([0xc3, 0x28])), null);
  assert.equal(
    decodeValidUtf8(new TextEncoder().encode("합성 상품명")),
    "합성 상품명",
  );
});

test("invalid packet identity fails closed deterministically", () => {
  const packet = syntheticKk946Packet({ evaluationId: "", evaluatedAt: "bad" });
  const first = evaluateListingEvidence(packet);
  const second = evaluateListingEvidence(packet);
  assert.deepEqual(first, second);
  assert.equal(first.disposition, "QUARANTINED");
  assert.ok(first.issues.some(
    ({ code, field }) => code === "INVALID_EVIDENCE" && field === "$packet",
  ));
});
