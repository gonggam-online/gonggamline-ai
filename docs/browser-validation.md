# Browser validation

`tests/e2e/routes.ts` is the typed manifest for existing App Router pages and health APIs. Playwright Chromium checks HTTP status, meaningful rendered content, uncaught errors, unexpected console errors, failed requests, unsafe API responses, raw stack traces, and secret-like output.

Preview resolution queries GitHub Deployments for the PR head commit SHA and `Preview` environment, then waits with bounded retries for Vercel's successful `environment_url`. This avoids storing a Vercel API token or project ID. Deployment Protection uses `x-vercel-protection-bypass`; the secret is never printed. Production targets `https://gonggamline-ai.vercel.app` after bounded health polling.

All checks are read-only. HTML reports, traces, video, and screenshots are uploaded on every workflow outcome; screenshots are taken for each major route. To add visual regression later, review stable baselines into a dedicated snapshot directory and enable `toHaveScreenshot` with an explicit, documented tolerance.
