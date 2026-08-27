import { createHash } from "node:crypto";

export const PUBLIC_SUPPLIER_DISCOVERY_VERSION =
  "gonggamline-public-supplier-candidate-discovery-v1" as const;

export type PublicSupplierKey =
  | "dometopia"
  | "domeggook"
  | "ownerclan"
  | "onchannel"
  | "ezmarketb2b";

export type PublicSupplierProfile = Readonly<{
  key: PublicSupplierKey;
  priority: number;
  name: string;
  domain: string;
  searchUrlTemplate: string;
  publicCoverage: readonly string[];
  authenticatedConfirmation: readonly string[];
}>;

export const PUBLIC_SUPPLIER_PROFILES: readonly PublicSupplierProfile[] = Object.freeze([
  {
    key: "dometopia",
    priority: 1,
    name: "도매토피아",
    domain: "dometopia.com",
    searchUrlTemplate: "https://dometopia.com/goods/search?search_text={keyword}",
    publicCoverage: ["상품명", "상품코드", "공개 도매가", "MOQ", "원산지", "상품 링크"],
    authenticatedConfirmation: ["실시간 재고", "옵션별 재고", "회원 조건", "배송비", "콘텐츠 사용권"],
  },
  {
    key: "domeggook",
    priority: 2,
    name: "도매꾹",
    domain: "domeggook.com",
    searchUrlTemplate: "https://domeggook.com/main/item/itemList.php?sw={keyword}",
    publicCoverage: ["상품명", "상품번호", "공개 가격", "상품 링크"],
    authenticatedConfirmation: ["회원 도매가", "옵션", "실시간 재고", "배송비", "상세페이지 이용권"],
  },
  {
    key: "ownerclan",
    priority: 3,
    name: "오너클랜",
    domain: "ownerclan.com",
    searchUrlTemplate: "https://www.ownerclan.com/V2/product/search.php?keyword={keyword}",
    publicCoverage: ["상품명", "상품코드 또는 URL", "상품 링크"],
    authenticatedConfirmation: ["공급가", "재고", "옵션", "배송비", "상품DB 이용 조건"],
  },
  {
    key: "onchannel",
    priority: 4,
    name: "온채널",
    domain: "onch3.co.kr",
    searchUrlTemplate: "https://www.onch3.co.kr/dbcenter_renewal/?keyword={keyword}",
    publicCoverage: ["상품명", "카테고리", "상품 링크"],
    authenticatedConfirmation: ["판매사가", "최종준수가", "재고", "판매승인", "API·엑셀 이용 가능 여부"],
  },
  {
    key: "ezmarketb2b",
    priority: 5,
    name: "이지마켓B2B",
    domain: "ezmarketb2b.com",
    searchUrlTemplate: "https://www.ezmarketb2b.com/goods/search?search_text={keyword}",
    publicCoverage: ["상품명", "카테고리", "일부 공개가", "상품 링크"],
    authenticatedConfirmation: ["사업자 회원가", "재고", "옵션", "묶음배송", "콘텐츠 이용 조건"],
  },
]);

export type SupplierMatchLevel =
  | "STRONG_CANDIDATE"
  | "LIKELY_CANDIDATE"
  | "CATEGORY_CANDIDATE"
  | "REJECTED";

export type SupplierSaleReadiness =
  | "PUBLIC_CANDIDATE"
  | "REQUIRES_LOGIN_CONFIRMATION"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_IDENTITY";

export type PublicSupplierSearchObservation = Readonly<{
  supplier: PublicSupplierKey;
  title: string;
  url: string;
  snippet: string | null;
  rank: number;
}>;

export type PublicSupplierCandidate = Readonly<{
  supplier: PublicSupplierKey;
  supplierName: string;
  supplierPriority: number;
  title: string;
  productUrl: string;
  providerItemId: string | null;
  publicPriceKrw: number | null;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  matchLevel: SupplierMatchLevel;
  matchScore: number;
  matchReasons: readonly string[];
  missingInformation: readonly string[];
  saleReadiness: SupplierSaleReadiness;
  observedAt: string;
}>;

export type PublicSupplierDiscoveryResult = Readonly<{
  version: typeof PUBLIC_SUPPLIER_DISCOVERY_VERSION;
  keyword: string;
  candidates: readonly PublicSupplierCandidate[];
  suppliers: readonly (PublicSupplierProfile & { searchUrl: string })[];
  requestCount: number;
  estimatedCostUsd: number;
  collectedAt: string;
  outputDigest: string;
}>;

const STOPWORDS = new Set(["상품", "도매", "판매", "추천", "국산", "정품", "무료배송", "특가"]);

function normalizedTokens(value: string): string[] {
  return [...new Set(value.normalize("NFC").toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token)))];
}

function modelTokens(value: string): string[] {
  return value.normalize("NFC").toUpperCase().match(/(?=[A-Z0-9-]{4,})(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]+/gu) ?? [];
}

function dimensionTokens(value: string): string[] {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").match(/\d+(?:\.\d+)?\s*(?:mm|cm|m|ml|l|g|kg|개|p|매)/gu) ?? [];
}

function parseKrw(value: string): number | null {
  const match = value.match(/(?:도매가|판매가|가격|₩)?\s*([1-9]\d{0,2}(?:,\d{3})+|[1-9]\d{3,})\s*원?/u);
  if (!match) return null;
  const parsed = Number(match[1].replaceAll(",", ""));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function productId(profile: PublicSupplierProfile, url: string): string | null {
  const patterns: Partial<Record<PublicSupplierKey, RegExp[]>> = {
    dometopia: [/[?&]no=(\d+)/u, /\b(G[A-Z]{1,2}\d{3,})\b/u],
    domeggook: [/[?&](?:itemNo|no)=([A-Za-z0-9_-]+)/u, /\/([0-9]{6,})(?:[/?#]|$)/u],
    ownerclan: [/[?&](?:product_no|no|id)=([A-Za-z0-9_-]+)/u, /\b([A-Z][A-Z0-9]{6,})\b/u],
    onchannel: [/[?&](?:product_no|num|id)=([A-Za-z0-9_-]+)/u],
    ezmarketb2b: [/[?&](?:no|goodsno)=([A-Za-z0-9_-]+)/u],
  };
  for (const pattern of patterns[profile.key] ?? []) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function supplierProfileFromUrl(value: string): PublicSupplierProfile | null {
  let hostname: string;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    hostname = url.hostname.toLocaleLowerCase("en-US");
  } catch {
    return null;
  }
  return PUBLIC_SUPPLIER_PROFILES.find((profile) =>
    hostname === profile.domain || hostname.endsWith(`.${profile.domain}`)) ?? null;
}

export function rankPublicSupplierCandidates(
  keyword: string,
  observations: readonly PublicSupplierSearchObservation[],
  observedAt: string,
): readonly PublicSupplierCandidate[] {
  const wanted = normalizedTokens(keyword);
  const wantedModels = modelTokens(keyword);
  const wantedDimensions = dimensionTokens(keyword);
  const unique = new Map<string, PublicSupplierCandidate>();

  for (const observation of observations) {
    const profile = PUBLIC_SUPPLIER_PROFILES.find((item) => item.key === observation.supplier);
    if (!profile || supplierProfileFromUrl(observation.url)?.key !== profile.key) continue;
    const text = `${observation.title} ${observation.snippet ?? ""}`;
    const actual = new Set(normalizedTokens(text));
    const overlap = wanted.filter((token) => actual.has(token));
    const tokenScore = wanted.length === 0 ? 0 : overlap.length / wanted.length;
    const actualModels = modelTokens(text);
    const actualDimensions = dimensionTokens(text);
    const modelMatch = wantedModels.length > 0 && wantedModels.some((token) => actualModels.includes(token));
    const dimensionsMatch = wantedDimensions.length > 0 && wantedDimensions.some((token) => actualDimensions.includes(token));
    const itemId = productId(profile, `${observation.url} ${text}`);
    const productPath = /\/goods\/view|\/item(?:Detail)?|\/product\/|\/goods\//iu.test(new URL(observation.url).pathname);
    const score = Math.max(0, Math.min(100, Math.round(
      tokenScore * 70 + (modelMatch ? 20 : 0) + (dimensionsMatch ? 10 : 0) + (itemId || productPath ? 5 : 0),
    )));
    const matchLevel: SupplierMatchLevel = score >= 80 && (modelMatch || dimensionsMatch || itemId !== null)
      ? "STRONG_CANDIDATE"
      : score >= 55 ? "LIKELY_CANDIDATE"
        : score >= 25 ? "CATEGORY_CANDIDATE" : "REJECTED";
    const soldOut = /품절|일시품절|판매\s*중지|out\s*of\s*stock/iu.test(text);
    const inStock = !soldOut && /재고\s*(?:있음|보유)|판매\s*중|바로구매|장바구니|in\s*stock/iu.test(text);
    const price = parseKrw(text);
    const missing = [
      ...(price === null ? ["공급가"] : []),
      "옵션별 재고",
      "배송비",
      "MOQ",
      "콘텐츠 사용권",
    ];
    const reasons = [
      ...(overlap.length ? [`핵심어 일치: ${overlap.join(", ")}`] : []),
      ...(modelMatch ? ["모델 식별자 일치"] : []),
      ...(dimensionsMatch ? ["규격 일치"] : []),
      ...(itemId ? [`공급처 상품 식별자 확인: ${itemId}`] : []),
    ];
    const saleReadiness: SupplierSaleReadiness = soldOut ? "OUT_OF_STOCK"
      : matchLevel === "REJECTED" || matchLevel === "CATEGORY_CANDIDATE" ? "INSUFFICIENT_IDENTITY"
        : missing.length > 0 ? "REQUIRES_LOGIN_CONFIRMATION" : "PUBLIC_CANDIDATE";
    const candidate: PublicSupplierCandidate = Object.freeze({
      supplier: profile.key,
      supplierName: profile.name,
      supplierPriority: profile.priority,
      title: observation.title,
      productUrl: observation.url,
      providerItemId: itemId,
      publicPriceKrw: price,
      stockStatus: soldOut ? "OUT_OF_STOCK" : inStock ? "IN_STOCK" : "UNKNOWN",
      matchLevel,
      matchScore: score,
      matchReasons: Object.freeze(reasons),
      missingInformation: Object.freeze(missing),
      saleReadiness,
      observedAt,
    });
    const key = `${profile.key}:${itemId ?? observation.url}`;
    const previous = unique.get(key);
    if (!previous || candidate.matchScore > previous.matchScore) unique.set(key, candidate);
  }
  return Object.freeze([...unique.values()]
    .filter((candidate) => candidate.matchLevel !== "REJECTED")
    .sort((left, right) =>
      Number(left.stockStatus === "OUT_OF_STOCK") - Number(right.stockStatus === "OUT_OF_STOCK") ||
      right.matchScore - left.matchScore ||
      left.supplierPriority - right.supplierPriority ||
      left.productUrl.localeCompare(right.productUrl))
    .slice(0, 30));
}

export function discoveryDigest(value: Omit<PublicSupplierDiscoveryResult, "outputDigest">): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
