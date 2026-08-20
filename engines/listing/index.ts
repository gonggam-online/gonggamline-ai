import type { EngineDescriptor } from "@/shared/contracts/engine";
import type { ListingDraftContent, ListingGenerationInput } from "@/shared/domain/listing";
export {
  buildListingGeneratorV2Packet,
  LISTING_GENERATOR_V2_PACKET_VERSION,
  type ListingGeneratorV2Input,
  type ListingGeneratorV2Packet,
} from "@/shared/domain/listing-generator-v2";
export {
  ASSET_ERROR_ISOLATION_POLICY_DIGEST,
  ASSET_RIGHTS_POLICY_DIGEST,
  buildProductCreativePacket,
  PRODUCT_CREATIVE_PACKET_VERSION,
  productCreativePacketDigest,
  reviewProductCreativePacket,
  type CreativeAssetEvidence,
  type CreativeCandidate,
  type CreativeEditOperation,
  type CreativePolicySnapshot,
  type ProductCreativePacket,
} from "@/shared/domain/evidence-bound-product-creative";
export {
  buildEvidenceBoundTitleRankingPacket,
  keywordPacketDigest,
  type EvidenceBoundTitleRankingPacket,
  type ProductEvidenceFact,
  type RankedKeywordCandidate,
  type RankedTitleCandidate,
  type TitleRankingPolicy,
} from "@/shared/domain/evidence-bound-title-ranking";
export {
  applyHumanStoryRevision,
  buildEvidenceBoundPersuasiveStoryPacket,
  PERSUASIVE_STORY_PACKET_VERSION,
  STORY_BLOCK_ORDER,
  type EvidenceBoundPersuasiveStoryPacket,
  type HumanStoryRevision,
  type RankedStoryCandidate,
  type StoryBlock,
  type StoryClaim,
  type StoryIntent,
  type StoryObjection,
  type StoryPersona,
  type StoryPolicy,
} from "@/shared/domain/evidence-bound-persuasive-story";

export const descriptor: EngineDescriptor = {
  id: "listing",
  name: "Listing AI Engine",
  version: "0.5.0",
  health: "degraded",
  capabilities: ["title draft", "keyword draft", "option draft", "detail-page outline", "FAQ", "Coupang payload draft", "human approval"],
  dependencies: ["procurement", "bundle", "coupang"],
};

const unique = (values: string[]) => [...new Set(values.map(v => v.trim()).filter(Boolean))];
const clean = (value: string) => value.replace(/[\[\]{}<>|]/g, " ").replace(/\s+/g, " ").trim();

export function generateListingDraft(input: ListingGenerationInput): ListingDraftContent {
  const productName = clean(input.productName);
  const brand = clean(input.brandName || "공감라인");
  const category = clean(input.categoryName || "생활용품");
  const target = clean(input.targetCustomer || "실용성과 편의성을 중요하게 생각하는 고객");
  const benefits = unique(input.keyBenefits?.length ? input.keyBenefits : ["간편한 사용", "실용적인 구성", "일상 활용도"]);
  const titleParts = unique([brand, productName, ...benefits.slice(0, 2)]);
  const coupangTitle = titleParts.join(" ").slice(0, 100);
  const keywords = unique([productName, category, brand, ...benefits, ...(productName.split(" ").filter(x => x.length > 1))]).slice(0, 20);
  const optionValues = unique(input.optionNames?.length ? input.optionNames : ["기본 구성"]);
  const listingType = input.listingType || "single";
  const detailSections = [
    { heading: "한눈에 보는 핵심 특징", body: benefits.map(x => `• ${x}`).join("\n") },
    { heading: "이런 분께 추천합니다", body: target },
    { heading: "구성과 사용 방법", body: `${productName}의 구성품과 사용 전 확인사항을 이미지와 함께 안내합니다.` },
    { heading: "구매 전 확인", body: "실제 색상과 크기는 촬영 환경 및 측정 방법에 따라 차이가 있을 수 있습니다." },
  ];
  const faq = [
    { question: "구성품은 어떻게 되나요?", answer: `선택한 옵션 기준의 ${productName} 구성으로 출고됩니다.` },
    { question: "배송은 얼마나 걸리나요?", answer: "결제 및 재고 확인 후 출고되며, 도서산간 지역은 추가 기간이 필요할 수 있습니다." },
    { question: "교환이나 반품이 가능한가요?", answer: "미사용 상태와 구성품 보존 여부를 확인한 뒤 판매자 정책과 관계 법령에 따라 처리됩니다." },
  ];
  const complianceChecklist = ["카테고리 필수 고시정보 확인", "KC·인증 대상 여부 확인", "상표권·저작권 확인", "과장 표현 및 비교광고 점검", "옵션·구성품 일치 확인", "배송·반품 조건 확인"];
  return {
    coupangTitle,
    searchKeywords: keywords,
    optionStructure: [{ name: listingType === "single" ? "구성" : "세트 구성", values: optionValues }],
    sellingPoints: benefits,
    detailSections,
    faq,
    thumbnailBrief: `흰색 또는 밝은 배경, ${productName}을 중앙에 크게 배치하고 '${benefits[0]}' 핵심 문구를 짧게 표현. 실제 구성품과 다른 소품은 제외.`,
    shippingNotice: "재고 및 3PL 입고 상태에 따라 출고 일정이 확정됩니다. 주문 전 예상 배송일을 확인해 주세요.",
    returnNotice: "상품 수령 후 구성품과 상태를 확인해 주세요. 사용·훼손·포장 훼손 시 교환 및 반품이 제한될 수 있습니다.",
    complianceChecklist,
    coupangPayload: {
      sellerProductName: coupangTitle,
      displayProductName: coupangTitle,
      generalProductName: productName,
      salePrice: Math.max(0, Number(input.targetSellingPrice || 0)),
      categoryName: category,
      keywords,
      options: [{ name: listingType === "single" ? "구성" : "세트 구성", values: optionValues }],
      providerName: input.providerName || "국내 도매",
      listingType,
      validationStatus: "draft",
    },
  };
}
