import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { error } = await supabase
      .from("products")
      .select("*")
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Supabase 연결 성공",
    });

  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
    });
  }
}