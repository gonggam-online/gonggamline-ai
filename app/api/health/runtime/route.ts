import { getSupabaseAvailability } from "@/lib/supabase";
import { runtimeLog } from "@/lib/runtime-logging";

export const dynamic = "force-dynamic";

async function checkSupabase(): Promise<{
  supabase: "configured" | "unconfigured" | "unreachable";
  runtimeQueue: "available" | "unavailable";
}> {
  const availability = getSupabaseAvailability();
  if (availability.status !== "configured") {
    return { supabase: "unconfigured", runtimeQueue: "unavailable" };
  }
  try {
    const response = await fetch(`${availability.url}/rest/v1/runtime_jobs?select=id&limit=1`, {
      headers: { apikey: availability.anonKey, Authorization: `Bearer ${availability.anonKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return {
      supabase: response.status < 500 ? "configured" : "unreachable",
      runtimeQueue: response.ok ? "available" : "unavailable",
    };
  } catch (error) {
    runtimeLog.warn("health.supabase_unreachable", { error });
    return { supabase: "unreachable", runtimeQueue: "unavailable" };
  }
}

export async function GET() {
  const database = await checkSupabase();
  const coupang = process.env.COUPANG_ACCESS_KEY?.trim()
    && process.env.COUPANG_SECRET_KEY?.trim()
    && process.env.COUPANG_VENDOR_ID?.trim()
    ? "configured" : "unconfigured";
  const status = database.supabase === "configured"
    && database.runtimeQueue === "available"
    && coupang === "configured" ? "healthy" : "degraded";

  return Response.json({
    success: true,
    status,
    checks: { application: "ok", supabase: database.supabase, coupang, runtimeQueue: database.runtimeQueue },
    timestamp: new Date().toISOString(),
  });
}
