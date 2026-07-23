export type ListingType = "single" | "set" | "bundle" | "multipack";
export type ListingStatus = "draft" | "generated" | "reviewing" | "approved" | "rejected" | "registered";

export interface ListingGenerationInput {
  productName: string;
  brandName?: string;
  categoryName?: string;
  targetCustomer?: string;
  keyBenefits?: string[];
  optionNames?: string[];
  listingType?: ListingType;
  providerName?: string;
  targetSellingPrice?: number;
}

export interface ListingDraftContent {
  coupangTitle: string;
  searchKeywords: string[];
  optionStructure: Array<{ name: string; values: string[] }>;
  sellingPoints: string[];
  detailSections: Array<{ heading: string; body: string }>;
  faq: Array<{ question: string; answer: string }>;
  thumbnailBrief: string;
  shippingNotice: string;
  returnNotice: string;
  complianceChecklist: string[];
  coupangPayload: Record<string, unknown>;
}
