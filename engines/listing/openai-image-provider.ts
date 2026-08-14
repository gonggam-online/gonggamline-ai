import { createHash } from "node:crypto";

import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { evaluateCreativeRenderJobRights } from "@/engines/listing/creative-rights";
import {
  assertExternalProviderApproved,
  type ListingCreativeProvider,
  type ProviderRenderResult,
} from "@/engines/listing/creative-renderer";
import type {
  CreativeProviderApproval,
  CreativeRenderJob,
} from "@/shared/domain/listing-creative";

export const OPENAI_LISTING_IMAGE_MODEL = "gpt-image-2-2026-04-21" as const;
export const OPENAI_LISTING_IMAGE_PROVIDER_ID = "openai-image-api" as const;
export const OPENAI_LISTING_IMAGE_TERMS_VERSION =
  "openai-services-agreement-observed-2026-08-14:7a9261d770293cfc11331ffc89f8c71543a48b22347113df2bf0efb28c08f2cd" as const;
export const OPENAI_LISTING_IMAGE_PRICING_VERSION =
  "openai-image-pricing-observed-2026-08-14:gpt-image-2-standard-v2" as const;

export const OPENAI_LISTING_IMAGE_LIMITS = Object.freeze({
  maximumEstimatedRevisionCostUsd: 2,
  maximumOutputsPerRevision: 6,
  maximumAttemptsPerJob: 2,
  maximumPromptCharacters: 32_000,
  maximumPromptUtf8Bytes: 96_000,
});

export type OpenAiListingImageQuality = "low" | "medium" | "high";

export type OpenAiListingImageInput = Readonly<{
  assetDigest: string;
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  estimatedInputTokens: number;
  costEstimateReference: string;
  pricingSnapshotVersion: typeof OPENAI_LISTING_IMAGE_PRICING_VERSION;
}>;

export type OpenAiListingImageTransportRequest = Readonly<{
  operation: "GENERATE" | "EDIT";
  model: typeof OPENAI_LISTING_IMAGE_MODEL;
  prompt: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  quality: OpenAiListingImageQuality;
  outputFormat: "png";
  idempotencyKey: string;
  inputs: readonly OpenAiListingImageInput[];
}>;

export type OpenAiListingImageUsage = Readonly<{
  inputTextTokens: number | null;
  inputImageTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}>;

export type OpenAiListingImageTransportResponse = Readonly<{
  b64Json: string;
  providerRequestId: string | null;
  usage: OpenAiListingImageUsage;
}>;

export interface OpenAiListingImageTransport {
  execute(
    request: OpenAiListingImageTransportRequest,
  ): Promise<OpenAiListingImageTransportResponse>;
}

export interface OpenAiListingImageInputResolver {
  resolve(assetDigest: string): Promise<OpenAiListingImageInput | null>;
}

export type OpenAiListingImageDispatchReservationInput = Readonly<{
  job: CreativeRenderJob;
  requestHash: string;
  requestedAt: string;
}>;

export interface OpenAiListingImageDispatchReservation {
  reserve(input: OpenAiListingImageDispatchReservationInput): Promise<void>;
}

export type OpenAiListingImageErrorCode =
  | "OPENAI_IMAGE_ATTEMPT_LIMIT_EXCEEDED"
  | "OPENAI_IMAGE_BUDGET_EXCEEDED"
  | "OPENAI_IMAGE_INPUT_COST_ESTIMATE_REQUIRED"
  | "OPENAI_IMAGE_INPUT_DIGEST_MISMATCH"
  | "OPENAI_IMAGE_INPUT_RESOLVER_REQUIRED"
  | "OPENAI_IMAGE_OUTPUT_LIMIT_EXCEEDED"
  | "OPENAI_IMAGE_PROMPT_INVALID"
  | "OPENAI_IMAGE_RESPONSE_INVALID"
  | "OPENAI_IMAGE_SIZE_NOT_PRICED"
  | "OPENAI_IMAGE_SOURCE_RIGHTS_DENIED"
  | "OPENAI_IMAGE_UNSUPPORTED_OPERATION";

export class OpenAiListingImageError extends Error {
  constructor(readonly code: OpenAiListingImageErrorCode) {
    super(code);
    this.name = "OpenAiListingImageError";
  }
}

type BudgetReservation = Readonly<{
  attemptNumber: number;
  estimatedRevisionCostUsd: number;
}>;

export class OpenAiListingImageRevisionBudget {
  private readonly attemptsByJob = new Map<string, number>();
  private readonly outputJobIds = new Set<string>();
  private estimatedRevisionCostUsd = 0;
  private actualRevisionCostUsd = 0;

  reserve(jobId: string, estimatedCostUsd: number): BudgetReservation {
    const currentAttempts = this.attemptsByJob.get(jobId) ?? 0;
    if (currentAttempts >= OPENAI_LISTING_IMAGE_LIMITS.maximumAttemptsPerJob) {
      throw new OpenAiListingImageError("OPENAI_IMAGE_ATTEMPT_LIMIT_EXCEEDED");
    }
    if (
      !this.outputJobIds.has(jobId)
      && this.outputJobIds.size >= OPENAI_LISTING_IMAGE_LIMITS.maximumOutputsPerRevision
    ) {
      throw new OpenAiListingImageError("OPENAI_IMAGE_OUTPUT_LIMIT_EXCEEDED");
    }
    const nextCost = this.estimatedRevisionCostUsd + estimatedCostUsd;
    if (nextCost > OPENAI_LISTING_IMAGE_LIMITS.maximumEstimatedRevisionCostUsd) {
      throw new OpenAiListingImageError("OPENAI_IMAGE_BUDGET_EXCEEDED");
    }
    this.attemptsByJob.set(jobId, currentAttempts + 1);
    this.outputJobIds.add(jobId);
    this.estimatedRevisionCostUsd = nextCost;
    return {
      attemptNumber: currentAttempts + 1,
      estimatedRevisionCostUsd: nextCost,
    };
  }

  commitActual(actualCostUsd: number | null): void {
    if (actualCostUsd === null) return;
    const nextCost = this.actualRevisionCostUsd + actualCostUsd;
    if (nextCost > OPENAI_LISTING_IMAGE_LIMITS.maximumEstimatedRevisionCostUsd) {
      throw new OpenAiListingImageError("OPENAI_IMAGE_BUDGET_EXCEEDED");
    }
    this.actualRevisionCostUsd = nextCost;
  }
}

const OUTPUT_COST_USD = Object.freeze({
  low: Object.freeze({ "1024x1024": 0.006, "1024x1536": 0.005, "1536x1024": 0.005 }),
  medium: Object.freeze({ "1024x1024": 0.053, "1024x1536": 0.041, "1536x1024": 0.041 }),
  high: Object.freeze({ "1024x1024": 0.211, "1024x1536": 0.165, "1536x1024": 0.165 }),
});

const TEXT_INPUT_USD_PER_MILLION_TOKENS = 5;
const IMAGE_INPUT_USD_PER_MILLION_TOKENS = 8;
const IMAGE_OUTPUT_USD_PER_MILLION_TOKENS = 30;

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function requestSize(job: CreativeRenderJob): OpenAiListingImageTransportRequest["size"] {
  const size = `${job.width}x${job.height}`;
  if (size === "1024x1024" || size === "1024x1536" || size === "1536x1024") {
    return size;
  }
  throw new OpenAiListingImageError("OPENAI_IMAGE_SIZE_NOT_PRICED");
}

function normalizedConstraint(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildOpenAiListingImagePrompt(job: CreativeRenderJob): string {
  const constraints = [...new Set(job.factualConstraints.map(normalizedConstraint).filter(Boolean))];
  if (constraints.length === 0 || job.factIds.length === 0) {
    throw new OpenAiListingImageError("OPENAI_IMAGE_PROMPT_INVALID");
  }
  const roleGuidance = job.role === "MAIN"
    ? "Create one clear product-only hero composition on a clean neutral background. Do not add badges, promotional text, borders, watermarks, or unrelated props."
    : job.role === "DETAIL"
      ? "Create a mobile-commerce visual that communicates only the admitted facts with a simple, scannable composition. Do not render factual text inside the image."
      : "Create one supplementary product view that resolves a customer question without changing the product or included components.";
  const prompt = [
    "Create an original commerce product image from admitted product facts.",
    `Channel role: ${job.role}. Shot taxonomy: ${job.shotType}.`,
    roleGuidance,
    "Exact constraints:",
    ...constraints.map((constraint) => `- ${constraint}`),
    "Do not invent a logo, brand, label, color, component, quantity, closure, pocket, scale reference, certification, claim, packaging, or accessory.",
    "If the exact visible construction is not determined by these constraints, keep the result neutral and require human product-representation review; do not guess.",
  ].join("\n");
  if (
    prompt.length === 0
    || prompt.length > OPENAI_LISTING_IMAGE_LIMITS.maximumPromptCharacters
    || Buffer.byteLength(prompt, "utf8") > OPENAI_LISTING_IMAGE_LIMITS.maximumPromptUtf8Bytes
  ) {
    throw new OpenAiListingImageError("OPENAI_IMAGE_PROMPT_INVALID");
  }
  return prompt;
}

export function estimateOpenAiListingImageCostUsd(input: Readonly<{
  prompt: string;
  size: OpenAiListingImageTransportRequest["size"];
  quality: OpenAiListingImageQuality;
  estimatedInputImageTokens: number;
}>): number {
  if (!Number.isSafeInteger(input.estimatedInputImageTokens) || input.estimatedInputImageTokens < 0) {
    throw new OpenAiListingImageError("OPENAI_IMAGE_INPUT_COST_ESTIMATE_REQUIRED");
  }
  const conservativeTextTokenUpperBound = Buffer.byteLength(input.prompt, "utf8");
  const textCost = conservativeTextTokenUpperBound * TEXT_INPUT_USD_PER_MILLION_TOKENS / 1_000_000;
  const imageInputCost = input.estimatedInputImageTokens * IMAGE_INPUT_USD_PER_MILLION_TOKENS / 1_000_000;
  return roundUsd(OUTPUT_COST_USD[input.quality][input.size] + textCost + imageInputCost);
}

function actualCostUsd(usage: OpenAiListingImageUsage): number | null {
  if (
    usage.inputTextTokens === null
    || usage.inputImageTokens === null
    || usage.outputTokens === null
  ) return null;
  if (
    usage.inputTextTokens < 0
    || usage.inputImageTokens < 0
    || usage.outputTokens < 0
  ) return null;
  return roundUsd(
    usage.inputTextTokens * TEXT_INPUT_USD_PER_MILLION_TOKENS / 1_000_000
    + usage.inputImageTokens * IMAGE_INPUT_USD_PER_MILLION_TOKENS / 1_000_000
    + usage.outputTokens * IMAGE_OUTPUT_USD_PER_MILLION_TOKENS / 1_000_000,
  );
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim();
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new OpenAiListingImageError("OPENAI_IMAGE_RESPONSE_INVALID");
  }
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== normalized) {
    throw new OpenAiListingImageError("OPENAI_IMAGE_RESPONSE_INVALID");
  }
  return Uint8Array.from(bytes);
}

function operationFor(job: CreativeRenderJob): "GENERATE" | "EDIT" {
  if (job.transformation === "FACT_ONLY_SYNTHETIC") return "GENERATE";
  if (
    job.transformation === "CROP"
    || job.transformation === "BACKGROUND_REMOVAL"
    || job.transformation === "TEXT_OVERLAY"
    || job.transformation === "COMPOSITE"
    || job.transformation === "GENERATIVE_REFERENCE"
  ) return "EDIT";
  throw new OpenAiListingImageError("OPENAI_IMAGE_UNSUPPORTED_OPERATION");
}

async function resolveInputs(
  job: CreativeRenderJob,
  operation: "GENERATE" | "EDIT",
  resolver: OpenAiListingImageInputResolver | null,
): Promise<readonly OpenAiListingImageInput[]> {
  if (operation === "GENERATE") return [];
  if (!resolver) throw new OpenAiListingImageError("OPENAI_IMAGE_INPUT_RESOLVER_REQUIRED");
  const inputs: OpenAiListingImageInput[] = [];
  for (const digest of job.inputAssetDigests) {
    const input = await resolver.resolve(digest);
    if (!input || input.assetDigest !== digest) {
      throw new OpenAiListingImageError("OPENAI_IMAGE_INPUT_DIGEST_MISMATCH");
    }
    if (!Number.isSafeInteger(input.estimatedInputTokens) || input.estimatedInputTokens <= 0) {
      throw new OpenAiListingImageError("OPENAI_IMAGE_INPUT_COST_ESTIMATE_REQUIRED");
    }
    if (
      input.costEstimateReference.trim().length === 0
      || input.pricingSnapshotVersion !== OPENAI_LISTING_IMAGE_PRICING_VERSION
    ) throw new OpenAiListingImageError("OPENAI_IMAGE_INPUT_COST_ESTIMATE_REQUIRED");
    inputs.push(input);
  }
  if (inputs.length === 0) {
    throw new OpenAiListingImageError("OPENAI_IMAGE_INPUT_RESOLVER_REQUIRED");
  }
  return inputs;
}

export function createOpenAiListingImageProviderApproval(input: Readonly<{
  approvalReference: string;
  paidUsageApproved: boolean;
  serverSecretApproved: boolean;
  managedAssetStoreApproved: boolean;
  outputCommercialUseApproved: boolean;
}>): CreativeProviderApproval {
  return Object.freeze({
    providerKind: "EXTERNAL_IMAGE_PROVIDER",
    providerId: OPENAI_LISTING_IMAGE_PROVIDER_ID,
    modelVersion: OPENAI_LISTING_IMAGE_MODEL,
    termsVersion: OPENAI_LISTING_IMAGE_TERMS_VERSION,
    ...input,
  });
}

export class OpenAiListingCreativeProvider implements ListingCreativeProvider {
  constructor(
    readonly approval: CreativeProviderApproval,
    private readonly transport: OpenAiListingImageTransport,
    private readonly budget: OpenAiListingImageRevisionBudget,
    private readonly dispatchReservation: OpenAiListingImageDispatchReservation,
    private readonly inputResolver: OpenAiListingImageInputResolver | null = null,
    private readonly quality: OpenAiListingImageQuality = "high",
    private readonly now: () => Date = () => new Date(),
  ) {
    assertExternalProviderApproved(approval);
    if (
      approval.providerId !== OPENAI_LISTING_IMAGE_PROVIDER_ID
      || approval.modelVersion !== OPENAI_LISTING_IMAGE_MODEL
      || approval.termsVersion !== OPENAI_LISTING_IMAGE_TERMS_VERSION
    ) throw new Error("PROVIDER_APPROVAL_MISMATCH");
  }

  async render(job: CreativeRenderJob): Promise<ProviderRenderResult> {
    const rights = evaluateCreativeRenderJobRights(job, true, this.now());
    if (!rights.allowed) {
      throw new OpenAiListingImageError("OPENAI_IMAGE_SOURCE_RIGHTS_DENIED");
    }
    const operation = operationFor(job);
    const prompt = buildOpenAiListingImagePrompt(job);
    const size = requestSize(job);
    const inputs = await resolveInputs(job, operation, this.inputResolver);
    const estimatedCostUsd = estimateOpenAiListingImageCostUsd({
      prompt,
      size,
      quality: this.quality,
      estimatedInputImageTokens: inputs.reduce((total, input) => total + input.estimatedInputTokens, 0),
    });
    const promptDigest = createHash("sha256").update(prompt).digest("hex");
    const requestHash = digestCanonicalJson({
      schemaVersion: "gonggamline-openai-listing-image-request-v1",
      jobId: job.jobId,
      candidateSetId: job.candidateSetId,
      operation,
      model: OPENAI_LISTING_IMAGE_MODEL,
      promptDigest,
      size,
      quality: this.quality,
      outputFormat: "png",
      factIds: job.factIds,
      inputRights: job.inputSources.map(({ assetDigest, snapshotDigest, rights }) => ({
        assetDigest,
        snapshotDigest,
        rights,
      })),
      inputCostEstimates: inputs.map(({
        assetDigest,
        estimatedInputTokens,
        costEstimateReference,
        pricingSnapshotVersion,
      }) => ({
        assetDigest,
        estimatedInputTokens,
        costEstimateReference,
        pricingSnapshotVersion,
      })),
      pricingSnapshotVersion: OPENAI_LISTING_IMAGE_PRICING_VERSION,
      estimatedCostUsd,
      renderRecipeVersion: job.renderRecipeVersion,
    });
    if (!requestHash) throw new OpenAiListingImageError("OPENAI_IMAGE_PROMPT_INVALID");
    this.budget.reserve(job.jobId, estimatedCostUsd);
    const requestedAt = this.now().toISOString();
    await this.dispatchReservation.reserve({ job, requestHash, requestedAt });
    const response = await this.transport.execute({
      operation,
      model: OPENAI_LISTING_IMAGE_MODEL,
      prompt,
      size,
      quality: this.quality,
      outputFormat: "png",
      idempotencyKey: requestHash,
      inputs,
    });
    const bytes = decodeBase64(response.b64Json);
    const computedActualCostUsd = actualCostUsd(response.usage);
    this.budget.commitActual(computedActualCostUsd);
    return {
      bytes,
      providerKind: this.approval.providerKind,
      providerId: this.approval.providerId,
      modelVersion: this.approval.modelVersion,
      termsVersion: this.approval.termsVersion,
      durableAssetReference: null,
      execution: {
        operation,
        requestHash,
        promptDigest,
        requestedAt,
        sanitizedProviderRequestHash: response.providerRequestId
          ? createHash("sha256").update(response.providerRequestId).digest("hex")
          : null,
        quality: this.quality.toUpperCase() as "LOW" | "MEDIUM" | "HIGH",
        pricingSnapshotVersion: OPENAI_LISTING_IMAGE_PRICING_VERSION,
        estimatedCostUsd,
        actualCostUsd: computedActualCostUsd,
        usage: response.usage,
      },
    };
  }
}
