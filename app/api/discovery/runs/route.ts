import { NextResponse } from "next/server";
import { listDecisionRuns } from "../../../../services/discovery.service";
export async function GET(){try{return NextResponse.json({success:true,runs:await listDecisionRuns()});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"실행 이력 조회 오류"},{status:500});}}
