# Revenue-first automation orchestrator architecture

Status: Accepted Architecture Story

Risk: high-risk/manual bootstrap, even though this change is documentation-only

Owner: repository owner / AI CTO; execution owner: Codex Autonomous Engineering Lead
Approval evidence: PR #41 merge
`a6894fce05480d9b599dcb9a03f9100c607b3fe6`; Phase 0 separately authorized
by the repository owner on 2026-07-28

## 1. Decision summary

Build the MVP as one restartable controller on the N (notebook) PC, backed by a
small local durable store, GitHub as the code/delivery source of truth, and
Codex App Server as the preferred execution interface. Keep a `codex exec`
adapter for the first vertical slice and recovery. Use GitHub Actions and
Vercel's existing GitHub Deployment records as evidence producers, not as the
central workflow engine. Do not add a cloud worker, Supabase orchestration
schema, or autonomous commerce write in the MVP.

The controller is a coordinator, not a replacement for repository governance.
Every task must pass `AGENTS.md`, `.ai/**`, Architecture, risk, approval, and
delivery gates. A model may propose the next task, but deterministic policy
validates and routes it.

## 2. Business objective and success measures

The system exists to shorten the loop from market evidence to a real,
profitable sale. It is not successful merely because it creates PRs.

Primary measures:

- lead time from verified external candidate to approved listing-ready package;
- operator minutes per candidate, PR, and verified release;
- percentage of candidates with complete cost, evidence, and profitability;
- Preview/CI first-pass rate and bounded recovery rate;
- actual impressions, clicks, orders, returns, settlement, and net profit;
- expected-versus-actual contribution profit and policy calibration error.

The first MVP may automate engineering delivery only. It must still attach an
explicit revenue or operator-time hypothesis to every task and reject
infrastructure work with no measurable dependency on the sales loop.

## 3. Current-state assessment

### Confirmed reusable assets

- Next.js/Supabase domain boundaries, Revenue Calculation/Score/Ranking, Item
  Selection evaluator and profitability policy.
- Read-only Domeggook adapter and Live Search boundary.
- Runtime Queue patterns: explicit states, bounded attempts, locks, worker
  events, sanitized errors, retry/cancel.
- Workflow transition idempotency keys and audit records.
- GitHub CI with lint, typecheck, tests, build, secret/generated-output checks.
- Exact-commit Vercel Preview resolution and non-destructive Playwright checks.
- Production browser smoke after `main` updates.
- Cross-PC GitHub/commit-SHA operating standard.

### Reclassified database and security state

- Confirmed: Sprint A recovered the pre-003 source evidence, inspected
  Production, documented canonical replay and forward-only Production strategy.
- Confirmed: Item Selection Database Architecture and minimal Admin
  Identity/Authorization/RLS/CSRF Architecture are accepted on current `main`.
- In progress, not merged: PR #40 implements the disposable Sprint B-0 baseline.
- Not confirmed complete: deployed Admin Auth/RLS runtime, Item Selection
  persistence, Production migration adoption, or Production security change.
- Therefore, old audit text saying the source is simply "missing" is stale, but
  it is equally incorrect to claim Production replay/auth remediation is done.

### Bottlenecks

- Technical: no durable task/thread/worktree ledger; no evidence-normalizing
  verifier; model output is not contract-enforced end to end.
- Sales: real provider rights evidence, landed-cost freshness, exposure/click/
  order/return/settlement feedback, and actual-vs-forecast calibration remain
  incomplete.
- Operational: D/N coordination relies on prose status and manual PR sequencing.
- External replacement check: generic ERP/order/inventory/accounting should be
  connected or purchased before reimplementation. GonggamLine's defensible
  scope is evidence-backed candidate selection, profitability decisions, safe
  approval, marketplace-specific execution, and the learning loop.

## 4. Scope and non-goals

In scope for the future implementation:

- planning/review, task contracts, deterministic routing, Codex execution,
  evidence verification, bounded retry, approval requests, audit, and recovery;
- engineering tasks through work-branch push and Draft PR;
- waiting for CI/Preview and returning normalized results;
- sales-learning identifiers and evidence classes.

Not in the MVP:

- final merge, Production deploy/rollback, schema/RLS/data change;
- OAuth setup, secrets, paid API enrollment or limit change;
- real listing, pricing, inventory, advertising, order, purchase, fulfillment,
  return, settlement, or payment;
- replacing ERP/WMS/accounting/helpdesk capabilities;
- autonomous multi-cloud scheduling or a general-purpose agent platform.

## 5. Components and trust boundaries

```text
External market/provider facts ──> evidence store/reference
                                      |
Planning/review agent ──TaskContract──v
                              Policy + Router
                                  |
                     durable task/idempotency ledger
                                  |
                   Worktree guard + Codex execution adapter
                                  |
                git/status/diff/tests/build/commit/push/PR
                                  |
          GitHub CI + Vercel Deployment + Playwright evidence
                                  |
                         Deterministic verifier
                                  |
                   ResultContract + review decision
                                  |
 NEXT_TASK | RETRY | REPLAN | WAIT_FOR_CI | WAITING_FOR_HUMAN |
                 BLOCKED | PROJECT_COMPLETED
```

### Planning/review agent

Reads project state, previous ResultContract, approved Architecture, Decision
Log, Work Status, sales evidence, and constraints. It proposes exactly one
highest-value next task or a terminal/wait decision. It never grants approval,
changes policy, or asserts a gate passed without verifier evidence.

### Policy engine and task router

Pure deterministic code owns repository allowlist, branch/base rules, PC
assignment, path/risk classification, approval matrix, concurrency, budgets,
retry ceilings, and idempotency. Routing tables precede model judgment.

Default routing:

| Work | PC | Base | Automatic extent |
|---|---|---|---|
| Architecture/contracts/automation | N | latest `origin/main` | Draft PR |
| Approved product implementation | D | latest `origin/main` or explicit dependency head | Draft PR |
| Schema/Auth/RLS/Production/commerce writes | designated PC only after approval | exact approved SHA | prepare/verify only unless action-specific approval exists |

### Codex execution agent

Receives an immutable TaskContract, operates only in the assigned repository and
worktree, and returns ResultContract. Preferred interface is Codex App Server
for thread lifecycle/events/interrupts; `codex exec --json --output-schema` is
the simpler MVP adapter. Both use workspace-write only for authorized paths.

### Evidence verifier

Does not trust prose. It resolves and compares:

- repository identity, base/work SHA, clean status, worktree ownership;
- changed filenames and diff against allowed/forbidden paths;
- local command exit codes and artifact hashes;
- commit/branch/push/PR head equality;
- GitHub check runs and exact-head conclusions;
- exact-head GitHub Deployment/Vercel Preview and Playwright artifacts;
- post-merge Production evidence only when a human-authorized merge occurred;
- Supabase migration/fingerprint evidence only from an approved disposable or
  explicitly approved target;
- external calls, costs, secret handling, and commerce-write audit records.

### Durable ledger and audit

MVP storage is a local SQLite database or equivalently transactional embedded
store under an operator-controlled data directory outside Git. It contains no
secret values. Every transition is append-only with timestamp, actor, reason,
input/output hash, evidence references, and prior event hash. GitHub remains
authoritative for code, commits, PRs, checks, and deployments.

## 6. Identity, concurrency, and idempotency

Every record links:

- `projectId`, `taskId`, `parentTaskId`, `attempt`;
- repository canonical URL, base branch/SHA, work branch, worktree path;
- Codex thread ID and review response ID;
- GitHub Issue/PR/check/workflow/deployment IDs;
- Vercel deployment ID/URL reference and Supabase environment/migration
  reference where approved;
- execution PC, controller instance, lease, token/cost/time counters;
- business entity IDs such as candidate, listing, order, purchase, or campaign.

Task idempotency key:

`sha256(projectId + taskKind + normalizedScope + baseSha + architectureVersion + policyVersion)`

The controller atomically reserves the key before work. A unique constraint
prevents duplicate active/completed tasks. Separate action keys are mandatory
for PR creation, external API calls, listing, order, and purchase. A commerce
action key never authorizes the action; it only prevents duplication after the
required approval.

One branch may be checked out in only one worktree and leased to one active
task. One repository may have multiple read-only planning tasks, but only one
merge candidate is advanced at a time. After a PR merges, every dependent PR
must rebase/merge latest `main` through a non-destructive policy-approved
operation and rerun all gates.

## 7. Sales learning loop and evidence semantics

```text
external candidate
 -> supplier price/shipping/MOQ + rights/provenance
 -> demand/competition/price/review/sales estimate
 -> fee/ad/return/fulfillment profitability scenarios
 -> human approval
 -> listing-ready package
 -> approved real exposure
 -> impressions/clicks/orders/returns/settlement/net profit
 -> expected-vs-actual error
 -> versioned policy proposal
 -> human-approved policy change
```

Every metric carries `sourceType`:

- `EXTERNAL_OBSERVED`: provider or marketplace fact with source and time;
- `ESTIMATED`: model/policy estimate with version and confidence;
- `OPERATOR_CONFIRMED`: explicit human fact;
- `ACTUAL`: marketplace/order/settlement observation;
- `UNKNOWN`: absent or unverifiable.

Estimated data must never be promoted to actual. Policy changes are new
versions, never silent edits to historical decisions.

Autonomy expands only by proven stage:

1. `SHADOW`: recommend and compare; no operational effect.
2. `ADVISORY`: present ranked actions to the operator.
3. `APPROVAL_GATED`: prepare exact action; human executes/approves each write.
4. `BOUNDED_AUTONOMY`: allow a narrow action class with per-action caps,
   monitoring, reconciliation, and kill switch.
5. `EXPANDED_AUTONOMY`: widen only after sample-size, loss, drift, and audit
   thresholds are approved.

## 8. Security and secrets

- Secret material stays in OS credential stores, GitHub/Vercel/Supabase secret
  stores, or untracked local environment files.
- Contracts contain secret references and required scopes, never values.
- Logs redact authorization, cookies, API keys, tokens, payload fields marked
  sensitive, and provider raw responses.
- App Server defaults to local stdio. Remote WebSocket is excluded from MVP;
  if later approved, require TLS, authenticated capability/bearer tokens, loopback
  or SSH tunneling, bounded queues, and a threat review.
- Controller and Codex run least privilege. `danger-full-access`, ignored rules,
  force push, protected-branch writes, and destructive Git are prohibited.
- Any unexpected write-capable external call freezes the task and opens a
  security incident record.

## 9. Failure, recovery, and observability

Classify failures in repository order: external configuration, database, code.
Additionally label orchestration failures as transient, deterministic,
policy/approval, conflict, budget, or unknown.

Checkpoint before and after every external side effect. On restart, recover
leases, compare ledger state with Git/GitHub reality, and choose resume,
reconcile, or human review. Never repeat an action merely because the prior
process did not record a final response.

Minimum telemetry:

- task/state/attempt duration, token and monetary cost;
- transition reason and policy version;
- command/check/deployment outcomes;
- retry signature and circuit-breaker state;
- approval age and actor;
- sales impact hypothesis and eventual actual result.

## 10. Technology comparison

| Option | Strength | Limitation | MVP fit |
|---|---|---|---|
| Codex App Server | thread start/resume/fork/read, streamed item events, interrupt, schema generation, local repo access | richer protocol; lifecycle client required | Recommended execution core |
| `codex exec` | simplest non-interactive runner, JSONL, output schema, explicit sandbox | weaker live control and multi-turn coordination | Recommended first adapter/fallback |
| Codex SDK | typed App Server client and thread resume | new dependency/runtime surface | Adopt after exec spike or immediately if thread control is required |
| Responses API | flexible stateful tool-using review agent | does not itself manage local Git/worktrees/approvals | Optional planner later |
| Agents SDK | handoffs, guardrails, traces | extra orchestration layer and API cost; easy to over-distribute | Defer until single-controller limits are proven |
| GitHub Actions/Webhooks | authoritative CI/PR events, reliable hosted triggers | poor local D/N worktree access; secrets/runner governance | Evidence/event source |
| Vercel API/Webhook | deployment state | existing GitHub Deployments already provide exact Preview | Use GitHub deployment records first |
| Supabase | strong durable shared state | schema/RLS/Production approval burden | Do not use for MVP ledger |
| Local process + SQLite | direct Windows repo/tool access, cheap, recoverable | N PC availability and backup responsibility | Recommended MVP host |
| Cloud worker | always-on scheduling | no local login/worktree; security and operating cost | Defer |
| Event + schedule | prompt reaction plus stalled-task recovery | duplicate delivery needs idempotency | Use both: webhook/poll events plus bounded reconciliation schedule |

Official Codex documentation confirms App Server's thread/turn primitives,
streamed events, generated schemas, and local transports; `codex exec` supports
JSONL and JSON-Schema final output; Codex SDK controls App Server threads.
Implementation must pin and re-generate protocol schemas for the installed
Codex version instead of assuming a remembered contract.

## 11. Architecture compliance

- Owner/boundary: new Engineering Orchestration lifecycle, outside product
  runtime and commerce domains.
- Existing sources reused: Git/GitHub, repository governance, CI/Preview,
  Runtime Queue patterns, typed contracts.
- New lifecycle/external tooling: yes; this document is the accepted
  Architecture Story. Implementation remains phase-gated; only the separately
  authorized Phase 0 read-only spike is in scope for this PR.
- Security/failure/observability/test/rollout/rollback are defined here and in
  the linked documents.
- Risk: the bootstrap is high-risk/manual by repository policy. No auto-merge.

## 12. Assumptions and decisions required

Confirmed:

- GitHub repository and `main` are the code source of truth.
- N owns design/contracts/automation; D owns approved product implementation.
- final merge and consequential external changes require a person.

Assumption for MVP:

- N PC can run a supervised local controller and has a backed-up,
  operator-controlled data directory.

Unconfirmed:

- installed Codex CLI/SDK versions and automation authentication method on each
  PC;
- webhook reachability to N, or whether polling is required initially;
- exact token/cost ceilings and business KPI thresholds;
- availability of Vercel/Supabase read-only API credentials.

User decisions are listed in
[implementation-roadmap.md](implementation-roadmap.md#user-decisions-before-mvp).

## 13. Rollout and rollback

Roll out in SHADOW with read-only planning and evidence collection, then enable
one documentation task through Draft PR. Expand task classes only after replay,
duplicate-suppression, recovery, and budget tests pass.

Rollback stops the controller, revokes its automation credentials, expires
leases, and preserves the ledger for audit. Revert the orchestrator
implementation PR. Existing product runtime, Supabase, Vercel Production, and
commerce systems remain unchanged.
