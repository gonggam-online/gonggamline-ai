import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Revenue Dashboard remains a single read-only API consumer", async () => {
  const ui = await source("../components/revenue-dashboard/revenue-dashboard.tsx");
  assert.equal([...ui.matchAll(/fetch\(/g)].length, 1);
  assert.match(ui, /fetch\(buildDashboardUrl\(filters, offset\)/);
  assert.doesNotMatch(ui, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
});

test("Dashboard route exposes GET only", async () => {
  const route = await source("../app/api/dashboard/revenue/route.ts");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)/);
});

test("Dashboard query preserves existing DTO and engine boundaries", async () => {
  const dashboard = await source("../lib/revenue/dashboard.ts");
  assert.doesNotMatch(dashboard, /supabase|insert\(|update\(|delete\(/i);
  assert.match(dashboard, /rankProductsByRevenue/);
  assert.match(dashboard, /mapRevenueDashboardDto/);
});

test("Dashboard UI uses local state without global stores", async () => {
  const ui = await source("../components/revenue-dashboard/revenue-dashboard.tsx");
  assert.match(ui, /useState/);
  assert.doesNotMatch(ui, /redux|zustand|mobx|createContext/i);
});

test("generated, refreshed, and analyzed timestamps stay distinct", async () => {
  const ui = await source("../components/revenue-dashboard/revenue-dashboard.tsx");
  assert.match(ui, /Data generated/);
  assert.match(ui, /Last refreshed/);
  assert.match(ui, /lastAnalyzedAt/);
  assert.match(ui, /Not analyzed/);
});

test("release documentation records limitations and rollback", async () => {
  const release = await source("../docs/release-and-rollback.md");
  assert.match(release, /Revenue Dashboard known limitations/);
  assert.match(release, /Revenue Dashboard rollback/);
});

test("generated browser evidence is excluded from commits", async () => {
  const ignore = await source("../.gitignore");
  assert.match(ignore, /\/playwright-report\//);
  assert.match(ignore, /\/test-results\//);
});

test("release hardening does not add migrations or environment values", async () => {
  const changelog = await source("../CHANGELOG-Sprint3.md");
  assert.match(changelog, /Revenue Dashboard Release Hardening/);
  assert.match(changelog, /No database or migration change/);
});
