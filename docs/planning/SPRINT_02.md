# Sprint 02 — Supplier and sourcing decision packet

## Goal and value

Convert an approved opportunity into a comparable supplier decision packet covering MOQ, lead time, landed cost, return allowance, reliability, and evidence freshness.

## Scope

- Supplier/quote comparison reads and data-quality warnings.
- Scenario calculation as pure, versioned logic.
- Human approval checklist and decision explanation.
- Adapter-free tests; no supplier purchase or procurement execution.

Non-goals: actual orders, credential changes, unapproved margin semantics, automatic supplier selection.

## Dependencies and surfaces

Requires Sprint 01 approved opportunity plus authoritative fee/logistics assumptions. API/UI use sourcing/procurement dashboards. Existing suppliers, quotes, sourcing decisions, mappings, and orders must be reconciled with migrations. Any calculation or schema change is high-risk/manual.

## Tickets / recommended PR order

1. S2-01 (S): field/evidence provenance and missing-data audit.
2. S2-02 (M): versioned pure landed-cost/MOQ scenario tests.
3. S2-03 (M): comparison read API with explicit incomplete state.
4. S2-04 (M): decision packet UI and approval checklist.
5. S2-05 (S): audit/correlation contract design for later high-risk PR.

## Done

Two or more quotes can be compared with transparent assumptions; stale/missing evidence blocks approval; calculations have boundary tests; no purchase occurs; owner approves financial assumptions; all delivery gates pass.
