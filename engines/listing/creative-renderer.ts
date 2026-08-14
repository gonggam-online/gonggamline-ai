import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import type {
  ComputedArtifactReview,
  CreativeProviderExecution,
  CreativeProviderApproval,
  CreativeProviderKind,
  CreativeRenderJob,
  RenderedCreativeArtifact,
} from "@/shared/domain/listing-creative";
import { evaluateCreativeRenderJobRights } from "@/engines/listing/creative-rights";

export type ProviderRenderResult = Readonly<{
  bytes: Uint8Array;
  providerKind: CreativeProviderKind;
  providerId: string;
  modelVersion: string;
  termsVersion: string;
  durableAssetReference: string | null;
  execution: CreativeProviderExecution | null;
}>;

export interface ListingCreativeProvider {
  readonly approval: CreativeProviderApproval;
  render(job: CreativeRenderJob): Promise<ProviderRenderResult>;
}

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function join(parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from(Buffer.from(type, "ascii"));
  return join([uint32(data.length), typeBytes, data, uint32(crc32(join([typeBytes, data])))]);
}

function colorFromJob(job: CreativeRenderJob): readonly [number, number, number] {
  const hash = createHash("sha256").update(job.jobId).digest();
  return [48 + (hash[0] % 96), 48 + (hash[1] % 96), 48 + (hash[2] % 96)];
}

export function renderDeterministicFixturePng(job: CreativeRenderJob): Uint8Array {
  const [red, green, blue] = colorFromJob(job);
  const stride = job.width * 4 + 1;
  const raw = new Uint8Array(stride * job.height);
  const padding = Math.max(8, Math.floor(Math.min(job.width, job.height) * 0.16));
  for (let y = 0; y < job.height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < job.width; x += 1) {
      const offset = row + 1 + x * 4;
      const inside = x >= padding && x < job.width - padding && y >= padding && y < job.height - padding;
      const accent = inside && (y < padding + Math.max(4, Math.floor(job.height * 0.04)) || x < padding + Math.max(4, Math.floor(job.width * 0.04)));
      raw[offset] = inside ? (accent ? Math.min(255, red + 54) : red) : 248;
      raw[offset + 1] = inside ? (accent ? Math.min(255, green + 54) : green) : 248;
      raw[offset + 2] = inside ? (accent ? Math.min(255, blue + 54) : blue) : 248;
      raw[offset + 3] = 255;
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, job.width, false);
  view.setUint32(4, job.height, false);
  header.set([8, 6, 0, 0, 0], 8);
  return join([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", Uint8Array.from(deflateSync(raw, { level: 9 }))),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

export class DeterministicFixtureCreativeProvider implements ListingCreativeProvider {
  readonly approval: CreativeProviderApproval = Object.freeze({
    providerKind: "DETERMINISTIC_FIXTURE",
    providerId: "gonggamline-deterministic-fixture-renderer",
    modelVersion: "png-raster-v1",
    termsVersion: "synthetic-fixture-only-v1",
    approvalReference: "architecture:listing-creative-optimization-v1:steps-1-4",
    paidUsageApproved: false,
    serverSecretApproved: false,
    managedAssetStoreApproved: false,
    outputCommercialUseApproved: false,
  });

  async render(job: CreativeRenderJob): Promise<ProviderRenderResult> {
    return {
      bytes: renderDeterministicFixturePng(job),
      providerKind: this.approval.providerKind,
      providerId: this.approval.providerId,
      modelVersion: this.approval.modelVersion,
      termsVersion: this.approval.termsVersion,
      durableAssetReference: null,
      execution: null,
    };
  }
}

export function assertExternalProviderApproved(approval: CreativeProviderApproval): void {
  if (
    approval.providerKind !== "EXTERNAL_IMAGE_PROVIDER" ||
    !approval.approvalReference ||
    !approval.paidUsageApproved ||
    !approval.serverSecretApproved ||
    !approval.managedAssetStoreApproved ||
    !approval.outputCommercialUseApproved
  ) {
    throw new Error("REAL_PROVIDER_NOT_APPROVED");
  }
}

function inspectPng(bytes: Uint8Array): Readonly<{ width: number; height: number; mimeType: "image/png" } | null> {
  if (bytes.length < 24 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false), mimeType: "image/png" };
}

export async function executeCreativeRenderJob(
  job: CreativeRenderJob,
  provider: ListingCreativeProvider,
): Promise<RenderedCreativeArtifact> {
  if (
    job.provider.providerKind !== provider.approval.providerKind
    || job.provider.providerId !== provider.approval.providerId
    || job.provider.modelVersion !== provider.approval.modelVersion
    || job.provider.termsVersion !== provider.approval.termsVersion
  ) {
    throw new Error("PROVIDER_APPROVAL_MISMATCH");
  }
  if (provider.approval.providerKind === "EXTERNAL_IMAGE_PROVIDER") {
    assertExternalProviderApproved(provider.approval);
  }
  const rights = evaluateCreativeRenderJobRights(
    job,
    provider.approval.providerKind === "EXTERNAL_IMAGE_PROVIDER",
  );
  if (!rights.allowed) throw new Error(`CREATIVE_SOURCE_RIGHTS_DENIED:${rights.code}`);
  const output = await provider.render(job);
  if (
    output.providerKind !== provider.approval.providerKind
    || output.providerId !== provider.approval.providerId
    || output.modelVersion !== provider.approval.modelVersion
    || output.termsVersion !== provider.approval.termsVersion
  ) {
    throw new Error("PROVIDER_OUTPUT_IDENTITY_MISMATCH");
  }
  const inspected = inspectPng(output.bytes);
  const digest = createHash("sha256").update(output.bytes).digest("hex");
  const fixtureOnly = output.providerKind === "DETERMINISTIC_FIXTURE";
  const durableOutputReady = Boolean(output.durableAssetReference);
  const review: ComputedArtifactReview = {
    decode: inspected ? "PASS" : "FAIL",
    digest: /^[a-f0-9]{64}$/.test(digest) ? "PASS" : "FAIL",
    mime: inspected?.mimeType === job.mimeType ? "PASS" : "FAIL",
    dimensions: inspected?.width === job.width && inspected.height === job.height ? "PASS" : "FAIL",
    mobileSafe: job.width >= 780 && job.height > 0 ? "PASS" : "FAIL",
    sourceRights: rights.allowed ? "PASS" : "FAIL",
    deployability: !fixtureOnly && durableOutputReady ? "PASS" : "FAIL",
  };
  return Object.freeze({
    artifactId: `${job.jobId}:${digest.slice(0, 12)}`,
    candidateSetId: job.candidateSetId,
    jobId: job.jobId,
    role: job.role,
    shotType: job.shotType,
    byteDigest: digest,
    byteSize: output.bytes.byteLength,
    width: inspected?.width ?? 0,
    height: inspected?.height ?? 0,
    mimeType: "image/png",
    previewDataUrl: `data:image/png;base64,${Buffer.from(output.bytes).toString("base64")}`,
    durableAssetReference: output.durableAssetReference,
    altText: job.altText,
    factIds: job.factIds,
    inputAssetDigests: job.inputAssetDigests,
    renderRecipeVersion: job.renderRecipeVersion,
    providerKind: output.providerKind,
    providerId: output.providerId,
    providerApprovalReference: provider.approval.approvalReference,
    providerModelVersion: output.modelVersion,
    providerTermsVersion: output.termsVersion,
    providerExecution: output.execution,
    deployability: !fixtureOnly && durableOutputReady
      ? "DEPLOYABLE"
      : fixtureOnly
        ? "FIXTURE_ONLY"
        : "NONDEPLOYABLE",
    review,
  });
}
