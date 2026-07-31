import "server-only";

import { createHash } from "node:crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { AdminGuardContext } from "../lib/auth/admin-request-guard.server";
import { createGuardedServiceRoleClient } from "../lib/supabase/service-role.server";
import {
  PRODUCT_MUTATION_CONTRACT_VERSION,
  type ProductCompetitionWriteV1,
  type ProductImportV1,
  type ProductMutationResultV1,
  type ProductOperatorPatchV1,
} from "../shared/contracts/product-mutation";

export class ProductMutationRepositoryError extends Error {
  constructor(readonly kind: "CONFLICT" | "INVALID" | "NOT_FOUND" | "UNAVAILABLE") {
    super("Product mutation failed.");
    this.name = "ProductMutationRepositoryError";
  }
}

function mapError(error: PostgrestError): ProductMutationRepositoryError {
  if (error.code === "P0002") return new ProductMutationRepositoryError("NOT_FOUND");
  if (error.code === "23505" || error.code === "40001")
    return new ProductMutationRepositoryError("CONFLICT");
  if (error.code === "22023" || error.code === "22P02")
    return new ProductMutationRepositoryError("INVALID");
  return new ProductMutationRepositoryError("UNAVAILABLE");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key.normalize("NFC"))}:${canonical(item)}`)
    .join(",")}}`;
}

export function productMutationFingerprint(
  operation: string,
  principal: string,
  target: string,
  payload: unknown,
  precondition: string | null,
): string {
  return createHash("sha256").update(canonical({
    contractVersion: PRODUCT_MUTATION_CONTRACT_VERSION,
    operation, principal, target, payload, precondition,
  }), "utf8").digest("hex");
}

export function idempotencyKeyHash(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function readIdempotencyKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key");
  return value && value.trim() === value && value.length <= 200 &&
    !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}

function result(value: unknown): ProductMutationResultV1 {
  if (!value || typeof value !== "object") throw new ProductMutationRepositoryError("UNAVAILABLE");
  const row = value as Record<string, unknown>;
  if (row.contractVersion !== "product-mutation-result-v1" ||
      !Number.isSafeInteger(row.productId)) throw new ProductMutationRepositoryError("UNAVAILABLE");
  return value as ProductMutationResultV1;
}

async function rpc(
  client: SupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<ProductMutationResultV1> {
  const response = await client.rpc(name, parameters);
  if (response.error) throw mapError(response.error);
  return result(response.data);
}

export async function readProductMutationSource(
  context: AdminGuardContext,
  productId: number,
  columns: string,
): Promise<Record<string, unknown>> {
  const response = await createGuardedServiceRoleClient(context)
    .from("products").select(columns).eq("id", productId).single();
  if (response.error) throw mapError(response.error);
  return response.data as unknown as Record<string, unknown>;
}

export async function listProductIdsForCompetition(
  context: AdminGuardContext, limit: number, onlyPending: boolean,
): Promise<readonly number[]> {
  let query = createGuardedServiceRoleClient(context).from("products")
    .select("id").order("basic_score", { ascending: false }).limit(limit);
  if (onlyPending) query = query.in("competition_analysis_status", ["pending", "needs_data"]);
  const response = await query;
  if (response.error) throw mapError(response.error);
  return Object.freeze((response.data as Array<{ id: number }>).map(({ id }) => Number(id)));
}

export async function importProduct(
  context: AdminGuardContext, key: string, payload: ProductImportV1,
): Promise<ProductMutationResultV1> {
  const fingerprint = productMutationFingerprint(
    "IMPORT_PRODUCT", context.administratorUserId, payload.productNo, payload, null);
  return rpc(createGuardedServiceRoleClient(context), "import_product_v1", {
    p_payload: payload, p_idempotency_key_hash: idempotencyKeyHash(key),
    p_request_fingerprint: fingerprint,
    p_requested_by_principal_id: context.administratorUserId,
    p_correlation_id: context.correlationId,
  });
}

export async function patchProductOperatorFields(
  context: AdminGuardContext, key: string, productId: number,
  expectedUpdatedAt: string, patch: ProductOperatorPatchV1,
): Promise<ProductMutationResultV1> {
  const fingerprint = productMutationFingerprint(
    "PATCH_PRODUCT_OPERATOR_FIELDS", context.administratorUserId,
    String(productId), patch, expectedUpdatedAt);
  return rpc(createGuardedServiceRoleClient(context), "patch_product_operator_fields_v1", {
    p_product_id: productId, p_expected_updated_at: expectedUpdatedAt, p_patch: patch,
    p_idempotency_key_hash: idempotencyKeyHash(key), p_request_fingerprint: fingerprint,
    p_requested_by_principal_id: context.administratorUserId,
    p_correlation_id: context.correlationId,
  });
}

export async function recordProductCompetition(
  context: AdminGuardContext, key: string, productId: number,
  expectedUpdatedAt: string, analysis: ProductCompetitionWriteV1,
  automatic: boolean, route: string,
): Promise<ProductMutationResultV1> {
  const operation = automatic ? "RECORD_AUTOMATIC_COMPETITION" : "RECORD_MANUAL_COMPETITION";
  const principal = automatic ? "worker:competition-v1" : context.administratorUserId;
  const fingerprint = productMutationFingerprint(
    operation, principal, String(productId), analysis, expectedUpdatedAt);
  const parameters: Record<string, unknown> = {
    p_product_id: productId, p_expected_updated_at: expectedUpdatedAt,
    p_analysis: analysis, p_idempotency_key_hash: idempotencyKeyHash(key),
    p_request_fingerprint: fingerprint,
    p_requested_by_principal_id: context.administratorUserId,
    p_correlation_id: context.correlationId,
  };
  if (automatic) parameters.p_route = route;
  return rpc(createGuardedServiceRoleClient(context),
    automatic ? "record_automatic_competition_analysis_v1" :
      "record_manual_competition_analysis_v1", parameters);
}
