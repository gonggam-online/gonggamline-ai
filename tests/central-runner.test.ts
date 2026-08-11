import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
  type Message,
} from "@aws-sdk/client-sqs";

import {
  parseWingReadRequest,
  WingRequestError,
  WING_READ_CONTRACT_VERSION,
  WING_READ_REQUEST_TYPE,
  WING_READ_RESPONSE_TYPE,
  WING_READ_SOURCE,
  type WingReadRequest,
  type WingReadResponse,
} from "@/tools/central-runner/contracts";
import {
  createSqsQueuePort,
  WingReadRunner,
  type LogSink,
  type QueuePort,
  type WingReadAdapter,
} from "@/tools/central-runner/worker";

const NOW = new Date("2026-08-11T03:00:00.000Z");

function request(overrides: Partial<WingReadRequest> = {}): WingReadRequest {
  return {
    contractVersion: WING_READ_CONTRACT_VERSION,
    messageType: WING_READ_REQUEST_TYPE,
    requestId: "018f47a6-7b2c-7d9a-8b5c-0f1e2d3c4b5a",
    idempotencyKey: "picktil:wing:018f47a6-7b2c-7d9a-8b5c-0f1e2d3c4b5a",
    requestedAt: "2026-08-11T02:59:00.000Z",
    expiresAt: "2026-08-11T03:09:00.000Z",
    source: WING_READ_SOURCE,
    operation: "category_meta",
    parameters: { displayCategoryCode: "123456" },
    ...overrides,
  };
}

function message(value: unknown, receiveCount = 1): Message {
  return {
    Body: typeof value === "string" ? value : JSON.stringify(value),
    ReceiptHandle: `receipt-${receiveCount}`,
    Attributes: { ApproximateReceiveCount: String(receiveCount) },
  };
}

class FakeQueue implements QueuePort {
  readonly sent: WingReadResponse[] = [];
  readonly deleted: string[] = [];
  sendFailures = 0;

  constructor(readonly messages: Message[]) {}

  async receive(): Promise<Message | null> {
    return this.messages.shift() ?? null;
  }

  async send(response: WingReadResponse): Promise<void> {
    if (this.sendFailures > 0) {
      this.sendFailures -= 1;
      throw new Error("synthetic send failure");
    }
    this.sent.push(response);
  }

  async delete(receiptHandle: string): Promise<void> {
    this.deleted.push(receiptHandle);
  }
}

test("accepts exact 1.0.0 read contracts and operation parameters", () => {
  assert.equal(parseWingReadRequest(request(), NOW).operation, "category_meta");
  assert.equal(parseWingReadRequest(request({ operation: "connection_test", parameters: {} }), NOW).operation, "connection_test");
  assert.deepEqual(
    parseWingReadRequest(request({ operation: "list_seller_products", parameters: { maxPerPage: 50, nextToken: "next-1" } }), NOW).parameters,
    { maxPerPage: 50, nextToken: "next-1" },
  );
});

test("rejects writes, credentials, wrong source/version/type, and invalid windows", () => {
  const invalid: unknown[] = [
    { ...request(), operation: "create_product" },
    { ...request(), operation: "order" },
    { ...request(), source: "other-project" },
    { ...request(), contractVersion: "1.0.1" },
    { ...request(), messageType: "wing.write.request" },
    { ...request(), vendorId: "forbidden" },
    { ...request(), parameters: { displayCategoryCode: "123", vendorId: "forbidden" } },
    request({ expiresAt: "2026-08-11T03:20:00.000Z" }),
  ];
  for (const value of invalid) assert.throws(() => parseWingReadRequest(value, NOW), WingRequestError);
});

test("expired correlated input produces expired response without WING", async () => {
  let wingCalls = 0;
  const queue = new FakeQueue([message(request({ expiresAt: "2026-08-11T02:59:59.000Z" }))]);
  const runner = new WingReadRunner(queue, {
    async execute() { wingCalls += 1; return { ok: true, result: {} }; },
  }, () => undefined, () => NOW);
  assert.equal(await runner.pollOnce(new AbortController().signal), "processed");
  assert.equal(wingCalls, 0);
  assert.equal(queue.sent[0]?.status, "expired");
  assert.equal(queue.sent[0]?.messageType, WING_READ_RESPONSE_TYPE);
  assert.deepEqual(queue.deleted, ["receipt-1"]);
});

test("poison input remains unacknowledged for SQS DLQ redrive", async () => {
  const logs: Parameters<LogSink>[0][] = [];
  const queue = new FakeQueue([message("{not-json", 3)]);
  const runner = new WingReadRunner(queue, { async execute() { throw new Error("must not run"); } }, (entry) => logs.push(entry), () => NOW);
  assert.equal(await runner.pollOnce(new AbortController().signal), "poison");
  assert.equal(queue.sent.length, 0);
  assert.equal(queue.deleted.length, 0);
  assert.equal(logs[0]?.receiveCount, 3);
  assert.equal(logs[0]?.errorCode, "INVALID_REQUEST");
});

test("duplicate delivery can repeat only a read and remains correlated", async () => {
  let wingCalls = 0;
  const wing: WingReadAdapter = {
    async execute() { wingCalls += 1; return { ok: true, result: { connected: true } }; },
  };
  const input = request({ operation: "connection_test", parameters: {} });
  const queue = new FakeQueue([message(input), message(input, 2)]);
  const runner = new WingReadRunner(queue, wing, () => undefined, () => NOW);
  await runner.pollOnce(new AbortController().signal);
  await runner.pollOnce(new AbortController().signal);
  assert.equal(wingCalls, 2);
  assert.equal(queue.sent[0]?.requestId, input.requestId);
  assert.equal(queue.sent[1]?.requestId, input.requestId);
  assert.deepEqual(queue.deleted, ["receipt-1", "receipt-2"]);
});

test("response send failure leaves request unacknowledged for safe read retry", async () => {
  let wingCalls = 0;
  const input = request({ operation: "connection_test", parameters: {} });
  const queue = new FakeQueue([message(input)]);
  queue.sendFailures = 1;
  const runner = new WingReadRunner(queue, {
    async execute() { wingCalls += 1; return { ok: true, result: { connected: true } }; },
  }, () => undefined, () => NOW);
  await assert.rejects(() => runner.pollOnce(new AbortController().signal));
  assert.equal(queue.deleted.length, 0);
  queue.messages.push(message(input, 2));
  await runner.pollOnce(new AbortController().signal);
  assert.equal(wingCalls, 2);
  assert.equal(queue.sent[0]?.status, "succeeded");
  assert.deepEqual(queue.deleted, ["receipt-2"]);
});

test("result and logs redact credential-shaped fields", async () => {
  const logs: Parameters<LogSink>[0][] = [];
  const queue = new FakeQueue([message(request())]);
  const runner = new WingReadRunner(queue, {
    async execute() {
      return { ok: true, result: { item: 1, nextToken: "page-2", accessKey: "synthetic", nested: { secretKey: "synthetic", vendorId: "synthetic" } } };
    },
  }, (entry) => logs.push(entry), () => NOW);
  await runner.pollOnce(new AbortController().signal);
  const serialized = JSON.stringify({ response: queue.sent, logs });
  assert.doesNotMatch(serialized, /synthetic/);
  assert.match(serialized, /"item":1/);
  assert.match(serialized, /"nextToken":"page-2"/);
});

test("graceful shutdown stops a bounded poll loop", async () => {
  const logs: Parameters<LogSink>[0][] = [];
  const controller = new AbortController();
  const queue: QueuePort = {
    receive(signal) {
      return new Promise((resolve) => signal.addEventListener("abort", () => resolve(null), { once: true }));
    },
    async send() { throw new Error("must not send"); },
    async delete() { throw new Error("must not delete"); },
  };
  const runner = new WingReadRunner(queue, { async execute() { throw new Error("must not run"); } }, (entry) => logs.push(entry), () => NOW);
  const running = runner.run(controller.signal);
  controller.abort();
  await running;
  assert.equal(logs.at(-1)?.event, "wing_read_shutdown");
});

test("consumer uses explicit FIFO fields while Picktil Terraform remains infrastructure authority", () => {
  const worker = readFileSync("tools/central-runner/worker.ts", "utf8");
  const smoke = readFileSync("tools/central-runner/smoke.ts", "utf8");
  const runbook = readFileSync("docs/central-runner/README.md", "utf8");
  assert.match(worker, /MessageGroupId: "wing-read-responses"/);
  assert.match(worker, /MessageDeduplicationId:/);
  assert.match(smoke, /MessageGroupId: "wing-read-requests"/);
  assert.match(smoke, /MessageDeduplicationId:/);
  assert.match(runbook, /09-cloud-platform Terraform is the sole/);
  assert.match(runbook, /must not be deployed or extended/);
  assert.doesNotMatch(worker, /CENTRAL_RUNNER_LEDGER_PATH|processed-request-ledger/);
});

test("SQS port enforces bounded long polling, visibility, FIFO response, and delete inputs", async () => {
  const commands: unknown[] = [];
  const client = {
    async send(command: unknown): Promise<Record<string, unknown>> {
      commands.push(command);
      return command instanceof ReceiveMessageCommand ? { Messages: [] } : {};
    },
  } as unknown as SQSClient;
  const port = createSqsQueuePort({
    client,
    requestQueueUrl: "https://example.invalid/request.fifo",
    responseQueueUrl: "https://example.invalid/response.fifo",
  });
  await port.receive(new AbortController().signal);
  await port.send({
    contractVersion: WING_READ_CONTRACT_VERSION,
    messageType: WING_READ_RESPONSE_TYPE,
    requestId: request().requestId,
    idempotencyKey: request().idempotencyKey,
    respondedAt: NOW.toISOString(),
    operation: "connection_test",
    status: "succeeded",
    result: { connected: true },
  });
  await port.delete("receipt");

  const receive = commands[0];
  const send = commands[1];
  const deletion = commands[2];
  assert.ok(receive instanceof ReceiveMessageCommand);
  assert.equal(receive.input.WaitTimeSeconds, 20);
  assert.equal(receive.input.VisibilityTimeout, 60);
  assert.equal(receive.input.MaxNumberOfMessages, 1);
  assert.ok(send instanceof SendMessageCommand);
  assert.equal(send.input.MessageGroupId, "wing-read-responses");
  assert.match(send.input.MessageDeduplicationId ?? "", /^[a-f0-9]{64}$/);
  assert.ok(deletion instanceof DeleteMessageCommand);
  assert.equal(deletion.input.ReceiptHandle, "receipt");
});
