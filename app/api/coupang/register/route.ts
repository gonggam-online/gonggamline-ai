import { NextRequest, NextResponse } from "next/server";
import {
  attachVendorId,
  COUPANG_LIVE_CONFIRMATION_TEXT,
  createCoupangProduct,
} from "@/lib/coupang/register";
import { validateCoupangProductPayload } from "@/lib/coupang/validator";
import type {
  CoupangProductPayload,
  CoupangRegisterRequest,
} from "@/types/coupang";
import { updateListingStatus } from "@/services/listing.service";
import { transitionCommerceWorkflow } from "@/services/workflow.service";
import { recordCoupangSubmission } from "@/services/coupang-seller.service";

export async function POST(request: NextRequest) {
  try {
    const startedAt = Date.now();
    const body = (await request.json()) as CoupangRegisterRequest & { listingDraftId?: number; workflowId?: number; jobId?: number };
    const issues = validateCoupangProductPayload(body.payload);

    if (issues.length > 0) {
      return NextResponse.json(
        { ok: false, stage: "validation", issues },
        { status: 400 },
      );
    }

    const product = attachVendorId(body.payload as CoupangProductPayload);

    if (body.mode !== "live") {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        message:
          "기본 검증을 통과했습니다. 카테고리 메타정보의 필수 옵션·고시정보·인증정보도 반드시 대조하세요.",
        payload: product,
      });
    }

    if (body.confirmation !== COUPANG_LIVE_CONFIRMATION_TEXT) {
      return NextResponse.json(
        {
          ok: false,
          stage: "confirmation",
          message: `실제 등록을 위해 확인 문구 '${COUPANG_LIVE_CONFIRMATION_TEXT}'를 정확히 입력하세요.`,
        },
        { status: 400 },
      );
    }

    const result = await createCoupangProduct(product);

    await recordCoupangSubmission({
      jobId: body.jobId,
      listingDraftId: body.listingDraftId,
      workflowId: body.workflowId,
      success: result.ok,
      status: result.status,
      response: result.ok ? result.data : result.raw,
      error: result.ok ? undefined : `쿠팡 API HTTP ${result.status}`,
      durationMs: Date.now() - startedAt,
    });

    if (result.ok && body.listingDraftId) {
      await updateListingStatus({ id: body.listingDraftId, status: "registered" });
    }
    if (result.ok && body.workflowId) {
      await transitionCommerceWorkflow({
        workflowId: body.workflowId,
        toStage: "coupang_registered",
        triggerType: "adapter",
        triggerSource: "coupang.register",
        idempotencyKey: `coupang-register:${body.workflowId}:${JSON.stringify(result.data)}`,
        title: "쿠팡 상품 등록 완료",
        payload: { result: result.data, jobId: body.jobId ?? null },
        actor: "coupang_adapter",
      });
    }

    return NextResponse.json(
      result.ok
        ? {
            ok: true,
            dryRun: false,
            message: "쿠팡 상품 생성 요청을 전송했습니다.",
            result: result.data,
          }
        : {
            ok: false,
            stage: "coupang",
            status: result.status,
            detail: result.raw,
          },
      { status: result.ok ? 200 : result.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "상품 등록 요청 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
