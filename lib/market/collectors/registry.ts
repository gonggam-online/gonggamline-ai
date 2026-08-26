import type { CollectorDefinition } from "../../../types/collector";

export const collectorRegistry: CollectorDefinition[] = [
  {
    key: "manual-input",
    name: "수동 관측 입력",
    sourceType: "manual",
    supportsAutomatic: false,
    description: "관리자 또는 CSV 변환기가 표준 관측 API로 데이터를 전달합니다.",
  },
  {
    key: "demo-generator",
    name: "DEMO 시계열 생성기",
    sourceType: "demo",
    supportsAutomatic: true,
    description: "수집·시계열·신호·분석 파이프라인을 안전하게 검증합니다.",
  },
  {
    key: "internal-sales",
    name: "내부 실매출 피드백",
    sourceType: "internal",
    supportsAutomatic: true,
    description: "실제 주문·매출·광고·반품 결과를 추정 모델 보정 데이터로 적재합니다.",
  },
  {
    key: "official-api-adapter",
    name: "공식 API 어댑터",
    sourceType: "official_api",
    supportsAutomatic: true,
    description: "공식적으로 허용된 API를 동일한 관측 포맷으로 연결하기 위한 확장 포인트입니다.",
  },
  {
    key: "naver-shopping-api",
    name: "NAVER API HUB 트렌드",
    sourceType: "official_api",
    supportsAutomatic: true,
    description: "기존 collector key를 유지하면서 검색어 트렌드와 설정된 쇼핑 분야의 클릭 추이를 read-only 수집합니다.",
  },
  {
    key: "youtube-data-api",
    name: "YouTube Data API 공개 메타데이터",
    sourceType: "public_observation",
    supportsAutomatic: true,
    description: "영상 바이트·자산권리 없이 제목·게시시점·검색순위만 연구합니다.",
  },
  {
    key: "dataforseo-naver-serp",
    name: "DataForSEO Naver SERP",
    sourceType: "paid_api",
    supportsAutomatic: true,
    description: "비용 ceiling이 설정된 경우에만 Naver 경쟁 SERP를 read-only 수집합니다.",
  },
  {
    key: "public-observation-adapter",
    name: "공개 페이지 관측 어댑터",
    sourceType: "public_observation",
    supportsAutomatic: true,
    description: "공개 정보만 저빈도로 관찰하며 403·429·차단 신호 발생 시 즉시 중단합니다.",
  },
];

export function getCollectorDefinition(key: string) {
  return collectorRegistry.find((collector) => collector.key === key) ?? null;
}
