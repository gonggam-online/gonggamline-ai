import { createHash } from "node:crypto";

import { createCoupangCategorySnapshot, digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { coupangRequest, getCoupangConfig, type CoupangApiResult } from "@/lib/coupang/client";
import {
  COUPANG_EVIDENCE_RULESET_VERSION,
  COUPANG_EVIDENCE_SCHEMA_VERSION,
  type CoupangEvidenceErrorCode,
  type EvidenceReadResult,
  type EvidenceSource,
  type MarketplacePreflightEvidenceV2,
  type OutboundLocationEvidence,
  type ReturnCenterEvidence,
} from "@/shared/contracts/coupang-preflight-evidence";
import type { CoupangCategorySnapshot } from "@/shared/contracts/coupang-category-snapshot";

const HOST = "https://api-gateway.coupang.com";
const CATEGORY_META_PATH = "/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes";
const CATEGORY_VALIDITY_PATH = "/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories";
const OUTBOUND_PATH = "/v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound";
const RETURN_PATH_TEMPLATE = "/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/returnShippingCenters";
const MAX_RETURN_PAGES = 10;
const PAGE_SIZE = 50;
const SAFE_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

type ReadTransport = <T>(options: Readonly<{
  method: "GET";
  path: string;
  searchParams?: URLSearchParams;
}>) => Promise<CoupangApiResult<T>>;
type VendorIdentity = Readonly<{ vendorId: string; vendorRef: string }>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function digest(value: unknown): `sha256:${string}` | null {
  const result = digestCanonicalJson(value);
  return result ? `sha256:${result}` : null;
}

function source(observedAt: string, sourceUrl: string, raw: unknown): EvidenceSource | null {
  const responseDigest = digest(raw);
  if (!Number.isFinite(Date.parse(observedAt)) || !responseDigest) return null;
  return Object.freeze({
    observedAt,
    sourceUrl,
    schemaVersion: COUPANG_EVIDENCE_SCHEMA_VERSION,
    rulesetVersion: COUPANG_EVIDENCE_RULESET_VERSION,
    responseDigest,
  });
}

function classify(status: number): CoupangEvidenceErrorCode {
  if (status === 401 || status === 403) return "AUTHENTICATION_OR_SCOPE";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "RESPONSE_CONTRACT_ERROR";
}

export function createOpaqueCoupangVendorRef(vendorId: string): string {
  return `coupang-vendor:${createHash("sha256").update(`coupang-vendor-ref:${vendorId}`).digest("hex")}`;
}

function defaultVendorIdentity(): VendorIdentity {
  const { vendorId } = getCoupangConfig();
  return { vendorId, vendorRef: createOpaqueCoupangVendorRef(vendorId) };
}

export function decodeOutboundEvidence(input: Readonly<{
  raw: unknown;
  vendorRef: string;
  selectedCode: string;
  observedAt: string;
  sourceUrl: string;
}>): EvidenceReadResult<OutboundLocationEvidence> {
  const root = record(input.raw);
  if (!root || !Array.isArray(root.content) || root.content.length > PAGE_SIZE) {
    return { ok: false, code: "RESPONSE_CONTRACT_ERROR" };
  }
  const matches = root.content.flatMap((value) => {
    const item = record(value);
    const code = item?.outboundShippingPlaceCode;
    return item && (typeof code === "number" || typeof code === "string") &&
      String(code) === input.selectedCode && typeof item.usable === "boolean"
      ? [{ usable: item.usable }]
      : [];
  });
  if (matches.length === 0) return { ok: false, code: "EVIDENCE_NOT_FOUND" };
  if (matches.length !== 1 || !matches[0].usable) return { ok: false, code: "EVIDENCE_CONFLICT" };
  const evidenceSource = source(input.observedAt, input.sourceUrl, input.raw);
  return evidenceSource ? { ok: true, evidence: Object.freeze({
    vendorRef: input.vendorRef,
    outboundShippingPlaceCode: input.selectedCode,
    usable: true,
    source: evidenceSource,
  }) } : { ok: false, code: "RESPONSE_CONTRACT_ERROR" };
}

export function decodeReturnEvidence(input: Readonly<{
  pages: readonly unknown[];
  exhausted?: boolean;
  vendorRef: string;
  selectedCode: string;
  observedAt: string;
  sourceUrl: string;
}>): EvidenceReadResult<ReturnCenterEvidence> {
  if (input.pages.length === 0 || input.pages.length > MAX_RETURN_PAGES) {
    return { ok: false, code: "EVIDENCE_LIMIT_EXCEEDED" };
  }
  const matches: string[] = [];
  for (const page of input.pages) {
    const root = record(page);
    if (!root || !Array.isArray(root.data) || root.data.length > PAGE_SIZE ||
      !(typeof root.code === "number" || typeof root.code === "string")) {
      return { ok: false, code: "RESPONSE_CONTRACT_ERROR" };
    }
    for (const value of root.data) {
      const item = record(value);
      if (item?.returnCenterCode === input.selectedCode) matches.push(input.selectedCode);
    }
  }
  if (input.exhausted && matches.length === 0) return { ok: false, code: "EVIDENCE_LIMIT_EXCEEDED" };
  if (matches.length === 0) return { ok: false, code: "EVIDENCE_NOT_FOUND" };
  if (matches.length !== 1) return { ok: false, code: "EVIDENCE_CONFLICT" };
  const evidenceSource = source(input.observedAt, input.sourceUrl, input.pages);
  return evidenceSource ? { ok: true, evidence: Object.freeze({
    vendorRef: input.vendorRef,
    returnCenterCode: input.selectedCode,
    source: evidenceSource,
  }) } : { ok: false, code: "RESPONSE_CONTRACT_ERROR" };
}

export function createCoupangEvidenceReader(dependencies: Readonly<{
  transport?: ReadTransport;
  now?: () => Date;
  resolveVendorIdentity?: () => VendorIdentity;
}> = {}) {
  const transport = dependencies.transport ?? coupangRequest;
  const now = dependencies.now ?? (() => new Date());
  const resolveVendorIdentity = dependencies.resolveVendorIdentity ?? defaultVendorIdentity;
  return Object.freeze({
    async readCategory(displayCategoryCode: string): Promise<EvidenceReadResult<CoupangCategorySnapshot>> {
      if (!/^\d+$/.test(displayCategoryCode)) return { ok: false, code: "RESPONSE_CONTRACT_ERROR" };
      const observedAt = now().toISOString();
      try {
        const [metadata, validity] = await Promise.all([
          transport<unknown>({ method: "GET", path: `${CATEGORY_META_PATH}/${displayCategoryCode}` }),
          transport<unknown>({ method: "GET", path: `${CATEGORY_VALIDITY_PATH}/${displayCategoryCode}/status` }),
        ]);
        if (!metadata.ok) return { ok: false, code: classify(metadata.status) };
        if (!validity.ok) return { ok: false, code: classify(validity.status) };
        const snapshot = createCoupangCategorySnapshot({
          displayCategoryCode,
          channel: "MARKETPLACE",
          observedAt,
          evaluatedAt: observedAt,
          metadataResponse: metadata.data,
          validityResponse: validity.data,
        });
        return snapshot.disposition === "VALIDATED"
          ? { ok: true, evidence: snapshot }
          : { ok: false, code: "RESPONSE_CONTRACT_ERROR" };
      } catch {
        return { ok: false, code: "NETWORK_UNAVAILABLE" };
      }
    },

    async readOutbound(selectedCode: string): Promise<EvidenceReadResult<OutboundLocationEvidence>> {
      if (!SAFE_CODE.test(selectedCode)) return { ok: false, code: "RESPONSE_CONTRACT_ERROR" };
      let identity: VendorIdentity;
      try {
        identity = resolveVendorIdentity();
      } catch {
        return { ok: false, code: "CONFIGURATION_UNAVAILABLE" };
      }
      try {
        const searchParams = new URLSearchParams({ placeCodes: selectedCode });
        const result = await transport<unknown>({ method: "GET", path: OUTBOUND_PATH, searchParams });
        if (!result.ok) return { ok: false, code: classify(result.status) };
        return decodeOutboundEvidence({
          raw: result.data,
          vendorRef: identity.vendorRef,
          selectedCode,
          observedAt: now().toISOString(),
          sourceUrl: `${HOST}${OUTBOUND_PATH}?placeCodes=${encodeURIComponent(selectedCode)}`,
        });
      } catch {
        return { ok: false, code: "NETWORK_UNAVAILABLE" };
      }
    },

    async readReturnCenter(selectedCode: string): Promise<EvidenceReadResult<ReturnCenterEvidence>> {
      if (!SAFE_CODE.test(selectedCode)) return { ok: false, code: "RESPONSE_CONTRACT_ERROR" };
      let identity: VendorIdentity;
      try {
        identity = resolveVendorIdentity();
      } catch {
        return { ok: false, code: "CONFIGURATION_UNAVAILABLE" };
      }
      try {
        const path = RETURN_PATH_TEMPLATE.replace("{vendorId}", encodeURIComponent(identity.vendorId));
        const pages: unknown[] = [];
        let exhausted = false;
        for (let pageNum = 1; pageNum <= MAX_RETURN_PAGES; pageNum += 1) {
          const searchParams = new URLSearchParams({ pageNum: String(pageNum), pageSize: String(PAGE_SIZE) });
          const result = await transport<unknown>({ method: "GET", path, searchParams });
          if (!result.ok) return { ok: false, code: classify(result.status) };
          pages.push(result.data);
          const root = record(result.data);
          if (!root || !Array.isArray(root.data)) return { ok: false, code: "RESPONSE_CONTRACT_ERROR" };
          if (root.data.some((entry) => record(entry)?.returnCenterCode === selectedCode)) break;
          if (root.data.length < PAGE_SIZE) break;
          if (pageNum === MAX_RETURN_PAGES) exhausted = true;
        }
        return decodeReturnEvidence({
          pages,
          exhausted,
          vendorRef: identity.vendorRef,
          selectedCode,
          observedAt: now().toISOString(),
          sourceUrl: `${HOST}${RETURN_PATH_TEMPLATE}`,
        });
      } catch {
        return { ok: false, code: "NETWORK_UNAVAILABLE" };
      }
    },
  });
}

export function assembleMarketplacePreflightEvidence(input: Readonly<{
  categorySnapshot: CoupangCategorySnapshot;
  outbound: OutboundLocationEvidence;
  returnCenter: ReturnCenterEvidence;
}>): MarketplacePreflightEvidenceV2 | null {
  if (input.outbound.vendorRef !== input.returnCenter.vendorRef) return null;
  const normalized = { categorySnapshot: input.categorySnapshot, outbound: input.outbound, returnCenter: input.returnCenter };
  const evidenceFingerprint = digest(normalized);
  return evidenceFingerprint ? Object.freeze({ ...normalized, evidenceFingerprint }) : null;
}
