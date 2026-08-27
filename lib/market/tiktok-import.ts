import { createHash } from "node:crypto";
import type { ExternalMarketSignalPacket } from "../../shared/contracts/external-market-signal-packet";
import { createExternalMarketSignalPacket } from "../../shared/contracts/external-market-signal-packet";
import { parseDelimitedText, readAlias } from "./delimited-import";
export type TikTokFixtureRow = Readonly<{ id: string; keyword: string; title: string; url?: string; views?: number; likes?: number; comments?: number; shares?: number; posts7d?: number; posts14d?: number; posts30d?: number; country?: string; language?: string; category?: string; observedAt?: string }>;
export function importTikTokFixture(row: TikTokFixtureRow, now = new Date()): ExternalMarketSignalPacket { const views = row.views ?? 0; const engagement = views ? ((row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0)) / views * 100 : null; return createExternalMarketSignalPacket({ source: "TIKTOK", upstreamSource: "tiktok_creator_center_csv", observedVia: "official_import", collectedAt: row.observedAt ?? now.toISOString(), validUntil: new Date(now.getTime() + 86_400_000).toISOString(), keywordId: row.keyword, productIdentity: { title: row.title, brand: null, model: null, gtin: null, sellerCode: null, option: null, specification: null, bundleQuantity: null }, platformProductId: row.id, sourceUrl: row.url ?? null, categoryBinding: row.category ?? null, demand: { score: null, absolute: null, posts7d: row.posts7d ?? null, posts14d: row.posts14d ?? null, posts30d: row.posts30d ?? null, profitability: null }, competition: { score: null }, socialMomentum: { score: engagement === null ? null : Math.min(100, engagement * 5), views, likes: row.likes ?? null, comments: row.comments ?? null, shares: row.shares ?? null, creatorDispersion: null, outlierDominance: null, country: null, language: null }, priceSnapshot: { current: null, volatility: null }, reviewSnapshot: { count: null, velocity: null }, rankingSnapshot: { rank: null, volatility: null }, rocketShare: null, supplierQuoteBinding: null, logisticsCostBinding: null, evidenceConfidence: 45, missingEvidence: ["ABSOLUTE_DEMAND", "PRICE", "REVIEWS", "RANK", "SUPPLIER_QUOTE"], provenance: row }); }

export type TikTokImportResult = Readonly<{ source: "tiktok"; sourceDigest: string; packets: readonly ExternalMarketSignalPacket[]; rejected: readonly { row: number; reason: string }[] }>;

const text = (value: unknown) => value == null ? "" : String(value).trim();
const number = (value: unknown) => { const parsed = Number(text(value).replaceAll(",", "")); return Number.isFinite(parsed) ? parsed : undefined; };

export function importTikTokRows(input: readonly Record<string, unknown>[], now = new Date()): TikTokImportResult {
  const packets: ExternalMarketSignalPacket[] = [];
  const rejected: { row: number; reason: string }[] = [];
  input.forEach((row, index) => {
    const title = text(readAlias(row, ["title", "video_title", "caption", "상품명", "제목"]));
    const keyword = text(readAlias(row, ["keyword", "query", "hashtag", "키워드"])) || title;
    const url = text(readAlias(row, ["url", "video_url", "source_url", "원문url"])) || undefined;
    if (!title) { rejected.push({ row: index + 1, reason: "TITLE_MISSING" }); return; }
    const id = text(readAlias(row, ["id", "video_id", "platform_product_id"])) || createHash("sha256").update(url ?? title).digest("hex").slice(0, 24);
    packets.push(importTikTokFixture({ id, keyword, title, url, views: number(readAlias(row, ["views", "view_count", "조회수"])), likes: number(readAlias(row, ["likes", "like_count", "좋아요"])), comments: number(readAlias(row, ["comments", "comment_count", "댓글"])), shares: number(readAlias(row, ["shares", "share_count", "공유"])), posts7d: number(readAlias(row, ["posts7d", "posts_7d", "7일게시물"])), posts14d: number(readAlias(row, ["posts14d", "posts_14d", "14일게시물"])), posts30d: number(readAlias(row, ["posts30d", "posts_30d", "30일게시물"])), country: text(readAlias(row, ["country", "국가"])) || undefined, language: text(readAlias(row, ["language", "언어"])) || undefined, category: text(readAlias(row, ["category", "카테고리"])) || undefined, observedAt: text(readAlias(row, ["observed_at", "published_at", "게시시각"])) || now.toISOString() }, now));
  });
  return Object.freeze({ source: "tiktok", sourceDigest: createHash("sha256").update(JSON.stringify(input)).digest("hex"), packets: Object.freeze(packets), rejected: Object.freeze(rejected) });
}

export const parseTikTokCsv = parseDelimitedText;
