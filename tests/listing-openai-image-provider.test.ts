import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createOpenAiListingImageProviderApproval,
  OPENAI_LISTING_IMAGE_PRICING_VERSION,
  OPENAI_LISTING_IMAGE_MODEL,
  OpenAiListingCreativeProvider,
  OpenAiListingImageError,
  OpenAiListingImageRevisionBudget,
  type OpenAiListingImageDispatchReservation,
  type OpenAiListingImageDispatchReservationInput,
  type OpenAiListingImageInput,
  type OpenAiListingImageTransport,
  type OpenAiListingImageTransportRequest,
  type OpenAiListingImageTransportResponse,
} from "../engines/listing/openai-image-provider.ts";
import {
  executeCreativeRenderJob,
  renderDeterministicFixturePng,
} from "../engines/listing/creative-renderer.ts";
import type {
  CreativeRenderJob,
  CreativeRightsCapabilities,
  CreativeSourceAuthorization,
} from "../shared/domain/listing-creative.ts";

const approval = createOpenAiListingImageProviderApproval({
  approvalReference: "approval:synthetic-provider-test-v1",
  paidUsageApproved: true,
  serverSecretApproved: true,
  managedAssetStoreApproved: true,
  outputCommercialUseApproved: true,
});

function job(overrides: Partial<CreativeRenderJob> = {}): CreativeRenderJob {
  return {
    jobId: "synthetic-job-a",
    candidateSetId: "synthetic-candidate-a",
    subjectReference: "fixture:synthetic-product:001",
    role: "MAIN",
    shotType: "PACKSHOT",
    transformation: "FACT_ONLY_SYNTHETIC",
    inputAssetDigests: [],
    inputSources: [],
    factIds: ["fact-product-type", "fact-color"],
    width: 1024,
    height: 1024,
    mimeType: "image/png",
    altText: "합성 검증 상품의 단독 이미지",
    factualConstraints: ["상품 유형은 소형 정리함이다.", "검증된 색상은 회색이다."],
    renderRecipeVersion: "synthetic-commerce-image-v1",
    provider: approval,
    ...overrides,
  };
}

class FakeTransport implements OpenAiListingImageTransport {
  readonly requests: OpenAiListingImageTransportRequest[] = [];

  constructor(
    private readonly responseFor: (
      request: OpenAiListingImageTransportRequest,
    ) => OpenAiListingImageTransportResponse,
  ) {}

  async execute(
    request: OpenAiListingImageTransportRequest,
  ): Promise<OpenAiListingImageTransportResponse> {
    this.requests.push(request);
    return this.responseFor(request);
  }
}

class FakeDispatchReservation implements OpenAiListingImageDispatchReservation {
  readonly calls: OpenAiListingImageDispatchReservationInput[] = [];
  private readonly requestHashes = new Set<string>();

  async reserve(input: OpenAiListingImageDispatchReservationInput): Promise<void> {
    if (this.requestHashes.has(input.requestHash)) {
      throw new Error("DUPLICATE_GENERATION_RESERVATION");
    }
    this.requestHashes.add(input.requestHash);
    this.calls.push(input);
  }
}

function responseFor(renderJob: CreativeRenderJob): OpenAiListingImageTransportResponse {
  return {
    b64Json: Buffer.from(renderDeterministicFixturePng(renderJob)).toString("base64"),
    providerRequestId: "provider-request-sensitive-reference",
    usage: {
      inputTextTokens: 60,
      inputImageTokens: 0,
      outputTokens: 196,
      totalTokens: 256,
    },
  };
}

function provider(
  renderJob: CreativeRenderJob,
  transport = new FakeTransport(() => responseFor(renderJob)),
  budget = new OpenAiListingImageRevisionBudget(),
) {
  const reservation = new FakeDispatchReservation();
  return {
    transport,
    reservation,
    provider: new OpenAiListingCreativeProvider(approval, transport, budget, reservation),
  };
}

async function rejectsCode(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) =>
    error instanceof OpenAiListingImageError && error.code === code);
}

test("fact-only generation pins the exact model and records only sanitized execution evidence", async () => {
  const renderJob = job();
  const context = provider(renderJob);
  const artifact = await executeCreativeRenderJob(renderJob, context.provider);

  assert.equal(context.transport.requests.length, 1);
  assert.deepEqual(context.transport.requests[0] && {
    operation: context.transport.requests[0].operation,
    model: context.transport.requests[0].model,
    size: context.transport.requests[0].size,
    quality: context.transport.requests[0].quality,
    outputFormat: context.transport.requests[0].outputFormat,
    inputCount: context.transport.requests[0].inputs.length,
  }, {
    operation: "GENERATE",
    model: OPENAI_LISTING_IMAGE_MODEL,
    size: "1024x1024",
    quality: "high",
    outputFormat: "png",
    inputCount: 0,
  });
  assert.equal(artifact.providerExecution?.operation, "GENERATE");
  assert.match(artifact.providerExecution?.requestHash ?? "", /^[a-f0-9]{64}$/);
  assert.match(artifact.providerExecution?.promptDigest ?? "", /^[a-f0-9]{64}$/);
  assert.equal(
    artifact.providerExecution?.sanitizedProviderRequestHash,
    createHash("sha256").update("provider-request-sensitive-reference").digest("hex"),
  );
  assert.equal(JSON.stringify(artifact).includes("provider-request-sensitive-reference"), false);
  assert.equal(artifact.deployability, "NONDEPLOYABLE");
  assert.equal(artifact.review.decode, "PASS");
  assert.equal(artifact.review.dimensions, "PASS");
  assert.equal(artifact.review.sourceRights, "PASS");
  assert.equal(artifact.review.deployability, "FAIL");
});

const verifiedRights: CreativeRightsCapabilities = {
  commercialUnchangedUse: "VERIFIED",
  marketplaceRedistribution: "VERIFIED",
  technicalReencode: "VERIFIED",
  resizeResample: "VERIFIED",
  crop: "VERIFIED",
  backgroundRemoval: "VERIFIED",
  textOverlay: "VERIFIED",
  composite: "VERIFIED",
  providerUpload: "VERIFIED",
  generativeReference: "VERIFIED",
  syntheticOutputCommercialUse: "VERIFIED",
};

function source(rights: CreativeRightsCapabilities = verifiedRights): CreativeSourceAuthorization {
  return {
    assetDigest: "a".repeat(64),
    sourceClass: "OWN_PHOTOGRAPHY",
    rights,
    grantReference: "fixture:owned-photo-grant",
    snapshotVersion: "fixture-owned-photo-v1",
    snapshotDigest: "b".repeat(64),
    expiresAt: null,
    revokedAt: null,
  };
}

test("a rights-verified edit resolves exact private bytes and includes a preflight input-cost estimate", async () => {
  const inputSource = source();
  const renderJob = job({
    jobId: "synthetic-edit-a",
    transformation: "CROP",
    inputAssetDigests: [inputSource.assetDigest],
    inputSources: [inputSource],
  });
  const transport = new FakeTransport(() => responseFor(renderJob));
  const input: OpenAiListingImageInput = {
    assetDigest: inputSource.assetDigest,
    bytes: Uint8Array.from([137, 80, 78, 71]),
    mimeType: "image/png",
    estimatedInputTokens: 1_000,
    costEstimateReference: "fixture:official-image-input-estimate",
    pricingSnapshotVersion: OPENAI_LISTING_IMAGE_PRICING_VERSION,
  };
  const externalProvider = new OpenAiListingCreativeProvider(
    approval,
    transport,
    new OpenAiListingImageRevisionBudget(),
    new FakeDispatchReservation(),
    { async resolve(digest) { return digest === input.assetDigest ? input : null; } },
  );
  const artifact = await executeCreativeRenderJob(renderJob, externalProvider);

  assert.equal(transport.requests[0]?.operation, "EDIT");
  assert.equal(transport.requests[0]?.inputs[0]?.assetDigest, inputSource.assetDigest);
  assert.equal(artifact.providerExecution?.usage.inputImageTokens, 0);
  assert.ok((artifact.providerExecution?.estimatedCostUsd ?? 0) > 0.211);

  const changedRightsJob = {
    ...renderJob,
    inputSources: [{ ...inputSource, snapshotDigest: "c".repeat(64) }],
  };
  const changedTransport = new FakeTransport(() => responseFor(changedRightsJob));
  await new OpenAiListingCreativeProvider(
    approval,
    changedTransport,
    new OpenAiListingImageRevisionBudget(),
    new FakeDispatchReservation(),
    { async resolve() { return input; } },
  ).render(changedRightsJob);
  assert.notEqual(
    changedTransport.requests[0]?.idempotencyKey,
    transport.requests[0]?.idempotencyKey,
  );
});

test("unknown provider-upload rights and observation pixels fail before transport", async () => {
  for (const inputSource of [
    source({ ...verifiedRights, providerUpload: "UNKNOWN" }),
    { ...source(), sourceClass: "MARKET_OBSERVATION" as const },
  ]) {
    const renderJob = job({
      transformation: "GENERATIVE_REFERENCE",
      inputAssetDigests: [inputSource.assetDigest],
      inputSources: [inputSource],
    });
    const context = provider(renderJob);
    await assert.rejects(
      executeCreativeRenderJob(renderJob, context.provider),
      /CREATIVE_SOURCE_RIGHTS_DENIED/,
    );
    assert.equal(context.transport.requests.length, 0);
  }
});

test("edit jobs fail closed without exact bytes or a positive image-token estimate", async () => {
  const inputSource = source();
  const renderJob = job({
    transformation: "CROP",
    inputAssetDigests: [inputSource.assetDigest],
    inputSources: [inputSource],
  });
  const transport = new FakeTransport(() => responseFor(renderJob));
  await rejectsCode(
    new OpenAiListingCreativeProvider(
      approval,
      transport,
      new OpenAiListingImageRevisionBudget(),
      new FakeDispatchReservation(),
    ).render(renderJob),
    "OPENAI_IMAGE_INPUT_RESOLVER_REQUIRED",
  );
  await rejectsCode(
    new OpenAiListingCreativeProvider(
      approval,
      transport,
      new OpenAiListingImageRevisionBudget(),
      new FakeDispatchReservation(),
      {
        async resolve(digest) {
          return {
            assetDigest: digest,
            bytes: Uint8Array.from([1]),
            mimeType: "image/png",
            estimatedInputTokens: 0,
            costEstimateReference: "fixture:missing-estimate",
            pricingSnapshotVersion: OPENAI_LISTING_IMAGE_PRICING_VERSION,
          };
        },
      },
    ).render(renderJob),
    "OPENAI_IMAGE_INPUT_COST_ESTIMATE_REQUIRED",
  );
  assert.equal(transport.requests.length, 0);
});

test("budget guard stops the seventh output, a third attempt, and cap crossing before spend", () => {
  const outputBudget = new OpenAiListingImageRevisionBudget();
  for (let index = 0; index < 6; index += 1) {
    outputBudget.reserve(`job-${index}`, 0.1);
  }
  assert.throws(
    () => outputBudget.reserve("job-7", 0.1),
    (error: unknown) => error instanceof OpenAiListingImageError
      && error.code === "OPENAI_IMAGE_OUTPUT_LIMIT_EXCEEDED",
  );

  const retryBudget = new OpenAiListingImageRevisionBudget();
  retryBudget.reserve("retry-job", 0.1);
  retryBudget.reserve("retry-job", 0.1);
  assert.throws(
    () => retryBudget.reserve("retry-job", 0.1),
    (error: unknown) => error instanceof OpenAiListingImageError
      && error.code === "OPENAI_IMAGE_ATTEMPT_LIMIT_EXCEEDED",
  );

  const costBudget = new OpenAiListingImageRevisionBudget();
  costBudget.reserve("cost-job-a", 1.5);
  assert.throws(
    () => costBudget.reserve("cost-job-b", 0.500001),
    (error: unknown) => error instanceof OpenAiListingImageError
      && error.code === "OPENAI_IMAGE_BUDGET_EXCEEDED",
  );

  const actualBudget = new OpenAiListingImageRevisionBudget();
  actualBudget.commitActual(1.2);
  assert.throws(
    () => actualBudget.commitActual(0.800001),
    (error: unknown) => error instanceof OpenAiListingImageError
      && error.code === "OPENAI_IMAGE_BUDGET_EXCEEDED",
  );
});

test("unsupported sizes and malformed provider output never become artifacts", async () => {
  const renderJob = job({ width: 1000, height: 1000 });
  const context = provider(renderJob);
  await rejectsCode(context.provider.render(renderJob), "OPENAI_IMAGE_SIZE_NOT_PRICED");
  assert.equal(context.transport.requests.length, 0);

  const validJob = job();
  const malformed = new FakeTransport(() => ({
    ...responseFor(validJob),
    b64Json: "not-base64",
  }));
  await rejectsCode(
    new OpenAiListingCreativeProvider(
      approval,
      malformed,
      new OpenAiListingImageRevisionBudget(),
      new FakeDispatchReservation(),
    ).render(validJob),
    "OPENAI_IMAGE_RESPONSE_INVALID",
  );
});

test("a durable immutable dispatch reservation is required before every paid call", async () => {
  const renderJob = job({ jobId: "reservation-gate-job" });
  const context = provider(renderJob);

  await context.provider.render(renderJob);
  await assert.rejects(
    context.provider.render(renderJob),
    /DUPLICATE_GENERATION_RESERVATION/,
  );

  assert.equal(context.reservation.calls.length, 1);
  assert.equal(context.transport.requests.length, 1);
  assert.equal(
    context.reservation.calls[0]?.requestHash,
    context.transport.requests[0]?.idempotencyKey,
  );
});

test("provider production sources are server-only, secret-injected, and product-agnostic", async () => {
  const [engine, transport, service, packageJson] = await Promise.all([
    readFile(new URL("../engines/listing/openai-image-provider.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/listing/openai-image-transport.server.ts", import.meta.url), "utf8"),
    readFile(new URL("../services/listing-image-provider.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(engine, /process\.env|OPENAI_API_KEY|KK946|4290|4,290|Domeggook/i);
  assert.match(transport, /import "server-only"/);
  assert.doesNotMatch(transport, /process\.env|OPENAI_API_KEY|KK946|4290|Domeggook/i);
  assert.match(service, /import "server-only"/);
  assert.match(service, /process\.env\.OPENAI_API_KEY/);
  assert.match(service, /process\.env\.VERCEL_ENV !== "production"/);
  assert.match(service, /maxRetries: 0/);
  assert.match(service, /storage\.reserveGeneration/);
  assert.doesNotMatch(service, /NEXT_PUBLIC_OPENAI|KK946|4290|4,290|Domeggook/i);
  assert.equal(JSON.parse(packageJson).dependencies.openai, "7.4.0");
});
