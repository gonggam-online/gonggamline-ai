import crypto from "node:crypto";

import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import { CENTRAL_RUNNER_SCHEMA_VERSION, type CentralRunnerResponse } from "./contracts.ts";

const requestQueueUrl = process.env.CENTRAL_RUNNER_REQUEST_QUEUE_URL?.trim();
const responseQueueUrl = process.env.CENTRAL_RUNNER_RESPONSE_QUEUE_URL?.trim();
if (!requestQueueUrl || !responseQueueUrl) throw new Error("CENTRAL_RUNNER_QUEUE_CONFIGURATION_MISSING");

const sqs = new SQSClient({ region: process.env.AWS_REGION?.trim() || "ap-southeast-1" });
const taskId = `smoke-${crypto.randomUUID().replaceAll("-", "")}`;
const requestedAt = new Date();
const canonical = `${taskId}:COUPANG_CONNECTION_TEST:${requestedAt.toISOString()}`;
const request = {
  schemaVersion: CENTRAL_RUNNER_SCHEMA_VERSION,
  taskId,
  sourceProject: "pixtil-smoke",
  operation: "COUPANG_CONNECTION_TEST",
  requestedAt: requestedAt.toISOString(),
  expiresAt: new Date(requestedAt.getTime() + 5 * 60_000).toISOString(),
  idempotencyKey: `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`,
  arguments: {},
};

async function main(): Promise<void> {
  await sqs.send(new SendMessageCommand({ QueueUrl: requestQueueUrl, MessageBody: JSON.stringify(request) }));

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
    let response: CentralRunnerResponse | undefined;
    try { response = JSON.parse(message.Body) as CentralRunnerResponse; } catch { /* leave unrelated malformed responses untouched */ }
    if (response?.taskId !== taskId) {
      await sqs.send(new ChangeMessageVisibilityCommand({
        QueueUrl: responseQueueUrl,
        ReceiptHandle: message.ReceiptHandle,
        VisibilityTimeout: 0,
      }));
      continue;
    }
    await sqs.send(new DeleteMessageCommand({ QueueUrl: responseQueueUrl, ReceiptHandle: message.ReceiptHandle }));
    console.log(JSON.stringify({ ok: response.ok, status: response.status, errorCode: response.errorCode ?? null }));
    process.exit(response.ok ? 0 : 2);
  }

  throw new Error("CENTRAL_RUNNER_SMOKE_TIMEOUT");
}

void main();
