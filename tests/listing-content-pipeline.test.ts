import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
  assert.ok(result.title.tokens.some(({ provenance }) => provenance.policyRuleIds.includes("coupang-marketplace-search-guide")));
  assert.ok(result.keywords.every(({ provenance }) => provenance.factIds.length > 0));
  assert.match(result.detailPage.html, /width:780px;max-width:100%/);
  assert.deepEqual(new Set(Object.values(result.detailPage.review)), new Set(["PASS"]));
  assert.ok(result.assets.every(({ review }) => Object.values(review).every((value) => value === "PASS")));
  assert.ok(result.registrationPayload);
  assert.equal(result.approval.contentApproved, true);
  assert.equal(result.approval.livePublishAuthorized, true);
  assert.equal(result.conversion.candidates.length, 2);
  assert.notEqual(result.conversion.candidates[0].title, result.conversion.candidates[1].title);
  assert.equal(result.selectedVariantId, "A");
  assert.deepEqual(result.generation, { mode: "DETERMINISTIC", externalTextProviderUsed: false, generatedAssetCount: 0, providerApprovalRequiredForGenerativeReference: true });
  assert.ok(result.conversion.sourceSnapshots.some(({ kind, priority }) => kind === "COUPANG_OFFICIAL" && priority === 1));
  const items = result.registrationPayload?.items;
  assert.ok(Array.isArray(items));
  assert.deepEqual((items[0] as Record<string, unknown>).searchTags, result.keywords.map(({ text }) => text));
  const notices = (items[0] as Record<string, unknown>).notices;
  assert.ok(Array.isArray(notices));
  assert.deepEqual(notices[0], { noticeCategoryName: "기타 재화", noticeCategoryDetailName: "품명 및 모델명", content: "정리 파우치 GL-01" });
});

test("one human-approved variant alone is mapped to the live payload", () => {
  const input = genericListingInput();
  assert.ok(input.contentApproval);
  const result = buildListingContentPacket({ ...input, contentApproval: { ...input.contentApproval, selectedVariantId: "B" } }, genericCommerceFields());
  assert.equal(result.selectedVariantId, "B");
  assert.equal(result.title.value, result.conversion.candidates[1].title);
  assert.equal(result.registrationPayload?.sellerProductName, result.conversion.candidates[1].title);
  assert.ok(result.detailPage.html.includes(result.conversion.candidates[1].title));
});

test("Coupang keyword character rules exclude invalid candidates without blocking registration", () => {
  const input = genericListingInput();
  const facts = input.evidence.facts.map((fact) => fact.field === "keywords" ? { ...fact, value: "파우치,정리" } : fact);
  const result = buildListingContentPacket({ ...input, evidence: { ...input.evidence, facts } }, genericCommerceFields());
  assert.equal(result.status, "REGISTRATION_READY");
  assert.ok(result.registrationPayload);
  assert.ok(result.issues.some(({ code, severity }) => code === "KEYWORD_CHARACTER_NOT_ALLOWED" && severity === "WARNING"));
  assert.ok(!result.keywords.some(({ text }) => text.includes(",")));
});

test("owner-approved fallback carries assumption provenance and is warning-only", () => {
  const input = genericListingInput();
  const evidence = { ...input.evidence, requiredFields: [...input.evidence.requiredFields, "importer"] };
  const result = buildListingContentPacket({ ...input, evidence, minimumRequiredFields: [...input.minimumRequiredFields, "importer"], detailClaims: [...input.detailClaims, { blockType: "NOTICE", heading: "수입자", field: "importer", priority: 5 }], ownerApprovedFallbacks: [{ targetField: "importer", value: "Fixture Maker", assumption: "category permits manufacturer/importer combined value", approvalReference: "fixture:owner:fallback", provenanceFactIds: ["fixture-fact-1"], categoryAllowsFallback: true }] }, genericCommerceFields());
  assert.equal(result.status, "REGISTRATION_READY");
  assert.ok(result.registrationPayload);
  assert.ok(result.assumptions.some(({ targetField }) => targetField === "importer"));
  assert.ok(result.detailPage.blocks.some(({ provenance }) => provenance.policyRuleIds.includes("OWNER_APPROVED_FALLBACK")));
});

test("supplier use permission never escalates unknown edit permission", () => {
  const input = genericListingInput();
  const sourceAssets = input.sourceAssets.map((asset) => ({ ...asset, editRights: "UNKNOWN" as const }));
  const result = buildListingContentPacket({ ...input, sourceAssets }, genericCommerceFields());
  assert.equal(result.status, "REGISTRATION_READY");
  assert.ok(result.registrationPayload);
  assert.ok(result.issues.some(({ code, path, severity }) => code === "DERIVATIVE_UNAVAILABLE" && path === "assetRequests[1]" && severity === "WARNING"));
});

test("revoked supplier trust profile forces selected payload reevaluation", () => {
  const input = genericListingInput();
  const result = buildListingContentPacket({ ...input, supplierTrust: { ...input.supplierTrust, status: "REVOKED" } }, genericCommerceFields());
  assert.equal(result.status, "REGISTRATION_BLOCKED");
  assert.ok(result.issues.some(({ code, blockerClass }) => code === "SUPPLIER_TRUST_PROFILE_INVALID" && blockerClass === "PAYLOAD_VALIDATION_FAILED"));
});

test("title and keyword policy removes unowned marks without blocking the cleaned payload", () => {
  const input = genericListingInput();
  const facts = input.evidence.facts.map((fact) => fact.field === "modelName" ? { ...fact, value: "경쟁사상표 최고" } : fact);
  const result = buildListingContentPacket({ ...input, evidence: { ...input.evidence, facts } }, genericCommerceFields());
  assert.equal(result.status, "REGISTRATION_READY");
  assert.ok(result.issues.some(({ code, severity }) => code === "PROHIBITED_TITLE_TOKEN" && severity === "WARNING"));
  assert.ok(!result.title.value.includes("경쟁사상표"));
});

test("a prohibited claim actually selected in a registration field is blocked", () => {
  const commerce = { ...genericCommerceFields(), notices: [{ name: "품명 및 모델명", value: "무조건 최고 정리 파우치", factIds: ["fixture-fact-1"] }] };
  const result = buildListingContentPacket(genericListingInput(), commerce);
  assert.equal(result.status, "REGISTRATION_BLOCKED");
  assert.equal(result.registrationPayload, null);
  assert.ok(result.issues.some(({ code, blockerClass }) => code === "PROHIBITED_REGISTRATION_FIELD" && blockerClass === "PROHIBITED_PAYLOAD_CONTENT"));
});

test("category and field-addressed registration validation fail closed", () => {
  const commerce = { ...genericCommerceFields(), displayCategoryCode: 99999, attributes: [], searchFilters: [], notices: [] };
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

test("every registration blocker maps to exactly one of the five owner-approved classes", () => {
  const commerce = { ...genericCommerceFields(), liveWriteApproval: { approved: false, approvalReference: "" }, attributes: [], searchFilters: [], notices: [] };
  const result = buildListingContentPacket(genericListingInput(), commerce);
  const allowed = new Set(["REQUIRED_FIELD_MISSING", "CORE_FACT_CONFLICT", "PROHIBITED_PAYLOAD_CONTENT", "PAYLOAD_VALIDATION_FAILED", "LIVE_WRITE_APPROVAL_MISSING"]);
  assert.ok(result.issues.some(({ severity }) => severity === "BLOCKER"));
  assert.ok(result.issues.filter(({ severity }) => severity === "BLOCKER").every(({ blockerClass }) => blockerClass !== null && allowed.has(blockerClass)));
  assert.ok(result.issues.filter(({ severity }) => severity !== "BLOCKER").every(({ blockerClass }) => blockerClass === null));
});

test("production pipeline contains no product-specific KK946 constant", () => {
  const pending = ["app", "components", "engines", "services", "shared"].map((directory) => join(process.cwd(), directory));
  while (pending.length > 0) {
    const directory = pending.pop();
    assert.ok(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (/\.(ts|tsx)$/.test(entry.name)) assert.doesNotMatch(readFileSync(path, "utf8"), /KK946/i, path);
    }
  }
});

test("listing implementation and review UI remain UTF-8 NFC without replacement mojibake", () => {
  for (const file of ["engines/listing/index.ts", "services/listing.service.ts", "engines/listing/content-pipeline.ts", "engines/listing/marketplace-policy.ts", "components/listing/listing-content-review.tsx", "app/listing/review/page.tsx"]) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.equal(source, source.normalize("NFC"), file);
    assert.doesNotMatch(source, /\uFFFD|怨듦컧|利앷굅|肄섑뀗痢|誘몄듅/, file);
  }
});
