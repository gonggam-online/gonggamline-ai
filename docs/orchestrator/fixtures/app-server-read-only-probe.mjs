import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

const options = Object.fromEntries(
  process.argv
    .slice(2)
    .map((entry) => entry.split(/=(.*)/s).slice(0, 2)),
);

const codexPath = options["--codex"];
const cwd = options["--cwd"];
const outputPath = options["--output"];

if (!codexPath || !cwd || !outputPath) {
  throw new Error(
    "Usage: node app-server-read-only-probe.mjs --codex=<path> --cwd=<path> --output=<path>",
  );
}

const child = spawn(codexPath, ["app-server", "--stdio"], {
  cwd,
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let requestId = 0;
const pending = new Map();
const notifications = [];
const stderrLines = [];

const stdout = createInterface({ input: child.stdout });
const stderr = createInterface({ input: child.stderr });

stderr.on("line", (line) => {
  stderrLines.push(line.replace(/[A-Za-z]:\\[^ \r\n"]+/g, "<local-path>"));
});

stdout.on("line", (line) => {
  const message = JSON.parse(line);

  if ("id" in message && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);

    if (message.error) {
      reject(new Error(JSON.stringify(message.error)));
    } else {
      resolve(message.result);
    }
    return;
  }

  if (message.method) {
    notifications.push({
      method: message.method,
      threadId: message.params?.threadId ?? message.params?.thread?.id ?? null,
      turnId: message.params?.turnId ?? message.params?.turn?.id ?? null,
      status: message.params?.turn?.status ?? null,
      usage: message.params?.tokenUsage ?? message.params?.usage ?? null,
    });
  }
});

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params) {
  const id = ++requestId;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ method, id, params });
  });
}

function waitForNotification(method, predicate = () => true, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const poll = () => {
      const match = notifications.find(
        (notification) =>
          notification.method === method && predicate(notification),
      );

      if (match) {
        resolve(match);
      } else if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${method}`));
      } else {
        setTimeout(poll, 50);
      }
    };

    poll();
  });
}

function hashJson(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

let summary;

try {
  const initialize = await request("initialize", {
    clientInfo: {
      name: "gonggamline_phase_0",
      title: "GonggamLine Orchestrator Phase 0",
      version: "1.0.0",
    },
    capabilities: {
      experimentalApi: true,
    },
  });
  send({ method: "initialized", params: {} });

  const started = await request("thread/start", {
    cwd,
    sandbox: "read-only",
    ephemeral: false,
    experimentalRawEvents: false,
  });
  const threadId = started.thread.id;

  const firstTurn = await request("turn/start", {
    threadId,
    input: [
      {
        type: "text",
        text: "Return exactly READ_ONLY_OK. Do not run commands, use tools, access the network, or edit files.",
      },
    ],
  });
  await waitForNotification(
    "turn/completed",
    (notification) => notification.turnId === firstTurn.turn.id,
  );

  const read = await request("thread/read", {
    threadId,
    includeTurns: true,
  });
  const resumed = await request("thread/resume", {
    threadId,
    cwd,
    sandbox: "read-only",
  });

  const cancelTurn = await request("turn/start", {
    threadId,
    input: [
      {
        type: "text",
        text: "Read-only cancellation probe. Run the shell command Start-Sleep -Seconds 30, then return CANCEL_PROBE_DONE. Do not edit files or use the network.",
      },
    ],
  });
  await waitForNotification(
    "turn/started",
    (notification) => notification.turnId === cancelTurn.turn.id,
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  const interrupt = await request("turn/interrupt", {
    threadId,
    turnId: cancelTurn.turn.id,
  });
  const cancelled = await waitForNotification(
    "turn/completed",
    (notification) => notification.turnId === cancelTurn.turn.id,
  );

  const methodCounts = Object.fromEntries(
    [...new Set(notifications.map(({ method }) => method))]
      .sort()
      .map((method) => [
        method,
        notifications.filter((item) => item.method === method).length,
      ]),
  );
  const usageNotifications = notifications
    .filter(({ usage }) => usage)
    .map(({ method, usage }) => ({ method, usage }));

  summary = {
    schemaVersion: "1.0.0",
    initialized: Boolean(initialize),
    threadId,
    firstTurnId: firstTurn.turn.id,
    firstTurnCompleted: true,
    threadReadTurnCount: read.thread.turns?.length ?? 0,
    resumedThreadId: resumed.thread.id,
    resumeMatched: resumed.thread.id === threadId,
    interruptedTurnId: cancelTurn.turn.id,
    interruptAcknowledged: interrupt !== undefined,
    interruptedTurnStatus: cancelled.status,
    notificationMethodCounts: methodCounts,
    usageNotifications,
    stderrCategories: [
      ...new Set(
        stderrLines.map((line) =>
          line.includes("WARN")
            ? "WARN"
            : line.includes("ERROR")
              ? "ERROR"
              : "OTHER",
        ),
      ),
    ],
  };
  summary.sha256 = hashJson(summary);
} finally {
  child.stdin.end();

  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) =>
      setTimeout(() => {
        child.kill();
        resolve();
      }, 5000),
    ),
  ]);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
