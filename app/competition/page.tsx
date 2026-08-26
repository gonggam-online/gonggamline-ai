"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = {
  id: number;
  title: string;
  product_no: string;
  thumbnail: string | null;
  estimated_sale_price: number;
  estimated_profit: number;
  margin_rate: number;
  competition_score?: number;
  competition_grade?: string;
  competition_summary?: string | null;
  competition_analysis_status?: string;
  competition_data_source?: string;
  competition_confidence?: number;
  competition_data_note?: string | null;
  estimated_monthly_units_low?: number | null;
  estimated_monthly_units_high?: number | null;
  estimated_monthly_sales_low?: number | null;
  estimated_monthly_sales_high?: number | null;
};

type ApiResponse = { success: boolean; products?: Product[]; message?: string };
const won = (value: number | null | undefined) => `${Math.round(Number(value ?? 0)).toLocaleString("ko-KR")}원`;
const sourceLabel: Record<string, string> = { external: "실데이터", manual: "수동입력", estimated: "추정치", none: "미분석" };

export default function CompetitionPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [batching, setBatching] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/products?size=100&sort=score", { cache: "no-store" });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.success) throw new Error(data.message || "상품을 불러오지 못했습니다.");
      setProducts(data.products ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "상품 조회 오류");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => ({
    analyzed: products.filter((p) => ["analyzed", "estimated"].includes(p.competition_analysis_status ?? "")).length,
    recommended: products.filter((p) => ["S", "A"].includes(p.competition_grade ?? "")).length,
    external: products.filter((p) => p.competition_data_source === "external").length,
  }), [products]);

  async function autoAnalyze(product: Product) {
    setBusyId(product.id); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/products/${product.id}/competition/auto`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "자동 분석에 실패했습니다.");
      const mode = data.market.source === "external" ? "실데이터" : "추정 모드";
      setMessage(`${product.title}: ${data.analysis.grade}등급 · ${data.analysis.competitionScore}점 (${mode})`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "자동 분석 오류");
    } finally { setBusyId(null); }
  }

  async function batchAnalyze() {
    setBatching(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/competition/analyze-batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10, onlyPending: true }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "일괄 분석 실패");
      setMessage(`${data.analyzedCount}개 상품의 자동 분석을 완료했습니다.`);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "일괄 분석 오류"); }
    finally { setBatching(false); }
  }

  return <main className="dashboard">
    <section className="hero competition-hero">
      <div>
        <p className="eyebrow">ENGINE 2-1 · COUPANG COMPETITION</p>
        <h1>2-1. 쿠팡 판매 경쟁력 분석</h1>
        <p className="hero-description">상품별 자동 분석과 수동 실데이터 입력을 함께 지원합니다. 외부 시장 데이터 공급원이 연결되지 않은 경우 결과에 반드시 ‘추정치’로 표시됩니다.</p>
      </div>
      <div className="hero-actions">
        <button onClick={batchAnalyze} disabled={batching}>{batching ? "분석 중…" : "미분석 상품 10개 자동 분석"}</button>
      </div>
    </section>

    <section className="stat-grid">
      <article><span>분석 완료</span><strong>{stats.analyzed}</strong></article>
      <article><span>S·A 등급 후보</span><strong>{stats.recommended}</strong></article>
      <article><span>외부 실데이터 분석</span><strong>{stats.external}</strong></article>
    </section>
    {message && <div className="notice success-notice">{message}</div>}
    {error && <div className="notice error-notice">{error}</div>}

    {loading ? <section className="loading-panel">상품을 불러오는 중입니다.</section> :
      <section className="product-grid">{products.map((product) => {
        const source = product.competition_data_source ?? "none";
        return <article className="product-card" key={product.id}>
          <div className="thumbnail-wrap">
            {product.thumbnail ? <img className="thumbnail" src={product.thumbnail} alt={product.title}/> : <div className="thumbnail-placeholder">이미지 없음</div>}
            <div className="score-badge">{product.competition_grade ?? "미분석"} · {Number(product.competition_score ?? 0)}점</div>
          </div>
          <div className="product-content">
            <div className="product-meta"><span>#{product.product_no}</span><span>마진 {product.margin_rate}%</span></div>
            <h2>{product.title}</h2>
            <div className="badge-row"><span className={`data-source source-${source}`}>{sourceLabel[source] ?? source}</span><span className="confidence-badge">신뢰도 {Number(product.competition_confidence ?? 0)}%</span></div>
            <dl className="price-grid">
              <div><dt>예상 판매가</dt><dd>{won(product.estimated_sale_price)}</dd></div><div><dt>예상이익</dt><dd>{won(product.estimated_profit)}</dd></div>
              <div><dt>월 판매 예상</dt><dd>{product.estimated_monthly_units_low ?? 0}~{product.estimated_monthly_units_high ?? 0}개</dd></div><div><dt>월매출 예상</dt><dd>{won(product.estimated_monthly_sales_low)}~{won(product.estimated_monthly_sales_high)}</dd></div>
            </dl>
            {product.competition_summary && <p className="analysis-summary">{product.competition_summary}</p>}
            {product.competition_data_note && <p className="data-note">{product.competition_data_note}</p>}
            <div className="competition-actions">
              <button onClick={() => autoAnalyze(product)} disabled={busyId === product.id}>{busyId === product.id ? "분석 중…" : "자동 분석"}</button>
              <button className="secondary-button" onClick={() => setSelected(product)}>실데이터 직접 입력</button>
            </div>
          </div>
        </article>;
      })}</section>}
    {selected && <AnalysisModal product={selected} onClose={() => setSelected(null)} onDone={async (text) => { setMessage(text); setSelected(null); await load(); }}/>} 
  </main>;
}

function AnalysisModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: (message: string) => Promise<void> }) {
  const [values, setValues] = useState({ marketPrice: product.estimated_sale_price, top10AveragePrice: product.estimated_sale_price, resultCount: 1000, rocketRatio: 50, averageReviewCount: 100, averageRating: 4.5, monthlySearchVolume: 3000 });
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch(`/api/products/${product.id}/competition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message ?? "분석 실패");
      await onDone(`${product.title} 실데이터 분석 완료: ${data.analysis.grade}등급 · ${data.analysis.competitionScore}점`);
    } catch (caught) { alert(caught instanceof Error ? caught.message : "분석 실패"); }
    finally { setSaving(false); }
  }
  const fields: [keyof typeof values, string][] = [["marketPrice","쿠팡 대표 판매가"],["top10AveragePrice","상위 10개 평균가"],["resultCount","검색 결과 수"],["rocketRatio","로켓 상품 비율(%)"],["averageReviewCount","상위 평균 리뷰 수"],["averageRating","상위 평균 평점"],["monthlySearchVolume","월 검색량"]];
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-header"><div><p>쿠팡 실데이터 직접 입력</p><h2>{product.title}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>
    <p className="modal-guide">쿠팡 검색 화면이나 허용된 데이터 도구에서 확인한 값을 입력하세요. 입력값은 ‘수동입력·신뢰도 75%’로 기록됩니다.</p>
    <div className="modal-grid">{fields.map(([key,label]) => <label key={key}>{label}<input type="number" step={key === "averageRating" ? "0.1" : "1"} value={values[key]} onChange={(event) => setValues((current) => ({...current,[key]:Number(event.target.value)}))}/></label>)}</div>
    <div className="modal-actions"><button disabled={saving}>{saving ? "분석 중…" : "실데이터 분석 저장"}</button><button type="button" className="secondary-button" onClick={onClose}>취소</button></div>
  </form></div>;
}
