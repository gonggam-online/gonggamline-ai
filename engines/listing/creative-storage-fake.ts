import type {
  CreativeObjectLocation,
  PrivateListingCreativeObjectStore,
  PublicListingCreativeObjectStore,
} from "@/engines/listing/creative-storage";
import { CreativeStorageError } from "@/engines/listing/creative-storage";

export type InMemoryCreativeObjectOperation = Readonly<{
  operation: "PUT" | "READ" | "SIGNED_URL" | "REMOVE";
  pathname: string;
  consistency?: "ORIGIN" | "DELIVERY";
}>;

export class InMemoryPrivateListingCreativeObjectStore
implements PrivateListingCreativeObjectStore {
  private readonly objects = new Map<string, Readonly<{ bytes: Uint8Array; contentType: string }>>();
  readonly operations: InMemoryCreativeObjectOperation[] = [];

  referenceFor(pathname: string): string {
    return `memory-private://${pathname}`;
  }

  async putImmutable(
    pathname: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<CreativeObjectLocation> {
    this.operations.push({ operation: "PUT", pathname });
    if (this.objects.has(pathname)) {
      throw new CreativeStorageError("IMMUTABLE_OBJECT_CONFLICT");
    }
    this.objects.set(pathname, { bytes: Uint8Array.from(bytes), contentType });
    return { pathname, reference: this.referenceFor(pathname) };
  }

  async read(pathname: string): Promise<Uint8Array | null> {
    this.operations.push({ operation: "READ", pathname });
    const found = this.objects.get(pathname);
    return found ? Uint8Array.from(found.bytes) : null;
  }

  async createSignedReviewUrl(pathname: string, expiresInSeconds: number): Promise<string> {
    this.operations.push({ operation: "SIGNED_URL", pathname });
    if (!this.objects.has(pathname)) throw new CreativeStorageError("PRIVATE_MASTER_NOT_FOUND");
    return `https://review.invalid/${pathname}?expires=${expiresInSeconds}`;
  }

  replaceBytesForTest(pathname: string, bytes: Uint8Array): void {
    const found = this.objects.get(pathname);
    if (!found) throw new CreativeStorageError("PRIVATE_MASTER_NOT_FOUND");
    this.objects.set(pathname, { ...found, bytes: Uint8Array.from(bytes) });
  }
}

export class InMemoryPublicListingCreativeObjectStore
implements PublicListingCreativeObjectStore {
  private readonly objects = new Map<string, Readonly<{ bytes: Uint8Array; contentType: string }>>();
  readonly operations: InMemoryCreativeObjectOperation[] = [];

  async putImmutable(
    pathname: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<CreativeObjectLocation> {
    this.operations.push({ operation: "PUT", pathname });
    if (this.objects.has(pathname)) {
      throw new CreativeStorageError("IMMUTABLE_OBJECT_CONFLICT");
    }
    this.objects.set(pathname, { bytes: Uint8Array.from(bytes), contentType });
    return { pathname, reference: `https://public.invalid/${pathname}` };
  }

  async read(
    pathname: string,
    consistency: "ORIGIN" | "DELIVERY",
  ): Promise<Uint8Array | null> {
    this.operations.push({ operation: "READ", pathname, consistency });
    const found = this.objects.get(pathname);
    return found ? Uint8Array.from(found.bytes) : null;
  }

  async remove(pathname: string): Promise<void> {
    this.operations.push({ operation: "REMOVE", pathname });
    this.objects.delete(pathname);
  }

  replaceBytesForTest(pathname: string, bytes: Uint8Array): void {
    const found = this.objects.get(pathname);
    if (!found) throw new CreativeStorageError("PRIVATE_MASTER_NOT_FOUND");
    this.objects.set(pathname, { ...found, bytes: Uint8Array.from(bytes) });
  }
}
