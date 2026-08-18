"use client";

import { useState } from "react";

import {
  LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION,
  type ListingCreativeAdapterReprepareResult,
} from "@/shared/contracts/listing-creative-adapter-reprepare";
import {
  LISTING_LIVE_WRITE_APPROVAL_API_VERSION,
  type ListingLiveWriteApprovalResponse,
} from "@/shared/contracts/listing-live-write-approval";

type ApiResponse = Readonly<{
  data?: ListingCreativeAdapterReprepareResult;
  error?: Readonly<{ code: string }>;
}>;

type ApprovalApiResponse = Readonly<{
  data?: ListingLiveWriteApprovalResponse;
  error?: Readonly<{ code: string }>;
}>;

type RevisionState = {
  packetId: string;
  evaluationId: string;
  evaluatedAt: string;
  sourceReference: string;
  reason: "CURRENT_WING_REVIEW" | "SOURCE_REFRESH" | "EXPIRED_PACKET_REPLACEMENT";
  contentApprovalReference: string;
  liveWriteApprovalReference: string;
};

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm";

async function csrf(purpose: string): Promise<string> {
  const response = await fetch(`/api/admin/auth/csrf?purpose=${encodeURIComponent(purpose)}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json() as Readonly<{ token?: string }>;
  if (!response.ok || !body.token) throw new Error("CSRF_UNAVAILABLE");
  return body.token;
}

export function ListingCreativeAdapterReprepare() {
  const [packetJson, setPacketJson] = useState("");
  const [recoveryDigest, setRecoveryDigest] = useState("");
  const [revision, setRevision] = useState<RevisionState>({
    packetId: "",
    evaluationId: "",
    evaluatedAt: "",
    sourceReference: "",
    reason: "CURRENT_WING_REVIEW",
    contentApprovalReference: "",
    liveWriteApprovalReference: "",
  });
  const [approval, setApproval] = useState<ListingLiveWriteApprovalResponse["approval"] | null>(null);
  const [result, setResult] = useState<ListingCreativeAdapterReprepareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  function setRevisionField<K extends keyof RevisionState>(key: K, value: RevisionState[K]): void {
    setRevision((current) => ({ ...current, [key]: value }));
  }

  async function issueLiveWriteApproval(): Promise<void> {
    setBusy(true);
    setError(null);
    setResult(null);
    setCopyStatus(null);
    try {
      const packet = JSON.parse(packetJson) as unknown;
      const token = await csrf("listing-live-write-approval");
      const response = await fetch("/api/admin/listing/creative-adapter/live-write-approval", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-GonggamLine-CSRF": token },
        body: JSON.stringify({
          schemaVersion: LISTING_LIVE_WRITE_APPROVAL_API_VERSION,
          confirmation: "APPROVE_WING_LIVE_WRITE",
          revision: { ...revision, liveWriteApprovalReference: null },
          packet,
        }),
      });
      const body = await response.json() as ApprovalApiResponse;
      if (!response.ok || !body.data) throw new Error(body.error?.code ?? "LIVE_WRITE_APPROVAL_FAILED");
      const issued = body.data.approval;
      const packetRecord = packet as { commerce?: { liveWriteApproval?: unknown } };
      if (!packetRecord.commerce) throw new Error("LIVE_WRITE_APPROVAL_PACKET_INVALID");
      packetRecord.commerce.liveWriteApproval = {
        approved: true,
        approvalReference: issued.approvalReference,
        payloadDigest: issued.approvalTargetDigest,
        approvalExpiresAt: issued.expiresAt,
      };
      setPacketJson(JSON.stringify(packetRecord, null, 2));
      setRevisionField("liveWriteApprovalReference", issued.approvalReference);
      setApproval(issued);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "LIVE_WRITE_APPROVAL_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    setResult(null);
    setCopyStatus(null);
    try {
      const token = await csrf("listing-creative-adapter-export");
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

  async function recoverPacket(): Promise<void> {
    setBusy(true);
    setError(null);
    setResult(null);
    setCopyStatus(null);
    try {
      const digest = recoveryDigest.trim();
      const response = await fetch(`/api/admin/listing/creative-adapter/recovery?packetDigest=${encodeURIComponent(digest)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await response.json() as Readonly<{ data?: { packet: unknown; readiness: { packetId: string; packetDigest: string } }; error?: { code: string } }>;
      if (!response.ok || !body.data) throw new Error(body.error?.code ?? "ADAPTER_PACKET_RECOVERY_FAILED");
      setPacketJson(JSON.stringify(body.data.packet, null, 2));
      setRevision((current) => ({ ...current, packetId: body.data?.readiness.packetId ?? current.packetId }));
      setCopyStatus(`저장된 packet을 복구했습니다 · ${body.data.readiness.packetDigest}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ADAPTER_PACKET_RECOVERY_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function copyPacket(): Promise<void> {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result.packet, null, 2));
    setCopyStatus("승인된 revision packet을 클립보드에 복사했습니다.");
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-slate-950">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-indigo-700">Owner-controlled adapter</p>
        <h1 className="text-3xl font-bold">새 external adapter packet revision</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          현재 WING에서 확인한 packet을 새 revision으로 묶습니다. 이 화면은 WING에 제출하지 않으며, live-write 승인은 별도 명시 확인 후 원격 감사 저장소에 기록됩니다.
        </p>
      </header>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        배송 코드·반품 코드·연락처·주소는 추정하지 마세요. live-write 승인 발급은 현재 packet과 content approval에 결속된 owner 확인을 남기며, 유료 이미지 생성이나 WING 제출을 자동 실행하지 않습니다.
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">1. Revision binding</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className="text-sm">새 packet ID<input className={inputClass} value={revision.packetId} onChange={(e) => setRevisionField("packetId", e.target.value)} /></label>
          <label className="text-sm">새 evaluation ID<input className={inputClass} value={revision.evaluationId} onChange={(e) => setRevisionField("evaluationId", e.target.value)} /></label>
          <label className="text-sm">WING 관찰 시각 (ISO 8601)<input className={inputClass} value={revision.evaluatedAt} onChange={(e) => setRevisionField("evaluatedAt", e.target.value)} /></label>
          <label className="text-sm">WING/adapter source reference<input className={inputClass} value={revision.sourceReference} onChange={(e) => setRevisionField("sourceReference", e.target.value)} /></label>
          <label className="text-sm">생성 사유<select className={inputClass} value={revision.reason} onChange={(e) => setRevisionField("reason", e.target.value as RevisionState["reason"])}><option value="CURRENT_WING_REVIEW">현재 WING 재검토</option><option value="SOURCE_REFRESH">source refresh</option><option value="EXPIRED_PACKET_REPLACEMENT">만료 packet 교체</option></select></label>
          <label className="text-sm">content approval reference<input className={inputClass} value={revision.contentApprovalReference} onChange={(e) => setRevisionField("contentApprovalReference", e.target.value)} /></label>
          <label className="text-sm md:col-span-2">live-write approval reference (발급 후 자동 입력)<input className={inputClass} value={revision.liveWriteApprovalReference} onChange={(e) => setRevisionField("liveWriteApprovalReference", e.target.value)} /></label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">2. Current WING adapter packet</h2>
        <p className="mt-1 text-sm text-slate-600">여기에는 <code>{"{listingInput, commerce}"}</code> 객체만 입력합니다.</p>
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
          <p className="font-semibold">저장된 packet 복구</p>
          <p className="mt-1">이전에 Export 준비를 완료했다면 JSON을 다시 붙여넣지 말고 packet digest(64자리)를 입력해 복구할 수 있습니다.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input aria-label="Saved packet digest" className={`${inputClass} max-w-xl`} value={recoveryDigest} onChange={(event) => setRecoveryDigest(event.target.value)} placeholder="sha256 digest" />
            <button className="rounded-lg border border-indigo-700 px-4 py-2 text-sm font-semibold text-indigo-800 disabled:opacity-50" disabled={busy || recoveryDigest.trim().length === 0} onClick={() => void recoverPacket()} type="button">저장 packet 복구</button>
          </div>
        </div>
        <textarea aria-label="New WING adapter packet JSON" className="mt-3 min-h-80 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs" value={packetJson} onChange={(e) => setPacketJson(e.target.value)} spellCheck={false} placeholder={'{"listingInput": {...}, "commerce": {...}}'} />
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="rounded-lg border border-indigo-700 px-4 py-2 text-sm font-semibold text-indigo-800 disabled:opacity-50" disabled={busy || packetJson.trim().length === 0 || approval !== null} onClick={() => void issueLiveWriteApproval()} type="button">Owner live-write 승인 발급</button>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || packetJson.trim().length === 0} onClick={() => void submit()} type="button">revision 생성·검증</button>
        </div>
      </section>

      {approval ? <section className="rounded-xl border border-indigo-300 bg-indigo-50 p-5"><h2 className="text-lg font-semibold">Owner approval issued</h2><p className="mt-2 text-sm">승인 참조가 원격 private 저장소에 저장되고 현재 packet의 target digest에 결속되었습니다.</p><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">approval reference</dt><dd className="break-all font-mono text-xs">{approval.approvalReference}</dd></div><div><dt className="text-slate-500">bound target digest</dt><dd className="break-all font-mono text-xs">{approval.approvalTargetDigest}</dd></div><div><dt className="text-slate-500">expires</dt><dd>{approval.expiresAt}</dd></div><div><dt className="text-slate-500">scope</dt><dd>{approval.scope}</dd></div></dl></section> : null}

      {result ? <section className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5"><h2 className="text-lg font-semibold">3. Revision 결과</h2><dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-slate-500">status</dt><dd className="font-semibold">{result.readiness.status}</dd></div><div><dt className="text-slate-500">BLOCKER / WARNING</dt><dd>{result.readiness.blockerCount} / {result.readiness.warningCount}</dd></div><div><dt className="text-slate-500">packet digest</dt><dd className="break-all font-mono text-xs">{result.readiness.packetDigest}</dd></div><div><dt className="text-slate-500">revision digest</dt><dd className="break-all font-mono text-xs">{result.revisionDigest}</dd></div></dl><button className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => void copyPacket()} type="button">Production 입력용 packet 복사</button>{copyStatus ? <p className="text-xs" role="status">{copyStatus}</p> : null}</section> : null}
      {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
    </main>
  );
}
