import { NextRequest, NextResponse } from "next/server";
import { DomeggookSupplierCatalogAdapter } from "../../../../../lib/domeggook/client";
import {
  DomeggookError,
  domeggookErrorHttpStatus,
} from "../../../../../lib/domeggook/errors";
import { SupplierCatalogService } from "../../../../../services/supplier-catalog.service";
import type {
  SupplierCatalogItem,
  SupplierCatalogSearchResult,
} from "../../../../../shared/domain/supplier-catalog";

type LiveSearchItem = Pick<
  SupplierCatalogItem,
  | "providerItemId"
  | "name"
  | "supplierPriceKrw"
  | "shippingFeeKrw"
  | "minimumOrderQuantity"
  | "stockStatus"
  | "thumbnailUrl"
  | "productUrl"
  | "supplierName"
  | "availableOnDomeggook"
  | "supplyAvailable"
>;

type LiveSearchResponse = {
  items: LiveSearchItem[];
  pagination: {
    page: number;
    size: number;
    total: number | null;
    hasNext: boolean | null;
  };
  meta: {
    provider: "domeggook";
    live: true;
  };
};

const service = new SupplierCatalogService(
  new DomeggookSupplierCatalogAdapter()
);

function optionalInteger(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new DomeggookError("VALIDATION_FAILED");
  }
  return Number(value);
}

function toResponse(result: SupplierCatalogSearchResult): LiveSearchResponse {
  return {
    items: result.items.map(
      ({
        providerItemId,
        name,
        supplierPriceKrw,
        shippingFeeKrw,
        minimumOrderQuantity,
        stockStatus,
        thumbnailUrl,
        productUrl,
        supplierName,
        availableOnDomeggook,
        supplyAvailable,
      }) => ({
        providerItemId,
        name,
        supplierPriceKrw,
        shippingFeeKrw,
        minimumOrderQuantity,
        stockStatus,
        thumbnailUrl,
        productUrl,
        supplierName,
        availableOnDomeggook,
        supplyAvailable,
      })
    ),
    pagination: {
      page: result.pagination.page,
      size: result.pagination.size,
      total: result.pagination.totalItems,
      hasNext: result.pagination.hasNextPage,
    },
    meta: {
      provider: "domeggook",
      live: true,
    },
  };
}

export function createDomeggookLiveSearchHandler(
  catalogService: SupplierCatalogService
) {
  return async function domeggookLiveSearchHandler(request: NextRequest) {
    try {
      const keyword = request.nextUrl.searchParams.get("q") ?? "";
      const page = optionalInteger(request.nextUrl.searchParams.get("page"));
      const size = optionalInteger(request.nextUrl.searchParams.get("size"));
      const result = await catalogService.searchItems(keyword, page, size);

      return NextResponse.json(toResponse(result), {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (caught) {
      if (caught instanceof DomeggookError) {
        return NextResponse.json(
          {
            error: {
              code: caught.code,
              message: "Domeggook live search is unavailable.",
              retryable: caught.retryable,
            },
          },
          {
            status: domeggookErrorHttpStatus(caught.code),
            headers: { "Cache-Control": "no-store" },
          }
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Domeggook live search is unavailable.",
            retryable: false,
          },
        },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }
  };
}

export const GET = createDomeggookLiveSearchHandler(service);
