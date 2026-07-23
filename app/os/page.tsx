"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ProfitSnapshot={gross_revenue?:number|string|null;contribution_profit?:number|string|null;margin_rate?:number|string|null;roas?:number|string|null};
type Overview={generatedAt:string;revenue?:ProfitSnapshot;counts?:{products?:number};activity?:{activeWorkers?:number}};
type Health={overall?:string;checks?:Array<{component:string;status:string;message:string;latencyMs?:number}>};
type PipelineStep={code:string;name:string;status:string;total:number;blocked:number;active:number};
type ProductRow={id?:string|number;product_name?:string;name?:string;title?:string;status?:string;decision_status?:string};
type MarketplaceRow={id:string|number;marketplace_name:string;status:string;automation_level?:number;product_count?:number};
type MemoryRow={id:string|number;title:string;learning?:string;result?:string;reason?:string;confidence?:number;impact_score?:number};
type KnowledgeRow={id:string|number;title:string;summary?:string;asset_type?:string;version?:string|number;success_rate?:number};
type NotificationRow={id:string|number;severity:string;title:string;message:string;created_at:string};
type ReleaseRow={id:string|number;version:string;release_name:string;status:string;migration_name?:string|null;released_at?:string|null};
type Enterprise={
 version?:string;
 ceoBrief?:{headline?:string;status?:string;executive_summary?:string;priorities?:unknown;recommended_actions?:unknown;risks?:unknown}|null;
 profit?:ProfitSnapshot|null;
 readiness?:{automationReadiness?:number;connectedMarkets?:number;activeKnowledge?:number;memoryCount?:number;unreadNotifications?:number};
 products?:ProductRow[];marketplaces?:MarketplaceRow[];memories?:MemoryRow[];knowledge?:KnowledgeRow[];notifications?:NotificationRow[];
};
type Dashboard={overview:Overview;health:Health;pipeline:PipelineStep[];activities:unknown[];workers:unknown[];releases:ReleaseRow[];commands:unknown[];enterprise:Enterprise};
const money=(v:unknown)=>`${Math.round(Number(v||0)).toLocaleString("ko-KR")}원`;
const list=(v:unknown):string[]=>Array.isArray(v)?v as string[]:[];
const commands=[
 ["discover_products","상품 발굴 시작","시장 후보와 검증 대기열 생성"],
 ["run_ai_analysis","AI 분석 실행","수요·경쟁·수익성 분석"],
 ["generate_content","상세페이지 생성","상품명·키워드·상세 콘텐츠"],
 ["prepare_coupang","쿠팡 등록 준비","등록 초안 검증 및 제출 준비"],
 ["run_ceo_brief","AI CEO 브리핑","우선순위·리스크·추천 행동 생성"],
 ["run_full_pipeline","전체 자율 실행","발굴부터 등록 준비까지 안전 실행"],
] as const;

export default function CompanyOSPage(){
 const [data,setData]=useState<Dashboard|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[running,setRunning]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await fetch("/api/os/dashboard",{cache:"no-store"});const j=await r.json();if(!j.success)throw new Error(j.message);setData(j.dashboard)}catch(e){setError(e instanceof Error?e.message:"Dashboard 조회 오류")}finally{setLoading(false)}},[]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),30000);return()=>clearInterval(timer)},[load]);
 const run=async(code:string)=>{setRunning(code);setError("");try{const r=await fetch("/api/os/commands",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({commandCode:code})});const j=await r.json();if(!j.success)throw new Error(j.message);await load()}catch(e){setError(e instanceof Error?e.message:"명령 실행 오류")}finally{setRunning("")}};
 const o=data?.overview,h=data?.health,e=data?.enterprise,b=e?.ceoBrief,p=e?.profit||o?.revenue||{},ready=e?.readiness||{};
 return <main className="os-shell enterprise-shell">
  <section className="os-hero enterprise-hero"><div><p className="eyebrow">GONGGAMLINE AI · AUTONOMOUS COMPANY OS</p><h1>AI Company Enterprise</h1><p>AI CEO가 우선순위를 결정하고, Manager와 Worker가 실행하며, 결과를 Memory와 Knowledge로 축적합니다.</p></div><div className="os-version"><span>VERSION</span><strong>v{e?.version||"11.0.0"}</strong><small>{h?.overall||"checking"} · 자율운영 {ready.automationReadiness||0}%</small></div></section>
  <nav className="os-nav"><Link href="/revenue">Revenue Center</Link><Link href="/">상품 운영</Link><Link href="/workflow">Workflow</Link><Link href="/seller">쿠팡 등록</Link><Link href="/system">Engine</Link><button onClick={()=>void load()} disabled={loading}>{loading?"확인 중":"전체 새로고침"}</button></nav>
  {error&&<div className="os-alert error">{error}<br/><small>018_autonomous_company_enterprise.sql 적용 여부를 확인하세요.</small></div>}

  <section className="ceo-grid">
   <article className="os-panel ceo-brief"><div className="os-title"><div><p>AI CEO BRIEF</p><h2>{b?.headline||"오늘의 경영 브리핑을 준비 중입니다."}</h2></div><span className="os-state ok">{b?.status||"ready"}</span></div><p className="ceo-summary">{b?.executive_summary||"실데이터가 쌓이면 매출·이익·리스크 기반으로 자동 브리핑합니다."}</p><div className="ceo-columns"><div><strong>오늘의 우선순위</strong>{list(b?.priorities).map((x,i)=><span key={i}>{i+1}. {x}</span>)}</div><div><strong>추천 행동</strong>{list(b?.recommended_actions).map((x,i)=><span key={i}>→ {x}</span>)}</div><div><strong>핵심 리스크</strong>{list(b?.risks).map((x,i)=><span key={i}>! {x}</span>)}</div></div></article>
   <article className="os-panel readiness-card"><p>AUTONOMOUS READINESS</p><strong>{ready.automationReadiness||0}%</strong><div className="readiness-bar"><i style={{width:`${ready.automationReadiness||0}%`}}/></div><span>연결 마켓 {ready.connectedMarkets||0}</span><span>활성 Knowledge {ready.activeKnowledge||0}</span><span>AI Memory {ready.memoryCount||0}</span><span>미확인 알림 {ready.unreadNotifications||0}</span></article>
  </section>

  <section className="os-panel command-panel"><div className="os-title"><div><p>COMMAND CENTER</p><h2>AI 회사 실행 명령</h2></div><span>Queue → Manager → Worker → 검증 → Memory</span></div><div className="command-grid">{commands.map(([code,name,desc])=><button key={code} className={code==="run_full_pipeline"?"command-card primary":"command-card"} onClick={()=>void run(code)} disabled={Boolean(running)}><strong>{running===code?"실행 요청 중…":name}</strong><span>{desc}</span></button>)}</div></section>

  <section><div className="os-title"><div><p>EXECUTIVE KPI</p><h2>매출·수익·자율운영 핵심 지표</h2></div><span>{o?new Date(o.generatedAt).toLocaleString("ko-KR"):"-"}</span></div><div className="os-metrics enterprise-metrics"><article><span>총매출</span><strong>{money(p.gross_revenue)}</strong></article><article><span>공헌이익</span><strong>{money(p.contribution_profit)}</strong></article><article><span>마진율</span><strong>{Number(p.margin_rate||0).toFixed(1)}%</strong></article><article><span>ROAS</span><strong>{Number(p.roas||0).toFixed(0)}%</strong></article><article><span>상품</span><strong>{o?.counts?.products||0}개</strong></article><article><span>작업 중 Worker</span><strong>{o?.activity?.activeWorkers||0}명</strong></article><article><span>미확인 알림</span><strong>{ready.unreadNotifications||0}건</strong></article></div></section>

  <section className="os-panel"><div className="os-title"><div><p>WORKFLOW AUTOMATION</p><h2>Commerce Pipeline</h2></div><span>단계별 활성·차단 상태</span></div><div className="pipeline">{(data?.pipeline||[]).map((x,i)=><div className={`pipeline-step ${x.status}`} key={x.code}><div className="pipeline-number">{i+1}</div><strong>{x.name}</strong><span>{x.total}건</span><small>{x.blocked?`차단 ${x.blocked}`:x.active?`진행 ${x.active}`:x.total?"완료/보관":"대기"}</small></div>)}</div></section>

  <section className="enterprise-grid">
   <article className="os-panel"><div className="os-title"><div><p>PRODUCT CENTER</p><h2>상품 포트폴리오</h2></div><span>{e?.products?.length||0} 최근 상품</span></div><div className="os-list">{(e?.products||[]).map((x,i)=><div className="mini-row" key={x.id||i}><strong>{x.product_name||x.name||x.title||`상품 ${i+1}`}</strong><span>{x.status||x.decision_status||"검토"}</span></div>)}{!e?.products?.length&&<p>상품 발굴 명령을 실행하면 후보가 표시됩니다.</p>}</div></article>
   <article className="os-panel"><div className="os-title"><div><p>MARKETPLACE CENTER</p><h2>판매 채널</h2></div><span>{ready.connectedMarkets||0} Connected</span></div><div className="market-grid">{(e?.marketplaces||[]).map((m)=><div key={m.id}><strong>{m.marketplace_name}</strong><span className={`os-state ${m.status==="connected"?"ok":m.status==="error"?"error":"warning"}`}>{m.status}</span><small>L{m.automation_level} · 상품 {m.product_count||0}</small></div>)}</div></article>
   <article className="os-panel"><div className="os-title"><div><p>AI MEMORY</p><h2>결정과 학습 기록</h2></div><span>{ready.memoryCount||0} Memories</span></div><div className="os-list compact">{(e?.memories||[]).map((m)=><article key={m.id}><span className="dot ok"/><div><strong>{m.title}</strong><p>{m.learning||m.result||m.reason||"결과 대기"}</p><small>신뢰도 {m.confidence||0}% · 영향 {m.impact_score||0}</small></div></article>)}{!e?.memories?.length&&<p>AI 의사결정 결과가 자동으로 축적됩니다.</p>}</div></article>
   <article className="os-panel"><div className="os-title"><div><p>KNOWLEDGE CENTER</p><h2>운영 지식 자산</h2></div><span>{ready.activeKnowledge||0} Active</span></div><div className="os-list compact">{(e?.knowledge||[]).map((k)=><article key={k.id}><span className="dot ok"/><div><strong>{k.title}</strong><p>{k.summary}</p><small>{k.asset_type} · v{k.version} · 성공률 {k.success_rate||0}%</small></div></article>)}</div></article>
  </section>

  <section className="os-two"><div className="os-panel"><div className="os-title"><div><p>DIAGNOSTICS</p><h2>System Health</h2></div><span className={`os-state ${h?.overall||"unknown"}`}>{h?.overall||"unknown"}</span></div><div className="os-list compact">{h?.checks?.map((c)=><article key={c.component}><span className={`dot ${c.status}`}/><div><strong>{c.component}</strong><p>{c.message}{c.latencyMs!==undefined?` · ${c.latencyMs}ms`:""}</p></div></article>)}</div></div>
  <div className="os-panel"><div className="os-title"><div><p>NOTIFICATION CENTER</p><h2>운영 알림</h2></div><span>{ready.unreadNotifications||0} Unread</span></div><div className="os-list compact">{(e?.notifications||[]).map((n)=><article key={n.id}><span className={`dot ${n.severity==="error"?"error":n.severity==="warning"?"warning":"ok"}`}/><div><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.created_at).toLocaleString("ko-KR")}</small></div></article>)}{!e?.notifications?.length&&<p>새로운 알림이 없습니다.</p>}</div></div></section>

  <section className="os-panel"><div className="os-title"><div><p>RELEASE MANAGER</p><h2>배포 이력</h2></div></div><div className="release-table"><div className="release-head"><span>버전</span><span>이름</span><span>상태</span><span>Migration</span><span>배포일</span></div>{(data?.releases||[]).map((r)=><div className="release-row" key={r.id}><strong>v{r.version}</strong><span>{r.release_name}</span><span className={`os-state ${r.status==="released"?"ok":"warning"}`}>{r.status}</span><span>{r.migration_name||"-"}</span><span>{r.released_at?new Date(r.released_at).toLocaleDateString("ko-KR"):"-"}</span></div>)}</div></section>
 </main>
}
