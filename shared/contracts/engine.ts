export type EngineHealth = "ready" | "degraded" | "disabled";

export interface EngineDescriptor {
  id: string;
  name: string;
  version: string;
  health: EngineHealth;
  capabilities: string[];
  dependencies: string[];
}

export interface EngineContext {
  requestedAt: string;
  correlationId?: string;
}

export interface EngineResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  meta: EngineContext;
}
