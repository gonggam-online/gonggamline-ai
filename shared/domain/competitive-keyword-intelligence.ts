import { createHash } from "node:crypto";

export const KEYWORD_INTELLIGENCE_PACKET_VERSION =
  "gonggamline-competitive-keyword-intelligence-v1" as const;

export type KeywordProvider = "NAVER" | "YOUTUBE" | "DATAFORSEO";
export type KeywordKind = "CORE" | "RELATED" | "PROBLEM_USE_CASE";
export type KeywordEvidenceState = "VERIFIED" | "UNKNOWN" | "QUARANTINED";

export type KeywordMetricInput = Readonly<{
  demand: number | null;
  competition: number | null;
  trend: number | null;
  contentGap: number | null;
  profitability: number | null;
}>;

export type KeywordProviderRecord = Readonly<{
  provider: KeywordProvider;
  sourceReference: string;
  observedAt: string;
  query: string;
  keyword: string;
  kind: KeywordKind;
  metrics: KeywordMetricInput;
  rightsStatus: "ALLOWED" | "UNKNOWN" | "PROHIBITED";
}>;

export type KeywordAliasGroup = Readonly<{
  canonical: string;
  variants: readonly string[];
}>;

export type KeywordProviderEnvelope = Readonly<{
  provider: KeywordProvider;
  status: 200 | 403 | 429;
  estimatedCostUsd: number;
  maxCostUsd: number;
  records: unknown;
}>;

export type KeywordEvidence = Readonly<{
  provider: KeywordProvider;
  sourceReference: string;
  observedAt: string;
  freshness: "FRESH" | "STALE";
  evidenceDigest: string;
}>;

export type CanonicalKeyword = Readonly<{
  canonical: string;
  variants: readonly string[];
  kinds: readonly KeywordKind[];
  state: KeywordEvidenceState;
  score: number | null;
  scoreBreakdown: Readonly<{
    demand: number | null;
    competitionOpportunity: number | null;
    trend: number | null;
    contentGap: number | null;
    profitability: number | null;
    relevance: number;
    confidence: number;
  }>;
  evidence: readonly KeywordEvidence[];
  exclusionReasons: readonly string[];
}>;

export type KeywordIntelligencePacket = Readonly<{
  version: typeof KEYWORD_INTELLIGENCE_PACKET_VERSION;
  keywordSetVersion: string;
  candidateId: string;
  mode: "SHADOW";
  status: "READY" | "QUARANTINED";
  generatedAt: string;
  digest: string;
  keywords: readonly CanonicalKeyword[];
  exclusions: readonly Readonly<{ keyword: string; reasons: readonly string[] }>[];
}>;

const KIND_ORDER: Record<KeywordKind, number> = { CORE: 0, RELATED: 1, PROBLEM_USE_CASE: 2 };
const MAX_AGE_DAYS = 30;
const CONFLICT_SPREAD = 30;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key.normalize("NFC"))}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function normalizeKeywordText(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[^\p{L}\p{N}+-]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function assertMetric(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100);
}

function parseRecord(value: unknown, provider: KeywordProvider): KeywordProviderRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const metrics = record.metrics;
  if (
    record.provider !== provider ||
    typeof record.sourceReference !== "string" ||
    !/^https:\/\//.test(record.sourceReference) ||
    typeof record.observedAt !== "string" ||
    !Number.isFinite(Date.parse(record.observedAt)) ||
    typeof record.query !== "string" ||
    typeof record.keyword !== "string" ||
    !["CORE", "RELATED", "PROBLEM_USE_CASE"].includes(String(record.kind)) ||
    !["ALLOWED", "UNKNOWN", "PROHIBITED"].includes(String(record.rightsStatus)) ||
    typeof metrics !== "object" || metrics === null
  ) return null;
  const metric = metrics as Record<string, unknown>;
  if (![metric.demand, metric.competition, metric.trend, metric.contentGap, metric.profitability].every(assertMetric)) return null;
  return Object.freeze({
    provider,
    sourceReference: record.sourceReference,
    observedAt: record.observedAt,
    query: record.query,
    keyword: record.keyword,
    kind: record.kind as KeywordKind,
    rightsStatus: record.rightsStatus as KeywordProviderRecord["rightsStatus"],
    metrics: Object.freeze({
      demand: metric.demand as number | null,
      competition: metric.competition as number | null,
      trend: metric.trend as number | null,
      contentGap: metric.contentGap as number | null,
      profitability: metric.profitability as number | null,
    }),
  });
}

/** Normalizes an already-obtained provider response. It never performs a network request. */
export function normalizeKeywordProviderEnvelope(envelope: KeywordProviderEnvelope): readonly KeywordProviderRecord[] {
  if (envelope.status === 403) throw new Error(`${envelope.provider}_FORBIDDEN`);
  if (envelope.status === 429) throw new Error(`${envelope.provider}_RATE_LIMITED`);
  if (!Number.isFinite(envelope.maxCostUsd) || envelope.maxCostUsd < 0) throw new Error(`${envelope.provider}_COST_CEILING_INVALID`);
  if (!Number.isFinite(envelope.estimatedCostUsd) || envelope.estimatedCostUsd < 0) throw new Error(`${envelope.provider}_COST_INVALID`);
  if (envelope.estimatedCostUsd > envelope.maxCostUsd) throw new Error(`${envelope.provider}_COST_CEILING_EXCEEDED`);
  if (!Array.isArray(envelope.records)) throw new Error(`${envelope.provider}_RESPONSE_MALFORMED`);
  if (envelope.records.length === 0) throw new Error(`${envelope.provider}_RESPONSE_EMPTY`);
  const records = envelope.records.map((record) => parseRecord(record, envelope.provider));
  if (records.some((record) => record === null)) throw new Error(`${envelope.provider}_RESPONSE_MALFORMED`);
  return Object.freeze(records as readonly KeywordProviderRecord[]);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function isFresh(observedAt: string, now: Date): boolean {
  const age = now.getTime() - Date.parse(observedAt);
  return age >= 0 && age <= MAX_AGE_DAYS * 86_400_000;
}

function hasConflict(values: readonly number[]): boolean {
  return values.length > 1 && Math.max(...values) - Math.min(...values) > CONFLICT_SPREAD;
}

function relevance(kinds: readonly KeywordKind[]): number {
  if (kinds.includes("CORE")) return 100;
  if (kinds.includes("RELATED")) return 80;
  return 70;
}

export function buildKeywordIntelligencePacket(input: Readonly<{
  candidateId: string;
  keywordSetVersion: string;
  generatedAt: string;
  aliases: readonly KeywordAliasGroup[];
  records: readonly KeywordProviderRecord[];
}>): KeywordIntelligencePacket {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(input.candidateId)) throw new RangeError("candidateId is invalid.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(input.keywordSetVersion)) throw new RangeError("keywordSetVersion is invalid.");
  const now = new Date(input.generatedAt);
  if (!Number.isFinite(now.getTime())) throw new RangeError("generatedAt is invalid.");

  const aliases = new Map<string, string>();
  for (const group of input.aliases) {
    const canonical = normalizeKeywordText(group.canonical);
    if (!canonical) throw new RangeError("canonical alias is empty.");
    for (const variant of [group.canonical, ...group.variants]) {
      const normalized = normalizeKeywordText(variant);
      const existing = aliases.get(normalized);
      if (existing && existing !== canonical) throw new RangeError("keyword alias conflict.");
      aliases.set(normalized, canonical);
    }
  }

  const grouped = new Map<string, KeywordProviderRecord[]>();
  for (const record of input.records) {
    const normalized = normalizeKeywordText(record.keyword);
    if (!normalized) continue;
    const canonical = aliases.get(normalized) ?? normalized;
    grouped.set(canonical, [...(grouped.get(canonical) ?? []), record]);
  }

  const keywords = [...grouped.entries()].map(([canonical, records]): CanonicalKeyword => {
    const ordered = [...records].sort((left, right) =>
      left.provider.localeCompare(right.provider) || left.sourceReference.localeCompare(right.sourceReference));
    const fresh = ordered.filter((record) => isFresh(record.observedAt, now));
    const reasons: string[] = [];
    if (ordered.some((record) => record.rightsStatus === "PROHIBITED")) reasons.push("RIGHTS_PROHIBITED");
    if (ordered.some((record) => record.rightsStatus === "UNKNOWN")) reasons.push("RIGHTS_UNKNOWN");
    if (fresh.length === 0) reasons.push("EVIDENCE_STALE");
    const metricValues = (name: keyof KeywordMetricInput) => fresh.flatMap((record) => record.metrics[name] === null ? [] : [record.metrics[name]]);
    const demand = metricValues("demand");
    const competition = metricValues("competition");
    const trend = metricValues("trend");
    const contentGap = metricValues("contentGap");
    const profitability = metricValues("profitability");
    if (demand.length === 0) reasons.push("DEMAND_UNKNOWN");
    if (competition.length === 0) reasons.push("COMPETITION_UNKNOWN");
    if (trend.length === 0) reasons.push("TREND_UNKNOWN");
    if (contentGap.length === 0) reasons.push("CONTENT_GAP_UNKNOWN");
    if (profitability.length === 0) reasons.push("PROFITABILITY_UNKNOWN");
    if ([demand, competition, trend, contentGap, profitability].some(hasConflict)) reasons.push("EVIDENCE_CONFLICT");
    const quarantined = reasons.some((reason) => ["RIGHTS_PROHIBITED", "RIGHTS_UNKNOWN", "EVIDENCE_STALE", "EVIDENCE_CONFLICT"].includes(reason));
    const unknown = [demand, competition, trend, contentGap, profitability].some((values) => values.length === 0);
    const state: KeywordEvidenceState = quarantined ? "QUARANTINED" : unknown ? "UNKNOWN" : "VERIFIED";
    const kinds = [...new Set(ordered.map((record) => record.kind))].sort((left, right) => KIND_ORDER[left] - KIND_ORDER[right]);
    const demandMean = mean(demand);
    const competitionMean = mean(competition);
    const trendMean = mean(trend);
    const gapMean = mean(contentGap);
    const profitabilityMean = mean(profitability);
    const providerCoverage = new Set(fresh.map((record) => record.provider)).size / 3;
    const metricCoverage = [demandMean, competitionMean, trendMean, gapMean, profitabilityMean].filter((value) => value !== null).length / 5;
    const confidence = Math.round(providerCoverage * metricCoverage * 10000) / 100;
    const relevanceScore = relevance(kinds);
    const score = state === "VERIFIED"
      ? Math.round((demandMean! * 0.25 + (100 - competitionMean!) * 0.2 + trendMean! * 0.13 + gapMean! * 0.14 + profitabilityMean! * 0.13 + relevanceScore * 0.15) * (0.7 + confidence / 100 * 0.3) * 100) / 100
      : null;
    return Object.freeze({
      canonical,
      variants: Object.freeze([...new Set(ordered.map((record) => normalizeKeywordText(record.keyword)))].sort()),
      kinds: Object.freeze(kinds),
      state,
      score,
      scoreBreakdown: Object.freeze({ demand: demandMean, competitionOpportunity: competitionMean === null ? null : 100 - competitionMean, trend: trendMean, contentGap: gapMean, profitability: profitabilityMean, relevance: relevanceScore, confidence }),
      evidence: Object.freeze(ordered.map((record) => Object.freeze({ provider: record.provider, sourceReference: record.sourceReference, observedAt: record.observedAt, freshness: isFresh(record.observedAt, now) ? "FRESH" : "STALE", evidenceDigest: digest(record) }))),
      exclusionReasons: Object.freeze(reasons.sort()),
    });
  }).sort((left, right) =>
    (right.score ?? -1) - (left.score ?? -1) || left.canonical.localeCompare(right.canonical));

  const packetWithoutDigest = {
    version: KEYWORD_INTELLIGENCE_PACKET_VERSION,
    keywordSetVersion: input.keywordSetVersion,
    candidateId: input.candidateId,
    mode: "SHADOW" as const,
    status: keywords.some((keyword) => keyword.state === "QUARANTINED") ? "QUARANTINED" as const : "READY" as const,
    generatedAt: now.toISOString(),
    keywords: Object.freeze(keywords),
    exclusions: Object.freeze(keywords.filter((keyword) => keyword.state !== "VERIFIED").map((keyword) => Object.freeze({ keyword: keyword.canonical, reasons: keyword.exclusionReasons }))),
  };
  return Object.freeze({ ...packetWithoutDigest, digest: digest(packetWithoutDigest) });
}
