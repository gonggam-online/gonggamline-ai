# Autonomous delivery lifecycle

Every implementation follows the mandatory prefix and suffix in `AGENTS.md`: establish business value and deterministic risk on a safe non-main branch, implement the smallest reliable change, validate locally, commit/push, open a PR, validate the exact Vercel Preview, merge only through policy, then smoke-test Production and report evidence.

## Repository settings

Enable GitHub native auto-merge and create a `main` ruleset that requires PRs, up-to-date branches, conversation resolution, and these checks: `ci-lint`, `ci-typecheck`, `ci-tests`, `ci-build`, `ci-security-audit`, and `preview-browser-e2e`. Block force pushes and deletion. Allow GitHub Actions to create/approve PRs if `GITHUB_TOKEN` is used for auto-PR; otherwise use an owner-approved fine-grained token.

Create repository labels `normal-risk` and `manual-merge-required`. High-risk changes are never auto-merged. The initial automation PR is explicitly excluded.

## Required secrets and integration

- `VERCEL_AUTOMATION_BYPASS_SECRET`: required when Vercel Deployment Protection blocks automation. Create an Automation Bypass secret in the Vercel project and store the same value as a GitHub Actions repository secret.
- `AUTO_MERGE_PAT`: fine-grained GitHub token able to enable auto-merge; required because workflow-run `GITHUB_TOKEN` may lack this capability.

Connect the Vercel project to this GitHub repository and enable Preview deployments for PRs. Preview resolution reads the exact PR commit's `Preview` record and successful `environment_url` from GitHub Deployments using the workflow-scoped `GITHUB_TOKEN`; no Vercel API token or project ID is required. A preflight check detects Vercel login redirects before Playwright starts. The protection bypass secret is sent only in the protected header and must never be logged.

## Troubleshooting and owner actions

If auto-PR fails, enable “Allow GitHub Actions to create and approve pull requests.” If labels fail, create them once. If Preview resolution times out, confirm the Vercel Git integration creates a GitHub `Preview` deployment for the exact PR commit and that workflow permissions allow `deployments: read`. If auto-merge does not enable, confirm native auto-merge, rulesets, token access, required checks, branch currency, and risk labels.
