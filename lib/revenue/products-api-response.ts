export type ProductsApiBaseResponse<Product> = {
  success: true;
  available: true;
  filters: Record<string, string | number | boolean>;
  pagination: {
    page: number;
    size: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  products: Product[];
};

type ProductsApiResponseOptions<Product, Ranking> = {
  base: Omit<ProductsApiBaseResponse<Product>, "products">;
  products: Product[];
  ranking?: Ranking[];
};

export function buildProductsApiResponse<Product, Ranking = never>({
  base,
  products,
  ranking,
}: ProductsApiResponseOptions<Product, Ranking>) {
  const response = {
    ...base,
    products,
  };

  if (ranking === undefined) {
    return response;
  }

  return {
    ...response,
    ranking,
  };
}
