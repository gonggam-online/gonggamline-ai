import type {
  SupplierCatalogItemResult,
  SupplierCatalogPort,
  SupplierCatalogSearchResult,
} from "../../shared/domain/supplier-catalog";
import {
  parseDomeggookDetailEnvelope,
  parseDomeggookProviderError,
  parseDomeggookSearchEnvelope,
} from "./dto";
import { DomeggookError, type DomeggookErrorCode } from "./errors";
import {
  DomeggookMappingError,
  mapDomeggookDetailItem,
  mapDomeggookListItem,
} from "./mapper";

const ENDPOINT = "https://domeggook.com/ssl/api/";
const ATTEMPT_TIMEOUT_MS = 4_000;
const OVERALL_BUDGET_MS = 10_000;
const MAX_RETRIES = 2;
const MAX_CONCURRENCY = 4;

export type DomeggookOperation = "getItem" | "searchItems";

export type DomeggookObservation = {
  provider: "domeggook";
  operation: DomeggookOperation;
  success: boolean;
  statusClass: string;
  latencyMs: number;
  retryCount: number;
  errorCode: DomeggookErrorCode | null;
  correlationId: string;
};

export type DomeggookTransport = (
  url: string,
  init: RequestInit
) => Promise<Response>;

type ClientOptions = {
  apiKey?: string | null;
  transport?: DomeggookTransport;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  createCorrelationId?: () => string;
  observe?: (observation: DomeggookObservation) => void;
};

class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active += 1;
    try {
      return await work();
    } finally {
      this.active -= 1;
      this.waiters.shift()?.();
    }
  }
}

const sharedSemaphore = new Semaphore(MAX_CONCURRENCY);

function defaultObserve(observation: DomeggookObservation) {
  console.info("supplier_catalog_provider", observation);
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 2_000);
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.min(Math.max(0, date - Date.now()), 2_000);
}

function providerErrorFromStatus(
  status: number,
  retryAfter: string | null
): DomeggookError {
  if (status === 401 || status === 403) {
    return new DomeggookError("AUTHENTICATION_FAILED", { status });
  }
  if (status === 429) {
    return new DomeggookError("RATE_LIMITED", {
      status,
      retryAfterMs: parseRetryAfter(retryAfter),
    });
  }
  return new DomeggookError("PROVIDER_ERROR", { status });
}

function statusClass(status: number | null): string {
  return status === null ? "none" : `${Math.floor(status / 100)}xx`;
}

function validateItemNo(itemNo: string): string {
  const value = itemNo.trim();
  if (!/^\d{1,20}$/.test(value)) {
    throw new DomeggookError("VALIDATION_FAILED");
  }
  return value;
}

function validateSearchInput(keyword: string, page = 1, size = 20) {
  const normalizedKeyword = keyword.trim();
  if (
    normalizedKeyword.length < 2 ||
    normalizedKeyword.length > 100 ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1_000 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 50
  ) {
    throw new DomeggookError("VALIDATION_FAILED");
  }
  return { keyword: normalizedKeyword, page, size };
}

function totalItems(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replaceAll(",", "").trim())
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new DomeggookError("RESPONSE_CONTRACT_ERROR");
  }
  return parsed;
}

export class DomeggookSupplierCatalogAdapter implements SupplierCatalogPort {
  private readonly apiKey: string | null;
  private readonly transport: DomeggookTransport;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;
  private readonly createCorrelationId: () => string;
  private readonly observe: (observation: DomeggookObservation) => void;

  constructor(options: ClientOptions = {}) {
    const configuredKey =
      "apiKey" in options
        ? options.apiKey
        : (process.env.DOMEGGOOK_API_KEY ?? null);
    this.apiKey = configuredKey?.trim() || null;
    this.transport = options.transport ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.random = options.random ?? Math.random;
    this.createCorrelationId =
      options.createCorrelationId ?? (() => crypto.randomUUID());
    this.observe = options.observe ?? defaultObserve;
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async getItem(itemNo: string): Promise<SupplierCatalogItemResult> {
    const validatedItemNo = validateItemNo(itemNo);
    const payload = await this.request("getItem", {
      ver: "4.0",
      mode: "getItemViewES",
      no: validatedItemNo,
    });
    const parsed = parseDomeggookDetailEnvelope(payload);
    if (parsed === "not_found") return { status: "not_found", item: null };
    if (!parsed) throw new DomeggookError("RESPONSE_CONTRACT_ERROR");
    try {
      return { status: "found", item: mapDomeggookDetailItem(parsed) };
    } catch (error) {
      if (error instanceof DomeggookMappingError) {
        throw new DomeggookError("RESPONSE_CONTRACT_ERROR", { cause: error });
      }
      throw error;
    }
  }

  async searchItems(
    keyword: string,
    page = 1,
    size = 20
  ): Promise<SupplierCatalogSearchResult> {
    const input = validateSearchInput(keyword, page, size);
    const payload = await this.request("searchItems", {
      ver: "4.1",
      mode: "getItemList",
      market: "dome",
      kw: input.keyword,
      pg: String(input.page),
      sz: String(input.size),
    });
    const parsed = parseDomeggookSearchEnvelope(payload);
    if (!parsed) throw new DomeggookError("RESPONSE_CONTRACT_ERROR");

    try {
      const mappedTotal = totalItems(parsed.totalItems);
      return {
        provider: "domeggook",
        items: parsed.items.map(mapDomeggookListItem),
        pagination: {
          page: input.page,
          size: input.size,
          totalItems: mappedTotal,
          hasNextPage:
            mappedTotal === null
              ? null
              : input.page * input.size < mappedTotal,
        },
      };
    } catch (error) {
      if (
        error instanceof DomeggookMappingError ||
        error instanceof DomeggookError
      ) {
        throw new DomeggookError("RESPONSE_CONTRACT_ERROR", { cause: error });
      }
      throw error;
    }
  }

  private async request(
    operation: DomeggookOperation,
    parameters: Record<string, string>
  ): Promise<unknown> {
    if (!this.apiKey) throw new DomeggookError("CONFIGURATION_MISSING");

    const correlationId = this.createCorrelationId();
    const startedAt = this.now();
    let retryCount = 0;

    return sharedSemaphore.run(async () => {
      while (true) {
        try {
          const response = await this.performAttempt(parameters);
          if (!response.ok) {
            throw providerErrorFromStatus(
              response.status,
              response.headers.get("retry-after")
            );
          }
          const payload: unknown = await response.json().catch((error) => {
            throw new DomeggookError("RESPONSE_CONTRACT_ERROR", {
              cause: error,
            });
          });
          const providerError = parseDomeggookProviderError(payload);
          if (providerError) {
            const normalized = `${providerError.code ?? ""} ${
              providerError.message ?? ""
            }`.toLowerCase();
            throw new DomeggookError(
              /auth|인증|aid|key/.test(normalized)
                ? "AUTHENTICATION_FAILED"
                : "PROVIDER_ERROR"
            );
          }
          this.observe({
            provider: "domeggook",
            operation,
            success: true,
            statusClass: statusClass(response.status),
            latencyMs: this.now() - startedAt,
            retryCount,
            errorCode: null,
            correlationId,
          });
          return payload;
        } catch (caught) {
          const error = this.normalizeError(caught);
          const delay = this.retryDelay(error, retryCount);
          const elapsed = this.now() - startedAt;
          const canRetry =
            retryCount < MAX_RETRIES &&
            delay !== null &&
            elapsed + delay + 1 < OVERALL_BUDGET_MS;
          if (canRetry) {
            retryCount += 1;
            await this.sleep(delay);
            continue;
          }
          this.observe({
            provider: "domeggook",
            operation,
            success: false,
            statusClass: statusClass(error.status),
            latencyMs: elapsed,
            retryCount,
            errorCode: error.code,
            correlationId,
          });
          throw error;
        }
      }
    });
  }

  private async performAttempt(
    parameters: Record<string, string>
  ): Promise<Response> {
    const query = new URLSearchParams({
      ...parameters,
      aid: this.apiKey ?? "",
      om: "json",
    });
    try {
      return await this.transport(`${ENDPOINT}?${query.toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new DomeggookError("TIMEOUT", { cause: error });
      }
      throw new DomeggookError("NETWORK_ERROR", { cause: error });
    }
  }

  private normalizeError(error: unknown): DomeggookError {
    return error instanceof DomeggookError
      ? error
      : new DomeggookError("NETWORK_ERROR", { cause: error });
  }

  private retryDelay(
    error: DomeggookError,
    retryCount: number
  ): number | null {
    if (error.code === "RATE_LIMITED") {
      return retryCount === 0 ? error.retryAfterMs : null;
    }
    const transientProviderStatus =
      error.code === "PROVIDER_ERROR" &&
      [502, 503, 504].includes(error.status ?? 0);
    if (
      error.code !== "NETWORK_ERROR" &&
      error.code !== "TIMEOUT" &&
      !transientProviderStatus
    ) {
      return null;
    }
    const base = 200 * 2 ** retryCount;
    return Math.round(base * (0.75 + this.random() * 0.5));
  }
}
