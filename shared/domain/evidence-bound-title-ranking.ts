import { createHash } from "node:crypto";

import type { KeywordIntelligencePacket } from "@/shared/domain/competitive-keyword-intelligence";

export const EVIDENCE_BOUND_TITLE_RANKING_VERSION =
  "gonggamline-evidence-bound-title-ranking-v1" as const;

export type ProductEvidenceFact = Readonly<{
  factId: string;
  field: "PRODUCT_NAME" | "CATEGORY" | "FEATURE" | "USE_CASE" | "VARIANT";
  value: string;
  state: "VERIFIED" | "UNKNOWN" | "CONFLICT" | "PROHIBITED";
  sourceReference: string;
  evidenceDigest: string;
}>;

export type TitleRankingPolicy = Readonly<{
  titleMaxLength: number;
  keywordMaxCount: number;
  keywordMaxLength: number;
  forbiddenTerms: readonly string[];
  competitorMarks: readonly string[];
  prohibitedClaimPatterns: readonly string[];
}>;

export type RankedTitleCandidate = Readonly<{
  title: string;
  rank: number;
  status: "VERIFIED" | "QUARANTINED";
  score: number | null;
  scoreBreakdown: Readonly<{
    relevance: number;
    purchaseIntent: number;
    readability: number;
    evidence: number;
    policy: number;
  }>;
  provenance: Readonly<{
    factIds: readonly string[];
    keywordSetVersion: string;
    keywordEvidenceDigests: readonly string[];
  }>;
  exclusionReasons: readonly string[];
}>;

export type RankedKeywordCandidate = Readonly<{
  keyword: string;
  rank: number;
  status: "VERIFIED" | "QUARANTINED";
  score: number | null;
  provenance: Readonly<{
    keywordSetVersion: string;
    keywordEvidenceDigests: readonly string[];
  }>;
  exclusionReasons: readonly string[];
}>;

export type EvidenceBoundTitleRankingPacket = Readonly<{
  version: typeof EVIDENCE_BOUND_TITLE_RANKING_VERSION;
  keywordSetVersion: string;
  keywordPacketDigest: string;
  candidateId: string;
  mode: "SHADOW";
  status: "READY" | "QUARANTINED";
  executionEligible: false;
  generatedAt: string;
  titleCandidates: readonly RankedTitleCandidate[];
  keywordCandidates: readonly RankedKeywordCandidate[];
  digest: string;
}>;

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

function normalized(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

function tokens(value: string): string[] {
  return normalized(value).split(/\s+/).filter(Boolean);
}

function uniqueWords(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    for (const token of tokens(value)) {
      if (!seen.has(token)) {
        seen.add(token);
        result.push(token);
      }
    }
  }
  return result;
}

function containsAny(value: string, terms: readonly string[]): boolean {
  const candidate = normalized(value);
  return terms.some((term) => {
    const normalizedTerm = normalized(term);
    return normalizedTerm.length > 0 && candidate.includes(normalizedTerm);
  });
}

function validFact(fact: ProductEvidenceFact): boolean {
  return fact.state === "VERIFIED" &&
    /^https:\/\//.test(fact.sourceReference) &&
    /^[a-f0-9]{64}$/.test(fact.evidenceDigest) &&
    fact.value.trim().length > 0;
}

function keywordIntent(keyword: KeywordIntelligencePacket["keywords"][number]): number {
  if (keyword.kinds.includes("CORE")) return 100;
  if (keyword.kinds.includes("PROBLEM_USE_CASE")) return 90;
  return 80;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function keywordPacketDigest(packet: KeywordIntelligencePacket): string {
  const { digest: packetDigestValue, ...packetWithoutDigest } = packet;
  void packetDigestValue;
  return digest(packetWithoutDigest);
}

export function buildEvidenceBoundTitleRankingPacket(input: Readonly<{
  keywordPacket: KeywordIntelligencePacket;
  expectedKeywordSetVersion: string;
  expectedKeywordPacketDigest: string;
  candidateId: string;
  generatedAt: string;
  facts: readonly ProductEvidenceFact[];
  policy: TitleRankingPolicy;
}>): EvidenceBoundTitleRankingPacket {
  if (input.keywordPacket.keywordSetVersion !== input.expectedKeywordSetVersion) {
    throw new Error("KEYWORD_SET_VERSION_MISMATCH");
  }
  if (keywordPacketDigest(input.keywordPacket) !== input.expectedKeywordPacketDigest) {
    throw new Error("KEYWORD_PACKET_DIGEST_MISMATCH");
  }
  const generatedAt = new Date(input.generatedAt);
  if (!Number.isFinite(generatedAt.getTime())) throw new RangeError("generatedAt is invalid.");
  if (!Number.isInteger(input.policy.titleMaxLength) || input.policy.titleMaxLength < 1) {
    throw new RangeError("titleMaxLength is invalid.");
  }
  if (!Number.isInteger(input.policy.keywordMaxCount) || input.policy.keywordMaxCount < 1) {
    throw new RangeError("keywordMaxCount is invalid.");
  }

  const validFacts = input.facts.filter(validFact);
  const productName = validFacts.find((fact) => fact.field === "PRODUCT_NAME")?.value;
  const category = validFacts.find((fact) => fact.field === "CATEGORY")?.value;
  const factReasons = input.facts.filter((fact) => !validFact(fact)).map((fact) => `${fact.factId}:EVIDENCE_NOT_VERIFIED`);
  const verifiedKeywords = input.keywordPacket.keywords.filter((keyword) => keyword.state === "VERIFIED" && keyword.score !== null);
  const sharedReasons = [
    ...factReasons,
    ...(input.keywordPacket.status === "QUARANTINED" ? ["KEYWORD_PACKET_QUARANTINED"] : []),
  ];

  const titleCandidates: RankedTitleCandidate[] = [];
  if (productName) {
    const titleBases = [productName, ...(category ? [`${category} ${productName}`] : [])];
    for (const keyword of verifiedKeywords) {
      for (const base of titleBases) {
        const title = uniqueWords([base, keyword.canonical]).join(" ");
        const reasons = [...sharedReasons];
        if (title.length > input.policy.titleMaxLength) reasons.push("TITLE_TOO_LONG");
        if (containsAny(title, input.policy.forbiddenTerms)) reasons.push("FORBIDDEN_TERM");
        if (containsAny(title, input.policy.competitorMarks)) reasons.push("COMPETITOR_MARK");
        if (input.policy.prohibitedClaimPatterns.some((pattern) => new RegExp(pattern, "iu").test(title))) reasons.push("PROHIBITED_CLAIM");
        const wordList = tokens(title);
        if (new Set(wordList).size !== wordList.length) reasons.push("KEYWORD_STUFFING");
        const uniqueReasons = [...new Set(reasons)].sort();
        const status = uniqueReasons.length === 0 ? "VERIFIED" : "QUARANTINED";
        const evidenceScore = status === "VERIFIED" ? 100 : 0;
        const readability = round(Math.max(0, 100 - Math.max(0, title.length - 55) * 1.5));
        const relevance = keyword.score ?? 0;
        const purchaseIntent = keywordIntent(keyword);
        const policyScore = status === "VERIFIED" ? 100 : 0;
        titleCandidates.push(Object.freeze({
          title,
          rank: 0,
          status,
          score: status === "VERIFIED" ? round(relevance * 0.35 + purchaseIntent * 0.25 + readability * 0.2 + evidenceScore * 0.1 + policyScore * 0.1) : null,
          scoreBreakdown: Object.freeze({ relevance, purchaseIntent, readability, evidence: evidenceScore, policy: policyScore }),
          provenance: Object.freeze({
            factIds: Object.freeze(validFacts.map((fact) => fact.factId).sort()),
            keywordSetVersion: input.keywordPacket.keywordSetVersion,
            keywordEvidenceDigests: Object.freeze(keyword.evidence.map((evidence) => evidence.evidenceDigest).sort()),
          }),
          exclusionReasons: Object.freeze(uniqueReasons),
        }));
      }
    }
  } else {
    sharedReasons.push("PRODUCT_NAME_FACT_MISSING");
  }

  const keywordCandidates = verifiedKeywords.map((keyword): RankedKeywordCandidate => {
    const reasons = [...sharedReasons];
    if (keyword.canonical.length > input.policy.keywordMaxLength) reasons.push("KEYWORD_TOO_LONG");
    if (containsAny(keyword.canonical, input.policy.forbiddenTerms)) reasons.push("FORBIDDEN_TERM");
    if (containsAny(keyword.canonical, input.policy.competitorMarks)) reasons.push("COMPETITOR_MARK");
    const uniqueReasons = [...new Set(reasons)].sort();
    return Object.freeze({
      keyword: keyword.canonical,
      rank: 0,
      status: uniqueReasons.length === 0 ? "VERIFIED" : "QUARANTINED",
      score: uniqueReasons.length === 0 ? keyword.score : null,
      provenance: Object.freeze({ keywordSetVersion: input.keywordPacket.keywordSetVersion, keywordEvidenceDigests: Object.freeze(keyword.evidence.map((evidence) => evidence.evidenceDigest).sort()) }),
      exclusionReasons: Object.freeze(uniqueReasons),
    });
  });

  const rankTitles = titleCandidates
    .sort((left, right) => (right.score ?? -1) - (left.score ?? -1) || left.title.localeCompare(right.title))
    .map((candidate, index) => Object.freeze({ ...candidate, rank: index + 1 }));
  const rankKeywords = keywordCandidates
    .sort((left, right) => (right.score ?? -1) - (left.score ?? -1) || left.keyword.localeCompare(right.keyword))
    .slice(0, input.policy.keywordMaxCount)
    .map((candidate, index) => Object.freeze({ ...candidate, rank: index + 1 }));

  const packetWithoutDigest = {
    version: EVIDENCE_BOUND_TITLE_RANKING_VERSION,
    keywordSetVersion: input.keywordPacket.keywordSetVersion,
    keywordPacketDigest: input.expectedKeywordPacketDigest,
    candidateId: input.candidateId,
    mode: "SHADOW" as const,
    status: rankTitles.some((candidate) => candidate.status === "QUARANTINED") || rankKeywords.some((candidate) => candidate.status === "QUARANTINED") ? "QUARANTINED" as const : "READY" as const,
    executionEligible: false as const,
    generatedAt: generatedAt.toISOString(),
    titleCandidates: Object.freeze(rankTitles),
    keywordCandidates: Object.freeze(rankKeywords),
  };
  return Object.freeze({ ...packetWithoutDigest, digest: digest(packetWithoutDigest) });
}
