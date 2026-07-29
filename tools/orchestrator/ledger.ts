import { createHash } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { assertTransition, type TaskState } from "./state-machine.ts";

export interface TaskIdentity {
  readonly projectId: string;
  readonly taskId: string;
  readonly parentTaskId: string | null;
  readonly idempotencyKey: string;
}

export interface RouteAssignment {
  readonly taskId: string;
  readonly repositoryId: string;
  readonly pcId: string;
  readonly branch: string;
  readonly worktreePath: string;
}

export interface TaskLease {
  readonly taskId: string;
  readonly controllerId: string;
  readonly expiresAt: string;
}

interface TaskStateRow {
  state: TaskState;
}

interface TaskIdentityRow {
  task_id: string;
  project_id: string;
  parent_task_id: string | null;
  idempotency_key: string;
}

interface AuditRow {
  sequence: number;
  occurred_at: string;
  event_type: string;
  payload_json: string;
  previous_hash: string | null;
  event_hash: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertLedgerOutsideRepository(
  databasePath: string,
  repositoryRoot: string,
): void {
  if (databasePath === ":memory:") {
    return;
  }
  if (!path.isAbsolute(databasePath)) {
    throw new Error("Ledger path must be absolute");
  }
  if (isPathWithin(repositoryRoot, databasePath)) {
    throw new Error("Ledger must be stored outside the Git repository");
  }
}

export class OrchestratorLedger {
  readonly #database: DatabaseSync;

  constructor(databasePath: string, repositoryRoot: string) {
    assertLedgerOutsideRepository(databasePath, repositoryRoot);
    this.#database = new DatabaseSync(databasePath);
    this.#database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.#migrate();
  }

  close(): void {
    this.#database.close();
  }

  #migrate(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const version = this.#database
      .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
      .get() as { version: number };
    if (version.version >= 1) {
      return;
    }

    this.#transaction(() => {
      this.#database.exec(`
        CREATE TABLE projects (
          project_id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL
        );
        CREATE TABLE repositories (
          repository_id TEXT PRIMARY KEY,
          canonical_origin TEXT NOT NULL UNIQUE,
          integration_branch TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE pcs (
          pc_id TEXT PRIMARY KEY,
          capability_fingerprint TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE tasks (
          task_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(project_id),
          parent_task_id TEXT REFERENCES tasks(task_id),
          idempotency_key TEXT NOT NULL UNIQUE,
          state TEXT NOT NULL,
          attempt INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE task_routes (
          task_id TEXT PRIMARY KEY REFERENCES tasks(task_id),
          repository_id TEXT NOT NULL REFERENCES repositories(repository_id),
          pc_id TEXT NOT NULL REFERENCES pcs(pc_id),
          branch TEXT NOT NULL,
          worktree_path TEXT NOT NULL,
          released_at TEXT
        );
        CREATE UNIQUE INDEX active_route_branch
          ON task_routes(repository_id, branch)
          WHERE released_at IS NULL;
        CREATE UNIQUE INDEX active_route_worktree
          ON task_routes(worktree_path)
          WHERE released_at IS NULL;
        CREATE TABLE leases (
          task_id TEXT PRIMARY KEY REFERENCES tasks(task_id),
          controller_id TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE action_keys (
          action_scope TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          external_reference TEXT,
          created_at TEXT NOT NULL,
          PRIMARY KEY(action_scope, idempotency_key)
        );
        CREATE TABLE audit_events (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          occurred_at TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          previous_hash TEXT,
          event_hash TEXT NOT NULL UNIQUE
        );
        INSERT INTO schema_migrations(version, applied_at)
          VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      `);
    });
  }

  #transaction<T>(operation: () => T): T {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  registerProject(projectId: string, now: string): void {
    this.#database
      .prepare(
        "INSERT OR IGNORE INTO projects(project_id, created_at) VALUES (?, ?)",
      )
      .run(projectId, now);
  }

  registerRepository(input: {
    repositoryId: string;
    canonicalOrigin: string;
    integrationBranch: string;
    now: string;
  }): void {
    this.#database
      .prepare(
        `INSERT OR IGNORE INTO repositories(
          repository_id, canonical_origin, integration_branch, created_at
        ) VALUES (?, ?, ?, ?)`,
      )
      .run(
        input.repositoryId,
        input.canonicalOrigin,
        input.integrationBranch,
        input.now,
      );
  }

  registerPc(pcId: string, capabilityFingerprint: string, now: string): void {
    this.#database
      .prepare(
        `INSERT OR IGNORE INTO pcs(pc_id, capability_fingerprint, created_at)
         VALUES (?, ?, ?)`,
      )
      .run(pcId, capabilityFingerprint, now);
  }

  createTask(identity: TaskIdentity, now: string): "CREATED" | "EXISTS" {
    return this.#transaction(() => {
      const result = this.#database
        .prepare(
          `INSERT OR IGNORE INTO tasks(
            task_id, project_id, parent_task_id, idempotency_key,
            state, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'PLANNED', ?, ?)`,
        )
        .run(
          identity.taskId,
          identity.projectId,
          identity.parentTaskId,
          identity.idempotencyKey,
          now,
          now,
        );
      if (result.changes === 0) {
        const existing = this.#database
          .prepare(
            `SELECT task_id, project_id, parent_task_id, idempotency_key
             FROM tasks WHERE task_id = ? OR idempotency_key = ?`,
          )
          .get(identity.taskId, identity.idempotencyKey) as
          | TaskIdentityRow
          | undefined;
        if (
          existing?.task_id === identity.taskId &&
          existing.project_id === identity.projectId &&
          existing.parent_task_id === identity.parentTaskId &&
          existing.idempotency_key === identity.idempotencyKey
        ) {
          return "EXISTS";
        }
        throw new Error("Task identity or idempotency key collision");
      }
      this.appendAudit("TASK_CREATED", identity, now);
      return "CREATED";
    });
  }

  taskState(taskId: string): TaskState {
    const row = this.#database
      .prepare("SELECT state FROM tasks WHERE task_id = ?")
      .get(taskId) as TaskStateRow | undefined;
    if (row === undefined) {
      throw new Error(`Unknown task: ${taskId}`);
    }
    return row.state;
  }

  transition(taskId: string, to: TaskState, now: string): void {
    this.#transaction(() => {
      const from = this.taskState(taskId);
      assertTransition(from, to);
      this.#database
        .prepare("UPDATE tasks SET state = ?, updated_at = ? WHERE task_id = ?")
        .run(to, now, taskId);
      this.appendAudit("TASK_TRANSITIONED", { taskId, from, to }, now);
    });
  }

  assignRoute(route: RouteAssignment, now: string): void {
    this.#transaction(() => {
      this.#database
        .prepare(
          `INSERT INTO task_routes(
            task_id, repository_id, pc_id, branch, worktree_path, released_at
          ) VALUES (?, ?, ?, ?, ?, NULL)`,
        )
        .run(
          route.taskId,
          route.repositoryId,
          route.pcId,
          route.branch,
          route.worktreePath,
        );
      this.appendAudit("TASK_ROUTED", route, now);
    });
  }

  releaseRoute(taskId: string, now: string): void {
    this.#transaction(() => {
      this.#database
        .prepare(
          "UPDATE task_routes SET released_at = ? WHERE task_id = ? AND released_at IS NULL",
        )
        .run(now, taskId);
      this.appendAudit("ROUTE_RELEASED", { taskId }, now);
    });
  }

  acquireLease(lease: TaskLease, now: string): boolean {
    return this.#transaction(() => {
      const result = this.#database
        .prepare(
          `INSERT INTO leases(task_id, controller_id, expires_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(task_id) DO UPDATE SET
             controller_id = excluded.controller_id,
             expires_at = excluded.expires_at,
             updated_at = excluded.updated_at
           WHERE leases.expires_at <= excluded.updated_at
              OR leases.controller_id = excluded.controller_id`,
        )
        .run(lease.taskId, lease.controllerId, lease.expiresAt, now);
      if (result.changes === 1) {
        this.appendAudit(
          "LEASE_ACQUIRED",
          {
            taskId: lease.taskId,
            controllerId: lease.controllerId,
            expiresAt: lease.expiresAt,
          },
          now,
        );
        return true;
      }
      return false;
    });
  }

  expiredRunningTasks(now: string): string[] {
    const rows = this.#database
      .prepare(
        `SELECT tasks.task_id AS taskId
         FROM tasks
         LEFT JOIN leases ON leases.task_id = tasks.task_id
         WHERE tasks.state = 'RUNNING'
           AND (leases.task_id IS NULL OR leases.expires_at <= ?)
         ORDER BY tasks.task_id`,
      )
      .all(now) as { taskId: string }[];
    return rows.map(({ taskId }) => taskId);
  }

  reserveAction(input: {
    actionScope: string;
    idempotencyKey: string;
    payload: unknown;
    now: string;
  }): "RESERVED" | "EXISTS" {
    const payloadHash = sha256(stableJson(input.payload));
    return this.#transaction(() => {
      const existing = this.#database
        .prepare(
          `SELECT payload_hash AS payloadHash FROM action_keys
           WHERE action_scope = ? AND idempotency_key = ?`,
        )
        .get(input.actionScope, input.idempotencyKey) as
        | { payloadHash: string }
        | undefined;
      if (existing !== undefined) {
        if (existing.payloadHash !== payloadHash) {
          throw new Error("Idempotency key payload mismatch");
        }
        return "EXISTS";
      }
      this.#database
        .prepare(
          `INSERT INTO action_keys(
            action_scope, idempotency_key, payload_hash, created_at
          ) VALUES (?, ?, ?, ?)`,
        )
        .run(input.actionScope, input.idempotencyKey, payloadHash, input.now);
      this.appendAudit(
        "ACTION_RESERVED",
        {
          actionScope: input.actionScope,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
        },
        input.now,
      );
      return "RESERVED";
    });
  }

  recordExternalReference(
    actionScope: string,
    idempotencyKey: string,
    externalReference: string,
  ): void {
    const result = this.#database
      .prepare(
        `UPDATE action_keys SET external_reference = ?
         WHERE action_scope = ? AND idempotency_key = ?
           AND (external_reference IS NULL OR external_reference = ?)`,
      )
      .run(externalReference, actionScope, idempotencyKey, externalReference);
    if (result.changes !== 1) {
      throw new Error("External action reference conflict");
    }
  }

  appendAudit(eventType: string, payload: unknown, occurredAt: string): string {
    const prior = this.#database
      .prepare(
        "SELECT event_hash AS eventHash FROM audit_events ORDER BY sequence DESC LIMIT 1",
      )
      .get() as { eventHash: string } | undefined;
    const payloadJson = stableJson(payload);
    const previousHash = prior?.eventHash ?? null;
    const eventHash = sha256(
      stableJson({ eventType, occurredAt, payload: JSON.parse(payloadJson), previousHash }),
    );
    this.#database
      .prepare(
        `INSERT INTO audit_events(
          occurred_at, event_type, payload_json, previous_hash, event_hash
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(occurredAt, eventType, payloadJson, previousHash, eventHash);
    return eventHash;
  }

  verifyAuditChain(): boolean {
    const rows = this.#database
      .prepare(
        `SELECT sequence, occurred_at, event_type, payload_json,
                previous_hash, event_hash
         FROM audit_events ORDER BY sequence`,
      )
      .all() as unknown as AuditRow[];
    let previousHash: string | null = null;
    for (const row of rows) {
      const expected = sha256(
        stableJson({
          eventType: row.event_type,
          occurredAt: row.occurred_at,
          payload: JSON.parse(row.payload_json),
          previousHash,
        }),
      );
      if (row.previous_hash !== previousHash || row.event_hash !== expected) {
        return false;
      }
      previousHash = row.event_hash;
    }
    return true;
  }
}
