# Technical debt register

| Priority | Problem / evidence | Risk | Revenue impact | Resolution / prerequisite | Size | Decision |
|---|---|---|---|---|---|---|
| 1 | Missing pre-003 schema baseline; `products` is referenced but not created | High | Blocks reproducible delivery and trustworthy product analysis | Recover authoritative SQL and compare live schema; owner-approved migration plan | M | Follow-up, manual |
| 2 | No automated deployed-schema compatibility gate | High | Preview may look empty and delay decisions | Read-only schema contract check using approved credentials and exact migration manifest | M | Follow-up |
| 3 | Broad `select("*")` across workflow/sourcing/runtime/OS | Normal | Drift and oversized payloads create outages/manual diagnosis | Replace domain-by-domain with constants and contract tests | M | Follow-up |
| 4 | No generated Supabase database types | Normal | Schema errors reach runtime and slow features | Generate only after baseline is authoritative; enforce in CI | M | Follow-up |
| 5 | Safe API E2E coverage limited to two endpoints | Normal | Revenue dashboards can regress unnoticed | Add read-only manifest and response-envelope assertions | S | Next sprint |
| 6 | Write-route integration tests are sparse | High | Approval/order/listing mistakes can create real cost | Test with injected adapters/fakes, idempotency keys, no production calls | L | Follow-up |
| 7 | Long/one-line routes and large services | Normal | Review speed and fault isolation suffer | Behavior-preserving extraction by bounded context | M | Follow-up |
| 8 | Idempotency/retry policy is mature only in runtime jobs | High | Duplicate collection, approval, procurement, or listing actions can cost money | Inventory mutation endpoints; add domain keys/state guards before automation | L | Backlog |
| 9 | Audit trail is fragmented across domain tables | High | Hard to prove who approved costly actions | Define common correlation/actor/evidence contract; schema change requires approval | L | Backlog |
| 10 | Root README is generic | Low | Onboarding and safe operation are slower | Replace with project-specific quickstart and links | XS | Immediate follow-up |
| 11 | Environment contract is only partially discoverable | Normal | Misconfiguration appears as unavailable data | Document every variable from adapters/workflows and validate by boundary | S | Follow-up |
| 12 | Collector/Coupang retry and rate-limit policies need explicit tests | High | External throttling/cost and unstable automation | Contract tests against adapters; bounded backoff and observability | M | Backlog |
| 13 | Migration usage/dead-column analysis is manual | Normal | Schema grows without confidence | Build static query/migration inventory, then confirm against telemetry | M | Backlog |
| 14 | Production smoke relies on a fixed public URL | Normal | Domain/deployment changes can invalidate checks | Owner-configured environment URL with verified deployment SHA | S | Follow-up |
| 15 | `npm ci` reports 3 high-severity dependency vulnerabilities in CI | High until triaged | Supply-chain exposure can threaten operations and customer trust | Run `npm audit`, identify direct/transitive packages, assess exploitability, and upgrade without `--force` in a focused PR | S–M | Immediate follow-up |

No dead code or unused database column is declared solely from static absence: runtime, SQL functions, external clients, and operational queries may consume it. Removal requires telemetry and a high-risk data review.
