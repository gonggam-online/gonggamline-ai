import { NextRequest, NextResponse } from "next/server";
import { transitionCommerceWorkflow, WORKFLOW_STAGES } from "@/services/workflow.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!Number(body.workflowId) || !WORKFLOW_STAGES.includes(body.toStage)) {
      return NextResponse.json({ success: false, message: "Workflow와 전환 단계를 확인하세요." }, { status: 400 });
    }
    const workflow = await transitionCommerceWorkflow({
      workflowId: Number(body.workflowId),
      toStage: body.toStage,
      triggerType: "operator",
      triggerSource: "workflow.manual",
      idempotencyKey: body.idempotencyKey || `manual:${body.workflowId}:${body.toStage}:${Date.now()}`,
      reason: body.reason || "운영자 수동 전환",
      title: body.title || `수동 단계 전환: ${body.toStage}`,
      payload: body.payload || {},
      actor: "operator",
      allowBackward: Boolean(body.allowBackward),
    });
    return NextResponse.json({ success: true, workflow });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Workflow 전환 오류" }, { status: 500 });
  }
}
