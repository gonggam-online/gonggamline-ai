"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  LISTING_CREATIVE_OPERATOR_API_VERSION,
  type ListingCreativeDispatchPreparedDto,
} from "@/shared/contracts/listing-creative-operator-dispatch";
import type { ListingCreativeOperatorReviewDto } from "@/shared/domain/listing-creative-operator";
import type { AdminSessionStatusDto } from "@/shared/contracts/admin-session-status";

type ApiEnvelope<T> = Readonly<{
  data?: T;
  error?: Readonly<{ code: string; status?: string }>;
}>;

async function csrf(purpose: string): Promise<string> {
  const response = await fetch(`/api/admin/auth/csrf?purpose=${encodeURIComponent(purpose)}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json() as Readonly<{ token?: string }>;
  if (!response.ok || !body.token) throw new Error("CSRF_UNAVAILABLE");
  return body.token;
}

export function ListingCreativeOperator() {
  const [adapterJson, setAdapterJson] = useState("");
  const [prepared, setPrepared] = useState<ListingCreativeDispatchPreparedDto | null>(null);
  const [review, setReview] = useState<ListingCreativeOperatorReviewDto | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [recoveryReference, setRecoveryReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [preflightStatus, setPreflightStatus] = useState<string | null>(null);
  const [reprepareAvailable, setReprepareAvailable] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<AdminSessionStatusDto | null>(null);
  const [trustedBrowser, setTrustedBrowser] = useState(false);

  async function refreshSessionStatus(): Promise<void> {
    const response = await fetch("/api/admin/auth/session-status", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      setSessionStatus(null);
      return;
    }
    const status = await response.json() as AdminSessionStatusDto;
    setSessionStatus(status);
    setTrustedBrowser(status.trustedBrowserPreference);
  }

  useEffect(() => {
    void refreshSessionStatus();
    const interval = window.setInterval(() => void refreshSessionStatus(), 20_000);
    return () => window.clearInterval(interval);
  }, []);

  async function updateTrustedBrowser(enabled: boolean): Promise<void> {
    setTrustedBrowser(enabled);
    try {
      const token = await csrf("admin-session");
      const response = await fetch("/api/admin/auth/trusted-browser-preference", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-GonggamLine-CSRF": token },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error("TRUSTED_BROWSER_PREFERENCE_FAILED");
      await refreshSessionStatus();
    } catch (error) {
      setTrustedBrowser(!enabled);
      setErrorCode(error instanceof Error ? error.message : "TRUSTED_BROWSER_PREFERENCE_FAILED");
    }
  }

  async function prepare(reprepareExpiredPlanReference?: string) {
    setBusy(true);
    setErrorCode(null);
    try {
      const parsed = JSON.parse(adapterJson) as Readonly<Record<string, unknown>>;
      const token = await csrf("listing-creative-dispatch-prepare");
      const response = await fetch("/api/admin/listing/creative-dispatch/prepare", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-GonggamLine-CSRF": token,
        },
        body: JSON.stringify({
          schemaVersion: LISTING_CREATIVE_OPERATOR_API_VERSION,
          listingInput: parsed.listingInput,
          commerce: parsed.commerce,
          ...(reprepareExpiredPlanReference === undefined
            ? {}
            : { reprepareExpiredPlanReference }),
        }),
      });
      const body = await response.json() as ApiEnvelope<ListingCreativeDispatchPreparedDto>;
      if (!response.ok || !body.data) {
        if (body.error?.status) setPreflightStatus(body.error.status);
        throw new Error(body.error?.code ?? "PREPARE_FAILED");
      }
      setPreflightStatus("READY");
      setPrepared(body.data);
      setRecoveryReference(body.data.preparedPlanReference);
      setReview(null);
      setReprepareAvailable(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : "PREPARE_FAILED";
      setErrorCode(code);
      setReprepareAvailable(code === "DISPATCH_ALREADY_RESERVED");
    } finally {
      setBusy(false);
    }
  }

  async function runPreflight() {
    setBusy(true);
    setErrorCode(null);
    try {
      const response = await fetch("/api/admin/listing/creative-dispatch/preflight", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await response.json() as ApiEnvelope<Readonly<{
        status: string;
        providerId: string;
        modelVersion: string;
        paidCallAttempted: false;
      }>>;
      if (!body.data) throw new Error(body.error?.code ?? "PREFLIGHT_FAILED");
      setPreflightStatus(body.data.status);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "PREFLIGHT_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function dispatch() {
    if (!prepared || confirmation !== "AUTHORIZE_PAID_IMAGE_GENERATION") return;
    const preparedPlanReference = prepared.preparedPlanReference;
    setRecoveryReference(preparedPlanReference);
    setBusy(true);
    setErrorCode(null);
    try {
      const token = await csrf("listing-creative-dispatch");
      const response = await fetch("/api/admin/listing/creative-dispatch", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-GonggamLine-CSRF": token,
        },
        body: JSON.stringify({
          schemaVersion: LISTING_CREATIVE_OPERATOR_API_VERSION,
          preparedPlanReference: prepared.preparedPlanReference,
          confirmation,
        }),
      });
      const body = await response.json() as ApiEnvelope<ListingCreativeOperatorReviewDto>;
      if (!response.ok || !body.data) throw new Error(body.error?.code ?? "DISPATCH_FAILED");
      setReview(body.data);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "DISPATCH_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function recoverReview() {
    const reference = recoveryReference.trim();
    if (reference.length === 0) return;
    setBusy(true);
    setErrorCode(null);
    try {
      const response = await fetch(
        `/api/admin/listing/creative-dispatch?preparedPlanReference=${encodeURIComponent(reference)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const body = await response.json() as ApiEnvelope<ListingCreativeOperatorReviewDto>;
      if (!response.ok || !body.data) throw new Error(body.error?.code ?? "REVIEW_RECOVERY_FAILED");
      setReview(body.data);
      setPrepared(null);
      setReprepareAvailable(false);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "REVIEW_RECOVERY_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 text-slate-950">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-indigo-700">Listing Creative Operator</p>
        <h1 className="text-3xl font-bold">전환 이미지 생성·비공개 검토</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          PREPARE는 비용을 쓰지 않습니다. 유료 생성은 정확한 확인 문구를 입력한 뒤에만 실행되며,
          결과는 사람의 상품 일치 검토가 필요한 비공개 REVIEW_REQUIRED 상태로 멈춥니다.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">1. External adapter packet</h2>
        <p className="mt-2 text-sm text-slate-600">
          packet이 없으면 <Link className="font-semibold text-indigo-700 underline" href="/admin/listing/creative-adapter">owner adapter Export 화면</Link>에서 먼저 검증하세요.
        </p>
        <textarea
          aria-label="External adapter packet JSON"
          className="mt-3 min-h-52 w-full rounded-xl border border-slate-300 p-3 font-mono text-xs"
          onChange={(event) => setAdapterJson(event.target.value)}
          placeholder={'{"listingInput": {...}, "commerce": {...}}'}
          spellCheck={false}
          value={adapterJson}
        />
        <button
          className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy || adapterJson.trim().length === 0 || sessionStatus?.mutationReady === false}
          onClick={() => void prepare()}
          type="button"
        >
          비용 없이 PREPARE
        </button>
        <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
          <p className="font-semibold">관리자 세션 상태</p>
          <p className="mt-1">
            {sessionStatus?.status === "MFA_VERIFIED"
              ? `MFA 확인됨 · mutation 유효 ${sessionStatus.ageSeconds ?? 0}초`
              : sessionStatus?.status === "REAUTH_REQUIRED"
                ? "MFA 재인증이 필요합니다. 로그인 화면에서 TOTP를 다시 확인하세요."
                : sessionStatus?.status === "MFA_REQUIRED"
                  ? "MFA 확인 후 PREPARE와 유료 실행을 사용할 수 있습니다."
                  : "관리자 세션을 확인하는 중입니다."}
          </p>
          {sessionStatus?.expiresAt ? (
            <p className="mt-1 text-xs text-indigo-800">세션 만료 예정: {sessionStatus.expiresAt} · 만료 전 자동 갱신 시도</p>
          ) : null}
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              checked={trustedBrowser}
              onChange={(event) => void updateTrustedBrowser(event.target.checked)}
              type="checkbox"
            />
            이 브라우저에서 세션 상태 알림 유지
          </label>
          <p className="mt-1 text-[11px] text-indigo-800">
            신뢰 브라우저 설정은 알림 선호도만 저장하며, 유료 실행·WING 변경에는 항상 MFA가 필요합니다.
          </p>
        </div>
        <button
          className="mt-3 ml-3 rounded-lg border border-indigo-700 px-4 py-2 text-sm font-semibold text-indigo-900 disabled:opacity-50"
          disabled={busy}
          onClick={() => void runPreflight()}
          type="button"
        >
          Production provider preflight
        </button>
        {preflightStatus ? (
          <p className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm">
            provider preflight: <strong>{preflightStatus}</strong>
            {preflightStatus !== "READY" ? " — 계획 생성과 유료 호출이 차단됩니다." : " — 계획 생성이 허용됩니다."}
          </p>
        ) : null}
        {reprepareAvailable && prepared ? (
          <button
            className="mt-3 ml-3 rounded-lg border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
            disabled={busy}
            onClick={() => void prepare(prepared.preparedPlanReference)}
            type="button"
          >
            만료된 계획 재준비(동일 packet)
          </button>
        ) : null}
        {prepared ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-medium">PREPARED plan reference (검토 복구용)</p>
            <code className="mt-2 block break-all font-mono text-xs">{prepared.preparedPlanReference}</code>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold">Private REVIEW_REQUIRED handoff 복구</h2>
        <p className="mt-2 text-sm text-slate-600">
          브라우저 응답을 잃었거나 signed URL이 만료된 경우, 서버에 저장된 plan reference를
          입력하면 새 비공개 검토 URL만 발급합니다. 생성·승인·게시·WING 쓰기는 실행하지 않습니다.
        </p>
        <input
          aria-label="Prepared plan reference for review recovery"
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs"
          onChange={(event) => setRecoveryReference(event.target.value)}
          placeholder="v1.<subjectHash>.<revisionDigest>.<dispatchPlanDigest>"
          value={recoveryReference}
        />
        <button
          className="mt-3 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          disabled={busy || recoveryReference.trim().length === 0}
          onClick={() => void recoverReview()}
          type="button"
        >
          검토 handoff 다시 불러오기
        </button>
      </section>

      {prepared ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">2. PREPARED</h2>
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold">아직 생성 안 됨</span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-slate-500">후보</dt><dd>{prepared.candidates.length}개</dd></div>
            <div><dt className="text-slate-500">출력</dt><dd>{prepared.outputCount}개</dd></div>
            <div><dt className="text-slate-500">최대 예상 비용</dt><dd>USD {prepared.estimatedMaximumCostUsd.toFixed(2)}</dd></div>
            <div><dt className="text-slate-500">만료</dt><dd>{prepared.expiresAt}</dd></div>
          </dl>
          <label className="mt-5 block text-sm font-medium" htmlFor="dispatch-confirmation">
            유료 실행 확인 문구
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-amber-400 bg-white p-3 font-mono text-xs"
            id="dispatch-confirmation"
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="AUTHORIZE_PAID_IMAGE_GENERATION"
            value={confirmation}
          />
          <button
            className="mt-3 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy || confirmation !== "AUTHORIZE_PAID_IMAGE_GENERATION" || sessionStatus?.mutationReady === false}
            onClick={() => void dispatch()}
            type="button"
          >
            bounded fact-only 이미지 생성
          </button>
        </section>
      ) : null}

      {review ? (
        <section className="space-y-5 rounded-2xl border border-blue-300 bg-blue-50 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">3. REVIEW_REQUIRED</h2>
            <span className="rounded-full bg-blue-200 px-3 py-1 text-xs font-bold">사람 QA 미완료</span>
          </div>
          <p className="text-sm text-slate-700">
            후보 선택 없음 · 콘텐츠 승인 없음 · live-write 승인 없음 · 공개 게시 없음
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            {review.artifacts.map((artifact) => (
              <article className="rounded-xl border border-slate-200 bg-white p-4" key={artifact.artifactId}>
                <Image
                  alt={artifact.altText}
                  className="h-auto w-full rounded-lg object-contain"
                  height={artifact.height}
                  src={artifact.signedReviewUrl}
                  unoptimized
                  width={artifact.width}
                />
                <div className="mt-3 text-xs text-slate-600">
                  <p>{artifact.candidateSetId} · {artifact.role}</p>
                  <p>{artifact.width}×{artifact.height} · {artifact.mimeType}</p>
                  <p className="font-semibold text-blue-700">humanReview: REVIEW_REQUIRED</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {errorCode ? (
        <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">
          {errorCode}
        </p>
      ) : null}
    </main>
  );
}
