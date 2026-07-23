import { NextResponse } from "next/server";
import { engineRegistry } from "@/engines/registry";

export async function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    engines: engineRegistry,
  });
}
