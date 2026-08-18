# Sprint 03 — Reviewable product content and guarded registration

## Goal and value

Generate a traceable listing draft package—title, keywords, copy, rendered
creative assets, and category attributes—then validate it without publishing.

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
7. S3-07 (Architecture, manual): generic rights-capability and creative-
   optimization lifecycle, managed artifact, provider, QA, approval, and
   learning boundaries.
8. S3-08 (M, after S3-07 merge): pure v3 creative contracts, candidate planner,
   deterministic fixture renderer, computed QA, selected-set mapper, and review
   UI using synthetic non-KK fixtures.
9. S3-09 (Architecture, high-risk, manual): managed Supabase private asset
   archive, Vercel Blob public CDN mirror, pinned OpenAI Image provider/model/
   terms, paid cap, server secrets, lifecycle, takedown, and recovery Story.
10. S3-10 (high-risk, manual, merged as PR #132): storage/CDN adapters,
    deterministic fake, immutable addressing, takedown, and restore boundary.
    Exact external configuration remains stopped on the recorded region,
    environment-scope, login, and billing gates.
11. S3-11 (high-risk, manual): provider adapter merged as PR #133. The next
    separately reviewable slice validates complete PNG bytes, archives the exact
    digest, binds human product-representation QA and canonical content approval,
    and admits only selected public references to the creative registration
    mapper. External storage/secret/paid/publication rollout remains stopped
    until its exact managed-service gates pass.
12. S3-12 (high-risk, manual): immutable Database/Auth/RLS jobs, approvals,
    rights dependencies, and append-only learning before unattended execution.
13. S3-13 (high-risk, rollout): Production-only Vercel Blob OIDC composition,
    authenticated Supabase private bucket and ICN1 public mirror rollout, and a
    synthetic restore drill before any product/provider execution.
14. S3-14 (high-risk, manual): materialize only explicitly selected admitted
    fact values into product-agnostic provider jobs, plan two fact-only creative
    candidates at supported GPT Image sizes, archive actual bytes before review,
    issue short-lived private review URLs, and require digest-valid human
    product-representation review before selection/publication. KK946 remains an
    acceptance adapter; supplier pixels and private WING fields are excluded.
15. S3-15 (Architecture, high-risk, manual): authorize the Production-only,
    two-phase authenticated operator dispatch. PREPARE is non-billable;
    AUTHORIZE_AND_DISPATCH requires fresh AAL2, purpose-bound CSRF, an immutable
    private authorization and whole-plan reservation, and stops at
    `REVIEW_REQUIRED`. No general-purpose generation route or same-request
    approval/publication/WING action is allowed.
16. S3-16 (high-risk, manual, after S3-15 merge): implement the protected
    operator routes, private manifest repository, review handoff UI, and
    fake-only CI/Preview coverage; after merge, execute one bounded Production
    fact-only revision to private review only.
17. S3-17 (high-risk, manual, after S3-16 merge): bind the completed
    marketplace registration result to the immutable packet/revision/content
    digests, then add append-only sales-learning ingestion and read-only
    monitoring. No automatic winner, duplicate listing, or marketplace write.

## Done

A reviewer can trace every claim, see validation failures, revise the draft, and approve readiness; tests prove no external call occurs in normal validation; all normal-risk gates pass; publishing remains disabled pending separate approval.
