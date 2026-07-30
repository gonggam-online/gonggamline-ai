export interface AppServerInterrupt {
  interruptTurn(threadId: string, turnId: string): Promise<"acknowledged" | "missing">;
}

export interface OwnedProcess {
  readonly pid: number;
  readonly parentPid: number | null;
  readonly executable: string;
  readonly taskId: string | null;
}

export interface ProcessRecoveryPlan {
  readonly safeToStop: readonly number[];
  readonly refused: readonly number[];
  readonly reason: "APP_SERVER_ACKNOWLEDGED" | "OWNED_PROCESS_TREE" | "MANUAL_RECONCILIATION";
}

const codexExecutables = new Set(["codex.exe", "node.exe", "codex.cmd"]);

export function planWindowsProcessRecovery(
  taskId: string,
  rootPid: number,
  processes: readonly OwnedProcess[],
  appServerAcknowledged: boolean,
): ProcessRecoveryPlan {
  if (appServerAcknowledged) {
    return { safeToStop: [], refused: [], reason: "APP_SERVER_ACKNOWLEDGED" };
  }

  const byParent = new Map<number, OwnedProcess[]>();
  for (const process of processes) {
    if (process.parentPid !== null) {
      const children = byParent.get(process.parentPid) ?? [];
      children.push(process);
      byParent.set(process.parentPid, children);
    }
  }

  const pending = [rootPid];
  const candidates = new Set<number>();
  while (pending.length > 0) {
    const pid = pending.pop();
    if (pid === undefined || candidates.has(pid)) {
      continue;
    }
    candidates.add(pid);
    for (const child of byParent.get(pid) ?? []) {
      pending.push(child.pid);
    }
  }

  const safeToStop: number[] = [];
  const refused: number[] = [];
  for (const pid of candidates) {
    const process = processes.find((candidate) => candidate.pid === pid);
    const executable = process?.executable.toLowerCase();
    if (
      process !== undefined &&
      process.taskId === taskId &&
      executable !== undefined &&
      codexExecutables.has(executable)
    ) {
      safeToStop.push(pid);
    } else {
      refused.push(pid);
    }
  }

  if (refused.length > 0) {
    return {
      safeToStop: [],
      refused: refused.sort((left, right) => left - right),
      reason: "MANUAL_RECONCILIATION",
    };
  }

  const childFirst: number[] = [];
  const visit = (pid: number): void => {
    for (const child of byParent.get(pid) ?? []) {
      visit(child.pid);
    }
    childFirst.push(pid);
  };
  visit(rootPid);
  return {
    safeToStop: childFirst,
    refused: [],
    reason: "OWNED_PROCESS_TREE",
  };
}

export async function interruptThenPlanRecovery(input: {
  readonly taskId: string;
  readonly threadId: string | null;
  readonly turnId: string | null;
  readonly rootPid: number;
  readonly processes: readonly OwnedProcess[];
  readonly appServer: AppServerInterrupt;
}): Promise<ProcessRecoveryPlan> {
  const acknowledged =
    input.threadId !== null &&
    input.turnId !== null &&
    (await input.appServer.interruptTurn(input.threadId, input.turnId)) ===
      "acknowledged";

  return planWindowsProcessRecovery(
    input.taskId,
    input.rootPid,
    input.processes,
    acknowledged,
  );
}
