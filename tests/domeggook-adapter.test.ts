import assert from "node:assert/strict";
import test from "node:test";
import {
  DomeggookSupplierCatalogAdapter,
  type DomeggookObservation,
  type DomeggookTransport,
} from "../lib/domeggook/client";
import {
  parseDomeggookDetailEnvelope,
  parseDomeggookItemDetailProviderDto,
  parseDomeggookItemListProviderDto,
  parseDomeggookProviderError,
  parseDomeggookSearchEnvelope,
} from "../lib/domeggook/dto";
import { DomeggookError } from "../lib/domeggook/errors";
import {
  mapDomeggookDetailItem,
  mapDomeggookListItem,
} from "../lib/domeggook/mapper";

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function listEnvelope(
  items: unknown,
  totalItems: unknown = 1
): unknown {
  return {
    domeggook: {
      header: { numberOfItems: totalItems },
      list: { item: items },
    },
  };
}

function detailEnvelope(item: unknown): unknown {
  return { domeggook: { item: item === null ? null : [item] } };
}

const validListItem = {
  no: "12345",
  title: "테스트 상품",
  thumb: "https://example.test/thumb.jpg",
  price: "1,200",
  unitQty: "2",
  id: "supplier-1",
  nick: "공급사",
  link: "https://example.test/item/12345",
  market: { domeggook: "true", supply: "false" },
  shipping: { fee: "3000" },
  stock: "available",
};

const validDetailItem = {
  basis: { no: "12345", title: "상세 상품", status: "판매중" },
  price: { supply: "1500", qty: "3" },
  seller: { id: "seller-1", name: "판매자" },
  thumb: { small: "https://example.test/detail.jpg" },
  shipping: { fee: 0 },
  link: "https://example.test/item/12345",
  market: { domeggook: true, supply: true },
};

async function expectCode(
  promise: Promise<unknown>,
  code: DomeggookError["code"]
) {
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof DomeggookError && error.code === code
  );
}

test("provider DTO parsers accept supported list/detail/error envelopes", () => {
  assert.equal(parseDomeggookItemListProviderDto(validListItem)?.no, "12345");
  assert.equal(
    parseDomeggookItemDetailProviderDto(validDetailItem)?.basis.no,
    "12345"
  );
  assert.equal(
    parseDomeggookSearchEnvelope(listEnvelope(validListItem))?.items.length,
    1
  );
  assert.equal(
    parseDomeggookDetailEnvelope(detailEnvelope(validDetailItem)) === null,
    false
  );
  assert.deepEqual(
    parseDomeggookProviderError({
      domeggook: { error: { code: "AUTH", message: "rejected" } },
    }),
    { code: "AUTH", message: "rejected" }
  );
});

test("provider DTO parsers reject malformed contracts", () => {
  assert.equal(parseDomeggookItemListProviderDto({ title: "missing id" }), null);
  assert.equal(
    parseDomeggookItemDetailProviderDto({ basis: { title: "missing id" } }),
    null
  );
  assert.equal(parseDomeggookSearchEnvelope({ domeggook: {} }), null);
  assert.equal(parseDomeggookDetailEnvelope({ unexpected: true }), null);
});

test("list mapper preserves nullable provider-neutral fields", () => {
  const mapped = mapDomeggookListItem(validListItem);
  assert.deepEqual(mapped, {
    provider: "domeggook",
    providerItemId: "12345",
    name: "테스트 상품",
    supplierPriceKrw: 1200,
    shippingFeeKrw: 3000,
    minimumOrderQuantity: 2,
    stockStatus: "in_stock",
    thumbnailUrl: "https://example.test/thumb.jpg",
    productUrl: "https://example.test/item/12345",
    supplierId: "supplier-1",
    supplierName: "공급사",
    availableOnDomeggook: true,
    supplyAvailable: false,
  });
});

test("detail mapper converts nested provider DTO", () => {
  const mapped = mapDomeggookDetailItem(validDetailItem);
  assert.equal(mapped.providerItemId, "12345");
  assert.equal(mapped.supplierPriceKrw, 1500);
  assert.equal(mapped.minimumOrderQuantity, 3);
  assert.equal(mapped.shippingFeeKrw, 0);
  assert.equal(mapped.stockStatus, "in_stock");
});

test("mapper rejects negative and non-finite numeric fields", () => {
  assert.throws(() => mapDomeggookListItem({ no: "1", price: "-1" }));
  assert.throws(() => mapDomeggookListItem({ no: "1", price: "NaN" }));
  assert.throws(() => mapDomeggookListItem({ no: "1", unitQty: "1.5" }));
});

test("input validation occurs before configuration or network access", async () => {
  let calls = 0;
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: null,
    transport: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  await expectCode(adapter.getItem("abc"), "VALIDATION_FAILED");
  await expectCode(adapter.searchItems("a"), "VALIDATION_FAILED");
  await expectCode(adapter.searchItems("valid", 0, 20), "VALIDATION_FAILED");
  await expectCode(adapter.searchItems("valid", 1, 51), "VALIDATION_FAILED");
  assert.equal(calls, 0);
});

test("missing configuration fails without transport access", async () => {
  let calls = 0;
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: null,
    transport: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  await expectCode(adapter.searchItems("생활"), "CONFIGURATION_MISSING");
  assert.equal(calls, 0);
  assert.equal(adapter.isConfigured(), false);
});

test("search maps one item and pagination without automatic traversal", async () => {
  let calls = 0;
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport: async () => {
      calls += 1;
      return jsonResponse(listEnvelope(validListItem, "21"));
    },
  });
  const result = await adapter.searchItems(" 생활 ", 2, 10);
  assert.equal(calls, 1);
  assert.equal(result.items[0]?.providerItemId, "12345");
  assert.deepEqual(result.pagination, {
    page: 2,
    size: 10,
    totalItems: 21,
    hasNextPage: true,
  });
});

test("empty search is a successful contract result", async () => {
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport: async () => jsonResponse(listEnvelope(null, 0)),
  });
  const result = await adapter.searchItems("생활");
  assert.deepEqual(result.items, []);
  assert.equal(result.pagination.hasNextPage, false);
});

test("getItem maps detail and returns typed not_found", async () => {
  const found = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport: async () => jsonResponse(detailEnvelope(validDetailItem)),
  });
  assert.equal((await found.getItem("12345")).status, "found");

  const missing = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport: async () => jsonResponse(detailEnvelope(null)),
  });
  assert.deepEqual(await missing.getItem("12345"), {
    status: "not_found",
    item: null,
  });
});

test("authentication HTTP failure is typed and is not retried", async () => {
  let calls = 0;
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport: async () => {
      calls += 1;
      return jsonResponse({}, 401);
    },
  });
  await expectCode(adapter.searchItems("생활"), "AUTHENTICATION_FAILED");
  assert.equal(calls, 1);
});

test("provider authentication payload is typed and is not exposed", async () => {
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport: async () =>
      jsonResponse({
        domeggook: { error: { code: "INVALID_AID", message: "auth failed" } },
      }),
  });
  await expectCode(adapter.searchItems("생활"), "AUTHENTICATION_FAILED");
});

test("429 retries once only with a valid Retry-After", async () => {
  let calls = 0;
  const delays: number[] = [];
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
    transport: async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({}, 429, { "retry-after": "1" })
        : jsonResponse(listEnvelope([], 0));
    },
  });
  await adapter.searchItems("생활");
  assert.equal(calls, 2);
  assert.deepEqual(delays, [1000]);
});

test("429 without valid Retry-After is not retried", async () => {
  let calls = 0;
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport: async () => {
      calls += 1;
      return jsonResponse({}, 429);
    },
  });
  await expectCode(adapter.searchItems("생활"), "RATE_LIMITED");
  assert.equal(calls, 1);
});

test("transient provider failure retries at most twice with backoff", async () => {
  let calls = 0;
  const delays: number[] = [];
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    random: () => 0.5,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
    transport: async () => {
      calls += 1;
      return jsonResponse({}, 503);
    },
  });
  await expectCode(adapter.searchItems("생활"), "PROVIDER_ERROR");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [200, 400]);
});

test("network and timeout errors use distinct taxonomy", async () => {
  const network = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    sleep: async () => undefined,
    transport: async () => {
      throw new TypeError("connection failed");
    },
  });
  await expectCode(network.searchItems("생활"), "NETWORK_ERROR");

  const timeout = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    sleep: async () => undefined,
    transport: async () => {
      throw new DOMException("timed out", "TimeoutError");
    },
  });
  await expectCode(timeout.searchItems("생활"), "TIMEOUT");
});

test("invalid JSON and invalid provider mapping are contract errors", async () => {
  const invalidJson = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport: async () => new Response("{", { status: 200 }),
  });
  await expectCode(
    invalidJson.searchItems("생활"),
    "RESPONSE_CONTRACT_ERROR"
  );

  const invalidMapping = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport: async () =>
      jsonResponse(listEnvelope({ ...validListItem, price: "-1" })),
  });
  await expectCode(
    invalidMapping.searchItems("생활"),
    "RESPONSE_CONTRACT_ERROR"
  );
});

test("observability is sanitized and reports retry count", async () => {
  const secret = "never-log-this";
  let calls = 0;
  const observations: DomeggookObservation[] = [];
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: secret,
    random: () => 0.5,
    sleep: async () => undefined,
    createCorrelationId: () => "correlation-safe",
    observe: (observation) => observations.push(observation),
    transport: async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({}, 502)
        : jsonResponse(listEnvelope([], 0));
    },
  });
  await adapter.searchItems("생활");
  assert.equal(observations.length, 1);
  assert.equal(observations[0]?.retryCount, 1);
  assert.equal(observations[0]?.correlationId, "correlation-safe");
  assert.equal(JSON.stringify(observations).includes(secret), false);
});

test("transport request contains only bounded read-only provider modes", async () => {
  const urls: URL[] = [];
  const transport: DomeggookTransport = async (url) => {
    urls.push(new URL(url));
    return jsonResponse(listEnvelope([], 0));
  };
  const adapter = new DomeggookSupplierCatalogAdapter({
    apiKey: "secret",
    transport,
  });
  await adapter.searchItems("생활", 1, 50);
  assert.equal(urls[0]?.searchParams.get("mode"), "getItemList");
  assert.equal(urls[0]?.searchParams.get("sz"), "50");
  assert.equal(urls[0]?.searchParams.get("market"), "dome");
});
