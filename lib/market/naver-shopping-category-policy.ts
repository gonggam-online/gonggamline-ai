export const NAVER_SHOPPING_CATEGORY_POLICY_VERSION =
  "gonggamline-naver-shopping-category-policy-2026-08-26" as const;

export const NAVER_SHOPPING_CATEGORY_SOURCE =
  "https://api.ncloud-docs.com/docs/naver-api-hub-shopping-insight-keywords" as const;

const CATEGORIES = Object.freeze({
  "패션잡화": Object.freeze({ code: "50000001", name: "패션잡화" }),
  "디지털/가전": Object.freeze({ code: "50000003", name: "디지털/가전" }),
  "가구/인테리어": Object.freeze({ code: "50000004", name: "가구/인테리어" }),
  "스포츠/레저": Object.freeze({ code: "50000007", name: "스포츠/레저" }),
  "생활/건강": Object.freeze({ code: "50000008", name: "생활/건강" }),
} as const);

export type NaverShoppingCategoryName = keyof typeof CATEGORIES;

export type NaverShoppingKeywordCategory = Readonly<{
  keyword: string;
  categoryCode: string;
  categoryName: NaverShoppingCategoryName;
  policyVersion: typeof NAVER_SHOPPING_CATEGORY_POLICY_VERSION;
  verifiedAt: "2026-08-26";
}>;

const KEYWORD_CATEGORY_NAMES = Object.freeze({
  "주방정리": "생활/건강",
  "틈새수납": "가구/인테리어",
  "케이블정리": "디지털/가전",
  "욕실정리": "생활/건강",
  "먼지제거": "생활/건강",
  "싱크대정리": "생활/건강",
  "차량정리": "생활/건강",
  "주방청소": "생활/건강",
  "미끄럼방지": "생활/건강",
  "냉장고정리": "생활/건강",
  "다용도수납": "생활/건강",
  "차량용수납": "생활/건강",
  "정리용품": "생활/건강",
  "소형조명": "가구/인테리어",
  "다용도걸이": "생활/건강",
  "차량청소": "생활/건강",
  "여름쿨링": "스포츠/레저",
  "생활보호용품": "생활/건강",
  "겨울보온": "스포츠/레저",
  "소형생활용품": "생활/건강",
  "무선청소기": "디지털/가전",
  "장마용품": "생활/건강",
  "캠핑수납": "스포츠/레저",
  "여행정리": "패션잡화",
  "휴대용보관": "생활/건강",
  "생활용품": "생활/건강",
} satisfies Readonly<Record<string, NaverShoppingCategoryName>>);

function normalizeKeyword(keyword: string): string {
  return keyword.normalize("NFC").trim().replace(/\s+/g, " ");
}

export const NAVER_SHOPPING_KEYWORD_CATEGORIES = Object.freeze(
  Object.entries(KEYWORD_CATEGORY_NAMES).map(([keyword, categoryName]): NaverShoppingKeywordCategory => Object.freeze({
    keyword,
    categoryCode: CATEGORIES[categoryName].code,
    categoryName,
    policyVersion: NAVER_SHOPPING_CATEGORY_POLICY_VERSION,
    verifiedAt: "2026-08-26",
  })),
);

const CATEGORY_BY_KEYWORD = new Map(
  NAVER_SHOPPING_KEYWORD_CATEGORIES.map((entry) => [normalizeKeyword(entry.keyword), entry]),
);

/**
 * Resolves only categories verified against Naver Shopping's current category
 * facets. Unknown keywords deliberately return null so Search Trend can still
 * run without sending Shopping Insight under a guessed category.
 */
export function resolveNaverShoppingCategory(keyword: string): NaverShoppingKeywordCategory | null {
  return CATEGORY_BY_KEYWORD.get(normalizeKeyword(keyword)) ?? null;
}

