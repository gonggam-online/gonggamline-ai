export type ListingCreativeBlobAuthentication =
  | Readonly<{ mode: "OIDC" }>
  | Readonly<{ mode: "READ_WRITE_TOKEN"; token: string }>;

type ListingCreativeBlobEnvironment = Readonly<{
  VERCEL_ENV?: string;
  BLOB_STORE_ID?: string;
  BLOB_READ_WRITE_TOKEN?: string;
}>;

export function resolveProductionListingCreativeBlobAuthentication(
  environment: ListingCreativeBlobEnvironment,
): ListingCreativeBlobAuthentication | null {
  if (environment.VERCEL_ENV !== "production") return null;

  if (environment.BLOB_STORE_ID?.trim()) {
    return { mode: "OIDC" };
  }

  const token = environment.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? { mode: "READ_WRITE_TOKEN", token } : null;
}
