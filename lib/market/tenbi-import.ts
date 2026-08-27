import { createHash } from "node:crypto";
import type { MarketObservationInput } from "../../types/market";
import { createExternalMarketSignalPacket, type ExternalMarketSignalPacket } from "../../shared/contracts/external-market-signal-packet";
import { parseDelimitedText, readAlias } from "./delimited-import";

export type TenbiImportResult = Readonly<{ source: "tenbi"; sourceDigest: string; importedAt: string; rows: readonly MarketObservationInput[]; packets: readonly ExternalMarketSignalPacket[]; rejected: readonly { row: number; reason: string }[] }>;
const text = (v: unknown) => typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
const num = (v: unknown) => { const n = Number(text(v).replaceAll(",", "")); return Number.isFinite(n) ? n : null; };
export function importTenbiRows(input: readonly Record<string, unknown>[], now = new Date()): TenbiImportResult {
  const rejected: { row: number; reason: string }[] = []; const rows: MarketObservationInput[] = []; const packets: ExternalMarketSignalPacket[] = [];
  input.forEach((r, i) => {
    const title = text(readAlias(r, ["title", "product", "product_name", "상품명", "소재명"]));
    const keyword = text(readAlias(r, ["keyword", "query", "검색어", "키워드"])) || title;
    if (!title) { rejected.push({ row: i + 1, reason: "TITLE_MISSING" }); return; }
    const observedAt = text(readAlias(r, ["observed_at", "collected_at", "published_at", "관찰시각", "게시시각"])) || now.toISOString();
    const sourceUrl = text(readAlias(r, ["url", "source_url", "원문", "원문url"])) || null;
    const platform = text(readAlias(r, ["platform", "channel", "플랫폼", "채널"])) || "TENBI";
    const category = text(readAlias(r, ["category", "카테고리"])) || null;
    const externalProductId = text(readAlias(r, ["product_id", "id", "platform_product_id", "상품id"])) || createHash("sha256").update(`${platform}\n${sourceUrl ?? title}`).digest("hex").slice(0, 24);
    const views = num(readAlias(r, ["views", "view_count", "조회", "조회수"]));
    const likes = num(readAlias(r, ["likes", "like_count", "좋아요"]));
    const comments = num(readAlias(r, ["comments", "comment_count", "댓글"]));
    const shares = num(readAlias(r, ["shares", "share_count", "공유"]));
    const rising = num(readAlias(r, ["rising_score", "heat", "급상승", "급상승지수"]));
    const engagement = views && likes !== null ? Math.min(100, ((likes + (comments ?? 0) + (shares ?? 0)) / views) * 500) : rising === null ? null : Math.min(100, rising);
    rows.push({ source: "manual", keyword, observedAt, product: { externalProductId, url: sourceUrl, title, brand: text(readAlias(r, ["brand", "브랜드"])) || null, sellerName: text(readAlias(r, ["seller", "판매자"])) || null, category }, snapshot: { price: num(readAlias(r, ["price", "판매가", "가격"])), reviewCount: num(readAlias(r, ["reviews", "review_count", "리뷰", "리뷰수"])), rank: num(readAlias(r, ["rank", "순위"])), rocketType: text(readAlias(r, ["rocket", "로켓"])) || null } });
    packets.push(createExternalMarketSignalPacket({ source: "TENBI", upstreamSource: platform.toUpperCase(), observedVia: "tenbi_user_assisted_import", collectedAt: observedAt, validUntil: new Date(new Date(observedAt).getTime() + 7 * 86_400_000).toISOString(), keywordId: keyword, productIdentity: { title, brand: null, model: null, gtin: null, sellerCode: null, option: null, specification: null, bundleQuantity: null }, platformProductId: externalProductId, sourceUrl, categoryBinding: category, demand: { score: null, absolute: views, posts7d: null, posts14d: null, posts30d: null, profitability: null }, competition: { score: null }, socialMomentum: { score: engagement, views, likes, comments, shares, creatorDispersion: null, outlierDominance: null, country: null, language: null }, priceSnapshot: { current: num(readAlias(r, ["price", "판매가", "가격"])), volatility: null }, reviewSnapshot: { count: num(readAlias(r, ["reviews", "review_count", "리뷰", "리뷰수"])), velocity: null }, rankingSnapshot: { rank: num(readAlias(r, ["rank", "순위"])), volatility: null }, rocketShare: num(readAlias(r, ["rocket_share", "로켓비중"])), supplierQuoteBinding: null, logisticsCostBinding: null, evidenceConfidence: sourceUrl ? 55 : 40, missingEvidence: ["ABSOLUTE_DEMAND", "SUPPLIER_QUOTE", "LOGISTICS_COST"], provenance: r }));
  });
  const sourceDigest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return Object.freeze({ source: "tenbi", sourceDigest, importedAt: now.toISOString(), rows: Object.freeze(rows), packets: Object.freeze(packets), rejected: Object.freeze(rejected) });
}
export const parseTenbiCsv = parseDelimitedText;
