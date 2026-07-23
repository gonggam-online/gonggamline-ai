import { NextResponse } from "next/server";
import { getWorkflowDashboard } from "@/services/workflow.service";

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...(await getWorkflowDashboard()) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Workflow 조회 오류" }, { status: 500 });
  }
}
