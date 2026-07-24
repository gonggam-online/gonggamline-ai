# Sprint 03 — Reviewable product content and guarded registration

## Goal and value

Generate a traceable listing draft package—title, keywords, copy, image brief, and category attributes—then validate it without publishing.

## Scope

- Content inputs tied to approved product/supplier evidence.
- Deterministic validation and revision history.
- Draft preview and approval readiness.
- Coupang request adapter contract/idempotency tests with fakes only.

Non-goals: real registration, automatic approval, Production credential change, asset-rights assumptions, inventory or price writes.

## Dependencies and surfaces

Requires approved Sprint 02 packet, category metadata, brand/certification evidence, and content policy. Uses listing drafts/revisions, workflow, Coupang registration jobs/attempts. Real registration remains high-risk and manual.

## Tickets / recommended PR order

1. S3-01 (S): content fact/schema and prohibited-claim checklist.
2. S3-02 (M): typed content-generation input/output contract and tests.
3. S3-03 (M): draft generation/revision service with no publish side effect.
4. S3-04 (M): preview, evidence, and approval-readiness UI.
5. S3-05 (M): fake Coupang adapter contract, idempotency, failure tests.
6. S3-06 (high-risk, manual): separately approved sandbox/real registration rollout.

## Done

A reviewer can trace every claim, see validation failures, revise the draft, and approve readiness; tests prove no external call occurs in normal validation; all normal-risk gates pass; publishing remains disabled pending separate approval.
