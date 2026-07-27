import { DomeggookSupplierCatalogAdapter } from "../lib/domeggook/client";
import { DomeggookError, type DomeggookErrorCode } from "../lib/domeggook/errors";
import type { SupplierCatalogPort } from "../shared/domain/supplier-catalog";

export type DomeggookHealthResult = {
  ok: boolean;
  provider: "domeggook";
  configuration: "configured" | "missing";
  authentication:
    | "authenticated"
    | "authentication_failed"
    | "cannot_verify";
  reachable: "reachable" | "unreachable" | "cannot_verify";
  errorCode?: DomeggookErrorCode;
  checkedAt: string;
};

type HealthOptions = {
  catalog?: SupplierCatalogPort;
  isConfigured?: () => boolean;
  now?: () => number;
  probeKeyword?: string;
};

const CACHE_TTL_MS = 60_000;

export class DomeggookHealthService {
  private readonly catalog: SupplierCatalogPort;
  private readonly isConfigured: () => boolean;
  private readonly now: () => number;
  private readonly probeKeyword: string;
  private cachedProviderResult:
    | { expiresAt: number; value: DomeggookHealthResult }
    | undefined;
  private pendingProviderResult: Promise<DomeggookHealthResult> | undefined;

  constructor(options: HealthOptions = {}) {
    const adapter = new DomeggookSupplierCatalogAdapter();
    this.catalog = options.catalog ?? adapter;
    this.isConfigured = options.isConfigured ?? (() => adapter.isConfigured());
    this.now = options.now ?? Date.now;
    this.probeKeyword = options.probeKeyword ?? "생활";
  }

  checkConfiguration(): DomeggookHealthResult {
    const configured = this.isConfigured();
    return {
      ok: configured,
      provider: "domeggook",
      configuration: configured ? "configured" : "missing",
      authentication: "cannot_verify",
      reachable: "cannot_verify",
      ...(configured ? {} : { errorCode: "CONFIGURATION_MISSING" as const }),
      checkedAt: new Date(this.now()).toISOString(),
    };
  }

  async verifyProvider(): Promise<DomeggookHealthResult> {
    const configuration = this.checkConfiguration();
    if (!configuration.ok) return configuration;

    const cached = this.cachedProviderResult;
    if (cached && cached.expiresAt > this.now()) return cached.value;
    if (this.pendingProviderResult) return this.pendingProviderResult;

    this.pendingProviderResult = this.executeProviderProbe();
    try {
      const value = await this.pendingProviderResult;
      this.cachedProviderResult = {
        expiresAt: this.now() + CACHE_TTL_MS,
        value,
      };
      return value;
    } finally {
      this.pendingProviderResult = undefined;
    }
  }

  private async executeProviderProbe(): Promise<DomeggookHealthResult> {
    try {
      await this.catalog.searchItems(this.probeKeyword, 1, 1);
      return {
        ok: true,
        provider: "domeggook",
        configuration: "configured",
        authentication: "authenticated",
        reachable: "reachable",
        checkedAt: new Date(this.now()).toISOString(),
      };
    } catch (caught) {
      const error =
        caught instanceof DomeggookError
          ? caught
          : new DomeggookError("PROVIDER_ERROR", { cause: caught });
      return {
        ok: false,
        provider: "domeggook",
        configuration: "configured",
        authentication:
          error.code === "AUTHENTICATION_FAILED"
            ? "authentication_failed"
            : "cannot_verify",
        reachable:
          error.code === "TIMEOUT" || error.code === "NETWORK_ERROR"
            ? "unreachable"
            : "cannot_verify",
        errorCode: error.code,
        checkedAt: new Date(this.now()).toISOString(),
      };
    }
  }
}
