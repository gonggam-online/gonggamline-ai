"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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

const STATUS_LABELS: Record<ItemSelectionRunStatus, string> = {
  RUNNING: "실행 중",
  COMPLETED: "완료",
  PARTIAL: "일부 완료",
  FAILED: "실패",
};
const VERDICT_LABELS: Record<ItemSelectionVerdict, string> = {
  RECOMMEND: "추천",
  CONDITIONAL: "조건부",
  MANUAL_REVIEW: "수동 확인",
  REJECT: "제외",
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
  if (status === 403) return "실행에는 최근 MFA 인증이 필요합니다.";
  if (status === 429) return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (code === "PROVIDER_UNAVAILABLE") return "공급처를 일시적으로 사용할 수 없습니다.";
  if (code === "DUPLICATE_RUN_ACTIVE") return "동일한 조건의 실행이 이미 진행 중입니다.";
  if (status === 404) return "선택한 실행 이력을 찾을 수 없습니다.";
  return "요청을 완료하지 못했습니다. 다시 시도해 주세요.";
}

async function parseError(response: Response): Promise<string> {
  let code: string | undefined;
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = (body as { error?: unknown }).error;
      if (typeof error === "object" && error !== null && "code" in error &&
          typeof (error as { code?: unknown }).code === "string") {
        code = (error as { code: string }).code;
      }
    }
  } catch {
    // The UI deliberately exposes only stable, sanitized messages.
  }
  return errorMessage(response.status, code);
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
          "X-CSRF-Token": csrf.token,
        },
        body: JSON.stringify({
          provider: "domeggook",
          keyword: String(form.get("keyword")),
          size: Number(form.get("size")),
          ...(price > 0 ? { proposedSalePriceKrw: price } : {}),
          ...(retrySelected && typeof retryOfRunId === "string" && retryOfRunId
            ? { retryOfRunId }
            : {}),
        }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      const body = (await response.json()) as Readonly<{ data: ItemSelectionRunDtoV1 }>;
      setMessage(`${STATUS_LABELS[body.data.status]}: ${body.data.keyword} 실행을 저장했습니다.`);
      setSelected(body.data);
      await loadRuns();
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : errorMessage(500));
    } finally {
      setRunning(false);
    }
  }

  const visibleRuns = useMemo(
    () => statusFilter === "ALL" ? runs : runs.filter((item) => item.status === statusFilter),
    [runs, statusFilter],
  );
  const evaluations = useMemo(
    () => selected?.evaluations.filter((item) => verdictFilter === "ALL" || item.verdict === verdictFilter) ?? [],
    [selected, verdictFilter],
  );
  const summary = useMemo(() => ({
    total: runs.length,
    completed: runs.filter((item) => item.status === "COMPLETED").length,
    partial: runs.filter((item) => item.status === "PARTIAL").length,
    failed: runs.filter((item) => item.status === "FAILED").length,
  }), [runs]);

  return (
    <DashboardLayout className="item-selection-admin">
      <DashboardHeader
        eyebrow="ADMIN · SUPPLIER SCREENING"
        title="상품 선정 평가"
        titleId="item-selection-title"
        description="공급처 후보를 제한된 범위에서 평가하고 변경 불가능한 실행 이력을 검토합니다. 상품 생성이나 마켓플레이스 등록은 수행하지 않습니다."
      />
      <DashboardContent>
        <DashboardSection headingId="new-run" title="새 평가 실행" description="키워드별 최대 30개 후보만 조회합니다.">
          <form className="item-selection-admin__form" onSubmit={run}>
            <input type="hidden" name="retryOfRunId" value={selected?.status === "FAILED" || selected?.status === "PARTIAL" ? selected.id : ""} />
            <label>검색어<input name="keyword" required minLength={2} maxLength={100} disabled={running} /></label>
            <label>후보 수<select name="size" defaultValue="10" disabled={running}><option value="10">10개</option><option value="20">20개</option><option value="30">30개</option></select></label>
            <label>제안 판매가 (선택)<input name="proposedSalePriceKrw" type="number" min="1" step="1" inputMode="numeric" disabled={running} /></label>
            <button type="submit" disabled={running}>{running ? "실행 중…" : "평가 실행"}</button>
            {(selected?.status === "FAILED" || selected?.status === "PARTIAL") ? <label className="item-selection-admin__retry"><input name="retrySelected" type="checkbox" disabled={running} />선택한 ‘{selected.keyword}’ 실행의 명시적 재시도로 연결</label> : null}
          </form>
          <p className="item-selection-admin__notice">권리·비용 근거가 부족한 항목은 통과로 추정하지 않고 ‘수동 확인’으로 남습니다.</p>
          <div className="item-selection-admin__live" role="status" aria-live="polite">{message}</div>
        </DashboardSection>

        {error ? <DashboardErrorState title="요청을 완료하지 못했습니다" description={error} action={<button onClick={() => void loadRuns()}>이력 다시 불러오기</button>} /> : null}

        <DashboardSection headingId="run-history" title="실행 이력" description="현재 불러온 최근 20개 실행 기준 요약입니다.">
          <div className="item-selection-admin__summary" aria-label="실행 요약">
            {Object.entries(summary).map(([key, value]) => <DashboardCard key={key}><strong>{value}</strong><span>{{ total: "전체", completed: "완료", partial: "일부 완료", failed: "실패" }[key as keyof typeof summary]}</span></DashboardCard>)}
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
                  <span className={`item-selection-admin__badge item-selection-admin__badge--${item.status.toLowerCase()}`}>{STATUS_LABELS[item.status]}</span>
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
                <div><dt>검색어</dt><dd>{selected.keyword}</dd></div><div><dt>상태</dt><dd>{STATUS_LABELS[selected.status]}</dd></div>
                <div><dt>시작</dt><dd>{formatDate(selected.startedAt)}</dd></div><div><dt>완료</dt><dd>{formatDate(selected.completedAt)}</dd></div>
                <div><dt>관찰 / 성공 / 실패 / 제외</dt><dd>{selected.observedCandidateCount} / {selected.successfullyEvaluatedCount} / {selected.failedCandidateCount} / {selected.skippedCandidateCount}</dd></div>
                <div><dt>실패 코드</dt><dd>{selected.failureCode ?? "없음"}</dd></div>
              </dl>
              {(selected.status === "FAILED" || selected.status === "PARTIAL") ? <p className="item-selection-admin__notice">이 실행을 재시도하려면 위 폼에 동일 조건을 입력하고 ‘명시적 재시도’ 항목을 선택하세요.</p> : null}
              <DashboardToolbar label="평가 결과 필터"><label>판정<select value={verdictFilter} onChange={(event) => setVerdictFilter(event.target.value as typeof verdictFilter)}><option value="ALL">전체</option>{Object.entries(VERDICT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></DashboardToolbar>
              {evaluations.length === 0 ? <DashboardEmptyState title="표시할 평가 결과가 없습니다" description="빈 결과이거나 선택한 판정 필터에 일치하는 항목이 없습니다." /> : <div className="item-selection-admin__evaluations">{evaluations.map((item) => (
                <DashboardCard key={item.evaluationId} title={`후보 #${item.originalPosition + 1} · ${item.providerItemNumber}`} headingId={`evaluation-${item.evaluationId}`} actions={<span className={`item-selection-admin__badge item-selection-admin__badge--${item.verdict.toLowerCase()}`}>{VERDICT_LABELS[item.verdict]}</span>}>
                  <dl className="item-selection-admin__facts"><div><dt>총점</dt><dd>{item.totalScoreUnits === null ? "확인 필요" : `${item.totalScoreUnits / 100}점`}</dd></div><div><dt>근거 범위</dt><dd>{item.coverageUnits / 100}%</dd></div><div><dt>기여이익</dt><dd>{item.normalizedProfitKrwMicros === null ? "확인 필요" : `${Math.round(Number(item.normalizedProfitKrwMicros) / 1_000_000).toLocaleString("ko-KR")}원`}</dd></div><div><dt>마진율</dt><dd>{item.normalizedMarginUnits === null ? "확인 필요" : `${item.normalizedMarginUnits / 100}%`}</dd></div></dl>
                  <details><summary>감사 식별자</summary><code>snapshot {item.snapshotSha256}</code><code>evidence {item.providerEvidenceSha256}</code></details>
                </DashboardCard>
              ))}</div>}
            </div>
          )}
        </DashboardSection>
      </DashboardContent>
    </DashboardLayout>
  );
}
