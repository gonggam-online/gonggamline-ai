import { createHash } from "node:crypto";

import {
  localDeliveryCommandRunner,
  type DeliveryCommandRunner,
} from "./delivery-actions.ts";

export type ObservationStatus = "WAITING" | "SUCCEEDED" | "FAILED";

export interface WorkflowEvidence {
  readonly name: string;
  readonly runId: number;
  readonly status: ObservationStatus;
  readonly url: string;
  readonly headSha: string;
}

export interface PreviewEvidence {
  readonly deploymentId: number;
  readonly status: ObservationStatus;
  readonly url: string | null;
  readonly headSha: string;
  readonly environment: "Preview";
}

export interface BrowserEvidence {
  readonly workflowRunId: number;
  readonly status: ObservationStatus;
  readonly artifactId: number | null;
  readonly artifactName: "preview-browser-evidence";
  readonly artifactDigest: string | null;
  readonly headSha: string;
}

interface WorkflowRun {
  readonly databaseId: number;
  readonly headSha: string;
  readonly status: string;
  readonly conclusion: string;
  readonly workflowName: string;
  readonly url: string;
}

interface Deployment {
  readonly id: number;
  readonly sha: string;
  readonly environment: string;
}

interface DeploymentStatus {
  readonly state: string;
  readonly environment_url?: string | null;
  readonly target_url?: string | null;
}

interface Artifact {
  readonly id: number;
  readonly name: string;
  readonly expired: boolean;
  readonly size_in_bytes: number;
  readonly archive_download_url: string;
}

function api(
  runner: DeliveryCommandRunner,
  repositoryRoot: string,
  endpoint: string,
): unknown {
  const result = runner.run("gh", ["api", endpoint], repositoryRoot);
  if (result.exitCode !== 0) {
    throw new Error("GitHub observation failed");
  }
  return JSON.parse(result.stdout) as unknown;
}

function arrayOf<T>(value: unknown, name: string): readonly T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} response is malformed`);
  }
  return value as readonly T[];
}

function workflowStatus(run: WorkflowRun): ObservationStatus {
  if (run.status !== "completed") {
    return "WAITING";
  }
  return run.conclusion === "success" ? "SUCCEEDED" : "FAILED";
}

export function observeExactHeadWorkflows(input: {
  readonly repositoryRoot: string;
  readonly repositoryFullName: string;
  readonly headSha: string;
  readonly requiredWorkflowNames: readonly string[];
  readonly runner?: DeliveryCommandRunner;
}): readonly WorkflowEvidence[] {
  const runner = input.runner ?? localDeliveryCommandRunner;
  const result = runner.run(
    "gh",
    [
      "run",
      "list",
      "--repo",
      input.repositoryFullName,
      "--commit",
      input.headSha,
      "--event",
      "pull_request",
      "--json",
      "databaseId,headSha,status,conclusion,workflowName,url",
      "--limit",
      "50",
    ],
    input.repositoryRoot,
  );
  if (result.exitCode !== 0) {
    throw new Error("GitHub workflow observation failed");
  }
  const runs = arrayOf<WorkflowRun>(
    JSON.parse(result.stdout) as unknown,
    "Workflow",
  );
  return input.requiredWorkflowNames.map((name) => {
    const matches = runs.filter(
      (run) => run.workflowName === name && run.headSha === input.headSha,
    );
    if (matches.length > 1) {
      matches.sort((left, right) => right.databaseId - left.databaseId);
    }
    const run = matches[0];
    if (run === undefined) {
      return {
        name,
        runId: 0,
        status: "WAITING",
        url: "",
        headSha: input.headSha,
      };
    }
    return {
      name,
      runId: run.databaseId,
      status: workflowStatus(run),
      url: run.url,
      headSha: run.headSha,
    };
  });
}

export function observeExactPreview(input: {
  readonly repositoryRoot: string;
  readonly repositoryFullName: string;
  readonly headSha: string;
  readonly runner?: DeliveryCommandRunner;
}): PreviewEvidence {
  const runner = input.runner ?? localDeliveryCommandRunner;
  const deployments = arrayOf<Deployment>(
    api(
      runner,
      input.repositoryRoot,
      `repos/${input.repositoryFullName}/deployments?sha=${input.headSha}&environment=Preview&per_page=10`,
    ),
    "Deployment",
  ).filter(
    (deployment) =>
      deployment.sha === input.headSha && deployment.environment === "Preview",
  );
  const deployment = deployments[0];
  if (deployment === undefined) {
    return {
      deploymentId: 0,
      status: "WAITING",
      url: null,
      headSha: input.headSha,
      environment: "Preview",
    };
  }
  const statuses = arrayOf<DeploymentStatus>(
    api(
      runner,
      input.repositoryRoot,
      `repos/${input.repositoryFullName}/deployments/${deployment.id}/statuses?per_page=5`,
    ),
    "Deployment status",
  );
  const latest = statuses[0];
  const status: ObservationStatus =
    latest === undefined || ["pending", "queued", "in_progress"].includes(latest.state)
      ? "WAITING"
      : latest.state === "success"
        ? "SUCCEEDED"
        : "FAILED";
  const url = latest?.environment_url ?? latest?.target_url ?? null;
  if (status === "SUCCEEDED" && (url === null || !url.startsWith("https://"))) {
    throw new Error("Successful Preview is missing a secure URL");
  }
  return {
    deploymentId: deployment.id,
    status,
    url,
    headSha: deployment.sha,
    environment: "Preview",
  };
}

export function observePreviewBrowserEvidence(input: {
  readonly repositoryRoot: string;
  readonly repositoryFullName: string;
  readonly headSha: string;
  readonly workflow: WorkflowEvidence;
  readonly runner?: DeliveryCommandRunner;
}): BrowserEvidence {
  if (
    input.workflow.name !== "Preview browser validation" ||
    input.workflow.headSha !== input.headSha
  ) {
    throw new Error("Browser evidence workflow identity mismatch");
  }
  if (input.workflow.status !== "SUCCEEDED") {
    return {
      workflowRunId: input.workflow.runId,
      status: input.workflow.status,
      artifactId: null,
      artifactName: "preview-browser-evidence",
      artifactDigest: null,
      headSha: input.headSha,
    };
  }
  const runner = input.runner ?? localDeliveryCommandRunner;
  const response = api(
    runner,
    input.repositoryRoot,
    `repos/${input.repositoryFullName}/actions/runs/${input.workflow.runId}/artifacts`,
  ) as { readonly artifacts?: readonly Artifact[] };
  const artifact = response.artifacts?.find(
    (candidate) =>
      candidate.name === "preview-browser-evidence" && !candidate.expired,
  );
  if (artifact === undefined) {
    throw new Error("Preview browser evidence artifact is missing or expired");
  }
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        id: artifact.id,
        name: artifact.name,
        size: artifact.size_in_bytes,
        url: artifact.archive_download_url,
      }),
      "utf8",
    )
    .digest("hex");
  return {
    workflowRunId: input.workflow.runId,
    status: "SUCCEEDED",
    artifactId: artifact.id,
    artifactName: "preview-browser-evidence",
    artifactDigest: digest,
    headSha: input.headSha,
  };
}
