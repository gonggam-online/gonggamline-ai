import { NextRequest, NextResponse } from "next/server";
import { generateDiscovery } from "../../../../services/discovery.service";
export async function POST(request: NextRequest) { try { const body=await request.json().catch(()=>({})); const result=await generateDiscovery(Math.min(200,Math.max(10,Number(body.limit??80)))); return NextResponse.json({success:true,result}); } catch(error){ return NextResponse.json({success:false,message:error instanceof Error?error.message:"추천 생성 오류"},{status:500}); } }
