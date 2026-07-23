import { supabase } from "@/lib/supabase";
import { engineRegistry } from "@/engines/registry";

export type HealthStatus = "ok" | "warning" | "error" | "unknown";
export type HealthItem = { component: string; status: HealthStatus; message: string; latencyMs?: number };

const PIPELINE = [
  ["market_discovered", "상품발굴"], ["ai_recommended", "AI 검증"], ["human_approved", "승인"],
  ["supplier_mapped", "공급사"], ["quote_selected", "마진"], ["purchase_approved", "발주승인"],
  ["purchase_ordered", "발주"], ["three_pl_inbound", "입고"], ["listing_ready", "콘텐츠"],
  ["coupang_registered", "쿠팡등록"], ["selling", "판매"], ["learning", "학습"],
] as const;

async function countTable(table: string) {
  const started = Date.now();
  const result = await supabase.from(table).select("*", { count: "exact", head: true });
  if (result.error) throw result.error;
  return { count: result.count ?? 0, latencyMs: Date.now() - started };
}

async function safeCount(table: string, filters?: (q: any) => any) {
  try {
    let q: any = supabase.from(table).select("*", { count: "exact", head: true });
    if (filters) q = filters(q);
    const result = await q;
    return result.error ? 0 : result.count ?? 0;
  } catch { return 0; }
}

export async function getSystemHealth() {
  const checks: HealthItem[] = [];
  const envReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  checks.push({ component: "Environment", status: envReady ? "ok" : "error", message: envReady ? "Supabase 환경변수 연결됨" : "Supabase 환경변수 누락" });

  for (const [component, table, emptyMessage] of [
    ["Database", "commerce_workflows", "Workflow 데이터 없음"],
    ["Queue", "os_command_runs", "실행 대기 명령 없음"],
    ["Memory", "ai_decision_runs", "AI Decision 기록 없음"],
    ["Storage", "listing_drafts", "Listing 초안 없음"],
  ] as const) {
    try {
      const result = await countTable(table);
      checks.push({ component, status: component === "Database" || result.count > 0 ? "ok" : "warning", message: result.count > 0 ? `${result.count}건 확인` : emptyMessage, latencyMs: result.latencyMs });
    } catch (error) {
      checks.push({ component, status: component === "Database" ? "error" : "warning", message: error instanceof Error ? error.message : `${component} 확인 실패` });
    }
  }

  const ready = engineRegistry.filter((engine) => engine.health === "ready").length;
  const degraded = engineRegistry.filter((engine) => engine.health === "degraded").length;
  checks.push({ component: "Engines", status: degraded ? "warning" : "ok", message: `Ready ${ready}, Degraded ${degraded}, Total ${engineRegistry.length}` });

  try {
    const workers = await countTable("ai_workers");
    checks.push({ component: "AI Workers", status: workers.count > 0 ? "ok" : "warning", message: `${workers.count}개 Worker 등록`, latencyMs: workers.latencyMs });
  } catch { checks.push({ component: "AI Workers", status: "warning", message: "016 migration 적용 필요" }); }

  const overall = checks.some(x => x.status === "error") ? "error" : checks.some(x => x.status === "warning") ? "warning" : "ok";
  return { version: "11.0.0", checkedAt: new Date().toISOString(), overall, checks };
}

export async function getCompanyOverview() {
  const [products, workflows, activeWorkflows, listings, decisions, workers, releases, commandsToday, transitionsToday, tasksOpen] = await Promise.all([
    safeCount("collected_products"), safeCount("commerce_workflows"), safeCount("commerce_workflows", q => q.eq("status", "active")),
    safeCount("listing_drafts"), safeCount("ai_decision_runs"), safeCount("ai_workers"), safeCount("system_releases"),
    safeCount("os_command_runs", q => q.gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())),
    safeCount("workflow_transitions", q => q.gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())),
    safeCount("workflow_tasks", q => q.in("status", ["open", "in_progress", "blocked"])),
  ]);
  let revenue: any = null;
  try { revenue = (await supabase.from("revenue_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1).maybeSingle()).data; } catch {}
  return {
    version: "11.0.0", generatedAt: new Date().toISOString(),
    counts: { products, workflows, activeWorkflows, listings, decisions, workers, releases },
    activity: { commandsToday, transitionsToday, tasksOpen, activeWorkers: await safeCount("ai_workers", q => q.eq("status", "working")) },
    revenue: revenue ?? { gross_revenue: 0, contribution_profit: 0, order_count: 0, ad_spend: 0, active_product_count: 0, out_of_stock_count: 0, automation_rate: 0, ai_execution_rate: 0 },
  };
}

export async function getPipeline() {
  let rows: Array<{current_stage?: string; status?: string}> = [];
  try {
    const result = await supabase.from("commerce_workflows").select("current_stage,status");
    if (!result.error) rows = result.data ?? [];
  } catch {}
  return PIPELINE.map(([code, name], index) => {
    const atStage = rows.filter(row => row.current_stage === code);
    const active = atStage.filter(row => row.status === "active").length;
    const blocked = atStage.filter(row => row.status === "blocked").length;
    const completed = atStage.filter(row => row.status === "completed").length;
    return { code, name, order: index + 1, total: atStage.length, active, blocked, completed, status: blocked ? "blocked" : active ? "active" : atStage.length ? "completed" : "waiting" };
  });
}

export async function getRecentActivity() {
  const items: Array<{id:string; type:string; title:string; detail:string; status:string; createdAt:string}> = [];
  try {
    const result = await supabase.from("os_command_runs").select("id,command_name,status,progress,created_at,error_message").order("created_at", { ascending: false }).limit(8);
    for (const row of result.data ?? []) items.push({ id:`command-${row.id}`, type:"command", title:row.command_name, detail:row.error_message || `진행률 ${row.progress}%`, status:row.status, createdAt:row.created_at });
  } catch {}
  try {
    const result = await supabase.from("workflow_transitions").select("id,to_stage,title,actor,created_at").order("created_at", { ascending: false }).limit(8);
    for (const row of result.data ?? []) items.push({ id:`transition-${row.id}`, type:"workflow", title:row.title || `Workflow → ${row.to_stage}`, detail:row.actor || "system", status:"completed", createdAt:row.created_at });
  } catch {}
  return items.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,10);
}

export async function getDashboard() {
  const [overview, health, pipeline, activities, workers, releases, commands] = await Promise.all([
    getCompanyOverview(), getSystemHealth(), getPipeline(), getRecentActivity(), listWorkers(), listReleases(), listCommands(),
  ]);
  return { overview, health, pipeline, activities, workers, releases, commands };
}

export async function listWorkers() {
  const result = await supabase.from("ai_workers").select("*").order("worker_code");
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}
export async function listReleases() {
  const result = await supabase.from("system_releases").select("*").order("created_at", { ascending: false }).limit(20);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}
export async function listCommands() {
  try {
    const result = await supabase.from("os_command_runs").select("*").order("created_at", { ascending: false }).limit(12);
    return result.error ? [] : result.data ?? [];
  } catch { return []; }
}

async function safeRows(table: string, orderColumn = "created_at", limit = 10) {
  try {
    const result = await supabase.from(table).select("*").order(orderColumn, { ascending: false }).limit(limit);
    return result.error ? [] : result.data ?? [];
  } catch { return []; }
}

export async function getEnterpriseDashboard() {
  const base = await getDashboard();
  const [ceoBriefs, memories, knowledge, marketplaces, notifications, profitSnapshots, products, suppliers] = await Promise.all([
    safeRows("ai_ceo_briefs", "brief_date", 1),
    safeRows("ai_memory_events", "created_at", 8),
    safeRows("knowledge_assets", "updated_at", 8),
    safeRows("marketplace_connections", "created_at", 12),
    safeRows("os_notifications", "created_at", 10),
    safeRows("profit_snapshots", "snapshot_date", 1),
    safeRows("collected_products", "created_at", 8),
    safeRows("suppliers", "created_at", 8),
  ]);

  const connectedMarkets = marketplaces.filter((m:any) => m.status === "connected").length;
  const unreadNotifications = notifications.filter((n:any) => !n.is_read).length;
  const activeKnowledge = knowledge.filter((k:any) => k.status === "active").length;
  const memoryCount = await safeCount("ai_memory_events");
  const productCount = base.overview?.counts?.products ?? 0;
  const workflowCount = base.overview?.counts?.workflows ?? 0;
  const decisionCount = base.overview?.counts?.decisions ?? 0;
  const activeWorkers = base.overview?.activity?.activeWorkers ?? 0;
  const automationReadiness = Math.min(100, Math.round(
    (connectedMarkets > 0 ? 15 : 0) +
    (base.workers.length > 0 ? 15 : 0) +
    (workflowCount > 0 ? 20 : 0) +
    (decisionCount > 0 ? 15 : 0) +
    (activeKnowledge > 0 ? 15 : 0) +
    (memoryCount > 0 ? 10 : 0) +
    (productCount > 0 ? 10 : 0)
  ));

  return {
    ...base,
    enterprise: {
      version: "11.0.0",
      ceoBrief: ceoBriefs[0] ?? null,
      memories,
      knowledge,
      marketplaces,
      notifications,
      profit: profitSnapshots[0] ?? base.overview?.revenue ?? null,
      products,
      suppliers,
      readiness: {
        automationReadiness,
        connectedMarkets,
        unreadNotifications,
        activeKnowledge,
        memoryCount,
        activeWorkers,
      },
    },
  };
}
