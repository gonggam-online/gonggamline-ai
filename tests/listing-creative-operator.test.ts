import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  createListingCreativeDispatchAuthorization,
  createListingCreativeWholePlanReservation,
  createPreparedListingCreativeDispatchPlan,
  formatListingCreativeOperatorPlanReference,
  parseListingCreativeOperatorPlanReference,
  preparedListingCreativeDispatchPlanDigest,
  validatePreparedListingCreativeDispatchPlan,
} from "../engines/listing/creative-operator.ts";
import { buildOpenAiListingImagePrompt } from "../engines/listing/openai-image-provider.ts";
import { materializeCreativeFactConstraints } from "../engines/listing/creative-planner.ts";
import {
  genericCommerceFields,
  genericListingInput,
} from "./fixtures/listing-content.ts";

const ADMINISTRATOR_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-08-14T12:00:00.000Z";

test("operator prepare creates a bounded generic fact-only paid plan", () => {
  const listingInput = genericListingInput();
  const plan = createPreparedListingCreativeDispatchPlan({
    listingInput,
    commerce: genericCommerceFields(),
    administratorUserId: ADMINISTRATOR_ID,
    preparedAt: NOW,
  });

  assert.equal(plan.jobs.length, 4);
  assert.equal(new Set(plan.jobs.map((job) => job.candidateSetId)).size, 2);
  assert.deepEqual(
    new Set(plan.jobs.map((job) => `${job.width}x${job.height}`)),
    new Set(["1024x1024", "1024x1536"]),
  );
  assert.ok(plan.estimatedMaximumCostUsd > 0);
  assert.ok(plan.estimatedMaximumCostUsd <= 2);
  assert.ok(plan.jobs.every((job) => job.transformation === "FACT_ONLY_SYNTHETIC"));
  assert.ok(plan.jobs.every((job) => job.inputAssetDigests.length === 0));
  assert.ok(plan.jobs.every((job) => job.inputSources.length === 0));
  assert.equal(plan.jobs[0].altText, "검증된 상품 사실 기반 대표 이미지 후보");
  assert.ok(plan.jobs.every((job) => !job.altText.includes("�")));
  const prompts = plan.jobs.map(buildOpenAiListingImagePrompt).join("\n");
  for (const fact of listingInput.evidence.facts) {
    assert.equal(prompts.includes(fact.factId), false);
    assert.equal(prompts.includes(fact.sourceReference), false);
  }
  assert.equal(preparedListingCreativeDispatchPlanDigest(plan), plan.reference.dispatchPlanDigest);
  validatePreparedListingCreativeDispatchPlan(plan, "2026-08-14T12:10:00.000Z", ADMINISTRATOR_ID);
  const locator = formatListingCreativeOperatorPlanReference(plan.reference);
  assert.deepEqual(parseListingCreativeOperatorPlanReference(locator), plan.reference);

  const repeated = createPreparedListingCreativeDispatchPlan({
    listingInput,
    commerce: genericCommerceFields(),
    administratorUserId: ADMINISTRATOR_ID,
    preparedAt: "2026-08-14T12:00:01.000Z",
  });
  assert.equal(repeated.reference.dispatchPlanDigest, plan.reference.dispatchPlanDigest);
  assert.notEqual(repeated.planIntegrityDigest, plan.planIntegrityDigest);
});

test("operator plan expires and cannot be authorized after the immutable window", () => {
  const plan = createPreparedListingCreativeDispatchPlan({
    listingInput: genericListingInput(),
    commerce: genericCommerceFields(),
    administratorUserId: ADMINISTRATOR_ID,
    preparedAt: NOW,
  });
  assert.throws(
    () => validatePreparedListingCreativeDispatchPlan(
      plan,
      "2026-08-14T12:15:00.000Z",
      ADMINISTRATOR_ID,
    ),
    /OPERATOR_PLAN_EXPIRED/,
  );
  assert.throws(
    () => validatePreparedListingCreativeDispatchPlan(
      { ...plan, expiresAt: "2026-08-14T12:20:00.000Z" },
      "2026-08-14T12:10:00.000Z",
      ADMINISTRATOR_ID,
    ),
    /OPERATOR_PLAN_INVALID/,
  );
  assert.throws(
    () => parseListingCreativeOperatorPlanReference(
      `${formatListingCreativeOperatorPlanReference(plan.reference)}.tampered`,
    ),
    /OPERATOR_PLAN_INVALID/,
  );
});

test("explicit expired-plan reprepare seed creates a new immutable locator", () => {
  const original = createPreparedListingCreativeDispatchPlan({
    listingInput: genericListingInput(),
    commerce: genericCommerceFields(),
    administratorUserId: ADMINISTRATOR_ID,
    preparedAt: NOW,
  });
  const reprepared = createPreparedListingCreativeDispatchPlan({
    listingInput: genericListingInput(),
    commerce: genericCommerceFields(),
    administratorUserId: ADMINISTRATOR_ID,
    preparedAt: "2026-08-15T04:58:00.000Z",
    preparationAttemptDigest: "a".repeat(64),
  });

  assert.notEqual(reprepared.reference.dispatchPlanDigest, original.reference.dispatchPlanDigest);
  assert.equal(reprepared.reference.subjectHash, original.reference.subjectHash);
  assert.equal(reprepared.reference.revisionDigest, original.reference.revisionDigest);
  assert.equal(reprepared.preparationAttemptDigest, "a".repeat(64));
  validatePreparedListingCreativeDispatchPlan(
    reprepared,
    "2026-08-15T05:00:00.000Z",
    ADMINISTRATOR_ID,
  );
});

test("authorization and whole-plan reservation bind exact operator and plan", () => {
  const plan = createPreparedListingCreativeDispatchPlan({
    listingInput: genericListingInput(),
    commerce: genericCommerceFields(),
    administratorUserId: ADMINISTRATOR_ID,
    preparedAt: NOW,
  });
  const authorization = createListingCreativeDispatchAuthorization({
    plan,
    administratorUserId: ADMINISTRATOR_ID,
    authorizedAt: "2026-08-14T12:01:00.000Z",
    confirmation: "AUTHORIZE_PAID_IMAGE_GENERATION",
  });
  const reservation = createListingCreativeWholePlanReservation({
    plan,
    authorization,
    reservedAt: "2026-08-14T12:01:01.000Z",
  });
  assert.equal(authorization.planReference.dispatchPlanDigest, plan.reference.dispatchPlanDigest);
  assert.equal(reservation.authorizationDigest, authorization.authorizationDigest);
  assert.match(reservation.reservationDigest, /^[a-f0-9]{64}$/);
});

test("creative fact materialization rejects URL, contact and private-marker values", () => {
  for (const unsafeValue of [
    "https://private.example/item.png",
    "owner@example.com",
    "+82-10-1234-5678",
    "service_role secret",
  ]) {
    const listingInput = genericListingInput();
    const facts = listingInput.evidence.facts.map((fact) => fact.field === "color"
      ? { ...fact, value: unsafeValue }
      : fact);
    assert.throws(
      () => materializeCreativeFactConstraints({
        ...listingInput,
        evidence: { ...listingInput.evidence, facts },
      }),
      /CREATIVE_FACT_VALUE_(?:NOT_ALLOWED|INVALID)/,
    );
  }
});

test("operator production path stops at private human review and contains no product hardcode", () => {
  const files = [
    "engines/listing/creative-operator.ts",
    "services/listing-creative-operator-dispatch.service.ts",
    "services/listing-creative-operator.repository.ts",
    "app/api/admin/listing/creative-dispatch/route.ts",
    "app/api/admin/listing/creative-dispatch/prepare/route.ts",
    "components/listing/listing-creative-operator.tsx",
  ];
  const source = files.map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");
  assert.equal(source.includes("KK946"), false);
  assert.equal(source.includes("publishApproved"), false);
  assert.equal(source.includes("mapApprovedCreativeRegistrationPayload"), false);
  assert.equal(source.includes("coupang-seller"), false);
  assert.match(source, /REVIEW_REQUIRED/);
  assert.match(source, /contentApproved:\s*false/);
  assert.match(source, /liveWriteApproved:\s*false/);
  assert.match(source, /reprepareExpiredPlanReference/);
  assert.match(source, /DISPATCH_REPREPARE_NOT_EXPIRED/);
  assert.match(source, /preparationAttemptDigest/);
});

test("dispatch route binds fresh admin, origin, JSON, CSRF and reservation before provider", () => {
  const route = readFileSync(
    resolve(process.cwd(), "app/api/admin/listing/creative-dispatch/route.ts"),
    "utf8",
  );
  const service = readFileSync(
    resolve(process.cwd(), "services/listing-creative-operator-dispatch.service.ts"),
    "utf8",
  );
  const orderedRouteMarkers = [
    "requireAdminRequest(request, \"mutation\")",
    "requireExactAdminOrigin(request)",
    "requireJsonContentType(request)",
    "verifyAdminCsrfToken(request, \"listing-creative-dispatch\"",
    "adminRateLimiter.consume",
    "boundedJson(request)",
  ];
  let previous = -1;
  for (const marker of orderedRouteMarkers) {
    const index = route.indexOf(marker);
    assert.ok(index > previous, `${marker} must remain in fail-closed order`);
    previous = index;
  }
  assert.ok(
    service.indexOf("repository.reserveWholePlan(reservation)")
      < service.indexOf("providerContextFactory({"),
  );
});
