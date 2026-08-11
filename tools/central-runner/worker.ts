import crypto from "node:crypto";

import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
  type Message,
} from "@aws-sdk/client-sqs";

import {
  categoryCode,
  parseWingReadRequest,
  sellerProductParameters,
  WingRequestError,
  wingReadResponse,
  type WingReadRequest,
  type WingReadResponse,
} from "./contracts.ts";

export interface WingReadAdapter {
  execute(request: WingReadRequest): Promise<{ readonly ok: true; readonly result: unknown } | {
    readonly ok: false;
    readonly code: string;
    readonly retryable: boolean;
  }>;
}

export interface QueuePort {
  receive(signal: AbortSignal): Promise<Message | null>;
  send(response: WingReadResponse): Promise<void>;
  delete(receiptHandle: string): Promise<void>;
}

export interface RunnerLog {
  readonly event: string;
  readonly requestId?: string;
  readonly operation?: string;
  readonly status?: string;
  readonly errorCode?: string;
  readonly receiveCount?: number;
}

export type LogSink = (entry: RunnerLog) => void;

const defaultLog: LogSink = (entry) => console.log(JSON.stringify(entry));

function safeProviderResult(value: unknown): unknown {
  const serialized = JSON.stringify(value, (key, nested) =>
    /access.?key|secret.?key|authorization|vendor.?id|credential|api.?key|password|session.?token|security.?token/i.test(key)
      ? undefined
      : nested,
  );
  if (serialized.length > 200_000) throw new Error("WING_RESPONSE_TOO_LARGE");
  return JSON.parse(serialized) as unknown;
}

export class WingReadRunner {
  constructor(
    private readonly queue: QueuePort,
    private readonly wing: WingReadAdapter,
    private readonly log: LogSink = defaultLog,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async pollOnce(signal: AbortSignal): Promise<"idle" | "processed" | "poison"> {
    const message = await this.queue.receive(signal);
    if (message === null) return "idle";
    const receiveCount = Number(message.Attributes?.ApproximateReceiveCount ?? "1");
    if (!message.Body || !message.ReceiptHandle) {
      this.log({ event: "wing_read_poison", errorCode: "MESSAGE_ENVELOPE_INVALID", receiveCount });
      return "poison";
    }

    let request: WingReadRequest;
    try {
      request = parseWingReadRequest(JSON.parse(message.Body) as unknown, this.now());
    } catch (error) {
      if (error instanceof WingRequestError && error.correlation !== null) {
        const rejected = wingReadResponse(error.correlation, {
          status: error.status,
          error: { code: error.code, retryable: false },
        }, this.now());
        await this.queue.send(rejected);
        await this.queue.delete(message.ReceiptHandle);
        this.log({
          event: "wing_read_request_rejected",
          requestId: error.correlation.requestId,
          operation: error.correlation.operation,
          status: error.status,
          errorCode: error.code,
          receiveCount,
        });
        return "processed";
      }
      this.log({ event: "wing_read_poison", errorCode: "INVALID_REQUEST", receiveCount });
      return "poison";
    }

    let response: WingReadResponse;
    try {
      const executed = await this.wing.execute(request);
      response = executed.ok
        ? wingReadResponse(request, { status: "succeeded", result: safeProviderResult(executed.result) }, this.now())
        : wingReadResponse(request, {
            status: "failed",
            error: { code: executed.code, retryable: executed.retryable },
          }, this.now());
    } catch {
      response = wingReadResponse(request, {
        status: "failed",
        error: { code: "WING_ADAPTER_FAILED", retryable: true },
      }, this.now());
    }

    await this.queue.send(response);
    await this.queue.delete(message.ReceiptHandle);
    this.log({
      event: "wing_read_request_completed",
      requestId: request.requestId,
      operation: request.operation,
      status: response.status,
      receiveCount,
    });
    return "processed";
  }

  async run(signal: AbortSignal): Promise<void> {
    let delayMs = 1_000;
    while (!signal.aborted) {
      try {
        await this.pollOnce(signal);
        delayMs = 1_000;
      } catch {
        if (signal.aborted) break;
        this.log({ event: "wing_read_poll_failed", errorCode: "QUEUE_OPERATION_FAILED" });
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delayMs);
          signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
        });
        delayMs = Math.min(delayMs * 2, 60_000);
      }
    }
    this.log({ event: "wing_read_shutdown", status: "settled" });
  }
}

export function createSqsQueuePort(input: {
  readonly client: SQSClient;
  readonly requestQueueUrl: string;
  readonly responseQueueUrl: string;
  readonly waitTimeSeconds?: number;
  readonly visibilityTimeoutSeconds?: number;
}): QueuePort {
  return {
    async receive(signal) {
      const received = await input.client.send(new ReceiveMessageCommand({
        QueueUrl: input.requestQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: input.waitTimeSeconds ?? 20,
        VisibilityTimeout: input.visibilityTimeoutSeconds ?? 60,
        MessageSystemAttributeNames: ["ApproximateReceiveCount"],
      }), { abortSignal: signal });
      return received.Messages?.[0] ?? null;
    },
    async send(response) {
      const body = JSON.stringify(response);
      await input.client.send(new SendMessageCommand({
        QueueUrl: input.responseQueueUrl,
        MessageBody: body,
        MessageGroupId: "wing-read-responses",
        MessageDeduplicationId: crypto.createHash("sha256").update(body).digest("hex"),
      }));
    },
    async delete(receiptHandle) {
      await input.client.send(new DeleteMessageCommand({
        QueueUrl: input.requestQueueUrl,
        ReceiptHandle: receiptHandle,
      }));
    },
  };
}

export function createCoupangWingReadAdapter(): WingReadAdapter {
  return {
    async execute(request) {
      const { coupangRequest, getCoupangConfig } = await import("@/lib/coupang/client");
      const { vendorId } = getCoupangConfig();
      let pathName: string;
      let searchParams: URLSearchParams | undefined;
      if (request.operation === "connection_test") {
        pathName = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/inflow-status";
        searchParams = new URLSearchParams({ vendorId });
      } else if (request.operation === "list_seller_products") {
        const parameters = sellerProductParameters(request);
        pathName = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products";
        searchParams = new URLSearchParams({ vendorId, maxPerPage: String(parameters.maxPerPage) });
        if (parameters.nextToken !== undefined) searchParams.set("nextToken", parameters.nextToken);
      } else {
        pathName = `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/${categoryCode(request)}`;
      }
      const result = await coupangRequest<unknown>({
        method: "GET",
        path: pathName,
        searchParams,
        signal: AbortSignal.timeout(15_000),
      });
      if (result.ok) return { ok: true, result: request.operation === "connection_test" ? { connected: true } : result.data };
      return {
        ok: false,
        code: result.status === 429 ? "WING_RATE_LIMITED" : "WING_REQUEST_FAILED",
        retryable: result.status === 429 || result.status >= 500,
      };
    },
  };
}

async function main(): Promise<void> {
  const requestQueueUrl = process.env.CENTRAL_RUNNER_REQUEST_QUEUE_URL?.trim();
  const responseQueueUrl = process.env.CENTRAL_RUNNER_RESPONSE_QUEUE_URL?.trim();
  if (!requestQueueUrl || !responseQueueUrl) throw new Error("CENTRAL_RUNNER_QUEUE_CONFIGURATION_MISSING");
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  const client = new SQSClient({ region: process.env.AWS_REGION?.trim() || "ap-northeast-2" });
  const runner = new WingReadRunner(createSqsQueuePort({ client, requestQueueUrl, responseQueueUrl }), createCoupangWingReadAdapter());
  try {
    await runner.run(controller.signal);
  } finally {
    client.destroy();
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/tools/central-runner/worker.ts")) {
  void main();
}
