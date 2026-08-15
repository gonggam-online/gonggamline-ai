import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  attachProductRepresentationReview,
  createProductRepresentationReview,
} from "../engines/listing/creative-artifact-review.ts";
import {
  createDigestBoundCreativeApproval,
  creativeCandidateDetailPackageDigest,
  mapApprovedCreativeCandidate,
  mapCreativePublicationApproval,
} from "../engines/listing/creative-approval.ts";
import {
  listingCreativeRegistrationBinding,
  listingRegistrationFilterSetDigest,
  mapApprovedCreativeRegistrationPayload,
} from "../engines/listing/creative-registration-mapper.ts";
import {
  buildFixtureCreativeReviewPacket,
  planningInputFromListingContent,
} from "../engines/listing/creative-planner.ts";
import {
  inspectCreativeArtifactBytes,
  renderDeterministicFixturePng,
  type ListingCreativeProvider,
  type ProviderRenderResult,
} from "../engines/listing/creative-renderer.ts";
import {
  ManagedListingCreativeStorage,
  type CreativeObjectLocation,
  type PublicListingCreativeObjectStore,
} from "../engines/listing/creative-storage.ts";
import {
  InMemoryPrivateListingCreativeObjectStore,
  InMemoryPublicListingCreativeObjectStore,
} from "../engines/listing/creative-storage-fake.ts";
import { buildListingContentPacket } from "../engines/listing/content-pipeline.ts";
import {
  executeAndArchiveCreativeRender,
  executeAndArchiveCreativeRenders,
} from "../services/listing-creative-render.service.ts";
import { publishSelectedCreativeCandidate } from "../services/listing-creative-publication.service.ts";
import type {
  CreativeProviderApproval,
  CreativeRenderJob,
  ListingCreativeReviewPacket,
  RenderedCreativeArtifact,
} from "../shared/domain/listing-creative.ts";
import type { ArchivedListingCreativeAsset } from "../shared/domain/listing-creative-storage.ts";
import {
  genericCommerceFields,
  genericListingInput,
} from "./fixtures/listing-content.ts";

const EXTERNAL_APPROVAL: CreativeProviderApproval = Object.freeze({
  providerKind: "EXTERNAL_IMAGE_PROVIDER",
  providerId: "fixture-external-image-provider",
  modelVersion: "fixture-model-2026-08-14",
  termsVersion: "fixture-commercial-terms-v1",
  approvalReference: "fixture:provider-approval",
  paidUsageApproved: true,
  serverSecretApproved: true,
  managedAssetStoreApproved: true,
  outputCommercialUseApproved: true,
});

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

class FakeExternalImageProvider implements ListingCreativeProvider {
  readonly approval = EXTERNAL_APPROVAL;

  async render(job: CreativeRenderJob): Promise<ProviderRenderResult> {
    const bytes = renderDeterministicFixturePng(job);
    return {
      bytes,
      providerKind: EXTERNAL_APPROVAL.providerKind,
      providerId: EXTERNAL_APPROVAL.providerId,
      modelVersion: EXTERNAL_APPROVAL.modelVersion,
      termsVersion: EXTERNAL_APPROVAL.termsVersion,
      durableAssetReference: null,
      execution: {
        operation: "GENERATE",
        requestHash: sha(`request:${job.jobId}`),
        promptDigest: sha(`prompt:${job.jobId}`),
        requestedAt: "2026-08-14T11:00:00.000Z",
        sanitizedProviderRequestHash: sha(`provider:${job.jobId}`),
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

class ConcurrentProbeProvider extends FakeExternalImageProvider {
  active = 0;
  maximumActive = 0;

  override async render(job: CreativeRenderJob): Promise<ProviderRenderResult> {
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return await super.render(job);
    } finally {
      this.active -= 1;
    }
  }
}

class FailSecondPublicStore implements PublicListingCreativeObjectStore {
  private readonly objects = new Map<string, Uint8Array>();
  private putCount = 0;

  get remainingCount(): number {
    return this.objects.size;
  }

  async putImmutable(
    pathname: string,
    bytes: Uint8Array,
  ): Promise<CreativeObjectLocation> {
    this.putCount += 1;
    if (this.putCount === 2) throw new Error("FIXTURE_SECOND_PUBLICATION_FAILED");
    this.objects.set(pathname, Uint8Array.from(bytes));
    return { pathname, reference: `https://public.invalid/${pathname}` };
  }

  async read(pathname: string): Promise<Uint8Array | null> {
    const bytes = this.objects.get(pathname);
    return bytes ? Uint8Array.from(bytes) : null;
  }

  async remove(pathname: string): Promise<void> {
    this.objects.delete(pathname);
  }
}

function passReview(artifact: RenderedCreativeArtifact) {
  return createProductRepresentationReview({
    reviewReference: `fixture:product-review:${artifact.artifactId}`,
    reviewerReference: "fixture:human-reviewer",
    reviewedAt: "2026-08-14T11:10:00.000Z",
    reviewedArtifactDigest: artifact.byteDigest,
    productIdentity: "PASS",
    color: "PASS",
    quantity: "PASS",
    dimensionsAndScale: "PASS",
    material: "PASS",
    components: "PASS",
    optionConsistency: "PASS",
    prohibitedMarks: "PASS",
    unsupportedClaims: "PASS",
    crop: "PASS",
    encoding: "PASS",
    load: "PASS",
  });
}

async function approvedFixture(
  publicStore: PublicListingCreativeObjectStore = new InMemoryPublicListingCreativeObjectStore(),
): Promise<Readonly<{
  packet: ListingCreativeReviewPacket;
  archived: readonly ArchivedListingCreativeAsset[];
  storage: ManagedListingCreativeStorage;
}>> {
  const listingInput = genericListingInput();
  const listing = buildListingContentPacket(listingInput, genericCommerceFields());
  const filterSetDigest = listingRegistrationFilterSetDigest(listing);
  assert.ok(filterSetDigest);
  const packet = await buildFixtureCreativeReviewPacket(
    planningInputFromListingContent(listingInput),
  );
  const selected = packet.candidates[0];
  const privateStore = new InMemoryPrivateListingCreativeObjectStore();
  const storage = new ManagedListingCreativeStorage(privateStore, publicStore);
  const provider = new FakeExternalImageProvider();
  const artifacts: RenderedCreativeArtifact[] = [];
  const archived: ArchivedListingCreativeAsset[] = [];
  for (const [index, fixtureJob] of selected.renderJobs.entries()) {
    const job = Object.freeze({ ...fixtureJob, provider: EXTERNAL_APPROVAL });
    const result = await executeAndArchiveCreativeRender({
      job,
      provider,
      storage,
      revisionDigest: packet.revisionId,
      occurredAt: "2026-08-14T11:05:00.000Z",
      archiveSequence: index + 1,
    });
    artifacts.push(attachProductRepresentationReview(result.artifact, passReview(result.artifact)));
    archived.push(result.archived);
  }
  const reviewedCandidate = Object.freeze({
    ...selected,
    filterSetDigest,
    renderJobs: Object.freeze(selected.renderJobs.map((job) => ({ ...job, provider: EXTERNAL_APPROVAL }))),
    artifacts: Object.freeze(artifacts),
  });
  const detailPackageDigest = creativeCandidateDetailPackageDigest(reviewedCandidate);
  assert.ok(detailPackageDigest);
  const digestBoundCandidate = Object.freeze({ ...reviewedCandidate, detailPackageDigest });
  const selectedPacket: ListingCreativeReviewPacket = Object.freeze({
    ...packet,
    selectedCandidateSetId: digestBoundCandidate.candidateSetId,
    candidates: Object.freeze([digestBoundCandidate, packet.candidates[1]]),
    conversionReadiness: "OPTIMIZATION_PENDING",
  });
  const contentApproval = createDigestBoundCreativeApproval(selectedPacket, {
    reviewerReference: "fixture:content-reviewer",
    approvalReference: "fixture:content-approval",
    approvedAt: "2026-08-14T11:15:00.000Z",
  });
  assert.ok(contentApproval);
  return {
    packet: Object.freeze({ ...selectedPacket, contentApproval }),
    archived: Object.freeze(archived),
    storage,
  };
}

test("actual-byte QA rejects corrupt PNG CRC or trailing bytes", () => {
  const input = planningInputFromListingContent(genericListingInput());
  const fixtureJob: CreativeRenderJob = {
    jobId: "fixture-corrupt-png",
    candidateSetId: "creative-a",
    subjectReference: input.subjectReference,
    role: "MAIN",
    shotType: "PACKSHOT",
    transformation: "FACT_ONLY_SYNTHETIC",
    inputAssetDigests: [],
    inputSources: [],
    factIds: input.provenFactIds,
    width: 1000,
    height: 1000,
    mimeType: "image/png",
    altText: "손상 검증용 합성 이미지",
    factualConstraints: input.factualConstraints,
    renderRecipeVersion: "fixture-corrupt-v1",
    provider: EXTERNAL_APPROVAL,
  };
  const valid = renderDeterministicFixturePng(fixtureJob);
  assert.equal(inspectCreativeArtifactBytes(valid).pngStructure, "PASS");
  const crcCorrupt = Uint8Array.from(valid);
  crcCorrupt[29] ^= 0xff;
  assert.equal(inspectCreativeArtifactBytes(crcCorrupt).pngStructure, "FAIL");
  const trailing = Uint8Array.from([...valid, 0]);
  assert.equal(inspectCreativeArtifactBytes(trailing).pngStructure, "FAIL");
});

test("reserved creative jobs archive concurrently in deterministic input order", async () => {
  const planning = planningInputFromListingContent(genericListingInput());
  const packet = await buildFixtureCreativeReviewPacket(planning);
  const candidate = packet.candidates[0];
  const privateStore = new InMemoryPrivateListingCreativeObjectStore();
  const storage = new ManagedListingCreativeStorage(
    privateStore,
    new InMemoryPublicListingCreativeObjectStore(),
  );
  const provider = new ConcurrentProbeProvider();
  const jobs = candidate.renderJobs.map((job) => Object.freeze({
    ...job,
    provider: EXTERNAL_APPROVAL,
  }));

  const results = await executeAndArchiveCreativeRenders({
    jobs,
    provider,
    storage,
    revisionDigest: packet.revisionId,
    occurredAt: "2026-08-14T11:05:00.000Z",
    archiveSequenceStart: 40,
  });

  assert.equal(results.length, jobs.length);
  assert.ok(provider.maximumActive > 1);
  assert.deepEqual(
    results.map(({ artifact }) => `${artifact.candidateSetId}:${artifact.role}`),
    jobs.map(({ candidateSetId, role }) => `${candidateSetId}:${role}`),
  );
  assert.deepEqual(
    results.map(({ archived }) => archived.manifest.event.sequence),
    jobs.map((_, index) => 40 + index),
  );
});

test("human product review must pass every factual and visual gate", async () => {
  const { packet } = await approvedFixture();
  const artifact = packet.candidates[0].artifacts[0];
  const passing = passReview(artifact);
  const failed = createProductRepresentationReview({
    reviewReference: "fixture:failed-review",
    reviewerReference: passing.reviewerReference,
    reviewedAt: passing.reviewedAt,
    reviewedArtifactDigest: passing.reviewedArtifactDigest,
    productIdentity: passing.productIdentity,
    color: "FAIL",
    quantity: passing.quantity,
    dimensionsAndScale: passing.dimensionsAndScale,
    material: passing.material,
    components: passing.components,
    optionConsistency: passing.optionConsistency,
    prohibitedMarks: passing.prohibitedMarks,
    unsupportedClaims: passing.unsupportedClaims,
    crop: passing.crop,
    encoding: passing.encoding,
    load: passing.load,
  });
  assert.throws(
    () => attachProductRepresentationReview({ ...artifact, productRepresentationReview: null }, failed),
    /PRODUCT_REPRESENTATION_REVIEW_REQUIRED/,
  );
  assert.throws(
    () => attachProductRepresentationReview(
      { ...artifact, productRepresentationReview: null },
      { ...passing, reviewerReference: "fixture:forged-reviewer" },
    ),
    /PRODUCT_REPRESENTATION_REVIEW_REQUIRED/,
  );
});

test("canonical approval binds every artifact, human review, provider, policy and revision digest", async () => {
  const { packet } = await approvedFixture();
  assert.ok(mapCreativePublicationApproval(packet));
  assert.match(packet.contentApproval.approvalDigest ?? "", /^[a-f0-9]{64}$/);
  assert.equal(mapCreativePublicationApproval({ ...packet, policyDigest: sha("changed-policy") }), null);
  assert.equal(mapCreativePublicationApproval({ ...packet, revisionId: sha("changed-revision") }), null);
  const selected = packet.candidates[0];
  assert.equal(mapCreativePublicationApproval({
    ...packet,
    candidates: [{ ...selected, artifacts: selected.artifacts.slice(1) }, packet.candidates[1]],
  }), null);
});

test("only the approved selected set publishes and maps public refs", async () => {
  const { packet, archived, storage } = await approvedFixture();
  await assert.rejects(
    publishSelectedCreativeCandidate({
      packet,
      archived: [...archived, archived[0]],
      storage,
      occurredAt: "2026-08-14T11:19:00.000Z",
      approvalSequenceStart: 4,
      publicationSequenceStart: 5,
    }),
    /SELECTED_CREATIVE_PUBLICATION_NOT_APPROVED/,
  );
  const publishedPacket = await publishSelectedCreativeCandidate({
    packet,
    archived,
    storage,
    occurredAt: "2026-08-14T11:20:00.000Z",
    approvalSequenceStart: 10,
    publicationSequenceStart: 11,
  });
  const approved = mapApprovedCreativeCandidate(publishedPacket);
  assert.ok(approved);
  assert.equal(approved.artifacts.length, 2);
  assert.ok(approved.artifacts.every(({ publicAssetReference }) =>
    publicAssetReference?.startsWith("https://public.invalid/")));
  assert.ok(approved.artifacts.every(({ publicAssetReference }) =>
    !publicAssetReference?.startsWith("supabase-storage://")));

  const listing = buildListingContentPacket(genericListingInput(), genericCommerceFields());
  assert.equal(listing.status, "REGISTRATION_READY");
  const candidate = publishedPacket.candidates[0];
  const binding = listingCreativeRegistrationBinding({
    listing,
    creative: publishedPacket,
    titleCandidateId: candidate.titleCandidateId,
    keywordCandidateId: candidate.keywordCandidateId,
    detailPackageDigest: candidate.detailPackageDigest,
  });
  const mapped = mapApprovedCreativeRegistrationPayload({ listing, creative: publishedPacket, binding });
  assert.ok(mapped);
  const serialized = JSON.stringify(mapped.payload);
  assert.match(serialized, /https:\/\/public\.invalid\//);
  assert.doesNotMatch(serialized, /supabase-storage:|data:image|creative-b/);
  assert.equal(mapApprovedCreativeRegistrationPayload({
    listing,
    creative: publishedPacket,
    binding: { ...binding, filterSetDigest: sha("stale-filter-set") },
  }), null);
  assert.equal(mapApprovedCreativeRegistrationPayload({
    listing,
    creative: publishedPacket,
    binding: { ...binding, detailPackageDigest: sha("stale-detail-package") },
  }), null);
});

test("partial selected-set publication is taken down before failure returns", async () => {
  const publicStore = new FailSecondPublicStore();
  const { packet, archived, storage } = await approvedFixture(publicStore);
  await assert.rejects(
    publishSelectedCreativeCandidate({
      packet,
      archived,
      storage,
      occurredAt: "2026-08-14T11:20:00.000Z",
      approvalSequenceStart: 30,
      publicationSequenceStart: 31,
    }),
    /FIXTURE_SECOND_PUBLICATION_FAILED/,
  );
  assert.equal(publicStore.remainingCount, 0);
});

test("creative mapper preserves the separate live-write approval boundary", async () => {
  const { packet, archived, storage } = await approvedFixture();
  const publishedPacket = await publishSelectedCreativeCandidate({
    packet,
    archived,
    storage,
    occurredAt: "2026-08-14T11:20:00.000Z",
    approvalSequenceStart: 20,
    publicationSequenceStart: 21,
  });
  const commerce = {
    ...genericCommerceFields(),
    liveWriteApproval: { approved: false, approvalReference: "" },
  };
  const listing = buildListingContentPacket(genericListingInput(), commerce);
  const candidate = publishedPacket.candidates[0];
  const binding = listingCreativeRegistrationBinding({
    listing,
    creative: publishedPacket,
    titleCandidateId: candidate.titleCandidateId,
    keywordCandidateId: candidate.keywordCandidateId,
    detailPackageDigest: candidate.detailPackageDigest,
  });
  assert.equal(mapApprovedCreativeRegistrationPayload({ listing, creative: publishedPacket, binding }), null);
});

test("generic production QA and mapper sources contain no KK946 fixture values", async () => {
  const sources = await Promise.all([
    "engines/listing/creative-artifact-review.ts",
    "engines/listing/creative-approval.ts",
    "engines/listing/creative-registration-mapper.ts",
    "engines/listing/creative-renderer.ts",
    "services/listing-creative-render.service.ts",
    "services/listing-creative-publication.service.ts",
    "components/listing/listing-creative-review.tsx",
  ].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  const productionSource = sources.join("\n");
  assert.doesNotMatch(productionSource, /KK946|4,290|4290|Domeggook|도매꾹/i);
  assert.doesNotMatch(productionSource, /\uFFFD/);
  assert.match(productionSource, /실제 provider 출력/);
});
