import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

import { evaluatePath, type PathDecision, type PathPolicy } from "./policy.ts";

export const verificationCommandIds = [
  "GIT_DIFF_CHECK",
  "LINT",
  "TYPECHECK",
  "TEST",
  "BUILD",
] as const;

export type VerificationCommandId = (typeof verificationCommandIds)[number];

export interface VerificationEvidence {
  readonly commandId: VerificationCommandId;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly outputHash: string;
  readonly passed: boolean;
}

export interface PathVerificationEvidence {
  readonly changedPaths: readonly string[];
  readonly decisions: readonly PathDecision[];
}

interface ProcessInvocation {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly env: Readonly<Record<string, string>>;
}

export interface VerificationProcessResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

export type VerificationProcessRunner = (
  invocation: ProcessInvocation,
) => VerificationProcessResult;

interface ApprovedCommand {
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
}

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

const approvedCommands: Readonly<
  Record<VerificationCommandId, ApprovedCommand>
> = {
  GIT_DIFF_CHECK: {
    executable: "git",
    args: ["diff", "--check"],
    timeoutMs: 60_000,
  },
  LINT: {
    executable: npmExecutable,
    args: ["run", "lint"],
    timeoutMs: 10 * 60_000,
  },
  TYPECHECK: {
    executable: npmExecutable,
    args: ["run", "typecheck"],
    timeoutMs: 10 * 60_000,
  },
  TEST: {
    executable: npmExecutable,
    args: ["test"],
    timeoutMs: 15 * 60_000,
  },
  BUILD: {
    executable: npmExecutable,
    args: ["run", "build"],
    timeoutMs: 15 * 60_000,
  },
};

const inheritedEnvironmentNames = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createVerificationEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Readonly<Record<string, string>> {
  const environment: Record<string, string> = {
    CI: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_ignore_scripts: "true",
    npm_config_offline: "true",
    npm_config_update_notifier: "false",
  };
  for (const name of inheritedEnvironmentNames) {
    const value = source[name];
    if (value !== undefined) {
      environment[name] = value;
    }
  }
  return environment;
}

const defaultProcessRunner: VerificationProcessRunner = (invocation) => {
  const result = spawnSync(invocation.executable, [...invocation.args], {
    cwd: invocation.cwd,
    encoding: "utf8",
    shell: false,
    timeout: invocation.timeoutMs,
    windowsHide: true,
    env: invocation.env as NodeJS.ProcessEnv,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: result.error?.name === "ETIMEDOUT",
  };
};

function assertCommandId(value: string): asserts value is VerificationCommandId {
  if (!(verificationCommandIds as readonly string[]).includes(value)) {
    throw new Error(`Verification command ID is not approved: ${value}`);
  }
}

export function runLocalVerification(
  repositoryRoot: string,
  commandIds: readonly string[],
  processRunner: VerificationProcessRunner = defaultProcessRunner,
): VerificationEvidence[] {
  const environment = createVerificationEnvironment();
  const results: VerificationEvidence[] = [];
  for (const candidate of commandIds) {
    assertCommandId(candidate);
    const command = approvedCommands[candidate];
    const startedAt = Date.now();
    const result = processRunner({
      executable: command.executable,
      args: command.args,
      cwd: repositoryRoot,
      timeoutMs: command.timeoutMs,
      env: environment,
    });
    const combined = `${result.stdout}\n${result.stderr}`;
    const exitCode = result.status ?? (result.timedOut ? 124 : 1);
    results.push({
      commandId: candidate,
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
