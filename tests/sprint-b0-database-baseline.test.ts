import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

interface BaselineManifest {
  schemaVersion: string;
  supabaseCliVersion: string;
  promotedSources: Record<
    string,
    { source: string; sha256: string; transformation: string }
  >;
  preservedMigrations: Record<string, string>;
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const migrationsDirectory = path.join(repositoryRoot, "supabase", "migrations");
const manifest = JSON.parse(
  readFileSync(
    path.join(repositoryRoot, "supabase", "baseline-manifest.json"),
    "utf8",
  ),
) as BaselineManifest;

function canonicalLfSha256(contents: Buffer | string): string {
  const canonicalText = contents.toString().replaceAll("\r\n", "\n");
  return createHash("sha256").update(canonicalText, "utf8").digest("hex");
}

function readRepositoryFile(relativePath: string): Buffer {
  return readFileSync(path.join(repositoryRoot, relativePath));
}

function normalizedBody(fileName: string): string {
  const text = readFileSync(path.join(migrationsDirectory, fileName), "utf8");
  const marker = "\n\n";
  const bodyStart = text.indexOf(marker);
  assert.notEqual(bodyStart, -1, `${fileName} must have a provenance header`);
  return text.slice(bodyStart + marker.length).replaceAll("\r\n", "\n");
}

test("baseline manifest pins the disposable Supabase CLI and schema version", () => {
  assert.equal(
    manifest.schemaVersion,
    "gonggamline-sprint-b0-baseline-manifest-v1",
  );
  assert.equal(manifest.supabaseCliVersion, "2.110.0");
});

test("promoted source digests match the preserved recovery evidence", () => {
  for (const entry of Object.values(manifest.promotedSources)) {
    assert.equal(canonicalLfSha256(readRepositoryFile(entry.source)), entry.sha256);
  }
});

test("workflow and Commerce OS migration bodies preserve their sources", () => {
  for (const fileName of [
    "001_product_workflow_extension.sql",
    "002_commerce_os_core_schema.sql",
  ]) {
    const entry = manifest.promotedSources[fileName];
    assert.equal(entry.transformation, "provenance-header-only");
    assert.equal(
      normalizedBody(fileName),
      readRepositoryFile(entry.source).toString("utf8").replaceAll("\r\n", "\n"),
    );
  }
});

test("products baseline preserves schema but omits recovered RLS statements", () => {
  const migration = normalizedBody("000_products_baseline.sql");
  const source = readRepositoryFile(
    manifest.promotedSources["000_products_baseline.sql"].source,
  )
    .toString("utf8")
    .replaceAll("\r\n", "\n");

  assert.match(migration, /create table if not exists public\.products/);
  assert.equal(migration.includes("enable row level security"), false);
  assert.equal(migration.includes("create policy"), false);
  assert.match(source, /create policy "Allow public insert products"/);
});

test("migrations 003 through 020 remain byte-for-byte unchanged", () => {
  for (const [fileName, expectedHash] of Object.entries(
    manifest.preservedMigrations,
  )) {
    assert.equal(
      canonicalLfSha256(readFileSync(path.join(migrationsDirectory, fileName))),
      expectedHash,
      fileName,
    );
  }
});

test("canonical baseline migrations sort before preserved migration 003", () => {
  const migrationNames = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  assert.deepEqual(migrationNames.slice(0, 4), [
    "000_products_baseline.sql",
    "001_product_workflow_extension.sql",
    "002_commerce_os_core_schema.sql",
    "003_coupang_competition_analysis.sql",
  ]);
});

test("replay runner is pinned and refuses Production markers", () => {
  const runner = readFileSync(
    path.join(repositoryRoot, "scripts", "verify-sprint-b0-baseline.ps1"),
    "utf8",
  );

  assert.match(runner, /supabase@2\.110\.0/);
  assert.match(runner, /refuses Production environment markers/);
  assert.match(runner, /Docker is required for the disposable Supabase replay/);
  assert.match(runner, /"db" "reset" "--local"/);
  assert.equal(runner.includes("db push"), false);
  assert.equal(runner.includes("--linked"), false);
});
