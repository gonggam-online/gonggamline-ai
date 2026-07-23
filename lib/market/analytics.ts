import { calculateConfidence, clamp, estimateMonthlyUnits } from "./scoring";

type Snapshot = {
  observed_at: string;
  rank: number | null;
  price: number | null;
  review_count: number | null;
  is_sold_out: boolean | null;
  is_ad?: boolean | null;
};

function valid(values: Array<number | null | undefined>) { return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)); }
function firstNumber(values: Array<number | null | undefined>) { return valid(values)[0] ?? null; }
function lastNumber(values: Array<number | null | undefined>) { return valid(values).at(-1) ?? null; }
function percentChange(previous: number | null, current: number | null) { return previous == null || current == null || previous === 0 ? null : ((current - previous) / previous) * 100; }
function average(values: Array<number | null | undefined>) { const v = valid(values); return v.length ? v.reduce((s,n)=>s+n,0)/v.length : null; }
function stddev(values: Array<number | null | undefined>) { const v=valid(values); if(v.length<2) return 0; const m=v.reduce((s,n)=>s+n,0)/v.length; return Math.sqrt(v.reduce((s,n)=>s+(n-m)**2,0)/v.length); }
function round(value: number, digits = 2) { const p=10**digits; return Math.round(value*p)/p; }

export function analyzeSnapshots(snapshots: Snapshot[]) {
  const ordered = [...snapshots].sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));
  const latest = ordered.at(-1);
  const now = latest ? Date.parse(latest.observed_at) : Date.now();
  const withinDays = (days:number)=>ordered.filter(r=>Date.parse(r.observed_at)>=now-days*86_400_000);
  const rows7=withinDays(7), rows30=withinDays(30);
  const latestPrice=lastNumber(ordered.map(r=>r.price));
  const priceChange7dPct=percentChange(firstNumber(rows7.map(r=>r.price)),latestPrice);
  const latestReviews=lastNumber(ordered.map(r=>r.review_count));
  const review7Start=firstNumber(rows7.map(r=>r.review_count));
  const review30Start=firstNumber(rows30.map(r=>r.review_count));
  const reviewDelta7d=Math.max(0,(latestReviews??0)-(review7Start??latestReviews??0));
  const reviewDelta30d=Math.max(0,(latestReviews??0)-(review30Start??latestReviews??0));
  const averageRank7d=average(rows7.map(r=>r.rank));
  const rank7Start=firstNumber(rows7.map(r=>r.rank));
  const latestRank=lastNumber(ordered.map(r=>r.rank));
  const rankChange7d=rank7Start!=null&&latestRank!=null?rank7Start-latestRank:null;
  const stockoutCount30d=rows30.reduce((count,row,index)=>count+(row.is_sold_out===true&&rows30[index-1]?.is_sold_out!==true?1:0),0);
  const timestamps=ordered.map(r=>Date.parse(r.observed_at));
  const observationDays=timestamps.length>1?Math.max(1,Math.ceil((Math.max(...timestamps)-Math.min(...timestamps))/86_400_000)):ordered.length;
  const confidence=calculateConfidence({observationDays,observations:ordered.length,hasRank:latestRank!=null,hasReviews:latestReviews!=null,hasStock:ordered.some(r=>r.is_sold_out!=null),hasPrice:latestPrice!=null});
  const estimate=estimateMonthlyUnits({reviewDelta30d,averageRank:averageRank7d,stockoutCount30d,confidence});

  const priceVolatility30d=latestPrice?stddev(rows30.map(r=>r.price))/latestPrice*100:0;
  const rankMean30=average(rows30.map(r=>r.rank));
  const rankVolatility30d=rankMean30?stddev(rows30.map(r=>r.rank))/rankMean30*100:0;
  const reviewVelocity7d=reviewDelta7d/Math.max(1,Math.min(7,observationDays));
  const adRows=rows30.filter(r=>r.is_ad!=null);
  const adRatio30d=adRows.length?adRows.filter(r=>r.is_ad===true).length/adRows.length:0;
  const completenessFields=[latestPrice!=null,latestReviews!=null,latestRank!=null,ordered.some(r=>r.is_sold_out!=null),adRows.length>0];
  const dataCompletenessScore=clamp((completenessFields.filter(Boolean).length/completenessFields.length)*70+Math.min(30,ordered.length*2));

  const demandScore=clamp(reviewDelta30d*2.4+(averageRank7d==null?10:Math.max(0,60-averageRank7d))+stockoutCount30d*8);
  const growthScore=clamp(reviewDelta7d*5+Math.max(0,rankChange7d??0)*2.5);
  const stabilityScore=clamp(100-Math.abs(priceChange7dPct??0)*4-priceVolatility30d*2.5-stockoutCount30d*6);
  const competitionScore=clamp((averageRank7d==null?50:Math.max(10,100-averageRank7d))+Math.min(30,(latestReviews??0)/100)+adRatio30d*20);
  const supplyScore=clamp(100-stockoutCount30d*18-Math.max(0,priceVolatility30d-5)*2);
  const adBurdenScore=clamp(adRatio30d*100);
  const entryDifficultyScore=clamp(competitionScore*.55+adBurdenScore*.25+Math.min(100,(latestReviews??0)/30)*.20);
  const opportunityScore=clamp(demandScore*.28+growthScore*.24+stabilityScore*.17+supplyScore*.11+(100-entryDifficultyScore)*.20);
  const recommendationGrade=opportunityScore>=82?"S":opportunityScore>=68?"A":opportunityScore>=54?"B":opportunityScore>=38?"C":"D";
  const reasons=[reviewDelta7d>0?`7일 리뷰 +${reviewDelta7d}`:null,rankChange7d!=null&&rankChange7d>0?`7일 순위 ${rankChange7d}단계 상승`:null,Math.abs(priceChange7dPct??0)<=5?"가격 안정":null,stockoutCount30d>0?`30일 품절 전환 ${stockoutCount30d}회`:null,adRatio30d<=.2&&adRows.length?"광고 노출 부담 낮음":null].filter(Boolean);

  return {
    snapshotCount:ordered.length,observationDays,latestPrice,priceChange7dPct,latestReviewCount:latestReviews,reviewDelta7d,reviewDelta30d,averageRank7d,rankChange7d,stockoutCount30d,
    priceVolatility30d:round(priceVolatility30d,3),rankVolatility30d:round(rankVolatility30d,3),reviewVelocity7d:round(reviewVelocity7d,3),adRatio30d:round(adRatio30d,4),dataCompletenessScore:round(dataCompletenessScore),
    demandScore:round(demandScore),growthScore:round(growthScore),stabilityScore:round(stabilityScore),competitionScore:round(competitionScore),supplyScore:round(supplyScore),adBurdenScore:round(adBurdenScore),entryDifficultyScore:round(entryDifficultyScore),opportunityScore:round(opportunityScore),
    confidence,estimate,recommendationGrade,recommendationReason:reasons.join(" · ")||"관측 데이터 축적 중",
    scoreExplanation:{demand:"리뷰 증가·검색순위·품절 신호",growth:"7일 리뷰와 순위 상승",stability:"가격 변동성과 품절 빈도",supply:"품절 및 가격 급변 위험",entryDifficulty:"경쟁·광고·누적 리뷰 부담"}
  };
}
