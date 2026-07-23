import { NextResponse } from "next/server";
import { getCompanyOverview } from "@/services/company-os.service";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ success: true, overview: await getCompanyOverview() }); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "OS Overview 오류" }, { status: 500 }); }
}
