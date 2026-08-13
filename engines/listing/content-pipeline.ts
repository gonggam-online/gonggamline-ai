import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { evaluateListingEvidence, hasValidListingEncoding } from "@/engines/listing/evidence-policy";
import { validateCoupangProductPayload } from "@/lib/coupang/validator";
import type { ListingEvidenceFact } from "@/shared/domain/listing-evidence";
import {
  LISTING_CONTENT_PACKET_VERSION,
  type ListingAssetManifestEntry,
  type ListingContentInput,
  type ListingContentPacket,
  type ListingPipelineIssue,
  type MarketplacePolicySnapshot,
  type MobileDetailBlockType,
  type ProvenancedText,
  type RegistrationCommerceFields,
} from "@/shared/domain/listing-content";

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]+$/u;
const DERIVATIVE = new Set(["CROP", "BACKGROUND_REMOVAL", "TEXT_OVERLAY", "COMPOSITE", "GENERATIVE_REFERENCE"]);
const DETAIL_ORDER: readonly MobileDetailBlockType[] = ["IDENTITY", "VERIFIED_BENEFIT", "SPECIFICATION", "USE_CONTEXT", "OBJECTION", "FULFILLMENT", "NOTICE"];

function normalize(value: string): string {
  return value.normalize("NFC").replace(/[\[\]{}<>|]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedKey(value: string): string {
  return normalize(value).toLocaleLowerCase("ko-KR").replace(/[\s_-]+/g, "");
}

function issue(issues: ListingPipelineIssue[], code: string, path: string, message: string, severity: ListingPipelineIssue["severity"] = "BLOCKER"): void {
  const blockerClass = severity !== "BLOCKER" ? null : code === "LIVE_WRITE_APPROVAL_REQUIRED" ? "LIVE_WRITE_APPROVAL_MISSING" : code === "CONFLICTING_FACTS" ? "CORE_FACT_CONFLICT" : code.includes("PROHIBITED") ? "PROHIBITED_PAYLOAD_CONTENT" : ["UNKNOWN_REQUIRED_FACT", "TITLE_REQUIRED", "MAIN_ASSET_REQUIRED", "MANDATORY_ATTRIBUTE_MISSING", "MANDATORY_NOTICE_MISSING", "NOTICE_CATEGORY_MISSING", "PURCHASE_OPTION_MISSING", "COMMERCE_FIELDS_REQUIRED"].includes(code) ? "REQUIRED_FIELD_MISSING" : "PAYLOAD_VALIDATION_FAILED";
  issues.push({ code, path, message, severity, blockerClass });
}

function prohibited(value: string, policy: MarketplacePolicySnapshot): boolean {
  const key = normalizedKey(value);
  if ([...policy.forbiddenTerms, ...policy.competitorMarks].some((term) => key.includes(normalizedKey(term)))) return true;
  return policy.prohibitedClaimPatterns.some((pattern) => {
    try { return new RegExp(pattern, "iu").test(value); } catch { return true; }
  });
}

function provenByField(facts: readonly ListingEvidenceFact[], field: string): ListingEvidenceFact[] {
  return facts.filter((fact) => fact.field === field && fact.status === "PROVEN");
}

function validatePolicySnapshot(policy: MarketplacePolicySnapshot, issues: ListingPipelineIssue[]): RegExp | null {
  const { digest: policyDigest, ...policyBody } = policy;
  if (!SHA256.test(policyDigest) || digestCanonicalJson(policyBody) !== policyDigest) issue(issues, "POLICY_SNAPSHOT_INVALID", "policy.digest", "정책 snapshot SHA-256 digest가 본문과 일치하지 않습니다.");
  if (policy.sources.length === 0 || !policy.sources.some(({ kind, priority }) => kind === "COUPANG_OFFICIAL" && priority === 1)) {
    issue(issues, "POLICY_SNAPSHOT_INVALID", "policy.sources", "최신 Coupang 공식 근거가 정책 snapshot에 없습니다.");
  }
  for (const [index, source] of policy.sources.entries()) {
    const { digest: sourceDigest, ...sourceBody } = source;
    const expectedPriority = source.kind === "COUPANG_OFFICIAL" ? 1 : source.kind === "CATEGORY_MARKET_OBSERVATION" ? 2 : source.kind === "COMMERCE_UX_RESEARCH" ? 3 : 4;
    if (!SHA256.test(sourceDigest) || digestCanonicalJson(sourceBody) !== sourceDigest || !source.url.startsWith("https://") || !Number.isFinite(Date.parse(source.observedAt)) || source.priority !== expectedPriority) {
      issue(issues, "POLICY_SNAPSHOT_INVALID", `policy.sources[${index}]`, "정책 출처의 URL·관찰일·digest가 유효하지 않습니다.");
    }
  }
  try {
    return new RegExp(policy.keywordAllowedPattern, "u");
  } catch {
    issue(issues, "POLICY_SNAPSHOT_INVALID", "policy.keywordAllowedPattern", "검색어 허용문자 규칙을 해석할 수 없습니다.");
    return null;
  }
}

function buildFieldText(input: ListingContentInput, facts: readonly ListingEvidenceFact[], field: string, rank: number, ruleId: string, rationale: string): ProvenancedText | null {
  const fact = provenByField(facts, field)[0];
  if (fact) {
    const text = normalize(String(fact.value ?? ""));
    return text ? { text, field, rank, rationale, confidence: "HIGH", provenance: { factIds: [fact.factId], policyRuleIds: [ruleId] } } : null;
  }
  const fallback = input.ownerApprovedFallbacks.find((candidate) => candidate.targetField === field && candidate.categoryAllowsFallback && candidate.approvalReference && candidate.provenanceFactIds.length > 0);
  if (!fallback) return null;
  const text = normalize(fallback.value);
  return text ? { text, field, rank, rationale: `${rationale}; owner-approved assumption: ${fallback.assumption}`, confidence: "LOW", provenance: { factIds: fallback.provenanceFactIds, policyRuleIds: [ruleId, "OWNER_APPROVED_FALLBACK"] } } : null;
}

function rankTitleTokens(input: ListingContentInput, facts: readonly ListingEvidenceFact[], strategy: "PURCHASE_FIRST" | "INTENT_FIRST"): ProvenancedText[] {
  const base = new Map(input.titleFieldOrder.map((field, index) => [field, (input.titleFieldOrder.length - index) * (strategy === "PURCHASE_FIRST" ? 100 : 20)]));
  for (const mapping of input.queryAttributeMappings) {
    if (strategy === "PURCHASE_FIRST" && !base.has(mapping.field)) continue;
    const current = base.get(mapping.field) ?? 0;
    const intentBonus = mapping.priority * (strategy === "INTENT_FIRST" ? 100 : 10);
    base.set(mapping.field, current + intentBonus);
  }
  for (const field of input.corePurchaseFields) base.set(field, (base.get(field) ?? 0) + (strategy === "PURCHASE_FIRST" ? 60 : 5));
  return [...base.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([field, rank]): ProvenancedText | null => {
      const entry = buildFieldText(input, facts, field, rank, "TITLE_TOKEN_RANKER", strategy === "PURCHASE_FIRST" ? "구매 핵심 사실과 공식 front-loading prior" : "고객 검색의도와 query-to-attribute mapping");
      if (!entry) return null;
      const sourceIds = input.queryAttributeMappings.filter((mapping) => mapping.field === field).flatMap(({ sourceIds: mappingSourceIds }) => mappingSourceIds);
      return { ...entry, provenance: { ...entry.provenance, policyRuleIds: [...new Set([...entry.provenance.policyRuleIds, ...sourceIds])] } };
    })
    .filter((entry): entry is ProvenancedText => entry !== null)
    .filter((entry, index, entries) => entries.findIndex((candidate) => normalizedKey(candidate.text) === normalizedKey(entry.text)) === index);
}

function rankKeywords(input: ListingContentInput, facts: readonly ListingEvidenceFact[], strategy: "RELEVANCE" | "INTENT", allowed: RegExp | null, issues: ListingPipelineIssue[]): ProvenancedText[] {
  const mappedPriority = new Map<string, number>();
  for (const mapping of input.queryAttributeMappings) mappedPriority.set(mapping.field, Math.max(mappedPriority.get(mapping.field) ?? 0, mapping.priority));
  const output = input.keywordFields.flatMap((field, index) => provenByField(facts, field).map((fact) => {
    const text = normalize(String(fact.value ?? ""));
    const rank = (input.keywordFields.length - index) * 100 + (mappedPriority.get(field) ?? 0) * (strategy === "INTENT" ? 30 : 10);
    const sourceIds = input.queryAttributeMappings.filter((mapping) => mapping.field === field).flatMap(({ sourceIds: mappingSourceIds }) => mappingSourceIds);
    return { text, field, rank, rationale: strategy === "INTENT" ? "검색의도와 category vocabulary 우선" : "상품 관련성과 구매 핵심 사실 우선", confidence: "HIGH" as const, provenance: { factIds: [fact.factId], policyRuleIds: ["KEYWORD_CANDIDATE_RANKER", ...sourceIds] } };
  }))
    .filter(({ text }) => text.length > 0 && !prohibited(text, input.policy))
    .filter((entry, index, entries) => entries.findIndex((candidate) => normalizedKey(candidate.text) === normalizedKey(entry.text)) === index)
    .sort((a, b) => b.rank - a.rank || a.text.localeCompare(b.text));
  const accepted: ProvenancedText[] = [];
  for (const entry of output) {
    if (entry.text.length > input.policy.keywordMaxLength) {
      issue(issues, "KEYWORD_LENGTH_EXCEEDED", `keywords.${entry.field}`, "검색어 1개가 정책 snapshot의 20자 제한을 초과해 제외되었습니다.", "WARNING");
    } else if (!allowed || !allowed.test(entry.text)) {
      issue(issues, "KEYWORD_CHARACTER_NOT_ALLOWED", `keywords.${entry.field}`, "Coupang FAQ 허용문자 규칙에 맞지 않는 검색어를 제외했습니다.", "WARNING");
    } else accepted.push(entry);
  }
  if (output.length > input.policy.keywordMaxCount * 2) issue(issues, "KEYWORD_STUFFING", "keywords", "정책 한도의 두 배를 넘는 후보는 keyword stuffing 위험으로 제외됩니다.", "WARNING");
  return accepted.slice(0, input.policy.keywordMaxCount);
}

function renderAssets(input: ListingContentInput, issues: ListingPipelineIssue[]): ListingAssetManifestEntry[] {
  let additionalCount = 0;
  return input.assetRequests.map((request, index) => {
    const source = input.sourceAssets.find(({ assetId }) => assetId === request.sourceAssetId);
    const path = `assetRequests[${index}]`;
    const derivative = DERIVATIVE.has(request.transformation);
    const derivativeProvenancePass = !derivative || (request.transformationReference.length > 0 && request.outputRightsReference.length > 0 && (request.transformation !== "GENERATIVE_REFERENCE" || Boolean(request.providerApprovalReference)));
    const rightsPass = source !== undefined && source.useRights === "VERIFIED" && (!derivative || (source.editRights === "VERIFIED" && source.permittedTransformations.includes(request.transformation))) && source.permittedChannels.includes("COUPANG") && derivativeProvenancePass;
    const dimensionsPass = request.width > 0 && request.height > 0 && request.width <= 10000 && request.height <= 10000 && (request.role !== "MAIN" || Math.min(request.width, request.height) >= input.policy.mainImageMinimumPixels);
    const byteSizePass = request.byteSize > 0 && request.byteSize <= input.policy.imageMaxByteSize;
    const mimePass = Boolean(source) && input.policy.allowedImageMimeTypes.includes(request.mimeType) && (request.transformation !== "NONE" || request.mimeType === source?.mimeType);
    const digestPass = SHA256.test(request.outputDigest) && (request.transformation !== "NONE" || (request.outputDigest === source?.digest && request.outputReference === source.sourceReference));
    const accuracyPass = source?.productAccuracyStatus === "VERIFIED";
    const altPass = normalize(request.altText).length >= 4 && hasValidListingEncoding(request.altText);
    const loadPass = request.renderedReview.load === "PASS";
    const backgroundPass = request.role !== "MAIN" || request.renderedReview.background === "PASS";
    const promotionalTextPass = request.renderedReview.promotionalText === "PASS";
    const additionalAllowed = request.role !== "ADDITIONAL" || additionalCount++ < input.policy.additionalImageMaxCount;
    if (!source) issue(issues, "ASSET_EXCLUDED", `${path}.sourceAssetId`, "원본 자산이 manifest에 없어 제외되었습니다.", "WARNING");
    if (!rightsPass) issue(issues, derivative ? "DERIVATIVE_UNAVAILABLE" : "ASSET_EXCLUDED", path, derivative ? "편집권이 없어 이 파생 variant만 제외합니다. unchanged-use 자산은 계속 사용할 수 있습니다." : "원본 사용권 또는 Coupang 채널 권한이 확인되지 않아 자산을 제외합니다.", "WARNING");
    if (!accuracyPass) issue(issues, "ASSET_EXCLUDED", path, "실제 상품 표현 정확성이 검증되지 않아 자산을 제외합니다.", "WARNING");
    if (!dimensionsPass) issue(issues, "ASSET_EXCLUDED", path, "이미지 크기가 정책 snapshot에 맞지 않아 자산을 제외합니다.", "WARNING");
    if (!byteSizePass) issue(issues, "ASSET_EXCLUDED", path, "이미지 파일 크기가 정책 snapshot 한도를 벗어나 자산을 제외합니다.", "WARNING");
    if (!digestPass) issue(issues, "ASSET_EXCLUDED", path, "SHA-256 digest가 없거나 unchanged-use 자산의 원본 무결성이 일치하지 않아 제외합니다.", "WARNING");
    if (!altPass) issue(issues, "ASSET_EXCLUDED", path, "검증 가능한 한글/영문 대체 텍스트가 없어 자산을 제외합니다.", "WARNING");
    if (!loadPass || request.renderedReview.crop === "FAIL") issue(issues, "ASSET_VISUAL_QA_FAILED", path, "자산 load 또는 crop visual QA가 실패해 제외합니다.", "WARNING");
    if (!backgroundPass || !promotionalTextPass) issue(issues, "ASSET_VISUAL_QA_FAILED", path, "대표 배경 또는 프로모션 문구 visual QA가 실패해 자산을 제외합니다.", "WARNING");
    if (!additionalAllowed) issue(issues, "ADDITIONAL_IMAGE_LIMIT_EXCEEDED", path, "추가이미지 최대 개수를 넘어 제외합니다.", "WARNING");
    const included = rightsPass && accuracyPass && dimensionsPass && byteSizePass && mimePass && digestPass && altPass && loadPass && backgroundPass && promotionalTextPass && request.renderedReview.crop === "PASS" && additionalAllowed;
    return {
      ...request,
      disposition: included ? "INCLUDED" : derivative && !rightsPass ? "DERIVATIVE_UNAVAILABLE" : "EXCLUDED",
      provenanceFactIds: source?.provenanceFactIds ?? [], sourceReference: source?.sourceReference ?? "", useRights: source?.useRights ?? "UNKNOWN", editRights: source?.editRights ?? "UNKNOWN",
      review: { dimensions: dimensionsPass ? "PASS" : "FAIL", mime: mimePass ? "PASS" : "FAIL", digest: digestPass ? "PASS" : "FAIL", rights: rightsPass ? "PASS" : "FAIL", productAccuracy: accuracyPass ? "PASS" : "FAIL", altText: altPass ? "PASS" : "FAIL", load: loadPass ? "PASS" : "FAIL", crop: request.renderedReview.crop, bytes: byteSizePass ? "PASS" : "FAIL", background: backgroundPass ? "PASS" : "FAIL", promotionalText: promotionalTextPass ? "PASS" : "FAIL" },
    };
  });
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function buildListingContentPacket(input: ListingContentInput, commerce?: RegistrationCommerceFields): ListingContentPacket {
  const issues: ListingPipelineIssue[] = [];
  const keywordAllowed = validatePolicySnapshot(input.policy, issues);
  const evidenceDecision = evaluateListingEvidence(input.evidence);
  const validFallbackFields = new Set(input.ownerApprovedFallbacks.filter(({ categoryAllowsFallback, approvalReference, provenanceFactIds }) => categoryAllowsFallback && approvalReference && provenanceFactIds.length > 0).map(({ targetField }) => targetField));
  for (const entry of evidenceDecision.issues) {
    const blocker = (entry.code === "UNKNOWN_REQUIRED_FACT" && input.minimumRequiredFields.includes(entry.field) && !validFallbackFields.has(entry.field)) ||
      (entry.code === "CONFLICTING_FACTS" && input.corePurchaseFields.includes(entry.field)) ||
      (["INVALID_EVIDENCE", "WRONG_AUTHORITY", "SCOPE_MISMATCH", "INVALID_ENCODING"].includes(entry.code) && input.minimumRequiredFields.includes(entry.field));
    issue(issues, entry.code, `evidence.${entry.field}`, "증거 정책 검토가 필요합니다.", blocker ? "BLOCKER" : "WARNING");
  }
  for (const fallback of input.ownerApprovedFallbacks) issue(issues, "OWNER_APPROVED_ASSUMPTION", `assumptions.${fallback.targetField}`, fallback.assumption, "WARNING");
  if (input.subjectId !== input.evidence.subjectId) issue(issues, "SUBJECT_MISMATCH", "subjectId", "증거 packet의 상품 식별자가 일치하지 않습니다.");
  if (input.category.disposition !== "VALIDATED" || !input.category.categoryValid) issue(issues, "CATEGORY_NOT_VALIDATED", "category", "exact Coupang category snapshot이 유효하지 않습니다.");
  if (String(commerce?.displayCategoryCode ?? "") !== input.category.displayCategoryCode) issue(issues, "CATEGORY_CODE_MISMATCH", "commerce.displayCategoryCode", "등록 필드와 category snapshot 코드가 다릅니다.");
  if (input.supplierTrust.status !== "ACTIVE" || !SHA256.test(input.supplierTrust.capabilityDigest)) issue(issues, "SUPPLIER_TRUST_PROFILE_INVALID", "supplierTrust", "공급처 trust profile이 철회되었거나 capability digest가 유효하지 않아 selected payload를 재평가해야 합니다.");
  for (const [index, observation] of input.marketObservations.entries()) {
    const { digest: observationDigest, ...observationBody } = observation;
    if (observation.categoryCode !== input.category.displayCategoryCode || !SHA256.test(observationDigest) || digestCanonicalJson(observationBody) !== observationDigest || !Number.isFinite(Date.parse(observation.observedAt)) || observation.copiedTextOrImage !== false || observation.sourceReferences.length === 0 || observation.sourceReferences.some((reference) => !reference.startsWith("https://")) || observation.limitation.length === 0) {
      issue(issues, "MARKET_OBSERVATION_EXCLUDED", `marketObservations[${index}]`, "카테고리·digest·비복제 경계를 충족하지 못한 시장 관측을 제외합니다.", "WARNING");
    }
  }
  if (input.marketObservations.length === 0) issue(issues, "MARKET_OBSERVATION_PENDING", "marketObservations", "동일 카테고리의 신선한 공개 관측이 없어 공식/연구 cold-start prior만 사용합니다.", "OPTIMIZATION_PENDING");
  const knownConversionSources = new Set([...input.policy.sources.map(({ sourceId }) => sourceId), ...input.marketObservations.map(({ observationId }) => observationId)]);
  const validQueryMappings = input.queryAttributeMappings.filter((mapping, index) => {
    const valid = mapping.priority > 0 && mapping.sourceIds.length > 0 && mapping.sourceIds.every((sourceId) => knownConversionSources.has(sourceId)) && input.customerIntents.some(({ query }) => query === mapping.query);
    if (!valid) issue(issues, "QUERY_ATTRIBUTE_MAPPING_EXCLUDED", `queryAttributeMappings[${index}]`, "고객의도 또는 source snapshot에 연결되지 않은 query-to-attribute mapping을 제외했습니다.", "WARNING");
    return valid;
  });
  const rankingInput: ListingContentInput = { ...input, queryAttributeMappings: validQueryMappings };

  const invalidFactIds = new Set(evidenceDecision.issues.filter(({ code }) => ["INVALID_EVIDENCE", "WRONG_AUTHORITY", "SCOPE_MISMATCH", "INVALID_ENCODING"].includes(code)).flatMap(({ factIds }) => factIds));
  const hasCoreFactConflict = evidenceDecision.issues.some(({ code, field }) => code === "CONFLICTING_FACTS" && input.corePurchaseFields.includes(field));
  const blockedFields = new Set(evidenceDecision.issues.filter(({ code }) => code === "CONFLICTING_FACTS" || code === "PROHIBITED_FACT").map(({ field }) => field));
  const admitted = input.evidence.facts.filter((fact) => fact.status === "PROVEN" && !blockedFields.has(fact.field) && !invalidFactIds.has(fact.factId));
  const titleA = rankTitleTokens(rankingInput, admitted, "PURCHASE_FIRST").filter((entry) => {
    if (!prohibited(entry.text, input.policy)) return true;
    issue(issues, "PROHIBITED_TITLE_TOKEN", `title.${entry.field}`, `금칙어·권리 미확인 상표·근거 없는 claim이 포함된 제목 토큰을 제외했습니다: ${entry.text}`, "WARNING");
    return false;
  });
  const titleB = rankTitleTokens(rankingInput, admitted, "INTENT_FIRST").filter((entry) => !prohibited(entry.text, input.policy));
  const keywordA = rankKeywords(rankingInput, admitted, "RELEVANCE", keywordAllowed, issues);
  const keywordB = rankKeywords(rankingInput, admitted, "INTENT", keywordAllowed, issues);
  const titleValueA = titleA.map(({ text }) => text).join(" ");
  const titleValueB = titleB.map(({ text }) => text).join(" ");
  if (!titleValueA) issue(issues, "TITLE_REQUIRED", "title", "증거 기반 제목 토큰이 없습니다.");
  for (const [variantId, value] of [["A", titleValueA], ["B", titleValueB]] as const) {
    if (value.length > input.policy.titleMaxLength) issue(issues, "TITLE_LIMIT_EXCEEDED", `conversion.candidates.${variantId}.title`, "정책 snapshot의 제목 길이 제한을 초과했습니다.");
    if (!hasValidListingEncoding(value) || !SAFE_TEXT.test(value)) issue(issues, "INVALID_ENCODING", `conversion.candidates.${variantId}.title`, "제목 인코딩이 안전하지 않습니다.");
  }
  const detailPlan = [...input.detailClaims].sort((a, b) => DETAIL_ORDER.indexOf(a.blockType) - DETAIL_ORDER.indexOf(b.blockType) || b.priority - a.priority);
  const blocks = detailPlan.flatMap(({ blockType, heading, field, priority }) => {
    const entry = buildFieldText(input, admitted, field, priority, "MOBILE_DETAIL_EVIDENCE_BLOCK", `${blockType} 정보 계층`);
    if (!entry) {
      issue(issues, "DETAIL_BLOCK_OMITTED", `detail.${field}`, "필요한 사실이 없어 상세 블록을 발명하지 않고 생략했습니다.", "WARNING");
      return [];
    }
    if (prohibited(`${heading} ${entry.text}`, input.policy)) {
      issue(issues, "PROHIBITED_DETAIL_CLAIM", `detail.${field}`, "금지되거나 근거 없는 상세 claim을 payload에서 제외했습니다.", "WARNING");
      return [];
    }
    return [{ ...entry, blockType, heading: normalize(heading), text: `${normalize(heading)}: ${entry.text}` }];
  });
  const assets = renderAssets(input, issues);
  const mainAsset = assets.find(({ role, disposition }) => role === "MAIN" && disposition === "INCLUDED");
  if (!mainAsset) issue(issues, "MAIN_ASSET_REQUIRED", "assets", "검증을 통과한 대표 이미지가 필요합니다.");
  if (!assets.some(({ role, disposition }) => role === "DETAIL" && disposition === "INCLUDED")) issue(issues, "DETAIL_ASSET_PENDING", "assets", "상세 이미지가 없어 텍스트 중심 상세페이지를 사용합니다.", "OPTIMIZATION_PENDING");
  if (mainAsset && Math.min(mainAsset.width, mainAsset.height) < input.policy.mainImageRecommendedPixels) issue(issues, "MAIN_IMAGE_OPTIMIZATION_PENDING", "assets.main", "대표이미지가 등록 최소 규격은 통과하지만 공식 권장 해상도보다 작습니다.", "OPTIMIZATION_PENDING");

  const includedDetailAssets = assets.filter(({ role, disposition }) => role === "DETAIL" && disposition === "INCLUDED");
  const renderedTitle = input.contentApproval?.selectedVariantId === "B" ? titleValueB : titleValueA;
  const html = `<article data-listing-packet="${escapeHtml(input.packetId)}" style="width:780px;max-width:100%;font-family:Arial,'Noto Sans KR',sans-serif;color:#171717;line-height:1.65"><h1 style="font-size:30px">${escapeHtml(renderedTitle)}</h1>${blocks.map((block) => `<section data-block="${escapeHtml(block.blockType)}" style="padding:24px 20px;border-bottom:1px solid #ddd"><h2 style="font-size:24px;margin:0 0 8px">${escapeHtml(block.heading)}</h2><p style="font-size:20px;margin:0">${escapeHtml(block.text)}</p></section>`).join("")}${includedDetailAssets.map((asset) => `<figure style="margin:0;padding:20px"><img src="${escapeHtml(asset.outputReference)}" alt="${escapeHtml(asset.altText)}" style="display:block;width:100%;height:auto" /></figure>`).join("")}</article>`;
  const detailReview = {
    encoding: hasValidListingEncoding(html) ? "PASS" as const : "FAIL" as const,
    mobileWidth: html.includes("width:780px;max-width:100%") ? "PASS" as const : "FAIL" as const,
    readability: blocks.every(({ text }) => text.length >= 5 && text.length <= 180) ? "PASS" as const : "FAIL" as const,
    assetReferences: assets.some(({ disposition }) => disposition === "INCLUDED") ? "PASS" as const : "FAIL" as const,
    claims: blocks.every(({ provenance }) => provenance.factIds.length > 0) ? "PASS" as const : "FAIL" as const,
    crop: assets.filter(({ disposition }) => disposition === "INCLUDED").every(({ renderedReview }) => renderedReview.crop === "PASS") ? "PASS" as const : "FAIL" as const,
    productFacts: hasCoreFactConflict ? "FAIL" as const : "PASS" as const,
    load: assets.filter(({ disposition }) => disposition === "INCLUDED").every(({ renderedReview }) => renderedReview.load === "PASS") ? "PASS" as const : "FAIL" as const,
  };
  for (const [name, result] of Object.entries(detailReview)) if (result === "FAIL") issue(issues, "DETAIL_VISUAL_QA_FAILED", `detailPage.review.${name}`, "모바일 상세페이지 visual QA가 실패했습니다.");

  const candidates = [
    { variantId: "A", title: titleValueA, titleTokens: titleA, keywords: keywordA.map(({ text }) => text), keywordCandidates: keywordA, creativePlan: ["PACKSHOT", "SCALE", "COMPONENTS", "DETAIL"] as const, detailPlan: detailPlan.map(({ blockType }) => blockType), rationale: ["구매 핵심 사실과 공식 title front-loading prior를 우선", "상품 관련성·정확성 중심 검색어 후보", "실제 권리와 사실 범위의 shot만 선택"], confidence: "MEDIUM" as const },
    { variantId: "B", title: titleValueB, titleTokens: titleB, keywords: keywordB.map(({ text }) => text), keywordCandidates: keywordB, creativePlan: ["PACKSHOT", "CONTEXT", "FEATURE", "DETAIL"] as const, detailPlan: detailPlan.map(({ blockType }) => blockType), rationale: ["customer/search intent mapping을 더 강하게 반영", "시장 관측은 패턴 신호로만 사용하고 문구·이미지는 복제하지 않음", "실측 seller metrics 전에는 우수성을 주장하지 않음"], confidence: "LOW" as const },
  ];
  const selectedVariantId = input.contentApproval?.selectedVariantId ?? "";
  const selected = candidates.find(({ variantId }) => variantId === selectedVariantId);
  const contentApproved = input.contentApproval?.decision === "APPROVED_FOR_PAYLOAD_MAPPING" && Boolean(selected) && input.contentApproval.reviewerReference.length > 0 && input.contentApproval.evidenceEvaluationId === input.evidence.evaluationId && input.contentApproval.policyDigest === input.policy.digest && input.contentApproval.categoryMetadataDigest === input.category.metadataDigest;
  if (!contentApproved) issue(issues, "CONTENT_APPROVAL_REQUIRED", "contentApproval.selectedVariantId", "정확한 evidence/category/policy 버전과 한 후보를 묶은 사람의 콘텐츠 승인이 필요합니다.");

  let registrationPayload: Record<string, unknown> | null = null;
  if (commerce && selected) {
    if (!commerce.liveWriteApproval.approved || !commerce.liveWriteApproval.approvalReference) issue(issues, "LIVE_WRITE_APPROVAL_REQUIRED", "commerce.liveWriteApproval", "선택 variant와 payload에 대한 별도 live commerce-write 승인이 필요합니다.");
    const mappedAttributes = [...commerce.attributes, ...commerce.searchFilters].filter((entry, index, entries) => entries.findIndex((candidate) => candidate.name === entry.name && candidate.value === entry.value) === index);
    for (const [group, entries] of [["attributes", mappedAttributes], ["options", commerce.options], ["notices", commerce.notices]] as const) {
      for (const entry of entries) if (prohibited(`${entry.name} ${entry.value}`, input.policy)) issue(issues, "PROHIBITED_REGISTRATION_FIELD", `commerce.${group}.${entry.name}`, "선택 payload가 금칙어·권리 미확인 상표·근거 없는 claim을 사용합니다.");
    }
    for (const required of input.category.attributes.filter(({ required }) => required === "MANDATORY")) if (!mappedAttributes.some(({ name, value }) => name === required.attributeTypeName && normalize(value))) issue(issues, "MANDATORY_ATTRIBUTE_MISSING", `commerce.attributes.${required.attributeTypeName}`, "category snapshot의 필수 속성 또는 검색필터가 없습니다.");
    if (input.category.isAllowSingleItem === false && commerce.options.length === 0) issue(issues, "PURCHASE_OPTION_MISSING", "commerce.options", "이 exact category는 구매옵션이 필요합니다.");
    const noticeCategory = input.category.noticeCategories.find(({ noticeCategoryName }) => noticeCategoryName === input.category.selectedNoticeCategoryName);
    if (!noticeCategory) issue(issues, "NOTICE_CATEGORY_MISSING", "commerce.notices", "선택된 상품고시 category가 없습니다.");
    for (const required of noticeCategory?.detailNames.filter(({ required }) => required === "MANDATORY") ?? []) if (!commerce.notices.some(({ name, value }) => name === required.noticeCategoryDetailName && normalize(value))) issue(issues, "MANDATORY_NOTICE_MISSING", `commerce.notices.${required.noticeCategoryDetailName}`, "category snapshot의 필수 고시 필드가 없습니다.");
    registrationPayload = {
      displayCategoryCode: commerce.displayCategoryCode, sellerProductName: selected.title, saleStartedAt: commerce.saleStartedAt, saleEndedAt: commerce.saleEndedAt, displayProductName: selected.title, generalProductName: selected.titleTokens[0]?.text ?? "", deliveryMethod: commerce.deliveryMethod, deliveryChargeType: commerce.deliveryChargeType, returnCenterCode: commerce.returnCenterCode, companyContactNumber: commerce.companyContactNumber, returnZipCode: commerce.returnZipCode, returnAddress: commerce.returnAddress, returnAddressDetail: commerce.returnAddressDetail, outboundShippingPlaceCode: commerce.outboundShippingPlaceCode, vendorUserId: commerce.vendorUserId,
      items: [{ itemName: commerce.options.length > 0 ? commerce.options.map(({ name, value }) => `${name}: ${value}`).join(" / ") : selected.title, originalPrice: commerce.originalPrice, salePrice: commerce.salePrice, maximumBuyCount: commerce.maximumBuyCount, stockQuantity: commerce.stockQuantity, searchTags: selected.keywords, images: assets.filter(({ role, disposition }) => disposition === "INCLUDED" && (role === "MAIN" || role === "ADDITIONAL")).map((asset, imageOrder) => ({ imageOrder, imageType: imageOrder === 0 ? "REPRESENTATION" : "DETAIL", vendorPath: asset.outputReference })), attributes: mappedAttributes.map(({ name, value }) => ({ attributeTypeName: name, attributeValueName: value })), contents: [{ contentsType: "HTML", contentDetails: [{ content: html, detailType: "TEXT" }] }], notices: commerce.notices.map(({ name, value }) => ({ noticeCategoryName: input.category.selectedNoticeCategoryName, noticeCategoryDetailName: name, content: value })) }],
    };
    for (const payloadIssue of validateCoupangProductPayload(registrationPayload)) issue(issues, "REGISTRATION_FIELD_INVALID", payloadIssue.path, payloadIssue.message);
    if (commerce.stockQuantity < 0 || !Number.isInteger(commerce.stockQuantity)) issue(issues, "REGISTRATION_FIELD_INVALID", "items[0].stockQuantity", "재고는 0 이상의 정수여야 합니다.");
    if ([...commerce.attributes, ...commerce.searchFilters, ...commerce.options, ...commerce.notices].some(({ factIds }) => factIds.length === 0)) issue(issues, "REGISTRATION_FIELD_INVALID", "commerce.provenance", "옵션·검색필터·속성·고시 필드는 evidence fact를 참조해야 합니다.");
  } else if (!commerce) issue(issues, "COMMERCE_FIELDS_REQUIRED", "commerce", "가격·재고·배송·반품 필드가 없으면 registration-ready가 될 수 없습니다.");

  const orderedIssues = [...new Map(issues.map((entry) => [`${entry.code}:${entry.path}`, entry])).values()].sort((a, b) => `${a.path}:${a.code}`.localeCompare(`${b.path}:${b.code}`));
  const ready = orderedIssues.every(({ severity }) => severity !== "BLOCKER") && registrationPayload !== null;
  const packet: ListingContentPacket = {
    schemaVersion: LISTING_CONTENT_PACKET_VERSION, packetId: input.packetId, subjectId: input.subjectId, supplierTrust: input.supplierTrust,
    status: ready ? "REGISTRATION_READY" : "REGISTRATION_BLOCKED",
    title: { value: selected?.title ?? titleValueA, tokens: selected?.titleTokens ?? titleA }, keywords: selected?.keywordCandidates ?? keywordA, selectedVariantId,
    conversion: { objective: "QUALIFIED_CONVERSION_AND_ATTRIBUTABLE_PROFIT", readiness: "COLD_START", confidence: input.customerIntents.length > 0 && input.policy.sources.some(({ kind }) => kind === "COUPANG_OFFICIAL") ? "MEDIUM" : "LOW", candidates, selectedVariantId, sourceSnapshotIds: [input.policy.snapshotId, input.category.metadataDigest, input.supplierTrust.version, ...input.marketObservations.map(({ observationId }) => observationId)], sourceSnapshots: input.policy.sources, marketObservations: input.marketObservations, optimizationRationale: ["최소 등록적합성과 전환 준비도를 별도 판정", "공식 정책 → 시장 관측 → UX 연구 → seller actual metrics 순으로 갱신", "qualified conversion과 attributable profit을 함께 최적화하고 반품·오인을 제한"], learningPlan: { method: "SEQUENTIAL_REVISION", approvalRequired: true, parallelDuplicateListings: false, profitAndReturnGuardrailsRequired: true, rollbackPlan: "승인된 직전 revision과 asset/policy digests로 되돌리고 새 live-write 승인을 받는다." } },
    detailPage: { mimeType: "text/html", width: 780, html, digest: digestCanonicalJson({ html }) ?? "", blocks, review: detailReview }, assets, assumptions: input.ownerApprovedFallbacks, generation: { mode: "DETERMINISTIC", externalTextProviderUsed: false, generatedAssetCount: assets.filter(({ transformation, disposition }) => transformation === "GENERATIVE_REFERENCE" && disposition === "INCLUDED").length, providerApprovalRequiredForGenerativeReference: true }, issues: orderedIssues, registrationPayload: ready ? registrationPayload : null, approval: { contentApproved, livePublishAuthorized: commerce?.liveWriteApproval.approved === true },
  };
  return Object.freeze(packet);
}

export function isLegacyListingDraft(value: unknown): boolean {
  return typeof value === "object" && value !== null && "coupang_payload" in value && !("schemaVersion" in value);
}
