import { NextRequest, NextResponse } from "next/server";
import { generateDiscovery } from "../../../../services/discovery.service";
import { publicErrorMessage } from "@/lib/runtime-errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(200, Math.max(10, Number(body.limit ?? 80)));
    const result = await generateDiscovery(limit);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: publicErrorMessage(error) },
      { status: 500 },
    );
  }
}
