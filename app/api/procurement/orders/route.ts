import { NextResponse } from "next/server";
import { createProcurementOrder } from "@/services/procurement.service";
export async function POST(request:Request){try{const body=await request.json();if(!body.quoteId)return NextResponse.json({success:false,message:"선정 견적을 선택하세요."},{status:400});return NextResponse.json({success:true,...await createProcurementOrder(body)});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"발주 생성 오류"},{status:500});}}
