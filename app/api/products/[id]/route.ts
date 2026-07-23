import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const REVIEW_STATUSES = new Set([
  "unreviewed",
  "reviewing",
  "sample_candidate",
  "approved",
  "excluded",
]);

const RISK_LEVELS = new Set(["unknown", "low", "medium", "high"]);

type PatchBody = {
  isFavorite?: boolean;
  reviewStatus?: string;
  memo?: string | null;
  manualSalePrice?: number;
  riskLevel?: string;
  excludedReason?: string | null;
};

function calculateManualProfit(
  salePrice: number,
  supplyPrice: number,
  logisticsCost: number
) {
  const marketplaceFee = Math.round(salePrice * 0.11);
  const advertisingCost = Math.round(salePrice * 0.08);
  const returnReserve = Math.round(salePrice * 0.03);
  const estimatedProfit =
    salePrice -
    supplyPrice -
    marketplaceFee -
    advertisingCost -
    logisticsCost -
    returnReserve;
  const marginRate =
    salePrice > 0
      ? Math.round((estimatedProfit / salePrice) * 1000) / 10
      : 0;

  return {
    estimated_sale_price: salePrice,
    marketplace_fee: marketplaceFee,
    advertising_cost: advertisingCost,
    return_reserve: returnReserve,
    estimated_profit: estimatedProfit,
    margin_rate: marginRate,
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const productId = Number(id);

  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json(
      { success: false, message: "유효하지 않은 상품 ID입니다." },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as PatchBody;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.isFavorite === "boolean") {
      updates.is_favorite = body.isFavorite;
    }

    if (body.reviewStatus !== undefined) {
      if (!REVIEW_STATUSES.has(body.reviewStatus)) {
        return NextResponse.json(
          { success: false, message: "유효하지 않은 검토 상태입니다." },
          { status: 400 }
        );
      }

      updates.review_status = body.reviewStatus;
      updates.reviewed_at =
        body.reviewStatus === "unreviewed" ? null : new Date().toISOString();

      if (body.reviewStatus !== "excluded") {
        updates.excluded_reason = null;
      }
    }

    if (body.memo !== undefined) {
      updates.memo = body.memo?.trim() || null;
    }

    if (body.riskLevel !== undefined) {
      if (!RISK_LEVELS.has(body.riskLevel)) {
        return NextResponse.json(
          { success: false, message: "유효하지 않은 위험도입니다." },
          { status: 400 }
        );
      }
      updates.risk_level = body.riskLevel;
    }

    if (body.excludedReason !== undefined) {
      updates.excluded_reason = body.excludedReason?.trim() || null;
    }

    if (body.manualSalePrice !== undefined) {
      if (!Number.isFinite(body.manualSalePrice) || body.manualSalePrice < 0) {
        return NextResponse.json(
          { success: false, message: "판매가는 0원 이상의 숫자여야 합니다." },
          { status: 400 }
        );
      }

      const { data: current, error: readError } = await supabase
        .from("products")
        .select("supply_price, logistics_cost")
        .eq("id", productId)
        .single();

      if (readError) throw new Error(readError.message);

      const roundedSalePrice = Math.round(body.manualSalePrice);
      updates.manual_sale_price = roundedSalePrice;

      Object.assign(
        updates,
        calculateManualProfit(
          roundedSalePrice,
          Number(current.supply_price ?? 0),
          Number(current.logistics_cost ?? 0)
        )
      );
    }

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", productId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, product: data });
  } catch (error) {
    console.error("상품 수정 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "상품 수정 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
