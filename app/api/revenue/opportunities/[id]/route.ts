import { NextRequest, NextResponse } from "next/server";
import { transitionOpportunity } from "@/services/revenue-core.service";
import type { OpportunityStatus } from "@/types/revenue";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const opportunity = await transitionOpportunity(Number(id), String(body.status) as OpportunityStatus, body.reason);
    return NextResponse.json({ success: true, opportunity });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "상태 변경 오류" }, { status: 500 });
  }
}
