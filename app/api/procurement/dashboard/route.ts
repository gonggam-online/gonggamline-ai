import { NextResponse } from "next/server";
import { getProcurementDashboard } from "@/services/procurement.service";
export async function GET(){try{return NextResponse.json({success:true,...await getProcurementDashboard()});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"조달 현황 조회 오류"},{status:500});}}
