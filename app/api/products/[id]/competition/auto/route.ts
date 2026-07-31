import { runAutomaticCompetitionAnalysis } from "@/features/competition/run-analysis";
import {
  productMutationErrorResponse, requireProtectedProductMutation,
} from "@/lib/auth/protected-product-mutation.server";

export async function POST(
  request: Request, { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await requireProtectedProductMutation(request, "product-automatic-competition");
    const productId = Number((await params).id);
    if (!Number.isSafeInteger(productId) || productId <= 0)
      return Response.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
    const result = await runAutomaticCompetitionAnalysis(auth.context, productId,
      auth.idempotencyKey, "/api/products/[id]/competition/auto");
    return Response.json({ success: true, ...result });
  } catch (error) {
    return productMutationErrorResponse(error);
  }
}
