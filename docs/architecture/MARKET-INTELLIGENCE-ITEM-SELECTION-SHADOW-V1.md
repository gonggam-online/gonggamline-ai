# Market Intelligence ↔ Item Selection Shadow Evaluation v1

## Status

Proposed Architecture Story. This document authorizes no external collector,
secret/configuration, database migration/RLS change, queue, schedule, paid
data call, Production mutation, supplier purchase, advertising, or marketplace
write. The accompanying implementation is a pure, read-only Shadow evaluator
that consumes already-approved sanitized metric snapshots.

## Objective

Raise Item Selection above prompt-only recommendations by combining supplier
facts, contribution economics, market time-series signals, confidence,
freshness, competition pressure, supply risk, and rights evidence in a
deterministic, auditable ranking signal. With no accumulated sales yet, the
system must maximize evidence quality and uncertainty handling rather than
pretend that demand is known.

## Current-state evidence

- `services/item-selection-workflow.service.ts` obtains bounded Domeggook
  candidates and records supplier shipping in the profitability snapshot, but
  its live score inputs remain unavailable and its rights gates remain unknown.
- `services/market-analysis.service.ts` already computes demand, growth,
  competition, supply, entry difficulty, opportunity, confidence, and unit
  estimates from market snapshots.
- `services/market-orchestration.service.ts` intentionally skips external
  collectors until an approved executor/configuration exists.
- `shared/domain/market-intelligence-shadow.ts` is the new pure bridge. It
  does not alter the live verdict or authorize any action.

## Shadow contract

The evaluator consumes a candidate item number, an immutable metric snapshot,
profitability status/margin, and a rights status. It returns:

- market score and confidence/freshness/coverage-adjusted score;
- risk score, estimated unit hint, missing facts, and evidence-bound reasons;
- `PRIORITIZE_FOR_REVIEW`, `WATCH`, or `DO_NOT_PRIORITIZE`;
- explicit `SHADOW_CANDIDATE`, `INSUFFICIENT_DATA`, or `BLOCKED` eligibility.

Missing core market facts never become defaults. Stale observations are
discounted. Rights failure blocks the candidate. A Shadow result is not a
purchase, price, listing, advertising, or Production decision.

## Target flow after separate approval

```text
approved source adapter
  -> sanitized observation envelope
  -> managed evidence store / append-only metrics
  -> Market Intelligence analysis
  -> Shadow evaluator
  -> Item Selection comparison packet
  -> human review / bounded experiment
```

The live Item Selection verdict remains the source of truth until a later
Architecture Story explicitly authorizes a versioned contract change and
calibration evidence.

## Required follow-up Architecture/approval gates

1. **Source and rights**: choose official API, lawful public observation, or
   manual import per marketplace; document rate limits, terms, freshness,
   takedown, and 403/429 fail-closed behavior.
2. **Cloud durable state**: approve Supabase ownership, append-only retention,
   evidence classification, encryption, least privilege, backup/recovery, and
   cross-PC restore. No local archive is authoritative.
3. **Runtime**: approve collector executor, Queue lease/retry semantics,
   schedule, idempotency, cooldown, observability, and cost ceiling.
4. **Security/configuration**: approve exact Secret/config owner and Production
   rollout. No secret is placed in GitHub, fixtures, Preview, or client code.
5. **Integration contract**: approve the versioned mapping from market metrics
   into Item Selection score areas and preserve old DTO/public verdict
   compatibility during Shadow mode.
6. **Calibration**: approve a sanitized offline benchmark and later a bounded
   human-reviewed experiment. No claim of superiority is valid without
   precision@k, margin error, freshness coverage, and realised-sale outcomes.

## Rollout and rollback

- Phase 0: pure Shadow calculation and offline fixtures (this PR).
- Phase 1: approved read-only observations, no live verdict change.
- Phase 2: Shadow packets shown beside existing results; collect operator
  agreement and disagreement.
- Phase 3: calibration against actual sales and returns; require manual owner
  decision before any ranking or purchase workflow change.
- Rollback: disable Shadow presentation/consumer; retain immutable evidence;
  existing Item Selection verdict and commerce approval boundaries continue.

## Decision

This is the highest-value safe first step before live market acquisition. It is
not a claim that the engine is already better than GPT, Gemini, or Claude. That
claim requires a common candidate set, blinded evaluation, and realised-sale
backtest.
