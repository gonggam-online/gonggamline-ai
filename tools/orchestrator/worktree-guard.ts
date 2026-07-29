import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

export interface WorktreeExpectation {
  readonly repositoryRoot: string;
  readonly canonicalOrigin: string;
  readonly baseSha: string;
  readonly branch: string;
}

export interface WorktreeEvidence {
  readonly repositoryRoot: string;
  readonly canonicalOrigin: string;
  readonly headSha: string;
  readonly branch: string;
  readonly clean: boolean;
  readonly branchCheckoutCount: number;
}

function git(repositoryRoot: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

function normalizeOrigin(origin: string): string {
  return origin
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.git$/i, "")
    .toLowerCase();
}

export function inspectWorktree(
  expectation: WorktreeExpectation,
): WorktreeEvidence {
  if (!path.isAbsolute(expectation.repositoryRoot)) {
    throw new Error("Worktree path must be absolute");
  }
  const root = path.resolve(expectation.repositoryRoot);
  const topLevel = path.resolve(git(root, ["rev-parse", "--show-toplevel"]));
  if (
    realpathSync.native(topLevel).toLowerCase() !==
    realpathSync.native(root).toLowerCase()
  ) {
    throw new Error("Repository root does not match Git top-level");
  }
  const origin = git(root, ["remote", "get-url", "origin"]);
  if (
    normalizeOrigin(origin) !== normalizeOrigin(expectation.canonicalOrigin)
  ) {
    throw new Error("Canonical origin mismatch");
  }
  const headSha = git(root, ["rev-parse", "HEAD"]);
  if (headSha !== expectation.baseSha) {
    throw new Error("Worktree HEAD does not match approved base SHA");
  }
  const branch = git(root, ["branch", "--show-current"]);
  if (branch !== expectation.branch) {
    throw new Error("Worktree branch mismatch");
  }
  const clean = git(root, ["status", "--porcelain=v1"]).length === 0;
  if (!clean) {
    throw new Error("Worktree contains uncommitted changes");
  }

  const porcelain = git(root, ["worktree", "list", "--porcelain"]);
  const branchRef = `branch refs/heads/${expectation.branch}`;
  const branchCheckoutCount = porcelain
    .split(/\r?\n/)
    .filter((line) => line === branchRef).length;
  if (branchCheckoutCount !== 1) {
    throw new Error("Branch must be checked out in exactly one worktree");
  }

  return {
    repositoryRoot: root,
    canonicalOrigin: origin,
    headSha,
    branch,
    clean,
    branchCheckoutCount,
  };
}
