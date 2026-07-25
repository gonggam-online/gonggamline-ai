# Revenue Dashboard API

## Purpose

`GET /api/dashboard/revenue` returns a read-only, ranked Product projection for
the Revenue Dashboard. It reuses Revenue Calculation, Revenue Score, and
Revenue Ranking without changing their formulas or persisting results.

## Query parameters

| Parameter | Default | Constraints |
| --- | ---: | --- |
| `limit` | `20` | Integer from `1` to `100` |
| `offset` | `0` | Non-negative integer |
| `recommendationLevel` | none | `STRONG_RECOMMEND`, `RECOMMEND`, `WATCH`, `NOT_RECOMMENDED` |
| `status` | none | `ready`, `estimated`, `incomplete`, `invalid` |
| `minRevenueScore` | `0` | Number from `0` to `100` |

Unknown recommendation levels and statuses are ignored. Invalid numeric values
use their defaults, while out-of-range numeric values are clamped.

## Response

```json
{
  "success": true,
  "available": true,
  "filters": {
    "limit": 20,
    "offset": 0,
    "recommendationLevel": null,
    "status": null,
    "minRevenueScore": 0
  },
  "pagination": {
    "limit": 20,
    "offset": 0,
    "totalCount": 1,
    "returnedCount": 1,
    "hasNextPage": false
  },
  "products": [
    {
      "productId": "SKU-1",
      "productName": "Example",
      "rankingScore": 82.4,
      "revenueScore": 78.1,
      "recommendationLevel": "STRONG_RECOMMEND",
      "confidence": 0.9,
      "reasonCodes": ["HIGH_MARGIN"],
      "status": "ready",
      "lastAnalyzedAt": "2026-07-25T00:00:00.000Z"
    }
  ]
}
```

Products are sorted by `rankingScore DESC`; the Ranking Engine rank is the
deterministic tie breaker. Filtering occurs before offset/limit pagination.
Items with a `null` Revenue Score do not satisfy `minRevenueScore`.

If the Product read source is unavailable, the endpoint returns HTTP 200 with
`available: false`, an empty Product array, and the same filter/pagination
envelope. Unexpected failures return HTTP 500 with a sanitized message.

## Safety

- Read-only Product access.
- No database or migration change.
- No Queue, Worker, OpenAI, or LLM call.
- No marketplace, pricing, order, inventory, or Production write.
