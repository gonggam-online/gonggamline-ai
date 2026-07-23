import { NextResponse } from "next/server";
import { listRecommendations } from "../../../../services/discovery.service";
export async function GET(){ try{return NextResponse.json({success:true,recommendations:await listRecommendations()});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"추천 조회 오류"},{status:500});}}
