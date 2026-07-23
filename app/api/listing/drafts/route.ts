import { NextResponse } from "next/server";
import { getListingDashboard } from "@/services/listing.service";
export async function GET(){try{return NextResponse.json({success:true,...await getListingDashboard()});}catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"Listing 조회 오류"},{status:500});}}
