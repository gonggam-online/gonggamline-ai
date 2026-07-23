export type Product = {
  productNo: string;
  title: string;
  thumbnail: string | null;
  price: number;
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
  sellerId: string | null;
  sellerName: string | null;
  productUrl: string | null;
  availableOnDomeggook: boolean;
  supplyAvailable: boolean;
  basicScore: number;
  recommend: string;
};

export type CalculationSettings = {
  marketplaceFeeRate: number;
  advertisingRate: number;
  logisticsCost: number;
  returnReserveRate: number;
  saleMultiplier: number;
  minimumAddedPrice: number;
};

export type SearchResult = {
  success: boolean;
  keyword?: string;
  page?: number;
  size?: number;
  totalCount?: number;
  calculationSettings?: CalculationSettings;
  products?: Product[];
  message?: string;
};
