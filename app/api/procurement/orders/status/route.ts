import { NextResponse } from "next/server";
import { updateProcurementOrderStatus } from "@/services/procurement.service";
export async function POST(request:Request){try{const body=await request.json();if(!body.orderId||!body.status)return NextResponse.json({success:false,message:"발주와 상태를 입력하세요."},{status:400});return NextResponse.json({success:true,order:await updateProcurementOrderStatus(body)});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"발주 상태 변경 오류"},{status:500});}}
