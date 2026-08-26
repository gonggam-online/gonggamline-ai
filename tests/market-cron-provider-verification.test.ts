import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PROVIDER_VERIFICATION_COLLECTOR_KEYS } from "../services/market-orchestration.service.ts";

test("provider verification is bounded to one job for each external collector", () => {
  assert.deepEqual(PROVIDER_VERIFICATION_COLLECTOR_KEYS, [
    "naver-shopping-api",
    "dataforseo-naver-serp",
    "youtube-public-signals",
  ]);
  const source = readFileSync(new URL("../services/market-orchestration.service.ts", import.meta.url), "utf8");
  assert.match(source, /runDueCollectionJobs\(1, collectorKey\)/);
  assert.match(source, /allowSignalOnly: isYoutube/);
});

test("Vercel Cron uses the platform CRON_SECRET with legacy fallback only", () => {
  const source = readFileSync(new URL("../app/api/market/cron/route.ts", import.meta.url), "utf8");
  assert.match(source, /process\.env\.CRON_SECRET \?\? process\.env\.MARKET_CRON_SECRET/);
  assert.match(source, /verify\"\) === \"providers\"/);
  assert.match(source, /runProviderVerificationJobs\(\)/);
});

