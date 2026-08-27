"use client";

import { useState } from "react";

type ImportSource = "tenbi" | "tiktok";

const templates: Record<ImportSource, string> = {
  tenbi: "keyword\ttitle\tplatform\tsource_url\tcategory\tviews\tlikes\trising_score\tobserved_at",
  tiktok: "keyword\ttitle\tvideo_url\tviews\tlikes\tcomments\tshares\tposts7d\tposts14d\tposts30d\tcategory\tobserved_at",
};

export function ExternalImportPanel() {
  const [source, setSource] = useState<ImportSource>("tenbi");
  const [text, setText] = useState(templates.tenbi);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function chooseSource(next: ImportSource) {
    setSource(next);
    setText(templates[next]);
    setMessage("");
  }

  async function readFile(file: File | null) {
    if (!file) return;
    setMessage("");
    try {
      setText(await file.text());
    } catch {
      setMessage("CSV 또는 TSV 텍스트 파일을 읽지 못했습니다.");
    }
  }

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const csrfResponse = await fetch("/api/admin/auth/csrf?purpose=market-external-import", { cache: "no-store" });
      const csrf = await csrfResponse.json();
      if (!csrfResponse.ok || !csrf.token) throw new Error("로그인 세션을 확인해주세요.");
      const response = await fetch("/api/market/external-import", {
        method: "POST",
        headers: { "content-type": "application/json", "X-GonggamLine-CSRF": csrf.token },
        body: JSON.stringify({ source, text }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "가져오기에 실패했습니다.");
      setMessage(body.idempotent
        ? "이미 반영된 동일 원본입니다. 중복 저장하지 않았습니다."
        : `${source === "tenbi" ? "Tenbi" : "TikTok"} ${body.imported}건 반영 · 오류 ${body.rejected?.length ?? 0}건`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "가져오기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="discovery-command__panel" aria-labelledby="external-import-title">
    <header><div>
      <p className="eyebrow">EXTERNAL MARKET SIGNALS</p>
      <h2 id="external-import-title">Tenbi · TikTok 사용자 보조 가져오기</h2>
      <span>로그인 화면 또는 공식 내보내기에서 확인한 데이터만 가져옵니다. 내부 API 추측·세션 복제·비공식 스크래핑은 사용하지 않습니다.</span>
    </div></header>
    <div className="lane-tabs" role="tablist" aria-label="가져오기 출처">
      <button type="button" className={source === "tenbi" ? "is-active" : ""} onClick={() => chooseSource("tenbi")}>Tenbi 화면·CSV</button>
      <button type="button" className={source === "tiktok" ? "is-active" : ""} onClick={() => chooseSource("tiktok")}>TikTok 공식 CSV</button>
    </div>
    <p>{source === "tenbi"
      ? "텐비 쇼핑쇼츠에서 확인한 상품명·플랫폼·원문 URL·카테고리·반응값을 표로 붙여넣습니다. 원천 플랫폼은 upstreamSource로 분리해 중복 가중하지 않습니다."
      : "TikTok Creator Center가 제공한 공식 CSV/TSV만 사용합니다. 조회·좋아요·댓글·공유는 구매량이 아닌 소셜 선행신호로 저장합니다."}</p>
    <div className="discovery-command__hero-actions">
      <label htmlFor="external-market-file">CSV/TSV 파일</label>
      <input id="external-market-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" onChange={(event) => void readFile(event.target.files?.[0] ?? null)} />
    </div>
    <label htmlFor="external-market-text">표 데이터 붙여넣기</label>
    <textarea id="external-market-text" value={text} rows={8} spellCheck={false} onChange={(event) => setText(event.target.value)} />
    <div className="discovery-command__hero-actions">
      <button type="button" disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? "검증·반영 중" : "검증 후 가져오기"}</button>
      <button type="button" disabled={busy} onClick={() => setText(templates[source])}>템플릿 초기화</button>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
  </section>;
}
