import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const serviceRoleModule = "lib/supabase/service-role.server";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    return statSync(absolute).isDirectory()
      ? sourceFiles(absolute)
      : /\.(?:ts|tsx)$/.test(name)
        ? [absolute]
        : [];
  });
}

test("A08: the service-role constructor has only approved repository importers", () => {
  const importers = sourceFiles(root)
    .filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`))
    .filter((file) => !file.includes(`${path.sep}tests${path.sep}`))
    .filter((file) => readFileSync(file, "utf8").includes(serviceRoleModule))
    .map((file) => path.relative(root, file).replaceAll("\\", "/"));

  assert.deepEqual(importers, [
    "services/listing-creative-asset.repository.ts",
    "services/listing-creative-adapter-recovery.repository.ts",
    "services/listing-creative-operator.repository.ts",
    "services/listing-live-write-approval.service.ts",
    "services/item-selection-run.repository.ts",
    "services/product-mutation.repository.ts",
  ].sort());
});

test("A08: client components cannot reach protected server modules", () => {
  for (const file of sourceFiles(path.join(root, "app"))) {
    const source = readFileSync(file, "utf8");
    if (/^\s*["']use client["'];/m.test(source)) {
      assert.doesNotMatch(source,
        /service-role\.server|item-selection-run\.repository|listing-creative-(?:asset|operator)\.repository|product-mutation\.repository/);
    }
  }
});

test("A08: the constructor is server-only and never exports a key", () => {
  const source = readFileSync(
    path.join(root, "lib", "supabase", "service-role.server.ts"),
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /export\s+(?:const|let|var)\s+\w*(?:key|secret)/i);
  assert.match(source, /isSameRequestAdminGuardContext/);
});
