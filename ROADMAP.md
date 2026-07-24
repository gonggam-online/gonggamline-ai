# Revenue roadmap

Scale: XS/S/M/L/XL describes implementation size, not calendar time. PR counts are planning ranges.

| Order | Capability | Current state / definition of done | Dependencies / risk / owner action | Size / PRs | Revenue and operations impact |
|---|---|---|---|---|---|
| 1 | Product keyword discovery | Market keywords/collectors exist; done when demand evidence and freshness are ranked | Data source access; external-cost risk; owner credentials | M / 2–3 | More qualified candidates, less research |
| 2 | Market collection | Jobs/snapshots exist; done with reliable scheduling, freshness, retry, provenance | Collector contracts/rate limits; high external risk | L / 3–4 | Repeatable evidence pipeline |
| 3 | Competition analysis | Product analysis exists; done with comparable price/review/seller evidence and confidence | Data quality; normal read/high write boundary | M / 2–3 | Faster go/no-go |
| 4 | Margin calculation | Sourcing decisions exist; done with fees, returns, logistics, tax assumptions versioned | Financial logic is high-risk; owner assumption approval | M / 2–3 | Prevents unprofitable launches |
| 5 | Candidate recommendation | Discovery recommendations exist; done with evidence, confidence, rejection reasons | 1–4; normal analysis | M / 2 | Focuses human review |
| 6 | AI decision | Decision runs exist; done with traceable policy and approval threshold | Evidence quality; high-risk if auto-action | M / 2–3 | Consistent selection |
| 7 | Supplier management | Suppliers/quotes exist; done with reliability and evidence freshness | Supplier data; normal reads/high purchases | M / 2–3 | Reduces sourcing time |
| 8 | MOQ/lead-time | Quote/procurement fields exist; done with working-capital and stockout scenarios | Supplier verification; high financial risk | M / 2 | Better cash use |
| 9 | Certification/regulation | Not evidenced as a dedicated module; done with category checklist and blocking approval | Owner/legal evidence; high compliance risk | L / 3 | Avoids listing suspension |
| 10 | Content generation | Listing drafts/revisions exist; done with evidence-linked title/keywords/detail copy | Approved product facts; normal draft | M / 2–3 | Shorter launch cycle |
| 11 | Thumbnail/detail assets | No dedicated asset pipeline evidenced; done with reviewable assets and rights metadata | Asset generation/storage; owner approval | L / 3 | Higher conversion |
| 12 | Listing draft | Implemented foundation; done with validation and revision audit | 6–11; normal draft | S / 1–2 | Ready-to-publish package |
| 13 | Approval workflow | Workflow/tasks/transitions exist; done with actor/evidence and immutable decisions | Auth/audit schema; high-risk | L / 3 | Human control at key gates |
| 14 | Coupang registration | Job/attempt foundation exists; done with sandbox/contract validation and idempotency | Coupang credentials/approval; high-risk manual | L / 3–4 | Removes listing labor |
| 15 | Inventory management | No complete operational module evidenced; done with reconciled source of truth | Marketplace/3PL APIs; high-risk | XL / 4–6 | Prevents oversell/stockout |
| 16 | Price management | Not evidenced as complete; done with guarded recommendations and approvals | Margin/inventory/competition; high-risk | L / 3–4 | Protects margin |
| 17 | Advertising decisions | Not evidenced as complete; done with contribution-margin thresholds | Ad data/cost approval; high-risk | L / 3 | Scalable acquisition |
| 18 | Sales/profit analysis | Revenue/profit snapshots exist; done with order-to-profit reconciliation | Orders/fees/returns; high-risk data | L / 3–4 | Measures real progress |
| 19 | Notifications | OS notifications exist; done with severity, owner, dedupe, recovery link | Reliable events; normal | S / 1–2 | Faster exception response |
| 20 | Automatic recovery | Runtime retry exists; done per domain with idempotency and poison-job handling | Audit/idempotency; high-risk for writes | L / 3 | Less manual babysitting |
| 21 | Audit log | Domain events exist; done with correlation, actor, before/after, evidence | Auth/schema; high-risk | L / 3 | Safe delegation and compliance |

Recommended sequence: trustworthy schema/data → keyword/market/competition/margin → recommendation/approval → supplier/MOQ/regulation → content/draft → guarded registration → inventory/price/ads → reconciled revenue → recovery/audit.
