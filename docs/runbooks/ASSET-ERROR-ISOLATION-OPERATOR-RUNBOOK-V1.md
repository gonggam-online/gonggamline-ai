# Asset Error Isolation Operator Runbook v1

This is a policy runbook only. It does not invoke a crawler, provider, database, Queue, download, derivative, upload, or marketplace operation.

1. Confirm the batch uses `asset-error-isolation-v1` and compatible 12D digest `cb06faeb826d3fc3e51c12b4faf5d3c9123d1258670f253b242671fcfd6921c0`.
2. Reject the entire request as `CONFIGURATION_ERROR` if `bypass_rights_check` exists anywhere.
3. For each item outcome, verify the sanitized code, retryability, and approved remote evidence reference. Do not request raw secrets, cookies, private URL tokens, or provider bodies.
4. Confirm `processed = succeeded + skipped + blocked + failed` and that all items appear exactly once.
5. Confirm every rights/access/conflict item is absent from publication, derivative, and upload eligibility. Continue valid items and independent keyword/title/story/alternative-source research.
6. For 403/409, do not rotate identities or retry by default. Follow only an official provider rule or valid `Retry-After` within an approved bounded budget.
7. To reevaluate, add/correct rights evidence in the approved remote evidence owner, then request a new evaluation linked to the old decision. Never overwrite status to `PASS`.
8. Escalate and stop runtime implementation if the authoritative operational status/evidence/audit owner, retention, encryption, backup, recovery, or deletion policy is absent.

Incident evidence is a sanitized reference and count reconciliation record. Local browser captures/build logs are disposable; no local-only rights ledger or operational queue is permitted.
