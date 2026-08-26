"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FinderSummary = { trackedKeywords: number; trendCount: number; actionableCount: number; contentCount: number; channelCount: number; providerCount: number };
type KeywordProfile = {
  keyword: string; state: string; lane: string; score: number; confidence: number; demand: number; momentum: number;
  shoppingIntent: number; contentVelocity: number; competitionHeadroom: number; sourceAgreement: number; providers: string[];
  seasonality: Array<{ month: string; demandIndex: number; evidenceCount: number }>;
  seasonalityStatus: string;
  priceBenchmark: { sampleCount: number; minimum: number; median: number; maximum: number } | null;
  youtubeLandscape: { sampleCount: number; shortsRatio: number | null; medianViews: number | null; shoppingContentCount: number };
};
type ContentCard = {
  id: string; platform: string; keyword: string; title: string; sourceUrl: string | null; observedAt: string; channelTitle: string | null;
  thumbnailUrl: string | null; viewCount: number | null; contentVelocity: number | null; isShort: boolean | null; shoppingScore: number;
  verdict: string; extractedProduct: string; referenceOnly: boolean;
};
type Channel = { channelTitle: string; contentCount: number; totalViews: number; shortsRatio: number; latestAt: string; keywords: string[] };
type Recommendation = { candidateId: string; title: string; form: string; score: number; confidence: number; trendState: string; concept: string; unresolved: string[] };
type Finder = {
  status: string; generatedAt: string; completedAt: string | null; summary: FinderSummary; keywordProfiles: KeywordProfile[]; contentFeed: ContentCard[];
  channels: Channel[]; providerCoverage: string[]; recommendations: Recommendation[];
};

const tabs = [
  { id: "keywords", label: "키워드 분석", description: "수요·경쟁·시즌·가격" },
  { id: "content", label: "쇼핑 콘텐츠 레이더", description: "상품 영상·소재 신호" },
  { id: "channels", label: "채널 모니터", description: "채널·업로드 흐름" },
  { id: "candidates", label: "발굴 후보", description: "상품군·단품·묶음" },
] as const;

function formatNumber(value: number | null) {
  return value === null ? "근거 축적 중" : value.toLocaleString("ko-KR");
}

function signalTone(value: string) {
  return value === "BREAKOUT" || value === "RISING" ? "finder-signal--hot" : value === "PERSISTENT" ? "finder-signal--steady" : "finder-signal--watch";
}

export default function ItemDiscoveryFinderPage() {
  const [finder, setFinder] = useState<Finder | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("keywords");
  const [selectedKeyword, setSelectedKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const response = await fetch("/api/market/finder", { cache: "no-store" });
    const data = await response.json() as { success?: boolean; finder?: Finder; message?: string };
    if (!response.ok || !data.success || !data.finder) throw new Error(data.message || "아이템 발굴 데이터를 불러오지 못했습니다.");
    setFinder(data.finder);
    setSelectedKeyword((current) => current || data.finder?.keywordProfiles[0]?.keyword || "");
  }

  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "조회 오류")); }, []);

  const profile = finder?.keywordProfiles.find((item) => item.keyword === selectedKeyword) ?? finder?.keywordProfiles[0] ?? null;
  const filteredContent = useMemo(() => (finder?.contentFeed ?? []).filter((item) => {
    const needle = query.trim().toLocaleLowerCase("ko");
    return !needle || `${item.title} ${item.keyword} ${item.extractedProduct} ${item.channelTitle ?? ""}`.toLocaleLowerCase("ko").includes(needle);
  }), [finder, query]);

  return <main className="dashboard finder-page">
    <section className="hero finder-hero">
      <div><p className="eyebrow">ENGINE 1-1 · ITEM DISCOVERY WORKBENCH</p><h1>1-1. 아이템 발굴 워크벤치</h1><p className="hero-description">검색 수요, 쇼핑 클릭, 숏폼 반응, 경쟁 여지와 쿠팡 가격 근거를 한 흐름으로 결합해 지금 조사할 상품을 찾습니다.</p></div>
      <div className="hero-actions"><Link className="button-link secondary-button" href="/market">1. 시장정보 메인</Link><button onClick={() => void load().catch((cause) => setError(cause instanceof Error ? cause.message : "조회 오류"))}>새로고침</button></div>
    </section>

    <nav className="finder-tabs" aria-label="아이템 발굴 기능 메뉴">
      {tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)}><strong>{tab.label}</strong><small>{tab.description}</small></button>)}
    </nav>

    {error && <div className="notice error-notice">{error}</div>}
    {!finder && !error && <section className="panel"><p className="empty-copy">시장 근거를 불러오는 중입니다.</p></section>}
    {finder && <>
      <section className="finder-summary-grid">
        <article><span>추적 키워드</span><strong>{finder.summary.trackedKeywords}</strong></article>
        <article><span>시장 트렌드</span><strong>{finder.summary.trendCount}</strong></article>
        <article><span>조사 가능 후보</span><strong>{finder.summary.actionableCount}</strong></article>
        <article><span>콘텐츠 근거</span><strong>{finder.summary.contentCount}</strong></article>
        <article><span>관측 채널</span><strong>{finder.summary.channelCount}</strong></article>
        <article><span>독립 출처</span><strong>{finder.summary.providerCount}</strong></article>
      </section>

      {activeTab === "keywords" && <section className="finder-layout">
        <aside className="panel finder-keyword-list"><div className="section-heading"><div><h2>발굴 키워드</h2><p>시장점수 순</p></div></div>{finder.keywordProfiles.map((item) => <button key={item.keyword} className={profile?.keyword === item.keyword ? "is-active" : ""} onClick={() => setSelectedKeyword(item.keyword)}><span><strong>{item.keyword}</strong><small>{item.state} · 출처 {item.providers.length}</small></span><b>{Math.round(item.score)}</b></button>)}</aside>
        <section className="finder-detail-stack">
          {profile ? <>
            <article className="panel finder-keyword-hero"><div><span className={`finder-signal ${signalTone(profile.state)}`}>{profile.state}</span><h2>{profile.keyword}</h2><p>수요와 시장 진입 여지를 함께 본 현재 조사 우선순위입니다.</p></div><div className="finder-score"><strong>{Math.round(profile.score)}</strong><span>시장점수</span></div></article>
            <div className="finder-metric-grid">
              <article><span>수요지수</span><strong>{Math.round(profile.demand)}</strong><small>상대 시장 수요</small></article>
              <article><span>모멘텀</span><strong>{profile.momentum >= 0 ? "+" : ""}{Math.round(profile.momentum)}</strong><small>이전 관측 대비</small></article>
              <article><span>쇼핑의도</span><strong>{Math.round(profile.shoppingIntent)}</strong><small>구매 클릭 신호</small></article>
              <article><span>경쟁여지</span><strong>{Math.round(profile.competitionHeadroom)}</strong><small>높을수록 진입 여지</small></article>
              <article><span>콘텐츠속도</span><strong>{Math.round(profile.contentVelocity)}</strong><small>영상·콘텐츠 확산</small></article>
              <article><span>신뢰도</span><strong>{Math.round(profile.confidence)}%</strong><small>{profile.providers.length}개 출처 합의</small></article>
            </div>
            <article className="panel"><div className="section-heading"><div><h2>시즌 흐름</h2><p>실제 누적된 월별 상대 수요만 표시합니다.</p></div><span className="finder-evidence-badge">{profile.seasonalityStatus === "TWELVE_MONTHS" ? "12개월 확보" : profile.seasonalityStatus === "BUILDING" ? "축적 중" : "이력 부족"}</span></div>
              {profile.seasonality.length ? <div className="finder-season-chart">{profile.seasonality.map((point) => <div key={point.month}><span style={{ height: `${Math.max(8, point.demandIndex)}%` }} /><small>{point.month.slice(5)}</small><b>{point.demandIndex}</b></div>)}</div> : <p className="empty-copy">월별 근거가 누적되면 12개월 시즌 흐름이 표시됩니다.</p>}
            </article>
            <div className="finder-two-column"><article className="panel"><h2>쿠팡 가격 표본</h2>{profile.priceBenchmark ? <dl className="finder-definition"><div><dt>최저</dt><dd>{profile.priceBenchmark.minimum.toLocaleString("ko-KR")}원</dd></div><div><dt>중앙</dt><dd>{profile.priceBenchmark.median.toLocaleString("ko-KR")}원</dd></div><div><dt>최고</dt><dd>{profile.priceBenchmark.maximum.toLocaleString("ko-KR")}원</dd></div><div><dt>표본</dt><dd>{profile.priceBenchmark.sampleCount}건</dd></div></dl> : <p className="empty-copy">현재 일치하는 공개 가격 표본이 없습니다.</p>}</article>
              <article className="panel"><h2>YouTube 판세</h2><dl className="finder-definition"><div><dt>영상 표본</dt><dd>{profile.youtubeLandscape.sampleCount}건</dd></div><div><dt>쇼츠 비율</dt><dd>{profile.youtubeLandscape.shortsRatio === null ? "축적 중" : `${profile.youtubeLandscape.shortsRatio}%`}</dd></div><div><dt>중앙 조회수</dt><dd>{formatNumber(profile.youtubeLandscape.medianViews)}</dd></div><div><dt>상품 콘텐츠</dt><dd>{profile.youtubeLandscape.shoppingContentCount}건</dd></div></dl></article></div>
            <article className="panel finder-next-action"><div><h2>다음 실행</h2><p>시장 수요를 통과한 키워드를 실제 판매상품·원가·물류비·권리 근거와 결합합니다.</p></div><Link className="button-link" href={`/admin/item-selection?keyword=${encodeURIComponent(profile.keyword)}`}>2번 엔진에서 평가</Link></article>
          </> : <article className="panel"><p className="empty-copy">유효 트렌드가 수집되면 상세 분석이 표시됩니다.</p></article>}
        </section>
      </section>}

      {activeTab === "content" && <section className="panel finder-content-panel"><div className="section-heading"><div><h2>쇼핑 콘텐츠 레이더</h2><p>공개 메타데이터만 분석하며 영상 자산은 복제하거나 게시하지 않습니다.</p></div><input aria-label="콘텐츠 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="키워드·상품·채널 검색" /></div>
        <div className="finder-content-grid">{filteredContent.length ? filteredContent.map((item) => <article key={item.id} className="finder-content-card">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="finder-content-placeholder">{item.platform}</div>}<div><div className="finder-card-meta"><span>{item.platform}</span>{item.isShort && <span>SHORT</span>}<b>{item.shoppingScore}점</b></div><h3>{item.title}</h3><p><strong>추출 상품:</strong> {item.extractedProduct}</p><small>{item.channelTitle ?? item.keyword} · {new Date(item.observedAt).toLocaleDateString("ko-KR")}</small><div className="finder-card-actions">{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">원본 보기</a>}<Link href={`/admin/item-selection?keyword=${encodeURIComponent(item.extractedProduct)}`}>상품 평가</Link></div></div></article>) : <p className="empty-copy">YouTube·검색 콘텐츠 관측이 누적되면 상품 관련 소재가 표시됩니다.</p>}</div>
      </section>}

      {activeTab === "channels" && <section className="panel"><div className="section-heading"><div><h2>채널 모니터</h2><p>YouTube 공식 API에서 확인한 공개 채널 흐름입니다.</p></div><span className="finder-evidence-badge">자동수집</span></div>{finder.channels.length ? <div className="table-wrap"><table><thead><tr><th>채널</th><th>관측 콘텐츠</th><th>조회수 합</th><th>쇼츠 비율</th><th>연관 키워드</th><th>최근 관측</th></tr></thead><tbody>{finder.channels.map((channel) => <tr key={channel.channelTitle}><td><strong>{channel.channelTitle}</strong></td><td>{channel.contentCount}</td><td>{channel.totalViews.toLocaleString("ko-KR")}</td><td>{channel.shortsRatio}%</td><td>{channel.keywords.join(" · ")}</td><td>{new Date(channel.latestAt).toLocaleDateString("ko-KR")}</td></tr>)}</tbody></table></div> : <p className="empty-copy">다음 YouTube 수집부터 채널·조회수·쇼츠 지표가 누적됩니다.</p>}</section>}

      {activeTab === "candidates" && <section className="panel"><div className="section-heading"><div><h2>시장 근거 기반 발굴 후보</h2><p>높은 기준 때문에 빈 결과로 끝내지 않고, 상승 수요를 실제 조사 과제로 전환합니다.</p></div><Link className="button-link secondary-button" href="/discovery">후보 의사결정 열기</Link></div>{finder.recommendations.length ? <div className="finder-candidate-grid">{finder.recommendations.map((item) => <article key={item.candidateId}><div className="finder-card-meta"><span>{item.form === "bundle" ? "묶음" : item.form === "single" ? "단품" : "상품군"}</span><span>{item.trendState}</span><b>{Math.round(item.score)}점</b></div><h3>{item.title}</h3><p>{item.concept} · 신뢰도 {Math.round(item.confidence)}%</p><small>다음 확인: {item.unresolved.map((value) => value.replaceAll("_", " ")).join(" · ")}</small><Link className="button-link" href={`/admin/item-selection?keyword=${encodeURIComponent(item.concept)}`}>경쟁력·수익성 평가</Link></article>)}</div> : <p className="empty-copy">시장 신호가 확보되면 상품군 후보부터 항상 생성됩니다.</p>}</section>}

      <section className="panel finder-source-note"><div><h2>근거 출처와 적용 범위</h2><p>{finder.providerCoverage.length ? finder.providerCoverage.join(" · ") : "수집 근거 축적 중"}</p></div><p>공개 영상은 상품명·키워드·수요 연구에만 사용합니다. 이미지·영상의 다운로드, 편집 또는 상품페이지 게시는 별도의 권리 근거가 있어야 합니다.</p></section>
    </>}
  </main>;
}
