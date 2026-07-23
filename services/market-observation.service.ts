import { supabase } from "../lib/supabase";
import type { MarketObservationInput } from "../types/market";

export async function saveMarketObservation(input: MarketObservationInput) {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const { data: keyword, error: keywordError } = await supabase
    .from("market_keywords")
    .upsert({ keyword: input.keyword, updated_at: observedAt }, { onConflict: "keyword" })
    .select("id")
    .single();
  if (keywordError) throw new Error(keywordError.message);

  const { data: product, error: productError } = await supabase
    .from("market_products")
    .upsert({
      source: input.source,
      external_product_id: input.product.externalProductId,
      vendor_item_id: input.product.vendorItemId ?? null,
      product_url: input.product.url ?? null,
      title: input.product.title,
      brand: input.product.brand ?? null,
      seller_name: input.product.sellerName ?? null,
      category: input.product.category ?? null,
      thumbnail_url: input.product.thumbnailUrl ?? null,
      last_seen_at: observedAt,
      updated_at: observedAt,
    }, { onConflict: "source,external_product_id" })
    .select("id")
    .single();
  if (productError) throw new Error(productError.message);

  const { error: snapshotError } = await supabase.from("market_snapshots").insert({
    market_product_id: product.id,
    market_keyword_id: keyword.id,
    observed_at: observedAt,
    rank: input.snapshot.rank ?? null,
    is_ad: input.snapshot.isAd ?? null,
    price: input.snapshot.price ?? null,
    list_price: input.snapshot.listPrice ?? null,
    rating: input.snapshot.rating ?? null,
    review_count: input.snapshot.reviewCount ?? null,
    rocket_type: input.snapshot.rocketType ?? null,
    is_sold_out: input.snapshot.isSoldOut ?? null,
    delivery_days: input.snapshot.deliveryDays ?? null,
    option_count: input.snapshot.optionCount ?? null,
    raw_payload: input,
  });
  if (snapshotError) throw new Error(snapshotError.message);

  return { keywordId: keyword.id, productId: product.id, observedAt };
}
