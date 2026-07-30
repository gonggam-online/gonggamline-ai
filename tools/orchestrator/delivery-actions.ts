import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

import { OrchestratorLedger } from "./ledger.ts";

export interface CommandResult {
  readonly stdout: string;
  readonly exitCode: number;
}

export interface DeliveryCommandRunner {
  run(
    executable: "git" | "gh" | "npm.cmd",
    args: readonly string[],
    cwd: string,
  ): CommandResult;
}

export const localDeliveryCommandRunner: DeliveryCommandRunner = {
  run(executable, args, cwd): CommandResult {
    try {
      return {
        stdout: execFileSync(executable, [...args], {
          cwd,
          encoding: "utf8",
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        }).trim(),
        exitCode: 0,
      };
    } catch (error) {
      const failure = error as {
        readonly status?: number;
        readonly stdout?: string | Buffer;
      };
      return {
        stdout: String(failure.stdout ?? "").trim(),
        exitCode: failure.status ?? 1,
      };
    }
  },
};

export interface DeliveryIdentity {
  readonly repositoryRoot: string;
  readonly repositoryFullName: string;
  readonly baseBranch: string;
  readonly baseSha: string;
  readonly branch: string;
  readonly taskId: string;
}

export interface CommitRequest {
  readonly identity: DeliveryIdentity;
  readonly paths: readonly string[];
  readonly message: string;
  readonly idempotencyKey: string;
}

export interface PullRequestRequest {
  readonly identity: DeliveryIdentity;
  readonly title: string;
  readonly bodyFile: string;
  readonly requiredLabel: string;
  readonly idempotencyKey: string;
}

export interface DeliveryActionResult {
  readonly status: "CREATED" | "RECONCILED";
  readonly reference: string;
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function requireSuccess(result: CommandResult, operation: string): string {
  if (result.exitCode !== 0) {
    throw new Error(`${operation} failed`);
  }
  return result.stdout;
}

function git(
  runner: DeliveryCommandRunner,
  identity: DeliveryIdentity,
  args: readonly string[],
): string {
  return requireSuccess(
    runner.run("git", args, identity.repositoryRoot),
    `git ${args[0] ?? "command"}`,
  );
}

function assertDeliveryIdentity(
  runner: DeliveryCommandRunner,
  identity: DeliveryIdentity,
): void {
  const branch = git(runner, identity, ["branch", "--show-current"]);
  if (branch !== identity.branch || branch === identity.baseBranch) {
    throw new Error("Delivery branch identity mismatch");
  }
  const head = git(runner, identity, ["rev-parse", "HEAD"]);
  const mergeBase = runner.run(
    "git",
    ["merge-base", "--is-ancestor", identity.baseSha, head],
    identity.repositoryRoot,
  );
  if (mergeBase.exitCode !== 0) {
    throw new Error("Delivery base SHA is not an ancestor of HEAD");
  }
}

function assertSafePaths(paths: readonly string[]): void {
  if (paths.length === 0) {
    throw new Error("Commit path allowlist must not be empty");
  }
  for (const candidate of paths) {
    const normalized = candidate.replaceAll("\\", "/");
    if (
      normalized.startsWith("/") ||
      /^[A-Za-z]:\//.test(normalized) ||
      normalized.split("/").includes("..") ||
      normalized === ".git" ||
      normalized.startsWith(".git/")
    ) {
      throw new Error("Commit path escapes the repository allowlist");
    }
  }
}

export function createVerifiedCommit(
  ledger: OrchestratorLedger,
  request: CommitRequest,
  runner: DeliveryCommandRunner = localDeliveryCommandRunner,
): DeliveryActionResult {
  assertDeliveryIdentity(runner, request.identity);
  assertSafePaths(request.paths);
  const payload = {
    taskId: request.identity.taskId,
    branch: request.identity.branch,
    baseSha: request.identity.baseSha,
    paths: [...request.paths].sort(),
    message: request.message,
  };
  const reservation = ledger.reserveAction({
    actionScope: "GIT_COMMIT",
    idempotencyKey: request.idempotencyKey,
    payload,
    now: new Date().toISOString(),
  });
  if (reservation === "EXISTS") {
    const existing = ledger.reservedAction(
      "GIT_COMMIT",
      request.idempotencyKey,
    );
    if (existing?.externalReference === null || existing === null) {
      throw new Error("Commit action is reserved without a reconciled SHA");
    }
    return { status: "RECONCILED", reference: existing.externalReference };
  }
  git(runner, request.identity, ["add", "--", ...request.paths]);
  const staged = git(runner, request.identity, [
    "diff",
    "--cached",
    "--name-only",
    "--",
  ])
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  const expected = [...request.paths].sort();
  if (JSON.stringify(staged) !== JSON.stringify(expected)) {
    throw new Error("Staged paths do not exactly match the approved commit paths");
  }
  git(runner, request.identity, ["diff", "--cached", "--check"]);
  git(runner, request.identity, ["commit", "-m", request.message]);
  const commitSha = git(runner, request.identity, ["rev-parse", "HEAD"]);
  ledger.recordExternalReference(
    "GIT_COMMIT",
    request.idempotencyKey,
    commitSha,
  );
  ledger.appendAudit(
    "DELIVERY_COMMIT_CREATED",
    { taskId: request.identity.taskId, commitSha, payloadHash: sha256(payload) },
    new Date().toISOString(),
  );
  return { status: "CREATED", reference: commitSha };
}

export function pushExactHead(
  ledger: OrchestratorLedger,
  identity: DeliveryIdentity,
  idempotencyKey: string,
  runner: DeliveryCommandRunner = localDeliveryCommandRunner,
): DeliveryActionResult {
  assertDeliveryIdentity(runner, identity);
  const head = git(runner, identity, ["rev-parse", "HEAD"]);
  const payload = { taskId: identity.taskId, branch: identity.branch, head };
  const reservation = ledger.reserveAction({
    actionScope: "GIT_PUSH",
    idempotencyKey,
    payload,
    now: new Date().toISOString(),
  });
  if (reservation === "EXISTS") {
    const existing = ledger.reservedAction("GIT_PUSH", idempotencyKey);
    if (existing?.externalReference !== head) {
      throw new Error("Push action does not reconcile to the current exact head");
    }
    return { status: "RECONCILED", reference: head };
  }
  git(runner, identity, [
    "push",
    "--set-upstream",
    "origin",
    `HEAD:refs/heads/${identity.branch}`,
  ]);
  const remoteLine = git(runner, identity, [
    "ls-remote",
    "--heads",
    "origin",
    `refs/heads/${identity.branch}`,
  ]);
  if (remoteLine.split(/\s+/)[0] !== head) {
    throw new Error("Remote branch SHA does not match the pushed exact head");
  }
  ledger.recordExternalReference("GIT_PUSH", idempotencyKey, head);
  ledger.appendAudit(
    "DELIVERY_HEAD_PUSHED",
    { taskId: identity.taskId, branch: identity.branch, head },
    new Date().toISOString(),
  );
  return { status: "CREATED", reference: head };
}

interface GhPullRequest {
  readonly number: number;
  readonly url: string;
  readonly isDraft: boolean;
  readonly headRefName: string;
  readonly baseRefName: string;
}

function parsePullRequests(value: string): readonly GhPullRequest[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("GitHub pull request response is malformed");
  }
  return parsed as GhPullRequest[];
}

export function reconcileDraftPullRequest(
  ledger: OrchestratorLedger,
  request: PullRequestRequest,
  runner: DeliveryCommandRunner = localDeliveryCommandRunner,
): DeliveryActionResult {
  assertDeliveryIdentity(runner, request.identity);
  const head = git(runner, request.identity, ["rev-parse", "HEAD"]);
  const remote = git(runner, request.identity, [
    "ls-remote",
    "--heads",
    "origin",
    `refs/heads/${request.identity.branch}`,
  ]);
  if (remote.split(/\s+/)[0] !== head) {
    throw new Error("Draft PR requires an exact-head remote branch");
  }
  const payload = {
    taskId: request.identity.taskId,
    head,
    branch: request.identity.branch,
    base: request.identity.baseBranch,
    title: request.title,
    requiredLabel: request.requiredLabel,
  };
  const existing = parsePullRequests(
    requireSuccess(
      runner.run(
        "gh",
        [
          "pr",
          "list",
          "--repo",
          request.identity.repositoryFullName,
          "--state",
          "open",
          "--head",
          request.identity.branch,
          "--base",
          request.identity.baseBranch,
          "--json",
          "number,url,isDraft,headRefName,baseRefName",
        ],
        request.identity.repositoryRoot,
      ),
      "GitHub pull request lookup",
    ),
  );
  if (existing.length > 1) {
    throw new Error("Duplicate open pull requests exist for the task branch");
  }
  let pullRequest = existing[0];
  let status: DeliveryActionResult["status"] = "RECONCILED";
  if (pullRequest === undefined) {
    const reservation = ledger.reserveAction({
      actionScope: "GITHUB_DRAFT_PR",
      idempotencyKey: request.idempotencyKey,
      payload,
      now: new Date().toISOString(),
    });
    if (reservation === "EXISTS") {
      throw new Error("Draft PR reservation exists without a discoverable PR");
    }
    const url = requireSuccess(
      runner.run(
        "gh",
        [
          "pr",
          "create",
          "--repo",
          request.identity.repositoryFullName,
          "--base",
          request.identity.baseBranch,
          "--head",
          request.identity.branch,
          "--draft",
          "--title",
          request.title,
          "--body-file",
          request.bodyFile,
        ],
        request.identity.repositoryRoot,
      ),
      "GitHub Draft PR creation",
    );
    const numberMatch = /\/pull\/(\d+)$/.exec(url);
    if (numberMatch?.[1] === undefined) {
      throw new Error("GitHub did not return a canonical pull request URL");
    }
    pullRequest = {
      number: Number(numberMatch[1]),
      url,
      isDraft: true,
      headRefName: request.identity.branch,
      baseRefName: request.identity.baseBranch,
    };
    ledger.recordExternalReference(
      "GITHUB_DRAFT_PR",
      request.idempotencyKey,
      url,
    );
    status = "CREATED";
  }
  if (
    !pullRequest.isDraft ||
    pullRequest.headRefName !== request.identity.branch ||
    pullRequest.baseRefName !== request.identity.baseBranch
  ) {
    throw new Error("Pull request is not the required exact Draft PR");
  }
  requireSuccess(
    runner.run(
      "gh",
      [
        "pr",
        "edit",
        String(pullRequest.number),
        "--repo",
        request.identity.repositoryFullName,
        "--add-label",
        request.requiredLabel,
      ],
      request.identity.repositoryRoot,
    ),
    "GitHub required label reconciliation",
  );
  ledger.appendAudit(
    "DELIVERY_DRAFT_PR_RECONCILED",
    { taskId: request.identity.taskId, head, pr: pullRequest.number },
    new Date().toISOString(),
  );
  return { status, reference: pullRequest.url };
}
