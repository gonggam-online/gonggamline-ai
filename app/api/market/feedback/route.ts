import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = String(body.eventType ?? "");
    if (!['registered','sale','return','ad_spend','stockout','manual_rating'].includes(eventType)) return NextResponse.json({success:false,message:"지원하지 않는 피드백 유형입니다."},{status:400});
    const { data, error } = await supabase.from("market_feedback_events").insert({ market_product_id: body.marketProductId ?? null, product_id: body.productId ?? null, event_type: eventType, event_at: body.eventAt ?? new Date().toISOString(), quantity: body.quantity ?? null, amount: body.amount ?? null, metadata: body.metadata ?? {} }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ success:true, id:data.id });
  } catch (error) { return NextResponse.json({success:false,message:error instanceof Error?error.message:"피드백 저장 오류"},{status:500}); }
}
