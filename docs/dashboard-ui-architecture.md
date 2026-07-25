# Dashboard UI Architecture

## Purpose

The Dashboard Foundation is a presentation-only composition layer shared by
Revenue Dashboard, Upload Queue, Product Dashboard, and AI Recommendation
surfaces. It standardizes layout, states, and navigation without owning data,
business rules, or application state.

## Component hierarchy

```text
DashboardLayout
├── DashboardHeader
└── DashboardContent
    ├── DashboardToolbar
    ├── DashboardSection
    │   └── DashboardCard | table/card slot
    ├── DashboardEmptyState | DashboardErrorState | DashboardLoading
    └── Pagination
```

Components are exported from `components/dashboard`. A page composes only the
pieces it needs; state components replace the normal section content rather
than adding a second competing status region.

## Component rules

1. Components receive content and configuration through typed props.
2. Components do not fetch, transform domain data, or import services and APIs.
3. Components do not create Context or global/client state.
4. Interactive controls are injected as semantic links, buttons, or form
   controls. Their behavior stays with the consuming feature.
5. `DashboardSection.headingId` is required so every section landmark has an
   accessible name. Header and card IDs are optional when their containers do
   not need an explicit landmark relationship.
6. Empty, error, and loading states expose distinct semantics: normal content,
   an assertive alert, and a polite status region.
7. Pagination uses native links so it works with the keyboard, supports
   progressive enhancement, and does not force the whole foundation into a
   Client Component.
8. Domain-specific tables, metrics, cards, filters, and API response types stay
   outside the Foundation.
9. Custom classes and native HTML attributes may be added, but shared
   Foundation class names and semantic elements remain intact.
10. Memoization is intentionally absent. These stateless components perform no
    expensive computation, so memoization would add comparison overhead without
    evidence of a rendering benefit.

## Responsive and accessibility behavior

- Desktop uses a constrained 1280 px content shell.
- Tablet stacks the header while retaining wrapping toolbar/actions.
- Mobile reduces spacing and stacks complex headers and pagination without
  removing content.
- Focusable behavior comes from native controls supplied by consumers.
- Loading animation honors `prefers-reduced-motion`.
- Decorative state icons are hidden from assistive technology.

## Runtime boundary

The Foundation has no API, Supabase, database, queue, worker, OpenAI, pricing,
order, inventory, or marketplace-write dependency. It can be rendered by
Server Components and can contain Client Components passed as children.
