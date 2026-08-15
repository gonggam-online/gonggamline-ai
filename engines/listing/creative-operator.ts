import { createHash } from "node:crypto";

import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { buildListingContentPacket } from "@/engines/listing/content-pipeline";
import {
  materializeCreativeFactConstraints,
  planExternalCreativeJobs,
  planningInputFromListingContent,
} from "@/engines/listing/creative-planner";
import {
  buildOpenAiListingImagePrompt,
  estimateOpenAiListingImageCostUsd,
  OPENAI_LISTING_IMAGE_LIMITS,
  OPENAI_LISTING_IMAGE_MODEL,
  OPENAI_LISTING_IMAGE_PRICING_VERSION,
  OPENAI_LISTING_IMAGE_PROVIDER_ID,
  OPENAI_LISTING_IMAGE_TERMS_VERSION,
} from "@/engines/listing/openai-image-provider";
import { listingCreativeSubjectHash } from "@/engines/listing/creative-storage";
import type {
  CreativeProviderApproval,
  CreativeRenderJob,
  RenderedCreativeArtifact,
} from "@/shared/domain/listing-creative";
import type { ArchivedListingCreativeAsset } from "@/shared/domain/listing-creative-storage";
import type {
  ListingContentInput,
  RegistrationCommerceFields,
} from "@/shared/domain/listing-content";
import {
  LISTING_CREATIVE_OPERATOR_VERSION,
  type ListingCreativeDispatchAuthorization,
  type ListingCreativeOperatorContentBinding,
  type ListingCreativeOperatorPlanReference,
  type ListingCreativeOperatorReviewHandoff,
  type ListingCreativeWholePlanReservation,
  type PreparedListingCreativeDispatchPlan,
} from "@/shared/domain/listing-creative-operator";

const SHA256 = /^[a-f0-9]{64}$/;
const PLAN_TTL_MS = 15 * 60 * 1_000;
const AUTHORIZATION_TTL_MS = 5 * 60 * 1_000;
const PLAN_REFERENCE = /^v1\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/;

const PLANNING_PROVIDER: CreativeProviderApproval = Object.freeze({
  providerKind: "EXTERNAL_IMAGE_PROVIDER",
  providerId: OPENAI_LISTING_IMAGE_PROVIDER_ID,
  modelVersion: OPENAI_LISTING_IMAGE_MODEL,
  termsVersion: OPENAI_LISTING_IMAGE_TERMS_VERSION,
  approvalReference: null,
  paidUsageApproved: false,
  serverSecretApproved: false,
  managedAssetStoreApproved: false,
  outputCommercialUseApproved: false,
});

export class ListingCreativeOperatorError extends Error {
  constructor(readonly code:
    | "OPERATOR_PLAN_INVALID"
    | "OPERATOR_PLAN_EXPIRED"
    | "OPERATOR_AUTHORIZATION_INVALID"
    | "OPERATOR_REVIEW_HANDOFF_INVALID") {
    super(code);
    this.name = "ListingCreativeOperatorError";
  }
}

export function formatListingCreativeOperatorPlanReference(
  reference: ListingCreativeOperatorPlanReference,
): string {
  if (
    !SHA256.test(reference.subjectHash)
    || !SHA256.test(reference.revisionDigest)
    || !SHA256.test(reference.dispatchPlanDigest)
  ) throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  return `v1.${reference.subjectHash}.${reference.revisionDigest}.${reference.dispatchPlanDigest}`;
}

export function parseListingCreativeOperatorPlanReference(
  value: string,
): ListingCreativeOperatorPlanReference {
  const match = PLAN_REFERENCE.exec(value);
  if (!match) throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  return Object.freeze({
    subjectHash: match[1],
    revisionDigest: match[2],
    dispatchPlanDigest: match[3],
  });
}

function iso(value: string): void {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function listingCreativeAdministratorHash(administratorUserId: string): string {
  const normalized = administratorUserId.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  }
  return hash(`gonggamline-listing-creative-administrator-v1:${normalized}`);
}

function contentBinding(packet: ReturnType<typeof buildListingContentPacket>): ListingCreativeOperatorContentBinding {
  if (packet.status !== "REGISTRATION_READY" || !packet.registrationPayload) {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  }
  const variants = packet.conversion.candidates.map(({ variantId }) => variantId);
  if (variants.length < 2 || variants[0] === variants[1]) {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  }
  const items = Array.isArray(packet.registrationPayload.items)
    ? packet.registrationPayload.items
    : [];
  const item = items.length === 1 && typeof items[0] === "object" && items[0] !== null
    ? items[0] as Record<string, unknown>
    : null;
  const filterSetDigest = digestCanonicalJson({
    attributes: item && Array.isArray(item.attributes) ? item.attributes : [],
  });
  if (!filterSetDigest) throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  return Object.freeze({
    variantIds: Object.freeze([variants[0], variants[1]]) as readonly [string, string],
    filterSetDigest,
  });
}

function requestSize(job: CreativeRenderJob): "1024x1024" | "1024x1536" | "1536x1024" {
  const size = `${job.width}x${job.height}`;
  if (size !== "1024x1024" && size !== "1024x1536" && size !== "1536x1024") {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  }
  return size;
}

function planDigestBody(plan: Readonly<{
  reference: Omit<ListingCreativeOperatorPlanReference, "dispatchPlanDigest">
    | ListingCreativeOperatorPlanReference;
  preparedAt: string;
  expiresAt: string;
  preparedByAdministratorHash: string;
  planIntegrityDigest?: string;
}> & Readonly<Record<string, unknown>>): unknown {
  const {
    preparedAt: _preparedAt,
    expiresAt: _expiresAt,
    preparedByAdministratorHash: _preparedBy,
    planIntegrityDigest: _integrity,
    reference,
    ...stable
  } = plan;
  void _preparedAt;
  void _expiresAt;
  void _preparedBy;
  void _integrity;
  return {
    ...stable,
    reference: {
      subjectHash: reference.subjectHash,
      revisionDigest: reference.revisionDigest,
    },
  };
}

function planIntegrityBody(plan: PreparedListingCreativeDispatchPlan): unknown {
  const { planIntegrityDigest: _integrity, ...body } = plan;
  void _integrity;
  return body;
}

export function createPreparedListingCreativeDispatchPlan(input: Readonly<{
  listingInput: ListingContentInput;
  commerce: RegistrationCommerceFields;
  administratorUserId: string;
  preparedAt: string;
  preparationAttemptDigest?: string;
}>): PreparedListingCreativeDispatchPlan {
  iso(input.preparedAt);
  if (input.preparationAttemptDigest !== undefined && !SHA256.test(input.preparationAttemptDigest)) {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  }
  const listing = buildListingContentPacket(input.listingInput, input.commerce);
  const binding = contentBinding(listing);
  const planning = planningInputFromListingContent(input.listingInput);
  if (!SHA256.test(planning.revisionId)) {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  }
  const materialized = materializeCreativeFactConstraints(input.listingInput);
  const jobs = planExternalCreativeJobs(planning, PLANNING_PROVIDER);
  const estimatedMaximumCostUsd = jobs.reduce((total, job) => total +
    estimateOpenAiListingImageCostUsd({
      prompt: buildOpenAiListingImagePrompt(job),
      size: requestSize(job),
      quality: "high",
      estimatedInputImageTokens: 0,
    }), 0);
  if (
    jobs.length < 4
    || jobs.length > OPENAI_LISTING_IMAGE_LIMITS.maximumOutputsPerRevision
    || estimatedMaximumCostUsd > OPENAI_LISTING_IMAGE_LIMITS.maximumEstimatedRevisionCostUsd
  ) throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  const preparedAtMs = Date.parse(input.preparedAt);
  const referenceBase = Object.freeze({
    subjectHash: listingCreativeSubjectHash(input.listingInput.subjectId),
    revisionDigest: planning.revisionId,
  });
  const body = Object.freeze({
    schemaVersion: LISTING_CREATIVE_OPERATOR_VERSION,
    status: "PREPARED" as const,
    reference: referenceBase,
    packetIdDigest: hash(input.listingInput.packetId),
    evidenceEvaluationId: input.listingInput.evidence.evaluationId,
    policyDigest: input.listingInput.policy.digest,
    categoryMetadataDigest: input.listingInput.category.metadataDigest,
    contentBinding: binding,
    facts: materialized.facts,
    jobs,
    providerId: OPENAI_LISTING_IMAGE_PROVIDER_ID,
    modelVersion: OPENAI_LISTING_IMAGE_MODEL,
    termsVersion: OPENAI_LISTING_IMAGE_TERMS_VERSION,
    pricingSnapshotVersion: OPENAI_LISTING_IMAGE_PRICING_VERSION,
    estimatedMaximumCostUsd,
    maximumAuthorizedCostUsd: 2 as const,
    maximumOutputs: 6 as const,
    preparedByAdministratorHash: listingCreativeAdministratorHash(input.administratorUserId),
    preparedAt: input.preparedAt,
    expiresAt: new Date(preparedAtMs + PLAN_TTL_MS).toISOString(),
    ...(input.preparationAttemptDigest === undefined
      ? {}
      : { preparationAttemptDigest: input.preparationAttemptDigest }),
  });
  const dispatchPlanDigest = digestCanonicalJson(planDigestBody(body));
  if (!dispatchPlanDigest) throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  const withoutIntegrity = Object.freeze({
    ...body,
    reference: Object.freeze({ ...referenceBase, dispatchPlanDigest }),
  });
  const planIntegrityDigest = digestCanonicalJson(withoutIntegrity);
  if (!planIntegrityDigest) throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  return Object.freeze({ ...withoutIntegrity, planIntegrityDigest });
}

export function preparedListingCreativeDispatchPlanDigest(
  plan: PreparedListingCreativeDispatchPlan,
): string | null {
  return digestCanonicalJson(planDigestBody(plan));
}

export function validatePreparedListingCreativeDispatchPlan(
  plan: PreparedListingCreativeDispatchPlan,
  now: string,
  administratorUserId?: string,
): void {
  iso(now);
  if (
    plan.schemaVersion !== LISTING_CREATIVE_OPERATOR_VERSION
    || plan.status !== "PREPARED"
    || preparedListingCreativeDispatchPlanDigest(plan) !== plan.reference.dispatchPlanDigest
    || digestCanonicalJson(planIntegrityBody(plan)) !== plan.planIntegrityDigest
    || plan.providerId !== OPENAI_LISTING_IMAGE_PROVIDER_ID
    || plan.modelVersion !== OPENAI_LISTING_IMAGE_MODEL
    || plan.termsVersion !== OPENAI_LISTING_IMAGE_TERMS_VERSION
    || plan.pricingSnapshotVersion !== OPENAI_LISTING_IMAGE_PRICING_VERSION
    || plan.maximumAuthorizedCostUsd !== 2
    || plan.maximumOutputs !== 6
    || plan.jobs.length < 4
    || plan.jobs.length > 6
    || plan.estimatedMaximumCostUsd > 2
    || !plan.jobs.every((job) => job.transformation === "FACT_ONLY_SYNTHETIC"
      && job.inputAssetDigests.length === 0
      && job.inputSources.length === 0)
    || (administratorUserId !== undefined
      && plan.preparedByAdministratorHash !== listingCreativeAdministratorHash(administratorUserId))
  ) throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  if (plan.preparationAttemptDigest !== undefined && !SHA256.test(plan.preparationAttemptDigest)) {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  }
  iso(plan.preparedAt);
  iso(plan.expiresAt);
  if (Date.parse(plan.expiresAt) !== Date.parse(plan.preparedAt) + PLAN_TTL_MS) {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_INVALID");
  }
  if (Date.parse(plan.expiresAt) <= Date.parse(now)) {
    throw new ListingCreativeOperatorError("OPERATOR_PLAN_EXPIRED");
  }
}

function authorizationDigestBody(
  authorization: Omit<ListingCreativeDispatchAuthorization, "authorizationDigest">,
): unknown {
  return authorization;
}

export function createListingCreativeDispatchAuthorization(input: Readonly<{
  plan: PreparedListingCreativeDispatchPlan;
  administratorUserId: string;
  authorizedAt: string;
  confirmation: "AUTHORIZE_PAID_IMAGE_GENERATION";
}>): ListingCreativeDispatchAuthorization {
  validatePreparedListingCreativeDispatchPlan(
    input.plan,
    input.authorizedAt,
    input.administratorUserId,
  );
  const body = Object.freeze({
    schemaVersion: LISTING_CREATIVE_OPERATOR_VERSION,
    status: "AUTHORIZED" as const,
    planReference: input.plan.reference,
    administratorSubjectHash: listingCreativeAdministratorHash(input.administratorUserId),
    csrfPurpose: "listing-creative-dispatch" as const,
    confirmation: input.confirmation,
    providerId: input.plan.providerId,
    modelVersion: input.plan.modelVersion,
    termsVersion: input.plan.termsVersion,
    pricingSnapshotVersion: input.plan.pricingSnapshotVersion,
    maximumCostUsd: 2 as const,
    maximumOutputs: 6 as const,
    authorizedAt: input.authorizedAt,
    expiresAt: new Date(Date.parse(input.authorizedAt) + AUTHORIZATION_TTL_MS).toISOString(),
  });
  const authorizationDigest = digestCanonicalJson(authorizationDigestBody(body));
  if (!authorizationDigest) {
    throw new ListingCreativeOperatorError("OPERATOR_AUTHORIZATION_INVALID");
  }
  return Object.freeze({ ...body, authorizationDigest });
}

export function createListingCreativeWholePlanReservation(input: Readonly<{
  plan: PreparedListingCreativeDispatchPlan;
  authorization: ListingCreativeDispatchAuthorization;
  reservedAt: string;
}>): ListingCreativeWholePlanReservation {
  iso(input.reservedAt);
  if (
    input.authorization.planReference.dispatchPlanDigest !== input.plan.reference.dispatchPlanDigest
    || Date.parse(input.authorization.expiresAt) <= Date.parse(input.reservedAt)
  ) throw new ListingCreativeOperatorError("OPERATOR_AUTHORIZATION_INVALID");
  const body = Object.freeze({
    schemaVersion: LISTING_CREATIVE_OPERATOR_VERSION,
    status: "RESERVED" as const,
    planReference: input.plan.reference,
    authorizationDigest: input.authorization.authorizationDigest,
    reservedAt: input.reservedAt,
  });
  const reservationDigest = digestCanonicalJson(body);
  if (!reservationDigest) {
    throw new ListingCreativeOperatorError("OPERATOR_AUTHORIZATION_INVALID");
  }
  return Object.freeze({ ...body, reservationDigest });
}

export function bindAuthorizedCreativeJobs(
  plan: PreparedListingCreativeDispatchPlan,
  provider: CreativeProviderApproval,
): readonly CreativeRenderJob[] {
  if (
    provider.providerKind !== "EXTERNAL_IMAGE_PROVIDER"
    || provider.providerId !== plan.providerId
    || provider.modelVersion !== plan.modelVersion
    || provider.termsVersion !== plan.termsVersion
    || !provider.approvalReference
    || !provider.paidUsageApproved
    || !provider.serverSecretApproved
    || !provider.managedAssetStoreApproved
    || !provider.outputCommercialUseApproved
  ) throw new ListingCreativeOperatorError("OPERATOR_AUTHORIZATION_INVALID");
  return Object.freeze(plan.jobs.map((job) => Object.freeze({ ...job, provider })));
}

export function createListingCreativeOperatorReviewHandoff(input: Readonly<{
  plan: PreparedListingCreativeDispatchPlan;
  authorization: ListingCreativeDispatchAuthorization;
  reservation: ListingCreativeWholePlanReservation;
  artifacts: readonly RenderedCreativeArtifact[];
  archived: readonly ArchivedListingCreativeAsset[];
  createdAt: string;
}>): ListingCreativeOperatorReviewHandoff {
  iso(input.createdAt);
  const archivedByArtifact = new Map(input.archived.map((asset) => [asset.descriptor.artifactId, asset]));
  if (
    input.artifacts.length !== input.plan.jobs.length
    || input.archived.length !== input.artifacts.length
    || input.authorization.planReference.dispatchPlanDigest !== input.plan.reference.dispatchPlanDigest
    || input.reservation.authorizationDigest !== input.authorization.authorizationDigest
  ) throw new ListingCreativeOperatorError("OPERATOR_REVIEW_HANDOFF_INVALID");
  const artifacts = input.artifacts.map((artifact) => {
    const archived = archivedByArtifact.get(artifact.artifactId);
    const execution = artifact.providerExecution;
    const providerExecutionDigest = execution ? digestCanonicalJson(execution) : null;
    if (
      !archived
      || archived.descriptor.byteDigest !== artifact.byteDigest
      || artifact.deployability !== "REVIEW_READY"
      || artifact.productRepresentationReview !== null
      || !execution
      || execution.operation !== "GENERATE"
      || execution.usage.inputImageTokens !== 0
      || !providerExecutionDigest
    ) throw new ListingCreativeOperatorError("OPERATOR_REVIEW_HANDOFF_INVALID");
    return Object.freeze({
      artifactId: artifact.artifactId,
      candidateSetId: artifact.candidateSetId,
      role: artifact.role,
      shotType: artifact.shotType,
      byteDigest: artifact.byteDigest,
      byteSize: artifact.byteSize,
      width: artifact.width,
      height: artifact.height,
      mimeType: artifact.mimeType,
      altText: artifact.altText,
      factIds: artifact.factIds,
      computedReview: artifact.review,
      computedQaDigest: archived.descriptor.computedQaDigest,
      providerExecutionDigest,
      operation: "GENERATE" as const,
      inputImageTokens: 0 as const,
      archived,
    });
  });
  const candidateSetIds = [...new Set(input.plan.jobs.map((job) => job.candidateSetId))];
  if (candidateSetIds.length !== 2 || candidateSetIds[0] === candidateSetIds[1]) {
    throw new ListingCreativeOperatorError("OPERATOR_REVIEW_HANDOFF_INVALID");
  }
  const body = Object.freeze({
    schemaVersion: LISTING_CREATIVE_OPERATOR_VERSION,
    status: "REVIEW_REQUIRED" as const,
    planReference: input.plan.reference,
    authorizationDigest: input.authorization.authorizationDigest,
    reservationDigest: input.reservation.reservationDigest,
    evidenceEvaluationId: input.plan.evidenceEvaluationId,
    policyDigest: input.plan.policyDigest,
    categoryMetadataDigest: input.plan.categoryMetadataDigest,
    contentBinding: input.plan.contentBinding,
    facts: input.plan.facts,
    artifacts: Object.freeze(artifacts),
    candidateSetIds: Object.freeze(
      [candidateSetIds[0], candidateSetIds[1]],
    ) as readonly [string, string],
    selectedCandidateSetId: null,
    contentApproved: false as const,
    liveWriteApproved: false as const,
    requiredHumanReviewFields: Object.freeze([
      "productIdentity", "color", "quantity", "dimensionsAndScale", "material",
      "components", "optionConsistency", "prohibitedMarks", "unsupportedClaims",
      "crop", "encoding", "load",
    ]) as ListingCreativeOperatorReviewHandoff["requiredHumanReviewFields"],
    createdAt: input.createdAt,
  });
  const handoffDigest = digestCanonicalJson(body);
  if (!handoffDigest) throw new ListingCreativeOperatorError("OPERATOR_REVIEW_HANDOFF_INVALID");
  return Object.freeze({ ...body, handoffDigest });
}
