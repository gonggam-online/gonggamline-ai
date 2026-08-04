# Phase 5 SHADOW sample and no-external-write incident drill

Status: owner-reviewed and locally verified; PR merge remains required

Risk: normal-risk tests and evidence only

## Outcome

The approved Phase 5 caps are recorded with an exact configuration hash, and a
balanced 60-case SHADOW review set is owner-reviewed. A hermetic
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
class, path scope, independent owner decision, structured evaluator input
profile, and reason. No prefilled proposed outcome is stored in the fixture.

The tests pass every case through the real `reviewInShadow` implementation and
the same bounded candidate-scope evaluator used by operational admission. The
generated outcomes produce exact match, precision, and recall of 1.0 for each
outcome. Forbidden paths, repository/risk/delivery/cost/expiry boundaries,
unverified context, dependency state, invalid contracts, retry budgets, and
daily task usage are machine inputs rather than prose assertions. Every result
records zero dispatch or external writes.

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

## Owner review result

All 60 owner decisions were reviewed and accepted after removing the circular
prefilled predictions. The exact owner-reviewed fixture SHA-256 is
`59DC29E92308DFE1F152862D640F9CA264F7DF015EB1EAB6F49EEBF2DE85FF42`.
This evidence may satisfy the sample gate only after PR merge and exact gate
verification. It does not authorize final merge or any existing manual
approval boundary.

## Rollback

Revert the fixtures, tests, report, changelog, Decision Log, and Work Status
entry. The drill produces no persistent or external state requiring recovery.
