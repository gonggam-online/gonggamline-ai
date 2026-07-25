# Revenue Dashboard UI

## Purpose

`/dashboard/revenue` is the read-only operating view for comparing ranked
Products and finding the next strongest revenue candidates. It consumes only
`GET /api/dashboard/revenue`; it does not call Revenue Calculation, Score, or
Ranking directly and does not introduce another DTO or API.

## Component tree

```text
app/dashboard/revenue/page.tsx
└── RevenueDashboard (client boundary and local UI state)
    ├── DashboardHeader
    └── DashboardContent
        ├── DashboardToolbar
        ├── DashboardLoading | DashboardErrorState
        ├── RevenueDashboardSummary
        │   └── DashboardCard × 4
        └── DashboardSection
            ├── RevenueDashboardTable | DashboardEmptyState
            └── local Previous / Next pagination
```

The Sprint 3 Dashboard Foundation remains presentation-only. The domain view
owns only the components required by this page: summary and ranking table.

## Data flow

1. Local React state holds submitted Product keyword, recommendation, status,
   minimum score, and offset.
2. The client builds a query for `/api/dashboard/revenue` with a page size of
   20 and fetches it once on entry or after an operator interaction.
3. The API response is rendered without modifying rank, scores,
   recommendation, confidence, reason codes, status, or timestamps.
4. Search submission and filter changes reset offset to zero. Refresh and
   pagination retain all active state. The URL query string is the shareable
   persistence boundary and is restored on initial load and browser history.
5. Product search runs through the existing Product query before Ranking
   pagination. The UI never filters only the returned page.
6. An `AbortController` cancels superseded requests.
7. Total Products uses `meta.totalProducts`. Strong Recommend and averages are
   presentation summaries of the returned result page and are visibly labeled
   `Current results`; they are not stored or treated as business metrics.

## States and accessibility

- Loading uses a polite status region and a stable skeleton.
- Errors use an assertive alert with a retry action.
- Empty results provide a clear-filters action.
- Data generation time comes from API `meta.generatedAt`; the separate last
  refreshed time records the successful browser fetch. Neither replaces a
  Product's nullable `lastAnalyzedAt`.
- Active filters are announced in a polite status region and can be cleared
  together. Refresh and clear actions are disabled while a request is active.
- Native labels, controls, table headings, caption, time elements, focus
  outlines, and keyboard-operable buttons are used.
- The wide operational table scrolls horizontally on narrow screens; summary
  cards collapse from four to two to one column.
- Long Product names use a visible ellipsis with the full value in `title`;
  reason badges wrap inside a bounded cell without widening the page.

## Runtime boundary

The page is read-only. It changes no API contract, database object, migration,
Revenue engine, Queue, Worker, OpenAI/LLM behavior, marketplace data, price,
inventory, order, fulfillment, or settlement state.
