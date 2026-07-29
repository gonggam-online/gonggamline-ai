import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { AppServerWorkerAdapter } from "./app-server-worker.ts";
import { runDevelopmentLoop } from "./development-loop.ts";
import { OrchestratorLedger } from "./ledger.ts";

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd());
const targetPath =
  process.argv[3] ?? "docs/orchestrator/reports/phase-3-live-smoke.md";
if (path.isAbsolute(targetPath) || targetPath.split(/[\\/]/).includes("..")) {
  throw new Error("Live-smoke target must be a repository-relative path");
}
if (existsSync(path.join(repositoryRoot, targetPath))) {
  throw new Error("Live-smoke target already exists");
}

const branch = git(repositoryRoot, ["branch", "--show-current"]);
const baseSha = git(repositoryRoot, ["rev-parse", "HEAD"]);
const canonicalOrigin = git(repositoryRoot, ["remote", "get-url", "origin"]);
const temporaryDirectory = mkdtempSync(
  path.join(tmpdir(), "orchestrator-live-smoke-"),
);
const ledger = new OrchestratorLedger(
  path.join(temporaryDirectory, "ledger.sqlite"),
  repositoryRoot,
);
const id = randomUUID();
const projectId = `live-smoke-project-${id}`;
const taskId = `live-smoke-task-${id}`;
const runId = `live-smoke-run-${id}-1`;
const now = () => new Date().toISOString();
const adapter = new AppServerWorkerAdapter({
  goal: [
    `Create only ${targetPath}.`,
    "Write a short Markdown record stating that the Phase 3 local Codex App",
    "Server smoke produced one allowlisted documentation change.",
    "Do not inspect secrets, run network commands, commit, or touch any other file.",
  ].join(" "),
  correlationId: `live-smoke-${id}`,
  workspace: {
    repositoryRoot,
    canonicalOrigin,
    branch,
    baseSha,
    pathPolicy: {
      allowed: [targetPath],
      denied: [".git/**", ".env", ".env.local", ".codex/**"],
    },
  },
});

async function main(): Promise<void> {
try {
  ledger.registerProject(projectId, now());
  ledger.registerRepository({
    repositoryId: `live-smoke-repository-${id}`,
    canonicalOrigin,
    integrationBranch: "main",
    now: now(),
  });
  ledger.registerPc(`live-smoke-pc-${id}`, "git,node,codex,sqlite", now());
  ledger.createTask(
    {
      projectId,
      taskId,
      parentTaskId: null,
      idempotencyKey: `live-smoke-task:${id}`,
    },
    now(),
  );
  const results = await runDevelopmentLoop(
    ledger,
    adapter,
    () => adapter.interrupt(),
    {
      first: {
        projectId,
        taskId,
        runId,
        idempotencyKey: `live-smoke-run:${id}:1`,
        controllerId: `live-smoke-controller-${id}`,
        leaseExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        now,
        budget: {
          tokenLimit: 20_000,
          wallTimeSeconds: 180,
          estimatedCostKrwLimit: 1_000,
        },
        verificationPlan: {
          repositoryRoot,
          requiredCommandIds: ["GIT_DIFF_CHECK"],
          retryableOnFailure: true,
        },
      },
      nextRunId: (attempt) => `live-smoke-run-${id}-${attempt}`,
      nextIdempotencyKey: (attempt) => `live-smoke-run:${id}:${attempt}`,
    },
  );
  const final = results.at(-1);
  process.stdout.write(
    `${JSON.stringify({
      status: final?.run.state ?? "FAILED",
      attempts: results.length,
      runIds: results.map((entry) => entry.run.runId),
      failureCode:
        final === undefined
          ? "MISSING_RESULT"
          : ledger.runResult(final.run.runId)?.failureCode,
      auditChainValid: ledger.verifyAuditChain(),
      targetPath,
    })}\n`,
  );
  if (final?.run.state !== "COMPLETED") {
    process.exitCode = 1;
  }
} finally {
  ledger.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown live-smoke error";
  process.stderr.write(`${JSON.stringify({ status: "FAILED", error: message })}\n`);
  process.exitCode = 1;
});
