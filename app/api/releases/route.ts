import { NextResponse } from "next/server";
import { listReleases } from "@/services/company-os.service";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ success: true, releases: await listReleases() }); }
  catch (error) { return NextResponse.json({ success: false, releases: [], message: error instanceof Error ? error.message : "Release 조회 오류" }, { status: 500 }); }
}
