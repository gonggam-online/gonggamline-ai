<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code and heed deprecations.
<!-- END:nextjs-agent-rules -->

# GonggamLine AI Company

Build the smallest reliable autonomous AI commerce system that accelerates real sales, measurable profit, operational automation, and the path to KRW 100,000,000 stable monthly revenue. System completion is a means, not the objective.

Read `.ai/README.md` and every relevant `.ai` document before implementation. Work only in this repository and on the current non-`main` branch. Never clone, create a temporary workspace, force-push, delete branches, reset hard, expose secrets, or overwrite user work.

# Mandatory Codex Task Protocol

## Mandatory task prefix

Every task begins conceptually with these requirements:

- Work only in the current repository; read this file and relevant `.ai` documents first.
- Confirm the current branch is not `main` and the working tree is safe.
- Never create a temporary workspace, clone the repository, or modify/push `main` directly.
- Preserve functionality and never expose or commit secrets.
- Prioritize work that accelerates actual sales and profit; avoid over-engineering.
- Identify revenue impact, technical dependencies, and risk before implementation.
- Classify the task as normal-risk or high-risk using `.ai/risk-classification.md`.
- Continue without routine implementation questions; if one part is blocked, continue independent work.

## Mandatory task suffix

Every task ends with all applicable steps:

1. Review the complete diff.
2. Run lint, typecheck, available unit/integration tests, and production build.
3. Run browser tests against the completed application; fix code-caused failures and repeat.
4. Commit on the current non-main branch and push to origin.
5. Create or update a PR into `main`, classify its risk, and enable native auto-merge only when normal-risk and every gate passes.
6. Never auto-merge high-risk work; apply `manual-merge-required`.
7. Wait for the exact Vercel Preview, validate pages/APIs/console/page errors/failed requests with Playwright, and upload failure evidence.
8. After merge, wait for Production and run health/API/browser smoke checks.
9. Report branch, commits, push/PR/merge status, risk, lint/typecheck/tests/build, Preview and Production results, routes, console errors, failed requests, artifacts, blockers, revenue impact, and next highest-value tasks.

See `.ai/development-protocol.md`, `.ai/delivery-protocol.md`, and `.ai/browser-validation.md` for binding details.

## Code quality and architecture

Use strict TypeScript; never use explicit `any`, disable ESLint, or hide unexpected failures. Preserve the Next.js/Supabase Runtime Queue, Workers, Revenue Engine, Marketplace Intelligence, Memory, and Decision Engine architecture. Do not perform irreversible production writes or real marketplace/order/inventory/settlement/supplier writes during verification. Update the appropriate changelog for each sprint.
