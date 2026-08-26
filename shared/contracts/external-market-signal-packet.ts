import { createHash } from "node:crypto";

export const EXTERNAL_MARKET_SIGNAL_PACKET_VERSION = "external-market-signal-packet-v1" as const;
export type ExternalSignalSource = "TENBI" | "NAVER" | "TIKTOK" | "COUPANG";
export type ExternalMarketSignalPacket = Readonly<{
  packetVersion: typeof EXTERNAL_MARKET_SIGNAL_PACKET_VERSION; source: ExternalSignalSource;
  upstreamSource: string; observedVia: string; collectedAt: string; validUntil: string;
  keywordId: string; productIdentity: Readonly<Record<string, string | null>>;
  platformProductId: string | null; sourceUrl: string | null; categoryBinding: string | null;
  demand: Readonly<Record<string, number | null>>; competition: Readonly<Record<string, number | null>>;
  socialMomentum: Readonly<Record<string, number | null>>; priceSnapshot: Readonly<Record<string, number | null>>;
  reviewSnapshot: Readonly<Record<string, number | null>>; rankingSnapshot: Readonly<Record<string, number | null>>;
  rocketShare: number | null; supplierQuoteBinding: string | null; logisticsCostBinding: string | null;
  evidenceConfidence: number; missingEvidence: readonly string[]; provenanceDigest: string; outputDigest: string;
}>;

const stable = (value: unknown): string => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v);
const digest = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");

export function createExternalMarketSignalPacket(input: Omit<ExternalMarketSignalPacket, "packetVersion" | "provenanceDigest" | "outputDigest"> & { provenance?: unknown }): ExternalMarketSignalPacket {
  const { provenance, ...body } = input;
  const provenanceDigest = digest(provenance ?? { source: body.source, upstreamSource: body.upstreamSource, observedVia: body.observedVia });
  const packet = { packetVersion: EXTERNAL_MARKET_SIGNAL_PACKET_VERSION, ...body, provenanceDigest, outputDigest: "" };
  return Object.freeze({ ...packet, outputDigest: digest(packet) });
}

export function scoreExternalMarketSignal(input: Pick<ExternalMarketSignalPacket, "demand" | "competition" | "socialMomentum" | "priceSnapshot" | "reviewSnapshot" | "rankingSnapshot" | "rocketShare" | "evidenceConfidence">): number {
  const n = (v: number | null | undefined) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50;
  const stability = 100 - Math.min(100, Math.abs(n(input.priceSnapshot.volatility) + n(input.rankingSnapshot.volatility)) / 2);
  return Math.round(n(input.demand.score) * .25 + (100 - n(input.competition.score)) * .20 + n(input.socialMomentum.score) * .15 + stability * .15 + n(input.demand.profitability) * .20 + n(input.evidenceConfidence) * .05);
}
