import "server-only";

import { createHash } from "node:crypto";

import type { PrivateListingCreativeObjectStore } from "@/engines/listing/creative-storage";
import { CreativeStorageError } from "@/engines/listing/creative-storage";
import type { AdminGuardContext } from "@/lib/auth/admin-request-guard.server";
import { SupabasePrivateListingCreativeObjectStore } from "@/lib/listing/creative-object-stores.server";
import { createGuardedServiceRoleClient } from "@/lib/supabase/service-role.server";
import {
  LISTING_CREATIVE_OPERATOR_VERSION,
  type ListingCreativeDispatchAuthorization,
  type ListingCreativeOperatorPlanReference,
  type ListingCreativeOperatorReviewHandoff,
  type ListingCreativeWholePlanReservation,
  type PreparedListingCreativeDispatchPlan,
} from "@/shared/domain/listing-creative-operator";

const SHA256 = /^[a-f0-9]{64}$/;
const FAILURE_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;

export class ListingCreativeOperatorRepositoryError extends Error {
  constructor(readonly code: "ALREADY_EXISTS" | "NOT_FOUND" | "INVALID" | "UNAVAILABLE") {
    super(code);
    this.name = "ListingCreativeOperatorRepositoryError";
  }
}

export interface ListingCreativeOperatorRepository {
  savePrepared(plan: PreparedListingCreativeDispatchPlan): Promise<void>;
  loadPrepared(reference: ListingCreativeOperatorPlanReference): Promise<PreparedListingCreativeDispatchPlan>;
  saveAuthorization(authorization: ListingCreativeDispatchAuthorization): Promise<void>;
  reserveGlobalWindow(reservation: ListingCreativeWholePlanReservation): Promise<void>;
  reserveWholePlan(reservation: ListingCreativeWholePlanReservation): Promise<void>;
  saveReviewHandoff(handoff: ListingCreativeOperatorReviewHandoff): Promise<void>;
  loadReviewHandoff(reference: ListingCreativeOperatorPlanReference): Promise<ListingCreativeOperatorReviewHandoff>;
  saveFailure(input: Readonly<{
    reference: ListingCreativeOperatorPlanReference;
    authorizationDigest: string | null;
    failureCode: string;
    failedAt: string;
  }>): Promise<void>;
}

function assertReference(reference: ListingCreativeOperatorPlanReference): void {
  if (
    !SHA256.test(reference.subjectHash)
    || !SHA256.test(reference.revisionDigest)
    || !SHA256.test(reference.dispatchPlanDigest)
  ) throw new ListingCreativeOperatorRepositoryError("INVALID");
}

function root(reference: ListingCreativeOperatorPlanReference): string {
  assertReference(reference);
  return [
    "v1",
    reference.subjectHash,
    reference.revisionDigest,
    "operator",
    reference.dispatchPlanDigest,
  ].join("/");
}

function utf8(value: unknown): Uint8Array {
  return Uint8Array.from(Buffer.from(JSON.stringify(value), "utf8"));
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength
    && left.every((byte, index) => byte === right[index]);
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new ListingCreativeOperatorRepositoryError("INVALID");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class ManagedListingCreativeOperatorRepository
implements ListingCreativeOperatorRepository {
  constructor(private readonly store: PrivateListingCreativeObjectStore) {}

  private async createOnly(pathname: string, value: unknown): Promise<void> {
    const bytes = utf8(value);
    try {
      await this.store.putImmutable(pathname, bytes, "application/json");
      const stored = await this.store.read(pathname);
      if (!stored || !equal(bytes, stored)) {
        throw new ListingCreativeOperatorRepositoryError("UNAVAILABLE");
      }
    } catch (error) {
      if (error instanceof ListingCreativeOperatorRepositoryError) throw error;
      if (error instanceof CreativeStorageError && error.code === "IMMUTABLE_OBJECT_CONFLICT") {
        throw new ListingCreativeOperatorRepositoryError("ALREADY_EXISTS");
      }
      throw new ListingCreativeOperatorRepositoryError("UNAVAILABLE");
    }
  }

  private async load(pathname: string): Promise<unknown> {
    try {
      const bytes = await this.store.read(pathname);
      if (!bytes) throw new ListingCreativeOperatorRepositoryError("NOT_FOUND");
      return parseJson(bytes);
    } catch (error) {
      if (error instanceof ListingCreativeOperatorRepositoryError) throw error;
      throw new ListingCreativeOperatorRepositoryError("UNAVAILABLE");
    }
  }

  async savePrepared(plan: PreparedListingCreativeDispatchPlan): Promise<void> {
    await this.createOnly(`${root(plan.reference)}/prepared.json`, plan);
  }

  async loadPrepared(
    reference: ListingCreativeOperatorPlanReference,
  ): Promise<PreparedListingCreativeDispatchPlan> {
    const value = await this.load(`${root(reference)}/prepared.json`);
    if (
      !record(value)
      || value.schemaVersion !== LISTING_CREATIVE_OPERATOR_VERSION
      || value.status !== "PREPARED"
      || !record(value.reference)
      || value.reference.dispatchPlanDigest !== reference.dispatchPlanDigest
      || value.reference.subjectHash !== reference.subjectHash
      || value.reference.revisionDigest !== reference.revisionDigest
    ) throw new ListingCreativeOperatorRepositoryError("INVALID");
    return value as PreparedListingCreativeDispatchPlan;
  }

  async saveAuthorization(authorization: ListingCreativeDispatchAuthorization): Promise<void> {
    if (!SHA256.test(authorization.authorizationDigest)) {
      throw new ListingCreativeOperatorRepositoryError("INVALID");
    }
    await this.createOnly(
      `${root(authorization.planReference)}/authorized/${authorization.authorizationDigest}.json`,
      authorization,
    );
  }

  async reserveWholePlan(reservation: ListingCreativeWholePlanReservation): Promise<void> {
    await this.createOnly(`${root(reservation.planReference)}/reserved.json`, reservation);
  }

  async reserveGlobalWindow(reservation: ListingCreativeWholePlanReservation): Promise<void> {
    const reservedAt = Date.parse(reservation.reservedAt);
    if (!Number.isFinite(reservedAt)) {
      throw new ListingCreativeOperatorRepositoryError("INVALID");
    }
    const fiveMinuteWindow = Math.floor(reservedAt / (5 * 60 * 1_000));
    await this.createOnly(
      `v1/operator-global/${fiveMinuteWindow}/reserved.json`,
      reservation,
    );
  }

  async saveReviewHandoff(handoff: ListingCreativeOperatorReviewHandoff): Promise<void> {
    await this.createOnly(`${root(handoff.planReference)}/review-handoff.json`, handoff);
  }

  async loadReviewHandoff(
    reference: ListingCreativeOperatorPlanReference,
  ): Promise<ListingCreativeOperatorReviewHandoff> {
    const value = await this.load(`${root(reference)}/review-handoff.json`);
    if (
      !record(value)
      || value.schemaVersion !== LISTING_CREATIVE_OPERATOR_VERSION
      || value.status !== "REVIEW_REQUIRED"
      || !record(value.planReference)
      || value.planReference.dispatchPlanDigest !== reference.dispatchPlanDigest
      || value.planReference.subjectHash !== reference.subjectHash
      || value.planReference.revisionDigest !== reference.revisionDigest
    ) throw new ListingCreativeOperatorRepositoryError("INVALID");
    return value as ListingCreativeOperatorReviewHandoff;
  }

  async saveFailure(input: Readonly<{
    reference: ListingCreativeOperatorPlanReference;
    authorizationDigest: string | null;
    failureCode: string;
    failedAt: string;
  }>): Promise<void> {
    assertReference(input.reference);
    if (
      !FAILURE_CODE.test(input.failureCode)
      || (input.authorizationDigest !== null && !SHA256.test(input.authorizationDigest))
      || !Number.isFinite(Date.parse(input.failedAt))
    ) throw new ListingCreativeOperatorRepositoryError("INVALID");
    const event = Object.freeze({
      schemaVersion: LISTING_CREATIVE_OPERATOR_VERSION,
      status: "FAILED" as const,
      planReference: input.reference,
      authorizationDigest: input.authorizationDigest,
      failureCode: input.failureCode,
      failedAt: input.failedAt,
    });
    const digest = createHash("sha256").update(JSON.stringify(event), "utf8").digest("hex");
    await this.createOnly(`${root(input.reference)}/failed/${digest}.json`, event);
  }
}

export function createProductionListingCreativeOperatorRepository(
  guardContext: AdminGuardContext,
): ListingCreativeOperatorRepository {
  return new ManagedListingCreativeOperatorRepository(
    new SupabasePrivateListingCreativeObjectStore(
      createGuardedServiceRoleClient(guardContext),
    ),
  );
}
