import type {
  SupplierCatalogItemResult,
  SupplierCatalogPort,
  SupplierCatalogSearchResult,
} from "../shared/domain/supplier-catalog";

export class SupplierCatalogService {
  constructor(private readonly catalog: SupplierCatalogPort) {}

  getItem(itemNo: string): Promise<SupplierCatalogItemResult> {
    return this.catalog.getItem(itemNo);
  }

  searchItems(
    keyword: string,
    page?: number,
    size?: number
  ): Promise<SupplierCatalogSearchResult> {
    return this.catalog.searchItems(keyword, page, size);
  }
}
