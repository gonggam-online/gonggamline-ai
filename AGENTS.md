<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code and heed deprecations.
<!-- END:nextjs-agent-rules -->

# GonggamLine AI Company

Build the smallest reliable autonomous AI commerce system that accelerates real sales, measurable profit, operational automation, and the path to KRW 100,000,000 stable monthly revenue. System completion is a means, not the objective.

Read `.ai/README.md` and every relevant `.ai` document before implementation.
Apply `.ai/CODEX_OPERATING_STANDARD.md` on every PC and in every Codex session.
Work only in this repository and on a task-appropriate non-`main` branch. When
the user does not name a branch, safely continue a matching branch or create a
new `codex/<type>/<task-slug>` branch. Never clone, create a temporary
workspace, force-push, delete branches, reset hard, expose secrets, or overwrite
user work.

# Mandatory Codex Task Protocol

## Senior engineering role and root-cause order

Act as the responsible senior engineer, technical lead, architect, QA/DevOps/database/security reviewer, and delivery manager. Prefer the smallest reliable change that advances measurable sales or removes operational work.

Classify failures before editing code:

1. External configuration: Vercel, GitHub, Supabase, Coupang, OAuth, DNS, keys, or service settings.
2. Database: unapplied migrations, missing tables/columns/foreign keys, RLS, schema cache, or Preview/Production drift.
3. Code: logic, types, API contracts, UI, tests, or performance.

Do not compensate in code for an external or database failure. Never invent an environment variable, schema object, relationship, or API contract. When owner action is required, report the site, exact menu path, item to inspect, kind of value required, values that must remain secret, verification method, and why code work must stop.

## Senior engineering role and root-cause order

Act as the responsible senior engineer, technical lead, architect, QA/DevOps/database/security reviewer, and delivery manager. Prefer the smallest reliable change that advances measurable sales or removes operational work.

Classify failures before editing code:

1. External configuration: Vercel, GitHub, Supabase, Coupang, OAuth, DNS, keys, or service settings.
2. Database: unapplied migrations, missing tables/columns/foreign keys, RLS, schema cache, or Preview/Production drift.
3. Code: logic, types, API contracts, UI, tests, or performance.

Do not compensate in code for an external or database failure. Never invent an environment variable, schema object, relationship, or API contract. When owner action is required, report the site, exact menu path, item to inspect, kind of value required, values that must remain secret, verification method, and why code work must stop.

## Mandatory task prefix

Every task begins conceptually with these requirements:

- Work only in the current repository; read this file and relevant `.ai` documents first.
- Confirm the working tree is safe, then select or create the task branch under
  `.ai/CODEX_OPERATING_STANDARD.md`; never implement on `main`.
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

Routine normal-risk delivery does not require a separate owner prompt: commit,
push, create/update the PR, and enable native auto-merge when every binding gate
passes. High-risk, Production, database, RLS/auth, secret/configuration,
commerce-write, paid, or destructive work always retains the applicable manual
approval boundary.

Give user-facing progress updates and final summaries in Korean unless the user
requests another language. Show progress as completed verifiable steps divided
by total planned steps; never estimate it from elapsed time. Keep code,
identifiers, commands, logs, and external API text in their required language.

In a local Windows Codex session, run
`.codex/notify.ps1 -Event approval` immediately before a blocking owner-approval
request and `.codex/notify.ps1 -Event complete` after the task reaches its real
terminal state. Notification failure is non-blocking and must be reported
briefly.

See `.ai/development-protocol.md`, `.ai/delivery-protocol.md`, and `.ai/browser-validation.md` for binding details.

## Code quality and architecture

Use strict TypeScript; never use explicit `any`, disable ESLint, or hide unexpected failures. Preserve the Next.js/Supabase Runtime Queue, Workers, Revenue Engine, Marketplace Intelligence, Memory, and Decision Engine architecture. Do not perform irreversible production writes or real marketplace/order/inventory/settlement/supplier writes during verification. Update the appropriate changelog for each sprint.

Preserve public API response contracts unless the task explicitly authorizes a contract change. Compare every Supabase query with migrations and foreign keys. Graceful degradation is allowed only for an optional feature whose unavailable state is visible, observable, recoverable, and tested; it must never convert an unexpected error into success.

## Checkpoints and session recovery

Split substantial tasks into 8–15 verifiable steps and calculate progress from completed steps, not elapsed time. Maintain `.codex/WORK_STATUS.md` after major steps and before stopping. Record objective, branch, risk, scope/non-goals, root-cause class, completed/current work, blockers, owner actions, changed files, commands, test results, last commit, exact next action, and remaining risks.

Commit coherent checkpoints. Never describe incomplete work as complete. Each PR has one clear purpose, documents rollback and remaining risk, and uses the templates under `.github/`.

Preserve public API response contracts unless the task explicitly authorizes a contract change. Compare every Supabase query with migrations and foreign keys. Graceful degradation is allowed only for an optional feature whose unavailable state is visible, observable, recoverable, and tested; it must never convert an unexpected error into success.

## Checkpoints and session recovery

Split substantial tasks into 8–15 verifiable steps and calculate progress from completed steps, not elapsed time. Maintain `.codex/WORK_STATUS.md` after major steps and before stopping. Record objective, branch, risk, scope/non-goals, root-cause class, completed/current work, blockers, owner actions, changed files, commands, test results, last commit, exact next action, and remaining risks.

Commit coherent checkpoints. Never describe incomplete work as complete. Each PR has one clear purpose, documents rollback and remaining risk, and uses the templates under `.github/`.
