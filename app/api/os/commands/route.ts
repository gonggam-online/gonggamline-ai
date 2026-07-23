import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const COMMANDS: Record<string,{name:string;worker:string;description:string}> = {
  discover_products:{name:"상품 발굴 시작",worker:"ai-md",description:"시장 후보 상품을 발굴하고 검증 대기열을 생성합니다."},
  run_ai_analysis:{name:"AI 분석 실행",worker:"ai-profit",description:"후보 상품의 수요·경쟁·수익성을 분석합니다."},
  generate_content:{name:"상세페이지 생성",worker:"ai-content",description:"승인 상품의 상품명·키워드·상세 콘텐츠를 생성합니다."},
  generate_thumbnail:{name:"썸네일 생성",worker:"ai-content",description:"Listing용 썸네일 생성 작업을 예약합니다."},
  prepare_coupang:{name:"쿠팡 등록 준비",worker:"ai-marketplace",description:"등록 초안을 검증하고 쿠팡 제출 준비 상태로 전환합니다."},
  run_ceo_brief:{name:"AI CEO 브리핑",worker:"ai-ceo",description:"매출·이익·리스크를 기반으로 오늘의 경영 우선순위를 생성합니다."},
  run_full_pipeline:{name:"전체 자동 실행",worker:"ai-ceo",description:"발굴부터 등록 준비까지 안전한 자동화 파이프라인을 시작합니다."},
};

export async function GET(){
  const result=await supabase.from("os_command_runs").select("*").order("created_at",{ascending:false}).limit(20);
  if(result.error) return NextResponse.json({success:false,message:result.error.message},{status:500});
  return NextResponse.json({success:true,commands:result.data??[],catalog:COMMANDS});
}

export async function POST(request:NextRequest){
  try{
    const body=await request.json();
    const config=COMMANDS[String(body.commandCode||"")];
    if(!config) return NextResponse.json({success:false,message:"지원하지 않는 명령입니다."},{status:400});
    const {data,error}=await supabase.from("os_command_runs").insert({
      command_code:body.commandCode,command_name:config.name,status:"queued",assigned_worker_code:config.worker,
      input_payload:body.input??{},output_summary:{description:config.description},progress:0,
    }).select("*").single();
    if(error) throw new Error(error.message);
    await supabase.from("ai_workers").update({status:"working",current_mission:config.name,current_job:`command:${data.id}`,last_activity_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("worker_code",config.worker);
    await supabase.from("os_notifications").insert({severity:"info",category:"command",title:`${config.name} 예약됨`,message:`${config.worker} Worker에 작업이 배정되었습니다.`,action_url:"/os",metadata:{commandRunId:data.id}});
    return NextResponse.json({success:true,command:data,message:"명령이 실행 대기열에 추가되었습니다."},{status:201});
  }catch(error){return NextResponse.json({success:false,message:error instanceof Error?error.message:"명령 실행 오류"},{status:500});}
}
