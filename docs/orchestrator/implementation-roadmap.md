# Orchestrator implementation roadmap

This roadmap authorizes no implementation. Each phase requires its own approved
TaskContract, branch, PR, tests, and applicable Architecture decision.

## Recommended MVP

One supervised Windows process on N:

- TypeScript controller;
- local SQLite ledger outside Git;
- Git CLI plus GitHub connector/API;
- `codex exec --json --output-schema` adapter first;
- Codex App Server adapter for thread resume/events/interrupt after the
  contract/recovery spike;
- polling reconciliation first, optional webhook later;
- existing GitHub Actions/Vercel deployment evidence;
- no Supabase orchestration tables, cloud workers, or commerce writes.

## Phase 0 — contract and protocol spike

Status: completed locally on
`codex/chore/orchestrator-protocol-spike`; see
[the protocol spike report](reports/protocol-spike.md). Delivery remains a
separate `manual-merge-required` Draft PR.

Purpose: prove task/result schemas, installed Codex capabilities, and safe
read-only execution without modifying product runtime.

Done:

- validate schemas and examples;
- capture installed Codex/App Server generated schema version;
- run one read-only repo assessment with structured output;
- prove task/thread ID capture, cancellation, usage, and log redaction;
- decide exec-first versus SDK/App Server-first with measured evidence.

Risk: normal for read-only spike, but the automation bootstrap PR remains
manual. Approval: no paid/API credential creation.

## Phase 1 — local ledger, policy, and router

Status: implemented locally on `codex/feat/orchestrator-phase-1`; see
[the Phase 1 implementation report](reports/phase-1-local-controller.md).
Delivery remains a separate `manual-merge-required` Draft PR.

Purpose: deterministic identity, states, budgets, leases, routing, and recovery.

Scope:

- SQLite migrations local to the tool;
- state machine and transition tests;
- repository/PC/branch/worktree tables;
- idempotency/action keys and audit hash chain;
- allow/deny paths, risk and approval policy;
- crash/replay/duplicate/concurrency tests.

Done: simulated D/N and restart scenarios cannot duplicate a task, branch, PR,
or external action.

## Phase 2 — Codex execution vertical slice

Purpose: execute one documentation-only task from validated TaskContract to
local verified commit.

Scope:

- worktree guard;
- Codex adapter with pinned schema;
- streamed checkpoint/usage capture;
- allowed-path enforcement;
- local diff/lint/typecheck/test/build verifier;
- no push or PR in the first test.

Done: a fixture repository and then one approved real docs task complete with
deterministic evidence and safe cancellation.

## Phase 3 — GitHub Draft PR and exact Preview

Purpose: extend the slice through push, duplicate-free Draft PR, CI and Preview.

Scope:

- exact-head push/PR reconciliation;
- check/deployment polling and optional webhook inbox;
- Playwright artifact verification;
- stale-main detection and serialized merge queue;
- `WAITING_FOR_CI` timeouts/circuit breaker.

Done: one docs PR reaches verified Draft state. Final merge remains human.

## Phase 4 — planning/review loop in SHADOW

Purpose: propose the next highest-value work without autonomous execution.

Scope:

- verified context pack;
- revenue/time impact scoring;
- structured NEXT_TASK/RETRY/REPLAN outcomes;
- hallucination/forbidden-scope adversarial tests;
- compare proposed work with owner decisions for an approved sample.

Done: owner-approved precision/recall and no unauthorized task dispatch.

## Phase 5 — approved engineering autonomy

Purpose: automatically dispatch a narrow class of normal-risk documentation,
tests, and internal refactors through Draft PR.

Prerequisites:

- approved daily token/cost/time/task caps;
- rollback and incident drill;
- monitored duplicate/error/manual-intervention rates;
- explicit list of allowed repositories/path classes.

Schema/Auth/RLS/Production/commerce remain approval-gated.

## Phase 6 — sales learning integration

Status: Architecture proposed in
[Sales Learning Closed Loop and First Experiment v1](../architecture/SALES-LEARNING-CLOSED-LOOP-V1.md).
No implementation or experiment execution is authorized.

Purpose: connect external observed candidates and actual marketplace outcomes
without autonomous commerce writes.

Scope:

- evidence references and `sourceType`;
- candidate-to-listing-to-order-to-settlement correlation;
- expected-vs-actual dashboards;
- policy-change proposals in SHADOW;
- buy/connect/build assessment for ERP/WMS/accounting.

Done: at least one owner-approved product experiment is traceable from external
facts through actual net profit, with no estimate/actual conflation.

## User decisions before MVP

1. Choose automation authentication: existing interactive Codex session,
   Codex access token where eligible, or Platform API key. Values remain secret.
2. Approve per-task and daily token, KRW cost, wall-time, and task-count caps.
3. Confirm N availability expectations: supervised-only, scheduled-hours, or
   always-on; and ledger backup location/retention.
4. Decide polling-only MVP or an inbound webhook endpoint/tunnel.
5. Approve the first repository/path/task class and whether local commit is
   allowed before Draft PR.
6. Define SHADOW evaluation sample size and acceptable false-dispatch,
   duplicate, failure, and manual-intervention thresholds.
7. Accept or amend the proposed first experiment packet in the Sales Learning
   Architecture Story; real marketplace actions remain separately approved.

## Implementation task split

| Task | Dependency | Suggested branch | Done/verify | Risk/approval | Impact |
|---|---|---|---|---|---|
| Protocol capability spike | accepted design | `codex/chore/orchestrator-protocol-spike` | generated schema + structured read-only run | manual bootstrap; credentials if needed | removes platform uncertainty |
| Contract validator package | spike | `codex/feat/orchestrator-contract-validator` | schemas/examples/adversarial tests | normal/manual bootstrap | prevents malformed work |
| Ledger/state machine | validator | `codex/feat/orchestrator-ledger-state` | transition/restart/idempotency tests | normal/manual bootstrap | reliable unattended recovery |
| Router/worktree guard | ledger | `codex/feat/orchestrator-router` | D/N/concurrency/dirty-tree tests | normal/manual bootstrap | prevents cross-PC collisions |
| Codex execution adapter | router | `codex/feat/orchestrator-codex-adapter` | fixture docs task, cancel/resume | auth and spend approval | reduces delivery time |
| Evidence verifier | adapter | `codex/feat/orchestrator-verifier` | tampered-report and stale-SHA tests | normal/manual bootstrap | replaces prose trust |
| GitHub/Preview adapter | verifier | `codex/feat/orchestrator-github-preview` | duplicate-free Draft PR and exact-head evidence | GitHub auth; no merge | automates delivery wait |
| Shadow planner/reviewer | evidence loop | `codex/feat/orchestrator-shadow-review` | owner-scored offline sample | API cost cap | prioritizes high-value work |
| Sales evidence correlation | approved data Architecture | separate Architecture first | expected/actual contract tests | DB/privacy/manual | closes revenue learning loop |
| Gaemi/3PL evidence adapter | accepted third-party policy + accepted adapter Architecture + owner-supplied provider contract | separate contract-discovery Story first | synthetic fixtures, fail-closed admission, document/hash and quarantine tests | provider/privacy/commerce/manual | removes routine owner handling before Rocket Growth |

## First MVP task-room instruction

```text
작업 제목: Orchestrator Phase 0 — Codex protocol capability spike

목표:
승인된 docs/orchestrator 설계를 기준으로 제품 코드나 외부 시스템을
변경하지 않고, 이 Windows N PC에서 사용할 Codex 실행 인터페이스를
read-only로 검증한다.

필수 시작:
- AGENTS.md와 .ai boot 순서를 준수한다.
- 최신 origin/main, clean 독립 worktree, open PR 충돌을 확인한다.
- 새 non-main branch codex/chore/orchestrator-protocol-spike를 사용한다.
- docs/orchestrator/task-contract.schema.json과
  result-contract.schema.json을 입력/출력 계약으로 사용한다.

범위:
- 설치된 Codex CLI 버전과 app-server generate-json-schema 결과를 기록한다.
- codex exec --json --output-schema의 thread ID, 이벤트, usage, 실패 종료,
  cancellation 가능성을 fixture/read-only 명령으로 검증한다.
- App Server stdio의 initialize, thread/start, turn/start, streamed completion,
  thread resume/read, interrupt를 read-only fixture에서 검증한다.
- exec와 App Server/SDK의 구현난이도·안정성·복구성을 측정해 Phase 1의
  기본 어댑터를 결정한다.
- 비밀값은 출력/커밋하지 않는다.

금지:
- 제품 코드/API/migration/CI/Vercel/Supabase/Production/Coupang 변경
- workspace-write 실행, commit/push/PR을 제외한 외부 write
- 새 OAuth, secret, paid API, 권한 확대
- 오케스트레이터 본 구현 시작

완료:
- docs/orchestrator/reports/protocol-spike.md와 sanitized fixture evidence
- JSON Schema 검증 통과
- git diff, lint/typecheck/test/build 영향 확인
- normal-risk라도 automation bootstrap 규칙에 따라 manual-merge-required
  Draft PR까지만 전달
- 권장 어댑터, 미확인 사항, Phase 1 입력을 ResultContract로 보고
```
