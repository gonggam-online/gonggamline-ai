import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
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
  Pagination,
} from "../components/dashboard/dashboard";

const render = (node: React.ReactNode) => renderToStaticMarkup(node);

test("DashboardLayout renders a semantic main landmark", () => {
  const html = render(<DashboardLayout>Content</DashboardLayout>);
  assert.match(html, /^<main/);
  assert.match(html, />Content<\/main>$/);
});

test("DashboardLayout forwards HTML props and custom classes", () => {
  const html = render(
    <DashboardLayout id="overview" className="custom">
      Content
    </DashboardLayout>,
  );
  assert.match(html, /class="dashboard-foundation custom"/);
  assert.match(html, /id="overview"/);
});

test("DashboardHeader renders title, eyebrow, and description props", () => {
  const html = render(
    <DashboardHeader
      title="Products"
      eyebrow="Operations"
      description="Review product health."
    />,
  );
  assert.match(html, /<h1>Products<\/h1>/);
  assert.match(html, />Operations<\/p>/);
  assert.match(html, />Review product health\.<\/p>/);
});

test("DashboardHeader links its landmark to the title", () => {
  const html = render(<DashboardHeader title="Revenue" titleId="revenue-title" />);
  assert.match(html, /aria-labelledby="revenue-title"/);
  assert.match(html, /<h1 id="revenue-title">Revenue<\/h1>/);
});

test("DashboardHeader renders injected actions", () => {
  const html = render(
    <DashboardHeader title="Queue" actions={<button type="button">Refresh</button>} />,
  );
  assert.match(html, /<button type="button">Refresh<\/button>/);
});

test("DashboardContent renders arbitrary content", () => {
  const html = render(
    <DashboardContent>
      <table aria-label="Results" />
    </DashboardContent>,
  );
  assert.match(html, /<table aria-label="Results"><\/table>/);
});

test("DashboardToolbar has a default accessible label", () => {
  const html = render(
    <DashboardToolbar>
      <input aria-label="Search" />
    </DashboardToolbar>,
  );
  assert.match(html, /aria-label="Dashboard filters and actions"/);
});

test("DashboardToolbar accepts a domain-specific label", () => {
  const html = render(
    <DashboardToolbar label="Product filters">
      <span>Filters</span>
    </DashboardToolbar>,
  );
  assert.match(html, /aria-label="Product filters"/);
});

test("DashboardSection requires and uses a heading relationship", () => {
  const html = render(
    <DashboardSection title="Recent uploads" headingId="recent-uploads">
      Rows
    </DashboardSection>,
  );
  assert.match(html, /aria-labelledby="recent-uploads"/);
  assert.match(html, /<h2 id="recent-uploads">Recent uploads<\/h2>/);
});

test("DashboardSection renders description and actions", () => {
  const html = render(
    <DashboardSection
      title="Recommendations"
      headingId="recommendations"
      description="Ranked opportunities"
      actions={<a href="/all">View all</a>}
    >
      Items
    </DashboardSection>,
  );
  assert.match(html, /Ranked opportunities/);
  assert.match(html, /href="\/all"/);
});

test("DashboardCard renders a plain content slot without a header", () => {
  const html = render(<DashboardCard>Metric</DashboardCard>);
  assert.doesNotMatch(html, /dashboard-foundation__card-header/);
  assert.match(html, />Metric<\/div><\/article>/);
});

test("DashboardCard renders title and description", () => {
  const html = render(
    <DashboardCard title="Conversion" description="Last 30 days">
      12%
    </DashboardCard>,
  );
  assert.match(html, /<h3>Conversion<\/h3>/);
  assert.match(html, /Last 30 days/);
});

test("DashboardCard exposes an optional heading relationship", () => {
  const html = render(
    <DashboardCard title="Profit" headingId="profit-card">
      Value
    </DashboardCard>,
  );
  assert.match(html, /aria-labelledby="profit-card"/);
  assert.match(html, /<h3 id="profit-card">Profit<\/h3>/);
});

test("DashboardEmptyState renders an optional action", () => {
  const html = render(
    <DashboardEmptyState
      title="No products"
      description="Adjust the filters."
      action={<a href="/products/new">Add product</a>}
    />,
  );
  assert.match(html, /No products/);
  assert.match(html, /Adjust the filters\./);
  assert.match(html, /Add product/);
});

test("DashboardEmptyState hides decorative icons from assistive technology", () => {
  const html = render(<DashboardEmptyState title="Empty" icon="○" />);
  assert.match(html, /aria-hidden="true">○<\/div>/);
});

test("DashboardErrorState announces errors assertively by default", () => {
  const html = render(
    <DashboardErrorState title="Could not load" description="Try again." />,
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /aria-live="assertive"/);
});

test("DashboardErrorState accepts a polite live-region mode", () => {
  const html = render(<DashboardErrorState title="Delayed" live="polite" />);
  assert.match(html, /aria-live="polite"/);
});

test("DashboardLoading exposes a status and readable label", () => {
  const html = render(<DashboardLoading label="Loading products" />);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-label="Loading products"/);
  assert.match(html, />Loading products<\/span>/);
});

test("DashboardLoading renders the requested skeleton rows", () => {
  const html = render(<DashboardLoading rows={5} />);
  assert.equal((html.match(/dashboard-foundation__loading-row/g) ?? []).length, 5);
});

test("DashboardLoading clamps row count to safe bounds", () => {
  const minimum = render(<DashboardLoading rows={0} />);
  const maximum = render(<DashboardLoading rows={99} />);
  assert.equal((minimum.match(/dashboard-foundation__loading-row/g) ?? []).length, 1);
  assert.equal((maximum.match(/dashboard-foundation__loading-row/g) ?? []).length, 10);
});

test("Pagination renders a labelled navigation landmark", () => {
  const html = render(<Pagination label="Product pages" items={[]} />);
  assert.match(html, /^<nav/);
  assert.match(html, /aria-label="Product pages"/);
});

test("Pagination marks the active page", () => {
  const html = render(
    <Pagination
      items={[{ href: "?page=2", label: "Page 2", page: 2, current: true }]}
    />,
  );
  assert.match(html, /aria-current="page"/);
  assert.match(html, /aria-label="Page 2"/);
});

test("Pagination exposes rel navigation for keyboard-accessible links", () => {
  const html = render(
    <Pagination
      previousHref="?page=1"
      nextHref="?page=3"
      items={[{ href: "?page=2", label: "Page 2", page: 2, current: true }]}
    />,
  );
  assert.match(html, /rel="prev" href="\?page=1"/);
  assert.match(html, /rel="next" href="\?page=3"/);
});

test("Pagination renders unavailable controls as disabled text", () => {
  const html = render(<Pagination items={[]} />);
  assert.equal((html.match(/aria-disabled="true"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /rel="prev"|rel="next"/);
});

test("all foundation components remain presentation-only", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(
      new URL("../components/dashboard/dashboard.tsx", import.meta.url),
      "utf8",
    ),
  );
  assert.doesNotMatch(source, /useState|useEffect|createContext|fetch\(/);
  assert.doesNotMatch(source, /redux|zustand/i);
});
