import crypto from "node:crypto";

import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import {
  WING_READ_CONTRACT_VERSION,
  WING_READ_REQUEST_TYPE,
  WING_READ_RESPONSE_TYPE,
  WING_READ_SOURCE,
  type WingReadResponse,
} from "./contracts.ts";

const requestQueueUrl = process.env.CENTRAL_RUNNER_REQUEST_QUEUE_URL?.trim();
const responseQueueUrl = process.env.CENTRAL_RUNNER_RESPONSE_QUEUE_URL?.trim();
if (!requestQueueUrl || !responseQueueUrl) throw new Error("CENTRAL_RUNNER_QUEUE_CONFIGURATION_MISSING");

const sqs = new SQSClient({ region: process.env.AWS_REGION?.trim() || "ap-northeast-2" });
const requestId = crypto.randomUUID();
const requestedAt = new Date();
const idempotencyKey = `wing-read:${requestId}`;
const request = {
  contractVersion: WING_READ_CONTRACT_VERSION,
  messageType: WING_READ_REQUEST_TYPE,
  requestId,
  idempotencyKey,
  requestedAt: requestedAt.toISOString(),
  expiresAt: new Date(requestedAt.getTime() + 5 * 60_000).toISOString(),
  source: WING_READ_SOURCE,
  operation: "connection_test",
  parameters: {},
};

async function main(): Promise<void> {
  const body = JSON.stringify(request);
  await sqs.send(new SendMessageCommand({
    QueueUrl: requestQueueUrl,
    MessageBody: body,
    MessageGroupId: "wing-read-requests",
    MessageDeduplicationId: crypto.createHash("sha256").update(body).digest("hex"),
  }));
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const received = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: responseQueueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
      VisibilityTimeout: 30,
    }));
    const message = received.Messages?.[0];
    if (!message?.Body || !message.ReceiptHandle) continue;
    let response: WingReadResponse | undefined;
    try { response = JSON.parse(message.Body) as WingReadResponse; } catch { /* unrelated poison response */ }
    if (response?.messageType !== WING_READ_RESPONSE_TYPE || response.requestId !== requestId) {
      await sqs.send(new ChangeMessageVisibilityCommand({
        QueueUrl: responseQueueUrl,
        ReceiptHandle: message.ReceiptHandle,
        VisibilityTimeout: 0,
      }));
      continue;
    }
    await sqs.send(new DeleteMessageCommand({ QueueUrl: responseQueueUrl, ReceiptHandle: message.ReceiptHandle }));
    console.log(JSON.stringify({ status: response.status, errorCode: response.error?.code ?? null }));
    process.exit(response.status === "succeeded" ? 0 : 2);
  }
  throw new Error("CENTRAL_RUNNER_SMOKE_TIMEOUT");
}

void main().finally(() => sqs.destroy());
