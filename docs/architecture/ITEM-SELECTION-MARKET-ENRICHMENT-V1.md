# Item Selection Market Enrichment v1

The administrator Item Selection run requests `marketIntelligenceMode:
ENRICH`. The server joins candidates only by exact
`market_products.vendor_item_id` and reads the latest metric/snapshot evidence.
It maps opportunity, demand, growth, supply, and confidence into the existing
score areas without inventing missing values; the resulting score inputs remain
inside the existing canonical snapshot contract.

The public API default remains `OFF` for compatibility. Enrichment is
read-only and falls back to unavailable market facts when the optional
evidence store is unavailable. Existing rights hard gates, profitability gates, and all
commerce/Production boundaries remain unchanged.
