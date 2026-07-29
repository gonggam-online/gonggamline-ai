import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";

import { evaluatePath, type PathPolicy } from "./policy.ts";

export interface WorkspaceBoundary {
  readonly repositoryRoot: string;
  readonly canonicalOrigin: string;
  readonly branch: string;
  readonly baseSha: string;
  readonly pathPolicy: PathPolicy;
}

export interface WorkspaceSnapshot {
  readonly statusHash: string;
  readonly changedPaths: readonly string[];
}

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

function gitRaw(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).replace(/\r?\n$/, "");
}

function normalizedOrigin(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\.git$/i, "").toLowerCase();
}

function assertContained(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error("Workspace path escapes the approved repository");
}

function assertNoSymlinkTraversal(root: string, relativePath: string): void {
  let current = root;
  for (const segment of relativePath.split("/").filter(Boolean)) {
    current = path.join(current, segment);
    if (!existsSync(current)) {
      break;
    }
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`Symlink traversal is not allowed: ${relativePath}`);
    }
    assertContained(root, realpathSync.native(current));
  }
}

export function inspectExecutionWorkspace(
  boundary: WorkspaceBoundary,
  expectedStatusHash?: string,
): WorkspaceSnapshot {
  if (!path.isAbsolute(boundary.repositoryRoot)) {
    throw new Error("Repository root must be absolute");
  }
  const root = realpathSync.native(path.resolve(boundary.repositoryRoot));
  const topLevel = realpathSync.native(
    path.resolve(git(root, ["rev-parse", "--show-toplevel"])),
  );
  if (root.toLowerCase() !== topLevel.toLowerCase()) {
    throw new Error("Repository root does not match Git top-level");
  }
  if (
    normalizedOrigin(git(root, ["remote", "get-url", "origin"])) !==
    normalizedOrigin(boundary.canonicalOrigin)
  ) {
    throw new Error("Canonical origin mismatch");
  }
  const branch = git(root, ["branch", "--show-current"]);
  if (branch === "main" || branch === "master") {
    throw new Error("Direct work on the integration branch is forbidden");
  }
  if (branch !== boundary.branch) {
    throw new Error("Workspace branch mismatch");
  }
  const branchRef = `branch refs/heads/${boundary.branch}`;
  const branchCheckoutCount = gitRaw(root, ["worktree", "list", "--porcelain"])
    .split(/\r?\n/)
    .filter((line) => line === branchRef).length;
  if (branchCheckoutCount !== 1) {
    throw new Error("Branch must be checked out in exactly one worktree");
  }
  if (git(root, ["rev-parse", "HEAD"]) !== boundary.baseSha) {
    throw new Error("Workspace HEAD does not match the approved base SHA");
  }

  const status = gitRaw(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const statusHash = createHash("sha256").update(status, "utf8").digest("hex");
  if (expectedStatusHash !== undefined && statusHash !== expectedStatusHash) {
    throw new Error("Workspace changed outside the owned execution");
  }
  const changedPaths = status
    .split(/\r?\n/)
    .filter((entry) => entry.length > 3)
    .map((entry) => entry.slice(3).replace(/^.* -> /, "").replace(/\\/g, "/"))
    .sort();
  for (const changedPath of changedPaths) {
    if (changedPath.includes("\0") || path.isAbsolute(changedPath)) {
      throw new Error("Invalid changed path");
    }
    const normalized = path.posix.normalize(changedPath);
    if (normalized === ".." || normalized.startsWith("../")) {
      throw new Error("Changed path escapes the workspace");
    }
    const decision = evaluatePath(boundary.pathPolicy, normalized);
    if (!decision.allowed) {
      throw new Error(`Changed path is not allowed: ${normalized}`);
    }
    assertNoSymlinkTraversal(root, normalized);
  }
  return { statusHash, changedPaths };
}

export function assertCleanStart(snapshot: WorkspaceSnapshot): void {
  if (snapshot.changedPaths.length > 0) {
    throw new Error("Workspace must be clean before the first attempt");
  }
}
