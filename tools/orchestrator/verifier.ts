import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

import { evaluatePath, type PathDecision, type PathPolicy } from "./policy.ts";

export interface VerificationCommand {
  readonly name: string;
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
}

export interface VerificationEvidence {
  readonly name: string;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly outputHash: string;
  readonly passed: boolean;
}

export interface PathVerificationEvidence {
  readonly changedPaths: readonly string[];
  readonly decisions: readonly PathDecision[];
}

const forbiddenExecutables = new Set([
  "curl",
  "curl.exe",
  "gh",
  "gh.exe",
  "supabase",
  "supabase.exe",
  "vercel",
  "vercel.exe",
]);

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function runLocalVerification(
  repositoryRoot: string,
  commands: readonly VerificationCommand[],
): VerificationEvidence[] {
  const results: VerificationEvidence[] = [];
  for (const command of commands) {
    if (forbiddenExecutables.has(command.executable.toLowerCase())) {
      throw new Error(
        `External-capable verifier command is forbidden: ${command.executable}`,
      );
    }
    const startedAt = Date.now();
    const result = spawnSync(command.executable, [...command.args], {
      cwd: repositoryRoot,
      encoding: "utf8",
      shell: false,
      timeout: command.timeoutMs,
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const exitCode =
      result.status ?? (result.error === undefined ? 1 : 124);
    results.push({
      name: command.name,
      exitCode,
      durationMs: Date.now() - startedAt,
      outputHash: sha256(combined),
      passed: exitCode === 0,
    });
    if (exitCode !== 0) {
      break;
    }
  }
  return results;
}

export function verifyChangedPaths(
  repositoryRoot: string,
  baseSha: string,
  policy: PathPolicy,
): PathVerificationEvidence {
  const tracked = execFileSync(
    "git",
    ["-C", repositoryRoot, "diff", "--name-only", baseSha, "--"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  )
    .split(/\r?\n/)
    .filter((entry) => entry.length > 0);
  const status = execFileSync(
    "git",
    ["-C", repositoryRoot, "status", "--porcelain=v1", "--untracked-files=all"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  )
    .split(/\r?\n/)
    .filter((entry) => entry.length > 3)
    .map((entry) => entry.slice(3).replace(/^.* -> /, ""));
  const changedPaths = [...new Set([...tracked, ...status])].sort();
  const decisions = changedPaths.map((candidate) =>
    evaluatePath(policy, candidate),
  );
  const rejected = decisions.filter((decision) => !decision.allowed);
  if (rejected.length > 0) {
    throw new Error(
      `Changed path policy violation: ${rejected
        .map(
          (decision) =>
            `${decision.normalizedPath}:${decision.reason}`,
        )
        .join(",")}`,
    );
  }
  return { changedPaths, decisions };
}
