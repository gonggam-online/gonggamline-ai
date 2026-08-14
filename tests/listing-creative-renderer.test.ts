import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFixtureCreativeReviewPacket,
  planningInputFromListingContent,
} from "../engines/listing/creative-planner.ts";
import {
  assertExternalProviderApproved,
  DeterministicFixtureCreativeProvider,
  executeCreativeRenderJob,
  renderDeterministicFixturePng,
} from "../engines/listing/creative-renderer.ts";
import { mapApprovedCreativeCandidate } from "../engines/listing/creative-approval.ts";
import {
  evaluateCreativeRenderJobRights,
  evaluateCreativeSourceAuthorization,
} from "../engines/listing/creative-rights.ts";
import { genericListingInput } from "./fixtures/listing-content.ts";

test("deterministic renderer produces actual PNG bytes with computed metadata", async () => {
  const input = planningInputFromListingContent(genericListingInput());
  const packet = await buildFixtureCreativeReviewPacket(input);
  const artifact = packet.candidates[0].artifacts[0];

  assert.equal(packet.schemaVersion, "gonggamline-listing-creative-v3");
  assert.equal(packet.candidates.length, 2);
  assert.equal(artifact.mimeType, "image/png");
  assert.equal(artifact.width, 1000);
  assert.equal(artifact.height, 1000);
  assert.match(artifact.byteDigest, /^[a-f0-9]{64}$/);
  assert.ok(artifact.byteSize > 100);
  assert.match(artifact.previewDataUrl, /^data:image\/png;base64,/);
  assert.equal(artifact.review.decode, "PASS");
  assert.equal(artifact.review.digest, "PASS");
  assert.equal(artifact.review.mime, "PASS");
  assert.equal(artifact.review.dimensions, "PASS");
});

test("fixture artifacts are visibly non-deployable and cannot bind content approval", async () => {
  const packet = await buildFixtureCreativeReviewPacket(
    planningInputFromListingContent(genericListingInput()),
  );

  assert.equal(packet.conversionReadiness, "FIXTURE_PREVIEW");
  assert.equal(packet.selectedCandidateSetId, null);
  assert.equal(packet.contentApproval.approved, false);
  assert.equal(packet.liveWriteApproval.approved, false);
  assert.ok(packet.candidates.flatMap(({ artifacts }) => artifacts).every((artifact) =>
    artifact.deployability === "FIXTURE_ONLY" && artifact.review.deployability === "FAIL"));
  assert.ok(packet.issues.some(({ code }) => code === "REAL_PROVIDER_AND_MANAGED_ASSET_STORE_REQUIRED"));
});

test("render output is deterministic for an immutable job", async () => {
  const input = planningInputFromListingContent(genericListingInput());
  const packet = await buildFixtureCreativeReviewPacket(input);
  const job = packet.candidates[0].renderJobs[0];
  const provider = new DeterministicFixtureCreativeProvider();
  const first = await executeCreativeRenderJob(job, provider);
  const second = await executeCreativeRenderJob(job, provider);

  assert.deepEqual(renderDeterministicFixturePng(job), renderDeterministicFixturePng(job));
  assert.equal(first.byteDigest, second.byteDigest);
  assert.equal(first.byteSize, second.byteSize);
});

test("provider identity must match the immutable render job approval", async () => {
  const packet = await buildFixtureCreativeReviewPacket(planningInputFromListingContent(genericListingInput()));
  const job = packet.candidates[0].renderJobs[0];
  await assert.rejects(
    executeCreativeRenderJob({ ...job, provider: { ...job.provider, providerId: "mismatched-provider" } }, new DeterministicFixtureCreativeProvider()),
    /PROVIDER_APPROVAL_MISMATCH/,
  );
});

test("unapproved external provider configuration fails closed before use", () => {
  assert.throws(() => assertExternalProviderApproved({
    providerKind: "EXTERNAL_IMAGE_PROVIDER",
    providerId: "fixture-unapproved-external",
    modelVersion: "unknown",
    termsVersion: "unknown",
    approvalReference: null,
    paidUsageApproved: false,
    serverSecretApproved: false,
    managedAssetStoreApproved: false,
    outputCommercialUseApproved: false,
  }), /REAL_PROVIDER_NOT_APPROVED/);
});

const verifiedUnchangedRights = {
  commercialUnchangedUse: "VERIFIED",
  marketplaceRedistribution: "VERIFIED",
  technicalReencode: "UNKNOWN",
  resizeResample: "UNKNOWN",
  crop: "UNKNOWN",
  backgroundRemoval: "UNKNOWN",
  textOverlay: "UNKNOWN",
  composite: "UNKNOWN",
  providerUpload: "UNKNOWN",
  generativeReference: "UNKNOWN",
  syntheticOutputCommercialUse: "UNKNOWN",
} as const;

const approvedSupplierSource = {
  assetDigest: "a".repeat(64),
  sourceClass: "APPROVED_SUPPLIER",
  rights: verifiedUnchangedRights,
  grantReference: "fixture:supplier-grant",
  snapshotVersion: "fixture-v1",
  snapshotDigest: "b".repeat(64),
  expiresAt: null,
  revokedAt: null,
} as const;

test("verified unchanged supplier use survives unknown edit capabilities", () => {
  assert.deepEqual(
    evaluateCreativeSourceAuthorization("NONE", approvedSupplierSource, false),
    { allowed: true, code: "RIGHTS_VERIFIED" },
  );
  assert.deepEqual(
    evaluateCreativeSourceAuthorization("CROP", approvedSupplierSource, false),
    { allowed: false, code: "OPERATION_NOT_VERIFIED" },
  );
  assert.deepEqual(
    evaluateCreativeSourceAuthorization("CROP", {
      ...approvedSupplierSource,
      rights: { ...approvedSupplierSource.rights, crop: "VERIFIED" },
    }, false),
    { allowed: true, code: "RIGHTS_VERIFIED" },
  );
});

test("market observation pixels never enter rendering or provider inputs", async () => {
  const packet = await buildFixtureCreativeReviewPacket(planningInputFromListingContent(genericListingInput()));
  const job = packet.candidates[0].renderJobs[0];
  const observation = { ...approvedSupplierSource, sourceClass: "MARKET_OBSERVATION" as const };
  const result = evaluateCreativeRenderJobRights({
    ...job,
    transformation: "GENERATIVE_REFERENCE",
    inputAssetDigests: [observation.assetDigest],
    inputSources: [observation],
  }, true);
  assert.deepEqual(result, { allowed: false, code: "OBSERVATION_PIXELS_PROHIBITED" });
});

test("rights revocation and source digest changes invalidate render authorization", async () => {
  const packet = await buildFixtureCreativeReviewPacket(planningInputFromListingContent(genericListingInput()));
  const job = packet.candidates[0].renderJobs[0];
  assert.equal(evaluateCreativeRenderJobRights({
    ...job,
    transformation: "NONE",
    inputAssetDigests: [approvedSupplierSource.assetDigest],
    inputSources: [{ ...approvedSupplierSource, revokedAt: "2026-08-14T00:00:00.000Z" }],
  }, false).code, "RIGHTS_REVOKED_OR_EXPIRED");
  assert.equal(evaluateCreativeRenderJobRights({
    ...job,
    transformation: "NONE",
    inputAssetDigests: ["c".repeat(64)],
    inputSources: [approvedSupplierSource],
  }, false).code, "INPUT_DIGEST_MISMATCH");
});

test("selected-set mapper rejects fixture artifacts even if caller fabricates approval", async () => {
  const packet = await buildFixtureCreativeReviewPacket(
    planningInputFromListingContent(genericListingInput()),
  );
  const candidate = packet.candidates[0];
  const forged = {
    ...packet,
    selectedCandidateSetId: candidate.candidateSetId,
    contentApproval: {
      ...packet.contentApproval,
      approved: true,
      approvalReference: "fixture:forged-approval",
      boundArtifactDigests: candidate.artifacts.map(({ byteDigest }) => byteDigest),
    },
  };

  assert.equal(mapApprovedCreativeCandidate(forged), null);
});
