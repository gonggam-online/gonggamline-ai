import "server-only";

export type AdminRateLimitBucket = "mutation" | "read";

export type AdminRateLimitResult = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}>;

const WINDOW_MS = 60_000;
const LIMITS: Readonly<Record<AdminRateLimitBucket, number>> = Object.freeze({
  read: 30,
  mutation: 10,
});

export class AdminRateLimiter {
  private readonly requests = new Map<string, number[]>();

  constructor(
    private readonly clock: () => number = Date.now,
    private readonly maximumKeys = 1_000,
  ) {
    if (!Number.isInteger(maximumKeys) || maximumKeys < 1) {
      throw new RangeError("maximumKeys must be a positive integer.");
    }
  }

  consume(administratorUserId: string, bucket: AdminRateLimitBucket): AdminRateLimitResult {
    const now = this.clock();
    const key = `${bucket}:${administratorUserId.toLowerCase()}`;
    const cutoff = now - WINDOW_MS;
    const active = (this.requests.get(key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );
    const limit = LIMITS[bucket];

    this.requests.delete(key);
    this.pruneExpired(cutoff);
    while (this.requests.size >= this.maximumKeys) {
      const oldestKey = this.requests.keys().next().value;
      if (typeof oldestKey !== "string") {
        break;
      }
      this.requests.delete(oldestKey);
    }

    if (active.length >= limit) {
      this.requests.set(key, active);
      return Object.freeze({
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((active[0] + WINDOW_MS - now) / 1_000)),
      });
    }

    active.push(now);
    this.requests.set(key, active);
    return Object.freeze({
      allowed: true,
      limit,
      remaining: limit - active.length,
      retryAfterSeconds: 0,
    });
  }

  private pruneExpired(cutoff: number): void {
    for (const [key, timestamps] of this.requests) {
      const active = timestamps.filter((timestamp) => timestamp > cutoff);
      if (active.length === 0) {
        this.requests.delete(key);
      } else if (active.length !== timestamps.length) {
        this.requests.set(key, active);
      }
    }
  }
}

export const adminRateLimiter = new AdminRateLimiter();
