import { NextRequest, NextResponse } from "next/server";
import type { Product } from "../../../types/product";

type RawProduct = {
  no?: string | number;
  title?: string;
  thumb?: string;
  price?: string | number;
  unitQty?: string | number;
  id?: string;
  sellerId?: string;
  nick?: string;
  url?: string;
  link?: string;
  market?: {
    domeggook?: boolean | string;
    supply?: boolean | string;
  };
};

type CalculationSettings = {
  marketplaceFeeRate: number;
  advertisingRate: number;
  logisticsCost: number;
  returnReserveRate: number;
  saleMultiplier: number;
  minimumAddedPrice: number;
};

function toNumber(
  value: string | null,
  defaultValue: number,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER
) {
  if (value === null || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function toBoolean(value: boolean | string | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return false;
}

function roundUpToHundred(value: number) {
  return Math.ceil(value / 100) * 100;
}

function calculateProfit(
  supplyPrice: number,
  settings: CalculationSettings
) {
  const estimatedSalePrice = roundUpToHundred(
    Math.max(
      supplyPrice * settings.saleMultiplier,
      supplyPrice + settings.minimumAddedPrice
    )
  );

  const marketplaceFee = Math.round(
    estimatedSalePrice * (settings.marketplaceFeeRate / 100)
  );

  const advertisingCost = Math.round(
    estimatedSalePrice * (settings.advertisingRate / 100)
  );

  const returnReserve = Math.round(
    estimatedSalePrice * (settings.returnReserveRate / 100)
  );

  const estimatedProfit =
    estimatedSalePrice -
    supplyPrice -
    marketplaceFee -
    advertisingCost -
    settings.logisticsCost -
    returnReserve;

  const marginRate =
    estimatedSalePrice > 0
      ? Math.round((estimatedProfit / estimatedSalePrice) * 1000) / 10
      : 0;

  const variableCostRate =
    settings.marketplaceFeeRate / 100 +
    settings.advertisingRate / 100 +
    settings.returnReserveRate / 100;

  const breakEvenSalePrice =
    variableCostRate < 1
      ? Math.ceil(
          (supplyPrice + settings.logisticsCost) /
            (1 - variableCostRate)
        )
      : 0;

  return {
    estimatedSalePrice,
    marketplaceFee,
    advertisingCost,
    logisticsCost: settings.logisticsCost,
    returnReserve,
    estimatedProfit,
    marginRate,
    breakEvenSalePrice,
  };
}

function calculateCandidateScore({
  price,
  minimumOrderQuantity,
  marginRate,
  estimatedProfit,
  initialPurchaseAmount,
}: {
  price: number;
  minimumOrderQuantity: number;
  marginRate: number;
  estimatedProfit: number;
  initialPurchaseAmount: number;
}) {
  let score = 0;

  if (price >= 1000 && price <= 10000) {
    score += 20;
  } else if (price > 10000 && price <= 20000) {
    score += 15;
  } else if (price > 0 && price < 1000) {
    score += 10;
  } else if (price > 20000 && price <= 30000) {
    score += 5;
  }

  if (minimumOrderQuantity <= 2) {
    score += 20;
  } else if (minimumOrderQuantity <= 5) {
    score += 15;
  } else if (minimumOrderQuantity <= 10) {
    score += 8;
  } else if (minimumOrderQuantity <= 20) {
    score += 3;
  }

  if (marginRate >= 35) {
    score += 35;
  } else if (marginRate >= 30) {
    score += 30;
  } else if (marginRate >= 25) {
    score += 22;
  } else if (marginRate >= 20) {
    score += 13;
  } else if (marginRate >= 10) {
    score += 5;
  }

  if (estimatedProfit >= 5000) {
    score += 15;
  } else if (estimatedProfit >= 3000) {
    score += 12;
  } else if (estimatedProfit >= 2000) {
    score += 8;
  } else if (estimatedProfit >= 1000) {
    score += 4;
  }

  if (initialPurchaseAmount <= 30000) {
    score += 10;
  } else if (initialPurchaseAmount <= 70000) {
    score += 7;
  } else if (initialPurchaseAmount <= 150000) {
    score += 3;
  }

  return Math.max(0, Math.min(100, score));
}

function getRecommendation(
  score: number,
  marginRate: number,
  estimatedProfit: number
) {
  if (
    score >= 85 &&
    marginRate >= 30 &&
    estimatedProfit >= 3000
  ) {
    return "최우선 샘플발주";
  }

  if (
    score >= 75 &&
    marginRate >= 25 &&
    estimatedProfit >= 2000
  ) {
    return "추천 후보";
  }

  if (
    score >= 65 &&
    marginRate >= 20 &&
    estimatedProfit >= 1000
  ) {
    return "추가 검토";
  }

  return "보류";
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.DOMEGGOOK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        message:
          "DOMEGGOOK_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인해주세요.",
      },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;

  const keyword =
    searchParams.get("keyword")?.trim() || "케이블정리";

  const page = Math.floor(
    toNumber(searchParams.get("page"), 1, 1, 10000)
  );

  const size = Math.floor(
    toNumber(searchParams.get("size"), 20, 1, 200)
  );

  const calculationSettings: CalculationSettings = {
    marketplaceFeeRate: toNumber(
      searchParams.get("feeRate"),
      11,
      0,
      50
    ),

    advertisingRate: toNumber(
      searchParams.get("adRate"),
      8,
      0,
      50
    ),

    logisticsCost: toNumber(
      searchParams.get("logisticsCost"),
      2500,
      0,
      100000
    ),

    returnReserveRate: toNumber(
      searchParams.get("returnRate"),
      3,
      0,
      30
    ),

    saleMultiplier: toNumber(
      searchParams.get("saleMultiplier"),
      2.5,
      1,
      10
    ),

    minimumAddedPrice: toNumber(
      searchParams.get("minimumAddedPrice"),
      5000,
      0,
      100000
    ),
  };

  const domeggookParams = new URLSearchParams({
    ver: "4.1",
    mode: "getItemList",
    aid: apiKey,
    market: "dome",
    om: "json",
    kw: keyword,
    pg: String(page),
    sz: String(size),
  });

  try {
    const response = await fetch(
      `https://domeggook.com/ssl/api/?${domeggookParams.toString()}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      throw new Error(
        `도매꾹 API 응답 오류: ${response.status}`
      );
    }

    const data = await response.json();

    const rawItems = data?.domeggook?.list?.item;

    const itemArray: RawProduct[] = Array.isArray(rawItems)
      ? rawItems
      : rawItems
        ? [rawItems]
        : [];

    const products: Product[] = itemArray.map((item) => {
      const price = Math.max(
        0,
        Number(item.price ?? 0)
      );

      const minimumOrderQuantity = Math.max(
        1,
        Number(item.unitQty ?? 1)
      );

      const initialPurchaseAmount =
        price * minimumOrderQuantity;

      const profit = calculateProfit(
        price,
        calculationSettings
      );

      const basicScore = calculateCandidateScore({
        price,
        minimumOrderQuantity,
        marginRate: profit.marginRate,
        estimatedProfit: profit.estimatedProfit,
        initialPurchaseAmount,
      });

      return {
        productNo: String(item.no ?? ""),
        title: item.title ?? "상품명 없음",
        thumbnail: item.thumb ?? null,

        price,
        minimumOrderQuantity,
        initialPurchaseAmount,

        estimatedSalePrice: profit.estimatedSalePrice,
        marketplaceFee: profit.marketplaceFee,
        advertisingCost: profit.advertisingCost,
        logisticsCost: profit.logisticsCost,
        returnReserve: profit.returnReserve,
        estimatedProfit: profit.estimatedProfit,
        marginRate: profit.marginRate,
        breakEvenSalePrice: profit.breakEvenSalePrice,

        sellerId:
          item.id ??
          item.sellerId ??
          null,

        sellerName:
          item.nick ??
          null,

        productUrl:
          item.url ??
          item.link ??
          (item.no
            ? `https://domeggook.com/${item.no}`
            : null),

        availableOnDomeggook:
          toBoolean(item.market?.domeggook),

        supplyAvailable:
          toBoolean(item.market?.supply),

        basicScore,

        recommend:
          getRecommendation(
            basicScore,
            profit.marginRate,
            profit.estimatedProfit
          ),
      };
    });

    products.sort((a, b) => {
      if (b.basicScore !== a.basicScore) {
        return b.basicScore - a.basicScore;
      }

      return b.estimatedProfit - a.estimatedProfit;
    });

    const totalCount = Number(
      data?.domeggook?.header?.numberOfItems ??
        data?.domeggook?.header?.totalCount ??
        products.length
    );

    return NextResponse.json({
      success: true,
      keyword,
      page,
      size,
      totalCount,

      calculationSettings,

      storage: {
        success: true,
        savedCount: 0,
        errorMessage: null,
      },

      products,
    });
  } catch (error) {
    console.error(
      "도매꾹 상품 검색 오류:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "상품 검색 중 알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
