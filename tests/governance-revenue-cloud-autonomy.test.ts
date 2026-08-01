import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("governance makes measurable revenue the first planning gate", () => {
  const agents = read("AGENTS.md");
  const directive = read(".ai/CTO_MASTER_DIRECTIVE.md");
  const priority = read(".ai/business-priority.md");

  assert.match(agents, /best next development step for producing[\s\S]*revenue quickly/i);
  assert.match(directive, /shortest safe,[\s\S]*path to the first and next sale/i);
  assert.match(priority, /earliest currently blocked step[\s\S]*measurable sale/i);
});

test("cloud portability preserves secrecy and local cleanup", () => {
  const standard = read(".ai/CODEX_OPERATING_STANDARD.md");
  const constitution = read(".ai/PROJECT_CONSTITUTION.md");

  assert.match(standard, /Do not use a local disk as the only source of truth/i);
  assert.match(standard, /Cloud-first never overrides secrecy/i);
  assert.match(constitution, /approved repository or managed cloud source of truth/i);
  assert.match(constitution, /retention limits, and auditable cleanup/i);
});

test("autonomy cannot weaken high-risk approval boundaries", () => {
  const agents = read("AGENTS.md");
  const standard = read(".ai/CODEX_OPERATING_STANDARD.md");

  assert.match(agents, /preserving every high-risk and[\s\S]*approval boundary/i);
  assert.match(standard, /does not authorize Production, database\/schema\/migration\/RLS\/Auth/i);
  assert.match(standard, /exact target, evidence,[\s\S]*rollback, and remaining risk/i);
});
