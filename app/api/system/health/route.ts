import { NextResponse } from "next/server";
import { getSystemHealth } from "@/services/company-os.service";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ success: true, health: await getSystemHealth() }); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Health Check 오류" }, { status: 500 }); }
}
