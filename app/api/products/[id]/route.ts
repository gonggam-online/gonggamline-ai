import { NextResponse } from "next/server";

import {
  productMutationErrorResponse, requireProtectedProductMutation,
} from "../../../../lib/auth/protected-product-mutation.server";
import {
  patchProductOperatorFields, readProductMutationSource,
} from "../../../../services/product-mutation.repository";

const REVIEW_STATUSES = new Set(["unreviewed","reviewing","sample_candidate","approved","excluded"]);
const RISK_LEVELS = new Set(["unknown","low","medium","high"]);
const KEYS = new Set(["isFavorite","reviewStatus","memo","manualSalePrice","riskLevel","excludedReason"]);

function manualFinance(salePrice: number, supplyPrice: number, logisticsCost: number) {
  const marketplaceFee = Math.round(salePrice * 0.11);
  const advertisingCost = Math.round(salePrice * 0.08);
  const returnReserve = Math.round(salePrice * 0.03);
  const estimatedProfit = salePrice - supplyPrice - marketplaceFee -
    advertisingCost - logisticsCost - returnReserve;
  return { estimatedSalePrice: salePrice, marketplaceFee, advertisingCost,
    returnReserve, estimatedProfit, marginRate: salePrice > 0 ?
      Math.round((estimatedProfit / salePrice) * 1000) / 10 : 0 };
}

export async function PATCH(
  request: Request, { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await requireProtectedProductMutation(request, "product-operator-patch");
    const { id } = await params;
    const productId = Number(id);
    if (!Number.isSafeInteger(productId) || productId <= 0)
      return Response.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
    let body: unknown;
    try { body = await request.json(); } catch { body = null; }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return Response.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
    const patch = body as Record<string, unknown>;
    if (Object.keys(patch).length < 1 || Object.keys(patch).some((key) => !KEYS.has(key)) ||
        (patch.isFavorite !== undefined && typeof patch.isFavorite !== "boolean") ||
        (patch.reviewStatus !== undefined &&
          (typeof patch.reviewStatus !== "string" || !REVIEW_STATUSES.has(patch.reviewStatus))) ||
        (patch.riskLevel !== undefined &&
          (typeof patch.riskLevel !== "string" || !RISK_LEVELS.has(patch.riskLevel))) ||
        (patch.memo !== undefined && patch.memo !== null && typeof patch.memo !== "string") ||
        (patch.excludedReason !== undefined && patch.excludedReason !== null &&
          typeof patch.excludedReason !== "string") ||
        (patch.manualSalePrice !== undefined &&
          (typeof patch.manualSalePrice !== "number" ||
            !Number.isFinite(patch.manualSalePrice) || patch.manualSalePrice < 0))) {
      return Response.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
    }
    const current = await readProductMutationSource(auth.context, productId,
      "id,supply_price,logistics_cost,updated_at");
    const write: Record<string, boolean | number | string | null> = {};
    for (const [key, value] of Object.entries(patch)) {
      write[key] = typeof value === "string" ? value.trim() : value as boolean | number | null;
    }
    if (typeof patch.manualSalePrice === "number") {
      const rounded = Math.round(patch.manualSalePrice);
      write.manualSalePrice = rounded;
      Object.assign(write, manualFinance(rounded, Number(current.supply_price),
        Number(current.logistics_cost)));
    }
    const result = await patchProductOperatorFields(auth.context, auth.idempotencyKey,
      productId, String(current.updated_at), write);
    const product = await readProductMutationSource(auth.context, productId, "*");
    return NextResponse.json({ success: true, product, mutation: result });
  } catch (error) {
    return productMutationErrorResponse(error);
  }
}
