import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NextRequest } from "next/server";
import { createDomeggookLiveSearchHandler } from "../app/api/integrations/domeggook/search/route";
import { DomeggookError } from "../lib/domeggook/errors";
import { SupplierCatalogService } from "../services/supplier-catalog.service";
import type { SupplierCatalogPort } from "../shared/domain/supplier-catalog";

function catalog(
  searchItems: SupplierCatalogPort["searchItems"]
): SupplierCatalogPort {
  return {
    getItem: async () => ({ status: "not_found", item: null }),
    searchItems,
  };
}

test("live search returns a bounded public DTO without persistence fields", async () => {
  const inputs: unknown[][] = [];
  const handler = createDomeggookLiveSearchHandler(
    new SupplierCatalogService(
      catalog(async (...input) => {
        inputs.push(input);
        return {
          provider: "domeggook",
          items: [
            {
              provider: "domeggook",
              providerItemId: "123",
              name: "Sample",
              supplierPriceKrw: 1000,
              shippingFeeKrw: 3000,
              minimumOrderQuantity: 2,
              stockStatus: "in_stock",
              thumbnailUrl: "https://example.test/image.jpg",
              productUrl: "https://example.test/item/123",
              supplierId: "secret-internal-id",
              supplierName: "Supplier",
              availableOnDomeggook: true,
              supplyAvailable: true,
            },
          ],
          pagination: {
            page: 2,
            size: 10,
            totalItems: 21,
            hasNextPage: true,
          },
        };
      })
    )
  );

  const response = await handler(
    new NextRequest(
      "https://example.test/api/integrations/domeggook/search?q=sample&page=2&size=10"
    )
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(inputs, [["sample", 2, 10]]);
  assert.equal(body.items[0].providerItemId, "123");
  assert.equal("supplierId" in body.items[0], false);
  assert.equal("score" in body.items[0], false);
  assert.equal("recommendation" in body.items[0], false);
  assert.deepEqual(body.pagination, {
    page: 2,
    size: 10,
    total: 21,
    hasNext: true,
  });
  assert.deepEqual(body.meta, { provider: "domeggook", live: true });
});

test("live search rejects malformed pagination before service access", async () => {
  let calls = 0;
  const handler = createDomeggookLiveSearchHandler(
    new SupplierCatalogService(
      catalog(async () => {
        calls += 1;
        throw new Error("must not run");
      })
    )
  );
  const response = await handler(
    new NextRequest(
      "https://example.test/api/integrations/domeggook/search?q=sample&page=1.5"
    )
  );

  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  assert.deepEqual(await response.json(), {
    error: {
      code: "VALIDATION_FAILED",
      message: "Domeggook live search is unavailable.",
      retryable: false,
    },
  });
});

test("live search exposes sanitized typed provider failures", async () => {
  const handler = createDomeggookLiveSearchHandler(
    new SupplierCatalogService(
      catalog(async () => {
        throw new DomeggookError("RATE_LIMITED", {
          cause: new Error("provider secret"),
        });
      })
    )
  );
  const response = await handler(
    new NextRequest(
      "https://example.test/api/integrations/domeggook/search?q=sample"
    )
  );
  const serialized = JSON.stringify(await response.json());

  assert.equal(response.status, 429);
  assert.equal(serialized.includes("provider secret"), false);
  assert.equal(serialized.includes("RATE_LIMITED"), true);
});

test("live search route has no database or Supabase dependency", async () => {
  const source = await readFile(
    new URL(
      "../app/api/integrations/domeggook/search/route.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.equal(/\bsupabase\b/i.test(source), false);
  assert.equal(/\b(insert|update|upsert|delete)\s*\(/i.test(source), false);
  assert.equal(source.includes("SupplierCatalogService"), true);
});
