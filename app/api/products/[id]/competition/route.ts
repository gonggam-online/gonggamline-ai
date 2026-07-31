import { analyzeCompetition } from "@/features/competition/competition-analysis";
import {
  productMutationErrorResponse, requireProtectedProductMutation,
} from "@/lib/auth/protected-product-mutation.server";
import {
  readProductMutationSource, recordProductCompetition,
} from "@/services/product-mutation.repository";

const KEYS = ["marketPrice","top10AveragePrice","resultCount","rocketRatio",
  "averageReviewCount","averageRating","monthlySearchVolume"] as const;

export async function POST(
  request: Request, { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await requireProtectedProductMutation(request, "product-manual-competition");
    const productId = Number((await params).id);
    let body: unknown;
    try { body = await request.json(); } catch { body = null; }
    if (!Number.isSafeInteger(productId) || productId <= 0 || !body ||
        typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).length !== KEYS.length ||
        KEYS.some((key) => typeof (body as Record<string, unknown>)[key] !== "number" ||
          !Number.isFinite((body as Record<string, unknown>)[key]))) {
      return Response.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
    }
    const input = body as Record<(typeof KEYS)[number], number>;
    if (input.rocketRatio < 0 || input.rocketRatio > 100 ||
        input.averageRating < 0 || input.averageRating > 5)
      return Response.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
    const product = await readProductMutationSource(auth.context, productId,
      "id,estimated_sale_price,estimated_profit,margin_rate,updated_at");
    const analysis = analyzeCompetition({ ...input,
      salePrice: Number(product.estimated_sale_price),
      estimatedProfit: Number(product.estimated_profit),
      marginRate: Number(product.margin_rate) });
    const now = new Date().toISOString();
    const mutation = await recordProductCompetition(auth.context, auth.idempotencyKey,
      productId, String(product.updated_at), {
        keyword: null, ...input, resultCount: Math.round(input.resultCount),
        monthlySearchVolume: Math.round(input.monthlySearchVolume),
        competitionScore: analysis.competitionScore,
        marketabilityScore: analysis.marketabilityScore,
        priceCompetitivenessScore: analysis.priceCompetitivenessScore,
        reviewEntryScore: analysis.reviewEntryScore,
        rocketCompetitionScore: analysis.rocketCompetitionScore,
        keywordDemandScore: analysis.keywordDemandScore, grade: analysis.grade,
        status: "analyzed", source: "manual", confidence: 75,
        note: "manual-admin-input", summary: analysis.summary,
        monthlyUnitsLow: analysis.estimatedMonthlyUnitsLow,
        monthlyUnitsHigh: analysis.estimatedMonthlyUnitsHigh,
        monthlySalesLow: analysis.estimatedMonthlySalesLow,
        monthlySalesHigh: analysis.estimatedMonthlySalesHigh, analyzedAt: now,
        runId: null, evidenceReference: null, analysisVersion: "competition-analysis-v1",
        itemKey: null,
      }, false, "/api/products/[id]/competition");
    const updated = await readProductMutationSource(auth.context, productId, "*");
    return Response.json({ success: true, product: updated, analysis, mutation });
  } catch (error) {
    return productMutationErrorResponse(error);
  }
}
