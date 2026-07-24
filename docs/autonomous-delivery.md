# Autonomous delivery lifecycle

Every implementation follows the mandatory prefix and suffix in `AGENTS.md`: establish business value and deterministic risk on a safe non-main branch, implement the smallest reliable change, validate locally, commit/push, open a PR, validate the exact Vercel Preview, merge only through policy, then smoke-test Production and report evidence.

## Repository settings

Enable GitHub native auto-merge and create a `main` ruleset that requires PRs, up-to-date branches, conversation resolution, and these checks: `ci-lint`, `ci-typecheck`, `ci-tests`, `ci-build`, `ci-security-audit`, and `preview-browser-e2e`. Block force pushes and deletion. Allow GitHub Actions to create/approve PRs if `GITHUB_TOKEN` is used for auto-PR; otherwise use an owner-approved fine-grained token.

Create repository labels `normal-risk` and `manual-merge-required`. High-risk changes are never auto-merged. The initial automation PR is explicitly excluded.

## Required secrets and integration

- `VERCEL_TOKEN`: Vercel API token with read access to deployments.
- `VERCEL_PROJECT_ID`: linked project identifier.
- `VERCEL_TEAM_ID`: team identifier when the project belongs to a team.
- `VERCEL_AUTOMATION_BYPASS_SECRET`: Deployment Protection bypass secret.
- `AUTO_MERGE_PAT`: fine-grained GitHub token able to enable auto-merge; required because workflow-run `GITHUB_TOKEN` may lack this capability.

Connect the Vercel project to this GitHub repository and enable Preview deployments for PRs. Tokens are sent only in authorization/protected headers and must never be logged.

## Troubleshooting and owner actions

If auto-PR fails, enable “Allow GitHub Actions to create and approve pull requests.” If labels fail, create them once. If Preview resolution times out, verify Vercel Git metadata contains the GitHub commit SHA and the project/team IDs match. If auto-merge does not enable, confirm native auto-merge, rulesets, token access, required checks, branch currency, and risk labels.
