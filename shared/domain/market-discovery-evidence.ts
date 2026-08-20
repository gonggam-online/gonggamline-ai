export const MARKET_DISCOVERY_EVIDENCE_VERSION =
  "gonggamline-market-discovery-evidence-v1" as const;

export type MarketDiscoverySourceKind =
  | "official_api"
  | "paid_api"
  | "public_dataset"
  | "public_page"
  | "short_video_public"
  | "manual";

export type MarketDiscoveryAccessMode = "PUBLIC" | "APPROVED_API" | "MANUAL";

export type MarketDiscoveryPolicy = Readonly<{
  sourceId: string;
  kind: MarketDiscoverySourceKind;
  accessMode: MarketDiscoveryAccessMode;
  robotsReviewed: boolean;
  termsReviewed: boolean;
  captchaOrAntiBotPresent: boolean;
  authenticatedAccess: boolean;
  minimumIntervalSeconds: number;
  policyVersion: string;
}>;

export type MarketDiscoverySignal = Readonly<{
  sourceId: string;
  sourceKind: MarketDiscoverySourceKind;
  query: string;
  externalProductId: string;
  title: string;
  category: string | null;
  sourceUrl: string | null;
  observedAt: string;
  rank: number | null;
  price: number | null;
  reviewCount: number | null;
  popularityScore: number | null;
  engagementRate: number | null;
  contentVelocity: number | null;
  assetRights: "UNKNOWN" | "REFERENCE_ONLY" | "VERIFIED";
}>;

export type MarketDiscoveryAdmission = Readonly<{
  version: typeof MARKET_DISCOVERY_EVIDENCE_VERSION;
  status: "ADMITTED" | "QUARANTINED";
  signal: MarketDiscoverySignal | null;
  reasons: readonly string[];
  missingFacts: readonly string[];
  identityKey: string | null;
}>;

function finiteOrNull(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : value;
}

function boundedOrNull(value: number | null, min: number, max: number, field: string, errors: string[]): number | null {
  const normalized = finiteOrNull(value);
  if (normalized === null) return null;
  if (normalized < min || normalized > max) errors.push(`signal.${field}`);
  return normalized;
}

function validObservedAt(value: string, now: Date): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now.getTime() + 60_000;
}

function policyErrors(policy: MarketDiscoveryPolicy): string[] {
  const errors: string[] = [];
  if (!policy.sourceId.trim() || !policy.policyVersion.trim()) errors.push("source.identity");
  if (!policy.robotsReviewed) errors.push("source.robotsReview");
  if (!policy.termsReviewed) errors.push("source.termsReview");
  if (policy.captchaOrAntiBotPresent) errors.push("source.antiBot");
  if (policy.authenticatedAccess) errors.push("source.authenticatedAccess");
  if (!Number.isFinite(policy.minimumIntervalSeconds) || policy.minimumIntervalSeconds < 60) errors.push("source.minimumInterval");
  if ((policy.kind === "official_api" || policy.kind === "paid_api") && policy.accessMode !== "APPROVED_API") errors.push("source.apiAuthority");
  if (policy.kind === "manual" && policy.accessMode !== "MANUAL") errors.push("source.manualAuthority");
  return errors;
}

/**
 * Admits public market signals for fact/keyword/ranking research only. It
 * never downloads or stores assets, never bypasses access controls, and never
 * grants publication or derivative rights.
 */
export function admitMarketDiscoverySignal(
  policy: MarketDiscoveryPolicy,
  signal: MarketDiscoverySignal,
  now = new Date(),
): MarketDiscoveryAdmission {
  const errors = policyErrors(policy);
  if (signal.sourceId !== policy.sourceId || signal.sourceKind !== policy.kind) errors.push("signal.sourceBinding");
  if (!signal.query.trim() || signal.query.length > 100) errors.push("signal.query");
  if (!signal.externalProductId.trim() || signal.externalProductId.length > 200) errors.push("signal.externalProductId");
  if (!signal.title.trim() || signal.title.length > 500) errors.push("signal.title");
  if (!validObservedAt(signal.observedAt, now)) errors.push("signal.observedAt");
  if (signal.sourceUrl !== null && (!/^https:\/\//i.test(signal.sourceUrl) || signal.sourceUrl.length > 2_000)) errors.push("signal.sourceUrl");
  boundedOrNull(signal.rank, 1, 1_000_000, "rank", errors);
  boundedOrNull(signal.price, 0, 100_000_000, "price", errors);
  boundedOrNull(signal.reviewCount, 0, 100_000_000, "reviewCount", errors);
  boundedOrNull(signal.popularityScore, 0, 100, "popularityScore", errors);
  boundedOrNull(signal.engagementRate, 0, 1, "engagementRate", errors);
  boundedOrNull(signal.contentVelocity, 0, 1_000_000, "contentVelocity", errors);
  const missingFacts = signal.assetRights === "VERIFIED" ? [] : ["asset.rightsGrant"];
  const reasons = errors.map((error) => `수집 근거가 허용되지 않거나 유효하지 않습니다: ${error}`);
  if (signal.assetRights !== "VERIFIED") reasons.push("공개 콘텐츠는 상품 사실·키워드 연구에만 사용하며 자산 복제·편집·게시 권한을 부여하지 않습니다.");
  if (errors.length > 0) {
    return Object.freeze({ version: MARKET_DISCOVERY_EVIDENCE_VERSION, status: "QUARANTINED", signal: null, reasons: Object.freeze(reasons), missingFacts: Object.freeze([...new Set([...missingFacts, ...errors])].sort()), identityKey: null });
  }
  return Object.freeze({
    version: MARKET_DISCOVERY_EVIDENCE_VERSION,
    status: "ADMITTED",
    signal: Object.freeze({ ...signal }),
    reasons: Object.freeze(reasons),
    missingFacts: Object.freeze(missingFacts),
    identityKey: `${policy.sourceId}:${signal.externalProductId}:${signal.observedAt}`,
  });
}
