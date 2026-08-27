import {
  PUBLIC_SUPPLIER_DISCOVERY_VERSION,
  PUBLIC_SUPPLIER_PROFILES,
  discoveryDigest,
  rankPublicSupplierCandidates,
  supplierProfileFromUrl,
  type PublicSupplierDiscoveryResult,
  type PublicSupplierSearchObservation,
} from "@/shared/domain/public-supplier-discovery";

type Requester = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type Credentials = Readonly<{
  login?: string;
  password?: string;
  maximumCostUsd?: number;
}>;

type Options = Readonly<{
  credentials?: Credentials;
  request?: Requester;
  now?: () => Date;
}>;

function boundedKeyword(value: string): string {
  const keyword = value.normalize("NFC").trim();
  if (keyword.length < 2 || keyword.length > 100 || /[\u0000-\u001f\u007f]/u.test(keyword)) {
    throw new Error("SUPPLIER_DISCOVERY_KEYWORD_INVALID");
  }
  return keyword;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, maximum = 4_000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function nestedItems(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    if (!row) return [];
    return [row, ...nestedItems(row.items)];
  });
}

function credentialsFromEnvironment(): Credentials {
  return {
    login: process.env.DATAFORSEO_LOGIN,
    password: process.env.DATAFORSEO_PASSWORD,
    maximumCostUsd: process.env.DATAFORSEO_MAX_COST_USD_PER_REQUEST
      ? Number(process.env.DATAFORSEO_MAX_COST_USD_PER_REQUEST)
      : undefined,
  };
}

function searchUrl(template: string, keyword: string): string {
  return template.replace("{keyword}", encodeURIComponent(keyword));
}

export async function discoverPublicSupplierCandidates(
  value: string,
  options: Options = {},
): Promise<PublicSupplierDiscoveryResult> {
  const keyword = boundedKeyword(value);
  const credentials = options.credentials ?? credentialsFromEnvironment();
  if (!credentials.login?.trim() || !credentials.password?.trim()) {
    throw new Error("DATAFORSEO_CREDENTIALS_MISSING");
  }
  if (!Number.isFinite(credentials.maximumCostUsd) || (credentials.maximumCostUsd ?? 0) <= 0) {
    throw new Error("DATAFORSEO_COST_CEILING_MISSING");
  }
  const domains = PUBLIC_SUPPLIER_PROFILES.map((profile) => `site:${profile.domain}`).join(" OR ");
  const response = await (options.request ?? fetch)(
    "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`, "utf8").toString("base64")}`,
      },
      body: JSON.stringify([{
        keyword: `${keyword} (${domains})`,
        location_name: "South Korea",
        language_code: "ko",
        device: "desktop",
        depth: 50,
      }]),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`DATAFORSEO_SUPPLIER_DISCOVERY_HTTP_${response.status}`);
  const body: unknown = await response.json();
  const root = record(body);
  const task = Array.isArray(root?.tasks) ? record(root.tasks[0]) : null;
  const taskCost = number(task?.cost) ?? 0;
  if (taskCost > (credentials.maximumCostUsd ?? 0)) {
    throw new Error("DATAFORSEO_COST_CEILING_EXCEEDED");
  }
  const taskResult = Array.isArray(task?.result) ? record(task.result[0]) : null;
  const observations: PublicSupplierSearchObservation[] = [];
  for (const [index, item] of nestedItems(taskResult?.items).entries()) {
    const title = text(item.title, 500);
    const url = text(item.url, 2_000);
    if (!title || !url) continue;
    const profile = supplierProfileFromUrl(url);
    if (!profile) continue;
    observations.push(Object.freeze({
      supplier: profile.key,
      title,
      url,
      snippet: text(item.description ?? item.snippet),
      rank: Math.max(1, Math.round(number(item.rank_absolute) ?? index + 1)),
    }));
  }
  const collectedAt = (options.now ?? (() => new Date()))().toISOString();
  const withoutDigest = Object.freeze({
    version: PUBLIC_SUPPLIER_DISCOVERY_VERSION,
    keyword,
    candidates: rankPublicSupplierCandidates(keyword, observations, collectedAt),
    suppliers: Object.freeze(PUBLIC_SUPPLIER_PROFILES.map((profile) => Object.freeze({
      ...profile,
      searchUrl: searchUrl(profile.searchUrlTemplate, keyword),
    }))),
    requestCount: 1,
    estimatedCostUsd: taskCost,
    collectedAt,
  });
  return Object.freeze({ ...withoutDigest, outputDigest: discoveryDigest(withoutDigest) });
}
