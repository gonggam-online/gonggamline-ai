# Coupang logistics static-egress runbook v1

Status: implementation companion; external billing and allowlist changes remain
owner-controlled.

## Why this is required

Coupang Open API uses HMAC authentication and requires an IP allowlist for the
calling server. A Vercel Function's default outbound address is dynamic, so a
valid access/secret key can still receive an authentication-or-allowlist
failure. The read-only logistics probe must therefore run from an execution
environment with stable egress.

## Lowest-operational-cost production option

Keep the application on Vercel and enable the Vercel **Static IPs** add-on for
the Production project in one Seoul region (`icn1`). Vercel documents Static
IPs as the Pro/Enterprise option for stable outbound addresses; Secure Compute
is the Enterprise-only dedicated-network option. Add both assigned egress IPs
to the Coupang Open API allowlist. Do not enable build traffic through Static
IPs unless a build needs the allowlisted API.

The application route remains server-only and read-only. `COUPANG_ACCESS_KEY`,
`COUPANG_SECRET_KEY`, and `COUPANG_VENDOR_ID` stay Production secrets. HMAC is
generated per request; no secret or signed header is sent to the browser.

## Verification sequence

1. Vercel Project → Settings → Connectivity → Static IPs → Production → `icn1`.
2. Copy the two assigned IPs to the Coupang Open API IP allowlist in WING.
3. Confirm the key is an Open API key with Logistics read permission; do not
   use a browser session or a product-write key as a substitute.
4. Redeploy Production after the network setting is active.
5. In the admin adapter page, run **Coupang 물류 API 연결 확인**. `READY` means
   the one-record outbound read contract passed; it does not authorize writes.
6. Only then run address matching. If the probe reports
   `AUTHENTICATION_OR_IP_ALLOWLIST`, do not retry repeatedly; fix the key scope
   or allowlist and rerun once.

## Cost and fallback

Static IPs is an additional Vercel plan feature. If the cost is not approved,
use the already-implemented owner-confirmed WING logistics import once and
reuse the immutable private packet; this avoids API calls entirely. A separate
NAT/VPS gateway would add another secret and availability boundary and is not
the minimum-cost option for this single read-only integration.

## Safety boundary

The preflight and address lookup never create/update products, orders,
inventory, prices, shipping settings, or WING submissions. Production
`REGISTRATION_READY` and live-write approval remain separate gates.

## Authoritative references (observed 2026-08-18)

- Coupang Developer Center: <https://developers.coupang.com/en>
- Coupang HMAC signing: <https://developers.coupang.com/en/getting-started/creating-hmac-signature>
- Coupang outbound shipping-location read contract: <https://developers.coupang.com/en/api/logistics/query-a-shipping-location>
- Vercel fixed-egress guidance: <https://examples.vercel.com/kb/guide/how-to-allowlist-deployment-ip-address>
- Vercel Static IP availability: <https://examples.vercel.com/kb/guide/can-i-get-a-fixed-ip-address>

These references establish the integration constraints only; they do not grant
permission to change a seller account, add billing, or submit a product.
