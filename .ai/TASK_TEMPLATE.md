# Task template

- [ ] Read `README.md`, `.ai/README.md`, and required boot documents.
- [ ] Confirm current repository, safe non-`main` branch, and working tree.
- [ ] Record objective, revenue impact, dependencies, risks, scope, and non-goals.
- [ ] Complete AI CTO Compliance Check.
- [ ] Complete Architecture Compliance Check.
- [ ] Stop if a new architectural boundary lacks an approved Architecture Story.
- [ ] Classify failure root cause: external configuration -> database -> code.
- [ ] Classify the whole change as normal-risk or high-risk.
- [ ] Implement the smallest reliable authorized change.
- [ ] Update tests, contracts, documentation, changelog, work status, and
      Decision Log as applicable.
- [ ] Review the complete diff and inspect secrets/generated output.
- [ ] Run lint, typecheck, unit/integration/contract tests, and production build.
- [ ] Run safe browser validation and fix code-caused failures.
- [ ] Commit and push the current non-`main` branch.
- [ ] Create/update one PR to `main` with risk label, rollback, and evidence.
- [ ] Validate exact-head CI, Vercel Preview, and `preview-browser-e2e`.
- [ ] Auto-merge only eligible normal-risk work; manually approve high-risk or
      stricter-policy work.
- [ ] After merge, validate Production and safely synchronize `main`.
- [ ] Report completion, blockers, owner actions, revenue impact, and next work.
