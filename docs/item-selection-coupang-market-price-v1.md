# Item Selection Coupang public market-price estimate v1

The Item Selection run now searches the official Naver Shopping Search API for
each bounded supplier candidate and retains only public offers whose disclosed
mall is `쿠팡` or `Coupang`. Title-token similarity removes unrelated offers.

The predicted selling price is the rounded median of up to ten matching current
offers. The UI also exposes the 25th-to-75th-percentile range, observation count,
and observation time. This value is `ESTIMATED` `MARKETPLACE_PUBLIC` evidence,
not a confirmed sale, transaction, or authorization to change a Coupang price.

The Coupang Seller Open API can query prices of the seller's own registered
products, but its documented product APIs do not provide a marketplace-wide
competitor product-search endpoint. Therefore this implementation reuses the
already configured official Naver Shopping Search API and explicitly filters
for Coupang offers. It does not scrape Coupang, call WING, expose credentials,
or perform any marketplace write.

If credentials, matching offers, or the provider are unavailable, the estimate
remains unavailable and no price is invented. An operator-entered selling price
still takes precedence and stays separately identified as operator input.
