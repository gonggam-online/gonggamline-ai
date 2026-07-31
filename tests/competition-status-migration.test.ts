import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const statusConstraint =
  /check \(competition_analysis_status in \('pending', 'analyzed', 'estimated', 'needs_data', 'failed'\)\)/;

test("competition status constraints accept the current application states", () => {
  const migration003 = readFileSync(
    "supabase/migrations/003_coupang_competition_analysis.sql",
    "utf8",
  );
  const migration004 = readFileSync(
    "supabase/migrations/004_automatic_competition_pipeline.sql",
    "utf8",
  );

  assert.match(migration003, statusConstraint);
  assert.match(migration004, statusConstraint);
});

test("estimated remains a distinct completed-analysis state", () => {
  const analysisRunner = readFileSync(
    "features/competition/run-analysis.ts",
    "utf8",
  );
  const competitionPage = readFileSync("app/competition/page.tsx", "utf8");

  assert.match(
    analysisRunner,
    /status:\s*market\.source === "external" \? "analyzed" : "estimated"/,
  );
  assert.match(
    competitionPage,
    /\["analyzed", "estimated"\]\.includes\(p\.competition_analysis_status/,
  );
});
