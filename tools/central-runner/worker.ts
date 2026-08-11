import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import {
  CENTRAL_RUNNER_SCHEMA_VERSION,
  categoryCode,
  parseCentralRunnerRequest,
  type CentralRunnerRequest,
  type CentralRunnerResponse,
} from "./contracts.ts";

const requestQueueUrl = process.env.CENTRAL_RUNNER_REQUEST_QUEUE_URL?.trim();
const responseQueueUrl = process.env.CENTRAL_RUNNER_RESPONSE_QUEUE_URL?.trim();
const region = process.env.AWS_REGION?.trim() || "ap-southeast-1";

if (!requestQueueUrl || !responseQueueUrl) {
  throw new Error("CENTRAL_RUNNER_QUEUE_CONFIGURATION_MISSING");
}

const sqs = new SQSClient({ region });

function response(request: CentralRunnerRequest, input: Omit<CentralRunnerResponse, "schemaVersion" | "taskId" | "completedAt">): CentralRunnerResponse {
  return {
    schemaVersion: CENTRAL_RUNNER_SCHEMA_VERSION,
    taskId: request.taskId,
    completedAt: new Date().toISOString(),
    ...input,
  };
}

async function execute(request: CentralRunnerRequest): Promise<CentralRunnerResponse> {
  const { coupangRequest, getCoupangConfig } = await import("@/lib/coupang/client");
  if (request.operation === "COUPANG_CONNECTION_TEST") {
    const { vendorId } = getCoupangConfig();
    const result = await coupangRequest<unknown>({
      method: "GET",
      path: `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/inflow-status`,
      searchParams: new URLSearchParams({ vendorId }),
      signal: AbortSignal.timeout(15_000),
    });
    return response(request, {
      ok: result.ok,
      status: result.status,
      ...(result.ok ? { result: { connected: true } } : { errorCode: "COUPANG_REQUEST_FAILED" }),
    });
  }
  const result = await coupangRequest<unknown>({
    method: "GET",
    path: `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/${categoryCode(request)}`,
    signal: AbortSignal.timeout(15_000),
  });
  return response(request, {
    ok: result.ok,
    status: result.status,
    ...(result.ok ? { result: result.data } : { errorCode: "COUPANG_REQUEST_FAILED" }),
  });
}

async function processMessage(body: string): Promise<CentralRunnerResponse> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("INVALID_REQUEST");
  }
  const request = parseCentralRunnerRequest(parsed);
  try {
    return await execute(request);
  } catch (error) {
    return response(request, {
      ok: false,
      status: 503,
      errorCode: error instanceof Error ? error.message : "EXECUTION_FAILED",
    });
  }
}

async function run(): Promise<void> {
  let delayMs = 1_000;
  for (;;) {
    try {
      const received = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: requestQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 60,
        MessageSystemAttributeNames: ["ApproximateReceiveCount"],
      }));
      delayMs = 1_000;
      const message = received.Messages?.[0];
      if (!message?.Body || !message.ReceiptHandle) continue;
      const result = await processMessage(message.Body);
      await sqs.send(new SendMessageCommand({
        QueueUrl: responseQueueUrl,
        MessageBody: JSON.stringify(result),
        MessageGroupId: undefined,
      }));
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: requestQueueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        event: "central_runner_poll_failed",
        errorCode: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      }));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 60_000);
    }
  }
}

void run();
