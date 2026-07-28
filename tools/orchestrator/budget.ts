export interface BudgetLimit {
  readonly tokenLimit: number;
  readonly wallTimeSeconds: number;
  readonly estimatedCostKrwLimit: number;
}

export interface UsageSnapshot {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly estimatedCostKrw: number;
  readonly elapsedSeconds: number;
}

export type BudgetDimension = "TOKENS" | "WALL_TIME" | "COST";

export class BudgetExceededError extends Error {
  readonly dimension: BudgetDimension;

  constructor(dimension: BudgetDimension) {
    super(`Task budget exceeded: ${dimension}`);
    this.name = "BudgetExceededError";
    this.dimension = dimension;
  }
}

export function exceededDimension(
  limit: BudgetLimit,
  usage: UsageSnapshot,
): BudgetDimension | null {
  if (usage.inputTokens + usage.outputTokens + usage.reasoningTokens > limit.tokenLimit) {
    return "TOKENS";
  }
  if (usage.elapsedSeconds > limit.wallTimeSeconds) {
    return "WALL_TIME";
  }
  if (usage.estimatedCostKrw > limit.estimatedCostKrwLimit) {
    return "COST";
  }
  return null;
}

export class BudgetGuard {
  #interruptRequested = false;

  constructor(
    private readonly limit: BudgetLimit,
    private readonly interrupt: () => Promise<void>,
  ) {}

  async observe(usage: UsageSnapshot): Promise<void> {
    const dimension = exceededDimension(this.limit, usage);
    if (dimension === null) {
      return;
    }
    if (!this.#interruptRequested) {
      this.#interruptRequested = true;
      await this.interrupt();
    }
    throw new BudgetExceededError(dimension);
  }
}
