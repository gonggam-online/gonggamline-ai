import { NextResponse } from "next/server";
import { reconcileCommerceWorkflows } from "@/services/workflow.service";

export async function POST() {
  try {
    return NextResponse.json({ success: true, ...(await reconcileCommerceWorkflows()) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Workflow 동기화 오류" }, { status: 500 });
  }
}
