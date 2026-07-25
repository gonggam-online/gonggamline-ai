# Testing guide

## Layers

- `npm test`: runtime policy, redaction, network classification, Supabase availability/degradation, and query-contract assertions.
- `npm run typecheck`: strict TypeScript contracts.
- `npm run lint`: Next/React/TypeScript static checks.
- `npm run build`: Next.js production compilation and route generation.
- `npm run test:e2e:local`: Chromium route, API, console, page-error, and failed-request validation against `npm run start`.

`tests/e2e/routes.ts` is the single route manifest: 15 pages, five revenue-critical pages, and two read-only health APIs. Add new public pages/APIs there when they become safe to smoke.

## Browser acceptance

Responses must be below 400, pages nonblank with a meaningful heading/landmark, and no unexpected console errors, page errors, failed requests, raw stacks, or unsafe details. Documented `available: false` states are allowed only where optional and recoverable.

## Failure reporting

Record the exact command, first relevant failure, external/DB/code classification, whether owner action is required, artifacts, and rerun command. Do not skip or weaken a test to obtain green status.
