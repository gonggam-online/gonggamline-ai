import {
  createVerifiedCommit,
  pushExactHead,
  reconcileDraftPullRequest,
  type CommitRequest,
  type DeliveryActionResult,
  type DeliveryCommandRunner,
  type PullRequestRequest,
} from "./delivery-actions.ts";
import {
  observeExactHeadWorkflows,
  observeExactPreview,
  observePreviewBrowserEvidence,
  type BrowserEvidence,
  type PreviewEvidence,
  type WorkflowEvidence,
} from "./delivery-observer.ts";
import { OrchestratorLedger } from "./ledger.ts";

export type DeliveryWaitState =
  | "WAITING_FOR_CI"
  | "WAITING_FOR_PREVIEW"
  | "WAITING_FOR_PREVIEW_VALIDATION"
  | "WAITING_FOR_HUMAN"
  | "FAILED";

export interface DeliveryPipelineRequest {
  readonly commit: CommitRequest;
  readonly pushIdempotencyKey: string;
  readonly pullRequest: Omit<PullRequestRequest, "identity">;
  readonly requiredWorkflowNames: readonly ["CI", "Preview browser validation"];
}

export interface DeliveryPipelineResult {
  readonly state: DeliveryWaitState;
  readonly headSha: string;
  readonly commit: DeliveryActionResult;
  readonly push: DeliveryActionResult;
  readonly pullRequest: DeliveryActionResult;
  readonly workflows: readonly WorkflowEvidence[];
  readonly preview: PreviewEvidence | null;
  readonly browser: BrowserEvidence | null;
  readonly failureCode: string | null;
}

function prNumber(url: string): number {
  const match = /\/pull\/(\d+)$/.exec(url);
  if (match?.[1] === undefined) {
    throw new Error("Pull request reference is not canonical");
  }
  return Number(match[1]);
}

function failedWorkflow(
  workflows: readonly WorkflowEvidence[],
): WorkflowEvidence | undefined {
  return workflows.find(({ status }) => status === "FAILED");
}

export function runDeliveryPipeline(
  ledger: OrchestratorLedger,
  request: DeliveryPipelineRequest,
  runner: DeliveryCommandRunner,
): DeliveryPipelineResult {
  const identity = request.commit.identity;
  const commit = createVerifiedCommit(ledger, request.commit, runner);
  const headSha = commit.reference;
  const push = pushExactHead(
    ledger,
    identity,
    request.pushIdempotencyKey,
    runner,
  );
  if (push.reference !== headSha) {
    throw new Error("Push reference does not match the committed exact head");
  }
  const pullRequest = reconcileDraftPullRequest(
    ledger,
    { ...request.pullRequest, identity },
    runner,
  );
  prNumber(pullRequest.reference);
  const workflows = observeExactHeadWorkflows({
    repositoryRoot: identity.repositoryRoot,
    repositoryFullName: identity.repositoryFullName,
    headSha,
    requiredWorkflowNames: request.requiredWorkflowNames,
    runner,
  });
  if (failedWorkflow(workflows) !== undefined) {
    return {
      state: "FAILED",
      headSha,
      commit,
      push,
      pullRequest,
      workflows,
      preview: null,
      browser: null,
      failureCode: "CI_FAILED",
    };
  }
  if (workflows.some(({ status }) => status === "WAITING")) {
    return {
      state: "WAITING_FOR_CI",
      headSha,
      commit,
      push,
      pullRequest,
      workflows,
      preview: null,
      browser: null,
      failureCode: null,
    };
  }
  const preview = observeExactPreview({
    repositoryRoot: identity.repositoryRoot,
    repositoryFullName: identity.repositoryFullName,
    headSha,
    runner,
  });
  if (preview.status === "FAILED") {
    return {
      state: "FAILED",
      headSha,
      commit,
      push,
      pullRequest,
      workflows,
      preview,
      browser: null,
      failureCode: "PREVIEW_FAILED",
    };
  }
  if (preview.status === "WAITING") {
    return {
      state: "WAITING_FOR_PREVIEW",
      headSha,
      commit,
      push,
      pullRequest,
      workflows,
      preview,
      browser: null,
      failureCode: null,
    };
  }
  const browserWorkflow = workflows.find(
    ({ name }) => name === "Preview browser validation",
  );
  if (browserWorkflow === undefined) {
    throw new Error("Preview browser workflow evidence is missing");
  }
  const browser = observePreviewBrowserEvidence({
    repositoryRoot: identity.repositoryRoot,
    repositoryFullName: identity.repositoryFullName,
    headSha,
    workflow: browserWorkflow,
    runner,
  });
  if (browser.status === "FAILED") {
    return {
      state: "FAILED",
      headSha,
      commit,
      push,
      pullRequest,
      workflows,
      preview,
      browser,
      failureCode: "PREVIEW_BROWSER_FAILED",
    };
  }
  if (browser.status === "WAITING") {
    return {
      state: "WAITING_FOR_PREVIEW_VALIDATION",
      headSha,
      commit,
      push,
      pullRequest,
      workflows,
      preview,
      browser,
      failureCode: null,
    };
  }
  ledger.appendAudit(
    "DELIVERY_WAITING_FOR_HUMAN",
    {
      taskId: identity.taskId,
      headSha,
      pr: prNumber(pullRequest.reference),
      previewDeployment: preview.deploymentId,
      browserArtifact: browser.artifactId,
    },
    new Date().toISOString(),
  );
  return {
    state: "WAITING_FOR_HUMAN",
    headSha,
    commit,
    push,
    pullRequest,
    workflows,
    preview,
    browser,
    failureCode: null,
  };
}
