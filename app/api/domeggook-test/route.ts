import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.DOMEGGOOK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        message: "도매꾹 API 키가 설정되지 않았습니다.",
      },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    ver: "4.0",
    mode: "getItemViewES",
    aid: apiKey,
    no: "54002383",
    om: "json",
  });

  try {
   const response = await fetch(
  `https://domeggook.com/ssl/api/?${params.toString()}`,
  {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  }
);

    if (!response.ok) {
      throw new Error(`도매꾹 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    const item = data?.domeggook?.item?.[0];

    if (!item) {
      return NextResponse.json({
        success: false,
        message: "상품 정보를 찾지 못했습니다.",
        rawData: data,
      });
    }

    return NextResponse.json({
      success: true,
      product: {
        productNo: item.basis?.no ?? null,
        status: item.basis?.status ?? null,
        title: item.basis?.title ?? null,
        price: item.price?.dome ?? null,
        supplyPrice: item.price?.supply ?? null,
        minimumOrderQuantity: item.price?.qty ?? null,
        sellerId: item.seller?.id ?? null,
        sellerName: item.seller?.name ?? null,
        thumbnail: item.thumb?.small ?? null,
        productUrl: item.link ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "API 호출 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}