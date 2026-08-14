import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CreativeStorageError,
  ManagedListingCreativeStorage,
  listingCreativeObjectPath,
  listingCreativeSubjectHash,
  type PublicListingCreativeObjectStore,
} from "../engines/listing/creative-storage.ts";
import { digestCanonicalJson } from "../engines/listing/category-snapshot.ts";
import {
  DeterministicFixtureCreativeProvider,
  inspectCreativeArtifactBytes,
  renderDeterministicFixturePng,
} from "../engines/listing/creative-renderer.ts";
import {
  InMemoryPrivateListingCreativeObjectStore,
  InMemoryPublicListingCreativeObjectStore,
} from "../engines/listing/creative-storage-fake.ts";
import type {
  ListingCreativeArtifactDescriptor,
  ListingCreativePublicationApproval,
} from "../shared/domain/listing-creative-storage.ts";
import type { CreativeRenderJob } from "../shared/domain/listing-creative.ts";

const OCCURRED_AT = "2026-08-14T09:30:00.000Z";
const REVISION_DIGEST = createHash("sha256").update("synthetic-revision-v1").digest("hex");
const JOB_DIGEST = createHash("sha256").update("synthetic-job-v1").digest("hex");
const FIXTURE_PROVIDER = new DeterministicFixtureCreativeProvider();
const STORAGE_RENDER_JOB: CreativeRenderJob = {
  jobId: "fixture-storage-main",
  candidateSetId: "creative-a",
  subjectReference: "fixture:synthetic-organizer:001",
  role: "MAIN",
  shotType: "PACKSHOT",
  transformation: "FACT_ONLY_SYNTHETIC",
  inputAssetDigests: [],
  inputSources: [],
  factIds: ["fixture:identity"],
  width: 1000,
  height: 1000,
  mimeType: "image/png",
  altText: "합성 저장소 검증 이미지",
  factualConstraints: ["identity"],
  renderRecipeVersion: "fixture-storage-v1",
  provider: FIXTURE_PROVIDER.approval,
};
const BYTES = renderDeterministicFixturePng(STORAGE_RENDER_JOB);
const BYTE_INSPECTION = inspectCreativeArtifactBytes(BYTES);
const BYTE_DIGEST = createHash("sha256").update(BYTES).digest("hex");

function descriptor(
  overrides: Partial<ListingCreativeArtifactDescriptor> = {},
): ListingCreativeArtifactDescriptor {
  return {
    subjectReference: "fixture:synthetic-organizer:001",
    revisionDigest: REVISION_DIGEST,
    candidateSetId: "creative-a",
    artifactId: "fixture-main-a",
    role: "MAIN",
    byteDigest: BYTE_DIGEST,
    byteSize: BYTES.byteLength,
    width: BYTE_INSPECTION.width,
    height: BYTE_INSPECTION.height,
    mimeType: "image/png",
    computedQaDigest: BYTE_INSPECTION.computedQaDigest,
    ...overrides,
  };
}

function approval(
  overrides: Partial<ListingCreativePublicationApproval> = {},
): ListingCreativePublicationApproval {
  const base = {
    contentApproved: true,
    packetId: "fixture:storage-packet",
    approvalReference: "approval:fixture-content-review:001",
    reviewerReference: "fixture:storage-reviewer",
    approvedAt: OCCURRED_AT,
    selectedCandidateSetId: "creative-a",
    boundRevisionDigest: REVISION_DIGEST,
    boundArtifactDigests: [BYTE_DIGEST],
    boundProductReviewDigests: ["d".repeat(64)],
    boundProviderExecutionDigests: ["a".repeat(64)],
    boundEvidenceEvaluationId: "fixture:evidence-evaluation",
    boundPolicyDigest: "e".repeat(64),
    boundCategoryMetadataDigest: "f".repeat(64),
    boundTitleCandidateId: "title-a",
    boundKeywordCandidateId: "keywords-a",
    boundFilterSetDigest: "b".repeat(64),
    boundDetailPackageDigest: "1".repeat(64),
    boundRenderRecipeVersions: ["fixture-storage-v1"],
  } as const;
  const merged = { ...base, ...overrides };
  const contentApprovalDigest = overrides.contentApprovalDigest ?? digestCanonicalJson({
    schemaVersion: "gonggamline-listing-creative-content-approval-v1",
    packetId: merged.packetId,
    reviewerReference: merged.reviewerReference,
    approvalReference: merged.approvalReference,
    approvedAt: merged.approvedAt,
    boundArtifactDigests: merged.boundArtifactDigests,
    boundProductReviewDigests: merged.boundProductReviewDigests,
    boundProviderExecutionDigests: merged.boundProviderExecutionDigests,
    boundEvidenceEvaluationId: merged.boundEvidenceEvaluationId,
    boundPolicyDigest: merged.boundPolicyDigest,
    boundCategoryMetadataDigest: merged.boundCategoryMetadataDigest,
    boundCandidateSetId: merged.selectedCandidateSetId,
    boundTitleCandidateId: merged.boundTitleCandidateId,
    boundKeywordCandidateId: merged.boundKeywordCandidateId,
    boundFilterSetDigest: merged.boundFilterSetDigest,
    boundDetailPackageDigest: merged.boundDetailPackageDigest,
    boundRenderRecipeVersions: merged.boundRenderRecipeVersions,
    boundRevisionId: merged.boundRevisionDigest,
  }) ?? "";
  return { ...merged, contentApprovalDigest };
}

function storage() {
  const privateStore = new InMemoryPrivateListingCreativeObjectStore();
  const publicStore = new InMemoryPublicListingCreativeObjectStore();
  return {
    privateStore,
    publicStore,
    service: new ManagedListingCreativeStorage(privateStore, publicStore),
  };
}

async function rejectsCode(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) =>
    error instanceof CreativeStorageError && error.code === code);
}

test("creative object keys are generic, immutable, and hide the subject reference", () => {
  const input = descriptor();
  const pathname = listingCreativeObjectPath(input);
  assert.equal(listingCreativeSubjectHash(input.subjectReference).length, 64);
  assert.equal(pathname, `v1/${listingCreativeSubjectHash(input.subjectReference)}/${REVISION_DIGEST}/main/${BYTE_DIGEST}.png`);
  assert.doesNotMatch(pathname, /synthetic-organizer|fixture-main|creative-a/);
});

test("a generation reservation is append-only and duplicate dispatch fails before provider spend", async () => {
  const { service, privateStore } = storage();
  const input = {
    context: descriptor(),
    jobDigest: JOB_DIGEST,
    occurredAt: OCCURRED_AT,
    sequence: 0,
  } as const;
  const reserved = await service.reserveGeneration(input);
  assert.equal(reserved.event.state, "RESERVED");
  assert.match(reserved.eventDigest, /^[a-f0-9]{64}$/);
  await rejectsCode(service.reserveGeneration(input), "DUPLICATE_GENERATION_RESERVATION");
  assert.equal(privateStore.operations.filter(({ operation }) => operation === "PUT").length, 1);
});

test("archive computes the byte contract, writes the private master, and creates a signed review URL", async () => {
  const { service, publicStore } = storage();
  const archived = await service.archive({
    descriptor: descriptor(),
    bytes: BYTES,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  });
  assert.equal(archived.manifest.event.state, "ARCHIVED");
  assert.equal(archived.manifest.event.width, 1000);
  assert.equal(archived.manifest.event.height, 1000);
  assert.equal(archived.manifest.event.mimeType, "image/png");
  assert.equal(archived.manifest.event.computedQaDigest, BYTE_INSPECTION.computedQaDigest);
  assert.match(archived.privateMasterReference, /^memory-private:\/\//);
  assert.equal(archived.objectPath, listingCreativeObjectPath(descriptor()));
  assert.match(await service.createSignedReviewUrl(archived, 300), /^https:\/\/review\.invalid\//);
  assert.equal(publicStore.operations.length, 0);
});

test("archive fails closed on caller-claimed digest or byte-size mismatch", async () => {
  const { service } = storage();
  await rejectsCode(service.archive({
    descriptor: descriptor({ byteDigest: "0".repeat(64) }),
    bytes: BYTES,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  }), "ASSET_DIGEST_MISMATCH");
  await rejectsCode(service.archive({
    descriptor: descriptor({ byteSize: BYTES.byteLength + 1 }),
    bytes: BYTES,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  }), "ASSET_BYTE_SIZE_MISMATCH");
});

test("archive rejects malformed PNG bytes even when caller digest and size are exact", async () => {
  const { service } = storage();
  const corrupted = Uint8Array.from(BYTES);
  corrupted[29] ^= 0xff;
  const inspected = inspectCreativeArtifactBytes(corrupted);
  await rejectsCode(service.archive({
    descriptor: descriptor({
      byteDigest: inspected.byteDigest,
      byteSize: inspected.byteSize,
      width: inspected.width,
      height: inspected.height,
      computedQaDigest: inspected.computedQaDigest,
    }),
    bytes: corrupted,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  }), "PRIVATE_MASTER_VERIFICATION_FAILED");
});

test("only a selected digest-bound content approval can publish the exact private bytes", async () => {
  const { service, privateStore, publicStore } = storage();
  const archived = await service.archive({
    descriptor: descriptor(),
    bytes: BYTES,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  });
  await rejectsCode(service.publish({
    archived,
    approval: approval({ selectedCandidateSetId: "creative-b" }),
    occurredAt: OCCURRED_AT,
    approvalSequence: 2,
    publicationSequence: 3,
  }), "PUBLIC_MIRROR_NOT_APPROVED");
  assert.equal(publicStore.operations.length, 0);

  const published = await service.publish({
    archived,
    approval: approval(),
    occurredAt: OCCURRED_AT,
    approvalSequence: 2,
    publicationSequence: 3,
  });
  assert.equal(published.manifest.event.state, "PUBLISHED");
  assert.equal(published.manifest.event.approvalReference, approval().approvalReference);
  assert.match(published.publicMirrorReference, /^https:\/\/public\.invalid\//);
  assert.deepEqual(await publicStore.read(archived.objectPath, "DELIVERY"), BYTES);
  assert.equal(privateStore.operations.filter(({ operation, pathname }) =>
    operation === "PUT" && pathname.includes("/manifest/000002/")).length, 1);
  assert.equal(privateStore.operations.filter(({ operation, pathname }) =>
    operation === "PUT" && pathname.includes("/manifest/000003/")).length, 1);
});

test("publication ordering cannot collapse content approval into publication", async () => {
  const { service } = storage();
  const archived = await service.archive({
    descriptor: descriptor(),
    bytes: BYTES,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  });
  await rejectsCode(service.publish({
    archived,
    approval: approval(),
    occurredAt: OCCURRED_AT,
    approvalSequence: 2,
    publicationSequence: 2,
  }), "INVALID_STORAGE_INPUT");
});

test("tampered private master cannot reach the public mirror", async () => {
  const { service, privateStore, publicStore } = storage();
  const archived = await service.archive({
    descriptor: descriptor(),
    bytes: BYTES,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  });
  privateStore.replaceBytesForTest(archived.objectPath, Uint8Array.from([1, 2, 3]));
  await rejectsCode(service.publish({
    archived,
    approval: approval(),
    occurredAt: OCCURRED_AT,
    approvalSequence: 2,
    publicationSequence: 3,
  }), "PRIVATE_MASTER_VERIFICATION_FAILED");
  assert.equal(publicStore.operations.filter(({ operation }) => operation === "PUT").length, 0);
});

test("public digest corruption fails verification instead of returning a deployable reference", async () => {
  const { privateStore } = storage();
  class CorruptingPublicStore implements PublicListingCreativeObjectStore {
    async putImmutable(pathname: string) {
      return { pathname, reference: `https://corrupt.invalid/${pathname}` };
    }
    async read() {
      return Uint8Array.from([9, 9, 9]);
    }
    async remove() {}
  }
  const service = new ManagedListingCreativeStorage(privateStore, new CorruptingPublicStore());
  const archived = await service.archive({
    descriptor: descriptor(),
    bytes: BYTES,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  });
  await rejectsCode(service.publish({
    archived,
    approval: approval(),
    occurredAt: OCCURRED_AT,
    approvalSequence: 2,
    publicationSequence: 3,
  }), "PUBLIC_MIRROR_VERIFICATION_FAILED");
});

test("verified takedown removes only the public mirror and restore rebuilds it from the private digest", async () => {
  const { service, privateStore, publicStore } = storage();
  const archived = await service.archive({
    descriptor: descriptor(),
    bytes: BYTES,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  });
  const published = await service.publish({
    archived,
    approval: approval(),
    occurredAt: OCCURRED_AT,
    approvalSequence: 2,
    publicationSequence: 3,
  });
  const takedown = await service.takedown({
    published,
    occurredAt: OCCURRED_AT,
    sequence: 4,
    reasonCode: "OPERATOR_TEST_TAKEDOWN",
  });
  assert.equal(takedown.event.state, "TAKEDOWN");
  assert.equal(await publicStore.read(archived.objectPath, "DELIVERY"), null);
  assert.deepEqual(await privateStore.read(archived.objectPath), BYTES);

  const restored = await service.restore({
    archived,
    approval: approval({ approvalReference: "approval:fixture-restore:002" }),
    occurredAt: OCCURRED_AT,
    approvalSequence: 5,
    publicationSequence: 6,
  });
  assert.equal(restored.manifest.event.state, "PUBLISHED");
  assert.deepEqual(await publicStore.read(archived.objectPath, "DELIVERY"), BYTES);
});

test("a stale public delivery stays TAKEDOWN_PENDING instead of reporting removal", async () => {
  const privateStore = new InMemoryPrivateListingCreativeObjectStore();
  const publicStore = new InMemoryPublicListingCreativeObjectStore();
  const service = new ManagedListingCreativeStorage(privateStore, publicStore);
  const archived = await service.archive({
    descriptor: descriptor(),
    bytes: BYTES,
    occurredAt: OCCURRED_AT,
    sequence: 1,
  });
  const published = await service.publish({
    archived,
    approval: approval(),
    occurredAt: OCCURRED_AT,
    approvalSequence: 2,
    publicationSequence: 3,
  });
  const staleDelivery: PublicListingCreativeObjectStore = {
    putImmutable: publicStore.putImmutable.bind(publicStore),
    read: async (pathname, consistency) => consistency === "DELIVERY"
      ? BYTES
      : publicStore.read(pathname, consistency),
    remove: publicStore.remove.bind(publicStore),
  };
  const takedownService = new ManagedListingCreativeStorage(privateStore, staleDelivery);
  await rejectsCode(takedownService.takedown({
    published,
    occurredAt: OCCURRED_AT,
    sequence: 4,
    reasonCode: "RIGHTS_WITHDRAWN",
  }), "PUBLIC_TAKEDOWN_NOT_VERIFIED");
  const pendingManifestWrites = privateStore.operations.filter(({ operation, pathname }) =>
    operation === "PUT" && pathname.includes("/manifest/000004/"));
  assert.equal(pendingManifestWrites.length, 1);
});

test("server adapters pin private/public access, disable overwrite, and accept credentials only by injection", async () => {
  const [adapter, runtime, config, packageJson] = await Promise.all([
    readFile(new URL("../lib/listing/creative-object-stores.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/listing-creative-asset.repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(adapter, /import "server-only"/);
  assert.match(adapter, /upsert: false/);
  assert.match(adapter, /access: "public"/);
  assert.match(adapter, /addRandomSuffix: false/);
  assert.match(adapter, /allowOverwrite: false/);
  assert.match(adapter, /useCache: consistency === "DELIVERY"/);
  assert.doesNotMatch(adapter, /process\.env|NEXT_PUBLIC_|KK946/i);
  assert.match(runtime, /process\.env\.BLOB_READ_WRITE_TOKEN/);
  assert.match(runtime, /process\.env\.VERCEL_ENV !== "production"/);
  assert.match(runtime, /createGuardedServiceRoleClient\(guardContext\)/);
  assert.doesNotMatch(runtime, /NEXT_PUBLIC_(?:BLOB|SERVICE_ROLE|OPENAI)|KK946/i);
  assert.match(config, /\[storage\.buckets\.listing-creative-private-v1\][\s\S]*public = false/);
  assert.match(config, /application\/json/);
  assert.equal(JSON.parse(packageJson).dependencies["@vercel/blob"], "2.8.0");
});

test("managed creative storage production sources remain product-agnostic", async () => {
  const sources = await Promise.all([
    "../shared/domain/listing-creative-storage.ts",
    "../engines/listing/creative-storage.ts",
    "../engines/listing/creative-storage-fake.ts",
    "../lib/listing/creative-object-stores.server.ts",
    "../services/listing-creative-asset.repository.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.doesNotMatch(sources.join("\n"), /KK946|4290|4,290|Domeggook/i);
});

test("the rollout runbook preserves private default-deny and exact restore evidence", async () => {
  const runbook = await readFile(new URL(
    "../docs/runbooks/LISTING-CREATIVE-STORAGE-ROLLOUT-V1.md",
    import.meta.url,
  ), "utf8");
  assert.match(runbook, /Public bucket disabled/);
  assert.match(runbook, /no `anon` or `authenticated`/);
  assert.match(runbook, /Production[\s\S]*BLOB_READ_WRITE_TOKEN/);
  assert.match(runbook, /TAKEDOWN_PENDING/);
  assert.match(runbook, /Restore the same digest from the private master/);
  assert.doesNotMatch(runbook, /NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN/);
});
