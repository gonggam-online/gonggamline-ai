import type {
  SupplierCatalogItem,
  SupplierCatalogStockStatus,
} from "../../shared/domain/supplier-catalog";
import type {
  DomeggookItemDetailProviderDto,
  DomeggookItemListProviderDto,
} from "./dto";

export class DomeggookMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomeggookMappingError";
  }
}

function requiredId(value: unknown): string {
  const result =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  if (!/^\d{1,20}$/.test(result)) {
    throw new DomeggookMappingError("Provider item id is invalid.");
  }
  return result;
}

function nullableString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const result = String(value).trim();
  return result === "" ? null : result;
}

function nullableNonNegativeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replaceAll(",", "").trim())
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new DomeggookMappingError("Provider numeric value is invalid.");
  }
  return parsed;
}

function nullablePositiveInteger(value: unknown): number | null {
  const parsed = nullableNonNegativeNumber(value);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new DomeggookMappingError("Provider quantity is invalid.");
  }
  return parsed;
}

function nullableBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) {
    return value === 1;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "y", "yes", "1"].includes(normalized)) return true;
    if (["false", "n", "no", "0"].includes(normalized)) return false;
  }
  return null;
}

function stockStatus(value: unknown): SupplierCatalogStockStatus {
  const normalized = nullableString(value)?.toLowerCase();
  if (!normalized) return "unknown";
  if (["soldout", "out_of_stock", "품절", "n", "0"].includes(normalized)) {
    return "out_of_stock";
  }
  if (["available", "in_stock", "판매중", "y", "1"].includes(normalized)) {
    return "in_stock";
  }
  return "unknown";
}

export function mapDomeggookListItem(
  dto: DomeggookItemListProviderDto
): SupplierCatalogItem {
  return {
    provider: "domeggook",
    providerItemId: requiredId(dto.no),
    name: nullableString(dto.title),
    supplierPriceKrw: nullableNonNegativeNumber(dto.price),
    shippingFeeKrw: nullableNonNegativeNumber(dto.shipping?.fee),
    minimumOrderQuantity: nullablePositiveInteger(dto.unitQty),
    stockStatus: stockStatus(dto.stock),
    thumbnailUrl: nullableString(dto.thumb),
    productUrl: nullableString(dto.url ?? dto.link),
    supplierId: nullableString(dto.id ?? dto.sellerId),
    supplierName: nullableString(dto.nick),
    availableOnDomeggook: nullableBoolean(dto.market?.domeggook),
    supplyAvailable: nullableBoolean(dto.market?.supply),
  };
}

export function mapDomeggookDetailItem(
  dto: DomeggookItemDetailProviderDto
): SupplierCatalogItem {
  return {
    provider: "domeggook",
    providerItemId: requiredId(dto.basis.no),
    name: nullableString(dto.basis.title),
    supplierPriceKrw: nullableNonNegativeNumber(
      dto.price?.supply ?? dto.price?.dome
    ),
    shippingFeeKrw: nullableNonNegativeNumber(dto.shipping?.fee),
    minimumOrderQuantity: nullablePositiveInteger(dto.price?.qty),
    stockStatus: stockStatus(dto.basis.status),
    thumbnailUrl: nullableString(dto.thumb?.small ?? dto.thumb?.big),
    productUrl: nullableString(dto.link),
    supplierId: nullableString(dto.seller?.id),
    supplierName: nullableString(dto.seller?.name),
    availableOnDomeggook: nullableBoolean(dto.market?.domeggook),
    supplyAvailable: nullableBoolean(dto.market?.supply),
  };
}
