"use client";

import { useState } from "react";

import {
  LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION,
  LISTING_CREATIVE_ADAPTER_ENRICH_API_VERSION,
  LISTING_CREATIVE_ADAPTER_MANUAL_LOGISTICS_API_VERSION,
  type ListingCreativeAdapterExportDto,
  type ListingCreativeAdapterEnrichmentResult,
  type ListingCreativeAdapterPacket,
  type ListingCreativeAdapterReadiness,
} from "@/shared/contracts/listing-creative-adapter-export";

type ApiResponse = Readonly<{
  data?: ListingCreativeAdapterExportDto;
  sanitizedReview?: ListingCreativeAdapterExportDto;
  error?: Readonly<{ code: string }>;
}>;

async function csrf(purpose: "listing-creative-adapter-export" | "listing-creative-adapter-enrich" = "listing-creative-adapter-export"): Promise<string> {
  const response = await fetch(`/api/admin/auth/csrf?purpose=${purpose}`, {
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
  const [logisticsJson, setLogisticsJson] = useState("");
  const [manualLogisticsJson, setManualLogisticsJson] = useState("");
  const [logisticsPreflight, setLogisticsPreflight] = useState<string | null>(null);

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

  async function enrichByAddress(): Promise<void> {
    setBusy(true);
    setErrorCode(null);
    setCopyStatus(null);
    try {
      const token = await csrf("listing-creative-adapter-enrich");
      const response = await fetch("/api/admin/listing/creative-adapter/enrich", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-GonggamLine-CSRF": token },
        body: JSON.stringify({
          schemaVersion: LISTING_CREATIVE_ADAPTER_ENRICH_API_VERSION,
          packet: JSON.parse(input) as unknown,
          logistics: JSON.parse(logisticsJson) as unknown,
        }),
      });
      const body = await response.json() as Readonly<{ data?: ListingCreativeAdapterEnrichmentResult; error?: Readonly<{ code: string }> }>;
      if (!response.ok || !body.data) throw new Error(body.error?.code ?? "ADAPTER_ENRICH_FAILED");
      const enriched = body.data;
      setInput(JSON.stringify(enriched.packet, null, 2));
      setFull({ schemaVersion: LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION, exportKind: "FULL_PACKET", packet: enriched.packet, readiness: enriched.readiness, generatedAt: enriched.generatedAt });
      setSanitized(null);
      setCopyStatus("주소 매칭으로 출고지·반품지 코드를 확인하고 private 저장소에 저장했습니다.");
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "ADAPTER_ENRICH_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function runLogisticsPreflight(): Promise<void> {
    setBusy(true);
    setErrorCode(null);
    try {
      const response = await fetch("/api/admin/listing/creative-adapter/logistics/preflight", { credentials: "same-origin", cache: "no-store" });
      const body = await response.json() as Readonly<{ data?: Readonly<{ status: string; detail: string; staticEgressRequired: boolean }>; error?: Readonly<{ code: string }> }>;
      if (!response.ok || !body.data) throw new Error(body.error?.code ?? "COUPANG_LOGISTICS_PREFLIGHT_FAILED");
      setLogisticsPreflight(`${body.data.status} · ${body.data.detail}${body.data.staticEgressRequired ? " · Vercel Static IP/allowlist 필요" : ""}`);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "COUPANG_LOGISTICS_PREFLIGHT_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function importOwnerConfirmedLogistics(): Promise<void> {
    setBusy(true);
    setErrorCode(null);
    setCopyStatus(null);
    try {
      const token = await csrf("listing-creative-adapter-enrich");
      const response = await fetch("/api/admin/listing/creative-adapter/logistics/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-GonggamLine-CSRF": token },
        body: JSON.stringify({
          schemaVersion: LISTING_CREATIVE_ADAPTER_MANUAL_LOGISTICS_API_VERSION,
          packet: JSON.parse(input) as unknown,
          evidence: JSON.parse(manualLogisticsJson) as unknown,
        }),
      });
      const body = await response.json() as Readonly<{ data?: { packet: ListingCreativeAdapterPacket; readiness: ListingCreativeAdapterReadiness }; error?: Readonly<{ code: string }> }>;
      if (!response.ok || !body.data) throw new Error(body.error?.code ?? "ADAPTER_MANUAL_LOGISTICS_FAILED");
      setInput(JSON.stringify(body.data.packet, null, 2));
      setFull({ schemaVersion: LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION, exportKind: "FULL_PACKET", packet: body.data.packet, readiness: body.data.readiness, generatedAt: new Date().toISOString() });
      setSanitized(null);
      setCopyStatus("WING 확인 코드를 packet에 결속하고 private 저장소에 저장했습니다. 이후에는 주소 API 재조회 없이 digest로 복구됩니다.");
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "ADAPTER_MANUAL_LOGISTICS_FAILED");
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
        <p className="text-sm text-indigo-800">등록 적합성은 exact category·필수 필드·사실 충돌·payload 검증으로 판정합니다. content/live approval과 전환 최적화는 별도 경고이며 실제 제출 직전에만 live-write 승인이 필요합니다.</p>
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

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">주소 API 장애 시 1회 WING 코드 결속</h2>
        <p className="mt-1 text-sm text-emerald-950">WING에서 확인한 출고·반품 코드를 owner 승인 참조와 함께 한 번만 입력합니다. 서버는 코드를 private packet에 digest로 저장하며 이후 Production이 Coupang 주소 API를 반복 호출하지 않습니다.</p>
        <textarea aria-label="Owner confirmed WING logistics evidence JSON" className="mt-3 min-h-32 w-full rounded-xl border border-emerald-300 bg-white p-3 font-mono text-xs" onChange={(event) => setManualLogisticsJson(event.target.value)} placeholder={'{"vendorId":"...","observedAt":"...","sourceReference":"wing:draft:...","approvalReference":"owner:logistics:...","outbound":{"code":"...","selector":{"placeName":"...","zipCode":"...","address":"...","addressDetail":"..."}},"returnCenter":{"code":"...","selector":{"placeName":"...","zipCode":"...","address":"...","addressDetail":"..."}}}'} spellCheck={false} value={manualLogisticsJson} />
        <button className="mt-3 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50" disabled={busy || input.trim().length === 0 || manualLogisticsJson.trim().length === 0} onClick={() => void importOwnerConfirmedLogistics()} type="button">WING 코드 1회 결속·저장</button>
      </section>

      <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">주소 기반 배송 코드 확인</h2>
        <p className="mt-1 text-sm text-indigo-950">WING 주소록의 출고지·반품지 관찰값만 입력하면 서버가 Coupang read-only API로 코드를 매칭합니다. Secret과 원본 API 응답은 화면·로그·packet에 저장하지 않습니다.</p>
        <button className="mt-3 rounded-lg border border-indigo-700 px-4 py-2 text-sm font-semibold text-indigo-900 disabled:opacity-50" disabled={busy} onClick={() => void runLogisticsPreflight()} type="button">Coupang 물류 API 연결 확인</button>
        {logisticsPreflight ? <p className="mt-2 text-xs font-semibold text-indigo-950" role="status">{logisticsPreflight}</p> : null}
        <textarea
          aria-label="WING logistics address selectors JSON"
          className="mt-3 min-h-32 w-full rounded-xl border border-indigo-300 bg-white p-3 font-mono text-xs"
          onChange={(event) => setLogisticsJson(event.target.value)}
          placeholder={'{"outbound":{"placeName":"...","zipCode":"...","address":"...","addressDetail":"..."},"returnCenter":{"placeName":"...","zipCode":"...","address":"...","addressDetail":"..."}}'}
          spellCheck={false}
          value={logisticsJson}
        />
        <button
          className="mt-3 rounded-lg border border-indigo-700 px-4 py-2 text-sm font-semibold text-indigo-900 disabled:opacity-50"
          disabled={busy || input.trim().length === 0 || logisticsJson.trim().length === 0}
          onClick={() => void enrichByAddress()}
          type="button"
        >
          {busy ? "주소 매칭 중..." : "주소로 배송 코드 확인 후 저장"}
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
