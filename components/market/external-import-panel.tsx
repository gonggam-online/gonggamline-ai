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

  return <details className="codex-assisted-import" id="external-market-import">
    <summary>
      <span><b>Tenbi · TikTok 최신정보 반영</b><small>사용자는 로그인만 · 수집·검증·반영은 Codex가 수행</small></span>
      <em>Codex 보조 작업</em>
    </summary>
    <div className="codex-assisted-import__body">
      <header>
        <p className="eyebrow">CODEX-ASSISTED EXTERNAL MARKET SIGNALS</p>
        <h2 id="external-import-title">사용자 복사·붙여넣기 없이 업데이트</h2>
        <p>채팅에서 업데이트를 요청하면 Codex가 로그인 화면을 엽니다. 사용자가 로그인 완료만 알리면, Codex가 공식 화면·공식 내보내기 범위에서 데이터를 수집하고 검증·반영한 뒤 실제 SKU 상위 10개를 다시 산출합니다.</p>
      </header>
      <ol className="codex-assisted-import__flow">
        <li><b>1. 채팅에서 요청</b><span>“Tenbi·TikTok 최신정보 업데이트해줘”라고 요청합니다.</span></li>
        <li><b>2. 사용자 로그인</b><span>Codex가 연 로그인 화면에서 로그인하고 “로그인 완료”만 알립니다.</span></li>
        <li><b>3. Codex 수집·검증</b><span>공식 화면·공식 내보내기만 사용해 SKU 식별, 출처, 시각, 중복과 상품 관련성을 검증합니다.</span></li>
        <li><b>4. 반영·재산출</b><span>정상 행은 전체 시장 데이터에 반영하고, 오류 행만 격리한 뒤 상위 10개를 재산출합니다.</span></li>
      </ol>
      <div className="codex-assisted-import__links">
        <a href="https://tenb.io/trends/shopping" target="_blank" rel="noreferrer">Tenbi 로그인·쇼핑 트렌드</a>
        <a href="https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en" target="_blank" rel="noreferrer">TikTok Creative Center</a>
      </div>
      <p className="codex-assisted-import__guard">내부 API 추측·세션 복제·비공식 스크래핑은 사용하지 않습니다. API가 없는 동안 이 흐름은 사용자의 로그인과 Codex 브라우저 작업이 필요한 요청형 업데이트입니다.</p>
      <details className="codex-assisted-import__operator">
        <summary>Codex 작업용 반영 도구</summary>
        <p>이 입력 영역은 Codex가 브라우저 수집 결과를 반영할 때 사용합니다. 사용자가 직접 복사하거나 붙여넣을 필요가 없습니다.</p>
        <div className="lane-tabs" role="tablist" aria-label="가져오기 출처">
          <button type="button" className={source === "tenbi" ? "is-active" : ""} onClick={() => chooseSource("tenbi")}>Tenbi 공식 화면·내보내기</button>
          <button type="button" className={source === "tiktok" ? "is-active" : ""} onClick={() => chooseSource("tiktok")}>TikTok 공식 내보내기</button>
        </div>
        <p>{source === "tenbi"
          ? "Tenbi 쇼핑 트렌드에서 확인한 상품명·플랫폼·원문 URL·카테고리·반응값을 반영합니다. 원천 플랫폼은 upstreamSource로 분리해 중복 가중하지 않습니다."
          : "TikTok Creative Center의 공식 데이터만 사용합니다. 조회·좋아요·댓글·공유는 구매량이 아닌 상품 관련 소셜 선행신호로 저장합니다."}</p>
        <div className="discovery-command__hero-actions">
          <label htmlFor="external-market-file">공식 CSV/TSV 파일</label>
          <input id="external-market-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" onChange={(event) => void readFile(event.target.files?.[0] ?? null)} />
        </div>
        <label htmlFor="external-market-text">Codex 수집 데이터</label>
        <textarea id="external-market-text" value={text} rows={8} spellCheck={false} onChange={(event) => setText(event.target.value)} />
        <div className="discovery-command__hero-actions">
          <button type="button" disabled={busy || !text.trim()} onClick={() => void submit()}>{busy ? "검증·반영 중" : "검증 후 전체 데이터에 반영"}</button>
          <button type="button" disabled={busy} onClick={() => setText(templates[source])}>작업 템플릿 초기화</button>
        </div>
        {message && <p className="notice" role="status">{message}</p>}
      </details>
    </div>
  </details>;
}
