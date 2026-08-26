import { createHash } from "node:crypto";
import type { MarketObservationInput } from "../../types/market";

export type TenbiImportResult = Readonly<{ source: "tenbi"; sourceDigest: string; importedAt: string; rows: readonly MarketObservationInput[]; rejected: readonly { row: number; reason: string }[] }>;
const text = (v: unknown) => typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
const num = (v: unknown) => { const n = Number(text(v).replaceAll(",", "")); return Number.isFinite(n) ? n : null; };
export function importTenbiRows(input: readonly Record<string, unknown>[], now = new Date()): TenbiImportResult {
  const rejected: { row: number; reason: string }[] = []; const rows: MarketObservationInput[] = [];
  input.forEach((r, i) => { const title = text(r.title ?? r.product ?? r.product_name); const keyword = text(r.keyword ?? r.query); if (!title || !keyword) { rejected.push({ row: i + 1, reason: "TITLE_OR_KEYWORD_MISSING" }); return; }
    rows.push({ source: "manual", keyword, observedAt: text(r.observed_at ?? r.collected_at) || now.toISOString(), product: { externalProductId: text(r.product_id ?? r.id) || `tenbi-${i + 1}`, url: text(r.url) || null, title, brand: text(r.brand) || null, sellerName: text(r.seller) || null, category: text(r.category) || null }, snapshot: { price: num(r.price), reviewCount: num(r.reviews ?? r.review_count), rank: num(r.rank), rocketType: text(r.rocket) || null } }); });
  const sourceDigest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return Object.freeze({ source: "tenbi", sourceDigest, importedAt: now.toISOString(), rows: Object.freeze(rows), rejected: Object.freeze(rejected) });
}
export function parseTenbiCsv(csv: string): readonly Record<string, string>[] { const lines = csv.split(/\r?\n/).filter(Boolean); if (!lines.length) return []; const headers = lines[0].split(",").map((x) => x.trim()); return lines.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, (line.split(",")[i] ?? "").trim()]))); }
