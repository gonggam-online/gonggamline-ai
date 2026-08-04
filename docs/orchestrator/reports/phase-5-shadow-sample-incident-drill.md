# Phase 5 SHADOW sample and no-external-write incident drill

Status: locally verified; owner label review and PR merge remain required

Risk: normal-risk tests and evidence only

## Outcome

The approved Phase 5 caps are recorded with an exact configuration hash, and a
balanced 60-case SHADOW review set is ready for owner review. A hermetic
incident drill verifies duplicate suppression, budget interruption, owned
process recovery planning, and ledger audit integrity without performing an
external write.

No automatic task dispatch, worker execution, branch creation, commit, push,
Draft PR creation, final merge, paid model/API call, Production action,
database/Auth/RLS change, secret/configuration change, or commerce write is
authorized by these evidence files.

## Approved caps

- Repository: `gonggam-online/gonggamline-ai`.
- Per-task tokens: 100,000.
- Per-task wall time: 120 minutes.
- Daily task count: 1.
- Per-task and daily paid cost: KRW 0.
- Expiry: `2026-09-04T23:59:59+09:00`, normalized to
  `2026-09-04T14:59:59.000Z`.
- Configuration SHA-256:
  `cff71fde7dc8d096927fbd7445f97337cff292238446dd04b91e6cdf606cfebf`.

## SHADOW review set

The fixture contains exactly 60 unique cases: 20 `NEXT_TASK`, 20 `RETRY`, and
20 `REPLAN`, with 15 adversarial cases. Every case records a summary, task
class, path scope, proposed outcome, proposed owner decision, and reason.

The proposed labels produce exact match, precision, and recall of 1.0 for each
outcome. Those metrics demonstrate fixture consistency only. The fixture is
explicitly `PROPOSED_FOR_OWNER_REVIEW`; it must not be converted to
`OWNER_APPROVED` or `ownerLabeled: true` until the repository owner reviews all
60 cases. The admission regression proves that proposed labels remain SHADOW.

## Incident drill

The drill uses only an in-memory SQLite ledger and synthetic process metadata:

1. reserve one task and verify the duplicate returns `EXISTS`;
2. reserve one simulated Draft PR action and verify the duplicate returns
   `EXISTS`;
3. verify the append-only ledger audit hash chain;
4. exceed the approved 100,000-token limit and verify one interrupt request;
5. reconcile a synthetic controller-owned process tree child-first;
6. assert no GitHub, Vercel, Supabase, marketplace, model/API, filesystem
   deletion, or other external write adapter is called.

This validates the deterministic incident contracts. It is not a live process
termination or an operational dispatch rehearsal.

## Owner review action

Review
`docs/orchestrator/evidence/phase-5-shadow-owner-review.json`. For any disputed
case, change `ownerDecision` and explain the reason. After reviewing every case,
explicitly approve exact SHA-256
`DBCE60F57A805E234E2C23163F539ACA403ED8FF16D1905F6023B70478235788` if the
file is unchanged. The incident summary SHA-256 is
`D68A4298E9796E65903A9D11178633E5FEF8F8104BA6F535097D8BCEE9A84AB2`.
Only a later, separately
verified change may mark the set `OWNER_APPROVED` and evaluate operational
admission. Existing manual approval boundaries remain unchanged.

## Rollback

Revert the fixtures, tests, report, changelog, Decision Log, and Work Status
entry. The drill produces no persistent or external state requiring recovery.
