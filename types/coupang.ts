export type CoupangRegisterMode = "validate" | "live";

export type CoupangValidationIssue = {
  path: string;
  message: string;
};

export type CoupangProductImage = {
  imageOrder: number;
  imageType: string;
  vendorPath: string;
};

export type CoupangProductAttribute = {
  attributeTypeName: string;
  attributeValueName: string;
};

export type CoupangProductContentDetail = {
  content: string;
  detailType: string;
};

export type CoupangProductContent = {
  contentsType: string;
  contentDetails: CoupangProductContentDetail[];
};

export type CoupangProductItem = {
  itemName: string;
  originalPrice: number;
  salePrice: number;
  maximumBuyCount: number;
  images: CoupangProductImage[];
  attributes: CoupangProductAttribute[];
  contents: CoupangProductContent[];
  [key: string]: unknown;
};

export type CoupangProductPayload = {
  displayCategoryCode: number;
  sellerProductName: string;
  saleStartedAt: string;
  saleEndedAt: string;
  displayProductName: string;
  generalProductName: string;
  deliveryMethod: string;
  deliveryChargeType: string;
  returnCenterCode: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  outboundShippingPlaceCode: string;
  vendorUserId: string;
  items: CoupangProductItem[];
  vendorId?: string;
  [key: string]: unknown;
};

export type CoupangRegisterRequest = {
  payload?: unknown;
  mode?: CoupangRegisterMode;
  confirmation?: string;
};

export type CoupangCategoryMeta = Record<string, unknown>;
export type CoupangCategoryValidity = Record<string, unknown>;
