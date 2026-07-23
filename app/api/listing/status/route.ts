import { NextResponse } from "next/server";
import { updateListingStatus } from "@/services/listing.service";
export async function POST(request:Request){try{const body=await request.json();return NextResponse.json({success:true,draft:await updateListingStatus(body)});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"Listing 상태 변경 오류"},{status:500});}}
