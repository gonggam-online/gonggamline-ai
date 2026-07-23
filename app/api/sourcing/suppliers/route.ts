import { NextResponse } from "next/server";
import { createSupplier, getSourcingDashboard } from "@/services/sourcing.service";
export async function GET(){try{return NextResponse.json({success:true,...await getSourcingDashboard()});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"소싱 조회 오류"},{status:500});}}
export async function POST(request:Request){try{const body=await request.json();if(!String(body.name??"").trim())return NextResponse.json({success:false,message:"공급처명을 입력하세요."},{status:400});return NextResponse.json({success:true,supplier:await createSupplier(body)});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"공급처 저장 오류"},{status:500});}}
