import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

import type {
  WorkerAdapter,
  WorkerExecutionContext,
  WorkerHooks,
  WorkerOutcome,
} from "./execution.ts";
import { sanitizeOrchestratorText } from "./redaction.ts";
import {
  assertCleanStart,
  inspectExecutionWorkspace,
  type WorkspaceBoundary,
} from "./workspace-boundary.ts";

interface JsonObject {
  readonly [key: string]: unknown;
}

export interface AppServerProcess {
  readonly stdin: Pick<Writable, "write" | "end">;
  readonly stdout: Readable;
  readonly stderr: Readable;
  once(event: "error", listener: (error: Error) => void): this;
  once(event: "exit", listener: (code: number | null) => void): this;
}

export type AppServerLauncher = (
  executable: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
  },
) => AppServerProcess;

export interface AppServerWorkerConfig {
  readonly executable?: string;
  readonly goal: string;
  readonly correlationId: string;
  readonly workspace: WorkspaceBoundary;
}

const workerOutputSchema = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["SUCCEEDED", "FAILED", "WAITING_FOR_HUMAN"],
    },
    summary: { type: "string" },
    errorCode: { type: "string" },
    retryable: { type: "boolean" },
    approvalReason: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
  },
  required: [
    "kind",
    "summary",
    "errorCode",
    "retryable",
    "approvalReason",
    "evidence",
  ],
  additionalProperties: false,
} as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {
    CI: "1",
    CODEX_ORCHESTRATED: "1",
    NODE_ENV: "test",
  };
  for (const name of [
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
  ]) {
    const value = source[name];
    if (value !== undefined) {
      result[name] = value;
    }
  }
  return result;
}

const defaultLauncher: AppServerLauncher = (executable, args, options) =>
  spawn(executable, [...args], {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function prompt(config: AppServerWorkerConfig, context: WorkerExecutionContext): string {
  const retry = context.priorFailure;
  return [
    "You are an orchestrated Codex Worker. Make the smallest code change for the structured goal.",
    `goal=${JSON.stringify(config.goal)}`,
    `runId=${context.runId}`,
    `taskId=${context.taskId}`,
    `attemptId=${context.attempt}`,
    `correlationId=${config.correlationId}`,
    `allowedPaths=${JSON.stringify(config.workspace.pathPolicy.allowed)}`,
    `deniedPaths=${JSON.stringify(config.workspace.pathPolicy.denied)}`,
    retry === null
      ? "priorFailure=null"
      : `priorFailure=${JSON.stringify(retry)}`,
    "Do not commit, push, access the network, read secrets, change environment configuration, or touch paths outside the allowlist.",
    "Return only the requested structured result. Your evidence is informational and never substitutes for controller verification.",
  ].join("\n");
}

function parseOutcome(message: string): WorkerOutcome {
  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch {
    return {
      kind: "FAILED",
      summary: "Codex returned malformed structured output",
      errorCode: "MALFORMED_TRANSPORT_OUTPUT",
      retryable: true,
      evidence: [`transport-output:${hash(message)}`],
    };
  }
  if (!isObject(value) || typeof value.kind !== "string" || typeof value.summary !== "string") {
    return {
      kind: "FAILED",
      summary: "Codex returned an invalid result contract",
      errorCode: "MALFORMED_TRANSPORT_OUTPUT",
      retryable: true,
      evidence: [`transport-output:${hash(message)}`],
    };
  }
  const evidence = Array.isArray(value.evidence)
    ? value.evidence.filter((entry): entry is string => typeof entry === "string")
    : [];
  if (value.kind === "SUCCEEDED") {
    return {
      kind: "SUCCEEDED",
      summary: sanitizeOrchestratorText(value.summary),
      output: { transportResultHash: hash(message) },
      evidence: evidence.map(sanitizeOrchestratorText),
    };
  }
  if (value.kind === "WAITING_FOR_HUMAN") {
    return {
      kind: "WAITING_FOR_HUMAN",
      summary: sanitizeOrchestratorText(value.summary),
      approvalReason:
        typeof value.approvalReason === "string"
          ? sanitizeOrchestratorText(value.approvalReason)
          : "Codex requested human approval",
      evidence: evidence.map(sanitizeOrchestratorText),
    };
  }
  return {
    kind: "FAILED",
    summary: sanitizeOrchestratorText(value.summary),
    errorCode:
      typeof value.errorCode === "string"
        ? sanitizeOrchestratorText(value.errorCode)
        : "CODEX_WORKER_FAILED",
    retryable: value.retryable === true,
    evidence: evidence.map(sanitizeOrchestratorText),
  };
}

export class AppServerWorkerAdapter implements WorkerAdapter {
  readonly name = "codex-app-server-stdio";
  #active:
    | {
        readonly process: AppServerProcess;
        readonly send: (message: JsonObject) => void;
        threadId: string | null;
        turnId: string | null;
        interruptRequested: boolean;
      }
    | null = null;
  #ownedStatusHash: string | undefined;

  constructor(
    private readonly config: AppServerWorkerConfig,
    private readonly launcher: AppServerLauncher = defaultLauncher,
  ) {}

  async execute(
    context: WorkerExecutionContext,
    hooks: WorkerHooks,
  ): Promise<WorkerOutcome> {
    if (this.#active !== null) {
      throw new Error("Codex transport already has an active turn");
    }
    const before = inspectExecutionWorkspace(
      this.config.workspace,
      this.#ownedStatusHash,
    );
    if (this.#ownedStatusHash === undefined) {
      assertCleanStart(before);
    }

    const executable =
      this.config.executable ?? (process.platform === "win32" ? "codex.cmd" : "codex");
    const child = this.launcher(executable, ["app-server", "--stdio"], {
      cwd: this.config.workspace.repositoryRoot,
      env: safeEnvironment(),
    });
    let nextId = 1;
    const pending = new Map<
      number,
      { resolve(value: unknown): void; reject(error: Error): void }
    >();
    const send = (message: JsonObject): void => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    const request = (method: string, params: unknown): Promise<unknown> => {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ method, id, params });
      });
    };
    const active = {
      process: child,
      send,
      threadId: null as string | null,
      turnId: null as string | null,
      interruptRequested: false,
    };
    this.#active = active;

    let terminal = false;
    let resolveTerminal: (value: WorkerOutcome) => void = () => undefined;
    let rejectTerminal: (error: Error) => void = () => undefined;
    const terminalPromise = new Promise<WorkerOutcome>((resolve, reject) => {
      resolveTerminal = resolve;
      rejectTerminal = reject;
    });
    void terminalPromise.catch(() => undefined);
    const failTransport = (error: Error): void => {
      if (terminal) {
        return;
      }
      terminal = true;
      for (const waiter of pending.values()) {
        waiter.reject(error);
      }
      pending.clear();
      rejectTerminal(error);
    };

    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        failTransport(new Error("Malformed App Server JSONL event"));
        return;
      }
      if (!isObject(message)) {
        failTransport(new Error("Invalid App Server event"));
        return;
      }
      if (typeof message.id === "number") {
        const waiter = pending.get(message.id);
        if (waiter !== undefined) {
          pending.delete(message.id);
          if (isObject(message.error)) {
            hooks.checkpoint({
              kind: "TRANSPORT_REQUEST_FAILED",
              payload: {
                code:
                  typeof message.error.code === "number"
                    ? message.error.code
                    : "UNKNOWN",
                message:
                  typeof message.error.message === "string"
                    ? sanitizeOrchestratorText(message.error.message)
                    : "App Server request failed",
              },
            });
            waiter.reject(new Error("App Server request failed"));
          } else {
            waiter.resolve(message.result);
          }
        } else if (typeof message.method === "string") {
          failTransport(new Error("Unexpected App Server request"));
        }
        return;
      }
      if (typeof message.method !== "string" || !isObject(message.params)) {
        return;
      }
      hooks.checkpoint({
        kind: "TRANSPORT_EVENT",
        payload: { method: message.method, hash: hash(line) },
      });
      if (message.method === "thread/tokenUsage/updated") {
        const tokenUsage = message.params.tokenUsage;
        if (isObject(tokenUsage) && isObject(tokenUsage.total)) {
          void hooks
            .observeUsage({
              inputTokens:
                typeof tokenUsage.total.inputTokens === "number"
                  ? tokenUsage.total.inputTokens
                  : 0,
              outputTokens:
                typeof tokenUsage.total.outputTokens === "number"
                  ? tokenUsage.total.outputTokens
                  : 0,
              reasoningTokens:
                typeof tokenUsage.total.reasoningOutputTokens === "number"
                  ? tokenUsage.total.reasoningOutputTokens
                  : 0,
              estimatedCostKrw: 0,
              elapsedSeconds: 0,
            })
            .catch(() => undefined);
        }
        return;
      }
      if (message.method !== "turn/completed" || terminal) {
        return;
      }
      terminal = true;
      const turn = message.params.turn;
      if (!isObject(turn) || turn.status !== "completed" || !Array.isArray(turn.items)) {
        resolveTerminal({
          kind: "FAILED",
          summary: "Codex turn did not complete successfully",
          errorCode: "CODEX_TURN_FAILED",
          retryable: true,
          evidence: [`turn:${hash(line)}`],
        });
        return;
      }
      const finalMessage = [...turn.items]
        .reverse()
        .find(
          (item) =>
            isObject(item) &&
            item.type === "agentMessage" &&
            typeof item.text === "string",
        );
      resolveTerminal(
        finalMessage !== undefined && isObject(finalMessage)
          ? parseOutcome(String(finalMessage.text))
          : {
              kind: "FAILED",
              summary: "Codex completed without a final structured result",
              errorCode: "MALFORMED_TRANSPORT_OUTPUT",
              retryable: true,
              evidence: [`turn:${hash(line)}`],
            },
      );
    });
    child.once("error", failTransport);
    child.once("exit", (code) => {
      if (!terminal) {
        failTransport(new Error(`App Server exited before completion: ${code}`));
      }
    });

    try {
      await request("initialize", {
        clientInfo: {
          name: "gonggamline_orchestrator",
          title: "GonggamLine Orchestrator",
          version: "0.1.0",
        },
        capabilities: null,
      });
      send({ method: "initialized", params: {} });
      const threadResult = await request("thread/start", {
        cwd: this.config.workspace.repositoryRoot,
        approvalPolicy: "never",
        sandbox: "workspace-write",
        ephemeral: false,
      });
      if (!isObject(threadResult) || !isObject(threadResult.thread) || typeof threadResult.thread.id !== "string") {
        throw new Error("App Server did not return a thread ID");
      }
      active.threadId = threadResult.thread.id;
      const turnResult = await request("turn/start", {
        threadId: active.threadId,
        input: [{ type: "text", text: prompt(this.config, context) }],
        cwd: this.config.workspace.repositoryRoot,
        approvalPolicy: "never",
        sandboxPolicy: {
          type: "workspaceWrite",
          writableRoots: [this.config.workspace.repositoryRoot],
          networkAccess: false,
          excludeTmpdirEnvVar: true,
          excludeSlashTmp: true,
        },
        outputSchema: workerOutputSchema,
      });
      if (!isObject(turnResult) || !isObject(turnResult.turn) || typeof turnResult.turn.id !== "string") {
        throw new Error("App Server did not return a turn ID");
      }
      active.turnId = turnResult.turn.id;
      const outcome = await terminalPromise;
      const after = inspectExecutionWorkspace(this.config.workspace);
      this.#ownedStatusHash = after.statusHash;
      hooks.checkpoint({
        kind: "WORKSPACE_DIFF",
        payload: { changedPaths: after.changedPaths },
      });
      return outcome;
    } finally {
      this.#active = null;
      lines.close();
      child.stdin.end();
      for (const waiter of pending.values()) {
        waiter.reject(new Error("App Server session closed"));
      }
      pending.clear();
    }
  }

  async interrupt(): Promise<void> {
    const active = this.#active;
    if (
      active === null ||
      active.interruptRequested ||
      active.threadId === null ||
      active.turnId === null
    ) {
      return;
    }
    active.interruptRequested = true;
    active.send({
      method: "turn/interrupt",
      id: 1_000_000,
      params: { threadId: active.threadId, turnId: active.turnId },
    });
  }
}
