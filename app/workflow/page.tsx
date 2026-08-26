"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TimelineEvent = { id: number; stage: string; title: string; created_at: string };
type Workflow = {
  id: number;
  workflow_code: string | null;
  workflow_name: string;
  lifecycle_type: string;
  current_stage: string;
  status: string;
  stage_version: number;
  updated_at: string;
  commerce_timeline_events: TimelineEvent[];
};
type Task = { id: number; workflow_id: number; stage: string; title: string; task_type: string; status: string; priority: number; due_at: string | null };
type Transition = { id: number; workflow_id: number; from_stage: string | null; to_stage: string; trigger_type: string; created_at: string };

const stages = ["market_discovered","ai_recommended","human_approved","supplier_mapped","quote_selected","purchase_approved","purchase_ordered","three_pl_inbound","listing_ready","coupang_registered","selling","learning"];
const labels: Record<string,string> = { market_discovered:"시장 발견", ai_recommended:"AI 추천", human_approved:"사람 승인", supplier_mapped:"도매 연결", quote_selected:"견적 선정", purchase_approved:"발주 승인", purchase_ordered:"발주 완료", three_pl_inbound:"3PL 입고", listing_ready:"Listing 준비", coupang_registered:"쿠팡 등록", selling:"판매", learning:"학습" };

export default function WorkflowPage() {
  const [workflows,setWorkflows] = useState<Workflow[]>([]);
  const [tasks,setTasks] = useState<Task[]>([]);
  const [transitions,setTransitions] = useState<Transition[]>([]);
  const [selectedId,setSelectedId] = useState<number|null>(null);
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(false);

  async function load() {
    const response = await fetch("/api/workflows", { cache:"no-store" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Workflow 조회 실패");
    setWorkflows(data.workflows || []);
    setTasks(data.tasks || []);
    setTransitions(data.transitions || []);
    setSelectedId((value) => value ?? data.workflows?.[0]?.id ?? null);
  }
  async function reconcile() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/workflows/reconcile", { method:"POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "동기화 실패");
      setMessage(`${data.total}개 Workflow 검사, ${data.changed.length}개 자동 전환`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "동기화 오류"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);

  const selected = useMemo(() => workflows.find((item) => item.id === selectedId) || workflows[0], [workflows,selectedId]);
  const selectedTasks = tasks.filter((task) => task.workflow_id === selected?.id);
  const selectedTransitions = transitions.filter((transition) => transition.workflow_id === selected?.id);
  const currentIndex = selected ? stages.indexOf(selected.current_stage) : -1;
  const openTasks = tasks.filter((task) => ["open","in_progress","blocked"].includes(task.status));

  return <main className="dashboard">
    <section className="hero" style={{background:"linear-gradient(135deg,#102a43,#0f766e)"}}>
      <div><p className="eyebrow">COMMERCE WORKFLOW ENGINE · v9.5</p><h1>엔진 간 자동 Workflow 통합센터</h1><p className="hero-description">추천·소싱·발주·3PL·Listing·쿠팡 등록 데이터를 하나의 Workflow ID와 상태 머신으로 연결하고, 다음 업무를 자동 생성합니다.</p></div>
      <div className="hero-actions"><button onClick={reconcile} disabled={loading}>{loading?"동기화 중":"전체 자동 동기화"}</button></div>
    </section>
    <section className="stat-grid"><article><span>전체 Workflow</span><strong>{workflows.length}</strong></article><article><span>활성 Workflow</span><strong>{workflows.filter(x=>x.status==="active").length}</strong></article><article><span>열린 업무</span><strong>{openTasks.length}</strong></article><article><span>완료·학습 단계</span><strong>{workflows.filter(x=>["selling","learning"].includes(x.current_stage)).length}</strong></article></section>
    {message && <div className="notice">{message}</div>}
    <section style={{display:"grid",gridTemplateColumns:"minmax(280px,.85fr) minmax(0,2.15fr)",gap:16,alignItems:"start"}}>
      <aside className="panel"><div className="section-heading"><div><h2>Workflow Queue</h2><p>상품 중심 실행 흐름</p></div><button className="secondary-button" onClick={()=>load().catch(e=>setMessage(e.message))}>새로고침</button></div><div style={{display:"grid",gap:8}}>{workflows.length?workflows.map(workflow=><button key={workflow.id} onClick={()=>setSelectedId(workflow.id)} style={{textAlign:"left",padding:12,borderRadius:10,border:workflow.id===selected?.id?"2px solid #0f766e":"1px solid #d9e1ec",background:"white",color:"#111827"}}><strong>{workflow.workflow_name}</strong><small style={{display:"block",marginTop:5}}>{workflow.workflow_code || `WF-${workflow.id}`} · {labels[workflow.current_stage] || workflow.current_stage}</small><small style={{display:"block",marginTop:3}}>v{workflow.stage_version} · {workflow.lifecycle_type}</small></button>):<p className="empty-copy">Workflow가 없습니다. AI 추천을 승인하세요.</p>}</div></aside>
      {selected?<section style={{display:"grid",gap:16}}>
        <article className="panel"><div className="section-heading"><div><p className="eyebrow" style={{color:"#0f766e"}}>{selected.workflow_code || `WORKFLOW #${selected.id}`}</p><h2>{selected.workflow_name}</h2><p>{labels[selected.current_stage] || selected.current_stage} · {selected.status} · {new Date(selected.updated_at).toLocaleString("ko-KR")}</p></div><Link className="button-link" href="/workspace">통합 Workspace 열기</Link></div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:14}}>{stages.map((stage,index)=><span key={stage} style={{padding:"8px 10px",borderRadius:9,fontSize:12,fontWeight:700,background:index<=currentIndex?"#ccfbf1":"#f1f5f9",color:index<=currentIndex?"#0f766e":"#64748b"}}>{index<currentIndex?"✓ ":index===currentIndex?"● ":""}{labels[stage]}</span>)}</div></article>
        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
          <article className="panel"><h3>다음 업무</h3><div style={{display:"grid",gap:8,marginTop:10}}>{selectedTasks.length?selectedTasks.map(task=><div key={task.id} style={{padding:10,border:"1px solid #dbe3f0",borderRadius:9}}><strong>{task.title}</strong><small style={{display:"block",marginTop:4}}>{task.status} · 우선순위 {task.priority} · {labels[task.stage]||task.stage}</small></div>):<p className="empty-copy">생성된 업무 없음</p>}</div></article>
          <article className="panel"><h3>최근 전환</h3><div style={{display:"grid",gap:8,marginTop:10}}>{selectedTransitions.slice(0,8).map(item=><div key={item.id} style={{padding:10,border:"1px solid #dbe3f0",borderRadius:9}}><strong>{labels[item.from_stage||""]||item.from_stage||"생성"} → {labels[item.to_stage]||item.to_stage}</strong><small style={{display:"block",marginTop:4}}>{item.trigger_type} · {new Date(item.created_at).toLocaleString("ko-KR")}</small></div>)}</div></article>
        </section>
        <article className="panel"><h2>Commerce Timeline</h2><div style={{display:"grid",gap:10,marginTop:12}}>{[...(selected.commerce_timeline_events||[])].sort((a,b)=>b.id-a.id).map(event=><div key={event.id} style={{borderLeft:"4px solid #0f766e",padding:"8px 12px",background:"#f8fafc",borderRadius:8}}><strong>{event.title}</strong><small style={{display:"block",marginTop:4}}>{labels[event.stage]||event.stage} · {new Date(event.created_at).toLocaleString("ko-KR")}</small></div>)}</div></article>
      </section>:<section className="panel"><p className="empty-copy">Workflow를 생성하세요.</p></section>}
    </section>
  </main>;
}
