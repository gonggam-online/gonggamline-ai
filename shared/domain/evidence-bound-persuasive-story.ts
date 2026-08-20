import { createHash } from "node:crypto";

import {
  PRODUCT_CREATIVE_PACKET_VERSION,
  productCreativePacketDigest,
  type ProductCreativePacket,
} from "@/shared/domain/evidence-bound-product-creative";
import { KEYWORD_INTELLIGENCE_PACKET_VERSION } from "@/shared/domain/competitive-keyword-intelligence";
import { EVIDENCE_BOUND_TITLE_RANKING_VERSION } from "@/shared/domain/evidence-bound-title-ranking";

export const PERSUASIVE_STORY_PACKET_VERSION =
  "gonggamline-evidence-bound-persuasive-story-v2" as const;

export const STORY_BLOCK_ORDER = [
  "PROBLEM_CONTEXT",
  "EMPATHY",
  "SOLUTION",
  "CORE_BENEFIT",
  "USE_SCENE",
  "CONTENTS_USAGE",
  "OBJECTIONS_FAQ",
  "TRUST_NOTICE",
  "CTA",
] as const;

export type StoryBlockType = (typeof STORY_BLOCK_ORDER)[number];
export type StoryIntent = "DISCOVERY" | "CONSIDERATION" | "PURCHASE";
export type EvidenceState = "VERIFIED" | "UNKNOWN" | "CONFLICT" | "PROHIBITED";

export type StoryClaim = Readonly<{
  claimId: string;
  blockType: StoryBlockType;
  state: EvidenceState;
  approvedPhrasings: readonly string[];
  factIds: readonly string[];
  sourceReferences: readonly string[];
  evidenceDigests: readonly string[];
  observedAt: string;
  validUntil: string;
}>;

export type StoryPersona = Readonly<{
  personaId: string;
  label: string;
  state: EvidenceState;
  evidenceDigests: readonly string[];
  intents: readonly StoryIntent[];
  observedAt: string;
  validUntil: string;
}>;

export type StoryObjection = Readonly<{
  objectionId: string;
  personaIds: readonly string[];
  intents: readonly StoryIntent[];
  questionClaimId: string;
  answerClaimIds: readonly string[];
  required: boolean;
}>;

export type StoryPolicy = Readonly<{
  policyVersion: string;
  categoryEvidenceDigest: string;
  marketplacePolicyDigest: string;
  forbiddenTerms: readonly string[];
  prohibitedClaimPatterns: readonly string[];
}>;

export type StorySentence = Readonly<{
  sentenceId: string;
  text: string;
  claimId: string;
  phrasingIndex: number;
  provenance: Readonly<{
    factIds: readonly string[];
    sourceReferences: readonly string[];
    evidenceDigests: readonly string[];
  }>;
}>;

export type StoryBlock = Readonly<{
  blockId: string;
  blockType: StoryBlockType;
  version: string;
  personaIds: readonly string[];
  intents: readonly StoryIntent[];
  objectionIds: readonly string[];
  creativeCandidateIds: readonly string[];
  sentences: readonly StorySentence[];
}>;

export type RankedStoryCandidate = Readonly<{
  candidateId: string;
  rank: number;
  status: "VERIFIED" | "QUARANTINED";
  score: number | null;
  scoreBreakdown: Readonly<{
    blockCoverage: number;
    personaIntentCoverage: number;
    objectionCoverage: number;
    provenanceCoverage: number;
    policy: number;
    creativeEvidence: number;
  }>;
  blocks: readonly StoryBlock[];
  coveredObjectionIds: readonly string[];
  exclusionReasons: readonly string[];
}>;

export type EvidenceBoundPersuasiveStoryPacket = Readonly<{
  version: typeof PERSUASIVE_STORY_PACKET_VERSION;
  categoryId: string;
  storyVersion: string;
  keywordPacketVersion: typeof KEYWORD_INTELLIGENCE_PACKET_VERSION;
  keywordSetVersion: string;
  keywordPacketDigest: string;
  titlePacketVersion: typeof EVIDENCE_BOUND_TITLE_RANKING_VERSION;
  titlePacketDigest: string;
  creativePacketVersion: typeof PRODUCT_CREATIVE_PACKET_VERSION;
  creativePacketDigest: string;
  creativeBindings: Readonly<{
    candidateIds: readonly string[];
    assetDigests: readonly string[];
    grantDigests: readonly string[];
    operations: readonly string[];
    categoryEvidenceDigest: string;
    marketplacePolicyDigest: string;
  }>;
  claimSetDigest: string;
  mode: "SHADOW";
  status: "READY" | "QUARANTINED";
  executionEligible: false;
  generatedAt: string;
  candidates: readonly RankedStoryCandidate[];
  quarantinedClaimIds: readonly string[];
  humanRevision: Readonly<{
    candidateId: string;
    reviewerReference: string;
    reviewedAt: string;
    selections: readonly Readonly<{ claimId: string; phrasingIndex: number }>[];
  }> | null;
  digest: string;
}>;

export type HumanStoryRevision = Readonly<{
  candidateId: string;
  reviewerReference: string;
  reviewedAt: string;
  selections: readonly Readonly<{ claimId: string; phrasingIndex: number }>[];
}>;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key.normalize("NFC"))}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function normalize(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

function validDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function policyReasons(text: string, policy: StoryPolicy): readonly string[] {
  const normalized = normalize(text);
  const reasons: string[] = [];
  if (policy.forbiddenTerms.some((term) => normalized.includes(normalize(term)))) {
    reasons.push("FORBIDDEN_TERM");
  }
  for (const pattern of policy.prohibitedClaimPatterns) {
    try {
      if (new RegExp(pattern, "iu").test(text)) reasons.push("PROHIBITED_CLAIM");
    } catch {
      reasons.push("INVALID_POLICY_PATTERN");
    }
  }
  return sortedUnique(reasons);
}

function isFresh(observedAt: string, validUntil: string, now: Date): boolean {
  const observed = Date.parse(observedAt);
  const expires = Date.parse(validUntil);
  return Number.isFinite(observed) && Number.isFinite(expires)
    && observed <= now.getTime() && now.getTime() <= expires;
}

function claimReasons(claim: StoryClaim, policy: StoryPolicy, now: Date): readonly string[] {
  const reasons: string[] = [];
  if (claim.state !== "VERIFIED") reasons.push(`CLAIM_${claim.state}`);
  if (claim.approvedPhrasings.length === 0) reasons.push("APPROVED_PHRASING_MISSING");
  if (claim.factIds.length === 0) reasons.push("FACT_PROVENANCE_MISSING");
  if (claim.sourceReferences.length === 0 || claim.sourceReferences.some((value) => value.trim().length === 0)) {
    reasons.push("SOURCE_PROVENANCE_MISSING");
  }
  if (claim.evidenceDigests.length === 0 || claim.evidenceDigests.some((value) => !validDigest(value))) {
    reasons.push("EVIDENCE_DIGEST_INVALID");
  }
  if (!isFresh(claim.observedAt, claim.validUntil, now)) reasons.push("CLAIM_EVIDENCE_STALE");
  for (const phrasing of claim.approvedPhrasings) reasons.push(...policyReasons(phrasing, policy));
  return sortedUnique(reasons);
}

const TEMPLATE_VARIANTS = [
  { id: "balanced", version: "story-blocks-balanced-v1", boost: -1 },
  { id: "consideration", version: "story-blocks-consideration-v1", boost: 0 },
] as const;

export function buildEvidenceBoundPersuasiveStoryPacket(input: Readonly<{
  categoryId: string;
  storyVersion: string;
  keywordPacketVersion: typeof KEYWORD_INTELLIGENCE_PACKET_VERSION;
  keywordSetVersion: string;
  keywordPacketDigest: string;
  expectedKeywordPacketDigest: string;
  titlePacketVersion: typeof EVIDENCE_BOUND_TITLE_RANKING_VERSION;
  titlePacketDigest: string;
  expectedTitlePacketDigest: string;
  creativePacket: ProductCreativePacket;
  expectedCreativePacketDigest: string;
  generatedAt: string;
  claims: readonly StoryClaim[];
  personas: readonly StoryPersona[];
  objections: readonly StoryObjection[];
  policy: StoryPolicy;
}>): EvidenceBoundPersuasiveStoryPacket {
  if (input.keywordPacketVersion !== KEYWORD_INTELLIGENCE_PACKET_VERSION) throw new Error("KEYWORD_PACKET_VERSION_MISMATCH");
  if (input.titlePacketVersion !== EVIDENCE_BOUND_TITLE_RANKING_VERSION) throw new Error("TITLE_PACKET_VERSION_MISMATCH");
  if (input.keywordPacketDigest !== input.expectedKeywordPacketDigest) {
    throw new Error("KEYWORD_PACKET_DIGEST_MISMATCH");
  }
  if (input.titlePacketDigest !== input.expectedTitlePacketDigest) throw new Error("TITLE_PACKET_DIGEST_MISMATCH");
  if (input.creativePacket.version !== PRODUCT_CREATIVE_PACKET_VERSION) throw new Error("CREATIVE_PACKET_VERSION_MISMATCH");
  if (productCreativePacketDigest(input.creativePacket) !== input.creativePacket.digest
      || input.creativePacket.digest !== input.expectedCreativePacketDigest) throw new Error("CREATIVE_PACKET_DIGEST_MISMATCH");
  if (input.creativePacket.mode !== "SHADOW" || input.creativePacket.executionEligible !== false
      || input.creativePacket.status === "QUARANTINED") throw new Error("CREATIVE_PACKET_NOT_ADMISSIBLE");
  if (input.creativePacket.keywordSetVersion !== input.keywordSetVersion
      || input.creativePacket.keywordPacketDigest !== input.keywordPacketDigest
      || input.creativePacket.titlePacketDigest !== input.titlePacketDigest) throw new Error("CREATIVE_PACKET_INPUT_BINDING_MISMATCH");
  if (input.creativePacket.policySnapshot.categoryId !== input.categoryId
      || input.creativePacket.policySnapshot.categoryEvidenceDigest !== input.policy.categoryEvidenceDigest
      || input.creativePacket.policySnapshot.marketplacePolicyDigest !== input.policy.marketplacePolicyDigest) throw new Error("CREATIVE_PACKET_POLICY_BINDING_MISMATCH");
  for (const [name, value] of [
    ["keywordPacketDigest", input.keywordPacketDigest],
    ["titlePacketDigest", input.titlePacketDigest],
    ["categoryEvidenceDigest", input.policy.categoryEvidenceDigest],
    ["marketplacePolicyDigest", input.policy.marketplacePolicyDigest],
  ] as const) {
    if (!validDigest(value)) throw new Error(`${name.toUpperCase()}_INVALID`);
  }
  const generatedAt = new Date(input.generatedAt);
  if (!Number.isFinite(generatedAt.getTime())) throw new RangeError("generatedAt is invalid.");
  if (input.creativePacket.generatedAt !== generatedAt.toISOString()) throw new Error("CREATIVE_PACKET_TIME_MISMATCH");

  const claims = [...input.claims].sort((left, right) => left.claimId.localeCompare(right.claimId));
  if (new Set(claims.map(({ claimId }) => claimId)).size !== claims.length) throw new Error("DUPLICATE_CLAIM_ID");
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
  const reasonsByClaim = new Map(claims.map((claim) => [claim.claimId, claimReasons(claim, input.policy, generatedAt)]));
  const admittedClaims = claims.filter((claim) => reasonsByClaim.get(claim.claimId)?.length === 0);
  const admittedPersonas = input.personas
    .filter((persona) => persona.state === "VERIFIED" && persona.evidenceDigests.length > 0
      && persona.evidenceDigests.every(validDigest) && isFresh(persona.observedAt, persona.validUntil, generatedAt))
    .sort((left, right) => left.personaId.localeCompare(right.personaId));
  const admittedPersonaIds = new Set(admittedPersonas.map(({ personaId }) => personaId));
  const verifiedCreativeCandidates = input.creativePacket.candidates.filter(({ status }) => status === "VERIFIED");
  if (verifiedCreativeCandidates.length === 0) throw new Error("CREATIVE_CANDIDATE_MISSING");
  const storyCreativeCandidateIds = sortedUnique(verifiedCreativeCandidates.map(({ candidateId }) => candidateId));
  const creativeBlockTypes = new Set<StoryBlockType>(["SOLUTION", "CORE_BENEFIT", "USE_SCENE", "CONTENTS_USAGE"]);

  const candidates = TEMPLATE_VARIANTS.map((template): RankedStoryCandidate => {
    const candidateReasons: string[] = [];
    if (admittedPersonas.length === 0) candidateReasons.push("VERIFIED_PERSONA_MISSING");
    const blocks = STORY_BLOCK_ORDER.map((blockType): StoryBlock => {
      const blockClaims = admittedClaims.filter((claim) => claim.blockType === blockType);
      const objectionIds = input.objections
        .filter((objection) => [objection.questionClaimId, ...objection.answerClaimIds].some((claimId) => blockClaims.some((claim) => claim.claimId === claimId)))
        .map(({ objectionId }) => objectionId);
      return Object.freeze({
        blockId: `${template.id}:${blockType.toLocaleLowerCase("en-US")}`,
        blockType,
        version: template.version,
        personaIds: sortedUnique(admittedPersonas.map(({ personaId }) => personaId)),
        intents: sortedUnique(admittedPersonas.flatMap(({ intents }) => intents)) as readonly StoryIntent[],
        objectionIds: sortedUnique(objectionIds),
        creativeCandidateIds: creativeBlockTypes.has(blockType) ? storyCreativeCandidateIds : Object.freeze([]),
        sentences: Object.freeze(blockClaims.map((claim): StorySentence => Object.freeze({
          sentenceId: `${template.id}:${claim.claimId}:0`,
          text: claim.approvedPhrasings[0] ?? "",
          claimId: claim.claimId,
          phrasingIndex: 0,
          provenance: Object.freeze({
            factIds: sortedUnique(claim.factIds),
            sourceReferences: sortedUnique(claim.sourceReferences),
            evidenceDigests: sortedUnique(claim.evidenceDigests),
          }),
        }))),
      });
    });
    const missingBlocks = blocks.filter(({ sentences }) => sentences.length === 0).map(({ blockType }) => `BLOCK_MISSING:${blockType}`);
    candidateReasons.push(...missingBlocks);
    const coveredObjectionIds = sortedUnique(blocks.flatMap(({ objectionIds }) => objectionIds));
    for (const objection of input.objections.filter(({ required }) => required)) {
      const claimIds = [objection.questionClaimId, ...objection.answerClaimIds];
      if (!claimIds.every((claimId) => claimById.has(claimId) && reasonsByClaim.get(claimId)?.length === 0)) {
        candidateReasons.push(`OBJECTION_UNANSWERED:${objection.objectionId}`);
      }
      if (!claimIds.every((claimId) => claimById.get(claimId)?.blockType === "OBJECTIONS_FAQ")) {
        candidateReasons.push(`OBJECTION_BLOCK_INVALID:${objection.objectionId}`);
      }
      if (!objection.personaIds.every((personaId) => admittedPersonaIds.has(personaId))) {
        candidateReasons.push(`OBJECTION_PERSONA_UNVERIFIED:${objection.objectionId}`);
      }
    }
    const blockCoverage = Math.round((blocks.filter(({ sentences }) => sentences.length > 0).length / STORY_BLOCK_ORDER.length) * 100);
    const personaIntentCoverage = admittedPersonas.length === 0 ? 0 : Math.round((new Set(admittedPersonas.flatMap(({ intents }) => intents)).size / 3) * 100);
    const requiredObjections = input.objections.filter(({ required }) => required);
    const objectionCoverage = requiredObjections.length === 0 ? 100 : Math.round((requiredObjections.filter(({ objectionId }) => coveredObjectionIds.includes(objectionId)).length / requiredObjections.length) * 100);
    const provenanceCoverage = admittedClaims.length === 0 ? 0 : 100;
    const creativeEvidence = Math.round(verifiedCreativeCandidates.reduce((total, candidate) => total + (candidate.score ?? 0), 0) / verifiedCreativeCandidates.length);
    const uniqueReasons = sortedUnique(candidateReasons);
    const policyScore = uniqueReasons.length === 0 ? 100 : 0;
    const status = uniqueReasons.length === 0 ? "VERIFIED" as const : "QUARANTINED" as const;
    return Object.freeze({
      candidateId: `${input.categoryId}:${template.id}`,
      rank: 0,
      status,
      score: status === "VERIFIED" ? Math.round((blockCoverage * 0.25 + personaIntentCoverage * 0.15 + objectionCoverage * 0.15 + provenanceCoverage * 0.15 + policyScore * 0.1 + creativeEvidence * 0.2 + template.boost) * 100) / 100 : null,
      scoreBreakdown: Object.freeze({ blockCoverage, personaIntentCoverage, objectionCoverage, provenanceCoverage, policy: policyScore, creativeEvidence }),
      blocks: Object.freeze(blocks),
      coveredObjectionIds,
      exclusionReasons: uniqueReasons,
    });
  }).sort((left, right) => (right.score ?? -1) - (left.score ?? -1) || left.candidateId.localeCompare(right.candidateId))
    .map((candidate, index) => Object.freeze({ ...candidate, rank: index + 1 }));

  const packetWithoutDigest = {
    version: PERSUASIVE_STORY_PACKET_VERSION,
    categoryId: input.categoryId,
    storyVersion: input.storyVersion,
    keywordPacketVersion: input.keywordPacketVersion,
    keywordSetVersion: input.keywordSetVersion,
    keywordPacketDigest: input.keywordPacketDigest,
    titlePacketVersion: input.titlePacketVersion,
    titlePacketDigest: input.titlePacketDigest,
    creativePacketVersion: input.creativePacket.version,
    creativePacketDigest: input.creativePacket.digest,
    creativeBindings: Object.freeze({
      candidateIds: storyCreativeCandidateIds,
      assetDigests: sortedUnique(verifiedCreativeCandidates.map(({ provenance }) => provenance.sourceAssetDigest)),
      grantDigests: sortedUnique(verifiedCreativeCandidates.map(({ provenance }) => provenance.grantDigest)),
      operations: sortedUnique(verifiedCreativeCandidates.map(({ operation }) => operation)),
      categoryEvidenceDigest: input.creativePacket.policySnapshot.categoryEvidenceDigest,
      marketplacePolicyDigest: input.creativePacket.policySnapshot.marketplacePolicyDigest,
    }),
    claimSetDigest: sha256(claims),
    mode: "SHADOW" as const,
    status: candidates.every(({ status }) => status === "VERIFIED") ? "READY" as const : "QUARANTINED" as const,
    executionEligible: false as const,
    generatedAt: generatedAt.toISOString(),
    candidates: Object.freeze(candidates),
    quarantinedClaimIds: Object.freeze(claims.filter((claim) => (reasonsByClaim.get(claim.claimId)?.length ?? 0) > 0).map(({ claimId }) => claimId)),
    humanRevision: null,
  };
  return Object.freeze({ ...packetWithoutDigest, digest: sha256(packetWithoutDigest) });
}

export function applyHumanStoryRevision(
  packet: EvidenceBoundPersuasiveStoryPacket,
  revision: HumanStoryRevision,
  claims: readonly StoryClaim[],
): EvidenceBoundPersuasiveStoryPacket {
  const reviewedAt = new Date(revision.reviewedAt);
  if (!Number.isFinite(reviewedAt.getTime())) throw new RangeError("reviewedAt is invalid.");
  if (!/^reviewer:[A-Za-z0-9._-]{1,100}$/.test(revision.reviewerReference)) throw new Error("REVIEWER_REFERENCE_INVALID");
  const selected = packet.candidates.find(({ candidateId }) => candidateId === revision.candidateId);
  if (!selected || selected.status !== "VERIFIED") throw new Error("REVISION_CANDIDATE_NOT_VERIFIED");
  const orderedClaims = [...claims].sort((left, right) => left.claimId.localeCompare(right.claimId));
  if (sha256(orderedClaims) !== packet.claimSetDigest) throw new Error("REVISION_CLAIM_SET_MISMATCH");
  const selectedClaimIds = new Set(selected.blocks.flatMap(({ sentences }) => sentences.map(({ claimId }) => claimId)));
  if (revision.selections.some(({ claimId }) => !selectedClaimIds.has(claimId))) throw new Error("REVISION_CLAIM_NOT_IN_CANDIDATE");
  const claimById = new Map(orderedClaims.map((claim) => [claim.claimId, claim]));
  const selections = new Map(revision.selections.map((selection) => [selection.claimId, selection.phrasingIndex]));
  const revisedCandidates = packet.candidates.map((candidate) => candidate.candidateId !== revision.candidateId ? candidate : Object.freeze({
    ...candidate,
    blocks: Object.freeze(candidate.blocks.map((block) => Object.freeze({
      ...block,
      sentences: Object.freeze(block.sentences.map((sentence) => {
        const phrasingIndex = selections.get(sentence.claimId) ?? sentence.phrasingIndex;
        const claim = claimById.get(sentence.claimId);
        const text = claim?.approvedPhrasings[phrasingIndex];
        if (!claim || text === undefined) throw new Error(`UNAPPROVED_REVISION:${sentence.claimId}`);
        return Object.freeze({ ...sentence, sentenceId: `${sentence.sentenceId}:human`, text, phrasingIndex });
      })),
    }))),
  }));
  const humanRevision = Object.freeze({
    candidateId: revision.candidateId,
    reviewerReference: revision.reviewerReference,
    reviewedAt: reviewedAt.toISOString(),
    selections: Object.freeze([...revision.selections].sort((left, right) => left.claimId.localeCompare(right.claimId))),
  });
  const withoutDigest = { ...packet, candidates: Object.freeze(revisedCandidates), humanRevision };
  const { digest: previousDigest, ...digestable } = withoutDigest;
  void previousDigest;
  return Object.freeze({ ...withoutDigest, digest: sha256(digestable) });
}
