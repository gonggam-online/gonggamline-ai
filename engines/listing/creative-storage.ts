import { createHash } from "node:crypto";

import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import type {
  ArchivedListingCreativeAsset,
  ListingCreativeArtifactDescriptor,
  ListingCreativeManifestEvent,
  ListingCreativeManifestRecord,
  ListingCreativePublicationApproval,
  ListingCreativeStorageContext,
  PublishedListingCreativeAsset,
} from "@/shared/domain/listing-creative-storage";
import { LISTING_CREATIVE_STORAGE_VERSION } from "@/shared/domain/listing-creative-storage";

const SHA256 = /^[a-f0-9]{64}$/;
const REASON_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;

export type CreativeObjectLocation = Readonly<{
  pathname: string;
  reference: string;
}>;

export interface PrivateListingCreativeObjectStore {
  referenceFor(pathname: string): string;
  putImmutable(
    pathname: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<CreativeObjectLocation>;
  read(pathname: string): Promise<Uint8Array | null>;
  createSignedReviewUrl(pathname: string, expiresInSeconds: number): Promise<string>;
}

export interface PublicListingCreativeObjectStore {
  putImmutable(
    pathname: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<CreativeObjectLocation>;
  read(
    pathname: string,
    consistency: "ORIGIN" | "DELIVERY",
  ): Promise<Uint8Array | null>;
  remove(pathname: string): Promise<void>;
}

export type CreativeStorageErrorCode =
  | "INVALID_STORAGE_INPUT"
  | "ASSET_DIGEST_MISMATCH"
  | "ASSET_BYTE_SIZE_MISMATCH"
  | "IMMUTABLE_OBJECT_CONFLICT"
  | "PRIVATE_MASTER_VERIFICATION_FAILED"
  | "PUBLIC_MIRROR_NOT_APPROVED"
  | "PUBLIC_MIRROR_VERIFICATION_FAILED"
  | "PUBLIC_TAKEDOWN_NOT_VERIFIED"
  | "PRIVATE_MASTER_NOT_FOUND"
  | "DUPLICATE_GENERATION_RESERVATION"
  | "STORAGE_CONFIGURATION_UNAVAILABLE";

export class CreativeStorageError extends Error {
  constructor(readonly code: CreativeStorageErrorCode) {
    super(code);
    this.name = "CreativeStorageError";
  }
}

export type GenerationReservationInput = Readonly<{
  context: ListingCreativeStorageContext;
  jobDigest: string;
  occurredAt: string;
  sequence: number;
}>;

export type ArchiveCreativeAssetInput = Readonly<{
  descriptor: ListingCreativeArtifactDescriptor;
  bytes: Uint8Array;
  occurredAt: string;
  sequence: number;
}>;

export type PublishCreativeAssetInput = Readonly<{
  archived: ArchivedListingCreativeAsset;
  approval: ListingCreativePublicationApproval;
  occurredAt: string;
  approvalSequence: number;
  publicationSequence: number;
}>;

export type TakedownCreativeAssetInput = Readonly<{
  published: PublishedListingCreativeAsset;
  occurredAt: string;
  sequence: number;
  reasonCode: string;
}>;

export type RestoreCreativeAssetInput = PublishCreativeAssetInput;

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertDigest(value: string): void {
  if (!SHA256.test(value)) throw new CreativeStorageError("INVALID_STORAGE_INPUT");
}

function assertIsoDate(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new CreativeStorageError("INVALID_STORAGE_INPUT");
  }
}

function assertContext(context: ListingCreativeStorageContext): void {
  assertDigest(context.revisionDigest);
  if (
    context.subjectReference.trim().length === 0
    || context.candidateSetId.trim().length === 0
    || context.artifactId.trim().length === 0
  ) {
    throw new CreativeStorageError("INVALID_STORAGE_INPUT");
  }
}

function extensionFor(contentType: ListingCreativeArtifactDescriptor["mimeType"]): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  return "webp";
}

export function listingCreativeSubjectHash(subjectReference: string): string {
  if (subjectReference.trim().length === 0) {
    throw new CreativeStorageError("INVALID_STORAGE_INPUT");
  }
  return sha256(`gonggamline-listing-subject-v1:${subjectReference}`);
}

export function listingCreativeObjectPath(
  descriptor: ListingCreativeArtifactDescriptor,
): string {
  assertContext(descriptor);
  assertDigest(descriptor.byteDigest);
  return [
    "v1",
    listingCreativeSubjectHash(descriptor.subjectReference),
    descriptor.revisionDigest,
    descriptor.role.toLowerCase(),
    `${descriptor.byteDigest}.${extensionFor(descriptor.mimeType)}`,
  ].join("/");
}

function reservationPath(input: GenerationReservationInput): string {
  assertContext(input.context);
  assertDigest(input.jobDigest);
  return [
    "v1",
    listingCreativeSubjectHash(input.context.subjectReference),
    input.context.revisionDigest,
    "reservation",
    `${input.jobDigest}.json`,
  ].join("/");
}

function manifestPath(event: ListingCreativeManifestEvent, eventDigest: string): string {
  return [
    "v1",
    event.subjectHash,
    event.revisionDigest,
    "manifest",
    String(event.sequence).padStart(6, "0"),
    `${eventDigest}.json`,
  ].join("/");
}

function eventBytes(event: ListingCreativeManifestEvent): Uint8Array {
  return Uint8Array.from(Buffer.from(JSON.stringify(event), "utf8"));
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function assertEventInput(occurredAt: string, sequence: number): void {
  assertIsoDate(occurredAt);
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new CreativeStorageError("INVALID_STORAGE_INPUT");
  }
}

function approvedFor(
  archived: ArchivedListingCreativeAsset,
  approval: ListingCreativePublicationApproval,
): boolean {
  return approval.contentApproved
    && approval.approvalReference.trim().length > 0
    && approval.selectedCandidateSetId === archived.descriptor.candidateSetId
    && approval.boundRevisionDigest === archived.descriptor.revisionDigest
    && approval.boundArtifactDigests.includes(archived.descriptor.byteDigest);
}

export class ManagedListingCreativeStorage {
  constructor(
    private readonly privateStore: PrivateListingCreativeObjectStore,
    private readonly publicStore: PublicListingCreativeObjectStore,
  ) {}

  private async verifyPrivate(pathname: string, expected: Uint8Array): Promise<void> {
    const stored = await this.privateStore.read(pathname);
    if (!stored || !bytesEqual(stored, expected)) {
      throw new CreativeStorageError("PRIVATE_MASTER_VERIFICATION_FAILED");
    }
  }

  private async ensurePrivateImmutable(
    pathname: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<CreativeObjectLocation> {
    const existing = await this.privateStore.read(pathname);
    if (existing) {
      if (!bytesEqual(existing, bytes)) {
        throw new CreativeStorageError("IMMUTABLE_OBJECT_CONFLICT");
      }
      return { pathname, reference: this.privateStore.referenceFor(pathname) };
    }
    const stored = await this.privateStore.putImmutable(pathname, bytes, contentType);
    await this.verifyPrivate(pathname, bytes);
    return stored;
  }

  private async appendManifest(
    event: ListingCreativeManifestEvent,
  ): Promise<ListingCreativeManifestRecord> {
    const eventDigest = digestCanonicalJson(event);
    if (!eventDigest) throw new CreativeStorageError("INVALID_STORAGE_INPUT");
    const pathname = manifestPath(event, eventDigest);
    const bytes = eventBytes(event);
    const location = await this.ensurePrivateImmutable(pathname, bytes, "application/json");
    return Object.freeze({ event, eventDigest, privateManifestReference: location.reference });
  }

  async reserveGeneration(
    input: GenerationReservationInput,
  ): Promise<ListingCreativeManifestRecord> {
    assertEventInput(input.occurredAt, input.sequence);
    const pathname = reservationPath(input);
    if (await this.privateStore.read(pathname)) {
      throw new CreativeStorageError("DUPLICATE_GENERATION_RESERVATION");
    }
    const event: ListingCreativeManifestEvent = Object.freeze({
      schemaVersion: LISTING_CREATIVE_STORAGE_VERSION,
      state: "RESERVED",
      subjectHash: listingCreativeSubjectHash(input.context.subjectReference),
      revisionDigest: input.context.revisionDigest,
      candidateSetId: input.context.candidateSetId,
      artifactId: input.context.artifactId,
      role: input.context.role,
      objectPath: null,
      objectDigest: input.jobDigest,
      approvalReference: null,
      reasonCode: null,
      occurredAt: input.occurredAt,
      sequence: input.sequence,
    });
    const bytes = eventBytes(event);
    const location = await this.privateStore.putImmutable(pathname, bytes, "application/json");
    await this.verifyPrivate(pathname, bytes);
    return Object.freeze({
      event,
      eventDigest: digestCanonicalJson(event) ?? "",
      privateManifestReference: location.reference,
    });
  }

  async archive(input: ArchiveCreativeAssetInput): Promise<ArchivedListingCreativeAsset> {
    assertEventInput(input.occurredAt, input.sequence);
    assertContext(input.descriptor);
    assertDigest(input.descriptor.byteDigest);
    if (input.bytes.byteLength !== input.descriptor.byteSize) {
      throw new CreativeStorageError("ASSET_BYTE_SIZE_MISMATCH");
    }
    if (sha256(input.bytes) !== input.descriptor.byteDigest) {
      throw new CreativeStorageError("ASSET_DIGEST_MISMATCH");
    }
    const objectPath = listingCreativeObjectPath(input.descriptor);
    const location = await this.ensurePrivateImmutable(
      objectPath,
      input.bytes,
      input.descriptor.mimeType,
    );
    const event: ListingCreativeManifestEvent = Object.freeze({
      schemaVersion: LISTING_CREATIVE_STORAGE_VERSION,
      state: "ARCHIVED",
      subjectHash: listingCreativeSubjectHash(input.descriptor.subjectReference),
      revisionDigest: input.descriptor.revisionDigest,
      candidateSetId: input.descriptor.candidateSetId,
      artifactId: input.descriptor.artifactId,
      role: input.descriptor.role,
      objectPath,
      objectDigest: input.descriptor.byteDigest,
      approvalReference: null,
      reasonCode: null,
      occurredAt: input.occurredAt,
      sequence: input.sequence,
    });
    return Object.freeze({
      descriptor: input.descriptor,
      subjectHash: event.subjectHash,
      objectPath,
      privateMasterReference: location.reference,
      manifest: await this.appendManifest(event),
    });
  }

  async createSignedReviewUrl(
    archived: ArchivedListingCreativeAsset,
    expiresInSeconds: number,
  ): Promise<string> {
    if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 3600) {
      throw new CreativeStorageError("INVALID_STORAGE_INPUT");
    }
    return this.privateStore.createSignedReviewUrl(archived.objectPath, expiresInSeconds);
  }

  async publish(input: PublishCreativeAssetInput): Promise<PublishedListingCreativeAsset> {
    assertEventInput(input.occurredAt, input.approvalSequence);
    assertEventInput(input.occurredAt, input.publicationSequence);
    if (input.publicationSequence <= input.approvalSequence) {
      throw new CreativeStorageError("INVALID_STORAGE_INPUT");
    }
    if (!approvedFor(input.archived, input.approval)) {
      throw new CreativeStorageError("PUBLIC_MIRROR_NOT_APPROVED");
    }
    await this.appendManifest(Object.freeze({
      schemaVersion: LISTING_CREATIVE_STORAGE_VERSION,
      state: "APPROVED",
      subjectHash: input.archived.subjectHash,
      revisionDigest: input.archived.descriptor.revisionDigest,
      candidateSetId: input.archived.descriptor.candidateSetId,
      artifactId: input.archived.descriptor.artifactId,
      role: input.archived.descriptor.role,
      objectPath: input.archived.objectPath,
      objectDigest: input.archived.descriptor.byteDigest,
      approvalReference: input.approval.approvalReference,
      reasonCode: null,
      occurredAt: input.occurredAt,
      sequence: input.approvalSequence,
    }));
    const bytes = await this.privateStore.read(input.archived.objectPath);
    if (!bytes) throw new CreativeStorageError("PRIVATE_MASTER_NOT_FOUND");
    if (sha256(bytes) !== input.archived.descriptor.byteDigest) {
      throw new CreativeStorageError("PRIVATE_MASTER_VERIFICATION_FAILED");
    }
    const location = await this.publicStore.putImmutable(
      input.archived.objectPath,
      bytes,
      input.archived.descriptor.mimeType,
    );
    const [origin, delivery] = await Promise.all([
      this.publicStore.read(input.archived.objectPath, "ORIGIN"),
      this.publicStore.read(input.archived.objectPath, "DELIVERY"),
    ]);
    if (
      !origin
      || !delivery
      || sha256(origin) !== input.archived.descriptor.byteDigest
      || sha256(delivery) !== input.archived.descriptor.byteDigest
    ) {
      throw new CreativeStorageError("PUBLIC_MIRROR_VERIFICATION_FAILED");
    }
    const event: ListingCreativeManifestEvent = Object.freeze({
      schemaVersion: LISTING_CREATIVE_STORAGE_VERSION,
      state: "PUBLISHED",
      subjectHash: input.archived.subjectHash,
      revisionDigest: input.archived.descriptor.revisionDigest,
      candidateSetId: input.archived.descriptor.candidateSetId,
      artifactId: input.archived.descriptor.artifactId,
      role: input.archived.descriptor.role,
      objectPath: input.archived.objectPath,
      objectDigest: input.archived.descriptor.byteDigest,
      approvalReference: input.approval.approvalReference,
      reasonCode: null,
      occurredAt: input.occurredAt,
      sequence: input.publicationSequence,
    });
    return Object.freeze({
      archived: input.archived,
      publicMirrorReference: location.reference,
      manifest: await this.appendManifest(event),
    });
  }

  async takedown(input: TakedownCreativeAssetInput): Promise<ListingCreativeManifestRecord> {
    assertEventInput(input.occurredAt, input.sequence);
    if (!REASON_CODE.test(input.reasonCode)) {
      throw new CreativeStorageError("INVALID_STORAGE_INPUT");
    }
    await this.publicStore.remove(input.published.archived.objectPath);
    const [origin, delivery] = await Promise.all([
      this.publicStore.read(input.published.archived.objectPath, "ORIGIN"),
      this.publicStore.read(input.published.archived.objectPath, "DELIVERY"),
    ]);
    if (origin || delivery) {
      await this.appendManifest(Object.freeze({
        schemaVersion: LISTING_CREATIVE_STORAGE_VERSION,
        state: "TAKEDOWN_PENDING",
        subjectHash: input.published.archived.subjectHash,
        revisionDigest: input.published.archived.descriptor.revisionDigest,
        candidateSetId: input.published.archived.descriptor.candidateSetId,
        artifactId: input.published.archived.descriptor.artifactId,
        role: input.published.archived.descriptor.role,
        objectPath: input.published.archived.objectPath,
        objectDigest: input.published.archived.descriptor.byteDigest,
        approvalReference: input.published.manifest.event.approvalReference,
        reasonCode: input.reasonCode,
        occurredAt: input.occurredAt,
        sequence: input.sequence,
      }));
      throw new CreativeStorageError("PUBLIC_TAKEDOWN_NOT_VERIFIED");
    }
    return this.appendManifest(Object.freeze({
      schemaVersion: LISTING_CREATIVE_STORAGE_VERSION,
      state: "TAKEDOWN",
      subjectHash: input.published.archived.subjectHash,
      revisionDigest: input.published.archived.descriptor.revisionDigest,
      candidateSetId: input.published.archived.descriptor.candidateSetId,
      artifactId: input.published.archived.descriptor.artifactId,
      role: input.published.archived.descriptor.role,
      objectPath: input.published.archived.objectPath,
      objectDigest: input.published.archived.descriptor.byteDigest,
      approvalReference: input.published.manifest.event.approvalReference,
      reasonCode: input.reasonCode,
      occurredAt: input.occurredAt,
      sequence: input.sequence,
    }));
  }

  async restore(input: RestoreCreativeAssetInput): Promise<PublishedListingCreativeAsset> {
    return this.publish(input);
  }
}
