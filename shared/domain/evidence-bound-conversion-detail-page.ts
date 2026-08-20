import { createHash } from "node:crypto";

import type { EvidenceBoundPersuasiveStoryPacket, StoryBlockType } from "./evidence-bound-persuasive-story";

export const CONVERSION_DETAIL_PAGE_PACKET_VERSION =
  "gonggamline-evidence-bound-conversion-detail-page-v2" as const;

export type DetailPageAsset = Readonly<{
  assetId: string;
  creativeCandidateId: string;
  artifactDigest: string;
  approvalDigest: string;
  sourceAssetDigest: string;
  grantDigest: string;
  editOperation: string;
  role: "MAIN" | "ADDITIONAL" | "DETAIL";
  publicReference: string;
  altText: string;
  factIds: readonly string[];
  rights: "VERIFIED" | "UNKNOWN" | "PROHIBITED" | "REVOKED";
  productAccuracy: "PASS" | "FAIL" | "REVIEW_REQUIRED";
  decode: "PASS" | "FAIL";
  encoding: "PASS" | "FAIL";
  crop: "PASS" | "FAIL";
  mobileSafe: "PASS" | "FAIL";
}>;

export type DetailPageViewportQa = Readonly<{
  viewport: "MOBILE_360" | "DESKTOP_1280";
  renderedWidth: number;
  horizontalOverflowPixels: number;
  clippedElementCount: number;
  minimumBodyFontPixels: number;
  unreadableTextCount: number;
  brokenImageCount: number;
  encodingReplacementCharacterCount: number;
}>;

export type ConversionReadinessBreakdown = Readonly<{
  aboveTheFold: number;
  mobileScanability: number;
  informationHierarchy: number;
  imageCopyConsistency: number;
  trustFaqNotice: number;
  callToAction: number;
  provenance: number;
  policyAndRights: number;
}>;

export type ConversionDetailPagePacket = Readonly<{
  version: typeof CONVERSION_DETAIL_PAGE_PACKET_VERSION;
  packageVersion: string;
  mode: "SHADOW";
  executionEligible: false;
  status: "REVIEW_READY" | "QUARANTINED" | "APPROVED_SHADOW";
  publicationAuthorized: false;
  listingSubmission: null;
  productReference: string;
  title: string;
  keywordSetVersion: string;
  keywordPacketDigest: string;
  titlePacketDigest: string;
  storyPacketDigest: string;
  categoryPolicyDigest: string;
  marketplacePolicyDigest: string;
  creativePacketDigest: string;
  assetSetDigest: string;
  blockSetDigest: string;
  generatedAt: string;
  html: string;
  htmlDigest: string;
  content: readonly Readonly<{
    blockType: StoryBlockType;
    heading: string;
    sentences: readonly Readonly<{
      text: string;
      claimId: string;
      factIds: readonly string[];
      sourceReferences: readonly string[];
      evidenceDigests: readonly string[];
    }>[];
  }>[];
  assets: readonly DetailPageAsset[];
  viewportQa: readonly DetailPageViewportQa[];
  previewComparison: Readonly<{
    mobileDigest: string;
    desktopDigest: string;
    contentEquivalent: boolean;
    responsive: boolean;
  }>;
  conversionReadiness: Readonly<{
    score: number;
    breakdown: ConversionReadinessBreakdown;
    blockingReasons: readonly string[];
  }>;
  humanApproval: Readonly<{
    approvalReference: string;
    reviewerReference: string;
    approvedAt: string;
    boundPacketDigest: string;
  }> | null;
  digest: string;
}>;

const HEADINGS: Readonly<Record<StoryBlockType, string>> = Object.freeze({
  PROBLEM_CONTEXT: "이런 순간에 필요합니다",
  EMPATHY: "사용자의 번거로움을 고려했습니다",
  SOLUTION: "정리 방법",
  CORE_BENEFIT: "확인된 핵심 정보",
  USE_SCENE: "사용 장면",
  CONTENTS_USAGE: "구성과 사용법",
  OBJECTIONS_FAQ: "자주 묻는 질문",
  TRUST_NOTICE: "구매 전 확인사항",
  CTA: "확인 후 선택해 주세요",
});

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function validDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function scoreViewport(viewport: DetailPageViewportQa): number {
  return viewport.horizontalOverflowPixels === 0 && viewport.clippedElementCount === 0 &&
    viewport.minimumBodyFontPixels >= 16 && viewport.unreadableTextCount === 0 &&
    viewport.brokenImageCount === 0 && viewport.encodingReplacementCharacterCount === 0 ? 100 : 0;
}

export function buildConversionDetailPagePacket(input: Readonly<{
  packageVersion: string;
  productReference: string;
  title: string;
  keywordSetVersion: string;
  keywordPacketDigest: string;
  expectedKeywordPacketDigest: string;
  titlePacketDigest: string;
  expectedTitlePacketDigest: string;
  story: EvidenceBoundPersuasiveStoryPacket;
  expectedStoryPacketDigest: string;
  categoryPolicyDigest: string;
  expectedCategoryPolicyDigest: string;
  marketplacePolicyDigest: string;
  creativePacketDigest: string;
  expectedCreativePacketDigest: string;
  assets: readonly DetailPageAsset[];
  viewportQa: readonly DetailPageViewportQa[];
  generatedAt: string;
}>): ConversionDetailPagePacket {
  for (const [name, actual, expected] of [
    ["KEYWORD", input.keywordPacketDigest, input.expectedKeywordPacketDigest],
    ["TITLE", input.titlePacketDigest, input.expectedTitlePacketDigest],
    ["STORY", input.story.digest, input.expectedStoryPacketDigest],
    ["CATEGORY_POLICY", input.categoryPolicyDigest, input.expectedCategoryPolicyDigest],
    ["CREATIVE", input.creativePacketDigest, input.expectedCreativePacketDigest],
  ] as const) {
    if (!validDigest(actual) || actual !== expected) throw new Error(`${name}_PACKET_DIGEST_MISMATCH`);
  }
  if (!validDigest(input.marketplacePolicyDigest)) throw new Error("MARKETPLACE_POLICY_DIGEST_INVALID");
  if (input.keywordSetVersion !== input.story.keywordSetVersion
      || input.keywordPacketDigest !== input.story.keywordPacketDigest) throw new Error("STORY_KEYWORD_BINDING_MISMATCH");
  if (input.titlePacketDigest !== input.story.titlePacketDigest) throw new Error("STORY_TITLE_BINDING_MISMATCH");
  if (input.creativePacketDigest !== input.story.creativePacketDigest) throw new Error("STORY_CREATIVE_BINDING_MISMATCH");
  if (input.categoryPolicyDigest !== input.story.creativeBindings.categoryEvidenceDigest
      || input.marketplacePolicyDigest !== input.story.creativeBindings.marketplacePolicyDigest) {
    throw new Error("STORY_POLICY_BINDING_MISMATCH");
  }
  const generatedAt = new Date(input.generatedAt);
  if (!Number.isFinite(generatedAt.getTime())) throw new RangeError("generatedAt is invalid.");
  const selected = input.story.candidates.find(({ status }) => status === "VERIFIED");
  const blockingReasons: string[] = [];
  if (input.story.mode !== "SHADOW" || input.story.status !== "READY" || !selected) blockingReasons.push("STORY_NOT_APPROVED_READY");
  if (input.assets.length === 0) blockingReasons.push("APPROVED_ASSET_MISSING");

  const assets = [...input.assets].sort((a, b) => a.assetId.localeCompare(b.assetId));
  if (new Set(assets.map(({ assetId }) => assetId)).size !== assets.length) throw new Error("DUPLICATE_ASSET_ID");
  for (const asset of assets) {
    if (!validDigest(asset.artifactDigest) || !validDigest(asset.approvalDigest)) blockingReasons.push(`ASSET_DIGEST_INVALID:${asset.assetId}`);
    if (asset.rights !== "VERIFIED") blockingReasons.push(`ASSET_RIGHTS_${asset.rights}:${asset.assetId}`);
    if (asset.productAccuracy !== "PASS") blockingReasons.push(`ASSET_ACCURACY_${asset.productAccuracy}:${asset.assetId}`);
    if ([asset.decode, asset.encoding, asset.crop, asset.mobileSafe].includes("FAIL")) blockingReasons.push(`ASSET_VISUAL_QA_FAILED:${asset.assetId}`);
    if (asset.altText.trim().length < 5) blockingReasons.push(`ASSET_ALT_TEXT_INVALID:${asset.assetId}`);
    if (asset.factIds.length === 0) blockingReasons.push(`ASSET_FACT_PROVENANCE_MISSING:${asset.assetId}`);
    if (!input.story.creativeBindings.candidateIds.includes(asset.creativeCandidateId)) blockingReasons.push(`ASSET_CREATIVE_CANDIDATE_MISMATCH:${asset.assetId}`);
    if (!input.story.creativeBindings.assetDigests.includes(asset.sourceAssetDigest)) blockingReasons.push(`ASSET_SOURCE_DIGEST_MISMATCH:${asset.assetId}`);
    if (!input.story.creativeBindings.grantDigests.includes(asset.grantDigest)) blockingReasons.push(`ASSET_GRANT_DIGEST_MISMATCH:${asset.assetId}`);
    if (!input.story.creativeBindings.operations.includes(asset.editOperation)) blockingReasons.push(`ASSET_EDIT_OPERATION_MISMATCH:${asset.assetId}`);
    try {
      if (new URL(asset.publicReference).protocol !== "https:") blockingReasons.push(`ASSET_REFERENCE_NOT_HTTPS:${asset.assetId}`);
    } catch {
      blockingReasons.push(`ASSET_REFERENCE_INVALID:${asset.assetId}`);
    }
  }
  const viewports = [...input.viewportQa].sort((a, b) => a.viewport.localeCompare(b.viewport));
  if (!viewports.some(({ viewport }) => viewport === "MOBILE_360")) blockingReasons.push("MOBILE_RENDER_MISSING");
  if (!viewports.some(({ viewport }) => viewport === "DESKTOP_1280")) blockingReasons.push("DESKTOP_RENDER_MISSING");
  for (const viewport of viewports) if (scoreViewport(viewport) === 0) blockingReasons.push(`VIEWPORT_QA_FAILED:${viewport.viewport}`);

  const content = Object.freeze((selected?.blocks ?? []).map((block) => Object.freeze({
    blockType: block.blockType,
    heading: HEADINGS[block.blockType],
    sentences: Object.freeze(block.sentences.map((sentence) => Object.freeze({
      text: sentence.text,
      claimId: sentence.claimId,
      factIds: sentence.provenance.factIds,
      sourceReferences: sentence.provenance.sourceReferences,
      evidenceDigests: sentence.provenance.evidenceDigests,
    }))),
  })));
  const contentFactIds = new Set(content.flatMap(({ sentences }) => sentences.flatMap(({ factIds }) => factIds)));
  for (const asset of assets) {
    if (!asset.factIds.some((factId) => contentFactIds.has(factId))) blockingReasons.push(`ASSET_COPY_FACT_MISMATCH:${asset.assetId}`);
  }
  const blockTypes = new Set(content.filter(({ sentences }) => sentences.length > 0).map(({ blockType }) => blockType));
  const admittedAssets = assets.filter((asset) => asset.rights === "VERIFIED" && asset.productAccuracy === "PASS" &&
    asset.decode === "PASS" && asset.encoding === "PASS" && asset.crop === "PASS" && asset.mobileSafe === "PASS" &&
    asset.factIds.some((factId) => contentFactIds.has(factId)) &&
    input.story.creativeBindings.candidateIds.includes(asset.creativeCandidateId) &&
    input.story.creativeBindings.assetDigests.includes(asset.sourceAssetDigest) &&
    input.story.creativeBindings.grantDigests.includes(asset.grantDigest) &&
    input.story.creativeBindings.operations.includes(asset.editOperation));
  const mainAsset = admittedAssets.find(({ role }) => role === "MAIN");
  if (!mainAsset) blockingReasons.push("ABOVE_FOLD_MAIN_ASSET_MISSING");
  if (!blockTypes.has("CORE_BENEFIT")) blockingReasons.push("ABOVE_FOLD_BENEFIT_MISSING");
  const assetHtml = admittedAssets.map((asset) => `<figure data-asset-id="${escapeHtml(asset.assetId)}"><img src="${escapeHtml(asset.publicReference)}" alt="${escapeHtml(asset.altText)}" loading="lazy" /><figcaption>${escapeHtml(asset.altText)}</figcaption></figure>`).join("");
  const blocksHtml = content.map((block) => `<section data-block="${block.blockType}"><h2>${escapeHtml(block.heading)}</h2>${block.sentences.map(({ text }) => `<p>${escapeHtml(text)}</p>`).join("")}</section>`).join("");
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;color:#171717;background:#fff;font:16px/1.65 system-ui,sans-serif}.detail{width:min(100%,780px);margin:auto}.hero,section{padding:24px 20px}.hero h1{font-size:clamp(26px,6vw,42px);line-height:1.25}h2{font-size:clamp(21px,4.5vw,30px);line-height:1.35}p{overflow-wrap:anywhere}img{display:block;width:100%;height:auto}figure{margin:0 0 16px}figcaption{padding:8px 20px;font-size:16px}@media(max-width:420px){.hero,section{padding:20px 16px}}</style></head><body><main class="detail"><header class="hero"><h1>${escapeHtml(input.title)}</h1>${mainAsset ? `<img src="${escapeHtml(mainAsset.publicReference)}" alt="${escapeHtml(mainAsset.altText)}" />` : ""}</header>${blocksHtml}<aside aria-label="상품 이미지">${assetHtml}</aside></main></body></html>`;
  const aboveTheFold = mainAsset && blockTypes.has("CORE_BENEFIT") ? 100 : 0;
  const mobileScanability = scoreViewport(viewports.find(({ viewport }) => viewport === "MOBILE_360") ?? { viewport: "MOBILE_360", renderedWidth: 0, horizontalOverflowPixels: 1, clippedElementCount: 1, minimumBodyFontPixels: 0, unreadableTextCount: 1, brokenImageCount: 1, encodingReplacementCharacterCount: 1 });
  const informationHierarchy = content.length === 9 && content.every(({ sentences }) => sentences.length > 0) ? 100 : 0;
  const imageCopyConsistency = assets.length > 0 && assets.every(({ productAccuracy, factIds }) => productAccuracy === "PASS" && factIds.length > 0) ? 100 : 0;
  const trustFaqNotice = blockTypes.has("OBJECTIONS_FAQ") && blockTypes.has("TRUST_NOTICE") ? 100 : 0;
  const callToAction = blockTypes.has("CTA") ? 100 : 0;
  const provenance = content.length > 0 && content.every(({ sentences }) => sentences.every(({ factIds, sourceReferences, evidenceDigests }) => factIds.length > 0 && sourceReferences.length > 0 && sourceReferences.every((reference) => reference.startsWith("evidence:")) && evidenceDigests.length > 0 && evidenceDigests.every(validDigest))) ? 100 : 0;
  const policyAndRights = assets.length > 0 && assets.every(({ rights }) => rights === "VERIFIED") ? 100 : 0;
  const breakdown = Object.freeze({ aboveTheFold, mobileScanability, informationHierarchy, imageCopyConsistency, trustFaqNotice, callToAction, provenance, policyAndRights });
  const score = Math.round(Object.values(breakdown).reduce((sum, value) => sum + value, 0) / Object.keys(breakdown).length);
  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)].sort());
  const packetWithoutDigest = {
    version: CONVERSION_DETAIL_PAGE_PACKET_VERSION,
    packageVersion: input.packageVersion,
    mode: "SHADOW" as const,
    executionEligible: false as const,
    status: uniqueBlockingReasons.length === 0 ? "REVIEW_READY" as const : "QUARANTINED" as const,
    publicationAuthorized: false as const,
    listingSubmission: null,
    productReference: input.productReference,
    title: input.title,
    keywordSetVersion: input.keywordSetVersion,
    keywordPacketDigest: input.keywordPacketDigest,
    titlePacketDigest: input.titlePacketDigest,
    storyPacketDigest: input.story.digest,
    categoryPolicyDigest: input.categoryPolicyDigest,
    marketplacePolicyDigest: input.marketplacePolicyDigest,
    creativePacketDigest: input.creativePacketDigest,
    assetSetDigest: sha256(assets),
    blockSetDigest: sha256(content),
    generatedAt: generatedAt.toISOString(),
    html,
    htmlDigest: sha256(html),
    content,
    assets: Object.freeze(assets),
    viewportQa: Object.freeze(viewports),
    previewComparison: Object.freeze({
      mobileDigest: sha256({ html, viewport: "MOBILE_360" }),
      desktopDigest: sha256({ html, viewport: "DESKTOP_1280" }),
      contentEquivalent: true,
      responsive: viewports.length === 2 && viewports.every((viewport) => scoreViewport(viewport) === 100),
    }),
    conversionReadiness: Object.freeze({ score, breakdown, blockingReasons: uniqueBlockingReasons }),
    humanApproval: null,
  };
  return Object.freeze({ ...packetWithoutDigest, digest: sha256(packetWithoutDigest) });
}

export function approveConversionDetailPagePacket(packet: ConversionDetailPagePacket, approval: Readonly<{
  approvalReference: string;
  reviewerReference: string;
  approvedAt: string;
  boundPacketDigest: string;
}>): ConversionDetailPagePacket {
  if (packet.status !== "REVIEW_READY" || approval.boundPacketDigest !== packet.digest) throw new Error("DETAIL_PAGE_APPROVAL_BINDING_INVALID");
  if (!/^approval:[A-Za-z0-9._:-]{1,120}$/.test(approval.approvalReference) || !/^reviewer:[A-Za-z0-9._:-]{1,120}$/.test(approval.reviewerReference)) throw new Error("DETAIL_PAGE_APPROVAL_REFERENCE_INVALID");
  const approvedAt = new Date(approval.approvedAt);
  if (!Number.isFinite(approvedAt.getTime())) throw new RangeError("approvedAt is invalid.");
  const humanApproval = Object.freeze({ ...approval, approvedAt: approvedAt.toISOString() });
  const withoutDigest = { ...packet, status: "APPROVED_SHADOW" as const, humanApproval };
  const { digest: previousDigest, ...digestable } = withoutDigest;
  void previousDigest;
  return Object.freeze({ ...withoutDigest, digest: sha256(digestable) });
}
