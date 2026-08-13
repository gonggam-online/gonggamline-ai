import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildListingContentPacket, isLegacyListingDraft } from "../engines/listing/content-pipeline.ts";
import { genericCommerceFields, genericListingInput } from "./fixtures/listing-content.ts";

test("generic non-KK fixture produces a fully rendered registration-ready packet", () => {
  const result = buildListingContentPacket(genericListingInput(), genericCommerceFields());
  assert.equal(result.status, "REGISTRATION_READY");
  assert.equal(result.issues.length, 0);
  assert.equal(result.title.value, "정리 파우치 GL-01 네이비");
  assert.ok(result.title.tokens.every(({ provenance }) => provenance.factIds.length > 0));
  assert.ok(result.keywords.every(({ provenance }) => provenance.factIds.length > 0));
  assert.match(result.detailPage.html, /width:780px;max-width:100%/);
  assert.deepEqual(new Set(Object.values(result.detailPage.review)), new Set(["PASS"]));
  assert.ok(result.assets.every(({ review }) => Object.values(review).every((value) => value === "PASS")));
  assert.ok(result.registrationPayload);
  assert.equal(result.approval.contentApproved, true);
  assert.equal(result.approval.livePublishAuthorized, true);
  assert.equal(result.conversion.candidates.length, 2);
});

test("supplier use permission never escalates unknown edit permission", () => {
  const input = genericListingInput();
  const sourceAssets = input.sourceAssets.map((asset) => ({ ...asset, editRights: "UNKNOWN" as const }));
  const result = buildListingContentPacket({ ...input, sourceAssets }, genericCommerceFields());
  assert.equal(result.status, "OPTIMIZATION_PENDING");
  assert.ok(result.registrationPayload);
  assert.ok(result.issues.some(({ code, path, severity }) => code === "DERIVATIVE_UNAVAILABLE" && path === "assetRequests[1]" && severity === "WARNING"));
});

test("title and keyword policy removes unowned marks and blocks exaggerated claims", () => {
  const input = genericListingInput();
  const facts = input.evidence.facts.map((fact) => fact.field === "modelName" ? { ...fact, value: "경쟁사상표 최고" } : fact);
  const result = buildListingContentPacket({ ...input, evidence: { ...input.evidence, facts } }, genericCommerceFields());
  assert.equal(result.status, "REGISTRATION_BLOCKED");
  assert.ok(result.issues.some(({ code }) => code === "PROHIBITED_TITLE_TOKEN"));
  assert.ok(!result.title.value.includes("경쟁사상표"));
});

test("category and field-addressed registration validation fail closed", () => {
  const commerce = { ...genericCommerceFields(), displayCategoryCode: 99999, attributes: [], notices: [] };
  const result = buildListingContentPacket(genericListingInput(), commerce);
  assert.equal(result.status, "REGISTRATION_BLOCKED");
  assert.ok(result.issues.some(({ code, path }) => code === "CATEGORY_CODE_MISMATCH" && path === "commerce.displayCategoryCode"));
  assert.ok(result.issues.some(({ code }) => code === "MANDATORY_ATTRIBUTE_MISSING"));
  assert.ok(result.issues.some(({ code }) => code === "MANDATORY_NOTICE_MISSING"));
});

test("legacy listing_drafts can never be cast to registration-ready", () => {
  assert.equal(isLegacyListingDraft({ coupang_payload: {}, status: "approved" }), true);
  assert.equal(isLegacyListingDraft(buildListingContentPacket(genericListingInput(), genericCommerceFields())), false);
});

test("missing exact live commerce approval is the fifth stable registration blocker", () => {
  const commerce = { ...genericCommerceFields(), liveWriteApproval: { approved: false, approvalReference: "" } };
  const result = buildListingContentPacket(genericListingInput(), commerce);
  assert.equal(result.status, "REGISTRATION_BLOCKED");
  assert.ok(result.issues.some(({ code, path, severity }) => code === "LIVE_WRITE_APPROVAL_REQUIRED" && path === "commerce.liveWriteApproval" && severity === "BLOCKER"));
});

test("production pipeline contains no product-specific KK946 constant", () => {
  for (const file of ["shared/domain/listing-content.ts", "engines/listing/content-pipeline.ts", "components/listing/listing-content-review.tsx", "app/listing/review/page.tsx"]) {
    assert.doesNotMatch(readFileSync(join(process.cwd(), file), "utf8"), /KK946/);
  }
});
