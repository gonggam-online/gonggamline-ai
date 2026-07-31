import {
  productMutationErrorResponse, requireProtectedProductMutation,
} from "../../../../../lib/auth/protected-product-mutation.server";
import { importProduct } from "../../../../../services/product-mutation.repository";
import type { ProductImportV1 } from "../../../../../shared/contracts/product-mutation";

export const runtime = "nodejs";

const KEYS = ["productNo","keyword","title","thumbnail","productUrl","supplyPrice",
  "minimumOrderQuantity","initialPurchaseAmount","estimatedSalePrice","marketplaceFee",
  "advertisingCost","logisticsCost","returnReserve","estimatedProfit","marginRate",
  "breakEvenSalePrice","basicScore","recommendation","sellerId","sellerName",
  "availableOnDomeggook","supplyAvailable"] as const;

function parse(value: unknown): ProductImportV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== KEYS.length || KEYS.some((key) => !(key in row)) ||
      typeof row.productNo !== "string" || !/^[0-9]{1,20}$/.test(row.productNo) ||
      typeof row.keyword !== "string" || row.keyword.length > 200 ||
      typeof row.title !== "string" || row.title.length < 1 || row.title.length > 500) return null;
  const textNullable = ["thumbnail","productUrl","sellerId","sellerName"];
  const text = ["recommendation"];
  const numbers = ["supplyPrice","minimumOrderQuantity","initialPurchaseAmount",
    "estimatedSalePrice","marketplaceFee","advertisingCost","logisticsCost",
    "returnReserve","estimatedProfit","marginRate","breakEvenSalePrice","basicScore"];
  if (textNullable.some((key) => row[key] !== null && typeof row[key] !== "string") ||
      text.some((key) => typeof row[key] !== "string") ||
      numbers.some((key) => typeof row[key] !== "number" || !Number.isFinite(row[key])) ||
      typeof row.availableOnDomeggook !== "boolean" ||
      typeof row.supplyAvailable !== "boolean") return null;
  return row as unknown as ProductImportV1;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireProtectedProductMutation(request, "product-import");
    let json: unknown;
    try { json = await request.json(); } catch { json = null; }
    const payload = parse(json);
    if (!payload) return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    const result = await importProduct(auth.context, auth.idempotencyKey, payload);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return productMutationErrorResponse(error);
  }
}
