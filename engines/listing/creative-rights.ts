import type {
  CreativeRenderJob,
  CreativeRightsCapabilities,
  CreativeSourceAuthorization,
} from "@/shared/domain/listing-creative";
import type { ListingAssetTransformation } from "@/shared/domain/listing-content";

type TransformCapability = Exclude<
  keyof CreativeRightsCapabilities,
  "commercialUnchangedUse" | "marketplaceRedistribution" | "providerUpload" | "syntheticOutputCommercialUse"
>;

const TRANSFORM_CAPABILITY: Readonly<Partial<Record<ListingAssetTransformation, TransformCapability>>> = {
  CROP: "crop",
  BACKGROUND_REMOVAL: "backgroundRemoval",
  TEXT_OVERLAY: "textOverlay",
  COMPOSITE: "composite",
  GENERATIVE_REFERENCE: "generativeReference",
};

export type CreativeRightsEvaluation = Readonly<{
  allowed: boolean;
  code:
    | "RIGHTS_VERIFIED"
    | "FACT_ONLY_SYNTHETIC_NO_INPUT"
    | "OBSERVATION_PIXELS_PROHIBITED"
    | "RIGHTS_REVOKED_OR_EXPIRED"
    | "INPUT_DIGEST_MISMATCH"
    | "OPERATION_NOT_VERIFIED"
    | "PROVIDER_UPLOAD_NOT_VERIFIED";
}>;

function active(source: CreativeSourceAuthorization, now: Date): boolean {
  if (source.revokedAt) return false;
  return !source.expiresAt || new Date(source.expiresAt).getTime() > now.getTime();
}

export function evaluateCreativeSourceAuthorization(
  transformation: CreativeRenderJob["transformation"],
  source: CreativeSourceAuthorization,
  providerUploadRequired: boolean,
  now = new Date(),
): CreativeRightsEvaluation {
  if (source.sourceClass === "MARKET_OBSERVATION") {
    return { allowed: false, code: "OBSERVATION_PIXELS_PROHIBITED" };
  }
  if (!active(source, now)) return { allowed: false, code: "RIGHTS_REVOKED_OR_EXPIRED" };
  if (providerUploadRequired && source.rights.providerUpload !== "VERIFIED") {
    return { allowed: false, code: "PROVIDER_UPLOAD_NOT_VERIFIED" };
  }
  if (transformation === "FACT_ONLY_SYNTHETIC") {
    return { allowed: false, code: "OPERATION_NOT_VERIFIED" };
  }
  if (transformation === "NONE") {
    const allowed = source.rights.commercialUnchangedUse === "VERIFIED"
      && source.rights.marketplaceRedistribution === "VERIFIED";
    return { allowed, code: allowed ? "RIGHTS_VERIFIED" : "OPERATION_NOT_VERIFIED" };
  }
  const capability = TRANSFORM_CAPABILITY[transformation];
  const allowed = Boolean(capability && source.rights[capability] === "VERIFIED");
  return { allowed, code: allowed ? "RIGHTS_VERIFIED" : "OPERATION_NOT_VERIFIED" };
}

export function evaluateCreativeRenderJobRights(
  job: CreativeRenderJob,
  providerUploadRequired: boolean,
  now = new Date(),
): CreativeRightsEvaluation {
  if (job.transformation === "FACT_ONLY_SYNTHETIC" && job.inputAssetDigests.length === 0 && job.inputSources.length === 0) {
    return { allowed: true, code: "FACT_ONLY_SYNTHETIC_NO_INPUT" };
  }
  const sourceDigests = job.inputSources.map(({ assetDigest }) => assetDigest);
  if (
    sourceDigests.length !== job.inputAssetDigests.length
    || !sourceDigests.every((digest, index) => digest === job.inputAssetDigests[index])
  ) {
    return { allowed: false, code: "INPUT_DIGEST_MISMATCH" };
  }
  for (const source of job.inputSources) {
    const result = evaluateCreativeSourceAuthorization(job.transformation, source, providerUploadRequired, now);
    if (!result.allowed) return result;
  }
  return { allowed: job.inputSources.length > 0, code: job.inputSources.length > 0 ? "RIGHTS_VERIFIED" : "OPERATION_NOT_VERIFIED" };
}
