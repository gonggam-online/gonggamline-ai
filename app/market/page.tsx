"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DiscoveryPortfolioCandidate, DiscoveryPortfolioLane } from "../../lib/market/discovery-portfolio-ranking";
import { ExternalImportPanel } from "../../components/market/external-import-panel";

type Profile = { keyword: string; state: string; score: number; confidence: number; demand: number; momentum: number; shoppingIntent: number; competitionHeadroom: number; providers: string[] };
type Content = { id: string; platform: string; keyword: string; title: string; sourceUrl: string | null; viewCount: number | null; shoppingScore: number };
type Collector = { collector_key: string; name: string; status: string; last_success_at: string | null; last_error: string | null };
type SkuRanking = { rank: number; skuKey: string; title: string; source: string; sourceUrl: string | null; coupangMatch: string; score: number; confidence: number; concept: string; priceKrw: number | null; supplierQuoteFresh: boolean; skuLogisticsCostKrw: number | null; estimatedProfitKrw: number | null; relevantTikTokSignals: number; ignoredTikTokSignals: number; missingEvidence: string[]; reasons: string[] };
type Finder = { completedAt: string | null; summary: { trackedKeywords: number; actionableCount: number; providerCount: number }; keywordProfiles: Profile[]; contentFeed: Content[]; providerCoverage: string[]; collectorHealth: Collector[]; skuRankings: SkuRanking[]; skuRankingAudit: Record<string, number> };
type Dashboard = { finder: Finder; portfolio: DiscoveryPortfolioCandidate[] };
const laneLabel: Record<DiscoveryPortfolioLane, string> = { SCALE_READY: "대량등록 검토군", VALIDATE_NEXT: "검증 우선", WATCH: "관찰" };
const laneHelp: Record<DiscoveryPortfolioLane, string> = { SCALE_READY: "수요·확장성·준비도가 높아 다음 검증을 우선합니다.", VALIDATE_NEXT: "수익성 또는 공급 근거를 먼저 채우면 유망합니다.", WATCH: "신호를 더 축적한 뒤 재평가합니다." };
const stateLabel = (state: string) => ({ BREAKOUT: "급상승", RISING: "상승", PERSISTENT: "지속 수요", SATURATED: "경쟁 과열", DECLINING: "하락" }[state] ?? state);
const score = (value: number) => Math.round(value);

export default function MarketPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [lane, setLane] = useState<"ALL" | DiscoveryPortfolioLane>("ALL");
  const [selectedBatch, setSelectedBatch] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/market/discovery-dashboard", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "아이템 발굴 데이터를 불러오지 못했습니다.");
      setData(body.dashboard); setSelectedId((current) => current || body.dashboard.portfolio?.[0]?.id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "아이템 발굴 조회 오류"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function rebuild() {
    setRebuilding(true); setError("");
    try {
      const csrfResponse = await fetch("/api/admin/auth/csrf?purpose=market-collection-run", { cache: "no-store" });
      const csrf = await csrfResponse.json();
      if (!csrfResponse.ok || !csrf.token) throw new Error("재산출 요청 인증에 실패했습니다.");
      const response = await fetch("/api/market/intelligence", { method: "POST", headers: { "content-type": "application/json", "X-GonggamLine-CSRF": csrf.token }, body: "{}" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "시장 인텔리전스 재산출에 실패했습니다.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "시장 인텔리전스 재산출 오류"); }
    finally { setRebuilding(false); }
  }
  const shown = useMemo(() => (data?.portfolio ?? []).filter((item) => lane === "ALL" || item.lane === lane), [data, lane]);
  const selected = data?.portfolio.find((item) => item.id === selectedId) ?? shown[0] ?? null;
  const profiles = (data?.finder.keywordProfiles ?? []).slice().sort((a, b) => b.score - a.score).slice(0, 12);
  const scaleReady = data?.portfolio.filter((item) => item.lane === "SCALE_READY").length ?? 0;
  function toggleBatch(id: string) { setSelectedBatch((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function exportShortlist() {
    if (!data) return;
    const rows = data.portfolio.filter((item) => selectedBatch.includes(item.id));
    const csv = ["rank,title,form,priority,market,growth,profit,scale,readiness,risk,lane", ...rows.map((item) => [data.portfolio.indexOf(item) + 1, item.title, item.form, item.priorityScore, item.marketScore, item.growthScore, item.profitScore, item.scaleScore, item.readinessScore, item.riskScore, item.lane].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `item-discovery-shortlist-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <main className="discovery-command">
    <ExternalImportPanel />
    <section className="discovery-command__hero"><div><p className="eyebrow">ENGINE 1 · CONTINUOUS MARKET DISCOVERY</p><h1>1. 시장정보·아이템 발굴</h1><p>최신 시장 신호를 읽고, 판매 가능성이 높은 상품군을 점수화해 우선순위와 근거를 한 화면에서 결정합니다.</p></div><div className="discovery-command__hero-actions"><button onClick={() => void rebuild()} disabled={rebuilding || loading}>{rebuilding ? "상위 10개 재산출 중" : "실제 SKU 상위 10개 재산출"}</button><button onClick={() => void load()} disabled={loading}>{loading ? "갱신 중" : "저장 결과 새로고침"}</button><Link href="/admin/item-selection">2. 상품선정·수익성으로 이동</Link></div></section>
    <nav className="discovery-command__steps" aria-label="아이템 발굴 업무 순서"><a href="#trend"><b>1</b><span>시장 트렌드</span><small>무엇이 뜨는가</small></a><a href="#priority"><b>2</b><span>후보 우선순위</span><small>무엇을 팔 것인가</small></a><a href="#detail"><b>3</b><span>상세 근거</span><small>왜 유망한가</small></a><a href="#handoff"><b>4</b><span>검증·소싱</span><small>다음 실행은 무엇인가</small></a></nav>
    {error && <div className="notice error-notice">{error}</div>}
    <section className="discovery-command__metrics"><article><span>관찰 키워드</span><strong>{data?.finder.summary.trackedKeywords ?? 0}</strong><small>상시 수집 대상</small></article><article><span>상승 트렌드</span><strong>{data?.finder.summary.actionableCount ?? 0}</strong><small>판매기회 신호</small></article><article><span>판매 후보</span><strong>{data?.portfolio.length ?? 0}</strong><small>중복·데모 제외</small></article><article className="is-accent"><span>대량등록 검토군</span><strong>{scaleReady}</strong><small>후속 검증 우선</small></article><article><span>독립 데이터 출처</span><strong>{data?.finder.summary.providerCount ?? 0}</strong><small>{data?.finder.providerCoverage.join(" · ") || "수집 대기"}</small></article></section>
    <section className="discovery-command__panel" id="trend"><header><div><p className="eyebrow">STEP 1 · RECENT DEMAND</p><h2>최근 시장 트렌드</h2><span>수요·검색·콘텐츠·쇼핑 의도가 함께 상승한 상품군부터 보여줍니다.</span></div><time>{data?.finder.completedAt ? `최근 분석 ${new Date(data.finder.completedAt).toLocaleString("ko-KR")}` : "분석 시각 확인 중"}</time></header><div className="trend-board">{profiles.length ? profiles.map((item, index) => <article key={item.keyword}><div><b>#{index + 1}</b><span className={`trend-state trend-state--${item.state.toLowerCase()}`}>{stateLabel(item.state)}</span></div><h3>{item.keyword}</h3><strong>{score(item.score)}점</strong><dl><div><dt>수요</dt><dd>{score(item.demand)}</dd></div><div><dt>상승세</dt><dd>{item.momentum >= 0 ? "+" : ""}{score(item.momentum)}</dd></div><div><dt>구매의도</dt><dd>{score(item.shoppingIntent)}</dd></div><div><dt>경쟁여지</dt><dd>{score(item.competitionHeadroom)}</dd></div></dl><small>{item.providers.join(" · ")}</small></article>) : <p className="empty-copy">수집된 시장 신호를 분석 중입니다.</p>}</div></section>
    <section className="discovery-command__panel" id="sku-ranking"><header><div><p className="eyebrow">VERIFIED SKU · TOP 10</p><h2>실제 SKU 상위 10개</h2><span>실제 상품 식별자와 원문이 있는 후보만 표시합니다. 상품과 직접 매칭되지 않는 TikTok 신호는 점수에서 제외하고, 최신 SKU 견적·물류비만 결합합니다.</span></div><small>실제 SKU {data?.finder.skuRankingAudit?.actualSkuProducts ?? 0} · 쿠팡 exact {data?.finder.skuRankingAudit?.exactCoupangMatches ?? 0} · 최신 견적 {data?.finder.skuRankingAudit?.freshSupplierQuotes ?? 0}</small></header><div className="sku-ranking-table">{(data?.finder.skuRankings ?? []).length ? (data?.finder.skuRankings ?? []).map((item) => <article key={item.skuKey}><b>#{item.rank}</b><div><h3>{item.title}</h3><p>{item.concept} · {item.source} · 쿠팡 매칭 {item.coupangMatch}</p><small>{item.priceKrw ? `관측가 ${item.priceKrw.toLocaleString("ko-KR")}원` : "관측가 없음"} · TikTok 관련 {item.relevantTikTokSignals}건 · 제외 {item.ignoredTikTokSignals}건 · {item.supplierQuoteFresh ? `최신 견적 결합${item.skuLogisticsCostKrw !== null ? ` / SKU 물류 ${item.skuLogisticsCostKrw.toLocaleString("ko-KR")}원` : ""}${item.estimatedProfitKrw !== null ? ` / 예상 순익 ${item.estimatedProfitKrw.toLocaleString("ko-KR")}원` : ""}` : "최신 견적 없음"}</small>{item.missingEvidence.length > 0 && <p className="sku-ranking-table__missing">미확인: {item.missingEvidence.join(" · ")}</p>}</div><strong>{score(item.score)}점<small>신뢰도 {score(item.confidence)}</small></strong>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">원문 확인</a>}</article>) : <div className="empty-copy"><b>아직 실제 SKU 상위 후보가 없습니다.</b><p>상품군 신호는 유지하되 SKU로 위장하지 않습니다. 쿠팡 상품 관측 또는 텐비 실상품 import가 들어오면 자동 재산출됩니다.</p></div>}</div></section>
    <section className="discovery-command__panel" id="priority"><header><div><p className="eyebrow">STEP 2 · RANKED PORTFOLIO</p><h2>판매 후보 우선순위</h2><span>시장성·수익성·확장성·실행준비도를 비교해 가장 나은 후보부터 정렬합니다.</span></div><div className="lane-tabs">{(["ALL", "SCALE_READY", "VALIDATE_NEXT", "WATCH"] as const).map((value) => <button key={value} className={lane === value ? "is-active" : ""} onClick={() => setLane(value)}>{value === "ALL" ? "전체" : laneLabel[value]}</button>)}</div></header><div className="priority-layout"><div className="priority-list">{shown.map((item) => <article key={item.id} className={selected?.id === item.id ? "is-selected" : ""} onClick={() => setSelectedId(item.id)}><label onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedBatch.includes(item.id)} onChange={() => toggleBatch(item.id)} aria-label={`${item.title} 일괄 검토 선택`} /></label><b className="priority-rank">{(data?.portfolio.indexOf(item) ?? 0) + 1}</b><div><h3>{item.title}</h3><p>{item.form === "bundle" ? "묶음 구성" : item.form === "set" ? "세트 구성" : "단일 상품"} · {item.source === "EVALUATED_PRODUCT" ? "실상품 평가" : "시장 신호 발굴"}</p></div><strong>{score(item.priorityScore)}</strong><span className={`lane-badge lane-badge--${item.lane.toLowerCase()}`}>{laneLabel[item.lane]}</span></article>)}{!shown.length && <p className="empty-copy">이 구간의 후보가 아직 없습니다.</p>}</div><aside><h3>대량 판매 후보군</h3><p>여러 상품을 빠르게 검토하되, 수익성과 권리가 확인되지 않은 상품을 자동 등록하지는 않습니다.</p><strong>{selectedBatch.length}개 선택</strong><button disabled={!selectedBatch.length} onClick={exportShortlist}>선택 후보 CSV</button></aside></div></section>
    <section className="discovery-command__panel" id="detail"><header><div><p className="eyebrow">STEP 3 · DECISION EVIDENCE</p><h2>후보 상세 근거</h2><span>점수 하나가 아니라 강점과 미확인 항목을 함께 보고 판단합니다.</span></div></header>{selected ? <div className="candidate-detail"><div className="candidate-detail__main"><div className="candidate-detail__title"><div><span className={`lane-badge lane-badge--${selected.lane.toLowerCase()}`}>{laneLabel[selected.lane]}</span><h3>{selected.title}</h3><p>{laneHelp[selected.lane]}</p></div><strong>{score(selected.priorityScore)}<small>/100</small></strong></div><div className="score-grid">{[["시장성",selected.marketScore],["성장성",selected.growthScore],["수익성",selected.profitScore],["대량 확장성",selected.scaleScore],["실행 준비도",selected.readinessScore],["신뢰도",selected.confidence]].map(([label,value]) => <div key={String(label)}><span>{label}</span><b>{score(Number(value))}</b><i><em style={{width:`${Math.max(0,Math.min(100,Number(value)))}%`}} /></i></div>)}</div></div><div className="candidate-detail__evidence"><h4>선정 근거</h4>{selected.reasons.length ? <ul>{selected.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>상세 근거 축적 중</p>}<h4>다음 검증 항목</h4>{selected.unresolved.length ? <ul className="is-warning">{selected.unresolved.map((risk) => <li key={risk}>{risk}</li>)}</ul> : <p>현재 추가 미확인 항목 없음</p>}<p className="risk-score">위험 점수 <b>{score(selected.riskScore)}</b> / 100</p></div></div> : <p className="empty-copy">후보를 선택하면 근거가 표시됩니다.</p>}</section>
    <section className="discovery-command__panel" id="handoff"><header><div><p className="eyebrow">STEP 4 · NEXT ACTION</p><h2>의사결정과 다음 실행</h2><span>시장 발굴 결과를 실제 상품 검증과 공급처 비교로 연결합니다.</span></div></header><div className="handoff-grid"><Link href={`/admin/item-selection?keyword=${encodeURIComponent(selected?.concept || "")}`}><b>2. 경쟁력·수익성 검증</b><span>쿠팡 판매가, 비용, 물류비, 마진을 확인합니다.</span></Link><Link href={`/sourcing?keyword=${encodeURIComponent(selected?.concept || "")}`}><b>3. 공급처 소싱·견적 비교</b><span>도매꾹과 대체 공급처의 조건을 비교합니다.</span></Link><a href="#research"><b>시장 근거 더 보기</b><span>콘텐츠·가격·채널 원천 신호를 확인합니다.</span></a></div></section>
    <details className="discovery-command__research" id="research"><summary>고급 시장 근거·수집 상태 보기</summary><div><section><h3>구매 콘텐츠 신호</h3>{(data?.finder.contentFeed ?? []).slice(0, 8).map((item) => <article key={item.id}><b>{item.keyword}</b><span>{item.title}</span><small>{item.platform} · 쇼핑점수 {score(item.shoppingScore)}{item.viewCount ? ` · 조회 ${item.viewCount.toLocaleString("ko-KR")}` : ""}</small>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">원문</a>}</article>)}</section><section><h3>수집기 상태</h3>{(data?.finder.collectorHealth ?? []).map((item) => <article key={item.collector_key}><b>{item.name}</b><span>{item.status}</span><small>{item.last_success_at ? new Date(item.last_success_at).toLocaleString("ko-KR") : item.last_error || "실행 대기"}</small></article>)}</section></div></details>
  </main>;
}
