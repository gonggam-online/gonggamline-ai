import {
  LISTING_POLICY_RULESET_VERSION,
  type EvidenceScope,
  type EvidenceSourceType,
  type ListingEvidenceFact,
  type ListingEvidencePacket,
  type ListingFactClass,
  type ListingPolicyDecision,
  type PolicyIssue,
} from "@/shared/domain/listing-evidence";

const AUTHORITY: Readonly<Record<ListingFactClass, readonly EvidenceSourceType[]>> = {
  CATALOG_CLAIM: ["SUPPLIER_CATALOG"],
  TRANSACTION_TERM: ["TRANSACTION"],
  PHYSICAL_OBSERVATION: ["THREE_PL_INSPECTION"],
  DOCUMENTARY_FACT: ["COMPETENT_DOCUMENT"],
  IMAGE_USE_RIGHT: ["RIGHTS_GRANT"],
  IMAGE_EDIT_RIGHT: ["RIGHTS_GRANT"],
  COUPANG_CATEGORY_REQUIREMENT: ["COUPANG_CATEGORY_METADATA"],
};

const SCOPE: Readonly<Record<ListingFactClass, readonly EvidenceScope[]>> = {
  CATALOG_CLAIM: ["CATALOG_ITEM"],
  TRANSACTION_TERM: ["PURCHASED_SKU"],
  PHYSICAL_OBSERVATION: ["INBOUND_LOT", "INSPECTED_UNIT"],
  DOCUMENTARY_FACT: ["CATALOG_ITEM", "PURCHASED_SKU", "INBOUND_LOT", "INSPECTED_UNIT"],
  IMAGE_USE_RIGHT: ["ASSET"],
  IMAGE_EDIT_RIGHT: ["ASSET"],
  COUPANG_CATEGORY_REQUIREMENT: ["CATALOG_ITEM"],
};

const MOJIBAKE = /(?:\uFFFD|(?:Ã|Â|â€|ë|ì|í|ê)[\u0080-\uFFFF])/u;
const SHA256 = /^[a-f0-9]{64}$/;

export function hasValidListingEncoding(value: string): boolean {
  if (value !== value.normalize("NFC") || MOJIBAKE.test(value)) return false;
  return new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(value)) === value;
}

function issue(code: PolicyIssue["code"], field: string, facts: readonly ListingEvidenceFact[]): PolicyIssue {
  return { code, field, factIds: facts.map(({ factId }) => factId).sort() };
}

function validIdentity(fact: ListingEvidenceFact, packet: ListingEvidencePacket): boolean {
  return fact.subjectId === packet.subjectId
    && fact.factId.length > 0
    && fact.sourceReference.length > 0
    && fact.scopeReference.length > 0
    && SHA256.test(fact.evidenceDigest)
    && Number.isFinite(Date.parse(fact.observedAt))
    && Number.isFinite(Date.parse(fact.capturedAt));
}

export function evaluateListingEvidence(packet: ListingEvidencePacket): ListingPolicyDecision {
  const issues: PolicyIssue[] = [];
  const admittedFacts: ListingEvidenceFact[] = [];
  const fields = new Set([...packet.requiredFields, ...packet.facts.map(({ field }) => field)]);

  for (const field of [...fields].sort()) {
    const facts = packet.facts.filter((fact) => fact.field === field);
    if (packet.requiredFields.includes(field) && !facts.some(({ status }) => status === "PROVEN")) {
      issues.push(issue("UNKNOWN_REQUIRED_FACT", field, facts));
    }
    if (facts.some(({ status }) => status === "CONFLICT")
      || new Set(facts.filter(({ status }) => status === "PROVEN").map(({ value }) => JSON.stringify(value))).size > 1) {
      issues.push(issue("CONFLICTING_FACTS", field, facts));
    }
    if (facts.some(({ status }) => status === "PROHIBITED")) issues.push(issue("PROHIBITED_FACT", field, facts));

    for (const fact of facts.filter(({ status }) => status === "PROVEN")) {
      if (!validIdentity(fact, packet)) issues.push(issue("INVALID_EVIDENCE", field, [fact]));
      if (!AUTHORITY[fact.factClass].includes(fact.sourceType)) issues.push(issue("WRONG_AUTHORITY", field, [fact]));
      if (!SCOPE[fact.factClass].includes(fact.scope)) issues.push(issue("SCOPE_MISMATCH", field, [fact]));
      if (fact.validUntil && Date.parse(fact.validUntil) < Date.parse(packet.evaluatedAt)) {
        issues.push(issue("STALE_EVIDENCE", field, [fact]));
      }
      const strings = [fact.field, fact.sourceReference, fact.scopeReference, typeof fact.value === "string" ? fact.value : ""];
      if (strings.some((value) => !hasValidListingEncoding(value))) issues.push(issue("INVALID_ENCODING", field, [fact]));
      admittedFacts.push(fact);
    }
  }

  const uniqueIssues = [...new Map(issues.map((entry) => [
    `${entry.code}:${entry.field}:${entry.factIds.join(",")}`,
    entry,
  ])).values()].sort((left, right) => `${left.field}:${left.code}`.localeCompare(`${right.field}:${right.code}`));

  return {
    rulesetVersion: LISTING_POLICY_RULESET_VERSION,
    subjectId: packet.subjectId,
    evaluationId: packet.evaluationId,
    disposition: uniqueIssues.length === 0 ? "ADMITTED" : "QUARANTINED",
    admittedFacts: uniqueIssues.length === 0 ? admittedFacts : [],
    issues: uniqueIssues,
  };
}
