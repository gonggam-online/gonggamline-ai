import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExternalCreativeReviewPacket,
  buildFixtureCreativeReviewPacket,
  materializeCreativeFactConstraints,
  planExternalCreativeJobs,
  planningInputFromListingContent,
} from "../engines/listing/creative-planner.ts";
import {
  assertExternalProviderApproved,
  DeterministicFixtureCreativeProvider,
  executeCreativeRenderJob,
  renderDeterministicFixturePng,
  type ListingCreativeProvider,
  type ProviderRenderResult,
} from "../engines/listing/creative-renderer.ts";
import { mapApprovedCreativeCandidate } from "../engines/listing/creative-approval.ts";
import {
  evaluateCreativeRenderJobRights,
  evaluateCreativeSourceAuthorization,
} from "../engines/listing/creative-rights.ts";
import { ManagedListingCreativeStorage } from "../engines/listing/creative-storage.ts";
import {
  InMemoryPrivateListingCreativeObjectStore,
  InMemoryPublicListingCreativeObjectStore,
} from "../engines/listing/creative-storage-fake.ts";
import { generateAndArchiveListingCreative } from "../services/listing-creative-dispatch.service.ts";
import type { CreativeRenderJob } from "../shared/domain/listing-creative.ts";
import {
  genericCommerceFields,
  genericListingInput,
} from "./fixtures/listing-content.ts";

const externalProviderApproval = {
  providerKind: "EXTERNAL_IMAGE_PROVIDER",
  providerId: "fixture-external-provider",
  modelVersion: "fixture-model-v1",
  termsVersion: "fixture-terms-v1",
  approvalReference: "fixture:external-provider-approval",
  paidUsageApproved: true,
  serverSecretApproved: true,
  managedAssetStoreApproved: true,
  outputCommercialUseApproved: true,
} as const;

class FakeExternalProvider implements ListingCreativeProvider {
  readonly approval = externalProviderApproval;
  renderCalls = 0;

  async render(job: CreativeRenderJob): Promise<ProviderRenderResult> {
    this.renderCalls += 1;
    return {
      bytes: renderDeterministicFixturePng(job),
      providerKind: this.approval.providerKind,
      providerId: this.approval.providerId,
      modelVersion: this.approval.modelVersion,
      termsVersion: this.approval.termsVersion,
      durableAssetReference: null,
      execution: {
        operation: "GENERATE",
        requestHash: "a".repeat(64),
        promptDigest: "b".repeat(64),
        requestedAt: "2026-08-14T13:00:00.000Z",
        sanitizedProviderRequestHash: "c".repeat(64),
        quality: "HIGH",
        pricingSnapshotVersion: "fixture-pricing-v1",
        estimatedCostUsd: 0.01,
        actualCostUsd: 0.01,
        usage: {
          inputTextTokens: 10,
          inputImageTokens: 0,
          outputTokens: 20,
          totalTokens: 30,
        },
      },
    };
  }
}

test("creative planning materializes admitted fact values and excludes operational fields", () => {
  const listingInput = genericListingInput();
  const facts = materializeCreativeFactConstraints(listingInput);
  const serialized = facts.constraints.join("\n");
  assert.match(serialized, /field=productName; value=정리 파우치/);
  assert.match(serialized, /field=color; value=네이비/);
  assert.doesNotMatch(serialized, /fixture:catalog:item-01|sourceReference|stock/i);
  assert.deepEqual(facts.factIds, [
    "fixture-fact-1",
    "fixture-fact-2",
    "fixture-fact-3",
    "fixture-fact-4",
    "fixture-fact-5",
  ]);
  assert.throws(
    () => materializeCreativeFactConstraints({
      ...listingInput,
      creativeFactFields: ["companyContactNumber"],
    }),
    /CREATIVE_FACT_FIELDS_INVALID/,
  );
});

test("external planner creates two fact-only candidates at supported GPT Image sizes", () => {
  const planning = planningInputFromListingContent(genericListingInput());
  const jobs = planExternalCreativeJobs(planning, externalProviderApproval);
  assert.equal(jobs.length, 4);
  assert.deepEqual([...new Set(jobs.map(({ candidateSetId }) => candidateSetId))], [
    "creative-a",
    "creative-b",
  ]);
  assert.deepEqual(jobs.map(({ width, height }) => `${width}x${height}`), [
    "1024x1024",
    "1024x1536",
    "1024x1024",
    "1024x1536",
  ]);
  assert.ok(jobs.every((job) =>
    job.transformation === "FACT_ONLY_SYNTHETIC"
    && job.inputAssetDigests.length === 0
    && job.inputSources.length === 0
    && job.factualConstraints.some((constraint) => constraint.includes("value="))));
});

test("external outputs become review-ready but cannot select, approve, or publish themselves", async () => {
  const listingInput = genericListingInput();
  const provider = new FakeExternalProvider();
  const storage = new ManagedListingCreativeStorage(
    new InMemoryPrivateListingCreativeObjectStore(),
    new InMemoryPublicListingCreativeObjectStore(),
  );
  const result = await generateAndArchiveListingCreative({
    listingInput,
    commerce: genericCommerceFields(),
    provider,
    storage,
    occurredAt: "2026-08-14T13:05:00.000Z",
    archiveSequenceStart: 1,
  });
  const packet = result.creative;

  assert.equal(result.listing.status, "REGISTRATION_READY");
  assert.equal(result.archived.length, 4);
  assert.equal(result.privateReviewAssets.length, 4);
  assert.ok(result.privateReviewAssets.every(({ signedReviewUrl }) =>
    signedReviewUrl.startsWith("https://review.invalid/")));
  assert.equal(packet.registrationReadiness, "PASS");
  assert.equal(packet.conversionReadiness, "REVIEW_READY");
  assert.equal(packet.candidates.length, 2);
  assert.equal(packet.selectedCandidateSetId, null);
  assert.equal(packet.contentApproval.approved, false);
  assert.equal(packet.liveWriteApproval.approved, false);
  assert.equal(mapApprovedCreativeCandidate(packet), null);
  assert.ok(packet.candidates.every((candidate) =>
    candidate.artifacts.length === 2
    && candidate.artifacts.some(({ role }) => role === "MAIN")
    && candidate.artifacts.some(({ role }) => role === "DETAIL")));
  assert.ok(packet.issues.some(({ code }) => code === "PRODUCT_REPRESENTATION_REVIEW_REQUIRED"));
  const jobs = packet.candidates.flatMap(({ renderJobs }) => renderJobs);
  const artifacts = packet.candidates.flatMap(({ artifacts: candidateArtifacts }) =>
    candidateArtifacts);
  assert.throws(() => buildExternalCreativeReviewPacket({
    planning: planningInputFromListingContent(listingInput),
    listing: result.listing,
    jobs: jobs.map((job, index) => index === 0
      ? { ...job, inputAssetDigests: ["d".repeat(64)] }
      : job),
    artifacts,
  }), /EXTERNAL_CREATIVE_REVIEW_INPUT_INVALID/);
});

test("dispatch refuses a blocked registration packet before any provider call", async () => {
  const listingInput = genericListingInput();
  const provider = new FakeExternalProvider();
  const storage = new ManagedListingCreativeStorage(
    new InMemoryPrivateListingCreativeObjectStore(),
    new InMemoryPublicListingCreativeObjectStore(),
  );
  await assert.rejects(generateAndArchiveListingCreative({
    listingInput: {
      ...listingInput,
      category: { ...listingInput.category, categoryValid: false, disposition: "QUARANTINED" },
    },
    commerce: genericCommerceFields(),
    provider,
    storage,
    occurredAt: "2026-08-14T13:05:00.000Z",
    archiveSequenceStart: 1,
  }), /LISTING_REGISTRATION_PACKET_NOT_READY/);
  assert.equal(provider.renderCalls, 0);
});

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
