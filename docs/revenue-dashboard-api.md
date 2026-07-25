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
| `keyword` | empty | Trimmed Product title/keyword/product-number search, at most 100 characters |
| `recommendationLevel` | none | `STRONG_RECOMMEND`, `RECOMMEND`, `WATCH`, `NOT_RECOMMENDED` |
| `status` | none | `ready`, `estimated`, `incomplete`, `invalid` |
| `minRevenueScore` | none | Number from `0` to `100` |

Invalid, fractional, empty, or out-of-range pagination values return HTTP 400.
Unknown enum values and invalid minimum scores also return HTTP 400.

Product keyword search reuses the existing Product query before Ranking,
filtering, and pagination. Requests that omit `keyword` retain the original
behavior and response DTO.

## Response

```json
{
  "items": [
    {
      "rank": 1,
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
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 1,
    "returned": 1,
    "hasMore": false
  },
  "filters": {
    "recommendationLevel": null,
    "status": null,
    "minRevenueScore": null
  },
  "meta": {
    "generatedAt": "2026-07-25T12:00:00.000Z",
    "engineVersion": null,
    "rankingVersion": null,
    "totalProducts": 1
  }
}
```

Items retain their global Ranking Engine rank across pages. Filtering uses AND
semantics, then sorting applies `rankingScore DESC`, `revenueScore DESC`,
`confidence DESC`, `rank ASC`, and `productId ASC` before pagination.
Items with a `null` Revenue Score remain when `minRevenueScore` is omitted and
do not satisfy an explicitly supplied minimum.

`generatedAt` is the response-generation time. `lastAnalyzedAt` only uses the
stored competition analysis timestamp. Because the existing engines do not
publish version identifiers, `engineVersion` and `rankingVersion` remain
`null` rather than exposing invented values.

## Error contract

```json
{
  "error": {
    "code": "INVALID_QUERY_PARAMETER",
    "message": "limit must be an integer from 1 to 100",
    "details": {
      "parameter": "limit"
    }
  }
}
```

Invalid query parameters return HTTP 400. Unexpected failures return HTTP 500
with a sanitized `REVENUE_DASHBOARD_UNAVAILABLE` error.

## Safety

- Read-only Product access.
- No database or migration change.
- No Queue, Worker, OpenAI, or LLM call.
- No marketplace, pricing, order, inventory, or Production write.
