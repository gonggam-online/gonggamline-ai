import { NextResponse } from "next/server";
import { getEnterpriseDashboard } from "@/services/company-os.service";
export const dynamic = "force-dynamic";
export async function GET(){
  try { return NextResponse.json({ success:true, dashboard:await getEnterpriseDashboard() }); }
  catch(error){ return NextResponse.json({ success:false, message:error instanceof Error?error.message:"Dashboard 조회 오류" },{status:500}); }
}
