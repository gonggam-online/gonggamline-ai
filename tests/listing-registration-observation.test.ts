import assert from "node:assert/strict";
import test from "node:test";
import { buildListingRegistrationObservation, registrationObservationMetadata } from "../shared/domain/listing-registration-observation";

const digest = "a".repeat(64);

test("registration observation binds WING product to packet/revision and starts learning cold", () => {
  const observation = buildListingRegistrationObservation({
    packetId: "packet-kk946",
    revisionId: "revision-1",
    packetDigest: digest,
    contentDigest: "b".repeat(64),
    selectedVariantId: "variant-a",
    marketplace: "COUPANG_WING",
    sellerProductId: "16350191034",
    registeredAt: "2026-08-18T10:00:00.000Z",
  });
  assert.match(observation.observationId, /^[a-f0-9]{64}$/);
  assert.equal(observation.learningStatus, "AWAITING_TRAFFIC");
  assert.equal(observation.winnerDeclared, false);
  assert.equal(registrationObservationMetadata(observation).sellerProductId, "16350191034");
});

test("registration observation rejects missing or unverifiable binding", () => {
  assert.throws(() => buildListingRegistrationObservation({
    packetId: "packet",
    revisionId: "revision",
    packetDigest: "not-a-digest",
    contentDigest: digest,
    selectedVariantId: "variant-a",
    marketplace: "COUPANG_WING",
    sellerProductId: "16350191034",
    registeredAt: "2026-08-18T10:00:00.000Z",
  }), /SHA-256/);
});
