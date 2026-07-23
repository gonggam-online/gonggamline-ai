import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await supabase.from("runtime_jobs").select("*").order("created_at", { ascending: false }).limit(100);
  if (result.error) return NextResponse.json({ success: false, message: result.error.message }, { status: 500 });
  return NextResponse.json({ success: true, jobs: result.data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await supabase.from("runtime_jobs").insert({
      job_code: `JOB-${Date.now()}`,
      opportunity_id: body.opportunityId || null,
      worker_code: body.workerCode || "ai-md",
      job_type: body.jobType || "discover_opportunities",
      status: "queued",
      priority: Number(body.priority || 50),
      input_payload: body.input || {},
    }).select("*").single();
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, job: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Job 생성 오류" }, { status: 500 });
  }
}
