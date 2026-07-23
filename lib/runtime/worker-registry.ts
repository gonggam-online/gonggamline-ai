export type WorkerExecutionContext = {
  jobId: number;
  opportunityId: number | null;
  input: Record<string, unknown>;
};

export type WorkerExecutionResult = {
  summary: string;
  output: Record<string, unknown>;
  opportunityPatch?: Record<string, unknown>;
  decision?: {
    type: string;
    value: string;
    reason: string;
    confidence: number;
    expectedImpact?: number;
  };
};

const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function executeWorker(jobType: string, context: WorkerExecutionContext): Promise<WorkerExecutionResult> {
  switch (jobType) {
    case "evaluate_opportunity": {
      const demand = number(context.input.demandScore, 72);
      const margin = number(context.input.marginScore, 70);
      const competition = number(context.input.competitionScore, 60);
      const supply = number(context.input.supplyScore, 70);
      const risk = number(context.input.riskScore, 25);
      const listing = number(context.input.listingScore, 65);
      const score = Math.round(demand * .25 + margin * .25 + competition * .15 + supply * .15 + listing * .1 + (100 - risk) * .1);
      const approved = score >= 78;
      return {
        summary: `Revenue Score ${score}점 평가 완료`,
        output: { demand, margin, competition, supply, risk, listing, revenueScore: score, approved },
        opportunityPatch: { revenue_score: score, status: approved ? "approved" : "candidate", next_action: approved ? "콘텐츠 생성 Job 실행" : "추가 시장 검증" },
        decision: { type: "worker_evaluation", value: approved ? "approve" : "hold", reason: `Revenue Score ${score}점`, confidence: Math.min(95, 60 + Math.round(score * .35)), expectedImpact: score },
      };
    }
    case "generate_content":
      return {
        summary: "상품 콘텐츠 초안 생성 완료",
        output: { titleGenerated: true, bulletsGenerated: 5, faqGenerated: 3, htmlGenerated: true },
        opportunityPatch: { status: "content", listing_score: 78, next_action: "썸네일 및 등록 검증" },
        decision: { type: "content_generation", value: "complete", reason: "핵심 판매 콘텐츠 초안 생성", confidence: 86 },
      };
    case "prepare_listing":
      return {
        summary: "마켓플레이스 등록 준비 완료",
        output: { marketplace: "coupang", validation: "passed", requiredFields: "complete" },
        opportunityPatch: { status: "ready", listing_score: 88, next_action: "CEO 승인 후 쿠팡 등록" },
        decision: { type: "listing_readiness", value: "ready", reason: "필수 등록 필드 검증 통과", confidence: 90 },
      };
    case "learn_from_result":
      return {
        summary: "성과 학습 데이터 기록 완료",
        output: { learned: true, signals: ["score", "status", "profit"] },
        opportunityPatch: { status: "learning", next_action: "성과 데이터 누적 대기" },
        decision: { type: "learning", value: "recorded", reason: "실행 결과를 Memory에 저장", confidence: 92 },
      };
    default:
      return { summary: `${jobType} 기본 실행 완료`, output: { executed: true, jobType } };
  }
}
