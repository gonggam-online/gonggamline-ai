"use client";

import { FormEvent, useEffect, useState } from "react";
import type { MarketKeyword } from "../../types/market";

type Alert = { id: number; signal_type: string; severity: string; title: string; detected_at: string };
type Summary = { keywordCount: number; productCount: number; snapshots24h: number; alerts: Alert[] };
type Metrics = { opportunity_score: number; confidence: number; recommendation_grade: string; recommendation_reason: string; estimated_units_low: number; estimated_units_base: number; estimated_units_high: number; review_delta_7d: number; rank_change_7d: number | null; demand_score: number; growth_score: number; stability_score: number; supply_score: number; entry_difficulty_score: number; ad_burden_score: number; data_completeness_score: number; price_volatility_30d: number; review_velocity_7d: number };
type Warehouse = { featureSnapshots: number; feedbackEvents: number; gradeCounts: Record<string, number>; top: Array<Record<string, unknown>> };
type MarketProduct = { id: number; title: string; brand: string | null; seller_name: string | null; source: string; thumbnail_url: string | null; market_product_metrics: Metrics | Metrics[] | null };
type Collector = { collector_key: string; name: string; source_type: string; status: string; supports_automatic: boolean; last_run_at: string | null; last_success_at: string | null; failure_count: number; last_error: string | null };
type Job = { id: number; collector_key: string; status: string; priority: number; interval_minutes: number; next_run_at: string; last_result: Record<string, unknown>; market_keywords: { keyword: string } | { keyword: string }[] | null };

export default function MarketPage() {
  const [summary, setSummary] = useState<Summary>({ keywordCount: 0, productCount: 0, snapshots24h: 0, alerts: [] });
  const [keywords, setKeywords] = useState<MarketKeyword[]>([]);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [warehouse, setWarehouse] = useState<Warehouse>({ featureSnapshots: 0, feedbackEvents: 0, gradeCounts: {}, top: [] });
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function load() {
    const [summaryResponse, keywordResponse, productResponse, collectorResponse, warehouseResponse] = await Promise.all([
      fetch("/api/market/summary", { cache: "no-store" }),
      fetch("/api/market/keywords", { cache: "no-store" }),
      fetch("/api/market/products?limit=30", { cache: "no-store" }),
      fetch("/api/market/collectors", { cache: "no-store" }),
      fetch("/api/market/warehouse", { cache: "no-store" }),
    ]);
    const [summaryData, keywordData, productData, collectorData, warehouseData] = await Promise.all([
      summaryResponse.json(), keywordResponse.json(), productResponse.json(), collectorResponse.json(), warehouseResponse.json(),
    ]);
    if (summaryData.success) setSummary(summaryData.summary);
    if (keywordData.success) setKeywords(keywordData.keywords);
    if (productData.success) setProducts(productData.products);
    if (collectorData.success) {
      setCollectors(collectorData.collectors ?? []);
      setJobs(collectorData.jobs ?? []);
    }
    if (warehouseData.success) setWarehouse(warehouseData.warehouse);
  }

  useEffect(() => { void load(); }, []);

  async function addKeyword(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    const response = await fetch("/api/market/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword, priority: 70 }) });
    const data = await response.json();
    if (!response.ok || !data.success) { setError(data.message || "저장 실패"); return; }
    setKeyword(""); setMessage("관찰 키워드를 등록했습니다."); await load();
  }

  async function runAction(path: string, body: object, successMessage: string) {
    setWorking(true); setError(""); setMessage("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "작업 실패");
      setMessage(successMessage); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "작업 오류"); }
    finally { setWorking(false); }
  }

  async function createDemoJob(keywordId: number) {
    await runAction("/api/market/jobs", { collectorKey: "demo-generator", keywordId, intervalMinutes: 720, priority: 60 }, "수집 스케줄을 등록했습니다.");
  }

  return <main className="dashboard">
    <section className="hero market-hero"><div><p className="eyebrow">ENGINE 1 · MARKET INTELLIGENCE</p><h1>1. 시장정보·아이템 발굴</h1><p className="hero-description">수집·시계열·Feature Warehouse·다차원 기회점수·AI 판단·실매출 피드백을 하나의 데이터 자산으로 축적합니다.</p></div><div className="hero-actions"><button disabled={working} onClick={() => runAction("/api/market/jobs/run", { limit: 20 }, "실행 가능한 수집 작업을 처리했습니다.")}>스케줄 실행</button><button disabled={working} onClick={() => runAction("/api/market/analyze", {}, "전체 시장 분석을 완료했습니다.")}>전체 분석</button><button className="secondary-button" disabled={working} onClick={() => runAction("/api/market/demo-seed", { keyword: keyword || "생활용품" }, "DEMO 데이터로 전체 파이프라인을 검증했습니다.")}>DEMO 검증</button></div></section>

    <section className="stat-grid market-stat-grid"><article><span>관찰 키워드</span><strong>{summary.keywordCount}</strong></article><article><span>추적 상품</span><strong>{summary.productCount}</strong></article><article><span>24시간 스냅샷</span><strong>{summary.snapshots24h}</strong></article><article><span>활성 Collector</span><strong>{collectors.filter((item) => item.status === "ready").length}</strong></article></section>
    {message && <div className="notice success-notice">{message}</div>}{error && <div className="notice error-notice">{error}</div>}

    <section className="stat-grid market-stat-grid"><article><span>Feature 스냅샷</span><strong>{warehouse.featureSnapshots}</strong></article><article><span>운영 피드백</span><strong>{warehouse.feedbackEvents}</strong></article><article><span>S/A 등급</span><strong>{(warehouse.gradeCounts.S ?? 0) + (warehouse.gradeCounts.A ?? 0)}</strong></article><article><span>분석 상품</span><strong>{Object.values(warehouse.gradeCounts).reduce((sum, value) => sum + value, 0)}</strong></article></section>

    <section className="ops-grid"><article className="panel"><h2>관찰 키워드 등록</h2><form className="inline-fields" onSubmit={addKeyword}><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="예: 무선청소기"/><button disabled={working}>등록</button></form><p className="panel-help">등록된 키워드는 Collector 작업의 기준이 되며 모든 관측값은 표준 API `/api/market/observe`로 통합됩니다.</p></article><article className="panel"><h2>수집 안전 원칙</h2><div className="principle-grid"><span>공식 API 우선</span><span>공개 정보만</span><span>403/429 즉시 중단</span><span>저빈도·중복 최소화</span><span>원본 근거 보존</span><span>신뢰도 표시</span></div></article></section>

    <section className="panel intelligence-panel"><div className="section-heading"><div><h2>Collector 운영 상태</h2><p>수집원을 플러그인처럼 관리하고 차단·오류·쿨다운 상태를 분리합니다.</p></div><button className="secondary-button" disabled={working} onClick={() => void load()}>새로고침</button></div><div className="collector-grid">{collectors.length ? collectors.map((collector) => <article className="collector-card" key={collector.collector_key}><div className="collector-card-head"><strong>{collector.name}</strong><span className={`collector-status status-${collector.status}`}>{collector.status}</span></div><p>{collector.source_type} · {collector.supports_automatic ? "자동 실행 지원" : "수동 입력"}</p><small>실패 {collector.failure_count}회{collector.last_error ? ` · ${collector.last_error}` : ""}</small></article>) : <p className="empty-copy">007 마이그레이션 실행 후 Collector 상태가 표시됩니다.</p>}</div></section>

    <section className="market-grid"><article className="panel"><h2>키워드 큐</h2><div className="table-wrap"><table><thead><tr><th>키워드</th><th>상태</th><th>우선순위</th><th>주기</th><th>작업</th></tr></thead><tbody>{keywords.length ? keywords.map((item) => <tr key={item.id}><td><strong>{item.keyword}</strong></td><td>{item.collection_status}</td><td>{item.priority}</td><td>{item.collection_interval_minutes}분</td><td><button className="table-button" disabled={working} onClick={() => createDemoJob(item.id)}>DEMO 스케줄</button></td></tr>) : <tr><td colSpan={5}>아직 등록된 키워드가 없습니다.</td></tr>}</tbody></table></div></article><article className="panel"><h2>최근 시장 신호</h2><div className="signal-list">{summary.alerts.length ? summary.alerts.map((alert) => <div key={alert.id} className={`signal signal-${alert.severity}`}><strong>{alert.title}</strong><span>{alert.signal_type} · {new Date(alert.detected_at).toLocaleString("ko-KR")}</span></div>) : <p className="empty-copy">스냅샷이 쌓이면 가격 급변, 리뷰 급증, 품절·재입고, 순위 변동 신호가 표시됩니다.</p>}</div></article></section>

    <section className="panel intelligence-panel"><div className="section-heading"><div><h2>수집 스케줄</h2><p>현재는 안전한 수동 실행 방식이며, 배포 후 외부 Cron이 `/api/market/jobs/run`을 호출하도록 연결할 수 있습니다.</p></div></div><div className="table-wrap"><table><thead><tr><th>Collector</th><th>키워드</th><th>상태</th><th>주기</th><th>다음 실행</th><th>최근 결과</th></tr></thead><tbody>{jobs.length ? jobs.map((job) => { const keywordData = Array.isArray(job.market_keywords) ? job.market_keywords[0] : job.market_keywords; return <tr key={job.id}><td>{job.collector_key}</td><td>{keywordData?.keyword ?? "-"}</td><td>{job.status}</td><td>{job.interval_minutes}분</td><td>{new Date(job.next_run_at).toLocaleString("ko-KR")}</td><td>{String(job.last_result?.message ?? "대기")}</td></tr>; }) : <tr><td colSpan={6}>등록된 스케줄이 없습니다.</td></tr>}</tbody></table></div></section>

    <section className="panel intelligence-panel"><div className="section-heading"><div><h2>AI 시장 상품 랭킹</h2><p>기회점수·신뢰도·예상 판매 범위를 함께 확인합니다.</p></div><button className="secondary-button" disabled={working} onClick={() => void load()}>새로고침</button></div><div className="table-wrap"><table><thead><tr><th>등급</th><th>상품</th><th>기회점수</th><th>수요/성장</th><th>안정/공급</th><th>진입난도</th><th>월 예상판매</th><th>신뢰도</th><th>추천 근거</th><th>AI 판단</th></tr></thead><tbody>{products.length ? products.map((product) => { const metric = Array.isArray(product.market_product_metrics) ? product.market_product_metrics[0] : product.market_product_metrics; return <tr key={product.id}><td><span className={`grade grade-${metric?.recommendation_grade ?? "D"}`}>{metric?.recommendation_grade ?? "-"}</span></td><td><strong>{product.title}</strong><small>{product.brand || product.seller_name || product.source}</small></td><td>{metric?.opportunity_score ?? "분석 전"}</td><td>{metric ? `${metric.demand_score}/${metric.growth_score}` : "-"}<small>리뷰속도 {metric?.review_velocity_7d ?? 0}/일</small></td><td>{metric ? `${metric.stability_score}/${metric.supply_score}` : "-"}<small>가격변동 {metric?.price_volatility_30d ?? 0}%</small></td><td>{metric?.entry_difficulty_score ?? "-"}<small>광고부담 {metric?.ad_burden_score ?? 0}</small></td><td>{metric ? `${metric.estimated_units_low.toLocaleString()}~${metric.estimated_units_high.toLocaleString()}개` : "-"}</td><td>{metric?.confidence ?? 0}%<small>완전성 {metric?.data_completeness_score ?? 0}</small></td><td>{metric?.recommendation_reason ?? "관측 데이터 필요"}</td><td><button className="table-button" disabled={working || !metric} onClick={() => runAction("/api/market/decide", { productId: product.id }, `${product.title}의 AI 진입 판단을 저장했습니다.`)}>판단 저장</button></td></tr>; }) : <tr><td colSpan={10}>관측 데이터가 없습니다. 실제 Collector를 연결하거나 DEMO 검증으로 파이프라인을 확인하세요.</td></tr>}</tbody></table></div></section>

    <section className="panel architecture-panel"><h2>v8.0 데이터 자산 폐쇄 루프</h2><div className="pipeline"><span>Collectors</span><b>→</b><span>Scheduler</span><b>→</b><span>Time Series</span><b>→</b><span>Feature Warehouse</span><b>→</b><span>Signal Engine</span><b>→</b><span>Sales Estimation</span><b>→</b><span>AI Decision</span><b>→</b><span>실매출 보정</span></div></section>
  </main>;
}
