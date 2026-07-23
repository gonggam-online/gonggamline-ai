import crypto from "node:crypto";

const COUPANG_HOST = "api-gateway.coupang.com";
const COUPANG_BASE_URL = `https://${COUPANG_HOST}`;

export type CoupangConfig = {
  accessKey: string;
  secretKey: string;
  vendorId: string;
};

export type CoupangApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw: unknown;
};

export function getCoupangConfig(): CoupangConfig {
  const accessKey = process.env.COUPANG_ACCESS_KEY?.trim();
  const secretKey = process.env.COUPANG_SECRET_KEY?.trim();
  const vendorId = process.env.COUPANG_VENDOR_ID?.trim();

  const missing = [
    !accessKey && "COUPANG_ACCESS_KEY",
    !secretKey && "COUPANG_SECRET_KEY",
    !vendorId && "COUPANG_VENDOR_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`쿠팡 환경변수가 없습니다: ${missing.join(", ")}`);
  }

  return { accessKey, secretKey, vendorId } as CoupangConfig;
}

function coupangTimestamp(date = new Date()): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function normalizeQuery(searchParams?: URLSearchParams): string {
  return searchParams?.toString() ?? "";
}

export function createAuthorization(
  method: string,
  path: string,
  searchParams: URLSearchParams | undefined,
  config: CoupangConfig,
  now = new Date(),
): string {
  const datetime = coupangTimestamp(now);
  const query = normalizeQuery(searchParams);
  const message = `${datetime}${method.toUpperCase()}${path}${query}`;
  const signature = crypto
    .createHmac("sha256", config.secretKey)
    .update(message)
    .digest("hex");

  return `CEA algorithm=HmacSHA256, access-key=${config.accessKey}, signed-date=${datetime}, signature=${signature}`;
}

export async function coupangRequest<T>(options: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  searchParams?: URLSearchParams;
  body?: unknown;
}): Promise<CoupangApiResult<T>> {
  const config = getCoupangConfig();
  const authorization = createAuthorization(
    options.method,
    options.path,
    options.searchParams,
    config,
  );
  const query = options.searchParams?.toString();
  const url = `${COUPANG_BASE_URL}${options.path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: options.method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json;charset=UTF-8",
      "X-Requested-By": config.vendorId,
      "X-MARKET": "KR",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const text = await response.text();
  let raw: unknown = text;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    // 쿠팡이 JSON이 아닌 오류 응답을 반환하는 경우 원문을 유지합니다.
  }

  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? (raw as T) : null,
    raw,
  };
}
