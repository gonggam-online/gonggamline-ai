import { NextResponse } from "next/server";
import { listWorkers } from "@/services/company-os.service";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ success: true, workers: await listWorkers() }); }
  catch (error) { return NextResponse.json({ success: false, workers: [], message: error instanceof Error ? error.message : "Worker 조회 오류" }, { status: 500 }); }
}
