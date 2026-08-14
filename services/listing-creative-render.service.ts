import { attachArchivedCreativeArtifact } from "@/engines/listing/creative-artifact-review";
import {
  executeCreativeRenderJobWithBytes,
  inspectCreativeArtifactBytes,
  type ListingCreativeProvider,
} from "@/engines/listing/creative-renderer";
import type { ManagedListingCreativeStorage } from "@/engines/listing/creative-storage";
import type {
  CreativeRenderJob,
  RenderedCreativeArtifact,
} from "@/shared/domain/listing-creative";
import type { ArchivedListingCreativeAsset } from "@/shared/domain/listing-creative-storage";

const SHA256 = /^[a-f0-9]{64}$/;

export type ArchivedCreativeRenderResult = Readonly<{
  artifact: RenderedCreativeArtifact;
  archived: ArchivedListingCreativeAsset;
}>;

export async function executeAndArchiveCreativeRender(input: Readonly<{
  job: CreativeRenderJob;
  provider: ListingCreativeProvider;
  storage: ManagedListingCreativeStorage;
  revisionDigest: string;
  occurredAt: string;
  archiveSequence: number;
}>): Promise<ArchivedCreativeRenderResult> {
  if (!SHA256.test(input.revisionDigest)) {
    throw new Error("CREATIVE_REVISION_DIGEST_INVALID");
  }
  const executed = await executeCreativeRenderJobWithBytes(input.job, input.provider);
  const byteInspection = inspectCreativeArtifactBytes(executed.bytes);
  if (
    byteInspection.pngStructure !== "PASS"
    || byteInspection.pixelPayload !== "PASS"
    || byteInspection.mimeType !== executed.artifact.mimeType
  ) throw new Error("CREATIVE_ACTUAL_BYTE_QA_FAILED");
  const archived = await input.storage.archive({
    descriptor: {
      subjectReference: input.job.subjectReference,
      revisionDigest: input.revisionDigest,
      candidateSetId: executed.artifact.candidateSetId,
      artifactId: executed.artifact.artifactId,
      role: executed.artifact.role,
      byteDigest: byteInspection.byteDigest,
      byteSize: byteInspection.byteSize,
      width: byteInspection.width,
      height: byteInspection.height,
      mimeType: executed.artifact.mimeType,
      computedQaDigest: byteInspection.computedQaDigest,
    },
    bytes: executed.bytes,
    occurredAt: input.occurredAt,
    sequence: input.archiveSequence,
  });
  return Object.freeze({
    artifact: attachArchivedCreativeArtifact(executed.artifact, archived),
    archived,
  });
}
