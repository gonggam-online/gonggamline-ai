import type {
  CoupangProductPayload,
  CoupangValidationIssue,
} from "@/types/coupang";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): boolean {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function validateCoupangProductPayload(
  payload: unknown,
): CoupangValidationIssue[] {
  const issues: CoupangValidationIssue[] = [];

  if (!isRecord(payload)) {
    return [{ path: "$", message: "상품 전문은 JSON 객체여야 합니다." }];
  }

  const requiredText = [
    "sellerProductName",
    "displayProductName",
    "generalProductName",
    "deliveryMethod",
    "deliveryChargeType",
    "returnCenterCode",
    "companyContactNumber",
    "returnZipCode",
    "returnAddress",
    "returnAddressDetail",
    "outboundShippingPlaceCode",
    "vendorUserId",
  ];

  for (const key of requiredText) {
    if (!isNonEmptyString(payload[key])) {
      issues.push({ path: key, message: `${key} 값이 필요합니다.` });
    }
  }

  if (!isPositiveNumber(payload.displayCategoryCode)) {
    issues.push({
      path: "displayCategoryCode",
      message: "0보다 큰 숫자형 노출 카테고리 코드가 필요합니다.",
    });
  }

  for (const key of ["saleStartedAt", "saleEndedAt"]) {
    if (
      typeof payload[key] !== "string" ||
      Number.isNaN(Date.parse(String(payload[key])))
    ) {
      issues.push({
        path: key,
        message: `${key}는 올바른 날짜 형식이어야 합니다.`,
      });
    }
  }

  if (
    typeof payload.saleStartedAt === "string" &&
    typeof payload.saleEndedAt === "string" &&
    !Number.isNaN(Date.parse(payload.saleStartedAt)) &&
    !Number.isNaN(Date.parse(payload.saleEndedAt)) &&
    Date.parse(payload.saleStartedAt) >= Date.parse(payload.saleEndedAt)
  ) {
    issues.push({
      path: "saleEndedAt",
      message: "판매 종료일은 판매 시작일보다 뒤여야 합니다.",
    });
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    issues.push({ path: "items", message: "최소 1개의 옵션(items)이 필요합니다." });
    return issues;
  }

  payload.items.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({
        path: `items[${index}]`,
        message: "옵션은 객체여야 합니다.",
      });
      return;
    }

    if (!isNonEmptyString(item.itemName)) {
      issues.push({
        path: `items[${index}].itemName`,
        message: "itemName 값이 필요합니다.",
      });
    }

    for (const key of ["originalPrice", "salePrice", "maximumBuyCount"]) {
      if (!isPositiveNumber(item[key])) {
        issues.push({
          path: `items[${index}].${key}`,
          message: `${key}는 0보다 큰 숫자여야 합니다.`,
        });
      }
    }

    if (
      isPositiveNumber(item.originalPrice) &&
      isPositiveNumber(item.salePrice) &&
      Number(item.salePrice) > Number(item.originalPrice)
    ) {
      issues.push({
        path: `items[${index}].salePrice`,
        message: "salePrice는 originalPrice보다 클 수 없습니다.",
      });
    }

    if (!Array.isArray(item.images) || item.images.length === 0) {
      issues.push({
        path: `items[${index}].images`,
        message: "대표 이미지 1개 이상이 필요합니다.",
      });
    }

    if (!Array.isArray(item.attributes) || item.attributes.length === 0) {
      issues.push({
        path: `items[${index}].attributes`,
        message: "카테고리에 맞는 구매옵션이 1개 이상 필요합니다.",
      });
    }

    if (!Array.isArray(item.contents) || item.contents.length === 0) {
      issues.push({
        path: `items[${index}].contents`,
        message: "상세 콘텐츠가 필요합니다.",
      });
    }
  });

  return issues;
}

export function assertCoupangProductPayload(
  payload: unknown,
): asserts payload is CoupangProductPayload {
  const issues = validateCoupangProductPayload(payload);
  if (issues.length > 0) {
    const error = new Error("쿠팡 상품 등록 전문 검증에 실패했습니다.");
    Object.assign(error, { issues });
    throw error;
  }
}
