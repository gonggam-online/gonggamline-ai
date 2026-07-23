import { supabase } from "../lib/supabase";
import type { Product } from "../types/product";

type SaveProductsResult = {
  savedCount: number;
  errorMessage: string | null;
};

export async function saveProducts(
  keyword: string,
  products: Product[]
): Promise<SaveProductsResult> {
  if (products.length === 0) {
    return {
      savedCount: 0,
      errorMessage: null,
    };
  }

  const rows = products.map((product) => ({
    product_no: product.productNo,
    keyword,

    title: product.title,
    thumbnail: product.thumbnail,
    product_url: product.productUrl,

    supply_price: product.price,
    minimum_order_quantity: product.minimumOrderQuantity,
    initial_purchase_amount: product.initialPurchaseAmount,

    estimated_sale_price: product.estimatedSalePrice,
    marketplace_fee: product.marketplaceFee,
    advertising_cost: product.advertisingCost,
    logistics_cost: product.logisticsCost,
    return_reserve: product.returnReserve,

    estimated_profit: product.estimatedProfit,
    margin_rate: product.marginRate,
    break_even_sale_price: product.breakEvenSalePrice,

    basic_score: product.basicScore,
    recommendation: product.recommend,

    seller_id: product.sellerId,
    seller_name: product.sellerName,

    available_on_domeggook: product.availableOnDomeggook,
    supply_available: product.supplyAvailable,

    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("products")
    .upsert(rows, {
      onConflict: "product_no",
    });

  if (error) {
    console.error("Supabase 상품 저장 오류:", error);

    return {
      savedCount: 0,
      errorMessage: error.message,
    };
  }

  return {
    savedCount: rows.length,
    errorMessage: null,
  };
}