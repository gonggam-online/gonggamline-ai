import { NextResponse } from "next/server";
import { createInboundPlan } from "@/services/procurement.service";
export async function POST(request:Request){try{const body=await request.json();if(!body.orderId||!String(body.warehouseName??"").trim())return NextResponse.json({success:false,message:"발주와 3PL 창고명을 입력하세요."},{status:400});return NextResponse.json({success:true,inbound:await createInboundPlan(body)});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"3PL 입고계획 저장 오류"},{status:500});}}
