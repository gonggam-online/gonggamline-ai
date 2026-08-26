"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MetaAttribute = {
  attributeTypeName?: string;
  required?: string;
  inputType?: string;
  dataType?: string;
  inputValues?: string[];
  basicUnit?: string;
  usableUnits?: string[];
  exposed?: string;
};

type MetaSummary = {
  attributes: MetaAttribute[];
  requiredCount: number;
  optionalCount: number;
  noticeCategories: unknown[];
  certifications: unknown[];
};


type SourceProduct = {
  sourceId: string;
  productNo: string;
  title: string;
  keyword: string;
  thumbnail: string;
  productUrl: string;
  salePrice: number;
  originalPrice: number;
};

const initialPayload = {
  displayCategoryCode: 0,
  sellerProductName: "테스트 상품명",
  saleStartedAt: new Date().toISOString().slice(0, 19),
  saleEndedAt: "2099-01-01T23:59:59",
  displayProductName: "고객에게 노출될 상품명",
  brand: "브랜드명",
  generalProductName: "일반 상품명",
  productGroup: "상품군",
  deliveryMethod: "SEQUENCIAL",
  deliveryCompanyCode: "KDEXP",
  deliveryChargeType: "FREE",
  deliveryCharge: 0,
  freeShipOverAmount: 0,
  deliveryChargeOnReturn: 3000,
  remoteAreaDeliverable: "N",
  unionDeliveryType: "NOT_UNION_DELIVERY",
  returnCenterCode: "반품지센터코드",
  returnChargeName: "반품지명",
  companyContactNumber: "02-0000-0000",
  returnZipCode: "00000",
  returnAddress: "반품 주소",
  returnAddressDetail: "상세 주소",
  returnCharge: 3000,
  outboundShippingPlaceCode: "출고지코드",
  vendorUserId: "WING 로그인 ID",
  requested: true,
  items: [
    {
      itemName: "기본 옵션",
      originalPrice: 19900,
      salePrice: 14900,
      maximumBuyCount: 999,
      maximumBuyForPerson: 0,
      maximumBuyForPersonPeriod: 1,
      outboundShippingTimeDay: 1,
      unitCount: 1,
      adultOnly: "EVERYONE",
      taxType: "TAX",
      parallelImported: "NOT_PARALLEL_IMPORTED",
      overseasPurchased: "NOT_OVERSEAS_PURCHASED",
      pccNeeded: false,
      externalVendorSku: "GGL-TEST-001",
      images: [
        { imageOrder: 0, imageType: "REPRESENTATION", vendorPath: "https://example.com/product.jpg" },
      ],
      notices: [
        { noticeCategoryName: "기타 재화", noticeCategoryDetailName: "품명 및 모델명", content: "상세페이지 참조" },
      ],
      attributes: [
        { attributeTypeName: "수량", attributeValueName: "1개" },
      ],
      contents: [
        { contentsType: "TEXT", contentDetails: [{ content: "상품 상세 설명을 입력하세요.", detailType: "TEXT" }] },
      ],
      certifications: [{ certificationType: "NOT_REQUIRED", certificationCode: "" }],
      searchTags: ["테스트상품"],
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readArray(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function parseMetaSummary(value: unknown): MetaSummary | null {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.result)) return null;
  const result = value.result;
  const data = isRecord(result.data) ? result.data : result;

  const attributes = readArray(data, ["attributes", "attributeTypes"])
    .filter(isRecord)
    .map((item) => ({
      attributeTypeName: typeof item.attributeTypeName === "string" ? item.attributeTypeName : undefined,
      required: typeof item.required === "string" ? item.required : undefined,
      inputType: typeof item.inputType === "string" ? item.inputType : undefined,
      dataType: typeof item.dataType === "string" ? item.dataType : undefined,
      inputValues: Array.isArray(item.inputValues) ? item.inputValues.filter((v): v is string => typeof v === "string") : undefined,
      basicUnit: typeof item.basicUnit === "string" ? item.basicUnit : undefined,
      usableUnits: Array.isArray(item.usableUnits) ? item.usableUnits.filter((v): v is string => typeof v === "string") : undefined,
      exposed: typeof item.exposed === "string" ? item.exposed : undefined,
    }));

  return {
    attributes,
    requiredCount: attributes.filter((item) => item.required === "MANDATORY").length,
    optionalCount: attributes.filter((item) => item.required !== "MANDATORY").length,
    noticeCategories: readArray(data, ["noticeCategories", "notices", "noticeCategoryTypes"]),
    certifications: readArray(data, ["certifications", "certificationTypes", "requiredCertifications"]),
  };
}

function defaultAttributeValue(attribute: MetaAttribute): string {
  const firstValue = attribute.inputValues?.[0];
  if (firstValue) return firstValue;
  if (attribute.attributeTypeName?.includes("수량")) return "1개";
  return "";
}


function cleanText(value: string | null): string {
  return (value ?? "").trim();
}

function positiveNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeImageUrl(value: string): string {
  return value.startsWith("http://") ? value.replace("http://", "https://") : value;
}

function payloadFromSource(source: SourceProduct) {
  const safeTitle = source.title || "상품명 확인 필요";
  const safeKeyword = source.keyword || safeTitle.split(/\s+/)[0] || "상품";
  const imageUrl = normalizeImageUrl(source.thumbnail);
  const sourceDetail = source.productUrl
    ? `도매꾹 원본: ${source.productUrl}`
    : "도매꾹 원본 상품 정보를 확인하세요.";

  return {
    ...initialPayload,
    sellerProductName: safeTitle,
    displayProductName: safeTitle,
    generalProductName: safeTitle,
    productGroup: safeKeyword,
    items: [
      {
        ...initialPayload.items[0],
        itemName: "기본 옵션",
        originalPrice: Math.max(source.originalPrice, source.salePrice),
        salePrice: source.salePrice,
        externalVendorSku: `GGL-${source.productNo || source.sourceId}`,
        images: imageUrl
          ? [{ imageOrder: 0, imageType: "REPRESENTATION", vendorPath: imageUrl }]
          : initialPayload.items[0].images,
        contents: [
          {
            contentsType: "TEXT",
            contentDetails: [{ content: sourceDetail, detailType: "TEXT" }],
          },
        ],
        searchTags: Array.from(new Set([safeKeyword, ...safeTitle.split(/\s+/)]))
          .filter(Boolean)
          .slice(0, 20),
      },
    ],
  };
}

export default function CoupangRegisterPage() {
  const [jsonText, setJsonText] = useState(JSON.stringify(initialPayload, null, 2));
  const [categoryCode, setCategoryCode] = useState("");
  const [metaResult, setMetaResult] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [showRawMeta, setShowRawMeta] = useState(false);
  const [sourceProduct, setSourceProduct] = useState<SourceProduct | null>(null);
  const [listingContext, setListingContext] = useState<{ listingDraftId?: number; workflowId?: number; jobId?: number }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const title = cleanText(params.get("title"));
    const productNo = cleanText(params.get("productNo"));
    const sourceId = cleanText(params.get("sourceId"));
    const listingDraftId = Number(params.get("listingDraftId") || 0) || undefined;
    const workflowId = Number(params.get("workflowId") || 0) || undefined;
    const jobId = Number(params.get("jobId") || 0) || undefined;
    setListingContext({ listingDraftId, workflowId, jobId });

    if (listingDraftId) {
      fetch("/api/listing/drafts", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          const draft = Array.isArray(data.drafts) ? data.drafts.find((item: { id?: number }) => item.id === listingDraftId) : null;
          if (draft?.coupang_payload) {
            setJsonText(JSON.stringify(draft.coupang_payload, null, 2));
            setResult({ ok: true, stage: "listing-prefill", message: `Listing Draft #${listingDraftId}를 불러왔습니다.` });
          }
        })
        .catch(() => setResult({ ok: false, message: "Listing 초안을 불러오지 못했습니다." }));
      return;
    }

    if (!title && !productNo && !sourceId) return;

    const salePrice = positiveNumber(params.get("salePrice"), 14900);
    const source: SourceProduct = {
      sourceId,
      productNo,
      title,
      keyword: cleanText(params.get("keyword")),
      thumbnail: cleanText(params.get("thumbnail")),
      productUrl: cleanText(params.get("productUrl")),
      salePrice,
      originalPrice: positiveNumber(params.get("originalPrice"), salePrice),
    };

    setSourceProduct(source);
    setJsonText(JSON.stringify(payloadFromSource(source), null, 2));
    setResult({
      ok: true,
      stage: "source-prefill",
      message: "상품 후보 정보로 등록 JSON 초안을 만들었습니다. 카테고리와 운영 정보를 확인하세요.",
    });
  }, []);

  const parsed = useMemo(() => {
    try { return { ok: true as const, value: JSON.parse(jsonText) }; }
    catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "JSON 오류" }; }
  }, [jsonText]);

  const metaSummary = useMemo(() => parseMetaSummary(metaResult), [metaResult]);

  async function loadMeta() {
    setBusy(true); setResult(null); setMetaResult(null);
    try {
      const response = await fetch(`/api/coupang/categories/meta?displayCategoryCode=${encodeURIComponent(categoryCode)}`, { cache: "no-store" });
      const data = await response.json();
      setMetaResult(data);
      if (response.ok && parsed.ok) {
        setJsonText(JSON.stringify({ ...parsed.value, displayCategoryCode: Number(categoryCode) }, null, 2));
      }
    } catch {
      setMetaResult({ ok: false, message: "카테고리 메타정보 요청에 실패했습니다." });
    } finally { setBusy(false); }
  }

  function applyRequiredAttributes() {
    if (!parsed.ok || !metaSummary) return;
    const requiredAttributes = metaSummary.attributes
      .filter((item) => item.required === "MANDATORY" && item.attributeTypeName)
      .map((item) => ({
        attributeTypeName: item.attributeTypeName,
        attributeValueName: defaultAttributeValue(item),
      }));

    const payload = parsed.value as typeof initialPayload;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const nextItems = items.map((item, index) => index === 0 ? { ...item, attributes: requiredAttributes } : item);
    setJsonText(JSON.stringify({ ...payload, displayCategoryCode: Number(categoryCode), items: nextItems }, null, 2));
    setResult({
      ok: true,
      stage: "metadata",
      message: `필수 구매옵션 ${requiredAttributes.length}개를 첫 번째 옵션에 반영했습니다. 빈 값은 상품에 맞게 입력하세요.`,
    });
  }

  async function submit() {
    if (!parsed.ok) { setResult({ ok: false, message: parsed.error }); return; }
    setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/coupang/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: parsed.value, mode: liveMode ? "live" : "validate", confirmation, ...listingContext }),
      });
      setResult(await response.json());
    } catch { setResult({ ok: false, message: "브라우저 요청에 실패했습니다." }); }
    finally { setBusy(false); }
  }

  return (
    <main className="register-shell">
      <header className="register-hero">
        <div>
          <p className="eyebrow">ENGINE 6-2 · COUPANG REGISTRATION</p>
          <h1>6-2. 쿠팡 상품 등록</h1>
          <p>상품 후보에서 전달된 상품명·가격·이미지를 등록 JSON 초안에 자동 반영하고, 카테고리 필수 항목을 이어서 구성합니다.</p>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link className="ghost-link" href="/dashboard">7대 엔진 전체보기</Link><Link className="ghost-link" href="/seller">6. 판매채널 운영</Link><Link className="ghost-link" href="/coupang">6-1 쿠팡 API 연동</Link></div>
      </header>

      {sourceProduct && (
        <section className="register-panel source-product-panel">
          <div className="source-product-copy">
            <p className="eyebrow">상품 후보에서 불러옴</p>
            <h2>{sourceProduct.title || "상품명 확인 필요"}</h2>
            <div className="source-product-meta">
              <span>상품번호 {sourceProduct.productNo || "없음"}</span>
              <span>예정 판매가 {sourceProduct.salePrice.toLocaleString("ko-KR")}원</span>
              {sourceProduct.keyword && <span>키워드 {sourceProduct.keyword}</span>}
            </div>
            <p className="muted">상품명, 판매가, 대표 이미지, SKU, 검색어를 JSON 초안에 반영했습니다.</p>
          </div>
          <div className="source-product-actions">
            {sourceProduct.productUrl && (
              <a className="secondary-link" href={normalizeImageUrl(sourceProduct.productUrl)} target="_blank" rel="noreferrer">
                도매꾹 원본 보기
              </a>
            )}
            <Link className="secondary-button button-link" href="/">상품 후보로 돌아가기</Link>
          </div>
        </section>
      )}

      <section className="register-grid">
        <article className="register-panel">
          <h2>1. 카테고리 메타정보</h2>
          <p className="muted">WING에서 확인한 숫자형 노출 카테고리 코드를 입력하세요.</p>
          <div className="inline-fields meta-search-row">
            <input value={categoryCode} onChange={(e) => setCategoryCode(e.target.value.replace(/\D/g, ""))} placeholder="예: 78870" inputMode="numeric" />
            <button onClick={loadMeta} disabled={busy || !categoryCode}>{busy ? "조회 중…" : "메타정보 조회"}</button>
          </div>

          {metaSummary && (
            <div className="meta-summary">
              <div className="meta-stat-row">
                <span><strong>{metaSummary.attributes.length}</strong> 전체 속성</span>
                <span className="mandatory"><strong>{metaSummary.requiredCount}</strong> 필수</span>
                <span><strong>{metaSummary.optionalCount}</strong> 선택</span>
              </div>
              <div className="meta-actions">
                <button onClick={applyRequiredAttributes} disabled={!parsed.ok || metaSummary.requiredCount === 0}>필수 구매옵션 JSON에 반영</button>
                <button className="secondary-button" onClick={() => setShowRawMeta((value) => !value)}>{showRawMeta ? "원본 JSON 닫기" : "원본 JSON 보기"}</button>
              </div>
              <div className="attribute-list">
                {metaSummary.attributes.map((attribute, index) => (
                  <article className="attribute-card" key={`${attribute.attributeTypeName ?? "attribute"}-${index}`}>
                    <div className="attribute-title-row">
                      <strong>{attribute.attributeTypeName || `속성 ${index + 1}`}</strong>
                      <span className={attribute.required === "MANDATORY" ? "required-badge" : "optional-badge"}>
                        {attribute.required === "MANDATORY" ? "필수" : "선택"}
                      </span>
                    </div>
                    <p>{attribute.inputType || "입력"} · {attribute.dataType || "문자"}{attribute.basicUnit ? ` · 기본 단위 ${attribute.basicUnit}` : ""}</p>
                    {attribute.inputValues && attribute.inputValues.length > 0 && (
                      <div className="value-chips">
                        {attribute.inputValues.slice(0, 8).map((value) => <span key={value}>{value}</span>)}
                        {attribute.inputValues.length > 8 && <span>+{attribute.inputValues.length - 8}개</span>}
                      </div>
                    )}
                  </article>
                ))}
              </div>
              {showRawMeta && <pre className="json-output">{JSON.stringify(metaResult, null, 2)}</pre>}
            </div>
          )}

          {metaResult !== null && !metaSummary && <pre className="json-output">{JSON.stringify(metaResult, null, 2)}</pre>}
        </article>

        <article className="register-panel">
          <h2>2. 안전 설정</h2>
          <label className="live-toggle">
            <input type="checkbox" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} />
            <span><strong>실제 쿠팡 등록 모드</strong><small>꺼짐 상태에서는 서버 기본 검증만 실행합니다.</small></span>
          </label>
          {liveMode && (
            <label className="confirm-field">확인 문구
              <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="실제 상품 등록" />
            </label>
          )}
          <div className="warning-box">자동 반영된 필수 속성 중 빈 값은 실제 상품 정보로 채워야 합니다. 출고지·반품지 코드, 이미지, 고시정보, 인증정보도 실제 등록 전에 확인하세요.</div>
        </article>
      </section>

      <section className="register-panel editor-panel">
        <div className="panel-heading">
          <div><h2>3. 상품 등록 JSON</h2><p className="muted">COUPANG_VENDOR_ID는 서버에서 자동 주입됩니다.</p></div>
          <span className={parsed.ok ? "json-valid" : "json-invalid"}>{parsed.ok ? "JSON 정상" : "JSON 오류"}</span>
        </div>
        <textarea className="json-editor" value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
        {!parsed.ok && <p className="error-text">{parsed.error}</p>}
        <button className={liveMode ? "danger-action" : "primary-action"} onClick={submit} disabled={busy || !parsed.ok}>
          {busy ? "처리 중…" : liveMode ? "실제 상품 등록 요청" : "등록 전문 검증"}
        </button>
      </section>

      {result !== null && <section className="register-panel"><h2>처리 결과</h2><pre className="json-output">{JSON.stringify(result, null, 2)}</pre></section>}
    </main>
  );
}
