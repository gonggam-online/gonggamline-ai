import { NextRequest, NextResponse } from "next/server";
import { getWorkflowDetail } from "@/services/workflow.service";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!Number(id)) return NextResponse.json({ success: false, message: "Workflow ID를 확인하세요." }, { status: 400 });
    return NextResponse.json({ success: true, ...(await getWorkflowDetail(Number(id))) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Workflow 상세 조회 오류" }, { status: 500 });
  }
}
