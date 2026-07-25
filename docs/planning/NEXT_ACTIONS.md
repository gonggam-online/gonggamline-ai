# Next actions

## Tomorrow morning: first task

**S1-01 — Revenue opportunity data readiness and contract inventory**

Start in `services/revenue-core.service.ts`, `app/api/revenue/opportunities/route.ts`, `app/revenue/page.tsx`, migrations 005–009 and 019, and `types/revenue.ts`.

Completion criteria:

- Every displayed/ranked field maps to a migration-backed column or explicitly derived pure value.
- Freshness and unavailable states are defined.
- No schema, financial semantic, or write change is made.
- A fixture-based contract test documents the current response.
- Findings update `PROJECT_AUDIT.md` and Sprint 01.

Recommended Codex prompt:

> Implement S1-01 from `docs/planning/SPRINT_01.md`. Read `AGENTS.md`, all relevant `.ai` documents, `.codex/WORK_STATUS.md`, `PROJECT_AUDIT.md`, and `DATABASE_GUIDE.md`. Work on a clean non-main branch. Trace revenue opportunity UI → API → service → Supabase query → migrations, produce a field/freshness/readiness inventory, and add non-mutating contract tests only. Do not create migrations, change margin semantics, call external services, or hide unavailable data. Run all mandatory gates and deliver a Draft PR with manual merge.

## Then

1. Resolve the pre-003 schema provenance blocker through an owner-led, separate high-risk task.
2. Implement the pure ranking policy only after field readiness and financial assumptions are approved.
3. Expand safe read-only API smoke coverage.
4. Build the evidence UI.
5. Begin the supplier evidence audit for Sprint 02.
