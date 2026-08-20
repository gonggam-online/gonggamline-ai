export const SUPPLIER_QUOTE_COMPARISON_VERSION =
  "gonggamline-supplier-quote-comparison-v1" as const;

export type SupplierOfferProvider = "domeggook" | "manual_verified";
export type SupplierOfferStock = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
export type SupplierOfferRights = "VERIFIED" | "UNKNOWN" | "FAILED";

export type CanonicalSupplierOffer = Readonly<{
  provider: SupplierOfferProvider;
  providerItemId: string;
  canonicalIdentity: string;
  title: string;
  variantKey: string;
  unitsPerOffer: number;
  unitCostKrw: number | null;
  shippingKrw: number | null;
  minimumOrderQuantity: number | null;
  leadTimeDays: number | null;
  stock: SupplierOfferStock;
  rights: SupplierOfferRights;
  observedAt: string;
  sourceReference: string;
  evidenceDigest: string;
}>;

export type SupplierComparisonCosts = Readonly<{
  supplierToFulfillmentPerUnitKrw: number;
  fulfillmentPerUnitKrw: number;
  marketplaceAndAdvertisingPerUnitKrw: number;
  returnAllowancePerUnitKrw: number;
}>;

export type SupplierComparisonPolicy = Readonly<{
  maximumQuoteAgeDays: number;
  minimumAlternativeSavingsKrw: number;
  minimumAlternativeSavingsRate: number;
}>;

export type SupplierQuoteComparisonInput = Readonly<{
  candidateIdentity: string;
  variantKey: string;
  unitsPerOffer: number;
  domeggookBaseline: CanonicalSupplierOffer | null;
  alternatives: readonly CanonicalSupplierOffer[];
  costs: SupplierComparisonCosts;
  policy?: Partial<SupplierComparisonPolicy>;
  evaluatedAt: string;
}>;

export type SupplierQuoteComparisonStatus =
  | "DOMEGGOOK_BASELINE"
  | "ALTERNATIVE_BETTER"
  | "ALTERNATIVE_COMPARABLE"
  | "ALTERNATIVE_INCOMPLETE"
  | "NO_VERIFIED_MATCH";

export type SupplierOfferEvaluation = Readonly<{
  offer: CanonicalSupplierOffer;
  landedCostPerUnitKrw: number | null;
  savingsKrwPerUnit: number | null;
  savingsRate: number | null;
  eligibleForComparison: boolean;
  executionEligible: false;
  reasons: readonly string[];
}>;

export type SupplierQuoteComparisonResult = Readonly<{
  version: typeof SUPPLIER_QUOTE_COMPARISON_VERSION;
  status: SupplierQuoteComparisonStatus;
  baseline: SupplierOfferEvaluation | null;
  alternatives: readonly SupplierOfferEvaluation[];
  preferred: SupplierOfferEvaluation | null;
  nextActions: readonly string[];
}>;

const DEFAULT_POLICY: SupplierComparisonPolicy = Object.freeze({
  maximumQuoteAgeDays: 7,
  minimumAlternativeSavingsKrw: 100,
  minimumAlternativeSavingsRate: 0.03,
});

function finiteNonNegative(value: number | null, field: string): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${field} must be non-negative.`);
  return value;
}

function positiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${field} must be a positive integer.`);
}

function validateOffer(offer: CanonicalSupplierOffer): void {
  if (!offer.providerItemId.trim() || !offer.canonicalIdentity.trim() || !offer.variantKey.trim()) {
    throw new RangeError("offer identity fields are required.");
  }
  if (!offer.title.trim() || !offer.sourceReference.trim() || !offer.evidenceDigest.trim()) {
    throw new RangeError("offer title, sourceReference, and evidenceDigest are required.");
  }
  positiveInteger(offer.unitsPerOffer, "offer.unitsPerOffer");
  finiteNonNegative(offer.unitCostKrw, "offer.unitCostKrw");
  finiteNonNegative(offer.shippingKrw, "offer.shippingKrw");
  if (offer.minimumOrderQuantity !== null) positiveInteger(offer.minimumOrderQuantity, "offer.minimumOrderQuantity");
  if (offer.leadTimeDays !== null) finiteNonNegative(offer.leadTimeDays, "offer.leadTimeDays");
  if (!Number.isFinite(Date.parse(offer.observedAt))) throw new RangeError("offer.observedAt must be an ISO date.");
}

function validateCosts(costs: SupplierComparisonCosts): void {
  finiteNonNegative(costs.supplierToFulfillmentPerUnitKrw, "costs.supplierToFulfillmentPerUnitKrw");
  finiteNonNegative(costs.fulfillmentPerUnitKrw, "costs.fulfillmentPerUnitKrw");
  finiteNonNegative(costs.marketplaceAndAdvertisingPerUnitKrw, "costs.marketplaceAndAdvertisingPerUnitKrw");
  finiteNonNegative(costs.returnAllowancePerUnitKrw, "costs.returnAllowancePerUnitKrw");
}

function ageDays(observedAt: string, evaluatedAt: string): number {
  return (Date.parse(evaluatedAt) - Date.parse(observedAt)) / 86_400_000;
}

function landedCost(offer: CanonicalSupplierOffer, costs: SupplierComparisonCosts): number | null {
  if (offer.unitCostKrw === null || offer.shippingKrw === null) return null;
  return offer.unitCostKrw + offer.shippingKrw / offer.unitsPerOffer +
    costs.supplierToFulfillmentPerUnitKrw + costs.fulfillmentPerUnitKrw +
    costs.marketplaceAndAdvertisingPerUnitKrw + costs.returnAllowancePerUnitKrw;
}

function evaluateOffer(
  offer: CanonicalSupplierOffer,
  input: SupplierQuoteComparisonInput,
  policy: SupplierComparisonPolicy,
  baselineCost: number | null,
): SupplierOfferEvaluation {
  validateOffer(offer);
  const reasons: string[] = [];
  const cost = landedCost(offer, input.costs);
  if (cost === null) reasons.push("MISSING_UNIT_OR_SHIPPING_COST");
  if (offer.canonicalIdentity !== input.candidateIdentity) reasons.push("IDENTITY_MISMATCH");
  if (offer.variantKey !== input.variantKey || offer.unitsPerOffer !== input.unitsPerOffer) reasons.push("VARIANT_OR_PACK_MISMATCH");
  if (offer.rights !== "VERIFIED") reasons.push("RIGHTS_NOT_VERIFIED");
  const age = ageDays(offer.observedAt, input.evaluatedAt);
  if (!Number.isFinite(age) || age < 0 || age > policy.maximumQuoteAgeDays) reasons.push("QUOTE_STALE_OR_FUTURE");
  if (offer.stock === "OUT_OF_STOCK") reasons.push("OUT_OF_STOCK");
  const eligible = reasons.length === 0 && cost !== null && baselineCost !== null;
  const savings = eligible && cost !== null && baselineCost !== null ? baselineCost - cost : null;
  const savingsRate = eligible && savings !== null && baselineCost !== null && baselineCost > 0 ? savings / baselineCost : null;
  return Object.freeze({
    offer,
    landedCostPerUnitKrw: cost,
    savingsKrwPerUnit: savings,
    savingsRate,
    eligibleForComparison: eligible,
    executionEligible: false,
    reasons: Object.freeze(reasons),
  });
}

function policyFrom(input: SupplierQuoteComparisonInput): SupplierComparisonPolicy {
  const policy = Object.freeze({ ...DEFAULT_POLICY, ...input.policy });
  if (!Number.isFinite(policy.maximumQuoteAgeDays) || policy.maximumQuoteAgeDays < 0) throw new RangeError("maximumQuoteAgeDays must be non-negative.");
  if (!Number.isFinite(policy.minimumAlternativeSavingsKrw) || policy.minimumAlternativeSavingsKrw < 0) throw new RangeError("minimumAlternativeSavingsKrw must be non-negative.");
  if (!Number.isFinite(policy.minimumAlternativeSavingsRate) || policy.minimumAlternativeSavingsRate < 0 || policy.minimumAlternativeSavingsRate > 1) throw new RangeError("minimumAlternativeSavingsRate must be between 0 and 1.");
  return policy;
}

export function compareSupplierQuotes(input: SupplierQuoteComparisonInput): SupplierQuoteComparisonResult {
  if (!input.candidateIdentity.trim() || !input.variantKey.trim()) throw new RangeError("candidate identity and variant are required.");
  positiveInteger(input.unitsPerOffer, "unitsPerOffer");
  if (!Number.isFinite(Date.parse(input.evaluatedAt))) throw new RangeError("evaluatedAt must be an ISO date.");
  validateCosts(input.costs);
  const policy = policyFrom(input);
  if (input.domeggookBaseline !== null) validateOffer(input.domeggookBaseline);
  const baseline = input.domeggookBaseline === null ? null : evaluateOffer(input.domeggookBaseline, input, policy, null);
  const baselineCost = baseline?.landedCostPerUnitKrw ?? null;
  const baselineEvaluation = baseline === null ? null : Object.freeze({ ...baseline, eligibleForComparison: baseline.reasons.length === 0 && baselineCost !== null });
  const alternatives = input.alternatives
    .filter((offer) => offer.provider === "manual_verified" || offer.provider === "domeggook")
    .map((offer) => evaluateOffer(offer, input, policy, baselineCost))
    .sort((left, right) => (right.savingsKrwPerUnit ?? -Infinity) - (left.savingsKrwPerUnit ?? -Infinity) || left.offer.providerItemId.localeCompare(right.offer.providerItemId));
  const preferred = alternatives.find((offer) => offer.eligibleForComparison &&
    (offer.savingsKrwPerUnit ?? 0) >= policy.minimumAlternativeSavingsKrw &&
    (offer.savingsRate ?? 0) >= policy.minimumAlternativeSavingsRate) ?? null;
  const hasEligibleAlternative = alternatives.some((offer) => offer.eligibleForComparison);
  const status: SupplierQuoteComparisonStatus = preferred !== null
    ? "ALTERNATIVE_BETTER"
    : hasEligibleAlternative ? "ALTERNATIVE_COMPARABLE"
      : baselineEvaluation !== null ? (alternatives.length > 0 ? "ALTERNATIVE_INCOMPLETE" : "DOMEGGOOK_BASELINE")
        : "NO_VERIFIED_MATCH";
  const nextActions = preferred === null
    ? [baselineEvaluation === null ? "도매꾹 기준 견적을 확인하세요." : "대체 공급처의 동일 SKU·옵션·묶음·권리·견적 신선도를 확인하세요."]
    : ["대체 공급처가 도매꾹 기준보다 유리합니다. 주문 전 운영자 견적 승인을 받으세요."];
  return Object.freeze({ version: SUPPLIER_QUOTE_COMPARISON_VERSION, status, baseline: baselineEvaluation, alternatives: Object.freeze(alternatives), preferred, nextActions: Object.freeze(nextActions) });
}
