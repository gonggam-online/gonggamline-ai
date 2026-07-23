import type { CommerceProductRef } from "@/shared/domain/product";

export interface BundleCandidate {
  id: string;
  title: string;
  products: CommerceProductRef[];
  synergyScore: number;
  reasons: string[];
}

export function validateBundle(candidate: BundleCandidate): string[] {
  const errors: string[] = [];
  if (candidate.products.length < 2) errors.push("묶음상품은 최소 2개 상품이 필요합니다.");
  if (candidate.products.length > 6) errors.push("1차 운영 기준 묶음 구성은 최대 6개입니다.");
  if (candidate.synergyScore < 0 || candidate.synergyScore > 100) errors.push("시너지 점수는 0~100이어야 합니다.");
  return errors;
}
