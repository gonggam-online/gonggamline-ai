import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { WingReadRequest, WingReadResponse } from "./contracts.ts";

export type ClaimResult =
  | { readonly kind: "claimed" }
  | { readonly kind: "replay"; readonly response: WingReadResponse }
  | { readonly kind: "interrupted" }
  | { readonly kind: "conflict" };

export class ProcessedRequestLedger {
  private readonly database: DatabaseSync;

  constructor(databasePath: string) {
    if (!path.isAbsolute(databasePath)) throw new Error("LEDGER_PATH_MUST_BE_ABSOLUTE");
    mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS processed_wing_requests (
        request_id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        operation TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('PROCESSING', 'COMPLETED')),
        response_json TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      ) STRICT;
    `);
  }

  claim(request: WingReadRequest, now = new Date()): ClaimResult {
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      const existing = this.database.prepare(`
        SELECT request_id, idempotency_key, operation, state, response_json
        FROM processed_wing_requests
        WHERE request_id = ? OR idempotency_key = ?
      `).get(request.requestId, request.idempotencyKey) as
        | {
            request_id: string;
            idempotency_key: string;
            operation: string;
            state: "PROCESSING" | "COMPLETED";
            response_json: string | null;
          }
        | undefined;
      if (existing !== undefined) {
        this.database.exec("COMMIT;");
        if (
          existing.request_id !== request.requestId ||
          existing.idempotency_key !== request.idempotencyKey ||
          existing.operation !== request.operation
        ) return { kind: "conflict" };
        if (existing.state === "PROCESSING" || existing.response_json === null) return { kind: "interrupted" };
        return { kind: "replay", response: JSON.parse(existing.response_json) as WingReadResponse };
      }
      this.database.prepare(`
        INSERT INTO processed_wing_requests
          (request_id, idempotency_key, operation, state, created_at)
        VALUES (?, ?, ?, 'PROCESSING', ?)
      `).run(request.requestId, request.idempotencyKey, request.operation, now.toISOString());
      this.database.exec("COMMIT;");
      return { kind: "claimed" };
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  complete(request: WingReadRequest, response: WingReadResponse, now = new Date()): void {
    const result = this.database.prepare(`
      UPDATE processed_wing_requests
      SET state = 'COMPLETED', response_json = ?, completed_at = ?
      WHERE request_id = ? AND idempotency_key = ? AND state = 'PROCESSING'
    `).run(JSON.stringify(response), now.toISOString(), request.requestId, request.idempotencyKey);
    if (result.changes !== 1) throw new Error("LEDGER_COMPLETION_CONFLICT");
  }

  close(): void {
    this.database.close();
  }
}
