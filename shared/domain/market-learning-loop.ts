export const MARKET_LEARNING_LOOP_VERSION =
  "gonggamline-market-learning-loop-v1" as const;

export type MarketLearningMode = "SHADOW" | "APPROVED_OPERATIONAL";

export type MarketLearningObservation = Readonly<{
  lessonId: string;
  source: "benchmark" | "market_observation" | "sales_feedback" | "operator_review";
  subject: string;
  statement: string;
  evidenceDigest: string;
  observedAt: string;
  confidence: number;
  appliesTo: readonly string[];
  policyVersion: string;
  approvalDigest: string | null;
}>;

export type MarketLearningPacket = Readonly<{
  version: typeof MARKET_LEARNING_LOOP_VERSION;
  mode: MarketLearningMode;
  packetDigest: string;
  observations: readonly MarketLearningObservation[];
  conflicts: readonly string[];
  appliedSubjects: readonly string[];
  requiresReview: boolean;
}>;

function assertObservation(observation: MarketLearningObservation, now: Date): void {
  if (!observation.lessonId.trim() || !observation.subject.trim() || !observation.statement.trim()) throw new RangeError("learning identity and statement are required.");
  if (!/^[a-f0-9]{64}$/i.test(observation.evidenceDigest)) throw new RangeError("evidenceDigest must be SHA-256.");
  if (observation.approvalDigest !== null && !/^[a-f0-9]{64}$/i.test(observation.approvalDigest)) throw new RangeError("approvalDigest must be SHA-256 or null.");
  if (!Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 100) throw new RangeError("confidence must be between 0 and 100.");
  if (!Number.isFinite(Date.parse(observation.observedAt)) || Date.parse(observation.observedAt) > now.getTime() + 60_000) throw new RangeError("observedAt must be a valid non-future timestamp.");
  if (observation.appliesTo.length === 0) throw new RangeError("appliesTo must not be empty.");
}

function stableDigest(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Harmonizes evidence-backed lessons into a deterministic packet. SHADOW is
 * always safe to consume immediately; operational application requires an
 * approval digest on every lesson and remains separate from verdict writes.
 */
export function buildMarketLearningPacket(
  observations: readonly MarketLearningObservation[],
  mode: MarketLearningMode,
  now = new Date(),
): MarketLearningPacket {
  observations.forEach((observation) => assertObservation(observation, now));
  const bySubject = new Map<string, MarketLearningObservation>();
  const conflicts: string[] = [];
  for (const observation of [...observations].sort((left, right) => left.lessonId.localeCompare(right.lessonId))) {
    const current = bySubject.get(observation.subject);
    if (!current) {
      bySubject.set(observation.subject, observation);
      continue;
    }
    if (current.statement !== observation.statement) {
      conflicts.push(`conflict:${observation.subject}`);
      if (observation.confidence > current.confidence) bySubject.set(observation.subject, observation);
    }
  }
  const selected = [...bySubject.values()].sort((left, right) => left.subject.localeCompare(right.subject));
  const approvalMissing = selected.some((observation) => observation.approvalDigest === null);
  const requiresReview = mode === "SHADOW" || approvalMissing || conflicts.length > 0;
  const appliedSubjects = mode === "APPROVED_OPERATIONAL" && !requiresReview ? selected.map((observation) => observation.subject) : [];
  return Object.freeze({
    version: MARKET_LEARNING_LOOP_VERSION,
    mode,
    packetDigest: stableDigest(selected.map((observation) => ({ lessonId: observation.lessonId, subject: observation.subject, evidenceDigest: observation.evidenceDigest, policyVersion: observation.policyVersion }))),
    observations: Object.freeze(selected),
    conflicts: Object.freeze([...new Set(conflicts)].sort()),
    appliedSubjects: Object.freeze(appliedSubjects),
    requiresReview,
  });
}
