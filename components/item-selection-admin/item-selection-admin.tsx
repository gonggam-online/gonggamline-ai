"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  DashboardCard,
  DashboardContent,
  DashboardEmptyState,
  DashboardErrorState,
  DashboardHeader,
  DashboardLayout,
  DashboardLoading,
  DashboardSection,
  DashboardToolbar,
} from "@/components/dashboard";
import type {
  ItemSelectionRunDtoV1,
  ItemSelectionRunStatus,
} from "@/shared/contracts/item-selection-persistence";
import type { ItemSelectionVerdict } from "@/shared/domain/item-selection";

type ListEnvelope = Readonly<{
  data: readonly ItemSelectionRunDtoV1[];
  page: Readonly<{ nextCursor: string | null }>;
}>;

type MarketKeywordSuggestion = Readonly<{
  id: number;
  keyword: string;
  category: string | null;
  priority: number;
  demand_score: number | null;
  competition_score: number | null;
  opportunity_score: number | null;
  collection_status: string;
}>;

type ShadowReviewPacket = Readonly<{
  version: string;
  providerItemNumber: string;
  currentVerdict: ItemSelectionVerdict;
  currentScore: number | null;
  operationalVerdictChanged: false;
  requiresManualReview: true;
  shadow: Readonly<{
    decision: "PRIORITIZE_FOR_REVIEW" | "WATCH" | "DO_NOT_PRIORITIZE";
    eligibility: "SHADOW_CANDIDATE" | "INSUFFICIENT_DATA" | "BLOCKED";
    confidenceAdjustedScore: number | null;
    missingFacts: readonly string[];
  }>;
}>;

const STATUS_LABELS: Record<ItemSelectionRunStatus, string> = {
  RUNNING: "실행 중",
  COMPLETED: "완료",
  PARTIAL: "일부 완료",
  FAILED: "실패",
};
const VERDICT_LABELS: Record<ItemSelectionVerdict, string> = {
  RECOMMEND: "추천",
  CONDITIONAL: "기회 검토",
  MANUAL_REVIEW: "수동 확인",
  REJECT: "제외",
};

function runStatusLabel(run: Pick<ItemSelectionRunDtoV1, "status" | "failureCode">): string {
  if (run.failureCode === "STALE_RUN_RECOVERED") return "복구 종결";
  return STATUS_LABELS[run.status];
}

function failureCodeLabel(code: string | null): string {
  if (code === null) return "없음";
  if (code === "STALE_RUN_RECOVERED") return "이전 중단 실행 자동 복구";
  if (code === "PROVIDER_UNAVAILABLE") return "공급처 일시 오류";
  if (code === "FINALIZATION_FAILED") return "결과 저장 실패";
  if (code === "EVALUATION_FAILED") return "후보 평가 실패";
  return code;
}
const SCORE_AREA_LABELS: Record<string, string> = {
  competitiveness: "경쟁력",
  profitability: "수익성",
  demand: "수요",
  conversionPotential: "전환 가능성",
  logisticsFit: "물류 적합성",
  supplyStability: "공급 안정성",
};
const GATE_STATUS_LABELS: Record<string, string> = {
  PASS: "통과",
  FAIL: "실패",
  UNKNOWN: "확인 필요",
  NOT_APPLICABLE: "해당 없음",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(status: number, code?: string): string {
  if (status === 401) return "관리자 로그인이 필요합니다.";
  if (code === "CSRF_DENIED") return "요청 검증에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.";
  if (status === 403) return "실행에는 최근 MFA 인증이 필요합니다.";
  if (status === 429) return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (code === "PROVIDER_UNAVAILABLE") return "공급처를 일시적으로 사용할 수 없습니다.";
  if (code === "DUPLICATE_RUN_ACTIVE") return "동일한 조건의 실행이 이미 진행 중입니다.";
  if (status === 404) return "선택한 실행 이력을 찾을 수 없습니다.";
  return "요청을 완료하지 못했습니다. 다시 시도해 주세요.";
}

async function parseError(response: Response): Promise<string> {
  let code: string | undefined;
  let correlationId: string | undefined;
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = (body as { error?: unknown }).error;
      if (typeof error === "object" && error !== null && "code" in error &&
          typeof (error as { code?: unknown }).code === "string") {
        code = (error as { code: string }).code;
      }
      if (typeof error === "object" && error !== null && "correlationId" in error &&
          typeof (error as { correlationId?: unknown }).correlationId === "string") {
        correlationId = (error as { correlationId: string }).correlationId;
      }
    }
  } catch {
    // The UI deliberately exposes only stable, sanitized messages.
  }
  const message = errorMessage(response.status, code);
  return correlationId ? `${message} (추적 ID: ${correlationId})` : message;
}

export function ItemSelectionAdmin() {
  const [runs, setRuns] = useState<readonly ItemSelectionRunDtoV1[]>([]);
  const [selected, setSelected] = useState<ItemSelectionRunDtoV1 | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ItemSelectionRunStatus>("ALL");
  const [verdictFilter, setVerdictFilter] = useState<"ALL" | ItemSelectionVerdict>("ALL");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [shadowPacket, setShadowPacket] = useState<ShadowReviewPacket | null>(null);
  const [shadowLoading, setShadowLoading] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keywordSuggestions, setKeywordSuggestions] = useState<readonly MarketKeywordSuggestion[]>([]);

  const loadRuns = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "20" });
      if (cursor) query.set("cursor", cursor);
      const response = await fetch(`/api/admin/item-selection/runs?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await parseError(response));
      const body = (await response.json()) as ListEnvelope;
      setRuns(body.data);
      setNextCursor(body.page.nextCursor);
    } catch (caught) {
      setRuns([]);
      setNextCursor(null);
      setError(caught instanceof Error ? caught.message : errorMessage(500));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  useEffect(() => {
    let active = true;
    void fetch("/api/market/keywords", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as Readonly<{ success?: boolean; keywords?: readonly MarketKeywordSuggestion[] }>;
        if (active && body.success && Array.isArray(body.keywords)) {
          setKeywordSuggestions(body.keywords.filter((item) => item.collection_status === "active").slice(0, 8));
        }
      })
      .catch(() => { /* keyword suggestions are optional and must not block evaluation */ });
    return () => { active = false; };
  }, []);

  async function openDetail(id: string): Promise<void> {
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/item-selection/runs/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await parseError(response));
      const body = (await response.json()) as Readonly<{ data: ItemSelectionRunDtoV1 }>;
      setSelected(body.data);
      setVerdictFilter("ALL");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : errorMessage(500));
    } finally {
      setDetailLoading(false);
    }
  }

  async function pollRun(id: string): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      try {
        const response = await fetch(`/api/admin/item-selection/runs/${id}`, { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as Readonly<{ data: ItemSelectionRunDtoV1 }>;
        setSelected(body.data);
        if (body.data.status !== "RUNNING") {
          await loadRuns();
          return;
        }
      } catch {
        return;
      }
    }
    try {
      const response = await fetch(`/api/admin/item-selection/runs/${id}`, { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as Readonly<{ data: ItemSelectionRunDtoV1 }>;
      setSelected(body.data);
      await loadRuns();
      if (body.data.status === "RUNNING") {
        setMessage("평가가 예상 완료 시간을 초과했습니다. 실행 이력의 새로고침으로 복구 상태를 확인해 주세요.");
      }
    } catch {
      // The durable run remains recoverable from history even if this final
      // status read is interrupted.
    }
  }

  async function run(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setRunning(true);
    setError("");
    setMessage("평가 실행을 준비하고 있습니다.");
    const form = new FormData(event.currentTarget);
    const retryOfRunId = form.get("retryOfRunId");
    const retrySelected = form.get("retrySelected") === "on";
    const price = Number(form.get("proposedSalePriceKrw"));
    try {
      const csrfResponse = await fetch("/api/admin/auth/csrf?purpose=item-selection-create", {
        cache: "no-store",
      });
      if (!csrfResponse.ok) throw new Error(await parseError(csrfResponse));
      const csrf = (await csrfResponse.json()) as Readonly<{ token: string }>;
      const response = await fetch("/api/admin/item-selection/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          "X-GonggamLine-CSRF": csrf.token,
        },
        body: JSON.stringify({
          provider: "domeggook",
          keyword: String(form.get("keyword")),
          size: Number(form.get("size")),
          ...(price > 0 ? { proposedSalePriceKrw: price } : {}),
          marketIntelligenceMode: "ENRICH",
          ...(retrySelected && typeof retryOfRunId === "string" && retryOfRunId
            ? { retryOfRunId }
            : {}),
        }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      const body = (await response.json()) as Readonly<{ data: ItemSelectionRunDtoV1 }>;
      setMessage(body.data.status === "RUNNING"
        ? `실행을 접수했습니다: ${body.data.keyword} 평가를 처리 중입니다.`
        : `${STATUS_LABELS[body.data.status]}: ${body.data.keyword} 실행을 저장했습니다.`);
      setSelected(body.data);
      await loadRuns();
      if (body.data.status === "RUNNING") void pollRun(body.data.id);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : errorMessage(500));
    } finally {
      setRunning(false);
    }
  }

  async function reviewShadow(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setShadowLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const marketProductId = Number(form.get("marketProductId"));
    const providerItemNumber = String(form.get("providerItemNumber"));
    const currentVerdict = String(form.get("currentVerdict")) as ItemSelectionVerdict;
    const currentScoreValue = String(form.get("currentScore"));
    try {
      const response = await fetch("/api/admin/item-selection/shadow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketProductId,
          providerItemNumber,
          currentVerdict,
          currentScore: currentScoreValue ? Number(currentScoreValue) : null,
          profitabilityStatus: "NOT_EVALUATED",
          contributionMarginRate: null,
          rightsStatus: "UNKNOWN",
        }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      const body = (await response.json()) as Readonly<{ data: ShadowReviewPacket }>;
      setShadowPacket(body.data);
    } catch (caught) {
      setShadowPacket(null);
      setError(caught instanceof Error ? caught.message : errorMessage(500));
    } finally {
      setShadowLoading(false);
    }
  }

  const visibleRuns = useMemo(
    () => statusFilter === "ALL" ? runs : runs.filter((item) => item.status === statusFilter),
    [runs, statusFilter],
  );
  const evaluations = useMemo(
    () => [...(selected?.evaluations.filter((item) => verdictFilter === "ALL" || item.verdict === verdictFilter) ?? [])]
      .sort((left, right) =>
        (right.explainability?.score.availableDataScore ?? -1) -
          (left.explainability?.score.availableDataScore ?? -1) ||
        left.originalPosition - right.originalPosition ||
        left.providerItemNumber.localeCompare(right.providerItemNumber),
      ),
    [selected, verdictFilter],
  );
  const summary = useMemo(() => ({
    total: runs.length,
    completed: runs.filter((item) => item.status === "COMPLETED").length,
    partial: runs.filter((item) => item.status === "PARTIAL").length,
    failed: runs.filter((item) => item.status === "FAILED" && item.failureCode !== "STALE_RUN_RECOVERED").length,
    recovered: runs.filter((item) => item.failureCode === "STALE_RUN_RECOVERED").length,
  }), [runs]);

  return (
    <DashboardLayout className="item-selection-admin">
      <DashboardHeader
        eyebrow="ADMIN · SUPPLIER SCREENING"
        title="상품 선정 평가"
        titleId="item-selection-title"
        description="도매꾹 공급처 후보의 시장·수익성·권리 근거를 평가하고 변경 불가능한 실행 이력을 검토합니다. 시장 전체 후보 발굴과 공급처 견적 비교는 별도 화면에서 이어집니다."
      />
      <DashboardContent>
        <DashboardSection headingId="new-run" title="새 평가 실행" description="키워드별 최대 30개 후보만 조회합니다.">
          <form className="item-selection-admin__form" onSubmit={run}>
            <input type="hidden" name="retryOfRunId" value={selected?.status === "FAILED" || selected?.status === "PARTIAL" ? selected.id : ""} />
            <label>검색어<input name="keyword" value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} required minLength={2} maxLength={100} disabled={running} /></label>
            <label>후보 수<select name="size" defaultValue="10" disabled={running}><option value="10">10개</option><option value="20">20개</option><option value="30">30개</option></select></label>
            <label>제안 판매가 (선택)<input name="proposedSalePriceKrw" type="number" min="1" step="1" inputMode="numeric" disabled={running} /></label>
            <button type="submit" disabled={running}>{running ? "실행 중…" : "평가 실행"}</button>
            {(selected?.status === "FAILED" || selected?.status === "PARTIAL") ? <label className="item-selection-admin__retry"><input name="retrySelected" type="checkbox" disabled={running} />선택한 ‘{selected.keyword}’ 실행의 명시적 재시도로 연결</label> : null}
          </form>
          {keywordSuggestions.length > 0 ? <div className="item-selection-admin__keyword-suggestions" aria-label="시장 키워드 추천">
            <strong>시장 데이터 기반 추천 검색어</strong>
            <div>{keywordSuggestions.map((suggestion) => <button key={suggestion.id} type="button" onClick={() => setKeywordDraft(suggestion.keyword)} disabled={running}>
              <span>{suggestion.keyword}</span><small>{suggestion.opportunity_score !== null ? `기회 ${suggestion.opportunity_score}` : suggestion.demand_score !== null ? `수요 ${suggestion.demand_score}` : `우선순위 ${suggestion.priority}`}</small>
            </button>)}</div>
            <small>추천어를 선택해 입력을 채운 뒤 평가를 실행합니다. 운영 순위나 추천 판정은 자동 변경되지 않습니다.</small>
          </div> : null}
          <p className="item-selection-admin__notice">공개 상품·가격·재고·검색 순서만으로도 모든 검색 후보에 기회 점수와 순위를 부여합니다. 권리·완전 수익성 확인은 실제 구매·등록 전에 별도로 진행됩니다. <Link href="/discovery">시장 후보 발굴</Link> · <Link href="/sourcing">공급처·견적 비교</Link></p>
          <div className="item-selection-admin__live" role="status" aria-live="polite">{message}</div>
        </DashboardSection>

        {error ? <DashboardErrorState title="요청을 완료하지 못했습니다" description={error} action={<button onClick={() => void loadRuns()}>이력 다시 불러오기</button>} /> : null}

        <DashboardSection headingId="run-history" title="실행 이력" description="현재 불러온 최근 20개 실행 기준 요약입니다.">
          <div className="item-selection-admin__summary" aria-label="실행 요약">
            {Object.entries(summary).map(([key, value]) => <DashboardCard key={key}><strong>{value}</strong><span>{{ total: "전체", completed: "완료", partial: "일부 완료", failed: "실패", recovered: "복구 종결" }[key as keyof typeof summary]}</span></DashboardCard>)}
          </div>
          <DashboardToolbar label="실행 이력 필터">
            <label>상태<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="ALL">전체</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button type="button" onClick={() => void loadRuns()} disabled={loading}>새로고침</button>
          </DashboardToolbar>
          {loading ? <DashboardLoading label="실행 이력을 불러오는 중" rows={4} /> : visibleRuns.length === 0 ? <DashboardEmptyState title="표시할 실행 이력이 없습니다" description="필터를 바꾸거나 첫 평가를 실행해 주세요." /> : (
            <div className="item-selection-admin__history">
              {visibleRuns.map((item) => (
                <button className="item-selection-admin__run" type="button" key={item.id} onClick={() => void openDetail(item.id)} aria-pressed={selected?.id === item.id}>
                  <span><strong>{item.keyword}</strong><small>{item.provider} · {item.requestedSize}개 요청</small></span>
                  <span className={`item-selection-admin__badge item-selection-admin__badge--${item.status.toLowerCase()}`}>{runStatusLabel(item)}</span>
                  <time dateTime={item.startedAt}>{formatDate(item.startedAt)}</time>
                  <span>{item.successfullyEvaluatedCount}/{item.observedCandidateCount} 평가</span>
                </button>
              ))}
              {nextCursor ? <button type="button" className="item-selection-admin__more" onClick={() => void loadRuns(nextCursor)}>이전 이력 20개 보기</button> : null}
            </div>
          )}
        </DashboardSection>

        <DashboardSection headingId="run-detail" title="실행 상세" description="저장된 평가 결과는 최대 30개까지 표시됩니다.">
          {detailLoading ? <DashboardLoading label="실행 상세를 불러오는 중" rows={5} /> : !selected ? <DashboardEmptyState title="실행을 선택해 주세요" description="이력에서 실행을 선택하면 상세 결과를 확인할 수 있습니다." /> : (
            <div className="item-selection-admin__detail">
              <dl className="item-selection-admin__facts">
                <div><dt>검색어</dt><dd>{selected.keyword}</dd></div><div><dt>상태</dt><dd>{runStatusLabel(selected)}</dd></div>
                <div><dt>시작</dt><dd>{formatDate(selected.startedAt)}</dd></div><div><dt>완료</dt><dd>{formatDate(selected.completedAt)}</dd></div>
                <div><dt>관찰 / 성공 / 실패 / 제외</dt><dd>{selected.observedCandidateCount} / {selected.successfullyEvaluatedCount} / {selected.failedCandidateCount} / {selected.skippedCandidateCount}</dd></div>
                <div><dt>실패 사유</dt><dd>{failureCodeLabel(selected.failureCode)}</dd></div>
              </dl>
              {(selected.status === "FAILED" || selected.status === "PARTIAL") ? <p className="item-selection-admin__notice">이 실행을 재시도하려면 위 폼에 동일 조건을 입력하고 ‘명시적 재시도’ 항목을 선택하세요.</p> : null}
              <DashboardToolbar label="평가 결과 필터"><label>판정<select value={verdictFilter} onChange={(event) => setVerdictFilter(event.target.value as typeof verdictFilter)}><option value="ALL">전체</option>{Object.entries(VERDICT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></DashboardToolbar>
              {evaluations.length === 0 ? <DashboardEmptyState title="표시할 평가 결과가 없습니다" description="빈 결과이거나 선택한 판정 필터에 일치하는 항목이 없습니다." /> : <div className="item-selection-admin__evaluations">{evaluations.map((item, rank) => (
                <DashboardCard key={item.evaluationId} title={`기회 순위 #${rank + 1} · ${item.explainability?.provider.name ?? item.providerItemNumber}`} headingId={`evaluation-${item.evaluationId}`} actions={<span className={`item-selection-admin__badge item-selection-admin__badge--${item.verdict.toLowerCase()}`}>{VERDICT_LABELS[item.verdict]}</span>}>
                  <dl className="item-selection-admin__facts"><div><dt>기회 점수</dt><dd>{item.explainability?.score.availableDataScore === null || item.explainability?.score.availableDataScore === undefined ? "확인 필요" : `${item.explainability.score.availableDataScore}점`}</dd></div><div><dt>확정 총점</dt><dd>{item.totalScoreUnits === null ? "판매 전 검증 필요" : `${item.totalScoreUnits / 100}점`}</dd></div><div><dt>근거 범위</dt><dd>{item.coverageUnits / 10_000}%</dd></div><div><dt>기여이익</dt><dd>{item.normalizedProfitKrwMicros === null ? "판매가 입력 후 확인" : `${Math.round(Number(item.normalizedProfitKrwMicros) / 1_000_000).toLocaleString("ko-KR")}원`}</dd></div></dl>
                  {item.explainability ? <>
                    <h4>점수 근거</h4>
                    <dl className="item-selection-admin__facts">{item.explainability.score.areas.map((area) => <div key={area.area}><dt>{SCORE_AREA_LABELS[area.area] ?? area.area}</dt><dd>{area.status === "AVAILABLE" && area.normalizedScore !== null ? `${area.normalizedScore.toFixed(1)}점 · 기여 ${area.weightedContribution?.toFixed(1) ?? "—"}` : "데이터 없음"}</dd></div>)}</dl>
                    <h4>수익성·공급처 근거</h4>
                    <dl className="item-selection-admin__facts"><div><dt>상품번호 / 공급처</dt><dd>{item.providerItemNumber} / {item.explainability.provider.supplierName ?? "공개 식별 없음"}</dd></div><div><dt>공급처 검색 순서</dt><dd>{item.originalPosition + 1}번째</dd></div><div><dt>수익성 상태</dt><dd>{item.explainability.profitability.status === "INCOMPLETE" && item.explainability.profitability.discoveryEstimate?.status === "ESTIMATED" ? "사전 추정 가능" : item.explainability.profitability.status}</dd></div><div><dt>공급가</dt><dd>{item.explainability.provider.supplierPriceKrw === null ? "확인 필요" : `${item.explainability.provider.supplierPriceKrw.toLocaleString("ko-KR")}원`}</dd></div><div><dt>배송비</dt><dd>{item.explainability.provider.shippingFeeKrw === null ? "공개값 없음 · 보수 추정" : `${item.explainability.provider.shippingFeeKrw.toLocaleString("ko-KR")}원`}</dd></div><div><dt>최소수량 / 재고</dt><dd>{item.explainability.provider.minimumOrderQuantity ?? "1개 가정"} / {item.explainability.provider.stockStatus ?? "확인 필요"}</dd></div></dl>
                    {item.explainability.profitability.discoveryEstimate?.status === "ESTIMATED" ? <>
                      <h4>사전 수익성 범위</h4>
                      <dl className="item-selection-admin__facts">
                        <div><dt>손익분기 판매가</dt><dd>{item.explainability.profitability.discoveryEstimate.breakEvenSellingPriceKrw?.toLocaleString("ko-KR")}원 이상</dd></div>
                        <div><dt>조건부 판매가 하한</dt><dd>{item.explainability.profitability.discoveryEstimate.conditionalSellingPriceKrw?.toLocaleString("ko-KR")}원</dd></div>
                        <div><dt>추천 판매가 하한</dt><dd>{item.explainability.profitability.discoveryEstimate.recommendSellingPriceKrw?.toLocaleString("ko-KR")}원</dd></div>
                        <div><dt>배송비 안분 / 개</dt><dd>{item.explainability.profitability.discoveryEstimate.supplierInboundPerUnitKrw?.toLocaleString("ko-KR")}원</dd></div>
                        <div><dt>검수·입고 추정 / 개</dt><dd>{item.explainability.profitability.discoveryEstimate.inboundInspectionPerUnitKrw?.toLocaleString("ko-KR")}원</dd></div>
                        <div><dt>3PL 추정 / 개</dt><dd>{item.explainability.profitability.discoveryEstimate.fulfillmentPerUnitKrw?.toLocaleString("ko-KR")}원</dd></div>
                      </dl>
                      <p className="item-selection-admin__notice">공개 조달비와 승인된 보수적 비용 가정으로 계산한 탐색용 범위입니다. 실제 판매가·규격·카테고리 수수료·견적을 확인하면 다시 계산됩니다.</p>
                    </> : null}
                    <h4>필수 게이트</h4>
                    <ul>{item.explainability.hardGates.map((gate) => <li key={gate.gate}>{gate.gate}: {GATE_STATUS_LABELS[gate.status] ?? gate.status} ({gate.reasonCode})</li>)}</ul>
                    {item.explainability.missingFacts.length > 0 ? <p className="item-selection-admin__notice">남은 근거: {item.explainability.missingFacts.join(", ")}</p> : null}
                    {item.explainability.provider.productUrl ? <p><a href={item.explainability.provider.productUrl} target="_blank" rel="noreferrer">공급처 상품 원문 열기</a></p> : null}
                  </> : <p className="item-selection-admin__notice">상세 근거를 사용할 수 없는 이전 실행입니다.</p>}
                  <details><summary>감사 식별자</summary><code>snapshot {item.snapshotSha256}</code><code>evidence {item.providerEvidenceSha256}</code></details>
                </DashboardCard>
              ))}</div>}
            </div>
          )}
        </DashboardSection>

        <DashboardSection headingId="shadow-review" title="시장정보 Shadow 비교" description="정확한 시장 근거를 기존 판정과 비교합니다. 운영 판정은 변경되지 않습니다.">
          <form className="item-selection-admin__form" onSubmit={reviewShadow}>
            <label>시장 상품 ID<input name="marketProductId" type="number" min="1" required disabled={shadowLoading} /></label>
            <label>공급처 상품번호<input name="providerItemNumber" inputMode="numeric" pattern="[0-9]{1,20}" required disabled={shadowLoading} /></label>
            <label>현재 판정<select name="currentVerdict" defaultValue="MANUAL_REVIEW" disabled={shadowLoading}>{Object.entries(VERDICT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>현재 점수<input name="currentScore" type="number" step="0.01" disabled={shadowLoading} /></label>
            <button type="submit" disabled={shadowLoading}>{shadowLoading ? "비교 중…" : "Shadow 비교"}</button>
          </form>
          <p className="item-selection-admin__notice">이 화면은 관리자 검토용입니다. 수익성·권리 정보를 확인하지 않은 요청은 우선순위를 확정하지 않습니다.</p>
          {shadowPacket ? <DashboardCard title="Shadow 결과" headingId="shadow-result">
            <dl className="item-selection-admin__facts">
              <div><dt>상품번호</dt><dd>{shadowPacket.providerItemNumber}</dd></div>
              <div><dt>시장 판정</dt><dd>{shadowPacket.shadow.decision}</dd></div>
              <div><dt>적격성</dt><dd>{shadowPacket.shadow.eligibility}</dd></div>
              <div><dt>신뢰 보정 점수</dt><dd>{shadowPacket.shadow.confidenceAdjustedScore ?? "확인 필요"}</dd></div>
              <div><dt>운영 판정 변경</dt><dd>{shadowPacket.operationalVerdictChanged ? "변경됨" : "변경 없음"}</dd></div>
              <div><dt>수동 검토</dt><dd>{shadowPacket.requiresManualReview ? "필요" : "불필요"}</dd></div>
            </dl>
            {shadowPacket.shadow.missingFacts.length > 0 ? <p className="item-selection-admin__notice">남은 근거: {shadowPacket.shadow.missingFacts.join(", ")}</p> : null}
          </DashboardCard> : null}
        </DashboardSection>
      </DashboardContent>
    </DashboardLayout>
  );
}
