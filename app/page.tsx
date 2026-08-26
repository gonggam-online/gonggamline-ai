"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ReviewStatus =
  | "unreviewed"
  | "reviewing"
  | "sample_candidate"
  | "approved"
  | "excluded";

type RiskLevel = "unknown" | "low" | "medium" | "high";
type SortOption = "score" | "profit" | "margin" | "recent" | "price";

type Product = {
  id: number;
  product_no: string;
  keyword: string | null;
  title: string;
  thumbnail: string | null;
  product_url: string | null;
  supply_price: number;
  minimum_order_quantity: number;
  initial_purchase_amount: number;
  estimated_sale_price: number;
  estimated_profit: number;
  margin_rate: number;
  basic_score: number;
  recommendation: string | null;
  available_on_domeggook: boolean;
  supply_available: boolean;
  updated_at: string;
  is_favorite: boolean;
  review_status: ReviewStatus;
  memo: string | null;
  manual_sale_price: number | null;
  risk_level: RiskLevel;
  excluded_reason: string | null;
};

type ProductsResponse = {
  success: boolean;
  products?: Product[];
  pagination?: {
    page: number;
    size: number;
    totalCount: number;
    totalPages: number;
  };
  message?: string;
};

type CollectionResponse = {
  success: boolean;
  storage?: {
    success: boolean;
    savedCount: number;
    errorMessage: string | null;
  };
  message?: string;
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  unreviewed: "미검토",
  reviewing: "검토 중",
  sample_candidate: "샘플 후보",
  approved: "판매 승인",
  excluded: "제외",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  unknown: "미확인",
  low: "낮음",
  medium: "보통",
  high: "높음",
};

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function createCoupangRegisterHref(product: Product) {
  const params = new URLSearchParams({
    sourceId: String(product.id),
    productNo: product.product_no,
    title: product.title,
    salePrice: String(product.manual_sale_price ?? product.estimated_sale_price),
    originalPrice: String(
      Math.max(
        product.manual_sale_price ?? product.estimated_sale_price,
        product.estimated_sale_price
      )
    ),
    keyword: product.keyword ?? "",
    thumbnail: product.thumbnail ?? "",
    productUrl: product.product_url ?? "",
  });

  return `/coupang/register?${params.toString()}`;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [keyword, setKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [collectKeyword, setCollectKeyword] = useState("케이블정리");
  const [collectSize, setCollectSize] = useState(20);
  const [minimumScore, setMinimumScore] = useState(0);
  const [reviewStatus, setReviewStatus] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("score");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);

  const stats = useMemo(() => {
    return {
      favorites: products.filter((item) => item.is_favorite).length,
      sampleCandidates: products.filter(
        (item) => item.review_status === "sample_candidate"
      ).length,
      approved: products.filter((item) => item.review_status === "approved")
        .length,
    };
  }, [products]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      size: "20",
      minimumScore: String(minimumScore),
      sort,
      favoriteOnly: String(favoriteOnly),
    });

    if (activeKeyword) params.set("keyword", activeKeyword);
    if (reviewStatus) params.set("reviewStatus", reviewStatus);

    try {
      const response = await fetch(`/api/products?${params}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as ProductsResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || "상품을 불러오지 못했습니다.");
      }

      setProducts(result.products ?? []);
      setTotalCount(result.pagination?.totalCount ?? 0);
      setTotalPages(result.pagination?.totalPages ?? 1);
    } catch (caught) {
      setProducts([]);
      setError(
        caught instanceof Error ? caught.message : "상품 조회 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, [activeKeyword, favoriteOnly, minimumScore, page, reviewStatus, sort]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function collectProducts(event: FormEvent) {
    event.preventDefault();
    const trimmed = collectKeyword.trim();

    if (!trimmed) {
      setError("수집 키워드를 입력해주세요.");
      return;
    }

    setCollecting(true);
    setMessage("");
    setError("");

    try {
      const params = new URLSearchParams({
        keyword: trimmed,
        size: String(collectSize),
      });

      const response = await fetch(`/api/domeggook-search?${params}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as CollectionResponse;

      if (!response.ok || !result.success || !result.storage?.success) {
        throw new Error(
          result.storage?.errorMessage ||
            result.message ||
            "상품 수집에 실패했습니다."
        );
      }

      setMessage(`${result.storage.savedCount}개 상품을 수집·저장했습니다.`);
      setKeyword(trimmed);
      setActiveKeyword(trimmed);
      setPage(1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "상품 수집 오류가 발생했습니다."
      );
    } finally {
      setCollecting(false);
    }
  }

  async function patchProduct(
    product: Product,
    patch: Record<string, unknown>
  ): Promise<boolean> {
    setSavingId(product.id);
    setError("");

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "상품 수정에 실패했습니다.");
      }

      setProducts((current) =>
        current.map((item) => (item.id === product.id ? result.product : item))
      );

      if (selected?.id === product.id) {
        setSelected(result.product);
      }

      return true;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "상품 수정 오류가 발생했습니다."
      );
      return false;
    } finally {
      setSavingId(null);
    }
  }

  function searchStored(event: FormEvent) {
    event.preventDefault();
    setActiveKeyword(keyword.trim());
    setPage(1);
  }

  function resetFilters() {
    setKeyword("");
    setActiveKeyword("");
    setMinimumScore(0);
    setReviewStatus("");
    setFavoriteOnly(false);
    setSort("score");
    setPage(1);
  }

  return (
    <main className="dashboard">
      <section className="hero">
        <div>
          <p className="eyebrow">ENGINE 2-2 · PRODUCT CANDIDATES</p>
          <h1>2-2. 상품 후보 관리</h1>
          <p className="hero-description">
            수집, 선별, 즐겨찾기, 샘플 후보와 판매 승인까지 한 화면에서
            관리합니다.
          </p>
        </div>
        <div style={{display:"grid", gap:12}}>
        <div className="summary-card">
          <span>현재 조건 상품</span>
          <strong>{totalCount.toLocaleString("ko-KR")}</strong>
          <small>Supabase 실시간 데이터</small>
        </div></div>
      </section>

      <section className="stat-grid">
        <article><span>화면 내 관심상품</span><strong>{stats.favorites}</strong></article>
        <article><span>화면 내 샘플 후보</span><strong>{stats.sampleCandidates}</strong></article>
        <article><span>화면 내 판매 승인</span><strong>{stats.approved}</strong></article>
      </section>

      <section className="ops-grid">
        <form className="panel" onSubmit={collectProducts}>
          <h2>도매꾹 신규 수집</h2>
          <div className="inline-fields">
            <input
              value={collectKeyword}
              onChange={(event) => setCollectKeyword(event.target.value)}
              placeholder="수집 키워드"
              disabled={collecting}
            />
            <select
              value={collectSize}
              onChange={(event) => setCollectSize(Number(event.target.value))}
              disabled={collecting}
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
            <button disabled={collecting}>
              {collecting ? "수집 중…" : "수집·저장"}
            </button>
          </div>
        </form>

        <form className="panel" onSubmit={searchStored}>
          <h2>저장 상품 필터</h2>
          <div className="inline-fields">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="상품명·키워드·상품번호"
            />
            <button>검색</button>
          </div>
        </form>
      </section>

      <section className="filter-bar">
        <select
          value={minimumScore}
          onChange={(event) => {
            setMinimumScore(Number(event.target.value));
            setPage(1);
          }}
        >
          <option value={0}>전체 점수</option>
          <option value={40}>40점 이상</option>
          <option value={50}>50점 이상</option>
          <option value={60}>60점 이상</option>
          <option value={70}>70점 이상</option>
        </select>

        <select
          value={reviewStatus}
          onChange={(event) => {
            setReviewStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as SortOption);
            setPage(1);
          }}
        >
          <option value="score">점수 높은 순</option>
          <option value="profit">이익 높은 순</option>
          <option value="margin">마진 높은 순</option>
          <option value="recent">최근 저장 순</option>
          <option value="price">공급가 낮은 순</option>
        </select>

        <label className="check-control">
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(event) => {
              setFavoriteOnly(event.target.checked);
              setPage(1);
            }}
          />
          관심상품만
        </label>

        <button className="secondary-button" onClick={resetFilters}>
          필터 초기화
        </button>
      </section>

      {message && <div className="notice success-notice">{message}</div>}
      {error && <div className="notice error-notice">{error}</div>}

      {loading ? (
        <section className="loading-panel">상품 데이터를 불러오는 중입니다.</section>
      ) : (
        <section className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="thumbnail-wrap">
                {product.thumbnail ? (
                  <img src={product.thumbnail} alt={product.title} className="thumbnail" />
                ) : (
                  <div className="thumbnail-placeholder">이미지 없음</div>
                )}
                <button
                  className={`favorite-button ${product.is_favorite ? "active" : ""}`}
                  onClick={() =>
                    void patchProduct(product, {
                      isFavorite: !product.is_favorite,
                    })
                  }
                  disabled={savingId === product.id}
                  aria-label="관심상품 전환"
                >
                  ★
                </button>
                <div className="score-badge">{product.basic_score}점</div>
              </div>

              <div className="product-content">
                <div className="product-meta">
                  <span>{product.keyword || "키워드 없음"}</span>
                  <span>#{product.product_no}</span>
                </div>

                <h2>{product.title}</h2>

                <div className="badge-row">
                  <span className={`status-badge status-${product.review_status}`}>
                    {STATUS_LABELS[product.review_status]}
                  </span>
                  <span className={`risk-badge risk-${product.risk_level}`}>
                    위험 {RISK_LABELS[product.risk_level]}
                  </span>
                </div>

                <dl className="price-grid">
                  <div><dt>공급가</dt><dd>{formatCurrency(product.supply_price)}</dd></div>
                  <div><dt>판매가</dt><dd>{formatCurrency(product.estimated_sale_price)}</dd></div>
                  <div><dt>예상이익</dt><dd>{formatCurrency(product.estimated_profit)}</dd></div>
                  <div><dt>마진율</dt><dd>{product.margin_rate}%</dd></div>
                </dl>

                <div className="card-actions">
                  <select
                    value={product.review_status}
                    onChange={(event) =>
                      void patchProduct(product, {
                        reviewStatus: event.target.value,
                      })
                    }
                    disabled={savingId === product.id}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>

                  <button className="secondary-button" onClick={() => setSelected(product)}>
                    상세 관리
                  </button>

                  <Link
                    className="button-link coupang-register-link"
                    href={createCoupangRegisterHref(product)}
                  >
                    쿠팡 등록
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <nav className="pagination">
        <button
          disabled={loading || page <= 1}
          onClick={() => setPage((current) => current - 1)}
        >
          이전
        </button>
        <span>{page} / {totalPages}</span>
        <button
          disabled={loading || page >= totalPages}
          onClick={() => setPage((current) => current + 1)}
        >
          다음
        </button>
      </nav>

      {selected && (
        <ProductModal
          product={selected}
          saving={savingId === selected.id}
          onClose={() => setSelected(null)}
          onSave={(patch) => patchProduct(selected, patch)}
        />
      )}
    </main>
  );
}

function ProductModal({
  product,
  saving,
  onClose,
  onSave,
}: {
  product: Product;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const [memo, setMemo] = useState(product.memo ?? "");
  const [manualSalePrice, setManualSalePrice] = useState(
    String(product.manual_sale_price ?? product.estimated_sale_price)
  );
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(product.risk_level);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(
    product.review_status
  );
  const [excludedReason, setExcludedReason] = useState(
    product.excluded_reason ?? ""
  );

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p>상품 #{product.product_no}</p>
            <h2>{product.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-grid">
          <label>
            검토 상태
            <select
              value={reviewStatus}
              onChange={(event) =>
                setReviewStatus(event.target.value as ReviewStatus)
              }
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            위험도
            <select
              value={riskLevel}
              onChange={(event) =>
                setRiskLevel(event.target.value as RiskLevel)
              }
            >
              {Object.entries(RISK_LABELS).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            수동 판매가
            <input
              type="number"
              min={0}
              step={100}
              value={manualSalePrice}
              onChange={(event) => setManualSalePrice(event.target.value)}
            />
          </label>

          <label className="full-width">
            운영 메모
            <textarea
              rows={5}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="공급처 확인, 샘플 주문 결과, 판매 아이디어 등을 기록하세요."
            />
          </label>

          {reviewStatus === "excluded" && (
            <label className="full-width">
              제외 사유
              <textarea
                rows={3}
                value={excludedReason}
                onChange={(event) => setExcludedReason(event.target.value)}
              />
            </label>
          )}
        </div>

        <div className="modal-actions">
          {product.product_url && (
            <a
              href={product.product_url.replace("http://", "https://")}
              target="_blank"
              rel="noreferrer"
              className="secondary-link"
            >
              도매꾹 원본 보기
            </a>
          )}
          <button className="secondary-button" onClick={onClose}>취소</button>
          <button
            onClick={async () => {
              const parsedSalePrice = Number(manualSalePrice);

              if (!Number.isFinite(parsedSalePrice) || parsedSalePrice < 0) {
                return;
              }

              const saved = await onSave({
                memo,
                manualSalePrice: parsedSalePrice,
                riskLevel,
                reviewStatus,
                excludedReason:
                  reviewStatus === "excluded" ? excludedReason : null,
              });

              if (saved) onClose();
            }}
            disabled={
              saving ||
              manualSalePrice.trim() === "" ||
              !Number.isFinite(Number(manualSalePrice)) ||
              Number(manualSalePrice) < 0
            }
          >
            {saving ? "저장 중…" : "변경사항 저장"}
          </button>
        </div>
      </section>
    </div>
  );
}
