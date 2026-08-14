# Listing Content/Conversion pipeline compliance

## 2026-08-14 rights-policy amendment

The pipeline must interpret asset rights under [External Commerce Asset Discovery and Rights Policy v1.1](../architecture/EXTERNAL-COMMERCE-ASSET-DISCOVERY-AND-RIGHTS-POLICY-V1.1.md). Discovery/reference status is independent from exact original-use and operation-specific edit authority. `PUBLIC_REFERENCE_ONLY` content cannot enter a publication manifest; its presence does not block unrelated factual, title, keyword, story, or alternative-asset research. Runtime conformance is not claimed by this docs-only amendment and requires a separate approved implementation Story.

Observed and evaluated on 2026-08-13. This is the delivery evidence map for PR
#125, not a live WING approval. `PASS` means the generic offline contract and
its deterministic tests exist. KK946 remains an external adapter case and is
never embedded in production source.

| # | Status | Code and test evidence | UI/policy evidence | KK946 result / remaining action |
|---|---|---|---|---|
| 1. Generic pipeline | PASS | `shared/domain/listing-content.ts`; `generic non-KK fixture produces...`; recursive `production pipeline contains no product-specific...` | Generic review component | KK946 only under `tests/fixtures` |
| 2. Supplier trust | PASS | `approved-supplier-profiles.ts`, `supplier-trust.ts`; admission/freshness/reduction tests | Trust source/version/status shown | Five Domeggook catalog facts auto-admitted; rights kept separate |
| 3. Minimum gate | PASS | `ListingPipelineIssue.blockerClass`; five-class and fallback tests | Three issue lanes and minimum gate card | Blocked by exact category/required notice and live approval, not edit rights |
| 4. Image rights/assets | PASS | `ListingAssetManifestEntry`; unchanged/derivative negative tests | Role/shot/digest/dimensions/MIME/rights/transformation/alt/load shown | Original INCLUDED; crop DERIVATIVE_UNAVAILABLE warning |
| 5. Conversion objective | PASS | `QUALIFIED_CONVERSION_AND_ATTRIBUTABLE_PROFIT`; learning evaluator | Registration and conversion cards separate | Cold-start; no measured profit claim |
| 6. Evidence priority | PASS | `marketplace-policy.ts`; exact-source snapshot test; pattern-only market observation type | Priority, URL, date, scope, limit, version, digest shown | Official/research prior available; same-category observation still pending |
| 7. Title | PASS | intent mapping and deterministic two-strategy token ranker; prohibited-token negative test | Per-token rank/rationale/confidence/provenance | Two fixture candidates; actual selected title waits for exact adapter |
| 8. Keywords/filters | PASS | allowed-character/20×20 validation; two candidate sets; `searchFilters` mapper | Keyword field/rationale and candidates shown | Candidate set exists; exact category filter metadata pending |
| 9. Image strategy | PASS | main/additional/detail and shot taxonomy; 500 minimum/1000 recommendation/9 additional limits | Role and shot plan shown | Unchanged 1000×1000 original forms the minimum asset packet; richer shots pending rights/assets |
| 10. Mobile detail | PASS | rendered 780px HTML, evidence block hierarchy, omission behavior and eight review checks | Sandboxed iframe plus visual QA badges | Text package can render; actual adapter must bind the final private asset reference |
| 11. Candidate approval | PASS | two candidates; `selectedVariantId`; only selected title/searchTags map | Selected vs candidate and approval/live permission shown | Fixture content approval exists; live approval intentionally absent |
| 12. Learning loop | PARTIAL | append-only revision/metrics types; traffic/profit/cancellation/return evaluator | Sequential method and rollback shown | No actual metrics; persistence requires separate Database/Auth/RLS Story |
| 13. WING mapper | PASS | exact category attributes/notices/options/filters/assets/detail/commerce validation; legacy draft test | Registration blocker paths visible | External adapter simulation reaches READY; real exact category/notice packet absent |
| 14. Review UI | PARTIAL | `ListingContentReview`; route/E2E surface | All required review concepts represented | No durable packet reader by design until approved secure persistence exists |
| 15. KK946 acceptance | BLOCKED | four KK946 acceptance tests | Generic UI can display a supplied packet | Actual minimum packet is blocked by blocker classes 1, 4, and 5; edit rights only warn |
| 16. Delivery | PARTIAL | Lint 0 errors, typecheck, 598/598 tests, production build and Listing mobile E2E pass; all eleven exact-head checks pass | Preview passed 44, skipped 2, with no final page/API/console/non-abort request failure; artifact `9175201051` | Implementation/PR gates pass; high-risk merge and Production verification remain manual/post-merge |

## Current KK946 boundary

The current sanitized fixture preserves six units, KRW 4,290, free shipping,
no ad mutation, and no reorder. It proves that a verified Domeggook original
image with unknown edit rights can be used unchanged. It does not contain the
actual current WING display category, category metadata, complete notice
payload, private deployable asset URL, or live-write approval. Therefore no
exact title/keyword/filter/asset/detail/notice handoff and no WING-resume signal
may be issued from this PR alone.
