import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type CommandUpdate = {
  status: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: number;
  output_summary?: unknown;
  error_message?: unknown;
};

type CommandPatchBody = {
  status?: unknown;
  progress?: unknown;
  outputSummary?: unknown;
  errorMessage?: unknown;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as CommandPatchBody;
    const status = String(body.status ?? "");
    const allowed = new Set([
      "running",
      "waiting_approval",
      "completed",
      "failed",
      "cancelled",
    ]);

    if (!allowed.has(status)) {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 상태입니다." },
        { status: 400 }
      );
    }

    const updates: CommandUpdate = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "running") {
      updates.started_at = new Date().toISOString();
      updates.progress = Math.max(1, Number(body.progress || 10));
    }
    if (status === "completed") {
      updates.completed_at = new Date().toISOString();
      updates.progress = 100;
      updates.output_summary = body.outputSummary ?? {};
    }
    if (status === "failed") {
      updates.completed_at = new Date().toISOString();
      updates.error_message = body.errorMessage || "실행 실패";
    }

    const { data, error } = await supabase
      .from("os_command_runs")
      .update(updates)
      .eq("id", Number(id))
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (
      ["completed", "failed", "cancelled"].includes(status) &&
      data.assigned_worker_code
    ) {
      await supabase
        .from("ai_workers")
        .update({
          status: "idle",
          current_mission: null,
          current_job: null,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("worker_code", data.assigned_worker_code);
    }
    return NextResponse.json({ success: true, command: data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "상태 변경 오류",
      },
      { status: 500 }
    );
  }
}
