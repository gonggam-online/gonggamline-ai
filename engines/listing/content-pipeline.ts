import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { evaluateListingEvidence, hasValidListingEncoding } from "@/engines/listing/evidence-policy";
import type { ListingEvidenceFact } from "@/shared/domain/listing-evidence";
import {
  LISTING_CONTENT_PACKET_VERSION,
  type ListingAssetManifestEntry,
  type ListingContentInput,
  type ListingContentPacket,
  type ListingPipelineIssue,
  type MarketplacePolicySnapshot,
  type ProvenancedText,
  type RegistrationCommerceFields,
} from "@/shared/domain/listing-content";
import { validateCoupangProductPayload } from "@/lib/coupang/validator";

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]+$/u;
const DERIVATIVE = new Set(["CROP", "BACKGROUND_REMOVAL", "TEXT_OVERLAY", "COMPOSITE", "GENERATIVE_REFERENCE"]);

function normalize(value: string): string {
  return value.normalize("NFC").replace(/[\[\]{}<>|]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedKey(value: string): string {
  return normalize(value).toLocaleLowerCase("ko-KR").replace(/[\s_-]+/g, "");
}

function issue(issues: ListingPipelineIssue[], code: string, path: string, message: string, severity: ListingPipelineIssue["severity"] = "BLOCKER"): void {
  issues.push({ code, path, message, severity });
}

function prohibited(value: string, policy: MarketplacePolicySnapshot): boolean {
  const key = normalizedKey(value);
  const fixed = [...policy.forbiddenTerms, ...policy.competitorMarks].some((term) => key.includes(normalizedKey(term)));
  if (fixed) return true;
  return policy.prohibitedClaimPatterns.some((pattern) => {
    try { return new RegExp(pattern, "iu").test(value); } catch { return true; }
  });
}

function provenByField(facts: readonly ListingEvidenceFact[], field: string): ListingEvidenceFact[] {
  return facts.filter((fact) => fact.field === field && fact.status === "PROVEN");
}

function textFromFact(fact: ListingEvidenceFact, ruleId: string): ProvenancedText | null {
  const value = normalize(String(fact.value ?? ""));
  return value ? { text: value, provenance: { factIds: [fact.factId], policyRuleIds: [ruleId] } } : null;
}

function renderAssets(input: ListingContentInput, issues: ListingPipelineIssue[]): ListingAssetManifestEntry[] {
  return input.assetRequests.map((request, index) => {
    const source = input.sourceAssets.find(({ assetId }) => assetId === request.sourceAssetId);
    const path = `assetRequests[${index}]`;
    const derivative = DERIVATIVE.has(request.transformation);
    const rightsPass = source !== undefined && source.useRights === "VERIFIED" &&
      (!derivative || (source.editRights === "VERIFIED" && source.permittedTransformations.includes(request.transformation))) &&
      source.permittedChannels.includes("COUPANG");
    const dimensionsPass = request.width > 0 && request.height > 0 && request.width <= 10000 && request.height <= 10000;
    const mimePass = Boolean(source) && request.mimeType.startsWith("image/");
    const digestPass = SHA256.test(request.outputDigest);
    const accuracyPass = source?.productAccuracyStatus === "VERIFIED";
    const altPass = normalize(request.altText).length >= 4 && hasValidListingEncoding(request.altText);
    if (!source) issue(issues, "SOURCE_ASSET_MISSING", `${path}.sourceAssetId`, "원본 자산이 manifest에 없습니다.");
    if (!rightsPass) issue(issues, derivative ? "DERIVATIVE_UNAVAILABLE" : "IMAGE_USE_RIGHTS_REQUIRED", path, derivative ? "편집권이 없어 이 파생 variant만 제외됩니다." : "원본 사용권과 채널 권한이 필요합니다.", derivative ? "WARNING" : "BLOCKER");
    if (!accuracyPass) issue(issues, "PRODUCT_ACCURACY_UNVERIFIED", path, "실제 상품 표현 정확성이 검증되지 않았습니다.");
    if (!dimensionsPass) issue(issues, "INVALID_ASSET_DIMENSIONS", path, "이미지 크기가 유효하지 않습니다.");
    if (!digestPass) issue(issues, "INVALID_ASSET_DIGEST", path, "SHA-256 digest가 필요합니다.");
    if (!altPass) issue(issues, "INVALID_ALT_TEXT", path, "검토 가능한 한글/영문 대체 텍스트가 필요합니다.");
    return {
      ...request,
      disposition: rightsPass && accuracyPass && dimensionsPass && mimePass && digestPass && altPass ? "INCLUDED" : derivative ? "DERIVATIVE_UNAVAILABLE" : "INCLUDED",
      provenanceFactIds: source?.provenanceFactIds ?? [],
      sourceReference: source?.sourceReference ?? "",
      useRights: source?.useRights ?? "UNKNOWN",
      editRights: source?.editRights ?? "UNKNOWN",
      review: {
        dimensions: dimensionsPass ? "PASS" : "FAIL",
        mime: mimePass ? "PASS" : "FAIL",
        digest: digestPass ? "PASS" : "FAIL",
        rights: rightsPass ? "PASS" : "FAIL",
        productAccuracy: accuracyPass ? "PASS" : "FAIL",
        altText: altPass ? "PASS" : "FAIL",
      },
    };
  });
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function buildListingContentPacket(
  input: ListingContentInput,
  commerce?: RegistrationCommerceFields,
): ListingContentPacket {
  const issues: ListingPipelineIssue[] = [];
  const evidenceDecision = evaluateListingEvidence(input.evidence);
  if (evidenceDecision.disposition !== "ADMITTED") {
    for (const entry of evidenceDecision.issues) {
      const blocker = input.minimumRequiredFields.includes(entry.field) ||
        (entry.code === "CONFLICTING_FACTS" && input.corePurchaseFields.includes(entry.field)) ||
        entry.code === "PROHIBITED_FACT";
      issue(issues, entry.code, `evidence.${entry.field}`, "증거 정책 검토가 필요합니다.", blocker ? "BLOCKER" : "WARNING");
    }
  }
  if (input.subjectId !== input.evidence.subjectId) issue(issues, "SUBJECT_MISMATCH", "subjectId", "증거 packet의 상품 식별자가 일치하지 않습니다.");
  if (input.category.disposition !== "VALIDATED" || !input.category.categoryValid) issue(issues, "CATEGORY_NOT_VALIDATED", "category", "정확한 Coupang 카테고리 snapshot이 유효하지 않습니다.");
  if (String(commerce?.displayCategoryCode ?? "") !== input.category.displayCategoryCode) issue(issues, "CATEGORY_CODE_MISMATCH", "commerce.displayCategoryCode", "등록 필드와 category snapshot의 코드가 다릅니다.");
  if (!SHA256.test(input.policy.digest)) issue(issues, "INVALID_POLICY_DIGEST", "policy.digest", "정책 snapshot digest가 유효하지 않습니다.");
  const contentApproved = input.contentApproval?.decision === "APPROVED_FOR_PAYLOAD_MAPPING" &&
    input.contentApproval.reviewerReference.length > 0 &&
    input.contentApproval.evidenceEvaluationId === input.evidence.evaluationId &&
    input.contentApproval.policyDigest === input.policy.digest &&
    input.contentApproval.categoryMetadataDigest === input.category.metadataDigest;
  if (!contentApproved) issue(issues, "CONTENT_APPROVAL_REQUIRED", "contentApproval", "정확한 evidence/category/policy 버전에 대한 콘텐츠 승인이 필요합니다.");

  const blockedFields = new Set(evidenceDecision.issues.filter(({ code }) => code !== "UNKNOWN_REQUIRED_FACT").map(({ field }) => field));
  const admitted = input.evidence.facts.filter((fact) => fact.status === "PROVEN" && !blockedFields.has(fact.field));
  const titleTokens = input.titleFieldOrder.flatMap((field) => provenByField(admitted, field).slice(0, 1)).map((fact) => textFromFact(fact, "TITLE_EVIDENCE_TOKEN")).filter((entry): entry is ProvenancedText => entry !== null);
  const safeTitleTokens = titleTokens.filter((entry) => {
    if (prohibited(entry.text, input.policy)) {
      issue(issues, "PROHIBITED_TITLE_TOKEN", "title", `금칙어 또는 권리 미확인 상표가 포함된 제목 토큰: ${entry.text}`);
      return false;
    }
    return true;
  });
  const title = safeTitleTokens.map(({ text }) => text).join(" ");
  if (!title) issue(issues, "TITLE_REQUIRED", "title", "증거 기반 제목 토큰이 없습니다.");
  if (title.length > input.policy.titleMaxLength) issue(issues, "TITLE_LIMIT_EXCEEDED", "title", "정책 snapshot의 제목 길이 제한을 초과했습니다.");
  if (!hasValidListingEncoding(title) || !SAFE_TEXT.test(title)) issue(issues, "INVALID_ENCODING", "title", "제목 인코딩이 안전하지 않습니다.");

  const keywordCandidates = input.keywordFields.flatMap((field) => provenByField(admitted, field)).map((fact) => textFromFact(fact, "KEYWORD_EVIDENCE_DERIVATION")).filter((entry): entry is ProvenancedText => entry !== null);
  const deduped = [...new Map(keywordCandidates.map((entry) => [normalizedKey(entry.text), entry])).values()]
    .filter((entry) => !prohibited(entry.text, input.policy) && entry.text.length <= input.policy.keywordMaxLength)
    .slice(0, input.policy.keywordMaxCount);
  if (keywordCandidates.length > input.policy.keywordMaxCount * 2) issue(issues, "KEYWORD_STUFFING", "keywords", "정책 한도의 두 배를 넘는 후보는 제외됩니다.", "WARNING");

  const blocks = input.detailClaims.map(({ heading, field }) => {
    const facts = provenByField(admitted, field);
    const body = facts.map(({ value }) => normalize(String(value ?? ""))).filter(Boolean).join(" · ");
    if (!body) issue(issues, "DETAIL_CLAIM_EVIDENCE_MISSING", `detail.${field}`, "상세 문구의 근거가 없어 블록을 생략해야 합니다.", "WARNING");
    if (prohibited(`${heading} ${body}`, input.policy)) issue(issues, "PROHIBITED_DETAIL_CLAIM", `detail.${field}`, "금지되거나 근거 없는 상세 claim입니다.");
    return { text: `${normalize(heading)}: ${body}`, provenance: { factIds: facts.map(({ factId }) => factId), policyRuleIds: ["DETAIL_EVIDENCE_SENTENCE"] } };
  });
  const assets = renderAssets(input, issues);
  if (!assets.some(({ role, disposition, review }) => role === "MAIN" && disposition === "INCLUDED" && Object.values(review).every((value) => value === "PASS"))) issue(issues, "MAIN_ASSET_REQUIRED", "assets", "검증을 통과한 대표 이미지가 필요합니다.");
  if (!assets.some(({ role, disposition }) => role === "DETAIL" && disposition === "INCLUDED")) issue(issues, "DETAIL_ASSET_PENDING", "assets", "추가 상세 이미지가 없어 텍스트 중심 상세페이지를 사용합니다.", "OPTIMIZATION_PENDING");

  const html = `<article data-listing-packet="${escapeHtml(input.packetId)}" style="width:780px;max-width:100%;font-family:Arial,'Noto Sans KR',sans-serif;color:#171717;line-height:1.65"><h1 style="font-size:30px">${escapeHtml(title)}</h1>${blocks.map((block) => `<section style="padding:24px 20px;border-bottom:1px solid #ddd"><p style="font-size:22px;margin:0">${escapeHtml(block.text)}</p></section>`).join("")}</article>`;
  const detailReview = {
    encoding: hasValidListingEncoding(html) ? "PASS" as const : "FAIL" as const,
    mobileWidth: html.includes("width:780px;max-width:100%") ? "PASS" as const : "FAIL" as const,
    readability: blocks.every(({ text }) => text.length >= 5) ? "PASS" as const : "FAIL" as const,
    assetReferences: assets.some(({ disposition }) => disposition === "INCLUDED") ? "PASS" as const : "FAIL" as const,
    claims: blocks.every(({ provenance }) => provenance.factIds.length > 0) ? "PASS" as const : "FAIL" as const,
  };
  for (const [name, result] of Object.entries(detailReview)) if (result === "FAIL") issue(issues, "DETAIL_VISUAL_QA_FAILED", `detailPage.review.${name}`, "모바일 상세페이지 visual QA가 실패했습니다.");

  let registrationPayload: Record<string, unknown> | null = null;
  if (commerce) {
    if (!commerce.liveWriteApproval.approved || !commerce.liveWriteApproval.approvalReference) issue(issues, "LIVE_WRITE_APPROVAL_REQUIRED", "commerce.liveWriteApproval", "정확한 선택 variant/payload에 대한 별도 live commerce-write 승인이 필요합니다.");
    for (const required of input.category.attributes.filter(({ required }) => required === "MANDATORY")) {
      if (!commerce.attributes.some(({ name, value }) => name === required.attributeTypeName && normalize(value))) {
        issue(issues, "MANDATORY_ATTRIBUTE_MISSING", `commerce.attributes.${required.attributeTypeName}`, "category snapshot의 필수 속성이 없습니다.");
      }
    }
    const noticeCategory = input.category.noticeCategories.find(({ noticeCategoryName }) => noticeCategoryName === input.category.selectedNoticeCategoryName);
    if (!noticeCategory) issue(issues, "NOTICE_CATEGORY_MISSING", "commerce.notices", "선택된 상품고시 category가 없습니다.");
    for (const required of noticeCategory?.detailNames.filter(({ required }) => required === "MANDATORY") ?? []) {
      if (!commerce.notices.some(({ name, value }) => name === required.noticeCategoryDetailName && normalize(value))) {
        issue(issues, "MANDATORY_NOTICE_MISSING", `commerce.notices.${required.noticeCategoryDetailName}`, "category snapshot의 필수 고시 필드가 없습니다.");
      }
    }
    registrationPayload = {
      displayCategoryCode: commerce.displayCategoryCode,
      sellerProductName: title,
      saleStartedAt: commerce.saleStartedAt,
      saleEndedAt: commerce.saleEndedAt,
      displayProductName: title,
      generalProductName: safeTitleTokens[0]?.text ?? "",
      deliveryMethod: commerce.deliveryMethod,
      deliveryChargeType: commerce.deliveryChargeType,
      returnCenterCode: commerce.returnCenterCode,
      companyContactNumber: commerce.companyContactNumber,
      returnZipCode: commerce.returnZipCode,
      returnAddress: commerce.returnAddress,
      returnAddressDetail: commerce.returnAddressDetail,
      outboundShippingPlaceCode: commerce.outboundShippingPlaceCode,
      vendorUserId: commerce.vendorUserId,
      items: [{
        itemName: title,
        originalPrice: commerce.originalPrice,
        salePrice: commerce.salePrice,
        maximumBuyCount: commerce.maximumBuyCount,
        stockQuantity: commerce.stockQuantity,
        images: assets.filter(({ role, disposition }) => disposition === "INCLUDED" && (role === "MAIN" || role === "ADDITIONAL")).map((asset, imageOrder) => ({ imageOrder, imageType: imageOrder === 0 ? "REPRESENTATION" : "DETAIL", vendorPath: asset.sourceReference })),
        attributes: commerce.attributes.map(({ name, value }) => ({ attributeTypeName: name, attributeValueName: value })),
        contents: [{ contentsType: "HTML", contentDetails: [{ content: html, detailType: "TEXT" }] }],
        notices: commerce.notices.map(({ name, value }) => ({ name, value })),
      }],
    };
    for (const payloadIssue of validateCoupangProductPayload(registrationPayload)) issue(issues, "REGISTRATION_FIELD_INVALID", payloadIssue.path, payloadIssue.message);
    if (commerce.stockQuantity < 0 || !Number.isInteger(commerce.stockQuantity)) issue(issues, "REGISTRATION_FIELD_INVALID", "items[0].stockQuantity", "재고는 0 이상의 정수여야 합니다.");
    if (commerce.attributes.some(({ factIds }) => factIds.length === 0) || commerce.notices.some(({ factIds }) => factIds.length === 0)) issue(issues, "FIELD_PROVENANCE_REQUIRED", "commerce", "속성·고시 필드는 증거 fact를 참조해야 합니다.");
  } else issue(issues, "COMMERCE_FIELDS_REQUIRED", "commerce", "가격·재고·배송·반품 필드가 없으면 registration-ready가 될 수 없습니다.");

  const orderedIssues = [...new Map(issues.map((entry) => [`${entry.code}:${entry.path}`, entry])).values()].sort((a, b) => `${a.path}:${a.code}`.localeCompare(`${b.path}:${b.code}`));
  const blockerCount = orderedIssues.filter(({ severity }) => severity === "BLOCKER").length;
  const ready = blockerCount === 0 && registrationPayload !== null;
  const candidates = [
    { variantId: "A", title, keywords: deduped.map(({ text }) => text), creativePlan: ["PACKSHOT", "SCALE", "COMPONENTS", "DETAIL"] as const, rationale: ["구매 핵심 속성을 제목 앞부분에 배치", "증거 기반 검색어만 중복 제거 후 사용"] },
    { variantId: "B", title: [...safeTitleTokens].reverse().map(({ text }) => text).join(" "), keywords: [...deduped].reverse().map(({ text }) => text), creativePlan: ["PACKSHOT", "CONTEXT", "FEATURE", "DETAIL"] as const, rationale: ["대체 속성 순서의 cold-start 후보", "시장/실측 데이터 전에는 우수성을 주장하지 않음"] },
  ];
  return Object.freeze({
    schemaVersion: LISTING_CONTENT_PACKET_VERSION,
    packetId: input.packetId,
    subjectId: input.subjectId,
    status: ready ? (orderedIssues.length > 0 ? "OPTIMIZATION_PENDING" : "REGISTRATION_READY") : "REGISTRATION_BLOCKED",
    title: { value: title, tokens: safeTitleTokens },
    keywords: deduped,
    conversion: { objective: "QUALIFIED_CONVERSION_AND_ATTRIBUTABLE_PROFIT" as const, readiness: "COLD_START" as const, confidence: input.customerIntents.length > 0 ? "MEDIUM" as const : "LOW" as const, candidates, selectedVariantId: "A", sourceSnapshotIds: [input.policy.snapshotId, input.category.metadataDigest], learningPlan: { method: "SEQUENTIAL_REVISION" as const, approvalRequired: true as const, parallelDuplicateListings: false as const, profitAndReturnGuardrailsRequired: true as const } },
    detailPage: { mimeType: "text/html" as const, width: 780 as const, html, digest: digestCanonicalJson({ html }) ?? "", blocks, review: detailReview },
    assets,
    issues: orderedIssues,
    registrationPayload: ready ? registrationPayload : null,
    approval: { contentApproved, livePublishAuthorized: commerce?.liveWriteApproval.approved === true },
  });
}

export function isLegacyListingDraft(value: unknown): boolean {
  return typeof value === "object" && value !== null && "coupang_payload" in value && !("schemaVersion" in value);
}
