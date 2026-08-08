import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type PortabilityStatus =
  | "REMOTE_AUTHORITATIVE"
  | "LOCAL_MIGRATION_BLOCKER"
  | "OWNER_DECISION_REQUIRED"
  | "EPHEMERAL_LOCAL";

export type CloudStateEntry = Readonly<{
  id: string;
  stateClass: string;
  currentAuthority: string;
  targetAuthority: string;
  portabilityStatus: PortabilityStatus;
  dataClassification: string;
  evidence: readonly string[];
  nextAction: string;
  highRiskBoundary: boolean;
}>;

export type CloudStateManifest = Readonly<{
  schemaVersion: string;
  repository: string;
  entries: readonly CloudStateEntry[];
}>;

export type ReadinessCheck = Readonly<{
  id: string;
  passed: boolean;
  detail: string;
}>;

const statuses = new Set<PortabilityStatus>([
  "REMOTE_AUTHORITATIVE",
  "LOCAL_MIGRATION_BLOCKER",
  "OWNER_DECISION_REQUIRED",
  "EPHEMERAL_LOCAL",
]);
const classifications = new Set([
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "SECRET",
  "PERSONAL",
  "PRODUCTION_BUSINESS_DATA",
]);
const secretLike = /(?:gh[opsu]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.|service[_-]?role\s*[:=]|password\s*[:=])/i;

export function validateCloudStateManifest(
  manifest: CloudStateManifest,
  evidenceExists: (relativePath: string) => boolean,
): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== "gonggamline-cloud-state-manifest-v1") {
    errors.push("Unknown cloud-state manifest schema version.");
  }
  if (manifest.repository !== "gonggam-online/gonggamline-ai") {
    errors.push("Unexpected repository identity.");
  }
  if (manifest.entries.length === 0) errors.push("Cloud-state inventory is empty.");
  if (new Set(manifest.entries.map(({ id }) => id)).size !== manifest.entries.length) {
    errors.push("Cloud-state entry IDs must be unique.");
  }
  if (secretLike.test(JSON.stringify(manifest))) {
    errors.push("Cloud-state manifest contains secret-like material.");
  }
  for (const entry of manifest.entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) {
      errors.push(`${entry.id}: invalid entry ID.`);
    }
    if (!statuses.has(entry.portabilityStatus)) {
      errors.push(`${entry.id}: invalid portability status.`);
    }
    if (!classifications.has(entry.dataClassification)) {
      errors.push(`${entry.id}: invalid data classification.`);
    }
    if (!entry.currentAuthority || !entry.targetAuthority || !entry.nextAction) {
      errors.push(`${entry.id}: authority and next action are required.`);
    }
    if (entry.evidence.length === 0 || entry.evidence.some((file) => !evidenceExists(file))) {
      errors.push(`${entry.id}: evidence path is missing.`);
    }
    if (
      (entry.portabilityStatus === "LOCAL_MIGRATION_BLOCKER" ||
        entry.portabilityStatus === "OWNER_DECISION_REQUIRED") &&
      !entry.highRiskBoundary
    ) {
      errors.push(`${entry.id}: unresolved durable state must retain a high-risk boundary.`);
    }
  }
  return [...new Set(errors)];
}

export function evaluateReadiness(checks: readonly ReadinessCheck[]): Readonly<{
  ready: boolean;
  failed: readonly ReadinessCheck[];
}> {
  const failed = checks.filter(({ passed }) => !passed);
  return Object.freeze({ ready: failed.length === 0, failed: Object.freeze(failed) });
}

function command(commandName: string, args: readonly string[], cwd: string): Readonly<{
  ok: boolean;
  stdout: string;
}> {
  const result = spawnSync(commandName, [...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: process.env,
  });
  return Object.freeze({
    ok: result.status === 0,
    stdout: typeof result.stdout === "string" ? result.stdout.trim() : "",
  });
}

export function collectLocalReadiness(repositoryRoot: string): ReadinessCheck[] {
  const gitRoot = command("git", ["rev-parse", "--show-toplevel"], repositoryRoot);
  const branch = command("git", ["branch", "--show-current"], repositoryRoot);
  const origin = command("git", ["remote", "get-url", "origin"], repositoryRoot);
  const status = command("git", ["status", "--porcelain"], repositoryRoot);
  const auth = command("gh", ["auth", "status", "-h", "github.com"], repositoryRoot);
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);

  return [
    { id: "node-version", passed: nodeMajor >= 22, detail: `Node ${process.versions.node}; required >=22.` },
    { id: "git-repository", passed: gitRoot.ok && path.resolve(gitRoot.stdout) === path.resolve(repositoryRoot), detail: "Checkout must be the selected repository root." },
    { id: "task-branch", passed: branch.ok && branch.stdout !== "" && branch.stdout !== "main", detail: branch.stdout ? `Current branch: ${branch.stdout}.` : "Detached or missing branch." },
    { id: "origin", passed: origin.ok && /github\.com[/:]gonggam-online\/gonggamline-ai(?:\.git)?$/.test(origin.stdout), detail: origin.ok ? "GitHub origin identity checked." : "GitHub origin unavailable." },
    { id: "github-auth", passed: auth.ok, detail: auth.ok ? "GitHub CLI authentication available." : "Run gh auth login -h github.com." },
    { id: "worktree", passed: status.ok && status.stdout === "", detail: status.stdout === "" ? "Working tree is clean." : "Commit/push or preserve current changes before switching PC." },
    { id: "lockfile", passed: existsSync(path.join(repositoryRoot, "package-lock.json")), detail: "Tracked dependency lockfile required." },
    { id: "cloud-policy", passed: existsSync(path.join(repositoryRoot, ".ai", "CLOUD_FIRST_POLICY.md")), detail: "Cloud-first policy required." },
    { id: "work-status", passed: existsSync(path.join(repositoryRoot, ".codex", "WORK_STATUS.md")), detail: "Tracked recovery status required." },
  ];
}

function main(): void {
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const manifestPath = path.join(repositoryRoot, "docs", "cloud", "cloud-state-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CloudStateManifest;
  const manifestErrors = validateCloudStateManifest(manifest, (relativePath) =>
    existsSync(path.join(repositoryRoot, relativePath)));
  const readiness = evaluateReadiness(collectLocalReadiness(repositoryRoot));
  const migrationBlockers = manifest.entries
    .filter(({ portabilityStatus }) =>
      portabilityStatus === "LOCAL_MIGRATION_BLOCKER" ||
      portabilityStatus === "OWNER_DECISION_REQUIRED")
    .map(({ id, portabilityStatus, nextAction }) => ({ id, portabilityStatus, nextAction }));
  const result = {
    schemaVersion: "gonggamline-cloud-readiness-result-v1",
    ready: manifestErrors.length === 0 && readiness.ready,
    checks: collectLocalReadiness(repositoryRoot),
    manifestErrors,
    migrationBlockers,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ready) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("check-cloud-portability.ts")) main();
