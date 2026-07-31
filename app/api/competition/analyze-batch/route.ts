import { createHash } from "node:crypto";

import {
  deterministicRunId, runAutomaticCompetitionAnalysis,
} from "@/features/competition/run-analysis";
import {
  productMutationErrorResponse, requireProtectedProductMutation,
} from "@/lib/auth/protected-product-mutation.server";
import { listProductIdsForCompetition } from "@/services/product-mutation.repository";

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireProtectedProductMutation(request, "product-competition-batch");
    let body: unknown;
    try { body = await request.json(); } catch { body = null; }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some((key) => !["limit","onlyPending"].includes(key))) {
      return Response.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const limit = input.limit ?? 10;
    const onlyPending = input.onlyPending ?? true;
    if (!Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > 20 ||
        typeof onlyPending !== "boolean") {
      return Response.json({ success: false, code: "INVALID_REQUEST" }, { status: 400 });
    }
    const selected = await listProductIdsForCompetition(
      auth.context, limit as number, onlyPending);
    const runId = deterministicRunId(auth.idempotencyKey);
    const results: Array<Record<string, unknown>> = [];
    for (const id of selected) {
      const itemKey = createHash("sha256").update(
        `${auth.idempotencyKey}\n${runId}\n${id}\ncompetition-analysis-v1`, "utf8").digest("hex");
      try {
        const result = await runAutomaticCompetitionAnalysis(auth.context, id,
          itemKey, "/api/competition/analyze-batch", runId);
        results.push({ id, status: result.mutation.replayed ? "REPLAYED" : "SUCCEEDED",
          grade: result.analysis.grade, score: result.analysis.competitionScore,
          source: result.market.source });
      } catch {
        results.push({ id, status: "FAILED", code: "ITEM_FAILED" });
      }
    }
    return Response.json({ success: true, runId,
      analyzedCount: results.filter((item) => item.status !== "FAILED").length, results });
  } catch (error) {
    return productMutationErrorResponse(error);
  }
}
