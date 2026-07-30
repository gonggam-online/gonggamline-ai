import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

interface BaselineManifest {
  schemaVersion: string;
  supabaseCliVersion: string;
  migrations: MigrationArtifact[];
  promotedSources: Record<
    string,
    { source: string; sha256: string; transformation: string }
  >;
}

interface MigrationArtifact {
  order: number;
  file: string;
  sha256: string;
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

function verifyMigrationInventory(
  actualNames: string[],
  artifacts: MigrationArtifact[],
  readMigration: (fileName: string) => Buffer | string,
): void {
  assert.equal(actualNames.length, 22, "migration directory must contain 22 SQL files");
  assert.equal(artifacts.length, 22, "manifest must contain 22 migration artifacts");
  assert.equal(
    new Set(artifacts.map(({ file }) => file)).size,
    artifacts.length,
    "manifest migration filenames must be unique",
  );
  assert.deepEqual(
    artifacts.map(({ order }) => order),
    Array.from({ length: artifacts.length }, (_, order) => order),
    "manifest migration order must be contiguous from zero",
  );
  assert.deepEqual(
    artifacts.map(({ file }) => file),
    actualNames,
    "manifest migration order must exactly match the migration directory",
  );

  for (const artifact of artifacts) {
    assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
    assert.equal(
      canonicalLfSha256(readMigration(artifact.file)),
      artifact.sha256,
      artifact.file,
    );
  }
}

function normalizedBody(fileName: string): string {
  const text = readFileSync(path.join(migrationsDirectory, fileName), "utf8")
    .replaceAll("\r\n", "\n");
  const marker = "\n\n";
  const bodyStart = text.indexOf(marker);
  assert.notEqual(bodyStart, -1, `${fileName} must have a provenance header`);
  return text.slice(bodyStart + marker.length);
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

test("manifest fixes the complete ordered migration inventory and artifact hashes", () => {
  const migrationNames = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  verifyMigrationInventory(migrationNames, manifest.migrations, (fileName) =>
    readFileSync(path.join(migrationsDirectory, fileName)),
  );
});

test("migration inventory validation rejects every protected drift class", () => {
  const names = manifest.migrations.map(({ file }) => file);
  const contents = new Map(
    names.map((fileName) => [
      fileName,
      readFileSync(path.join(migrationsDirectory, fileName)),
    ]),
  );
  const readMigration = (fileName: string): Buffer => {
    const contentsForFile = contents.get(fileName);
    assert.ok(contentsForFile, fileName);
    return contentsForFile;
  };

  assert.throws(() =>
    verifyMigrationInventory(names.slice(0, -1), manifest.migrations, readMigration),
  );
  assert.throws(() =>
    verifyMigrationInventory(
      [...names, "021_unapproved.sql"],
      manifest.migrations,
      readMigration,
    ),
  );
  assert.throws(() =>
    verifyMigrationInventory(names, manifest.migrations.slice(0, -1), readMigration),
  );
  assert.throws(() =>
    verifyMigrationInventory(
      names,
      [
        ...manifest.migrations,
        { order: 21, file: "021_manifest_only.sql", sha256: "0".repeat(64) },
      ],
      readMigration,
    ),
  );
  assert.throws(() =>
    verifyMigrationInventory(
      names,
      [manifest.migrations[1], manifest.migrations[0], ...manifest.migrations.slice(2)],
      readMigration,
    ),
  );
  assert.throws(() =>
    verifyMigrationInventory(
      names,
      manifest.migrations.map((artifact, index) =>
        index === 1 ? { ...artifact, file: manifest.migrations[0].file } : artifact,
      ),
      readMigration,
    ),
  );
  assert.throws(() =>
    verifyMigrationInventory(names, manifest.migrations, (fileName) =>
      fileName === names[0] ? `${readMigration(fileName)}\n-- drift` : readMigration(fileName),
    ),
  );
  assert.throws(() =>
    verifyMigrationInventory(
      names,
      manifest.migrations.map((artifact, index) =>
        index === 0 ? { ...artifact, sha256: "0".repeat(64) } : artifact,
      ),
      readMigration,
    ),
  );
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
