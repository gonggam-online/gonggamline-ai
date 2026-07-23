import { NextResponse } from "next/server";
import { createListingDraft } from "@/services/listing.service";
export async function POST(request:Request){try{const body=await request.json();return NextResponse.json({success:true,draft:await createListingDraft(body)});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"Listing 생성 오류"},{status:500});}}
