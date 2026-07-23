import { NextResponse } from "next/server";
import { listBundles } from "../../../../services/discovery.service";
export async function GET(){ try{return NextResponse.json({success:true,bundles:await listBundles()});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"묶음 조회 오류"},{status:500});}}
