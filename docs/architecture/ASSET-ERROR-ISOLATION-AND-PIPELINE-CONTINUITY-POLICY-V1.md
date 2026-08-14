# Asset Error Isolation and Pipeline Continuity Policy v1

## Decision and authority

- Status: owner-accepted policy through delegated workroom `12E` on 2026-08-14.
- Policy owner: Listing domain governance; source adapters own honest provider access, and Seller alone owns publication/upload writes.
- Compatibility dependency: External Commerce Asset Discovery and Rights Policy v1.1, policy digest `cb06faeb826d3fc3e51c12b4faf5d3c9123d1258670f253b242671fcfd6921c0`.
- Delivery classification: normal-risk, documentation only.
- Runtime authority granted: none. No crawler, API, database, Queue, durable store, download, derivative, upload, Production, or marketplace behavior is implemented or approved here.

The revenue objective is to preserve useful batch progress when one asset fails without weakening rights or access controls. The smallest safe rule is item-scoped failure with fail-closed publication eligibility.

> Pipeline continuity is required; rights validation and access controls remain non-bypassable.

## Binding invariants

1. `continue_on_asset_error` defaults to `true`. An asset-scoped validation, permission, provider, or parsing failure records an item outcome and processing continues with the next independent asset.
2. `RightsValidationException` and rights-related `PermissionError` are caught only at the item boundary. The item becomes `RIGHTS_BLOCKED` or `RIGHTS_CONFLICT`; it cannot enter publication, derivative, upload, or other downstream write queues.
3. HTTP `403` maps to `ACCESS_BLOCKED`. HTTP `409` maps to `RIGHTS_OR_STATE_CONFLICT`. Neither is success. Retry is allowed only when an official provider policy or valid `Retry-After` explicitly permits it, within an approved attempt/time budget.
4. Valid, rights-supported assets and non-asset research lanes continue: keyword, title, customer-question, story, category/competitor-pattern, and alternative-source research.
5. Batch success never hides blocked or failed items. The result includes exact counts and item-level sanitized outcomes.
6. Network clients identify GonggamLine honestly with a service name/version and monitored operational contact path. They obey robots directives, applicable terms, rate limits, privacy, paywalls, and access controls. Browser impersonation, header/cookie/session rotation, CAPTCHA/anti-bot bypass, and access-control evasion are prohibited.
7. `bypass_rights_check` is forbidden. A request, config, payload, or option containing it fails closed as `CONFIGURATION_ERROR`; boolean `false` does not make the field supported.
8. An operator may request reevaluation only after adding or referencing new rights evidence. Reevaluation creates a new decision linked to the prior result; it cannot overwrite status to `PASS`.
9. This policy narrows only failure isolation. It does not relax 12D v1.1 discovery/use/edit separation, exact-grant requirements, or `PUBLIC_REFERENCE_ONLY` exclusions.
10. Durable status, evidence, audit, attempts, and reevaluation history require an approved remote owner. No local-only durable queue, log, cache manifest, rights ledger, or approval record is allowed.

## Item states and downstream eligibility

| State | Meaning | Retryability | Publication / derivative / upload |
|---|---|---|---|
| `SUCCEEDED` | required checks passed for the requested operation | no | eligible only for the separately approved downstream gate |
| `SKIPPED` | intentionally excluded by an explicit, non-error policy reason | no | prohibited for this batch |
| `RIGHTS_BLOCKED` | rights evidence is missing, expired, revoked, or insufficient | only after new evidence | prohibited |
| `RIGHTS_CONFLICT` | evidence or grant scope conflicts | only after conflict resolution evidence | prohibited |
| `ACCESS_BLOCKED` | provider denied access, including HTTP 403 | only under explicit official policy | prohibited |
| `RIGHTS_OR_STATE_CONFLICT` | provider reported HTTP 409 rights/state conflict | only after authoritative state/evidence changes | prohibited |
| `FAILED` | sanitized item-scoped technical failure | only when classified transient and bounded | prohibited |

`SUCCEEDED` is not a marketplace publication approval. Existing claim, category, payload, asset-operation, and live-write gates still apply.

## Typed pseudocontract

This contract is design evidence, not executable code:

```ts
type AssetOutcomeCode =
  | "SUCCEEDED"
  | "SKIPPED"
  | "RIGHTS_BLOCKED"
  | "RIGHTS_CONFLICT"
  | "ACCESS_BLOCKED"
  | "RIGHTS_OR_STATE_CONFLICT"
  | "FAILED";

type AssetRetryability = "NOT_RETRYABLE" | "RETRY_AFTER_EVIDENCE" | "BOUNDED_RETRY";

interface AssetItemOutcome {
  assetReference: string; // opaque/sanitized, never raw credentials or private URL tokens
  code: AssetOutcomeCode;
  retryability: AssetRetryability;
  evidenceReference: string | null; // approved remote reference, not raw evidence
  sanitizedReasonCode: string;
}

interface AssetBatchResult {
  policyVersion: "asset-error-isolation-v1";
  continueOnAssetError: true;
  counts: {
    processed: number;
    succeeded: number;
    skipped: number;
    blocked: number;
    failed: number;
  };
  items: readonly AssetItemOutcome[];
}
```

Count invariants:

- `processed === items.length`;
- `processed === succeeded + skipped + blocked + failed`;
- `blocked` includes `RIGHTS_BLOCKED`, `RIGHTS_CONFLICT`, `ACCESS_BLOCKED`, and `RIGHTS_OR_STATE_CONFLICT`;
- no item appears in more than one count bucket;
- a fatal batch/configuration failure returns no misleading partial success envelope unless a future approved contract explicitly defines it.

Conceptual item boundary:

```text
validate contract (reject bypass_rights_check)
  -> for each independent asset
       -> inspect access and rights for the requested operation
       -> on item error: sanitize, classify, exclude downstream, continue
       -> on success: retain evidence reference, continue
  -> reconcile exact counts
  -> return partial/complete result without promoting blocked items
```

## Retry and access policy

- Do not retry deterministic rights failures, malformed evidence, ordinary 403 responses, or 409 conflicts by default.
- A bounded retry requires an approved provider rule or valid `Retry-After`, an explicit maximum attempt/time budget, idempotent read semantics, jitter/backoff where allowed, and sanitized attempt evidence.
- Retry exhaustion remains an item-scoped blocked/failed result. It never becomes success and never expands credentials, cookies, headers, or authorization scope.
- Batch-level stop remains correct for invalid contract/configuration, integrity failure that makes count reconciliation unsafe, unavailable authoritative policy, or a shared dependency failure that prevents trustworthy item isolation.

## Operator reevaluation

The operator supplies a reference to newly added or corrected evidence in the approved remote evidence system. Reevaluation must record the prior decision reference, new evidence reference/digest, requested operation, policy versions, evaluator version, requester, time, and new decision. The evaluator recomputes from evidence. There is no manual `PASS` setter, mutable status overwrite, or exception flag.

## Cloud-first durable-state gate

| Durable state | Approved remote authority | Classification / recovery |
|---|---|---|
| policy, pseudocontract, decision, delivery evidence | GitHub branch/PR and merged repository | internal; recover from authorized checkout and PR history |
| runtime item status, attempts, batch counters, audit, reevaluation history | not approved here; future managed transactional service requires an Architecture Story | internal/confidential; implementation stops until owner, retention, encryption, backup, recovery, and deletion are approved |
| rights evidence, source/derivative digests, licenses, binaries | not approved here beyond the authoritative source provider | often confidential; future encrypted least-privilege evidence/object service required |

Local checkout, build output, and bounded sanitized browser evidence are disposable. No local queue/log/database/file may become the authoritative operational record. Sensitive or private evidence must not be copied into GitHub merely to satisfy portability.

## Required implementation tests

Any later separately approved implementation must prove:

- default `continue_on_asset_error=true` continues after the first, middle, and final item failure;
- mixed success/skip/block/fail batches reconcile exact counts and stable ordering;
- `RightsValidationException` and rights-related `PermissionError` map fail closed and never enqueue blocked assets;
- 403/409 are not treated as success and are not retried without approved policy;
- `Retry-After` retry is bounded, idempotent, observable, and terminates safely;
- forbidden `bypass_rights_check` at every contract/config layer returns `CONFIGURATION_ERROR` before asset or provider work;
- logs/errors/evidence references exclude credentials, cookies, private URL tokens, raw provider bodies, stack traces, and personal data;
- honest service identification is used and spoofing/rotation inputs are rejected;
- unaffected assets and keyword/title/story/alternative-source research continue;
- reevaluation requires new evidence, preserves immutable history, and cannot manually assign `PASS`;
- process interruption/replay does not duplicate a downstream write or lose the authoritative audit record;
- property tests enforce count invariants and no blocked item reaches publication, derivative, or upload eligibility.

## Downstream handoff

COORD and workrooms 15, 15C, 16B, 20, and 22 must consume policy version `asset-error-isolation-v1`, this document's Git blob/delivery reference, and the compatible 12D digest above. They must preserve item-scoped continuity, fail-closed downstream exclusion, honest access behavior, forbidden bypass configuration, immutable evidence-based reevaluation, and the Cloud-first stop gate.

Any implementation of the pseudocontract, crawler, adapter, API, database, Queue, evidence service, retry scheduler, or publication integration requires its own approved Architecture/risk Story.

## Acceptance and rollback

Owner acceptance is the delegated 12E policy decision dated 2026-08-14. Rollback is Git revert. A repository revert cannot erase operational audit evidence or authorize previously blocked assets; any implemented consumer would require reconciliation under its approved runbook.
