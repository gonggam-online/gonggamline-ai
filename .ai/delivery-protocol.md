# Delivery protocol

Complete every applicable task through commit, push, and PR to `main`. The PR must describe summary, revenue impact, risk, components, tests, browser checks, migrations, security, and rollback.

Normal-risk work may use GitHub native auto-merge only after CI, exact-commit Vercel Preview, `preview-browser-e2e`, conflict checks, and up-to-date-branch checks pass. High-risk work receives `manual-merge-required` and is never auto-merged. This initial automation PR is manual.

After Preview is Ready, validate all manifest routes, APIs, console, page errors, and failed requests. Upload reports/traces/screenshots on failure. After merge and Production readiness, repeat non-destructive health/API/browser smoke checks.

Finish with the fields in `morning-report-template.md`, including branch, commits, push, PR, risk, merge, every validation result, routes, browser failures, evidence, blockers, revenue impact, and ordered next work.

This document expands the permanent Mandatory Codex Task Protocol in `AGENTS.md`.
