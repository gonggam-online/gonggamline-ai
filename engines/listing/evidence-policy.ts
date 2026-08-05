import {
  LISTING_EVIDENCE_SCHEMA_VERSION,
  LISTING_POLICY_RULESET_VERSION,
  type ListingEvidenceFact,
  type ListingEvidencePacket,
  type ListingEvidenceScope,
  type ListingEvidenceSource,
  type ListingFactClass,
  type ListingPolicyDecision,
  type ListingPolicyIssue,
} from "@/shared/domain/listing-evidence";

type FactRule = {
  readonly authorities: readonly ListingEvidenceSource[];
  readonly scopes: readonly ListingEvidenceScope[];
};

const FACT_RULES: Readonly<Record<ListingFactClass, FactRule>> = {
  CATALOG_CLAIM: {
    authorities: ["SUPPLIER_CATALOG"],
    scopes: ["CATALOG_ITEM"],
  },
  TRANSACTION_TERM: {
    authorities: ["TRANSACTION"],
    scopes: ["PURCHASED_SKU"],
  },
  PHYSICAL_OBSERVATION: {
    authorities: ["THREE_PL_INSPECTION"],
    scopes: ["INBOUND_LOT", "INSPECTED_UNIT"],
  },
  DOCUMENTARY_FACT: {
    authorities: ["COMPETENT_DOCUMENT"],
    scopes: ["CATALOG_ITEM", "PURCHASED_SKU", "INBOUND_LOT", "INSPECTED_UNIT"],
  },
  IMAGE_USE_RIGHT: {
    authorities: ["RIGHTS_GRANT"],
    scopes: ["ASSET"],
  },
  IMAGE_EDIT_RIGHT: {
    authorities: ["RIGHTS_GRANT"],
    scopes: ["ASSET"],
  },
  COUPANG_CATEGORY_REQUIREMENT: {
    authorities: ["COUPANG_CATEGORY_METADATA"],
    scopes: ["CATALOG_ITEM"],
  },
};

const SHA256 = /^[a-f0-9]{64}$/;
const REPLACEMENT_OR_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/u;
// Common UTF-8-as-legacy-codepage fragments. This is intentionally conservative:
// normalization and byte decoding remain the authoritative checks.
const COMMON_MOJIBAKE = /(?:Ã.|Â.|â(?:€|€™|€œ|€\x9d)|ðŸ|\?쒕|怨듦|媛꾪|援ъ)/u;

export function hasValidListingEncoding(value: string): boolean {
  if (value !== value.normalize("NFC")) return false;
  if (REPLACEMENT_OR_CONTROL.test(value) || COMMON_MOJIBAKE.test(value)) return false;
  const bytes = new TextEncoder().encode(value);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes) === value;
}

export function decodeValidUtf8(bytes: Uint8Array): string | null {
  try {
    const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return hasValidListingEncoding(value) ? value : null;
  } catch {
    return null;
  }
}

function makeIssue(
  code: ListingPolicyIssue["code"],
  field: string,
  facts: readonly ListingEvidenceFact[],
): ListingPolicyIssue {
  return {
    code,
    field,
    factIds: facts.map(({ factId }) => factId).sort(),
  };
}

function isValidTimestamp(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Date.parse(value));
}

function hasValidIdentity(
  fact: ListingEvidenceFact,
  packet: ListingEvidencePacket,
): boolean {
  return (
    fact.subjectId === packet.subjectId &&
    fact.factId.trim() !== "" &&
    fact.field.trim() !== "" &&
    fact.sourceReference.trim() !== "" &&
    fact.scopeReference.trim() !== "" &&
    SHA256.test(fact.evidenceDigest) &&
    isValidTimestamp(fact.observedAt) &&
    isValidTimestamp(fact.capturedAt)
  );
}

function hasValidFactEncoding(fact: ListingEvidenceFact): boolean {
  return [
    fact.field,
    fact.sourceReference,
    fact.scopeReference,
    typeof fact.value === "string" ? fact.value : "",
    fact.unit ?? "",
    fact.locale ?? "",
  ].every(hasValidListingEncoding);
}

export function evaluateListingEvidence(
  packet: ListingEvidencePacket,
): ListingPolicyDecision {
  const issues: ListingPolicyIssue[] = [];
  const candidates: ListingEvidenceFact[] = [];
  const packetValid =
    packet.schemaVersion === LISTING_EVIDENCE_SCHEMA_VERSION &&
    packet.subjectId.trim() !== "" &&
    packet.evaluationId.trim() !== "" &&
    isValidTimestamp(packet.evaluatedAt);

  if (!packetValid) {
    issues.push(makeIssue("INVALID_EVIDENCE", "$packet", packet.facts));
  }

  const fields = [...new Set([
    ...packet.requiredFields,
    ...packet.facts.map(({ field }) => field),
  ])].sort();

  for (const field of fields) {
    const facts = packet.facts.filter((fact) => fact.field === field);
    const proven = facts.filter(({ status }) => status === "PROVEN");

    if (packet.requiredFields.includes(field) && proven.length === 0) {
      issues.push(makeIssue("UNKNOWN_REQUIRED_FACT", field, facts));
    }
    if (
      facts.some(({ status }) => status === "CONFLICT") ||
      new Set(proven.map(({ value }) => JSON.stringify(value))).size > 1
    ) {
      issues.push(makeIssue("CONFLICTING_FACTS", field, facts));
    }
    if (facts.some(({ status }) => status === "PROHIBITED")) {
      issues.push(makeIssue("PROHIBITED_FACT", field, facts));
    }

    for (const fact of proven) {
      const rule = FACT_RULES[fact.factClass];
      if (!hasValidIdentity(fact, packet)) {
        issues.push(makeIssue("INVALID_EVIDENCE", field, [fact]));
      }
      if (!rule.authorities.includes(fact.sourceType)) {
        issues.push(makeIssue("WRONG_AUTHORITY", field, [fact]));
      }
      if (!rule.scopes.includes(fact.scope)) {
        issues.push(makeIssue("SCOPE_MISMATCH", field, [fact]));
      }
      if (
        fact.validUntil !== undefined &&
        (!isValidTimestamp(fact.validUntil) ||
          Date.parse(fact.validUntil) < Date.parse(packet.evaluatedAt))
      ) {
        issues.push(makeIssue("STALE_EVIDENCE", field, [fact]));
      }
      if (!hasValidFactEncoding(fact)) {
        issues.push(makeIssue("INVALID_ENCODING", field, [fact]));
      }
      candidates.push(fact);
    }
  }

  const uniqueIssues = [...new Map(
    issues.map((entry) => [
      `${entry.field}:${entry.code}:${entry.factIds.join(",")}`,
      entry,
    ]),
  ).values()].sort((left, right) =>
    `${left.field}:${left.code}`.localeCompare(`${right.field}:${right.code}`),
  );
  const disposition = uniqueIssues.length === 0 ? "ADMITTED" : "QUARANTINED";

  return {
    rulesetVersion: LISTING_POLICY_RULESET_VERSION,
    subjectId: packet.subjectId,
    evaluationId: packet.evaluationId,
    disposition,
    admittedFacts: disposition === "ADMITTED" ? candidates : [],
    issues: uniqueIssues,
  };
}
