# Item Selection Market Enrichment v1

The administrator Item Selection run requests `marketIntelligenceMode:
ENRICH`. The server joins candidates only by exact
`market_products.vendor_item_id` and reads the latest metric/snapshot evidence.
It maps opportunity, demand, growth, supply, and confidence into the existing
score areas without inventing missing values.

The public API default remains `OFF` for compatibility. Enrichment is
read-only, records its status and exact evidence in the canonical snapshot,
and falls back to unavailable market facts when the optional evidence store is
unavailable. Existing rights hard gates, profitability gates, and all
commerce/Production boundaries remain unchanged.
