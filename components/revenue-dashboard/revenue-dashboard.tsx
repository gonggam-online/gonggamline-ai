"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  RevenueDashboardDto,
  RevenueDashboardResponse,
} from "@/lib/revenue/dashboard";
import type { RevenueRecommendationLevel } from "@/lib/revenue/ranking";
import type { RevenueScoreStatus } from "@/lib/revenue/score";
import {
  buildDashboardPageUrl as buildPageUrl,
  INITIAL_FILTERS,
  parseDashboardLocation,
  type RevenueDashboardFilters,
  type RevenueDashboardLocation,
} from "@/lib/revenue/dashboard-ui-state";

export {
  INITIAL_FILTERS,
  parseDashboardLocation,
  type RevenueDashboardFilters,
  type RevenueDashboardLocation,
} from "@/lib/revenue/dashboard-ui-state";

export const PAGE_SIZE = 20;

type DashboardErrorPayload = {
  error?: { message?: string };
};

export function buildDashboardUrl(
  filters: RevenueDashboardFilters,
  offset: number,
) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.recommendationLevel) {
    params.set("recommendationLevel", filters.recommendationLevel);
  }
  if (filters.status) params.set("status", filters.status);
  if (filters.minRevenueScore !== "") {
    params.set("minRevenueScore", filters.minRevenueScore);
  }
  return `/api/dashboard/revenue?${params.toString()}`;
}

export function buildDashboardPageUrl(
  filters: RevenueDashboardFilters,
  offset: number,
) {
  return buildPageUrl(filters, offset, PAGE_SIZE);
}

export function summarize(items: readonly RevenueDashboardDto[]) {
  const scored = items.filter((item) => item.revenueScore !== null);
  const averageRevenueScore = scored.length
    ? scored.reduce((total, item) => total + (item.revenueScore ?? 0), 0)
      / scored.length
    : null;
  const averageConfidence = items.length
    ? items.reduce((total, item) => total + item.confidence, 0) / items.length
    : null;
  return {
    strongRecommend: items.filter(
      (item) => item.recommendationLevel === "STRONG_RECOMMEND",
    ).length,
    averageRevenueScore,
    averageConfidence,
  };
}

const recommendationLabels: Record<RevenueRecommendationLevel, string> = {
  STRONG_RECOMMEND: "Strong Recommend",
  RECOMMEND: "Recommend",
  WATCH: "Watch",
  NOT_RECOMMENDED: "Not Recommended",
};

const statusLabels: Record<RevenueScoreStatus, string> = {
  ready: "Ready",
  estimated: "Estimated",
  incomplete: "Incomplete",
  invalid: "Invalid",
};

export function formatScore(value: number | null) {
  return value === null ? "—" : value.toFixed(1);
}

export function formatConfidence(value: number) {
  return `${value.toFixed(0)}%`;
}

export function formatAnalyzedAt(value: string | null) {
  if (!value) return "Not analyzed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not analyzed";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function describeActiveFilters(filters: RevenueDashboardFilters) {
  const descriptions: string[] = [];
  if (filters.keyword) descriptions.push(`Search: ${filters.keyword}`);
  if (filters.recommendationLevel) {
    descriptions.push(
      `Recommendation: ${recommendationLabels[filters.recommendationLevel]}`,
    );
  }
  if (filters.status) descriptions.push(`Status: ${statusLabels[filters.status]}`);
  if (filters.minRevenueScore) {
    descriptions.push(`Minimum score: ${filters.minRevenueScore}`);
  }
  return descriptions;
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: string;
}) {
  return <span className={`revenue-dashboard__badge revenue-dashboard__badge--${tone}`}>{children}</span>;
}

export function RevenueDashboardSummary({
  data,
}: {
  data: RevenueDashboardResponse;
}) {
  const summary = summarize(data.items);
  const cards = [
    ["Total Products", String(data.meta.totalProducts), "All ranked products"],
    ["Strong Recommend", String(summary.strongRecommend), "Current results"],
    [
      "Average Revenue Score",
      formatScore(summary.averageRevenueScore),
      "Current scored results",
    ],
    [
      "Average Confidence",
      summary.averageConfidence === null
        ? "—"
        : formatConfidence(summary.averageConfidence),
      "Current results",
    ],
  ];
  return (
    <section className="revenue-dashboard__summary" aria-label="Revenue summary">
      {cards.map(([label, value, detail]) => (
        <DashboardCard key={label}>
          <p className="revenue-dashboard__metric-label">{label}</p>
          <strong className="revenue-dashboard__metric-value">{value}</strong>
          <span className="revenue-dashboard__metric-detail">{detail}</span>
        </DashboardCard>
      ))}
    </section>
  );
}

export function RevenueDashboardTable({
  items,
}: {
  items: readonly RevenueDashboardDto[];
}) {
  return (
    <div className="revenue-dashboard__table-scroll">
      <table className="revenue-dashboard__table">
        <caption className="dashboard-foundation__sr-only">
          Products ordered by revenue ranking
        </caption>
        <thead>
          <tr>
            {[
              "Rank",
              "Product Name",
              "Revenue Score",
              "Ranking Score",
              "Recommendation Level",
              "Confidence",
              "Reason Codes",
              "Status",
              "Last Analyzed",
            ].map((heading) => <th scope="col" key={heading}>{heading}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.productId ?? "unknown"}-${item.rank}`}>
              <td><strong>#{item.rank}</strong></td>
              <td>
                <span
                  className="revenue-dashboard__product-name"
                  title={item.productName ?? "Unnamed product"}
                >
                  {item.productName ?? "Unnamed product"}
                </span>
                {item.productId ? <small>{item.productId}</small> : null}
              </td>
              <td>{formatScore(item.revenueScore)}</td>
              <td>{formatScore(item.rankingScore)}</td>
              <td>
                <Badge tone={item.recommendationLevel.toLowerCase()}>
                  {recommendationLabels[item.recommendationLevel]}
                </Badge>
              </td>
              <td>{formatConfidence(item.confidence)}</td>
              <td>
                <div className="revenue-dashboard__reasons">
                  {item.reasonCodes.length
                    ? item.reasonCodes.map((code) => (
                      <Badge tone="reason" key={code}>{code}</Badge>
                    ))
                    : <span>—</span>}
                </div>
              </td>
              <td>
                <Badge tone={item.status}>{statusLabels[item.status]}</Badge>
              </td>
              <td><time dateTime={item.lastAnalyzedAt ?? undefined}>{formatAnalyzedAt(item.lastAnalyzedAt)}</time></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RevenueDashboard({
  initialLocation = { filters: INITIAL_FILTERS, offset: 0 },
}: {
  initialLocation?: RevenueDashboardLocation;
}) {
  const [filters, setFilters] = useState(initialLocation.filters);
  const [draftKeyword, setDraftKeyword] = useState(initialLocation.filters.keyword);
  const [offset, setOffset] = useState(initialLocation.offset);
  const [data, setData] = useState<RevenueDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const skippedInitialUrlSync = useRef(false);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(buildDashboardUrl(filters, offset), {
        cache: "no-store",
        signal,
      });
      const payload = await response.json() as RevenueDashboardResponse | DashboardErrorPayload;
      if (!response.ok) {
        const message = "error" in payload ? payload.error?.message : undefined;
        throw new Error(message || "Revenue dashboard data is unavailable");
      }
      setData(payload as RevenueDashboardResponse);
      setLastRefreshedAt(new Date());
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error
        ? caught.message
        : "Revenue dashboard data is unavailable");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshToken]);

  useEffect(() => {
    if (!skippedInitialUrlSync.current) {
      skippedInitialUrlSync.current = true;
      return;
    }
    window.history.replaceState(
      null,
      "",
      buildDashboardPageUrl(filters, offset),
    );
  }, [filters, offset]);

  useEffect(() => {
    function restoreFromUrl() {
      const restored = parseDashboardLocation(
        new URLSearchParams(window.location.search),
      );
      setFilters(restored.filters);
      setDraftKeyword(restored.filters.keyword);
      setOffset(restored.offset);
    }
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, []);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = data ? Math.max(1, Math.ceil(data.pagination.total / PAGE_SIZE)) : 1;
  const generatedAt = useMemo(
    () => data ? formatAnalyzedAt(data.meta.generatedAt) : "",
    [data],
  );
  const refreshedAt = lastRefreshedAt
    ? new Intl.DateTimeFormat("en", { timeStyle: "medium" }).format(lastRefreshedAt)
    : "";
  const activeFilters = describeActiveFilters(filters);

  function updateFilter<Key extends keyof RevenueDashboardFilters>(
    key: Key,
    value: RevenueDashboardFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setOffset(0);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter("keyword", draftKeyword.trim().slice(0, 100));
  }

  function clearSearch() {
    setDraftKeyword("");
    updateFilter("keyword", "");
  }

  function clearAllFilters() {
    setDraftKeyword("");
    setFilters(INITIAL_FILTERS);
    setOffset(0);
  }

  return (
    <DashboardLayout className="revenue-dashboard">
      <DashboardHeader
        title="7-1. 상품 성과 Revenue Dashboard"
        titleId="revenue-dashboard-title"
        eyebrow="ENGINE 7-1 · PERFORMANCE DASHBOARD"
        description="상품별 수익성, Revenue Score, 순위와 분석 상태를 조회합니다."
        actions={data ? (
          <div className="revenue-dashboard__timestamps">
            <span>Data generated <time dateTime={data.meta.generatedAt}>{generatedAt}</time></span>
            {lastRefreshedAt ? (
              <span>Last refreshed <time dateTime={lastRefreshedAt.toISOString()}>{refreshedAt}</time></span>
            ) : null}
          </div>
        ) : null}
      />
      <DashboardContent>
        <DashboardToolbar
          label="Revenue dashboard filters"
          className="revenue-dashboard__toolbar"
        >
          <form className="revenue-dashboard__search" role="search" onSubmit={submitSearch}>
            <label>
              Product Search
              <input
                aria-label="Search products by name"
                type="search"
                maxLength={100}
                value={draftKeyword}
                onChange={(event) => setDraftKeyword(event.target.value)}
                placeholder="Product name"
              />
            </label>
            <button className="revenue-dashboard__button" type="submit" disabled={loading}>
              Search
            </button>
            {filters.keyword || draftKeyword ? (
              <button
                className="revenue-dashboard__button revenue-dashboard__button--secondary"
                type="button"
                onClick={clearSearch}
                disabled={loading}
              >
                Clear search
              </button>
            ) : null}
          </form>
          <label>
            Recommendation Level
            <select
              aria-label="Recommendation Level Filter"
              value={filters.recommendationLevel}
              onChange={(event) => updateFilter(
                "recommendationLevel",
                event.target.value as RevenueDashboardFilters["recommendationLevel"],
              )}
            >
              <option value="">All levels</option>
              {Object.entries(recommendationLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Status Filter"
              value={filters.status}
              onChange={(event) => updateFilter(
                "status",
                event.target.value as RevenueDashboardFilters["status"],
              )}
            >
              <option value="">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Minimum Revenue Score
            <input
              aria-label="Minimum Revenue Score"
              type="number"
              min="0"
              max="100"
              step="1"
              value={filters.minRevenueScore}
              onChange={(event) => updateFilter("minRevenueScore", event.target.value)}
              placeholder="0–100"
            />
          </label>
          <button
            className="revenue-dashboard__button"
            type="button"
            onClick={() => setRefreshToken((token) => token + 1)}
            disabled={loading}
            aria-label="Refresh revenue dashboard"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="revenue-dashboard__button revenue-dashboard__button--secondary"
            type="button"
            onClick={clearAllFilters}
            disabled={loading || activeFilters.length === 0}
          >
            Clear all filters
          </button>
          <div
            className="revenue-dashboard__active-filters"
            role="status"
            aria-live="polite"
            aria-label="Active filters"
          >
            <strong>{activeFilters.length ? `${activeFilters.length} active` : "No active filters"}</strong>
            {activeFilters.map((description) => (
              <span key={description}>{description}</span>
            ))}
          </div>
        </DashboardToolbar>

        {loading && !data ? (
          <DashboardLoading label="Loading revenue dashboard" rows={7} />
        ) : error ? (
          <DashboardErrorState
            title="Revenue dashboard unavailable"
            description={error}
            action={<button className="revenue-dashboard__button" type="button" onClick={() => setRefreshToken((token) => token + 1)}>Try again</button>}
          />
        ) : data ? (
          <>
            <RevenueDashboardSummary data={data} />
            <DashboardSection
              title="Ranked Products"
              headingId="revenue-ranked-products"
              description={`${data.pagination.total.toLocaleString()} matching products · ranking descending`}
            >
              {data.items.length ? (
                <>
                  <RevenueDashboardTable items={data.items} />
                  <nav className="revenue-dashboard__pagination" aria-label="Revenue results pagination">
                    <button type="button" disabled={offset === 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>Previous</button>
                    <span aria-live="polite">Page {page} of {pageCount}</span>
                    <button type="button" disabled={!data.pagination.hasMore || loading} onClick={() => setOffset((value) => value + PAGE_SIZE)}>Next</button>
                  </nav>
                </>
              ) : (
                <DashboardEmptyState
                  title="No ranked products"
                  description="No products match the current filters. Adjust a filter or refresh the dashboard."
                  action={<button className="revenue-dashboard__button revenue-dashboard__button--secondary" type="button" onClick={() => { setFilters(INITIAL_FILTERS); setOffset(0); }}>Clear filters</button>}
                />
              )}
            </DashboardSection>
          </>
        ) : null}
      </DashboardContent>
    </DashboardLayout>
  );
}
