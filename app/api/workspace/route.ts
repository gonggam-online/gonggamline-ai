import { NextResponse } from "next/server";
import { getProductWorkspace } from "@/services/workspace.service";
export async function GET(){try{return NextResponse.json({success:true,...await getProductWorkspace()});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"Workspace 조회 오류"},{status:500});}}
