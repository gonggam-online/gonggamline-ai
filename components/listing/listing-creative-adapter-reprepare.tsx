"use client";

import { useState } from "react";

import { LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION, type ListingCreativeAdapterReprepareResult } from "@/shared/contracts/listing-creative-adapter-reprepare";

type ApiResponse = Readonly<{ data?: ListingCreativeAdapterReprepareResult; error?: Readonly<{ code: string }> }>;

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm";

async function csrf(): Promise<string> {
  const response = await fetch("/api/admin/auth/csrf?purpose=listing-creative-adapter-export", { credentials: "same-origin", cache: "no-store" });
  const body = await response.json() as Readonly<{ token?: string }>;
  if (!response.ok || !body.token) throw new Error("CSRF_UNAVAILABLE");
  return body.token;
}

export function ListingCreativeAdapterReprepare() {
  const [packetJson, setPacketJson] = useState("");
  const [revision, setRevision] = useState({ packetId: "", evaluationId: "", evaluatedAt: "", sourceReference: "", reason: "CURRENT_WING_REVIEW", contentApprovalReference: "", liveWriteApprovalReference: "" });
  const [result, setResult] = useState<ListingCreativeAdapterReprepareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    setResult(null);
    setCopyStatus(null);
    try {
      const token = await csrf();
      const response = await fetch("/api/admin/listing/creative-adapter/reprepare", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-GonggamLine-CSRF": token },
        body: JSON.stringify({
          schemaVersion: LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION,
          revision: { ...revision, liveWriteApprovalReference: revision.liveWriteApprovalReference || null },
          packet: JSON.parse(packetJson) as unknown,
        }),
      });
      const body = await response.json() as ApiResponse;
      if (!response.ok || !body.data) throw new Error(body.error?.code ?? "ADAPTER_REPREPARE_FAILED");
      setResult(body.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ADAPTER_REPREPARE_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function copyPacket(): Promise<void> {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result.packet, null, 2));
    setCopyStatus("새 revision packet을 클립보드에 복사했습니다.");
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-slate-950">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-indigo-700">Owner-controlled adapter</p>
        <h1 className="text-3xl font-bold">새 external adapter packet revision</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          이전 JSON export를 찾지 않고, 현재 WING에서 다시 확인한 listingInput과 owner 승인 commerce 값을 새 immutable revision으로 묶습니다. 이 화면은 저장하거나 WING에 제출하지 않습니다.
        </p>
      </header>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        배송지 코드, 반품센터 코드, 연락처, live-write approval은 추정하지 마세요. 새 WING 관찰값과 별도 승인 참조를 정확히 입력해야 하며, 내용 승인은 live-write 승인을 대신하지 않습니다.
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">1. Revision binding</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className="text-sm">새 packet ID<input className={inputClass} value={revision.packetId} onChange={(e) => setRevision({ ...revision, packetId: e.target.value })} /></label>
          <label className="text-sm">새 evaluation ID<input className={inputClass} value={revision.evaluationId} onChange={(e) => setRevision({ ...revision, evaluationId: e.target.value })} /></label>
          <label className="text-sm">WING 관찰 시각 (ISO 8601)<input className={inputClass} value={revision.evaluatedAt} onChange={(e) => setRevision({ ...revision, evaluatedAt: e.target.value })} /></label>
          <label className="text-sm">WING/adapter source reference<input className={inputClass} value={revision.sourceReference} onChange={(e) => setRevision({ ...revision, sourceReference: e.target.value })} /></label>
          <label className="text-sm">생성 사유<select className={inputClass} value={revision.reason} onChange={(e) => setRevision({ ...revision, reason: e.target.value })}><option value="CURRENT_WING_REVIEW">현재 WING 재검토</option><option value="SOURCE_REFRESH">source refresh</option><option value="EXPIRED_PACKET_REPLACEMENT">만료 packet 교체</option></select></label>
          <label className="text-sm">content approval reference<input className={inputClass} value={revision.contentApprovalReference} onChange={(e) => setRevision({ ...revision, contentApprovalReference: e.target.value })} /></label>
          <label className="text-sm md:col-span-2">별도 live-write approval reference (없으면 비워 둠)<input className={inputClass} value={revision.liveWriteApprovalReference} onChange={(e) => setRevision({ ...revision, liveWriteApprovalReference: e.target.value })} /></label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">2. Current WING adapter packet</h2>
        <p className="mt-1 text-sm text-slate-600">여기에는 새로 확인한 <code>{"{listingInput, commerce}"}</code> 객체만 입력합니다. 예전 export를 복구할 필요는 없습니다.</p>
        <textarea aria-label="New WING adapter packet JSON" className="mt-3 min-h-80 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs" value={packetJson} onChange={(e) => setPacketJson(e.target.value)} spellCheck={false} placeholder={'{"listingInput": {...}, "commerce": {...}}'} />
        <button className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || packetJson.trim().length === 0} onClick={() => void submit()} type="button">{busy ? "새 revision 검증 중…" : "새 revision 생성·검증"}</button>
      </section>

      {result ? <section className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5"><h2 className="text-lg font-semibold">3. 새 revision 결과</h2><dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-slate-500">status</dt><dd className="font-semibold">{result.readiness.status}</dd></div><div><dt className="text-slate-500">BLOCKER / WARNING</dt><dd>{result.readiness.blockerCount} / {result.readiness.warningCount}</dd></div><div><dt className="text-slate-500">packet digest</dt><dd className="break-all font-mono text-xs">{result.readiness.packetDigest}</dd></div><div><dt className="text-slate-500">revision digest</dt><dd className="break-all font-mono text-xs">{result.revisionDigest}</dd></div></dl><button className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => void copyPacket()} type="button">Production 입력용 packet 복사</button>{copyStatus ? <p className="text-xs" role="status">{copyStatus}</p> : null}</section> : null}
      {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
    </main>
  );
}
