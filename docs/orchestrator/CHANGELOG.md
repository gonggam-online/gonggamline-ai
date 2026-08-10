# Orchestrator changelog

## 2026-08-10 — KK946 Gaemi inbound application

- Submitted approved inbound application `A1296915119go` for `PJ1491663`,
  black, six units, with evidence-backed dimensions and box-1 estimate.
- Selected approved full inspection at the displayed 100 KRW per unit plus VAT.
- Verified pending-inbound status; no supplier order, shipment, receipt, point
  deduction, inspection result, or inbound-lot binding occurred.

## 2026-08-10 — KK946 Gaemi product registration

- Registered sanitized warehouse product `PJ1491663` for `KK946 mini pouch`,
  option `black`, after exact owner approval.
- Verified the product is active and not received, with no approval backlog.
- Performed no inbound application, paid inspection, point use, supplier order,
  payment, listing, or fulfillment action.

## 2026-08-05 — Gaemi Warehouse to Rocket Growth adapter Architecture

- Audited Gaemi Warehouse's public 2025.06 rate card and 2025.07 Rocket Growth
  manual from supplier delivery through inbound, photos, documents, B2B output,
  and Coupang receipt evidence.
- Defined a provider-neutral 3PL evidence port, lifecycle, identity and
  artifact contracts, failure taxonomy, synthetic fixture/test plan, and
  rollout/rollback gates.
- Kept standard quantity inspection distinct from quality assurance; custom
  exhaustive inspection and processing require an exact approved quote/scope.
- Kept account, quote, customer code, API/webhook/export, Auth, privacy, limits,
  and SLA owner-supplied and unknown.
- Documentation only; no account, contact, payment, order, inbound, provider or
  marketplace write, secret, personal data, or Production action.

## 2026-08-05 — Third-party-first inspection policy

- Amend the accepted Sales Learning Architecture so normal product experiments
  do not depend on the owner purchasing or physically inspecting samples.
- Define a provider-agnostic Domeggook-to-3PL-to-Rocket-Growth evidence route,
  required inspection fields, quarantine outcomes, and fail-closed handling.
- Preserve separately bounded commerce approvals and define a strategic-product
  exception for operator sampling or original-source negotiation.
- Documentation only: no provider call, purchase, warehouse instruction,
  inbound, listing, DB/Auth/RLS, Production, personal-data, or paid action.

## 2026-08-04 — Phase 6 sales learning Architecture proposal

- Defined immutable candidate/estimate identities and append-only listing,
  order, settlement, cost, and accounting-final correlation semantics.
- Kept estimated, observed actual, and accounting-final evidence distinct and
  made incomplete actual net profit `UNKNOWN` rather than zero.
- Proposed the first bounded owner-decision packet and metrics without
  authorizing DB/privacy/Production, commerce, paid calls, or execution.


## 2026-08-04 — Phase 5 owner-sample structural correction

- Removed prefilled predictions from the 60-case owner fixture and generated
  outcomes through the real SHADOW review and admission-scope code.
- Added machine-verifiable context, dependency, retry-budget, repository,
  risk, delivery, cost, daily-usage, and expiry profiles.
- Added daily task usage to candidate admission and kept final merge and every
  high-risk/manual boundary fail-closed.
- Recorded the completed semantic owner review; operational activation still
  requires this Draft PR to merge with all exact gates passing.

## 2026-08-04 — Phase 5 SHADOW evidence and incident drill

- Recorded the repository-owner token/time/task/zero-cost caps with an exact
  configuration hash and expiry.
- Added a balanced 60-case owner-review fixture with 15 adversarial cases and
  exact metric verification.
- Added a hermetic no-external-write incident drill for duplicate suppression,
  budget interruption, recovery planning, and audit-chain integrity.
- Initially kept the sample proposed; the later structural-correction entry
  records the independent owner review and removes the circular metric design.

## 2026-08-04 — Phase 5 limited-autonomy admission gate

- Recorded the repository-owner SHADOW evaluation baseline and preserved all
  high-risk/manual approval boundaries.
- Added a pure fail-closed admission evaluator for owner evidence, numeric
  token/time/task caps, zero paid cost, approved repository/path/task classes,
  incident drill evidence, and Draft-PR-only delivery.
- Added adversarial admission and downgrade tests. No worker, dispatch, paid
  call, GitHub write, database, Production, or commerce effect was added.

## 2026-08-04 — Phase 4 SHADOW planner/reviewer

- Added evidence-referenced context packs and deterministic revenue/time
  candidate scoring.
- Added `NEXT_TASK`, `RETRY`, and `REPLAN` proposals that always deny dispatch.
- Added owner-sample precision/recall measurement and adversarial tests.
- Kept paid calls, automatic dispatch, database, Production, and commerce
  writes out of scope.

## 2026-07-30 — Phase 4.2 Windows verifier process boundary

- Fixed the controller-owned verifier on Windows Node 24, where spawning
  `npm.cmd` directly with `shell: false` returns `EINVAL`.
- Kept the command surface fixed by invoking the approved npm scripts through
  `cmd.exe /d /s /c` without enabling a general shell command path.
- Added platform-specific invocation coverage and a real Windows verifier
  regression check.

## 2026-07-30 — Phase 4.1 operator and delivery integration

- Connected a completed supervised operator run to the Phase 4 delivery
  pipeline through an explicit local delivery-submission manifest.
- Routed approved `IMPLEMENTATION` TaskContracts to D while retaining
  orchestrator tasks on N.
- Made delivery reconciliation restart-safe without re-running the Worker or
  requiring the pre-commit clean/base workspace state.
- Added the missing Preview-browser lifecycle stage and focused routing,
  handoff, and duplicate-write regression coverage.

## 2026-07-30 — Phase 4 GitHub and Preview delivery

- Added a supervised canonical TaskContract operator entrypoint.
- Added verified commit, exact-head push, duplicate-free Draft PR, required
  label, CI, Preview, and browser-artifact reconciliation.
- Added restart-safe external action idempotency and terminal
  `WAITING_FOR_HUMAN`.
- Corrected App Server token accounting to use protocol `totalTokens`.
- Added the first protected Item Selection TaskContract draft.

## 2026-07-29 — Phase 2 execution vertical slice

- Added local run creation, deterministic `READY` task selection, Worker
  dispatch, synchronized task/run state transitions, checkpoints, immutable
  result evidence, retry lineage, approval wait, and resume.
- Added duplicate suppression and bounded budget interruption using the Phase 1
  ledger, lease, state, and budget primitives.
- Added exact worktree guards and a controller-owned verifier with fixed
  command IDs, mandatory success gating, hashed evidence, and a minimum
  credential-free child environment.
- Added an independent wall-clock timeout with interrupt-once and late-result
  suppression.
- Latched usage-budget breaches in the controller so caught hook errors,
  Worker success, and verifier success cannot reverse a failure.
- Decoupled timeout persistence from interrupt adapter completion; pending and
  rejected interrupt Promises are observed without blocking fail-close.
- Moved interrupt adapter invocation into the observed Promise chain so a
  synchronous throw also cannot block timeout persistence.
- Moved Worker invocation into the observed Promise chain so synchronous
  throws and asynchronous rejections share the persisted adapter-failure path.
- Added a deterministic fake Worker adapter and focused success, failure,
  retry, approval, recovery, security, and guard tests.
- Documented that command-surface restriction is implemented but operating-
  system network isolation and actual process termination remain incomplete.
- Did not add Codex network execution, GitHub writes, CI/Preview polling,
  product APIs, Supabase changes, Production changes, or commerce writes.

## 2026-07-28 — Phase 1 local ledger, policy, and router

- Added a Node 24 `node:sqlite` ledger with embedded schema migration,
  idempotent task/action identities, exclusive route/lease records, and an
  audit hash chain.
- Added canonical Task/Result JSON Schema post-validation with AJV 2020.
- Added deterministic state, path, approval, N/D routing, and task budget
  policies.
- Added App Server interrupt-first cancellation and fail-closed Windows
  process-tree reconciliation rules.
- Added restart, D/N collision, duplicate PR/action, lease, audit-tamper,
  budget, contract, routing, and recovery tests.
- Did not add a Codex execution adapter, worktree mutator, GitHub writer,
  durable worker, or any Phase 2+ behavior.

## 2026-07-28 — Phase 0 protocol spike

- Accepted the merged architecture baseline from PR #41.
- Added executable fixtures for Codex App Server, structured `codex exec`, and
  synthetic log-redaction probes.
- Recorded schema compatibility, thread resume, interruption, usage, and
  process-tree cleanup evidence without committing raw transcripts.
- Confirmed that canonical task budget enforcement must remain deterministic in
  the controller: a technically successful CLI call exceeded its task token
  limit and is recorded as `FAILED` / `BLOCKED`.
- Kept Phase 1 implementation outside this change and subject to separate
  approval, branch, and pull request.
