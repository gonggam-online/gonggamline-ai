import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  RevenueDashboardDto,
  RevenueDashboardResponse,
} from "../lib/revenue/dashboard";
import {
  buildDashboardUrl,
  buildDashboardPageUrl,
  formatAnalyzedAt,
  formatConfidence,
  formatScore,
  INITIAL_FILTERS,
  PAGE_SIZE,
  parseDashboardLocation,
  RevenueDashboard,
  RevenueDashboardSummary,
  RevenueDashboardTable,
  summarize,
} from "../components/revenue-dashboard/revenue-dashboard";

const item: RevenueDashboardDto = {
  rank: 1,
  productId: "P-1",
  productName: "High margin product",
  rankingScore: 94.25,
  revenueScore: 91.5,
  recommendationLevel: "STRONG_RECOMMEND",
  confidence: 88.4,
  reasonCodes: ["HIGH_MARGIN", "HIGH_DEMAND"],
  status: "ready",
  lastAnalyzedAt: "2026-07-25T03:00:00.000Z",
};

const response: RevenueDashboardResponse = {
  items: [item],
  pagination: {
    limit: 20,
    offset: 0,
    total: 1,
    returned: 1,
    hasMore: false,
  },
  filters: {
    recommendationLevel: null,
    status: null,
    minRevenueScore: null,
  },
  meta: {
    generatedAt: "2026-07-25T03:00:00.000Z",
    engineVersion: null,
    rankingVersion: null,
    totalProducts: 12,
  },
};

const render = (node: React.ReactNode) => renderToStaticMarkup(node);

test("uses the API page-size contract", () => assert.equal(PAGE_SIZE, 20));
test("starts with empty local filters", () => assert.deepEqual(INITIAL_FILTERS, {
  keyword: "",
  recommendationLevel: "",
  status: "",
  minRevenueScore: "",
}));
test("builds the default API URL", () => {
  assert.equal(buildDashboardUrl(INITIAL_FILTERS, 0), "/api/dashboard/revenue?limit=20&offset=0");
});
test("keeps the requested pagination offset", () => {
  assert.match(buildDashboardUrl(INITIAL_FILTERS, 40), /offset=40/);
});
test("serializes recommendation filter", () => {
  assert.match(buildDashboardUrl({ ...INITIAL_FILTERS, recommendationLevel: "RECOMMEND" }, 0), /recommendationLevel=RECOMMEND/);
});
test("serializes Product keyword search", () => {
  assert.match(buildDashboardUrl({ ...INITIAL_FILTERS, keyword: "Desk Lamp" }, 0), /keyword=Desk\+Lamp/);
});
test("serializes status filter", () => {
  assert.match(buildDashboardUrl({ ...INITIAL_FILTERS, status: "estimated" }, 0), /status=estimated/);
});
test("serializes minimum score filter", () => {
  assert.match(buildDashboardUrl({ ...INITIAL_FILTERS, minRevenueScore: "70" }, 0), /minRevenueScore=70/);
});
test("does not send empty optional filters", () => {
  assert.doesNotMatch(buildDashboardUrl(INITIAL_FILTERS, 0), /keyword|recommendationLevel|status|minRevenueScore/);
});
test("builds a shareable Dashboard page URL", () => {
  assert.equal(
    buildDashboardPageUrl({ ...INITIAL_FILTERS, keyword: "Desk Lamp", status: "ready" }, 20),
    "/dashboard/revenue?limit=20&offset=20&keyword=Desk+Lamp&status=ready",
  );
});
test("restores search, filters, minimum score, and offset from URL", () => {
  assert.deepEqual(
    parseDashboardLocation(new URLSearchParams("keyword=Desk+Lamp&recommendationLevel=RECOMMEND&status=ready&minRevenueScore=70&offset=40")),
    {
      filters: {
        keyword: "Desk Lamp",
        recommendationLevel: "RECOMMEND",
        status: "ready",
        minRevenueScore: "70",
      },
      offset: 40,
    },
  );
});
test("ignores invalid shared URL values", () => {
  assert.deepEqual(
    parseDashboardLocation(new URLSearchParams("recommendationLevel=bad&status=bad&minRevenueScore=200&offset=-1")),
    { filters: INITIAL_FILTERS, offset: 0 },
  );
});
test("summarizes strong recommendations from returned DTOs", () => {
  assert.equal(summarize([item]).strongRecommend, 1);
});
test("summarizes average revenue score", () => {
  assert.equal(summarize([item, { ...item, revenueScore: 81.5 }]).averageRevenueScore, 86.5);
});
test("excludes null revenue scores from the average", () => {
  assert.equal(summarize([item, { ...item, revenueScore: null }]).averageRevenueScore, 91.5);
});
test("returns null for an unavailable revenue average", () => {
  assert.equal(summarize([{ ...item, revenueScore: null }]).averageRevenueScore, null);
});
test("summarizes average confidence", () => {
  assert.equal(summarize([item, { ...item, confidence: 91.6 }]).averageConfidence, 90);
});
test("returns null confidence for empty results", () => {
  assert.equal(summarize([]).averageConfidence, null);
});
test("formats a numeric score to one decimal", () => assert.equal(formatScore(91), "91.0"));
test("formats a missing score as an em dash", () => assert.equal(formatScore(null), "—"));
test("formats confidence as a percentage", () => assert.equal(formatConfidence(88.4), "88%"));
test("formats a missing analysis timestamp safely", () => assert.equal(formatAnalyzedAt(null), "Not analyzed"));
test("formats an invalid analysis timestamp safely", () => assert.equal(formatAnalyzedAt("invalid"), "Not analyzed"));
test("summary renders all required card labels", () => {
  const html = render(<RevenueDashboardSummary data={response} />);
  for (const label of ["Total Products", "Strong Recommend", "Average Revenue Score", "Average Confidence"]) {
    assert.match(html, new RegExp(label));
  }
});
test("summary uses API metadata for total products", () => {
  assert.match(render(<RevenueDashboardSummary data={response} />), />12</);
});
test("summary identifies page-derived metrics as current results", () => {
  assert.match(render(<RevenueDashboardSummary data={response} />), /Current results/);
});
test("table renders all required columns", () => {
  const html = render(<RevenueDashboardTable items={[item]} />);
  for (const heading of ["Rank", "Product Name", "Revenue Score", "Ranking Score", "Recommendation Level", "Confidence", "Reason Codes", "Status", "Last Analyzed"]) {
    assert.match(html, new RegExp(heading));
  }
});
test("table renders product identity and descending rank", () => {
  const html = render(<RevenueDashboardTable items={[item]} />);
  assert.match(html, /#1/);
  assert.match(html, /High margin product/);
  assert.match(html, /P-1/);
});
test("table renders reason codes as badges", () => {
  const html = render(<RevenueDashboardTable items={[item]} />);
  assert.match(html, /revenue-dashboard__badge--reason[^>]*>HIGH_MARGIN/);
  assert.match(html, /HIGH_DEMAND/);
});
test("table renders recommendation and status labels", () => {
  const html = render(<RevenueDashboardTable items={[item]} />);
  assert.match(html, /Strong Recommend/);
  assert.match(html, />Ready</);
});
test("table handles missing product fields", () => {
  const html = render(<RevenueDashboardTable items={[{
    ...item,
    productId: null,
    productName: null,
    revenueScore: null,
    reasonCodes: [],
    lastAnalyzedAt: null,
  }]} />);
  assert.match(html, /Unnamed product/);
  assert.match(html, /Not analyzed/);
});
test("table has a semantic accessible caption", () => {
  assert.match(render(<RevenueDashboardTable items={[item]} />), /<caption[^>]*>Products ordered by revenue ranking<\/caption>/);
});
test("initial dashboard render exposes a meaningful loading state", () => {
  const html = render(<RevenueDashboard />);
  assert.match(html, /Revenue Dashboard/);
  assert.match(html, /role="status"/);
  assert.match(html, /Loading revenue dashboard/);
});
test("dashboard source uses only the approved API", async () => {
  const source = await readFile(
    new URL("../components/revenue-dashboard/revenue-dashboard.tsx", import.meta.url),
    "utf8",
  );
  const fetchTargets = [...source.matchAll(/fetch\(([^,)]+)/g)].map((match) => match[1]);
  assert.deepEqual(fetchTargets, ["buildDashboardUrl(filters"]);
  assert.doesNotMatch(source, /\/api\/(?!dashboard\/revenue)/);
});
test("dashboard state stays local and avoids global stores", async () => {
  const source = await readFile(
    new URL("../components/revenue-dashboard/revenue-dashboard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /useState/);
  assert.doesNotMatch(source, /redux|zustand|mobx|createContext/i);
});
