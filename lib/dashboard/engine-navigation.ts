export type EnginePageLink = Readonly<{
  number: string;
  title: string;
  href: string;
  description: string;
  primary?: boolean;
}>;

export type EngineNavigationGroup = Readonly<{
  number: string;
  title: string;
  description: string;
  pages: readonly EnginePageLink[];
}>;

export const ENGINE_NAVIGATION: readonly EngineNavigationGroup[] = Object.freeze([
  {
    number: "1",
    title: "시장정보·아이템 발굴",
    description: "상시 시장 트렌드와 공개 수요 신호를 수집하고 판매 후보를 발굴합니다.",
    pages: Object.freeze([
      { number: "1", title: "시장정보·아이템 발굴", href: "/market", description: "시장 키워드·수집기·트렌드·분석 운영", primary: true },
      { number: "1-1", title: "아이템 발굴 워크벤치", href: "/market/finder", description: "키워드·쇼핑 콘텐츠·채널·가격 통합 발굴" },
      { number: "1-2", title: "시장 후보 발굴·의사결정", href: "/discovery", description: "시장 Feature 기반 단품·묶음 후보 발굴" },
    ]),
  },
  {
    number: "2",
    title: "상품선정·수익성",
    description: "판매 경쟁력, 예상 판매가, 비용과 수익성 근거를 함께 검증합니다.",
    pages: Object.freeze([
      { number: "2", title: "상품선정·수익성", href: "/admin/item-selection", description: "도매 공급상품 평가 실행과 이력 검토", primary: true },
      { number: "2-1", title: "쿠팡 판매 경쟁력 분석", href: "/competition", description: "쿠팡 경쟁상품·가격·리뷰 비교" },
      { number: "2-2", title: "상품 후보 관리", href: "/", description: "선정 후보·관심상품·승인 상태 관리" },
    ]),
  },
  {
    number: "3",
    title: "공급처 소싱·조달",
    description: "도매 공급처를 탐색하고 견적·MOQ·납기·도착원가를 비교합니다.",
    pages: Object.freeze([
      { number: "3", title: "공급처 소싱·조달", href: "/sourcing", description: "공급처·견적·도착원가·마진 비교", primary: true },
      { number: "3-1", title: "발주·입고 준비", href: "/procurement", description: "선정 견적의 발주서와 3PL 입고계획 전환" },
    ]),
  },
  {
    number: "4",
    title: "물류·재고·출고",
    description: "3PL 입고, 검수, 재고, 주문수집, 출고와 운송장 상태를 연결합니다.",
    pages: Object.freeze([
      { number: "4", title: "물류·재고·출고", href: "/fulfillment", description: "3PL 운영 범위와 관련 화면 통합 허브", primary: true },
      { number: "4-1", title: "물류·재고 통합 Workspace", href: "/workspace", description: "상품별 발주·입고·3PL·판매 상태 조회" },
    ]),
  },
  {
    number: "5",
    title: "상품 콘텐츠 제작",
    description: "타이틀, 키워드, 메인 이미지와 상세페이지를 증거·권리에 결속해 제작합니다.",
    pages: Object.freeze([
      { number: "5", title: "상품 콘텐츠 제작", href: "/listing", description: "상품명·키워드·상세페이지·등록 초안", primary: true },
      { number: "5-1", title: "증거 기반 콘텐츠 검토", href: "/listing/review", description: "등록·전환 준비도와 정책·권리 검토" },
      { number: "5-2", title: "외부 제작 Packet 내보내기", href: "/admin/listing/creative-adapter", description: "외부 콘텐츠 제작 입력 검증·Export" },
      { number: "5-3", title: "외부 제작 Packet 재준비", href: "/admin/listing/creative-adapter/reprepare", description: "저장 Packet 복구와 새 revision 생성" },
      { number: "5-4", title: "이미지 생성·비공개 검토", href: "/admin/listing/creative-dispatch", description: "콘텐츠 후보 준비·생성·검토" },
    ]),
  },
  {
    number: "6",
    title: "판매채널 운영",
    description: "쿠팡 등 판매채널의 연결, 상품 등록, 검증과 등록 결과를 관리합니다.",
    pages: Object.freeze([
      { number: "6", title: "판매채널 운영", href: "/seller", description: "판매채널 등록 Queue·검증·재시도", primary: true },
      { number: "6-1", title: "쿠팡 API 연동", href: "/coupang", description: "쿠팡 Open API 연결 상태와 동기화" },
      { number: "6-2", title: "쿠팡 상품 등록", href: "/coupang/register", description: "쿠팡 등록 Payload 확인과 실행" },
    ]),
  },
  {
    number: "7",
    title: "성과분석·학습",
    description: "판매·수익·반품·정산 결과를 분석하고 다음 발굴과 선정에 환류합니다.",
    pages: Object.freeze([
      { number: "7", title: "성과분석·학습", href: "/revenue", description: "Revenue Opportunity와 실행 Queue", primary: true },
      { number: "7-1", title: "상품 성과 Revenue Dashboard", href: "/dashboard/revenue", description: "상품별 수익성·점수·순위 조회" },
    ]),
  },
]);

export const PLATFORM_NAVIGATION = Object.freeze([
  { title: "AI Company OS", href: "/os", description: "전체 실행·상태 관제" },
  { title: "Workflow 통합", href: "/workflow", description: "엔진 간 단계 전환과 상태 동기화" },
  { title: "상품 통합 Workspace", href: "/workspace", description: "상품 생애주기 전체 조회" },
  { title: "시스템 구조", href: "/system", description: "엔진 Registry·의존성·버전" },
]);

export function normalizeDashboardPathname(pathname: string) {
  return pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;
}

export function isDashboardPageActive(pathname: string, href: string) {
  const normalized = normalizeDashboardPathname(pathname);
  if (href === "/") return normalized === "/";
  return normalized === href || normalized.startsWith(`${href}/`);
}

export function findEngineForPathname(pathname: string) {
  return ENGINE_NAVIGATION.find((engine) =>
    [...engine.pages]
      .sort((left, right) => right.href.length - left.href.length)
      .some((page) => isDashboardPageActive(pathname, page.href)),
  );
}
