import "server-only";

import {
  del as deleteBlob,
  get as getBlob,
  put as putBlob,
} from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreativeObjectLocation,
  PrivateListingCreativeObjectStore,
  PublicListingCreativeObjectStore,
} from "@/engines/listing/creative-storage";
import { CreativeStorageError } from "@/engines/listing/creative-storage";
import type { ListingCreativeBlobAuthentication } from "@/lib/listing/creative-blob-auth";
import { LISTING_CREATIVE_PRIVATE_BUCKET } from "@/shared/domain/listing-creative-storage";

function copyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function storageStatus(error: unknown): string | number | undefined {
  if (!error || typeof error !== "object") return undefined;
  return (error as Readonly<{ statusCode?: string | number }>).statusCode;
}

function isNotFound(error: unknown): boolean {
  const status = storageStatus(error);
  return status === 404 || status === "404";
}

function isConflict(error: unknown): boolean {
  const status = storageStatus(error);
  if (status === 409 || status === "409") return true;
  if (!error || typeof error !== "object") return false;
  const message = (error as Readonly<{ message?: unknown }>).message;
  return typeof message === "string"
    && /already exists|duplicate/i.test(message);
}

export class SupabasePrivateListingCreativeObjectStore
implements PrivateListingCreativeObjectStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string = LISTING_CREATIVE_PRIVATE_BUCKET,
  ) {
    if (bucket !== LISTING_CREATIVE_PRIVATE_BUCKET) {
      throw new CreativeStorageError("INVALID_STORAGE_INPUT");
    }
  }

  referenceFor(pathname: string): string {
    return `supabase-storage://${this.bucket}/${pathname}`;
  }

  async putImmutable(
    pathname: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<CreativeObjectLocation> {
    const { data, error } = await this.client.storage.from(this.bucket).upload(
      pathname,
      copyArrayBuffer(bytes),
      { contentType, upsert: false, cacheControl: "31536000" },
    );
    if (error || !data?.path) {
      throw new CreativeStorageError(
        error && isConflict(error)
          ? "IMMUTABLE_OBJECT_CONFLICT"
          : "STORAGE_CONFIGURATION_UNAVAILABLE",
      );
    }
    return {
      pathname: data.path,
      reference: this.referenceFor(data.path),
    };
  }

  async read(pathname: string): Promise<Uint8Array | null> {
    const { data, error } = await this.client.storage.from(this.bucket).download(pathname);
    if (error) {
      if (isNotFound(error)) return null;
      throw new CreativeStorageError("PRIVATE_MASTER_VERIFICATION_FAILED");
    }
    if (!data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  async createSignedReviewUrl(pathname: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(pathname, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new CreativeStorageError("PRIVATE_MASTER_NOT_FOUND");
    }
    return data.signedUrl;
  }
}

export class VercelPublicListingCreativeObjectStore
implements PublicListingCreativeObjectStore {
  constructor(private readonly authentication: ListingCreativeBlobAuthentication) {
    if (
      authentication.mode === "READ_WRITE_TOKEN"
      && authentication.token.trim().length === 0
    ) {
      throw new CreativeStorageError("INVALID_STORAGE_INPUT");
    }
  }

  private credentialOptions(): Readonly<{ token?: string }> {
    return this.authentication.mode === "READ_WRITE_TOKEN"
      ? { token: this.authentication.token }
      : {};
  }

  async putImmutable(
    pathname: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<CreativeObjectLocation> {
    try {
      const result = await putBlob(pathname, copyArrayBuffer(bytes), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 31536000,
        contentType,
        ...this.credentialOptions(),
      });
      if (result.pathname !== pathname) {
        throw new CreativeStorageError("PUBLIC_MIRROR_VERIFICATION_FAILED");
      }
      return { pathname: result.pathname, reference: result.url };
    } catch (error) {
      if (error instanceof CreativeStorageError) throw error;
      throw new CreativeStorageError("IMMUTABLE_OBJECT_CONFLICT");
    }
  }

  async read(
    pathname: string,
    consistency: "ORIGIN" | "DELIVERY",
  ): Promise<Uint8Array | null> {
    try {
      const result = await getBlob(pathname, {
        access: "public",
        useCache: consistency === "DELIVERY",
        ...this.credentialOptions(),
      });
      if (!result || result.statusCode !== 200) return null;
      return new Uint8Array(await new Response(result.stream).arrayBuffer());
    } catch {
      throw new CreativeStorageError("PUBLIC_MIRROR_VERIFICATION_FAILED");
    }
  }

  async remove(pathname: string): Promise<void> {
    try {
      await deleteBlob(pathname, this.credentialOptions());
    } catch {
      throw new CreativeStorageError("PUBLIC_TAKEDOWN_NOT_VERIFIED");
    }
  }
}
