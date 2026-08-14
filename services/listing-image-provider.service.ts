import "server-only";

import { createHash } from "node:crypto";
import OpenAI from "openai";

import {
  createOpenAiListingImageProviderApproval,
  OpenAiListingCreativeProvider,
  OpenAiListingImageRevisionBudget,
  type OpenAiListingImageDispatchReservation,
  type OpenAiListingImageInputResolver,
} from "@/engines/listing/openai-image-provider";
import type { ManagedListingCreativeStorage } from "@/engines/listing/creative-storage";
import type { AdminGuardContext } from "@/lib/auth/admin-request-guard.server";
import { OpenAiSdkListingImageTransport } from "@/lib/listing/openai-image-transport.server";
import { createProductionManagedListingCreativePrivateStorage } from "@/services/listing-creative-asset.repository";
import type {
  CreativeProviderApproval,
  CreativeRenderJob,
} from "@/shared/domain/listing-creative";

export type ProductionListingImageProviderContext = Readonly<{
  provider: OpenAiListingCreativeProvider;
  providerApproval: CreativeProviderApproval;
  storage: ManagedListingCreativeStorage;
}>;

const SHA256 = /^[a-f0-9]{64}$/;

export type ProductionListingImageReservation = Readonly<{
  jobId: string;
  sequence: number;
}>;

class ManagedStorageListingImageDispatchReservation
implements OpenAiListingImageDispatchReservation {
  private readonly reservationsByJobId: ReadonlyMap<string, ProductionListingImageReservation>;

  constructor(
    private readonly storage: ManagedListingCreativeStorage,
    private readonly revisionDigest: string,
    reservations: readonly ProductionListingImageReservation[],
  ) {
    if (!SHA256.test(revisionDigest) || reservations.length === 0) {
      throw new Error("OPENAI_IMAGE_RESERVATION_CONFIGURATION_INVALID");
    }
    const map = new Map<string, ProductionListingImageReservation>();
    for (const reservation of reservations) {
      if (
        reservation.jobId.trim().length === 0
        || !Number.isSafeInteger(reservation.sequence)
        || reservation.sequence < 0
        || map.has(reservation.jobId)
      ) throw new Error("OPENAI_IMAGE_RESERVATION_CONFIGURATION_INVALID");
      map.set(reservation.jobId, reservation);
    }
    this.reservationsByJobId = map;
  }

  async reserve(input: Readonly<{
    job: CreativeRenderJob;
    requestHash: string;
    requestedAt: string;
  }>): Promise<void> {
    const reservation = this.reservationsByJobId.get(input.job.jobId);
    if (!reservation) throw new Error("OPENAI_IMAGE_RESERVATION_NOT_APPROVED");
    await this.storage.reserveGeneration({
      context: {
        subjectReference: input.job.subjectReference,
        revisionDigest: this.revisionDigest,
        candidateSetId: input.job.candidateSetId,
        artifactId: input.job.jobId,
        role: input.job.role,
      },
      jobDigest: input.requestHash,
      occurredAt: input.requestedAt,
      sequence: reservation.sequence,
    });
  }
}

export function createProductionListingImageProviderContext(input: Readonly<{
  guardContext: AdminGuardContext;
  authorizationDigest: string;
  dispatchPlanDigest: string;
  revisionDigest: string;
  reservations: readonly ProductionListingImageReservation[];
  inputResolver?: OpenAiListingImageInputResolver;
}>): ProductionListingImageProviderContext {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (
    process.env.VERCEL_ENV !== "production"
    || !apiKey
    || !SHA256.test(input.authorizationDigest)
    || !SHA256.test(input.dispatchPlanDigest)
  ) throw new Error("OPENAI_IMAGE_CONFIGURATION_UNAVAILABLE");
  const storage = createProductionManagedListingCreativePrivateStorage(input.guardContext);
  const approvalDigest = createHash("sha256").update([
    "gonggamline-listing-creative-provider-approval-v1",
    input.authorizationDigest,
    input.dispatchPlanDigest,
    input.revisionDigest,
  ].join("\n")).digest("hex");
  const approval = createOpenAiListingImageProviderApproval({
    approvalReference: `listing-image-provider-approval:${approvalDigest}`,
    paidUsageApproved: true,
    serverSecretApproved: true,
    managedAssetStoreApproved: true,
    outputCommercialUseApproved: true,
  });
  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: 120_000,
  });
  return {
    provider: new OpenAiListingCreativeProvider(
      approval,
      new OpenAiSdkListingImageTransport(client),
      new OpenAiListingImageRevisionBudget(),
      new ManagedStorageListingImageDispatchReservation(
        storage,
        input.revisionDigest,
        input.reservations,
      ),
      input.inputResolver ?? null,
    ),
    providerApproval: approval,
    storage,
  };
}
