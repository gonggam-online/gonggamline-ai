"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  DiscoveryPortfolioCandidate,
  DiscoveryPortfolioLane,
} from "../../lib/market/discovery-portfolio-ranking";
import { ExternalImportPanel } from "../../components/market/external-import-panel";

type Profile = {
  keyword: string;
  state: string;
  score: number;
  confidence: number;
  demand: number;
  momentum: number;
  shoppingIntent: number;
  competitionHeadroom: number;
  providers: string[];
};
type Content = {
  id: string;
  platform: string;
  keyword: string;
  title: string;
  sourceUrl: string | null;
  viewCount: number | null;
  shoppingScore: number;
};
type Collector = {
  collector_key: string;
  name: string;
  status: string;
  last_success_at: string | null;
  last_error: string | null;
};
type SkuRanking = {
  rank: number;
  skuKey: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  coupangMatch: string;
  score: number;
  confidence: number;
  concept: string;
  priceKrw: number | null;
  reviewCount?: number | null;
  availability?: "IN_STOCK" | "SOLD_OUT" | "UNKNOWN";
  estimatedMonthlyUnits?: number | null;
  estimatedMonthlyRevenueKrw?: number | null;
  salesPerReview?: number | null;
  revenuePerReviewKrw?: number | null;
  demandEfficiencyScore?: number;
  coupangOpportunityScore?: number;
  salesStrengthScore?: number;
  reviewHeadroomScore?: number;
  trendProofScore?: number;
  evidenceReliabilityScore?: number;
  comparisonCohortSize?: number;
  opportunityArchetype?:
    "LOW_REVIEW_HIGH_SALES" | "PROVEN_DEMAND" | "INSUFFICIENT_DEMAND_EVIDENCE";
  supplierQuoteFresh: boolean;
  supplierUnitCostKrw?: number | null;
  supplierInboundCostKrw?: number | null;
  inspectionPackagingCostKrw?: number | null;
  threePlCostKrw?: number | null;
  skuLogisticsCostKrw: number | null;
  landedUnitCostKrw?: number | null;
  coupangFeeRate?: number | null;
  coupangFeeKrw?: number | null;
  returnAllowanceKrw?: number | null;
  estimatedProfitKrw: number | null;
  estimatedMarginRate?: number | null;
  profitabilityStatus?:
    | "VERIFIED_QUOTE"
    | "MISSING_SUPPLIER_QUOTE"
    | "MISSING_MARKET_PRICE";
  relevantTikTokSignals: number;
  ignoredTikTokSignals: number;
  missingEvidence: string[];
  reasons: string[];
  qualification?: "SELL_READY" | "HIGH_CONFIDENCE" | "VERIFY_NEXT";
  marketMatchScore?: number;
  marketProviders?: string[];
  identityProviders?: string[];
  searchQueries?: string[];
};
type Finder = {
  completedAt: string | null;
  summary: {
    trackedKeywords: number;
    actionableCount: number;
    providerCount: number;
  };
  keywordProfiles: Profile[];
  contentFeed: Content[];
  providerCoverage: string[];
  collectorHealth: Collector[];
  skuRankings: SkuRanking[];
  skuRecommendations: SkuRanking[];
  skuVerificationQueue: SkuRanking[];
  skuRankingAudit: Record<string, number>;
  skuDiscoveryLoop: { scheduled?: string[]; skippedFresh?: string[] };
};
type Dashboard = { finder: Finder; portfolio: DiscoveryPortfolioCandidate[] };
const laneLabel: Record<DiscoveryPortfolioLane, string> = {
  SCALE_READY: "대량등록 검토군",
  VALIDATE_NEXT: "검증 우선",
  WATCH: "관찰",
};
const laneHelp: Record<DiscoveryPortfolioLane, string> = {
  SCALE_READY: "수요·확장성·준비도가 높아 다음 검증을 우선합니다.",
  VALIDATE_NEXT: "수익성 또는 공급 근거를 먼저 채우면 유망합니다.",
  WATCH: "신호를 더 축적한 뒤 재평가합니다.",
};
const stateLabel = (state: string) =>
  ({
    BREAKOUT: "급상승",
    RISING: "상승",
    PERSISTENT: "지속 수요",
    SATURATED: "경쟁 과열",
    DECLINING: "하락",
  })[state] ?? state;
const score = (value: number) => Math.round(value);
const availabilityLabel = (value: SkuRanking["availability"]) =>
  value === "IN_STOCK"
    ? "재고 있음"
    : value === "SOLD_OUT"
      ? "품절 제외"
      : "재고 확인 중";
const evidenceLabel = (value: string) =>
  ({
    CURRENTLY_SOLD_OUT: "현재 품절",
    CURRENT_AVAILABILITY: "현재 재고",
    PRODUCT_LEVEL_CORROBORATION: "상품단위 복수출처",
    ESTIMATED_SALES_EVIDENCE: "추정 판매량",
    ESTIMATED_REVENUE_EVIDENCE: "추정 매출",
    COMPARABLE_COUPANG_COHORT: "비교 가능한 쿠팡 SKU 3개",
    TIME_SERIES_COVERAGE: "7일 이상 시계열",
    COUPANG_OPPORTUNITY_SCORE: "쿠팡 판매기회 58점",
  })[value] ?? value;
const qualificationLabel = (value: SkuRanking["qualification"]) =>
  value === "SELL_READY"
    ? "판매 검토"
    : value === "HIGH_CONFIDENCE"
      ? "소싱 검증"
      : "발굴 추천·추가검증";
const won = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "미확정"
    : `${Math.round(value).toLocaleString("ko-KR")}원`;
const highConfidenceCriteria = [
  {
    order: "01",
    title: "시장 수요 일치",
    gate: "시장매칭 45점 이상 · 독립 시장신호 2개 이상",
    sources: "Naver 검색 트렌드 · Naver 쇼핑 인사이트 · YouTube Data API",
    role: "상품군 수요·상승세·구매의도를 확인합니다.",
  },
  {
    order: "02",
    title: "동일 실상품 교차확인",
    gate: "상품 식별 60점 이상 · 동일 SKU 상품출처 2개 이상",
    sources: "DataForSEO 쿠팡 공개상품 · Naver 쇼핑 · Tenbi/TikTok 상품 패킷",
    role: "브랜드·모델·옵션·묶음·상품 ID를 교차검증합니다.",
  },
  {
    order: "03",
    title: "현재 판매 가능",
    gate: "14일 이내 관측 · 가격 있음 · ‘재고 있음’ 명시",
    sources: "쿠팡 공개상품 응답/검색 스니펫 · market_snapshots",
    role: "품절이나 재고 미확인은 고신뢰 목록에서 제외합니다.",
  },
  {
    order: "04",
    title: "쿠팡 판매기회",
    gate: "판매기회 58점 이상 · 비교 가능한 SKU 3개 이상",
    sources: "쿠팡 검색순위 · 리뷰 증감 · 품절 이력 · 가격 시계열",
    role: "판매량·매출·리뷰 포화도·판매효율·시계열 신뢰도를 합산합니다.",
  },
  {
    order: "05",
    title: "저리뷰·고판매 기회",
    gate: "리뷰≤중앙값 · 판매량/매출≥중앙값 · 수요/효율 각 60점 이상",
    sources: "market_product_metrics · market_snapshots 시계열",
    role: "세 조건을 모두 만족할 때만 저리뷰·고판매 기회로 표시합니다.",
  },
  {
    order: "06",
    title: "수익성과 실행 준비",
    gate: "고신뢰 기준 통과 + 판매준비는 최신 SKU 견적·물류비 필수",
    sources: "supplier_quotes · 개미창고 실비/3PL · 쿠팡 수수료·반품률",
    role: "공급가·MOQ·배송·검수·포장·출고·수수료를 함께 계산합니다.",
  },
] as const;
const rankingWeights = [
  ["쿠팡 판매기회", "38%"],
  ["시장성", "20%"],
  ["수익성", "17%"],
  ["상품근거", "12%"],
  ["상품식별", "10%"],
  ["TikTok", "3%"],
] as const;
// 고신뢰 목록은 부족한 후보로 숫자를 채우지 않습니다.

export default function MarketPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [lane, setLane] = useState<"ALL" | DiscoveryPortfolioLane>("ALL");
  const [selectedBatch, setSelectedBatch] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [collectionSummary, setCollectionSummary] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/market/discovery-dashboard", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(
          body.message || "아이템 발굴 데이터를 불러오지 못했습니다.",
        );
      setData(body.dashboard);
      setSelectedId(
        (current) => current || body.dashboard.portfolio?.[0]?.id || "",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "아이템 발굴 조회 오류",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function rebuild() {
    setRebuilding(true);
    setError("");
    setCollectionSummary("");
    try {
      const csrfResponse = await fetch(
        "/api/admin/auth/csrf?purpose=market-collection-run",
        { cache: "no-store" },
      );
      const csrf = await csrfResponse.json();
      if (!csrfResponse.ok || !csrf.token)
        throw new Error("재산출 요청 인증에 실패했습니다.");
      const response = await fetch("/api/market/intelligence", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-GonggamLine-CSRF": csrf.token,
        },
        body: "{}",
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(
          body.message || "시장 인텔리전스 재산출에 실패했습니다.",
        );
      const results = Array.isArray(body.collectionResults)
        ? body.collectionResults
        : [];
      const saved = results.reduce(
        (sum: number, result: { saved?: number }) => sum + (result.saved ?? 0),
        0,
      );
      setCollectionSummary(
        results.length
          ? `공식 공급자 ${results.length}개 수집 작업 · 신규 관측 ${saved}건 반영`
          : "현재 시점에 실행할 수집 작업이 없어 저장된 최신 증거로 재산출했습니다.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "시장 인텔리전스 재산출 오류",
      );
    } finally {
      setRebuilding(false);
    }
  }
  const shown = useMemo(
    () =>
      (data?.portfolio ?? []).filter(
        (item) => lane === "ALL" || item.lane === lane,
      ),
    [data, lane],
  );
  const selected =
    data?.portfolio.find((item) => item.id === selectedId) ?? shown[0] ?? null;
  const profiles = (data?.finder.keywordProfiles ?? [])
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  const latestRecommendations = data?.finder.skuRecommendations ?? [];
  const verificationQueue = data?.finder.skuVerificationQueue ?? [];
  const scaleReady =
    data?.portfolio.filter((item) => item.lane === "SCALE_READY").length ?? 0;
  function toggleBatch(id: string) {
    setSelectedBatch((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  function exportShortlist() {
    if (!data) return;
    const rows = data.portfolio.filter((item) =>
      selectedBatch.includes(item.id),
    );
    const csv = [
      "rank,title,form,priority,market,growth,profit,scale,readiness,risk,lane",
      ...rows.map((item) =>
        [
          data.portfolio.indexOf(item) + 1,
          item.title,
          item.form,
          item.priorityScore,
          item.marketScore,
          item.growthScore,
          item.profitScore,
          item.scaleScore,
          item.readinessScore,
          item.riskScore,
          item.lane,
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `item-discovery-shortlist-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="discovery-command">
      <section className="discovery-command__hero">
        <div>
          <p className="eyebrow">ENGINE 1 · CONTINUOUS MARKET DISCOVERY</p>
          <h1>1. 시장정보·아이템 발굴</h1>
          <p>
            실제 SKU별 검색어를 확장하고 복수 시장출처를 교차검증해, 지금 판매
            검토할 상품을 지속적으로 발굴합니다.
          </p>
        </div>
        <div className="discovery-command__hero-actions">
          <button
            onClick={() => void rebuild()}
            disabled={rebuilding || loading}
          >
            {rebuilding ? "최신 상품 발굴 중" : "최신 상품 발굴"}
          </button>
          <button onClick={() => void load()} disabled={loading}>
            {loading ? "갱신 중" : "저장 결과 새로고침"}
          </button>
          <Link href="/admin/item-selection">2. 상품선정·수익성으로 이동</Link>
        </div>
        {collectionSummary && (
          <p className="discovery-command__collection-summary">
            {collectionSummary}
          </p>
        )}
      </section>
      <nav
        className="discovery-command__steps"
        aria-label="아이템 발굴 업무 순서"
      >
        <a href="#trend">
          <b>1</b>
          <span>시장 트렌드</span>
          <small>무엇이 뜨는가</small>
        </a>
        <a href="#sku-ranking">
          <b>2</b>
          <span>최신 추천상품</span>
          <small>발굴·기본 수익성</small>
        </a>
        <a href="#priority">
          <b>3</b>
          <span>후보 포트폴리오</span>
          <small>무엇을 팔 것인가</small>
        </a>
        <a href="#detail">
          <b>4</b>
          <span>상세 근거·소싱</span>
          <small>왜 유망한가</small>
        </a>
      </nav>
      {error && <div className="notice error-notice">{error}</div>}
      <section className="discovery-command__metrics">
        <article>
          <span>관찰 키워드</span>
          <strong>{data?.finder.summary.trackedKeywords ?? 0}</strong>
          <small>상시 수집 대상</small>
        </article>
        <article>
          <span>상승 트렌드</span>
          <strong>{data?.finder.summary.actionableCount ?? 0}</strong>
          <small>판매기회 신호</small>
        </article>
        <article>
          <span>판매 후보</span>
          <strong>{data?.portfolio.length ?? 0}</strong>
          <small>중복·데모 제외</small>
        </article>
        <article className="is-accent">
          <span>대량등록 검토군</span>
          <strong>{scaleReady}</strong>
          <small>후속 검증 우선</small>
        </article>
        <article>
          <span>독립 데이터 출처</span>
          <strong>{data?.finder.summary.providerCount ?? 0}</strong>
          <small>
            {data?.finder.providerCoverage.join(" · ") || "수집 대기"}
          </small>
        </article>
      </section>
      <section className="discovery-command__panel" id="trend">
        <header>
          <div>
            <p className="eyebrow">STEP 1 · RECENT DEMAND</p>
            <h2>최근 시장 트렌드</h2>
            <span>
              수요·검색·콘텐츠·쇼핑 의도가 함께 상승한 상품군부터 보여줍니다.
            </span>
          </div>
          <time>
            {data?.finder.completedAt
              ? `최근 분석 ${new Date(data.finder.completedAt).toLocaleString("ko-KR")}`
              : "분석 시각 확인 중"}
          </time>
        </header>
        <div className="trend-board">
          {profiles.length ? (
            profiles.map((item, index) => (
              <article key={item.keyword}>
                <div>
                  <b>#{index + 1}</b>
                  <span
                    className={`trend-state trend-state--${item.state.toLowerCase()}`}
                  >
                    {stateLabel(item.state)}
                  </span>
                </div>
                <h3>{item.keyword}</h3>
                <strong>{score(item.score)}점</strong>
                <dl>
                  <div>
                    <dt>수요</dt>
                    <dd>{score(item.demand)}</dd>
                  </div>
                  <div>
                    <dt>상승세</dt>
                    <dd>
                      {item.momentum >= 0 ? "+" : ""}
                      {score(item.momentum)}
                    </dd>
                  </div>
                  <div>
                    <dt>구매의도</dt>
                    <dd>{score(item.shoppingIntent)}</dd>
                  </div>
                  <div>
                    <dt>경쟁여지</dt>
                    <dd>{score(item.competitionHeadroom)}</dd>
                  </div>
                </dl>
                <small>{item.providers.join(" · ")}</small>
              </article>
            ))
          ) : (
            <p className="empty-copy">수집된 시장 신호를 분석 중입니다.</p>
          )}
        </div>
      </section>
      <section className="discovery-command__panel" id="sku-ranking">
        <header>
          <div>
            <p className="eyebrow">LATEST RECOMMENDED SKU · TOP 10</p>
            <h2>최신 추천상품과 기본 수익성</h2>
            <span>
              품절은 제외하고 실제 상품·현재 관측가·시장근거가 있는 후보를
              우선순위로 보여줍니다. 엄격한 고신뢰 기준 미달 후보는 ‘추가검증’으로
              구분하며 구매·등록 승인을 뜻하지 않습니다.
            </span>
          </div>
          <small>
            실제 SKU {data?.finder.skuRankingAudit?.actualSkuProducts ?? 0} ·
            재고있음 {data?.finder.skuRankingAudit?.inStockProducts ?? 0} · 품절{" "}
            {data?.finder.skuRankingAudit?.soldOutProducts ?? 0} · 고신뢰{" "}
            {data?.finder.skuRankingAudit?.highConfidenceProducts ?? 0} ·
            추천 {data?.finder.skuRankingAudit?.recommendationProducts ?? 0} ·
            저리뷰·고매출{" "}
            {data?.finder.skuRankingAudit?.lowReviewHighSalesProducts ?? 0}
          </small>
        </header>
        <div
          className="sku-criteria-overview"
          aria-label="고신뢰 상품 선정 기준과 원천소스"
        >
          <div className="sku-criteria-overview__head">
            <div>
              <p className="eyebrow">SELECTION RULES · SOURCE AUTHORITY</p>
              <h3>고신뢰 선정 기준과 원천소스</h3>
              <p>
                점수가 높아도 아래 필수 기준 하나가 빠지면 판매 검토 목록에 넣지
                않고 자동 검증군으로 보냅니다.
              </p>
            </div>
            <div className="sku-criteria-overview__weights">
              <b>최종 점수 비중</b>
              {rankingWeights.map(([label, value]) => (
                <span key={label}>
                  {label} <strong>{value}</strong>
                </span>
              ))}
            </div>
          </div>
          <div className="sku-criteria-overview__grid">
            {highConfidenceCriteria.map((criterion) => (
              <article key={criterion.order}>
                <span>{criterion.order}</span>
                <div>
                  <h4>{criterion.title}</h4>
                  <b>{criterion.gate}</b>
                  <p>{criterion.role}</p>
                  <small>
                    <strong>원천소스</strong> {criterion.sources}
                  </small>
                </div>
              </article>
            ))}
          </div>
          <footer>
            <b>승격 원칙</b>
            <span>
              시장매칭·동일상품·최신성·가격·재고·판매량·매출·비교 SKU 3개·7일
              시계열·쿠팡 판매기회 58점·신뢰도 65점을 모두 통과해야 고신뢰가
              됩니다. 같은 원천이 Tenbi 등으로 재전달되면 upstreamSource
              기준으로 한 번만 가중합니다.
            </span>
          </footer>
        </div>
        <div className="sku-ranking-table">
          {latestRecommendations.length ? (
            latestRecommendations.map((item) => (
              <article key={item.skuKey}>
                <b>#{item.rank}</b>
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {qualificationLabel(item.qualification)}{" "}
                    · {availabilityLabel(item.availability)} ·{" "}
                    {item.opportunityArchetype === "LOW_REVIEW_HIGH_SALES"
                      ? "저리뷰·고판매 기회"
                      : "수요 검증 상품"}{" "}
                    · 상품출처 {item.identityProviders?.length ?? 0}개
                  </p>
                  <small>
                    {item.priceKrw
                      ? `관측가 ${item.priceKrw.toLocaleString("ko-KR")}원`
                      : "관측가 없음"}{" "}
                    · 리뷰 {(item.reviewCount ?? 0).toLocaleString("ko-KR")}개 ·
                    월 판매량{" "}
                    {item.estimatedMonthlyUnits
                      ? `${Math.round(item.estimatedMonthlyUnits).toLocaleString("ko-KR")}개 추정`
                      : "근거 없음"}{" "}
                    · 월 매출{" "}
                    {item.estimatedMonthlyRevenueKrw
                      ? `${item.estimatedMonthlyRevenueKrw.toLocaleString("ko-KR")}원 추정`
                      : "근거 없음"}{" "}
                    · 수요효율 {score(item.demandEfficiencyScore ?? 0)}
                  </small>
                  <small>
                    쿠팡 판매기회 {score(item.coupangOpportunityScore ?? 0)} ·
                    판매강도 {score(item.salesStrengthScore ?? 0)} · 리뷰
                    진입여지 {score(item.reviewHeadroomScore ?? 0)} · 시계열
                    근거 {score(item.trendProofScore ?? 0)} · 비교 SKU{" "}
                    {item.comparisonCohortSize ?? 0}개
                  </small>
                  <div className="sku-profitability" aria-label="기본 수익성 계산">
                    <span><b>쿠팡 관측 판매가</b>{won(item.priceKrw)}</span>
                    <span><b>공급 원가</b>{won(item.supplierUnitCostKrw)}</span>
                    <span><b>공급처 배송</b>{won(item.supplierInboundCostKrw)}</span>
                    <span><b>검수·포장·라벨</b>{won(item.inspectionPackagingCostKrw)}</span>
                    <span><b>3PL 입고·보관·출고</b>{won(item.threePlCostKrw)}</span>
                    <span><b>쿠팡 수수료</b>{won(item.coupangFeeKrw)}</span>
                    <span><b>반품 충당</b>{won(item.returnAllowanceKrw)}</span>
                    <span className="is-profit">
                      <b>예상 단위 순이익</b>
                      {won(item.estimatedProfitKrw)}
                      {item.estimatedMarginRate !== null &&
                      item.estimatedMarginRate !== undefined
                        ? ` (${item.estimatedMarginRate.toFixed(1)}%)`
                        : ""}
                    </span>
                  </div>
                  {item.profitabilityStatus !== "VERIFIED_QUOTE" && (
                    <p className="sku-profitability__notice">
                      기본 수익성 미확정: 최신 공급견적·SKU별 물류비를 확보하면
                      자동 계산합니다. 현재 관측 판매가만으로 수익을 추정하지 않습니다.
                    </p>
                  )}
                  {item.missingEvidence.length > 0 && (
                    <p className="sku-ranking-table__missing">
                      후속 확인:{" "}
                      {item.missingEvidence.map(evidenceLabel).join(" · ")}
                    </p>
                  )}
                </div>
                <strong>
                  {score(item.score)}점
                  <small>신뢰도 {score(item.confidence)}</small>
                </strong>
                {item.sourceUrl && (
                  <div className="sku-ranking-table__actions">
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                      원문 확인
                    </a>
                    <Link href={`/sourcing?keyword=${encodeURIComponent(item.title)}`}>
                      공급처 찾기
                    </Link>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="empty-copy">
              <b>
                현재 품절이 아니면서 실제 상품·가격·시장근거를 갖춘 추천 SKU가
                없습니다.
              </b>
              <p>
                저장된 후보를 억지로 채우지 않고, 아래 SKU의 재고와 상품단위
                수요를 자동 재검증합니다.
              </p>
            </div>
          )}
        </div>
        {verificationQueue.length > 0 && (
          <div className="sku-verification-queue">
            <h3>자동 교차검증 중</h3>
            <p>
              상품별 검색어를 네이버 쇼핑·DataForSEO·YouTube 공식 수집기에
              예약하고, 현재 재고와 복수 상품출처, 추정 판매량·매출이 확인되면
              고신뢰 목록으로 승격합니다.
            </p>
            {verificationQueue.slice(0, 10).map((item) => (
              <article key={item.skuKey}>
                <div>
                  <b>{item.title}</b>
                  <span>
                    {availabilityLabel(item.availability)} ·{" "}
                    {(item.searchQueries ?? []).join(" · ")}
                  </span>
                </div>
                <small>
                  시장매칭 {score(item.marketMatchScore ?? 0)} · 쿠팡 판매기회{" "}
                  {score(item.coupangOpportunityScore ?? 0)} · 신뢰도{" "}
                  {score(item.confidence)} · 부족{" "}
                  {item.missingEvidence
                    .slice(0, 5)
                    .map(evidenceLabel)
                    .join(" · ")}
                </small>
              </article>
            ))}
            <footer>
              이번 재산출 예약{" "}
              {data?.finder.skuDiscoveryLoop?.scheduled?.length ?? 0}개 · 최근
              수집으로 건너뜀{" "}
              {data?.finder.skuDiscoveryLoop?.skippedFresh?.length ?? 0}개
            </footer>
          </div>
        )}
      </section>
      <section className="discovery-command__panel" id="priority">
        <header>
          <div>
            <p className="eyebrow">STEP 2 · RANKED PORTFOLIO</p>
            <h2>판매 후보 우선순위</h2>
            <span>
              시장성·수익성·확장성·실행준비도를 비교해 가장 나은 후보부터
              정렬합니다.
            </span>
          </div>
          <div className="lane-tabs">
            {(["ALL", "SCALE_READY", "VALIDATE_NEXT", "WATCH"] as const).map(
              (value) => (
                <button
                  key={value}
                  className={lane === value ? "is-active" : ""}
                  onClick={() => setLane(value)}
                >
                  {value === "ALL" ? "전체" : laneLabel[value]}
                </button>
              ),
            )}
          </div>
        </header>
        <div className="priority-layout">
          <div className="priority-list">
            {shown.map((item) => (
              <article
                key={item.id}
                className={selected?.id === item.id ? "is-selected" : ""}
                onClick={() => setSelectedId(item.id)}
              >
                <label onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedBatch.includes(item.id)}
                    onChange={() => toggleBatch(item.id)}
                    aria-label={`${item.title} 일괄 검토 선택`}
                  />
                </label>
                <b className="priority-rank">
                  {(data?.portfolio.indexOf(item) ?? 0) + 1}
                </b>
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.form === "bundle"
                      ? "묶음 구성"
                      : item.form === "set"
                        ? "세트 구성"
                        : "단일 상품"}{" "}
                    ·{" "}
                    {item.source === "EVALUATED_PRODUCT"
                      ? "실상품 평가"
                      : "시장 신호 발굴"}
                  </p>
                </div>
                <strong>{score(item.priorityScore)}</strong>
                <span
                  className={`lane-badge lane-badge--${item.lane.toLowerCase()}`}
                >
                  {laneLabel[item.lane]}
                </span>
              </article>
            ))}
            {!shown.length && (
              <p className="empty-copy">이 구간의 후보가 아직 없습니다.</p>
            )}
          </div>
          <aside>
            <h3>대량 판매 후보군</h3>
            <p>
              여러 상품을 빠르게 검토하되, 수익성과 권리가 확인되지 않은 상품을
              자동 등록하지는 않습니다.
            </p>
            <strong>{selectedBatch.length}개 선택</strong>
            <button disabled={!selectedBatch.length} onClick={exportShortlist}>
              선택 후보 CSV
            </button>
          </aside>
        </div>
      </section>
      <section className="discovery-command__panel" id="detail">
        <header>
          <div>
            <p className="eyebrow">STEP 3 · DECISION EVIDENCE</p>
            <h2>후보 상세 근거</h2>
            <span>
              점수 하나가 아니라 강점과 미확인 항목을 함께 보고 판단합니다.
            </span>
          </div>
        </header>
        {selected ? (
          <div className="candidate-detail">
            <div className="candidate-detail__main">
              <div className="candidate-detail__title">
                <div>
                  <span
                    className={`lane-badge lane-badge--${selected.lane.toLowerCase()}`}
                  >
                    {laneLabel[selected.lane]}
                  </span>
                  <h3>{selected.title}</h3>
                  <p>{laneHelp[selected.lane]}</p>
                </div>
                <strong>
                  {score(selected.priorityScore)}
                  <small>/100</small>
                </strong>
              </div>
              <div className="score-grid">
                {[
                  ["시장성", selected.marketScore],
                  ["성장성", selected.growthScore],
                  ["수익성", selected.profitScore],
                  ["대량 확장성", selected.scaleScore],
                  ["실행 준비도", selected.readinessScore],
                  ["신뢰도", selected.confidence],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <b>{score(Number(value))}</b>
                    <i>
                      <em
                        style={{
                          width: `${Math.max(0, Math.min(100, Number(value)))}%`,
                        }}
                      />
                    </i>
                  </div>
                ))}
              </div>
            </div>
            <div className="candidate-detail__evidence">
              <h4>선정 근거</h4>
              {selected.reasons.length ? (
                <ul>
                  {selected.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p>상세 근거 축적 중</p>
              )}
              <h4>다음 검증 항목</h4>
              {selected.unresolved.length ? (
                <ul className="is-warning">
                  {selected.unresolved.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              ) : (
                <p>현재 추가 미확인 항목 없음</p>
              )}
              <p className="risk-score">
                위험 점수 <b>{score(selected.riskScore)}</b> / 100
              </p>
            </div>
          </div>
        ) : (
          <p className="empty-copy">후보를 선택하면 근거가 표시됩니다.</p>
        )}
      </section>
      <section className="discovery-command__panel" id="handoff">
        <header>
          <div>
            <p className="eyebrow">STEP 4 · NEXT ACTION</p>
            <h2>의사결정과 다음 실행</h2>
            <span>
              시장 발굴 결과를 실제 상품 검증과 공급처 비교로 연결합니다.
            </span>
          </div>
        </header>
        <div className="handoff-grid">
          <Link
            href={`/admin/item-selection?keyword=${encodeURIComponent(selected?.concept || "")}`}
          >
            <b>2. 경쟁력·수익성 검증</b>
            <span>쿠팡 판매가, 비용, 물류비, 마진을 확인합니다.</span>
          </Link>
          <Link
            href={`/sourcing?keyword=${encodeURIComponent(selected?.concept || "")}`}
          >
            <b>3. 공급처 소싱·견적 비교</b>
            <span>도매꾹과 대체 공급처의 조건을 비교합니다.</span>
          </Link>
          <a href="#research">
            <b>시장 근거 더 보기</b>
            <span>콘텐츠·가격·채널 원천 신호를 확인합니다.</span>
          </a>
        </div>
      </section>
      <details className="discovery-command__research" id="research">
        <summary>고급 시장 근거·수집 상태 보기</summary>
        <div>
          <section>
            <h3>구매 콘텐츠 신호</h3>
            {(data?.finder.contentFeed ?? []).slice(0, 8).map((item) => (
              <article key={item.id}>
                <b>{item.keyword}</b>
                <span>{item.title}</span>
                <small>
                  {item.platform} · 쇼핑점수 {score(item.shoppingScore)}
                  {item.viewCount
                    ? ` · 조회 ${item.viewCount.toLocaleString("ko-KR")}`
                    : ""}
                </small>
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    원문
                  </a>
                )}
              </article>
            ))}
          </section>
          <section>
            <h3>수집기 상태</h3>
            {(data?.finder.collectorHealth ?? []).map((item) => (
              <article key={item.collector_key}>
                <b>{item.name}</b>
                <span>{item.status}</span>
                <small>
                  {item.last_success_at
                    ? new Date(item.last_success_at).toLocaleString("ko-KR")
                    : item.last_error || "실행 대기"}
                </small>
              </article>
            ))}
          </section>
        </div>
      </details>
      <ExternalImportPanel />
    </main>
  );
}
