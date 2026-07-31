import type { AdminGuardContext } from "@/lib/auth/admin-request-guard.server";
import { createHash } from "node:crypto";
import {
  readProductMutationSource, recordProductCompetition,
} from "@/services/product-mutation.repository";
import { analyzeCompetition } from "./competition-analysis";
import { collectMarketData } from "./providers/market-data-provider";

export async function runAutomaticCompetitionAnalysis(
  context: AdminGuardContext, productId: number, idempotencyKey: string,
  route: "/api/products/[id]/competition/auto" | "/api/competition/analyze-batch",
  runId = deterministicRunId(idempotencyKey),
) {
  const product = await readProductMutationSource(context, productId,
    "id,title,keyword,supply_price,estimated_sale_price,estimated_profit,margin_rate,basic_score,updated_at");
  const market = await collectMarketData(product as {
    id: number; title: string; keyword: string | null; supply_price: number;
    estimated_sale_price: number; estimated_profit: number;
    margin_rate: number; basic_score: number;
  });
  const analysis = analyzeCompetition({
    ...market, salePrice: Number(product.estimated_sale_price),
    estimatedProfit: Number(product.estimated_profit),
    marginRate: Number(product.margin_rate),
  });
  const analyzedAt = new Date().toISOString();
  const mutation = await recordProductCompetition(context, idempotencyKey, productId,
    String(product.updated_at), {
      keyword: market.keyword, marketPrice: market.marketPrice,
      top10AveragePrice: market.top10AveragePrice, resultCount: market.resultCount,
      rocketRatio: market.rocketRatio, averageReviewCount: market.averageReviewCount,
      averageRating: market.averageRating, monthlySearchVolume: market.monthlySearchVolume,
      competitionScore: analysis.competitionScore,
      marketabilityScore: analysis.marketabilityScore,
      priceCompetitivenessScore: analysis.priceCompetitivenessScore,
      reviewEntryScore: analysis.reviewEntryScore,
      rocketCompetitionScore: analysis.rocketCompetitionScore,
      keywordDemandScore: analysis.keywordDemandScore, grade: analysis.grade,
      status: market.source === "external" ? "analyzed" : "estimated",
      source: market.source, confidence: market.confidence, note: market.note,
      summary: analysis.summary, monthlyUnitsLow: analysis.estimatedMonthlyUnitsLow,
      monthlyUnitsHigh: analysis.estimatedMonthlyUnitsHigh,
      monthlySalesLow: analysis.estimatedMonthlySalesLow,
      monthlySalesHigh: analysis.estimatedMonthlySalesHigh, analyzedAt,
      runId, evidenceReference: `market-evidence:${runId}:${productId}`,
      analysisVersion: "competition-analysis-v1",
      itemKey: idempotencyKey,
    }, true, route);
  const updated = await readProductMutationSource(context, productId, "*");
  return { product: updated, analysis, market, mutation };
}

export function deterministicRunId(key: string): string {
  const hex = createHash("sha256").update(
    `product-competition-run-v1\n${key}`, "utf8").digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}` +
    `-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
