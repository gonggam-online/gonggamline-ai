# Review checklist

## Intent and safety

- [ ] Change directly supports the stated business outcome.
- [ ] Scope is minimal and unrelated edits are absent.
- [ ] Risk classification matches `.ai/risk-classification.md`.
- [ ] No secret, generated output, destructive production write, or paid marketplace action.
- [ ] Rollback and remaining risk are explicit.

## Root cause and contracts

- [ ] External configuration and DB causes were checked before code changes.
- [ ] API request/response behavior is preserved or explicitly approved.
- [ ] Every Supabase table, column, relation, and alias is migration-backed.
- [ ] Errors remain observable and are not converted to success/empty data.
- [ ] Idempotency/retry/concurrency implications were considered.

## Quality and delivery

- [ ] Strict TypeScript; no explicit `any`, unsafe assertion, lint disable, or skipped test.
- [ ] Tests cover success and relevant failure paths.
- [ ] Full diff and changelog reviewed.
- [ ] Lint, typecheck, tests, build, and browser checks recorded.
- [ ] Commit pushed; Draft PR includes revenue, risk, verification, rollback, and owner action.
- [ ] Exact Preview validated without irreversible interactions.
- [ ] Production smoke runs only after merge and deployment.
