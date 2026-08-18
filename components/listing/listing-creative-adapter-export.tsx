"use client";

import { useState } from "react";

import {
  LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION,
  type ListingCreativeAdapterExportDto,
} from "@/shared/contracts/listing-creative-adapter-export";

type ApiResponse = Readonly<{
  data?: ListingCreativeAdapterExportDto;
  sanitizedReview?: ListingCreativeAdapterExportDto;
  error?: Readonly<{ code: string }>;
}>;

async function csrf(): Promise<string> {
  const response = await fetch("/api/admin/auth/csrf?purpose=listing-creative-adapter-export", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json() as Readonly<{ token?: string }>;
  if (!response.ok || !body.token) throw new Error("CSRF_UNAVAILABLE");
  return body.token;
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ListingCreativeAdapterExport() {
  const [input, setInput] = useState("");
  const [full, setFull] = useState<ListingCreativeAdapterExportDto | null>(null);
  const [sanitized, setSanitized] = useState<ListingCreativeAdapterExportDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function runExport(): Promise<void> {
    setBusy(true);
    setErrorCode(null);
    setCopyStatus(null);
    setFull(null);
    setSanitized(null);
    try {
      const parsed: unknown = JSON.parse(input);
      const token = await csrf();
      const response = await fetch("/api/admin/listing/creative-adapter/export", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-GonggamLine-CSRF": token },
        body: JSON.stringify({
          schemaVersion: LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION,
          packet: parsed,
        }),
      });
      const body = await response.json() as ApiResponse;
      if (!response.ok || !body.data || !body.sanitizedReview) throw new Error(body.error?.code ?? "ADAPTER_EXPORT_FAILED");
      setFull(body.data);
      setSanitized(body.sanitizedReview);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "ADAPTER_EXPORT_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function copyFullPacket(): Promise<void> {
    if (!full) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(full.packet, null, 2));
      setCopyStatus("전체 packet을 클립보드에 복사했습니다.");
    } catch {
      setCopyStatus("클립보드 접근이 차단되었습니다. JSON 다운로드를 사용하세요.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 text-slate-950">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-indigo-700">Owner-controlled adapter</p>
        <h1 className="text-3xl font-bold">External adapter packet Export</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          WING에서 승인된 값을 외부 adapter가 만든 typed packet으로 검증하고, Production 입력에 필요한 전체 JSON을 복사하거나 파일로 내려받는 화면입니다.
          검증이 통과한 packet은 digest에 결속된 Supabase private 저장소에 암호화된 접근 경계로 저장되어, 작업이 중단되어도 digest로 복구할 수 있습니다.
        </p>
        <p className="text-sm text-indigo-800">
          이전 export를 찾을 수 없으면 <a className="font-semibold underline" href="/admin/listing/creative-adapter/reprepare">저장된 packet 복구 또는 현재 WING 값으로 새 revision 생성</a>을 사용하세요.
        </p>
      </header>

      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
        전체 export에는 배송지 코드·연락처·주소 같은 private 값이 포함될 수 있습니다. Git, 채팅, 로그에 붙여넣지 말고 승인된 Production 입력 경계에서만 사용하세요.
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">1. External adapter input</h2>
        <textarea
          aria-label="Owner external adapter packet JSON"
          className="mt-3 min-h-72 w-full rounded-xl border border-slate-300 p-3 font-mono text-xs"
          onChange={(event) => setInput(event.target.value)}
          placeholder={'{"listingInput": {...}, "commerce": {...}}'}
          spellCheck={false}
          value={input}
        />
        <button
          className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy || input.trim().length === 0}
          onClick={() => void runExport()}
          type="button"
        >
          {busy ? "검증 중..." : "검증하고 Export 준비"}
        </button>
      </section>

      {full ? (
        <section className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold">2. Export 준비 완료</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-slate-500">상품</dt><dd>{full.readiness.subjectId}</dd></div>
            <div><dt className="text-slate-500">등록 적합성</dt><dd>{full.readiness.status}</dd></div>
            <div><dt className="text-slate-500">BLOCKER / WARNING</dt><dd>{full.readiness.blockerCount} / {full.readiness.warningCount}</dd></div>
            <div><dt className="text-slate-500">packet digest</dt><dd className="break-all font-mono text-xs">{full.readiness.packetDigest}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => void copyFullPacket()} type="button">
              Production 입력용 전체 packet 복사
            </button>
            <button className="rounded-lg border border-indigo-700 px-4 py-2 text-sm font-semibold text-indigo-900" onClick={() => downloadJson(`${full.readiness.packetId}.json`, full.packet)} type="button">
              전체 packet JSON 다운로드
            </button>
            {sanitized ? (
              <button className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-900" onClick={() => downloadJson(`${full.readiness.packetId}.sanitized.json`, sanitized.packet)} type="button">
                민감정보 제거본 다운로드
              </button>
            ) : null}
          </div>
          {copyStatus ? <p className="text-xs text-slate-700" role="status">{copyStatus}</p> : null}
          <p className="text-xs text-slate-700">전체 packet을 복사한 뒤 Production Listing Creative Operator의 External adapter packet 입력란에 붙여넣으세요.</p>
        </section>
      ) : null}

      {errorCode ? <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{errorCode}</p> : null}
    </main>
  );
}
