"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { OpportunityStatus, RevenueOpportunity, RuntimeJob } from "@/types/revenue";

type Dashboard = {
  sprint: string;
  generatedAt: string;
  metrics: { total: number; active: number; approved: number; highScore: number; queue: number; expectedMonthlyProfit: number };
  opportunities: RevenueOpportunity[];
  jobs: RuntimeJob[];
  decisions: unknown[];
};

type RuntimeExecutionResult = { executed?: boolean };

const statusLabel: Record<string, string> = {
  idea: "아이디어", candidate: "후보", evaluating: "평가 중", approved: "승인", content: "콘텐츠",
  ready: "등록 준비", published: "등록", selling: "판매", learning: "학습", rejected: "제외", archived: "보관",
};
const money = (value: number) => `${Math.round(Number(value || 0)).toLocaleString("ko-KR")}원`;

export default function RevenueCenterPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [cost, setCost] = useState(5000);
  const [price, setPrice] = useState(12900);
  const [executing, setExecuting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/revenue/dashboard", { cache: "no-store" });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setData(result.dashboard);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Revenue Center 조회 오류");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const top = useMemo(() => (data?.opportunities || []).slice(0, 20), [data]);

  async function create(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const response = await fetch("/api/revenue/opportunities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, title: keyword, estimatedCost: cost, estimatedSalePrice: price, demandScore: 70, marginScore: 75, competitionScore: 55, supplyScore: 70, riskScore: 25, listingScore: 60, expectedMonthlySales: 100 }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setKeyword(""); setMessage("Opportunity와 평가 Job이 생성되었습니다."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "생성 오류"); }
  }

  async function transition(id: number, status: OpportunityStatus) {
    setError("");
    try {
      const response = await fetch(`/api/revenue/opportunities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "상태 변경 오류"); }
  }


  async function executeQueue(limit = 1) {
    setExecuting(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/revenue/runtime/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit }) });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      const results: RuntimeExecutionResult[] = Array.isArray(result.results) ? result.results : [];
      const completed = results.filter((item) => item.executed).length;
      setMessage(completed ? `${completed}개 Runtime Job 실행을 완료했습니다.` : "실행 가능한 Job이 없습니다.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Runtime 실행 오류"); }
    finally { setExecuting(false); }
  }

  async function jobAction(path: "retry" | "cancel", id: number) {
    setError("");
    try {
      const response = await fetch(`/api/revenue/runtime/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Job 처리 오류"); }
  }

  const m = data?.metrics;
  return <main className="revenue-shell">
    <section className="revenue-hero"><div><p className="eyebrow">BLUEPRINT v2.0 · SPRINT 2</p><h1>Revenue Center</h1><p>Queue를 실제 Worker가 선점·실행·기록하고 결과를 Opportunity와 AI Memory에 반영합니다.</p></div><div><strong>Runtime Execution</strong><span>{data?.sprint || "초기화 중"}</span></div></section>
    <nav className="os-nav"><Link href="/os">AI Company OS</Link><Link href="/">상품 운영</Link><Link href="/workflow">Workflow</Link><button onClick={() => void executeQueue(1)} disabled={executing}>{executing ? "Worker 실행 중" : "다음 Job 실행"}</button><button onClick={() => void executeQueue(5)} disabled={executing}>최대 5건 실행</button><button onClick={() => void load()}>{loading ? "확인 중" : "새로고침"}</button></nav>
    {error && <div className="os-alert error">{error}<br/><small>019_sprint1_revenue_core_foundation.sql을 먼저 적용하세요.</small></div>}
    {message && <div className="os-alert success">{message}</div>}

    <section className="revenue-metrics">
      <article><span>전체 Opportunity</span><strong>{m?.total || 0}</strong></article><article><span>활성</span><strong>{m?.active || 0}</strong></article>
      <article><span>80점 이상</span><strong>{m?.highScore || 0}</strong></article><article><span>승인</span><strong>{m?.approved || 0}</strong></article>
      <article><span>Runtime Queue</span><strong>{m?.queue || 0}</strong></article><article><span>예상 월이익</span><strong>{money(m?.expectedMonthlyProfit || 0)}</strong></article>
    </section>

    <section className="revenue-grid">
      <article className="os-panel"><div className="os-title"><div><p>NEW OPPORTUNITY</p><h2>수동 후보 등록</h2></div></div><form className="opportunity-form" onSubmit={create}><label>키워드<input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="예: 차량용 틈새수납함" required /></label><label>예상 원가<input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))}/></label><label>예상 판매가<input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))}/></label><button>Opportunity 생성</button></form></article>
      <article className="os-panel"><div className="os-title"><div><p>RUNTIME QUEUE</p><h2>Worker 작업</h2></div><span>{data?.jobs.length || 0}건</span></div><div className="runtime-list">{(data?.jobs || []).slice(0, 10).map((job) => <div key={job.id}><strong>{job.job_type}</strong><span>{job.worker_code}{job.result_summary ? ` · ${job.result_summary}` : ""}</span><small className={`job-${job.status}`}>{job.status} · P{job.priority}{job.duration_ms ? ` · ${job.duration_ms}ms` : ""}</small><span className="runtime-actions">{job.status === "failed" && <button onClick={() => void jobAction("retry", job.id)}>재시도</button>}{["queued","retry","waiting"].includes(job.status) && <button onClick={() => void jobAction("cancel", job.id)}>취소</button>}</span></div>)}{!data?.jobs.length && <p>대기 작업이 없습니다.</p>}</div></article>
    </section>

    <section className="os-panel"><div className="os-title"><div><p>REVENUE PIPELINE</p><h2>Opportunity 우선순위</h2></div><span>Revenue Score 순</span></div><div className="opportunity-table"><div className="opportunity-head"><span>점수</span><span>Opportunity</span><span>상태</span><span>예상 이익</span><span>월 판매</span><span>다음 실행</span></div>{top.map((item) => <div className="opportunity-row" key={item.id}><strong>{item.revenue_score}</strong><div><b>{item.title}</b><small>{item.keyword} · 신뢰도 {item.ai_confidence}%</small></div><span>{statusLabel[item.status] || item.status}</span><span>{money(item.estimated_profit)}</span><span>{item.expected_monthly_sales}</span><div className="row-actions">{item.status === "candidate" && <button onClick={() => void transition(item.id, "evaluating")}>평가</button>}{item.status === "evaluating" && <button onClick={() => void transition(item.id, "approved")}>승인</button>}{item.status === "approved" && <button onClick={() => void transition(item.id, "content")}>콘텐츠</button>}<button className="muted" onClick={() => void transition(item.id, "rejected")}>제외</button></div></div>)}</div></section>
  </main>;
}
