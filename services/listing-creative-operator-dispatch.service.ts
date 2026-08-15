import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  bindAuthorizedCreativeJobs,
  createListingCreativeDispatchAuthorization,
  createListingCreativeOperatorReviewHandoff,
  createListingCreativeWholePlanReservation,
  createPreparedListingCreativeDispatchPlan,
  formatListingCreativeOperatorPlanReference,
  parseListingCreativeOperatorPlanReference,
  ListingCreativeOperatorError,
  validatePreparedListingCreativeDispatchPlan,
} from "@/engines/listing/creative-operator";
import type { ManagedListingCreativeStorage } from "@/engines/listing/creative-storage";
import type { AdminGuardContext } from "@/lib/auth/admin-request-guard.server";
import { executeAndArchiveCreativeRenders } from "@/services/listing-creative-render.service";
import {
  createProductionListingCreativeOperatorRepository,
  type ListingCreativeOperatorRepository,
} from "@/services/listing-creative-operator.repository";
import {
  createProductionListingImageProviderContext,
  type ProductionListingImageProviderContext,
} from "@/services/listing-image-provider.service";
import {
  LISTING_CREATIVE_OPERATOR_API_VERSION,
  type ListingCreativeDispatchPreparedDto,
  type PrepareListingCreativeDispatchRequest,
} from "@/shared/contracts/listing-creative-operator-dispatch";
import type { RenderedCreativeArtifact } from "@/shared/domain/listing-creative";
import type { ArchivedListingCreativeAsset } from "@/shared/domain/listing-creative-storage";
import type {
  ListingCreativeOperatorPlanReference,
  ListingCreativeOperatorReviewDto,
  ListingCreativeOperatorReviewHandoff,
  PreparedListingCreativeDispatchPlan,
} from "@/shared/domain/listing-creative-operator";

const REVIEW_URL_TTL_SECONDS = 15 * 60;

export class ListingCreativeOperatorServiceError extends Error {
  constructor(readonly code:
    | "DISPATCH_PREPARE_FAILED"
    | "DISPATCH_NOT_FOUND"
    | "DISPATCH_ALREADY_RESERVED"
    | "DISPATCH_AUTHORIZATION_FAILED"
    | "DISPATCH_EXECUTION_FAILED"
    | "DISPATCH_REVIEW_UNAVAILABLE"
    | "DISPATCH_REPREPARE_FAILED"
    | "DISPATCH_REPREPARE_NOT_EXPIRED") {
    super(code);
    this.name = "ListingCreativeOperatorServiceError";
  }
}

type ProviderContextFactory = (input: Readonly<{
  guardContext: AdminGuardContext;
  authorizationDigest: string;
  dispatchPlanDigest: string;
  revisionDigest: string;
  reservations: readonly Readonly<{ jobId: string; sequence: number }>[];
}>) => ProductionListingImageProviderContext;

type OperatorDependencies = Readonly<{
  repository: ListingCreativeOperatorRepository;
  providerContextFactory: ProviderContextFactory;
  clock: () => Date;
}>;

function preparedDto(
  plan: ReturnType<typeof createPreparedListingCreativeDispatchPlan>,
): ListingCreativeDispatchPreparedDto {
  const candidateIds = [...new Set(plan.jobs.map((job) => job.candidateSetId))];
  return Object.freeze({
    schemaVersion: LISTING_CREATIVE_OPERATOR_API_VERSION,
    status: "PREPARED",
    preparedPlanReference: formatListingCreativeOperatorPlanReference(plan.reference),
    dispatchPlanDigest: plan.reference.dispatchPlanDigest,
    revisionDigest: plan.reference.revisionDigest,
    expiresAt: plan.expiresAt,
    providerId: plan.providerId,
    modelVersion: plan.modelVersion,
    termsVersion: plan.termsVersion,
    pricingSnapshotVersion: plan.pricingSnapshotVersion,
    estimatedMaximumCostUsd: plan.estimatedMaximumCostUsd,
    maximumAuthorizedCostUsd: plan.maximumAuthorizedCostUsd,
    outputCount: plan.jobs.length,
    candidates: Object.freeze(candidateIds.map((candidateSetId) => Object.freeze({
      candidateSetId,
      jobs: Object.freeze(plan.jobs
        .filter((job) => job.candidateSetId === candidateSetId)
        .map((job) => Object.freeze({
          role: job.role,
          shotType: job.shotType,
          width: job.width,
          height: job.height,
        }))),
    }))),
  });
}

export async function prepareListingCreativeOperatorDispatch(
  context: AdminGuardContext,
  request: PrepareListingCreativeDispatchRequest,
  dependencies: Partial<OperatorDependencies> = {},
): Promise<ListingCreativeDispatchPreparedDto> {
  const repository = dependencies.repository
    ?? createProductionListingCreativeOperatorRepository(context);
  const clock = dependencies.clock ?? (() => new Date());
  try {
    const preparedAt = clock().toISOString();
    let preparationAttemptDigest: string | undefined;
    if (request.reprepareExpiredPlanReference !== undefined) {
      let previous: PreparedListingCreativeDispatchPlan;
      let expired = false;
      try {
        const previousReference = parseListingCreativeOperatorPlanReference(
          request.reprepareExpiredPlanReference,
        );
        previous = await repository.loadPrepared(previousReference);
        validatePreparedListingCreativeDispatchPlan(
          previous,
          preparedAt,
          context.administratorUserId,
        );
      } catch (error) {
        if (error instanceof ListingCreativeOperatorError
          && error.code === "OPERATOR_PLAN_EXPIRED") {
          expired = true;
        } else {
          throw new ListingCreativeOperatorServiceError("DISPATCH_REPREPARE_FAILED");
        }
      }
      if (!expired) throw new ListingCreativeOperatorServiceError("DISPATCH_REPREPARE_NOT_EXPIRED");

      const stablePlan = createPreparedListingCreativeDispatchPlan({
        listingInput: request.listingInput,
        commerce: request.commerce,
        administratorUserId: context.administratorUserId,
        preparedAt,
      });
      if (
        stablePlan.reference.subjectHash !== previous!.reference.subjectHash
        || stablePlan.reference.revisionDigest !== previous!.reference.revisionDigest
        || stablePlan.reference.dispatchPlanDigest !== previous!.reference.dispatchPlanDigest
        || stablePlan.packetIdDigest !== previous!.packetIdDigest
        || stablePlan.evidenceEvaluationId !== previous!.evidenceEvaluationId
        || stablePlan.policyDigest !== previous!.policyDigest
        || stablePlan.categoryMetadataDigest !== previous!.categoryMetadataDigest
      ) throw new ListingCreativeOperatorServiceError("DISPATCH_REPREPARE_FAILED");

      preparationAttemptDigest = createPreparationAttemptDigest();
    }

    const plan = createPreparedListingCreativeDispatchPlan({
      listingInput: request.listingInput,
      commerce: request.commerce,
      administratorUserId: context.administratorUserId,
      preparedAt,
      preparationAttemptDigest,
    });
    await repository.savePrepared(plan);
    return preparedDto(plan);
  } catch (error) {
    if (error instanceof ListingCreativeOperatorServiceError) throw error;
    if (error && typeof error === "object"
      && "code" in error && error.code === "ALREADY_EXISTS") {
      throw new ListingCreativeOperatorServiceError("DISPATCH_ALREADY_RESERVED");
    }
    throw new ListingCreativeOperatorServiceError("DISPATCH_PREPARE_FAILED");
  }
}

function createPreparationAttemptDigest(): string {
  return createHash("sha256")
    .update("gonggamline-listing-creative-reprepare-v1:", "utf8")
    .update(randomBytes(16))
    .digest("hex");
}

async function reviewDto(
  handoff: ListingCreativeOperatorReviewHandoff,
  storage: ManagedListingCreativeStorage,
): Promise<ListingCreativeOperatorReviewDto> {
  const artifacts = await Promise.all(handoff.artifacts.map(async (artifact) => Object.freeze({
    artifactId: artifact.artifactId,
    candidateSetId: artifact.candidateSetId,
    role: artifact.role,
    byteDigest: artifact.byteDigest,
    width: artifact.width,
    height: artifact.height,
    mimeType: artifact.mimeType,
    altText: artifact.altText,
    signedReviewUrl: await storage.createSignedReviewUrl(
      artifact.archived,
      REVIEW_URL_TTL_SECONDS,
    ),
    signedReviewUrlTtlSeconds: REVIEW_URL_TTL_SECONDS,
    computedReview: artifact.computedReview,
    humanReview: "REVIEW_REQUIRED" as const,
  })));
  return Object.freeze({
    status: "REVIEW_REQUIRED",
    dispatchPlanDigest: handoff.planReference.dispatchPlanDigest,
    revisionDigest: handoff.planReference.revisionDigest,
    handoffDigest: handoff.handoffDigest,
    facts: handoff.facts,
    candidateSetIds: handoff.candidateSetIds,
    artifacts: Object.freeze(artifacts),
    selectedCandidateSetId: null,
    contentApproved: false,
    liveWriteApproved: false,
  });
}

export async function authorizeAndDispatchListingCreativeOperatorPlan(
  context: AdminGuardContext,
  input: Readonly<{
    preparedPlanReference: string;
    confirmation: "AUTHORIZE_PAID_IMAGE_GENERATION";
  }>,
  dependencies: Partial<OperatorDependencies> = {},
): Promise<ListingCreativeOperatorReviewDto> {
  const repository = dependencies.repository
    ?? createProductionListingCreativeOperatorRepository(context);
  const providerContextFactory = dependencies.providerContextFactory
    ?? createProductionListingImageProviderContext;
  const clock = dependencies.clock ?? (() => new Date());
  let reference: ListingCreativeOperatorPlanReference;
  let authorizationDigest: string | null = null;
  try {
    reference = parseListingCreativeOperatorPlanReference(input.preparedPlanReference);
  } catch {
    throw new ListingCreativeOperatorServiceError("DISPATCH_NOT_FOUND");
  }
  try {
    const now = clock().toISOString();
    const plan = await repository.loadPrepared(reference);
    validatePreparedListingCreativeDispatchPlan(plan, now, context.administratorUserId);
    const authorization = createListingCreativeDispatchAuthorization({
      plan,
      administratorUserId: context.administratorUserId,
      authorizedAt: now,
      confirmation: input.confirmation,
    });
    authorizationDigest = authorization.authorizationDigest;
    await repository.saveAuthorization(authorization);
    const reservation = createListingCreativeWholePlanReservation({
      plan,
      authorization,
      reservedAt: now,
    });
    await repository.reserveGlobalWindow(reservation);
    await repository.reserveWholePlan(reservation);

    const providerContext = providerContextFactory({
      guardContext: context,
      authorizationDigest: authorization.authorizationDigest,
      dispatchPlanDigest: plan.reference.dispatchPlanDigest,
      revisionDigest: plan.reference.revisionDigest,
      reservations: plan.jobs.map((job, sequence) => ({ jobId: job.jobId, sequence })),
    });
    const jobs = bindAuthorizedCreativeJobs(plan, providerContext.providerApproval);
    const results = await executeAndArchiveCreativeRenders({
      jobs,
      provider: providerContext.provider,
      storage: providerContext.storage,
      revisionDigest: plan.reference.revisionDigest,
      occurredAt: clock().toISOString(),
      archiveSequenceStart: 100,
    });
    const artifacts: RenderedCreativeArtifact[] = results.map(({ artifact }) => artifact);
    const archived: ArchivedListingCreativeAsset[] = results.map(({ archived: asset }) => asset);
    const handoff = createListingCreativeOperatorReviewHandoff({
      plan,
      authorization,
      reservation,
      artifacts,
      archived,
      createdAt: clock().toISOString(),
    });
    await repository.saveReviewHandoff(handoff);
    return await reviewDto(handoff, providerContext.storage);
  } catch (error) {
    try {
      await repository.saveFailure({
        reference,
        authorizationDigest,
        failureCode: "DISPATCH_EXECUTION_FAILED",
        failedAt: clock().toISOString(),
      });
    } catch {
      // The original failure remains authoritative; failure evidence is best effort.
    }
    if (error && typeof error === "object"
      && "code" in error && error.code === "ALREADY_EXISTS") {
      throw new ListingCreativeOperatorServiceError("DISPATCH_ALREADY_RESERVED");
    }
    throw new ListingCreativeOperatorServiceError("DISPATCH_EXECUTION_FAILED");
  }
}

export async function loadListingCreativeOperatorReview(
  context: AdminGuardContext,
  preparedPlanReference: string,
  storage: ManagedListingCreativeStorage,
  dependencies: Pick<Partial<OperatorDependencies>, "repository"> = {},
): Promise<ListingCreativeOperatorReviewDto> {
  const repository = dependencies.repository
    ?? createProductionListingCreativeOperatorRepository(context);
  try {
    const reference = parseListingCreativeOperatorPlanReference(preparedPlanReference);
    const handoff = await repository.loadReviewHandoff(reference);
    return await reviewDto(handoff, storage);
  } catch {
    throw new ListingCreativeOperatorServiceError("DISPATCH_REVIEW_UNAVAILABLE");
  }
}
