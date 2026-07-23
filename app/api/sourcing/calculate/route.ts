import { NextResponse } from "next/server";
import { calculateAndSaveDecision } from "@/services/sourcing.service";
export async function POST(request:Request){try{const body=await request.json();const quoteId=Number(body.quoteId),price=Number(body.targetSellingPrice);if(!quoteId||price<=0)return NextResponse.json({success:false,message:"견적과 목표 판매가를 확인하세요."},{status:400});return NextResponse.json({success:true,decision:await calculateAndSaveDecision(quoteId,price)});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"소싱 계산 오류"},{status:500});}}
