# Development guide

## Prerequisites and commands

- Node.js 22 or newer (`package.json`); CI currently uses Node 24.
- Install: `npm ci`
- Develop: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit/integration: `npm test`
- Production build: `npm run build`
- Local browser validation after build: `npm run test:e2e:local`

## Required workflow

1. Read `AGENTS.md`, `.ai/README.md`, and relevant `.ai` documents.
2. Confirm a clean non-`main` branch and classify risk.
3. Update `.codex/WORK_STATUS.md`; trace route → service → query → migration → UI.
4. Read the relevant guide under `node_modules/next/dist/docs/` before Next.js code changes.
5. Preserve API contracts and implement the smallest reliable change.
6. Test success, expected unavailability, and unexpected failure paths.
7. Review the full diff, update the appropriate changelog, run every gate, then commit/push/Draft PR.

## Conventions

Use strict TypeScript and repository aliases (`@/*`). Never add explicit `any`, disable checks, skip failures, invent schema/configuration, or hide unexpected errors. Keep write routes visibly separate from read paths. Record owner-only configuration work using `.codex/USER_ACTION_TEMPLATE.md`.
