# Merge policy

## Universal gates

Before merge, require:

- AI CTO and architecture compliance;
- deterministic risk classification;
- complete diff review and clean secret/generated-output inspection;
- lint, typecheck, existing unit/integration and contract tests;
- production build;
- exact-head CI and Vercel Preview;
- `preview-browser-e2e`, including page, API, console, and request checks;
- no conflicts and a branch that is not behind the required base; and
- documented rollback and remaining risks.

## Normal-risk

Add `normal-risk`. Native auto-merge may be enabled only after every universal
gate succeeds and repository policy permits it. Auto-merge is eligibility, not
permission to bypass review, required approvals, or a stricter task policy.

## High-risk

Add `manual-merge-required`. Never enable auto-merge. Require explicit human
approval and the domain-specific safeguards in [`RISK_POLICY.md`](RISK_POLICY.md).

## Bootstrap exception

The initial automation/project operating-system bootstrap remains manual when
the existing binding delivery policy says so, even if documentation-only work
is otherwise normal-risk. The stricter rule wins.

## After merge

Wait for the exact Production deployment, then run non-destructive health, API,
and browser smoke checks. Synchronize local `main` only after preserving the
working tree. Report branch, commit, PR, labels, merge, gates, Preview,
Production, artifacts, blockers, revenue impact, and remaining work.
