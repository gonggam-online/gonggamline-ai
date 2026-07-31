export const PRODUCT_MUTATION_CONTRACT_VERSION = "product-mutation-command-v1";
export const PRODUCT_COMPETITION_ANALYSIS_VERSION = "competition-analysis-v1";

export type ProductMutationResultV1 = Readonly<{
  contractVersion: "product-mutation-result-v1";
  productId: number;
  updatedAt?: string;
  productNo?: string;
  replayed: boolean;
}>;

export type ProductImportV1 = Readonly<{
  productNo: string;
  keyword: string;
  title: string;
  thumbnail: string | null;
  productUrl: string | null;
  supplyPrice: number;
  minimumOrderQuantity: number;
  initialPurchaseAmount: number;
  estimatedSalePrice: number;
  marketplaceFee: number;
  advertisingCost: number;
  logisticsCost: number;
  returnReserve: number;
  estimatedProfit: number;
  marginRate: number;
  breakEvenSalePrice: number;
  basicScore: number;
  recommendation: string;
  sellerId: string | null;
  sellerName: string | null;
  availableOnDomeggook: boolean;
  supplyAvailable: boolean;
}>;

export type ProductOperatorPatchV1 = Readonly<Record<string, boolean | number | string | null>>;
export type ProductCompetitionWriteV1 = Readonly<Record<string, number | string | null>>;
