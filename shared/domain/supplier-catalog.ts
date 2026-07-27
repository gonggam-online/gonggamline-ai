export type SupplierCatalogStockStatus =
  | "in_stock"
  | "out_of_stock"
  | "unknown";

export type SupplierCatalogItem = {
  provider: "domeggook";
  providerItemId: string;
  name: string | null;
  supplierPriceKrw: number | null;
  shippingFeeKrw: number | null;
  minimumOrderQuantity: number | null;
  stockStatus: SupplierCatalogStockStatus;
  thumbnailUrl: string | null;
  productUrl: string | null;
  supplierId: string | null;
  supplierName: string | null;
  availableOnDomeggook: boolean | null;
  supplyAvailable: boolean | null;
};

export type SupplierCatalogSearchResult = {
  provider: "domeggook";
  items: SupplierCatalogItem[];
  pagination: {
    page: number;
    size: number;
    totalItems: number | null;
    hasNextPage: boolean | null;
  };
};

export type SupplierCatalogItemResult =
  | { status: "found"; item: SupplierCatalogItem }
  | { status: "not_found"; item: null };

export interface SupplierCatalogPort {
  getItem(itemNo: string): Promise<SupplierCatalogItemResult>;
  searchItems(
    keyword: string,
    page?: number,
    size?: number
  ): Promise<SupplierCatalogSearchResult>;
}
